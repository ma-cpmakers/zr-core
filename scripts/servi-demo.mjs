#!/usr/bin/env node
/**
 * Le pagine di prova (`dist/demo`, da `npm run demo`) servite in locale come le serve un modulo: con le intestazioni di
 * sicurezza che zr-core scrive. Prima di un tag `uat-cornice.mjs` gira su queste, e la riga R.C guarda che la CSP di tutti
 * non fermi niente della cornice (dalla `v4.0.0`, #2946: senza Google Fonts).
 *
 *   node scripts/servi-demo.mjs [--porta 4173] [--csp "<politica>"] [--senza-csp]
 *
 * La CSP è la costante `IntestazioniSicurezza::CSP`, letta dal sorgente PHP del repo (`--csp` la sostituisce, per provare
 * la riga nei due versi; `--senza-csp` non la manda).
 *
 * Dalla `v4.4.0` una pagina chiesta con `?lingua=<lingua>` arriva come la manda un modulo con la riga
 * `{{ \Zeiras\Core\Cornice::precaricoDellaLingua() }}` nel Blade: `<html lang>` è quella lingua, e prima del JS d'ingresso ci
 * c'è il precarico del file della sua lingua, o dell'inglese per una lingua che zr-core non ha (fino alla `v4.29.0` anche
 * quello dell'inglese accanto all'altra lingua), preso dal manifest della build con la stessa regola (in italiano nessuno). Con `&precarico=0` la pagina ha la lingua e non i precarichi: è il modulo senza la riga.
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const argomenti = process.argv.slice(2);
const opzione = (nome, altrimenti) => {
    const indice = argomenti.indexOf(nome);
    return indice >= 0 && argomenti[indice + 1] !== undefined ? argomenti[indice + 1] : altrimenti;
};

const radice = fileURLToPath(new URL('..', import.meta.url));
const cartella = join(radice, 'dist/demo');
const porta = Number(opzione('--porta', '4173'));
const csp = argomenti.includes('--senza-csp')
    ? null
    : opzione('--csp', null) ?? readFileSync(join(radice, 'src/Http/IntestazioniSicurezza.php'), 'utf8').match(/public const CSP = "([^"]+)";/)?.[1];

if (csp === undefined) {
    console.error('la costante CSP non si legge da src/Http/IntestazioniSicurezza.php');
    process.exit(1);
}

const manifest = existsSync(join(cartella, '.vite/manifest.json')) ? JSON.parse(readFileSync(join(cartella, '.vite/manifest.json'), 'utf8')) : {};
const FORMA_DI_UNA_LINGUA = /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{1,8})*$/;

/** La pagina com'è nel modulo per chi parla `lingua`: la regola di `Cornice::precaricoDellaLingua()`, coi file di `resources/lingue`. */
function nellaLingua(pagina, lingua, conIlPrecarico) {
    const codice = lingua.toLowerCase().replace(/_/g, '-');
    const sua = [codice, codice.split('-')[0]].find((scelto) => ['it', 'en', 'es'].includes(scelto));
    const precarichi = !conIlPrecarico || sua === 'it' ? [] : [sua ?? 'en']
        .map((scelto) => manifest[`../lingue/${scelto}.json`]?.file)
        .filter(Boolean)
        .map((file) => `<link rel="preload" as="fetch" href="./${file}" crossorigin>`);

    return pagina.replace(/<html lang="[^"]*">/, `<html lang="${lingua}">`).replace(/(\s*)<script type="module"/, `${precarichi.map((riga) => `$1${riga}`).join('')}$1<script type="module"`);
}

if (!existsSync(join(cartella, 'index.html'))) {
    console.error('manca dist/demo: prima `npm run demo`');
    process.exit(1);
}

const tipi = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon' };

createServer((richiesta, risposta) => {
    let percorso;
    let domanda;
    try {
        ({ pathname: percorso, searchParams: domanda } = new URL(richiesta.url, 'http://localhost'));
        percorso = decodeURIComponent(percorso);
    } catch {
        risposta.writeHead(400).end();
        return;
    }
    let file = normalize(join(cartella, percorso));
    if (file !== cartella && !file.startsWith(cartella + sep)) {
        risposta.writeHead(403).end();
        return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) {
        file = join(file, 'index.html');
    }
    if (!existsSync(file)) {
        risposta.writeHead(404).end();
        return;
    }
    risposta.writeHead(200, { 'Content-Type': tipi[extname(file)] ?? 'application/octet-stream', ...(csp ? { 'Content-Security-Policy': csp } : {}) });
    const lingua = domanda.get('lingua');
    if (extname(file) === '.html' && lingua && FORMA_DI_UNA_LINGUA.test(lingua)) {
        risposta.end(nellaLingua(readFileSync(file, 'utf8'), lingua, domanda.get('precarico') !== '0'));
        return;
    }
    createReadStream(file).on('error', () => risposta.destroy()).pipe(risposta);
}).listen(porta, '127.0.0.1', () => console.log(`dist/demo su http://127.0.0.1:${porta}/ · CSP: ${csp ?? 'nessuna'}`));
