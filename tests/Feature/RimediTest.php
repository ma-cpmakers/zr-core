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

        // Dalla `v5.0.0` (voce #3538) la prima riga è quella dell'ordine degli strati, la seconda il commento che dice il file generato;
        // i rimedi entrano nello strato del design system, e una classe di utilità del modulo li supera come supera le sue regole.
        expect($righe[0])->toBe('@layer theme, base, zeiras, components, utilities;')
            ->and(array_slice($righe, 2, 4))->toBe(["@import './font.css';", "@import './movimento.css';", "@import './avanzamento.css';", "@import './rimedi.css' layer(zeiras);"]);
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
        ->toContain('.zr-detail-body, .zr-table-scroll, .zr-seg, .zr-main, .zr-main-body { scroll-padding: var(--space-1); }')
        ->and(File::get("$radice/README.md"))
        ->toContain('Il secondo (#3888, richiesta 278, da zr-crm)')
        ->toContain('si ferma a 4 px dal bordo invece che a filo');
});

// Voce #3889 (richieste 288 e 279; zr-pm-74 15/11): coi colori forzati la voce attiva del menu e il segmento scelto hanno un
// contorno, e il campo Cerca chiuso si distingue dalla barra; nello stesso file, e il README lo dice.
it('rimedi.css porta i contorni coi colori forzati e quello del campo Cerca, e il README lo dice (voce 3889 · AC 4)', function () {
    $radice = dirname(__DIR__, 2);

    expect(File::get("$radice/resources/css/rimedi.css"))
        ->toContain('.zr-nav-item.is-active:not(:focus-visible), .zr-seg-item.is-active:not(:focus-visible) { outline: var(--border-ring) solid Highlight; outline-offset: calc(-1 * var(--border-ring)); }')
        ->toContain('.zr-search { box-shadow: inset 0 0 0 1px var(--line-strong); }')
        ->and(File::get("$radice/README.md"))
        ->toContain('Il terzo e il quarto (#3889, richieste 288 e 279')
        ->toContain('4,04:1 sulla barra, e coi colori forzati un contorno vero');
});

// Voce #3890 (richiesta 283; zr-pm-74 15/11): sotto i 720 px, con la ricerca aperta, le azioni della barra si stringono sotto il
// campo e non allargano la pagina; restano nel giro del Tab (#2805).
it('rimedi.css stringe le azioni della barra sotto la ricerca aperta, e il README lo dice (voce 3890 · AC 3)', function () {
    $radice = dirname(__DIR__, 2);

    expect(File::get("$radice/resources/css/rimedi.css"))
        ->toContain('.zr-top:has(.zr-search.is-open) .zr-top-actions { min-width: 0; overflow: hidden; }')
        ->and(File::get("$radice/README.md"))
        ->toContain('Il quinto (#3890, richiesta 283')
        ->toContain('A ricerca chiusa la barra aspetta la richiesta.');
});

// Voce #3891 (richiesta 291; zr-pm-74 15/11): l'anello del fuoco su «Annulla» e sulla ✕ del Toast ha il colore del testo del
// Toast, che sullo sfondo del Toast passa i 3:1 in tutti e due i temi.
it('rimedi.css dà all\'anello del fuoco nel Toast il colore del suo testo, e il README lo dice (voce 3891)', function () {
    $radice = dirname(__DIR__, 2);

    expect(File::get("$radice/resources/css/rimedi.css"))
        ->toContain('.zr-toast :is(.zr-toast-action, .zr-toast-close):focus-visible { outline-color: var(--surface); }')
        ->and(File::get("$radice/README.md"))
        ->toContain('Il sesto (#3891, richiesta 291')
        ->toContain('il colore del testo del Toast');
});
