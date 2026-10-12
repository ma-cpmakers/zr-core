import { createElement, type ComponentType, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { CorniceProps, DatiDellaCornice } from '../../js/cornice';

// Le tre app di prova del peso (resources/js/peso.test.ts) montano la cornice allo stesso modo, coi dati più piccoli che
// accetta: cambia solo da dove la prendono. Non si aprono in un browser: si costruiscono e si pesano.
const dati: DatiDellaCornice = {
    lingua: 'it',
    persona: { nome: 'Ada Prova', email: 'ada@example.com' },
    workspace: { nome: 'Prova', slug: 'prova' },
    prodotti: { pm: 'attivo' },
};

export function monta(Cornice: ComponentType<CorniceProps>, pagina?: ReactNode): void {
    const radice = document.getElementById('app');
    if (radice) {
        createRoot(radice).render(createElement(Cornice, { dati, onLogout: () => undefined }, pagina));
    }
}
