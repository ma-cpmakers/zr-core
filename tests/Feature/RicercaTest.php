<?php

use Illuminate\Foundation\Http\Middleware\TrimStrings;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use Zeiras\Auth\Testing\Gettone;

// Sprint 3 · T5 (voce #1277), la parte server. La rotta della ricerca della cornice, GET /cornice/ricerca?q=, nel gruppo
// `web` del frontend: la parte server la gira a ricerca.elenca col gettone del workspace, che resta nella sessione. Il
// backoffice è Http::fake, mai il finto di zr-auth: non conosce la ricerca. Nessuna richiesta esce (TestCase).
// Sprint 5 · T4 (voce #1257): la ricerca sul contratto di ricerca.elenca. Un risultato è `{tipo, id, titolo}`, senza `app`: di
// che prodotto è lo dice il registro, nel browser. Una risposta che non ha quella forma è un guasto, mai un elenco più corto.

/** Il workspace in cui entra la sessione dei test. */
const WORKSPACE_DELLA_RICERCA = ['id' => 'uat-ws', 'nome' => 'UAT Marketing', 'slug' => 'uat-marketing'];

/**
 * La risposta di ricerca.elenca nell'esempio del contratto di /v1: una cartella e una board, in ordine di titolo, ultima pagina.
 *
 * @return array{data: list<array{tipo: string, id: string, titolo: string}>, successivo: null}
 */
function esempioDelContratto(): array
{
    return ['data' => [
        ['tipo' => 'board.cartelle', 'id' => '01k6w2c4e6g8j0m2p4r6t8v0x2', 'titolo' => 'Marketing'],
        ['tipo' => 'board.board', 'id' => '01k6w2d5f7h9k1n3q5s7v9x1z3', 'titolo' => 'Report marketing'],
    ], 'successivo' => null];
}

/**
 * Un risultato come lo dà ricerca.elenca: il tipo della risorsa, il suo id e il suo nome.
 *
 * @return array{tipo: string, id: string, titolo: string}
 */
function risultatoDelBackoffice(string $tipo, string $id, string $titolo): array
{
    return ['tipo' => $tipo, 'id' => $id, 'titolo' => $titolo];
}

/** La ricerca della cornice, con `q` nella query; ogni sua risposta è senza gettone. */
function cerca(string $q): TestResponse
{
    $risposta = test()->getJson('cornice/ricerca?'.http_build_query(['q' => $q]));
    Gettone::assenteDa($risposta);

    return $risposta;
}

it('GET /cornice/ricerca?q= cerca nel workspace del gettone e dà tipo, id e titolo dei risultati di ricerca.elenca, nell\'ordine del backoffice (T4.1)', function () {
    $gettoni = sessioneAMano(WORKSPACE_DELLA_RICERCA);
    // Col gettone dell'accesso il backoffice risponderebbe 403 gettone_senza_workspace: qui dà altri risultati, per vederlo.
    Http::fake(fn (Request $richiesta) => match (parse_url($richiesta->url(), PHP_URL_PATH)) {
        '/v1/ricerca' => Http::response($richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace'])
            ? esempioDelContratto()
            : ['data' => [risultatoDelBackoffice('board.board', 'uat-di-un-altro-workspace', 'UAT Altro')], 'successivo' => null]),
    });

    // L'esempio del contratto così com'è, nel suo ordine (per titolo): senza `app`, e `successivo` resta nella parte server.
    cerca('UAT là')->assertOk()->assertExactJson(['data' => [
        ['tipo' => 'board.cartelle', 'id' => '01k6w2c4e6g8j0m2p4r6t8v0x2', 'titolo' => 'Marketing'],
        ['tipo' => 'board.board', 'id' => '01k6w2d5f7h9k1n3q5s7v9x1z3', 'titolo' => 'Report marketing'],
    ]]);
    Http::assertSentCount(1);
    Http::assertSent(function (Request $richiesta) use ($gettoni) {
        parse_str((string) parse_url($richiesta->url(), PHP_URL_QUERY), $query);

        return $richiesta->method() === 'GET' && parse_url($richiesta->url(), PHP_URL_PATH) === '/v1/ricerca'
            && $query === ['q' => 'UAT là'] && $richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace']);
    });
});

it('ciò che la risposta del backoffice ha in più non arriva al browser: un `app`, altri campi di un risultato, il cursore della pagina dopo; un tipo che zr-core non conosce passa, e lo scarta la cornice (T4.1)', function () {
    sessioneAMano(WORKSPACE_DELLA_RICERCA);
    Http::fake(['*' => Http::response(['data' => [
        [...risultatoDelBackoffice('board.board', 'uat-b1', 'UAT Lancio'), 'app' => 'crm', 'soggetto' => '/v1/board/board/uat-b1', 'dentro' => null],
        risultatoDelBackoffice('uat-ignoto', 'uat-x1', 'UAT Tipo nuovo'),
    ], 'successivo' => 'uat-cursore', 'totale' => 2])]);

    cerca('UAT')->assertOk()->assertExactJson(['data' => [
        ['tipo' => 'board.board', 'id' => 'uat-b1', 'titolo' => 'UAT Lancio'],
        ['tipo' => 'uat-ignoto', 'id' => 'uat-x1', 'titolo' => 'UAT Tipo nuovo'],
    ]]);
});

it('q di 2 e di 100 caratteri, anche non ASCII, arriva al backoffice (T5.1)', function (string $q) {
    sessioneAMano(WORKSPACE_DELLA_RICERCA);
    Http::fake(['*' => Http::response(['data' => [], 'successivo' => null])]);

    cerca($q)->assertOk()->assertExactJson(['data' => []]);
    Http::assertSentCount(1);
})->with([
    'due' => ['ab'],
    'cento accentate' => [str_repeat('à', 100)],
]);

it('con meno di 2 o più di 100 caratteri risponde 422 e non chiama il backoffice (T5.1)', function (?string $q) {
    sessioneAMano(WORKSPACE_DELLA_RICERCA);
    Http::fake();

    $risposta = $q === null ? test()->getJson('cornice/ricerca') : cerca($q);

    $risposta->assertStatus(422)->assertExactJson(['errore' => 'dati_non_validi']);
    Gettone::assenteDa($risposta);
    Http::assertNothingSent();
})->with([
    'senza q' => [null],
    'vuota' => [''],
    'un carattere' => ['a'],
    'un carattere fra gli spazi' => ['  a  '],
    'centouno' => [str_repeat('à', 101)],
]);

it('gli spazi ai bordi di q si tolgono prima del controllo, anche in un frontend senza TrimStrings (T5.1)', function () {
    // Senza il middleware che toglie gli spazi: la rotta non conta su quello del frontend.
    test()->withoutMiddleware(TrimStrings::class);
    sessioneAMano(WORKSPACE_DELLA_RICERCA);
    Http::fake(['*' => Http::response(['data' => [], 'successivo' => null])]);

    cerca('  a  ')->assertStatus(422)->assertExactJson(['errore' => 'dati_non_validi']);
    Http::assertNothingSent();

    cerca('  ab  ')->assertOk();
    Http::assertSentCount(1);
    Http::assertSent(function (Request $richiesta) {
        parse_str((string) parse_url($richiesta->url(), PHP_URL_QUERY), $query);

        return $query === ['q' => 'ab'];
    });
});

it('senza sessione 401, con la sessione ma senza workspace 403, e il backoffice non si chiama (T5.1)', function () {
    Http::fake();

    cerca('UAT')->assertUnauthorized();

    sessioneAMano(null);

    cerca('UAT')->assertForbidden()->assertExactJson(['errore' => 'gettone_senza_workspace']);
    Http::assertNothingSent();
});

it('se il backoffice non risponde, o dà risultati che non sono di /v1, la ricerca risponde con un errore: mai un elenco vuoto, mai un risultato a metà (T4.2)', function (int $stato, mixed $corpo) {
    sessioneAMano(WORKSPACE_DELLA_RICERCA);
    Http::fake(['*' => Http::response($corpo, $stato)]);

    $risposta = cerca('UAT');

    expect($risposta->status())->toBeGreaterThanOrEqual(500)->toBeLessThan(600)
        ->and($risposta->json('data'))->toBeNull();
})->with([
    '500' => [500, ''],
    '200 senza la forma di /v1' => [200, ['risultati' => []]],
    'data non è una lista' => [200, ['data' => risultatoDelBackoffice('board.board', 'uat-b1', 'UAT Lancio'), 'successivo' => null]],
    'data è un testo' => [200, ['data' => 'UAT Lancio', 'successivo' => null]],
    'un risultato che non è un oggetto' => [200, ['data' => ['uat-b1'], 'successivo' => null]],
    'un risultato che è una lista' => [200, ['data' => [['board.board', 'uat-b1', 'UAT Lancio']], 'successivo' => null]],
    'un risultato senza tipo' => [200, ['data' => [['id' => 'uat-b1', 'titolo' => 'UAT Lancio']], 'successivo' => null]],
    'un risultato senza id' => [200, ['data' => [['tipo' => 'board.board', 'titolo' => 'UAT Lancio']], 'successivo' => null]],
    'un risultato senza titolo' => [200, ['data' => [['tipo' => 'board.board', 'id' => 'uat-b1']], 'successivo' => null]],
    'un tipo che non è un testo' => [200, ['data' => [['tipo' => ['board.board'], 'id' => 'uat-b1', 'titolo' => 'UAT Lancio']], 'successivo' => null]],
    'un id che è un numero' => [200, ['data' => [['tipo' => 'board.board', 'id' => 12, 'titolo' => 'UAT Lancio']], 'successivo' => null]],
    'un titolo null' => [200, ['data' => [['tipo' => 'board.board', 'id' => 'uat-b1', 'titolo' => null]], 'successivo' => null]],
    'un risultato buono e poi uno senza titolo' => [200, ['data' => [
        risultatoDelBackoffice('board.cartelle', 'uat-c1', 'UAT Clienti'), ['tipo' => 'board.board', 'id' => 'uat-b1'],
    ], 'successivo' => null]],
]);
