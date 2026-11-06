<?php

use Illuminate\Http\Client\Request;
use Illuminate\Http\Request as RichiestaDelBrowser;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Zeiras\Auth\Persona;
use Zeiras\Core\Http\NotificheDellaCornice;

// Sprint 116 · T1 (voce #3398, Decisione 22367 di zr-pm). Le notifiche da cliente per la cornice di chi è solo cliente
// (`CorniceDelCliente`): GET /cornice/cliente/notifiche, POST /cornice/cliente/notifiche/letture e
// PATCH /cornice/cliente/notifiche/{notifica}/lettura, col gettone dell'accesso (zr-backoffice #3323, contratto 8e80fafb), anche
// senza un workspace nella sessione e mai col gettone di quello che c'è. Il backoffice è Http::fake; `percorsoDi()`,
// `problemaDelBackoffice()` e `senzaGettone()` sono di NotificheTest.

/** Il workspace in cui la sessione dei casi entra, quando ne ha uno: per il cliente non conta. */
const WORKSPACE_DEL_MEMBRO = ['id' => 'uat-ws', 'nome' => 'UAT Marketing', 'slug' => 'uat-marketing'];

/**
 * Una notifica da cliente com'è nel contratto 8e80fafb: una prenotazione di Bookings confermata, dell'azienda di cui la persona è
 * cliente. `workspace_id`, `pagina_id` e `calendario_id` sono segni: in pagina non devono arrivare.
 *
 * @param  array<string, mixed>  $diverso  ciò che cambia
 * @return array<string, mixed>
 */
function notificaDaCliente(string $id, array $diverso = []): array
{
    return $diverso + [
        'id' => $id, 'tipo' => 'bookings.cliente.prenotazione.confermata', 'app' => 'bookings',
        'soggetto' => '/v1/bookings/prenotazioni/uat-prenotazione-1',
        'dati' => ['id' => 'uat-prenotazione-1', 'pagina_id' => 'uat-pagina-segno', 'calendario_id' => 'uat-calendario-segno', 'inizio' => '2026-11-07T17:30:00Z', 'fuso_orario' => 'Europe/Rome'],
        'letta_il' => null, 'creata_il' => '2026-11-06T09:00:00.123Z', 'autore' => null, 'risorsa_nome' => 'UAT Personal training',
        'per_me' => true, 'quando' => ['il' => '2026-11-07T17:30:00Z', 'fuso' => 'Europe/Rome'],
        'workspace_id' => 'uat-ws-segno', 'workspace_nome' => 'UAT Palestra Fit', 'spazio_cliente' => true,
    ];
}

/**
 * Il registro del pacchetto con una destinazione per il tipo delle notifiche dei casi in due voci: in quella della Dashboard
 * (`home`, «Il mio spazio» di zr-home), che è la sua per il cliente, e in quella di Bookings, con un altro id. Gli `ids` che la
 * rotta dà dicono così da quale voce li ha presi.
 */
function registroColCliente(): void
{
    $voci = registroDeiProdotti();
    foreach ($voci as $indice => $voce) {
        $riga = match ($voce['id']) {
            'home' => ['tipo' => 'bookings.cliente.prenotazione.confermata', 'percorso' => '/spazio/prenotazioni/{id}'],
            'bookings' => ['tipo' => 'bookings.cliente.prenotazione.confermata', 'percorso' => '/calendari/{calendario_id}'],
            default => null,
        };
        if ($riga !== null) {
            $voci[$indice]['notifiche'] = [...($voce['notifiche'] ?? []), $riga];
        }
    }
    registroGiaLetto($voci);
}

/**
 * Ciò che la rotta dà di `notificaDaCliente()`, con gli `ids` e l'azienda del caso.
 *
 * @param  array<string, mixed>  $diverso
 * @return array<string, mixed>
 */
function notificaDaClienteInPagina(string $id, array $diverso = []): array
{
    // Nell'ordine della risposta: ciò che cambia prende il posto della sua chiave.
    return array_replace([
        'id' => $id, 'creata_il' => '2026-11-06T09:00:00.123Z', 'letta' => false, 'app' => 'bookings',
        'tipo' => 'bookings.cliente.prenotazione.confermata', 'autore_nome' => null, 'risorsa_nome' => 'UAT Personal training',
        'per_me' => true, 'azioni' => 1, 'board_nome' => null, 'quando' => ['il' => '2026-11-07T17:30:00Z', 'fuso' => 'Europe/Rome'],
        'esito' => null, 'azienda' => 'UAT Palestra Fit', 'ids' => ['id' => 'uat-prenotazione-1'],
    ], $diverso);
}

/** Le chiamate arrivate al backoffice: metodo, percorso, corpo e gettone di ognuna. */
function chiamateDelClienteAlBackoffice(): array
{
    return Http::recorded()
        ->map(fn (array $coppia) => [$coppia[0]->method(), percorsoDi($coppia[0]), $coppia[0]->data(), $coppia[0]->header('Authorization')[0] ?? ''])
        ->values()->all();
}

it('GET /cornice/cliente/notifiche, senza workspace, legge io.notifiche.elenca col gettone dell\'accesso e dà le notifiche nella forma dell\'elenco, con `azienda` e gli `ids` della voce della Dashboard, `aggiornati_il` e `persona`, e senza workspace, pagina e calendario (sprint 116 · T1.1)', function () {
    Carbon::setTestNow(Carbon::parse('2026-11-06 10:00:00.000321', 'UTC'));
    $gettoni = sessioneAMano(null);
    registroColCliente();
    Http::fake(fn (Request $richiesta) => match (percorsoDi($richiesta)) {
        '/v1/io/notifiche' => Http::response(['data' => [notificaDaCliente('uat-n1'), notificaDaCliente('uat-n2', ['letta_il' => '2026-11-06T09:30:00.000Z', 'risorsa_nome' => null])], 'successivo' => null]),
    });

    $risposta = senzaGettone($this->getJson('cornice/cliente/notifiche'))->assertOk();

    expect($risposta->json())->toBe([
        'data' => [
            notificaDaClienteInPagina('uat-n1'),
            notificaDaClienteInPagina('uat-n2', ['letta' => true, 'risorsa_nome' => null]),
        ],
        'aggiornati_il' => '2026-11-06T10:00:00.000321Z',
        'persona' => 'uat-ada@example.com',
    ])->and(chiamateDelClienteAlBackoffice())->toBe([['GET', '/v1/io/notifiche', [], 'Bearer '.$gettoni['accesso']]])
        ->and($risposta->getContent())->not->toContain('uat-ws-segno')->not->toContain('uat-pagina-segno')->not->toContain('uat-calendario-segno')
        ->not->toContain('"workspace');
});

it('con un workspace nella sessione l\'elenco del cliente si legge lo stesso col gettone dell\'accesso, mai con quello del workspace (sprint 116 · T1.1)', function () {
    $gettoni = sessioneAMano(WORKSPACE_DEL_MEMBRO);
    registroColCliente();
    Http::fake(fn (Request $richiesta) => match (percorsoDi($richiesta)) {
        '/v1/io/notifiche' => Http::response(['data' => [notificaDaCliente('uat-n1')], 'successivo' => null]),
    });

    $risposta = senzaGettone($this->getJson('cornice/cliente/notifiche'))->assertOk();

    expect(array_keys($risposta->json()))->toBe(['data', 'aggiornati_il', 'persona'])
        ->and(chiamateDelClienteAlBackoffice())->toBe([['GET', '/v1/io/notifiche', [], 'Bearer '.$gettoni['accesso']]]);
});

it('gli `ids` ci sono solo per una notifica che il backoffice dice da cliente, con `spazio_cliente` true: per ogni altro valore, o senza, sono un oggetto vuoto (sprint 116 · T1.1)', function (array $notifica) {
    sessioneAMano(null);
    registroColCliente();
    Http::fake(['*' => Http::response(['data' => [$notifica], 'successivo' => null])]);

    $risposta = senzaGettone($this->getJson('cornice/cliente/notifiche'))->assertOk();

    expect($risposta->json('data.0.ids'))->toBe([])
        ->and($risposta->getContent())->toContain('"ids":{}')->not->toContain('uat-prenotazione-1');
})->with([
    'false' => [notificaDaCliente('uat-n1', ['spazio_cliente' => false])],
    'null' => [notificaDaCliente('uat-n1', ['spazio_cliente' => null])],
    'senza' => [array_diff_key(notificaDaCliente('uat-n1'), ['spazio_cliente' => true])],
    'il testo "true"' => [notificaDaCliente('uat-n1', ['spazio_cliente' => 'true'])],
    'il numero 1' => [notificaDaCliente('uat-n1', ['spazio_cliente' => 1])],
]);

it('`azienda` è `workspace_nome` quando è un testo, altrimenti null, e la notifica passa lo stesso (sprint 116 · T1.1)', function (array $notifica) {
    sessioneAMano(null);
    registroColCliente();
    Http::fake(['*' => Http::response(['data' => [$notifica], 'successivo' => null])]);

    expect(senzaGettone($this->getJson('cornice/cliente/notifiche'))->assertOk()->json('data.0'))->toBe(notificaDaClienteInPagina('uat-n1', ['azienda' => null]));
})->with([
    'null' => [notificaDaCliente('uat-n1', ['workspace_nome' => null])],
    'senza' => [array_diff_key(notificaDaCliente('uat-n1'), ['workspace_nome' => true])],
    'un numero' => [notificaDaCliente('uat-n1', ['workspace_nome' => 7])],
    'un oggetto' => [notificaDaCliente('uat-n1', ['workspace_nome' => ['nome' => 'UAT Palestra Fit']])],
]);

it('se il backoffice non risponde all\'elenco del cliente, o non dà una lista, la rotta risponde con un errore, non con un elenco vuoto (sprint 116 · T1.1)', function (int $stato, mixed $corpo) {
    sessioneAMano(null);
    Http::fake(['*' => Http::response($corpo, $stato)]);

    $elenco = senzaGettone($this->getJson('cornice/cliente/notifiche'));

    expect($elenco->status())->toBeGreaterThanOrEqual(500)->toBeLessThan(600)
        ->and($elenco->json('data'))->toBeNull();
})->with([
    'un 500' => [500, ''],
    'data non è una lista' => [200, ['data' => notificaDaCliente('uat-n1'), 'successivo' => null]],
]);

it('PATCH /cornice/cliente/notifiche/{id}/lettura gira a io.notifiche.lettura.modifica col gettone dell\'accesso, con o senza workspace, e risponde come la rotta della cornice (sprint 116 · T1.2)', function (?array $workspace) {
    Carbon::setTestNow(Carbon::parse('2026-11-06 10:00:00.000321', 'UTC'));
    $gettoni = sessioneAMano($workspace);
    Http::fake(fn (Request $richiesta) => match (percorsoDi($richiesta)) {
        '/v1/io/notifiche/uat-n1/lettura' => Http::response(['data' => notificaDaCliente('uat-n1', ['letta_il' => '2026-11-06T09:59:59.000Z'])]),
    });

    $risposta = senzaGettone($this->patchJson('cornice/cliente/notifiche/uat-n1/lettura', ['letta' => true]))->assertOk();

    expect($risposta->json())->toBe(['data' => ['id' => 'uat-n1', 'letta' => true], 'segnata_il' => '2026-11-06T10:00:00.000321Z'])
        ->and(chiamateDelClienteAlBackoffice())->toBe([['PATCH', '/v1/io/notifiche/uat-n1/lettura', ['letta' => true], 'Bearer '.$gettoni['accesso']]]);
})->with(['senza workspace' => [null], 'con un workspace' => [WORKSPACE_DEL_MEMBRO]]);

it('la lettura del cliente passa il 404 del backoffice com\'è, e un `letta` che non è un booleano è un 422 senza chiamare il backoffice (sprint 116 · T1.2)', function () {
    sessioneAMano(null);
    Http::fake(['*' => problemaDelBackoffice(404, 'non_trovato')]);

    senzaGettone($this->patchJson('cornice/cliente/notifiche/uat-dello-staff/lettura', ['letta' => true]))->assertNotFound()->assertExactJson(['errore' => 'non_trovato']);
    expect(Http::recorded())->toHaveCount(1);

    senzaGettone($this->patchJson('cornice/cliente/notifiche/uat-n1/lettura', ['letta' => 'true']))->assertUnprocessable()->assertExactJson(['errore' => 'dati_non_validi']);
    expect(Http::recorded())->toHaveCount(1);
});

it('un id della notifica fuori forma non arriva al backoffice: la rotta del cliente non c\'è, ed è un 404 (sprint 116 · T1.2)', function (string $indirizzo) {
    sessioneAMano(null);
    Http::fake();

    expect($this->patchJson($indirizzo, ['letta' => true])->status())->toBeIn([404, 405]);
    Http::assertNothingSent();
})->with([
    'due punti' => ['cornice/cliente/notifiche/uat..n1/lettura'],
    'una barra codificata' => ['cornice/cliente/notifiche/uat%2Fn1/lettura'],
    'un punto e virgola' => ['cornice/cliente/notifiche/uat;n1/lettura'],
    'oltre 64 caratteri' => ['cornice/cliente/notifiche/'.str_repeat('a', 65).'/lettura'],
]);

it('POST /cornice/cliente/notifiche/letture gira a io.notifiche.letture.crea col gettone dell\'accesso, con `fino_a` e senza workspace, e lo richiama finché ne restano; un workspace della sessione non conta (sprint 116 · T1.2)', function (?array $workspace, array $corpo) {
    Carbon::setTestNow(Carbon::parse('2026-11-06 10:00:00.000321', 'UTC'));
    $gettoni = sessioneAMano($workspace);
    lettureUnaDopoLAltra([lettureDopo(0, true, '2026-11-06T09:00:00.123Z'), lettureDopo(0, false, '2026-11-06T09:00:00.123Z')]);

    $risposta = senzaGettone($this->postJson('cornice/cliente/notifiche/letture', ['fino_a' => '2026-11-06T09:00:00.123Z'] + $corpo))->assertOk();

    $chiamata = ['POST', '/v1/io/notifiche/letture', ['fino_a' => '2026-11-06T09:00:00.123Z'], 'Bearer '.$gettoni['accesso']];
    expect($risposta->json())->toBe(['data' => ['fino_a' => '2026-11-06T09:00:00.123Z', 'altre' => false], 'segnate_il' => '2026-11-06T10:00:00.000321Z'])
        ->and(chiamateDelClienteAlBackoffice())->toBe([$chiamata, $chiamata]);
})->with([
    'senza workspace' => [null, []],
    'con un workspace, e la pagina che non lo dice' => [WORKSPACE_DEL_MEMBRO, []],
    'con un workspace, e la pagina che ne dice un altro' => [WORKSPACE_DEL_MEMBRO, ['workspace' => 'uat-vendite']],
]);

it('le letture del cliente con un `fino_a` che non è un istante col suo fuso rispondono 422 e non chiamano il backoffice (sprint 116 · T1.2)', function (array $corpo) {
    sessioneAMano(null);
    Http::fake();

    senzaGettone($this->postJson('cornice/cliente/notifiche/letture', $corpo))->assertUnprocessable()->assertExactJson(['errore' => 'dati_non_validi']);
    Http::assertNothingSent();
})->with([
    'senza' => [[]],
    'senza fuso' => [['fino_a' => '2026-11-06T09:00:00']],
    'un testo' => [['fino_a' => 'ieri']],
]);

it('le letture del cliente tengono il blocco della sessione come quelle della cornice, per la stessa tenuta (sprint 116 · T1.2)', function () {
    $rotta = Route::getRoutes()->match(RichiestaDelBrowser::create('/cornice/cliente/notifiche/letture', 'POST'));

    expect($rotta->locksFor())->toBe(NotificheDellaCornice::tenutaDelBlocco())
        ->and($rotta->waitsFor())->toBe(Route::getRoutes()->match(RichiestaDelBrowser::create('/cornice/notifiche/letture', 'POST'))->waitsFor());
});

it('davanti al 403 accettazione_richiesta le tre rotte del cliente rispondono come quelle della cornice, col codice e con `persona` e nient\'altro (sprint 116 · T1.2, T1.3)', function (string $metodo, string $indirizzo, array $corpo) {
    sessioneAMano(null);
    Http::fake(['*' => accettazioneRichiesta()]);

    $risposta = senzaGettone($this->json($metodo, $indirizzo, $corpo))->assertForbidden();
    expect($risposta->getContent())->toBe('{"errore":"accettazione_richiesta","persona":"uat-ada@example.com"}');
})->with([
    'l\'elenco' => ['GET', 'cornice/cliente/notifiche', []],
    'la lettura di una' => ['PATCH', 'cornice/cliente/notifiche/uat-n1/lettura', ['letta' => true]],
    'segna tutte' => ['POST', 'cornice/cliente/notifiche/letture', ['fino_a' => '2026-11-06T09:00:00.123Z']],
]);

it('al 403 dell\'assistenza le due rotte del cliente che segnano lette rispondono col suo codice, come quelle della cornice (sprint 116 · T1.2)', function (string $metodo, string $indirizzo, array $corpo) {
    sessioneAMano(null);
    Http::fake(['*' => problemaDelBackoffice(403, 'azione_non_consentita_in_assistenza')]);

    senzaGettone($this->json($metodo, $indirizzo, $corpo))->assertForbidden()->assertExactJson(['errore' => 'azione_non_consentita_in_assistenza']);
})->with([
    'la lettura di una' => ['PATCH', 'cornice/cliente/notifiche/uat-n1/lettura', ['letta' => true]],
    'segna tutte' => ['POST', 'cornice/cliente/notifiche/letture', ['fino_a' => '2026-11-06T09:00:00.123Z']],
]);

it('le tre rotte del cliente hanno la guardia di zr-auth e StessaPersona: senza sessione 401, con un\'altra persona 409, senza la persona 422, e il backoffice non è chiamato (sprint 116 · T1.3)', function (string $metodo, string $indirizzo, array $corpo) {
    Http::fake();

    senzaGettone($this->json($metodo, $indirizzo, $corpo))->assertUnauthorized();

    sessioneAMano(null);
    $diGrace = senzaGettone($this->withHeader('Persona', 'uat-grace%40example.com')->withHeader(Persona::INTESTAZIONE, improntaDi('uat-grace'))->json($metodo, $indirizzo, $corpo));
    expect($diGrace->getStatusCode())->toBe(409)
        ->and($diGrace->getContent())->toBe('{"errore":"persona_diversa","persona":""}');

    $senza = senzaGettone($this->withoutHeader('Persona')->json($metodo, $indirizzo, $corpo));
    expect($senza->getStatusCode())->toBe(422)
        ->and($senza->getContent())->toBe('{"errore":"persona_mancante","persona":""}');
    Http::assertNothingSent();
})->with([
    'l\'elenco' => ['GET', 'cornice/cliente/notifiche', []],
    'la lettura di una' => ['PATCH', 'cornice/cliente/notifiche/uat-n1/lettura', ['letta' => true]],
    'segna tutte' => ['POST', 'cornice/cliente/notifiche/letture', ['fino_a' => '2026-11-06T09:00:00.123Z']],
]);
