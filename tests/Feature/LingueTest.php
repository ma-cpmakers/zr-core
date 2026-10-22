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
    preg_match('/var MODULES_NAV = \{(.*?)\] \};/s', $bundle, $menu);
    preg_match("/group: $stringa, products: true/", $menu[1] ?? '', $prodotti);
    preg_match_all("/\\{ id: '(\\w+)', label: $stringa/", $menu[1] ?? '', $voci, PREG_SET_ORDER);
    $testi += ['products' => $testo($prodotti[1] ?? '')];
    foreach ($voci as [, $id, $nome]) {
        $testi += [$id === 'home' ? 'dashboard' : $id => $testo($nome)];
    }

    return $testi;
}

/**
 * @param  string  $cartella  sotto resources/lingue: `''` per i testi, `'notifiche/'` per le frasi delle notifiche
 * @return array<string, array<string, mixed>> i file di quella cartella, per codice (il nome del file)
 */
function fileDelleLingue(string $cartella): array
{
    $perCodice = [];
    foreach (File::glob(__DIR__.'/../../resources/lingue/'.$cartella.'*.json') as $file) {
        $perCodice[basename($file, '.json')] = json_decode(File::get($file), true, flags: JSON_THROW_ON_ERROR);
    }

    return $perCodice;
}

/**
 * @return array<string, array<string, mixed>> ogni lingua di resources/lingue, per codice (il nome del file): i testi e, dallo
 *                                             sprint 30, le frasi delle notifiche, che stanno in resources/lingue/notifiche in
 *                                             un file con lo stesso nome. Che i due file non si pestino lo dice `problemiDeiDueFile`
 */
function lingueDellaCornice(): array
{
    $frasi = fileDelleLingue('notifiche/');
    $lingue = [];
    foreach (fileDelleLingue('') as $codice => $testi) {
        $lingue[$codice] = [...$testi, ...($frasi[$codice] ?? [])];
    }

    return $lingue;
}

/**
 * Cosa non torna fra i due file di ogni lingua (sprint 30 · T1.9): i testi della cornice stanno in resources/lingue, le frasi
 * delle notifiche — le chiavi `notificationTitle.<tipo>`, `notificationTitleWhoWhat.<tipo>`, `notificationTitleWho.<tipo>` e,
 * dallo sprint 34 · T2, le tre della riga sotto il titolo, `notificationUnder.<quale>` — in
 * resources/lingue/notifiche, e la cornice le carica quando si apre la campanella. `notificationTitle` da solo è il titolo di
 * ripiego e resta fra i testi: serve anche a chi le frasi non le ha ancora.
 *
 * @param  array<string, array<string, mixed>>  $testi  per codice
 * @param  array<string, array<string, mixed>>  $frasi  per codice
 * @return list<string>
 */
function problemiDeiDueFile(array $testi, array $frasi): array
{
    $eUnaFrase = fn (string $chiave): bool => preg_match('/^notification(Title(Who(What)?)?|Under)\../', $chiave) === 1;

    $problemi = [];
    foreach (array_diff(array_keys($testi), array_keys($frasi)) as $codice) {
        $problemi[] = "$codice: non ha il file delle frasi";
    }
    foreach (array_diff(array_keys($frasi), array_keys($testi)) as $codice) {
        $problemi[] = "$codice: non ha il file dei testi";
    }
    foreach ($testi as $codice => $delCodice) {
        foreach (array_filter(array_map(strval(...), array_keys($delCodice)), $eUnaFrase) as $chiave) {
            $problemi[] = "$codice: «{$chiave}» è una frase delle notifiche e sta fra i testi";
        }
    }
    foreach ($frasi as $codice => $delCodice) {
        foreach (array_filter(array_map(strval(...), array_keys($delCodice)), fn (string $chiave): bool => ! $eUnaFrase($chiave)) as $chiave) {
            $problemi[] = "$codice: «{$chiave}» non è una frase delle notifiche e sta fra le frasi";
        }
    }

    return $problemi;
}

/**
 * I tipi di evento del contratto pubblicato di `/v1`, scritti qui dal contratto: una notifica porta in `tipo` quello dell'evento
 * che l'ha generata. Un tipo nuovo del contratto entra qui e nelle lingue insieme, con una versione nuova di zr-core: tranne
 * un tipo che non genera notifiche, che qui non sta e non ha un titolo. Dal 12/10/2026 il contratto ne ha uno,
 * `com.zeiras.crm.persona.anonimizzata`: i tipi di evento del contratto sono 37, e qui ce ne sono 36. Dal 14/10/2026 due, con
 * `com.zeiras.crm.campo.modificato` (le impostazioni di un campo del CRM).
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
        ...array_keys(titoliDelleNotificheDeiMotiviDiPerdita()),
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
 * I titoli dei due tipi di evento che il contratto porta dal 13/10/2026 (10:23 UTC): un motivo di perdita del CRM creato o
 * modificato, con le parole di zr-crm («loss reason», «motivo de pérdida»). In italiano e in spagnolo «motivo» è al maschile:
 * ogni titolo è un testo intero per tipo. La tabella è scritta qui, non letta dai file delle lingue (sprint 36 · T5.1).
 *
 * @return array<string, array{it: string, en: string, es: string}>
 */
function titoliDelleNotificheDeiMotiviDiPerdita(): array
{
    return [
        'com.zeiras.crm.motivo.creato' => ['it' => 'Nuovo motivo di perdita', 'en' => 'New loss reason', 'es' => 'Nuevo motivo de pérdida'],
        'com.zeiras.crm.motivo.modificato' => ['it' => 'Motivo di perdita modificato', 'en' => 'Loss reason changed', 'es' => 'Motivo de pérdida modificado'],
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
 * Le frasi delle notifiche di Project Management che dicono chi ha fatto che cosa (sprint 29 · T2): per ogni tipo la frase con
 * chi e che cosa (`notificationTitleWhoWhat.<tipo>`, coi posti `{who}` e `{what}`) e quella con solo chi
 * (`notificationTitleWho.<tipo>`, col solo `{who}`). Un tipo `….eliminata` ha solo la seconda: di una cosa eliminata il
 * backoffice non dà il nome. Dallo sprint 31 (T1) anche i 18 tipi del CRM, con le parole di zr-crm: hanno la sola frase con chi
 * — il nome di un contatto è un dato personale, di una nota il contratto non dà il nome —, tranne le due della pipeline
 * e, dallo sprint 32 (T4), le sei di aziende, opportunità e attività create o modificate e, dallo sprint 34 (T3), le tre di un'azienda,
 * un'opportunità o un'attività assegnata: l'assegnazione di un contatto resta con la sola frase con chi.
 * Con T2 anche i cinque del workspace e `com.zeiras.app.modificata`, con le parole di zr-home: ogni tipo che ha un titolo ha la
 * frase con solo chi. Di un membro il contratto non dà il nome; di un modulo dà il codice, e la cornice ne scrive il nome.
 * La tabella è scritta qui, non letta dai file delle lingue.
 *
 * @return array<string, array{chiECosa: array{it: string, en: string, es: string}|null, chi: array{it: string, en: string, es: string}}>
 */
function frasiDelleNotificheConChi(): array
{
    return [
        'com.zeiras.board.cartella.creata' => [
            'chiECosa' => ['it' => '{who} ha creato l\'area «{what}»', 'en' => '{who} created the area “{what}”', 'es' => '{who} ha creado el área «{what}»'],
            'chi' => ['it' => '{who} ha creato un\'area', 'en' => '{who} created an area', 'es' => '{who} ha creado un área'],
        ],
        'com.zeiras.board.cartella.modificata' => [
            'chiECosa' => ['it' => '{who} ha modificato l\'area «{what}»', 'en' => '{who} changed the area “{what}”', 'es' => '{who} ha modificado el área «{what}»'],
            'chi' => ['it' => '{who} ha modificato un\'area', 'en' => '{who} changed an area', 'es' => '{who} ha modificado un área'],
        ],
        'com.zeiras.board.cartella.eliminata' => [
            'chiECosa' => null,
            'chi' => ['it' => '{who} ha eliminato un\'area', 'en' => '{who} deleted an area', 'es' => '{who} ha eliminado un área'],
        ],
        'com.zeiras.board.board.creata' => [
            'chiECosa' => ['it' => '{who} ha creato la board «{what}»', 'en' => '{who} created the board “{what}”', 'es' => '{who} ha creado el tablero «{what}»'],
            'chi' => ['it' => '{who} ha creato una board', 'en' => '{who} created a board', 'es' => '{who} ha creado un tablero'],
        ],
        'com.zeiras.board.board.modificata' => [
            'chiECosa' => ['it' => '{who} ha modificato la board «{what}»', 'en' => '{who} changed the board “{what}”', 'es' => '{who} ha modificado el tablero «{what}»'],
            'chi' => ['it' => '{who} ha modificato una board', 'en' => '{who} changed a board', 'es' => '{who} ha modificado un tablero'],
        ],
        'com.zeiras.board.lista.creata' => [
            'chiECosa' => ['it' => '{who} ha creato la lista «{what}»', 'en' => '{who} created the list “{what}”', 'es' => '{who} ha creado la lista «{what}»'],
            'chi' => ['it' => '{who} ha creato una lista', 'en' => '{who} created a list', 'es' => '{who} ha creado una lista'],
        ],
        'com.zeiras.board.lista.modificata' => [
            'chiECosa' => ['it' => '{who} ha modificato la lista «{what}»', 'en' => '{who} changed the list “{what}”', 'es' => '{who} ha modificado la lista «{what}»'],
            'chi' => ['it' => '{who} ha modificato una lista', 'en' => '{who} changed a list', 'es' => '{who} ha modificado una lista'],
        ],
        'com.zeiras.board.scheda.creata' => [
            'chiECosa' => ['it' => '{who} ha creato la scheda «{what}»', 'en' => '{who} created the card “{what}”', 'es' => '{who} ha creado la tarjeta «{what}»'],
            'chi' => ['it' => '{who} ha creato una scheda', 'en' => '{who} created a card', 'es' => '{who} ha creado una tarjeta'],
        ],
        'com.zeiras.board.scheda.modificata' => [
            'chiECosa' => ['it' => '{who} ha modificato la scheda «{what}»', 'en' => '{who} changed the card “{what}”', 'es' => '{who} ha modificado la tarjeta «{what}»'],
            'chi' => ['it' => '{who} ha modificato una scheda', 'en' => '{who} changed a card', 'es' => '{who} ha modificado una tarjeta'],
        ],
        'com.zeiras.board.scheda.eliminata' => [
            'chiECosa' => null,
            'chi' => ['it' => '{who} ha eliminato una scheda', 'en' => '{who} deleted a card', 'es' => '{who} ha eliminado una tarjeta'],
        ],
        'com.zeiras.board.etichetta.creata' => [
            'chiECosa' => ['it' => '{who} ha creato l\'etichetta «{what}»', 'en' => '{who} created the label “{what}”', 'es' => '{who} ha creado la etiqueta «{what}»'],
            'chi' => ['it' => '{who} ha creato un\'etichetta', 'en' => '{who} created a label', 'es' => '{who} ha creado una etiqueta'],
        ],
        'com.zeiras.board.etichetta.modificata' => [
            'chiECosa' => ['it' => '{who} ha modificato l\'etichetta «{what}»', 'en' => '{who} changed the label “{what}”', 'es' => '{who} ha modificado la etiqueta «{what}»'],
            'chi' => ['it' => '{who} ha modificato un\'etichetta', 'en' => '{who} changed a label', 'es' => '{who} ha modificado una etiqueta'],
        ],
        'com.zeiras.board.etichetta.eliminata' => [
            'chiECosa' => null,
            'chi' => ['it' => '{who} ha eliminato un\'etichetta', 'en' => '{who} deleted a label', 'es' => '{who} ha eliminado una etiqueta'],
        ],
        'com.zeiras.board.vista.creata' => [
            'chiECosa' => ['it' => '{who} ha creato la vista «{what}»', 'en' => '{who} created the view “{what}”', 'es' => '{who} ha creado la vista «{what}»'],
            'chi' => ['it' => '{who} ha creato una vista', 'en' => '{who} created a view', 'es' => '{who} ha creado una vista'],
        ],
        'com.zeiras.board.vista.modificata' => [
            'chiECosa' => ['it' => '{who} ha modificato la vista «{what}»', 'en' => '{who} changed the view “{what}”', 'es' => '{who} ha modificado la vista «{what}»'],
            'chi' => ['it' => '{who} ha modificato una vista', 'en' => '{who} changed a view', 'es' => '{who} ha modificado una vista'],
        ],
        'com.zeiras.board.vista.eliminata' => [
            'chiECosa' => null,
            'chi' => ['it' => '{who} ha eliminato una vista', 'en' => '{who} deleted a view', 'es' => '{who} ha eliminado una vista'],
        ],
        'board.scheda.assegnata' => [
            'chiECosa' => ['it' => '{who} ti ha assegnato la scheda «{what}»', 'en' => '{who} assigned you the card “{what}”', 'es' => '{who} te ha asignado la tarjeta «{what}»'],
            'chi' => ['it' => '{who} ti ha assegnato una scheda', 'en' => '{who} assigned you a card', 'es' => '{who} te ha asignado una tarjeta'],
        ],
        'board.commento.menzione' => [
            'chiECosa' => ['it' => '{who} ti ha menzionato in «{what}»', 'en' => '{who} mentioned you in “{what}”', 'es' => '{who} te ha mencionado en «{what}»'],
            'chi' => ['it' => '{who} ti ha menzionato in un commento', 'en' => '{who} mentioned you in a comment', 'es' => '{who} te ha mencionado en un comentario'],
        ],
        'com.zeiras.crm.persona.creata' => [
            'chiECosa' => null,
            'chi' => ['it' => '{who} ha creato un contatto', 'en' => '{who} created a contact', 'es' => '{who} ha creado un contacto'],
        ],
        'com.zeiras.crm.persona.modificata' => [
            'chiECosa' => null,
            'chi' => ['it' => '{who} ha modificato un contatto', 'en' => '{who} edited a contact', 'es' => '{who} ha modificado un contacto'],
        ],
        'com.zeiras.crm.organizzazione.creata' => [
            'chiECosa' => ['it' => '{who} ha creato l\'azienda «{what}»', 'en' => '{who} created the company “{what}”', 'es' => '{who} ha creado la empresa «{what}»'],
            'chi' => ['it' => '{who} ha creato un\'azienda', 'en' => '{who} created a company', 'es' => '{who} ha creado una empresa'],
        ],
        'com.zeiras.crm.organizzazione.modificata' => [
            'chiECosa' => ['it' => '{who} ha modificato l\'azienda «{what}»', 'en' => '{who} edited the company “{what}”', 'es' => '{who} ha modificado la empresa «{what}»'],
            'chi' => ['it' => '{who} ha modificato un\'azienda', 'en' => '{who} edited a company', 'es' => '{who} ha modificado una empresa'],
        ],
        'com.zeiras.crm.trattativa.creata' => [
            'chiECosa' => ['it' => '{who} ha creato l\'opportunità «{what}»', 'en' => '{who} created the opportunity “{what}”', 'es' => '{who} ha creado la oportunidad «{what}»'],
            'chi' => ['it' => '{who} ha creato un\'opportunità', 'en' => '{who} created an opportunity', 'es' => '{who} ha creado una oportunidad'],
        ],
        'com.zeiras.crm.trattativa.modificata' => [
            'chiECosa' => ['it' => '{who} ha modificato l\'opportunità «{what}»', 'en' => '{who} edited the opportunity “{what}”', 'es' => '{who} ha modificado la oportunidad «{what}»'],
            'chi' => ['it' => '{who} ha modificato un\'opportunità', 'en' => '{who} edited an opportunity', 'es' => '{who} ha modificado una oportunidad'],
        ],
        'com.zeiras.crm.attivita.creata' => [
            'chiECosa' => ['it' => '{who} ha creato l\'attività «{what}»', 'en' => '{who} created the activity “{what}”', 'es' => '{who} ha creado la actividad «{what}»'],
            'chi' => ['it' => '{who} ha creato un\'attività', 'en' => '{who} created an activity', 'es' => '{who} ha creado una actividad'],
        ],
        'com.zeiras.crm.attivita.modificata' => [
            'chiECosa' => ['it' => '{who} ha modificato l\'attività «{what}»', 'en' => '{who} edited the activity “{what}”', 'es' => '{who} ha modificado la actividad «{what}»'],
            'chi' => ['it' => '{who} ha modificato un\'attività', 'en' => '{who} edited an activity', 'es' => '{who} ha modificado una actividad'],
        ],
        'com.zeiras.crm.attivita.eliminata' => [
            'chiECosa' => null,
            'chi' => ['it' => '{who} ha eliminato un\'attività', 'en' => '{who} deleted an activity', 'es' => '{who} ha eliminado una actividad'],
        ],
        // Sprint 36 · T5: i motivi di perdita, con la sola frase con chi (zr-crm non ne ha data una col nome).
        'com.zeiras.crm.motivo.creato' => [
            'chiECosa' => null,
            'chi' => ['it' => '{who} ha creato un motivo di perdita', 'en' => '{who} created a loss reason', 'es' => '{who} ha creado un motivo de pérdida'],
        ],
        'com.zeiras.crm.motivo.modificato' => [
            'chiECosa' => null,
            'chi' => ['it' => '{who} ha modificato un motivo di perdita', 'en' => '{who} edited a loss reason', 'es' => '{who} ha modificado un motivo de pérdida'],
        ],
        'com.zeiras.crm.nota.creata' => [
            'chiECosa' => null,
            'chi' => ['it' => '{who} ha creato una nota', 'en' => '{who} created a note', 'es' => '{who} ha creado una nota'],
        ],
        'com.zeiras.crm.nota.modificata' => [
            'chiECosa' => null,
            'chi' => ['it' => '{who} ha modificato una nota', 'en' => '{who} edited a note', 'es' => '{who} ha modificado una nota'],
        ],
        'com.zeiras.crm.nota.eliminata' => [
            'chiECosa' => null,
            'chi' => ['it' => '{who} ha eliminato una nota', 'en' => '{who} deleted a note', 'es' => '{who} ha eliminado una nota'],
        ],
        'com.zeiras.crm.pipeline.creata' => [
            'chiECosa' => ['it' => '{who} ha creato la pipeline «{what}»', 'en' => '{who} created the pipeline “{what}”', 'es' => '{who} ha creado la pipeline «{what}»'],
            'chi' => ['it' => '{who} ha creato una pipeline', 'en' => '{who} created a pipeline', 'es' => '{who} ha creado una pipeline'],
        ],
        'com.zeiras.crm.pipeline.modificata' => [
            'chiECosa' => ['it' => '{who} ha modificato la pipeline «{what}»', 'en' => '{who} edited the pipeline “{what}”', 'es' => '{who} ha modificado la pipeline «{what}»'],
            'chi' => ['it' => '{who} ha modificato una pipeline', 'en' => '{who} edited a pipeline', 'es' => '{who} ha modificado una pipeline'],
        ],
        'crm.persona.assegnata' => [
            'chiECosa' => null,
            'chi' => ['it' => '{who} ti ha assegnato un contatto', 'en' => '{who} assigned you a contact', 'es' => '{who} te ha asignado un contacto'],
        ],
        'crm.organizzazione.assegnata' => [
            'chiECosa' => ['it' => '{who} ti ha assegnato l\'azienda «{what}»', 'en' => '{who} assigned you the company “{what}”', 'es' => '{who} te ha asignado la empresa «{what}»'],
            'chi' => ['it' => '{who} ti ha assegnato un\'azienda', 'en' => '{who} assigned you a company', 'es' => '{who} te ha asignado una empresa'],
        ],
        'crm.trattativa.assegnata' => [
            'chiECosa' => ['it' => '{who} ti ha assegnato l\'opportunità «{what}»', 'en' => '{who} assigned you the opportunity “{what}”', 'es' => '{who} te ha asignado la oportunidad «{what}»'],
            'chi' => ['it' => '{who} ti ha assegnato un\'opportunità', 'en' => '{who} assigned you an opportunity', 'es' => '{who} te ha asignado una oportunidad'],
        ],
        'crm.attivita.assegnata' => [
            'chiECosa' => ['it' => '{who} ti ha assegnato l\'attività «{what}»', 'en' => '{who} assigned you the activity “{what}”', 'es' => '{who} te ha asignado la actividad «{what}»'],
            'chi' => ['it' => '{who} ti ha assegnato un\'attività', 'en' => '{who} assigned you an activity', 'es' => '{who} te ha asignado una actividad'],
        ],
        'com.zeiras.workspace.creato' => [
            'chiECosa' => ['it' => '{who} ha creato il workspace «{what}»', 'en' => '{who} created the workspace “{what}”', 'es' => '{who} ha creado el workspace «{what}»'],
            'chi' => ['it' => '{who} ha creato il workspace', 'en' => '{who} created the workspace', 'es' => '{who} ha creado el workspace'],
        ],
        'com.zeiras.workspace.modificato' => [
            'chiECosa' => ['it' => '{who} ha modificato il workspace «{what}»', 'en' => '{who} changed the workspace “{what}”', 'es' => '{who} ha modificado el workspace «{what}»'],
            'chi' => ['it' => '{who} ha modificato il workspace', 'en' => '{who} changed the workspace', 'es' => '{who} ha modificado el workspace'],
        ],
        'com.zeiras.workspace.membro.creato' => [
            'chiECosa' => null,
            'chi' => ['it' => '{who} è ora nel workspace', 'en' => '{who} joined the workspace', 'es' => '{who} ya está en el workspace'],
        ],
        'com.zeiras.workspace.membro.modificato' => [
            'chiECosa' => null,
            'chi' => ['it' => '{who} ha cambiato il ruolo di un membro', 'en' => '{who} changed a member\'s role', 'es' => '{who} ha cambiado el rol de un miembro'],
        ],
        'com.zeiras.workspace.membro.eliminato' => [
            'chiECosa' => null,
            'chi' => ['it' => '{who} ha tolto una persona dal workspace', 'en' => '{who} removed someone from the workspace', 'es' => '{who} ha quitado a una persona del workspace'],
        ],
        'com.zeiras.app.modificata' => [
            'chiECosa' => ['it' => '{who} ha attivato o disattivato il modulo «{what}»', 'en' => '{who} turned the module “{what}” on or off', 'es' => '{who} ha activado o desactivado el módulo «{what}»'],
            'chi' => ['it' => '{who} ha attivato o disattivato un modulo', 'en' => '{who} turned a module on or off', 'es' => '{who} ha activado o desactivado un módulo'],
        ],
    ];
}

/** @return list<string> le chiavi delle frasi con chi: `notificationTitleWhoWhat.<tipo>` e `notificationTitleWho.<tipo>` */
function chiaviDelleFrasiConChi(): array
{
    $chiavi = [];
    foreach (frasiDelleNotificheConChi() as $tipo => $frasi) {
        if ($frasi['chiECosa'] !== null) {
            $chiavi[] = "notificationTitleWhoWhat.$tipo";
        }
        $chiavi[] = "notificationTitleWho.$tipo";
    }

    return $chiavi;
}

/**
 * Cosa non torna nelle frasi con chi di una lingua: una frase di un tipo che non ha un titolo (`notificationTitle.<tipo>`), o
 * una che non ha esattamente i suoi segnaposto, una volta ciascuno: `{who}` e `{what}` quella con chi e che cosa, il solo
 * `{who}` l'altra.
 *
 * @param  array<string, mixed>  $testi
 * @return list<string>
 */
function problemiDelleFrasiConChi(array $testi): array
{
    $problemi = [];
    foreach ($testi as $chiave => $testo) {
        if (preg_match('/^notificationTitleWho(What)?\.(.+)$/', (string) $chiave, $parti) !== 1) {
            continue;
        }
        if (! array_key_exists('notificationTitle.'.$parti[2], $testi)) {
            $problemi[] = "«{$chiave}» è di un tipo che non ha un titolo";
        }
        preg_match_all('/\{[^{}]*\}/', is_string($testo) ? $testo : '', $segnaposto);
        $attesi = $parti[1] === 'What' ? ['{what}', '{who}'] : ['{who}'];
        $trovati = $segnaposto[0];
        sort($trovati);
        if ($trovati !== $attesi) {
            $problemi[] = "«{$chiave}» ha ".($trovati === [] ? 'nessun segnaposto' : implode(' ', $trovati)).' invece di '.implode(' ', $attesi);
        }
    }

    return $problemi;
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
 * Le tre frasi della riga sotto il titolo di una notifica (sprint 34 · T2, voce #1930): quante azioni racconta e in quale board
 * sta la cosa, il solo conto, la sola board. `{n}` è il conto, da due in su; `{board}` il nome della board, che la cornice
 * pulisce e isola. Le parole sono di zr-board. Scritte qui, non lette dai file delle lingue.
 *
 * @return array<string, array{it: string, es: string, en: string}>
 */
function frasiSottoIlTitolo(): array
{
    return [
        'notificationUnder.countBoard' => ['it' => '{n} volte, nella board «{board}»', 'es' => '{n} veces, en el tablero «{board}»', 'en' => '{n} times, on the board “{board}”'],
        'notificationUnder.count' => ['it' => '{n} volte', 'es' => '{n} veces', 'en' => '{n} times'],
        'notificationUnder.board' => ['it' => 'Nella board «{board}»', 'es' => 'En el tablero «{board}»', 'en' => 'On the board “{board}”'],
    ];
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
        'acceptanceTitle', 'acceptanceText', 'acceptanceAction', 'acceptanceOff', 'downTitle', 'downText', 'downOff', 'skipToContent',
        // Sprint 25 · T4: i due testi della ricerca dei workspace con le fonti, e il nome da elenco di ogni tipo di risorsa.
        // Dalla `v1.17.0` le fonti le nomina il solo invito: il segnaposto è uno, e la sua chiave resta.
        'searchPlaceholderSources', 'searchHintSources',
        ...chiaviDeiTitoliDelleNotifiche(), ...chiaviDelleFrasiConChi(), ...array_keys(frasiSottoIlTitolo()), ...$prodotti, ...tipiDiRisorsa(),
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
            'pm' => 'Board', 'crm' => 'CRM', 'bookings' => 'Bookings', 'flow' => 'Finanze', 'reports' => 'Report',
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

it('ogni lingua ha il titolo di ognuno dei 44 tipi di notifica, 38 dei 40 tipi di evento del contratto (i due che non generano notifiche non hanno un titolo) più i sei che non sono eventi — i cinque «assegnata», quattro del CRM e uno di Project Management, e la menzione in un commento —, né uno in più né uno in meno (sprint 12 · T3.3; sprint 21 · T2.1, T5.3; sprint 22 · T5.4; sprint 24 · T3.1; sprint 26 · T6.1)', function (string $codice) {
    $titoli = array_values(array_filter(
        array_keys(lingueDellaCornice()[$codice] ?? []),
        fn (string $chiave) => str_starts_with($chiave, 'notificationTitle.'),
    ));

    expect(array_unique(tipiDiNotificaDelContratto()))->toHaveCount(38)
        ->and(array_unique(tipiDiNotificaConUnTitolo()))->toHaveCount(44)
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

it('le due notifiche dei motivi di perdita del CRM hanno il titolo della tabella nella lingua, non quello di ripiego né quello di un\'altra lingua, e sono tipi di evento del contratto (sprint 36 · T5.1)', function (string $codice) {
    $testi = lingueDellaCornice()[$codice] ?? [];
    $tabella = titoliDelleNotificheDeiMotiviDiPerdita();
    $titoli = [];
    foreach (array_keys($tabella) as $tipo) {
        $titoli[$tipo] = $testi["notificationTitle.$tipo"] ?? null;
    }
    $delleAltreLingue = [];
    foreach ($tabella as $perLingua) {
        unset($perLingua[$codice]);
        $delleAltreLingue = [...$delleAltreLingue, ...array_values($perLingua)];
    }

    // Tutti e due insieme: un rosso li mostra tutti, non solo il primo che manca.
    expect($tabella)->toHaveCount(2)
        ->and($titoli)->toBe(array_map(fn (array $perLingua) => $perLingua[$codice], $tabella))
        // Nessuno dei due è il titolo di ripiego, né il testo di un'altra lingua.
        ->and($testi['notificationTitle'] ?? null)->not->toBeIn(array_values($titoli))
        ->and(array_intersect(array_values($titoli), $delleAltreLingue))->toBe([])
        // Sono eventi: il tipo ha `com.zeiras.` davanti, e senza non ha un titolo.
        ->and(array_diff(array_keys($tabella), tipiDiNotificaDelContratto()))->toBe([])
        ->and($testi)->not->toHaveKey('notificationTitle.crm.motivo.creato')
        ->and($testi)->not->toHaveKey('notificationTitle.crm.motivo.modificato');
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

it('ogni lingua ha due file con lo stesso nome, i testi e le frasi delle notifiche: le frasi stanno solo nel secondo, il titolo di ripiego resta nel primo, e insieme sono i testi della cornice (sprint 30 · T1.9)', function () {
    $testi = fileDelleLingue('');
    $frasi = fileDelleLingue('notifiche/');

    expect(array_keys($testi))->toContain('it', 'es', 'en')
        ->and(problemiDeiDueFile($testi, $frasi))->toBe([])
        ->and(array_filter($frasi, fn (array $delCodice): bool => $delCodice === []))->toBe([])
        ->and(array_filter($testi, fn (array $delCodice): bool => ! is_string($delCodice['notificationTitle'] ?? null)))->toBe([])
        // Insieme, né un testo di meno né uno di più: è il controllo di sempre, sui due file di ogni lingua.
        ->and(problemiDelleLingue(lingueDellaCornice()))->toBe([]);
});

it('il controllo dei due file trova una lingua con un file solo, una frase rimasta fra i testi e un testo finito fra le frasi (sprint 30 · T1.9)', function () {
    $testi = [
        'it' => ['dashboard' => 'Dashboard', 'notificationTitle' => 'Novità nel workspace', 'notificationTitleWho.board.scheda.assegnata' => '{who} ti ha assegnato una scheda'],
        'es' => ['dashboard' => 'Dashboard', 'notificationTitle' => 'Novedades en el workspace', 'notificationUnder.count' => '{n} veces'],
        'en' => ['dashboard' => 'Dashboard', 'notificationTitle.com.zeiras.board.scheda.creata' => 'New card'],
    ];
    $frasi = [
        'it' => ['notificationTitle.com.zeiras.board.scheda.creata' => 'Nuova scheda', 'notificationTitle' => 'Novità nel workspace'],
        'en' => ['notificationTitleWhoWhat.com.zeiras.board.scheda.creata' => '{who} created the card “{what}”', 'unreadOne' => 'unread'],
        'fr' => ['notificationTitle.com.zeiras.board.scheda.creata' => 'Nouvelle carte'],
    ];

    expect(problemiDeiDueFile($testi, $frasi))->toEqualCanonicalizing([
        'es: non ha il file delle frasi',
        'fr: non ha il file dei testi',
        'it: «notificationTitleWho.board.scheda.assegnata» è una frase delle notifiche e sta fra i testi',
        'es: «notificationUnder.count» è una frase delle notifiche e sta fra i testi',
        'en: «notificationTitle.com.zeiras.board.scheda.creata» è una frase delle notifiche e sta fra i testi',
        'it: «notificationTitle» non è una frase delle notifiche e sta fra le frasi',
        'en: «unreadOne» non è una frase delle notifiche e sta fra le frasi',
    ]);
});

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

// Sprint 34 · T4 (voce #1932): quando la parte server non ha potuto leggere il backoffice (`Cornice::dopo()` con `non_letti`)
// la cornice esce ridotta con un avviso suo, senza pulsante. I tre testi sono di zr-core, e non parlano di documenti: non è
// lo stato di chi non ha accettato.
it('i tre testi di quando Zeiras non risponde ci sono nelle tre lingue, sono di zr-core e nessuno parla di documenti (sprint 34 · T4.6)', function (string $chiave, array $attesi) {
    $lingue = lingueDellaCornice();
    $nelleTre = [$lingue['it'][$chiave] ?? null, $lingue['en'][$chiave] ?? null, $lingue['es'][$chiave] ?? null];

    expect($nelleTre)->toBe($attesi)
        ->and(chiaviDiAppShellLabels())->not->toContain($chiave)
        ->and(array_filter($attesi, fn (string $testo): bool => preg_match('/document/iu', $testo) === 1))->toBe([]);
})->with([
    'il titolo dell\'avviso' => ['downTitle', ['Zeiras non risponde', 'Zeiras is not responding', 'Zeiras no responde']],
    'la frase dell\'avviso' => ['downText', [
        'Moduli, notifiche e ricerca tornano quando Zeiras risponde. Riprova fra poco.',
        'Modules, notifications and search come back when Zeiras responds. Try again shortly.',
        'Los módulos, las notificaciones y la búsqueda vuelven cuando Zeiras responda. Inténtalo de nuevo en breve.',
    ]],
    'campanella e ricerca spente' => ['downOff', ['Non disponibile finché Zeiras non risponde.', 'Not available until Zeiras responds.', 'No disponible hasta que Zeiras responda.']],
]);

// Sprint 28 · T4 (voce #1828): «Salta al contenuto», il primo elemento della cornice da tastiera. L'`AppShell` non ne ha uno:
// il testo è di zr-core, finché il design system non porta il suo.
it('il testo di «Salta al contenuto» c\'è nelle tre lingue ed è di zr-core: l\'AppShell non ha una chiave con quel nome (sprint 28 · T4.1)', function () {
    $lingue = lingueDellaCornice();

    expect([$lingue['it']['skipToContent'] ?? null, $lingue['en']['skipToContent'] ?? null, $lingue['es']['skipToContent'] ?? null])
        ->toBe(['Salta al contenuto', 'Skip to content', 'Saltar al contenido'])
        ->and(chiaviDiAppShellLabels())->not->toContain('skipToContent')
        ->and(problemiDelleLingue(array_map(fn (array $testi): array => array_diff_key($testi, ['skipToContent' => true]), $lingue)))->not->toBe([]);
});

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
    'italiano' => ['it', ['Membri', 'Schede', 'Board', 'Aree', 'Contatti', 'Aziende', 'Opportunità'], ['membri', 'schede', 'board', 'aree', 'contatti', 'aziende', 'opportunità']],
    'inglese' => ['en', ['Members', 'Cards', 'Boards', 'Areas', 'Contacts', 'Companies', 'Opportunities'], ['members', 'cards', 'boards', 'areas', 'contacts', 'companies', 'opportunities']],
    'spagnolo' => ['es', ['Miembros', 'Tarjetas', 'Tableros', 'Áreas', 'Contactos', 'Empresas', 'Oportunidades'], ['miembros', 'tarjetas', 'tableros', 'áreas', 'contactos', 'empresas', 'oportunidades']],
]);

// Sprint 27 · T1.3 (voce #1787): la ricerca trova i membri del workspace, e di un membro il backoffice dà il ruolo come codice
// (`amministratore`), mai come testo da mostrare. Il testo di ogni codice è delle lingue di zr-core, sotto
// `searchContext.<voce>.<tipo>.<chiave>.<codice>`, con le parole della pagina Impostazioni › Membri di zr-home; quali
// codici, lo dice il registro (`risorse[].codici`), e le lingue hanno un testo per ognuno e per nessun altro.
// Sprint 28 · T1.4 (voce #1826): dopo i tre ruoli, i due esiti di un'opportunità chiusa, con le parole che zr-crm usa per lo
// stato di un'opportunità. `aperta` non è un codice del registro, e nessuna lingua le dà un testo.
it('in ogni lingua i tre ruoli di un membro del workspace e i due esiti di un\'opportunità chiusa hanno il loro testo sotto il codice del registro; `aperta` non ne ha uno (sprint 27 · T1.3; sprint 28 · T1.4)', function (string $codice, array $attesi) {
    $testi = lingueDellaCornice()[$codice];

    expect(codiciDelContesto())->toBe([
        'home.workspace.membro.ruolo.proprietario', 'home.workspace.membro.ruolo.amministratore', 'home.workspace.membro.ruolo.membro',
        'crm.crm.trattativa.esito.vinta', 'crm.crm.trattativa.esito.persa',
    ])
        ->and(array_map(fn (string $delRegistro) => $testi["searchContext.$delRegistro"] ?? null, codiciDelContesto()))->toBe($attesi)
        ->and(array_values(preg_grep('/^searchContext\./', array_keys($testi)) ?: []))->toHaveCount(5)
        ->and(array_values(preg_grep('/^searchContext\..*\.aperta$/', array_keys($testi)) ?: []))->toBe([]);
})->with([
    'italiano' => ['it', ['Proprietario', 'Amministratore', 'Membro', 'Vinta', 'Persa']],
    'inglese' => ['en', ['Owner', 'Admin', 'Member', 'Won', 'Lost']],
    'spagnolo' => ['es', ['Propietario', 'Administrador', 'Miembro', 'Ganada', 'Perdida']],
]);

it('il controllo trova l\'esito di un\'opportunità che manca in una lingua, e un testo per `aperta`, che non è un codice del registro (sprint 28 · T1.4)', function () {
    $lingue = lingueDellaCornice();
    unset($lingue['es']['searchContext.crm.crm.trattativa.esito.persa']);
    $lingue['it']['searchContext.crm.crm.trattativa.esito.aperta'] = 'Aperta';

    expect(problemiDelleLingue($lingue))->toBe([
        'it: «searchContext.crm.crm.trattativa.esito.aperta» non è un testo della cornice',
        'es: manca «searchContext.crm.crm.trattativa.esito.persa»',
    ]);
});

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

it('l\'italiano si scosta dal design system solo dove lo dice una decisione, e finché il design system non la porta: il segnaposto e l\'invito della ricerca; dal design system del 21/10/2026 il nome del menu, «Moduli», è quello suo (sprint 21 · T1; sprint 22 · T8)', function () {
    $delDesignSystem = testiItalianiDelDesignSystem();
    $conIlTestoDiPrima = lingueDellaCornice();
    $conIlTestoDiPrima['it']['products'] = 'Prodotti';
    $colSegnapostoDelDesignSystem = lingueDellaCornice();
    $colSegnapostoDelDesignSystem['it']['searchPlaceholder'] = $delDesignSystem['searchPlaceholder'];

    expect(array_keys(italianoDecisoPrimaDelDesignSystem()))->toBe(['searchHint', 'searchPlaceholder'])
        // Il design system dice «Moduli» dal 21/10/2026: il nome del menu non è più uno scostamento.
        ->and($delDesignSystem['products'])->toBe('Moduli')
        ->and($delDesignSystem['searchHint'])->toBe('Cerca in tutti i moduli: scrivi almeno 2 caratteri.')
        // Il segnaposto del design system promette le stesse fonti in ogni workspace: nella cornice è un problema.
        ->and($delDesignSystem['searchPlaceholder'])->toBe('Cerca progetti, schede, contatti…')
        ->and(problemiDelleLingue($colSegnapostoDelDesignSystem))->toBe(['it: «searchPlaceholder» non è il testo deciso prima del design system'])
        // Il nome del menu ora è quello del design system: «Prodotti» è un problema.
        ->and(problemiDelleLingue($conIlTestoDiPrima))->toBe(['it: «products» non è il testo del design system']);
});

// Sprint 34 · T2 (voce #1930). La riga sotto il titolo di una notifica dice quante azioni racconta e in quale board sta la cosa:
// tre frasi per lingua, nel file delle frasi delle notifiche.

it('ogni lingua ha le tre frasi della riga sotto il titolo di una notifica, nel file delle frasi e non fra i testi, con le parole di zr-board e ogni segnaposto una volta sola (sprint 34 · T2.1, T2.2)', function (string $codice) {
    $frasi = fileDelleLingue('notifiche/')[$codice] ?? [];
    $sotto = array_filter($frasi, fn (string $chiave) => str_starts_with($chiave, 'notificationUnder'), ARRAY_FILTER_USE_KEY);
    $attese = array_map(fn (array $perLingua): string => $perLingua[$codice], frasiSottoIlTitolo());
    ksort($sotto);
    ksort($attese);

    expect($sotto)->toBe($attese)
        ->and(array_filter(array_keys(fileDelleLingue('')[$codice] ?? []), fn (string $chiave) => str_starts_with($chiave, 'notificationUnder')))->toBe([])
        // L'inglese dice «on the board», non «in the board».
        ->and(str_contains(implode(' ', $sotto), 'in the board'))->toBe(false)
        // Mai «1 volta»: il conto si scrive da due in su, e la frase ha solo il plurale.
        ->and(array_map(fn (string $frase): array => [substr_count($frase, '{n}'), substr_count($frase, '{board}')], $attese))
        ->toBe(['notificationUnder.board' => [0, 1], 'notificationUnder.count' => [1, 0], 'notificationUnder.countBoard' => [1, 1]]);
})->with(['it', 'en', 'es']);

// Sprint 29 · T2 (voce #1865). Una notifica di Project Management dice chi ha fatto che cosa: le frasi sono testi delle lingue,
// due famiglie di chiavi accanto ai titoli. Il nome di chi e quello della cosa li mette la cornice al posto dei segnaposto.

it('ogni tipo di notifica che ha un titolo ha in ogni lingua la frase con solo chi, e ventotto anche quella con chi e che cosa: 72 chiavi, coi testi della tabella e ognuna coi suoi segnaposto una volta sola (sprint 29 · T2.7; sprint 31 · T1.1, T2.1; sprint 32 · T4.3; sprint 34 · T3.1, T3.2; sprint 36 · T5.1)', function (string $codice) {
    $testi = lingueDellaCornice()[$codice] ?? [];
    $attese = [];
    foreach (frasiDelleNotificheConChi() as $tipo => $frasi) {
        if ($frasi['chiECosa'] !== null) {
            $attese["notificationTitleWhoWhat.$tipo"] = $frasi['chiECosa'][$codice];
        }
        $attese["notificationTitleWho.$tipo"] = $frasi['chi'][$codice];
    }
    $delleFrasi = array_filter($testi, fn (string $chiave) => str_starts_with($chiave, 'notificationTitleWho'), ARRAY_FILTER_USE_KEY);
    ksort($attese);
    ksort($delleFrasi);
    $conLeFrasi = array_keys(frasiDelleNotificheConChi());
    $conUnTitolo = array_values(array_unique(tipiDiNotificaConUnTitolo()));
    sort($conLeFrasi);
    sort($conUnTitolo);

    expect($attese)->toHaveCount(72)
        // Nessun tipo che ha un titolo resta senza la frase con solo chi (T2.1), e nessuna frase è di un tipo senza titolo.
        ->and($conLeFrasi)->toBe($conUnTitolo)
        ->and($conLeFrasi)->toHaveCount(44)
        ->and(array_filter(frasiDelleNotificheConChi(), fn (array $frasi) => $frasi['chiECosa'] !== null))->toHaveCount(28)
        // Sprint 34 · T3.2: l'assegnazione di un contatto non ha la frase col nome, nemmeno se un nome arrivasse.
        ->and($delleFrasi)->not->toHaveKey('notificationTitleWhoWhat.crm.persona.assegnata')
        // Tutte insieme: un rosso le mostra tutte, non solo la prima che manca.
        ->and($delleFrasi)->toBe($attese)
        ->and(problemiDelleFrasiConChi($testi))->toBe([]);
})->with(['it', 'en', 'es']);

it('il controllo delle frasi vede un segnaposto perso, uno che non è suo, uno scritto due volte, uno con un altro nome e la frase di un tipo senza titolo (sprint 29 · T2.7)', function () {
    $testi = [
        'notificationTitle.com.zeiras.board.scheda.modificata' => 'Tarjeta modificada',
        'notificationTitle.com.zeiras.board.scheda.creata' => 'Nueva tarjeta',
        'notificationTitleWhoWhat.com.zeiras.board.scheda.modificata' => '{who} ha modificado la tarjeta',
        'notificationTitleWho.com.zeiras.board.scheda.modificata' => '{who} ha modificado «{what}»',
        'notificationTitleWhoWhat.com.zeiras.board.scheda.creata' => '{who} y {who} han creado la tarjeta «{what}»',
        'notificationTitleWho.com.zeiras.board.scheda.creata' => '{quien} ha creado una tarjeta',
        'notificationTitleWho.com.zeiras.board.scheda.spostata' => '{who} ha movido una tarjeta',
    ];
    $giuste = [
        'notificationTitle.board.scheda.assegnata' => 'Se te ha asignado una tarjeta',
        'notificationTitleWhoWhat.board.scheda.assegnata' => '{who} te ha asignado la tarjeta «{what}»',
        'notificationTitleWho.board.scheda.assegnata' => '{who} te ha asignado una tarjeta',
        'unreadOne' => 'Tienes {n} sin leer',
    ];

    expect(problemiDelleFrasiConChi($testi))->toBe([
        '«notificationTitleWhoWhat.com.zeiras.board.scheda.modificata» ha {who} invece di {what} {who}',
        '«notificationTitleWho.com.zeiras.board.scheda.modificata» ha {what} {who} invece di {who}',
        '«notificationTitleWhoWhat.com.zeiras.board.scheda.creata» ha {what} {who} {who} invece di {what} {who}',
        '«notificationTitleWho.com.zeiras.board.scheda.creata» ha {quien} invece di {who}',
        '«notificationTitleWho.com.zeiras.board.scheda.spostata» è di un tipo che non ha un titolo',
    ])->and(problemiDelleFrasiConChi($giuste))->toBe([]);
});
