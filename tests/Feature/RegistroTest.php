<?php

use Illuminate\Support\Facades\File;

// Sprint 1 · T4 e T7 (voce #1255). Il registro dei prodotti di zr-core, resources/registro/prodotti.json: nell'ordine della linea
// guida 10 del design system, Dashboard e i sei prodotti, ognuno con un id del design system, un'icona del set (`IconName`), un
// tono (`Tone`, tranne Dashboard), l'indirizzo della mappa della linea guida 15 e «Presto». I nomi non ci sono: stanno nelle lingue
// (T7, decisione 5926 di Luciano). I tipi si leggono dalla copia derivata di index.d.ts; ordine, icone, toni, indirizzi e «Presto»
// sono quelli del design system alla versione delle copie in resources/zeiras/ (README «Iconografia», linee guida 10 e 15, anteprima
// dell'AppShell). Sprint 3 · T5 (voce #1277): le risorse di un prodotto che la ricerca mostra, ognuna col tipo del backoffice,
// un'icona del set, il percorso nel prodotto e se è un contenitore; i loro nomi stanno nelle lingue, con `<prodotto>.<tipo>`.
// Sprint 5 · T4 (voce #1257): il tipo è quello di ricerca.elenca (`board.cartelle`, `board.board`), e sta in un prodotto solo,
// perché un risultato della ricerca non dice di che prodotto è: la cornice lo trova dal tipo.

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
 * mappa, un nome (i nomi stanno nelle lingue), «Presto» che non è un sì o un no; in una risorsa, un tipo vuoto, ripetuto o già
 * di un altro prodotto, un'icona fuori dal set, un percorso che non comincia con / o non ha un solo `{id}`, «contenitore» che
 * non è un sì o un no, un nome.
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
            if (! is_string($risorsa['percorso'] ?? null) || preg_match('~^/[^{}]*\{id\}[^{}]*$~', $risorsa['percorso']) !== 1) {
                $problemi[] = "$nome: il percorso «".($risorsa['percorso'] ?? '').'» non comincia con / o non ha un solo {id}';
            }
            if (! is_bool($risorsa['contenitore'] ?? null)) {
                $problemi[] = "$nome: «contenitore» non è un sì o un no";
            }
            if (array_key_exists('nome', $risorsa)) {
                $problemi[] = "$nome: ha un nome, ma i nomi stanno nelle lingue";
            }
        }
    }

    return $problemi;
}

it('il registro elenca nell\'ordine della linea guida 10 Dashboard e i sei prodotti, con icone del set, toni, indirizzi della mappa e «Presto», senza nomi (T4.1, T7.3)', function () {
    $voci = registroDeiProdotti();

    expect(array_column($voci, 'id'))->toBe(['home', 'pm', 'crm', 'bookings', 'reports', 'automations', 'content'])
        ->and(problemiDelRegistro($voci))->toBe([])
        // Nessun nome: la Dashboard ha il testo `dashboard` delle lingue, ogni prodotto il testo col suo id. La Dashboard non ha tono.
        ->and(collect($voci)->map(fn (array $voce) => collect($voce)->keys()->sort()->values()->all())->all())->toBe([
            ['icona', 'id', 'indirizzo', 'presto'],
            ['icona', 'id', 'indirizzo', 'presto', 'risorse', 'tono'],
            ...array_fill(0, 5, ['icona', 'id', 'indirizzo', 'presto', 'tono']),
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
        // le rotte della linea guida 10 (provvisorie finché zr-board non decide le sue), a pagina intera. Icone: `folder` per la
        // cartella (come `ProjectFolder`), `board` per la board. Le schede entrano quando il contratto ha il loro tipo.
        ->and($voci[1]['risorse'])->toBe([
            ['tipo' => 'board.cartelle', 'icona' => 'folder', 'percorso' => '/cartelle/{id}', 'contenitore' => true],
            ['tipo' => 'board.board', 'icona' => 'board', 'percorso' => '/b/{id}', 'contenitore' => true],
        ])
        // Nessun altro prodotto ha risorse: un tipo in due prodotti sarebbe un problema (sopra), e qui non ce n'è nessuno.
        ->and(array_keys(array_filter(array_column($voci, 'risorse', 'id'))))->toBe(['pm']);
});

it('il controllo trova un\'icona fuori dal set, un tono che non esiste, un indirizzo fuori dalla mappa e un nome (T4.1, T7.3)', function () {
    $voci = registroDeiProdotti();
    $voci[1]['tono'] = 'teal';
    $voci[2]['nome'] = 'CRM';
    $voci[3]['icona'] = 'calendar-days';
    $voci[3]['indirizzo'] = 'https://cal.zeiras.com';
    unset($voci[4]['presto']);
    $voci[1]['risorse'][] = ['tipo' => 'board.board', 'icona' => 'card', 'percorso' => '/b', 'contenitore' => 'sì', 'nome' => 'Board'];
    $voci[1]['risorse'][] = ['tipo' => ' ', 'icona' => 'board', 'percorso' => '/b/{id}/c/{id}', 'contenitore' => false];
    // Lo stesso tipo in un altro prodotto: la cornice non saprebbe di chi è un risultato. Un tipo suo, invece, va bene.
    $voci[2]['risorse'] = [
        ['tipo' => 'board.cartelle', 'icona' => 'folder', 'percorso' => '/cartelle/{id}', 'contenitore' => true],
        ['tipo' => 'uat.contatti', 'icona' => 'users', 'percorso' => '/contatti/{id}', 'contenitore' => false],
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
            'pm.board.board: il percorso «/b» non comincia con / o non ha un solo {id}',
            'pm.board.board: «contenitore» non è un sì o un no',
            'pm.board.board: ha un nome, ma i nomi stanno nelle lingue',
            'pm. : il tipo è vuoto',
            'pm. : il percorso «/b/{id}/c/{id}» non comincia con / o non ha un solo {id}',
            'crm.board.cartelle: il tipo è già di pm',
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
