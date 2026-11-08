<?php

use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;

// Voce #3534 (Decisione 23090 di zr-pm-07): chi chiede al sistema meno movimento non ha transizioni in nessuna pagina che carica
// il CSS del pacchetto. La regola sta in resources/css/movimento.css, scritto a mano, che bundle.css e zeiras.css importano subito
// dopo i font; che la regola sia quella e che i due la importino lo prova vitest (resources/js/zeiras/stili.test.ts), che legge
// anche lo script che li genera. Qui: lo zip la porta, e il README dice ai moduli che arriva dal pacchetto.

it('lo zip del pacchetto porta movimento.css, e bundle.css e zeiras.css lo importano subito dopo i font (voce 3534 · AC 4)', function () {
    $radice = dirname(__DIR__, 2);
    $attributi = (new Process(['git', 'check-attr', 'export-ignore', '--', 'resources/css/movimento.css'], $radice))->mustRun()->getOutput();

    expect($attributi)->toContain(': export-ignore: unspecified')
        ->and(File::get("$radice/resources/css/movimento.css"))->toContain('@media (prefers-reduced-motion: reduce)');
    foreach (['bundle.css', 'zeiras.css'] as $css) {
        $righe = explode("\n", File::get("$radice/resources/css/$css"));

        expect(array_slice($righe, 1, 2))->toBe(["@import './font.css';", "@import './movimento.css';"]);
    }
});

it('il README dice che la regola arriva dal pacchetto e che un modulo può togliere la sua (voce 3534 · AC 5)', function (string $frase) {
    expect(File::get(dirname(__DIR__, 2).'/README.md'))->toContain($frase);
})->with([
    'il titolo' => ['**Meno movimento** (dalla `v4.32.0`, #3534)'],
    'il file' => ['La regola sta in `resources/css/movimento.css`, che `bundle.css`'],
    'la preferenza' => ['(`prefers-reduced-motion: reduce`)'],
    'il modulo che la toglie' => ['Un modulo che ha scritto la stessa'],
    'la riga della versione' => ['| `v4.32.0` | meno movimento dal pacchetto (#3534)'],
]);
