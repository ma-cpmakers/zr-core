import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import { Dialog, Toast } from './zeiras/componenti';

// Richiesta 363 al design system, rimedio provvisorio della v5.6.0 (sì di zr-pm-a0 del 25/11, da zr-superadmin): il `Dialog`
// descritto dalla sua `description` (punto 1) e il resto della pagina `inert` finché è aperto (punto 2). In un file suo: i
// rimedi si mettono in ascolto una volta sola, quando arrivano.

const cambiato = () => new Promise((fatto) => setTimeout(fatto));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let radice: ReturnType<typeof createRoot> | undefined;
afterEach(() => {
    act(() => radice?.unmount());
    radice = undefined;
});

const monta = async (figlio: React.ReactNode) => {
    radice = createRoot(document.getElementById('pagina')!);
    act(() => radice!.render(figlio));
    await import('./rimedi');
    await cambiato();
};

const inerti = () => [...document.querySelectorAll('[inert]')].map((elemento) => elemento.id || elemento.className);

let apri: (quale: string) => void = () => {};

function Pagina({ conDescrizione = true }: { conDescrizione?: boolean }) {
    const [aperto, setAperto] = useState('');
    apri = setAperto;

    return (
        <>
            <button id="fuori" type="button">Fuori</button>
            <div id="avvisi"><Toast tone="info">Salvato</Toast><span id="accanto-agli-avvisi" /></div>
            <Dialog open={aperto !== ''} onClose={() => setAperto('')} title="Riattiva" description={conDescrizione ? 'La persona torna ad accedere.' : undefined}>
                <p id="nel-primo">Contenuto</p>
                <Dialog open={aperto === 'due'} onClose={() => setAperto('uno')} title="Sei sicuro?">Sì</Dialog>
            </Dialog>
        </>
    );
}

it('il dialogo è descritto dalla sua `description` con `aria-describedby`; senza `description` l\'attributo non c\'è (richiesta 363, punto 1)', async () => {
    document.body.innerHTML = '<div class="zr-shell"><div id="pagina"></div></div>';
    await monta(<Pagina />);
    act(() => apri('uno'));
    await cambiato();

    const dialogo = document.querySelector<HTMLElement>('.zr-dialog')!;
    const descrizione = dialogo.querySelector<HTMLElement>(':scope > .zr-dialog-desc')!;

    expect(descrizione.id).not.toBe('');
    expect(dialogo.getAttribute('aria-describedby')).toBe(descrizione.id);
    expect(document.getElementById(dialogo.getAttribute('aria-describedby')!)?.textContent).toBe('La persona torna ad accedere.');

    act(() => radice!.render(<Pagina conDescrizione={false} />));
    await cambiato();
    expect(document.querySelector('.zr-dialog')?.hasAttribute('aria-describedby')).toBe(false);
});

it('a dialogo aperto il resto della pagina è `inert`, tranne i `Toast`; alla chiusura torna com\'era, e ciò che era già inerte resta inerte (richiesta 363, punto 2)', async () => {
    document.body.innerHTML = '<div class="zr-shell"><nav id="barra" inert></nav><header id="testa"></header><div id="pagina"></div></div><div id="fuori-dalla-cornice"></div>';
    await monta(<Pagina />);
    expect(inerti()).toStrictEqual(['barra']);

    act(() => apri('uno'));
    await cambiato();
    expect(inerti()).toStrictEqual(['barra', 'testa', 'fuori', 'accanto-agli-avvisi', 'fuori-dalla-cornice']);
    expect(document.querySelector('.zr-toast')?.closest('[inert]')).toBeNull();
    expect(document.querySelector('.zr-dialog')?.closest('[inert]')).toBeNull();

    act(() => apri(''));
    await cambiato();
    expect(inerti()).toStrictEqual(['barra']);
});

it('un dialogo aperto dentro un altro rende inerte ciò che gli sta accanto, mai il dialogo che lo contiene; chiuso, il primo torna come prima (richiesta 363, punto 2)', async () => {
    document.body.innerHTML = '<div class="zr-shell"><div id="pagina"></div></div>';
    await monta(<Pagina />);
    act(() => apri('uno'));
    await cambiato();
    const conUno = inerti();

    act(() => apri('due'));
    await cambiato();
    const [primo, secondo] = document.querySelectorAll<HTMLElement>('.zr-dialog');

    expect(secondo?.closest('[inert]')).toBeNull();
    expect(primo?.closest('[inert]')).toBeNull();
    expect(document.getElementById('nel-primo')?.hasAttribute('inert')).toBe(true);
    expect(primo?.querySelector(':scope > .zr-dialog-head')?.hasAttribute('inert')).toBe(true);

    act(() => apri('uno'));
    await cambiato();
    expect(inerti()).toStrictEqual(conUno);
    expect(document.getElementById('fuori')?.hasAttribute('inert')).toBe(true);
});

it('una zona che annuncia e contiene il dialogo non resta viva per intero: ciò che sta accanto al dialogo dentro la zona è `inert` (richiesta 363, revisione R1)', async () => {
    document.body.innerHTML = '<div class="zr-shell"><section aria-live="polite"><button id="nella-zona" type="button">Copia</button><div id="pagina"></div></section></div>';
    await monta(<Pagina />);
    act(() => apri('uno'));
    await cambiato();

    expect(document.getElementById('nella-zona')?.hasAttribute('inert')).toBe(true);
    expect(document.querySelector('.zr-dialog')?.closest('[inert]')).toBeNull();
});

it('un\'anteprima del dialogo (`inline`) non rende inerte niente', async () => {
    document.body.innerHTML = '<div class="zr-shell"><div id="pagina"></div></div>';
    await monta(<Dialog open inline title="Anteprima">Testo</Dialog>);

    expect(inerti()).toStrictEqual([]);
});
