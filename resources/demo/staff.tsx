// staff.html: la cornice dello staff (dalla `v3.16.0`, voce #2944) presa dall'ingresso per le app, con una ricerca finta che
// risponde dopo 200 ms su un elenco di persone e workspace «UAT». Ciò che la cornice chiede al modulo — un indirizzo da aprire,
// l'uscita — la pagina lo scrive sotto, e in console («UAT naviga», «UAT esci»). Con `?toast=1` mostra il Toast della cornice
// (dalla `v3.17.0`, voce #2910), e con `&dialogo=1` anche un Dialog aperto sotto di lui.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CorniceDelloStaff, ToastDellaCornice } from '../js/app';
import { Dialog } from '../js/zeiras/componenti';
import type { ShellSearchResult } from '../zeiras/index';
import '../css/zeiras.css';
import '../css/zeiras-token.css';

const persone = ['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Katherine Johnson', 'Edsger Dijkstra', 'Barbara Liskov'].map((nome, i): ShellSearchResult => ({
    id: `uat-u${i}`,
    title: `UAT ${nome}`,
    subtitle: `uat-${nome.split(' ')[0]!.toLowerCase()}@example.com`,
    group: 'Persone',
    icon: 'user',
    container: true,
    href: `/utenti/uat-u${i}`,
}));
const workspace = ['Marketing', 'Vendite', 'Ricerca', 'Clienti', 'Assistenza', 'Amministrazione'].map((nome, i): ShellSearchResult => ({
    id: `uat-w${i}`,
    title: `UAT ${nome}`,
    subtitle: 'UAT Acme',
    group: 'Workspace',
    icon: 'grid',
    container: true,
    href: `/workspace/uat-w${i}`,
}));

/** La ricerca del modulo, finta: 200 ms, poi ciò che contiene la parola; annullata, rifiuta. */
function cerca(parola: string, segnale: AbortSignal): Promise<ShellSearchResult[]> {
    return new Promise((risolvi, rifiuta) => {
        const tempo = setTimeout(() => risolvi([...persone, ...workspace].filter((uno) => `${uno.title} ${uno.subtitle}`.toLowerCase().includes(parola.toLowerCase()))), 200);
        segnale.addEventListener('abort', () => (clearTimeout(tempo), rifiuta(segnale.reason)));
    });
}

const nav = [{ group: 'Backoffice', items: [{ id: 'panoramica', label: 'Panoramica', icon: 'grid' as const }, { id: 'utenti', label: 'Utenti', icon: 'users' as const }, { id: 'workspace', label: 'Workspace', icon: 'building' as const }] }];

function Pagina() {
    const scelti = new URLSearchParams(window.location.search);
    const lingua = scelti.get('lingua') ?? 'it';
    const [toast, setToast] = useState(scelti.get('toast') === '1');
    const [dialogo, setDialogo] = useState(scelti.get('dialogo') === '1');
    const [attiva, setAttiva] = useState('panoramica');
    const [ultima, setUltima] = useState('');

    return (
        <CorniceDelloStaff
            lingua={lingua}
            persona={{ nome: 'UAT Martina Bianchi', email: 'uat-staff@example.com' }}
            nav={nav}
            active={attiva}
            onNavigate={(id) => (setAttiva(id), setUltima(`voce ${id}`))}
            menu={[{ icon: 'user', label: 'UAT il mio accesso', onClick: () => setUltima('voce del modulo') }]}
            cerca={cerca}
            naviga={(indirizzo) => (console.info('UAT naviga', indirizzo), setUltima(`naviga ${indirizzo}`))}
            onLogout={() => (console.info('UAT esci'), setUltima('esci'))}
        >
            <h1>UAT {attiva}</h1>
            <p id="uat-ultima">{ultima}</p>
            <Dialog open={dialogo} title="UAT dialogo" onClose={() => setDialogo(false)}>UAT il Toast sta sopra</Dialog>
            {toast ? <ToastDellaCornice actionLabel="Annulla" onAction={() => setUltima('annulla')} onClose={() => setToast(false)}>UAT fatto</ToastDellaCornice> : null}
        </CorniceDelloStaff>
    );
}

createRoot(document.getElementById('pagina')!).render(<Pagina />);
