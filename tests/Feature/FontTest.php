<?php

use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;

// Sprint 92 · T1 (voce #2945, Decisione 19881 di zr-pm): i due font del design system, Bricolage Grotesque e Instrument Sans,
// arrivano dal pacchetto e non da Google Fonts: così una visita a un'app di Zeiras non manda l'IP della persona a Google. Sono i
// cinque woff2 che Google serviva per l'`@import` di bundle.css (gli stessi file: le pagine si vedono uguali), con le due
// licenze OFL, in resources/fonts/; resources/css/font.css ne dà le `@font-face`, coi descrittori di Google e gli indirizzi
// relativi. Qui si guarda che file e regole si corrispondano, che lo zip li porti e che le famiglie e i pesi che il bundle chiede
// ci siano tutti: un design system che cambia font fa rosso qui, prima che una pagina li perda.

/** @return array<string, string> il nome di ogni woff2 di resources/fonts → il suo percorso */
function woff2DelPacchetto(): array
{
    $file = [];
    foreach (File::files(dirname(__DIR__, 2).'/resources/fonts') as $font) {
        if ($font->getExtension() === 'woff2') {
            $file[$font->getFilename()] = $font->getPathname();
        }
    }
    ksort($file);

    return $file;
}

/** @return list<array<string, string>> le `@font-face` di un CSS, ognuna coi suoi descrittori (nome → valore, com'è scritto) */
function regoleFontFace(string $css): array
{
    preg_match_all('/@font-face\s*\{([^}]*)\}/', (string) preg_replace('#/\*.*?\*/#s', '', $css), $regole);

    return array_map(function (string $corpo): array {
        $descrittori = [];
        foreach (array_filter(array_map('trim', explode(';', $corpo))) as $riga) {
            [$nome, $valore] = array_map('trim', explode(':', $riga, 2));
            $descrittori[$nome] = $valore;
        }

        return $descrittori;
    }, $regole[1]);
}

function cssDeiFont(): string
{
    return File::get(dirname(__DIR__, 2).'/resources/css/font.css');
}

// T1.1

it('font.css ha una `@font-face` per ogni woff2 di resources/fonts, e ogni sua `@font-face` usa un woff2 che c\'è: cinque in tutto (sprint 92 · T1.1)', function () {
    $usati = array_map(function (array $regola): string {
        expect($regola['src'] ?? '')->toMatch('/^url\(\'\.\.\/fonts\/[a-z0-9-]+\.woff2\'\) format\(\'woff2\'\)$/');
        preg_match('/fonts\/([a-z0-9-]+\.woff2)/', $regola['src'], $nome);

        return $nome[1];
    }, regoleFontFace(cssDeiFont()));
    sort($usati);

    expect($usati)->toBe(array_keys(woff2DelPacchetto()))
        ->and($usati)->toHaveCount(5);
});

// T1.2

it('i woff2 sono woff2, e lo zip del pacchetto porta loro, font.css e le due licenze OFL (sprint 92 · T1.2)', function () {
    $radice = dirname(__DIR__, 2);
    foreach (woff2DelPacchetto() as $percorso) {
        expect(substr((string) file_get_contents($percorso), 0, 4))->toBe('wOF2');
    }
    foreach (['OFL-BricolageGrotesque.txt', 'OFL-InstrumentSans.txt'] as $licenza) {
        expect(File::get("$radice/resources/fonts/$licenza"))->toContain('SIL Open Font License, Version 1.1');
    }

    $nelloZip = [...array_map(fn (string $nome): string => "resources/fonts/$nome", array_keys(woff2DelPacchetto())), 'resources/fonts/OFL-BricolageGrotesque.txt', 'resources/fonts/OFL-InstrumentSans.txt', 'resources/css/font.css'];
    $attributi = (new Process(['git', 'check-attr', 'export-ignore', '--', ...$nelloZip], $radice))->mustRun()->getOutput();

    expect(substr_count($attributi, ': export-ignore: unspecified'))->toBe(count($nelloZip));
});

// T1.3

it('font.css non nomina nessun indirizzo esterno: i font si prendono solo dal pacchetto (sprint 92 · T1.3)', function () {
    expect(cssDeiFont())->not->toContain('https:')
        ->and(cssDeiFont())->not->toContain('http:')
        ->and(cssDeiFont())->not->toContain('//');
});

// T1.4

it('famiglie, pesi e assi che l\'`@import` del bundle chiedeva a Google ci sono tutti in font.css, con `font-display: swap` (sprint 92 · T1.4)', function () {
    $bundle = File::get(dirname(__DIR__, 2).'/resources/zeiras/bundle.css');
    preg_match('/@import url\(\'https:\/\/fonts\.googleapis\.com\/css2\?([^\']+)\'\)/', $bundle, $import);
    expect($import)->not->toBeEmpty();

    // `family=Nome+Con+Spazi:assi@valori`, una per famiglia; il peso è l'ultimo intervallo dei valori (l'asse `wght` è l'ultimo).
    preg_match_all('/family=([^:&]+):([a-z,]+)@([^&]+)/', $import[1], $famiglie, PREG_SET_ORDER);
    expect($famiglie)->toHaveCount(2);

    $regole = regoleFontFace(cssDeiFont());
    foreach ($famiglie as [, $nome, $assi, $valori]) {
        $famiglia = str_replace('+', ' ', $nome);
        $sue = array_values(array_filter($regole, fn (array $regola): bool => ($regola['font-family'] ?? '') === "'$famiglia'"));
        $pesi = explode(',', $valori);
        $peso = str_replace('..', ' ', end($pesi));

        expect($sue)->not->toBeEmpty();
        foreach ($sue as $regola) {
            expect($regola['font-weight'] ?? null)->toBe($peso)
                ->and($regola['font-display'] ?? null)->toBe('swap')
                ->and($regola['font-style'] ?? null)->toBe('normal');
        }
        // `opsz` non è un descrittore di `@font-face`: lo porta il file, che è uno solo per sottoinsieme anche lì.
        expect(explode(',', $assi))->each->toBeIn(['opsz', 'wght']);
    }
});
