<?php

namespace Zeiras\Core\Http;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Zeiras\Auth\Sessione;

/**
 * Le rotte della cornice valgono nel workspace in cui la persona è entrata: con la sessione ma senza workspace (prima della
 * scelta) rispondono 403 senza chiamare il backoffice. Gira dopo la guardia di zr-auth, che senza sessione risponde 401, e
 * prima della regola della persona (`StessaPersona`): dalla `v2.10.0` il 403 dice di chi è la sessione (`persona`, la sua
 * email e niente altro, come il 409 `persona_diversa`), e una scheda rimasta ferma di un'altra persona si ricarica. Di chi è
 * lo dice sempre e solo la sessione, mai la richiesta.
 */
final class ConWorkspace
{
    public function handle(Request $richiesta, Closure $next): Response
    {
        if (Sessione::workspace() === null) {
            return new JsonResponse(['errore' => 'gettone_senza_workspace', 'persona' => Sessione::utente()['email'] ?? null], 403);
        }

        return $next($richiesta);
    }
}
