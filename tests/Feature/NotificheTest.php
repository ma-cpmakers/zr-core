<?php

use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Illuminate\Testing\TestResponse;
use Zeiras\Auth\Testing\Gettone;
use Zeiras\Auth\Testing\Rotte;

// Sprint 3 · T3 (voce #1277), riscritto nello sprint 5 · T2 (voce #1257) sul contratto di zr-backoffice. Le rotte che la
// cornice chiama dal browser per il pannello delle notifiche: GET /cornice/notifiche e PATCH
// /cornice/notifiche/{notifica}/lettura, nel gruppo `web` del frontend. La parte server le gira al backoffice col gettone del
// workspace, che resta nella sessione. Il backoffice è Http::fake, mai il finto di zr-auth. Nessuna richiesta esce (TestCase).
// Sprint 6 · T1 (voce #1318): l'elenco porta anche `app`, il codice dell'app da cui viene la notifica, com'è nel backoffice.

/** Il workspace in cui entra la sessione dei test. */
const WORKSPACE_DELLE_NOTIFICHE = ['id' => 'uat-ws', 'nome' => 'UAT Marketing', 'slug' => 'uat-marketing'];

/**
 * Una notifica come la dà /v1 (schema Notifica): tipo, soggetto e dati sono quelli dell'evento che l'ha generata, e `app` è il
 * codice dell'app di quell'evento (`pm` per la board), o null se l'evento non è di un'app.
 *
 * @return array<string, mixed>
 */
function notificaDelBackoffice(string $id, string $creataIl, ?string $lettaIl, ?string $app = 'pm'): array
{
    return [
        'id' => $id, 'tipo' => 'com.zeiras.board.cartella.creata', 'app' => $app, 'soggetto' => "/v1/board/cartelle/uat-cartella-{$id}",
        'dati' => ['id' => "uat-cartella-{$id}", 'aggiornata_il' => $creataIl], 'letta_il' => $lettaIl, 'creata_il' => $creataIl,
    ];
}

/** Un errore di /v1 col suo codice: un problem details (RFC 9457), `application/problem+json`. */
function problemaDelBackoffice(int $stato, ?string $codice): mixed
{
    $problema = ['type' => 'about:blank', 'title' => 'uat', 'status' => $stato, 'detail' => 'uat'] + ($codice === null ? [] : ['codice' => $codice]);

    return Http::response((string) json_encode($problema), $stato, ['Content-Type' => 'application/problem+json']);
}

/** Il percorso di /v1 di una richiesta al backoffice, senza la query. */
function percorsoDi(Request $richiesta): ?string
{
    return parse_url($richiesta->url(), PHP_URL_PATH) ?: null;
}

/** Ogni risposta delle rotte della cornice è senza gettone. */
function senzaGettone(TestResponse $risposta): TestResponse
{
    Gettone::assenteDa($risposta);

    return $risposta;
}

it('GET /cornice/notifiche dà la prima pagina delle notifiche del workspace del gettone, nell\'ordine del backoffice, coi soli id, creata_il, letta e app, e app è quello del backoffice: un prodotto, un codice che zr-core non conosce, o null (sprint 5 · T2.1; sprint 6 · T1.1)', function () {
    $gettoni = sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    // Al gettone dell'accesso io.notifiche.elenca risponde 403 gettone_senza_workspace.
    Http::fake(fn (Request $richiesta) => match (percorsoDi($richiesta)) {
        '/v1/io/notifiche' => $richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace'])
            ? Http::response(['data' => [
                notificaDelBackoffice('uat-n3', '2026-10-07T09:03:00.123Z', null),
                // Un'app nuova può comparire: la parte server non la scarta, lo fa la cornice col registro.
                notificaDelBackoffice('uat-n2', '2026-10-07T09:02:00.123Z', '2026-10-07T09:05:00.456Z', 'uat-ignota'),
                notificaDelBackoffice('uat-n1', '2026-10-07T09:01:00.123Z', null, null),
            ], 'successivo' => 'uat-cursore-2'])
            : problemaDelBackoffice(403, 'gettone_senza_workspace'),
    });

    $risposta = senzaGettone($this->getJson('cornice/notifiche'))->assertOk()->assertExactJson(['data' => [
        ['id' => 'uat-n3', 'creata_il' => '2026-10-07T09:03:00.123Z', 'letta' => false, 'app' => 'pm'],
        ['id' => 'uat-n2', 'creata_il' => '2026-10-07T09:02:00.123Z', 'letta' => true, 'app' => 'uat-ignota'],
        ['id' => 'uat-n1', 'creata_il' => '2026-10-07T09:01:00.123Z', 'letta' => false, 'app' => null],
    ]]);
    expect($risposta->json('data.*.id'))->toBe(['uat-n3', 'uat-n2', 'uat-n1']);
    // Una richiesta sola e senza parametri: la prima pagina, e il cursore non si segue.
    Http::assertSentCount(1);
    Http::assertSent(fn (Request $richiesta) => $richiesta->method() === 'GET' && percorsoDi($richiesta) === '/v1/io/notifiche'
        && parse_url($richiesta->url(), PHP_URL_QUERY) === null
        && $richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace']));
});

it('PATCH /cornice/notifiche/{id}/lettura gira letta al backoffice col gettone del workspace e risponde con ciò che il backoffice ha segnato (sprint 5 · T2.2)', function (bool $letta, ?string $lettaIl, bool $attesa) {
    $gettoni = sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    // Al gettone dell'accesso io.notifiche.lettura.modifica risponde 403 gettone_senza_workspace.
    Http::fake(fn (Request $richiesta) => match (percorsoDi($richiesta)) {
        '/v1/io/notifiche/uat-n3/lettura' => $richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace'])
            ? Http::response(['data' => notificaDelBackoffice('uat-n3', '2026-10-07T09:03:00.123Z', $lettaIl)])
            : problemaDelBackoffice(403, 'gettone_senza_workspace'),
    });

    senzaGettone($this->patchJson('cornice/notifiche/uat-n3/lettura', ['letta' => $letta]))
        ->assertOk()->assertExactJson(['data' => ['id' => 'uat-n3', 'letta' => $attesa]]);
    Http::assertSentCount(1);
    Http::assertSent(fn (Request $richiesta) => $richiesta->method() === 'PATCH' && percorsoDi($richiesta) === '/v1/io/notifiche/uat-n3/lettura'
        && $richiesta->data() === ['letta' => $letta]
        && $richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace']));
})->with([
    'segna letta' => [true, '2026-10-07T09:05:00.456Z', true],
    'torna non letta' => [false, null, false],
    // `letta` della risposta è quella del backoffice (`letta_il`), non quella chiesta.
    'chiede letta, il backoffice risponde non letta' => [true, null, false],
    'chiede non letta, il backoffice risponde letta' => [false, '2026-10-07T09:05:00.456Z', true],
]);

it('senza letta, o con un valore che non è un booleano JSON, risponde 422 dati_non_validi e non chiama il backoffice (sprint 5 · T2.3)', function (array $corpo, string $query) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake();

    senzaGettone($this->patchJson('cornice/notifiche/uat-n3/lettura'.$query, $corpo))
        ->assertStatus(422)->assertExactJson(['errore' => 'dati_non_validi']);
    Http::assertNothingSent();
})->with([
    'senza letta' => [[], ''],
    'la stringa true' => [['letta' => 'true'], ''],
    'la stringa false' => [['letta' => 'false'], ''],
    'il numero 1' => [['letta' => 1], ''],
    'il numero 0' => [['letta' => 0], ''],
    'null' => [['letta' => null], ''],
    'una lista' => [['letta' => [true]], ''],
    'solo nella query' => [[], '?letta=true'],
]);

it('un id che non è fatto solo di lettere, cifre, - e _, o più lungo di 64 caratteri, risponde 404 e non chiama il backoffice (sprint 5 · T2.4)', function (string $id) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake();

    senzaGettone($this->patchJson("cornice/notifiche/{$id}/lettura", ['letta' => true]))->assertNotFound();
    Http::assertNothingSent();
})->with([
    'una barra codificata' => ['a%2Fb'],
    'un altro metodo di /v1' => ['..%2F..%2Fworkspace%2Fmembri'],
    '65 lettere' => [str_repeat('a', 65)],
    'due punti' => ['..'],
    'un punto' => ['a.b'],
    'uno spazio' => ['a%20b'],
    'un punto di domanda codificato' => ['a%3Fb'],
    'un cancelletto codificato' => ['a%23b'],
    'una percentuale codificata' => ['a%252Fb'],
    'una lettera non ASCII' => ['%C3%A8'],
]);

it('un id di 64 caratteri fra lettere, cifre, - e _ arriva al backoffice così com\'è (sprint 5 · T2.4)', function () {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    $id = 'Uat_n-3'.str_repeat('z', 57);
    Http::fake(['*' => Http::response(['data' => notificaDelBackoffice($id, '2026-10-07T09:03:00.123Z', '2026-10-07T09:05:00.456Z')])]);

    senzaGettone($this->patchJson("cornice/notifiche/{$id}/lettura", ['letta' => true]))
        ->assertOk()->assertExactJson(['data' => ['id' => $id, 'letta' => true]]);
    Http::assertSentCount(1);
    Http::assertSent(fn (Request $richiesta) => percorsoDi($richiesta) === "/v1/io/notifiche/{$id}/lettura");
});

it('una notifica che il backoffice non trova risponde 404 non_trovato (sprint 5 · T2.5)', function () {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => problemaDelBackoffice(404, 'non_trovato')]);

    senzaGettone($this->patchJson('cornice/notifiche/uat-di-un-altro/lettura', ['letta' => true]))
        ->assertNotFound()->assertExactJson(['errore' => 'non_trovato']);
    Http::assertSentCount(1);
});

it('un 404 del backoffice senza il codice non_trovato è un suo errore, non una notifica che non c\'è (sprint 5 · T2.5)', function (?string $codice) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => problemaDelBackoffice(404, $codice)]);

    $risposta = senzaGettone($this->patchJson('cornice/notifiche/uat-n3/lettura', ['letta' => true]));

    expect($risposta->status())->toBeGreaterThanOrEqual(500)->toBeLessThan(600)
        ->and($risposta->json('errore'))->toBeNull();
})->with([
    'senza codice' => [null],
    'un altro codice' => ['uat_altro_codice'],
]);

it('se il backoffice risponde alla lettura senza la notifica è un errore, mai un 200 (sprint 5 · T2.5)', function (int $stato, mixed $corpo) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => Http::response($corpo, $stato)]);

    $risposta = senzaGettone($this->patchJson('cornice/notifiche/uat-n3/lettura', ['letta' => true]));

    expect($risposta->status())->toBeGreaterThanOrEqual(500)->toBeLessThan(600)
        ->and($risposta->json('data'))->toBeNull();
})->with([
    'un 500' => [500, ''],
    'un 200 senza JSON' => [200, 'uat: non è JSON'],
    'senza data' => [200, ['notifica' => notificaDelBackoffice('uat-n3', '2026-10-07T09:03:00.123Z', null)]],
    'data vuoto' => [200, ['data' => []]],
    'senza id' => [200, ['data' => ['app' => 'pm', 'creata_il' => '2026-10-07T09:03:00.123Z', 'letta_il' => '2026-10-07T09:05:00.456Z']]],
    'senza letta_il' => [200, ['data' => ['id' => 'uat-n3', 'app' => 'pm', 'creata_il' => '2026-10-07T09:03:00.123Z']]],
    'letta_il non è un istante né null' => [200, ['data' => ['id' => 'uat-n3', 'app' => 'pm', 'creata_il' => '2026-10-07T09:03:00.123Z', 'letta_il' => true]]],
    'senza app (sprint 6 · T1.2)' => [200, ['data' => ['id' => 'uat-n3', 'creata_il' => '2026-10-07T09:03:00.123Z', 'letta_il' => '2026-10-07T09:05:00.456Z']]],
    'un\'altra notifica' => [200, ['data' => notificaDelBackoffice('uat-n2', '2026-10-07T09:02:00.123Z', '2026-10-07T09:05:00.456Z')]],
]);

it('la rotta della bozza, PATCH /cornice/notifiche/lettura, non c\'è più (sprint 5 · T2.6)', function () {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake();

    expect($this->patchJson('cornice/notifiche/lettura', ['fino_a' => '2026-10-06T18:03:00Z', 'letta' => true])->status())->toBeIn([404, 405]);
    Http::assertNothingSent();
});

it('senza sessione le tre rotte della cornice rispondono 401 e non chiamano il backoffice (sprint 5 · T2.6)', function () {
    Http::fake();

    senzaGettone($this->getJson('cornice/notifiche'))->assertUnauthorized();
    senzaGettone($this->patchJson('cornice/notifiche/uat-n3/lettura', ['letta' => true]))->assertUnauthorized();
    senzaGettone($this->getJson('cornice/ricerca?q=uat'))->assertUnauthorized();
    Http::assertNothingSent();
});

it('con la sessione ma senza workspace le tre rotte della cornice rispondono 403 e non chiamano il backoffice (sprint 5 · T2.6)', function () {
    sessioneAMano(null);
    Http::fake();

    foreach ([
        $this->getJson('cornice/notifiche'),
        $this->patchJson('cornice/notifiche/uat-n3/lettura', ['letta' => true]),
        $this->getJson('cornice/ricerca?q=uat'),
    ] as $risposta) {
        senzaGettone($risposta)->assertForbidden()->assertExactJson(['errore' => 'gettone_senza_workspace']);
    }
    Http::assertNothingSent();
});

it('le rotte della cornice hanno la guardia di zr-auth: Rotte::senzaGuardia() non ne nomina nessuna (sprint 5 · T2.6)', function () {
    $dellaCornice = fn () => array_values(array_filter(Rotte::senzaGuardia(), fn (string $voce) => str_contains($voce, ' cornice/')));

    expect($dellaCornice())->toBe([]);

    // Il controllo nei due versi: una rotta della cornice fuori dal gruppo `web` la nomina.
    Route::patch('cornice/notifiche/{notifica}/scoperta', fn () => 'senza guardia');
    expect($dellaCornice())->toBe(['PATCH cornice/notifiche/{notifica}/scoperta']);
});

it('le rotte della cornice stanno nel gruppo `web` del frontend, che porta la sessione e il CSRF: in un altro gruppo la PATCH non avrebbe il CSRF, e nei test Laravel non lo controlla (sprint 5 · G9)', function () {
    $dellaCornice = fn () => array_values(array_filter(Route::getRoutes()->getRoutes(), fn ($rotta) => str_starts_with($rotta->uri(), 'cornice/')));
    $fuoriDalWeb = fn () => array_values(array_map(
        fn ($rotta) => implode('|', array_diff($rotta->methods(), ['HEAD'])).' '.$rotta->uri(),
        array_filter($dellaCornice(), fn ($rotta) => ! in_array('web', $rotta->gatherMiddleware(), true)),
    ));

    expect($dellaCornice())->toHaveCount(3)
        ->and($fuoriDalWeb())->toBe([]);

    // Il controllo nei due versi: nel gruppo `api` una rotta ha la guardia della sessione ma non il CSRF, e qui si vede.
    Route::middleware('api')->patch('cornice/notifiche/{notifica}/senza-csrf', fn () => 'senza CSRF');
    expect($fuoriDalWeb())->toBe(['PATCH cornice/notifiche/{notifica}/senza-csrf']);
});

it('se il backoffice non risponde all\'elenco, o dà notifiche che non sono di /v1, la rotta risponde con un errore, non con un elenco vuoto (T3.4; sprint 6 · T1.2)', function (int $stato, mixed $corpo) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => Http::response($corpo, $stato)]);

    $elenco = senzaGettone($this->getJson('cornice/notifiche'));

    expect($elenco->status())->toBeGreaterThanOrEqual(500)->toBeLessThan(600)
        ->and($elenco->json('data'))->toBeNull();
})->with([
    'un 500' => [500, ''],
    'un 503' => [503, ''],
    'un 200 senza la forma di /v1' => [200, ['notifiche' => []]],
    'data non è una lista' => [200, ['data' => notificaDelBackoffice('uat-n1', '2026-10-07T09:01:00.123Z', null), 'successivo' => null]],
    'una notifica che non è un oggetto' => [200, ['data' => ['uat-n1'], 'successivo' => null]],
    'una notifica senza id' => [200, ['data' => [['app' => null, 'creata_il' => '2026-10-07T09:01:00.123Z', 'letta_il' => null]], 'successivo' => null]],
    'una notifica senza creata_il' => [200, ['data' => [['id' => 'uat-n1', 'app' => null, 'letta_il' => null]], 'successivo' => null]],
    'una notifica senza letta_il' => [200, ['data' => [['id' => 'uat-n1', 'app' => null, 'creata_il' => '2026-10-07T09:01:00.123Z']], 'successivo' => null]],
    // Sprint 6 · T1.2: `app` c'è sempre, una stringa o null. Senza, o di un altro tipo, non è una notifica di /v1: mai `app: null`.
    'una notifica senza app' => [200, ['data' => [['id' => 'uat-n1', 'creata_il' => '2026-10-07T09:01:00.123Z', 'letta_il' => null]], 'successivo' => null]],
    'app è un numero' => [200, ['data' => [['id' => 'uat-n1', 'app' => 7, 'creata_il' => '2026-10-07T09:01:00.123Z', 'letta_il' => null]], 'successivo' => null]],
    'app è una lista' => [200, ['data' => [['id' => 'uat-n1', 'app' => ['pm'], 'creata_il' => '2026-10-07T09:01:00.123Z', 'letta_il' => null]], 'successivo' => null]],
    'app è true' => [200, ['data' => [['id' => 'uat-n1', 'app' => true, 'creata_il' => '2026-10-07T09:01:00.123Z', 'letta_il' => null]], 'successivo' => null]],
    'la seconda notifica senza app' => [200, ['data' => [notificaDelBackoffice('uat-n2', '2026-10-07T09:02:00.123Z', null), ['id' => 'uat-n1', 'creata_il' => '2026-10-07T09:01:00.123Z', 'letta_il' => null]], 'successivo' => null]],
]);
