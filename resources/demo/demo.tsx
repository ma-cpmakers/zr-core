// Il CSS nell'ordine del README: prima il design system (il suo @import dei font è la prima regola), poi i token.
import '../zeiras/bundle.css';
import '../css/zeiras-token.css';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Cornice, type CorniceProps, type DatiDellaCornice, type GruppoDiVoci } from '../js/cornice';
import { lingue } from '../js/lingue';
import { registro } from '../js/registro';
import { rotteFinte } from './rotte-finte';

// La pagina di prova della UAT: la `Cornice` coi dati d'esempio marcati «UAT» nella forma di `Cornice::dati()`, in ogni lingua di
// zr-core e in una che non esiste (`zz`), senza prodotto o con uno del registro. Gli stati dei prodotti coprono ogni caso: `pm`
// attivo, `crm` disponibile, `bookings` in arrivo, `reports` attivo ma «Presto» nel registro, `automations` scritto `undefined` e
// `content` non elencato. `?lingua=es&prodotto=pm` la apre già scelta; `?aziende=` sceglie le aziende del selettore (`due`, `membro`, `nessuna`,
// `senza-corrente`), `?non_lette=` il numero sulla campanella, `?errore=notifiche` o `?errore=ricerca` fa fallire quella rotta,
// `?errore=letture` il primo «Segna tutte come lette» (il secondo riesce); con `?altre=1` il primo che riesce si ferma come la
// parte server a un tetto (`altre: true`: la più recente resta da leggere) e il secondo le segna tutte; con `?arriva=1` dal
// secondo caricamento delle notifiche ce n'è una nuova, non letta. Con `?attiva=nessuna` la pagina dice che nessuna voce della barra è attiva
// (`active={null}`), senza prodotto e dentro un prodotto; senza, è attiva la Dashboard, e dentro un prodotto «UAT Oggi». Gli
// indirizzi che la cornice apre (account, notifiche, un altro workspace, un risultato della ricerca) non si aprono: si
// scrivono in console. Non entra nel pacchetto.

const datiDiProva: DatiDellaCornice = {
    lingua: 'it',
    persona: { nome: 'UAT Ada Lovelace', email: 'uat-zr-core@example.com' },
    workspace: { nome: 'UAT Marketing', slug: 'uat-marketing' },
    // `automations` scritto `undefined`, come può fare un frontend: vale come un prodotto che manca, «Presto».
    prodotti: { pm: 'attivo', crm: 'disponibile', bookings: 'in_arrivo', reports: 'attivo', automations: undefined },
};

// `due`: il workspace dei dati è il secondo della prima azienda, e un nome lungo va a capo; in quell'azienda la persona può
// creare un workspace, nell'altra no, e in fondo al selettore c'è «Nuovo workspace». `membro`: le stesse aziende, ma la persona
// è solo membro in tutte e due, e «Nuovo workspace» non c'è. `senza-corrente`: il workspace dei dati non sta in nessuna, e
// resta testo come con `nessuna`; lì l'`id` del workspace e `nuovo_workspace` sono scritti `undefined`, come può fare un frontend.
const due: NonNullable<DatiDellaCornice['aziende']> = [
    { id: 'uat-1', nome: 'UAT Acme', workspace: [{ id: 'uat-ws-2', nome: 'UAT Vendite', slug: 'uat-vendite' }, { id: 'uat-ws-3', nome: 'UAT Marketing', slug: 'uat-marketing' }], nuovo_workspace: true },
    { id: 'uat-2', nome: 'UAT Beta Consulenze', workspace: [{ id: 'uat-ws-5', nome: 'UAT Ricerca e sviluppo dei nuovi prodotti internazionali', slug: 'uat-ricerca' }], nuovo_workspace: false },
];
const aziendeDiProva: Record<string, DatiDellaCornice['aziende']> = {
    due,
    membro: due.map((azienda) => ({ ...azienda, nuovo_workspace: false })),
    nessuna: [],
    'senza-corrente': [{ id: 'uat-2', nome: 'UAT Beta Consulenze', workspace: [{ id: undefined, nome: 'UAT Ricerca', slug: 'uat-ricerca' }], nuovo_workspace: undefined }],
};

// Le voci del prodotto aperto, uguali per ogni prodotto: servono solo a vedere cosa c'è sotto il suo pulsante.
const vociDelProdotto: GruppoDiVoci[] = [
    { group: 'UAT Agenda', items: [{ id: 'oggi', label: 'UAT Oggi', icon: 'calendar' }, { id: 'risorse', label: 'UAT Risorse', icon: 'users' }] },
];

// Sprint 19 · T2 (voce #1652): un frontend con `exactOptionalPropertyTypes` può scrivere `undefined` in ogni prop facoltativa di
// `Cornice` e in ogni chiave facoltativa dei suoi dati. Qui sono scritte tutte, e la pagina le dà alla cornice prima delle sue:
// se una non lo accetta `tsc` si ferma col file stretto, e se ne nasce una che qui manca si ferma anche con quello di base.
type OgniFacoltativa<T> = Record<{ [K in keyof T]-?: {} extends Pick<T, K> ? K : never }[keyof T], undefined>;
const propsScritteUndefined = {
    product: undefined, nav: undefined, active: undefined, onNavigate: undefined, crumbs: undefined, onCrumb: undefined, create: undefined,
    actions: undefined, flush: undefined, naviga: undefined, piano: undefined, children: undefined,
} satisfies OgniFacoltativa<CorniceProps> satisfies Partial<CorniceProps>;
const datiScrittiUndefined = { aziende: undefined, non_lette: undefined, aggiornati_il: undefined } satisfies OgniFacoltativa<DatiDellaCornice> satisfies Partial<DatiDellaCornice>;

function Prova() {
    const scelti = new URLSearchParams(window.location.search);
    const [lingua, setLingua] = useState(scelti.get('lingua') ?? 'it');
    const [prodotto, setProdotto] = useState(scelti.get('prodotto') ?? '');
    const aziende = aziendeDiProva[scelti.get('aziende') ?? 'due'];
    const nonLette = Number(scelti.get('non_lette') ?? 7);

    return (
        <Cornice
            {...propsScritteUndefined}
            dati={{ ...datiScrittiUndefined, ...datiDiProva, lingua, aziende, non_lette: nonLette }}
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
