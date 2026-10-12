<?php

namespace Zeiras\Core\Http;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\Response as RispostaDiLaravel;
use Illuminate\Support\Facades\Vite;
use Symfony\Component\HttpFoundation\Response;

/**
 * Il precarico dei file d'ingresso: la risposta intera di una pagina dice in `Link` i file che `@vite` ha messo nel documento
 * (`Vite::preloadedAssets()`: l'ingresso, i pezzi che importa staticamente, i CSS; non i pezzi dinamici). Il browser comincia
 * a scaricarli quando arrivano le intestazioni, prima di leggere il documento.
 *
 * zr-core non lo registra da sé: lo registra il frontend, sul gruppo `web` o sulle sole rotte che vuole. Non c'è niente da
 * configurare: le rotte le dice dove è agganciato, i file li dice `@vite`, e il manifest non si legge.
 *
 * Un modulo va come `preload; as=script; crossorigin`, mai `modulepreload`, e col `crossorigin` (la richiesta di un modulo è
 * CORS: senza, il browser scaricherebbe il file due volte): è la sola forma che Cloudflare ripeterebbe in un 103.
 *
 * Il `Link` ripete ciò che il documento dice già, senza dati, id o lingua della persona, e senza un host che venga dalla
 * richiesta (`indirizzoDellaVoce`). È pensato per il solo header: per Zeiras Early Hints su Cloudflare resta spento. Chi lo
 * accende accetta un rischio, e lo decide zr-pm: il 103 che Cloudflare manda prima dell'origine dice, a chi conosce o indovina
 * un indirizzo (lo slug di un workspace è il nome di un'azienda), che la pagina esiste ed è stata aperta da poco. Per questo
 * un modulo con uno slug o un id nel percorso lo registra sulle sole rotte che accetta di esporre.
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
            $indirizzo = $this->indirizzoDellaVoce($richiesta, (string) $url);
            if ($indirizzo === null) {
                continue;
            }
            if (in_array('as="style"', $attributi, true)) {
                $voci[] = '<'.$indirizzo.'>; rel=preload; as=style';
            } elseif (in_array('as="script"', $attributi, true)) {
                $voci[] = '<'.$indirizzo.'>; rel=preload; as=script; crossorigin';
            }
        }
        // Un `Link` che la risposta porta già resta: questo gli si aggiunge accanto.
        if ($voci !== []) {
            $risposta->headers->set('Link', implode(', ', $voci), false);
        }

        return $risposta;
    }

    /**
     * L'indirizzo con cui un file esce nel `Link`, mai con un host che viene dalla richiesta: il solo percorso, com'è scritto
     * col resolver del pacchetto (`ZrCoreServiceProvider`); l'indirizzo intero, se comincia con `ASSET_URL`, che è del
     * frontend e non di chi chiama; e col resolver di Laravel senza `ASSET_URL`, che scrive la radice della richiesta (l'header
     * `Host`, o `X-Forwarded-Host` se il frontend si fida dei proxy), il percorso senza quella radice. Ogni altro indirizzo
     * non esce: null. E non esce un indirizzo con un carattere di controllo, uno spazio, `<`, `>`, `"` o `\`: tolto l'host, quel
     * percorso può portare ancora un valore della richiesta (`X-Forwarded-Prefix`), che con un `>` chiuderebbe l'indirizzo
     * della voce e con una tabulazione, che un browser toglie, diventerebbe un altro host.
     */
    private function indirizzoDellaVoce(Request $richiesta, string $url): ?string
    {
        if (preg_match('~[\x00-\x20\x7f<>"\\\\]~', $url) === 1) {
            return null;
        }
        // Un percorso comincia con una barra sola: `//host` per un browser è un altro host (e `/\host` anche, ma la barra
        // rovescia è già fuori).
        if (preg_match('~^/(?!/)~', $url) === 1) {
            return $url;
        }
        $fissa = rtrim((string) config('app.asset_url'), '/');
        if ($fissa !== '' && str_starts_with($url, $fissa.'/')) {
            return $url;
        }
        if (preg_match('~^https?://'.preg_quote($richiesta->getHost(), '~').'(/.*)$~i', $url, $parti) === 1) {
            return $parti[1];
        }

        return null;
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
