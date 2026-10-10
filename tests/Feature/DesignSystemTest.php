<?php

use Illuminate\Filesystem\Filesystem;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

// Sprint 1 · T1 (voce #1254), riscritto nello sprint 2 · T1 (voce #1276). Le copie derivate in resources/zeiras/ sono identiche
// all'originale del design system alla versione del registro dell'allineamento. Il registro (indirizzo dell'originale, versione, una
// riga per file) sta fuori dal repo pubblico, in prompts/ che git ignora; qui resta tests/zeiras.sha256, l'elenco degli sha256 delle
// copie nella forma di sha256sum (`sha256sum -c tests/zeiras.sha256` dalla radice), coi valori del registro.
// Sprint 15 · T2 (voce #1585): fra le copie ci sono i cinque file del logo, nella sottocartella logos/.

/**
 * Le copie del design system che non tornano con l'elenco degli sha256: una copia che l'elenco non nomina (anche nascosta, anche in
 * una sottocartella), che nomina in più righe, o il cui sha256 non è quello dell'elenco; una riga dell'elenco senza la sua copia, o
 * che non è nella forma di sha256sum. Il controllo parte dalla cartella, non dall'elenco: un file in più non passa.
 *
 * @return list<string>
 */
function copieNonAllineate(string $elenco, string $cartella): array
{
    $problemi = [];
    $righe = [];
    foreach (preg_split('/\R/', trim($elenco)) ?: [] as $riga) {
        if (preg_match('/^([0-9a-f]{64})  (resources\/zeiras\/\S+)$/', $riga, $parti) === 1) {
            $righe[] = ['sha256' => $parti[1], 'nome' => $parti[2]];
        } else {
            $problemi[] = "riga «{$riga}» dell'elenco: non è «<sha256>  resources/zeiras/<file>»";
        }
    }

    $nomi = [];
    foreach (File::allFiles($cartella, true) as $copia) {
        $nome = 'resources/zeiras/'.str_replace(DIRECTORY_SEPARATOR, '/', $copia->getRelativePathname());
        $nomi[] = $nome;
        $sue = array_values(array_filter($righe, fn (array $riga) => $riga['nome'] === $nome));
        if ($sue === []) {
            $problemi[] = "$nome: l'elenco non la nomina";
        } elseif (count($sue) > 1) {
            $problemi[] = "$nome: l'elenco la nomina in ".count($sue).' righe';
        } elseif (hash_file('sha256', $copia->getPathname()) !== $sue[0]['sha256']) {
            $problemi[] = "$nome: lo sha256 non è quello dell'elenco";
        }
    }
    foreach (array_unique(array_column($righe, 'nome')) as $nome) {
        if (! in_array($nome, $nomi, true)) {
            $problemi[] = "$nome: l'elenco la nomina, ma la copia non c'è";
        }
    }

    return $problemi;
}

it('ogni copia in resources/zeiras/ ha lo sha256 di tests/zeiras.sha256, e ogni riga dell\'elenco ha la sua copia: bundle, tipi e token, e in logos/ i cinque file del logo (T1.2; sprint 15 · T2.1)', function () {
    $copie = collect(File::allFiles(__DIR__.'/../../resources/zeiras', true))->map->getRelativePathname()->sort()->values()->all();

    expect($copie)->toBe([
        'bundle.css',
        'bundle.js',
        'index.d.ts',
        'logos/zeiras-favicon.svg',
        'logos/zeiras-logo-dark.svg',
        'logos/zeiras-logo.svg',
        'logos/zeiras-mark-dark.svg',
        'logos/zeiras-mark.svg',
        'tokens.json',
    ])->and(copieNonAllineate(File::get(__DIR__.'/../zeiras.sha256'), __DIR__.'/../../resources/zeiras'))->toBe([]);
});

it('il controllo trova la copia cambiata di un byte, quella che l\'elenco non nomina (anche nascosta o in una sottocartella), quella nominata due volte e la riga senza la sua copia; e in logos/, che l\'elenco nomina, il file cambiato di un byte e quello che manca (T1.2; sprint 15 · T2.1)', function () {
    $copie = __DIR__.'/../../resources/zeiras';
    $cartella = sys_get_temp_dir().'/zr-core-copie-'.Str::random(12);
    File::ensureDirectoryExists("$cartella/vecchia");
    register_shutdown_function(fn () => (new Filesystem)->deleteDirectory($cartella));
    File::copy("$copie/tokens.json", "$cartella/tokens.json");
    File::copy("$copie/index.d.ts", "$cartella/index.d.ts");
    File::put("$cartella/bundle.css", File::get("$copie/bundle.css").' ');
    File::put("$cartella/bundle.json", '{}');
    File::put("$cartella/.bundle.js", '');
    File::copy("$copie/bundle.js", "$cartella/vecchia/bundle.js");
    // I file del logo: tre come sono, uno con un byte in più, uno che manca.
    File::copyDirectory("$copie/logos", "$cartella/logos");
    File::put("$cartella/logos/zeiras-mark.svg", File::get("$copie/logos/zeiras-mark.svg").' ');
    File::delete("$cartella/logos/zeiras-logo-dark.svg");
    $elenco = File::get(__DIR__.'/../zeiras.sha256');

    expect(copieNonAllineate($elenco, $cartella))->toEqualCanonicalizing([
        'resources/zeiras/bundle.css: lo sha256 non è quello dell\'elenco',
        'resources/zeiras/bundle.json: l\'elenco non la nomina',
        'resources/zeiras/.bundle.js: l\'elenco non la nomina',
        'resources/zeiras/vecchia/bundle.js: l\'elenco non la nomina',
        'resources/zeiras/bundle.js: l\'elenco la nomina, ma la copia non c\'è',
        'resources/zeiras/logos/zeiras-mark.svg: lo sha256 non è quello dell\'elenco',
        'resources/zeiras/logos/zeiras-logo-dark.svg: l\'elenco la nomina, ma la copia non c\'è',
    ])->and(copieNonAllineate($elenco.hash_file('sha256', "$copie/tokens.json")."  resources/zeiras/tokens.json\n", $cartella))
        ->toContain('resources/zeiras/tokens.json: l\'elenco la nomina in 2 righe')
        ->and(copieNonAllineate($elenco.'bc6b  resources/zeiras/tokens.json', $cartella))
        ->toContain('riga «bc6b  resources/zeiras/tokens.json» dell\'elenco: non è «<sha256>  resources/zeiras/<file>»');
});
