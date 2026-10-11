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
 * zr-auth (dalla 0.12): la sessione prende la lingua e il nome del profilo, e i dati li portano da quella stessa lettura.
 * Un modulo che mette la lingua della pagina prima del controller la prende da `lingua()`, che fa quella stessa lettura: in una
 * richiesta io.mostra si legge una volta per tutte e due (vedi `lettura()`).
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

    /** La forma di una lingua: due o tre lettere, poi parti di lettere e cifre unite da `-` o `_` (`it`, `pt-BR`, `zh-Hans-CN`). */
    private const FORMA_DI_UNA_LINGUA = '/\A[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{1,8})*\z/';

    /**
     * null senza una sessione entrata in un workspace: la pagina non ha un workspace, e il backoffice non si chiama. Il
     * workspace è quello del gettone, mai quello dell'indirizzo. Un backoffice che non risponde lancia BackofficeNonRisponde
     * (zr-auth): mai una lista di app vuota, che farebbe «Presto» di ogni prodotto, né un elenco di aziende vuoto o zero non
     * lette.
     *
     * `aggiornati_il` è l'istante in cui la lettura comincia, preso prima di chiamare il backoffice (i dati sono almeno
     * freschi quanto il segno), nella forma di `Segno::adesso()`: in UTC qualunque sia il fuso dell'applicazione, coi
     * microsecondi sempre a sei cifre e `Z` in fondo (`2026-10-09T21:31:05.123456Z`), così due segni si ordinano anche come
     * stringhe. Le non lette si contano per prime, subito dopo il segno: è il numero che la cornice confronta col segno, e
     * contato dopo le altre letture sarebbe più fresco del suo segno di tre chiamate. Se in questa richiesta `lingua()` ha già
     * letto io.mostra, le non lette e il segno sono quelli di quella lettura, che non si rifà: il segno resta l'istante preso
     * prima di contarle. Una seconda `dati()` nella stessa richiesta rilegge tutto, col suo segno.
     *
     * La lingua e il nome sono quelli della sessione riletta dopo `Sessione::aggiorna`, mai quelli di io.mostra presi da qui:
     * che cosa vale lo decide zr-auth (i dati di un'altra persona e un valore vuoto non entrano), e i dati della cornice non
     * dicono altro dalla sessione. Email, workspace e ruolo restano quelli dell'ingresso.
     *
     * @return array{lingua: string, persona: array{nome: string, email: string}, workspace: array{nome: string, slug: string}, prodotti: array<string, string>, aziende: list<array{id: string, nome: string, workspace: list<array{id: string, nome: string, slug: string}>}>, non_lette: int, aggiornati_il: string}|null
     */
    public static function dati(): ?array
    {
        $utente = Sessione::utente();
        $workspace = Sessione::workspace();

        if ($utente === null || $workspace === null) {
            return null;
        }

        $lettura = self::lettura($utente, $workspace, true);

        // La lettura fallita di `lingua()`, che non lancia, è ancora un errore per i dati: lo stesso, senza rileggere.
        if (! is_int($lettura['esito'])) {
            throw $lettura['esito'];
        }

        // Se intanto la sessione è scaduta zr-auth non dà più la persona, e la lettura dopo lancia GettoneRifiutato prima che
        // la persona serva: il ripiego su quella letta all'inizio tiene `$utente` un array qualunque sia l'ordine delle letture
        // (`Sessione::utente()` può dare null). Oggi nessun test lo distingue, e l'analisi statica non lo chiede.
        $utente = Sessione::utente() ?? $utente;

        $prodotti = [];
        foreach (Api::workspace()->tutti('/v1/app') as $app) {
            $prodotti[$app['codice']] = $app['stato'];
        }

        return [
            'lingua' => $utente['lingua'],
            'persona' => ['nome' => $utente['nome'], 'email' => $utente['email']],
            'workspace' => ['nome' => $workspace['nome'], 'slug' => $workspace['slug']],
            'prodotti' => $prodotti,
            'aziende' => self::aziende(),
            'non_lette' => $lettura['esito'],
            'aggiornati_il' => $lettura['segno'],
        ];
    }

    /**
     * La lingua della persona già aggiornata dal profilo, per il modulo che mette la lingua della pagina in un middleware,
     * prima del controller: legge io.mostra, lo dà a `Sessione::aggiorna` e risponde con la lingua della sessione, che cosa
     * vale lo decide zr-auth. Senza la riga la lingua letta dalla sessione prima di `dati()` è ancora quella dell'ingresso, e
     * dopo un cambio nel profilo la prima pagina esce con la cornice nella lingua nuova e il contenuto nella vecchia.
     *
     * null senza una sessione, o se la lingua della sessione non ha la forma di una lingua (FORMA_DI_UNA_LINGUA, 35 caratteri
     * al più): ciò che esce da qui va a `App::setLocale`, che su una barra, due punti di fila o un byte nullo lancia dopo aver
     * già scritto `app.locale`, e la sessione prende la lingua da io.mostra senza guardarne la forma. `dati()` porta invece la
     * lingua della sessione com'è. Senza un workspace è la lingua della sessione, e il backoffice non si chiama. Costa una
     * lettura, io.mostra, e in una richiesta in cui c'è anche `dati()` nessuna in più: è la stessa (vedi `lettura()`). Se il
     * backoffice non risponde non lancia, perché la lingua di una pagina non diventi un 500: dà la lingua che la sessione ha,
     * lascia un avviso nel log, e l'errore lo lancia `dati()`, se in quella richiesta c'è. GettoneRifiutato passa: la
     * sessione è finita, e lo tratta il frontend come da ogni altra chiamata.
     */
    public static function lingua(): ?string
    {
        $utente = Sessione::utente();

        if ($utente === null) {
            return null;
        }

        $workspace = Sessione::workspace();

        if ($workspace !== null) {
            self::lettura($utente, $workspace, false);
            // Come in `dati()`: se intanto la sessione è scaduta resta la persona letta all'inizio.
            $utente = Sessione::utente() ?? $utente;
        }

        $lingua = $utente['lingua'] ?? null;

        return is_string($lingua) && strlen($lingua) <= 35 && preg_match(self::FORMA_DI_UNA_LINGUA, $lingua) === 1 ? $lingua : null;
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
     * resterebbe traccia.
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
            Sessione::aggiorna($io);
            $esito = $io['notifiche_non_lette'];
        } catch (BackofficeNonRisponde|ErroreApi $errore) {
            $esito = $errore;
            if (! $perIDati) {
                self::avvisa($errore);
            }
        }

        $lettura = ['di' => $di, 'segno' => $segno, 'esito' => $esito, 'nei_dati' => $perIDati];
        request()->attributes->set(self::LETTURA, $lettura);

        return $lettura;
    }

    /**
     * L'avviso per l'errore che `lingua()` prende e non lancia. Dell'errore dice solo il tipo: il suo messaggio può portare
     * l'indirizzo del backoffice. Un log che non scrive non ferma la lingua della pagina.
     */
    private static function avvisa(BackofficeNonRisponde|ErroreApi $errore): void
    {
        try {
            Log::warning('zr-core, lingua della pagina: la lettura di io.mostra è fallita ('.get_debug_type($errore).'): resta la lingua della sessione');
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
     * @return list<array{id: string, nome: string, workspace: list<array{id: string, nome: string, slug: string}>}>
     */
    private static function aziende(): array
    {
        $aziende = [];
        foreach (Api::persona()->tutti('/v1/io/aziende') as $azienda) {
            $aziende[$azienda['id']] = ['id' => $azienda['id'], 'nome' => $azienda['nome'], 'workspace' => []];
        }

        foreach (Api::persona()->tutti('/v1/io/workspace') as $workspace) {
            if (isset($aziende[$workspace['azienda_id']])) {
                $aziende[$workspace['azienda_id']]['workspace'][] = ['id' => $workspace['id'], 'nome' => $workspace['nome'], 'slug' => $workspace['slug']];
            }
        }

        return array_values($aziende);
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
