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

// Sprint 5 · T6 (voce #1257) e sprint 7 · T1 (voce #1380, la 0.8). zr-core si installa accanto allo zr-auth che i frontend hanno:
// composer.json accetta più versioni minori, e la CI le prova tutte, un giro del job per ognuna. Una versione accettata e mai
// provata è una promessa senza prova.

/**
 * Cosa non torna fra le versioni di zr-auth che composer.json accetta e i giri della CI: una versione minore accettata che la
 * CI non prova, o una provata che composer.json non accetta; un giro che non installa la versione della sua voce della matrice
 * (due giri proverebbero la stessa). Il vincolo è fatto di `^0.<minore>`, anche con la patch, uniti da `||`, e la
 * matrice di ci.yml (`zr-auth: ['0.6', '0.7', '0.8']`) ha un giro per ognuno. Solo sotto la 1.0 un `^` si ferma alla sua
 * minore: `^1.0` accetta anche le 1.1, che il giro della 1.0 non proverebbe.
 *
 * @return list<string>
 */
function versioniDiZrAuthNonProvate(string $vincolo, string $ci): array
{
    if (preg_match('/^\^0\.\d+(\.\d+)?( \|\| \^0\.\d+(\.\d+)?)*$/', $vincolo) !== 1) {
        return ["il vincolo «{$vincolo}» non è fatto di ^0.<minore> uniti da ||"];
    }
    preg_match_all('/\^(\d+\.\d+)/', $vincolo, $accettate);
    preg_match('/^\s+zr-auth: \[([^\]\n]*)\]$/m', $ci, $matrice);
    preg_match_all("/'(\d+\.\d+)'/", $matrice[1] ?? '', $provate);

    $problemi = [
        ...array_map(fn (string $versione) => "la CI non prova zr-auth {$versione}", array_values(array_diff($accettate[1], $provate[1]))),
        ...array_map(fn (string $versione) => "la CI prova zr-auth {$versione}, che composer.json non accetta", array_values(array_diff($provate[1], $accettate[1]))),
    ];
    // Ogni giro installa l'ultima versione della minore della sua voce: la voce arriva al passo in ZR_AUTH, e restringe il
    // vincolo di composer.json. Senza questo legame i giri avrebbero nomi diversi e la stessa versione.
    if (! str_contains($ci, 'ZR_AUTH: ${{ matrix.zr-auth }}') || ! str_contains($ci, '--with "zeiras/zr-auth:~${ZR_AUTH}.0"')) {
        $problemi[] = 'i giri non installano la versione di zr-auth della loro voce della matrice';
    }

    return $problemi;
}

/**
 * I vincoli fatti di più versioni unite da `||` che un testo scrive, ognuno una volta.
 *
 * @return list<string>
 */
function vincoliAPiuVersioniIn(string $testo): array
{
    preg_match_all('/\^0\.\d+(?:\.\d+)?(?: \|\| \^0\.\d+(?:\.\d+)?)+/', $testo, $trovati);

    return array_values(array_unique($trovati[0]));
}

it('composer.json accetta zr-auth 0.6, 0.7 e 0.8, e la CI prova zr-core con tutte e tre, un giro per versione (sprint 5 · T6.1; sprint 7 · T1.1)', function () {
    $composer = json_decode((string) file_get_contents(__DIR__.'/../../composer.json'), true, flags: JSON_THROW_ON_ERROR);
    $vincolo = $composer['require']['zeiras/zr-auth'];
    $ci = (string) file_get_contents(__DIR__.'/../../.github/workflows/ci.yml');

    // Della 0.6 dalla 0.6.6, l'ultima e quindi quella che la CI prova: le prime (fino alla 0.6.1) tenevano in sessione
    // l'accesso di un'altra persona, e una patch più vecchia non la prova nessun giro.
    expect($vincolo)->toBe('^0.6.6 || ^0.7 || ^0.8')
        ->and(versioniDiZrAuthNonProvate($vincolo, $ci))->toBe([]);
});

it('README e CLAUDE.md dicono il vincolo di composer.json, e nessun altro (sprint 7 · T1.3)', function (string $file) {
    $composer = json_decode((string) file_get_contents(__DIR__.'/../../composer.json'), true, flags: JSON_THROW_ON_ERROR);
    $vincolo = $composer['require']['zeiras/zr-auth'];
    $testo = (string) file_get_contents(__DIR__.'/../../'.$file);

    // Com'era il file prima dell'ultima versione accettata: lo stesso vincolo, con una versione in meno.
    $diPrima = str_replace($vincolo, (string) preg_replace('/ \|\| [^|]+$/', '', $vincolo), $testo);

    expect(vincoliAPiuVersioniIn($testo))->toBe([$vincolo])
        ->and(vincoliAPiuVersioniIn($diPrima))->not->toBe([$vincolo]);
})->with(['README.md', 'CLAUDE.md']);

it('il controllo trova una versione accettata che la CI non prova, una provata che composer.json non accetta e un giro che non installa la versione della sua voce (sprint 5 · T6.1; sprint 7 · T1.2)', function () {
    $ci = (string) file_get_contents(__DIR__.'/../../.github/workflows/ci.yml');
    $vincolo = '^0.6.6 || ^0.7 || ^0.8';
    $conLaMatrice = fn (string $voci): string => (string) preg_replace('/^(\s+zr-auth: )\[[^\]\n]*\]$/m', '$1['.$voci.']', $ci);
    $conUnGiro = $conLaMatrice("'0.7'");

    // Com'erano prima della 0.8, uno alla volta: la matrice senza il giro nuovo, il vincolo senza la versione nuova.
    $conLaMatriceDiPrima = $conLaMatrice("'0.6', '0.7'");
    $vincoloDiPrima = str_replace(' || ^0.8', '', $vincolo);

    // La voce della matrice che non arriva al passo: i giri installerebbero tutti la 0.7, e sarebbero verdi.
    $conLaVersioneFissa = str_replace('ZR_AUTH: ${{ matrix.zr-auth }}', "ZR_AUTH: '0.7'", $ci);
    $senzaIlVincoloDelGiro = str_replace(' --with "zeiras/zr-auth:~${ZR_AUTH}.0"', '', $ci);

    expect($conUnGiro)->not->toBe($ci)
        ->and($conLaMatriceDiPrima)->not->toBe($ci)
        ->and($conLaVersioneFissa)->not->toBe($ci)
        ->and($senzaIlVincoloDelGiro)->not->toBe($ci)
        ->and(versioniDiZrAuthNonProvate($vincolo, $conUnGiro))->toBe(['la CI non prova zr-auth 0.6', 'la CI non prova zr-auth 0.8'])
        ->and(versioniDiZrAuthNonProvate($vincolo, $conLaMatriceDiPrima))->toBe(['la CI non prova zr-auth 0.8'])
        ->and(versioniDiZrAuthNonProvate($vincoloDiPrima, $ci))->toBe(['la CI prova zr-auth 0.8, che composer.json non accetta'])
        ->and(versioniDiZrAuthNonProvate('^0.7', $ci))->toBe(['la CI prova zr-auth 0.6, che composer.json non accetta', 'la CI prova zr-auth 0.8, che composer.json non accetta'])
        ->and(versioniDiZrAuthNonProvate($vincolo, $conLaVersioneFissa))->toBe(['i giri non installano la versione di zr-auth della loro voce della matrice'])
        ->and(versioniDiZrAuthNonProvate($vincolo, $senzaIlVincoloDelGiro))->toBe(['i giri non installano la versione di zr-auth della loro voce della matrice'])
        // Senza matrice la CI fa un giro solo, con la versione che composer sceglie: nessuna delle due è provata di proposito.
        ->and(versioniDiZrAuthNonProvate('^0.6 || ^0.7', "jobs:\n  ci:\n    runs-on: ubuntu-latest\n"))
        ->toBe(['la CI non prova zr-auth 0.6', 'la CI non prova zr-auth 0.7', 'i giri non installano la versione di zr-auth della loro voce della matrice'])
        ->and(versioniDiZrAuthNonProvate('>=0.6', $ci))->toBe(['il vincolo «>=0.6» non è fatto di ^0.<minore> uniti da ||'])
        // Dalla 1.0 un `^` accetta anche le minori dopo: il controllo lo dice, invece di contarla come una minore sola.
        ->and(versioniDiZrAuthNonProvate('^0.8 || ^1.0', $ci))->toBe(['il vincolo «^0.8 || ^1.0» non è fatto di ^0.<minore> uniti da ||']);
});
