<?php

use Illuminate\Contracts\Http\Kernel as HttpKernel;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Monolog\Handler\TestHandler;
use Monolog\Level;
use Zeiras\Core\Http\HostFidati;
use Zeiras\Core\Http\IntestazioniSicurezza;

// Sprint 29 · T1 (voce #1854). Un frontend risponde solo alle richieste per il suo nome: l'host di `app.url`, intero. Il
// middleware lo registra il frontend, con la riga del README: i casi la leggono da lì e la danno a Laravel come fa
// `bootstrap/app.php`, così ciò che è provato è la riga che un modulo copia. L'intestazione `Host` di ogni richiesta è
// scritta così com'è: i metodi dei test di Laravel la ricaverebbero dall'indirizzo.

const HOST_DEL_MODULO = 'app.example.test';

/** Il corpo del rifiuto, per intero: è fisso, e di ciò che la richiesta porta non ripete niente. */
const CORPO_DEL_RIFIUTO = 'Bad Request';

// I proxy fidati di Laravel e di Symfony stanno in proprietà statiche: un caso che li dichiara li lascerebbe al caso dopo.
afterEach(function () {
    TrustProxies::flushState();
    Request::setTrustedProxies([], Request::HEADER_X_FORWARDED_FOR);
});

/** L'`app.url` del frontend finto, e il log in memoria: un canale vero di Laravel, con un registro di Monolog che tiene le righe. */
function moduloConIndirizzo(mixed $indirizzo = 'https://'.HOST_DEL_MODULO): void
{
    config([
        'app.url' => $indirizzo,
        // Senza il dettaglio dell'errore: una risposta d'errore di Laravel è quella di produzione.
        'app.debug' => false,
        'logging.default' => 'host-in-memoria',
        'logging.channels.host-in-memoria' => ['driver' => 'monolog', 'handler' => TestHandler::class],
    ]);
}

/** @return list<string> gli avvisi scritti nel log in memoria, nell'ordine */
function avvisiSugliHost(): array
{
    $righe = [];
    foreach (Log::channel('host-in-memoria')->getLogger()->getHandlers()[0]->getRecords() as $riga) {
        if ($riga->level === Level::Warning) {
            $righe[] = $riga->message;
        }
    }

    return $righe;
}

/** Una pagina del frontend finto, fuori da ogni gruppo, che conta quante volte il suo controller gira. */
function paginaCheConta(): ArrayObject
{
    $giri = new ArrayObject(['controller' => 0]);
    Route::get('/prova/host', function () use ($giri) {
        $giri['controller']++;

        return 'la pagina del modulo';
    });

    return $giri;
}

/**
 * Le righe con cui il README registra i middleware, nel punto «Gli host fidati»: `$middleware->prepend(…)` e
 * `$middleware->append(…)`, nell'ordine in cui stanno scritte.
 *
 * @return list<array{0: string, 1: string}> il metodo e la classe
 */
function righeDelReadmeSugliHost(): array
{
    $readme = File::get(__DIR__.'/../../README.md');
    if (! str_contains($readme, "\n## Gli host fidati\n")) {
        throw new RuntimeException('il README non ha il punto «Gli host fidati»');
    }
    $punto = Str::before(Str::after($readme, "\n## Gli host fidati\n"), "\n## ");
    if (preg_match('/```php\n(.*?)```/s', $punto, $blocco) !== 1) {
        throw new RuntimeException('il punto «Gli host fidati» non ha un blocco di codice');
    }
    preg_match_all('/^\s*\$middleware->(prepend|append)\(\\\\(Zeiras\\\\Core\\\\Http\\\\\w+)::class\);$/m', $blocco[1], $righe, PREG_SET_ORDER);

    return array_map(fn (array $riga) => [$riga[1], $riga[2]], $righe);
}

/**
 * Registra i middleware come dice il README: le sue righe, date a Laravel come in `bootstrap/app.php`, e i globali del
 * frontend finto diventano quelli che Laravel ne compone. `$delModulo` è ciò che un modulo scrive in più nello stesso
 * blocco (i proxy fidati).
 *
 * @return list<string> i middleware globali, dal più esterno
 */
function registratiComeDiceIlReadme(?Closure $delModulo = null): array
{
    $middleware = new Middleware;
    foreach (righeDelReadmeSugliHost() as [$metodo, $classe]) {
        $middleware->{$metodo}($classe);
    }
    if ($delModulo !== null) {
        $delModulo($middleware);
    }
    $globali = $middleware->getGlobalMiddleware();
    app(HttpKernel::class)->setGlobalMiddleware($globali);

    return $globali;
}

/**
 * Una richiesta alla pagina di prova, con l'intestazione `Host` scritta così com'è e le altre intestazioni che il caso
 * aggiunge (`HTTP_X_FORWARDED_HOST`); chi chiama è 127.0.0.1.
 *
 * @param  array<string, string>  $altre
 */
function richiestaConHost(string $host, array $altre = []): TestResponse
{
    return TestResponse::fromBaseResponse(
        app(HttpKernel::class)->handle(Request::create('/prova/host', 'GET', server: ['HTTP_HOST' => $host, ...$altre])),
    );
}

it('una richiesta per l’host di app.url passa, comunque sia scritto: maiuscole e porta non contano (sprint 29 · T1.1)', function (string $indirizzo, string $host) {
    moduloConIndirizzo($indirizzo);
    $giri = paginaCheConta();
    registratiComeDiceIlReadme();

    $risposta = richiestaConHost($host);

    expect($risposta->getStatusCode())->toBe(200)
        ->and($risposta->getContent())->toBe('la pagina del modulo')
        ->and($giri['controller'])->toBe(1)
        ->and(avvisiSugliHost())->toBe([]);
})->with([
    'lo stesso' => ['https://app.example.test', 'app.example.test'],
    'in maiuscole' => ['https://app.example.test', 'APP.Example.Test'],
    'con una porta' => ['https://app.example.test', 'app.example.test:8443'],
    'con la porta di https' => ['https://app.example.test', 'app.example.test:443'],
    'app.url in maiuscole' => ['https://APP.Example.Test', 'app.example.test'],
    'app.url con porta e percorso' => ['https://app.example.test:8443/percorso', 'app.example.test'],
    'app.url in http' => ['http://app.example.test', 'app.example.test:80'],
]);

it('con un host che non è quello del modulo la risposta è 400 col corpo fisso e il controller non gira, in ogni ambiente (sprint 29 · T1.2)', function (string $ambiente, string $host) {
    moduloConIndirizzo();
    app()->detectEnvironment(fn () => $ambiente);
    $giri = paginaCheConta();
    registratiComeDiceIlReadme();

    $risposta = richiestaConHost($host);

    expect(app()->environment())->toBe($ambiente)
        ->and(app()->runningUnitTests())->toBe($ambiente === 'testing')
        ->and($risposta->getStatusCode())->toBe(400)
        ->and($risposta->getContent())->toBe(CORPO_DEL_RIFIUTO)
        ->and($risposta->headers->get('Content-Type'))->toStartWith('text/plain')
        ->and($giri['controller'])->toBe(0);
})->with(['testing', 'local', 'production'])->with(['evil.example', 'evil.example:8443']);

it('prendono 400 anche un sottodominio, un suffisso, un prefisso e ogni altro nome che non è quello intero (sprint 29 · T1.3)', function (string $host) {
    moduloConIndirizzo();
    $giri = paginaCheConta();
    registratiComeDiceIlReadme();

    $risposta = richiestaConHost($host);

    expect($risposta->getStatusCode())->toBe(400)
        ->and($risposta->getContent())->toBe(CORPO_DEL_RIFIUTO)
        ->and($giri['controller'])->toBe(0);
})->with([
    'un sottodominio' => ['x.app.example.test'],
    'un suffisso' => ['app.example.test.evil.example'],
    'un prefisso' => ['evilapp.example.test'],
    'il dominio sopra' => ['example.test'],
    'un pezzo in meno' => ['app.example.tes'],
    'col punto in fondo' => ['app.example.test.'],
    'localhost' => ['localhost'],
    'un indirizzo IP' => ['127.0.0.1'],
    'un indirizzo IP con la porta' => ['127.0.0.1:8000'],
]);

it('un host con caratteri non validi prende 400, non 500, e il controller non gira (sprint 29 · T1.4)', function (string $host, bool $soloIlMiddleware) {
    moduloConIndirizzo();
    $giri = paginaCheConta();
    if ($soloIlMiddleware) {
        // Un modulo senza gli altri globali di Laravel: l'eccezione di getHost() nasce nel middleware, ed è lui a prenderla.
        app(HttpKernel::class)->setGlobalMiddleware([HostFidati::class]);
    } else {
        registratiComeDiceIlReadme();
    }

    $risposta = richiestaConHost($host);

    expect($risposta->getStatusCode())->toBe(400)
        ->and($risposta->getContent())->not->toContain('ev<il>')->not->toContain('evil.example')
        ->and($giri['controller'])->toBe(0)
        ->and(implode("\n", avvisiSugliHost()))->not->toContain('ev<il>')->not->toContain('evil.example');
    if ($soloIlMiddleware) {
        expect($risposta->getContent())->toBe(CORPO_DEL_RIFIUTO)
            ->and(avvisiSugliHost())->toHaveCount(1);
    }
})->with([
    'ev<il>.example',
    'app.example.test@evil.example',
    'app.example.test/evil.example',
])->with(['registrato come dice il README' => false, 'il solo middleware' => true]);

it('conta l’host che l’app userebbe per scrivere i suoi indirizzi: quello di un proxy fidato dal modulo sì, quello di chiunque altro no (sprint 29 · T1.5)', function () {
    moduloConIndirizzo();
    $giri = paginaCheConta();

    // Senza proxy fidati, come i tre frontend di oggi: X-Forwarded-Host non conta.
    registratiComeDiceIlReadme();
    expect(richiestaConHost(HOST_DEL_MODULO, ['HTTP_X_FORWARDED_HOST' => 'evil.example'])->getStatusCode())->toBe(200)
        ->and($giri['controller'])->toBe(1);

    // Un proxy fidato che non è chi chiama: lo stesso.
    registratiComeDiceIlReadme(fn (Middleware $middleware) => $middleware->trustProxies(at: '10.0.0.1'));
    expect(richiestaConHost(HOST_DEL_MODULO, ['HTTP_X_FORWARDED_HOST' => 'evil.example'])->getStatusCode())->toBe(200)
        ->and($giri['controller'])->toBe(2);

    // Chi chiama è un proxy fidato: l'host dell'app è quello che dice lui.
    registratiComeDiceIlReadme(fn (Middleware $middleware) => $middleware->trustProxies(at: '*'));
    $rifiutata = richiestaConHost(HOST_DEL_MODULO, ['HTTP_X_FORWARDED_HOST' => 'evil.example']);
    expect($rifiutata->getStatusCode())->toBe(400)
        ->and($rifiutata->getContent())->toBe(CORPO_DEL_RIFIUTO)
        ->and($giri['controller'])->toBe(2)
        ->and(richiestaConHost('interno.example', ['HTTP_X_FORWARDED_HOST' => HOST_DEL_MODULO])->getStatusCode())->toBe(200)
        ->and($giri['controller'])->toBe(3);
});

it('un rifiuto lascia nel log un avviso con l’host atteso e mai quello ricevuto (sprint 29 · T1.6)', function (string $host, array $altre) {
    moduloConIndirizzo();
    paginaCheConta();
    registratiComeDiceIlReadme(fn (Middleware $middleware) => $middleware->trustProxies(at: '*'));

    expect(richiestaConHost($host, $altre)->getStatusCode())->toBe(400)
        ->and(avvisiSugliHost())->toHaveCount(1)
        ->and(avvisiSugliHost()[0])->toContain('HostFidati')->toContain(HOST_DEL_MODULO)->not->toContain('evil');
})->with([
    'nell’intestazione Host' => ['evil.example', []],
    'in X-Forwarded-Host' => [HOST_DEL_MODULO, ['HTTP_X_FORWARDED_HOST' => 'evil.example']],
    'un suffisso' => ['app.example.test.evil.example', []],
]);

it('se app.url non ha un host il middleware non rifiuta niente e lo scrive nel log a ogni richiesta, senza dati della richiesta (sprint 29 · T1.7)', function (mixed $indirizzo) {
    moduloConIndirizzo($indirizzo);
    $giri = paginaCheConta();
    registratiComeDiceIlReadme();

    expect(richiestaConHost('evil.example')->getStatusCode())->toBe(200)
        ->and(richiestaConHost('altro.example')->getStatusCode())->toBe(200)
        ->and($giri['controller'])->toBe(2)
        ->and(avvisiSugliHost())->toHaveCount(2)
        ->and(avvisiSugliHost()[0])->toBe(avvisiSugliHost()[1])
        ->and(avvisiSugliHost()[0])->toContain('HostFidati')->toContain('APP_URL')->not->toContain('evil')->not->toContain('/prova/host');
})->with([
    'vuoto' => [''],
    'null' => [null],
    'senza lo schema' => ['app.example.test'],
    'solo lo schema' => ['https://'],
    'solo un percorso' => ['/percorso'],
    'non leggibile' => ['http:///percorso'],
    'un numero' => [7],
]);

it('zr-core non lo registra da sé: col solo pacchetto una richiesta con un altro host passa (sprint 29 · T1.8)', function () {
    moduloConIndirizzo();
    $giri = paginaCheConta();
    $kernel = app(HttpKernel::class);
    $delleRotte = collect(Route::getRoutes()->getRoutes())->flatMap(fn ($rotta) => $rotta->gatherMiddleware())->all();

    expect($kernel->hasMiddleware(HostFidati::class))->toBeFalse()
        ->and(Arr::flatten($kernel->getMiddlewareGroups()))->not->toContain(HostFidati::class)
        ->and($delleRotte)->not->toContain(HostFidati::class)
        ->and(richiestaConHost('evil.example')->getStatusCode())->toBe(200)
        ->and($giri['controller'])->toBe(1)
        ->and(avvisiSugliHost())->toBe([]);
});

it('registrato come dice il README insieme a IntestazioniSicurezza, il 400 porta le intestazioni di sicurezza (sprint 29 · T1.9)', function () {
    moduloConIndirizzo();
    paginaCheConta();

    $globali = registratiComeDiceIlReadme();

    // Le due righe del README, e dove Laravel le mette: le intestazioni fuori da tutto, gli host dopo i proxy fidati.
    expect(righeDelReadmeSugliHost())->toHaveCount(2)
        ->and(array_column(righeDelReadmeSugliHost(), 1))->toEqualCanonicalizing([IntestazioniSicurezza::class, HostFidati::class])
        ->and($globali[0])->toBe(IntestazioniSicurezza::class)
        ->and(array_search(HostFidati::class, $globali, true))->toBeGreaterThan(array_search(TrustProxies::class, $globali, true));

    $rifiutata = richiestaConHost('evil.example');
    $passata = richiestaConHost(HOST_DEL_MODULO);

    expect($rifiutata->getStatusCode())->toBe(400)
        ->and($rifiutata->getContent())->toBe(CORPO_DEL_RIFIUTO)
        ->and($passata->getStatusCode())->toBe(200);
    foreach ([$rifiutata, $passata] as $risposta) {
        expect($risposta->headers->get('X-Content-Type-Options'))->toBe('nosniff')
            ->and($risposta->headers->get('Strict-Transport-Security'))->toBe('max-age=31536000')
            ->and($risposta->headers->has('Content-Security-Policy'))->toBeTrue();
    }
});
