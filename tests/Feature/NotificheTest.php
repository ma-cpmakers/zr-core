<?php

use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Illuminate\Testing\TestResponse;
use Zeiras\Auth\Testing\Gettone;
use Zeiras\Auth\Testing\Rotte;

// Sprint 3 · T3 (voce #1277). Le rotte che la cornice chiama dal browser per il pannello delle notifiche: GET
// /cornice/notifiche e PATCH /cornice/notifiche/lettura, nel gruppo `web` del frontend. La parte server le gira al backoffice
// col gettone del workspace, che resta nella sessione. Il backoffice è Http::fake, mai il finto di zr-auth: non conosce le
// notifiche. Nessuna richiesta esce (TestCase).

/** Il workspace in cui entra la sessione dei test. */
const WORKSPACE_DELLE_NOTIFICHE = ['id' => 'uat-ws', 'nome' => 'UAT Marketing', 'slug' => 'uat-marketing'];

/**
 * Una notifica come la dà io.notifiche.elenca (bozza di zr-backoffice, #1260).
 *
 * @return array<string, mixed>
 */
function notificaDelBackoffice(string $id, string $creataIl, ?string $lettaIl, bool $perMe): array
{
    return [
        'id' => $id, 'creata_il' => $creataIl, 'letta_il' => $lettaIl, 'per_me' => $perMe, 'motivo' => 'uat', 'app' => 'pm',
        'autore_id' => 'uat-autore', 'soggetto' => "uat-soggetto-{$id}", 'workspace_id' => 'uat-ws',
    ];
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

it('GET /cornice/notifiche dà le notifiche del workspace del gettone, nell\'ordine del backoffice, coi soli campi della cornice (T3.1)', function () {
    $gettoni = sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    // Col gettone dell'accesso il backoffice darebbe le notifiche di tutti i workspace della persona.
    Http::fake(fn (Request $richiesta) => match (percorsoDi($richiesta)) {
        '/v1/io/notifiche' => Http::response(['data' => $richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace'])
            ? [
                notificaDelBackoffice('uat-n3', '2026-10-06T18:03:00.000000Z', null, true),
                notificaDelBackoffice('uat-n2', '2026-10-06T18:02:00.000000Z', '2026-10-06T18:05:00.000000Z', false),
                notificaDelBackoffice('uat-n1', '2026-10-06T18:01:00.000000Z', null, false),
            ]
            : [notificaDelBackoffice('uat-di-un-altro-workspace', '2026-10-06T18:04:00.000000Z', null, true)],
            'successivo' => null]),
    });

    senzaGettone($this->getJson('cornice/notifiche'))->assertOk()->assertExactJson(['data' => [
        ['id' => 'uat-n3', 'creata_il' => '2026-10-06T18:03:00.000000Z', 'letta' => false, 'per_me' => true, 'motivo' => 'uat', 'app' => 'pm'],
        ['id' => 'uat-n2', 'creata_il' => '2026-10-06T18:02:00.000000Z', 'letta' => true, 'per_me' => false, 'motivo' => 'uat', 'app' => 'pm'],
        ['id' => 'uat-n1', 'creata_il' => '2026-10-06T18:01:00.000000Z', 'letta' => false, 'per_me' => false, 'motivo' => 'uat', 'app' => 'pm'],
    ]]);
    Http::assertSentCount(1);
    Http::assertSent(fn (Request $richiesta) => $richiesta->method() === 'GET' && percorsoDi($richiesta) === '/v1/io/notifiche'
        && $richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace']));
});

it('PATCH /cornice/notifiche/lettura manda lo stesso fino_a al backoffice col gettone del workspace e risponde col fino_a del backoffice (T3.2)', function () {
    $gettoni = sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    // Il backoffice risponde col suo istante: è quello che arriva alla cornice.
    Http::fake(fn (Request $richiesta) => match (percorsoDi($richiesta)) {
        '/v1/io/notifiche/lettura' => Http::response(['data' => ['fino_a' => '2026-10-06T18:03:00.000000Z']]),
    });

    senzaGettone($this->patchJson('cornice/notifiche/lettura', ['fino_a' => '2026-10-06T20:03:00+02:00']))
        ->assertOk()->assertExactJson(['data' => ['fino_a' => '2026-10-06T18:03:00.000000Z']]);
    Http::assertSentCount(1);
    Http::assertSent(fn (Request $richiesta) => $richiesta->method() === 'PATCH' && percorsoDi($richiesta) === '/v1/io/notifiche/lettura'
        && $richiesta->data() === ['fino_a' => '2026-10-06T20:03:00+02:00']
        && $richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace']));
});

it('PATCH /cornice/notifiche/lettura senza fino_a, o con un valore che non è un istante, risponde 422 e non chiama il backoffice (T3.2)', function (array $corpo) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake();

    senzaGettone($this->patchJson('cornice/notifiche/lettura', $corpo))->assertStatus(422);
    Http::assertNothingSent();
})->with([
    'senza fino_a' => [[]],
    'vuoto' => [['fino_a' => '']],
    'una parola' => [['fino_a' => 'ieri']],
    'una frase che strtotime capisce' => [['fino_a' => 'now']],
    'una data senza ora' => [['fino_a' => '2026-10-06']],
    'un\'ora senza fuso' => [['fino_a' => '2026-10-06T18:03:00']],
    'un giorno che non esiste' => [['fino_a' => '2026-02-30T18:03:00Z']],
    'un numero' => [['fino_a' => 20261006]],
    'una lista' => [['fino_a' => ['2026-10-06T18:03:00Z']]],
]);

it('senza sessione le rotte della cornice rispondono 401 e non chiamano il backoffice (T3.3)', function () {
    Http::fake();

    senzaGettone($this->getJson('cornice/notifiche'))->assertUnauthorized();
    senzaGettone($this->patchJson('cornice/notifiche/lettura', ['fino_a' => '2026-10-06T18:03:00Z']))->assertUnauthorized();
    Http::assertNothingSent();
});

it('le rotte della cornice hanno la guardia di zr-auth: Rotte::senzaGuardia() non ne nomina nessuna (T3.3)', function () {
    $dellaCornice = fn () => array_values(array_filter(Rotte::senzaGuardia(), fn (string $voce) => str_contains($voce, ' cornice/')));

    expect($dellaCornice())->toBe([]);

    // Il controllo nei due versi: una rotta della cornice fuori dal gruppo `web` la nomina.
    Route::get('cornice/scoperta', fn () => 'senza guardia');
    expect($dellaCornice())->toBe(['GET cornice/scoperta']);
});

it('con la sessione ma senza workspace le rotte della cornice rispondono 403 e non chiamano il backoffice (T3.3)', function () {
    sessioneAMano(null);
    Http::fake();

    senzaGettone($this->getJson('cornice/notifiche'))->assertForbidden()->assertExactJson(['errore' => 'gettone_senza_workspace']);
    senzaGettone($this->patchJson('cornice/notifiche/lettura', ['fino_a' => '2026-10-06T18:03:00Z']))
        ->assertForbidden()->assertExactJson(['errore' => 'gettone_senza_workspace']);
    Http::assertNothingSent();
});

it('se il backoffice non risponde, le rotte della cornice rispondono con un errore, non con un elenco vuoto (T3.4)', function (int $stato, mixed $corpo) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => Http::response($corpo, $stato)]);

    $elenco = senzaGettone($this->getJson('cornice/notifiche'));
    $lettura = senzaGettone($this->patchJson('cornice/notifiche/lettura', ['fino_a' => '2026-10-06T18:03:00Z']));

    expect($elenco->status())->toBeGreaterThanOrEqual(500)->toBeLessThan(600)
        ->and($elenco->json('data'))->toBeNull()
        ->and($lettura->status())->toBeGreaterThanOrEqual(500)->toBeLessThan(600)
        ->and($lettura->json('data'))->toBeNull();
})->with([
    '500' => [500, ''],
    '503' => [503, ''],
    '200 senza la forma di /v1' => [200, ['notifiche' => []]],
]);
