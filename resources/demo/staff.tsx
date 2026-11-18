// staff.html: la cornice dello staff (dalla `v3.16.0`, voce #2944) presa dall'ingresso per le app, con una ricerca finta che
// risponde dopo 200 ms su un elenco di persone e workspace «UAT». Ciò che la cornice chiede al modulo — un indirizzo da aprire,
// l'uscita — la pagina lo scrive sotto, e in console («UAT naviga», «UAT esci»). Con `?toast=1` mostra il Toast della cornice
// (dalla `v3.17.0`, voce #2910), e con `&dialogo=1` anche un Dialog aperto sotto di lui. Con `?configurazione=0` la barra è quella
// di chi non è Superadmin, senza «Configurazione» (dalla `v4.3.0`, voce #2954), e con `?invio=1` la ricerca parte solo con Invio
// (voce #2965). Con `?ruolo=…&fino=<data ISO>` il riquadro in fondo alla barra dice il ruolo e la fine della sessione (dalla `v4.5.0`,
// voce #2989). Quante volte il modulo ha cercato lo dice `data-cerche` sul `body`. Con `?turno=1` due pulsanti chiedono il Toast di
// turno (dalla `v5.0.0`, voce #3537): uno con «Annulla» e uno senza azione, che prende il suo posto; `<html lang>` è `?lingua`.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CorniceDelloStaff, ToastDellaCornice, mostraToast } from '../js/app';
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
    document.body.dataset['cerche'] = `${Number(document.body.dataset['cerche'] ?? 0) + 1}`;
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
    // Con `?turno=1` la pagina è nella lingua di `?lingua`, come un modulo che scrive in `<html lang>` quella della persona: il
    // Toast di turno ne prende «Annulla», e il design system «Chiudi».
    const conIlTurno = scelti.get('turno') === '1';
    useEffect(() => {
        if (conIlTurno) {
            document.documentElement.lang = lingua;
        }
    }, [conIlTurno, lingua]);

    return (
        <CorniceDelloStaff
            lingua={lingua}
            persona={{ nome: 'UAT Martina Bianchi', email: 'uat-staff@example.com' }}
            nav={nav}
            active={attiva}
            onNavigate={(id) => (setAttiva(id), setUltima(`voce ${id}`))}
            configurazione={scelti.get('configurazione') !== '0'}
            ruolo={scelti.get('ruolo') ?? undefined}
            sessioneFinoA={scelti.get('fino') ?? undefined}
            menu={[{ icon: 'user', label: 'UAT il mio accesso', onClick: () => setUltima('voce del modulo') }]}
            cerca={cerca}
            cercaAllInvio={scelti.get('invio') === '1'}
            naviga={(indirizzo) => (console.info('UAT naviga', indirizzo), setUltima(`naviga ${indirizzo}`))}
            onLogout={() => (console.info('UAT esci'), setUltima('esci'))}
        >
            <h1>UAT {attiva}</h1>
            <p id="uat-ultima">{ultima}</p>
            <Dialog open={dialogo} title="UAT dialogo" onClose={() => setDialogo(false)}>UAT il Toast sta sopra</Dialog>
            {conIlTurno ? (
                <p>
                    <button
                        type="button"
                        id="uat-turno"
                        onClick={() => mostraToast({ children: 'UAT archiviata', onAction: () => setUltima('annulla di turno') })}
                    >
                        UAT Toast con l'azione
                    </button>
                    <button type="button" id="uat-turno-senza" onClick={() => mostraToast({ children: 'UAT salvata' })}>
                        UAT Toast senza azione
                    </button>
                </p>
            ) : null}
            {toast ? <ToastDellaCornice actionLabel="Annulla" onAction={() => setUltima('annulla')} onClose={() => setToast(false)}>UAT fatto</ToastDellaCornice> : null}
        </CorniceDelloStaff>
    );
}

createRoot(document.getElementById('pagina')!).render(<Pagina />);
