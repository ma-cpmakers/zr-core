<?php

namespace Zeiras\Core\Http;

/**
 * Quando accade la cosa di cui si parla — l'inizio di una prenotazione —, nella forma che le rotte della cornice lasciano
 * arrivare alla pagina (dalla v3.3.0): `il`, un istante ISO in UTC con la Z, e `fuso`, il nome IANA in cui si legge. La
 * usano le notifiche (`quando` di una notifica) e la ricerca (`quando` nel contesto di un risultato), così le due rotte non
 * ne tengono due copie che possano divergere.
 *
 * @internal Serve alle rotte della cornice: non è per chi installa il pacchetto.
 */
final class Quando
{
    /**
     * `quando` nella sola forma che passa alla pagina — `il` un istante ISO in UTC con la Z, `fuso` un nome IANA, e nessun'altra
     * chiave —, o null.
     *
     * @return array{il: string, fuso: string}|null
     */
    public static function di(mixed $quando): ?array
    {
        if (! is_array($quando) || (array_keys($quando) !== ['il', 'fuso'] && array_keys($quando) !== ['fuso', 'il'])
            || ! is_string($quando['il']) || ! is_string($quando['fuso'])
            || preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/D', $quando['il']) !== 1
            || preg_match('#^[A-Za-z][A-Za-z0-9_+-]*(/[A-Za-z0-9_+-]+){0,2}$#D', $quando['fuso']) !== 1) {
            return null;
        }

        return ['il' => $quando['il'], 'fuso' => $quando['fuso']];
    }
}
