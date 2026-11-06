import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { Cornice } from './cornice';
import type { DatiDellaCornice } from './index';

// Sprint 30 · T3 (voce #1871). Il pezzo dei rimedi provvisori di tastiera che non arriva — un rilascio nel mezzo, la rete
// che cade —: la cornice resta quella di prima. In un file suo, perché il modulo finto vale per tutto il file.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('./rimedi', () => {
    throw new TypeError('Failed to fetch dynamically imported module');
});

const dati: DatiDellaCornice = {
    lingua: 'it',
    persona: { nome: 'Ada Lovelace', email: 'ada@example.com' },
    workspace: { nome: 'Marketing', slug: 'acme-marketing' },
    prodotti: { pm: 'attivo' },
};

it('se il pezzo dei rimedi di tastiera non arriva la cornice c\'è lo stesso, la campanella si apre col fuoco dov\'era, e niente resta senza risposta: nessun errore in console e nessuna promessa rifiutata', async () => {
    const rifiutate: unknown[] = [];
    const alRifiuto = (evento: PromiseRejectionEvent) => rifiutate.push(evento.reason);
    window.addEventListener('unhandledrejection', alRifiuto);
    const nonGestite = (motivo: unknown) => rifiutate.push(motivo);
    process.on('unhandledRejection', nonGestite);
    vi.spyOn(console, 'error');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) })));
    const contenitore = document.createElement('div');
    document.body.append(contenitore);
    const radice = createRoot(contenitore);

    await act(async () => radice.render(<Cornice dati={dati} onLogout={() => {}} />));
    await act(async () => {
        await vi.dynamicImportSettled();
        await new Promise((fatto) => setTimeout(fatto, 0));
    });
    const campanella = contenitore.querySelector<HTMLButtonElement>('.zr-bell');
    await act(async () => {
        campanella?.focus();
        campanella?.click();
        await new Promise((fatto) => setTimeout(fatto, 0));
    });

    expect(contenitore.querySelector('.zr-notif')).not.toBeNull();
    expect(document.activeElement).toBe(campanella);
    expect(rifiutate).toStrictEqual([]);
    expect(console.error).not.toHaveBeenCalled();

    await act(async () => radice.unmount());
    contenitore.remove();
    window.removeEventListener('unhandledrejection', alRifiuto);
    process.off('unhandledRejection', nonGestite);
});

// Sprint 69 · T3.3 (voce #2033). Fino alla `v4.16` il gestore dei clic sulla barra laterale stava nel pezzo dei rimedi; dalla
// `v4.17.0` è dell'`AppShell` (`navigate`, righe 27 e 98), e senza il pezzo un clic sulla barra passa lo stesso da `naviga`. Nel
// pezzo resta quello del percorso (#2722): senza, un clic sul percorso resta del browser.
it('senza il pezzo dei rimedi un clic su una voce della barra laterale passa da `naviga`, e uno sul percorso resta del browser (sprint 69 · T3.3; righe 27 e 98)', async () => {
    const naviga = vi.fn();
    const contenitore = document.createElement('div');
    document.body.append(contenitore);
    const radice = createRoot(contenitore);

    await act(async () => radice.render(<Cornice dati={dati} onLogout={() => {}} naviga={naviga} crumbs={[{ label: 'UAT Board', href: `${location.origin}/uat/board` }, { label: 'UAT Pagina' }]} />));
    await act(async () => {
        await vi.dynamicImportSettled();
        await new Promise((fatto) => setTimeout(fatto, 0));
    });
    const collegamento = [...contenitore.querySelectorAll<HTMLAnchorElement>('.zr-shell > .zr-side a[href]')].find((uno) => uno.getAttribute('href') !== '#');
    collegamento?.setAttribute('href', `${location.origin}/uat`);
    const visti: boolean[] = [];
    const alla = (evento: Event) => {
        visti.push(evento.defaultPrevented);
        evento.preventDefault();
    };
    window.addEventListener('click', alla);
    collegamento?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    contenitore.querySelector('.zr-crumbbar a[href]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    window.removeEventListener('click', alla);

    expect(collegamento).toBeDefined();
    expect(visti).toStrictEqual([true, false]);
    expect(naviga.mock.calls).toStrictEqual([[`${location.origin}/uat`]]);

    await act(async () => radice.unmount());
    contenitore.remove();
});
