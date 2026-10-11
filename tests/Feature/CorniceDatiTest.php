<?php

use Illuminate\Http\Client\Request;
use Illuminate\Http\Client\ResponseSequence;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Monolog\Handler\TestHandler;
use Monolog\Level;
use Zeiras\Auth\Errori\BackofficeNonRisponde;
use Zeiras\Auth\Errori\ErroreApi;
use Zeiras\Auth\Errori\GettoneRifiutato;
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

/**
 * I dati che la cornice dà alla sessione dei test entrata in «UAT Marketing», col backoffice di aziendeEWorkspace(), due app e
 * tre non lette: tutti e sette i campi, con ciò che un caso si aspetta diverso al posto suo.
 *
 * @param  array<string, mixed>  $cambi
 * @return array<string, mixed>
 */
function datiAttesi(string $aggiornatiIl, array $cambi = []): array
{
    return [
        'lingua' => 'en',
        'persona' => ['nome' => 'UAT Ada', 'email' => 'uat-ada@example.com'],
        'workspace' => ['nome' => 'UAT Marketing', 'slug' => 'uat-marketing'],
        'prodotti' => ['pm' => 'attivo', 'crm' => 'disponibile'],
        'aziende' => [
            ['id' => 'az-b', 'nome' => 'UAT agenzia', 'workspace' => [['id' => 'uat-ws', 'nome' => 'UAT Marketing', 'slug' => 'uat-marketing']], 'nuovo_workspace' => false],
            ['id' => 'az-a', 'nome' => 'UAT Studio', 'workspace' => [
                ['id' => 'uat-ws-1', 'nome' => 'UAT clienti', 'slug' => 'uat-clienti'],
                ['id' => 'uat-ws-3', 'nome' => 'UAT Vendite', 'slug' => 'uat-vendite'],
            ], 'nuovo_workspace' => false],
        ],
        'non_lette' => 3,
        'aggiornati_il' => $aggiornatiIl,
        ...$cambi,
    ];
}

it('con la sessione entrata in un workspace dà persona, lingua, il workspace del gettone, lo stato di ogni app, le aziende coi loro workspace, le non lette e il segno (sprint 2 · T3.1; sprint 3 · T1.1, T1.2; sprint 10 · T1.3)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:05.123456', 'UTC'));
    sessioneAMano(marketing());
    backoffice([
        '/v1/app' => ['data' => [['codice' => 'pm', 'stato' => 'attivo'], ['codice' => 'crm', 'stato' => 'disponibile']], 'successivo' => null],
        '/v1/io' => ioMostra(3),
        ...aziendeEWorkspace(),
    ]);

    // L'indirizzo nomina un altro workspace: conta quello del gettone.
    $this->get('w/un-altro-workspace/cornice')->assertOk()->assertExactJson(datiAttesi('2026-10-09T21:31:05.123456Z'));
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

    // Come stringhe: è così che il segno si ordina, ed è così che la cornice lo confronta nel browser (`segno()` in servizi.ts).
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

it('le non lette si contano per prime, subito dopo il segno: fra il segno e il numero non passa un\'altra lettura (sprint 11 · review R3)', function () {
    sessioneAMano(marketing());
    backoffice(['/v1/io' => ioMostra(3), ...aziendeEWorkspace()]);

    Cornice::dati();

    // Il numero è il dato che la cornice confronta col segno: contato per ultimo sarebbe più fresco del suo segno di tre letture.
    expect(Http::recorded()->map(fn (array $coppia) => parse_url($coppia[0]->url(), PHP_URL_PATH))->first())->toBe('/v1/io');
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
        ['id' => 'az-b', 'nome' => 'UAT agenzia', 'workspace' => [['id' => 'uat-ws', 'nome' => 'UAT Marketing', 'slug' => 'uat-marketing']], 'nuovo_workspace' => false],
        ['id' => 'az-a', 'nome' => 'UAT Studio', 'workspace' => [
            ['id' => 'uat-ws-1', 'nome' => 'UAT clienti', 'slug' => 'uat-clienti'],
            ['id' => 'uat-ws-3', 'nome' => 'UAT Vendite', 'slug' => 'uat-vendite'],
        ], 'nuovo_workspace' => false],
    ]);
    expect(richiesteA('/v1/io/aziende'))->toHaveCount(1)
        ->and(richiesteA('/v1/io/workspace'))->toHaveCount(2);
    foreach ([...richiesteA('/v1/io/aziende'), ...richiesteA('/v1/io/workspace')] as $richiesta) {
        expect($richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['accesso']))->toBeTrue();
    }
});

// Sprint 17 · T4 (voce #1633). Ogni workspace esce col suo `id`, quello di io.workspace.elenca: è da lì che la cornice ricava
// il tono del suo pallino nel selettore. Della riga del backoffice non esce altro (`ruolo` e `azienda_id` no), e per l'id non
// parte nessuna lettura in più: sta nella riga che la cornice legge già.
it('ogni workspace delle aziende porta il suo id, quello di io.workspace.elenca, con nome e slug e nient\'altro della riga; le letture del backoffice sono quelle di prima (sprint 17 · T4.3)', function () {
    sessioneAMano(marketing());
    backoffice(['/v1/io' => ioMostra(3), ...aziendeEWorkspace()]);

    $workspace = collect(Cornice::dati()['aziende'])->flatMap(fn (array $azienda) => $azienda['workspace'])->all();

    expect($workspace)->toBe([
        ['id' => 'uat-ws', 'nome' => 'UAT Marketing', 'slug' => 'uat-marketing'],
        ['id' => 'uat-ws-1', 'nome' => 'UAT clienti', 'slug' => 'uat-clienti'],
        ['id' => 'uat-ws-3', 'nome' => 'UAT Vendite', 'slug' => 'uat-vendite'],
    ]);
    // Una richiesta per metodo, due per i workspace (le due pagine dell'elenco), e nessun'altra.
    expect(Http::recorded()->map(fn (array $coppia) => parse_url($coppia[0]->url(), PHP_URL_PATH))->sort()->values()->all())
        ->toBe(['/v1/app', '/v1/io', '/v1/io/aziende', '/v1/io/workspace', '/v1/io/workspace']);
});

// Sprint 19 · T1 (voce #1669). Ogni azienda dice se la persona può crearvi un workspace (`nuovo_workspace`): la cornice lo
// ricava dal `ruolo` che io.workspace.elenca dà riga per riga, dentro la stessa azienda. Aprono solo `proprietario` e
// `amministratore`, i ruoli a cui il backoffice lascia creare un workspace (io.workspace.crea): ogni altro valore, anche uno
// nuovo, vale «no». Al browser arriva il booleano, dopo `workspace`: di un workspace escono ancora solo id, nome e slug, e per
// saperlo non parte nessuna lettura in più, perché il ruolo sta nella riga che la cornice legge già.

/**
 * Il backoffice con quelle aziende e quei workspace, per backoffice(): di ogni workspace l'azienda e il `ruolo` della persona,
 * e la riga com'è nel contratto. Il workspace al posto 0 è `uat-ws-0`, e così via; una riga senza il secondo valore non ha `ruolo`.
 *
 * @param  list<string>  $aziende  gli id, nell'ordine di io.aziende.elenca
 * @param  list<array{0: string, 1?: mixed}>  $workspace  per ogni riga di io.workspace.elenca: l'azienda, e il ruolo se c'è
 * @return array<string, mixed>
 */
function aziendeCoiRuoli(array $aziende, array $workspace): array
{
    return [
        '/v1/io/aziende' => ['data' => array_map(fn (string $id) => ['id' => $id, 'nome' => "UAT {$id}"], $aziende), 'successivo' => null],
        '/v1/io/workspace' => ['data' => array_map(
            fn (array $riga, int $posto) => [...workspaceAlPosto($posto), ...(array_key_exists(1, $riga) ? ['ruolo' => $riga[1]] : []), 'azienda_id' => $riga[0]],
            $workspace,
            array_keys($workspace),
        ), 'successivo' => null],
    ];
}

/**
 * Ciò che di un workspace di aziendeCoiRuoli() esce nei dati: id, nome e slug, e nient'altro.
 *
 * @return array{id: string, nome: string, slug: string}
 */
function workspaceAlPosto(int $posto): array
{
    return ['id' => "uat-ws-{$posto}", 'nome' => "UAT workspace {$posto}", 'slug' => "uat-ws-{$posto}"];
}

it('un\'azienda dice che la persona può creare un workspace solo se in una sua riga di io.workspace.elenca il ruolo è proprietario o amministratore; il booleano sta dopo i workspace, che restano id, nome e slug (sprint 19 · T1.1)', function (array $ruoli, bool $puo) {
    sessioneAMano(marketing());
    backoffice(aziendeCoiRuoli(['az-a'], array_map(fn (array $ruolo) => ['az-a', ...$ruolo], $ruoli)));

    expect(Cornice::dati()['aziende'])->toBe([
        ['id' => 'az-a', 'nome' => 'UAT az-a', 'workspace' => array_map(workspaceAlPosto(...), array_keys($ruoli)), 'nuovo_workspace' => $puo],
    ]);
})->with([
    'proprietario' => [[['proprietario']], true],
    'amministratore' => [[['amministratore']], true],
    'membro' => [[['membro']], false],
    'un ruolo che zr-core non conosce' => [[['ospite']], false],
    'un ruolo scritto in un altro modo' => [[['Proprietario']], false],
    'una riga senza ruolo' => [[[]], false],
    'un ruolo null' => [[[null]], false],
    // Con un confronto largo `true` sarebbe uguale a ogni testo non vuoto.
    'un ruolo che è true' => [[[true]], false],
    'un ruolo che è una lista' => [[[['proprietario']]], false],
    'nessun workspace' => [[], false],
    'membro e poi amministratore' => [[['membro'], ['amministratore']], true],
    'proprietario e poi membro' => [[['proprietario'], ['membro']], true],
    'membro, membro e un ruolo che zr-core non conosce' => [[['membro'], ['membro'], ['ospite']], false],
]);

it('il ruolo vale dentro la sua azienda: non passa a un\'altra, e quello di un workspace di un\'azienda che l\'elenco non ha non apre niente; le letture del backoffice restano quattro (sprint 19 · T1.1)', function () {
    sessioneAMano(marketing());
    // «az-z» non è fra le aziende della persona: il suo workspace resta fuori, col suo ruolo.
    backoffice(['/v1/io' => ioMostra(3), ...aziendeCoiRuoli(['az-b', 'az-a', 'az-c'], [['az-a', 'proprietario'], ['az-b', 'membro'], ['az-z', 'amministratore'], ['az-b', 'ospite']])]);

    expect(Cornice::dati()['aziende'])->toBe([
        ['id' => 'az-b', 'nome' => 'UAT az-b', 'workspace' => [workspaceAlPosto(1), workspaceAlPosto(3)], 'nuovo_workspace' => false],
        ['id' => 'az-a', 'nome' => 'UAT az-a', 'workspace' => [workspaceAlPosto(0)], 'nuovo_workspace' => true],
        ['id' => 'az-c', 'nome' => 'UAT az-c', 'workspace' => [], 'nuovo_workspace' => false],
    ]);
    // Una richiesta per metodo, e nessun'altra: sono le letture della v1.8.0.
    expect(Http::recorded()->map(fn (array $coppia) => parse_url($coppia[0]->url(), PHP_URL_PATH))->sort()->values()->all())
        ->toBe(['/v1/app', '/v1/io', '/v1/io/aziende', '/v1/io/workspace']);
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

/**
 * Le risposte di io.mostra senza un numero valido di non lette che hanno dove portare una persona, per nome: lo stato e il
 * corpo, con la persona data. L'elenco è uno, per il caso che guarda l'eccezione (sprint 5) e per quello che guarda la sessione
 * (sprint 13 · T2.6): un guasto nuovo di `ioMostra()` entra qui. Le risposte che una persona non possono portarla stanno solo
 * nel caso dello sprint 5: sulla sessione non direbbero niente.
 *
 * @param  array<string, mixed>  $utente
 * @return array<string, array{int, mixed}>
 */
function ioMostraGuaste(array $utente = ['id' => 'uat-ada']): array
{
    return [
        'notifiche_non_lette manca' => [200, ['data' => ['utente' => $utente, 'workspace' => ['id' => 'uat-ws'], 'ruolo' => 'membro']]],
        'null, come col gettone dell\'accesso' => [200, ['data' => ['utente' => $utente, 'workspace' => null, 'ruolo' => null, 'notifiche_non_lette' => null]]],
        'una stringa' => [200, ['data' => ['utente' => $utente, 'notifiche_non_lette' => '7']]],
        'un decimale' => [200, ['data' => ['utente' => $utente, 'notifiche_non_lette' => 7.5]]],
        'un booleano' => [200, ['data' => ['utente' => $utente, 'notifiche_non_lette' => true]]],
        'una lista' => [200, ['data' => ['utente' => $utente, 'notifiche_non_lette' => [1, 2]]]],
        'negativo' => [200, ['data' => ['utente' => $utente, 'notifiche_non_lette' => -1]]],
        'senza data, con la persona e il numero in cima' => [200, ['utente' => $utente, 'notifiche_non_lette' => 7]],
    ];
}

it('se io.mostra non dà un numero di non lette arriva BackofficeNonRisponde, mai uno 0 (sprint 5 · T1.2)', function (int $stato, mixed $corpo) {
    sessioneAMano(marketing());
    backoffice(['/v1/io' => Http::response($corpo, $stato), ...aziendeEWorkspace()]);

    expect(fn () => Cornice::dati())->toThrow(BackofficeNonRisponde::class);
})->with([
    ...ioMostraGuaste(),
    // Queste non hanno dove portare una persona.
    'data non è un oggetto' => [200, ['data' => 7]],
    '500' => [500, ''],
    'senza JSON' => [200, 'uat: non è JSON'],
]);

it('senza sessione, o con la sessione aperta ma senza workspace, dà null, non chiama il backoffice e lascia la sessione com\'è (T3.2; sprint 13 · T2.6)', function () {
    // Se la cornice leggesse io.mostra ci troverebbe una lingua e un nome nuovi, e li metterebbe nella sessione.
    backoffice(['/v1/io' => ioMostraCon(['lingua' => 'es', 'nome' => 'UAT Ada Lovelace'])]);

    expect(Cornice::dati())->toBeNull();

    sessioneAMano(null);
    $prima = session(Sessione::CHIAVE);

    expect(Sessione::aperta())->toBeTrue()
        ->and(Cornice::dati())->toBeNull()
        ->and(session(Sessione::CHIAVE))->toBe($prima);
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

// Sprint 13 · T2 (voce #1480): la lingua e il nome cambiati nel profilo arrivano ai moduli senza uscire e rientrare. A ogni
// lettura la cornice dà a Sessione::aggiorna di zr-auth (dalla 0.12) la risposta di io.mostra che ha già letto per le non
// lette: la sessione prende la lingua e il nome del profilo, e i dati della cornice li portano da quella stessa richiesta.
// Solo quei due, e solo come li accetta zr-auth; nessuna lettura in più. La pagina `w/{slug}/sessione` di TestCase dà la
// persona della sessione senza chiamare la cornice.

/**
 * io.mostra dopo un cambio nel profilo: la persona dei test con questi campi al posto dei suoi, e senza quelli di `$senza`,
 * che la risposta non porta affatto. Un valore che non è una lista di campi va al posto della persona intera, com'è: un
 * backoffice che sbaglia.
 *
 * @param  list<string>  $senza
 * @return array{data: array<string, mixed>}
 */
function ioMostraCon(mixed $utente, int $nonLette = 3, array $senza = []): array
{
    $io = ioMostra($nonLette);
    $io['data']['utente'] = is_array($utente) ? array_diff_key([...$io['data']['utente'], ...$utente], array_flip($senza)) : $utente;

    return $io;
}

/**
 * UAT Ada come la porta io.mostra dopo un cambio nel profilo, con un'altra lingua e un altro nome: per le risposte guaste, che
 * si scrivono intere.
 *
 * @return array<string, mixed>
 */
function adaCambiata(): array
{
    return ['id' => 'uat-ada', 'nome' => 'UAT Ada Lovelace', 'email' => 'uat-ada@example.com', 'lingua' => 'es', 'fuso_orario' => 'Europe/Rome'];
}

it('la lingua e il nome che io.mostra dà diversi da quelli della sessione sono nei dati di quella stessa lettura, e il resto è quello della sessione (sprint 13 · T2.1)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-10 09:40:00.000001', 'UTC'));
    sessioneAMano(marketing());
    // Nel profilo sono cambiati la lingua e il nome. io.mostra dà anche un'altra email e un altro nome del workspace: non
    // sono cose che la cornice prende da lì, e restano quelle della sessione.
    $io = ioMostraCon(['lingua' => 'es', 'nome' => 'UAT Ada Lovelace', 'email' => 'uat-ada-nuova@example.com']);
    $io['data']['workspace'] = ['id' => 'uat-ws', 'nome' => 'UAT Marketing rinominato', 'slug' => 'uat-marketing-rinominato', 'azienda_id' => 'az-b'];
    backoffice([
        '/v1/app' => ['data' => [['codice' => 'pm', 'stato' => 'attivo'], ['codice' => 'crm', 'stato' => 'disponibile']], 'successivo' => null],
        '/v1/io' => $io,
        ...aziendeEWorkspace(),
    ]);

    // Gli stessi dati del primo caso, con la lingua e il nome nuovi: l'email e il workspace sono ancora quelli della sessione.
    $this->get('w/un-altro-workspace/cornice')->assertOk()->assertExactJson(datiAttesi('2026-10-10T09:40:00.000001Z', [
        'lingua' => 'es',
        'persona' => ['nome' => 'UAT Ada Lovelace', 'email' => 'uat-ada@example.com'],
    ]));
});

it('alla richiesta dopo una pagina che legge la sessione senza chiamare la cornice trova la lingua e il nome nuovi, e il backoffice non è chiamato (sprint 13 · T2.2)', function () {
    sessioneAMano(marketing());
    backoffice(['/v1/io' => ioMostraCon(['lingua' => 'es', 'nome' => 'UAT Ada Lovelace'])]);

    $this->get('w/uat-marketing/cornice')->assertOk();
    expect(Http::recorded())->toHaveCount(4);

    // La pagina dopo non chiama Cornice::dati(): legge la persona dalla sessione, come un middleware che ne prende la lingua.
    // Le due richieste di un test hanno la stessa sessione in memoria: il caso diventa rosso se la cornice non scrive nella
    // sessione, ma non prova il passaggio dal gestore della sessione fra una richiesta e l'altra, che è di `StartSession` di
    // Laravel (review, R5).
    $dopo = $this->get('w/uat-marketing/sessione')->assertOk();

    expect($dopo->json('lingua'))->toBe('es')
        ->and($dopo->json('nome'))->toBe('UAT Ada Lovelace')
        ->and($dopo->json('id'))->toBe('uat-ada')
        ->and(Http::recorded())->toHaveCount(4);
    Gettone::assenteDa($dopo);
});

it('per rimettere la lingua e il nome la cornice non legge niente in più: le quattro letture di prima, una volta ognuna e coi gettoni di prima (sprint 13 · T2.3)', function () {
    $gettoni = sessioneAMano(marketing());
    backoffice(['/v1/io' => ioMostraCon(['lingua' => 'es', 'nome' => 'UAT Ada Lovelace'])]);

    Cornice::dati();

    // io.mostra una volta sola, col gettone del workspace: la lettura che conta le non lette porta già la persona.
    expect(Http::recorded()->map(fn (array $coppia) => parse_url($coppia[0]->url(), PHP_URL_PATH))->sort()->values()->all())
        ->toBe(['/v1/app', '/v1/io', '/v1/io/aziende', '/v1/io/workspace']);
    foreach (['/v1/io' => 'workspace', '/v1/app' => 'workspace', '/v1/io/aziende' => 'accesso', '/v1/io/workspace' => 'accesso'] as $percorso => $gettone) {
        expect(richiesteA($percorso)->first()->hasHeader('Authorization', 'Bearer '.$gettoni[$gettone]))->toBeTrue();
    }
});

it('della sessione cambiano solo la lingua e il nome: gettoni, id, email, fuso, workspace e ruolo restano quelli dell\'ingresso, anche se io.mostra li dà diversi (sprint 13 · T2.4)', function () {
    sessioneAMano(marketing());
    $prima = session(Sessione::CHIAVE);
    $io = ioMostraCon(['lingua' => 'es', 'nome' => 'UAT Ada Lovelace', 'email' => 'uat-ada-nuova@example.com', 'email_verificata_il' => null, 'fuso_orario' => 'America/Lima']);
    $io['data']['workspace'] = ['id' => 'uat-ws-3', 'nome' => 'UAT Vendite', 'slug' => 'uat-vendite', 'azienda_id' => 'az-a'];
    $io['data']['ruolo'] = 'proprietario';
    backoffice(['/v1/io' => $io]);

    $risposta = $this->get('w/uat-marketing/cornice')->assertOk();

    // La sessione di prima, coi due soli campi che zr-auth rimette: ogni altra differenza è un campo che non doveva cambiare.
    $attesa = $prima;
    $attesa['utente']['lingua'] = 'es';
    $attesa['utente']['nome'] = 'UAT Ada Lovelace';

    expect(session(Sessione::CHIAVE))->toBe($attesa)
        ->and($risposta->json('persona.email'))->toBe('uat-ada@example.com')
        ->and($risposta->json('workspace'))->toBe(['nome' => 'UAT Marketing', 'slug' => 'uat-marketing']);
});

it('ciò che non vale non entra: i dati di un\'altra persona o senza il suo id, una lingua o un nome che non sono una stringa con qualcosa dentro, gli stessi valori (sprint 13 · T2.5; review, R1 e S1)', function (mixed $utente, string $lingua, string $nome, array $senza = []) {
    sessioneAMano(marketing());
    $prima = session(Sessione::CHIAVE);
    backoffice(['/v1/io' => ioMostraCon($utente, senza: $senza)]);

    $risposta = $this->get('w/uat-marketing/cornice')->assertOk();

    // I dati dicono ciò che dice la sessione, e la sessione ciò che zr-auth ha accettato: il campo che non vale resta com'era.
    $attesa = $prima;
    $attesa['utente']['lingua'] = $lingua;
    $attesa['utente']['nome'] = $nome;

    expect([$risposta->json('lingua'), $risposta->json('persona.nome')])->toBe([$lingua, $nome])
        ->and(session(Sessione::CHIAVE))->toBe($attesa);
})->with([
    // (a) i dati di un'altra persona non entrano, nemmeno in parte
    'un\'altra persona' => [['id' => 'uat-grace', 'lingua' => 'es', 'nome' => 'UAT Grace Hopper'], 'en', 'UAT Ada'],
    // e nemmeno quelli che non dicono di chi sono. Queste due righe sono il motivo per cui la 0.12.0 di zr-auth non basta: con quella
    // sarebbero rosse, perché la sua `Sessione::aggiorna` scartava solo un id diverso.
    'la persona con l\'id null' => [['id' => null, 'lingua' => 'es', 'nome' => 'UAT Ada Lovelace'], 'en', 'UAT Ada'],
    'la persona senza id' => [['lingua' => 'es', 'nome' => 'UAT Ada Lovelace'], 'en', 'UAT Ada', ['id']],
    // (b) il campo che non vale resta, e l'altro cambia
    'la lingua vuota' => [['lingua' => '', 'nome' => 'UAT Ada Lovelace'], 'en', 'UAT Ada Lovelace'],
    'la lingua di soli spazi' => [['lingua' => "  \t ", 'nome' => 'UAT Ada Lovelace'], 'en', 'UAT Ada Lovelace'],
    'la lingua null' => [['lingua' => null, 'nome' => 'UAT Ada Lovelace'], 'en', 'UAT Ada Lovelace'],
    'la lingua un numero' => [['lingua' => 7, 'nome' => 'UAT Ada Lovelace'], 'en', 'UAT Ada Lovelace'],
    'la lingua una lista' => [['lingua' => ['es'], 'nome' => 'UAT Ada Lovelace'], 'en', 'UAT Ada Lovelace'],
    'il nome vuoto' => [['lingua' => 'es', 'nome' => ''], 'es', 'UAT Ada'],
    'il nome di soli spazi' => [['lingua' => 'es', 'nome' => '   '], 'es', 'UAT Ada'],
    'il nome null' => [['lingua' => 'es', 'nome' => null], 'es', 'UAT Ada'],
    'il nome un numero' => [['lingua' => 'es', 'nome' => 7], 'es', 'UAT Ada'],
    'il nome una lista' => [['lingua' => 'es', 'nome' => ['UAT Ada Lovelace']], 'es', 'UAT Ada'],
    // (c) a valori uguali la sessione è la stessa
    'gli stessi valori' => [[], 'en', 'UAT Ada'],
    // un backoffice che sbaglia la persona: niente entra, e la lettura non si rompe
    'la persona non è un oggetto' => ['uat: non è un oggetto', 'en', 'UAT Ada'],
    'la persona null' => [null, 'en', 'UAT Ada'],
]);

// Le risposte guaste del caso dello sprint 5 che possono portare una persona, con la persona cambiata: ognuna diventa rossa se
// un guasto aggiorna la sessione. Il caso senza una sessione entrata in un workspace è più su, con «T3.2»: lì la cornice non
// legge io.mostra, e la sessione resta com'è.
it('un io.mostra senza un numero valido di non lette resta un guasto e non tocca la sessione, anche se porta una lingua e un nome nuovi (sprint 13 · T2.6)', function (int $stato, mixed $corpo) {
    sessioneAMano(marketing());
    $prima = session(Sessione::CHIAVE);
    backoffice(['/v1/io' => Http::response($corpo, $stato), ...aziendeEWorkspace()]);

    expect(fn () => Cornice::dati())->toThrow(BackofficeNonRisponde::class)
        ->and(session(Sessione::CHIAVE))->toBe($prima);
})->with(ioMostraGuaste(adaCambiata()));

// Questo caso non distingue il ripiego `?? $utente` di Cornice::dati() (review, R4): con la sessione scaduta la lettura dopo
// lancia prima che la persona serva, e il caso è verde anche senza. Prova che una sessione che scade a metà resta un
// GettoneRifiutato, come prima dello sprint 13, e che la cornice si ferma lì.
it('se la sessione scade mentre la cornice legge io.mostra arriva GettoneRifiutato di zr-auth dalla lettura dopo, come prima, e la cornice non ne fa altre: una richiesta sola (sprint 13 · T2; review, R4)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-10 10:00:00', 'UTC'));
    sessioneAMano(marketing());
    // La sessione dei test scade fra un'ora, e la risposta di io.mostra arriva due ore dopo: da lì zr-auth non dà più né la
    // persona né il gettone.
    backoffice(['/v1/io' => function () {
        Carbon::setTestNow(Carbon::now()->addHours(2));

        return Http::response(ioMostraCon(['lingua' => 'es', 'nome' => 'UAT Ada Lovelace']));
    }]);

    expect(fn () => Cornice::dati())->toThrow(GettoneRifiutato::class)
        ->and(Http::recorded())->toHaveCount(1);
});

// Sprint 18 · T2 (voce #1624): la lingua della pagina in una riga. `Cornice::lingua()` dà al modulo la lingua della persona già
// aggiornata dal profilo, prima del controller: legge io.mostra, lo dà a Sessione::aggiorna e risponde con la lingua della
// sessione. La lettura è una per richiesta: una `Cornice::dati()` nella stessa richiesta la usa, col suo segno, invece di
// rifarla, e la riga usa quella di una `Cornice::dati()` venuta prima; due `Cornice::dati()` rileggono tutto, come prima. La
// lettura tenuta è di quella richiesta, di quella persona e di quel workspace. Dove un caso chiama la cornice più volte senza
// una richiesta HTTP, la richiesta è quella del container, la stessa per tutto il test: come un middleware e poi la pagina.

/**
 * La pagina di un modulo che mette la lingua con la riga in un middleware, prima del controller, e poi dà i dati della
 * cornice: nel gruppo `web`, come `w/{slug}/cornice` di TestCase. Risponde con la lingua che il controller ha trovato
 * nell'applicazione e coi dati della cornice.
 */
function paginaConLaRiga(): void
{
    // Un middleware scritto qui si dà alla rotta per nome: una closure fra i middleware di una rotta non è ammessa.
    Route::aliasMiddleware('la-riga', function ($richiesta, Closure $next) {
        App::setLocale(Cornice::lingua() ?? 'nessuna');

        return $next($richiesta);
    });
    Route::middleware(['web', 'la-riga'])->get('w/{slug}/pagina', fn () => ['lingua_della_pagina' => App::getLocale(), 'cornice' => Cornice::dati()]);
}

/**
 * La riga e poi i dati della cornice, nella stessa richiesta: la lingua che la riga dà, e l'errore che `Cornice::dati()`
 * lancia dopo (null se non lancia).
 *
 * @return array{lingua: ?string, errore: ?Throwable}
 */
function laRigaEPoiIDati(): array
{
    $lingua = Cornice::lingua();

    try {
        Cornice::dati();
    } catch (Throwable $errore) {
        return ['lingua' => $lingua, 'errore' => $errore];
    }

    return ['lingua' => $lingua, 'errore' => null];
}

/** Il log dell'app in memoria, per i casi che guardano l'avviso della riga: un canale vero di Laravel, con un registro di Monolog. */
function logDellaRiga(): void
{
    config(['logging.default' => 'della-riga', 'logging.channels.della-riga' => ['driver' => 'monolog', 'handler' => TestHandler::class]]);
}

/** @return list<string> le righe d'avviso scritte in quel log, nell'ordine */
function avvisiDellaRiga(): array
{
    $righe = [];
    foreach (Log::channel('della-riga')->getLogger()->getHandlers()[0]->getRecords() as $riga) {
        if ($riga->level === Level::Warning) {
            $righe[] = $riga->message;
        }
    }

    return $righe;
}

it('dopo un cambio di lingua nel profilo la riga dà già la lingua nuova al middleware, prima del controller; i dati della cornice di quella richiesta e la sessione hanno la stessa (sprint 18 · T2.1)', function () {
    sessioneAMano(marketing());
    // La sessione è entrata in italiano, e poi nel profilo la persona ha scelto l'inglese: io.mostra dà `en`.
    Sessione::aggiorna(['utente' => ['id' => 'uat-ada', 'lingua' => 'it']]);
    backoffice(['/v1/io' => ioMostra(3), ...aziendeEWorkspace()]);
    paginaConLaRiga();

    expect(Sessione::utente()['lingua'])->toBe('it');

    $risposta = $this->get('w/uat-marketing/pagina')->assertOk();

    // La lingua che il controller trova è quella messa dal middleware con la riga: se la riga desse quella di prima, la
    // pagina uscirebbe in italiano dentro una cornice in inglese.
    expect($risposta->json('lingua_della_pagina'))->toBe('en')
        ->and($risposta->json('cornice.lingua'))->toBe('en')
        ->and($risposta->json('cornice.non_lette'))->toBe(3)
        ->and(Sessione::utente()['lingua'])->toBe('en');
    Gettone::assenteDa($risposta);
});

it('la riga non aggiunge letture: in una richiesta con la riga e i dati della cornice il backoffice riceve le quattro letture di sempre e io.mostra una volta sola, in qualunque ordine; la riga da sola, quante volte si vuole, è una lettura (sprint 18 · T2.2)', function (array $chiamate, array $letture) {
    $gettoni = sessioneAMano(marketing());
    backoffice(['/v1/io' => ioMostraCon(['lingua' => 'es'])]);

    $lingue = [];
    foreach ($chiamate as $chiamata) {
        $esito = Cornice::{$chiamata}();
        $lingue[] = is_array($esito) ? $esito['lingua'] : $esito;
    }

    expect(Http::recorded()->map(fn (array $coppia) => parse_url($coppia[0]->url(), PHP_URL_PATH))->sort()->values()->all())->toBe($letture)
        ->and(richiesteA('/v1/io'))->toHaveCount(1)
        ->and(richiesteA('/v1/io')->first()->hasHeader('Authorization', 'Bearer '.$gettoni['workspace']))->toBeTrue()
        // Ogni chiamata, la prima come l'ultima, dà la lingua del profilo.
        ->and($lingue)->toBe(array_fill(0, count($chiamate), 'es'));
})->with([
    'la riga e poi i dati' => [['lingua', 'dati'], ['/v1/app', '/v1/io', '/v1/io/aziende', '/v1/io/workspace']],
    'i dati e poi la riga' => [['dati', 'lingua'], ['/v1/app', '/v1/io', '/v1/io/aziende', '/v1/io/workspace']],
    'la riga, i dati, la riga' => [['lingua', 'dati', 'lingua'], ['/v1/app', '/v1/io', '/v1/io/aziende', '/v1/io/workspace']],
    'la riga tre volte' => [['lingua', 'lingua', 'lingua'], ['/v1/io']],
]);

it('chi non chiama la riga non vede cambiare niente: le quattro letture di prima nello stesso ordine, e due Cornice::dati() nella stessa richiesta rileggono tutto, con due segni e le non lette ognuna della sua lettura (sprint 18 · T2.3)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-11 08:00:00.000001', 'UTC'));
    sessioneAMano(marketing());
    backoffice(['/v1/io' => Http::sequence()->push(ioMostra(3))->push(ioMostra(5))]);

    $laPrima = Cornice::dati();
    Carbon::setTestNow(Carbon::parse('2026-10-11 08:00:02.000001', 'UTC'));
    $laSeconda = Cornice::dati();

    expect(Http::recorded()->map(fn (array $coppia) => parse_url($coppia[0]->url(), PHP_URL_PATH))->all())
        ->toBe(['/v1/io', '/v1/app', '/v1/io/aziende', '/v1/io/workspace', '/v1/io', '/v1/app', '/v1/io/aziende', '/v1/io/workspace'])
        ->and([$laPrima['aggiornati_il'], $laSeconda['aggiornati_il']])->toBe(['2026-10-11T08:00:00.000001Z', '2026-10-11T08:00:02.000001Z'])
        ->and([$laPrima['non_lette'], $laSeconda['non_lette']])->toBe([3, 5]);
});

it('la lettura della riga serve a una Cornice::dati() sola: la seconda, nella stessa richiesta, rilegge tutto, col suo segno e le sue non lette (sprint 18 · T2.3)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-11 08:00:00.000001', 'UTC'));
    sessioneAMano(marketing());
    backoffice(['/v1/io' => Http::sequence()->push(ioMostra(3))->push(ioMostra(5))]);

    Cornice::lingua();
    Carbon::setTestNow(Carbon::parse('2026-10-11 08:00:01.000001', 'UTC'));
    $laPrima = Cornice::dati();
    Carbon::setTestNow(Carbon::parse('2026-10-11 08:00:02.000001', 'UTC'));
    $laSeconda = Cornice::dati();

    // Una lettura della riga, tre della prima `dati()`, quattro della seconda: non è una cache dei dati della cornice.
    expect(Http::recorded()->map(fn (array $coppia) => parse_url($coppia[0]->url(), PHP_URL_PATH))->all())
        ->toBe(['/v1/io', '/v1/app', '/v1/io/aziende', '/v1/io/workspace', '/v1/io', '/v1/app', '/v1/io/aziende', '/v1/io/workspace'])
        ->and([$laPrima['aggiornati_il'], $laSeconda['aggiornati_il']])->toBe(['2026-10-11T08:00:00.000001Z', '2026-10-11T08:00:02.000001Z'])
        ->and([$laPrima['non_lette'], $laSeconda['non_lette']])->toBe([3, 5]);
});

it('senza una sessione la riga dà null, e con la sessione aperta ma senza un workspace dà la lingua della sessione: il backoffice non è chiamato e la sessione resta com\'è (sprint 18 · T2.4)', function () {
    // Se la riga leggesse io.mostra ci troverebbe un'altra lingua, e la metterebbe nella sessione.
    backoffice(['/v1/io' => ioMostraCon(['lingua' => 'es', 'nome' => 'UAT Ada Lovelace'])]);

    expect(Cornice::lingua())->toBeNull();

    sessioneAMano(null);
    $prima = session(Sessione::CHIAVE);

    expect(Sessione::aperta())->toBeTrue()
        ->and(Cornice::lingua())->toBe('en')
        ->and(session(Sessione::CHIAVE))->toBe($prima);
    Http::assertNothingSent();
});

it('una lingua della sessione che non è un testo non esce dalla riga: dà null, senza un workspace e con un workspace il cui io.mostra non ne porta una buona, e il modulo mette la sua (sprint 18 · T2.4)', function (mixed $lingua) {
    backoffice(['/v1/io' => ioMostraCon(['lingua' => null])]);

    sessioneAMano(null);
    session()->put(Sessione::CHIAVE.'.utente.lingua', $lingua);

    expect(Cornice::lingua())->toBeNull();
    Http::assertNothingSent();

    sessioneAMano(marketing());
    session()->put(Sessione::CHIAVE.'.utente.lingua', $lingua);

    expect(Cornice::lingua())->toBeNull()
        ->and(richiesteA('/v1/io'))->toHaveCount(1);
})->with([
    'un numero' => [7],
    'null' => [null],
    'una lista' => [['en']],
]);

it('se io.mostra non risponde, o risponde guasto, la riga non lancia: dà la lingua della sessione, che resta com\'è; e Cornice::dati(), nella stessa richiesta, lancia quello stesso BackofficeNonRisponde senza richiamare io.mostra (sprint 18 · T2.5)', function (int $stato, mixed $corpo) {
    sessioneAMano(marketing());
    $prima = session(Sessione::CHIAVE);
    // Lo stato 0 è la connessione che cade: nessuna risposta.
    backoffice(['/v1/io' => $stato === 0 ? Http::failedConnection() : Http::response($corpo, $stato), ...aziendeEWorkspace()]);

    $esito = laRigaEPoiIDati();

    expect($esito['lingua'])->toBe('en')
        ->and($esito['errore'])->toBeInstanceOf(BackofficeNonRisponde::class)
        // È l'errore nato nella lettura della riga, non uno nuovo di una seconda lettura.
        ->and(in_array('lingua', array_column($esito['errore']->getTrace(), 'function'), true))->toBeTrue()
        ->and(session(Sessione::CHIAVE))->toBe($prima)
        // Una richiesta in tutto: la lettura fallita non riparte, e la cornice dopo non ne fa altre.
        ->and(Http::recorded())->toHaveCount(1);
})->with([
    ...ioMostraGuaste(adaCambiata()),
    '502' => [502, ''],
    'senza JSON' => [200, 'uat: non è JSON'],
    'la connessione cade' => [0, null],
]);

it('con un errore di /v1 da io.mostra è lo stesso: la riga dà la lingua della sessione, e Cornice::dati() lancia quello stesso ErroreApi senza richiamare io.mostra (sprint 18 · T2.5)', function (int $stato, string $codice) {
    sessioneAMano(marketing());
    $prima = session(Sessione::CHIAVE);
    $problema = ['type' => 'about:blank', 'title' => 'uat', 'status' => $stato, 'detail' => 'uat', 'codice' => $codice];
    backoffice(['/v1/io' => Http::response((string) json_encode($problema), $stato, ['Content-Type' => 'application/problem+json']), ...aziendeEWorkspace()]);

    $esito = laRigaEPoiIDati();

    expect($esito['lingua'])->toBe('en')
        ->and($esito['errore'])->toBeInstanceOf(ErroreApi::class)
        ->and([$esito['errore']->stato, $esito['errore']->codice])->toBe([$stato, $codice])
        ->and(in_array('lingua', array_column($esito['errore']->getTrace(), 'function'), true))->toBeTrue()
        ->and(session(Sessione::CHIAVE))->toBe($prima)
        ->and(Http::recorded())->toHaveCount(1);
})->with([
    '403' => [403, 'gettone_senza_workspace'],
    '404' => [404, 'non_trovato'],
    '429' => [429, 'troppe_richieste'],
]);

it('anche nell\'altro ordine la lettura fallita non riparte: Cornice::dati() lancia, e la riga chiamata dopo, come dalla pagina d\'errore del modulo, dà la lingua della sessione senza richiamare io.mostra (sprint 18 · T2.5)', function () {
    sessioneAMano(marketing());
    $prima = session(Sessione::CHIAVE);
    backoffice(['/v1/io' => Http::response('', 502)]);

    expect(fn () => Cornice::dati())->toThrow(BackofficeNonRisponde::class)
        ->and(Cornice::lingua())->toBe('en')
        ->and(session(Sessione::CHIAVE))->toBe($prima)
        ->and(Http::recorded())->toHaveCount(1);
});

// Review della PR #22, R6: l'errore che la riga prende non restava da nessuna parte, se in quella richiesta `Cornice::dati()`
// non c'era (una rotta JSON, una pagina senza cornice). Ora lascia una riga d'avviso: il tipo dell'errore, mai il suo messaggio,
// che può portare l'indirizzo del backoffice.

it('quando la riga prende l\'errore di io.mostra lo scrive nel log: una riga d\'avviso col tipo dell\'errore, mai il suo messaggio; una per lettura fallita, anche se la riga è chiamata due volte e poi arrivano i dati (sprint 18 · T2.5)', function (int $stato, ?string $codice, string $tipo) {
    sessioneAMano(marketing());
    logDellaRiga();
    $problema = ['type' => 'about:blank', 'title' => 'segno-del-titolo', 'status' => $stato, 'detail' => 'segno-del-dettaglio', 'codice' => $codice];
    // Lo stato 0 è la connessione che cade: nessuna risposta.
    backoffice(['/v1/io' => match (true) {
        $stato === 0 => Http::failedConnection(),
        $codice === null => Http::response('segno-del-corpo', $stato),
        default => Http::response((string) json_encode($problema), $stato, ['Content-Type' => 'application/problem+json']),
    }]);

    expect(Cornice::lingua())->toBe('en');
    $esito = laRigaEPoiIDati();

    // La riga intera: né il messaggio, né il dettaglio del problema, né l'indirizzo.
    expect($esito['lingua'])->toBe('en')
        ->and($esito['errore'])->toBeInstanceOf($tipo)
        ->and(avvisiDellaRiga())->toBe(['zr-core, lingua della pagina: la lettura di io.mostra è fallita ('.$tipo.'): resta la lingua della sessione'])
        ->and(Http::recorded())->toHaveCount(1);
})->with([
    'un 502' => [502, null, BackofficeNonRisponde::class],
    'la connessione cade' => [0, null, BackofficeNonRisponde::class],
    'un errore di /v1' => [403, 'gettone_senza_workspace', ErroreApi::class],
]);

it('la riga non scrive niente nel log quando l\'errore non lo prende lei: la lettura fallita di Cornice::dati(), che lancia, non lascia un avviso nemmeno se la riga viene dopo (sprint 18 · T2.5)', function () {
    sessioneAMano(marketing());
    logDellaRiga();
    backoffice(['/v1/io' => Http::response('', 502)]);

    expect(fn () => Cornice::dati())->toThrow(BackofficeNonRisponde::class)
        ->and(Cornice::lingua())->toBe('en')
        ->and(avvisiDellaRiga())->toBe([]);
});

it('un GettoneRifiutato che passa dalla riga non lascia un avviso: non è un errore che la riga prende (sprint 18 · T2.5)', function () {
    sessioneAMano(marketing());
    logDellaRiga();
    $problema = ['type' => 'about:blank', 'title' => 'uat', 'status' => 401, 'detail' => 'uat', 'codice' => 'gettone_non_valido'];
    backoffice(['/v1/io' => Http::response((string) json_encode($problema), 401, ['Content-Type' => 'application/problem+json'])]);

    expect(fn () => Cornice::lingua())->toThrow(GettoneRifiutato::class)
        ->and(avvisiDellaRiga())->toBe([]);
});

it('un log che non scrive non fa lanciare la riga: dà la lingua della sessione lo stesso (sprint 18 · T2.5)', function () {
    sessioneAMano(marketing());
    backoffice(['/v1/io' => Http::response('', 502)]);
    Log::shouldReceive('warning')->once()->andThrow(new RuntimeException('uat: il log non scrive'));

    expect(Cornice::lingua())->toBe('en');
});

it('un 401 da io.mostra passa dalla riga com\'è: GettoneRifiutato di zr-auth, che il frontend tratta come da ogni altra chiamata, e non una lingua (sprint 18 · T2.5)', function () {
    sessioneAMano(marketing());
    $problema = ['type' => 'about:blank', 'title' => 'uat', 'status' => 401, 'detail' => 'uat', 'codice' => 'gettone_non_valido'];
    backoffice(['/v1/io' => Http::response((string) json_encode($problema), 401, ['Content-Type' => 'application/problem+json'])]);

    expect(fn () => Cornice::lingua())->toThrow(GettoneRifiutato::class)
        ->and(Http::recorded())->toHaveCount(1);
});

it('quando Cornice::dati() usa la lettura fatta dalla riga, aggiornati_il è l\'istante preso prima di quella lettura, non quello in cui parte Cornice::dati(): le non lette non sono più vecchie del loro segno (sprint 18 · T2.6)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-11 08:00:00.000001', 'UTC'));
    sessioneAMano(marketing());
    // La risposta di io.mostra porta l'orologio avanti di un secondo: un segno preso dopo la lettura sarebbe più tardi.
    backoffice(['/v1/io' => function () {
        Carbon::setTestNow(Carbon::now()->addSecond());

        return Http::response(ioMostra(3));
    }]);

    Cornice::lingua();
    // Fra la riga, nel middleware, e i dati della cornice, a fine pagina, c'è il controller: tre secondi.
    Carbon::setTestNow(Carbon::now()->addSeconds(3));
    $dati = Cornice::dati();

    expect($dati['aggiornati_il'])->toBe('2026-10-11T08:00:00.000001Z')
        ->and($dati['non_lette'])->toBe(3)
        ->and(Carbon::now('UTC')->format('Y-m-d\TH:i:s.u\Z'))->toBe('2026-10-11T08:00:04.000001Z');
});

it('la lettura tenuta vale per quella richiesta: la richiesta dopo rilegge io.mostra, e la riga e i dati sono quelli della sua lettura (sprint 18 · T2.7)', function () {
    sessioneAMano(marketing());
    // Fra le due richieste la persona cambia ancora lingua nel profilo, e le arrivano due notifiche.
    backoffice(['/v1/io' => Http::sequence()->push(ioMostraCon(['lingua' => 'es'], 3))->push(ioMostraCon(['lingua' => 'it'], 5))]);
    paginaConLaRiga();

    $laPrima = $this->get('w/uat-marketing/pagina')->assertOk();
    $laSeconda = $this->get('w/uat-marketing/pagina')->assertOk();

    // Con una lettura che sopravvive alla richiesta la riga della seconda darebbe ancora `es`: Cornice::dati(), che la
    // troverebbe già usata, rileggerebbe comunque, e le non lette e i conteggi da soli non lo direbbero (review, R7).
    expect([$laPrima->json('lingua_della_pagina'), $laSeconda->json('lingua_della_pagina')])->toBe(['es', 'it'])
        ->and([$laPrima->json('cornice.lingua'), $laSeconda->json('cornice.lingua')])->toBe(['es', 'it'])
        ->and([$laPrima->json('cornice.non_lette'), $laSeconda->json('cornice.non_lette')])->toBe([3, 5])
        // Quattro letture per richiesta, io.mostra una volta in ognuna: la seconda non usa la lettura della prima.
        ->and(richiesteA('/v1/io'))->toHaveCount(2)
        ->and(Http::recorded())->toHaveCount(8);
});

it('la lettura tenuta vale per quel workspace: se fra la riga e i dati la sessione entra in un altro workspace, Cornice::dati() rilegge io.mostra col gettone nuovo e dà le non lette di quello (sprint 18 · T2.7)', function () {
    $gettoni = sessioneAMano(marketing());
    backoffice(['/v1/io' => Http::sequence()->push(ioMostra(3))->push(ioMostra(9))]);

    Cornice::lingua();
    // La persona entra in «UAT Vendite»: lo scambio dà un gettone nuovo, e la sessione ha un altro workspace.
    $nuovo = 'zr_'.Str::random(48);
    Sessione::entra(['gettone' => $nuovo, 'scade_il' => now()->addHour()->toIso8601String(), 'utente' => Sessione::utente(), 'workspace' => ['id' => 'uat-ws-3', 'nome' => 'UAT Vendite', 'slug' => 'uat-vendite'], 'ruolo' => 'membro']);
    $dati = Cornice::dati();

    expect($dati['workspace'])->toBe(['nome' => 'UAT Vendite', 'slug' => 'uat-vendite'])
        ->and($dati['non_lette'])->toBe(9)
        ->and(richiesteA('/v1/io'))->toHaveCount(2)
        ->and(richiesteA('/v1/io')->first()->hasHeader('Authorization', 'Bearer '.$gettoni['workspace']))->toBeTrue()
        ->and(richiesteA('/v1/io')->last()->hasHeader('Authorization', 'Bearer '.$nuovo))->toBeTrue();
});

it('la lettura tenuta vale per quella persona: se fra la riga e i dati nella sessione entra un\'altra persona, nello stesso workspace, Cornice::dati() rilegge io.mostra col suo gettone e dà le sue non lette (sprint 18 · T2.7)', function () {
    sessioneAMano(marketing());
    $grace = ['id' => 'uat-grace', 'nome' => 'UAT Grace', 'email' => 'uat-grace@example.com', 'email_verificata_il' => now()->toIso8601String(), 'lingua' => 'it', 'fuso_orario' => 'Europe/Rome'];
    $ioDiGrace = ioMostra(9);
    $ioDiGrace['data']['utente'] = $grace;
    backoffice(['/v1/io' => Http::sequence()->push(ioMostra(3))->push($ioDiGrace)]);

    Cornice::lingua();
    // Dallo stesso browser entra un'altra persona, nello stesso workspace: lo scambio dà lei e il suo gettone.
    $suo = 'zr_'.Str::random(48);
    Sessione::entra(['gettone' => $suo, 'scade_il' => now()->addHour()->toIso8601String(), 'utente' => $grace, 'workspace' => marketing(), 'ruolo' => 'membro']);
    $dati = Cornice::dati();

    expect($dati['persona'])->toBe(['nome' => 'UAT Grace', 'email' => 'uat-grace@example.com'])
        ->and($dati['non_lette'])->toBe(9)
        ->and(richiesteA('/v1/io'))->toHaveCount(2)
        ->and(richiesteA('/v1/io')->last()->hasHeader('Authorization', 'Bearer '.$suo))->toBeTrue();
});

// Review della PR #22, B2: «di chi è» la lettura tenuta sono l'id della persona e il workspace. Senza l'id non si sa di chi è, e
// due persone senza id sembrerebbero la stessa: la lettura allora non si usa.
it('una sessione senza l\'id della persona non usa la lettura tenuta: senza sapere di chi è, Cornice::dati() rilegge io.mostra (sprint 18 · T2.7)', function () {
    sessioneAMano(marketing());
    // zr-auth una sessione così non la produce: è il ramo sicuro per il giorno in cui succedesse.
    session()->forget(Sessione::CHIAVE.'.utente.id');
    backoffice(['/v1/io' => Http::sequence()->push(ioMostra(3))->push(ioMostra(9))]);

    Cornice::lingua();
    $dati = Cornice::dati();

    expect($dati['non_lette'])->toBe(9)
        ->and(richiesteA('/v1/io'))->toHaveCount(2);
});

// Review della PR #22, R9 (T2.9): la riga del README passa a `App::setLocale` ciò che `Cornice::lingua()` dà, e Laravel
// lancia su una lingua con `/`, `\`, `..` o un byte nullo, dopo aver già scritto `app.locale`: un 500 su ogni pagina di quella
// persona. La forma la guarda la riga: due o tre lettere, poi parti di lettere e cifre unite da `-` o `_`, 35 caratteri al più.

it('la riga dà la lingua della sessione solo se ha la forma di una lingua, se no null: alla riga del README non arriva mai un valore che Laravel rifiuta, e il modulo mette la sua (sprint 18 · T2.9)', function (string $lingua, ?string $attesa) {
    // Senza un workspace la riga non legge: se leggesse, il backoffice finto lo registrerebbe.
    backoffice();
    sessioneAMano(null);
    session()->put(Sessione::CHIAVE.'.utente.lingua', $lingua);

    expect(Cornice::lingua())->toBe($attesa);

    // La riga del README, con la lingua del modulo al posto di `config('app.locale')`: non lancia, qualunque sia il valore.
    App::setLocale(Cornice::lingua() ?? 'del-modulo');

    expect(App::getLocale())->toBe($attesa ?? 'del-modulo');
    Http::assertNothingSent();
})->with([
    'it' => ['it', 'it'],
    'en' => ['en', 'en'],
    'tre lettere' => ['ita', 'ita'],
    'una lingua che la cornice non ha' => ['zz', 'zz'],
    'con la regione' => ['pt-BR', 'pt-BR'],
    'con la regione, col trattino basso' => ['pt_BR', 'pt_BR'],
    'con la scrittura e la regione' => ['zh-Hans-CN', 'zh-Hans-CN'],
    'con una parte di una lettera' => ['de-DE-u-co-phonebk', 'de-DE-u-co-phonebk'],
    '35 caratteri' => ['it-'.str_repeat('abcdefgh-', 3).'abcde', 'it-'.str_repeat('abcdefgh-', 3).'abcde'],
    'un testo vuoto' => ['', null],
    'uno spazio davanti' => [' it', null],
    'uno spazio in fondo' => ['it ', null],
    'un a capo in fondo' => ["it\n", null],
    'una lettera sola' => ['i', null],
    'una cifra davanti' => ['1t', null],
    'un trattino in fondo' => ['it-', null],
    'una risalita davanti' => ['../it', null],
    'una risalita dietro' => ['it/..', null],
    'una barra' => ['it/IT', null],
    'una barra rovescia' => ['it\\x', null],
    'due punti' => ['it..IT', null],
    'un byte nullo' => ["it\0", null],
    '36 caratteri' => ['it-'.str_repeat('abcdefgh-', 3).'abcdef', null],
]);

it('la forma si guarda dopo la lettura: una lingua malfatta arrivata da io.mostra non esce dalla riga, e i dati della cornice portano la lingua della sessione com\'è, come prima (sprint 18 · T2.9)', function () {
    sessioneAMano(marketing());
    backoffice(['/v1/io' => ioMostraCon(['lingua' => '../it']), ...aziendeEWorkspace()]);

    expect(Cornice::lingua())->toBeNull()
        ->and(Sessione::utente()['lingua'])->toBe('../it')
        ->and(Cornice::dati()['lingua'])->toBe('../it')
        ->and(richiesteA('/v1/io'))->toHaveCount(1);
});
