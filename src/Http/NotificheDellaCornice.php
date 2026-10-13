<?php

namespace Zeiras\Core\Http;

use Illuminate\Contracts\Http\Kernel as ContrattoDelKernel;
use Illuminate\Foundation\Http\Kernel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use LogicException;
use Zeiras\Auth\Api;
use Zeiras\Auth\Errori\BackofficeNonRisponde;
use Zeiras\Auth\Errori\ErroreApi;
use Zeiras\Auth\Sessione;
use Zeiras\Core\Accettazione;
use Zeiras\Core\Registro;
use Zeiras\Core\Segno;

/**
 * Le notifiche del pannello della cornice, per il browser: la parte server le chiede al backoffice col gettone del workspace
 * in cui la persona è entrata, mai con quello dell'accesso (che non ha un workspace), e alla cornice dà solo ciò che usa:
 * l'id, l'istante dell'ultima azione che racconta, se è letta, `app`, il codice dell'app da cui viene, e `tipo`, il tipo
 * dell'evento che l'ha generata;
 * e, quando il backoffice li manda, il nome di chi ha fatto (`autore_nome`), quello della cosa (`risorsa_nome`) e se la
 * notifica è rivolta alla persona (`per_me`).
 * Di che prodotto è lo dice il registro di zr-core, nel browser: un codice che il registro non ha passa da qui com'è, e la
 * cornice non mostra un prodotto. Anche il tipo passa com'è, pure uno che /v1 oggi non ha: qui non si traduce e non si
 * confronta con un elenco. `soggetto` resta qui, e di `dati` passano i soli id che alla cornice servono per aprire la risorsa
 * della notifica (`ids`): quelli del percorso che si apre — il primo che il registro dei moduli dà al suo tipo e che `dati`
 * soddisfa per intero —, e nessuno per un tipo che il registro non ha, o quando il percorso non chiede un id. Segnarle lette tutte insieme è una richiesta sola del browser, fino a un istante, non una per notifica: il backoffice ne
 * segna 5000 per chiamata, e la parte server lo richiama finché ne restano, entro due tetti. Senza un workspace nella sessione
 * risponde ConWorkspace; un backoffice che non risponde è BackofficeNonRisponde, cioè un errore, mai un elenco vuoto. Se la
 * persona non ha ancora accettato i documenti legali in vigore il backoffice risponde 403 `accettazione_richiesta`, e le tre
 * rotte lo stesso, col solo codice (Accettazione).
 *
 * L'elenco, «segna tutte» e la lettura di una notifica dicono anche quando, col segno della parte server (`Segno::adesso()`,
 * lo stesso orologio e la stessa forma dei dati della cornice): l'elenco quando la lettura è cominciata, `aggiornati_il`;
 * «segna tutte» quando il backoffice ha risposto per l'ultima volta, `segnate_il`; la lettura di una notifica dopo la
 * risposta del backoffice, `segnata_il`. La cornice li confronta fra loro e col segno dei dati per non tornare a ciò che è
 * più vecchio. L'elenco dice anche di quale workspace è, `workspace`: lo slug di quello della sessione. Le risposte d'errore
 * non portano un istante.
 *
 * `idsDellaNotifica()` è pubblico per i frontend: chi le notifiche le legge da sé dal backoffice, per una pagina sua, ha da
 * lì gli stessi `ids` dell'elenco, da dare al browser al posto di `dati`.
 */
final class NotificheDellaCornice
{
    /**
     * Com'è fatto l'id di una notifica che la rotta accetta: lettere, cifre, `-` e `_`, 64 al più. L'id arriva dal browser e
     * finisce nel percorso chiamato sul backoffice col gettone del workspace: con una barra o due punti sarebbe un altro
     * metodo. È il vincolo della rotta (routes/cornice.php): un id diverso non arriva qui, ed è un 404.
     */
    public const ID = '[A-Za-z0-9_-]{1,64}';

    /** La stessa forma, per un id dei `dati` di una notifica: intera, e `\z` e non `$`, che lascia passare un a capo in fondo. */
    private const FORMA_DI_UN_ID = '/\A'.self::ID.'\z/';

    /**
     * Un segnaposto in un percorso del registro dei moduli: `{id}`, o `{<nome>_id}`. È quello che il browser cerca per comporre
     * l'indirizzo di una notifica (resources/js/notifiche.ts): un caso di RegistroTest tiene uguali i due.
     */
    private const SEGNAPOSTO = '/\{(id|[a-z][a-z_]*_id)\}/';

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
     * Passati quanti secondi dall'arrivo della richiesta non parte un'altra chiamata al backoffice. Una chiamata già partita
     * finisce: zr-auth aspetta ogni risposta del backoffice 5 secondi, se il frontend non ha cambiato quel tempo. Chi arriva
     * alla rotta entro questi secondi ha la risposta, al più, a questi secondi più quel tempo dall'arrivo; chi ci arriva dopo
     * ha subito il 503 `fuori_tempo`, a qualunque distanza dall'arrivo.
     */
    private const SECONDI = 10;

    /**
     * Quanti secondi il lock della sessione dura, almeno, oltre il momento in cui la rotta delle letture ha risposto: ciò che
     * resta alla richiesta per chiudersi — i middleware del frontend al ritorno, il salvataggio della sessione. Vale per chi
     * arriva alla rotta entro SECONDI più il tempo di zr-auth dall'arrivo. Chi ci arriva più tardi ha ciò che resta della
     * tenuta, e oltre la tenuta il lock è già scaduto: il 503 `fuori_tempo` non evita che, finendo, riscriva la sessione.
     */
    private const MARGINE = 5;

    /**
     * Per quanti secondi POST /cornice/notifiche/letture tiene il lock della sessione (`Route::block`): più di quanto può
     * durare, cioè SECONDI di richiami, più il tempo che zr-auth aspetta l'ultima risposta (`zr-auth.timeout`), più un margine.
     * Non i 10 secondi di `->bloccaSessione()` di zr-auth: col lock scaduto a metà corsa un'uscita da un'altra scheda lo
     * prenderebbe, e la richiesta, finendo, rimetterebbe la sessione di prima. Il lock si prende prima dei middleware del
     * frontend, e la tenuta corre da lì: per questo i SECONDI si contano dall'arrivo della richiesta (arrivoDellaRichiesta). Un
     * tempo sotto lo zero non la accorcia: un lock con una tenuta negativa, su Redis, non scade. Si calcola quando le rotte si
     * registrano, e la cache delle rotte lo tiene: dopo aver cambiato `zr-auth.timeout` si rifà.
     */
    public static function tenutaDelBlocco(): int
    {
        return self::SECONDI + max(0, (int) config('zr-auth.timeout')) + self::MARGINE;
    }

    /**
     * Quando Laravel ha cominciato a rispondere a questa richiesta, in UTC: lo tiene il kernel, ed è prima del lock della
     * sessione, che si prende nel gruppo `web`, e dei middleware del frontend che girano col lock preso. Senza un kernel che
     * lo dica è adesso.
     */
    private static function arrivoDellaRichiesta(): Carbon
    {
        $kernel = app()->bound(ContrattoDelKernel::class) ? app(ContrattoDelKernel::class) : null;
        $arrivo = $kernel instanceof Kernel ? $kernel->requestStartedAt() : null;
        $adesso = Carbon::now('UTC');

        // Una copia: quello del kernel serve ancora al kernel.
        return $arrivo !== null && $arrivo->lessThanOrEqualTo($adesso) ? $arrivo->copy()->utc() : $adesso;
    }

    /**
     * GET /cornice/notifiche: le notifiche del workspace dalla più recente, la prima pagina di io.notifiche.elenca.
     * `aggiornati_il` è l'istante in cui la lettura comincia, preso prima di chiamare il backoffice: l'elenco è almeno fresco
     * quanto il suo segno. Di `dati` di ogni notifica passano, in `ids`, i soli id che alla cornice servono per aprire la sua
     * risorsa (`idsDellaNotifica()`): una notifica di un tipo che nel registro non ha una destinazione non ne ha, e se `dati` manca, o non è
     * un oggetto, `ids` è vuoto e non è un guasto. Delle rotte delle notifiche, il registro dei moduli lo usa solo questa. `workspace` è lo slug del workspace della sessione, quello col cui gettone l'elenco è letto: la
     * sessione ha un workspace solo, e una pagina rimasta su un altro (un'altra scheda) sa così di chi sono le notifiche che
     * riceve, e dove si apre la loro risorsa. Viene dalla sessione, mai dalla richiesta.
     */
    public function elenco(): JsonResponse
    {
        $aggiornatiIl = Segno::adesso();
        $workspace = Sessione::workspace()['slug'] ?? null;

        try {
            $notifiche = Api::workspace()->get('/v1/io/notifiche')['data'] ?? null;
        } catch (ErroreApi $errore) {
            return Accettazione::rispostaA($errore);
        }

        if (! is_array($notifiche) || ! array_is_list($notifiche)) {
            throw new BackofficeNonRisponde('La risposta di GET /v1/io/notifiche non è una lista di /v1.');
        }

        return new JsonResponse([
            'data' => array_map(function (mixed $notifica): array {
                $perLaCornice = self::perLaCornice($notifica, 'GET /v1/io/notifiche');

                // Un oggetto anche quando è vuoto: nel browser `ids` ha una forma sola.
                return [...$perLaCornice, 'ids' => (object) self::idsDellaNotifica($perLaCornice['app'], $perLaCornice['tipo'], $notifica['dati'] ?? null)];
            }, $notifiche),
            'aggiornati_il' => $aggiornatiIl,
            'workspace' => $workspace,
        ]);
    }

    /**
     * Gli id che servono ad aprire la risorsa di una notifica, presi dai suoi `dati`, per chiave: quelli che il percorso del
     * registro chiede per il suo tipo (`chiaviDelPercorso()`), ognuno solo se il valore ha la forma di un id del backoffice — un
     * testo di lettere, cifre, `-` e `_`, da 1 a 64, la stessa che la rotta della lettura chiede all'id di una notifica. Solo le
     * coppie di `dati`, non quelle di un oggetto più dentro. Tutto il resto resta qui: gli altri id (quello di una nota, di una
     * lista, di una persona entrata nel workspace), `aggiornata_il`, `campi`, e ciò che il backoffice ci metterà domani — una
     * chiave nuova non arriva in pagina solo perché finisce in `_id`. Il browser mette questi id nell'indirizzo che la notifica apre.
     *
     * Un tipo può avere più percorsi, dal più specifico (`percorso`, poi `altrimenti`: una nota apre l'opportunità, altrimenti
     * il contatto, altrimenti l'azienda): gli id sono quelli del primo che `dati` soddisfa per intero, e solo quelli — mai gli
     * id di due percorsi insieme. Un percorso senza segnaposto (`/da-fare`, per un'attività) è intero senza id: dà `[]`. Se
     * nessun percorso è intero restano gli id in forma del primo, com'era con un percorso solo, e il browser non apre niente.
     *
     * È pubblico, ed è un'API del pacchetto (dalla v1.12.0): l'elenco lo chiama per ogni notifica, e un frontend che le
     * notifiche le legge da sé dal backoffice, per una pagina sua, lo chiama con `app`, `tipo` e `dati` di una notifica, com'è
     * nella risposta di /v1, e dà al browser gli stessi `ids`. Una regola sola, non due copie. Nome e firma sono un contratto
     * con chi installa il pacchetto: cambiarli è una versione maggiore. `$dati` è ciò che il backoffice dà, com'è — un array con
     * le sue chiavi, ma anche `null` o un testo —, e ciò che non è un array non ha id. Senza una destinazione nel registro dà
     * `[]`, e per nessun `app`, `tipo` o `dati` lancia un'eccezione.
     *
     * @return array<string, string>
     */
    public static function idsDellaNotifica(?string $app, string $tipo, mixed $dati): array
    {
        $delPrimo = null;
        foreach (self::chiaviDelPercorso($app, $tipo) as $chiavi) {
            $ids = [];
            foreach ($chiavi as $chiave) {
                $valore = is_array($dati) ? ($dati[$chiave] ?? null) : null;
                if (is_string($valore) && preg_match(self::FORMA_DI_UN_ID, $valore) === 1) {
                    $ids[$chiave] = $valore;
                }
            }
            if (count($ids) === count($chiavi)) {
                return $ids;
            }
            $delPrimo ??= $ids;
        }

        return $delPrimo ?? [];
    }

    /**
     * PATCH /cornice/notifiche/{notifica}/lettura: segna letta o non letta una notifica della persona nel workspace
     * (io.notifiche.lettura.modifica). `letta` della risposta è ciò che il backoffice ha segnato, non ciò che si è chiesto.
     * `segnata_il` è l'istante preso dopo la risposta del backoffice: da lì la notifica è com'è stata segnata. Un elenco letto
     * fin lì può darla ancora com'era, e la cornice la mostra com'è stata segnata. Per il numero delle non lette non basta:
     * dei dati letti fra la richiesta e quell'istante possono contarla già com'è stata segnata, o ancora com'era — il loro
     * segno è preso prima della lettura dal backoffice (Cornice) —, e la cornice toglie dal numero solo per i dati che aveva
     * quando ha chiesto.
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

            return Accettazione::rispostaA($errore);
        }

        if ($segnata['id'] !== $notifica) {
            throw new BackofficeNonRisponde("La risposta di PATCH {$percorso} è un'altra notifica.");
        }

        return new JsonResponse(['data' => ['id' => $segnata['id'], 'letta' => $segnata['letta']], 'segnata_il' => Segno::adesso()]);
    }

    /**
     * POST /cornice/notifiche/letture: segna lette le notifiche della persona nel workspace nate fino a `fino_a` compreso,
     * anche quelle oltre la prima pagina (io.notifiche.letture.crea). Il backoffice ne segna al più 5000 per chiamata e dice
     * se ne restano (`altre`): lo si richiama con lo stesso `fino_a` finché ne restano, al più CHIAMATE volte e senza chiamate
     * nuove passati SECONDI dall'arrivo della richiesta. `altre` della risposta è `false` quando il backoffice ha detto che non ne restano,
     * `true` quando un tetto ha fermato i richiami: non è un errore, e la stessa richiesta ripetuta continua da lì. `fino_a`
     * della risposta è l'istante del backoffice, in UTC, non quello chiesto. `workspace` è lo slug del workspace della pagina
     * che chiede, quello per cui ha calcolato l'istante: al backoffice non va. `segnate_il` è l'istante preso dopo l'ultima
     * risposta del backoffice: a quel punto le notifiche sono segnate, e ciò che è stato letto prima può non saperlo. Una
     * chiamata che fallisce, la prima o un richiamo, è un errore della rotta: ciò che è già segnato resta segnato. La rotta
     * tiene il blocco della sessione (tenutaDelBlocco): se il lock è di un'altra richiesta oltre l'attesa di zr-auth, qui non
     * si arriva, e la risposta è il 503 di zr-auth. Se qui si arriva passati SECONDI dall'arrivo della richiesta — il lock è già
     * preso da allora — la rotta non chiama il backoffice e risponde 503 `fuori_tempo`: finirebbe a lock scaduto.
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

        // Per il client di zr-auth un tempo di 0 è «senza limite» — e lo diventa ogni valore che `(int)` porta a 0 —, e uno
        // sotto lo zero non è un tempo: il client lo rifiuta. Una chiamata senza un tetto può durare più di qualunque lock. È
        // la configurazione a essere sbagliata: un errore nel log del modulo, non una risposta da riprovare.
        if ((int) config('zr-auth.timeout') < 1) {
            throw new LogicException('zr-core: POST /cornice/notifiche/letture non chiama il backoffice con zr-auth.timeout minore di 1: per il client di zr-auth 0 vuol dire senza limite, e un numero negativo non è un tempo. Il blocco della sessione non coprirebbe la chiamata.');
        }

        // L'orologio è quello del segno. I secondi si contano da quando la richiesta è arrivata, non da qui: il lock della
        // sessione è preso da allora, e scade a tenuta finita anche se la richiesta ci ha messo del tempo ad arrivare alla
        // rotta. Passato questo istante non parte un'altra chiamata; se è già passato non parte nemmeno la prima.
        $nessunaDopo = self::arrivoDellaRichiesta()->addSeconds(self::SECONDI);

        if (Carbon::now('UTC')->greaterThan($nessunaDopo)) {
            return new JsonResponse(['errore' => 'fuori_tempo'], 503, ['Retry-After' => '1']);
        }

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

            return Accettazione::rispostaA($errore);
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
     * Ciò che la cornice usa di una notifica di /v1: l'id, l'istante dell'ultima azione che racconta (quando è nata, se è una
     * sola), se è letta, il codice dell'app e il tipo dell'evento.
     * `letta_il` e `app` ci sono sempre: `letta_il` è null finché la persona non la segna, `app` è null se l'evento non è di
     * un'app. Il `tipo` è una stringa, e passa com'è. Una risposta senza uno dei cinque non è una notifica, ed è un guasto: mai
     * una notifica non letta, mai una notifica senza app o senza tipo.
     *
     * Una notifica del backoffice può dire anche chi ha fatto, su che cosa e per chi: `autore` (null, o un oggetto col
     * `nome`), `risorsa_nome` (null o un testo) e `per_me` (null o un booleano). Qui sono facoltative: un backoffice che non le
     * manda è quello di prima, e valgono null. Se ci sono, con un'altra forma è lo stesso guasto: mai un valore tolto in silenzio.
     * Di `autore` passa solo il nome, come `autore_nome`: una chiave in più, messa domani dal backoffice, non arriva in pagina.
     * `per_me` null vuol dire «non si sa», e non è `false`: la cornice quella notifica la tiene anche in «Per me».
     *
     * Una notifica può raccontare più azioni: `creata_il` è l'istante della prima, `ultima_azione_il` quello dell'ultima, e
     * l'elenco del backoffice è ordinato sull'ultima. Alla pagina, in `creata_il`, va l'istante dell'ultima azione: è l'ora che il
     * pannello mostra, e l'istante fino a cui arriva «Segna tutte come lette» — il backoffice segna per `creata_il` fino a lì,
     * cioè tutte le caricate (ognuna è nata prima della sua ultima azione) e nessuna nata dopo. Anche `ultima_azione_il` è
     * facoltativa: un backoffice che non la manda è quello di prima, e l'istante è la `creata_il`; con un valore che non è un
     * testo è lo stesso guasto.
     *
     * Con lei il backoffice manda `azioni`, quante azioni la notifica racconta (un intero da 1 in su), e `board`, la board in cui
     * sta la cosa (null, o un oggetto col `nome`). Sono facoltative come le altre: un backoffice che non le manda è quello di
     * prima, e valgono 1 e null. Se ci sono, con un'altra forma è lo stesso guasto: mai un testo al posto del conto. Di `board`
     * passa solo il nome, come `board_nome`: né l'id, né una chiave messa domani dal backoffice arrivano in pagina.
     *
     * `dati` non è fra le chiavi che fanno una notifica, e qui non si legge: gli id che servono ad aprire la risorsa li aggiunge
     * l'elenco (`ids`), che delle rotte delle notifiche è la sola a usare il registro dei moduli. La lettura di una notifica risponde senza.
     *
     * @return array{id: string, creata_il: string, letta: bool, app: string|null, tipo: string, autore_nome: string|null, risorsa_nome: string|null, per_me: bool|null, azioni: int, board_nome: string|null}
     */
    private static function perLaCornice(mixed $notifica, string $metodo): array
    {
        if (! is_array($notifica) || ! is_string($notifica['id'] ?? null) || ! is_string($notifica['creata_il'] ?? null)
            || ! array_key_exists('letta_il', $notifica) || ! ($notifica['letta_il'] === null || is_string($notifica['letta_il']))
            || ! array_key_exists('app', $notifica) || ! ($notifica['app'] === null || is_string($notifica['app']))
            || ! is_string($notifica['tipo'] ?? null)
            || ! (($notifica['autore'] ?? null) === null || (is_array($notifica['autore']) && is_string($notifica['autore']['nome'] ?? null)))
            || ! (($notifica['risorsa_nome'] ?? null) === null || is_string($notifica['risorsa_nome']))
            || ! (($notifica['per_me'] ?? null) === null || is_bool($notifica['per_me']))
            || ! (($notifica['ultima_azione_il'] ?? null) === null || is_string($notifica['ultima_azione_il']))
            || ! (! array_key_exists('azioni', $notifica) || (is_int($notifica['azioni']) && $notifica['azioni'] >= 1))
            || ! (($notifica['board'] ?? null) === null || (is_array($notifica['board']) && is_string($notifica['board']['nome'] ?? null)))) {
            throw new BackofficeNonRisponde("La risposta di {$metodo} non è una notifica di /v1.");
        }

        return [
            'id' => $notifica['id'], 'creata_il' => $notifica['ultima_azione_il'] ?? $notifica['creata_il'], 'letta' => $notifica['letta_il'] !== null,
            'app' => $notifica['app'], 'tipo' => $notifica['tipo'],
            'autore_nome' => $notifica['autore']['nome'] ?? null, 'risorsa_nome' => $notifica['risorsa_nome'] ?? null,
            'per_me' => $notifica['per_me'] ?? null,
            'azioni' => $notifica['azioni'] ?? 1, 'board_nome' => $notifica['board']['nome'] ?? null,
        ];
    }

    /**
     * Le chiavi degli id che ogni percorso di una notifica chiede, dal registro dei moduli del pacchetto
     * (resources/registro/prodotti.json): lo stesso file da cui il browser compone l'indirizzo, così ciò che esce da qui è ciò
     * che il browser usa. Un elenco di chiavi per percorso, nell'ordine in cui si provano: `percorso`, poi quelli di
     * `altrimenti`; un percorso senza segnaposto ha un elenco vuoto. La voce è quella dell'app della notifica, e il tipo si
     * cerca intero. Nessun percorso per un tipo che lì non ha una destinazione, per un'app che il registro non ha, o senza
     * app; e nessuno per una voce «Presto», che il browser non apre: i suoi id non servono ad aprire niente. Le voci le dà
     * `Registro`, che il file lo legge una volta per processo: qui non c'è una lettura, né una copia.
     *
     * @return list<list<string>>
     */
    private static function chiaviDelPercorso(?string $app, string $tipo): array
    {
        foreach (Registro::voci() as $voce) {
            foreach ($voce['id'] === $app && ($voce['presto'] ?? false) !== true ? $voce['notifiche'] ?? [] : [] as $notifica) {
                if ($notifica['tipo'] === $tipo) {
                    return array_map(function (string $percorso): array {
                        preg_match_all(self::SEGNAPOSTO, $percorso, $segnaposto);

                        return array_values(array_unique($segnaposto[1]));
                    }, [$notifica['percorso'], ...($notifica['altrimenti'] ?? [])]);
                }
            }
        }

        return [];
    }
}
