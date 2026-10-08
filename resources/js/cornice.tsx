import { useRef, useState, type ReactNode } from 'react';
import type { AccountAction, MenuItem, NavItem, ShellCrumb, ShellNotification, ShellSearchResult, Tone } from '../zeiras/index';
import { linguaDeiTesti, nomeDellaVoce, testi, type TestiDellaCornice } from './lingue';
import { registro, type IdDiProdotto, type TipoDiRisorsa } from './registro';
import { caricaNotifiche, cerca, segnaLetta, type NotificaDellaCornice, type RisultatoDellaRicerca } from './servizi';
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
    /** L'id della voce attiva; senza, la Dashboard. */
    active?: string;
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
function prodottoDelRegistro(codice: string | undefined) {
    return registro.find((voce) => voce.id === codice && voce !== dashboard);
}

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
 * Una notifica della parte server nel pannello: il titolo della lingua, uno per tutte, e l'ora nella lingua dei testi. Il
 * contratto non dice di che prodotto è una notifica, né per chi: nessun prodotto, la campanella e il tono neutro del design
 * system, e ognuna sta in «Per me» come in «Tutte».
 */
function nelPannello(notifica: NotificaDellaCornice, lingua: string, t: TestiDellaCornice, adesso: Date): ShellNotification {
    return {
        id: notifica.id,
        title: t.notificationTitle,
        time: quando(notifica.creata_il, linguaDeiTesti(lingua), adesso),
        unread: !notifica.letta,
    };
}

/**
 * Un risultato della ricerca nella cornice: il gruppo è il nome del suo tipo nella lingua dei testi, prodotto e tono vengono dal
 * registro per codice di app, l'icona dal tipo; l'indirizzo è quello del prodotto nel workspace dei dati seguito dal percorso del
 * tipo. Un'app o un tipo che il registro non ha non si mostrano: mai un indirizzo inventato.
 */
function nellaRicerca(risultato: RisultatoDellaRicerca, lingua: string, t: TestiDellaCornice, slug: string): ShellSearchResult | undefined {
    const delProdotto = prodottoDelRegistro(risultato.app);
    const risorsa = delProdotto?.risorse?.find((voce) => voce.tipo === risultato.tipo);
    if (delProdotto === undefined || risorsa === undefined) {
        return undefined;
    }
    const tipo = `${delProdotto.id}.${risorsa.tipo}` as TipoDiRisorsa;
    const id = String(risultato.id);

    return {
        // Unico fra i tipi: una board e una scheda possono avere lo stesso id.
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
 * risultato di ognuno, e dentro un gruppo l'ordine del backoffice (per pertinenza).
 */
function perGruppo(risultati: ShellSearchResult[]): ShellSearchResult[] {
    const gruppi = [...new Set(risultati.map((risultato) => risultato.group))];

    return [...risultati].sort((primo, secondo) => gruppi.indexOf(primo.group) - gruppi.indexOf(secondo.group));
}

export function Cornice({ dati, product, nav = [], onLogout, naviga = (indirizzo) => window.location.assign(indirizzo), ...pagina }: CorniceProps) {
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

    // Le notifiche si caricano a ogni apertura del pannello, non con la pagina: il numero sulla campanella viene dai dati. Conta
    // l'ultima richiesta partita: una più vecchia che risponde dopo non sovrascrive la lista.
    const [notifiche, setNotifiche] = useState<{ stato: 'ready' | 'loading' | 'error'; elenco: NotificaDellaCornice[] }>({ stato: 'ready', elenco: [] });
    const ultimaRichiesta = useRef(0);
    const carica = () => {
        const questa = ++ultimaRichiesta.current;
        setNotifiche({ stato: 'loading', elenco: [] });
        caricaNotifiche().then(
            (elenco) => {
                if (questa === ultimaRichiesta.current) {
                    setNotifiche({ stato: 'ready', elenco });
                }
            },
            () => {
                if (questa === ultimaRichiesta.current) {
                    setNotifiche({ stato: 'error', elenco: [] });
                }
            },
        );
    };

    // «Segna tutte come lette» segna le non lette caricate, una alla volta nell'ordine dell'elenco: quelle arrivate dopo, mai
    // viste, restano da leggere, e senza non lette caricate il pulsante non c'è. A ogni risposta quella notifica è letta e la
    // campanella scende di uno; se una lettura fallisce si ferma lì, e le altre restano da leggere. Un clic mentre le sta
    // segnando non ne fa partire altre. Il numero sceso vale finché la pagina ha gli stessi dati: coi dati nuovi della parte
    // server (un'altra visita, con la cornice montata) torna il loro numero, anche se è lo stesso. Mai a zero d'ufficio: le non
    // lette possono essere più di quelle caricate.
    const [segnate, setSegnate] = useState<{ dati: DatiDellaCornice; quante: number }>();
    const leStaSegnando = useRef(false);
    const daLeggere = notifiche.elenco.filter((notifica) => !notifica.letta);
    const segnaTutteLette = daLeggere.length === 0 ? undefined : async () => {
        if (leStaSegnando.current) {
            return;
        }
        leStaSegnando.current = true;
        const questi = dati;
        try {
            for (const { id } of daLeggere) {
                await segnaLetta(id);
                setNotifiche((prima) => ({ ...prima, elenco: prima.elenco.map((notifica) => (notifica.id === id ? { ...notifica, letta: true } : notifica)) }));
                setSegnate((prima) => ({ dati: questi, quante: (prima?.dati === questi ? prima.quante : 0) + 1 }));
            }
        } catch {
            // Ferma alla prima lettura che fallisce: il pulsante resta, per riprovare.
        } finally {
            leStaSegnando.current = false;
        }
    };
    const nonLette = dati.non_lette === undefined ? undefined : Math.max(0, dati.non_lette - (segnate?.dati === dati ? segnate.quante : 0));
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

    return (
        <Zeiras.AppShell
            {...pagina}
            nav={[prodotti, ...nav]}
            product={aperto?.id}
            user={dati.persona.nome}
            email={dati.persona.email}
            workspace={dati.workspace.nome}
            companies={companies}
            workspaceSlug={dati.workspace.slug}
            // Lo stesso prodotto nel workspace scelto (linea guida 15, passo 8); da una pagina di app.zeiras.com, la Dashboard.
            onSelectWorkspace={(slug) => naviga(nelWorkspace((aperto ?? dashboard).indirizzo, slug))}
            // Il numero viene dai dati, non dall'elenco delle notifiche, che si carica solo aprendo la campanella.
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
            labels={t}
            settingsHref={dashboard.indirizzo + pagineDiApp.settings}
            onAccount={(azione) => (azione === 'logout' ? onLogout() : naviga(dashboard.indirizzo + pagineDiApp[azione]))}
            // Una notifica e «Vedi tutte» portano alla pagina delle notifiche di app.zeiras.com, anche da un prodotto.
            onOpenNotification={() => naviga(dashboard.indirizzo + pagineDiApp.notifiche)}
            onAllNotifications={() => naviga(dashboard.indirizzo + pagineDiApp.notifiche)}
        />
    );
}
