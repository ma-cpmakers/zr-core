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
// Sprint 24 · T2 (voce #1745): di zr-core sono anche i quattro testi di chi non ha accettato i documenti legali in vigore —
// `acceptanceTitle`, `acceptanceText` e `acceptanceAction` per l'avviso sopra la pagina, `acceptanceOff` per campanella e ricerca
// spente —, e nessuno nomina un documento né una versione: quali mancano lo sa la pagina dell'accettazione, non la cornice.

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
 * che l'ha generata. Un tipo nuovo del contratto entra qui e nelle lingue insieme, con una versione nuova di zr-core: tranne
 * un tipo che non genera notifiche, che qui non sta e non ha un titolo. Dal 12/10/2026 il contratto ne ha uno,
 * `com.zeiras.crm.persona.anonimizzata`: i tipi di evento del contratto sono 37, e qui ce ne sono 36.
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
        ...array_keys(titoliDelleNotificheDiOpportunitaEAttivita()),
    ];
}

/**
 * I tipi che hanno un titolo: i tipi di evento del contratto più le quattro notifiche «assegnata» del CRM, che non sono eventi e
 * nel contratto stanno solo nella descrizione di `tipo` delle notifiche (sprint 22 · T5.4), e quella di Project Management a
 * chi viene assegnata una scheda, che non è un evento nemmeno lei (sprint 24 · T3).
 * Dallo sprint 26 (T6) anche quella a chi viene menzionato in un commento, di Project Management: non è un evento.
 *
 * @return list<string>
 */
function tipiDiNotificaConUnTitolo(): array
{
    return [...tipiDiNotificaDelContratto(), ...array_keys(titoliDelleNotificheDiCioCheVieneAssegnato()), ...array_keys(titoloDellaNotificaDellaSchedaAssegnata()), ...array_keys(titoloDellaNotificaDellaMenzioneInUnCommento())];
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

/**
 * I titoli dei cinque tipi di evento che il contratto porta dallo sprint 25g di zr-backoffice (11/10/2026, sera): le opportunità e
 * le attività del CRM, con le parole di zr-crm. Nel contratto un'opportunità è una `trattativa`: nel CRM si chiama «opportunità»,
 * «opportunity», «oportunidad», e il titolo non si ricava dal tipo. La tabella è scritta qui, non letta dai file delle lingue
 * (sprint 22 · T5.1).
 *
 * @return array<string, array{it: string, en: string, es: string}>
 */
function titoliDelleNotificheDiOpportunitaEAttivita(): array
{
    return [
        'com.zeiras.crm.trattativa.creata' => ['it' => 'Nuova opportunità', 'en' => 'New opportunity', 'es' => 'Nueva oportunidad'],
        'com.zeiras.crm.trattativa.modificata' => ['it' => 'Opportunità modificata', 'en' => 'Opportunity changed', 'es' => 'Oportunidad modificada'],
        'com.zeiras.crm.attivita.creata' => ['it' => 'Nuova attività', 'en' => 'New activity', 'es' => 'Nueva actividad'],
        'com.zeiras.crm.attivita.modificata' => ['it' => 'Attività modificata', 'en' => 'Activity changed', 'es' => 'Actividad modificada'],
        'com.zeiras.crm.attivita.eliminata' => ['it' => 'Attività eliminata', 'en' => 'Activity deleted', 'es' => 'Actividad eliminada'],
    ];
}

/**
 * I titoli delle quattro notifiche che il CRM manda a chi diventa responsabile di un contatto, di un'azienda, di un'opportunità o
 * di un'attività. Non sono eventi: il `tipo` arriva com'è nel backoffice, senza `com.zeiras.` davanti, e la chiave del titolo è
 * `notificationTitle.crm.persona.assegnata`. La tabella è scritta qui, non letta dai file delle lingue (sprint 22 · T5.1, T5.2).
 *
 * @return array<string, array{it: string, en: string, es: string}>
 */
function titoliDelleNotificheDiCioCheVieneAssegnato(): array
{
    return [
        'crm.persona.assegnata' => ['it' => 'Ti è stato assegnato un contatto', 'en' => 'A contact was assigned to you', 'es' => 'Se te ha asignado un contacto'],
        'crm.organizzazione.assegnata' => ['it' => "Ti è stata assegnata un'azienda", 'en' => 'A company was assigned to you', 'es' => 'Se te ha asignado una empresa'],
        'crm.trattativa.assegnata' => ['it' => "Ti è stata assegnata un'opportunità", 'en' => 'An opportunity was assigned to you', 'es' => 'Se te ha asignado una oportunidad'],
        'crm.attivita.assegnata' => ['it' => "Ti è stata assegnata un'attività", 'en' => 'An activity was assigned to you', 'es' => 'Se te ha asignado una actividad'],
    ];
}

/**
 * Il titolo della notifica che Project Management manda a chi viene assegnata una scheda, con le parole di zr-board (nota 10451
 * del #95). Non è un evento: il `tipo` arriva com'è nel backoffice, senza `com.zeiras.` davanti, e la chiave del titolo è
 * `notificationTitle.board.scheda.assegnata`. Scritto qui, non letto dai file delle lingue (sprint 24 · T3.1).
 *
 * @return array<string, array{it: string, en: string, es: string}>
 */
function titoloDellaNotificaDellaSchedaAssegnata(): array
{
    return [
        'board.scheda.assegnata' => ['it' => 'Ti è stata assegnata una scheda', 'en' => 'A card was assigned to you', 'es' => 'Se te ha asignado una tarjeta'],
    ];
}

/**
 * Il titolo della notifica che Project Management manda a chi viene menzionato in un commento, con le parole di zr-board (nota
 * 10846 del #95). Non è un evento nemmeno lei: il `tipo` arriva senza `com.zeiras.` davanti, e la chiave del titolo è
 * `notificationTitle.board.commento.menzione`. Scritto qui, non letto dai file delle lingue (sprint 26 · T6.1).
 *
 * @return array<string, array{it: string, en: string, es: string}>
 */
function titoloDellaNotificaDellaMenzioneInUnCommento(): array
{
    return [
        'board.commento.menzione' => ['it' => 'Ti hanno menzionato in un commento', 'en' => 'You were mentioned in a comment', 'es' => 'Te han mencionado en un comentario'],
    ];
}

/** @return list<string> le chiavi dei titoli delle notifiche: `notificationTitle.<tipo>`, una per ogni tipo che ha un titolo */
function chiaviDeiTitoliDelleNotifiche(): array
{
    return array_map(fn (string $tipo) => "notificationTitle.$tipo", tipiDiNotificaConUnTitolo());
}

/**
 * I testi italiani che una decisione ha cambiato prima che lo faccia il design system: la chiave e il testo di zr-core. «Moduli» è
 * il nome unico di Project Management, CRM e gli altri (regola di Luciano dell'11/10/2026; sprint 21 · T1), e il design system
 * dice ancora «Prodotti» nel menu di partenza e nel testo d'aiuto della ricerca. Quando un riallineamento porta il testo nuovo,
 * la riga qui non serve più: il caso «l'italiano si scosta dal design system solo dove…» diventa rosso, e la si toglie.
 * Il segnaposto e l'invito della ricerca non promettono ciò che la ricerca non trova (zr-pm, note 10255 e 10288 del progetto;
 * sprint 22 · T8): dallo sprint 25 (T4) l'invito lo compone la cornice dalle fonti del workspace, dallo sprint 27 (T7) il
 * segnaposto è uno solo e non le nomina, e questi due sono quelli senza fonti.
 * Il design system ha ancora due testi fissi, che dicono progetti, schede e contatti in ogni workspace.
 *
 * @return array<string, string>
 */
function italianoDecisoPrimaDelDesignSystem(): array
{
    return [
        'products' => 'Moduli',
        'searchHint' => 'Scrivi almeno 2 caratteri.',
        'searchPlaceholder' => 'Cerca…',
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
        'acceptanceTitle', 'acceptanceText', 'acceptanceAction', 'acceptanceOff',
        // Sprint 25 · T4: i due testi della ricerca che nominano le fonti, e il nome da elenco di ogni tipo di risorsa.
        'searchPlaceholderSources', 'searchHintSources',
        ...chiaviDeiTitoliDelleNotifiche(), ...$prodotti, ...tipiDiRisorsa(),
        ...array_map(fn (string $tipo): string => "searchSource.$tipo", tipiDiRisorsa()),
        // Sprint 27 · T1: il testo di ogni codice che il registro dà a una chiave di `contesto` (il ruolo di un membro).
        ...array_map(fn (string $codice): string => "searchContext.$codice", codiciDelContesto()),
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
            'home.workspace.membro' => 'Membri',
            'pm.board.scheda' => 'Schede', 'pm.board.board' => 'Board', 'pm.board.cartelle' => 'Cartelle',
            'crm.crm.persona' => 'Contatti', 'crm.crm.organizzazione' => 'Aziende', 'crm.crm.trattativa' => 'Opportunità',
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

it('ogni lingua ha il titolo di ognuno dei 42 tipi di notifica, 36 dei 37 tipi di evento del contratto (quello che non genera notifiche non ha un titolo) più i sei che non sono eventi — i cinque «assegnata», quattro del CRM e uno di Project Management, e la menzione in un commento —, né uno in più né uno in meno (sprint 12 · T3.3; sprint 21 · T2.1, T5.3; sprint 22 · T5.4; sprint 24 · T3.1; sprint 26 · T6.1)', function (string $codice) {
    $titoli = array_values(array_filter(
        array_keys(lingueDellaCornice()[$codice] ?? []),
        fn (string $chiave) => str_starts_with($chiave, 'notificationTitle.'),
    ));

    expect(array_unique(tipiDiNotificaDelContratto()))->toHaveCount(36)
        ->and(array_unique(tipiDiNotificaConUnTitolo()))->toHaveCount(42)
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
        // Il tipo vero è `crm.persona.assegnata`, senza `com.zeiras.` davanti (sprint 22 · T5.2): col prefisso resta un tipo che
        // zr-core non conosce, col titolo di ripiego.
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

it('le nove notifiche nuove del CRM, opportunità, attività e ciò che viene assegnato a una persona, hanno il titolo della tabella nella lingua, e un\'opportunità non è chiamata con la parola del contratto (sprint 22 · T5.1)', function (string $codice) {
    $testi = lingueDellaCornice()[$codice] ?? [];
    $tabella = [...titoliDelleNotificheDiOpportunitaEAttivita(), ...titoliDelleNotificheDiCioCheVieneAssegnato()];
    $titoli = [];
    foreach (array_keys($tabella) as $tipo) {
        $titoli[$tipo] = $testi["notificationTitle.$tipo"] ?? null;
    }

    // Tutti e nove insieme: un rosso li mostra tutti, non solo il primo che manca.
    expect($tabella)->toHaveCount(9)
        ->and($titoli)->toBe(array_map(fn (array $perLingua) => $perLingua[$codice], $tabella))
        // Nessuno dei nove è il titolo di ripiego.
        ->and($testi['notificationTitle'] ?? null)->not->toBeIn(array_values($titoli))
        // La parola è quella del CRM, non quella del contratto: «trattativa», «deal», «negociación».
        ->and(implode(' · ', array_map(fn (?string $titolo) => (string) $titolo, $titoli)))->not->toMatch('/trattativ|\bdeals?\b|negociaci/iu');
})->with(['it', 'en', 'es']);

it('i quattro «assegnata» hanno il titolo sotto il tipo com\'è nel backoffice, senza `com.zeiras.` davanti: lo stesso nome col prefisso resta senza titolo, e nessuno dei quattro è un tipo di evento del contratto (sprint 22 · T5.2, T5.4)', function (string $codice) {
    $testi = lingueDellaCornice()[$codice] ?? [];
    $tabella = titoliDelleNotificheDiCioCheVieneAssegnato();
    $titoli = [];
    $colPrefisso = [];
    foreach (array_keys($tabella) as $tipo) {
        $titoli[$tipo] = $testi["notificationTitle.$tipo"] ?? null;
        $colPrefisso[$tipo] = array_key_exists("notificationTitle.com.zeiras.$tipo", $testi);
    }

    expect(array_keys($tabella))->toBe(['crm.persona.assegnata', 'crm.organizzazione.assegnata', 'crm.trattativa.assegnata', 'crm.attivita.assegnata'])
        ->and($titoli)->toBe(array_map(fn (array $perLingua) => $perLingua[$codice], $tabella))
        ->and(array_filter($colPrefisso))->toBe([])
        ->and(array_intersect(array_keys($tabella), tipiDiNotificaDelContratto()))->toBe([]);
})->with(['it', 'en', 'es']);

it('la notifica a chi viene assegnata una scheda ha il titolo della tabella nella lingua, sotto il tipo com\'è nel backoffice, senza `com.zeiras.` davanti: lo stesso nome col prefisso resta senza titolo, non è un tipo di evento del contratto, e il titolo non è quello di ripiego né quello di un altro tipo (sprint 24 · T3.1)', function (string $codice) {
    $testi = lingueDellaCornice()[$codice] ?? [];
    $tabella = titoloDellaNotificaDellaSchedaAssegnata();
    $titolo = $testi['notificationTitle.board.scheda.assegnata'] ?? null;
    $deiTitoli = array_filter($testi, fn (string $chiave) => str_starts_with($chiave, 'notificationTitle'), ARRAY_FILTER_USE_KEY);

    expect(array_keys($tabella))->toBe(['board.scheda.assegnata'])
        ->and($titolo)->toBe($tabella['board.scheda.assegnata'][$codice])
        ->and(array_key_exists('notificationTitle.com.zeiras.board.scheda.assegnata', $testi))->toBe(false)
        // Una parola per ogni `not->toContain`: con due si ferma alla prima che manca, e una sola nel contratto passerebbe.
        ->and(tipiDiNotificaDelContratto())->not->toContain('board.scheda.assegnata')
        ->and(tipiDiNotificaDelContratto())->not->toContain('com.zeiras.board.scheda.assegnata')
        // Un titolo suo: nessun'altra notifica, e nemmeno il ripiego, si chiama così.
        ->and(array_keys($deiTitoli, $titolo, true))->toBe(['notificationTitle.board.scheda.assegnata']);
})->with(['it', 'en', 'es']);

it('la notifica a chi viene menzionato in un commento ha il titolo della tabella nella lingua, sotto il tipo com\'è nel backoffice, senza `com.zeiras.` davanti: lo stesso nome col prefisso, un pezzo del tipo e il tipo con un pezzo in più restano senza titolo, non è un tipo di evento del contratto, e il titolo non è quello di ripiego né quello di un altro tipo (sprint 26 · T6.1)', function (string $codice) {
    $testi = lingueDellaCornice()[$codice] ?? [];
    $tabella = titoloDellaNotificaDellaMenzioneInUnCommento();
    $titolo = $testi['notificationTitle.board.commento.menzione'] ?? null;
    $deiTitoli = array_filter($testi, fn (string $chiave) => str_starts_with($chiave, 'notificationTitle'), ARRAY_FILTER_USE_KEY);

    expect(array_keys($tabella))->toBe(['board.commento.menzione'])
        ->and($titolo)->toBe($tabella['board.commento.menzione'][$codice])
        ->and(array_key_exists('notificationTitle.com.zeiras.board.commento.menzione', $testi))->toBe(false)
        ->and(array_key_exists('notificationTitle.board.commento', $testi))->toBe(false)
        ->and(array_key_exists('notificationTitle.board.commento.menzione.poi', $testi))->toBe(false)
        // Una parola per ogni `not->toContain`: con due si ferma alla prima che manca, e una sola nel contratto passerebbe.
        ->and(tipiDiNotificaDelContratto())->not->toContain('board.commento.menzione')
        ->and(tipiDiNotificaDelContratto())->not->toContain('com.zeiras.board.commento.menzione')
        // Un titolo suo: nessun'altra notifica, e nemmeno il ripiego, si chiama così.
        ->and(array_keys($deiTitoli, $titolo, true))->toBe(['notificationTitle.board.commento.menzione']);
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

/**
 * I nomi di documenti legali e le versioni che un testo dice, nelle tre lingue: un testo dell'accettazione non ne deve dire
 * nessuno, perché la cornice non sa quali documenti mancano. Una parola che ne contiene un'altra non conta («determinato»).
 *
 * @return list<string>
 */
function documentiNominatiIn(string $testo): array
{
    $parole = ['termini', 'terms', 'términos', 'condizioni', 'conditions', 'condiciones', 'privacy', 'privacidad', 'cookie', 'cookies', 'dpa', 'informativa', 'versione', 'version', 'versión'];
    preg_match_all('/(?<![\p{L}\p{N}])(?:'.implode('|', $parole).'|v?\d+(?:\.\d+)+)(?![\p{L}\p{N}])/iu', $testo, $trovati);

    return array_values(array_unique(array_map(mb_strtolower(...), $trovati[0])));
}

it('i quattro testi di chi non ha accettato i documenti legali ci sono nelle tre lingue e sono di zr-core: l\'AppShell non ha una chiave con quei nomi (sprint 24 · T2.4)', function (string $chiave, array $attesi) {
    $lingue = lingueDellaCornice();

    expect([$lingue['it'][$chiave] ?? null, $lingue['en'][$chiave] ?? null, $lingue['es'][$chiave] ?? null])->toBe($attesi)
        ->and(chiaviDiAppShellLabels())->not->toContain($chiave);
})->with([
    'il titolo dell\'avviso' => ['acceptanceTitle', ['Ci sono documenti da accettare', 'There are documents to accept', 'Hay documentos por aceptar']],
    'la frase dell\'avviso' => ['acceptanceText', [
        'Per usare Zeiras devi accettare i documenti legali in vigore. Fino ad allora moduli, notifiche e ricerca restano spenti.',
        'To use Zeiras you need to accept the legal documents in force. Until then modules, notifications and search stay off.',
        'Para usar Zeiras tienes que aceptar los documentos legales vigentes. Hasta entonces los módulos, las notificaciones y la búsqueda quedan desactivados.',
    ]],
    'il pulsante dell\'avviso' => ['acceptanceAction', ['Vai ai documenti', 'Go to the documents', 'Ir a los documentos']],
    'campanella e ricerca spente' => ['acceptanceOff', ['Non disponibile finché non accetti i documenti.', 'Not available until you accept the documents.', 'No disponible hasta que aceptes los documentos.']],
]);

it('nessuno dei quattro testi di chi non ha accettato nomina un documento o una versione, in nessuna lingua (sprint 24 · T2.4)', function () {
    $nominati = [];
    foreach (lingueDellaCornice() as $codice => $testi) {
        foreach (['acceptanceTitle', 'acceptanceText', 'acceptanceAction', 'acceptanceOff'] as $chiave) {
            foreach (documentiNominatiIn((string) ($testi[$chiave] ?? '')) as $parola) {
                $nominati[] = "$codice: «{$chiave}» dice «{$parola}»";
            }
        }
    }

    expect($nominati)->toBe([]);
});

it('il controllo vede il nome di un documento e una versione, in mezzo a una frase e in maiuscolo, e non una parola che li contiene (sprint 24 · T2.4)', function () {
    expect(documentiNominatiIn('Devi accettare i Termini di servizio e la Privacy.'))->toBe(['termini', 'privacy'])
        ->and(documentiNominatiIn('Accept the Terms (version 3) and the DPA v2.1'))->toBe(['terms', 'version', 'dpa', 'v2.1'])
        ->and(documentiNominatiIn('Acepta los términos, la política de privacidad y las cookies.'))->toBe(['términos', 'privacidad', 'cookies'])
        ->and(documentiNominatiIn('Per usare Zeiras devi accettare i documenti legali in vigore, a tempo determinato.'))->toBe([])
        ->and(documentiNominatiIn('Hay 2 documentos por aceptar'))->toBe([]);
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

it('nelle tre lingue il testo ha la parola «moduli» al posto di quella di prima; l\'aiuto della ricerca, che la aveva, dalla v1.12.0 non la ha più (sprint 21 · T1.1, T1.4; sprint 22 · T8.2)', function (string $chiave, array $attesi) {
    $lingue = lingueDellaCornice();

    expect([$lingue['it'][$chiave], $lingue['en'][$chiave], $lingue['es'][$chiave]])->toBe($attesi);
})->with([
    'T1.1: il nome del menu' => ['products', ['Moduli', 'Modules', 'Módulos']],
    'T1.4: la notifica di un modulo attivato o disattivato' => ['notificationTitle.com.zeiras.app.modificata', [
        'Un modulo è stato attivato o disattivato',
        'A module was turned on or off',
        'Se activó o desactivó un módulo',
    ]],
]);

// Sprint 22 · T8 (voce #1728; zr-pm, note 10255 e 10288 del progetto), riscritto nello sprint 25 · T4 (voce #1639). Il
// segnaposto del campo di ricerca e l'invito sotto il campo li compone la cornice dalle fonti del workspace: le lingue danno i
// due testi senza fonti, i due col posto dell'elenco (`{sources}`) e, per ogni tipo di risorsa del registro, il nome da elenco.
// Sprint 27 · T7 (voce #1810): il segnaposto è uno solo in ogni workspace e in ogni modulo, e non nomina più le fonti: la sua
// chiave resta, senza il posto dell'elenco, che ha il solo invito.

it('nelle tre lingue ci sono i due testi della ricerca senza fonti, il segnaposto unico e l\'invito col posto dell\'elenco (sprint 25 · T4.3; sprint 27 · T7.1, T7.5)', function (string $chiave, array $attesi) {
    $lingue = lingueDellaCornice();

    expect([$lingue['it'][$chiave] ?? null, $lingue['en'][$chiave] ?? null, $lingue['es'][$chiave] ?? null])->toBe($attesi);
})->with([
    'il segnaposto senza fonti' => ['searchPlaceholder', ['Cerca…', 'Search…', 'Busca…']],
    'l\'invito senza fonti' => ['searchHint', ['Scrivi almeno 2 caratteri.', 'Type at least 2 characters.', 'Escribe al menos 2 caracteres.']],
    'il segnaposto unico, di una ricerca che ha delle fonti' => ['searchPlaceholderSources', ['Cerca nel workspace…', 'Search the workspace…', 'Busca en el workspace…']],
    'l\'invito con le fonti' => ['searchHintSources', [
        'Cerca {sources}: scrivi almeno 2 caratteri.',
        'Search {sources}: type at least 2 characters.',
        'Busca {sources}: escribe al menos 2 caracteres.',
    ]],
]);

it('in ogni lingua ogni tipo di risorsa del registro ha il nome del gruppo e il nome da elenco, minuscolo; i quattro testi della ricerca non nominano nessuna fonte, l\'invito con le fonti ha una volta sola il posto dell\'elenco e gli altri tre non lo hanno, e i puntini dei segnaposto sono il carattere «…» (sprint 25 · T4.3, T4.5; sprint 27 · T7.5)', function (string $codice, array $gruppi, array $daElenco) {
    $testi = lingueDellaCornice()[$codice];
    $tipi = tipiDiRisorsa();
    $iQuattro = mb_strtolower(implode(' ', array_map(fn (string $chiave): string => (string) ($testi[$chiave] ?? ''), ['searchPlaceholder', 'searchHint', 'searchPlaceholderSources', 'searchHintSources'])));
    $segnaposto = [(string) ($testi['searchPlaceholder'] ?? ''), (string) ($testi['searchPlaceholderSources'] ?? '')];

    expect(array_map(fn (string $tipo) => $testi[$tipo] ?? null, $tipi))->toBe($gruppi)
        ->and(array_map(fn (string $tipo) => $testi["searchSource.$tipo"] ?? null, $tipi))->toBe($daElenco)
        ->and(array_map('mb_strtolower', $daElenco))->toBe($daElenco)
        ->and(array_values(array_filter($daElenco, fn (string $nome): bool => str_contains($iQuattro, $nome))))->toBe([])
        ->and([substr_count((string) ($testi['searchPlaceholderSources'] ?? ''), '{sources}'), substr_count((string) ($testi['searchHintSources'] ?? ''), '{sources}')])->toBe([0, 1])
        ->and(substr_count($testi['searchPlaceholder'].$testi['searchHint'].$testi['searchPlaceholderSources'], '{'))->toBe(0)
        ->and(array_map(fn (string $testo): string => mb_substr($testo, -1), $segnaposto))->toBe(['…', '…'])
        ->and(substr_count(implode('', $segnaposto), '.'))->toBe(0);
})->with([
    // Dallo sprint 27 il primo è il membro del workspace, che nel registro sta nella voce della Dashboard (T1.3).
    'italiano' => ['it', ['Membri', 'Schede', 'Board', 'Cartelle', 'Contatti', 'Aziende', 'Opportunità'], ['membri', 'schede', 'board', 'cartelle', 'contatti', 'aziende', 'opportunità']],
    'inglese' => ['en', ['Members', 'Cards', 'Boards', 'Folders', 'Contacts', 'Companies', 'Opportunities'], ['members', 'cards', 'boards', 'folders', 'contacts', 'companies', 'opportunities']],
    'spagnolo' => ['es', ['Miembros', 'Tarjetas', 'Tableros', 'Carpetas', 'Contactos', 'Empresas', 'Oportunidades'], ['miembros', 'tarjetas', 'tableros', 'carpetas', 'contactos', 'empresas', 'oportunidades']],
]);

// Sprint 27 · T1.3 (voce #1787): la ricerca trova i membri del workspace, e di un membro il backoffice dà il ruolo come codice
// (`amministratore`), mai come testo da mostrare. Il testo di ogni codice è delle lingue di zr-core, sotto
// `searchContext.<prodotto>.<tipo>.<chiave>.<codice>`, con le parole della pagina Impostazioni › Membri di zr-home; quali
// codici, lo dice il registro (`risorse[].codici`), e le lingue hanno un testo per ognuno e per nessun altro.
it('in ogni lingua i tre ruoli di un membro del workspace hanno il loro testo, quello della pagina dei membri, sotto il codice del registro (sprint 27 · T1.3)', function (string $codice, array $ruoli) {
    $testi = lingueDellaCornice()[$codice];

    expect(codiciDelContesto())->toBe(['home.workspace.membro.ruolo.proprietario', 'home.workspace.membro.ruolo.amministratore', 'home.workspace.membro.ruolo.membro'])
        ->and(array_map(fn (string $delRegistro) => $testi["searchContext.$delRegistro"] ?? null, codiciDelContesto()))->toBe($ruoli)
        ->and(array_values(preg_grep('/^searchContext\./', array_keys($testi)) ?: []))->toHaveCount(3);
})->with([
    'italiano' => ['it', ['Proprietario', 'Amministratore', 'Membro']],
    'inglese' => ['en', ['Owner', 'Admin', 'Member']],
    'spagnolo' => ['es', ['Propietario', 'Administrador', 'Miembro']],
]);

it('il controllo trova il testo di un ruolo che manca in una lingua, e il testo di un codice che il registro non ha: un ruolo in più, o il ruolo di un contatto, che è un testo libero (sprint 27 · T1.3)', function () {
    $lingue = lingueDellaCornice();
    unset($lingue['es']['searchContext.home.workspace.membro.ruolo.amministratore']);
    $lingue['en']['searchContext.home.workspace.membro.ruolo.ospite'] = 'Guest';
    $lingue['it']['searchContext.crm.crm.persona.ruolo.direttore'] = 'Direttore';

    expect(problemiDelleLingue($lingue))->toBe([
        'it: «searchContext.crm.crm.persona.ruolo.direttore» non è un testo della cornice',
        'es: manca «searchContext.home.workspace.membro.ruolo.amministratore»',
        'en: «searchContext.home.workspace.membro.ruolo.ospite» non è un testo della cornice',
    ]);
});

it('il controllo trova un tipo di risorsa senza il nome da elenco, un testo della ricerca che manca e un nome da elenco di un tipo che il registro non ha (sprint 25 · T4.5)', function () {
    $lingue = lingueDellaCornice();
    unset($lingue['es']['searchSource.crm.crm.persona'], $lingue['it']['searchHintSources']);
    $lingue['en']['searchSource.uat.ignoto'] = 'things';

    expect(problemiDelleLingue($lingue))->toBe([
        'it: manca «searchHintSources»',
        'es: manca «searchSource.crm.crm.persona»',
        'en: «searchSource.uat.ignoto» non è un testo della cornice',
    ]);
});

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

it('l\'italiano si scosta dal design system solo dove lo dice una decisione, e finché il design system non la porta: il nome del menu, e il segnaposto e l\'invito della ricerca (sprint 21 · T1; sprint 22 · T8)', function () {
    $delDesignSystem = testiItalianiDelDesignSystem();
    $conIlTestoDiPrima = lingueDellaCornice();
    $conIlTestoDiPrima['it']['products'] = 'Prodotti';
    $colSegnapostoDelDesignSystem = lingueDellaCornice();
    $colSegnapostoDelDesignSystem['it']['searchPlaceholder'] = $delDesignSystem['searchPlaceholder'];

    expect(array_keys(italianoDecisoPrimaDelDesignSystem()))->toBe(['products', 'searchHint', 'searchPlaceholder'])
        // Il design system dice ancora il testo di prima: quando dirà «Moduli», questa riga è rossa e lo scostamento si toglie.
        ->and($delDesignSystem['products'])->toBe('Prodotti')
        ->and($delDesignSystem['searchHint'])->toBe('Cerca in tutti i prodotti: scrivi almeno 2 caratteri.')
        // Il segnaposto del design system promette le stesse fonti in ogni workspace: nella cornice è un problema.
        ->and($delDesignSystem['searchPlaceholder'])->toBe('Cerca progetti, schede, contatti…')
        ->and(problemiDelleLingue($colSegnapostoDelDesignSystem))->toBe(['it: «searchPlaceholder» non è il testo deciso prima del design system'])
        // Dove c'è una decisione il testo giusto è quello deciso: quello del design system è un problema.
        ->and(problemiDelleLingue($conIlTestoDiPrima))->toBe(['it: «products» non è il testo deciso prima del design system']);
});
