<?php

use Illuminate\Support\ServiceProvider;
use Zeiras\Core\ZrCoreServiceProvider;

it('dichiara per la scoperta automatica di Laravel solo provider che esistono', function () {
    $composer = json_decode((string) file_get_contents(__DIR__.'/../../composer.json'), true, flags: JSON_THROW_ON_ERROR);
    $provider = $composer['extra']['laravel']['providers'] ?? [];

    expect($provider)->toBe([ZrCoreServiceProvider::class]);
    foreach ($provider as $classe) {
        expect(is_subclass_of($classe, ServiceProvider::class))->toBeTrue();
    }
});

it('si avvia dentro un\'app Laravel', function () {
    expect(app()->getProviders(ZrCoreServiceProvider::class))->toHaveCount(1);
});

// Sprint 5 · T6 (voce #1257). zr-core si installa accanto allo zr-auth che i frontend hanno: composer.json accetta più versioni
// minori, e la CI le prova tutte, un giro del job per ognuna. Una versione accettata e mai provata è una promessa senza prova.

/**
 * Cosa non torna fra le versioni di zr-auth che composer.json accetta e i giri della CI: una versione minore accettata che la
 * CI non prova, o una provata che composer.json non accetta. Il vincolo è fatto di `^<maggiore>.<minore>` uniti da `||`, e la
 * matrice di ci.yml (`zr-auth: ['0.6', '0.7']`) ha un giro per ognuno.
 *
 * @return list<string>
 */
function versioniDiZrAuthNonProvate(string $vincolo, string $ci): array
{
    if (preg_match('/^\^\d+\.\d+( \|\| \^\d+\.\d+)*$/', $vincolo) !== 1) {
        return ["il vincolo «{$vincolo}» non è fatto di ^<maggiore>.<minore> uniti da ||"];
    }
    preg_match_all('/\^(\d+\.\d+)/', $vincolo, $accettate);
    preg_match('/^\s+zr-auth: \[([^\]\n]*)\]$/m', $ci, $matrice);
    preg_match_all("/'(\d+\.\d+)'/", $matrice[1] ?? '', $provate);

    return [
        ...array_map(fn (string $versione) => "la CI non prova zr-auth {$versione}", array_values(array_diff($accettate[1], $provate[1]))),
        ...array_map(fn (string $versione) => "la CI prova zr-auth {$versione}, che composer.json non accetta", array_values(array_diff($provate[1], $accettate[1]))),
    ];
}

it('composer.json accetta zr-auth 0.6 e 0.7, e la CI prova zr-core con tutte e due, un giro per versione (T6.1)', function () {
    $composer = json_decode((string) file_get_contents(__DIR__.'/../../composer.json'), true, flags: JSON_THROW_ON_ERROR);
    $vincolo = $composer['require']['zeiras/zr-auth'];
    $ci = (string) file_get_contents(__DIR__.'/../../.github/workflows/ci.yml');

    expect($vincolo)->toBe('^0.6 || ^0.7')
        ->and(versioniDiZrAuthNonProvate($vincolo, $ci))->toBe([])
        // Ogni giro installa l'ultima versione della sua minore: il vincolo del giro restringe quello di composer.json.
        ->and($ci)->toContain('--with "zeiras/zr-auth:~${ZR_AUTH}.0"');
});

it('il controllo trova una versione accettata che la CI non prova, e una provata che composer.json non accetta (T6.1)', function () {
    $ci = (string) file_get_contents(__DIR__.'/../../.github/workflows/ci.yml');
    $conUnGiro = (string) preg_replace('/^(\s+zr-auth: )\[[^\]\n]*\]$/m', '$1[\'0.7\']', $ci);

    expect($conUnGiro)->not->toBe($ci)
        ->and(versioniDiZrAuthNonProvate('^0.6 || ^0.7', $conUnGiro))->toBe(['la CI non prova zr-auth 0.6'])
        ->and(versioniDiZrAuthNonProvate('^0.7', $ci))->toBe(['la CI prova zr-auth 0.6, che composer.json non accetta'])
        // Senza matrice la CI fa un giro solo, con la versione che composer sceglie: nessuna delle due è provata di proposito.
        ->and(versioniDiZrAuthNonProvate('^0.6 || ^0.7', "jobs:\n  ci:\n    runs-on: ubuntu-latest\n"))
        ->toBe(['la CI non prova zr-auth 0.6', 'la CI non prova zr-auth 0.7'])
        ->and(versioniDiZrAuthNonProvate('>=0.6', $ci))->toBe(['il vincolo «>=0.6» non è fatto di ^<maggiore>.<minore> uniti da ||']);
});
