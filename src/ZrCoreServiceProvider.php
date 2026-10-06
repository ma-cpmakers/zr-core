<?php

namespace Zeiras\Core;

use Illuminate\Support\ServiceProvider;

/**
 * Il punto d'ingresso di zr-core nell'app che lo installa: Laravel lo trova da solo (extra.laravel.providers nel
 * composer.json). Registra le rotte che la cornice chiama dal browser (routes/cornice.php), nel gruppo `web` del frontend.
 */
class ZrCoreServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        $this->loadRoutesFrom(__DIR__.'/../routes/cornice.php');
    }
}
