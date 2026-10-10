// Il CSS nell'ordine del README: prima il design system (il suo @import dei font è la prima regola), poi i token.
import '../zeiras/bundle.css';
import '../css/zeiras-token.css';
import { createInertiaApp, http, router } from '@inertiajs/react';
import { useRef, useState, useSyncExternalStore, type MouseEvent } from 'react';
import type { DatiDellaCornice, GruppoDiVoci } from '../js/cornice';
import { LayoutDellaCornice, useCornice, type LayoutDellaCorniceProps } from '../js/layout';
import { Zeiras } from '../js/zeiras';
import { clientFinto, colSegno, istanteDellaLettura, lettura } from './parte-server-finta';
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

const marketing: DatiDellaCornice = {
    lingua: 'it',
    persona: { nome: 'UAT Ada Lovelace', email: 'uat-zr-core@example.com' },
    workspace: { nome: 'UAT Marketing', slug: 'uat-marketing' },
    prodotti: { pm: 'attivo', crm: 'disponibile', bookings: 'in_arrivo', reports: 'attivo' },
    aziende: [{ id: 'uat-1', nome: 'UAT Acme', workspace: [{ id: 'uat-ws-2', nome: 'UAT Vendite', slug: 'uat-vendite' }, { id: 'uat-ws-3', nome: 'UAT Marketing', slug: 'uat-marketing' }] }],
    non_lette: Number(scelti.get('non_lette') ?? 7),
};
// Lo stesso workspace dopo un cambio di nome, con altre non lette: la cornice resta montata e mostra i dati nuovi.
const marketingDopo: DatiDellaCornice = {
    ...marketing,
    workspace: { nome: 'UAT Marketing Europa', slug: 'uat-marketing' },
    aziende: [{ id: 'uat-1', nome: 'UAT Acme', workspace: [{ id: 'uat-ws-2', nome: 'UAT Vendite', slug: 'uat-vendite' }, { id: 'uat-ws-3', nome: 'UAT Marketing Europa', slug: 'uat-marketing' }] }],
    non_lette: 3,
};
// Un altro workspace (un altro slug): la cornice si rifà.
const vendite: DatiDellaCornice = { ...marketing, workspace: { nome: 'UAT Vendite', slug: 'uat-vendite' }, non_lette: 5 };

// Le voci del prodotto: quelle del layout, e quelle che dà la «Lunga», con una in più. Senza indirizzo: il clic chiama `onNavigate`.
const vociDelLayout: GruppoDiVoci[] = [
    { group: 'UAT Agenda', items: [{ id: 'oggi', label: 'UAT Oggi', icon: 'calendar' }, { id: 'risorse', label: 'UAT Risorse', icon: 'users' }] },
];
const vociDellaLunga: GruppoDiVoci[] = [
    { group: 'UAT Agenda', items: [...vociDelLayout[0].items, { id: 'solo-lunga', label: 'UAT Solo della Lunga', icon: 'star' }] },
];

/** Ciò che il «server» dà a ogni pagina: i dati della cornice, la cartella della «Percorso» e il numero della visita. */
interface Props {
    cornice: DatiDellaCornice | null;
    cartella?: string;
    visita?: number;
}

/** Quante volte la pagina si è montata dall'inizio della visita: `vai`, Indietro e Avanti ripartono da zero. */
let montaggi = 0;
let visite = 1;
window.addEventListener('popstate', () => {
    montaggi = 0;
});

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
            <p>UAT visita {visita}. I dati della cornice sono null: la pagina si vede da sola, senza barra né topbar. Chiama useCornice lo stesso.</p>
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

const pagine = { lunga: Lunga, corta: Corta, 'altro-workspace': AltroWorkspace, 'senza-dati': SenzaDati, percorso: Percorso, 'nessuna-attiva': NessunaAttiva };
type Nome = keyof typeof pagine;

const propsDi: Record<Nome, Props> = {
    lunga: { cornice: marketing },
    corta: { cornice: marketingDopo },
    'altro-workspace': { cornice: vendite },
    'senza-dati': { cornice: null },
    percorso: { cornice: marketing, cartella: 'UAT Q4' },
    'nessuna-attiva': { cornice: marketing },
};

/** Quanto aspetta la risposta di una visita lenta, in millisecondi: il tempo di fare altro sulla pagina prima che arrivi. */
const attesaLenta = 6000;

/**
 * L'indirizzo di una pagina, coi due parametri del caricamento: un ricaricamento, o Indietro, ritrova la stessa parte server.
 * Con `lenta`, la risposta della visita a quell'indirizzo aspetta quei millisecondi.
 */
function indirizzoDi(nome: Nome, lenta?: number): string {
    const parametri = new URLSearchParams({ pagina: nome });
    for (const parametro of ['segno', 'non_lette']) {
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
    return lettura(propsDi[nome], segno);
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
                <a href={indirizzoDi('lunga')} data-uat="vai-lunga-preserve-scroll" onClick={apri('lunga', true)}>UAT alla Lunga con preserveScroll</a>
            </p>
            {/* Una risposta letta adesso e arrivata dopo: la visita lenta, e la pagina che Inertia scarica prima e tiene trenta secondi. */}
            <p>
                <a href={indirizzoDi('corta', attesaLenta)} data-uat="vai-corta-lenta" onClick={apri('corta', false, attesaLenta)}>UAT alla Corta lenta</a>{' · '}
                <a href={indirizzoDi('lunga', attesaLenta)} data-uat="vai-lunga-lenta" onClick={apri('lunga', false, attesaLenta)}>UAT alla Lunga lenta</a>{' · '}
                <button type="button" data-uat="prefetch-corta" onClick={() => router.prefetch(indirizzoDi('corta'), {}, { cacheFor: 30_000 })}>UAT scarica prima la Corta</button>
            </p>
        </>
    );
}

/**
 * Il layout della pagina di prova, come quello di un frontend: un componente a livello di modulo, dato a `createInertiaApp`.
 * Di ciò che Inertia gli passa (le props della pagina, e quelle di `Percorso.layout`) prende per nome i dati e il percorso.
 */
function Layout({ cornice, crumbs, children }: Pick<LayoutDellaCorniceProps, 'cornice' | 'crumbs' | 'children'>) {
    return (
        <LayoutDellaCornice
            cornice={cornice}
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

// La «sessione» è nel workspace della pagina che l'indirizzo dice: cambia con la visita, anche con Indietro. Le due rotte delle
// notifiche dicono quando sull'orologio dei dati, come la parte server; con `?segno=no` non hanno un orologio.
rotteFinte(() => propsDi[paginaDellIndirizzo()].cornice?.workspace.slug, segno ? istanteDellaLettura : undefined);

// La parte server, finta: ogni visita di Inertia arriva qui. I dati si leggono subito, quando la visita arriva, come fa una
// parte server vera: il segno è di quell'istante, e una risposta che parte dopo porta i dati di allora. La risposta è la pagina
// che l'indirizzo della richiesta dice, ed è pronta dopo un attimo, o dopo i millisecondi di `lenta`. I montaggi ripartono da
// zero, e le visite si contano, quando la risposta è pronta, non al clic e non alla lettura: fino ad allora la pagina di prima
// è ancora montata, e una visita annullata nel frattempo non conta. Di qui passa anche lo scaricamento in anticipo: quando la
// sua risposta è pronta i montaggi ripartono da zero e la visita si conta con la pagina di prima ancora montata, e la visita
// che poi prende la pagina tenuta non passa di qui. Fra lo scaricamento e la visita i montaggi mostrati non dicono niente.
http.setClient(clientFinto((indirizzo) => {
    const nome = paginaDi(indirizzo.search);
    const letta = leggi(nome);

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
        props: { errors: {}, ...leggi(iniziale), visita: visite },
        version: null,
        flash: {},
        rescuedProps: [],
        rememberedState: {},
    },
    resolve: (nome) => pagine[nome as Nome],
    layout: () => Layout,
    progress: false,
});
