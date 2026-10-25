<?php

namespace Zeiras\Core;

/**
 * Il registro dei moduli per la parte server: le voci di quello del pacchetto (resources/registro/prodotti.json), lette una
 * volta per processo. Le chiedono qui le rotte che ne hanno bisogno — la ricerca, per le chiavi di `contesto` di un tipo di
 * risultato, e l'elenco delle notifiche, per gli id del percorso di un tipo di notifica —: un lettore solo, così chi ne
 * avrà bisogno domani non ne tiene un'altra copia. È lo stesso file da cui il browser compone ciò che mostra.
 *
 * Dalla v3.0.0 le righe che dicono dove si apre ogni notifica non stanno più nelle voci del file, ma in un file loro
 * (resources/registro/notifiche.json, per id del prodotto), che nel browser legge solo il pezzo della campanella: qui si
 * rimettono nella voce del loro prodotto, in `notifiche`, così chi le chiede le trova dove le trovava.
 *
 * Dalla v3.3.0 le risorse della ricerca di Bookings stanno in un file loro (resources/registro/ricerca.json, per id del
 * prodotto), che nel browser legge solo il pezzo della ricerca (la voce ha solo i loro tipi, in `fonti`): qui si rimettono
 * nella voce del loro prodotto, in `risorse`, così la ricerca le trova dove trova quelle degli altri prodotti.
 *
 * Il file è quello del pacchetto, sempre: nessun metodo e nessuna configurazione ne sceglie un altro, e niente qui lo
 * scrive. Un test che vuole un registro di prova scrive la proprietà privata con la reflection, e dopo la rimette a null.
 *
 * @internal Serve alle rotte della cornice: non è per chi installa il pacchetto.
 */
final class Registro
{
    /** @var list<array<string, mixed>>|null */
    private static ?array $voci = null;

    /**
     * Le voci del registro, nell'ordine del file.
     *
     * @return list<array<string, mixed>>
     */
    public static function voci(): array
    {
        if (self::$voci === null) {
            /** @var list<array<string, mixed>> $voci */
            $voci = json_decode((string) file_get_contents(__DIR__.'/../resources/registro/prodotti.json'), true, flags: JSON_THROW_ON_ERROR)['prodotti'];
            /** @var array<string, list<array<string, mixed>>> $righe */
            $righe = json_decode((string) file_get_contents(__DIR__.'/../resources/registro/notifiche.json'), true, flags: JSON_THROW_ON_ERROR);
            /** @var array<string, list<array<string, mixed>>> $risorse */
            $risorse = json_decode((string) file_get_contents(__DIR__.'/../resources/registro/ricerca.json'), true, flags: JSON_THROW_ON_ERROR);
            foreach ($voci as $indice => $voce) {
                if (isset($righe[$voce['id']])) {
                    $voci[$indice]['notifiche'] = $righe[$voce['id']];
                }
                if (isset($risorse[$voce['id']])) {
                    $voci[$indice]['risorse'] = $risorse[$voce['id']];
                }
            }
            self::$voci = $voci;
        }

        return self::$voci;
    }
}
