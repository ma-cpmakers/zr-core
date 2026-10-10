<?php

namespace Zeiras\Core\Http;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Zeiras\Auth\Api;
use Zeiras\Auth\Errori\BackofficeNonRisponde;
use Zeiras\Auth\Errori\ErroreApi;
use Zeiras\Auth\Sessione;
use Zeiras\Core\Segno;

/**
 * Le notifiche del pannello della cornice, per il browser: la parte server le chiede al backoffice col gettone del workspace
 * in cui la persona è entrata, mai con quello dell'accesso (che non ha un workspace), e alla cornice dà solo ciò che usa:
 * l'id, quando è nata, se è letta, `app`, il codice dell'app da cui viene, e `tipo`, il tipo dell'evento che l'ha generata.
 * Di che prodotto è lo dice il registro di zr-core, nel browser: un codice che il registro non ha passa da qui com'è, e la
 * cornice non mostra un prodotto. Anche il tipo passa com'è, pure uno che /v1 oggi non ha: qui non si traduce e non si
 * confronta con un elenco. `soggetto` e `dati` restano qui. Segnarle lette tutte insieme è una richiesta sola del browser,
 * fino a un istante, non una per notifica: il backoffice ne segna 5000 per chiamata, e la parte server lo richiama finché ne
 * restano, entro due tetti. Senza un workspace nella sessione risponde ConWorkspace; un backoffice che non risponde è
 * BackofficeNonRisponde, cioè un errore, mai un elenco vuoto.
 *
 * L'elenco e «segna tutte» dicono anche quando, col segno della parte server (`Segno::adesso()`, lo stesso orologio e la stessa
 * forma dei dati della cornice): l'elenco quando la lettura è cominciata, `aggiornati_il`; la lettura quando il backoffice ha
 * risposto per l'ultima volta, `segnate_il`. La cornice li confronta col segno dei dati per non tornare a ciò che è più
 * vecchio. Le risposte d'errore non portano un istante.
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

    /**
     * Quante volte, al più, la parte server chiama il backoffice per una «segna tutte» del browser: il backoffice ne segna al
     * più 5000 per chiamata, quindi 25.000 per richiesta. Oltre, la rotta dice che ne restano, e il browser richiede.
     */
    private const CHIAMATE = 5;

    /**
     * Passati quanti secondi dalla prima chiamata non ne parte un'altra. Una chiamata già partita finisce: zr-auth aspetta
     * ogni risposta del backoffice 5 secondi, se il frontend non ha cambiato quel tempo, e la richiesta del browser dura al
     * più questi secondi più quelli.
     */
    private const SECONDI = 10;

    /**
     * GET /cornice/notifiche: le notifiche del workspace dalla più recente, la prima pagina di io.notifiche.elenca.
     * `aggiornati_il` è l'istante in cui la lettura comincia, preso prima di chiamare il backoffice: l'elenco è almeno fresco
     * quanto il suo segno.
     */
    public function elenco(): JsonResponse
    {
        $aggiornatiIl = Segno::adesso();
        $notifiche = Api::workspace()->get('/v1/io/notifiche')['data'] ?? null;

        if (! is_array($notifiche) || ! array_is_list($notifiche)) {
            throw new BackofficeNonRisponde('La risposta di GET /v1/io/notifiche non è una lista di /v1.');
        }

        return new JsonResponse([
            'data' => array_map(fn (mixed $notifica) => self::perLaCornice($notifica, 'GET /v1/io/notifiche'), $notifiche),
            'aggiornati_il' => $aggiornatiIl,
        ]);
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
     * POST /cornice/notifiche/letture: segna lette le notifiche della persona nel workspace nate fino a `fino_a` compreso,
     * anche quelle oltre la prima pagina (io.notifiche.letture.crea). Il backoffice ne segna al più 5000 per chiamata e dice
     * se ne restano (`altre`): lo si richiama con lo stesso `fino_a` finché ne restano, al più CHIAMATE volte e senza chiamate
     * nuove passati SECONDI dalla prima. `altre` della risposta è `false` quando il backoffice ha detto che non ne restano,
     * `true` quando un tetto ha fermato i richiami: non è un errore, e la stessa richiesta ripetuta continua da lì. `fino_a`
     * della risposta è l'istante del backoffice, in UTC, non quello chiesto. `workspace` è lo slug del workspace della pagina
     * che chiede, quello per cui ha calcolato l'istante: al backoffice non va. `segnate_il` è l'istante preso dopo l'ultima
     * risposta del backoffice: a quel punto le notifiche sono segnate, e ciò che è stato letto prima può non saperlo. Una
     * chiamata che fallisce, la prima o un richiamo, è un errore della rotta: ciò che è già segnato resta segnato.
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

        // L'orologio è quello del segno: passato questo istante non parte un'altra chiamata.
        $nessunaDopo = Carbon::now('UTC')->addSeconds(self::SECONDI);
        $chiamate = 0;

        try {
            // Il ciclo finisce su ogni strada: il backoffice dice che non ne restano, il tetto delle chiamate, quello del
            // tempo, o un'eccezione. Le guardie di sopra valgono per tutte le chiamate: fra l'una e l'altra non si rifanno.
            do {
                $segnate = self::segnaFinoA($finoA);
                $chiamate++;
            } while ($segnate['altre'] && $chiamate < self::CHIAMATE && Carbon::now('UTC')->lessThanOrEqualTo($nessunaDopo));
        } catch (ErroreApi $errore) {
            // La forma è giusta ma l'istante non esiste: lo dice il backoffice, ed è un errore di chi chiede.
            if ($errore->stato === 422 && $errore->codice === 'dati_non_validi') {
                return new JsonResponse(['errore' => 'dati_non_validi'], 422);
            }

            throw $errore;
        }

        return new JsonResponse(['data' => ['fino_a' => $segnate['fino_a'], 'altre' => $segnate['altre']], 'segnate_il' => Segno::adesso()]);
    }

    /**
     * Una chiamata a io.notifiche.letture.crea col gettone del workspace: l'istante del backoffice e se ne restano. `altre` è
     * un booleano o la risposta non è di /v1: senza, o con un altro valore, è un guasto, mai «non ne restano».
     *
     * @return array{fino_a: string, altre: bool}
     */
    private static function segnaFinoA(string $finoA): array
    {
        $segnate = Api::workspace()->post('/v1/io/notifiche/letture', ['fino_a' => $finoA])['data'] ?? null;

        if (! is_array($segnate) || ! is_string($segnate['fino_a'] ?? null) || ! is_bool($segnate['altre'] ?? null)) {
            throw new BackofficeNonRisponde('La risposta di POST /v1/io/notifiche/letture non è una lettura di /v1.');
        }

        return ['fino_a' => $segnate['fino_a'], 'altre' => $segnate['altre']];
    }

    /**
     * Ciò che la cornice usa di una notifica di /v1: l'id, quando è nata, se è letta, il codice dell'app e il tipo dell'evento.
     * `letta_il` e `app` ci sono sempre: `letta_il` è null finché la persona non la segna, `app` è null se l'evento non è di
     * un'app. Il `tipo` è una stringa, e passa com'è. Una risposta senza uno dei cinque non è una notifica, ed è un guasto: mai
     * una notifica non letta, mai una notifica senza app o senza tipo.
     *
     * @return array{id: string, creata_il: string, letta: bool, app: string|null, tipo: string}
     */
    private static function perLaCornice(mixed $notifica, string $metodo): array
    {
        if (! is_array($notifica) || ! is_string($notifica['id'] ?? null) || ! is_string($notifica['creata_il'] ?? null)
            || ! array_key_exists('letta_il', $notifica) || ! ($notifica['letta_il'] === null || is_string($notifica['letta_il']))
            || ! array_key_exists('app', $notifica) || ! ($notifica['app'] === null || is_string($notifica['app']))
            || ! is_string($notifica['tipo'] ?? null)) {
            throw new BackofficeNonRisponde("La risposta di {$metodo} non è una notifica di /v1.");
        }

        return [
            'id' => $notifica['id'], 'creata_il' => $notifica['creata_il'], 'letta' => $notifica['letta_il'] !== null,
            'app' => $notifica['app'], 'tipo' => $notifica['tipo'],
        ];
    }
}
