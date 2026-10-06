<?php

namespace Zeiras\Core;

use Zeiras\Auth\Api;
use Zeiras\Auth\Errori\BackofficeNonRisponde;
use Zeiras\Auth\Sessione;

/**
 * I dati della cornice per la pagina del frontend: chi è la persona, la sua lingua, il workspace in cui è entrata, lo stato
 * delle app in quel workspace, le aziende della persona coi loro workspace e le notifiche non lette nel workspace. Si leggono
 * dalla sessione di zr-auth e dal backoffice: app.elenca (GET /v1/app) e io.notifiche.elenca (GET /v1/io/notifiche) col
 * gettone del workspace, io.aziende.elenca (GET /v1/io/aziende) e io.workspace.elenca (GET /v1/io/workspace) col gettone
 * della persona; il gettone resta nella sessione. Il frontend li condivide con la pagina (con Inertia, nel suo `share()`), e
 * la `Cornice` di resources/js li riceve in `dati`.
 */
final class Cornice
{
    /** Quante non lette si chiedono: una pagina, la più grande di io.notifiche.elenca. Da lì in su la campanella non conta. */
    private const NON_LETTE = 100;

    /**
     * null senza una sessione entrata in un workspace: la pagina non ha un workspace, e il backoffice non si chiama. Il
     * workspace è quello del gettone, mai quello dell'indirizzo. Un backoffice che non risponde lancia BackofficeNonRisponde
     * (zr-auth): mai una lista di app vuota, che farebbe «Presto» di ogni prodotto, né un elenco di aziende vuoto o zero non
     * lette.
     *
     * @return array{lingua: string, persona: array{nome: string, email: string}, workspace: array{nome: string, slug: string}, prodotti: array<string, string>, aziende: list<array{id: string, nome: string, workspace: list<array{nome: string, slug: string}>}>, non_lette: int}|null
     */
    public static function dati(): ?array
    {
        $utente = Sessione::utente();
        $workspace = Sessione::workspace();

        if ($utente === null || $workspace === null) {
            return null;
        }

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
     * Le notifiche non lette nel workspace in cui la persona è entrata. Col gettone del workspace: con quello dell'accesso il
     * backoffice le dà di tutti i workspace. Una pagina sola, senza seguire il cursore: da 100 in su la campanella mostra
     * «99+», e contarle tutte vorrebbe una richiesta ogni cento. `letta` è la stringa `false`: un booleano in una query
     * diventa `0`, che il backoffice rifiuta.
     */
    private static function nonLette(): int
    {
        $notifiche = Api::workspace()->get('/v1/io/notifiche', ['letta' => 'false', 'limite' => self::NON_LETTE])['data'] ?? null;

        if (! is_array($notifiche) || ! array_is_list($notifiche)) {
            throw new BackofficeNonRisponde('La risposta di GET /v1/io/notifiche non è una lista di /v1.');
        }

        return count($notifiche);
    }
}
