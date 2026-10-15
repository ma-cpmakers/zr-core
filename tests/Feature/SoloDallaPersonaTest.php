<?php

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Zeiras\Auth\Persona;

// Sprint 59 · T1 (voce #2143; Decisione di zr-pm del 15/10, nota 13633): dalla 0.12.41 zr-auth mette nel gruppo `web`, dopo la
// guardia, `SoloDallaPersona` («Resta poi Salva», #2136), acceso da `zr-auth.persona.controllo`: una scrittura vale solo se
// porta in `X-Zr-Persona` l'impronta della persona della sessione. La cornice non la manda — dice la persona nell'intestazione
// `Persona`, e la confronta StessaPersona —: le rotte `cornice/*` escono da SoloDallaPersona e restano sotto StessaPersona.

const WORKSPACE_COL_CONTROLLO = ['id' => 'uat-ws', 'nome' => 'UAT Marketing', 'slug' => 'uat-marketing'];
/** Ciò che serve a ognuna delle scritture della cornice per arrivare al backoffice: ogni rotta legge le chiavi sue. */
const CORPO_DI_OGNI_SCRITTURA = ['letta' => true, 'q' => 'uat', 'fino_a' => '2026-10-08T10:00:00.123Z', 'workspace' => 'uat-marketing'];

/**
 * Le rotte della cornice che non sono GET, lette dal router, con un id al posto di un parametro: SoloDallaPersona lascia
 * passare GET, HEAD e OPTIONS, e una rotta di scrittura nuova sotto `cornice/` entra da sé in questi casi.
 *
 * @return list<array{string, string}>
 */
function scrittureDellaCornice(): array
{
    return collect(Route::getRoutes()->getRoutes())
        ->filter(fn ($rotta) => str_starts_with($rotta->uri(), 'cornice/') && ! in_array('GET', $rotta->methods(), true))
        ->map(fn ($rotta) => [$rotta->methods()[0], '/'.preg_replace('/\{[^}]+\}/', 'uat-n3', $rotta->uri())])
        ->values()->all();
}

beforeEach(function (): void {
    config(['zr-auth.persona.controllo' => true]);
});

it('con `zr-auth.persona.controllo` acceso ogni scrittura della cornice, letta dal router, con la persona della sessione in `Persona` e senza `X-Zr-Persona`, arriva al backoffice: SoloDallaPersona non la ferma (sprint 59 · T1.1)', function () {
    sessioneAMano(WORKSPACE_COL_CONTROLLO);
    Http::fake();

    $scritture = scrittureDellaCornice();
    expect(array_column($scritture, 1))->toContain('/cornice/ricerca', '/cornice/notifiche/letture', '/cornice/notifiche/uat-n3/lettura');

    foreach ($scritture as [$metodo, $indirizzo]) {
        $prima = Http::recorded()->count();
        $avuta = test()->json($metodo, $indirizzo, CORPO_DI_OGNI_SCRITTURA);

        // Il backoffice finto risponde un 200 vuoto, e la rotta ne fa un suo errore: qui conta solo che lo abbia chiamato.
        expect(Http::recorded()->count())->toBeGreaterThan($prima, "{$metodo} {$indirizzo}")
            ->and($avuta->getContent())->not->toContain('persona_diversa');
    }
});

it('con l\'interruttore acceso una scrittura della cornice che dice una persona che non è quella della sessione riceve il 409 di StessaPersona, `persona` vuota compresa, anche con l\'`X-Zr-Persona` giusta, e il backoffice non è chiamato (sprint 59 · T1.2)', function (bool $conLImpronta) {
    sessioneAMano(WORKSPACE_COL_CONTROLLO);
    Http::fake();
    $intestazioni = ['Persona' => 'uat-grace%40example.com'] + ($conLImpronta ? [Persona::INTESTAZIONE => (string) Persona::impronta()] : []);

    expect(Persona::impronta())->not->toBeNull();
    foreach (scrittureDellaCornice() as [$metodo, $indirizzo]) {
        $avuta = test()->withHeaders($intestazioni)->json($metodo, $indirizzo, CORPO_DI_OGNI_SCRITTURA);

        expect($avuta->getStatusCode())->toBe(409, "{$metodo} {$indirizzo}")
            ->and($avuta->getContent())->toBe('{"errore":"persona_diversa","persona":""}');
    }
    Http::assertNothingSent();
})->with([
    'con l\'impronta della persona della sessione' => [true],
    'senza l\'impronta' => [false],
]);

it('con l\'interruttore acceso una scrittura del frontend nel gruppo `web`, fuori da `cornice/`, resta sotto SoloDallaPersona: senza `X-Zr-Persona` 409, con l\'impronta della sessione passa (sprint 59 · T1.3)', function () {
    Route::middleware('web')->post('uat-scrittura-del-frontend', fn () => response()->json(['scritta' => true]));
    sessioneAMano(WORKSPACE_COL_CONTROLLO);

    $senza = test()->postJson('/uat-scrittura-del-frontend');
    $con = test()->withHeader(Persona::INTESTAZIONE, (string) Persona::impronta())->postJson('/uat-scrittura-del-frontend');

    expect($senza->getStatusCode())->toBe(409)
        ->and($senza->getContent())->toBe('{"errore":"persona_diversa"}')
        ->and($con->getStatusCode())->toBe(200)
        ->and($con->getContent())->toBe('{"scritta":true}');
});

it('il README dice da quale versione zr-core chiede la 0.12.41 e perché, e che con zr-core dalla `v2.19.0` il frontend può accendere `ZR_AUTH_PERSONA_CONTROLLO` (sprint 59 · T1.4)', function (string $frase) {
    $readme = trim((string) preg_replace('/\s+/', ' ', (string) file_get_contents(__DIR__.'/../../README.md')));

    expect(substr_count($readme, $frase))->toBe(1);
})->with([
    'il vincolo' => ['Dalla `v2.19.0` serve la 0.12.41: le rotte della cornice escono da `SoloDallaPersona`, che c\'è da quella (vedi «Le rotte della cornice»), e con una più vecchia Composer lascia zr-core alla `v2.18.0`.'],
    'l\'interruttore' => ['Dalla `v2.19.0` le rotte della cornice stanno fuori da `SoloDallaPersona` di zr-auth («Resta poi Salva»): il frontend può accendere `ZR_AUTH_PERSONA_CONTROLLO`, e la ricerca e le letture della cornice non chiedono `X-Zr-Persona`.'],
    'chi le protegge' => ['Le protegge `StessaPersona`, che confronta la persona della pagina con quella della sessione prima della rotta'],
    'solo le sue' => ['L\'uscita è delle sole rotte `cornice/*`: le scritture del frontend nel gruppo `web` restano sotto `SoloDallaPersona`.'],
    'l\'ordine' => ['Con zr-core fino alla `v2.18` l\'interruttore acceso dà 409 alla ricerca e alle letture della cornice: prima si aggiorna zr-core, poi si accende.'],
]);
