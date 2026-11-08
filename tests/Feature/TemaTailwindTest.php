<?php

use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;

// Voce #3536 (Decisione 23090 di zr-pm-07): il tema di Tailwind 4 coi nomi dei token, resources/css/zeiras-tailwind.css, esce da
// `npm run token` (scripts/token-css.mjs, con scripts/token-genera.mjs) e la CI lo confronta. Le variabili del tema e una build
// vera di Tailwind 4 le prova vitest (resources/js/zeiras/tailwind.test.ts); qui: lo zip lo porta, e il README dice l'ordine.

it('lo zip del pacchetto porta zeiras-tailwind.css, un `@theme inline reference` (voce 3536 · AC 4)', function () {
    $radice = dirname(__DIR__, 2);
    $attributi = (new Process(['git', 'check-attr', 'export-ignore', '--', 'resources/css/zeiras-tailwind.css'], $radice))->mustRun()->getOutput();

    expect($attributi)->toContain(': export-ignore: unspecified')
        ->and(File::get("$radice/resources/css/zeiras-tailwind.css"))->toContain("@theme inline reference {\n    --color-surface: var(--surface);");
});

it('il README dice come si importa il tema e in che ordine (voce 3536 · AC 5)', function (string $frase) {
    expect(File::get(dirname(__DIR__, 2).'/README.md'))->toContain($frase);
})->with([
    'la versione e il file' => ['**Il tema di Tailwind 4** (dalla `v5.0.0`, #3536): `resources/css/zeiras-tailwind.css`'],
    'l\'ordine' => ["@import '../../vendor/zeiras/zr-core/resources/css/bundle.css';\n@import '../../vendor/zeiras/zr-core/resources/css/zeiras-token.css';\n@import 'tailwindcss';\n@import '../../vendor/zeiras/zr-core/resources/css/zeiras-tailwind.css';"],
    'niente nella pagina' => ['È un `@theme inline reference`: non scrive niente nella pagina'],
    'il blocco del modulo' => ['Un modulo che ha nel suo CSS lo stesso'],
    'le righe che svuotano un gruppo prima del tema' => ['fra `@import \'tailwindcss\'` e il tema del pacchetto'],
    'la riga della versione' => ['| `v5.0.0` | il tema di Tailwind 4 dal pacchetto (#3536)'],
]);
