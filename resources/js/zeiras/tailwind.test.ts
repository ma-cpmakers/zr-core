// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compile } from '@tailwindcss/node';
import { describe, expect, it } from 'vitest';
import { cssPerTailwind, temaDeiToken } from '../../../scripts/token-genera.mjs';

// Voce #3536 (Decisione 23090 di zr-pm-07). Il tema di Tailwind 4 coi nomi dei token esce da `npm run token`, da tokens.json, in
// resources/css/zeiras-tailwind.css: un modulo lo importa dopo `tailwindcss` invece del suo blocco `@theme` scritto a mano. Qui
// si prova il generatore, i nomi che i moduli usano già, e una build vera di Tailwind 4 (`@tailwindcss/node`).

const delRepo = (percorso: string) => fileURLToPath(new URL(`../../../${percorso}`, import.meta.url));
const token = JSON.parse(readFileSync(delRepo('resources/zeiras/tokens.json'), 'utf8'));
const file = readFileSync(delRepo('resources/css/zeiras-tailwind.css'), 'utf8');
const tema = new Map(temaDeiToken(token));

/** Il CSS che Tailwind 4 dà a un modulo che importa tailwindcss (e, con `conIlTema`, il file del pacchetto) e usa queste classi. */
async function costruisci(classi: string[], conIlTema = true) {
    const css = `@import 'tailwindcss';\n${conIlTema ? `@import '${delRepo('resources/css/zeiras-tailwind.css')}';\n` : ''}`;
    const compilato = await compile(css, { base: delRepo(''), onDependency: () => undefined });

    return compilato.build(classi);
}

describe('il tema di Tailwind 4 coi nomi dei token (voce 3536)', () => {
    it('il file è quello che tokens.json genera, ed è `@theme inline reference` (AC 2, 4)', () => {
        expect(file).toBe(cssPerTailwind(token));
        expect(file).toMatch(/^@theme inline reference \{$/m);
    });

    it('ogni colore, famiglia, raggio, ombra e stile di testo di tokens.json ha la sua variabile del tema, che rende var(--token) (AC 1)', () => {
        const attese = [
            ...token.color.tokens.map(({ name }: { name: string }) => [`--color-${name}`, `var(--${name})`]),
            ...Object.keys(token.type.families).map((famiglia) => [`--font-${famiglia}`, `var(--font-${famiglia})`]),
            ...token.radius.tokens.map(({ name }: { name: string }) => [`--${name}`, `var(--${name})`]),
            ...token.shadow.tokens.map(({ name }: { name: string }) => [`--${name}`, `var(--${name})`]),
        ];
        for (const [nome, valore] of attese) {
            expect(tema.get(nome), nome).toBe(valore);
            expect(file).toContain(`    ${nome}: ${valore};\n`);
        }
        expect([...tema.values()].every((valore) => /^var\(--[a-z0-9-]+\)$/.test(valore))).toBe(true);
        expect(tema.get('--text-heading-1--letter-spacing')).toBe('var(--text-heading-1--letter-spacing)');
    });

    it('un token nuovo di tokens.json entra da sé (AC 2)', () => {
        const conUnoInPiu = structuredClone(token);
        conUnoInPiu.color.tokens.push({ name: 'mint', value: { light: '#000000' } });
        conUnoInPiu.radius.tokens.push({ name: 'radius-xl', value: '20px' });

        expect(cssPerTailwind(conUnoInPiu)).toContain('    --color-mint: var(--mint);\n');
        expect(cssPerTailwind(conUnoInPiu)).toContain('    --radius-xl: var(--radius-xl);\n');
    });

    it('i nomi che board, crm e cashflow usano oggi nel loro @theme ci sono tutti (AC 3)', () => {
        // Tutti i nomi dei blocchi `@theme` di board, crm e cashflow, letti l'08/11/2026 (revisione della voce, R2): colori, famiglie,
        // raggi, ombre e stili di testo. Gli alias propri (`--spacing-space-*`, `--z-index-*`) restano nel loro app.css.
        const usati = [
            '--color-citrus', '--color-citrus-ink', '--color-citrus-soft', '--color-coral', '--color-coral-soft',
            '--color-danger', '--color-danger-soft', '--color-focus', '--color-ink', '--color-ink-muted', '--color-line',
            '--color-line-strong', '--color-on-citrus', '--color-on-coral', '--color-on-pine', '--color-pine',
            '--color-pine-hover', '--color-pine-soft', '--color-plum', '--color-plum-soft', '--color-scrim', '--color-sky',
            '--color-sky-soft', '--color-surface', '--color-surface-raised', '--color-surface-sunken', '--color-warning',
            '--color-warning-soft', '--font-display', '--font-sans', '--radius-2xs', '--radius-lg', '--radius-md',
            '--radius-md-lg', '--radius-sm', '--radius-sm-md', '--radius-xs', '--shadow-card', '--shadow-lift',
            '--shadow-overlay', '--text-body', '--text-body--font-weight', '--text-body--line-height', '--text-body-sm',
            '--text-body-sm--font-weight', '--text-body-sm--line-height', '--text-caption', '--text-caption--font-weight',
            '--text-caption--line-height', '--text-display', '--text-display--font-weight', '--text-display--letter-spacing',
            '--text-display--line-height', '--text-display-xl', '--text-display-xl--font-weight',
            '--text-display-xl--letter-spacing', '--text-display-xl--line-height', '--text-heading-1',
            '--text-heading-1--font-weight', '--text-heading-1--letter-spacing', '--text-heading-1--line-height',
            '--text-heading-2', '--text-heading-2--font-weight', '--text-heading-2--line-height', '--text-heading-3',
            '--text-heading-3--font-weight', '--text-heading-3--line-height', '--text-label', '--text-label--font-weight',
            '--text-label--line-height', '--text-overline', '--text-overline--font-weight', '--text-overline--letter-spacing',
            '--text-overline--line-height',
        ];

        expect(usati.filter((nome) => !tema.has(nome))).toStrictEqual([]);
    });

    it('in una build di Tailwind 4 una classe per gruppo rende la variabile del token, e senza classi il file non aggiunge niente (AC 1, 4, 6)', async () => {
        const classi = ['bg-surface-raised', 'text-ink-muted', 'border-line-strong', 'font-display', 'rounded-md', 'shadow-card', 'text-heading-1'];
        const css = await costruisci(classi);

        expect(css).toMatch(/\.bg-surface-raised \{\s*background-color: var\(--surface-raised\);/);
        expect(css).toMatch(/\.text-ink-muted \{\s*color: var\(--ink-muted\);/);
        expect(css).toMatch(/\.border-line-strong \{\s*border-color: var\(--line-strong\);/);
        expect(css).toMatch(/\.font-display \{\s*font-family: var\(--font-display\);/);
        expect(css).toMatch(/\.rounded-md \{\s*border-radius: var\(--radius-md\);/);
        expect(css).toMatch(/\.shadow-card \{[^}]*var\(--shadow-card\)/);
        expect(css).toMatch(/\.text-heading-1 \{\s*font-size: var\(--text-heading-1\);/);
        // `reference`: il tema non scrive le sue variabili nella pagina.
        expect(css).not.toMatch(/--color-surface-raised:/);
        // Senza classi il file non aggiunge righe alla build: ne toglie solo una, la famiglia `--font-sans` di serie di Tailwind
        // nel suo strato `theme`, perché il tema dà la sua.
        const senzaClassi = (await costruisci([])).split('\n');
        const senzaIlTema = (await costruisci([], false)).split('\n');
        expect(senzaClassi.filter((riga) => !senzaIlTema.includes(riga))).toStrictEqual([]);
        expect(senzaIlTema.filter((riga) => !senzaClassi.includes(riga))[0]).toMatch(/^\s*--font-sans: /);
    });
});
