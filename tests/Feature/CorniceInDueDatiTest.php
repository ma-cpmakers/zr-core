<?php

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

it('Cornice::dopo() dà ciò che Cornice::dati() dà, nello stesso ordine e con le letture di sempre — chi ha letto (lingua e persona), il workspace di cui sono, prodotti, aziende, non lette e il segno — e in fondo sessione_il, l\'istante in cui quella persona è stata letta (sprint 34 · T4.2; review della PR #67, R6; sprint 37 · T2.3)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-09 21:31:05.123456', 'UTC'));
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato();

    $dopo = Cornice::dopo();

    // Le letture di una Cornice::dati(): una per metodo, e i workspace sulle loro due pagine. dopo() non ne aggiunge.
    expect($dopo)->toBe([...datiAttesi('2026-10-09T21:31:05.123456Z'), 'sessione_il' => '2026-10-09T21:31:05.123456Z'])
        ->and(array_keys((array) $dopo))->toBe(['lingua', 'persona', 'workspace', 'prodotti', 'aziende', 'non_lette', 'aggiornati_il', 'sessione_il'])
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

it('se il backoffice non risponde — la connessione cade, un 5xx, un 429 — Cornice::dopo() non lancia e dà non_letti col segno di quell\'istante e con chi è nella sessione — lingua, persona, workspace e in fondo sessione_il —, e nient\'altro, da qualunque delle letture arrivi; nel log una riga d\'avviso col tipo dell\'errore e mai il suo messaggio (sprint 34 · T4.2; review della PR #67, R5; sprint 41 · T4.1)', function (string $percorso, int $stato, ?string $codice, string $tipo) {
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

it('un errore di /v1 che non è «il backoffice non risponde» passa da Cornice::dopo() com\'è, come da Cornice::dati(): non diventa non_letti (sprint 34 · T4.2)', function (string $percorso, int $stato, string $codice) {
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato([$percorso => nonRisponde($stato, $codice)]);

    expect(fn () => Cornice::dopo())->toThrow(fn (ErroreApi $errore) => expect([$errore->stato, $errore->codice])->toBe([$stato, $codice]));
})->with([
    'io.mostra, 403 gettone_senza_workspace' => ['/v1/io', 403, 'gettone_senza_workspace'],
    'app.elenca, 404' => ['/v1/app', 404, 'non_trovato'],
    'app.elenca, un 403 che somiglia all\'accettazione e non lo è' => ['/v1/app', 403, 'permesso_negato'],
]);

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

    expect(Cornice::dopo())->toBe([...datiRidotti('2026-10-09T21:31:05.123456Z'), 'sessione_il' => '2026-10-09T21:31:05.123456Z'])
        ->and(avvisiDellaRiga())->toBe([]);
})->with(['/v1/io', '/v1/app', '/v1/io/aziende', '/v1/io/workspace']);

it('la parte server della cornice non usa Inertia: nessuna classe importata e nessuna chiamata, la prop rimandata la scrive il frontend (sprint 34 · T4.10)', function () {
    $file = glob(__DIR__.'/../../src/{*,*/*}.php', GLOB_BRACE) ?: [];

    expect($file)->not->toBe([])
        ->and(array_values(array_filter($file, fn (string $uno): bool => preg_match('/^use Inertia\\\\|Inertia::/m', (string) file_get_contents($uno)) === 1)))->toBe([]);
});
