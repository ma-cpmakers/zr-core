// Il CSS nell'ordine del README: prima il design system (il suo @import dei font è la prima regola), poi i token.
import '../zeiras/bundle.css';
import '../css/zeiras-token.css';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Cornice, type GruppoDiVoci, type PersonaDellaCornice } from '../js/cornice';
import { lingue } from '../js/lingue';

// La pagina di prova della UAT dello sprint 1: la `Cornice` con dati d'esempio marcati «UAT», in ogni lingua di zr-core e in una
// che non esiste (`zz`), senza prodotto o con Bookings. `?lingua=es&prodotto=bookings` la apre già scelta. Gli indirizzi di
// account, notifiche e workspace non si aprono: si scrivono in console. Non entra nel pacchetto.

const persona: PersonaDellaCornice = {
    nome: 'UAT Ada Lovelace',
    email: 'uat-zr-core@example.com',
    piano: 'UAT Team',
    aziende: [
        { id: 'uat-acme', name: 'UAT Acme', workspaces: [{ slug: 'uat-marketing', name: 'UAT Marketing', tone: 'plum' }, { slug: 'uat-sales', name: 'UAT Sales' }] },
        { id: 'uat-globex', name: 'UAT Globex', workspaces: [{ slug: 'uat-globex', name: 'UAT Globex HQ' }] },
    ],
    workspace: 'uat-marketing',
    nonLette: 3,
};

const vociDiBookings: GruppoDiVoci[] = [
    { group: 'UAT Agenda', items: [{ id: 'oggi', label: 'UAT Oggi', icon: 'calendar' }, { id: 'risorse', label: 'UAT Risorse', icon: 'users' }] },
];

function Prova() {
    const scelti = new URLSearchParams(window.location.search);
    const [lingua, setLingua] = useState(scelti.get('lingua') ?? 'it');
    const [prodotto, setProdotto] = useState(scelti.get('prodotto') ?? '');

    return (
        <Cornice
            lingua={lingua}
            persona={persona}
            product={prodotto || undefined}
            nav={prodotto ? vociDiBookings : []}
            active={prodotto ? 'oggi' : undefined}
            crumbs={[{ label: 'UAT Marketing', href: '#' }, { label: 'UAT Q4' }]}
            create={[{ label: 'UAT Board', icon: 'board' }]}
            onNewWorkspace={(azienda) => console.info('UAT nuovo workspace', azienda)}
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
                        <option value="bookings">bookings</option>
                    </select>
                </label>
            </form>
        </Cornice>
    );
}

createRoot(document.getElementById('pagina')!).render(<StrictMode><Prova /></StrictMode>);
