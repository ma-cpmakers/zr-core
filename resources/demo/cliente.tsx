// cliente.html: la cornice del cliente (dalla `v4.13.0`, voce #3319) presa dall'ingresso per le app, coi dati di
// `Cornice::datiDelCliente()` scritti qui e la barra della schermata 5 del design zr-account--il-mio-spazio. Ciò che la cornice
// chiede al modulo — un indirizzo da aprire, l'uscita — la pagina lo scrive sotto, e in console («UAT naviga», «UAT esci»). Con
// `?aziende=1` la persona è anche membro di un'azienda coi suoi workspace (schermata 13), con `?nuovo=1` il selettore ha «Crea
// il tuo workspace» (schermata 14), con `?foto=1` l'avatar ha una foto. Dalla `v4.23.0` (voce 3398) la campanella ha le notifiche da
// cliente delle rotte `/cornice/cliente/…`, finte qui sotto: tre, due non lette (la schermata 5), e con `?notifiche=0` nessuna.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CorniceDelCliente, type DatiDelCliente, type GruppoDiVoci } from '../js/app';
import '../css/zeiras.css';
import '../css/zeiras-token.css';
import '../css/cliente.css';

const scelti = new URLSearchParams(window.location.search);
const oreFa = (ore: number) => new Date(Date.now() - ore * 3_600_000).toISOString();
const notifiche = scelti.get('notifiche') === '0' ? [] : [
    { id: 'uat-c1', creata_il: oreFa(0.5), letta: false, app: 'bookings', tipo: 'bookings.cliente.prenotazione.promemoria', autore_nome: null, risorsa_nome: 'UAT Personal training', per_me: null, quando: { il: oreFa(-18), fuso: 'Europe/Rome' }, azienda: 'UAT Palestra Fit', ids: { id: 'uat-p1' } },
    { id: 'uat-c2', creata_il: oreFa(5), letta: false, app: 'bookings', tipo: 'bookings.cliente.prenotazione.spostata', autore_nome: null, risorsa_nome: null, per_me: null, quando: { il: oreFa(-42), fuso: 'Europe/Rome' }, azienda: 'UAT Studio Bianchi', ids: { id: 'uat-p2' } },
    { id: 'uat-c3', creata_il: oreFa(30), letta: true, app: 'bookings', tipo: 'bookings.cliente.prenotazione.confermata', autore_nome: null, risorsa_nome: 'UAT Visita', per_me: null, quando: { il: oreFa(-60), fuso: 'Europe/Rome' }, azienda: null, ids: {} },
];
// Le tre rotte del cliente, finte: l'elenco, la lettura di una, «Segna tutte» fino a `fino_a` (senza `altre`). Le altre richieste
// (le frasi, i pezzi) vanno al server delle pagine di prova.
const verso = window.fetch.bind(window);
window.fetch = async (indirizzo: RequestInfo | URL, opzioni?: RequestInit) => {
    const percorso = String(indirizzo);
    const rispondi = (corpo: object) => new Response(JSON.stringify({ ...corpo, persona: 'uat-cliente@example.com' }), { headers: { 'Content-Type': 'application/json' } });
    const lettura = /^\/cornice\/cliente\/notifiche\/([^/]+)\/lettura$/.exec(percorso);
    if (percorso === '/cornice/cliente/notifiche') {
        return rispondi({ data: notifiche, aggiornati_il: new Date().toISOString() });
    }
    if (lettura) {
        notifiche.forEach((una) => una.id === lettura[1] && (una.letta = true));
        return rispondi({ data: { letta: true } });
    }
    if (percorso === '/cornice/cliente/notifiche/letture') {
        const { fino_a: finoA } = JSON.parse(String(opzioni?.body)) as { fino_a: string };
        notifiche.forEach((una) => +new Date(una.creata_il) <= +new Date(finoA) && (una.letta = true));
        return rispondi({ data: { fino_a: finoA, altre: false } });
    }

    return verso(indirizzo, opzioni);
};

const nav: GruppoDiVoci[] = [
    {
        // Non «Il mio spazio»: è un testo della cornice, e la UAT (R.L) lo cercherebbe nella lingua della pagina.
        group: 'UAT Spazio',
        items: [
            { id: 'home', label: 'Panoramica', icon: 'home' },
            { id: 'appuntamenti', label: 'Appuntamenti', icon: 'calendar', count: 3, countLabel: '3 in arrivo' },
            { id: 'acquisti', label: 'Acquisti e abbonamenti', icon: 'tag' },
            { id: 'fatture', label: 'Fatture e pagamenti', icon: 'euro', count: 1, countLabel: '1 da pagare' },
            { id: 'richieste', label: 'Richieste', icon: 'message', count: 1, countLabel: '1 aperta' },
            { id: 'documenti', label: 'Documenti', icon: 'file' },
        ],
    },
    { group: 'Le tue aziende', items: [{ id: 'az-fit', label: 'UAT Palestra Fit', icon: 'building' }, { id: 'az-bianchi', label: 'UAT Studio Bianchi', icon: 'building' }] },
];

function Pagina() {
    const dati: DatiDelCliente = {
        lingua: scelti.get('lingua') ?? 'it',
        persona: { nome: 'UAT Marta Rossi', email: 'uat-cliente@example.com', impronta: null, ...(scelti.get('foto') === '1' ? { foto: '/apple-touch-icon.png' } : {}) },
        aziende: scelti.get('aziende') === '1' ? [{ id: 'uat-a1', nome: 'UAT Acme', workspace: [{ id: 'uat-w1', nome: 'UAT Vendite', slug: 'uat-vendite' }, { id: 'uat-w2', nome: 'UAT Ricerca', slug: 'uat-ricerca' }], nuovo_workspace: false }] : [],
        aggiornati_il: '2026-11-06T21:00:00.000000Z',
        non_lette: notifiche.filter((una) => !una.letta).length,
    };
    const [attiva, setAttiva] = useState('home');
    const [ultima, setUltima] = useState('');
    const voce = nav.flatMap((gruppo) => gruppo.items).find((una) => una.id === attiva)!;

    return (
        <CorniceDelCliente
            dati={dati}
            nav={nav}
            active={attiva}
            onNavigate={(id) => (setAttiva(id), setUltima(`voce ${id}`))}
            crumbs={[{ label: nav[0]!.group }, { label: voce.label }]}
            {...(scelti.get('nuovo') === '1' ? { nuovoWorkspace: '/spazio/nuovo-workspace' } : {})}
            naviga={(indirizzo) => (console.info('UAT naviga', indirizzo), setUltima(`naviga ${indirizzo}`))}
            onLogout={() => (console.info('UAT esci'), setUltima('esci'))}
        >
            <h1>UAT {voce.label}</h1>
            <p id="uat-ultima">{ultima}</p>
        </CorniceDelCliente>
    );
}

createRoot(document.getElementById('pagina')!).render(<Pagina />);
