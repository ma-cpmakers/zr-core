import { useLayoutEffect } from 'react';
import { Cornice, type CorniceProps, type DatiDellaCornice } from './cornice';

// Il layout della cornice per i frontend con Inertia. Il modulo lo rende dal suo layout (un componente a livello di modulo,
// dato a `createInertiaApp({ layout })`) e la cornice resta montata mentre la pagina cambia: il testo scritto nella ricerca, il
// pannello aperto e le notifiche caricate restano. zr-core non dipende da Inertia: questo è un componente di React, e di
// Inertia sa solo che a ogni visita riporta in cima gli elementi con l'attributo `scroll-region`.

/** Le props di `Cornice`, coi dati che possono mancare. */
export interface LayoutDellaCorniceProps extends Omit<CorniceProps, 'dati'> {
    /** I dati della parte server (`Cornice::dati()`), come arrivano fra le props della pagina. Senza (`null`, o la prop che manca) la pagina si vede da sola. */
    cornice?: DatiDellaCornice | null;
}

export function LayoutDellaCornice({ cornice, children, product, nav, active, onNavigate, crumbs, onCrumb, create, actions, flush, onLogout, naviga }: LayoutDellaCorniceProps) {
    // L'area della pagina è una `scroll-region` di Inertia: a ogni visita torna in cima, e con Indietro dov'era. A scorrere è un
    // elemento dell'`AppShell` (`main.zr-main`; col percorso `div.zr-main-body`), che non ha una prop per l'attributo: va sul
    // suo DOM dopo ogni render, perché quando il percorso compare l'`AppShell` crea `div.zr-main-body` in quel momento. Conta
    // su un solo `AppShell` nella pagina.
    useLayoutEffect(() => {
        document.querySelectorAll('.zr-shell > .zr-main, .zr-shell > .zr-main > .zr-main-body').forEach((area) => area.setAttribute('scroll-region', ''));
    });

    if (cornice === null || cornice === undefined) {
        return children;
    }

    // Per nome, una per una: Inertia dà al layout anche le props della pagina, e una che non è della cornice non deve arrivare
    // all'`AppShell`. Se `Cornice` ne prende una nuova, tsc si ferma qui finché il layout non la passa.
    const dellaCornice = { product, nav, active, onNavigate, crumbs, onCrumb, create, actions, flush, onLogout, naviga } satisfies Record<keyof Omit<CorniceProps, 'dati' | 'children'>, unknown>;

    // Nessun elemento intorno: `.zr-shell` è una griglia alta quanto la finestra, e la pagina resta figlia di `main.zr-main`.
    return (
        <Cornice dati={cornice} {...dellaCornice}>
            {children}
        </Cornice>
    );
}
