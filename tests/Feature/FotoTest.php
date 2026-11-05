<?php

use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Illuminate\Testing\TestResponse;
use Zeiras\Auth\Http\Middleware\ConGettone;
use Zeiras\Auth\Http\Middleware\SoloDallaPersona;
use Zeiras\Auth\Persona;
use Zeiras\Core\Cornice;
use Zeiras\Core\Http\ConWorkspace;
use Zeiras\Core\Http\FotoDellaCornice;
use Zeiras\Core\Http\StessaPersona;

// Sprint 99 · T1 (voce #2982): la foto della persona, dall'host del frontend. La rotta GET /cornice/foto la legge da
// io.foto.file.mostra (GET /v1/io/foto/file) col gettone della persona, che resta nella sessione, e la rende com'è: i byte, il
// tipo e l'ETag del backoffice. La chiede un `<img>`, che non manda intestazioni: la rotta sta fuori da StessaPersona, e di un
// errore del backoffice dice solo lo stato. Il backoffice è Http::fake; nessuna richiesta esce (TestCase).

/** Il workspace in cui entra la sessione dei test. */
const WORKSPACE_DELLA_FOTO = ['id' => 'uat-ws', 'nome' => 'UAT Marketing', 'slug' => 'uat-marketing'];

/**
 * L'indirizzo della foto di una persona, come lo danno i dati: `v` il momento della foto, `p` di chi è, rifatto qui da sé (un HMAC
 * dell'id con la chiave dell'app, 16 cifre esadecimali), così un caso prova che è quello e non l'id o l'impronta.
 */
function indirizzoDellaFoto(string $v = '2026-11-04T09%3A30%3A00.000000Z', string $id = 'uat-ada'): string
{
    return '/cornice/foto?v='.$v.'&p='.substr(hash_hmac('sha256', 'zr-core.foto|'.$id, (string) config('app.key')), 0, 16);
}

/** I byte della foto: un segno, che deve arrivare al browser com'è. */
const BYTE_DELLA_FOTO = "RIFF\x24\x00\x00\x00WEBPVP8 segno-della-foto\x00\xff";

/** L'ETag forte che il backoffice dà alla foto (l'impronta del file). */
const ETAG_DELLA_FOTO = '"3f2a9c"';

/** La foto come la dà io.foto.file.mostra: 200, image/webp, ETag forte, cache privata di cinque minuti. */
function fotoDelBackoffice(): mixed
{
    return Http::response(BYTE_DELLA_FOTO, 200, ['Content-Type' => 'image/webp', 'ETag' => ETAG_DELLA_FOTO, 'Cache-Control' => 'max-age=300, private']);
}

/** La foto come la chiede un `<img>`: una GET, senza le intestazioni della persona della pagina. */
function chiediLaFoto(array $intestazioni = []): TestResponse
{
    test()->withoutHeader('Persona')->withoutHeader(Persona::INTESTAZIONE);

    return test()->get(indirizzoDellaFoto(), $intestazioni);
}

it('GET /cornice/foto rende la foto di io.foto.file.mostra com\'è, letta col gettone della persona: i byte, il tipo, l\'ETag, una cache privata di cinque minuti, nosniff e solo per la stessa origine (sprint 99 · T1.1)', function () {
    $gettoni = sessioneAMano(WORKSPACE_DELLA_FOTO);
    Http::fake(['*' => fotoDelBackoffice()]);

    $risposta = chiediLaFoto();

    $risposta->assertOk()
        ->assertHeader('Content-Type', 'image/webp')
        ->assertHeader('ETag', ETAG_DELLA_FOTO)
        ->assertHeader('X-Content-Type-Options', 'nosniff')
        ->assertHeader('Cross-Origin-Resource-Policy', 'same-origin');
    expect($risposta->getContent())->toBe(BYTE_DELLA_FOTO)
        ->and($risposta->headers->getCacheControlDirective('private'))->toBe(true)
        ->and($risposta->headers->getCacheControlDirective('max-age'))->toBe('300')
        ->and($risposta->headers->hasCacheControlDirective('public'))->toBe(false);

    Http::assertSentCount(1);
    $richiesta = Http::recorded()->first()[0];
    expect($richiesta->method())->toBe('GET')
        ->and(parse_url($richiesta->url(), PHP_URL_PATH))->toEndWith('/v1/io/foto/file')
        ->and(parse_url($richiesta->url(), PHP_URL_QUERY))->toBeNull()
        ->and($richiesta->header('Authorization'))->toBe(['Bearer '.$gettoni['accesso']])
        ->and($richiesta->hasHeader('If-None-Match'))->toBe(false);
});

it('con If-None-Match uguale all\'ETag la condizione va al backoffice e la rotta risponde 304 senza corpo (sprint 99 · T1.2)', function () {
    sessioneAMano(WORKSPACE_DELLA_FOTO);
    Http::fake(fn (Request $richiesta) => $richiesta->header('If-None-Match') === [ETAG_DELLA_FOTO]
        ? Http::response('', 304, ['ETag' => ETAG_DELLA_FOTO])
        : fotoDelBackoffice());

    $risposta = chiediLaFoto(['If-None-Match' => ETAG_DELLA_FOTO]);

    $risposta->assertStatus(304)->assertHeader('ETag', ETAG_DELLA_FOTO);
    expect($risposta->getContent())->toBe('');
    Http::assertSentCount(1);
});

it('un If-None-Match che non è un entity-tag non va al backoffice: la foto arriva intera, 200 e non un 500 (sprint 99 · T1.2)', function (string $condizione) {
    sessioneAMano(WORKSPACE_DELLA_FOTO);
    Http::fake(['*' => fotoDelBackoffice()]);

    $risposta = chiediLaFoto(['If-None-Match' => $condizione]);

    $risposta->assertOk();
    expect($risposta->getContent())->toBe(BYTE_DELLA_FOTO)
        ->and(Http::recorded()->first()[0]->hasHeader('If-None-Match'))->toBe(false);
})->with([
    'senza virgolette' => ['3f2a9c'],
    'due entity-tag' => ['"3f2a9c", "b1"'],
    'l\'asterisco' => ['*'],
    'una virgoletta dentro' => ['"3f"2a"'],
    'byte fuori da ASCII, che zr-auth non manda' => ["\"caf\xC3\xA9\""],
]);

it('un entity-tag debole va al backoffice com\'è (sprint 99 · T1.2)', function () {
    sessioneAMano(WORKSPACE_DELLA_FOTO);
    Http::fake(['*' => Http::response('', 304, ['ETag' => 'W/"3f2a9c"'])]);

    chiediLaFoto(['If-None-Match' => 'W/"3f2a9c"'])->assertStatus(304);
    expect(Http::recorded()->first()[0]->header('If-None-Match'))->toBe(['W/"3f2a9c"']);
});

it('senza foto (404 `foto_assente`) la rotta risponde 404 senza corpo e senza cache, e niente del problema del backoffice esce (sprint 99 · T1.3)', function () {
    sessioneAMano(WORKSPACE_DELLA_FOTO);
    Http::fake(['*' => Http::response((string) json_encode(['type' => 'about:blank', 'title' => 'segno-del-titolo', 'status' => 404, 'codice' => 'foto_assente']), 404, ['Content-Type' => 'application/problem+json'])]);

    $risposta = chiediLaFoto();

    $risposta->assertNotFound();
    expect($risposta->getContent())->toBe('')
        ->and($risposta->headers->hasCacheControlDirective('no-store'))->toBe(true);
});

it('a ogni altro 4xx del backoffice la rotta risponde con lo stesso stato, senza corpo (sprint 99 · T1.3)', function (int $stato, string $codice) {
    sessioneAMano(WORKSPACE_DELLA_FOTO);
    Http::fake(['*' => Http::response((string) json_encode(['type' => 'about:blank', 'title' => 'segno-del-titolo', 'status' => $stato, 'codice' => $codice]), $stato, ['Content-Type' => 'application/problem+json', 'Retry-After' => '30'])]);

    $risposta = chiediLaFoto();

    $risposta->assertStatus($stato);
    expect($risposta->getContent())->toBe('')
        ->and($risposta->headers->hasCacheControlDirective('no-store'))->toBe(true)
        // Davanti al 429 i secondi del backoffice, come la ricerca della cornice.
        ->and($risposta->headers->get('Retry-After'))->toBe($stato === 429 ? '30' : null);
})->with([
    'i documenti da accettare' => [403, 'accettazione_richiesta'],
    'troppe richieste' => [429, 'troppe_richieste'],
]);

it('un indirizzo che non è della persona della sessione — il `p` di un\'altra, o senza `p` — risponde 404 senza corpo e senza cache, e il backoffice non si chiama (sprint 99 · T1.5, SEC1 della revisione di sicurezza)', function (string $indirizzo) {
    sessioneAMano(WORKSPACE_DELLA_FOTO);
    Http::fake(['*' => fotoDelBackoffice()]);
    test()->withoutHeader('Persona')->withoutHeader(Persona::INTESTAZIONE);

    $risposta = test()->get($indirizzo === 'di Bea' ? indirizzoDellaFoto(id: 'uat-bea') : $indirizzo);

    $risposta->assertNotFound();
    expect($risposta->getContent())->toBe('')
        ->and($risposta->headers->hasCacheControlDirective('no-store'))->toBe(true);
    Http::assertNothingSent();
})->with([
    'il p di un\'altra persona' => ['di Bea'],
    'senza p' => ['/cornice/foto?v=2026-11-04T09%3A30%3A00.000000Z'],
    'un p vuoto' => ['/cornice/foto?p='],
]);

it('senza una chiave dell\'app non c\'è `p` e i dati non hanno la foto: un `p` rifatto dall\'id con una chiave vuota non esiste (rilievo R11; una richiesta HTTP senza chiave Laravel la ferma prima, MissingAppKeyException)', function () {
    Carbon::setTestNow(Carbon::parse('2026-11-04 10:00:00.000000', 'UTC'));
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato(['/v1/io' => ioMostraConFoto(FOTO_AGGIORNATA_IL)]);
    config(['app.key' => '']);

    expect(Cornice::dati()['persona'] ?? null)->not->toHaveKey('foto')
        ->and(FotoDellaCornice::diChi('uat-ada'))->toBeNull();
});

it('la foto non diventa la pagina di prima della sessione: un `back()` non porta lì (SEC4 della revisione di sicurezza)', function () {
    sessioneAMano(WORKSPACE_DELLA_FOTO);
    Http::fake(['*' => fotoDelBackoffice()]);

    chiediLaFoto()->assertOk();

    expect((string) session()->previousUrl())->not->toContain('cornice/foto');
});

it('senza sessione risponde la guardia di zr-auth, prima della rotta: verso l\'ingresso a un `<img>`, 401 a chi chiede JSON; la foto non esce e il backoffice non si chiama (sprint 99 · T1.4)', function () {
    Http::fake(['*' => fotoDelBackoffice()]);

    $risposta = chiediLaFoto();
    $json = test()->getJson('cornice/foto');

    $risposta->assertRedirect();
    $json->assertUnauthorized();
    expect($risposta->getContent())->not->toContain('segno-della-foto')
        ->and($json->getContent())->not->toContain('segno-della-foto');
    Http::assertNothingSent();
});

it('senza sessione la foto chiesta da un `<img>` non diventa la pagina di ritorno dopo l\'accesso; chiesta come una pagina sì: il caso vede la differenza (sprint 109 · T1.1, #3019)', function () {
    Http::fake(['*' => fotoDelBackoffice()]);
    $comeUnImg = ['Sec-Fetch-Dest' => 'image', 'Accept' => 'image/avif,image/webp,image/*,*/*;q=0.8'];

    chiediLaFoto($comeUnImg)->assertRedirect();
    $ritornoDellImg = (string) session('url.intended');

    chiediLaFoto(['Sec-Fetch-Dest' => 'document', 'Accept' => 'text/html'])->assertRedirect();

    expect($ritornoDellImg)->not->toContain('cornice/foto')
        ->and((string) session('url.intended'))->toContain('cornice/foto');
    Http::assertNothingSent();
});

it('senza sessione la foto chiesta da un `<img>` lascia com\'è il ritorno già ricordato (sprint 109 · T1.2, #3019)', function () {
    Http::fake(['*' => fotoDelBackoffice()]);
    session()->put('url.intended', 'http://localhost/board/progetti?vista=elenco');

    chiediLaFoto(['Sec-Fetch-Dest' => 'image', 'Accept' => 'image/*'])->assertRedirect();

    expect(session('url.intended'))->toBe('http://localhost/board/progetti?vista=elenco');
});

it('la rotta risponde a una GET senza `Persona` e senza `X-Zr-Persona`, come la manda un `<img>`, e anche senza un workspace (sprint 99 · T1.5)', function (bool $conWorkspace) {
    sessioneAMano($conWorkspace ? WORKSPACE_DELLA_FOTO : null);
    Http::fake(['*' => fotoDelBackoffice()]);

    $risposta = chiediLaFoto();

    $risposta->assertOk();
    expect($risposta->getContent())->toBe(BYTE_DELLA_FOTO);
})->with(['nel workspace' => [true], 'senza workspace' => [false]]);

it('fra le rotte della cornice la foto è la sola fuori da StessaPersona e da ConWorkspace; ha la guardia di zr-auth e non SoloDallaPersona, come le altre (sprint 99 · T1.5)', function () {
    // Gruppi e priorità arrivano al router quando nasce il kernel HTTP, come in `Rotte::senzaGuardia()` di zr-auth.
    app(Kernel::class);
    $router = app('router');
    $senza = fn (string $classe) => collect(Route::getRoutes()->getRoutes())
        ->filter(fn ($rotta) => str_starts_with($rotta->uri(), 'cornice/'))
        ->reject(fn ($rotta) => in_array($classe, $router->gatherRouteMiddleware($rotta), true))
        ->map(fn ($rotta) => implode('|', array_diff($rotta->methods(), ['HEAD'])).' '.$rotta->uri())->values()->all();

    expect($senza(StessaPersona::class))->toBe(['GET cornice/foto'])
        ->and($senza(ConWorkspace::class))->toBe(['GET cornice/foto'])
        ->and($senza(ConGettone::class))->toBe([])
        ->and(count($senza(SoloDallaPersona::class)))->toBe(5);

    // Il controllo nei due versi: un'altra rotta della cornice fuori da StessaPersona si vede.
    Route::middleware('web')->get('cornice/scoperta', fn () => 'senza la persona');
    expect($senza(StessaPersona::class))->toBe(['GET cornice/foto', 'GET cornice/scoperta']);
});

// Sprint 99 · T2 (voce #2982): l'indirizzo della foto nei dati della cornice. `persona.foto` è la rotta della foto col `?v=`
// che io.mostra dà in `utente.foto_aggiornata_il`: cambia a ogni sostituzione, e una foto nuova non resta nella cache del
// browser. Viene dalla stessa lettura di io.mostra delle non lette, e c'è solo se la persona ha una foto e i dati non sono
// ridotti: senza, la chiave non c'è, e i dati restano quelli di prima.

/** Il momento della foto che io.mostra dà nei casi. */
const FOTO_AGGIORNATA_IL = '2026-11-04T09:30:00.000000Z';

/** io.mostra di Ada con tre non lette e `foto_aggiornata_il` com'è dato; `$senza` la toglie. */
function ioMostraConFoto(mixed $foto, bool $senza = false): array
{
    $io = ioMostra(3);
    if (! $senza) {
        $io['data']['utente']['foto_aggiornata_il'] = $foto;
    }

    return $io;
}

/** La persona dei dati di Ada, con la foto. */
function adaConLaFoto(?string $indirizzo = null): array
{
    return ['nome' => 'UAT Ada', 'email' => 'uat-ada@example.com', 'impronta' => improntaDi('uat-ada'), 'foto' => $indirizzo ?? indirizzoDellaFoto()];
}

it('Cornice::dati() e dopo() danno in `persona.foto` la rotta della foto col `?v=` di `foto_aggiornata_il`, dalla stessa lettura di io.mostra; un altro momento è un altro indirizzo (sprint 99 · T2.1)', function (string $quale, string $il, string $v) {
    Carbon::setTestNow(Carbon::parse('2026-11-04 10:00:00.000000', 'UTC'));
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato(['/v1/io' => ioMostraConFoto($il)]);

    $dati = $quale === 'dati' ? Cornice::dati() : Cornice::dopo();

    expect($dati['persona'] ?? null)->toBe(adaConLaFoto(indirizzoDellaFoto($v)))
        ->and(array_count_values(percorsiChiamati())['/v1/io'])->toBe(1);
})->with([
    'dati()' => ['dati', FOTO_AGGIORNATA_IL, '2026-11-04T09%3A30%3A00.000000Z'],
    'dopo()' => ['dopo', FOTO_AGGIORNATA_IL, '2026-11-04T09%3A30%3A00.000000Z'],
    'un altro momento' => ['dati', '2026-11-04T09:45:00.000000Z', '2026-11-04T09%3A45%3A00.000000Z'],
]);

it('con la foto il resto dei dati è quello di prima (sprint 99 · T2.1)', function () {
    Carbon::setTestNow(Carbon::parse('2026-11-04 10:00:00.000000', 'UTC'));
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato(['/v1/io' => ioMostraConFoto(FOTO_AGGIORNATA_IL)]);

    expect(Cornice::dati())->toBe(datiAttesi('2026-11-04T10:00:00.000000Z', ['persona' => adaConLaFoto()]));
});

it('senza una foto che si legge — `foto_aggiornata_il` null, che manca, vuoto o non un testo — la persona dei dati non ha `foto`, ed è quella di prima (sprint 99 · T2.1)', function (mixed $foto, bool $senza) {
    Carbon::setTestNow(Carbon::parse('2026-11-04 10:00:00.000000', 'UTC'));
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato(['/v1/io' => ioMostraConFoto($foto, $senza)]);

    expect(Cornice::dati())->toBe(datiAttesi('2026-11-04T10:00:00.000000Z'));
})->with([
    'null' => [null, false],
    'che manca' => [null, true],
    'vuoto' => ['', false],
    'un numero' => [1793792000, false],
    'una lista' => [[FOTO_AGGIORNATA_IL], false],
    'troppo lungo' => [str_repeat('9', 65), false],
]);

it('una foto che io.mostra dà per un\'altra persona non entra nei dati (sprint 99 · T2.1)', function () {
    Carbon::setTestNow(Carbon::parse('2026-11-04 10:00:00.000000', 'UTC'));
    sessioneAMano(marketing());
    $io = ioMostraConFoto(FOTO_AGGIORNATA_IL);
    $io['data']['utente']['id'] = 'uat-bea';
    backofficeDiChiHaAccettato(['/v1/io' => $io]);

    expect(Cornice::dati()['persona'] ?? null)->not->toHaveKey('foto');
});

it('la richiesta rimandata dà la foto della lettura della pagina, senza rileggere io.mostra (sprint 99 · T2.2)', function () {
    Carbon::setTestNow(Carbon::parse('2026-11-04 10:00:00.000000', 'UTC'));
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato(['/v1/io' => ioMostraConFoto(FOTO_AGGIORNATA_IL)]);

    Cornice::lingua();
    richiestaNuova();
    Carbon::setTestNow(Carbon::parse('2026-11-04 10:00:02.000000', 'UTC'));

    expect(Cornice::dopo()['persona'] ?? null)->toBe(adaConLaFoto())
        ->and(array_count_values(percorsiChiamati())['/v1/io'])->toBe(1);
});

it('una lettura tenuta per la richiesta rimandata da una versione di prima, senza `foto`, vale ancora: `dopo()` non rilegge io.mostra e dà i dati senza foto (sprint 99 · T2.2, rilievo R3)', function () {
    Carbon::setTestNow(Carbon::parse('2026-11-04 10:00:00.000000', 'UTC'));
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato(['/v1/io' => ioMostraConFoto(FOTO_AGGIORNATA_IL)]);

    Cornice::lingua();
    $tenuta = session('zr-core.io-mostra-rimandata');
    unset($tenuta['foto']);
    session()->put('zr-core.io-mostra-rimandata', $tenuta);
    richiestaNuova();
    Carbon::setTestNow(Carbon::parse('2026-11-04 10:00:02.000000', 'UTC'));

    expect(Cornice::dopo()['persona'] ?? null)->not->toHaveKey('foto')
        ->and(array_count_values(percorsiChiamati())['/v1/io'])->toBe(1);
});

it('i dati ridotti, `subito()` e la cornice ridotta non portano la foto, anche se io.mostra la dà (sprint 99 · T2.3)', function () {
    Carbon::setTestNow(Carbon::parse('2026-11-04 10:00:00.000000', 'UTC'));
    sessioneAMano(marketing());
    backofficeDiChiHaAccettato(['/v1/io' => ioMostraConFoto(FOTO_AGGIORNATA_IL), '/v1/app' => accettazioneRichiesta()]);

    expect(Cornice::dati())->toBe(datiRidotti('2026-11-04T10:00:00.000000Z'))
        ->and(Cornice::subito()['persona'] ?? null)->toBe(['nome' => 'UAT Ada', 'email' => 'uat-ada@example.com', 'impronta' => improntaDi('uat-ada')])
        ->and(Cornice::ridotta()['persona'] ?? null)->toBe(['nome' => 'UAT Ada', 'email' => 'uat-ada@example.com', 'impronta' => improntaDi('uat-ada')]);
});
