<?php

namespace Zeiras\Core\Http;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\Response as RispostaDiLaravel;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Exception\SuspiciousOperationException;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Gli host fidati di un frontend di Zeiras: uno, quello di `app.url` (`APP_URL`). Una richiesta per un altro nome — un
 * sottodominio, l'indirizzo IP del server, un nome inventato — prende `400` e non arriva alle rotte: l'app non scrive mai un
 * suo indirizzo (un rimando, un collegamento in una mail) con un host deciso da chi chiama. È la seconda difesa: la prima è
 * il server, che per un altro nome non dovrebbe nemmeno rispondere.
 *
 * Un frontend lo registra in coda ai middleware globali, nel suo bootstrap/app.php (`$middleware->append(HostFidati::class)`):
 * dopo i proxy fidati di Laravel, perché l'host che conta è quello che l'app userebbe (`Request::getHost()`: l'intestazione
 * `Host`, o `X-Forwarded-Host` se chi chiama è un proxy fidato dal modulo), e dentro IntestazioniSicurezza, perché anche il
 * rifiuto esca con le intestazioni. zr-core non lo registra da sé.
 *
 * Il confronto è un'uguaglianza fra due nomi interi, in minuscolo e senza porta. Non c'è niente da configurare e nessun
 * ambiente in cui tace: vale anche in locale e nei test, dove `APP_URL` dev'essere il nome con cui si chiama l'app.
 * `TrustHosts` di Laravel non è lo stesso: di suo ammette anche i sottodomini, e in locale e nei test non fa niente.
 *
 * Del rifiuto la richiesta non rivede niente di suo: il corpo è fisso, e il log dice l'host atteso, mai quello ricevuto.
 */
final class HostFidati
{
    /** Il corpo del rifiuto: fisso, e uguale in ogni lingua. */
    private const RIFIUTO = 'Bad Request';

    /** @param  Closure(Request): Response  $next */
    public function handle(Request $richiesta, Closure $next): Response
    {
        $atteso = self::atteso();
        if ($atteso === null) {
            // Senza un host da confrontare rifiutare tutto spegnerebbe il modulo: passa tutto, e il log lo dice finché
            // `APP_URL` non è corretto.
            self::avvisa('HostFidati: APP_URL non ha un host, nessuna richiesta è rifiutata. Va scritto per intero, con lo schema: https://nome.del.modulo');

            return $next($richiesta);
        }

        try {
            $ricevuto = strtolower($richiesta->getHost());
        } catch (SuspiciousOperationException) {
            // Un host con caratteri che un nome non ha: non è quello del modulo.
            $ricevuto = null;
        }

        if ($ricevuto === $atteso) {
            return $next($richiesta);
        }

        self::avvisa("HostFidati: rifiutata con 400 una richiesta per un host che non è quello del modulo ({$atteso})");

        return new RispostaDiLaravel(self::RIFIUTO, 400, ['Content-Type' => 'text/plain; charset=UTF-8']);
    }

    /** L'host di `app.url`, in minuscolo; `null` se non c'è o non si legge. */
    private static function atteso(): ?string
    {
        $indirizzo = config('app.url');
        if (! is_string($indirizzo)) {
            return null;
        }
        $host = parse_url($indirizzo, PHP_URL_HOST);

        return is_string($host) && $host !== '' ? strtolower($host) : null;
    }

    private static function avvisa(string $riga): void
    {
        try {
            Log::warning($riga);
        } catch (Throwable) {
            // Un log che non scrive non ferma la risposta.
        }
    }
}
