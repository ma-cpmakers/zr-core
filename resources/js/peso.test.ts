// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import react from '@vitejs/plugin-react';
import { build } from 'vite';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// Sprint 25 · T2 (voce #1759). L'ingresso per le app, `resources/js/app.ts`: la cornice senza `Zeiras`, cioè senza i componenti
// del design system che l'app non usa. Qui si costruiscono le tre app di prova di resources/demo/peso come le costruisce un
// frontend — minificate, React fuori — e i due ingressi come li costruisce `npm run build`, e si guarda il JS che esce: il suo
// testo e il suo peso con gzip. Il caso gira in node: costruisce con Vite, e un DOM non gli serve. I pesi che il README dice
// sono quelli misurati qui.

const FUORI = ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'];

// Un testo per ognuno di tre componenti che la cornice non usa: una domanda della pagina pubblica (`FAQ`), il logo del sito
// (`SiteHeader`), l'intestazione di una colonna (`KanbanColumn`). Poi la tabella (`DataTable`), che entra solo in un'app che la
// usa, e l'`AppShell`, che è la cornice.
const DI_ALTRI = ['Zeiras è davvero gratis?', 'zr-site-logo', 'zr-col-head'];
const DELLA_TABELLA = 'zr-table';
const DEL_PULSANTE = 'zr-btn';
const DELLA_CORNICE = 'zr-shell';

// `dist/zr-core.js` sul tag v1.14.0, dove la cornice caricava il bundle del design system: 152.611 byte, 41.056 con gzip al
// livello 9 (zlib di node, come qui; `gzip -9` da riga di comando ne dà 40.835).
const GZIP_DELLA_V1_14_0 = 41_056;
const MEZZO_KB = 512;

interface Costruito {
    js: string;
    esporta: string[];
}

const delRepo = (percorso: string) => fileURLToPath(new URL(`../../${percorso}`, import.meta.url));
const gzip = (js: string) => gzipSync(js, { level: 9 }).length;
const volte = (testo: string, parte: string) => testo.split(parte).length - 1;
const inKb = (byte: number) => byte / 1024;
const scritture = (js: string, globale: string) => [...js.matchAll(new RegExp(`window\\.${globale}\\s*=(?!=)`, 'g'))].length;

function costruito(esito: Awaited<ReturnType<typeof build>>): Costruito {
    const pezzi = (Array.isArray(esito) ? esito : [esito]).flatMap((uscita) => ('output' in uscita ? uscita.output : [])).filter((pezzo) => pezzo.type === 'chunk');

    return { js: pezzi.map((pezzo) => pezzo.code).join('\n'), esporta: pezzi.flatMap((pezzo) => (pezzo.isEntry ? pezzo.exports : [])).sort() };
}

/** Un'app di prova, costruita come la costruisce un frontend: minificata, con React fuori. */
async function app(file: string): Promise<Costruito> {
    return costruito(await build({ configFile: false, root: delRepo(''), logLevel: 'silent', plugins: [react()], build: { write: false, minify: true, rolldownOptions: { input: delRepo(file), external: FUORI } } }));
}

/** Un ingresso del pacchetto, costruito come lo costruisce `npm run build` (vite.config.ts). */
async function ingresso(file: string): Promise<Costruito> {
    return costruito(await build({ configFile: delRepo('vite.config.ts'), root: delRepo(''), logLevel: 'silent', build: { write: false, lib: { entry: delRepo(file) } } }));
}

/** I nomi fra le graffe degli `export { … } from` di un ingresso, coi `type` davanti dove ci sono. */
function nomiNelTesto(file: string): string[] {
    return [...readFileSync(delRepo(file), 'utf8').matchAll(/^export \{([^}]*)\} from '[^']+';$/gm)]
        .flatMap((riga) => (riga[1] ?? '').split(','))
        .map((nome) => nome.trim())
        .filter((nome) => nome !== '')
        .sort();
}

/** La riga della tabella dei pesi del README che comincia con quel nome: i due numeri, in KB, senza e con gzip. */
function pesiNelReadme(nome: string): number[] {
    const riga = readFileSync(delRepo('README.md'), 'utf8').split('\n').find((questa) => questa.startsWith(`| ${nome} |`)) ?? '';

    return [...riga.matchAll(/\| (\d+(?:,\d)?) KB/g)].map((trovato) => Number((trovato[1] ?? '').replace(',', '.')));
}

let soloCornice: Costruito;
let perNome: Costruito;
let diSempre: Costruito;
let ingressoPerLeApp: Costruito;
let ingressoDiSempre: Costruito;

// vitest gira con NODE_ENV=test, e così il plugin di React renderebbe il JSX come in sviluppo, più pesante: qui si costruisce
// come fa `vite build`, in produzione.
beforeAll(async () => {
    vi.stubEnv('NODE_ENV', 'production');
    soloCornice = await app('resources/demo/peso/cornice.ts');
    perNome = await app('resources/demo/peso/per-nome.ts');
    diSempre = await app('resources/demo/peso/oggi.ts');
    ingressoPerLeApp = await ingresso('resources/js/app.ts');
    ingressoDiSempre = await ingresso('resources/js/index.ts');
    vi.unstubAllEnvs();
}, 120_000);

describe('un\'app che prende solo la cornice dall\'ingresso per le app non porta i componenti che la cornice non usa (T2.1)', () => {
    it.each(DI_ALTRI)('«%s» non c\'è; nella stessa app dall\'ingresso di sempre sì', (testo) => {
        expect(soloCornice.js).not.toContain(testo);
        expect(diSempre.js).toContain(testo);
    });

    it('c\'è l\'AppShell', () => {
        expect(soloCornice.js).toContain(DELLA_CORNICE);
    });

    it('pesa, con gzip, al più il 60% della stessa app dall\'ingresso di sempre', () => {
        expect(gzip(soloCornice.js)).toBeLessThanOrEqual(0.6 * gzip(diSempre.js));
    });
});

describe('un\'app che usa anche due componenti per nome porta quelli e non gli altri (T2.2)', () => {
    it('la tabella e il pulsante ci sono; senza usarla, la tabella non c\'è', () => {
        expect(perNome.js).toContain(DELLA_TABELLA);
        expect(perNome.js).toContain(DEL_PULSANTE);
        expect(soloCornice.js).not.toContain(DELLA_TABELLA);
    });

    it.each(DI_ALTRI)('«%s» non c\'è', (testo) => {
        expect(perNome.js).not.toContain(testo);
    });

    it('pesa più della sola cornice e, con gzip, al più il 70% della stessa app dall\'ingresso di sempre', () => {
        expect(gzip(perNome.js)).toBeGreaterThan(gzip(soloCornice.js));
        expect(gzip(perNome.js)).toBeLessThanOrEqual(0.7 * gzip(diSempre.js));
    });
});

describe('l\'ingresso per le app esporta gli stessi nomi dell\'ingresso di sempre, tranne Zeiras (T2.4)', () => {
    it('nel build: né un nome di meno né uno di più', () => {
        expect(ingressoDiSempre.esporta).toContain('Zeiras');
        expect(ingressoPerLeApp.esporta).toEqual(ingressoDiSempre.esporta.filter((nome) => nome !== 'Zeiras'));
    });

    it('nel testo dei due file: gli stessi nomi, tipi compresi', () => {
        expect(nomiNelTesto('resources/js/index.ts')).toContain('Zeiras');
        expect(nomiNelTesto('resources/js/app.ts')).toEqual(nomiNelTesto('resources/js/index.ts').filter((nome) => nome !== 'Zeiras'));
    });

    it.each(['Zeiras', 'React'])('non scrive window.%s, nemmeno in un\'app: l\'ingresso di sempre sì, una volta', (globale) => {
        expect(scritture(ingressoPerLeApp.js, globale)).toBe(0);
        expect(scritture(soloCornice.js, globale)).toBe(0);
        expect(scritture(ingressoDiSempre.js, globale)).toBe(1);
        expect(scritture(diSempre.js, globale)).toBe(1);
    });
});

describe('chi installa come oggi non paga niente in più (T1.4)', () => {
    it('nel build dell\'ingresso di sempre il testo di un componente sta una volta sola', () => {
        expect(volte(ingressoDiSempre.js, 'Zeiras è davvero gratis?')).toBe(1);
    });

    it('e il JS non pesa, con gzip, più di 0,5 KB in più che sul tag v1.14.0', () => {
        expect(gzip(ingressoDiSempre.js)).toBeLessThanOrEqual(GZIP_DELLA_V1_14_0 + MEZZO_KB);
    });
});

describe('i pesi che il README dice sono quelli misurati qui, e la sua ricetta dice il vero (T2.5)', () => {
    it('la ricetta del README per sapere se il passaggio è completo risponde 0 dall\'ingresso per le app e 1 dall\'ingresso di sempre', () => {
        const scritta = /grep -rhoE --include='\*\.js' '([^']+)' public\/build/.exec(readFileSync(delRepo('README.md'), 'utf8'));
        const ricetta = new RegExp(scritta?.[1] ?? 'la ricetta non c\'è', 'g');

        expect([...soloCornice.js.matchAll(ricetta)]).toHaveLength(0);
        expect([...perNome.js.matchAll(ricetta)]).toHaveLength(0);
        expect([...diSempre.js.matchAll(ricetta)]).toHaveLength(1);
    });

    it.each([
        ['solo la cornice, dall\'ingresso per le app', () => soloCornice],
        ['la cornice e due componenti per nome', () => perNome],
        ['la stessa cornice, dall\'ingresso di sempre', () => diSempre],
    ])('«%s»: i due numeri della sua riga, in KB, senza e con gzip', (nome, misurato) => {
        const [intero, compresso] = pesiNelReadme(nome);

        expect(intero).toBeCloseTo(inKb(Buffer.byteLength(misurato().js)), 0);
        expect(compresso).toBeCloseTo(inKb(gzip(misurato().js)), 0);
    });
});
