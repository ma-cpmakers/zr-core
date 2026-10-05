import type { ReactNode } from 'react';
import type { AccountAction, MenuItem, NavItem, ShellCompany, ShellCrumb, Tone } from '../zeiras/index';
import { nomeDellaVoce, testi } from './lingue';
import { registro } from './registro';
import { Zeiras } from './zeiras';

// La cornice di Zeiras per i frontend: l'`AppShell` del design system così com'è, riempita da zr-core. Il frontend dà la pagina,
// il prodotto aperto con le sue voci, la lingua e i dati della persona; zr-core mette il menu Prodotti dal registro con gli
// indirizzi del workspace, i testi della lingua, e dove portano account, notifiche e cambio di workspace (linea guida 15).

/** I dati della persona che la cornice mostra. Finché non arrivano dal backoffice (voce #1256) li passa il frontend. */
export interface PersonaDellaCornice {
    /** Il nome completo: nell'avatar e in cima al menu del profilo. */
    nome: string;
    email?: string;
    /** Il nome del piano, in cima al menu del profilo. */
    piano?: string;
    /** Le aziende della persona, ognuna coi suoi workspace. */
    aziende: ShellCompany[];
    /** Lo slug del workspace attivo: lo porta ogni indirizzo dei prodotti. */
    workspace: string;
    /** Le notifiche non lette, sulla campanella. */
    nonLette?: number;
}

/** Un gruppo di voci della navigazione di un prodotto, sotto il suo pulsante. */
export interface GruppoDiVoci {
    group: string;
    items: (NavItem & { tone?: Exclude<Tone, 'neutral'> })[];
}

export interface CorniceProps {
    /** La lingua della persona (`it`, `es`, `en`…): in una lingua che zr-core non ha, la cornice è in inglese. */
    lingua: string;
    persona: PersonaDellaCornice;
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
    onNewWorkspace?: (azienda?: string) => void;
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

/** I toni che un workspace può avere: un altro valore non arriva all'`AppShell`, che lo scrive in uno stile. */
const toniDeiWorkspace = ['pine', 'citrus', 'coral', 'sky', 'plum'] as const satisfies readonly Exclude<Tone, 'neutral'>[];
// Se il design system aggiunge un tono, tsc si ferma qui finché non entra nell'elenco.
const ogniTono: [Exclude<Exclude<Tone, 'neutral'>, (typeof toniDeiWorkspace)[number]>] extends [never] ? true : never = true;
void ogniTono;

/** L'indirizzo di un prodotto in un workspace: è così che workspace e permessi passano da un prodotto all'altro. */
function nelWorkspace(indirizzo: string, slug: string): string {
    return `${indirizzo}/w/${encodeURIComponent(slug)}`;
}

export function Cornice({ lingua, persona, product, nav = [], onLogout, naviga = (indirizzo) => window.location.assign(indirizzo), ...pagina }: CorniceProps) {
    const t = testi(lingua);
    // Un prodotto che il registro non ha, o la Dashboard, è una pagina di app.zeiras.com: menu esteso.
    const aperto = registro.find((voce) => voce.id === product && voce !== dashboard);
    const prodotti = {
        group: t.products,
        products: true,
        items: registro.map((voce) => ({
            id: voce.id,
            label: nomeDellaVoce(voce, lingua),
            icon: voce.icona,
            tone: voce.tono,
            home: voce === dashboard,
            soon: voce.presto,
            // Un prodotto «Presto» non porta da nessuna parte; quello aperto, al clic, chiude solo la lista.
            href: voce.presto || voce === aperto ? undefined : nelWorkspace(voce.indirizzo, persona.workspace),
        })),
    };

    const aziende = persona.aziende.map((azienda) => ({
        ...azienda,
        workspaces: azienda.workspaces.map(({ tone, ...workspace }) => ({ ...workspace, tone: toniDeiWorkspace.find((tono) => tono === tone) })),
    }));

    return (
        <Zeiras.AppShell
            {...pagina}
            nav={[prodotti, ...nav]}
            product={aperto?.id}
            user={persona.nome}
            email={persona.email}
            planName={persona.piano}
            companies={aziende}
            workspaceSlug={persona.workspace}
            unreadCount={persona.nonLette}
            labels={t}
            settingsHref={dashboard.indirizzo + pagineDiApp.settings}
            onSelectWorkspace={(slug) => naviga(nelWorkspace((aperto ?? dashboard).indirizzo, slug))}
            onAccount={(azione) => (azione === 'logout' ? onLogout() : naviga(dashboard.indirizzo + pagineDiApp[azione]))}
            onAllNotifications={() => naviga(dashboard.indirizzo + pagineDiApp.notifiche)}
        />
    );
}
