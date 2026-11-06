<?php

use Illuminate\Http\Client\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Zeiras\Auth\Errori\BackofficeNonRisponde;
use Zeiras\Auth\Errori\ErroreApi;
use Zeiras\Auth\Errori\GettoneRifiutato;
use Zeiras\Auth\Sessione;
use Zeiras\Core\Cornice;
use Zeiras\Core\Http\FotoDellaCornice;

// Sprint 110 · T1 (voce #3319, da zr-home #3317). `Cornice::datiDelCliente()` dà alla cornice di chi è solo cliente (le pagine
// /spazio/* di zr-home, design zr-account--il-mio-spazio) i dati della persona con la sessione dell'accesso, anche senza
// workspace: lingua e persona dalla sessione dopo `Sessione::aggiorna` con io.mostra letto col gettone dell'accesso, la foto, e
// le aziende in cui la persona è membro (la schermata 13). Il backoffice è Http::fake: un percorso che qui non ha risposta lo
// ferma TestCase.

/**
 * Il backoffice del cliente: io.mostra col gettone dell'accesso (workspace, ruolo e non lette null) e i due elenchi vuoti, salvo
 * ciò che il caso dà al loro posto.
 *
 * @param  array<string, mixed>  $risposte  per percorso: un corpo JSON, o una risposta
 */
function backofficeDelCliente(array $risposte = []): void
{
    $risposte += [
        '/v1/io' => ioDelCliente(),
        '/v1/io/aziende' => ['data' => [], 'successivo' => null],
        '/v1/io/workspace' => ['data' => [], 'successivo' => null],
    ];

    Http::fake(function (Request $richiesta) use ($risposte) {
        $risposta = $risposte[parse_url($richiesta->url(), PHP_URL_PATH)] ?? null;

        return match (true) {
            is_array($risposta) => Http::response($risposta),
            $risposta instanceof Closure => $risposta(),
            default => $risposta,
        };
    });
}

/**
 * io.mostra col gettone dell'accesso: la persona com'è nel profilo, in spagnolo e con un altro nome di quello dell'ingresso, e
 * null a workspace, ruolo e non lette.
 *
 * @param  array<string, mixed>  $utente  ciò che cambia nella persona
 * @return array{data: array<string, mixed>}
 */
function ioDelCliente(array $utente = []): array
{
    return ['data' => [
        'utente' => $utente + ['id' => 'uat-ada', 'nome' => 'UAT Ada Cliente', 'email' => 'uat-ada@example.com', 'email_verificata_il' => now()->toIso8601String(), 'lingua' => 'es', 'fuso_orario' => 'Europe/Rome', 'foto_aggiornata_il' => null],
        'workspace' => null,
        'ruolo' => null,
        'notifiche_non_lette' => null,
    ]];
}

/** I percorsi di /v1 chiamati, nell'ordine. */
function chiamateDelCliente(): array
{
    return Http::recorded()->map(fn (array $coppia) => parse_url($coppia[0]->url(), PHP_URL_PATH))->all();
}

it('con la sessione dell\'accesso senza workspace dà lingua e persona di io.mostra, letto col gettone dell\'accesso anche con le non lette null, le aziende e il segno (sprint 110 · T1.1)', function () {
    Carbon::setTestNow(Carbon::parse('2026-11-06 10:00:00.000000', 'UTC'));
    $gettoni = sessioneAMano(null);
    backofficeDelCliente();

    expect(Cornice::datiDelCliente())->toBe([
        'lingua' => 'es',
        'persona' => ['nome' => 'UAT Ada Cliente', 'email' => 'uat-ada@example.com', 'impronta' => improntaDi('uat-ada')],
        'aziende' => [],
        'non_lette' => 0,
        'aggiornati_il' => '2026-11-06T10:00:00.000000Z',
    ]);
    $io = Http::recorded()->first(fn (array $coppia) => parse_url($coppia[0]->url(), PHP_URL_PATH) === '/v1/io')[0];
    expect($io->hasHeader('Authorization', 'Bearer '.$gettoni['accesso']))->toBeTrue()
        // La sessione ha preso la lingua e il nome del profilo: Sessione::aggiorna con la stessa lettura.
        ->and(Sessione::utente()['lingua'])->toBe('es')
        ->and(Sessione::utente()['nome'])->toBe('UAT Ada Cliente');
});

it('con un workspace nella sessione legge lo stesso col gettone dell\'accesso, e nei dati non c\'è il workspace (sprint 110 · T1.1)', function () {
    $gettoni = sessioneAMano(['id' => 'uat-ws', 'nome' => 'UAT Marketing', 'slug' => 'uat-marketing']);
    backofficeDelCliente();

    $dati = Cornice::datiDelCliente();

    expect(array_keys($dati))->toBe(['lingua', 'persona', 'aziende', 'non_lette', 'aggiornati_il'])
        ->and(Http::recorded()->every(fn (array $coppia) => $coppia[0]->hasHeader('Authorization', 'Bearer '.$gettoni['accesso'])))->toBeTrue();
});

it('con la foto la persona ha `foto`, l\'indirizzo della rotta della foto col `?v=` del momento e `p`; senza, la chiave non c\'è (sprint 110 · T1.2)', function (mixed $il, ?string $atteso) {
    sessioneAMano(null);
    backofficeDelCliente(['/v1/io' => ioDelCliente(['foto_aggiornata_il' => $il])]);

    $persona = Cornice::datiDelCliente()['persona'];

    $atteso === null
        ? expect(array_key_exists('foto', $persona))->toBeFalse()
        : expect($persona['foto'])->toBe('/cornice/foto?v='.$atteso.'&p='.FotoDellaCornice::diChi('uat-ada'));
})->with([
    'con la foto' => ['2026-11-04T09:30:00.000000Z', '2026-11-04T09%3A30%3A00.000000Z'],
    'senza foto' => [null, null],
    'vuota' => ['', null],
]);

it('le aziende sono quelle in cui la persona è membro, coi loro workspace, lette col gettone dell\'accesso; quelle di un workspace di un\'azienda che non è nell\'elenco no (sprint 110 · T1.3)', function () {
    $gettoni = sessioneAMano(null);
    backofficeDelCliente([
        '/v1/io/aziende' => ['data' => [['id' => 'az-r', 'nome' => 'UAT Rossi Interior']], 'successivo' => null],
        '/v1/io/workspace' => ['data' => [
            ['id' => 'uat-ws-p', 'nome' => 'UAT Progetti', 'slug' => 'uat-progetti', 'ruolo' => 'proprietario', 'azienda_id' => 'az-r', 'colore' => 'citrus'],
            ['id' => 'uat-ws-x', 'nome' => 'UAT di un altro', 'slug' => 'uat-altro', 'ruolo' => 'membro', 'azienda_id' => 'az-x'],
        ], 'successivo' => null],
    ]);

    expect(Cornice::datiDelCliente()['aziende'])->toBe([
        ['id' => 'az-r', 'nome' => 'UAT Rossi Interior', 'workspace' => [['id' => 'uat-ws-p', 'nome' => 'UAT Progetti', 'slug' => 'uat-progetti', 'colore' => 'citrus']], 'nuovo_workspace' => true],
    ]);
    foreach (Http::recorded() as [$richiesta]) {
        expect($richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['accesso']))->toBeTrue();
    }
});

it('una riga delle aziende senza i suoi campi è un guasto, non un\'azienda (sprint 110 · T1.3)', function () {
    sessioneAMano(null);
    backofficeDelCliente(['/v1/io/aziende' => ['data' => [['id' => 'az-r']], 'successivo' => null]]);

    expect(fn () => Cornice::datiDelCliente())->toThrow(BackofficeNonRisponde::class);
});

it('senza sessione dà null e non chiama il backoffice (sprint 110 · T1.4)', function () {
    backofficeDelCliente();

    expect(Cornice::datiDelCliente())->toBeNull()
        ->and(chiamateDelCliente())->toBe([]);
});

// Sprint 116 · T1.4 (voce #3398): dal #3323 io.mostra col gettone dell'accesso dà `notifiche_non_lette`, le notifiche da cliente
// non lette. Nei dati del cliente è `non_lette`, dalla stessa lettura: nessuna chiamata in più.

it('i dati del cliente portano `non_lette`, `notifiche_non_lette` di io.mostra letto col gettone dell\'accesso, con una sola GET /v1/io (sprint 116 · T1.4)', function (?array $workspace) {
    $gettoni = sessioneAMano($workspace);
    backofficeDelCliente(['/v1/io' => ['data' => ['notifiche_non_lette' => 3] + ioDelCliente()['data']]]);

    $dati = Cornice::datiDelCliente();

    expect($dati['non_lette'] ?? null)->toBe(3)
        ->and(array_count_values(chiamateDelCliente())['/v1/io'])->toBe(1)
        ->and(Http::recorded()->every(fn (array $coppia) => $coppia[0]->hasHeader('Authorization', 'Bearer '.$gettoni['accesso'])))->toBeTrue();
})->with(['senza workspace' => [null], 'con un workspace' => [['id' => 'uat-ws', 'nome' => 'UAT Marketing', 'slug' => 'uat-marketing']]]);

it('`non_lette` è 0 quando io.mostra non dà un intero da 0 in su: null, senza, un numero negativo, un testo, un decimale (sprint 116 · T1.4)', function (array $io) {
    sessioneAMano(null);
    backofficeDelCliente(['/v1/io' => ['data' => $io]]);

    expect(Cornice::datiDelCliente()['non_lette'] ?? null)->toBe(0);
})->with([
    // Funzioni, chiamate quando il caso gira: io.mostra ha la data di adesso, che fuori dal caso non c'è.
    'null' => [fn () => ioDelCliente()['data']],
    'senza' => [fn () => array_diff_key(ioDelCliente()['data'], ['notifiche_non_lette' => true])],
    'meno uno' => [fn () => ['notifiche_non_lette' => -1] + ioDelCliente()['data']],
    'il testo "3"' => [fn () => ['notifiche_non_lette' => '3'] + ioDelCliente()['data']],
    'un decimale' => [fn () => ['notifiche_non_lette' => 2.5] + ioDelCliente()['data']],
]);

// Sprint 116 · T4 (voce #3398): le chiavi dei dati sono quelle che la cornice del cliente legge. Il T3 leggeva
// `notifiche_non_lette` e il server dà `non_lette`: con la demo scritta a mano, numero e campanella sembravano giusti.
it('ogni chiave dei dati del cliente è una proprietà di `DatiDelCliente` in cliente.tsx, `non_lette` compresa (sprint 116 · T4)', function () {
    sessioneAMano(null);
    backofficeDelCliente(['/v1/io' => ['data' => ['notifiche_non_lette' => 3] + ioDelCliente()['data']]]);
    preg_match('/export interface DatiDelCliente \{(.*?)\n\}/s', (string) file_get_contents(__DIR__.'/../../resources/js/cliente.tsx'), $tipo);
    preg_match_all('/^    (\w+)\??:/m', $tipo[1] ?? '', $proprieta);

    expect(array_values(array_diff(array_keys(Cornice::datiDelCliente() ?? []), $proprieta[1])))->toBe([])
        ->and($proprieta[1])->toContain('non_lette', 'accettazione_richiesta');
});

it('col 403 accettazione_richiesta dà la persona della sessione, senza foto e senza aziende, con accettazione_richiesta (sprint 110 · T1.4)', function () {
    Carbon::setTestNow(Carbon::parse('2026-11-06 10:00:00.000000', 'UTC'));
    sessioneAMano(null);
    backofficeDelCliente(['/v1/io' => accettazioneRichiesta()]);

    expect(Cornice::datiDelCliente())->toBe([
        'lingua' => 'en',
        'persona' => ['nome' => 'UAT Ada', 'email' => 'uat-ada@example.com', 'impronta' => improntaDi('uat-ada')],
        'aziende' => [],
        'aggiornati_il' => '2026-11-06T10:00:00.000000Z',
        'accettazione_richiesta' => true,
    ])->and(chiamateDelCliente())->toBe(['/v1/io']);
});

it('col 403 accettazione_richiesta sulle aziende, dopo io.mostra, dà anche lì i dati ridotti (sprint 110 · T1.4, revisione R9)', function () {
    sessioneAMano(null);
    backofficeDelCliente(['/v1/io/aziende' => accettazioneRichiesta()]);

    $dati = Cornice::datiDelCliente();

    expect($dati['accettazione_richiesta'] ?? null)->toBeTrue()
        ->and($dati['aziende'] ?? null)->toBe([])
        ->and($dati['persona'] ?? [])->not->toHaveKey('foto')
        ->and(chiamateDelCliente())->toContain('/v1/io/aziende');
});

it('ogni altro errore del backoffice arriva a chi chiama com\'è (sprint 110 · T1.4)', function (mixed $risposta, string $classe) {
    sessioneAMano(null);
    backofficeDelCliente(['/v1/io' => $risposta]);

    expect(fn () => Cornice::datiDelCliente())->toThrow($classe);
})->with([
    'un 503 col suo codice' => [fn () => Http::response(['codice' => 'servizio_non_disponibile', 'status' => 503], 503), ErroreApi::class],
    'un 503 senza JSON' => [fn () => Http::response('guasto', 503), BackofficeNonRisponde::class],
    'un 403 con un altro codice' => [fn () => accettazioneRichiesta(403, 'permesso_negato'), ErroreApi::class],
    'una risposta senza la persona' => [fn () => Http::response(['data' => ['utente' => null]]), BackofficeNonRisponde::class],
]);

// Sprint 112 · T1 (voce #3335, Decisione 21806 di zr-pm-07). `Cornice::linguaDelCliente()` dà al middleware delle pagine di chi è
// solo cliente la lingua del profilo già aggiornata, con la sessione dell'accesso; nella stessa richiesta `datiDelCliente()` usa la
// sua lettura di io.mostra invece di rifarla, come `dati()` con `lingua()`.

it('linguaDelCliente() legge io.mostra col gettone dell\'accesso, anche con un workspace nella sessione, aggiorna la sessione e dà la lingua del profilo (sprint 112 · T1.1)', function (?array $workspace) {
    $gettoni = sessioneAMano($workspace);
    backofficeDelCliente();

    expect(Cornice::linguaDelCliente())->toBe('es')
        ->and(Sessione::utente()['lingua'])->toBe('es')
        ->and(chiamateDelCliente())->toBe(['/v1/io'])
        ->and(Http::recorded()->first()[0]->hasHeader('Authorization', 'Bearer '.$gettoni['accesso']))->toBeTrue();
})->with([
    'senza workspace' => [null],
    'con un workspace' => [['id' => 'uat-ws', 'nome' => 'UAT Marketing', 'slug' => 'uat-marketing']],
]);

it('datiDelCliente() dopo linguaDelCliente() usa la stessa lettura: /v1/io una volta, la stessa lingua e lo stesso segno; una seconda datiDelCliente() rilegge (sprint 112 · T1.2)', function () {
    Carbon::setTestNow(Carbon::parse('2026-11-06 10:00:00.000000', 'UTC'));
    sessioneAMano(null);
    backofficeDelCliente();

    $lingua = Cornice::linguaDelCliente();
    Carbon::setTestNow(Carbon::parse('2026-11-06 10:00:01.000000', 'UTC'));
    $dati = Cornice::datiDelCliente();

    expect([$lingua, $dati['lingua'], $dati['aggiornati_il'], array_count_values(chiamateDelCliente())['/v1/io']])
        ->toBe(['es', 'es', '2026-11-06T10:00:00.000000Z', 1]);
    expect([Cornice::datiDelCliente()['aggiornati_il'], array_count_values(chiamateDelCliente())['/v1/io']])
        ->toBe(['2026-11-06T10:00:01.000000Z', 2]);
});

it('la lettura di linguaDelCliente() è della persona che l\'ha fatta: con un\'altra persona nella sessione datiDelCliente() rilegge (sprint 112 · T1.2)', function () {
    // io.mostra risponde per la persona della sessione: Bea ha l'italiano nel profilo.
    backofficeDelCliente(['/v1/io' => fn () => Http::response(ioDelCliente(Sessione::utente()['id'] === 'uat-bea' ? ['id' => 'uat-bea', 'email' => 'uat-bea@example.com', 'lingua' => 'it'] : []))]);
    sessioneAMano(null);
    Cornice::linguaDelCliente();

    sessioneAMano(null, 'en', ['id' => 'uat-bea', 'email' => 'uat-bea@example.com']);

    // Con la lettura di prima i dati avrebbero la lingua della sessione di adesso, 'en': 'it' è quella riletta per lei.
    expect(Cornice::datiDelCliente()['lingua'])->toBe('it');
});

it('linguaDelCliente() senza sessione dà null e non chiama il backoffice (sprint 112 · T1.3)', function () {
    backofficeDelCliente();

    expect(Cornice::linguaDelCliente())->toBeNull()
        ->and(chiamateDelCliente())->toBe([]);
});

it('linguaDelCliente() con una lingua che non ha la forma di una lingua dà null: va a App::setLocale (sprint 112 · T1.3)', function () {
    sessioneAMano(null, 'es/../x');
    backofficeDelCliente(['/v1/io' => ioDelCliente(['lingua' => 'es/../x'])]);

    expect(Cornice::linguaDelCliente())->toBeNull();
});

it('linguaDelCliente() non lancia: davanti a un guasto del backoffice dà la lingua della sessione con un avviso nel log, al 403 accettazione_richiesta senza; la datiDelCliente() dopo non rilegge, e lancia quell\'errore o dà i dati ridotti (sprint 112 · T1.3)', function (Closure $risposta, ?string $classe) {
    Log::spy();
    sessioneAMano(null);
    backofficeDelCliente(['/v1/io' => $risposta]);

    expect(Cornice::linguaDelCliente())->toBe('en');
    if ($classe === null) {
        expect(Cornice::datiDelCliente()['accettazione_richiesta'] ?? null)->toBeTrue();
    } else {
        expect(fn () => Cornice::datiDelCliente())->toThrow($classe);
    }
    // Un avviso solo, quello di linguaDelCliente(): la datiDelCliente() dopo non ne scrive (R1 della revisione).
    $classe === null ? Log::shouldNotHaveReceived('warning') : Log::shouldHaveReceived('warning')->once();
    expect(chiamateDelCliente())->toBe(['/v1/io']);
})->with([
    'un 503 col suo codice' => [fn () => Http::response(['codice' => 'servizio_non_disponibile', 'status' => 503], 503), ErroreApi::class],
    'un 503 senza JSON' => [fn () => Http::response('guasto', 503), BackofficeNonRisponde::class],
    'una risposta senza la persona' => [fn () => Http::response(['data' => ['utente' => null]]), BackofficeNonRisponde::class],
    'il 403 accettazione_richiesta' => [fn () => accettazioneRichiesta(), null],
]);

it('linguaDelCliente() lascia passare il gettone rifiutato: la sessione è finita, e lo tratta il frontend (sprint 112 · T1.3)', function () {
    sessioneAMano(null);
    backofficeDelCliente(['/v1/io' => fn () => Http::response((string) json_encode(['type' => 'about:blank', 'title' => 'uat', 'status' => 401, 'detail' => 'uat', 'codice' => 'gettone_scaduto']), 401, ['Content-Type' => 'application/problem+json'])]);

    expect(fn () => Cornice::linguaDelCliente())->toThrow(GettoneRifiutato::class);
});

// Sprint 113 · T1 (voce #3341, Decisione 21833 di zr-pm): con il prefisso di lingua nell'indirizzo (zr-home /en/spazio/...) il
// modulo dà a `datiDelCliente()` la lingua della pagina, e la cornice del cliente parla quella; la sessione resta com'è.

it('datiDelCliente() con la lingua della pagina dà quella lingua, e il resto come senza; la sessione resta nella lingua del profilo (sprint 113 · T1.1)', function () {
    Carbon::setTestNow(Carbon::parse('2026-11-06 10:00:00.000000', 'UTC'));
    sessioneAMano(null);
    backofficeDelCliente();

    expect(Cornice::datiDelCliente('en'))->toBe([
        'lingua' => 'en',
        'persona' => ['nome' => 'UAT Ada Cliente', 'email' => 'uat-ada@example.com', 'impronta' => improntaDi('uat-ada')],
        'aziende' => [],
        'non_lette' => 0,
        'aggiornati_il' => '2026-11-06T10:00:00.000000Z',
    ])->and(Sessione::utente()['lingua'])->toBe('es')
        ->and(Cornice::datiDelCliente()['lingua'])->toBe('es');
});

it('datiDelCliente() senza la lingua della pagina, o con null, dà la lingua del profilo; una lingua malfatta non entra nei dati (sprint 113 · T1.2)', function (?string $pagina) {
    sessioneAMano(null);
    backofficeDelCliente();

    expect(Cornice::datiDelCliente($pagina)['lingua'])->toBe('es');
})->with([
    'null' => [null],
    'vuota' => [''],
    'con una barra' => ['en/../x'],
    // con la forma di una lingua, ma 42 caratteri: lo ferma il limite di 35, non la forma (revisione PR #184, R1)
    'oltre 35 caratteri' => ['en-'.implode('-', array_fill(0, 5, 'aaaaaaa'))],
]);

it('col 403 accettazione_richiesta i dati ridotti hanno la lingua della pagina, e la sessione resta com\'è (sprint 113 · T1.3)', function () {
    sessioneAMano(null);
    backofficeDelCliente(['/v1/io' => accettazioneRichiesta()]);

    $dati = Cornice::datiDelCliente('it');
    expect([$dati['lingua'], $dati['accettazione_richiesta'], Sessione::utente()['lingua']])->toBe(['it', true, 'en']);
});

it('datiDelCliente() con la lingua della pagina dopo linguaDelCliente() usa la stessa lettura: /v1/io una volta (sprint 113 · T1.3)', function () {
    sessioneAMano(null);
    backofficeDelCliente();

    $lingua = Cornice::linguaDelCliente();
    expect([$lingua, Cornice::datiDelCliente('it')['lingua'], array_count_values(chiamateDelCliente())['/v1/io']])->toBe(['es', 'it', 1]);
});

it('datiDelCliente() prende una lingua con la forma di una lingua anche se Zeiras non la traduce: i testi mancanti la cornice li mostra in inglese (sprint 113 · T1.2, revisione PR #184 R2)', function () {
    sessioneAMano(null);
    backofficeDelCliente();

    expect(Cornice::datiDelCliente('pt-BR')['lingua'])->toBe('pt-BR');
});
