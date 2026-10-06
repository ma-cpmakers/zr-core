<?php

use Illuminate\Http\Client\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Zeiras\Auth\Errori\BackofficeNonRisponde;
use Zeiras\Auth\Sessione;
use Zeiras\Auth\Testing\Gettone;
use Zeiras\Core\Cornice;

// Sprint 2 · T3 (voce #1256) e sprint 3 · T1 (voce #1277). La parte server della cornice: Cornice::dati() dà alla pagina del
// frontend la persona, la sua lingua, il workspace in cui è entrata, lo stato delle app in quel workspace, le aziende della
// persona coi loro workspace e le notifiche non lette nel workspace, dalla sessione di zr-auth e dal backoffice. Il backoffice
// è Http::fake (backoffice() qui sotto), mai il finto di zr-auth 0.3: non conosce aziende e notifiche (RichiestaSconosciuta),
// e in Http::fake ogni callback gira, anche dopo uno che ha risposto. Nessuna richiesta esce (TestCase). La pagina di prova è
// `w/{slug}/cornice` di TestCase, nel gruppo `web`.

/**
 * Il backoffice in Http::fake, un metodo di /v1 alla volta: app.elenca, io.aziende.elenca, io.workspace.elenca e
 * io.notifiche.elenca. Un percorso senza risposta data risponde una lista vuota.
 *
 * @param  array<string, mixed>  $risposte  per percorso («/v1/io/aziende»): un corpo JSON, o una risposta, una sequenza, una closure
 */
function backoffice(array $risposte = []): void
{
    $stub = [];
    foreach (['/v1/app', '/v1/io/aziende', '/v1/io/workspace', '/v1/io/notifiche'] as $percorso) {
        $risposta = $risposte[$percorso] ?? ['data' => [], 'successivo' => null];
        $stub["*{$percorso}*"] = is_array($risposta) ? Http::response($risposta) : $risposta;
    }
    Http::fake($stub);
}

/**
 * Notifiche non lette nella forma di io.notifiche.elenca (bozza di zr-backoffice, #1260), dalla più recente.
 *
 * @return list<array<string, mixed>>
 */
function notifiche(int $quante): array
{
    return array_map(fn (int $i) => [
        'id' => "uat-notifica-{$i}", 'creata_il' => now()->subMinutes($i)->toIso8601String(), 'letta_il' => null,
        'per_me' => $i % 2 === 0, 'motivo' => 'uat', 'app' => 'pm', 'autore_id' => null, 'soggetto' => "uat-soggetto-{$i}",
        'workspace_id' => 'uat-ws',
    ], $quante > 0 ? range(1, $quante) : []);
}

/** Le richieste fatte a un percorso di /v1 (il percorso senza la query), nell'ordine in cui sono partite. */
function richiesteA(string $percorso): Collection
{
    return Http::recorded(fn (Request $richiesta) => parse_url($richiesta->url(), PHP_URL_PATH) === $percorso)
        ->map(fn (array $coppia) => $coppia[0]);
}

/**
 * Una sessione fatta a mano, senza il finto: l'accesso e, se c'è, il workspace, coi dati di accessi.crea e gettoni.crea.
 *
 * @param  array{id: string, nome: string, slug: string}|null  $workspace
 * @return array{accesso: string, workspace: string} i due gettoni
 */
function sessioneAMano(?array $workspace): array
{
    $utente = ['id' => 'uat-ada', 'nome' => 'UAT Ada', 'email' => 'uat-ada@example.com', 'email_verificata_il' => now()->toIso8601String(), 'lingua' => 'en', 'fuso_orario' => 'Europe/Rome'];
    $gettoni = ['accesso' => 'zr_'.Str::random(48), 'workspace' => 'zr_'.Str::random(48)];
    $scade = now()->addHour()->toIso8601String();
    Sessione::apri(['id' => 'uat-accesso', 'gettone' => ['gettone' => $gettoni['accesso'], 'scade_il' => $scade, 'utente' => $utente]]);
    if ($workspace !== null) {
        Sessione::entra(['gettone' => $gettoni['workspace'], 'scade_il' => $scade, 'utente' => $utente, 'workspace' => $workspace, 'ruolo' => 'membro']);
    }

    return $gettoni;
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

it('con la sessione entrata in un workspace dà persona, lingua, il workspace del gettone, lo stato di ogni app, le aziende coi loro workspace e le non lette (T3.1, T1.1, T1.2)', function () {
    sessioneAMano(marketing());
    backoffice([
        '/v1/app' => ['data' => [['codice' => 'pm', 'stato' => 'attivo'], ['codice' => 'crm', 'stato' => 'disponibile']], 'successivo' => null],
        '/v1/io/notifiche' => ['data' => notifiche(3), 'successivo' => null],
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
    ]);
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

it('non_lette è il numero delle non lette del workspace del gettone, da una richiesta sola con letta=false e limite=100 (T1.2)', function (int $nonLette) {
    $gettoni = sessioneAMano(marketing());
    // Col gettone dell'accesso il backoffice darebbe le notifiche di tutti i workspace della persona.
    backoffice(['/v1/io/notifiche' => fn (Request $richiesta) => Http::response([
        'data' => notifiche($richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace']) ? $nonLette : 12),
        'successivo' => null,
    ])]);

    expect(Cornice::dati()['non_lette'])->toBe($nonLette);
    expect(richiesteA('/v1/io/notifiche'))->toHaveCount(1);
    $richiesta = richiesteA('/v1/io/notifiche')->first();
    parse_str((string) parse_url($richiesta->url(), PHP_URL_QUERY), $query);
    expect($query)->toEqual(['letta' => 'false', 'limite' => '100'])
        ->and($richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace']))->toBeTrue();
})->with([0, 7]);

it('con 100 non lette o più non_lette è 100, da una pagina sola: il cursore non si segue (T1.2)', function () {
    sessioneAMano(marketing());
    backoffice(['/v1/io/notifiche' => Http::sequence()
        ->push(['data' => notifiche(100), 'successivo' => 'uat-cursore-2'])
        ->push(['data' => notifiche(30), 'successivo' => null])]);

    expect(Cornice::dati()['non_lette'])->toBe(100)
        ->and(richiesteA('/v1/io/notifiche'))->toHaveCount(1);
});

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
    backoffice(['/v1/io/notifiche' => ['data' => notifiche(2), 'successivo' => null], ...aziendeEWorkspace()]);

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

it('se il backoffice non risponde alle aziende, ai workspace o alle notifiche arriva BackofficeNonRisponde, non un elenco vuoto o uno 0 (T1.3)', function (string $percorso, int $stato, mixed $corpo) {
    sessioneAMano(marketing());
    backoffice([$percorso => Http::response($corpo, $stato), ...array_diff_key(aziendeEWorkspace(), [$percorso => true])]);

    expect(fn () => Cornice::dati())->toThrow(BackofficeNonRisponde::class);
})->with([
    'aziende, 500' => ['/v1/io/aziende', 500, ''],
    'workspace, 500' => ['/v1/io/workspace', 500, ''],
    'notifiche, 500' => ['/v1/io/notifiche', 500, ''],
    'notifiche, 200 senza una lista' => ['/v1/io/notifiche', 200, ['notifiche' => []]],
]);
