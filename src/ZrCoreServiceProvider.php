<?php

namespace Zeiras\Core;

use Illuminate\Contracts\Http\Kernel;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

/**
 * Il punto d'ingresso di zr-core nell'app che lo installa: Laravel lo trova da solo (extra.laravel.providers nel
 * composer.json). Registra le rotte che la cornice chiama dal browser (routes/cornice.php), nel gruppo `web` del frontend, la
 * favicon di Zeiras — la vista `zr-core::favicon` e i tre file statici che `vendor:publish` mette in public/ — e i valori di
 * partenza della configurazione (config/zr-core.php), e il resolver di Vite che scrive i file della build col solo percorso.
 * Il middleware delle intestazioni di sicurezza non lo registra: il suo posto, primo dei globali, lo decide il frontend nel suo
 * bootstrap/app.php.
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
        $this->app->make(Kernel::class)->pushMiddleware(Http\HostFidati::class);
        $this->loadViewsFrom(__DIR__.'/../resources/views', 'zr-core');

        // Gli indirizzi dei file della build: senza `ASSET_URL` Laravel li scrive con la radice della richiesta (l'header
        // `Host`, o `X-Forwarded-Host` se il frontend si fida dei proxy), e chi manda un host suo lo ritrova nel documento.
        // Qui `@vite` scrive il solo percorso; con `ASSET_URL` l'indirizzo resta intero, perché non viene dalla richiesta. Un
        // resolver che il frontend registra nel `boot()` del suo provider parte dopo, e vince; nel `register()` no: questo lo
        // sovrascrive. E guarda `ASSET_URL` com'è nella configurazione: un'origine data a tempo d'esecuzione non la vede.
        Vite::createAssetPathsUsing(fn (string $path, ?bool $secure = null): string => filled(config('app.asset_url')) ? asset($path, $secure) : '/'.ltrim($path, '/'));

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
