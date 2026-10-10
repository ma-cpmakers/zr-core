import { createContext, useContext, useLayoutEffect, useReducer } from 'react';
import { Cornice, type CorniceProps, type DatiDellaCornice } from './cornice';

// Il layout della cornice per i frontend con Inertia. Il modulo lo rende dal suo layout (un componente a livello di modulo,
// dato a `createInertiaApp({ layout })`) e la cornice resta montata mentre la pagina cambia: il testo scritto nella ricerca, il
// pannello aperto e le notifiche caricate restano, finché il workspace è lo stesso. Ciò che sa solo la pagina (le voci del «+» con le loro funzioni, la voce
// attiva…) lo dà lei alla cornice montata, con `useCornice`. zr-core non dipende da Inertia: questi sono un componente e un
// hook di React, e di Inertia sanno solo che a ogni visita riporta in cima gli elementi con l'attributo `scroll-region`.

/** Le props di `Cornice`, coi dati che possono mancare. */
export interface LayoutDellaCorniceProps extends Omit<CorniceProps, 'dati'> {
    /** I dati della parte server (`Cornice::dati()`), come arrivano fra le props della pagina. Senza (`null`, o la prop che manca) la pagina si vede da sola. */
    cornice?: DatiDellaCornice | null;
}

const nomiDellaPagina = ['nav', 'active', 'onNavigate', 'create', 'actions', 'flush'] as const;

/**
 * Ciò che una pagina dà alla cornice con `useCornice`. Il percorso no: sposta la pagina dentro un altro elemento dell'`AppShell`,
 * e dato dopo il montaggio la pagina si monterebbe due volte. Si dà al layout, come il prodotto aperto, «Esci» e `naviga`, che
 * sono del modulo.
 */
export type CorniceDellaPagina = Partial<Pick<CorniceProps, (typeof nomiDellaPagina)[number]>>;

const niente: CorniceDellaPagina = {};

/**
 * Ciò che la pagina ha dato, dopo che lo ha dato di nuovo: solo i suoi sei nomi, e senza quelli che non dà (anche scritti
 * `undefined`), che restano del layout. `null` è un valore: `active: null` (nessuna voce attiva) resta, e vince sul layout.
 * Se nessun valore è cambiato resta l'oggetto di prima, e il layout non si rende di nuovo.
 */
function datoDallaPagina(prima: CorniceDellaPagina, adesso: CorniceDellaPagina): CorniceDellaPagina {
    const dopo: CorniceDellaPagina = Object.fromEntries(nomiDellaPagina.flatMap((nome) => (adesso[nome] === undefined ? [] : [[nome, adesso[nome]]])));

    return nomiDellaPagina.every((nome) => Object.is(prima[nome], dopo[nome])) ? prima : dopo;
}

/** Come la pagina scrive nel layout ciò che dà alla cornice. Solo la funzione, che è sempre la stessa: mai lo stato, o la pagina si renderebbe a ogni cambio della cornice. */
const ContestoDellaCornice = createContext<((dellaPagina: CorniceDellaPagina) => void) | null>(null);

export function LayoutDellaCornice({ cornice, children, product, nav, active, onNavigate, crumbs, onCrumb, create, actions, flush, onLogout, naviga, piano }: LayoutDellaCorniceProps) {
    if (cornice === null || cornice === undefined) {
        return children;
    }

    // Per nome, una per una: Inertia dà al layout anche le props della pagina, e una che non è della cornice non deve arrivare
    // all'`AppShell`. Se `Cornice` ne prende una nuova, tsc si ferma qui finché il layout non la passa.
    const dellaCornice = { product, nav, active, onNavigate, crumbs, onCrumb, create, actions, flush, onLogout, naviga, piano } satisfies Record<keyof Omit<CorniceProps, 'dati' | 'children'>, unknown>;

    // La `key` è lo slug del workspace: ciò che la cornice tiene fra una pagina e l'altra (la ricerca coi suoi risultati, i
    // pannelli, le notifiche) è di quel workspace, e quando una visita ne porta un altro la cornice si rifà, e la pagina con
    // lei: niente del workspace di prima resta davanti a chi è passato a un altro.
    return (
        <CorniceMontata key={cornice.workspace.slug} dati={cornice} {...dellaCornice}>
            {children}
        </CorniceMontata>
    );
}

/**
 * La cornice di un workspace, con ciò che le ha dato la pagina. Quello stato sta qui, sotto la `key` del layout: quando il
 * workspace cambia la cornice nuova parte senza niente della pagina di prima, nemmeno per un render (un'azione della pagina
 * di prima non si monta nella cornice nuova).
 */
function CorniceMontata({ children, ...dellaCornice }: CorniceProps) {
    const [dellaPagina, daLaPagina] = useReducer(datoDallaPagina, niente);

    // L'area della pagina è una `scroll-region` di Inertia: a ogni visita torna in cima, e con Indietro dov'era. A scorrere è un
    // elemento dell'`AppShell` (`main.zr-main`; col percorso `div.zr-main-body`), che non ha una prop per l'attributo: va sul
    // suo DOM dopo ogni render, perché quando il percorso compare l'`AppShell` crea `div.zr-main-body` in quel momento. Conta
    // su un solo `AppShell` nella pagina.
    useLayoutEffect(() => {
        document.querySelectorAll('.zr-shell > .zr-main, .zr-shell > .zr-main > .zr-main-body').forEach((area) => area.setAttribute('scroll-region', ''));
    });

    // Nessun elemento intorno: `.zr-shell` è una griglia alta quanto la finestra, e la pagina resta figlia di `main.zr-main`.
    // Ciò che ha dato la pagina va dopo le props del layout: finché è montata, vince lei.
    return (
        <ContestoDellaCornice value={daLaPagina}>
            <Cornice {...dellaCornice} {...dellaPagina}>
                {children}
            </Cornice>
        </ContestoDellaCornice>
    );
}

/**
 * Dalla pagina, o dal suo involucro, mentre è montata sotto `LayoutDellaCornice`: dà alla cornice le voci del prodotto (`nav`),
 * la voce attiva (`active`; `null`: nessuna), `onNavigate`, le voci del menu «+» (`create`), le azioni in topbar (`actions`) e
 * l'area senza margine (`flush`). Vince sulle props del layout, e quando la pagina se ne va ciò che aveva dato sparisce. Le
 * funzioni possono essere nuove a ogni render. Una chiamata sola per pagina, nella pagina o nel suo involucro, non in tutti e
 * due: due chiamate non si sommano (ognuna sostituisce tutto ciò che ha dato l'altra, e quando una si smonta sparisce anche
 * quello dell'altra). Dove la cornice non c'è (fuori dal layout, o senza dati) non fa niente.
 */
export function useCornice(dellaPagina: CorniceDellaPagina): void {
    const daAllaCornice = useContext(ContestoDellaCornice);

    // Dopo ogni render, e prima che il browser disegni: nel browser la cornice non si vede mai senza il «+». Arriva comunque un
    // commit dopo il montaggio della pagina, e sul server (SSR) gli effetti non girano: lì l'HTML esce senza ciò che dà la pagina.
    useLayoutEffect(() => {
        daAllaCornice?.(dellaPagina);
    });

    useLayoutEffect(() => () => daAllaCornice?.(niente), [daAllaCornice]);
}
