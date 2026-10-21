// Il CSS nell'ordine del README: prima il design system (il suo @import dei font è la prima regola), poi i token.
import '../zeiras/bundle.css';
import '../css/zeiras-token.css';
import { createInertiaApp, http, router } from '@inertiajs/react';
import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react';
import type { DatiDellaCornice, GruppoDiVoci } from '../js/cornice';
import { LayoutDellaCornice, useCornice, type LayoutDellaCorniceProps } from '../js/layout';
import { Zeiras } from '../js/zeiras';
import { chiaveDellaSessione, clientFinto, colSegno, conIlSegnoDellaLingua, conLaSessione, fermaIlSegno, istanteDellaLettura, lettura, sessioneFinta } from './parte-server-finta';
import type { Entrata } from './parte-server-finta';
import { notifichePartite, rotteFinte } from './rotte-finte';

// La pagina di prova del layout, per la UAT: `LayoutDellaCornice` sotto Inertia vera, la versione dei frontend, senza server.
// Sei pagine: «Lunga» (più alta della finestra: dà alla cornice le sue cose con `useCornice`), «Corta» (non lo chiama, e porta
// altri dati dello stesso workspace: un altro nome, 3 non lette), «Altro workspace» (un altro slug: la cornice si rifà), «Senza
// dati» (`cornice` `null`, e chiama `useCornice` lo stesso), «Percorso» (dà il percorso al layout con `Percorso.layout`) e
// «Nessuna attiva» (dà `active: null` con `useCornice`: nessuna voce della barra è attiva, anche se il layout dà «UAT Oggi»). Da una
// all'altra si passa con una visita vera di Inertia (`router.visit`) e con Indietro e Avanti del browser: la parte server è un
// client HTTP finto (parte-server-finta.ts), che risponde la pagina che l'indirizzo dice coi dati di una lettura nuova. È nella
// risposta di una visita che Inertia ridà l'oggetto di prima per i dati uguali: per questo ogni lettura porta in `cornice` il
// segno `aggiornati_il`, come lo mette la parte server di zr-core. `layout.html?pagina=corta` apre già quella. Due parametri,
// letti al caricamento e tenuti negli indirizzi: `?segno=no` toglie il segno (è la parte server della `v1.2.0`: alla visita dopo
// alla stessa pagina, dalla «Lunga» alla «Lunga», con gli stessi dati la campanella resta com'era; verso un'altra pagina Inertia
// dà comunque un oggetto nuovo, e il difetto non si vede) e `?non_lette=<n>` dà quel numero alle pagine di «UAT Marketing» (la «Lunga»
// e la «Percorso»; senza, 7). Con `?non_lette=0` i dati dicono 0 e la campanella non ha un numero; aperta, il pannello carica le
// due non lette d'esempio (rotte-finte.ts) e la campanella dice «2»; alla visita dopo, coi dati che dicono di nuovo 0, non ha più
// un numero. Per vedere una risposta letta prima di un'azione e arrivata dopo: «UAT alla Corta lenta» e «UAT alla Lunga lenta»
// fanno una visita con `lenta=6000` nell'indirizzo, che la parte server legge al clic e consegna sei secondi dopo; «UAT scarica
// prima la Corta» è il `prefetch` di Inertia, che tiene la pagina trenta secondi e la dà alla visita dopo senza un'altra
// richiesta. Le rotte della cornice sono finte (rotte-finte.ts): quelle delle notifiche dicono quando sull'orologio dei dati,
// salvo con `?segno=no`. Gli indirizzi che la cornice apre si scrivono in console. Non entra nel pacchetto.

const scelti = new URLSearchParams(window.location.search);
/** Il segno della lettura nei dati: c'è, salvo con `?segno=no`. */
const segno = colSegno(window.location.search);
// Sprint 46 · T3 (voce #2067): con `?segno=fermo` ogni lettura ha il segno della prima, anche quelle di un'altra persona: la
// parità dei segni, che dalla `v2.11.0` dà la cornice a chi arriva, si vede in un browser.
fermaIlSegno(scelti.get('segno') === 'fermo');

const marketing: DatiDellaCornice = {
    lingua: 'it',
    persona: { nome: 'UAT Ada Lovelace', email: 'uat-zr-core@example.com' },
    workspace: { nome: 'UAT Marketing', slug: 'uat-marketing' },
    prodotti: { pm: 'attivo', crm: 'disponibile', bookings: 'in_arrivo', reports: 'attivo' },
    aziende: [{ id: 'uat-1', nome: 'UAT Acme', workspace: [{ id: 'uat-ws-2', nome: 'UAT Vendite', slug: 'uat-vendite' }, { id: 'uat-ws-3', nome: 'UAT Marketing', slug: 'uat-marketing' }], nuovo_workspace: true }],
    non_lette: Number(scelti.get('non_lette') ?? 7),
};
// Lo stesso workspace dopo un cambio di nome, con altre non lette: la cornice resta montata e mostra i dati nuovi.
const marketingDopo: DatiDellaCornice = {
    ...marketing,
    workspace: { nome: 'UAT Marketing Europa', slug: 'uat-marketing' },
    aziende: [{ id: 'uat-1', nome: 'UAT Acme', workspace: [{ id: 'uat-ws-2', nome: 'UAT Vendite', slug: 'uat-vendite' }, { id: 'uat-ws-3', nome: 'UAT Marketing Europa', slug: 'uat-marketing' }], nuovo_workspace: true }],
    non_lette: 3,
};
// Un altro workspace (un altro slug): la cornice si rifà.
const vendite: DatiDellaCornice = { ...marketing, workspace: { nome: 'UAT Vendite', slug: 'uat-vendite' }, non_lette: 5 };

// Le voci del prodotto: quelle del layout, e quelle che dà la «Lunga», con una in più. Senza indirizzo: il clic chiama `onNavigate`.
const vociDellAgenda: GruppoDiVoci['items'] = [{ id: 'oggi', label: 'UAT Oggi', icon: 'calendar' }, { id: 'risorse', label: 'UAT Risorse', icon: 'users' }];
const vociDelLayout: GruppoDiVoci[] = [{ group: 'UAT Agenda', items: vociDellAgenda }];
const vociDellaLunga: GruppoDiVoci[] = [
    { group: 'UAT Agenda', items: [...vociDellAgenda, { id: 'solo-lunga', label: 'UAT Solo della Lunga', icon: 'star' }] },
];

/** Ciò che il «server» dà a ogni pagina: i dati della cornice, la cartella della «Percorso» e il numero della visita. */
interface Props {
    cornice: DatiDellaCornice | null;
    /** Solo la «Due dati»: i dati della sessione, e quelli del backoffice quando arrivano (sprint 34 · T4). */
    subito?: LayoutDellaCorniceProps['subito'];
    dopo?: LayoutDellaCorniceProps['dopo'];
    cartella?: string;
    visita?: number;
}

/** Quante volte la pagina si è montata dall'inizio della visita: `vai`, Indietro e Avanti ripartono da zero. */
let montaggi = 0;
let visite = 1;
window.addEventListener('popstate', () => {
    montaggi = 0;
});

// Sprint 52 · T5 (voce #2079): l'esempio del README («La cornice in due dati», l'evento prima della ricarica). Subito prima di ricaricare la pagina per
// un cambio di persona la cornice manda `zr-core:altra-persona`: la pagina ricorda solo che è successo, in questa scheda, e
// dopo la ricarica lo dice una volta. Niente della persona resta nel browser.
const chiaveDellAvviso = 'uat-cambiato-l-accesso';
window.addEventListener('zr-core:altra-persona', () => sessionStorage.setItem(chiaveDellAvviso, '1'));
const cambiatoLAccesso = sessionStorage.getItem(chiaveDellAvviso) !== null;
sessionStorage.removeItem(chiaveDellAvviso);

/**
 * I montaggi della pagina in questa visita e i suoi render, contati mentre si rende: mostrarli non la fa rendere di nuovo. Senza
 * `StrictMode`, che in sviluppo renderebbe due volte.
 */
function useContatori() {
    const conta = useRef({ montata: false, render: 0 });
    if (!conta.current.montata) {
        conta.current.montata = true;
        montaggi += 1;
    }
    conta.current.render += 1;

    return (
        <p>
            UAT montaggi: <output data-uat="montaggi">{montaggi}</output> · render: <output data-uat="render">{conta.current.render}</output>
        </p>
    );
}

/** Il numero delle `GET /cornice/notifiche` partite. Un componente suo: quando cambia, la pagina non si rende. */
function Partite() {
    const partite = useSyncExternalStore(notifichePartite.ascolta, notifichePartite.quante);

    return (
        <p>
            UAT GET /cornice/notifiche partite: <output data-uat="partite">{partite}</output>
        </p>
    );
}

function Lunga({ visita }: Props) {
    const contatori = useContatori();
    const [conteggio, setConteggio] = useState(0);
    const [senzaMargine, setSenzaMargine] = useState(false);
    // Un clic si segna nel DOM, non nello stato: segnarlo non fa rendere la pagina, e «render» conta solo i clic su «conta».
    const ultimoClic = useRef<HTMLOutputElement>(null);
    const segna = (testo: string) => {
        if (ultimoClic.current !== null) {
            ultimoClic.current.textContent = testo;
        }
    };

    // Funzioni nuove a ogni render, che chiudono sul conteggio di quel render: il clic deve trovare l'ultima.
    useCornice({
        nav: vociDellaLunga,
        active: 'risorse',
        onNavigate: (id) => segna(`UAT voce «${id}» col conteggio ${conteggio}`),
        create: [{ label: 'UAT Board', icon: 'board', onClick: () => segna(`UAT «+» UAT Board col conteggio ${conteggio}`) }],
        actions: <Zeiras.Button variant="secondary" size="sm" onClick={() => segna(`UAT azione col conteggio ${conteggio}`)}>UAT azione</Zeiras.Button>,
        flush: senzaMargine,
    });

    return (
        <>
            <h1>UAT Lunga</h1>
            <p>UAT visita {visita}. Chiama useCornice: il «+» con «UAT Board», la voce attiva «UAT Risorse», «UAT azione» in topbar, le voci del prodotto con «UAT Solo della Lunga».</p>
            {contatori}
            <Partite />
            <p>
                <button type="button" data-uat="conta" onClick={() => setConteggio(conteggio + 1)}>UAT conta: {conteggio}</button>{' '}
                <button type="button" data-uat="margine" onClick={() => setSenzaMargine(!senzaMargine)}>
                    {senzaMargine ? 'UAT flush sì: l\'area è senza margine e non scorre' : 'UAT flush no: l\'area ha il margine'}
                </button>
            </p>
            <p>UAT ultimo clic: <output data-uat="ultimo-clic" ref={ultimoClic} /></p>
            <Collegamenti />
            {Array.from({ length: 60 }, (_, riga) => <p key={riga}>UAT riga {riga + 1}</p>)}
            <Collegamenti />
        </>
    );
}

function Corta({ visita }: Props) {
    const contatori = useContatori();

    return (
        <>
            <h1>UAT Corta</h1>
            <p>UAT visita {visita}. Non chiama useCornice: il «+» non c'è, la voce attiva è quella del layout («UAT Oggi»). Lo stesso workspace con un altro nome, «UAT Marketing Europa», e 3 non lette: la cornice resta montata.</p>
            {contatori}
            <Partite />
            <Collegamenti />
        </>
    );
}

function AltroWorkspace({ visita }: Props) {
    const contatori = useContatori();

    return (
        <>
            <h1>UAT Altro workspace</h1>
            <p>UAT visita {visita}. Un altro workspace, «UAT Vendite», con 5 non lette: la cornice si rifà, con la ricerca vuota e i pannelli chiusi. Non chiama useCornice.</p>
            {contatori}
            <Partite />
            <Collegamenti />
        </>
    );
}

function SenzaDati({ visita }: Props) {
    const contatori = useContatori();
    // Senza i dati la cornice non c'è: `useCornice` non fa niente, e non lancia.
    useCornice({ active: 'risorse', create: [{ label: 'UAT Board', icon: 'board' }] });

    return (
        <>
            <h1>UAT Senza dati</h1>
            <p>UAT visita {visita}. I dati della cornice sono null: la pagina ha sopra la barra minima (il logo, le voci del layout ed «Esci»), senza barra laterale né topbar. Chiama useCornice lo stesso.</p>
            {contatori}
            <Collegamenti />
        </>
    );
}

function Percorso({ visita }: Props) {
    const contatori = useContatori();
    useCornice({ create: [{ label: 'UAT Board', icon: 'board' }] });

    return (
        <>
            <h1>UAT Percorso</h1>
            <p>UAT visita {visita}. Dà il percorso al layout con Percorso.layout, e il «+» con useCornice: si monta una volta sola.</p>
            {contatori}
            <Collegamenti />
        </>
    );
}

// Il percorso viene dai dati del «server»: Inertia lo dà al layout mentre lo rende, prima che la pagina si monti.
Percorso.layout = (props: Props) => ({ crumbs: [{ label: props.cornice?.workspace.nome ?? '' }, { label: props.cartella ?? '' }] });

function NessunaAttiva({ visita }: Props) {
    const contatori = useContatori();
    // `null` è un valore: vince sulla voce che dà il layout («UAT Oggi»), finché la pagina è montata.
    useCornice({ active: null });

    return (
        <>
            <h1>UAT Nessuna attiva</h1>
            <p>UAT visita {visita}. Chiama useCornice con active: null: nessuna voce della barra è attiva, anche se il layout dà «UAT Oggi». Su un'altra pagina torna attiva «UAT Oggi».</p>
            {contatori}
            <Collegamenti />
        </>
    );
}

// Sprint 34 · T4 (voce #1932): la cornice in due dati. Il «server» dà subito i dati della sessione (`subito`) e non quelli del
// backoffice (`dopo`): la pagina li chiede lei con un ricaricamento parziale di Inertia, come fa Inertia per una prop
// rimandata, e arrivano dopo l'attesa della visita (`?lenta=`, in millisecondi). Con `?dopo=mai` non li chiede: la cornice
// resta in attesa. Con `?dopo=non_letti` il backoffice non ha risposto, con `?dopo=accettazione` ha risposto col 403 di chi
// non ha accettato i documenti legali. Il campo serve a vedere che ciò che si scrive resta quando `dopo` arriva.
const comeArrivaDopo = new URLSearchParams(window.location.search).get('dopo');
let chiestoDopo = false;

/** La richiesta dei soli dati del backoffice: un ricaricamento parziale di Inertia, a cui il «server» risponde con la sessione di adesso. */
function chiediDopo() {
    chiestoDopo = true;
    router.reload({ only: ['dopo'] });
}

let conLaLinguaDiPrima = false;

/**
 * Sprint 46 · T3 (voce #2067): la rilettura del solo `subito` come arriva mentre `dopo` è in lettura dopo un cambio di lingua: la
 * sessione di adesso, la lingua confermata prima dell'ultima e il suo segno. La cornice resta nella lingua del `dopo` che ha.
 */
function rileggiSubitoConLaLinguaDiPrima() {
    conLaLinguaDiPrima = true;
    router.reload({ only: ['subito'] });
}

function DueDati({ visita, dopo }: Props) {
    const contatori = useContatori();
    useEffect(() => {
        if (dopo === undefined && comeArrivaDopo !== 'mai') {
            chiediDopo();
        }
    }, [dopo]);

    return (
        <>
            <h1>UAT Due dati</h1>
            <p>
                UAT visita {visita}. Il layout riceve subito e dopo al posto di cornice. I dati del backoffice:{' '}
                <output data-uat="dopo">{dopo === undefined || dopo === null ? 'in attesa' : dopo.non_letti ? 'non letti' : dopo.accettazione_richiesta ? 'da accettare' : 'arrivati'}</output>.
            </p>
            <p>
                <label>
                    UAT campo di prova <input data-uat="campo" type="text" />
                </label>
            </p>
            {/* Sprint 37 · T1: la rilettura del solo `dopo` da una scheda rimasta ferma. La risposta è di chi è nella sessione adesso. */}
            {scelti.has('sessione') && (
                <p>
                    <button type="button" data-uat="rileggi-dopo" onClick={chiediDopo}>UAT rileggi dopo</button>{' · '}
                    {/* Sprint 38 · T1 (voce 2027): la rilettura del solo `subito`, quella che un frontend non deve fare. Il `dopo` resta quello che la pagina aveva. */}
                    <button type="button" data-uat="rileggi-subito" onClick={() => router.reload({ only: ['subito'] })}>UAT rileggi subito</button>{' · '}
                    <button type="button" data-uat="rileggi-subito-lingua-di-prima" onClick={rileggiSubitoConLaLinguaDiPrima}>UAT rileggi subito con la lingua di prima</button>
                </p>
            )}
            {contatori}
            <Collegamenti />
        </>
    );
}

/**
 * Ciò che il «server» legge dal backoffice per la «Due dati», secondo `?dopo=`: col segno, col workspace e con chi ha letto
 * — lingua, persona e in fondo `sessione_il`, il segno di quella lettura —, come `Cornice::dopo()`, che dalla `v2.7.0` dice di
 * chi è anche `non_letti`.
 */
function dopoLetto({ lingua, persona }: Pick<DatiDellaCornice, 'lingua' | 'persona'>): NonNullable<Props['dopo']> {
    const { workspace, prodotti, aziende, non_lette } = marketing;
    const aggiornati_il = istanteDellaLettura();

    return comeArrivaDopo === 'non_letti'
        ? { lingua, persona, workspace, non_letti: true, aggiornati_il, sessione_il: aggiornati_il }
        : comeArrivaDopo === 'accettazione'
          ? { lingua, persona, workspace, prodotti: [], aziende: [], non_lette: 0, aggiornati_il, accettazione_richiesta: true, sessione_il: aggiornati_il }
          : { lingua, persona, workspace, prodotti, aziende, non_lette, aggiornati_il, sessione_il: aggiornati_il };
}

// Sprint 35 · T2 (voce #1945): con `?persona=altra` i dati della sessione della «Due dati» sono di un'altra persona, in
// inglese, nello stesso workspace. Dalla «Lunga» alla «Due dati» con `?dopo=mai` la cornice resta in attesa coi dati che aveva
// di quel workspace, e il menu del profilo e la lingua sono quelli della richiesta nuova. Il collegamento alla «Due dati» c'è solo
// con quel parametro: senza, la pagina è quella di prima, schermate comprese.
const altraPersona = scelti.get('persona') === 'altra';
const diUnAltra = { lingua: 'en', persona: { nome: 'UAT Grace Hopper', email: 'uat-zr-core-2@example.com' } };

// Sprint 36 · T1 (voci #1967, #1968): la «sessione» della parte server finta. È del browser, non della scheda
// (`localStorage`): un'altra scheda, o i due pulsanti che ci sono solo con `?sessione`, fanno entrare un'altra persona nello
// stesso workspace, e la visita dopo porta i suoi dati: nome e lingua, un'altra azienda, altri moduli, due non lette. Una
// pagina ripresa con Indietro porta invece i dati di allora, come li tiene Inertia. Senza quella chiave la pagina è quella di
// prima, schermate comprese.
//
// Sprint 37 · T1 (voci #1993, #1998, #1999): un terzo pulsante fa entrare l'altra persona su un altro workspace, «UAT
// Ricerca», qualunque pagina apra: è il workspace della sua sessione, e lo dicono anche i dati riletti dal backoffice. Con
// `?sessione` le rotte finte sanno chi è entrato: l'elenco delle notifiche e i risultati della ricerca sono i suoi, col nome nel
// testo («UAT scheda di Ada», «UAT Lancio di Grace»), anche in una scheda rimasta ferma su una pagina dell'altra persona.
//
// Sprint 40 · T5 (voce 2002): un quarto pulsante lascia la persona che c'è e le cambia la lingua, in spagnolo: dopo «UAT
// rileggi subito» e «UAT rileggi dopo», o dopo una visita, i testi della cornice sono nella lingua nuova, nome ed email gli
// stessi (col solo `subito` riletto resta la lingua del `dopo` di prima). È uno stato, non un interruttore: la chiave è una,
// e dopo «UAT entra un'altra persona» rimette la prima persona, in spagnolo. Gli stati della «sessione» stanno
// nella parte server finta (`sessioneFinta`), dove un caso li legge tutti: qui, solo i dati di chi può entrare.
// Sprint 38 · T1 (voce 2026): con `?accettazione=dopo&per_altra` è l'altra persona a non aver accettato i documenti legali. I
// dati che il backoffice dà per lei sono quelli ridotti, e le rotte finte rispondono 403 solo a lei: la prima resta com'era.
const delBackofficeDiUnAltra: Entrata['backoffice'] = scelti.get('accettazione') === 'dopo' && scelti.has('per_altra')
    ? { prodotti: [], aziende: [], non_lette: 0, accettazione_richiesta: true }
    : {
          prodotti: { pm: 'disponibile', crm: 'attivo' },
          aziende: (marketing.aziende ?? []).map((azienda) => ({ ...azienda, id: 'uat-9', nome: 'UAT Hopper' })),
          non_lette: 2,
      };

const ricerca = { nome: 'UAT Ricerca', slug: 'uat-ricerca' };
/**
 * Chi è entrato adesso, secondo ciò che i pulsanti scrivono nel `localStorage`: nessuno, finché un pulsante non lo dice; l'altra
 * persona, nello stesso workspace o su un altro; o la persona che c'è, in spagnolo.
 */
const entrata = sessioneFinta({ sessione: diUnAltra, backoffice: delBackofficeDiUnAltra }, ricerca, 'es');

const pagine = { lunga: Lunga, corta: Corta, 'altro-workspace': AltroWorkspace, 'senza-dati': SenzaDati, percorso: Percorso, 'nessuna-attiva': NessunaAttiva, 'due-dati': DueDati };
type Nome = keyof typeof pagine;

const propsDi: Record<Nome, Props> = {
    lunga: { cornice: marketing },
    corta: { cornice: marketingDopo },
    'altro-workspace': { cornice: vendite },
    'senza-dati': { cornice: null },
    percorso: { cornice: marketing, cartella: 'UAT Q4' },
    'nessuna-attiva': { cornice: marketing },
    'due-dati': { cornice: null, subito: altraPersona ? { ...diUnAltra, workspace: marketing.workspace } : { lingua: marketing.lingua, persona: marketing.persona, workspace: marketing.workspace } },
};

/** Quanto aspetta la risposta di una visita lenta, in millisecondi: il tempo di fare altro sulla pagina prima che arrivi. */
const attesaLenta = 6000;

/**
 * L'indirizzo di una pagina, coi due parametri del caricamento: un ricaricamento, o Indietro, ritrova la stessa parte server.
 * Con `lenta`, la risposta della visita a quell'indirizzo aspetta quei millisecondi.
 */
function indirizzoDi(nome: Nome, lenta?: number): string {
    const parametri = new URLSearchParams({ pagina: nome });
    for (const parametro of ['segno', 'non_lette', 'dopo', 'persona', 'sessione']) {
        const valore = scelti.get(parametro);
        if (valore !== null) {
            parametri.set(parametro, valore);
        }
    }
    if (lenta !== undefined) {
        parametri.set('lenta', String(lenta));
    }

    return `${window.location.pathname}?${parametri}`;
}

/** La pagina che un indirizzo dice (`?pagina=`): senza, o con un nome che non c'è, la «Lunga». */
function paginaDi(parametri: string): Nome {
    const nome = new URLSearchParams(parametri).get('pagina');

    return nome !== null && Object.hasOwn(pagine, nome) ? (nome as Nome) : 'lunga';
}

const paginaDellIndirizzo = () => paginaDi(window.location.search);

/** Ciò che il «server» legge per una pagina, quando la visita gli arriva: i dati di una lettura nuova (col segno, salvo `?segno=no`). */
function leggi(nome: Nome): Props {
    // La richiesta che la «Due dati» fa dopo il primo disegno porta anche ciò che il «server» ha letto dal backoffice.
    const delBackoffice = nome === 'due-dati' && chiestoDopo ? { dopo: dopoLetto(altraPersona ? diUnAltra : marketing) } : {};
    chiestoDopo = false;

    // Come `Cornice::subito()`: i dati della sessione portano l'istante in cui sono stati letti (salvo `?segno=no`).
    const letta = lettura(propsDi[nome], segno);
    const dellaSessione = letta.subito && segno ? { subito: { ...letta.subito, sessione_il: istanteDellaLettura() } } : {};

    return conLaSessione({ ...letta, ...dellaSessione, ...delBackoffice }, entrata());
}

/**
 * Ciò che il «server» legge, col segno della lingua (dalla `v2.11.0`, come `Cornice::subito()` e `Cornice::dopo()`), salvo con
 * `?segno=no`: in `dopo` l'istante della sua lettura, in `subito` quello ricordato. Sprint 46 · T3 (voce #2067).
 */
function leggiConLaLingua(nome: Nome): Props {
    const letta = leggi(nome);
    const diPrima = conLaLinguaDiPrima;
    conLaLinguaDiPrima = false;

    return segno ? conIlSegnoDellaLingua(letta, diPrima) : letta;
}

/**
 * Una visita vera di Inertia, alla parte server finta. Verso l'indirizzo in cui si è già, Inertia sostituisce la voce della
 * cronologia. Con `lenta` la risposta aspetta quei millisecondi, e porta i dati letti al clic.
 */
function vai(nome: Nome, preserveScroll = false, lenta?: number) {
    router.visit(indirizzoDi(nome, lenta), { preserveScroll });
}

function Collegamenti() {
    const apri = (nome: Nome, preserveScroll = false, lenta?: number) => (evento: MouseEvent) => {
        evento.preventDefault();
        vai(nome, preserveScroll, lenta);
    };

    return (
        <>
            <p>
                <a href={indirizzoDi('lunga')} data-uat="vai-lunga" onClick={apri('lunga')}>UAT alla Lunga</a>{' · '}
                <a href={indirizzoDi('corta')} data-uat="vai-corta" onClick={apri('corta')}>UAT alla Corta</a>{' · '}
                <a href={indirizzoDi('altro-workspace')} data-uat="vai-altro-workspace" onClick={apri('altro-workspace')}>UAT alla Altro workspace</a>{' · '}
                <a href={indirizzoDi('senza-dati')} data-uat="vai-senza-dati" onClick={apri('senza-dati')}>UAT alla Senza dati</a>{' · '}
                <a href={indirizzoDi('percorso')} data-uat="vai-percorso" onClick={apri('percorso')}>UAT alla Percorso</a>{' · '}
                <a href={indirizzoDi('nessuna-attiva')} data-uat="vai-nessuna-attiva" onClick={apri('nessuna-attiva')}>UAT alla Nessuna attiva</a>{' · '}
                {(altraPersona || scelti.has('sessione')) && <><a href={indirizzoDi('due-dati')} data-uat="vai-due-dati" onClick={apri('due-dati')}>UAT alla Due dati</a>{' · '}</>}
                <a href={indirizzoDi('lunga')} data-uat="vai-lunga-preserve-scroll" onClick={apri('lunga', true)}>UAT alla Lunga con preserveScroll</a>
            </p>
            {/* Una risposta letta adesso e arrivata dopo: la visita lenta, e la pagina che Inertia scarica prima e tiene trenta secondi. */}
            <p>
                <a href={indirizzoDi('corta', attesaLenta)} data-uat="vai-corta-lenta" onClick={apri('corta', false, attesaLenta)}>UAT alla Corta lenta</a>{' · '}
                <a href={indirizzoDi('lunga', attesaLenta)} data-uat="vai-lunga-lenta" onClick={apri('lunga', false, attesaLenta)}>UAT alla Lunga lenta</a>{' · '}
                <button type="button" data-uat="prefetch-corta" onClick={() => router.prefetch(indirizzoDi('corta'), {}, { cacheFor: 30_000 })}>UAT scarica prima la Corta</button>
            </p>
            {cambiatoLAccesso && <p role="status" data-uat="avviso-altra-persona">UAT nel browser è cambiato l'accesso: la pagina si è ricaricata, e ciò che non era salvato è andato perso.</p>}
            {/* Sprint 36 · T1: chi è entrato, per la parte server finta. Vale dalla visita dopo, in ogni scheda di questo browser. */}
            {scelti.has('sessione') && (
                <p>
                    <button type="button" data-uat="entra-altra" onClick={() => localStorage.setItem(chiaveDellaSessione, 'altra')}>UAT entra un'altra persona</button>{' · '}
                    <button type="button" data-uat="entra-altrove" onClick={() => localStorage.setItem(chiaveDellaSessione, 'altrove')}>UAT entra un'altra persona su un altro workspace</button>{' · '}
                    <button type="button" data-uat="entra-lingua" onClick={() => localStorage.setItem(chiaveDellaSessione, 'lingua')}>UAT la stessa persona cambia lingua</button>{' · '}
                    <button type="button" data-uat="entra-prima" onClick={() => localStorage.removeItem(chiaveDellaSessione)}>UAT torna la prima persona</button>
                </p>
            )}
        </>
    );
}

// Sprint 19 · T2 (voce #1652): un frontend con `exactOptionalPropertyTypes` può scrivere `undefined` in ogni prop facoltativa
// del layout. Qui sono scritte tutte, e il layout della pagina le dà a `LayoutDellaCornice` prima delle sue: se una non lo
// accetta `tsc` si ferma col file stretto, e se ne nasce una che qui manca si ferma anche con quello di base.
type OgniFacoltativa<T> = Record<{ [K in keyof T]-?: {} extends Pick<T, K> ? K : never }[keyof T], undefined>;
const propsScritteUndefined = {
    cornice: undefined, subito: undefined, dopo: undefined, product: undefined, nav: undefined, active: undefined, onNavigate: undefined, crumbs: undefined, onCrumb: undefined,
    create: undefined, actions: undefined, flush: undefined, naviga: undefined, piano: undefined, children: undefined,
} satisfies OgniFacoltativa<LayoutDellaCorniceProps> satisfies Partial<LayoutDellaCorniceProps>;

/**
 * Il layout della pagina di prova, come quello di un frontend: un componente a livello di modulo, dato a `createInertiaApp`.
 * Di ciò che Inertia gli passa (le props della pagina, e quelle di `Percorso.layout`) prende per nome i dati e il percorso.
 */
function Layout({ cornice, subito, dopo, crumbs, children }: Pick<LayoutDellaCorniceProps, 'cornice' | 'subito' | 'dopo' | 'crumbs' | 'children'>) {
    return (
        <LayoutDellaCornice
            {...propsScritteUndefined}
            cornice={cornice}
            subito={subito}
            dopo={dopo}
            product="pm"
            nav={vociDelLayout}
            active="oggi"
            crumbs={crumbs}
            onLogout={() => console.info('UAT esci')}
            naviga={(indirizzo) => console.info('UAT naviga', indirizzo)}
        >
            {children}
        </LayoutDellaCornice>
    );
}

/** Workspace e persona che la parte server darebbe adesso alla pagina che l'indirizzo dice: la «sessione» delle rotte finte. */
function sessioneDelleRotte() {
    const { cornice, subito } = conLaSessione(propsDi[paginaDellIndirizzo()], entrata());

    return cornice ?? subito;
}

// La «sessione» è nel workspace della pagina che l'indirizzo dice: cambia con la visita, anche con Indietro; se è entrata
// un'altra persona su un altro workspace, è nel suo. Le due rotte delle notifiche dicono quando sull'orologio dei dati, come la
// parte server; con `?segno=no` non hanno un orologio. Con `?sessione` le rotte sanno anche chi è entrato adesso.
rotteFinte(() => sessioneDelleRotte()?.workspace.slug, segno ? istanteDellaLettura : undefined, scelti.has('sessione') ? () => sessioneDelleRotte()?.persona : undefined);

// La parte server, finta: ogni visita di Inertia arriva qui. I dati si leggono subito, quando la visita arriva, come fa una
// parte server vera: il segno è di quell'istante, e una risposta che parte dopo porta i dati di allora. La risposta è la pagina
// che l'indirizzo della richiesta dice, ed è pronta dopo un attimo, o dopo i millisecondi di `lenta`. I montaggi ripartono da
// zero, e le visite si contano, quando la risposta è pronta, non al clic e non alla lettura: fino ad allora la pagina di prima
// è ancora montata, e una visita annullata nel frattempo non conta. Di qui passa anche lo scaricamento in anticipo: quando la
// sua risposta è pronta i montaggi ripartono da zero e la visita si conta con la pagina di prima ancora montata, e la visita
// che poi prende la pagina tenuta non passa di qui. Fra lo scaricamento e la visita i montaggi mostrati non dicono niente.
http.setClient(clientFinto((indirizzo) => {
    const nome = paginaDi(indirizzo.search);
    const letta = leggiConLaLingua(nome);

    return () => {
        montaggi = 0;
        visite += 1;

        return { component: nome, props: { errors: {}, ...letta, visita: visite } };
    };
}));

const iniziale = paginaDellIndirizzo();

// `page` dà la prima pagina senza leggerla dal DOM. Senza la barra di avanzamento di Inertia: metterebbe un `<style>` nella
// pagina, che la CSP ferma (un frontend le dà un `nonce`).
void createInertiaApp({
    page: {
        component: iniziale,
        url: window.location.pathname + window.location.search,
        props: { errors: {}, ...leggiConLaLingua(iniziale), visita: visite },
        version: null,
        flash: {},
        rescuedProps: [],
        rememberedState: {},
    },
    resolve: (nome) => pagine[nome as Nome],
    layout: () => Layout,
    progress: false,
});
