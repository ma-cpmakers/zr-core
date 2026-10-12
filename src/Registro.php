<?php

namespace Zeiras\Core;

/**
 * Il registro dei moduli per la parte server: le voci di quello del pacchetto (resources/registro/prodotti.json), lette una
 * volta per processo. Le chiedono qui le rotte che ne hanno bisogno — la ricerca, per le chiavi di `contesto` di un tipo di
 * risultato, e l'elenco delle notifiche, per gli id del percorso di un tipo di notifica —: un lettore solo, così chi ne
 * avrà bisogno domani non ne tiene un'altra copia. È lo stesso file da cui il browser compone ciò che mostra.
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
        return self::$voci ??= json_decode((string) file_get_contents(__DIR__.'/../resources/registro/prodotti.json'), true, flags: JSON_THROW_ON_ERROR)['prodotti'];
    }
}
