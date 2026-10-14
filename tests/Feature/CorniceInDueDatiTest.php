<?php

use Illuminate\Http\Client\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Zeiras\Auth\Errori\BackofficeNonRisponde;
use Zeiras\Auth\Errori\ErroreApi;
use Zeiras\Auth\Errori\GettoneRifiutato;
use Zeiras\Auth\Sessione;
use Zeiras\Core\Cornice;

// Sprint 34 · T4 (voce #1932). I dati della cornice in due parti, per il frontend che non vuole aspettare il backoffice prima
// del primo disegno: Cornice::subito() legge la sola sessione, Cornice::dopo() ciò che Cornice::dati() legge dal backoffice, e
// può arrivare dopo. Se il backoffice non risponde dopo() non lancia: dà `non_letti`, e la cornice esce ridotta con un avviso
// suo. Cornice::dati() non cambia: i suoi casi sono in CorniceDatiTest.php, da cui vengono anche gli aiuti (backoffice(),
// marketing(), datiAttesi()…), e restano com'erano.

/**
 * Una risposta di errore di /v1 (problem details), o una risposta senza corpo, o la connessione che cade (stato 0).
 */
function nonRisponde(int $stato, ?string $codice): mixed
{
    $problema = ['type' => 'about:blank', 'title' => 'segno-del-titolo', 'status' => $stato, 'detail' => 'segno-del-dettaglio', 'codice' => $codice];

    return match (true) {
        $stato === 0 => Http::failedConnection(),
        $codice === null => Http::response('segno-del-corpo', $stato),
        default => Http::response((string) json_encode($problema), $stato, ['Content-Type' => 'application/problem+json']),
    };
}

it('Cornice::subito() dà lingua, persona e workspace della sessione e in fondo il segno di quell\'istante, in quest\'ordine e nient\'altro, senza una richiesta al backoffice e lasciando la sessione com\'è (sprint 34 · T4.1; sprint 36 · T3.1)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:05.123456', 'UTC'));
    // Se subito() leggesse io.mostra ci troverebbe una lingua e un nome nuovi, e li metterebbe nella sessione.
    backoffice(['/v1/io' => ioMostraCon(['lingua' => 'es', 'nome' => 'UAT Ada Lovelace'])]);
    sessioneAMano(marketing());
    $prima = session(Sessione::CHIAVE);

    expect(Cornice::subito())->toBe([
        'lingua' => 'en',
        'persona' => ['nome' => 'UAT Ada', 'email' => 'uat-ada@example.com'],
        'workspace' => ['nome' => 'UAT Marketing', 'slug' => 'uat-marketing'],
        'sessione_il' => '2026-10-09T21:31:05.123456Z',
    ])->and(session(Sessione::CHIAVE))->toBe($prima);
    Http::assertNothingSent();
});

it('senza sessione, o con la sessione aperta ma senza workspace, Cornice::subito() e Cornice::dopo() danno null e non chiamano il backoffice (sprint 34 · T4.1, T4.2)', function () {
    backoffice();

    expect(Cornice::subito())->toBeNull()
        ->and(Cornice::dopo())->toBeNull();

    sessioneAMano(null);

    expect(Sessione::aperta())->toBeTrue()
        ->and(Cornice::subito())->toBeNull()
        ->and(Cornice::dopo())->toBeNull();
    Http::assertNothingSent();
});

it('Cornice::dopo() dà ciò che Cornice::dati() dà, nello stesso ordine e con le letture di sempre — chi ha letto (lingua e persona), il workspace di cui sono, prodotti, aziende, non lette e il segno — poi sessione_il, l\'istante in cui quella persona è stata letta, e in fondo lingua_il, l\'istante della lettura che ha confermato la lingua (sprint 34 · T4.2; review della PR #67, R6; sprint 37 · T2.3; sprint 45 · T3.1)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:05.123456', 'UTC'));
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato();

    $dopo = Cornice::dopo();

    // Le letture di una Cornice::dati(): una per metodo, e i workspace sulle loro due pagine. dopo() non ne aggiunge.
    expect($dopo)->toBe([...datiAttesi('2026-10-09T21:31:05.123456Z'), 'sessione_il' => '2026-10-09T21:31:05.123456Z', 'lingua_il' => '2026-10-09T21:31:05.123456Z'])
        ->and(array_keys((array) $dopo))->toBe(['lingua', 'persona', 'workspace', 'prodotti', 'aziende', 'non_lette', 'aggiornati_il', 'sessione_il', 'lingua_il'])
        ->and(((array) $dopo)['workspace'])->toBe(((array) Cornice::subito())['workspace'])
        ->and(array_count_values(percorsiChiamati()))->toBe(['/v1/io' => 1, '/v1/app' => 1, '/v1/io/aziende' => 1, '/v1/io/workspace' => 2]);
});

it('Cornice::dopo() dice di chi sono i dati che dà: se fra la subito() di una pagina e la sua dopo() nella sessione entra un\'altra persona, dopo() porta nome, email e lingua di questa, le sue non lette e l\'istante della sua lettura; la subito() di prima resta di chi c\'era (sprint 37 · T2.3)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:05.123456', 'UTC'));
    sessioneAMano(marketing());
    $grace = ['id' => 'uat-grace', 'nome' => 'UAT Grace', 'email' => 'uat-grace@example.com', 'email_verificata_il' => now()->toIso8601String(), 'lingua' => 'it', 'fuso_orario' => 'Europe/Rome'];
    $ioDiGrace = ioMostra(9);
    $ioDiGrace['data']['utente'] = $grace;
    backofficeDiChiHaAccettato(['/v1/io' => $ioDiGrace]);

    $subito = Cornice::subito();
    // Dallo stesso browser entra un'altra persona, nello stesso workspace, prima che la richiesta rimandata parta.
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:09.000001', 'UTC'));
    Sessione::entra(['gettone' => 'zr_'.Str::random(48), 'scade_il' => now()->addHour()->toIso8601String(), 'utente' => $grace, 'workspace' => marketing(), 'ruolo' => 'membro']);
    $dopo = (array) Cornice::dopo();

    expect($subito['persona'] ?? null)->toBe(['nome' => 'UAT Ada', 'email' => 'uat-ada@example.com'])
        ->and($subito['sessione_il'] ?? null)->toBe('2026-10-09T21:31:05.123456Z')
        ->and($dopo['persona'] ?? null)->toBe(['nome' => 'UAT Grace', 'email' => 'uat-grace@example.com'])
        ->and($dopo['lingua'] ?? null)->toBe('it')
        ->and($dopo['non_lette'] ?? null)->toBe(9)
        ->and($dopo['sessione_il'] ?? null)->toBe('2026-10-09T21:31:09.000001Z')
        ->and($dopo['aggiornati_il'] ?? null)->toBe('2026-10-09T21:31:09.000001Z');
});

it('dopo una Cornice::dopo() la lingua e il nome di Cornice::subito() sono quelli che io.mostra ha dato: prima erano quelli dell\'ingresso (sprint 34 · T4.10)', function () {
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato(['/v1/io' => ioMostraCon(['lingua' => 'es', 'nome' => 'UAT Ada Lovelace'])]);

    $prima = Cornice::subito();
    Cornice::dopo();
    $poi = Cornice::subito();

    expect([$prima['lingua'] ?? null, $prima['persona']['nome'] ?? null])->toBe(['en', 'UAT Ada'])
        ->and([$poi['lingua'] ?? null, $poi['persona']['nome'] ?? null])->toBe(['es', 'UAT Ada Lovelace']);
});

it('se il backoffice non risponde — la connessione cade, un 5xx, un 429 — Cornice::dopo() non lancia e dà non_letti col segno di quell\'istante e con chi è nella sessione — lingua, persona, workspace, sessione_il e, se io.mostra ha risposto, in fondo lingua_il —, e nient\'altro, da qualunque delle letture arrivi; nel log una riga d\'avviso col tipo dell\'errore e mai il suo messaggio; dalla `v2.17.0` lo stesso a un 4xx che non è un 401 né un 403 (sprint 34 · T4.2; review della PR #67, R5; sprint 41 · T4.1; sprint 45 · T3.1; sprint 56 · T2.1)', function (string $percorso, int $stato, ?string $codice, string $tipo) {
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:05.123456', 'UTC'));
    sessioneAMano(marketing());
    logDellaRiga();
    backofficeDiChiHaAccettato([$percorso => nonRisponde($stato, $codice)]);

    expect(Cornice::dopo())->toBe([
        'non_letti' => true,
        'aggiornati_il' => '2026-10-09T21:31:05.123456Z',
        'lingua' => 'en',
        'persona' => ['nome' => 'UAT Ada', 'email' => 'uat-ada@example.com'],
        'workspace' => ['nome' => 'UAT Marketing', 'slug' => 'uat-marketing'],
        'sessione_il' => '2026-10-09T21:31:05.123456Z',
        // Se io.mostra ha risposto la lingua è confermata da quella lettura.
        ...($percorso === '/v1/io' ? [] : ['lingua_il' => '2026-10-09T21:31:05.123456Z']),
    ])
        ->and(avvisiDellaRiga())->toBe(['zr-core, dati della cornice: il backoffice non ha risposto ('.$tipo.'): la cornice esce ridotta']);
})->with([
    'io.mostra, la connessione cade' => ['/v1/io', 0, null, BackofficeNonRisponde::class],
    'io.mostra, un 502 senza corpo' => ['/v1/io', 502, null, BackofficeNonRisponde::class],
    'io.mostra, un 503 di /v1' => ['/v1/io', 503, 'non_disponibile', ErroreApi::class],
    'io.mostra, un 429' => ['/v1/io', 429, 'troppe_richieste', ErroreApi::class],
    'app.elenca, un 500 senza corpo' => ['/v1/app', 500, null, BackofficeNonRisponde::class],
    'app.elenca, un 429' => ['/v1/app', 429, 'troppe_richieste', ErroreApi::class],
    'io.aziende.elenca, la connessione cade' => ['/v1/io/aziende', 0, null, BackofficeNonRisponde::class],
    'io.workspace.elenca, un 503 di /v1' => ['/v1/io/workspace', 503, 'non_disponibile', ErroreApi::class],
    // Sprint 56 · T2.1 (voce #2105): un 4xx che non parla di accesso è la cornice ridotta, non la pagina d'errore.
    'io.mostra, un 404' => ['/v1/io', 404, 'non_trovato', ErroreApi::class],
    'app.elenca, un 404' => ['/v1/app', 404, 'non_trovato', ErroreApi::class],
    'app.elenca, un 409' => ['/v1/app', 409, 'conflitto', ErroreApi::class],
    'io.aziende.elenca, un 422' => ['/v1/io/aziende', 422, 'non_valido', ErroreApi::class],
    'io.workspace.elenca, un 404' => ['/v1/io/workspace', 404, 'non_trovato', ErroreApi::class],
]);

// Sprint 41 · T4 (voce #2029). `non_letti` dice di chi è: fra la subito() di una pagina e la sua dopo() la sessione può essere
// passata a un'altra persona, e col backoffice che non risponde la cornice ridotta restava col nome di chi c'era prima. Di chi è
// lo dice la sessione, mai una chiamata in più a /v1.
it('col backoffice che non risponde Cornice::dopo() dice di chi è non_letti: se fra la subito() di una pagina e la sua dopo() nella sessione entra un\'altra persona, porta nome, email e lingua di questa, il workspace e l\'istante di quella lettura, e niente del backoffice; la subito() di prima resta di chi c\'era (sprint 41 · T4.1)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:05.123456', 'UTC'));
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato(['/v1/io' => nonRisponde(0, null)]);

    $subito = Cornice::subito();
    // Dallo stesso browser entra un'altra persona, nello stesso workspace, prima che la richiesta rimandata parta.
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:09.000001', 'UTC'));
    $grace = ['id' => 'uat-grace', 'nome' => 'UAT Grace', 'email' => 'uat-grace@example.com', 'email_verificata_il' => now()->toIso8601String(), 'lingua' => 'it', 'fuso_orario' => 'Europe/Rome'];
    Sessione::entra(['gettone' => 'zr_'.Str::random(48), 'scade_il' => now()->addHour()->toIso8601String(), 'utente' => $grace, 'workspace' => marketing(), 'ruolo' => 'membro']);

    expect($subito['persona'] ?? null)->toBe(['nome' => 'UAT Ada', 'email' => 'uat-ada@example.com'])
        ->and(Cornice::dopo())->toBe([
            'non_letti' => true,
            'aggiornati_il' => '2026-10-09T21:31:09.000001Z',
            'lingua' => 'it',
            'persona' => ['nome' => 'UAT Grace', 'email' => 'uat-grace@example.com'],
            'workspace' => ['nome' => 'UAT Marketing', 'slug' => 'uat-marketing'],
            'sessione_il' => '2026-10-09T21:31:09.000001Z',
        ])
        // Una richiesta sola, quella che non ha avuto risposta: il nome non si chiede di nuovo a io.mostra.
        ->and(percorsiChiamati())->toBe(['/v1/io']);
});

it('col backoffice che non risponde dopo io.mostra, la lingua e il nome di non_letti sono quelli della sessione dopo quella lettura — riletti da io.mostra, con l\'email dell\'ingresso —, e Cornice::dopo() non chiama /v1 un\'altra volta per dirli (sprint 41 · T4.1)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:05.123456', 'UTC'));
    sessioneAMano(marketing());
    logDellaRiga();
    backofficeDiChiHaAccettato(['/v1/io' => ioMostraCon(['lingua' => 'es', 'nome' => 'UAT Ada Lovelace']), '/v1/app' => nonRisponde(503, 'non_disponibile')]);

    $dopo = Cornice::dopo();

    expect($dopo)->toBe([
        'non_letti' => true,
        'aggiornati_il' => '2026-10-09T21:31:05.123456Z',
        'lingua' => 'es',
        'persona' => ['nome' => 'UAT Ada Lovelace', 'email' => 'uat-ada@example.com'],
        'workspace' => ['nome' => 'UAT Marketing', 'slug' => 'uat-marketing'],
        'sessione_il' => '2026-10-09T21:31:05.123456Z',
        'lingua_il' => '2026-10-09T21:31:05.123456Z',
    ])
        ->and(array_keys((array) $dopo))->not->toContain('prodotti', 'aziende', 'non_lette', 'accettazione_richiesta')
        ->and(array_count_values(percorsiChiamati()))->toBe(['/v1/io' => 1, '/v1/app' => 1])
        ->and(avvisiDellaRiga())->toHaveCount(1);
});

// Sprint 41 · T6 (review della PR #75, S1). Il segno di chi è si prende prima della lettura, come nel ramo riuscito: nome ed
// email sono quelli della sessione com'era quando la richiesta è cominciata, e un `non_letti` arrivato tardi — il backoffice
// ci mette secondi a non rispondere — non deve valere sopra i dati di chi è entrato intanto. A orologio fermo i due segni sono
// uguali e il caso non distingue niente: qui la risposta finta sposta l'orologio. Dalla seconda lettura (N3) anche
// `aggiornati_il` è quell'istante, come nei dati riusciti: ogni lettura porta il segno di quando è cominciata.
it('col backoffice che non risponde i due segni di non_letti, sessione_il e aggiornati_il, sono l\'istante in cui la lettura è cominciata, come nei dati riusciti, e non quello in cui è fallita: un non_letti in ritardo non è più recente di chi è entrato mentre il backoffice non rispondeva (sprint 41 · T6, S1 e N3)', function (string $percorso) {
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:05.123456', 'UTC'));
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato([$percorso => function () {
        Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:12.500000', 'UTC'));

        return Http::response('segno-del-corpo', 502);
    }]);

    expect(Cornice::dopo())->toBe([
        'non_letti' => true,
        'aggiornati_il' => '2026-10-09T21:31:05.123456Z',
        'lingua' => 'en',
        'persona' => ['nome' => 'UAT Ada', 'email' => 'uat-ada@example.com'],
        'workspace' => ['nome' => 'UAT Marketing', 'slug' => 'uat-marketing'],
        'sessione_il' => '2026-10-09T21:31:05.123456Z',
        ...($percorso === '/v1/io' ? [] : ['lingua_il' => '2026-10-09T21:31:05.123456Z']),
    ]);
})->with([
    'io.mostra' => ['/v1/io'],
    'app.elenca' => ['/v1/app'],
]);

// Sprint 41 · T6 (seconda lettura della PR #75, N1). Un frontend che mette la lingua della pagina con `Cornice::lingua()`
// prima del controller ha già letto io.mostra quando `dopo()` comincia: la lettura è quella, tenuta sulla richiesta, e il
// segno di `non_letti` è il suo — l'istante in cui è cominciata —, non quello in cui `dopo()` è partita, che viene dopo il
// fallimento.
it('se Cornice::lingua() ha già letto io.mostra in questa richiesta, i segni di non_letti sono quelli di quella lettura — l\'istante in cui è cominciata —, sia quando è lei a fallire sia quando riesce lenta e cade una lettura dopo; io.mostra non si rilegge (sprint 41 · T6, N1)', function (int $statoDiIo, string $lingua) {
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:05.123456', 'UTC'));
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato([
        '/v1/io' => function () use ($statoDiIo) {
            // Il backoffice ci mette sette secondi a rispondere, o a non rispondere.
            Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:12.500000', 'UTC'));

            return $statoDiIo === 200 ? Http::response(ioMostraCon(['lingua' => 'es'])) : Http::response('segno-del-corpo', $statoDiIo);
        },
        '/v1/app' => nonRisponde(503, 'non_disponibile'),
    ]);

    // Il middleware della lingua, prima del controller; poi la prop rimandata.
    Cornice::lingua();
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:13.000000', 'UTC'));

    expect(Cornice::dopo())->toBe([
        'non_letti' => true,
        'aggiornati_il' => '2026-10-09T21:31:05.123456Z',
        'lingua' => $lingua,
        'persona' => ['nome' => 'UAT Ada', 'email' => 'uat-ada@example.com'],
        'workspace' => ['nome' => 'UAT Marketing', 'slug' => 'uat-marketing'],
        'sessione_il' => '2026-10-09T21:31:05.123456Z',
        ...($statoDiIo === 200 ? ['lingua_il' => '2026-10-09T21:31:05.123456Z'] : []),
    ])
        ->and(array_count_values(percorsiChiamati())['/v1/io'])->toBe(1);
})->with([
    'io.mostra fallisce in lingua()' => [502, 'en'],
    'io.mostra riesce lenta in lingua(), poi cade app.elenca' => [200, 'es'],
]);

it('se mentre il backoffice non risponde la sessione finisce, Cornice::dopo() dà null come senza sessione: non c\'è nessuno di cui dire non_letti, e nel log non c\'è scritto che la cornice esce ridotta (sprint 41 · T4.4; T6, R8)', function () {
    sessioneAMano(marketing());
    logDellaRiga();
    backofficeDiChiHaAccettato(['/v1/app' => function () {
        Sessione::chiudi();

        return Http::response('segno-del-corpo', 500);
    }]);

    expect(Cornice::dopo())->toBeNull()
        ->and(array_count_values(percorsiChiamati()))->toBe(['/v1/io' => 1, '/v1/app' => 1])
        ->and(avvisiDellaRiga())->toBe([]);
});

// Sprint 41 · T6 (review della PR #75, R8). La sessione finisce anche da sola: zr-auth guarda `scade_il`, e un gettone che
// scade mentre il backoffice non risponde lascia la sessione senza nessuno, come `Sessione::chiudi()`.
it('se il gettone scade mentre il backoffice non risponde, Cornice::dopo() dà null come senza sessione e non scrive nel log che la cornice esce ridotta (sprint 41 · T6, R8)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:05.123456', 'UTC'));
    sessioneAMano(marketing());
    logDellaRiga();
    backofficeDiChiHaAccettato(['/v1/app' => function () {
        // Il gettone di `sessioneAMano()` scade dopo un'ora.
        Carbon::setTestNow(Carbon::parse('2026-10-09 22:31:05.123457', 'UTC'));

        return Http::response('segno-del-corpo', 500);
    }]);

    expect(Cornice::dopo())->toBeNull()
        ->and(Sessione::aperta())->toBeFalse()
        ->and(array_count_values(percorsiChiamati()))->toBe(['/v1/io' => 1, '/v1/app' => 1])
        ->and(avvisiDellaRiga())->toBe([]);
});

// Sprint 56 · T2.2 (voce #2105; Decisione di zr-pm 13319): un 401 o un 403 dicono che la persona non ha (più) accesso, e la
// cornice ridotta lo nasconderebbe. Fino alla `v2.16.0` passavano da qui anche gli altri 4xx (il 404 di app.elenca).
it('un 401 o un 403 che non è l\'accettazione passano da Cornice::dopo() com\'è, come da Cornice::dati(): non diventano non_letti (sprint 34 · T4.2; sprint 56 · T2.2)', function (string $percorso, int $stato, string $codice) {
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato([$percorso => nonRisponde($stato, $codice)]);

    expect(fn () => Cornice::dopo())->toThrow(fn (ErroreApi $errore) => expect([$errore->stato, $errore->codice])->toBe([$stato, $codice]));
})->with([
    'io.mostra, 403 gettone_senza_workspace' => ['/v1/io', 403, 'gettone_senza_workspace'],
    'app.elenca, un 403 che somiglia all\'accettazione e non lo è' => ['/v1/app', 403, 'permesso_negato'],
    'io.aziende.elenca, un 403' => ['/v1/io/aziende', 403, 'permesso_negato'],
    'io.mostra, un 401 cliente_non_riconosciuto' => ['/v1/io', 401, 'cliente_non_riconosciuto'],
]);

// Sprint 56 · T2.1 (voce #2105): col 4xx, come col 5xx, se intanto la sessione è finita non c'è nessuno di cui dire non_letti.
it('se mentre il backoffice risponde 404 la sessione finisce, Cornice::dopo() dà null come senza sessione e nel log non c\'è niente (sprint 56 · T2.1)', function () {
    sessioneAMano(marketing());
    logDellaRiga();
    backofficeDiChiHaAccettato(['/v1/app' => function () {
        Sessione::chiudi();

        return nonRisponde(404, 'non_trovato');
    }]);

    expect(Cornice::dopo())->toBeNull()
        ->and(avvisiDellaRiga())->toBe([]);
});

// Sprint 56 · T2.3 (voce #2105): una risposta che la cornice non sa leggere è «il backoffice non risponde», come quella di
// io.mostra senza le non lette: mai un TypeError o un ErrorException, e mai un `nome` che non è un testo al browser.
dataset('risposte guaste', [
    'app.elenca, un elemento che non è un oggetto' => ['/v1/app', ['data' => ['pm'], 'successivo' => null]],
    'app.elenca, senza lo stato' => ['/v1/app', ['data' => [['codice' => 'pm']], 'successivo' => null]],
    'app.elenca, un codice che non è un testo' => ['/v1/app', ['data' => [['codice' => 7, 'stato' => 'attivo']], 'successivo' => null]],
    'io.aziende.elenca, senza il nome' => ['/v1/io/aziende', ['data' => [['id' => 'az-b']], 'successivo' => null]],
    'io.aziende.elenca, il nome null' => ['/v1/io/aziende', ['data' => [['id' => 'az-b', 'nome' => null]], 'successivo' => null]],
    'io.workspace.elenca, senza lo slug' => ['/v1/io/workspace', ['data' => [['id' => 'ws-x', 'nome' => 'UAT X', 'azienda_id' => 'az-b']], 'successivo' => null]],
    'io.workspace.elenca, un\'azienda che non è un testo' => ['/v1/io/workspace', ['data' => [['id' => 'ws-x', 'nome' => 'UAT X', 'slug' => 'uat-x', 'azienda_id' => ['az-b']]], 'successivo' => null]],
]);

it('a una risposta che non sa leggere Cornice::dopo() non lancia: dà non_letti con chi è nella sessione, e nel log la riga d\'avviso con BackofficeNonRisponde (sprint 56 · T2.3)', function (string $percorso, array $guasta) {
    Carbon::setTestNow(Carbon::parse('2026-10-14 15:31:05.123456', 'UTC'));
    sessioneAMano(marketing());
    logDellaRiga();
    backofficeDiChiHaAccettato([$percorso => $guasta]);

    expect(Cornice::dopo())->toBe([
        'non_letti' => true,
        'aggiornati_il' => '2026-10-14T15:31:05.123456Z',
        'lingua' => 'en',
        'persona' => ['nome' => 'UAT Ada', 'email' => 'uat-ada@example.com'],
        'workspace' => ['nome' => 'UAT Marketing', 'slug' => 'uat-marketing'],
        'sessione_il' => '2026-10-14T15:31:05.123456Z',
        'lingua_il' => '2026-10-14T15:31:05.123456Z',
    ])
        ->and(avvisiDellaRiga())->toBe(['zr-core, dati della cornice: il backoffice non ha risposto ('.BackofficeNonRisponde::class.'): la cornice esce ridotta']);
})->with('risposte guaste');

it('a una risposta che non sa leggere Cornice::dati() lancia BackofficeNonRisponde, come quando il backoffice non risponde (sprint 56 · T2.3)', function (string $percorso, array $guasta) {
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato([$percorso => $guasta]);

    expect(fn () => Cornice::dati())->toThrow(BackofficeNonRisponde::class);
})->with('risposte guaste');

// Sprint 56 · T2.4 (voce #2105): `Cornice::dati()` non cambia sui 4xx, che passano com'è.
it('Cornice::dati() a un 4xx del backoffice lancia l\'ErroreApi com\'è: non_letti è solo di Cornice::dopo() (sprint 56 · T2.4)', function (string $percorso) {
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato([$percorso => nonRisponde(404, 'non_trovato')]);

    expect(fn () => Cornice::dati())->toThrow(fn (ErroreApi $errore) => expect([$errore->stato, $errore->codice])->toBe([404, 'non_trovato']));
})->with(['/v1/io', '/v1/app', '/v1/io/workspace']);

it('con la sessione che scade mentre la cornice legge, GettoneRifiutato passa da Cornice::dopo(): non diventa non_letti (sprint 34 · T4.2)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-10 10:00:00', 'UTC'));
    sessioneAMano(marketing());
    // Come nel caso di Cornice::dati(): la sessione dei test scade fra un'ora, e la risposta di io.mostra arriva due ore dopo.
    backoffice(['/v1/io' => function () {
        Carbon::setTestNow(Carbon::now()->addHours(2));

        return Http::response(ioMostraCon(['lingua' => 'es', 'nome' => 'UAT Ada Lovelace']));
    }]);

    expect(fn () => Cornice::dopo())->toThrow(GettoneRifiutato::class);
});

it('davanti al 403 accettazione_richiesta Cornice::dopo() dà i dati ridotti di Cornice::dati() — chi ha letto, il workspace, nessuna app, nessuna azienda, zero non lette, il segno e accettazione_richiesta — e in fondo sessione_il: anche ridotti dicono di chi sono; mai non_letti, e nessun avviso nel log (sprint 34 · T4.2, T4.7; sprint 37 · T2.3)', function (string $percorso) {
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:05.123456', 'UTC'));
    sessioneAMano(marketing());
    logDellaRiga();
    backofficeDiChiHaAccettato([$percorso => accettazioneRichiesta()]);

    expect(Cornice::dopo())->toBe([
        ...datiRidotti('2026-10-09T21:31:05.123456Z'),
        'sessione_il' => '2026-10-09T21:31:05.123456Z',
        ...($percorso === '/v1/io' ? [] : ['lingua_il' => '2026-10-09T21:31:05.123456Z']),
    ])
        ->and(avvisiDellaRiga())->toBe([]);
})->with(['/v1/io', '/v1/app', '/v1/io/aziende', '/v1/io/workspace']);

// Sprint 45 · T3 (voce #2060). La lingua ha un suo segno: `lingua_il`, l'inizio della lettura di io.mostra che ha confermato
// la lingua della sessione per quella persona (io.mostra ha risposto con l'id della sessione). `subito()` lo dà ricordato,
// mai l'istante di adesso: un `subito` riletto mentre `dopo` è in lettura porta la lingua di prima, e col segno di adesso
// varrebbe nel browser sopra la lingua nuova. Di un'altra persona non esce mai.
it('Cornice::subito() porta in fondo, dopo sessione_il, lingua_il: l\'istante in cui è cominciata la lettura di io.mostra che ha confermato la lingua della sessione, non quello di adesso; prima di una lettura non c\'è (sprint 45 · T3.1)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:05.123456', 'UTC'));
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato(['/v1/io' => ioMostraCon(['lingua' => 'es'])]);

    $prima = Cornice::subito();
    Cornice::dopo();
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:09.000001', 'UTC'));
    $poi = Cornice::subito();

    expect(array_keys((array) $prima))->toBe(['lingua', 'persona', 'workspace', 'sessione_il'])
        ->and($poi)->toBe([
            'lingua' => 'es',
            'persona' => ['nome' => 'UAT Ada', 'email' => 'uat-ada@example.com'],
            'workspace' => ['nome' => 'UAT Marketing', 'slug' => 'uat-marketing'],
            'sessione_il' => '2026-10-09T21:31:09.000001Z',
            'lingua_il' => '2026-10-09T21:31:05.123456Z',
        ]);
});

it('una lettura dopo, che conferma ancora la lingua, porta lingua_il al suo inizio; una che fallisce lascia quello ricordato, anche in non_letti (sprint 45 · T3.1)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:05.123456', 'UTC'));
    sessioneAMano(marketing());
    // Un Http::fake dopo l'altro terrebbe la prima risposta: io.mostra risponde ciò che `$io` è quando la chiamata arriva.
    $io = ioMostra(3);
    // Più di una dopo(): gli elenchi di backoffice() non finiscono come le sequenze di backofficeDiChiHaAccettato().
    backoffice(['/v1/io' => function (Request $richiesta) use (&$io) {
        return match (true) {
            is_array($io) => Http::response($io),
            $io instanceof Closure => $io($richiesta),
            default => $io,
        };
    }]);
    Cornice::dopo();

    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:07.000000', 'UTC'));
    $seconda = (array) Cornice::dopo();

    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:09.000001', 'UTC'));
    $io = nonRisponde(502, null);
    $caduta = (array) Cornice::dopo();

    expect($seconda['lingua_il'] ?? null)->toBe('2026-10-09T21:31:07.000000Z')
        ->and($caduta['non_letti'] ?? null)->toBeTrue()
        ->and($caduta['sessione_il'] ?? null)->toBe('2026-10-09T21:31:09.000001Z')
        ->and($caduta['lingua_il'] ?? null)->toBe('2026-10-09T21:31:07.000000Z')
        ->and(((array) Cornice::subito())['lingua_il'] ?? null)->toBe('2026-10-09T21:31:07.000000Z');
});

it('lingua_il è l\'inizio della lettura anche quando l\'orologio va avanti mentre io.mostra risponde, non la sua fine (sprint 45 · T3.1; review della PR #79, R4a)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:05.123456', 'UTC'));
    sessioneAMano(marketing());
    backoffice(['/v1/io' => function () {
        Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:08.000000', 'UTC'));

        return Http::response(ioMostra(3));
    }]);

    expect(((array) Cornice::dopo())['lingua_il'] ?? null)->toBe('2026-10-09T21:31:05.123456Z')
        ->and(((array) Cornice::subito())['lingua_il'] ?? null)->toBe('2026-10-09T21:31:05.123456Z');
});

it('una risposta di io.mostra con l\'id di un\'altra persona non conferma la lingua: niente lingua_il, né in Cornice::dopo() né in Cornice::subito() (sprint 45 · T3.1)', function (mixed $id) {
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:05.123456', 'UTC'));
    sessioneAMano(marketing());
    $io = ioMostraCon(['lingua' => 'es'], 3, $id === null ? ['id'] : []);
    if ($id !== null) {
        $io['data']['utente']['id'] = $id;
    }
    backofficeDiChiHaAccettato(['/v1/io' => $io]);

    expect(array_key_exists('lingua_il', (array) Cornice::dopo()))->toBeFalse()
        ->and(array_key_exists('lingua_il', (array) Cornice::subito()))->toBeFalse();
})->with([
    'un\'altra persona' => ['uat-grace'],
    'senza id' => [null],
]);

it('dopo l\'ingresso di un\'altra persona nello stesso browser, la lingua_il ricordata per chi c\'era prima non esce: né in Cornice::subito(), né in non_letti; la prima lettura che conferma la lingua della persona nuova dà la sua (sprint 45 · T3.1)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:05.123456', 'UTC'));
    sessioneAMano(marketing());
    $io = ioMostra(3);
    // Più di una dopo(): gli elenchi di backoffice() non finiscono come le sequenze di backofficeDiChiHaAccettato().
    backoffice(['/v1/io' => function (Request $richiesta) use (&$io) {
        return match (true) {
            is_array($io) => Http::response($io),
            $io instanceof Closure => $io($richiesta),
            default => $io,
        };
    }]);
    Cornice::dopo();

    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:09.000001', 'UTC'));
    $grace = ['id' => 'uat-grace', 'nome' => 'UAT Grace', 'email' => 'uat-grace@example.com', 'email_verificata_il' => now()->toIso8601String(), 'lingua' => 'it', 'fuso_orario' => 'Europe/Rome'];
    Sessione::entra(['gettone' => 'zr_'.Str::random(48), 'scade_il' => now()->addHour()->toIso8601String(), 'utente' => $grace, 'workspace' => marketing(), 'ruolo' => 'membro']);
    $subito = (array) Cornice::subito();
    $io = nonRisponde(0, null);
    $caduta = (array) Cornice::dopo();

    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:11.000000', 'UTC'));
    $io = ioMostraCon($grace);
    $riuscita = (array) Cornice::dopo();

    expect($subito['persona']['nome'] ?? null)->toBe('UAT Grace')
        ->and(array_key_exists('lingua_il', $subito))->toBeFalse()
        ->and($caduta['persona']['nome'] ?? null)->toBe('UAT Grace')
        ->and(array_key_exists('lingua_il', $caduta))->toBeFalse()
        ->and($riuscita['lingua_il'] ?? null)->toBe('2026-10-09T21:31:11.000000Z');
});

// Sprint 49 · T2 (voce #2071; R1 della review della PR #82, R9 della PR #81). Lingua e segno della lingua sono una coppia: una
// lettura di io.mostra che non porta avanti il segno ricordato per la persona — più vecchia, finita dopo una più nuova — non
// cambia la lingua della sessione. Fino alla `v2.11.3` la cambiava, e la lingua superata stava sotto il segno più nuovo: a pari
// segno con `subito` il browser la teneva. Il segno ricordato più avanti di adesso si mette a mano: `Segno` non torna indietro
// nella stessa richiesta, e due richieste in volo insieme non si fanno in un caso.
it('una lettura di io.mostra più vecchia del segno della lingua ricordato non cambia la lingua della sessione: Cornice::dopo(), Cornice::subito() e Cornice::lingua() danno quella ricordata, col suo segno (sprint 49 · T2.1)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:05.000000', 'UTC'));
    sessioneAMano(marketing(), 'it');
    session()->put('zr-core.lingua', ['persona' => 'uat-ada', 'il' => '2026-10-09T21:31:09.000000Z']);
    backofficeDiChiHaAccettato(['/v1/io' => ioMostraCon(['lingua' => 'es', 'nome' => 'UAT Ada Lovelace'])]);

    $dopo = (array) Cornice::dopo();
    $subito = (array) Cornice::subito();

    // Il nome della lettura più vecchia passa com'è (R1 della review della PR #83): resta ferma solo la lingua.
    expect([$dopo['lingua'] ?? null, $dopo['lingua_il'] ?? null])->toBe(['it', '2026-10-09T21:31:09.000000Z'])
        ->and($subito['lingua'] ?? null)->toBe('it')
        ->and([$dopo['persona']['nome'] ?? null, $subito['persona']['nome'] ?? null])->toBe(['UAT Ada Lovelace', 'UAT Ada Lovelace'])
        ->and(Cornice::lingua())->toBe('it');
});

// S1 della revisione di sicurezza della PR #83: un segno della lingua ricordato avanti dell'orologio di più di cinque minuti
// l'ha dato un server del frontend con l'orologio avanti, e non vale, come il cookie del segno (`Segno`): la lingua della
// lettura passa, e il suo segno prende il posto di quello ricordato. Cinque minuti esatti valgono ancora.
it('un segno della lingua ricordato avanti dell\'orologio di più di cinque minuti non vale: la lingua di io.mostra passa col segno della lettura; a cinque minuti esatti vale (sprint 49 · T5, S1)', function (string $ricordato, array $atteso) {
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:05.000000', 'UTC'));
    sessioneAMano(marketing(), 'it');
    session()->put('zr-core.lingua', ['persona' => 'uat-ada', 'il' => $ricordato]);
    backofficeDiChiHaAccettato(['/v1/io' => ioMostraCon(['lingua' => 'es'])]);

    $dopo = (array) Cornice::dopo();

    expect([$dopo['lingua'] ?? null, $dopo['lingua_il'] ?? null, Cornice::lingua()])->toBe($atteso);
})->with([
    'un\'ora avanti' => ['2026-10-09T22:31:05.000000Z', ['es', '2026-10-09T21:31:05.000000Z', 'es']],
    'cinque minuti e un microsecondo avanti' => ['2026-10-09T21:36:05.000001Z', ['es', '2026-10-09T21:31:05.000000Z', 'es']],
    'cinque minuti esatti avanti' => ['2026-10-09T21:36:05.000000Z', ['it', '2026-10-09T21:36:05.000000Z', 'it']],
]);

it('una lettura di io.mostra più avanti del segno della lingua ricordato, con un\'altra lingua, la porta col suo segno (sprint 49 · T2.2)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:09.000000', 'UTC'));
    sessioneAMano(marketing(), 'it');
    session()->put('zr-core.lingua', ['persona' => 'uat-ada', 'il' => '2026-10-09T21:31:05.000000Z']);
    backofficeDiChiHaAccettato(['/v1/io' => ioMostraCon(['lingua' => 'es'])]);

    $dopo = (array) Cornice::dopo();

    expect([$dopo['lingua'] ?? null, $dopo['lingua_il'] ?? null])->toBe(['es', '2026-10-09T21:31:09.000000Z'])
        ->and(((array) Cornice::subito())['lingua'] ?? null)->toBe('es')
        ->and(Cornice::lingua())->toBe('es');
});

it('senza un segno della lingua ricordato per la persona della sessione — nessuno, o quello di un\'altra persona entrata prima nello stesso browser — la lingua di io.mostra passa come prima (sprint 49 · T2.3)', function (?array $ricordato) {
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:05.000000', 'UTC'));
    sessioneAMano(marketing(), 'it');
    if ($ricordato !== null) {
        session()->put('zr-core.lingua', $ricordato);
    }
    backofficeDiChiHaAccettato(['/v1/io' => ioMostraCon(['lingua' => 'es'])]);

    $dopo = (array) Cornice::dopo();

    expect([$dopo['lingua'] ?? null, $dopo['lingua_il'] ?? null])->toBe(['es', '2026-10-09T21:31:05.000000Z'])
        ->and(Cornice::lingua())->toBe('es');
})->with([
    'nessuno' => [null],
    'di un\'altra persona, più avanti' => [['persona' => 'uat-grace', 'il' => '2026-10-09T21:31:09.000000Z']],
]);

it('la parte server della cornice non usa Inertia: nessuna classe importata e nessuna chiamata, la prop rimandata la scrive il frontend (sprint 34 · T4.10)', function () {
    $file = glob(__DIR__.'/../../src/{*,*/*}.php', GLOB_BRACE) ?: [];

    expect($file)->not->toBe([])
        ->and(array_values(array_filter($file, fn (string $uno): bool => preg_match('/^use Inertia\\\\|Inertia::/m', (string) file_get_contents($uno)) === 1)))->toBe([]);
});

// Sprint 54 · T1 (voce #2098). La richiesta rimandata di una pagina riusa la lettura di io.mostra che Cornice::lingua() ha fatto
// per la pagina: una chiamata a /v1 in meno. Il legame sta tutto nella sessione: stessa persona, stesso workspace, segno ancora
// quello ricordato per la lingua, al più dieci secondi, una volta sola (Decisione di zr-pm del 14/10, nota 13228).

/** Una richiesta nuova con la stessa sessione: ciò che la cornice tiene sulla richiesta non c'è più. */
function richiestaNuova(): void
{
    app()->instance('request', Illuminate\Http\Request::create('/'));
}

it('la richiesta rimandata non rilegge io.mostra: Cornice::dopo() dopo la Cornice::lingua() della pagina dà le non lette e il segno di quella lettura, con le altre letture di sempre (sprint 54 · T1.1)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-14 13:30:00.000000', 'UTC'));
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato();

    Cornice::lingua();
    richiestaNuova();
    Carbon::setTestNow(Carbon::parse('2026-10-14 13:30:02.000000', 'UTC'));

    expect(Cornice::dopo())->toBe([...datiAttesi('2026-10-14T13:30:00.000000Z'), 'sessione_il' => '2026-10-14T13:30:00.000000Z', 'lingua_il' => '2026-10-14T13:30:00.000000Z'])
        ->and(array_count_values(percorsiChiamati()))->toBe(['/v1/io' => 1, '/v1/app' => 1, '/v1/io/aziende' => 1, '/v1/io/workspace' => 2]);
});

it('la lettura della pagina vale per una richiesta rimandata sola: una seconda Cornice::dopo() rilegge io.mostra (sprint 54 · T1.2)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-14 13:30:00.000000', 'UTC'));
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato(['/v1/io/workspace' => ['data' => [], 'successivo' => null]]);

    Cornice::lingua();
    richiestaNuova();
    Carbon::setTestNow(Carbon::parse('2026-10-14 13:30:01.000000', 'UTC'));
    Cornice::dopo();
    richiestaNuova();
    Carbon::setTestNow(Carbon::parse('2026-10-14 13:30:02.000000', 'UTC'));

    expect(((array) Cornice::dopo())['aggiornati_il'] ?? null)->toBe('2026-10-14T13:30:02.000000Z')
        ->and(array_count_values(percorsiChiamati())['/v1/io'])->toBe(2);
});

it('se fra la pagina e la sua richiesta rimandata nella sessione entra un\'altra persona, o la stessa passa a un altro workspace, Cornice::dopo() rilegge io.mostra e dà i dati di chi c\'è adesso (sprint 54 · T1.3)', function (array $chi, array $dove, int $nonLette) {
    Carbon::setTestNow(Carbon::parse('2026-10-14 13:30:00.000000', 'UTC'));
    sessioneAMano(marketing());
    $io = ioMostra(3);
    $altra = ioMostra($nonLette);
    $altra['data']['utente'] = [...$altra['data']['utente'], ...$chi];
    backofficeDiChiHaAccettato(['/v1/io' => Http::sequence()->push($io)->push($altra)]);

    Cornice::lingua();
    richiestaNuova();
    Carbon::setTestNow(Carbon::parse('2026-10-14 13:30:01.000000', 'UTC'));
    Sessione::entra(['gettone' => 'zr_'.Str::random(48), 'scade_il' => now()->addHour()->toIso8601String(), 'utente' => [...(array) Sessione::utente(), ...$chi], 'workspace' => $dove, 'ruolo' => 'membro']);
    $dopo = (array) Cornice::dopo();

    expect($dopo['non_lette'] ?? null)->toBe($nonLette)
        ->and($dopo['aggiornati_il'] ?? null)->toBe('2026-10-14T13:30:01.000000Z')
        ->and($dopo['persona']['email'] ?? null)->toBe($chi['email'] ?? 'uat-ada@example.com')
        ->and($dopo['workspace'] ?? null)->toBe(['nome' => $dove['nome'], 'slug' => $dove['slug']])
        ->and(array_count_values(percorsiChiamati())['/v1/io'])->toBe(2);
})->with([
    'un\'altra persona, nello stesso workspace' => [['id' => 'uat-grace', 'nome' => 'UAT Grace', 'email' => 'uat-grace@example.com'], marketing(), 9],
    'la stessa persona, in un altro workspace' => [[], ['id' => 'uat-ws-3', 'nome' => 'UAT Vendite', 'slug' => 'uat-vendite'], 7],
]);

it('la lettura della pagina vale per la richiesta rimandata fino a dieci secondi esatti dal suo segno; un microsecondo dopo Cornice::dopo() rilegge io.mostra (sprint 54 · T1.4)', function (string $quando, int $letture) {
    Carbon::setTestNow(Carbon::parse('2026-10-14 13:30:00.000000', 'UTC'));
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato();

    Cornice::lingua();
    richiestaNuova();
    Carbon::setTestNow(Carbon::parse($quando, 'UTC'));
    Cornice::dopo();

    expect(array_count_values(percorsiChiamati())['/v1/io'])->toBe($letture);
})->with([
    'a dieci secondi' => ['2026-10-14 13:30:10.000000', 1],
    'a dieci secondi e un microsecondo' => ['2026-10-14 13:30:10.000001', 2],
]);

it('se fra la pagina e la sua richiesta rimandata un\'altra lettura porta avanti il segno ricordato della lingua, Cornice::dopo() rilegge io.mostra: non dà una lettura più vecchia di quella ricordata (sprint 54 · T1.5)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-14 13:30:00.000000', 'UTC'));
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato(['/v1/io/workspace' => ['data' => [], 'successivo' => null]]);

    Cornice::lingua();
    // Un'altra scheda, con la cornice in una richiesta sola.
    richiestaNuova();
    Carbon::setTestNow(Carbon::parse('2026-10-14 13:30:01.000000', 'UTC'));
    Cornice::dati();
    richiestaNuova();
    Carbon::setTestNow(Carbon::parse('2026-10-14 13:30:02.000000', 'UTC'));
    $dopo = (array) Cornice::dopo();

    expect($dopo['aggiornati_il'] ?? null)->toBe('2026-10-14T13:30:02.000000Z')
        ->and(array_count_values(percorsiChiamati())['/v1/io'])->toBe(3);
});

it('se la lettura di io.mostra della pagina fallisce, la richiesta rimandata la rifà: Cornice::dopo() non riusa un errore (sprint 54 · T1.6)', function (Closure $errore) {
    Carbon::setTestNow(Carbon::parse('2026-10-14 13:30:00.000000', 'UTC'));
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato(['/v1/io' => $errore(Http::sequence())->push(ioMostra(3))]);

    Cornice::lingua();
    richiestaNuova();
    Carbon::setTestNow(Carbon::parse('2026-10-14 13:30:01.000000', 'UTC'));
    $dopo = (array) Cornice::dopo();

    expect($dopo['non_lette'] ?? null)->toBe(3)
        ->and($dopo['aggiornati_il'] ?? null)->toBe('2026-10-14T13:30:01.000000Z')
        ->and(array_count_values(percorsiChiamati())['/v1/io'])->toBe(2);
})->with([
    'un 5xx' => [fn ($sequenza) => $sequenza->pushResponse(nonRisponde(502, null))],
    'un 429' => [fn ($sequenza) => $sequenza->pushResponse(nonRisponde(429, 'troppe_richieste'))],
    'il 403 accettazione_richiesta' => [fn ($sequenza) => $sequenza->pushResponse(accettazioneRichiesta())],
    'la connessione che cade' => [fn ($sequenza) => $sequenza->pushFailedConnection()],
]);

it('la lettura tenuta per la richiesta rimandata la prende solo Cornice::dopo(): Cornice::lingua() e Cornice::dati() di una richiesta dopo leggono io.mostra come sempre (sprint 54 · T1.7)', function (string $chi) {
    Carbon::setTestNow(Carbon::parse('2026-10-14 13:30:00.000000', 'UTC'));
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato();

    Cornice::lingua();
    richiestaNuova();
    Carbon::setTestNow(Carbon::parse('2026-10-14 13:30:01.000000', 'UTC'));
    $chi === 'lingua' ? Cornice::lingua() : Cornice::dati();

    expect(array_count_values(percorsiChiamati())['/v1/io'])->toBe(2);
})->with(['lingua', 'dati']);

it('la lettura tenuta per la richiesta rimandata esce dalla sessione all\'uscita e al cambio di workspace, non solo coi dieci secondi: tornando subito al workspace di prima, Cornice::dopo() rilegge io.mostra (sprint 54 · T1.10)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-14 13:30:00.000000', 'UTC'));
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato();
    $entraIn = fn (array $workspace) => Sessione::entra(['gettone' => 'zr_'.Str::random(48), 'scade_il' => now()->addHour()->toIso8601String(), 'utente' => Sessione::utente(), 'workspace' => $workspace, 'ruolo' => 'membro']);

    Cornice::lingua();
    expect(session()->has('zr-core.io-mostra-rimandata'))->toBeTrue();

    // Il cambio di workspace: la pagina dopo, nell'altro workspace, la toglie appena chiede la cornice.
    richiestaNuova();
    $entraIn(['id' => 'uat-ws-3', 'nome' => 'UAT Vendite', 'slug' => 'uat-vendite']);
    Cornice::subito();
    expect(session()->has('zr-core.io-mostra-rimandata'))->toBeFalse();

    $entraIn(marketing());
    richiestaNuova();
    Carbon::setTestNow(Carbon::parse('2026-10-14 13:30:01.000000', 'UTC'));
    Cornice::dopo();
    expect(array_count_values(percorsiChiamati())['/v1/io'])->toBe(2);

    // L'uscita.
    richiestaNuova();
    Cornice::lingua();
    expect(session()->has('zr-core.io-mostra-rimandata'))->toBeTrue();
    Sessione::chiudi();
    expect(session()->has('zr-core.io-mostra-rimandata'))->toBeFalse();
});

it('i dieci secondi si contano sull\'orologio del server: una lettura tenuta con l\'ora più avanti di quella di chi la usa (un server con l\'orologio avanti) non vale, e Cornice::dopo() rilegge io.mostra (sprint 54 · T1.4; revisione di sicurezza S1)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-14 13:30:00.000000', 'UTC'));
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato();

    Cornice::lingua();
    richiestaNuova();
    // Il server della richiesta rimandata ha l'orologio un secondo indietro.
    Carbon::setTestNow(Carbon::parse('2026-10-14 13:29:59.000000', 'UTC'));
    Cornice::dopo();

    expect(array_count_values(percorsiChiamati())['/v1/io'])->toBe(2);
});

it('una lettura fallita della pagina non resta nella sessione e toglie quella di prima: la richiesta rimandata rilegge io.mostra anche se una pagina prima, riuscita, aveva il segno ancora ricordato (sprint 54 · T1.6; review R3)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-14 13:30:00.000000', 'UTC'));
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato(['/v1/io' => Http::sequence()->push(ioMostra(3))->pushResponse(nonRisponde(502, null))->push(ioMostra(5))]);

    Cornice::lingua();
    richiestaNuova();
    Carbon::setTestNow(Carbon::parse('2026-10-14 13:30:01.000000', 'UTC'));
    Cornice::lingua();
    expect(session()->has('zr-core.io-mostra-rimandata'))->toBeFalse();

    richiestaNuova();
    Carbon::setTestNow(Carbon::parse('2026-10-14 13:30:02.000000', 'UTC'));
    $dopo = (array) Cornice::dopo();

    expect($dopo['non_lette'] ?? null)->toBe(5)
        ->and(array_count_values(percorsiChiamati())['/v1/io'])->toBe(3);
});

it('la lettura tenuta esce dalla sessione appena la cornice è chiesta da un\'altra persona entrata nello stesso browser, nello stesso workspace (sprint 54 · T1.3; review R3)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-14 13:30:00.000000', 'UTC'));
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato();
    $grace = ['id' => 'uat-grace', 'nome' => 'UAT Grace', 'email' => 'uat-grace@example.com', 'email_verificata_il' => now()->toIso8601String(), 'lingua' => 'it', 'fuso_orario' => 'Europe/Rome'];

    Cornice::lingua();
    richiestaNuova();
    Sessione::entra(['gettone' => 'zr_'.Str::random(48), 'scade_il' => now()->addHour()->toIso8601String(), 'utente' => $grace, 'workspace' => marketing(), 'ruolo' => 'membro']);
    Cornice::subito();

    expect(session()->has('zr-core.io-mostra-rimandata'))->toBeFalse();
});

it('una lettura tenuta che non ha la sua forma esce dalla sessione e non rompe la richiesta rimandata: Cornice::dopo() rilegge io.mostra (sprint 54; revisione di sicurezza S7)', function (array $guasta) {
    Carbon::setTestNow(Carbon::parse('2026-10-14 13:30:00.000000', 'UTC'));
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato();

    Cornice::lingua();
    richiestaNuova();
    session()->put('zr-core.io-mostra-rimandata', [...(array) session('zr-core.io-mostra-rimandata'), ...$guasta]);
    $dopo = (array) Cornice::dopo();

    expect($dopo['non_lette'] ?? null)->toBe(3)
        ->and(session()->has('zr-core.io-mostra-rimandata'))->toBeFalse()
        ->and(array_count_values(percorsiChiamati())['/v1/io'])->toBe(2);
})->with([
    'il segno non è un testo' => [['segno' => 20261014]],
    'le non lette non sono un numero' => [['esito' => '3']],
    'senza l\'ora del server' => [['il' => null]],
]);
