<?php

use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;

// Voce #3535 (Decisione 23090 di zr-pm-07): la barra d'avanzamento di Inertia dal pacchetto. Inertia la disegna con un `<style>`
// suo, che la CSP di tutti ferma; un modulo le chiede `progress: { includeCSS: false }` e gli stili arrivano da
// resources/css/avanzamento.css, scritto a mano, che bundle.css e zeiras.css importano sotto i font. Le regole e gli import li
// prova vitest (resources/js/zeiras/stili.test.ts); qui: lo zip li porta, e il README dice come si usa.

it('lo zip del pacchetto porta avanzamento.css, e bundle.css e zeiras.css lo importano sotto movimento.css (voce 3535 · AC 5)', function () {
    $radice = dirname(__DIR__, 2);
    $attributi = (new Process(['git', 'check-attr', 'export-ignore', '--', 'resources/css/avanzamento.css'], $radice))->mustRun()->getOutput();

    expect($attributi)->toContain(': export-ignore: unspecified')
        ->and(File::get("$radice/resources/css/avanzamento.css"))->toContain('#nprogress .bar {');
    foreach (['bundle.css', 'zeiras.css'] as $css) {
        $righe = explode("\n", File::get("$radice/resources/css/$css"));

        expect(array_slice($righe, 1, 3))->toBe(["@import './font.css';", "@import './movimento.css';", "@import './avanzamento.css';"]);
    }
});

it('il README dice come si usa la barra del pacchetto e che un modulo può togliere le sue regole (voce 3535 · AC 5)', function (string $frase) {
    expect(File::get(dirname(__DIR__, 2).'/README.md'))->toContain($frase);
})->with([
    'la versione e il file' => ['Dalla `v4.32.0` (#3535) gli stili della barra arrivano dal pacchetto: `resources/css/avanzamento.css`'],
    'includeCSS: false' => ['    progress: { includeCSS: false },'],
    'niente color' => ['Il modulo non passa `color`, che non serve più'],
    'il modulo toglie le sue regole' => ['Un modulo che ha scritto nel suo CSS le regole di `#nprogress` le può togliere'],
    'la CSP non si allarga' => ['sorgente in più nella CSP: niente `\'unsafe-inline\'`, niente hash.'],
    'la riga della versione' => ['| `v4.32.0` | la barra d\'avanzamento di Inertia dal pacchetto (#3535)'],
]);
