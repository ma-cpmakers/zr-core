<?php

namespace Zeiras\Core\Http;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Zeiras\Auth\Api;
use Zeiras\Auth\Errori\BackofficeNonRisponde;
use Zeiras\Auth\Errori\ErroreApi;

/**
 * Le notifiche del pannello della cornice, per il browser: la parte server le chiede al backoffice col gettone del workspace
 * in cui la persona è entrata, mai con quello dell'accesso (che non ha un workspace), e alla cornice dà solo ciò che usa:
 * l'id, quando è nata e se è letta. `tipo`, `soggetto` e `dati` restano qui: il contratto non dice di che prodotto è una
 * notifica, e la cornice non lo indovina. Senza un workspace nella sessione risponde ConWorkspace; un backoffice che non
 * risponde è BackofficeNonRisponde, cioè un errore, mai un elenco vuoto.
 */
final class NotificheDellaCornice
{
    /**
     * Com'è fatto l'id di una notifica che la rotta accetta: lettere, cifre, `-` e `_`, 64 al più. L'id arriva dal browser e
     * finisce nel percorso chiamato sul backoffice col gettone della persona: con una barra o due punti sarebbe un altro
     * metodo. È il vincolo della rotta (routes/cornice.php): un id diverso non arriva qui, ed è un 404.
     */
    public const ID = '[A-Za-z0-9_-]{1,64}';

    /** GET /cornice/notifiche: le notifiche del workspace dalla più recente, la prima pagina di io.notifiche.elenca. */
    public function elenco(): JsonResponse
    {
        $notifiche = Api::workspace()->get('/v1/io/notifiche')['data'] ?? null;

        if (! is_array($notifiche) || ! array_is_list($notifiche)) {
            throw new BackofficeNonRisponde('La risposta di GET /v1/io/notifiche non è una lista di /v1.');
        }

        return new JsonResponse(['data' => array_map(fn (mixed $notifica) => self::perLaCornice($notifica, 'GET /v1/io/notifiche'), $notifiche)]);
    }

    /**
     * PATCH /cornice/notifiche/{notifica}/lettura: segna letta o non letta una notifica della persona nel workspace
     * (io.notifiche.lettura.modifica). `letta` della risposta è ciò che il backoffice ha segnato, non ciò che si è chiesto.
     */
    public function lettura(Request $richiesta, string $notifica): JsonResponse
    {
        // Solo dal corpo JSON, e solo un booleano: `"true"` e `1` non lo sono, e il backoffice non legge la query.
        $letta = $richiesta->json('letta');

        if (! is_bool($letta)) {
            return new JsonResponse(['errore' => 'dati_non_validi'], 422);
        }

        $percorso = '/v1/io/notifiche/'.rawurlencode($notifica).'/lettura';

        try {
            $segnata = self::perLaCornice(Api::workspace()->patch($percorso, ['letta' => $letta])['data'] ?? null, "PATCH {$percorso}");
        } catch (ErroreApi $errore) {
            // Una notifica di un'altra persona, di un altro workspace, o che non c'è: per il backoffice sono lo stesso 404.
            if ($errore->stato === 404 && $errore->codice === 'non_trovato') {
                return new JsonResponse(['errore' => 'non_trovato'], 404);
            }

            throw $errore;
        }

        if ($segnata['id'] !== $notifica) {
            throw new BackofficeNonRisponde("La risposta di PATCH {$percorso} è un'altra notifica.");
        }

        return new JsonResponse(['data' => ['id' => $segnata['id'], 'letta' => $segnata['letta']]]);
    }

    /**
     * Ciò che la cornice usa di una notifica di /v1: l'id, quando è nata e se è letta. `letta_il` c'è sempre, ed è null finché
     * la persona non la segna: una risposta senza uno dei tre non è una notifica, ed è un guasto, mai una notifica non letta.
     *
     * @return array{id: string, creata_il: string, letta: bool}
     */
    private static function perLaCornice(mixed $notifica, string $metodo): array
    {
        if (! is_array($notifica) || ! is_string($notifica['id'] ?? null) || ! is_string($notifica['creata_il'] ?? null)
            || ! array_key_exists('letta_il', $notifica) || ! ($notifica['letta_il'] === null || is_string($notifica['letta_il']))) {
            throw new BackofficeNonRisponde("La risposta di {$metodo} non è una notifica di /v1.");
        }

        return ['id' => $notifica['id'], 'creata_il' => $notifica['creata_il'], 'letta' => $notifica['letta_il'] !== null];
    }
}
