<?php

namespace Zeiras\Core;

use Zeiras\Auth\Api;
use Zeiras\Auth\Errori\BackofficeNonRisponde;
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
     * contato dopo le altre letture sarebbe più fresco del suo segno di tre chiamate.
     *
     * La lingua e il nome sono quelli della sessione riletta dopo `Sessione::aggiorna`, mai quelli di io.mostra presi da qui:
     * che cosa vale lo decide zr-auth (i dati di un'altra persona e un valore vuoto non entrano), e i dati della cornice non
     * dicono altro dalla sessione. Email, workspace e ruolo restano quelli dell'ingresso.
     *
     * @return array{lingua: string, persona: array{nome: string, email: string}, workspace: array{nome: string, slug: string}, prodotti: array<string, string>, aziende: list<array{id: string, nome: string, workspace: list<array{nome: string, slug: string}>}>, non_lette: int, aggiornati_il: string}|null
     */
    public static function dati(): ?array
    {
        $utente = Sessione::utente();
        $workspace = Sessione::workspace();

        if ($utente === null || $workspace === null) {
            return null;
        }

        $aggiornatiIl = Segno::adesso();
        $io = self::ioMostra();

        Sessione::aggiorna($io);
        // Se intanto la sessione è scaduta zr-auth non dà più la persona: resta quella letta all'inizio, e la lettura dopo
        // lancia GettoneRifiutato.
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
            'non_lette' => $io['notifiche_non_lette'],
            'aggiornati_il' => $aggiornatiIl,
        ];
    }

    /**
     * Le aziende della persona nell'ordine di io.aziende.elenca, ognuna coi suoi workspace nell'ordine di
     * io.workspace.elenca: il backoffice dà le due liste, e raggruppare per `azienda_id` è della cornice. Col gettone della
     * persona, perché sono le aziende di tutti i suoi workspace e non di quello in cui è entrata. Un workspace di un'azienda
     * che l'elenco non ha resta fuori: non va sotto un'altra.
     *
     * @return list<array{id: string, nome: string, workspace: list<array{nome: string, slug: string}>}>
     */
    private static function aziende(): array
    {
        $aziende = [];
        foreach (Api::persona()->tutti('/v1/io/aziende') as $azienda) {
            $aziende[$azienda['id']] = ['id' => $azienda['id'], 'nome' => $azienda['nome'], 'workspace' => []];
        }

        foreach (Api::persona()->tutti('/v1/io/workspace') as $workspace) {
            if (isset($aziende[$workspace['azienda_id']])) {
                $aziende[$workspace['azienda_id']]['workspace'][] = ['nome' => $workspace['nome'], 'slug' => $workspace['slug']];
            }
        }

        return array_values($aziende);
    }

    /**
     * io.mostra (GET /v1/io), letto una volta per `dati()`: porta le notifiche non lette della persona nel workspace in cui è
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
