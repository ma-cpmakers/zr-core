<?php

namespace Zeiras\Core;

use Illuminate\Support\ServiceProvider;

/**
 * Il punto d'ingresso di zr-core nell'app che lo installa: Laravel lo trova da solo (extra.laravel.providers nel
 * composer.json). Registra le rotte che la cornice chiama dal browser (routes/cornice.php), nel gruppo `web` del frontend, la
 * favicon di Zeiras — la vista `zr-core::favicon` e i tre file statici che `vendor:publish` mette in public/ — e i valori di
 * partenza della configurazione (config/zr-core.php). Il middleware delle intestazioni di sicurezza non lo registra: il suo
 * posto, primo dei globali, lo decide il frontend nel suo bootstrap/app.php.
 */
class ZrCoreServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // I valori di partenza: una chiave scritta nel config/zr-core.php del frontend vince.
        $this->mergeConfigFrom(__DIR__.'/../config/zr-core.php', 'zr-core');
    }

    public function boot(): void
    {
        $this->loadRoutesFrom(__DIR__.'/../routes/cornice.php');
        $this->loadViewsFrom(__DIR__.'/../resources/views', 'zr-core');

        // La favicon: file statici, nessuna rotta (/favicon.ico lo serve il server web). Due tag: quello di zr-core, e
        // `laravel-assets`, che un frontend Laravel pubblica già a ogni `composer update` (il suo post-update-cmd): senza il
        // secondo, a chi aggiorna zr-core i file non arriverebbero. favicon.svg è la copia del design system, col nome che il
        // browser chiede; gli altri due li genera `npm run favicon` da quella.
        $this->publishes([
            __DIR__.'/../resources/zeiras/logos/zeiras-favicon.svg' => public_path('favicon.svg'),
            __DIR__.'/../resources/favicon/favicon.ico' => public_path('favicon.ico'),
            __DIR__.'/../resources/favicon/apple-touch-icon.png' => public_path('apple-touch-icon.png'),
        ], ['zr-core-favicon', 'laravel-assets']);

        // La configurazione ha un tag suo, e non `laravel-assets`: lì un `--force` a ogni aggiornamento riscriverebbe le
        // sorgenti che il modulo ha aggiunto alla CSP.
        $this->publishes([__DIR__.'/../config/zr-core.php' => config_path('zr-core.php')], 'zr-core-config');
    }
}
