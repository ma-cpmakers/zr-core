<?php

namespace Zeiras\Core\Http;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Zeiras\Auth\Api;
use Zeiras\Auth\Errori\BackofficeNonRisponde;

/**
 * La ricerca della cornice (Ctrl/Cmd+K), per il browser: la parte server la gira a ricerca.elenca col gettone del workspace
 * in cui la persona è entrata, e alla cornice dà di ogni risultato tipo, id e titolo, nell'ordine del backoffice (per titolo),
 * la prima pagina. Di che prodotto è un risultato il contratto non lo dice: lo trova la cornice, dal tipo, nel registro. Un
 * backoffice che non risponde è BackofficeNonRisponde, cioè un errore, mai un elenco vuoto.
 */
final class RicercaDellaCornice
{
    /**
     * POST /cornice/ricerca con `{q}`: `q` da 2 a 100 caratteri, come vuole ricerca.elenca, senza gli spazi ai bordi (anche in
     * un frontend senza TrimStrings); altrimenti 422 e il backoffice non si chiama. La parola si legge solo dal corpo JSON: ciò
     * che una persona cerca non deve stare in un indirizzo, e un `q` dell'indirizzo non conta.
     */
    public function cerca(Request $richiesta): JsonResponse
    {
        $q = $richiesta->json('q');
        $q = is_string($q) ? Str::trim($q) : $q;

        if (! is_string($q) || mb_strlen($q) < 2 || mb_strlen($q) > 100) {
            return new JsonResponse(['errore' => 'dati_non_validi'], 422);
        }

        $risultati = Api::workspace()->get('/v1/ricerca', ['q' => $q])['data'] ?? null;

        if (! is_array($risultati) || ! array_is_list($risultati)) {
            throw new BackofficeNonRisponde('La risposta di GET /v1/ricerca non è una lista di /v1.');
        }

        return new JsonResponse(['data' => array_map(self::perLaCornice(...), $risultati)]);
    }

    /**
     * Ciò che la cornice usa di un risultato di /v1: il tipo della risorsa, il suo id e il suo nome, tutti di testo. Una
     * risposta senza uno dei tre non è un risultato, ed è un guasto: mai un elenco più corto, mai un risultato a metà. Un tipo
     * che zr-core non conosce passa: non mostrarlo è della cornice, che ha il registro.
     *
     * @return array{tipo: string, id: string, titolo: string}
     */
    private static function perLaCornice(mixed $risultato): array
    {
        if (! is_array($risultato) || ! is_string($risultato['tipo'] ?? null) || ! is_string($risultato['id'] ?? null)
            || ! is_string($risultato['titolo'] ?? null)) {
            throw new BackofficeNonRisponde('La risposta di GET /v1/ricerca non è un risultato di /v1.');
        }

        return ['tipo' => $risultato['tipo'], 'id' => $risultato['id'], 'titolo' => $risultato['titolo']];
    }
}
