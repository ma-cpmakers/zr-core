<?php

use Illuminate\Support\Facades\Route;
use Zeiras\Core\Http\NotificheDellaCornice;

// Le rotte che la cornice chiama dal browser, sull'origine del frontend: nel gruppo `web`, con la sessione, la guardia di
// zr-auth e il CSRF. La parte server le gira al backoffice col gettone del workspace, che resta nella sessione.
Route::middleware('web')->prefix('cornice')->group(function (): void {
    Route::get('notifiche', [NotificheDellaCornice::class, 'elenco']);
    Route::patch('notifiche/lettura', [NotificheDellaCornice::class, 'lettura']);
});
