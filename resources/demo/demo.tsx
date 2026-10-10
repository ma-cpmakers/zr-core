// Il CSS nell'ordine del README: prima il design system (il suo @import dei font è la prima regola), poi i token.
import '../zeiras/bundle.css';
import '../css/zeiras-token.css';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Cornice, type DatiDellaCornice, type GruppoDiVoci } from '../js/cornice';
import { lingue } from '../js/lingue';
import { registro } from '../js/registro';
import { rotteFinte } from './rotte-finte';

// La pagina di prova della UAT: la `Cornice` coi dati d'esempio marcati «UAT» nella forma di `Cornice::dati()`, in ogni lingua di
// zr-core e in una che non esiste (`zz`), senza prodotto o con uno del registro. Gli stati dei prodotti coprono ogni caso: `pm`
// attivo, `crm` disponibile, `bookings` in arrivo, `reports` attivo ma «Presto» nel registro, `automations` e `content` non
// elencati. `?lingua=es&prodotto=pm` la apre già scelta; `?aziende=` sceglie le aziende del selettore (`due`, `nessuna`,
// `senza-corrente`), `?non_lette=` il numero sulla campanella, `?errore=notifiche` o `?errore=ricerca` fa fallire quella rotta,
// `?errore=letture` il primo «Segna tutte come lette» (il secondo riesce); con `?arriva=1` dal secondo caricamento delle
// notifiche ce n'è una nuova, non letta. Con `?attiva=nessuna` la pagina dice che nessuna voce della barra è attiva
// (`active={null}`), senza prodotto e dentro un prodotto; senza, è attiva la Dashboard, e dentro un prodotto «UAT Oggi». Gli
// indirizzi che la cornice apre (account, notifiche, un altro workspace, un risultato della ricerca) non si aprono: si
// scrivono in console. Non entra nel pacchetto.

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
            active={scelti.get('attiva') === 'nessuna' ? null : prodotto ? 'oggi' : undefined}
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

// Le rotte della cornice sono finte (rotte-finte.ts): la «sessione» è nel workspace dei dati di prova.
rotteFinte(() => datiDiProva.workspace.slug);

createRoot(document.getElementById('pagina')!).render(<StrictMode><Prova /></StrictMode>);
