// Il CSS nell'ordine del README: prima il design system (il suo @import dei font è la prima regola), poi i token.
import '../zeiras/bundle.css';
import '../css/zeiras-token.css';
import { StrictMode, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { CorniceProps, DatiDellaCornice, GruppoDiVoci } from '../js/cornice';
import { lingue } from '../js/lingue';
import { Button, DetailPanel, Dialog } from '../js/zeiras/componenti';
import { registro } from '../js/registro';
import { rotteFinte } from './rotte-finte';

// La pagina di prova della UAT: la `Cornice` coi dati d'esempio marcati «UAT» nella forma di `Cornice::dati()`, in ogni lingua di
// zr-core e in una che non esiste (`zz`), senza prodotto o con uno del registro. Gli stati dei prodotti coprono ogni caso: `pm`
// attivo, `crm` disponibile, `bookings` in arrivo, `reports` attivo ma «Presto» nel registro, `automations` scritto `undefined` e
// `content` non elencato. `?lingua=es&prodotto=pm` la apre già scelta; `?aziende=` sceglie le aziende del selettore (`due`, `membro`, `nessuna`,
// `senza-corrente`), `?non_lette=` il numero sulla campanella, `?errore=notifiche` o `?errore=ricerca` fa fallire quella rotta,
// `?errore=letture` il primo «Segna tutte come lette» (il secondo riesce), `?errore=lettura` la lettura della notifica che un
// clic apre (la risorsa si apre lo stesso, e la notifica resta da leggere), e con `?da_leggere=1` le prime otto del CRM (`?crm=1`) sono da leggere; con `?altre=1` il primo che riesce si ferma come la
// parte server a un tetto (`altre: true`: la più recente resta da leggere) e il secondo le segna tutte; con `?arriva=1` dal
// secondo caricamento delle notifiche ce n'è una nuova, non letta; con `?chi=1` le notifiche dicono chi ha fatto, su che cosa e
// per chi (una rivolta alla persona, una solo in «Tutte», una su un'app, col nome del prodotto al posto del codice, le altre com'erano). Con `?attiva=nessuna` la pagina dice che nessuna voce della barra è attiva
// (`active={null}`), senza prodotto e dentro un prodotto; senza, è attiva la Dashboard, e dentro un prodotto «UAT Oggi». Gli
// indirizzi che la cornice apre (account, notifiche, un altro workspace, un risultato della ricerca) non si aprono: si
// scrivono in console; con `?crm=1` (le notifiche del CRM, rotte-finte.ts), `?viste=1` (quelle delle viste di una board),
// `?opportunita=1` (le nove dei tipi nuovi del CRM: opportunità, attività e ciò che viene assegnato) o `?schede=1` (una scheda
// assegnata, una menzione in un commento e una scheda eliminata, di Project Management; e la ricerca trova anche una scheda)
// o `?frasi=1` (tre di Project Management: chi e che cosa in una frase, solo chi, e il titolo col nome sotto)
// o `?motivi=1` (le due dei motivi di perdita del CRM: un titolo, nessuna destinazione)
// l'ultimo si legge anche in pagina, sotto le scelte. Con `?accorpata=1` in cima alle notifiche ce n'è una che racconta più
// azioni, con l'ora dell'ultima (non apre niente), e con `?nomi_crm=1` cinque del CRM con chi ha fatto: un'azienda e
// un'opportunità col nome nel titolo, e un contatto, un'attività eliminata e un'azienda senza nome con solo chi.
// Con `?conto=1` cinque di Project Management che dicono, sotto il titolo, quante azioni raccontano e in quale board sta la cosa.
// Con `?senza_crm=1` il CRM nel workspace di prova è in arrivo, e non si può aprire; con `?crm_attivo=1` è attivo, e la ricerca
// nomina anche le sue fonti (contatti, aziende, opportunità) e ne trova i risultati (rotte-finte.ts): fra le opportunità una è
// aperta e ha solo pipeline e fase, l'altra è vinta e la sua seconda riga finisce con l'esito nella lingua. In ogni caso la ricerca
// nomina per ultimi i membri del workspace, e ne trova uno («UAT Katherine Johnson», col ruolo nella lingua): un clic lo
// aprirebbe fra i membri di app. Con `?senza_moduli=1` nel workspace di prova nessun modulo è attivo (Project Management e
// Report sono `disponibile`, qualunque cosa dicano gli altri due parametri: `senza_moduli` vince anche su `?senza_crm=1`, e il CRM
// resta `disponibile`, non in arrivo): l'invito della ricerca nomina i soli membri, e la ricerca trova solo quello, per ogni parola. Le fonti le nomina l'invito, a ricerca aperta: il segnaposto del campo è lo stesso in ogni caso.
// Non entra nel pacchetto.
// La cornice gliela dà chi la monta (`avvia`, in fondo): index.tsx, per index.html, quella dell'ingresso di sempre; app.tsx,
// per app.html, quella dell'ingresso per le app, e sotto le scelte scrive se `window.Zeiras` c'è.

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
const datiScrittiUndefined = { aziende: undefined, non_lette: undefined, aggiornati_il: undefined, sessione_il: undefined, accettazione_richiesta: undefined, in_attesa: undefined, non_letti: undefined } satisfies OgniFacoltativa<DatiDellaCornice> satisfies Partial<DatiDellaCornice>;

/**
 * Con `?rimedi=1`: un `Dialog` e un `DetailPanel` da aprire, per provare coi tasti veri che Tab resta dentro (il dialogo
 * sempre, il pannello sotto 720 px). Il dialogo si apre anche da dentro il pannello: uno sopra l'altro. «UAT attendi» apre
 * un dialogo senza niente su cui fermarsi, che dopo quattro secondi si chiude da sé; «UAT attendi e poi fatto» al suo posto
 * ne apre un altro, con la «×». Con `&iframe=<lato>` il dialogo ha in fondo un `iframe` largo e alto quanto detto (anche 0).
 */
function ProvaDeiRimedi() {
    const [dialogo, setDialogo] = useState(false);
    const [pannello, setPannello] = useState(false);
    const [attesa, setAttesa] = useState<'no' | 'attendi' | 'fatto'>('no');
    const lato = new URLSearchParams(window.location.search).get('iframe');
    const apriIlDialogo = <Button variant="secondary" onClick={() => setDialogo(true)}>UAT apri il dialogo</Button>;
    const attendi = (poi: 'no' | 'fatto') => {
        setAttesa('attendi');
        setTimeout(() => setAttesa(poi), 4000);
    };

    return (
        <div id="uat-rimedi" className="zr-stack">
            <p>{apriIlDialogo} <Button variant="secondary" onClick={() => setPannello(true)}>UAT apri il pannello</Button> <a href="#uat-dopo" id="uat-dopo">UAT dopo</a></p>
            <p><Button variant="secondary" onClick={() => attendi('no')}>UAT attendi</Button> <Button variant="secondary" onClick={() => attendi('fatto')}>UAT attendi e poi fatto</Button></p>
            {pannello ? (
                <DetailPanel label="UAT scheda" head="UAT Lancio corso" onClose={() => setPannello(false)} foot={<Button variant="secondary">UAT commenta</Button>}>
                    <p><input aria-label="UAT titolo" defaultValue="UAT Lancio corso" /></p>
                    <p>{apriIlDialogo}</p>
                </DetailPanel>
            ) : null}
            <Dialog open={dialogo} title="UAT nuova scheda" onClose={() => setDialogo(false)} footer={<><Button variant="secondary" onClick={() => setDialogo(false)}>UAT annulla</Button> <Button onClick={() => setDialogo(false)}>UAT salva</Button>{lato !== null ? <iframe title="UAT riquadro" width={lato} height={lato} /> : null}</>}>
                <p><input aria-label="UAT nome" /></p>
                <p><Button variant="ghost" disabled>UAT spento</Button></p>
            </Dialog>
            <Dialog open={attesa === 'attendi'} title="UAT attendi"><p>UAT quattro secondi</p></Dialog>
            <Dialog open={attesa === 'fatto'} title="UAT fatto" onClose={() => setAttesa('no')}><p>UAT fatto</p></Dialog>
        </div>
    );
}

function Prova({ Cornice, inFondo }: { Cornice: ComponentType<CorniceProps>; inFondo?: ReactNode }) {
    const scelti = new URLSearchParams(window.location.search);
    const [lingua, setLingua] = useState(scelti.get('lingua') ?? 'it');
    const [prodotto, setProdotto] = useState(scelti.get('prodotto') ?? '');
    const aziende = aziendeDiProva[scelti.get('aziende') ?? 'due'];
    const nonLette = Number(scelti.get('non_lette') ?? 7);
    const senzaCrm = scelti.has('senza_crm');
    const crmAttivo = scelti.has('crm_attivo');
    const senzaModuli = scelti.has('senza_moduli');
    // Con `?accettazione=1` i dati sono quelli di chi non ha accettato i documenti legali in vigore, come li dà la parte server
    // dalla `v1.14.0`: nessun modulo (una lista vuota, `[]`), nessuna azienda, zero non lette, e `accettazione_richiesta: true` in fondo. Con
    // `?accettazione=dopo` i dati sono quelli di sempre, e lo dicono le rotte finte (rotte-finte.ts).
    const daAccettare = scelti.get('accettazione') === '1';
    // Gli stessi dati finché non cambiano, come da una parte server: ridati a ogni disegno, la cornice li prenderebbe per dati
    // nuovi, e dopo «Segna tutte come lette» un clic che naviga rimetterebbe il numero sulla campanella.
    const dati = useMemo(() => {
        const colCrm: DatiDellaCornice['prodotti'] = senzaCrm ? { ...datiDiProva.prodotti, crm: 'in_arrivo' } : crmAttivo ? { ...datiDiProva.prodotti, crm: 'attivo' } : datiDiProva.prodotti;
        const prodotti: DatiDellaCornice['prodotti'] = senzaModuli ? { ...datiDiProva.prodotti, pm: 'disponibile', reports: 'disponibile' } : colCrm;

        const ridotti = daAccettare ? { prodotti: [], aziende: [], non_lette: 0, accettazione_richiesta: true } : {};

        return { ...datiScrittiUndefined, ...datiDiProva, prodotti, lingua, aziende, non_lette: nonLette, ...ridotti };
    }, [senzaCrm, crmAttivo, senzaModuli, lingua, aziende, nonLette, daAccettare]);
    // L'ultimo indirizzo che la cornice ha aperto: in pagina solo con `?crm=1`, `?viste=1`, `?opportunita=1`, `?schede=1`, `?frasi=1` o `?motivi=1`, così le
    // altre pagine restano com'erano.
    const [aperto, setAperto] = useState<string>();

    return (
        <Cornice
            {...propsScritteUndefined}
            dati={dati}
            product={prodotto || undefined}
            nav={prodotto ? vociDelProdotto : []}
            active={scelti.get('attiva') === 'nessuna' ? null : prodotto ? 'oggi' : undefined}
            crumbs={[{ label: 'UAT Marketing', href: '#' }, { label: 'UAT Q4' }]}
            create={[{ label: 'UAT Board', icon: 'board' }]}
            onLogout={() => console.info('UAT esci')}
            naviga={(indirizzo) => {
                console.info('UAT naviga', indirizzo);
                setAperto(indirizzo);
            }}
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
            {(scelti.has('crm') || scelti.has('viste') || scelti.has('opportunita') || scelti.has('schede') || scelti.has('frasi') || scelti.has('motivi')) && aperto !== undefined ? <p id="uat-aperto">UAT aperto: <code>{aperto}</code></p> : null}
            {scelti.has('rimedi') ? <ProvaDeiRimedi /> : null}
            {inFondo}
        </Cornice>
    );
}

// Le rotte della cornice sono finte (rotte-finte.ts): la «sessione» è nel workspace dei dati di prova. Con `?sessione=<slug>` è
// in un altro, come quando la persona entra in un altro workspace da un'altra scheda: l'elenco delle notifiche e la ricerca
// dicono quello, e lì la cornice apre la risorsa di una notifica e un risultato; le non lette di quell'elenco non contano sulla
// campanella. Con `?sessione=` (vuoto) la parte server finta non dice di quale workspace sono, come una di prima della
// `v1.12.0`: un clic su una notifica apre la pagina delle notifiche, e la ricerca mostra il suo errore.
const sessione = new URLSearchParams(window.location.search).get('sessione');
rotteFinte(() => (sessione === null ? datiDiProva.workspace.slug : sessione === '' ? undefined : sessione));

/** Monta la pagina di prova con quella cornice; `inFondo` è ciò che la pagina scrive sotto le scelte. */
export function avvia(Cornice: ComponentType<CorniceProps>, inFondo?: ReactNode): void {
    createRoot(document.getElementById('pagina')!).render(<StrictMode><Prova Cornice={Cornice} inFondo={inFondo} /></StrictMode>);
}
