<?php

use Illuminate\Support\Facades\Http;
use Zeiras\Auth\Persona;
use Zeiras\Core\Cornice;

// Sprint 60 · T1 (voce #2144; S1 della revisione di sicurezza della PR #95, Decisioni di zr-pm del 15/10, note 13646 e 13648):
// StessaPersona confronta l'email, e un'email può passare da un account a un altro. I dati della cornice portano l'impronta di
// zr-auth (`Persona::impronta()`, un HMAC dell'id: né l'id né niente di nuovo), la cornice la manda in `X-Zr-Persona`, e
// StessaPersona la confronta con quella della sessione quando la richiesta la dice e la sessione ne ha una.

const ADA_IN_UN_ALTRO_ACCOUNT = ['id' => 'uat-ada-2'];

it('Cornice::subito() e Cornice::ridotta() portano in `persona` nome, email e l\'impronta di zr-auth della persona della sessione, e nient\'altro: non l\'id (sprint 60 · T1.1)', function () {
    sessioneAMano(WORKSPACE_DELLA_PERSONA);

    foreach (['subito' => Cornice::subito(), 'ridotta' => Cornice::ridotta()] as $quale => $dati) {
        expect($dati['persona'] ?? null)->toBe(['nome' => 'UAT Ada', 'email' => 'uat-ada@example.com', 'impronta' => improntaDi('uat-ada')], $quale)
            ->and($dati['persona']['impronta'] ?? null)->toBe(Persona::impronta())->toMatch('/^[0-9a-f]{32}$/')
            ->and(json_encode($dati))->not->toContain('uat-ada"');
    }
});

it('con una sessione senza id l\'impronta nei dati è null (sprint 60 · T1.1)', function () {
    sessioneAMano(WORKSPACE_DELLA_PERSONA, 'en', ['id' => null]);

    expect(Persona::impronta())->toBeNull()
        ->and(Cornice::subito()['persona'] ?? null)->toBe(['nome' => 'UAT Ada', 'email' => 'uat-ada@example.com', 'impronta' => null]);
});

it('una richiesta con l\'email della sessione e l\'impronta di un\'altra persona con la stessa email riceve da ogni rotta della cornice 409 persona_diversa con `persona` vuota, e il backoffice non è chiamato (sprint 60 · T1.2)', function (array $corpo) {
    // L'impronta della persona di prima: la stessa email, un altro account.
    sessioneAMano(WORKSPACE_DELLA_PERSONA, 'en', ADA_IN_UN_ALTRO_ACCOUNT);
    $diPrima = (string) Persona::impronta();
    sessioneAMano(WORKSPACE_DELLA_PERSONA);
    Http::fake();

    expect($diPrima)->not->toBe((string) Persona::impronta())
        ->and(rotteDellaCorniceDalRouter())->not->toBeEmpty();
    foreach (rotteDellaCorniceDalRouter() as [$metodo, $indirizzo]) {
        $avuta = allaCornice($metodo, $indirizzo, $corpo, ['Persona' => 'uat-ada%40example.com', Persona::INTESTAZIONE => $diPrima]);

        expect($avuta->getStatusCode())->toBe(409, "{$metodo} {$indirizzo}")
            ->and($avuta->getContent())->toBe('{"errore":"persona_diversa","persona":""}');
    }
    Http::assertNothingSent();
})->with([
    'la persona nell\'intestazione' => [[]],
    'la persona anche nel corpo' => [['persona' => 'uat-ada@example.com']],
]);

it('un\'impronta detta che non è proprio quella della sessione è il 409 su ogni rotta della cornice, come la legge SoloDallaPersona: con le maiuscole, ripetuta con un\'altra, o un testo qualunque (sprint 60 · T1.2; sicurezza della PR #96, S4)', function (string $come) {
    sessioneAMano(WORKSPACE_DELLA_PERSONA);
    Http::fake();
    $detta = match ($come) {
        'maiuscole' => strtoupper((string) Persona::impronta()),
        'ripetuta' => Persona::impronta().', '.str_repeat('0', 32),
        'testo' => 'uat',
        default => '',
    };

    foreach (rotteDellaCorniceDalRouter() as [$metodo, $indirizzo]) {
        $avuta = allaCornice($metodo, $indirizzo, [], ['Persona' => 'uat-ada%40example.com', Persona::INTESTAZIONE => $detta]);

        expect($avuta->getStatusCode())->toBe(409, "{$metodo} {$indirizzo}")
            ->and($avuta->getContent())->toBe('{"errore":"persona_diversa","persona":""}');
    }
    Http::assertNothingSent();
})->with(['maiuscole', 'ripetuta', 'testo']);

it('con una sessione che ha un\'impronta, una richiesta con l\'email della sessione che non dice l\'impronta — senza `X-Zr-Persona`, coi testi `undefined` o `null`, o con quella giusta ripetuta insieme a `undefined` — riceve da ogni rotta della cornice 409 persona_diversa con `persona` vuota, e il backoffice non è chiamato (sprint 62 · T1.1, T1.2)', function (?string $detta) {
    sessioneAMano(WORKSPACE_DELLA_PERSONA);
    Http::fake();
    $intestazioni = $detta === null ? [] : [Persona::INTESTAZIONE => str_replace('{giusta}', (string) Persona::impronta(), $detta)];
    if ($detta === null) {
        test()->withoutHeader(Persona::INTESTAZIONE);
    }

    expect(Persona::impronta())->not->toBeNull()
        ->and(rotteDellaCorniceDalRouter())->not->toBeEmpty();
    foreach (rotteDellaCorniceDalRouter() as [$metodo, $indirizzo]) {
        $avuta = allaCornice($metodo, $indirizzo, [], ['Persona' => 'uat-ada%40example.com'] + $intestazioni);

        expect($avuta->getStatusCode())->toBe(409, "{$metodo} {$indirizzo}")
            ->and($avuta->getContent())->toBe('{"errore":"persona_diversa","persona":""}');
    }
    Http::assertNothingSent();
})->with([
    'senza X-Zr-Persona (T1.1)' => [null],
    'il testo `undefined` (T1.2)' => ['undefined'],
    'il testo `null` (T1.2)' => ['null'],
    'quella giusta ripetuta con `undefined` (T1.2)' => ['{giusta}, undefined'],
]);

it('con l\'impronta della sessione la richiesta con l\'email della sessione arriva al backoffice da ogni rotta della cornice; con una sessione senza impronta (senza id) anche senza `X-Zr-Persona` o con un testo qualunque (sprint 60 · T1.2; sprint 62 · T1.3)', function (array $diversa, ?string $impronta) {
    sessioneAMano(WORKSPACE_DELLA_PERSONA, 'en', $diversa);
    Http::fake();
    $intestazioni = ['Persona' => 'uat-ada%40example.com'] + match ($impronta) {
        null => [],
        'della sessione' => [Persona::INTESTAZIONE => (string) Persona::impronta()],
        default => [Persona::INTESTAZIONE => $impronta],
    };
    if ($impronta === null) {
        test()->withoutHeader(Persona::INTESTAZIONE);
    }

    foreach (rotteDellaCorniceDalRouter() as [$metodo, $indirizzo]) {
        $prima = Http::recorded()->count();
        $avuta = allaCornice($metodo, $indirizzo, [], $intestazioni);

        expect(Http::recorded()->count())->toBeGreaterThan($prima, "{$metodo} {$indirizzo}")
            ->and($avuta->getContent())->not->toContain('persona_diversa');
    }
})->with([
    'l\'impronta della sessione' => [[], 'della sessione'],
    'la sessione senza id e senza X-Zr-Persona (T1.3)' => [['id' => null], null],
    'la sessione senza id e il testo `undefined` (T1.3)' => [['id' => null], 'undefined'],
    'la sessione senza id e un\'impronta qualunque (T1.3)' => [['id' => null], str_repeat('0', 32)],
]);

// Sprint 62 · T2.1 (voce #2152, Decisione di zr-pm 13852): dalla `v2.21.0` senza l'impronta è il 409, e il README dice che è
// il cambio che rompe chi costruisce `persona` da sé senza `impronta`; non dice più che senza l'impronta decide l'email.
it('il README dice che dalla `v2.21.0`, con la sessione che ha un\'impronta, una richiesta che non la dice riceve il 409, e che rompe chi costruisce `persona` senza `impronta`; non dice più che decide l\'email (sprint 62 · T2.1)', function () {
    $readme = trim((string) preg_replace('/\s+/', ' ', (string) file_get_contents(__DIR__.'/../../README.md')));

    expect(str_contains($readme, 'dalla `v2.21.0`, con la sessione che ha un\'impronta, riceve lo stesso 409 `{errore: "persona_diversa", persona: ""}`, come da `SoloDallaPersona` di zr-auth'))->toBe(true)
        ->and(str_contains($readme, 'Senza, dalla `v2.21.0` ogni richiesta della sua cornice riceve il 409 e la pagina si ricarica'))->toBe(true)
        ->and(str_contains($readme, 'è il cambio che rompe chi non manda l\'impronta'))->toBe(true)
        ->and(str_contains($readme, 'vale come fino alla `v2.19` (decide l\'email)'))->toBe(false)
        ->and(str_contains($readme, 'altrimenti la sua cornice resta protetta solo dall\'email'))->toBe(false);
});
