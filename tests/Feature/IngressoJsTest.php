<?php

// Sprint 1 · T2 (voce #1254). L'ingresso JS di zr-core: il bundle del design system legge `window.React` quando si valuta, quindi
// nel build del pacchetto l'assegnazione viene prima del codice del bundle; il bundle c'è una volta sola, e React resta fuori dal
// build (lo porta il frontend: due copie di React rompono gli hook). Legge dist/zr-core.js, che la CI costruisce prima di Pest.

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
 * Dove il codice scrive `window.React` e dove il bundle del design system lo legge e scrive `window.Zeiras`, in byte dall'inizio.
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

it('nel build l\'assegnazione di window.React viene prima del codice del bundle, che c\'è una volta sola (T2.1)', function () {
    $usi = usiDiWindowReact(buildDelPacchetto());

    expect($usi['scritture'])->toHaveCount(1)
        ->and($usi['letture'])->toHaveCount(1)
        ->and($usi['zeiras'])->toHaveCount(1)
        ->and($usi['scritture'][0])->toBeLessThan($usi['letture'][0]);
});

it('il controllo trova window.React scritto dopo il bundle, e il bundle incluso due volte (T2.1)', function () {
    $bundle = "(function () {\n  var React = window.React;\n  window.Zeiras = Object.assign(window.Zeiras || {}, {});\n})();\n";
    $scrittura = "import * as e from \"react\";\nwindow.React = e;\n";

    $dopo = usiDiWindowReact($bundle.$scrittura);
    $doppio = usiDiWindowReact($scrittura.$bundle.$bundle);

    expect($dopo['scritture'][0])->toBeGreaterThan($dopo['letture'][0])
        ->and($doppio['letture'])->toHaveCount(2)
        ->and($doppio['zeiras'])->toHaveCount(2)
        ->and(usiDiWindowReact('if (window.React == null) {}')['scritture'])->toBe([]);
});

it('React resta fuori dal build: il pacchetto lo importa dal frontend e non ne porta una copia (T2.1)', function () {
    $build = buildDelPacchetto();

    expect($build)->toMatch('/\bfrom\s*["\']react["\']/')
        // Un nome interno di React che il minificatore non tocca: c'è solo se il codice di React è dentro il build.
        ->not->toContain('__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE');
});
