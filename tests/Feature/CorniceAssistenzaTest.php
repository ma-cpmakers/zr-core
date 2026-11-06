<?php

use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Zeiras\Auth\Api;
use Zeiras\Auth\Errori\BackofficeNonRisponde;
use Zeiras\Auth\Errori\ErroreApi;
use Zeiras\Auth\Sessione;
use Zeiras\Auth\Testing\BackofficeFinto;
use Zeiras\Core\Cornice;

// Sprint 115 · T1 (voce #2909, Decisione 22190). Quando lo staff entra in un modulo con «Accedi come» (zr-backoffice #2914,
// zr-auth 0.12.139) il gettone è di assistenza, e accessi.corrente.mostra (GET /v1/accessi/corrente) dà la persona assistita in
// `impersonificazione`: i dati della cornice la portano in `assistenza`, letta una volta per sessione, e per ogni altra sessione la
// chiave non c'è. Gli aiuti (backoffice(), ioMostra(), marketing(), richiesteA(), nonRisponde()) vengono da CorniceDatiTest.php e
// CorniceInDueDatiTest.php. Il caso col finto di zr-auth prova la forma vera: il finto dell'assistenza c'è dalla 0.12.139, e il vincolo
// parte da quella.

/**
 * La risposta di accessi.corrente.mostra per la sessione dei test: `impersonificazione` null per un accesso qualunque, la forma
 * del contratto per un'assistenza.
 *
 * @param  array<string, mixed>|null  $impersonificazione
 * @return array{data: array<string, mixed>}
 */
function accessoCorrente(?array $impersonificazione = null): array
{
    return ['data' => ['accesso_id' => 'uat-accesso', 'scade_il' => now()->addHours(4)->toIso8601String(), 'impersonificazione' => $impersonificazione]];
}

/** @return array<string, mixed> l'impersonificazione di Anna Bianchi, come la dà il backoffice */
function annaAssistita(bool $solaLettura = false, array $utente = []): array
{
    return ['id' => 'uat-assistenza', 'scade_il' => now()->addHours(4)->toIso8601String(), 'sola_lettura' => $solaLettura,
        'utente' => $utente + ['nome' => 'Anna', 'cognome' => 'Bianchi', 'email' => 'anna@example.com']];
}

it('con un gettone di assistenza i dati portano `assistenza`: la persona assistita (nome, cognome, email) e se è di sola lettura, in fondo, dopo il segno; né l\'id dell\'assistenza né la persona della sessione (sprint 115 · T1.1)', function (bool $solaLettura) {
    sessioneAMano(marketing());
    backoffice(['/v1/accessi/corrente' => accessoCorrente(annaAssistita($solaLettura))]);

    $dati = Cornice::dati();

    expect(array_keys($dati))->toBe(['lingua', 'persona', 'workspace', 'prodotti', 'aziende', 'non_lette', 'aggiornati_il', 'assistenza'])
        ->and($dati['assistenza'])->toBe(['persona' => ['nome' => 'Anna', 'cognome' => 'Bianchi', 'email' => 'anna@example.com'], 'sola_lettura' => $solaLettura])
        ->and($dati['persona']['nome'])->toBe('UAT Ada');

    // dopo() porta gli stessi dati: `assistenza` prima delle chiavi che aggiunge lei.
    $dopo = Cornice::dopo();
    expect(array_keys($dopo))->toBe(['lingua', 'persona', 'workspace', 'prodotti', 'aziende', 'non_lette', 'aggiornati_il', 'assistenza', 'sessione_il', 'lingua_il'])
        ->and($dopo['assistenza'])->toBe($dati['assistenza']);
})->with(['si scrive' => [false], 'sola lettura' => [true]]);

it('un cognome che il backoffice non ha (null) esce null: la persona assistita ha almeno nome ed email (sprint 115 · T1.1)', function () {
    sessioneAMano(marketing());
    backoffice(['/v1/accessi/corrente' => accessoCorrente(annaAssistita(utente: ['cognome' => null]))]);

    expect(Cornice::dati()['assistenza']['persona'])->toBe(['nome' => 'Anna', 'cognome' => null, 'email' => 'anna@example.com']);
});

it('coi dati ridotti dal 403 `accettazione_richiesta` l\'assistenza già letta resta, prima di `accettazione_richiesta`, e il backoffice non si chiama più (sprint 115 · T1.1)', function () {
    sessioneAMano(marketing());
    $io = ioMostra(0);
    backoffice([
        '/v1/accessi/corrente' => accessoCorrente(annaAssistita()),
        '/v1/io' => function () use (&$io) {
            return is_array($io) ? Http::response($io) : $io;
        },
    ]);

    Cornice::dati();
    $io = accettazioneRichiesta();
    $prima = Http::recorded()->count();
    $ridotti = Cornice::dati();

    expect(array_slice(array_keys($ridotti), -3))->toBe(['aggiornati_il', 'assistenza', 'accettazione_richiesta'])
        ->and($ridotti['assistenza']['persona']['nome'])->toBe('Anna')
        ->and(Http::recorded()->count())->toBe($prima + 1);
});

it('con una sessione che non è un\'assistenza la chiave `assistenza` non c\'è, nemmeno null, in dati(), dopo(), subito() e nella cornice ridotta: le chiavi sono quelle della v4.21.0 (sprint 115 · T1.2)', function () {
    sessioneAMano(marketing());
    backoffice();

    expect(array_keys(Cornice::dati()))->toBe(['lingua', 'persona', 'workspace', 'prodotti', 'aziende', 'non_lette', 'aggiornati_il'])
        ->and(array_keys(Cornice::dopo()))->toBe(['lingua', 'persona', 'workspace', 'prodotti', 'aziende', 'non_lette', 'aggiornati_il', 'sessione_il', 'lingua_il'])
        ->and(array_keys(Cornice::subito()))->toBe(['lingua', 'persona', 'workspace', 'sessione_il', 'lingua_il'])
        ->and(Cornice::ridotta())->not->toHaveKey('assistenza')
        ->and(richiesteA('/v1/accessi/corrente'))->toHaveCount(1);
});

it('accessi.corrente.mostra si chiama una volta per accesso, col gettone del workspace: due pagine, una chiamata; subito() e la cornice ridotta portano l\'assistenza già letta senza chiamare (sprint 115 · T1.3)', function () {
    $gettoni = sessioneAMano(marketing());
    backoffice(['/v1/accessi/corrente' => accessoCorrente(annaAssistita(true))]);

    Cornice::dati();
    Cornice::dopo();
    $subito = Cornice::subito();
    $ridotta = Cornice::ridotta();

    expect(richiesteA('/v1/accessi/corrente'))->toHaveCount(1)
        ->and(richiesteA('/v1/accessi/corrente')->first()->hasHeader('Authorization', 'Bearer '.$gettoni['workspace']))->toBeTrue()
        ->and(array_keys($subito))->toBe(['lingua', 'persona', 'workspace', 'sessione_il', 'lingua_il', 'assistenza'])
        ->and($subito['assistenza']['sola_lettura'])->toBeTrue()
        ->and($ridotta['assistenza']['persona']['email'])->toBe('anna@example.com');
});

it('due pagine della stessa sessione, col suo cookie come nel browser, chiamano accessi.corrente.mostra una volta; la pagina dopo il «Termina» e un ingresso nuovo la richiama (sprint 115 · T1.3)', function () {
    sessioneAMano(marketing());
    backoffice(['/v1/accessi/corrente' => accessoCorrente(annaAssistita())]);

    // Il client dei test non rimanda il cookie della sessione: senza, ogni richiesta avrebbe un id di sessione nuovo.
    $this->withCookie(session()->getName(), session()->getId());
    $laPrima = $this->get('w/uat-marketing/cornice')->assertOk();
    $laSeconda = $this->get('w/uat-marketing/cornice')->assertOk();

    expect($laPrima->json('assistenza.persona.nome'))->toBe('Anna')
        ->and($laSeconda->json('assistenza'))->toBe($laPrima->json('assistenza'))
        ->and(richiesteA('/v1/accessi/corrente'))->toHaveCount(1);

    sessioneAMano(marketing());
    $this->withCookie(session()->getName(), session()->getId());
    $this->get('w/uat-marketing/cornice')->assertOk();

    expect(richiesteA('/v1/accessi/corrente'))->toHaveCount(2);
});

it('un accesso nuovo nello stesso browser rilegge accessi.corrente.mostra, e l\'assistenza dell\'accesso di prima non passa a quello nuovo, nemmeno in subito() prima della lettura (sprint 115 · T1.3)', function () {
    sessioneAMano(marketing());
    $corrente = accessoCorrente(annaAssistita());
    backoffice(['/v1/accessi/corrente' => function () use (&$corrente) {
        return Http::response($corrente);
    }]);

    expect(Cornice::dati())->toHaveKey('assistenza');

    // Lo staff ha terminato, e nello stesso browser entra la persona: un accesso nuovo, una sessione nuova.
    $corrente = accessoCorrente();
    sessioneAMano(marketing());

    expect(Cornice::subito())->not->toHaveKey('assistenza')
        ->and(Cornice::dati())->not->toHaveKey('assistenza')
        ->and(richiesteA('/v1/accessi/corrente'))->toHaveCount(2);
});

it('una risposta di accessi.corrente.mostra che la cornice non sa leggere, un 5xx o la connessione che cade non sono «non è un\'assistenza»: dati() lancia, dopo() dà la cornice ridotta, e la pagina dopo rilegge (sprint 115 · T1.4)', function (mixed $risposta) {
    sessioneAMano(marketing());
    backoffice(['/v1/accessi/corrente' => function (Request $richiesta) use ($risposta) {
        // Pest chiama da sé le closure del dataset: qui arriva la risposta, o la closure della connessione che cade.
        return match (true) {
            $risposta instanceof Closure => $risposta($richiesta),
            is_array($risposta) => Http::response($risposta),
            default => $risposta,
        };
    }]);

    $lanciato = null;
    try {
        Cornice::dati();
    } catch (BackofficeNonRisponde|ErroreApi $errore) {
        $lanciato = $errore;
    }
    expect($lanciato)->not->toBeNull();

    $dopo = Cornice::dopo();
    expect($dopo['non_letti'] ?? null)->toBeTrue()
        ->and($dopo)->not->toHaveKey('assistenza')
        ->and(richiesteA('/v1/accessi/corrente'))->toHaveCount(2);
})->with([
    'senza data' => [['accesso_id' => 'uat-accesso']],
    'senza impersonificazione' => [['data' => ['accesso_id' => 'uat-accesso', 'scade_il' => '2026-11-06T20:00:00Z']]],
    'impersonificazione non un oggetto' => [accessoCorrente(['uat-assistenza'])],
    'impersonificazione un testo' => [['data' => ['accesso_id' => 'uat-accesso', 'impersonificazione' => 'uat-assistenza']]],
    'utente non un oggetto' => [accessoCorrente([...annaAssistita(), 'utente' => 'anna@example.com'])],
    'nome vuoto' => [accessoCorrente(annaAssistita(utente: ['nome' => '']))],
    'nome non un testo' => [accessoCorrente(annaAssistita(utente: ['nome' => 7]))],
    'email vuota' => [accessoCorrente(annaAssistita(utente: ['email' => '']))],
    'email assente' => [accessoCorrente([...annaAssistita(), 'utente' => ['nome' => 'Anna', 'cognome' => 'Bianchi']])],
    'cognome non un testo' => [accessoCorrente(annaAssistita(utente: ['cognome' => ['Bianchi']]))],
    'sola_lettura non booleano' => [accessoCorrente([...annaAssistita(), 'sola_lettura' => 'no'])],
    'sola_lettura assente' => [accessoCorrente(array_diff_key(annaAssistita(), ['sola_lettura' => true]))],
    'un 500' => [fn () => nonRisponde(500, 'errore_interno')],
    'un 503 senza corpo' => [fn () => nonRisponde(503, null)],
    'la connessione che cade' => [fn () => nonRisponde(0, null)],
]);

it('col finto di zr-auth: lo staff crea l\'«Accedi come», il ricevitore entra col codice senza state, e i dati portano la persona assistita, non quella dello staff, anche con una sessione della stessa persona già aperta nel browser (sprint 115 · T1.1, T1.3; revisione di sicurezza)', function (bool $giaDentro) {
    config(['zr-auth.cliente' => BackofficeFinto::CLIENTE, 'zr-auth.segreto' => BackofficeFinto::SEGRETO_DEL_CLIENTE]);
    $finto = BackofficeFinto::attiva()->ritorno('pm', 'https://localhost/ingresso/ritorno');
    $anna = $finto->persona('anna@example.com', 'una password di prova lunga', nome: 'Anna');
    $studio = $finto->workspace('Studio', $anna);
    $finto->attivaApp($studio, 'pm');
    // Lo staff assiste solo chi è già entrato almeno una volta. Con `$giaDentro` quell'accesso è la sessione del browser: zr-auth
    // ne tiene il gettone accanto a quello dell'assistenza, e accessi.corrente.mostra con quello direbbe «non è un'assistenza».
    $accesso = Api::senzaGettone()->post('/v1/accessi', ['email' => 'anna@example.com', 'password' => 'una password di prova lunga'])['data'];
    if ($giaDentro) {
        Sessione::apri($accesso);
    }
    // Lo staff entra solo con un'email dei domini dello staff, che il finto conosce.
    $sara = $finto->persona('staff-di-prova@castroandpartners.com', 'una password di prova lunga', nome: 'Sara');
    $staff = $finto->staffDi($sara, 'supporto', true);
    $sfida = Api::staff()->post('/v1/staff/accessi', ['email' => $staff['email'], 'password' => 'una password di prova lunga'])['data']['sfida']['id'];
    $gettone = Api::staff()->post('/v1/staff/accessi/verifica', ['sfida' => $sfida, 'codice' => BackofficeFinto::CODICE_TOTP_DELLO_STAFF])['data']['gettone'];
    $codice = Api::staff($gettone)->post("/v1/staff/utenti/{$anna['id']}/impersonificazioni", ['app' => 'pm'])['data']['codice'];

    // Il codice lo scambia solo il client dell'app (`board` per `pm`), come nel modulo della board.
    config(['zr-auth.cliente' => 'board']);
    $this->get('/ingresso/ritorno?'.http_build_query(['codice' => $codice]))->assertStatus(302);

    expect(Sessione::workspace()['slug'] ?? null)->toBe($studio['slug']);
    $dati = Cornice::dati();
    Cornice::dati();

    expect($dati['assistenza'])->toBe(['persona' => ['nome' => 'Anna', 'cognome' => $anna['cognome'], 'email' => 'anna@example.com'], 'sola_lettura' => true])
        ->and(richiesteA('/v1/accessi/corrente'))->toHaveCount(1);
})->with(['senza una sessione di prima' => [false], 'con la sessione della persona già aperta' => [true]]);

it('in assistenza il backoffice nega le letture con 403 `azione_non_consentita_in_assistenza`: le due rotte che segnano lette rispondono 403 con quel codice, non un guasto (sprint 115 · T2.3)', function (string $metodo, string $indirizzo, array $corpo) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => problemaDelBackoffice(403, 'azione_non_consentita_in_assistenza')]);

    senzaGettone($this->json($metodo, $indirizzo, $corpo))
        ->assertForbidden()->assertExactJson(['errore' => 'azione_non_consentita_in_assistenza']);
    Http::assertSentCount(1);
})->with([
    'una notifica' => ['PATCH', 'cornice/notifiche/uat-n3/lettura', ['letta' => true]],
    'tutte fino a un istante' => ['POST', 'cornice/notifiche/letture', ['fino_a' => '2026-10-08T10:00:00.000Z', 'workspace' => 'uat-marketing']],
]);

it('un altro 403 del backoffice sulle letture resta com\'era: il codice dell\'assistenza non apre gli altri (sprint 115 · T2.3)', function () {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => problemaDelBackoffice(403, 'azione_non_consentita')]);

    $risposta = senzaGettone($this->patchJson('cornice/notifiche/uat-n3/lettura', ['letta' => true]));

    expect($risposta->json('errore'))->not->toBe('azione_non_consentita_in_assistenza');
});
