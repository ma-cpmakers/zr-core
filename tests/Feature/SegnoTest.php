<?php

use Illuminate\Cookie\CookieValuePrefix;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Illuminate\Testing\TestResponse;
use Monolog\Handler\TestHandler;
use Monolog\Level;
use Symfony\Component\HttpFoundation\Cookie;
use Zeiras\Core\Cornice;
use Zeiras\Core\Segno;

// Sprint 45 · T2 (voce #2001). I segni della parte server non vanno mai indietro per lo stesso browser: l'ultimo segno dato
// sta in un cookie firmato del pacchetto, `__Host-zr-core-segno`, e un segno nuovo non è mai più indietro di quello.
// Con due nodi sfasati, o l'orologio riportato indietro, la pagina di chi è entrato adesso non vale come una pagina vecchia.
// Un cookie che non torna — manomesso, firmato con un'altra chiave, in un'altra forma, vuoto — o che manca non vale: il
// segno è l'orologio, come fino alla `v2.10.0`, e la risposta riscrive il cookie. Dalla review della PR #79 (zr-pm,
// Decisione: 12931): due richieste diverse non hanno mai lo stesso segno — col cookie avanti, il segno è quello più un
// microsecondo —, e il cookie vale solo fino a cinque minuti avanti dell'orologio.

const SEGNO_ALLE_DODICI = '2026-10-14T12:00:00.000000Z';
const SEGNO_DIECI_MINUTI_PRIMA = '2026-10-14T11:50:00.000000Z';
// Quattro minuti indietro: dentro i cinque minuti in cui il cookie vale (T2.9).
const SEGNO_QUATTRO_MINUTI_PRIMA = '2026-10-14T11:56:00.000000Z';

beforeEach(function () {
    // Le due letture di un frontend, nel gruppo `web` come le sue pagine: i dati della sessione e quelli del backoffice.
    Route::middleware('web')->get('uat-segno/subito', fn () => Cornice::subito());
    Route::middleware('web')->get('uat-segno/dopo', fn () => Cornice::dopo());
    // Il solo segno, senza i dati della cornice.
    Route::middleware('web')->get('uat-segno/solo', fn () => [Segno::adesso()]);
    // La sessione dura un'ora da quando si apre: alle 11:30 copre ogni orologio dei casi, dalle 11:00 alle 12:05.
    Carbon::setTestNow(Carbon::parse('2026-10-14 11:30:00', 'UTC'));
    sessioneAMano(['id' => 'uat-ws', 'nome' => 'UAT Marketing', 'slug' => 'uat-marketing']);
    segnoDalBackoffice();
});

/**
 * Il backoffice per ogni rotta che dà un segno: io.mostra, gli elenchi della cornice, le notifiche e le loro letture. Se c'è,
 * `$aIoMostra` gira quando la chiamata a io.mostra arriva.
 */
function segnoDalBackoffice(?Closure $aIoMostra = null): void
{
    Http::fake(function (Request $richiesta) use ($aIoMostra) {
        $percorso = parse_url($richiesta->url(), PHP_URL_PATH);
        if ($percorso === '/v1/io' && $aIoMostra !== null) {
            $aIoMostra();
        }

        return Http::response(segnoRispostaA($percorso));
    });
}

/** @return array<string, mixed> */
function segnoRispostaA(mixed $percorso): array
{
    return match ($percorso) {
        '/v1/io' => ['data' => [
            'utente' => ['id' => 'uat-ada', 'nome' => 'UAT Ada', 'email' => 'uat-ada@example.com', 'email_verificata_il' => '2026-10-01T00:00:00Z', 'lingua' => 'en', 'fuso_orario' => 'Europe/Rome'],
            'workspace' => ['id' => 'uat-ws', 'nome' => 'UAT Marketing', 'slug' => 'uat-marketing', 'azienda_id' => 'az-b'],
            'ruolo' => 'membro',
            'notifiche_non_lette' => 3,
        ]],
        '/v1/io/notifiche/uat-n1/lettura' => ['data' => [
            'id' => 'uat-n1', 'tipo' => 'com.zeiras.board.cartella.creata', 'app' => 'pm', 'soggetto' => '/v1/board/cartelle/uat-c1',
            'dati' => ['id' => 'uat-c1'], 'letta_il' => '2026-10-14T09:00:00.000Z', 'creata_il' => '2026-10-14T08:00:00.000Z',
        ]],
        '/v1/io/notifiche/letture' => ['data' => ['fino_a' => '2026-10-14T08:00:00.000Z', 'segnate' => 1, 'altre' => false]],
        default => ['data' => [], 'successivo' => null],
    };
}

/**
 * Le cinque richieste che danno un segno, e dove lo danno: `subito`, `dopo`, l'elenco delle notifiche, la lettura di una e
 * «segna tutte come lette».
 *
 * @return array<string, array{string, string, array<string, mixed>|null, list<string>}>
 */
function richiesteColSegno(): array
{
    return [
        'subito' => ['GET', 'uat-segno/subito', null, ['sessione_il']],
        'dopo' => ['GET', 'uat-segno/dopo', null, ['aggiornati_il', 'sessione_il']],
        'l\'elenco delle notifiche' => ['GET', 'cornice/notifiche', null, ['aggiornati_il']],
        'la lettura di una notifica' => ['PATCH', 'cornice/notifiche/uat-n1/lettura', ['letta' => true], ['segnata_il']],
        'segna tutte come lette' => ['POST', 'cornice/notifiche/letture', ['fino_a' => '2026-10-14T08:00:00.000Z', 'workspace' => 'uat-marketing'], ['segnate_il']],
    ];
}

/**
 * Una richiesta del browser, col cookie del segno se c'è (il suo valore in chiaro: nel trasporto lo cifra EncryptCookies del
 * frontend, come nel gruppo `web` di Laravel), e niente altro dalle richieste di prima.
 *
 * @param  array<string, mixed>|null  $corpo
 */
function dalBrowser(string $metodo, string $indirizzo, ?array $corpo = null, ?string $cookie = null): TestResponse
{
    $cookies = $cookie === null ? [] : [Segno::COOKIE => encrypt(CookieValuePrefix::create(Segno::COOKIE, app('encrypter')->getKey()).$cookie, false)];

    return test()->call($metodo, $indirizzo, [], $cookies, [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'], $corpo === null ? null : (string) json_encode($corpo));
}

/** Il cookie del segno che la risposta scrive, così come lo scrive (cifrato da EncryptCookies), o null. */
function cookieDelSegno(TestResponse $risposta): ?Cookie
{
    foreach ($risposta->headers->getCookies() as $cookie) {
        if ($cookie->getName() === Segno::COOKIE) {
            return $cookie;
        }
    }

    return null;
}

/** Il valore in chiaro del cookie del segno che la risposta scrive. */
function valoreDelSegno(TestResponse $risposta): ?string
{
    return $risposta->getCookie(Segno::COOKIE)?->getValue();
}

/**
 * I segni che una risposta dà, chiave per chiave.
 *
 * @param  list<string>  $chiavi
 * @return array<string, mixed>
 */
function segniDi(TestResponse $risposta, array $chiavi): array
{
    return array_combine($chiavi, array_map(fn (string $chiave) => $risposta->json($chiave), $chiavi));
}

it('una richiesta dello stesso browser con l\'orologio della parte server quattro minuti indietro dà un segno più avanti dell\'ultimo dato alla richiesta di prima, in tutte e cinque le risposte che danno un segno (sprint 45 · T2.1, T2.8)', function (string $metodo, string $indirizzo, ?array $corpo, array $chiavi) {
    Carbon::setTestNow(Carbon::parse(SEGNO_ALLE_DODICI));
    $prima = dalBrowser('GET', 'uat-segno/subito')->assertOk();
    expect($prima->json('sessione_il'))->toBe(SEGNO_ALLE_DODICI);

    // Un altro nodo, o l'orologio riportato indietro: quattro minuti.
    Carbon::setTestNow(Carbon::parse(SEGNO_QUATTRO_MINUTI_PRIMA));
    $poi = dalBrowser($metodo, $indirizzo, $corpo, valoreDelSegno($prima))->assertOk();

    expect(segniDi($poi, $chiavi))->toBe(array_fill_keys($chiavi, '2026-10-14T12:00:00.000001Z'));
})->with(richiesteColSegno());

it('un segno ricevuto non va mai indietro e non si ripete: di richiesta in richiesta, con l\'orologio che va avanti e indietro, ogni segno è l\'orologio se è più avanti dell\'ultimo dato, e altrimenti l\'ultimo dato più un microsecondo (sprint 45 · T2.1, T2.2, T2.8; zr-pm, Decisione: 12921 e 12931)', function () {
    $cookie = null;
    $segni = [];
    foreach (['2026-10-14 12:00:00', '2026-10-14 11:56:00', '2026-10-14 11:59:59.999999', '2026-10-14 12:00:00.000001', '2026-10-14 12:00:00.000003', '2026-10-14 12:00:00.000010', '2026-10-14 12:05:00'] as $orologio) {
        Carbon::setTestNow(Carbon::parse($orologio, 'UTC'));
        $risposta = dalBrowser('GET', 'uat-segno/subito', null, $cookie)->assertOk();
        $segni[] = $risposta->json('sessione_il');
        $cookie = valoreDelSegno($risposta);
    }

    expect($segni)->toBe([
        '2026-10-14T12:00:00.000000Z',
        '2026-10-14T12:00:00.000001Z',
        '2026-10-14T12:00:00.000002Z',
        '2026-10-14T12:00:00.000003Z',
        '2026-10-14T12:00:00.000004Z',
        '2026-10-14T12:00:00.000010Z',
        '2026-10-14T12:05:00.000000Z',
    ]);
});

it('con l\'orologio più avanti dell\'ultimo segno ricordato il segno è l\'orologio (sprint 45 · T2.2)', function (string $metodo, string $indirizzo, ?array $corpo, array $chiavi) {
    Carbon::setTestNow(Carbon::parse(SEGNO_DIECI_MINUTI_PRIMA));
    $prima = dalBrowser('GET', 'uat-segno/subito')->assertOk();

    Carbon::setTestNow(Carbon::parse(SEGNO_ALLE_DODICI));
    $poi = dalBrowser($metodo, $indirizzo, $corpo, valoreDelSegno($prima))->assertOk();

    expect(segniDi($poi, $chiavi))->toBe(array_fill_keys($chiavi, SEGNO_ALLE_DODICI));
})->with(richiesteColSegno());

it('ogni risposta che dà un segno scrive il cookie __Host-zr-core-segno: Path=/, senza Domain, Secure, HttpOnly, SameSite=Lax, che scade con la sessione, e col solo istante dato e la sua firma — niente della persona né del workspace (sprint 45 · T2.3)', function (string $metodo, string $indirizzo, ?array $corpo, array $chiavi) {
    Carbon::setTestNow(Carbon::parse(SEGNO_ALLE_DODICI));
    $risposta = dalBrowser($metodo, $indirizzo, $corpo)->assertOk();
    $cookie = cookieDelSegno($risposta);
    $valore = (string) valoreDelSegno($risposta);
    $intestazione = (string) collect($risposta->headers->all('set-cookie'))->first(fn (?string $riga) => str_starts_with((string) $riga, Segno::COOKIE.'='));

    expect($cookie)->not->toBeNull()
        ->and($cookie?->getPath())->toBe('/')
        ->and($cookie?->getDomain())->toBeNull()
        ->and($cookie?->isSecure())->toBe(true)
        ->and($cookie?->isHttpOnly())->toBe(true)
        ->and($cookie?->getSameSite())->toBe('lax')
        ->and($cookie?->getExpiresTime())->toBe(Carbon::now()->addMinutes((int) config('session.lifetime'))->getTimestamp())
        // Come il browser lo riceve: gli attributi ci sono tutti, e `Domain` no.
        ->and(array_values(array_filter(explode('; ', $intestazione), fn (string $parte) => ! preg_match('/^(__Host-zr-core-segno|expires|Max-Age)=/', $parte))))
        ->toBe(['path=/', 'secure', 'httponly', 'samesite=lax'])
        // L'istante dato, un punto e la firma: un HMAC-SHA256 in esadecimale.
        ->and($valore)->toMatch('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z\.[0-9a-f]{64}$/')
        ->and(substr($valore, 0, 27))->toBe(SEGNO_ALLE_DODICI)
        ->and($risposta->json($chiavi[0]))->toBe(SEGNO_ALLE_DODICI);
    foreach (['uat-ada', 'UAT Ada', 'uat-ws', 'uat-marketing', 'UAT Marketing', 'az-b'] as $della) {
        expect($valore)->not->toContain($della);
    }
})->with(richiesteColSegno());

it('con la sessione che scade alla chiusura del browser anche il cookie del segno scade alla chiusura (sprint 45 · T2.3)', function () {
    config(['session.expire_on_close' => true]);

    expect(cookieDelSegno(dalBrowser('GET', 'uat-segno/subito')->assertOk())?->getExpiresTime())->toBe(0);
});

it('un cookie che non torna — l\'istante cambiato con la firma di prima, una firma sbagliata, firmato con un\'altra app.key, in un\'altra forma, vuoto — o che manca non vale: il segno è l\'orologio, anche quando il cookie dice un istante più avanti, e la risposta riscrive il cookie con quello (sprint 45 · T2.4; zr-pm, Decisione: 12921)', function (Closure $guasta) {
    Carbon::setTestNow(Carbon::parse(SEGNO_ALLE_DODICI));
    $buono = (string) valoreDelSegno(dalBrowser('GET', 'uat-segno/subito')->assertOk());

    // Quattro minuti indietro: un cookie buono varrebbe (T2.9), e quello che non torna non vale per la firma.
    Carbon::setTestNow(Carbon::parse(SEGNO_QUATTRO_MINUTI_PRIMA));
    $risposta = dalBrowser('GET', 'uat-segno/subito', null, $guasta($buono))->assertOk();

    expect($risposta->json('sessione_il'))->toBe(SEGNO_QUATTRO_MINUTI_PRIMA)
        ->and(substr((string) valoreDelSegno($risposta), 0, 28))->toBe(SEGNO_QUATTRO_MINUTI_PRIMA.'.');
})->with([
    'l\'istante cambiato, la firma di prima' => [fn (string $buono) => '2099-01-01T00:00:00.000000Z'.substr($buono, 27)],
    'un istante di un microsecondo più avanti, la firma di prima' => [fn (string $buono) => '2026-10-14T12:00:00.000001Z'.substr($buono, 27)],
    'la firma sbagliata' => [fn (string $buono) => substr($buono, 0, 28).str_repeat('0', 64)],
    'la firma in maiuscole' => [fn (string $buono) => strtoupper(substr($buono, 0, 28)).strtoupper(substr($buono, 28))],
    'firmato con un\'altra app.key' => [function (string $buono) {
        config(['app.key' => 'base64:'.base64_encode(random_bytes(32))]);

        return $buono;
    }],
    'il solo istante' => [fn (string $buono) => substr($buono, 0, 27)],
    'la sola firma' => [fn (string $buono) => substr($buono, 28)],
    'un istante con sette decimali' => [fn (string $buono) => '2026-10-14T12:00:00.0000000Z'.substr($buono, 27)],
    'qualcosa in coda' => [fn (string $buono) => $buono.'.0'],
    'vuoto' => [fn (string $buono) => ''],
    'mancante' => [fn (string $buono) => null],
]);

it('senza app.key il segno è l\'orologio e non c\'è nessun cookie da scrivere, nemmeno se la richiesta ne porta uno (sprint 45 · T2.4)', function () {
    Carbon::setTestNow(Carbon::parse(SEGNO_ALLE_DODICI));
    $buono = (string) valoreDelSegno(dalBrowser('GET', 'uat-segno/subito')->assertOk());
    app('cookie')->unqueue(Segno::COOKIE);
    config(['app.key' => '']);
    Carbon::setTestNow(Carbon::parse(SEGNO_DIECI_MINUTI_PRIMA));
    request()->attributes->replace([]);
    request()->cookies->set(Segno::COOKIE, $buono);

    expect(Segno::adesso())->toBe(SEGNO_DIECI_MINUTI_PRIMA)
        ->and(app('cookie')->hasQueued(Segno::COOKIE))->toBe(false);
});

it('nella stessa richiesta i segni non vanno indietro, e due letture nello stesso istante hanno lo stesso segno (sprint 45 · T2.5)', function () {
    Route::middleware('web')->get('uat-segno/tre', function () {
        $primo = Segno::adesso();
        $stesso = Segno::adesso();
        Carbon::setTestNow(Carbon::now()->subMinute());
        $dopoIndietro = Segno::adesso();

        return [$primo, $stesso, $dopoIndietro];
    });
    Carbon::setTestNow(Carbon::parse(SEGNO_ALLE_DODICI));

    expect(dalBrowser('GET', 'uat-segno/tre')->assertOk()->json())->toBe([SEGNO_ALLE_DODICI, SEGNO_ALLE_DODICI, SEGNO_ALLE_DODICI]);
});

it('in Cornice::dopo() la lettura e la persona hanno lo stesso segno, e il cookie anche, quando l\'orologio torna indietro mentre io.mostra risponde (sprint 45 · T2.5)', function () {
    Carbon::setTestNow(Carbon::parse(SEGNO_ALLE_DODICI));
    segnoDalBackoffice(fn () => Carbon::setTestNow(Carbon::now()->subMinute()));
    $risposta = dalBrowser('GET', 'uat-segno/dopo')->assertOk();

    expect([$risposta->json('aggiornati_il'), $risposta->json('sessione_il')])->toBe([SEGNO_ALLE_DODICI, SEGNO_ALLE_DODICI])
        ->and($risposta->json('lingua'))->toBe('en')
        ->and(substr((string) valoreDelSegno($risposta), 0, 27))->toBe(SEGNO_ALLE_DODICI);
});

it('il caso della review: Ada ha l\'ultima pagina da un nodo avanti, Grace entra su un nodo quattro minuti indietro, e il segno della pagina di Grace è più avanti di quello della pagina di Ada, non uguale (sprint 45 · T2.8; zr-pm, Decisione: 12931)', function () {
    Carbon::setTestNow(Carbon::parse(SEGNO_ALLE_DODICI));
    $ada = dalBrowser('GET', 'uat-segno/subito')->assertOk();

    // Ada esce ed entra Grace, nello stesso browser: il cookie del segno resta, la sessione è un'altra.
    Carbon::setTestNow(Carbon::parse(SEGNO_QUATTRO_MINUTI_PRIMA));
    sessioneAMano(['id' => 'uat-ws', 'nome' => 'UAT Marketing', 'slug' => 'uat-marketing'], 'en', ['id' => 'uat-grace', 'nome' => 'UAT Grace', 'email' => 'uat-grace@example.com']);
    $grace = dalBrowser('GET', 'uat-segno/subito', null, valoreDelSegno($ada))->assertOk();

    expect([$ada->json('persona.email'), $grace->json('persona.email')])->toBe(['uat-ada@example.com', 'uat-grace@example.com'])
        ->and([$ada->json('sessione_il'), $grace->json('sessione_il')])->toBe([SEGNO_ALLE_DODICI, '2026-10-14T12:00:00.000001Z']);
});

/** Il log dell'app in memoria, e le righe d'avviso che vi restano. */
function segnoLogInMemoria(): void
{
    config(['logging.default' => 'segno-in-memoria', 'logging.channels.segno-in-memoria' => ['driver' => 'monolog', 'handler' => TestHandler::class]]);
}

/** @return list<array{string, array<array-key, mixed>}> gli avvisi del log in memoria, col loro contesto */
function segnoAvvisiNelLog(): array
{
    $righe = [];
    foreach (Log::channel('segno-in-memoria')->getLogger()->getHandlers()[0]->getRecords() as $riga) {
        if ($riga->level === Level::Warning) {
            $righe[] = [$riga->message, $riga->context];
        }
    }

    return $righe;
}

it('un cookie firmato bene ma più di cinque minuti avanti dell\'orologio non vale: il segno è l\'orologio, la risposta riscrive il cookie con quello, e nel log resta un avviso che non dice l\'istante del cookie (sprint 45 · T2.9; zr-pm, Decisione: 12931)', function (string $avanti, string $istante) {
    segnoLogInMemoria();
    // Un nodo con l'orologio avanti dà il cookie, firmato bene. La sessione si apre col suo orologio: quella delle 11:30 nel
    // 2099 è scaduta, e zr-auth risponderebbe 401.
    Carbon::setTestNow(Carbon::parse($avanti, 'UTC'));
    sessioneAMano(['id' => 'uat-ws', 'nome' => 'UAT Marketing', 'slug' => 'uat-marketing']);
    $buono = (string) valoreDelSegno(dalBrowser('GET', 'uat-segno/solo')->assertOk());
    expect(substr($buono, 0, 27))->toBe($istante);

    Carbon::setTestNow(Carbon::parse(SEGNO_ALLE_DODICI));
    $risposta = dalBrowser('GET', 'uat-segno/solo', null, $buono)->assertOk();
    $avvisi = segnoAvvisiNelLog();

    expect($risposta->json())->toBe([SEGNO_ALLE_DODICI])
        ->and(substr((string) valoreDelSegno($risposta), 0, 28))->toBe(SEGNO_ALLE_DODICI.'.')
        ->and(count($avvisi))->toBe(1)
        ->and($avvisi[0][0])->toContain('zr-core')
        ->and((string) json_encode($avvisi))->not->toContain(substr($istante, 0, 16))
        ->and((string) json_encode($avvisi))->not->toContain(substr($buono, 28, 16));
})->with([
    'sei minuti avanti' => ['2026-10-14 12:06:00', '2026-10-14T12:06:00.000000Z'],
    'cinque minuti e un microsecondo avanti' => ['2026-10-14 12:05:00.000001', '2026-10-14T12:05:00.000001Z'],
    'nel 2099' => ['2099-01-01 00:00:00', '2099-01-01T00:00:00.000000Z'],
]);

it('un cookie firmato bene cinque minuti esatti avanti dell\'orologio vale ancora: il segno è il suo più un microsecondo, senza avvisi (sprint 45 · T2.9)', function () {
    segnoLogInMemoria();
    Carbon::setTestNow(Carbon::parse('2026-10-14 12:05:00', 'UTC'));
    $buono = valoreDelSegno(dalBrowser('GET', 'uat-segno/solo')->assertOk());

    Carbon::setTestNow(Carbon::parse(SEGNO_ALLE_DODICI));

    expect(dalBrowser('GET', 'uat-segno/solo', null, $buono)->assertOk()->json())->toBe(['2026-10-14T12:05:00.000001Z'])
        ->and(segnoAvvisiNelLog())->toBe([]);
});
