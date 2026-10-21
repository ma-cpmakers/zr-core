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
 * con l'email giusta. Si confronta solo quando la sessione ne ha una (non senza id), e ogni parte detta deve essere quella. Dalla
 * `v2.21.0` una richiesta che non la dice — senza l'intestazione, o coi testi `undefined` e `null` di un JS con dati che non la
 * portano — è lo stesso 409, come per `SoloDallaPersona` di zr-auth (fino alla `v2.20` decideva l'email).
 * Dalla `v2.21.1` una sessione con un id che non dà un'impronta — vuoto, o non un testo — è una persona sconosciuta: ogni
 * richiesta riceve il 409. Senza id (assente o `null`) non si confronta niente, come prima.
 *
 * Dalla `v2.23.0` l'impronta decide chi è la persona della pagina: se la sessione ne ha una e la richiesta dice quella, l'email che
 * porta può essere anche quella di prima (la persona l'ha cambiata da un'altra scheda, zr-home #2214) e la richiesta passa; con
 * un'altra impronta, o senza, è il 409 di sempre, qualunque email dica. L'email decide dove l'impronta non c'è — la sessione
 * senza id — e dove la sessione non ha un'email da confrontare.
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

        // Dalla `v2.20.0` anche l'impronta di zr-auth, quando la sessione ne ha una. Si legge come la legge SoloDallaPersona — ogni
        // intestazione, ogni parte fra le virgole —, e ogni parte detta deve essere quella della sessione. Dalla `v2.21.0` anche una
        // richiesta che non la dice è un'altra persona, come per SoloDallaPersona: senza l'intestazione, o coi testi `undefined` e
        // `null` che il JS manda con dati che non la portano (fino alla `v2.20` decideva l'email).
        $impronta = Persona::impronta();
        // Dalla `v2.21.1` un id che non dà un'impronta — vuoto, o non un testo — è una persona sconosciuta, e la richiesta
        // riceve lo stesso 409: solo la sessione senza id (assente o `null`) resta senza confronto.
        if ($impronta === null && (Sessione::utente()['id'] ?? null) !== null) {
            return self::diversa();
        }
        if ($impronta !== null) {
            $improntaDetta = $richiesta->headers->all(Persona::INTESTAZIONE);
            if ($improntaDetta === []) {
                return self::diversa();
            }
            foreach ($improntaDetta as $valore) {
                foreach (explode(',', (string) $valore) as $detta) {
                    if (! hash_equals($impronta, trim($detta))) {
                        return self::diversa();
                    }
                }
            }
        }

        // Dalla `v2.23.0` l'impronta giusta dice che la pagina è della persona della sessione, anche se l'email che porta è quella
        // di prima (la persona l'ha cambiata da un'altra scheda): l'email decide solo dove l'impronta non c'è, la sessione senza id,
        // o dove la sessione non ha un'email da confrontare (e allora nessuna email detta è la sua).
        if ($impronta === null || ! is_string($persona) || $persona === '') {
            foreach ($dette as $detta) {
                if ($detta !== $persona) {
                    return self::diversa();
                }
            }
        }

        return $next($richiesta);
    }

    private static function diversa(): JsonResponse
    {
        return new JsonResponse(['errore' => 'persona_diversa', 'persona' => ''], 409);
    }
}
