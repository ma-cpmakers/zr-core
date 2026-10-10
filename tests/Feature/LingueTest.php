<?php

use Illuminate\Support\Facades\File;

// Sprint 1 · T5 e T7 (voce #1255). Le lingue della cornice, una per file in resources/lingue: italiano, spagnolo e inglese per
// partire, ognuna con tutti i testi dell'`AppShell` (`AppShellLabels` di index.d.ts) e quelli di zr-core (`products`, `dashboard`,
// `notificationTitle` e il nome di ogni prodotto del registro, con l'id per chiave: T7, decisione 5926 di Luciano; dallo sprint 3 ·
// T5 anche il nome di ogni tipo di risorsa del registro, il gruppo dei risultati della ricerca, con `<prodotto>.<tipo>` per chiave). L'italiano è quello del design system
// delle copie in resources/zeiras/: `APPSHELL_LABELS` e il menu di partenza di bundle.js. Nessun testo dell'interfaccia sta
// nel codice TS/TSX: i testi vengono dalle lingue. Il ripiego sull'inglese e le lingue scoperte dai file li prova
// resources/js/lingue.test.ts. Sprint 12 · T3 (voce #1463): di zr-core sono anche il titolo di ogni tipo di notifica, con
// `notificationTitle.<tipo>` per chiave (`notificationTitle` da solo è il ripiego, per un tipo che zr-core non conosce), e
// `unreadOne`, il singolare delle non lette: `unread` è dell'`AppShell`, e in italiano resta quello del design system.
// Sprint 17 · T1 (voce #1481): di zr-core sono anche `markingAllRead` e `markRestRead`, i testi del pulsante «Segna tutte come
// lette» mentre la richiesta è in corso e quando ne restano: `markAllRead` è dell'`AppShell`, e in italiano resta quello del design system.

/** @return list<string> le chiavi di `AppShellLabels` in index.d.ts, nel loro ordine */
function chiaviDiAppShellLabels(): array
{
    preg_match('/^export interface AppShellLabels \{([^}]*)\}/m', File::get(__DIR__.'/../../resources/zeiras/index.d.ts'), $trovato);
    preg_match_all('/(\w+)\?: string/', $trovato[1] ?? '', $chiavi);

    return $chiavi[1];
}

/**
 * @return array<string, string> i testi italiani del design system: `APPSHELL_LABELS` e il menu di partenza di bundle.js (il titolo
 *                               del gruppo dei prodotti, la Dashboard, i nomi dei prodotti per id)
 */
function testiItalianiDelDesignSystem(): array
{
    $bundle = File::get(__DIR__.'/../../resources/zeiras/bundle.js');
    // Una stringa JS fra apici, anche con un apice col backslash dentro (`'Prova con un\'altra parola'`), e il suo testo.
    $stringa = "'((?:[^'\\\\]|\\\\.)*)'";
    $testo = fn (string $letto): string => (string) preg_replace('/\\\\(.)/s', '$1', $letto);

    preg_match('/var APPSHELL_LABELS = \{(.*?)\};/s', $bundle, $trovato);
    preg_match_all("/(\\w+): $stringa/", $trovato[1] ?? '', $coppie, PREG_SET_ORDER);

    $testi = [];
    foreach ($coppie as [, $chiave, $letto]) {
        $testi[$chiave] = $testo($letto);
    }
    // Il menu che l'`AppShell` mostra senza `nav`: il titolo del gruppo dei prodotti, poi la Dashboard e i prodotti, per id.
    preg_match('/var DEFAULT_NAV = \[(.*?)\];/s', $bundle, $menu);
    preg_match("/group: $stringa, products: true/", $menu[1] ?? '', $prodotti);
    preg_match_all("/\\{ id: '(\\w+)', label: $stringa/", $menu[1] ?? '', $voci, PREG_SET_ORDER);
    $testi += ['products' => $testo($prodotti[1] ?? '')];
    foreach ($voci as [, $id, $nome]) {
        $testi += [$id === 'home' ? 'dashboard' : $id => $testo($nome)];
    }

    return $testi;
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
 * I tipi di evento del contratto pubblicato di `/v1`, scritti qui dal contratto: una notifica porta in `tipo` quello dell'evento
 * che l'ha generata. Un tipo nuovo del contratto entra qui e nelle lingue insieme, con una versione nuova di zr-core.
 *
 * @return list<string>
 */
function tipiDiNotificaDelContratto(): array
{
    return [
        'com.zeiras.app.modificata',
        'com.zeiras.workspace.creato',
        'com.zeiras.workspace.modificato',
        'com.zeiras.workspace.membro.creato',
        'com.zeiras.workspace.membro.modificato',
        'com.zeiras.workspace.membro.eliminato',
        'com.zeiras.board.cartella.creata',
        'com.zeiras.board.cartella.modificata',
        'com.zeiras.board.cartella.eliminata',
        'com.zeiras.board.board.creata',
        'com.zeiras.board.board.modificata',
        'com.zeiras.board.lista.creata',
        'com.zeiras.board.lista.modificata',
        'com.zeiras.board.scheda.creata',
        'com.zeiras.board.scheda.modificata',
        'com.zeiras.board.scheda.eliminata',
        'com.zeiras.board.etichetta.creata',
        'com.zeiras.board.etichetta.modificata',
        'com.zeiras.board.etichetta.eliminata',
    ];
}

/** @return list<string> le chiavi dei titoli delle notifiche: `notificationTitle.<tipo>`, una per ogni tipo del contratto */
function chiaviDeiTitoliDelleNotifiche(): array
{
    return array_map(fn (string $tipo) => "notificationTitle.$tipo", tipiDiNotificaDelContratto());
}

/**
 * Cosa non torna nelle tre lingue di partenza: un testo che manca, una chiave che non è della cornice, un testo vuoto, un testo
 * italiano diverso da quello del design system, un prodotto che ha per id una chiave dei testi dell'`AppShell` (il suo nome
 * finirebbe anche lì).
 *
 * @param  array<string, array<string, mixed>>  $lingue
 * @param  list<string>|null  $prodotti  gli id dei prodotti; senza, quelli del registro
 * @return list<string>
 */
function problemiDelleLingue(array $lingue, ?array $prodotti = null): array
{
    $prodotti ??= idDeiProdotti();
    $chiavi = [
        ...chiaviDiAppShellLabels(), 'products', 'dashboard', 'notificationTitle', 'unreadOne', 'markingAllRead', 'markRestRead',
        ...chiaviDeiTitoliDelleNotifiche(), ...$prodotti, ...tipiDiRisorsa(),
    ];

    $problemi = [];
    foreach (array_intersect($prodotti, chiaviDiAppShellLabels()) as $id) {
        $problemi[] = "«{$id}» è l'id di un prodotto e un testo dell'AppShell";
    }
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

it('italiano, spagnolo e inglese hanno ogni testo della cornice e il nome di ogni prodotto, e l\'italiano è quello del design system (T5.1, T7.1)', function () {
    $lingue = lingueDellaCornice();

    expect(array_keys($lingue))->toContain('it', 'es', 'en')
        ->and(problemiDelleLingue($lingue))->toBe([])
        ->and($lingue['it'])->toMatchArray(testiItalianiDelDesignSystem())
        ->and(array_intersect_key($lingue['it'], array_flip(idDeiProdotti())))->toBe([
            'pm' => 'Project Management', 'crm' => 'CRM', 'bookings' => 'Bookings', 'reports' => 'Report',
            'automations' => 'Automazioni', 'content' => 'Contenuti',
        ])
        ->and(array_intersect_key($lingue['it'], array_flip(tipiDiRisorsa())))->toBe([
            'pm.board.cartelle' => 'Cartelle', 'pm.board.board' => 'Board',
        ]);
});

it('il controllo trova un testo che manca, un testo vuoto, un italiano diverso dal design system e un prodotto con l\'id di un testo dell\'AppShell (T5.1, T7.1)', function () {
    $italiano = testiItalianiDelDesignSystem();
    $lingue = lingueDellaCornice();
    unset($lingue['en']['logout'], $lingue['en']['content'], $lingue['en']['pm.board.cartelle']);
    // Il nome di un tipo che il registro non ha più (le schede, finché la ricerca non le cerca) non è un testo della cornice.
    $lingue['es']['pm.scheda'] = 'Tarjetas';
    $lingue['es']['retry'] = ' ';
    $lingue['it']['soon'] = 'Fra poco';
    $lingue['it']['reports'] = 'Reports';
    $lingue['it']['ciao'] = 'Ciao';

    // Le letture del design system non sono vuote: chiavi, testi con l'apostrofo, menu di partenza coi nomi dei prodotti.
    expect(chiaviDiAppShellLabels())->toContain('soon', 'logout', 'crumbs')
        ->and(array_keys($italiano))->toEqualCanonicalizing([...chiaviDiAppShellLabels(), 'products', 'dashboard', ...idDeiProdotti()])
        ->and($italiano['searchEmptyText'])->toStartWith("Prova con un'altra parola")
        ->and($italiano['products'])->toBe('Prodotti')
        ->and($italiano['dashboard'])->toBe('Dashboard')
        ->and($italiano['automations'])->toBe('Automazioni')
        ->and(problemiDelleLingue($lingue))->toEqualCanonicalizing([
            'en: manca «logout»',
            'en: manca «content»',
            'en: manca «pm.board.cartelle»',
            'es: «retry» è vuoto',
            'es: «pm.scheda» non è un testo della cornice',
            'it: «ciao» non è un testo della cornice',
            'it: «soon» non è il testo del design system',
            'it: «reports» non è il testo del design system',
        ])
        // Un prodotto che si chiamasse `search` darebbe il suo nome anche alla ricerca dell'AppShell.
        ->and(problemiDelleLingue(lingueDellaCornice(), [...idDeiProdotti(), 'search']))
        ->toBe(["«search» è l'id di un prodotto e un testo dell'AppShell"]);
});

it('ogni lingua ha il titolo di ognuno dei 19 tipi di notifica del contratto, né uno in più né uno in meno (sprint 12 · T3.3)', function (string $codice) {
    $titoli = array_values(array_filter(
        array_keys(lingueDellaCornice()[$codice] ?? []),
        fn (string $chiave) => str_starts_with($chiave, 'notificationTitle.'),
    ));

    expect(array_unique(tipiDiNotificaDelContratto()))->toHaveCount(19)
        ->and($titoli)->toEqualCanonicalizing(chiaviDeiTitoliDelleNotifiche());
})->with(['it', 'es', 'en']);

it('il controllo trova un tipo di notifica in più, uno in meno e il singolare delle non lette che manca (sprint 12 · T3.3)', function () {
    $lingue = lingueDellaCornice();
    // Un tipo che il contratto non ha: in una lingua sola, e anche nell'inglese, che è il ripiego. Un tipo del contratto tolto
    // da una lingua; il singolare tolto da un'altra.
    $lingue['es']['notificationTitle.com.zeiras.crm.contatto.creato'] = 'Nuevo contacto';
    $lingue['en']['notificationTitle.com.zeiras.board.scheda.spostata'] = 'Card moved';
    unset($lingue['it']['notificationTitle.com.zeiras.board.scheda.creata'], $lingue['es']['unreadOne']);

    expect(problemiDelleLingue($lingue))->toEqualCanonicalizing([
        'es: «notificationTitle.com.zeiras.crm.contatto.creato» non è un testo della cornice',
        'en: «notificationTitle.com.zeiras.board.scheda.spostata» non è un testo della cornice',
        'it: manca «notificationTitle.com.zeiras.board.scheda.creata»',
        'es: manca «unreadOne»',
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
