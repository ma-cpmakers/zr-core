<?php

use Illuminate\Http\Client\Request;
use Illuminate\Http\Client\ResponseSequence;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Zeiras\Auth\Errori\BackofficeNonRisponde;
use Zeiras\Auth\Sessione;
use Zeiras\Auth\Testing\Gettone;
use Zeiras\Core\Cornice;

// Sprint 2 · T3 (voce #1256), sprint 3 · T1 (voce #1277), sprint 5 · T1 (voce #1257) e sprint 10 · T1 (voce #1453). La parte
// server della cornice: Cornice::dati() dà alla pagina del frontend la persona, la sua lingua, il workspace in cui è entrata,
// lo stato delle app in quel workspace, le aziende della persona coi loro workspace e le notifiche non lette nel workspace,
// dalla sessione di zr-auth e dal backoffice, e il segno `aggiornati_il`: l'istante in cui la lettura è cominciata. Il
// backoffice è Http::fake (backoffice() qui sotto), mai il finto di zr-auth: su un metodo che non conosce lancia
// RichiestaSconosciuta. Nessuna richiesta esce (TestCase). La pagina di prova è `w/{slug}/cornice` di TestCase, nel gruppo
// `web`.

/**
 * Il backoffice in Http::fake, un metodo di /v1 alla volta: app.elenca, io.mostra, io.aziende.elenca e io.workspace.elenca.
 * Un elenco senza risposta data risponde una lista vuota, io.mostra zero non lette. Il percorso si confronta intero
 * (`/v1/io` non risponde per `/v1/io/aziende`); un altro percorso non ha risposta, e TestCase ferma la richiesta.
 *
 * @param  array<string, mixed>  $risposte  per percorso («/v1/io/aziende»): un corpo JSON, o una risposta, una sequenza, una closure
 */
function backoffice(array $risposte = []): void
{
    $risposte += ['/v1/io' => ioMostra(0)];
    foreach (['/v1/app', '/v1/io/aziende', '/v1/io/workspace'] as $elenco) {
        $risposte += [$elenco => ['data' => [], 'successivo' => null]];
    }

    Http::fake(function (Request $richiesta) use ($risposte) {
        $risposta = $risposte[parse_url($richiesta->url(), PHP_URL_PATH)] ?? null;

        return match (true) {
            is_array($risposta) => Http::response($risposta),
            $risposta instanceof Closure, $risposta instanceof ResponseSequence => $risposta($richiesta),
            default => $risposta,
        };
    });
}

/**
 * La risposta di io.mostra (GET /v1/io) per la sessione dei test: la persona, il workspace del gettone col suo ruolo lì e le
 * sue notifiche non lette in quel workspace. Col gettone dell'accesso il backoffice dà null a tutti e tre: è `ioMostra(null)`.
 *
 * @return array{data: array<string, mixed>}
 */
function ioMostra(?int $nonLette): array
{
    return ['data' => [
        'utente' => ['id' => 'uat-ada', 'nome' => 'UAT Ada', 'email' => 'uat-ada@example.com', 'email_verificata_il' => now()->toIso8601String(), 'lingua' => 'en', 'fuso_orario' => 'Europe/Rome'],
        'workspace' => $nonLette === null ? null : [...marketing(), 'azienda_id' => 'az-b'],
        'ruolo' => $nonLette === null ? null : 'membro',
        'notifiche_non_lette' => $nonLette,
    ]];
}

/** Le richieste fatte a un percorso di /v1 (il percorso senza la query), nell'ordine in cui sono partite. */
function richiesteA(string $percorso): Collection
{
    return Http::recorded(fn (Request $richiesta) => parse_url($richiesta->url(), PHP_URL_PATH) === $percorso)
        ->map(fn (array $coppia) => $coppia[0]);
}

/**
 * Il workspace in cui entra la sessione dei test: è di «UAT agenzia» (az-b) nelle aziende di aziendeEWorkspace().
 *
 * @return array{id: string, nome: string, slug: string}
 */
function marketing(): array
{
    return ['id' => 'uat-ws', 'nome' => 'UAT Marketing', 'slug' => 'uat-marketing'];
}

/**
 * Le aziende e i workspace di UAT Ada come li dà il backoffice: tutti e due per nome, in collazione (le minuscole non vanno
 * dopo le maiuscole), e i workspace su due pagine: «UAT Vendite», sulla seconda, è di «UAT Studio» come «UAT clienti».
 *
 * @return array<string, mixed> per backoffice()
 */
function aziendeEWorkspace(): array
{
    $workspace = fn (string $id, string $nome, string $slug, string $azienda) => ['id' => $id, 'nome' => $nome, 'slug' => $slug, 'ruolo' => 'membro', 'azienda_id' => $azienda];

    return [
        '/v1/io/aziende' => ['data' => [['id' => 'az-b', 'nome' => 'UAT agenzia'], ['id' => 'az-a', 'nome' => 'UAT Studio']], 'successivo' => null],
        '/v1/io/workspace' => Http::sequence()
            ->push(['data' => [$workspace('uat-ws-1', 'UAT clienti', 'uat-clienti', 'az-a'), $workspace('uat-ws', 'UAT Marketing', 'uat-marketing', 'az-b')], 'successivo' => 'uat-cursore-2'])
            ->push(['data' => [$workspace('uat-ws-3', 'UAT Vendite', 'uat-vendite', 'az-a')], 'successivo' => null]),
    ];
}

it('con la sessione entrata in un workspace dà persona, lingua, il workspace del gettone, lo stato di ogni app, le aziende coi loro workspace, le non lette e il segno (T3.1, T1.1, T1.2; sprint 10 · T1.3)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:05.123456', 'UTC'));
    sessioneAMano(marketing());
    backoffice([
        '/v1/app' => ['data' => [['codice' => 'pm', 'stato' => 'attivo'], ['codice' => 'crm', 'stato' => 'disponibile']], 'successivo' => null],
        '/v1/io' => ioMostra(3),
        ...aziendeEWorkspace(),
    ]);

    // L'indirizzo nomina un altro workspace: conta quello del gettone.
    $this->get('w/un-altro-workspace/cornice')->assertOk()->assertExactJson([
        'lingua' => 'en',
        'persona' => ['nome' => 'UAT Ada', 'email' => 'uat-ada@example.com'],
        'workspace' => ['nome' => 'UAT Marketing', 'slug' => 'uat-marketing'],
        'prodotti' => ['pm' => 'attivo', 'crm' => 'disponibile'],
        'aziende' => [
            ['id' => 'az-b', 'nome' => 'UAT agenzia', 'workspace' => [['nome' => 'UAT Marketing', 'slug' => 'uat-marketing']]],
            ['id' => 'az-a', 'nome' => 'UAT Studio', 'workspace' => [['nome' => 'UAT clienti', 'slug' => 'uat-clienti'], ['nome' => 'UAT Vendite', 'slug' => 'uat-vendite']]],
        ],
        'non_lette' => 3,
        'aggiornati_il' => '2026-10-09T21:31:05.123456Z',
    ]);
});

it('aggiornati_il è l\'istante in cui la lettura comincia, in UTC coi microsecondi, anche con l\'applicazione in un altro fuso (sprint 10 · T1.1)', function () {
    // L'applicazione è a Roma, e lì sono le 23:31: il segno resta in UTC. Testbench rimette il fuso a ogni test.
    config(['app.timezone' => 'Europe/Rome']);
    date_default_timezone_set('Europe/Rome');
    Carbon::setTestNow(Carbon::parse('2026-10-09 23:31:05.123456', 'Europe/Rome'));
    sessioneAMano(marketing());
    // Ogni risposta del backoffice porta l'orologio avanti di un secondo: un segno preso dopo le letture sarebbe più tardi.
    $unSecondoDopo = fn (array $corpo) => function () use ($corpo) {
        Carbon::setTestNow(Carbon::now()->addSecond());

        return Http::response($corpo);
    };
    backoffice([
        '/v1/app' => $unSecondoDopo(['data' => [['codice' => 'pm', 'stato' => 'attivo']], 'successivo' => null]),
        '/v1/io' => $unSecondoDopo(ioMostra(3)),
        '/v1/io/aziende' => $unSecondoDopo(['data' => [], 'successivo' => null]),
        '/v1/io/workspace' => $unSecondoDopo(['data' => [], 'successivo' => null]),
    ]);

    $segno = Cornice::dati()['aggiornati_il'];

    expect($segno)->toBe('2026-10-09T21:31:05.123456Z')
        ->and(strlen($segno))->toBe(27)
        // Le quattro letture sono passate, ognuna col suo secondo: l'orologio è avanti, il segno è di prima.
        ->and(Carbon::now('UTC')->format('Y-m-d\TH:i:s.u\Z'))->toBe('2026-10-09T21:31:09.123456Z');
});

it('due letture in due istanti diversi hanno due aggiornati_il diversi, e quello della seconda è il maggiore (sprint 10 · T1.2)', function (string $prima, string $dopo, string $segnoDiPrima, string $segnoDiDopo) {
    Carbon::setTestNow(Carbon::parse($prima, 'UTC'));
    sessioneAMano(marketing());
    backoffice();

    $laPrima = Cornice::dati()['aggiornati_il'];
    Carbon::setTestNow(Carbon::parse($dopo, 'UTC'));
    $laSeconda = Cornice::dati()['aggiornati_il'];

    // Come stringhe: è così che le confronta chi le riceve.
    expect($laPrima)->toBe($segnoDiPrima)
        ->and($laSeconda)->toBe($segnoDiDopo)
        ->and(strcmp($laSeconda, $laPrima))->toBe(1);
})->with([
    'a un microsecondo' => ['2026-10-09 21:31:05.123456', '2026-10-09 21:31:05.123457', '2026-10-09T21:31:05.123456Z', '2026-10-09T21:31:05.123457Z'],
    'a cavallo del secondo, coi microsecondi a zero' => ['2026-10-09 21:31:05.999999', '2026-10-09 21:31:06.000000', '2026-10-09T21:31:05.999999Z', '2026-10-09T21:31:06.000000Z'],
]);

it('le sei chiavi di prima restano al loro posto, e il segno è l\'ultima (sprint 10 · T1.3)', function () {
    sessioneAMano(marketing());
    backoffice();

    expect(array_keys(Cornice::dati()))->toBe(['lingua', 'persona', 'workspace', 'prodotti', 'aziende', 'non_lette', 'aggiornati_il']);
});

it('lo stato di ogni app è quello di app.elenca, chiesto col gettone del workspace e non con quello dell\'accesso (T3.1)', function () {
    $gettoni = sessioneAMano(marketing());
    backoffice(['/v1/app' => ['data' => [
        ['codice' => 'crm', 'stato' => 'disponibile'],
        ['codice' => 'pm', 'stato' => 'attivo'],
        ['codice' => 'reports', 'stato' => 'in_arrivo'],
    ], 'successivo' => null]]);

    expect(Cornice::dati())->toMatchArray([
        'lingua' => 'en',
        'persona' => ['nome' => 'UAT Ada', 'email' => 'uat-ada@example.com'],
        'workspace' => ['nome' => 'UAT Marketing', 'slug' => 'uat-marketing'],
        'prodotti' => ['crm' => 'disponibile', 'pm' => 'attivo', 'reports' => 'in_arrivo'],
    ]);
    expect(richiesteA('/v1/app'))->toHaveCount(1)
        ->and(richiesteA('/v1/app')->first()->hasHeader('Authorization', 'Bearer '.$gettoni['workspace']))->toBeTrue();
});

it('le aziende sono quelle della persona nell\'ordine del backoffice, ognuna coi suoi workspace per azienda_id nell\'ordine dell\'elenco, lette tutte e due col gettone della persona (T1.1)', function () {
    $gettoni = sessioneAMano(marketing());
    backoffice(aziendeEWorkspace());

    expect(Cornice::dati()['aziende'])->toBe([
        ['id' => 'az-b', 'nome' => 'UAT agenzia', 'workspace' => [['nome' => 'UAT Marketing', 'slug' => 'uat-marketing']]],
        ['id' => 'az-a', 'nome' => 'UAT Studio', 'workspace' => [
            ['nome' => 'UAT clienti', 'slug' => 'uat-clienti'],
            ['nome' => 'UAT Vendite', 'slug' => 'uat-vendite'],
        ]],
    ]);
    expect(richiesteA('/v1/io/aziende'))->toHaveCount(1)
        ->and(richiesteA('/v1/io/workspace'))->toHaveCount(2);
    foreach ([...richiesteA('/v1/io/aziende'), ...richiesteA('/v1/io/workspace')] as $richiesta) {
        expect($richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['accesso']))->toBeTrue();
    }
});

it('non_lette è notifiche_non_lette di io.mostra, chiesto col gettone del workspace con una richiesta sola, senza tagli (sprint 5 · T1.1)', function (int $nonLette) {
    $gettoni = sessioneAMano(marketing());
    // Col gettone dell'accesso io.mostra non ha un workspace, e le non lette sono null.
    backoffice(['/v1/io' => fn (Request $richiesta) => Http::response(
        ioMostra($richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace']) ? $nonLette : null),
    )]);

    expect(Cornice::dati()['non_lette'])->toBe($nonLette);
    // Una richiesta per metodo, e nessun'altra: l'elenco delle notifiche non si chiede più.
    expect(Http::recorded()->map(fn (array $coppia) => parse_url($coppia[0]->url(), PHP_URL_PATH))->sort()->values()->all())
        ->toBe(['/v1/app', '/v1/io', '/v1/io/aziende', '/v1/io/workspace']);
    $richiesta = richiesteA('/v1/io')->first();
    expect($richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace']))->toBeTrue()
        ->and(parse_url($richiesta->url(), PHP_URL_QUERY))->toBeNull();
})->with([0, 7, 250]);

it('se io.mostra non dà un numero di non lette arriva BackofficeNonRisponde, mai uno 0 (sprint 5 · T1.2)', function (int $stato, mixed $corpo) {
    sessioneAMano(marketing());
    backoffice(['/v1/io' => Http::response($corpo, $stato), ...aziendeEWorkspace()]);

    expect(fn () => Cornice::dati())->toThrow(BackofficeNonRisponde::class);
})->with([
    'notifiche_non_lette manca' => [200, ['data' => ['utente' => ['id' => 'uat-ada'], 'workspace' => ['id' => 'uat-ws'], 'ruolo' => 'membro']]],
    'null, come col gettone dell\'accesso' => [200, ['data' => ['notifiche_non_lette' => null]]],
    'una stringa' => [200, ['data' => ['notifiche_non_lette' => '7']]],
    'un decimale' => [200, ['data' => ['notifiche_non_lette' => 7.5]]],
    'un booleano' => [200, ['data' => ['notifiche_non_lette' => true]]],
    'una lista' => [200, ['data' => ['notifiche_non_lette' => [1, 2]]]],
    'negativo' => [200, ['data' => ['notifiche_non_lette' => -1]]],
    'senza data' => [200, ['notifiche_non_lette' => 7]],
    'data non è un oggetto' => [200, ['data' => 7]],
    '500' => [500, ''],
    'senza JSON' => [200, 'uat: non è JSON'],
]);

it('senza sessione, o con la sessione aperta ma senza workspace, dà null e non chiama il backoffice (T3.2)', function () {
    Http::fake();

    expect(Cornice::dati())->toBeNull();

    sessioneAMano(null);

    expect(Sessione::aperta())->toBeTrue()
        ->and(Cornice::dati())->toBeNull();
    Http::assertNothingSent();
});

it('il gettone non arriva alla pagina che riceve i dati della cornice (T3.3)', function () {
    sessioneAMano(marketing());
    backoffice(['/v1/io' => ioMostra(2), ...aziendeEWorkspace()]);

    $risposta = $this->get('w/uat-marketing/cornice')->assertOk();

    expect($risposta->json('persona.email'))->toBe('uat-ada@example.com')
        ->and($risposta->json('aziende'))->toHaveCount(2)
        ->and($risposta->json('non_lette'))->toBe(2);
    Gettone::assenteDa($risposta);
});

it('se il backoffice non risponde l\'errore arriva al frontend, non una lista di app vuota (T3.4)', function () {
    Http::fake(['*' => Http::response('', 500)]);
    sessioneAMano(marketing());

    expect(fn () => Cornice::dati())->toThrow(BackofficeNonRisponde::class);
});

it('se il backoffice non risponde alle aziende o ai workspace arriva BackofficeNonRisponde, non un elenco vuoto (T1.3)', function (string $percorso, int $stato, mixed $corpo) {
    sessioneAMano(marketing());
    backoffice([$percorso => Http::response($corpo, $stato), ...array_diff_key(aziendeEWorkspace(), [$percorso => true])]);

    expect(fn () => Cornice::dati())->toThrow(BackofficeNonRisponde::class);
})->with([
    'aziende, 500' => ['/v1/io/aziende', 500, ''],
    'workspace, 500' => ['/v1/io/workspace', 500, ''],
]);
