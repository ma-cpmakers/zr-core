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

// Sprint 5 · T6 (voce #1257), sprint 7 · T1 (voce #1380, la 0.8), sprint 8 · T1 (voce #1402, la 0.9) e sprint 9 · T5 (voce
// #1442, la 0.10). zr-core si installa accanto allo zr-auth che i frontend hanno: composer.json accetta più versioni minori, e
// la CI le prova tutte, un giro del job per ognuna. Una versione accettata e mai provata è una promessa senza prova.

/**
 * Cosa non torna fra le versioni di zr-auth che composer.json accetta e i giri della CI: una versione minore accettata che la
 * CI non prova, o una provata che composer.json non accetta; un giro che non installa la versione della sua voce della matrice
 * (due giri proverebbero la stessa). Il vincolo è fatto di `^0.<minore>`, anche con la patch, uniti da `||`, e la
 * matrice di ci.yml (`zr-auth: ['0.6', '0.7', '0.8', '0.9', '0.10']`) ha un giro per ognuno, ogni voce fra apici: senza,
 * YAML legge `0.10` come il numero 0.1, e quella voce qui non conta. Solo sotto la 1.0 un `^` si ferma alla sua minore:
 * `^1.0` accetta anche le 1.1, che il giro della 1.0 non proverebbe.
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

it('composer.json accetta zr-auth 0.6, 0.7, 0.8, 0.9 e 0.10, e la CI prova zr-core con tutte e cinque, un giro per versione (sprint 5 · T6.1; sprint 7 · T1.1; sprint 8 · T1.1; sprint 9 · T5.1)', function () {
    $composer = json_decode((string) file_get_contents(__DIR__.'/../../composer.json'), true, flags: JSON_THROW_ON_ERROR);
    $vincolo = $composer['require']['zeiras/zr-auth'];
    $ci = (string) file_get_contents(__DIR__.'/../../.github/workflows/ci.yml');

    // Della 0.6 dalla 0.6.6, l'ultima e quindi quella che la CI prova: le prime (fino alla 0.6.1) tenevano in sessione
    // l'accesso di un'altra persona, e una patch più vecchia non la prova nessun giro. Della 0.7 dalla 0.7.0: l'ha provata il
    // giro della v1.0.0, e la 0.7.1 che il giro prova oggi cambia solo il finto per i test di zr-auth, che zr-core non usa.
    // Della 0.8 dalla 0.8.0, la prima. Della 0.9 dalla 0.9.1, l'ultima e quindi quella che la CI prova: la 0.9.0 non l'ha
    // provata nessun giro. Della 0.10 dalla 0.10.0, la prima: è quella che il giro prova.
    expect($vincolo)->toBe('^0.6.6 || ^0.7 || ^0.8 || ^0.9.1 || ^0.10')
        ->and(versioniDiZrAuthNonProvate($vincolo, $ci))->toBe([]);
});

it('README e CLAUDE.md dicono il vincolo di composer.json, e nessun altro (sprint 7 · T1.3; sprint 8 · T1.3; sprint 9 · T5.3)', function (string $file) {
    $composer = json_decode((string) file_get_contents(__DIR__.'/../../composer.json'), true, flags: JSON_THROW_ON_ERROR);
    $vincolo = $composer['require']['zeiras/zr-auth'];
    $testo = (string) file_get_contents(__DIR__.'/../../'.$file);

    // Il vincolo di prima dell'ultima versione accettata, con una versione in meno: nel file rimasto indietro, e in quello che
    // dice il vincolo nuovo in un punto e il vecchio in un altro.
    $vincoloDiPrima = (string) preg_replace('/ \|\| [^|]+$/', '', $vincolo);

    expect(vincoliAPiuVersioniIn($testo))->toBe([$vincolo])
        ->and(vincoliAPiuVersioniIn(str_replace($vincolo, $vincoloDiPrima, $testo)))->toBe([$vincoloDiPrima])
        ->and(vincoliAPiuVersioniIn($testo."\n`{$vincoloDiPrima}`"))->toBe([$vincolo, $vincoloDiPrima]);
})->with(['README.md', 'CLAUDE.md']);

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

it('il README dice un giro della CI per ogni voce della matrice, e nessun altro (sprint 8 · T1.3; sprint 9 · T5.3)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $ci = (string) file_get_contents(__DIR__.'/../../.github/workflows/ci.yml');
    preg_match('/^\s+zr-auth: \[([^\]\n]*)\]$/m', $ci, $matrice);
    preg_match_all("/'(\d+\.\d+)'/", $matrice[1] ?? '', $voci);
    $ultima = (string) end($voci[1]);

    // Il README rimasto indietro di una versione: dice i giri di prima, senza quello dell'ultima voce della matrice.
    $readmeDiPrima = str_replace(" e l'ultima {$ultima})", ')', $readme);

    expect($voci[1])->not->toBe([])
        ->and($readmeDiPrima)->not->toBe($readme)
        ->and(giriDettiDa($readme))->toBe($voci[1])
        ->and(giriDettiDa($readmeDiPrima))->toBe(array_slice($voci[1], 0, -1));
});

it('il controllo trova una versione accettata che la CI non prova, una provata che composer.json non accetta e un giro che non installa la versione della sua voce (sprint 5 · T6.1; sprint 7 · T1.2; sprint 8 · T1.2; sprint 9 · T5.2)', function () {
    $ci = (string) file_get_contents(__DIR__.'/../../.github/workflows/ci.yml');
    $vincolo = '^0.6.6 || ^0.7 || ^0.8 || ^0.9.1 || ^0.10';
    $conLaMatrice = fn (string $voci): string => (string) preg_replace('/^(\s+zr-auth: )\[[^\]\n]*\]$/m', '$1['.$voci.']', $ci);
    $conUnGiro = $conLaMatrice("'0.7'");

    // Com'erano prima della 0.10, uno alla volta: la matrice senza il giro nuovo, il vincolo senza la versione nuova.
    $conLaMatriceDiPrima = $conLaMatrice("'0.6', '0.7', '0.8', '0.9'");
    $vincoloDiPrima = str_replace(' || ^0.10', '', $vincolo);
    // La voce nuova senza gli apici: in YAML `0.10` è il numero 0.1, e il giro proverebbe un'altra versione.
    $conLaVoceSenzaApici = $conLaMatrice("'0.6', '0.7', '0.8', '0.9', 0.10");

    // La voce della matrice che non arriva al passo: i giri installerebbero tutti la 0.7, e sarebbero verdi.
    $conLaVersioneFissa = str_replace('ZR_AUTH: ${{ matrix.zr-auth }}', "ZR_AUTH: '0.7'", $ci);
    $senzaIlVincoloDelGiro = str_replace(' --with "zeiras/zr-auth:~${ZR_AUTH}.0"', '', $ci);

    expect($conUnGiro)->not->toBe($ci)
        ->and($conLaMatriceDiPrima)->not->toBe($ci)
        ->and($conLaVoceSenzaApici)->not->toBe($ci)
        ->and($conLaVersioneFissa)->not->toBe($ci)
        ->and($senzaIlVincoloDelGiro)->not->toBe($ci)
        ->and(versioniDiZrAuthNonProvate($vincolo, $conUnGiro))->toBe(['la CI non prova zr-auth 0.6', 'la CI non prova zr-auth 0.8', 'la CI non prova zr-auth 0.9', 'la CI non prova zr-auth 0.10'])
        ->and(versioniDiZrAuthNonProvate($vincolo, $conLaMatriceDiPrima))->toBe(['la CI non prova zr-auth 0.10'])
        ->and(versioniDiZrAuthNonProvate($vincolo, $conLaVoceSenzaApici))->toBe(['la CI non prova zr-auth 0.10'])
        ->and(versioniDiZrAuthNonProvate($vincoloDiPrima, $ci))->toBe(['la CI prova zr-auth 0.10, che composer.json non accetta'])
        ->and(versioniDiZrAuthNonProvate('^0.7', $ci))->toBe(['la CI prova zr-auth 0.6, che composer.json non accetta', 'la CI prova zr-auth 0.8, che composer.json non accetta', 'la CI prova zr-auth 0.9, che composer.json non accetta', 'la CI prova zr-auth 0.10, che composer.json non accetta'])
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
    // (`rispostaDi`), come la pagina iniziale: se rispondesse i dati così come sono, le visite uscirebbero senza segno.
    $scritte = fn (array $cose): array => array_combine($cose, array_map(fn (string $cosa) => substr_count($pagina, $cosa), $cose));

    expect($importati('@inertiajs/react'))->toBe(['createInertiaApp', 'http', 'router'])
        ->and($importati('./parte-server-finta'))->toBe(['clientFinto', 'colSegno', 'lettura'])
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
        ->and($scritte(['rispostaDi(', 'props: { errors: {}, ...rispostaDi(nome) }', 'props: { errors: {}, ...rispostaDi(iniziale) }']))->toBe([
            'rispostaDi(' => 3,
            'props: { errors: {}, ...rispostaDi(nome) }' => 1,
            'props: { errors: {}, ...rispostaDi(iniziale) }' => 1,
        ])
        ->and(substr((string) $lock['packages']['node_modules/@inertiajs/react']['version'], 0, 4))->toBe('3.7.');
});

it('la parte server finta rifiuta una visita annullata con l\'errore dell\'Inertia che fa le visite: lo importa da @inertiajs/core, e nel lock ce n\'è una copia sola (sprint 10 · T3.1, review della PR)', function () {
    $parteServer = (string) file_get_contents(__DIR__.'/../../resources/demo/parte-server-finta.ts');
    $lock = json_decode((string) file_get_contents(__DIR__.'/../../package-lock.json'), true, flags: JSON_THROW_ON_ERROR);

    // Un lock con una seconda copia, sotto `@inertiajs/react`: il router riconoscerebbe l'errore della sua, non quello della
    // copia in cima, e una visita annullata sulla pagina di prova diventerebbe un errore di rete.
    $conDueCopie = $lock;
    $conDueCopie['packages']['node_modules/@inertiajs/react/node_modules/@inertiajs/core'] = ['version' => '3.7.2'];

    expect(nomiFraLeGraffe('/^import \{([^}]*)\} from \'@inertiajs\/core\';$/m', $parteServer))->toBe(['HttpCancelledError', 'HttpClient'])
        ->and(substr_count($parteServer, 'throw new HttpCancelledError('))->toBe(1)
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

it('il README dice che cos\'è aggiornati_il, che i dati si danno alla cornice così come arrivano, che alla visita dopo sulla campanella vale il numero dei dati anche quando è lo stesso, e il limite che c\'è ancora (sprint 10 · T2.5, review della PR)', function () {
    $readme = (string) file_get_contents(__DIR__.'/../../README.md');
    $cosaDice = function (string $testo): array {
        preg_match('/^\| `\{lingua, .*\}` \| la persona è entrata in un workspace \|$/m', $testo, $rigaDeiDati);

        return [
            'il segno nella riga dei dati' => str_contains($rigaDeiDati[0] ?? '', 'non_lette, aggiornati_il}`'),
            'che cos\'è il segno' => str_contains(suUnaRiga($testo), '`aggiornati_il` è il segno della lettura: l\'istante in cui la parte server ha cominciato a leggere i dati, in UTC coi microsecondi'),
            'i dati così come arrivano' => str_contains(suUnaRiga($testo), 'I dati si danno alla cornice così come arrivano, a ogni richiesta'),
            'la campanella: anche quando è lo stesso' => str_contains(suUnaRiga(puntoDellaCampanella($testo)), 'vale il loro numero, anche quando è lo stesso di prima'),
            'il difetto della v1.2.0' => str_contains(suUnaRiga($testo), 'resta ciò che c\'era'),
            'il limite: una risposta letta prima di un\'azione' => str_contains(suUnaRiga(puntoDellaCampanella($testo)), 'ogni risposta vale come dati nuovi, anche quando è stata letta prima di un\'azione e arriva dopo'),
            'il limite: Indietro e Avanti' => str_contains(suUnaRiga(puntoDellaCampanella($testo)), 'con Indietro e Avanti del browser la pagina ripresa dalla cronologia porta i dati di allora'),
        ];
    };

    // Il README col punto della campanella della v1.2.0, che dichiarava il difetto e non questo limite; e il README che non
    // nomina il segno.
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
            'il limite: una risposta letta prima di un\'azione' => true,
            'il limite: Indietro e Avanti' => true,
        ])
        ->and($cosaDice($dellaV120))->toBe([
            'il segno nella riga dei dati' => true,
            'che cos\'è il segno' => true,
            'i dati così come arrivano' => true,
            'la campanella: anche quando è lo stesso' => false,
            'il difetto della v1.2.0' => true,
            'il limite: una risposta letta prima di un\'azione' => false,
            'il limite: Indietro e Avanti' => false,
        ])
        ->and($cosaDice($senzaIlSegno))->toBe([
            'il segno nella riga dei dati' => false,
            'che cos\'è il segno' => false,
            'i dati così come arrivano' => true,
            'la campanella: anche quando è lo stesso' => true,
            'il difetto della v1.2.0' => false,
            'il limite: una risposta letta prima di un\'azione' => true,
            'il limite: Indietro e Avanti' => true,
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
