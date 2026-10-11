<?php

use Illuminate\Filesystem\Filesystem;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\ServiceProvider;
use Symfony\Component\Process\Process;
use Zeiras\Core\Cornice;
use Zeiras\Core\Http\IntestazioniSicurezza;
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

it('composer.json chiede zr-auth ^0.12.4 e nessuna minore più vecchia, e la CI prova zr-core con quella: una voce nella matrice, due giri, con l\'ultima patch e con la più bassa accettata (sprint 13 · T1.1; review, R1 e S1; sprint 16 · T4.5; sprint 17 · T3.1)', function () {
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
    expect($vincolo)->toBe('^0.12.4')
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
        ->and($importati('./parte-server-finta'))->toBe(['clientFinto', 'colSegno', 'istanteDellaLettura', 'lettura'])
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
        ->and($scritte(['leggi(', 'props: { errors: {}, ...letta, visita: visite }', 'props: { errors: {}, ...leggi(iniziale), visita: visite }']))->toBe([
            'leggi(' => 3,
            'props: { errors: {}, ...letta, visita: visite }' => 1,
            'props: { errors: {}, ...leggi(iniziale), visita: visite }' => 1,
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
    $allArrivo = "    const letta = leggi(nome);\n\n    return () => {\n        montaggi = 0;\n        visite += 1;\n";

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
    $conOrologio = 'export function rotteFinte(slugDellaSessione: () => string | undefined, istante?: () => string): void {';

    expect(scritteNellaPaginaDiProva('layout.tsx', ['rotteFinte(', 'segno ? istanteDellaLettura : undefined);']))->toBe(['rotteFinte(' => 1, 'segno ? istanteDellaLettura : undefined);' => 1])
        ->and(scritteNellaPaginaDiProva('rotte-finte.ts', [$conOrologio, 'aggiornati_il: ', 'segnate_il: ']))->toBe([$conOrologio => 1, 'aggiornati_il: ' => 1, 'segnate_il: ' => 1]);
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
    '(b) useCornice con le sei cose che accetta' => ['La pagina', ['**La pagina** dà alla cornice montata ciò che sa solo lei, con `useCornice`', '`nav`', '`active`', '`onNavigate`', '`create`', '`actions`', '`flush`'], ['dà alla cornice montata', 'non dà alla cornice montata']],
    '(c) il percorso si dà dal layout' => ['Il percorso', ['**Il percorso** (`crumbs`, `onCrumb`) si dà dal layout, non con `useCornice`'], ['si dà dal layout', 'non si dà dal layout']],
    '(d) una <Cornice> rimasta in una pagina fa due cornici' => ['Una `<Cornice>` rimasta in una pagina', ['**Una `<Cornice>` rimasta in una pagina** sotto il layout fa due cornici'], ['fa due cornici', 'non fa due cornici']],
    '(e) le voci con un indirizzo sono link veri: la pagina si ricarica' => ['Le voci con un indirizzo', ['**Le voci con un indirizzo** (la Dashboard, i prodotti, «Impostazioni» in fondo alla barra) sono link veri: il browser ricarica la pagina'], ['sono link veri', 'non sono link veri']],
]);

it('le sei cose che il README dice di useCornice sono quelle che accetta nel codice (sprint 9 · T3.3)', function () {
    $layout = (string) file_get_contents(__DIR__.'/../../resources/js/layout.tsx');
    preg_match('/^const nomiDellaPagina = \[([^\]]*)\] as const;$/m', $layout, $elenco);
    preg_match_all('/\'(\w+)\'/', $elenco[1] ?? '', $nomi);

    expect($nomi[1])->toBe(['nav', 'active', 'onNavigate', 'create', 'actions', 'flush']);
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
    $letture = '| `POST /cornice/notifiche/letture` con `{fino_a, workspace}` |';
    $cosaDice = fn (string $testo): array => [
        'aggiornati_il nella risposta dell\'elenco' => str_contains(rigaDellaRotta($testo, 'GET /cornice/notifiche'), '| `{data: [{id, creata_il, letta, app, tipo, autore_nome, risorsa_nome, per_me}], aggiornati_il}`:'),
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
        'tipo fra le chiavi di ogni notifica' => str_contains(rigaDellaRotta($testo, 'GET /cornice/notifiche'), '| `{data: [{id, creata_il, letta, app, tipo, autore_nome, risorsa_nome, per_me}], aggiornati_il}`:'),
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

it('il README dice, in «La parte server», che a ogni lettura Cornice::dati() rimette la lingua e il nome della sessione con Sessione::aggiorna, che cambiano solo quei due, da quale richiesta valgono, il rimedio, e che chi la chiama prima ne tiene il risultato (sprint 13 · T2.7; review, R2)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $cosaDice = fn (string $testo): array => [
        'a ogni lettura, con Sessione::aggiorna' => str_contains(sezioneDelReadme($testo, 'La parte server'), 'a ogni lettura `Cornice::dati()` dà a `Sessione::aggiorna` di zr-auth la risposta di `io.mostra` che ha già letto per le non lette, e la sessione prende la lingua e il nome del profilo, se sono cambiati'),
        'cambiano solo quei due' => str_contains(sezioneDelReadme($testo, 'La parte server'), 'Cambiano solo quei due: email, workspace, ruolo e gettoni restano quelli dell\'ingresso'),
        'i dati li portano da quella stessa richiesta' => str_contains(sezioneDelReadme($testo, 'La parte server'), 'I dati della cornice portano la lingua e il nome nuovi da quella stessa richiesta'),
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
        'cambiano solo quei due' => true,
        'i dati li portano da quella stessa richiesta' => true,
        'ciò che il frontend ha letto prima resta fino alla richiesta dopo' => true,
        'il rimedio' => true,
        'chi la chiama prima ne tiene il risultato' => true,
        'perché: rilegge tutto a ogni chiamata' => true,
        'in un middleware parte a ogni richiesta' => true,
    ])
        ->and(str_contains(suUnaRiga($scambiate), 'Cambiano solo quei due: email, workspace, ruolo e gettoni restano quelli dell\'ingresso'))->toBe(true)
        ->and($cosaDice($scambiate))->toBe([
            'a ogni lettura, con Sessione::aggiorna' => false,
            'cambiano solo quei due' => false,
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
    'che cosa dà' => ['Dà la lingua della persona già aggiornata dal profilo'],
    'come la prende' => ['legge `io.mostra`, lo dà a `Sessione::aggiorna` e risponde con la lingua della sessione'],
    'senza una sessione' => ['Senza una sessione dà `null`'],
    'senza un workspace' => ['con la sessione ma senza un workspace dà la lingua della sessione, senza chiamare il backoffice'],
    // Review della PR #22, R9: la forma della lingua la guarda la riga, e il README lo dice.
    'la forma di una lingua' => ['È la lingua del profilo, se ha la forma di una lingua (due o tre lettere, poi parti di lettere e cifre unite da `-` o `_`: `it`, `pt-BR`); se no dà `null`'],
    'mai un valore che Laravel rifiuta' => ['a `App::setLocale` non arriva mai un valore che Laravel rifiuta'],
    // Seconda lettura della PR #22, N2: il ripiego di Laravel vale per i file a gruppi, non per i testi JSON.
    'una lingua che il modulo non ha' => ['Una lingua ben fatta che il modulo non ha passa com\'è: per i testi dei file a gruppi (`lang/<lingua>/…`) Laravel ripiega sul suo `fallback_locale`, per quelli JSON (`lang/<lingua>.json`) dà la chiave com\'è'],
    'quanto costa dove la cornice non c\'è' => ['Costa una lettura, `io.mostra`, nelle richieste in cui la chiami e la cornice non c\'è'],
    'nessuna in più dove c\'è' => ['dove c\'è non ne costa una in più'],
    'le letture restano quattro' => ['e le letture restano quattro'],
    'di quale lettura sono le non lette e il segno' => ['Le non lette e il segno dei dati sono allora quelli della lettura di `Cornice::lingua()`'],
    'se il backoffice non risponde non lancia' => ['Se il backoffice non risponde `Cornice::lingua()` non lancia: dà la lingua della sessione'],
    // Review, A4: vale per la prima `Cornice::dati()`; e ciò che il controller cambia dopo comprende lingua e nome.
    'l\'errore lo lancia la prima Cornice::dati(), senza un\'altra lettura' => ['lo lancia la prima `Cornice::dati()` di quella richiesta, se la chiami, senza chiamare `io.mostra` un\'altra volta'],
    'anche la lingua e il nome cambiati dal controller' => ['Vale anche per la lingua e il nome: se il controller li cambia nel profilo in quella richiesta, i dati li portano dalla richiesta dopo'],
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
    $letture = '| `POST /cornice/notifiche/letture` con `{fino_a, workspace}` |';
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

it('composer.json, README e CLAUDE.md dicono lo stesso vincolo di zr-auth, ^0.12.4, una volta, e nessuno dice più quello di prima (sprint 16 · T4.5)', function (string $file) {
    $testo = (string) file_get_contents(__DIR__.'/../../'.$file);

    expect(substr_count($testo, '^0.12.4'))->toBe(1)
        ->and(substr_count($testo, '^0.12.1'))->toBe(0)
        // Il controllo nei due versi: il vincolo di prima, rimesso, si vede.
        ->and(substr_count(str_replace('^0.12.4', '^0.12.1', $testo), '^0.12.1'))->toBe(1);
})->with(['composer.json', 'README.md', 'CLAUDE.md']);

it('CLAUDE.md dice perché il vincolo parte dalla 0.12.4, e né CLAUDE.md né il README dicono più il motivo del vincolo di prima (sprint 16 · T4.5)', function () {
    $readme = suUnaRiga((string) file_get_contents(__DIR__.'/../../README.md'));
    $claude = suUnaRiga((string) file_get_contents(__DIR__.'/../../CLAUDE.md'));

    expect(substr_count($claude, 'il vincolo non scende sotto una patch che nessun giro ha provato col codice che la usa (per questo dalla `v1.6.0` parte dalla 0.12.4: il blocco della sessione su «Segna tutte come lette» l\'hanno provato solo giri con quella).'))->toBe(1)
        ->and(str_contains($claude, 'per questo parte dalla 0.12.1'))->toBe(false)
        ->and(str_contains($readme, 'Nemmeno la 0.12.0 basta'))->toBe(false);
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
    preg_match('/^## La cornice$(.*?)(?=^#{2,3} |\z)/ms', $readme, $paragrafo);
    preg_match('/^- \*\*'.preg_quote($grassetto, '/').'\*\*.*?(?=^- |^$|\z)/ms', $paragrafo[1] ?? '', $punto);

    return suUnaRiga($punto[0] ?? '');
}

it('il README dice, nel punto «La voce attiva» di «La cornice», che nessuna voce attiva si dice con active={null} (sprint 12 · T5.6)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $frase = 'Una pagina che non sta sotto nessuna voce lo dice con `active={null}`: nessuna voce è segnata, né la Dashboard né una voce del prodotto';
    // Il README col punto della voce attiva e quello del menu Prodotti scambiati di nome: la frase c'è, ma dove si legge del menu.
    $scambiati = strtr($readme, ['- **La voce attiva**' => '- **Il menu Prodotti**', '- **Il menu Prodotti**' => '- **La voce attiva**']);
    // Il README che in quel punto parla di `active` senza nominare `null`.
    $senzaNull = str_replace('lo dice con `active={null}`', 'lo dice con `active`', $readme);

    expect(str_contains(puntoDellaCornice($readme, 'La voce attiva'), $frase))->toBe(true)
        ->and(substr_count($readme, '- **La voce attiva**'))->toBe(1)
        ->and(substr_count($readme, '- **Il menu Prodotti**'))->toBe(1)
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
    'una lettura senza altre' => ['POST /cornice/notifiche/letture', '| `POST /cornice/notifiche/letture` con `{fino_a, workspace}` |', 'o risponde senza `altre` o con un `altre` che non è un booleano, alla prima chiamata o a un richiamo, è un errore (5xx)'],
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
    'il tratto dal server del modulo al backoffice' => ['dal server del modulo al backoffice la parola viaggia ancora nell\'indirizzo (`GET /v1/ricerca?q=`), finché il backoffice non dà un metodo col termine nel corpo'],
]);

it('il README dice, nel punto «La ricerca», che la cornice cerca con una POST, la parola nel corpo e il gettone CSRF, che la parola non sta più nell\'indirizzo della richiesta del browser ma resta in quello della richiesta al backoffice, e che nel codice del frontend non cambia niente; la GET con la parola nell\'indirizzo non è più nominata (sprint 18 · T1.6)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $punto = puntoDellaCornice($readme, 'La ricerca');

    expect(str_contains($punto, 'chiede `POST /cornice/ricerca` dal secondo carattere, 300 ms dopo l\'ultimo tasto, con la parola nel corpo (`{q}`) e il gettone CSRF del cookie `XSRF-TOKEN` nell\'header `X-XSRF-TOKEN`'))->toBe(true)
        ->and(str_contains($punto, 'dalla `v1.8.0` ciò che la persona cerca non sta più nell\'indirizzo della richiesta del browser'))->toBe(true)
        // Review della PR #22, R2: la promessa vale per il tratto del browser, e il README dice l'altro.
        ->and(str_contains($punto, 'Il tratto dal server del modulo al backoffice resta una GET con la parola nell\'indirizzo, finché il backoffice non dà un metodo col termine nel corpo'))->toBe(true)
        ->and(str_contains(suUnaRiga($readme), 'non sta più nell\'indirizzo di una richiesta'))->toBe(false)
        // Review, R4: una frase sola, la stessa della riga della rotta.
        ->and(str_contains($punto, 'Nel codice del frontend non cambia niente; un suo test che chiama la GET passa alla POST'))->toBe(true)
        ->and(substr_count($readme, '- **La ricerca**'))->toBe(1)
        // La rotta di prima: né una riga della tabella, né nominata altrove.
        ->and(rigaDellaRotta($readme, 'GET /cornice/ricerca?q='))->toBe('')
        ->and(str_contains($readme, 'GET /cornice/ricerca'))->toBe(false);
});

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

it('la CI rigenera la favicon e la confronta, dopo npm ci; lo script è di questo repo, e resvg sta fra gli strumenti a una versione esatta (sprint 15 · T3.3)', function () {
    $ci = (string) file_get_contents(__DIR__.'/../../.github/workflows/ci.yml');
    $package = json_decode((string) file_get_contents(__DIR__.'/../../package.json'), true, flags: JSON_THROW_ON_ERROR);

    expect(substr_count($ci, 'npm run favicon -- --controlla'))->toBe(1)
        ->and(strpos($ci, 'npm run favicon -- --controlla'))->toBeGreaterThan((int) strpos($ci, 'npm ci'))
        ->and($package['scripts']['favicon'] ?? null)->toBe('node scripts/favicon.mjs')
        ->and($package['devDependencies']['@resvg/resvg-js'] ?? null)->toBe('2.6.2')
        ->and(array_keys($package['peerDependencies']))->toBe(['react', 'react-dom'])
        ->and($package)->not->toHaveKey('dependencies');
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

    expect(array_slice($titoli[1], -3))->toBe(['La favicon', 'Le intestazioni di sicurezza', 'La CSP'])
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
    'da dove si importa, e per chi' => ['Dallo stesso ingresso si importa `titoloDellaNotifica(tipo, lingua)`, per chi mostra le notifiche in una pagina sua'],
    'che cosa dà' => ['dà il titolo di una notifica di quel tipo nella lingua'],
    'è la funzione del pannello' => ['è la funzione che usa il pannello delle notifiche della cornice, quindi il testo è lo stesso'],
    'che cos\'è tipo' => ['`tipo` è il `tipo` della notifica, com\'è nella risposta del backoffice (`com.zeiras.board.scheda.creata`)'],
    'che cos\'è lingua' => ['`lingua` è il codice della lingua della persona, e vale come per la cornice: `it-IT` è `it`'],
    'una lingua che zr-core non ha' => ['con una lingua che zr-core non ha il titolo è in inglese'],
    'i tipi conosciuti sono le chiavi dell\'inglese' => ['I tipi che zr-core conosce sono le chiavi `notificationTitle.<tipo>` dell\'inglese (`resources/lingue/en.json`)'],
    'il ripiego' => ['un tipo che non è fra quelle — nuovo nel contratto, vuoto, mancante, o che non è un testo — ha il titolo di ripiego della lingua («Novità nel workspace»)'],
    'mai il codice del tipo' => ['ha il titolo di ripiego della lingua («Novità nel workspace»), mai il codice del tipo'],
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
]);

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
        'dati={{ ...datiScrittiUndefined, ...datiDiProva, ',
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
        'per_me, e null che non è false' => '`per_me` dice se è rivolta alla persona (`true`), a tutto il workspace (`false`) o se il backoffice non lo sa (`null`, che non è `false`)',
        'quando sono null' => 'ognuna è `null` quando il backoffice dà `null` o non manda la chiave',
        'di autore solo il nome' => 'di `autore` passa solo il nome',
        'un\'altra forma è un errore' => 'una delle tre con una forma che il contratto non ammette',
        'mai tolta in silenzio' => 'mai una chiave tolta in silenzio',
    ]);
    $tutto = fn (bool $detto): array => array_fill_keys(['la versione e che cosa sono', 'per_me, e null che non è false', 'quando sono null', 'di autore solo il nome', 'un\'altra forma è un errore', 'mai tolta in silenzio'], $detto);

    // Il README con la riga dell'elenco e quella della ricerca scambiate di rotta: ogni frase c'è, ma nella riga di un'altra rotta.
    expect($cosaDice($readme))->toBe($tutto(true))
        ->and($cosaDice(strtr($readme, [$elenco => $ricerca, $ricerca => $elenco])))->toBe($tutto(false));
});

it('la pagina di prova ha i tre casi delle notifiche con ?chi=1, e senza resta com\'era: lo dicono il file delle rotte finte e la testa della pagina (sprint 20 · T1.7)', function () {
    $conChiECosa = "...detti('Marta Rossi', 'UAT Scrivere il brief del lancio', true) },";
    $perTutti = "...detti('Bruno Neri', null, false) },";

    expect(scritteNellaPaginaDiProva('rotte-finte.ts', [".has('chi');", $conChiECosa, $perTutti, '...nonDetti }', '(chi ? { autore_nome, risorsa_nome, per_me } : nonDetti);']))
        ->toBe([".has('chi');" => 1, $conChiECosa => 1, $perTutti => 1, '...nonDetti }' => 3, '(chi ? { autore_nome, risorsa_nome, per_me } : nonDetti);' => 1])
        ->and(scritteNellaPaginaDiProva('demo.tsx', ['con `?chi=1` le notifiche dicono chi ha fatto, su che cosa']))->toBe(['con `?chi=1` le notifiche dicono chi ha fatto, su che cosa' => 1]);
});
