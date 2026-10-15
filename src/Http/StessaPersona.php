<?php

namespace Zeiras\Core\Http;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Zeiras\Auth\Persona;
use Zeiras\Auth\Sessione;

/**
 * Le rotte della cornice rispondono a chi è nella sessione, e una pagina rimasta ferma può mostrare ancora chi c'era prima: la
 * sessione è passata a un'altra persona da un'altra scheda. La richiesta dice di chi è la pagina che chiede — nell'intestazione
 * `Persona`, l'email passata da `encodeURIComponent`, o in `persona` nel corpo JSON (così la manda «Segna tutte come lette»
 * della `v2.5.0`) — e qui si confronta con l'email della sessione, prima di ogni controllo della rotta e senza chiamare il
 * backoffice: se non è quella, 409 `persona_diversa` con `persona` vuota e nient'altro — dalla `v2.12.0` non c'è più l'email
 * della sessione: il JS di una scheda che non è più di chi è nella sessione non sa chi è entrato. Il testo vuoto non è
 * l'email di nessuno, e per la cornice dice «un'altra persona», come prima l'email. Detta in tutti e due i posti,
 * valgono tutti e due. Una persona detta che non si può confrontare — non un testo, anche `null`, o un testo vuoto — è un 422:
 * non vale come non detta. Una richiesta che non la dice (un JS di prima della `v2.6.0` rimasto in una scheda) non sa di chi è
 * la pagina che chiede: dalla `v2.13.0` è un 422 `persona_mancante` con `persona` vuota, e non arriva alla rotta. La `persona`
 * vuota è per quel JS: quello della `v2.5.x`, davanti all'elenco, alla ricerca o al clic su una notifica, la prende per
 * «un'altra persona» e ricarica la scheda, che dopo ha il JS del frontend di adesso. Un'intestazione con un altro nome o la query non la dicono.
 *
 * Un'email può passare da un account a un altro: dalla `v2.20.0` la cornice manda anche l'impronta di zr-auth della persona dei
 * suoi dati (`X-Zr-Persona`, `Persona::impronta()`), e un'impronta detta che non è quella della sessione è lo stesso 409, anche
 * con l'email giusta. Si confronta solo quando la sessione ne ha una (non senza id) e il testo ne ha la forma, 32 cifre
 * esadecimali: senza, o con il testo `undefined` di un JS coi dati di prima, decide l'email come fino alla `v2.19`.
 *
 * Ciò che la richiesta dice si confronta e basta: di chi sono i dati lo dice sempre e solo la sessione. Gira dopo la guardia
 * di zr-auth (401) e, dalla `v2.12.0`, prima di ConWorkspace (403): senza workspace una scheda di un'altra persona riceve il
 * 409, e il 403 resta della persona della sessione.
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

        if ($dette === []) {
            return new JsonResponse(['errore' => 'persona_mancante', 'persona' => ''], 422);
        }

        foreach ($dette as $detta) {
            if (! is_string($detta) || $detta === '') {
                return new JsonResponse(['errore' => 'dati_non_validi'], 422);
            }
        }

        $persona = Sessione::utente()['email'] ?? null;

        foreach ($dette as $detta) {
            if ($detta !== $persona) {
                return self::diversa();
            }
        }

        // Dalla `v2.20.0` anche l'impronta di zr-auth, quando la richiesta ne dice una e la sessione ne ha una: con la stessa
        // email, l'impronta di un altro account è un'altra persona. Un testo che non ne ha la forma — `undefined`, il JS con dati
        // di prima — non è un'impronta detta, e decide l'email come prima.
        $impronta = Persona::impronta();
        foreach ($richiesta->headers->all(Persona::INTESTAZIONE) as $detta) {
            if ($impronta !== null && is_string($detta) && preg_match('/^[0-9a-f]{32}$/', $detta) === 1 && ! hash_equals($impronta, $detta)) {
                return self::diversa();
            }
        }

        return $next($richiesta);
    }

    private static function diversa(): JsonResponse
    {
        return new JsonResponse(['errore' => 'persona_diversa', 'persona' => ''], 409);
    }
}
