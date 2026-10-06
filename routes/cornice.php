<?php

use Illuminate\Support\Facades\Route;
use Zeiras\Core\Http\ConWorkspace;
use Zeiras\Core\Http\NotificheDellaCornice;
use Zeiras\Core\Http\RicercaDellaCornice;

// Le rotte che la cornice chiama dal browser, sull'origine del frontend: nel gruppo `web`, con la sessione, la guardia di
// zr-auth e il CSRF, e nel workspace della sessione (ConWorkspace). La parte server le gira al backoffice col gettone del
// workspace, che resta nella sessione.
Route::middleware(['web', ConWorkspace::class])->prefix('cornice')->group(function (): void {
    Route::get('notifiche', [NotificheDellaCornice::class, 'elenco']);
    Route::patch('notifiche/lettura', [NotificheDellaCornice::class, 'lettura']);
    Route::get('ricerca', [RicercaDellaCornice::class, 'cerca']);
});
