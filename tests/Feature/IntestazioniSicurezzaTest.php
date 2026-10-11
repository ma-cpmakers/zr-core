<?php

use Illuminate\Config\Repository;
use Illuminate\Contracts\Http\Kernel as HttpKernel;
use Illuminate\Filesystem\ServeFile;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Monolog\Handler\AbstractProcessingHandler;
use Monolog\Handler\TestHandler;
use Monolog\Level;
use Monolog\LogRecord;
use Zeiras\Auth\Ingresso;
use Zeiras\Core\Http\IntestazioniSicurezza;

// Sprint 16 · T1 (voce #1472). La CSP di un frontend di Zeiras composta da tre strati: quella di tutti, ciò che un modulo
// aggiunge per sempre, ciò che una pagina aggiunge per sé. Le tre CSP di riferimento — quelle che zr-board e zr-home
// rispondono in produzione il 10/10/2026 — stanno scritte qui per intero: una modifica della classe che ne sposta un byte è
// rossa. Sono funzioni pure: nessuna richiesta, nessuna configurazione.

/** La CSP di tutti, quella di un modulo che non aggiunge niente: oggi zr-board (236 byte). */
const CSP_DI_TUTTI = "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; img-src 'self'; font-src https://fonts.gstatic.com; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

/** Quella di un modulo che serve anche font suoi: oggi zr-home (243 byte). */
const CSP_DI_HOME = "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; img-src 'self'; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

/** La stessa, su una pagina con uno script e un riquadro di un'altra origine: oggi le pagine di zr-home con Turnstile (322 byte). */
const CSP_DI_HOME_CON_TURNSTILE = "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' https://fonts.googleapis.com; img-src 'self'; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

/** Ciò che zr-home scrive nel suo `config/zr-core.php`: i font per sempre, Turnstile per le pagine che lo chiedono. */
const AGGIUNTE_DI_HOME = ['font-src' => ["'self'"]];
const AGGIUNTE_DI_TURNSTILE = ['script-src' => ['https://challenges.cloudflare.com'], 'frame-src' => ['https://challenges.cloudflare.com']];

/**
 * Ciò che un modulo o una pagina NON possono aggiungere: ogni riga, da sola, è scartata e lascia la CSP com'è. Sono le 55
 * righe con cui la forma è stata provata prima di scriverla, così come sono.
 *
 * @return array<string, array{0: mixed, 1: mixed}> direttiva e sorgente, sotto un nome che nel log si legge
 */
function aggiunteNonAmmesse(): array
{
    $righe = [
        ['script-src', "'unsafe-inline'"], ['script-src', "'unsafe-eval'"], ['style-src', "'unsafe-inline'"], ['script-src', "'unsafe-hashes'"],
        ['script-src', "'strict-dynamic'"], ['script-src', "'nonce-abc'"], ['script-src', "'none'"],
        ['script-src', 'https:'], ['script-src', 'http:'], ['img-src', 'data:'], ['img-src', 'blob:'], ['script-src', '*'],
        ['script-src', 'https://*.example.com'], ['script-src', 'http://example.com'], ['connect-src', 'wss://example.com'],
        ['script-src', 'https://example.com/percorso'], ['script-src', 'https://example.com/'], ['script-src', 'HTTPS://EXAMPLE.COM'],
        ['script-src', 'https://utente@example.com'], ['script-src', 'https://localhost'], ['script-src', 'example.com'],
        ['script-src', 'https://a.example.com; script-src *'], ['script-src', 'https://a.example.com, default-src *'],
        ['script-src', "https://a.example.com\n"], ['script-src', "https://a.example.com\r\nX-Altro: 1"], ['script-src', 'https://a.example.com *'],
        ['script-src', ''], ['script-src', 7], ['script-src', null], ['script-src', ['https://a.example.com']],
        ['default-src', 'https://example.com'], ['object-src', "'self'"], ['base-uri', 'https://example.com'],
        ['form-action', 'https://example.com'], ['frame-ancestors', 'https://example.com'], ['frame-ancestors', "'self'"],
        ['worker-src', 'https://example.com'], ['script-src-elem', 'https://example.com'], ['report-uri', 'https://example.com'],
        ['sandbox', "'self'"], ['upgrade-insecure-requests', "'self'"], ['', 'https://example.com'], ['script-src; default-src', 'https://example.com'],
        // Indirizzi IP, porte che non esistono, punycode, nomi smisurati.
        ['script-src', 'https://127.0.0.1'], ['script-src', 'https://10.0.0.5'], ['connect-src', 'https://169.254.169.254'],
        ['script-src', 'https://example.com:99999'], ['script-src', 'https://example.com:0'], ['script-src', 'https://xn--80ak6aa92e.com'],
        ['script-src', 'https://www.xn--80ak6aa92e.com'], ['script-src', 'https://'.str_repeat('a', 70000).'.com'],
        ['script-src', 'https://'.str_repeat('a', 64).'.com'], ['script-src', 'https://-a.example.com'], ['script-src', 'https://a..example.com'],
        ['script-src', "https://a.example.com\0"],
    ];
    $conNome = [];
    foreach ($righe as $numero => [$direttiva, $sorgente]) {
        $conNome[sprintf('%02d · %s · %s', $numero + 1, $direttiva, substr((string) json_encode($sorgente, JSON_UNESCAPED_SLASHES), 0, 48))] = [$direttiva, $sorgente];
    }

    return $conNome;
}

/** La CSP di tutti con un pezzo cambiato: il pezzo c'è una volta sola, o l'attesa sarebbe la CSP di prima. */
function cspDiTuttiCon(string $prima, string $dopo): string
{
    expect(substr_count(CSP_DI_TUTTI, $prima))->toBe(1);

    return str_replace($prima, $dopo, CSP_DI_TUTTI);
}

it('compone byte per byte le tre CSP che i frontend rispondono oggi: prima le parole fra apici e poi le origini, `frame-src` fra `connect-src` e `object-src`, nessuna direttiva vuota e nessun «;» in fondo (sprint 16 · T1.1)', function (mixed $delModulo, mixed $dellaPagina, string $attesa, int $byte) {
    expect(strlen($attesa))->toBe($byte)
        ->and(IntestazioniSicurezza::componi($delModulo, $dellaPagina))->toBe([$attesa, []]);
})->with([
    'di tutti (zr-board)' => [[], [], CSP_DI_TUTTI, 236],
    'di zr-home' => [AGGIUNTE_DI_HOME, [], CSP_DI_HOME, 243],
    'di zr-home con Turnstile' => [AGGIUNTE_DI_HOME, AGGIUNTE_DI_TURNSTILE, CSP_DI_HOME_CON_TURNSTILE, 322],
    'una direttiva aperta senza sorgenti non esce' => [['frame-src' => []], ['frame-src' => []], CSP_DI_TUTTI, 236],
]);

it('la costante pubblica è la CSP di tutti, quella che esce senza aggiunte; la Permissions-Policy di tutti spegne le otto funzioni (sprint 16 · T1.1)', function () {
    expect(IntestazioniSicurezza::CSP)->toBe(CSP_DI_TUTTI)
        ->and(IntestazioniSicurezza::componi())->toBe([CSP_DI_TUTTI, []])
        ->and(IntestazioniSicurezza::PERMESSI)->toBe('accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()');
});

// Sprint 16 · review, R1: `frame-src` è l'unica delle sei direttive che la CSP di tutti non ha. Nasce con la prima sorgente, e con
// quelle sole: la classe non ci mette `'self'` da sé (la CSP di una pagina è quella dichiarata, carattere per carattere), e chi
// incornicia anche la propria origine lo scrive.
it('frame-src nasce con le sole sorgenti scritte: senza \'self\' non lo porta, e chi lo scrive lo ha, prima delle origini; nella CSP di tutti la direttiva non c\'è (sprint 16 · review, R1)', function (string $diChi) {
    $componi = fn (array $aggiunte) => $diChi === 'modulo' ? IntestazioniSicurezza::componi($aggiunte) : IntestazioniSicurezza::componi([], $aggiunte);
    [$senza, $scartateSenza] = $componi(['frame-src' => ['https://challenges.cloudflare.com']]);
    [$con, $scartateCon] = $componi(['frame-src' => ['https://challenges.cloudflare.com', "'self'"]]);
    $diTutti = "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; img-src 'self'; font-src https://fonts.gstatic.com; connect-src 'self'; ";
    $coda = "; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

    expect(str_contains(IntestazioniSicurezza::CSP, 'frame-src'))->toBe(false)
        ->and($senza)->toBe($diTutti.'frame-src https://challenges.cloudflare.com'.$coda)
        ->and($con)->toBe($diTutti."frame-src 'self' https://challenges.cloudflare.com".$coda)
        ->and($scartateSenza)->toBe([])
        ->and($scartateCon)->toBe([]);
})->with(['modulo', 'pagina']);

it('le aggiunte non ammesse provate sono 55, ognuna col suo nome (sprint 16 · T1.2)', function () {
    expect(aggiunteNonAmmesse())->toHaveCount(55);
});

it('una sorgente non ammessa, data dal modulo o dalla pagina, non entra nella CSP e torna fra gli scarti (sprint 16 · T1.2)', function (mixed $direttiva, mixed $sorgente) {
    [$csp, $scartate] = IntestazioniSicurezza::componi([$direttiva => [$sorgente]]);
    expect($csp)->toBe(CSP_DI_TUTTI)->and($scartate)->toHaveCount(1);

    [$csp, $scartate] = IntestazioniSicurezza::componi([], [$direttiva => [$sorgente]]);
    expect($csp)->toBe(CSP_DI_TUTTI)->and($scartate)->toHaveCount(1);

    // E non porta via ciò che il modulo aveva aggiunto bene.
    [$csp, $scartate] = IntestazioniSicurezza::componi(AGGIUNTE_DI_HOME, [$direttiva => [$sorgente]]);
    expect($csp)->toBe(CSP_DI_HOME)->and($scartate)->toHaveCount(1);
})->with(aggiunteNonAmmesse());

it('non entrano nemmeno: un jolly senza schema, un indirizzo IP, uno spazio o un punto ai bordi, una parola fra apici scritta diversa (sprint 16 · T1.2)', function (string $sorgente) {
    [$csp, $scartate] = IntestazioniSicurezza::componi(['img-src' => [$sorgente]]);
    expect($csp)->toBe(CSP_DI_TUTTI)->and($scartate)->toHaveCount(1);

    [$csp, $scartate] = IntestazioniSicurezza::componi([], ['img-src' => [$sorgente]]);
    expect($csp)->toBe(CSP_DI_TUTTI)->and($scartate)->toHaveCount(1);
})->with([
    'un jolly senza schema' => '*.example.com',
    'un indirizzo IPv4' => 'https://1.2.3.4',
    'un indirizzo IPv4 con la porta' => 'https://1.2.3.4:8443',
    'un indirizzo IPv6' => 'https://[::1]',
    'un nome senza punto' => 'https://example',
    'un dominio di una lettera sola' => 'https://example.c',
    'un punto in fondo' => 'https://a.example.com.',
    'un trattino in fondo a un\'etichetta' => 'https://a-.example.com',
    'uno spazio davanti' => ' https://a.example.com',
    'uno spazio in fondo' => 'https://a.example.com ',
    'una tabulazione in fondo' => "https://a.example.com\t",
    'self senza apici' => 'self',
    'self in maiuscolo' => "'SELF'",
    'self con uno spazio' => "'self' ",
    'due sorgenti in una' => "'self' https://a.example.com",
    'un hash' => "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='",
    'uno schema solo' => 'https://',
    'una lettera non ASCII' => 'https://à.example.com',
]);

it('una direttiva fuori dalle sei a cui si aggiunge non cambia e non compare, nemmeno con una sorgente ammessa; quella accanto, che si può estendere, entra (sprint 16 · T1.3)', function (string $direttiva) {
    foreach (["'self'", 'https://a.example.com'] as $sorgente) {
        [$csp, $scartate] = IntestazioniSicurezza::componi([$direttiva => [$sorgente]]);
        expect($csp)->toBe(CSP_DI_TUTTI)->and($scartate)->toHaveCount(1);

        [$csp, $scartate] = IntestazioniSicurezza::componi([], [$direttiva => [$sorgente]]);
        expect($csp)->toBe(CSP_DI_TUTTI)->and($scartate)->toHaveCount(1);
    }

    [$csp, $scartate] = IntestazioniSicurezza::componi([$direttiva => ['https://a.example.com'], 'img-src' => ['https://a.example.com']]);
    expect($csp)->toBe(cspDiTuttiCon("img-src 'self'", "img-src 'self' https://a.example.com"))->and($scartate)->toHaveCount(1);
})->with(['default-src', 'object-src', 'base-uri', 'form-action', 'frame-ancestors', 'worker-src']);

it('ognuna delle sei direttive che si estendono prende un\'origine ammessa al suo posto, dal modulo e dalla pagina (sprint 16 · T1.3)', function (string $direttiva, string $prima, string $dopo) {
    $attesa = cspDiTuttiCon($prima, $dopo);

    expect(IntestazioniSicurezza::componi([$direttiva => ['https://a.example.com']]))->toBe([$attesa, []])
        ->and(IntestazioniSicurezza::componi([], [$direttiva => ['https://a.example.com']]))->toBe([$attesa, []]);
})->with([
    'script-src' => ['script-src', "script-src 'self'", "script-src 'self' https://a.example.com"],
    'style-src' => ['style-src', "style-src 'self' https://fonts.googleapis.com", "style-src 'self' https://fonts.googleapis.com https://a.example.com"],
    'img-src' => ['img-src', "img-src 'self'", "img-src 'self' https://a.example.com"],
    'font-src' => ['font-src', 'font-src https://fonts.gstatic.com', 'font-src https://fonts.gstatic.com https://a.example.com'],
    'connect-src' => ['connect-src', "connect-src 'self'", "connect-src 'self' https://a.example.com"],
    'frame-src' => ['frame-src', "connect-src 'self'; object-src", "connect-src 'self'; frame-src https://a.example.com; object-src"],
]);

it('un\'origine ammessa entra dopo le parole fra apici e dopo le origini di tutti, nell\'ordine tutti, modulo, pagina, e una volta sola (sprint 16 · T1.4)', function () {
    $conLeApi = "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; img-src 'self'; font-src https://fonts.gstatic.com; connect-src 'self' https://api.example.com https://api.example.com:8443; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

    expect(IntestazioniSicurezza::componi(['connect-src' => ['https://api.example.com']], ['connect-src' => ['https://api.example.com:8443']]))->toBe([$conLeApi, []])
        // Ripetuta nel modulo, fra modulo e pagina, e uguale a una di tutti: una volta sola, e non è uno scarto.
        ->and(IntestazioniSicurezza::componi(
            ['connect-src' => ['https://api.example.com', "'self'", 'https://api.example.com']],
            ['connect-src' => ['https://api.example.com', 'https://api.example.com:8443', "'self'"]],
        ))->toBe([$conLeApi, []])
        // L'ordine è quello in cui sono dichiarate, non l'alfabeto: il modulo (b) prima della pagina (a); `'self'` della
        // pagina passa davanti alle origini, anche a quelle di tutti.
        ->and(IntestazioniSicurezza::componi(
            ['style-src' => ['https://b.example.com'], 'font-src' => ['https://b.example.com']],
            ['style-src' => ['https://a.example.com'], 'font-src' => ['https://a.example.com', "'self'"]],
        ))->toBe(["default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com https://b.example.com https://a.example.com; img-src 'self'; font-src 'self' https://fonts.gstatic.com https://b.example.com https://a.example.com; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'", []]);
});

it('entra un\'origine https scritta per intero: un nome di dominio in minuscolo, con la porta se c\'è (sprint 16 · T1.4)', function (string $origine) {
    $attesa = cspDiTuttiCon("img-src 'self'", "img-src 'self' ".$origine);

    expect(IntestazioniSicurezza::componi(['img-src' => [$origine]]))->toBe([$attesa, []])
        ->and(IntestazioniSicurezza::componi([], ['img-src' => [$origine]]))->toBe([$attesa, []]);
})->with([
    'un dominio' => 'https://example.com',
    'un sottodominio' => 'https://cdn.a.example.com',
    'cifre e trattini' => 'https://a-1.b2.example.com',
    'un\'etichetta che comincia con una cifra' => 'https://1a.example.com',
    'un\'etichetta di 63 caratteri' => 'https://'.str_repeat('a', 63).'.example.com',
    'un nome di 253 caratteri' => 'https://'.str_repeat('a', 63).'.'.str_repeat('b', 63).'.'.str_repeat('c', 63).'.'.str_repeat('d', 57).'.com',
    'un\'etichetta con xn-- non in testa' => 'https://axn--b.example.com',
    'la porta 1' => 'https://a.example.com:1',
    'la porta 8443' => 'https://a.example.com:8443',
    'la porta 65535' => 'https://a.example.com:65535',
]);

it('non entra: una porta che non esiste o scritta con uno zero davanti, un nome con una maiuscola, un nome oltre i 253 caratteri (sprint 16 · T1.4)', function (string $sorgente) {
    [$csp, $scartate] = IntestazioniSicurezza::componi(['img-src' => [$sorgente]]);
    expect($csp)->toBe(CSP_DI_TUTTI)->and($scartate)->toHaveCount(1);

    [$csp, $scartate] = IntestazioniSicurezza::componi([], ['img-src' => [$sorgente]]);
    expect($csp)->toBe(CSP_DI_TUTTI)->and($scartate)->toHaveCount(1);
})->with([
    'la porta 0' => 'https://a.example.com:0',
    'la porta 65536' => 'https://a.example.com:65536',
    'la porta 08443' => 'https://a.example.com:08443',
    'la porta 00' => 'https://a.example.com:00',
    'la porta vuota' => 'https://a.example.com:',
    'la porta con una lettera' => 'https://a.example.com:8443a',
    'una maiuscola nel nome' => 'https://Api.example.com',
    'una maiuscola nel dominio' => 'https://api.example.COM',
    'una maiuscola nello schema' => 'Https://api.example.com',
    'un nome di 254 caratteri' => 'https://'.str_repeat('a', 63).'.'.str_repeat('b', 63).'.'.str_repeat('c', 63).'.'.str_repeat('d', 58).'.com',
]);

it('un valore di forma sbagliata non lancia e non aggiunge niente, e ciò che è scartato torna a chi chiama: di chi era, la direttiva, il motivo (sprint 16 · T1.5)', function (mixed $delModulo, mixed $dellaPagina, array $scartiAttesi) {
    expect(IntestazioniSicurezza::componi($delModulo, $dellaPagina))->toBe([CSP_DI_TUTTI, $scartiAttesi]);
})->with([
    'un testo al posto della mappa del modulo' => ['font-src https://a.example.com', [], ['modulo: le aggiunte non sono una mappa di direttive (string)']],
    'un numero al posto della mappa della pagina' => [[], 7, ['pagina: le aggiunte non sono una mappa di direttive (int)']],
    'null al posto della mappa del modulo' => [null, [], ['modulo: le aggiunte non sono una mappa di direttive (null)']],
    'un oggetto al posto della mappa della pagina' => [[], new ArrayObject(['font-src' => ["'self'"]]), ['pagina: le aggiunte non sono una mappa di direttive (ArrayObject)']],
    'tutte e due le mappe sbagliate' => [true, 'img-src *', ['modulo: le aggiunte non sono una mappa di direttive (bool)', 'pagina: le aggiunte non sono una mappa di direttive (string)']],
    'una direttiva con un testo al posto della lista' => [['font-src' => "'self'"], [], ['modulo, font-src: le sorgenti non sono una lista (string)']],
    'una direttiva con null al posto della lista' => [[], ['img-src' => null], ['pagina, img-src: le sorgenti non sono una lista (null)']],
    'sorgenti che non sono un testo' => [['script-src' => [7, null, true, 1.5, ['https://a.example.com'], new stdClass]], [], [
        'modulo, script-src: una sorgente non è un testo (int)', 'modulo, script-src: una sorgente non è un testo (null)',
        'modulo, script-src: una sorgente non è un testo (bool)', 'modulo, script-src: una sorgente non è un testo (float)',
        'modulo, script-src: una sorgente non è un testo (array)', 'modulo, script-src: una sorgente non è un testo (stdClass)',
    ]],
    'una lista al posto della mappa' => [["'self'", 'https://a.example.com'], [], ['modulo, 0: a questa direttiva non si aggiungono sorgenti', 'modulo, 1: a questa direttiva non si aggiungono sorgenti']],
    'la configurazione intera al posto della mappa' => [['csp' => AGGIUNTE_DI_HOME, 'csp_pagine' => ['turnstile' => AGGIUNTE_DI_TURNSTILE]], [], ['modulo, csp: a questa direttiva non si aggiungono sorgenti', 'modulo, csp_pagine: a questa direttiva non si aggiungono sorgenti']],
    'una sorgente non ammessa: lo scarto la mostra' => [[], ['img-src' => ['https://*.example.com']], ['pagina, img-src: sorgente non ammessa «https://*.example.com»']],
]);

it('uno scarto dice la direttiva e il motivo su una riga corta: mai il valore intero di una sorgente lunga, mai un a capo (sprint 16 · T1.5)', function (mixed $delModulo) {
    [$csp, $scartate] = IntestazioniSicurezza::componi($delModulo);

    expect($csp)->toBe(CSP_DI_TUTTI)->and($scartate)->toHaveCount(1)
        ->and(strlen($scartate[0]))->toBeLessThan(200)
        ->and(preg_match('/[\x00-\x1F\x7F]/', $scartate[0]))->toBe(0);
})->with([
    'una sorgente smisurata' => [['script-src' => ['https://'.str_repeat('a', 70000).'.com']]],
    'una sorgente con un a capo' => [['script-src' => ["https://a.example.com\r\nX-Altro: 1"]]],
    'una sorgente con un byte nullo' => [['script-src' => ["https://a.example.com\0"]]],
    'una direttiva smisurata' => [[str_repeat('script-src', 7000) => ['https://a.example.com']]],
    'una direttiva con un a capo' => [["script-src\ndefault-src" => ['https://a.example.com']]],
    'un testo smisurato al posto della mappa' => [str_repeat("a\n", 35000)],
]);

// Sprint 16 · T2 (voce #1472). La classe è anche il middleware: un frontend lo mette primo dei globali con una riga, e ogni
// risposta di Laravel esce con le cinque intestazioni. Le sorgenti del modulo arrivano da `config/zr-core.php`; una pagina chiede
// le sue per nome. Qui il frontend è quello finto dei test (Testbench), coi middleware globali di un'app Laravel.

/** Le cinque intestazioni che il middleware scrive su ogni risposta, coi valori per intero: ognuna una volta sola. */
const LE_CINQUE_INTESTAZIONI = [
    'Strict-Transport-Security' => ['max-age=31536000'],
    'Content-Security-Policy' => [CSP_DI_TUTTI],
    'Referrer-Policy' => ['strict-origin-when-cross-origin'],
    'Permissions-Policy' => ['accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'],
    'X-Content-Type-Options' => ['nosniff'],
];

/** Una risposta che il middleware non ha toccato: nessuna delle cinque. */
const NESSUNA_INTESTAZIONE = [
    'Strict-Transport-Security' => [],
    'Content-Security-Policy' => [],
    'Referrer-Policy' => [],
    'Permissions-Policy' => [],
    'X-Content-Type-Options' => [],
];

/** La CSP di tutti con Turnstile sulla pagina: quella di un modulo senza aggiunte sue, su una pagina che chiede l'insieme. */
const CSP_DI_TUTTI_CON_TURNSTILE = "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' https://fonts.googleapis.com; img-src 'self'; font-src https://fonts.gstatic.com; connect-src 'self'; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

/** Quella di zr-home con Turnstile e, in più, un'origine per le immagini. */
const CSP_DI_HOME_CON_TURNSTILE_E_IMMAGINI = "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' https://fonts.googleapis.com; img-src 'self' https://cdn.example.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

/** Un registro che non scrive: come un file di log che non si apre. */
final class RegistroCheLancia extends AbstractProcessingHandler
{
    protected function write(LogRecord $record): void
    {
        throw new RuntimeException('il log non scrive');
    }
}

/** Una FormRequest senza regole: Laravel la dà al controller come copia della richiesta. */
final class ModuloDiProva extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [];
    }
}

/**
 * I valori che la risposta porta per ognuna delle cinque intestazioni: una lista vuota se non c'è, due valori se è scritta
 * due volte.
 *
 * @return array<string, list<string|null>>
 */
function intestazioniDiSicurezzaDi(TestResponse $risposta): array
{
    $valori = [];
    foreach (array_keys(LE_CINQUE_INTESTAZIONI) as $nome) {
        $valori[$nome] = $risposta->headers->all($nome);
    }

    return $valori;
}

/** Come fa un frontend in bootstrap/app.php, `$middleware->prepend(IntestazioniSicurezza::class)`: il primo dei globali. */
function primoDeiGlobali(): void
{
    app(HttpKernel::class)->prependMiddleware(IntestazioniSicurezza::class);
}

/**
 * Le rotte del frontend finto, fuori da ogni gruppo: una pagina, una risposta JSON, un rimando, un controller rotto e una
 * pagina che chiede per nome le sorgenti di Turnstile.
 */
function rotteDiProva(): void
{
    // Senza il dettaglio dell'errore: il 500 è la pagina d'errore di Laravel, come in produzione.
    config(['app.debug' => false]);
    Route::get('/prova/pagina', fn () => '<p>una pagina</p>');
    Route::get('/prova/json', fn () => ['esito' => 'ok']);
    Route::get('/prova/rimando', fn () => redirect('/prova/pagina'));
    Route::get('/prova/rotta', fn () => throw new RuntimeException('un controller rotto'));
    Route::get('/prova/registrati', function () {
        IntestazioniSicurezza::perLaPagina('turnstile');

        return 'registrati';
    });
}

/** Ciò che zr-home scrive nel suo config/zr-core.php: i font per sempre, Turnstile per le pagine che lo chiedono. */
function configurazioneDiHome(): void
{
    config(['zr-core.csp' => AGGIUNTE_DI_HOME, 'zr-core.csp_pagine' => ['turnstile' => AGGIUNTE_DI_TURNSTILE]]);
}

/** La manutenzione accesa, come con `php artisan down`: il 503 nasce in un middleware globale, prima delle rotte. */
function inManutenzione(): void
{
    config(['app.maintenance.driver' => 'array']);
    app()->maintenanceMode()->activate(['status' => 503, 'retry' => null, 'refresh' => null, 'secret' => null, 'redirect' => null, 'template' => null, 'except' => []]);
}

/** Il log dell'app in memoria: un canale vero di Laravel, con un registro di Monolog che tiene le righe. */
function logInMemoria(): void
{
    config(['logging.default' => 'in-memoria', 'logging.channels.in-memoria' => ['driver' => 'monolog', 'handler' => TestHandler::class]]);
}

/** @return list<string> le righe d'avviso scritte nel log in memoria, nell'ordine */
function avvisiNelLog(): array
{
    $righe = [];
    foreach (Log::channel('in-memoria')->getLogger()->getHandlers()[0]->getRecords() as $riga) {
        if ($riga->level === Level::Warning) {
            $righe[] = $riga->message;
        }
    }

    return $righe;
}

it('col middleware primo dei globali ogni risposta di Laravel porta le cinque intestazioni, coi valori per intero e una volta sola, e non X-Frame-Options (sprint 16 · T2.1)', function (string $caso) {
    primoDeiGlobali();
    rotteDiProva();
    if ($caso === 'il 503 della manutenzione') {
        inManutenzione();
    }

    $risposta = match ($caso) {
        'una 200' => $this->get('/prova/pagina')->assertOk()->assertSee('una pagina'),
        'una 404' => $this->get('/prova/non-esiste')->assertNotFound(),
        'una risposta JSON' => $this->getJson('/prova/json')->assertOk()->assertExactJson(['esito' => 'ok']),
        'un rimando 302' => $this->get('/prova/rimando')->assertStatus(302)->assertRedirect('/prova/pagina'),
        'un 500, da un\'eccezione in un controller' => $this->get('/prova/rotta')->assertStatus(500),
        'il 503 della manutenzione' => $this->get('/prova/pagina')->assertStatus(503),
    };

    expect(intestazioniDiSicurezzaDi($risposta))->toBe(LE_CINQUE_INTESTAZIONI)
        ->and($risposta->headers->has('X-Frame-Options'))->toBeFalse();
})->with(['una 200', 'una 404', 'una risposta JSON', 'un rimando 302', 'un 500, da un\'eccezione in un controller', 'il 503 della manutenzione']);

it('in coda ai globali il middleware lavora, ma il 503 della manutenzione esce senza le cinque intestazioni: per questo il frontend lo mette primo (sprint 16 · T2.1)', function () {
    app(HttpKernel::class)->pushMiddleware(IntestazioniSicurezza::class);
    rotteDiProva();

    expect(intestazioniDiSicurezzaDi($this->get('/prova/pagina')->assertOk()))->toBe(LE_CINQUE_INTESTAZIONI);

    inManutenzione();

    expect(intestazioniDiSicurezzaDi($this->get('/prova/pagina')->assertStatus(503)))->toBe(NESSUNA_INTESTAZIONE);
});

it('le sorgenti del modulo arrivano da zr-core.csp, e una pagina chiede le sue per nome: Turnstile entra nella CSP della sola pagina che lo chiede, e la risposta dopo torna a quella del modulo (sprint 16 · T2.2)', function () {
    primoDeiGlobali();
    rotteDiProva();
    configurazioneDiHome();

    expect($this->get('/prova/pagina')->assertOk()->headers->all('Content-Security-Policy'))->toBe([CSP_DI_HOME])
        ->and($this->get('/prova/registrati')->assertOk()->assertSee('registrati')->headers->all('Content-Security-Policy'))->toBe([CSP_DI_HOME_CON_TURNSTILE])
        ->and($this->get('/prova/pagina')->assertOk()->headers->all('Content-Security-Policy'))->toBe([CSP_DI_HOME])
        ->and($this->get('/prova/non-esiste')->assertNotFound()->headers->all('Content-Security-Policy'))->toBe([CSP_DI_HOME])
        ->and(intestazioniDiSicurezzaDi($this->get('/prova/registrati')->assertOk()))->toBe([...LE_CINQUE_INTESTAZIONI, 'Content-Security-Policy' => [CSP_DI_HOME_CON_TURNSTILE]]);
});

it('il nome della pagina arriva al middleware anche da un controller che riceve una FormRequest, che è una copia della richiesta (sprint 16 · T2.2)', function () {
    primoDeiGlobali();
    configurazioneDiHome();
    $eUnaCopia = null;
    Route::post('/prova/modulo', function (ModuloDiProva $modulo) use (&$eUnaCopia) {
        $eUnaCopia = $modulo !== request();
        IntestazioniSicurezza::perLaPagina('turnstile');

        return 'modulo';
    });

    $risposta = $this->post('/prova/modulo', ['nome' => 'UAT'])->assertOk()->assertSee('modulo');

    expect($eUnaCopia)->toBeTrue()
        ->and($risposta->headers->all('Content-Security-Policy'))->toBe([CSP_DI_HOME_CON_TURNSTILE]);
});

it('perLaPagina vuole un nome: una mappa di sorgenti è un errore di chi la chiama, non una CSP più larga (sprint 16 · T2.2)', function () {
    expect(fn () => IntestazioniSicurezza::perLaPagina(AGGIUNTE_DI_TURNSTILE))->toThrow(TypeError::class);
});

it('un nome non dichiarato non aggiunge niente, e un valore della richiesta non arriva né alla CSP né al log: dalla query, dal corpo, da un\'intestazione, o passato come nome (sprint 16 · T2.2)', function () {
    primoDeiGlobali();
    rotteDiProva();
    configurazioneDiHome();
    logInMemoria();
    Route::post('/prova/nome', function () {
        IntestazioniSicurezza::perLaPagina((string) request()->input('pagina'));

        return 'nome';
    });
    $ostile = 'https://ostile.example.com';

    // Una pagina che non chiede niente, con la richiesta piena: niente di ciò che porta decide la CSP.
    $piena = $this->withHeaders(['Content-Security-Policy' => 'script-src '.$ostile, 'X-Csp-Pagina' => 'turnstile'])
        ->get('/prova/pagina?pagina=turnstile&turnstile=1&csp_pagine=turnstile&script-src='.urlencode($ostile))->assertOk();
    expect($piena->headers->all('Content-Security-Policy'))->toBe([CSP_DI_HOME])->and(avvisiNelLog())->toBe([]);

    // Un controller che passa come nome un valore della richiesta: un nome non dichiarato non aggiunge niente.
    foreach ([$ostile, 'turnstile; script-src '.$ostile, 'non-dichiarato', 'Turnstile', ''] as $nome) {
        expect($this->post('/prova/nome', ['pagina' => $nome])->assertOk()->headers->all('Content-Security-Policy'))->toBe([CSP_DI_HOME]);
    }

    expect(avvisiNelLog())->toHaveCount(5)
        ->and(array_unique(avvisiNelLog()))->toHaveCount(1)
        ->and(avvisiNelLog()[0])->toContain('pagina')->not->toContain('ostile')->not->toContain('non-dichiarato')->not->toContain('Turnstile');
});

it('una mappa al posto del nome della pagina non lancia e non aggiunge niente, e lascia un avviso (sprint 16 · T1.5)', function () {
    primoDeiGlobali();
    configurazioneDiHome();
    logInMemoria();
    Route::get('/prova/mappa', function () {
        // Il nome sta su un attributo della richiesta: qui qualcuno ci scrive una mappa di sorgenti, senza passare da perLaPagina.
        IntestazioniSicurezza::perLaPagina('turnstile');
        $attributo = array_search('turnstile', request()->attributes->all(), true);
        throw_unless(is_string($attributo), LogicException::class, 'il nome non è su un attributo della richiesta');
        request()->attributes->set($attributo, ['script-src' => ['https://a.example.com']]);

        return 'mappa';
    });

    $risposta = $this->get('/prova/mappa')->assertOk()->assertSee('mappa');

    expect(intestazioniDiSicurezzaDi($risposta))->toBe([...LE_CINQUE_INTESTAZIONI, 'Content-Security-Policy' => [CSP_DI_HOME]])
        ->and(avvisiNelLog())->toHaveCount(1)
        ->and(avvisiNelLog()[0])->toContain('pagina')->not->toContain('a.example.com');
});

it('una risposta con `Referrer-Policy: no-referrer` come unico valore lo tiene; in ogni altro caso esce quella di tutti, una volta sola (sprint 16 · T2.3)', function (array|string|null $dellaRisposta, array $attesa) {
    primoDeiGlobali();
    Route::get('/prova/provenienza', function () use ($dellaRisposta) {
        $risposta = response('provenienza');
        if ($dellaRisposta !== null) {
            $risposta->headers->set('Referrer-Policy', $dellaRisposta);
        }

        return $risposta;
    });

    $risposta = $this->get('/prova/provenienza')->assertOk()->assertSee('provenienza');

    expect(intestazioniDiSicurezzaDi($risposta))->toBe([...LE_CINQUE_INTESTAZIONI, 'Referrer-Policy' => $attesa]);
})->with([
    'la risposta non ne ha' => [null, ['strict-origin-when-cross-origin']],
    'no-referrer, da solo' => ['no-referrer', ['no-referrer']],
    'no-referrer e un altro valore' => [['no-referrer', 'unsafe-url'], ['strict-origin-when-cross-origin']],
    'un altro valore e no-referrer' => [['unsafe-url', 'no-referrer'], ['strict-origin-when-cross-origin']],
    'no-referrer due volte' => [['no-referrer', 'no-referrer'], ['strict-origin-when-cross-origin']],
    'due valori in uno solo' => ['no-referrer, unsafe-url', ['strict-origin-when-cross-origin']],
    'un altro valore solo, più largo' => ['unsafe-url', ['strict-origin-when-cross-origin']],
    'un altro valore solo, più stretto' => ['same-origin', ['strict-origin-when-cross-origin']],
    'quella di tutti' => ['strict-origin-when-cross-origin', ['strict-origin-when-cross-origin']],
]);

it('il rimando dell\'ingresso di zr-auth tiene il suo no-referrer, e prende le altre quattro intestazioni (sprint 16 · T2.3)', function () {
    primoDeiGlobali();
    Route::get('/prova/ingresso', fn () => redirect()->away('https://home.example.com/ingresso?state=abc')->withHeaders(Ingresso::INTESTAZIONI));

    $risposta = $this->get('/prova/ingresso')->assertStatus(302);

    expect(Ingresso::INTESTAZIONI['Referrer-Policy'] ?? null)->toBe('no-referrer')
        ->and(intestazioniDiSicurezzaDi($risposta))->toBe([...LE_CINQUE_INTESTAZIONI, 'Referrer-Policy' => ['no-referrer']]);
});

it('il middleware non lancia mai: con una configurazione di forma sbagliata la risposta esce col suo stato e con le cinque intestazioni, la CSP porta le sole sorgenti ammesse, e lo scarto lascia nel log una riga d\'avviso (sprint 16 · T2.4)', function (mixed $csp, mixed $cspPagine, string $cspAttesa, array $nellAvviso) {
    primoDeiGlobali();
    rotteDiProva();
    logInMemoria();
    config(['zr-core.csp' => $csp, 'zr-core.csp_pagine' => $cspPagine]);

    $risposta = $this->get('/prova/registrati')->assertOk()->assertSee('registrati');

    expect(intestazioniDiSicurezzaDi($risposta))->toBe([...LE_CINQUE_INTESTAZIONI, 'Content-Security-Policy' => [$cspAttesa]])
        ->and(avvisiNelLog())->toHaveCount(1)
        ->and(avvisiNelLog()[0])->toContain(...$nellAvviso)
        ->and(preg_match('/[\x00-\x1F\x7F]/', avvisiNelLog()[0]))->toBe(0);

    // E su una risposta d'errore: lo stato resta il suo.
    expect($this->get('/prova/non-esiste')->assertNotFound()->headers->all('X-Content-Type-Options'))->toBe(['nosniff']);
})->with([
    'zr-core.csp è un testo' => ["font-src 'self'", ['turnstile' => AGGIUNTE_DI_TURNSTILE], CSP_DI_TUTTI_CON_TURNSTILE, ['modulo']],
    'zr-core.csp_pagine è un numero' => [AGGIUNTE_DI_HOME, 7, CSP_DI_HOME, ['csp_pagine']],
    'una sorgente non ammessa fra quelle del modulo' => [
        ['font-src' => ["'self'"], 'img-src' => ['https://*.example.com', 'https://cdn.example.com']], ['turnstile' => AGGIUNTE_DI_TURNSTILE],
        CSP_DI_HOME_CON_TURNSTILE_E_IMMAGINI, ['modulo', 'img-src'],
    ],
    'una sorgente non ammessa fra quelle della pagina' => [
        AGGIUNTE_DI_HOME, ['turnstile' => ['script-src' => ["'unsafe-inline'", 'https://challenges.cloudflare.com'], 'frame-src' => ['https://challenges.cloudflare.com']]],
        CSP_DI_HOME_CON_TURNSTILE, ['pagina', 'script-src'],
    ],
    'l\'insieme della pagina è un testo' => [AGGIUNTE_DI_HOME, ['turnstile' => 'script-src https://challenges.cloudflare.com'], CSP_DI_HOME, ['pagina']],
    'una direttiva a cui non si aggiunge' => [['font-src' => ["'self'"], 'frame-ancestors' => ['https://a.example.com']], [], CSP_DI_HOME, ['modulo', 'frame-ancestors']],
]);

it('senza niente da scartare nel log non esce nessun avviso, nemmeno senza la configurazione di zr-core; con qualcosa da scartare, una riga per risposta (sprint 16 · T2.4)', function () {
    primoDeiGlobali();
    rotteDiProva();
    configurazioneDiHome();
    logInMemoria();

    $this->get('/prova/pagina')->assertOk();
    $this->get('/prova/registrati')->assertOk();
    $this->get('/prova/non-esiste')->assertNotFound();
    $this->get('/prova/rimando')->assertStatus(302);
    // Una configurazione messa in cache prima di installare questa versione non ha la chiave `zr-core`: vale come vuota.
    config(['zr-core' => null]);
    expect($this->get('/prova/pagina')->assertOk()->headers->all('Content-Security-Policy'))->toBe([CSP_DI_TUTTI])
        ->and(avvisiNelLog())->toBe([]);

    // Quattro scarti nella configurazione del modulo: una riga per risposta, non una per scarto.
    config(['zr-core' => ['csp' => ['img-src' => ['https://*.example.com'], 'script-src' => ["'unsafe-inline'", 'data:'], 'worker-src' => ["'self'"]], 'csp_pagine' => []]]);
    expect($this->get('/prova/pagina')->assertOk()->headers->all('Content-Security-Policy'))->toBe([CSP_DI_TUTTI])
        ->and(avvisiNelLog())->toHaveCount(1);
    $this->get('/prova/non-esiste')->assertNotFound();

    expect(avvisiNelLog())->toHaveCount(2)
        ->and(avvisiNelLog()[1])->toBe(avvisiNelLog()[0])
        ->and(avvisiNelLog()[0])->toContain('img-src', 'script-src', 'worker-src');
});

it('la riga d\'avviso resta corta anche con molti scarti: dice quanti sono e ne mostra i primi (sprint 16 · T2.4)', function () {
    primoDeiGlobali();
    rotteDiProva();
    logInMemoria();
    config(['zr-core.csp' => ['script-src' => array_map(fn (int $numero) => 'https://*.dominio-'.$numero.'.example.com', range(1, 40))]]);

    expect($this->get('/prova/pagina')->assertOk()->headers->all('Content-Security-Policy'))->toBe([CSP_DI_TUTTI])
        ->and(avvisiNelLog())->toHaveCount(1)
        ->and(strlen(avvisiNelLog()[0]))->toBeLessThan(1500)
        ->and(avvisiNelLog()[0])->toContain('40', 'dominio-1.')->not->toContain('dominio-40.');
});

it('un log che lancia non diventa un 500 senza intestazioni: la risposta esce col suo stato e con le cinque (sprint 16 · T2.4)', function () {
    primoDeiGlobali();
    rotteDiProva();
    config(['logging.default' => 'rotto', 'logging.channels.rotto' => ['driver' => 'monolog', 'handler' => RegistroCheLancia::class]]);
    config(['zr-core.csp' => ['img-src' => ['https://*.example.com']]]);

    // Il log lancia davvero: senza, il caso non proverebbe niente.
    expect(fn () => Log::warning('una riga di prova'))->toThrow(RuntimeException::class, 'il log non scrive');

    expect(intestazioniDiSicurezzaDi($this->get('/prova/pagina')->assertOk()->assertSee('una pagina')))->toBe(LE_CINQUE_INTESTAZIONI)
        ->and(intestazioniDiSicurezzaDi($this->get('/prova/non-esiste')->assertNotFound()))->toBe(LE_CINQUE_INTESTAZIONI)
        ->and(intestazioniDiSicurezzaDi($this->get('/prova/rimando')->assertStatus(302)))->toBe(LE_CINQUE_INTESTAZIONI);
});

it('se la configurazione non si legge, la risposta esce lo stesso col suo stato: la CSP di tutti senza aggiunte, le altre quattro, e un avviso (sprint 16 · T2.4)', function () {
    primoDeiGlobali();
    rotteDiProva();
    configurazioneDiHome();
    logInMemoria();
    app()->instance('config', new class(config()->all()) extends Repository
    {
        public function get($key, $default = null)
        {
            if (is_string($key) && str_starts_with($key, 'zr-core')) {
                throw new RuntimeException('la configurazione di zr-core non si legge');
            }

            return parent::get($key, $default);
        }
    });

    $risposta = $this->get('/prova/registrati')->assertOk()->assertSee('registrati');

    expect(intestazioniDiSicurezzaDi($risposta))->toBe(LE_CINQUE_INTESTAZIONI)
        ->and(avvisiNelLog())->toHaveCount(1)
        ->and(avvisiNelLog()[0])->toContain('RuntimeException')->not->toContain('non si legge');
});

it('zr-core non registra il middleware da sé: col solo provider una risposta non ha le intestazioni, e con la riga del frontend le ha (sprint 16 · T2.6)', function () {
    rotteDiProva();
    $kernel = app(HttpKernel::class);
    $delleRotte = collect(Route::getRoutes()->getRoutes())->flatMap(fn ($rotta) => $rotta->gatherMiddleware())->all();

    expect($kernel->hasMiddleware(IntestazioniSicurezza::class))->toBeFalse()
        ->and(Arr::flatten($kernel->getMiddlewareGroups()))->not->toContain(IntestazioniSicurezza::class)
        ->and($delleRotte)->not->toContain(IntestazioniSicurezza::class)
        ->and(intestazioniDiSicurezzaDi($this->get('/prova/pagina')->assertOk()))->toBe(NESSUNA_INTESTAZIONE)
        ->and(intestazioniDiSicurezzaDi($this->get('/prova/non-esiste')->assertNotFound()))->toBe(NESSUNA_INTESTAZIONE);

    // La riga del frontend: da qui le ha.
    primoDeiGlobali();

    expect(intestazioniDiSicurezzaDi($this->get('/prova/pagina')->assertOk()))->toBe(LE_CINQUE_INTESTAZIONI);
});

// Sprint 16 · review, R9 · T2.7 (seconda lettura della PR; nota `Decisione:` 8976): una risposta che porta già una CSP la tiene,
// e quella del modulo le esce accanto, dopo. Il browser le applica insieme, e passa solo ciò che ammettono tutte e due: una
// risposta può stringere, mai allargare. Il caso vero è di Laravel, che mette una CSP con `sandbox` sui file che serve da un
// disco: col `set` di prima la classe la toglieva, e un file caricato da una persona girava nell'origine del modulo.

/** La CSP che Laravel mette sui file che serve da un disco (`Illuminate\Filesystem\ServeFile`), scritta qui com'è nella 13.35. */
const CSP_DEI_FILE_DI_LARAVEL = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

it('una risposta che porta già una CSP la tiene, e quella del modulo le esce accanto, dopo; una uguale a quella del modulo esce una volta sola, un valore vuoto non resta, e le altre quattro intestazioni restano una volta sola (sprint 16 · review, R9 · T2.7)', function (array|string|null $dellaRisposta, array $attesa) {
    primoDeiGlobali();
    Route::get('/prova/csp', function () use ($dellaRisposta) {
        $risposta = response('con una CSP sua');
        $risposta->headers->set('Content-Security-Policy', $dellaRisposta);

        return $risposta;
    });

    $risposta = $this->get('/prova/csp')->assertOk()->assertSee('con una CSP sua');

    expect(intestazioniDiSicurezzaDi($risposta))->toBe([...LE_CINQUE_INTESTAZIONI, 'Content-Security-Policy' => $attesa]);
})->with([
    'quella dei file di Laravel, con sandbox' => [CSP_DEI_FILE_DI_LARAVEL, [CSP_DEI_FILE_DI_LARAVEL, CSP_DI_TUTTI]],
    'due valori suoi: restano tutti e due, nel loro ordine' => [["default-src 'none'", "script-src 'none'; sandbox"], ["default-src 'none'", "script-src 'none'; sandbox", CSP_DI_TUTTI]],
    'una più larga: resta, e quella del modulo le sta accanto' => ['default-src *', ['default-src *', CSP_DI_TUTTI]],
    'quella del modulo e una sua: quella del modulo una volta sola, in fondo' => [[CSP_DI_TUTTI, 'sandbox'], ['sandbox', CSP_DI_TUTTI]],
    'un valore vuoto e una sua: resta la sua' => [['', 'sandbox'], ['sandbox', CSP_DI_TUTTI]],
    // Il verso che non cambia: qui esce la sola CSP del modulo, come col `set` di prima.
    'uguale a quella del modulo' => [CSP_DI_TUTTI, [CSP_DI_TUTTI]],
    'quella del modulo già due volte' => [[CSP_DI_TUTTI, CSP_DI_TUTTI], [CSP_DI_TUTTI]],
    'un valore vuoto' => ['', [CSP_DI_TUTTI]],
    'soli spazi' => ['   ', [CSP_DI_TUTTI]],
    'nessun valore (null)' => [null, [CSP_DI_TUTTI]],
]);

it('con le sorgenti di un modulo vale lo stesso: la CSP che la risposta porta resta com\'è, anche se è quella di tutti, e le esce accanto quella del modulo — o quella della pagina, se la pagina chiede le sue per nome (sprint 16 · review, R9 · T2.7)', function () {
    primoDeiGlobali();
    configurazioneDiHome();
    Route::get('/prova/csp', fn () => response('una pagina')->header('Content-Security-Policy', CSP_DI_TUTTI));
    Route::get('/prova/csp-pagina', function () {
        IntestazioniSicurezza::perLaPagina('turnstile');

        return response('registrati')->header('Content-Security-Policy', CSP_DI_HOME);
    });

    expect($this->get('/prova/csp')->assertOk()->headers->all('Content-Security-Policy'))->toBe([CSP_DI_TUTTI, CSP_DI_HOME])
        ->and($this->get('/prova/csp-pagina')->assertOk()->headers->all('Content-Security-Policy'))->toBe([CSP_DI_HOME, CSP_DI_HOME_CON_TURNSTILE]);
});

it('un file che Laravel serve da un disco esce con la sua CSP, quella con `sandbox`, e con quella del modulo accanto: un file caricato da una persona non gira nell\'origine del modulo (sprint 16 · review, R9 · T2.7)', function () {
    primoDeiGlobali();
    Storage::fake('local');
    Storage::disk('local')->put('caricato.html', '<p>un file caricato da una persona</p>');
    // Come la rotta che Laravel registra per un disco con `serve`: la stessa classe, qui con un disco pubblico (senza firma).
    Route::get('/prova/storage/{path}', fn (Request $richiesta, string $path) => (new ServeFile('local', ['visibility' => 'public'], false))($richiesta, $path))->where('path', '.*');

    $risposta = $this->get('/prova/storage/caricato.html')->assertOk();

    expect(intestazioniDiSicurezzaDi($risposta))->toBe([...LE_CINQUE_INTESTAZIONI, 'Content-Security-Policy' => [CSP_DEI_FILE_DI_LARAVEL, CSP_DI_TUTTI]])
        ->and($risposta->streamedContent())->toBe('<p>un file caricato da una persona</p>');
});

it('un valore che non è un testo, ma che la risposta manderebbe come CSP, resta com\'è con quella del modulo accanto: la classe non perde ciò che non sa leggere (sprint 16 · review, R9 · T2.7)', function () {
    primoDeiGlobali();
    // Fuori dal contratto di Symfony, che i valori li dice testi ma non lo impone: all'invio lo scriverebbe come testo.
    $sua = new class implements Stringable
    {
        public function __toString(): string
        {
            return 'sandbox';
        }
    };
    Route::get('/prova/csp', function () use ($sua) {
        $risposta = response('con una CSP sua');
        $risposta->headers->set('Content-Security-Policy', [$sua]);

        return $risposta;
    });

    $valori = $this->get('/prova/csp')->assertOk()->headers->all('Content-Security-Policy');

    expect($valori)->toHaveCount(2)
        ->and($valori[0])->toBe($sua)
        ->and($valori[1])->toBe(CSP_DI_TUTTI);
});

// Sprint 18 · T3 (voce #1628; rilievo D1 della lettura di sicurezza della v1.6.0). Symfony i valori di un'intestazione li dice
// testi ma non lo impone, e dalla v1.6.0 la classe tiene ogni CSP che la risposta porta già: una che PHP non sa scrivere — una
// lista, un oggetto che non si legge come testo, un testo con un a capo in mezzo o con un byte nullo — fermava l'invio, fuori dai
// middleware: un 500 senza intestazioni, per un errore nel codice che ha scritto la risposta. La classe la scarta e lo scrive
// nel log: il tipo, mai il valore. Ciò che PHP sa scrivere resta com'è: gli spazi e gli a capo in fondo a un testo li taglia
// PHP all'invio (misurato l'11/10/2026 con PHP 8.4: `header()` si ferma su un a capo o un ritorno in mezzo o in testa al
// valore, e su un byte nullo ovunque; non su quelli in fondo).

/** Sta in ogni valore che non si può mandare: se la classe scrivesse il valore nel log, i casi ce lo troverebbero. */
const SEGNO_DELLO_SCARTO = 'segno-dello-scarto';

/** Un oggetto che si legge come testo: il testo è quello che gli si dà. */
final class CspComeOggetto implements Stringable
{
    public function __construct(private readonly string $testo) {}

    public function __toString(): string
    {
        return $this->testo;
    }
}

/** Un oggetto che lancia mentre lo si legge come testo. */
final class CspCheLancia implements Stringable
{
    public function __toString(): string
    {
        throw new RuntimeException(SEGNO_DELLO_SCARTO.': questo oggetto non si legge');
    }
}

/** I nomi dei valori di cspCheNonSiPuoMandare(): i casi li prendono da qui. */
const CSP_CHE_NON_SI_POSSONO_MANDARE = [
    'una lista dentro la lista',
    'un oggetto che non si legge come testo',
    'una funzione',
    'un testo con un a capo in mezzo',
    'un testo con un ritorno in mezzo',
    'un testo che comincia con un a capo',
    'un testo con un byte nullo in mezzo',
    'un testo con un byte nullo in fondo',
    'un oggetto il cui testo ha un a capo in mezzo',
];

/**
 * Un valore che una risposta può portare fra le sue CSP e che PHP all'invio non sa scrivere, col tipo che l'avviso ne dice.
 *
 * @return array{mixed, string}
 */
function cspCheNonSiPuoMandare(string $quale): array
{
    return match ($quale) {
        'una lista dentro la lista' => [["default-src 'none'", SEGNO_DELLO_SCARTO], 'array'],
        'un oggetto che non si legge come testo' => [(object) ['csp' => SEGNO_DELLO_SCARTO], 'stdClass'],
        'una funzione' => [fn (): string => SEGNO_DELLO_SCARTO, 'Closure'],
        'un testo con un a capo in mezzo' => ["default-src 'none';\n".SEGNO_DELLO_SCARTO, 'string'],
        'un testo con un ritorno in mezzo' => ["default-src 'none';\r".SEGNO_DELLO_SCARTO, 'string'],
        'un testo che comincia con un a capo' => ["\n".SEGNO_DELLO_SCARTO, 'string'],
        'un testo con un byte nullo in mezzo' => ["default-src 'none';\0".SEGNO_DELLO_SCARTO, 'string'],
        'un testo con un byte nullo in fondo' => [SEGNO_DELLO_SCARTO."\0", 'string'],
        'un oggetto il cui testo ha un a capo in mezzo' => [new CspComeOggetto("default-src 'none';\n".SEGNO_DELLO_SCARTO), 'CspComeOggetto'],
    };
}

it('una risposta che porta fra le sue CSP un valore che non si può mandare esce col suo stato e il suo corpo, senza quel valore: restano le altre sue CSP nel loro ordine e quella del modulo in fondo, e le altre quattro intestazioni come sempre (sprint 18 · T3.1)', function (string $quale, string $dove) {
    primoDeiGlobali();
    [$nonInviabile] = cspCheNonSiPuoMandare($quale);
    [$dellaRisposta, $attesa] = match ($dove) {
        'da solo' => [[$nonInviabile], [CSP_DI_TUTTI]],
        'prima di una valida' => [[$nonInviabile, 'sandbox'], ['sandbox', CSP_DI_TUTTI]],
        'dopo una valida' => [['sandbox', $nonInviabile], ['sandbox', CSP_DI_TUTTI]],
        'fra due valide' => [["default-src 'none'", $nonInviabile, 'sandbox'], ["default-src 'none'", 'sandbox', CSP_DI_TUTTI]],
    };
    Route::get('/prova/csp', function () use ($dellaRisposta) {
        $risposta = response('con una CSP che non si può mandare', 202);
        $risposta->headers->set('Content-Security-Policy', $dellaRisposta);

        return $risposta;
    });

    $risposta = $this->get('/prova/csp')->assertStatus(202)->assertSee('con una CSP che non si può mandare');

    expect(intestazioniDiSicurezzaDi($risposta))->toBe([...LE_CINQUE_INTESTAZIONI, 'Content-Security-Policy' => $attesa]);
})->with(CSP_CHE_NON_SI_POSSONO_MANDARE)->with(['da solo', 'prima di una valida', 'dopo una valida', 'fra due valide']);

it('lo scarto di una CSP che non si può mandare lascia nel log una riga d\'avviso: dice che il valore era della risposta e di che tipo era, mai il valore né qualcosa della richiesta (sprint 18 · T3.2)', function (string $quale) {
    primoDeiGlobali();
    logInMemoria();
    [$nonInviabile, $tipo] = cspCheNonSiPuoMandare($quale);
    Route::get('/prova/csp', function () use ($nonInviabile) {
        $risposta = response('con una CSP che non si può mandare');
        $risposta->headers->set('Content-Security-Policy', [$nonInviabile, 'sandbox']);

        return $risposta;
    });

    $this->get('/prova/csp?parola=segno-della-richiesta')->assertOk();

    expect(avvisiNelLog())->toHaveCount(1)
        ->and(avvisiNelLog()[0])->toStartWith('zr-core, intestazioni di sicurezza: scartato dalla CSP (1) — risposta: ')
        ->and(avvisiNelLog()[0])->toEndWith(' ('.$tipo.')')
        ->and(avvisiNelLog()[0])->not->toContain(SEGNO_DELLO_SCARTO)->not->toContain('segno-della-richiesta')->not->toContain('/prova/csp')->not->toContain('sandbox')
        ->and(preg_match('/[\x00-\x1F\x7F]/', avvisiNelLog()[0]))->toBe(0);
})->with(CSP_CHE_NON_SI_POSSONO_MANDARE);

it('gli scarti della risposta stanno nella riga degli altri scarti della CSP, dopo quelli della configurazione: una riga per risposta, coi primi cinque (sprint 18 · T3.2)', function () {
    primoDeiGlobali();
    logInMemoria();
    config(['zr-core.csp' => ['img-src' => ['https://*.example.com']]]);
    Route::get('/prova/csp', function () {
        $risposta = response('con sei CSP che non si possono mandare');
        $risposta->headers->set('Content-Security-Policy', [['a'], ['b'], ['c'], 'sandbox', ['d'], ['e'], ['f']]);

        return $risposta;
    });

    $risposta = $this->get('/prova/csp')->assertOk()->assertSee('con sei CSP che non si possono mandare');

    expect(intestazioniDiSicurezzaDi($risposta))->toBe([...LE_CINQUE_INTESTAZIONI, 'Content-Security-Policy' => ['sandbox', CSP_DI_TUTTI]])
        ->and(avvisiNelLog())->toHaveCount(1)
        ->and(avvisiNelLog()[0])->toStartWith('zr-core, intestazioni di sicurezza: scartato dalla CSP (7) — ')
        ->and(avvisiNelLog()[0])->toEndWith(' (array) · e altri 2')
        ->and(substr_count(avvisiNelLog()[0], 'img-src'))->toBe(1)
        ->and(substr_count(avvisiNelLog()[0], 'risposta: '))->toBe(4)
        ->and(strpos(avvisiNelLog()[0], 'img-src'))->toBeLessThan(strpos(avvisiNelLog()[0], 'risposta: '));
});

it('ciò che PHP sa scrivere resta com\'è e non lascia avvisi: un testo, anche con un a capo o degli spazi in fondo, e un oggetto che si legge come testo, lo stesso oggetto; quella del modulo esce accanto, dopo (sprint 18 · T3.3)', function () {
    primoDeiGlobali();
    logInMemoria();
    $sue = [
        "default-src 'none'",
        // Come un testo letto da un file, o scritto su più righe e chiuso da un a capo: all'invio PHP taglia ciò che sta in fondo.
        "script-src 'none'\n",
        "style-src 'none'\r\n",
        "img-src 'none' \t",
        new CspComeOggetto('sandbox'),
        new CspComeOggetto("frame-ancestors 'none'\n"),
    ];
    Route::get('/prova/csp', function () use ($sue) {
        $risposta = response('con sei CSP sue');
        $risposta->headers->set('Content-Security-Policy', $sue);

        return $risposta;
    });

    $risposta = $this->get('/prova/csp')->assertOk()->assertSee('con sei CSP sue');

    // `toBe` confronta con `===`: i due oggetti sono gli stessi, non due uguali.
    expect(intestazioniDiSicurezzaDi($risposta))->toBe([...LE_CINQUE_INTESTAZIONI, 'Content-Security-Policy' => [...$sue, CSP_DI_TUTTI]])
        ->and(avvisiNelLog())->toBe([]);
});

it('un oggetto che lancia mentre lo si legge come testo è scartato come gli altri: l\'errore non esce dal middleware, la risposta esce col suo stato, il suo corpo e le cinque intestazioni, e l\'avviso non porta il messaggio dell\'errore (sprint 18 · T3.4)', function (array $dellaRisposta, array $attesa) {
    primoDeiGlobali();
    logInMemoria();
    Route::get('/prova/csp', function () use ($dellaRisposta) {
        $risposta = response('con una CSP che lancia', 202);
        $risposta->headers->set('Content-Security-Policy', $dellaRisposta);

        return $risposta;
    });

    // L'oggetto lancia davvero: senza, il caso non proverebbe niente.
    expect(fn () => (string) new CspCheLancia)->toThrow(RuntimeException::class, 'questo oggetto non si legge');

    $risposta = $this->get('/prova/csp')->assertStatus(202)->assertSee('con una CSP che lancia');

    expect(intestazioniDiSicurezzaDi($risposta))->toBe([...LE_CINQUE_INTESTAZIONI, 'Content-Security-Policy' => $attesa])
        ->and(avvisiNelLog())->toHaveCount(1)
        ->and(avvisiNelLog()[0])->toStartWith('zr-core, intestazioni di sicurezza: scartato dalla CSP (1) — risposta: ')
        ->and(avvisiNelLog()[0])->toEndWith(' (CspCheLancia)')
        ->and(avvisiNelLog()[0])->not->toContain(SEGNO_DELLO_SCARTO)->not->toContain('non si legge');
})->with([
    'da solo' => [[new CspCheLancia], [CSP_DI_TUTTI]],
    'accanto a una valida' => [['sandbox', new CspCheLancia], ['sandbox', CSP_DI_TUTTI]],
]);
