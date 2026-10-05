<?php

use Illuminate\Support\Facades\File;

// Sprint 1 · T5 (voce #1255). Le lingue della cornice, una per file in resources/lingue: italiano, spagnolo e inglese per partire,
// ognuna con tutti i testi dell'`AppShell` (`AppShellLabels` di index.d.ts) e quelli di zr-core (`products`, `dashboard`).
// L'italiano è quello del design system alla versione di docs/zr-design-system.md: `APPSHELL_LABELS` e il menu di partenza
// di bundle.js. Nessun testo dell'interfaccia sta nel codice TS/TSX: i testi vengono dalle lingue. Il ripiego sull'inglese e le
// lingue scoperte dai file li prova resources/js/lingue.test.ts.

/** @return list<string> le chiavi di `AppShellLabels` in index.d.ts, nel loro ordine */
function chiaviDiAppShellLabels(): array
{
    preg_match('/^export interface AppShellLabels \{([^}]*)\}/m', File::get(__DIR__.'/../../resources/zeiras/index.d.ts'), $trovato);
    preg_match_all('/(\w+)\?: string/', $trovato[1] ?? '', $chiavi);

    return $chiavi[1];
}

/** @return array<string, string> i testi italiani del design system: `APPSHELL_LABELS` e i nomi del menu di partenza di bundle.js */
function testiItalianiDelDesignSystem(): array
{
    $bundle = File::get(__DIR__.'/../../resources/zeiras/bundle.js');
    preg_match('/var APPSHELL_LABELS = \{(.*?)\};/s', $bundle, $trovato);
    preg_match_all("/(\\w+): '((?:[^'\\\\]|\\\\.)*)'/", $trovato[1] ?? '', $coppie, PREG_SET_ORDER);

    $testi = [];
    foreach ($coppie as [, $chiave, $testo]) {
        $testi[$chiave] = (string) preg_replace('/\\\\(.)/s', '$1', $testo);
    }
    // Il titolo del gruppo dei prodotti e la prima voce, la Dashboard, nel menu che l'`AppShell` mostra senza `nav`.
    preg_match("/group: '([^']+)', products: true/", $bundle, $prodotti);
    preg_match("/\\{ id: 'home', label: '([^']+)'/", $bundle, $dashboard);

    return $testi + ['products' => $prodotti[1] ?? '', 'dashboard' => $dashboard[1] ?? ''];
}

/** @return array<string, array<string, mixed>> ogni lingua di resources/lingue, per codice (il nome del file) */
function lingueDellaCornice(): array
{
    $lingue = [];
    foreach (File::glob(__DIR__.'/../../resources/lingue/*.json') as $file) {
        $lingue[basename($file, '.json')] = json_decode(File::get($file), true, flags: JSON_THROW_ON_ERROR);
    }

    return $lingue;
}

/**
 * Cosa non torna nelle tre lingue di partenza: un testo che manca, una chiave che non è della cornice, un testo vuoto, un testo
 * italiano diverso da quello del design system.
 *
 * @param  array<string, array<string, mixed>>  $lingue
 * @return list<string>
 */
function problemiDelleLingue(array $lingue): array
{
    $chiavi = [...chiaviDiAppShellLabels(), 'products', 'dashboard'];

    $problemi = [];
    foreach (['it', 'es', 'en'] as $codice) {
        $testi = $lingue[$codice] ?? [];
        foreach (array_diff($chiavi, array_keys($testi)) as $chiave) {
            $problemi[] = "$codice: manca «{$chiave}»";
        }
        foreach (array_diff(array_keys($testi), $chiavi) as $chiave) {
            $problemi[] = "$codice: «{$chiave}» non è un testo della cornice";
        }
        foreach ($testi as $chiave => $testo) {
            if (! is_string($testo) || trim($testo) === '') {
                $problemi[] = "$codice: «{$chiave}» è vuoto";
            }
        }
    }
    foreach (testiItalianiDelDesignSystem() as $chiave => $testo) {
        if (array_key_exists($chiave, $lingue['it'] ?? []) && $lingue['it'][$chiave] !== $testo) {
            $problemi[] = "it: «{$chiave}» non è il testo del design system";
        }
    }

    return $problemi;
}

/** @return list<array{testo: string, fraDueTag: bool}> le stringhe del codice e i testi fra due tag JSX, fuori dai commenti */
function testiDelCodice(string $codice): array
{
    preg_match_all(
        '~\'((?:[^\'\\\\\n]|\\\\.)*)\'|"((?:[^"\\\\\n]|\\\\.)*)"|`((?:[^`\\\\]|\\\\.)*)`|>([^<>{}]*\pL[^<>{}]*)</~su',
        senzaCommenti($codice),
        $trovati,
        PREG_SET_ORDER | PREG_UNMATCHED_AS_NULL,
    );

    return array_map(fn (array $trovato) => [
        'testo' => trim((string) preg_replace('/\\\\(.)/s', '$1', $trovato[1] ?? $trovato[2] ?? $trovato[3] ?? $trovato[4] ?? '')),
        'fraDueTag' => isset($trovato[4]),
    ], $trovati);
}

/**
 * I testi dell'interfaccia scritti nel codice: una stringa uguale a un testo delle lingue, o un testo fra due tag JSX.
 *
 * @param  list<string>  $testiDelleLingue
 * @return list<string>
 */
function testiScrittiNelCodice(string $codice, array $testiDelleLingue): array
{
    $scritti = [];
    foreach (testiDelCodice($codice) as ['testo' => $testo, 'fraDueTag' => $fraDueTag]) {
        if ($fraDueTag || in_array($testo, $testiDelleLingue, true)) {
            $scritti[] = $testo;
        }
    }

    return $scritti;
}

/**
 * Le lingue elencate a mano nel codice: una stringa uguale al codice di una lingua, o il file di una lingua importato da solo.
 * L'inglese no: è il ripiego di tutte, e si importa apposta.
 *
 * @param  list<string>  $codici
 * @return list<string>
 */
function lingueElencateNelCodice(string $codice, array $codici): array
{
    $elencate = [];
    foreach (testiDelCodice($codice) as ['testo' => $testo, 'fraDueTag' => $fraDueTag]) {
        $file = preg_match('~lingue/([\w-]+)\.json$~', $testo, $lingua) === 1 ? $lingua[1] : null;
        if (! $fraDueTag && (in_array($testo, $codici, true) || ($file !== 'en' && in_array($file, $codici, true)))) {
            $elencate[] = $testo;
        }
    }

    return $elencate;
}

/** @return list<SplFileInfo> il codice TS/TSX di zr-core in resources/js, test esclusi */
function fileDelCodice(): array
{
    return array_values(array_filter(
        File::allFiles(__DIR__.'/../../resources/js'),
        fn (SplFileInfo $file) => in_array($file->getExtension(), ['ts', 'tsx'], true)
            && ! preg_match('/\.test\.tsx?$/', $file->getFilename()),
    ));
}

it('italiano, spagnolo e inglese hanno ogni testo della cornice, e l\'italiano è quello del design system (T5.1)', function () {
    $lingue = lingueDellaCornice();

    expect(array_keys($lingue))->toContain('it', 'es', 'en')
        ->and(problemiDelleLingue($lingue))->toBe([])
        ->and($lingue['it'])->toMatchArray(testiItalianiDelDesignSystem());
});

it('il controllo trova un testo che manca, un testo vuoto e un italiano diverso dal design system (T5.1)', function () {
    $italiano = testiItalianiDelDesignSystem();
    $lingue = lingueDellaCornice();
    unset($lingue['en']['logout']);
    $lingue['es']['retry'] = ' ';
    $lingue['it']['soon'] = 'Fra poco';
    $lingue['it']['ciao'] = 'Ciao';

    // Le letture del design system non sono vuote: chiavi, testi con l'apostrofo, menu di partenza.
    expect(chiaviDiAppShellLabels())->toContain('soon', 'logout', 'crumbs')
        ->and(array_keys($italiano))->toEqualCanonicalizing([...chiaviDiAppShellLabels(), 'products', 'dashboard'])
        ->and($italiano['searchEmptyText'])->toStartWith("Prova con un'altra parola")
        ->and($italiano['products'])->toBe('Prodotti')
        ->and($italiano['dashboard'])->toBe('Dashboard')
        ->and(problemiDelleLingue($lingue))->toEqualCanonicalizing([
            'en: manca «logout»',
            'es: «retry» è vuoto',
            'it: «ciao» non è un testo della cornice',
            'it: «soon» non è il testo del design system',
        ]);
});

it('nessun testo dell\'interfaccia è scritto nel codice TS/TSX di zr-core (T5.4)', function () {
    $testi = array_values(array_unique(array_merge(...array_values(array_map('array_values', lingueDellaCornice())))));

    $scritti = [];
    foreach (fileDelCodice() as $file) {
        foreach (testiScrittiNelCodice(File::get($file->getPathname()), $testi) as $testo) {
            $scritti[] = $file->getFilename().": $testo";
        }
    }

    expect($testi)->toContain('Prodotti', 'Dashboard', 'Esci')
        ->and(array_map(fn (SplFileInfo $file) => $file->getFilename(), fileDelCodice()))->toContain('lingue.ts', 'registro.ts')
        ->and($scritti)->toBe([]);
});

it('le lingue non sono elencate nel codice: una lingua nuova è solo un file in resources/lingue (T5.3)', function () {
    $codici = array_keys(lingueDellaCornice());

    $elencate = [];
    foreach (fileDelCodice() as $file) {
        foreach (lingueElencateNelCodice(File::get($file->getPathname()), $codici) as $codice) {
            $elencate[] = $file->getFilename().": $codice";
        }
    }

    expect($codici)->toContain('it', 'es', 'en')
        ->and($elencate)->toBe([]);
});

it('il controllo trova i testi e le lingue scritti nel codice, non quelli citati nei commenti (T5.3, T5.4)', function () {
    $codice = <<<'TS'
        // la voce «Prodotti» e 'Esci' in un commento non si vedono
        import italiano from '../lingue/it.json';
        import inglese from '../lingue/en.json';
        const file = import.meta.glob('../lingue/*.json');
        const gruppo = 'Prodotti';
        /* 'Dashboard' in un commento */
        const voce = `Dashboard`;
        const chiave = 'dashboard';
        const lingue = ['it', 'es'];
        export const Esci = () => <button type="button">Esci</button>;
        export const Saluto = () => <p className="saluto">
            Benvenuto
        </p>;
        TS;

    expect(testiScrittiNelCodice($codice, ['Prodotti', 'Dashboard', 'Esci']))
        ->toBe(['Prodotti', 'Dashboard', 'Esci', 'Benvenuto'])
        ->and(lingueElencateNelCodice($codice, ['it', 'es', 'en']))->toBe(['../lingue/it.json', 'it', 'es']);
});
