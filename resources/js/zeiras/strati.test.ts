// @vitest-environment node
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, optimize } from '@tailwindcss/node';
import { Window } from 'happy-dom';
import { beforeAll, describe, expect, it } from 'vitest';
import { ORDINE_DEGLI_STRATI, STILI_A_PARTE } from '../../../scripts/componenti-genera.mjs';

// Voce #3538 (Decisione 23101 di zr-pm-07), dalla `v5.0.0`: il CSS del design system sta in `@layer zeiras`, fra il preflight di
// Tailwind 4 (`base`) e le sue classi di utilità (`utilities`). Ogni CSS che `npm run componenti` genera comincia con la riga che
// dichiara l'ordine degli strati: senza, `zeiras` (importato prima di `tailwindcss`) starebbe sotto `base`, e il preflight
// cancellerebbe sfondo, bordo e padding dei componenti in tutti i moduli. Qui si legge la struttura dei file e si costruisce con
// Tailwind 4 (`@tailwindcss/node`, e Lightning CSS come nella build di produzione di un modulo) il CSS di un modulo, poi per
// un elemento si cerca quale dichiarazione vince, strato per strato: fra due strati decide l'ordine degli strati, non la
// specificità, ed è quello che qui si prova. La pagina vera la misura la UAT in Chromium.

// Il caso gira in node, come quello del tema (tailwind.test.ts), e prende il DOM finto solo per `matches`.
const { document } = new Window();
const delRepo = (percorso: string) => fileURLToPath(new URL(`../../../${percorso}`, import.meta.url));
const GENERATI = ['resources/css/bundle.css', 'resources/css/zeiras.css', ...STILI_A_PARTE.map((nome) => `resources/css/zeiras/${nome}.css`)];

type Dichiarazione = { proprieta: string; valore: string; importante: boolean };
type Regola = { selettore: string; dichiarazioni: Dichiarazione[]; strato: string | null; condizionata: boolean; posto: number };
type Cornice = { tipo: 'strato'; nome: string } | { tipo: 'condizione' } | { tipo: 'altro' } | { tipo: 'regola'; selettore: string; dichiarazioni: Dichiarazione[] };

/** Le regole di un CSS, ognuna col suo strato, e l'ordine degli strati come lo fissa la prima volta che il CSS ne nomina uno. */
function leggiIlCss(css: string) {
    const testo = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const ordine: string[] = [];
    const nomina = (nomi: string, dentro: string | null) => nomi.split(',').map((nome) => nome.trim()).filter(Boolean).forEach((nome) => {
        const intero = dentro === null ? nome : `${dentro}.${nome}`;
        if (!ordine.includes(intero)) ordine.push(intero);
    });
    const pila: Cornice[] = [];
    const regole: Regola[] = [];
    const diPrimoLivello: string[] = [];
    const stratoDi = () => pila.filter((cornice) => cornice.tipo === 'strato').map((cornice) => (cornice as { nome: string }).nome).join('.') || null;
    const dichiara = (pezzo: string, cornice: Cornice | undefined) => {
        const due = pezzo.indexOf(':');
        if (cornice?.tipo !== 'regola' || due === -1) return;
        const valore = pezzo.slice(due + 1).trim();
        const importante = /!\s*important$/.test(valore);
        cornice.dichiarazioni.push({ proprieta: pezzo.slice(0, due).trim(), valore: valore.replace(/\s*!\s*important$/, ''), importante });
    };
    let pezzo = '';
    let virgolette: string | null = null;
    for (const segno of testo) {
        if (virgolette !== null) {
            pezzo += segno;
            if (segno === virgolette) virgolette = null;
            continue;
        }
        if (segno === '"' || segno === "'") {
            virgolette = segno;
            pezzo += segno;
        } else if (segno === '{') {
            const inizio = pezzo.trim();
            if (pila.length === 0) diPrimoLivello.push(`${inizio} {`);
            if (pila.at(-1)?.tipo === 'regola' || pila.at(-1)?.tipo === 'altro') pila.push({ tipo: 'altro' });
            else if (inizio.startsWith('@layer')) {
                const nome = inizio.slice('@layer'.length).trim();
                nomina(nome, stratoDi());
                pila.push({ tipo: 'strato', nome });
            } else if (/^@(media|supports|container)\b/.test(inizio)) pila.push({ tipo: 'condizione' });
            else if (inizio.startsWith('@')) pila.push({ tipo: 'altro' });
            else pila.push({ tipo: 'regola', selettore: inizio, dichiarazioni: [] });
            pezzo = '';
        } else if (segno === ';') {
            const istruzione = pezzo.trim();
            if (pila.length === 0) diPrimoLivello.push(`${istruzione};`);
            if (istruzione.startsWith('@layer')) nomina(istruzione.slice('@layer'.length), stratoDi());
            else dichiara(istruzione, pila.at(-1));
            pezzo = '';
        } else if (segno === '}') {
            dichiara(pezzo.trim(), pila.at(-1));
            const chiusa = pila.pop();
            if (chiusa?.tipo === 'regola') {
                regole.push({ selettore: chiusa.selettore, dichiarazioni: chiusa.dichiarazioni, strato: stratoDi(), condizionata: pila.some((cornice) => cornice.tipo === 'condizione'), posto: regole.length });
            }
            pezzo = '';
        } else pezzo += segno;
    }

    return { regole, ordine, diPrimoLivello };
}

/** I selettori di una lista, divisi alle virgole che non stanno fra parentesi. */
function selettoriDi(lista: string) {
    const parti: string[] = [];
    let profondita = 0;
    let parte = '';
    for (const segno of lista) {
        if (segno === '(') profondita += 1;
        if (segno === ')') profondita -= 1;
        if (segno === ',' && profondita === 0) {
            parti.push(parte.trim());
            parte = '';
        } else parte += segno;
    }

    return [...parti, parte.trim()];
}

/** La specificità di un selettore, quanto basta qui: id, classi (e attributi e pseudo-classi), tipi; `:where()` non conta. */
function specificita(selettore: string): [number, number, number] {
    const senza = selettore.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, '').replace(/::[\w-]+/g, ' ');
    const id = (senza.match(/#[\w-]+/g) ?? []).length;
    const classi = (senza.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+/g) ?? []).length;
    const tipi = (senza.replace(/\[[^\]]*\]|\([^)]*\)/g, '').match(/(?:^|[\s>+~])[a-z][\w-]*/gi) ?? []).length;

    return [id, classi, tipi];
}

// Le proprietà lunghe che il caso guarda e le scorciatoie che le danno.
const SCORCIATOIE: Record<string, string[]> = {
    'padding-left': ['padding', 'padding-inline', 'padding-inline-start', 'padding-left'],
    'background-color': ['background', 'background-color'],
    'border-top-width': ['border', 'border-width', 'border-top', 'border-top-width'],
    height: ['height'],
};

/** La dichiarazione che vince per `proprieta` sull'elemento `scelto` di `html`, col suo strato (null = fuori dagli strati). */
function vince(css: ReturnType<typeof leggiIlCss>, html: string, scelto: string, proprieta: string) {
    document.body.innerHTML = html;
    const elemento = document.body.querySelector(scelto);
    if (elemento === null) throw new Error(`${scelto} non è in ${html}`);
    const nomi = SCORCIATOIE[proprieta] ?? [proprieta];
    const rango = (strato: string | null) => (strato === null ? css.ordine.length : css.ordine.indexOf(strato));
    const candidate = css.regole.filter((regola) => !regola.condizionata).flatMap((regola) => {
        const presi = selettoriDi(regola.selettore).filter((parte) => {
            if (parte.includes('::')) return false;
            try {
                return elemento.matches(parte);
            } catch {
                return false;
            }
        });
        if (presi.length === 0) return [];
        const [peso] = presi.map(specificita).sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2]);

        return regola.dichiarazioni.filter((dichiarazione) => nomi.includes(dichiarazione.proprieta)).map((dichiarazione) => ({
            ...dichiarazione, selettore: regola.selettore, strato: regola.strato, posto: regola.posto,
            // Normali: vince lo strato dopo, e fuori dagli strati più di tutti; con !important il contrario.
            chiave: [dichiarazione.importante ? 1 : 0, dichiarazione.importante ? -rango(regola.strato) : rango(regola.strato), ...peso!, regola.posto],
        }));
    });
    const [prima] = candidate.sort((a, b) => {
        for (let i = 0; i < a.chiave.length; i += 1) if (a.chiave[i] !== b.chiave[i]) return b.chiave[i]! - a.chiave[i]!;

        return 0;
    });

    return prima;
}

/** Il CSS che Tailwind 4 dà a un modulo che importa `percorso` del pacchetto, zeiras-token.css e tailwindcss e usa queste classi. */
async function costruisci(percorso: string, classi: string[]) {
    const css = `@import '${percorso}';\n@import '${delRepo('resources/css/zeiras-token.css')}';\n@import 'tailwindcss';\n`;
    const compilato = await compile(css, { base: delRepo(''), onDependency: () => undefined });
    const costruito = compilato.build(classi);

    return { costruito, ottimizzato: optimize(costruito, { minify: true }).code };
}

const PULSANTE = '<button class="zr-btn zr-btn-primary zr-btn-md">A</button>';
const PULSANTE_P0 = '<button class="zr-btn zr-btn-primary zr-btn-md p-0">A</button>';
const CAMPO = '<div class="zr-input"><input></div>';
const CAMPO_H8 = '<div class="zr-input"><input class="h-8"></div>';
const CLASSI = ['p-0', 'h-8'];
// L'altezza del campo come la dà il design system (nessuna misura scritta qui: TokenCssTest le vieta nel codice di zr-core).
const ALTEZZA_DEL_CAMPO = /^\.zr-input input, \.zr-select select \{ height: ([^;]+);/m.exec(readFileSync(delRepo('resources/zeiras/bundle.css'), 'utf8'))?.[1];

/** Che cosa non va nella forma di un CSS generato (vuoto = a posto): la riga dell'ordine in testa, poi solo gli @import e lo strato. */
function difettiDellaForma(testo: string, conGliImport: boolean) {
    const { diPrimoLivello, regole } = leggiIlCss(testo);
    const attese = conGliImport
        ? [ORDINE_DEGLI_STRATI, "@import './font.css';", "@import './movimento.css';", "@import './avanzamento.css';", '@layer zeiras {']
        : [ORDINE_DEGLI_STRATI, '@layer zeiras {'];
    const difetti: string[] = [];
    if (testo.split('\n')[0] !== ORDINE_DEGLI_STRATI) difetti.push(`la prima riga non è quella dell'ordine: «${testo.split('\n')[0]}»`);
    if (JSON.stringify(diPrimoLivello) !== JSON.stringify(attese)) difetti.push(`al primo livello: ${diPrimoLivello.join(' · ')}`);
    if (regole.length === 0) difetti.push('nessuna regola');
    regole.filter((regola) => regola.strato !== 'zeiras').forEach((regola) => difetti.push(`fuori dallo strato: ${regola.selettore}`));

    return difetti;
}

describe('il CSS del design system in @layer zeiras (voce 3538)', () => {
    it('ogni CSS generato comincia con la riga dell\'ordine degli strati, e fuori da `@layer zeiras` ci sono solo gli @import del pacchetto (AC 1, 2)', () => {
        expect(ORDINE_DEGLI_STRATI).toBe('@layer theme, base, zeiras, components, utilities;');
        for (const percorso of GENERATI) {
            expect(difettiDellaForma(readFileSync(delRepo(percorso), 'utf8'), !percorso.includes('/zeiras/')), percorso).toStrictEqual([]);
        }
    });

    it('senza la riga, con la riga dopo una regola, o con una regola fuori dallo strato, la prova del primo caso trova il difetto (AC 1, 2)', () => {
        const testo = readFileSync(delRepo('resources/css/zeiras.css'), 'utf8');
        const senza = testo.split('\n').slice(1).join('\n');
        const spostata = senza.replace('@layer zeiras {\n', `@layer zeiras {\n.zr-prima { color: red; }\n}\n${ORDINE_DEGLI_STRATI}\n@layer zeiras {\n`);
        const fuori = `${testo}.zr-fuori { color: red; }\n`;

        expect(difettiDellaForma(senza, true)[0]).toMatch(/^la prima riga non è quella dell'ordine: «\/\* Generato da /);
        expect(difettiDellaForma(spostata, true)).toHaveLength(2);
        expect(difettiDellaForma(fuori, true)).toContain('fuori dallo strato: .zr-fuori');
    });

    describe.each(['resources/css/bundle.css', 'resources/css/zeiras.css'])('in una build di Tailwind 4 con %s prima di tailwindcss (AC 3)', (percorso) => {
        let costruiti: { costruito: string; ottimizzato: string };
        beforeAll(async () => {
            costruiti = await costruisci(delRepo(percorso), CLASSI);
        });

        it.each(['costruito', 'ottimizzato'] as const)('%s: l\'ordine è theme, base, zeiras, components, utilities', (forma) => {
            expect(leggiIlCss(costruiti[forma]).ordine.slice(0, 5)).toStrictEqual(['theme', 'base', 'zeiras', 'components', 'utilities']);
        });

        it.each(['costruito', 'ottimizzato'] as const)('%s: il preflight non batte il Button, e p-0 sul Button e h-8 sul campo valgono', (forma) => {
            const css = leggiIlCss(costruiti[forma]);

            for (const proprieta of ['padding-left', 'background-color', 'border-top-width']) {
                expect(vince(css, PULSANTE, 'button', proprieta), proprieta).toMatchObject({ strato: 'zeiras', selettore: expect.stringContaining('.zr-btn') });
            }
            expect(vince(css, PULSANTE, 'button', 'background-color')?.valore).toBe('var(--pine)');
            expect(vince(css, PULSANTE_P0, 'button', 'padding-left')).toMatchObject({ strato: 'utilities', selettore: '.p-0' });
            expect(vince(css, PULSANTE_P0, 'button', 'background-color')).toMatchObject({ strato: 'zeiras' });
            expect(vince(css, CAMPO, 'input', 'height')).toMatchObject({ strato: 'zeiras', valore: ALTEZZA_DEL_CAMPO });
            expect(vince(css, CAMPO_H8, 'input', 'height')).toMatchObject({ strato: 'utilities', selettore: '.h-8' });
        });
    });

    it('senza la riga dell\'ordine lo strato zeiras andrebbe sotto base, e il preflight batterebbe il Button: è ciò che la riga evita (AC 3)', async () => {
        // Una copia di zeiras.css senza la prima riga, con gli @import del pacchetto per percorso intero.
        const cartella = mkdtempSync(join(tmpdir(), 'zr-strati-'));
        const senza = readFileSync(delRepo('resources/css/zeiras.css'), 'utf8').split('\n').slice(1).join('\n').replaceAll("@import './", `@import '${delRepo('resources/css/')}`);
        writeFileSync(join(cartella, 'zeiras.css'), senza);
        const { costruito, ottimizzato } = await costruisci(join(cartella, 'zeiras.css'), CLASSI);

        for (const forma of [costruito, ottimizzato]) {
            const css = leggiIlCss(forma);

            expect(css.ordine.indexOf('zeiras')).toBeLessThan(css.ordine.indexOf('base'));
            expect(vince(css, PULSANTE, 'button', 'background-color')).toMatchObject({ strato: 'base', valore: expect.stringMatching(/^(transparent|#0{4})$/) });
            expect(vince(css, PULSANTE, 'button', 'padding-left')).toMatchObject({ strato: 'base' });
        }
    });
});
