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
        ->and(File::get("$radice/resources/css/rimedi.css"))->not->toContain('.zr-section-card-title');
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
it('lo scroll-padding dei contenitori che scorrono non sta più in rimedi.css, e il README lo dice (voce 3888 · AC 3; dalla v5.7.0, voce 4089)', function () {
    $radice = dirname(__DIR__, 2);

    expect(File::get("$radice/resources/css/rimedi.css"))
        ->not->toContain('.zr-detail-body, .zr-table-scroll, .zr-seg, .zr-main, .zr-main-body { scroll-padding: var(--space-1); }')
        ->and(File::get("$radice/README.md"))
        ->toContain('Il secondo (#3888, richiesta 278, da zr-crm)')
        ->toContain('si ferma a 4 px dal bordo invece che a filo');
});

// Voce #3889 (richieste 288 e 279; zr-pm-74 15/11): coi colori forzati la voce attiva del menu e il segmento scelto hanno un
// contorno, e il campo Cerca chiuso si distingue dalla barra; nello stesso file, e il README lo dice.
it('i contorni coi colori forzati e quello del campo Cerca non stanno più in rimedi.css, e il README lo dice (voce 3889 · AC 4; dalla v5.7.0, voce 4089)', function () {
    $radice = dirname(__DIR__, 2);

    expect(File::get("$radice/resources/css/rimedi.css"))
        ->not->toContain('.zr-nav-item.is-active:not(:focus-visible), .zr-seg-item.is-active:not(:focus-visible) { outline: var(--border-ring) solid Highlight; outline-offset: calc(-1 * var(--border-ring)); }')
        ->not->toContain('.zr-search { box-shadow: inset 0 0 0 1px var(--line-strong); }')
        ->and(File::get("$radice/README.md"))
        ->toContain('Il terzo e il quarto (#3889, richieste 288 e 279')
        ->toContain('4,04:1 sulla barra, e coi colori forzati un contorno vero');
});

// Voce #3890 (richiesta 283; zr-pm-74 15/11): sotto i 720 px, con la ricerca aperta, le azioni della barra si stringevano sotto il
// campo e non allargavano la pagina. Dalla v5.8.0 (voce #4095, lotto 0530) lo fa il design system: le azioni vanno nel cassetto.
it('le azioni della barra sotto la ricerca aperta non stanno più in rimedi.css, e il README lo dice (voce 3890; dalla v5.8.0, voce 4095)', function () {
    $radice = dirname(__DIR__, 2);

    expect(File::get("$radice/resources/css/rimedi.css"))
        ->not->toContain('.zr-top-actions { min-width: 0; overflow: hidden; }')
        ->and(File::get("$radice/README.md"))
        ->toContain('Il quinto (#3890, richiesta 283')
        ->toContain('in cima al cassetto, e il rimedio è uscito da `rimedi.css`.')
        ->not->toContain('A ricerca chiusa la barra aspetta la richiesta.');
});

// Voce #3891 (richiesta 291; zr-pm-74 15/11): l'anello del fuoco su «Annulla» e sulla ✕ del Toast ha il colore del testo del
// Toast, che sullo sfondo del Toast passa i 3:1 in tutti e due i temi.
it('l\'anello del fuoco nel Toast non sta più in rimedi.css, e il README lo dice (voce 3891; dalla v5.7.0, voce 4089)', function () {
    $radice = dirname(__DIR__, 2);

    expect(File::get("$radice/resources/css/rimedi.css"))
        ->not->toContain('.zr-toast :is(.zr-toast-action, .zr-toast-close):focus-visible { outline-color: var(--surface); }')
        ->and(File::get("$radice/README.md"))
        ->toContain('Il sesto (#3891, richiesta 291')
        ->toContain('il colore del testo del Toast');
});

// Voci #3948-#3951 (richieste 272, 273, 242 e 298; Decisione 25922 di zr-pm-74, v5.5.0): al tocco la casella di riga della
// DataTable, le azioni che vanno a capo, lo Switch e il campo della ricerca si prendono su 44 px; col mouse niente cambia.
it('le quattro aree da 44 px al tocco non stanno più in rimedi.css, e il README le dice (voci 3948-3951; dalla v5.7.0, voce 4089)', function () {
    $radice = dirname(__DIR__, 2);

    expect(File::get("$radice/resources/css/rimedi.css"))
        ->not->toContain('.zr-td-check .zr-check::after')
        ->not->toContain('{ row-gap: var(--space-3); }')
        ->not->toContain('button.zr-switch { min-height: 44px; }')
        ->not->toContain('.zr-top .zr-search { height: 44px; }')
        ->and(File::get("$radice/README.md"))
        ->toContain('Dal nono al dodicesimo (#3948-#3951')
        ->toContain('Col mouse niente cambia.');
});

// Voci #4055-#4057 (richieste 302, 304 e 305; zr-pm-a0 21/11, v5.5.0): il contesto del DetailPanel va a capo; al tocco
// l'ordinamento della DataTable si prende su 44 px e le azioni del pannello stanno a 12 px; col mouse quelle due non cambiano.
it('il contesto del pannello, l\'ordinamento e le azioni del pannello al tocco non stanno più in rimedi.css, e il README li dice (voci 4055-4057; dalla v5.7.0, voce 4089)', function () {
    $radice = dirname(__DIR__, 2);

    expect(File::get("$radice/resources/css/rimedi.css"))
        ->not->toContain('.zr-detail-head > .zr-detail-ctx { white-space: normal;')
        ->not->toContain('table.zr-table th { height: 44px; }')
        ->not->toContain('.zr-th-sort::after')
        ->not->toContain('div.zr-detail-actions { gap: var(--space-3); }')
        ->and(File::get("$radice/README.md"))
        ->toContain('Dal tredicesimo al quindicesimo (#4055-#4057')
        ->toContain('mouse l\'ordinamento e le azioni non cambiano.');
});

// Voce #4089 (lotto 0529 del design system, Decisione di zr-pm-a0 del 21/11): dalla v5.7.0 tredici rimedi li porta il design system;
// in rimedi.css restano quelli delle richieste aperte (283, 293, 294, 299), e il README dice quali sono usciti e con quale tag.
it('il README dice che dalla v5.7.0 tredici rimedi li porta il design system, col tag, e quali restano (voce 4089)', function () {
    $readme = File::get(dirname(__DIR__, 2).'/README.md');

    expect($readme)
        ->toContain('**Dalla `v5.7.0` tredici rimedi li porta il design system** (#4089, lotto 0529, `ds-')
        ->toContain('In `rimedi.css` restavano il quinto (283), il settimo (299) e quelli')
        ->not->toContain('DS_TAG');
});

// Voce #4095 (lotto 0530 del design system, Decisione di zr-pm-a0 del 21/11): dalla v5.8.0 esce anche il rimedio della 283; in
// rimedi.css restano quelli delle richieste 293, 294 e 299.
it('il README dice che dalla v5.8.0 esce anche il quinto rimedio, col tag, e quali restano (voce 4095)', function () {
    $radice = dirname(__DIR__, 2);

    expect(File::get("$radice/README.md"))
        ->toContain('**Dalla `v5.8.0` esce anche il quinto** (#4095, lotto 0530,')
        ->toContain('`ds-1795297647-ba18`): in `rimedi.css` restano il settimo (299) e quelli del dito (293 e 294).')
        ->not->toContain('In `rimedi.css` restano il quinto (283)')
        ->and(File::get("$radice/resources/css/rimedi.css"))
        ->toContain('Richiesta 293')
        ->toContain('Richiesta 299')
        ->not->toContain('Richiesta 283');
});
