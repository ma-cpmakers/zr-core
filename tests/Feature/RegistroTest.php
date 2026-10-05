<?php

use Illuminate\Support\Facades\File;

// Sprint 1 · T4 e T7 (voce #1255). Il registro dei prodotti di zr-core, resources/registro/prodotti.json: nell'ordine della linea
// guida 10 del design system, Dashboard e i sei prodotti, ognuno con un id del design system, un'icona del set (`IconName`), un
// tono (`Tone`, tranne Dashboard), l'indirizzo della mappa della linea guida 15 e «Presto». I nomi non ci sono: stanno nelle lingue
// (T7, decisione 5926 di Luciano). I tipi si leggono dalla copia derivata di index.d.ts; ordine, icone, toni, indirizzi e «Presto»
// sono quelli del design system alla versione di docs/zr-design-system.md (README «Iconografia», linee guida 10 e 15, anteprima
// dell'AppShell).

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
 * mappa, un nome (i nomi stanno nelle lingue), «Presto» che non è un sì o un no.
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
    }

    return $problemi;
}

it('il registro elenca nell\'ordine della linea guida 10 Dashboard e i sei prodotti, con icone del set, toni, indirizzi della mappa e «Presto», senza nomi (T4.1, T7.3)', function () {
    $voci = registroDeiProdotti();

    expect(array_column($voci, 'id'))->toBe(['home', 'pm', 'crm', 'bookings', 'reports', 'automations', 'content'])
        ->and(problemiDelRegistro($voci))->toBe([])
        // Nessun nome: la Dashboard ha il testo `dashboard` delle lingue, ogni prodotto il testo col suo id. La Dashboard non ha tono.
        ->and(array_map('array_keys', $voci))->toEqual([
            ['id', 'icona', 'indirizzo', 'presto'],
            ...array_fill(0, 6, ['id', 'icona', 'tono', 'indirizzo', 'presto']),
        ])
        ->and(array_column($voci, 'icona', 'id'))->toBe([
            'home' => 'grid', 'pm' => 'board', 'crm' => 'users', 'bookings' => 'calendar', 'reports' => 'chart',
            'automations' => 'bolt', 'content' => 'sparkle',
        ])
        ->and(array_column($voci, 'tono', 'id'))->toBe([
            'pm' => 'pine', 'crm' => 'sky', 'bookings' => 'sky', 'reports' => 'citrus', 'automations' => 'plum', 'content' => 'coral',
        ])
        // «Presto» come nell'anteprima dell'AppShell: provvisorio, finché non si sa quali prodotti sono disponibili.
        ->and(array_keys(array_filter(array_column($voci, 'presto', 'id'))))->toBe(['reports', 'automations', 'content']);
});

it('il controllo trova un\'icona fuori dal set, un tono che non esiste, un indirizzo fuori dalla mappa e un nome (T4.1, T7.3)', function () {
    $voci = registroDeiProdotti();
    $voci[1]['tono'] = 'teal';
    $voci[2]['nome'] = 'CRM';
    $voci[3]['icona'] = 'calendar-days';
    $voci[3]['indirizzo'] = 'https://cal.zeiras.com';
    unset($voci[4]['presto']);

    expect(valoriDelTipo('IconName'))->toContain('calendar', 'board', 'sparkle')
        ->and(valoriDelTipo('Tone'))->toContain('pine', 'sky', 'neutral')
        ->and(problemiDelRegistro($voci))->toEqualCanonicalizing([
            'pm: il tono «teal» non è un tono di prodotto',
            'crm: ha un nome, ma i nomi stanno nelle lingue',
            "bookings: l'icona «calendar-days» non è del set",
            "bookings: l'indirizzo «https://cal.zeiras.com» non è quello della mappa",
            'reports: «Presto» non è un sì o un no',
        ]);
});

it('il tipo `IdDiProdotto` di registro.ts elenca i prodotti del registro: tsc chiede all\'inglese il nome di ognuno (T7.1)', function () {
    expect(idDeiProdotti())->toBe(['pm', 'crm', 'bookings', 'reports', 'automations', 'content'])
        ->and(valoriDelTipo('IdDiProdotto', 'resources/js/registro.ts'))->toBe(idDeiProdotti());
});
