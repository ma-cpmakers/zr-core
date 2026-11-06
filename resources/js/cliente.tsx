import { useLayoutEffect, type ReactNode } from 'react';
import type { MenuItem, ShellCrumb } from '../zeiras/index';
import { nelSelettore, pagineDiApp, type GruppoDiVoci, type WorkspaceDeiDati } from './cornice';
import { DELL_INGRESSO, fileDelleLingue, linguaPronta, testi, useLinguaPronta, type TestiDellaCornice } from './lingue';
import { nelWorkspace, registro } from './registro';
import { SaltaAlContenuto } from './salto';
import { AppShell } from './zeiras/componenti';
import inglese from '../lingue/cliente/en.json';

// La cornice del cliente (dalla `v4.13.0`, voce #3319, Decisione 21687 di zr-pm-07, da zr-home #3317): l'`AppShell` del design
// system per chi entra in Zeiras come cliente di un'azienda, senza un workspace suo — le pagine «Il mio spazio» di zr-home
// (design zr-account--il-mio-spazio). La riempiono i dati di `Cornice::datiDelCliente()`, letti col gettone dell'accesso, e il
// modulo con le voci della barra. Nel selettore «Come cliente › Il mio spazio», attivo, e le aziende in cui la persona è anche
// membro; niente riquadro del piano, niente menu Moduli. La campanella resta vuota, perché l'`AppShell` la disegna sempre
// (richiesta 64 al design system) e le notifiche del cliente aspettano zr-backoffice #3323; la ricerca non si vede: per il cliente
// il backoffice non ne ha una. La regola che la nasconde sta in `resources/css/cliente.css`, che il modulo importa col CSS del
// design system: importata da qui, la build la porterebbe anche nel CSS delle app che non montano questa cornice. Non chiama
// nessuna rotta della cornice.

/** I testi del cliente, per lingua: un file loro (`resources/lingue/cliente/`), fuori dalle lingue della cornice, come quelli dello staff. */
const file = import.meta.glob<TestiDelCliente>('../lingue/cliente/*.json', { eager: true, import: 'default' });

type TestiDelCliente = Pick<TestiDellaCornice, 'notificationsEmptyText'> & {
    /** «Il mio spazio» e il gruppo in cui sta nel selettore, «Come cliente». */
    personal: string;
    personalGroup: string;
    /** In fondo al selettore, quando la persona non ha aziende: «Crea il tuo workspace». */
    firstWorkspace: string;
};

/** I testi del cliente in una lingua: quelli che la lingua non ha, o ha vuoti, e quelli di una lingua che non c'è sono in inglese. */
function testiDelCliente(lingua: string): TestiDelCliente {
    // Si leggono qui e non in cima al modulo: una chiamata in cima la build non la può togliere, e un'app che non monta questa
    // cornice se la porterebbe nell'ingresso.
    const { perCodice, fileDi } = fileDelleLingue(file);
    const scelti: Partial<TestiDelCliente> = perCodice.get(fileDi(lingua)!) ?? {};

    return Object.fromEntries(Object.entries(inglese).map(([chiave, testo]) => [chiave, scelti[chiave as keyof TestiDelCliente]?.trim() ? scelti[chiave as keyof TestiDelCliente] : testo])) as TestiDelCliente;
}

/** I dati della cornice del cliente, come li dà `Cornice::datiDelCliente()` della parte server. */
export interface DatiDelCliente {
    /** La lingua della persona (`it`, `es`, `en`…): in una lingua che zr-core non ha, la cornice è in inglese. */
    lingua: string;
    /** Chi è entrato; `foto` è l'indirizzo della sua foto, se ce l'ha (nell'avatar); senza, le iniziali. */
    persona: { nome: string; email: string; impronta?: string | null | undefined; foto?: string | undefined };
    /** Le aziende in cui la persona è membro, coi loro workspace: vuota per chi è solo cliente. */
    aziende: { id: string; nome: string; workspace: WorkspaceDeiDati[]; nuovo_workspace?: boolean | undefined }[];
    aggiornati_il?: string | undefined;
    /** I documenti legali in vigore non sono accettati: i dati sono ridotti (nessuna azienda, nessuna foto), e la pagina la decide il modulo. */
    accettazione_richiesta?: true | undefined;
}

export interface CorniceDelClienteProps {
    /** I dati di `Cornice::datiDelCliente()`. */
    dati: DatiDelCliente;
    /** Le voci della barra, coi loro gruppi: tutte del modulo. */
    nav?: GruppoDiVoci[] | undefined;
    /** L'id della voce attiva; con `null` nessuna. */
    active?: string | null | undefined;
    /** Il clic su una voce della barra. */
    onNavigate?: ((id: string) => void) | undefined;
    /** Il percorso: l'ultima voce è la pagina. */
    crumbs?: ShellCrumb[] | undefined;
    onCrumb?: ((voce: ShellCrumb, indice: number) => void) | undefined;
    /** Altro in topbar. */
    actions?: ReactNode;
    /** L'area della pagina senza margine. */
    flush?: boolean | undefined;
    /** L'indirizzo della pagina in cui si crea un workspace: con questo, «Crea il tuo workspace» in fondo al selettore porta lì; senza, non c'è. */
    nuovoWorkspace?: string | undefined;
    /** «Esci»: la sessione la chiude il modulo. Obbligatorio: senza, «Esci» non farebbe niente. */
    onLogout: () => void;
    /** Come si apre un indirizzo (Profilo, Impostazioni, un workspace, «Crea il tuo workspace»): di norma il browser ci va. */
    naviga?: ((indirizzo: string) => void) | undefined;
    children?: ReactNode;
}

/** La Dashboard: le pagine di account stanno al suo indirizzo, e un workspace del selettore si apre lì. */
const dashboard = registro.find((voce) => voce.id === 'home')!;

/**
 * La cornice del cliente nella sua lingua, come quella dei moduli: finché la lingua non è pronta non si disegna, e con lei la
 * pagina dentro; a un cambio di lingua resta in quella di prima finché la nuova non è pronta (`useLinguaPronta`).
 */
export function CorniceDelCliente(props: CorniceDelClienteProps) {
    const lingua = useLinguaPronta(props.dati.lingua);

    return lingua === undefined ? null : <NellaSuaLingua {...props} lingua={lingua} />;
}

function NellaSuaLingua({ lingua, dati, nav = [], active, nuovoWorkspace, onLogout, naviga = (indirizzo) => location.assign(indirizzo), children, ...pagina }: CorniceDelClienteProps & { lingua: string }) {
    const t = testi(lingua);
    // I rimedi provvisori di tastiera, come per la `Cornice`: arrivano a cornice montata, e a ogni cambio di lingua riprendono i nomi.
    useLayoutEffect(() => {
        void import('./rimedi').then((rimedi) => rimedi.via(naviga, t.mainContent, t.searchResults), () => undefined);
    }, [t.mainContent, t.searchResults]);
    // Se la lingua non è arrivata la cornice è in italiano, la lingua dell'ingresso: anche i testi del cliente, come per lo staff.
    const dello = testiDelCliente(linguaPronta(lingua) ? lingua : DELL_INGRESSO);
    const account = (pagina: keyof typeof pagineDiApp) => () => naviga(dashboard.indirizzo + pagineDiApp[pagina]);
    // Il menu del profilo dello spazio cliente (schermata 5): niente Piano e niente Azienda, che sono di un workspace.
    const menu: MenuItem[] = [
        { icon: 'user', label: t.profile, onClick: account('profile') },
        { icon: 'settings', label: t.accountSettings, onClick: account('settings') },
        { sep: true },
        { icon: 'arrow', label: t.logout, onClick: onLogout },
    ];

    return (
        <>
            <SaltaAlContenuto testo={t.skipToContent} />
            <AppShell
                {...Object.fromEntries(Object.entries(pagina).filter(([, valore]) => valore !== undefined))}
                // Con `null` nessuna voce: un id che nessuna voce ha.
                {...(active === null ? { active: '-' + nav.flatMap((gruppo) => gruppo.items.map((voce) => voce.id)).join('-') } : active === undefined ? {} : { active })}
                // La classe che nasconde il campo della ricerca (`resources/css/cliente.css`): l'`AppShell` la mette sulla `zr-shell`.
                {...{ className: 'zr-cornice-del-cliente' }}
                nav={nav}
                user={dati.persona.nome}
                email={dati.persona.email}
                {...(dati.persona.foto ? { userPhoto: dati.persona.foto } : {})}
                personal={{ label: dello.personal, active: true }}
                companies={dati.aziende.map((azienda) => ({ id: azienda.id, name: azienda.nome, workspaces: azienda.workspace.map(nelSelettore) }))}
                // Un workspace porta alla sua Dashboard: dallo spazio cliente non c'è un prodotto aperto da tenere.
                onSelectWorkspace={(slug) => naviga(nelWorkspace(dashboard.indirizzo, slug))}
                {...(nuovoWorkspace ? { onNewWorkspace: () => naviga(nuovoWorkspace) } : {})}
                plan={false}
                settingsHref={dashboard.indirizzo + pagineDiApp.settings}
                accountItems={menu}
                notifications={[]}
                labels={{ ...t, ...dello }}
            >
                {children}
            </AppShell>
        </>
    );
}
