<?php

use Zeiras\Auth\Sessione;
use Zeiras\Core\Cornice;

// v4.32.0 (voce #3686, decisione di zr-pm-97, 12/11). All'ospite di un workspace la cornice mostra nel menu Moduli i soli moduli che
// app.elenca gli dà: i dati portano `ospite: true` quando il ruolo della sessione è `ospite`, e il ruolo non esce. Gli aiuti
// (backoffice(), marketing()) vengono da CorniceDatiTest.php.

/** Rientra nel workspace di prova col ruolo dato, con lo stesso gettone e la stessa persona. */
function conIlRuolo(string $ruolo): void
{
    $gettoni = sessioneAMano(marketing());
    Sessione::entra(['gettone' => $gettoni['workspace'], 'scade_il' => now()->addHour()->toIso8601String(), 'utente' => Sessione::utente(), 'workspace' => marketing(), 'ruolo' => $ruolo]);
}

it('con il ruolo `ospite` i dati portano `ospite: true`, dopo `non_lette` e prima di `aggiornati_il`, in dati() e in dopo(); il ruolo non esce (voce 3686)', function () {
    conIlRuolo('ospite');
    backoffice();

    $dati = Cornice::dati();

    expect(array_keys($dati))->toBe(['lingua', 'persona', 'workspace', 'prodotti', 'aziende', 'non_lette', 'ospite', 'aggiornati_il'])
        ->and($dati['ospite'])->toBeTrue()
        ->and(Cornice::dopo()['ospite'] ?? null)->toBeTrue()
        ->and((string) json_encode($dati))->not->toContain('"ruolo"');
});

it('per proprietario, amministratore e membro la chiave `ospite` non c\'è, nemmeno false: i dati sono quelli di prima (voce 3686)', function (string $ruolo) {
    conIlRuolo($ruolo);
    backoffice();

    expect(Cornice::dati())->not->toHaveKey('ospite');
})->with(['proprietario', 'amministratore', 'membro']);
