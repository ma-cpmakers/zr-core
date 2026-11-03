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

if (!existsSync(join(cartella, 'index.html'))) {
    console.error('manca dist/demo: prima `npm run demo`');
    process.exit(1);
}

const tipi = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon' };

createServer((richiesta, risposta) => {
    let percorso;
    try {
        percorso = decodeURIComponent(new URL(richiesta.url, 'http://localhost').pathname);
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
    createReadStream(file).on('error', () => risposta.destroy()).pipe(risposta);
}).listen(porta, '127.0.0.1', () => console.log(`dist/demo su http://127.0.0.1:${porta}/ · CSP: ${csp ?? 'nessuna'}`));
