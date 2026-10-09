import { createContext, useContext, useLayoutEffect, useReducer } from 'react';
import { Cornice, type CorniceProps, type DatiDellaCornice } from './cornice';

// Il layout della cornice per i frontend con Inertia. Il modulo lo rende dal suo layout (un componente a livello di modulo,
// dato a `createInertiaApp({ layout })`) e la cornice resta montata mentre la pagina cambia: il testo scritto nella ricerca, il
// pannello aperto e le notifiche caricate restano. Ciò che sa solo la pagina (le voci del «+» con le loro funzioni, la voce
// attiva…) lo dà lei alla cornice montata, con `useCornice`. zr-core non dipende da Inertia: questi sono un componente e un
// hook di React, e di Inertia sanno solo che a ogni visita riporta in cima gli elementi con l'attributo `scroll-region`.

/** Le props di `Cornice`, coi dati che possono mancare. */
export interface LayoutDellaCorniceProps extends Omit<CorniceProps, 'dati'> {
    /** I dati della parte server (`Cornice::dati()`), come arrivano fra le props della pagina. Senza (`null`, o la prop che manca) la pagina si vede da sola. */
    cornice?: DatiDellaCornice | null;
}

/**
 * Ciò che una pagina dà alla cornice con `useCornice`. Il percorso no: sposta la pagina dentro un altro elemento dell'`AppShell`,
 * e dato dopo il montaggio la pagina si monterebbe due volte. Si dà al layout, come il prodotto aperto, «Esci» e `naviga`, che
 * sono del modulo.
 */
const nomiDellaPagina = ['nav', 'active', 'onNavigate', 'create', 'actions', 'flush'] as const;
type DellaPagina = Partial<Pick<CorniceProps, (typeof nomiDellaPagina)[number]>>;

const niente: DellaPagina = {};

/**
 * Ciò che la pagina ha dato, dopo che lo ha dato di nuovo: solo i suoi sei nomi, e senza quelli che non dà (anche scritti
 * `undefined`), che restano del layout. Se nessun valore è cambiato resta l'oggetto di prima, e il layout non si rende di nuovo.
 */
function datoDallaPagina(prima: DellaPagina, adesso: DellaPagina): DellaPagina {
    const dopo: DellaPagina = Object.fromEntries(nomiDellaPagina.flatMap((nome) => (adesso[nome] === undefined ? [] : [[nome, adesso[nome]]])));

    return nomiDellaPagina.every((nome) => Object.is(prima[nome], dopo[nome])) ? prima : dopo;
}

/** Come la pagina scrive nel layout ciò che dà alla cornice. Solo la funzione, che è sempre la stessa: mai lo stato, o la pagina si renderebbe a ogni cambio della cornice. */
const ContestoDellaCornice = createContext<((dellaPagina: DellaPagina) => void) | null>(null);

export function LayoutDellaCornice({ cornice, children, product, nav, active, onNavigate, crumbs, onCrumb, create, actions, flush, onLogout, naviga }: LayoutDellaCorniceProps) {
    const [dellaPagina, daLaPagina] = useReducer(datoDallaPagina, niente);

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
    // Ciò che ha dato la pagina va dopo le props del layout: finché è montata, vince lei.
    return (
        <ContestoDellaCornice value={daLaPagina}>
            <Cornice dati={cornice} {...dellaCornice} {...dellaPagina}>
                {children}
            </Cornice>
        </ContestoDellaCornice>
    );
}

/**
 * Dalla pagina (o dal suo involucro), mentre è montata sotto `LayoutDellaCornice`: dà alla cornice le voci del prodotto (`nav`),
 * la voce attiva (`active`), `onNavigate`, le voci del menu «+» (`create`), le azioni in topbar (`actions`) e l'area senza
 * margine (`flush`). Vince sulle props del layout, e quando la pagina se ne va ciò che aveva dato sparisce. Le funzioni possono
 * essere nuove a ogni render. Una chiamata per pagina: con due vince l'ultima. Dove la cornice non c'è (fuori dal layout, o
 * senza dati) non fa niente.
 */
export function useCornice(dellaPagina: DellaPagina): void {
    const daAllaCornice = useContext(ContestoDellaCornice);

    // Dopo ogni render, e prima che il browser disegni: al primo caricamento la cornice non si vede mai senza il «+».
    useLayoutEffect(() => {
        daAllaCornice?.(dellaPagina);
    });

    useLayoutEffect(() => () => daAllaCornice?.(niente), [daAllaCornice]);
}
