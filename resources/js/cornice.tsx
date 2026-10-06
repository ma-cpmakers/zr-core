import type { ReactNode } from 'react';
import type { AccountAction, MenuItem, NavItem, ShellCrumb, Tone } from '../zeiras/index';
import { nomeDellaVoce, testi } from './lingue';
import { registro, type IdDiProdotto } from './registro';
import { Zeiras } from './zeiras';

// La cornice di Zeiras per i frontend: l'`AppShell` del design system così com'è, riempita da zr-core. Il frontend dà la pagina,
// il prodotto aperto con le sue voci e i dati della parte server (`Cornice::dati()`); zr-core mette il menu Prodotti dal
// registro, incrociato con lo stato dei prodotti nel workspace, gli indirizzi del workspace, i testi della lingua, e dove
// portano account e notifiche (linea guida 15).

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

export function Cornice({ dati, product, nav = [], onLogout, naviga = (indirizzo) => window.location.assign(indirizzo), ...pagina }: CorniceProps) {
    const t = testi(dati.lingua);
    // Un prodotto che il registro non ha, o la Dashboard, è una pagina di app.zeiras.com: menu esteso.
    const aperto = registro.find((voce) => voce.id === product && voce !== dashboard);
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
            unreadCount={dati.non_lette}
            labels={t}
            settingsHref={dashboard.indirizzo + pagineDiApp.settings}
            onAccount={(azione) => (azione === 'logout' ? onLogout() : naviga(dashboard.indirizzo + pagineDiApp[azione]))}
            onAllNotifications={() => naviga(dashboard.indirizzo + pagineDiApp.notifiche)}
        />
    );
}
