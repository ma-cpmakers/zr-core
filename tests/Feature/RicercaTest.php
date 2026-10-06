<?php

use Illuminate\Foundation\Http\Middleware\TrimStrings;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use Zeiras\Auth\Testing\Gettone;

// Sprint 3 · T5 (voce #1277), la parte server. La rotta della ricerca della cornice, GET /cornice/ricerca?q=, nel gruppo
// `web` del frontend: la parte server la gira a ricerca.elenca col gettone del workspace, che resta nella sessione. Il
// backoffice è Http::fake, mai il finto di zr-auth: non conosce la ricerca. Nessuna richiesta esce (TestCase).

/** Il workspace in cui entra la sessione dei test. */
const WORKSPACE_DELLA_RICERCA = ['id' => 'uat-ws', 'nome' => 'UAT Marketing', 'slug' => 'uat-marketing'];

/**
 * Un risultato come lo dà ricerca.elenca (bozza di zr-backoffice, #1261).
 *
 * @return array<string, mixed>
 */
function risultatoDelBackoffice(string $tipo, string $id, string $titolo): array
{
    return ['app' => 'pm', 'tipo' => $tipo, 'id' => $id, 'titolo' => $titolo, 'soggetto' => "uat-soggetto-{$id}", 'dentro' => null];
}

/** La ricerca della cornice, con `q` nella query; ogni sua risposta è senza gettone. */
function cerca(string $q): TestResponse
{
    $risposta = test()->getJson('cornice/ricerca?'.http_build_query(['q' => $q]));
    Gettone::assenteDa($risposta);

    return $risposta;
}

it('GET /cornice/ricerca?q= cerca nel workspace del gettone e dà app, tipo, id e titolo nell\'ordine del backoffice (T5.1)', function () {
    $gettoni = sessioneAMano(WORKSPACE_DELLA_RICERCA);
    // Col gettone dell'accesso il backoffice risponderebbe 403 gettone_senza_workspace: qui dà altri risultati, per vederlo.
    Http::fake(fn (Request $richiesta) => match (parse_url($richiesta->url(), PHP_URL_PATH)) {
        '/v1/ricerca' => Http::response(['data' => $richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace'])
            ? [risultatoDelBackoffice('board', 'uat-b1', 'UAT Lancio'), risultatoDelBackoffice('cartella', 'uat-c1', 'UAT Clienti')]
            : [risultatoDelBackoffice('board', 'uat-di-un-altro-workspace', 'UAT Altro')],
            'successivo' => null]),
    });

    cerca('UAT là')->assertOk()->assertExactJson(['data' => [
        ['app' => 'pm', 'tipo' => 'board', 'id' => 'uat-b1', 'titolo' => 'UAT Lancio'],
        ['app' => 'pm', 'tipo' => 'cartella', 'id' => 'uat-c1', 'titolo' => 'UAT Clienti'],
    ]]);
    Http::assertSentCount(1);
    Http::assertSent(function (Request $richiesta) use ($gettoni) {
        parse_str((string) parse_url($richiesta->url(), PHP_URL_QUERY), $query);

        return $richiesta->method() === 'GET' && parse_url($richiesta->url(), PHP_URL_PATH) === '/v1/ricerca'
            && $query === ['q' => 'UAT là'] && $richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace']);
    });
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

it('se il backoffice non risponde la ricerca risponde con un errore, non con un elenco vuoto (T5.1)', function (int $stato, mixed $corpo) {
    sessioneAMano(WORKSPACE_DELLA_RICERCA);
    Http::fake(['*' => Http::response($corpo, $stato)]);

    $risposta = cerca('UAT');

    expect($risposta->status())->toBeGreaterThanOrEqual(500)->toBeLessThan(600)
        ->and($risposta->json('data'))->toBeNull();
})->with([
    '500' => [500, ''],
    '200 senza la forma di /v1' => [200, ['risultati' => []]],
]);
