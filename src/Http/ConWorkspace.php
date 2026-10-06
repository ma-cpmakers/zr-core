<?php

namespace Zeiras\Core\Http;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Zeiras\Auth\Sessione;

/**
 * Le rotte della cornice valgono nel workspace in cui la persona è entrata: con la sessione ma senza workspace (prima della
 * scelta) rispondono 403 senza chiamare il backoffice. Gira dopo la guardia di zr-auth, che senza sessione risponde 401.
 */
final class ConWorkspace
{
    public function handle(Request $richiesta, Closure $next): Response
    {
        if (Sessione::workspace() === null) {
            return new JsonResponse(['errore' => 'gettone_senza_workspace'], 403);
        }

        return $next($richiesta);
    }
}
