<?php

use Illuminate\Support\Facades\Route;
use Zeiras\Core\Http\ConWorkspace;
use Zeiras\Core\Http\NotificheDellaCornice;
use Zeiras\Core\Http\RicercaDellaCornice;

// Le rotte di zr-core per il browser, sull'origine del frontend: nel gruppo `web`, con la sessione, la guardia di zr-auth e
// il CSRF, e nel workspace della sessione (ConWorkspace). La cornice chiama l'elenco delle notifiche, le letture e la
// ricerca; la lettura di una notifica sola non la chiama più dalla v1.1.0, e resta per i frontend che la usano. La parte
// server le gira al backoffice col gettone del workspace, che resta nella sessione. Un valore che dall'indirizzo finisce nel
// percorso chiamato sul backoffice ha il suo vincolo qui: fuori dai caratteri ammessi la rotta non c'è (404).
Route::middleware(['web', ConWorkspace::class])->prefix('cornice')->group(function (): void {
    Route::get('notifiche', [NotificheDellaCornice::class, 'elenco']);
    Route::post('notifiche/letture', [NotificheDellaCornice::class, 'letture']);
    Route::patch('notifiche/{notifica}/lettura', [NotificheDellaCornice::class, 'lettura'])->where('notifica', NotificheDellaCornice::ID);
    Route::get('ricerca', [RicercaDellaCornice::class, 'cerca']);
});
