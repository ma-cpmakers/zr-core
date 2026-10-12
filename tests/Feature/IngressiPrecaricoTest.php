<?php

use Illuminate\Contracts\Http\Kernel as HttpKernel;
use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Vite;
use Zeiras\Core\Http\PrecaricoDegliIngressi;

// Sprint 28 · T2 (voce #1811). Il precarico dei file d'ingresso: la risposta intera di una pagina dice in `Link` i file che
// `@vite` ha messo nel documento, perché Cloudflare (Early Hints) li ripeta in un 103 alla visita dopo, prima che il server abbia
// letto il backoffice. Era un middleware di zr-board (`PrecaricoDellaBoard`): dalla `v1.18.0` è del pacchetto, e lo registra il
// frontend. Cloudflare nel 103 ripete solo `preload` e `preconnect`: un modulo va come `preload; as=script; crossorigin` (senza
// `crossorigin` il browser lo scaricherebbe due volte: la richiesta di un modulo è CORS), mai `modulepreload`.
// Un manifest d'esempio in una cartella sua, tolta a fine caso: l'ingresso, un pezzo che importa, un pezzo dinamico che il
// documento non carica all'apertura, un CSS.

const CARTELLA_DEL_PRECARICO = 'build-precarico-zr-core';
const INGRESSO_DEL_PRECARICO = 'resources/js/app.tsx';
/** Il workspace della sessione, per le rotte del gruppo `web`, che hanno la guardia di zr-auth. */
const WORKSPACE_DEL_PRECARICO = ['id' => 'uat-ws', 'nome' => 'UAT Marketing', 'slug' => 'uat-marketing'];

beforeEach(function () {
    File::ensureDirectoryExists(public_path(CARTELLA_DEL_PRECARICO));
    File::put(public_path(CARTELLA_DEL_PRECARICO.'/manifest.json'), json_encode([
        INGRESSO_DEL_PRECARICO => ['file' => 'assets/app-AAAA1111.js', 'src' => INGRESSO_DEL_PRECARICO, 'isEntry' => true, 'imports' => ['_fornitori-BBBB2222.js'], 'dynamicImports' => ['resources/js/viste/gantt.tsx'], 'css' => ['assets/app-CCCC3333.css']],
        '_fornitori-BBBB2222.js' => ['file' => 'assets/fornitori-BBBB2222.js'],
        'resources/js/viste/gantt.tsx' => ['file' => 'assets/gantt-DDDD4444.js', 'src' => 'resources/js/viste/gantt.tsx', 'isDynamicEntry' => true, 'imports' => ['_fornitori-BBBB2222.js']],
    ], JSON_THROW_ON_ERROR));
    Vite::useBuildDirectory(CARTELLA_DEL_PRECARICO);
});

afterEach(function () {
    File::deleteDirectory(public_path(CARTELLA_DEL_PRECARICO));
    // I proxy fidati sono di classe, non dell'app: un caso che li accende non li lascia al caso dopo.
    TrustProxies::flushState();
    Request::setTrustedProxies([], -1);
});

/** Un documento scritto con `@vite`, come la vista di un frontend. */
function documentoConVite(): string
{
    return Blade::render("<!doctype html><html><head>@vite('".INGRESSO_DEL_PRECARICO."')</head><body><p>una pagina</p></body></html>");
}

/**
 * L'indirizzo di un file della build d'esempio, come `@vite` lo scrive nel documento: il solo percorso, senza host (lettura della
 * PR #61, R1: col resolver del pacchetto l'host non viene dalla richiesta).
 */
function fileDelPrecarico(string $nome): string
{
    return '/'.CARTELLA_DEL_PRECARICO.'/assets/'.$nome;
}

/**
 * I tre file che il documento d'esempio carica all'apertura.
 *
 * @return list<string>
 */
function fileAllApertura(string $radice = ''): array
{
    return [$radice.fileDelPrecarico('app-CCCC3333.css'), $radice.fileDelPrecarico('app-AAAA1111.js'), $radice.fileDelPrecarico('fornitori-BBBB2222.js')];
}

/** Una rotta col middleware che rende il documento e tiene l'host che la richiesta ha dichiarato, come lo legge Laravel. */
function rottaCheTieneLHost(?string &$visto): void
{
    Route::get('/prova/precarico', function () use (&$visto) {
        $visto = request()->getHost();

        return documentoConVite();
    })->middleware(PrecaricoDegliIngressi::class);
}

/** Un frontend che si fida dei proxy: `X-Forwarded-Host` diventa l'host della richiesta, e così le altre intestazioni date. */
function frontendCheSiFidaDeiProxy(int $intestazioni = Request::HEADER_X_FORWARDED_HOST): void
{
    TrustProxies::at('*');
    Request::setTrustedProxies(['127.0.0.1'], $intestazioni);
}

/**
 * Le voci di un header `Link`, per URL e nel loro ordine: `<url>; a; b` → [url => ['a', 'b']].
 *
 * @return array<string, list<string>>
 */
function vociDelPrecarico(?string $link): array
{
    $voci = [];
    foreach (array_filter(array_map('trim', explode(',', (string) $link))) as $voce) {
        preg_match('/^<([^>]+)>\s*;\s*(.*)$/', $voce, $parti);
        $voci[$parti[1] ?? $voce] = array_map('trim', explode(';', $parti[2] ?? ''));
    }

    return $voci;
}

/**
 * Gli URL dei file della build che il documento carica: script, modulepreload, stylesheet, preload.
 *
 * @return list<string>
 */
function fileNelDocumento(string $html): array
{
    preg_match_all('/<(?:script[^>]*\bsrc|link[^>]*\bhref)="([^"]*\/'.CARTELLA_DEL_PRECARICO.'\/[^"]+)"/', $html, $trovati);

    return array_values(array_unique($trovati[1]));
}

// T2.1

it('una pagina intera di una rotta col middleware porta in `Link` ogni file che `@vite` ha messo nel documento, nello stesso ordine: un CSS come `preload; as=style`, un modulo come `preload; as=script; crossorigin`; mai `modulepreload`, mai un pezzo dinamico (sprint 28 · T2.1)', function () {
    Route::get('/prova/precarico', fn () => documentoConVite())->middleware(PrecaricoDegliIngressi::class);

    $risposta = $this->get('/prova/precarico')->assertOk();
    $voci = vociDelPrecarico($risposta->headers->get('Link'));
    [$js, $fornitori, $css] = [fileDelPrecarico('app-AAAA1111.js'), fileDelPrecarico('fornitori-BBBB2222.js'), fileDelPrecarico('app-CCCC3333.css')];

    // Il contro-esempio: `rel=modulepreload` (Cloudflare non lo ripete nel 103), o un modulo senza `crossorigin`.
    expect($voci)->toHaveCount(3)
        ->and($voci[$js] ?? null)->toBe(['rel=preload', 'as=script', 'crossorigin'])
        ->and($voci[$fornitori] ?? null)->toBe(['rel=preload', 'as=script', 'crossorigin'])
        ->and($voci[$css] ?? null)->toBe(['rel=preload', 'as=style'])
        ->and((string) $risposta->headers->get('Link'))->not->toContain('modulepreload')
        // Gli URL sono quelli del documento, e sono tutti e soli i file che il documento carica all'apertura: il contro-esempio
        // è il manifest intero, col pezzo dinamico.
        ->and(fileNelDocumento((string) $risposta->getContent()))->toEqualCanonicalizing(array_keys($voci))
        ->and(array_keys($voci))->not->toContain(fileDelPrecarico('gantt-DDDD4444.js'))
        // Nell'ordine in cui `@vite` li ha scritti.
        ->and(array_keys($voci))->toBe(array_keys(Vite::preloadedAssets()));
});

// T2.2

/**
 * Le rotte dei casi in cui il `Link` non si scrive. In ognuna, tranne l'ultima, `@vite` ha scritto i suoi file nella richiesta: il
 * middleware avrebbe di che scrivere. Stanno in una funzione e non nei dati del caso: Pest una closure fra i dati la chiama.
 */
function rottaSenzaPrecarico(string $caso): Closure
{
    return match ($caso) {
        'documento' => fn () => documentoConVite(),
        'redirect' => function () {
            documentoConVite();

            return redirect('/prova/altrove');
        },
        '404' => fn () => response(documentoConVite(), 404),
        '500' => fn () => response(documentoConVite(), 500),
        'tipo' => function () {
            documentoConVite();

            return response('{"esito":"ok"}', 200, ['Content-Type' => 'application/json']);
        },
        'json' => function () {
            documentoConVite();

            return response()->json(['esito' => 'ok']);
        },
        'file' => function () {
            documentoConVite();

            return response()->file(public_path(CARTELLA_DEL_PRECARICO.'/manifest.json'));
        },
        'stream' => function () {
            documentoConVite();

            return response()->stream(function () {
                echo 'un pezzo';
            });
        },
        default => fn () => '<p>una pagina</p>',
    };
}

it('il middleware non scrive `Link` dove la risposta non è una pagina intera, 200 e HTML, o dove `@vite` non ha scritto niente (sprint 28 · T2.2)', function (string $caso, array $intestazioni, int $stato) {
    Route::get('/prova/precarico', rottaSenzaPrecarico($caso))->middleware(PrecaricoDegliIngressi::class);

    $risposta = $this->get('/prova/precarico', $intestazioni)->assertStatus($stato);

    // L'header non c'è: non è vuoto.
    expect($risposta->headers->has('Link'))->toBeFalse()
        // Il caso non è vuoto: tranne che nell'ultimo, `@vite` ha scritto i suoi file in questa richiesta.
        ->and(count(Vite::preloadedAssets()))->toBe($caso === 'senza-vite' ? 0 : 3);
})->with([
    'sulla visita Inertia (la richiesta porta `X-Inertia`), anche se la risposta è un documento' => ['documento', ['X-Inertia' => 'true'], 200],
    'su un redirect' => ['redirect', [], 302],
    'su una pagina d\'esito 404 il cui documento ha `@vite`' => ['404', [], 404],
    'su una pagina d\'esito 500 il cui documento ha `@vite`' => ['500', [], 500],
    'su una risposta 200 che dichiara un tipo che non è HTML' => ['tipo', [], 200],
    'su una risposta JSON' => ['json', [], 200],
    'su un file' => ['file', [], 200],
    'su uno stream' => ['stream', [], 200],
    'su una pagina 200 HTML senza `@vite`: nessun file, e l\'header non c\'è' => ['senza-vite', [], 200],
]);

it('una pagina intera che dichiara `text/html` con la sua codifica ha il `Link`: il tipo si legge, non si confronta per intero (sprint 28 · T2.2)', function () {
    Route::get('/prova/precarico', fn () => response(documentoConVite(), 200, ['Content-Type' => 'Text/HTML; charset=UTF-8']))->middleware(PrecaricoDegliIngressi::class);

    expect(vociDelPrecarico($this->get('/prova/precarico')->assertOk()->headers->get('Link')))->toHaveCount(3);
});

// T2.3

it('un `Link` che la risposta porta già resta com\'è: il middleware aggiunge il suo accanto, non lo sostituisce (sprint 28 · T2.3)', function () {
    $diPrima = '<https://fonts.gstatic.com>; rel=preconnect; crossorigin';
    Route::get('/prova/precarico', fn () => response(documentoConVite())->header('Link', $diPrima))->middleware(PrecaricoDegliIngressi::class);

    $tutti = $this->get('/prova/precarico')->assertOk()->headers->all('link');

    expect($tutti)->toHaveCount(2)
        ->and($tutti[0])->toBe($diPrima)
        ->and(array_keys(vociDelPrecarico($tutti[1])))->toBe(array_keys(Vite::preloadedAssets()));
});

// T2.4

it('un altro precarico di Vite (un font, `as="font"`) non esce, né come script né come stile: escono solo CSS e moduli (sprint 28 · T2.4)', function () {
    // Il precarico di un font, come lo darebbe un plugin: Vite lo tiene fra i suoi con `as="font"`.
    Vite::usePreloadTagAttributes(fn ($src, $url): array => str_contains((string) $url, 'fornitori-') ? ['rel' => 'preload', 'as' => 'font'] : []);
    Route::get('/prova/precarico', fn () => documentoConVite())->middleware(PrecaricoDegliIngressi::class);

    $risposta = $this->get('/prova/precarico')->assertOk();
    $voci = vociDelPrecarico($risposta->headers->get('Link'));

    // Il caso non è vuoto: fra i precarichi di Vite quello col font c'è.
    expect(Vite::preloadedAssets()[fileDelPrecarico('fornitori-BBBB2222.js')] ?? [])->toContain('as="font"')
        ->and(array_keys($voci))->toEqualCanonicalizing([fileDelPrecarico('app-CCCC3333.css'), fileDelPrecarico('app-AAAA1111.js')])
        ->and($voci[fileDelPrecarico('app-AAAA1111.js')] ?? null)->toBe(['rel=preload', 'as=script', 'crossorigin'])
        ->and((string) $risposta->headers->get('Link'))->not->toContain('font');
});

// T2.5

it('zr-core non registra il precarico da sé: col solo provider una pagina 200 HTML con `@vite` non ha `Link`, nel gruppo `web` come fuori; e `config/zr-core.php` non ha una chiave per lui (sprint 28 · T2.5)', function () {
    // Nel gruppo `web` c'è la guardia di zr-auth: la pagina è di una persona entrata.
    sessioneAMano(WORKSPACE_DEL_PRECARICO);
    Route::get('/prova/precarico', fn () => documentoConVite());
    Route::get('/w/uat-marketing/precarico', fn () => documentoConVite())->middleware('web');
    $kernel = app(HttpKernel::class);
    $delleRotte = collect(Route::getRoutes()->getRoutes())->flatMap(fn ($rotta) => $rotta->gatherMiddleware())->all();

    expect($kernel->hasMiddleware(PrecaricoDegliIngressi::class))->toBeFalse()
        ->and(Arr::flatten($kernel->getMiddlewareGroups()))->not->toContain(PrecaricoDegliIngressi::class)
        ->and($delleRotte)->not->toContain(PrecaricoDegliIngressi::class)
        ->and($this->get('/prova/precarico')->assertOk()->headers->has('Link'))->toBeFalse()
        ->and($this->get('/w/uat-marketing/precarico')->assertOk()->headers->has('Link'))->toBeFalse()
        // Le rotte le dice dove il frontend lo aggancia, i file li dice `@vite`: niente da configurare.
        ->and(array_keys((array) config('zr-core')))->toBe(['csp', 'csp_pagine'])
        ->and(array_keys(require __DIR__.'/../../config/zr-core.php'))->toBe(['csp', 'csp_pagine']);
});

it('il frontend lo registra sul gruppo `web`, e da lì ogni pagina intera del gruppo ha il `Link`; una rotta fuori dal gruppo no (sprint 28 · T2.5)', function () {
    sessioneAMano(WORKSPACE_DEL_PRECARICO);
    // Come `$middleware->web(append: […])` nel `bootstrap/app.php` di un frontend: sul kernel, che i gruppi li passa al router.
    app(HttpKernel::class)->appendMiddlewareToGroup('web', PrecaricoDegliIngressi::class);
    Route::get('/w/uat-marketing/precarico', fn () => documentoConVite())->middleware('web');
    Route::get('/prova/precarico', fn () => documentoConVite());

    expect(vociDelPrecarico($this->get('/w/uat-marketing/precarico')->assertOk()->headers->get('Link')))->toHaveCount(3)
        ->and($this->get('/prova/precarico')->assertOk()->headers->has('Link'))->toBeFalse();
});

// Lettura della PR #61, R1 (e `Decisione:` 11432 di zr-pm con la sua aggiunta). Senza `ASSET_URL` Laravel scrive i file della
// build con la radice della richiesta: l'header `Host`, o `X-Forwarded-Host` se il frontend si fida dei proxy. Chi manda un
// host suo lo ritroverebbe nel documento e nel `Link`. Il pacchetto registra un resolver di Vite che scrive il solo percorso, e
// il middleware non scrive mai un host che viene dalla richiesta, nemmeno se il frontend rimette il resolver di Laravel.

it('senza `ASSET_URL` il documento e il `Link` portano i file della build col solo percorso: un host falso nella richiesta non si ritrova né nell\'uno né nell\'altro (lettura della PR #61, R1)', function (string $indirizzo, array $intestazioni, string $atteso) {
    frontendCheSiFidaDeiProxy();
    $visto = null;
    rottaCheTieneLHost($visto);

    $risposta = $this->get($indirizzo, $intestazioni)->assertOk();
    $documento = (string) $risposta->getContent();
    $link = (string) $risposta->headers->get('Link');

    // Il caso non è vuoto: l'host falso è arrivato, ed è quello che Laravel userebbe per la radice.
    expect($visto)->toBe($atteso)
        ->and(fileNelDocumento($documento))->toEqualCanonicalizing(fileAllApertura())
        ->and($documento)->not->toContain('attaccante.example')->not->toContain('altro.example')
        ->and(array_keys(vociDelPrecarico($link)))->toEqualCanonicalizing(fileAllApertura())
        ->and($link)->not->toContain('attaccante.example')->not->toContain('altro.example')->not->toContain('://');
})->with([
    'un `Host` falso' => ['http://attaccante.example/prova/precarico', [], 'attaccante.example'],
    'un `X-Forwarded-Host` falso' => ['/prova/precarico', ['X-Forwarded-Host' => 'altro.example'], 'altro.example'],
    'tutti e due falsi' => ['http://attaccante.example/prova/precarico', ['X-Forwarded-Host' => 'altro.example'], 'altro.example'],
]);

it('un frontend che rimette il resolver di Laravel ha nel documento l\'host della richiesta, ma nel `Link` no: la voce è il solo percorso (lettura della PR #61, R1; seconda lettura, N1)', function (string $indirizzo, array $intestazioni, string $atteso, string $radice) {
    frontendCheSiFidaDeiProxy();
    Vite::createAssetPathsUsing(null);
    $visto = null;
    rottaCheTieneLHost($visto);

    $risposta = $this->get($indirizzo, $intestazioni)->assertOk();
    $link = (string) $risposta->headers->get('Link');

    // Il contro-esempio è nel documento: lì l'host falso c'è, perché il resolver non è quello del pacchetto.
    expect($visto)->toBe($atteso)
        ->and(fileNelDocumento((string) $risposta->getContent()))->toEqualCanonicalizing(fileAllApertura($radice))
        ->and(array_keys(vociDelPrecarico($link)))->toEqualCanonicalizing(fileAllApertura())
        ->and($link)->not->toContain('attaccante.example')->not->toContain('altro.example')->not->toContain('://');
})->with([
    'un `Host` falso' => ['http://attaccante.example/prova/precarico', [], 'attaccante.example', 'http://attaccante.example'],
    'un `X-Forwarded-Host` falso' => ['/prova/precarico', ['X-Forwarded-Host' => 'altro.example'], 'altro.example', 'http://altro.example'],
    // La radice della richiesta ha anche la porta: il middleware toglie quella, non il solo nome.
    'un `Host` falso con la porta' => ['http://attaccante.example:8080/prova/precarico', [], 'attaccante.example', 'http://attaccante.example:8080'],
]);

// Seconda lettura della PR #61, N1. Col resolver di Laravel la radice della richiesta non è solo l'host: se il frontend si fida
// dei proxy ha davanti anche `X-Forwarded-Prefix`, che Symfony non controlla carattere per carattere. Tolto l'host, quel prefisso
// resterebbe nella voce: con un `>` chiude l'indirizzo, e i parametri della voce li scrive chi chiama; con una tabulazione, che
// un browser toglie dagli indirizzi, `/<TAB>/altro.example` si legge `//altro.example`, un altro host.
it('col resolver di Laravel e un frontend che si fida dei proxy, un `X-Forwarded-Prefix` con un carattere che in un `Link` chiude l\'indirizzo o cambia l\'host non esce: nessuna voce (seconda lettura della PR #61, N1)', function (string $prefisso) {
    frontendCheSiFidaDeiProxy(Request::HEADER_X_FORWARDED_HOST | Request::HEADER_X_FORWARDED_PREFIX);
    Vite::createAssetPathsUsing(null);
    Route::get('/prova/precarico', fn () => documentoConVite())->middleware(PrecaricoDegliIngressi::class);

    $risposta = $this->get('/prova/precarico', ['X-Forwarded-Prefix' => $prefisso])->assertOk();

    // Il caso non è vuoto: il prefisso è arrivato negli indirizzi che `@vite` ha scritto.
    expect(array_keys(Vite::preloadedAssets()))->toEqualCanonicalizing(fileAllApertura('http://localhost'.$prefisso))
        ->and($risposta->headers->has('Link'))->toBeFalse();
})->with([
    'un `>`, che chiude l\'indirizzo della voce' => ['/x>; rel=stylesheet; y='],
    'una tabulazione, che un browser toglie: `//altro.example`' => ["/\t/altro.example"],
]);

it('con `ASSET_URL` il documento e il `Link` portano l\'indirizzo intero, che comincia con quello e non con l\'host della richiesta (lettura della PR #61, R1)', function () {
    // Come `ASSET_URL` nel `.env` del frontend: Laravel lo legge all'avvio, qui si dà alle due parti che lo tengono.
    config(['app.asset_url' => 'https://cdn.zeiras.example']);
    URL::useAssetOrigin('https://cdn.zeiras.example');
    $visto = null;
    rottaCheTieneLHost($visto);

    $risposta = $this->get('http://attaccante.example/prova/precarico')->assertOk();
    $link = (string) $risposta->headers->get('Link');

    expect($visto)->toBe('attaccante.example')
        ->and(fileNelDocumento((string) $risposta->getContent()))->toEqualCanonicalizing(fileAllApertura('https://cdn.zeiras.example'))
        ->and(array_keys(vociDelPrecarico($link)))->toEqualCanonicalizing(fileAllApertura('https://cdn.zeiras.example'))
        ->and($link)->not->toContain('attaccante.example');
});

it('un file con un indirizzo che non è un percorso, non comincia con `ASSET_URL` e non ha l\'host della richiesta non esce nel `Link` (lettura della PR #61, R1)', function (string $radice) {
    config(['app.asset_url' => 'https://cdn.zeiras.example']);
    Vite::createAssetPathsUsing(fn (string $percorso): string => $radice.$percorso);
    Route::get('/prova/precarico', fn () => documentoConVite())->middleware(PrecaricoDegliIngressi::class);

    $risposta = $this->get('/prova/precarico')->assertOk();

    // Il caso non è vuoto: `@vite` ha scritto i suoi tre file, con quell'indirizzo.
    expect(array_keys(Vite::preloadedAssets()))->toEqualCanonicalizing(fileAllApertura(rtrim($radice, '/')))
        ->and($risposta->headers->has('Link'))->toBeFalse();
})->with([
    'un altro host' => ['https://altrove.example/'],
    'un altro host senza schema: comincia con `//`, non è un percorso' => ['//altrove.example/'],
    'un altro host scritto con la barra rovescia, che un browser legge come `//`' => ['/\\altrove.example/'],
    'un altro host, con `ASSET_URL` che è un suo prefisso senza la barra' => ['https://cdn.zeiras.example.altrove.example/'],
]);
