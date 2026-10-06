<?php

namespace Zeiras\Core\Http;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Zeiras\Auth\Api;
use Zeiras\Auth\Errori\BackofficeNonRisponde;

/**
 * La ricerca della cornice (Ctrl/Cmd+K), per il browser: la parte server la gira a ricerca.elenca col gettone del workspace
 * in cui la persona è entrata, e alla cornice dà di ogni risultato app, tipo, id e titolo, nell'ordine del backoffice (per
 * pertinenza). Un backoffice che non risponde è BackofficeNonRisponde, cioè un errore, mai un elenco vuoto.
 */
final class RicercaDellaCornice
{
    /** GET /cornice/ricerca?q=: `q` da 2 a 100 caratteri, come vuole ricerca.elenca; altrimenti 422 e il backoffice non si chiama. */
    public function cerca(Request $richiesta): JsonResponse
    {
        $q = $richiesta->query('q');

        if (! is_string($q) || mb_strlen($q) < 2 || mb_strlen($q) > 100) {
            return new JsonResponse(['errore' => 'dati_non_validi'], 422);
        }

        $risultati = Api::workspace()->get('/v1/ricerca', ['q' => $q])['data'] ?? null;

        if (! is_array($risultati) || ! array_is_list($risultati)) {
            throw new BackofficeNonRisponde('La risposta di GET /v1/ricerca non è una lista di /v1.');
        }

        return new JsonResponse(['data' => array_map(fn (array $risultato) => [
            'app' => $risultato['app'],
            'tipo' => $risultato['tipo'],
            'id' => $risultato['id'],
            'titolo' => $risultato['titolo'],
        ], $risultati)]);
    }
}
