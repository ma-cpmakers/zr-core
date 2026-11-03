import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as dallIngresso from './index';
import * as dallIngressoDelleApp from './app';
import { ToastDellaCornice, type ToastDellaCorniceProps } from './toast';
import type { Toast } from '../zeiras/index';

// Sprint 94 (voce #2910, Decisioni 19935 e 19940 di zr-pm-07): il `Toast` del design system già messo al suo posto, in basso
// al centro su tutte le larghezze, sopra dialoghi, pannelli e cassetto. Il modulo non lo riposiziona col suo CSS.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let pagina: HTMLDivElement;
let radice: Root;

beforeEach(() => {
    // La pagina sta dentro un pannello che scorre: un antenato con `transform` sposterebbe un `position: fixed` reso lì dentro.
    pagina = document.createElement('div');
    pagina.style.transform = 'translateX(0)';
    document.body.append(pagina);
    radice = createRoot(pagina);
});

afterEach(() => {
    act(() => radice.unmount());
    pagina.remove();
});

const mostra = (props: ToastDellaCorniceProps): HTMLElement => {
    act(() => radice.render(<ToastDellaCornice {...props} />));

    return document.querySelector<HTMLElement>('.zr-toast')!;
};

describe('il Toast della cornice si mette da sé in basso al centro (sprint 94 · T1.1)', () => {
    it('lo stile del contenitore, coi soli token: fisso, al centro, a --space-5 dal fondo più il bordo sicuro, a --z-toast', () => {
        const stile = mostra({ children: 'Fatto' }).parentElement!.getAttribute('style') ?? '';

        expect(stile).toContain('position: fixed');
        expect(stile).toContain('left: 50%');
        expect(stile).toContain('transform: translateX(-50%)');
        expect(stile).toContain('bottom: calc(var(--space-5) + env(safe-area-inset-bottom, 0px))');
        expect(stile).toContain('z-index: var(--z-toast)');
        expect(stile).toContain('max-width: calc(100vw - 2 * var(--space-4))');
    });

    it('nessun valore scritto a mano al posto di un token', () => {
        const stile = mostra({ children: 'Fatto' }).parentElement!.getAttribute('style') ?? '';

        expect(stile).not.toMatch(/\b(24|16|32)px\b/);
        expect(stile).not.toMatch(/z-index:\s*\d/);
    });
});

describe('è reso nel body, fuori dalla pagina (T1.2)', () => {
    it('il contenitore è figlio del body, non della pagina che lo rende', () => {
        const contenitore = mostra({ children: 'Fatto' }).parentElement!;

        expect(contenitore.parentElement).toBe(document.body);
        expect(pagina.contains(contenitore)).toBe(false);
    });

    it('smontato, nel body non resta niente', () => {
        mostra({ children: 'Fatto' });
        act(() => radice.render(<></>));

        expect(document.querySelector('.zr-toast')).toBeNull();
        expect([...document.body.children]).toEqual([pagina]);
    });
});

describe('dentro c\'è il Toast del design system com\'è (T1.3)', () => {
    it('classi del tono, ruolo, testo', () => {
        const toast = mostra({ children: 'Board creata', tone: 'info' });

        expect(toast.className).toBe('zr-toast zr-toast-info');
        expect(toast.getAttribute('role')).toBe('status');
        expect(toast.querySelector('.zr-toast-text')?.textContent).toBe('Board creata');
    });

    it('senza tono è quello di successo, come nel design system', () => {
        expect(mostra({ children: 'Fatto' }).className).toBe('zr-toast zr-toast-success');
    });

    it('l\'azione chiama onAction e la X chiama onClose, una volta', () => {
        const onAction = vi.fn();
        const onClose = vi.fn();
        const toast = mostra({ children: 'Scheda archiviata', actionLabel: 'Annulla', onAction, onClose });

        act(() => toast.querySelector<HTMLButtonElement>('.zr-toast-action')!.click());
        act(() => toast.querySelector<HTMLButtonElement>('.zr-toast-close')!.click());

        expect(toast.querySelector('.zr-toast-action')?.textContent).toBe('Annulla');
        expect(onAction).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});

describe('esportato dai due ingressi, coi tipi del Toast (T1.4)', () => {
    it('lo stesso componente da index e da app', () => {
        expect(dallIngresso.ToastDellaCornice).toBe(ToastDellaCornice);
        expect(dallIngressoDelleApp.ToastDellaCornice).toBe(ToastDellaCornice);
    });

    it('le props sono quelle del Toast', () => {
        expectTypeOf<ToastDellaCorniceProps>().toEqualTypeOf<Parameters<typeof Toast>[0]>();
    });
});
