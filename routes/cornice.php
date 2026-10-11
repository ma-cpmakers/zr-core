<?php

use Illuminate\Support\Facades\Route;
use Zeiras\Auth\Sessione;
use Zeiras\Core\Http\ConWorkspace;
use Zeiras\Core\Http\NotificheDellaCornice;
use Zeiras\Core\Http\RicercaDellaCornice;

// Le rotte di zr-core per il browser, sull'origine del frontend: nel gruppo `web`, con la sessione, la guardia di zr-auth e
// il CSRF, e nel workspace della sessione (ConWorkspace). La cornice chiama l'elenco delle notifiche, le letture e la
// ricerca; la lettura di una notifica sola non la chiama più dalla v1.1.0, e resta per i frontend che la usano. La parte
// server le gira al backoffice col gettone del workspace, che resta nella sessione. Un valore che dall'indirizzo finisce nel
// percorso chiamato sul backoffice ha il suo vincolo qui: fuori dai caratteri ammessi la rotta non c'è (404).
// La ricerca è una POST dalla v1.8.0: la parola cercata sta nel corpo, mai in un indirizzo, e una GET non ha una rotta.
// Le letture tengono il blocco della sessione (`Route::block`) per tutta la loro durata, con l'attesa di zr-auth: possono
// durare una quindicina di secondi, e finendo rimetterebbero la sessione di prima a chi intanto è uscito o è entrato in un
// altro workspace. Il blocco dura tenutaDelBlocco() secondi da quando è preso: una richiesta che i middleware del frontend
// tengono più a lungo prima della rotta ci arriva a blocco scaduto. Solo loro, e mai il gruppo: col blocco sulle GET due
// richieste della stessa persona si metterebbero in fila.
Route::middleware(['web', ConWorkspace::class])->prefix('cornice')->group(function (): void {
    Route::get('notifiche', [NotificheDellaCornice::class, 'elenco']);
    Route::post('notifiche/letture', [NotificheDellaCornice::class, 'letture'])
        ->block(NotificheDellaCornice::tenutaDelBlocco(), Sessione::BLOCCO_ATTESA);
    Route::patch('notifiche/{notifica}/lettura', [NotificheDellaCornice::class, 'lettura'])->where('notifica', NotificheDellaCornice::ID);
    Route::post('ricerca', [RicercaDellaCornice::class, 'cerca']);
});
