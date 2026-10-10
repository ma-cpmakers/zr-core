<?php

namespace Zeiras\Core;

use Illuminate\Support\Carbon;

/**
 * Il segno di un istante della parte server: quando una lettura è cominciata, quando una lettura è stata segnata. Lo portano
 * i dati della cornice e l'elenco delle notifiche (`aggiornati_il`) e la risposta di «segna tutte come lette» (`segnate_il`):
 * la cornice, nel browser, li confronta per non tornare a ciò che è più vecchio di quello che sa già. Per questo vengono
 * tutti da qui: un orologio solo, quello della parte server, e una forma sola.
 */
final class Segno
{
    /**
     * L'istante di adesso, in UTC qualunque sia il fuso dell'applicazione, coi microsecondi sempre a sei cifre e `Z` in fondo
     * (`2026-10-09T21:31:05.123456Z`): così due segni si ordinano anche come stringhe.
     */
    public static function adesso(): string
    {
        return Carbon::now('UTC')->format('Y-m-d\TH:i:s.u\Z');
    }
}
