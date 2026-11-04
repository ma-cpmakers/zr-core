<?php

namespace Zeiras\Core\Http;

use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Zeiras\Auth\Api;
use Zeiras\Auth\Errori\ErroreApi;
use Zeiras\Auth\Sessione;

/**
 * La foto della persona, dall'host del frontend (dalla `v4.1.0`): GET /cornice/foto la legge da io.foto.file.mostra (GET
 * /v1/io/foto/file) col gettone della persona, che resta nella sessione, e la rende com'è — i byte, il tipo, l'ETag —, con la
 * cache privata di cinque minuti del backoffice. L'indirizzo lo danno i dati della cornice (`persona.foto`), col `?v=` che
 * cambia a ogni sostituzione (qui non si legge) e `p`, di chi è (`diChi()`): un `p` che non è della persona della sessione, o
 * che manca, è un 404 senza chiamare il backoffice. Così la pagina non chiama un altro host, e la CSP di tutti (`img-src
 * 'self'`) non cambia.
 *
 * La chiede un `<img>`, che non manda intestazioni: per questo la rotta sta fuori da StessaPersona, e risponde solo alla
 * persona della sessione, con la sua foto. Senza sessione risponde la guardia di zr-auth, prima della rotta, come a ogni GET
 * del gruppo `web`. `Cross-Origin-Resource-Policy: same-origin` la tiene fuori dalle pagine di altri siti. Di un errore dice
 * solo lo stato, senza corpo e senza cache: senza foto il 404 `foto_assente` del backoffice è un 404, e un altro 4xx (il 403
 * `accettazione_richiesta`, il 429 col suo `Retry-After`) è lo stesso stato. Un 5xx, o un backoffice che non risponde, passano come da ogni rotta.
 */
final class FotoDellaCornice
{
    /** Il file della foto, in io.foto.file.mostra. */
    private const FILE = '/v1/io/foto/file';

    /** Un entity-tag solo, forte o debole, in ASCII come lo vuole `Api::immagine`: la sola condizione che va al backoffice. */
    private const ENTITY_TAG = '/\A(W\/)?"[\x21\x23-\x7E]*"\z/';

    /**
     * Di chi è un indirizzo della foto (`p`, dalla revisione di sicurezza della PR #162, SEC1): un HMAC dell'id della persona con la
     * chiave dell'app, né l'id né l'impronta di zr-auth. Una scheda rimasta ferma di un'altra persona chiede la foto col suo `p`, e
     * la cache del browser non tiene la foto di chi è nella sessione sotto l'indirizzo di un altro.
     */
    public static function diChi(string $id): string
    {
        return substr(hash_hmac('sha256', 'zr-core.foto|'.$id, (string) config('app.key')), 0, 16);
    }

    public function mostra(Request $richiesta): Response
    {
        // Come una richiesta del JS: StartSession non la ricorda come pagina di prima (`_previous.url`), e un `back()` non
        // porta alla foto (SEC4).
        $richiesta->headers->set('X-Requested-With', 'XMLHttpRequest');

        $id = Sessione::utente()['id'] ?? null;
        $p = $richiesta->query('p');
        if (! is_string($id) || $id === '' || ! is_string($p) || ! hash_equals(self::diChi($id), $p)) {
            return self::senza(Response::HTTP_NOT_FOUND);
        }

        // Un `If-None-Match` che non è un entity-tag (un elenco, `*`) non va al backoffice: la foto arriva intera.
        $condizione = trim((string) $richiesta->headers->get('If-None-Match'));
        $versione = preg_match(self::ENTITY_TAG, $condizione) === 1 ? $condizione : null;

        try {
            $foto = Api::persona()->immagine(self::FILE, $versione);
        } catch (ErroreApi $errore) {
            if ($errore->stato >= 500) {
                throw $errore;
            }

            return self::senza($errore->stato, $errore->stato === 429 ? $errore->riprovaFra : null);
        }

        $intestazioni = [
            'Cache-Control' => 'private, max-age=300',
            'X-Content-Type-Options' => 'nosniff',
            'Cross-Origin-Resource-Policy' => 'same-origin',
            ...($foto['etag'] === null ? [] : ['ETag' => $foto['etag']]),
        ];

        return $foto['stato'] === 304
            ? new Response('', Response::HTTP_NOT_MODIFIED, $intestazioni)
            : new Response($foto['corpo'], Response::HTTP_OK, ['Content-Type' => $foto['tipo'], ...$intestazioni]);
    }

    /** Una risposta senza foto: lo stato, niente corpo, niente cache; davanti al 429, i secondi del backoffice in `Retry-After`. */
    private static function senza(int $stato, ?int $riprovaFra = null): Response
    {
        return new Response('', $stato, ['Cache-Control' => 'no-store', 'X-Content-Type-Options' => 'nosniff', ...($riprovaFra === null ? [] : ['Retry-After' => (string) $riprovaFra])]);
    }
}
