<?php

use Illuminate\Support\Facades\File;

// Sprint 1 · T5 e T7 (voce #1255). Le lingue della cornice, una per file in resources/lingue: italiano, spagnolo e inglese per
// partire, ognuna con tutti i testi dell'`AppShell` (`AppShellLabels` di index.d.ts) e quelli di zr-core (`products`, `dashboard`,
// `notificationTitle` e il nome di ogni prodotto del registro, con l'id per chiave: T7, decisione 5926 di Luciano; dallo sprint 3 ·
// T5 anche il nome di ogni tipo di risorsa del registro, il gruppo dei risultati della ricerca, con `<prodotto>.<tipo>` per chiave). L'italiano è quello del design system
// delle copie in resources/zeiras/ (`APPSHELL_LABELS` e il menu di partenza di bundle.js), tranne i testi che una decisione ha
// cambiato prima che lo faccia il design system (`italianoDecisoPrimaDelDesignSystem()`, sprint 21 · T1). Nessun testo dell'interfaccia sta
// nel codice TS/TSX: i testi vengono dalle lingue. Il ripiego sull'inglese e le lingue scoperte dai file li prova
// resources/js/lingue.test.ts. Sprint 12 · T3 (voce #1463): di zr-core sono anche il titolo di ogni tipo di notifica, con
// `notificationTitle.<tipo>` per chiave (`notificationTitle` da solo è il ripiego, per un tipo che zr-core non conosce), e
// `unreadOne`, il singolare delle non lette: `unread` è dell'`AppShell`, e in italiano resta quello del design system.
// Sprint 17 · T1 (voce #1481): di zr-core sono anche `markingAllRead` e `markRestRead`, i testi del pulsante «Segna tutte come
// lette» mentre la richiesta è in corso e quando ne restano: `markAllRead` è dell'`AppShell`, e in italiano resta quello del design system.
// Sprint 22 · T2 (voce #1712): di zr-core è anche `unreadNone`, ciò che l'avviso della cornice dice al lettore di schermo quando
// l'ultima non letta è stata letta: `notifications` e `unread`, con cui dice un numero, sono dell'`AppShell`.

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
        ...array_keys(titoliDelleNotificheDelCrm()),
        ...array_keys(titoliDelleNotificheDiVisteEAziende()),
    ];
}

/**
 * I titoli delle sette notifiche del CRM che il contratto ha (contatti, pipeline, note), con le parole di zr-crm: nel CRM una
 * `persona` è un «contatto». La tabella è scritta qui, non letta dai file delle lingue. Ogni titolo è un testo intero per tipo:
 * in italiano e in spagnolo «pipeline» e «nota» sono al femminile, e un titolo composto da «Nuovo» e dal nome della cosa lo
 * sbaglierebbe (sprint 21 · T2.1).
 *
 * @return array<string, array{it: string, en: string, es: string}>
 */
function titoliDelleNotificheDelCrm(): array
{
    return [
        'com.zeiras.crm.persona.creata' => ['it' => 'Nuovo contatto', 'en' => 'New contact', 'es' => 'Nuevo contacto'],
        'com.zeiras.crm.persona.modificata' => ['it' => 'Contatto modificato', 'en' => 'Contact changed', 'es' => 'Contacto modificado'],
        'com.zeiras.crm.pipeline.creata' => ['it' => 'Nuova pipeline', 'en' => 'New pipeline', 'es' => 'Nueva pipeline'],
        'com.zeiras.crm.pipeline.modificata' => ['it' => 'Pipeline modificata', 'en' => 'Pipeline changed', 'es' => 'Pipeline modificada'],
        'com.zeiras.crm.nota.creata' => ['it' => 'Nuova nota', 'en' => 'New note', 'es' => 'Nueva nota'],
        'com.zeiras.crm.nota.modificata' => ['it' => 'Nota modificata', 'en' => 'Note changed', 'es' => 'Nota modificada'],
        'com.zeiras.crm.nota.eliminata' => ['it' => 'Nota eliminata', 'en' => 'Note deleted', 'es' => 'Nota eliminada'],
    ];
}

/**
 * I titoli dei cinque tipi che il contratto porta dall'11/10/2026: le viste salvate di una board (Project Management) e le
 * aziende del CRM, con le parole dei due moduli. Nel contratto un'azienda è una `organizzazione`: nel CRM si chiama «azienda»,
 * «company», «empresa», e il titolo non si ricava dal tipo. La tabella è scritta qui, non letta dai file delle lingue
 * (sprint 21 · T5.1).
 *
 * @return array<string, array{it: string, en: string, es: string}>
 */
function titoliDelleNotificheDiVisteEAziende(): array
{
    return [
        'com.zeiras.board.vista.creata' => ['it' => 'Nuova vista', 'en' => 'New view', 'es' => 'Nueva vista'],
        'com.zeiras.board.vista.modificata' => ['it' => 'Vista modificata', 'en' => 'View changed', 'es' => 'Vista modificada'],
        'com.zeiras.board.vista.eliminata' => ['it' => 'Vista eliminata', 'en' => 'View deleted', 'es' => 'Vista eliminada'],
        'com.zeiras.crm.organizzazione.creata' => ['it' => 'Nuova azienda', 'en' => 'New company', 'es' => 'Nueva empresa'],
        'com.zeiras.crm.organizzazione.modificata' => ['it' => 'Azienda modificata', 'en' => 'Company changed', 'es' => 'Empresa modificada'],
    ];
}

/** @return list<string> le chiavi dei titoli delle notifiche: `notificationTitle.<tipo>`, una per ogni tipo del contratto */
function chiaviDeiTitoliDelleNotifiche(): array
{
    return array_map(fn (string $tipo) => "notificationTitle.$tipo", tipiDiNotificaDelContratto());
}

/**
 * I testi italiani che una decisione ha cambiato prima che lo faccia il design system: la chiave e il testo di zr-core. «Moduli» è
 * il nome unico di Project Management, CRM e gli altri (regola di Luciano dell'11/10/2026; sprint 21 · T1), e il design system
 * dice ancora «Prodotti» nel menu di partenza e nel testo d'aiuto della ricerca. Quando un riallineamento porta il testo nuovo,
 * la riga qui non serve più: il caso «l'italiano si scosta dal design system solo dove…» diventa rosso, e la si toglie.
 *
 * @return array<string, string>
 */
function italianoDecisoPrimaDelDesignSystem(): array
{
    return [
        'products' => 'Moduli',
        'searchHint' => 'Cerca in tutti i moduli: scrivi almeno 2 caratteri.',
    ];
}

/**
 * L'italiano atteso, in un posto solo: quello del design system, e dove c'è una decisione il testo deciso.
 *
 * @return array<string, string>
 */
function italianoAtteso(): array
{
    return [...testiItalianiDelDesignSystem(), ...italianoDecisoPrimaDelDesignSystem()];
}

/**
 * Cosa non torna nelle tre lingue di partenza: un testo che manca, una chiave che non è della cornice, un testo vuoto, un testo
 * italiano diverso da quello atteso (`italianoAtteso()`), un prodotto che ha per id una chiave dei testi dell'`AppShell` (il suo
 * nome finirebbe anche lì).
 *
 * @param  array<string, array<string, mixed>>  $lingue
 * @param  list<string>|null  $prodotti  gli id dei prodotti; senza, quelli del registro
 * @return list<string>
 */
function problemiDelleLingue(array $lingue, ?array $prodotti = null): array
{
    $prodotti ??= idDeiProdotti();
    $chiavi = [
        ...chiaviDiAppShellLabels(), 'products', 'dashboard', 'notificationTitle', 'unreadOne', 'markingAllRead', 'markRestRead', 'unreadNone',
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
    $decisi = italianoDecisoPrimaDelDesignSystem();
    foreach (italianoAtteso() as $chiave => $testo) {
        if (array_key_exists($chiave, $lingue['it'] ?? []) && $lingue['it'][$chiave] !== $testo) {
            $problemi[] = array_key_exists($chiave, $decisi)
                ? "it: «{$chiave}» non è il testo deciso prima del design system"
                : "it: «{$chiave}» non è il testo del design system";
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

it('italiano, spagnolo e inglese hanno ogni testo della cornice e il nome di ogni prodotto, e l\'italiano è quello del design system o, dove c\'è una decisione, quello deciso (T5.1, T7.1; sprint 21 · T1)', function () {
    $lingue = lingueDellaCornice();

    expect(array_keys($lingue))->toContain('it', 'es', 'en')
        ->and(problemiDelleLingue($lingue))->toBe([])
        ->and($lingue['it'])->toMatchArray(italianoAtteso())
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

it('ogni lingua ha il titolo di ognuno dei 31 tipi di evento del contratto, né uno in più né uno in meno (sprint 12 · T3.3; sprint 21 · T2.1, T5.3)', function (string $codice) {
    $titoli = array_values(array_filter(
        array_keys(lingueDellaCornice()[$codice] ?? []),
        fn (string $chiave) => str_starts_with($chiave, 'notificationTitle.'),
    ));

    expect(array_unique(tipiDiNotificaDelContratto()))->toHaveCount(31)
        ->and($titoli)->toEqualCanonicalizing(chiaviDeiTitoliDelleNotifiche());
})->with(['it', 'es', 'en']);

it('le sette notifiche del CRM hanno il titolo della tabella nella lingua, e un tipo del CRM che il contratto non ha ancora non ha un titolo (sprint 21 · T2.1, T2.2)', function (string $codice) {
    $testi = lingueDellaCornice()[$codice] ?? [];
    $titoli = [];
    foreach (array_keys(titoliDelleNotificheDelCrm()) as $tipo) {
        $titoli[$tipo] = $testi["notificationTitle.$tipo"] ?? null;
    }

    // Tutti e sette insieme: un rosso li mostra tutti, non solo il primo che manca.
    expect($titoli)->toBe(array_map(fn (array $perLingua) => $perLingua[$codice], titoliDelleNotificheDelCrm()))
        // `…persona.assegnata` non è ancora nel contratto: finché non ha un titolo suo, ha quello di ripiego.
        ->and(array_keys($testi))->not->toContain('notificationTitle.com.zeiras.crm.persona.assegnata')
        ->and($testi['notificationTitle'] ?? null)->not->toBeIn(array_values($titoli));
})->with(['it', 'en', 'es']);

it('le cinque notifiche nuove del contratto, viste di una board e aziende del CRM, hanno il titolo della tabella nella lingua, e un\'azienda non è chiamata «organizzazione» (sprint 21 · T5.1)', function (string $codice) {
    $testi = lingueDellaCornice()[$codice] ?? [];
    $titoli = [];
    foreach (array_keys(titoliDelleNotificheDiVisteEAziende()) as $tipo) {
        $titoli[$tipo] = $testi["notificationTitle.$tipo"] ?? null;
    }

    // Tutti e cinque insieme: un rosso li mostra tutti, non solo il primo che manca.
    expect($titoli)->toBe(array_map(fn (array $perLingua) => $perLingua[$codice], titoliDelleNotificheDiVisteEAziende()))
        // Nessuno dei cinque è il titolo di ripiego.
        ->and($testi['notificationTitle'] ?? null)->not->toBeIn(array_values($titoli))
        // La parola è quella del CRM, non quella del contratto: «organizzazione», «organization», «organización».
        ->and(implode(' · ', array_map(fn (?string $titolo) => (string) $titolo, $titoli)))->not->toMatch('/organi[zs]/iu');
})->with(['it', 'en', 'es']);

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

it('il testo dell\'avviso senza non lette c\'è nelle tre lingue ed è di zr-core: l\'AppShell non ha una chiave con quel nome (sprint 22 · T2.6)', function () {
    $lingue = lingueDellaCornice();

    expect([$lingue['it']['unreadNone'] ?? null, $lingue['en']['unreadNone'] ?? null, $lingue['es']['unreadNone'] ?? null])
        ->toBe(['Nessuna notifica non letta', 'No unread notifications', 'Ninguna notificación sin leer'])
        ->and(chiaviDiAppShellLabels())->not->toContain('unreadNone');
});

it('nessun testo dell\'interfaccia è scritto nel codice TS/TSX di zr-core (T5.4)', function () {
    $testi = array_values(array_unique(array_merge(...array_values(array_map('array_values', lingueDellaCornice())))));

    $scritti = [];
    foreach (fileDelCodice() as $file) {
        foreach (testiScrittiNelCodice(File::get($file->getPathname()), $testi) as $testo) {
            $scritti[] = $file->getFilename().": $testo";
        }
    }

    expect($testi)->toContain('Moduli', 'Dashboard', 'Esci')
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

/**
 * Le parole con cui un testo chiamerebbe «prodotti» o «app» i moduli, per lingua: parole intere, al singolare e al plurale.
 * Una lingua nuova di resources/lingue entra qui con le sue parole: finché non c'è, il controllo non sa che cosa cercarvi, e lo
 * dice (sprint 21 · T1.4).
 *
 * @return array<string, list<string>>
 */
function paroleCheNonSonoModuli(): array
{
    return [
        'it' => ['prodotto', 'prodotti', 'app', 'applicazione', 'applicazioni'],
        'en' => ['product', 'products', 'app', 'apps', 'application', 'applications'],
        'es' => ['producto', 'productos', 'app', 'apps', 'aplicación', 'aplicaciones'],
    ];
}

/**
 * I testi delle lingue che chiamano «prodotti» o «app» i moduli: il nome è uno solo, «Moduli» (sprint 21 · T1.4). In ogni
 * lingua si cercano le parole di tutte: «products» in un testo italiano è lo stesso errore. Il controllo legge parole, non
 * significati: un testo giusto che usa una di queste parole per un'altra cosa (una risorsa di un modulo che si chiama
 * «Prodotti») lo fa rosso, e l'eccezione si decide allora, con la sua chiave. Nell'altro verso, ciò che non è una di queste
 * parole non lo vede: una forma fuori tabella («aplicacions»), un sinonimo («strumenti»), e i testi fissi dei componenti del
 * design system, che non stanno in `resources/lingue`.
 *
 * @param  array<string, array<string, string>>  $lingue
 * @return list<string>
 */
function testiCheNonDiconoModuli(array $lingue): array
{
    $parole = paroleCheNonSonoModuli();
    $tutte = array_map(fn (string $parola): string => preg_quote($parola, '/'), array_unique(array_merge(...array_values($parole))));
    // Parola intera: nessuna lettera subito prima né subito dopo («riprodotto» e «productivity» non lo sono).
    $unaDiQueste = '/(?<!\p{L})(?:'.implode('|', $tutte).')(?!\p{L})/iu';

    $trovati = [];
    foreach ($lingue as $codice => $testi) {
        if (! array_key_exists($codice, $parole)) {
            $trovati[] = "{$codice}: nessuna parola da cercare per questa lingua";
        }
        foreach ($testi as $chiave => $testo) {
            if (preg_match($unaDiQueste, $testo) === 1) {
                $trovati[] = "{$codice}: {$chiave}";
            }
        }
    }

    return $trovati;
}

it('nelle tre lingue il testo ha la parola «moduli» al posto di quella di prima (sprint 21 · T1.1, T1.3, T1.4)', function (string $chiave, array $attesi) {
    $lingue = lingueDellaCornice();

    expect([$lingue['it'][$chiave], $lingue['en'][$chiave], $lingue['es'][$chiave]])->toBe($attesi);
})->with([
    'T1.1: il nome del menu' => ['products', ['Moduli', 'Modules', 'Módulos']],
    'T1.3: l\'aiuto della ricerca' => ['searchHint', [
        'Cerca in tutti i moduli: scrivi almeno 2 caratteri.',
        'Search across all modules: type at least 2 characters.',
        'Busca en todos los módulos: escribe al menos 2 caracteres.',
    ]],
    'T1.4: la notifica di un modulo attivato o disattivato' => ['notificationTitle.com.zeiras.app.modificata', [
        'Un modulo è stato attivato o disattivato',
        'A module was turned on or off',
        'Se activó o desactivó un módulo',
    ]],
]);

it('nessun testo delle lingue di zr-core chiama «prodotti» o «app» i moduli, e ogni lingua ha le sue parole da cercare (sprint 21 · T1.4)', function () {
    expect(testiCheNonDiconoModuli(lingueDellaCornice()))->toBe([]);
});

it('il controllo vede la parola, in qualunque chiave e in qualunque lingua, in mezzo a una frase, da sola e in maiuscolo (sprint 21 · T1.4)', function (string $parola) {
    $lingue = [
        'it' => ['soon' => "Tutti i {$parola} del workspace", 'products' => 'Moduli'],
        'en' => ['retry' => ucfirst($parola), 'all' => 'All modules'],
        'es' => ['logout' => '¡'.mb_strtoupper($parola).'!'],
    ];

    expect(testiCheNonDiconoModuli($lingue))->toBe(['it: soon', 'en: retry', 'es: logout']);
})->with([
    'prodotto', 'prodotti', 'product', 'products', 'producto', 'productos', 'app', 'apps',
    'applicazione', 'applicazioni', 'application', 'applications', 'aplicación', 'aplicaciones',
]);

it('il controllo non scambia per una di quelle parole una parola che la contiene (sprint 21 · T1.4)', function (string $testo) {
    expect(testiCheNonDiconoModuli(['it' => ['soon' => $testo]]))->toBe([]);
})->with([
    'app, in testa' => ['Appena arrivato'],
    'product, in testa' => ['Productivity tips'],
    'producto, in testa' => ['La productora'],
    'prodotto, in coda' => ['Audio riprodotto'],
    'app, in mezzo' => ['What happened'],
]);

it('il controllo dice che per una lingua che non conosce non ha parole da cercare (sprint 21 · T1.4)', function () {
    expect(testiCheNonDiconoModuli(['fr' => ['products' => 'Produits'], 'it' => ['products' => 'Moduli']]))
        ->toBe(['fr: nessuna parola da cercare per questa lingua']);
});

it('l\'italiano si scosta dal design system solo dove lo dice una decisione, e finché il design system non la porta (sprint 21 · T1)', function () {
    $delDesignSystem = testiItalianiDelDesignSystem();
    $conIlTestoDiPrima = lingueDellaCornice();
    $conIlTestoDiPrima['it']['products'] = 'Prodotti';

    expect(array_keys(italianoDecisoPrimaDelDesignSystem()))->toBe(['products', 'searchHint'])
        // Il design system dice ancora il testo di prima: quando dirà «Moduli», questa riga è rossa e lo scostamento si toglie.
        ->and($delDesignSystem['products'])->toBe('Prodotti')
        ->and($delDesignSystem['searchHint'])->toBe('Cerca in tutti i prodotti: scrivi almeno 2 caratteri.')
        // Dove c'è una decisione il testo giusto è quello deciso: quello del design system è un problema.
        ->and(problemiDelleLingue($conIlTestoDiPrima))->toBe(['it: «products» non è il testo deciso prima del design system']);
});
