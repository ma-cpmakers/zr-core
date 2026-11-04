<?php

use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\Str;
use Zeiras\Core\Cornice;

// Sprint 106 · T3 (il nome del file sta prima di `PacchettoTest.php`: dopo di lui Pest deve girare `RegistroTest.php`) (voce #3015). Dalla `v4.4.0` nel JS d'ingresso c'è solo l'italiano: inglese e spagnolo sono file `.json` della
// build che la cornice chiede con `fetch`. Il server del modulo, che sa la lingua della sessione, mette nella testa della pagina
// il precarico di quei file (`Cornice::precaricoDellaLingua()`), così la richiesta parte prima che l'ingresso sia eseguito. Il
// file si trova nel manifest del modulo con la chiave che gli dà Vite: il percorso del file, risolti i link simbolici, relativo
// alla radice del frontend.
// Il frontend di prova sta in una cartella dentro il pacchetto, tolta a fine caso: la chiave dei file delle lingue è quindi
// `../resources/lingue/<codice>.json`, e quella di un pacchetto installato in symlink si prova con un `vendor/` di prova.

const RADICE_DEL_PACCHETTO = __DIR__.'/../..';

/** Il frontend di prova: la sua radice, con `public/` dentro, e una cartella della build col nome che il caso gli dà. */
function frontendDiProva(string $radice, string $cartella): void
{
    File::ensureDirectoryExists($radice.'/public/'.$cartella);
    app()->setBasePath($radice);
    app()->usePublicPath($radice.'/public');
    Vite::useBuildDirectory($cartella);
}

/** @param  array<string, array<string, mixed>>  $voci */
function manifestDiProva(string $cartella, array $voci): void
{
    File::put(public_path($cartella.'/manifest.json'), json_encode($voci, JSON_THROW_ON_ERROR));
}

/** Le voci del manifest dei file delle lingue a richiesta, con la chiave `<prefisso><codice>.json`. */
function vociDelleLingue(string $prefisso): array
{
    return [
        'resources/js/app.tsx' => ['file' => 'assets/app-AAAA1111.js', 'src' => 'resources/js/app.tsx', 'isEntry' => true],
        $prefisso.'es.json' => ['file' => 'assets/es-ESES2222.json', 'src' => $prefisso.'es.json'],
        $prefisso.'en.json' => ['file' => 'assets/en-ENEN3333.json', 'src' => $prefisso.'en.json'],
    ];
}

/** Il precarico di un file della build, com'è nella testa della pagina. */
function precaricoDi(string $cartella, string $file): string
{
    return '<link rel="preload" as="fetch" href="/'.$cartella.'/assets/'.$file.'" crossorigin>';
}

beforeEach(function () {
    $this->radice = RADICE_DEL_PACCHETTO.'/build-lingua-'.Str::lower(Str::random(8));
    $this->cartella = 'build-'.Str::lower(Str::random(8));
    frontendDiProva($this->radice, $this->cartella);
    manifestDiProva($this->cartella, vociDelleLingue('../resources/lingue/'));
});

afterEach(function () {
    File::deleteDirectory($this->radice);
});

it('in `es` la pagina precarica i file di spagnolo e inglese del manifest del modulo, come `fetch` (sprint 106 · T3.1)', function () {
    App::setLocale('es');

    expect((string) Cornice::precaricoDellaLingua())
        ->toBe(precaricoDi($this->cartella, 'es-ESES2222.json')."\n".precaricoDi($this->cartella, 'en-ENEN3333.json'));
});

it('una lingua con la regione prende il file della lingua base: `es_MX` e `es-AR` precaricano spagnolo e inglese (sprint 106 · T3.1)', function (string $lingua) {
    App::setLocale($lingua);

    expect((string) Cornice::precaricoDellaLingua())
        ->toBe(precaricoDi($this->cartella, 'es-ESES2222.json')."\n".precaricoDi($this->cartella, 'en-ENEN3333.json'));
})->with(['es_MX', 'es-AR', 'ES']);

it('in `pt-BR`, che zr-core non ha, e in `en` la pagina precarica il solo inglese (sprint 106 · T3.1)', function (string $lingua) {
    App::setLocale($lingua);

    expect((string) Cornice::precaricoDellaLingua())->toBe(precaricoDi($this->cartella, 'en-ENEN3333.json'));
})->with(['pt-BR', 'en', 'en-GB']);

it('in italiano, la lingua del JS d\'ingresso, la pagina non precarica niente (sprint 106 · T3.1)', function (string $lingua) {
    App::setLocale($lingua);

    expect((string) Cornice::precaricoDellaLingua())->toBe('');
})->with(['it', 'it-CH', 'it_IT']);

it('il precarico si scrive con `{{ }}`: Blade non lo rende testo (sprint 106 · T3.1)', function () {
    App::setLocale('pt-BR');

    expect(Blade::render('<head>{{ \Zeiras\Core\Cornice::precaricoDellaLingua() }}</head>'))
        ->toBe('<head>'.precaricoDi($this->cartella, 'en-ENEN3333.json').'</head>');
});

it('con il pacchetto installato in symlink la chiave è il percorso vero del file, non quello sotto `vendor/` (sprint 106 · T3.1)', function () {
    $frontend = $this->radice.'/frontend';
    File::ensureDirectoryExists($frontend.'/vendor/zeiras');
    symlink(realpath(RADICE_DEL_PACCHETTO), $frontend.'/vendor/zeiras/zr-core');
    frontendDiProva($frontend, $this->cartella);
    manifestDiProva($this->cartella, vociDelleLingue('../../resources/lingue/') + [
        'vendor/zeiras/zr-core/resources/lingue/es.json' => ['file' => 'assets/es-FALSO000.json'],
    ]);
    App::setLocale('es');

    expect((string) Cornice::precaricoDellaLingua())
        ->toBe(precaricoDi($this->cartella, 'es-ESES2222.json')."\n".precaricoDi($this->cartella, 'en-ENEN3333.json'));
});

it('senza manifest, con Vite in sviluppo o con una lingua che non è nel manifest la pagina non va in errore: niente precarico (sprint 106 · T3.2)', function (string $caso) {
    match ($caso) {
        'senza manifest' => File::delete(public_path($this->cartella.'/manifest.json')),
        'Vite in sviluppo' => File::put(public_path('hot'), 'http://localhost:5173'),
        'lingua fuori dal manifest' => manifestDiProva($this->cartella, ['resources/js/app.tsx' => ['file' => 'assets/app-AAAA1111.js', 'isEntry' => true]]),
    };
    App::setLocale('es');

    expect((string) Cornice::precaricoDellaLingua())->toBe('');
})->with(['senza manifest', 'Vite in sviluppo', 'lingua fuori dal manifest']);

it('solo lo spagnolo nel manifest: precarica quello, e l\'inglese che manca non ferma la pagina (sprint 106 · T3.2)', function () {
    manifestDiProva($this->cartella, ['../resources/lingue/es.json' => ['file' => 'assets/es-ESES2222.json']]);
    App::setLocale('es');

    expect((string) Cornice::precaricoDellaLingua())->toBe(precaricoDi($this->cartella, 'es-ESES2222.json'));
});

it('una lingua che non ha la forma di una lingua non precarica niente, nemmeno l\'inglese (sprint 106 · T3.2)', function (string $lingua) {
    config(['app.locale' => $lingua]);

    expect((string) Cornice::precaricoDellaLingua())->toBe('');
})->with(['es-"><b>', '', 'e', 'es es']);
