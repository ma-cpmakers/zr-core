<?php

use Illuminate\Support\Facades\File;
use Zeiras\Core\Http\NotificheDellaCornice;
use Zeiras\Core\Registro;

// Sprint 1 · T4 e T7 (voce #1255). Il registro dei prodotti di zr-core, resources/registro/prodotti.json: nell'ordine della linea
// guida 10 del design system, Dashboard e i sei prodotti, ognuno con un id del design system, un'icona del set (`IconName`), un
// tono (`Tone`, tranne Dashboard), l'indirizzo della mappa della linea guida 15 e «Presto». I nomi non ci sono: stanno nelle lingue
// (T7, decisione 5926 di Luciano). I tipi si leggono dalla copia derivata di index.d.ts; ordine, icone, toni, indirizzi e «Presto»
// sono quelli del design system alla versione delle copie in resources/zeiras/ (README «Iconografia», linee guida 10 e 15, anteprima
// dell'AppShell). Sprint 3 · T5 (voce #1277): le risorse di un prodotto che la ricerca mostra, ognuna col tipo del backoffice,
// un'icona del set, il percorso nel prodotto e se è un contenitore; i loro nomi stanno nelle lingue, con `<prodotto>.<tipo>`.
// Sprint 5 · T4 (voce #1257): il tipo è quello di ricerca.elenca (`board.cartelle`, `board.board`), e sta in una voce sola (un
// prodotto, o dallo sprint 27 la Dashboard, per il membro del workspace),
// perché un risultato della ricerca non dice di che prodotto è: la cornice lo trova dal tipo.
// Sprint 6 · T5 (voce #1377): una risorsa che nel prodotto non ha una pagina sua (la cartella) ha il percorso vuoto, e si apre
// sulla pagina del prodotto nel workspace. Sprint 25 · T4 (voce #1639): i tipi sono quelli di ricerca.crea — anche schede,
// contatti, aziende e opportunità —, e un tipo può dire le chiavi di `contesto` che fanno la seconda riga del risultato.
// Sprint 16 · T7 (voce #1621): ogni voce dice anche se il prodotto è «in arrivo» per chi non ha una sessione (`in_arrivo`): lo
// leggono le pagine senza un workspace a cui chiedere lo stato. Non è «Presto», che è della cornice e vale in ogni workspace:
// un prodotto in arrivo che non è «Presto» (Bookings; fino alla `v1.15.0` anche il CRM) la cornice lo apre nei workspace in cui il
// backoffice lo dà.
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
 * Un tipo che non è un evento — ciò che il CRM manda a chi diventa responsabile — arriva senza `com.zeiras.` davanti: `crm.`
 * è del CRM (sprint 23 · T3), e `board.` di Project Management, per la scheda assegnata (sprint 24 · T3).
 */
const APP_DI_UN_TIPO_DI_NOTIFICA = ['com.zeiras.crm.' => 'crm', 'com.zeiras.board.' => 'pm', 'crm.' => 'crm', 'board.' => 'pm'];

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
 * «contenitore» che non è un sì o un no, un nome, un «contesto» che non è un elenco di chiavi minuscole e diverse, una chiave
 * che una risorsa non ha (sprint 25 · T4), dei «codici» che non danno a chiavi del suo «contesto» un elenco di codici minuscoli
 * e diversi (sprint 27 · T1); in una notifica (sprint 21 · T3), un tipo vuoto o già scritto, un tipo di
 * un'altra app, o di un'app che il controllo non conosce, un percorso che non comincia con / o che ha un carattere o un
 * segnaposto non ammesso, una chiave che non è `tipo`, `percorso` né `altrimenti`, e in `altrimenti` un percorso scritto due
 * volte o che non si aprirebbe mai.
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
            // Sprint 25 · T4: le chiavi di `contesto` che fanno la seconda riga di un risultato, per i tipi che ne hanno una: un
            // elenco non vuoto di chiavi minuscole (`board`, `lista`), ognuna una volta. E nessuna chiave che una risorsa non ha.
            $chiavi = $risorsa['contesto'] ?? null;
            if (array_key_exists('contesto', $risorsa) && (
                ! is_array($chiavi) || ! array_is_list($chiavi) || $chiavi === [] || count(array_unique($chiavi, SORT_REGULAR)) !== count($chiavi)
                || array_filter($chiavi, fn (mixed $chiave): bool => ! is_string($chiave) || preg_match('/^[a-z_]+$/D', $chiave) !== 1) !== []
            )) {
                $problemi[] = "$nome: «contesto» non è un elenco di chiavi, minuscole e diverse";
            }
            // Sprint 27 · T1: i codici che una chiave di `contesto` può portare, dove il backoffice dà un codice e non un testo da
            // mostrare (`ruolo` di un membro del workspace): il testo di ogni codice sta nelle lingue. Un oggetto non vuoto; ogni
            // sua chiave è una chiave di `contesto` della stessa risorsa, e ha un elenco non vuoto di codici minuscoli
            // (`proprietario`), ognuno una volta.
            if (array_key_exists('codici', $risorsa)) {
                $codici = $risorsa['codici'];
                if (! is_array($codici) || $codici === [] || array_is_list($codici)) {
                    $problemi[] = "$nome: «codici» non è un oggetto con un elenco di codici per chiave";
                } else {
                    foreach ($codici as $chiave => $elenco) {
                        if (! is_array($chiavi) || ! in_array($chiave, $chiavi, true)) {
                            $problemi[] = "$nome: «codici» nomina «{$chiave}», che non è una chiave di «contesto»";
                        }
                        if (
                            ! is_array($elenco) || ! array_is_list($elenco) || $elenco === [] || count(array_unique($elenco, SORT_REGULAR)) !== count($elenco)
                            || array_filter($elenco, fn (mixed $codice): bool => ! is_string($codice) || preg_match('/^[a-z_]+$/D', $codice) !== 1) !== []
                        ) {
                            $problemi[] = "$nome: i codici di «{$chiave}» non sono un elenco di codici, minuscoli e diversi";
                        }
                    }
                }
            }
            if (array_diff(array_keys($risorsa), ['tipo', 'icona', 'percorso', 'contenitore', 'contesto', 'codici', 'nome']) !== []) {
                $problemi[] = "$nome: ha una chiave che non è tipo, icona, percorso, contenitore, contesto né codici";
            }
        }
        // Sprint 21 · T3: le notifiche che dal pannello aprono la loro risorsa. Il tipo è quello intero dell'evento, una volta sola
        // in tutto il registro; il percorso comincia con / ed è fatto di minuscole, cifre, `/`, `-`, `_` e segnaposto, `{id}` o
        // `{<nome>_id}`; nessun'altra chiave: il titolo sta nelle lingue. Sprint 23 · T3: `altrimenti`, che può non esserci, è la
        // lista dei percorsi che si provano dopo `percorso`, in ordine: non vuota, ognuno con le regole di `percorso`, e nessuno
        // scritto due volte né uguale a `percorso`. Sprint 24 · T4: e nessuno che chiede almeno gli id di uno che viene prima —
        // quindi nessuno dopo un percorso senza segnaposto —, perché browser e parte server si fermano al primo che ha tutti i
        // suoi id, e lui non si aprirebbe mai.
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
            $formaDiUnPercorso = '~^/(?:[a-z0-9/_-]|\{(?:'.CHIAVE_DI_UN_SEGNAPOSTO.')\})*$~D';
            $chiaviDi = function (string $unPercorso): array {
                preg_match_all('~\{('.CHIAVE_DI_UN_SEGNAPOSTO.')\}~', $unPercorso, $segnaposto);

                return $segnaposto[1];
            };
            if (! is_string($percorso) || preg_match($formaDiUnPercorso, $percorso) !== 1) {
                $problemi[] = "$nome: il percorso «".(is_string($percorso) ? $percorso : '').'» non comincia con /, o ha un carattere o un segnaposto che non è ammesso';
            }
            if (array_key_exists('altrimenti', $notifica)) {
                $altrimenti = $notifica['altrimenti'];
                if (! is_array($altrimenti) || ! array_is_list($altrimenti) || $altrimenti === []) {
                    $problemi[] = "$nome: «altrimenti» non è una lista di percorsi, o è vuota";
                } else {
                    $giaScritti = [$percorso];
                    foreach ($altrimenti as $altro) {
                        if (! is_string($altro) || preg_match($formaDiUnPercorso, $altro) !== 1) {
                            $problemi[] = "$nome: il percorso «".(is_string($altro) ? $altro : '').'» di «altrimenti» non comincia con /, o ha un carattere o un segnaposto che non è ammesso';
                        } elseif (in_array($altro, $giaScritti, true)) {
                            $problemi[] = "$nome: il percorso «{$altro}» di «altrimenti» è scritto due volte";
                        } else {
                            foreach ($giaScritti as $prima) {
                                if (is_string($prima) && preg_match($formaDiUnPercorso, $prima) === 1 && array_diff($chiaviDi($prima), $chiaviDi($altro)) === []) {
                                    $problemi[] = "$nome: il percorso «{$altro}» di «altrimenti» non si aprirebbe mai: quando ha i suoi id li ha anche «{$prima}», che viene prima";
                                    break;
                                }
                            }
                        }
                        $giaScritti[] = $altro;
                    }
                }
            }
            if (array_diff(array_keys($notifica), ['tipo', 'percorso', 'altrimenti']) !== []) {
                $problemi[] = "$nome: ha una chiave che non è tipo, percorso né altrimenti";
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

// Sprint 27 · T5.2 (lettura della PR #59, R7). Questo è il primo caso del file, e gira dopo l'ultimo di `PacchettoTest.php`, che
// scrive un registro di prova (la copia che `Registro` tiene per tutte le rotte) e non lo toglie: lo toglie `tests/Pest.php`,
// dopo ogni caso di ogni file. Se restasse, la parte server avrebbe qui una copia in mano, con un prodotto che il pacchetto non ha.

it('un registro di prova scritto dall\'ultimo caso di un altro file non arriva qui: la parte server non ha una copia in mano, e il registro che legge è quello del pacchetto (sprint 27 · T5.2)', function () {
    expect([(new ReflectionProperty(Registro::class, 'voci'))->getValue() === null, Registro::voci() === registroDeiProdotti()])->toBe([true, true]);
});

it('il registro elenca nell\'ordine della linea guida 10 Dashboard e i sei prodotti, con icone del set, toni, indirizzi della mappa e «Presto», senza nomi (T4.1, T7.3; sprint 6 · T5.2)', function () {
    $voci = registroDeiProdotti();

    expect(array_column($voci, 'id'))->toBe(['home', 'pm', 'crm', 'bookings', 'reports', 'automations', 'content'])
        ->and(problemiDelRegistro($voci))->toBe([])
        // Nessun nome: la Dashboard ha il testo `dashboard` delle lingue, ogni prodotto il testo col suo id. La Dashboard non ha tono.
        ->and(collect($voci)->map(fn (array $voce) => collect($voce)->keys()->sort()->values()->all())->all())->toBe([
            // Dallo sprint 27 la Dashboard ha `risorse` (più sotto): il membro del workspace, la cui pagina è di app.
            ['icona', 'id', 'in_arrivo', 'indirizzo', 'presto', 'risorse'],
            // Dallo sprint 24 anche Project Management ha `notifiche` (più sotto).
            ['icona', 'id', 'in_arrivo', 'indirizzo', 'notifiche', 'presto', 'risorse', 'tono'],
            // Dallo sprint 21 il CRM ha anche `notifiche` (più sotto), e dallo sprint 25 `risorse`.
            ['icona', 'id', 'in_arrivo', 'indirizzo', 'notifiche', 'presto', 'risorse', 'tono'],
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
        // Le risorse di Project Management che la ricerca mostra, col tipo del contratto (ricerca.crea) e con le rotte di
        // zr-board: la scheda si apre nel pannello della sua board, e la sua seconda riga sono board e lista; la board ha la sua
        // pagina; la cartella no, sta con le altre sulla pagina del workspace, e il suo percorso è vuoto. Icone: `file` per la
        // scheda, `board` per la board, `folder` per la cartella (come `ProjectFolder`). L'ordine è quello in cui l'invito della
        // ricerca le nomina (sprint 25 · T4; dalla `v1.17.0` il segnaposto non nomina più le fonti).
        ->and($voci[1]['risorse'])->toBe([
            ['tipo' => 'board.scheda', 'icona' => 'file', 'percorso' => '/c/{id}', 'contenitore' => false, 'contesto' => ['board', 'lista']],
            ['tipo' => 'board.board', 'icona' => 'board', 'percorso' => '/b/{id}', 'contenitore' => true],
            ['tipo' => 'board.cartelle', 'icona' => 'folder', 'percorso' => '', 'contenitore' => true],
        ])
        // Quelle del CRM, con le rotte e le icone di zr-crm (nota 10716 del progetto): i percorsi sono quelli che le notifiche
        // aprono già. Un'azienda non ha una seconda riga: il backoffice non dà testi per riconoscerla.
        ->and($voci[2]['risorse'])->toBe([
            ['tipo' => 'crm.persona', 'icona' => 'users', 'percorso' => '/contatti/{id}', 'contenitore' => false, 'contesto' => ['organizzazione', 'ruolo']],
            ['tipo' => 'crm.organizzazione', 'icona' => 'building', 'percorso' => '/aziende/{id}', 'contenitore' => false],
            // Sprint 28 · T1.4 (voce #1826): un'opportunità chiusa dice l'esito. Il backoffice dà `esito` come codice (`aperta`,
            // `vinta`, `persa`), e alla chiave il registro dà i soli due codici di un'opportunità chiusa: `aperta` non è fra
            // quelli, ed è così che di un'opportunità aperta non si mostra.
            [
                'tipo' => 'crm.trattativa', 'icona' => 'target', 'percorso' => '/opportunita/{id}', 'contenitore' => false,
                'contesto' => ['pipeline', 'fase', 'esito'], 'codici' => ['esito' => ['vinta', 'persa']],
            ],
        ])
        // Sprint 27 · T1.1 (voce #1787): il membro del workspace, col tipo del contratto (ricerca.crea). Non è di un modulo: la
        // pagina che si apre è Impostazioni › Membri di app, e la risorsa sta nella voce della Dashboard, che ha quell'indirizzo.
        // Il percorso è quello di zr-home, non quello del backoffice (`/v1/workspace/membri/{id}`). La seconda riga è il ruolo,
        // che il backoffice dà come codice: i tre codici stanno in `codici`, e il testo di ognuno nelle lingue. Mai l'email: ciò
        // che sta in `contesto` è anche ciò che la parte server lascia uscire verso il browser.
        ->and($voci[0]['risorse'] ?? null)->toBe([
            [
                'tipo' => 'workspace.membro', 'icona' => 'user', 'percorso' => '/impostazioni/membri/{id}', 'contenitore' => false,
                'contesto' => ['ruolo'], 'codici' => ['ruolo' => ['proprietario', 'amministratore', 'membro']],
            ],
        ])
        // Nessun altro ha risorse: un tipo in due voci sarebbe un problema (sopra), e qui non ce n'è nessuno.
        ->and(array_keys(array_filter(array_column($voci, 'risorse', 'id'))))->toBe(['home', 'pm', 'crm'])
        // Il ruolo di un membro è un codice: quello di un contatto del CRM è un testo libero («Direttore»), e resta com'è. Dallo
        // sprint 28 ha dei codici anche l'opportunità, per l'esito.
        ->and(array_keys(array_filter(array_merge(...array_map(
            fn (array $voce): array => array_column($voce['risorse'] ?? [], 'codici', 'tipo'),
            $voci,
        )))))->toBe(['workspace.membro', 'crm.trattativa']);
});

it('il controllo trova un «contesto» che non è un elenco di chiavi minuscole e diverse, e una chiave che una risorsa non ha (sprint 25 · T4.5)', function () {
    $voci = registroDeiProdotti();
    $voci[1]['risorse'][0]['contesto'] = ['board', 'board'];
    $voci[1]['risorse'][1]['contesto'] = [];
    $voci[1]['risorse'][2]['contesto'] = 'board';
    $voci[2]['risorse'][0]['contesto'] = ['Organizzazione', 'ruolo'];
    $voci[2]['risorse'][1]['gruppo'] = 'Aziende';
    $voci[2]['risorse'][2]['contesto'] = ['fase' => 'pipeline'];

    expect(problemiDelRegistro($voci))->toBe([
        'pm.board.scheda: «contesto» non è un elenco di chiavi, minuscole e diverse',
        'pm.board.board: «contesto» non è un elenco di chiavi, minuscole e diverse',
        'pm.board.cartelle: «contesto» non è un elenco di chiavi, minuscole e diverse',
        'crm.crm.persona: «contesto» non è un elenco di chiavi, minuscole e diverse',
        'crm.crm.organizzazione: ha una chiave che non è tipo, icona, percorso, contenitore, contesto né codici',
        'crm.crm.trattativa: «contesto» non è un elenco di chiavi, minuscole e diverse',
        // Dallo sprint 28 l'opportunità ha dei codici per `esito`: col «contesto» storpiato qui sopra la chiave non c'è più, e
        // il controllo lo dice.
        'crm.crm.trattativa: «codici» nomina «esito», che non è una chiave di «contesto»',
    ]);
});

it('il controllo accetta `codici` solo come un oggetto che a chiavi di «contesto» della stessa risorsa dà un elenco non vuoto di codici minuscoli e diversi (sprint 27 · T1.2)', function () {
    $con = function (int $voce, int $risorsa, mixed $codici): array {
        $voci = registroDeiProdotti();
        $voci[$voce]['risorse'][$risorsa]['codici'] = $codici;

        return problemiDelRegistro($voci);
    };
    $delMembro = fn (mixed $codici): array => $con(0, 0, $codici);

    // Il caso parte dal registro di oggi, e cambia i soli `codici`: del membro, di una scheda, di un'azienda.
    expect(array_map(fn (int $voce, int $risorsa) => registroDeiProdotti()[$voce]['risorse'][$risorsa]['tipo'] ?? null, [0, 1, 2], [0, 0, 1]))
        ->toBe(['workspace.membro', 'board.scheda', 'crm.organizzazione'])
        // Quali codici, il controllo non lo sa: un elenco diverso, fatto bene, passa.
        ->and($delMembro(['ruolo' => ['proprietario', 'ospite']]))->toBe([])
        // Una chiave che non è in `contesto`: il suo valore non arriverebbe mai al browser.
        ->and($delMembro(['email' => ['personale']]))->toBe(['home.workspace.membro: «codici» nomina «email», che non è una chiave di «contesto»'])
        ->and($delMembro(['ruolo' => ['membro'], 'Ruolo' => ['membro']]))->toBe(['home.workspace.membro: «codici» nomina «Ruolo», che non è una chiave di «contesto»'])
        // La chiave di un'altra risorsa non vale: una scheda ha `board` e `lista`, un'azienda non ha `contesto`.
        ->and($con(1, 0, ['ruolo' => ['membro']]))->toBe(['pm.board.scheda: «codici» nomina «ruolo», che non è una chiave di «contesto»'])
        ->and($con(2, 1, ['ruolo' => ['membro']]))->toBe(['crm.crm.organizzazione: «codici» nomina «ruolo», che non è una chiave di «contesto»'])
        // Un elenco vuoto, un codice due volte, uno che non è un testo, uno con una maiuscola o uno spazio, un testo al posto dell'elenco.
        ->and(array_map($delMembro, [
            ['ruolo' => []], ['ruolo' => ['membro', 'membro']], ['ruolo' => ['membro', 7]], ['ruolo' => ['Membro']], ['ruolo' => ['co proprietario']],
            ['ruolo' => 'membro'], ['ruolo' => ['primo' => 'membro']], ['ruolo' => null],
        ]))->toBe(array_fill(0, 8, ['home.workspace.membro: i codici di «ruolo» non sono un elenco di codici, minuscoli e diversi']))
        // Tutte e due le cose insieme.
        ->and($delMembro(['email' => []]))->toBe([
            'home.workspace.membro: «codici» nomina «email», che non è una chiave di «contesto»',
            'home.workspace.membro: i codici di «email» non sono un elenco di codici, minuscoli e diversi',
        ])
        // E ciò che non è un oggetto: vuoto, un elenco, un testo, niente.
        ->and(array_map($delMembro, [[], ['proprietario', 'membro'], 'ruolo', null]))
        ->toBe(array_fill(0, 4, ['home.workspace.membro: «codici» non è un oggetto con un elenco di codici per chiave']));
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

// Sprint 26 · T8 (voce #1792): dal 12/10/2026 il backoffice dà il CRM `disponibile` a ogni workspace, e nel registro non è più in
// arrivo. In arrivo restano Bookings e i tre «Presto»; `presto` non cambia per nessuno.
it('ogni voce del registro dice se il prodotto è in arrivo per chi non ha una sessione: Bookings e i tre «Presto» sì, Dashboard, Project Management e CRM no; «Presto» resta dei tre (sprint 16 · T7.1; sprint 26 · T8.1)', function () {
    $voci = registroDeiProdotti();

    expect(array_column($voci, 'in_arrivo', 'id'))->toBe([
        'home' => false, 'pm' => false, 'crm' => false, 'bookings' => true, 'reports' => true, 'automations' => true, 'content' => true,
    ])
        // «Presto» non cambia: con `crm` o `bookings` «Presto» la cornice chiuderebbe la voce in ogni workspace, anche dove il
        // backoffice dà il modulo. Non è la leva per le pagine senza sessione.
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
    // Un prodotto in arrivo che non è «Presto» va bene (Bookings), e uno che non è né l'uno né l'altro anche (il CRM).
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
    expect(tipiDiRisorsa())->toBe(['home.workspace.membro', 'pm.board.scheda', 'pm.board.board', 'pm.board.cartelle', 'crm.crm.persona', 'crm.crm.organizzazione', 'crm.crm.trattativa'])
        ->and(valoriDelTipo('TipoDiRisorsa', 'resources/js/registro.ts'))->toEqualCanonicalizing(tipiDiRisorsa());
});

it('il tipo `CodiceDelContesto` di registro.ts elenca i codici che il registro dà alle chiavi di `contesto`, `<voce>.<tipo>.<chiave>.<codice>`: tsc chiede all\'inglese il testo di ognuno, e `aperta` non è un codice (sprint 27 · T1.4; sprint 28 · T1.4)', function () {
    expect(codiciDelContesto())->toBe([
        'home.workspace.membro.ruolo.proprietario', 'home.workspace.membro.ruolo.amministratore', 'home.workspace.membro.ruolo.membro',
        'crm.crm.trattativa.esito.vinta', 'crm.crm.trattativa.esito.persa',
    ])
        ->and(valoriDelTipo('CodiceDelContesto', 'resources/js/registro.ts'))->toEqualCanonicalizing(codiciDelContesto())
        // Il testo di un codice si chiede alle lingue con `searchContext.` davanti, come il nome da elenco con `searchSource.`.
        ->and(File::get(__DIR__.'/../../resources/js/lingue.ts'))->toContain('Record<`searchContext.${CodiceDelContesto}`, string>');
});

// Sprint 21 · T3 (voce #1641): da una notifica del CRM si apre la sua risorsa. Dove, lo dice il registro: parole e indirizzi sono
// di zr-crm (11/10/2026). Un contatto ha la sua pagina; una pipeline apre le sue impostazioni; una nota non ha una pagina sua, e
// si vede nella pagina della cosa più specifica a cui è attaccata — l'opportunità, poi il contatto, poi l'azienda (sprint 23 ·
// T3; fino alla `v1.12.0` solo il contatto, `persona_id`) —, anche quando è stata eliminata.

it('nel registro le notifiche del CRM che aprono la loro risorsa sono diciotto, col tipo intero: un contatto apre la sua pagina, una pipeline le sue impostazioni, un\'azienda la sua pagina in `/aziende`, mai in `/organizzazioni`, un\'opportunità la sua in `/opportunita`, mai in `/trattative`, un\'attività «Da fare», senza un id, e una nota la cosa più specifica a cui è attaccata: l\'opportunità, altrimenti il contatto, altrimenti l\'azienda; nessun altro prodotto ne ha (sprint 21 · T3.1, T5.2; sprint 23 · T3.1-T3.4)', function () {
    $voci = registroDeiProdotti();
    $dellaNota = ['percorso' => '/opportunita/{trattativa_id}', 'altrimenti' => ['/contatti/{persona_id}', '/aziende/{organizzazione_id}']];

    expect(problemiDelRegistro($voci))->toBe([])
        ->and($voci[2]['id'])->toBe('crm')
        ->and($voci[2]['notifiche'] ?? null)->toBe([
            ['tipo' => 'com.zeiras.crm.persona.creata', 'percorso' => '/contatti/{id}'],
            ['tipo' => 'com.zeiras.crm.persona.modificata', 'percorso' => '/contatti/{id}'],
            ['tipo' => 'com.zeiras.crm.pipeline.creata', 'percorso' => '/pipeline/{id}/impostazioni'],
            ['tipo' => 'com.zeiras.crm.pipeline.modificata', 'percorso' => '/pipeline/{id}/impostazioni'],
            ['tipo' => 'com.zeiras.crm.nota.creata'] + $dellaNota,
            ['tipo' => 'com.zeiras.crm.nota.modificata'] + $dellaNota,
            ['tipo' => 'com.zeiras.crm.nota.eliminata'] + $dellaNota,
            // Nel contratto un'azienda è una `organizzazione`; la pagina del CRM è `/aziende` (zr-crm, 11/10/2026).
            ['tipo' => 'com.zeiras.crm.organizzazione.creata', 'percorso' => '/aziende/{id}'],
            ['tipo' => 'com.zeiras.crm.organizzazione.modificata', 'percorso' => '/aziende/{id}'],
            // Sprint 23 · T3: nel contratto un'opportunità è una `trattativa`; la pagina del CRM è `/opportunita` (zr-crm, nota
            // 10406 del #95). Un'attività non ha una pagina sua. I quattro «assegnata» arrivano senza `com.zeiras.` davanti.
            ['tipo' => 'com.zeiras.crm.trattativa.creata', 'percorso' => '/opportunita/{id}'],
            ['tipo' => 'com.zeiras.crm.trattativa.modificata', 'percorso' => '/opportunita/{id}'],
            ['tipo' => 'crm.trattativa.assegnata', 'percorso' => '/opportunita/{id}'],
            ['tipo' => 'com.zeiras.crm.attivita.creata', 'percorso' => '/da-fare'],
            ['tipo' => 'com.zeiras.crm.attivita.modificata', 'percorso' => '/da-fare'],
            ['tipo' => 'com.zeiras.crm.attivita.eliminata', 'percorso' => '/da-fare'],
            ['tipo' => 'crm.attivita.assegnata', 'percorso' => '/da-fare'],
            ['tipo' => 'crm.persona.assegnata', 'percorso' => '/contatti/{id}'],
            ['tipo' => 'crm.organizzazione.assegnata', 'percorso' => '/aziende/{id}'],
        ])
        // Sprint 24 · T3: anche Project Management ha le sue, tre, col loro caso qui sotto; le diciotto del CRM restano com'erano.
        ->and(array_keys(array_filter(array_column($voci, 'notifiche', 'id'))))->toBe(['pm', 'crm'])
        // I nomi del backoffice non entrano in un indirizzo, e l'id di un'attività nemmeno.
        ->and(preg_match('~/(trattative|attivita|organizzazioni|persone)\\b|/da-fare/~', (string) json_encode($voci[2]['notifiche'], JSON_UNESCAPED_SLASHES)))->toBe(0);
});

// Sprint 24 · T3 (voce #1748). Project Management ha le sue prime destinazioni: una scheda nuova, modificata o assegnata apre la
// pagina della scheda in zr-board, `/c/{id}` (zr-board, nota 10451 del #95: quella pagina legge la scheda e rimanda al suo
// dettaglio nella board; zr-pm, nota 10565: una notifica con una risorsa apre la risorsa). L'id è `id` nei `dati` dei due eventi
// del contratto e in quelli della notifica a chi viene assegnata la scheda, che non è un evento e arriva senza `com.zeiras.`
// davanti. Una scheda eliminata non ha più una pagina, e gli altri tipi della board restano senza destinazione.

it('nel registro le notifiche di Project Management che aprono la loro risorsa sono quattro — una scheda nuova, modificata, assegnata, e una menzione in un commento —, e aprono tutte la pagina della scheda, `/c/{id}`: una scheda eliminata e gli altri tipi della board non hanno una destinazione, e quelle del CRM restano diciotto (sprint 24 · T3.2, T3.4, T3.5; sprint 26 · T6.2)', function () {
    $voci = registroDeiProdotti();

    expect(problemiDelRegistro($voci))->toBe([])
        ->and($voci[1]['id'])->toBe('pm')
        // La lista intera: un tipo in più — una scheda eliminata, una vista, una lista — è il difetto.
        ->and($voci[1]['notifiche'] ?? null)->toBe([
            ['tipo' => 'com.zeiras.board.scheda.creata', 'percorso' => '/c/{id}'],
            ['tipo' => 'com.zeiras.board.scheda.modificata', 'percorso' => '/c/{id}'],
            ['tipo' => 'board.scheda.assegnata', 'percorso' => '/c/{id}'],
            ['tipo' => 'board.commento.menzione', 'percorso' => '/c/{id}'],
        ])
        ->and($voci[1]['indirizzo'])->toBe('https://board.zeiras.com')
        ->and($voci[2]['notifiche'] ?? [])->toHaveCount(18);
});

it('il controllo accetta `altrimenti` solo come lista non vuota di percorsi, ognuno con le regole di `percorso` e nessuno ripetuto, non accetta un\'altra chiave accanto, e sa che un tipo `crm.…` è del CRM e uno `board.…` di Project Management (sprint 23 · T3.6; sprint 24 · T3.5)', function () {
    $voci = registroDeiProdotti();
    $voci[1]['notifiche'] = [
        // Buone: una lista di uno, e una di due con un percorso senza segnaposto in fondo.
        ['tipo' => 'com.zeiras.board.uat.uno', 'percorso' => '/b/{board_id}/c/{id}', 'altrimenti' => ['/b/{board_id}']],
        ['tipo' => 'com.zeiras.board.uat.due', 'percorso' => '/b/{board_id}/c/{id}', 'altrimenti' => ['/b/{board_id}', '/elenco']],
        // Non è una lista non vuota: un testo, una lista vuota, `null`, una lista con le chiavi.
        ['tipo' => 'com.zeiras.board.uat.testo', 'percorso' => '/b/{id}', 'altrimenti' => '/b'],
        ['tipo' => 'com.zeiras.board.uat.vuota', 'percorso' => '/b/{id}', 'altrimenti' => []],
        ['tipo' => 'com.zeiras.board.uat.null', 'percorso' => '/b/{id}', 'altrimenti' => null],
        ['tipo' => 'com.zeiras.board.uat.chiavi', 'percorso' => '/b/{id}', 'altrimenti' => ['primo' => '/b']],
        // Un percorso della lista fuori dalle regole di `percorso`.
        ['tipo' => 'com.zeiras.board.uat.senza-barra', 'percorso' => '/b/{id}', 'altrimenti' => ['b']],
        ['tipo' => 'com.zeiras.board.uat.nome', 'percorso' => '/b/{id}', 'altrimenti' => ['/b', '/c/{nome}']],
        ['tipo' => 'com.zeiras.board.uat.numero', 'percorso' => '/b/{id}', 'altrimenti' => [7]],
        ['tipo' => 'com.zeiras.board.uat.domanda', 'percorso' => '/b/{id}', 'altrimenti' => ['/b?x=1']],
        // Ripetuto: uguale a `percorso`, o due volte nella lista.
        ['tipo' => 'com.zeiras.board.uat.uguale', 'percorso' => '/b/{id}', 'altrimenti' => ['/b/{id}']],
        ['tipo' => 'com.zeiras.board.uat.doppio', 'percorso' => '/b/{board_id}/c/{id}', 'altrimenti' => ['/b/{board_id}', '/c/{id}', '/b/{board_id}']],
        // Un'altra chiave accanto ad `altrimenti`.
        ['tipo' => 'com.zeiras.board.uat.poi', 'percorso' => '/b/{id}', 'altrimenti' => ['/b'], 'poi' => ['/c']],
        // Un tipo che non è un evento: `crm.…` è del CRM, e fra quelli di Project Management non si aprirebbe mai.
        ['tipo' => 'crm.uat.assegnata', 'percorso' => '/b/{id}'],
        // Sprint 24 · T3: anche `board.…` non è un evento, ed è di Project Management: nella sua voce va bene.
        ['tipo' => 'board.uat.assegnata', 'percorso' => '/c/{id}'],
    ];
    // Nella sua voce va bene; `crm` attaccato a un'altra parola, o non all'inizio, non dice l'app.
    $voci[2]['notifiche'][] = ['tipo' => 'crm.uat.assegnato', 'percorso' => '/contatti/{id}'];
    $voci[2]['notifiche'][] = ['tipo' => 'crmx.uat.attaccato', 'percorso' => '/contatti/{id}'];
    $voci[2]['notifiche'][] = ['tipo' => 'x.crm.uat.davanti', 'percorso' => '/contatti/{id}'];
    // `board.…` fra quelli del CRM non si aprirebbe mai; attaccato a un'altra parola, o non all'inizio, non dice l'app.
    $voci[2]['notifiche'][] = ['tipo' => 'board.uat.assegnato', 'percorso' => '/contatti/{id}'];
    $voci[2]['notifiche'][] = ['tipo' => 'boardx.uat.attaccato', 'percorso' => '/contatti/{id}'];
    $voci[2]['notifiche'][] = ['tipo' => 'x.board.uat.davanti', 'percorso' => '/contatti/{id}'];

    $nonLista = fn (string $tipo) => "pm, notifica com.zeiras.board.uat.$tipo: «altrimenti» non è una lista di percorsi, o è vuota";
    $sbagliato = fn (string $tipo, string $percorso) => "pm, notifica com.zeiras.board.uat.$tipo: il percorso «{$percorso}» di «altrimenti» non comincia con /, o ha un carattere o un segnaposto che non è ammesso";

    expect(problemiDelRegistro($voci))->toEqualCanonicalizing([
        $nonLista('testo'),
        $nonLista('vuota'),
        $nonLista('null'),
        $nonLista('chiavi'),
        $sbagliato('senza-barra', 'b'),
        $sbagliato('nome', '/c/{nome}'),
        $sbagliato('numero', ''),
        $sbagliato('domanda', '/b?x=1'),
        'pm, notifica com.zeiras.board.uat.uguale: il percorso «/b/{id}» di «altrimenti» è scritto due volte',
        'pm, notifica com.zeiras.board.uat.doppio: il percorso «/b/{board_id}» di «altrimenti» è scritto due volte',
        'pm, notifica com.zeiras.board.uat.poi: ha una chiave che non è tipo, percorso né altrimenti',
        'pm, notifica crm.uat.assegnata: il tipo è di crm, e nella voce di pm non si aprirebbe mai',
        'crm, notifica crmx.uat.attaccato: il controllo non sa di che app è questo tipo',
        'crm, notifica x.crm.uat.davanti: il controllo non sa di che app è questo tipo',
        'crm, notifica board.uat.assegnato: il tipo è di pm, e nella voce di crm non si aprirebbe mai',
        'crm, notifica boardx.uat.attaccato: il controllo non sa di che app è questo tipo',
        'crm, notifica x.board.uat.davanti: il controllo non sa di che app è questo tipo',
    ]);
});

// Sprint 24 · T4 (voce #1754; lettura della PR #51, R6). Browser e parte server provano i percorsi in ordine e si fermano al
// primo che ha tutti i suoi id: un percorso che chiede almeno gli id di uno che viene prima non si aprirebbe mai, perché quando
// li ha tutti li ha anche quello. Vale per uno le cui chiavi comprendono quelle di uno prima, e per ogni percorso dopo uno senza
// segnaposto, che si apre sempre.
it('il controllo trova un percorso di `altrimenti` che non si aprirebbe mai: uno che chiede almeno gli id di un percorso che viene prima, e uno dopo un percorso senza segnaposto; il registro di oggi non ne ha (sprint 24 · T4.3)', function () {
    $voci = registroDeiProdotti();
    $voci[1]['notifiche'] = [
        // Buone: ogni percorso fa a meno di un id che quelli prima chiedono, e quello senza segnaposto è l'ultimo.
        ['tipo' => 'com.zeiras.board.uat.stretto', 'percorso' => '/b/{board_id}/c/{id}', 'altrimenti' => ['/b/{board_id}', '/elenco']],
        ['tipo' => 'com.zeiras.board.uat.altri', 'percorso' => '/a/{trattativa_id}', 'altrimenti' => ['/p/{persona_id}', '/o/{organizzazione_id}']],
        // Mai: chiede gli id di `percorso`, e uno in più.
        ['tipo' => 'com.zeiras.board.uat.largo', 'percorso' => '/b/{board_id}', 'altrimenti' => ['/b/{board_id}/c/{id}']],
        // Mai: chiede gli stessi id di `percorso`, in un altro percorso.
        ['tipo' => 'com.zeiras.board.uat.stessi', 'percorso' => '/b/{id}', 'altrimenti' => ['/c/{id}']],
        // Mai: viene dopo un percorso senza segnaposto — `percorso`, o uno di `altrimenti`.
        ['tipo' => 'com.zeiras.board.uat.dopo-il-fisso', 'percorso' => '/elenco', 'altrimenti' => ['/b/{id}']],
        ['tipo' => 'com.zeiras.board.uat.in-mezzo', 'percorso' => '/b/{board_id}/c/{id}', 'altrimenti' => ['/elenco', '/b/{board_id}']],
    ];
    $mai = fn (string $tipo, string $percorso, string $prima) => "pm, notifica com.zeiras.board.uat.$tipo: il percorso «{$percorso}» di «altrimenti» non si aprirebbe mai: quando ha i suoi id li ha anche «{$prima}», che viene prima";

    expect(problemiDelRegistro($voci))->toEqualCanonicalizing([
        $mai('largo', '/b/{board_id}/c/{id}', '/b/{board_id}'),
        $mai('stessi', '/c/{id}', '/b/{id}'),
        $mai('dopo-il-fisso', '/b/{id}', '/elenco'),
        $mai('in-mezzo', '/b/{board_id}', '/elenco'),
    ])->and(problemiDelRegistro(registroDeiProdotti()))->toBe([]);
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
        'pm, notifica com.zeiras.board.uat.titolo: ha una chiave che non è tipo, percorso né altrimenti',
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
    $lingue = lingueDellaCornice();

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
