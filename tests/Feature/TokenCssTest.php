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
    foreach ([...$token['spacing']['tokens'], ...$token['radius']['tokens'], ...$token['layout']['tokens'], ...$token['zIndex']['tokens'], ...$token['border']['tokens']] as $voce) {
        $valori["--{$voce['name']}"] = $valore((string) $voce['value']);
    }
    foreach ($token['type']['families'] as $famiglia => $testo) {
        $valori["--font-$famiglia"] = $valore($testo);
    }
    // Sprint 86 · T1.1 (voce #2828): ogni stile di testo coi nomi del tema di Tailwind 4 — la misura, l'interlinea, il peso e, dove
    // c'è, la spaziatura delle lettere.
    foreach ($token['type']['groups'] as $gruppo) {
        foreach ($gruppo['styles'] as $stile) {
            $valori["--text-{$stile['name']}"] = $stile['fontSize'];
            $valori["--text-{$stile['name']}--line-height"] = $stile['lineHeight'];
            $valori["--text-{$stile['name']}--font-weight"] = (string) $stile['fontWeight'];
            if (isset($stile['letterSpacing'])) {
                $valori["--text-{$stile['name']}--letter-spacing"] = $stile['letterSpacing'];
            }
        }
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
    // Le variabili che un componente scrive da sé nel suo `style` (`'--foot-cols': …` in SiteFooter, col suo valore di ripiego nel
    // CSS) sono sue, non token: non vengono da zeiras-token.css.
    preg_match_all("/'(--[a-z0-9-]+)':/", File::get(__DIR__.'/../../resources/zeiras/bundle.js'), $proprie);

    return array_values(array_diff(array_unique($usate[1]), $proprie[1]));
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
    // I colori e le ombre li trova già la regola dei colori: qui restano misure e famiglie. Un valore che due token hanno
    // (`2px`: `radius-2xs` e, dal secondo lotto del 05/11, `border-ring`) scritto a mano è un problema solo.
    $valori = collect(valoriDeiToken())
        ->reject(fn (string $valore) => str_starts_with($valore, 'var(') || is_numeric($valore) || preg_match($colore, $valore) === 1)
        ->unique()
        ->values();

    $problemi = [];
    foreach ($file as $sorgente) {
        // Sprint 104: il contorno del fuoco del design system (`outline: 2px solid var(--focus)`, come in bundle.css) non è un token, e
        // il suo 2px non è il raggio `radius-2xs` arrivato con la richiesta 139.
        $testo = (string) preg_replace('/outline:\s*2px solid var\(--focus\)/', '', senzaCommenti($sorgente->getContents()));
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

it('zeiras-token.css porta i dodici stili di testo di tokens.json, coi nomi del tema di Tailwind 4 e i loro valori (sprint 86 · T1.1; label dalla v4.2.0; wordmark e micro dal secondo lotto del 05/11)', function () {
    $css = variabiliDiRoot(File::get(__DIR__.'/../../resources/css/zeiras-token.css'));
    $testo = collect($css)->keys()->filter(fn (string $nome) => str_starts_with($nome, '--text-'))->values();
    $stili = $testo->reject(fn (string $nome) => str_contains(substr($nome, 2), '--'))->map(fn (string $nome) => substr($nome, 7))->values()->all();

    expect($stili)->toEqualCanonicalizing(['display-xl', 'display', 'heading-1', 'heading-2', 'heading-3', 'body', 'body-sm', 'label', 'caption', 'overline', 'wordmark', 'micro'])
        // Tre variabili per stile, e la quarta nei cinque che hanno la spaziatura delle lettere (display-xl, display, heading-1, overline, wordmark).
        ->and($testo)->toHaveCount(12 * 3 + 5)
        ->and([$css['--text-heading-1'], $css['--text-heading-1--line-height'], $css['--text-heading-1--font-weight'], $css['--text-heading-1--letter-spacing']])
        ->toBe([['26px'], ['32px'], ['650'], ['-0.01em']])
        ->and($css['--text-overline--letter-spacing'])->toBe(['0.06em'])
        ->and([$css['--text-label'], $css['--text-label--line-height'], $css['--text-label--font-weight']])->toBe([['13px'], ['18px'], ['500']])
        ->and([$css['--text-micro'], $css['--text-micro--line-height'], $css['--text-micro--font-weight']])->toBe([['10px'], ['16px'], ['700']])
        ->and([$css['--text-wordmark'], $css['--text-wordmark--line-height'], $css['--text-wordmark--font-weight'], $css['--text-wordmark--letter-spacing']])->toBe([['24px'], ['28px'], ['750'], ['-0.02em']])
        ->and($css)->not->toHaveKey('--text-heading-2--letter-spacing');
});

it('il README dice gli stili di testo coi nomi che zeiras-token.css porta: ogni `--text-…` del README c\'è nel file, e ci sono tutti e dieci gli stili (sprint 86 · T2.1)', function () {
    $css = variabiliDiRoot(File::get(__DIR__.'/../../resources/css/zeiras-token.css'));
    preg_match('/^\*\*Gli stili di testo\*\*.*?(?=^\*\*`zeiras\.css`\*\*)/ms', File::get(__DIR__.'/../../README.md'), $capoverso);
    preg_match_all('/--text-[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z-]+)?/', $capoverso[0] ?? '', $nomi);
    $stili = collect($css)->keys()->filter(fn (string $nome) => preg_match('/^--text-[a-z0-9-]+$/', $nome) === 1 && ! str_contains(substr($nome, 2), '--'))
        ->map(fn (string $nome) => substr($nome, 7));

    expect($capoverso)->not->toBe([])
        ->and(array_values(array_unique($nomi[0])))->toContain('--text-heading-1', '--text-heading-1--letter-spacing')
        ->and(array_values(array_diff(array_unique($nomi[0]), array_keys($css))))->toBe([])
        ->and($stili->reject(fn (string $stile) => str_contains($capoverso[0], "`{$stile}`"))->values()->all())->toBe([])
        ->and($capoverso[0])->toContain('@theme inline reference', 'npm run token');
});

// Sprint 104 (revisione, R3): ogni gruppo di tokens.json con un elenco di token arriva in zeiras-token.css. Il generatore e l'oracolo
// li nominano a mano: un gruppo nuovo che bundle.css non usa ancora resterebbe fuori senza che il caso T3.1 lo veda (così `border`).
it('ogni gruppo di tokens.json con un elenco di token è letto da scripts/token-css.mjs, e ogni suo token è una variabile di zeiras-token.css (sprint 104)', function () {
    $token = json_decode(File::get(__DIR__.'/../../resources/zeiras/tokens.json'), true, flags: JSON_THROW_ON_ERROR);
    $gruppi = array_keys(array_filter($token, fn (mixed $gruppo) => is_array($gruppo) && isset($gruppo['tokens'])));
    preg_match_all('/\btoken\.([a-zA-Z]+)\b/', File::get(__DIR__.'/../../scripts/token-css.mjs'), $letti);
    $css = variabiliDiRoot(File::get(__DIR__.'/../../resources/css/zeiras-token.css'));
    $nomi = array_merge(...array_map(fn (string $gruppo) => array_map(fn (array $voce) => "--{$voce['name']}", $token[$gruppo]['tokens']), $gruppi));

    expect($gruppi)->toContain('color', 'border')
        ->and(array_values(array_diff($gruppi, $letti[1])))->toBe([])
        ->and(array_values(array_diff($nomi, array_keys($css))))->toBe([]);
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
        ...File::allFiles(__DIR__.'/../../resources/views'),
        ...File::allFiles(__DIR__.'/../../src'),
    ])->reject(fn (SplFileInfo $sorgente) => $sorgente->getRealPath() === realpath(__DIR__.'/../../resources/css/zeiras-token.css'))
        // Sprint 75 · T1.1: i CSS che `npm run componenti` divide da bundle.css sono righe del design system, come il bundle
        // (la CI li confronta con ciò che il bundle genera: una riga scritta a mano lì dentro la ferma).
        // Sprint 92 · T2: anche il bundle intero coi font del pacchetto (resources/css/bundle.css), che la CI confronta allo stesso modo.
        ->reject(fn (SplFileInfo $sorgente) => in_array($sorgente->getRealPath(), [realpath(__DIR__.'/../../resources/css/zeiras.css'), realpath(__DIR__.'/../../resources/css/bundle.css')], true)
            || dirname((string) $sorgente->getRealPath()) === realpath(__DIR__.'/../../resources/css/zeiras'))
        // Voce #3511: anche i moduli JS che `npm run componenti` genera dal bundle, uno per componente, sono righe del design system
        // (la CI li rigenera e li confronta, e un file scritto a mano la ferma). Il modulo unico di prima (299 KB) non lo leggeva
        // nessuno: in `senzaCommenti()` l'espressione esauriva lo stack del JIT, e il file diventava vuoto (i `3px` e `6px` di AgendaGrid).
        ->reject(fn (SplFileInfo $sorgente) => str_ends_with($sorgente->getFilename(), '.js')
            && str_starts_with($sorgente->getContents(), '// Generato da scripts/componenti.mjs: non si ritocca a mano.'));

    expect($file->map->getRelativePathname()->all())->toContain('index.ts', 'zeiras/react-globale.ts', 'favicon.blade.php', 'ZrCoreServiceProvider.php', 'Favicon.php')
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
    // Sprint 104: il contorno del fuoco del design system passa, lo stesso 2px come raggio no.
    File::put("$cartella/e.ts", "export const fuoco = 'outline:2px solid var(--focus)';\n");
    File::put("$cartella/f.ts", "export const angolo = 'border-radius:2px';\n");

    expect(valoriAMano(File::allFiles($cartella)))->toEqualCanonicalizing([
        'a.ts: «#0e5e4e»',
        'b.css: «rgba(»',
        "c.tsx: «{$larghezza}» scritto a mano",
        'f.ts: «2px» scritto a mano',
    ]);
});

it('l\'unico indirizzo di bundle.css è l\'`@import` dei font di Google, che i CSS del pacchetto sostituiscono coi loro (sprint 92); nessuno stile è iniettato da JS, e la CSP minima del README è l\'origine del modulo (T3.3)', function () {
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
        ->toContain("```\nContent-Security-Policy: default-src 'self'\n```");
});
