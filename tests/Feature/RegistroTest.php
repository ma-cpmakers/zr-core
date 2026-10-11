<?php

use Illuminate\Support\Facades\File;
use Zeiras\Core\Http\NotificheDellaCornice;

// Sprint 1 · T4 e T7 (voce #1255). Il registro dei prodotti di zr-core, resources/registro/prodotti.json: nell'ordine della linea
// guida 10 del design system, Dashboard e i sei prodotti, ognuno con un id del design system, un'icona del set (`IconName`), un
// tono (`Tone`, tranne Dashboard), l'indirizzo della mappa della linea guida 15 e «Presto». I nomi non ci sono: stanno nelle lingue
// (T7, decisione 5926 di Luciano). I tipi si leggono dalla copia derivata di index.d.ts; ordine, icone, toni, indirizzi e «Presto»
// sono quelli del design system alla versione delle copie in resources/zeiras/ (README «Iconografia», linee guida 10 e 15, anteprima
// dell'AppShell). Sprint 3 · T5 (voce #1277): le risorse di un prodotto che la ricerca mostra, ognuna col tipo del backoffice,
// un'icona del set, il percorso nel prodotto e se è un contenitore; i loro nomi stanno nelle lingue, con `<prodotto>.<tipo>`.
// Sprint 5 · T4 (voce #1257): il tipo è quello di ricerca.elenca (`board.cartelle`, `board.board`), e sta in un prodotto solo,
// perché un risultato della ricerca non dice di che prodotto è: la cornice lo trova dal tipo.
// Sprint 6 · T5 (voce #1377): una risorsa che nel prodotto non ha una pagina sua (la cartella) ha il percorso vuoto, e si apre
// sulla pagina del prodotto nel workspace.
// Sprint 16 · T7 (voce #1621): ogni voce dice anche se il prodotto è «in arrivo» per chi non ha una sessione (`in_arrivo`): lo
// leggono le pagine senza un workspace a cui chiedere lo stato. Non è «Presto», che è della cornice e vale in ogni workspace:
// un prodotto in anteprima (il CRM) è in arrivo, e nel workspace dell'anteprima la cornice lo apre.
// Sprint 21 · T3 (voce #1641): le notifiche di un prodotto che dal pannello aprono la loro risorsa (`notifiche`), ognuna col tipo
// intero dell'evento e il percorso nel prodotto, dopo `/w/<slug>`: un segnaposto è `{id}` o `{<nome>_id}`, e prende l'id che la
// notifica ha con quella chiave. Un tipo sta una volta sola in tutto il registro, e ha il suo titolo in ogni lingua.
// Review della PR #31: un tipo sta nella voce della sua app (R11), e la forma di un id e quella di un segnaposto sono scritte
// uguali nella parte server, nel browser e in questo controllo (R8).

/**
 * La chiave di un segnaposto in un percorso di notifica: `id`, o `<nome>_id` (minuscole e `_`). È quella che la parte server e
 * il browser cercano nei percorsi del registro: un caso, più sotto, le lega.
 */
const CHIAVE_DI_UN_SEGNAPOSTO = 'id|[a-z][a-z_]*_id';

/**
 * Di che app è un tipo di notifica, dal suo inizio: il backoffice dice `app` dall'evento, e la cornice cerca la destinazione
 * nella voce di quell'app, col tipo intero. Un tipo scritto sotto un'altra voce avrebbe il suo titolo, e non si aprirebbe mai.
 */
const APP_DI_UN_TIPO_DI_NOTIFICA = ['com.zeiras.crm.' => 'crm', 'com.zeiras.board.' => 'pm'];

/** @return list<string> i valori di un tipo fatto di stringhe, di index.d.ts o di un altro file: `export type Tone = 'pine' | …;` */
function valoriDelTipo(string $tipo, string $file = 'resources/zeiras/index.d.ts'): array
{
    preg_match('/^export type '.$tipo.' = ([^;]+);/m', File::get(__DIR__.'/../../'.$file), $trovato);
    preg_match_all("/'([^']+)'/", $trovato[1] ?? '', $valori);

    return $valori[1];
}

/** @return array<string, string> l'indirizzo di ogni voce nella mappa della linea guida 15 («Processo di navigazione») */
function mappaDegliIndirizzi(): array
{
    return [
        'home' => 'https://app.zeiras.com',
        'pm' => 'https://board.zeiras.com',
        'crm' => 'https://crm.zeiras.com',
        'bookings' => 'https://bookings.zeiras.com',
        'reports' => 'https://report.zeiras.com',
        'automations' => 'https://auto.zeiras.com',
        'content' => 'https://ai.zeiras.com',
    ];
}

/**
 * Cosa non torna in un registro: un'icona fuori dal set, un tono che non è di un prodotto, un indirizzo che non è quello della
 * mappa, un nome (i nomi stanno nelle lingue), «Presto» o «in arrivo» che non sono un sì o un no, una voce «Presto» che non è
 * in arrivo, la Dashboard in arrivo; in una risorsa, un tipo vuoto, ripetuto o già
 * di un altro prodotto, un'icona fuori dal set, un percorso che non è vuoto e non comincia con / o non ha un solo `{id}`,
 * «contenitore» che non è un sì o un no, un nome; in una notifica (sprint 21 · T3), un tipo vuoto o già scritto, un tipo di
 * un'altra app, o di un'app che il controllo non conosce, un percorso che non comincia con / o che ha un carattere o un
 * segnaposto non ammesso, una chiave che non è `tipo` né `percorso`.
 *
 * @param  list<array<string, mixed>>  $voci
 * @return list<string>
 */
function problemiDelRegistro(array $voci): array
{
    $icone = valoriDelTipo('IconName');
    $toni = array_values(array_diff(valoriDelTipo('Tone'), ['neutral']));
    $mappa = mappaDegliIndirizzi();

    $problemi = [];
    // Di che prodotto è ogni tipo di risorsa già visto: la cornice trova il prodotto di un risultato dal suo tipo.
    $prodottoDelTipo = [];
    // Di che prodotto è ogni tipo di notifica già visto: la cornice cerca la destinazione nella voce dell'app, col tipo intero.
    $prodottoDellaNotifica = [];
    foreach ($voci as $voce) {
        $id = (string) ($voce['id'] ?? '?');
        if (! in_array($voce['icona'] ?? null, $icone, true)) {
            $problemi[] = "$id: l'icona «".($voce['icona'] ?? '').'» non è del set';
        }
        if ($id !== 'home' && ! in_array($voce['tono'] ?? null, $toni, true)) {
            $problemi[] = "$id: il tono «".($voce['tono'] ?? '').'» non è un tono di prodotto';
        }
        if (! array_key_exists($id, $mappa) || ($voce['indirizzo'] ?? null) !== $mappa[$id]) {
            $problemi[] = "$id: l'indirizzo «".($voce['indirizzo'] ?? '').'» non è quello della mappa';
        }
        if (array_key_exists('nome', $voce)) {
            $problemi[] = "$id: ha un nome, ma i nomi stanno nelle lingue";
        }
        if (! is_bool($voce['presto'] ?? null)) {
            $problemi[] = "$id: «Presto» non è un sì o un no";
        }
        // Sprint 16 · T7.1: ogni voce lo dice; un prodotto che non c'è ancora è in arrivo anche per chi non ha una sessione, e
        // la Dashboard non è un prodotto.
        if (! is_bool($voce['in_arrivo'] ?? null)) {
            $problemi[] = "$id: «in arrivo» non è un sì o un no";
        } elseif ($id === 'home' && $voce['in_arrivo']) {
            $problemi[] = "$id: la Dashboard non è mai in arrivo";
        } elseif (($voce['presto'] ?? null) === true && ! $voce['in_arrivo']) {
            $problemi[] = "$id: è «Presto» ma non è in arrivo";
        }
        $tipi = [];
        foreach ($voce['risorse'] ?? [] as $risorsa) {
            $tipo = $risorsa['tipo'] ?? null;
            $nome = $id.'.'.(is_string($tipo) ? $tipo : '?');
            if (! is_string($tipo) || trim($tipo) === '') {
                $problemi[] = "$nome: il tipo è vuoto";
            } elseif (in_array($tipo, $tipi, true)) {
                $problemi[] = "$nome: il tipo è due volte";
            } elseif (array_key_exists($tipo, $prodottoDelTipo)) {
                $problemi[] = "$nome: il tipo è già di {$prodottoDelTipo[$tipo]}";
            } else {
                $prodottoDelTipo[$tipo] = $id;
            }
            $tipi[] = $tipo;
            if (! in_array($risorsa['icona'] ?? null, $icone, true)) {
                $problemi[] = "$nome: l'icona «".($risorsa['icona'] ?? '').'» non è del set';
            }
            // Vuoto, per una risorsa senza una pagina sua; altrimenti comincia con / e ha un solo `{id}` (sprint 6 · T5.2).
            if (! is_string($risorsa['percorso'] ?? null) || preg_match('~^(/[^{}]*\{id\}[^{}]*)?$~D', $risorsa['percorso']) !== 1) {
                $problemi[] = "$nome: il percorso «".($risorsa['percorso'] ?? '').'» non è vuoto, e non comincia con / o non ha un solo {id}';
            }
            if (! is_bool($risorsa['contenitore'] ?? null)) {
                $problemi[] = "$nome: «contenitore» non è un sì o un no";
            }
            if (array_key_exists('nome', $risorsa)) {
                $problemi[] = "$nome: ha un nome, ma i nomi stanno nelle lingue";
            }
        }
        // Sprint 21 · T3: le notifiche che dal pannello aprono la loro risorsa. Il tipo è quello intero dell'evento, una volta sola
        // in tutto il registro; il percorso comincia con / ed è fatto di minuscole, cifre, `/`, `-`, `_` e segnaposto, `{id}` o
        // `{<nome>_id}`; nessun'altra chiave: il titolo sta nelle lingue.
        foreach ($voce['notifiche'] ?? [] as $notifica) {
            $tipo = $notifica['tipo'] ?? null;
            $nome = $id.', notifica '.(is_string($tipo) && trim($tipo) !== '' ? $tipo : '?');
            if (! is_string($tipo) || trim($tipo) === '') {
                $problemi[] = "$nome: il tipo è vuoto";
            } elseif (array_key_exists($tipo, $prodottoDellaNotifica)) {
                $problemi[] = "$nome: il tipo è già di {$prodottoDellaNotifica[$tipo]}";
            } else {
                $prodottoDellaNotifica[$tipo] = $id;
            }
            // Il tipo sta nella voce della sua app: la cornice lo cerca lì (review della PR #31, R11).
            if (is_string($tipo) && trim($tipo) !== '') {
                $app = null;
                foreach (APP_DI_UN_TIPO_DI_NOTIFICA as $inizio => $codice) {
                    $app = str_starts_with($tipo, $inizio) ? $codice : $app;
                }
                if ($app === null) {
                    $problemi[] = "$nome: il controllo non sa di che app è questo tipo";
                } elseif ($app !== $id) {
                    $problemi[] = "$nome: il tipo è di $app, e nella voce di $id non si aprirebbe mai";
                }
            }
            $percorso = $notifica['percorso'] ?? null;
            if (! is_string($percorso) || preg_match('~^/(?:[a-z0-9/_-]|\{(?:'.CHIAVE_DI_UN_SEGNAPOSTO.')\})*$~D', $percorso) !== 1) {
                $problemi[] = "$nome: il percorso «".(is_string($percorso) ? $percorso : '').'» non comincia con /, o ha un carattere o un segnaposto che non è ammesso';
            }
            if (array_diff(array_keys($notifica), ['tipo', 'percorso']) !== []) {
                $problemi[] = "$nome: ha una chiave che non è tipo né percorso";
            }
        }
    }

    return $problemi;
}

/**
 * I tipi di notifica del registro senza il loro titolo in una lingua (`notificationTitle.<tipo>`, un testo non vuoto): una
 * notifica che apre la sua risorsa ha il suo titolo in ogni lingua, mai quello di ripiego (sprint 21 · T3).
 *
 * @param  list<array<string, mixed>>  $voci
 * @param  array<string, array<string, mixed>>  $lingue  i testi di ogni lingua, per codice
 * @return list<string>
 */
function notificheSenzaTitolo(array $voci, array $lingue): array
{
    $problemi = [];
    foreach ($voci as $voce) {
        foreach ($voce['notifiche'] ?? [] as $notifica) {
            foreach ($lingue as $codice => $testi) {
                $titolo = $testi['notificationTitle.'.$notifica['tipo']] ?? null;
                if (! is_string($titolo) || trim($titolo) === '') {
                    $problemi[] = "{$notifica['tipo']}: senza titolo in $codice";
                }
            }
        }
    }

    return $problemi;
}

it('il registro elenca nell\'ordine della linea guida 10 Dashboard e i sei prodotti, con icone del set, toni, indirizzi della mappa e «Presto», senza nomi (T4.1, T7.3; sprint 6 · T5.2)', function () {
    $voci = registroDeiProdotti();

    expect(array_column($voci, 'id'))->toBe(['home', 'pm', 'crm', 'bookings', 'reports', 'automations', 'content'])
        ->and(problemiDelRegistro($voci))->toBe([])
        // Nessun nome: la Dashboard ha il testo `dashboard` delle lingue, ogni prodotto il testo col suo id. La Dashboard non ha tono.
        ->and(collect($voci)->map(fn (array $voce) => collect($voce)->keys()->sort()->values()->all())->all())->toBe([
            ['icona', 'id', 'in_arrivo', 'indirizzo', 'presto'],
            ['icona', 'id', 'in_arrivo', 'indirizzo', 'presto', 'risorse', 'tono'],
            // Dallo sprint 21 il CRM ha anche `notifiche` (più sotto).
            ['icona', 'id', 'in_arrivo', 'indirizzo', 'notifiche', 'presto', 'tono'],
            ...array_fill(0, 4, ['icona', 'id', 'in_arrivo', 'indirizzo', 'presto', 'tono']),
        ])
        ->and(array_column($voci, 'icona', 'id'))->toBe([
            'home' => 'grid', 'pm' => 'board', 'crm' => 'users', 'bookings' => 'calendar', 'reports' => 'chart',
            'automations' => 'bolt', 'content' => 'sparkle',
        ])
        ->and(array_column($voci, 'tono', 'id'))->toBe([
            'pm' => 'pine', 'crm' => 'sky', 'bookings' => 'sky', 'reports' => 'citrus', 'automations' => 'plum', 'content' => 'coral',
        ])
        // «Presto» come nell'anteprima dell'AppShell: provvisorio, finché non si sa quali prodotti sono disponibili.
        ->and(array_keys(array_filter(array_column($voci, 'presto', 'id'))))->toBe(['reports', 'automations', 'content'])
        // Le risorse di Project Management che la ricerca mostra: le sole che ricerca.elenca cerca, col tipo del contratto, e con
        // le rotte di zr-board, a pagina intera: la board ha la sua pagina; la cartella no, sta con le altre sulla pagina del
        // workspace, e il suo percorso è vuoto. Icone: `folder` per la cartella (come `ProjectFolder`), `board` per la board.
        // Le schede entrano quando il contratto ha il loro tipo.
        ->and($voci[1]['risorse'])->toBe([
            ['tipo' => 'board.cartelle', 'icona' => 'folder', 'percorso' => '', 'contenitore' => true],
            ['tipo' => 'board.board', 'icona' => 'board', 'percorso' => '/b/{id}', 'contenitore' => true],
        ])
        // Nessun altro prodotto ha risorse: un tipo in due prodotti sarebbe un problema (sopra), e qui non ce n'è nessuno.
        ->and(array_keys(array_filter(array_column($voci, 'risorse', 'id'))))->toBe(['pm']);
});

it('il controllo trova un\'icona fuori dal set, un tono che non esiste, un indirizzo fuori dalla mappa, un nome e un percorso che non è vuoto né `/…{id}…` (T4.1, T7.3; sprint 6 · T5.2)', function () {
    $voci = registroDeiProdotti();
    $voci[1]['tono'] = 'teal';
    $voci[2]['nome'] = 'CRM';
    $voci[3]['icona'] = 'calendar-days';
    $voci[3]['indirizzo'] = 'https://cal.zeiras.com';
    unset($voci[4]['presto']);
    $voci[1]['risorse'][] = ['tipo' => 'board.board', 'icona' => 'card', 'percorso' => '/b', 'contenitore' => 'sì', 'nome' => 'Board'];
    $voci[1]['risorse'][] = ['tipo' => ' ', 'icona' => 'board', 'percorso' => '/b/{id}/c/{id}', 'contenitore' => false];
    // Un percorso senza `{id}`, o senza la barra davanti, non è il percorso vuoto: resta un problema.
    $voci[1]['risorse'][] = ['tipo' => 'uat.cartelle', 'icona' => 'folder', 'percorso' => '/cartelle', 'contenitore' => true];
    $voci[1]['risorse'][] = ['tipo' => 'uat.senza-barra', 'icona' => 'board', 'percorso' => 'b/{id}', 'contenitore' => true];
    $voci[1]['risorse'][] = ['tipo' => 'uat.a-capo', 'icona' => 'board', 'percorso' => "\n", 'contenitore' => true];
    // Lo stesso tipo in un altro prodotto: la cornice non saprebbe di chi è un risultato. Un tipo suo, invece, va bene.
    $voci[2]['risorse'] = [
        ['tipo' => 'board.cartelle', 'icona' => 'folder', 'percorso' => '/cartelle/{id}', 'contenitore' => true],
        ['tipo' => 'uat.contatti', 'icona' => 'users', 'percorso' => '/contatti/{id}', 'contenitore' => false],
        // Un percorso vuoto va bene: la risorsa non ha una pagina sua, e si apre sulla pagina del prodotto nel workspace.
        ['tipo' => 'uat.elenchi', 'icona' => 'folder', 'percorso' => '', 'contenitore' => true],
    ];

    expect(valoriDelTipo('IconName'))->toContain('calendar', 'board', 'sparkle')
        ->and(valoriDelTipo('Tone'))->toContain('pine', 'sky', 'neutral')
        ->and(problemiDelRegistro($voci))->toEqualCanonicalizing([
            'pm: il tono «teal» non è un tono di prodotto',
            'crm: ha un nome, ma i nomi stanno nelle lingue',
            "bookings: l'icona «calendar-days» non è del set",
            "bookings: l'indirizzo «https://cal.zeiras.com» non è quello della mappa",
            'reports: «Presto» non è un sì o un no',
            'pm.board.board: il tipo è due volte',
            "pm.board.board: l'icona «card» non è del set",
            'pm.board.board: il percorso «/b» non è vuoto, e non comincia con / o non ha un solo {id}',
            'pm.board.board: «contenitore» non è un sì o un no',
            'pm.board.board: ha un nome, ma i nomi stanno nelle lingue',
            'pm. : il tipo è vuoto',
            'pm. : il percorso «/b/{id}/c/{id}» non è vuoto, e non comincia con / o non ha un solo {id}',
            'pm.uat.cartelle: il percorso «/cartelle» non è vuoto, e non comincia con / o non ha un solo {id}',
            'pm.uat.senza-barra: il percorso «b/{id}» non è vuoto, e non comincia con / o non ha un solo {id}',
            "pm.uat.a-capo: il percorso «\n» non è vuoto, e non comincia con / o non ha un solo {id}",
            'crm.board.cartelle: il tipo è già di pm',
        ]);
});

it('ogni voce del registro dice se il prodotto è in arrivo per chi non ha una sessione: CRM, Bookings e i tre «Presto» sì, Dashboard e Project Management no; «Presto» resta dei tre (sprint 16 · T7.1)', function () {
    $voci = registroDeiProdotti();

    expect(array_column($voci, 'in_arrivo', 'id'))->toBe([
        'home' => false, 'pm' => false, 'crm' => true, 'bookings' => true, 'reports' => true, 'automations' => true, 'content' => true,
    ])
        // «Presto» non cambia: con `crm` «Presto» la cornice lo chiuderebbe anche nel workspace dell'anteprima.
        ->and(array_column($voci, 'presto', 'id'))->toBe([
            'home' => false, 'pm' => false, 'crm' => false, 'bookings' => false, 'reports' => true, 'automations' => true, 'content' => true,
        ])
        ->and(problemiDelRegistro($voci))->toBe([]);
});

it('il controllo trova la Dashboard in arrivo, una voce senza «in arrivo», una dove non è un sì o un no e una «Presto» che non è in arrivo (sprint 16 · T7.1)', function () {
    $voci = registroDeiProdotti();
    $voci[0]['in_arrivo'] = true;
    unset($voci[2]['in_arrivo']);
    $voci[3]['in_arrivo'] = 'sì';
    $voci[4]['in_arrivo'] = false;
    // Un prodotto in arrivo che non è «Presto» va bene (il CRM in anteprima), e uno che non è né l'uno né l'altro anche.
    $voci[5]['presto'] = false;
    $voci[6]['presto'] = false;
    $voci[6]['in_arrivo'] = false;

    expect(array_column($voci, 'id'))->toBe(['home', 'pm', 'crm', 'bookings', 'reports', 'automations', 'content'])
        ->and(problemiDelRegistro($voci))->toEqualCanonicalizing([
            'home: la Dashboard non è mai in arrivo',
            'crm: «in arrivo» non è un sì o un no',
            'bookings: «in arrivo» non è un sì o un no',
            'reports: è «Presto» ma non è in arrivo',
        ]);
});

it('il tipo `VoceDelRegistro` di registro.ts dichiara `in_arrivo`, un sì o un no, dopo `presto`: un frontend che lo legge compila (sprint 16 · T7.3)', function () {
    preg_match('/^export interface VoceDelRegistro \{$(.*?)^\}$/ms', File::get(__DIR__.'/../../resources/js/registro.ts'), $tipo);
    preg_match_all('/^    (\w+\??): (.+);$/m', $tipo[1] ?? '', $campi);

    expect(array_combine($campi[1], $campi[2]))->toBe([
        'id' => "'home' | IdDiProdotto",
        'icona' => 'IconName',
        'tono?' => "Exclude<Tone, 'neutral'>",
        'indirizzo' => 'string',
        'presto' => 'boolean',
        'in_arrivo' => 'boolean',
        'risorse?' => 'RisorsaDelProdotto[]',
        // Sprint 21 · T3: le notifiche che aprono la loro risorsa.
        'notifiche?' => 'NotificaDelProdotto[]',
    ]);
});

it('il tipo `IdDiProdotto` di registro.ts elenca i prodotti del registro: tsc chiede all\'inglese il nome di ognuno (T7.1)', function () {
    expect(idDeiProdotti())->toBe(['pm', 'crm', 'bookings', 'reports', 'automations', 'content'])
        ->and(valoriDelTipo('IdDiProdotto', 'resources/js/registro.ts'))->toEqualCanonicalizing(idDeiProdotti());
});

it('il tipo `TipoDiRisorsa` di registro.ts elenca le risorse del registro, `<prodotto>.<tipo>`: tsc chiede all\'inglese il nome di ognuna (T5.3; sprint 5 · T4.5)', function () {
    expect(tipiDiRisorsa())->toBe(['pm.board.cartelle', 'pm.board.board'])
        ->and(valoriDelTipo('TipoDiRisorsa', 'resources/js/registro.ts'))->toEqualCanonicalizing(tipiDiRisorsa());
});

// Sprint 21 · T3 (voce #1641): da una notifica del CRM si apre la sua risorsa. Dove, lo dice il registro: parole e indirizzi sono
// di zr-crm (11/10/2026). Un contatto ha la sua pagina; una pipeline apre le sue impostazioni; una nota non ha una pagina sua, e
// si vede nella pagina del contatto a cui è attaccata (`persona_id`), anche quando è stata eliminata.

it('nel registro le notifiche del CRM che aprono la loro risorsa sono nove, col tipo intero dell\'evento: un contatto apre la sua pagina, una pipeline le sue impostazioni, una nota il contatto a cui è attaccata, un\'azienda la sua pagina in `/aziende`, mai in `/organizzazioni`; nessun altro prodotto ne ha (sprint 21 · T3.1, T5.2)', function () {
    $voci = registroDeiProdotti();

    expect(problemiDelRegistro($voci))->toBe([])
        ->and($voci[2]['id'])->toBe('crm')
        ->and($voci[2]['notifiche'] ?? null)->toBe([
            ['tipo' => 'com.zeiras.crm.persona.creata', 'percorso' => '/contatti/{id}'],
            ['tipo' => 'com.zeiras.crm.persona.modificata', 'percorso' => '/contatti/{id}'],
            ['tipo' => 'com.zeiras.crm.pipeline.creata', 'percorso' => '/pipeline/{id}/impostazioni'],
            ['tipo' => 'com.zeiras.crm.pipeline.modificata', 'percorso' => '/pipeline/{id}/impostazioni'],
            ['tipo' => 'com.zeiras.crm.nota.creata', 'percorso' => '/contatti/{persona_id}'],
            ['tipo' => 'com.zeiras.crm.nota.modificata', 'percorso' => '/contatti/{persona_id}'],
            ['tipo' => 'com.zeiras.crm.nota.eliminata', 'percorso' => '/contatti/{persona_id}'],
            // Nel contratto un'azienda è una `organizzazione`; la pagina del CRM è `/aziende` (zr-crm, 11/10/2026).
            ['tipo' => 'com.zeiras.crm.organizzazione.creata', 'percorso' => '/aziende/{id}'],
            ['tipo' => 'com.zeiras.crm.organizzazione.modificata', 'percorso' => '/aziende/{id}'],
        ])
        ->and(array_keys(array_filter(array_column($voci, 'notifiche', 'id'))))->toBe(['crm']);
});

it('il controllo trova, fra le notifiche di un prodotto, un tipo vuoto, uno scritto due volte nello stesso prodotto o in un altro, uno di un\'altra app o di un\'app che non conosce, un percorso che non comincia con /, un segnaposto che non è `{id}` né `{…_id}`, un carattere che in un percorso non ci sta e una chiave in più (sprint 21 · T3, guardia; review della PR #31, R11)', function () {
    $voci = registroDeiProdotti();
    $voci[1]['notifiche'] = [
        // Buone: senza segnaposto, con uno, con due, e la pagina del prodotto nel workspace.
        ['tipo' => 'com.zeiras.board.uat.elenco', 'percorso' => '/b'],
        ['tipo' => 'com.zeiras.board.uat.board', 'percorso' => '/b/{id}'],
        ['tipo' => 'com.zeiras.board.uat.scheda', 'percorso' => '/b/{board_id}/c/{id}'],
        ['tipo' => 'com.zeiras.board.uat.radice', 'percorso' => '/'],
        // Il tipo: vuoto, assente, scritto due volte.
        ['tipo' => ' ', 'percorso' => '/b/{id}'],
        ['percorso' => '/b/{id}'],
        ['tipo' => 'com.zeiras.board.uat.board', 'percorso' => '/b/{id}/impostazioni'],
        // Il percorso.
        ['tipo' => 'com.zeiras.board.uat.senza-barra', 'percorso' => 'b/{id}'],
        ['tipo' => 'com.zeiras.board.uat.vuoto', 'percorso' => ''],
        ['tipo' => 'com.zeiras.board.uat.senza-percorso'],
        ['tipo' => 'com.zeiras.board.uat.nome', 'percorso' => '/b/{nome}'],
        ['tipo' => 'com.zeiras.board.uat.maiuscola', 'percorso' => '/b/{Board_id}'],
        ['tipo' => 'com.zeiras.board.uat.idx', 'percorso' => '/b/{idx}'],
        ['tipo' => 'com.zeiras.board.uat.aperta', 'percorso' => '/b/{id'],
        ['tipo' => 'com.zeiras.board.uat.chiusa', 'percorso' => '/b/id}'],
        ['tipo' => 'com.zeiras.board.uat.graffe', 'percorso' => '/b/{}'],
        ['tipo' => 'com.zeiras.board.uat.domanda', 'percorso' => '/b/{id}?scheda=1'],
        ['tipo' => 'com.zeiras.board.uat.spazio', 'percorso' => '/b/{id} '],
        ['tipo' => 'com.zeiras.board.uat.a-capo', 'percorso' => "/b/{id}\n"],
        // Una chiave in più: il titolo sta nelle lingue.
        ['tipo' => 'com.zeiras.board.uat.titolo', 'percorso' => '/b/{id}', 'titolo' => 'UAT'],
        // Un tipo del CRM fra quelli di Project Management, e tre di cui il controllo non sa l'app: un inizio che non conosce, uno
        // che conosce ma non all'inizio, e uno a cui manca il punto.
        ['tipo' => 'com.zeiras.crm.uat.contatto', 'percorso' => '/b/{id}'],
        ['tipo' => 'com.zeiras.uat.ignota', 'percorso' => '/b/{id}'],
        ['tipo' => 'x.com.zeiras.board.uat.davanti', 'percorso' => '/b/{id}'],
        ['tipo' => 'com.zeiras.boardx.uat.attaccato', 'percorso' => '/b/{id}'],
    ];
    // Lo stesso tipo in un altro prodotto: la cornice cerca nella voce dell'app, e uno dei due non si aprirebbe mai.
    $voci[2]['notifiche'][] = ['tipo' => 'com.zeiras.board.uat.scheda', 'percorso' => '/contatti/{id}'];
    // Un tipo di una board, scritto una volta sola, ma fra quelli del CRM.
    $voci[2]['notifiche'][] = ['tipo' => 'com.zeiras.board.uat.altrove', 'percorso' => '/contatti/{id}'];

    $sbagliato = fn (string $tipo, string $percorso) => "pm, notifica com.zeiras.board.uat.$tipo: il percorso «{$percorso}» non comincia con /, o ha un carattere o un segnaposto che non è ammesso";

    expect(problemiDelRegistro($voci))->toEqualCanonicalizing([
        'pm, notifica ?: il tipo è vuoto',
        'pm, notifica ?: il tipo è vuoto',
        'pm, notifica com.zeiras.board.uat.board: il tipo è già di pm',
        $sbagliato('senza-barra', 'b/{id}'),
        $sbagliato('vuoto', ''),
        $sbagliato('senza-percorso', ''),
        $sbagliato('nome', '/b/{nome}'),
        $sbagliato('maiuscola', '/b/{Board_id}'),
        $sbagliato('idx', '/b/{idx}'),
        $sbagliato('aperta', '/b/{id'),
        $sbagliato('chiusa', '/b/id}'),
        $sbagliato('graffe', '/b/{}'),
        $sbagliato('domanda', '/b/{id}?scheda=1'),
        $sbagliato('spazio', '/b/{id} '),
        $sbagliato('a-capo', "/b/{id}\n"),
        'pm, notifica com.zeiras.board.uat.titolo: ha una chiave che non è tipo né percorso',
        'pm, notifica com.zeiras.crm.uat.contatto: il tipo è di crm, e nella voce di pm non si aprirebbe mai',
        'pm, notifica com.zeiras.uat.ignota: il controllo non sa di che app è questo tipo',
        'pm, notifica x.com.zeiras.board.uat.davanti: il controllo non sa di che app è questo tipo',
        'pm, notifica com.zeiras.boardx.uat.attaccato: il controllo non sa di che app è questo tipo',
        'crm, notifica com.zeiras.board.uat.scheda: il tipo è già di pm',
        'crm, notifica com.zeiras.board.uat.scheda: il tipo è di pm, e nella voce di crm non si aprirebbe mai',
        'crm, notifica com.zeiras.board.uat.altrove: il tipo è di pm, e nella voce di crm non si aprirebbe mai',
    ]);
});

it('la forma di un id e quella di un segnaposto sono scritte uguali nella parte server, nel browser e nel controllo del registro: un id che la parte server dà, il browser non lo scarta (sprint 21 · review della PR #31, R8)', function () {
    // Dallo sprint 23 (T2, S8) le forme di un id e di uno slug stanno in un modulo loro, `forme.ts`: le usano la destinazione di
    // una notifica e le chiamate della cornice, e `servizi.ts` non passa più da `notifiche.ts` per averle.
    $sorgente = fn (string $file): string => (string) file_get_contents(__DIR__.'/../../resources/js/'.$file);
    preg_match('~^export const FORMA_DI_UN_ID = /\^(.+)\$/;$~m', $sorgente('forme.ts'), $forma);
    preg_match('~^const SEGNAPOSTO = /(.+)/g;$~m', $sorgente('notifiche.ts'), $segnaposto);
    $delServer = fn (string $costante): mixed => (new ReflectionClassConstant(NotificheDellaCornice::class, $costante))->getValue();

    expect($forma[1] ?? null)->toBe(NotificheDellaCornice::ID)
        ->and($segnaposto[1] ?? null)->toBe('\{('.CHIAVE_DI_UN_SEGNAPOSTO.')\}')
        ->and($delServer('SEGNAPOSTO'))->toBe('/\{('.CHIAVE_DI_UN_SEGNAPOSTO.')\}/')
        // La parte server confronta un id con la forma intera, senza un a capo in fondo: `\z`, non `$`.
        ->and($delServer('FORMA_DI_UN_ID'))->toBe('/\A'.NotificheDellaCornice::ID.'\z/')
        // La forma di uno slug è scritta una volta sola, in `forme.ts`, e chi la usa la importa da lì.
        ->and(substr_count($sorgente('forme.ts'), 'export const FORMA_DI_UNO_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;'))->toBe(1)
        ->and(substr_count($sorgente('notifiche.ts').$sorgente('servizi.ts'), "import { FORMA_DI_UN_ID, FORMA_DI_UNO_SLUG } from './forme';"))->toBe(2)
        ->and(substr_count($sorgente('notifiche.ts').$sorgente('servizi.ts').$sorgente('cornice.tsx'), '[a-z0-9]+(-[a-z0-9]+)*'))->toBe(0)
        ->and(str_contains($sorgente('servizi.ts'), "from './notifiche'"))->toBe(false);
});

it('ogni tipo di notifica del registro ha il suo titolo in ogni lingua, e il controllo trova un tipo che in una lingua non ce l\'ha, o ce l\'ha vuoto (sprint 21 · T3, guardia)', function () {
    $lingue = [];
    foreach (File::glob(__DIR__.'/../../resources/lingue/*.json') as $file) {
        $lingue[basename($file, '.json')] = json_decode(File::get($file), true, flags: JSON_THROW_ON_ERROR);
    }

    expect(array_keys($lingue))->toContain('it', 'es', 'en')
        ->and(notificheSenzaTitolo(registroDeiProdotti(), $lingue))->toBe([]);

    $voci = [['id' => 'crm', 'notifiche' => [
        ['tipo' => 'com.zeiras.crm.nota.creata', 'percorso' => '/contatti/{persona_id}'],
        ['tipo' => 'com.zeiras.crm.persona.creata', 'percorso' => '/contatti/{id}'],
        ['tipo' => 'com.zeiras.crm.uat.ignoto', 'percorso' => '/uat/{id}'],
    ]]];
    unset($lingue['es']['notificationTitle.com.zeiras.crm.nota.creata']);
    $lingue['en']['notificationTitle.com.zeiras.crm.persona.creata'] = ' ';

    expect(notificheSenzaTitolo($voci, $lingue))->toEqualCanonicalizing([
        'com.zeiras.crm.nota.creata: senza titolo in es',
        'com.zeiras.crm.persona.creata: senza titolo in en',
        ...array_map(fn (string $codice) => "com.zeiras.crm.uat.ignoto: senza titolo in $codice", array_keys($lingue)),
    ]);
});
