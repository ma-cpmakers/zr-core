import { act } from 'react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as dallIngresso from './index';
import * as dallIngressoDelleApp from './app';
import { chiudiToast, mostraToast, type ToastDaMostrare } from './turno';
import type { ToastDellaCorniceProps } from './toast';
import italiano from '../lingue/toast/it.json';
import spagnolo from '../lingue/toast/es.json';
import inglese from '../lingue/toast/en.json';

// Voce #3537 (controllo di deriva dell'08/11, Decisione 23090 di zr-pm-07): il Toast di turno. Il modulo lo chiede con
// `mostraToast`, e la durata, «Annulla», la pausa sotto il puntatore e col fuoco e il Toast uno alla volta sono della cornice.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.lang = 'it';
});

afterEach(() => {
    act(() => chiudiToast());
    act(() => {
        vi.advanceTimersByTime(1000);
    });
    vi.useRealTimers();
});

const mostra = (toast: ToastDaMostrare): void => {
    act(() => mostraToast(toast));
    act(() => {
        vi.advanceTimersByTime(100);
    });
};
const passano = (ms: number): void =>
    act(() => {
        vi.advanceTimersByTime(ms);
    });
const tutti = () => document.querySelectorAll<HTMLElement>('.zr-toast');
const azione = () => document.querySelector<HTMLButtonElement>('.zr-toast-action');
const chiudi = () => document.querySelector<HTMLButtonElement>('.zr-toast-close');

describe('la durata del design system: 5 s, 10 s con un\'azione (AC 1)', () => {
    it('senza azione: c\'è a 4,999 s dalla richiesta, a 5 s non c\'è più', () => {
        mostra({ children: 'Salvato' });
        expect(tutti()).toHaveLength(1);
        expect(tutti()[0]!.textContent).toContain('Salvato');

        passano(4899);
        expect(tutti()).toHaveLength(1);
        passano(1);
        expect(tutti()).toHaveLength(0);
    });

    it('con «Annulla»: c\'è ancora a 5 s e a 9,999 s, a 10 s non c\'è più', () => {
        mostra({ children: 'Board archiviata', onAction: () => undefined });

        passano(4900);
        expect(tutti()).toHaveLength(1);
        passano(4999);
        expect(tutti()).toHaveLength(1);
        passano(1);
        expect(tutti()).toHaveLength(0);
    });

    it('il tono arriva al Toast del design system, e senza tono è quello di successo', () => {
        mostra({ children: 'Non salvato', tone: 'danger' });
        expect(tutti()[0]!.className).toContain('zr-toast-danger');

        mostra({ children: 'Salvato' });
        expect(tutti()[0]!.className).toContain('zr-toast-success');
    });

    it('è il Toast della cornice: in basso al centro, a --z-toast, nel body', () => {
        mostra({ children: 'Salvato' });
        const stile = tutti()[0]!.parentElement!.getAttribute('style') ?? '';

        expect(stile).toContain('position: fixed');
        expect(stile).toContain('z-index: var(--z-toast)');
        expect(tutti()[0]!.closest('body')).toBe(document.body);
    });
});

describe('non si chiude sotto il puntatore o col fuoco dentro, e il tempo riparte quando escono (AC 2)', () => {
    it('col puntatore sopra resta oltre i 10 s; uscito, si chiude 10 s dopo e non prima', () => {
        mostra({ children: 'Board archiviata', onAction: () => undefined });
        passano(3000);
        act(() => tutti()[0]!.dispatchEvent(new MouseEvent('pointerover', { bubbles: true })));
        passano(30_000);
        expect(tutti()).toHaveLength(1);

        act(() => tutti()[0]!.dispatchEvent(new MouseEvent('pointerout', { bubbles: true, relatedTarget: document.body })));
        passano(9999);
        expect(tutti()).toHaveLength(1);
        passano(1);
        expect(tutti()).toHaveLength(0);
    });

    it('passare dal testo ad «Annulla» col puntatore non lo fa ripartire: il puntatore è ancora sopra', () => {
        mostra({ children: 'Board archiviata', onAction: () => undefined });
        const testo = document.querySelector<HTMLElement>('.zr-toast-text')!;
        act(() => testo.dispatchEvent(new MouseEvent('pointerover', { bubbles: true })));
        act(() => testo.dispatchEvent(new MouseEvent('pointerout', { bubbles: true, relatedTarget: azione() })));
        act(() => azione()!.dispatchEvent(new MouseEvent('pointerover', { bubbles: true })));
        passano(30_000);

        expect(tutti()).toHaveLength(1);
    });

    it('col fuoco su «Annulla» (chi arriva col Tab) resta oltre i 10 s; uscito il fuoco, si chiude 10 s dopo', () => {
        const fuori = document.createElement('button');
        document.body.append(fuori);
        mostra({ children: 'Board archiviata', onAction: () => undefined });
        passano(9000);
        act(() => azione()!.focus());
        expect(document.activeElement).toBe(azione());
        passano(30_000);
        expect(tutti()).toHaveLength(1);

        act(() => fuori.focus());
        passano(9999);
        expect(tutti()).toHaveLength(1);
        passano(1);
        expect(tutti()).toHaveLength(0);
        fuori.remove();
    });

    it('il fuoco che passa da «Annulla» alla ✕ resta dentro: il Toast non si chiude', () => {
        mostra({ children: 'Board archiviata', onAction: () => undefined });
        act(() => azione()!.focus());
        act(() => chiudi()!.focus());
        passano(30_000);

        expect(tutti()).toHaveLength(1);
    });
});

describe('uno alla volta (AC 3)', () => {
    it('il nuovo prende il posto del primo: a schermo uno solo, quello nuovo, e il primo non torna', () => {
        mostra({ children: 'Primo', onAction: () => undefined });
        mostra({ children: 'Secondo' });

        expect(tutti()).toHaveLength(1);
        expect(tutti()[0]!.textContent).toContain('Secondo');
        passano(5000);
        expect(tutti()).toHaveLength(0);
        passano(20_000);
        expect(tutti()).toHaveLength(0);
    });

    it('l\'azione del primo non scatta dopo che è stato sostituito, nemmeno dal pulsante che si era tenuto', () => {
        const annullaIlPrimo = vi.fn();
        mostra({ children: 'Primo', onAction: annullaIlPrimo });
        const delPrimo = azione()!;
        mostra({ children: 'Secondo' });
        act(() => delPrimo.click());

        expect(annullaIlPrimo).not.toHaveBeenCalled();
        expect(azione()).toBeNull();
    });

    it('il clic sul primo che arriva nello stesso passo della sostituzione, prima che React lo tolga, non chiama la sua azione (rilievo R3)', () => {
        const annullaIlPrimo = vi.fn();
        mostra({ children: 'Primo', onAction: annullaIlPrimo });
        const delPrimo = azione()!;
        act(() => {
            mostraToast({ children: 'Secondo' });
            delPrimo.click();
        });

        expect(annullaIlPrimo).not.toHaveBeenCalled();
        expect(tutti()).toHaveLength(1);
    });

    it('l\'azione che chiede un Toast nuovo lo vede a schermo, solo lui (rilievo R4)', () => {
        mostra({ children: 'Board archiviata', onAction: () => mostraToast({ children: 'Board ripristinata' }) });
        act(() => azione()!.click());
        passano(100);

        expect(tutti()).toHaveLength(1);
        expect(tutti()[0]!.textContent).toContain('Board ripristinata');
    });

    it('il tempo è del nuovo: quello del primo non lo chiude prima', () => {
        mostra({ children: 'Primo' });
        passano(4000);
        mostra({ children: 'Secondo', onAction: () => undefined });
        passano(9899);

        expect(tutti()).toHaveLength(1);
        expect(tutti()[0]!.textContent).toContain('Secondo');
    });

    it('la regione lo annuncia: il nuovo entra vuoto, e il suo testo arriva un passo dopo', () => {
        mostra({ children: 'Primo' });
        act(() => mostraToast({ children: 'Secondo' }));

        expect(tutti()).toHaveLength(1);
        expect(tutti()[0]!.textContent).toBe('');
        passano(100);
        expect(tutti()[0]!.textContent).toContain('Secondo');
    });
});

describe('«Annulla» nella lingua della pagina, e chiude subito (AC 4)', () => {
    it.each([
        ['it', italiano.undo],
        ['es', spagnolo.undo],
        ['es-ES', spagnolo.undo],
        ['en', inglese.undo],
    ])('pagina in %s: il pulsante dice «%s»', (lingua, testo) => {
        document.documentElement.lang = lingua;
        mostra({ children: 'Board archiviata', onAction: () => undefined });

        expect(azione()!.textContent).toBe(testo);
    });

    it('i testi sono quelli dei file: «Annulla», «Deshacer», «Undo»', () => {
        expect([italiano.undo, spagnolo.undo, inglese.undo]).toEqual(['Annulla', 'Deshacer', 'Undo']);
    });

    it('in spagnolo non compare l\'italiano', () => {
        document.documentElement.lang = 'es';
        mostra({ children: 'Tablero archivado', onAction: () => undefined });

        expect(azione()!.textContent).not.toBe(italiano.undo);
    });

    it('chi lo mostra può dare un altro testo', () => {
        mostra({ children: 'Scheda spostata', actionLabel: 'Riporta', onAction: () => undefined });

        expect(azione()!.textContent).toBe('Riporta');
    });

    it('premuta l\'azione: l\'azione una volta, e il Toast si chiude subito', () => {
        const annulla = vi.fn();
        mostra({ children: 'Board archiviata', onAction: annulla });
        act(() => azione()!.click());

        expect(annulla).toHaveBeenCalledTimes(1);
        expect(tutti()).toHaveLength(0);
    });

    it('premuta la ✕: si chiude subito, e l\'azione non scatta', () => {
        const annulla = vi.fn();
        mostra({ children: 'Board archiviata', onAction: annulla });
        act(() => chiudi()!.click());

        expect(annulla).not.toHaveBeenCalled();
        expect(tutti()).toHaveLength(0);
    });

    it('chi preme «Annulla» da tastiera ritrova il fuoco dove l\'aveva quando il Toast è comparso (rilievo R5)', () => {
        const archivia = document.createElement('button');
        document.body.append(archivia);
        archivia.focus();
        mostra({ children: 'Board archiviata', onAction: () => undefined });
        act(() => azione()!.focus());
        act(() => azione()!.click());

        expect(document.activeElement).toBe(archivia);
        archivia.remove();
    });

    it('chiuso con la ✕ dal fuoco, idem; chiuso dal tempo, col fuoco altrove, il fuoco non si sposta', () => {
        const archivia = document.createElement('button');
        const altro = document.createElement('input');
        document.body.append(archivia, altro);
        archivia.focus();
        mostra({ children: 'Board archiviata', onAction: () => undefined });
        act(() => chiudi()!.focus());
        act(() => chiudi()!.click());
        expect(document.activeElement).toBe(archivia);

        mostra({ children: 'Salvato' });
        act(() => altro.focus());
        passano(5000);
        expect(tutti()).toHaveLength(0);
        expect(document.activeElement).toBe(altro);
        archivia.remove();
        altro.remove();
    });

    it('un actionLabel vuoto non toglie il pulsante: dice «Annulla» (rilievo R7)', () => {
        mostra({ children: 'Board archiviata', actionLabel: '', onAction: () => undefined });

        expect(azione()!.textContent).toBe(italiano.undo);
    });

    it('senza azione non c\'è «Annulla», e la ✕ c\'è', () => {
        mostra({ children: 'Salvato' });

        expect(azione()).toBeNull();
        expect(chiudi()).not.toBeNull();
    });

    it('chiudiToast lo toglie subito', () => {
        mostra({ children: 'Salvato' });
        act(() => chiudiToast());

        expect(tutti()).toHaveLength(0);
    });
});

describe('esportato dai due ingressi, con le props del Toast (AC 5)', () => {
    it('le stesse funzioni da index e da app', () => {
        expect(dallIngresso.mostraToast).toBe(mostraToast);
        expect(dallIngressoDelleApp.mostraToast).toBe(mostraToast);
        expect(dallIngresso.chiudiToast).toBe(chiudiToast);
        expect(dallIngressoDelleApp.chiudiToast).toBe(chiudiToast);
    });

    it('ciò che si mostra ha le props del Toast della cornice, senza onClose (la chiusura è della cornice) e con actionLabel facoltativo', () => {
        expectTypeOf<ToastDaMostrare['children']>().toEqualTypeOf<ToastDellaCorniceProps['children']>();
        expectTypeOf<ToastDaMostrare['tone']>().toEqualTypeOf<ToastDellaCorniceProps['tone']>();
        expectTypeOf<NonNullable<ToastDaMostrare['onAction']>>().toEqualTypeOf<NonNullable<ToastDellaCorniceProps['onAction']>>();
        // Un testo dell'azione senza l'azione non si scrive (rilievo R7): sparirebbe senza avviso.
        // @ts-expect-error actionLabel senza onAction
        const senzaAzione: ToastDaMostrare = { children: 'Salvato', actionLabel: 'Riporta' };
        expect(senzaAzione).toBeDefined();
        expectTypeOf<ToastDaMostrare['closeLabel']>().toEqualTypeOf<ToastDellaCorniceProps['closeLabel']>();
        expectTypeOf<ToastDaMostrare>().not.toHaveProperty('onClose');
    });
});
