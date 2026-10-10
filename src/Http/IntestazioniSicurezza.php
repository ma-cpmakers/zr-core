<?php

namespace Zeiras\Core\Http;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Le intestazioni di sicurezza dei frontend di Zeiras, su ogni risposta che passa dai middleware di Laravel: solo HTTPS per un
 * anno su questo host, la CSP, la provenienza ridotta all'origine verso gli altri siti, sensori, fotocamera, microfono,
 * posizione, pagamenti e USB spenti, il tipo del contenuto mai indovinato. Un frontend lo registra primo dei middleware
 * globali, nel suo bootstrap/app.php (`$middleware->prepend(IntestazioniSicurezza::class)`): così le hanno anche le risposte
 * d'errore e il 503 della manutenzione. zr-core non lo registra da sé.
 *
 * La CSP è quella di tutti, più ciò che un modulo aggiunge per sempre (`zr-core.csp`) e ciò che una pagina aggiunge per sé (un
 * insieme di `zr-core.csp_pagine`, chiesto per nome con perLaPagina). Un modulo e una pagina aggiungono sorgenti, e solo a sei
 * direttive: non tolgono niente e non toccano le altre. Una sorgente è `'self'` oppure un'origine `https://` scritta per
 * intero. Tutto il resto è scartato, mai aggiustato: il ramo sicuro è la CSP più stretta.
 *
 * `frame-src` nella CSP di tutti non c'è: finché nessuno la scrive le cornici seguono `default-src`, e dalla prima sorgente
 * vale solo ciò che è scritto lì — chi incornicia anche la propria origine scrive anche `'self'`. La classe non lo aggiunge
 * da sé: alla CSP di una pagina non aggiunge niente che il modulo non abbia dichiarato.
 *
 * Una CSP che la risposta porta già non si tocca: resta, e quella del modulo le esce accanto (handle).
 */
final class IntestazioniSicurezza
{
    /** La CSP di tutti: quella di un modulo che non aggiunge niente. */
    public const CSP = "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; img-src 'self'; font-src https://fonts.gstatic.com; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

    /** La Permissions-Policy di tutti: le otto funzioni spente. */
    public const PERMESSI = 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()';

    /** L'ordine delle direttive nell'intestazione: una che la CSP di tutti non ha (`frame-src`) prende il suo posto qui. */
    private const ORDINE = ['default-src', 'script-src', 'style-src', 'img-src', 'font-src', 'connect-src', 'frame-src', 'object-src', 'base-uri', 'form-action', 'frame-ancestors'];

    /** Le sole direttive a cui un modulo o una pagina aggiungono sorgenti. Le altre sono uguali per tutti. */
    private const ESTENDIBILI = ['script-src', 'style-src', 'img-src', 'font-src', 'connect-src', 'frame-src'];

    /** L'attributo della richiesta su cui una pagina scrive il nome del suo insieme di sorgenti (perLaPagina). */
    private const PAGINA = 'zr-core.csp-pagina';

    /** Quanti scarti porta, al più, la riga d'avviso di una risposta: degli altri dice solo quanti sono. */
    private const SCARTI_NELL_AVVISO = 5;

    /**
     * Scrive le cinque intestazioni sulla risposta, qualunque sia. Quattro con `set`: una volta sola, e al posto di ciò che la
     * risposta aveva. La CSP no: quella che la risposta porta già resta, e quella del modulo le esce accanto, dopo — il
     * browser le applica tutte e due, e passa solo ciò che ammettono entrambe. Così una risposta può stringere la CSP del
     * modulo e mai allargarla: Laravel ne mette una con `sandbox` sui file che serve da un disco, e toglierla farebbe girare
     * nell'origine del modulo un file caricato da una persona. È il middleware più esterno, e un suo errore sarebbe un 500
     * senza intestazioni: dopo la risposta non lancia mai. Se la CSP non si compone esce quella di tutti, e le altre quattro
     * escono lo stesso. Ciò che è stato scartato va nel log come avviso, una riga per risposta: una sorgente sbagliata nella
     * configurazione lo scrive finché non la si corregge.
     */
    public function handle(Request $richiesta, Closure $next): Response
    {
        /** @var Response $risposta */
        $risposta = $next($richiesta);

        try {
            [$csp, $scartate] = self::dellaRisposta();
        } catch (Throwable $errore) {
            // Dell'errore solo il nome della classe: il suo messaggio può portare qualunque cosa.
            [$csp, $scartate] = [self::CSP, ['la CSP non si è composta ('.get_debug_type($errore).'): esce quella di tutti']];
        }

        try {
            // Senza includeSubDomains né preload: gli altri indirizzi del dominio non sono di questo servizio.
            $risposta->headers->set('Strict-Transport-Security', 'max-age=31536000');
            $risposta->headers->set('Content-Security-Policy', [...self::giaNellaRisposta($risposta, $csp), $csp]);
            // Una risposta che ne chiede una più stretta la tiene, se è il suo unico valore: il rimando dell'ingresso di zr-auth
            // porta il codice nell'indirizzo, ed è `no-referrer`.
            if ($risposta->headers->all('referrer-policy') !== ['no-referrer']) {
                $risposta->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
            }
            $risposta->headers->set('Permissions-Policy', self::PERMESSI);
            $risposta->headers->set('X-Content-Type-Options', 'nosniff');
        } catch (Throwable) {
            // La risposta esce com'è.
        }

        if ($scartate !== []) {
            try {
                Log::warning(self::avviso($scartate));
            } catch (Throwable) {
                // Un log che non scrive non ferma la risposta; e l'avviso non passa dal gestore delle eccezioni di Laravel, che
                // può lanciare a sua volta.
            }
        }

        return $risposta;
    }

    /**
     * Le CSP che la risposta porta già, e che restano: ogni valore com'è, nel suo ordine. Non restano un valore vuoto, che non
     * è una CSP, e uno uguale a quella del modulo, che esce una volta sola (il middleware passato due volte sulla stessa
     * risposta).
     *
     * @return list<mixed>
     */
    private static function giaNellaRisposta(Response $risposta, string $csp): array
    {
        /** @var list<mixed> $valori Symfony li dice testi, ma non lo impone: un valore di un altro tipo resta com'è, non si perde. */
        $valori = $risposta->headers->all('Content-Security-Policy');

        return array_values(array_filter(
            $valori,
            static fn (mixed $valore): bool => is_string($valore) ? trim($valore) !== '' && $valore !== $csp : $valore !== null,
        ));
    }

    /**
     * La pagina che risponde a questa richiesta chiede, in più, le sorgenti di un insieme che il modulo ha dichiarato in
     * `zr-core.csp_pagine`. Dice solo il nome: le origini stanno nella configurazione, e un nome che lì non c'è non aggiunge
     * niente. Il nome si scrive nel codice, non si prende dalla richiesta. Vale per la risposta a questa richiesta sola, e
     * chiamata due volte vale l'ultimo nome. Il nome sta sulla richiesta del container, non su quella che ha in mano il
     * controller: una FormRequest è una copia, e il middleware non la vedrebbe.
     */
    public static function perLaPagina(string $nome): void
    {
        request()->attributes->set(self::PAGINA, $nome);
    }

    /**
     * La CSP di una risposta: quella di tutti, più ciò che il modulo aggiunge per sempre, più ciò che la pagina aggiunge per
     * sé. Le direttive escono nell'ordine di ORDINE, e una senza sorgenti non esce; dentro una direttiva prima le parole fra
     * apici e poi le origini, ognuna una volta sola e nell'ordine in cui sono dichiarate: tutti, modulo, pagina. Non lancia:
     * ciò che non ha la forma attesa è scartato.
     *
     * @internal un frontend scrive le sue sorgenti nella configurazione: questa funzione la chiama la classe
     *
     * @param  mixed  $delModulo  una mappa direttiva → lista di sorgenti
     * @param  mixed  $dellaPagina  lo stesso, per una pagina sola
     * @return array{0: string, 1: list<string>} la CSP, e ciò che è stato scartato: di chi era, la direttiva, il motivo
     */
    public static function componi(mixed $delModulo = [], mixed $dellaPagina = []): array
    {
        $direttive = [];
        foreach (explode('; ', self::CSP) as $direttiva) {
            $sorgenti = explode(' ', $direttiva);
            $direttive[array_shift($sorgenti)] = $sorgenti;
        }

        $scartate = [];
        foreach (['modulo' => $delModulo, 'pagina' => $dellaPagina] as $diChi => $aggiunte) {
            if (! is_array($aggiunte)) {
                $scartate[] = $diChi.': le aggiunte non sono una mappa di direttive ('.get_debug_type($aggiunte).')';

                continue;
            }
            foreach ($aggiunte as $nome => $sorgenti) {
                $dove = $diChi.', '.self::ritaglio((string) $nome).': ';
                if (! in_array($nome, self::ESTENDIBILI, true)) {
                    $scartate[] = $dove.'a questa direttiva non si aggiungono sorgenti';
                } elseif (! is_array($sorgenti)) {
                    $scartate[] = $dove.'le sorgenti non sono una lista ('.get_debug_type($sorgenti).')';
                } else {
                    foreach ($sorgenti as $sorgente) {
                        if (! is_string($sorgente)) {
                            $scartate[] = $dove.'una sorgente non è un testo ('.get_debug_type($sorgente).')';
                        } elseif (! self::ammessa($sorgente)) {
                            $scartate[] = $dove.'sorgente non ammessa «'.self::ritaglio($sorgente).'»';
                        } else {
                            $direttive[$nome][] = $sorgente;
                        }
                    }
                }
            }
        }

        $pezzi = [];
        foreach (self::ORDINE as $nome) {
            $sorgenti = array_values(array_unique($direttive[$nome] ?? []));
            if ($sorgenti === []) {
                continue;
            }
            $fraApici = array_filter($sorgenti, fn (string $sorgente) => $sorgente[0] === "'");
            $pezzi[] = $nome.' '.implode(' ', [...$fraApici, ...array_diff($sorgenti, $fraApici)]);
        }

        return [implode('; ', $pezzi), $scartate];
    }

    /**
     * La CSP della risposta a questa richiesta, da ciò che il modulo ha scritto nella configurazione e dal nome che la pagina
     * ha dato, se l'ha dato. Una chiave che manca vale come vuota (una configurazione messa in cache prima di questa
     * versione). Un insieme che non è una mappa, un nome che non è un testo o che il modulo non ha dichiarato non aggiungono
     * niente e tornano fra gli scarti: senza il nome, che può essere arrivato dalla richiesta.
     *
     * @return array{0: string, 1: list<string>} la CSP, e ciò che è stato scartato
     */
    private static function dellaRisposta(): array
    {
        $pagine = config('zr-core.csp_pagine', []);
        $nome = request()->attributes->get(self::PAGINA);
        $dellaPagina = [];
        $scartate = [];

        if (! is_array($pagine)) {
            $scartate[] = 'pagine: zr-core.csp_pagine non è una mappa di insiemi ('.get_debug_type($pagine).')';
        } elseif ($nome !== null && ! is_string($nome)) {
            $scartate[] = 'pagina: il nome dell\'insieme non è un testo ('.get_debug_type($nome).')';
        } elseif ($nome !== null && ! array_key_exists($nome, $pagine)) {
            $scartate[] = 'pagina: il nome chiesto non è fra gli insiemi di zr-core.csp_pagine';
        } elseif ($nome !== null) {
            $dellaPagina = $pagine[$nome];
        }

        [$csp, $dallaComposizione] = self::componi(config('zr-core.csp', []), $dellaPagina);

        return [$csp, [...$dallaComposizione, ...$scartate]];
    }

    /**
     * La riga d'avviso di una risposta: quanti scarti, e i primi. Ogni scarto sta su una riga, e viene dalla configurazione o
     * dal codice, mai dalla richiesta.
     *
     * @param  list<string>  $scartate
     */
    private static function avviso(array $scartate): string
    {
        $altri = count($scartate) - self::SCARTI_NELL_AVVISO;

        return 'zr-core, intestazioni di sicurezza: scartato dalla CSP ('.count($scartate).') — '
            .implode(' · ', array_slice($scartate, 0, self::SCARTI_NELL_AVVISO))
            .($altri > 0 ? ' · e altri '.$altri : '');
    }

    /**
     * Una sorgente che un modulo o una pagina possono aggiungere: `'self'`, o un'origine https scritta per intero — un nome
     * di dominio in minuscolo con almeno un punto e, se c'è, una porta fra 1 e 65535 senza zeri davanti. Non un indirizzo IP
     * (l'ultima etichetta è di sole lettere), non punycode (`xn--`); etichette di 63 caratteri al più, 253 in tutto. Niente
     * schemi interi, jolly, percorsi, altre parole fra apici: vale solo ciò che è scritto esattamente così.
     */
    private static function ammessa(string $sorgente): bool
    {
        if ($sorgente === "'self'") {
            return true;
        }
        // 270 byte: lo schema, i 253 del nome e la porta. Una sorgente più lunga non arriva all'espressione regolare.
        if (strlen($sorgente) > 270
            || preg_match('~\Ahttps://((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})(?::([1-9][0-9]{0,4}))?\z~', $sorgente, $pezzi) !== 1) {
            return false;
        }

        return strlen($pezzi[1]) <= 253
            && ! str_contains('.'.$pezzi[1], '.xn--')
            && (! isset($pezzi[2]) || (int) $pezzi[2] <= 65535);
    }

    /** Un pezzo di un valore scartato, per l'avviso: 60 byte al più, e solo caratteri ASCII che si stampano (mai un a capo). */
    private static function ritaglio(string $testo): string
    {
        return preg_replace('/[^\x20-\x7E]/', '?', substr($testo, 0, 60)).(strlen($testo) > 60 ? '…' : '');
    }
}
