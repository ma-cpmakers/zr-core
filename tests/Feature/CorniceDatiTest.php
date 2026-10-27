<?php

use Composer\InstalledVersions;
use Illuminate\Contracts\Http\Kernel as HttpKernel;
use Illuminate\Http\Client\Request;
use Illuminate\Http\Client\ResponseSequence;
use Illuminate\Http\Request as RichiestaDelBrowser;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Monolog\Handler\TestHandler;
use Monolog\Level;
use Zeiras\Auth\Api;
use Zeiras\Auth\Errori\BackofficeNonRisponde;
use Zeiras\Auth\Errori\ErroreApi;
use Zeiras\Auth\Errori\GettoneRifiutato;
use Zeiras\Auth\Persona;
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
        'persona' => ['nome' => 'UAT Ada', 'email' => 'uat-ada@example.com', 'impronta' => improntaDi('uat-ada')],
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
        'persona' => ['nome' => 'UAT Ada', 'email' => 'uat-ada@example.com', 'impronta' => improntaDi('uat-ada')],
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

// Sprint 74 · C5 (voce 2730 di zr-home). io.workspace.elenca dà a ogni workspace il suo `colore` (dal 17/10/2026): se è uno dei
// cinque toni del selettore esce nella riga del workspace, dopo lo slug, e la cornice lo usa al posto del tono dell'id. `neutral`
// — il colore di chi non ne ha scelto uno — e ogni altro valore non escono, e il pallino resta quello della regola. Nessuna
// lettura in più: il colore sta nella riga che la cornice legge già.
it('un workspace col colore scelto, uno dei cinque toni, lo porta dopo lo slug; neutral, un colore che zr-core non conosce e un valore che non è un testo non escono (voce 2730)', function (mixed $colore, array $atteso) {
    sessioneAMano(marketing());
    backoffice([
        '/v1/io/aziende' => ['data' => [['id' => 'az-a', 'nome' => 'UAT az-a']], 'successivo' => null],
        '/v1/io/workspace' => ['data' => [[...workspaceAlPosto(0), 'colore' => $colore, 'ruolo' => 'membro', 'azienda_id' => 'az-a'], [...workspaceAlPosto(1), 'ruolo' => 'membro', 'azienda_id' => 'az-a']], 'successivo' => null],
    ]);

    expect(Cornice::dati()['aziende'])->toBe([
        ['id' => 'az-a', 'nome' => 'UAT az-a', 'workspace' => [[...workspaceAlPosto(0), ...$atteso], workspaceAlPosto(1)], 'nuovo_workspace' => false],
    ]);
})->with([
    'pine' => ['pine', ['colore' => 'pine']],
    'citrus' => ['citrus', ['colore' => 'citrus']],
    'coral' => ['coral', ['colore' => 'coral']],
    'sky' => ['sky', ['colore' => 'sky']],
    'plum' => ['plum', ['colore' => 'plum']],
    'neutral' => ['neutral', []],
    'un colore che zr-core non conosce' => ['teal', []],
    'un tono scritto in un altro modo' => ['Sky', []],
    'un testo vuoto' => ['', []],
    'null' => [null, []],
    'una lista' => [['sky'], []],
    'un numero' => [3, []],
]);

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

// Sprint 69 · T2 (voce #2210). `moduli` è l'indirizzo di Impostazioni › Moduli di zr-home nel workspace dei dati, e la cornice lo
// usa per un modulo `disponibile`: lo dà la parte server solo a chi amministra il workspace, cioè col ruolo della sessione
// `proprietario` o `amministratore` (come `puoAmministrare()` di zr-home); per ogni altro ruolo la chiave manca. Il ruolo è quello
// della sessione, e per saperlo non parte nessuna lettura in più.

it('`moduli` è l\'indirizzo di Impostazioni › Moduli nel workspace dei dati, solo se il ruolo della sessione è proprietario o amministratore; per ogni altro ruolo la chiave manca; le letture restano quattro (sprint 69 · T2.1, T2.4)', function (mixed $ruolo, bool $dato) {
    sessioneAMano(marketing());
    Sessione::entra(['gettone' => 'zr_'.Str::random(48), 'scade_il' => now()->addHour()->toIso8601String(), 'utente' => Sessione::utente(), 'workspace' => marketing(), 'ruolo' => $ruolo]);
    backoffice(['/v1/io' => ioMostra(0)]);

    $dati = Cornice::dati();

    expect(array_key_exists('moduli', (array) $dati))->toBe($dato);
    if ($dato) {
        expect($dati['moduli'])->toBe('https://app.zeiras.com/w/uat-marketing/impostazioni/moduli');
        // Dopo `non_lette`, prima del segno: nessuna chiave si sposta per chi non amministra.
        expect(array_slice(array_keys($dati), 3, 4))->toBe(['prodotti', 'aziende', 'non_lette', 'moduli']);
    }
    expect(Http::recorded())->toHaveCount(4);
})->with([
    'proprietario' => ['proprietario', true],
    'amministratore' => ['amministratore', true],
    'membro' => ['membro', false],
    'un ruolo che zr-core non conosce' => ['ospite', false],
    'un ruolo scritto in un altro modo' => ['Amministratore', false],
    'nessun ruolo' => [null, false],
]);

it('i dati ridotti (accettazione_richiesta) non hanno `moduli`, nemmeno per chi amministra (sprint 69 · T2.1)', function () {
    sessioneAMano(marketing());
    Sessione::entra(['gettone' => 'zr_'.Str::random(48), 'scade_il' => now()->addHour()->toIso8601String(), 'utente' => Sessione::utente(), 'workspace' => marketing(), 'ruolo' => 'proprietario']);
    backoffice(['/v1/io' => ioMostra(0), '/v1/app' => accettazioneRichiesta()]);

    expect(array_key_exists('moduli', (array) Cornice::dati()))->toBeFalse();
});

// Sprint 77 · T1 (voce #2677, da zr-crm #2673). `Cornice::nuovoWorkspace()` dà a una pagina di un modulo l'indirizzo di «Nuovo
// workspace» di zr-home nel workspace della sessione, con la regola del pulsante del selettore: proprietario o amministratore in
// almeno un workspace dell'azienda del workspace della sessione. Agli altri null, e il modulo spiega senza pulsante. Una lettura
// sola, io.workspace.elenca col gettone della persona; un errore del backoffice arriva a chi chiama.

/**
 * Le righe di io.workspace.elenca per nuovoWorkspace(): una per [slug, azienda, ruolo]; senza il terzo la riga non ha `ruolo`.
 *
 * @param  list<array{0: string, 1: string, 2?: mixed}>  $righe
 * @return array<string, mixed> per backoffice()
 */
function workspaceDelleAziende(array $righe): array
{
    return ['/v1/io/workspace' => ['data' => array_map(
        fn (array $riga, int $posto) => ['id' => "uat-ws-{$posto}", 'nome' => "UAT workspace {$posto}", 'slug' => $riga[0], ...(array_key_exists(2, $riga) ? ['ruolo' => $riga[2]] : []), 'azienda_id' => $riga[1]],
        $righe,
        array_keys($righe),
    ), 'successivo' => null]];
}

it('nuovoWorkspace() dà l\'indirizzo di «Nuovo workspace» nel workspace della sessione solo se la persona è proprietario o amministratore in un workspace della sua azienda; altrimenti null (sprint 77 · T1.1)', function (array $righe, bool $puo) {
    sessioneAMano(marketing());
    backoffice(workspaceDelleAziende($righe));

    expect(Cornice::nuovoWorkspace())->toBe($puo ? 'https://app.zeiras.com/w/uat-marketing/nuovo-workspace' : null);
})->with([
    'proprietario qui' => [[['uat-marketing', 'az-a', 'proprietario']], true],
    'amministratore qui' => [[['uat-marketing', 'az-a', 'amministratore']], true],
    'membro qui' => [[['uat-marketing', 'az-a', 'membro']], false],
    // Il selettore gli mostra «Nuovo workspace»: il ruolo vale per l'azienda.
    'membro qui, amministratore in un altro workspace della stessa azienda' => [[['uat-marketing', 'az-a', 'membro'], ['uat-altro', 'az-a', 'amministratore']], true],
    'proprietario in un workspace della stessa azienda, prima di questo' => [[['uat-altro', 'az-a', 'proprietario'], ['uat-marketing', 'az-a', 'membro']], true],
    'membro qui, proprietario in un workspace di un\'altra azienda' => [[['uat-marketing', 'az-a', 'membro'], ['uat-altro', 'az-b', 'proprietario']], false],
    'un ruolo che zr-core non conosce' => [[['uat-marketing', 'az-a', 'ospite']], false],
    'un ruolo scritto in un altro modo' => [[['uat-marketing', 'az-a', 'Amministratore']], false],
    'una riga senza ruolo' => [[['uat-marketing', 'az-a']], false],
    'un ruolo che è true' => [[['uat-marketing', 'az-a', true]], false],
]);

it('nuovoWorkspace() non guarda il ruolo della sessione: decide la riga dell\'elenco (sprint 77 · T1.1)', function (string $sessione, string $riga, bool $puo) {
    sessioneAMano(marketing());
    Sessione::entra(['gettone' => 'zr_'.Str::random(48), 'scade_il' => now()->addHour()->toIso8601String(), 'utente' => Sessione::utente(), 'workspace' => marketing(), 'ruolo' => $sessione]);
    backoffice(workspaceDelleAziende([['uat-marketing', 'az-a', $riga]]));

    expect(Cornice::nuovoWorkspace())->toBe($puo ? 'https://app.zeiras.com/w/uat-marketing/nuovo-workspace' : null);
})->with([
    'proprietario nella sessione, membro nell\'elenco' => ['proprietario', 'membro', false],
    'membro nella sessione, amministratore nell\'elenco' => ['membro', 'amministratore', true],
]);

it('nuovoWorkspace() dà null senza sessione o senza workspace, e non chiama il backoffice (sprint 77 · T1.2)', function (bool $sessione) {
    backoffice(workspaceDelleAziende([['uat-marketing', 'az-a', 'proprietario']]));
    if ($sessione) {
        sessioneAMano(null);
    }

    expect(Cornice::nuovoWorkspace())->toBeNull();
    Http::assertNothingSent();
})->with([
    'nessuna sessione' => [false],
    'una sessione senza workspace' => [true],
]);

it('nuovoWorkspace() dà null se il workspace della sessione non è nell\'elenco: il ruolo di un altro non passa a lui (sprint 77 · T1.2)', function () {
    sessioneAMano(marketing());
    backoffice(workspaceDelleAziende([['uat-altro', 'az-a', 'proprietario'], ['uat-terzo', 'az-b', 'amministratore']]));

    expect(Cornice::nuovoWorkspace())->toBeNull();
});

it('nuovoWorkspace() fa una lettura sola, io.workspace.elenca col gettone della persona, e ne legge tutte le pagine (sprint 77 · T1.3)', function () {
    $gettoni = sessioneAMano(marketing());
    backoffice(['/v1/io/workspace' => Http::sequence()
        ->push(['data' => [['id' => 'uat-ws-0', 'nome' => 'UAT Marketing', 'slug' => 'uat-marketing', 'ruolo' => 'membro', 'azienda_id' => 'az-a']], 'successivo' => 'uat-cursore-2'])
        ->push(['data' => [['id' => 'uat-ws-1', 'nome' => 'UAT Vendite', 'slug' => 'uat-vendite', 'ruolo' => 'amministratore', 'azienda_id' => 'az-a']], 'successivo' => null])]);

    expect(Cornice::nuovoWorkspace())->toBe('https://app.zeiras.com/w/uat-marketing/nuovo-workspace')
        ->and(Http::recorded()->map(fn (array $coppia) => parse_url($coppia[0]->url(), PHP_URL_PATH))->all())->toBe(['/v1/io/workspace', '/v1/io/workspace'])
        ->and(richiesteA('/v1/io/workspace')->every(fn (Request $richiesta) => $richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['accesso'])))->toBeTrue();
});

it('se il backoffice non risponde, o risponde con un errore, nuovoWorkspace() non dà null: l\'errore arriva a chi chiama (sprint 77 · T1.3)', function (Closure $risposta, string $tipo) {
    sessioneAMano(marketing());
    backoffice(['/v1/io/workspace' => $risposta]);

    expect(fn () => Cornice::nuovoWorkspace())->toThrow($tipo);
})->with([
    'un 500' => [fn () => Http::response('', 500), BackofficeNonRisponde::class],
    'la connessione cade' => [fn () => Http::failedConnection(), BackofficeNonRisponde::class],
    'un errore di /v1' => [fn () => Http::response((string) json_encode(['type' => 'about:blank', 'title' => 'uat', 'status' => 403, 'detail' => 'uat', 'codice' => 'gettone_senza_workspace']), 403, ['Content-Type' => 'application/problem+json']), ErroreApi::class],
    'il gettone rifiutato' => [fn () => Http::response((string) json_encode(['type' => 'about:blank', 'title' => 'uat', 'status' => 401, 'detail' => 'uat', 'codice' => 'gettone_scaduto']), 401, ['Content-Type' => 'application/problem+json']), GettoneRifiutato::class],
    'una riga senza slug' => [fn () => Http::response(['data' => [['id' => 'uat-ws-0', 'nome' => 'UAT', 'ruolo' => 'proprietario', 'azienda_id' => 'az-a']], 'successivo' => null]), BackofficeNonRisponde::class],
    'una riga con azienda_id che non è un testo' => [fn () => Http::response(['data' => [['id' => 'uat-ws-0', 'nome' => 'UAT', 'slug' => 'uat-marketing', 'ruolo' => 'proprietario', 'azienda_id' => 7]], 'successivo' => null]), BackofficeNonRisponde::class],
]);

it('nuovoWorkspace() codifica lo slug per l\'indirizzo, come `moduli` (sprint 77 · T1.4)', function () {
    sessioneAMano(['id' => 'uat-ws', 'nome' => 'UAT Marketing', 'slug' => 'uat marketing/2']);
    backoffice(workspaceDelleAziende([['uat marketing/2', 'az-a', 'proprietario']]));

    expect(Cornice::nuovoWorkspace())->toBe('https://app.zeiras.com/w/uat%20marketing%2F2/nuovo-workspace');
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

it('la lingua e il nome che io.mostra dà diversi da quelli della sessione sono nei dati di quella stessa lettura, e dalla zr-auth 0.12.63 anche l\'email; il resto è quello della sessione (sprint 13 · T2.1; sprint 64 · T1.1)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-10 09:40:00.000001', 'UTC'));
    sessioneAMano(marketing());
    // Nel profilo sono cambiati la lingua e il nome. io.mostra dà anche un'altra email e un altro nome del workspace: il
    // workspace la cornice non lo prende da lì, e resta quello della sessione; l'email sì, dalla zr-auth 0.12.63.
    $io = ioMostraCon(['lingua' => 'es', 'nome' => 'UAT Ada Lovelace', 'email' => 'uat-ada-nuova@example.com']);
    $io['data']['workspace'] = ['id' => 'uat-ws', 'nome' => 'UAT Marketing rinominato', 'slug' => 'uat-marketing-rinominato', 'azienda_id' => 'az-b'];
    backoffice([
        '/v1/app' => ['data' => [['codice' => 'pm', 'stato' => 'attivo'], ['codice' => 'crm', 'stato' => 'disponibile']], 'successivo' => null],
        '/v1/io' => $io,
        ...aziendeEWorkspace(),
    ]);

    // Gli stessi dati del primo caso, con la lingua e il nome nuovi: il workspace è ancora quello della sessione, l'email quella
    // che la zr-auth installata ci ha messo.
    $this->get('w/un-altro-workspace/cornice')->assertOk()->assertExactJson(datiAttesi('2026-10-10T09:40:00.000001Z', [
        'lingua' => 'es',
        'persona' => ['nome' => 'UAT Ada Lovelace', 'email' => emailDaIoMostra() ? 'uat-ada-nuova@example.com' : 'uat-ada@example.com', 'impronta' => improntaDi('uat-ada')],
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

it('della sessione cambiano solo la lingua e il nome, e dalla zr-auth 0.12.63 l\'email: gettoni, id, fuso, workspace e ruolo restano quelli dell\'ingresso, anche se io.mostra li dà diversi, e un `email_verificata_il` nullo non entra (sprint 13 · T2.4; sprint 64 · T1.1)', function () {
    sessioneAMano(marketing());
    $prima = session(Sessione::CHIAVE);
    $io = ioMostraCon(['lingua' => 'es', 'nome' => 'UAT Ada Lovelace', 'email' => 'uat-ada-nuova@example.com', 'email_verificata_il' => null, 'fuso_orario' => 'America/Lima']);
    $io['data']['workspace'] = ['id' => 'uat-ws-3', 'nome' => 'UAT Vendite', 'slug' => 'uat-vendite', 'azienda_id' => 'az-a'];
    $io['data']['ruolo'] = 'proprietario';
    backoffice(['/v1/io' => $io]);

    $risposta = $this->get('w/uat-marketing/cornice')->assertOk();

    // La sessione di prima, coi soli campi che zr-auth rimette: ogni altra differenza è un campo che non doveva cambiare.
    $email = emailDaIoMostra() ? 'uat-ada-nuova@example.com' : 'uat-ada@example.com';
    $attesa = $prima;
    $attesa['utente']['lingua'] = 'es';
    $attesa['utente']['nome'] = 'UAT Ada Lovelace';
    $attesa['utente']['email'] = $email;

    expect(session(Sessione::CHIAVE))->toBe($attesa)
        ->and($risposta->json('persona.email'))->toBe($email)
        ->and($risposta->json('workspace'))->toBe(['nome' => 'UAT Marketing', 'slug' => 'uat-marketing']);
});

// Sprint 64 · T1.2 (voce #2215), sprint 67 · T1 (voce #2216). Dopo la lettura che rimette l'email nella sessione, una scheda
// rimasta aperta con l'email di prima ha la stessa impronta: dalla `v2.23.0` è la stessa persona, e non riceve il 409. Lo
// riceve quella con l'impronta di un'altra persona. Con una zr-auth più vecchia l'email resta quella dell'ingresso.
it('dopo la lettura che le porta l\'email nuova, una richiesta della cornice con l\'email di prima e la stessa impronta passa come una con l\'email nuova, e i dati sono quelli della sessione, con `persona` com\'è nella pagina; con l\'impronta di un\'altra persona riceve 409 persona_diversa senza chiamare il backoffice (sprint 64 · T1.2; sprint 67 · T1.1, T1.2)', function () {
    sessioneAMano(marketing());
    backoffice(['/v1/io' => ioMostraCon(['email' => 'uat-ada-nuova@example.com']), '/v1/io/notifiche' => ['data' => [], 'successivo' => null]]);
    $this->get('w/uat-marketing/cornice')->assertOk();

    [$giusta, $vecchia] = emailDaIoMostra() ? ['uat-ada-nuova@example.com', 'uat-ada@example.com'] : ['uat-ada@example.com', 'uat-ada-nuova@example.com'];
    expect(session(Sessione::CHIAVE.'.utente.email'))->toBe($giusta);

    $prima = Http::recorded()->count();
    $this->getJson('cornice/notifiche', ['Persona' => rawurlencode($vecchia), Persona::INTESTAZIONE => improntaDi('uat-ada-2')])
        ->assertStatus(409)->assertExactJson(['errore' => 'persona_diversa', 'persona' => '']);
    expect(Http::recorded()->count())->toBe($prima);

    $this->getJson('cornice/notifiche', ['Persona' => rawurlencode($vecchia)])->assertOk()->assertJsonPath('persona', $vecchia);
    $dopoLaVecchia = Http::recorded()->count();
    expect($dopoLaVecchia)->toBeGreaterThan($prima);

    $this->getJson('cornice/notifiche', ['Persona' => rawurlencode($giusta)])->assertOk()->assertJsonPath('persona', $giusta);
    expect(Http::recorded()->count())->toBeGreaterThan($dopoLaVecchia);
});

it('ciò che non vale non entra: i dati di un\'altra persona o senza il suo id, una lingua, un nome o un\'email che non sono una stringa con qualcosa dentro, gli stessi valori (sprint 13 · T2.5; review, R1 e S1; sprint 64, review della PR #104, R2 e R4)', function (mixed $utente, string $lingua, string $nome, array $senza = []) {
    // L'orologio fermo: `sessioneAMano` e io.mostra scrivono `email_verificata_il` con `now()`, e dalla zr-auth 0.12.63
    // `Sessione::aggiorna` lo prende se è diverso. Con un secondo scattato fra i due il confronto della sessione sarebbe rosso.
    Carbon::setTestNow(Carbon::parse('2026-10-10 09:45:00', 'UTC'));
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
    // dalla zr-auth 0.12.63 anche l'email segue io.mostra, con la stessa regola: una che non vale non entra
    'l\'email vuota' => [['lingua' => 'es', 'nome' => 'UAT Ada Lovelace', 'email' => ''], 'es', 'UAT Ada Lovelace'],
    'l\'email di soli spazi' => [['lingua' => 'es', 'nome' => 'UAT Ada Lovelace', 'email' => '   '], 'es', 'UAT Ada Lovelace'],
    'l\'email null' => [['lingua' => 'es', 'nome' => 'UAT Ada Lovelace', 'email' => null], 'es', 'UAT Ada Lovelace'],
    'l\'email un numero' => [['lingua' => 'es', 'nome' => 'UAT Ada Lovelace', 'email' => 7], 'es', 'UAT Ada Lovelace'],
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

    expect($dati['persona'])->toBe(['nome' => 'UAT Grace', 'email' => 'uat-grace@example.com', 'impronta' => improntaDi('uat-grace')])
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

/**
 * Dalla 0.12.12 `Sessione::aggiorna` di zr-auth prende dal profilo solo una lingua di Zeiras (`Sessione::LINGUE`: `it`, `en`,
 * `es`), col confronto esatto; fino alla 0.12.11 ogni testo non vuoto, com'è. La versione installata dice quale dei due
 * comportamenti aspettarsi: uno solo per giro della CI, mai tutti e due.
 */
function soloLingueDiZeiras(): bool
{
    return version_compare(ltrim((string) InstalledVersions::getPrettyVersion('zeiras/zr-auth'), 'v'), '0.12.12', '>=');
}

/**
 * Dalla 0.12.63 `Sessione::aggiorna` di zr-auth rimette nella sessione anche l'email di io.mostra (il cambio dell'email di
 * zr-home, #2214), e `email_verificata_il` se è un testo; fino alla 0.12.62 solo la lingua e il nome. Come sopra: la versione
 * installata dice quale dei due comportamenti aspettarsi (sprint 64 · T1).
 */
function emailDaIoMostra(): bool
{
    return version_compare(ltrim((string) InstalledVersions::getPrettyVersion('zeiras/zr-auth'), 'v'), '0.12.63', '>=');
}

it('la forma si guarda dopo la lettura: una lingua malfatta arrivata da io.mostra non esce dalla riga, e i dati della cornice portano la lingua della sessione com\'è — con zr-auth fino alla 0.12.11 la sessione la prende e la riga dà null, dalla 0.12.12 la sessione tiene la lingua che aveva e la riga dà quella (sprint 18 · T2.9, sprint 20 · T4.1, T4.2)', function () {
    // La lingua di partenza non è la predefinita dell'app di prova (`en`): «quella che la sessione aveva» non si confonde con un ripiego.
    sessioneAMano(marketing(), 'es');
    backoffice(['/v1/io' => ioMostraCon(['lingua' => '../it']), ...aziendeEWorkspace()]);

    expect(Sessione::utente()['lingua'])->toBe('es')
        ->and(Cornice::lingua())->toBe(soloLingueDiZeiras() ? 'es' : null)
        ->and(Sessione::utente()['lingua'])->toBe(soloLingueDiZeiras() ? 'es' : '../it')
        ->and(Cornice::dati()['lingua'])->toBe(soloLingueDiZeiras() ? 'es' : '../it')
        ->and(richiesteA('/v1/io'))->toHaveCount(1);
});

// Review della PR #27, R3: dalla 0.12.12 una lingua malfatta non arriva più alla sessione da io.mostra, e il caso qui sopra in
// quel giro non prova più il controllo della forma. Ma nella sessione può esserci già: all'ingresso zr-auth copia la persona
// com'è. Qui la forma si guarda dopo la lettura con tutte e due le versioni, e dopo, non prima: una buona del profilo passa.

it('una lingua malfatta presa all\'ingresso non esce dalla riga nemmeno con un workspace: se il profilo porta ancora quella la riga dà null, se ne porta una buona dà la buona, con zr-auth fino alla 0.12.11 e dalla 0.12.12 (sprint 20 · T4.1; review della PR #27, R3)', function (string $delProfilo, ?string $attesa) {
    sessioneAMano(marketing(), '../it');
    backoffice(['/v1/io' => ioMostraCon(['lingua' => $delProfilo])]);

    expect(Sessione::utente()['lingua'])->toBe('../it')
        ->and(Cornice::lingua())->toBe($attesa)
        ->and(Sessione::utente()['lingua'])->toBe($attesa ?? '../it')
        ->and(richiesteA('/v1/io'))->toHaveCount(1);
})->with([
    'il profilo porta ancora la malfatta' => ['../it', null],
    'il profilo ne porta una buona' => ['es', 'es'],
]);

// Review della PR #27, R5: il README dice quali lingue del profilo `Sessione::aggiorna` prende, e che il confronto è esatto. Se
// una 0.12 nuova cambia l'elenco o il confronto, nel giro «ultima» questo caso diventa rosso, e il README si riscrive.

it('una lingua del profilo ben fatta che non è una di Zeiras: con zr-auth fino alla 0.12.11 la sessione la prende com\'è e la riga dà quella, dalla 0.12.12 la sessione tiene la lingua che aveva e la riga dà quella — e il confronto è esatto (sprint 20 · T4.2, T4.3; review della PR #27, R5)', function (string $delProfilo) {
    sessioneAMano(marketing(), 'es');
    backoffice(['/v1/io' => ioMostraCon(['lingua' => $delProfilo]), ...aziendeEWorkspace()]);
    $attesa = soloLingueDiZeiras() ? 'es' : $delProfilo;

    expect(Cornice::lingua())->toBe($attesa)
        ->and(Sessione::utente()['lingua'])->toBe($attesa)
        ->and(Cornice::dati()['lingua'])->toBe($attesa);
})->with([
    'con la regione' => ['pt-BR'],
    'una lingua che Zeiras non ha' => ['fr'],
    'una di Zeiras in maiuscole' => ['IT'],
    'una di Zeiras con la regione' => ['it-IT'],
]);

// Sprint 24 · T1 (voce #1745): chi non ha ancora accettato i documenti legali in vigore riceve da /v1 un 403
// `accettazione_richiesta` da quasi ogni metodo (restano aperti io.mostra, i documenti, l'accettazione e l'uscita). Per la
// cornice non è un guasto: Cornice::dati() non lancia e dà i dati ridotti — lingua, persona e workspace della sessione, nessuna
// app, nessuna azienda, zero non lette — con `accettazione_richiesta: true`, e dopo il primo 403 non chiama più il backoffice.
// La chiave c'è solo lì: i dati di chi ha accettato sono quelli di sempre, senza la chiave. Il 403 si riconosce dallo stato e
// dal codice insieme: ogni altra risposta resta l'errore che era. Il 403 è accettazioneRichiesta() di tests/Pest.php.

/**
 * I dati ridotti della cornice per la sessione dei test entrata in «UAT Marketing», nel loro ordine: le sette chiavi di sempre,
 * senza app, senza aziende e con zero non lette, e `accettazione_richiesta` in fondo.
 *
 * @param  array<string, mixed>  $cambi
 * @return array<string, mixed>
 */
function datiRidotti(string $aggiornatiIl, array $cambi = []): array
{
    return [
        'lingua' => 'en',
        'persona' => ['nome' => 'UAT Ada', 'email' => 'uat-ada@example.com', 'impronta' => improntaDi('uat-ada')],
        'workspace' => ['nome' => 'UAT Marketing', 'slug' => 'uat-marketing'],
        'prodotti' => [],
        'aziende' => [],
        'non_lette' => 0,
        'aggiornati_il' => $aggiornatiIl,
        'accettazione_richiesta' => true,
        ...$cambi,
    ];
}

/**
 * Il backoffice di chi ha accettato, quello dei dati di datiAttesi(): due app, tre non lette, le aziende e i workspace di
 * aziendeEWorkspace(); con ciò che un caso gli fa rispondere diverso al posto suo.
 *
 * @param  array<string, mixed>  $alPosto  per percorso, come per backoffice()
 */
function backofficeDiChiHaAccettato(array $alPosto = []): void
{
    backoffice([
        '/v1/app' => ['data' => [['codice' => 'pm', 'stato' => 'attivo'], ['codice' => 'crm', 'stato' => 'disponibile']], 'successivo' => null],
        '/v1/io' => ioMostra(3),
        ...aziendeEWorkspace(),
        ...$alPosto,
    ]);
}

/** @return list<string> i percorsi di /v1 chiamati, nell'ordine in cui le richieste sono partite */
function percorsiChiamati(): array
{
    return Http::recorded()->map(fn (array $coppia) => (string) parse_url($coppia[0]->url(), PHP_URL_PATH))->values()->all();
}

// Seconda lettura della PR #52, S7 (sprint 25 · T5.5). `assertExactJson` decodifica e ricodifica, e non distingue una lista vuota
// da un oggetto vuoto: che al browser `prodotti` arrivi come `[]`, come dice il README, lo dice solo il testo della risposta.
it('nei dati ridotti `prodotti` e `aziende` arrivano al browser come liste vuote: nel testo della risposta c\'è "prodotti":[] e non "prodotti":{} (sprint 25 · T5.5)', function () {
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato(['/v1/app' => accettazioneRichiesta()]);

    $testo = (string) $this->get('w/uat-marketing/cornice')->assertOk()->getContent();

    expect(str_contains($testo, '"prodotti":[]'))->toBe(true)
        ->and(str_contains($testo, '"aziende":[]'))->toBe(true)
        ->and(str_contains($testo, '"prodotti":{}'))->toBe(false);
});

it('con app.elenca che risponde 403 accettazione_richiesta la pagina ha i dati della cornice lo stesso: lingua, persona e workspace della sessione, nessuna app, nessuna azienda, zero non lette, il segno e accettazione_richiesta; aziende e workspace non li chiede (sprint 24 · T1.1)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:05.123456', 'UTC'));
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato(['/v1/app' => accettazioneRichiesta()]);

    $this->get('w/uat-marketing/cornice')->assertOk()->assertExactJson(datiRidotti('2026-10-09T21:31:05.123456Z'));

    expect(percorsiChiamati())->toBe(['/v1/io', '/v1/app']);
});

it('i dati ridotti portano la lingua e il nome che io.mostra ha appena dato, come i dati di sempre: la sessione li ha già presi quando il 403 arriva (sprint 24 · T1.1)', function () {
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato(['/v1/io' => ioMostraCon(['lingua' => 'es', 'nome' => 'UAT Ada Lovelace']), '/v1/app' => accettazioneRichiesta()]);

    $dati = Cornice::dati();

    expect([$dati['lingua'], $dati['persona'], $dati['accettazione_richiesta']])->toBe(['es', ['nome' => 'UAT Ada Lovelace', 'email' => 'uat-ada@example.com', 'impronta' => improntaDi('uat-ada')], true])
        ->and([Sessione::utente()['lingua'], Sessione::utente()['nome']])->toBe(['es', 'UAT Ada Lovelace']);
});

it('da qualunque delle quattro letture arrivi quel 403, anche a metà di un elenco, i dati sono quelli ridotti, interi e nel loro ordine — mai le app senza accettazione_richiesta —, e dopo il 403 il backoffice non è più chiamato (sprint 24 · T1.1, T1.2)', function (string $percorso, int $allaPagina, array $chiamate) {
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:05.123456', 'UTC'));
    sessioneAMano(marketing());
    $workspace = ['id' => 'uat-ws', 'nome' => 'UAT Marketing', 'slug' => 'uat-marketing', 'ruolo' => 'proprietario', 'azienda_id' => 'az-b'];
    backofficeDiChiHaAccettato([$percorso => $allaPagina === 1
        ? accettazioneRichiesta()
        : Http::sequence()->push(['data' => [$workspace], 'successivo' => 'uat-cursore-2'])->pushResponse(accettazioneRichiesta())]);

    expect(Cornice::dati())->toBe(datiRidotti('2026-10-09T21:31:05.123456Z'))
        ->and(percorsiChiamati())->toBe($chiamate);
})->with([
    'da io.mostra' => ['/v1/io', 1, ['/v1/io']],
    'da app.elenca' => ['/v1/app', 1, ['/v1/io', '/v1/app']],
    'da io.aziende.elenca' => ['/v1/io/aziende', 1, ['/v1/io', '/v1/app', '/v1/io/aziende']],
    'da io.workspace.elenca' => ['/v1/io/workspace', 1, ['/v1/io', '/v1/app', '/v1/io/aziende', '/v1/io/workspace']],
    'da io.workspace.elenca, alla seconda pagina' => ['/v1/io/workspace', 2, ['/v1/io', '/v1/app', '/v1/io/aziende', '/v1/io/workspace', '/v1/io/workspace']],
]);

it('quel 403 da io.mostra non è un guasto nemmeno per la riga: dà la lingua della sessione senza scrivere niente nel log, e Cornice::dati(), nella stessa richiesta, dà i dati ridotti col segno di quella lettura, senza richiamare il backoffice (sprint 24 · T1.2)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:05.123456', 'UTC'));
    sessioneAMano(marketing());
    logDellaRiga();
    backofficeDiChiHaAccettato(['/v1/io' => accettazioneRichiesta()]);

    expect(Cornice::lingua())->toBe('en');
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:09.000000', 'UTC'));

    expect(Cornice::dati())->toBe(datiRidotti('2026-10-09T21:31:05.123456Z'))
        ->and(Log::channel('della-riga')->getLogger()->getHandlers()[0]->getRecords())->toBe([])
        ->and(percorsiChiamati())->toBe(['/v1/io']);
});

it('chi ha accettato ha i dati di sempre: senza quel 403 la chiave accettazione_richiesta non c\'è, nemmeno a false (sprint 24 · T1.4)', function () {
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato();

    $dati = Cornice::dati();

    expect($dati)->not->toHaveKey('accettazione_richiesta')
        ->and(array_keys($dati))->toBe(['lingua', 'persona', 'workspace', 'prodotti', 'aziende', 'non_lette', 'aggiornati_il'])
        ->and($dati['prodotti'])->toBe(['pm' => 'attivo', 'crm' => 'disponibile']);
});

it('ogni altra risposta resta l\'errore che era: un 403 con un altro codice o senza codice, e quel codice con un altro stato, fanno lanciare a Cornice::dati() il loro ErroreApi, da qualunque lettura arrivino (sprint 24 · T1.5)', function (int $stato, ?string $codice, string $percorso) {
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato([$percorso => accettazioneRichiesta($stato, $codice)]);

    expect(fn () => Cornice::dati())->toThrow(function (ErroreApi $errore) use ($stato, $codice) {
        expect([$errore->stato, $errore->codice])->toBe([$stato, $codice]);
    });
})->with(quasiAccettazioneRichiesta())->with([
    'da io.mostra' => ['/v1/io'],
    'da app.elenca' => ['/v1/app'],
    'da io.aziende.elenca' => ['/v1/io/aziende'],
    'da io.workspace.elenca' => ['/v1/io/workspace'],
]);

// Sprint 24 · T5 (lettura della PR #52, R3). Il README dice che cosa succede alle chiamate del frontend a /v1 davanti a quel
// 403: lì la cornice non c'entra, risponde zr-auth. È una frase su un'altra libreria: nomina la classe, e questo caso la
// guarda nel giro che la installa. Dalla 0.12.17 l'errore è `AccettazioneRichiesta`, che non presa risponde in tre forme; con
// una patch più vecchia — il vincolo le accetta — la classe non c'è, e quel 403 è un ErroreApi come gli altri.

/** Dalla 0.12.17 zr-auth dà a quel 403 un'eccezione sua, che risponde da sé: la versione installata dice che cosa aspettarsi. */
function zrAuthRispondeDaSeAQuel403(): bool
{
    return version_compare(ltrim((string) InstalledVersions::getPrettyVersion('zeiras/zr-auth'), 'v'), '0.12.17', '>=');
}

it('una chiamata del frontend a /v1 davanti al 403 accettazione_richiesta: da zr-auth 0.12.17 è `AccettazioneRichiesta`, che non presa rimanda una visita alla pagina dell\'accettazione (302), a una visita di Inertia risponde 409 con `X-Inertia-Location`, e a una richiesta JSON 403 con `codice` e `mancanti`, senza rimando; con una patch più vecchia è un ErroreApi senza risposta sua (sprint 24 · T5, R3)', function () {
    sessioneAMano(marketing());
    Http::fake(['*' => accettazioneRichiesta()]);
    config()->set('zr-auth.accettazione', 'https://app.zeiras.com/legale/accetta');
    $classe = 'Zeiras\\Auth\\Errori\\AccettazioneRichiesta';

    $errore = null;
    try {
        Api::workspace()->get('/v1/board/board');
    } catch (ErroreApi $lanciato) {
        $errore = $lanciato;
    }

    expect($errore)->toBeInstanceOf(ErroreApi::class)
        ->and([$errore?->stato, $errore?->codice])->toBe([403, 'accettazione_richiesta']);

    if (! zrAuthRispondeDaSeAQuel403()) {
        expect(class_exists($classe))->toBe(false)
            ->and(method_exists($errore, 'render'))->toBe(false);

        return;
    }

    $pagina = 'https://board.zeiras.com/w/uat-marketing/b/01k6?vista=lista';
    $verso = 'https://app.zeiras.com/legale/accetta?ritorno='.rawurlencode($pagina);
    $allaVisita = $errore->render(RichiestaDelBrowser::create($pagina));
    $aInertia = $errore->render(RichiestaDelBrowser::create($pagina, server: ['HTTP_X_INERTIA' => 'true']));
    $alJson = $errore->render(RichiestaDelBrowser::create($pagina, server: ['HTTP_ACCEPT' => 'application/json']));
    // Seconda lettura della PR #52, S10 (sprint 25 · T5.6): la quarta forma. Sulla pagina dell'accettazione stessa — l'host e il
    // percorso di `zr-auth.accettazione`, con o senza la lingua davanti — risponde 403 anche a una visita e a una visita di
    // Inertia: un rimando la manderebbe a sé stessa. È la pagina di zr-home.
    $sullaPagina = array_map(
        fn (array $caso): array => [($risposta = $errore->render(RichiestaDelBrowser::create($caso[0], server: $caso[1])))->getStatusCode(), $risposta->headers->has('Location'), $risposta->headers->has('X-Inertia-Location'), json_decode((string) $risposta->getContent(), true)['codice'] ?? null],
        [
            ['https://app.zeiras.com/legale/accetta', []],
            ['https://app.zeiras.com/legale/accetta?ritorno='.rawurlencode($pagina), ['HTTP_X_INERTIA' => 'true']],
            ['https://app.zeiras.com/it/legale/accetta', []],
            ['https://app.zeiras.com/it/legale/accetta', ['HTTP_X_INERTIA' => 'true']],
        ],
    );
    // Solo lì: un altro percorso dello stesso host, e lo stesso percorso su un altro host, sono visite come le altre.
    $altrove = array_map(
        fn (string $indirizzo): int => $errore->render(RichiestaDelBrowser::create($indirizzo))->getStatusCode(),
        ['https://app.zeiras.com/legale/accetta/altro', 'https://board.zeiras.com/legale/accetta'],
    );

    expect($errore)->toBeInstanceOf($classe)
        ->and([$allaVisita->getStatusCode(), $allaVisita->headers->get('Location')])->toBe([302, $verso])
        ->and([$aInertia->getStatusCode(), $aInertia->headers->get('X-Inertia-Location'), $aInertia->headers->has('Location')])->toBe([409, $verso, false])
        ->and([$alJson->getStatusCode(), $alJson->headers->has('Location'), $alJson->headers->has('X-Inertia-Location')])->toBe([403, false, false])
        ->and(json_decode((string) $alJson->getContent(), true))->toBe(['codice' => 'accettazione_richiesta', 'mancanti' => [['documento' => 'segno-del-documento', 'versione' => 'segno-della-versione']]])
        ->and($sullaPagina)->toBe(array_fill(0, 4, [403, false, false, 'accettazione_richiesta']))
        ->and($altrove)->toBe([302, 302]);
});

// Seconda lettura della PR #52, S2 (sprint 25 · T5.2). Il README dice che cosa arriva al browser se un middleware del frontend
// chiama /v1 anche su una rotta della cornice senza prendere quel 403: la risposta non è più quella della rotta, è quella di
// zr-auth. È un'altra frase su zr-auth, e questo caso la guarda nel giro che la installa: dalla 0.12.17 è il 403 di
// `AccettazioneRichiesta`, con `codice` e `mancanti`, che la cornice riconosce dal `codice`; con una patch più vecchia
// l'ErroreApi non ha una risposta sua, ed è un 500 — nel browser l'errore di sempre, con «Riprova».
/** Il middleware di un frontend che a ogni richiesta chiama /v1 e non prende gli errori. In un gruppo sta per classe: una closure lì non è ammessa. */
final class ChiamaV1SenzaPrendereErrori
{
    public function handle(RichiestaDelBrowser $richiesta, Closure $next): mixed
    {
        Api::workspace()->get('/v1/board/board');

        return $next($richiesta);
    }
}

it('se un middleware del frontend chiama /v1 su una rotta della cornice senza prendere il 403 accettazione_richiesta, al browser non arriva la risposta della rotta: da zr-auth 0.12.17 il 403 di zr-auth con `codice` e `mancanti`, con una patch più vecchia un 500 (sprint 25 · T5.2)', function () {
    sessioneAMano(marketing());
    Http::fake(['*' => accettazioneRichiesta()]);
    // In fondo al gruppo `web`, dopo la sessione e prima della rotta, come quello di un frontend. Si dà al kernel, che i gruppi li
    // ridà al router: messo nel router prima della prima richiesta, il kernel lo coprirebbe coi suoi.
    app(HttpKernel::class)->appendMiddlewareToGroup('web', ChiamaV1SenzaPrendereErrori::class);

    $risposta = $this->getJson('cornice/notifiche');

    // Una chiamata sola, quella del middleware: la rotta non è partita, e la sua risposta — `{"errore": …}` — non c'è.
    Http::assertSentCount(1);
    expect((string) $risposta->getContent())->not->toContain('"errore"');

    if (! zrAuthRispondeDaSeAQuel403()) {
        expect($risposta->getStatusCode())->toBe(500);

        return;
    }

    expect($risposta->getStatusCode())->toBe(403)
        ->and(json_decode((string) $risposta->getContent(), true))->toBe(['codice' => 'accettazione_richiesta', 'mancanti' => [['documento' => 'segno-del-documento', 'versione' => 'segno-della-versione']]]);
});

// Sprint 28 · T3 (voce #1827). `Cornice::frenata()`: un modulo che ha messo la lingua con la riga sa se la lettura di io.mostra
// di questa richiesta ha preso un 429, e risponde col suo 429 senza richiamare il backoffice. Guarda la lettura tenuta sulla
// richiesta e non ne fa partire una; il freno si riconosce dallo stato, 429, non dal codice. Il 429 è `troppeRichieste()` di
// RicercaTest.php.

/**
 * Due pagine di un modulo nel gruppo `web` che rispondono con ciò che `Cornice::frenata()` dà: la prima dopo la riga, messa
 * in un middleware come in `paginaConLaRiga()`, la seconda senza nessuna lettura della cornice.
 */
function pagineDelFreno(): void
{
    Route::aliasMiddleware('la-riga', function ($richiesta, Closure $next) {
        App::setLocale(Cornice::lingua() ?? 'nessuna');

        return $next($richiesta);
    });
    $freno = fn () => ['frenata' => Cornice::frenata() !== null, 'riprova_fra' => Cornice::frenata()?->riprovaFra];
    Route::middleware(['web', 'la-riga'])->get('w/{slug}/con-la-riga', $freno);
    Route::middleware('web')->get('w/{slug}/senza-la-riga', $freno);
}

it('dopo una riga che ha preso un 429 da io.mostra Cornice::frenata() dà l\'errore di quella lettura, coi secondi di Retry-After o null se il backoffice non li dice, e non richiama il backoffice (sprint 28 · T3.1)', function (?string $riprovaFra, ?string $codice) {
    sessioneAMano(marketing());
    backoffice(['/v1/io' => troppeRichieste($riprovaFra, 429, $codice)]);

    expect(Cornice::lingua())->toBe('en');
    $frenata = Cornice::frenata();

    expect($frenata)->toBeInstanceOf(ErroreApi::class)
        ->and([$frenata->stato, $frenata->codice, $frenata->riprovaFra])->toBe([429, $codice, $riprovaFra === null ? null : (int) $riprovaFra])
        // Chiesta due volte è lo stesso errore, quello nato nella lettura della riga.
        ->and(Cornice::frenata())->toBe($frenata)
        ->and(in_array('lingua', array_column($frenata->getTrace(), 'function'), true))->toBeTrue()
        ->and(richiesteA('/v1/io'))->toHaveCount(1)
        ->and(Http::recorded())->toHaveCount(1);
})->with([
    'con Retry-After' => ['30', 'troppe_richieste'],
    'senza Retry-After' => [null, 'troppe_richieste'],
    'un 429 con un altro codice' => ['12', 'uat_altro_freno'],
    'un 429 senza codice' => [null, null],
]);

it('senza una lettura in questa richiesta Cornice::frenata() dà null e non legge lei: con la sessione in un workspace, con la sessione senza workspace e senza sessione il backoffice non è chiamato (sprint 28 · T3.2)', function (string $sessione) {
    if ($sessione !== 'nessuna') {
        sessioneAMano($sessione === 'in un workspace' ? marketing() : null);
    }
    $prima = session(Sessione::CHIAVE);
    backoffice(['/v1/io' => troppeRichieste('30')]);

    expect(Cornice::frenata())->toBeNull()
        ->and(session(Sessione::CHIAVE))->toBe($prima)
        ->and(Http::recorded())->toHaveCount(0);
})->with(['in un workspace', 'senza workspace', 'nessuna']);

it('dopo una lettura andata bene, o fallita per un altro motivo, Cornice::frenata() dà null e non richiama il backoffice: solo il 429 è un freno (sprint 28 · T3.2)', function (int $stato, mixed $corpo) {
    sessioneAMano(marketing());
    backoffice(['/v1/io' => match (true) {
        $stato === 0 => Http::failedConnection(),
        $stato === 200 => ioMostra(3),
        $corpo === 'accettazione' => accettazioneRichiesta(),
        is_string($corpo) => troppeRichieste('30', $stato, $corpo),
        default => Http::response('', $stato),
    }]);

    expect(Cornice::lingua())->toBe('en')
        ->and(Cornice::frenata())->toBeNull()
        ->and(Http::recorded())->toHaveCount(1);
})->with([
    'andata bene' => [200, null],
    'il 403 accettazione_richiesta' => [403, 'accettazione'],
    'un 403 con un altro codice, e Retry-After' => [403, 'gettone_senza_workspace'],
    'un 404 col codice del freno' => [404, 'troppe_richieste'],
    'un 500 col codice del freno' => [500, 'troppe_richieste'],
    'un 502 vuoto' => [502, null],
    'la connessione cade' => [0, null],
]);

it('dopo una Cornice::dati() che per quel 429 ha lanciato Cornice::frenata() dà lo stesso errore, in tutti e due gli ordini; la riga dà la lingua della sessione e i dati lanciano, come prima (sprint 28 · T3.3)', function (bool $primaLaRiga) {
    sessioneAMano(marketing());
    $prima = session(Sessione::CHIAVE);
    backoffice(['/v1/io' => troppeRichieste('7'), ...aziendeEWorkspace()]);

    $lingua = $primaLaRiga ? Cornice::lingua() : null;
    $frenataPrimaDeiDati = Cornice::frenata();

    try {
        Cornice::dati();
        $lanciato = null;
    } catch (ErroreApi $errore) {
        $lanciato = $errore;
    }

    expect($lanciato)->toBeInstanceOf(ErroreApi::class)
        ->and([$lanciato->stato, $lanciato->riprovaFra])->toBe([429, 7])
        ->and(Cornice::frenata())->toBe($lanciato)
        // Prima dei dati il freno c'è solo se una lettura c'è già stata: guardarlo non la fa partire.
        ->and($frenataPrimaDeiDati)->toBe($primaLaRiga ? $lanciato : null)
        ->and($lingua ?? Cornice::lingua())->toBe('en')
        ->and(session(Sessione::CHIAVE))->toBe($prima)
        ->and(Http::recorded())->toHaveCount(1);
})->with(['prima la riga' => [true], 'prima i dati' => [false]]);

it('il freno è della richiesta: la richiesta dopo, nello stesso processo, non lo trova e non chiama il backoffice per saperlo, finché una lettura non prende un altro 429 (sprint 28 · T3.4)', function () {
    sessioneAMano(marketing());
    backoffice(['/v1/io' => Http::sequence()->pushResponse(troppeRichieste('30'))->pushResponse(troppeRichieste('5'))]);
    pagineDelFreno();

    $laPrima = $this->get('w/uat-marketing/con-la-riga')->assertOk();
    $senzaLettura = $this->get('w/uat-marketing/senza-la-riga')->assertOk();
    $laTerza = $this->get('w/uat-marketing/con-la-riga')->assertOk();

    expect([$laPrima->json('frenata'), $senzaLettura->json('frenata'), $laTerza->json('frenata')])->toBe([true, false, true])
        ->and([$laPrima->json('riprova_fra'), $senzaLettura->json('riprova_fra'), $laTerza->json('riprova_fra')])->toBe([30, null, 5])
        // Due letture, quelle delle due righe: la richiesta di mezzo non ne ha fatte.
        ->and(richiesteA('/v1/io'))->toHaveCount(2)
        ->and(Http::recorded())->toHaveCount(2);
});

it('il middleware del README, riga per riga: dopo la riga, se la lettura ha preso un 429 il modulo risponde col suo 429, con Retry-After se il backoffice l\'ha detto, e la chiamata a /v1 del controller non parte; senza freno parte (sprint 28 · T3.5)', function (bool $frenato, ?string $riprovaFra) {
    sessioneAMano(marketing());
    backoffice(['/v1/io' => $frenato ? troppeRichieste($riprovaFra) : ioMostra(0), '/v1/board/board' => ['data' => [], 'successivo' => null]]);
    Route::aliasMiddleware('la-riga-col-freno', function ($request, Closure $next) {
        App::setLocale(Cornice::lingua() ?? config('app.locale'));

        $freno = Cornice::frenata();

        if ($freno !== null) {
            return response('', 429, $freno->riprovaFra === null ? [] : ['Retry-After' => (string) $freno->riprovaFra]);
        }

        return $next($request);
    });
    Route::middleware(['web', 'la-riga-col-freno'])->get('w/{slug}/chiama-v1', fn () => ['chiamato' => Api::workspace()->get('/v1/board/board') !== []]);

    $risposta = $this->get('w/uat-marketing/chiama-v1');

    expect([$risposta->getStatusCode(), $risposta->headers->get('Retry-After')])->toBe($frenato ? [429, $riprovaFra] : [200, null])
        ->and($risposta->getContent())->toBe($frenato ? '' : '{"chiamato":true}')
        // Dopo il freno il backoffice non è più chiamato: resta la lettura della riga.
        ->and(percorsiChiamati())->toBe($frenato ? ['/v1/io'] : ['/v1/io', '/v1/board/board']);
})->with([
    'frenato, con Retry-After' => [true, '30'],
    'frenato, senza Retry-After' => [true, null],
    'senza freno' => [false, null],
]);
