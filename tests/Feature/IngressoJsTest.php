<?php

// Sprint 1 · T2 (voce #1254). L'ingresso JS di zr-core: React resta fuori dal build (lo porta il frontend: due copie di React
// rompono gli hook). Legge dist/zr-core.js, che la CI costruisce prima di Pest. Sprint 25 · T1 (voce #1759): i componenti del
// design system entrano nel build dal modulo generato (resources/js/zeiras/componenti.js), che importa React da sé. Il bundle
// (resources/zeiras/bundle.js), che leggeva `window.React` quando si valutava e scriveva `window.Zeiras`, nel build non c'è più:
// se ci fosse accanto al modulo, un'app avrebbe due copie del design system. `window.React` e `window.Zeiras` li scrive ancora
// l'ingresso, una volta sola: un frontend può leggerli.

/** Il build del pacchetto. */
function buildDelPacchetto(): string
{
    $file = __DIR__.'/../../dist/zr-core.js';
    if (! is_file($file)) {
        throw new RuntimeException('dist/zr-core.js manca: la CI fa `npm run build` prima di Pest, in locale si lancia a mano');
    }

    return (string) file_get_contents($file);
}

/**
 * Dove il codice scrive `window.React`, dove il bundle del design system lo leggerebbe, e dove si scrive `window.Zeiras`, in byte
 * dall'inizio.
 *
 * @return array{scritture: list<int>, letture: list<int>, zeiras: list<int>}
 */
function usiDiWindowReact(string $codice): array
{
    $posizioni = function (string $regex) use ($codice): array {
        preg_match_all($regex, $codice, $trovati, PREG_OFFSET_CAPTURE);

        return array_column($trovati[0], 1);
    };

    return [
        'scritture' => $posizioni('/\bwindow\.React\s*=(?!=)/'),
        'letture' => $posizioni('/\bvar\s+[\w$]+\s*=\s*window\.React\b(?!\s*=)/'),
        'zeiras' => $posizioni('/\bwindow\.Zeiras\s*=\s*Object\.assign\(/'),
    ];
}

it('nel build window.React e window.Zeiras sono scritti una volta sola, e il bundle del design system non c\'è: nessun codice legge window.React (sprint 25 · T1.4)', function () {
    $usi = usiDiWindowReact(buildDelPacchetto());

    expect($usi['scritture'])->toHaveCount(1)
        ->and($usi['letture'])->toBe([])
        ->and($usi['zeiras'])->toHaveCount(1);
});

it('il controllo trova il bundle rimasto nel build accanto al modulo: una lettura di window.React, e window.Zeiras scritto due volte (sprint 25 · T1.4)', function () {
    $bundle = "(function () {\n  var React = window.React;\n  window.Zeiras = Object.assign(window.Zeiras || {}, {});\n})();\n";
    $ingresso = "import * as e from \"react\";\nwindow.React = e;\nwindow.Zeiras = Object.assign(window.Zeiras || {}, t);\n";

    $solo = usiDiWindowReact($ingresso);
    $colBundle = usiDiWindowReact($ingresso.$bundle);

    expect($solo['scritture'])->toHaveCount(1)
        ->and($solo['letture'])->toBe([])
        ->and($solo['zeiras'])->toHaveCount(1)
        ->and($colBundle['letture'])->toHaveCount(1)
        ->and($colBundle['zeiras'])->toHaveCount(2)
        ->and(usiDiWindowReact('if (window.React == null) {}')['scritture'])->toBe([]);
});

it('React resta fuori dal build: il pacchetto lo importa dal frontend e non ne porta una copia (T2.1)', function () {
    $build = buildDelPacchetto();

    expect($build)->toMatch('/\bfrom\s*["\']react["\']/')
        // Un nome interno di React che il minificatore non tocca: c'è solo se il codice di React è dentro il build.
        ->not->toContain('__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE');
});
