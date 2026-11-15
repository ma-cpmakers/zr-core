<?php

use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;

// Voce #3723 (sì di zr-pm-97, 13/11): la fascia di assistenza come nel design di admin, una barra citrus a tutta larghezza sopra
// l'AppShell e non più un Alert nel contenuto. Gli stili stanno in resources/css/assistenza.css, scritto a mano, che importa il
// pezzo degli avvisi e non il CSS di ogni pagina (zr-pm-74, 14/11). Le regole e gli import li prova vitest (resources/js/zeiras/stili.test.ts), la barra
// e il suo posto nell'albero anche (resources/js/avvisi-a-richiesta.test.tsx); qui: lo zip porta il file, i CSS generati lo
// importano, i testi del pulsante sono quelli del design, e il README dice dove sta la fascia.

it('lo zip del pacchetto porta assistenza.css, che importa il pezzo degli avvisi, e bundle.css e zeiras.css non lo importano (voce 3723 · AC 1)', function () {
    $radice = dirname(__DIR__, 2);
    $attributi = (new Process(['git', 'check-attr', 'export-ignore', '--', 'resources/css/assistenza.css'], $radice))->mustRun()->getOutput();

    expect($attributi)->toContain(': export-ignore: unspecified')
        ->and(File::get("$radice/resources/css/assistenza.css"))->toContain('.zr-assist-bar {');
    foreach (['bundle.css', 'zeiras.css'] as $css) {
        $righe = explode("\n", File::get("$radice/resources/css/$css"));

        expect(array_slice($righe, 1, 3))->toBe(["@import './font.css';", "@import './movimento.css';", "@import './avanzamento.css';"])
            ->and(implode("\n", $righe))->not->toContain('assistenza.css');
    }
    expect(File::get("$radice/resources/js/avvisi.ts"))->toContain("\nimport '../css/assistenza.css';\n");
});

it('il pulsante della fascia dice «Termina e torna al backoffice» nelle tre lingue degli avvisi, e la riga piccola non ripete più l\'email (voce 3723 · AC 2)', function (string $lingua, string $pulsante, string $modifiche, string $solaLettura) {
    $testi = json_decode((string) File::get(dirname(__DIR__, 2)."/resources/lingue/avvisi/$lingua.json"), true);

    expect($testi['assistEnd'])->toBe($pulsante)
        ->and($testi['assistText'])->toBe($modifiche)
        ->and($testi['assistReadOnly'])->toBe($solaLettura)
        ->and($testi['assistTitle'])->toContain('{name}')
        ->and($testi['assistText'].$testi['assistReadOnly'])->not->toContain('{email}');
})->with([
    'italiano' => ['it', 'Termina e torna al backoffice', 'Le modifiche che fai valgono come fatte da {firstName}', 'Sola lettura: puoi guardare, non modificare'],
    'spagnolo' => ['es', 'Terminar y volver al backoffice', 'Los cambios que hagas cuentan como hechos por {firstName}', 'Solo lectura: puedes mirar, no modificar'],
    'inglese' => ['en', 'End and return to the backoffice', 'Changes you make count as made by {firstName}', 'Read only: you can look, not change'],
]);

it('il README dice dove sta la fascia di assistenza e come si prova (voce 3723 · AC 1, 2)', function (string $frase) {
    expect(File::get(dirname(__DIR__, 2).'/README.md'))->toContain($frase);
})->with([
    'la versione e il posto' => ['Dalla `v4.34.0` (#3723) è come nel design di admin: una barra citrus a tutta larghezza **sopra l\'`AppShell`**'],
    'il pulsante' => ['backoffice», che chiama `onLogout` come «Esci»'],
    'il file' => ['`resources/css/assistenza.css`, scritto a mano, che il pezzo degli avvisi importa: arriva solo in assistenza'],
    'senza assistenza nessuna barra' => ['che c\'è solo in assistenza: senza, nessuna'],
    'il cassetto sotto la barra, scostamento dal design' => ['di admin, dove la barra copre la cima del cassetto (decisione di zr-pm-97 del 13/11); lo fa `assistenza.css`, ancorando'],
    'la riga della versione' => ['| `v4.34.0` | la fascia di assistenza come nel design di admin (#3723)'],
]);
