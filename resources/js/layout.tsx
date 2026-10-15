import { createContext, useContext, useLayoutEffect, useReducer, useState } from 'react';
import { Cornice, type CorniceProps, type DatiDellaCornice, type DatiDopo, type DatiSubito } from './cornice';
import { segno } from './servizi';

// Il layout della cornice per i frontend con Inertia. Il modulo lo rende dal suo layout (un componente a livello di modulo,
// dato a `createInertiaApp({ layout })`) e la cornice resta montata mentre la pagina cambia: il testo scritto nella ricerca, il
// pannello aperto e le notifiche caricate restano, finché il workspace è lo stesso. Ciò che sa solo la pagina (le voci del «+» con le loro funzioni, la voce
// attiva…) lo dà lei alla cornice montata, con `useCornice`. zr-core non dipende da Inertia: questi sono un componente e un
// hook di React, e di Inertia sanno solo che a ogni visita riporta in cima gli elementi con l'attributo `scroll-region`.

/** Le props di `Cornice`, coi dati che possono mancare. */
export interface LayoutDellaCorniceProps extends Omit<CorniceProps, 'dati'> {
    /** I dati della parte server (`Cornice::dati()`), come arrivano fra le props della pagina. Senza (`null`, o la prop che manca) la pagina si vede da sola. */
    cornice?: DatiDellaCornice | null | undefined;
    /**
     * Al posto di `cornice` (dalla `v2.1.0`): i dati che la parte server legge dalla sola sessione (`Cornice::subito()`), che
     * ci sono dal primo disegno. Con questi la cornice è montata subito, ridotta finché `dopo` non arriva. Se c'è `cornice`, vale `cornice`.
     */
    subito?: DatiSubito | null | undefined;
    /**
     * I dati che la parte server legge dal backoffice (`Cornice::dopo()`): possono arrivare dopo il primo disegno (con Inertia,
     * una prop rimandata), e quando arrivano la cornice diventa quella di sempre senza che la pagina si rimonti. Dicono di
     * chi sono (dalla `v2.4.0`): se fra `subito` e `dopo` la sessione è passata a un'altra persona, la cornice è la sua.
     */
    dopo?: DatiDopo | null | undefined;
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

/** Il segno di chi questi dati mostrano, come lo legge `Cornice`: quello della sessione, o quello della lettura nei dati interi. */
const della = (questi: DatiDellaCornice) => segno(questi.sessione_il ?? questi.aggiornati_il)!;

/**
 * Chi è una persona per il layout (dalla `v2.20.1`, come per `Cornice` dalla `v2.20.0`): l'email e l'impronta di zr-auth. Con la
 * stessa email e un'altra impronta è un altro account, e quindi un'altra persona; senza impronta da tutte e due le parti (un
 * frontend che costruisce `persona` da sé) decide l'email, come fino alla `v2.19`. È un testo, non una somma: con l'email e
 * l'impronta che mancano tutte e due la somma sarebbe `NaN`, diverso da sé stesso, e il layout si renderebbe senza fine.
 */
const lui = (persona: DatiDellaCornice['persona']) => `${persona.email} ${persona.impronta}`;

/**
 * Due dati sono della stessa persona se hanno la stessa email e la stessa impronta, e l'email c'è: due email che mancano (dati
 * contro il tipo) sono due persone, e dall'uno all'altro non passa niente — né la lingua né il nome (dalla `v2.11.1`).
 */
const stessaPersona = (uno: DatiDellaCornice, altro: DatiDellaCornice) => !!uno.persona.email && lui(uno.persona) === lui(altro.persona);

export function LayoutDellaCornice({ cornice: intera, subito, dopo, children, product, nav, active, onNavigate, crumbs, onCrumb, create, actions, flush, onLogout, naviga, piano }: LayoutDellaCorniceProps) {
    // Con `subito` i dati della cornice si compongono qui: quelli della sessione, e quelli del backoffice quando ci sono.
    // `dopo` sta sopra, con tutto ciò che porta (dalla `v2.9.0` meno la lingua, se `subito` è della stessa persona ed è più recente: qui sotto): è letto in un'altra richiesta, e dice di chi è (lingua, persona e il loro
    // segno) e di quale workspace. Così i dati di una persona non stanno sotto il nome che `subito` aveva di un'altra.
    // Un `dopo` di un'altra persona letto con una sessione più vecchia di quella di `subito` è di chi c'era prima (la pagina
    // ha riletto il solo `subito`): non si unisce, e la cornice aspetta il `dopo` di chi è entrato. Uno più recente sì, e la
    // cornice diventa di chi dice lui; senza un segno o senza la persona da una parte vale come sempre.
    const suo = subito && dopo?.persona && lui(dopo.persona) !== lui(subito.persona) && segno(dopo.sessione_il)! < segno(subito.sessione_il)! ? undefined : dopo;
    // Con la stessa persona vale la lingua del dato col segno della lingua più avanti (dalla `v2.9.0`; dalla `v2.11.0` col
    // segno della lingua, `lingua_il`, e non con quello della sessione): chi ha cambiato lingua e rilegge il solo `subito` ha i
    // testi nella lingua nuova senza aspettare `dopo`, e un `subito` riletto mentre `dopo` è in lettura, che porta la sessione
    // di adesso e la lingua di prima, non la riporta. Da `subito` passano la sola lingua e il suo segno, e solo se `dopo` dice
    // che è della stessa persona e i due segni ci sono: un confronto con `undefined` è falso, e vale `dopo` come sempre. Il segno
    // della lingua della pagina è quello del dato da cui viene la lingua.
    const piuRecente = subito && subito.persona.email && suo?.persona && lui(suo.persona) === lui(subito.persona) && segno(suo?.lingua_il)! < segno(subito.lingua_il)! && { lingua: subito.lingua, lingua_il: subito.lingua_il };
    const pagina = intera ?? (subito ? { prodotti: [], ...subito, ...(suo ?? { in_attesa: true }), ...(suo && (piuRecente || { lingua_il: suo.lingua_il })) } : undefined);

    // Chi la cornice mostra sta qui, sopra la `key` del workspace: sotto, quando il workspace cambia la cornice si rifà e non
    // lo sa più. È chi ha il segno più avanti (quello della sessione, o quello della lettura nei dati interi), e non torna mai
    // indietro: una pagina più vecchia è una voce della cronologia ripresa con Indietro o Avanti, e non dice chi è entrato.
    // Senza un segno da una parte vale la pagina, se è della stessa persona: un confronto con `undefined` è sempre falso.
    const [entrato, entra] = useState(pagina);
    // L'ultima pagina di chi è mostrato: una pagina di un'altra persona non la cambia, nemmeno nello stesso workspace.
    const [vista, vedi] = useState(pagina);
    if (!pagina) {
        return children;
    }
    // Senza il segno da una delle due parti la pagina di un'altra persona non si può dire più vecchia né più nuova di chi è
    // mostrato, e con Indietro sarebbe di chi c'era prima. Nello stesso workspace lo guarda `Cornice`, che resta montata; in un
    // altro la `key` cambia, la cornice si rifà e non sa più chi mostrava: lo sa il layout, che non ne mostra niente, nemmeno
    // la pagina, e ricarica (dalla `v2.8.0`). Ricaricata, è di chi è entrato. Prima manda l'evento `zr-core:altra-persona`, come per
    // la ricarica chiesta da una risposta di un'altra persona (dalla `v2.17.0`).
    if (entrato && lui(pagina.persona) !== lui(entrato.persona) && !(della(pagina) && della(entrato))) {
        return (dispatchEvent(new Event('zr-core:altra-persona')), location.reload()) as undefined;
    }
    const piuAvanti = entrato && della(entrato) > della(pagina) ? entrato : pagina;
    // La lingua, con la stessa persona, è quella col segno della lingua più avanti fra chi è mostrato e la pagina (dalla
    // `v2.11.0`): una pagina di Indietro letta dopo la sessione di chi è mostrato, ma con la lingua confermata prima, non
    // riporta la lingua di allora. Senza il segno da una parte resta quella di chi ha la sessione più avanti.
    const altro = piuAvanti === pagina ? entrato : pagina;
    const chi = altro && stessaPersona(altro, piuAvanti) && segno(altro.lingua_il)! > segno(piuAvanti.lingua_il)! ? { ...piuAvanti, lingua: altro.lingua, lingua_il: altro.lingua_il } : piuAvanti;
    if (!entrato || lui(chi.persona) !== lui(entrato.persona) || della(chi) !== della(entrato) || chi.lingua_il !== entrato.lingua_il) {
        entra(chi);
    }
    // Una pagina di un'altra persona (un'altra email, o la stessa con un'altra impronta) è più vecchia di chi è mostrato: i suoi dati non valgono. Se è di un
    // altro workspace restano quelli visti, e la cornice non si rifà; nello stesso workspace lo decide `Cornice`, che lì è
    // rimasta montata e sa leggere un `dopo` riletto adesso sotto il `subito` di allora.
    const sua = lui(pagina.persona) === lui(chi.persona);
    const ultima = (sua ? pagina : vista) ?? pagina;
    if (sua && (!vista || lui(pagina.persona) !== lui(vista.persona) || pagina.workspace.slug !== vista.workspace.slug || della(pagina) !== della(vista))) {
        vedi(pagina);
    }
    const valgono = sua || pagina.workspace.slug === ultima.workspace.slug ? pagina : ultima;
    // Una pagina sua più vecchia (Indietro su un altro workspace) porta i suoi dati, ma il nome, la lingua e il segno restano
    // quelli di adesso: la cornice che si rifà lì sotto riparte da chi è mostrato, e una voce di un'altra persona più vecchia
    // di lui non passa nemmeno dopo.
    // Con la stessa persona e lo stesso segno, la lingua è quella di chi è mostrato, se lì il suo segno è più avanti (sopra).
    const cornice = !stessaPersona(valgono, chi) ? valgono : della(chi) > della(valgono) ? { ...valgono, lingua: chi.lingua, persona: chi.persona, sessione_il: chi.sessione_il ?? chi.aggiornati_il } : chi.lingua !== valgono.lingua ? { ...valgono, lingua: chi.lingua } : valgono;

    // Per nome, una per una: Inertia dà al layout anche le props della pagina, e una che non è della cornice non deve arrivare
    // all'`AppShell`. Se `Cornice` ne prende una nuova, tsc si ferma qui finché il layout non la passa.
    const dellaCornice = { product, nav, active, onNavigate, crumbs, onCrumb, create, actions, flush, onLogout, naviga, piano } satisfies Record<keyof Omit<CorniceProps, 'dati' | 'children'>, unknown>;

    // La `key` è lo slug del workspace: ciò che la cornice tiene fra una pagina e l'altra (la ricerca coi suoi risultati, i
    // pannelli, le notifiche) è di quel workspace, e quando una visita ne porta un altro la cornice si rifà, e la pagina con
    // lei: niente del workspace di prima resta davanti a chi è passato a un altro. Lo slug è quello dei dati che valgono: con
    // Indietro su una pagina di allora di un'altra persona resta quello di chi è entrato.
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

    // Nessun elemento intorno: `.zr-shell` è una griglia alta quanto la finestra, e la pagina resta figlia di `main.zr-main` —
    // o di `div.zr-main-body`, se ha il percorso —, anche nello stato ridotto di chi non ha accettato i documenti legali: dalla
    // `v1.15.0` lì la cornice le mette l'avviso subito prima, e la pagina resta nello stesso posto.
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
