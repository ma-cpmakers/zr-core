<?php

namespace Zeiras\Core;

use Illuminate\Support\ServiceProvider;

/**
 * Il punto d'ingresso di zr-core nell'app che lo installa: Laravel lo trova da solo (extra.laravel.providers nel
 * composer.json). Vuoto allo spawn: la cornice e il registro dei prodotti li scrive l'agente di zr-core.
 */
class ZrCoreServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        //
    }
}
