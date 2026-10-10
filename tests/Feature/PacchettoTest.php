<?php

use Illuminate\Support\Facades\File;
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

// Sprint 5 · T6 (voce #1257) e poi, una minore alla volta, sprint 7 · T1 (voce #1380, la 0.8), sprint 8 · T1 (voce #1402, la
// 0.9), sprint 9 · T5 (voce #1442, la 0.10), sprint 11 · T5 (voce #1458, la 0.11) e sprint 12 · T7 (la 0.12, dentro la
// v1.3.0): fino alla v1.3.0 zr-core si installava accanto allo zr-auth che i frontend avevano, composer.json accettava sette
// versioni minori, dalla 0.6 alla 0.12, e la CI le provava tutte, un giro del job per ognuna. Sprint 13 · T1 (voce #1480):
// dalla v1.4.0 la minore è una, la 0.12, perché la cornice chiama `Sessione::aggiorna`, che c'è da lì. La regola non cambia:
// una versione accettata e mai provata è una promessa senza prova.

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
 * Cosa non torna fra le versioni di zr-auth che composer.json accetta e i giri della CI: una versione minore accettata che la
 * CI non prova, o una provata che composer.json non accetta; un giro che non installa la versione della sua voce della matrice
 * (due giri proverebbero la stessa). Il vincolo è fatto di `^0.<minore>`, anche con la patch: uno solo, o più d'uno uniti da
 * `||`. La matrice di ci.yml (`zr-auth: ['0.12']`) ha un giro per ognuno, ogni voce fra apici: senza, YAML legge `0.10` come
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
    // Ogni giro installa l'ultima versione della minore della sua voce: la voce arriva al passo in ZR_AUTH, e restringe il
    // vincolo di composer.json. Senza questo legame i giri avrebbero nomi diversi e la stessa versione.
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

it('composer.json chiede zr-auth ^0.12.1 e nessuna minore più vecchia, e la CI prova zr-core con quella: una voce nella matrice, un giro (sprint 13 · T1.1; review, R1 e S1)', function () {
    $composer = json_decode((string) file_get_contents(__DIR__.'/../../composer.json'), true, flags: JSON_THROW_ON_ERROR);
    $vincolo = $composer['require']['zeiras/zr-auth'];
    $ci = (string) file_get_contents(__DIR__.'/../../.github/workflows/ci.yml');

    // Dalla 0.12.1, non dalla 0.12.0: il vincolo dice la patch che ha provato il codice che la usa. La 0.12.0 l'ha provata solo una
    // zr-core che `Sessione::aggiorna` non la chiamava (il giro della PR #15, sprint 12, e quello del primo commit di questo sprint);
    // con la cornice che la chiama i giri hanno installato dalla 0.12.1 in su, e fra le due patch è cambiata proprio `aggiorna`: nella 0.12.0
    // prende lingua e nome anche da una risposta senza `utente.id`. Sotto la 0.12 no: `Sessione::aggiorna` non c'è, e una guardia
    // per le versioni più vecchie l'analisi statica la segna in ogni giro (sonda del 10/10/2026).
    expect($vincolo)->toBe('^0.12.1')
        ->and(vociDellaMatriceDiZrAuth($ci))->toBe("'0.12'")
        ->and(versioniDiZrAuthNonProvate($vincolo, $ci))->toBe([]);
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

it('CLAUDE.md dice, accanto al vincolo, che la CI fa un giro per ogni versione minore accettata, con l\'ultima di ognuna, e che dalla v1.4.0 la minore è una, e perché (sprint 11 · T5.3; sprint 13 · T1.2)', function () {
    $composer = json_decode((string) file_get_contents(__DIR__.'/../../composer.json'), true, flags: JSON_THROW_ON_ERROR);
    $vincolo = $composer['require']['zeiras/zr-auth'];
    $claude = (string) file_get_contents(__DIR__.'/../../CLAUDE.md');

    // Il README i giri li elenca, e il caso qui sotto li conta sulla matrice; CLAUDE.md dice la regola, che non cambia con le
    // versioni: sta nella riga del vincolo, una volta. Accanto, perché la minore è una: è ciò che legge chi vorrebbe riallargare
    // il vincolo a una zr-auth senza `Sessione::aggiorna`.
    expect(substr_count($claude, "`zeiras/zr-auth` `{$vincolo}`: la CI fa un giro per ogni versione minore accettata, con l'ultima di ognuna"))->toBe(1)
        ->and(substr_count(suUnaRiga($claude), "e il verde è di tutti i giri (dalla `v1.4.0` la minore è una: la cornice chiama `Sessione::aggiorna`, che c'è dalla 0.12)."))->toBe(1);
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

it('il README dice un giro della CI per ogni voce della matrice, e nessun altro (sprint 8 · T1.3; sprint 13 · T1.3)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $ci = (string) file_get_contents(__DIR__.'/../../.github/workflows/ci.yml');
    preg_match_all("/'(\d+\.\d+)'/", vociDellaMatriceDiZrAuth($ci) ?? '', $voci);

    // Il README rimasto alla v1.3.0: dice i sette giri di allora. E quello che dice il giro giusto e, in un altro punto, uno che
    // la matrice non ha.
    $readmeDiPrima = str_replace("(la CI lo prova con l'ultima 0.12)", "(la CI lo prova con l'ultima 0.6, l'ultima 0.7, l'ultima 0.8, l'ultima 0.9, l'ultima 0.10, l'ultima 0.11 e l'ultima 0.12)", $readme);
    $conUnGiroInPiu = $readme."\nLa CI lo prova anche con l'ultima 0.11.\n";

    expect($voci[1])->not->toBe([])
        ->and(giriDettiDa($readme))->toBe($voci[1])
        ->and($readmeDiPrima)->not->toBe($readme)
        ->and(giriDettiDa($readmeDiPrima))->toBe(['0.6', '0.7', '0.8', '0.9', '0.10', '0.11', '0.12'])
        ->and(giriDettiDa($conUnGiroInPiu))->toBe([...$voci[1], '0.11']);
});

it('il README dice, in «La parte server», da quale versione zr-core chiede zr-auth ^0.12.1, perché, che con una zr-auth più vecchia Composer lascia zr-core alla v1.3.0, e che nemmeno la 0.12.0 basta (sprint 13 · T1.3; review, R1 e S1)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $cosaDice = fn (string $testo): array => [
        'da quale versione' => str_contains(sezioneDelReadme($testo, 'La parte server'), 'Dalla `v1.4.0` una zr-auth più vecchia non basta'),
        'perché' => str_contains(sezioneDelReadme($testo, 'La parte server'), 'la cornice chiama `Sessione::aggiorna`, che c\'è dalla 0.12'),
        'con una più vecchia Composer lascia zr-core alla v1.3.0' => str_contains(sezioneDelReadme($testo, 'La parte server'), 'con una più vecchia Composer lascia zr-core alla `v1.3.0`'),
        'nemmeno la 0.12.0, e perché' => str_contains(sezioneDelReadme($testo, 'La parte server'), 'Nemmeno la 0.12.0 basta: la sua `Sessione::aggiorna` prende la lingua e il nome anche da una risposta che non dice di chi sono (senza `utente.id`); dalla 0.12.1 no'),
    ];

    // Con «La parte server» e «La cornice» scambiate le quattro cose sono dette, ma non dove si legge che cosa zr-core richiede.
    $scambiate = conParteServerECorniceScambiate($readme);

    expect($cosaDice($readme))->toBe([
        'da quale versione' => true,
        'perché' => true,
        'con una più vecchia Composer lascia zr-core alla v1.3.0' => true,
        'nemmeno la 0.12.0, e perché' => true,
    ])
        ->and(str_contains(suUnaRiga($scambiate), 'una zr-auth più vecchia non basta'))->toBe(true)
        ->and($cosaDice($scambiate))->toBe([
            'da quale versione' => false,
            'perché' => false,
            'con una più vecchia Composer lascia zr-core alla v1.3.0' => false,
            'nemmeno la 0.12.0, e perché' => false,
        ]);
});

it('il controllo trova una versione accettata che la CI non prova, una provata che composer.json non accetta e un giro che non installa la versione della sua voce (sprint 5 · T6.1; sprint 13 · T1.1)', function () {
    $ci = (string) file_get_contents(__DIR__.'/../../.github/workflows/ci.yml');
    $vincolo = '^0.12.1';
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

    // La voce della matrice che non arriva al passo: il giro installerebbe una versione scritta nel passo, e sarebbe verde.
    $conLaVersioneFissa = str_replace('ZR_AUTH: ${{ matrix.zr-auth }}', "ZR_AUTH: '0.11'", $ci);
    $senzaIlVincoloDelGiro = str_replace(' --with "zeiras/zr-auth:~${ZR_AUTH}.0"', '', $ci);

    expect($conLaMatriceDiPrima)->not->toBe($ci)
        ->and($conLaVoceSenzaApici)->not->toBe($ci)
        ->and($conUnAltraMinore)->not->toBe($ci)
        ->and($conUnaMinoreInPiu)->not->toBe($ci)
        ->and($conLaVersioneFissa)->not->toBe($ci)
        ->and($senzaIlVincoloDelGiro)->not->toBe($ci)
        ->and(versioniDiZrAuthNonProvate($vincolo, $conLaMatriceDiPrima))->toBe(['la CI prova zr-auth 0.6, che composer.json non accetta', 'la CI prova zr-auth 0.7, che composer.json non accetta', 'la CI prova zr-auth 0.8, che composer.json non accetta', 'la CI prova zr-auth 0.9, che composer.json non accetta', 'la CI prova zr-auth 0.10, che composer.json non accetta', 'la CI prova zr-auth 0.11, che composer.json non accetta'])
        ->and(versioniDiZrAuthNonProvate($vincoloDiPrima, $ci))->toBe(['la CI non prova zr-auth 0.6', 'la CI non prova zr-auth 0.7', 'la CI non prova zr-auth 0.8', 'la CI non prova zr-auth 0.9', 'la CI non prova zr-auth 0.10', 'la CI non prova zr-auth 0.11'])
        ->and(versioniDiZrAuthNonProvate('^0.11 || ^0.12', $ci))->toBe(['la CI non prova zr-auth 0.11'])
        ->and(versioniDiZrAuthNonProvate($vincolo, $conLaVoceSenzaApici))->toBe(['la CI non prova zr-auth 0.12'])
        ->and(versioniDiZrAuthNonProvate($vincolo, $conUnAltraMinore))->toBe(['la CI non prova zr-auth 0.12', 'la CI prova zr-auth 0.11, che composer.json non accetta'])
        ->and(versioniDiZrAuthNonProvate($vincolo, $conUnaMinoreInPiu))->toBe(['la CI prova zr-auth 0.13, che composer.json non accetta'])
        ->and(versioniDiZrAuthNonProvate($vincolo, $conLaVersioneFissa))->toBe(['i giri non installano la versione di zr-auth della loro voce della matrice'])
        ->and(versioniDiZrAuthNonProvate($vincolo, $senzaIlVincoloDelGiro))->toBe(['i giri non installano la versione di zr-auth della loro voce della matrice'])
        // Senza matrice la CI fa un giro solo, con la versione che composer sceglie: nessuna delle due è provata di proposito.
        ->and(versioniDiZrAuthNonProvate('^0.6 || ^0.7', "jobs:\n  ci:\n    runs-on: ubuntu-latest\n"))
        ->toBe(['la CI non prova zr-auth 0.6', 'la CI non prova zr-auth 0.7', 'i giri non installano la versione di zr-auth della loro voce della matrice'])
        ->and(versioniDiZrAuthNonProvate('>=0.6', $ci))->toBe(['il vincolo «>=0.6» non è fatto di ^0.<minore> uniti da ||'])
        // Dalla 1.0 un `^` accetta anche le minori dopo: il controllo lo dice, invece di contarla come una minore sola.
        ->and(versioniDiZrAuthNonProvate('^0.8 || ^1.0', $ci))->toBe(['il vincolo «^0.8 || ^1.0» non è fatto di ^0.<minore> uniti da ||']);
});

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
        'aggiornati_il nella risposta dell\'elenco' => str_contains(rigaDellaRotta($testo, 'GET /cornice/notifiche'), '| `{data: [{id, creata_il, letta, app, tipo}], aggiornati_il}`:'),
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
    $ricerca = '| `GET /cornice/ricerca?q=` |';
    // Chi non traduce il tipo è la parte server: zr-core, nel browser, gli dà un titolo (il punto «Le notifiche»).
    $cosaDice = fn (string $testo): array => [
        'tipo fra le chiavi di ogni notifica' => str_contains(rigaDellaRotta($testo, 'GET /cornice/notifiche'), '| `{data: [{id, creata_il, letta, app, tipo}], aggiornati_il}`:'),
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
        'il rimedio' => str_contains(sezioneDelReadme($testo, 'La parte server'), 'chiama `Cornice::dati()` prima di leggere la lingua, o rilegge `Sessione::utente()` dopo'),
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
]);

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
    $ricerca = '| `GET /cornice/ricerca?q=` |';
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
    'il tetto del tempo' => ['nessuna chiamata nuova passati 10 secondi dalla prima'],
    'che cos\'è altre' => ['`altre` è `false` quando il backoffice ha detto che non ne restano, e `true` quando un tetto ha fermato i richiami e ne restano ancora'],
    'con altre: true la stessa richiesta continua' => ['la stessa richiesta, ripetuta, continua da lì'],
    'segnate_il è dopo l\'ultima risposta' => ['`segnate_il` è l\'istante preso dopo l\'ultima risposta del backoffice'],
    'un richiamo che fallisce è un errore' => ['alla prima chiamata o a un richiamo, è un errore (5xx) senza `segnate_il`'],
]);

it('il README dice, nel punto «Le notifiche», che cosa vede la persona quando un clic non le segna tutte (sprint 12 · T4.6)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $scambiati = conNotificheERicercaScambiate($readme);

    expect(str_contains(puntoDelleNotifiche($readme), $frase))->toBe(true)
        ->and(substr_count($readme, '- **Le notifiche**'))->toBe(1)
        ->and(substr_count($readme, '- **La ricerca**'))->toBe(1)
        ->and(str_contains(suUnaRiga($scambiati), $frase))->toBe(true)
        ->and(str_contains(puntoDelleNotifiche($scambiati), $frase))->toBe(false);
})->with([
    'quando un clic non basta' => ['con più di 25.000 non lette, o se i richiami durano più di 10 secondi, un clic non le segna tutte'],
    'che cosa vede la persona' => ['la campanella tiene il numero dei dati, il pannello si ricarica e «Segna tutte come lette» resta, per continuare con un altro clic'],
]);

// Sprint 12 · review, S1 (decisione di zr-pm): «Segna tutte come lette» può durare fino a circa 15 secondi, e in Laravel una richiesta
// lenta, quando finisce, riscrive la sessione com'era all'inizio. Il README lo dichiara nel punto «Le notifiche», una frase per cosa.
it('il README dichiara, nel punto «Le notifiche», il limite della sessione con una richiesta lenta (sprint 12 · review, S1)', function (string $frase) {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $scambiati = conNotificheERicercaScambiate($readme);

    expect(str_contains(puntoDelleNotifiche($readme), $frase))->toBe(true)
        ->and(str_contains(suUnaRiga($scambiati), $frase))->toBe(true)
        ->and(str_contains(puntoDelleNotifiche($scambiati), $frase))->toBe(false);
})->with([
    'che cosa fa una richiesta lenta' => ['una richiesta lenta, quando finisce, riscrive la sessione com\'era all\'inizio e ne rimanda il cookie'],
    'quanto dura qui' => ['fino a circa 15 secondi, solo con più di 5000 non lette'],
    'che cosa succede' => ['la persona esce o entra in un altro workspace da un\'altra scheda, la sessione torna quella di prima'],
    'dopo un cambio di workspace' => ['dopo un cambio di workspace la persona si ritrova in quello di prima'],
    // Seconda lettura, N3: dopo un'uscita i gettoni sono chiusi solo se la chiamata dell'uscita al backoffice è riuscita.
    'dopo un\'uscita tornano i gettoni di prima' => ['dopo un\'uscita torna la sessione coi gettoni di prima'],
    'dopo un\'uscita che li ha chiusi' => ['se l\'uscita li ha chiusi nel backoffice, la prima chiamata la richiude'],
    'dopo un\'uscita senza la risposta del backoffice' => ['se all\'uscita il backoffice non ha risposto — la sessione si chiude lo stesso — possono valere ancora, fino alla loro scadenza'],
    // Seconda lettura, N2: il blocco serve dalle due parti, e uscita e ingresso sono rotte del frontend.
    'zr-core non lo chiude da solo' => ['zr-core da solo non lo chiude: serve il blocco della sessione di Laravel sia su questa rotta sia sulle rotte che fanno uscire o entrare in un workspace'],
    'di chi sono quelle rotte' => ['quelle del frontend e il ricevitore dell\'ingresso di zr-auth'],
    'per quanto, e da una parte sola' => ['per più dei 10 secondi predefiniti: messo da una parte sola non ferma niente'],
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
    $ricerca = '| `GET /cornice/ricerca?q=` |';
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
    // Seconda lettura, N4: il testo del pulsante è di zr-core; al design system manca il posto per un avviso.
    'R2: due cose non le dice' => ['Le notifiche', 'Due cose la cornice oggi non le dice: che una parte è stata segnata'],
    'R2: che cosa manca per dirle' => ['Le notifiche', 'Il pannello del design system non ha un posto per un avviso; il testo del pulsante lo dà zr-core, e in questa versione è sempre lo stesso'],
    'R2: niente dice che una parte è segnata' => ['Le notifiche', 'se le segnate non sono fra quelle in pagina, il pannello ricaricato è uguale a prima, come dopo un clic fallito'],
    'R2: niente dice che la richiesta è in corso' => ['Le notifiche', 'fino alla risposta, che con migliaia di non lette può arrivare dopo circa 15 secondi, il pulsante resta com\'è'],
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
    'N2: uscita e ingresso non sono rotte di zr-auth' => ['sia su questa rotta sia sulle rotte che fanno uscire o entrare in un workspace', 'sulle rotte di uscita e di ingresso nel workspace, che sono di zr-auth'],
    'N3: dopo un\'uscita i gettoni non sono sempre chiusi' => ['dopo un\'uscita torna la sessione coi gettoni di prima', 'dopo un\'uscita i suoi gettoni sono già chiusi nel backoffice'],
    'N4: non è il design system che non ha con che dirle' => ['Due cose la cornice oggi non le dice: che una parte', 'Due cose la cornice oggi non le dice, perché il design system non ha con che dirle: che una parte'],
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
