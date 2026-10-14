<?php

namespace Zeiras\Core;

use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Cookie;

/**
 * Il segno di un istante della parte server: quando una lettura è cominciata, quando una lettura è stata segnata. Lo portano
 * i dati della cornice e l'elenco delle notifiche (`aggiornati_il`), la risposta di «segna tutte come lette» (`segnate_il`)
 * e quella della lettura di una notifica (`segnata_il`): la cornice, nel browser, li confronta per non tornare a ciò che è
 * più vecchio di quello che sa già. Per questo vengono tutti da qui: un orologio solo, quello della parte server, e una
 * forma sola.
 *
 * Dalla `v2.11.0` un segno non va mai indietro per lo stesso browser: l'ultimo dato sta nel cookie `__Host-zr-core-segno`,
 * firmato con la chiave dell'applicazione, e un segno nuovo è il più avanti fra l'orologio e quello. Con due server del
 * frontend sfasati, o con l'orologio riportato indietro, la pagina di chi è entrato adesso non vale come una pagina vecchia.
 * Il cookie porta solo l'istante e la sua firma: niente della persona né del workspace. Uno che non torna — manomesso,
 * firmato con un'altra chiave, in un'altra forma, vuoto — o che manca non vale: il segno è l'orologio, come prima, e la
 * risposta riscrive il cookie. Lo manda `AddQueuedCookiesToResponse` del gruppo `web`.
 */
final class Segno
{
    /** Il nome del cookie: col prefisso `__Host-` il browser lo vuole `Secure`, con `Path=/` e senza `Domain`. */
    public const COOKIE = '__Host-zr-core-segno';

    /** L'ultimo segno dato in questa richiesta, attributo della richiesta: due letture nello stesso istante hanno lo stesso. */
    private const DATO = 'zr-core.segno';

    /** La forma di un segno: quella di `adesso()`, e nient'altro. */
    private const FORMA = '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/';

    /**
     * L'istante di adesso, in UTC qualunque sia il fuso dell'applicazione, coi microsecondi sempre a sei cifre e `Z` in fondo
     * (`2026-10-09T21:31:05.123456Z`): così due segni si ordinano anche come stringhe. Se a questo browser è già stato dato
     * un segno più avanti — in questa richiesta, o in una di prima col cookie —, è quello.
     */
    public static function adesso(): string
    {
        $chiave = self::chiave();
        $orologio = Carbon::now('UTC')->format('Y-m-d\TH:i:s.u\Z');
        $dato = request()->attributes->get(self::DATO);
        $ricordato = is_string($dato) ? $dato : ($chiave === null ? null : self::dalCookie($chiave));
        $segno = $ricordato !== null && strcmp($ricordato, $orologio) > 0 ? $ricordato : $orologio;

        request()->attributes->set(self::DATO, $segno);
        if ($chiave !== null) {
            app('cookie')->queue(self::cookie($segno, $chiave));
        }

        return $segno;
    }

    /** L'istante che il cookie della richiesta porta, se la sua firma è di questa chiave; altrimenti null. */
    private static function dalCookie(string $chiave): ?string
    {
        $valore = request()->cookies->get(self::COOKIE);
        if (! is_string($valore)) {
            return null;
        }

        $parti = explode('.', $valore);
        // L'istante ha un punto suo, prima dei microsecondi: istante e firma sono tre parti.
        if (count($parti) !== 3) {
            return null;
        }

        $istante = $parti[0].'.'.$parti[1];

        return preg_match(self::FORMA, $istante) === 1 && hash_equals(self::firma($istante, $chiave), $parti[2]) ? $istante : null;
    }

    /** Il cookie col segno: dura quanto la sessione, come il suo. */
    private static function cookie(string $segno, string $chiave): Cookie
    {
        $scade = config('session.expire_on_close') ? 0 : Carbon::now()->addMinutes((int) config('session.lifetime'))->getTimestamp();

        return new Cookie(self::COOKIE, $segno.'.'.self::firma($segno, $chiave), $scade, '/', null, true, true, false, Cookie::SAMESITE_LAX);
    }

    /** Un HMAC-SHA256 dell'istante, legato all'host della richiesta e a questo cookie, in esadecimale. */
    private static function firma(string $istante, string $chiave): string
    {
        return hash_hmac('sha256', self::COOKIE.'|'.request()->getHost().'|'.$istante, $chiave);
    }

    /** La chiave dell'applicazione, come la legge Laravel (`base64:` davanti), o null se non c'è. */
    private static function chiave(): ?string
    {
        $chiave = config('app.key');
        if (! is_string($chiave) || $chiave === '') {
            return null;
        }

        if (Str::startsWith($chiave, 'base64:')) {
            $chiave = base64_decode(Str::after($chiave, 'base64:'), true);
        }

        return is_string($chiave) && $chiave !== '' ? $chiave : null;
    }
}
