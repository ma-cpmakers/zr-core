<?php

namespace Zeiras\Core\Http;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\Response as RispostaDiLaravel;
use Illuminate\Support\Facades\Vite;
use Symfony\Component\HttpFoundation\Response;

/**
 * Il precarico dei file d'ingresso: la risposta intera di una pagina dice in `Link` i file che `@vite` ha messo nel documento
 * (`Vite::preloadedAssets()`: l'ingresso, i pezzi che importa staticamente, i CSS; non i pezzi dinamici). Cloudflare, con Early
 * Hints acceso sulla zona, li ripete in un 103 alla visita dopo, prima che il server abbia letto il backoffice: il JS scende
 * mentre arrivano i dati.
 *
 * zr-core non lo registra da sé: lo registra il frontend, sul gruppo `web` o sulle sole rotte che vuole. Non c'è niente da
 * configurare: le rotte le dice dove è agganciato, i file li dice `@vite`, e il manifest non si legge.
 *
 * Cloudflare in un 103 ripete solo `preload` e `preconnect`: un modulo va come `preload; as=script; crossorigin`, mai
 * `modulepreload`, e col `crossorigin` (la richiesta di un modulo è CORS: senza, il browser scaricherebbe il file due volte).
 *
 * Il `Link` dipende solo dalla build: è uguale per tutti e ripete ciò che il documento dice già, senza dati, id o lingua della
 * persona. Rischio accettato: il 103 che Cloudflare manda prima dell'origine dice, a chi conosce già un indirizzo, che è stato
 * aperto di recente.
 */
final class PrecaricoDegliIngressi
{
    /** @param  Closure(Request): Response  $next */
    public function handle(Request $richiesta, Closure $next): Response
    {
        $risposta = $next($richiesta);

        if (! $this->eUnaPaginaIntera($richiesta, $risposta)) {
            return $risposta;
        }

        // Solo CSS e moduli: un altro precarico di Vite (un font, `as="font"`) non si spaccia per script.
        $voci = [];
        foreach (Vite::preloadedAssets() as $url => $attributi) {
            if (in_array('as="style"', $attributi, true)) {
                $voci[] = '<'.$url.'>; rel=preload; as=style';
            } elseif (in_array('as="script"', $attributi, true)) {
                $voci[] = '<'.$url.'>; rel=preload; as=script';
            }
        }
        // Un `Link` che la risposta porta già resta: questo gli si aggiunge accanto.
        if ($voci !== []) {
            $risposta->headers->set('Link', implode(', ', $voci), false);
        }

        return $risposta;
    }

    /**
     * Una risposta `200` che è un documento HTML, a una richiesta che non è una visita Inertia. Non un redirect né una pagina
     * d'esito, anche se il loro documento ha `@vite`; non un JSON, un file o uno stream; non una risposta che dichiara un altro
     * tipo, anche se nella stessa richiesta `@vite` ha scritto dei file.
     */
    private function eUnaPaginaIntera(Request $richiesta, Response $risposta): bool
    {
        if (! $risposta instanceof RispostaDiLaravel || $risposta->getStatusCode() !== 200 || $richiesta->headers->has('X-Inertia')) {
            return false;
        }
        // Senza un tipo dichiarato la risposta è HTML: è ciò che Symfony scrive quando la prepara.
        $tipo = $risposta->headers->get('Content-Type');

        return $tipo === null || str_starts_with(strtolower(ltrim($tipo)), 'text/html');
    }
}
