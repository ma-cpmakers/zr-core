// Il CSS nell'ordine del README: prima il design system (il suo @import dei font è la prima regola), poi i token.
import '../zeiras/bundle.css';
import '../css/zeiras-token.css';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Cornice, type DatiDellaCornice, type GruppoDiVoci } from '../js/cornice';
import { lingue } from '../js/lingue';
import { registro } from '../js/registro';

// La pagina di prova della UAT: la `Cornice` coi dati d'esempio marcati «UAT» nella forma di `Cornice::dati()`, in ogni lingua di
// zr-core e in una che non esiste (`zz`), senza prodotto o con uno del registro. Gli stati dei prodotti coprono ogni caso: `pm`
// attivo, `crm` disponibile, `bookings` in arrivo, `reports` attivo ma «Presto» nel registro, `automations` e `content` non
// elencati. `?lingua=es&prodotto=pm` la apre già scelta; `?aziende=` sceglie le aziende del selettore (`due`, `nessuna`,
// `senza-corrente`), `?non_lette=` il numero sulla campanella, `?errore=notifiche` o `?errore=ricerca` fa fallire quella rotta,
// `?errore=letture` il primo «Segna tutte come lette» (il secondo riesce); con `?arriva=1` dal secondo caricamento delle
// notifiche ce n'è una nuova, non letta. Gli indirizzi che la cornice apre (account, notifiche, un altro
// workspace, un risultato della ricerca) non si aprono: si scrivono in console. Non entra nel pacchetto.

const datiDiProva: DatiDellaCornice = {
    lingua: 'it',
    persona: { nome: 'UAT Ada Lovelace', email: 'uat-zr-core@example.com' },
    workspace: { nome: 'UAT Marketing', slug: 'uat-marketing' },
    prodotti: { pm: 'attivo', crm: 'disponibile', bookings: 'in_arrivo', reports: 'attivo' },
};

// `due`: il workspace dei dati è il secondo della prima azienda, e un nome lungo va a capo. `senza-corrente`: il workspace dei
// dati non sta in nessuna, e resta testo come con `nessuna`.
const aziendeDiProva: Record<string, DatiDellaCornice['aziende']> = {
    due: [
        { id: 'uat-1', nome: 'UAT Acme', workspace: [{ nome: 'UAT Vendite', slug: 'uat-vendite' }, { nome: 'UAT Marketing', slug: 'uat-marketing' }] },
        { id: 'uat-2', nome: 'UAT Beta Consulenze', workspace: [{ nome: 'UAT Ricerca e sviluppo dei nuovi prodotti internazionali', slug: 'uat-ricerca' }] },
    ],
    nessuna: [],
    'senza-corrente': [{ id: 'uat-2', nome: 'UAT Beta Consulenze', workspace: [{ nome: 'UAT Ricerca', slug: 'uat-ricerca' }] }],
};

// Le voci del prodotto aperto, uguali per ogni prodotto: servono solo a vedere cosa c'è sotto il suo pulsante.
const vociDelProdotto: GruppoDiVoci[] = [
    { group: 'UAT Agenda', items: [{ id: 'oggi', label: 'UAT Oggi', icon: 'calendar' }, { id: 'risorse', label: 'UAT Risorse', icon: 'users' }] },
];

function Prova() {
    const scelti = new URLSearchParams(window.location.search);
    const [lingua, setLingua] = useState(scelti.get('lingua') ?? 'it');
    const [prodotto, setProdotto] = useState(scelti.get('prodotto') ?? '');
    const aziende = aziendeDiProva[scelti.get('aziende') ?? 'due'];
    const nonLette = Number(scelti.get('non_lette') ?? 7);

    return (
        <Cornice
            dati={{ ...datiDiProva, lingua, aziende, non_lette: nonLette }}
            product={prodotto || undefined}
            nav={prodotto ? vociDelProdotto : []}
            active={prodotto ? 'oggi' : undefined}
            crumbs={[{ label: 'UAT Marketing', href: '#' }, { label: 'UAT Q4' }]}
            create={[{ label: 'UAT Board', icon: 'board' }]}
            onLogout={() => console.info('UAT esci')}
            naviga={(indirizzo) => console.info('UAT naviga', indirizzo)}
        >
            <form id="uat-scelte">
                <label>
                    Lingua{' '}
                    <select name="lingua" value={lingua} onChange={(evento) => setLingua(evento.target.value)}>
                        {[...lingue, 'zz'].map((codice) => <option key={codice} value={codice}>{codice}</option>)}
                    </select>
                </label>{' '}
                <label>
                    Prodotto{' '}
                    <select name="prodotto" value={prodotto} onChange={(evento) => setProdotto(evento.target.value)}>
                        <option value="">nessuno (app.zeiras.com)</option>
                        {registro.filter((voce) => voce.id !== 'home').map((voce) => <option key={voce.id} value={voce.id}>{voce.id}</option>)}
                    </select>
                </label>
            </form>
        </Cornice>
    );
}

// Le rotte della cornice, finte: rispondono dopo un attimo, per vedere il caricamento, nella forma della parte server. Le
// notifiche d'esempio: due non lette di oggi, di due prodotti del registro (`pm`, `crm`), una letta ieri con un codice che il
// registro non ha e una letta nove giorni fa che non è di un'app; con `?arriva=1`, dal secondo caricamento, una nuova non letta
// nata in quel momento. «Segna tutte come lette» (POST /cornice/notifiche/letture) segna lette quelle nate fino a `fino_a` e
// risponde con l'istante in UTC; con `?errore=letture` la prima fallisce e la seconda riesce. La ricerca dà i risultati
// d'esempio che hanno la parola nel titolo, nella forma di ricerca.elenca (tipo, id e titolo, in ordine di titolo), coi tipi
// mescolati e due tipi che il registro non ha (`board.schede`, `uat-ignoto`); «ua» risponde dopo 1500 ms con un risultato suo,
// «uat» dopo 100 ms: scrivendo «uat» di seguito, la risposta di «ua» arriva dopo. Ogni richiesta si scrive in console, la POST col corpo e gli header, e così una richiesta annullata e la
// risposta che arriva lo stesso; il cookie del gettone CSRF è finto.
const fa = (minuti: number) => new Date(Date.now() - minuti * 60_000).toISOString();
const ieri = new Date();
ieri.setDate(ieri.getDate() - 1);
ieri.setHours(12, 0, 0, 0);
const notificheDiProva = [
    { id: 'uat-4', creata_il: fa(5), letta: false, app: 'pm' },
    { id: 'uat-3', creata_il: fa(3 * 60), letta: false, app: 'crm' },
    { id: 'uat-2', creata_il: ieri.toISOString(), letta: true, app: 'uat-ignota' },
    { id: 'uat-1', creata_il: fa(9 * 24 * 60), letta: true, app: null },
];
let letture = 0;
let caricamenti = 0;
const risultatiDiProva = [
    { tipo: 'board.board', id: 'uat-13', titolo: 'UAT Lancio Q1' },
    { tipo: 'board.board', id: 'uat-12', titolo: 'UAT Lancio Q4' },
    { tipo: 'board.cartelle', id: 'uat-3', titolo: 'UAT Marketing' },
    { tipo: 'board.board', id: 'uat-14', titolo: 'UAT Report marketing' },
    { tipo: 'board.schede', id: 'uat-77', titolo: 'UAT Scrivere il brief del lancio' },
    { tipo: 'uat-ignoto', id: 'uat-9', titolo: 'UAT tipo ignoto' },
];
const errore = new URLSearchParams(window.location.search).get('errore');
const arriva = new URLSearchParams(window.location.search).has('arriva');
const fetchDelBrowser = window.fetch.bind(window);
const cookieCsrf = 'XSRF-TOKEN';
document.cookie = `${cookieCsrf}=uat-gettone-csrf%3D%3D; path=/`;
window.fetch = async (indirizzo: RequestInfo | URL, opzioni?: RequestInit) => {
    const percorso = String(indirizzo);
    if (!percorso.startsWith('/cornice/')) {
        return fetchDelBrowser(indirizzo, opzioni);
    }
    console.info('UAT', opzioni?.method ?? 'GET', percorso, opzioni?.body ?? '', JSON.stringify(opzioni?.headers ?? {}));
    opzioni?.signal?.addEventListener('abort', () => console.info('UAT annullata', percorso));
    const json = (corpo: unknown, stato = 200) => new Response(JSON.stringify(corpo), { status: stato, headers: { 'Content-Type': 'application/json' } });
    const [rotta, query = ''] = percorso.split('?');
    if (rotta === '/cornice/ricerca') {
        // Non si ferma sull'annullamento: la risposta di una parola vecchia arriva lo stesso, e la cornice non la mostra.
        const parola = new URLSearchParams(query).get('q') ?? '';
        await new Promise((fatto) => setTimeout(fatto, { ua: 1500, uat: 100 }[parola] ?? 800));
        console.info('UAT risposta', percorso);
        if (errore === 'ricerca') {
            return json({ errore: 'uat_errore' }, 502);
        }

        return json({
            data: parola === 'ua'
                ? [{ tipo: 'board.board', id: 'uat-ua', titolo: 'UAT risultato vecchio di «ua»' }]
                : risultatiDiProva.filter((risultato) => risultato.titolo.toLowerCase().includes(parola.toLowerCase())),
        });
    }
    await new Promise((fatto) => setTimeout(fatto, 800));
    if (percorso === '/cornice/notifiche') {
        caricamenti += 1;
        if (errore === 'notifiche') {
            return json({ errore: 'uat_errore' }, 502);
        }
        if (arriva && caricamenti === 2) {
            notificheDiProva.unshift({ id: 'uat-5', creata_il: new Date().toISOString(), letta: false, app: 'pm' });
        }

        return json({ data: notificheDiProva });
    }
    if (percorso === '/cornice/notifiche/letture' && opzioni?.method === 'POST') {
        letture += 1;
        if (errore === 'letture' && letture === 1) {
            return json({ errore: 'uat_errore' }, 502);
        }
        const { fino_a: finoA } = JSON.parse(String(opzioni.body)) as { fino_a?: unknown };
        const istante = typeof finoA === 'string' ? new Date(finoA).getTime() : Number.NaN;
        if (Number.isNaN(istante)) {
            return json({ errore: 'dati_non_validi' }, 422);
        }
        for (const notifica of notificheDiProva) {
            if (new Date(notifica.creata_il).getTime() <= istante) {
                notifica.letta = true;
            }
        }

        return json({ data: { fino_a: new Date(istante).toISOString() } });
    }

    return json({ errore: 'non_trovato' }, 404);
};

createRoot(document.getElementById('pagina')!).render(<StrictMode><Prova /></StrictMode>);
