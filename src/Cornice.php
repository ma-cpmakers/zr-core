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
 * Ogni lettura porta un segno, `aggiornati_il`: l'istante in cui è cominciata. I dati di due letture non sono mai uguali,
 * nemmeno quando niente è cambiato: Inertia, in una visita alla stessa pagina, ridà l'oggetto di prima per i dati uguali in
 * profondità, e la `Cornice` riconosce i dati nuovi dall'oggetto (senza segno la campanella resterebbe al numero di prima).
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
     * stringhe.
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
            'non_lette' => self::nonLette(),
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
     * Le notifiche non lette della persona nel workspace in cui è entrata: `notifiche_non_lette` di io.mostra, il numero
     * intero e non una pagina contata. Col gettone del workspace: con quello dell'accesso il backoffice non ha un workspace
     * e risponde null. Un numero che manca, o che non è un intero da zero in su, è un guasto e non «zero non lette»: una
     * campanella vuota per un guasto non si distinguerebbe da nessuna notifica.
     */
    private static function nonLette(): int
    {
        $nonLette = Api::workspace()->get('/v1/io')['data']['notifiche_non_lette'] ?? null;

        if (! is_int($nonLette) || $nonLette < 0) {
            throw new BackofficeNonRisponde('La risposta di GET /v1/io non porta le notifiche non lette del workspace.');
        }

        return $nonLette;
    }
}
