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
 * dalla `v2.12.0` dopo la regola della persona (`StessaPersona`): una scheda rimasta ferma di un'altra persona riceve il suo
 * 409 e si ricarica, e il 403 arriva solo alla persona della sessione, o a una richiesta che non la dice. Per questo non dice
 * di chi è la sessione: niente email (nella `v2.10` e nella `v2.11` c'era, `persona`).
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
