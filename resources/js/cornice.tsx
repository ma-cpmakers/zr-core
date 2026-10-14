import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AccountAction, MenuItem, NavItem, ShellCrumb, ShellNotification, ShellWorkspace, Tone } from '../zeiras/index';
import { campanella, chiediLaCampanella, linguaDeiTesti, nomeDellaVoce, nomePulito, testi, testiDellaRicerca, type TestiDellaCornice } from './lingue';
import { destinazioneDellaNotifica } from './notifiche';
import { fontiDellaRicerca, nelWorkspace, prodottoDelRegistro, raggiungibile, registro, type IdDiProdotto } from './registro';
import { AccettazioneRichiesta, caricaNotifiche, chiediLaRicerca, mostra, ricerca as laRicerca, segnaLetta, segnaLetteFinoA, segno, type NotificaDellaCornice, type RisultatoDellaRicerca } from './servizi';
import { tonoDelWorkspace } from './tono';
import { Alert, AppShell, Button } from './zeiras/componenti';

// Le frasi delle notifiche stanno nel pezzo della campanella (`./campanella`), che arriva a richiesta: qui c'è solo chi lo
// chiede. `caricaFrasi` chiede prima il pezzo e poi, a lui, le frasi di una lingua; `frasiPronte` le dà se pezzo e frasi sono
// già in memoria. Se il pezzo non arriva è un errore come quello delle frasi che non arrivano.
const caricaFrasi = (lingua: string, senzaAttesa?: boolean) => chiediLaCampanella(senzaAttesa).then((arrivata) => arrivata.caricaFrasi(lingua));
const frasiPronte = (lingua: string) => campanella?.frasiPronte(lingua);

// La cornice di Zeiras per i frontend: l'`AppShell` del design system così com'è, riempita da zr-core. Il frontend dà la pagina,
// il prodotto aperto con le sue voci e i dati della parte server (`Cornice::dati()`); zr-core mette il menu Moduli dal
// registro, incrociato con lo stato dei prodotti nel workspace, gli indirizzi del workspace, i testi della lingua, e dove
// portano account, notifiche e risultati della ricerca (linea guida 15).

// Le props facoltative della cornice e le chiavi facoltative dei suoi dati accettano `undefined` (`?: T | undefined`): un
// frontend con `exactOptionalPropertyTypes` le può scrivere così. Le voci di `nav` no (`GruppoDiVoci`): hanno la forma che
// vuole l'`AppShell`, e per i tipi del design system una chiave facoltativa manca. Per questo la cornice dà all'`AppShell`
// una chiave solo quando ha un valore (`senzaUndefined`, più sotto).

/** I dati della cornice, come li dà `Cornice::dati()` della parte server: la persona, la sua lingua, il workspace in cui è entrata. */
export interface DatiDellaCornice {
    /** La lingua della persona (`it`, `es`, `en`…): in una lingua che zr-core non ha, la cornice è in inglese. */
    lingua: string;
    /** Nell'avatar e in cima al menu del profilo. */
    persona: { nome: string; email: string };
    /** Il nome sta in cima alla sidebar, come testo; lo slug in ogni indirizzo dei prodotti. */
    workspace: { nome: string; slug: string };
    /**
     * Lo stato di ogni prodotto nel workspace (app.elenca): un prodotto che manca è «Presto». Nei dati ridotti
     * (`accettazione_richiesta`) la parte server li dà vuoti, e al browser arrivano come una lista vuota, `[]`: il tipo ammette
     * anche quella (dalla `v1.15.0`). È una lista che letta per id non dà niente: chi legge `prodotti.pm` non deve prima
     * chiedersi quale delle due forme ha.
     */
    prodotti: Partial<Record<IdDiProdotto, 'attivo' | 'disponibile' | 'in_arrivo' | undefined>> | (never[] & Partial<Record<IdDiProdotto, undefined>>);
    /**
     * Le aziende della persona coi loro workspace, nell'ordine dei dati: il selettore «Azienda › workspace». Senza, o se il workspace
     * dei dati non sta in nessuna, il workspace resta testo. Dall'`id` di un workspace viene il tono del suo pallino
     * (`tonoDelWorkspace`): è facoltativo, perché i dati scritti a mano nei test di un frontend restino validi, e senza non c'è tono.
     * `nuovo_workspace` dice se la persona può creare un workspace in quell'azienda: lo ricava la parte server dal suo ruolo, che
     * al browser non arriva. Solo con `true` nell'azienda del workspace dei dati il selettore ha in fondo «Nuovo workspace».
     */
    aziende?: { id: string; nome: string; workspace: { id?: string | undefined; nome: string; slug: string }[]; nuovo_workspace?: boolean | undefined }[] | undefined;
    /** Le notifiche non lette nel workspace: il numero sulla campanella, «99+» oltre 99. */
    non_lette?: number | undefined;
    /**
     * Il segno della lettura: l'istante in cui la parte server ha cominciato a leggere questi dati (UTC, coi microsecondi). I
     * dati di due letture non sono mai uguali, e la cornice sa quali sono stati letti dopo: tiene i più recenti che ha visto
     * (vedi «i dati più recenti», più sotto).
     */
    aggiornati_il?: string | undefined;
    /**
     * Il segno della sessione: l'istante in cui la parte server ha letto lingua e persona dalla sessione, in `Cornice::subito()`
     * (dalla `v2.3.0`) o dal backoffice, in `Cornice::dopo()` (dalla `v2.4.0`: lì è il segno di quella lettura, e vale su
     * quello di `subito`). Dice alla cornice se la persona della pagina è più vecchia di quella che mostra: una voce della
     * cronologia ripresa con Indietro porta il `subito` di allora, e non riporta a schermo chi c'era allora. Nei dati interi
     * di `Cornice::dati()` non c'è, e lì vale il segno della lettura.
     */
    sessione_il?: string | undefined;
    /**
     * Il segno della lingua (dalla `v2.11.0`): l'istante in cui è cominciata la lettura di io.mostra che ha confermato la lingua
     * della sessione per quella persona, in `Cornice::subito()` e in `Cornice::dopo()`. Con la stessa persona `LayoutDellaCornice`
     * mostra la lingua del dato in cui è più avanti: un `subito` riletto mentre `dopo` è in lettura porta la sessione di adesso
     * ma la lingua di prima, e non la riporta a schermo. Senza, o in un'altra forma, da una parte, vale la lingua di `dopo`.
     */
    lingua_il?: string | undefined;
    /**
     * `true` se la persona non ha ancora accettato i documenti legali in vigore (dalla `v1.14.0`): la parte server lo dice
     * quando il backoffice le risponde 403 `accettazione_richiesta`, e allora `prodotti` e `aziende` sono vuoti e le non lette
     * zero perché non li ha potuti leggere, non perché non ci siano. La cornice esce ridotta, con l'avviso che porta alla
     * pagina dell'accettazione. La parte server non manda mai `false`: vale come la chiave che manca.
     */
    accettazione_richiesta?: boolean | undefined;
    /**
     * `true` finché i dati letti dal backoffice non sono arrivati (dalla `v2.1.0`): lo mette `LayoutDellaCornice` quando ha
     * `subito` e non ancora `dopo`. La cornice esce ridotta e senza avviso, con campanella e ricerca nello stato di caricamento. Se
     * la cornice ha già dati letti di quel workspace restano quelli, finché non arrivano i nuovi.
     */
    in_attesa?: boolean | undefined;
    /**
     * `true` se la parte server non ha potuto leggere il backoffice (`Cornice::dopo()`, dalla `v2.1.0`): la cornice esce
     * ridotta, con l'avviso `downTitle` sopra la pagina, senza pulsante. La parte server non manda mai `false`.
     */
    non_letti?: boolean | undefined;
}

/** I dati che la parte server legge dalla sola sessione (`Cornice::subito()`). */
export type DatiSubito = Pick<DatiDellaCornice, 'lingua' | 'persona' | 'workspace' | 'sessione_il' | 'lingua_il'>;
/**
 * I dati che la parte server legge dal backoffice (`Cornice::dopo()`), o `non_letti` col suo segno se il backoffice non ha
 * risposto — dalla `v2.7.0` anche lui con lingua, persona, workspace e `sessione_il`. Dalla `v2.4.0` dicono di chi sono: lingua, persona e il segno di quella lettura (`sessione_il`), che nel layout
 * valgono su quelli di `subito` (dalla `v2.9.0` la lingua è quella del più recente dei due, se sono della stessa persona). Tutto facoltativo: un `dopo` che non lo dice (una pagina tenuta da prima) vale come prima.
 */
export type DatiDopo = Partial<Omit<DatiDellaCornice, 'in_attesa'>>;

/** Un gruppo di voci della navigazione di un prodotto, sotto il suo pulsante. */
export interface GruppoDiVoci {
    group: string;
    items: (NavItem & { tone?: Exclude<Tone, 'neutral'> })[];
}

export interface CorniceProps {
    /** I dati della parte server: `Cornice::dati()`. */
    dati: DatiDellaCornice;
    /** Il prodotto aperto, un id del registro (`pm`, `crm`, `bookings`…). Senza, la pagina è di app.zeiras.com e il menu Moduli è esteso. */
    product?: string | undefined;
    /** Le voci del prodotto aperto. */
    nav?: GruppoDiVoci[] | undefined;
    /**
     * L'id della voce attiva; senza, o vuoto, la Dashboard — tranne nello stato ridotto su una pagina di un modulo, dove nessuna
     * voce è segnata. Con `null` nessuna voce della barra è attiva.
     */
    active?: string | null | undefined;
    onNavigate?: ((id: string) => void) | undefined;
    /** Il percorso Workspace › Cartella › Oggetto: l'ultima voce è la pagina. */
    crumbs?: ShellCrumb[] | undefined;
    onCrumb?: ((voce: ShellCrumb, indice: number) => void) | undefined;
    /** Le voci del menu «+»: i tipi che il prodotto crea. */
    create?: MenuItem[] | undefined;
    /** Altro in topbar. */
    actions?: ReactNode;
    /** L'area della pagina senza margine (la board). */
    flush?: boolean | undefined;
    /** «Esci»: la sessione la chiude il frontend, ovunque. Obbligatorio: senza, «Esci» non farebbe niente. */
    onLogout: () => void;
    /** Come si apre un indirizzo: di norma il browser ci va. */
    naviga?: ((indirizzo: string) => void) | undefined;
    /**
     * La voce «Piano» nel menu del profilo. Spenta di default: i piani non esistono ancora, e la voce porterebbe a una pagina
     * che non c'è. Il frontend la accende quando la pagina del piano esiste su app.zeiras.com.
     */
    piano?: boolean | undefined;
    children?: ReactNode;
}

/** La Dashboard: il registro la porta sempre, per prima. */
const dashboard = registro.find((voce) => voce.id === 'home')!;

/**
 * Un id che nessuna di quelle voci ha. L'`AppShell` segna la voce che ha l'id attivo, e senza un id la Dashboard: «nessuna» gli
 * si dice con un id che non è di nessuna. Si calcola dalle voci di quel render, e non è un valore fisso: un frontend potrebbe
 * dare una voce proprio con quell'id. È fatto di soli trattini, perché una voce la cornice non la vede: «Impostazioni», che
 * l'`AppShell` mette da sé in fondo alla barra, e il suo id è una parola.
 */
function idDiNessunaVoce(gruppi: { items: { id: string }[] }[]): string {
    const presi = new Set(gruppi.flatMap((gruppo) => gruppo.items.map((voce) => voce.id)));
    let id = '-';
    while (presi.has(id)) {
        id += '-';
    }

    return id;
}

/** Le pagine di account, azienda e notifiche: stanno su app.zeiras.com, l'indirizzo della Dashboard. */
const pagineDiApp: Record<Exclude<AccountAction, 'logout'> | 'notifiche', string> = {
    profile: '/impostazioni/profilo',
    settings: '/impostazioni/preferenze',
    plan: '/azienda/impostazioni/piano',
    company: '/azienda',
    notifiche: '/notifiche',
};

/** La pagina di zr-home da cui si crea un workspace: sta dentro un workspace, dopo il suo slug. */
const paginaNuovoWorkspace = '/nuovo-workspace';

/**
 * La pagina di zr-home in cui si accettano i documenti legali in vigore: sta su app.zeiras.com, fuori da un workspace e fuori
 * dalla cornice, e dopo l'accettazione rimanda all'indirizzo di `ritorno`, se lo prende (senza, alla Dashboard).
 */
const paginaDellAccettazione = '/legale/accetta';

/**
 * Il menu del profilo senza «Piano»: la lista che l'`AppShell` mette da sé, tolta quella voce. L'`AppShell` non ha un modo per
 * toglierne una sola e prende la lista intera (`accountItems`): icone, testi e ordine sono i suoi, e un test li confronta coi
 * suoi, perché il design system può cambiarli.
 */
function menuDelProfiloSenzaPiano(t: TestiDellaCornice, suAccount: (azione: AccountAction) => void): MenuItem[] {
    return [
        { icon: 'user', label: t.profile, onClick: () => suAccount('profile') },
        { icon: 'settings', label: t.accountSettings, onClick: () => suAccount('settings') },
        { icon: 'building', label: t.company, onClick: () => suAccount('company') },
        { sep: true },
        { icon: 'arrow', label: t.logout, onClick: () => suAccount('logout') },
    ];
}

/** Il tipo di un oggetto senza le chiavi che valgono `undefined`: quelle che possono valerlo diventano facoltative, e `undefined` esce dal loro tipo. */
type SenzaUndefined<T> = { [K in keyof T as undefined extends T[K] ? never : K]: T[K] } & { [K in keyof T as undefined extends T[K] ? K : never]?: Exclude<T[K], undefined> };

/**
 * Un oggetto senza le chiavi che valgono `undefined`, nello stesso ordine: ciò che la cornice dà all'`AppShell`. Per i tipi del
 * design system una chiave facoltativa manca, non vale `undefined` (`exactOptionalPropertyTypes`), e l'`AppShell` legge allo
 * stesso modo una chiave che manca e una che vale `undefined`: nessun valore cambia, e non arriva una chiave in più.
 */
function senzaUndefined<T extends object>(oggetto: T): SenzaUndefined<T> {
    return Object.fromEntries(Object.entries(oggetto).filter(([, valore]) => valore !== undefined)) as SenzaUndefined<T>;
}

/**
 * Un workspace dei dati come lo vuole il selettore dell'`AppShell`: col tono del suo id (tono.ts), mai del nome, dello slug o del
 * posto nell'elenco. Senza id nessun tono, nemmeno la chiave: il pallino è quello che l'`AppShell` mette da sé.
 */
function nelSelettore(workspace: { id?: string | undefined; nome: string; slug: string }): ShellWorkspace {
    const tone = tonoDelWorkspace(workspace.id);

    return senzaUndefined({ slug: workspace.slug, name: workspace.nome, tone });
}

/**
 * Quando è arrivata una notifica, come le date del design system: «ora», «5 minuti fa», «3 ore fa», «ieri», poi «1 ott» (con
 * l'anno se non è quest'anno). Un istante che non si legge non ha ora.
 */
function quando(istante: string, lingua: string | undefined, adesso: Date): string | undefined {
    const data = new Date(istante);
    if (isNaN(+data)) {
        return undefined;
    }
    const secondi = (+adesso - +data) / 1000;
    const relativa = new Intl.RelativeTimeFormat(lingua, { numeric: 'auto' });
    if (secondi < 60) {
        return relativa.format(0, 'second');
    }
    if (secondi < 3600) {
        return relativa.format(-Math.floor(secondi / 60), 'minute');
    }
    const mezzanotte = (giorno: Date) => new Date(giorno).setHours(0, 0, 0, 0);
    const giorni = Math.round((mezzanotte(adesso) - mezzanotte(data)) / 86_400_000);
    if (giorni === 0) {
        return relativa.format(-Math.floor(secondi / 3600), 'hour');
    }
    if (giorni === 1) {
        return relativa.format(-1, 'day');
    }

    return new Intl.DateTimeFormat(lingua, { day: 'numeric', month: 'short', year: data.getFullYear() === adesso.getFullYear() ? undefined : 'numeric' }).format(data);
}

/**
 * Una notifica della parte server nel pannello: il titolo e l'ora, nella lingua dei testi. Il titolo e la riga di sotto li dà
 * `rigaConLeFrasi`, con le frasi di quella lingua: per una notifica con chi ha fatto, una frase con chi e, dove il backoffice ne dà
 * il nome, che cosa. Di che
 * prodotto è lo dice `app`, se è il codice di un prodotto del registro: il nome viene dalle lingue, icona e tono dal registro,
 * anche per un prodotto «Presto» o non attivo nel workspace. Ogni altro `app` — `null`, un codice che il registro non ha, la
 * Dashboard — non porta prodotto: la campanella e il tono neutro del design system, mai il codice. Quando il backoffice li
 * manda, il nome della cosa è la seconda riga (`risorsaDellaNotifica`: di un'app il nome del prodotto, mai il codice) e quello
 * di chi ha fatto dà l'avatar, al posto dell'icona. `per_me` dice la scheda: `false` solo in «Tutte»; `true`, o un backoffice
 * che non lo dice (`null`, la chiave che manca), in «Per me» come in «Tutte» — `forMe` allora non arriva all'`AppShell`, e non
 * è mai `false` per una notifica di cui non si sa.
 */
function nelPannello(notifica: NotificaDellaCornice, riga: { titolo: string; sotto?: string }, lingua: string, adesso: Date): ShellNotification {
    const delProdotto = prodottoDelRegistro(notifica.app);

    return senzaUndefined({
        id: notifica.id,
        title: riga.titolo,
        text: riga.sotto,
        actor: nomePulito(notifica.autore_nome),
        forMe: typeof notifica.per_me === 'boolean' ? notifica.per_me : undefined,
        time: quando(notifica.creata_il, linguaDeiTesti(lingua), adesso),
        product: delProdotto && nomeDellaVoce(delProdotto, lingua),
        icon: delProdotto?.icona,
        tone: delProdotto?.tono,
        unread: !notifica.letta,
    });
}

/**
 * La `creata_il` dell'istante più avanti fra le notifiche caricate, così com'è: fin lì arriva «Segna tutte come lette». Si
 * confrontano gli istanti, non le stringhe: l'elenco può avere fusi diversi, e la più recente può non essere la prima. Una
 * `creata_il` che non si legge non conta; senza nessuna che si legge non c'è un istante.
 */
function piuRecente(elenco: NotificaDellaCornice[]): string | undefined {
    let scelta: string | undefined;
    let istante = -Infinity;
    for (const { creata_il: creataIl } of elenco) {
        const questo = +new Date(creataIl);
        if (questo > istante) {
            scelta = creataIl;
            istante = questo;
        }
    }

    return scelta;
}

/** Una cosa che la cornice ha saputo da una rotta: i dati che aveva quando l'ha chiesta, e l'istante che la parte server ha dato alla risposta, se lo dà. */
interface Saputo {
    con: DatiDellaCornice;
    il: string | undefined;
}

/**
 * Una notifica che un clic ha segnato letta (README, «Le notifiche»): ciò che la cornice ha saputo dalla rotta — i dati che aveva
 * al clic, l'istante in cui la parte server l'ha segnata — con l'elenco che era in pagina al clic (la richiesta da cui veniva),
 * il workspace di quell'elenco, come lo ha detto la parte server, e se quell'elenco non era più vecchio dei dati del clic
 * (`elencoDiQueiDati`): solo allora quei dati contavano la notifica da leggere, e la lettura ne toglie una dal loro numero.
 */
interface LettaConUnClic extends Saputo {
    id: string;
    elenco: number;
    workspace: string;
    elencoDiQueiDati: boolean;
}

/**
 * La ricerca della cornice dopo la prima parola: in volo, fallita, o arrivata. Arrivata, i risultati stanno col workspace di cui
 * sono, come lo dice la parte server: è lì che si aprono, e dei risultati senza il loro workspace non hanno un indirizzo.
 * Si esporta per i casi (`cornice.test.tsx`): non è dell'ingresso, e `index.ts` non lo riesporta.
 */
export type StatoDellaRicerca = { stato: 'loading' | 'error' } | { stato: 'ready'; risultati: RisultatoDellaRicerca[]; workspace: string };

/**
 * Chiede il pezzo della ricerca (`./ricerca`) al primo fuoco nel campo: chi sta per scrivere lo trova arrivato, e chi non
 * cerca non lo scarica. Se non arriva qui non succede niente: lo richiede la prima parola (`cercaParola`), passata l'attesa
 * che segue un pezzo non arrivato (`pezzoARichiesta`, dalla `v2.11.5`). Nell'attesa nemmeno questo fuoco lo richiede.
 */
const alFuoco = () => void chiediLaRicerca().catch(() => undefined);

/**
 * I dati non sono più recenti di ciò che la cornice ha saputo da una rotta: sono dello stesso workspace e, se c'è un istante
 * da tutte e due le parti, il segno dei dati è lo stesso o più indietro. Senza un istante da una parte non si confronta
 * niente: vale solo per i dati con cui la rotta è stata chiesta. È un'altra regola da quella dei dati tenuti (`Cornice`): lì, fra due dati
 * con lo stesso segno, vale la pagina; qui, a pari istante, vale ciò che la rotta ha detto.
 */
function nonPiuRecentiDi(dati: DatiDellaCornice, saputo: Saputo | undefined): boolean {
    if (saputo === undefined || dati.workspace.slug !== saputo.con.workspace.slug) {
        return false;
    }
    const deiDati = segno(dati.aggiornati_il);

    // Un confronto con `undefined` è sempre falso, e un segno, quando c'è, non è mai un testo vuoto.
    return deiDati! <= saputo.il! || (!(deiDati && saputo.il) && saputo.con === dati);
}

/**
 * I dati non sono più recenti di quelli con cui la cornice ha chiesto una rotta: sono quelli, o sono dello stesso workspace e,
 * col segno da tutte e due le parti, il loro è lo stesso o più indietro. È più stretta di `nonPiuRecentiDi`, che guarda
 * l'istante della risposta: fra la richiesta e la risposta c'è una finestra, e dei dati letti lì non si sa se vedono già ciò
 * che la rotta ha fatto — il loro segno è preso prima della lettura dal backoffice, l'istante della risposta dopo. Questi
 * invece sono stati letti prima che la rotta fosse chiesta, e non lo vedono di certo.
 */
function nonPiuRecentiDeiDatiDi(dati: DatiDellaCornice, saputo: Saputo): boolean {
    return saputo.con === dati || (dati.workspace.slug === saputo.con.workspace.slug && segno(dati.aggiornati_il)! <= segno(saputo.con.aggiornati_il)!);
}

/**
 * Porta il fuoco al contenuto della pagina: il `main` dell'`AppShell`, che non ha un `id` e di suo non prende il fuoco. Si
 * trova dal pulsante — l'`AppShell` è accanto al suo contenitore —, non dal documento: un frontend può avere un `main` suo.
 * Gli si dà `tabindex="-1"` solo per il salto, e glielo si toglie quando il fuoco lo lascia: del `main` la cornice non
 * cambia altro, e un `tabindex` che ha già resta com'è. Il `blur` arriva anche quando è la finestra a perdere il fuoco, e lì
 * il `main` resta l'elemento attivo: l'attributo resta, o al ritorno il `main` non terrebbe più il fuoco.
 */
function fuocoAlContenuto(dalSalto: HTMLElement | null): void {
    const main = dalSalto?.parentElement?.querySelector<HTMLElement>(':scope > .zr-shell > main.zr-main');

    if (!main) {
        return;
    }
    if (!main.hasAttribute('tabindex')) {
        const alBlur = (): void => {
            if (main.ownerDocument.activeElement !== main) {
                main.removeAttribute('tabindex');
                main.removeEventListener('blur', alBlur);
            }
        };

        main.setAttribute('tabindex', '-1');
        main.addEventListener('blur', alBlur);
    }
    main.focus();
}

/**
 * «Salta al contenuto», prima di tutto ciò che è dell'`AppShell`: senza il fuoco ha la classe del design system che nasconde,
 * col fuoco sta in alto a sinistra sopra la cornice, coi soli token. Lo stato è suo: il fuoco che entra e che esce non rifà
 * la cornice. È provvisorio: si toglie quando l'`AppShell` porta il suo.
 */
function SaltaAlContenuto({ testo }: { testo: string }) {
    // Si vede solo mentre ha il fuoco.
    const [colFuoco, setColFuoco] = useState(false);
    const contenitore = useRef<HTMLDivElement>(null);

    return (
        <div
            ref={contenitore}
            {...(colFuoco ? { style: { position: 'fixed', top: 'var(--space-2)', left: 'var(--space-2)', zIndex: 'var(--z-toast)' } } : { className: 'zr-visually-hidden' })}
            onFocus={() => setColFuoco(true)}
            onBlur={() => setColFuoco(false)}
        >
            <Button variant="secondary" size="sm" onClick={() => fuocoAlContenuto(contenitore.current)}>{testo}</Button>
        </div>
    );
}

/**
 * Lo stato dei moduli per una notifica di un altro workspace: quello dei dati della pagina è di un altro workspace, e non dice
 * niente di lì. Ogni modulo del registro si apre come uno `disponibile`, e se in quel workspace non è attivo lo dice il modulo,
 * come quando lo si apre dal menu. Un modulo «Presto» resta senza destinazione: quello lo dice il registro, non i dati.
 */
const inUnAltroWorkspace: DatiDellaCornice['prodotti'] = Object.fromEntries(registro.filter((voce) => voce.id !== 'home').map((voce) => [voce.id, 'disponibile']));

export function Cornice(props: CorniceProps) {
    // I dati più recenti che la cornice ha visto. La pagina può darne di più vecchi di quelli che la cornice ha già: con Indietro
    // e Avanti del browser tornano i dati di allora, e una risposta letta prima può arrivare dopo (una visita lenta, una pagina
    // che il `prefetch` di Inertia teneva). I dati della pagina valgono sempre, tranne quando sono stati letti prima di quelli
    // tenuti (sotto). Si decide mentre si rende, non in un effetto: la cornice non si vede mai coi dati più vecchi, nemmeno per
    // un render.
    const [tenuti, setTenuti] = useState(props.dati);

    // Chi è entrato e la sua lingua li dice la pagina: la persona può aver cambiato nome o lingua da un'altra scheda, o la sessione
    // può essere passata a un'altra. Tranne quando la pagina è più vecchia di chi la cornice mostra: lo dice il segno della
    // sessione (`sessione_il`, o quello della lettura nei dati interi), e allora resta chi c'è. Con Indietro la voce della
    // cronologia porta il `subito` di allora, anche quando il suo `dopo` è riletto: senza questo tornerebbero nome ed email di
    // chi c'era allora. Senza un segno da una parte vale la pagina, se è della stessa persona: un confronto con `undefined` è
    // sempre falso.
    const [mostrato, setMostrato] = useState(props.dati);
    const della = (questi: DatiDellaCornice) => segno(questi.sessione_il ?? questi.aggiornati_il)!;
    // Senza il segno da tutte e due le parti la pagina di un'altra persona non si può dire più vecchia né più nuova di chi la
    // cornice mostra: con Indietro sarebbe di chi c'era prima, per intero. Non se ne mostra niente, nemmeno per un disegno — si
    // esce prima di tenere qualcosa —, e la pagina si ricarica: ricaricata, è di chi è entrato (dalla `v2.8.0`). La stessa
    // persona senza segno resta com'era: vale la pagina.
    if (!(props.dati.persona.email === mostrato.persona.email || (della(props.dati) && della(mostrato)))) {
        return location.reload() as undefined;
    }
    const chi = della(mostrato) > della(props.dati) ? mostrato : props.dati;

    // La pagina è della persona mostrata fin qui (la stessa email), o i suoi dati sono stati letti dopo la sessione di chi la
    // cornice mostra (il `dopo` che Inertia richiede quando alla voce manca: è di chi è entrato, sotto il `subito` di allora).
    // Allora sono letti prima di quelli tenuti se sono dello stesso workspace e, col segno da tutte e due le parti, il loro è
    // più indietro; con lo stesso segno no: è la stessa lettura, e un contenuto diverso lo ha messo il frontend nel browser.
    // Senza un segno da una parte, o fra due workspace, non si può dire, e vale la pagina: un confronto con `undefined` è sempre
    // falso. Dei dati `in_attesa` lasciano quelli tenuti, se questi non lo sono. Altrimenti la pagina è di un'altra persona:
    // se è lei a essere entrata adesso valgono i suoi dati, ridotti come sono; se è più vecchia di chi la cornice mostra
    // (Indietro) i suoi dati sono quelli di allora e non valgono, nemmeno quando la voce della cronologia li porta interi e chi
    // è entrato aspetta ancora i propri. Restano i tenuti, che sono di chi è entrato.
    const dati = (props.dati.persona.email === mostrato.persona.email || segno(props.dati.aggiornati_il)! > della(mostrato) ? tenuti.workspace.slug === props.dati.workspace.slug && (props.dati.in_attesa ? !tenuti.in_attesa : segno(props.dati.aggiornati_il)! < segno(tenuti.aggiornati_il)!) : chi === mostrato) ? tenuti : props.dati;
    if (dati !== tenuti) {
        setTenuti(dati);
    }
    if (chi !== mostrato) {
        setMostrato(chi);
    }

    // La `key` è l'email di chi è entrato: ciò che la cornice tiene (i dati di prima, l'elenco delle notifiche, la ricerca coi suoi
    // risultati e la sua parola, i pannelli aperti) è della persona che lo ha visto. Se la sessione passa a un'altra sullo stesso
    // workspace — da un'altra scheda, o uscendo ed entrando — la cornice si rifà, e la pagina con lei: niente di chi c'era prima
    // resta sotto il nome nuovo, nemmeno per un disegno. Sta qui e non nel layout: vale anche per chi monta `Cornice` da sé.
    return <DiUnaPersona key={chi.persona.email} {...props} dati={dati} chi={chi} />;
}

/** La cornice di una persona: `dati` sono quelli che valgono (sopra), `chi` dice il nome e la lingua di adesso. */
function DiUnaPersona({ dati, chi: { lingua, persona }, product, nav = [], active, onLogout, naviga = (indirizzo) => location.assign(indirizzo), piano = false, ...pagina }: CorniceProps & { chi: Pick<DatiDellaCornice, 'lingua' | 'persona'> }) {
    // Chi non ha accettato i documenti legali in vigore vede la cornice ridotta. Lo dicono i dati (`accettazione_richiesta`), o
    // lo ha detto una rotta della cornice, col suo 403, mentre la cornice aveva questi dati: il segnale arriva fuori dal render
    // (`loDiceUnaRotta`) e si lega qui ai dati di quel momento, mentre si rende. Vale finché i dati della cornice non sono più
    // recenti di quelli: sono quell'oggetto, o sono dello stesso workspace e il loro segno non è più avanti — un frontend può
    // ricrearli a ogni disegno, o ritoccarli nel browser lasciando il segno, ed è la stessa lettura. Coi dati letti dopo, se non
    // lo dicono, la cornice torna quella di sempre. `false` vale come la chiave che manca. La prima volta che il segnale non
    // vale per i dati della cornice — letti dopo, o di un altro workspace — si toglie: non torna a valere coi dati di prima,
    // quando un frontend tiene la cornice montata fra due workspace e la persona torna indietro. Se serve ancora, lo ridice la
    // prima rotta che risponde.
    const [loDiceUnaRotta, setLoDiceUnaRotta] = useState(false);
    const [daAccettareCon, setDaAccettareCon] = useState<DatiDellaCornice>();
    const loDiceIlSegnale = daAccettareCon !== undefined && nonPiuRecentiDeiDatiDi(dati, { con: daAccettareCon, il: undefined });
    if (loDiceUnaRotta) {
        setLoDiceUnaRotta(false);
        setDaAccettareCon(dati);
    } else if (daAccettareCon !== undefined && !loDiceIlSegnale) {
        setDaAccettareCon(undefined);
    }
    const daAccettare = dati.accettazione_richiesta === true || loDiceIlSegnale;
    // Ridotta anche finché i dati letti dal backoffice non arrivano (`in_attesa`) e quando la parte server non li ha potuti
    // leggere (`non_letti`): senza moduli, con campanella e ricerca spente. L'accettazione vince su tutti e due.
    // Il valore è lo stato che l'`AppShell` ha per ciò che campanella e ricerca dicono allora: in attesa niente è andato
    // storto, i dati stanno arrivando, ed è il caricamento; con `non_letti` e con l'accettazione, dove non sta arrivando
    // niente, l'errore. `undefined` nella cornice di sempre.
    const ridotta = daAccettare || dati.non_letti ? 'error' : dati.in_attesa ? 'loading' : undefined;
    // L'errore di una chiamata a una rotta della cornice: solo quel 403 porta allo stato ridotto. Che cos'altro fare
    // dell'errore lo decide chi ha chiamato, come prima.
    const seDaAccettare = (errore: unknown) => {
        if (errore instanceof AccettazioneRichiesta) {
            setLoDiceUnaRotta(true);
        }
    };
    const t = testi(lingua);
    // I due testi della ricerca: il segnaposto, uno solo dove la ricerca ha delle fonti, e l'invito, che dice che cosa si può
    // cercare. Le fonti sono i tipi di risorsa dei moduli attivi nel workspace dei dati e, dopo, i membri del workspace, che ci
    // sono anche senza moduli attivi. Nello stato ridotto nessuna: i moduli non si mostrano e la ricerca è spenta, anche quando
    // i dati li dicono ancora attivi.
    const fonti = ridotta ? [] : fontiDellaRicerca(dati.prodotti);
    // Composti una volta per lingua e per elenco di fonti: `fonti` è un elenco nuovo a ogni disegno, e conta ciò che contiene.
    const quali = fonti.join();
    const dellaRicerca = useMemo(() => testiDellaRicerca(lingua, fonti), [lingua, quali]);
    // Un prodotto che il registro non ha, o la Dashboard, è una pagina di app.zeiras.com: menu esteso.
    const aperto = prodottoDelRegistro(product);
    const prodotti = {
        group: t.products,
        products: true,
        // A chi non ha accettato i documenti legali resta la sola Dashboard: gli altri moduli il backoffice non li ha dati, e
        // con la lista vuota sarebbero tutti «Presto».
        items: registro.filter((voce) => !ridotta || voce === dashboard).map((voce) => {
            // «Presto» è un prodotto futuro: per il registro, o perché il backoffice non lo dà `attivo` né `disponibile` (in
            // arrivo, non elencato, o in uno stato che zr-core non conosce). Uno `disponibile` porta alla sua pagina, che dice
            // che non è attivo nel workspace (linea guida 15). La Dashboard non ha uno stato: porta sempre. `in_arrivo` del
            // registro qui non si legge: è per le pagine senza sessione, e un prodotto in anteprima si apre dove il backoffice lo dà.
            const presto = voce.id !== 'home' && (voce.presto || !raggiungibile(dati.prodotti[voce.id]));

            return senzaUndefined({
                id: voce.id,
                label: nomeDellaVoce(voce, lingua),
                icon: voce.icona,
                tone: voce.tono,
                home: voce === dashboard,
                soon: presto,
                // Un prodotto «Presto» non porta da nessuna parte; quello aperto, al clic, chiude solo la lista.
                href: presto || voce === aperto ? undefined : nelWorkspace(voce.indirizzo, dati.workspace.slug),
            });
        }),
    };

    // Il selettore «Azienda › workspace» solo se il workspace dei dati sta in un'azienda: altrimenti l'`AppShell` segnerebbe attivo
    // il primo workspace della prima, e il workspace resta testo. Il tono di ogni workspace viene dal suo id (il backoffice non dà
    // grafica). L'azienda del workspace è l'ultima che lo ha: la stessa che l'`AppShell` mostra in cima al selettore.
    const delWorkspace = dati.aziende?.filter((azienda) => azienda.workspace.some((ws) => ws.slug === dati.workspace.slug)).at(-1);
    const companies = delWorkspace
        ? dati.aziende?.map((azienda) => ({ id: azienda.id, name: azienda.nome, workspaces: azienda.workspace.map(nelSelettore) }))
        : undefined;
    // «Nuovo workspace» in fondo al selettore solo se la parte server dice che la persona può crearne uno in quell'azienda: proprio
    // `true`, perché i dati di una parte server di prima non lo dicono. Apre la pagina di zr-home nel workspace dei dati, che è
    // una pagina di app.zeiras.com anche da un prodotto: il dialogo è suo, e se la persona può davvero lo decide il backoffice.
    const nuovoWorkspace = delWorkspace?.nuovo_workspace === true ? () => naviga(nelWorkspace(dashboard.indirizzo, dati.workspace.slug) + paginaNuovoWorkspace) : undefined;

    // Le notifiche si caricano a ogni apertura del pannello, non con la pagina. Conta l'ultima richiesta partita: una più vecchia
    // che risponde dopo non sovrascrive la lista. Dell'ultimo elenco arrivato restano le non lette, coi dati che la cornice aveva
    // quando è stato chiesto e l'istante in cui la parte server lo ha letto: un elenco è più recente del numero dei dati letti
    // fino a quell'istante, e più vecchio dei dati letti dopo. Restano anche mentre il pannello si ricarica, o se il
    // caricamento fallisce.
    //
    // Quali dati sono più recenti lo dicono gli istanti della parte server: il segno dei dati (`aggiornati_il`) contro quello
    // dell'elenco e quello di «Segna tutte come lette» (`nonPiuRecentiDi`). Senza un istante da una parte — dati senza segno, una
    // rotta che non lo dà — «dati nuovi» vuol dire un altro oggetto `dati`, come prima che la cornice confrontasse i segni; e
    // lì, con la cornice montata fra una visita e l'altra, Inertia ridà alla pagina l'oggetto di prima quando i dati della
    // visita sono uguali in profondità.
    // Con l'elenco, la richiesta da cui viene (`richiesta`): mentre il pannello si ricarica senza svuotarsi è una di prima
    // dell'ultima partita. Sta nello stato insieme all'elenco, non in un ref: un clic la prende dallo stesso disegno della
    // pagina da cui prende l'istante mandato, anche se cade fra l'arrivo di un elenco nuovo e il ridisegno.
    // E il workspace di cui è (`workspace`), come lo dice la parte server: quello della sessione, che non è sempre quello dei
    // dati della pagina (due schede su due workspace). `undefined` finché non si sa. Lo tiene anche `caricate`, con le non
    // lette dell'elenco: contano sulla campanella solo se l'elenco è del workspace dei dati (sotto).
    const [notifiche, setNotifiche] = useState<{ stato: 'ready' | 'loading' | 'error'; elenco: NotificaDellaCornice[]; richiesta: number; workspace?: string | undefined }>({ stato: 'ready', elenco: [], richiesta: 0 });
    const [caricate, setCaricate] = useState<Saputo & { nonLette: string[]; richiesta: number; workspace: string | undefined }>();
    // Che cosa dice il pulsante «Segna tutte come lette» (sotto): che la richiesta è in corso, dal clic alla risposta, e che ne
    // restano da segnare, dopo un `altre` e finché quel giro di letture non è finito — con una lettura completa, con un
    // elenco chiesto da capo, o altrove (sotto, dove dei dati letti dopo non contano più non lette). «Ne restano» è ciò che la
    // cornice ha saputo dalla risposta con `altre`: coi dati di allora e l'istante della risposta. Sono testo, e stanno nello
    // stato; il guardiano del doppio clic resta un ref, che è sincrono.
    const [inCorso, setInCorso] = useState(false);
    const [neRestano, setNeRestano] = useState<Saputo>();
    const ultimaRichiesta = useRef(0);
    // Con l'elenco partono le frasi delle notifiche della lingua di chi è entrato adesso (`caricaFrasi`; in attesa non è quella
    // dei dati tenuti): non stanno nel JS d'ingresso, e alla prima apertura arrivano dalla rete; dopo restano in memoria. Il pannello mostra l'elenco quando ha tutti e due. Se le
    // frasi non arrivano è un errore del pannello come quello dell'elenco, con «Riprova», mai un elenco di titoli di ripiego;
    // ma che la persona debba accettare i documenti legali lo può dire solo l'errore dell'elenco, che è della parte server.
    // A elenco vuoto le frasi non servono: il pannello dice che non ci sono notifiche senza aspettarle, e anche se non arrivano.
    const chiedi = (svuota: boolean, senzaAttesa?: boolean) => {
        const questa = ++ultimaRichiesta.current;
        const questi = dati;
        if (svuota) {
            setNotifiche({ stato: 'loading', elenco: [], richiesta: questa });
        }
        const chiesto = caricaNotifiche(persona.email);
        chiesto.catch(seDaAccettare);
        const frasi = caricaFrasi(lingua, senzaAttesa);
        frasi.catch(() => undefined);
        chiesto.then((arrivato) => (arrivato.elenco.length > 0 ? frasi.then(() => arrivato) : arrivato)).then(
            ({ elenco, il, workspace }) => {
                if (questa === ultimaRichiesta.current) {
                    setNotifiche({ stato: 'ready', elenco, richiesta: questa, workspace });
                    setCaricate({ con: questi, nonLette: elenco.filter((notifica) => !notifica.letta).map(({ id }) => id), il, richiesta: questa, workspace });
                }
            },
            () => {
                if (questa === ultimaRichiesta.current) {
                    setNotifiche({ stato: 'error', elenco: [], richiesta: questa });
                }
            },
        );
    };
    // Le frasi sono di una lingua, e la lingua dei dati può cambiare con l'elenco in pagina (un'altra visita, con la cornice
    // montata): quelle della lingua nuova si chiedono qui, e finché non ci sono il pannello non mostra l'elenco (sotto), così
    // non resta un titolo nella lingua di prima accanto a un'ora nella nuova. Che cosa si sa delle frasi di una lingua chieste
    // così sta nello stato: l'arrivo ridisegna il pannello, e se non arrivano il pannello è in errore, con «Riprova». A pannello
    // chiuso non si chiedono: le chiede la prossima apertura, con l'elenco. Che è aperto lo dice la pagina, perché l'`AppShell`
    // avvisa quando il pannello si apre e non quando si chiude.
    const [frasiChieste, setFrasiChieste] = useState<{ lingua: string; arrivate: boolean }>();
    const servonoLeFrasi = notifiche.stato === 'ready' && notifiche.elenco.length > 0 && frasiPronte(lingua) === undefined;
    useLayoutEffect(() => {
        if (!servonoLeFrasi || !document.querySelector('.zr-notif')) {
            return undefined;
        }
        let ancora = true;
        caricaFrasi(lingua).then(
            () => ancora && setFrasiChieste({ lingua, arrivate: true }),
            () => ancora && setFrasiChieste({ lingua, arrivate: false }),
        );

        return () => {
            ancora = false;
        };
    }, [servonoLeFrasi, lingua]);
    // Con un elenco in pagina e senza le sue frasi il pannello aspetta, o è in errore se non sono arrivate.
    const statoDelPannello = !servonoLeFrasi ? notifiche.stato : frasiChieste?.lingua === lingua && !frasiChieste.arrivate ? 'error' : 'loading';
    // Il pannello aperto e «Riprova»: l'elenco è chiesto da capo, con le frasi, e un giro di letture rimasto a metà non continua
    // da lì. «Riprova» chiede il pezzo della campanella senza l'attesa che segue un pezzo non arrivato (`senzaAttesa`).
    const carica = (senzaAttesa?: boolean) => {
        setNeRestano(undefined);
        setFrasiChieste(undefined);
        chiedi(true, senzaAttesa);
    };

    // «Segna tutte come lette» è una richiesta sola: segna le notifiche della persona nate fino alla più recente fra quelle
    // caricate, anche quelle oltre la prima pagina. Fin lì e non fino all'ora del browser: ciò che arriva dopo, mai visto,
    // resta da leggere. Alla risposta le caricate sono lette e il numero dei dati non conta più, finché i dati non sono stati
    // letti dopo l'istante in cui la parte server le ha segnate: una risposta letta prima del clic e arrivata dopo non rimette
    // il numero, e coi dati letti dopo (un'altra visita, con la cornice montata) vale il loro numero, anche se è lo stesso di
    // prima del clic. Se la richiesta fallisce non cambia niente, e il pulsante resta per riprovare. Un clic mentre è in volo
    // non ne fa partire un'altra. Se la parte server dice che ne restano (`altre`: si è fermata a un tetto) non sono tutte
    // lette: il numero resta, le notifiche in pagina non si danno per lette, e il pannello si ricarica con ciò che c'è
    // davvero, senza svuotarsi: finché l'elenco nuovo non arriva resta in pagina quello di prima, e il pulsante resta dov'è,
    // col fuoco, per il clic che continua. Che cosa sta succedendo lo dice il testo del pulsante, che la cornice dà
    // all'`AppShell` al posto del suo: che la richiesta è in corso (`markingAllRead`), e dopo un `altre` che ne restano
    // (`markRestRead`). Al lettore di schermo la cornice non lo annuncia: il pannello del design system non ha un posto per
    // un avviso (README, «Le notifiche»).
    const [segnate, setSegnate] = useState<Saputo>();
    const leStaSegnando = useRef(false);
    // I dati non sono più recenti dell'ultimo elenco arrivato: l'elenco è più recente del loro numero.
    const elencoDiQuestiDati = caricate !== undefined && nonPiuRecentiDi(dati, caricate);
    // Un clic che apre la risorsa di una notifica non letta la segna letta (sotto, `leggi`). Di ogni notifica segnata così resta
    // ciò che la rotta ha detto, una voce per notifica: vale l'ultima lettura. Nient'altro cambia nello stato: che cosa è letto,
    // e quante ne restano, si calcola da qui mentre si rende, confrontando gli istanti come per «Segna tutte come lette».
    // Una notifica è letta nell'elenco arrivato per ultimo se quell'elenco non è più recente della sua lettura: letto dalla
    // parte server prima, la dà ancora da leggere; letto dopo, vale ciò che dice (può essere tornata da leggere, da un'altra
    // scheda). Senza un istante da una parte vale solo per l'elenco che era in pagina al clic. E dal numero dei dati se ne
    // toglie una per ogni lettura partita con quei dati, o con dati più recenti di loro: letti prima del clic, la contano
    // ancora. Dai dati letti dopo il clic non si toglie niente: dopo `segnata_il` la contano già letta, e fra il clic e
    // `segnata_il` — la visita che parte col clic, mentre la lettura è in volo — non si può sapere, perché il loro segno è
    // preso prima della lettura dal backoffice e `segnata_il` dopo la sua risposta. Lì vale il loro numero: al più una in più
    // fino alla visita dopo, mai una in meno. Per un elenco non serve la stessa cautela: dare per letta una notifica due
    // volte non cambia niente, togliere due volte dal numero sì. Solo se l'elenco del clic era del workspace dei dati: con
    // due schede su due workspace quella notifica non è fra le loro. E solo se quell'elenco non era più vecchio dei dati del
    // clic: se il pannello è rimasto aperto mentre i dati cambiavano, la notifica può essere stata letta altrove nel mezzo, e
    // allora i dati la contano già letta. Lì non si sa, e vale il loro numero: al più una in più, mai una in meno.
    const [letteConUnClic, setLetteConUnClic] = useState<LettaConUnClic[]>([]);
    const conLeLetture = (letture: LettaConUnClic[]) => {
        const lettaNellElenco = (id: string) => caricate !== undefined && letture.some((una) => una.id === id && (caricate.il !== undefined && una.il !== undefined ? caricate.il <= una.il : caricate.richiesta === una.elenco));
        const elenco = notifiche.elenco.map((notifica) => (!notifica.letta && lettaNellElenco(notifica.id) ? { ...notifica, letta: true } : notifica));
        const tolteDaiDati = letture.filter((una) => una.elencoDiQueiDati && una.workspace === dati.workspace.slug && nonPiuRecentiDeiDatiDi(dati, una)).length;
        // Il numero sulla campanella viene dai dati, e non è mai meno delle non lette di un elenco più recente: una può essere
        // arrivata dopo che la parte server le ha contate, o dopo «Segna tutte come lette». Coi dati letti dopo (un'altra
        // visita, con la cornice montata) vale il loro numero, anche se è lo stesso di prima: l'elenco di prima è più vecchio.
        // Non scende sotto zero: le non lette dell'elenco, o zero, lo tengono. Senza il numero nei dati le conta il design system.
        // Le non lette di un elenco di un altro workspace non sono quelle della pagina, e non contano: con due schede su due
        // workspace la campanella resta al numero dei dati. Se la parte server non dice di chi è l'elenco (una di prima della
        // `v1.12.0`) contano come prima.
        const elencoDiQuestoWorkspace = caricate !== undefined && (caricate.workspace === undefined || caricate.workspace === dati.workspace.slug);
        const nonLette = dati.non_lette === undefined ? undefined : Math.max(nonPiuRecentiDi(dati, segnate) ? 0 : dati.non_lette - tolteDaiDati, caricate !== undefined && elencoDiQuestiDati && elencoDiQuestoWorkspace ? caricate.nonLette.filter((id) => !lettaNellElenco(id)).length : 0);

        // Con loro, il numero che la campanella mostra: quello dei dati o, senza, le non lette caricate.
        return { elenco, nonLette, sullaCampanella: nonLette ?? elenco.filter((notifica) => !notifica.letta).length };
    };
    const { elenco, nonLette, sullaCampanella } = conLeLetture(letteConUnClic);
    const unaSola = sullaCampanella === 1;
    // La richiesta parte qui, nello stesso giro del clic. Se fallisce non cambia niente in pagina; alla risposta resta ciò che la
    // rotta ha detto, coi dati e l'elenco del clic. Dà una promessa che si chiude all'esito, riuscito o no — con un errore della
    // persona a schermo —, e che resta aperta quando la risposta è di un'altra persona (`segnaLetta` si chiude allora con un
    // errore senza niente dentro): chi la aspetta per aprire la risorsa non la apre con la sessione di chi è entrato.
    const [daDire, setDaDire] = useState<string>();
    const leggi = (id: string, workspace: string) => {
        const questi = dati;
        const elencoDelClic = notifiche.richiesta;
        const elencoDiQueiDati = elencoDiQuestiDati;
        return segnaLetta(id, persona.email).then(
            ({ il }) => {
                setLetteConUnClic((prima) => [...prima.filter((una) => una.id !== id), { id, con: questi, il, elenco: elencoDelClic, workspace, elencoDiQueiDati }]);
                setDaDire(id);
            },
            // La notifica resta da leggere, e il numero com'era.
            (errore) => (errore ? seDaAccettare(errore) : new Promise(() => {})),
        );
    };
    // L'avviso per chi usa un lettore di schermo: l'`AppShell` non ha un posto per dire che il numero è cambiato, e la cornice lo
    // dice accanto, in un `role="status"` che non si vede. Parla solo quando il numero scende per una lettura fatta con un
    // clic: arrivata la risposta (`daDire`) confronta il numero con quello che sarebbe senza quella lettura, e se è sceso dice
    // il nome della campanella col numero nuovo — quello vero, anche oltre 99, dove la campanella scrive «99+» — o, a zero,
    // il testo di zr-core. Tace quando il numero cambia per altro (dati nuovi, un elenco arrivato, «Segna tutte come lette»),
    // e allora ciò che aveva detto si toglie: non resta in pagina a dire un numero che non è più quello. Nello stato ridotto
    // ciò che ha detto si toglie anche se il numero dei dati è lo stesso, prima di andare in pagina: la campanella non ne ha
    // più uno. Si decide mentre si rende, come per i dati tenuti (sopra).
    const [avviso, setAvviso] = useState<{ testo: string; numero: number }>();
    if (daDire !== undefined) {
        setDaDire(undefined);
        if (sullaCampanella < conLeLetture(letteConUnClic.filter((una) => una.id !== daDire)).sullaCampanella) {
            setAvviso({ numero: sullaCampanella, testo: sullaCampanella === 0 ? t.unreadNone : `${t.notifications}, ${sullaCampanella} ${unaSola ? t.unreadOne : t.unread}` });
        }
    } else if (avviso !== undefined && (ridotta || avviso.numero !== sullaCampanella)) {
        setAvviso(undefined);
    }
    // Il giro di letture può finire altrove — un'altra scheda segna le rimaste —, e allora lo dicono i dati: quelli letti dopo la
    // risposta con `altre`, se contano zero non lette. Una notifica che arriva dopo è un altro giro, con «Segna tutte come
    // lette». Non lo dice la campanella a zero: senza il numero nei dati conta le non lette in pagina, che vanno a zero anche
    // quando un elenco non arriva. E non lo dicono dei dati letti prima di quella risposta, anche se contano zero: sono più
    // vecchi di lei (una notifica arrivata a pagina aperta, con la parte server che si ferma al tetto dei secondi).
    if (neRestano !== undefined && dati.non_lette === 0 && !nonPiuRecentiDi(dati, neRestano)) {
        setNeRestano(undefined);
    }
    const finoA = piuRecente(notifiche.elenco);
    // Il pulsante c'è con la campanella che ha un numero e almeno una notifica caricata, anche se le caricate sono tutte lette:
    // le non lette stanno oltre la prima pagina. Non c'è quando la parte server dice che l'elenco è di un altro workspace (due
    // schede su due workspace): da lì non segnerebbe niente, la rotta risponde 409. Un altro rispetto ai dati di adesso, o
    // rispetto a quelli con cui l'elenco è stato chiesto, di cui il clic manda lo slug: se i dati passano al workspace
    // dell'elenco con la cornice montata, l'elenco resta chiesto coi dati di prima. Se non lo dice, il pulsante c'è. E non c'è
    // mentre il pannello mostra l'attesa o l'errore, anche quelli delle frasi di una lingua nuova.
    const segnaTutteLette = statoDelPannello !== 'ready' || finoA === undefined || caricate === undefined || !(sullaCampanella > 0) || (caricate.workspace !== undefined && (caricate.workspace !== dati.workspace.slug || caricate.workspace !== caricate.con.workspace.slug)) ? undefined : async () => {
        if (leStaSegnando.current) {
            return;
        }
        leStaSegnando.current = true;
        setInCorso(true);
        const questi = dati;
        // L'elenco in pagina al clic: è quello da cui viene l'istante mandato.
        const elencoDelClic = notifiche.richiesta;
        let il: string | undefined;
        let altre: boolean;
        try {
            // Con lo slug del workspace dei dati con cui l'elenco è stato chiesto: l'istante è delle sue notifiche. Se la
            // sessione è passata a un altro, la parte server non segna niente. E con l'email di chi è mostrato: nemmeno se
            // è passata a un'altra persona.
            ({ il, altre } = await segnaLetteFinoA(finoA, caricate.con.workspace.slug, persona.email));
        } catch (errore) {
            // Non cambia niente: il pulsante resta, per riprovare.
            seDaAccettare(errore);

            return;
        } finally {
            leStaSegnando.current = false;
            setInCorso(false);
        }
        // Il giro di letture continua se ne restano, e finisce con la lettura completa. Se la richiesta è fallita resta com'era.
        setNeRestano(altre ? { con: questi, il } : undefined);
        if (altre) {
            // Ne restano da leggere: niente è «segnato fino a qui», e le non lette dell'ultimo elenco contano finché non
            // arriva quello nuovo. Senza svuotare il pannello: il pulsante resta montato, col fuoco.
            chiedi(false);

            return;
        }
        setSegnate({ con: questi, il });
        if (ultimaRichiesta.current === elencoDelClic && elencoDiQuestiDati) {
            // Le caricate sono lette dall'istante della lettura: per i dati letti fin lì non ce ne sono di non lette.
            setNotifiche((prima) => ({ ...prima, elenco: prima.elenco.map((notifica) => ({ ...notifica, letta: true })) }));
            setCaricate({ con: questi, nonLette: [], il, richiesta: elencoDelClic, workspace: caricate.workspace });
        } else {
            // Un elenco è stato chiesto dopo quello del clic — il pannello ricaricato fra il clic e la risposta, o che si
            // stava già ricaricando al clic, dopo un `altre` — e quell'elenco è di prima della lettura; oppure l'elenco del
            // clic era più vecchio dei dati (cambiati a pannello aperto), e l'istante mandato non copre ciò che è arrivato
            // dopo. Si ricarica, invece di dare per lette quelle in pagina; e le non lette di quell'elenco non contano più
            // sulla campanella, perché la lettura le ha coperte: conteranno quelle dell'elenco che arriva.
            setCaricate(undefined);
            carica();
        }
    };
    // Il testo del pulsante nel suo momento. La richiesta in corso viene prima: il clic che continua dopo un `altre` è in corso.
    const sulPulsante = inCorso ? t.markingAllRead : neRestano !== undefined ? t.markRestRead : t.markAllRead;
    const adesso = new Date();
    // Le frasi della lingua dei dati, se sono in memoria. Con un elenco in pagina e senza le sue frasi il pannello aspetta, o è
    // in errore se non sono arrivate (sopra).
    const frasi = frasiPronte(lingua);
    const riga = campanella?.rigaConLeFrasi;

    // La ricerca: una richiesta sola in volo. Una parola nuova annulla quella di prima, e conta solo l'ultima partita: una
    // risposta che arriva tardi, anche di una richiesta annullata, non sostituisce mai quella della parola più recente. Fa
    // eccezione il 429: il freno vale per ogni parola, e anche quello di una richiesta che non è più l'ultima annulla quella in
    // volo e mette l'errore al posto dei suoi risultati (più sotto). Alla
    // parte server vanno i primi 100 caratteri (code point, come `mb_strlen`): oltre risponderebbe 422, e sarebbe un errore.
    // Coi risultati, il workspace di cui sono (`workspace`), come lo dice la parte server: quello della sessione, che non è
    // sempre quello dei dati della pagina (due schede su due workspace). Un risultato si apre lì; una risposta che non lo dice è
    // un errore della ricerca, perché non c'è una pagina di ripiego: mai i risultati aperti nel workspace della pagina a tentoni.
    // Lo stato è un'unione: dei risultati stanno sempre col loro workspace. `undefined` finché non si è cercato niente, e di
    // nuovo dopo lo stato ridotto, che la dimentica: per l'`AppShell` è una ricerca pronta, senza risultati.
    const [ricerca, setRicerca] = useState<StatoDellaRicerca>();
    const ricercaInVolo = useRef<AbortController>(undefined);
    // L'`AppShell` aspetta 300 ms dall'ultimo tasto e poi chiama la `onSearch` che aveva a quel tasto, non l'ultima: se nel
    // mezzo la cornice è passata allo stato ridotto, la ricerca di prima arriva qui lo stesso. Che cosa vale adesso lo dice un
    // ref, scritto a ogni disegno andato in pagina: nello stato ridotto nessuna richiesta parte.
    // In attesa la parola non parte — i dati che servono alla ricerca non ci sono ancora —, e l'`AppShell` non ha `onSearch`
    // (sotto): nessun suo timer resta in sospeso oltre l'arrivo. La parola è stato dell'`AppShell`, e la cornice non la tiene:
    // quando i dati arrivano legge ciò che c'è nel suo campo in quel momento — quello nell'intestazione dell'`AppShell`, non
    // un campo di ricerca della pagina —, e lo cerca subito, prima che la pagina sia disegnata: una parola cancellata non
    // parte, e sotto una appena battuta non si legge «Nessun risultato». Parte solo se nel campo c'è altro da ciò che c'era
    // quando l'attesa è cominciata (`diPrima`, riscritto a ogni disegno fuori dall'attesa): l'`AppShell` non svuota il campo
    // quando si sceglie un risultato, e una parola rimasta da una ricerca di prima partirebbe a ogni arrivo dei dati. Dov'è
    // il fuoco non conta: chi ha scritto e guarda un'altra finestra trova la sua parola cercata. Se al posto dei dati arriva
    // `non_letti` o l'accettazione non parte niente.
    const ridottaAdesso = useRef(ridotta);
    const diPrima = useRef<string>(undefined);
    useLayoutEffect(() => {
        const campo = document.querySelector<HTMLInputElement>('.zr-top .zr-search input');
        const parola = campo?.value.trim();
        // La stessa funzione a ogni disegno: sul campo resta un ascolto solo.
        campo?.addEventListener('focus', alFuoco);
        if (ridottaAdesso.current !== 'loading') {
            diPrima.current = parola;
        }
        ridottaAdesso.current = ridotta;
        if (!ridotta) {
            if (parola?.length! > 1 && parola !== diPrima.current) {
                cercaParola(parola!);
            }

            return;
        }
        ricercaInVolo.current?.abort();
        ricercaInVolo.current = undefined;
    });
    // I rimedi provvisori di tastiera (`rimedi.ts`) arrivano a cornice montata, fuori dal JS d'ingresso: qui resta solo la
    // riga che li chiede. Se il pezzo non arriva la cornice resta quella di prima, senza un errore in console.
    useLayoutEffect(() => {
        // Chi è a schermo lo dice la cornice montata, e smontata lo toglie (`mostra(undefined, era)`), se è ancora lei: con una
        // seconda cornice montata dopo, a schermo resta quella (dalla `v2.11.5`). La `key` è l'email, quindi questa cornice è di
        // una persona sola. Sta in un effetto e non nel disegno: un disegno abbandonato non lo scrive.
        // Smontata, annulla anche la sua ricerca in volo (dalla `v2.11.2`): rifatta con la stessa persona, `aSchermo` torna uguale
        // e `cercaPer` da solo farebbe partire la parola di prima; a fermarla è questo annullo, che non si toglie per i byte.
        mostra(persona.email);
        void import('./rimedi').catch(() => undefined);

        return () => (mostra(undefined, persona.email), ricercaInVolo.current?.abort());
    }, []);
    // Passata allo stato ridotto la cornice dimentica la ricerca: la richiesta in volo è annullata e non è più di nessuno, così
    // la sua risposta, se arriva lo stesso, non entra nello stato; e ciò che c'era si toglie. Tornata quella di sempre, la
    // ricerca è pronta e vuota finché la persona non cerca di nuovo: mai i risultati di prima sotto una parola che la cornice
    // non ha cercato. La parola scritta in attesa è un'altra cosa: non è partita, e all'arrivo dei dati si cerca ciò che è nel
    // campo (sopra).
    if (ridotta && ricerca !== undefined) {
        setRicerca(undefined);
    }
    // Il freno del backoffice: quando la ricerca risponde 429 coi secondi da aspettare (`TroppeRichieste`), fino a quell'istante
    // — al più `TETTO_DEL_FRENO` secondi dopo (`ricerca.ts`) — nessuna richiesta parte, qualunque cosa la persona scriva, e lo stato diventa
    // l'errore, da qualunque stato si arrivi: una parola battuta nel frattempo non mostra il caricamento, e nemmeno «Nessun
    // risultato» per una parola che non è partita (dopo lo stato ridotto, che la ricerca la dimentica). Il freno è della
    // persona, non di una richiesta: vale anche quando il 429 è di una richiesta che non è più l'ultima, e allora quella in
    // volo è annullata e non è più di nessuno, così la sua risposta non entra nello stato. Allo scadere non parte niente da
    // solo: parte la prima parola scritta dopo. L'istante è dell'orologio della pagina (`performance.now()`), che non torna
    // indietro. Nello stato ridotto l'errore non resta: la cornice dimentica la ricerca, qui sopra.
    const frenataFinoA = useRef(0);
    const nelFreno = () => {
        ricercaInVolo.current?.abort();
        ricercaInVolo.current = undefined;
        setRicerca({ stato: 'error' });
    };
    const cercaParola = (parola: string) => {
        if (ridottaAdesso.current) {
            return;
        }
        if (performance.now() < frenataFinoA.current) {
            nelFreno();

            return;
        }
        ricercaInVolo.current?.abort();
        const questa = new AbortController();
        ricercaInVolo.current = questa;
        setRicerca({ stato: 'loading' });
        // La richiesta, la sua risposta e il freno stanno nel pezzo a richiesta (`./ricerca`, dalla `v2.8.0`): se il fuoco non lo
        // ha già portato lo chiede questa parola, e finché non arriva lo stato è il caricamento. Nell'attesa che dalla
        // `v2.11.5` segue un pezzo non arrivato non lo chiede: `chiediLaRicerca` è respinta subito, e lo stato è l'errore. All'arrivo parte l'ultima
        // parola chiesta: una di prima è annullata, e chi non è più a schermo non cerca (lo guarda il pezzo, `cercaPer`); una
        // cornice smontata ha annullato la sua nella pulizia, anche se quella rifatta è della stessa persona.
        chiediLaRicerca().then(
            (arrivata) => arrivata.cercaPer(parola, questa, persona.email, ricercaInVolo, frenataFinoA, setRicerca, seDaAccettare, nelFreno),
            () => ricercaInVolo.current === questa && setRicerca({ stato: 'error' }),
        );
    };
    const risultati = ricerca?.stato === 'ready' ? laRicerca!.risultatiDellaRicerca(ricerca.risultati, lingua, t, ricerca.workspace) : [];
    const voci = [prodotti, ...nav];

    // Le voci del menu del profilo: «Esci» è del frontend, le altre sono pagine di app.zeiras.com.
    const suAccount = (azione: AccountAction) => (azione === 'logout' ? onLogout() : naviga(dashboard.indirizzo + pagineDiApp[azione]));

    // Una notifica apre la sua risorsa, dove dice il registro (`destinazioneDellaNotifica`): nel prodotto da cui viene, nel
    // workspace dell'elenco — quello che la parte server dice, mai quello dei dati della pagina: la sessione ha un workspace
    // solo, e la scheda rimasta su un altro riceve le notifiche di quello. Se l'elenco è del workspace dei dati decide lo
    // stato dei loro moduli; di un altro workspace la cornice non lo conosce, e non decide (sopra, `inUnAltroWorkspace`). Una
    // che non ha dove andare, una di un elenco di cui non si sa il workspace, e «Vedi tutte», portano alla pagina delle
    // notifiche di app.zeiras.com, anche da un prodotto. Una non letta che apre la sua risorsa è segnata letta (`leggi`): la
    // richiesta parte prima dell'apertura. Su una pagina di 30 secondi o più l'apertura non la aspetta; su una più giovane
    // (dalla `v2.11.5`) la aspetta, e la risposta di un'altra persona — la pagina si ricarica quando compie 30 secondi, vedi
    // `chiama` — non apre la risorsa con la sessione di chi è entrato.
    const apriNotifica = (aperta: ShellNotification) => {
        const notifica = elenco.find(({ id }) => id === aperta.id);
        const elencoDi = notifiche.workspace;
        const risorsa = notifica === undefined || elencoDi === undefined ? undefined : destinazioneDellaNotifica(notifica, elencoDi, elencoDi === dati.workspace.slug ? dati.prodotti : inUnAltroWorkspace);
        // Una destinazione c'è solo con la notifica e col workspace del suo elenco.
        if (risorsa !== undefined && !notifica!.letta) {
            const lettura = leggi(notifica!.id, elencoDi!);
            if (performance.now() < 3e4) {
                lettura.then(() => naviga(risorsa));
                return;
            }
        }
        naviga(risorsa ?? dashboard.indirizzo + pagineDiApp.notifiche);
    };

    // L'avviso di chi non ha accettato i documenti legali, sopra la pagina: titolo, frase e un pulsante che porta alla pagina
    // dell'accettazione, sull'host della Dashboard nel registro — mai un indirizzo preso dai dati o dalla risposta di una rotta.
    // Il `ritorno` è l'indirizzo in cui la persona è al clic, non quello del render: fra una visita e l'altra la cornice può
    // restare montata mentre l'indirizzo cambia. Entra solo se comincia con `https://` e non supera i 2000 caratteri; senza,
    // dopo l'accettazione zr-home porta alla Dashboard. La cornice non mostra testi legali, non dice quali documenti mancano e
    // non fa accettare niente.
    //
    // L'avviso sta prima della pagina, in un contenitore suo, e la pagina resta dov'è — dentro `main.zr-main`, o dentro
    // `div.zr-main-body` se ha il percorso: è lì che l'`AppShell` mette `children` —, nello stesso posto dell'albero con e senza
    // l'avviso (sotto, `children`, che per questo è sempre un frammento: l'avviso o niente, poi la pagina). Così quando lo stato arriva o se ne va React non la
    // rimonta, e ciò che la persona ha scritto in un campo, il fuoco e lo scorrimento restano. Lo spazio fra avviso e pagina è
    // quello di `zr-stack`, che lo mette fra due figli: il secondo è un `div` vuoto, finché l'`AppShell` non ha un posto suo
    // per un avviso (richiesta al design system).
    const vaiAllAccettazione = () => {
        const qui = location.href;
        naviga(dashboard.indirizzo + paginaDellAccettazione + (qui.startsWith('https://') && qui.length <= 2000 ? `?ritorno=${encodeURIComponent(qui)}` : ''));
    };
    // In attesa non c'è un avviso; quando il backoffice non ha risposto c'è il suo, senza pulsante. Sta nello stesso posto di
    // quello dell'accettazione: la pagina resta dov'è quando compare e quando se ne va.
    const avvisoSopraLaPagina = daAccettare || dati.non_letti ? (
        <div className="zr-stack">
            <Alert tone="warning" title={daAccettare ? t.acceptanceTitle : t.downTitle} action={daAccettare ? <Button variant="secondary" size="sm" onClick={vaiAllAccettazione}>{t.acceptanceAction}</Button> : undefined}>
                {daAccettare ? t.acceptanceText : t.downText}
            </Alert>
            <div />
        </div>
    ) : null;
    const spenta = daAccettare ? t.acceptanceOff : t.downOff;

    const shell = (
        <AppShell
            // Ciò che può non esserci arriva all'`AppShell` solo col suo valore, mai come chiave che vale `undefined`. In un
            // oggetto solo, la pagina per prima: ciò che decide la cornice copre una prop con lo stesso nome anche quando la
            // cornice non ha niente da dare, e allora all'`AppShell` non arriva. Solo `null` vuol dire «nessuna voce attiva»:
            // senza `active`, o con `active` vuoto, resta la Dashboard, come decide l'`AppShell` — tranne nello stato ridotto su
            // una pagina di un modulo, dove il modulo aperto all'`AppShell` non arriva e la Dashboard sarebbe segnata a chi è
            // nel modulo: lì, senza `active` o con `active` vuoto, nessuna voce. Il numero sulla campanella è quello dei dati, e mai
            // meno delle non lette di un elenco più recente (sopra): l'elenco si carica solo aprendo la campanella. Con `piano`
            // nessuna lista del profilo: vale quella che l'`AppShell` mette da sé, con la voce «Piano».
            {...senzaUndefined({
                ...pagina,
                active: active === null || (ridotta && aperto !== undefined && !active) ? idDiNessunaVoce(voci) : active,
                companies,
                searchState: ridotta ?? ricerca?.stato ?? 'ready',
                // Senza la chiave l'`AppShell` non mette «Nuovo workspace» in fondo al selettore.
                onNewWorkspace: nuovoWorkspace,
                accountItems: piano ? undefined : menuDelProfiloSenzaPiano(t, suAccount),
                // Ciò che si spegne per chi non ha accettato i documenti legali. Il menu Moduli resta esteso, con la sola
                // Dashboard: col modulo aperto l'`AppShell` ne mostrerebbe il nome. La campanella non ha numero e nessuno dei suoi
                // gestori, e la ricerca non ha il suo: senza, l'`AppShell` non chiede niente alla cornice, e la cornice non chiama
                // nessuna delle sue rotte. L'avviso sta sopra la pagina, nel margine: `flush` non vale. In attesa dei dati del
                // backoffice (`in_attesa`) l'avviso non c'è, e allora `flush` vale — la pagina non cambia forma quando arrivano — e
                // la campanella tiene il gestore dell'apertura: aperta in attesa chiede l'elenco, e il pannello lo mostra quando
                // arrivano (l'`AppShell` avvisa solo al clic che apre: senza, resterebbe vuoto). Quello di «Riprova» no: il
                // pannello in attesa è nello stato di caricamento, che non ha il pulsante. La ricerca nello stato ridotto non ha il
                // suo gestore, nemmeno in attesa: all'arrivo dei dati la cornice cerca ciò che è nel campo (sopra). Lo stato della
                // ricerca sta qui, fra ciò che decide la cornice, col suo valore: quello dello stato ridotto, o quello
                // dell'ultima ricerca, o `ready`. Le voci del modulo, il
                // «+» e il resto restano quelli che la pagina dà. La pagina è sempre il secondo figlio, con l'avviso o senza:
                // è per questo che non si rimonta.
                product: ridotta ? undefined : aperto?.id,
                // Senza il numero dei dati, quello delle non lette caricate: lo dà la cornice e non lo conta il design system
                // dalle righe, che mancano finché non ci sono le frasi della lingua (a pannello chiuso non si chiedono).
                unreadCount: ridotta ? 0 : nonLette ?? (elenco.length > 0 ? sullaCampanella : undefined),
                onMarkAllRead: ridotta ? undefined : segnaTutteLette,
                onRetryNotifications: ridotta ? undefined : () => carica(true),
                onNotificationsOpen: avvisoSopraLaPagina ? undefined : carica,
                onOpenNotification: ridotta ? undefined : apriNotifica,
                onAllNotifications: ridotta ? undefined : () => naviga(dashboard.indirizzo + pagineDiApp.notifiche),
                onSearch: ridotta ? undefined : cercaParola,
                flush: avvisoSopraLaPagina ? undefined : pagina.flush,
                children: <>{avvisoSopraLaPagina}{pagina.children}</>,
            })}
            nav={voci}
            email={persona.email}
            user={persona.nome}
            workspace={dati.workspace.nome}
            workspaceSlug={dati.workspace.slug}
            // Lo stesso prodotto nel workspace scelto (linea guida 15, passo 8); da una pagina di app.zeiras.com, la Dashboard.
            onSelectWorkspace={(slug) => naviga(nelWorkspace((aperto ?? dashboard).indirizzo, slug))}
            // A chi non ha accettato i documenti legali pannello e ricerca non mostrano niente di ciò che la cornice aveva, e
            // dicono perché con lo stato che l'`AppShell` ha per un errore: il design system non ha uno stato «non disponibile».
            // In attesa lo stato è quello di caricamento. I risultati non hanno bisogno di una guardia loro: nello stato
            // ridotto la cornice ha già dimenticato la ricerca (sopra), e senza quella non ce ne sono.
            notifications={ridotta || frasi === undefined || riga === undefined ? [] : elenco.map((notifica) => nelPannello(notifica, riga(frasi, notifica, lingua), lingua, adesso))}
            notificationsState={ridotta ?? statoDelPannello}
            searchResults={risultati}
            // Un risultato si apre sul suo indirizzo: il prodotto che lo possiede mostra un elemento nel suo pannello, un
            // contenitore a pagina intera.
            onSelectResult={(scelto) => {
                if (scelto.href !== undefined) {
                    naviga(scelto.href);
                }
            }}
            // Con una sola non letta il nome della campanella per il lettore di schermo è al singolare: il design system ha un
            // testo solo per le non lette, e zr-core gli dà il suo. Lo stesso testo è il nome del pallino di ogni notifica non
            // letta nel pannello, che così segue il numero della campanella e non la notifica (README, «La campanella»). Anche
            // il pulsante «Segna tutte come lette» ha nell'`AppShell` un testo solo, e zr-core gli dà quello del suo momento.
            // Ognuno dei due per conto suo, su una copia: i testi di una lingua sono di tutti, e non si cambiano. Sulla stessa
            // copia il segnaposto della ricerca e l'invito, che dice le fonti del workspace (`dellaRicerca`). A chi non ha
            // accettato i documenti legali, e quando il backoffice non ha risposto, la frase di zr-core al posto dei tre testi
            // che pannello e ricerca mostrerebbero: l'errore del pannello, e sotto il campo l'invito a scrivere e l'errore
            // della ricerca. In attesa i testi sono quelli di sempre: il pannello e la ricerca caricano coi testi
            // dell'`AppShell`, e sotto il campo vuoto c'è l'invito a scrivere, perché la parola scritta verrà cercata.
            labels={avvisoSopraLaPagina
                ? { ...t, ...dellaRicerca, notificationsError: spenta, searchHint: spenta, searchError: spenta }
                : { ...t, ...dellaRicerca, unread: unaSola ? t.unreadOne : t.unread, markAllRead: sulPulsante }}
            settingsHref={dashboard.indirizzo + pagineDiApp.settings}
            onAccount={suAccount}
        />
    );

    return (
        <>
            <SaltaAlContenuto testo={t.skipToContent} />
            {shell}
            <div role="status" className="zr-visually-hidden">{avviso?.testo}</div>
        </>
    );
}
