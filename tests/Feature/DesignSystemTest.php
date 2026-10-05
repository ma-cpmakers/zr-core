<?php

use Illuminate\Filesystem\Filesystem;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

// Sprint 1 · T1 (voce #1254). Il primo allineamento al design system di Zeiras: le copie derivate in resources/zeiras/ sono
// identiche all'originale alla versione di docs/zr-design-system.md, e il registro elenca ogni file dell'originale da cui
// dipende il codice del pacchetto. Il precedente è il DesignSystemTest di zr-home.

/**
 * Le copie del design system che non tornano con il registro dell'allineamento: una copia che la tabella non elenca (anche
 * nascosta, anche in una sottocartella), che nomina in più righe, o il cui sha256 non è quello della tabella.
 *
 * @return list<string>
 */
function copieNonAllineate(string $registro, string $cartella): array
{
    preg_match_all('/^\| *(project\/\S+) *\| *([0-9a-f]{64}) *\| *(.+?) *\|$/m', $registro, $righe, PREG_SET_ORDER);

    $problemi = [];
    foreach (File::allFiles($cartella, true) as $copia) {
        $nome = 'resources/zeiras/'.str_replace(DIRECTORY_SEPARATOR, '/', $copia->getRelativePathname());
        $sue = array_values(array_filter($righe, fn (array $riga) => preg_match('/'.preg_quote($nome, '/').'(?![\w.\/])/', $riga[3]) === 1));
        if ($sue === []) {
            $problemi[] = "$nome: la tabella non la elenca";
        } elseif (count($sue) > 1) {
            $problemi[] = "$nome: la tabella la nomina in ".count($sue).' righe';
        } elseif (hash_file('sha256', $copia->getPathname()) !== $sue[0][2]) {
            $problemi[] = "$nome: lo sha256 non è quello di {$sue[0][1]}";
        }
    }

    return $problemi;
}

it('le copie sono identiche all\'originale alla versione del registro: lo sha256 di ogni copia è quello della tabella (T1.1)', function () {
    $registro = File::get(__DIR__.'/../../docs/zr-design-system.md');
    $copie = collect(File::allFiles(__DIR__.'/../../resources/zeiras', true))->map->getRelativePathname()->sort()->values()->all();

    expect($registro)->toMatch('/^Originale: https:\/\/claude\.ai\/artifact\/66qq9W68zshzZfgSZ79eZS$/m')
        ->toMatch('/^Versione: \S+ · letta il \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/m')
        ->and($copie)->toBe(['bundle.css', 'bundle.js', 'index.d.ts', 'tokens.json'])
        ->and(copieNonAllineate($registro, __DIR__.'/../../resources/zeiras'))->toBe([]);
});

it('il controllo trova la copia cambiata di un byte e quella che la tabella non elenca, anche nascosta o in una sottocartella (T1.1)', function () {
    $cartella = sys_get_temp_dir().'/zr-core-copie-'.Str::random(12);
    File::ensureDirectoryExists("$cartella/vecchia");
    register_shutdown_function(fn () => (new Filesystem)->deleteDirectory($cartella));
    File::copy(__DIR__.'/../../resources/zeiras/tokens.json', "$cartella/tokens.json");
    File::put("$cartella/bundle.css", File::get(__DIR__.'/../../resources/zeiras/bundle.css').' ');
    File::put("$cartella/bundle.json", '{}');
    File::put("$cartella/.bundle.js", '');
    File::copy(__DIR__.'/../../resources/zeiras/bundle.js', "$cartella/vecchia/bundle.js");

    expect(copieNonAllineate(File::get(__DIR__.'/../../docs/zr-design-system.md'), $cartella))->toEqualCanonicalizing([
        'resources/zeiras/bundle.css: lo sha256 non è quello di project/components/bundle.css',
        'resources/zeiras/bundle.json: la tabella non la elenca',
        'resources/zeiras/.bundle.js: la tabella non la elenca',
        'resources/zeiras/vecchia/bundle.js: la tabella non la elenca',
    ])->and(copieNonAllineate("| project/tokens.json | 40fcba1243bb81ddda47b6137e4cac9ef3b85fd6aca0eec6b7bc216e8dcbc71e | resources/zeiras/tokens.json |\n"
        .'| project/README.md | c73f7d8542035b62df2d13a7bd2c511f2f94fd497adb92b8ee4086faeafe40b7 | i valori di resources/zeiras/tokens.json |', $cartella))
        ->toContain('resources/zeiras/tokens.json: la tabella la nomina in 2 righe');
});

it('il registro ha una riga per ogni file dell\'originale da cui dipende il codice: le quattro copie e i sei che il codice segue (T1.2)', function () {
    preg_match_all('/^\| *(project\/\S+) *\| *[0-9a-f]{64} *\| *.+? *\|$/m', File::get(__DIR__.'/../../docs/zr-design-system.md'), $righe);

    expect($righe[1])->toContain(
        'project/components/bundle.js',
        'project/components/bundle.css',
        'project/components/index.d.ts',
        'project/tokens.json',
        'project/README.md',
        'project/guidelines/15-processo-di-navigazione.md',
        'project/guidelines/10-struttura-portale.md',
        'project/components/AppShell/README.md',
        'project/components/AppShell/preview.html',
        'project/assets/Icons/README.md',
    )->and($righe[1])->toBe(array_values(array_unique($righe[1])));
});
