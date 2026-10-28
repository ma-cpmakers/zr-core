<?php

use Composer\InstalledVersions;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Filesystem\Filesystem;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Symfony\Component\Process\Process;
use Zeiras\Auth\Testing\BackofficeFinto;
use Zeiras\Auth\Testing\Finto\RichiestaSconosciuta;
use Zeiras\Core\Cornice;
use Zeiras\Core\Http\IntestazioniSicurezza;
use Zeiras\Core\Http\NotificheDellaCornice;
use Zeiras\Core\Registro;
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

// Sprint 5 · T6 (voce #1257) e poi, una minore alla volta, sprint 7 · T1 (voce #1380, la 0.8), sprint 8 · T1 (voce #1402, la
// 0.9), sprint 9 · T5 (voce #1442, la 0.10), sprint 11 · T5 (voce #1458, la 0.11) e sprint 12 · T7 (la 0.12, dentro la
// v1.3.0): fino alla v1.3.0 zr-core si installava accanto allo zr-auth che i frontend avevano, composer.json accettava sette
// versioni minori, dalla 0.6 alla 0.12, e la CI le provava tutte, un giro del job per ognuna. Sprint 13 · T1 (voce #1480):
// dalla v1.4.0 la minore è una, la 0.12, perché la cornice chiama `Sessione::aggiorna`, che c'è da lì. La regola non cambia:
// una versione accettata e mai provata è una promessa senza prova. Sprint 17 · T3 (voce #1468): i giri di ogni minore sono
// due, «ultima» e «minima». Il secondo installa la versione più bassa che composer.json accetta in quella minore, e la legge
// da composer.json (`.github/minimo-di-zr-auth.sh`): prima la provava solo il giro in cui era anche l'ultima, e un vincolo
// abbassato prometteva una patch che nessun giro installava.

/**
 * Le voci della matrice di zr-auth in ci.yml come sono scritte fra le quadre (`'0.12'`): null se la riga non c'è, o se non sta
 * su una riga sola.
 */
function vociDellaMatriceDiZrAuth(string $ci): ?string
{
    preg_match('/^\s+zr-auth: \[([^\]\n]*)\]$/m', $ci, $matrice);

    return $matrice[1] ?? null;
}

/**
 * Le voci di `patch` nella matrice di ci.yml come sono scritte fra le quadre (`'ultima', 'minima'`): null se la riga non c'è, o
 * se non sta su una riga sola.
 */
function vociDellePatchDiZrAuth(string $ci): ?string
{
    preg_match('/^\s+patch: \[([^\]\n]*)\]$/m', $ci, $matrice);

    return $matrice[1] ?? null;
}

/**
 * Cosa non torna fra i due giri che la CI fa per ogni minore di zr-auth, «ultima» e «minima», e la matrice di ci.yml
 * (`patch: ['ultima', 'minima']`, ogni voce fra apici): un giro che manca, uno che il passo delle dipendenze non conosce, un
 * giro tolto o aggiunto a mano (`exclude`, `include`: la matrice è un prodotto, e così ogni minore li ha tutti e due), la voce
 * che non arriva al passo che installa, il nome del giro che non dice quale dei due è. Che cosa installa ogni giro lo prova
 * il caso che lancia il passo, più sotto.
 *
 * @return list<string>
 */
function patchDiZrAuthNonProvate(string $ci): array
{
    preg_match_all("/'([^',\s]+)'/", vociDellePatchDiZrAuth($ci) ?? '', $voci);

    $problemi = [
        ...array_map(fn (string $patch) => "la CI non fa il giro «{$patch}» delle minori di zr-auth", array_values(array_diff(['ultima', 'minima'], $voci[1]))),
        ...array_map(fn (string $patch) => "la CI fa un giro «{$patch}», che il passo delle dipendenze non conosce", array_values(array_diff($voci[1], ['ultima', 'minima']))),
    ];
    if (preg_match('/^\s+(exclude|include):/m', $ci) === 1) {
        $problemi[] = 'la matrice toglie o aggiunge giri a mano: una minore può restare senza uno dei suoi due giri';
    }
    if (! str_contains($ci, 'PATCH: ${{ matrix.patch }}')) {
        $problemi[] = 'i giri non installano la patch della loro voce della matrice';
    }
    if (! str_contains($ci, 'name: ci (zr-auth ${{ matrix.zr-auth }}, ${{ matrix.patch }})')) {
        $problemi[] = 'il nome del giro non dice la minore e la patch';
    }

    return $problemi;
}

/**
 * Cosa non torna fra le versioni di zr-auth che composer.json accetta e i giri della CI: una versione minore accettata che la
 * CI non prova, o una provata che composer.json non accetta; un giro che non installa la versione della sua voce della matrice
 * (due giri proverebbero la stessa). Il vincolo è fatto di `^0.<minore>`, anche con la patch: uno solo, o più d'uno uniti da
 * `||`. La matrice di ci.yml (`zr-auth: ['0.12']`) ha una voce per ognuno, ogni voce fra apici: senza, YAML legge `0.10` come
 * il numero 0.1, e una voce senza apici qui non conta. Solo sotto la 1.0 un `^` si ferma alla sua minore: `^1.0` accetta
 * anche le 1.1, che il giro della 1.0 non proverebbe.
 *
 * @return list<string>
 */
function versioniDiZrAuthNonProvate(string $vincolo, string $ci): array
{
    if (preg_match('/^\^0\.\d+(\.\d+)?( \|\| \^0\.\d+(\.\d+)?)*$/', $vincolo) !== 1) {
        return ["il vincolo «{$vincolo}» non è fatto di ^0.<minore> uniti da ||"];
    }
    preg_match_all('/\^(\d+\.\d+)/', $vincolo, $accettate);
    preg_match_all("/'(\d+\.\d+)'/", vociDellaMatriceDiZrAuth($ci) ?? '', $provate);

    $problemi = [
        ...array_map(fn (string $versione) => "la CI non prova zr-auth {$versione}", array_values(array_diff($accettate[1], $provate[1]))),
        ...array_map(fn (string $versione) => "la CI prova zr-auth {$versione}, che composer.json non accetta", array_values(array_diff($provate[1], $accettate[1]))),
    ];
    // Il giro «ultima» installa l'ultima versione della minore della sua voce: la voce arriva al passo in ZR_AUTH, e restringe
    // il vincolo di composer.json. Senza questo legame i giri avrebbero nomi diversi e la stessa versione.
    if (! str_contains($ci, 'ZR_AUTH: ${{ matrix.zr-auth }}') || ! str_contains($ci, '--with "zeiras/zr-auth:~${ZR_AUTH}.0"')) {
        $problemi[] = 'i giri non installano la versione di zr-auth della loro voce della matrice';
    }

    return $problemi;
}

/**
 * I vincoli di zr-auth che un testo scrive, ognuno una volta e nell'ordine in cui li scrive: un `^0.<minore>` da solo, o più
 * d'uno uniti da `||`, che sono un vincolo solo. README e CLAUDE.md non scrivono altri `^0.`.
 *
 * @return list<string>
 */
function vincoliDiZrAuthIn(string $testo): array
{
    preg_match_all('/\^0\.\d+(?:\.\d+)?(?: \|\| \^0\.\d+(?:\.\d+)?)*/', $testo, $trovati);

    return array_values(array_unique($trovati[0]));
}

it('composer.json chiede zr-auth ^0.12.41 e nessuna minore più vecchia, e la CI prova zr-core con quella: una voce nella matrice, due giri, con l\'ultima patch e con la più bassa accettata (sprint 13 · T1.1; review, R1 e S1; sprint 16 · T4.5; sprint 17 · T3.1; sprint 55 · T1.4; sprint 59 · T1.4)', function () {
    $composer = json_decode((string) file_get_contents(__DIR__.'/../../composer.json'), true, flags: JSON_THROW_ON_ERROR);
    $vincolo = $composer['require']['zeiras/zr-auth'];
    $ci = (string) file_get_contents(__DIR__.'/../../.github/workflows/ci.yml');

    // Dalla 0.12.4: il vincolo dice la patch che ha provato il codice che la usa. Dalla `v1.6.0` «Segna tutte come lette» tiene il
    // blocco della sessione coi tempi di zr-auth (`Sessione::BLOCCO_ATTESA`, che c'è dalla 0.12.2), e i giri con quel codice hanno
    // installato la 0.12.4: la 0.12.2 e la 0.12.3, con quel codice, non le ha provate nessun giro (sprint 16 · T4.5).
    // Prima, dalla `v1.4.0`, il minimo era la 0.12.1 e non la 0.12.0, per la stessa regola: la 0.12.0 l'ha provata solo una
    // zr-core che `Sessione::aggiorna` non la chiamava (il giro della PR #15, sprint 12, e quello del primo commit di questo sprint);
    // con la cornice che la chiama i giri hanno installato dalla 0.12.1 in su, e fra le due patch è cambiata proprio `aggiorna`: nella 0.12.0
    // prende lingua e nome anche da una risposta senza `utente.id`. Sotto la 0.12 no: `Sessione::aggiorna` non c'è, e una guardia
    // per le versioni più vecchie l'analisi statica la segna in ogni giro (sonda del 10/10/2026). Dallo sprint 17 la patch più
    // bassa la installa a ogni run il giro «minima», che la legge da qui: chi abbassa il vincolo la vede provata, o rossa.
    // Dalla `v2.16.0` dalla 0.12.31: la richiesta rimandata della cornice in due dati la protegge `SessioneChiusa`, che c'è da
    // quella (Decisione 13268 di zr-pm; sprint 55 · T1.4). Dalla `v2.19.0` dalla 0.12.41: le rotte della cornice escono da
    // `SoloDallaPersona`, che c'è da quella, e i due giri le provano con l'interruttore acceso (nota 13633; sprint 59 · T1.4).
    expect($vincolo)->toBe('^0.12.41')
        ->and(vociDellaMatriceDiZrAuth($ci))->toBe("'0.12'")
        ->and(vociDellePatchDiZrAuth($ci))->toBe("'ultima', 'minima'")
        ->and(versioniDiZrAuthNonProvate($vincolo, $ci))->toBe([])
        ->and(patchDiZrAuthNonProvate($ci))->toBe([]);
});

it('README e CLAUDE.md dicono il vincolo di composer.json, e nessun altro (sprint 7 · T1.3; sprint 13 · T1.2)', function (string $file) {
    $composer = json_decode((string) file_get_contents(__DIR__.'/../../composer.json'), true, flags: JSON_THROW_ON_ERROR);
    $vincolo = $composer['require']['zeiras/zr-auth'];
    $testo = (string) file_get_contents(__DIR__.'/../../'.$file);

    // Il vincolo a sette versioni che i due file dicevano fino alla v1.3.0: nel file rimasto indietro, e in quello che dice il
    // vincolo nuovo in un punto e il vecchio in un altro. E una minore sola, ma un'altra, accanto a quella giusta.
    $vincoloDiPrima = '^0.6.6 || ^0.7 || ^0.8 || ^0.9.1 || ^0.10 || ^0.11 || ^0.12';

    expect(vincoliDiZrAuthIn($testo))->toBe([$vincolo])
        ->and(vincoliDiZrAuthIn(str_replace("`{$vincolo}`", "`{$vincoloDiPrima}`", $testo)))->toBe([$vincoloDiPrima])
        ->and(vincoliDiZrAuthIn($testo."\n`{$vincoloDiPrima}`"))->toBe([$vincolo, $vincoloDiPrima])
        ->and(vincoliDiZrAuthIn($testo."\n`^0.11`"))->toBe([$vincolo, '^0.11']);
})->with(['README.md', 'CLAUDE.md']);

it('CLAUDE.md dice, accanto al vincolo, che la CI fa due giri per ogni versione minore accettata, con l\'ultima patch e con la più bassa che il vincolo accetta, e che dalla v1.4.0 la minore è una, e perché (sprint 11 · T5.3; sprint 13 · T1.2; sprint 17 · T3.3)', function () {
    $composer = json_decode((string) file_get_contents(__DIR__.'/../../composer.json'), true, flags: JSON_THROW_ON_ERROR);
    $vincolo = $composer['require']['zeiras/zr-auth'];
    $claude = suUnaRiga((string) file_get_contents(__DIR__.'/../../CLAUDE.md'));

    // Il README i giri li elenca, e il caso qui sotto li conta sulla matrice; CLAUDE.md dice la regola, che non cambia con le
    // versioni: sta nella riga del vincolo, una volta. Accanto, perché la minore è una: è ciò che legge chi vorrebbe riallargare
    // il vincolo a una zr-auth senza `Sessione::aggiorna`.
    expect(substr_count($claude, "`zeiras/zr-auth` `{$vincolo}`: la CI fa due giri per ogni versione minore accettata, uno con l'ultima patch e uno con la più bassa che il vincolo accetta (la legge da `composer.json`),"))->toBe(1)
        ->and(substr_count($claude, "e il verde è di tutti i giri (dalla `v1.4.0` la minore è una: la cornice chiama `Sessione::aggiorna`, che c'è dalla 0.12)."))->toBe(1);
});

/**
 * Le versioni minori di zr-auth di cui un testo dice che la CI prova l'ultima, nell'ordine in cui le scrive.
 *
 * @return list<string>
 */
function giriDettiDa(string $testo): array
{
    preg_match_all("/l'ultima (\d+\.\d+)/", $testo, $trovati);

    return $trovati[1];
}

it('il README dice, di ogni voce della matrice e di nessun\'altra, che la CI ne prova l\'ultima (sprint 8 · T1.3; sprint 13 · T1.3; sprint 17 · T3.3)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $ci = (string) file_get_contents(__DIR__.'/../../.github/workflows/ci.yml');
    preg_match_all("/'(\d+\.\d+)'/", vociDellaMatriceDiZrAuth($ci) ?? '', $voci);

    // Il README rimasto alla v1.3.0: dice i sette giri di allora. E quello che dice il giro giusto e, in un altro punto, uno che
    // la matrice non ha.
    $readmeDiPrima = str_replace("e con l'ultima 0.12)", "e con l'ultima 0.6, l'ultima 0.7, l'ultima 0.8, l'ultima 0.9, l'ultima 0.10, l'ultima 0.11 e l'ultima 0.12)", $readme);
    $conUnGiroInPiu = $readme."\nLa CI lo prova anche con l'ultima 0.11.\n";

    expect($voci[1])->not->toBe([])
        ->and(giriDettiDa($readme))->toBe($voci[1])
        ->and($readmeDiPrima)->not->toBe($readme)
        ->and(giriDettiDa($readmeDiPrima))->toBe(['0.6', '0.7', '0.8', '0.9', '0.10', '0.11', '0.12'])
        ->and(giriDettiDa($conUnGiroInPiu))->toBe([...$voci[1], '0.11']);
});

it('il README dice, in «La parte server», da quale versione zr-core chiede la 0.12 di zr-auth e da quale la 0.12.4, perché, e a quale versione Composer lascia zr-core con una zr-auth più vecchia (sprint 13 · T1.3; review, R1 e S1; sprint 16 · T4.5)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $cosaDice = fn (string $testo): array => [
        'da quale versione' => str_contains(sezioneDelReadme($testo, 'La parte server'), 'Dalla `v1.4.0` una zr-auth più vecchia non basta'),
        'perché' => str_contains(sezioneDelReadme($testo, 'La parte server'), 'la cornice chiama `Sessione::aggiorna`, che c\'è dalla 0.12'),
        'con una più vecchia Composer lascia zr-core alla v1.3.0' => str_contains(sezioneDelReadme($testo, 'La parte server'), 'con una più vecchia Composer lascia zr-core alla `v1.3.0`'),
        'dalla v1.6.0 serve la 0.12.4, e perché' => str_contains(sezioneDelReadme($testo, 'La parte server'), 'Dalla `v1.6.0` serve la 0.12.4: «Segna tutte come lette» tiene il blocco della sessione coi tempi di zr-auth, e la 0.12.4 è la patch con cui la CI ha provato quel codice'),
        'con una più vecchia della 0.12.4 Composer lascia zr-core alla v1.5.0' => str_contains(sezioneDelReadme($testo, 'La parte server'), 'con una più vecchia della 0.12.4 Composer lascia zr-core alla `v1.5.0`'),
    ];

    // Con «La parte server» e «La cornice» scambiate le cinque cose sono dette, ma non dove si legge che cosa zr-core richiede.
    $scambiate = conParteServerECorniceScambiate($readme);

    expect($cosaDice($readme))->toBe([
        'da quale versione' => true,
        'perché' => true,
        'con una più vecchia Composer lascia zr-core alla v1.3.0' => true,
        'dalla v1.6.0 serve la 0.12.4, e perché' => true,
        'con una più vecchia della 0.12.4 Composer lascia zr-core alla v1.5.0' => true,
    ])
        ->and(str_contains(suUnaRiga($scambiate), 'una zr-auth più vecchia non basta'))->toBe(true)
        ->and($cosaDice($scambiate))->toBe([
            'da quale versione' => false,
            'perché' => false,
            'con una più vecchia Composer lascia zr-core alla v1.3.0' => false,
            'dalla v1.6.0 serve la 0.12.4, e perché' => false,
            'con una più vecchia della 0.12.4 Composer lascia zr-core alla v1.5.0' => false,
        ]);
});

it('il controllo trova una versione accettata che la CI non prova, una provata che composer.json non accetta e un giro che non installa la versione della sua voce (sprint 5 · T6.1; sprint 13 · T1.1; sprint 17 · T3.4)', function () {
    $ci = (string) file_get_contents(__DIR__.'/../../.github/workflows/ci.yml');
    $vincolo = '^0.12.4';
    $conLaMatrice = fn (string $voci): string => (string) preg_replace('/^(\s+zr-auth: )\[[^\]\n]*\]$/m', '$1['.$voci.']', $ci);

    // Com'erano fino alla v1.3.0, uno alla volta: la matrice a sette voci, il vincolo a sette versioni.
    $conLaMatriceDiPrima = $conLaMatrice("'0.6', '0.7', '0.8', '0.9', '0.10', '0.11', '0.12'");
    $vincoloDiPrima = '^0.6.6 || ^0.7 || ^0.8 || ^0.9.1 || ^0.10 || ^0.11 || ^0.12';
    // La voce senza gli apici: in YAML è un numero (`0.10` sarebbe lo 0.1, e il giro proverebbe un'altra versione). Una voce
    // senza apici qui non conta.
    $conLaVoceSenzaApici = $conLaMatrice('0.12');
    // Un'altra minore al posto di quella accettata, e una in più accanto.
    $conUnAltraMinore = $conLaMatrice("'0.11'");
    $conUnaMinoreInPiu = $conLaMatrice("'0.12', '0.13'");
    // La minore tolta dalla matrice, con le sue due patch ancora lì: nessun giro.
    $senzaLaMinore = $conLaMatrice('');

    // La voce della matrice che non arriva al passo: il giro installerebbe una versione scritta nel passo, e sarebbe verde.
    $conLaVersioneFissa = str_replace('ZR_AUTH: ${{ matrix.zr-auth }}', "ZR_AUTH: '0.11'", $ci);
    $senzaIlVincoloDelGiro = str_replace(' --with "zeiras/zr-auth:~${ZR_AUTH}.0"', '', $ci);

    expect($conLaMatriceDiPrima)->not->toBe($ci)
        ->and($conLaVoceSenzaApici)->not->toBe($ci)
        ->and($conUnAltraMinore)->not->toBe($ci)
        ->and($conUnaMinoreInPiu)->not->toBe($ci)
        ->and($senzaLaMinore)->not->toBe($ci)
        ->and($conLaVersioneFissa)->not->toBe($ci)
        ->and($senzaIlVincoloDelGiro)->not->toBe($ci)
        ->and(versioniDiZrAuthNonProvate($vincolo, $conLaMatriceDiPrima))->toBe(['la CI prova zr-auth 0.6, che composer.json non accetta', 'la CI prova zr-auth 0.7, che composer.json non accetta', 'la CI prova zr-auth 0.8, che composer.json non accetta', 'la CI prova zr-auth 0.9, che composer.json non accetta', 'la CI prova zr-auth 0.10, che composer.json non accetta', 'la CI prova zr-auth 0.11, che composer.json non accetta'])
        ->and(versioniDiZrAuthNonProvate($vincoloDiPrima, $ci))->toBe(['la CI non prova zr-auth 0.6', 'la CI non prova zr-auth 0.7', 'la CI non prova zr-auth 0.8', 'la CI non prova zr-auth 0.9', 'la CI non prova zr-auth 0.10', 'la CI non prova zr-auth 0.11'])
        ->and(versioniDiZrAuthNonProvate('^0.11 || ^0.12', $ci))->toBe(['la CI non prova zr-auth 0.11'])
        ->and(versioniDiZrAuthNonProvate($vincolo, $conLaVoceSenzaApici))->toBe(['la CI non prova zr-auth 0.12'])
        ->and(versioniDiZrAuthNonProvate($vincolo, $conUnAltraMinore))->toBe(['la CI non prova zr-auth 0.12', 'la CI prova zr-auth 0.11, che composer.json non accetta'])
        ->and(versioniDiZrAuthNonProvate($vincolo, $conUnaMinoreInPiu))->toBe(['la CI prova zr-auth 0.13, che composer.json non accetta'])
        ->and(versioniDiZrAuthNonProvate($vincolo, $senzaLaMinore))->toBe(['la CI non prova zr-auth 0.12'])
        ->and(versioniDiZrAuthNonProvate($vincolo, $conLaVersioneFissa))->toBe(['i giri non installano la versione di zr-auth della loro voce della matrice'])
        ->and(versioniDiZrAuthNonProvate($vincolo, $senzaIlVincoloDelGiro))->toBe(['i giri non installano la versione di zr-auth della loro voce della matrice'])
        // Senza matrice la CI fa un giro solo, con la versione che composer sceglie: nessuna delle due è provata di proposito.
        ->and(versioniDiZrAuthNonProvate('^0.6 || ^0.7', "jobs:\n  ci:\n    runs-on: ubuntu-latest\n"))
        ->toBe(['la CI non prova zr-auth 0.6', 'la CI non prova zr-auth 0.7', 'i giri non installano la versione di zr-auth della loro voce della matrice'])
        ->and(versioniDiZrAuthNonProvate('>=0.6', $ci))->toBe(['il vincolo «>=0.6» non è fatto di ^0.<minore> uniti da ||'])
        // Dalla 1.0 un `^` accetta anche le minori dopo: il controllo lo dice, invece di contarla come una minore sola.
        ->and(versioniDiZrAuthNonProvate('^0.8 || ^1.0', $ci))->toBe(['il vincolo «^0.8 || ^1.0» non è fatto di ^0.<minore> uniti da ||']);
});

it('il controllo trova il giro «minima» o «ultima» che manca, un giro che il passo non conosce, uno tolto a mano, la patch che non arriva al passo e il nome che non la dice (sprint 17 · T3.1, T3.4)', function () {
    $ci = (string) file_get_contents(__DIR__.'/../../.github/workflows/ci.yml');
    $conLePatch = fn (string $voci): string => (string) preg_replace('/^(\s+patch: )\[[^\]\n]*\]$/m', '$1['.$voci.']', $ci);

    // Una delle due patch tolta dalla matrice: ogni minore resta con un giro solo. E senza la riga, com'era fino alla v1.6.0.
    $senzaLaMinima = $conLePatch("'ultima'");
    $senzaLUltima = $conLePatch("'minima'");
    $senzaLaRiga = (string) preg_replace('/^\s+patch: \[[^\]\n]*\]\n/m', '', $ci);
    // Le voci senza gli apici qui non contano, come quelle delle minori; e una voce in più, che il passo non sa installare.
    $conLeVociSenzaApici = $conLePatch('ultima, minima');
    $conUnGiroInPiu = $conLePatch("'ultima', 'minima', 'prossima'");
    // Il giro «minima» di una minore tolto a mano: la matrice ha le due patch, e quella minore ne prova una.
    $conUnGiroTolto = str_replace("        patch: ['ultima', 'minima']\n", "        patch: ['ultima', 'minima']\n        exclude:\n          - zr-auth: '0.12'\n            patch: 'minima'\n", $ci);
    // La voce che non arriva al passo: i due giri installerebbero la stessa versione, coi loro due nomi.
    $conLaPatchFissa = str_replace('PATCH: ${{ matrix.patch }}', "PATCH: 'ultima'", $ci);
    // Il nome di prima: i due giri di una minore si chiamerebbero allo stesso modo, e il run non si leggerebbe giro per giro.
    $colNomeDiPrima = str_replace('name: ci (zr-auth ${{ matrix.zr-auth }}, ${{ matrix.patch }})', 'name: ci (zr-auth ${{ matrix.zr-auth }})', $ci);

    expect($senzaLaMinima)->not->toBe($ci)
        ->and($senzaLUltima)->not->toBe($ci)
        ->and($senzaLaRiga)->not->toBe($ci)
        ->and($conLeVociSenzaApici)->not->toBe($ci)
        ->and($conUnGiroInPiu)->not->toBe($ci)
        ->and($conUnGiroTolto)->not->toBe($ci)
        ->and($conLaPatchFissa)->not->toBe($ci)
        ->and($colNomeDiPrima)->not->toBe($ci)
        ->and(patchDiZrAuthNonProvate($senzaLaMinima))->toBe(['la CI non fa il giro «minima» delle minori di zr-auth'])
        ->and(patchDiZrAuthNonProvate($senzaLUltima))->toBe(['la CI non fa il giro «ultima» delle minori di zr-auth'])
        ->and(patchDiZrAuthNonProvate($senzaLaRiga))->toBe(['la CI non fa il giro «ultima» delle minori di zr-auth', 'la CI non fa il giro «minima» delle minori di zr-auth'])
        ->and(patchDiZrAuthNonProvate($conLeVociSenzaApici))->toBe(['la CI non fa il giro «ultima» delle minori di zr-auth', 'la CI non fa il giro «minima» delle minori di zr-auth'])
        ->and(patchDiZrAuthNonProvate($conUnGiroInPiu))->toBe(['la CI fa un giro «prossima», che il passo delle dipendenze non conosce'])
        ->and(patchDiZrAuthNonProvate($conUnGiroTolto))->toBe(['la matrice toglie o aggiunge giri a mano: una minore può restare senza uno dei suoi due giri'])
        ->and(patchDiZrAuthNonProvate($conLaPatchFissa))->toBe(['i giri non installano la patch della loro voce della matrice'])
        ->and(patchDiZrAuthNonProvate($colNomeDiPrima))->toBe(['il nome del giro non dice la minore e la patch']);
});

/**
 * `.github/minimo-di-zr-auth.sh` su un composer.json finto che chiede zr-auth con quel vincolo (con null, che non lo chiede),
 * per quella minore. `$ambiente` sono le variabili in più con cui lo script gira (la localizzazione).
 *
 * @param  array<string, string>  $ambiente
 * @return array{0: int|null, 1: string} il codice d'uscita e ciò che lo script scrive
 */
function minimoDiZrAuthCon(?string $vincolo, string $minore, array $ambiente = []): array
{
    $composer = sys_get_temp_dir().'/zr-core-composer-'.bin2hex(random_bytes(8)).'.json';
    file_put_contents($composer, json_encode(['require' => ['php' => '^8.4', ...($vincolo === null ? [] : ['zeiras/zr-auth' => $vincolo])]], JSON_THROW_ON_ERROR));

    try {
        $script = new Process(['bash', '.github/minimo-di-zr-auth.sh', $composer, $minore], dirname(__DIR__, 2), $ambiente);
        $script->run();

        return [$script->getExitCode(), trim($script->getOutput())];
    } finally {
        unlink($composer);
    }
}

it('lo script del minimo dice la versione più bassa di zr-auth che un vincolo accetta in una minore, e si ferma su ciò che non sa leggere (sprint 17 · T3.2)', function (?string $vincolo, string $minore, int $uscita, string $scrive) {
    expect(minimoDiZrAuthCon($vincolo, $minore))->toBe([$uscita, $scrive]);
})->with([
    'il vincolo di oggi' => ['^0.12.4', '0.12', 0, '0.12.4'],
    'il minimo che scende' => ['^0.12.3', '0.12', 0, '0.12.3'],
    'il minimo che sale' => ['^0.12.5', '0.12', 0, '0.12.5'],
    'senza la patch: la prima della minore' => ['^0.12', '0.12', 0, '0.12.0'],
    'due minori: la seconda' => ['^0.11 || ^0.12.4', '0.12', 0, '0.12.4'],
    'due minori: la prima' => ['^0.11 || ^0.12.4', '0.11', 0, '0.11.0'],
    'due minori, con la patch sulla prima' => ['^0.11.3 || ^0.12', '0.11', 0, '0.11.3'],
    'la 0.1 non è la 0.12, che viene prima' => ['^0.12.4 || ^0.1.5', '0.1', 0, '0.1.5'],
    'la 0.12 non accetta la 0.1' => ['^0.12.4', '0.1', 1, ''],
    'una minore che il vincolo non accetta' => ['^0.12.4', '0.11', 1, ''],
    'la stessa minore due volte: la più bassa' => ['^0.12.6 || ^0.12.4', '0.12', 0, '0.12.4'],
    'un vincolo che non è fatto di ^0.<minore>' => ['>=0.12.4', '0.12', 2, ''],
    'un vincolo dalla 1.0' => ['^1.2', '1.2', 2, ''],
    'una minore che non è 0.<numero>' => ['^0.12.4', '0.1*', 2, ''],
    'un composer.json che non chiede zr-auth' => [null, '0.12', 2, ''],
    // Review della PR #20, R2: un numero che la shell non sa confrontare (oltre i 63 bit `[ … -lt … ]` esce 2, e in un `if`
    // vale «falso») non passa per buono. Lo script legge numeri fino a nove cifre, e davanti a uno più lungo si ferma.
    'una patch più lunga di nove cifre, per prima' => ['^0.12.99999999999999999999 || ^0.12.4', '0.12', 2, ''],
    'una patch più lunga di nove cifre, in fondo' => ['^0.12.4 || ^0.12.99999999999999999999', '0.12', 2, ''],
    'una patch di dieci cifre' => ['^0.12.1000000000', '0.12', 2, ''],
    'una patch di nove cifre' => ['^0.12.999999999', '0.12', 0, '0.12.999999999'],
    'una minore più lunga di nove cifre' => ['^0.99999999999999999999.4', '0.99999999999999999999', 2, ''],
    'una minore di nove cifre' => ['^0.999999999.4', '0.999999999', 0, '0.999999999.4'],
]);

it('lo script del minimo non esegue ciò che legge: un comando scritto nel vincolo o nella minore resta testo, e lo script si ferma (sprint 17 · T3.2)', function () {
    $segno = sys_get_temp_dir().'/zr-core-segno-'.bin2hex(random_bytes(8));

    try {
        expect(minimoDiZrAuthCon('^0.12.4 || $(touch '.$segno.')', '0.12'))->toBe([2, ''])
            ->and(minimoDiZrAuthCon('^0.12.4`touch '.$segno.'`', '0.12'))->toBe([2, ''])
            ->and(minimoDiZrAuthCon('^0.12.4', '0.12$(touch '.$segno.')'))->toBe([2, ''])
            ->and(is_file($segno))->toBe(false);
    } finally {
        is_file($segno) && unlink($segno);
    }
});

// Seconda lettura della PR #20, B2: in una localizzazione come `en_US.UTF-8` `[0-9]` prende anche le cifre che non sono ASCII
// (`٤`, U+0664). Una patch scritta così passava la forma e poi il confronto, che dentro un `if` vale «falso» in silenzio, e lo
// script usciva 0 con una versione che non è il minimo. Lo script si mette da sé nella localizzazione `C`, dove una cifra è
// una di quelle dieci. Su una macchina che non ha `en_US.UTF-8` bash resta in `C`, e il caso è verde anche senza quella riga:
// per questo c'è anche il caso dopo, che la guarda nello script.
it('lo script del minimo legge solo cifre ASCII, in qualunque localizzazione giri: una cifra di un\'altra scrittura lo ferma (sprint 17 · review, B2)', function (string $localizzazione) {
    $ambiente = ['LC_ALL' => $localizzazione];

    expect(minimoDiZrAuthCon('^0.12.٤ || ^0.12.4', '0.12', $ambiente))->toBe([2, ''])
        ->and(minimoDiZrAuthCon('^0.12.4 || ^0.12.٤', '0.12', $ambiente))->toBe([2, ''])
        ->and(minimoDiZrAuthCon('^0.١٢.4', '0.١٢', $ambiente))->toBe([2, ''])
        ->and(minimoDiZrAuthCon('^0.12.4', '0.12', $ambiente))->toBe([0, '0.12.4']);
})->with(['en_US.UTF-8', 'C.UTF-8', 'C']);

it('lo script del minimo si mette nella localizzazione C prima di guardare una forma (sprint 17 · review, B2)', function () {
    $script = (string) file_get_contents(dirname(__DIR__, 2).'/.github/minimo-di-zr-auth.sh');
    $comandi = array_values(array_filter(array_map(trim(...), explode("\n", $script)), fn (string $riga): bool => $riga !== '' && ! str_starts_with($riga, '#')));

    // Il primo comando dopo `set -euo pipefail`: da lì in poi `[0-9]` sono le dieci cifre ASCII.
    expect(array_slice($comandi, 0, 2))->toBe(['set -euo pipefail', 'export LC_ALL=C']);
});

/**
 * Per ogni minore di zr-auth che un vincolo accetta, la versione più bassa che accetta: `^0.12.4` → `['0.12' => '0.12.4']`, e
 * senza la patch la prima della minore. È il conto di `.github/minimo-di-zr-auth.sh` rifatto qui: i due si controllano.
 *
 * @return array<string, string>
 */
function minimiDiZrAuthIn(string $vincolo): array
{
    preg_match_all('/\^(0\.\d+)(?:\.(\d+))?/', $vincolo, $pezzi, PREG_SET_ORDER);

    return array_column(array_map(fn (array $pezzo) => [$pezzo[1], $pezzo[1].'.'.($pezzo[2] ?? '0')], $pezzi), 1, 0);
}

/**
 * I numeri di patch di quelle minori di zr-auth che un testo scrive (`0.12.4` per la `0.12`), commenti compresi.
 *
 * @param  list<string>  $minori
 * @return list<string>
 */
function patchDiZrAuthScritteIn(string $testo, array $minori): array
{
    $scritte = [];
    foreach ($minori as $minore) {
        preg_match_all('/(?<![\d.])'.preg_quote($minore, '/').'\.\d+/', $testo, $numeri);
        $scritte = [...$scritte, ...$numeri[0]];
    }

    return $scritte;
}

it('il minimo che il giro «minima» installa è quello di composer.json: lo script, su composer.json, dice per ogni minore accettata la più bassa che il vincolo accetta, e ci.yml non scrive il numero di nessuna patch, nemmeno in un commento (sprint 17 · T3.2, T3.3)', function () {
    $radice = dirname(__DIR__, 2);
    $composer = json_decode((string) file_get_contents($radice.'/composer.json'), true, flags: JSON_THROW_ON_ERROR);
    $minimi = minimiDiZrAuthIn($composer['require']['zeiras/zr-auth']);
    $ci = (string) file_get_contents($radice.'/.github/workflows/ci.yml');

    $delloScript = [];
    foreach (array_keys($minimi) as $minore) {
        $script = new Process(['bash', '.github/minimo-di-zr-auth.sh', 'composer.json', $minore], $radice);
        $script->run();
        $delloScript[$minore] = trim($script->getOutput());
    }

    // Il minimo scritto a mano nel passo, al posto di ciò che dice lo script: quando il vincolo cambia, il giro installa quello
    // di prima. E un commento su quale patch ha provato un giro, com'era in ci.yml fino alla v1.3.0: nessun caso lo teneva vero.
    $unMinimo = array_values($minimi)[0] ?? '';
    $colMinimoScritto = str_replace('--with "zeiras/zr-auth:${minima}"', '--with "zeiras/zr-auth:'.$unMinimo.'"', $ci);
    $colCommentoAMano = $ci."      # la {$unMinimo} l'ha provata il giro di una versione di prima\n";

    expect($minimi)->not->toBe([])
        ->and($delloScript)->toBe($minimi)
        ->and(patchDiZrAuthScritteIn($ci, array_keys($minimi)))->toBe([])
        ->and($colMinimoScritto)->not->toBe($ci)
        ->and(patchDiZrAuthScritteIn($colMinimoScritto, array_keys($minimi)))->toBe([$unMinimo])
        ->and(patchDiZrAuthScritteIn($colCommentoAMano, array_keys($minimi)))->toBe([$unMinimo]);
});

/**
 * Lo script del passo «Dipendenze PHP» di ci.yml, cioè il suo blocco `run: |` senza il rientro: vuoto se il passo o il blocco
 * non ci sono.
 */
function passoDelleDipendenzePhp(string $ci): string
{
    if (preg_match('/^ {6}- name: Dipendenze PHP\n(?: {8}.*\n)*? {8}run: \|\n((?:(?: {10}.*)?\n)+)/m', $ci, $passo) !== 1) {
        return '';
    }

    return trim((string) preg_replace('/^ {10}/m', '', $passo[1]))."\n";
}

/**
 * Il passo «Dipendenze PHP» lanciato come lo lancia la CI (`bash -eo pipefail`), per quella minore e quella patch della matrice,
 * in una cartella con un composer.json che chiede zr-auth con quel vincolo, lo script del minimo e un Composer finto: scrive
 * ciò che gli si chiede e, a `composer show`, dice di aver installato quella versione.
 *
 * @return array{0: int|null, 1: list<string>, 2: string} il codice d'uscita, i vincoli chiesti a Composer con `--with`, ciò che il passo scrive
 */
function dipendenzePhpCon(string $vincolo, string $minore, string $patch, string $installata): array
{
    $radice = dirname(__DIR__, 2);
    $prova = sys_get_temp_dir().'/zr-core-passo-'.bin2hex(random_bytes(8));
    mkdir($prova.'/.github', 0700, true);
    mkdir($prova.'/bin', 0700);

    try {
        file_put_contents($prova.'/composer.json', json_encode(['require' => ['zeiras/zr-auth' => $vincolo]], JSON_THROW_ON_ERROR));
        copy($radice.'/.github/minimo-di-zr-auth.sh', $prova.'/.github/minimo-di-zr-auth.sh');
        file_put_contents($prova.'/passo.sh', passoDelleDipendenzePhp((string) file_get_contents($radice.'/.github/workflows/ci.yml')));
        file_put_contents($prova.'/bin/composer', <<<'BASH'
            #!/usr/bin/env bash
            printf '%s\n' "$*" >>chiesto
            if [ "$1" = show ]; then printf '{"versions":["%s"]}\n' "$INSTALLATA"; fi

            BASH);
        chmod($prova.'/bin/composer', 0700);

        $passo = new Process(['bash', '--noprofile', '--norc', '-eo', 'pipefail', 'passo.sh'], $prova, ['PATH' => $prova.'/bin:'.getenv('PATH'), 'ZR_AUTH' => $minore, 'PATCH' => $patch, 'INSTALLATA' => $installata]);
        $passo->run();
        preg_match_all('/^update .*--with (\S+)$/m', is_file($prova.'/chiesto') ? (string) file_get_contents($prova.'/chiesto') : '', $chiesti);

        return [$passo->getExitCode(), $chiesti[1], $passo->getOutput()];
    } finally {
        (new Filesystem)->deleteDirectory($prova);
    }
}

it('il passo delle dipendenze installa la versione del suo giro e si ferma se Composer ne ha installata un\'altra: «minima» chiede proprio la più bassa che composer.json accetta, «ultima» l\'ultima della minore (sprint 17 · T3.1, T3.2)', function (string $vincolo, string $minore, string $patch, string $installata, int $uscita, array $chiede) {
    [$codice, $chiesti, $scrive] = dipendenzePhpCon($vincolo, $minore, $patch, $installata);

    // Quando Composer è stato chiamato, il log dice quale versione ha installato: è la riga che si legge giro per giro.
    expect([$codice, $chiesti])->toBe([$uscita, $chiede])
        ->and(str_contains($scrive, "zr-auth installato: {$installata}\n"))->toBe($chiede !== []);
})->with([
    '«minima», col vincolo di oggi' => ['^0.12.4', '0.12', 'minima', 'v0.12.4', 0, ['zeiras/zr-auth:0.12.4']],
    '«minima», e Composer ne ha installata una più alta' => ['^0.12.4', '0.12', 'minima', 'v0.12.6', 1, ['zeiras/zr-auth:0.12.4']],
    '«minima», e Composer ne ha installata una che comincia allo stesso modo' => ['^0.12.4', '0.12', 'minima', 'v0.12.40', 1, ['zeiras/zr-auth:0.12.4']],
    '«minima», col minimo che scende' => ['^0.12.3', '0.12', 'minima', 'v0.12.3', 0, ['zeiras/zr-auth:0.12.3']],
    '«minima», col minimo che scende e la versione di prima installata' => ['^0.12.3', '0.12', 'minima', 'v0.12.4', 1, ['zeiras/zr-auth:0.12.3']],
    '«minima», col minimo che sale' => ['^0.12.5', '0.12', 'minima', 'v0.12.5', 0, ['zeiras/zr-auth:0.12.5']],
    '«minima», col minimo che sale e la versione di prima installata' => ['^0.12.5', '0.12', 'minima', 'v0.12.4', 1, ['zeiras/zr-auth:0.12.5']],
    '«minima», senza la patch nel vincolo' => ['^0.12', '0.12', 'minima', 'v0.12.0', 0, ['zeiras/zr-auth:0.12.0']],
    '«minima», di una minore fra due' => ['^0.11 || ^0.12.4', '0.11', 'minima', 'v0.11.0', 0, ['zeiras/zr-auth:0.11.0']],
    '«minima», di una minore che composer.json non accetta' => ['^0.12.4', '0.11', 'minima', 'v0.11.0', 1, []],
    '«ultima»' => ['^0.12.4', '0.12', 'ultima', 'v0.12.6', 0, ['zeiras/zr-auth:~0.12.0']],
    '«ultima», e Composer ha installato un\'altra minore' => ['^0.12.4', '0.12', 'ultima', 'v0.13.0', 1, ['zeiras/zr-auth:~0.12.0']],
    'un giro che il passo non conosce' => ['^0.12.4', '0.12', 'minimo', 'v0.12.4', 1, []],
]);

it('README e CLAUDE.md non dicono più che la CI prova zr-auth con l\'ultima patch soltanto: dicono la più bassa accettata e l\'ultima (sprint 17 · T3.3)', function (string $file, string $diPrima, string $alPostoDi) {
    $testo = suUnaRiga((string) file_get_contents(__DIR__.'/../../'.$file));
    // Il file con la frase di prima rimessa al posto di quella di adesso: il controllo la vede.
    $conLaFraseDiPrima = str_replace($alPostoDi, $diPrima, $testo);

    expect(substr_count($testo, $alPostoDi))->toBe(1)
        ->and(substr_count($testo, $diPrima))->toBe(0)
        ->and(substr_count($conLaFraseDiPrima, $diPrima))->toBe(1);
})->with([
    'README.md' => ['README.md', "(la CI lo prova con l'ultima 0.12)", "(la CI lo prova con la più bassa che questo vincolo accetta e con l'ultima 0.12)"],
    'CLAUDE.md' => ['CLAUDE.md', "la CI fa un giro per ogni versione minore accettata, con l'ultima di ognuna", "la CI fa due giri per ogni versione minore accettata, uno con l'ultima patch e uno con la più bassa che il vincolo accetta (la legge da `composer.json`)"],
]);

// Sprint 9 · T3 (voce #1398). `LayoutDellaCornice` e `useCornice` sono per i frontend con Inertia, ma zr-core non ne dipende:
// sono un componente e un hook di React. Inertia sta solo fra gli strumenti di questo repo, per la pagina di prova del layout
// (resources/demo), che non entra nello zip del tag: `@inertiajs/react`, e `@inertiajs/core` per l'errore con cui la parte
// server finta rifiuta una visita annullata. E il README dice come si usano.

/**
 * Cosa chiede package.json a chi installa (`peerDependencies`), e dove nomina un pacchetto di Inertia.
 *
 * @param  array<string, mixed>  $package
 * @return array{chiede: list<string>, inertia: list<string>}
 */
function dipendenzeDelPacchettoJs(array $package): array
{
    $inertia = [];
    foreach (['dependencies', 'peerDependencies', 'optionalDependencies', 'devDependencies'] as $gruppo) {
        foreach (array_keys($package[$gruppo] ?? []) as $nome) {
            if (str_starts_with((string) $nome, '@inertiajs/')) {
                $inertia[] = "{$gruppo}: {$nome}";
            }
        }
    }

    return ['chiede' => array_keys($package['peerDependencies'] ?? []), 'inertia' => $inertia];
}

/**
 * I file che nominano un pacchetto di Inertia, fra quelli che entrano nello zip del tag: i test (`*.test.ts`, `*.test.tsx`)
 * sono `export-ignore`, e possono.
 *
 * @param  array<string, string>  $file  percorso → contenuto
 * @return list<string>
 */
function fileDelPacchettoConInertia(array $file): array
{
    return array_keys(array_filter(
        $file,
        fn (string $contenuto, string $percorso) => preg_match('/\.test\.tsx?$/', $percorso) !== 1 && str_contains($contenuto, '@inertiajs'),
        ARRAY_FILTER_USE_BOTH,
    ));
}

/**
 * Dove il lock installa un pacchetto: una voce per copia, quella in cima a `node_modules` e quelle sotto un altro pacchetto.
 *
 * @param  array<string, mixed>  $lock
 * @return list<string>
 */
function copieNelLock(array $lock, string $pacchetto): array
{
    return array_values(array_filter(
        array_keys($lock['packages']),
        fn (string $percorso) => $percorso === "node_modules/{$pacchetto}" || str_ends_with($percorso, "/node_modules/{$pacchetto}"),
    ));
}

it('la pagina di prova del layout fa visite vere di Inertia, la versione dei frontend: router.visit, mai router.push, e per client HTTP la parte server finta, che legge i dati col segno dell\'indirizzo (sprint 9 · T3.1; sprint 10 · T3.1, T3.2)', function () {
    $pagina = (string) file_get_contents(__DIR__.'/../../resources/demo/layout.tsx');
    $lock = json_decode((string) file_get_contents(__DIR__.'/../../package-lock.json'), true, flags: JSON_THROW_ON_ERROR);
    $importati = fn (string $da): array => nomiFraLeGraffe('/^import \{([^}]*)\} from \''.preg_quote($da, '/').'\';$/m', $pagina);
    // Quante volte la pagina scrive ognuna di queste cose. Con `router.push`, come nella v1.2.0, le visite non passerebbero dalla
    // risposta di Inertia: lì Inertia non ridà l'oggetto di prima, e il difetto non si vedrebbe nemmeno senza il segno. Ciò che
    // la parte server finta fa (il segno a ogni lettura, `?segno=no`, la visita annullata) lo prova il suo test, in vitest: qui,
    // che la pagina la usa, col segno letto dal suo indirizzo, e che ciò che il client risponde a una visita è una lettura
    // (`leggi`), come la pagina iniziale: se rispondesse i dati così come sono, le visite uscirebbero senza segno.
    $scritte = fn (array $cose): array => array_combine($cose, array_map(fn (string $cosa) => substr_count($pagina, $cosa), $cose));

    expect($importati('@inertiajs/react'))->toBe(['createInertiaApp', 'http', 'router'])
        ->and($importati('./parte-server-finta'))->toBe(['chiaveDellaSessione', 'clientFinto', 'colSegno', 'conIlSegnoDellaLingua', 'conLaSessione', 'fermaIlSegno', 'istanteDellaLettura', 'lettura', 'sessioneFinta'])
        ->and($scritte(['createInertiaApp({', 'router.visit(', 'router.push(', 'http.setClient(', 'http.setClient(clientFinto(']))->toBe([
            'createInertiaApp({' => 1,
            'router.visit(' => 1,
            'router.push(' => 0,
            'http.setClient(' => 1,
            'http.setClient(clientFinto(' => 1,
        ])
        ->and($scritte(['colSegno(', 'const segno = colSegno(window.location.search);', 'lettura(', 'lettura(propsDi[nome], segno)']))->toBe([
            'colSegno(' => 1,
            'const segno = colSegno(window.location.search);' => 1,
            'lettura(' => 1,
            'lettura(propsDi[nome], segno)' => 1,
        ])
        // Dallo sprint 46 (T3) le risposte passano da `leggiConLaLingua`, che chiama `leggi` e ci mette il segno della lingua.
        ->and($scritte(['leggiConLaLingua(', 'leggi(', 'props: { errors: {}, ...letta, visita: visite }', 'props: { errors: {}, ...leggiConLaLingua(iniziale), visita: visite }']))->toBe([
            'leggiConLaLingua(' => 3,
            'leggi(' => 2,
            'props: { errors: {}, ...letta, visita: visite }' => 1,
            'props: { errors: {}, ...leggiConLaLingua(iniziale), visita: visite }' => 1,
        ])
        ->and(substr((string) $lock['packages']['node_modules/@inertiajs/react']['version'], 0, 4))->toBe('3.7.');
});

/**
 * Quante volte un file della pagina di prova scrive ognuna di queste cose. Ciò che il client finto e le rotte finte fanno coi
 * due tempi e con l'orologio lo provano i loro test, in vitest: i casi qui sotto, che la pagina di prova li usa così, e che ha
 * gli appigli che le righe della UAT cliccano.
 *
 * @param  list<string>  $cose
 * @return array<string, int>
 */
function scritteNellaPaginaDiProva(string $file, array $cose): array
{
    $testo = (string) file_get_contents(__DIR__.'/../../resources/demo/'.$file);

    return array_combine($cose, array_map(fn (string $cosa) => substr_count($testo, $cosa), $cose));
}

it('sulla pagina di prova del layout una visita è letta quando arriva alla parte server finta, e contata solo quando la risposta è pronta (sprint 11 · T3.1)', function () {
    // La lettura sta prima della funzione che il client chiama alla consegna, e fuori: lì dentro si conta soltanto. Letta alla
    // consegna, una visita lenta porterebbe il segno di quando arriva, non di quando è partita; contata alla lettura, una
    // visita annullata conterebbe.
    $allArrivo = "    const letta = leggiConLaLingua(nome);\n\n    return () => {\n        montaggi = 0;\n        visite += 1;\n";

    expect(scritteNellaPaginaDiProva('layout.tsx', [$allArrivo, 'visite += 1;']))->toBe([$allArrivo => 1, 'visite += 1;' => 1]);
});

it('la pagina di prova del layout ha la visita lenta, di sei secondi, alla Corta e alla Lunga (sprint 11 · T3.1)', function () {
    $allaCorta = "<a href={indirizzoDi('corta', attesaLenta)} data-uat=\"vai-corta-lenta\" onClick={apri('corta', false, attesaLenta)}>UAT alla Corta lenta</a>";
    $allaLunga = "<a href={indirizzoDi('lunga', attesaLenta)} data-uat=\"vai-lunga-lenta\" onClick={apri('lunga', false, attesaLenta)}>UAT alla Lunga lenta</a>";

    expect(scritteNellaPaginaDiProva('layout.tsx', [$allaCorta, 'data-uat="vai-corta-lenta"', $allaLunga, 'data-uat="vai-lunga-lenta"']))->toBe([
        $allaCorta => 1,
        'data-uat="vai-corta-lenta"' => 1,
        $allaLunga => 1,
        'data-uat="vai-lunga-lenta"' => 1,
    ])
        // I sei secondi finiscono nell'indirizzo della visita, dove la parte server finta li legge.
        ->and(scritteNellaPaginaDiProva('layout.tsx', ['const attesaLenta = 6000;', "parametri.set('lenta', String(lenta));", 'router.visit(indirizzoDi(nome, lenta), { preserveScroll });']))->toBe([
            'const attesaLenta = 6000;' => 1,
            "parametri.set('lenta', String(lenta));" => 1,
            'router.visit(indirizzoDi(nome, lenta), { preserveScroll });' => 1,
        ]);
});

it('la pagina di prova del layout scarica prima la Corta col prefetch di Inertia, allo stesso indirizzo della visita, e la tiene trenta secondi (sprint 11 · T3.1)', function () {
    $scarica = "<button type=\"button\" data-uat=\"prefetch-corta\" onClick={() => router.prefetch(indirizzoDi('corta'), {}, { cacheFor: 30_000 })}>UAT scarica prima la Corta</button>";

    expect(scritteNellaPaginaDiProva('layout.tsx', [$scarica, 'data-uat="prefetch-corta"', 'router.prefetch(']))->toBe([
        $scarica => 1,
        'data-uat="prefetch-corta"' => 1,
        'router.prefetch(' => 1,
    ]);
});

it('le rotte finte della pagina di prova del layout dicono quando sull\'orologio dei dati, e con ?segno=no non hanno un orologio (sprint 11 · T3.1)', function () {
    // Dallo sprint 37 · T1 le rotte ricevono anche la persona della «sessione», dopo l'orologio; da T4, con la sua email.
    $conOrologio = 'export function rotteFinte(slugDellaSessione: () => string | undefined, istante?: () => string, personaDellaSessione?: () => { nome: string; email?: string } | undefined): void {';

    expect(scritteNellaPaginaDiProva('layout.tsx', ['rotteFinte(', 'segno ? istanteDellaLettura : undefined, ']))->toBe(['rotteFinte(' => 1, 'segno ? istanteDellaLettura : undefined, ' => 1])
        ->and(scritteNellaPaginaDiProva('rotte-finte.ts', [$conOrologio, 'aggiornati_il: ', 'segnate_il: ']))->toBe([$conOrologio => 1, 'aggiornati_il: ' => 1, 'segnate_il: ' => 1]);
});

// Sprint 37 · T1.1 (voci #1993, #1998, #1999): i comandi che servono alla prova nel browser di due persone su due workspace e
// di una scheda rimasta ferma. Che cosa fa la «sessione» lo prova parte-server-finta.test.ts, che cosa rispondono le rotte
// rotte-finte.test.ts; qui, che la pagina di prova li usa: ci sono solo con `?sessione`, e senza la pagina è quella di prima.
it('la pagina di prova del layout, con ?sessione, fa entrare l\'altra persona su un altro workspace, rilegge il solo dopo e dice alle rotte finte chi è entrato (sprint 37 · T1.1)', function () {
    $altrove = '<button type="button" data-uat="entra-altrove" onClick={() => localStorage.setItem(chiaveDellaSessione, \'altrove\')}>';
    $rileggi = '<button type="button" data-uat="rileggi-dopo" onClick={chiediDopo}>UAT rileggi dopo</button>';
    $letta = '    return conLaSessione({ ...letta, ...dellaSessione, ...delBackoffice }, entrata());';
    $delleRotte = '    const { cornice, subito } = conLaSessione(propsDi[paginaDellIndirizzo()], entrata());';
    $chiEEntrato = "scelti.has('sessione') ? () => sessioneDelleRotte()?.persona : undefined);";

    expect(scritteNellaPaginaDiProva('layout.tsx', [$altrove, 'data-uat="entra-altrove"', $rileggi, 'data-uat="rileggi-dopo"', "router.reload({ only: ['dopo'] });", 'chiediDopo();']))->toBe([
        $altrove => 1,
        'data-uat="entra-altrove"' => 1,
        $rileggi => 1,
        'data-uat="rileggi-dopo"' => 1,
        "router.reload({ only: ['dopo'] });" => 1,
        'chiediDopo();' => 1,
    ])
        // Le due letture della «sessione»: i dati di una visita e ciò che le rotte finte rispondono vengono dalla stessa.
        ->and(scritteNellaPaginaDiProva('layout.tsx', [$letta, $delleRotte, 'conLaSessione(', $chiEEntrato]))->toBe([
            $letta => 1,
            $delleRotte => 1,
            'conLaSessione(' => 2,
            $chiEEntrato => 1,
        ])
        // Dallo sprint 40 (T5) gli stati della «sessione» stanno nella parte server finta, dove un caso li legge.
        ->and(scritteNellaPaginaDiProva('parte-server-finta.ts', ["['altrove', {", 'workspace: altrove,']))->toBe(["['altrove', {" => 1, 'workspace: altrove,' => 1])
        // Dietro `?sessione`, quattro volte in tutto: il collegamento alla «Due dati», i pulsanti di chi entra, «UAT rileggi dopo»
        // e la persona data alle rotte finte.
        ->and(scritteNellaPaginaDiProva('layout.tsx', ["scelti.has('sessione')"]))->toBe(["scelti.has('sessione')" => 4]);
});

// Sprint 38 · T1 (voci #2026, #2027, #2028): tre comandi in più per vedere nel browser ciò che resta fra due persone e una
// pagina. Che cosa fanno lo provano rotte-finte.test.ts e parte-server-finta.test.ts; qui, che la pagina di prova li ha: se il
// 403 finto valesse per tutte e due le persone, o se «UAT rileggi subito» chiedesse anche `dopo`, i difetti non si vedrebbero.
it('la pagina di prova del layout, con ?sessione, rilegge il solo subito, dà gli errori delle rotte finte solo a chi è entrato dopo e tiene nel browser le notifiche lette di ognuna (sprint 38 · T1.1)', function () {
    $subito = '<button type="button" data-uat="rileggi-subito" onClick={() => router.reload({ only: [\'subito\'] })}>UAT rileggi subito</button>';
    $altraDaAccettare = "scelti.get('accettazione') === 'dopo' && scelti.has('per_altra')";
    $perAltra = "const soloPerLAltra = new URLSearchParams(window.location.search).has('per_altra');";
    $aChiTocca = 'const toccaAChiCE = () => !soloPerLAltra || personaDellaSessione?.()?.email !== laPrima;';

    expect(scritteNellaPaginaDiProva('layout.tsx', [$subito, 'data-uat="rileggi-subito"', $altraDaAccettare]))->toBe([$subito => 1, 'data-uat="rileggi-subito"' => 1, $altraDaAccettare => 1])
        // Il 403 e il 429 passano tutti dalla stessa domanda: il 429 della ricerca, il 403 della ricerca e quello delle altre tre.
        ->and(scritteNellaPaginaDiProva('rotte-finte.ts', [$perAltra, $aChiTocca, '&& toccaAChiCE()) {', 'localStorage.getItem(chiave) !== null', 'const chiave = `uat-letta-di-${breve.toLowerCase()}`;']))->toBe([
            $perAltra => 1,
            $aChiTocca => 1,
            '&& toccaAChiCE()) {' => 3,
            'localStorage.getItem(chiave) !== null' => 1,
            'const chiave = `uat-letta-di-${breve.toLowerCase()}`;' => 1,
        ]);
});

// Sprint 40 · T5 (voce #2002): un quarto pulsante lascia la persona che c'è e le cambia la lingua, per una riga di UAT sulla
// lingua senza una variante della pagina fatta a mano. Che cosa dà ogni stato della «sessione» lo prova
// parte-server-finta.test.ts, che li legge tutti e quattro; qui, che la pagina di prova prende gli stati da lì e non ne tiene
// di suoi: se li tenesse, il caso leggerebbe una «sessione» che la pagina non usa.
it('la pagina di prova del layout, con ?sessione, lascia la stessa persona con un\'altra lingua, e gli stati della sessione sono quelli della parte server finta (sprint 40 · T5.1)', function () {
    $lingua = '<button type="button" data-uat="entra-lingua" onClick={() => localStorage.setItem(chiaveDellaSessione, \'lingua\')}>UAT la stessa persona cambia lingua</button>';
    $stati = "const entrata = sessioneFinta({ sessione: diUnAltra, backoffice: delBackofficeDiUnAltra }, ricerca, 'es');";
    $laLingua = "['lingua', { sessione: { lingua: altraLingua }, backoffice: {} }],";

    expect(scritteNellaPaginaDiProva('layout.tsx', [$lingua, 'data-uat="entra-lingua"', $stati, 'sessioneFinta(', 'new Map<string, Entrata>(', 'const chiaveDellaSessione', 'localStorage.getItem(']))->toBe([
        $lingua => 1,
        'data-uat="entra-lingua"' => 1,
        $stati => 1,
        'sessioneFinta(' => 1,
        'new Map<string, Entrata>(' => 0,
        'const chiaveDellaSessione' => 0,
        'localStorage.getItem(' => 0,
    ])
        ->and(scritteNellaPaginaDiProva('parte-server-finta.ts', ["export const chiaveDellaSessione = 'uat-persona';", "['altra', altra],", $laLingua, "entrate.get(localStorage.getItem(chiaveDellaSessione) ?? '')"]))->toBe([
            "export const chiaveDellaSessione = 'uat-persona';" => 1,
            "['altra', altra]," => 1,
            $laLingua => 1,
            "entrate.get(localStorage.getItem(chiaveDellaSessione) ?? '')" => 1,
        ]);
});

// Sprint 46 · T3 (voce #2067): la parte server finta dà il segno della lingua e, con `?segno=fermo`, lo stesso segno a ogni
// lettura. Che cosa fanno lo prova parte-server-finta.test.ts; qui, che la pagina di prova li usa: ogni risposta passa da
// `conIlSegnoDellaLingua` (anche la prima pagina), il segno fermo lo decide l'indirizzo, e il pulsante della lingua di prima
// c'è una volta, con la sua rilettura del solo `subito`. Se una risposta uscisse senza, la lingua nel browser non avrebbe il
// suo segno e le righe della UAT non distinguerebbero.
it('la pagina di prova del layout dà il segno della lingua a ogni risposta, ferma il segno con ?segno=fermo e rilegge subito con la lingua di prima (sprint 46 · T3.4)', function () {
    $diPrima = '<button type="button" data-uat="rileggi-subito-lingua-di-prima" onClick={rileggiSubitoConLaLinguaDiPrima}>UAT rileggi subito con la lingua di prima</button>';
    $conLaLingua = '    return segno ? conIlSegnoDellaLingua(letta, diPrima) : letta;';

    expect(scritteNellaPaginaDiProva('layout.tsx', [$diPrima, 'data-uat="rileggi-subito-lingua-di-prima"', $conLaLingua, "fermaIlSegno(scelti.get('segno') === 'fermo');", "router.reload({ only: ['subito'] });"]))->toBe([
        $diPrima => 1,
        'data-uat="rileggi-subito-lingua-di-prima"' => 1,
        $conLaLingua => 1,
        "fermaIlSegno(scelti.get('segno') === 'fermo');" => 1,
        "router.reload({ only: ['subito'] });" => 1,
    ])
        ->and(scritteNellaPaginaDiProva('parte-server-finta.ts', ["const chiaveDelleLingue = 'uat-lingue';", 'if (!(segnoFermo && ultimaLettura)) {']))->toBe([
            "const chiaveDelleLingue = 'uat-lingue';" => 1,
            'if (!(segnoFermo && ultimaLettura)) {' => 1,
        ]);
});

it('la parte server finta rifiuta una visita annullata con l\'errore dell\'Inertia che fa le visite: lo importa da @inertiajs/core, e nel lock ce n\'è una copia sola (sprint 10 · T3.1, review della PR)', function () {
    $parteServer = (string) file_get_contents(__DIR__.'/../../resources/demo/parte-server-finta.ts');
    $lock = json_decode((string) file_get_contents(__DIR__.'/../../package-lock.json'), true, flags: JSON_THROW_ON_ERROR);

    // Un lock con una seconda copia, sotto `@inertiajs/react`: il router riconoscerebbe l'errore della sua, non quello della
    // copia in cima, e una visita annullata sulla pagina di prova diventerebbe un errore di rete.
    $conDueCopie = $lock;
    $conDueCopie['packages']['node_modules/@inertiajs/react/node_modules/@inertiajs/core'] = ['version' => '3.7.2'];

    expect(nomiFraLeGraffe('/^import \{([^}]*)\} from \'@inertiajs\/core\';$/m', $parteServer))->toBe(['HttpCancelledError', 'HttpClient'])
        ->and(substr_count($parteServer, 'new HttpCancelledError('))->toBe(1)
        ->and(copieNelLock($lock, '@inertiajs/core'))->toBe(['node_modules/@inertiajs/core'])
        ->and(copieNelLock($lock, '@inertiajs/react'))->toBe(['node_modules/@inertiajs/react'])
        ->and(copieNelLock($conDueCopie, '@inertiajs/core'))->toBe(['node_modules/@inertiajs/core', 'node_modules/@inertiajs/react/node_modules/@inertiajs/core']);
});

it('il pacchetto non dipende da Inertia: a chi installa chiede solo react e react-dom, e Inertia sta fra gli strumenti di questo repo (sprint 9 · T3.2)', function () {
    $package = json_decode((string) file_get_contents(__DIR__.'/../../package.json'), true, flags: JSON_THROW_ON_ERROR);

    // Inertia finita fra ciò che il pacchetto chiede a chi lo installa, o fra ciò che porta con sé.
    $chiesta = $package;
    $chiesta['peerDependencies']['@inertiajs/react'] = $package['devDependencies']['@inertiajs/react'];
    unset($chiesta['devDependencies']['@inertiajs/react']);
    $portata = $package;
    $portata['dependencies'] = ['@inertiajs/core' => '^3.7.1'];

    expect(dipendenzeDelPacchettoJs($package))->toBe(['chiede' => ['react', 'react-dom'], 'inertia' => ['devDependencies: @inertiajs/core', 'devDependencies: @inertiajs/react']])
        ->and(dipendenzeDelPacchettoJs($chiesta))->toBe(['chiede' => ['react', 'react-dom', '@inertiajs/react'], 'inertia' => ['peerDependencies: @inertiajs/react', 'devDependencies: @inertiajs/core']])
        ->and(dipendenzeDelPacchettoJs($portata))->toBe(['chiede' => ['react', 'react-dom'], 'inertia' => ['dependencies: @inertiajs/core', 'devDependencies: @inertiajs/core', 'devDependencies: @inertiajs/react']]);
});

it('nessun file di resources/js che entra nello zip nomina Inertia (sprint 9 · T3.2)', function () {
    $file = [];
    foreach (File::allFiles(__DIR__.'/../../resources/js') as $uno) {
        $file[$uno->getRelativePathname()] = $uno->getContents();
    }

    // Una pagina e un hook che importano Inertia, un test che la importa (non entra nello zip) e un file che non la nomina.
    $conInertia = [
        'pagina.tsx' => "import { router } from '@inertiajs/react';\n",
        'pagina.test.tsx' => "import { router } from '@inertiajs/react';\n",
        'sotto/hook.ts' => "import type { Page } from '@inertiajs/core';\n",
        'sotto/hook.test.ts' => "import type { Page } from '@inertiajs/core';\n",
        'altro.ts' => "// Di Inertia sa solo il nome.\nexport {};\n",
    ];

    expect(array_keys($file))->toContain('layout.tsx')
        ->and(array_keys($file))->toContain('layout.test.tsx')
        ->and(fileDelPacchettoConInertia($file))->toBe([])
        ->and(fileDelPacchettoConInertia($conInertia))->toBe(['pagina.tsx', 'sotto/hook.ts']);
});

/**
 * Un punto dell'elenco che il README mette sotto «La cornice montata una volta sola»: quello che comincia con quel grassetto,
 * su una riga sola. Vuoto se il titolo o il punto non ci sono.
 */
function puntoDelLayout(string $readme, string $grassetto): string
{
    preg_match('/^### La cornice montata una volta sola$(.*?)(?=^#{2,3} |\z)/ms', $readme, $paragrafo);
    preg_match('/^- \*\*'.preg_quote($grassetto, '/').'\*\*.*?(?=^- |^$|\z)/ms', $paragrafo[1] ?? '', $punto);

    return trim((string) preg_replace('/\s+/', ' ', $punto[0] ?? ''));
}

/**
 * Le parole che un testo non dice, fra quelle date.
 *
 * @param  list<string>  $parole
 * @return list<string>
 */
function paroleCheMancanoIn(string $testo, array $parole): array
{
    return array_values(array_filter($parole, fn (string $parola) => ! str_contains($testo, $parola)));
}

it('il README dice come si usa il layout della cornice, una cosa per punto (sprint 9 · T3.3)', function (string $grassetto, array $parole, array $negata) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $punto = puntoDelLayout($readme, $grassetto);

    // Il README senza quel punto; poi, una alla volta, il punto senza una delle sue parole; poi il punto che dice il contrario.
    $senzaIlPunto = str_replace("- **{$grassetto}**", '- **Altro**', $readme);
    $cheDiceIlContrario = str_replace($negata[0], $negata[1], $punto);

    expect(paroleCheMancanoIn($punto, $parole))->toBe([])
        ->and($senzaIlPunto)->not->toBe($readme)
        ->and(paroleCheMancanoIn(puntoDelLayout($senzaIlPunto, $grassetto), $parole))->toBe($parole)
        ->and($cheDiceIlContrario)->not->toBe($punto)
        ->and(paroleCheMancanoIn($cheDiceIlContrario, $parole))->toBe([$parole[0]]);
    foreach ($parole as $parola) {
        expect(paroleCheMancanoIn(str_replace($parola, '', $punto), $parole))->toBe([$parola]);
    }
})->with([
    // Di ogni punto la frase intera, dal grassetto: le stesse parole con un «non» davanti non passano.
    '(a) LayoutDellaCornice in un componente a livello di modulo, dato a createInertiaApp' => ['Il layout', ['**Il layout** del frontend rende `LayoutDellaCornice` ed è un componente a livello di modulo, dato a `createInertiaApp({ layout })`'], ['ed è un componente', 'e non è un componente']],
    '(b) useCornice con le sette cose che accetta' => ['La pagina', ['**La pagina** dà alla cornice montata ciò che sa solo lei, con `useCornice`', '`nav`', '`active`', '`onNavigate`', '`create`', '`createLabel`', '`actions`', '`flush`'], ['dà alla cornice montata', 'non dà alla cornice montata']],
    '(c) il percorso si dà dal layout' => ['Il percorso', ['**Il percorso** (`crumbs`, `onCrumb`) si dà dal layout, non con `useCornice`'], ['si dà dal layout', 'non si dà dal layout']],
    '(d) una <Cornice> rimasta in una pagina fa due cornici' => ['Una `<Cornice>` rimasta in una pagina', ['**Una `<Cornice>` rimasta in una pagina** sotto il layout fa due cornici'], ['fa due cornici', 'non fa due cornici']],
    '(e) le voci con un indirizzo sono link veri: la pagina si ricarica' => ['Le voci con un indirizzo', ['**Le voci con un indirizzo** (la Dashboard, i prodotti, «Impostazioni» in fondo alla barra) sono link veri: il browser ricarica la pagina'], ['sono link veri', 'non sono link veri']],
    '(f) senza dati la barra minima è provvisoria, un pezzo a richiesta, e costa 126 byte (sprint 68 · T1.7; patch v2.24.1)' => ['Senza dati: la barra minima', ['**È provvisoria**: il design system non ha ancora la sua barra minima', '**Senza dati: la barra minima**, provvisoria (dalla `v2.24.0`)', '(`barra`, 420 byte con gzip)', 'Costa 126 byte con gzip nel JS d\'ingresso di chi usa il layout con React fuori'], ['È provvisoria', 'Non è provvisoria']],
]);

it('le sette cose che il README dice di useCornice sono quelle che accetta nel codice (sprint 9 · T3.3; sprint 74 · T6.1)', function () {
    $layout = (string) file_get_contents(__DIR__.'/../../resources/js/layout.tsx');
    preg_match('/^const nomiDellaPagina = \[([^\]]*)\] as const;$/m', $layout, $elenco);
    preg_match_all('/\'(\w+)\'/', $elenco[1] ?? '', $nomi);

    expect($nomi[1])->toBe(['nav', 'active', 'onNavigate', 'create', 'createLabel', 'actions', 'flush']);
});

// Sprint 68 · T2 (voce #2115): una pagina che è insieme la rotta di `entra()` e quella della richiesta rimandata.
it('il README e la guida dicono dove va il blocco della sessione quando la pagina è anche la rotta di entra(), senza contraddire il divieto sulla richiesta rimandata (sprint 68 · T2.1)', function () {
    $readme = suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md'));
    $guida = suUnaRiga((string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md'));

    expect($readme)->toContain(
        'il blocco della sessione (`bloccaSessione()`, il `Route::block` di Laravel) va sulla visita intera e mai sulla richiesta parziale `dopo`',
        'a condizione che la parziale non chiami `entra()`',
        'salvo la pagina che è anche la rotta di `entra()`',
        'Sulla rotta della richiesta rimandata il frontend non mette niente',
    )
        ->and($guida)->toContain(
            'il blocco va sulla visita intera e mai sulla richiesta parziale `dopo`, e solo se la parziale non chiama `entra()`',
            'Sulla rotta della richiesta rimandata non mettere niente, nemmeno `bloccaSessione()`',
        );
});

/** Il punto «La campanella» del README, com'è scritto: dal grassetto al punto dopo. Vuoto se non c'è. */
function puntoDellaCampanella(string $readme): string
{
    preg_match('/^- \*\*La campanella\*\*.*?(?=^- |^$|\z)/ms', $readme, $punto);

    return $punto[0] ?? '';
}

/** Un testo su una riga sola: una frase del README si trova anche dove va a capo. */
function suUnaRiga(string $testo): string
{
    return trim((string) preg_replace('/\s+/', ' ', $testo));
}

it('il README dice che cos\'è aggiornati_il, che i dati si danno alla cornice così come arrivano, e che alla visita dopo sulla campanella vale il numero dei dati anche quando è lo stesso (sprint 10 · T2.5, review della PR; il limite di allora: sprint 11 · T2.7)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $cosaDice = function (string $testo): array {
        preg_match('/^\| `\{lingua, .*\}` \| la persona è entrata in un workspace \|$/m', $testo, $rigaDeiDati);

        return [
            'il segno nella riga dei dati' => str_contains($rigaDeiDati[0] ?? '', 'non_lette, aggiornati_il}`'),
            'che cos\'è il segno' => str_contains(suUnaRiga($testo), '`aggiornati_il` è il segno della lettura: l\'istante in cui la parte server ha cominciato a leggere i dati, in UTC coi microsecondi'),
            'i dati così come arrivano' => str_contains(suUnaRiga($testo), 'I dati si danno alla cornice così come arrivano, a ogni richiesta'),
            'la campanella: anche quando è lo stesso' => str_contains(suUnaRiga(puntoDellaCampanella($testo)), 'vale il loro numero, anche quando è lo stesso di prima'),
            'il difetto della v1.2.0' => str_contains(suUnaRiga($testo), 'resta ciò che c\'era'),
        ];
    };

    // Il README col punto della campanella della v1.2.0, che dichiarava il difetto; e il README che non nomina il segno.
    $campanellaDellaV120 = <<<'MD'
    - **La campanella** mostra le non lette dei dati (`non_lette`), «99+» oltre 99, e mai meno delle non lette dell'ultimo
      elenco che il pannello ha caricato con quegli stessi dati (una notifica può essere arrivata dopo). Coi dati nuovi — una
      visita dopo, se il frontend tiene montata la cornice — vale il loro numero. Per la cornice i dati sono nuovi quando è
      nuovo l'oggetto, e Inertia ridà l'oggetto di prima quando una visita allo stesso componente porta dati uguali: allora
      sulla campanella resta ciò che c'era (dopo «Segna tutte come lette» nessun numero, anche se nel frattempo è arrivata una
      notifica), finché il numero del backoffice cambia, si apre la campanella o una visita porta a un altro componente.

    MD;
    $dellaV120 = str_replace(puntoDellaCampanella($readme), $campanellaDellaV120, $readme);
    $senzaIlSegno = str_replace('aggiornati_il', 'altro', $readme);

    expect(puntoDellaCampanella($readme))->not->toBe('')
        ->and($cosaDice($readme))->toBe([
            'il segno nella riga dei dati' => true,
            'che cos\'è il segno' => true,
            'i dati così come arrivano' => true,
            'la campanella: anche quando è lo stesso' => true,
            'il difetto della v1.2.0' => false,
        ])
        ->and($cosaDice($dellaV120))->toBe([
            'il segno nella riga dei dati' => true,
            'che cos\'è il segno' => true,
            'i dati così come arrivano' => true,
            'la campanella: anche quando è lo stesso' => false,
            'il difetto della v1.2.0' => true,
        ])
        ->and($cosaDice($senzaIlSegno))->toBe([
            'il segno nella riga dei dati' => false,
            'che cos\'è il segno' => false,
            'i dati così come arrivano' => true,
            'la campanella: anche quando è lo stesso' => true,
            'il difetto della v1.2.0' => false,
        ]);
});

it('il README dice che la cornice confronta i segni e non torna a dati più vecchi, dove vale e dove non arriva, e che i server del frontend devono avere l\'ora allineata; il limite della v1.2.1 non c\'è più (sprint 11 · T2.7)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $cosaDice = function (string $testo): array {
        $campanella = suUnaRiga(puntoDellaCampanella($testo));

        return [
            'confronta i segni e non torna a dati più vecchi' => str_contains($campanella, 'La cornice confronta i segni e non torna a dati più vecchi'),
            'una risposta letta prima del clic non rimette il numero' => str_contains($campanella, 'una risposta letta prima del clic — una visita già partita, o una pagina che il `prefetch` di Inertia tiene — non rimette il numero'),
            'dove vale' => str_contains($campanella, 'Vale dove la cornice resta montata'),
            'dove non arriva' => str_contains($campanella, 'con la cornice montata da ogni pagina quella nuova non sa niente di prima, e Indietro porta ancora il numero di allora'),
            'gli orologi' => str_contains($campanella, 'i server del frontend devono avere l\'ora allineata'),
            'il limite della v1.2.1' => str_contains($campanella, 'la cornice non confronta i segni') || str_contains($campanella, 'rimette sulla campanella il numero di prima'),
        ];
    };

    // Il README col punto della campanella della v1.2.1, che dichiarava il limite.
    $campanellaDellaV121 = <<<'MD'
    - **La campanella** mostra le non lette dei dati (`non_lette`), «99+» oltre 99, e mai meno delle non lette dell'ultimo
      elenco che il pannello ha caricato con quegli stessi dati (una notifica può essere arrivata dopo). Coi dati nuovi — una
      visita dopo, se il frontend tiene montata la cornice — vale il loro numero, anche quando è lo stesso di prima: dopo
      «Segna tutte come lette» la campanella non ha un numero, e alla visita dopo mostra quello dei dati. Per la cornice i dati
      sono nuovi quando è nuovo l'oggetto, e Inertia ridà l'oggetto di prima quando una visita allo stesso componente porta
      dati uguali: per questo ogni lettura ha il suo segno (`aggiornati_il`), che la rende diversa dalle altre. Un limite
      noto: la cornice non confronta i segni, e ogni risposta vale come dati nuovi, anche quando è stata letta prima di
      un'azione e arriva dopo. Dopo «Segna tutte come lette», una risposta letta prima del clic — una visita già partita, o
      una pagina che il `prefetch` di Inertia tiene — rimette sulla campanella il numero di prima, fino alla visita dopo; e
      con Indietro e Avanti del browser la pagina ripresa dalla cronologia porta i dati di allora, col numero di allora.

    MD;
    $dellaV121 = str_replace(puntoDellaCampanella($readme), $campanellaDellaV121, $readme);

    expect(puntoDellaCampanella($readme))->not->toBe('')
        ->and($cosaDice($readme))->toBe([
            'confronta i segni e non torna a dati più vecchi' => true,
            'una risposta letta prima del clic non rimette il numero' => true,
            'dove vale' => true,
            'dove non arriva' => true,
            'gli orologi' => true,
            'il limite della v1.2.1' => false,
        ])
        ->and($cosaDice($dellaV121))->toBe([
            'confronta i segni e non torna a dati più vecchi' => false,
            'una risposta letta prima del clic non rimette il numero' => false,
            'dove vale' => false,
            'dove non arriva' => false,
            'gli orologi' => false,
            'il limite della v1.2.1' => true,
        ]);
});

/**
 * I nomi fra le graffe delle righe che combaciano, senza `type`: quelli che un esempio importa, o che l'ingresso esporta.
 *
 * @return list<string>
 */
function nomiFraLeGraffe(string $regex, string $testo): array
{
    preg_match_all($regex, $testo, $righe);
    $nomi = array_map(fn (string $nome) => trim((string) preg_replace('/^\s*type\s+/', '', $nome)), explode(',', implode(',', $righe[1])));

    return array_values(array_unique(array_filter($nomi, fn (string $nome) => $nome !== '')));
}

it('il README importa dall\'ingresso di zr-core solo nomi che l\'ingresso esporta, e l\'ingresso esporta LayoutDellaCornice e useCornice (sprint 9 · T3.3)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $ingresso = (string) file_get_contents(__DIR__.'/../../resources/js/index.ts');
    $importati = fn (string $testo): array => nomiFraLeGraffe('/^import \{([^}]*)\} from \'[^\']*\/zr-core\/resources\/js\';$/m', $testo);
    $esportati = fn (string $testo): array => nomiFraLeGraffe('/^export \{([^}]*)\} from \'[^\']+\';$/m', $testo);

    // Un esempio che importa un nome che non c'è, e l'ingresso che smette di esportare il layout.
    $conUnNomeSbagliato = str_replace('{ LayoutDellaCornice, useCornice,', '{ LayoutDellaCornice, usaCornice,', $readme);
    $senzaIlLayout = str_replace('{ LayoutDellaCornice, useCornice,', '{ useCornice,', $ingresso);

    expect($esportati($ingresso))->toContain('LayoutDellaCornice')
        ->and($esportati($ingresso))->toContain('useCornice')
        ->and($importati($readme))->toContain('LayoutDellaCornice')
        ->and($importati($readme))->toContain('useCornice')
        ->and(array_values(array_diff($importati($readme), $esportati($ingresso))))->toBe([])
        ->and($conUnNomeSbagliato)->not->toBe($readme)
        ->and($senzaIlLayout)->not->toBe($ingresso)
        ->and(array_values(array_diff($importati($conUnNomeSbagliato), $esportati($ingresso))))->toBe(['usaCornice'])
        ->and(array_values(array_diff($importati($readme), $esportati($senzaIlLayout))))->toBe(['LayoutDellaCornice']);
});

// Sprint 11 · T1 (voce #1458): le due rotte delle notifiche dicono quando, e il README lo dice nella riga di ognuna.

/** La riga della tabella «Le rotte della cornice» del README che comincia con quella rotta. Vuota se non c'è. */
function rigaDellaRotta(string $readme, string $rotta): string
{
    preg_match('/^\| `'.preg_quote($rotta, '/').'`[^|\n]*\|[^\n]*\|$/m', $readme, $riga);

    return $riga[0] ?? '';
}

it('il README dice, nella riga di ognuna delle due rotte delle notifiche, il suo istante e che cos\'è: aggiornati_il nell\'elenco, segnate_il nelle letture (sprint 11 · T1.4; sprint 12 · T4.6)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $elenco = '| `GET /cornice/notifiche` |';
    $letture = '| `POST /cornice/notifiche/letture` con `{fino_a, workspace, persona}` |';
    $cosaDice = fn (string $testo): array => [
        'aggiornati_il nella risposta dell\'elenco' => str_contains(rigaDellaRotta($testo, 'GET /cornice/notifiche'), '| `{data: [{id, creata_il, letta, app, tipo, autore_nome, risorsa_nome, per_me, azioni, board_nome, quando, ids}], aggiornati_il, workspace, persona}`:'),
        'che cos\'è aggiornati_il' => str_contains(rigaDellaRotta($testo, 'GET /cornice/notifiche'), '`aggiornati_il` è l\'istante in cui la parte server ha cominciato a leggere l\'elenco, prima di chiamare il backoffice'),
        'segnate_il nella risposta delle letture' => str_contains(rigaDellaRotta($testo, 'POST /cornice/notifiche/letture'), '| `{data: {fino_a, altre}, segnate_il}`:'),
        'che cos\'è segnate_il' => str_contains(rigaDellaRotta($testo, 'POST /cornice/notifiche/letture'), '`segnate_il` è l\'istante preso dopo l\'ultima risposta del backoffice'),
    ];

    // Il README con le due righe scambiate di rotta: ogni istante è detto, ma nella riga dell'altra. Poi il README senza la riga
    // dell'elenco, e quello senza la riga delle letture: `aggiornati_il` resta detto altrove (i dati della cornice), e non conta.
    $scambiate = strtr($readme, [$elenco => $letture, $letture => $elenco]);
    $senzaLElenco = str_replace(rigaDellaRotta($readme, 'GET /cornice/notifiche')."\n", '', $readme);
    $senzaLeLetture = str_replace(rigaDellaRotta($readme, 'POST /cornice/notifiche/letture')."\n", '', $readme);

    expect($cosaDice($readme))->toBe([
        'aggiornati_il nella risposta dell\'elenco' => true,
        'che cos\'è aggiornati_il' => true,
        'segnate_il nella risposta delle letture' => true,
        'che cos\'è segnate_il' => true,
    ])
        ->and(substr_count($readme, $elenco))->toBe(1)
        ->and(substr_count($readme, $letture))->toBe(1)
        ->and($cosaDice($scambiate))->toBe([
            'aggiornati_il nella risposta dell\'elenco' => false,
            'che cos\'è aggiornati_il' => false,
            'segnate_il nella risposta delle letture' => false,
            'che cos\'è segnate_il' => false,
        ])
        ->and(str_contains($senzaLElenco, 'aggiornati_il'))->toBe(true)
        ->and($cosaDice($senzaLElenco))->toBe([
            'aggiornati_il nella risposta dell\'elenco' => false,
            'che cos\'è aggiornati_il' => false,
            'segnate_il nella risposta delle letture' => true,
            'che cos\'è segnate_il' => true,
        ])
        ->and($cosaDice($senzaLeLetture))->toBe([
            'aggiornati_il nella risposta dell\'elenco' => true,
            'che cos\'è aggiornati_il' => true,
            'segnate_il nella risposta delle letture' => false,
            'che cos\'è segnate_il' => false,
        ]);
});

// Sprint 12 · T2 (voce #1463): l'elenco delle notifiche porta il tipo, e il README lo dice nella riga della rotta; e dice che
// l'ordine in cui Cornice::dati() legge il backoffice non è un contratto.

/** Il paragrafo del README sotto quel titolo di secondo livello, fino al titolo dopo, su una riga sola. Vuoto se non c'è. */
function sezioneDelReadme(string $readme, string $titolo): string
{
    preg_match('/^## '.preg_quote($titolo, '/').'$(.*?)(?=^## |\z)/ms', $readme, $sezione);

    return suUnaRiga($sezione[1] ?? '');
}

/**
 * Il README con «La parte server» e «La cornice» scambiate di titolo: ogni frase c'è ancora, ma sotto l'altro titolo. È il
 * mutante dei casi che guardano dove il README dice una cosa della parte server, e non solo se la dice.
 */
function conParteServerECorniceScambiate(string $readme): string
{
    return strtr($readme, ["\n## La parte server\n" => "\n## La cornice\n", "\n## La cornice\n" => "\n## La parte server\n"]);
}

it('il README dice il tipo nella riga di GET /cornice/notifiche: fra le chiavi di ogni notifica, e che è com\'è nel backoffice, dove a non tradurlo è la parte server (sprint 12 · T2.4; review, R9)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $elenco = '| `GET /cornice/notifiche` |';
    $ricerca = '| `POST /cornice/ricerca` con `{q}` |';
    // Chi non traduce il tipo è la parte server: zr-core, nel browser, gli dà un titolo (il punto «Le notifiche»).
    $cosaDice = fn (string $testo): array => [
        'tipo fra le chiavi di ogni notifica' => str_contains(rigaDellaRotta($testo, 'GET /cornice/notifiche'), '| `{data: [{id, creata_il, letta, app, tipo, autore_nome, risorsa_nome, per_me, azioni, board_nome, quando, ids}], aggiornati_il, workspace, persona}`:'),
        'tipo com\'è nel backoffice' => str_contains(rigaDellaRotta($testo, 'GET /cornice/notifiche'), '`tipo` è il tipo dell\'evento che l\'ha generata (`com.zeiras.board.cartella.creata`…), com\'è nel backoffice: la parte server non lo traduce e non lo confronta con un elenco'),
    ];

    // Il README con la riga dell'elenco e quella della ricerca scambiate di rotta: il tipo è detto, ma nella riga di un'altra
    // rotta. Poi il README senza la riga dell'elenco: `tipo` resta detto altrove (la ricerca ha il suo), e non conta.
    $scambiate = strtr($readme, [$elenco => $ricerca, $ricerca => $elenco]);
    $senzaLElenco = str_replace(rigaDellaRotta($readme, 'GET /cornice/notifiche')."\n", '', $readme);

    expect($cosaDice($readme))->toBe(['tipo fra le chiavi di ogni notifica' => true, 'tipo com\'è nel backoffice' => true])
        ->and(substr_count($readme, $elenco))->toBe(1)
        ->and(substr_count($readme, $ricerca))->toBe(1)
        ->and($cosaDice($scambiate))->toBe(['tipo fra le chiavi di ogni notifica' => false, 'tipo com\'è nel backoffice' => false])
        ->and(str_contains($senzaLElenco, '`tipo`'))->toBe(true)
        ->and($cosaDice($senzaLElenco))->toBe(['tipo fra le chiavi di ogni notifica' => false, 'tipo com\'è nel backoffice' => false])
        // Detto di zr-core contraddirebbe il punto «Le notifiche», dove è zr-core a dare il titolo dal tipo.
        ->and(str_contains(suUnaRiga($readme), 'zr-core non lo traduce'))->toBe(false);
});

it('il README dice, in «La parte server», che l\'ordine in cui Cornice::dati() legge il backoffice non è un contratto, che dalla v1.2.2 la prima lettura conta le non lette, e che un test del frontend non fissi la prima lettura (sprint 12 · T2.5)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $cosaDice = fn (string $testo): array => [
        'l\'ordine non è un contratto' => str_contains(sezioneDelReadme($testo, 'La parte server'), 'L\'ordine in cui `Cornice::dati()` fa le quattro letture non è un contratto'),
        'dalla v1.2.2 la prima conta le non lette' => str_contains(sezioneDelReadme($testo, 'La parte server'), 'dalla `v1.2.2` la prima è `io.mostra`, per contare le non lette'),
        'un test del frontend non fissi la prima lettura' => str_contains(sezioneDelReadme($testo, 'La parte server'), 'Un test del frontend non fissi «la prima lettura»'),
    ];

    // Con «La parte server» e «La cornice» scambiate le tre cose sono dette, ma non dove si legge di Cornice::dati().
    $scambiate = conParteServerECorniceScambiate($readme);

    expect($cosaDice($readme))->toBe([
        'l\'ordine non è un contratto' => true,
        'dalla v1.2.2 la prima conta le non lette' => true,
        'un test del frontend non fissi la prima lettura' => true,
    ])
        ->and(substr_count($readme, "\n## La parte server\n"))->toBe(1)
        ->and(substr_count($readme, "\n## La cornice\n"))->toBe(1)
        ->and(str_contains(suUnaRiga($scambiate), 'fa le quattro letture non è un contratto'))->toBe(true)
        ->and($cosaDice($scambiate))->toBe([
            'l\'ordine non è un contratto' => false,
            'dalla v1.2.2 la prima conta le non lette' => false,
            'un test del frontend non fissi la prima lettura' => false,
        ]);
});

// Sprint 13 · T2 (voce #1480): dalla v1.4.0 la parte server chiama `Sessione::aggiorna` di zr-auth a ogni lettura, e il README lo
// dice dove dice da dove vengono la persona e la lingua. Fino alla v1.3.0 diceva che zr-core non la chiamava (sprint 12 · T7).

it('il README dice, in «La parte server», che a ogni lettura Cornice::dati() rimette la lingua e il nome della sessione con Sessione::aggiorna, che cosa resta dell\'ingresso, che l\'email dipende dalla zr-auth installata e che cosa succede a una scheda aperta con l\'email di prima, da quale richiesta valgono, il rimedio, e che chi la chiama prima ne tiene il risultato (sprint 13 · T2.7; review, R2)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $cosaDice = fn (string $testo): array => [
        'a ogni lettura, con Sessione::aggiorna' => str_contains(sezioneDelReadme($testo, 'La parte server'), 'a ogni lettura `Cornice::dati()` dà a `Sessione::aggiorna` di zr-auth la risposta di `io.mostra` che ha già letto per le non lette, e `Sessione::aggiorna` mette nella sessione la lingua e il nome del profilo, se sono cambiati e se li prende'),
        // Dalla `v2.21.2` (sprint 64 · T2.1; review della PR #104, R3) l'email non sta più fra ciò che resta dell'ingresso.
        'workspace, ruolo e gettoni restano quelli dell\'ingresso' => str_contains(sezioneDelReadme($testo, 'La parte server'), 'Workspace, ruolo e gettoni restano quelli dell\'ingresso.'),
        'l\'email secondo la zr-auth installata' => str_contains(sezioneDelReadme($testo, 'La parte server'), 'L\'email dipende dalla zr-auth installata: fino alla 0.12.62 resta quella dell\'ingresso, e dalla 0.12.63 segue io.mostra'),
        'la scheda con l\'email di prima passa' => str_contains(sezioneDelReadme($testo, 'La parte server'), 'Una scheda rimasta aperta con l\'email di prima ha la stessa impronta della persona: dalla `v2.23.0` la sua richiesta della cornice passa come quella di una scheda con l\'email nuova, i dati sono quelli della sessione e `persona` nella risposta è l\'email che la pagina ha detto, così la scheda non si ricarica (fino alla `v2.22` riceveva il 409 `persona_diversa` e si ricaricava come per un\'altra persona)'),
        'i dati li portano da quella stessa richiesta' => str_contains(sezioneDelReadme($testo, 'La parte server'), 'I dati della cornice portano la lingua e il nome della sessione dopo `Sessione::aggiorna`, da quella stessa richiesta'),
        'ciò che il frontend ha letto prima resta fino alla richiesta dopo' => str_contains(sezioneDelReadme($testo, 'La parte server'), 'ciò che il frontend ha letto dalla sessione prima di chiamare `Cornice::dati()` — di solito la lingua della pagina, in un middleware — in quella richiesta è ancora quello di prima, e dalla richiesta dopo è nuovo'),
        // Dalla v1.8.0 il rimedio di prima è la strada di chi resta col suo codice: la riga è `Cornice::lingua()` (sprint 18 · T2.8).
        'il rimedio' => str_contains(sezioneDelReadme($testo, 'La parte server'), 'chiamare `Cornice::dati()` prima di leggere la lingua, o rileggere `Sessione::utente()` dopo, funziona come prima'),
        // Il rimedio da solo, accanto all'esempio che la lascia nella funzione di `share()`, porta a chiamarla due volte.
        'chi la chiama prima ne tiene il risultato' => str_contains(sezioneDelReadme($testo, 'La parte server'), 'Chi la chiama prima ne tiene il risultato e dà quello a `share()`, senza chiamarla un\'altra volta'),
        'perché: rilegge tutto a ogni chiamata' => str_contains(sezioneDelReadme($testo, 'La parte server'), '`Cornice::dati()` rilegge tutto a ogni chiamata — due chiamate nella stessa richiesta sono otto letture invece di quattro, con due segni'),
        'in un middleware parte a ogni richiesta' => str_contains(sezioneDelReadme($testo, 'La parte server'), 'in un middleware parte a ogni richiesta che ci passa, anche senza una pagina da mostrare'),
    ];

    // Con «La parte server» e «La cornice» scambiate le frasi ci sono, ma non dove si legge da dove vengono la persona e la lingua.
    $scambiate = conParteServerECorniceScambiate($readme);

    expect($cosaDice($readme))->toBe([
        'a ogni lettura, con Sessione::aggiorna' => true,
        'workspace, ruolo e gettoni restano quelli dell\'ingresso' => true,
        'l\'email secondo la zr-auth installata' => true,
        'la scheda con l\'email di prima passa' => true,
        'i dati li portano da quella stessa richiesta' => true,
        'ciò che il frontend ha letto prima resta fino alla richiesta dopo' => true,
        'il rimedio' => true,
        'chi la chiama prima ne tiene il risultato' => true,
        'perché: rilegge tutto a ogni chiamata' => true,
        'in un middleware parte a ogni richiesta' => true,
    ])
        // Dalla `v2.21.2` (sprint 64 · T2.1) l'email segue io.mostra con la zr-auth 0.12.63: il README non la mette più fra ciò che resta.
        ->and(str_contains(suUnaRiga($readme), 'email, workspace, ruolo e gettoni restano quelli dell\'ingresso'))->toBe(false)
        ->and(str_contains(suUnaRiga($scambiate), 'L\'email dipende dalla zr-auth installata: fino alla 0.12.62 resta quella dell\'ingresso, e dalla 0.12.63 segue io.mostra'))->toBe(true)
        ->and($cosaDice($scambiate))->toBe([
            'a ogni lettura, con Sessione::aggiorna' => false,
            'workspace, ruolo e gettoni restano quelli dell\'ingresso' => false,
            'l\'email secondo la zr-auth installata' => false,
            'la scheda con l\'email di prima passa' => false,
            'i dati li portano da quella stessa richiesta' => false,
            'ciò che il frontend ha letto prima resta fino alla richiesta dopo' => false,
            'il rimedio' => false,
            'chi la chiama prima ne tiene il risultato' => false,
            'perché: rilegge tutto a ogni chiamata' => false,
            'in un middleware parte a ogni richiesta' => false,
        ]);
});

it('il README non dice più che zr-core non chiama Sessione::aggiorna, né che un cambio del nome o della lingua arriva al prossimo ingresso (sprint 13 · T2.7)', function (string $nuova, string $diPrima) {
    $readme = suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md'));
    // Il README con la frase della v1.3.0 al posto di quella nuova: il controllo la vede.
    $conQuellaDiPrima = str_replace($nuova, $diPrima, $readme);

    expect(substr_count($readme, $diPrima))->toBe(0)
        ->and($conQuellaDiPrima)->not->toBe($readme)
        ->and(substr_count($conQuellaDiPrima, $diPrima))->toBe(1);
})->with([
    'zr-core non la chiama' => ['La lingua e il nome la cornice li tiene aggiornati', 'zr-core in questa versione non la chiama'],
    'al prossimo ingresso' => ['Persona, lingua e workspace sono quelli della sessione di zr-auth', 'un cambio fatto dopo (il nome, la lingua) arriva alla cornice al prossimo ingresso'],
]);

it('la parte server chiama Sessione::aggiorna, come dice il README: nel codice di src/, non in un commento (sprint 13 · T2.7)', function () {
    $chiamateIn = fn (string $codice): int => substr_count(senzaCommenti($codice), 'Sessione::aggiorna(');
    $chiamate = 0;
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator(__DIR__.'/../../src', FilesystemIterator::SKIP_DOTS)) as $file) {
        $chiamate += $chiamateIn((string) file_get_contents($file->getPathname()));
    }

    // La conta guarda il codice: una chiamata scritta solo in un commento non è una chiamata.
    expect($chiamateIn("<?php\n// Sessione::aggiorna(\$io);\n/** Sessione::aggiorna(\$io) */\n"))->toBe(0)
        ->and($chiamateIn("<?php\nSessione::aggiorna(\$io);\n"))->toBe(1)
        ->and($chiamate > 0)->toBe(true);
});

// Sprint 18 · T2 (voce #1624): dalla v1.8.0 la lingua della pagina si prende in una riga, `Cornice::lingua()`, e il README lo
// dice dove dava la regola d'ordine (chiamare `Cornice::dati()` prima di leggere la lingua, o rileggere la sessione dopo):
// quella resta una strada per chi ha già il suo codice, non l'unica.

it('il README dice, in «La parte server», la riga con Cornice::lingua(): dove va, che cosa dà, quanto costa dove la cornice non c\'è e dove c\'è, che cosa fa se il backoffice non risponde, e che chi resta col suo codice non cambia niente (sprint 18 · T2.8)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    // Con «La parte server» e «La cornice» scambiate la frase c'è ancora, ma non dove si legge di Cornice::dati().
    $scambiate = conParteServerECorniceScambiate($readme);

    expect(str_contains(sezioneDelReadme($readme, 'La parte server'), $frase))->toBe(true)
        ->and(str_contains(suUnaRiga($scambiate), $frase))->toBe(true)
        ->and(str_contains(sezioneDelReadme($scambiate, 'La parte server'), $frase))->toBe(false);
})->with([
    'la riga' => ['App::setLocale(Cornice::lingua() ?? config(\'app.locale\'));'],
    'dove va' => ['una riga nel middleware che mette la lingua, prima del controller'],
    'da quale versione' => ['c\'è `Cornice::lingua()` (dalla `v1.8.0`)'],
    'che cosa dà' => ['Dà la lingua della sessione dopo che `Sessione::aggiorna` ha visto il profilo'],
    'come la prende' => ['legge `io.mostra`, lo dà a `Sessione::aggiorna` e risponde con la lingua della sessione'],
    'senza una sessione' => ['Senza una sessione dà `null`'],
    'senza un workspace' => ['con la sessione ma senza un workspace dà la lingua della sessione, senza chiamare il backoffice'],
    // Review della PR #22, R9: la forma della lingua la guarda la riga, e il README lo dice.
    'la forma di una lingua' => ['È la lingua della sessione, se ha la forma di una lingua (due o tre lettere, poi parti di lettere e cifre unite da `-` o `_`: `it`, `pt-BR`); se no dà `null`'],
    'mai un valore che Laravel rifiuta' => ['a `App::setLocale` non arriva mai un valore che Laravel rifiuta'],
    // Seconda lettura della PR #22, N2: il ripiego di Laravel vale per i file a gruppi, non per i testi JSON.
    'una lingua che il modulo non ha' => ['Una lingua della sessione ben fatta che il modulo non ha passa com\'è: per i testi dei file a gruppi (`lang/<lingua>/…`) Laravel ripiega sul suo `fallback_locale`, per quelli JSON (`lang/<lingua>.json`) dà la chiave com\'è'],
    'quanto costa dove la cornice non c\'è' => ['Costa una lettura, `io.mostra`, nelle richieste in cui la chiami e la cornice non c\'è'],
    'nessuna in più dove c\'è' => ['dove c\'è non ne costa una in più'],
    'le letture restano quattro' => ['e le letture restano quattro'],
    'di quale lettura sono le non lette e il segno' => ['Le non lette e il segno dei dati sono allora quelli della lettura di `Cornice::lingua()`'],
    'se il backoffice non risponde non lancia' => ['Se il backoffice non risponde `Cornice::lingua()` non lancia: dà la lingua della sessione'],
    // Review, A4: vale per la prima `Cornice::dati()`; e ciò che il controller cambia dopo comprende lingua e nome.
    'l\'errore lo lancia la prima Cornice::dati(), senza un\'altra lettura' => ['lo lancia la prima `Cornice::dati()` di quella richiesta, se la chiami, senza chiamare `io.mostra` un\'altra volta'],
    // Seconda lettura della PR #24, S1: come comincia la frase — per il nome, e per la lingua che `Sessione::aggiorna` prende — lo guarda il caso di T4.3.
    'anche la lingua e il nome cambiati dal controller' => ['se il controller li cambia nel profilo in quella richiesta, i dati li portano dalla richiesta dopo'],
    // Seconda lettura, N3: quale forma `Sessione::aggiorna` prende, e che con un'altra non cambia niente.
    'subito solo con Sessione::aggiorna' => ['subito solo se il controller dà a `Sessione::aggiorna` i dati della persona nella forma di `io.mostra` (l\'`utente` col suo `id`, la `lingua` e il `nome`): con un\'altra forma `Sessione::aggiorna` non cambia niente'],
    // Review, R6: l'errore che la riga prende lascia un avviso.
    'l\'avviso nel log' => ['lascia nel log una riga d\'avviso col tipo dell\'errore, mai il suo messaggio'],
    // Review, R5: dove la riga non va, e quanto costerebbe.
    'dove va la riga' => ['La riga va dove si mette la lingua di una pagina, non su ogni richiesta'],
    'dove non va' => ['su una richiesta che non mostra una pagina — le rotte della cornice (`/cornice/…`), le rotte JSON del modulo — basta la lingua della sessione'],
    'quanto costerebbe' => ['la riga costerebbe una lettura del backoffice in più a ogni richiesta (una ricerca ne farebbe due)'],
    'col blocco della sessione' => ['su una rotta che tiene il blocco della sessione quel tempo passerebbe a blocco preso'],
    'il gruppo web passa anche dalle rotte della cornice' => ['Un middleware del gruppo `web` passa anche dalle rotte della cornice'],
    // Review, R11: la lettura parte prima che la lingua della pagina sia messa.
    'la lingua del dettaglio di un errore' => ['il `dettaglio` di un errore del backoffice che `Cornice::dati()` poi rilancia è nella lingua che l\'app aveva in quel momento'],
    'GettoneRifiutato passa' => ['`GettoneRifiutato` invece passa anche da `Cornice::lingua()`'],
    'chi resta col suo codice' => ['Chi resta col suo codice non cambia niente: chiamare `Cornice::dati()` prima di leggere la lingua, o rileggere `Sessione::utente()` dopo, funziona come prima'],
]);

it('il README non dà più la regola d\'ordine come unica strada per avere la pagina nella lingua nuova: al suo posto c\'è la riga (sprint 18 · T2.8)', function () {
    $readme = suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md'));
    $diPrima = 'Un frontend che vuole la pagina nella lingua nuova già da quella richiesta chiama `Cornice::dati()` prima di leggere la lingua, o rilegge `Sessione::utente()` dopo';
    $nuova = 'Per avere la pagina nella lingua nuova già da quella richiesta c\'è `Cornice::lingua()`';
    // Il README con la frase della v1.7.0 al posto di quella nuova: il controllo la vede.
    $conQuellaDiPrima = str_replace($nuova, $diPrima, $readme);

    expect(substr_count($readme, $diPrima))->toBe(0)
        ->and(substr_count($readme, $nuova))->toBe(1)
        ->and(substr_count($conQuellaDiPrima, $diPrima))->toBe(1);
});

it('la parte server ha la riga che il README dice: Cornice::lingua() è un metodo pubblico e statico di src/Cornice.php, senza argomenti, che dà una stringa o null (sprint 18 · T2.8)', function () {
    $riga = new ReflectionMethod(Cornice::class, 'lingua');

    expect([$riga->isPublic(), $riga->isStatic(), $riga->getNumberOfParameters(), (string) $riga->getReturnType()])->toBe([true, true, 0, '?string']);
});

// Sprint 20 · T4 (voce #1677): dalla 0.12.12 `Sessione::aggiorna` di zr-auth prende dal profilo solo una lingua di Zeiras. Il
// README dice quale lingua c'è nella sessione con le due versioni che zr-core accetta — all'ingresso e dopo —, che cosa dà
// `Cornice::lingua()` con ognuna, e chi guarda la forma (review della PR #27: R1, R2, R4, R5, R7).

it('il README dice, in «La parte server», quale lingua c\'è nella sessione — all\'ingresso com\'è, poi solo quella che Sessione::aggiorna prende, fino alla 0.12.11 e dalla 0.12.12 —, che cosa dà Cornice::lingua() con ognuna delle due versioni, e che la forma la guarda solo lei (sprint 20 · T4.3)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $scambiate = conParteServerECorniceScambiate($readme);

    expect(str_contains(sezioneDelReadme($readme, 'La parte server'), $frase))->toBe(true)
        ->and(str_contains(suUnaRiga($scambiate), $frase))->toBe(true)
        ->and(str_contains(sezioneDelReadme($scambiate, 'La parte server'), $frase))->toBe(false);
})->with([
    'il rimando' => ['quali prende lo decide zr-auth (per la lingua vedi «Quale lingua c\'è nella sessione», più sotto)'],
    'in due momenti' => ['Quale lingua c\'è nella sessione lo decide zr-auth, in due momenti'],
    'all\'ingresso, com\'è' => ['All\'ingresso `Sessione::apri` e `Sessione::entra` mettono nella sessione la persona come la dà il backoffice, con la lingua del profilo com\'è: vale dalla 0.12.4 alla 0.12.12'],
    'dopo, solo quella che Sessione::aggiorna prende' => ['Dopo, a ogni lettura, `Sessione::aggiorna` cambia la lingua della sessione solo con una lingua del profilo che prende'],
    'fino alla 0.12.11' => ['fino alla 0.12.11 ogni testo che non sia vuoto o di soli spazi, com\'è'],
    'dalla 0.12.12, col confronto esatto' => ['dalla 0.12.12 solo una lingua di Zeiras (`it`, `en`, `es`: l\'elenco `Sessione::LINGUE` di zr-auth), col confronto esatto — `IT` e `it-IT` non sono `it` —'],
    'con un\'altra, anche ben fatta' => ['con un\'altra, anche ben fatta, la sessione tiene la lingua che aveva'],
    'se il profilo non ne porta una' => ['Se il profilo non ne porta una (`null`, un testo vuoto o di soli spazi) la sessione tiene la sua con tutte e due le versioni'],
    'quando la riga dà null' => ['Con una sessione, quindi, `Cornice::lingua()` dà `null` quando la lingua che la sessione ha dopo la lettura non ha la forma di una lingua'],
    'null fino alla 0.12.11 e dalla 0.12.12' => ['fino alla 0.12.11 anche per una malfatta appena arrivata dal profilo, dalla 0.12.12 solo per una malfatta che la sessione aveva già dall\'ingresso'],
    'una ben fatta che non è di Zeiras' => ['per una lingua del profilo ben fatta che non è di Zeiras (`pt-BR`) fino alla 0.12.11 dà quella, dalla 0.12.12 la lingua che la sessione aveva, se ha la forma di una lingua'],
    // Review della PR #89, R2: dalla `v2.16.0` zr-core chiede la 0.12.31, e un test del modulo non ha più due versioni da guardare.
    'il test del modulo' => ['Fino alla `v2.15` zr-core accettava tutte e due le versioni; dalla `v2.16.0` chiede la 0.12.31, e vale la seconda: un test del modulo su una lingua che non è di Zeiras non ha più da guardare quale zr-auth è installata'],
    'la forma la guarda solo la riga' => ['E la forma della lingua la guarda solo `Cornice::lingua()`: `Sessione::utente()[\'lingua\']` e `Cornice::dati()[\'lingua\']` sono la lingua della sessione com\'è, anche malfatta'],
    'chi resta col suo codice guarda la forma' => ['Chi resta col suo codice e la dà a `App::setLocale`, all\'attributo `lang` della pagina o al nome di un file ne guarda prima la forma'],
    // Seconda lettura della PR #24, S1: anche la frase su ciò che il controller cambia nel profilo vale con le due versioni.
    'ciò che il controller cambia: la lingua solo se Sessione::aggiorna la prende' => ['Vale anche per il nome, e per la lingua se è una di quelle che `Sessione::aggiorna` prende (fino alla 0.12.11 di zr-auth ogni testo che non sia vuoto o di soli spazi, dalla 0.12.12 solo una lingua di Zeiras: vedi «Quale lingua c\'è nella sessione», più sotto): se il controller li cambia nel profilo in quella richiesta'],
    'una lingua che Sessione::aggiorna non prende, né subito né dopo' => ['Una lingua che `Sessione::aggiorna` non prende i dati non la portano né subito né dopo: tengono quella che la sessione aveva'],
]);

// Review della PR #27, R1 e R2: le frasi che il README non dice più, perché erano vere con una sola delle due versioni di zr-auth,
// o solo per la lingua che arriva da `Sessione::aggiorna`.
it('il README non dice più che la sessione prende la lingua del profilo com\'è, che la riga dà la lingua del profilo, né che dalla 0.12.12 non dà mai null (sprint 20 · T4.3; review della PR #27, R1, R2 e R4)', function (string $diPrima, string $alPostoDi) {
    $readme = suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md'));
    // Il README con la frase di prima rimessa al posto di quella di adesso: il controllo la vede.
    $conLaFraseDiPrima = str_replace($alPostoDi, $diPrima, $readme);

    expect(str_contains($readme, $diPrima))->toBe(false)
        ->and($conLaFraseDiPrima)->not->toBe($readme)
        ->and(str_contains($conLaFraseDiPrima, $diPrima))->toBe(true);
})->with([
    'passa com\'è, senza dire di chi è la lingua (R2)' => ['Una lingua ben fatta che il modulo non ha passa com\'è', 'Una lingua della sessione ben fatta che il modulo non ha passa com\'è'],
    'la riga dà la lingua del profilo (R2)' => ['È la lingua del profilo, se ha la forma di una lingua', 'È la lingua della sessione, se ha la forma di una lingua'],
    'già aggiornata dal profilo (R2)' => ['Dà la lingua della persona già aggiornata dal profilo', 'Dà la lingua della sessione dopo che `Sessione::aggiorna` ha visto il profilo'],
    'la lingua e il nome nuovi (R2)' => ['portano la lingua e il nome nuovi da quella stessa richiesta', 'portano la lingua e il nome della sessione dopo `Sessione::aggiorna`, da quella stessa richiesta'],
    'la sessione prende, se sono cambiati (R2)' => ['e la sessione prende la lingua e il nome del profilo, se sono cambiati', 'e `Sessione::aggiorna` mette nella sessione la lingua e il nome del profilo, se sono cambiati e se li prende'],
    'dalla 0.12.12 la sessione prende solo una lingua di Zeiras, anche all\'ingresso (R1)' => ['Dalla 0.12.12 di zr-auth la sessione prende dal profilo solo una lingua di Zeiras', 'Quale lingua c\'è nella sessione lo decide zr-auth, in due momenti'],
    'dà quella, non null (R1)' => ['la sessione tiene la lingua che aveva e `Cornice::lingua()` dà quella, non `null`', 'la sessione tiene la lingua che aveva'],
    'fino alla 0.12.11 il testo com\'è, anche vuoto (R2)' => ['Fino alla 0.12.11 la sessione prende il testo del profilo com\'è', 'fino alla 0.12.11 ogni testo che non sia vuoto o di soli spazi, com\'è'],
    // Seconda lettura della PR #24, S1: vera solo fino alla 0.12.11, dalla 0.12.12 una lingua che non è di Zeiras i dati non la portano mai.
    'la lingua cambiata dal controller arriva dalla richiesta dopo, qualunque sia (S1)' => ['Vale anche per la lingua e il nome: se il controller li cambia nel profilo', 'Vale anche per il nome, e per la lingua se è una di quelle che `Sessione::aggiorna` prende (fino alla 0.12.11 di zr-auth ogni testo che non sia vuoto o di soli spazi, dalla 0.12.12 solo una lingua di Zeiras: vedi «Quale lingua c\'è nella sessione», più sotto): se il controller li cambia nel profilo'],
]);

// Sprint 12 · T3 (voce #1463): nel pannello ogni notifica ha il titolo del suo tipo, e il README lo dice nel punto «Le notifiche».

/** Il punto «Le notifiche» del README, su una riga sola: dal grassetto al punto dopo. Vuoto se non c'è. */
function puntoDelleNotifiche(string $readme): string
{
    preg_match('/^- \*\*Le notifiche\*\*.*?(?=^- |^$|\z)/ms', $readme, $punto);

    return suUnaRiga($punto[0] ?? '');
}

/**
 * Il README col punto delle notifiche e quello della ricerca scambiati di nome: ogni frase c'è ancora, ma dove si legge della
 * ricerca. È il mutante dei casi che guardano che una frase stia nel punto «Le notifiche», e non solo nel README.
 */
function conNotificheERicercaScambiate(string $readme): string
{
    return strtr($readme, ['- **Le notifiche**' => '- **La ricerca**', '- **La ricerca**' => '- **Le notifiche**']);
}

it('il README dice, nel punto «Le notifiche», una frase per cosa (sprint 12 · T3.6)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $scambiati = conNotificheERicercaScambiate($readme);

    expect(str_contains(puntoDelleNotifiche($readme), $frase))->toBe(true)
        ->and(substr_count($readme, '- **Le notifiche**'))->toBe(1)
        ->and(substr_count($readme, '- **La ricerca**'))->toBe(1)
        ->and(str_contains(suUnaRiga($scambiati), $frase))->toBe(true)
        ->and(str_contains(puntoDelleNotifiche($scambiati), $frase))->toBe(false);
})->with([
    'il titolo è quello del tipo' => ['ognuna col titolo del suo tipo nella lingua'],
    'il ripiego, per un tipo che zr-core non conosce o che manca' => ['una notifica di un tipo che zr-core non conosce, o senza `tipo`, ha il titolo di ripiego («Novità nel workspace»)'],
    'un tipo nuovo vuole una versione nuova di zr-core' => ['Un tipo di notifica nuovo vuole una versione nuova di zr-core per avere il suo titolo: fino ad allora si legge il ripiego'],
    // Sprint 17 · T2 (voce #1481): il pulsante «Segna tutte come lette» dice che cosa sta succedendo, col testo di zr-core.
    'il testo del pulsante lo dà zr-core (sprint 17 · T2.1)' => ['Che cosa sta succedendo lo dice il pulsante, col testo che zr-core gli dà al posto di quello dell\'`AppShell`'],
    'con la richiesta in corso (sprint 17 · T2.1)' => ['Dal clic alla risposta, che con migliaia di non lette può arrivare dopo circa 15 secondi, dice «Segno…»'],
    'quando ne restano (sprint 17 · T2.1)' => ['Dopo una risposta con `altre: true` dice «Segna le altre»'],
    'fino a quando ne restano (sprint 17 · T2.1)' => ['finché quel giro di letture non è finito'],
    'se la richiesta fallisce (sprint 17 · T2.1)' => ['Se la richiesta fallisce il pulsante torna al testo che aveva prima del clic'],
    // Review della PR #20, R3: il giro finisce anche altrove (un'altra scheda), e allora «Segna le altre» non torna. Seconda
    // lettura, N5: lo dicono i dati letti dopo la risposta con `altre`, non la campanella a zero; senza il numero nei dati no.
    'il giro finito altrove (sprint 17 · review, R3 e N5)' => ['o quando dei dati letti dopo quella risposta non contano più non lette: il giro è finito altrove, in un\'altra scheda'],
    'senza il numero nei dati quell\'uscita non c\'è (sprint 17 · review, N5)' => ['Senza `non_lette` nei dati questa terza uscita non c\'è'],
]);

it('il README non dice più che il giro finito altrove lo dice la campanella a zero (sprint 17 · review, N5)', function () {
    expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')), 'quando la campanella non conta più non lette'))->toBe(false);
});

it('il README e la guida non dicono più che una richiesta che non dice la persona risponde come prima, né che il clic di un JS di prima la segna ancora a chi è entrato (sprint 52 · T1.4)', function () {
    $readme = suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md'));
    $guida = suUnaRiga((string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md'));

    expect(str_contains($readme, 'Una richiesta che non la dice risponde come prima'))->toBe(false)
        ->and(str_contains($readme, 'la rotta non confronta: una richiesta che non dice la persona vale come prima'))->toBe(false)
        ->and(str_contains($readme, 'la segna ancora a chi è entrato'))->toBe(false)
        ->and(str_contains($guida, 'a una richiesta che non la dice la rotta risponde come prima'))->toBe(false)
        ->and(str_contains($guida, 'segna ancora a chi è entrato'))->toBe(false);
});

it('il README non dice più che il titolo di una notifica è uno per tutte (sprint 12 · T3.6)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    // Il README di prima, con la frase della v1.2.2 al posto di quella del tipo: il controllo la vede, anche dove va a capo.
    $diPrima = str_replace('ognuna col titolo del suo', "ognuna col titolo della\n  lingua, uno per tutte, e del suo", $readme);

    expect(str_contains(suUnaRiga($readme), 'uno per tutte'))->toBe(false)
        ->and($diPrima)->not->toBe($readme)
        ->and(str_contains(suUnaRiga($diPrima), 'uno per tutte'))->toBe(true);
});

// Sprint 12 · T4 (voce #1461): «Segna tutte come lette» oltre le 5000 non lette. La parte server richiama il backoffice finché ne
// restano, entro due tetti, e dice se ne restano ancora: il README lo dice nella riga della rotta, e nel punto «Le notifiche»
// dice che cosa vede la persona.

it('il README dice, nella riga di POST /cornice/notifiche/letture, una frase per cosa (sprint 12 · T4.6)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $letture = '| `POST /cornice/notifiche/letture` con `{fino_a, workspace, persona}` |';
    $ricerca = '| `POST /cornice/ricerca` con `{q}` |';
    // Il README con la riga delle letture e quella della ricerca scambiate di rotta: la frase c'è, ma nella riga di un'altra rotta.
    $scambiate = strtr($readme, [$letture => $ricerca, $ricerca => $letture]);

    expect(str_contains(rigaDellaRotta($readme, 'POST /cornice/notifiche/letture'), $frase))->toBe(true)
        ->and(substr_count($readme, $letture))->toBe(1)
        ->and(substr_count($readme, $ricerca))->toBe(1)
        ->and(str_contains($scambiate, $frase))->toBe(true)
        ->and(str_contains(rigaDellaRotta($scambiate, 'POST /cornice/notifiche/letture'), $frase))->toBe(false);
})->with([
    'altre nella risposta' => ['| `{data: {fino_a, altre}, segnate_il}`:'],
    'il backoffice ne segna 5000 per chiamata, e la parte server lo richiama' => ['il backoffice ne segna al più 5000 per chiamata e dice se ne restano: la parte server lo richiama con lo stesso `fino_a` finché ne restano'],
    'il tetto delle chiamate' => ['al più 5 chiamate al backoffice per richiesta'],
    // Sprint 16 · review, R2: i 10 secondi si contano dall'arrivo della richiesta, non dalla prima chiamata.
    'il tetto del tempo' => ['nessuna chiamata nuova passati 10 secondi dall\'arrivo della richiesta'],
    'che cos\'è altre' => ['`altre` è `false` quando il backoffice ha detto che non ne restano, e `true` quando un tetto ha fermato i richiami e ne restano ancora'],
    'con altre: true la stessa richiesta continua' => ['la stessa richiesta, ripetuta, continua da lì'],
    'segnate_il è dopo l\'ultima risposta' => ['`segnate_il` è l\'istante preso dopo l\'ultima risposta del backoffice'],
    'un richiamo che fallisce è un errore' => ['alla prima chiamata o a un richiamo, è un errore (5xx) senza `segnate_il`'],
    'il blocco della sessione, e il 503 (sprint 16 · T4.6)' => ['la rotta tiene il blocco della sessione per tutta la sua durata, e se un\'altra richiesta della stessa sessione lo tiene per più di 3 secondi risponde 503 con `Retry-After: 1`, senza chiamare il backoffice'],
    'il 503 di chi arriva tardi alla rotta (sprint 16 · review, R2)' => ['arrivata alla rotta passati 10 secondi dall\'arrivo della richiesta risponde 503 `{errore: "fuori_tempo"}` con `Retry-After: 1`, anche lei senza chiamare il backoffice'],
    'quanto dura il blocco, e chi lo trova scaduto (sprint 16 · seconda lettura, N1)' => ['il blocco dura 20 secondi da quando è preso, coi tempi di partenza, e una richiesta che i middleware del frontend tengono più a lungo prima della rotta ci arriva a blocco scaduto'],
]);

it('il README non dice più che i 10 secondi dei richiami si contano dalla prima chiamata (sprint 16 · review, R2)', function () {
    $readme = suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md'));
    // Il README con la frase di prima rimessa al posto di quella di adesso: il controllo la vede.
    $conLaFraseDiPrima = str_replace('passati 10 secondi dall\'arrivo della richiesta;', 'passati 10 secondi dalla prima;', $readme);

    expect(str_contains($readme, 'passati 10 secondi dalla prima'))->toBe(false)
        ->and($conLaFraseDiPrima)->not->toBe($readme)
        ->and(str_contains($conLaFraseDiPrima, 'passati 10 secondi dalla prima'))->toBe(true);
});

it('il README dice, nel punto «Le notifiche», che cosa vede la persona quando un clic non le segna tutte (sprint 12 · T4.6)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $scambiati = conNotificheERicercaScambiate($readme);

    expect(str_contains(puntoDelleNotifiche($readme), $frase))->toBe(true)
        ->and(substr_count($readme, '- **Le notifiche**'))->toBe(1)
        ->and(substr_count($readme, '- **La ricerca**'))->toBe(1)
        ->and(str_contains(suUnaRiga($scambiati), $frase))->toBe(true)
        ->and(str_contains(puntoDelleNotifiche($scambiati), $frase))->toBe(false);
})->with([
    // Sprint 16 · seconda lettura, N2: il tetto del tempo è quello della riga della rotta, dall'arrivo della richiesta.
    'quando un clic non basta' => ['con più di 25.000 non lette, o passati 10 secondi dall\'arrivo della richiesta, un clic non le segna tutte'],
    'che cosa vede la persona' => ['la campanella tiene il numero dei dati, il pannello si ricarica e «Segna tutte come lette» resta, per continuare con un altro clic'],
]);

// Sprint 12 · review, S1 (decisione di zr-pm): «Segna tutte come lette» può durare fino a circa 15 secondi, e in Laravel una richiesta
// lenta, quando finisce, riscrive la sessione com'era all'inizio. Il README lo dichiara nel punto «Le notifiche», una frase per cosa.
it('il README dichiara, nel punto «Le notifiche», quanto dura «Segna tutte come lette» e che cosa torna quando una richiesta rimette la sessione di prima (sprint 12 · review, S1; le altre frasi del limite: sprint 16 · T4.6)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $scambiati = conNotificheERicercaScambiate($readme);

    expect(str_contains(puntoDelleNotifiche($readme), $frase))->toBe(true)
        ->and(str_contains(suUnaRiga($scambiati), $frase))->toBe(true)
        ->and(str_contains(puntoDelleNotifiche($scambiati), $frase))->toBe(false);
})->with([
    'quanto dura qui' => ['fino a circa 15 secondi, solo con più di 5000 non lette'],
    'dopo un cambio di workspace' => ['dopo un cambio di workspace la persona si ritrova in quello di prima'],
    // Seconda lettura, N3: dopo un'uscita i gettoni sono chiusi solo se la chiamata dell'uscita al backoffice è riuscita.
    'dopo un\'uscita tornano i gettoni di prima' => ['dopo un\'uscita torna la sessione coi gettoni di prima'],
    'dopo un\'uscita che li ha chiusi' => ['se l\'uscita li ha chiusi nel backoffice, la prima chiamata la richiude'],
    'dopo un\'uscita senza la risposta del backoffice' => ['se all\'uscita il backoffice non ha risposto — la sessione si chiude lo stesso — possono valere ancora, fino alla loro scadenza'],
]);

// Sprint 13 · T2 (voce #1480): dalla v1.4.0 la cornice scrive nella sessione (la lingua e il nome del profilo), e il limite della
// sessione vale anche per quelli. Non serve una richiesta lenta (review, R3): Laravel riscrive la sessione intera alla fine di
// ogni richiesta, e basta una richiesta della stessa sessione cominciata prima e finita dopo la pagina che li ha aggiornati. Il
// meccanismo è lo stesso dell'uscita e del cambio di workspace, di cui il limite parla dallo sprint 12 con «una richiesta
// lenta»: quella frase non è di questo sprint (seconda lettura, N1). Una frase per cosa, dentro il limite e non altrove.
it('il README dice, nel limite della sessione del punto «Le notifiche», che la lingua e il nome di prima tornano con una richiesta della stessa sessione cominciata prima e finita dopo, anche non lenta, e che la lettura dopo li rimette (sprint 13 · T2.8; review, R3)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    // Il limite della sessione: dalla frase che lo apre alla fine del punto «Le notifiche».
    $limite = fn (string $testo): string => (string) strstr(puntoDelleNotifiche($testo), 'Un limite, che non è solo di questa rotta');
    $scambiati = conNotificheERicercaScambiate($readme);

    expect(str_contains($limite($readme), $frase))->toBe(true)
        ->and(str_contains(suUnaRiga($scambiati), $frase))->toBe(true)
        ->and(str_contains($limite($scambiati), $frase))->toBe(false)
        // La frase di prima diceva che serviva una richiesta lenta.
        ->and(str_contains(suUnaRiga($readme), 'mentre la richiesta lenta girava'))->toBe(false);
})->with([
    'tornano anche la lingua e il nome di prima' => ['Allo stesso modo tornano la lingua e il nome di prima, se la cornice li aveva aggiornati mentre un\'altra richiesta della stessa sessione girava'],
    'anche con una richiesta non lenta' => ['basta che sia cominciata prima e finita dopo, anche non lenta (le notifiche, la ricerca, una chiamata del modulo)'],
    'i dati della cornice restano giusti' => ['I dati della cornice restano giusti'],
    'che cosa legge il frontend alla visita dopo' => ['alla visita dopo ciò che il frontend legge dalla sessione prima di `Cornice::dati()` è ancora quello di prima'],
    'quella lettura li rimette' => ['e quella lettura li rimette'],
]);

// Sprint 16 · T4 (voce #1558): «Segna tutte come lette» tiene il blocco della sessione, e il limite della sessione nel punto «Le
// notifiche» si riscrive com'è: vale per ogni richiesta ancora in corso, non solo per una lenta; il blocco ferma solo chi lo
// prende, quindi il frontend lo mette sulle sue rotte di uscita e di ingresso; chi arriva secondo aspetta, e poi riceve un 503;
// l'elenco, la ricerca e le chiamate del modulo restano senza blocco. Una frase per cosa, dentro il limite e non altrove.
// Sprint 17 · T2 (voce #1481): le rotte su cui il frontend lo mette sono quelle del criterio di zr-auth — ogni rotta che apre,
// cambia o chiude la sessione, e le sue rotte lente — non solo l'uscita e l'ingresso.

/** Il limite della sessione del README: dalla frase che lo apre alla fine del punto «Le notifiche». Vuoto se non c'è. */
function limiteDellaSessione(string $readme): string
{
    return (string) strstr(puntoDelleNotifiche($readme), 'Un limite, che non è solo di questa rotta');
}

it('il README dice, nel limite della sessione del punto «Le notifiche», il limite com\'è, che «Segna tutte come lette» tiene il blocco della sessione, che cosa mette il frontend, il 503 e chi resta senza blocco (sprint 16 · T4.6)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $scambiati = conNotificheERicercaScambiate($readme);

    expect(str_contains(limiteDellaSessione($readme), $frase))->toBe(true)
        ->and(str_contains(suUnaRiga($scambiati), $frase))->toBe(true)
        ->and(str_contains(limiteDellaSessione($scambiati), $frase))->toBe(false);
})->with([
    'che cosa fa ogni richiesta' => ['ogni richiesta, quando finisce, riscrive la sessione com\'era quando è partita e ne rimanda il cookie'],
    'vale per ogni richiesta ancora in corso, non solo per una lenta' => ['Vale per ogni richiesta della stessa sessione ancora in corso quando la persona, da un\'altra scheda, esce, entra in un altro workspace o cambia lingua, non solo per una lenta'],
    '«Segna tutte come lette» tiene il blocco per tutta la sua durata' => ['dalla `v1.6.0` tiene il blocco della sessione di Laravel (`Route::block`) per tutta la sua durata'],
    'il blocco ferma solo chi lo prende' => ['Il blocco ferma solo chi lo prende'],
    'che cosa mette il frontend' => ['il frontend mette `->bloccaSessione()` di zr-auth sulle sue rotte che aprono, cambiano o chiudono la sessione'],
    'quali sono, coi metodi di zr-auth (sprint 17 · T2.2)' => ['quelle che chiamano `Sessione::apri()`, `Sessione::entra()` o `Sessione::chiudi()`'],
    'non solo l\'uscita e l\'ingresso (sprint 17 · T2.2)' => ['non solo l\'uscita e l\'ingresso in un workspace'],
    'e le rotte lente, non tutte (sprint 17 · T2.2)' => ['e sulle sue rotte lente, non su tutte'],
    'il criterio è di zr-auth (sprint 17 · T2.2)' => ['è il criterio di zr-auth (il suo README, «Il blocco della sessione»'],
    'il ricevitore di zr-auth lo ha già' => ['il ricevitore dell\'ingresso di zr-auth lo ha già'],
    'da una parte sola non ferma niente' => ['messo da una parte sola non ferma niente'],
    'chi arriva secondo aspetta, e poi il 503' => ['la seconda aspetta la prima al più 3 secondi, e oltre risponde 503 con `Retry-After: 1`'],
    'col 503 il pannello resta com\'era' => ['allora nel pannello non cambia niente e il pulsante resta per riprovare'],
    'chi resta senza blocco' => ['L\'elenco delle notifiche, la ricerca e le chiamate del modulo restano senza blocco'],
    'per loro il limite resta' => ['per loro il limite resta'],
    // Sprint 16 · review della PR: ciò che il limite prometteva in più o taceva (R2, R4, R5, R6).
    'da dove dura il blocco, e quanto (review, R2)' => ['Il blocco si prende prima dei middleware che il frontend ha nel gruppo `web`, e dura 20 secondi da lì, coi tempi di partenza'],
    'di che cosa sono fatti i 20 secondi (review, R2)' => ['i 10 dei richiami, i 5 che zr-auth aspetta una risposta, 5 di margine'],
    'da quando la rotta conta i suoi secondi (review, R2)' => ['la rotta conta i suoi 10 secondi dall\'arrivo della richiesta, non da quando tocca a lei'],
    'ciò che il frontend fa prima sta dentro il blocco (review, R2)' => ['ciò che un middleware del frontend fa prima — una `Cornice::dati()`, con un backoffice lento — sta dentro il blocco'],
    'chi arriva tardi alla rotta (review, R2)' => ['una richiesta che arriva alla rotta oltre quei 10 secondi riceve 503 `{errore: "fuori_tempo"}` senza che il backoffice sia chiamato'],
    // Seconda lettura, N1: il margine è intero solo per chi arriva alla rotta in tempo, e oltre la durata del blocco il limite resta.
    'il margine dopo la rotta, per chi ci arriva in tempo (review, R2; seconda lettura, N1)' => ['Dopo la risposta della rotta restano almeno i 5 secondi di margine per chiudere la richiesta, se alla rotta si arriva entro 15 secondi dall\'arrivo'],
    'fra 15 e 20 secondi il margine è ciò che resta (seconda lettura, N1)' => ['fra 15 e 20 il margine è ciò che resta del blocco'],
    'oltre i 20 secondi il blocco è scaduto, e il limite resta (seconda lettura, N1)' => ['una richiesta che i middleware del frontend tengono più di 20 secondi prima della rotta ci arriva a blocco scaduto: riceve il 503 `fuori_tempo`, ma finendo riscrive la sessione lo stesso'],
    'un tempo senza limite ferma la rotta (review, R5)' => ['Con `zr-auth.timeout` minore di 1 la rotta non parte, ed è un errore (500)'],
    'perché un tempo senza limite la ferma (review, R5)' => ['per il client di zr-auth 0 vuol dire senza limite, e una chiamata senza un tetto può durare più di qualunque blocco'],
    'dove sta il lock (review, R4)' => ['Il lock sta nello store `session.block_store` del frontend — quello della cache, se non lo cambia'],
    'lo store deve saper fare i lock (review, R4)' => ['che deve saper fare i lock (Redis, database, file; `array` nei test)'],
    'con uno store che non li fa (review, R4)' => ['con uno store che non li fa la rotta risponde 500 a ogni clic'],
    'con lo store null (review, R4)' => ['con lo store `null` il lock è finto e il limite resta'],
    'la durata e le rotte in cache (review, R4)' => ['La durata del blocco si calcola quando le rotte si registrano: un frontend che tiene le rotte in cache le rifà dopo aver cambiato `zr-auth.timeout`'],
    'chi aspetta dietro un ingresso (review, R6)' => ['una «Segna tutte come lette» che aspetta il blocco di un ingresso in un workspace riparte, dopo l\'attesa, da una sessione vuota'],
    'il 401 e il cookie di prima (review, R6)' => ['risponde 401, come a una persona non entrata, e può rimandare il cookie con l\'id di prima'],
    'la persona si ritrova fuori (review, R6)' => ['che nel browser prende il posto di quello nuovo: la persona si ritrova fuori'],
    'che cosa si fa dopo un ingresso (review, R6)' => ['la pagina, dopo un ingresso, si ricarica dalla scheda in cui si è entrati'],
]);

it('il README non dice più che il limite è di una richiesta lenta, né che zr-core da solo non lo chiude (sprint 16 · T4.6)', function (string $diPrima, string $alPostoDi) {
    $readme = suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md'));
    // Il README con la frase di prima rimessa al posto di quella di adesso: il controllo la vede.
    $conLaFraseDiPrima = str_replace($alPostoDi, $diPrima, $readme);

    expect(str_contains($readme, $diPrima))->toBe(false)
        ->and($conLaFraseDiPrima)->not->toBe($readme)
        ->and(str_contains($conLaFraseDiPrima, $diPrima))->toBe(true);
})->with([
    'una richiesta lenta come unico caso' => ['una richiesta lenta, quando finisce, riscrive la sessione', 'ogni richiesta, quando finisce, riscrive la sessione'],
    'zr-core da solo non lo chiude' => ['zr-core da solo non lo chiude', 'Il blocco ferma solo chi lo prende'],
]);

it('composer.json, README e CLAUDE.md dicono lo stesso vincolo di zr-auth, ^0.12.41, una volta, e nessuno dice più quelli di prima (sprint 16 · T4.5; sprint 55 · T1.4; sprint 59 · T1.4)', function (string $file) {
    $testo = (string) file_get_contents(__DIR__.'/../../'.$file);
    // Ogni vincolo 0.12 che il testo dice, intero: `^0.12.4` è anche l'inizio di `^0.12.41`.
    $vincoli = fn (string $t): array => preg_match_all('/\^0\.12\.\d+/', $t, $trovati) > 0 ? $trovati[0] : [];

    expect($vincoli($testo))->toBe(['^0.12.41'])
        // Il controllo nei due versi: il vincolo di prima, rimesso, si vede.
        ->and($vincoli(str_replace('^0.12.41', '^0.12.31', $testo)))->toBe(['^0.12.31']);
})->with(['composer.json', 'README.md', 'CLAUDE.md']);

it('CLAUDE.md dice perché il vincolo parte dalla 0.12.41, e né CLAUDE.md né il README dicono più il motivo del vincolo di prima (sprint 16 · T4.5; sprint 55 · T1.4; sprint 59 · T1.4)', function () {
    $readme = suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md'));
    $claude = suUnaRiga((string) file_get_contents(__DIR__.'/../../CLAUDE.md'));

    expect(substr_count($claude, 'il vincolo non scende sotto una patch che nessun giro ha provato col codice che la usa, né sotto quella che la cornice chiede per stare sicura (dalla `v2.16.0` la 0.12.31: la richiesta rimandata della cornice in due dati la protegge `SessioneChiusa`, che c\'è da quella); dalla `v2.19.0` parte dalla 0.12.41, perché il codice e i casi della cornice usano `SoloDallaPersona` e `Persona`, che ci sono da quella (decisioni di zr-pm).'))->toBe(1)
        ->and(str_contains($claude, 'dalla `v2.16.0` parte dalla 0.12.31'))->toBe(false)
        ->and(str_contains($claude, 'parte dalla 0.12.4:'))->toBe(false)
        ->and(str_contains($claude, 'per questo parte dalla 0.12.1'))->toBe(false)
        ->and(str_contains($readme, 'Nemmeno la 0.12.0 basta'))->toBe(false);
});

it('README e guida dicono che sulla rotta della richiesta rimandata il frontend non mette niente, che la protegge `SessioneChiusa` di zr-auth dalla 0.12.31, e le quattro condizioni (sprint 55 · T1.1, T1.2, T1.3)', function (string $dove, string $frase) {
    // Del README la sola «La cornice in due dati», fino al titolo dopo: è lì che la guida rimanda (review della PR #89, R4).
    preg_match('/^### La cornice in due dati$(.*?)(?=^##)/ms', (string) file_get_contents(__DIR__.'/../../README.md'), $inDueDati);
    $testo = $dove === 'guida' ? suUnaRiga(guidaDelModuloNuovo()) : suUnaRiga($inDueDati[1] ?? '');

    expect($testo)->not->toBe('')
        ->and(str_contains($testo, $frase))->toBe(true)
        // Il controllo nei due versi: senza la frase, il caso la vede mancare.
        ->and(str_contains(str_replace($frase, '', $testo), $frase))->toBe(false);
})->with([
    'README: niente sulla rotta (T1.1)' => ['readme', 'Sulla rotta della richiesta rimandata il frontend non mette niente: né un middleware suo, né `bloccaSessione()` di zr-auth'],
    'README: la protezione e la versione (T1.1, T1.2)' => ['readme', 'La protezione è `SessioneChiusa` di zr-auth, dalla 0.12.31, ed è per questo che dalla `v2.16.0` zr-core chiede zr-auth dalla 0.12.31'],
    'README: che cosa succede senza (T1.2)' => ['readme', 'senza una protezione una richiesta rimandata lenta, finita dopo che la persona è uscita o è passata a un altro workspace, rimetterebbe in vita la sessione di prima'],
    'README: la rotta nel gruppo web (T1.1)' => ['readme', 'la rotta della richiesta rimandata, cioè la pagina stessa, sta nel gruppo `web`'],
    'README: lo store dei blocchi (T1.1)' => ['readme', '`session.block_store` è uno store condiviso fra i processi, mai `array`'],
    'README: l\'ordine del gruppo (T1.1)' => ['readme', 'l\'ordine del gruppo `web` non si riordina'],
    'README: i secondi (T1.1)' => ['readme', '`zr-auth.sessione_chiusa_secondi` (300) non è più corto della richiesta più lenta'],
    'guida (T1.3)' => ['guida', 'Sulla rotta della richiesta rimandata non mettere niente, nemmeno `bloccaSessione()`: la protegge `SessioneChiusa` di zr-auth dalla 0.12.31'],
    'guida: il rimando (T1.3; review della PR #89, R4)' => ['guida', '(le quattro condizioni: README, «La cornice in due dati»)'],
    'README: lo store non impostato (sicurezza della PR #89, S4)' => ['readme', 'non impostato è lo store della cache predefinito, e vale lo stesso per quello'],
]);

// Review della PR #89, R5: ciò che il README dice di zr-auth dalla 0.12.31 c'è nella zr-auth installata, e il giro «minima»
// della CI installa proprio la 0.12.31: se `SessioneChiusa` fosse arrivata dopo, questo caso lì sarebbe rosso.
it('la zr-auth installata ha `SessioneChiusa`, per prima nel gruppo `web`, e `zr-auth.sessione_chiusa_secondi` a 300 (review della PR #89, R5)', function () {
    $kernel = app(Kernel::class);
    assert($kernel instanceof Illuminate\Foundation\Http\Kernel);

    expect(class_exists('Zeiras\\Auth\\Http\\Middleware\\SessioneChiusa'))->toBe(true)
        ->and($kernel->getMiddlewareGroups()['web'][0] ?? null)->toBe('Zeiras\\Auth\\Http\\Middleware\\SessioneChiusa')
        ->and(config('zr-auth.sessione_chiusa_secondi'))->toBe(300);
});

it('il README dice, in «La parte server», da quale versione zr-core chiede la 0.12.31 e perché (sprint 55 · T1.4)', function () {
    $sezione = sezioneDelReadme((string) file_get_contents(__DIR__.'/../../README.md'), 'La parte server');

    expect(str_contains($sezione, 'Dalla `v2.16.0` serve la 0.12.31: è quella che protegge la richiesta rimandata della cornice in due dati (`SessioneChiusa`, vedi «La cornice in due dati»), e con una più vecchia Composer lascia zr-core alla `v2.15.0`.'))->toBe(true)
        ->and(str_contains($sezione, 'bloccaSessione'))->toBe(false);
});

it('il README non dice più la risposta della v1.2.2 alle letture, senza altre (sprint 12 · T4.6)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    // Il README di prima, con la forma della risposta della v1.2.2 al posto di quella nuova: il controllo la vede.
    $diPrima = str_replace('| `{data: {fino_a, altre}, segnate_il}`:', '| `{data: {fino_a}, segnate_il}`:', $readme);

    expect(substr_count($readme, '`{data: {fino_a}, segnate_il}`'))->toBe(0)
        ->and($diPrima)->not->toBe($readme)
        ->and(substr_count($diPrima, '`{data: {fino_a}, segnate_il}`'))->toBe(1);
});

// Sprint 12 · T5 (voce #1464): `active={null}` dice che nessuna voce della barra è attiva. Il README lo dice dove parla di
// `active`: nel punto «La voce attiva» di «La cornice», e nel punto «La pagina» di «La cornice montata una volta sola».

/**
 * Un punto dell'elenco che il README mette sotto «La cornice», prima di «La cornice montata una volta sola»: quello che comincia
 * con quel grassetto, su una riga sola. Vuoto se il titolo o il punto non ci sono.
 */
function puntoDellaCornice(string $readme, string $grassetto): string
{
    return suUnaRiga(puntoDellaCorniceNelFile($readme, $grassetto));
}

/** Lo stesso punto com'è nel file, coi suoi a capo: per ciò che dipende da dove una riga finisce. Vuoto se non c'è. */
function puntoDellaCorniceNelFile(string $readme, string $grassetto): string
{
    preg_match('/^## La cornice$(.*?)(?=^#{2,3} |\z)/ms', $readme, $paragrafo);
    preg_match('/^- \*\*'.preg_quote($grassetto, '/').'\*\*.*?(?=^- |^$|\z)/ms', $paragrafo[1] ?? '', $punto);

    return $punto[0] ?? '';
}

it('il README dice, nel punto «La voce attiva» di «La cornice», che nessuna voce attiva si dice con active={null} (sprint 12 · T5.6)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $frase = 'Una pagina che non sta sotto nessuna voce lo dice con `active={null}`: nessuna voce è segnata, né la Dashboard né una voce del prodotto';
    // Il README col punto della voce attiva e quello del menu Moduli scambiati di nome: la frase c'è, ma dove si legge del menu.
    $scambiati = strtr($readme, ['- **La voce attiva**' => '- **Il menu Moduli**', '- **Il menu Moduli**' => '- **La voce attiva**']);
    // Il README che in quel punto parla di `active` senza nominare `null`.
    $senzaNull = str_replace('lo dice con `active={null}`', 'lo dice con `active`', $readme);

    expect(str_contains(puntoDellaCornice($readme, 'La voce attiva'), $frase))->toBe(true)
        ->and(substr_count($readme, '- **La voce attiva**'))->toBe(1)
        ->and(substr_count($readme, '- **Il menu Moduli**'))->toBe(1)
        ->and(str_contains(suUnaRiga($scambiati), $frase))->toBe(true)
        ->and(str_contains(puntoDellaCornice($scambiati, 'La voce attiva'), $frase))->toBe(false)
        ->and($senzaNull)->not->toBe($readme)
        ->and(str_contains(puntoDellaCornice($senzaNull, 'La voce attiva'), $frase))->toBe(false);
});

it('il README dice, nel punto «La pagina» del layout della cornice, come si dice che nessuna voce è attiva (sprint 12 · T5.6)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    // Il README col punto della pagina e quello del percorso scambiati di nome: la frase c'è, ma dove si legge del percorso.
    $scambiati = strtr($readme, ['- **La pagina**' => '- **Il percorso**', '- **Il percorso**' => '- **La pagina**']);

    expect(str_contains(puntoDelLayout($readme, 'La pagina'), $frase))->toBe(true)
        ->and(substr_count($readme, '- **La pagina**'))->toBe(1)
        ->and(substr_count($readme, '- **Il percorso**'))->toBe(1)
        ->and(str_contains(suUnaRiga($scambiati), $frase))->toBe(true)
        ->and(str_contains(puntoDelLayout($scambiati, 'La pagina'), $frase))->toBe(false);
})->with([
    'con null, dal layout o dalla pagina' => ['Nessuna voce attiva si dice con `null`, dal layout (`active={null}`) o dalla pagina (`useCornice({ active: null })`)'],
    'il null della pagina vince su una voce del layout' => ['`null` è un valore, e quello della pagina vince anche su una voce data dal layout'],
]);

// Sprint 12 · review della PR. R8: una risposta del backoffice che non ha la forma di /v1 è un errore, e il README lo dice nella
// riga della rotta: è lì che lo legge un frontend che nei suoi test finge il backoffice. R2, R3 e R4: ciò che la cornice oggi
// non dice o non fa, dichiarato nel punto che ne parla.

it('il README dice, nella riga della rotta, che una risposta del backoffice senza quel campo è un errore (sprint 12 · review, R8)', function (string $rotta, string $inizio, string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $ricerca = '| `POST /cornice/ricerca` con `{q}` |';
    // Il README con la riga di quella rotta e quella della ricerca scambiate di rotta: la frase c'è, ma nella riga di un'altra rotta.
    $scambiate = strtr($readme, [$inizio => $ricerca, $ricerca => $inizio]);

    expect(str_contains(rigaDellaRotta($readme, $rotta), $frase))->toBe(true)
        ->and(substr_count($readme, $inizio))->toBe(1)
        ->and(substr_count($readme, $ricerca))->toBe(1)
        ->and(str_contains($scambiate, $frase))->toBe(true)
        ->and(str_contains(rigaDellaRotta($scambiate, $rotta), $frase))->toBe(false);
})->with([
    'una notifica senza tipo' => ['GET /cornice/notifiche', '| `GET /cornice/notifiche` |', 'una notifica che il backoffice dà senza `tipo`, o con un `tipo` che non è una stringa, è un errore (5xx)'],
    'anche nella lettura di una notifica sola' => ['GET /cornice/notifiche', '| `GET /cornice/notifiche` |', 'è un errore (5xx), qui e in `PATCH /cornice/notifiche/{id}/lettura`'],
    'una lettura senza altre' => ['POST /cornice/notifiche/letture', '| `POST /cornice/notifiche/letture` con `{fino_a, workspace, persona}` |', 'o risponde senza `altre` o con un `altre` che non è un booleano, alla prima chiamata o a un richiamo, è un errore (5xx)'],
]);

// Sprint 18 · T1 (voce #1638): la ricerca è una POST con la parola nel corpo. Il README lo dice nella riga della rotta, che è
// dove lo legge un frontend che nei suoi test la chiama, e nel punto «La ricerca»; la GET con la parola nell'indirizzo non è
// più nominata.

it('il README dice, nella riga di POST /cornice/ricerca, una frase per cosa (sprint 18 · T1.6)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $ricerca = '| `POST /cornice/ricerca` con `{q}` |';
    $elenco = '| `GET /cornice/notifiche` |';
    // Il README con la riga della ricerca e quella dell'elenco scambiate di rotta: la frase c'è, ma nella riga di un'altra rotta.
    $scambiate = strtr($readme, [$ricerca => $elenco, $elenco => $ricerca]);

    expect(str_contains(rigaDellaRotta($readme, 'POST /cornice/ricerca'), $frase))->toBe(true)
        ->and(substr_count($readme, $ricerca))->toBe(1)
        ->and(substr_count($readme, $elenco))->toBe(1)
        ->and(str_contains($scambiate, $frase))->toBe(true)
        ->and(str_contains(rigaDellaRotta($scambiate, 'POST /cornice/ricerca'), $frase))->toBe(false);
})->with([
    'la parola solo dal corpo' => ['`q` è la parola cercata e si legge solo dal corpo JSON, mai dall\'indirizzo'],
    'i limiti di prima' => ['da 2 a 100 caratteri senza gli spazi ai bordi (la cornice manda i primi 100), altrimenti 422 `{errore: "dati_non_validi"}`'],
    'non un testo, o solo nell\'indirizzo' => ['e così se non è un testo o sta solo nell\'indirizzo'],
    'una GET non ha una rotta' => ['dalla `v1.8.0` una GET a `/cornice/ricerca` non ha una rotta e non arriva al backoffice'],
    'che cosa risponde una GET' => ['risponde 405, o ciò che il frontend risponde a un indirizzo senza rotta se ha una rotta di ripiego (`Route::fallback`)'],
    'il test di un frontend' => ['un test del frontend che la chiama passa alla POST'],
    // Review della PR #22, R4 e R2: ciò che la versione non fa.
    'una scheda aperta prima dell\'aggiornamento' => ['una scheda aperta prima dell\'aggiornamento cerca ancora con la GET finché non si ricarica: riceve quella risposta e mostra l\'errore della ricerca'],
]);

it('il README dice, nel punto «La ricerca», che la cornice cerca con una POST, la parola nel corpo e il gettone CSRF, che la parola non sta più nell\'indirizzo della richiesta del browser, e che nel codice del frontend non cambia niente; la GET con la parola nell\'indirizzo non è più nominata (sprint 18 · T1.6; il tratto al backoffice: sprint 25 · T3.5, qui sotto)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $punto = puntoDellaCornice($readme, 'La ricerca');

    expect(str_contains($punto, 'chiede `POST /cornice/ricerca` dal secondo carattere, 300 ms dopo l\'ultimo tasto, con la parola nel corpo (`{q}`) e il gettone CSRF del cookie `XSRF-TOKEN` nell\'header `X-XSRF-TOKEN`'))->toBe(true)
        ->and(str_contains($punto, 'dalla `v1.8.0` ciò che la persona cerca non sta più nell\'indirizzo della richiesta del browser'))->toBe(true)
        // Review, R4: una frase sola, la stessa della riga della rotta.
        ->and(str_contains($punto, 'Nel codice del frontend non cambia niente; un suo test che chiama la GET passa alla POST'))->toBe(true)
        ->and(substr_count($readme, '- **La ricerca**'))->toBe(1)
        // La rotta di prima: né una riga della tabella, né nominata altrove.
        ->and(rigaDellaRotta($readme, 'GET /cornice/ricerca?q='))->toBe('')
        ->and(str_contains($readme, 'GET /cornice/ricerca'))->toBe(false);
});

// Sprint 25 · T3 (voce #1639): anche dal server del modulo al backoffice la parola sta nel corpo (ricerca.crea), ogni risultato
// porta `contesto`, e il freno del backoffice ha la sua risposta. Il README lo dice nella riga della rotta e nel punto «La
// ricerca», con ciò che cambia nei test di un frontend; nessuna frase dice più che al backoffice la parola va nell'indirizzo, né
// nel README né nei file che si installano.

/** Un sorgente su una riga sola, senza i segni di commento a capo riga: una frase di un commento si trova anche dove va a capo. */
function commentiSuUnaRiga(string $sorgente): string
{
    return suUnaRiga((string) preg_replace('~^\s*(?:\*|//)\s?~m', '', $sorgente));
}

it('il README dice che dalla v1.15.0 la parola va nel corpo anche al backoffice, che ogni risultato porta `contesto`, che cosa risponde la rotta al freno del backoffice e che cosa cambia nei test di un frontend (sprint 25 · T3.5)', function (string $dove, string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $testi = ['rotta' => rigaDellaRotta($readme, 'POST /cornice/ricerca'), 'ricerca' => puntoDellaCornice($readme, 'La ricerca')];

    expect($testi[$dove])->not->toBe('')
        ->and(str_contains($testi[$dove], $frase))->toBe(true);
})->with([
    'la riga: che cosa trova' => ['rotta', 'ciò che il backoffice trova nel workspace cercando `q`, coi tipi e nell\'ordine del backoffice, la prima pagina'],
    // Lettura della PR #56, R1: una lista chiusa, quella del registro.
    'la riga: il contesto di un risultato' => ['rotta', 'dalla `v1.15.0` ogni risultato porta `contesto`: `null`, oppure un oggetto coi testi che aiutano a riconoscerlo: di ciò che il backoffice dà passano le sole chiavi che il registro dice per il tipo del risultato (`board` e `lista` di una scheda, `organizzazione` e `ruolo` di un contatto, `pipeline` e `fase` di un\'opportunità), coi soli valori di testo non vuoti; una chiave che il registro non dice per quel tipo resta nella parte server'],
    'la riga: il tratto al backoffice' => ['rotta', 'dalla `v1.15.0` anche dal server del modulo al backoffice la parola viaggia nel corpo: la parte server chiama `ricerca.crea` (`POST /v1/ricerca` con `{q}`), e l\'indirizzo di quella richiesta non porta query'],
    'la riga: il freno del backoffice' => ['rotta', 'se il backoffice frena le ricerche della persona (`429` `troppe_richieste`) la rotta risponde `429` `{errore: "troppe_richieste", persona}` (`persona`, dalla `v2.5.0`: l\'email della persona della sessione, di chi è il freno) con `Retry-After`, i secondi che il backoffice ha detto, e la cornice mostra l\'errore della ricerca'],
    // Sprint 26 · T4.5 (lettura della PR #56, R8): che cosa fa la cornice, nel browser, con quei secondi.
    'la riga: la cornice aspetta i secondi del freno' => ['rotta', 'e la cornice mostra l\'errore della ricerca; dalla `v1.16.0` per quei secondi, al più 60, non manda altre ricerche, qualunque cosa la persona scriva, e allo scadere non riprova da sola: parte la prima parola che la persona scrive dopo'],
    // Lettura della PR #59, R3: il freno non regge a un rimontaggio.
    'la riga: il freno è della cornice montata' => ['rotta', 'il freno vale finché la cornice resta montata: un caricamento di pagina la rifà, e così un cambio di workspace con `LayoutDellaCornice`, e da lì la prima parola parte anche dentro quei secondi'],
    'il punto: il tratto al backoffice' => ['ricerca', 'Dalla `v1.15.0` anche il tratto dal server del modulo al backoffice porta la parola nel corpo: la parte server chiama `ricerca.crea`, una POST, e l\'indirizzo di quella richiesta non porta query'],
    'il punto: il backoffice finto di un frontend' => ['ricerca', 'Per i test di un frontend che passa alla `v1.15.0` cambiano due cose: un backoffice finto che risponde alla ricerca la riceve come `POST /v1/ricerca` con la parola nel corpo (`{q}`), non più come GET con `q` nell\'indirizzo'],
    'il punto: il finto di zr-auth' => ['ricerca', 'il `BackofficeFinto` di zr-auth risponde alla ricerca dalla `v0.12.18`'],
    'il punto: il contesto in una risposta confrontata intera' => ['ricerca', 'ogni risultato di `POST /cornice/ricerca` ha `contesto`, che un caso che confronta la risposta intera aggiunge'],
    'il punto: che cosa porta un risultato' => ['ricerca', 'Un risultato porta tipo, id e titolo e, dalla `v1.15.0`, il `contesto`'],
    // Seconda lettura della PR #60, R8: «una risposta arrivata tardi non sostituisce mai» ha un'eccezione, il 429 del freno.
    'il punto: il 429 fa eccezione' => ['ricerca', 'e una risposta arrivata tardi non sostituisce mai quella dell\'ultima parola. Fa eccezione il `429` del freno, che è della persona e non di una richiesta: dalla `v1.17.0` anche quello di una richiesta che non è più l\'ultima annulla la ricerca in volo e mette l\'errore al posto dei suoi risultati (nella `v1.16.0` armava il freno senza mostrare l\'errore)'],
    'il punto: dove si dà il caso' => ['ricerca', 'In un browser una richiesta annullata non risponde, e il caso non si dà; si dà nei test di un frontend, con una `fetch` finta che non guarda l\'annullo'],
]);

// Letture della PR #56, R12 e N4: che cosa il finto di zr-auth sa della ricerca si guarda nel giro che lo installa, con una
// chiamata al finto e non nel suo sorgente: una patch che riscrive la tabella delle sue rotte senza cambiare comportamento non
// deve far rosso un giro. A una chiamata che non conosce il finto lancia `RichiestaSconosciuta`; a una che conosce risponde, qui
// `401`, perché parte senza gettone. Un giro della CI installa la patch più bassa che il vincolo accetta, l'altro l'ultima: il
// caso prova questi due punti. Da quale versione il finto risponde lo dice il README, letto nei tag di zr-auth: qui non si prova.
it('il `BackofficeFinto` della zr-auth installata risponde a ricerca.crea (`POST /v1/ricerca`) dalla 0.12.18, e il vincolo parte da più su: in tutti e due i giri le risponde, lo dice una chiamata al finto (sprint 26 · T2.2; sprint 55 · T1.4)', function () {
    $composer = json_decode((string) file_get_contents(__DIR__.'/../../composer.json'), true, flags: JSON_THROW_ON_ERROR);
    $piuBasse = array_values(minimiDiZrAuthIn($composer['require']['zeiras/zr-auth']));
    $installata = ltrim((string) InstalledVersions::getPrettyVersion('zeiras/zr-auth'), 'v');
    BackofficeFinto::attiva();

    $risposta = null;
    try {
        $risposta = Http::post(rtrim((string) config('zr-auth.api'), '/').'/v1/ricerca', ['q' => 'uat'])->status();
    } catch (RichiestaSconosciuta) {
        // Il finto non ha la rotta: nessuna risposta.
    }

    expect($installata)->toMatch('/^\d+\.\d+\.\d+$/')
        ->and($piuBasse)->not->toBe([])
        // Dalla `v2.16.0` il vincolo parte dalla 0.12.31: il giro con la patch più bassa ha anche lui un finto che risponde.
        ->and(array_map(fn (string $patch): bool => version_compare($patch, '0.12.18', '>='), $piuBasse))->each->toBe(true)
        ->and($risposta)->toBe(version_compare($installata, '0.12.18', '>=') ? 401 : null);
});

it('né il README né i file che si installano dicono più che al backoffice la parola va nell\'indirizzo, e la parte server nomina ricerca.crea (sprint 25 · T3.5)', function (string $file, string $frase, bool $ceLHa) {
    expect(str_contains(commentiSuUnaRiga((string) file_get_contents(__DIR__.'/../../'.$file)), $frase))->toBe($ceLHa);
})->with([
    'README: la parola non viaggia più nell\'indirizzo' => ['README.md', 'viaggia ancora nell\'indirizzo', false],
    'README: il tratto non resta una GET' => ['README.md', 'resta una GET con la parola nell\'indirizzo', false],
    'README: nessuna GET al backoffice' => ['README.md', 'GET /v1/ricerca', false],
    'README: nessun «finché»' => ['README.md', 'finché il backoffice non dà un metodo col termine nel corpo', false],
    'README: ricerca.elenca non è ciò che zr-core chiama' => ['README.md', 'ricerca.elenca', false],
    'README: ricerca.crea' => ['README.md', 'ricerca.crea', true],
    // Lettura della PR #56, R1: di `contesto` non passa più ogni chiave del backoffice.
    'README: il contesto non ha ogni chiave del backoffice' => ['README.md', 'con le chiavi del backoffice (', false],
    'la classe: il contesto non ha ogni chiave del backoffice' => ['src/Http/RicercaDellaCornice.php', 'con le loro chiavi e nel suo ordine', false],
    'la classe: le chiavi sono quelle del registro' => ['src/Http/RicercaDellaCornice.php', 'le sole chiavi che il registro dei moduli dà al tipo del risultato', true],
    'la classe: ricerca.elenca non c\'è più' => ['src/Http/RicercaDellaCornice.php', 'ricerca.elenca', false],
    'la classe: nessuna GET al backoffice' => ['src/Http/RicercaDellaCornice.php', 'GET /v1/ricerca', false],
    'la classe: la parola non va più nell\'indirizzo' => ['src/Http/RicercaDellaCornice.php', 'va ancora nell\'indirizzo', false],
    'la classe: ricerca.crea' => ['src/Http/RicercaDellaCornice.php', 'ricerca.crea', true],
    'la classe: la POST al backoffice' => ['src/Http/RicercaDellaCornice.php', 'POST /v1/ricerca', true],
    'le rotte: ricerca.elenca non c\'è più' => ['routes/cornice.php', 'ricerca.elenca', false],
    'le rotte: la parola non resta nell\'indirizzo' => ['routes/cornice.php', 'resta nell\'indirizzo', false],
    'le rotte: ricerca.crea' => ['routes/cornice.php', 'ricerca.crea', true],
    'il servizio del browser: la parola non ci sta più' => ['resources/js/servizi.ts', 'ci sta ancora', false],
    'il servizio del browser: nessun «finché»' => ['resources/js/servizi.ts', 'finché il backoffice non dà un metodo col termine nel corpo', false],
]);

// Letture della PR #56, N1 e N2: commenti rimasti a prima della `v1.15.0` in file che si installano. Dalla `v1.15.0` la pagina
// non sta in un contenitore della cornice nemmeno nello stato ridotto, e di `contesto` escono dalla rotta le sole chiavi del
// registro, coi soli testi.
it('layout, servizi e registro del browser dicono nei commenti dove sta la pagina e che cosa arriva in `contesto` (sprint 26 · T1.1, T1.2)', function (string $file, string $frase, bool $ceLHa) {
    expect(str_contains(commentiSuUnaRiga((string) file_get_contents(__DIR__.'/../../'.$file)), $frase))->toBe($ceLHa);
})->with([
    'layout: nessun contenitore sotto l\'avviso' => ['resources/js/layout.tsx', 'in un contenitore sotto', false],
    'layout: col percorso la pagina sta in div.zr-main-body' => ['resources/js/layout.tsx', 'o di `div.zr-main-body`, se ha il percorso', true],
    'layout: nello stato ridotto l\'avviso sta subito prima' => ['resources/js/layout.tsx', 'le mette l\'avviso subito prima', true],
    'servizi: non «con le sue chiavi»' => ['resources/js/servizi.ts', 'con le sue chiavi', false],
    'servizi: non «ognuno un testo o null»' => ['resources/js/servizi.ts', 'ognuno un testo o `null`', false],
    'servizi: le sole chiavi del registro' => ['resources/js/servizi.ts', 'le sole chiavi che il registro dà al tipo', true],
    'servizi: mai un null fra i valori' => ['resources/js/servizi.ts', 'mai un `null` fra i valori', true],
    'registro: le chiavi sono anche ciò che la parte server lascia uscire' => ['resources/js/registro.ts', 'le sole chiavi che la parte server lascia uscire', true],
]);

it('il README dichiara, nel punto che ne parla, ciò che la cornice oggi non dice o non fa (sprint 12 · review, R2, R3, R4)', function (string $grassetto, string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    // Il README con quel punto e quello della ricerca scambiati di nome: la frase c'è, ma dove si legge della ricerca.
    $scambiati = strtr($readme, ["- **{$grassetto}**" => '- **La ricerca**', '- **La ricerca**' => "- **{$grassetto}**"]);

    expect(str_contains(puntoDellaCornice($readme, $grassetto), $frase))->toBe(true)
        ->and(substr_count($readme, "- **{$grassetto}**"))->toBe(1)
        ->and(substr_count($readme, '- **La ricerca**'))->toBe(1)
        ->and(str_contains(suUnaRiga($scambiati), $frase))->toBe(true)
        ->and(str_contains(puntoDellaCornice($scambiati, $grassetto), $frase))->toBe(false);
})->with([
    'R2: mentre il pannello si ricarica il pulsante resta' => ['Le notifiche', 'Mentre il pannello si ricarica l\'elenco di prima resta in pagina e il pulsante resta dov\'è, col fuoco della tastiera'],
    // Sprint 17 · T2 (voce #1481): che la richiesta è in corso e che ne restano ora lo dice il pulsante. Resta l'avviso per il
    // lettore di schermo: al design system manca il posto per un avviso (seconda lettura dello sprint 12, N4).
    'T2.1: che cosa la cornice ancora non dice' => ['Le notifiche', 'Una cosa la cornice ancora non la dice: l\'avviso per il lettore di schermo'],
    'T2.1: niente annuncia il testo che cambia' => ['Le notifiche', 'Il testo del pulsante cambia sullo schermo, ma niente lo annuncia'],
    'T2.1: che cosa manca per dirla' => ['Le notifiche', 'il pannello del design system non ha un posto per un avviso'],
    'R3: il nome della campanella al singolare' => ['La campanella', 'con una sola al singolare («Notifiche, 1 non letta»)'],
    'R3: lo stesso testo è del pallino' => ['La campanella', 'Il design system ha un testo solo per le non lette, e lo usa anche per il pallino di ogni notifica non letta nel pannello'],
    'R3: che cosa dice il pallino' => ['La campanella', 'il pallino dice «non letta» quando sulla campanella ce n\'è una sola, «non lette» negli altri casi'],
    'R4: una lingua con più forme di plurale' => ['La lingua', 'una lingua con più forme di plurale (il polacco, l\'arabo) oggi non entra con un file solo'],
]);

// Sprint 12 · seconda lettura della PR, N2, N3 e N4: tre frasi del README erano vere solo in parte. Il rimedio del limite della
// sessione non è il blocco sulle sole rotte di uscita e di ingresso, che non sono di zr-auth; dopo un'uscita i gettoni non sono
// sempre chiusi; e non è il design system che non ha con che dire le due cose che la cornice non dice.
it('il README non dice più le frasi che la seconda lettura ha trovato vere solo in parte (sprint 12 · seconda lettura, N2, N3, N4)', function (string $nuova, string $diPrima) {
    $readme = suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md'));
    // Il README con la frase di prima al posto di quella nuova: il controllo la vede.
    $conQuellaDiPrima = str_replace($nuova, $diPrima, $readme);

    expect(substr_count($readme, $diPrima))->toBe(0)
        ->and($conQuellaDiPrima)->not->toBe($readme)
        ->and(substr_count($conQuellaDiPrima, $diPrima))->toBe(1);
})->with([
    // Dallo sprint 16 · T4 la frase è un'altra (il blocco lo mette il frontend sulle sue rotte), e dallo sprint 17 · T2 dice
    // il criterio di zr-auth: quella sbagliata resta la stessa.
    'N2: uscita e ingresso non sono rotte di zr-auth' => ['sulle sue rotte che aprono, cambiano o chiudono la sessione', 'sulle rotte di uscita e di ingresso nel workspace, che sono di zr-auth'],
    'N3: dopo un\'uscita i gettoni non sono sempre chiusi' => ['dopo un\'uscita torna la sessione coi gettoni di prima', 'dopo un\'uscita i suoi gettoni sono già chiusi nel backoffice'],
    // Dallo sprint 17 · T2 ciò che la cornice non dice è una cosa sola, e la frase è un'altra: quella sbagliata resta la stessa.
    'N4: non è il design system che non ha con che dirle' => ['Una cosa la cornice ancora non la dice: l\'avviso', 'Due cose la cornice oggi non le dice, perché il design system non ha con che dirle: che una parte'],
    // Sprint 17 · T2 (voce #1481): le frasi di prima che il pulsante dicesse che cosa sta succedendo, e del blocco sulle sole
    // rotte di uscita e di ingresso.
    'T2.1: il testo del pulsante non è più sempre lo stesso' => ['col testo che zr-core gli dà al posto di quello dell\'`AppShell`', 'il testo del pulsante lo dà zr-core, e in questa versione è sempre lo stesso'],
    'T2.1: la cornice dice che la richiesta è in corso' => ['dice «Segno…»', 'il pulsante resta com\'è'],
    'T2.1: e che una parte è stata segnata' => ['dice «Segna le altre»', 'Due cose la cornice oggi non le dice: che una parte è stata segnata'],
    'T2.2: non solo l\'uscita e l\'ingresso' => ['sulle sue rotte che aprono, cambiano o chiudono la sessione', 'sulle sue rotte di uscita e di ingresso in un workspace'],
]);

// Sprint 17 · T2 (voce #1481): quali rotte del frontend tengono il blocco della sessione lo dice zr-auth, nel suo README («Il
// blocco della sessione»): quelle che chiamano `Sessione::apri()`, `Sessione::entra()` o `Sessione::chiudi()`, e le rotte lente
// del modulo; non tutte. Il README di zr-core dice quel criterio e non una regola sua: ogni cosa che nomina è in quella sezione.

/** La sezione «Il blocco della sessione» del README della zr-auth installata, su una riga sola. Vuota se non c'è, lei o il README. */
function bloccoDellaSessioneInZrAuth(): string
{
    $readme = __DIR__.'/../../vendor/zeiras/zr-auth/README.md';
    preg_match('/^## Il blocco della sessione.*?(?=^## |\z)/ms', is_file($readme) ? (string) file_get_contents($readme) : '', $sezione);

    return suUnaRiga($sezione[0] ?? '');
}

it('ogni cosa che il README dice, nel limite della sessione, delle rotte del frontend che tengono il blocco è nel README della zr-auth installata, in «Il blocco della sessione» (sprint 17 · T2.2)', function (string $inZrCore, string $inZrAuth) {
    $limite = limiteDellaSessione((string) file_get_contents(__DIR__.'/../../README.md'));

    // Review della PR #20, R5: il giro «ultima» installa una patch di zr-auth che zr-core non sceglie, e una sezione riscritta lì
    // fa rosso questo confronto senza un cambio in zr-core. È il segnale che T2.2 vuole (il criterio è quello dell'ultima
    // versione accettata), e il messaggio dice che cosa fare: il rosso non si legge come un guasto di zr-core.
    expect(str_contains($limite, $inZrCore))->toBe(true)
        ->and(str_contains(bloccoDellaSessioneInZrAuth(), $inZrAuth))->toBe(true, "Nel README della zr-auth installata «Il blocco della sessione» non dice più «{$inZrAuth}»: va riletta. Se il criterio è lo stesso cambia la frase cercata in questo caso; se è cambiato cambia il README di zr-core, nel limite della sessione.");
})->with([
    'la riga che zr-auth dà ai moduli' => ['`->bloccaSessione()`', '`->bloccaSessione()`'],
    'la rotta che apre la sessione' => ['`Sessione::apri()`', '`Sessione::apri()`'],
    'la rotta che entra in un workspace' => ['`Sessione::entra()`', '`Sessione::entra()`'],
    'la rotta che chiude la sessione' => ['`Sessione::chiudi()`', '`Sessione::chiudi()`'],
    'le rotte lente del modulo' => ['e sulle sue rotte lente', 'le loro rotte lente'],
    'non su tutte' => ['non su tutte', 'Non va su tutto'],
]);

// Sprint 15 · T1 (voce #1584): la voce «Piano» del menu del profilo è spenta di default, e il README dice la prop che la accende.

/** Il punto «Il menu del profilo» del README, su una riga sola: dal grassetto al punto dopo. Vuoto se non c'è. */
function puntoDelMenuDelProfilo(string $readme): string
{
    preg_match('/^- \*\*Il menu del profilo\*\*.*?(?=^- |^$|\z)/ms', $readme, $punto);

    return suUnaRiga($punto[0] ?? '');
}

it('il README dice, nel punto «Il menu del profilo», una frase per cosa: che di default la voce «Piano» non c\'è, la prop piano che la accende, e quando (sprint 15 · T1.5)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    // Il README di prima della v1.5.0, senza quel punto: la frase non si trova più.
    $diPrima = str_replace('- **Il menu del profilo**', '- **Il menu**', $readme);

    expect(str_contains(puntoDelMenuDelProfilo($readme), $frase))->toBe(true)
        ->and(substr_count($readme, '- **Il menu del profilo**'))->toBe(1)
        ->and(puntoDelMenuDelProfilo($diPrima))->toBe('');
})->with([
    'di default la voce non c\'è' => ['La voce «Piano» è spenta di default'],
    'la prop che la accende' => ['Si accende con la prop `piano`'],
    'quando si accende' => ['quando la pagina del piano esiste su app.zeiras.com'],
]);

// Sprint 15 · T2 (voce #1585): i cinque file del logo stanno nel pacchetto, e il README dice dove e come li importa una pagina
// senza cornice. Il simbolo è più piccolo del limite sotto cui Vite, nella build, scrive un file dentro il JS come indirizzo
// `data:`, che la CSP del README non lascia passare (misurato il 10/10/2026 con Vite 8.3.2 e Chromium: `img-src` bloccato): per
// questo il suo import porta `?no-inline`.
it('il README dice, in «Il logo», la cartella dei file del logo, ognuno dei cinque file, come una pagina senza cornice importa logo e simbolo, e perché il simbolo vuole ?no-inline (sprint 15 · T2.2)', function (string $cosa) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    // Il README di prima della v1.5.0, senza quella sezione: la cosa non si trova più.
    $diPrima = str_replace("\n## Il logo\n", "\n## Il marchio\n", $readme);

    expect(str_contains(sezioneDelReadme($readme, 'Il logo'), $cosa))->toBe(true)
        ->and(substr_count($readme, "\n## Il logo\n"))->toBe(1)
        ->and(sezioneDelReadme($diPrima, 'Il logo'))->toBe('');
})->with([
    'la cartella' => ['in `resources/zeiras/logos/`'],
    'il logo per i fondi chiari' => ['`zeiras-logo.svg`'],
    'il logo per i fondi scuri' => ['`zeiras-logo-dark.svg`'],
    'il simbolo' => ['`zeiras-mark.svg`'],
    'il simbolo coi colori del tema scuro' => ['`zeiras-mark-dark.svg`'],
    'la favicon' => ['`zeiras-favicon.svg`'],
    'come si importa il logo' => ['import logo from \'../../vendor/zeiras/zr-core/resources/zeiras/logos/zeiras-logo.svg\';'],
    'come si importa il simbolo' => ['import simbolo from \'../../vendor/zeiras/zr-core/resources/zeiras/logos/zeiras-mark.svg?no-inline\';'],
    'senza ?no-inline il simbolo non passa la CSP' => ['come indirizzo `data:`, che la CSP scritta più sotto non lascia passare'],
    'con ?no-inline la CSP non cambia' => ['Con `?no-inline` resta un file della stessa origine'],
]);

// Sprint 15 · T3 (voce #1585): la favicon arriva dal pacchetto, e il README dice come si monta. favicon.ico e
// apple-touch-icon.png escono da uno script, e la CI li rigenera a ogni giro.
it('il README dice, in «La favicon», la riga per la testa della pagina, i tre file, come arrivano in public/ da soli e col comando, che si committano, e che la CSP non cambia (sprint 15 · T3.6)', function (string $cosa) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    // Il README di prima della v1.5.0, senza quella sezione: la cosa non si trova più.
    $diPrima = str_replace("\n## La favicon\n", "\n## L'icona\n", $readme);

    expect(str_contains(sezioneDelReadme($readme, 'La favicon'), $cosa))->toBe(true)
        ->and(substr_count($readme, "\n## La favicon\n"))->toBe(1)
        ->and(sezioneDelReadme($diPrima, 'La favicon'))->toBe('');
})->with([
    'la riga per la testa della pagina' => ['@include(\'zr-core::favicon\')'],
    'il file SVG' => ['`favicon.svg`'],
    'il file ICO' => ['`favicon.ico`'],
    'l\'icona Apple' => ['`apple-touch-icon.png`'],
    'da soli a ogni composer update' => ['Arrivano da soli a ogni `composer update`'],
    'il tag che i frontend hanno già' => ['`php artisan vendor:publish --tag=laravel-assets --ansi --force`'],
    'il comando col tag di zr-core' => ['php artisan vendor:publish --tag=zr-core-favicon --force'],
    'i tre file si committano' => ['I tre file si committano nel repo del frontend'],
    'la CSP non cambia' => ['la CSP non cambia'],
]);

/**
 * Che cosa non va, in ci.yml, nel passo che lancia quel comando: niente se il passo è sano. Un passo sano è un passo vero del
 * job, non un commento; viene dopo `npm ci`; la sua riga `run:` è il solo comando, senza una coda che ne copra l'uscita
 * (`|| true`); non ha `continue-on-error` né `if:`. Letture della PR #56, R4: cercare la stringa del comando in ci.yml non basta,
 * perché resta lì anche in un passo spento. Lettura della PR #59, R5: un passo sano non ha nemmeno uno `shell:` suo, e sta in
 * un job che ferma la CI — senza `continue-on-error`, `if:` né `defaults:` —, in un file senza `defaults:`; un job che il
 * controllo non riconosce non è sano. Lettura della PR #60, R5: nemmeno un job dietro un altro (`needs:`), che è saltato
 * quando quello è saltato; e una chiave scritta fra virgolette o fra apici è la stessa chiave.
 *
 * @return list<string>
 */
function difettiDelPassoCheLancia(string $comando, string $ci): array
{
    // Una riga di commento non è un passo, e nemmeno un suo pezzo.
    $senzaCommenti = (string) preg_replace('/^\s*#.*\n/m', '', $ci);
    // Un passo va dalla sua riga `      - ` alla riga prima del passo dopo: le sue righe hanno almeno otto spazi, o sono vuote.
    preg_match_all('/^ {6}- .*\n(?:(?: {8}.*)?\n)*/m', $senzaCommenti, $passi);
    $delComando = array_values(array_filter($passi[0], fn (string $passo) => str_contains($passo, $comando)));

    if (count($delComando) !== 1) {
        return ["i passi che lanciano «{$comando}» sono ".count($delComando).', non uno'];
    }

    $difetti = [];
    if (preg_match('/^ {8}run: '.preg_quote($comando, '/').'\n/m', $delComando[0]) !== 1) {
        $difetti[] = 'la riga `run:` non è il solo comando';
    }
    foreach (['continue-on-error', 'if', 'shell'] as $chiave) {
        if (preg_match('/^ {6}(?:- | {2})["\']?'.$chiave.'["\']?:/m', $delComando[0]) === 1) {
            $difetti[] = "il passo ha `{$chiave}:`";
        }
    }
    // Un job va dalla riga del suo nome, a due spazi, alla riga prima del job dopo: le sue righe hanno almeno quattro spazi, o
    // sono vuote. Quello del passo è il solo che lo contiene, e le sue chiavi stanno a quattro spazi.
    preg_match_all('/^ {2}\S.*\n(?:(?: {4}.*)?\n)*/m', $senzaCommenti, $job);
    $delPasso = array_values(array_filter($job[0], fn (string $blocco) => str_contains($blocco, $delComando[0])));
    if (count($delPasso) !== 1) {
        $difetti[] = 'il job del passo non si trova';
    }
    foreach (['continue-on-error', 'if', 'defaults', 'needs'] as $chiave) {
        if (preg_match('/^ {4}["\']?'.$chiave.'["\']?:/m', $delPasso[0] ?? '') === 1) {
            $difetti[] = "il job del passo ha `{$chiave}:`";
        }
    }
    if (preg_match('/^["\']?defaults["\']?:/m', $senzaCommenti) === 1) {
        $difetti[] = 'il file ha `defaults:`';
    }
    $npmCi = strpos($senzaCommenti, "\n          npm ci\n");
    if ($npmCi === false || strpos($senzaCommenti, $delComando[0]) < $npmCi) {
        $difetti[] = 'il passo non viene dopo `npm ci`';
    }

    return $difetti;
}

it('in ci.yml il passo che rigenera e confronta è sano: un passo vero, dopo npm ci, con la riga `run:` che è il solo comando, senza `continue-on-error` né `if:`; lo stesso file col passo commentato, con `continue-on-error`, con `|| true` in coda, con un `if:` o senza npm ci prima non lo è (sprint 26 · T2.4)', function (string $comando) {
    $ci = (string) file_get_contents(__DIR__.'/../../.github/workflows/ci.yml');
    $riga = "        run: {$comando}\n";
    $forme = [
        'commentato' => (string) preg_replace('/^ {6}(- name: [^\n]*\n) {8}(run: '.preg_quote($comando, '/').'\n)/m', '      # $1      #   $2', $ci),
        'con continue-on-error' => str_replace($riga, $riga."        continue-on-error: true\n", $ci),
        'con || true in coda' => str_replace($riga, "        run: {$comando} || true\n", $ci),
        'con un if' => str_replace($riga, "        if: false\n".$riga, $ci),
        'senza npm ci prima' => str_replace("\n          npm ci\n", "\n", $ci),
    ];

    expect(substr_count($ci, $riga))->toBe(1)
        ->and(difettiDelPassoCheLancia($comando, $ci))->toBe([])
        // Ogni forma è un file diverso da quello vero: una forma rimasta uguale direbbe «sano» qui sotto.
        ->and(array_map(fn (string $testo) => difettiDelPassoCheLancia($comando, $testo), $forme))->toBe([
            'commentato' => ["i passi che lanciano «{$comando}» sono 0, non uno"],
            'con continue-on-error' => ['il passo ha `continue-on-error:`'],
            'con || true in coda' => ['la riga `run:` non è il solo comando'],
            'con un if' => ['il passo ha `if:`'],
            'senza npm ci prima' => ['il passo non viene dopo `npm ci`'],
        ]);
})->with(comandiCheRigeneranoEConfrontano());

/** @return array<string, array{string}> i comandi con cui la CI rigenera un file e lo confronta, ognuno in un passo suo: le righe di un dataset */
function comandiCheRigeneranoEConfrontano(): array
{
    return [
        'la favicon' => ['npm run favicon -- --controlla'],
        'i componenti del design system' => ['npm run componenti -- --controlla'],
        'le variabili dei token' => ['npm run token -- --controlla'],
    ];
}

// Sprint 27 · T5.1 (lettura della PR #59, R5). Un passo sano non basta, se sta in un job che non ferma niente: con
// `continue-on-error` o con un `if:` sul job, con uno `shell:` sul passo che ne copre l'uscita, o con un `defaults:` — sul job
// o su tutto il file — che dà quello `shell:` a ogni passo, il passo che rigenera e confronta può fallire e la CI resta verde.
// Il controllo guarda anche lì, e un job che non riconosce non lo dà per sano.

it('in ci.yml il passo che rigenera e confronta sta in un job che ferma la CI: lo stesso file con `continue-on-error`, con un `if:` o con un `needs:` sul job del passo, anche scritti fra virgolette, con uno `shell:` sul passo, con un `defaults:` sul job o sul file, o col job che non si trova non è sano (sprint 27 · T5.1; lettura della PR #60, R5)', function (string $comando) {
    $ci = (string) file_get_contents(__DIR__.'/../../.github/workflows/ci.yml');
    $riga = "        run: {$comando}\n";
    $job = "    runs-on: ubuntu-latest\n";
    // Uno `shell:` che copre l'uscita del comando: lo script del passo gira, e come finisce non conta.
    $shell = 'shell: sh -c "sh {0} || true"'."\n";
    $forme = [
        'con continue-on-error sul job' => str_replace($job, $job."    continue-on-error: true\n", $ci),
        'con un if sul job' => str_replace($job, "    if: false\n".$job, $ci),
        'con shell sul passo' => str_replace($riga, $riga.'        '.$shell, $ci),
        'con defaults sul job' => str_replace($job, $job."    defaults:\n      run:\n        ".$shell, $ci),
        'con defaults sul file' => str_replace("\njobs:\n", "\ndefaults:\n  run:\n    ".$shell."\njobs:\n", $ci),
        // Lettura della PR #60, R5. Un job dietro un altro job è saltato quando quello è saltato, e il passo non gira.
        'con needs sul job' => str_replace($job, "    needs: [prima]\n".$job, $ci),
        // Una chiave scritta fra virgolette o fra apici è la stessa chiave.
        'con un if fra virgolette sul job' => str_replace($job, "    \"if\": false\n".$job, $ci),
        'con continue-on-error fra apici sul passo' => str_replace($riga, $riga."        'continue-on-error': true\n", $ci),
        // Tre spazi davanti al nome del job: per YAML è lo stesso file, ma il controllo non sa più qual è il job del passo.
        'col job che non si trova' => str_replace("\n  ci:\n", "\n   ci:\n", $ci),
    ];

    expect([substr_count($ci, $riga), substr_count($ci, $job), substr_count($ci, "\njobs:\n"), substr_count($ci, "\n  ci:\n")])->toBe([1, 1, 1, 1])
        ->and(difettiDelPassoCheLancia($comando, $ci))->toBe([])
        ->and(array_map(fn (string $testo) => difettiDelPassoCheLancia($comando, $testo), $forme))->toBe([
            'con continue-on-error sul job' => ['il job del passo ha `continue-on-error:`'],
            'con un if sul job' => ['il job del passo ha `if:`'],
            'con shell sul passo' => ['il passo ha `shell:`'],
            'con defaults sul job' => ['il job del passo ha `defaults:`'],
            'con defaults sul file' => ['il file ha `defaults:`'],
            'con needs sul job' => ['il job del passo ha `needs:`'],
            'con un if fra virgolette sul job' => ['il job del passo ha `if:`'],
            'con continue-on-error fra apici sul passo' => ['il passo ha `continue-on-error:`'],
            'col job che non si trova' => ['il job del passo non si trova'],
        ]);
})->with(comandiCheRigeneranoEConfrontano());

it('la CI rigenera la favicon e la confronta, dopo npm ci; lo script è di questo repo, e resvg sta fra gli strumenti a una versione esatta (sprint 15 · T3.3)', function () {
    $ci = (string) file_get_contents(__DIR__.'/../../.github/workflows/ci.yml');
    $package = json_decode((string) file_get_contents(__DIR__.'/../../package.json'), true, flags: JSON_THROW_ON_ERROR);

    expect(difettiDelPassoCheLancia('npm run favicon -- --controlla', $ci))->toBe([])
        ->and($package['scripts']['favicon'] ?? null)->toBe('node scripts/favicon.mjs')
        ->and($package['devDependencies']['@resvg/resvg-js'] ?? null)->toBe('2.6.2')
        ->and(array_keys($package['peerDependencies']))->toBe(['react', 'react-dom'])
        ->and($package)->not->toHaveKey('dependencies');
});

it('la CI rigenera in memoria il modulo dei componenti del design system e lo confronta col file, dopo npm ci; lo script è di questo repo (sprint 25 · T1.1)', function () {
    $ci = (string) file_get_contents(__DIR__.'/../../.github/workflows/ci.yml');
    $package = json_decode((string) file_get_contents(__DIR__.'/../../package.json'), true, flags: JSON_THROW_ON_ERROR);

    expect(difettiDelPassoCheLancia('npm run componenti -- --controlla', $ci))->toBe([])
        ->and($package['scripts']['componenti'] ?? null)->toBe('node scripts/componenti.mjs');
});

it('la CI rigenera in memoria le variabili dei token e le confronta col file, dopo npm ci; lo script è di questo repo (sprint 86 · T1.1)', function () {
    $ci = (string) file_get_contents(__DIR__.'/../../.github/workflows/ci.yml');
    $package = json_decode((string) file_get_contents(__DIR__.'/../../package.json'), true, flags: JSON_THROW_ON_ERROR);

    expect(difettiDelPassoCheLancia('npm run token -- --controlla', $ci))->toBe([])
        ->and($package['scripts']['token'] ?? null)->toBe('node scripts/token-css.mjs');
});

// Sprint 16 · T2 (voce #1472). Il pacchetto porta la sua configurazione, `config/zr-core.php`: è lì che un modulo scrive le
// sorgenti che aggiunge alla CSP di tutti (Zeiras\Core\Http\IntestazioniSicurezza). Di partenza non aggiunge niente; il file del
// frontend vince su quello del pacchetto; lo zip del tag lo porta.

it('porta config/zr-core.php, e di partenza non aggiunge niente alla CSP di tutti: csp e csp_pagine vuoti, e nessuna altra chiave (sprint 16 · T2.5)', function () {
    $file = __DIR__.'/../../config/zr-core.php';
    expect(is_file($file))->toBeTrue();

    expect(require $file)->toBe(['csp' => [], 'csp_pagine' => []]);
});

it('unisce la configurazione di partenza a quella del frontend: senza un file suo valgono i valori di partenza, e una chiave scritta nel suo file vince (sprint 16 · T2.5)', function (array $delFrontend, array $csp, array $cspPagine) {
    expect(config('zr-core'))->toBe(['csp' => [], 'csp_pagine' => []]);

    // Come in un frontend: Laravel carica prima il suo config/zr-core.php, poi il provider ci unisce i valori di partenza.
    config(['zr-core' => $delFrontend]);
    (new ZrCoreServiceProvider(app()))->register();

    expect(config('zr-core.csp'))->toBe($csp)
        ->and(config('zr-core.csp_pagine'))->toBe($cspPagine)
        ->and(array_keys(config('zr-core')))->toEqualCanonicalizing(['csp', 'csp_pagine']);
})->with([
    'solo csp' => [['csp' => ['font-src' => ["'self'"]]], ['font-src' => ["'self'"]], []],
    'solo csp_pagine' => [['csp_pagine' => ['turnstile' => ['frame-src' => ['https://challenges.cloudflare.com']]]], [], ['turnstile' => ['frame-src' => ['https://challenges.cloudflare.com']]]],
    'un file vuoto' => [[], [], []],
]);

it('la configurazione si pubblica col tag zr-core-config, in config/zr-core.php del frontend, uguale a quella del pacchetto; e non col tag che i frontend lanciano con --force a ogni composer update (sprint 16 · T2.5)', function () {
    $origine = realpath(__DIR__.'/../../config/zr-core.php');
    $dichiarati = collect(ServiceProvider::pathsToPublish(ZrCoreServiceProvider::class, 'zr-core-config'))
        ->mapWithKeys(fn (string $a, string $da) => [$a => realpath($da)])->all();

    File::delete(config_path('zr-core.php'));
    try {
        $uscita = Artisan::call('vendor:publish', ['--tag' => 'zr-core-config']);
        $pubblicato = File::exists(config_path('zr-core.php')) ? File::get(config_path('zr-core.php')) : null;
    } finally {
        File::delete(config_path('zr-core.php'));
    }

    expect($origine)->toBeString()
        ->and($dichiarati)->toBe([config_path('zr-core.php') => $origine])
        ->and($uscita)->toBe(0)
        ->and($pubblicato)->toBe(File::get((string) $origine))
        // `laravel-assets --force` riscriverebbe a ogni aggiornamento le sorgenti che il modulo ha scritto nel suo file.
        ->and(array_values(ServiceProvider::pathsToPublish(ZrCoreServiceProvider::class, 'laravel-assets')))->not->toContain(config_path('zr-core.php'))
        ->and(array_values(ServiceProvider::pathsToPublish(ZrCoreServiceProvider::class, 'zr-core-favicon')))->not->toContain(config_path('zr-core.php'));
});

/**
 * Un albero finto: quello di HEAD con dei file in più o cambiati, scritto con un indice a parte (GIT_INDEX_FILE). Il working
 * tree e l'indice vero non si toccano; in .git restano solo oggetti che nessuno nomina.
 *
 * @param  array<string, string>  $file  percorso → contenuto
 * @return string lo sha dell'albero
 */
function alberoFintoCon(array $file): string
{
    $radice = dirname(__DIR__, 2);
    $indice = sys_get_temp_dir().'/zr-core-indice-'.bin2hex(random_bytes(8));
    $git = fn (array $comando, ?string $ingresso = null): string => trim((new Process(['git', ...$comando], $radice, ['GIT_INDEX_FILE' => $indice], $ingresso))->mustRun()->getOutput());

    try {
        $git(['read-tree', 'HEAD']);
        foreach ($file as $percorso => $contenuto) {
            $git(['update-index', '--add', '--cacheinfo', '100644,'.$git(['hash-object', '-w', '--stdin'], $contenuto).','.$percorso]);
        }

        return $git(['write-tree']);
    } finally {
        File::delete($indice);
    }
}

/** @return array{0: int|null, 1: string} il codice d'uscita della guardia dello zip su quell'albero, e ciò che dice */
function guardiaDelloZipSu(string $albero): array
{
    $guardia = new Process(['bash', '.github/zip-del-pacchetto.sh', $albero], dirname(__DIR__, 2));
    $guardia->run();

    return [$guardia->getExitCode(), $guardia->getOutput()];
}

it('la guardia dello zip, su un albero finto: config/zr-core.php è fra ciò che serve a chi installa, e se .gitattributes lo toglie dallo zip la guardia dice che manca; una cartella dal nome simile resta fuori (sprint 16 · T2.5)', function (array $file, int $uscita, array $dice) {
    [$codice, $testo] = guardiaDelloZipSu(alberoFintoCon($file));

    expect($codice)->toBe($uscita)
        ->and($testo)->toContain(...$dice);
})->with([
    'l\'albero di HEAD, com\'è' => [[], 0, ['tutti del pacchetto e nessuno che manca']],
    'con config/zr-core.php' => [['config/zr-core.php' => "<?php\n\nreturn [];\n"], 0, ['tutti del pacchetto e nessuno che manca']],
    'con config/zr-core.php, che .gitattributes toglie dallo zip' => [
        ['config/zr-core.php' => "<?php\n\nreturn [];\n", '.gitattributes' => file_get_contents(__DIR__.'/../../.gitattributes')."/config export-ignore\n"],
        1, ['manca ciò che serve a chi installa', 'config/zr-core.php'],
    ],
    'con una cartella dal nome simile' => [['configurazioni/zr-core.php' => "<?php\n\nreturn [];\n"], 1, ['ciò che non serve a chi installa', 'configurazioni/zr-core.php']],
]);

// Sprint 16 · T3 (voce #1472). Il README dice a chi installa come registra la classe delle intestazioni di sicurezza, dove scrive
// le sorgenti del suo modulo e che cosa tiene nel suo repo; «La CSP» dice che la CSP intera la dà la classe; CLAUDE.md nomina la
// classe fra ciò che zr-core scrive. I valori stanno scritti qui per intero: sono quelli che un modulo ricopia nel suo test.

/** La CSP di tutti, com'è nel README: nella sezione delle intestazioni, e nel test che il README dà da tenere a ogni modulo. */
const CSP_DI_TUTTI_NEL_README = "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; img-src 'self'; font-src https://fonts.gstatic.com; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

/** Il minimo per la cornice, per chi non registra la classe: la riga che guarda anche TokenCssTest. */
const CSP_MINIMA_NEL_README = "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com";

/** La politica più stretta, che dalla v1.8.0 esce al posto di una CSP della risposta che non si può mandare, com'è nel README. */
const CSP_PIU_STRETTA_NEL_README = "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; sandbox";

/**
 * Ciò che «Le intestazioni di sicurezza» del README dice sotto quel titolo di terzo livello, fino al titolo dopo, su una riga
 * sola; con `null`, ciò che dice prima del primo titolo di terzo livello. Vuoto se la sezione o il titolo non ci sono.
 */
function delleIntestazioniNelReadme(string $readme, ?string $sottotitolo): string
{
    preg_match('/^## Le intestazioni di sicurezza$(.*?)(?=^## |\z)/ms', $readme, $sezione);
    $modello = $sottotitolo === null ? '/\A(.*?)(?=^### |\z)/ms' : '/^### '.preg_quote($sottotitolo, '/').'$(.*?)(?=^### |\z)/ms';
    preg_match($modello, $sezione[1] ?? '', $parte);

    return suUnaRiga($parte[1] ?? '');
}

it('il README dice, in «Le intestazioni di sicurezza», una cosa per riga, ognuna sotto il suo titolo: come si registra la classe, le cinque intestazioni coi loro valori, dove un modulo scrive le sue sorgenti e quali sono ammesse, il nome di una pagina e il caricamento intero, il test da tenere nel modulo, la barra di Inertia, ciò che resta al server web (sprint 16 · T3.1)', function (?string $sottotitolo, string $cosa) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    // Il README di prima della v1.6.0, senza quella sezione: la cosa non si trova più.
    $senzaLaSezione = str_replace("\n## Le intestazioni di sicurezza\n", "\n## Le intestazioni\n", $readme);

    expect(str_contains(delleIntestazioniNelReadme($readme, $sottotitolo), $cosa))->toBe(true)
        ->and(substr_count($readme, "\n## Le intestazioni di sicurezza\n"))->toBe(1)
        ->and(delleIntestazioniNelReadme($senzaLaSezione, $sottotitolo))->toBe('');

    if ($sottotitolo !== null) {
        // Il README che la cosa la dice, ma non sotto quel titolo.
        $sottoUnAltroTitolo = str_replace("\n### {$sottotitolo}\n", "\n### Un altro titolo\n", $readme);

        expect(substr_count($readme, "\n### {$sottotitolo}\n"))->toBe(1)
            ->and(delleIntestazioniNelReadme($sottoUnAltroTitolo, $sottotitolo))->toBe('');
    }
})->with([
    'la classe' => [null, '`Zeiras\Core\Http\IntestazioniSicurezza`'],
    'chi la registra, e dove' => [null, 'zr-core non la registra da sé: la registra il frontend, prima dei middleware globali, nel suo `bootstrap/app.php`'],
    'la riga di registrazione' => [null, '$middleware->prepend(\Zeiras\Core\Http\IntestazioniSicurezza::class);'],
    'prima dei globali, non nel gruppo web' => [null, 'Prima dei globali, e non nel gruppo `web`'],
    'Strict-Transport-Security' => [null, '| `Strict-Transport-Security` | `max-age=31536000`: un anno, per questo host solo (senza `includeSubDomains` né `preload`) |'],
    'Content-Security-Policy' => [null, '| `Content-Security-Policy` | la CSP di tutti, qui sotto, più ciò che il modulo aggiunge |'],
    'Referrer-Policy, e quando resta quella della risposta' => [null, '| `Referrer-Policy` | `strict-origin-when-cross-origin`; una risposta che ha già `no-referrer`, e solo quello, lo tiene |'],
    'Permissions-Policy' => [null, '| `Permissions-Policy` | `accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()` |'],
    'X-Content-Type-Options' => [null, '| `X-Content-Type-Options` | `nosniff` |'],
    'la CSP di tutti, per intero' => [null, '``` '.CSP_DI_TUTTI_NEL_README.' ```'],

    'il file delle sorgenti' => ['Le sorgenti di un modulo', 'sta in un file solo, `config/zr-core.php` del frontend'],
    'il comando che lo porta nel frontend' => ['Le sorgenti di un modulo', 'php artisan vendor:publish --tag=zr-core-config'],
    'csp, nell\'esempio' => ['Le sorgenti di un modulo', "'csp' => [ 'font-src' => [\"'self'\"], ],"],
    'csp_pagine, nell\'esempio' => ['Le sorgenti di un modulo', "'csp_pagine' => [ 'turnstile' => [ 'script-src' => ['https://challenges.cloudflare.com'], 'frame-src' => ['https://challenges.cloudflare.com'], ], ],"],
    'le sei direttive' => ['Le sorgenti di un modulo', 'a sei direttive sole — `script-src`, `style-src`, `img-src`, `font-src`, `connect-src`, `frame-src`'],
    'le sorgenti ammesse' => ['Le sorgenti di un modulo', "`'self'`, oppure un'origine `https://` scritta per intero"],
    'una non ammessa è scartata' => ['Le sorgenti di un modulo', '**Una sorgente non ammessa** è scartata, mai aggiustata'],
    'e lascia un avviso nel log' => ['Le sorgenti di un modulo', 'la classe scrive un avviso nel log a ogni risposta'],
    'l\'avviso non porta valori della richiesta' => ['Le sorgenti di un modulo', 'non porta valori della richiesta'],
    'la configurazione in cache' => ['Le sorgenti di un modulo', 'la rifà dopo l\'aggiornamento di zr-core e dopo ogni modifica del file'],

    'come una pagina chiede le sue' => ['Per una pagina sola', "`IntestazioniSicurezza::perLaPagina('<nome>')`"],
    'la chiamata, nell\'esempio' => ['Per una pagina sola', "IntestazioniSicurezza::perLaPagina('turnstile');"],
    'il nome si scrive nel codice' => ['Per una pagina sola', 'Il nome si scrive nel codice, e non si prende mai dalla richiesta'],
    'vale l\'ultimo nome' => ['Per una pagina sola', 'chiamata due volte, vale l\'ultimo nome'],
    'un nome non dichiarato' => ['Per una pagina sola', 'Un nome che la configurazione non dichiara non aggiunge niente, e lascia un avviso nel log'],
    'con Inertia la CSP è del documento' => ['Per una pagina sola', '**Con Inertia la CSP è del documento.**'],
    'il caricamento intero' => ['Per una pagina sola', 'una pagina con sorgenti sue si apre e si lascia con un caricamento intero'],

    'il test nel repo del modulo' => ['Il test nel modulo', 'Ogni modulo tiene nel suo repo un test'],
    'coi valori scritti per intero' => ['Il test nel modulo', 'confronta le cinque intestazioni coi valori scritti per intero'],
    'non una costante di zr-core' => ['Il test nel modulo', 'e non una costante di zr-core'],
    'è un obbligo' => ['Il test nel modulo', 'È un obbligo, non un consiglio'],
    'il test: la risposta che l\'esempio legge (terza lettura, R4)' => ['Il test nel modulo', "\$risposta = \$this->get('/non-esiste')"],
    'il test: Strict-Transport-Security' => ['Il test nel modulo', "->assertHeader('Strict-Transport-Security', 'max-age=31536000')"],
    'il test: Content-Security-Policy' => ['Il test nel modulo', "expect(\$risposta->headers->all('Content-Security-Policy'))->toBe([\"".CSP_DI_TUTTI_NEL_README.'"]);'],
    'il test: Referrer-Policy' => ['Il test nel modulo', "->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin')"],
    'il test: Permissions-Policy' => ['Il test nel modulo', "->assertHeader('Permissions-Policy', 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()')"],
    'il test: X-Content-Type-Options' => ['Il test nel modulo', "->assertHeader('X-Content-Type-Options', 'nosniff');"],
    'la CSP con tutti i suoi valori (sicurezza, D2)' => ['Il test nel modulo', 'La CSP si confronta con tutti i suoi valori, non col primo: una risposta può portarne più d\'una, e `assertHeader` guarda solo il primo'],
    'una classe rimasta nel modulo (sicurezza, D2)' => ['Il test nel modulo', 'quella di zr-core le uscirebbe accanto e il test resterebbe verde'],
    'in quale versione cambiano le intestazioni comuni' => ['Il test nel modulo', 'un cambio che le allarga esce in una minore, con l\'annuncio ai frontend; uno che le stringe, in una maggiore'],

    'la barra aggiunge un <style>' => ['La barra d\'avanzamento di Inertia', 'aggiunge alla pagina un `<style>`'],
    'la barra senza <style>' => ['La barra d\'avanzamento di Inertia', '`progress: { includeCSS: false }`'],
    'o spenta' => ['La barra d\'avanzamento di Inertia', '`progress: false`'],

    'al server web: i file statici' => ['Che cosa resta al server web', '**i file statici** di `public/`'],
    'al server web: i suoi errori' => ['Che cosa resta al server web', '**gli errori del server web**: una risposta che il server web dà da sé, senza arrivare a Laravel'],
    'al server web: la pagina di manutenzione pre-renderizzata' => ['Che cosa resta al server web', '**la pagina di manutenzione pre-renderizzata** (`php artisan down --render=…`): esce prima che Laravel parta'],
    'al server web: X-Frame-Options' => ['Che cosa resta al server web', '**`X-Frame-Options`**: la classe non la manda'],

    // Sprint 16 · review della PR: ciò che la sezione prometteva in più o taceva (R1, R3, R7, R8, R9).
    'le pagine di Laravel cambiano aspetto, non stato (review, R7)' => [null, 'Con la CSP le pagine che Laravel dà da sé cambiano aspetto, non stato'],
    'le pagine d\'errore senza stile (review, R7)' => [null, 'le pagine d\'errore di Laravel — 404, 419, 500, 503 — escono senza stile, perché lo portano in un `<style>` in linea'],
    '/up senza font e script (review, R7)' => [null, '`/up` senza i suoi font e il suo script, che vengono da altre origini'],
    'solo le risposte che passano dai middleware (review, R8)' => [null, 'Su ogni risposta che passa dai middleware di Laravel la classe scrive cinque intestazioni'],
    // Seconda lettura, R9 · T2.7: la CSP che una risposta porta già resta, e quella del modulo le esce accanto.
    'quattro al posto, la CSP accanto (review, R9 · T2.7)' => [null, 'quattro al posto di ciò che la risposta aveva, e la CSP accanto a quella che la risposta porta già, se ne porta una'],
    'una risposta tiene la sua CSP (review, R9 · T2.7)' => [null, 'Una risposta che porta già una CSP la tiene, e quella del modulo le esce accanto: due intestazioni, prima quella della risposta'],
    'il browser le applica tutte e due (review, R9 · T2.7)' => [null, 'Il browser le applica tutte e due, e passa solo ciò che ammettono entrambe'],
    'stringere sì, allargare no (review, R9 · T2.7)' => [null, 'una risposta può stringere la CSP del modulo, mai allargarla'],
    'per allargare c\'è csp_pagine (review, R9 · T2.7)' => [null, 'per allargare c\'è solo `csp_pagine` (vedi «Per una pagina sola»)'],
    'i file che Laravel serve da un disco (review, R9 · T2.7)' => [null, 'È il caso dei file che Laravel serve da un disco (`\'serve\' => true` in `config/filesystems.php`)'],
    'la CSP con sandbox resta (review, R9 · T2.7)' => [null, 'li manda con una CSP sua, con `sandbox`, e quella CSP resta: un file caricato da una persona non gira nell\'origine del modulo'],
    'una uguale esce una volta sola (review, R9 · T2.7)' => [null, 'Una CSP uguale a quella del modulo esce una volta sola'],
    'una classe del frontend rimasta accanto (review, R9 · T2.7)' => [null, 'Vale anche per una classe del frontend rimasta accanto a questa: se scrive la sua CSP più all\'interno, la risposta le porta tutte e due'],
    'frame-src non è nella CSP di tutti (review, R1)' => ['Le sorgenti di un modulo', 'Con un\'eccezione, `frame-src`, l\'unica delle sei che la CSP di tutti non ha'],
    'finché manca vale default-src (review, R1)' => ['Le sorgenti di un modulo', 'finché nessuno la scrive le cornici seguono `default-src`, cioè la sola origine del modulo'],
    'dalla prima sorgente vale solo ciò che è scritto (review, R1)' => ['Le sorgenti di un modulo', 'dalla prima sorgente vale solo ciò che è scritto lì'],
    'chi incornicia la propria origine scrive anche self (review, R1)' => ['Le sorgenti di un modulo', "Chi incornicia anche la propria origine scrive anche `'self'` in `frame-src`"],
    'senza, niente cornici e niente avviso (review, R1)' => ['Le sorgenti di un modulo', 'senza, quelle cornici non si caricano più, e nel log non c\'è un avviso'],
    'al server web: gli errori fuori dai middleware (review, R8)' => ['Che cosa resta al server web', '**gli errori che Laravel rende fuori dai middleware**: un errore fatale di PHP (tempo o memoria finiti), un errore all\'avvio dell\'applicazione, un 500 mentre anche il gestore delle eccezioni lancia (un log che non scrive)'],
    'ciò che non passa dai middleware (review, R8)' => ['Che cosa resta al server web', 'La classe scrive sulle risposte che passano dai middleware di Laravel'],
    'la CSP del server web si toglie (review, R3)' => ['Che cosa resta al server web', 'La CSP si toglie e basta: due CSP sono due politiche, e il browser le applica insieme'],
    'perché la CSP del server web si toglie (review, R3)' => ['Che cosa resta al server web', 'su una pagina che chiede sorgenti sue quella del server web, sempre uguale, le terrebbe bloccate'],
]);

// Sprint 16 · seconda lettura della PR (R9, N1, N2): le frasi che il README non dice più, perché non sono più vere.
it('il README non dice più che una CSP della risposta lascia il posto a quella del modulo, che dopo la rotta il margine c\'è sempre, né che il tetto sono 10 secondi di richiami (sprint 16 · seconda lettura, R9, N1 e N2)', function (string $diPrima, string $alPostoDi) {
    $readme = suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md'));
    // Il README con la frase di prima rimessa al posto di quella di adesso: il controllo la vede.
    $conLaFraseDiPrima = str_replace($alPostoDi, $diPrima, $readme);

    expect(str_contains($readme, $diPrima))->toBe(false)
        ->and($conLaFraseDiPrima)->not->toBe($readme)
        ->and(str_contains($conLaFraseDiPrima, $diPrima))->toBe(true);
})->with([
    'una CSP più stretta esce con quella del modulo (R9)' => ['esce con quella del modulo', 'e quella del modulo le esce accanto: due intestazioni'],
    'la classe non stringe una risposta sola (R9)' => ['La classe non ha un modo per stringere una risposta sola', 'una risposta può stringere la CSP del modulo, mai allargarla'],
    'al posto di ciò che la risposta aveva, anche la CSP (R9)' => ['la classe scrive cinque intestazioni, al posto di ciò che la risposta aveva:', 'la classe scrive cinque intestazioni: quattro al posto di ciò che la risposta aveva'],
    'il margine c\'è sempre (N1)' => ['restano i 5 secondi di margine per chiudere la richiesta.', 'restano almeno i 5 secondi di margine per chiudere la richiesta, se alla rotta si arriva entro 15 secondi dall\'arrivo'],
    'il tetto sono 10 secondi di richiami (N2)' => ['o se i richiami durano più di 10 secondi', 'o passati 10 secondi dall\'arrivo della richiesta, un clic'],
]);

// Sprint 18 · T3.5 (voce #1628): dalla v1.8.0 una CSP della risposta che non si può mandare non resta. Il README lo dice dove
// dice che una risposta la sua CSP la tiene, subito dopo: lo scarto, e l'avviso.
it('il README dice, in «Le intestazioni di sicurezza» e subito dopo «la tiene», che una CSP della risposta che non si può mandare è scartata, che al suo posto esce la politica più stretta e che lo scarto lascia un avviso nel log, una frase per cosa (sprint 18 · T3.5)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    // Il README di prima della v1.6.0, senza quella sezione: la frase non si trova più.
    $senzaLaSezione = str_replace("\n## Le intestazioni di sicurezza\n", "\n## Le intestazioni\n", $readme);

    expect(substr_count(delleIntestazioniNelReadme($readme, null), $frase))->toBe(1)
        ->and(delleIntestazioniNelReadme($senzaLaSezione, null))->toBe('');
})->with([
    'lo scarto, subito dopo «la tiene»' => ['la risposta le porta tutte e due. Una sola non resta: quella che non si può mandare'],
    'che cosa non si può mandare' => ['una lista, un oggetto che non si legge come testo, un testo con un a capo in mezzo o con un byte nullo'],
    'che cosa succedeva' => ['all\'invio PHP su quel valore avvisa o si ferma, e Laravel di ogni avviso fa un\'eccezione: l\'invio si interrompe fuori dai middleware, ed è un 500 senza intestazioni'],
    'da quale versione, e che cosa esce al suo posto' => ['Dalla `v1.8.0` la classe la scarta e al suo posto mette la politica più stretta, una volta sola per risposta'],
    'la politica più stretta, per intero' => ["`default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; sandbox`"],
    'come esce la risposta' => ['La risposta esce col suo stato, il suo corpo, le altre sue CSP e quella del modulo'],
    // Seconda lettura della PR #22, N1: la politica più stretta ferma una pagina solo dove il browser applica una CSP.
    'che cosa fa il browser' => ['con quella politica, quando il browser la carica come documento, non carica e non esegue niente di quella pagina, finché l\'errore non è corretto nel codice del modulo'],
    'mai una CSP più larga di quella chiesta' => ['una pagina non esce mai con una CSP più larga di quella che il suo codice aveva chiesto'],
    'dove il browser non applica nessuna CSP' => ['Dove il browser non applica nessuna CSP — una visita di Inertia, una risposta JSON, un rimando, un file scaricato — non si ferma niente, come niente avrebbe stretto la CSP scartata: lì il solo segno è l\'avviso'],
    'l\'avviso' => ['Lo scarto lascia nel log un avviso, nella riga degli altri scarti della CSP e per primo: dice il tipo del valore, mai il valore'],
    'ciò che PHP sa scrivere resta' => ['Ciò che PHP sa scrivere resta com\'è: anche un testo con un a capo in fondo, che PHP all\'invio taglia'],
    // Seconda lettura, R8: l'oggetto resta lo stesso, e all'invio è letto di nuovo.
    'un oggetto è letto di nuovo all\'invio' => ['Di un oggetto che si legge come testo la classe guarda il testo e tiene l\'oggetto, che all\'invio è letto di nuovo: se a ogni lettura dà un testo diverso, ciò che l\'invio trova può non essere ciò che la classe ha guardato'],
    // Seconda lettura, S3: il 500 di prima c'era col gestore degli errori di Laravel; dove è cambiato, la versione stringe.
    'un frontend che cambia il gestore degli errori' => ['in un frontend che lo cambia, o che abbassa `error_reporting`, una lista o un testo con un a capo non fermavano l\'invio (PHP avvisa e va avanti: della lista scrive `Array`, il testo con l\'a capo non lo scrive) — lì, dalla `v1.8.0`, al loro posto esce la più stretta'],
]);

// Review della PR #22, R1: lo scarto semplice faceva uscire la pagina con una CSP più larga di quella chiesta, e il README lo
// diceva. Quella frase non c'è più.
it('il README non dice più che la pagina esce senza quella CSP e basta (sprint 18 · T3.5)', function () {
    $delleIntestazioni = delleIntestazioniNelReadme((string) file_get_contents(__DIR__.'/../../README.md'), null);

    expect($delleIntestazioni)->not->toBe('')
        ->and(str_contains($delleIntestazioni, 'esce quindi senza quella CSP'))->toBe(false)
        ->and(str_contains($delleIntestazioni, 'l\'avviso è il solo segno che manca'))->toBe(false);
});

// Sprint 16 · lettura di sicurezza, D2: `assertHeader` guarda solo il primo valore, e da T2.7 una risposta può portare più di una CSP.
it('il test che il README dà a ogni modulo confronta la CSP con tutti i suoi valori, non col primo (sprint 16 · lettura di sicurezza, D2)', function () {
    $nelModulo = delleIntestazioniNelReadme((string) file_get_contents(__DIR__.'/../../README.md'), 'Il test nel modulo');
    $conTuttiIValori = "expect(\$risposta->headers->all('Content-Security-Policy'))->toBe([\"".CSP_DI_TUTTI_NEL_README.'"]);';
    $colPrimo = "->assertHeader('Content-Security-Policy', \"".CSP_DI_TUTTI_NEL_README.'")';
    // Il test di prima rimesso al posto di quello di adesso: il controllo lo vede.
    $conQuelloDiPrima = str_replace($conTuttiIValori, $colPrimo, $nelModulo);

    expect(substr_count($nelModulo, $conTuttiIValori))->toBe(1)
        ->and(str_contains($nelModulo, "assertHeader('Content-Security-Policy'"))->toBe(false)
        ->and(str_contains($conQuelloDiPrima, "assertHeader('Content-Security-Policy'"))->toBe(true);
});

// Sprint 16 · review, R1: l'avvertenza su `frame-src` sta anche dove chi scrive le sorgenti la legge — il commento della
// configurazione, che arriva nel frontend col file — e nel commento della classe.
it('il commento di config/zr-core.php e quello della classe dicono che frame-src nella CSP di tutti non c\'è, e che chi incornicia anche la propria origine scrive anche \'self\' (sprint 16 · review, R1)', function (string $file, string $nonCE, string $ancheSelf) {
    // I commenti del file su una riga sola, senza gli asterischi in testa alle righe.
    $commenti = (string) preg_replace('~\s*\n\s*\*\s?~', ' ', (string) file_get_contents(__DIR__.'/../../'.$file));

    expect(str_contains($commenti, $nonCE))->toBe(true)
        ->and(str_contains($commenti, $ancheSelf))->toBe(true)
        // Una volta sola: l'avvertenza è una, non due scritte in modi diversi.
        ->and(substr_count($commenti, $ancheSelf))->toBe(1);
})->with([
    'la configurazione' => ['config/zr-core.php', 'frame-src nella CSP di tutti non c\'è', 'chi incornicia anche la propria origine scrive anche \'self\''],
    'la classe' => ['src/Http/IntestazioniSicurezza.php', '`frame-src` nella CSP di tutti non c\'è', 'chi incornicia anche la propria origine scrive anche `\'self\'`'],
]);

it('nel README «Le intestazioni di sicurezza» sta fra «La favicon» e «La CSP», coi suoi cinque titoli; e ogni CSP che scrive per intero è quella di tutti o la politica più stretta, le stesse della classe (sprint 16 · T3.1; sprint 18 · T3.5)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    preg_match_all('/^## (.+)$/m', $readme, $titoli);
    preg_match('/^## Le intestazioni di sicurezza$(.*?)(?=^## |\z)/ms', $readme, $sezione);
    preg_match_all('/^### (.+)$/m', $sezione[1] ?? '', $sottotitoli);
    preg_match_all('/default-src \'[^"`\n]*/', $sezione[1] ?? '', $scritte);

    // Dallo sprint 28 dopo «La CSP» c'è «Il precarico dei file d'ingresso», in fondo, e dallo sprint 29 fra i due «Gli host
    // fidati»: i primi tre restano uno dopo l'altro.
    expect(array_slice($titoli[1], -5))->toBe(['La favicon', 'Le intestazioni di sicurezza', 'La CSP', 'Gli host fidati', 'Il precarico dei file d\'ingresso'])
        ->and($sottotitoli[1])->toBe(['Le sorgenti di un modulo', 'Per una pagina sola', 'Il test nel modulo', 'La barra d\'avanzamento di Inertia', 'Che cosa resta al server web'])
        // La più stretta una volta, dove il README dice lo scarto; quella di tutti due: da sola, e nel test che un modulo ricopia.
        ->and($scritte[0])->toBe([CSP_PIU_STRETTA_NEL_README, CSP_DI_TUTTI_NEL_README, CSP_DI_TUTTI_NEL_README])
        ->and(IntestazioniSicurezza::CSP)->toBe(CSP_DI_TUTTI_NEL_README)
        ->and((new ReflectionClassConstant(IntestazioniSicurezza::class, 'PIU_STRETTA'))->getValue())->toBe(CSP_PIU_STRETTA_NEL_README);
});

it('il README dice, in «La CSP», che la CSP intera la dà la classe, e tiene il minimo per la cornice per chi non la registra: solo a lui dice di mettere da sé frame-ancestors, base-uri e form-action (sprint 16 · T3.2)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $sezione = sezioneDelReadme($readme, 'La CSP');
    // Ciò che la sezione dice a chi registra la classe, e ciò che dice a chi non la registra.
    $aChiLaRegistra = (string) strstr($sezione, 'Chi non la registra', true);
    $aChiNonLaRegistra = (string) strstr($sezione, 'Chi non la registra');
    // Il README della v1.5.0 lo diceva a tutti: con quella frase al posto della nuova, il controllo la vede.
    $nuova = '`frame-ancestors`, `base-uri` e `form-action` in quel caso li mette da sé.';
    $diPrima = '`frame-ancestors`, `base-uri` e `form-action` non ricadono su `default-src`, e il frontend li mette da sé.';
    $conQuellaDiPrima = str_replace($nuova, $diPrima, suUnaRiga($readme));

    expect(str_contains($aChiLaRegistra, 'La CSP intera la dà la classe delle intestazioni di sicurezza'))->toBe(true)
        ->and(str_contains($aChiLaRegistra, 'chi la registra non ne scrive una sua'))->toBe(true)
        ->and(substr_count($aChiLaRegistra, 'da sé'))->toBe(0)
        // Una CSP sola nella sezione, il minimo, e solo per chi non registra la classe: quella intera sta sopra.
        ->and(substr_count($sezione, "default-src '"))->toBe(1)
        ->and(substr_count($aChiNonLaRegistra, '``` Content-Security-Policy: '.CSP_MINIMA_NEL_README.' ```'))->toBe(1)
        ->and(substr_count($aChiNonLaRegistra, 'da sé'))->toBe(1)
        ->and(str_contains($aChiNonLaRegistra, $nuova))->toBe(true)
        // Il minimo non dice un'altra cosa: ogni sua direttiva è, uguale, nella CSP di tutti.
        ->and(array_values(array_diff(explode('; ', CSP_MINIMA_NEL_README), explode('; ', CSP_DI_TUTTI_NEL_README))))->toBe([])
        ->and(substr_count(suUnaRiga($readme), $diPrima))->toBe(0)
        ->and(substr_count($conQuellaDiPrima, $diPrima))->toBe(1);
});

/** Il punto «Le intestazioni di sicurezza» di «Cosa scrive questa sessione», in CLAUDE.md, su una riga sola. Vuoto se non c'è. */
function puntoDelleIntestazioniInClaude(string $claude): string
{
    preg_match('/^## Cosa scrive questa sessione$(.*?)(?=^## |\z)/ms', $claude, $sezione);
    preg_match('/^- \*\*Le intestazioni di sicurezza\*\*.*?(?=^- \*\*|\z)/ms', $sezione[1] ?? '', $punto);

    return suUnaRiga($punto[0] ?? '');
}

/**
 * Ciò che in un testo ha la forma di un indirizzo o del nome di una macchina — un numero IP, un nome con un punto dentro — o è
 * il nome di un programma che fa da server web: in un file pubblico si dice «il server web», non il suo nome.
 *
 * @return list<string>
 */
function indirizziENomiDiServerIn(string $testo): array
{
    preg_match_all('/[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+|\b(?:nginx|apache|caddy|forge)\b/i', $testo, $trovati);

    return array_values(array_unique($trovati[0]));
}

it('CLAUDE.md nomina la classe delle intestazioni di sicurezza fra ciò che zr-core scrive — la registra il frontend, le sorgenti di un modulo stanno in config/zr-core.php, ogni modifica passa da una revisione di sicurezza — e il punto non porta indirizzi né nomi di server (sprint 16 · T3.3)', function () {
    $claude = (string) file_get_contents(__DIR__.'/../../CLAUDE.md');
    $punto = puntoDelleIntestazioniInClaude($claude);
    // CLAUDE.md col punto finito sotto «Cosa NON fa»: c'è ancora, ma non fra ciò che zr-core scrive.
    $sottoUnAltroTitolo = strtr($claude, ["\n## Cosa scrive questa sessione\n" => "\n## Cosa NON fa\n", "\n## Cosa NON fa\n" => "\n## Cosa scrive questa sessione\n"]);

    expect(str_contains($punto, '`Zeiras\Core\Http\IntestazioniSicurezza`'))->toBe(true)
        ->and(str_contains($punto, 'la registra il frontend'))->toBe(true)
        ->and(str_contains($punto, 'stanno nel suo `config/zr-core.php`'))->toBe(true)
        ->and(str_contains($punto, 'passa da una revisione di sicurezza prima del tag'))->toBe(true)
        ->and(substr_count($claude, '- **Le intestazioni di sicurezza**'))->toBe(1)
        ->and(puntoDelleIntestazioniInClaude($sottoUnAltroTitolo))->toBe('')
        // Di ciò che ha un punto dentro, lì c'è solo il nome del file della configurazione.
        ->and(indirizziENomiDiServerIn($punto))->toBe(['zr-core.php'])
        ->and(indirizziENomiDiServerIn($punto.' (10.0.0.5)'))->toBe(['zr-core.php', '10.0.0.5'])
        ->and(indirizziENomiDiServerIn($punto.' su web-1.example.net'))->toBe(['zr-core.php', 'web-1.example.net'])
        ->and(indirizziENomiDiServerIn($punto.' Lo manda Nginx.'))->toBe(['zr-core.php', 'Nginx']);
});

// Sprint 16 · T5 (voce #1479): fuori dalla cornice il titolo di un tipo di notifica lo dà `titoloDellaNotifica`, dallo stesso
// ingresso di `nomeDellaVoce`, e il README lo dice nello stesso paragrafo.

/** Il paragrafo del README che comincia con «Fuori dalla cornice», su una riga sola: fino alla riga vuota. Vuoto se non c'è. */
function paragrafoFuoriDallaCornice(string $readme): string
{
    preg_match('/^Fuori dalla cornice .*?(?=^$|\z)/ms', $readme, $paragrafo);

    return suUnaRiga($paragrafo[0] ?? '');
}

it('il README dice, nel paragrafo di nomeDellaVoce, la funzione che dà il titolo di un tipo di notifica, una frase per cosa: nome e argomenti, da dove si importa, che cosa dà, che cosa sono tipo e lingua, quali tipi zr-core conosce, il ripiego (sprint 16 · T5.3)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    // Il README con quel paragrafo sotto un altro inizio: la frase c'è ancora, ma non accanto a `nomeDellaVoce`.
    $altrove = str_replace("\nFuori dalla cornice ", "\nDentro la cornice ", $readme);

    expect(str_contains(paragrafoFuoriDallaCornice($readme), $frase))->toBe(true)
        ->and(str_contains(paragrafoFuoriDallaCornice($readme), '`registro` e `nomeDellaVoce(voce, lingua)`'))->toBe(true)
        ->and(substr_count($readme, "\nFuori dalla cornice "))->toBe(1)
        ->and(str_contains(suUnaRiga($altrove), $frase))->toBe(true)
        ->and(paragrafoFuoriDallaCornice($altrove))->toBe('');
})->with([
    'nome e argomenti' => ['`titoloDellaNotifica(tipo, lingua)`'],
    // Sprint 33 · T1.1 (voce #1915): dalla `v2.0.0` non più dallo stesso ingresso.
    'da dove si importa, e per chi' => ['Da `…/resources/js/frasi` — dalla `v2.0.0`: prima dallo stesso ingresso, vedi «Passare alla v2» — si importa `titoloDellaNotifica(tipo, lingua)`, per chi mostra le notifiche in una pagina sua'],
    'che cosa dà' => ['dà il titolo di una notifica di quel tipo nella lingua'],
    // Sprint 29 · T4 (review della PR #62, R5): dalla `v1.19.0` il pannello usa `rigaDellaNotifica`, e questo è il titolo di prima.
    'è il titolo senza la frase' => ['è il titolo che il pannello della cornice scrive quando la notifica non ha una frase con chi ha fatto'],
    'che cos\'è tipo' => ['`tipo` è il `tipo` della notifica, com\'è nella risposta del backoffice (`com.zeiras.board.scheda.creata`)'],
    'che cos\'è lingua' => ['`lingua` è il codice della lingua della persona, e vale come per la cornice: `it-IT` è `it`'],
    'una lingua che zr-core non ha' => ['con una lingua che zr-core non ha il titolo è in inglese'],
    'i tipi conosciuti sono le chiavi dell\'inglese' => ['I tipi che zr-core conosce sono le chiavi `notificationTitle.<tipo>` dell\'inglese (`resources/lingue/notifiche/en.json`)'],
    'il ripiego' => ['un tipo che non è fra quelle — nuovo nel contratto, vuoto, mancante, o che non è un testo — ha il titolo di ripiego della lingua («Novità nel workspace»)'],
    'mai il codice del tipo' => ['ha il titolo di ripiego della lingua («Novità nel workspace»), mai il codice del tipo'],
]);

// Sprint 20 · T1.8 (review della PR #24, R1): per una notifica su un'app il backoffice dà in `risorsa_nome` il codice dell'app. Il
// nome da mostrare lo dà `risorsaDellaNotifica`, che è la funzione del pannello, e il README lo dice nello stesso paragrafo.

it('il README dice, nel paragrafo di titoloDellaNotifica, la funzione che dà la riga sotto il titolo, una frase per cosa: nome e argomenti, da quale versione, che cosa dà, che cosa legge della notifica, che cosa fa per una notifica su un\'app, e quando non dà niente (sprint 20 · T1.8)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $altrove = str_replace("\nFuori dalla cornice ", "\nDentro la cornice ", $readme);

    expect(str_contains(paragrafoFuoriDallaCornice($readme), $frase))->toBe(true)
        ->and(str_contains(paragrafoFuoriDallaCornice($readme), '`titoloDellaNotifica(tipo, lingua)`'))->toBe(true)
        ->and(str_contains(suUnaRiga($altrove), $frase))->toBe(true)
        ->and(paragrafoFuoriDallaCornice($altrove))->toBe('');
})->with([
    'nome, argomenti e versione' => ['Dalla `v1.10.0` si importa anche `risorsaDellaNotifica(notifica, lingua)`, per la riga sotto il titolo'],
    // Sprint 29 · T4 (review della PR #62, R5): è la riga di sotto solo quando il nome non è già nella frase del titolo.
    'che cosa dà' => ['dà il nome della cosa a cui la notifica si riferisce: è la riga che il pannello scrive sotto il titolo quando il nome non è già nella frase'],
    'che cosa legge' => ['`notifica` è la notifica com\'è, del backoffice o di `GET /cornice/notifiche`: la funzione ne legge `tipo` e `risorsa_nome`'],
    'il nome com\'è' => ['Di norma dà `risorsa_nome` senza gli spazi intorno'],
    'una notifica su un\'app' => ['per una notifica su un\'app (un tipo che comincia con `com.zeiras.app.`), dove `risorsa_nome` è il codice dell\'app (`pm`), dà il nome del prodotto nella lingua, quello di `nomeDellaVoce`'],
    'quando non dà niente' => ['Non dà niente (`undefined`) quando il nome non c\'è — `null`, vuoto, di soli spazi, mancante, o che non è un testo — e quando il codice non è di un prodotto del registro'],
    'mai il codice' => ['lì la riga non si mostra, e il codice mai'],
]);

// Sprint 16 · T7 (voce #1621): il registro dice per ogni voce se il prodotto è in arrivo per chi non ha una sessione
// (`in_arrivo`), e non è «Presto»: il README dice la differenza subito dopo il paragrafo di `registro` e `nomeDellaVoce`.

/** Il capoverso del README sui due sì o no di una voce del registro, su una riga sola: fino alla riga vuota. Vuoto se non c'è. */
function paragrafoDeiDueSiONo(string $readme): string
{
    preg_match('/^Ogni voce del registro porta due sì o no .*?(?=^$|\z)/ms', $readme, $paragrafo);

    return suUnaRiga($paragrafo[0] ?? '');
}

it('il README dice, subito dopo il paragrafo di nomeDellaVoce, i due sì o no di una voce del registro, una frase per cosa: `presto` è della cornice, `in_arrivo` delle pagine senza sessione, e dentro la sessione decide il backoffice (sprint 16 · T7.4)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    // Il README con quel capoverso sotto un altro inizio: la frase c'è ancora, ma non dove chi legge del registro la cerca.
    $altrove = str_replace("\nOgni voce del registro porta due sì o no ", "\nOgni voce porta due dati ", $readme);

    expect(str_contains(paragrafoDeiDueSiONo($readme), $frase))->toBe(true)
        ->and(substr_count($readme, "\nOgni voce del registro porta due sì o no "))->toBe(1)
        // Subito dopo il paragrafo «Fuori dalla cornice»: fra i due c'è solo la riga vuota.
        ->and(preg_match('/^Fuori dalla cornice (?:[^\n]+\n)+\nOgni voce del registro porta due sì o no /m', $readme))->toBe(1)
        ->and(str_contains(suUnaRiga($altrove), $frase))->toBe(true)
        ->and(paragrafoDeiDueSiONo($altrove))->toBe('');
})->with([
    'i due non dicono la stessa cosa' => ['sullo stato del prodotto, e non dicono la stessa cosa'],
    '`presto` è della cornice' => ['`presto` è della cornice: un prodotto «Presto» non c\'è ancora'],
    '«Presto» vale in ogni workspace' => ['la sua voce non porta da nessuna parte in nessun workspace, qualunque cosa dica il backoffice'],
    '`in_arrivo` è delle pagine senza sessione' => ['`in_arrivo` è per le pagine senza sessione — Registrati —, che non hanno un workspace a cui chiedere lo stato di un prodotto'],
    'lì si mostra «In arrivo»' => ['lì un prodotto in arrivo si mostra «In arrivo», non «Disponibile»'],
    'perché nessuno può ancora aprirlo' => ['perché non lo può ancora aprire nessuno, salvo i workspace che il backoffice ammette in anteprima'],
    'dentro la sessione decide il backoffice' => ['Dentro la sessione lo stato di un prodotto lo dà il backoffice, workspace per workspace'],
    'la cornice non lo legge' => ['la cornice `in_arrivo` non lo legge: nel workspace di un\'anteprima il prodotto si apre'],
    'si apre se il registro non lo dà «Presto» (terza lettura, R2)' => ['nel workspace di un\'anteprima il prodotto si apre, se il registro non lo dà «Presto»'],
    '«Presto» è anche in arrivo' => ['Ogni prodotto «Presto» è anche in arrivo'],
    'quali, lo dice il registro' => ['quali prodotti lo sono lo dice il registro (`resources/registro/prodotti.json`)'],
    // Sprint 26 · T8.4 (voce #1792): dal 12/10/2026 il CRM è per tutti. Chi legge che cosa, e quali restano in arrivo.
    'chi non ha una sessione legge `in_arrivo`' => ['Una pagina senza sessione legge `in_arrivo`, non `presto`: Bookings e Finanze sono in arrivo e non sono «Presto»'],
    'dalla v1.16.0 il CRM non è più in arrivo' => ['Dalla `v1.16.0` il CRM non è più in arrivo (`in_arrivo: false`): dal 12/10/2026 il backoffice lo dà `disponibile` a ogni workspace'],
    'quali restano in arrivo' => ['in arrivo restano Bookings e Finanze e i tre «Presto»'],
]);

// Sprint 26 · T8 (voce #1792): la guida del modulo nuovo dice quando `in_arrivo` si è spento per il CRM, e nel passo del registro
// racconta l'errore pagato davvero: una pagina senza sessione che leggeva `presto`.

const PASSO_DEL_REGISTRO = '## 8. Il prodotto nel registro';

const PASSO_DELLA_RICERCA = '## 9. La ricerca';

/** Un passo della guida, dal suo titolo (`## 8. Il prodotto nel registro`) alla riga prima del titolo dopo. Vuoto se non c'è. */
function passoDellaGuida(string $guida, string $titolo): string
{
    preg_match('/^'.preg_quote($titolo, '/').'\n.*?(?=^## |\z)/ms', $guida, $passo);

    return $passo[0] ?? '';
}

/**
 * Le frasi della guida su `in_arrivo` e sull'errore pagato del passo del registro, ognuna col titolo del passo in cui sta: le
 * righe di un dataset.
 *
 * @return array<string, array{string, string}>
 */
function frasiDellaGuidaSuInArrivo(): array
{
    return [
        'quando si è spento per il CRM' => ['`in_arrivo` si spegne quando il prodotto esce per tutti: lo decide zr-pm, e lo chiedi allo stesso modo (per il CRM è successo il 12/10/2026, con la `v1.16.0`)', '## Prima di tutto: ciò che si chiede ad altri'],
        'l\'errore pagato' => ['**Errore già pagato**: una pagina senza sessione che legge `presto` al posto di `in_arrivo`', PASSO_DEL_REGISTRO],
        // Seconda lettura della PR #59, S1: in arrivo allora, per il registro di allora; dal 12/10/2026 il CRM non lo è più.
        'che cosa mostrava Registrati' => ['Registrati, in zr-home, leggeva `presto` e mostrava «Disponibile» due moduli che il registro dava allora in arrivo, CRM e Bookings (fino alla `v1.15.0`)', PASSO_DEL_REGISTRO],
        'che cosa si legge' => ['Chi non ha una sessione legge `in_arrivo`', PASSO_DEL_REGISTRO],
        'quali sono in arrivo oggi' => ['dalla `v1.16.0` il CRM non lo è più (dal 12/10/2026 è per tutti), e lo restano Bookings e Finanze e i tre «Presto»', PASSO_DEL_REGISTRO],
    ];
}

it('`MODULO-NUOVO.md` dice che dalla v1.16.0 il CRM non è più in arrivo, e nel passo del registro racconta l\'errore pagato: Registrati leggeva `presto` (sprint 26 · T8.4; ogni frase nel suo passo: sprint 27 · T5.5)', function (string $frase, string $passo) {
    $guida = (string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md');

    expect(str_contains(suUnaRiga(passoDellaGuida($guida, $passo)), $frase))->toBe(true);
})->with(frasiDellaGuidaSuInArrivo());

// Sprint 27 · T5.5 (seconda lettura della PR #59, S4). Il titolo del caso qui sopra dice «nel passo del registro», e le frasi
// si cercavano in tutta la guida: con l'errore pagato spostato sotto un altro passo restava verde. Ogni frase si cerca nel suo
// passo, e lo dice questo caso: col capoverso dell'errore sotto il passo 9, nel passo 8 le sue frasi non si trovano più.

it('le frasi dell\'errore pagato del registro si cercano nel solo passo 8 della guida: col capoverso spostato sotto il passo 9 la guida le ha ancora, e nel passo 8 non si trovano più; un passo va dal suo titolo al titolo dopo, e uno che la guida non ha è vuoto (sprint 27 · T5.5)', function () {
    $guida = (string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md');
    $frasi = array_column(array_filter(frasiDellaGuidaSuInArrivo(), fn (array $riga): bool => $riga[1] === PASSO_DEL_REGISTRO), 0);
    preg_match('/^\*\*Errore già pagato\*\*: una pagina senza sessione (?:[^\n]+\n)+/m', $guida, $capoverso);
    $spostata = str_replace("\n## 9. La ricerca\n", "\n## 9. La ricerca\n\n".($capoverso[0] ?? ''), str_replace($capoverso[0] ?? '', '', $guida));
    $trovate = fn (string $testo): array => array_map(fn (string $frase): bool => str_contains($testo, $frase), $frasi);
    $nelPasso = fn (string $testo): string => suUnaRiga(passoDellaGuida($testo, PASSO_DEL_REGISTRO));

    expect(count($frasi))->toBe(4)
        ->and($trovate($nelPasso($guida)))->toBe([true, true, true, true])
        // Spostato, non tolto: la guida intera le ha ancora tutte.
        ->and($trovate(suUnaRiga($spostata)))->toBe([true, true, true, true])
        ->and($trovate($nelPasso($spostata)))->toBe([false, false, false, false])
        ->and(str_starts_with(passoDellaGuida($guida, PASSO_DEL_REGISTRO), PASSO_DEL_REGISTRO."\n"))->toBe(true)
        ->and(substr_count(passoDellaGuida($guida, PASSO_DEL_REGISTRO), "\n## "))->toBe(0)
        ->and(passoDellaGuida($guida, '## 8. Un passo che la guida non ha'))->toBe('');
});

// Sprint 27 · T5.4 (seconda lettura della PR #59, S3). README e guida elencano chi è in arrivo — «Bookings è in arrivo e non è
// «Presto»», «in arrivo restano Bookings e i tre «Presto»», «e lo restano Bookings e i tre «Presto»» —, e i casi qui sopra
// fissano quelle parole senza guardare il registro: il giorno che un prodotto esce per tutti le frasi diventano false e i casi
// restano verdi. Questo controllo ricava i due elenchi dal registro e li cerca nelle tre frasi, là dove sono scritte.

/**
 * Che cosa, nel README e nella guida, non dice chi è in arrivo com'è nel registro dato: niente se le tre frasi tornano. Dal
 * registro: i prodotti in arrivo che non sono «Presto», col nome italiano (quello delle lingue), e quanti sono i «Presto». Dal
 * capoverso del README sui due sì o no e dal passo 8 della guida: le tre frasi che li elencano, i nomi divisi da virgole e da
 * « e », il numero in lettere. Una frase che manca, che nomina altri prodotti o che ne conta altri è un difetto, e dice che
 * cosa dà il registro. Lettura della PR #60, R4: se nel registro nessun prodotto è in arrivo senza essere «Presto», la frase
 * che li nomina non deve esserci, e le altre due contano i soli «Presto» («in arrivo restano i tre «Presto»»).
 *
 * @param  list<array<string, mixed>>  $registro
 * @return list<string>
 */
function difettiDiChiEInArrivo(array $registro, string $readme, string $guida): array
{
    $nomi = json_decode(File::get(__DIR__.'/../../resources/lingue/it.json'), true, flags: JSON_THROW_ON_ERROR);
    $inOrdine = function (array $elenco): array {
        sort($elenco);

        return $elenco;
    };
    $inArrivo = array_values(array_map(
        fn (array $voce): string => $nomi[$voce['id']],
        array_filter($registro, fn (array $voce): bool => $voce['in_arrivo'] && ! $voce['presto']),
    ));
    $presto = count(array_filter($registro, fn (array $voce): bool => $voce['presto']));
    $delRegistro = 'in arrivo e non «Presto»: '.($inArrivo === [] ? 'nessuno' : implode(', ', $inArrivo))."; «Presto»: {$presto}";
    $inLettere = ['due' => 2, 'tre' => 3, 'quattro' => 4, 'cinque' => 5, 'sei' => 6];
    $capoverso = paragrafoDeiDueSiONo($readme);
    $frasi = [
        'README, «in arrivo e non «Presto»»' => [$capoverso, '/non `presto`: (?<nomi>[^.;]+?) (?:è|sono) in arrivo e non (?:è|sono) «Presto»/u', null],
        'README, «in arrivo restano»' => [$capoverso, '/in arrivo restano (?<nomi>[^.;]+?) e i (?<presto>\pL+) «Presto»/u', '/in arrivo restano i (?<presto>\pL+) «Presto»/u'],
        'guida, «e lo restano»' => [suUnaRiga(passoDellaGuida($guida, PASSO_DEL_REGISTRO)), '/e lo restano (?<nomi>[^.;]+?) e i (?<presto>\pL+) «Presto»/u', '/e lo restano i (?<presto>\pL+) «Presto»/u'],
    ];

    $difetti = [];
    foreach ($frasi as $dove => [$testo, $forma, $senzaNomi]) {
        if ($inArrivo === []) {
            // Nessuno in arrivo che non sia «Presto»: la frase che li nomina non c'è, e le altre due contano i soli «Presto».
            $torna = $senzaNomi === null
                ? preg_match($forma, $testo) !== 1
                : preg_match($senzaNomi, $testo, $detto) === 1 && ($inLettere[$detto['presto']] ?? null) === $presto;
        } else {
            $torna = preg_match($forma, $testo, $detto) === 1
                && $inOrdine(preg_split('/, | e /u', $detto['nomi']) ?: []) === $inOrdine($inArrivo)
                && (! isset($detto['presto']) || ($inLettere[$detto['presto']] ?? null) === $presto);
        }
        if (! $torna) {
            $difetti[] = "{$dove}: non dice ciò che dà il registro ({$delRegistro})";
        }
    }

    return $difetti;
}

it('README e guida dicono chi è in arrivo com\'è nel registro: i prodotti in arrivo che non sono «Presto», per nome, e quanti sono i «Presto» si ricavano dal registro e si cercano nelle tre frasi che li elencano; col primo di loro uscito per tutti le tre frasi non tornano più, e con un «Presto» in meno non tornano le due che li contano (sprint 27 · T5.4)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $guida = (string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md');
    $registro = registroDeiProdotti();
    // Il registro del pacchetto col primo prodotto in arrivo che non è «Presto» uscito per tutti (oggi Bookings)…
    $uscito = array_column(array_filter($registro, fn (array $voce): bool => $voce['in_arrivo'] && ! $voce['presto']), 'id')[0] ?? null;
    $conUnoUscito = array_map(fn (array $voce): array => $voce['id'] === $uscito ? [...$voce, 'in_arrivo' => false] : $voce, $registro);
    // … e senza il primo dei «Presto» (oggi Report): gli altri prodotti restano com'erano.
    $tolto = array_column(array_filter($registro, fn (array $voce): bool => $voce['presto']), 'id')[0] ?? null;
    $conUnPrestoInMeno = array_values(array_filter($registro, fn (array $voce): bool => $voce['id'] !== $tolto));
    // Ciò che il controllo dice di un registro, ricavato da quel registro: i nomi italiani di chi è in arrivo e non è «Presto», e
    // quanti sono i «Presto». Niente nomi né numeri fissati qui (lettura della PR #60, R4).
    $nomi = json_decode(File::get(__DIR__.'/../../resources/lingue/it.json'), true, flags: JSON_THROW_ON_ERROR);
    $nonDice = function (string $dove, array $voci) use ($nomi): string {
        $inArrivo = array_values(array_map(fn (array $voce): string => $nomi[$voce['id']], array_filter($voci, fn (array $voce): bool => $voce['in_arrivo'] && ! $voce['presto'])));
        $presto = count(array_filter($voci, fn (array $voce): bool => $voce['presto']));

        return "{$dove}: non dice ciò che dà il registro (in arrivo e non «Presto»: ".($inArrivo === [] ? 'nessuno' : implode(', ', $inArrivo))."; «Presto»: {$presto})";
    };

    // Prima i documenti col registro di oggi: se non tornano, il rosso dice quale frase. I due registri di prova valgono finché
    // nel registro un prodotto è in arrivo senza essere «Presto» e uno è «Presto»: chi sono, non conta.
    expect(difettiDiChiEInArrivo($registro, $readme, $guida))->toBe([])
        // Sprint 28 · T5.5 (seconda lettura della PR #60, residuo di R4): il giorno che l'ultimo esce, il rosso dice che cosa fare.
        ->and($uscito !== null && $tolto !== null)->toBe(true, 'Nel registro non c\'è più un prodotto in arrivo che non sia «Presto», o non c\'è più un «Presto»: i due registri di prova di questo caso (uno uscito per tutti, un «Presto» in meno) non si ricavano più. README e guida sono a posto, lo dice il controllo qui sopra: si riscrive questo caso, e con lui quello dopo, che ricava i documenti «di quel giorno» da quelli di oggi.')
        ->and(difettiDiChiEInArrivo($conUnoUscito, $readme, $guida))->toBe([
            $nonDice('README, «in arrivo e non «Presto»»', $conUnoUscito),
            $nonDice('README, «in arrivo restano»', $conUnoUscito),
            $nonDice('guida, «e lo restano»', $conUnoUscito),
        ])
        ->and(difettiDiChiEInArrivo($conUnPrestoInMeno, $readme, $guida))->toBe([
            $nonDice('README, «in arrivo restano»', $conUnPrestoInMeno),
            $nonDice('guida, «e lo restano»', $conUnPrestoInMeno),
        ]);
});

// Lettura della PR #60, R4. Il giorno che l'ultimo prodotto in arrivo esce per tutti, README e guida devono poterlo dire: la
// frase che li nomina non c'è più, e le altre due contano i soli «Presto». Il controllo conosce anche quella forma: prima, con
// un registro così, le tre frasi non si potevano più scrivere in un modo che tornasse.
it('README e guida possono dire che nessun prodotto è in arrivo senza essere «Presto»: con un registro così il controllo accetta i documenti senza la frase che li nomina e con le due che contano i soli «Presto», e non quelli di oggi; col registro di oggi non accetta quei documenti (lettura della PR #60, R4)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $guida = (string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md');
    $senzaNessuno = array_map(fn (array $voce): array => $voce['presto'] ? $voce : [...$voce, 'in_arrivo' => false], registroDeiProdotti());
    // I documenti di quel giorno, ricavati da quelli di oggi: le tre frasi, senza i nomi.
    $readmeDiQuelGiorno = (string) preg_replace(
        ['/non\s+`presto`:\s+[^.;]+?\s+(?:è|sono)\s+in\s+arrivo\s+e\s+non\s+(?:è|sono)\s+«Presto»/u', '/in\s+arrivo\s+restano\s+[^.;]+?\s+e\s+i\s+(\pL+)\s+«Presto»/u'],
        ['non `presto`: oggi nessuno', 'in arrivo restano i $1 «Presto»'],
        $readme,
        -1,
        $nelReadme,
    );
    $guidaDiQuelGiorno = (string) preg_replace('/e\s+lo\s+restano\s+[^.;]+?\s+e\s+i\s+(\pL+)\s+«Presto»/u', 'e lo restano i $1 «Presto»', $guida, -1, $nellaGuida);

    // Sprint 28 · T5.5 (residuo di R4): quel giorno i documenti sono già nella forma «nessuno», e qui non c'è più niente da sostituire.
    expect([$nelReadme, $nellaGuida])->toBe([2, 1], 'README e guida non hanno più le tre frasi che nominano chi è in arrivo senza essere «Presto» (due nel README, una nella guida): se nel registro non ce n\'è più nessuno i documenti sono già quelli «di quel giorno», e questo caso si riscrive partendo da loro. Le frasi coi nomi non si rimettono.')
        ->and(difettiDiChiEInArrivo($senzaNessuno, $readmeDiQuelGiorno, $guidaDiQuelGiorno))->toBe([])
        ->and(count(difettiDiChiEInArrivo($senzaNessuno, $readme, $guida)))->toBe(3)
        ->and(count(difettiDiChiEInArrivo(registroDeiProdotti(), $readmeDiQuelGiorno, $guidaDiQuelGiorno)))->toBe(3);
});

it('la guida non dice più che il passo del registro non ha un errore pagato, e le due forme scritte dell\'anteprima del CRM non stanno in `tests/`, nel README e nella guida (sprint 26 · T8.4; il titolo: sprint 27 · T5.5)', function () {
    // Le due frasi sono spezzate: intere, questo file le troverebbe in sé stesso.
    $inAnteprima = ['il CRM in '.'anteprima', 'in anteprima '.'(il CRM)'];
    $file = [...(glob(__DIR__.'/*.php') ?: []), ...(glob(__DIR__.'/../*.php') ?: []), __DIR__.'/../../README.md', __DIR__.'/../../MODULO-NUOVO.md'];
    $trovate = [];
    foreach ($file as $percorso) {
        $testo = commentiSuUnaRiga((string) file_get_contents($percorso));
        foreach ($inAnteprima as $frase) {
            if (str_contains($testo, $frase)) {
                $trovate[] = basename($percorso).': '.$frase;
            }
        }
    }

    expect(in_array(__DIR__.'/RegistroTest.php', $file, true))->toBe(true)
        ->and($trovate)->toBe([])
        ->and(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md')), '**Errore già pagato**: nessuno (per zr-board e zr-crm è andata liscia)'))->toBe(false);
});

// Sprint 17 · T4 (voce #1633): ogni workspace dei dati porta il suo `id`, e dall'id la cornice ricava il colore del suo pallino
// nel selettore. Il README lo dice dove chi legge lo cerca: la forma dei dati in «La parte server», da dove viene il colore nel
// punto del selettore di «La cornice», e la regola per chi mostra un workspace fuori dalla cornice in un capoverso suo.

it('il README dice, in «La parte server», la forma dei dati con l\'id di ogni workspace, da dove viene l\'id e che non costa una lettura in più (sprint 17 · T4.5)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    // Con «La parte server» e «La cornice» scambiate la frase c'è ancora, ma non dove si legge di Cornice::dati().
    $scambiate = conParteServerECorniceScambiate($readme);

    expect(str_contains(sezioneDelReadme($readme, 'La parte server'), $frase))->toBe(true)
        ->and(str_contains(suUnaRiga($scambiate), $frase))->toBe(true)
        ->and(str_contains(sezioneDelReadme($scambiate, 'La parte server'), $frase))->toBe(false);
})->with([
    'la forma dei dati' => ['aziende: [{id, nome, workspace: [{id, nome, slug}], nuovo_workspace}], non_lette, aggiornati_il}`'],
    'l\'id è quello di io.workspace.elenca' => ['Ogni workspace porta il suo `id`, quello di `io.workspace.elenca`'],
    'nessuna lettura in più' => ['sta nella riga che `Cornice::dati()` legge già, e non costa una lettura in più'],
    'dall\'id viene il colore' => ['È dall\'`id` che la cornice ricava il colore del workspace nel selettore'],
    // Review della PR #20: da quale versione c'è (A4); un backoffice finto scritto a mano nei test di un frontend lo deve dare
    // (R6); il workspace in cui la persona è entrata non lo porta, e dove lo si trova (R7).
    'da quale versione (sprint 17 · review, A4)' => ['L\'`id` c\'è dalla `v1.7.0`'],
    'un finto scritto a mano lo deve dare (sprint 17 · review, R6)' => ['nei test di un frontend un backoffice finto scritto a mano lo deve dare come dà `nome` e `slug`'],
    'senza, la lettura fallisce (sprint 17 · review, R6)' => ['una riga senza `id` fa fallire `Cornice::dati()`'],
    'il workspace della persona resta nome e slug (sprint 17 · review, R7)' => ['Il workspace in cui la persona è entrata (`workspace`) resta `{nome, slug}`'],
    'il suo id si trova in aziende (sprint 17 · review, R7)' => ['il suo `id` è quello del workspace con lo stesso `slug` in `aziende`'],
    // Seconda lettura della PR #20: chi dà già l'`id` (N1), quale riga senza `id` fa fallire la lettura (N3), e che l'`id` del
    // workspace in cui la persona è entrata può non esserci (N2).
    'chi lo dà già (sprint 17 · review, N1)' => ['il `BackofficeFinto` di zr-auth e l\'esempio di `io.workspace.elenca` nel contratto lo danno'],
    'quale riga fa fallire la lettura (sprint 17 · review, N3)' => ['una riga senza `id` fa fallire `Cornice::dati()`, se è di un\'azienda dell\'elenco (le altre restano fuori prima)'],
    'il suo id può non esserci (sprint 17 · review, N2)' => ['con lo stesso `slug` in `aziende`, se c\'è'],
    'quando non c\'è (sprint 17 · review, N2)' => ['e allora nei dati il suo `id` non c\'è'],
]);

it('il README non dice più che l\'id lo danno «gli esempi di zr-auth»: zr-auth ha un backoffice finto, e gli esempi sono del contratto (sprint 17 · review, N1)', function () {
    expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')), 'gli esempi di zr-auth'))->toBe(false);
});

it('il README dice, nel punto del selettore di «La cornice», da dove viene il colore di un workspace — dall\'id, non si sceglie, lo stesso ovunque — e che nel tipo l\'id è facoltativo (sprint 17 · T4.5)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $selettore = 'Il selettore «Azienda › workspace»';
    // Il README col punto del selettore e quello della campanella scambiati di nome: la frase c'è, ma dove si legge della campanella.
    $scambiati = strtr($readme, ["- **{$selettore}**" => '- **La campanella**', '- **La campanella**' => "- **{$selettore}**"]);

    expect(str_contains(puntoDellaCornice($readme, $selettore), $frase))->toBe(true)
        ->and(substr_count($readme, "- **{$selettore}**"))->toBe(1)
        ->and(substr_count($readme, '- **La campanella**'))->toBe(1)
        ->and(str_contains(suUnaRiga($scambiati), $frase))->toBe(true)
        ->and(str_contains(puntoDellaCornice($scambiati, $selettore), $frase))->toBe(false);
})->with([
    'ogni workspace ha il suo colore' => ['Ogni workspace ha il pallino del suo colore'],
    'lo decide zr-core dall\'id' => ['lo decide zr-core dall\'`id` del workspace, con una regola sola'],
    'non si sceglie' => ['con una regola sola, e non si sceglie'],
    'lo stesso ovunque' => ['Lo stesso workspace ha lo stesso colore in ogni prodotto, per ogni persona e a ogni visita'],
    'nome, slug e posto non contano' => ['cambiargli nome, slug o posto nell\'elenco non glielo cambia'],
    'nel tipo l\'id è facoltativo' => ['Nel tipo `DatiDellaCornice` l\'`id` di un workspace è facoltativo'],
    'senza id il pallino del design system' => ['un workspace senza `id` non ha un colore suo, e il suo pallino è quello che il design system mette da sé'],
    // Review della PR #20, R8: «il suo colore» non vuol dire un colore diverso da quello di ogni altro.
    'i colori si ripetono (sprint 17 · review, R8)' => ['quindi due workspace possono avere lo stesso'],
    'a che cosa serve il colore (sprint 17 · review, R8)' => ['il colore aiuta a riconoscere un workspace, non lo distingue da tutti gli altri'],
]);

/** Il capoverso del README sul colore di un workspace fuori dalla cornice, su una riga sola: fino alla riga vuota. Vuoto se non c'è. */
function paragrafoDelTonoDelWorkspace(string $readme): string
{
    preg_match('/^Il colore di un workspace fuori dalla cornice .*?(?=^$|\z)/ms', $readme, $paragrafo);

    return suUnaRiga($paragrafo[0] ?? '');
}

it('il README dice, subito dopo il capoverso del registro, la regola che dà il tono di un workspace a chi lo mostra fuori dalla cornice, una frase per cosa (sprint 17 · T4.5, T4.6)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    // Il README con quel capoverso sotto un altro inizio: la frase c'è ancora, ma non dove chi cerca il colore di un workspace la trova.
    $altrove = str_replace("\nIl colore di un workspace fuori dalla cornice ", "\nUn workspace mostrato altrove ", $readme);

    expect(str_contains(paragrafoDelTonoDelWorkspace($readme), $frase))->toBe(true)
        ->and(substr_count($readme, "\nIl colore di un workspace fuori dalla cornice "))->toBe(1)
        // Subito dopo il capoverso dei due sì o no del registro: fra i due c'è solo la riga vuota.
        ->and(preg_match('/^Ogni voce del registro porta due sì o no (?:[^\n]+\n)+\nIl colore di un workspace fuori dalla cornice /m', $readme))->toBe(1)
        ->and(str_contains(suUnaRiga($altrove), $frase))->toBe(true)
        ->and(paragrafoDelTonoDelWorkspace($altrove))->toBe('');
})->with([
    'nome e argomento, e da dove si importa' => ['lo dà `tonoDelWorkspace(id)`, dallo stesso ingresso'],
    'è la regola del selettore' => ['è la regola che usa il selettore della cornice, quindi per lo stesso `id` il tono è lo stesso'],
    // Review della PR #20: da quale versione (A4), dove sta l'id nei dati (R7), e che due workspace possono avere lo stesso tono (R8).
    'da quale versione (sprint 17 · review, A4)' => ['dallo stesso ingresso (dalla `v1.7.0`)'],
    'che cos\'è id' => ['`id` è l\'`id` del workspace, com\'è in ogni workspace di `aziende` nei dati della cornice'],
    'i toni si ripetono (sprint 17 · review, R8)' => ['Due workspace possono avere lo stesso tono'],
    'dà un tono del design system' => ['Dà il nome di uno dei toni che il design system ammette per un workspace'],
    'un nome, non un colore' => ['non un colore: il colore lo mette il CSS del design system (`var(--<tono>)`)'],
    'senza id nessun tono' => ['Un `id` vuoto, mancante o che non è un testo non ha tono, e la funzione dà `undefined`'],
]);

it('i toni che il README elenca per tonoDelWorkspace sono quelli che il design system ammette per un workspace, nello stesso ordine: tutti, e nessun altro (sprint 17 · T4.5)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $tipi = (string) file_get_contents(__DIR__.'/../../resources/zeiras/index.d.ts');
    /** I toni di un workspace per il design system: quelli di `Tone` senza `neutral`, com'è `ShellWorkspace.tone`. */
    $delDesignSystem = function (string $testo): array {
        preg_match('/^export type Tone = ([^;]+);$/m', $testo, $tone);
        preg_match_all("/'([a-z]+)'/", $tone[1] ?? '', $nomi);

        return array_values(array_diff($nomi[1], ['neutral']));
    };
    /** I toni fra parentesi nel capoverso del README, nell'ordine in cui stanno. */
    $delReadme = function (string $testo): array {
        preg_match('/ammette per un workspace \(((?:`[a-z]+`(?:, )?)+)\)/', paragrafoDelTonoDelWorkspace($testo), $elenco);
        preg_match_all('/`([a-z]+)`/', $elenco[1] ?? '', $nomi);

        return $nomi[1];
    };
    // Il design system con un tono in più, e il README con un tono in meno: in tutti e due i casi le due liste non coincidono.
    $conUnTonoInPiu = str_replace("| 'plum' |", "| 'plum' | 'ocean' |", $tipi);
    $senzaUnTono = str_replace('`sky`, ', '', $readme);

    expect(str_contains($tipi, "tone?: Exclude<Tone, 'neutral'> }\nexport interface ShellCompany"))->toBe(true)
        ->and($delDesignSystem($tipi))->not->toBe([])
        ->and($delReadme($readme))->toBe($delDesignSystem($tipi))
        ->and($delDesignSystem($conUnTonoInPiu))->toContain('ocean')
        ->and($delReadme($readme))->not->toBe($delDesignSystem($conUnTonoInPiu))
        ->and($delReadme($senzaUnTono))->not->toBe($delDesignSystem($tipi))
        ->and($delReadme($senzaUnTono))->not->toContain('sky');
});

// Sprint 74 · C5 (voce 2730 di zr-home). Il colore che un workspace ha scelto: il README lo dice subito dopo il capoverso del
// tono, e la parte server lo lascia passare solo se è uno dei toni che il design system ammette per un workspace, gli stessi
// di `tonoDelWorkspace`, nello stesso ordine.
it('il README dice, subito dopo il capoverso del tono, che il colore scelto vince sul tono dell\'id, dove sta nei dati e come lo scrive una pagina del frontend (voce 2730)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    preg_match('/^Il colore di un workspace fuori dalla cornice .*?\n\n(.*?)(?=^$|\z)/ms', $readme, $dopo);

    expect(str_contains(suUnaRiga($dopo[1] ?? ''), $frase))->toBe(true);
})->with([
    'da quale versione' => ['Dalla `v3.6.0` un workspace che ha scelto il suo colore'],
    'vince sull\'id' => ['ha nel selettore quel colore, non il tono del suo `id`'],
    'dove sta nei dati' => ['sta in ogni workspace di `aziende`, come `colore`, solo quando è uno dei cinque toni'],
    'neutral non arriva' => ['`neutral`, il colore di chi non ne ha scelto uno, non arriva, e allora vale la regola dell\'`id`'],
    'come lo scrive un frontend' => ['`workspace.colore ?? tonoDelWorkspace(workspace.id)`'],
]);

it('i colori di un workspace che la parte server lascia passare sono i toni che il design system ammette per un workspace, nello stesso ordine di tonoDelWorkspace (voce 2730)', function () {
    preg_match('/^export type Tone = ([^;]+);$/m', (string) file_get_contents(__DIR__.'/../../resources/zeiras/index.d.ts'), $tone);
    preg_match_all("/'([a-z]+)'/", $tone[1] ?? '', $nomi);
    preg_match('/^const toni = \\[([^\\]]+)\\] as const/m', (string) file_get_contents(__DIR__.'/../../resources/js/tono.ts'), $diTono);
    preg_match_all("/'([a-z]+)'/", $diTono[1] ?? '', $toni);

    expect((new ReflectionClassConstant(Cornice::class, 'TONI_DI_UN_WORKSPACE'))->getValue())
        ->toBe(array_values(array_diff($nomi[1], ['neutral'])))
        ->toBe($toni[1])
        ->not->toBe([]);
});

// Sprint 17 · review della PR #20, R1: i frontend compilano i sorgenti di zr-core dalla cartella del pacchetto col loro
// tsconfig, e lì non li possono correggere. Il `tsc` di zr-core guarda quindi anche ciò che un tsconfig più stretto del suo
// fermerebbe in quei sorgenti: una dichiarazione mai usata e un parametro mai usato.
it('il tsc di zr-core si ferma su una dichiarazione o su un parametro mai usati, come quello di un frontend col tsconfig più stretto (sprint 17 · review, R1)', function (string $opzione) {
    $tsconfig = json_decode((string) file_get_contents(__DIR__.'/../../tsconfig.json'), true, flags: JSON_THROW_ON_ERROR);

    expect($tsconfig['compilerOptions'][$opzione] ?? null)->toBe(true);
})->with([
    'una dichiarazione mai usata' => ['noUnusedLocals'],
    'un parametro mai usato' => ['noUnusedParameters'],
]);

// Sprint 19 · T1 (voce #1669): «Nuovo workspace» in fondo al selettore, per chi può crearne uno. Il README lo dice dove chi
// legge lo cerca: in «La parte server» la forma dei dati con `nuovo_workspace` e la regola che lo dà; nel punto del selettore
// di «La cornice» quando il pulsante c'è, che cosa apre, di chi è il dialogo, chi decide, e che un frontend non deve fare niente.

it('il README dice, in «La parte server», la forma dei dati con nuovo_workspace e la regola che lo dà: chi, da quale lettura, che cosa vale false, da quale versione (sprint 19 · T1.5)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    // Con «La parte server» e «La cornice» scambiate la frase c'è ancora, ma non dove si legge di Cornice::dati().
    $scambiate = conParteServerECorniceScambiate($readme);

    expect(str_contains(sezioneDelReadme($readme, 'La parte server'), $frase))->toBe(true)
        ->and(str_contains(suUnaRiga($scambiate), $frase))->toBe(true)
        ->and(str_contains(sezioneDelReadme($scambiate, 'La parte server'), $frase))->toBe(false);
})->with([
    'la forma dei dati' => ['aziende: [{id, nome, workspace: [{id, nome, slug}], nuovo_workspace}]'],
    'che cosa dice' => ['`nuovo_workspace` dice se la persona può creare un workspace in quell\'azienda'],
    'da quale versione' => ['in quell\'azienda, e c\'è dalla `v1.9.0`'],
    'da quale lettura' => ['in almeno una riga di `io.workspace.elenca` di quell\'azienda'],
    'chi' => ['il `ruolo` della persona è `proprietario` o `amministratore`'],
    'che cosa vale false' => ['in ogni altro caso è `false`: solo `membro`, un ruolo che zr-core non conosce, una riga senza `ruolo`, un\'azienda senza workspace'],
    'il ruolo non passa a un\'altra azienda' => ['Il `ruolo` in un\'azienda non vale per un\'altra'],
    'nessuna lettura in più' => ['per saperlo non parte nessuna lettura in più'],
    'al browser solo il booleano' => ['al browser arriva solo il booleano, mai il `ruolo`'],
]);

it('il README dice, nel punto del selettore di «La cornice», quando c\'è «Nuovo workspace», che cosa apre, di chi è il dialogo, chi decide, e che un frontend non deve fare niente (sprint 19 · T1.5)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $selettore = 'Il selettore «Azienda › workspace»';
    // Il README col punto del selettore e quello della campanella scambiati di nome: la frase c'è, ma dove si legge della campanella.
    $scambiati = strtr($readme, ["- **{$selettore}**" => '- **La campanella**', '- **La campanella**' => "- **{$selettore}**"]);

    expect(str_contains(puntoDellaCornice($readme, $selettore), $frase))->toBe(true)
        ->and(substr_count($readme, "- **{$selettore}**"))->toBe(1)
        ->and(substr_count($readme, '- **La campanella**'))->toBe(1)
        ->and(str_contains(suUnaRiga($scambiati), $frase))->toBe(true)
        ->and(str_contains(puntoDellaCornice($scambiati, $selettore), $frase))->toBe(false);
})->with([
    'quando c\'è' => ['In fondo al selettore c\'è «Nuovo workspace» quando `nuovo_workspace` è `true` nell\'azienda del workspace dei dati'],
    'da quale versione' => ['nell\'azienda del workspace dei dati (dalla `v1.9.0`)'],
    'che cosa apre' => ['apre `https://app.zeiras.com/w/<slug>/nuovo-workspace`'],
    'con quale slug' => ['con lo slug del workspace dei dati'],
    'da ogni prodotto' => ['è una pagina di app.zeiras.com da ogni prodotto'],
    'il dialogo è di zr-home' => ['Il dialogo è di zr-home'],
    'chi decide è il backoffice' => ['se la persona può davvero lo decide il backoffice (`io.workspace.crea`)'],
    'un frontend non deve fare niente' => ['Un frontend non deve fare niente per averlo'],
]);

it('il README non dice più che «Nuovo workspace» non c\'è finché zr-home non ha la sua pagina (sprint 19 · T1.5)', function () {
    expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')), 'non c\'è finché zr-home non ha la sua pagina'))->toBe(false);
});

it('sulla pagina di prova del layout la persona può creare un workspace nell\'azienda dei dati, prima e dopo il cambio di nome del workspace (sprint 19 · T1.6)', function () {
    $puo = "slug: 'uat-marketing' }], nuovo_workspace: true }],";

    expect(scritteNellaPaginaDiProva('layout.tsx', [$puo, 'nuovo_workspace']))->toBe([$puo => 2, 'nuovo_workspace' => 2]);
});

// Sprint 19 · T2 (voce #1652): un frontend compila i sorgenti di zr-core col proprio tsconfig, e lì non li può correggere. Se
// accende un'opzione di `tsc` più stretta di `strict` non deve fermarsi sui file del pacchetto: `tsconfig.stretto.json` accende
// le nove opzioni sui sorgenti che si installano e sulle pagine di prova, che usano la cornice come un frontend; la CI lo lancia
// a ogni giro, nel passo dei tipi; il README dice quali sono, e che cosa accetta `undefined`.

/**
 * Le nove opzioni di `tsc` più strette di `strict` che i sorgenti del pacchetto reggono, nell'ordine del file stretto.
 *
 * @return list<string>
 */
function opzioniStretteDiTsc(): array
{
    return [
        'noUncheckedIndexedAccess', 'exactOptionalPropertyTypes', 'noImplicitReturns', 'noFallthroughCasesInSwitch', 'noImplicitOverride',
        'noPropertyAccessFromIndexSignature', 'verbatimModuleSyntax', 'erasableSyntaxOnly', 'noUncheckedSideEffectImports',
    ];
}

/** Il punto «I tipi» di «Come si installa in un frontend», su una riga sola: fino alla riga vuota. Vuoto se non c'è, o se sta sotto un altro titolo. */
function puntoDeiTipi(string $readme): string
{
    preg_match('/^## Come si installa in un frontend$(.*?)(?=^## |\z)/ms', $readme, $sezione);
    preg_match('/^\*\*I tipi\*\*.*?(?=^$|\z)/ms', $sezione[1] ?? '', $punto);

    return suUnaRiga($punto[0] ?? '');
}

it('il file stretto di tsc accende le nove opzioni e nient\'altro, su ciò che guarda il tsc di base tolti i file di test, e non entra nello zip (sprint 19 · T2.1, T2.2)', function () {
    $stretto = json_decode((string) file_get_contents(__DIR__.'/../../tsconfig.stretto.json'), true, flags: JSON_THROW_ON_ERROR);
    $base = json_decode((string) file_get_contents(__DIR__.'/../../tsconfig.json'), true, flags: JSON_THROW_ON_ERROR);

    // Né `include` né `files`: guarda ciò che guarda il file di base, cioè i sorgenti che si installano e le pagine di prova. I
    // file di test no: un loro errore fermerebbe il giro per file che non si installano.
    expect($stretto)->toBe([
        'extends' => './tsconfig.json',
        'compilerOptions' => array_fill_keys(opzioniStretteDiTsc(), true),
        'exclude' => ['resources/**/*.test.ts', 'resources/**/*.test.tsx'],
    ])
        ->and($base['include'])->toBe(['resources/js/**/*.ts', 'resources/js/**/*.tsx', 'resources/demo/**/*.ts', 'resources/demo/**/*.tsx'])
        ->and(array_values(array_intersect(opzioniStretteDiTsc(), array_keys($base['compilerOptions']))))->toBe([])
        ->and(preg_match('/^\/tsconfig\.stretto\.json\s+export-ignore$/m', (string) file_get_contents(__DIR__.'/../../.gitattributes')))->toBe(1);
});

it('la CI lancia il tsc stretto nel passo dei tipi, a ogni giro: una volta, dopo il tsc di base e prima di vitest (sprint 19 · T2.2)', function () {
    $ci = (string) file_get_contents(__DIR__.'/../../.github/workflows/ci.yml');
    // Il passo: dal suo nome a quello del passo dopo.
    preg_match('/^      - name: Dipendenze JS, tipi.*?(?=^      - name: |\z)/ms', $ci, $passo);

    expect(substr_count($ci, 'npx tsc --noEmit -p tsconfig.stretto.json'))->toBe(1)
        ->and(str_contains($passo[0] ?? '', "          npx tsc --noEmit\n          npx tsc --noEmit -p tsconfig.stretto.json\n          npx vitest run\n"))->toBe(true)
        // Nessuna condizione sul passo, e un suo errore ferma il giro: vale in ogni giro della matrice. Senza `shell:` il passo
        // gira con `bash -e`, come lo lancia il caso qui sotto.
        ->and(preg_match('/^\s+(if|continue-on-error|shell):/m', $passo[0] ?? ''))->toBe(0)
        ->and(substr_count($ci, 'continue-on-error'))->toBe(0)
        // Né una shell di partenza per tutto il workflow o per il job, che potrebbe non avere `-e` (review, N2).
        ->and(substr_count($ci, 'defaults:'))->toBe(0);
});

/**
 * Lo script del passo dei tipi di ci.yml, cioè il suo blocco `run: |` senza il rientro: vuoto se il passo o il blocco non ci sono.
 */
function passoDeiTipi(string $ci): string
{
    if (preg_match('/^ {6}- name: Dipendenze JS, tipi.*\n(?: {8}.*\n)*? {8}run: \|\n((?:(?: {10}.*)?\n)+)/m', $ci, $passo) !== 1) {
        return '';
    }

    return trim((string) preg_replace('/^ {10}/m', '', $passo[1]))."\n";
}

/**
 * Il passo dei tipi lanciato come lo lancia la CI (un passo senza `shell:` gira con `bash -e`), in una cartella vuota con un
 * `npm` e un `npx` finti: scrivono ciò che gli si chiede e, se è il comando che deve fallire, escono con 1.
 *
 * @return array{0: int|null, 1: list<string>} il codice d'uscita e i comandi lanciati, nell'ordine
 */
function passoDeiTipiCon(?string $cheFallisce): array
{
    $prova = sys_get_temp_dir().'/zr-core-passo-'.bin2hex(random_bytes(8));
    mkdir($prova.'/bin', 0700, true);

    try {
        file_put_contents($prova.'/passo.sh', passoDeiTipi((string) file_get_contents(dirname(__DIR__, 2).'/.github/workflows/ci.yml')));
        foreach (['npm', 'npx'] as $comando) {
            file_put_contents($prova.'/bin/'.$comando, <<<BASH
                #!/usr/bin/env bash
                printf '%s\n' "{$comando} \$*" >>chiesto
                if [ "{$comando} \$*" = "\$FALLISCE" ]; then exit 1; fi

                BASH);
            chmod($prova.'/bin/'.$comando, 0700);
        }

        $passo = new Process(['bash', '--noprofile', '--norc', '-e', 'passo.sh'], $prova, ['PATH' => $prova.'/bin:'.getenv('PATH'), 'FALLISCE' => $cheFallisce ?? '']);
        $passo->run();

        return [$passo->getExitCode(), is_file($prova.'/chiesto') ? explode("\n", trim((string) file_get_contents($prova.'/chiesto'))) : []];
    } finally {
        (new Filesystem)->deleteDirectory($prova);
    }
}

// Review della PR #23, R6: che il passo fermi il giro non si legge in ci.yml, si prova lanciando il suo `run:`. Con un comando
// che fallisce il passo esce con 1 e quelli dopo non partono: un `tsc` stretto rosso non arriva a vitest, e meno ancora a Pest.
it('il passo dei tipi, lanciato: lancia i suoi comandi in quest\'ordine, e si ferma al primo che fallisce (sprint 19 · review, R6)', function (?string $cheFallisce, int $uscita, array $lanciati) {
    expect(passoDeiTipiCon($cheFallisce))->toBe([$uscita, $lanciati]);
})->with([
    'tutto riesce' => [null, 0, ['npm ci', 'npx tsc --noEmit', 'npx tsc --noEmit -p tsconfig.stretto.json', 'npx vitest run', 'npm run build', 'npm run demo']],
    'il tsc stretto fallisce' => ['npx tsc --noEmit -p tsconfig.stretto.json', 1, ['npm ci', 'npx tsc --noEmit', 'npx tsc --noEmit -p tsconfig.stretto.json']],
    'il tsc di base fallisce' => ['npx tsc --noEmit', 1, ['npm ci', 'npx tsc --noEmit']],
    'vitest fallisce' => ['npx vitest run', 1, ['npm ci', 'npx tsc --noEmit', 'npx tsc --noEmit -p tsconfig.stretto.json', 'npx vitest run']],
]);

it('le opzioni di tsc che il README elenca in «I tipi» sono quelle che il file stretto accende, nello stesso ordine: tutte, e nessun\'altra (sprint 19 · T2.5)', function () {
    $stretto = json_decode((string) file_get_contents(__DIR__.'/../../tsconfig.stretto.json'), true, flags: JSON_THROW_ON_ERROR);
    // L'elenco: dai due punti dopo «le nove opzioni» al primo punto fermo.
    preg_match('/le nove opzioni[^:]*: (.*?)\.(?= |$)/', puntoDeiTipi((string) file_get_contents(__DIR__.'/../../README.md')), $elenco);
    preg_match_all('/`([^`]+)`/', $elenco[1] ?? '', $nomi);

    expect($nomi[1])->toBe(array_keys($stretto['compilerOptions']))
        ->and($nomi[1])->toHaveCount(9);
});

it('il README dice, in «I tipi», una frase per cosa: con quali opzioni reggono i sorgenti, che un frontend le può accendere, che cosa accetta undefined e che cosa no (sprint 19 · T2.5)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');

    expect(str_contains(puntoDeiTipi($readme), $frase))->toBe(true)
        ->and(substr_count($readme, "\n**I tipi**"))->toBe(1);
})->with([
    'chi li compila' => ['il frontend li compila col proprio `tsconfig`'],
    'le opzioni di base' => ['Reggono `strict`, `noUnusedLocals` e `noUnusedParameters`'],
    'da quale versione le nove' => ['dalla `v1.9.0`, le nove opzioni più strette'],
    'chi le guarda' => ['che la CI di zr-core accende a ogni giro (il suo `tsconfig.stretto.json`, che nello zip non arriva)'],
    'un frontend le può accendere' => ['Un frontend le può accendere senza fermarsi sui file di zr-core'],
    'che cosa accetta undefined' => ['Con `exactOptionalPropertyTypes` ciò che il frontend dà alla cornice ed è facoltativo accetta `undefined`'],
    'le props facoltative' => ['le props facoltative di `Cornice` e di `LayoutDellaCornice` (`product={undefined}`)'],
    'le chiavi facoltative dei dati' => ['le chiavi facoltative dei dati della cornice (`aziende: undefined`)'],
    'i tipi del design system no' => ['I tipi del design system (`index.d.ts`) no: lì una chiave che non si dà si omette'],
    // Review della PR #23, R9: `tone` delle voci di `nav` lo dichiara zr-core, con la forma che vuole l'`AppShell`: non è «suo».
    'le voci hanno la forma del design system' => ['le voci di `nav`, di `crumbs` e di `create` hanno la sua forma'],
    // R1: anche le chiavi di `prodotti`, e quelle dentro un'azienda.
    'anche le chiavi dentro i dati' => ['anche quelle di `prodotti` e quelle dentro un\'azienda'],
    // R2: i sorgenti usano la libreria di ES2022 (`Array.prototype.at`).
    'con quale target' => ['Vogliono `target` ES2022 o più recente'],
    'con skipLibCheck' => ['La misura è con `skipLibCheck`, come nei `tsconfig` dei frontend'],
]);

// T2.3: le pagine di prova stanno nel file stretto e scrivono `undefined` in ogni prop facoltativa di `Cornice` e di
// `LayoutDellaCornice` e in ogni chiave facoltativa dei dati: se una non lo accetta, o se ne nasce una che lì manca, `tsc` si
// ferma sulla pagina di prova. Qui, che quelle righe ci sono e che la pagina le dà davvero alla cornice.
it('le pagine di prova scrivono undefined in ogni prop facoltativa della cornice e del layout e in ogni chiave facoltativa dei dati, e li danno alla cornice (sprint 19 · T2.3)', function (string $file, array $scritte) {
    expect(scritteNellaPaginaDiProva($file, $scritte))->toBe(array_fill_keys($scritte, 1));
})->with([
    'la pagina della cornice' => ['demo.tsx', [
        'type OgniFacoltativa<T> = Record<{ [K in keyof T]-?: {} extends Pick<T, K> ? K : never }[keyof T], undefined>;',
        '} satisfies OgniFacoltativa<CorniceProps> satisfies Partial<CorniceProps>;',
        '} satisfies OgniFacoltativa<DatiDellaCornice> satisfies Partial<DatiDellaCornice>;',
        '            {...propsScritteUndefined}',
        // Dalla review della PR #31 (R5) i dati si compongono una volta, in `useMemo`, e non a ogni disegno.
        'return { ...datiScrittiUndefined, ...datiDiProva, ',
        // Review della PR #23, R1 e R8: le chiavi facoltative dentro i dati — uno stato di `prodotti`, l'`id` di un workspace,
        // `nuovo_workspace` — le prova un valore scritto a mano, che qui non può sparire in silenzio.
        "prodotti: { pm: 'attivo', crm: 'disponibile', bookings: 'in_arrivo', reports: 'attivo', automations: undefined },",
        "workspace: [{ id: undefined, nome: 'UAT Ricerca', slug: 'uat-ricerca' }], nuovo_workspace: undefined }],",
    ]],
    'la pagina del layout' => ['layout.tsx', [
        'type OgniFacoltativa<T> = Record<{ [K in keyof T]-?: {} extends Pick<T, K> ? K : never }[keyof T], undefined>;',
        '} satisfies OgniFacoltativa<LayoutDellaCorniceProps> satisfies Partial<LayoutDellaCorniceProps>;',
        '            {...propsScritteUndefined}',
    ]],
]);

// Review della PR #23, R2: i sorgenti che si installano usano la libreria di ES2022, e il `tsc` di zr-core li guarda con quel
// `target`: un frontend con un `target` più basso si fermerebbe su un file che non può correggere. Il README lo dice.
it('il target che il README dice per i sorgenti è quello con cui li guarda il tsc di zr-core (sprint 19 · review, R2)', function () {
    $base = json_decode((string) file_get_contents(__DIR__.'/../../tsconfig.json'), true, flags: JSON_THROW_ON_ERROR);

    expect($base['compilerOptions']['target'] ?? null)->toBe('ES2022')
        ->and(str_contains(puntoDeiTipi((string) file_get_contents(__DIR__.'/../../README.md')), 'Vogliono `target` '.$base['compilerOptions']['target'].' o più recente'))->toBe(true);
});

// Sprint 20 · T1 (voce #1674): le notifiche dicono chi, su che cosa e per chi. Il README lo dice nel punto «Le notifiche» e nella
// riga della rotta, con la versione, e dice che finché il backoffice non manda i tre dati il pannello resta com'era.

it('il README dice, nel punto «Le notifiche», le tre regole dei dati nuovi, da quale versione valgono e che cosa succede finché il backoffice non li manda (sprint 20 · T1.7)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $scambiati = conNotificheERicercaScambiate($readme);

    expect(str_contains(puntoDelleNotifiche($readme), $frase))->toBe(true)
        ->and(str_contains(suUnaRiga($scambiati), $frase))->toBe(true)
        ->and(str_contains(puntoDelleNotifiche($scambiati), $frase))->toBe(false);
})->with([
    'la versione' => ['Dalla `v1.10.0` una notifica dice anche su che cosa, chi e per chi, quando il backoffice lo dice'],
    'la seconda riga' => ['con `risorsa_nome` ha una seconda riga, sotto il titolo, col nome della cosa'],
    'l\'avatar' => ['con `autore_nome` ha, al posto dell\'icona, l\'avatar con le iniziali di chi ha fatto'],
    'le due schede' => ['`per_me` dice la scheda: `true` in «Per me» e in «Tutte», `false` solo in «Tutte», `null` in tutte e due'],
    'null non è false' => ['`null` vuol dire che il backoffice non lo sa, non che la notifica è per altri'],
    'un nome vuoto' => ['Un nome vuoto o di soli spazi non si mostra'],
    'una notifica su un\'app (T1.8)' => ['Per una notifica su un\'app (un tipo che comincia con `com.zeiras.app.`) `risorsa_nome` è il codice dell\'app (`pm`), e la seconda riga porta il nome del prodotto, dal registro e nella lingua della persona («Project Management»), mai il codice'],
    'un codice che il registro non ha (T1.8)' => ['con un codice che il registro non ha la seconda riga non c\'è'],
    'finché il backoffice non li manda' => ['Finché il backoffice non manda i tre dati il pannello resta com\'era'],
    'per_me resta null' => ['anche dopo `per_me` è `null` finché il backoffice non conosce il destinatario diretto di una notifica'],
]);

it('il README non dice più che il backoffice non dice per chi è una notifica (sprint 20 · T1.7)', function () {
    expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')), 'il backoffice non dice per chi è una notifica'))->toBe(false);
});

it('il README dice, nella riga di GET /cornice/notifiche, i tre dati nuovi: da quale versione, da dove vengono, quando sono null, che di autore passa solo il nome e che un\'altra forma è un errore (sprint 20 · T1.7)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $elenco = '| `GET /cornice/notifiche` |';
    $ricerca = '| `POST /cornice/ricerca` con `{q}` |';
    $cosaDice = fn (string $testo): array => array_map(fn (string $frase) => str_contains(rigaDellaRotta($testo, 'GET /cornice/notifiche'), $frase), [
        'la versione e che cosa sono' => 'dalla `v1.10.0` `autore_nome` è il nome di chi ha fatto ciò che la notifica racconta, `risorsa_nome` quello della cosa a cui si riferisce',
        'il codice di un\'app (T1.8)' => 'per una notifica su un\'app è il codice dell\'app, com\'è nel backoffice: il nome da mostrare lo dà `risorsaDellaNotifica`',
        'per_me, e null che non è false' => '`per_me` dice se è rivolta alla persona (`true`), a tutto il workspace (`false`) o se il backoffice non lo sa (`null`, che non è `false`)',
        'quando sono null' => 'ognuna è `null` quando il backoffice dà `null` o non manda la chiave',
        'di autore solo il nome' => 'di `autore` passa solo il nome',
        'un\'altra forma è un errore' => 'una delle tre con una forma che il contratto non ammette',
        'mai tolta in silenzio' => 'mai una chiave tolta in silenzio',
    ]);
    $tutto = fn (bool $detto): array => array_fill_keys(['la versione e che cosa sono', 'il codice di un\'app (T1.8)', 'per_me, e null che non è false', 'quando sono null', 'di autore solo il nome', 'un\'altra forma è un errore', 'mai tolta in silenzio'], $detto);

    // Il README con la riga dell'elenco e quella della ricerca scambiate di rotta: ogni frase c'è, ma nella riga di un'altra rotta.
    expect($cosaDice($readme))->toBe($tutto(true))
        ->and($cosaDice(strtr($readme, [$elenco => $ricerca, $ricerca => $elenco])))->toBe($tutto(false));
});

it('la pagina di prova ha i tre casi delle notifiche con ?chi=1, più una notifica su un\'app col codice dell\'app, e senza resta com\'era: lo dicono il file delle rotte finte e la testa della pagina (sprint 20 · T1.7, T1.8)', function () {
    // Dallo sprint 21 ogni notifica d'esempio porta anche gli id che la parte server dà di `dati` (`ids`), in fondo.
    $conChiECosa = "...detti('Marta Rossi', 'UAT Scrivere il brief del lancio', true), ids: {";
    $perTutti = "...detti('Bruno Neri', null, false), ids: {";
    // La notifica su un'app c'è solo con `?chi=1`: senza, le notifiche d'esempio sono le quattro di prima.
    $suUnApp = "...(chi ? [{ id: 'uat-0', creata_il: fa(3 * 24 * 60), letta: true, app: null, tipo: 'com.zeiras.app.modificata', autore_nome: 'Marta Rossi', risorsa_nome: 'pm', per_me: null, ids: {} }] : []),";

    expect(scritteNellaPaginaDiProva('rotte-finte.ts', [$suUnApp, "tipo: 'com.zeiras.app."]))->toBe([$suUnApp => 1, "tipo: 'com.zeiras.app." => 1])
        ->and(scritteNellaPaginaDiProva('demo.tsx', ['una su un\'app, col nome del prodotto al posto del codice']))->toBe(['una su un\'app, col nome del prodotto al posto del codice' => 1]);

    expect(scritteNellaPaginaDiProva('rotte-finte.ts', [".has('chi');", $conChiECosa, $perTutti, '...nonDetti, ids: ', '(chi ? { autore_nome, risorsa_nome, per_me } : nonDetti);']))
        // Cinque dallo sprint 21 · T5: alle tre di prima si aggiungono le due righe delle aziende del CRM e delle viste di una board.
        // Sei dallo sprint 24 · T3: la scheda eliminata di `?schede=1`.
        ->toBe([".has('chi');" => 1, $conChiECosa => 1, $perTutti => 1, '...nonDetti, ids: ' => 6, '(chi ? { autore_nome, risorsa_nome, per_me } : nonDetti);' => 1])
        ->and(scritteNellaPaginaDiProva('demo.tsx', ['con `?chi=1` le notifiche dicono chi ha fatto, su che cosa']))->toBe(['con `?chi=1` le notifiche dicono chi ha fatto, su che cosa' => 1]);
});

// Sprint 20 · T2 (voce #1675). «Come nasce un modulo nuovo»: una guida nel pacchetto, per l'agente di un modulo che nasce.
// Sta nello zip del tag, perché chi installa legge quello; nomina solo ciò che nel pacchetto c'è; non porta indirizzi
// interni, e dove il README dice già una cosa rimanda al suo titolo.

/** La guida, com'è nel repo; un testo vuoto se non c'è. */
function guidaDelModuloNuovo(): string
{
    $file = dirname(__DIR__, 2).'/MODULO-NUOVO.md';

    return is_file($file) ? (string) file_get_contents($file) : '';
}

/** @return list<string> i file dello zip di HEAD: ciò che Composer dà a un frontend */
function fileDelloZipDiHead(): array
{
    $elenco = (new Process(['bash', '-c', 'set -o pipefail; git archive HEAD | tar -tf -'], dirname(__DIR__, 2)))->mustRun()->getOutput();

    return array_values(array_filter(explode("\n", $elenco), fn (string $riga): bool => $riga !== '' && ! str_ends_with($riga, '/')));
}

/** Il codice che si installa, in un testo solo: è lì che si cerca un nome. Il README e la guida no: un nome sta nel codice. */
function codiceCheSiInstalla(): string
{
    $radice = dirname(__DIR__, 2);
    $codice = '';
    foreach (fileDelloZipDiHead() as $file) {
        if (preg_match('/\.(php|ts|tsx|json|css)$/', $file) === 1) {
            $codice .= "\n".file_get_contents($radice.'/'.$file);
        }
    }

    return $codice;
}

/** Il codice di zr-auth installato: un nome che la guida dice suo si cerca lì. */
function codiceDiZrAuth(): string
{
    $codice = '';
    foreach (File::allFiles(dirname(__DIR__, 2).'/vendor/zeiras/zr-auth/src') as $file) {
        $codice .= "\n".$file->getContents();
    }

    return $codice;
}

/** @return list<string> «METODO /uri» di ogni rotta registrata, coi parametri ridotti a `{}` */
function rotteRegistrate(): array
{
    $rotte = [];
    foreach (Route::getRoutes()->getRoutes() as $rotta) {
        foreach ($rotta->methods() as $metodo) {
            $rotte[] = $metodo.' /'.preg_replace('/\{[^}]*\}/', '{}', ltrim($rotta->uri(), '/'));
        }
    }

    return $rotte;
}

/** @return list<string> ciò che un testo scrive fra accenti gravi su una riga, una volta l'uno; i blocchi di codice restano fuori */
function fraAccentiGravi(string $testo): array
{
    preg_match_all('/`([^`\n]+)`/', (string) preg_replace('/^```.*?^```$/ms', '', $testo), $trovati);

    return array_values(array_unique($trovati[1]));
}

/**
 * Ciò che una guida nomina e che non c'è dove dice. Un percorso sotto `vendor/zeiras/zr-core/` è un file del pacchetto, e
 * dev'essere nello zip (una cartella, col `/` in fondo, deve avere almeno un file); `METODO /cornice/…` è una rotta
 * registrata; una classe di `Zeiras\Core`, col suo metodo se lo nomina, esiste; `Cornice::metodo(` è un metodo della classe;
 * `--tag=…` è un'etichetta con cui zr-core pubblica qualcosa. Un nome da solo (`LayoutDellaCornice`, `in_arrivo`: con una
 * maiuscola o un trattino basso) e un `Classe::metodo` — anche con gli argomenti e con ciò che segue,
 * `Classe::metodo($x)['chiave']` — si cercano come parola intera nel codice che si installa, poi in quello di zr-auth; se
 * non sono lì devono essere fra quelli detti di altri (Laravel, Inertia, il browser, il frontend).
 *
 * @param  list<string>  $nelloZip
 * @param  list<string>  $rotte
 * @param  array<string, string>  $diAltri  il nome, e di chi è
 * @return list<string>
 */
function nominatiENonTrovati(string $guida, array $nelloZip, array $rotte, string $delPacchetto, string $diZrAuth, array $diAltri): array
{
    $mancano = [];
    $parola = fn (string $nome, string $dove): bool => preg_match('/(?<![A-Za-z0-9_])'.preg_quote($nome, '/').'(?![A-Za-z0-9_])/', $dove) === 1;
    $qualcunoLoHa = fn (string $nome): bool => $parola($nome, $delPacchetto) || $parola($nome, $diZrAuth);

    foreach (fraAccentiGravi($guida) as $scritto) {
        if (str_starts_with($scritto, 'vendor/zeiras/zr-core/')) {
            $percorso = substr($scritto, strlen('vendor/zeiras/zr-core/'));
            $presente = str_ends_with($percorso, '/')
                ? array_filter($nelloZip, fn (string $file): bool => str_starts_with($file, $percorso)) !== []
                : in_array($percorso, $nelloZip, true);
            if (! $presente) {
                $mancano[] = $scritto.': non è nello zip';
            }
        } elseif (preg_match('/^(GET|POST|PATCH|PUT|DELETE) (\/cornice\/\S*)$/', $scritto, $rotta) === 1) {
            if (! in_array($rotta[1].' '.preg_replace('/\{[^}]*\}/', '{}', $rotta[2]), $rotte, true)) {
                $mancano[] = $scritto.': non è una rotta';
            }
        } elseif (preg_match('/^([A-Z][A-Za-z0-9]*)::([A-Za-z_][A-Za-z0-9_]*)(?:\(.*)?$/', $scritto, $statico) === 1) {
            $suo = array_key_exists($statico[1].'::'.$statico[2], $diAltri)
                || ($parola($statico[1], $delPacchetto) && $parola('function '.$statico[2], $delPacchetto))
                || ($parola($statico[1], $diZrAuth) && $parola('function '.$statico[2], $diZrAuth));
            if (! $suo) {
                $mancano[] = $scritto.': nessuno ha questo metodo';
            }
        } elseif (preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $scritto) === 1 && preg_match('/[A-Z_]/', $scritto) === 1) {
            if (! $qualcunoLoHa($scritto) && ! array_key_exists($scritto, $diAltri)) {
                $mancano[] = $scritto.': nessuno ha questo nome';
            }
        }
    }

    preg_match_all('/Zeiras\\\\Core(?:\\\\[A-Za-z]+)+(?:::[A-Za-z]+)?/', $guida, $classi);
    foreach (array_unique($classi[0]) as $nome) {
        [$classe, $metodo] = array_pad(explode('::', $nome), 2, null);
        if (! class_exists($classe) && ! interface_exists($classe)) {
            $mancano[] = $nome.': la classe non c\'è';
        } elseif ($metodo !== null && ! method_exists($classe, $metodo)) {
            $mancano[] = $nome.': il metodo non c\'è';
        }
    }

    preg_match_all('/(?<![A-Za-z0-9_\\\\])Cornice::([A-Za-z_]+)\(/', $guida, $metodi);
    foreach (array_unique($metodi[1]) as $metodo) {
        if (! method_exists(Cornice::class, $metodo)) {
            $mancano[] = 'Cornice::'.$metodo.'(): il metodo non c\'è';
        }
    }

    preg_match_all('/--tag=([a-z0-9-]+)/', $guida, $etichette);
    foreach (array_unique($etichette[1]) as $etichetta) {
        if (ServiceProvider::pathsToPublish(ZrCoreServiceProvider::class, $etichetta) === []) {
            $mancano[] = '--tag='.$etichetta.': zr-core non pubblica niente con questa etichetta';
        }
    }

    return $mancano;
}

/**
 * I nomi che la guida scrive e che non sono né di zr-core né di zr-auth: il nome, e di chi è. Un nome nuovo entra qui solo
 * se la guida dice di chi è.
 *
 * @return array<string, string>
 */
function nomiDiAltriNellaGuida(): array
{
    return [
        'App::setLocale' => 'Laravel',
        'HandleInertiaRequests' => 'il middleware di Inertia nel frontend',
        'createInertiaApp' => 'Inertia',
        'activeElement' => 'il browser',
        'getBoundingClientRect' => 'il browser',
        'RiallineamentoDesignTest' => 'il test del frontend, col nome che gli dà zr-crm',
        'IntestazioniTest' => 'il test del frontend, col nome che gli dà zr-crm',
        'NelWorkspace' => 'il middleware del frontend sulle rotte del workspace, col nome che gli danno zr-board e zr-crm',
        'prependToPriorityList' => 'Laravel',
        'postJson' => 'Laravel, nei test',
        'Inertia::location' => 'Inertia, dal server',
        'Inertia::defer' => 'Inertia, dal server',
        'Inertia::clearHistory' => 'Inertia, dal server',
        'AppServiceProvider' => 'il provider del frontend, col nome che gli dà Laravel',
    ];
}

/**
 * Gli indirizzi che un file pubblico non deve portare: un indirizzo IP, un «utente@host», un percorso di una macchina
 * (`/home/…`, `~/…`, `/etc/…`), e ogni nome di dominio che non è di zeiras.com, dei font o di GitHub. Chi è ammesso sta
 * scritto qui: un nome interno non si scrive nemmeno per vietarlo.
 *
 * @return list<string>
 */
function indirizziNonAmmessiIn(string $testo): array
{
    $ammessi = ['zeiras.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'github.com'];
    $trovati = [];
    preg_match_all('/\b\d{1,3}(?:\.\d{1,3}){3}\b/', $testo, $ip);
    preg_match_all('/[A-Za-z0-9._-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/', $testo, $utenti);
    preg_match_all('/(?<![A-Za-z0-9._\/-])(?:\/home\/|~\/|\/etc\/|\/var\/|\/srv\/|\/root\/)\S*/', $testo, $percorsi);
    preg_match_all('/(?<![A-Za-z0-9_.@-])(?:[a-z0-9-]+\.)+(?:com|net|org|it|io|dev|app|cloud|internal|local|lan)(?![A-Za-z0-9_-])/', $testo, $domini);
    foreach ([...$ip[0], ...$utenti[0], ...$percorsi[0]] as $uno) {
        $trovati[] = $uno;
    }
    foreach ($domini[0] as $dominio) {
        if (! in_array($dominio, $ammessi, true) && ! str_ends_with($dominio, '.zeiras.com')) {
            $trovati[] = $dominio;
        }
    }

    return array_values(array_unique($trovati));
}

/** @return list<string> i titoli del README che un testo cita come «README, «Titolo»» e che il README non ha */
function titoliDelReadmeCheNonCiSono(string $testo, string $readme): array
{
    preg_match_all('/README, «([^»]+)»/', $testo, $citati);
    preg_match_all('/^#{2,3} (.+)$/m', $readme, $titoli);

    return array_values(array_diff(array_unique($citati[1]), $titoli[1]));
}

/** @return list<string> le righe di un testo, da 80 caratteri in su, che il README ha già uguali */
function righeRicopiateDalReadme(string $testo, string $readme): array
{
    $delReadme = array_map('trim', explode("\n", $readme));

    return array_values(array_filter(array_map('trim', explode("\n", $testo)), fn (string $riga): bool => mb_strlen($riga) >= 80 && in_array($riga, $delReadme, true)));
}

it('la guida è un file del pacchetto: la guardia dello zip la vuole nello zip del tag, e non ammette un file dal nome simile (sprint 20 · T2.1)', function (array $file, int $uscita, array $dice) {
    [$codice, $testo] = guardiaDelloZipSu(alberoFintoCon($file));

    expect($codice)->toBe($uscita)
        ->and($testo)->toContain(...$dice);
})->with([
    'con la guida alla radice' => [['MODULO-NUOVO.md' => "# Come nasce un modulo nuovo\n"], 0, ['tutti del pacchetto e nessuno che manca']],
    'con la guida, che .gitattributes toglie dallo zip' => [
        ['MODULO-NUOVO.md' => "# Come nasce un modulo nuovo\n", '.gitattributes' => file_get_contents(__DIR__.'/../../.gitattributes')."/MODULO-NUOVO.md export-ignore\n"],
        1, ['manca ciò che serve a chi installa', 'MODULO-NUOVO.md'],
    ],
    'con un file dal nome simile alla radice' => [['MODULO-NUOVO-2.md' => "# Un altro file\n"], 1, ['ciò che non serve a chi installa', 'MODULO-NUOVO-2.md']],
    'con la guida in una cartella' => [['guide/MODULO-NUOVO.md' => "# Come nasce un modulo nuovo\n"], 1, ['ciò che non serve a chi installa', 'guide/MODULO-NUOVO.md']],
]);

it('la guida c\'è, è nello zip di HEAD, e il README la indica nel primo capoverso di «Come si installa in un frontend» (sprint 20 · T2.1)', function () {
    preg_match('/^## Come si installa in un frontend\n\n(.+?)\n\n/ms', (string) file_get_contents(__DIR__.'/../../README.md'), $primo);

    expect(str_starts_with(guidaDelModuloNuovo(), "# Come nasce un modulo nuovo\n"))->toBe(true)
        ->and(in_array('MODULO-NUOVO.md', fileDelloZipDiHead(), true))->toBe(true)
        ->and(str_contains($primo[1] ?? '', '`MODULO-NUOVO.md`'))->toBe(true);
});

it('ogni cosa che la guida nomina c\'è dove dice: i file del pacchetto nello zip, le classi, le rotte, i nomi nel codice di zr-core o di zr-auth, o fra quelli detti di altri (sprint 20 · T2.3)', function () {
    $guida = guidaDelModuloNuovo();

    expect($guida)->not->toBe('')
        ->and(nominatiENonTrovati($guida, fileDelloZipDiHead(), rotteRegistrate(), codiceCheSiInstalla(), codiceDiZrAuth(), nomiDiAltriNellaGuida()))->toBe([]);
});

it('il controllo dei nomi della guida vede ciò che non c\'è: un caso per forma (sprint 20 · T2.3)', function (string $guida, array $mancano) {
    expect(nominatiENonTrovati($guida, fileDelloZipDiHead(), rotteRegistrate(), codiceCheSiInstalla(), codiceDiZrAuth(), nomiDiAltriNellaGuida()))->toBe($mancano);
})->with([
    'ciò che c\'è' => ['Leggi `vendor/zeiras/zr-core/README.md` e `vendor/zeiras/zr-core/resources/lingue/`, registra `Zeiras\Core\Http\IntestazioniSicurezza`, chiama `Cornice::dati()` e `Sessione::aggiorna`, usa `LayoutDellaCornice`, `in_arrivo` e `App::setLocale`; la ricerca è `POST /cornice/ricerca`, la lettura `PATCH /cornice/notifiche/{id}/lettura`; `php artisan vendor:publish --tag=zr-core-config`.', []],
    'un file che lo zip non porta' => ['Vedi `vendor/zeiras/zr-core/tests/zeiras.sha256`.', ['vendor/zeiras/zr-core/tests/zeiras.sha256: non è nello zip']],
    'una cartella che lo zip non porta' => ['Vedi `vendor/zeiras/zr-core/resources/demo/`.', ['vendor/zeiras/zr-core/resources/demo/: non è nello zip']],
    'una classe che non c\'è' => ['Registra `Zeiras\Core\Http\IntestazioniDiSicurezza`.', ['Zeiras\Core\Http\IntestazioniDiSicurezza: la classe non c\'è']],
    'un metodo che la classe non ha' => ['Chiama `Zeiras\Core\Cornice::lingue()`.', ['Zeiras\Core\Cornice::lingue: il metodo non c\'è']],
    'un metodo di Cornice che non c\'è, nel codice di un blocco' => ["```php\nApp::setLocale(Cornice::linguaggio());\n```", ['Cornice::linguaggio(): il metodo non c\'è']],
    'una rotta che non c\'è' => ['La ricerca è `GET /cornice/ricerca`.', ['GET /cornice/ricerca: non è una rotta']],
    'un nome che nessuno ha' => ['Usa `LayoutCornice` e `in_arrivi`.', ['LayoutCornice: nessuno ha questo nome', 'in_arrivi: nessuno ha questo nome']],
    'un metodo che nessuno ha' => ['Chiama `Sessione::rinfresca()`.', ['Sessione::rinfresca(): nessuno ha questo metodo']],
    'un metodo che nessuno ha, scritto con gli argomenti o con ciò che segue' => ['`Ingresso::verso($slug)` c\'è; `Ingresso::versoNessuno($slug)` e `Sessione::utenteCheNonCe()[\'lingua\']` no.', ['Ingresso::versoNessuno($slug): nessuno ha questo metodo', 'Sessione::utenteCheNonCe()[\'lingua\']: nessuno ha questo metodo']],
    'un\'etichetta con cui zr-core non pubblica' => ['`php artisan vendor:publish --tag=zr-core`', ['--tag=zr-core: zr-core non pubblica niente con questa etichetta']],
]);

// Che cosa questo caso non prova (review della PR #26, R11): «la guida non ripete il README». Ferma una riga ricopiata
// com'è, da 80 caratteri in su; una frase ripresa con gli a capo in altri punti passa. È ammessa quando ha il rimando
// accanto: le ha chieste il corridoio (T2.4), per chi non apre il README. Il `>= 8` conta i rimandi, non le ripetizioni:
// se una frase ripresa ha il suo rimando lo vede chi rilegge, non un caso.
it('la guida non porta indirizzi interni, cita solo titoli che il README ha e non ne ricopia le righe (sprint 20 · T2.5)', function () {
    $guida = guidaDelModuloNuovo();
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');

    expect($guida)->not->toBe('')
        ->and(indirizziNonAmmessiIn($guida))->toBe([])
        ->and(titoliDelReadmeCheNonCiSono($guida, $readme))->toBe([])
        ->and(preg_match_all('/README, «[^»]+»/', $guida) >= 8)->toBe(true)
        ->and(righeRicopiateDalReadme($guida, $readme))->toBe([]);
});

it('i tre controlli sul testo della guida vedono ciò che cercano (sprint 20 · T2.5)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $lunga = 'Prima dei globali, e non nel gruppo `web`: così le intestazioni le hanno anche le risposte fuori dal gruppo (`/up`), le';

    expect(indirizziNonAmmessiIn('entra con ssh deploy@macchina.esempio.net, poi 10.20.30.40 e /home/deploy/.chiave; il pannello è su https://pannello.esempio.net/entra, il sito è app.zeiras.com, i font fonts.gstatic.com, il lock non ha `"url": "git@`'))
        ->toBe(['10.20.30.40', 'deploy@macchina.esempio.net', '/home/deploy/.chiave;', 'pannello.esempio.net'])
        ->and(indirizziNonAmmessiIn('`vendor/zeiras/zr-core/resources/lingue/it.json`, `composer.lock`, `bootstrap/app.php`, la v1.10.1 e https://app.zeiras.com/w/<slug>'))->toBe([])
        ->and(titoliDelReadmeCheNonCiSono('Vedi il README, «La parte server» e il README, «Le intestazioni»; di zr-auth, «Installazione».', $readme))->toBe(['Le intestazioni'])
        ->and(str_contains($readme, "\n".$lunga."\n"))->toBe(true)
        ->and(righeRicopiateDalReadme("una riga corta\n  ".$lunga."\nuna riga lunga che il README non ha, scritta apposta per superare gli ottanta caratteri di misura", $readme))->toBe([$lunga]);
});

// Sprint 20 · review della PR #26, R10. La guida cita il README anche per le prime parole di un capoverso o di un punto, e
// il README di zr-auth per titolo: senza un controllo, una riscrittura di quei capoversi lascia rimandi a vuoto.

/** Il README di zr-auth installato: è lì che la guida manda per l'ingresso, la sessione e la guardia. */
function readmeDiZrAuth(): string
{
    return (string) file_get_contents(dirname(__DIR__, 2).'/vendor/zeiras/zr-auth/README.md');
}

/** Un capoverso o un punto d'elenco del testo comincia con queste parole (il grassetto del punto non conta). */
function cominciaCosiUnCapoverso(string $inizio, string $testo): bool
{
    return preg_match('/(?:(?:\A|\n\n)(?:- )?|\n- )(?:\*\*)?'.preg_quote($inizio, '/').'/u', $testo) === 1;
}

/**
 * Ciò che un testo cita del README di zr-core per le prime parole — «README, «Titolo», da «…»», «README, «Titolo», al punto
 * «…»», «il capoverso che comincia con «…»» —, un a capo dentro la citazione compreso.
 *
 * @return list<string>
 */
function capoversiCitatiDelReadme(string $testo): array
{
    preg_match_all('/(?:README, «[^»]+», (?:da|al punto)|capoverso che comincia con) «([^»]+)»/u', (string) preg_replace('/\s+/u', ' ', $testo), $citati);

    return array_values(array_unique($citati[1]));
}

/**
 * Ciò che un testo scrive fra «» in una frase che nomina il «README di zr-auth»: in quelle frasi le virgolette portano solo
 * titoli e punti di quel README.
 *
 * @return list<string>
 */
function citatiDelReadmeDiZrAuth(string $testo): array
{
    preg_match_all('/README di zr-auth(?![A-Za-z]).*?(?:\.(?= |$)|$)/us', (string) preg_replace('/\s+/u', ' ', $testo), $frasi);
    preg_match_all('/«([^»]+)»/u', implode("\n", $frasi[0]), $citati);

    return array_values(array_unique($citati[1]));
}

/**
 * Fra le citazioni date, quelle che il testo non ha né come titolo (`##`, `###`) né come inizio di un capoverso o di un punto.
 *
 * @param  list<string>  $citati
 * @return list<string>
 */
function citatiCheNonCiSono(array $citati, string $testo, bool $ancheTitoli): array
{
    preg_match_all('/^#{2,3} (.+)$/m', $testo, $titoli);

    return array_values(array_filter($citati, fn (string $citato): bool => ! ($ancheTitoli && in_array($citato, $titoli[1], true)) && ! cominciaCosiUnCapoverso($citato, $testo)));
}

// Che cosa questo caso non prova (seconda lettura della PR #26, S14): che il capoverso stia nella sezione citata (si cerca
// in tutto il README), che le parole citate non comincino anche un altro capoverso, che un titolo di zr-auth non valga
// come inizio di capoverso, e una citazione scritta in una forma che le due espressioni non prendono. Le due soglie sono
// i conti di oggi: fermano una citazione che sparisce dal controllo, non una aggiunta in un'altra forma.
it('ciò che la guida cita per le prime parole c\'è: i capoversi e i punti del README, i titoli e i punti del README di zr-auth installato (sprint 20 · review della PR #26, R10)', function () {
    $guida = guidaDelModuloNuovo();
    $delReadme = capoversiCitatiDelReadme($guida);
    $diZrAuth = citatiDelReadmeDiZrAuth($guida);

    expect(count($delReadme) >= 3)->toBe(true)
        ->and(count($diZrAuth) >= 7)->toBe(true)
        ->and(citatiCheNonCiSono($delReadme, (string) file_get_contents(__DIR__.'/../../README.md'), false))->toBe([])
        ->and(citatiCheNonCiSono($diZrAuth, readmeDiZrAuth(), true))->toBe([]);
});

it('il controllo delle citazioni per le prime parole vede ciò che non c\'è: una riga a metà capoverso, un titolo che manca, e una citazione andata a capo (sprint 20 · review della PR #26, R10)', function () {
    $readme = "## Titolo\n\nPrimo capoverso che va\na capo qui dentro.\n\n- **Un punto** dell'elenco\n- un altro punto\n\n### Un titolo sotto\n";
    $guida = "Vedi README, «Titolo», da «Primo capoverso» e README, «Titolo», al punto «Un punto»; il capoverso che comincia con «a capo\nqui» e README, «Titolo», al punto «un altro»; poi README, «Titolo», da «Un capoverso che manca».\n"
        ."Scrivi ciò che dice il README di zr-auth (un percorso), nell'ordine «Titolo» (col suo punto «Un\npunto»), «Un titolo sotto», «Un titolo che manca». Dopo, «Esci» sta in un'altra frase e non si guarda.";

    expect(capoversiCitatiDelReadme($guida))->toBe(['Primo capoverso', 'Un punto', 'a capo qui', 'un altro', 'Un capoverso che manca'])
        ->and(citatiCheNonCiSono(capoversiCitatiDelReadme($guida), $readme, false))->toBe(['a capo qui', 'Un capoverso che manca'])
        ->and(citatiDelReadmeDiZrAuth($guida))->toBe(['Titolo', 'Un punto', 'Un titolo sotto', 'Un titolo che manca'])
        ->and(citatiCheNonCiSono(citatiDelReadmeDiZrAuth($guida), $readme, true))->toBe(['Un titolo che manca'])
        ->and(citatiCheNonCiSono(['Titolo'], $readme, false))->toBe(['Titolo']);
});

/** Quante volte un testo nomina il menu dei moduli con quel nome, anche spezzato su due righe («menu Moduli», «Menu Prodotti»). */
function volteCheNominaIlMenu(string $nome, string $testo): int
{
    return (int) preg_match_all('/\bmenu\s+'.$nome.'\b/iu', $testo);
}

it('il documento chiama il menu «menu Moduli» (sprint 21 · T1.5)', function (string $file) {
    expect(volteCheNominaIlMenu('Moduli', (string) file_get_contents(dirname(__DIR__, 2).'/'.$file)))->toBeGreaterThan(0);
})->with(['README.md', 'MODULO-NUOVO.md']);

it('nessun file che lo zip porta chiama ancora il menu «menu Prodotti»: né i documenti né la descrizione del pacchetto né i commenti del codice; le copie del design system restano le sue (sprint 21 · T1.5)', function () {
    $radice = dirname(__DIR__, 2);
    // Sprint 25 · T1: del design system è anche resources/js/zeiras/componenti.js, il corpo di bundle.js riga per riga coi suoi
    // commenti (la CI lo confronta con ciò che il bundle genera: una riga scritta a mano lì dentro la ferma).
    $conIlNomeDiPrima = array_values(array_filter(
        fileDelloZipDiHead(),
        fn (string $file): bool => ! str_starts_with($file, 'resources/zeiras/')
            && $file !== 'resources/js/zeiras/componenti.js'
            // Sprint 71: anche il modulo di MentionField, righe del bundle uguali.
            && $file !== 'resources/js/zeiras/MentionField.js'
            // Sprint 75: e i CSS che `npm run componenti` divide da bundle.css, righe del bundle uguali.
            && $file !== 'resources/css/zeiras.css'
            && ! str_starts_with($file, 'resources/css/zeiras/')
            && volteCheNominaIlMenu('Prodotti', (string) file_get_contents("$radice/$file")) > 0,
    ));

    expect($conIlNomeDiPrima)->toBe([]);
});

it('il README dice, nel punto «Il menu Moduli», da quale versione il menu ha questo nome e quali testi cambiano con lui (sprint 21 · T1.5)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');

    expect(str_contains(puntoDellaCornice($readme, 'Il menu Moduli'), $frase))->toBe(true);
})->with([
    'la versione e il nome nuovo' => ['Dalla `v1.10.2` il menu si chiama «Moduli» («Modules», «Módulos»)'],
    'il nome di prima' => ['prima era «Prodotti»'],
    'l\'aiuto della ricerca' => ['«Cerca in tutti i moduli: scrivi almeno 2 caratteri.»'],
    'il titolo della notifica di un modulo' => ['`titoloDellaNotifica` dà a `com.zeiras.app.modificata`, «Un modulo è stato attivato o disattivato»'],
]);

// Sprint 21 · T3 (voce #1641): da una notifica si apre la sua risorsa. Il README lo dice dove parla delle notifiche, con la
// versione e con la funzione che chi mostra le notifiche in una pagina sua importa; nel paragrafo delle funzioni dice come si
// chiama e che cosa legge; e nella riga della rotta, che cosa sono gli `ids`.

it('il README dice che dalla v1.11.0 un clic su una notifica apre la sua risorsa: al punto «Le notifiche» dove, quando no e con quale funzione; nel paragrafo delle funzioni come si chiama e che cosa legge; nella riga della rotta che cosa sono gli `ids` (sprint 21 · T3.6)', function (string $dove, string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    preg_match('/^- \*\*Le notifiche\*\* .*?(?=^- \*\*|\z)/ms', $readme, $punto);
    $testi = [
        'punto' => suUnaRiga($punto[0] ?? ''),
        'paragrafo' => paragrafoFuoriDallaCornice($readme),
        'rotta' => rigaDellaRotta($readme, 'GET /cornice/notifiche'),
    ];

    expect($testi[$dove])->not->toBe('')
        ->and(str_contains($testi[$dove], $frase))->toBe(true);
})->with([
    'la versione, e che cosa si apre' => ['punto', 'Dalla `v1.11.0` un clic su una notifica apre la sua risorsa, nel modulo da cui viene e, dalla `v1.12.0`, nel workspace dell\'elenco'],
    'i due casi del CRM della `v1.11.0`; la nota ha il suo caso (sprint 23 · T3.7)' => ['punto', 'una notifica di un contatto del CRM apre `https://crm.zeiras.com/w/<slug>/contatti/<id>`, una di una pipeline le sue impostazioni, una di un\'azienda'],
    'il caso delle aziende (sprint 21 · T5.2)' => ['punto', 'una di un\'azienda l\'elenco delle aziende col suo pannello aperto (`https://crm.zeiras.com/w/<slug>/aziende/<id>`)'],
    // Sprint 70 · T1 (voce #2429): dalla `v3.0.0` le righe stanno in un file loro, e la funzione si importa da `…/resources/js/frasi`.
    'dove sta scritto' => ['punto', 'Dove si apre ogni tipo lo dice il registro (dalla `v3.0.0` le righe di `resources/registro/notifiche.json`, più sotto), e gli id sono quelli di `ids`'],
    'la funzione' => ['punto', 'la regola è `destinazioneDellaNotifica`, che chi mostra le notifiche in una pagina sua importa da `…/resources/js/frasi` (dalla `v3.0.0`: prima dall\'ingresso, vedi «Passare alla v3»)'],
    'quando no' => ['punto', 'Una notifica che non ha dove andare apre `https://app.zeiras.com/notifiche`, come «Vedi tutte»'],
    'un id non è un permesso (review della PR #31, R12)' => ['punto', 'Un id non è un permesso: chi riceve la notifica può non poter vedere quella risorsa, la cornice non lo controlla, e lo decide il modulo che apre la pagina'],
    'oggi il backoffice non le manda (review della PR #31, R3)' => ['punto', 'Per quel contratto i dodici tipi nuovi non generano ancora notifiche per i colleghi: titoli e destinazioni sono pronti per quando il backoffice le manderà'],
    'nome, argomenti e versione' => ['paragrafo', 'Dalla `v1.11.0` si importa anche `destinazioneDellaNotifica(notifica, slug, prodotti)`, per chi apre una notifica da una pagina sua'],
    'che cosa dà' => ['paragrafo', 'dà l\'indirizzo che il pannello della cornice apre con un clic su quella notifica, ed è la funzione che usa il pannello'],
    'che cosa legge' => ['paragrafo', 'la funzione ne legge `app`, `tipo` e `ids`'],
    'quando non dà niente' => ['paragrafo', 'Non dà niente (`undefined`) quando la notifica non ha dove andare'],
    'mai a metà' => ['paragrafo', 'mai un indirizzo composto a metà'],
    // Sprint 22 · T3.4 (seconda lettura della PR #31, S5): la forma, non solo gli esempi di ciò che non la ha.
    'nemmeno con uno slug malfatto, e la forma di uno slug (review della PR #31, R7; sprint 22 · T3.4)' => ['paragrafo', 'nemmeno con uno `slug` che non ha la forma di uno slug: minuscole e cifre, a pezzi uniti da un trattino (`acme`, `acme-marketing`)'],
    'gli slug che la forma non la hanno (sprint 22 · T3.4)' => ['paragrafo', 'Uno vuoto, `..`, uno con una barra, `Acme`, `acme_marketing` non la hanno: anche allora non dà niente'],
    'il registro' => ['paragrafo', 'dalla `v3.0.0` in `resources/registro/notifiche.json`, che ha sotto l\'id di ogni modulo una riga per tipo (fino alla `v2.25.4` stavano in `notifiche` della voce del modulo, un campo che dalla `v3.0.0` le voci non hanno più), col tipo intero dell\'evento (`com.zeiras.crm.nota.creata`) e il percorso nel modulo dopo `/w/<slug>`'],
    // Review della PR #31, R1 e R6: di `dati` passano i soli id che il registro chiede per quel tipo, non ogni `id` e `*_id`.
    'gli ids nella riga della rotta' => ['rotta', 'dalla `v1.11.0` `ids` sono gli id che servono ad aprire la risorsa della notifica, per chiave'],
    // Review della PR #51, R2: dalla `v1.13.0` un tipo può avere più percorsi, e gli id sono quelli di uno solo, quello che si apre.
    'che cosa passa di dati' => ['rotta', 'di `dati` del backoffice passano i soli id del percorso che la notifica apre — quello che il registro dà al suo tipo, fra le righe della sua app'],
    'più percorsi, nella riga della rotta (review della PR #51, R2)' => ['rotta', 'dalla `v1.13.0` un tipo può avere più percorsi, e gli `ids` sono quelli del primo che `dati` soddisfa per intero (per una nota di un\'opportunità `{"trattativa_id": "…"}`, per una legata alla sola azienda `{"organizzazione_id": "…"}`'],
    'vuoto anche con una destinazione (review della PR #51, R2)' => ['rotta', 'e dalla `v1.13.0` lo ha vuoto anche una il cui percorso non chiede un id (un\'attività, che apre «Da fare»): se una notifica ha una destinazione lo dice `destinazioneDellaNotifica`, non `ids`'],
    'la forma del valore' => ['rotta', 'e solo con un valore che ha la forma di un id (un testo di lettere, cifre, `-` e `_`, da 1 a 64)'],
    'che cosa non passa' => ['rotta', 'gli altri id, il resto di `dati` e `soggetto` non arrivano al browser'],
    'senza destinazione, o senza dati' => ['rotta', 'una notifica di un tipo che nel registro non ha una destinazione, senza `dati`, o con un `dati` che non è un oggetto, ha `ids` vuoto (`{}`) e non è un errore'],
]);

it('la guida dice quante sono le cose che si chiedono ad altri, e sono quelle del suo elenco: una voce in più cambia anche il numero (sprint 21 · review della PR #31, R2)', function () {
    preg_match('/^## Prima di tutto: ciò che si chiede ad altri\n(.*?)(?=^## )/ms', guidaDelModuloNuovo(), $capitolo);
    preg_match('/^(\S+) cose non le scrivi tu/m', $capitolo[1] ?? '', $quante);
    $numeri = ['Tre' => 3, 'Quattro' => 4, 'Cinque' => 5, 'Sei' => 6, 'Sette' => 7, 'Otto' => 8];

    expect($numeri[$quante[1] ?? ''] ?? null)->not->toBeNull()
        ->and($numeri[$quante[1] ?? ''] ?? null)->toBe(preg_match_all('/^- \*\*/m', $capitolo[1] ?? ''));
});

it('la pagina di prova dà alla cornice gli stessi dati finché non cambiano: un clic che naviga non glieli ridà come nuovi, e dopo «Segna tutte come lette» il numero non torna sulla campanella (sprint 21 · review della PR #31, R5)', function () {
    expect(scritteNellaPaginaDiProva('demo.tsx', ['const dati = useMemo(', 'dati={dati}', 'dati={{']))
        ->toBe(['const dati = useMemo(' => 1, 'dati={dati}' => 1, 'dati={{' => 0]);
});

// Sprint 22 · T1 (voce #1713): la risposta dell'elenco dice di quale workspace è, e il clic apre lì la risorsa. Il README lo
// dice nella riga della rotta (la chiave, che cos'è, da quando) e al punto «Le notifiche» (dove si apre, nei tre casi).

it('il README dice che dalla v1.12.0 l\'elenco delle notifiche porta il suo workspace e che un clic apre lì la risorsa: nella riga della rotta la chiave e che cos\'è, al punto «Le notifiche» i tre casi (sprint 22 · T1.6)', function (string $dove, string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    preg_match('/^- \*\*Le notifiche\*\* .*?(?=^- \*\*|\z)/ms', $readme, $punto);
    $testi = ['punto' => suUnaRiga($punto[0] ?? ''), 'rotta' => rigaDellaRotta($readme, 'GET /cornice/notifiche')];

    expect($testi[$dove])->not->toBe('')
        ->and(str_contains($testi[$dove], $frase))->toBe(true)
        // Il workspace in cui si apre non è più, sempre, quello dei dati della pagina.
        ->and(str_contains($testi['punto'], 'nel modulo da cui viene e nel workspace dei dati'))->toBe(false);
})->with([
    'la chiave nella riga della rotta' => ['rotta', '| `{data: [{id, creata_il, letta, app, tipo, autore_nome, risorsa_nome, per_me, azioni, board_nome, quando, ids}], aggiornati_il, workspace, persona}`:'],
    'che cos\'è, e da quando' => ['rotta', 'dalla `v1.12.0` `workspace` è lo slug del workspace della sessione, quello col cui gettone l\'elenco è stato letto: lo dice la parte server, e non segue niente di ciò che manda il browser'],
    'dove si apre' => ['punto', 'Dalla `v1.11.0` un clic su una notifica apre la sua risorsa, nel modulo da cui viene e, dalla `v1.12.0`, nel workspace dell\'elenco'],
    'perché' => ['punto', 'la sessione ha un workspace solo: con due schede su due workspace, la scheda rimasta indietro riceve le notifiche di quello in cui la persona è entrata per ultimo'],
    'lo stesso workspace' => ['punto', 'Se l\'elenco è del workspace dei dati della pagina decide lo stato dei moduli nei dati, come prima'],
    'un altro workspace' => ['punto', 'se è di un altro, quello stato non decide — è di un altro workspace — e la risorsa si apre: se lì il modulo non è attivo lo dice il modulo'],
    'non detto' => ['punto', 'se la risposta non dice il workspace, o lo dice senza la forma di uno slug, il clic apre la pagina delle notifiche'],
]);

// Sprint 22 · T2 (voce #1712): il clic che apre la risorsa di una notifica non letta la segna letta. Il README lo dice al punto
// «Le notifiche» — quando sì e quando no, che l'apertura non aspetta, che cosa succede se la lettura fallisce, quando scende il
// numero, l'avviso per il lettore di schermo — e nella riga della rotta, che ora porta il suo istante.

it('il README dice che dalla v1.12.0 il clic che apre la risorsa segna letta la notifica: nella riga della rotta l\'istante e che cos\'è, al punto «Le notifiche» quando sì e quando no, il caso in cui la lettura fallisce, il numero e l\'avviso (sprint 22 · T2.7)', function (string $dove, string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    preg_match('/^- \*\*Le notifiche\*\* .*?(?=^- \*\*|\z)/ms', $readme, $punto);
    $testi = ['punto' => suUnaRiga($punto[0] ?? ''), 'rotta' => rigaDellaRotta($readme, 'PATCH /cornice/notifiche/{id}/lettura')];

    expect($testi[$dove])->not->toBe('')
        ->and(str_contains($testi[$dove], $frase))->toBe(true)
        // La cornice la chiama di nuovo: il README non dice più che la rotta resta solo per i frontend.
        ->and(str_contains(suUnaRiga($readme), 'che dalla v1.1.0 la cornice non chiama più'))->toBe(false);
})->with([
    'l\'istante nella riga della rotta' => ['rotta', '| `{data: {id, letta}, segnata_il}`:'],
    'che cos\'è, e da quando' => ['rotta', 'dalla `v1.12.0` `segnata_il` è l\'istante preso dopo la risposta del backoffice, nella forma di `aggiornati_il`'],
    'il clic segna letta, e da quando' => ['punto', 'Dalla `v1.12.0` il clic che apre la risorsa di una notifica non letta la segna letta'],
    // Review della PR #44, R3: `segnaLetta` non è più fra parentesi come se si importasse (sotto, il caso della review).
    'la richiesta' => ['punto', 'la cornice chiede `PATCH /cornice/notifiche/<id>/lettura` con `{"letta": true}`, col gettone CSRF e con `keepalive`, perché la pagina sta cambiando'],
    // Sprint 53 · T1 (voce #2083): dalla `v2.14.0` l'apertura aspetta la lettura a ogni età della pagina.
    'l\'apertura aspetta la lettura (sprint 53 · T1)' => ['punto', 'Dalla `v2.14.0` il clic aspetta la lettura a ogni età della pagina, e la risorsa si apre alla risposta'],
    // Sprint 53 · T3 (voce #2085): una già letta con una destinazione chiede la lettura anche lei.
    'quando no (sprint 53 · T3)' => ['punto', 'Una notifica il cui clic apre la pagina delle notifiche non chiede niente'],
    'anche una già letta (sprint 53 · T3)' => ['punto', 'Dalla `v2.14.0` anche il clic su una notifica già letta che ha una destinazione chiede la lettura'],
    'quando scende il numero' => ['punto', 'Il numero sulla campanella scende di uno quando la parte server risponde `letta: true`, non al clic'],
    // Review della PR #44, R1: non «fino a `segnata_il`», ma per i dati del clic.
    'una volta sola' => ['punto', 'e solo per i dati che la pagina aveva al clic: dei dati letti dopo il clic non si può sapere se la contano già letta'],
    // Review della PR #51, R1: dalla `v1.13.0` non scende nemmeno per i dati del clic, se l'elenco del clic era più vecchio di loro.
    'solo con un elenco non più vecchio dei dati (review della PR #51, R1)' => ['punto', 'Dalla `v1.13.0` scende solo se l\'elenco in pagina al clic non era più vecchio dei dati del clic'],
    'quando un elenco non è più vecchio (review della PR #51, R1)' => ['punto', 'L\'elenco non è più vecchio dei dati quando il suo `aggiornati_il` non viene prima del loro; se uno dei due segni manca, solo quando è stato chiesto con quello stesso oggetto `dati`'],
    // Sprint 53 · T4 (review R1): dalla `v2.14.0` un errore della lettura non apre niente.
    'se la lettura fallisce' => ['punto', 'Se la lettura fallisce in pagina non cambia niente: la notifica resta da leggere, e il numero com\'era (fino alla `v2.13` la risorsa si apriva lo stesso)'],
    'un altro clic riprova (sprint 53 · T2.4, review R9)' => ['punto', 'La notifica resta da leggere, e un altro clic chiede di nuovo la lettura'],
    'una chiamata in più, e perché (sprint 53 · T3.4, review R9)' => ['punto', 'così una scheda rimasta aperta non la apre con la sessione di un\'altra persona entrata altrove. È una chiamata al backoffice in più per ogni clic su una già letta'],
    'i test di chi passa alla v2.14.0 (sprint 53 · T4, review R7)' => ['punto', 'Per i test di un frontend che passa alla `v2.14.0` cambiano due cose. Un clic su una notifica che ha una destinazione, anche già letta, apre solo se la `PATCH` finta della lettura risponde `{"data": {"letta": true}}`'],
    'i test di chi passa alla v2.14.0: l\'apertura dopo la risposta (sprint 53 · T4, review R7)' => ['punto', 'E l\'apertura arriva dopo la risposta, non nello stesso giro del clic'],
    'l\'avviso' => ['punto', 'lo dice un avviso che non si vede (`role="status"`, con la classe `zr-visually-hidden`), accanto all\'`AppShell`'],
    'che cosa dice l\'avviso' => ['punto', 'dice il nome della campanella col numero nuovo («Notifiche, 2 non lette», «Notifiche, 1 non letta») e a zero il testo `unreadNone` di zr-core («Nessuna notifica non letta»)'],
    'quando l\'avviso tace' => ['punto', 'parla solo per il numero che scende con un clic'],
]);

// Sprint 22 · T4, la review della PR #44: ciò che il README diceva e non era vero (R1, R2, R3, R9), ciò che era ambiguo (R8) e
// ciò che non diceva a chi installa (R6, R7).

it('il README dice ciò che la review della PR #44 ha chiesto: il numero scende solo per i dati del clic, lo slug e i moduli da dare a `destinazioneDellaNotifica`, `segnaLetta` che l\'ingresso non esporta, la forma dell\'id, che cosa cambia nei test di un frontend, i nove tipi che hanno una destinazione (sprint 22 · T4; review della PR #44)', function (string $dove, string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    preg_match('/^- \*\*Le notifiche\*\* .*?(?=^- \*\*|\z)/ms', $readme, $punto);
    $testi = [
        'punto' => suUnaRiga($punto[0] ?? ''),
        'paragrafo' => paragrafoFuoriDallaCornice($readme),
        'rotta' => rigaDellaRotta($readme, 'PATCH /cornice/notifiche/{id}/lettura'),
    ];

    expect($testi[$dove])->not->toBe('')
        ->and(str_contains($testi[$dove], $frase))->toBe(true);
})->with([
    'R1: mai una in meno' => ['punto', 'e vale il loro numero: al più una in più fino alla visita dopo, mai una in meno'],
    'R1: perché non si può sapere' => ['punto', 'il loro segno è preso prima della lettura dal backoffice, `segnata_il` dopo la sua risposta'],
    'R1: con che cosa si confronta segnata_il' => ['rotta', 'la cornice lo confronta con l\'istante dell\'elenco'],
    'R2: lo slug è quello dell\'elenco' => ['paragrafo', '`slug` è il workspace dell\'elenco, cioè `workspace` nella risposta di `GET /cornice/notifiche` (dalla `v1.12.0`), che non è sempre quello dei dati della pagina'],
    'R2: i moduli dei dati valgono solo per il loro workspace' => ['paragrafo', '`dati.prodotti` vale solo se quello slug è `dati.workspace.slug`'],
    'R2: per un altro workspace' => ['paragrafo', 'il pannello dà ogni voce del `registro`, tranne `home`, come `disponibile`'],
    'R3: segnaLetta è della cornice' => ['punto', 'La funzione che lo fa, `segnaLetta`, è della cornice e l\'ingresso non la esporta: un frontend che segna letta una notifica da una pagina sua chiama la rotta'],
    // Sprint 53 · T2 (voce #2084): senza la lettura la risorsa non si apre, e un errore non apre niente.
    'R6: la forma dell\'id' => ['punto', 'Se l\'id della notifica non ha la forma che la rotta vuole (lettere, cifre, `-` e `_`, 64 al più) la richiesta non parte, e dalla `v2.14.0` la risorsa non si apre'],
    'l\'errore della lettura non apre (sprint 53 · T2)' => ['punto', 'Dalla `v2.14.0` la risorsa si apre solo se la lettura riesce, cioè se la rotta risponde `letta: true`'],
    'l\'errore non si vede (sprint 53 · T2)' => ['punto', 'A schermo niente dice che il clic non è andato: l\'`AppShell` chiude il pannello al clic'],
    'R7: la risposta finta senza workspace' => ['punto', 'Una risposta finta di `GET /cornice/notifiche` senza `workspace` manda ogni clic alla pagina delle notifiche: le si aggiunge `workspace`, con lo slug dei dati della pagina'],
    'R7: la richiesta in più' => ['punto', 'Un clic su una notifica non letta che apre la sua risorsa fa partire una richiesta in più, la `PATCH` della lettura'],
    'R7: i due elementi' => ['punto', 'chi conta i figli del contenitore della `Cornice`, o ne prende l\'unico, ne trova due'],
    'R7: dove cercare' => ['punto', 'Si trovano cercando `cornice/notifiche` e `<Cornice` nei test del frontend'],
    'R8: quelli che hanno una destinazione, diciotto del CRM dalla `v1.13.0` e tre di Project Management dalla `v1.14.0` (sprint 23 · T3.7; sprint 24 · T3.5)' => ['punto', 'dalla `v1.13.0` ci sono diciotto tipi del CRM: quelli di contatti, pipeline, note e aziende, e quelli di opportunità, attività e i quattro «assegnata»; dalla `v1.14.0` tre di Project Management'],
    'R9: possono' => ['punto', 'fino alla `v2.13` la destinazione poteva arrivare prima della risposta'],
]);

it('il README non dice più ciò che la review della PR #44 ha trovato falso, e l\'ingresso non esporta `segnaLetta`, come il README dice (review della PR #44, R1, R2, R3, R9)', function () {
    $readme = suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md'));
    $ingresso = (string) file_get_contents(__DIR__.'/../../resources/js/index.ts');

    expect(str_contains($readme, 'solo per i dati letti fino a `segnata_il`'))->toBe(false)
        ->and(str_contains($readme, '`slug` è il workspace della sessione'))->toBe(false)
        ->and(str_contains($readme, '(la funzione `segnaLetta`'))->toBe(false)
        ->and(str_contains($readme, 'il numero nuovo lo portano i dati della pagina dopo'))->toBe(false)
        ->and(str_contains($readme, 'la cornice lo confronta col segno dei dati'))->toBe(false)
        ->and(str_contains($ingresso, 'segnaLetta'))->toBe(false);
});

// Sprint 22 · T5 (voce #1720): i nove tipi nuovi del CRM, opportunità, attività e ciò che viene assegnato a una persona, hanno un
// titolo. Il README lo dice nel punto «Le notifiche»: quali, quanti sono i titoli adesso, il tipo dei quattro «assegnata» e che
// nessuno dei nove apre una risorsa.

it('il README dice, nel punto «Le notifiche», i nove tipi nuovi del CRM coi loro titoli, che con quelli i titoli erano 40, che i quattro «assegnata» hanno il tipo senza `com.zeiras.` davanti e che nessuno dei nove apriva una risorsa fino alla v1.12.0, mentre dalla v1.13.0 ognuno apre la sua pagina (sprint 22 · T5.5; sprint 23 · T3.7)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    preg_match('/^- \*\*Le notifiche\*\* .*?(?=^- \*\*|\z)/ms', $readme, $punto);
    $testo = suUnaRiga($punto[0] ?? '');

    expect($testo)->not->toBe('')
        ->and(str_contains($testo, $frase))->toBe(true)
        // I titoli non sono più 31: il numero di prima resta solo al passato.
        ->and(str_contains(suUnaRiga($readme), 'i titoli sono 31'))->toBe(false);
})->with([
    'la versione e i cinque eventi' => ['Dalla `v1.12.0` hanno un titolo altri nove tipi del CRM: i cinque eventi di opportunità e attività («Nuova opportunità», «Opportunità modificata», «Nuova attività», «Attività modificata», «Attività eliminata»)'],
    'le quattro notifiche a chi diventa responsabile' => ['e le quattro notifiche che il CRM manda a chi diventa responsabile («Ti è stato assegnato un contatto», «Ti è stata assegnata un\'azienda», «Ti è stata assegnata un\'opportunità», «Ti è stata assegnata un\'attività»)'],
    'il tipo senza `com.zeiras.` davanti' => ['Queste quattro non sono eventi: il loro `tipo` arriva senza `com.zeiras.` davanti (`crm.persona.assegnata`, `crm.organizzazione.assegnata`, `crm.trattativa.assegnata`, `crm.attivita.assegnata`)'],
    'la chiave del titolo' => ['la chiave del titolo è `notificationTitle.crm.persona.assegnata`, non `notificationTitle.com.zeiras.crm.persona.assegnata`'],
    // Sprint 24 · T3: con la scheda assegnata i titoli sono 41, e i 40 restano al passato.
    'quanti erano i titoli' => ['Con quelli i titoli erano 40: i 36 tipi di evento del contratto e i quattro «assegnata»'],
    'nessuno dei nove apriva una risorsa, e ora sì' => ['Fino alla `v1.12.0` nessuno dei nove apriva una risorsa, e un clic apriva la pagina delle notifiche (`https://app.zeiras.com/notifiche`); dalla `v1.13.0` ognuno apre la sua pagina nel CRM'],
]);

// Sprint 23 · T3 (voce #1743): le notifiche di opportunità, attività e «assegnata» aprono la loro pagina nel CRM, e una nota la
// cosa più specifica a cui è attaccata. Il README dice quali tipi aprono una risorsa e dove, che cos'è `altrimenti` e in che
// ordine si prova, che un percorso può non avere un id — e allora `ids` è vuoto senza che manchi la destinazione —, e non dice
// più che quei nove non ne hanno una; `MODULO-NUOVO.md` lo dice a chi chiede una destinazione.

it('il README dice quali notifiche del CRM aprono una risorsa e dove — diciotto tipi dalla v1.13.0 —, che una nota apre la cosa più specifica, che cos\'è `altrimenti` e in che ordine si prova, e che un percorso può non avere un id (sprint 23 · T3.7)', function (string $dove, string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    preg_match('/^- \*\*Le notifiche\*\* .*?(?=^- \*\*|\z)/ms', $readme, $punto);
    $testo = $dove === 'punto' ? suUnaRiga($punto[0] ?? '') : suUnaRiga($readme);

    expect($testo)->not->toBe('')
        ->and(str_contains($testo, $frase))->toBe(true);
})->with([
    'un\'opportunità' => ['punto', 'Dalla `v1.13.0` una di un\'opportunità — nuova, modificata o assegnata — apre `https://crm.zeiras.com/w/<slug>/opportunita/<id>`, un contatto o un\'azienda assegnati la loro pagina'],
    'un\'attività, senza un id' => ['punto', 'e una di un\'attività — nuova, modificata, eliminata o assegnata — la pagina «Da fare» (`https://crm.zeiras.com/w/<slug>/da-fare`), senza un id: un\'attività non ha una pagina sua'],
    'una nota, la cosa più specifica' => ['punto', 'Una nota apre la cosa più specifica a cui è attaccata: l\'opportunità se ne ha una, altrimenti il contatto, altrimenti l\'azienda (fino alla `v1.12.0` apriva solo il contatto, e senza quello la pagina delle notifiche)'],
    'diciotto tipi' => ['punto', 'dalla `v1.13.0` ci sono diciotto tipi del CRM'],
    'quando non ha dove andare' => ['punto', 'le mancano gli id di ogni percorso del suo tipo'],
    'il metodo, con più percorsi' => ['readme', 'Dalla `v1.13.0` un tipo può avere più percorsi, e il metodo dà gli id del primo che `dati` soddisfa per intero, e solo quelli: per una nota legata a un\'opportunità e a un contatto la sola `[\'trattativa_id\' => \'<id>\']`'],
    'un `ids` vuoto non è «nessuna destinazione»' => ['readme', 'Per un tipo il cui percorso non chiede un id — un\'attività, che apre «Da fare» — dà `[]`: un `ids` vuoto non vuol dire che la notifica non ha una destinazione, e se ce l\'ha lo dice `destinazioneDellaNotifica`'],
    // Review della PR #51, R7 e R11: che cosa dà il metodo quando nessun percorso è intero, e quali dei nove tipi oggi arrivano.
    'se nessun percorso è intero (review della PR #51, R7)' => ['readme', 'Se `dati` non ne soddisfa nessuno per intero dà gli id in forma del primo percorso, che da soli non aprono niente'],
    'i cinque eventi che oggi non arrivano (review della PR #51, R11)' => ['punto', 'Per il contratto nemmeno i cinque eventi di opportunità e attività generano ancora notifiche per i colleghi: delle nove arrivano le quattro «assegnata»'],
    'un percorso senza segnaposto, nel registro' => ['readme', 'Un percorso può non avere un segnaposto (`/da-fare`, per un\'attività): allora non chiede un id'],
    '`altrimenti`, e l\'ordine' => ['readme', 'Dalla `v1.13.0` una riga può avere anche `altrimenti`, la lista dei percorsi che si provano dopo `percorso`, in ordine, quando la risorsa può stare in più pagine: si apre il primo che ha tutti i suoi id — per una nota `/opportunita/{trattativa_id}`, altrimenti `/contatti/{persona_id}`, altrimenti `/aziende/{organizzazione_id}`'],
    'un tipo che non è un evento' => ['readme', 'Un tipo che non è un evento, come ciò che il CRM manda a chi diventa responsabile (`crm.persona.assegnata`), è scritto com\'è nel backoffice, senza `com.zeiras.` davanti'],
]);

it('il README non dice più che i tipi con una destinazione sono nove, né che opportunità, attività e i quattro «assegnata» non ne hanno una; e `MODULO-NUOVO.md` dice a chi chiede una destinazione che il percorso può non avere un id e che i percorsi possono essere più d\'uno, in ordine (sprint 23 · T3.7)', function () {
    $readme = suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md'));
    $guida = suUnaRiga((string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md'));

    expect(substr_count($readme, 'oggi ci sono nove tipi del CRM'))->toBe(0)
        ->and(substr_count($readme, 'i quattro «assegnata» e le viste di una board non hanno una destinazione'))->toBe(0)
        ->and(substr_count($readme, 'Nessuno dei nove apre una risorsa'))->toBe(0)
        ->and(substr_count($readme, 'una di una nota il contatto a cui è attaccata'))->toBe(0)
        ->and(substr_count($readme, 'diciotto tipi del CRM'))->toBe(1)
        ->and(substr_count($guida, 'la pagina che si apre con un clic (il percorso dopo `/w/<slug>`, con l\'id che serve, o senza se la pagina non ne chiede; se la risorsa può stare in più pagine, i percorsi in ordine, dal più specifico)'))->toBe(1);
});

// Sprint 24 · T3 (voce #1748): la notifica a chi viene assegnata una scheda ha il suo titolo, e una scheda nuova, modificata o
// assegnata si apre con un clic. Il README lo dice dove dice le altre: titolo e tipo nel punto «Le notifiche», coi titoli che
// ora sono 41; dove si apre, e che una scheda eliminata non si apre; le righe del registro. `MODULO-NUOVO.md` la porta come
// esempio di una notifica che non è un evento.

it('il README dice, dalla v1.14.0, il titolo e il tipo della notifica a chi viene assegnata una scheda, che con lei i titoli erano 41, che una scheda nuova, modificata o assegnata apre la sua pagina in zr-board e una eliminata no, e le tre righe del registro (sprint 24 · T3.5)', function (string $dove, string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    preg_match('/^- \*\*Le notifiche\*\* .*?(?=^- \*\*|\z)/ms', $readme, $punto);
    $testo = $dove === 'punto' ? suUnaRiga($punto[0] ?? '') : suUnaRiga($readme);

    expect($testo)->not->toBe('')
        ->and(str_contains($testo, $frase))->toBe(true);
})->with([
    'il titolo' => ['punto', 'Dalla `v1.14.0` ha un titolo anche la notifica che Project Management manda a chi viene assegnata una scheda: «Ti è stata assegnata una scheda»'],
    'il tipo senza `com.zeiras.` davanti, e la chiave' => ['punto', 'Come le quattro del CRM non è un evento: il suo `tipo` arriva senza `com.zeiras.` davanti (`board.scheda.assegnata`), e la chiave del titolo è `notificationTitle.board.scheda.assegnata`'],
    // Sprint 26 · T6: con la menzione in un commento i titoli sono 42, e i 41 passano al passato.
    'quanti sono i titoli' => ['punto', 'Con lei i titoli erano 41: i 36 tipi di evento del contratto e i cinque «assegnata»'],
    'il contratto la elenca dal 12/10/2026' => ['punto', 'Il contratto la elenca dal 12/10/2026: `app` `pm`, nei `dati` il solo `id` della scheda, e `risorsa_nome` è il titolo della scheda'],
    'dove si apre una scheda' => ['punto', 'Dalla `v1.14.0` una di una scheda di Project Management — nuova, modificata o assegnata — apre la scheda, `https://board.zeiras.com/w/<slug>/c/<id>`'],
    'una scheda eliminata no' => ['punto', 'una di una scheda eliminata no: la sua pagina non c\'è più'],
    'i tipi con una destinazione' => ['punto', 'dalla `v1.14.0` tre di Project Management: una scheda nuova, modificata o assegnata; una scheda eliminata e gli altri tipi di Project Management — board, liste, aree, etichette, viste — non hanno una destinazione'],
    'le righe del registro' => ['readme', 'Dalla `v1.14.0` ha le sue `notifiche` anche la voce di Project Management: una scheda nuova, modificata (`com.zeiras.board.scheda.creata`, `com.zeiras.board.scheda.modificata`) o assegnata (`board.scheda.assegnata`), tutte e tre con `/c/{id}`'],
]);

// Sprint 26 · T6 (voce #1773). Dalla `v1.16.0` la campanella dà un titolo anche alla notifica a chi viene menzionato in un
// commento, e un clic apre la scheda del commento. Il README lo dice dove dice la scheda assegnata: titolo, tipo e chiave nel
// punto «Le notifiche», coi titoli che ora sono 42 e ciò che ne dice il contratto; dove si apre, e che l'id del commento non
// entra nell'indirizzo; la quarta riga del registro. `MODULO-NUOVO.md` la porta accanto alla scheda assegnata.

it('il README dice, dalla v1.16.0, il titolo, il tipo e la chiave della notifica a chi viene menzionato in un commento, che con lei i titoli erano 42, che cosa ne dice il contratto, che un clic apre la scheda e non porta l\'id del commento, e la quarta riga del registro (sprint 26 · T6.3)', function (string $dove, string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    preg_match('/^- \*\*Le notifiche\*\* .*?(?=^- \*\*|\z)/ms', $readme, $punto);
    $testo = $dove === 'punto' ? suUnaRiga($punto[0] ?? '') : suUnaRiga($readme);

    expect($testo)->not->toBe('')
        ->and(str_contains($testo, $frase))->toBe(true);
})->with([
    'il titolo' => ['punto', 'Dalla `v1.16.0` ha un titolo anche la notifica che Project Management manda a chi viene menzionato in un commento: «Ti hanno menzionato in un commento»'],
    'il tipo senza `com.zeiras.` davanti, e la chiave' => ['punto', 'Non è un evento nemmeno lei: il suo `tipo` è `board.commento.menzione`, senza `com.zeiras.` davanti, e la chiave del titolo è `notificationTitle.board.commento.menzione`'],
    // Sprint 36 · T5: coi motivi di perdita del CRM i titoli sono 44, e i 42 passano al passato.
    'quanti sono i titoli' => ['punto', 'Con lei i titoli erano 42: i 36 tipi di evento del contratto, i cinque «assegnata» e la menzione'],
    'che cosa ne dice il contratto' => ['punto', 'Anche lei è nel contratto dal 12/10/2026: `app` `pm`, nei `dati` l\'`id` della scheda e `commento_id`, l\'id del commento, mai il testo, e `risorsa_nome` è il titolo della scheda'],
    'dove si apre' => ['punto', 'Dalla `v1.16.0` una menzione in un commento apre la scheda del commento, allo stesso indirizzo: l\'id è quello della scheda, e `commento_id` non entra nell\'indirizzo, perché Project Management non ha una pagina che porti dritto a un commento'],
    'i tipi con una destinazione' => ['punto', 'non hanno una destinazione; dalla `v1.16.0` ne ha una anche una menzione in un commento'],
    'la riga del registro' => ['readme', 'Dalla `v1.16.0` c\'è la quarta, una menzione in un commento (`board.commento.menzione`), con `/c/{id}` anche lei: l\'id è quello della scheda, e `commento_id`, che i `dati` portano, non è nel percorso'],
]);

it('`MODULO-NUOVO.md` porta la menzione in un commento accanto alla scheda assegnata: il tipo, la versione, il titolo e la pagina della scheda (sprint 26 · T6.3)', function () {
    $guida = suUnaRiga((string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md'));

    expect(substr_count($guida, 'Lo stesso per quella a chi viene menzionato in un commento (`board.commento.menzione`, dalla `v1.16.0`): il titolo, «Ti hanno menzionato in un commento», e la pagina della scheda, `/c/{id}`, perché un commento non ha una pagina sua'))->toBe(1);
});

it('il README non dice più che il contratto non elenca la notifica a chi viene assegnata una scheda: dal 12/10/2026 la elenca (sprint 24 · T5)', function () {
    $frase = 'non la elenca ancora';

    expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')), $frase))->toBe(false)
        // Il controllo vede ciò che cerca: la frase, a capo com'era nel README, su una riga è quella.
        ->and(str_contains(suUnaRiga(str_replace(' ', "\n", $frase)), $frase))->toBe(true);
});

it('il README non dice più che i titoli sono 40, né che sono 41, 42, 44, 45, 47 o 48, né che le schede non hanno una destinazione, e `MODULO-NUOVO.md` porta la scheda assegnata come esempio di una notifica che non è un evento, col titolo e la pagina (sprint 24 · T3.5; sprint 26 · T6.3; sprint 36 · T5.4; v2.25.3; v2.25.4; v3.5.0)', function () {
    $readme = suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md'));
    $guida = suUnaRiga((string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md'));

    expect(substr_count($readme, 'i titoli sono 40'))->toBe(0)
        ->and(substr_count($readme, 'i titoli erano 40'))->toBe(1)
        ->and(substr_count($readme, 'i titoli sono 41'))->toBe(0)
        ->and(substr_count($readme, 'i titoli erano 41'))->toBe(1)
        ->and(substr_count($readme, 'i titoli sono 42'))->toBe(0)
        ->and(substr_count($readme, 'i titoli erano 42'))->toBe(1)
        ->and(substr_count($readme, 'i titoli sono 44'))->toBe(0)
        ->and(substr_count($readme, 'i titoli erano 44'))->toBe(1)
        ->and(substr_count($readme, 'i titoli sono 45'))->toBe(0)
        ->and(substr_count($readme, 'i titoli erano 45'))->toBe(1)
        ->and(substr_count($readme, 'i titoli sono 47'))->toBe(0)
        ->and(substr_count($readme, 'i titoli erano 47'))->toBe(1)
        ->and(substr_count($readme, 'i titoli sono 48'))->toBe(0)
        ->and(substr_count($readme, 'i titoli erano 48'))->toBe(1)
        ->and(substr_count($readme, 'i titoli sono 49'))->toBe(0)
        ->and(substr_count($readme, 'i titoli erano 49'))->toBe(1)
        ->and(substr_count($readme, 'i titoli sono 56'))->toBe(0)
        ->and(substr_count($readme, 'i titoli erano 56'))->toBe(1)
        ->and(substr_count($readme, 'i titoli sono 58'))->toBe(1)
        ->and(substr_count($readme, 'le schede non hanno una destinazione'))->toBe(0)
        ->and(substr_count($readme, 'diciotto tipi del CRM'))->toBe(1)
        ->and(substr_count($guida, 'Vale anche per una notifica che non è un evento: per quella a chi viene assegnata una scheda (`board.scheda.assegnata`, dalla `v1.14.0`) zr-board ha dato il titolo, «Ti è stata assegnata una scheda», e la pagina, `/c/{id}`'))->toBe(1);
});

it('il README non dice più ciò che la review della PR #51 ha trovato falso: che una nota apriva sempre il contatto, e che gli `ids` sono gli id che il percorso del registro chiede per il tipo (review della PR #51, R2 e R10)', function () {
    $readme = suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md'));

    expect(substr_count($readme, 'apriva sempre il contatto'))->toBe(0)
        ->and(substr_count($readme, 'i soli id che il percorso del registro chiede per il tipo della notifica'))->toBe(0)
        ->and(substr_count($readme, '`{"persona_id": "…"}` per una nota)'))->toBe(0);
});

// Sprint 22 · T6 (voce #1726): con due schede su due workspace la ricerca è di quello della sessione, e la risposta lo dice
// (`workspace`): un risultato si apre lì, e senza `workspace` la ricerca è un errore. Le non lette di un elenco di un altro
// workspace non contano sulla campanella della pagina. Il README lo dice nella riga della rotta, nel punto «La ricerca» (dove
// si apre un risultato, l'errore, che cosa cambia nei test di un frontend) e nel punto «La campanella».

it('il README dice che dalla v1.12.0 la ricerca porta il suo workspace e che un risultato si apre lì, che senza `workspace` è un errore, che cosa cambia nei test di un frontend, e che le non lette di un elenco di un altro workspace non contano sulla campanella (sprint 22 · T6.7)', function (string $dove, string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $testi = [
        'rotta' => rigaDellaRotta($readme, 'POST /cornice/ricerca'),
        'ricerca' => puntoDellaCornice($readme, 'La ricerca'),
        'campanella' => suUnaRiga(puntoDellaCampanella($readme)),
    ];

    expect($testi[$dove])->not->toBe('')
        ->and(str_contains($testi[$dove], $frase))->toBe(true);
})->with([
    'la chiave nella riga della rotta' => ['rotta', '| `{data: [{tipo, id, titolo, contesto}], workspace, persona}`:'],
    'che cos\'è, e da quando' => ['rotta', 'dalla `v1.12.0` `workspace` è lo slug del workspace della sessione, quello col cui gettone la ricerca è fatta: lo dice la parte server, e non segue niente di ciò che manda il browser'],
    'la cornice apre lì' => ['rotta', 'è lì che la cornice apre un risultato, e una risposta senza `workspace` per lei è un errore della ricerca'],
    'dove si apre un risultato' => ['ricerca', 'Dalla `v1.12.0` lo `<slug>` è quello che la risposta dice (`workspace`), che non è sempre quello dei dati della pagina'],
    'perché' => ['ricerca', 'con due schede su due workspace la scheda rimasta indietro cerca in quello in cui la persona è entrata per ultimo'],
    'senza workspace è un errore' => ['ricerca', 'Una risposta senza `workspace`, o con un `workspace` che non è un testo o è vuoto, è un errore della ricerca'],
    'nessun ripiego' => ['ricerca', 'la cornice non ripiega sul workspace della pagina'],
    'la risposta finta di un frontend' => ['ricerca', 'Così risponde anche una parte server finta, nei test di un frontend, che dà i risultati senza `workspace`: le si aggiunge `workspace`, con lo slug dei dati della pagina'],
    'dove cercare' => ['ricerca', 'si trovano cercando `cornice/ricerca` nei test del frontend'],
    'le non lette di un altro workspace' => ['campanella', 'Dalla `v1.12.0` le non lette di un elenco contano solo se l\'elenco è del workspace dei dati della pagina, o se la parte server non dice di quale workspace è'],
    'che cosa mostra allora la campanella' => ['campanella', 'le sue non lette non sono quelle della pagina, e la campanella mostra il numero dei dati'],
]);

it('il README non dice più che un risultato della ricerca si apre nel workspace senza dire quale, né che la risposta porta solo i risultati (sprint 22 · T6.7)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $punto = puntoDellaCornice($readme, 'La ricerca');
    $rotta = rigaDellaRotta($readme, 'POST /cornice/ricerca');

    expect($punto)->not->toBe('')
        ->and($rotta)->not->toBe('')
        // Di prima: «nel workspace», che era quello dei dati della pagina.
        ->and(str_contains($punto, 'apre l\'indirizzo del suo prodotto nel workspace seguito dal percorso del tipo'))->toBe(false)
        ->and(str_contains($rotta, '| `{data: [{tipo, id, titolo}]}`:'))->toBe(false);
});

// Sprint 22 · T7 (voce #1727): un frontend che le notifiche le legge da sé dal backoffice ha gli `ids` da un metodo PHP
// pubblico, `NotificheDellaCornice::idsDellaNotifica()`. Il README lo dice accanto a `destinazioneDellaNotifica`, nello stesso
// paragrafo: la firma, che cosa dà, `[]` senza una destinazione, e che i `dati` interi restano sul server del frontend.

it('il README dice, accanto a `destinazioneDellaNotifica`, il metodo PHP che dà gli `ids` di una notifica a chi la legge da sé: la firma e da quando, che cosa dà, `[]` senza una destinazione, e che i `dati` interi restano sul server del frontend (sprint 22 · T7.3)', function (string $frase) {
    $paragrafo = paragrafoFuoriDallaCornice((string) file_get_contents(__DIR__.'/../../README.md'));

    expect($paragrafo)->not->toBe('')
        ->and(str_contains($paragrafo, $frase))->toBe(true)
        // Accanto: nello stesso paragrafo, dopo la funzione del browser a cui quegli `ids` si danno.
        ->and(strpos($paragrafo, '`destinazioneDellaNotifica(notifica, slug, prodotti)`'))->toBeLessThan((int) strpos($paragrafo, '::idsDellaNotifica('));
})->with([
    'chi, e che cosa gli manca' => ['Chi le notifiche le legge da sé dal backoffice, sul suo server — una pagina delle notifiche sua —, gli `ids` non li ha'],
    'la firma, e da quando' => ['dalla `v1.12.0` li dà un metodo PHP pubblico e statico, `Zeiras\Core\Http\NotificheDellaCornice::idsDellaNotifica(?string $app, string $tipo, mixed $dati): array`'],
    'la regola dell\'elenco' => ['ed è la regola con cui li dà `GET /cornice/notifiche`, non una copia'],
    'gli argomenti' => ['`app`, `tipo` e `dati` sono quelli della notifica, com\'è nella risposta del backoffice, e `dati` è un array di PHP con le sue chiavi'],
    'che cosa dà' => ['il metodo dà gli id per chiave (`[\'persona_id\' => \'<id>\']` per una nota legata al solo contatto), da dare al browser come `ids` della notifica'],
    'vuoto senza una destinazione' => ['Dà `[]`, senza eccezioni, quando la notifica non ha una destinazione — un tipo o un\'app che il registro non ha, nessuna app, una voce «Presto» — e quando `dati` manca o non è un array con le chiavi'],
    'un id che manca, o fuori dalla forma' => ['un id che manca, o che non ha la forma di un id (lettere, cifre, `-` e `_`, da 1 a 64), nell\'array non c\'è'],
    'che cosa fa allora il browser' => ['Senza gli id di nessuno dei percorsi del tipo `destinazioneDellaNotifica` non dà niente, e si apre la pagina delle notifiche'],
    'i dati interi restano sul server' => ['Al browser vanno questi `ids` e non `dati`: i `dati` interi di una notifica restano sul server del frontend'],
    'è un contratto' => ['Nome e firma del metodo sono un contratto, e cambiano solo con una versione maggiore'],
]);

// Sprint 22 · T8 (voce #1728), riscritto nello sprint 25 · T4 (voce #1639) e nello sprint 27 · T7 (voce #1810): l'invito della
// ricerca dice le fonti del workspace, e il segnaposto è uno solo. Il README lo dice nel punto «La ricerca» — come si compone
// l'invito, i testi nelle tre lingue con Project Management attivo, quelli senza fonti, quelli fissi di prima e come un
// frontend li trova nei suoi test —, e nel punto «Il menu Moduli» l'aiuto della `v1.10.2` non è più quello di oggi.

it('il README dice che dalla v1.17.0 il segnaposto della ricerca è uno solo e che l\'invito dice le fonti del workspace: nel punto «La ricerca» come si compone, i testi nelle tre lingue, quelli senza fonti, quelli fissi di prima e come trovarli nei test di un frontend; nel punto «Il menu Moduli» l\'aiuto di allora col rimando (sprint 22 · T8.1, T8.2; sprint 25 · T4.6)', function (string $dove, string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $testi = ['ricerca' => puntoDellaCornice($readme, 'La ricerca'), 'menu' => puntoDellaCornice($readme, 'Il menu Moduli')];

    expect($testi[$dove])->not->toBe('')
        ->and(str_contains($testi[$dove], $frase))->toBe(true);
})->with([
    'da quando, e che cosa dicono' => ['ricerca', 'Dalla `v1.15.0` l\'invito dice le fonti della ricerca nel workspace: i tipi di risorsa dei moduli che lì sono `attivo`, nell\'ordine del registro'],
    // Sprint 27 · T7 (voce #1810): dalla `v1.17.0` il segnaposto è uno solo, uguale in ogni workspace e in ogni modulo, e non
    // nomina le fonti: le dice l'invito.
    'il segnaposto unico' => ['ricerca', 'Dalla `v1.17.0` il segnaposto del campo è uno solo, uguale in ogni workspace e in ogni modulo: «Cerca nel workspace…» (in inglese «Search the workspace…», in spagnolo «Busca en el workspace…»)'],
    'chi dice le fonti' => ['ricerca', 'Non nomina le fonti: che cosa si può cercare lo dice l\'invito che si legge prima di due caratteri'],
    'quante ne nominano' => ['ricerca', 'L\'invito le nomina tutte, unite come la lingua unisce un elenco (`Intl.ListFormat`)'],
    // Sprint 27 · T3: dalla `v1.17.0` i membri del workspace sono una fonte, nominata per ultima: l'invito finisce con loro, e i
    // due testi senza fonti non sono più quelli di un workspace senza moduli attivi.
    'l\'invito in italiano' => ['ricerca', 'Con Project Management attivo e il CRM no: «Cerca schede, board, aree e membri: scrivi almeno 2 caratteri.»'],
    'in inglese' => ['ricerca', 'in inglese «Search cards, boards, areas, and members: type at least 2 characters.»'],
    'in spagnolo' => ['ricerca', 'in spagnolo «Busca tarjetas, tableros, áreas y miembros: escribe al menos 2 caracteres.»'],
    'chi non dà fonti' => ['ricerca', 'Un modulo `disponibile` o in arrivo non dà fonti'],
    'senza fonti' => ['ricerca', 'I due testi senza fonti sono «Cerca…» (in inglese «Search…», in spagnolo «Busca…») e «Scrivi almeno 2 caratteri.» («Type at least 2 characters.», «Escribe al menos 2 caracteres.»)'],
    // Sprint 26 · T5.2 (lettura della PR #56, R9): l'elenco lo scrive il browser, e che cosa si legge dove non lo sa scrivere.
    // Lettura della PR #59, R1: vale per un browser che ha il resto di ciò che i sorgenti usano; dove manca anche quello, no.
    'dove il browser non ha l\'elenco' => ['ricerca', 'L\'elenco delle fonti vuole `Intl.ListFormat` nel browser: dove manca, in un browser che ha il resto di ciò che i sorgenti usano — la libreria ES2022 (`Array.prototype.at`, `Object.hasOwn`) e `Intl.RelativeTimeFormat` —, dalla `v1.16.0` la cornice si disegna lo stesso e l\'invito è quello senza fonti, quante che siano le fonti'],
    'il segnaposto dove il browser non ha l\'elenco' => ['ricerca', 'dalla `v1.17.0` il segnaposto lì è quello unico, come ovunque (nella `v1.16.0` era «Cerca…»)'],
    'e dove manca anche il resto' => ['ricerca', 'Dove manca anche il resto la cornice non si disegna, nella `v1.16.0` come prima: a un browser così lo aggiunge il frontend'],
    'e nella versione di prima' => ['ricerca', 'nella `v1.15.0`, con almeno una fonte, lì il disegno della cornice lanciava un errore'],
    'le chiavi delle lingue' => ['ricerca', '`searchHintSources` ha il posto dell\'elenco, `{sources}`; `searchPlaceholderSources` è il segnaposto unico e dalla `v1.17.0` non lo ha più (la chiave resta); `searchPlaceholder` e `searchHint` sono quelli senza fonti'],
    'i testi fissi di prima' => ['ricerca', 'Dalla `v1.12.0` alla `v1.14.0` i due testi erano fissi: «Cerca board e cartelle…» e «Cerca board e cartelle: scrivi almeno 2 caratteri.»'],
    'e quelli di prima ancora' => ['ricerca', 'prima ancora «Cerca progetti, schede, contatti…» e «Cerca in tutti i moduli: scrivi almeno 2 caratteri.»'],
    'come trovarli nei test di un frontend' => ['ricerca', 'Un frontend che li ha nei suoi test li trova cercando `board e cartelle` (in inglese `boards and folders`, in spagnolo `tableros y carpetas`), e quelli di prima cercando `Cerca progetti` e `tutti i moduli` (in inglese `Search projects` e `across all modules`, in spagnolo `Busca proyectos` e `todos los módulos`)'],
    'l\'aiuto della v1.10.2 non è più quello di oggi' => ['menu', 'l\'aiuto della ricerca, allora «Cerca in tutti i moduli: scrivi almeno 2 caratteri.» (prima «Cerca in tutti i prodotti: scrivi almeno 2 caratteri.»; dalla `v1.12.0` dice altro: vedi «La ricerca»)'],
]);

// Sprint 27 · T7 (voce #1810): dalla `v1.17.0` il segnaposto è uno solo e non nomina le fonti. Che una volta le nominava il
// README lo dice al passato, per chi aggiorna: le frasi che lo dicevano al presente non ci sono più, e nemmeno il segnaposto di
// un workspace senza moduli, che non è uscito in nessuna versione.
it('il README non dice più, al presente, che il segnaposto della ricerca nomina le fonti (sprint 27 · T7.4)', function (string $diPrima) {
    $ricerca = puntoDellaCornice((string) file_get_contents(__DIR__.'/../../README.md'), 'La ricerca');

    expect($ricerca)->not->toBe('')
        ->and(str_contains($ricerca, $diPrima))->toBe(false);
})->with([
    'resta alle prime tre' => ['il segnaposto resta alle prime tre'],
    'ne nomina al più tre' => ['Il segnaposto ne nomina al più tre'],
    'i due testi dicono le fonti' => ['il segnaposto del campo e l\'invito che si legge prima di due caratteri dicono le fonti'],
    'il segnaposto di un workspace senza moduli' => ['«Cerca membri…»'],
    'il segnaposto con le fonti, in inglese' => ['«Search cards, boards, folders…» e'],
    'segnaposto e invito dove manca l\'elenco' => ['segnaposto e invito sono questi due'],
]);

// Sprint 28 · T5.3 (seconda lettura della PR #60, S5). La guida diceva che il nome da elenco di un tipo lo nominano il segnaposto
// e l'invito: dalla `v1.17.0` lo nomina il solo invito, e il passo «9. La ricerca» non ha più la frase di prima. La guardia guarda
// quel passo, non tutta la guida. Il suo limite è quello di ogni guardia «non dice più», anche di quella del README qui sopra:
// cerca le parole di prima, e una frase che dice lo stesso con altre parole non la vede. Quella la ferma chi rilegge.
it('il passo «9. La ricerca» della guida non dice più che il segnaposto della ricerca nomina i tipi di un modulo (sprint 28 · T5.3)', function (string $diPrima) {
    $passo = suUnaRiga(passoDellaGuida((string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md'), PASSO_DELLA_RICERCA));

    expect($passo)->not->toBe('')
        ->and(str_contains($passo, $diPrima))->toBe(false);
})->with([
    'lo nominano tutti e due' => ['che il segnaposto e l\'invito della ricerca nominano'],
]);

// Sprint 28 · T5.6 (voce #1829; `Decisione:` 11283 di zr-pm). Il CSS del design system sta fuori dai layer della cascata, e vince
// su ogni classe di utilità di Tailwind, che sta in un layer: il README lo dice dove fa importare `bundle.css`, e dice che cosa
// fa una pagina — non ritocca con una classe ciò che un componente già dà, e l'aspetto che manca lo chiede a zr-core. Non dice
// mai di cambiare la cascata.

/** Il capoverso «Il CSS» del README su una riga sola, da «**Il CSS**» a «**Il JS**», coi due `@import`. Vuoto se non c'è. */
function capoversoDelCss(string $readme): string
{
    preg_match('/^\*\*Il CSS\*\*.*?(?=^\*\*Il JS\*\*)/ms', $readme, $capoverso);

    return suUnaRiga($capoverso[0] ?? '');
}

it('il README dice, dove fa importare `bundle.css`, che il CSS del design system sta fuori dai layer e vince sulle classi di utilità di Tailwind, e che cosa fa una pagina (sprint 28 · T5.6)', function (string $frase) {
    $css = capoversoDelCss((string) file_get_contents(__DIR__.'/../../README.md'));

    expect($css)->not->toBe('')
        ->and(str_contains($css, $frase))->toBe(true);
})->with([
    'fuori dai layer' => ['Il CSS del design system sta fuori dai layer della cascata.'],
    // Lettura della PR #61, R11: vince dove le utilità stanno in un layer, e il README dice quale Tailwind.
    'con quale Tailwind vince' => ['Con Tailwind 4, che mette le sue classi di utilità in un layer, vince su ognuna di loro'],
    'che cosa non fa una pagina' => ['una pagina non ritocca con una classe una proprietà che un componente già dà'],
    'per che cosa vale' => ['Vale per le proprietà che il componente dichiara e per una classe senza il modificatore che forza (`!`)'],
    'con Tailwind 3' => ['con Tailwind 3, che non usa i layer della cascata, decidono specificità e ordine'],
    'a chi si chiede' => ['In ogni caso un aspetto che il componente non ha non si ottiene con una classe sopra: lo si chiede all\'agente di zr-core'],
    'i due `@import` restano lì' => ['@import \'../../vendor/zeiras/zr-core/resources/zeiras/bundle.css\'; @import \'../../vendor/zeiras/zr-core/resources/css/zeiras-token.css\';'],
]);

it('il capoverso «Il CSS» del README non dice di cambiare la cascata né di forzare una proprietà (sprint 28 · T5.6)', function (string $vietata) {
    $css = capoversoDelCss((string) file_get_contents(__DIR__.'/../../README.md'));

    expect($css)->not->toBe('')
        ->and(str_contains($css, $vietata))->toBe(false);
})->with([
    'forzare una proprietà' => ['!important'],
    'un layer per il design system, nell\'`@import`' => ['layer('],
    'un layer dichiarato' => ['@layer'],
    // Lettura della PR #61, R11: non vince su «ogni» classe di qualunque Tailwind.
    'vince sempre' => ['per questo vince su ogni classe di utilità di Tailwind'],
]);

// Sprint 75 · T1.4 (voce #2570; revisione della PR #134, rilievi 1 e 4): il README dice le due strade del CSS, e chi resta su
// `bundle.css`. Con `zeiras.css` un campo preso da `componenti` resterebbe senza stili; con `bundle.css` i due campi si prendono
// dallo stesso posto, perché gli stili che un modulo porta arrivano dopo il bundle.
// Sprint 74 (zr-pm-07, 26/10): chi passa alla v3.6 da una versione 3 di prima (Bookings dalla 3.2.1) trova, versione per
// versione, che cosa cambia, che cosa si tocca e che cosa si controlla; e lo script UAT della cornice.
// v3.8.1 (zr-pm-07, 26/10 sera): la sezione arriva alla v3.8.1, con una colonna per ciò che cambia nei test del modulo, così
// zr-home, zr-board, zr-crm e zr-bookings aggiornano in un colpo solo.
it('il README dice, in «Passare alla v3.8», versione per versione che cosa cambia, che cosa si tocca, che cosa cambia nei test del modulo e che cosa si controlla, e lo script UAT della cornice (sprint 74; v3.8.1)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    preg_match('/^### Passare alla v3\.8$(.*?)(?=^#{2,3} |\z)/ms', $readme, $passaggio);

    expect(str_contains(suUnaRiga($passaggio[1] ?? ''), $frase))->toBe(true);
})->with([
    'le colonne' => ['| Versione | Che cosa cambia | Che cosa si tocca | Che cosa cambia nei test del modulo | Che cosa si controlla |'],
    'la v3.2.2' => ['| `v3.2.2` |'],
    'la v3.2.3' => ['| `v3.2.3` |'],
    'la v3.3.0' => ['| `v3.3.0` |'],
    'la v3.4.0' => ['| `v3.4.0` |'],
    'la v3.5.0' => ['| `v3.5.0` |'],
    'la v3.6.0, che cosa si tocca' => ['`createLabel` dal layout o con `useCornice`, se il «+» ha un nome suo; **non navigate da `onCrumb`**: la visita partirebbe due volte'],
    'la v3.6.1' => ['| `v3.6.1` |'],
    'la v3.7.0' => ['| `v3.7.0` |'],
    'la v3.8.0, nei test' => ['un caso che preme Tab come primo tasto del file, dovunque sia (dalla `v3.8.1` solo con un dialogo aperto), o Esc nel pannello della ricerca, e guarda subito dove è il fuoco lo aspetta (`await act(() => vi.dynamicImportSettled())` dopo il tasto)'],
    'la v3.8.1, nei test' => ['Un caso che si aspettava il contrario va riletto'],
    'la v3.11.0' => ['| `v3.11.0` |'],
    'la v3.11.1' => ['| `v3.11.1` |'],
    'la v3.12.0' => ['| `v3.12.0` |'],
    'la v3.12.0, nei test' => ['un caso che col cassetto aperto dà Esc in un dialogo, o in un campo che lo gestisce, e si aspetta il cassetto chiuso va riletto'],
    'più versioni in un colpo' => ['un modulo indietro di più versioni le fa tutte in un colpo solo: le righe si sommano'],
    'lo script' => ['Lo script UAT della cornice sta nel repo, non nello zip: si prende dal tag e si lancia su una pagina vera del modulo'],
]);

// Sprint 74 (dalla UAT in Chromium, zr-pm-07 26/10): Esc dal pannello della ricerca, e dove va il fuoco.
it('il README dice che Esc col fuoco nel pannello della ricerca la chiude come dal campo, e che il fuoco va al campo (sprint 74; sprint 78 · T2, voce 2800)', function () {
    expect(substr_count(suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')), 'Esc col fuoco nel pannello chiude la ricerca come dal campo (l\'`AppShell` lo fa solo dal campo), e il fuoco va al campo (dalla `v3.10.0`: prima andava al documento).'))->toBe(1);
});

it('il README dice chi passa a `zeiras.css` e chi resta su `bundle.css`, e lo dice anche in «Passare alla v3.3» (sprint 75 · T1.4)', function (string $dove, string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    preg_match('/^### Passare alla v3\.3$(.*?)(?=^#{2,3} |\z)/ms', $readme, $passaggio);
    $testo = $dove === 'Il CSS' ? capoversoDelCss($readme) : suUnaRiga($passaggio[1] ?? '');

    expect($testo)->not->toBe('')
        ->and(str_contains($testo, $frase))->toBe(true);
})->with([
    'le due strade' => ['Il CSS', '@import \'../../vendor/zeiras/zr-core/resources/css/zeiras.css\'; @import \'../../vendor/zeiras/zr-core/resources/css/zeiras-token.css\';'],
    'per chi è zeiras.css' => ['Il CSS', 'È per chi prende quei due campi **solo** dai loro moduli'],
    'chi resta su bundle.css' => ['Il CSS', 'Chi prende MentionField o AddressField da `…/zeiras/componenti` o da `window.Zeiras` resta su `bundle.css`'],
    'perché' => ['Il CSS', 'quel campo resterebbe senza stili'],
    'dallo stesso posto' => ['Il CSS', 'Con `bundle.css` i due campi si prendono dallo stesso posto'],
    'nessuno deve cambiare' => ['Passare alla v3.3', 'Nessun frontend deve cambiare niente: `bundle.css` resta com\'era.'],
    'la riga che cambia' => ['Passare alla v3.3', '+@import \'../../vendor/zeiras/zr-core/resources/css/zeiras.css\';'],
    'chi non lo fa' => ['Passare alla v3.3', 'Chi prende anche uno solo dei due campi da `…/zeiras/componenti` o da `window.Zeiras` non lo fa'],
    'il caso misto' => ['Passare alla v3.3', 'Chi è in questo caso prende anche AddressField dal suo modulo, o MentionField da `componenti`'],
]);

// Seconda lettura della PR #60, S1: i frammenti che il punto dà da cercare — `e opportunità:`, `boards and folders` — si copiano
// dal file. Uno spezzato da un a capo si copia in due pezzi, e nei test di un frontend non trova niente: ogni riga del punto
// chiude gli accenti che apre.
it('nel punto «La ricerca» del README nessun frammento fra accenti è spezzato da un a capo (sprint 27 · T6)', function () {
    $righe = explode("\n", puntoDellaCorniceNelFile((string) file_get_contents(__DIR__.'/../../README.md'), 'La ricerca'));
    $spezzate = array_values(array_filter($righe, fn (string $riga): bool => substr_count($riga, '`') % 2 === 1));

    expect(count($righe))->toBeGreaterThan(1)
        ->and($spezzate)->toBe([]);
});

// Sprint 25 · T4 (voce #1639): la ricerca mostra anche schede, contatti, aziende e opportunità, con la seconda riga. Il README
// dice i tipi, i gruppi, la seconda riga e dove si apre ognuno; la guida dice che cosa chiedere perché la ricerca trovi le
// risorse di un modulo nuovo. Nessuno dei due dice più che la ricerca trova solo board e cartelle.

it('il README dice i sei tipi che la ricerca mostra dalla v1.15.0, i gruppi, la seconda riga e dove si apre ognuno; la guida dice come un modulo aggiunge un suo tipo (sprint 25 · T4.6)', function (string $dove, string $frase) {
    $testi = [
        'ricerca' => puntoDellaCornice((string) file_get_contents(__DIR__.'/../../README.md'), 'La ricerca'),
        'guida' => suUnaRiga((string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md')),
        // Sprint 28 · T5.3 (seconda lettura della PR #60, S5): la frase su chi nomina il nome da elenco si cerca nel suo passo.
        'passo 9' => suUnaRiga(passoDellaGuida((string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md'), PASSO_DELLA_RICERCA)),
    ];

    expect($testi[$dove])->not->toBe('')
        ->and(str_contains($testi[$dove], $frase))->toBe(true);
})->with([
    'i sei tipi' => ['ricerca', 'Dalla `v1.15.0` la cornice mostra sei tipi: di Project Management le schede (`board.scheda`), le board (`board.board`) e le aree (`board.cartelle`); del CRM i contatti (`crm.persona`), le aziende (`crm.organizzazione`) e le opportunità (`crm.trattativa`)'],
    'i gruppi e il loro ordine' => ['ricerca', 'col nome del tipo nella lingua (Schede, Board, Aree, Contatti, Aziende, Opportunità), il nome e il tono del prodotto e l\'icona del tipo; i gruppi escono nell\'ordine del backoffice, quello del primo risultato di ognuno'],
    'la seconda riga' => ['ricerca', 'Sotto il titolo sta la seconda riga: i testi di `contesto` che il registro dice per quel tipo, uniti da « · » — board e lista di una scheda, azienda e ruolo di un contatto, pipeline e fase di un\'opportunità —, solo quelli che ci sono'],
    'chi non ha la seconda riga' => ['ricerca', 'un\'azienda, una board e un\'area non hanno una seconda riga'],
    'dove si aprono' => ['ricerca', 'una scheda su `https://board.zeiras.com/w/<slug>/c/<id>`, un contatto su `https://crm.zeiras.com/w/<slug>/contatti/<id>`, un\'azienda su `https://crm.zeiras.com/w/<slug>/aziende/<id>`, un\'opportunità su `https://crm.zeiras.com/w/<slug>/opportunita/<id>`'],
    'una pagina spenta del CRM' => ['ricerca', 'se è spenta la pagina di quel risultato risponde 404, ed è una risposta del CRM'],
    'i test di un frontend: anche i due testi' => ['ricerca', 'Cambiano anche il segnaposto e l\'invito del campo, che non sono più i due testi fissi di prima (più sotto)'],
    'la guida: che cosa trova' => ['guida', 'Dalla `v1.15.0` la ricerca trova schede, board e aree di Project Management e contatti, aziende e opportunità del CRM'],
    'la guida: chi nomina il nome da elenco' => ['passo 9', 'quello da elenco, minuscolo, che l\'invito della ricerca nomina dove il tuo modulo è attivo (il segnaposto del campo è uno solo in ogni modulo, e non nomina i tipi)'],
    'la guida: che cosa chiedere a zr-core' => ['guida', 'le chiavi di `contesto` che fanno la seconda riga del risultato) e due nomi in ogni lingua: quello del suo gruppo, e quello da elenco, minuscolo'],
    'la guida: che cosa chiedere a zr-backoffice' => ['guida', 'che la sua ricerca (`ricerca.crea`, `POST /v1/ricerca`) dia quel tipo'],
]);

it('né il README né la guida dicono più che la ricerca trova solo board e cartelle (sprint 25 · T4.6)', function (string $file, string $frase) {
    $testo = suUnaRiga((string) file_get_contents(__DIR__.'/../../'.$file));

    expect($testo)->not->toBe('')
        ->and(str_contains($testo, $frase))->toBe(false);
})->with([
    'README: le fonti di oggi' => ['README.md', 'oggi board e cartelle, di Project Management'],
    'README: i due testi di oggi' => ['README.md', 'dicono ciò che la ricerca trova oggi, board e cartelle'],
    'la guida' => ['MODULO-NUOVO.md', 'trova solo board e cartelle'],
]);

// Sprint 27 · T3 (voce #1787): dalla `v1.17.0` la ricerca trova anche i membri del workspace. Il README lo dice nel punto «La
// ricerca» — che cosa sono, il gruppo, il ruolo nella lingua e mai l'email, dove si apre, la fonte nominata per ultima, i due
// testi senza moduli attivi e l'invito di prima —, nella riga della rotta e nel capoverso delle risorse del registro (`home`
// ha una risorsa, `codici`, i testi nuovi delle lingue), che sta in coda al paragrafo «Fuori dalla cornice», dove il README dice
// il registro: i due capoversi dopo, quello dei due sì o no e quello del tono, restano attaccati a lui. La guida dice `codici`
// nel passo del registro, e non altrove.

/**
 * Il capoverso del README sulle risorse del registro, su una riga sola: dalla riga che comincia con «Nel registro stanno anche
 * le risorse» alla riga vuota. È la coda del paragrafo «Fuori dalla cornice», senza una riga vuota davanti. Vuoto se non c'è.
 */
function capoversoDelleRisorse(string $readme): string
{
    preg_match('/^Nel registro stanno anche le risorse .*?(?=^$|\z)/ms', $readme, $capoverso);

    return suUnaRiga($capoverso[0] ?? '');
}

it('il README dice che dalla v1.17.0 la ricerca trova anche i membri del workspace: nel punto «La ricerca» che cosa sono, il gruppo, il ruolo nella lingua e mai l\'email, dove si apre un membro, la fonte nominata per ultima, i testi senza moduli attivi e l\'invito di prima; nella riga della rotta il tipo e il solo ruolo; nel capoverso delle risorse la voce `home`, `codici` e i testi nuovi delle lingue (sprint 27 · T3.1)', function (string $dove, string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $testi = [
        'ricerca' => puntoDellaCornice($readme, 'La ricerca'),
        'rotta' => rigaDellaRotta($readme, 'POST /cornice/ricerca'),
        'registro' => capoversoDelleRisorse($readme),
    ];

    expect($testi[$dove])->not->toBe('')
        ->and(str_contains($testi[$dove], $frase))->toBe(true)
        // Il capoverso delle risorse chiude il paragrafo che dice il registro: non è un paragrafo a sé, messo fra quello e i due dopo.
        ->and(str_ends_with(paragrafoFuoriDallaCornice($readme), $testi['registro']))->toBe(true);
})->with([
    'che cosa sono, e da quando' => ['ricerca', 'Dalla `v1.17.0` la ricerca trova anche i membri del workspace (`workspace.membro`): non sono di un modulo, il backoffice li cerca in ogni workspace, anche senza moduli attivi, e nel registro stanno nella voce `home`'],
    'il gruppo' => ['ricerca', 'Il gruppo dei membri è «Membri» (in inglese «Members», in spagnolo «Miembros»), con l\'icona del tipo; la voce `home` non è un prodotto, e un membro non ha a destra il nome di un prodotto, né un tono'],
    'il ruolo, nella lingua' => ['ricerca', 'Sotto il nome di un membro sta il suo ruolo, nella lingua della persona'],
    'mai il codice' => ['ricerca', 'e la cornice mostra il testo che quel codice ha nella lingua, mai il codice; con un codice che il registro non ha la riga ha solo il nome'],
    'mai l\'email' => ['ricerca', 'L\'email di un membro non esce mai: il backoffice non la dà, e di `contesto` la parte server lascia passare il solo `ruolo`'],
    'dove si apre' => ['ricerca', 'Dalla `v1.17.0` un membro si apre su `https://app.zeiras.com/w/<slug>/impostazioni/membri/<id>`, in Impostazioni › Membri'],
    'la fonte, per ultima' => ['ricerca', 'Dalla `v1.17.0` dopo di loro vengono i membri del workspace (`searchSource.home.workspace.membro`: «membri»): sono una fonte in ogni workspace, anche senza moduli attivi, e sono nominati per ultimi'],
    'col CRM attivo' => ['ricerca', 'col CRM attivo l\'invito nomina anche contatti, aziende e opportunità, prima dei membri. Un modulo `disponibile` o in arrivo non dà fonti'],
    'senza moduli attivi' => ['ricerca', 'Senza moduli attivi restano i membri: «Cerca membri: scrivi almeno 2 caratteri.» (in inglese «Search members: type at least 2 characters.», in spagnolo «Busca miembros: escribe al menos 2 caracteres.»)'],
    'i due testi di prima' => ['ricerca', 'Dalla `v1.15.0` alla `v1.16.0` anche il segnaposto nominava le fonti, al più tre, e i membri non erano una fonte'],
    'nei test di un frontend: Project Management attivo e il CRM no' => ['ricerca', 'con Project Management attivo e il CRM no il segnaposto era «Cerca schede, board, cartelle…» e l\'invito «Cerca schede, board e cartelle: scrivi almeno 2 caratteri.» (cerca `cartelle…` e `e cartelle:`; in inglese `folders…` e `and folders:`, in spagnolo `carpetas…` e `y carpetas:`)'],
    'nei test di un frontend: tutti e due attivi' => ['ricerca', 'con tutti e due attivi il segnaposto era lo stesso e l\'invito finiva con «contatti, aziende e opportunità: scrivi almeno 2 caratteri.» (cerca `e opportunità:`; in inglese `and opportunities:`, in spagnolo `y oportunidades:`)'],
    // Seconda lettura della PR #60, S1: col solo CRM attivo cambia anche l'invito, che prima finiva con le opportunità.
    'nei test di un frontend: il solo CRM attivo' => ['ricerca', 'col solo CRM attivo il segnaposto era «Cerca contatti, aziende, opportunità…» e l\'invito «Cerca contatti, aziende e opportunità: scrivi almeno 2 caratteri.» (cerca `opportunità…` e `e opportunità:`; in inglese `opportunities…` e `and opportunities:`, in spagnolo `oportunidades…` e `y oportunidades:`)'],
    'nei test di un frontend: nessun modulo attivo' => ['ricerca', 'senza moduli attivi erano i due testi senza fonti, «Cerca…» e «Scrivi almeno 2 caratteri.»'],
    'a chi resta «Cerca…»' => ['ricerca', 'dalla `v1.17.0` «Cerca…» resta a chi non ha accettato i documenti legali, che non ha fonti'],
    'la riga: il tipo, e in quali workspace' => ['rotta', 'le opportunità `crm.trattativa` e i membri del workspace `workspace.membro`, poi le board `board.board` e le aree `board.cartelle` per titolo; la fonte di un modulo c\'è solo se il suo prodotto è attivo nel workspace, i membri ci sono in ogni workspace, e la cornice li mostra dalla `v1.17.0`'],
    'la riga: il solo ruolo' => ['rotta', 'dalla `v1.17.0` di un membro del workspace passa il solo `ruolo`, che è un codice'],
    'la riga: mai l\'email' => ['rotta', 'l\'email di un membro non esce mai'],
    'il registro: le risorse' => ['registro', 'Nel registro stanno anche le risorse che la ricerca mostra: una voce ha in `risorse` una riga per tipo, col tipo com\'è nel backoffice (`board.scheda`), l\'icona, il percorso dopo `/w/<slug>`, se è un contenitore e le chiavi di `contesto` che fanno la seconda riga del risultato'],
    'il registro: la voce home' => ['registro', 'Dalla `v1.17.0` ha una risorsa anche la voce `home`, che non è un modulo: il membro del workspace (`workspace.membro`), col percorso `/impostazioni/membri/{id}` e la chiave `ruolo`'],
    'il registro: che cos\'è codici' => ['registro', 'Dalla stessa versione una risorsa può avere `codici`: le chiavi di `contesto` il cui valore è un codice e non un testo, ognuna coi codici che può avere'],
    'il registro: che cosa si mostra di un codice' => ['registro', 'Di un codice si mostra il testo che ha nella lingua, mai il codice, e un codice che il registro non ha non si mostra; una chiave senza `codici` porta un testo, che dalla `v1.20.0` si mostra pulito come i nomi nelle notifiche, senza i caratteri che cambiano la direzione del testo e coi caratteri di controllo ridotti a uno spazio (il ruolo di un contatto del CRM)'],
    'il registro: la chiave del testo di un codice' => ['registro', 'Il testo di un codice sta nei testi del pezzo della ricerca (`resources/lingue/ricerca/`, dalla `v3.9.0`: prima nelle lingue della cornice) con la chiave `searchContext.<voce>.<tipo>.<chiave>.<codice>`'],
    'il registro: i testi nuovi delle lingue' => ['registro', 'Per il membro le lingue hanno cinque testi nuovi: il nome del gruppo (`home.workspace.membro`: «Membri»), il nome da elenco (`searchSource.home.workspace.membro`: «membri») e i tre ruoli (`searchContext.home.workspace.membro.ruolo.proprietario`, `….amministratore`, `….membro`)'],
]);

it('i codici e i ruoli che il README dice per un membro sono quelli del registro coi testi delle lingue, nell\'ordine del registro: nel punto «La ricerca», nella riga della rotta e nel capoverso delle risorse (sprint 27 · T3.1)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $davanti = 'home.workspace.membro.ruolo.';
    $codici = array_map(fn (string $codice): string => substr($codice, strlen($davanti)), array_values(array_filter(codiciDelContesto(), fn (string $codice): bool => str_starts_with($codice, $davanti))));
    $fraAccenti = implode(', ', array_map(fn (string $codice): string => '`'.$codice.'`', $codici));
    $nella = function (string $lingua) use ($codici, $davanti): string {
        $testi = json_decode((string) file_get_contents(__DIR__.'/../../resources/lingue/ricerca/'.$lingua.'.json'), true, flags: JSON_THROW_ON_ERROR);

        return implode(', ', array_map(fn (string $codice): string => '«'.$testi['searchContext.'.$davanti.$codice].'»', $codici));
    };

    expect($codici)->toHaveCount(3)
        ->and(str_contains(puntoDellaCornice($readme, 'La ricerca'), 'nella lingua della persona: '.$nella('it').' (in inglese '.$nella('en').', in spagnolo '.$nella('es').')'))->toBe(true)
        ->and(str_contains(puntoDellaCornice($readme, 'La ricerca'), 'Il backoffice dà un codice ('.$fraAccenti.')'))->toBe(true)
        ->and(str_contains(rigaDellaRotta($readme, 'POST /cornice/ricerca'), 'che è un codice ('.$fraAccenti.')'))->toBe(true)
        ->and(str_contains(capoversoDelleRisorse($readme), 'per il `ruolo` di un membro '.$fraAccenti))->toBe(true);
});

// Sprint 27 · T3 (voce #1787): dal 12/10/2026 il contratto ha un tipo di evento in più, `com.zeiras.crm.persona.anonimizzata`,
// che non genera notifiche: non ha un titolo, e i titoli restano 42. Il README lo dice nel punto «Le notifiche», e nessuna
// lingua ha quel titolo.

it('il README dice che dal 12/10/2026 il contratto ha 37 tipi di evento, che il trentasettesimo non genera notifiche e non ha un titolo, e che i titoli restavano 42; dalla v2.3.0 ogni lingua ha 44 titoli, e nessuno per quel tipo (sprint 27 · T3.2; sprint 36 · T5.4)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $punto = puntoDelleNotifiche($readme);
    $titoli = [];
    foreach (lingueDellaCornice() as $codice => $testi) {
        $titoli[$codice] = array_values(array_filter(array_keys($testi), fn (string $chiave): bool => str_starts_with($chiave, 'notificationTitle.')));
    }

    expect(str_contains($punto, 'uno per ogni tipo di evento del contratto, tranne uno che il contratto ha dal 12/10/2026 e che non genera notifiche (più sotto)'))->toBe(true)
        ->and(str_contains($punto, 'Dal 12/10/2026 il contratto ha 37 tipi di evento: il trentasettesimo, `com.zeiras.crm.persona.anonimizzata` (un contatto reso anonimo), non genera notifiche e non ha un titolo'))->toBe(true)
        ->and(str_contains($punto, 'I titoli restavano 42: 36 tipi di evento, i cinque «assegnata» e la menzione'))->toBe(true)
        // Quel tipo non cambia il conto: nessuna frase lo porta a 43, né dà un titolo a tutti e 37.
        ->and(substr_count(suUnaRiga($readme), 'i titoli sono 42'))->toBe(0)
        ->and(preg_match('/43 titoli|titoli (?:sono|restano) 43|i 37 tipi di evento (?:del contratto )?hanno un titolo/', suUnaRiga($readme)))->toBe(0)
        ->and(array_keys($titoli))->toBe(['en', 'es', 'it'])
        ->and(array_map('count', $titoli))->toBe(['en' => 58, 'es' => 58, 'it' => 58])
        ->and(array_filter($titoli, fn (array $chiavi): bool => in_array('notificationTitle.com.zeiras.crm.persona.anonimizzata', $chiavi, true)))->toBe([]);
});

// Sprint 36 · T5 (voce #1970): dal 13/10/2026 il contratto ha due tipi di evento in più, i motivi di perdita del CRM creati o
// modificati. Dalla `v2.3.0` hanno un titolo e la frase con solo chi, e nessuna destinazione: i titoli sono 44, e i 42 passano
// al passato. Il README lo dice nel punto «Le notifiche».

it('il README dice, dalla v2.3.0, i due tipi dei motivi di perdita del CRM coi loro titoli, che il contratto ha 39 tipi di evento e i titoli erano 44, e che dalla v2.7.0 aprono le Impostazioni del CRM (sprint 36 · T5.4; sprint 41 · T2.1)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');

    expect(str_contains(puntoDelleNotifiche($readme), $frase))->toBe(true)
        ->and(substr_count(suUnaRiga($readme), 'i titoli erano 44'))->toBe(1)
        ->and(substr_count(suUnaRiga($readme), 'i titoli erano 42'))->toBe(1)
        // Sprint 41 · T2.1: il README non dice più che il CRM non ha ancora detto la pagina.
        ->and(substr_count(suUnaRiga($readme), 'il CRM non ha ancora detto che pagina aprono'))->toBe(0);
})->with([
    'i due tipi e i titoli' => ['Dalla `v2.3.0` hanno un titolo i due tipi di evento che il contratto ha dal 13/10/2026 per i motivi di perdita del CRM: `com.zeiras.crm.motivo.creato`, «Nuovo motivo di perdita», e `com.zeiras.crm.motivo.modificato`, «Motivo di perdita modificato»'],
    // v2.25.3: col credito sotto zero i titoli sono 45, e i 44 passano al passato.
    'quanti erano i titoli' => ['Con loro il contratto ha 39 tipi di evento e i titoli erano 44: 38 tipi di evento, i cinque «assegnata» e la menzione'],
    // Sprint 50 · T6: dal 14/10/2026 il contratto ha un tipo di evento in più, che non genera notifiche.
    'il quarantesimo tipo, senza titolo (sprint 50 · T6)' => ['Dal 14/10/2026 il contratto ha 40 tipi di evento: il quarantesimo, `com.zeiras.crm.campo.modificato` (le impostazioni di un campo del CRM cambiate), non genera notifiche e non ha un titolo. I titoli restano 44'],
    'la destinazione, dalla `v2.7.0` (sprint 41 · T2.1)' => ['i due tipi dei motivi di perdita del CRM, che hanno un titolo dalla `v2.3.0`, dalla `v2.7.0` ne hanno una: aprono le Impostazioni del CRM (`https://crm.zeiras.com/w/<slug>/impostazioni`), dove i motivi stanno, senza un id'],
    'gli altri tipi dei motivi (sprint 41 · T2.2)' => ['un altro tipo dei motivi di perdita, che il registro non ha, resta senza'],
]);

// v2.25.3 (parole e pagina di zr-crm, nota 16079 del #95). Dal 24/10/2026 il CRM manda una notifica personale quando un consumo
// porta sotto zero il credito di un pacchetto: dalla `v2.25.3` ha un titolo e apre il contatto. Il README lo dice dove dice la
// menzione in un commento: titolo, tipo e chiave nel punto «Le notifiche», coi titoli che allora erano 45 e ciò che ne dice il
// contratto; dove si apre, e che l'id dell'acquisto non entra nell'indirizzo; la riga del registro.

it('il README dice, dalla v2.25.3, il titolo, il tipo e la chiave della notifica del credito sotto zero, che l\'evento con lo stesso nome non ha un titolo, che con lei i titoli erano 45, che cosa ne dice il contratto, che un clic apre il contatto e non porta l\'id dell\'acquisto, e la riga del registro (v2.25.3)', function (string $dove, string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $testo = $dove === 'punto' ? puntoDelleNotifiche($readme) : suUnaRiga($readme);

    expect($testo)->not->toBe('')
        ->and(str_contains($testo, $frase))->toBe(true);
})->with([
    'il titolo' => ['punto', 'Dalla `v2.25.3` ha un titolo anche la notifica che il CRM manda quando un consumo porta sotto zero il credito di un pacchetto: «Credito sotto zero: cliente da avvisare»'],
    'il tipo senza `com.zeiras.` davanti, e la chiave' => ['punto', 'Non è un evento: il suo `tipo` è `crm.acquisto.scoperto`, senza `com.zeiras.` davanti, e la chiave del titolo è `notificationTitle.crm.acquisto.scoperto`; l\'evento `com.zeiras.crm.acquisto.scoperto` non genera notifiche e non ha un titolo'],
    // v2.25.4: con le due delle scadenze i titoli sono 47, e i 45 passano al passato.
    'quanti erano i titoli' => ['punto', 'Con lei i titoli erano 45: 38 tipi di evento, i cinque «assegnata», la menzione e il credito sotto zero'],
    'che cosa ne dice il contratto' => ['punto', 'È nel contratto dal 24/10/2026: `app` `crm`, nei `dati` l\'`id` dell\'acquisto e `persona_id`, il contatto, mai il nome, e `risorsa_nome` è il nome della voce del catalogo'],
    'dove si apre' => ['punto', 'Dalla `v2.25.3` il credito di un pacchetto sotto zero apre il contatto, `https://crm.zeiras.com/w/<slug>/contatti/<persona_id>`: l\'id dell\'acquisto non entra nell\'indirizzo, perché un acquisto non ha una pagina sua'],
    'i tipi con una destinazione' => ['punto', 'un altro tipo dei motivi di perdita, che il registro non ha, resta senza; dalla `v2.25.3` ne ha una il credito di un pacchetto sotto zero, che apre il contatto)'],
    'la riga del registro' => ['readme', 'Dalla `v2.25.3` la voce del CRM ha anche il credito di un pacchetto sotto zero (`crm.acquisto.scoperto`), con `/contatti/{persona_id}`: apre il contatto, e l\'`id` dell\'acquisto, che i `dati` portano, non è nel percorso'],
]);

// v2.25.4 (parole di zr-crm, Decisioni 16179 e 16181 del #95). Le due notifiche delle scadenze del CRM, il preavviso e il
// riepilogo del giorno, hanno un titolo: il README lo dice dove dice il credito sotto zero, coi titoli che allora erano 47, ciò che
// il contratto pubblicato non ha ancora e dove porta un clic finché il registro non ha le loro righe.

it('il README dice, dalla v2.25.4, i titoli e i tipi delle due notifiche delle scadenze, che non sono eventi, che con loro i titoli erano 47, che il contratto pubblicato il 24/10/2026 non le ha, che cosa porteranno nei dati e che un clic apre la pagina delle notifiche', function (string $frase) {
    $testo = puntoDelleNotifiche((string) file_get_contents(__DIR__.'/../../README.md'));

    expect($testo)->not->toBe('')
        ->and(str_contains($testo, $frase))->toBe(true);
})->with([
    'i titoli e i tipi' => ['Dalla `v2.25.4` hanno un titolo anche le due notifiche delle scadenze del CRM: il preavviso di una scadenza, al suo responsabile, «Una scadenza si avvicina» (`crm.scadenza.in_preavviso`), e il riepilogo del giorno, quando lo stesso giorno i preavvisi sono più di cinque, «Scadenze in preavviso oggi» (`crm.scadenze.riepilogo_del_giorno`)'],
    'senza `com.zeiras.` davanti' => ['Non sono eventi, e il loro `tipo` non ha `com.zeiras.` davanti'],
    // v3.2.2: con la richiesta sul preventivo i titoli sono 48, e i 47 passano al passato.
    'quanti erano i titoli' => ['Con loro i titoli erano 47: 38 tipi di evento, i cinque «assegnata», la menzione, il credito sotto zero e le due delle scadenze'],
    'il contratto' => ['Il 24/10/2026 il contratto pubblicato non le ha ancora: i nomi li ha fissati il backoffice'],
    'i dati' => ['nei `dati` il preavviso porta l\'`id` della scadenza e `persona_id` o `organizzazione_id`, il riepilogo il numero'],
    'dove si apre' => ['Nella `v2.25.4` un clic su tutte e due apre la pagina delle notifiche'],
]);

// v3.2.2 (parole e pagina di zr-crm, Decisione 16510 del #95). La notifica della modifica che un cliente chiede dal link di un
// preventivo ha un titolo e apre il preventivo: il README lo dice nel punto «Le notifiche», coi titoli che ora sono 48, e nelle
// righe del registro, col tetto della campanella che sale di 16 byte.

it('il README dice, dalla v3.2.2, il titolo e il tipo della notifica della richiesta sul preventivo, che non è un evento e che gli eventi dei preventivi non generano notifiche, che con lei i titoli sono 48, che cosa porta nei dati e che un clic apre il preventivo', function (string $frase) {
    $testo = puntoDelleNotifiche((string) file_get_contents(__DIR__.'/../../README.md'));

    expect($testo)->not->toBe('')
        ->and(str_contains($testo, $frase))->toBe(true);
})->with([
    'il titolo e il tipo' => ['Dalla `v3.2.2` ha un titolo anche la notifica che arriva al responsabile del contatto, o ai proprietari del workspace, quando un cliente chiede una modifica dal link di un preventivo: «Un cliente ha chiesto una modifica al preventivo» (`crm.preventivo.richiesta`)'],
    'senza `com.zeiras.` davanti' => ['Non è un evento, e il suo `tipo` non ha `com.zeiras.` davanti; gli eventi dei preventivi, compreso `com.zeiras.crm.preventivo.visto`, la prima apertura del link, non generano notifiche'],
    // v3.5.0: con le schede senza assegnatario i titoli sono 49, e i 48 passano al passato.
    'quanti erano i titoli' => ['Con lei i titoli erano 48: 38 tipi di evento, i cinque «assegnata», la menzione, il credito sotto zero, le due delle scadenze e la richiesta sul preventivo'],
    'i dati' => ['Nei `dati` porta l\'`id` del preventivo e `trattativa_id`, l\'opportunità o `null`, mai il testo del cliente, e non ha chi l\'ha fatto'],
    'dove si apre' => ['Un clic apre il preventivo, `https://crm.zeiras.com/w/<slug>/preventivi/<id>`'],
]);

it('il README dice, dalla v3.2.2, la riga del registro della richiesta sul preventivo, e che il tetto della campanella è salito di 16 byte per lei, con la Decisione di zr-pm', function (string $frase) {
    $readme = suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md'));

    expect(substr_count($readme, $frase))->toBe(1);
})->with([
    'la riga del registro' => ['Dalla `v3.2.2` il CRM ha anche la richiesta di un cliente sul preventivo (`crm.preventivo.richiesta`), con `/preventivi/{id}`: apre il preventivo, e `trattativa_id`, che i `dati` portano, non è nel percorso'],
    'il tetto della campanella' => ['Quello della campanella era di 1.969 byte, ed è salito di 16 nella `v3.2.2`: la riga del registro che apre il preventivo dalla richiesta di un cliente (un\'eccezione di zr-pm, Decisione 16510)'],
]);

// Sprint 77 · T3 (zr-backoffice #2596, parole di Project Management). La notifica delle schede rimaste senza assegnatario quando
// una persona lascia il workspace ha un titolo: il README lo dice nel punto «Le notifiche», coi titoli che ora sono 49.

it('il README dice, dalla v3.5.0, il titolo e il tipo della notifica delle schede senza assegnatario, a chi arriva, che non è un evento, che con lei i titoli sono 49, che cosa porta nei dati e che un clic apre la pagina delle notifiche (sprint 77 · T3.1)', function (string $frase) {
    $testo = puntoDelleNotifiche((string) file_get_contents(__DIR__.'/../../README.md'));

    expect($testo)->not->toBe('')
        ->and(str_contains($testo, $frase))->toBe(true);
})->with([
    'il titolo e il tipo' => ['Dalla `v3.5.0` ha un titolo anche la notifica che arriva al proprietario e agli amministratori quando una persona lascia il workspace e restano schede senza nessun assegnatario: «Restano schede senza assegnatario» (`board.schede.senza_assegnatario`)'],
    'senza `com.zeiras.` davanti' => ['Non è un evento nemmeno lei, e il suo `tipo` non ha `com.zeiras.` davanti'],
    'chi l\'ha fatto' => ['chi l\'ha fatto è la persona che è uscita («Marta Rossi ha lasciato il workspace: restano schede senza assegnatario»)'],
    // v3.6.0: con le tre di Bookings e le quattro del promemoria, delle scadenze di una scheda e dell'invito i titoli sono 56, e i 49 passano al passato.
    'quanti erano i titoli' => ['Con lei i titoli erano 49: 38 tipi di evento, i cinque «assegnata», la menzione, il credito sotto zero, le due delle scadenze, la richiesta sul preventivo e le schede senza assegnatario'],
    'i dati e dove si apre' => ['Nei `dati` porta solo il numero delle schede, nessun id: un clic apre la pagina delle notifiche'],
]);

// Sprint 74 (zr-backoffice-55, 26/10). Il promemoria di una To-do, le due scadenze di una scheda e l'invito accettato hanno un
// titolo: il README lo dice nel punto «Le notifiche», coi titoli che ora sono 56.
it('il README dice, dalla v3.6.0, i titoli e i tipi del promemoria di una To-do, delle due scadenze di una scheda e dell\'invito accettato, chi l\'ha fatto, che con loro i titoli sono 56 e che un clic apre la pagina delle notifiche', function (string $frase) {
    $testo = puntoDelleNotifiche((string) file_get_contents(__DIR__.'/../../README.md'));

    expect($testo)->not->toBe('')
        ->and(str_contains($testo, $frase))->toBe(true);
})->with([
    'non sono eventi' => ['Dalla `v3.6.0` hanno un titolo anche quattro notifiche che non sono eventi, col `tipo` senza `com.zeiras.` davanti'],
    'il promemoria' => ['il promemoria di una To-do, «Promemoria: hai una cosa da fare» (`board.todo.promemoria`)'],
    'le due scadenze' => ['«Una scheda scade domani» (`board.scheda.scade_domani`) e «Una scheda scade oggi» (`board.scheda.scade_oggi`)'],
    'l\'invito' => ['senza prodotto l\'invito accettato, «Il tuo invito è stato accettato» (`io.invito.accettato`)'],
    'chi l\'ha fatto' => ['dell\'invito chi l\'ha fatto è chi ha accettato («Marta Rossi ha accettato il tuo invito»)'],
    // Sprint 79: con i due degli sprint i titoli sono 58, e i 56 passano al passato.
    'quanti erano i titoli' => ['Con loro e con le tre di Bookings (più sotto) i titoli erano 56'],
    'dove si apre' => ['Nessuna delle quattro ha una destinazione: un clic apre la pagina delle notifiche'],
]);

// Sprint 79 · T1 (voce 2820). I due tipi di evento degli sprint hanno un titolo: il README lo dice nel punto «Le notifiche», coi
// titoli che ora sono 58, e dice che gli altri tipi del contratto del 27/10 non generano notifiche.
it('il README dice, dalla v3.11.0, i titoli dei due tipi degli sprint, chi l\'ha fatto, che con loro i titoli sono 58, che gli altri tipi nuovi non generano notifiche e che un clic apre la pagina delle notifiche (sprint 79 · T1)', function (string $frase) {
    $testo = puntoDelleNotifiche((string) file_get_contents(__DIR__.'/../../README.md'));

    expect($testo)->not->toBe('')
        ->and(str_contains($testo, $frase))->toBe(true);
})->with([
    'i due titoli' => ['Dalla `v3.11.0` hanno un titolo i due tipi di evento degli sprint di Project Management che il contratto ha dal 27/10/2026: `com.zeiras.board.sprint.creato`, «Sprint creato», e `com.zeiras.board.sprint.modificato`, «Sprint modificato»'],
    'chi l\'ha fatto' => ['con chi l\'ha fatto «Marta Rossi ha creato uno sprint» e «Marta Rossi ha cambiato uno sprint»'],
    'quanti sono i titoli' => ['Con loro i titoli sono 58: 40 tipi di evento e i diciotto che non sono eventi'],
    'gli altri non notificano' => ['Gli altri tipi di evento che il contratto ha dal 27/10/2026 non generano notifiche e non hanno un titolo'],
    'dove si apre' => ['Nessuno dei due ha una destinazione: un clic apre la pagina delle notifiche'],
]);

// Sprint 77 · T2.1 (voce #2677). README e guida dicono `Cornice::nuovoWorkspace()`: l'indirizzo, quando dà null, che pagina e
// dialogo sono di zr-home e che un errore del backoffice non diventa null.

it('README e guida dicono Cornice::nuovoWorkspace(): l\'indirizzo di zr-home, la regola del selettore, null per gli altri, e che un errore arriva al modulo (sprint 77 · T2.1)', function (string $dove, string $frase) {
    $testo = suUnaRiga((string) file_get_contents(__DIR__.'/../../'.$dove));

    expect(substr_count($testo, $frase))->toBe(1);
})->with([
    'il titolo' => ['README.md', '### Un workspace nuovo da una pagina del modulo'],
    'l\'indirizzo' => ['README.md', 'prende l\'indirizzo da `Cornice::nuovoWorkspace()` (dalla `v3.5.0`), e non scrive il percorso di zr-home nel suo codice. Dà `https://app.zeiras.com/w/<slug>/nuovo-workspace`'],
    'di chi è la pagina' => ['README.md', 'La pagina e il dialogo sono di zr-home, e se la persona può davvero creare il workspace lo decide il backoffice (`io.workspace.crea`): zr-core dà soltanto la strada'],
    'la regola' => ['README.md', 'La regola è quella del selettore, `nuovo_workspace`: l\'indirizzo c\'è se la persona è `proprietario` o `amministratore` in almeno un workspace dell\'azienda del workspace della sessione. Il ruolo della sessione non conta'],
    'gli errori' => ['README.md', 'Un errore del backoffice non diventa `null`, che direbbe «non puoi» a chi può'],
    'la guida' => ['MODULO-NUOVO.md', 'Se una tua pagina deve mandare la persona a creare un workspace, l\'indirizzo lo dà `Cornice::nuovoWorkspace()` (dalla `v3.5.0`)'],
    'la guida: null' => ['MODULO-NUOVO.md', 'Con `null` la tua pagina spiega e non mostra il pulsante. Il percorso di zr-home non lo scrivi tu'],
]);

// Sprint 28 · T1.5 (voce #1826): dalla `v1.18.0` un'opportunità chiusa mostra l'esito nella seconda riga, e una aperta no. Il
// README lo dice nel punto «La ricerca», nella riga della rotta (di un'opportunità passa anche `esito`, com'è arrivato) e nel
// capoverso delle risorse del registro (ha `codici` anche l'opportunità; `aperta` non è un codice).
it('il README dice che dalla v1.18.0 un\'opportunità chiusa mostra l\'esito e una aperta no: nel punto «La ricerca», nella riga della rotta e nel capoverso delle risorse del registro (sprint 28 · T1.5)', function (string $dove, string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $testi = [
        'ricerca' => puntoDellaCornice($readme, 'La ricerca'),
        'rotta' => rigaDellaRotta($readme, 'POST /cornice/ricerca'),
        'registro' => capoversoDelleRisorse($readme),
    ];

    expect($testi[$dove])->not->toBe('')
        ->and(str_contains($testi[$dove], $frase))->toBe(true);
})->with([
    'la ricerca: l\'esito, per terzo' => ['ricerca', 'Dalla `v1.18.0` un\'opportunità chiusa mostra anche l\'esito, per terzo'],
    'la ricerca: un\'opportunità aperta' => ['ricerca', 'un\'opportunità aperta resta con pipeline e fase, senza un terzo testo'],
    'la ricerca: il codice e il registro' => ['ricerca', 'Dell\'esito il backoffice dà il codice (`aperta`, `vinta` o `persa`) e il registro ha i soli `vinta` e `persa`'],
    'la riga: passa anche esito' => ['rotta', 'dalla `v1.18.0` di un\'opportunità passa anche `esito` (`aperta`, `vinta` o `persa`), com\'è arrivato: quali esiti si mostrano lo sa la cornice'],
    'il registro: i codici dell\'opportunità' => ['registro', 'Dalla `v1.18.0` ha `codici` anche l\'opportunità del CRM (`crm.trattativa`), che a `pipeline` e `fase` aggiunge la chiave `esito`'],
    'il registro: i due testi' => ['registro', 'coi testi `searchContext.crm.crm.trattativa.esito.vinta` e `….persa`'],
    'il registro: aperta non è un codice' => ['registro', '`aperta`, che il backoffice dà per un\'opportunità aperta, non è fra i codici e non ha un testo: così un\'opportunità aperta non mostra l\'esito'],
]);

it('gli esiti che README e guida dicono per un\'opportunità sono i codici del registro coi testi delle lingue, nell\'ordine del registro, e `aperta` non è fra quelli (sprint 28 · T1.5)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $davanti = 'crm.crm.trattativa.esito.';
    $codici = array_map(fn (string $codice): string => substr($codice, strlen($davanti)), array_values(array_filter(codiciDelContesto(), fn (string $codice): bool => str_starts_with($codice, $davanti))));
    $fraAccenti = array_map(fn (string $codice): string => '`'.$codice.'`', $codici);
    $nella = function (string $lingua) use ($codici, $davanti): array {
        $testi = json_decode((string) file_get_contents(__DIR__.'/../../resources/lingue/ricerca/'.$lingua.'.json'), true, flags: JSON_THROW_ON_ERROR);

        return array_map(fn (string $codice): string => $testi['searchContext.'.$davanti.$codice], $codici);
    };
    [$vinta, $persa] = $nella('it');

    expect($codici)->toBe(['vinta', 'persa'])
        ->and(str_contains(puntoDellaCornice($readme, 'La ricerca'), 'per terzo: «Vendite · Proposta · '.$vinta.'», o «… · '.$persa.'» (in inglese «'.implode('» e «', $nella('en')).'», in spagnolo «'.implode('» e «', $nella('es')).'»)'))->toBe(true)
        ->and(str_contains(capoversoDelleRisorse($readme), 'i codici sono '.implode(' e ', $fraAccenti).', coi testi'))->toBe(true)
        ->and(str_contains(capoversoDelleRisorse($readme), '(«'.$vinta.'» e «'.$persa.'»)'))->toBe(true)
        ->and(str_contains(suUnaRiga(guidaDelModuloNuovo()), 'per l\'`esito` ('.implode(', ', $fraAccenti).':'))->toBe(true);
});

// Lettura della PR #60, C1: la chiave del testo di un codice comincia con la voce del registro, e la voce `home` non è un
// modulo. README e guida la scrivevano con `<prodotto>`.
it('README e guida scrivono la chiave del testo di un codice con `<voce>` e non più con `<prodotto>`, e la guida non dice più il membro del workspace come la sola risorsa coi `codici` (sprint 28 · T1.5)', function () {
    $readme = suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md'));
    $guida = suUnaRiga(guidaDelModuloNuovo());

    expect(str_contains($readme, 'searchContext.<prodotto>.'))->toBe(false)
        ->and(str_contains($guida, 'searchContext.<prodotto>.'))->toBe(false)
        ->and(substr_count($readme, '`searchContext.<voce>.<tipo>.<chiave>.<codice>`'))->toBe(1)
        ->and(substr_count($guida, '`searchContext.<voce>.<tipo>.<chiave>.<codice>`'))->toBe(1)
        ->and(str_contains($guida, 'Oggi ha `codici` il membro del workspace'))->toBe(false);
});

it('la guida dice nel passo del registro, e non altrove, come si dà a una risorsa una chiave di `contesto` che è un codice: `codici` nel registro e un testo per codice in ogni lingua; nel passo della ricerca nomina i membri e rimanda al passo del registro (sprint 27 · T3.3)', function (string $passo, string $frase) {
    $guida = guidaDelModuloNuovo();
    preg_match('/^## '.preg_quote($passo, '/').'$(.*?)(?=^## |\z)/ms', $guida, $delPasso);

    expect(suUnaRiga($delPasso[1] ?? ''))->not->toBe('')
        ->and(str_contains(suUnaRiga($delPasso[1] ?? ''), $frase))->toBe(true)
        // Una volta sola in tutta la guida: sta in quel passo, e non anche in un altro.
        ->and(substr_count(suUnaRiga($guida), $frase))->toBe(1);
})->with([
    'quando, e a chi si dice' => ['8. Il prodotto nel registro', 'Se una chiave di `contesto` di una risorsa non porta un testo ma un codice — uno stato, un ruolo —, dalla `v1.17.0` lo dici a zr-core insieme alla risorsa'],
    'codici, e un testo per codice' => ['8. Il prodotto nel registro', 'nel registro la risorsa ha `codici`, coi codici che quella chiave può avere, e ogni lingua del pezzo della ricerca (`resources/lingue/ricerca/`, dalla `v3.9.0`) ha un testo per codice (`searchContext.<voce>.<tipo>.<chiave>.<codice>`)'],
    'che cosa si mostra' => ['8. Il prodotto nel registro', 'La cornice mostra il testo della lingua, mai il codice, e un codice che il registro non ha non si mostra: un codice nuovo vuole una versione nuova di zr-core'],
    // Sprint 28 · T1.5: dalla `v1.18.0` li ha anche l'opportunità, e il membro non è più detto come la sola risorsa coi `codici`.
    'chi li ha oggi' => ['8. Il prodotto nel registro', 'Oggi hanno `codici` il membro del workspace, per il `ruolo` (`proprietario`, `amministratore`, `membro`), e dalla `v1.18.0` l\'opportunità del CRM, per l\'`esito` (`vinta`, `persa`'],
    'aperta non è un codice' => ['8. Il prodotto nel registro', '`aperta` non è un codice, e un\'opportunità aperta non mostra l\'esito'],
    'la ricerca trova anche i membri' => ['9. La ricerca', 'opportunità del CRM (dalla `v1.17.0` anche i membri del workspace, che non sono di un modulo)'],
    'il rimando dal passo della ricerca' => ['9. La ricerca', 'Una chiave di `contesto` che porta un codice vuole anche `codici` (passo 8)'],
]);

// Sprint 22 · T4, seconda lettura della PR #44 (S2, S3, S5): tre cose che il README taceva a chi installa. Quante sono le cose
// che cambiano nei test di un frontend, e dove stanno quelle della ricerca (S2); per chi le notifiche le legge da sé, la forma di
// `ids` nel browser, quale `slug` dare a `destinazioneDellaNotifica`, e che un id non è un permesso (S3); che cosa conta la
// campanella coi dati senza `non_lette` (S5).

it('il README dice ciò che la seconda lettura della PR #44 ha chiesto: le cinque cose che cambiano nei test di un frontend e dove stanno le due della ricerca, la forma di `ids` e lo `slug` per chi le notifiche le legge da sé, che un id non è un permesso, e che cosa conta la campanella senza `non_lette` (sprint 22 · T4; review della PR #44, seconda lettura: S2, S3, S5)', function (string $dove, string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    preg_match('/^- \*\*Le notifiche\*\* .*?(?=^- \*\*|\z)/ms', $readme, $punto);
    $testi = [
        'punto' => suUnaRiga($punto[0] ?? ''),
        'paragrafo' => paragrafoFuoriDallaCornice($readme),
        'campanella' => suUnaRiga(puntoDellaCampanella($readme)),
    ];

    expect($testi[$dove])->not->toBe('')
        ->and(str_contains($testi[$dove], $frase))->toBe(true);
})->with([
    'S2: quante sono, e di chi' => ['punto', 'Per i test di un frontend che passa alla `v1.12.0` cambiano cinque cose: tre sono delle notifiche, e sono quelle che seguono; due sono della ricerca, e stanno nel punto «La ricerca», qui sotto'],
    'S2: le due della ricerca' => ['punto', 'senza `workspace` in una risposta finta di `POST /cornice/ricerca` la ricerca mostra il suo errore, e il segnaposto e l\'aiuto del campo hanno testi nuovi'],
    'S2: dove cercare le due della ricerca' => ['punto', 'le due della ricerca cercando `cornice/ricerca` e i testi di prima, che il suo punto elenca'],
    'S3: un array di PHP, e la forma di `ids` nell\'elenco' => ['paragrafo', 'È un array di PHP, e vuoto in JSON è `[]`, mentre `GET /cornice/notifiche` manda `ids` sempre come oggetto (`{}` quando è vuoto)'],
    'S3: chi lo dà al browser lo converte' => ['paragrafo', 'chi lo dà al browser lo converte in un oggetto (`(object)`), e nel browser `ids` ha una forma sola'],
    'S3: un id non è un permesso' => ['paragrafo', 'Un id non è un permesso nemmeno qui: il metodo non controlla che chi riceve la notifica possa vedere quella risorsa, e lo decide il modulo che apre la pagina'],
    'S3: quale slug' => ['paragrafo', 'Lo `slug` da dare a `destinazioneDellaNotifica`, per notifiche lette così, è quello del workspace della sessione nella richiesta che le ha lette (lo `slug` di `Sessione::workspace()` di zr-auth), e la parte server del frontend lo manda insieme a loro, come `GET /cornice/notifiche` manda `workspace`'],
    'S3: non lo slug dei dati di una pagina rimasta indietro' => ['paragrafo', 'Non è `dati.workspace.slug`: con due schede su due workspace, una pagina rimasta indietro che ricarica le sole notifiche riceve quelle dell\'altro workspace, e coi suoi dati le aprirebbe nel proprio'],
    'S5: vale coi dati che portano `non_lette`' => ['campanella', 'Vale coi dati che portano `non_lette`, come li dà `Cornice::dati()`'],
    'S5: senza, le non lette del pannello di qualunque workspace' => ['campanella', 'con dati scritti a mano senza `non_lette`, che il tipo ammette, la pagina non ha un numero suo, e la campanella conta le non lette che il pannello ha caricato, di qualunque workspace sia l\'elenco'],
]);

it('il README non dice più che nei test di un frontend cambiano tre cose in tutto, e il punto «La ricerca» a cui rimanda sta sotto «Le notifiche» (review della PR #44, seconda lettura: S2)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $notifiche = strpos($readme, "\n- **Le notifiche** ");
    $ricerca = strpos($readme, "\n- **La ricerca** ");

    expect(str_contains(suUnaRiga($readme), 'cambiano tre cose'))->toBe(false)
        ->and($notifiche)->toBeInt()
        ->and($ricerca)->toBeInt()
        ->and($notifiche)->toBeLessThan((int) $ricerca);
});

it('ciò che il README dice della forma di `ids` è vero: il metodo dà un array di PHP, che vuoto in JSON è `[]` e con un id un oggetto, e l\'elenco lo manda sempre come oggetto (review della PR #44, seconda lettura: S3)', function () {
    $sorgente = (string) file_get_contents(__DIR__.'/../../src/Http/NotificheDellaCornice.php');

    expect(json_encode(NotificheDellaCornice::idsDellaNotifica(null, 'com.zeiras.crm.nota.creata', null)))->toBe('[]')
        ->and(json_encode((object) NotificheDellaCornice::idsDellaNotifica(null, 'com.zeiras.crm.nota.creata', null)))->toBe('{}')
        ->and(json_encode(NotificheDellaCornice::idsDellaNotifica('crm', 'com.zeiras.crm.nota.creata', ['persona_id' => 'p-1'])))->toBe('{"persona_id":"p-1"}')
        // L'elenco: un oggetto anche quando è vuoto.
        ->and(substr_count($sorgente, "'ids' => (object) self::idsDellaNotifica("))->toBe(1);
});

// Sprint 23 · T1 (voce #1732): con l'elenco di un altro workspace il pannello non ha «Segna tutte come lette». Il README lo dice
// al punto «Le notifiche», accanto a quando il pulsante c'è: l'eccezione, da quale versione, perché, e che cosa vale se la
// parte server non dice di quale workspace è l'elenco.

it('il README dice, al punto «Le notifiche», che dalla v1.13.0 «Segna tutte come lette» non c\'è quando l\'elenco è di un altro workspace, e che c\'è come prima se la parte server non dice di quale workspace è (sprint 23 · T1.4)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    preg_match('/^- \*\*Le notifiche\*\* .*?(?=^- \*\*|\z)/ms', $readme, $punto);
    $testo = suUnaRiga($punto[0] ?? '');

    expect($testo)->not->toBe('')
        ->and(str_contains($testo, $frase))->toBe(true)
        // Senza l'eccezione la frase finiva qui: il pulsante c'era ogni volta.
        ->and(str_contains($testo, 'anche se quelle caricate sono già lette.'))->toBe(false);
})->with([
    'quando c\'è' => ['Il pulsante c\'è quando la campanella ha un numero e il pannello ha caricato almeno una notifica, anche se quelle caricate sono già lette;'],
    'l\'eccezione, e da quando' => ['dalla `v1.13.0` non c\'è quando la parte server dice che l\'elenco è di un altro workspace rispetto ai dati della pagina'],
    'perché' => ['con due schede su due workspace, da lì la rotta risponde 409 `workspace_diverso` e non segna niente'],
    'non detto' => ['Se la risposta dell\'elenco non dice di quale workspace è, il pulsante c\'è come prima'],
]);

// Sprint 23 · T2 (voce #1742, S4): lo `workspace` della risposta della ricerca entra nell'indirizzo di ogni risultato solo con la
// forma di uno slug. Il README lo dice al punto «La ricerca», dopo l'errore di una risposta senza `workspace`.

it('il README dice, al punto «La ricerca», che dalla v1.13.0 anche un `workspace` fuori dalla forma di uno slug è un errore della ricerca: quale forma, perché, e che cosa fa chi ha una parte server finta (sprint 23 · T2.4)', function (string $frase) {
    $ricerca = puntoDellaCornice((string) file_get_contents(__DIR__.'/../../README.md'), 'La ricerca');

    expect($ricerca)->not->toBe('')
        ->and(str_contains($ricerca, $frase))->toBe(true);
})->with([
    'l\'errore, e da quando' => ['Dalla `v1.13.0` è un errore della ricerca anche un `workspace` che non ha la forma di uno slug'],
    'quale forma' => ['minuscole e cifre, a pezzi uniti da un trattino, la stessa che vale per una notifica'],
    'perché' => ['con `..` l\'indirizzo di un risultato sarebbe un altro'],
    'la parte server finta di un frontend' => ['Una parte server finta che risponde con uno slug fuori forma (`Acme`, `acme_marketing`) va corretta'],
    // L'errore di prima resta detto com'era.
    'senza `workspace`, come prima' => ['Una risposta senza `workspace`, o con un `workspace` che non è un testo o è vuoto, è un errore della ricerca'],
]);

// Sprint 24 · T2 (voce #1745): chi non ha accettato i documenti legali in vigore vede la cornice ridotta. Il README lo dice in tre
// posti — i dati nella parte server, il 403 delle rotte, il punto di «La cornice» con ciò che fa il frontend — e la guida del
// modulo nuovo ha la riga. Nessuno nomina un documento, né dice che la cornice fa accettare.

it('il README dice, al punto «Chi non ha accettato i documenti legali» di «La cornice», che cosa vede la persona e che cosa fa il frontend (sprint 24 · T2.7)', function (string $frase) {
    $punto = puntoDellaCornice((string) file_get_contents(__DIR__.'/../../README.md'), 'Chi non ha accettato i documenti legali');

    expect($punto)->not->toBe('')
        ->and(str_contains($punto, $frase))->toBe(true);
})->with([
    'da quando, e con quali dati' => ['vede la cornice ridotta, dalla `v1.14.0`: coi dati che portano `accettazione_richiesta: true`, o dopo che una rotta della cornice ha risposto 403 `accettazione_richiesta`'],
    'finché ha quei dati' => ['con dati letti dopo che non lo dicono torna quella di sempre'],
    'il menu Moduli' => ['Nel menu Moduli c\'è solo la Dashboard, e il pulsante del modulo aperto non c\'è'],
    'la campanella' => ['La campanella non ha numero, e il suo pannello dice «Non disponibile finché non accetti i documenti.», senza notifiche e senza «Segna tutte come lette», «Riprova» e «Vedi tutte»'],
    'la ricerca' => ['la ricerca dice la stessa frase sotto il campo e non dà risultati'],
    'nessuna rotta' => ['In quello stato la cornice non chiama nessuna delle sue rotte'],
    'l\'avviso e dove porta' => ['c\'è un avviso («Ci sono documenti da accettare») col pulsante «Vai ai documenti», che porta a `https://app.zeiras.com/legale/accetta?ritorno=<indirizzo della pagina>`'],
    'il ritorno' => ['va nel `ritorno` solo se comincia con `https://` e non supera i 2000 caratteri'],
    'di chi è la pagina' => ['La pagina dell\'accettazione è di zr-home e sta fuori dalla cornice'],
    'che cosa la cornice non fa' => ['la cornice non mostra testi legali, non dice quali documenti mancano e non fa accettare niente'],
    'i dati così come sono' => ['dà i dati alla cornice così come sono'],
    'non è «Presto»' => ['non legge `prodotti` vuoto come «Presto» (guarda `accettazione_richiesta`)'],
    // Lettura della PR #52, R3: il rimando di zr-auth è delle visite, non di ogni chiamata.
    'il rimando è di zr-auth, per le visite' => ['lascia a zr-auth il rimando dalle proprie visite che chiamano `/v1` (a una richiesta JSON zr-auth risponde 403 senza rimando, e lì decide il frontend: «La parte server»)'],
    'le voci del modulo e il «+»' => ['se a chi non ha accettato non vuole mostrare le voci del modulo e il «+», non li dà (`nav`, `create`)'],
    // Lettura della PR #52: R1, R6, R2, R10, e di chi è il ritorno.
    'finché i dati non sono più recenti (R1)' => ['finché i dati della cornice non sono più recenti di quelli che aveva allora: gli stessi, o dello stesso workspace con un segno non più avanti, anche se il frontend li ricrea a ogni disegno o li ritocca nel browser'],
    'i dati senza segno (R1)' => ['dati senza segno valgono solo finché sono lo stesso oggetto'],
    'la voce attiva (R6, S5)' => ['Su una pagina di un modulo che non dà `active`, o lo dà vuoto, nessuna voce della barra è segnata: la Dashboard resta segnata solo sulle pagine di app.zeiras.com'],
    // Seconda lettura della PR #52 (sprint 25 · T5): S1 e ciò che restava di R2, S4.
    // Lettura della PR #56, R5: col percorso la pagina sta in `div.zr-main-body`, misurato in un browser sulla pagina di prova.
    'il contenitore (R2, S1)' => ['l\'avviso sta nel margine della pagina, in un contenitore suo (`div.zr-stack`) prima della pagina. La pagina resta dov\'è fuori da quello stato — dentro `main.zr-main`, o dentro `div.zr-main-body` se la pagina ha il percorso (`crumbs`) —, subito dopo l\'avviso'],
    'la pagina non si rimonta (S1)' => ['quando lo stato arriva o se ne va non si rimonta (dalla `v1.15.0`): ciò che è scritto in un campo, il fuoco e lo scorrimento restano, e i suoi effetti non ripartono'],
    'comunque lo stato arrivi (S1)' => ['Vale comunque lo stato arrivi: dal 403 di una rotta, o coi dati di una visita che tiene la pagina montata'],
    'il segnale non resta (S4)' => ['e così coi dati di un altro workspace: da lì quel segnale non vale più, nemmeno per i dati di prima'],
    'nessun middleware sulle rotte della cornice (R10)' => ['sulle rotte `/cornice/*` non mette un middleware che chiama `/v1` senza prendere quel 403'],
    'di chi è il ritorno' => ['Il `ritorno` è una richiesta: dove la persona torna dopo l\'accettazione lo decide zr-home'],
    // Lettura della PR #59, R4: dalla `v1.16.0` la ricerca si dimentica, e che cosa si legge al ritorno sotto una parola rimasta.
    'la ricerca si dimentica, e che cosa si legge al ritorno' => ['Dalla `v1.16.0`, passata a quello stato, la cornice dimentica la ricerca: tornata quella di sempre non mostra i risultati di prima, e se nel campo è rimasta una parola sotto si legge «Nessun risultato per «parola»», anche se quella parola non è stata cercata, finché la persona non scrive ancora'],
]);

it('il README non promette più che senza `Intl.ListFormat` la cornice si disegna in ogni browser (lettura della PR #59, R1)', function () {
    $readme = suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md'));

    expect(str_contains($readme, 'dove manca, dalla `v1.16.0` la cornice si disegna lo stesso'))->toBe(false)
        ->and(str_contains($readme, 'in un browser che ha il resto di ciò che i sorgenti usano'))->toBe(true);
});

it('il README dice, in «La parte server», che cosa dà `Cornice::dati()` a chi non ha accettato i documenti legali, che `prodotti` vuoto lì non è «Presto», e che le quattro rotte rispondono 403 col codice — dalla `v2.5.0` anche con l\'email di chi è — (sprint 24 · T2.7)', function (string $frase) {
    $parteServer = sezioneDelReadme((string) file_get_contents(__DIR__.'/../../README.md'), 'La parte server');

    expect($parteServer)->not->toBe('')
        ->and(str_contains($parteServer, $frase))->toBe(true);
})->with([
    // Lettura della PR #52, R5: `prodotti` vuoto è la lista che il server dà, `[]`.
    'la riga della tabella' => ['| gli stessi dati, ridotti: `prodotti` `[]`, `aziende` `[]`, `non_lette` `0`, e in fondo `accettazione_richiesta: true` | dalla `v1.14.0`'],
    'la forma di `prodotti` (R5)' => ['Lì `prodotti` è una lista vuota, e al browser arriva `[]` e non `{}`: un frontend che valida la forma dei dati la ammette'],
    'non lancia' => ['Per la cornice non è un guasto: `Cornice::dati()` non lancia e dà i dati ridotti'],
    'mai a false' => ['La chiave c\'è solo lì, mai a `false`'],
    'non è «Presto»' => ['Con quella chiave `prodotti` vuoto non vuol dire «Presto»'],
    'chi legge i dati da sé' => ['guarda `accettazione_richiesta` prima di `prodotti`'],
    'stato e codice' => ['un 403 con un altro codice resta l\'`ErroreApi` che era'],
    'i documenti mancanti' => ['Quali documenti mancano la parte server non lo dà al browser'],
    // Lettura della PR #52, R3: la classe di zr-auth, le sue tre forme, e le patch che non la hanno.
    'le chiamate del frontend: la classe' => ['Da zr-auth `v0.12.17` quel 403 è l\'eccezione `Zeiras\\Auth\\Errori\\AccettazioneRichiesta`, che se nessuno la cattura risponde da sé, in quattro forme (lette fino alla `v0.12.20`)'],
    'le chiamate del frontend: le tre forme' => ['a una visita un rimando alla pagina dell\'accettazione (302), a una visita di Inertia un 409 con `X-Inertia-Location`, e a una richiesta JSON un 403 con `codice` e `mancanti`, senza rimando'],
    'le chiamate del frontend: chi decide' => ['lì la persona resta dov\'è, e che cosa mostrarle lo decide il frontend. Per le visite il frontend non scrive un rimando suo'],
    // Seconda lettura della PR #52, S10 (sprint 25 · T5.6).
    'le chiamate del frontend: la quarta forma (S10)' => ['La quarta forma è della pagina dell\'accettazione stessa (l\'host e il percorso di `zr-auth.accettazione`, con o senza la lingua davanti): lì risponde quel 403 anche a una visita e a una visita di Inertia, perché un rimando la manderebbe a sé stessa'],
    'le rotte' => ['le quattro rotte rispondono 403 `{errore: "accettazione_richiesta", persona}`: il codice e, dalla `v2.5.0`, l\'email della persona della sessione (`persona`: di chi è quell\'errore); titolo, dettaglio e documenti mancanti del backoffice restano nella parte server'],
    // Lettura della PR #52, R10.
    'nessun middleware sulle rotte della cornice' => ['Su quelle rotte nessun middleware del frontend chiama `/v1` senza prendere quel 403: altrimenti al browser, al posto della risposta della rotta, arriva quella di zr-auth'],
    // Seconda lettura della PR #52, S2 (sprint 25 · T5.2): da quale versione di zr-auth.
    'la cornice riconosce anche quella, e da quale zr-auth (S2)' => ['Da zr-auth `v0.12.17` è un 403 con `codice` e `mancanti`: la cornice lo riconosce lo stesso, dal `codice`, e passa allo stato ridotto'],
    // Seconda lettura della PR #52, S7 (sprint 25 · T5.5).
    'il tipo ammette la lista (S7)' => ['Il tipo `DatiDellaCornice` la ammette dalla `v1.15.0`, senza conversioni'],
]);

// Seconda lettura della PR #52, S2 e S8 (sprint 25 · T5.2, T5.6). Le frasi sulle patch di zr-auth più vecchie della `v0.12.17` sono
// tre — due nel README, una nella guida — e valgono finché il vincolo di composer.json ne ammette una: tutte e tre con la stessa
// condizione. Il giorno in cui il vincolo parte dalla 0.12.17 si tolgono insieme, e questo caso lo chiede a tutte.
it('README e guida dicono che cosa succede con una patch di zr-auth più vecchia della `v0.12.17` — quel 403 resta un ErroreApi e nessuno rimanda; su una rotta della cornice al browser arriva un 500 — finché il vincolo di composer.json ne ammette una: quando il vincolo parte da lì, le tre frasi si tolgono (sprint 24 · T5; lettura della PR #52, R3; sprint 25 · T5.2 e T5.6)', function (string $dove, string $frase) {
    $vincolo = json_decode((string) file_get_contents(__DIR__.'/../../composer.json'), true)['require']['zeiras/zr-auth'];
    $testo = $dove === 'guida' ? suUnaRiga(guidaDelModuloNuovo()) : sezioneDelReadme((string) file_get_contents(__DIR__.'/../../README.md'), 'La parte server');
    $ammetteUnaPiuVecchia = fn (string $vincolo): bool => version_compare(ltrim($vincolo, '^'), '0.12.17', '<');

    // Il vincolo è una versione sola col suo `^`: così la sua patch più bassa si legge togliendo il segno.
    expect($vincolo)->toMatch('/^\^0\.\d+\.\d+$/')
        ->and($testo)->not->toBe('')
        ->and(str_contains($testo, $frase))->toBe($ammetteUnaPiuVecchia($vincolo))
        // Il confronto nei due versi.
        ->and([$ammetteUnaPiuVecchia('^0.12.4'), $ammetteUnaPiuVecchia('^0.12.16'), $ammetteUnaPiuVecchia('^0.12.17'), $ammetteUnaPiuVecchia('^0.13.0')])->toBe([true, true, false, false]);
})->with([
    'README: le chiamate del frontend (R3)' => ['readme', 'Con una patch di zr-auth più vecchia della `v0.12.17` quel 403 resta un `ErroreApi` come gli altri, e nessuno rimanda: il vincolo di zr-core le ammette, e un frontend che vuole il rimando chiede nel proprio `composer.json` una zr-auth dalla `v0.12.17` in su'],
    'README: un middleware del frontend su una rotta della cornice (S2)' => ['readme', 'Con una patch più vecchia, che il vincolo di zr-core ammette, quell\'errore non ha una risposta sua: al browser arriva un 500, e la cornice mostra l\'errore di sempre: nel pannello delle notifiche resta «Riprova»'],
    'guida (S8)' => ['guida', 'Con una patch più vecchia quel 403 resta un `ErroreApi`: chiedi una zr-auth dalla `v0.12.17` in su'],
]);

it('il README non dice più che zr-auth rimanda da ogni chiamata, che `prodotti` ridotto è `{}`, né che lo stato ridotto vale finché la cornice ha quei dati (sprint 24 · T5; lettura della PR #52, R1, R3, R5)', function (string $frase) {
    expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')), $frase))->toBe(false)
        // Il controllo vede ciò che cerca: la frase, a capo com'era nel README, su una riga è quella.
        ->and(str_contains(suUnaRiga(str_replace(' ', "\n", $frase)), $frase))->toBe(true);
})->with([
    'il rimando da ogni chiamata (R3)' => ['zr-auth manda la persona alla pagina dell\'accettazione da sé, e il frontend non scrive un rimando suo'],
    'il rimando dalle chiamate, al punto di «La cornice» (R3)' => ['lascia a zr-auth il rimando dalle proprie chiamate a `/v1`;'],
    '`prodotti` come oggetto (R5)' => ['ridotti: `prodotti` `{}`'],
    'finché ha quei dati (R1)' => ['finché la cornice ha quei dati'],
    // Seconda lettura della PR #52 (sprint 25 · T5): S1, S2, S10.
    'la pagina si rimonta (S1)' => ['la pagina si rimonta'],
    'la pagina in un `div` suo (S1)' => ['lì non è figlia diretta di `main.zr-main`'],
    // Lettura della PR #56, R5: col percorso la pagina è figlia di `div.zr-main-body`.
    'la pagina sempre figlia diretta di `main.zr-main` (PR #56, R5)' => ['resta figlia diretta di `main.zr-main`'],
    'la risposta di zr-auth senza dire da quale versione (S2)' => ['arriva quella di zr-auth, coi `mancanti`'],
    'le tre forme (S10)' => ['in tre forme'],
]);

it('la guida del modulo nuovo non dice più che nello stato ridotto la pagina si rimonta (sprint 25 · T5.1)', function () {
    $frase = 'e si rimonta quando lo stato arriva';

    expect(str_contains(suUnaRiga(guidaDelModuloNuovo()), $frase))->toBe(false)
        // Il controllo vede ciò che cerca: la frase, a capo, su una riga è quella.
        ->and(str_contains(suUnaRiga(str_replace(' ', "\n", $frase)), $frase))->toBe(true);
});

// Seconda lettura della PR #52, S6 (sprint 25 · T5.4). Il punto «La voce attiva» diceva «senza `active` è la Dashboard», e l'eccezione
// dello stato ridotto stava solo più sotto: chi legge quel punto la trova lì.
it('il README dice, al punto «La voce attiva» di «La cornice», l\'eccezione dello stato ridotto (sprint 25 · T5.4)', function () {
    $punto = puntoDellaCornice((string) file_get_contents(__DIR__.'/../../README.md'), 'La voce attiva');

    expect($punto)->not->toBe('')
        ->and(str_contains($punto, 'senza `active`, o con `active` vuoto, è la Dashboard — tranne nello stato ridotto su una pagina di un modulo, dove nessuna voce è segnata'))->toBe(true);
});

// Seconda lettura della PR #52, S6 (sprint 25 · T5.4). Chi legge il tipo nell'editor vede il commento di `active`, non il README:
// l'eccezione dello stato ridotto sta anche lì.
it('il commento di `active` in `CorniceProps` dice l\'eccezione dello stato ridotto: su una pagina di un modulo, senza `active` o con `active` vuoto, nessuna voce è segnata (sprint 25 · T5.4)', function () {
    // Il commento sta su più righe: si legge senza gli asterischi di mezzo.
    $cornice = suUnaRiga((string) preg_replace('/\n\s*\* /', ' ', (string) file_get_contents(__DIR__.'/../../resources/js/cornice.tsx')));

    expect(str_contains($cornice, '/** L\'id della voce attiva; senza, o vuoto, la Dashboard — tranne nello stato ridotto su una pagina di un modulo, dove nessuna voce è segnata. Con `null` nessuna voce della barra è attiva. */'))->toBe(true);
});

it('ciò che il README e la guida dicono di chi non ha accettato non nomina un documento, e non dice che la cornice fa accettare (sprint 24 · T2.7)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    preg_match('/^\*\*Chi non ha accettato i documenti legali\*\*.*?(?=^$|\z)/ms', $readme, $dellaParteServer);
    preg_match('/^\*\*Chi non ha accettato i documenti legali\*\*.*?(?=^$|\z)/ms', guidaDelModuloNuovo(), $dellaGuida);
    $testi = [
        'il punto di «La cornice»' => puntoDellaCornice($readme, 'Chi non ha accettato i documenti legali'),
        'il capoverso della parte server' => suUnaRiga($dellaParteServer[0] ?? ''),
        'il capoverso della guida' => suUnaRiga($dellaGuida[0] ?? ''),
    ];
    $documento = '/(?<![\p{L}])(?:termini|condizioni|privacy|cookie|dpa|informativa)(?![\p{L}])/iu';

    expect(array_filter($testi, fn (string $testo): bool => $testo === ''))->toBe([])
        ->and(array_filter($testi, fn (string $testo): bool => preg_match($documento, $testo) === 1))->toBe([])
        ->and(array_filter($testi, fn (string $testo): bool => preg_match('/(?<!non )fa accettare/u', $testo) === 1))->toBe([])
        // Il controllo vede ciò che cerca.
        ->and(preg_match($documento, 'devi accettare i Termini di servizio'))->toBe(1)
        ->and(preg_match('/(?<!non )fa accettare/u', 'la cornice fa accettare i documenti'))->toBe(1);
});

it('la guida del modulo nuovo ha la riga su chi non ha accettato i documenti legali: che cosa dà la parte server, che cosa fa il modulo, e dove lo dice il README (sprint 24 · T2.7)', function (string $frase) {
    expect(str_contains(suUnaRiga(guidaDelModuloNuovo()), $frase))->toBe(true);
})->with([
    'che cosa dà la parte server' => ['`Cornice::dati()` non lancia e dà i dati ridotti, con `accettazione_richiesta: true`'],
    'di chi è la pagina' => ['un avviso che porta alla pagina dell\'accettazione, che è di zr-home'],
    // Lettura della PR #52, R3 e R5: il rimando è delle visite, e `prodotti` vuoto è una lista.
    'che cosa fa il modulo' => ['Tu dai i dati così come sono, non leggi `prodotti` vuoto come «Presto» (lì è una lista vuota, `[]`) e per le visite non scrivi un rimando tuo'],
    'il rimando è di zr-auth' => ['dalle tue chiamate a `/v1` lo fa zr-auth, dalla sua `v0.12.17`, con l\'eccezione `AccettazioneRichiesta` — 302 a una visita, 409 con `X-Inertia-Location` a una visita di Inertia'],
    'a una richiesta JSON decide il modulo' => ['A una tua richiesta JSON zr-auth risponde 403 con `codice` e `mancanti`, senza rimando: lì decidi tu che cosa mostrare'],
    'nessun middleware sulle rotte della cornice' => ['Sulle rotte `/cornice/*` non mettere un middleware che chiama `/v1` senza prendere quel 403'],
    // Seconda lettura della PR #52, S1 (sprint 25 · T5.1).
    'la pagina non si rimonta' => ['Nello stato ridotto l\'avviso sta sopra la tua pagina, che resta dov\'è e non si rimonta quando lo stato arriva o se ne va: ciò che è scritto in un campo resta'],
    'dove lo dice il README' => ['README, «La cornice», al punto «Chi non ha accettato i documenti legali»'],
]);

// Sprint 25 · T2 (voce #1759). L'ingresso per le app, `resources/js/app.ts`: la cornice senza `Zeiras`, e i componenti del
// design system per nome dal loro modulo, così nella build di un frontend entra solo ciò che l'app usa. Lo zip del tag porta i
// tre file; il README dice i due ingressi, il passaggio, che cosa da lì non si scrive, che i due non si mescolano, i pesi e
// come misurarli nel frontend; la guida dice a un modulo che nasce da dove parte. I pesi li misura vitest (peso.test.ts), che
// li confronta coi numeri del README.

/** Il testo di un ingresso di resources/js; vuoto se il file non c'è. */
function ingressoJs(string $file): string
{
    $percorso = dirname(__DIR__, 2).'/resources/js/'.$file;

    return is_file($percorso) ? (string) file_get_contents($percorso) : '';
}

it('lo zip porta l\'ingresso per le app e il modulo dei componenti coi suoi tipi, accanto all\'ingresso di sempre, e non ciò che li genera e li pesa (sprint 25 · T2.5)', function () {
    $zip = fileDelloZipDiHead();
    // Dalla `v3.1.0` (sprint 71 · T1.5) anche il modulo di MentionField coi suoi tipi, dalla `v3.2.0` (sprint 72 · T1.5) quello di
    // AddressField, dalla `v3.3.0` (sprint 75 · T1.1) i CSS divisi da bundle.css.
    $delPacchetto = ['resources/css/zeiras.css', 'resources/css/zeiras/MentionField.css', 'resources/css/zeiras/AddressField.css', 'resources/js/app.ts', 'resources/js/index.ts', 'resources/js/zeiras/componenti.js', 'resources/js/zeiras/componenti.d.ts', 'resources/js/zeiras/MentionField.js', 'resources/js/zeiras/MentionField.d.ts', 'resources/js/zeiras/AddressField.js', 'resources/js/zeiras/AddressField.d.ts'];
    $degliStrumenti = fn (string $file): bool => str_starts_with($file, 'scripts/') || str_starts_with($file, 'resources/demo/') || str_ends_with($file, '.test.ts');

    expect(array_values(array_diff($delPacchetto, $zip)))->toBe([])
        ->and(array_values(array_filter($zip, $degliStrumenti)))->toBe([]);
});

it('l\'ingresso per le app esporta i nomi dell\'ingresso di sempre tranne Zeiras, e non importa il modulo che scrive window.Zeiras (sprint 25 · T2.4)', function () {
    $esportati = fn (string $testo): array => nomiFraLeGraffe('/^export \{([^}]*)\} from \'[^\']+\';$/m', $testo);
    $diSempre = $esportati(ingressoJs('index.ts'));
    $perLeApp = $esportati(ingressoJs('app.ts'));

    expect($diSempre)->toContain('Zeiras')
        ->and($perLeApp)->not->toBe([])
        ->and($perLeApp)->toBe(array_values(array_diff($diSempre, ['Zeiras'])))
        ->and(preg_match('/from \'\.\/zeiras\'|from \'\.\/zeiras\/index\'|import \'\.\/zeiras/', ingressoJs('app.ts')))->toBe(0)
        ->and(preg_match('/from \'\.\/zeiras\'/', ingressoJs('index.ts')))->toBe(1);
});

it('il README importa dall\'ingresso per le app solo nomi che quell\'ingresso esporta (sprint 25 · T2.5)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $importati = fn (string $testo): array => nomiFraLeGraffe('/^\s*import \{([^}]*)\} from \'[^\']*\/zr-core\/resources\/js\/app\';$/m', $testo);
    $esportati = nomiFraLeGraffe('/^export \{([^}]*)\} from \'[^\']+\';$/m', ingressoJs('app.ts'));

    // Un esempio che importa dall'ingresso per le app il nome che lì non c'è.
    $conZeiras = str_replace('import { Cornice, type DatiDellaCornice } from \'../../vendor/zeiras/zr-core/resources/js/app\';', 'import { Cornice, Zeiras } from \'../../vendor/zeiras/zr-core/resources/js/app\';', $readme);

    expect($importati($readme))->toBe(['Cornice', 'DatiDellaCornice'])
        ->and(array_values(array_diff($importati($readme), $esportati)))->toBe([])
        ->and($conZeiras)->not->toBe($readme)
        ->and(array_values(array_diff($importati($conZeiras), $esportati)))->toBe(['Zeiras']);
});

it('il README dice, in «Come si installa in un frontend», i due ingressi, il passaggio, che cosa dall\'ingresso per le app non si scrive, che i due non si mescolano, i pesi e come misurarli (sprint 25 · T2.5)', function (string $frase) {
    $sezione = sezioneDelReadme((string) file_get_contents(__DIR__.'/../../README.md'), 'Come si installa in un frontend');

    expect(str_contains($sezione, $frase))->toBeTrue();
})->with([
    'l\'ingresso per le app' => ['**L\'ingresso per le app**, `resources/js/app` (dalla `v1.15.0`): la cornice e ciò che le sta intorno, cioè gli stessi nomi dell\'ingresso di sempre tranne `Zeiras`'],
    'i componenti per nome' => ['I componenti del design system si prendono per nome dal loro modulo, `resources/js/zeiras/componenti`, e nella build del frontend entra solo ciò che l\'app usa'],
    'MentionField a parte (sprint 71 · T1.5)' => ['**MentionField ha anche un modulo suo** (dalla `v3.1.0`), `resources/js/zeiras/MentionField`, per chi lo usa solo in una pagina o in un dialogo che si carica a richiesta (`import()`)'],
    'MentionField, l\'import' => ['import { MentionField, type MentionOption } from \'../../vendor/zeiras/zr-core/resources/js/zeiras/MentionField\';'],
    'MentionField, da un posto solo' => ['Nella stessa app si prende da un posto solo: le due copie hanno ognuna il suo contatore degli id dei campi'],
    'AddressField a parte (sprint 72 · T1.5)' => ['**AddressField ha un modulo suo allo stesso modo** (dalla `v3.2.0`, col design system che lo porta), `resources/js/zeiras/AddressField`, con le stesse regole'],
    'AddressField, l\'import' => ['import { AddressField, type AddressPlace, type AddressSuggestion } from \'../../vendor/zeiras/zr-core/resources/js/zeiras/AddressField\';'],
    'AddressField, chi chiama Google' => ['AddressField non chiama Google: i suggerimenti di Google Places li chiede il frontend dalla sua parte server, a ogni `onQuery`, e li passa al campo in `suggestions`. Per un modulo di Zeiras a parlare con Google è un metodo di zr-backoffice, non il server del modulo. Il browser non parla con Google, e la CSP della cornice non cambia.'],
    'AddressField, spento' => ['Nei frontend la ricerca di Google resta spenta (il campo accetta il testo libero) finché la chiave e l\'informativa non sono approvate.'],
    'l\'import dei componenti' => ['import * as Zeiras from \'../../vendor/zeiras/zr-core/resources/js/zeiras/componenti\';'],
    'che cosa non si scrive' => ['Da questo ingresso nessuno scrive `window.Zeiras` né `window.React`.'],
    'l\'ingresso di sempre' => ['**L\'ingresso di sempre**, `resources/js`: in più dà `Zeiras`, il design system intero in un oggetto, e lo scrive anche in `window.Zeiras`, con `window.React`. Resta com\'è, coi nomi di prima'],
    'il passaggio, i componenti' => ['`import * as Zeiras from \'…/resources/js/zeiras/componenti\'` al posto di `import { Zeiras } from \'…/resources/js\'`'],
    'il passaggio, il resto' => ['gli altri nomi da `…/resources/js/app` al posto di `…/resources/js`'],
    'non si mescolano' => ['I due ingressi non si mescolano nella stessa app: basta un file che importa ancora dall\'ingresso di sempre perché nella build torni il design system intero'],
    'niente si rompe' => ['Non si rompe niente (i componenti sono gli stessi oggetti, in una copia sola), ma il peso torna quello di prima'],
    'chi spia un componente' => ['dalla `v1.15.0` spia il modulo dei componenti (`import * as componenti from \'…/resources/js/zeiras/componenti\'`, poi `vi.spyOn(componenti, \'AppShell\')`), da qualunque ingresso'],
    // Lettura della PR #56, R6.
    'chi confronta `children` con la pagina' => ['E ciò che la cornice dà all\'`AppShell` come `children` dalla `v1.15.0` è sempre un frammento, anche fuori dallo stato ridotto: la pagina è il suo secondo figlio, e un caso che confrontava `children` con la pagina la cerca lì'],
    'la tabella dei pesi' => ['| App di prova | JS | con gzip |'],
    'il peso della sola cornice' => ['| solo la cornice, dall\'ingresso per le app |'],
    'il peso con due componenti' => ['| la cornice e due componenti per nome |'],
    'il peso dall\'ingresso di sempre' => ['| la stessa cornice, dall\'ingresso di sempre |'],
    'quali componenti' => ['I due componenti sono `Button` e `DataTable`.'],
    'come si misura' => ['`find public/build/assets -name \'*.js\' -exec gzip -9 -c {} + | wc -c` dà i byte di tutto il JS, con gzip'],
    'quando il passaggio è completo' => ['`grep -rhoE --include=\'*.js\' \'window\.Zeiras ?= ?Object\.assign\' public/build | wc -l`: risponde 0 dall\'ingresso per le app, 1 finché un file importa dall\'ingresso di sempre'],
]);

it('il README non dice più che l\'ingresso scrive window.React prima di caricare il design system: dalla v1.15.0 il bundle non si carica (sprint 25 · T2.5)', function () {
    $readme = suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md'));

    expect(str_contains($readme, 'prima di caricare il design system'))->toBeFalse()
        ->and(str_contains($readme, 'da uno dei due ingressi del pacchetto (due dalla `v1.15.0`)'))->toBeTrue();
});

it('la guida dice a un modulo che nasce di partire dall\'ingresso per le app, coi due file, che cosa risponde la prova e che i due ingressi non si mescolano (sprint 25 · T2.5)', function (string $frase) {
    expect(str_contains(suUnaRiga(guidaDelModuloNuovo()), $frase))->toBeTrue();
})->with([
    'da dove parte' => ['Un modulo che nasce parte dall\'ingresso per le app (dalla `v1.15.0`): la cornice da `vendor/zeiras/zr-core/resources/js/app.ts`, i componenti del design system per nome da `vendor/zeiras/zr-core/resources/js/zeiras/componenti.js`, e nella tua build entra solo ciò che usi'],
    'la prova' => ['risponde 0 (dall\'ingresso di sempre, dove `Zeiras` è il design system intero, risponde 1)'],
    'non si mescolano' => ['I due ingressi non si mescolano: un file che importa ancora dall\'ingresso di sempre riporta nella build il design system intero'],
    'il test di allineamento' => ['lo sha256 di `bundle.js` resta il segno che il design system è cambiato'],
]);

it('le pagine di prova sono tre, e quella dell\'ingresso per le app prende la cornice da lì e scrive se window.Zeiras c\'è (sprint 25 · T2.3)', function () {
    $costruzione = (string) file_get_contents(__DIR__.'/../../vite.demo.config.ts');

    expect(substr_count($costruzione, "input: ['index.html', 'app.html', 'layout.html']"))->toBe(1)
        ->and(scritteNellaPaginaDiProva('app.html', ['<script type="module" src="./app.tsx"></script>']))->toBe(['<script type="module" src="./app.tsx"></script>' => 1])
        ->and(scritteNellaPaginaDiProva('app.tsx', ["import { Cornice } from '../js/app';", "window.Zeiras: {'Zeiras' in window ? 'presente' : 'assente'}"]))
        ->toBe(["import { Cornice } from '../js/app';" => 1, "window.Zeiras: {'Zeiras' in window ? 'presente' : 'assente'}" => 1])
        ->and(scritteNellaPaginaDiProva('index.tsx', ["import { Cornice } from '../js';"]))->toBe(["import { Cornice } from '../js';" => 1]);
});

// Sprint 26 · T3 (lettura della PR #56, N6). Il registro dei moduli lo leggevano due classi, la ricerca e l'elenco delle
// notifiche, ognuna con la sua lettura del file e la sua copia tenuta per il processo: un terzo lettore sarebbe stato una terza
// copia. Lo legge una classe sola, `Zeiras\Core\Registro`, interna al pacchetto, e le rotte le voci le chiedono a lei. Le
// risposte delle rotte sono quelle di prima.

it('in src/ il file del registro dei moduli lo apre una classe sola, `Registro`: le due rotte che lo usano le voci le chiedono a lei, una volta l\'una nel codice, e non leggono nessun file (sprint 26 · T3.2)', function () {
    $sorgenti = [];
    foreach (File::allFiles(__DIR__.'/../../src') as $file) {
        $sorgenti[str_replace('\\', '/', $file->getRelativePathname())] = senzaCommenti($file->getContents());
    }

    // Nel codice, non in un commento: i commenti delle rotte possono nominare il file.
    // Sprint 70 · T1.4 (voce #2429): dalla `v3.0.0` i file sono due, le voci e le righe delle notifiche, e li legge `Registro`.
    // Sprint 74 · T2 (voce 2549): dalla `v3.6.0` tre, con le risorse della ricerca di Bookings.
    expect(array_keys(array_filter($sorgenti, fn (string $codice): bool => str_contains($codice, 'registro/prodotti.json') || str_contains($codice, 'registro/notifiche.json') || str_contains($codice, 'registro/ricerca.json'))))->toBe(['Registro.php'])
        ->and(substr_count($sorgenti['Registro.php'], 'file_get_contents('))->toBe(3)
        ->and(substr_count($sorgenti['Registro.php'], "file_get_contents(__DIR__.'/../resources/registro/ricerca.json')"))->toBe(1)
        ->and(substr_count($sorgenti['Registro.php'], "file_get_contents(__DIR__.'/../resources/registro/prodotti.json')"))->toBe(1)
        ->and(substr_count($sorgenti['Registro.php'], "file_get_contents(__DIR__.'/../resources/registro/notifiche.json')"))->toBe(1)
        ->and(array_map(fn (string $rotta): array => [substr_count($sorgenti[$rotta], 'file_get_contents('), substr_count($sorgenti[$rotta], 'Registro::voci()')], ['Http/RicercaDellaCornice.php', 'Http/NotificheDellaCornice.php']))
        ->toBe([[0, 1], [0, 1]]);
});

it('`Registro` legge il file una volta per processo: la prima richiesta dà le voci del registro del pacchetto e le tiene, e con delle voci già in mano dà quelle, senza tornare al file (sprint 26 · T3.2)', function () {
    $voci = new ReflectionProperty(Registro::class, 'voci');

    // Prima della prima richiesta la classe non ha niente in mano: la copia del caso prima l'ha tolta `tests/Pest.php`.
    expect($voci->getValue())->toBeNull()
        ->and(Registro::voci())->toBe(registroDeiProdotti())
        ->and($voci->getValue())->toBe(registroDeiProdotti());
    // Voci che il file non ha: se la classe tornasse al file a ogni richiesta, darebbe quelle del pacchetto.
    registroGiaLetto([['id' => 'uat-gia-letto']]);
    expect(Registro::voci())->toBe([['id' => 'uat-gia-letto']]);
});

it('`Registro` non ha un metodo che scrive il registro né uno che sceglie un altro file: fuori dal privato ha il solo `voci()`, statico e senza argomenti, e l\'unica proprietà è privata; è una classe interna, non per chi installa il pacchetto (sprint 26 · T3.3)', function () {
    $classe = new ReflectionClass(Registro::class);
    $nomi = fn (array $membri): array => array_map(fn (ReflectionMethod|ReflectionProperty $membro): string => $membro->getName(), $membri);

    expect($nomi($classe->getMethods(ReflectionMethod::IS_PUBLIC | ReflectionMethod::IS_PROTECTED)))->toBe(['voci'])
        ->and($classe->getMethod('voci')->isStatic())->toBe(true)
        ->and($classe->getMethod('voci')->getNumberOfParameters())->toBe(0)
        ->and($nomi($classe->getProperties()))->toBe(['voci'])
        ->and($classe->getProperty('voci')->isPrivate())->toBe(true)
        ->and($classe->isFinal())->toBe(true)
        ->and(str_contains((string) $classe->getDocComment(), '@internal'))->toBe(true);
});

// Sprint 28 · T3.5 (voce #1827): `Cornice::frenata()`. Il README lo dice dove dice la riga, in «La parte server»: che cosa dà,
// che non legge, che il freno è lo stato e vale per quella richiesta; e mostra il middleware di un modulo che dopo la riga
// risponde col suo 429. Quel middleware gira in `CorniceDatiTest.php`, riga per riga: lì si vede che dopo il freno il
// backoffice non è più chiamato.

it('il README dice, in «La parte server», `Cornice::frenata()`: da quale versione, che cosa dà, che non legge, che il freno è lo stato e vale per quella richiesta, e che la riga e i dati non cambiano (sprint 28 · T3.5)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $scambiate = conParteServerECorniceScambiate($readme);

    expect(str_contains(sezioneDelReadme($readme, 'La parte server'), $frase))->toBe(true)
        ->and(str_contains(sezioneDelReadme($scambiate, 'La parte server'), $frase))->toBe(false);
})->with([
    'da quale versione' => ['il modulo lo sa da `Cornice::frenata()` (dalla `v1.18.0`)'],
    'che cosa dà' => ['dà l\'`ErroreApi` di quella lettura, coi secondi di `Retry-After` in `riprovaFra` (`null` se il backoffice non li dice)'],
    'null in ogni altro caso' => ['`null` in ogni altro caso — senza una lettura in quella richiesta, dopo una lettura andata bene, dopo un altro errore'],
    // Lettura della PR #61, R5: il freno è quello di io.mostra; il 429 delle altre tre letture di `dati()` lo dà l'eccezione.
    'non legge' => ['`Cornice::frenata()` non legge niente: guarda la lettura di `io.mostra` che `Cornice::lingua()` o `Cornice::dati()` hanno già fatto, e solo quella'],
    'le altre tre letture' => ['Un 429 che `Cornice::dati()` prende da una delle altre sue tre letture (`/v1/app`, `/v1/io/aziende`, `/v1/io/workspace`) lo dà l\'`ErroreApi` che `dati()` lancia, e `Cornice::frenata()` resta `null`'],
    'il freno è lo stato' => ['Il freno è lo stato, 429, con qualunque codice'],
    'a chi serve' => ['dopo un 429 non si richiama, e il middleware risponde col suo 429 prima che parta un\'altra chiamata'],
    'vale per quella richiesta' => ['Il freno vale per quella richiesta: la richiesta dopo non lo trova, finché una sua lettura non prende un altro 429'],
    'la riga e i dati non cambiano' => ['`Cornice::lingua()` e `Cornice::dati()` fanno ciò che facevano: la prima non lancia, la seconda lancia quell\'`ErroreApi`'],
]);

it('l\'esempio del README con `Cornice::frenata()` è, riga per riga, il middleware che `CorniceDatiTest.php` fa girare: comincia dalla riga, risponde 429 e solo dopo passa la richiesta (sprint 28 · T3.5)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    preg_match('/^## La parte server$.*?^```php\n((?:(?!^```).)*?Cornice::frenata\(\).*?)^```$/ms', $readme, $blocco);
    $righe = array_values(array_filter(array_map('trim', explode("\n", $blocco[1] ?? '')), fn (string $riga): bool => $riga !== ''));
    $delCaso = array_map('trim', explode("\n", (string) file_get_contents(__DIR__.'/CorniceDatiTest.php')));
    $primo = array_search('$freno = Cornice::frenata();', $delCaso, true);
    $girano = array_values(array_filter(array_slice($delCaso, (int) $primo - 2, 9), fn (string $riga): bool => $riga !== ''));

    expect($righe)->toBe([
        'App::setLocale(Cornice::lingua() ?? config(\'app.locale\'));',
        '$freno = Cornice::frenata();',
        'if ($freno !== null) {',
        'return response(\'\', 429, $freno->riprovaFra === null ? [] : [\'Retry-After\' => (string) $freno->riprovaFra]);',
        '}',
        'return $next($request);',
    ])
        ->and($primo)->not->toBe(false)
        ->and($girano)->toBe($righe);
});

// Sprint 28 · T4.6 (voce #1828; `Decisione:` 11310 di zr-pm): «Salta al contenuto» è il primo elemento della cornice. Il README
// lo dice in un punto suo di «La cornice»: che c'è e da quando, che cosa fa, che il modulo non deve fare niente, e che è
// provvisorio. È fatto coi pezzi del design system: nel pacchetto non nasce un foglio di stile, e la copia del design system
// non cambia.

it('il README dice, nel punto «Salta al contenuto» di «La cornice», che c\'è e da quando, che cosa fa, che il modulo non deve fare niente e che è provvisorio (sprint 28 · T4.6)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');

    expect(str_contains(puntoDellaCornice($readme, '«Salta al contenuto»'), $frase))->toBe(true)
        // Con «La parte server» e «La cornice» scambiate il punto è sotto l'altro titolo: non è più dove si legge della cornice.
        ->and(puntoDellaCornice(conParteServerECorniceScambiate($readme), '«Salta al contenuto»'))->toBe('');
})->with([
    'che c\'è, e da quando' => ['è il primo elemento della cornice da tastiera, dalla `v1.18.0`'],
    'dove sta' => ['un pulsante davanti alla barra laterale e alla barra in alto, che non si vede finché non ha il fuoco'],
    'dove compare' => ['Col primo Tab compare in alto a sinistra, sopra la cornice'],
    'che cosa fa' => ['Invio, Spazio o un clic portano il fuoco al contenuto della pagina, il `main` dell\'`AppShell`'],
    'il Tab dopo' => ['il Tab dopo va al primo elemento della pagina invece di rifare tutta la barra'],
    'nello stato ridotto' => ['C\'è anche nello stato ridotto'],
    'il modulo non deve fare niente' => ['Il modulo non deve fare niente: non gli serve un `id` sul suo contenuto, e non ne scriva uno suo'],
    // Lettura della PR #61, R3, R4 e R12.
    'quale main' => ['Il `main` è quello dell\'`AppShell`, anche se il frontend ne ha uno suo prima della cornice o intorno a lei'],
    'che cosa cambia per chi aggiorna' => ['`.zr-shell` non è più il primo elemento di ciò che la `Cornice` rende (prima c\'è il `div` del pulsante), e dopo un salto il `main` ha `tabindex="-1"` finché tiene il fuoco'],
    'i test da rileggere' => ['Un test del modulo sul primo figlio della cornice, su `:first-child` o sul primo elemento che prende il fuoco va riletto'],
    'è provvisorio' => ['È provvisorio: l\'`AppShell` del design system non ha ancora il suo'],
    'coi pezzi del design system' => ['la cornice lo fa coi soli pezzi del design system (il `Button`, la classe `zr-visually-hidden`, i token)'],
    'si toglie' => ['quando l\'`AppShell` lo porta questo si toglie, senza che il modulo cambi niente'],
]);

// Sprint 30 · T3.5 (voce #1871): aprendo la campanella il fuoco entra nel pannello delle notifiche. È un rimedio della cornice a
// ciò che l'`AppShell` non fa ancora: il README lo dice in un punto suo di «La cornice», con ciò che cambia per chi aggiorna, e
// lo dice provvisorio.

it('il README dice, nel punto «Il fuoco nel pannello delle notifiche» di «La cornice», da quando e che cosa fa, che il modulo non deve fare niente e che è provvisorio (sprint 30 · T3.5)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');

    expect(str_contains(puntoDellaCornice($readme, 'Il fuoco nel pannello delle notifiche'), $frase))->toBe(true)
        // Con «La parte server» e «La cornice» scambiate il punto è sotto l'altro titolo: non è più dove si legge della cornice.
        ->and(puntoDellaCornice(conParteServerECorniceScambiate($readme), 'Il fuoco nel pannello delle notifiche'))->toBe('');
})->with([
    'da quando, e che cosa fa' => ['dalla `v1.20.0`, aprendo la campanella — con Invio, con Spazio o col clic — il fuoco della tastiera entra nel pannello, sulla linguetta scelta'],
    // Review della PR #63, R17: dopo «Riprova» e «Segna tutte come lette» il pulsante premuto sparisce, e il fuoco non «resta dov'è».
    'solo all\'apertura' => ['Il fuoco si sposta solo all\'apertura: quando arriva l\'elenco o cambiando linguetta resta dov\'è, e dopo «Riprova» o «Segna tutte come lette» la cornice non lo riporta sulla linguetta'],
    'dopo un pulsante che sparisce' => ['Quei due pulsanti, premuti, spariscono — con l\'errore, o con l\'ultima non letta —, e dove va il fuoco allora lo decide il browser: di solito esce dal pannello, che resta aperto'],
    // R14: solo il pannello dell'`AppShell`.
    'solo il pannello della cornice' => ['Il pannello è quello che l\'`AppShell` scrive accanto alla campanella: un elemento di una pagina con la stessa classe non prende il fuoco'],
    'Esc' => ['Esc chiude il pannello e riporta il fuoco sulla campanella, come prima'],
    'nello stato ridotto' => ['Vale anche nello stato ridotto'],
    'i test da rileggere' => ['Il modulo non deve fare niente; un test del modulo che apre la campanella e poi guarda l\'elemento attivo va riletto'],
    'è provvisorio' => ['È provvisorio: l\'`AppShell` del design system apre il pannello e lascia il fuoco sulla campanella'],
    'senza toccare il componente' => ['la cornice lo sposta da sé, senza toccare il componente'],
    'si toglie' => ['quando l\'`AppShell` lo porta questo si toglie, senza che il modulo cambi niente'],
    'a richiesta' => ['Il rimedio sta in un pezzo a richiesta che la cornice chiede quando si monta'],
    'se non arriva' => ['se non arriva, la campanella si apre come prima, col fuoco sul pulsante'],
    // R8: l'evento di Vite per un pezzo che non arriva.
    'l\'evento di Vite' => ['Se non arriva, l\'aiuto di Vite manda su `window` l\'evento `vite:preloadError`: un frontend che a quell\'evento ricarica la pagina la ricarica anche per questo pezzo'],
]);

// Sprint 65 · T2 (voce #2340): il menu del profilo e la barra dei moduli senza errori di accessibilità. Altri due rimedi provvisori
// nello stesso pezzo a richiesta: il README li dice nel loro punto di «La cornice», da quando, che cosa fanno, che il modulo non
// deve fare niente e che sono provvisori.

it('il README dice, nel punto «Menu del profilo e barra dei moduli senza errori di accessibilità» di «La cornice», da quando e che cosa fanno, che il modulo non deve fare niente e che sono provvisori (sprint 65 · T2)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');

    expect(str_contains(puntoDellaCornice($readme, 'Menu del profilo e barra dei moduli senza errori di accessibilità'), $frase))->toBe(true)
        ->and(puntoDellaCornice(conParteServerECorniceScambiate($readme), 'Menu del profilo e barra dei moduli senza errori di accessibilità'))->toBe('');
})->with([
    'da quando, e l\'avatar' => ['dalla `v2.22.1`, nel menu del profilo aperto l\'avatar dell\'intestazione è nascosto ai lettori di schermo (`aria-hidden`)'],
    'il nome e l\'email restano' => ['il nome e l\'email restano scritti accanto'],
    'la barra inert' => ['la barra dei moduli dietro, già nascosta (`aria-hidden`), è anche `inert`'],
    'chiuso torna com\'era' => ['chiuso il selettore torna com\'era'],
    'i test da rileggere' => ['Il modulo non deve fare niente; un test del modulo che cerca per ruolo l\'avatar del menu del profilo non lo trova più'],
    'è provvisorio' => ['È provvisorio: il menu e la barra sono dell\'`AppShell` del design system'],
    'si toglie' => ['quando l\'`AppShell` lo porta questo si toglie, senza che il modulo cambi niente'],
    'se non arriva' => ['se non arriva, il menu e la barra restano com\'erano'],
]);

// Sprint 30 · T4.8 (voce #1870): con un `Dialog` aperto, o un `DetailPanel` sotto 720 px, Tab resta dentro. È un altro rimedio
// della cornice a ciò che i componenti non fanno ancora: il README lo dice in un punto suo di «La cornice», provvisorio, con
// ciò che non copre.

it('il README dice, nel punto «Tab dentro un dialogo aperto» di «La cornice», da quando e che cosa fa, che è provvisorio e che cosa non copre (sprint 30 · T4.8)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');

    expect(str_contains(puntoDellaCornice($readme, 'Tab dentro un dialogo aperto'), $frase))->toBe(true)
        // Con «La parte server» e «La cornice» scambiate il punto è sotto l'altro titolo: non è più dove si legge della cornice.
        ->and(puntoDellaCornice(conParteServerECorniceScambiate($readme), 'Tab dentro un dialogo aperto'))->toBe('');
})->with([
    'da quando, e che cosa fa' => ['dalla `v1.20.0`, con un `Dialog` aperto il fuoco della tastiera resta nel dialogo'],
    'il giro' => ['Tab dall\'ultimo elemento torna al primo, Maiusc+Tab dal primo va all\'ultimo, e se il fuoco è ancora fuori il primo Tab entra'],
    'il pannello sotto 720 px' => ['Lo stesso per un `DetailPanel` sotto 720 px, dove è largo tutta la pagina; da 721 px in su Tab esce verso la pagina, come vuole la linea guida'],
    'uno sopra l\'altro' => ['Con un dialogo sopra un pannello vale il dialogo'],
    // Review della PR #63, R5: sotto 720 px il dialogo aperto da un pannello deve vedersi.
    'il dialogo si vede' => ['Con un dialogo sopra un pannello vale il dialogo, e il dialogo si vede: sotto 720 px il CSS del design system mette il pannello un gradino sopra i dialoghi, e la cornice alza il velo di ogni `Dialog` aperto a `--z-dialog` + 2, sopra il pannello'],
    // R10 e R12: un menu accanto al dialogo, e un elemento che tiene Tab per sé.
    'anteprime e menu' => ['Le anteprime (`inline`) non trattengono niente, e con un `Menu` aperto dentro il dialogo, o col fuoco in un menu accanto, la cornice non interviene'],
    // Seconda lettura della PR #63 (S5, S6, S16).
    'un menu altrove' => ['un menu che sta altrove nella pagina, senza il fuoco, non cambia niente'],
    'Tab coi modificatori' => ['né se Tab è premuto con Ctrl, Alt o Meta'],
    'se il pezzo non arriva' => ['se non arriva, Tab fa il giro di prima, e sotto 720 px un `Dialog` aperto da un `DetailPanel` resta sotto il pannello'],
    'il gradino è provvisorio' => ['Anche il gradino del velo è provvisorio'],
    'Tab tenuto da un elemento' => ['non interviene nemmeno se un elemento del dialogo tiene Tab per sé (`preventDefault`)'],
    'il modulo non deve fare niente' => ['Il modulo non deve fare niente, e non scriva una trappola sua: sarebbero due'],
    'è provvisorio' => ['È provvisorio: `Dialog` e `DetailPanel` del design system non trattengono ancora il fuoco'],
    'senza toccare i componenti' => ['la cornice lo fa da sé, senza toccare i componenti'],
    'si toglie' => ['quando lo fanno loro questo si toglie, senza che il modulo cambi niente'],
    'che cosa non copre' => ['Non copre due cose: una pagina senza la cornice, dove un dialogo aperto non trattiene niente, e il primo campo in fuoco all\'apertura, che resta del modulo'],
    'a richiesta' => ['Sta nello stesso pezzo a richiesta del punto sopra: se non arriva, Tab fa il giro di prima'],
]);

// Sprint 31 · T3.7 (voce #1907): i casi che i due rimedi di tastiera non chiudevano (review della PR #63: R11, R13, R14, R19, S11
// e S13). Il README li dice nei due punti dei rimedi, da quando, e dice quelli che restano fuori.

it('il README dice, nei due punti dei rimedi di tastiera di «La cornice», i casi chiusi dalla `v1.21.0` e quelli che restano fuori (sprint 31 · T3.7)', function (string $punto, string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');

    expect(str_contains(puntoDellaCornice($readme, $punto), $frase))->toBe(true);
})->with([
    'la campanella chiusa col clic' => ['Il fuoco nel pannello delle notifiche', 'Dalla `v1.21.0` il fuoco torna sulla campanella anche chiudendo il pannello col clic, dove il clic non dà il fuoco a un pulsante (Safari, Firefox su macOS)'],
    'il fuoco non si toglie' => ['Il fuoco nel pannello delle notifiche', 'A un elemento che lo ha preso — un campo cliccato fuori dal pannello — non si toglie'],
    'un dialogo senza fermate' => ['Tab dentro un dialogo aperto', 'Dalla `v1.21.0`: un `Dialog` che non ha niente su cui fermarsi — senza «×» e senza pulsanti — prende lui il fuoco al primo Tab, e Invio non preme più il pulsante della pagina dietro'],
    'inerti e dettagli chiusi' => ['Tab dentro un dialogo aperto', 'ciò che sta dentro un elemento `inert`, o dentro un `<details>` chiuso, non conta come fermata, tranne il `summary` che lo apre'],
    'iframe, video e audio' => ['Tab dentro un dialogo aperto', 'un `iframe`, e un `video` o un `audio` coi comandi, contano dove il browser li mette nel giro del Tab'],
    'resta fuori: dentro un iframe' => ['Tab dentro un dialogo aperto', 'Restano fuori anche tre casi: da dentro un `iframe` i tasti sono della sua pagina, e Tab dall\'ultimo suo elemento esce dal dialogo (il Tab dopo rientra)'],
    'resta fuori: lo shadow DOM' => ['Tab dentro un dialogo aperto', 'gli elementi dentro uno shadow DOM non si contano'],
    'resta fuori: un tabindex positivo' => ['Tab dentro un dialogo aperto', 'un `tabindex` maggiore di zero non cambia il giro, che per la cornice è l\'ordine del documento'],
    // Review della PR #64 (R2, R3, R4): il `summary` con ciò che ha dentro, i comandi di un video. La riga del fuoco dopo il clic su
    // una notifica è nel caso dello sprint 32 · T2.4, più sotto: la frase è cambiata.
    'il summary con ciò che ha dentro' => ['Tab dentro un dialogo aperto', 'tranne il `summary` che lo apre, con ciò che ha dentro'],
    'resta fuori: i comandi di un video' => ['Tab dentro un dialogo aperto', 'E un quarto, provato in Chrome: di un `video` o di un `audio` coi comandi la cornice conta una fermata sola, e quando è l\'ultima cosa del dialogo i comandi che il browser tiene al suo interno col Tab non si raggiungono'],
]);

// Sprint 32 · T1.3 (voce #1912; review della PR #64, R7 e R8): un riquadro che non si vede non è una fermata, e chiuso un dialogo
// senza fermate il fuoco torna a chi lo aveva. Il README li dice nel punto del Tab, da quando e in che browser sono provati.

it('il README dice, nel punto del Tab dentro un dialogo, i due casi chiusi dalla `v1.22.0` (sprint 32 · T1.3)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');

    expect(str_contains(puntoDellaCornice($readme, 'Tab dentro un dialogo aperto'), $frase))->toBe(true);
})->with([
    'un riquadro che non si vede' => ['Dalla `v1.22.0`: un `iframe` largo o alto zero — un riquadro di servizio, che non si vede — non conta come fermata, e Tab dal pulsante che lo precede torna alla prima invece di passare da lì e uscire dietro il velo'],
    'il fuoco torna a chi lo aveva' => ['chiuso un `Dialog` che non aveva niente su cui fermarsi, il fuoco torna all\'elemento che lo aveva prima che il dialogo lo prendesse, se è ancora in pagina e se nel frattempo non lo ha preso un altro (provati in Chrome)'],
    // Review della PR #65 (R1, R7, R13): un altro dialogo aperto intanto, il `tabindex` che resta, un DOM senza geometria.
    'un altro dialogo aperto intanto' => ['Se intanto si è aperto un altro dialogo, il fuoco torna solo a un elemento di quel dialogo: a un pulsante rimasto dietro il velo no, perché Invio lo premerebbe di nuovo (provato in Chrome)'],
    'il tabindex che resta' => ['Al dialogo che ha preso il fuoco resta il `tabindex="-1"` che la cornice gli ha scritto (provato in Chrome), anche se poi guadagna un pulsante (questo in un browser non è provato); riaperto, è un elemento nuovo e non lo ha'],
    'chiuso l\'altro dialogo' => ['Chiuso poi quell\'altro dialogo, il fuoco resta alla pagina: al pulsante di partenza non torna (provato in Chrome)'],
    'un DOM senza geometria' => ['Un test del modulo con un `iframe` in fondo a un `Dialog` va riletto: in un DOM senza geometria (happy-dom, jsdom) larghezza e altezza sono sempre zero, e lì un `iframe` non è mai una fermata'],
]);

// Sprint 32 · T2.4 (voce #1912; review della PR #64, R12): dove va il fuoco dopo il clic su una notifica o su «Vedi tutte» il
// README lo dice col browser in cui è provato (UAT, riga B5), e non di ogni browser. Che il fuoco ci vada lo prova
// `cornice.test.tsx` (sprint 32 · T2.4), non questo caso, che lega solo la frase.

it('il README dice, nel punto del fuoco nel pannello delle notifiche, dove va il fuoco dopo il clic su una notifica o su «Vedi tutte» e in quale browser è provato, e non lo dice più di ogni browser (sprint 32 · T2.4)', function () {
    $punto = puntoDellaCornice((string) file_get_contents(__DIR__.'/../../README.md'), 'Il fuoco nel pannello delle notifiche');

    expect(str_contains($punto, 'Torna sulla campanella anche dopo il clic su una notifica o su «Vedi tutte», che chiudono il pannello ed escono dal documento col fuoco: provato in Chrome, col clic vero; in Safari e in Firefox non è provato'))->toBe(true)
        ->and(str_contains($punto, 'un campo cliccato fuori dal pannello — non si toglie (provato in Chrome)'))->toBe(true)
        ->and(str_contains($punto, 'In ogni browser torna sulla campanella'))->toBe(false)
        // Review della PR #65 (R3): il clic che non dà il fuoco è provato coi casi del pacchetto; dopo il clic sull'avatar, in Chrome.
        ->and(str_contains($punto, 'Lo provano i casi del pacchetto, che imitano un clic che non dà il fuoco: in Safari e in Firefox non è provato'))->toBe(true)
        ->and(str_contains($punto, 'A pannello aperto, il clic sull\'avatar chiude il pannello e apre il menu del profilo, e il fuoco va sulla prima voce del menu, che il `Menu` mette a fuoco da sé: provato in Chrome; in Safari, dove il clic non dà il fuoco all\'avatar, non è provato'))->toBe(true);
});

// Sprint 32 · T3.5 (voce #1913): una notifica del backoffice può raccontare più azioni. Il README dice, nella riga dell'elenco, che
// `creata_il` è l'istante dell'ultima e da quale campo viene; nella riga delle letture, che cosa manda `fino_a`; nel punto delle
// notifiche, che ora si vede.

it('il README dice che una notifica che racconta più azioni mostra l\'ora dell\'ultima, da quale campo del backoffice viene e che cosa manda `fino_a` (sprint 32 · T3.5)', function (string $dove, string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $testo = match ($dove) {
        'elenco' => rigaDellaRotta($readme, 'GET /cornice/notifiche'),
        'letture' => rigaDellaRotta($readme, 'POST /cornice/notifiche/letture'),
        default => puntoDellaCornice($readme, 'Le notifiche'),
    };

    expect($testo)->not->toBe('')
        ->and(str_contains($testo, $frase))->toBe(true);
})->with([
    'che cos\'è creata_il' => ['elenco', 'dalla `v1.22.0` `creata_il` è l\'istante dell\'ultima azione che la notifica racconta'],
    'da quale campo' => ['elenco', 'l\'istante dell\'ultima lo dice in `ultima_azione_il`; se non lo manda, è l\'istante in cui la notifica è nata, come prima'],
    // Sprint 34 · T2.8 (voce #1930): di `azioni` e di `board` passano il conto e il nome della board (il caso è più sotto).
    'ciò che non passa' => ['elenco', '`ultima_azione_il` del backoffice non arriva in pagina'],
    'che cosa manda fino_a' => ['letture', 'dalla `v1.22.0` la cornice manda in `fino_a` l\'istante dell\'ultima azione più recente fra le notifiche caricate'],
    'fin dove segna' => ['letture', 'il backoffice segna quelle nate fino a lì, cioè tutte le caricate — ognuna è nata prima della sua ultima azione — e nessuna nata dopo il caricamento'],
    'l\'ora nel pannello' => ['punto', 'Dalla `v1.22.0` una notifica che racconta più azioni mostra l\'ora dell\'ultima, non quella della prima'],
]);

// Sprint 34 · T2.8 (voce #1930): dalla `v2.1.0` la riga sotto il titolo di una notifica dice quante azioni racconta e in quale
// board sta la cosa. Il README dice, nella riga dell'elenco, le due chiavi che la parte server passa e che cosa è un guasto; nel
// punto delle notifiche, la seconda riga e le tre frasi; fuori dalla cornice, che cosa legge `rigaDellaNotifica`. E non dice
// più che `azioni` e `board` non passano, né che la board non compare.

it('il README dice il conto delle azioni e il nome della board: le due chiavi dell\'elenco, la seconda riga con le tre frasi, e ciò che legge rigaDellaNotifica (sprint 34 · T2.8)', function (string $dove, string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $testo = match ($dove) {
        'elenco' => rigaDellaRotta($readme, 'GET /cornice/notifiche'),
        'fuori' => paragrafoFuoriDallaCornice($readme),
        default => puntoDellaCornice($readme, 'Le notifiche'),
    };

    expect($testo)->not->toBe('')
        ->and(str_contains($testo, $frase))->toBe(true);
})->with([
    'le chiavi di una notifica' => ['elenco', '`{data: [{id, creata_il, letta, app, tipo, autore_nome, risorsa_nome, per_me, azioni, board_nome, quando, ids}], aggiornati_il, workspace, persona}`'],
    'che cosa sono le due chiavi' => ['elenco', 'dalla `v2.1.0` `azioni` è quante azioni la notifica racconta (un intero da 1 in su) e `board_nome` il nome della board in cui sta la cosa, o `null`'],
    'da dove vengono' => ['elenco', 'sono `azioni` e `board.nome` del backoffice'],
    'il backoffice di prima' => ['elenco', 'un backoffice che non li manda è quello di prima, e valgono 1 e `null`'],
    'di board solo il nome' => ['elenco', 'di `board` passa solo il nome, mai l\'id'],
    'i malfatti' => ['elenco', 'un `azioni` che non è un intero da 1 in su, o un `board` che non è `null` né un oggetto col `nome`, è un errore (5xx)'],
    'la seconda riga' => ['punto', 'Dalla `v2.1.0`, quando sotto il titolo non c\'è il nome della cosa, la seconda riga dice quante azioni la notifica racconta e in quale board sta la cosa'],
    'conto e board' => ['punto', '«3 volte, nella board «Lancio»» (`notificationUnder.countBoard`, coi segnaposto `{n}` e `{board}`)'],
    'solo il conto' => ['punto', '«3 volte» senza board (`notificationUnder.count`)'],
    'solo la board' => ['punto', '«Nella board «Lancio»» con una sola azione (`notificationUnder.board`)'],
    'niente da dire' => ['punto', 'con una sola azione e senza board la seconda riga non c\'è'],
    'il conto da due in su' => ['punto', 'Il conto si scrive da due in su'],
    'il nome della board è difeso' => ['punto', 'Il nome della board è pulito e isolato come gli altri due nomi'],
    'una board di soli invisibili' => ['punto', 'un nome che pulito è vuoto è una board che manca'],
    'il nome della cosa resta' => ['punto', 'Quando sotto il titolo c\'è il nome della cosa — il titolo di prima, o la frase con solo chi — resta il nome'],
    'ciò che legge rigaDellaNotifica' => ['fuori', 'Della notifica legge `tipo`, `autore_nome`, `risorsa_nome`, dalla `v2.1.0` `azioni` e `board_nome`, e dalla `v3.6.0` `quando`'],
]);

it('il README non dice più che `azioni` e `board` non arrivano in pagina, né che la board non compare (sprint 34 · T2.8)', function (string $frase) {
    $readme = suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md'));

    expect($readme)->not->toBe('')
        ->and(str_contains($readme, $frase))->toBe(false);
})->with([
    'le tre chiavi che non passavano' => ['`azioni` e `board` del backoffice non arrivano in pagina'],
    'la board fermata dalla parte server' => ['la parte server non la fa arrivare in pagina'],
    'la board che non compare' => ['La board su cui è successo non compare'],
    'la seconda riga che non c\'era' => ['quando è nella frase la seconda riga non c\'è'],
]);

// Sprint 30 · T1.10 (voce #1875; review della PR #63, R3 e R4): le frasi delle notifiche sono file a sé, che la cornice chiede
// con `fetch` quando si apre la campanella. Il README dice dove stanno, quando si chiedono e che cosa si vede se non arrivano;
// la guida lo dice a un modulo che nasce; e tutti e due dicono la riga che serve ai test di un frontend.

// Sprint 69 · T2 (voce #2210). Il README e la guida dicono che un modulo `disponibile` non porta più alla sua pagina «non attivo»:
// porta a Impostazioni › Moduli per chi amministra, e agli altri non si mostra (dalla `v3.2.3`, voce #2544; fino alla `v3.2.2`
// era una voce che non portava a nessuna parte); e che `moduli` nei dati lo dà la parte server.
it('il README dice `moduli` nei dati, a chi arriva e che non costa una lettura, e dove porta un modulo disponibile; la guida dice la stessa cosa (sprint 69 · T2.5)', function () {
    $readme = suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md'));
    $guida = suUnaRiga((string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md'));

    expect(substr_count($readme, '`moduli` è l\'indirizzo di Impostazioni › Moduli nel workspace dei dati'))->toBe(1)
        ->and(substr_count($readme, 'solo se il ruolo della sessione è `proprietario` o `amministratore`'))->toBe(1)
        ->and(substr_count($readme, 'per saperlo non parte nessuna lettura in più, e al browser arriva l\'indirizzo, mai il `ruolo`'))->toBe(1)
        ->and(substr_count($readme, 'porta a Impostazioni › Moduli (`moduli` nei dati, vedi «La parte server») se la persona amministra il workspace'))->toBe(1)
        ->and(substr_count($guida, 'la voce di un modulo `disponibile` porta a Impostazioni › Moduli per chi amministra, e dalla `v3.2.3` agli altri non si mostra, tranne sulla pagina del modulo stesso'))->toBe(1)
        ->and(substr_count($guida, 'o a nessuna parte per chi non amministra'))->toBe(0)
        ->and(substr_count($readme, 'Restano due tipi di voce: quella del modulo aperto, perché senza la sua voce l\'`AppShell` toglierebbe tutto il menu Moduli'))->toBe(1);
});

it('il README dice delle frasi delle notifiche dove stanno, quando la cornice le chiede, che cosa si vede se non arrivano e che cosa serve nei test di un frontend (sprint 30 · T1.10)', function (string $dove, string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $testi = [
        'lingua' => puntoDellaCornice($readme, 'La lingua'),
        'notifiche' => puntoDellaCornice($readme, 'Le notifiche'),
        'pesi' => suUnaRiga($readme),
    ];

    expect($testi[$dove])->not->toBe('')
        ->and(str_contains($testi[$dove], $frase))->toBe(true);
})->with([
    'due file per lingua' => ['lingua', 'Dalla `v1.20.0` ogni lingua ha due file con lo stesso nome: i testi della cornice (`resources/lingue/<codice>.json`) e le frasi delle notifiche (`resources/lingue/notifiche/<codice>.json`)'],
    'dove stanno' => ['notifiche', 'non stanno più nel JS d\'ingresso della cornice: stanno in `resources/lingue/notifiche/<codice>.json`, un file per lingua'],
    'quando si chiedono' => ['notifiche', 'la cornice le chiede con `fetch` quando si apre la campanella, insieme all\'elenco: il file della lingua della persona e quello dell\'inglese, una volta sola'],
    'da dove, e la CSP' => ['notifiche', 'la cornice li chiede da dove la pagina prende il JS: la CSP di tutti lo lascia fare (`connect-src \'self\'`)'],
    'da un\'altra origine' => ['notifiche', 'un frontend che serve la build da un\'altra origine (`ASSET_URL`) scrive quell\'origine anche in `connect-src`, e da lì i file devono arrivare con CORS'],
    'finché non arrivano' => ['notifiche', 'Finché non arrivano il pannello aspetta'],
    'se non arrivano' => ['notifiche', 'se non arrivano — una risposta che non è 200, la rete che cade, dieci secondi senza risposta — mostra l\'errore di caricamento con «Riprova», che richiede elenco e frasi: mai un elenco di titoli di ripiego'],
    'dopo un rilascio' => ['notifiche', 'Dopo un rilascio, una pagina aperta prima chiede i file col nome di prima: se non ci sono più, «Riprova» non riesce finché la pagina non si ricarica'],
    // Sprint 34 · T1.6 (voce #1929): dopo un pezzo della campanella non arrivato «Riprova» lo richiede anche in Chromium.
    'Riprova e il pezzo non arrivato' => ['notifiche', 'dalla `v2.1.0`, dopo un pezzo non arrivato «Riprova» lo chiede allo stesso indirizzo con una coda in più (`?r=1`, poi `?r=2`), e il browser lo richiede'],
    // Sprint 35 · T3 (voce #1945): la coda cambia al tentativo fallito. Dallo sprint 39 l'indirizzo non si compone più con la
    // cartella del JS e col nome letto dall'errore (sotto).
    'la coda cambia al tentativo fallito' => ['notifiche', 'La coda cambia a ogni tentativo fallito, non a ogni richiesta: due richieste fatte insieme chiedono lo stesso indirizzo, che per il browser è una richiesta sola'],
    // Sprint 39 · T4 (voci #1972 e #1973): l'indirizzo è il nome che la build ha scritto, non ciò che dice l'errore.
    'da dove viene l\'indirizzo del pezzo' => ['notifiche', 'Dalla `v2.5.1` l\'indirizzo non si legge più dall\'errore del browser: è il nome che la build ha scritto nel JS della cornice, là dove lei importa il pezzo, risolto sull\'indirizzo di quel JS'],
    'solo il pezzo della campanella' => ['notifiche', 'In `import()` entra solo il pezzo della campanella, qualunque cosa dica l\'errore'],
    'dove il pezzo sta altrove' => ['notifiche', '«Riprova» lo richiede anche se l\'indirizzo del JS d\'ingresso ha una coda sua (`app.js?v=3`) e in un frontend che mette i pezzi a richiesta in un\'altra cartella rispetto al JS d\'ingresso, anche una cartella dentro quella'],
    'con una coda il pezzo chiede l\'ingresso senza' => ['notifiche', 'Con una coda sull\'ingresso il pezzo, che importa il JS della cornice col suo nome, lo chiede senza quella coda, anche al primo colpo: per il browser è un altro indirizzo, e lo scarica una seconda volta'],
    // Review della PR #72 (R3, R4, note a e b): che cosa riparte con la coda, con che build è provato, i due casi che restano.
    'con una coda la pagina si monta di nuovo' => ['notifiche', 'e lo esegue una seconda volta. Se quel JS è anche quello che monta la pagina, la pagina si monta di nuovo: alla prima apertura la campanella si richiude e ciò che la persona aveva scritto si perde, e il pannello si apre al secondo clic'],
    // UAT dello sprint 39 (C3b): con la cornice nel JS chiesto con una coda, dopo «Riprova» le righe non si vedono riaprendo.
    'con una coda, dopo «Riprova»' => ['notifiche', 'Lì, dopo un «Riprova», la pagina si monta di nuovo allo stesso modo, e riaprendo la campanella il pannello mostra ancora l\'errore: le righe arrivano con un secondo «Riprova»'],
    'il JS della cornice senza coda' => ['notifiche', 'il JS che contiene la cornice non si serve con una coda, e il nome con l\'impronta che la build gli dà basta'],
    'le due build della prova' => ['notifiche', 'provato in Chromium 151 su due build delle pagine di prova: `ZR_PEZZI_ALTROVE=1 npm run demo`, col pezzo in `assets/pezzi/`, e `ZR_INGRESSO_CON_CODA=1 npm run demo`, con la cornice nel JS d\'ingresso chiesto con `?v=3`'],
    'i due casi di «Riprova» che restano' => ['notifiche', 'se l\'indirizzo del JS della cornice non ha un percorso (`blob:`, `data:`) «Riprova» non richiede il pezzo, e a un nome che la build scrive già con una coda quella di «Riprova» si aggiunge com\'è (`x.js?v=1?r=1`)'],
    'dove la build non scrive il nome' => ['notifiche', 'Dove la build non scrive il nome del pezzo fra virgolette dentro `import(`, «Riprova» richiama `import()` come prima, allo stesso indirizzo'],
    'nei test di un frontend' => ['notifiche', 'una riga nel file di preparazione dei test, `beforeAll(() => frasiInMemoria())`, con `frasiInMemoria` che sta in `vendor/zeiras/zr-core/resources/js/prove.ts`, mette le frasi in memoria alla cornice'],
    'non è un ingresso' => ['notifiche', '`prove` è per i test: non è un ingresso per le pagine'],
    // Seconda lettura della PR #63 (S1, S2, S8, S15).
    'restano file' => ['notifiche', 'restano file anche se il frontend alza `build.assetsInlineLimit`'],
    'in sviluppo' => ['notifiche', 'Lo stesso vale in sviluppo, se la pagina prende il JS dal server di Vite: è un\'altra origine'],
    'senza il tempo massimo' => ['notifiche', 'Dove il browser non ha `AbortSignal.timeout` (Safari prima della 16, Chrome prima della 103, Firefox prima della 100) le frasi si chiedono lo stesso, senza il tempo massimo'],
    'chi rifà i moduli' => ['notifiche', 'Un caso che rifà i moduli (`vi.resetModules()`) la richiama dopo aver importato di nuovo la cornice'],
    'i pesi: tre file' => ['pesi', '«A richiesta» sono le frasi delle notifiche, dalla `v1.20.0`: tre file `.json`, uno per lingua'],
    // Sprint 33 · T1.3 (voce #1915): con la `v2.0.0` il tetto è di nuovo 18 KB. Sprint 36 · T2.6 (voce #1968): dalla `v2.3.0`
    // sono 17 byte in più, quelli della cornice che si rifà quando cambia la persona. Sprint 36 · T3.5 (voce #1967): e 37 di
    // Indietro, 54 in tutto. Sprint 37 · T4.5 (voce #1999): e 68 della scheda ferma, 122 in tutto.
    // Sprint 42 · T2.5 (voce #2054): con la ricerca in un pezzo a richiesta il tetto era sceso a 18.229 byte. Sprint 50 · T5.4
    // (voce #2056): coi dati di esempio e i formattatori fuori dall'ingresso scende a ciò che l'ingresso pesa a fine sprint.
    // Sprint 70 · T1 (voce #2429): dalla `v3.0.0` 17.478, con le righe delle destinazioni nel pezzo della campanella (Decisione 16181).
    // Patch v3.2.3 (voce #2544): 17.495, il modulo spento che non si mostra a chi non può attivarlo (Decisioni 16812 e 16828).
    'i pesi: il tetto' => ['pesi', 'Il JS d\'ingresso dell\'app che prende solo la cornice ha un tetto, che la CI misura a ogni giro: 17.213 byte con gzip. Dalla `v2.11.5` è sceso di 440 byte'],
    // v3.7.0 (zr-pm, 26/10/2026): i testi dei due avvisi della cornice ridotta in un pezzo a richiesta, il tetto scende di 404, alla misura più 20.
    // v3.9.0 (Decisione 18762 di zr-pm): i testi dei codici della ricerca nel pezzo della ricerca, il tetto scende di 123, alla misura più 20.
    'i pesi: i 123 byte della v3.9.0' => ['pesi', 'Dalla `v3.9.0` è sceso di 123 byte, alla misura più 20: i testi dei codici nella seconda riga di un risultato della ricerca (i ruoli di un membro, l\'esito di un\'opportunità) sono usciti dal JS d\'ingresso, nel pezzo della ricerca'],
    'i pesi: i 404 byte della v3.7.0' => ['pesi', 'Dalla `v3.7.0` è sceso di 404 byte: i testi dei due avvisi della cornice ridotta sono usciti dal JS d\'ingresso, nel pezzo a richiesta degli avvisi'],
    'i pesi: il settimo' => ['pesi', 'Il settimo, dalla `v3.7.0`, è il pezzo degli avvisi (circa 0,8 KB con gzip)'],
    'i pesi: i 17 byte della v3.2.3' => ['pesi', 'Dalla `v3.2.3` sono 17 byte in più: un modulo spento non si mostra nel menu Moduli a chi non può attivarlo'],
    'i pesi: i 456 byte della v3.0.0' => ['pesi', 'Dalla `v3.0.0` è sceso di 456 byte: le righe del registro che dicono dove si apre ogni notifica, e la funzione che le legge, sono uscite dal JS d\'ingresso e stanno nel pezzo della campanella'],
    // Patch v2.25.2 (voce #2394): +18 byte, eccezione di zr-pm (Decisione 15823).
    'i pesi: i 18 byte della v2.25.2' => ['pesi', 'e dalla `v2.25.2` altri 18: il nome del contenuto della pagina nelle tre lingue'],
    // Sprint 69 · T1 (voci #2151, #2210, #2033): +25 byte, eccezione di zr-pm (Decisione 15231).
    'i pesi: i 25 byte dello sprint 69' => ['pesi', 'e dalla `v2.25.0` altri 25: la cornice riconosce «senza impronta» come il layout (4 byte)'],
    // Sprint 60 · T1.3 (voce #2144): 30 byte in più per l'impronta di zr-auth, eccezione di zr-pm (nota 13648).
    'i pesi: i byte dell\'impronta' => ['pesi', 'Dalla `v2.20.0` sono 30 byte in più, quelli dell\'impronta di zr-auth che ogni richiesta della cornice porta in `X-Zr-Persona`'],
    'i pesi: di che cosa è fatto il tetto' => ['pesi', 'i dati di esempio e i formattatori dei numeri del design system sono usciti dal JS d\'ingresso, e il tetto è ciò che pesa con le correzioni di questa versione dentro, e niente oltre'],
    // v3.8.0 (zr-pm, 26/10/2026): il quinto pezzo, quello della tastiera, alla misura più 20. v3.10.0: la ricerca a 1.867 (voce 2801).
    'i pesi: i tetti dei pezzi' => ['pesi', 'Hanno un tetto anche i cinque pezzi di JS a richiesta, ognuno alla sua misura: 2.290 byte la campanella, 1.922 i rimedi, 1.867 la ricerca, dalla `v3.7.0` 778 gli avvisi (la misura più 20) e dalla `v3.8.0` 1.201 la tastiera'],
    // Sprint 77 · v3.5.0: +3 byte alla campanella per le impronte delle frasi, codice invariato (zr-pm-07, 25/10).
    'i pesi: la campanella nella v3.5.0' => ['pesi', 'e di altri 3 nella `v3.5.0`: il codice del pezzo è quello di prima, ma coi titoli delle schede senza assegnatario i file delle frasi hanno impronte nuove nel nome'],
    'i pesi: l\'eccezione finita' => ['pesi', 'Dalla `v2.0.0` l\'eccezione per i rimedi provvisori di tastiera è finita'],
]);

// Sprint 42 · T3 (voce #2054): dalla `v2.8.0` la ricerca della cornice è un pezzo a richiesta. Il README dice quando la cornice
// lo chiede, che cosa si vede se non arriva e come si riprova, e che cosa cambia nei test di un frontend; la guida lo dice a un
// modulo che nasce.

it('il README dice della ricerca in un pezzo a richiesta quando la cornice lo chiede, che cosa si vede se non arriva, come si riprova e che cosa cambia nei test di un frontend, e la guida lo dice a un modulo che nasce (sprint 42 · T3)', function (string $dove, string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    preg_match('/^### Passare alla v2\.8$(.*?)(?=^#{2,3} |\z)/ms', $readme, $passaggio);
    $testi = [
        'ricerca' => puntoDellaCornice($readme, 'La ricerca'),
        'passaggio' => suUnaRiga($passaggio[1] ?? ''),
        'pesi' => suUnaRiga($readme),
        'guida' => suUnaRiga((string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md')),
    ];

    expect($testi[$dove])->not->toBe('')
        ->and(str_contains($testi[$dove], $frase))->toBe(true);
})->with([
    'quando si chiede' => ['ricerca', 'la cornice lo chiede con `import()` al primo fuoco nel campo della ricerca, o alla prima parola se il fuoco nel campo non c\'è stato, mai quando si monta'],
    'prima dell\'arrivo' => ['ricerca', 'Chi scrive prima che il pezzo sia arrivato vede «Sto cercando…», e all\'arrivo parte una richiesta sola, con l\'ultima parola che il campo ha dato alla cornice: quella che c\'era 300 ms dopo l\'ultimo tasto'],
    // Sprint 42 · T5 (review): la lettera battuta negli ultimi 300 ms, il pezzo richiesto senza un'attesa, il file tolto, la coda.
    'una lettera negli ultimi 300 ms' => ['ricerca', 'Una lettera battuta in quei 300 ms parte al loro scadere, come ogni parola scritta mentre una ricerca è in volo: annulla la richiesta di prima, e i risultati sono di ciò che è nel campo'],
    // Sprint 47 · T5 (review, R2): la cornice smontata col pezzo in viaggio non cerca la parola scritta in lei (voce #2055).
    'smontata prima dell\'arrivo' => ['ricerca', 'Una cornice smontata prima dell\'arrivo — il layout la rifà quando cambia il workspace, anche con la stessa persona — non cerca più la parola scritta in lei, e all\'arrivo non parte niente (dalla `v2.11.2`)'],
    // Sprint 48 · T2.4 (voce #2064): l'orologio dei 30 secondi tiene della risposta di un'altra persona solo chi ha risposto.
    'l\'orologio tiene solo chi ha risposto' => ['pesi', 'Fino allo scadere l\'orologio tiene della risposta solo chi ha risposto, che gli serve allo scadere (dalla `v2.11.3`): i dati e il resto il browser li può buttare subito'],
    // Sprint 50 · T6 (review, R2): dalla `v2.11.5` fra una richiesta del pezzo e l'altra c'è l'attesa del pezzo.
    'fra una richiesta del pezzo e l\'altra' => ['ricerca', 'Un pezzo non arrivato non accende il freno del `429`: fra una richiesta del pezzo e l\'altra c\'è solo l\'attesa del pezzo (fino alla `v2.11.4` nessuna'],
    'un file tolto da una build nuova' => ['ricerca', 'Un file che una build nuova ha tolto non arriva nemmeno riscrivendo: lì la pagina va ricaricata'],
    'il JS della cornice con una coda' => ['ricerca', 'al primo fuoco nel campo della ricerca la pagina si monta di nuovo, il fuoco si perde e ciò che si scrive subito dopo non entra nel campo (visto in Chromium 151 sulla build `ZR_INGRESSO_CON_CODA=1 npm run demo`)'],
    'se non arriva' => ['ricerca', 'sotto il campo c\'è l\'errore della ricerca, lo stesso avviso di una rotta che fallisce: non un caricamento che non finisce e non «Nessun risultato», e nessuna richiesta parte'],
    'si riprova scrivendo' => ['ricerca', 'Si riprova scrivendo: ogni parola dopo richiede il pezzo, anche la stessa riscritta, passata l\'attesa che dalla `v2.11.5` segue un pezzo non arrivato (nell\'attesa la parola non lo richiede, e sotto il campo resta l\'avviso)'],
    'il freno' => ['ricerca', 'Un pezzo non arrivato non accende il freno del `429`'],
    'il pulsante che non c\'è' => ['ricerca', 'Un pulsante per riprovare nel riquadro della ricerca l\'`AppShell` non lo ha: è chiesto al design system, e il pacchetto non ne disegna uno suo'],
    'il passaggio: niente nel codice' => ['passaggio', 'La `v2.8.0` non cambia niente nel codice di chi installa'],
    'il passaggio: nei test' => ['passaggio', 'un caso che scrive nel campo, lascia passare i 300 ms dall\'ultimo tasto e guarda subito le richieste partite non ne trova'],
    'il passaggio: la riga che c\'è già' => ['passaggio', '`beforeAll(() => frasiInMemoria())`, dalla `v2.8.0` dà alla cornice anche il pezzo della ricerca'],
    // Sprint 74 · T2.7 (voce 2549): dalla `v3.6.0` il pezzo della ricerca porta le risorse di Bookings.
    'i pesi: il sesto' => ['pesi', 'Il sesto, dalla `v2.8.0`, è il pezzo della ricerca (circa 1,5 KB con gzip dalla `v3.6.0`, circa 1,7 KB dalla `v3.9.0`)'],
    'la guida: la riga dei test' => ['guida', 'Dalla `v2.8.0` dà alla cornice anche il pezzo di JS della ricerca, che in una pagina arriva al primo fuoco nel campo'],
    'la guida: se non arriva' => ['guida', 'Se non arriva, sotto il campo c\'è l\'errore della ricerca, e si riprova scrivendo un\'altra parola, o la stessa'],
]);

it('la guida dice a un modulo che nasce che la cornice chiede le frasi con `fetch`, che nelle sue pagine non cambia niente e che nei suoi test serve una riga; il file che nomina c\'è, ha quella funzione e nessun ingresso lo importa (sprint 30 · T1.10)', function () {
    $guida = suUnaRiga((string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md'));
    $prove = (string) file_get_contents(__DIR__.'/../../resources/js/prove.ts');
    $ingressi = array_map(fn (string $file): string => (string) file_get_contents(__DIR__.'/../../resources/js/'.$file), ['index.ts', 'app.ts', 'cornice.tsx', 'lingue.ts', 'frasi.ts', 'campanella.ts']);

    expect($guida)->toContain('la cornice li chiede con `fetch` quando si apre la campanella: nelle pagine del tuo modulo non cambia niente, e se non arrivano il pannello mostra l\'errore di caricamento con «Riprova»')
        // Seconda lettura della PR #63 (S10, S8): dove stanno i file, e chi rifà i moduli nei casi.
        ->toContain('titoli e frasi delle notifiche stanno in un file loro per lingua (`vendor/zeiras/zr-core/resources/lingue/notifiche/`)')
        ->toContain('Se un caso rifà i moduli (`vi.resetModules()`), la richiama dopo l\'import')
        ->toContain('Nei tuoi test sì: quei file non li serve nessuno, e un caso che apre la campanella trova l\'errore al posto dell\'elenco')
        ->toContain('Una riga nel file di preparazione dei test, `beforeAll(() => frasiInMemoria())`, con `frasiInMemoria` che sta in `vendor/zeiras/zr-core/resources/js/prove.ts`, mette le frasi in memoria alla cornice')
        // La frase di prima, che per i test non era vera.
        ->not->toContain('nel tuo modulo non cambia niente')
        ->and(fileDelloZipDiHead())->toContain('resources/js/prove.ts')
        ->and(substr_count($prove, 'export async function frasiInMemoria(): Promise<void>'))->toBe(1)
        // Un commento può nominarlo: conta chi lo importa.
        ->and(array_filter($ingressi, fn (string $codice): bool => preg_match('/(?:from|import\()\s*[\'"]\.\/prove[\'"]/', $codice) === 1))->toBe([]);
});

// Sprint 31 · T4.4 (voce #1908; review della PR #63, S8 e S9): chi rifà i moduli nei casi prende anche `frasiInMemoria` con un
// import nuovo, e mentre carica lei risponde solo per i file delle frasi. README e guida lo dicono con le stesse parole e lo
// stesso esempio.

it('README e guida dicono a chi rifà i moduli nei casi che `frasiInMemoria` si prende con un import nuovo, con l\'esempio, e che le altre richieste passano al `fetch` che c\'era (sprint 31 · T4.4)', function (string $frase) {
    foreach (['README.md', 'MODULO-NUOVO.md'] as $documento) {
        expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../'.$documento)), $frase))->toBe(true, $documento);
    }
})->with([
    'un import nuovo' => ['Anche `frasiInMemoria` si prende con un import nuovo, dopo `vi.resetModules()`: quella importata in cima al file mette le frasi nel modulo di prima'],
    'l\'esempio' => ['In un caso, dopo `vi.resetModules()`: `const { frasiInMemoria } = await import(\'../../vendor/zeiras/zr-core/resources/js/prove\'); await frasiInMemoria();`'],
    'le altre richieste' => ['Mentre carica risponde solo per i file delle frasi: ogni altra richiesta passa al `fetch` che c\'era'],
]);

it('«Salta al contenuto» non ha un foglio di stile suo e non ritocca il design system: fra i file che si installano i CSS sono quelli di prima, la classe che nasconde è del bundle e la cornice la usa per nome (sprint 28 · T4.5)', function () {
    $css = array_values(array_filter(fileDelloZipDiHead(), fn (string $file): bool => str_ends_with($file, '.css')));
    $cornice = (string) file_get_contents(__DIR__.'/../../resources/js/cornice.tsx');

    // Sprint 75 · T1.1: dalla `v3.3.0` ci sono anche i CSS che `npm run componenti` divide da bundle.css, righe del bundle.
    expect($css)->toBe(['resources/css/zeiras-token.css', 'resources/css/zeiras.css', 'resources/css/zeiras/AddressField.css', 'resources/css/zeiras/MentionField.css', 'resources/zeiras/bundle.css'])
        ->and(substr_count((string) file_get_contents(__DIR__.'/../../resources/zeiras/bundle.css'), '.zr-visually-hidden {'))->toBe(1)
        // Lettura della PR #61, R13: il pulsante è un componente suo, col suo stato, e la `Cornice` lo rende una volta.
        ->and(substr_count($cornice, "colFuoco ? undefined : 'zr-visually-hidden'"))->toBe(1)
        ->and(preg_match('/<Button variant="secondary" size="sm" onClick=\{\(\) => fuocoAlContenuto\(contenitore\.current\)\}>\{testo\}<\/Button>/', $cornice))->toBe(1)
        ->and(substr_count($cornice, '<SaltaAlContenuto testo={t.skipToContent} />'))->toBe(1)
        // Lettura della PR #61, R3: il `main` si cerca dal pulsante, non dal documento.
        ->and(str_contains($cornice, "document.querySelector('main')"))->toBe(false);
});

// Sprint 27 · T5.2 (lettura della PR #59, R7). La copia del registro che `Registro` tiene è una per tutte le rotte e per tutti i
// file di test: la scrive `registroGiaLetto()`, e si toglie in un posto solo, `tests/Pest.php`, dopo ogni caso di ogni file.
// Prima la toglievano due `afterEach` e due `try/finally`, ognuno nel suo file: un altro file che la scriveva e non la toglieva
// sporcava ricerca e notifiche di ogni file dopo, con rossi lontani dalla causa.
// Sprint 28 · T2.6 (voce #1811): il precarico dei file d'ingresso è un middleware del pacchetto, `PrecaricoDegliIngressi`. Il
// README ha la sua sezione, in fondo: come si registra nei due modi, che cosa scrive e perché (mai `modulepreload`, sempre
// `crossorigin` su un modulo), che non dice niente della persona, il rischio accettato, e i numeri, che sono di zr-board. Non
// lascia credere che parta da solo. La guida lo nomina dove il modulo registra i middleware, e la classe è nello zip del tag.
it('il README ha la sezione «Il precarico dei file d\'ingresso», che dice come si registra, che cosa scrive, che cosa non dice della persona e di chi sono i numeri (sprint 28 · T2.6)', function (string $frase) {
    $sezione = sezioneDelReadme((string) file_get_contents(__DIR__.'/../../README.md'), 'Il precarico dei file d\'ingresso');

    expect($sezione)->not->toBe('')
        ->and(str_contains($sezione, $frase))->toBe(true);
})->with([
    'da quando, e la classe' => ['Dalla `v1.18.0` il pacchetto ha un middleware, `Zeiras\\Core\\Http\\PrecaricoDegliIngressi`'],
    'che cosa mette nell\'header' => ['scrive nell\'header `Link` i file che `@vite` ha messo nel documento: l\'ingresso, i pezzi che importa staticamente e i CSS, non i pezzi dinamici'],
    'non parte da solo' => ['zr-core non lo registra da sé, e installare il pacchetto non precarica niente: lo registra il frontend, in uno dei due modi'],
    'sul gruppo web' => ['$middleware->web(append: [\\Zeiras\\Core\\Http\\PrecaricoDegliIngressi::class]);'],
    'sulle sole rotte' => ['->middleware(\\Zeiras\\Core\\Http\\PrecaricoDegliIngressi::class);'],
    'niente da configurare' => ['`config/zr-core.php` non ha una chiave per lui: le rotte le dice dove lo agganci, i file li dice `@vite` nel documento, e il middleware non legge il manifest'],
    'le due forme' => ['un CSS come `<url>; rel=preload; as=style`, un modulo come `<url>; rel=preload; as=script; crossorigin`'],
    'mai modulepreload' => ['Mai `modulepreload`: Cloudflare in un 103 ripete solo `preload` e `preconnect`'],
    'sempre crossorigin' => ['la richiesta di un modulo è CORS, e senza `crossorigin` il browser lo scaricherebbe due volte'],
    'dove non scrive' => ['Non sulla visita Inertia (la richiesta porta `X-Inertia`), su un redirect, su una pagina d\'esito (`404`, `500`), su una risposta che dichiara un altro tipo, su un JSON, un file o uno stream'],
    'un Link di prima resta' => ['Un `Link` che la risposta porta già resta: il middleware aggiunge il suo accanto'],
    // Lettura della PR #61, R1, R2 e R6-R8 (`Decisione:` 11432 di zr-pm).
    'niente della persona' => ['col solo header, niente. Ripete ciò che il documento dice già: nessun dato, id o lingua della persona, e nessun host che venga dalla richiesta'],
    'pensato per il solo header' => ['È pensato per il solo header: per Zeiras Early Hints su Cloudflare resta spento'],
    'di chi è la misura' => ['zr-pm dichiara che il guadagno misurato era del solo header, e che il 103 non aggiungeva niente'],
    'il rischio di chi accende Early Hints' => ['Chi lo accende accetta un rischio, e lo decide zr-pm: il 103 che Cloudflare manda prima dell\'origine dice, a chi conosce o indovina un indirizzo, che la pagina esiste ed è stata aperta da poco'],
    'lo slug è un nome' => ['lo slug di un workspace è il nome di un\'azienda'],
    'sulle sole rotte che accetta di esporre' => ['un modulo con uno slug o un id nel percorso registra il middleware sulle sole rotte che accetta di esporre'],
    'con quale indirizzo' => ['mai con un host che viene dalla richiesta. Una voce è il solo percorso, `</build/assets/…>`, che il browser risolve sull\'origine della pagina; con `ASSET_URL` nel `.env` del frontend è l\'indirizzo intero, che comincia con quello'],
    'un altro host non esce' => ['Di un indirizzo con l\'host della richiesta (un frontend che ha rimesso il resolver di Laravel) il middleware scrive il solo percorso, e un file con un altro host non esce'],
    'gli attributi che non copia' => ['Degli attributi che Vite calcola il middleware guarda solo `as`: non copia `integrity` né il valore di `crossorigin`'],
    'chi non lo registra' => ['Un frontend con l\'integrità dei file nel manifest, con `crossorigin="use-credentials"` o con `crossorigin` sui CSS non lo registra'],
    'nessun tetto' => ['Non c\'è un tetto alle voci: l\'header cresce con ogni pezzo che l\'ingresso importa staticamente'],
    'un processo che resta vivo' => ['È per PHP-FPM, dove ogni richiesta parte da zero: in un processo che resta vivo fra una richiesta e l\'altra (Octane) `Vite` tiene i file della richiesta di prima'],
    'in un posto solo' => ['in un posto solo. Fra i middleware globali e anche su un gruppo scriverebbe due righe uguali'],
    'al posto di quello di Laravel' => ['al posto di quello di Laravel, `Illuminate\\Http\\Middleware\\AddLinkHeadersForPreloadedAssets`, non accanto: con tutti e due ogni file uscirebbe due volte, come `modulepreload` e come `preload`'],
    'il resolver, da quando' => ['Dalla `v1.18.0` il pacchetto registra un resolver di Vite (`Vite::createAssetPathsUsing`), per ogni frontend che lo installa e senza che faccia niente'],
    'che cosa scrive il resolver' => ['`@vite` scrive i file della build col solo percorso, `/build/assets/…`, nel documento come nel `Link`'],
    'com\'era prima' => ['Prima Laravel li scriveva con la radice della richiesta — l\'header `Host`, o `X-Forwarded-Host` se il frontend si fida dei proxy —, e chi mandava un host suo lo ritrovava negli indirizzi della pagina'],
    'con ASSET_URL' => ['Con `ASSET_URL` nel `.env` l\'indirizzo resta intero e comincia con quello: non viene dalla richiesta'],
    'Vite::asset' => ['**`Vite::asset()`** dà anche lui il solo percorso: dove serve un indirizzo assoluto (una mail) lo si scrive da `config(\'app.url\')`'],
    'in una sottocartella' => ['**Un frontend in una sottocartella del dominio** imposta `ASSET_URL`'],
    // Seconda lettura della PR #61, N2-N4: ciò che cambia da solo in chi installa, e dove un resolver del frontend vince davvero.
    'ASSET_URL nel .env' => ['**`ASSET_URL` va nel `.env`**: un\'origine data a tempo d\'esecuzione, con `URL::useAssetOrigin()` o `URL::forceRootUrl()`, il resolver non la vede, e scrive il solo percorso'],
    'un test del frontend' => ['**Un test del frontend** che confronta un indirizzo intero di un file della build (`http://localhost/build/…`) va riletto: ora è il solo percorso'],
    'un resolver del frontend vince' => ['**Un resolver del frontend** registrato nel `boot()` del suo `AppServiceProvider` parte dopo quello del pacchetto, e vince: chi ne ha uno uguale lo toglie quando installa la `v1.18.0`'],
    'nel register no' => ['Nel `register()` no: lì quello del pacchetto lo sovrascrive'],
    'i numeri sono di zr-board' => ['I numeri sono di zr-board, che lo ha avuto per primo e li dichiara: a freddo, su rete lenta, da 0,15 a 0,36 s in meno. zr-core non li ha misurati'],
]);

it('la sezione «Il precarico dei file d\'ingresso» del README non dice più che il `Link` è uguale per tutti, né che il rischio è solo di chi conosce già un indirizzo, né che Early Hints è acceso (lettura della PR #61, R1 e R2)', function (string $diPrima) {
    $sezione = sezioneDelReadme((string) file_get_contents(__DIR__.'/../../README.md'), 'Il precarico dei file d\'ingresso');

    expect($sezione)->not->toBe('')
        ->and(str_contains($sezione, $diPrima))->toBe(false);
})->with([
    'uguale per tutti' => ['dipende solo dalla build, è uguale per tutti'],
    'solo chi conosce già un indirizzo' => ['a chi conosce già un indirizzo, che è stato aperto di recente'],
    'Early Hints acceso' => ['Con Early Hints acceso sulla zona, Cloudflare li ripete in un 103 alla visita dopo'],
    'con gli stessi indirizzi del documento' => ['nell\'ordine in cui `@vite` li ha scritti e con gli stessi indirizzi'],
]);

it('la guida nomina il precarico dove il modulo registra i middleware, e dice che non parte da solo; la classe è nello zip del tag, il suo test no (sprint 28 · T2.6)', function () {
    preg_match('/^## 3\. Le intestazioni di sicurezza$(.*?)(?=^## |\z)/ms', guidaDelModuloNuovo(), $delPasso);
    $passo = suUnaRiga($delPasso[1] ?? '');

    expect(str_contains($passo, 'Dalla `v1.18.0` puoi registrare anche il precarico dei file d\'ingresso, `Zeiras\\Core\\Http\\PrecaricoDegliIngressi`, sul gruppo `web` o sulle sole rotte che vuoi'))->toBe(true)
        ->and(str_contains($passo, 'non parte da solo — README, «Il precarico dei file d\'ingresso»'))->toBe(true)
        // Lettura della PR #61, R1 e R2: le rotte da esporre, il resolver, e niente più Early Hints dato per acceso. Seconda
        // lettura, N3: un resolver del frontend vince dal `boot()`.
        ->and(str_contains($passo, 'Se nei tuoi indirizzi c\'è uno slug o un id, lo registri sulle sole rotte che accetti di esporre'))->toBe(true)
        ->and(str_contains($passo, 'Dalla stessa versione `@vite` scrive i file della build col solo percorso, senza che tu faccia niente: se hai un resolver di Vite tuo che fa lo stesso, lo togli, e uno diverso lo registri nel `boot()` del tuo `AppServiceProvider` — README, «Gli indirizzi dei file della build»'))->toBe(true)
        ->and(str_contains($passo, 'con Early Hints Cloudflare li manda prima della pagina'))->toBe(false)
        ->and(fileDelloZipDiHead())->toContain('src/Http/PrecaricoDegliIngressi.php')->not->toContain('tests/Feature/IngressiPrecaricoTest.php');
});

it('il README ha il punto «Gli host fidati», che dice come si registra, che cosa controllare prima e la prova da fare dopo (sprint 29 · T1.10)', function (string $frase) {
    $sezione = sezioneDelReadme((string) file_get_contents(__DIR__.'/../../README.md'), 'Gli host fidati');

    expect($sezione)->not->toBe('')
        ->and(str_contains($sezione, $frase))->toBe(true);
})->with([
    'da quando, e la classe' => ['Dalla `v1.19.0` il pacchetto ha un middleware, `Zeiras\\Core\\Http\\HostFidati`, che a una richiesta per un host che non è quello del modulo risponde `400`, prima delle rotte'],
    'l\'host di APP_URL e basta' => ['L\'host del modulo è quello di `APP_URL` e basta: il nome intero, senza la porta e senza distinguere le maiuscole. Niente sottodomini, e `config/zr-core.php` non ha una chiave per lui'],
    'non parte da solo' => ['zr-core non lo registra da sé, e installare il pacchetto non rifiuta niente: lo registra il frontend, in coda ai middleware globali'],
    'la riga delle intestazioni' => ['$middleware->prepend(\\Zeiras\\Core\\Http\\IntestazioniSicurezza::class);'],
    'la riga degli host' => ['$middleware->append(\\Zeiras\\Core\\Http\\HostFidati::class);'],
    'l\'ordine delle due righe' => ['Le intestazioni con `prepend`, gli host con `append`, e non il contrario'],
    'perché in coda' => ['guarda l\'host che l\'app userebbe per scrivere i suoi indirizzi: l\'intestazione `Host`, oppure `X-Forwarded-Host` se chi chiama è un proxy che il modulo ha dichiarato fidato'],
    'il 400 con le intestazioni' => ['anche il `400` esce con le intestazioni di sicurezza'],
    'niente sessione e niente cookie' => ['I middleware globali girano prima di quelli del gruppo `web`: una richiesta rifiutata non apre una sessione e non lascia un cookie'],
    'la seconda difesa' => ['È la seconda difesa: la prima è il server web, che per un nome che non è il suo non dovrebbe rispondere'],
    'che cosa risponde' => ['`400` col corpo fisso `Bad Request`, uguale per tutti, e il controller non gira. Dell\'host ricevuto non ripete niente, né nella risposta né nel log'],
    'prima si legge APP_URL' => ['**Prima di registrarlo** leggi quanto vale `APP_URL` in produzione: dev\'essere il nome pubblico del modulo, scritto per intero e con lo schema'],
    'se APP_URL non ha un host' => ['Se `APP_URL` non ha un host — è vuoto, o è senza lo schema — il middleware non rifiuta niente e lo scrive nel log a ogni richiesta'],
    'anche /up' => ['**Vale per ogni rotta, anche `/up`**: una sonda che chiama il server con l\'indirizzo della macchina, e non col nome del modulo, da quel momento prende `400`'],
    'in ingresso' => ['**Riguarda le richieste in ingresso**: le chiamate del modulo ad `api.zeiras.com` non passano di qui'],
    'nei test' => ['**Nei test vale come in produzione**, senza eccezioni per l\'ambiente. Laravel nei test chiama l\'host che `APP_URL` ha all\'avvio, quindi i test passano senza toccare niente'],
    'un test che cambia app.url' => ['Prende `400` un test che cambia `app.url` a metà e poi chiama una pagina, o che chiama un indirizzo intero con un altro host'],
    'la prova in produzione' => ['**La prova dopo averlo registrato**, in produzione: dal nome pubblico una pagina risponde `200` e `/up` risponde `200`; la stessa richiesta con un host falso nell\'intestazione `Host` prende `400`'],
    // Sprint 29 · T4 (review della PR #62): che cosa risponde Laravel prima del middleware (R1, R2), la porta (R3), il
    // middleware di Laravel per gli host (R6), e gli `APP_URL` con cui il middleware rifiuta tutti (R9).
    'prima di lui i globali di Laravel (R1)' => ['In coda ai globali il middleware viene dopo quelli di Laravel per il CORS, la manutenzione e la dimensione del corpo, che rispondono a qualunque host'],
    'in manutenzione (R1)' => ['con `php artisan down --redirect` un host falso prende un `302` scritto con quell\'host, e con `--secret` chi chiama l\'indirizzo segreto riceve anche il cookie `laravel_maintenance`'],
    'in manutenzione difende il server web (R1)' => ['finché l\'app è in manutenzione la difesa è il server web'],
    'un host con caratteri non validi (R2)' => ['Un host con caratteri che un nome non ha lo rifiuta Laravel prima: `400` col corpo di Laravel, e nel log nessun avviso'],
    'la porta (R3)' => ['**La porta non entra nel confronto**: `Host: board.zeiras.com:8443` passa, e Laravel scrive i suoi indirizzi con quella porta. La porta la tiene ferma il server web'],
    'il middleware di Laravel (R6)' => ['Il middleware di Laravel per gli host, `TrustHosts`, non è lo stesso: di suo ammette anche i sottodomini di `APP_URL`, e in locale e nei test non fa niente'],
    'APP_URL che manca (R9)' => ['Se `APP_URL` manca del tutto vale quello del `config/app.php` del modulo, di norma `http://localhost`, e il middleware rifiuta ogni richiesta fatta col nome pubblico'],
    'APP_URL in Unicode o col punto (R9)' => ['Lo stesso se il nome ha lettere non ASCII — va scritto in Punycode, come lo manda il browser — o finisce con un punto'],
]);

it('la guida nomina gli host fidati dove il modulo registra i middleware, e dice che non rifiuta niente da solo; la classe è nello zip del tag, il suo test no (sprint 29 · T1.10)', function () {
    preg_match('/^## 3\. Le intestazioni di sicurezza$(.*?)(?=^## |\z)/ms', guidaDelModuloNuovo(), $delPasso);
    $passo = suUnaRiga($delPasso[1] ?? '');

    expect(str_contains($passo, 'Dalla `v1.19.0` puoi registrare anche gli host fidati, `Zeiras\\Core\\Http\\HostFidati`, in coda ai middleware globali: a una richiesta per un host che non è quello di `APP_URL` risponde `400`, anche su `/up`'))->toBe(true)
        ->and(str_contains($passo, 'Prima leggi quanto vale `APP_URL` in produzione e con quale nome chiamano le sonde; dopo fai la prova in produzione'))->toBe(true)
        ->and(str_contains($passo, 'non rifiuta niente da solo — README, «Gli host fidati»'))->toBe(true)
        ->and(fileDelloZipDiHead())->toContain('src/Http/HostFidati.php')->not->toContain('tests/Feature/HostFidatiTest.php');
});

// Sprint 29 · T3 (voce #1865): dalla `v1.19.0` una notifica di Project Management dice chi ha fatto che cosa. Il README dice le
// due famiglie di chiavi e i tipi che le hanno, la discesa quando un dato manca, che il nome della cosa sta una volta sola,
// `rigaDellaNotifica` per chi mostra le notifiche in una pagina sua, e che la board non compare perché il contratto non la dà;
// la guida dice come un modulo chiede le sue frasi. Il README non dice più che il nome della cosa è sempre la riga di sotto.
it('il README dice le frasi delle notifiche con chi e che cosa, la discesa, il nome una volta sola, rigaDellaNotifica e la board che manca; la guida dice come un modulo chiede le sue (sprint 29 · T3.2, T3.3)', function (string $dove, string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $testi = [
        'notifiche' => puntoDellaCornice($readme, 'Le notifiche'),
        'fuori' => paragrafoFuoriDallaCornice($readme),
        'guida' => suUnaRiga((string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md')),
    ];

    expect($testi[$dove])->not->toBe('')
        ->and(str_contains($testi[$dove], $frase))->toBe(true);
})->with([
    'la frase con chi e che cosa' => ['notifiche', 'le lingue hanno due famiglie di chiavi in più: `notificationTitleWhoWhat.<tipo>`, coi segnaposto `{who}` e `{what}`'],
    'la frase con solo chi' => ['notifiche', 'e `notificationTitleWho.<tipo>`, col solo `{who}`'],
    // Sprint 31 · T2.4 (voce #1866): le frasi le hanno tutti i tipi; quali hanno il nome della cosa, e perché gli altri no.
    'i tipi che le hanno' => ['notifiche', 'La seconda la hanno tutti i cinquanta tipi che hanno un titolo, fuori dai tre di Bookings, che non dicono chi, e dal promemoria di una To-do e dalle due scadenze di una scheda, che non hanno chi; la prima ventotto: i quattordici di Project Management che non sono una cosa eliminata, del CRM le aziende, le opportunità, le attività e le pipeline create o modificate e le aziende, le opportunità e le attività assegnate, il workspace creato e modificato, e il modulo attivato o disattivato'],
    // Sprint 32 · T4.4 (voce #1914): da quando aziende, opportunità e attività del CRM hanno la frase col nome.
    'le sei del CRM, da quando' => ['notifiche', 'Le aziende, le opportunità e le attività del CRM la hanno dalla `v1.22.0`'],
    // Sprint 34 · T3.4 (voce #1931): da quando le hanno le tre assegnate, e l'esempio.
    'le tre assegnate, da quando' => ['notifiche', 'quelle assegnate dalla `v2.1.0` («Marta Rossi ti ha assegnato l\'azienda «Acme»»)'],
    'perché gli altri no' => ['notifiche', 'Di una cosa eliminata, di un membro del workspace, e del CRM di un contatto e di una nota il backoffice non dà il nome (quello di un contatto è un dato personale)'],
    // Sprint 34 · T3.2, T3.3, T3.4 (voce #1931): il contatto assegnato resta senza nome, e senza il nome resta la frase con solo chi.
    'le assegnazioni del CRM' => ['notifiche', 'per questo un contatto assegnato resta «Marta Rossi ti ha assegnato un contatto», e un\'azienda assegnata di cui il nome non arriva «Marta Rossi ti ha assegnato un\'azienda»'],
    'il nome di un modulo, non il codice' => ['notifiche', 'di un modulo il backoffice dà il codice (`pm`), e nella frase c\'è il nome nella lingua della persona'],
    'la discesa: chi e che cosa' => ['notifiche', 'con `autore_nome` e il nome della cosa il titolo è la frase con chi e che cosa'],
    'la discesa: solo chi' => ['notifiche', 'con `autore_nome` e senza il nome, o per un tipo che ha solo quella, è la frase con solo chi'],
    'la discesa: il titolo di prima' => ['notifiche', 'senza `autore_nome`, o per un tipo che zr-core non conosce, resta il titolo di prima col nome sotto'],
    // Sprint 34 · T2.8 (voce #1930): quando il nome è nella frase la seconda riga può dire il conto delle azioni e la board.
    'il nome una volta sola' => ['notifiche', 'Il nome della cosa sta una volta sola: quando è nella frase non è nella seconda riga'],
    'la riga di sotto non è più sempre il nome (T3.2, deve fallire se)' => ['notifiche', 'col nome della cosa («Lancio Q4»), tranne quando il nome è già nella frase del titolo'],
    // Review della PR #65 (R4): dal contratto del 13/10/2026 la board c'è. Dallo sprint 34 · T2 (voce #1930) il suo nome arriva
    // in pagina, e sta nella seconda riga: il caso è più sopra, accanto a quello dell'ora dell'ultima azione.
    // Sprint 30 · T2.6 (voce #1875): le difese dei due nomi, e ciò che resta al backoffice.
    'i nomi restano testo' => ['notifiche', 'Restano testo: mai HTML, e un segnaposto o un `$&` scritto dentro un nome non è un comando'],
    'i nomi sono puliti' => ['notifiche', 'Sono puliti: senza i caratteri che cambiano la direzione del testo, e con a capo, tabulazioni e gli altri caratteri di controllo ridotti a uno spazio'],
    'i nomi sono isolati nella frase' => ['notifiche', 'nella frase ognuno sta fra U+2068 e U+2069, i due caratteri che lo isolano dalla direzione del testo intorno'],
    // Sprint 33 · T2.5 (voce #1890): il nome di chi ha fatto si taglia nel titolo; il resto è del backoffice.
    'il nome di chi ha fatto si taglia' => ['notifiche', 'Dalla `v2.0.0` il nome di chi ha fatto, nel titolo, oltre i 60 caratteri è tagliato: i primi 59 e «…»'],
    'come si conta il nome' => ['notifiche', 'Si conta dopo la pulizia, per caratteri come li vede chi legge (`Intl.Segmenter`): un\'emoji o una lettera con l\'accento composto valgono uno e non si spezzano'],
    'dove Intl.Segmenter manca' => ['notifiche', 'dove `Intl.Segmenter` manca si conta per punti di codice, e lì un\'emoji composta o un accento composto possono restare a metà'],
    'ciò che non si taglia' => ['notifiche', 'L\'avatar dice il nome intero, e il nome della cosa resta intero dovunque stia'],
    'ciò che resta al backoffice' => ['notifiche', 'Il resto è del backoffice: i caratteri di controllo, di direzione del testo e a larghezza zero li rifiuta alla scrittura (dal 13/10/2026: `422`, regola `carattere_non_ammesso`), e la lunghezza massima è quella di ogni campo nel contratto (`maxLength`); il nome che dice un provider d\'accesso non lo rifiuta: lo pulisce'],
    'rigaDellaNotifica' => ['fuori', 'Dalla `v1.19.0` si importa anche `rigaDellaNotifica(notifica, lingua)`, per chi mostra le notifiche in una pagina sua'],
    'che cosa dà' => ['fuori', 'dà il titolo e la riga di sotto (`{titolo, sotto}`) come li scrive il pannello'],
    'le due funzioni di prima restano' => ['fuori', '`titoloDellaNotifica` e `risorsaDellaNotifica` restano come sono'],
    'la guida: chi chiede le frasi, e come' => ['guida', 'un modulo che vuole le sue frasi le chiede all\'agente di zr-core coi suoi testi nelle tre lingue'],
    'la guida: le due chiavi' => ['guida', '(chiave `notificationTitleWhoWhat.<tipo>`, coi segnaposto `{who}` e `{what}`) e una con solo chi (`notificationTitleWho.<tipo>`)'],
    'la guida: lo fanno tutti i tipi' => ['guida', 'dalla `v1.21.0` lo fanno quelle di ogni tipo che zr-core conosce'],
    // Review della PR #64 (R5, R6): il nome del modulo nella frase; la guida dice chi ha solo la frase con chi, e perché.
    'il nome del modulo nella frase' => ['notifiche', 'Dalla `v1.21.0`, quando il backoffice dice anche chi ha fatto, il nome del prodotto sta nella frase del titolo'],
    'la guida: chi ha solo la frase con chi, e perché' => ['guida', 'ed è la sola per un tipo di cui il backoffice non dà il nome (una cosa eliminata, un membro del workspace, e del CRM un contatto e una nota: il nome di un contatto è un dato personale): per questo delle quattro assegnazioni del CRM quella di un contatto ha solo questa, e le altre tre dalla `v2.1.0` hanno anche la frase col nome'],
]);

// Sprint 33 · T2.5 (voce #1890): dalla v2 il nome di chi ha fatto si taglia, e il README non dice più il contrario.
it('il README non dice più che il nome di chi ha fatto non si taglia (sprint 33 · T2.5)', function () {
    expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')), 'Il nome non si taglia'))->toBe(false);
});

// Sprint 34 · T3.4 (voce #1931): le assegnazioni di un'azienda, un'opportunità e un'attività hanno la frase col nome, e README
// e guida non dicono più il contrario.
it('README e guida non dicono più che le assegnazioni del CRM non hanno la frase col nome (sprint 34 · T3.4)', function (string $dove, string $frase) {
    $testi = [
        'notifiche' => puntoDellaCornice((string) file_get_contents(__DIR__.'/../../README.md'), 'Le notifiche'),
        'guida' => suUnaRiga((string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md')),
    ];

    expect($testi[$dove])->not->toBe('')
        ->and(str_contains($testi[$dove], $frase))->toBe(false);
})->with([
    'non hanno ancora la frase' => ['notifiche', 'non hanno ancora la loro frase col nome'],
    'la prima venticinque' => ['notifiche', 'la prima venticinque'],
    'la guida: il nome nella riga sotto' => ['guida', 'un\'attività assegnata il nome sta nella riga sotto'],
]);

// Sprint 34 · T4.10 (voce #1932): la cornice in due dati. Il README dice le due funzioni, l'esempio per un frontend con Inertia
// (che zr-core non importa), che cosa vede la persona nei tre stati, e di chi sono lingua e nome di `subito()`; la guida rimanda lì.
it('il README dice la cornice in due dati: subito() e dopo(), l\'esempio con la prop rimandata, i tre stati e la lingua di subito(); la guida rimanda al README (sprint 34 · T4.10)', function (string $dove, string $frase) {
    $testi = [
        'readme' => suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')),
        'guida' => suUnaRiga((string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md')),
    ];

    expect(str_contains($testi[$dove], $frase))->toBe(true);
})->with([
    'le due parti' => ['readme', 'Dalla `v2.1.0` i dati della cornice si possono dare in due parti'],
    'subito() non chiama il backoffice' => ['readme', '`Cornice::subito()` legge solo la sessione — lingua, persona, workspace — e non chiama mai il backoffice'],
    'Inertia è del frontend' => ['readme', 'zr-core non importa Inertia: `Inertia::defer` lo scrive il frontend'],
    'l\'esempio' => ['readme', "'dopo' => Inertia::defer(fn () => Cornice::dopo()),"],
    // Sprint 35 · T4.3 (voce #1945): in attesa campanella e ricerca caricano (T1), e la persona è quella di `subito` (T2).
    'in attesa' => ['readme', 'Dalla `v2.2.0` campanella e ricerca sono nello stato di caricamento, non in quello d\'errore: il pannello aperto e il riquadro sotto una parola dicono che stanno caricando, senza «Riprova»'],
    'la persona in attesa' => ['readme', 'dalla `v2.2.0` la persona e la lingua sono quelle di `subito` della richiesta nuova: se la sessione è cambiata da un\'altra scheda, il menu del profilo non mostra chi c\'era prima'],
    // Sprint 36 · T2 (voce #1968): ciò che la cornice tiene è della persona, e con un'altra email la cornice si rifà.
    'un\'altra persona' => ['readme', 'Dalla `v2.3.0` ciò che la cornice tiene è della persona che lo ha visto, e la persona è la sua email'],
    'un\'altra persona: si rifà' => ['readme', 'la cornice si rifà, e la pagina con lei, come quando cambia il workspace. Riparte ridotta come a un primo caricamento'],
    'la stessa email' => ['readme', 'Con la stessa email e un altro nome o un\'altra lingua i dati che ci sono restano'],
    'un\'altra persona: senza il layout' => ['readme', 'Vale anche con la `cornice` intera, e per chi monta `Cornice` senza il layout'],
    'la guida: un\'altra persona' => ['guida', 'se quella persona ha un\'altra email rispetto a chi c\'era prima, la cornice si rifà e la tua pagina con lei'],
    'i due tipi' => ['readme', 'I tipi delle due parti escono dai due ingressi, dalla `v2.2.0`: `DatiSubito` e `DatiDopo` (`resources/js` e `resources/js/app`)'],
    'quando arriva' => ['readme', 'la pagina non si rimonta: ciò che la persona stava scrivendo in un campo, il fuoco e lo scorrimento restano'],
    'non letti' => ['readme', "`Cornice::dopo()` non lancia: dà `['non_letti' => true]`"],
    'l\'avviso' => ['readme', 'con l\'avviso «Zeiras non risponde» sopra la pagina, senza pulsante'],
    'la sessione finita' => ['readme', '`GettoneRifiutato` passano, come da `Cornice::dati()`'],
    'la lingua di subito()' => ['readme', 'La lingua e il nome di `Cornice::subito()` sono quelli dell\'ingresso finché'],
    'chi manda solo cornice' => ['readme', 'chi manda solo `cornice` non cambia niente'],
    // Review della PR #67 (R2, R3, R5, R6, R9): ciò che un frontend incontra, e il README non diceva.
    'il workspace di dopo()' => ['readme', '`Cornice::dopo()` dà anche il `workspace` di cui sono quei dati: nel layout vale su quello di `subito`'],
    'il segno di non letti' => ['readme', 'un `non_letti` letto prima dei dati che la cornice ha non la riduce'],
    // Sprint 41 · T6 (review della PR #75): le chiavi nuove in fondo (R6), il segno preso prima della lettura (S1), la pagina
    // che si rimonta (R3), il `non_letti` che non si unisce (R7), la sessione finita (R8), chi lo compone a mano (R5).
    'non letti dice di chi è (sprint 41 · T4.5; T6, R6)' => ['readme', 'Dalla `v2.7.0` anche `non_letti` dice di chi è: dopo quelle due chiavi porta `lingua`, `persona`, `workspace` e in fondo `sessione_il`. I primi tre sono letti dalla sessione dopo il fallimento, come li legge `Cornice::subito()`'],
    'non letti: i due segni (sprint 41 · T6, S1, N1 e N3)' => ['readme', 'I due segni, `aggiornati_il` e `sessione_il`, sono l\'istante in cui la lettura è cominciata, come nei dati riusciti, e non quello in cui è fallita (fino alla `v2.6.0` `aggiornati_il` era l\'istante del fallimento) — anche quando io.mostra l\'ha già letta `Cornice::lingua()` prima del controller: un `non_letti` arrivato tardi non vale sopra i dati di chi è entrato mentre il backoffice non rispondeva'],
    'non letti: il segno della lettura (sprint 41 · T6, N3)' => ['readme', "dà `['non_letti' => true]` col segno della lettura (`aggiornati_il`)"],
    'non letti di un\'altra persona: la pagina si rimonta (sprint 41 · T6, R3)' => ['readme', 'la cornice si rifà, e la pagina con lei — ciò che la persona stava scrivendo si perde, come per un `dopo` di un\'altra persona —, e lo stesso con un `non_letti` di un altro workspace'],
    'non letti di chi c\'era prima non si unisce (sprint 41 · T6, R7)' => ['readme', 'Un `non_letti` di un\'altra persona più vecchio del `subito` che la pagina ha non si unisce, come un `dopo` intero: la cornice resta in attesa, senza avviso, finché non arriva un altro `dopo` (fino alla `v2.6.0` usciva «Zeiras non risponde»)'],
    'non letti: la sessione finita (sprint 41 · T6, R8)' => ['readme', 'Se intanto la sessione è finita — chiusa, o col gettone scaduto — `Cornice::dopo()` dà `null`, come senza sessione, e nel log non scrive niente'],
    'non letti composto a mano (sprint 41 · T4.5)' => ['readme', 'un `non_letti` composto a mano, che non dice di chi è, resta sotto il nome di `subito`'],
    'non letti composto nella parte server (sprint 41 · T6, R5)' => ['readme', 'chi lo compone nella sua parte server lo dà come `Cornice::dopo()`, con chi è nella sessione e `sessione_il`'],
    'la risposta in ritardo (sprint 41 · T5.1; T6, R5 e R9)' => ['readme', 'Dalla `v2.7.0` la pagina si ricarica solo se a schermo c\'è una cornice che non è di chi ha risposto: se una visita ha già portato chi è entrato e la cornice si è rifatta, una risposta in ritardo a una delle quattro richieste, chiesta da chi c\'era prima, non ricarica la sua pagina, e niente di quella risposta va a schermo (provato in Chromium 151 con l\'elenco delle notifiche)'],
    'la risposta in ritardo: senza cornice, e una terza persona (sprint 41 · T6, R1, S2 e N2)' => ['readme', 'Una pagina senza la cornice non si ricarica: lì non c\'è nessuno a schermo. Questo vale per ciò che c\'è a schermo quando arriva la risposta: dalla `v2.10.0` un orologio dei 30 secondi già partito guarda di nuovo allo scadere (più sotto). Se chi ha risposto è una terza persona — né chi ha chiesto né chi è a schermo — la pagina si ricarica, e dopo è di chi è nella sessione: anche quando a schermo c\'è già lei, entrata dopo quella risposta, perché il browser non sa chi è nella sessione'],
    'la risposta in ritardo: una cornice sola nel documento (sprint 41 · T6, N4)' => ['readme', 'La regola conta su una cornice sola nel documento. Con due, a schermo è quella montata per ultima fra quelle ancora montate: le tiene una pila, e una cornice che si smonta toglie solo sé stessa (dalla `v2.17.1`)'],
    'la campanella in attesa' => ['readme', 'la campanella aperta in attesa chiede già l\'elenco, e il pannello lo mostra quando `dopo` arriva'],
    // Sprint 39 · T3.4 (voce #1971): all'arrivo la cornice cerca ciò che è nel campo; il limite che resta è scritto com'è.
    'la ricerca in attesa' => ['readme', 'una parola scritta nella ricerca in attesa non parte subito: quando `dopo` è arrivato la cornice cerca ciò che c\'è nel suo campo in quel momento, se ha almeno due caratteri ed è cambiato da quando l\'attesa è cominciata, dovunque sia il fuoco, e non cerca niente se al posto dei dati arriva `non_letti` o l\'accettazione dei documenti legali'],
    'la parola cancellata in attesa' => ['readme', 'Dalla `v2.5.1` una parola cancellata prima dell\'arrivo non viene più cercata, e sotto una parola battuta un attimo prima dell\'arrivo si legge il caricamento, non «Nessun risultato»: parte all\'arrivo, una volta sola'],
    // Review della PR #72 (R1, R2, R8, R9): il fuoco non conta più; i limiti che restano, e la `persona` vuota.
    'la ricerca in attesa: la parola di prima' => ['readme', 'Una parola che era già nel campo quando l\'attesa è cominciata — rimasta da una ricerca di prima, o scritta e non ancora cercata — non parte all\'arrivo: al ritorno nel campo sotto si legge «Nessun risultato» finché la persona non la ritocca'],
    // Seconda lettura della PR #72 (N1): quale campo legge, detto com'è.
    'la ricerca in attesa: il campo della prima AppShell' => ['readme', 'Il campo è quello della prima `AppShell` del documento: di cornici ce n\'è una per pagina, e una seconda leggerebbe il campo della prima'],
    'la ricerca in attesa: un\'emoji' => ['readme', 'i due caratteri si contano come li conta l\'`AppShell`: un\'emoji da sola ne vale due, parte, e la rotta la rifiuta con un 422'],
    // Sprint 40 · T2.3 (voce #2051): un testo vuoto non si può confrontare, e la risposta è una sola.
    'la scheda ferma: una persona vuota' => ['readme', 'Nemmeno con una `persona` vuota (`""`): dalla `v2.6.0` è quel 422 anche dove il frontend non ha `ConvertEmptyStringsToNull`, che Laravel monta di suo (fino alla `v2.5.1` lì era un 409 `persona_diversa`)'],
    'la guida: le due cose di «Riprova»' => ['guida', 'il JS che contiene la cornice non servirlo con una coda (il pezzo lo richiede senza, e la pagina si monta una seconda volta), e dove la tua build non scrive il nome del pezzo com\'è «Riprova» riprova allo stesso indirizzo, senza coda: in Chromium non parte niente'],
    'la guida: un dopo che vale null' => ['guida', 'Un `dopo` che vale `null` per la cornice è «ancora da leggere», non un errore, e non dà mai un avviso: alla prima pagina resta in attesa, con campanella e ricerca che caricano, finché non ne arriva uno; a una visita dopo, se la cornice ha già i dati di quel workspace, resta coi dati di prima'],
    // Sprint 58 · T1.5 (voce #2120): dalla `v2.18.0` la cornice ridotta non si compone a mano, la dà `Cornice::ridotta()`.
    'la guida: la ridotta al posto di null (sprint 58 · T1.5)' => ['guida', 'Se la tua parte server non è riuscita a leggerlo non dare `null`: dai `Cornice::ridotta()` (dalla `v2.18.0`), la cornice ridotta come la dà `Cornice::dopo()`'],
    'la guida: non_letti dice di chi è (sprint 41 · T4.5)' => ['guida', 'Dalla `v2.7.0` quel `non_letti` dice anche di chi è: porta lingua, persona e workspace della sessione e `sessione_il`'],
    'la guida: non_letti di un\'altra persona (sprint 41 · T6, R3)' => ['guida', 'Se è di un\'altra persona, o di un altro workspace, la cornice si rifà e la tua pagina con lei: lì ciò che si stava scrivendo si perde'],
    'la guida: non comporlo a mano (sprint 58 · T1.5)' => ['guida', 'Non comporlo a mano nella tua parte server: `Cornice::ridotta()` lo dà nella stessa forma, col segno della lettura di io.mostra della richiesta (senza una lettura, il primo istante che la forma dei segni può dire), senza chiamare il backoffice e senza righe nel log — per esempio quando il 403 di `Cornice::dopo()` si ripete dopo la ricarica'],
    'ridotta: quando (sprint 58 · T1.5)' => ['readme', 'Dalla `v2.18.0` non serve comporlo: `Cornice::ridotta()` dà la cornice ridotta com\'è nel ramo `non_letti` di `Cornice::dopo()`'],
    'ridotta: la forma (sprint 58 · T1.5)' => ['readme', 'nella stessa forma e nello stesso ordine — `non_letti`, `aggiornati_il`, `lingua`, `persona`, `workspace`, `sessione_il` e, se c\'è, `lingua_il` —, per il frontend che la vuole lui, per esempio quando il 403 di `Cornice::dopo()` si ripete dopo la ricarica. Non chiama il backoffice e non scrive nel log'],
    'ridotta: il segno (sprint 58 · T1.5)' => ['readme', 'I due segni sono l\'inizio della lettura di io.mostra che quella richiesta ha usato (quella del 403, quella di `Cornice::lingua()`, o nella richiesta rimandata quella della pagina che `Cornice::dopo()` ha ripreso); in una richiesta senza una lettura sono il primo istante che la forma dei segni può dire, `0000-01-01T00:00:00.000000Z`: una cornice ridotta non vale mai sopra dati veri arrivati dopo. Senza sessione o senza workspace dà `null`'],
    'la guida: la parola cancellata' => ['guida', 'dalla `v2.5.1` non una che nel frattempo hai cancellata'],
    'Indietro in attesa' => ['readme', 'Una pagina ripresa dalla cronologia con Indietro porta il `subito` di allora'],
    // Sprint 36 · T3.4 (voce #1967): con Indietro la persona resta quella di adesso, e che cosa fa il frontend all'uscita.
    'Indietro: il segno della sessione' => ['readme', 'dalla `v2.3.0` `Cornice::subito()` dà anche `sessione_il`, il segno dell\'istante in cui ha letto la sessione, e una pagina col segno più indietro di chi la cornice mostra non cambia la persona'],
    'Indietro: nei due tempi' => ['readme', 'Nome, email e lingua restano quelli di chi è entrato, sia in attesa sia quando arriva un `dopo` letto di nuovo, che è suo e lo dice'],
    // Sprint 42 · T4 (voce #1975): senza il segno della lettura la pagina di un'altra persona non va a schermo, e si ricarica.
    'Indietro: senza il segno' => ['readme', 'se la pagina è di un\'altra persona e il segno manca da una delle due parti, la cornice non ne mostra niente, nemmeno il contenuto, e ricarica la pagina, che torna di chi è entrato'],
    'Indietro: senza il segno, a una visita' => ['readme', 'Senza il segno non può distinguere Indietro da una visita: anche a una visita che porta un\'altra persona la pagina si ricarica; ricaricata, la cornice parte da chi dice la pagina e non ricarica più'],
    'Indietro: senza il segno, la stessa persona' => ['readme', 'Della stessa persona, senza il segno, vale la pagina come prima'],
    // Sprint 42 · T5 (review): sotto il layout anche in un altro workspace; nessun tetto alle ricariche; le due frasi che lo contraddicevano.
    'Indietro: senza il segno, in un altro workspace' => ['readme', 'sotto il layout anche quando la voce di chi c\'era prima è di un altro workspace, dove la cornice si rifà: lì lo guarda il layout (provato in Chromium 151 sulle pagine di prova, con `?segno=no`, nello stesso workspace e in un altro)'],
    'Indietro: senza il segno, nessun tetto alle ricariche' => ['readme', 'Un tetto alle ricariche non c\'è: una pagina che a ogni caricamento desse senza segno prima una persona e poi un\'altra — un `subito` di una e un `dopo` dell\'altra — si ricaricherebbe ogni volta'],
    'senza il segno vale la pagina, se è della stessa persona' => ['readme', 'vale ciò che dà la pagina, se è della persona che la cornice mostra (di un\'altra, dalla `v2.8.0`, la pagina si ricarica: vedi «La cornice in due dati»)'],
    'passare alla v2.8: i dati senza il segno' => ['readme', 'se quei dati portano un\'altra persona rispetto a chi la cornice mostra, la cornice non disegna niente e chiama `location.reload()` (vedi «La cornice in due dati»). Un caso che cambia persona con dati senza segno trova lo schermo vuoto: ai dati del caso si dà il segno, da tutte e due le parti'],
    'passare alla v2.8: senza una coda' => ['readme', 'In una pagina vera non c\'è niente da fare, se il JS che contiene la cornice non è servito con una coda (vedi «La ricerca»)'],
    'la guida: la coda vale anche per la ricerca' => ['guida', 'Dalla `v2.8.0` la prima vale anche per la ricerca, che ha un pezzo suo: con una coda sul JS della cornice la pagina si monta di nuovo al primo fuoco nel campo della ricerca'],
    'Indietro: i limiti' => ['readme', 'Restano due limiti. La cornice sa chi ha mostrato solo finché resta montata'],
    'Indietro: all\'uscita' => ['readme', 'la risposta dell\'uscita chiama `Inertia::clearHistory()`, e una voce di prima non si legge più'],
    // Review della PR #69 (R1, R2, R3): il `dopo` di allora, i due workspace, l'esempio dell'uscita e la scheda lasciata aperta.
    'Indietro: il dopo di allora' => ['readme', 'Se la voce della cronologia porta anche il suo `dopo` di allora, quei dati non valgono: restano quelli di chi è entrato'],
    // Sprint 37 · T3.6 (voce #1993): il limite dei due workspace non c'è più.
    'Indietro: fra due workspace' => ['readme', 'Dalla `v2.4.0` vale anche fra due workspace: il layout rifà la cornice a ogni workspace, e chi è mostrato lo tiene lui, sopra: è chi ha il segno più avanti, e non torna indietro, per quante voci si ripercorrano con Indietro e Avanti'],
    'Indietro: fra due workspace, a schermo' => ['readme', 'Con Indietro su una pagina di chi c\'era prima in un altro workspace la cornice resta quella di chi è entrato, col suo workspace e i suoi dati, e non si rifà'],
    'Indietro: fra due workspace, la stessa persona' => ['readme', 'Per la stessa persona cambia una cosa sola: con Indietro su una sua pagina di un altro workspace la cornice è quella di quel workspace, coi dati di allora, ma col nome e la lingua di adesso, non con quelli di allora'],
    'Indietro: l\'esempio dell\'uscita' => ['readme', "'history' => ['encrypt' => true], // la rotta dell'uscita, chiusa la sessione Inertia::clearHistory(); return redirect('/');"],
    'Indietro: la scheda lasciata aperta' => ['readme', 'In una scheda rimasta aperta mentre la sessione cambia da un\'altra la cronologia resta leggibile'],
    // Seconda lettura della PR #69 (N2, N4, N6, N7): ciò che resta fuori, detto per intero.
    'Indietro: il dopo riletto fra due workspace' => ['readme', 'Se a quella voce manca il `dopo`, quello riletto è di chi è entrato, col suo workspace, e sta sotto il suo nome'],
    // Sprint 37 · T2.6 (voce #1998): `dopo` dice di chi è, e che cosa cambia per un frontend.
    'dopo dice di chi è' => ['readme', 'Dalla `v2.4.0` `Cornice::dopo()` dice anche di chi sono quei dati: porta `lingua` e `persona` come sono nella sessione dopo quella lettura (la lingua e il nome riletti da io.mostra; l\'email, quella dell\'ingresso fino alla zr-auth 0.12.62 e quella di io.mostra dalla 0.12.63) e, in fondo, `sessione_il`, il segno di quella lettura'],
    'dopo dice di chi è: nel layout' => ['readme', 'se fra le due richieste la sessione è passata a un\'altra persona la cornice è la sua, coi suoi dati, e i dati di una persona non stanno sotto il nome di un\'altra'],
    'dopo dice di chi è: per un frontend' => ['readme', 'Per un frontend che dà al layout `Cornice::dopo()` com\'è non c\'è niente da scrivere, e tre cose si vedono'],
    'dopo dice di chi è: la scheda ferma' => ['readme', 'Una scheda rimasta ferma che rilegge il solo `dopo` dopo che la sessione è passata a un\'altra persona mostra la cornice di questa, rifatta, e la pagina con lei'],
    'dopo dice di chi è: a mano' => ['readme', 'chi compone `dopo` a mano gli lascia `lingua`, `persona` e `sessione_il`: senza, vale come prima della `v2.4.0`'],
    'dopo dice di chi è: il limite che resta' => ['readme', 'un `dopo` senza `persona` e `sessione_il` — composto a mano, o di una voce della cronologia salvata prima della `v2.4.0` — vale come prima'],
    'dopo dice di chi è: chi torna' => ['readme', 'se poi la sessione torna a chi c\'era, con Indietro su quella voce restano il suo nome e i suoi dati'],
    // Sprint 41 · T6 (seconda lettura della PR #75, N5): anche un `dopo` di un altro workspace rifà la cornice.
    'dopo dice di chi è: la pagina con lei' => ['readme', 'Solo se `dopo` è di un\'altra persona (un\'altra email: la sessione è passata a lei fra le due richieste), o di un altro workspace, la cornice si rifà, e la pagina con lei'],
    'dopo dice di chi è: la lingua' => ['readme', 'Dalla `v2.4.0` quelli riletti arrivano già con `dopo`, e la cornice li mostra da quel momento'],
    'la guida: dopo dice di chi è' => ['guida', 'Dalla `v2.4.0` anche `Cornice::dopo()` dice di chi è (lingua, persona e il suo segno)'],
    // Sprint 37 · T4.6 (voce #1999): in una scheda ferma l'elenco e i risultati di un'altra persona non vanno a schermo.
    'la scheda ferma: le due rotte' => ['readme', 'Dalla `v2.4.0` anche l\'elenco delle notifiche e la ricerca dicono di chi sono: le due rotte danno `persona`, l\'email della persona della sessione'],
    'la scheda ferma: a schermo' => ['readme', 'La cornice non la mostra sotto il nome di prima, nemmeno per un disegno: ricarica la pagina, che da lì è di chi è entrato, e fino ad allora il pannello resta in caricamento'],
    'la scheda ferma: una parte server di prima' => ['readme', 'Una risposta che non dice di chi è (una parte server di prima della `v2.4.0`) vale come prima, e per la stessa persona non cambia niente'],
    'la guida: la scheda ferma' => ['guida', 'In una scheda rimasta ferma, dalla `v2.4.0`, la cornice non mostra le notifiche e i risultati della ricerca di un\'altra persona: ricarica la pagina'],
    // Sprint 38 · T5 (seconda lettura della PR #71: N1, N2, N4): la lettura con un clic, il corpo di «Segna tutte come lette»,
    // il ricaricamento che non avviene, e nella guida il `dopo` composto a mano.
    'la scheda ferma: la lettura con un clic' => ['readme', 'Lo stesso per il 403 della lettura di una notifica con un clic (`PATCH /cornice/notifiche/{id}/lettura`): se arriva prima che la risorsa si apra, la pagina si ricarica al suo posto'],
    'la scheda ferma: il corpo di «Segna tutte come lette»' => ['readme', 'e dalla `v2.5.0` l\'email di chi la cornice mostra (`persona`)'],
    'la scheda ferma: il ricaricamento che non avviene' => ['readme', 'Se il ricaricamento non avviene — la pagina chiede conferma prima di essere lasciata (`beforeunload`) e la persona sceglie di restare — chi ha chiesto non resta in attesa per sempre (dalla `v2.9.0`): dopo 5 secondi la richiesta si chiude con un errore'],
    // Sprint 43 · T2 (voce #2036): che cosa si vede dopo i 5 secondi, e che prima niente cambia.
    'la scheda ferma: dopo i 5 secondi' => ['readme', '«Segna tutte come lette» si può premere di nuovo, il pannello aperto dice «Non riusciamo a caricare le notifiche» con «Riprova», la ricerca il suo avviso. Niente di chi è entrato va a schermo, nemmeno nell\'errore, e prima dei 5 secondi niente cambia'],
    // Sprint 43 · T3 (voce #2053): il tetto delle ricariche è l'età della pagina, niente è scritto nel browser, e i casi che restano.
    'la scheda ferma: il tetto delle ricariche' => ['readme', 'Dalla `v2.9.0` la ricarica ha un tetto, ed è l\'età della pagina: una pagina caricata da meno di 30 secondi non si ricarica davanti a una risposta di un\'altra persona'],
    'la scheda ferma: sotto il tetto niente è disegnato' => ['readme', 'chi ha chiesto ha l\'errore di sempre, il pannello con «Riprova» e la ricerca col suo avviso, dalla `v2.10.0` dopo 5 secondi come sopra i 30 (nella `v2.9.0` senza aspettare). Di quella risposta niente è disegnato e niente è tenuto, come quando la pagina si ricarica'],
    'la scheda ferma: niente nel browser' => ['readme', 'Per ricordarselo il pacchetto non scrive niente nel browser — né `sessionStorage`, né `localStorage`, né il nome della finestra, né un cookie —: guarda l\'orologio della pagina (`performance.now()`), e all\'uscita non c\'è niente da togliere'],
    // Sprint 50 · T6 (review, R1): il clic sotto i 30 secondi non è più uno dei casi che restano.
    'la scheda ferma: i due casi che restano (sprint 50 · T6, R1)' => ['readme', 'I casi che restano sono due. Una richiesta partita più di 30 secondi dopo una ricarica che non ha cambiato niente ne dà un\'altra. E una pagina senza cornice allo scadere'],
    'Indietro senza segno: il tetto non la copre' => ['readme', 'Il tetto che dalla `v2.9.0` hanno le ricariche davanti a una risposta di un\'altra persona non copre questa: fermata, lascerebbe la pagina vuota, senza un «Riprova»'],
    'la guida: il tetto delle ricariche' => ['guida', 'Dalla `v2.9.0` si ricarica al più una volta ogni 30 secondi, e una richiesta rimasta senza ricaricamento dà il suo errore dopo 5 secondi. Il rovescio: una pagina caricata da meno di 30 secondi resta con la cornice di chi c\'era prima finché non li compie — dalla `v2.10.0` allora si ricarica da sola, se a schermo non c\'è già chi ha risposto'],
    // Sprint 43 · T4 (voce #2052): con la stessa persona vale la lingua del dato più recente.
    'la lingua del dato più recente' => ['readme', 'Dalla `v2.9.0`, con la stessa persona, vale la lingua del dato più recente anche se `dopo` non è riletto: una pagina che rilegge il solo `subito` dopo che la persona ha cambiato lingua ha i testi della cornice nella lingua nuova'],
    'la lingua: da subito passa solo lei' => ['readme', 'Da `subito` passano la sola lingua e il suo segno, e solo se `dopo` dice di chi è e il segno della lingua c\'è da tutte e due le parti: senza, vale `dopo` come prima'],
    'la guida: la lingua del dato più recente' => ['guida', 'Dalla `v2.9.0`, con la stessa persona, i testi della cornice seguono la lingua del dato più recente: se la pagina rilegge il solo `subito` dopo un cambio di lingua, la cornice passa alla lingua nuova senza aspettare `dopo`'],
    // Sprint 43 · T5 (review della PR 77): la lingua di un `subito` riletto mentre `dopo` è in lettura; le frasi di prima col
    // tetto e l'orologio; l'orologio a ogni ricarica chiamata; le due cornici; ciò che resta a schermo sotto il tetto; la guida.
    'la lingua: sotto un subito riletto' => ['readme', 'coi suoi dati e il suo nome, senza attesa; la lingua è quella di `subito` se è sua la lingua confermata dopo (dalla `v2.11.0`, col segno della lingua; nella `v2.9.0` e nella `v2.10.0` col segno della sessione)'],
    // Sprint 45 · T3.6 (voce #2060): la lingua ha un suo segno, e il caso che restava aperto si chiude.
    'la lingua: il suo segno' => ['readme', 'Dalla `v2.11.0` la lingua ha un suo segno, `lingua_il`: `Cornice::subito()` e `Cornice::dopo()` lo portano dopo `sessione_il`, in fondo (anche `non_letti`), ed è l\'istante in cui è cominciata la lettura di io.mostra che ha confermato la lingua della sessione per quella persona'],
    // Sprint 47 · T4 (voce #2068): in `dopo` il segno della lingua è quello ricordato, che la lettura porta solo avanti.
    'la lingua: il segno, mai adesso' => ['readme', 'In `dopo` e in `subito` è quello che la sessione ricorda, mai l\'istante di adesso: la lettura di `dopo` lo porta avanti solo se io.mostra ha risposto per quella persona ed è più avanti di quello ricordato, e una lettura più vecchia lo lascia com\'è'],
    // Sprint 49 · T2.5 (voce #2071): una lettura più vecchia non cambia nemmeno la lingua della sessione.
    'la lingua: una lettura vecchia non la cambia' => ['readme', 'Dalla `v2.11.4` una lettura più vecchia non cambia nemmeno la lingua della sessione: resta quella confermata dalla lettura ricordata, e lingua e segno restano una coppia'],
    'la lingua: nella sessione, di chi è' => ['readme', 'La parte server lo ricorda nella sessione, alla chiave `zr-core.lingua`, con l\'id della persona: di un\'altra persona entrata nello stesso browser non esce, e senza una lettura che l\'abbia confermata non c\'è'],
    'la lingua: decide il suo segno' => ['readme', 'Fra `subito` e `dopo` della stessa persona la lingua è quella del dato col segno della lingua più avanti; il segno della sessione decide come prima chi è a schermo, e la lingua no'],
    'la lingua: il caso chiuso' => ['readme', 'un `subito` riletto da solo mentre `dopo` è ancora in lettura ha il segno della sessione più avanti, ma quello della lingua no, e la cornice non torna alla lingua di prima'],
    'la lingua: Indietro' => ['readme', 'E con Indietro su una pagina della stessa persona letta dopo quella a schermo, ma con la lingua confermata prima, la lingua resta quella nuova, nello stesso workspace e in un altro'],
    'la lingua: un dopo a mano senza segno' => ['readme', 'Un `dopo` composto a mano senza `lingua_il` porta la sua lingua, come prima della `v2.9.0`'],
    'la lingua: il segno non va indietro' => ['readme', 'Anche `lingua_il` (sotto, «La cornice in due dati»), che è il segno di una di quelle letture'],
    'la lingua: anche non_letti' => ['readme', 'Dalla `v2.11.0` dopo `sessione_il` c\'è anche `lingua_il`, come in `Cornice::subito()`: quello ricordato per la persona, che questa lettura porta avanti solo se io.mostra ha risposto per lei ed è più avanti'],
    // Sprint 54 · T1.9 (voce #2098): la richiesta rimandata usa la lettura di io.mostra della pagina, alle sue condizioni.
    'la rimandata: una lettura in meno' => ['readme', 'Dalla `v2.15.0` la richiesta rimandata può costare una lettura di io.mostra in meno'],
    'la rimandata: senza lingua() nella rimandata' => ['readme', 'Il risparmio c\'è se nella richiesta rimandata il frontend non chiama `Cornice::lingua()`'],
    'la rimandata: niente dal browser' => ['readme', 'Per il resto il frontend non fa niente, e dal browser non passa nessun dato in più'],
    'la rimandata: persona, workspace, segno' => ['readme', 'la stessa persona, lo stesso workspace, il segno ancora quello che la sessione ricorda per la lingua di quella persona'],
    'la rimandata: dieci secondi sull\'orologio' => ['readme', 'al più 10 secondi da quando è stata tenuta, contati sull\'orologio del server'],
    'la rimandata: una volta sola' => ['readme', 'E vale una volta sola: `Cornice::dopo()` la toglie dalla sessione, che la usi o no'],
    'la rimandata: cambio di workspace e uscita' => ['readme', 'Il cambio di workspace la toglie alla prima richiesta nel workspace nuovo che chiama `Cornice::subito()`, `Cornice::lingua()`, `Cornice::dati()` o `Cornice::dopo()`, e l\'uscita la toglie chiudendo la sessione'],
    'la guida: il segno della lingua' => ['guida', 'Dalla `v2.11.0` la lingua ha un suo segno, `lingua_il`, e vale quella confermata più di recente: un `subito` riletto mentre `dopo` è ancora in lettura, o una pagina di prima ripresa con Indietro, non riportano la lingua di prima (README, «La cornice in due dati»)'],
    'la scheda ferma: le frasi di prima col tetto' => ['readme', 'Dalla `v2.9.0` questa ricarica, e le altre dette qui sotto, hanno un tetto e un orologio: su una pagina caricata da meno di 30 secondi non partono prima che li compia — dalla `v2.10.0` partono allora, da sole —, e se la pagina non si ricarica la richiesta dà il suo errore dopo 5 secondi'],
    'la lettura con un clic: il tetto' => ['readme', 'Dalla `v2.9.0` anche questa ricarica ha il tetto delle altre: su una pagina caricata da meno di 30 secondi non parte'],
    'la scheda ferma: l\'orologio a ogni ricarica' => ['readme', 'L\'orologio dei 5 secondi parte a ogni ricarica chiamata, non solo quando è annullata: se la pagina nuova tarda più di 5 secondi, quella che sta per andarsene dice lo stesso il suo errore, senza niente di chi è entrato'],
    'la scheda ferma: le due cornici e l\'orologio' => ['readme', 'Con due cornici nel documento, fino alla `v2.17.0`, valeva il limite detto qui sopra: lì la pagina non si ricaricava, nessun orologio partiva, e chi aveva chiesto restava in attesa'],
    'la scheda ferma: sotto il tetto non resta chi c\'era' => ['readme', 'Dalla `v2.10.0` la cornice di chi c\'era prima non resta a schermo oltre i 30 secondi: una pagina che ha ricevuto la risposta di un\'altra persona nei suoi primi 30 secondi si ricarica da sola quando li compie, senza un clic e senza un\'altra richiesta'],
    // Review della PR #78 (sprint 44 · T5): le eccezioni dell'orologio dei 30 secondi, dette accanto alla regola.
    'la scheda ferma: le eccezioni allo scadere (PR #78, S1)' => ['readme', 'Salvo due eccezioni: la ricarica allo scadere si chiede una volta sola, e se la pagina la annulla (`beforeunload`) la cornice di prima resta finché da lì non parte un\'altra richiesta; in una scheda nascosta il browser può far scadere l\'orologio più tardi (in una congelata, solo quando la riattiva)'],
    'la scheda ferma: il terzo caso che resta (PR #78, R1, R2)' => ['readme', 'E una pagina senza cornice allo scadere — una visita a una pagina senza la cornice (fino alla `v2.17.0` anche il limite delle due cornici) — si ricarica anche se ormai è di chi ha risposto: ciò che ci ha scritto si perde'],
    // Sprint 50 · T3.4 (voce #2065): con due cornici quella che si smonta toglie chi è a schermo solo se è ancora lei.
    'le due cornici: la cornice di chi ha risposto montata prima (sprint 50 · T3.4)' => ['readme', 'se la cornice di chi ha risposto si monta prima che quella di prima sia smontata, a schermo resta la sua, e allo scadere dei 30 secondi la sua pagina non si ricarica'],
    // Sprint 50 · T6 (review, R6, R7, R12, R14): i limiti che restano, detti accanto alla regola.
    'le due cornici della stessa persona (sprint 50 · T6, R7)' => ['readme', 'smontata la cornice montata per ultima, a schermo torna quella rimasta, anche se è della stessa persona'],
    // Sprint 52 · T4 (voce #2082): un secondo clic sulla stessa notifica con la lettura in volo non fa niente.
    'il clic in attesa della lettura (sprint 50 · T6, R12; sprint 52 · T4)' => ['readme', 'Nell\'attesa niente lo dice a schermo: il pannello si chiude e la notifica resta non letta. Dalla `v2.13.0` un secondo clic sulla stessa notifica, mentre la sua lettura non ha risposto, non fa niente: nessun\'altra lettura, e all\'arrivo la risorsa si apre una volta'],
    // Sprint 52 · T5 (voce #2079): l'evento prima della ricarica, e che cosa il pacchetto non fa.
    'l\'evento prima della ricarica (sprint 52 · T5)' => ['readme', 'subito prima di ricaricare la pagina per un cambio di persona — una risposta di un\'altra persona alla campanella, alla ricerca, alla lettura di una notifica o a «Segna tutte come lette» — la cornice manda sulla `window` un evento `zr-core:altra-persona`'],
    // Sprint 56 · T2.5 (voce #2105): `dopo()` sui 4xx che non sono 401 né 403 e sulle risposte guaste, e chi compone a mano.
    'dopo() sui 4xx e sulle risposte guaste (sprint 56 · T2.5)' => ['readme', '(la connessione, un 5xx, un 429; dalla `v2.17.0` anche un 404, un 409 o un 422, e una risposta che la cornice non sa leggere) `Cornice::dopo()` non lancia'],
    'il 403 e gli altri errori passano (sprint 56 · T2.5)' => ['readme', 'Ogni altro errore di `/v1` — un 403, che dice che la persona non ha più accesso e che la cornice ridotta nasconderebbe, un 401 `cliente_non_riconosciuto`, un 400, un 410… — e `GettoneRifiutato` passano, come da `Cornice::dati()`'],
    'dati() e un elenco che non sa leggere (sprint 56 · T2.5; review R3)' => ['readme', 'il backoffice non risponde, o (dalla `v2.17.0`) risponde con un elenco che la cornice non sa leggere'],
    'la composizione a mano si toglie (sprint 56 · T2.5)' => ['readme', 'un frontend che per quei casi compone `dopo` a mano attorno a `Cornice::subito()` dalla `v2.17.0` può togliere la sua composizione e dare `Cornice::dopo()` com\'è'],
    'la guida: non serve comporlo a mano (sprint 56 · T2.5)' => ['guida', 'dalla `v2.17.0` anche a un 404, un 409 o un 422, e a una risposta che non sa leggere: non serve comporlo a mano attorno a `Cornice::subito()`'],
    // Sprint 56 · T1.4 (voce #2107): l'evento anche prima delle due ricariche per la pagina di un'altra persona senza il segno.
    'l\'evento prima della ricarica anche dopo Indietro (sprint 56 · T1.4)' => ['readme', 'Dalla `v2.17.0` lo manda anche subito prima delle due ricariche per la pagina di un\'altra persona senza il segno della lettura (Indietro sulla voce di chi c\'era prima: con `LayoutDellaCornice` la fa il layout, con la `Cornice` montata da sola la cornice)'],
    'l\'evento mentre React disegna (sprint 56 · T1.4; review R6)' => ['readme', 'Lì l\'evento parte mentre React disegna: chi lo ascolta ricorda che è successo, come nell\'esempio qui sotto, e non aggiorna lo stato di un componente'],
    'l\'evento prima della ricarica: il pacchetto non scrive niente (sprint 52 · T5.2)' => ['readme', 'Il pacchetto non mostra niente e non scrive niente nel browser: se dopo la ricarica il frontend vuole dire perché la pagina si è aggiornata'],
    // Sprint 53 · T1 (review R1 della PR #86): una lettura sola in volo per cornice, e A→B→A apre A una volta.
    'una lettura sola in volo (sprint 53 · T1)' => ['readme', 'la cornice tiene una lettura sola in volo: un clic su una notifica qualsiasi, mentre è in volo, non fa niente'],
    'A→B→A (sprint 53 · T1)' => ['readme', 'Con A, B e di nuovo A parte la lettura di A sola, e alla risposta si apre A, una volta.'],
    'il clic che apriva senza aspettare, e l\'eccezione (sprint 50 · T6, R14; sprint 53 · T1)' => ['readme', 'fino alla `v2.13` si apriva senza aspettarla, salvo su una pagina caricata da meno di 30 secondi, dove dalla `v2.11.5` il clic la aspettava'],
    // Sprint 52 · T3 (voce #2081): dalla `v2.13.0` le richieste partite insieme contano un fallimento solo.
    'le richieste insieme del pezzo (sprint 52 · T3)' => ['readme', 'Le richieste fatte insieme sono una sola per il browser, e dalla `v2.13.0` lo sono anche per l\'attesa e per la coda: con k richieste partite mentre il pezzo è in viaggio, se il pezzo non arriva, è un tentativo fallito solo'],
    // Sprint 57 · T3 (review R2, R8; sicurezza I1): com'era fino alla `v2.17.0`, detto al passato, e la lettura in volo.
    'le due cornici fino alla v2.17.0 (sprint 57 · T3, R2 e R8)' => ['readme', 'se la cornice di chi ha risposto si monta prima che quella di prima sia smontata, a schermo resta la sua, e allo scadere dei 30 secondi la sua pagina non si ricarica (fra persone diverse dalla `v2.11.5`, con la stessa persona dalla `v2.17.1`); smontata la cornice montata per ultima, a schermo torna quella rimasta, anche se è della stessa persona. Fino alla `v2.17.0` nel secondo caso, e nel primo con la stessa persona, per la cornice nessuno era a schermo: una scheda ferma lì non si ricaricava, un orologio dei 30 secondi già partito, allo scadere, ricaricava la pagina anche con la cornice di chi aveva risposto, e il clic su una notifica non apriva la risorsa'],
    'le due cornici: la lettura in volo (sprint 57 · T3, sicurezza I1)' => ['readme', 'Dalla `v2.17.1` la apre anche quando la cornice del clic si è smontata con la lettura in volo, se a schermo c\'è ancora la stessa persona in un\'altra cornice'],
    // Sprint 60 (revisione di sicurezza della PR #96, S2): la pila tiene le persone, e il limite dell'email è detto al passato.
    'le due cornici: il limite dell\'email (sprint 57 · T2.4; prima PR #78, R1; sprint 60, S2)' => ['readme', 'Fino alla `v2.19` restava un limite: la cornice riconosceva chi è a schermo dall\'email, e con A, poi B, poi di nuovo A, smontata una delle due cornici di A, a schermo restava A anche quando la A rimasta era quella montata prima di B. Dalla `v2.20.0` la pila tiene le persone delle cornici, con la loro impronta, e ognuna toglie sé stessa: smontata la A montata dopo B, a schermo torna B'],
    // Sprint 55 · T3.5 (voce #2063): dalla `v2.16.0` con la coda la ricerca arriva; com'era fino alla `v2.15`, detto al passato.
    'la ricerca: perché non arrivava con la coda (PR #78, R5; sprint 55 · T3.5)' => ['readme', 'e non li prende dalla seconda copia del codice delle richieste per la cornice, dove nessuno è a schermo; e il freno del `429` lo riconosce dai secondi, non dalla classe dell\'errore, che in quella copia è un\'altra'],
    'il 403 senza workspace e una sessione senza email (PR #78, R7; sprint 51 · T1.4)' => ['readme', 'Con una sessione senza email una richiesta che dice la persona riceve il 409, e una che non la dice il 422 `persona_mancante` (fino alla `v2.12` il 403).'],
    // UAT dello sprint 44 (U1-U5, in Chromium 151): la ricarica allo scadere è provata in un browser.
    'la scheda ferma: la ricarica allo scadere, provata' => ['readme', 'La ricarica allo scadere dei 30 secondi è provata il 14/10/2026 in Chromium 151, con la `v2.10.0` sulle pagine di prova'],
    'le rotte: il 403 senza workspace, sessione senza email (PR #78, seconda lettura; sprint 51 · T1.4)' => ['readme', 'Nella `v2.10` e nella `v2.11` il 403 portava `persona`, l\'email della sessione'],
    'la scheda ferma: provato in un browser' => ['readme', 'Provato in Chromium 151, con la `v2.9.0`: l\'età della pagina riparte da zero a ogni ricarica'],
    'la guida: per ricordare il tetto' => ['guida', 'Per ricordare il tetto il pacchetto non scrive niente nel browser: guarda l\'età della pagina'],
    'la guida: non contare sulla ricarica' => ['guida', 'non contare sulla ricarica per togliere dalla tua pagina i dati di prima'],
    'la guida: un dopo composto a mano' => ['guida', 'Lo fa per un `dopo` che dice di chi è e quando (`persona` e `sessione_il`, come lo dà `Cornice::dopo()`): uno composto a mano a cui manca uno dei due si unisce ancora a `subito`'],
    // Sprint 37 · T5.2 (voce #2000): la persona si riconosce dall'email, e chi garantisce che c'è è il contratto del backoffice.
    'l\'email: chi la garantisce' => ['readme', 'la cornice riconosce la persona dall\'email. L\'email c\'è sempre perché la garantisce il contratto del backoffice: nelle API `/v1` l\'email di una persona è obbligatoria, in ogni gettone'],
    'l\'email: zr-auth non la controlla' => ['readme', 'zr-auth la porta nella sessione com\'è, e non la controlla'],
    // Sprint 37 · T6 (review della PR #70: R7, R13): ciò che resta fuori lo dice anche la guida; l'email dei dati composti a mano.
    'i dati composti a mano: l\'email' => ['readme', 'Chi compone a mano i dati della cornice dà come email della persona quella della sessione: con un\'altra, campanella e ricerca non funzionano — ricaricano la pagina, dalla `v2.9.0` al più una volta ogni 30 secondi (prima a ogni uso), e fra una ricarica e l\'altra danno il loro errore'],
    'la guida: l\'email' => ['guida', 'La persona la riconosce dall\'email, che c\'è sempre: la garantisce il contratto del backoffice, non zr-auth, che la porta com\'è'],
    'Indietro: il caricamento da capo' => ['readme', 'con Inertia lo è anche a un caricamento da capo fatto con Indietro o Avanti, perché il client mostra la voce che aveva salvato'],
    'Indietro: quando arriva il segnale' => ['readme', 'Se l\'uscita rimanda a una pagina che non è di Inertia (l\'ingresso), il segnale arriva con la prima pagina di Inertia servita dopo'],
    'la guida: Indietro fra due workspace' => ['guida', 'nello stesso workspace dalla `v2.3.0`, in un altro dalla `v2.4.0`'],
    // Sprint 38 · T3.6 (voce #2026): in una scheda ferma anche gli errori di chi è entrato non vanno sotto il nome di prima.
    'la scheda ferma: gli errori' => ['readme', 'Dalla `v2.5.0` lo dicono anche gli errori di quelle rotte: il 403 `accettazione_richiesta` e il 429 della ricerca portano `persona`'],
    'la scheda ferma: gli errori a schermo' => ['readme', 'In una scheda rimasta ferma l\'errore di chi è entrato non riduce la cornice e non ferma la ricerca sotto il nome di prima, nemmeno per un disegno: la pagina si ricarica'],
    'la scheda ferma: il 403 di zr-auth' => ['readme', 'Il 403 che zr-auth dà da sé (con `codice`) non dice di chi è, e vale come prima'],
    // Sprint 44 · T4.5 (voce #2061): il 403 di chi è entrato senza workspace dice di chi è la sessione.
    'la scheda ferma: il 403 senza workspace (sprint 51 · T1.4)' => ['readme', 'Dalla `v2.12.0` a quella scheda risponde prima la regola della persona, col 409 `persona_diversa`, e la scheda si ricarica con le stesse regole delle altre risposte di un\'altra persona; il 403 arriva solo alla persona della sessione (una richiesta che non dice la persona riceve prima, dalla `v2.13.0`, il 422 `persona_mancante`), e porta il solo codice (né nome, né lingua, né workspace, né un\'email)'],
    'le rotte: il 403 senza workspace (sprint 51 · T1.4)' => ['readme', 'con la sessione ma senza workspace 403 `{errore: "gettone_senza_workspace"}`, che dalla `v2.12.0` arriva solo alla persona della sessione (dalla `v2.13.0` una richiesta che non dice la persona riceve prima il 422 `persona_mancante`), e non dice di chi è: a una pagina di un\'altra persona risponde prima il 409 `persona_diversa`'],
    'la guida: il 403 senza workspace (sprint 51 · T1.4)' => ['guida', 'Dalla `v2.12.0` nessuna delle due risposte dice chi è entrato: niente email.'],
    // Sprint 38 · T4.5 (voce #2028): «Segna tutte come lette» da una scheda ferma non è più un limite; ciò che resta, detto.
    'la scheda ferma: segna tutte' => ['readme', 'Dalla `v2.5.0` anche «Segna tutte come lette» dice per chi lo chiede: la cornice manda `persona`, l\'email di chi mostra, e la rotta la confronta con quella della sessione'],
    'la scheda ferma: il 409 (sprint 51 · T1.4)' => ['readme', 'la rotta non segna niente e risponde 409 `persona_diversa` (fino alla `v2.11` con l\'email di chi è entrato, dalla `v2.12.0` con `persona` vuota): le sue notifiche restano da leggere, l\'elenco a schermo non è dato per letto, e la pagina si ricarica'],
    'la scheda ferma: senza persona' => ['readme', 'Una richiesta senza `persona` (il JS di una versione di prima, rimasto in una scheda) vale come prima: la rotta guarda solo il workspace'],
    // Sprint 51 · T5 (review della PR #85, R1): dalla `v2.12.0` il 409 non dice chi ha risposto, e una visita non ferma più la ricarica.
    'la scheda ferma: la visita che ha portato chi è entrato (sprint 51 · T5, R1)' => ['readme', 'Dalla `v2.12.0` questo vale solo per una risposta che dice chi ha risposto: le quattro richieste mandano `Persona`, e l\'unica risposta di un\'altra persona che ricevono è il 409 `persona_diversa`, che non lo dice più'],
    'la guida: la ricarica allo scadere (sprint 51 · T5, R1)' => ['guida', 'allora si ricarica da sola, se a schermo non c\'è già chi ha risposto (dalla `v2.12.0` anche se c\'è: il 409 non dice più chi è)'],
    'la scheda ferma: ciò che resta' => ['readme', 'Una scheda rimasta ferma mostra ciò che aveva — elenco, numero della campanella, risultati — finché da lì non parte una richiesta'],
    'la scheda ferma: la riga della rotta (sprint 51 · T1.4)' => ['readme', '409 `{errore: "persona_diversa", persona: ""}`, senza chiamare il backoffice, e non si segna niente (fino alla `v2.11` `persona` era l\'email della sessione); senza la chiave `persona` conta l\'intestazione `Persona`, e senza né l\'una né l\'altra, dalla `v2.13.0`, 422'],
    // Sprint 39 · T1.3 (voce #2038): una `persona` che c'è e non è un testo non vale come assente.
    'la scheda ferma: una persona che non è un testo' => ['readme', 'dalla `v2.5.1` una `persona` che c\'è e non è un testo, anche `null`, è un 422 `dati_non_validi`, e la rotta non segna niente'],
    // Sprint 40 · T3.4 (voce #2051): che cosa manda la cornice, che cosa fa la rotta, e che cosa resta fuori.
    'la scheda ferma: l\'intestazione' => ['readme', 'La cornice, dalla `v2.6.0`, lo dice in ognuna delle quattro richieste: l\'intestazione `Persona` porta l\'email di chi la cornice mostra, passata da `encodeURIComponent`'],
    // Sprint 43 · T5 (seconda lettura della PR 77, N1-N3): il `subito` riletto porta la lingua nuova solo se la sessione l'ha
    // già; la ricarica lenta non è provata in un browser. Sprint 50 · T4.5 (voce #2059): sotto il tetto il clic aspetta la
    // lettura, e davanti alla risposta di un'altra persona la destinazione non si apre (fino alla `v2.11.4` si apriva).
    'la lettura con un clic: sotto il tetto la destinazione non si apre' => ['readme', 'Dalla `v2.11.5`, su quella pagina, il clic aspetta la risposta, e davanti al 409 la destinazione non si apre: niente è segnato a chi è entrato, e niente si apre con la sua sessione (dalla `v2.9.0` alla `v2.11.4` si apriva)'],
    'la scheda ferma: sotto il tetto la risorsa non si apre' => ['readme', 'dalla `v2.11.5` lì il clic aspetta la risposta, e davanti a uno dei due la risorsa non si apre: niente è segnato, e niente si apre con la sessione di chi è entrato (fino alla `v2.11.4` si apriva)'],
    // Sprint 44 · T2 (voce #2058): sotto il tetto la pagina si ricarica da sola quando compie 30 secondi, e riguarda chi è a schermo.
    'la scheda ferma: allo scadere, chi è a schermo' => ['readme', 'Allo scadere la cornice riguarda chi è a schermo: se una visita ha già portato chi ha risposto, la sua pagina non si ricarica; una pagina rimasta senza cornice sì'],
    'la lettura con un clic: allo scadere' => ['readme', 'Dalla `v2.10.0`, se la pagina è ancora lì quando compie 30 secondi, si ricarica allora'],
    'chi compone i dati a mano: l\'errore dopo 5 secondi' => ['readme', 'e fra una ricarica e l\'altra danno il loro errore, dalla `v2.10.0` dopo 5 secondi'],
    // Sprint 44 · T3.3 (voce #2057, rilievo N5 della seconda lettura dello sprint 42): la coda sul JS della cornice che non monta la pagina, vista in Chromium.
    'la ricerca: la coda su un JS che non monta la pagina (sprint 55 · T3.5)' => ['readme', 'Se non è il JS che monta la pagina, dalla `v2.16.0` la ricerca arriva: il pezzo riceve dalla cornice chi è a schermo e la funzione che chiama la parte server'],
    'la ricerca: la seconda esecuzione resta (sprint 55 · T3.5)' => ['readme', 'Il JS che contiene la cornice si scarica e si esegue lo stesso una seconda volta, con ciò che segue se è anche quello che monta la pagina'],
    'la lingua: solo se la sessione l\'ha già' => ['readme', 'Il `subito` riletto porta la lingua nuova solo se la sessione l\'ha già: `Cornice::subito()` non chiama il backoffice, e la lingua della sessione la rileggono `Cornice::lingua()`, `dopo()` e `dati()`'],
    'la lingua: senza, niente cambia' => ['readme', 'senza, e senza un\'altra richiesta che l\'abbia riletta dopo il `dopo` che la pagina ha, il `subito` riletto ha la lingua di prima e niente cambia'],
    'la scheda ferma: la ricarica lenta non è provata' => ['readme', 'senza niente di chi è entrato (letto nel codice: una ricarica lenta non è provata in un browser)'],
    'la guida: la lingua, se la sessione l\'ha già' => ['guida', 'Vale se la sessione ha già la lingua nuova: `Cornice::subito()` non la chiede al backoffice, la rileggono `Cornice::lingua()`, `dopo()` e `dati()`'],
    'la scheda ferma: fuori dal corpo' => ['readme', 'L\'email non sta mai nell\'indirizzo, e nel corpo di «Segna tutte come lette» non c\'è più'],
    'la scheda ferma: il clic su una notifica' => ['readme', 'nessuna delle quattro legge o segna qualcosa di chi è entrato: nemmeno il clic su una notifica, che fino alla `v2.5.1` la segnava letta a lui'],
    // Review della PR #74, R1: misurato in Chromium con la `naviga` di sempre, la destinazione si apre solo se arriva prima del 409.
    'la scheda ferma: la destinazione del clic' => ['readme', 'Fino alla `v2.13` la destinazione di quel clic si chiedeva subito, senza aspettare la risposta, e si apriva solo se arrivava prima del 409: se il 409 arrivava con la pagina ancora lì, la pagina si ricaricava al posto della destinazione'],
    'la scheda ferma: la risorsa, nel capoverso della scheda ferma' => ['readme', 'Fino alla `v2.13` la sua risorsa si apriva solo se arrivava prima di quel 409: se no la pagina si ricaricava al suo posto'],
    // Seconda lettura, N2: una frase su ciò che fa il browser dice in quale è provata.
    'la scheda ferma: la destinazione, in quale browser' => ['readme', 'ed era di chi era entrato (provato il 13/10/2026 in Chromium 151, con `window.location.assign`, il `naviga` di partenza; riprovato il 14/10/2026 con la `v2.10.0`, in cui quella ricarica la chiede un orologio, su una pagina caricata da più di 30 secondi)'],
    'la scheda ferma: la risorsa, in quale browser' => ['readme', 'come per il 403 qui sopra (provato in Chromium 151: «Le rotte della cornice»)'],
    'la scheda ferma: l\'eccezione a «si è aperta lo stesso»' => ['readme', 'La risposta di un\'altra persona a una scheda rimasta ferma ricarica la pagina'],
    // Terza lettura, N5: con la `naviga` di partenza la pagina non se ne va sempre prima della risposta.
    'la lettura con un clic: quando la pagina se ne va' => ['readme', 'la pagina se ne va alla risposta, e il numero nuovo arriva coi dati della pagina dopo'],
    // Sprint 53 · T4 (review R4, R5, R6, R8; sicurezza S1): il confine della lettura in volo, e chi deve essere a schermo.
    'la lettura in volo: anche «Vedi tutte» (review R4)' => ['readme', 'e nemmeno quello su «Vedi tutte» o su una notifica senza destinazione, che altrimenti aprono subito la pagina delle notifiche; alla risposta o all\'errore la dimentica'],
    'la lettura in volo: senza un tempo massimo (review R6)' => ['readme', 'La lettura non ha un tempo massimo: se la rete la tiene appesa, nessun clic sulle notifiche apre niente finché la pagina non si ricarica.'],
    'la lettura: chi ha fatto il clic è ancora a schermo (review R5, sicurezza S1)' => ['readme', 'E la risorsa si apre solo se chi ha fatto il clic è ancora a schermo quando la lettura risponde'],
    // Review della PR #74, R3, S2, S3: i dati senza email, e le due cose che guarda chi installa.
    // Seconda lettura, N1: un 422 solo se l'email è un testo vuoto; se manca o è `null` parte un testo, ed è un 409.
    'la scheda ferma: dei dati senza email' => ['readme', 'l\'intestazione partirebbe senza un\'email, e le quattro rotte la rifiutano: 422 `dati_non_validi` se l\'email è un testo vuoto, 409 `persona_diversa` se manca o è `null`'],
    'la scheda ferma: JS e parte server insieme' => ['readme', 'Il JS e la parte server del pacchetto si aggiornano insieme, e la cache delle rotte si rifà al deploy'],
    'la scheda ferma: l\'email in un\'intestazione' => ['readme', 'uno strumento che registra le intestazioni delle richieste la tiene, e `Persona` si aggiunge a quelle che oscura'],
    'la scheda ferma: l\'intestazione tolta per strada' => ['readme', 'Se invece qualcosa fra il browser e il frontend la toglie, fino alla `v2.12` la rotta non confrontava e la richiesta valeva come prima; dalla `v2.13.0` è un 422 `persona_mancante` con `persona` vuota, che la cornice prende per «un\'altra persona»: la scheda si ricarica, al più una volta ogni 30 secondi e solo quando parte una richiesta'],
    'la scheda ferma: un JS di prima' => ['readme', 'Un JS di prima della `v2.6.0` rimasto in una scheda non dice la persona in tre richieste — l\'elenco, la ricerca, la lettura con un clic — e prima della `v2.5.0` nemmeno in «Segna tutte come lette»'],
    'la scheda ferma: un JS di prima riceve il 422 (sprint 52 · T1.4)' => ['readme', 'dalla `v2.13.0` gli risponde 422 `{errore: "persona_mancante", persona: ""}`, e non legge né segna niente'],
    'la scheda ferma: chi si ricarica davanti al 422 (sprint 52 · T1.4)' => ['readme', 'quello della `v2.5.x`, davanti all\'elenco, alla ricerca o al clic su una notifica, la prende per «un\'altra persona» e ricarica la scheda'],
    'la scheda ferma: nel pannello' => ['readme', 'che dalla `v2.6.0` non è più nel corpo: sta nell\'intestazione `Persona`'],
    'la guida: il clic su una notifica' => ['guida', 'Dalla `v2.6.0` nemmeno il clic su una notifica: la cornice dice di chi è la pagina in ogni sua richiesta, con l\'intestazione `Persona`'],
    // Review della PR #74, R2 e R6: ciò che resta fuori, e chi chiama da sé una rotta della cornice.
    'la guida: chi chiama da sé una rotta' => ['guida', 'Se una tua pagina chiama da sé una di quelle rotte, mandi anche tu `Persona`'],
    'la guida: ciò che resta fuori (sprint 52 · T1.4)' => ['guida', 'Così un JS di prima della `v2.6.0` rimasto in una scheda non segna più a chi è entrato: mostra un errore, o si ricarica. Resta fuori una cosa, detta nello stesso punto: i dati della cornice senza l\'email.'],
    'la riga della rotta: una persona che non è un testo' => ['readme', 'non vale come assente: 422 `{errore: "dati_non_validi"}`, senza chiamare il backoffice, e non si segna niente; dalla `v2.6.0` la persona si guarda prima del workspace e degli altri controlli della rotta'],
    // Sprint 40 · T2 (voce #2051): la regola della persona è di tutte e quattro le rotte, e l'ordine dei rifiuti è scritto.
    'la regola della persona: le quattro rotte' => ['readme', 'Dalla `v2.6.0` le quattro rotte hanno una regola sola sulla persona, prima di ogni controllo loro'],
    'la regola della persona: dove si dice' => ['readme', 'nell\'intestazione `Persona`, l\'email passata da `encodeURIComponent`, o in `persona` nel corpo JSON'],
    'la regola della persona: il 409 (sprint 51 · T1.4)' => ['readme', 'la rotta risponde 409 `{errore: "persona_diversa", persona: ""}`, senza chiamare il backoffice e senza dati. Dalla `v2.12.0` `persona` è un testo vuoto, che non è l\'email di nessuno'],
    'la regola della persona: tutti e due i posti' => ['readme', 'Se la dice in tutti e due i posti valgono tutti e due: basta che uno non sia quello della sessione'],
    'la regola della persona: il 422' => ['readme', 'un valore che non è un testo, anche `null`, o un testo vuoto — è un 422 `{errore: "dati_non_validi"}`'],
    'la regola della persona: non detta (sprint 52 · T1.4)' => ['readme', 'dalla `v2.13.0` riceve 422 `{errore: "persona_mancante", persona: ""}` e non arriva alla rotta: non legge, non cerca, non segna'],
    'la regola della persona: l\'ordine (sprint 51 · T1.4)' => ['readme', 'il 401 della guardia, la persona (prima il 422, poi il 409), il 403 `gettone_senza_workspace`, e solo dopo i 422 della rotta e il 409 `workspace_diverso`'],
    'la scheda ferma: il 409 non dice chi ha risposto (sprint 51 · T1.4)' => ['readme', 'davanti a quello, se a schermo c\'è una cornice, la pagina si ricarica anche quando una visita ha già portato un\'altra persona'],
    'la regola della persona: chi sceglie' => ['readme', 'Di chi sono i dati lo dice sempre e solo la sessione: ciò che la richiesta dice si confronta e basta'],
    'la guida: segna tutte da una scheda ferma' => ['guida', 'Dalla `v2.5.0` nemmeno «Segna tutte come lette» da una scheda ferma segna le notifiche di chi è entrato: la pagina si ricarica'],
    'la guida: ciò che resta a una scheda ferma' => ['guida', 'Una scheda ferma mostra ciò che aveva finché da lì non parte una richiesta'],
    'la guida: gli errori in una scheda ferma' => ['guida', 'Dalla `v2.5.0` nemmeno i suoi errori: i documenti da accettare e il freno della ricerca di chi è entrato non cambiano la cornice sotto il nome di prima'],
    'la guida: il contenuto della pagina' => ['guida', 'Il contenuto della tua pagina, con Indietro, resta sempre quello di allora'],
    'la guida: Indietro' => ['guida', 'all\'uscita togli la cronologia, con `Inertia::clearHistory()` e la cronologia cifrata (README, «La cornice in due dati»)'],
    'a tutta area' => ['readme', 'una pagina a tutta area (`flush`) lo è dal primo disegno'],
    'se la richiesta non arriva' => ['readme', 'Se la richiesta rimandata non arriva al browser la cornice resta in attesa'],
    'il frontend può dirlo da sé' => ['readme', '`dopo={{ non_letti: true }}`'],
    'due letture per visita' => ['readme', 'io.mostra si legge due volte per visita'],
    'la guida: le due funzioni' => ['guida', 'rimandata con `Inertia::defer`, `Cornice::dopo()`'],
    'la guida: il rimando' => ['guida', 'README, «La cornice in due dati»'],
    'la guida: in attesa caricano' => ['guida', 'dalla `v2.2.0` campanella e ricerca caricano: una parola scritta intanto si cerca quando `dopo` arriva'],
    'la guida: la persona in attesa' => ['guida', 'e il menu del profilo mostra la persona di `subito`'],
    'la guida: i due tipi' => ['guida', 'i loro tipi, dalla `v2.2.0`: `DatiSubito` e `DatiDopo`, dai due ingressi'],
]);

// Sprint 58 · T1.5 (voce #2120): dalla `v2.18.0` la guida non chiede più di comporre `non_letti` a mano.
it('la guida non chiede più di comporre non_letti a mano (sprint 58 · T1.5)', function (string $frase) {
    expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md')), $frase))->toBe(false);
})->with([
    'nella stessa forma' => ['Se lo componi tu nella parte server, dallo nella stessa forma'],
    'dai non_letti' => ['non dare `null`: dai `non_letti`'],
]);

// Sprint 57 · T2.4 (voce 2086): dalla `v2.17.1` le cornici montate stanno in una pila, e con una cornice ancora montata a
// schermo c'è sempre qualcuno: il README non dice più il limite di prima al presente.
it('il README non dice più che smontata una delle due cornici a schermo non resta nessuno (sprint 57 · T2.4)', function (string $frase) {
    expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')), $frase))->toBe(false);
})->with([
    'nessuno a schermo' => ['per la cornice nessuno è a schermo'],
    'quale delle due' => ['non sa quale delle due si è smontata'],
    'il limite al presente' => ['se il limite c\'è già quando la risposta arriva'],
]);

// Sprint 45 · T2.7 (voce #2001): il cookie del segno, detto a chi installa: che cosa porta, gli attributi, che cosa non vale,
// lo scopo per l'informativa, che cosa serve e che cosa resta. La guida lo rimanda all'informativa.
it('il README dice il cookie del segno — nome, scopo per l\'informativa, contenuto, attributi e durata, che cosa serve e che cosa resta —, e la guida lo rimanda all\'informativa (sprint 45 · T2.7)', function (string $dove, string $frase) {
    $testi = [
        'readme' => suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')),
        'guida' => suUnaRiga((string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md')),
    ];

    expect(str_contains($testi[$dove], $frase))->toBe(true);
})->with([
    'il titolo' => ['readme', '### Il cookie del segno'],
    'il nome e che cosa fa' => ['readme', 'L\'ultimo segno dato sta nel cookie `__Host-zr-core-segno`, e un segno nuovo è l\'orologio della parte server se è più avanti di quello, e altrimenti quello più un microsecondo'],
    'due richieste non hanno mai lo stesso segno' => ['readme', 'Due richieste diverse, una dopo l\'altra, non hanno mai lo stesso segno: lo stesso segno c\'è dentro una richiesta, dove due letture nello stesso istante hanno lo stesso, e in due richieste in volo insieme'],
    'che cosa porta' => ['readme', 'solo l\'istante, nella forma dei segni, e la sua firma (un HMAC-SHA256 con la `APP_KEY` del frontend): niente della persona né del workspace'],
    'gli attributi e la durata' => ['readme', '`Path=/`, nessun `Domain` (il prefisso `__Host-` lo lega all\'host del modulo), `Secure`, `HttpOnly`, `SameSite=Lax`; scade con la sessione'],
    'che cosa non vale' => ['readme', 'manomesso, firmato con un\'altra chiave, in un\'altra forma, vuoto o mancante, il segno è l\'orologio, come fino alla `v2.10.0`, e la risposta riscrive il cookie'],
    'oltre i cinque minuti, come prima' => ['readme', 'Per quel browser, allora, è come fino alla `v2.10.0`: la pagina di chi entra da un server indietro di più di cinque minuti può valere come una pagina vecchia'],
    'al massimo cinque minuti avanti' => ['readme', 'il cookie vale solo se è avanti dell\'orologio della parte server di cinque minuti al massimo. Oltre, il segno è l\'orologio, la risposta riscrive il cookie, e nel log resta un avviso che non dice l\'istante del cookie'],
    'per l\'informativa' => ['readme', 'è un cookie tecnico, necessario al funzionamento della cornice'],
    'che cosa serve' => ['readme', 'lo manda `AddQueuedCookiesToResponse`, che sta già nel gruppo `web`'],
    'che cosa resta: due richieste insieme' => ['readme', 'due richieste in volo insieme leggono lo stesso cookie, e i loro segni sono gli orologi dei loro server, nel loro ordine, o lo stesso segno, il cookie più un microsecondo, se il cookie è più avanti di tutti e due'],
    'che cosa resta: un browser che non lo tiene' => ['readme', 'un browser che non tiene il cookie — i cookie rifiutati, o un indirizzo `http://`: il prefisso `__Host-` lo vuole `Secure`, e su `http://localhost` alcuni browser lo tengono e Safari no (non provato in un browser) — vale come prima della `v2.11.0`'],
    'che cosa resta: un server avanti' => ['readme', 'un server avanti di cinque minuti al massimo porta il suo orologio agli altri, per quel browser, finché l\'orologio vero non lo raggiunge'],
    'la guida: il cookie' => ['guida', 'Dalla `v2.11.0` i segni non vanno indietro per lo stesso browser: l\'ultimo dato sta nel cookie `__Host-zr-core-segno`'],
    'la guida: l\'informativa' => ['guida', 'citalo nell\'informativa sui cookie del modulo, come cookie tecnico'],
]);

// Dalla review della PR #79 (R1, S1; zr-pm, Decisione: 12931): a parità di segno non si torna, e un orologio avanti non è
// più «non frenato» e basta.
it('il README non dice più che a parità di segno la cornice prende la pagina che arriva, né che il cookie frena un orologio indietro e non uno avanti (sprint 45 · T2.8, T2.9)', function (string $frase) {
    expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')), $frase))->toBe(false);
})->with([
    'la parità' => ['A parità di segno la cornice prende la pagina che arriva'],
    'l\'orologio avanti' => ['il cookie frena un orologio indietro, non uno avanti'],
    'il più avanti fra i due' => ['un segno nuovo è il più avanti fra l\'orologio della parte server e quello'],
]);

// Sprint 38 · T2.5 (voce #2027): le tre cose che un frontend non fa con `subito` e `dopo`, e che cosa fa la cornice se
// succede. In grassetto, tutte e tre, e dove il frontend scrive le due props: non in una nota in fondo.
it('README e guida dicono in grassetto le tre cose che un frontend non fa con `subito` e `dopo`, e che la cornice resta in attesa: accanto all\'esempio e nel capoverso «In due dati», una volta sola (sprint 38 · T2.5)', function (string $file, string $da, string $a, array $inGrassetto) {
    $testo = suUnaRiga((string) file_get_contents(__DIR__.'/../../'.$file));
    $inizio = strpos($testo, $da);
    $fine = $inizio === false ? false : strpos($testo, $a, $inizio);

    expect($inizio)->not->toBeFalse()
        ->and($fine)->not->toBeFalse();

    $pezzo = substr($testo, (int) $inizio, (int) $fine - (int) $inizio);
    $quante = array_map(fn (string $frase): int => substr_count($pezzo, $frase), $inGrassetto);

    expect(array_combine($inGrassetto, $quante))->toBe(array_fill_keys($inGrassetto, 1))
        ->and(array_sum(array_map(fn (string $frase): int => substr_count($testo, $frase), $inGrassetto)))->toBe(count($inGrassetto));
})->with([
    'il README, subito dopo l\'esempio' => ['README.md', '<LayoutDellaCornice subito={subito} dopo={dopo} product="pm" onLogout={esci}>', 'I tipi delle due parti escono dai due ingressi', [
        '**Tre cose un frontend non le fa**',
        '**non rilegge `subito` senza `dopo`** (un ricaricamento parziale con `only`',
        '**non tiene `subito` con `once`**',
        '**non compone `dopo` a mano**',
        '**la cornice resta in attesa di un `dopo` di chi è entrato**',
    ]],
    'la guida, nel capoverso «In due dati»' => ['MODULO-NUOVO.md', '**In due dati**, dalla `v2.1.0`', 'In una scheda rimasta ferma, dalla `v2.4.0`', [
        '**Tre cose non le fai**',
        '**rileggere `subito` senza `dopo`** (un ricaricamento parziale con `only`)',
        '**tenere `subito` con `once`**',
        '**comporre `dopo` a mano**',
        '**resta in attesa di un `dopo` di chi è entrato**',
    ]],
]);

// Sprint 55 · T3.5 (voce #2063): dalla `v2.16.0` col JS della cornice servito con una coda da un JS che non monta la pagina la
// ricerca arriva. Il README non dice più che resta in caricamento, né che è l'eccezione al «non un caricamento che non finisce».
it('il README non dice più che con la coda la ricerca resta su «Sto cercando…» (sprint 55 · T3.5)', function (string $frase) {
    expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')), $frase))->toBe(false);
})->with([
    'resta su «Sto cercando…»' => ['la ricerca non arriva: resta su «Sto cercando…»'],
    'l\'eccezione' => ['È l\'eccezione al «non un caricamento che non finisce» detto sopra'],
    'la richiesta che non parte' => ['nessuno è a schermo: la richiesta della ricerca non parte'],
]);

// Sprint 45 · T3.6 (voce #2060): dalla `v2.11.0` la lingua ha un suo segno, e il caso che fino alla `v2.10.0` restava aperto
// — un `subito` riletto mentre `dopo` è in lettura riportava la lingua di prima — è chiuso. Il README non lo dice più aperto.
it('il README non dice più che resta aperto il caso della lingua di un `subito` riletto mentre `dopo` è in lettura (sprint 45 · T3.6)', function (string $frase) {
    expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')), $frase))->toBe(false);
})->with([
    'il caso che resta' => ['Un caso resta: il segno di `dopo` è l\'istante in cui la sua lettura comincia'],
    'la lingua di prima' => ['la cornice resta in quella di prima finché `dopo` non è riletto'],
    'il più recente dei due' => ['la lingua è quella di `subito`, il più recente dei due'],
]);

// Sprint 38 · T3.6 (voce #2026): dalla `v2.5.0` il 403 `accettazione_richiesta` e il 429 della ricerca dicono anche di chi
// sono (`persona`). Il README non dice più che portano il solo codice.
// Sprint 51 · T1 (voce #2078): dalla `v2.12.0` il 409 `persona_diversa` e il 403 `gettone_senza_workspace` non portano più
// l'email della sessione. Le frasi di prima non restano nel README come regole di oggi.
it('il README non dice più che il 409 `persona_diversa` e il 403 `gettone_senza_workspace` portano l\'email della sessione, né che il 403 viene prima della persona (sprint 51 · T1.4)', function (string $frase) {
    expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')), $frase))->toBe(false);
})->with([
    'il 409 nella regola' => ['409 `{errore: "persona_diversa", persona}` con l\'email della sessione'],
    'il 403 sotto la tabella' => ['e dalla `v2.10.0` con `persona`, l\'email della sessione'],
    'il 403 della scheda ferma' => ['porta `persona`, l\'email della sessione e niente altro'],
    'il 409 della scheda ferma' => ['risponde 409 `persona_diversa` con l\'email di chi è entrato'],
    'l\'ordine di prima' => ['il 401 della guardia, il 403 `gettone_senza_workspace`, la persona'],
]);

it('il README non dice più che quel 403 e quel 429 portano il solo codice: dalla `v2.5.0` dicono anche di chi sono (sprint 38 · T3.6)', function (string $frase) {
    expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')), $frase))->toBe(false);
})->with([
    'il 403' => ['`{errore: "accettazione_richiesta"}`, col solo codice'],
    'il 429' => ['la rotta risponde `429` `{errore: "troppe_richieste"}` con `Retry-After`'],
]);

// Sprint 35 · T4.2 (voce #1945): dalla `v2.1.0` le chiavi di una notifica della parte server sono undici, con `azioni` e
// `board_nome`. Commenti e nomi dei casi non dicono più il numero di prima.
it('nessun commento e nessun nome di caso dice più «nove chiavi» della parte server: sono undici (sprint 35 · T4.2)', function (string $file) {
    $testo = (string) file_get_contents(__DIR__.'/../../'.$file);

    expect($testo)->not->toBe('')
        ->and(substr_count($testo, 'nove chiavi'))->toBe(0);
})->with(['resources/demo/rotte-finte.ts', 'resources/demo/rotte-finte.test.ts', 'tests/Feature/NotificheTest.php']);

it('il commento di `?accorpata=1` dice che è la forma di prima della `v2.1.0`, tenuta per le schermate (sprint 35 · T4.2)', function () {
    $rotte = (string) file_get_contents(__DIR__.'/../../resources/demo/rotte-finte.ts');

    expect(substr_count($rotte, 'È la forma di prima della `v2.1.0`, tenuta per le schermate'))->toBe(1);
});

// Sprint 34 · T1.6 (voce #1929): «Riprova» il pezzo della campanella lo richiede anche in Chromium, e il README non dice più
// il contrario.
it('il README non dice più che in Chromium il pezzo della campanella non si richiede fino al ricaricamento (sprint 34 · T1.6)', function (string $frase) {
    expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')), $frase))->toBe(false);
})->with([
    'il browser non lo richiede' => ['il browser il pezzo non lo richiede'],
    'l\'errore resta' => ['e l\'errore resta fino al ricaricamento'],
]);

// Sprint 39 · T4 (voci #1972 e #1973): «Riprova» richiede il pezzo anche con una coda sull'ingresso e coi pezzi altrove, e
// l'indirizzo non viene più dall'errore: README e guida non dicono più il contrario.
it('README e guida non dicono più che con una coda sull\'ingresso o coi pezzi in un\'altra cartella serve ricaricare la pagina, né che l\'indirizzo viene dall\'errore (sprint 39 · T4.5)', function (string $frase) {
    expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')), $frase))->toBe(false)
        ->and(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md')), $frase))->toBe(false);
})->with([
    'non viene richiesto di nuovo' => ['il pezzo non viene richiesto di nuovo'],
    'serve ricaricare la pagina' => ['serve ricaricare la pagina'],
    'il nome con cui l\'errore finisce' => ['col nome di file con cui l\'errore del browser finisce'],
    'solo nella stessa cartella' => ['lo richiede solo se la tua build lo mette nella stessa cartella'],
]);

// Review della PR #72 (R1, R2, R4): la cornice non guarda più dov'è il fuoco, e la parola scritta in attesa parte anche se la
// persona ha lasciato il campo. README e guida non dicono più il limite di prima, né una prova senza la sua build.
it('README e guida non dicono più che la parola scritta in attesa parte solo col fuoco nel campo, né che una cancellata parte lo stesso (sprint 39 · T3.4)', function (string $frase) {
    expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')), $frase))->toBe(false)
        ->and(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md')), $frase))->toBe(false);
})->with([
    'il campo ha il fuoco' => ['il campo ha il fuoco'],
    'lasciata uscendo dal campo' => ['lasciata uscendo dal campo prima dell\'arrivo non parte'],
    'anche se l\'hai cancellata' => ['anche se nel frattempo l\'hai cancellata'],
    'le due forme di build' => ['provato in Chromium sulle due forme di build'],
    // Seconda lettura (N3): «fa ciò che faceva prima» si leggeva in due modi.
    'fa ciò che faceva prima' => ['«Riprova» fa ciò che faceva prima'],
]);

// Sprint 36 · T2 (voce #1968): con un'altra email la cornice si rifà, e il README non dice più che ciò che tiene è del workspace.
it('il README non dice più che ciò che la cornice tiene resta a schermo sotto il nome di un\'altra persona (sprint 36 · T2)', function (string $frase) {
    expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')), $frase))->toBe(false);
})->with([
    'è del workspace' => ['del workspace, non della persona'],
    'sotto il nome nuovo' => ['restano a schermo sotto il nome nuovo'],
]);

// Review della PR #74, R1: dalla scheda ferma la destinazione del clic non «si apre lo stesso». Misurato in Chromium con la
// `naviga` di sempre: se il 409 arriva prima che la destinazione abbia preso il posto della pagina, la pagina si ricarica.
it('il README non dice più che dalla scheda ferma la destinazione del clic su una notifica si apre lo stesso, né che dei dati senza email danno sempre un 422 (review della PR #74, R1; seconda lettura, N1)', function (string $frase) {
    expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')), $frase))->toBe(false);
})->with([
    'la destinazione' => ['La destinazione di quel clic si apre lo stesso'],
    'la sua risorsa' => ['La sua risorsa si apre lo stesso'],
    'i dati senza email: sempre vuota' => ['l\'intestazione partirebbe vuota'],
    'la pagina se ne va sempre prima' => ['la pagina se ne va prima della risposta'],
    // Sprint 50 · T4.5 (voce #2059): sotto il tetto la risorsa non si apre più con la sessione di chi è entrato.
    'sotto il tetto la destinazione si apre' => ['e allora la destinazione si apre anche se il 409 è arrivato prima'],
    'sotto il tetto la risorsa si apre' => ['la risorsa si apre anche se sono arrivati prima'],
    // Sprint 50 · T6 (review, R1, R2): né il clic sotto i 30 secondi che apre, né la ricerca che richiede il pezzo senza attesa.
    'sotto i 30 secondi si apre lo stesso' => ['sotto i 30 secondi si apre anche se la risposta di un\'altra persona è arrivata'],
    'tre casi che restano' => ['Restano tre casi'],
    'il pezzo senza attesa' => ['fra una richiesta del pezzo e l\'altra non c\'è un\'attesa'],
]);

// Sprint 36 · T3.4 (voce #1967): con Indietro il menu del profilo non mostra più la persona della pagina di allora.
it('README e guida non dicono più che con Indietro il menu del profilo mostra la persona di allora (sprint 36 · T3.4)', function (string $frase) {
    expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')), $frase))->toBe(false)
        ->and(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md')), $frase))->toBe(false);
})->with([
    'la persona di quella pagina' => ['il menu del profilo mostra la persona di quella pagina'],
    'sopra i dati di adesso, dopo' => ['e la mostra anche dopo, sopra i dati di adesso'],
]);

// Sprint 56 · T2.5 (voce #2105): dalla `v2.17.0` da `Cornice::dopo()` non passano più il 404, il 409 e il 422.
it('il README non dice più che da Cornice::dopo() passa ogni altro errore di /v1 (sprint 56 · T2.5)', function (string $frase) {
    expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')), $frase))->toBe(false);
})->with([
    'un altro errore di /v1 passa' => ['Un altro errore di `/v1` e `GettoneRifiutato` passano'],
    'un errore che dopo() lascia passare' => ['un errore di `/v1` che `Cornice::dopo()` lascia passare'],
    // Review della PR #90, R2: nello stesso workspace sotto il layout ricarica il layout, non la cornice.
    'la cornice nello stesso workspace' => ['la fa la cornice nello stesso workspace, il layout in un altro'],
]);

// Sprint 37 · T2.6 (voce #1998): `Cornice::dopo()` dice di chi sono i suoi dati, e il README non dice più il contrario.
it('il README non dice più che `dopo` non dice di chi è, né che i dati riletti stanno sopra i dati di adesso sotto il nome di allora (sprint 37 · T2.6)', function (string $frase) {
    expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')), $frase))->toBe(false);
})->with([
    'dopo non dice di chi è' => ['`dopo` non dice di chi è'],
    // Sprint 44 · T4.5 (voce #2061): il 403 senza workspace non è più detto senza `persona`.
    'il 403 senza workspace senza persona' => ['403 `{errore: "gettone_senza_workspace"}`; un backoffice'],
    // Review della PR #78, R2: i casi che restano sotto il tetto sono tre.
    'restano due casi' => ['Restano due casi'],
    // UAT dello sprint 44: la ricarica allo scadere non è più «non provata».
    'la ricarica allo scadere non provata' => ['scadere dei 30 secondi: non provato in un browser'],
    'sopra i dati di adesso' => ['sopra i dati di adesso'],
    'sotto nome ed email di allora' => ['sta sotto nome ed email di allora'],
    'li vede sotto il proprio nome' => ['li vede sotto il proprio nome'],
]);

// Sprint 38 · T4.5 (voce #2028): «Segna tutte come lette» da una scheda ferma non segna le notifiche di un'altra persona.
it('README e guida non dicono più che «Segna tutte come lette» da una scheda ferma resta fuori (sprint 38 · T4.5)', function (string $frase) {
    expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')), $frase))->toBe(false)
        ->and(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md')), $frase))->toBe(false);
})->with([
    'resta fuori' => ['Resta fuori «Segna tutte come lette»'],
    'la rotta non dice di chi è' => ['la rotta delle letture non dice di chi è'],
    'segna le notifiche di chi è nella sessione' => ['segna le notifiche di chi è nella sessione'],
]);

// Sprint 39 · T3.4 (voce #1971): i due limiti della ricerca in attesa che la `v2.5.1` chiude.
it('README e guida non dicono più i due limiti chiusi della ricerca in attesa (sprint 39 · T3.4)', function (string $frase) {
    expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')), $frase))->toBe(false)
        ->and(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md')), $frase))->toBe(false);
})->with([
    'la parola cancellata' => ['viene cercata lo stesso'],
    'i 300 ms' => ['fino ad allora sotto il campo si legge «Nessun risultato»'],
    'la parola tenuta' => ['che l\'`AppShell` ha dato alla cornice'],
]);

// Sprint 44 · T2.7 (voce #2058): sotto i 30 secondi l'errore non esce più subito, e allo scadere la pagina si ricarica da sola.
it('README e guida non dicono più che sotto i 30 secondi l\'errore esce subito, né che niente ricarica la pagina allo scadere (sprint 44 · T2.7)', function (string $frase) {
    expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')), $frase))->toBe(false)
        ->and(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md')), $frase))->toBe(false);
})->with([
    'l\'errore sotto i 30 secondi, nel capoverso della scheda ferma' => ['la richiesta dà subito il suo errore'],
    'l\'errore sotto i 30 secondi, nel capoverso del tetto' => ['chi ha chiesto ha subito l\'errore di sempre'],
    'niente la ricarica da sola' => ['niente la ricarica da sola allo scadere dei 30 secondi'],
    'l\'errore senza ricaricarsi' => ['dà l\'errore senza ricaricarsi'],
    '«Riprova» dopo i 30 secondi' => ['«Riprova» o la richiesta dopo la ricaricano'],
    'la guida: l\'errore sotto i 30 secondi' => ['dà subito l\'errore e resta con la cornice di chi c\'era prima'],
]);

// Sprint 37 · T3.6 (voce #1993): fra due workspace la cornice non riporta più chi c'era prima.
it('README e guida non dicono più il limite dei due workspace (sprint 37 · T3.6)', function (string $frase) {
    expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')), $frase))->toBe(false)
        ->and(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md')), $frase))->toBe(false);
})->with([
    'non sa più chi ha mostrato' => ['non sa più chi ha mostrato'],
    'riporta la cornice di allora' => ['riporta la cornice di allora'],
    'una pagina di un altro workspace sì' => ['una pagina di un altro workspace sì'],
    'questo limite non lo ha' => ['questo limite non lo ha'],
]);

// Sprint 37 · T5.2 (voce #2000): che l'email c'è sempre lo garantisce il contratto del backoffice. zr-auth la porta nella
// sessione com'è e non la controlla: README e guida non lo dicono garante.
it('README e guida non dicono che l\'email della persona la garantisce zr-auth (sprint 37 · T5.2)', function (string $frase) {
    expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')), $frase))->toBe(false)
        ->and(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md')), $frase))->toBe(false);
})->with([
    'la garantisce zr-auth' => ['la garantisce zr-auth'],
    'garantita da zr-auth' => ['garantita da zr-auth'],
    'zr-auth garantisce' => ['zr-auth garantisce'],
    'zr-auth la controlla' => ['zr-auth la controlla'],
]);

// Sprint 37 · T6 (review della PR #70: R6, R8): chi è mostrato non è «l'ultimo mostrato», e l'email di `dopo` non viene da io.mostra.
it('README e guida non dicono più che il layout tiene chi è stato mostrato per ultimo, né che `dopo` porta la persona come l\'ha data io.mostra (sprint 37 · T6)', function (string $frase) {
    expect(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md')), $frase))->toBe(false)
        ->and(str_contains(suUnaRiga((string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md')), $frase))->toBe(false);
})->with([
    'chi è stato mostrato per ultimo' => ['chi è stato mostrato per ultimo'],
    'come le ha date io.mostra' => ['come le ha date io.mostra'],
    // Seconda lettura (N2): su una pagina sua più vecchia di un altro workspace nome e lingua sono quelli di adesso.
    'per la stessa persona niente cambia' => ['Per la stessa persona niente cambia'],
]);

// Sprint 31 · T2.4 (voce #1866). Le frasi con chi le hanno tutti i tipi: README e guida non dicono più che sono solo di Project
// Management.
it('README e guida non dicono più che le frasi con chi le hanno solo le notifiche di Project Management (sprint 31 · T2.4)', function (string $dove, string $frase) {
    $testi = [
        'notifiche' => puntoDellaCornice((string) file_get_contents(__DIR__.'/../../README.md'), 'Le notifiche'),
        'guida' => suUnaRiga((string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md')),
    ];

    expect($testi[$dove])->not->toBe('')
        ->and(str_contains($testi[$dove], $frase))->toBe(false);
})->with([
    'solo i diciotto tipi' => ['notifiche', 'Le hanno i diciotto tipi di Project Management'],
    'una notifica di Project Management' => ['notifiche', 'una notifica di Project Management dice chi ha fatto che cosa'],
    'la guida: oggi solo Project Management' => ['guida', 'oggi lo fanno quelle di Project Management'],
]);

// Sprint 29 · T4 (review della PR #62, R2, R5, R6): quattro frasi che il README diceva e che non erano vere.
it('il README non dice più che il pannello usa titoloDellaNotifica e risorsaDellaNotifica, né che il middleware di Laravel da solo non rifiuta, né che un host con caratteri non validi prende lo stesso 400 del middleware (sprint 29 · T4, review della PR #62)', function (string $frase) {
    $readme = suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md'));

    expect(strlen($readme))->toBeGreaterThan(1000)
        ->and(str_contains($readme, $frase))->toBe(false);
})->with([
    'titoloDellaNotifica non è più la funzione del pannello (R5)' => ['è la funzione che usa il pannello delle notifiche della cornice, quindi il testo è lo stesso'],
    'risorsaDellaNotifica non è più la funzione del pannello (R5)' => ['dà il nome della cosa a cui la notifica si riferisce, ed è la funzione che usa il pannello'],
    'il middleware di Laravel rifiuta (R6)' => ['e da solo non rifiuta nessuna richiesta'],
    'un host con caratteri non validi (R2)' => ['Un host con caratteri che un nome non ha prende `400` lo stesso'],
]);

// Sprint 61 · T3.2 (voce #2150): i due limiti della `v2.20.0` non ci sono più, e il README non li dice al presente; quello
// della cronologia salvata prima della `v2.20.0` resta, e resta detto.
it('il README non dice più che il layout riconosce la persona dalla sola email, né che con due cornici insieme le richieste della prima portano l\'impronta dell\'ultima; dice ancora il limite della cronologia di prima (sprint 61 · T3.2)', function () {
    $readme = suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md'));

    expect(str_contains($readme, 'riconosce ancora la persona dalla sola email'))->toBe(false)
        ->and(str_contains($readme, 'portano l\'impronta dell\'ultima'))->toBe(false)
        ->and(str_contains($readme, 'Restano due limiti, tutti e due dalla parte del browser'))->toBe(false)
        ->and(str_contains($readme, '(`LayoutDellaCornice`) riconosce anche lui la persona da email e impronta'))->toBe(true)
        ->and(str_contains($readme, 'ogni richiesta porta l\'impronta della cornice che la fa, non quella dell\'ultima montata'))->toBe(true)
        ->and(str_contains($readme, 'Resta un limite: una voce della cronologia salvata prima della `v2.20.0` non ha l\'impronta'))->toBe(true);
});

// Sprint 62 · T2.1 (voce #2152, Decisione di zr-pm 13852): dalla `v2.21.0`, con la sessione che ha un'impronta, una richiesta
// che non la dice è il 409, e «Le rotte della cornice» lo dice, con chi rompe e i test di un frontend; il README non dice più,
// da nessuna parte, che senza l'impronta decide l'email (review della PR #100, R4-R6).
it('«Le rotte della cornice» dice che dalla `v2.21.0` una richiesta senza `X-Zr-Persona`, o coi testi `undefined` e `null`, riceve il 409, che rompe il frontend che costruisce `persona` senza `impronta`, e che cosa cambia nei suoi test; il README non dice più che senza l\'impronta decide l\'email (sprint 62 · T2.1)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    preg_match('/^### Le rotte della cornice$(.*?)(?=^##)/ms', $readme, $sezione);
    $rotte = suUnaRiga($sezione[1] ?? '');

    expect($rotte)->toContain('Dalla `v2.21.0`, con la sessione che ha un\'impronta, una richiesta che non la dice — senza `X-Zr-Persona`, o coi testi `undefined` e `null` che il JS manda con dati che non la portano — riceve lo stesso 409 `{errore: "persona_diversa", persona: ""}`')
        ->and($rotte)->toContain('Senza, dalla `v2.21.0` ogni richiesta della sua cornice riceve il 409 e la pagina si ricarica, al più una volta ogni 30 secondi e senza fine')
        ->and($rotte)->toContain('È il cambio che rompe chi non manda l\'impronta')
        ->and($rotte)->toContain('Per i test di un frontend che passa alla `v2.21.0` cambia una cosa: un caso che chiama una rotta `cornice/*` con la sola `Persona`, e una sessione che ha un id (e quindi un\'impronta), riceve il 409')
        ->and(suUnaRiga($readme))->not->toContain('vale come fino alla `v2.19` (decide l\'email)')
        ->and(suUnaRiga($readme))->not->toContain('altrimenti la sua cornice resta protetta solo dall\'email')
        ->and(suUnaRiga($readme))->not->toContain('non chiedono `X-Zr-Persona`');
});

it('la copia del registro si scrive e si azzera in `tests/Pest.php`: lì la chiamata che scrive la proprietà di `Registro` c\'è una volta, in `registroGiaLetto()`, e l\'azzeramento una volta, nel solo `afterEach`, dopo ogni caso di ogni file; nei file di `tests/Feature` nessuna delle due c\'è; e i due casi che provano l\'azzeramento fra due file sono al loro posto, l\'ultimo di questo file e il primo di quello che gira dopo (sprint 27 · T5.2; lettura della PR #60, R3)', function () {
    // Le due chiamate sono spezzate: intere, questo file le troverebbe in sé stesso.
    $chiamate = ['set'.'Value(', 'registroGiaLetto('.'null)'];
    $quante = fn (string $percorso): array => array_map(fn (string $chiamata): int => substr_count((string) file_get_contents($percorso), $chiamata), $chiamate);
    $neiFile = [];
    foreach (glob(__DIR__.'/*.php') ?: [] as $percorso) {
        $neiFile[basename($percorso)] = $quante($percorso);
    }

    // Lettura della PR #60, R3. Il conto è di due stringhe nei file di questa cartella: non vede una scrittura fatta in un altro
    // modo. Che la copia non passi da un file all'altro lo provano i due casi in coda a questo file e in testa a
    // `RegistroTest.php`, e solo al loro posto: l'ultimo caso di questo file, il primo del file che Pest gira subito dopo (in
    // ordine di nome e in un processo solo: così li lancia la CI).
    $file = array_map('basename', glob(__DIR__.'/*.php') ?: []);
    sort($file);
    // Sprint 28 · T5.4 (seconda lettura della PR #60, residuo di R3): un caso si vede con `it(` o con `test(`, con `function`
    // o con `fn`, a inizio riga o rientrato in un `describe`, e il rosso dice che cosa fare. Lettura della PR #61, R10: la
    // regola non vede un titolo fra virgolette doppie, un titolo concatenato (`'a'.$b,`) né un caso di ordine superiore
    // (`it('…')->…`, senza virgola), e prende per un caso una riga `it('…',` dentro una stringa del file: in `tests/Feature`
    // oggi non ce ne sono, e chi ne scrive uno in coda a questo file o in testa a `RegistroTest.php` allarga la regola.
    $titoli = function (string $nome): array {
        preg_match_all('/^[ \t]*(?:it|test)\(\s*\'((?:[^\'\\\\]|\\\\.)*)\'\s*,/m', (string) file_get_contents(__DIR__.'/'.$nome), $trovati);

        return $trovati[1];
    };
    $diQui = $titoli('PacchettoTest.php');
    $delFileDopo = $titoli('RegistroTest.php');
    $ultimoDiQui = (string) end($diQui);
    $primoDelFileDopo = $delFileDopo[0] ?? '';

    expect(array_key_exists('PacchettoTest.php', $neiFile))->toBe(true)
        ->and($file[(int) array_search('PacchettoTest.php', $file, true) + 1] ?? null)->toBe('RegistroTest.php', 'Il file che Pest gira subito dopo `PacchettoTest.php` non è più `RegistroTest.php`: il caso che trova il registro del pacchetto senza una copia in mano si sposta in testa al file che ora viene dopo, e questo legame si riscrive col suo nome.')
        ->and(str_starts_with($ultimoDiQui, 'un caso che scrive un registro di prova e non lo toglie non lo lascia ai casi di un altro file'))->toBe(true, "L'ultimo caso di `PacchettoTest.php` dev'essere «un caso che scrive un registro di prova e non lo toglie…», e ora è «{$ultimoDiQui}»: un caso nuovo si scrive prima di quello, non in fondo al file.")
        ->and(str_starts_with($primoDelFileDopo, 'un registro di prova scritto dall\\\'ultimo caso di un altro file non arriva qui'))->toBe(true, "Il primo caso di `RegistroTest.php` dev'essere «un registro di prova scritto dall'ultimo caso di un altro file non arriva qui…», e ora è «{$primoDelFileDopo}»: un caso nuovo si scrive dopo quello, non in testa al file.")
        ->and(array_filter($neiFile, fn (array $conta): bool => $conta !== [0, 0]))->toBe([])
        ->and($quante(__DIR__.'/../Pest.php'))->toBe([1, 1])
        ->and(substr_count((string) file_get_contents(__DIR__.'/../Pest.php'), "pest()->extend(TestCase::class)->afterEach(fn () => {$chiamate[1]})->in('Feature');"))->toBe(1);
});

// Sprint 67 · T2 (voce #2216): dalla `v2.23.0` l'impronta decide chi è la persona della pagina. Il README lo dice in «La parte
// server», con le due metà (passa con l'impronta giusta, 409 con un'altra o senza), il 401 senza sessione, dove l'email decide
// ancora e che cosa cambia per i test di un frontend; e non dice più che la scheda con l'email di prima riceve il 409.

it('il README dice, in «La parte server», che dalla `v2.23.0` l\'impronta decide chi è la persona della pagina, quando passa e quando no, dove l\'email decide ancora e che cosa cambia per i test di un frontend, e non dice più che l\'email di prima riceve il 409 (sprint 67 · T2)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');

    expect(str_contains(sezioneDelReadme($readme, 'La parte server'), $frase))->toBe(true)
        ->and(str_contains(sezioneDelReadme(conParteServerECorniceScambiate($readme), 'La parte server'), $frase))->toBe(false);
})->with([
    'l\'impronta decide' => ['Dalla `v2.23.0` l\'impronta decide chi è la persona della pagina: se la sessione ne ha una e la richiesta dice quella, la richiesta passa anche con un\'email che non è quella della sessione'],
    'perché: il cambio dell\'email' => ['la persona l\'ha cambiata da un\'altra scheda, zr-home #2214), e i dati sono sempre quelli della sessione, mentre `persona` nella risposta è l\'email che la pagina ha detto'],
    'il 409 e il 401' => ['Con un\'altra impronta, o senza, è il 409 di sempre, qualunque email dica, e senza sessione resta il 401: l\'impronta da sola non fa entrare nessuno'],
    'dove l\'email decide' => ['L\'email decide dove l\'impronta non c\'è — la sessione senza id — e dove la sessione non ha un\'email da confrontare; i 422 della persona restano prima'],
    'nessuna rotta la legge come dato' => ['Nessuna rotta della cornice legge l\'email detta come dato: l\'intestazione `Persona` e `persona` nel corpo li guarda solo `StessaPersona`'],
    'la lunghezza' => ['La `persona` della risposta è l\'email detta solo se è lunga al più 254 caratteri, quanto un\'email: una più lunga passa lo stesso, e la risposta dice quella della sessione'],
    'APP_KEY' => ['Cambiare `APP_KEY` cambia tutte le impronte, e annulla le sessioni se non c\'è `APP_PREVIOUS_KEYS`: con le chiavi di prima le schede aperte ricevono il 409 e si ricaricano'],
    'i test di un frontend' => ['un caso che aspetta il 409 da una richiesta con un\'altra email e l\'impronta della sessione ora passa, e per provare «un\'altra persona» la richiesta porta l\'impronta di quella persona'],
]);

it('nessun file di src/ oltre StessaPersona legge la persona detta dalla richiesta, né l\'intestazione `Persona` né `persona` del corpo, e le rotte della cornice dicono `persona` con StessaPersona::chiRisponde(), non con l\'email della sessione: l\'email detta non è un dato per nessuna rotta (sprint 67 · T2, nota di zr-backoffice e R2, R5 della review)', function () {
    $letture = [];
    $dellaSessione = [];
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator(__DIR__.'/../../src', FilesystemIterator::SKIP_DOTS)) as $file) {
        $nome = basename($file->getPathname());
        $testo = (string) file_get_contents($file->getPathname());
        if ($nome !== 'StessaPersona.php' && preg_match('/StessaPersona::INTESTAZIONE|(headers->(get|all)|header)\(\s*[\'"]persona[\'"]|(json|input|get|post|query|string|str|only|collect)\(\s*[\'"]persona[\'"]|->persona\b|\$persona\s*=\s*\$[a-z]+->/i', $testo) === 1) {
            $letture[] = $nome;
        }
        if (in_array($nome, ['NotificheDellaCornice.php', 'RicercaDellaCornice.php'], true) && str_contains($testo, "Sessione::utente()['email']")) {
            $dellaSessione[] = $nome;
        }
    }

    expect($letture)->toBe([])->and($dellaSessione)->toBe([]);
});

it('il README non dice più che una scheda con l\'email di prima riceve il 409 persona_diversa e si ricarica come per un\'altra persona (sprint 67 · T2)', function () {
    $readme = suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md'));

    expect(str_contains($readme, 'aperta con l\'email di prima riceve alla sua richiesta della cornice il 409'))->toBe(false)
        ->and(str_contains($readme, 'Una scheda rimasta aperta con l\'email di prima ha la stessa impronta della persona'))->toBe(true);
});

// Sprint 69 · T3.4 e T2.5 (voci 2033 e 2210). Il README dice che i clic della barra laterale passano da `naviga` ed è provvisorio; la
// guida e il README dicono dove porta un modulo `disponibile`: la pagina e il campo dei dati.
it('il README dice che i clic della barra laterale passano da `naviga`, provvisorio, con la `naviga` che la cornice ha quando si monta; README e guida dicono la pagina dei moduli e il campo `moduli` (sprint 69 · T3.4, T2.5)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $guida = (string) file_get_contents(__DIR__.'/../../MODULO-NUOVO.md');
    $inizio = (int) strpos($readme, '- **I collegamenti della barra laterale passano da `naviga`**');
    $punto = substr($readme, $inizio, (int) strpos($readme, "\n- **", $inizio + 10) - $inizio);

    expect($inizio)->toBeGreaterThan(0)
        ->and(paroleCheMancanoIn($punto, ['**È provvisorio**: finché l\'`AppShell`', 'È la `naviga` che la cornice ha quando si monta', 'la stessa dei suoi altri indirizzi']))->toBe([])
        ->and(paroleCheMancanoIn(str_replace('**È provvisorio**', '**Definitivo**', $punto), ['**È provvisorio**']))->toBe(['**È provvisorio**'])
        ->and(str_contains($readme, '/w/<slug>/impostazioni/moduli'))->toBeTrue()
        ->and(str_contains($guida, '/w/<slug>/impostazioni/moduli') && str_contains($guida, 'campo `moduli` dei dati'))->toBeTrue();
});

// L'altra metà la dicono due casi di due file: questo, l'ultimo di qui, scrive un registro di prova e non lo toglie; il primo di
// `RegistroTest.php`, il file che gira dopo, trova la parte server senza una copia in mano.

it('un caso che scrive un registro di prova e non lo toglie non lo lascia ai casi di un altro file: questo lo scrive, e il primo di `RegistroTest.php` trova quello del pacchetto (sprint 27 · T5.2)', function () {
    $diProva = [...registroDeiProdotti(), ['id' => 'uat-lasciato-da-un-altro-file']];
    registroGiaLetto($diProva);

    expect(Registro::voci())->toBe($diProva);
});
