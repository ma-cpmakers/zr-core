<?php

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
