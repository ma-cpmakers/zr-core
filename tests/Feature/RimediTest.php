<?php

use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;

// Voce #3887 (Decisione 25420 di zr-pm-74, da zr-cashflow): i rimedi provvisori al CSS del design system stanno in
// resources/css/rimedi.css, scritto a mano, che bundle.css e zeiras.css importano sotto avanzamento.css. Il primo: il titolo
// della SectionCard con una parola senza spazi va a capo (richiesta 290). La regola e gli import li prova vitest
// (resources/js/zeiras/stili.test.ts); qui: lo zip li porta, e il README dice che un modulo può togliere la sua regola.

it('lo zip del pacchetto porta rimedi.css, e bundle.css e zeiras.css lo importano sotto avanzamento.css (voce 3887 · AC 2)', function () {
    $radice = dirname(__DIR__, 2);
    $attributi = (new Process(['git', 'check-attr', 'export-ignore', '--', 'resources/css/rimedi.css'], $radice))->mustRun()->getOutput();

    expect($attributi)->toContain(': export-ignore: unspecified')
        ->and(File::get("$radice/resources/css/rimedi.css"))->toContain('.zr-section-card-title { overflow-wrap: anywhere; }');
    foreach (['bundle.css', 'zeiras.css'] as $css) {
        $righe = explode("\n", File::get("$radice/resources/css/$css"));

        expect(array_slice($righe, 1, 4))->toBe(["@import './font.css';", "@import './movimento.css';", "@import './avanzamento.css';", "@import './rimedi.css';"]);
    }
});

it('il README dice il rimedio, la richiesta che lo toglie e che un modulo può togliere la sua regola (voce 3887 · AC 3)', function (string $frase) {
    expect(File::get(dirname(__DIR__, 2).'/README.md'))->toContain($frase);
})->with([
    'il titolo' => ['**Rimedi provvisori al design system** (dalla `v4.35.0`, #3887)'],
    'il file' => ['`resources/css/rimedi.css`, che `bundle.css` e `zeiras.css` importano sotto `avanzamento.css`'],
    'la richiesta' => ['a 390 px la pagina non scorre di lato (richiesta'],
    'la riga della versione' => ['va a capo, e a 390 px la pagina non scorre di lato (#3887)'],
    'il modulo toglie la regola' => ['Un modulo che ha scritto la stessa regola nel suo CSS la può togliere: arriva dal pacchetto.'],
]);

// Voce #3888 (richiesta 278, zr-crm-14; zr-pm-74 15/11): il secondo rimedio, lo scroll-padding dei contenitori che scorrono,
// che lascia all'anello del fuoco i suoi 4 px; sta nello stesso file, e il README lo dice.
it('rimedi.css porta lo scroll-padding dei contenitori che scorrono, e il README lo dice (voce 3888 · AC 3)', function () {
    $radice = dirname(__DIR__, 2);

    expect(File::get("$radice/resources/css/rimedi.css"))
        ->toContain('.zr-detail-body, .zr-table-scroll, .zr-seg, .zr-main { scroll-padding: var(--space-1); }')
        ->and(File::get("$radice/README.md"))
        ->toContain('Il secondo (#3888, richiesta 278, da zr-crm)')
        ->toContain('si ferma a 4 px dal bordo invece che a filo');
});
