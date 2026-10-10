<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Zeiras\Core\Favicon;
use Zeiras\Core\ZrCoreServiceProvider;

// Sprint 15 · T3 (voce #1585): la favicon di Zeiras arriva dal pacchetto. Tre file statici in public/ del frontend — favicon.svg,
// che è la copia del design system, favicon.ico e apple-touch-icon.png, generati da quella con `npm run favicon` — e una vista
// che dà le righe del <head>. Nessuna rotta: /favicon.ico lo serve il server web, come ogni file di public/. Che i due file
// generati siano la resa della favicon lo guarda la CI (`npm run favicon -- --controlla`), non Pest.

/**
 * I tre file della favicon come stanno in public/ del frontend: il nome lì → il file del pacchetto da cui viene.
 *
 * @return array<string, string|false>
 */
function fileDellaFavicon(): array
{
    return [
        'apple-touch-icon.png' => realpath(__DIR__.'/../../resources/favicon/apple-touch-icon.png'),
        'favicon.ico' => realpath(__DIR__.'/../../resources/favicon/favicon.ico'),
        'favicon.svg' => realpath(__DIR__.'/../../resources/zeiras/logos/zeiras-favicon.svg'),
    ];
}

/** Lo sha256 che tests/zeiras.sha256 dà a quella copia del design system. Null se l'elenco non la nomina. */
function sha256NellElenco(string $copia): ?string
{
    preg_match('/^([0-9a-f]{64})  '.preg_quote($copia, '/').'$/m', File::get(__DIR__.'/../zeiras.sha256'), $riga);

    return $riga[1] ?? null;
}

/**
 * Le righe di un pezzo di HTML, una per elemento, senza rientri e senza righe vuote.
 *
 * @return list<string>
 */
function righeDi(string $html): array
{
    return array_values(array_filter(array_map('trim', preg_split('/\R/', $html) ?: []), fn (string $riga) => $riga !== ''));
}

/**
 * Le quattro righe che la vista deve dare, col colore del tema calcolato qui da tokens.json: il token `surface`, tema chiaro.
 *
 * @return list<string>
 */
function righeAtteseDellaFavicon(): array
{
    $token = json_decode(File::get(__DIR__.'/../../resources/zeiras/tokens.json'), true, flags: JSON_THROW_ON_ERROR);
    $surface = collect($token['color']['tokens'])->firstWhere('name', 'surface')['value']['light'];

    return [
        '<link rel="icon" href="/favicon.ico" sizes="32x32">',
        '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
        '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
        '<meta name="theme-color" content="'.$surface.'">',
    ];
}

// Ciò che un caso pubblica nello scheletro di Testbench si toglie dopo, file per file.
afterEach(function () {
    foreach (array_keys(fileDellaFavicon()) as $nome) {
        File::delete(public_path($nome));
    }
});

it('vendor:publish mette in public/ favicon.svg, favicon.ico e apple-touch-icon.png, e favicon.svg è il file del design system: col tag di zr-core e con laravel-assets, quello che i frontend lanciano già a ogni composer update (sprint 15 · T3.1)', function (string $tag) {
    $attesi = fileDellaFavicon();
    // Come in un frontend di oggi: in public/ c'è già un favicon.ico vuoto, quello dello scheletro di Laravel.
    File::put(public_path('favicon.ico'), '');

    // Ciò che il provider dichiara per quel tag: i tre file, ognuno col suo nome nella radice di public/, e niente altro.
    $dichiarati = collect(ServiceProvider::pathsToPublish(ZrCoreServiceProvider::class, $tag))
        ->mapWithKeys(fn (string $a, string $da) => [Str::after($a, public_path().DIRECTORY_SEPARATOR) => realpath($da)])
        ->sortKeys()->all();
    $uscita = Artisan::call('vendor:publish', ['--tag' => $tag, '--force' => true]);
    $pubblicati = array_map(fn (string $nome) => File::exists(public_path($nome)) ? hash_file('sha256', public_path($nome)) : null, array_combine(array_keys($attesi), array_keys($attesi)));

    expect($attesi)->not->toContain(false)
        ->and($dichiarati)->toBe($attesi)
        ->and($uscita)->toBe(0)
        ->and($pubblicati)->toBe(array_map(fn (string $origine) => hash_file('sha256', $origine), $attesi))
        ->and($pubblicati['favicon.svg'])->toBe(sha256NellElenco('resources/zeiras/logos/zeiras-favicon.svg'))
        ->and(File::size(public_path('favicon.ico')))->toBeGreaterThan(0);
})->with(['zr-core-favicon', 'laravel-assets']);

it('@include(\'zr-core::favicon\') dà quattro righe: le due icone, l\'icona Apple e il theme-color, col valore del token surface nel tema chiaro letto da tokens.json (sprint 15 · T3.4)', function () {
    $attese = righeAtteseDellaFavicon();

    expect($attese[3])->toMatch('/^<meta name="theme-color" content="#[0-9a-f]{6}">$/')
        ->and(righeDi(Blade::render("@include('zr-core::favicon')")))->toBe($attese)
        ->and('<meta name="theme-color" content="'.Favicon::coloreDelTema().'">')->toBe($attese[3]);
});

it('la vista della favicon non prende niente dalla richiesta: su un altro dominio, con un altro percorso e una query, dà le stesse quattro righe (sprint 15 · T3.4)', function () {
    Route::get('uat/{pagina}', fn () => view('zr-core::favicon'));

    $risposta = $this->get('https://altro.example/uat/altra-pagina?theme-color=%23000000&href=//altro.example/favicon.ico');

    expect($risposta->status())->toBe(200)
        ->and(righeDi((string) $risposta->getContent()))->toBe(righeAtteseDellaFavicon());
});

it('le due pagine di prova hanno nella testa le quattro righe della vista della favicon, com\'è resa, e nessun altro link (sprint 15 · T3.5)', function (string $pagina) {
    $testa = Str::between(File::get(__DIR__.'/../../resources/demo/'.$pagina), '<head>', '</head>');
    $nellaPagina = array_values(array_filter(righeDi($testa), fn (string $riga) => str_starts_with($riga, '<link') || str_contains($riga, 'name="theme-color"')));

    expect($nellaPagina)->toBe(righeDi(Blade::render("@include('zr-core::favicon')")))
        ->and($nellaPagina)->toHaveCount(4);
})->with(['index.html', 'layout.html']);
