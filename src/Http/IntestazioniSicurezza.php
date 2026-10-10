<?php

namespace Zeiras\Core\Http;

/**
 * La CSP dei frontend di Zeiras: quella di tutti, e come si compone quella di una risposta con ciò che un modulo aggiunge
 * per sempre e ciò che una pagina aggiunge per sé.
 *
 * Un modulo e una pagina aggiungono sorgenti, e solo a sei direttive: non tolgono niente e non toccano le altre. Una
 * sorgente è `'self'` oppure un'origine `https://` scritta per intero. Tutto il resto è scartato, mai aggiustato: il ramo
 * sicuro è la CSP più stretta.
 */
final class IntestazioniSicurezza
{
    /** La CSP di tutti: quella di un modulo che non aggiunge niente. */
    public const CSP = "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; img-src 'self'; font-src https://fonts.gstatic.com; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

    /** La Permissions-Policy di tutti: le otto funzioni spente. */
    public const PERMESSI = 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()';

    /** L'ordine delle direttive nell'intestazione: una che la CSP di tutti non ha (`frame-src`) prende il suo posto qui. */
    private const ORDINE = ['default-src', 'script-src', 'style-src', 'img-src', 'font-src', 'connect-src', 'frame-src', 'object-src', 'base-uri', 'form-action', 'frame-ancestors'];

    /** Le sole direttive a cui un modulo o una pagina aggiungono sorgenti. Le altre sono uguali per tutti. */
    private const ESTENDIBILI = ['script-src', 'style-src', 'img-src', 'font-src', 'connect-src', 'frame-src'];

    /**
     * La CSP di una risposta: quella di tutti, più ciò che il modulo aggiunge per sempre, più ciò che la pagina aggiunge per
     * sé. Le direttive escono nell'ordine di ORDINE, e una senza sorgenti non esce; dentro una direttiva prima le parole fra
     * apici e poi le origini, ognuna una volta sola e nell'ordine in cui sono dichiarate: tutti, modulo, pagina. Non lancia:
     * ciò che non ha la forma attesa è scartato.
     *
     * @internal un frontend scrive le sue sorgenti nella configurazione: questa funzione la chiama la classe
     *
     * @param  mixed  $delModulo  una mappa direttiva → lista di sorgenti
     * @param  mixed  $dellaPagina  lo stesso, per una pagina sola
     * @return array{0: string, 1: list<string>} la CSP, e ciò che è stato scartato: di chi era, la direttiva, il motivo
     */
    public static function componi(mixed $delModulo = [], mixed $dellaPagina = []): array
    {
        $direttive = [];
        foreach (explode('; ', self::CSP) as $direttiva) {
            $sorgenti = explode(' ', $direttiva);
            $direttive[array_shift($sorgenti)] = $sorgenti;
        }

        $scartate = [];
        foreach (['modulo' => $delModulo, 'pagina' => $dellaPagina] as $diChi => $aggiunte) {
            if (! is_array($aggiunte)) {
                $scartate[] = $diChi.': le aggiunte non sono una mappa di direttive ('.get_debug_type($aggiunte).')';

                continue;
            }
            foreach ($aggiunte as $nome => $sorgenti) {
                $dove = $diChi.', '.self::ritaglio((string) $nome).': ';
                if (! in_array($nome, self::ESTENDIBILI, true)) {
                    $scartate[] = $dove.'a questa direttiva non si aggiungono sorgenti';
                } elseif (! is_array($sorgenti)) {
                    $scartate[] = $dove.'le sorgenti non sono una lista ('.get_debug_type($sorgenti).')';
                } else {
                    foreach ($sorgenti as $sorgente) {
                        if (! is_string($sorgente)) {
                            $scartate[] = $dove.'una sorgente non è un testo ('.get_debug_type($sorgente).')';
                        } elseif (! self::ammessa($sorgente)) {
                            $scartate[] = $dove.'sorgente non ammessa «'.self::ritaglio($sorgente).'»';
                        } else {
                            $direttive[$nome][] = $sorgente;
                        }
                    }
                }
            }
        }

        $pezzi = [];
        foreach (self::ORDINE as $nome) {
            $sorgenti = array_values(array_unique($direttive[$nome] ?? []));
            if ($sorgenti === []) {
                continue;
            }
            $fraApici = array_filter($sorgenti, fn (string $sorgente) => $sorgente[0] === "'");
            $pezzi[] = $nome.' '.implode(' ', [...$fraApici, ...array_diff($sorgenti, $fraApici)]);
        }

        return [implode('; ', $pezzi), $scartate];
    }

    /**
     * Una sorgente che un modulo o una pagina possono aggiungere: `'self'`, o un'origine https scritta per intero — un nome
     * di dominio in minuscolo con almeno un punto e, se c'è, una porta fra 1 e 65535 senza zeri davanti. Non un indirizzo IP
     * (l'ultima etichetta è di sole lettere), non punycode (`xn--`); etichette di 63 caratteri al più, 253 in tutto. Niente
     * schemi interi, jolly, percorsi, altre parole fra apici: vale solo ciò che è scritto esattamente così.
     */
    private static function ammessa(string $sorgente): bool
    {
        if ($sorgente === "'self'") {
            return true;
        }
        // 270 byte: lo schema, i 253 del nome e la porta. Una sorgente più lunga non arriva all'espressione regolare.
        if (strlen($sorgente) > 270
            || preg_match('~\Ahttps://((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})(?::([1-9][0-9]{0,4}))?\z~', $sorgente, $pezzi) !== 1) {
            return false;
        }

        return strlen($pezzi[1]) <= 253
            && ! str_contains('.'.$pezzi[1], '.xn--')
            && (! isset($pezzi[2]) || (int) $pezzi[2] <= 65535);
    }

    /** Un pezzo di un valore scartato, per l'avviso: 60 byte al più, e solo caratteri ASCII che si stampano (mai un a capo). */
    private static function ritaglio(string $testo): string
    {
        return preg_replace('/[^\x20-\x7E]/', '?', substr($testo, 0, 60)).(strlen($testo) > 60 ? '…' : '');
    }
}
