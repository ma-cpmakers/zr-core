<?php

use Illuminate\Filesystem\Filesystem;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Symfony\Component\Finder\SplFileInfo;

// Sprint 1 · T3 (voce #1254). I token del design system come variabili CSS: resources/css/zeiras-token.css, generato da
// scripts/token-css.mjs, definisce nel :root ogni variabile che bundle.css usa, una volta sola, col valore del suo token nel tema
// chiaro; nessun valore dei token è scritto a mano nel codice di zr-core; i font arrivano solo da Google Fonts, come li carica
// bundle.css, e la CSP del README li ammette. Il precedente è il DesignSystemTest di zr-home.

/**
 * Il valore di ogni token di tokens.json, per nome della variabile che lo porta: `--surface`, `--space-4`, `--font-display`. Di
 * colori e ombre il tema chiaro; un valore che rimanda a un altro token (`{pine}`) è `var(--pine)`. È l'oracolo: si calcola qui
 * dalla copia derivata, non col generatore.
 *
 * @return array<string, string>
 */
function valoriDeiToken(): array
{
    $token = json_decode(File::get(__DIR__.'/../../resources/zeiras/tokens.json'), true, flags: JSON_THROW_ON_ERROR);
    $valore = fn (string $testo) => (string) preg_replace('/^\{([a-z0-9-]+)\}$/', 'var(--$1)', $testo);

    $valori = [];
    foreach ([...$token['color']['tokens'], ...$token['shadow']['tokens']] as $voce) {
        $valori["--{$voce['name']}"] = $valore($voce['value']['light']);
    }
    foreach ([...$token['spacing']['tokens'], ...$token['radius']['tokens'], ...$token['layout']['tokens'], ...$token['zIndex']['tokens']] as $voce) {
        $valori["--{$voce['name']}"] = $valore((string) $voce['value']);
    }
    foreach ($token['type']['families'] as $famiglia => $testo) {
        $valori["--font-$famiglia"] = $valore($testo);
    }

    return $valori;
}

/** Un CSS senza i commenti. */
function cssSenzaCommenti(string $css): string
{
    return (string) preg_replace('~/\*.*?\*/~s', '', $css);
}

/**
 * Ogni definizione delle variabili `--…` nei blocchi `:root` di un CSS, anche dentro un `@media`.
 *
 * @return array<string, list<string>>
 */
function variabiliDiRoot(string $css): array
{
    preg_match_all('/:root\s*\{([^{}]*)\}/', cssSenzaCommenti($css), $blocchi);

    $variabili = [];
    foreach ($blocchi[1] as $blocco) {
        foreach (explode(';', $blocco) as $dichiarazione) {
            if (str_starts_with(trim($dichiarazione), '--')) {
                [$nome, $valore] = explode(':', trim($dichiarazione), 2);
                $variabili[trim($nome)][] = trim($valore);
            }
        }
    }

    return $variabili;
}

/**
 * Cosa non torna fra le variabili del :root di un CSS e i token: una variabile che non è un token, che manca, che è definita più
 * di una volta, o con un valore diverso da quello del token nel tema chiaro.
 *
 * @param  list<string>  $variabili
 * @return list<string>
 */
function problemiDeiToken(string $css, array $variabili): array
{
    $definite = variabiliDiRoot($css);
    $token = valoriDeiToken();

    $problemi = [];
    foreach ($variabili as $variabile) {
        $valori = $definite[$variabile] ?? [];
        if (! array_key_exists($variabile, $token)) {
            $problemi[] = "$variabile: non è un token";
        } elseif (count($valori) !== 1) {
            $problemi[] = "$variabile: definita ".count($valori).' volte';
        } elseif ($valori[0] !== $token[$variabile]) {
            $problemi[] = "$variabile: «{$valori[0]}» invece di «{$token[$variabile]}»";
        }
    }

    return $problemi;
}

/** @return list<string> le variabili `--…` che usa bundle.css */
function variabiliDiBundleCss(): array
{
    preg_match_all('/var\(\s*(--[a-z0-9-]+)/', File::get(__DIR__.'/../../resources/zeiras/bundle.css'), $usate);

    return array_values(array_unique($usate[1]));
}

/**
 * I valori dei token scritti a mano: un colore esadecimale, un `rgb(a)` o `hsl(a)`, o il valore intero di un token.
 *
 * @param  iterable<SplFileInfo>  $file
 * @return list<string>
 */
function valoriAMano(iterable $file): array
{
    $colore = '/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i';
    // I colori e le ombre li trova già la regola dei colori: qui restano misure e famiglie.
    $valori = collect(valoriDeiToken())
        ->reject(fn (string $valore) => str_starts_with($valore, 'var(') || is_numeric($valore) || preg_match($colore, $valore) === 1)
        ->values();

    $problemi = [];
    foreach ($file as $sorgente) {
        $testo = senzaCommenti($sorgente->getContents());
        if (preg_match($colore, $testo, $trovato) === 1) {
            $problemi[] = "{$sorgente->getRelativePathname()}: «{$trovato[0]}»";
        }
        foreach ($valori as $valore) {
            // Il valore intero, non dentro un altro: «6px» non è in «26px».
            if (preg_match('/(?<![\w.#-])'.preg_quote($valore, '/').'(?![\w-])/', $testo) === 1) {
                $problemi[] = "{$sorgente->getRelativePathname()}: «{$valore}» scritto a mano";
            }
        }
    }

    return $problemi;
}

it('ogni variabile che bundle.css usa è definita una volta sola nel :root di zeiras-token.css, col valore del suo token nel tema chiaro (T3.1)', function () {
    $css = File::get(__DIR__.'/../../resources/css/zeiras-token.css');
    $usate = variabiliDiBundleCss();

    expect($usate)->toContain('--surface', '--font-sans', '--font-display', '--space-4', '--radius-md', '--shadow-card', '--z-dialog')
        ->and(problemiDeiToken($css, array_values(array_unique([...$usate, ...array_keys(valoriDeiToken())]))))->toBe([])
        ->and(array_keys(variabiliDiRoot($css)))->toEqualCanonicalizing(array_keys(valoriDeiToken()))
        // Un blocco :root e nient'altro: niente tema scuro, niente @import, niente @font-face.
        ->and(trim(cssSenzaCommenti($css)))->toMatch('/^:root\s*\{[^{}]*\}$/');
});

it('il controllo trova la variabile che manca, quella definita due volte e quella col valore scuro (T3.1)', function () {
    $token = valoriDeiToken();
    $colori = collect(json_decode(File::get(__DIR__.'/../../resources/zeiras/tokens.json'), true, flags: JSON_THROW_ON_ERROR)['color']['tokens']);
    $scuro = $colori->firstWhere('name', 'surface')['value']['dark'];

    $righe = collect($token)->except('--ink')->map(fn (string $valore, string $nome) => "$nome: $valore;")->all();
    $righe['--surface'] = "--surface: $scuro;";
    $css = ':root { '.implode(' ', $righe).' }'."\n".'@media (prefers-color-scheme: dark) { :root { --pine: '.$token['--pine'].'; } }';

    expect(problemiDeiToken($css, [...array_keys($token), '--sconosciuta']))->toEqualCanonicalizing([
        '--ink: definita 0 volte',
        '--pine: definita 2 volte',
        "--surface: «{$scuro}» invece di «{$token['--surface']}»",
        '--sconosciuta: non è un token',
    ]);
});

it('nessun valore dei token è scritto a mano nel codice di zr-core: niente esadecimali né rgb(a), nessun valore di tokens.json (T3.2)', function () {
    $file = collect([
        ...File::allFiles(__DIR__.'/../../resources/js'),
        ...File::allFiles(__DIR__.'/../../resources/css'),
        ...File::allFiles(__DIR__.'/../../src'),
    ])->reject(fn (SplFileInfo $sorgente) => $sorgente->getRealPath() === realpath(__DIR__.'/../../resources/css/zeiras-token.css'));

    expect($file->map->getRelativePathname()->all())->toContain('index.ts', 'zeiras/react-globale.ts', 'ZrCoreServiceProvider.php')
        ->and(valoriAMano($file))->toBe([]);
});

it('il controllo trova un esadecimale, un rgba e il valore di un token scritti a mano, e lascia stare i commenti (T3.2)', function () {
    $cartella = sys_get_temp_dir().'/zr-core-valori-'.Str::random(12);
    File::ensureDirectoryExists($cartella);
    register_shutdown_function(fn () => (new Filesystem)->deleteDirectory($cartella));
    $larghezza = valoriDeiToken()['--sidebar-width'];
    File::put("$cartella/a.ts", "export const colore = '#0e5e4e';\n");
    File::put("$cartella/b.css", ".x { color: rgba(0, 0, 0, 0.5); }\n");
    File::put("$cartella/c.tsx", "export const stile = { width: '$larghezza' };\n");
    File::put("$cartella/d.ts", "// la voce #1254 e https://fonts.googleapis.com\nexport const larghezza = 'var(--sidebar-width)';\n");

    expect(valoriAMano(File::allFiles($cartella)))->toEqualCanonicalizing([
        'a.ts: «#0e5e4e»',
        'b.css: «rgba(»',
        "c.tsx: «{$larghezza}» scritto a mano",
    ]);
});

it('i font arrivano solo da Google Fonts com\'è in bundle.css, nessuno stile è iniettato da JS, e la CSP del README li ammette (T3.3)', function () {
    $bundle = File::get(__DIR__.'/../../resources/zeiras/bundle.css');
    preg_match('/^@import url\(\'(https:\/\/fonts\.googleapis\.com\/[^\']+)\'\);/', ltrim(cssSenzaCommenti($bundle)), $font);
    preg_match_all('/https?:\/\/[^\s"\')]+/', $bundle, $indirizzi);
    // Anche il bundle del design system: è il JS che disegna la cornice, e un riallineamento potrebbe portare stili iniettati.
    $iniettati = collect([...File::allFiles(__DIR__.'/../../resources/js'), ...File::allFiles(__DIR__.'/../../resources/zeiras')])
        ->filter(fn (SplFileInfo $sorgente) => in_array($sorgente->getExtension(), ['ts', 'tsx', 'js'], true))
        ->filter(fn (SplFileInfo $sorgente) => preg_match('/createElement\(\s*[\'"]style|insertRule\(|adoptedStyleSheets|new CSSStyleSheet/', senzaCommenti($sorgente->getContents())) === 1)
        ->map->getRelativePathname()->values()->all();

    expect($font)->toHaveCount(2)
        ->and(array_values(array_unique($indirizzi[0])))->toBe([$font[1]])
        ->and($iniettati)->toBe([])
        ->and(File::get(__DIR__.'/../../package.json'))->not->toContain('@fontsource')
        ->and(File::get(__DIR__.'/../../README.md'))
        ->toContain("default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com");
});
