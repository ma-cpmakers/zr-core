<?php

namespace Zeiras\Core;

use Illuminate\Support\Facades\Log;
use Throwable;
use Zeiras\Auth\Api;
use Zeiras\Auth\Errori\BackofficeNonRisponde;
use Zeiras\Auth\Errori\ErroreApi;
use Zeiras\Auth\Sessione;

/**
 * I dati della cornice per la pagina del frontend: chi è la persona, la sua lingua, il workspace in cui è entrata, lo stato
 * delle app in quel workspace, le aziende della persona coi loro workspace e le notifiche non lette nel workspace. Si leggono
 * dalla sessione di zr-auth e dal backoffice: app.elenca (GET /v1/app) e io.mostra (GET /v1/io) col gettone del workspace,
 * io.aziende.elenca (GET /v1/io/aziende) e io.workspace.elenca (GET /v1/io/workspace) col gettone della persona; il gettone
 * resta nella sessione. Il frontend li condivide con la pagina (con Inertia, nel suo `share()`), e la `Cornice` di
 * resources/js li riceve in `dati`.
 *
 * La lingua e il nome della sessione sono quelli dell'ingresso: un cambio fatto dopo nel profilo non ci arriva da solo. Per
 * questo a ogni lettura la risposta di io.mostra, che la cornice legge già per le non lette, va a `Sessione::aggiorna` di
 * zr-auth (dalla 0.12), che mette nella sessione la lingua e il nome del profilo che prende (la lingua, dalla 0.12.12, solo se
 * è una di Zeiras; e dalla `v2.11.4` non quella di una lettura più vecchia di quella che l'ha confermata:
 * `conLaLinguaRicordata()`), e i dati li portano da quella stessa lettura.
 * Un modulo che mette la lingua della pagina prima del controller la prende da `lingua()`, che fa quella stessa lettura: in una
 * richiesta io.mostra si legge una volta per tutte e due (vedi `lettura()`); e dalla `v2.15.0` la lettura di `lingua()` riuscita
 * resta nella sessione per la richiesta rimandata della stessa pagina, dove `dopo()` la usa una volta (`perLaRimandata()`).
 *
 * Ogni lettura porta un segno, `aggiornati_il`: l'istante in cui è cominciata. La `Cornice` lo confronta con quello dei dati
 * che ha e con gli istanti delle due rotte delle notifiche, e non torna a dati letti prima: per questo la sua forma è una
 * sola, quella di `Segno::adesso()`, che `segno()` di resources/js/servizi.ts riconosce; in un'altra forma nel browser
 * varrebbe «senza segno», in silenzio. E i dati di due letture non sono mai uguali, nemmeno quando niente è cambiato:
 * Inertia, in una visita alla stessa pagina, ridà l'oggetto di prima per i dati uguali in profondità, e senza segno la
 * campanella resterebbe al numero di prima.
 */
final class Cornice
{
    /** Dove sta, fra gli attributi della richiesta, la lettura di io.mostra che `lingua()` e `dati()` hanno in comune. */
    private const LETTURA = 'zr-core.io-mostra';

    /**
     * Il segno della lingua, nella sessione: di chi è (l'id della persona) e l'inizio della lettura di io.mostra che ha
     * confermato la sua lingua. Sta nella sessione e non sulla richiesta: `subito()` lo dà in una richiesta che non legge.
     */
    private const LINGUA = 'zr-core.lingua';

    /**
     * La lettura di io.mostra riuscita che `lingua()` ha fatto per la pagina, nella sessione, per la richiesta rimandata della
     * stessa pagina (dalla `v2.15.0`): `dopo()` la prende una volta sola, e la toglie che la usi o no (`perLaRimandata()`).
     */
    private const RIMANDATA = 'zr-core.io-mostra-rimandata';

    /** Fino a quanti secondi dal suo segno la lettura tenuta per la richiesta rimandata vale. */
    private const SECONDI_DELLA_RIMANDATA = 10;

    /** La forma di una lingua: due o tre lettere, poi parti di lettere e cifre unite da `-` o `_` (`it`, `pt-BR`, `zh-Hans-CN`). */
    private const FORMA_DI_UNA_LINGUA = '/\A[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{1,8})*\z/';

    /**
     * null senza una sessione entrata in un workspace: la pagina non ha un workspace, e il backoffice non si chiama. Il
     * workspace è quello del gettone, mai quello dell'indirizzo. Un backoffice che non risponde lancia BackofficeNonRisponde
     * (zr-auth), e così un elenco che la cornice non sa leggere (dalla `v2.17.0`, `testi()`): mai una lista di app vuota, che farebbe «Presto» di ogni prodotto, né un elenco di aziende vuoto o zero non
     * lette.
     *
     * Con una sola eccezione, che non è un guasto: se a una delle letture il backoffice risponde 403 `accettazione_richiesta`
     * (la persona non ha ancora accettato i documenti legali in vigore: vedi Accettazione) i dati escono ridotti — lingua,
     * persona e workspace della sessione, nessuna app, nessuna azienda, zero non lette, il segno — e portano in più
     * `accettazione_richiesta: true`, in fondo. La chiave c'è solo lì, mai a `false`: i dati di chi ha accettato sono quelli
     * di sempre. Con quella chiave la lista di app vuota non dice «Presto» di ogni prodotto: dice che il backoffice non le
     * ha date. Dopo quel 403 il backoffice non si chiama più.
     *
     * `aggiornati_il` è l'istante in cui la lettura comincia, preso prima di chiamare il backoffice (i dati sono almeno
     * freschi quanto il segno), nella forma di `Segno::adesso()`: in UTC qualunque sia il fuso dell'applicazione, coi
     * microsecondi sempre a sei cifre e `Z` in fondo (`2026-10-09T21:31:05.123456Z`), così due segni si ordinano anche come
     * stringhe. Le non lette si contano per prime, subito dopo il segno: è il numero che la cornice confronta col segno, e
     * contato dopo le altre letture sarebbe più fresco del suo segno di tre chiamate. Se in questa richiesta `lingua()` ha già
     * letto io.mostra, le non lette e il segno sono quelli di quella lettura, che non si rifà: il segno resta l'istante preso
     * prima di contarle. Una seconda `dati()` nella stessa richiesta rilegge tutto, col suo segno. Nella richiesta rimandata
     * la lettura di `lingua()` può essere quella della pagina (`dopo()`, dalla `v2.15.0`).
     *
     * La lingua e il nome sono quelli della sessione riletta dopo `Sessione::aggiorna`, mai quelli di io.mostra presi da qui:
     * che cosa vale lo decide zr-auth (i dati di un'altra persona e un valore vuoto non entrano), e i dati della cornice non
     * dicono altro dalla sessione. Email, workspace e ruolo restano quelli dell'ingresso.
     *
     * @return array{lingua: string, persona: array{nome: string, email: string}, workspace: array{nome: string, slug: string}, prodotti: array<string, string>, aziende: list<array{id: string, nome: string, workspace: list<array{id: string, nome: string, slug: string}>, nuovo_workspace: bool}>, non_lette: int, aggiornati_il: string, accettazione_richiesta?: true}|null
     */
    public static function dati(): ?array
    {
        self::tenuta();
        $utente = Sessione::utente();
        $workspace = Sessione::workspace();

        if ($utente === null || $workspace === null) {
            return null;
        }

        $lettura = self::lettura($utente, $workspace, true);
        $esito = $lettura['esito'];

        // La lettura fallita di `lingua()`, che non lancia, è ancora un errore per i dati: lo stesso, senza rileggere. Il 403
        // `accettazione_richiesta` no: i dati escono ridotti.
        if (! is_int($esito) && ! Accettazione::richiesta($esito)) {
            throw $esito;
        }

        // Se intanto la sessione è scaduta zr-auth non dà più la persona, e la lettura dopo lancia GettoneRifiutato prima che
        // la persona serva: il ripiego su quella letta all'inizio tiene `$utente` un array qualunque sia l'ordine delle letture
        // (`Sessione::utente()` può dare null). Oggi nessun test lo distingue, e l'analisi statica non lo chiede.
        $utente = Sessione::utente() ?? $utente;

        $letti = is_int($esito) ? self::appEAziende($esito) : null;

        return [
            'lingua' => $utente['lingua'],
            'persona' => ['nome' => $utente['nome'], 'email' => $utente['email']],
            'workspace' => ['nome' => $workspace['nome'], 'slug' => $workspace['slug']],
            ...($letti ?? ['prodotti' => [], 'aziende' => [], 'non_lette' => 0]),
            'aggiornati_il' => $lettura['segno'],
            ...($letti === null ? ['accettazione_richiesta' => true] : []),
        ];
    }

    /**
     * La parte dei dati che sta nella sessione — lingua, persona, workspace —, per il frontend che non vuole aspettare il
     * backoffice prima del primo disegno (dalla `v2.1.0`): il resto lo dà `dopo()`, che può arrivare più tardi. Non chiama mai
     * il backoffice, nemmeno per rileggere la lingua: lingua e nome sono quelli dell'ingresso finché una `dopo()`, una
     * `dati()` o una `lingua()` non hanno riletto io.mostra, e dalla richiesta dopo sono quelli nuovi (la lingua no, se quella
     * lettura era più vecchia di quella che l'ha confermata: `conLaLinguaRicordata()`). null senza sessione o
     * senza workspace, come `dati()`.
     *
     * In fondo c'è il segno della sessione, `sessione_il` (dalla `v2.3.0`): l'istante in cui lingua e persona sono state lette.
     * Nel browser dice se questi dati sono più vecchi di chi la cornice mostra: una pagina ripresa dalla cronologia con
     * Indietro porta il `subito` di allora, e non riporta a schermo la persona di allora.
     *
     * Dopo c'è il segno della lingua, `lingua_il` (dalla `v2.11.0`): l'istante in cui è cominciata la lettura di io.mostra che ha
     * confermato la lingua della sessione per questa persona, ricordato nella sessione, mai quello di adesso. Un `subito`
     * riletto mentre `dopo` è in lettura porta la sessione di adesso e la lingua di prima: col segno di adesso varrebbe nel
     * browser sopra la lingua nuova. Senza una lettura che l'abbia confermata, o se quella era di un'altra persona, non c'è.
     *
     * @return array{lingua: string, persona: array{nome: string, email: string}, workspace: array{nome: string, slug: string}, sessione_il: string, lingua_il?: string}|null
     */
    public static function subito(): ?array
    {
        $utente = Sessione::utente();
        $workspace = Sessione::workspace();

        self::tenuta();

        if ($utente === null || $workspace === null) {
            return null;
        }

        return [
            'lingua' => $utente['lingua'],
            'persona' => ['nome' => $utente['nome'], 'email' => $utente['email']],
            'workspace' => ['nome' => $workspace['nome'], 'slug' => $workspace['slug']],
            'sessione_il' => Segno::adesso(),
            ...self::linguaIl(),
        ];
    }

    /**
     * La parte dei dati che si legge dal backoffice: le stesse letture di `dati()`, e gli stessi dati, anche ridotti davanti
     * al 403 `accettazione_richiesta`. Dice di chi sono (dalla `v2.4.0`): porta lingua e persona come sono nella sessione
     * dopo quella lettura (la lingua e il nome riletti da io.mostra — la lingua no, se la lettura è più vecchia di quella che l'ha
     * confermata: vedi `conLaLinguaRicordata()` —, l'email dell'ingresso) e, in fondo, `sessione_il`, l'istante di quella lettura. Questi dati si leggono in una richiesta che
     * non è quella di `subito()`, e fra le due la sessione può essere passata a un'altra persona o a un altro workspace, da
     * un'altra scheda: nel browser lingua, persona, workspace e `sessione_il` di `dopo()` valgono su quelli di `subito()`
     * (dalla `v2.9.0` la lingua è quella del più recente dei due, con la stessa persona),
     * e i dati di una persona non stanno mai sotto il nome di un'altra. Se il backoffice non risponde — la
     * connessione, un 5xx, un 429; dalla `v2.17.0` anche un 404, un 409 o un 422, e una risposta che la cornice non sa leggere —
     * non lancia: dà `non_letti` col segno della lettura, lascia nel log una riga
     * d'avviso, e la cornice esce ridotta con un avviso suo invece di una pagina d'errore. Anche `non_letti` dice di chi è
     * (dalla `v2.7.0`): dopo `non_letti` e `aggiornati_il` porta lingua, persona e workspace come sono nella sessione dopo
     * il fallimento — letti come li legge `subito()`, senza un'altra chiamata al backoffice — e in fondo `sessione_il`. I due segni
     * sono quello della lettura di io.mostra di questa richiesta — l'istante in cui è cominciata, come nei dati riusciti,
     * anche se l'ha fatta `lingua()` — e non quello in cui è fallita: un `non_letti` arrivato tardi non vale sopra i dati
     * di chi è entrato intanto. Niente di ciò che dà il backoffice. Così la cornice ridotta non
     * resta col nome di chi c'era prima. Se intanto la sessione è finita — chiusa, o col gettone scaduto — dà null come senza
     * sessione, e non scrive la riga nel log. Il segno `aggiornati_il` serve al browser come
     * quello dei dati: un `non_letti` più vecchio dei dati che la cornice ha (Indietro su una visita di prima) non la riduce. Ogni altro errore di /v1 passa com'è (un 403 dice che la persona non ha più accesso, e
     * la cornice ridotta lo nasconderebbe), e GettoneRifiutato pure: la sessione è finita, e lo tratta il frontend come con `dati()`. null senza sessione o senza workspace.
     *
     * In fondo, dopo `sessione_il`, c'è il segno della lingua, `lingua_il` (dalla `v2.11.0`), come in `subito()`: quello
     * ricordato per la persona della sessione, che la lettura di questa richiesta porta avanti solo se io.mostra ha risposto
     * per lei e la lettura è più avanti (`ricordaLaLingua()`); una lettura più vecchia lo lascia com'è, e dalla `v2.11.4` lascia
     * com'è anche la lingua (`conLaLinguaRicordata()`): lingua e segno restano una coppia. Niente se non c'è.
     * Anche in `non_letti`.
     *
     * @return array{lingua: string, persona: array{nome: string, email: string}, workspace: array{nome: string, slug: string}, prodotti: array<string, string>, aziende: list<array{id: string, nome: string, workspace: list<array{id: string, nome: string, slug: string}>, nuovo_workspace: bool}>, non_lette: int, aggiornati_il: string, accettazione_richiesta?: true, sessione_il: string, lingua_il?: string}|array{non_letti: true, aggiornati_il: string, lingua: string, persona: array{nome: string, email: string}, workspace: array{nome: string, slug: string}, sessione_il: string, lingua_il?: string}|null
     */
    public static function dopo(): ?array
    {
        // Se la lettura fallisce il suo segno è quello di quando è cominciata, come nei dati riusciti: il backoffice può
        // metterci secondi a non rispondere, e col segno della fine un `non_letti` in ritardo varrebbe nel browser sopra i
        // dati di chi è entrato intanto. Questo è il ripiego: di norma il segno è quello che `lettura()` tiene (sotto).
        $prima = Segno::adesso();
        self::perLaRimandata();

        try {
            $dati = self::dati();
        } catch (BackofficeNonRisponde|ErroreApi $errore) {
            // Un 404, un 409 o un 422 non parlano di accesso: sono la cornice ridotta come un 5xx (dalla `v2.17.0`). Ogni altro 4xx
            // passa: un 403 dice che la persona non ha più accesso, e la cornice ridotta lo nasconderebbe; un 401
            // `cliente_non_riconosciuto` è il frontend configurato male; uno che zr-core non conosce (un 410) non si indovina.
            if ($errore instanceof ErroreApi && $errore->stato < 500 && ! in_array($errore->stato, [404, 409, 422, 429], true)) {
                throw $errore;
            }

            // Di chi è lo dice la sessione che questa richiesta ha in mano — con lingua e nome riletti, se io.mostra aveva
            // risposto —, mai un'altra chiamata a /v1. Se intanto è finita — chiusa, o col gettone scaduto — non è di
            // nessuno: null come senza sessione, e nel log niente, perché nessuna cornice esce ridotta.
            $chi = self::subito();
            if ($chi === null) {
                return null;
            }
            self::avvisa($errore, 'dati della cornice: il backoffice non ha risposto (%s): la cornice esce ridotta');

            // Il segno è quello della lettura di io.mostra di questa richiesta, che `dati()` ha fatto o ha trovato già fatta
            // da `lingua()` (il frontend che mette la lingua prima del controller): lo stesso che i dati riusciti avrebbero.
            $tenuta = request()->attributes->get(self::LETTURA);
            $segno = is_array($tenuta) ? $tenuta['segno'] : $prima;

            // Le due chiavi di sempre davanti, quelle della `v2.7.0` dopo, e `lingua_il` di `subito()` resta in fondo.
            return ['non_letti' => true, 'aggiornati_il' => $segno, ...$chi, 'sessione_il' => $segno];
        }

        if ($dati === null) {
            return null;
        }

        // La persona è stata letta con questi dati: il suo segno è il loro.
        return [...$dati, 'sessione_il' => $dati['aggiornati_il'], ...self::linguaIl()];
    }

    /**
     * Ciò che dei dati si legge dopo io.mostra — lo stato di ogni app nel workspace (app.elenca) e le aziende della persona —,
     * con le non lette già contate. null se a una di quelle letture il backoffice risponde col 403 `accettazione_richiesta`
     * (Accettazione): da lì non lo si chiama più, e ciò che era già letto non esce.
     *
     * @param  int<0, max>  $nonLette
     * @return array{prodotti: array<string, string>, aziende: list<array{id: string, nome: string, workspace: list<array{id: string, nome: string, slug: string}>, nuovo_workspace: bool}>, non_lette: int<0, max>}|null
     */
    private static function appEAziende(int $nonLette): ?array
    {
        try {
            $prodotti = [];
            foreach (Api::workspace()->tutti('/v1/app') as $app) {
                [$codice, $stato] = self::testi($app, ['codice', 'stato'], 'GET /v1/app');
                $prodotti[$codice] = $stato;
            }

            return ['prodotti' => $prodotti, 'aziende' => self::aziende(), 'non_lette' => $nonLette];
        } catch (ErroreApi $errore) {
            if (Accettazione::richiesta($errore)) {
                return null;
            }

            throw $errore;
        }
    }

    /**
     * La lingua della persona già aggiornata dal profilo, per il modulo che mette la lingua della pagina in un middleware,
     * prima del controller: legge io.mostra, lo dà a `Sessione::aggiorna` e risponde con la lingua della sessione, che cosa
     * vale lo decide zr-auth. Senza la riga la lingua letta dalla sessione prima di `dati()` è ancora quella dell'ingresso, e
     * dopo un cambio nel profilo la prima pagina esce con la cornice nella lingua nuova e il contenuto nella vecchia.
     *
     * null senza una sessione, o se la lingua della sessione non ha la forma di una lingua (FORMA_DI_UNA_LINGUA, 35 caratteri
     * al più): ciò che esce da qui va a `App::setLocale`, che su una barra, due punti di fila o un byte nullo lancia dopo aver
     * già scritto `app.locale`, e nella sessione una lingua malfatta può esserci: all'ingresso zr-auth ci mette la persona
     * com'è, e fino alla 0.12.11 `Sessione::aggiorna` prende da io.mostra ogni testo non vuoto (dalla 0.12.12 solo una
     * lingua di Zeiras). `dati()` porta invece la lingua della sessione com'è. Senza un workspace è la lingua della
     * sessione, e il backoffice non si chiama. Costa una lettura, io.mostra, e in una richiesta in cui c'è anche `dati()`
     * nessuna in più: è la stessa (vedi `lettura()`). Se il backoffice non risponde non lancia, perché la lingua di una
     * pagina non diventi un 500: dà la lingua che la sessione ha, lascia un avviso nel log, e l'errore lo lancia `dati()`,
     * se in quella richiesta c'è. Davanti al 403 `accettazione_richiesta` dà la lingua della sessione allo stesso modo, ma
     * senza avviso, e `dati()` non lancia: non è un guasto, e i dati escono ridotti. GettoneRifiutato passa: la sessione è
     * finita, e lo tratta il frontend come da ogni altra chiamata.
     */
    public static function lingua(): ?string
    {
        $utente = Sessione::utente();

        if ($utente === null) {
            return null;
        }

        $workspace = Sessione::workspace();

        if ($workspace === null) {
            session()->forget(self::RIMANDATA);
        } else {
            self::lettura($utente, $workspace, false);
            // Come in `dati()`: se intanto la sessione è scaduta resta la persona letta all'inizio.
            $utente = Sessione::utente() ?? $utente;
        }

        $lingua = $utente['lingua'] ?? null;

        return is_string($lingua) && strlen($lingua) <= 35 && preg_match(self::FORMA_DI_UNA_LINGUA, $lingua) === 1 ? $lingua : null;
    }

    /**
     * Il freno di questa richiesta: l'errore con cui il backoffice ha risposto 429 alla lettura di io.mostra che `lingua()` o
     * `dati()` hanno fatto, o null. È per il modulo che dopo la riga chiamerebbe ancora /v1: dopo un 429 non si richiama, e
     * risponde col suo 429, coi secondi di `Retry-After` che stanno in `riprovaFra` (null se il backoffice non li dice).
     * Guarda la lettura tenuta sulla richiesta e non ne fa partire una: senza una lettura dà null, e la richiesta dopo non
     * trova il freno di questa. Il freno è lo stato, 429, con qualunque codice e chiunque l'abbia dato; un altro errore
     * tenuto (il 403 `accettazione_richiesta`, un 404, il backoffice che non risponde) non lo è.
     */
    public static function frenata(): ?ErroreApi
    {
        $esito = request()->attributes->get(self::LETTURA)['esito'] ?? null;

        return $esito instanceof ErroreApi && $esito->stato === 429 ? $esito : null;
    }

    /**
     * La lettura di io.mostra di questa richiesta, una sola per `lingua()` e `dati()`: prende il segno, legge, dà la risposta a
     * `Sessione::aggiorna` e tiene fra gli attributi della richiesta di chi è (l'id della persona e il workspace della
     * sessione), il segno, l'esito (le non lette, o l'errore al loro posto) e se una `dati()` l'ha già usata. Della risposta
     * di io.mostra non tiene altro. Sta sulla richiesta e non in una proprietà statica, che passerebbe alla richiesta dopo
     * dove il processo resta vivo; e porta di chi è, perché le non lette di un workspace non escano nei dati di un altro se
     * la sessione cambia a metà richiesta. Senza l'id della persona non si sa di chi è: la lettura tenuta non si usa.
     *
     * `lingua()` usa la lettura che c'è, sempre. `dati()` la usa una volta sola: la seconda `dati()` rilegge, com'era prima
     * che la lettura si tenesse, e i suoi dati hanno un altro segno. Si tengono anche BackofficeNonRisponde ed ErroreApi,
     * perché una lettura fallita non riparta nella stessa richiesta; GettoneRifiutato non si prende, e non si tiene niente.
     * L'errore preso per `lingua()`, che non lo lancia, va nel log come avviso: in una richiesta senza `dati()` non ne
     * resterebbe traccia. Il 403 `accettazione_richiesta` no: non è un guasto, e non lascia un avviso.
     *
     * @param  array<string, mixed>  $utente  la persona della sessione
     * @param  array<string, mixed>  $workspace  il workspace della sessione
     * @return array{di: array{mixed, array<string, mixed>}, segno: string, esito: int<0, max>|BackofficeNonRisponde|ErroreApi, nei_dati: bool}
     */
    private static function lettura(array $utente, array $workspace, bool $perIDati): array
    {
        $di = [$utente['id'] ?? null, $workspace];
        $tenuta = request()->attributes->get(self::LETTURA);

        if (is_array($tenuta) && $di[0] !== null && $tenuta['di'] === $di && ! ($perIDati && $tenuta['nei_dati'])) {
            if ($perIDati) {
                $tenuta['nei_dati'] = true;
                request()->attributes->set(self::LETTURA, $tenuta);
            }

            return $tenuta;
        }

        // Il segno prima della lettura: viaggia con le non lette, chiunque le usi dopo.
        $segno = Segno::adesso();

        try {
            $io = self::ioMostra();
            Sessione::aggiorna(self::conLaLinguaRicordata($io, $segno));
            self::ricordaLaLingua($io, $segno);
            $esito = $io['notifiche_non_lette'];
        } catch (BackofficeNonRisponde|ErroreApi $errore) {
            $esito = $errore;
            // Il 403 `accettazione_richiesta` non è un guasto: non lascia un avviso.
            if (! $perIDati && ! Accettazione::richiesta($errore)) {
                self::avvisa($errore);
            }
        }

        $lettura = ['di' => $di, 'segno' => $segno, 'esito' => $esito, 'nei_dati' => $perIDati];
        request()->attributes->set(self::LETTURA, $lettura);

        // La lettura della pagina, se è riuscita, resta per la sua richiesta rimandata; una fallita non resta, e toglie quella di prima.
        if (! $perIDati) {
            is_int($esito) ? session()->put(self::RIMANDATA, ['di' => $di, 'segno' => $segno, 'esito' => $esito, 'il' => Segno::orologio()]) : session()->forget(self::RIMANDATA);
        }

        return $lettura;
    }

    /**
     * La lettura tenuta per la richiesta rimandata, se è della persona e del workspace della sessione; se non lo è più (un
     * cambio di workspace, un'altra persona entrata, nessuna sessione) o non ha la sua forma, la toglie dalla sessione e dà null.
     *
     * @return array{di: array{0: string, 1: array<string, mixed>}, segno: string, esito: int, il: string}|null
     */
    private static function tenuta(): ?array
    {
        $tenuta = session(self::RIMANDATA);
        $id = Sessione::utente()['id'] ?? null;

        if (is_string($id) && is_array($tenuta) && ($tenuta['di'] ?? null) === [$id, Sessione::workspace()] && is_string($tenuta['segno'] ?? null) && is_int($tenuta['esito'] ?? null) && is_string($tenuta['il'] ?? null)) {
            return $tenuta;
        }

        session()->forget(self::RIMANDATA);

        return null;
    }

    /**
     * Nella richiesta rimandata, la lettura che `lingua()` ha fatto per la pagina diventa quella di questa richiesta, e i dati
     * non rileggono io.mostra: se è della persona e del workspace della sessione, se il suo segno è ancora quello che la
     * sessione ricorda per la lingua di quella persona (una lettura dopo, in un'altra richiesta, lo porta avanti) e se ha al più
     * `SECONDI_DELLA_RIMANDATA` secondi sull'orologio di questo server (`il`, preso quando è stata tenuta: un segno può stare avanti
     * dell'orologio, per il cookie). Vale una volta sola: la toglie dalla sessione sempre. Va prima di `lingua()` solo se la
     * richiesta non la chiama: `lingua()` dopo userebbe questa lettura.
     */
    private static function perLaRimandata(): void
    {
        $tenuta = self::tenuta();
        session()->forget(self::RIMANDATA);

        if ($tenuta !== null && ! request()->attributes->has(self::LETTURA) && $tenuta['segno'] === (self::linguaIl()['lingua_il'] ?? null) && Segno::negliUltimi($tenuta['il'], self::SECONDI_DELLA_RIMANDATA)) {
            request()->attributes->set(self::LETTURA, ['di' => $tenuta['di'], 'segno' => $tenuta['segno'], 'esito' => $tenuta['esito'], 'nei_dati' => false]);
        }
    }

    /**
     * Ricorda nella sessione il segno di una lettura di io.mostra che ha confermato la lingua: solo se io.mostra ha risposto con
     * l'id della persona della sessione (`Sessione::aggiorna` torna true solo se qualcosa cambia, e non lo dice), e solo se è
     * più avanti di quello già ricordato per lei: una lettura più vecchia, finita dopo, non lo porta indietro, e la sua lingua non
     * entra nella sessione (`conLaLinguaRicordata()`, dalla `v2.11.4`). Due richieste in
     * volo insieme no: Laravel salva la sessione intera alla fine di ognuna, e l'ultima che finisce riscrive la lingua e il suo
     * segno di quando era partita, una coppia che resta coerente, e che il `dopo` successivo rimette avanti.
     *
     * @param  array<string, mixed>  $io  i `data` di io.mostra
     */
    private static function ricordaLaLingua(array $io, string $segno): void
    {
        $id = Sessione::utente()['id'] ?? null;
        $di = is_array($io['utente'] ?? null) ? ($io['utente']['id'] ?? null) : null;

        if (is_string($id) && $di === $id && strcmp($segno, self::linguaIl()['lingua_il'] ?? '') > 0) {
            session()->put(self::LINGUA, ['persona' => $id, 'il' => $segno]);
        }
    }

    /**
     * La risposta di io.mostra da dare a `Sessione::aggiorna`: com'è, salvo la lingua quando io.mostra ha risposto per la persona
     * della sessione e la lettura non è più avanti del segno della lingua ricordato per lei — una lettura più vecchia, finita dopo
     * una più nuova. Allora la lingua è quella che la sessione ha, confermata dalla lettura ricordata, e lingua e segno restano
     * una coppia (dalla `v2.11.4`: prima la lingua superata entrava nella sessione sotto il segno più nuovo, e il browser a pari
     * segno la teneva). Senza un segno ricordato per la persona, o con una risposta per un'altra, la risposta passa com'è; il
     * resto della risposta — il nome, le non lette — passa com'è sempre.
     *
     * @param  array<string, mixed>  $io  i `data` di io.mostra
     * @return array<string, mixed>
     */
    private static function conLaLinguaRicordata(array $io, string $segno): array
    {
        $ricordato = self::linguaIl()['lingua_il'] ?? null;
        $utente = Sessione::utente();
        $chi = $io['utente'] ?? null;

        if ($ricordato === null || strcmp($segno, $ricordato) > 0 || ! is_array($chi) || ($chi['id'] ?? null) !== ($utente['id'] ?? null) || ! is_string($utente['lingua'] ?? null)) {
            return $io;
        }

        return [...$io, 'utente' => [...$chi, 'lingua' => $utente['lingua']]];
    }

    /**
     * Il segno della lingua ricordato per la persona della sessione, come chiave da mettere nei dati; niente se non c'è, se è
     * di un'altra persona (ne è entrata un'altra nello stesso browser), o se sta avanti dell'orologio più di cinque minuti
     * (`Segno::troppoAvanti()`, dalla `v2.11.4`: l'ha ricordato un server con l'orologio avanti, e la lettura lo sostituisce).
     *
     * @return array{lingua_il?: string}
     */
    private static function linguaIl(): array
    {
        $ricordato = session(self::LINGUA);
        $id = Sessione::utente()['id'] ?? null;

        return is_string($id) && is_array($ricordato) && ($ricordato['persona'] ?? null) === $id && is_string($ricordato['il'] ?? null) && ! Segno::troppoAvanti($ricordato['il'])
            ? ['lingua_il' => $ricordato['il']]
            : [];
    }

    /**
     * L'avviso per l'errore che `lingua()` o `dopo()` prendono e non lanciano. Dell'errore dice solo il tipo, al posto di
     * `%s`: il suo messaggio può portare l'indirizzo del backoffice. Un log che non scrive non ferma la pagina.
     */
    private static function avvisa(BackofficeNonRisponde|ErroreApi $errore, string $riga = 'lingua della pagina: la lettura di io.mostra è fallita (%s): resta la lingua della sessione'): void
    {
        try {
            Log::warning('zr-core, '.sprintf($riga, get_debug_type($errore)));
        } catch (Throwable) {
            // La riga non lancia.
        }
    }

    /**
     * Le aziende della persona nell'ordine di io.aziende.elenca, ognuna coi suoi workspace nell'ordine di
     * io.workspace.elenca: il backoffice dà le due liste, e raggruppare per `azienda_id` è della cornice. Col gettone della
     * persona, perché sono le aziende di tutti i suoi workspace e non di quello in cui è entrata. Un workspace di un'azienda
     * che l'elenco non ha resta fuori: non va sotto un'altra. Di ogni workspace escono l'id, il nome e lo slug, e nient'altro della
     * riga (ruolo e azienda no): dall'id la cornice ricava il tono del workspace nel selettore, e sta nella riga già letta.
     *
     * `nuovo_workspace` dice se la persona può creare un workspace in quell'azienda: è vero se in almeno una riga di
     * io.workspace.elenca di quell'azienda il suo ruolo è `proprietario` o `amministratore`, i ruoli a cui il backoffice lo
     * lascia fare (io.workspace.crea). Il ruolo di un'azienda non vale per un'altra, e resta qui: al browser arriva il
     * booleano. Ogni altro valore vale «no» — `membro`, un ruolo che zr-core non conosce, una riga senza ruolo —, perché qui
     * si decide solo se mostrare «Nuovo workspace» nel selettore: se la persona può davvero lo decide il backoffice.
     *
     * @return list<array{id: string, nome: string, workspace: list<array{id: string, nome: string, slug: string}>, nuovo_workspace: bool}>
     */
    private static function aziende(): array
    {
        $aziende = [];
        foreach (Api::persona()->tutti('/v1/io/aziende') as $azienda) {
            [$id, $nome] = self::testi($azienda, ['id', 'nome'], 'GET /v1/io/aziende');
            $aziende[$id] = ['id' => $id, 'nome' => $nome, 'workspace' => [], 'nuovo_workspace' => false];
        }

        // Di un workspace di un'azienda che non è nell'elenco si legge solo `azienda_id`: si salta, come sempre.
        foreach (Api::persona()->tutti('/v1/io/workspace') as $workspace) {
            [$azienda] = self::testi($workspace, ['azienda_id'], 'GET /v1/io/workspace');
            if (isset($aziende[$azienda])) {
                [$id, $nome, $slug] = self::testi($workspace, ['id', 'nome', 'slug'], 'GET /v1/io/workspace');
                $aziende[$azienda]['workspace'][] = ['id' => $id, 'nome' => $nome, 'slug' => $slug];
                if (in_array($workspace['ruolo'] ?? null, ['proprietario', 'amministratore'], true)) {
                    $aziende[$azienda]['nuovo_workspace'] = true;
                }
            }
        }

        return array_values($aziende);
    }

    /**
     * I campi di un elemento di un elenco di /v1 che la cornice legge, nell'ordine dato: ognuno dev'essere un testo. Un elemento
     * che non è un oggetto, o senza uno di quei campi, o con un campo che non è un testo, è un guasto come una risposta che non è
     * una lista: BackofficeNonRisponde (dalla `v2.17.0`; prima un ErrorException o un TypeError), e `dopo()` dà `non_letti`. Il
     * messaggio dice la rotta e il campo, mai l'indirizzo del backoffice né ciò che la risposta portava.
     *
     * @param  list<string>  $campi
     * @return list<string>
     */
    private static function testi(mixed $elemento, array $campi, string $rotta): array
    {
        $testi = [];
        foreach ($campi as $campo) {
            if (! is_array($elemento) || ! is_string($elemento[$campo] ?? null)) {
                throw new BackofficeNonRisponde("Un elemento della risposta di {$rotta} non ha `{$campo}` come testo.");
            }
            $testi[] = $elemento[$campo];
        }

        return $testi;
    }

    /**
     * io.mostra (GET /v1/io), letto da `lettura()`: porta le notifiche non lette della persona nel workspace in cui è
     * entrata (`notifiche_non_lette`, il numero intero e non una pagina contata) e la persona com'è nel profilo, che va a
     * `Sessione::aggiorna`. Col gettone del workspace: con quello dell'accesso il backoffice non ha un workspace e alle non
     * lette risponde null. Un numero che manca, o che non è un intero da zero in su, è un guasto e non «zero non lette»: una
     * campanella vuota per un guasto non si distinguerebbe da nessuna notifica. E di una risposta guasta non si prende
     * niente, nemmeno la persona: lancia prima che la sessione cambi.
     *
     * @return array{notifiche_non_lette: int<0, max>, ...} i `data` di io.mostra
     */
    private static function ioMostra(): array
    {
        $io = Api::workspace()->get('/v1/io')['data'] ?? null;

        if (! is_array($io) || ! is_int($io['notifiche_non_lette'] ?? null) || $io['notifiche_non_lette'] < 0) {
            throw new BackofficeNonRisponde('La risposta di GET /v1/io non porta le notifiche non lette del workspace.');
        }

        return $io;
    }
}
