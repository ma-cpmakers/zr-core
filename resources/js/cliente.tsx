import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import type { MenuItem, ShellCrumb, ShellNotification } from '../zeiras/index';
import { chiama, mostra } from './chiamate';
import { nelSelettore, pagineDiApp, piuRecente, quando, senzaUndefined, type GruppoDiVoci, type WorkspaceDeiDati } from './cornice';
import { campanella, chiediLaCampanella, DELL_INGRESSO, fileDelleLingue, linguaDeiTesti, linguaPronta, nomePulito, testi, useLinguaPronta, type TestiDellaCornice } from './lingue';
import { nelWorkspace, prodottoDelRegistro, registro } from './registro';
import type { NotificaDellaCornice } from './servizi';
import { AppShell } from './zeiras/componenti';
import inglese from '../lingue/cliente/en.json';

// La cornice del cliente (dalla `v4.13.0`, voce #3319, Decisione 21687 di zr-pm-07, da zr-home #3317): l'`AppShell` del design
// system per chi entra in Zeiras come cliente di un'azienda, senza un workspace suo — le pagine «Il mio spazio» di zr-home
// (design zr-account--il-mio-spazio). La riempiono i dati di `Cornice::datiDelCliente()`, letti col gettone dell'accesso, e il
// modulo con le voci della barra. Nel selettore «Come cliente › Il mio spazio», attivo, e le aziende in cui la persona è anche
// membro; niente riquadro del piano, niente menu Moduli. La campanella, dalla `v4.23.0` (voce 3398), ha le notifiche da cliente
// delle rotte `/cornice/cliente/…` (fino alla `v4.22` era vuota); la ricerca non si vede: per il cliente il backoffice non ne ha
// una (`search={false}`, dalla `v4.18.0`: niente campo né Ctrl/Cmd+K, che resta della pagina). Delle altre rotte della cornice usa
// solo quella della foto, nell'avatar.

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
    /** Quante notifiche da cliente la persona non ha letto (dalla `v4.23.0`): il numero sulla campanella. Senza, nessun numero. */
    non_lette?: number | undefined;
    /**
     * I documenti legali in vigore non sono accettati: i dati sono ridotti (nessuna azienda, nessuna foto, nessun numero sulla
     * campanella, che non si apre), e la pagina la decide il modulo.
     */
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
    /**
     * Il clic su una voce del percorso, con l'evento (dalla `v4.18.0`): con `preventDefault` la voce la gestisce il modulo;
     * altrimenti un clic semplice su un indirizzo di questa origine passa da `naviga`.
     */
    onCrumb?: ((voce: ShellCrumb, indice: number, evento: MouseEvent<HTMLAnchorElement>) => void) | undefined;
    /** Altro in topbar. */
    actions?: ReactNode;
    /** L'area della pagina senza margine. */
    flush?: boolean | undefined;
    /**
     * L'indirizzo della pagina in cui si crea un workspace: con questo, in fondo al selettore, «Crea il tuo workspace» per chi non ha
     * aziende, e «Nuovo workspace» se una delle sue aziende lo permette (`nuovo_workspace`); senza, non c'è.
     */
    nuovoWorkspace?: string | undefined;
    /** «Esci»: la sessione la chiude il modulo. Obbligatorio: senza, «Esci» non farebbe niente. */
    onLogout: () => void;
    /** Come si apre un indirizzo (Profilo, Impostazioni, un workspace, «Crea il tuo workspace»): di norma il browser ci va. */
    naviga?: ((indirizzo: string) => void) | undefined;
    children?: ReactNode;
}

/** La Dashboard: le pagine di account stanno al suo indirizzo, e un workspace del selettore si apre lì. */
const dashboard = registro.find((voce) => voce.id === 'home')!;

/** Le rotte delle notifiche da cliente (dalla `v4.23.0`): le stesse tre della `Cornice`, col gettone dell'accesso e senza workspace. */
const DEL_CLIENTE = '/cornice/cliente';

/** Una notifica da cliente come la dà GET /cornice/cliente/notifiche: quella della `Cornice`, più l'azienda di cui la persona è cliente. */
type NotificaDelCliente = NotificaDellaCornice & { azienda?: string | null };

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
    const { persona } = dati;
    // I rimedi provvisori di tastiera, come per la `Cornice`: arrivano a cornice montata.
    useLayoutEffect(() => void import('./rimedi').catch(() => undefined), []);
    // Chi è a schermo, come per la `Cornice` (`mostra`): una lettura che risponde quando la cornice è di un'altra persona non apre niente.
    useLayoutEffect(() => (mostra(persona), () => mostra(persona, 1)), [persona.email]);

    // La campanella (dalla `v4.23.0`, voce 3398). Il numero è quello dei dati, finché un clic non lo fa scendere: vale per quei dati,
    // e i dati di una visita nuova (un altro `aggiornati_il`, un altro numero) lo riportano a sé. I dati ridotti non hanno numero.
    const diQuestiDati = `${dati.aggiornati_il}|${dati.non_lette}`;
    const [sceso, setSceso] = useState<{ di: string; n: number }>();
    const nonLette = dati.accettazione_richiesta ? 0 : sceso?.di === diQuestiDati ? sceso.n : (dati.non_lette ?? 0);
    // L'elenco si chiede a ogni apertura del pannello, e conta l'ultima richiesta partita. Con le notifiche arrivano le frasi della
    // lingua, dal pezzo della campanella; a elenco vuoto non servono. Una risposta che non è un elenco, o le frasi che non arrivano,
    // sono lo stato d'errore del pannello, con «Riprova».
    const [notifiche, setNotifiche] = useState<{ stato: 'ready' | 'loading' | 'error'; elenco: NotificaDelCliente[] }>({ stato: 'ready', elenco: [] });
    const ultima = useRef(0);
    const carica = () => {
        const questa = ++ultima.current;
        const allUltima = (stato: typeof notifiche) => questa === ultima.current && setNotifiche(stato);
        allUltima({ stato: 'loading', elenco: [] });
        chiama(DEL_CLIENTE + '/notifiche', persona)
            .then((corpo) => {
                const elenco = (corpo as { data?: unknown } | null)?.data;
                if (!Array.isArray(elenco)) {
                    throw new Error(`GET ${DEL_CLIENTE}/notifiche: data`);
                }

                return elenco.length > 0 ? chiediLaCampanella().then((pezzo) => pezzo.caricaFrasi(lingua)).then(() => elenco) : elenco;
            })
            .then((elenco) => allUltima({ stato: 'ready', elenco }), () => allUltima({ stato: 'error', elenco: [] }));
    };
    // Le frasi sono di una lingua: se la lingua cambia con l'elenco in pagina, il pannello aspetta quelle della nuova.
    const frasi = campanella?.frasiPronte(lingua);
    const senzaFrasi = notifiche.stato === 'ready' && notifiche.elenco.length > 0 && !frasi;
    useEffect(() => {
        if (senzaFrasi) {
            chiediLaCampanella().then((pezzo) => pezzo.caricaFrasi(lingua)).then(() => setNotifiche((prima) => ({ ...prima })), () => setNotifiche({ stato: 'error', elenco: [] }));
        }
    }, [senzaFrasi, lingua]);
    // Una riga: il titolo delle frasi (il servizio e la data, quando ci sono), sotto l'azienda — o, senza, ciò che le frasi mettono
    // sotto —, l'ora, l'icona e il tono del prodotto da cui viene; non il suo nome, che è di Zeiras e non dell'azienda.
    const adesso = new Date();
    const righe: ShellNotification[] = frasi
        ? notifiche.elenco.map((notifica) => {
              const riga = campanella!.rigaConLeFrasi(frasi, notifica, lingua);
              const delProdotto = prodottoDelRegistro(notifica.app);

              return senzaUndefined({ id: notifica.id, title: riga.titolo, text: nomePulito(notifica.azienda) ?? riga.sotto, time: quando(notifica.creata_il, linguaDeiTesti(lingua), adesso), icon: delProdotto?.icona, tone: delProdotto?.tono, unread: !notifica.letta });
          })
        : [];
    // Il clic su una riga la segna letta, letta o no, e alla lettura riuscita apre la sua pagina in «Il mio spazio», se ne ha una
    // (`destinazioneDellaNotificaDelCliente`: solo con l'id che la parte server dà a una notifica da cliente). Il pezzo c'è: le righe
    // si mostrano con le sue frasi.
    const apri = ({ id }: ShellNotification) => {
        const notifica = notifiche.elenco.find((una) => una.id === id)!;
        campanella!.segnaLetta(id, persona, DEL_CLIENTE).then(() => {
            if (!notifica.letta) {
                setNotifiche((prima) => ({ ...prima, elenco: prima.elenco.map((una) => (una.id === id ? { ...una, letta: true } : una)) }));
                setSceso({ di: diQuestiDati, n: Math.max(0, nonLette - 1) });
            }
            const risorsa = campanella!.destinazioneDellaNotificaDelCliente(notifica);
            if (risorsa) {
                naviga(risorsa);
            }
        }, () => undefined);
    };
    // «Segna tutte come lette» fino alla più recente delle caricate: se la parte server dice che ne restano, il numero resta e
    // l'elenco si chiede di nuovo; altrimenti il numero va a 0. Una richiesta che non riesce non cambia niente.
    const finoA = piuRecente(notifiche.elenco);
    const segnaTutte = () =>
        void campanella!.segnaLetteFinoA(finoA!, undefined, persona, DEL_CLIENTE).then(({ altre }) => {
            if (altre) {
                return carica();
            }
            setSceso({ di: diQuestiDati, n: 0 });
            setNotifiche((prima) => ({ ...prima, elenco: prima.elenco.map((notifica) => ({ ...notifica, letta: true })) }));
        }, () => undefined);
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
        <AppShell
            {...Object.fromEntries(Object.entries(pagina).filter(([, valore]) => valore !== undefined))}
            // Con `null` nessuna voce.
            {...(active === undefined ? {} : { active })}
            nav={nav}
            user={dati.persona.nome}
            email={dati.persona.email}
            {...(dati.persona.foto ? { userPhoto: dati.persona.foto } : {})}
            personal={{ label: dello.personal, active: true }}
            companies={dati.aziende.map((azienda) => ({ id: azienda.id, name: azienda.nome, workspaces: azienda.workspace.map(nelSelettore) }))}
            // Un workspace porta alla sua Dashboard: dallo spazio cliente non c'è un prodotto aperto da tenere.
            onSelectWorkspace={(slug) => naviga(nelWorkspace(dashboard.indirizzo, slug))}
            navigate={naviga}
            // Con le aziende, un workspace nuovo solo dove una lo permette («Nuovo workspace»): a chi è solo membro no. Senza, è
            // il primo («Crea il tuo workspace»).
            {...(nuovoWorkspace && (dati.aziende.length === 0 || dati.aziende.some((azienda) => azienda.nuovo_workspace)) ? { onNewWorkspace: () => naviga(nuovoWorkspace) } : {})}
            plan={false}
            search={false}
            settingsHref={dashboard.indirizzo + pagineDiApp.settings}
            accountItems={menu}
            unreadCount={nonLette}
            notifications={righe}
            notificationsState={senzaFrasi ? 'loading' : notifiche.stato}
            // Coi dati ridotti la campanella non si apre su niente: le rotte risponderebbero 403.
            {...(dati.accettazione_richiesta ? {} : { onNotificationsOpen: carica, onRetryNotifications: carica, onOpenNotification: apri, ...(finoA && { onMarkAllRead: segnaTutte }) })}
            labels={{ ...t, ...dello }}
        >
            {children}
        </AppShell>
    );
}
