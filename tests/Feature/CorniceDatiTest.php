<?php

use Illuminate\Http\Client\Request;
use Illuminate\Http\Client\ResponseSequence;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Zeiras\Auth\Errori\BackofficeNonRisponde;
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

it('con la sessione entrata in un workspace dà persona, lingua, il workspace del gettone, lo stato di ogni app, le aziende coi loro workspace, le non lette e il segno (sprint 2 · T3.1; sprint 3 · T1.1, T1.2; sprint 10 · T1.3)', function () {
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

// Sprint 13 · T2 (voce #1480): la lingua e il nome cambiati nel profilo arrivano ai moduli senza uscire e rientrare. A ogni
// lettura la cornice dà a Sessione::aggiorna di zr-auth (dalla 0.12) la risposta di io.mostra che ha già letto per le non
// lette: la sessione prende la lingua e il nome del profilo, e i dati della cornice li portano da quella stessa richiesta.
// Solo quei due, e solo come li accetta zr-auth; nessuna lettura in più. La pagina `w/{slug}/sessione` di TestCase dà la
// persona della sessione senza chiamare la cornice.

/**
 * io.mostra dopo un cambio nel profilo: la persona dei test con questi campi al posto dei suoi. Un valore che non è una lista
 * di campi va al posto della persona intera, com'è: un backoffice che sbaglia.
 *
 * @return array{data: array<string, mixed>}
 */
function ioMostraCon(mixed $utente, int $nonLette = 3): array
{
    $io = ioMostra($nonLette);
    $io['data']['utente'] = is_array($utente) ? [...$io['data']['utente'], ...$utente] : $utente;

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

    $this->get('w/un-altro-workspace/cornice')->assertOk()->assertExactJson([
        'lingua' => 'es',
        'persona' => ['nome' => 'UAT Ada Lovelace', 'email' => 'uat-ada@example.com'],
        'workspace' => ['nome' => 'UAT Marketing', 'slug' => 'uat-marketing'],
        'prodotti' => ['pm' => 'attivo', 'crm' => 'disponibile'],
        'aziende' => [
            ['id' => 'az-b', 'nome' => 'UAT agenzia', 'workspace' => [['nome' => 'UAT Marketing', 'slug' => 'uat-marketing']]],
            ['id' => 'az-a', 'nome' => 'UAT Studio', 'workspace' => [['nome' => 'UAT clienti', 'slug' => 'uat-clienti'], ['nome' => 'UAT Vendite', 'slug' => 'uat-vendite']]],
        ],
        'non_lette' => 3,
        'aggiornati_il' => '2026-10-10T09:40:00.000001Z',
    ]);
});

it('alla richiesta dopo una pagina che legge la sessione senza chiamare la cornice trova la lingua e il nome nuovi, e il backoffice non è chiamato (sprint 13 · T2.2)', function () {
    sessioneAMano(marketing());
    backoffice(['/v1/io' => ioMostraCon(['lingua' => 'es', 'nome' => 'UAT Ada Lovelace'])]);

    $this->get('w/uat-marketing/cornice')->assertOk();
    expect(Http::recorded())->toHaveCount(4);

    // La pagina dopo non chiama Cornice::dati(): legge la persona dalla sessione, come un middleware che ne prende la lingua.
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

it('ciò che non vale non entra: i dati di un\'altra persona, una lingua o un nome che non sono una stringa con qualcosa dentro, gli stessi valori (sprint 13 · T2.5)', function (mixed $utente, string $lingua, string $nome) {
    sessioneAMano(marketing());
    $prima = session(Sessione::CHIAVE);
    backoffice(['/v1/io' => ioMostraCon($utente)]);

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

it('un io.mostra senza un numero valido di non lette resta un guasto e non tocca la sessione, anche se porta una lingua e un nome nuovi (sprint 13 · T2.6)', function (mixed $corpo) {
    sessioneAMano(marketing());
    $prima = session(Sessione::CHIAVE);
    backoffice(['/v1/io' => Http::response($corpo), ...aziendeEWorkspace()]);

    expect(fn () => Cornice::dati())->toThrow(BackofficeNonRisponde::class)
        ->and(session(Sessione::CHIAVE))->toBe($prima);
})->with([
    'notifiche_non_lette manca' => [['data' => ['utente' => adaCambiata(), 'workspace' => ['id' => 'uat-ws'], 'ruolo' => 'membro']]],
    'null, come col gettone dell\'accesso' => [['data' => ['utente' => adaCambiata(), 'workspace' => null, 'ruolo' => null, 'notifiche_non_lette' => null]]],
    'una stringa' => [['data' => ['utente' => adaCambiata(), 'notifiche_non_lette' => '7']]],
    'un decimale' => [['data' => ['utente' => adaCambiata(), 'notifiche_non_lette' => 7.5]]],
    'un booleano' => [['data' => ['utente' => adaCambiata(), 'notifiche_non_lette' => true]]],
    'negativo' => [['data' => ['utente' => adaCambiata(), 'notifiche_non_lette' => -1]]],
    'senza data, con la persona e il numero in cima' => [['utente' => adaCambiata(), 'notifiche_non_lette' => 7]],
]);

it('senza una sessione entrata in un workspace la cornice dà null e non legge io.mostra: la sessione resta com\'è (sprint 13 · T2.6)', function () {
    sessioneAMano(null);
    $prima = session(Sessione::CHIAVE);
    // Se la cornice leggesse io.mostra ci troverebbe una lingua e un nome nuovi.
    backoffice(['/v1/io' => ioMostraCon(['lingua' => 'es', 'nome' => 'UAT Ada Lovelace'])]);

    expect(Cornice::dati())->toBeNull()
        ->and(session(Sessione::CHIAVE))->toBe($prima);
    Http::assertNothingSent();
});

it('se la sessione scade mentre la cornice legge io.mostra arriva GettoneRifiutato di zr-auth, come prima: la persona che la sessione non dà più non rompe la lettura (sprint 13 · T2)', function () {
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
