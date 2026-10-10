import { useRef, useState, type ReactNode } from 'react';
import type { AccountAction, MenuItem, NavItem, ShellCrumb, ShellNotification, ShellSearchResult, Tone } from '../zeiras/index';
import { linguaDeiTesti, nomeDellaVoce, testi, type TestiDellaCornice } from './lingue';
import { registro, type IdDiProdotto, type TipoDiRisorsa } from './registro';
import { caricaNotifiche, cerca, segnaLetteFinoA, segno, type NotificaDellaCornice, type RisultatoDellaRicerca } from './servizi';
import { Zeiras } from './zeiras';

// La cornice di Zeiras per i frontend: l'`AppShell` del design system così com'è, riempita da zr-core. Il frontend dà la pagina,
// il prodotto aperto con le sue voci e i dati della parte server (`Cornice::dati()`); zr-core mette il menu Prodotti dal
// registro, incrociato con lo stato dei prodotti nel workspace, gli indirizzi del workspace, i testi della lingua, e dove
// portano account, notifiche e risultati della ricerca (linea guida 15).

/** I dati della cornice, come li dà `Cornice::dati()` della parte server: la persona, la sua lingua, il workspace in cui è entrata. */
export interface DatiDellaCornice {
    /** La lingua della persona (`it`, `es`, `en`…): in una lingua che zr-core non ha, la cornice è in inglese. */
    lingua: string;
    /** Nell'avatar e in cima al menu del profilo. */
    persona: { nome: string; email: string };
    /** Il nome sta in cima alla sidebar, come testo; lo slug in ogni indirizzo dei prodotti. */
    workspace: { nome: string; slug: string };
    /** Lo stato di ogni prodotto nel workspace (app.elenca): un prodotto che manca è «Presto». */
    prodotti: Partial<Record<IdDiProdotto, 'attivo' | 'disponibile' | 'in_arrivo'>>;
    /** Le aziende della persona coi loro workspace, nell'ordine dei dati: il selettore «Azienda › workspace». Senza, o se il workspace dei dati non sta in nessuna, il workspace resta testo. */
    aziende?: { id: string; nome: string; workspace: { nome: string; slug: string }[] }[];
    /** Le notifiche non lette nel workspace: il numero sulla campanella, «99+» oltre 99. */
    non_lette?: number;
    /**
     * Il segno della lettura: l'istante in cui la parte server ha cominciato a leggere questi dati (UTC, coi microsecondi). I
     * dati di due letture non sono mai uguali, e la cornice sa quali sono stati letti dopo: tiene i più recenti che ha visto
     * (vedi «i dati più recenti», più sotto).
     */
    aggiornati_il?: string;
}

/** Un gruppo di voci della navigazione di un prodotto, sotto il suo pulsante. */
export interface GruppoDiVoci {
    group: string;
    items: (NavItem & { tone?: Exclude<Tone, 'neutral'> })[];
}

export interface CorniceProps {
    /** I dati della parte server: `Cornice::dati()`. */
    dati: DatiDellaCornice;
    /** Il prodotto aperto, un id del registro (`pm`, `crm`, `bookings`…). Senza, la pagina è di app.zeiras.com e il menu Prodotti è esteso. */
    product?: string;
    /** Le voci del prodotto aperto. */
    nav?: GruppoDiVoci[];
    /** L'id della voce attiva; senza, la Dashboard. Con `null` nessuna voce della barra è attiva. */
    active?: string | null;
    onNavigate?: (id: string) => void;
    /** Il percorso Workspace › Cartella › Oggetto: l'ultima voce è la pagina. */
    crumbs?: ShellCrumb[];
    onCrumb?: (voce: ShellCrumb, indice: number) => void;
    /** Le voci del menu «+»: i tipi che il prodotto crea. */
    create?: MenuItem[];
    /** Altro in topbar. */
    actions?: ReactNode;
    /** L'area della pagina senza margine (la board). */
    flush?: boolean;
    /** «Esci»: la sessione la chiude il frontend, ovunque. Obbligatorio: senza, «Esci» non farebbe niente. */
    onLogout: () => void;
    /** Come si apre un indirizzo: di norma il browser ci va. */
    naviga?: (indirizzo: string) => void;
    children?: ReactNode;
}

/** La Dashboard: il registro la porta sempre, per prima. */
const dashboard = registro.find((voce) => voce.id === 'home')!;

/** Il prodotto del registro con quel codice; la Dashboard non è un prodotto. */
function prodottoDelRegistro(codice: string | null | undefined) {
    return registro.find((voce) => voce.id === codice && voce !== dashboard);
}

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

/** Di che prodotto è ogni tipo di risorsa del registro, e come si mostra: un tipo sta in un prodotto solo. */
const risorsePerTipo = new Map(registro.flatMap((delProdotto) => (delProdotto.risorse ?? []).map((risorsa) => [risorsa.tipo, { delProdotto, risorsa }] as const)));

/** Le pagine di account, azienda e notifiche: stanno su app.zeiras.com, l'indirizzo della Dashboard. */
const pagineDiApp: Record<Exclude<AccountAction, 'logout'> | 'notifiche', string> = {
    profile: '/impostazioni/profilo',
    settings: '/impostazioni/preferenze',
    plan: '/azienda/impostazioni/piano',
    company: '/azienda',
    notifiche: '/notifiche',
};

/** L'indirizzo di un prodotto in un workspace: è così che workspace e permessi passano da un prodotto all'altro. */
function nelWorkspace(indirizzo: string, slug: string): string {
    return `${indirizzo}/w/${encodeURIComponent(slug)}`;
}

/** Porta al prodotto solo uno stato che zr-core conosce: `attivo` o `disponibile`. Ogni altro, anche nuovo, è «Presto». */
function raggiungibile(stato: string | undefined): boolean {
    return stato === 'attivo' || stato === 'disponibile';
}

/**
 * Quando è arrivata una notifica, come le date del design system: «ora», «5 minuti fa», «3 ore fa», «ieri», poi «1 ott» (con
 * l'anno se non è quest'anno). Un istante che non si legge non ha ora.
 */
function quando(istante: string, lingua: string | undefined, adesso: Date): string | undefined {
    const data = new Date(istante);
    if (Number.isNaN(data.getTime())) {
        return undefined;
    }
    const secondi = (adesso.getTime() - data.getTime()) / 1000;
    const relativa = new Intl.RelativeTimeFormat(lingua, { numeric: 'auto' });
    if (secondi < 60) {
        return relativa.format(0, 'second');
    }
    if (secondi < 3600) {
        return relativa.format(-Math.floor(secondi / 60), 'minute');
    }
    const mezzanotte = (giorno: Date) => new Date(giorno.getFullYear(), giorno.getMonth(), giorno.getDate()).getTime();
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
 * Il titolo di una notifica: quello del suo tipo, fra i testi della lingua (`notificationTitle.<tipo>`). Quali tipi zr-core
 * conosce lo dicono le lingue, non il codice: un tipo che non hanno — nuovo nel contratto, vuoto, mancante, o che non è un
 * testo — ha il titolo di ripiego, e il codice del tipo non si mostra mai.
 */
function titoloDi(tipo: unknown, t: TestiDellaCornice): string {
    const delTipo = typeof tipo === 'string' ? t[`notificationTitle.${tipo}`] : undefined;

    return typeof delTipo === 'string' && delTipo !== '' ? delTipo : t.notificationTitle;
}

/**
 * Una notifica della parte server nel pannello: il titolo del suo tipo e l'ora, nella lingua dei testi. Di che
 * prodotto è lo dice `app`, se è il codice di un prodotto del registro: il nome viene dalle lingue, icona e tono dal registro,
 * anche per un prodotto «Presto» o non attivo nel workspace. Ogni altro `app` — `null`, un codice che il registro non ha, la
 * Dashboard — non porta prodotto: la campanella e il tono neutro del design system, mai il codice. Il contratto non dice per
 * chi è una notifica: ognuna sta in «Per me» come in «Tutte».
 */
function nelPannello(notifica: NotificaDellaCornice, lingua: string, t: TestiDellaCornice, adesso: Date): ShellNotification {
    const delProdotto = prodottoDelRegistro(notifica.app);

    return {
        id: notifica.id,
        title: titoloDi(notifica.tipo, t),
        time: quando(notifica.creata_il, linguaDeiTesti(lingua), adesso),
        product: delProdotto && nomeDellaVoce(delProdotto, lingua),
        icon: delProdotto?.icona,
        tone: delProdotto?.tono,
        unread: !notifica.letta,
    };
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
        const questo = new Date(creataIl).getTime();
        if (questo > istante) {
            scelta = creataIl;
            istante = questo;
        }
    }

    return scelta;
}

/**
 * Un risultato della ricerca nella cornice. Il contratto dà solo tipo, id e titolo: il prodotto è quello che nel registro ha
 * quel tipo fra le sue risorse (un tipo sta in un prodotto solo), mai un campo della risposta. Il gruppo è il nome del tipo
 * nella lingua dei testi, nome e tono sono del prodotto, l'icona del tipo; l'indirizzo è quello del prodotto nel workspace dei
 * dati seguito dal percorso del tipo. Un tipo che il registro non ha non si mostra: mai un indirizzo inventato.
 */
function nellaRicerca(risultato: RisultatoDellaRicerca, lingua: string, t: TestiDellaCornice, slug: string): ShellSearchResult | undefined {
    const trovata = risorsePerTipo.get(risultato.tipo);
    if (trovata === undefined) {
        return undefined;
    }
    const { delProdotto, risorsa } = trovata;
    const tipo = `${delProdotto.id}.${risorsa.tipo}` as TipoDiRisorsa;
    const { id } = risultato;

    return {
        // Unico fra i tipi: una board e una cartella possono avere lo stesso id.
        id: `${tipo}.${id}`,
        title: risultato.titolo,
        group: t[tipo],
        product: nomeDellaVoce(delProdotto, lingua),
        icon: risorsa.icona,
        tone: delProdotto.tono,
        container: risorsa.contenitore,
        href: nelWorkspace(delProdotto.indirizzo, slug) + risorsa.percorso.replace('{id}', () => encodeURIComponent(id)),
    };
}

/**
 * I risultati di un gruppo vicini, perché l'`AppShell` ne apre uno a ogni cambio di gruppo: i gruppi nell'ordine del primo
 * risultato di ognuno, e dentro un gruppo l'ordine del backoffice (per titolo).
 */
function perGruppo(risultati: ShellSearchResult[]): ShellSearchResult[] {
    const gruppi = [...new Set(risultati.map((risultato) => risultato.group))];

    return [...risultati].sort((primo, secondo) => gruppi.indexOf(primo.group) - gruppi.indexOf(secondo.group));
}

/**
 * `questi` sono stati letti prima di `quelli`: sono dati dello stesso workspace, tutti e due col segno, e il segno di `questi`
 * è più indietro. Con lo stesso segno no: è la stessa lettura, e se il contenuto è un altro lo ha cambiato il frontend nel
 * browser. Senza un segno da una parte, o fra due workspace, non si può dire: `false`.
 */
function lettiPrima(questi: DatiDellaCornice, quelli: DatiDellaCornice): boolean {
    const [diQuesti, diQuelli] = [segno(questi.aggiornati_il), segno(quelli.aggiornati_il)];

    return questi.workspace.slug === quelli.workspace.slug && diQuesti !== undefined && diQuelli !== undefined && diQuesti < diQuelli;
}

/** Una cosa che la cornice ha saputo da una rotta: i dati che aveva quando l'ha chiesta, e l'istante che la parte server ha dato alla risposta, se lo dà. */
interface Saputo {
    con: DatiDellaCornice;
    il: string | undefined;
}

/**
 * I dati non sono più recenti di ciò che la cornice ha saputo da una rotta: sono dello stesso workspace e, se c'è un istante
 * da tutte e due le parti, il segno dei dati è lo stesso o più indietro. Senza un istante da una parte non si confronta
 * niente: vale solo per i dati con cui la rotta è stata chiesta. È un'altra regola da `lettiPrima`: lì, fra due dati con lo
 * stesso segno, vale la pagina; qui, a pari istante, vale ciò che la rotta ha detto.
 */
function nonPiuRecentiDi(dati: DatiDellaCornice, saputo: Saputo | undefined): boolean {
    if (saputo === undefined || dati.workspace.slug !== saputo.con.workspace.slug) {
        return false;
    }
    const deiDati = segno(dati.aggiornati_il);

    return deiDati !== undefined && saputo.il !== undefined ? deiDati <= saputo.il : saputo.con === dati;
}

export function Cornice({ dati: dellaPagina, product, nav = [], active, onLogout, naviga = (indirizzo) => window.location.assign(indirizzo), ...pagina }: CorniceProps) {
    // I dati più recenti che la cornice ha visto. La pagina può darne di più vecchi di quelli che la cornice ha già: con Indietro
    // e Avanti del browser tornano i dati di allora, e una risposta letta prima può arrivare dopo (una visita lenta, una pagina
    // che il `prefetch` di Inertia teneva). I dati della pagina valgono sempre, tranne quando sono dello stesso workspace e il
    // loro segno dice che sono stati letti prima: allora restano quelli che ci sono. Con lo stesso segno vale la pagina, come
    // senza segno o in un altro workspace: è la stessa lettura, e un contenuto diverso lo ha messo il frontend nel browser.
    // Si decide mentre si rende, non in un effetto: la cornice non si vede mai coi dati più vecchi, nemmeno per un render.
    const [tenuti, setTenuti] = useState(dellaPagina);
    const dati = lettiPrima(dellaPagina, tenuti) ? tenuti : dellaPagina;
    if (dati !== tenuti) {
        setTenuti(dati);
    }
    const t = testi(dati.lingua);
    // Un prodotto che il registro non ha, o la Dashboard, è una pagina di app.zeiras.com: menu esteso.
    const aperto = prodottoDelRegistro(product);
    const prodotti = {
        group: t.products,
        products: true,
        items: registro.map((voce) => {
            // «Presto» è un prodotto futuro: per il registro, o perché il backoffice non lo dà `attivo` né `disponibile` (in
            // arrivo, non elencato, o in uno stato che zr-core non conosce). Uno `disponibile` porta alla sua pagina, che dice
            // che non è attivo nel workspace (linea guida 15). La Dashboard non ha uno stato: porta sempre.
            const presto = voce.id !== 'home' && (voce.presto || !raggiungibile(dati.prodotti[voce.id]));

            return {
                id: voce.id,
                label: nomeDellaVoce(voce, dati.lingua),
                icon: voce.icona,
                tone: voce.tono,
                home: voce === dashboard,
                soon: presto,
                // Un prodotto «Presto» non porta da nessuna parte; quello aperto, al clic, chiude solo la lista.
                href: presto || voce === aperto ? undefined : nelWorkspace(voce.indirizzo, dati.workspace.slug),
            };
        }),
    };

    // Il selettore «Azienda › workspace» solo se il workspace dei dati sta in un'azienda: altrimenti l'`AppShell` segnerebbe attivo
    // il primo workspace della prima, e il workspace resta testo. Nessun tono (il backoffice non dà grafica) e nessun «Nuovo
    // workspace» finché zr-home non ha la sua pagina.
    const conIlWorkspace = dati.aziende?.some((azienda) => azienda.workspace.some((ws) => ws.slug === dati.workspace.slug));
    const companies = conIlWorkspace
        ? dati.aziende?.map((azienda) => ({ id: azienda.id, name: azienda.nome, workspaces: azienda.workspace.map((ws) => ({ slug: ws.slug, name: ws.nome })) }))
        : undefined;

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
    const [notifiche, setNotifiche] = useState<{ stato: 'ready' | 'loading' | 'error'; elenco: NotificaDellaCornice[] }>({ stato: 'ready', elenco: [] });
    const [caricate, setCaricate] = useState<Saputo & { nonLette: number }>();
    const ultimaRichiesta = useRef(0);
    const carica = () => {
        const questa = ++ultimaRichiesta.current;
        const questi = dati;
        setNotifiche({ stato: 'loading', elenco: [] });
        caricaNotifiche().then(
            ({ elenco, il }) => {
                if (questa === ultimaRichiesta.current) {
                    setNotifiche({ stato: 'ready', elenco });
                    setCaricate({ con: questi, nonLette: elenco.filter((notifica) => !notifica.letta).length, il });
                }
            },
            () => {
                if (questa === ultimaRichiesta.current) {
                    setNotifiche({ stato: 'error', elenco: [] });
                }
            },
        );
    };

    // «Segna tutte come lette» è una richiesta sola: segna le notifiche della persona nate fino alla più recente fra quelle
    // caricate, anche quelle oltre la prima pagina. Fin lì e non fino all'ora del browser: ciò che arriva dopo, mai visto,
    // resta da leggere. Alla risposta le caricate sono lette e il numero dei dati non conta più, finché i dati non sono stati
    // letti dopo l'istante in cui la parte server le ha segnate: una risposta letta prima del clic e arrivata dopo non rimette
    // il numero, e coi dati letti dopo (un'altra visita, con la cornice montata) vale il loro numero, anche se è lo stesso di
    // prima del clic. Se la richiesta fallisce non cambia niente, e il pulsante resta per riprovare. Un clic mentre è in volo
    // non ne fa partire un'altra. Se la parte server dice che ne restano (`altre`: si è fermata a un tetto) non sono tutte
    // lette: il numero resta, le notifiche in pagina non si danno per lette, e il pannello si ricarica con ciò che c'è
    // davvero; il pulsante resta, e un altro clic continua.
    const [segnate, setSegnate] = useState<Saputo>();
    const leStaSegnando = useRef(false);
    // I dati non sono più recenti dell'ultimo elenco arrivato: l'elenco è più recente del loro numero.
    const elencoDiQuestiDati = caricate !== undefined && nonPiuRecentiDi(dati, caricate);
    // Il numero sulla campanella viene dai dati, e non è mai meno delle non lette di un elenco più recente: una può essere
    // arrivata dopo che la parte server le ha contate, o dopo «Segna tutte come lette». Coi dati letti dopo (un'altra visita,
    // con la cornice montata) vale il loro numero, anche se è lo stesso di prima: l'elenco di prima è più vecchio. Senza il
    // numero nei dati le conta il design system.
    const nonLette = dati.non_lette === undefined ? undefined : Math.max(nonPiuRecentiDi(dati, segnate) ? 0 : dati.non_lette, elencoDiQuestiDati ? caricate.nonLette : 0);
    const nonLetteInElenco = notifiche.elenco.filter((notifica) => !notifica.letta).length;
    const finoA = piuRecente(notifiche.elenco);
    // Il pulsante c'è con la campanella che ha un numero e almeno una notifica caricata, anche se le caricate sono tutte lette:
    // le non lette stanno oltre la prima pagina.
    const segnaTutteLette = notifiche.stato !== 'ready' || finoA === undefined || caricate === undefined || !((nonLette ?? nonLetteInElenco) > 0) ? undefined : async () => {
        if (leStaSegnando.current) {
            return;
        }
        leStaSegnando.current = true;
        const questi = dati;
        const elencoDelClic = ultimaRichiesta.current;
        let il: string | undefined;
        let altre: boolean;
        try {
            // Con lo slug del workspace dei dati con cui l'elenco è stato chiesto: l'istante è delle sue notifiche. Se la
            // sessione è passata a un altro, la parte server non segna niente.
            ({ il, altre } = await segnaLetteFinoA(finoA, caricate.con.workspace.slug));
        } catch {
            // Non cambia niente: il pulsante resta, per riprovare.
            return;
        } finally {
            leStaSegnando.current = false;
        }
        if (altre) {
            // Ne restano da leggere: niente è «segnato fino a qui», e le non lette dell'ultimo elenco contano finché non
            // arriva quello nuovo.
            carica();

            return;
        }
        setSegnate({ con: questi, il });
        if (ultimaRichiesta.current === elencoDelClic && elencoDiQuestiDati) {
            // Le caricate sono lette dall'istante della lettura: per i dati letti fin lì non ce ne sono di non lette.
            setNotifiche((prima) => ({ ...prima, elenco: prima.elenco.map((notifica) => ({ ...notifica, letta: true })) }));
            setCaricate({ con: questi, nonLette: 0, il });
        } else {
            // Il pannello è stato ricaricato fra il clic e la risposta, e quell'elenco è di prima della lettura; oppure
            // l'elenco del clic era più vecchio dei dati (cambiati a pannello aperto), e l'istante mandato non copre ciò che
            // è arrivato dopo. Si ricarica, invece di dare per lette quelle in pagina; e le non lette di quell'elenco non
            // contano più sulla campanella, perché la lettura le ha coperte: conteranno quelle dell'elenco che arriva.
            setCaricate(undefined);
            carica();
        }
    };
    const adesso = new Date();

    // La ricerca: una richiesta sola in volo. Una parola nuova annulla quella di prima, e conta solo l'ultima partita: una
    // risposta che arriva tardi, anche di una richiesta annullata, non sostituisce mai quella della parola più recente. Alla
    // parte server vanno i primi 100 caratteri (code point, come `mb_strlen`): oltre risponderebbe 422, e sarebbe un errore.
    const [ricerca, setRicerca] = useState<{ stato: 'ready' | 'loading' | 'error'; risultati: RisultatoDellaRicerca[] }>({ stato: 'ready', risultati: [] });
    const ricercaInVolo = useRef<AbortController>(undefined);
    const cercaParola = (parola: string) => {
        ricercaInVolo.current?.abort();
        const questa = new AbortController();
        ricercaInVolo.current = questa;
        setRicerca({ stato: 'loading', risultati: [] });
        cerca(Array.from(parola).slice(0, 100).join(''), questa.signal).then(
            (risultati) => {
                if (ricercaInVolo.current === questa) {
                    setRicerca({ stato: 'ready', risultati });
                }
            },
            () => {
                if (ricercaInVolo.current === questa) {
                    setRicerca({ stato: 'error', risultati: [] });
                }
            },
        );
    };
    const risultati = perGruppo(ricerca.risultati.flatMap((risultato) => nellaRicerca(risultato, dati.lingua, t, dati.workspace.slug) ?? []));
    const voci = [prodotti, ...nav];

    return (
        <Zeiras.AppShell
            {...pagina}
            nav={voci}
            // Solo `null` vuol dire «nessuna voce attiva»: senza `active` resta la Dashboard, come decide l'`AppShell`.
            active={active === null ? idDiNessunaVoce(voci) : active}
            product={aperto?.id}
            user={dati.persona.nome}
            email={dati.persona.email}
            workspace={dati.workspace.nome}
            companies={companies}
            workspaceSlug={dati.workspace.slug}
            // Lo stesso prodotto nel workspace scelto (linea guida 15, passo 8); da una pagina di app.zeiras.com, la Dashboard.
            onSelectWorkspace={(slug) => naviga(nelWorkspace((aperto ?? dashboard).indirizzo, slug))}
            // Il numero dei dati, e mai meno delle non lette di un elenco più recente (sopra): l'elenco si carica solo
            // aprendo la campanella.
            unreadCount={nonLette}
            notifications={notifiche.elenco.map((notifica) => nelPannello(notifica, dati.lingua, t, adesso))}
            notificationsState={notifiche.stato}
            onNotificationsOpen={carica}
            onRetryNotifications={carica}
            onMarkAllRead={segnaTutteLette}
            onSearch={cercaParola}
            searchResults={risultati}
            searchState={ricerca.stato}
            // Un risultato si apre sul suo indirizzo: il prodotto che lo possiede mostra un elemento nel suo pannello, un
            // contenitore a pagina intera.
            onSelectResult={(scelto) => {
                if (scelto.href !== undefined) {
                    naviga(scelto.href);
                }
            }}
            // Con una sola non letta il nome della campanella per il lettore di schermo è al singolare: il design system ha un
            // testo solo per le non lette, e zr-core gli dà il suo. Il numero è quello che la campanella mostra: quello dei dati
            // o, senza, le non lette caricate, che conta il design system.
            labels={(nonLette ?? nonLetteInElenco) === 1 ? { ...t, unread: t.unreadOne } : t}
            settingsHref={dashboard.indirizzo + pagineDiApp.settings}
            onAccount={(azione) => (azione === 'logout' ? onLogout() : naviga(dashboard.indirizzo + pagineDiApp[azione]))}
            // Una notifica e «Vedi tutte» portano alla pagina delle notifiche di app.zeiras.com, anche da un prodotto.
            onOpenNotification={() => naviga(dashboard.indirizzo + pagineDiApp.notifiche)}
            onAllNotifications={() => naviga(dashboard.indirizzo + pagineDiApp.notifiche)}
        />
    );
}
