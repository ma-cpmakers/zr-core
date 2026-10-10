<?php

namespace Zeiras\Core\Tests;

use Illuminate\Support\Facades\Http;
use Orchestra\Testbench\TestCase as Testbench;
use Zeiras\Auth\Sessione;
use Zeiras\Auth\ZrAuthServiceProvider;
use Zeiras\Core\Cornice;
use Zeiras\Core\ZrCoreServiceProvider;

/** Un frontend finto: zr-core installato in un'app Laravel, con zr-auth. Il backoffice non c'è: nessuna richiesta esce. */
abstract class TestCase extends Testbench
{
    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
    }

    protected function getPackageProviders($app): array
    {
        return [ZrAuthServiceProvider::class, ZrCoreServiceProvider::class];
    }

    protected function defineEnvironment($app): void
    {
        // La sessione lato server, come nel frontend: zr-auth non scrive il gettone in un cookie. La chiave dei cookie
        // nasce nel test: nessuna nel repo.
        $app['config']->set('app.key', 'base64:'.base64_encode(random_bytes(32)));
        $app['config']->set('session.driver', 'array');
    }

    /**
     * Due pagine del frontend nel gruppo `web` (con la guardia di zr-auth): una dà i dati della cornice; l'altra la persona
     * della sessione senza chiamare la cornice, come una pagina che ne prende la lingua in un middleware.
     */
    protected function defineWebRoutes($router): void
    {
        $router->get('w/{slug}/cornice', fn () => Cornice::dati());
        $router->get('w/{slug}/sessione', fn () => Sessione::utente());
    }
}
