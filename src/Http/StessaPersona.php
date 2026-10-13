<?php

namespace Zeiras\Core\Http;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Zeiras\Auth\Sessione;

/**
 * Le rotte della cornice rispondono a chi è nella sessione, e una pagina rimasta ferma può mostrare ancora chi c'era prima: la
 * sessione è passata a un'altra persona da un'altra scheda. La richiesta dice di chi è la pagina che chiede — nell'intestazione
 * `Persona`, l'email passata da `encodeURIComponent`, o in `persona` nel corpo JSON (così la manda «Segna tutte come lette»
 * della `v2.5.0`) — e qui si confronta con l'email della sessione, prima di ogni controllo della rotta e senza chiamare il
 * backoffice: se non è quella, 409 `persona_diversa` con l'email della sessione e nient'altro. Detta in tutti e due i posti,
 * valgono tutti e due. Una persona detta che non si può confrontare — non un testo, anche `null`, o un testo vuoto — è un 422:
 * non vale come non detta. Una richiesta che non la dice (un JS di prima rimasto in una scheda) passa com'è.
 *
 * Ciò che la richiesta dice si confronta e basta: di chi sono i dati lo dice sempre e solo la sessione. Gira dopo la guardia
 * di zr-auth (401) e dopo ConWorkspace (403).
 */
final class StessaPersona
{
    /** L'intestazione con cui la cornice dice di chi è la pagina. */
    public const INTESTAZIONE = 'Persona';

    public function handle(Request $richiesta, Closure $next): Response
    {
        $dette = array_map(
            fn (?string $valore): ?string => $valore === null ? null : rawurldecode($valore),
            $richiesta->headers->all(self::INTESTAZIONE),
        );

        // Che il corpo la dica lo decide la chiave, non il valore: `null` è detta.
        if ($richiesta->json()->has('persona')) {
            $dette[] = $richiesta->json('persona');
        }

        foreach ($dette as $detta) {
            if (! is_string($detta) || $detta === '') {
                return new JsonResponse(['errore' => 'dati_non_validi'], 422);
            }
        }

        $persona = Sessione::utente()['email'] ?? null;

        foreach ($dette as $detta) {
            if ($detta !== $persona) {
                return new JsonResponse(['errore' => 'persona_diversa', 'persona' => $persona], 409);
            }
        }

        return $next($richiesta);
    }
}
