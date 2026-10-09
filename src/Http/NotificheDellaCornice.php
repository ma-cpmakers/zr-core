<?php

namespace Zeiras\Core\Http;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Zeiras\Auth\Api;
use Zeiras\Auth\Errori\BackofficeNonRisponde;
use Zeiras\Auth\Errori\ErroreApi;
use Zeiras\Auth\Sessione;

/**
 * Le notifiche del pannello della cornice, per il browser: la parte server le chiede al backoffice col gettone del workspace
 * in cui la persona è entrata, mai con quello dell'accesso (che non ha un workspace), e alla cornice dà solo ciò che usa:
 * l'id, quando è nata, se è letta e `app`, il codice dell'app da cui viene. Di che prodotto è lo dice il registro di zr-core,
 * nel browser: un codice che il registro non ha passa da qui com'è, e la cornice non mostra un prodotto. `tipo`, `soggetto`
 * e `dati` restano qui. Segnarle lette tutte insieme è una richiesta sola al backoffice, fino a un istante, non una per
 * notifica. Senza un workspace nella sessione risponde ConWorkspace; un backoffice che non risponde è
 * BackofficeNonRisponde, cioè un errore, mai un elenco vuoto.
 */
final class NotificheDellaCornice
{
    /**
     * Com'è fatto l'id di una notifica che la rotta accetta: lettere, cifre, `-` e `_`, 64 al più. L'id arriva dal browser e
     * finisce nel percorso chiamato sul backoffice col gettone del workspace: con una barra o due punti sarebbe un altro
     * metodo. È il vincolo della rotta (routes/cornice.php): un id diverso non arriva qui, ed è un 404.
     */
    public const ID = '[A-Za-z0-9_-]{1,64}';

    /**
     * Com'è fatto l'istante che la rotta accetta in `fino_a`: data, `T`, ora coi secondi (e sei decimali al più: di più il
     * backoffice non ne ammette) e fuso, `Z` o `±hh:mm`, com'è la `creata_il` di una notifica di /v1, che ne ha tre. Senza il
     * fuso l'istante lo deciderebbe chi lo legge. `\z` e non `$`, che lascia passare un a capo in fondo. Se quel giorno esiste
     * (il 31 febbraio no) lo dice il backoffice.
     */
    private const ISTANTE = '/\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})\z/';

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
     * POST /cornice/notifiche/letture: segna lette, con una richiesta sola, le notifiche della persona nel workspace nate
     * fino a `fino_a` compreso, anche quelle oltre la prima pagina (io.notifiche.letture.crea). `fino_a` della risposta è
     * l'istante del backoffice, in UTC, non quello chiesto. `workspace` è lo slug del workspace della pagina che chiede, quello
     * per cui ha calcolato l'istante: al backoffice non va.
     */
    public function letture(Request $richiesta): JsonResponse
    {
        // Solo dal corpo JSON, e solo un istante col suo fuso: il backoffice non legge la query.
        $finoA = $richiesta->json('fino_a');
        $workspace = $richiesta->json('workspace');

        if (! is_string($finoA) || preg_match(self::ISTANTE, $finoA) !== 1 || ! is_string($workspace) || $workspace === '') {
            return new JsonResponse(['errore' => 'dati_non_validi'], 422);
        }

        // La sessione ha un workspace solo: se da un'altra scheda la persona è entrata in un altro, la pagina che chiede mostra
        // ancora quello di prima, e l'istante è delle sue notifiche. Qui segnerebbe lette quelle dell'altro, mai viste.
        if ($workspace !== (Sessione::workspace()['slug'] ?? null)) {
            return new JsonResponse(['errore' => 'workspace_diverso'], 409);
        }

        try {
            $segnate = Api::workspace()->post('/v1/io/notifiche/letture', ['fino_a' => $finoA])['data'] ?? null;
        } catch (ErroreApi $errore) {
            // La forma è giusta ma l'istante non esiste: lo dice il backoffice, ed è un errore di chi chiede.
            if ($errore->stato === 422 && $errore->codice === 'dati_non_validi') {
                return new JsonResponse(['errore' => 'dati_non_validi'], 422);
            }

            throw $errore;
        }

        if (! is_array($segnate) || ! is_string($segnate['fino_a'] ?? null)) {
            throw new BackofficeNonRisponde('La risposta di POST /v1/io/notifiche/letture non è un istante di /v1.');
        }

        return new JsonResponse(['data' => ['fino_a' => $segnate['fino_a']]]);
    }

    /**
     * Ciò che la cornice usa di una notifica di /v1: l'id, quando è nata, se è letta e il codice dell'app. `letta_il` e `app` ci
     * sono sempre: `letta_il` è null finché la persona non la segna, `app` è null se l'evento non è di un'app. Una risposta senza
     * uno dei quattro non è una notifica, ed è un guasto: mai una notifica non letta, mai una notifica senza app.
     *
     * @return array{id: string, creata_il: string, letta: bool, app: string|null}
     */
    private static function perLaCornice(mixed $notifica, string $metodo): array
    {
        if (! is_array($notifica) || ! is_string($notifica['id'] ?? null) || ! is_string($notifica['creata_il'] ?? null)
            || ! array_key_exists('letta_il', $notifica) || ! ($notifica['letta_il'] === null || is_string($notifica['letta_il']))
            || ! array_key_exists('app', $notifica) || ! ($notifica['app'] === null || is_string($notifica['app']))) {
            throw new BackofficeNonRisponde("La risposta di {$metodo} non è una notifica di /v1.");
        }

        return ['id' => $notifica['id'], 'creata_il' => $notifica['creata_il'], 'letta' => $notifica['letta_il'] !== null, 'app' => $notifica['app']];
    }
}
