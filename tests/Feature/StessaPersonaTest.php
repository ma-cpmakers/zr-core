<?php

use Illuminate\Foundation\Http\Middleware\ConvertEmptyStringsToNull;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Illuminate\Testing\TestResponse;
use Zeiras\Auth\Persona;
use Zeiras\Auth\Testing\Gettone;

// Sprint 40 · T2 (voce #2051): una regola sola per le rotte della cornice. In una scheda rimasta ferma la sessione può essere
// passata a un'altra persona dello stesso workspace: la pagina mostra ancora chi c'era, e ciò che chiede lo chiede per lei.
// La richiesta dice di chi è la pagina — nell'intestazione `Persona`, l'email passata da `encodeURIComponent`, o in `persona`
// nel corpo JSON — e la rotta la confronta con l'email della sessione prima di ogni altra cosa sua: se non è quella risponde
// 409, senza chiamare il backoffice e senza dati. Non sceglie mai di chi sono i dati: lo dice sempre e solo la sessione.

const WORKSPACE_DELLA_PERSONA = ['id' => 'uat-ws', 'nome' => 'UAT Marketing', 'slug' => 'uat-marketing'];
const GRACE_NELLA_SESSIONE = ['id' => 'uat-persona-2', 'nome' => 'UAT Grace', 'email' => 'uat-grace@example.com'];
/** Ciò che serve a ognuna delle rotte per arrivare al backoffice: ogni rotta legge le chiavi sue. */
const CORPO_PER_OGNI_ROTTA = ['letta' => true, 'q' => 'uat', 'fino_a' => '2026-10-08T10:00:00.123Z', 'workspace' => 'uat-marketing'];

/**
 * Le rotte della cornice lette dal router, non scritte qui: di ognuna il metodo e l'indirizzo, con un id al posto di un
 * parametro. Una rotta nuova sotto `cornice/` entra da sé nei casi di questo file.
 *
 * @return list<array{string, string}>
 */
function rotteDellaCorniceDalRouter(): array
{
    return collect(Route::getRoutes()->getRoutes())
        ->filter(fn ($rotta) => str_starts_with($rotta->uri(), 'cornice/'))
        ->map(fn ($rotta) => [array_values(array_diff($rotta->methods(), ['HEAD']))[0], (string) preg_replace('/\{[^}]+\}/', 'uat-n3', $rotta->uri())])
        ->values()->all();
}

/**
 * Una richiesta JSON a una rotta della cornice, col corpo che va bene a tutte più quello del caso.
 *
 * @param  array<string, mixed>  $corpo
 * @param  array<string, string>  $intestazioni
 */
function allaCornice(string $metodo, string $indirizzo, array $corpo = [], array $intestazioni = [], bool $corpoDiTutte = true): TestResponse
{
    // Qui la persona è quella del caso e basta: non quella che `sessioneAMano` mette a ogni richiesta (la pagina della persona
    // della sessione). L'impronta della sessione resta, come la manda la pagina, se il caso non ne dice un'altra o non la toglie.
    $risposta = test()->withoutHeader('Persona')->json($metodo, $indirizzo, ($corpoDiTutte ? CORPO_PER_OGNI_ROTTA : []) + $corpo, $intestazioni);
    Gettone::assenteDa($risposta);

    return $risposta;
}

/**
 * Le rotte della cornice che a quella richiesta non danno quella risposta, stato e corpo: `[]` quando la regola c'è su tutte.
 *
 * @param  array<string, mixed>  $corpo
 * @param  array<string, string>  $intestazioni
 * @return list<string>
 */
function rotteCheNonRispondono(int $stato, string $risposta, array $corpo, array $intestazioni): array
{
    $altre = [];
    foreach (rotteDellaCorniceDalRouter() as [$metodo, $indirizzo]) {
        $avuta = allaCornice($metodo, $indirizzo, $corpo, $intestazioni);
        if ($avuta->getStatusCode() !== $stato || $avuta->getContent() !== $risposta) {
            $altre[] = "{$metodo} {$indirizzo}";
        }
    }

    return $altre;
}

it('ogni rotta della cornice, letta dal router, a una richiesta di un\'altra persona — email e impronta che non sono quelle della sessione — risponde 409 persona_diversa con `persona` vuota e nient\'altro — nemmeno l\'email della sessione, dalla `v2.12.0` —, e non chiama il backoffice (sprint 40 · T2.1, T2.2; sprint 51 · T1.1)', function (array $corpo, array $intestazioni) {
    sessioneAMano(WORKSPACE_DELLA_PERSONA, 'en', GRACE_NELLA_SESSIONE);
    Http::fake();
    $diGrace = '{"errore":"persona_diversa","persona":""}';
    // Dalla `v2.23.0` di chi è la pagina lo dice l'impronta, non l'email: la pagina di Ada porta quella di Ada.
    $intestazioni += [Persona::INTESTAZIONE => improntaDi('uat-ada')];

    // Le quattro di oggi ci sono tutte: un elenco vuoto non proverebbe niente.
    expect(array_map(fn (array $rotta) => implode(' ', $rotta), rotteDellaCorniceDalRouter()))->toEqualCanonicalizing([
        'GET cornice/notifiche', 'POST cornice/notifiche/letture', 'PATCH cornice/notifiche/uat-n3/lettura', 'POST cornice/ricerca',
    ])->and(rotteCheNonRispondono(409, $diGrace, $corpo, $intestazioni))->toBe([]);
    Http::assertNothingSent();

    // Il controllo nei due versi: una quinta rotta sotto `cornice/` senza la regola la trova il caso, perché l'elenco è del router.
    Route::middleware('web')->get('cornice/quinta', fn () => ['data' => 'di Grace']);
    expect(rotteCheNonRispondono(409, $diGrace, $corpo, $intestazioni))->toBe(['GET cornice/quinta']);
})->with([
    'nell\'intestazione' => [[], ['Persona' => 'uat-ada%40example.com']],
    'nel corpo' => [['persona' => 'uat-ada@example.com'], []],
    'in tutti e due i posti' => [['persona' => 'uat-ada@example.com'], ['Persona' => 'uat-ada%40example.com']],
]);

it('una richiesta che dice la persona della sessione arriva al backoffice da ogni rotta: né il 409 né il 422 della regola (sprint 40 · T2.1, T2.3; sprint 52 · T1.2, T1.3)', function (array $corpo, array $intestazioni) {
    sessioneAMano(WORKSPACE_DELLA_PERSONA, 'en', GRACE_NELLA_SESSIONE);
    Http::fake();

    foreach (rotteDellaCorniceDalRouter() as [$metodo, $indirizzo]) {
        $prima = Http::recorded()->count();
        $avuta = allaCornice($metodo, $indirizzo, $corpo, $intestazioni);

        // Il backoffice finto risponde un 200 vuoto, e la rotta ne fa un suo errore: qui conta solo che lo abbia chiamato.
        expect(Http::recorded()->count())->toBeGreaterThan($prima, "{$metodo} {$indirizzo}")
            ->and($avuta->getContent())->not->toContain('persona_diversa')->not->toContain('dati_non_validi');
    }
})->with([
    'nell\'intestazione' => [[], ['Persona' => 'uat-grace%40example.com']],
    'nel corpo' => [['persona' => 'uat-grace@example.com'], []],
    'in tutti e due i posti' => [['persona' => 'uat-grace@example.com'], ['Persona' => 'uat-grace%40example.com']],
]);

// Sprint 52 · T1 (voce #2080): una richiesta che non dice la persona non arriva più alla rotta. Il JS della cornice la dice
// sempre dalla `v2.6.0`: chi non la dice è un JS di prima rimasto in una scheda, che non sa di chi è la pagina che chiede. Il
// 422 porta `persona` vuota apposta: il JS della `v2.5.x` la prende per «un'altra persona» (elenco e ricerca) e ricarica la scheda.
it('una richiesta che non dice la persona — né l\'intestazione Persona né `persona` nel corpo; un\'intestazione con un altro nome o la query non contano — riceve da ogni rotta 422 persona_mancante con `persona` vuota e nient\'altro, e il backoffice non è chiamato (sprint 52 · T1.1, T1.2)', function (array $intestazioni, string $query) {
    sessioneAMano(WORKSPACE_DELLA_PERSONA, 'en', GRACE_NELLA_SESSIONE);
    Http::fake();
    $senza = '{"errore":"persona_mancante","persona":""}';

    $altre = [];
    foreach (rotteDellaCorniceDalRouter() as [$metodo, $indirizzo]) {
        $avuta = allaCornice($metodo, $indirizzo.$query, [], $intestazioni);
        if ($avuta->getStatusCode() !== 422 || $avuta->getContent() !== $senza) {
            $altre[] = "{$metodo} {$indirizzo}";
        }
    }
    expect($altre)->toBe([]);
    Http::assertNothingSent();

    // Nei due versi: la stessa richiesta con la persona della sessione arriva al backoffice.
    allaCornice('POST', 'cornice/notifiche/letture'.$query, ['persona' => 'uat-grace@example.com'], $intestazioni);
    Http::assertSentCount(1);
})->with([
    'non la dice' => [[], ''],
    'in un\'intestazione che non è quella' => [['X-Persona' => 'uat-grace%40example.com', 'X-Zeiras-Persona' => 'uat-grace%40example.com'], ''],
    'nella query' => [[], '?persona=uat-grace%40example.com&email=uat-grace%40example.com'],
]);

it('«Segna tutte come lette» senza la persona riceve 422 persona_mancante e non segna niente; con la persona della sessione nel corpo, o solo nell\'intestazione, segna (sprint 52 · T1.2)', function () {
    sessioneAMano(WORKSPACE_DELLA_PERSONA, 'en', GRACE_NELLA_SESSIONE);
    Http::fake();
    $corpo = ['fino_a' => '2026-10-08T10:00:00.123Z', 'workspace' => 'uat-marketing'];

    allaCornice('POST', 'cornice/notifiche/letture', $corpo, [], false)->assertStatus(422)->assertExactJson(['errore' => 'persona_mancante', 'persona' => '']);
    Http::assertNothingSent();

    allaCornice('POST', 'cornice/notifiche/letture', $corpo + ['persona' => 'uat-grace@example.com'], [], false);
    Http::assertSentCount(1);
    allaCornice('POST', 'cornice/notifiche/letture', $corpo, ['Persona' => 'uat-grace%40example.com'], false);
    Http::assertSentCount(2);
});

it('una persona detta che non si può confrontare — non un testo, anche null, o un testo vuoto — è un 422 dati_non_validi su ogni rotta, e il backoffice non è chiamato: non vale come non detta (sprint 40 · T2.3)', function (array $corpo, array $intestazioni, bool $comArriva = false) {
    if ($comArriva) {
        test()->withoutMiddleware(ConvertEmptyStringsToNull::class);
    }
    sessioneAMano(WORKSPACE_DELLA_PERSONA, 'en', GRACE_NELLA_SESSIONE);
    Http::fake();

    expect(rotteCheNonRispondono(422, '{"errore":"dati_non_validi"}', $corpo, $intestazioni))->toBe([]);
    Http::assertNothingSent();
})->with([
    'null nel corpo' => [['persona' => null], []],
    'un numero' => [['persona' => 7], []],
    'true' => [['persona' => true], []],
    'una lista' => [['persona' => ['uat-grace@example.com']], []],
    'un oggetto' => [['persona' => ['email' => 'uat-grace@example.com']], []],
    'un testo vuoto nel corpo, coi middleware di Laravel' => [['persona' => ''], []],
    'un testo vuoto nel corpo, senza ConvertEmptyStringsToNull' => [['persona' => ''], [], true],
    'un\'intestazione vuota' => [[], ['Persona' => '']],
    // Quella buona in un posto non salva quella che non si può confrontare nell'altro.
    'null nel corpo e quella della sessione nell\'intestazione' => [['persona' => null], ['Persona' => 'uat-grace%40example.com']],
    'un\'intestazione vuota e quella della sessione nel corpo' => [['persona' => 'uat-grace@example.com'], ['Persona' => '']],
]);

// Review della PR #74, R3 (seconda lettura, N1): una sessione senza l'email della persona (il contratto del backoffice la dà
// sempre: senza, i dati non sono i suoi). La cornice manderebbe ciò che `encodeURIComponent` fa di quell'email: niente se è
// un testo vuoto, il testo `null` o `undefined` se manca. La regola li rifiuta tutti: non li prende per non detti, e una
// persona detta non è mai «quella della sessione» se la sessione non ha un'email.
it('con una sessione senza email nessuna richiesta che dice la persona arriva al backoffice: un\'intestazione vuota è un 422, un testo — `null` e `undefined` che la cornice manderebbe, o un\'email — un 409 (review della PR #74, R3; seconda lettura, N1)', function (array $intestazioni, int $stato, string $risposta) {
    sessioneAMano(WORKSPACE_DELLA_PERSONA, 'en', ['email' => null] + GRACE_NELLA_SESSIONE);
    Http::fake();

    expect(rotteCheNonRispondono($stato, $risposta, [], $intestazioni))->toBe([]);
    Http::assertNothingSent();
})->with([
    'l\'intestazione vuota' => [['Persona' => ''], 422, '{"errore":"dati_non_validi"}'],
    'un\'email' => [['Persona' => 'uat-grace%40example.com'], 409, '{"errore":"persona_diversa","persona":""}'],
    'il testo null' => [['Persona' => 'null'], 409, '{"errore":"persona_diversa","persona":""}'],
    'il testo undefined' => [['Persona' => 'undefined'], 409, '{"errore":"persona_diversa","persona":""}'],
]);

it('se la richiesta dice la persona nell\'intestazione e nel corpo valgono tutte e due: basta che una non sia quella della sessione, ed è un 409 (sprint 40 · T2.4)', function (string $nelCorpo, string $nellIntestazione) {
    // Dalla `v2.23.0` l'email decide solo senza un'impronta da confrontare: una sessione senza id.
    sessioneAMano(WORKSPACE_DELLA_PERSONA, 'en', ['id' => null] + GRACE_NELLA_SESSIONE);
    Http::fake();

    expect(rotteCheNonRispondono(409, '{"errore":"persona_diversa","persona":""}', ['persona' => $nelCorpo], ['Persona' => $nellIntestazione]))->toBe([]);
    Http::assertNothingSent();
})->with([
    'quella della sessione solo nel corpo' => ['uat-grace@example.com', 'uat-ada%40example.com'],
    'quella della sessione solo nell\'intestazione' => ['uat-ada@example.com', 'uat-grace%40example.com'],
]);

it('l\'intestazione porta l\'email come la scrive `encodeURIComponent`, e la rotta la legge com\'era: lettere accentate, `+` e apostrofo tornano quelli (sprint 40 · T2.4)', function (string $email, string $nellIntestazione, bool $passa) {
    // Senza id non c'è un'impronta: dalla `v2.23.0` è l'unico caso in cui l'email decide, e quindi in cui si legge com'era.
    sessioneAMano(WORKSPACE_DELLA_PERSONA, 'en', ['email' => $email, 'id' => null] + GRACE_NELLA_SESSIONE);
    Http::fake();

    foreach (rotteDellaCorniceDalRouter() as [$metodo, $indirizzo]) {
        $prima = Http::recorded()->count();
        $avuta = allaCornice($metodo, $indirizzo, [], ['Persona' => $nellIntestazione]);

        if ($passa) {
            expect(Http::recorded()->count())->toBeGreaterThan($prima, "{$metodo} {$indirizzo}");
        } else {
            // Dalla `v2.12.0` la risposta non dice l'email della sessione, né com'è né com'è arrivata.
            expect($avuta->getStatusCode())->toBe(409)
                ->and($avuta->json())->toBe(['errore' => 'persona_diversa', 'persona' => ''])
                ->and(Http::recorded()->count())->toBe($prima);
        }
    }
})->with([
    'accenti, + e apostrofo codificati' => ['uat-àda+x\'y@example.com', 'uat-%C3%A0da%2Bx\'y%40example.com', true],
    // Un `+` non codificato resta un `+`: non diventa uno spazio, come in una query.
    'un + scritto com\'è' => ['uat+x@example.com', 'uat+x%40example.com', true],
    'un + al posto di uno spazio non è lo spazio' => ['uat x@example.com', 'uat+x%40example.com', false],
    'senza la chiocciola codificata' => ['uat-grace@example.com', 'uat-grace@example.com', true],
]);

it('l\'ordine dei rifiuti è lo stesso su ogni rotta: il 401 della guardia viene prima della persona, che dalla `v2.12.0` viene prima del 403 senza workspace, dei 422 della rotta e del 409 workspace_diverso (sprint 40 · T2.5; sprint 51 · T1.2; sprint 52 · T1.3)', function () {
    Http::fake();
    $diAda = ['Persona' => 'uat-ada%40example.com', Persona::INTESTAZIONE => improntaDi('uat-ada')];

    // Senza sessione: 401, anche con una persona che non si può confrontare.
    foreach (rotteDellaCorniceDalRouter() as [$metodo, $indirizzo]) {
        allaCornice($metodo, $indirizzo, ['persona' => null], $diAda)->assertUnauthorized();
        allaCornice($metodo, $indirizzo)->assertUnauthorized();
    }

    // Con la sessione ma senza workspace risponde prima la persona (dalla `v2.12.0`): il 422 di quella che non si confronta, il
    // 409 di un'altra, e dalla `v2.13.0` il 422 di una richiesta che non la dice; il 403 è solo di chi è nella sessione.
    sessioneAMano(null, 'en', GRACE_NELLA_SESSIONE);
    foreach (rotteDellaCorniceDalRouter() as [$metodo, $indirizzo]) {
        allaCornice($metodo, $indirizzo, [], $diAda)->assertStatus(409)->assertExactJson(['errore' => 'persona_diversa', 'persona' => '']);
        allaCornice($metodo, $indirizzo)->assertStatus(422)->assertExactJson(['errore' => 'persona_mancante', 'persona' => '']);
        allaCornice($metodo, $indirizzo, ['persona' => 7], ['Persona' => 'uat-grace%40example.com'])->assertStatus(422)->assertExactJson(['errore' => 'dati_non_validi']);
        allaCornice($metodo, $indirizzo, [], ['Persona' => 'uat-grace%40example.com'])->assertForbidden()->assertExactJson(['errore' => 'gettone_senza_workspace']);
    }

    // Col workspace e un corpo che ogni rotta rifiuterebbe per conto suo (niente `letta`, niente `q`, un `fino_a` che non è
    // un istante, un altro workspace): risponde la persona, prima il 422 di quella che non si confronta e poi il 409.
    sessioneAMano(WORKSPACE_DELLA_PERSONA, 'en', GRACE_NELLA_SESSIONE);
    $sbagliato = ['fino_a' => 'ieri', 'workspace' => 'uat-vendite'];
    foreach (rotteDellaCorniceDalRouter() as [$metodo, $indirizzo]) {
        expect(allaCornice($metodo, $indirizzo, $sbagliato, $diAda, false)->assertStatus(409)->getContent())->toBe('{"errore":"persona_diversa","persona":""}');
        allaCornice($metodo, $indirizzo, $sbagliato + ['persona' => 7], $diAda, false)->assertStatus(422)->assertExactJson(['errore' => 'dati_non_validi']);
    }

    // Con la persona della sessione risponde la rotta: i suoi rifiuti sono quelli di prima.
    $diGrace = ['Persona' => 'uat-grace%40example.com'];
    allaCornice('POST', 'cornice/notifiche/letture', ['fino_a' => '2026-10-08T10:00:00.123Z', 'workspace' => 'uat-vendite'], $diGrace, false)->assertStatus(409)->assertExactJson(['errore' => 'workspace_diverso']);
    allaCornice('POST', 'cornice/notifiche/letture', $sbagliato, $diGrace, false)->assertStatus(422)->assertExactJson(['errore' => 'dati_non_validi']);
    allaCornice('PATCH', 'cornice/notifiche/uat-n3/lettura', [], $diGrace, false)->assertStatus(422)->assertExactJson(['errore' => 'dati_non_validi']);
    allaCornice('POST', 'cornice/ricerca', [], $diGrace, false)->assertStatus(422)->assertExactJson(['errore' => 'dati_non_validi']);
    Http::assertNothingSent();
});

// Sprint 44 · T4 (voce #2061), sprint 51 · T1 (voce #2078): chi è entrato senza workspace (prima della scelta) in una scheda
// rimasta ferma di un'altra persona: dalla `v2.12.0` quella scheda riceve il 409 `persona_diversa` della regola della persona,
// che viene prima di `ConWorkspace`, e si ricarica come per ogni risposta di un'altra persona. Il 403 arriva solo a chi è
// nella sessione (dalla `v2.13.0` una richiesta che non dice la persona riceve il 422 prima), e non dice di chi è la sessione:
// niente email di chi è entrato.
it('con la sessione ma senza workspace la richiesta di un\'altra persona riceve 409 persona_diversa con `persona` vuota e niente altro, quella della persona della sessione 403 gettone_senza_workspace e niente altro, quella senza persona 422 persona_mancante; senza sessione il 401 non dice la persona; il backoffice non si chiama (sprint 44 · T4.1, T4.3, T4.4; sprint 51 · T1.2; sprint 52 · T1.3)', function () {
    Http::fake();
    $diAda = ['Persona' => 'uat-ada%40example.com', Persona::INTESTAZIONE => improntaDi('uat-ada')];
    $diGrace = ['Persona' => 'uat-grace%40example.com'];

    foreach (rotteDellaCorniceDalRouter() as [$metodo, $indirizzo]) {
        expect(allaCornice($metodo, $indirizzo, [], $diAda)->assertUnauthorized()->getContent())->not->toContain('persona')->not->toContain('uat-ada');
    }

    sessioneAMano(null, 'it', GRACE_NELLA_SESSIONE);
    foreach (rotteDellaCorniceDalRouter() as [$metodo, $indirizzo]) {
        // Il corpo intero, carattere per carattere: né nome, né lingua, né workspace, né un'email.
        expect(allaCornice($metodo, $indirizzo, [], $diAda)->assertStatus(409)->getContent())->toBe('{"errore":"persona_diversa","persona":""}');
        expect(allaCornice($metodo, $indirizzo, [], $diGrace)->assertForbidden()->getContent())->toBe('{"errore":"gettone_senza_workspace"}')
            ->and(allaCornice($metodo, $indirizzo)->assertStatus(422)->getContent())->toBe('{"errore":"persona_mancante","persona":""}');
    }
    Http::assertNothingSent();
});

it('con una sessione senza email e senza workspace una richiesta che dice una persona riceve il 409, e una che non la dice il 422 persona_mancante (review della PR #78, R7; sprint 51 · T1.2; sprint 52 · T1.1)', function () {
    sessioneAMano(null, 'en', ['email' => null] + GRACE_NELLA_SESSIONE);
    Http::fake();

    foreach (rotteDellaCorniceDalRouter() as [$metodo, $indirizzo]) {
        expect(allaCornice($metodo, $indirizzo, [], ['Persona' => 'uat-grace%40example.com'])->assertStatus(409)->getContent())->toBe('{"errore":"persona_diversa","persona":""}')
            ->and(allaCornice($metodo, $indirizzo)->assertStatus(422)->getContent())->toBe('{"errore":"persona_mancante","persona":""}');
    }
    Http::assertNothingSent();
});

// Sprint 67 · T1 (voce #2216, Decisione di zr-pm del 21/10/2026). Dopo un cambio dell'email (zr-home #2214) le altre schede della
// stessa persona hanno la stessa impronta e l'email di prima: dalla `v2.23.0` l'impronta decide chi è la persona della pagina, e
// quelle schede non ricevono più il 409 «un'altra persona». L'impronta diversa o assente è il 409 di sempre, qualunque email dica.
it('con la sessione che ha un\'impronta, una richiesta che dice la sua impronta e un\'email che non è quella della sessione arriva al backoffice da ogni rotta: né il 409 né il 422 (sprint 67 · T1.1)', function (array $corpo, array $intestazioni) {
    sessioneAMano(WORKSPACE_DELLA_PERSONA, 'en', GRACE_NELLA_SESSIONE);
    Http::fake();
    expect(Persona::impronta())->not->toBeNull()->and(rotteDellaCorniceDalRouter())->not->toBeEmpty();

    foreach (rotteDellaCorniceDalRouter() as [$metodo, $indirizzo]) {
        $prima = Http::recorded()->count();
        $avuta = allaCornice($metodo, $indirizzo, $corpo, $intestazioni);

        // Il backoffice finto risponde un 200 vuoto, e la rotta ne fa un suo errore: qui conta solo che lo abbia chiamato.
        expect(Http::recorded()->count())->toBeGreaterThan($prima, "{$metodo} {$indirizzo}")
            ->and($avuta->getContent())->not->toContain('persona_diversa')->not->toContain('dati_non_validi')->not->toContain('persona_mancante');
    }
})->with([
    'l\'email di prima nell\'intestazione' => [[], ['Persona' => 'uat-ada%40example.com']],
    'l\'email di prima nel corpo' => [['persona' => 'uat-ada@example.com'], []],
    'l\'email di prima in tutti e due i posti' => [['persona' => 'uat-ada@example.com'], ['Persona' => 'uat-ada%40example.com']],
    'la sua con le maiuscole' => [[], ['Persona' => 'UAT-Grace%40example.com']],
    'la sua con uno spazio in fondo' => [[], ['Persona' => 'uat-grace%40example.com%20']],
    'un\'email qualunque' => [[], ['Persona' => 'nessuno%40example.com']],
]);

it('con la sessione che ha un\'impronta, un\'email che non è la sua e un\'impronta che non è la sua, o che non c\'è, o che non è proprio quella, riceve da ogni rotta 409 persona_diversa con `persona` vuota, e il backoffice non è chiamato (sprint 67 · T1.2)', function (?string $impronta, string $email) {
    sessioneAMano(WORKSPACE_DELLA_PERSONA, 'en', GRACE_NELLA_SESSIONE);
    Http::fake();
    $dellaSessione = (string) Persona::impronta();
    $impronta = $impronta === null ? null : str_replace(['{ada}', '{SESSIONE}', '{sessione}'], [improntaDi('uat-ada'), strtoupper($dellaSessione), $dellaSessione], $impronta);
    if ($impronta === null) {
        test()->withoutHeader(Persona::INTESTAZIONE);
    }

    foreach (rotteDellaCorniceDalRouter() as [$metodo, $indirizzo]) {
        $avuta = allaCornice($metodo, $indirizzo, [], ['Persona' => $email] + ($impronta === null ? [] : [Persona::INTESTAZIONE => $impronta]));

        expect($avuta->getStatusCode())->toBe(409, "{$metodo} {$indirizzo}")
            ->and($avuta->getContent())->toBe('{"errore":"persona_diversa","persona":""}');
    }
    Http::assertNothingSent();
})->with([
    'l\'email di prima con l\'impronta di un\'altra persona' => ['{ada}', 'uat-ada%40example.com'],
    'l\'email della sessione con l\'impronta di un\'altra persona' => ['{ada}', 'uat-grace%40example.com'],
    'l\'email di prima senza l\'impronta' => [null, 'uat-ada%40example.com'],
    'l\'email di prima con un testo qualunque' => ['uat-ada', 'uat-ada%40example.com'],
    'l\'email di prima con `undefined`' => ['undefined', 'uat-ada%40example.com'],
    'l\'email di prima con quella giusta in maiuscole' => ['{SESSIONE}', 'uat-ada%40example.com'],
    'l\'email di prima con quella giusta e un\'altra insieme' => ['{sessione},{ada}', 'uat-ada%40example.com'],
]);

it('l\'impronta da sola non fa entrare nessuno: senza sessione la richiesta con un\'impronta di chi vuole e un\'email qualunque riceve il 401 da ogni rotta, e non arriva alla rotta (sprint 67 · T1.3)', function () {
    Http::fake();

    foreach (rotteDellaCorniceDalRouter() as [$metodo, $indirizzo]) {
        $avuta = allaCornice($metodo, $indirizzo, ['persona' => 'uat-ada@example.com'], ['Persona' => 'uat-ada%40example.com', Persona::INTESTAZIONE => improntaDi('uat-ada')]);

        expect($avuta->getStatusCode())->toBe(401, "{$metodo} {$indirizzo}")->and($avuta->getContent())->not->toContain('persona_diversa');
    }
    Http::assertNothingSent();
});

it('con una sessione senza id l\'email decide come prima, qualunque impronta dica la richiesta: un\'email diversa è 409, la sua passa (sprint 67 · T1.4)', function (string $impronta) {
    sessioneAMano(WORKSPACE_DELLA_PERSONA, 'en', ['id' => null] + GRACE_NELLA_SESSIONE);
    Http::fake();
    expect(Persona::impronta())->toBeNull();
    $impronta = str_replace('{ada}', improntaDi('uat-ada'), $impronta);

    expect(rotteCheNonRispondono(409, '{"errore":"persona_diversa","persona":""}', [], ['Persona' => 'uat-ada%40example.com', Persona::INTESTAZIONE => $impronta]))->toBe([]);
    Http::assertNothingSent();
    foreach (rotteDellaCorniceDalRouter() as [$metodo, $indirizzo]) {
        $prima = Http::recorded()->count();
        allaCornice($metodo, $indirizzo, [], ['Persona' => 'uat-grace%40example.com', Persona::INTESTAZIONE => $impronta]);

        expect(Http::recorded()->count())->toBeGreaterThan($prima, "{$metodo} {$indirizzo}");
    }
})->with([
    'l\'impronta di un\'altra persona' => ['{ada}'],
    'un testo qualunque' => ['uat-ada'],
]);

it('con una sessione senza id l\'email si confronta com\'è: le maiuscole e uno spazio in fondo sono un\'altra persona, e riceve da ogni rotta il 409 (sprint 67 · T1.4; R3 della review)', function (string $email) {
    sessioneAMano(WORKSPACE_DELLA_PERSONA, 'en', ['id' => null] + GRACE_NELLA_SESSIONE);
    Http::fake();

    expect(Persona::impronta())->toBeNull()
        ->and(rotteCheNonRispondono(409, '{"errore":"persona_diversa","persona":""}', [], ['Persona' => $email]))->toBe([]);
    Http::assertNothingSent();
})->with([
    'le maiuscole' => ['UAT-Grace%40example.com'],
    'uno spazio in fondo' => ['uat-grace%40example.com%20'],
]);

it('con una sessione che ha un\'impronta ma un\'email nulla o vuota nessuna email detta passa, nemmeno con l\'impronta giusta: da ogni rotta 409, e il backoffice non è chiamato (sprint 67 · T1.5; R4 della review)', function (?string $email) {
    sessioneAMano(WORKSPACE_DELLA_PERSONA, 'en', ['email' => $email] + GRACE_NELLA_SESSIONE);
    Http::fake();

    expect(Persona::impronta())->not->toBeNull()
        ->and(rotteCheNonRispondono(409, '{"errore":"persona_diversa","persona":""}', [], ['Persona' => 'uat-grace%40example.com']))->toBe([]);
    Http::assertNothingSent();
})->with([
    'nulla' => [null],
    'vuota' => [''],
]);

it('l\'email che la pagina dice torna nella risposta solo se è lunga come un\'email, al più 254 caratteri: una più lunga passa lo stesso, ma la risposta dice quella della sessione (sprint 67 · T3, nota di zr-backoffice)', function (int $lunghezza, bool $tornaIndietro) {
    sessioneAMano(WORKSPACE_DELLA_PERSONA, 'en', GRACE_NELLA_SESSIONE);
    Http::fake(['*' => Http::response(['data' => [], 'successivo' => null])]);
    $detta = str_repeat('a', $lunghezza - 12).'@example.com';

    $risposta = allaCornice('POST', 'cornice/ricerca', ['q' => 'uat'], ['Persona' => rawurlencode($detta)]);

    expect(strlen($detta))->toBe($lunghezza)
        ->and($risposta->getStatusCode())->toBe(200)
        ->and($risposta->json('persona'))->toBe($tornaIndietro ? $detta : 'uat-grace@example.com');
})->with([
    'al limite' => [254, true],
    'oltre' => [255, false],
]);
