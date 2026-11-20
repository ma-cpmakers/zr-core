import { readFileSync } from 'node:fs';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import { DealCard, DealPipeline } from './zeiras/componenti';

// Richiesta 259 al design system, rimedio provvisorio della v5.1.0 (Decisione 26298, sì di zr-pm-74 del 18/11; #3930 di zr-crm):
// la DealCard di un'opportunità senza importo. Il modulo scrive `amountText="—"`: si vede «—», e il lettore di schermo legge
// «valore non indicato» nella lingua della pagina, non un trattino che tace. In un file suo: i rimedi si mettono in ascolto
// una volta sola, quando arrivano.

const cambiato = () => new Promise((fatto) => setTimeout(fatto));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let radice: ReturnType<typeof createRoot> | undefined;
afterEach(() => {
    act(() => radice?.unmount());
    radice = undefined;
    document.documentElement.lang = '';
});
// La pagina in italiano, come la scrive il modulo (`<html lang>`), dove il caso non ne sceglie un'altra.

/** Ciò che si vede e ciò che si legge dell'importo di ogni carta: il testo senza ciò che è nascosto, e quello senza `aria-hidden`. */
const importi = () => [...document.querySelectorAll<HTMLElement>('.zr-deal-amount')].map((importo) => {
    const visibile = [...importo.childNodes].map((nodo) => (nodo instanceof HTMLElement && nodo.classList.contains('zr-visually-hidden') ? '' : nodo.textContent)).join('');
    const letto = [...importo.childNodes].map((nodo) => (nodo instanceof HTMLElement && nodo.getAttribute('aria-hidden') === 'true' ? '' : nodo.textContent)).join('');

    return [visibile, letto];
});

const monta = async (figlio: React.ReactNode) => {
    document.documentElement.lang ||= 'it';
    const posto = document.body.appendChild(document.createElement('main'));
    radice = createRoot(posto);
    act(() => radice!.render(figlio));
    await cambiato();
};

it('una carta con `amountText="—"` mostra «—» e al lettore di schermo dice «valore non indicato»; quella con un importo resta com\'è (richiesta 259)', async () => {
    document.body.innerHTML = '<div class="zr-shell"></div>';
    await import('./rimedi');
    await monta(<>
        <DealCard title="Senza valore" amount={0} amountText="—" />
        <DealCard title="Con valore" amount={1200} amountText="1.200 €" />
    </>);

    expect(importi()).toStrictEqual([['—', 'valore non indicato'], ['1.200 €', '1.200 €']]);
});

it('nella lingua della pagina: «valor no indicado» in spagnolo, «value not specified» in inglese e in una lingua che zr-core non ha (richiesta 259)', async () => {
    document.body.innerHTML = '<div class="zr-shell"></div>';
    await import('./rimedi');
    const letti: string[] = [];
    for (const lingua of ['es-ES', 'en', 'de']) {
        document.documentElement.lang = lingua;
        await monta(<DealCard title="Senza valore" amount={0} amountText="—" />);
        letti.push(importi()[0]![1]!);
        act(() => radice!.unmount());
        document.querySelector('main')!.remove();
    }

    expect(letti).toStrictEqual(['valor no indicado', 'value not specified', 'value not specified']);
});

it('quando l\'importo arriva il rimedio se ne va, e torna quando l\'importo manca di nuovo: React riscrive il testo della carta (richiesta 259)', async () => {
    document.body.innerHTML = '<div class="zr-shell"></div>';
    await import('./rimedi');
    await monta(<DealCard title="Opportunità" amount={0} amountText="—" />);
    const prima = importi();
    act(() => radice!.render(<DealCard title="Opportunità" amount={500} amountText="500 €" />));
    await cambiato();
    const dopo = importi();
    act(() => radice!.render(<DealCard title="Opportunità" amount={0} amountText="—" />));
    await cambiato();

    expect([prima, dopo, importi()]).toStrictEqual([[['—', 'valore non indicato']], [['500 €', '500 €']], [['—', 'valore non indicato']]]);
});

it('anche sulle carte della DealPipeline, che le disegna da sé (richiesta 259)', async () => {
    document.body.innerHTML = '<div class="zr-shell"></div>';
    await import('./rimedi');
    await monta(<DealPipeline stages={[{ id: 'a', title: 'Nuovo', deals: [{ id: '1', title: 'Senza valore', company: 'Acme', amount: 0, amountText: '—' }, { id: '2', title: 'Con valore', company: 'Acme', amount: 10, amountText: '10 €' }] }]} />);

    expect(importi()).toStrictEqual([['—', 'valore non indicato'], ['10 €', '10 €']]);
});

it('senza la cornice in pagina i rimedi non toccano la carta (richiesta 259)', async () => {
    document.body.innerHTML = '';
    await import('./rimedi');
    await monta(<DealCard title="Senza valore" amount={0} amountText="—" />);

    expect(document.querySelector('.zr-deal-amount')!.innerHTML).toBe('—');
});

// La sentinella: oggi la DealCard del design system scrive `amountText` così com'è dentro l'importo, e il tipo `Deal` non ha un
// testo per il lettore di schermo. Quando la 259 arriva, uno dei due cambia: questo caso diventa rosso e il rimedio si toglie
// (`importiNonIndicati` in rimedi.ts, i testi in resources/lingue/rimedi, la riga TC.11 di uat-cornice, la carta 1.2 della pagina di prova).
// I file si leggono dalla radice del repo, da dove gira vitest.
it('la DealCard del design system non dice ancora da sé l\'importo che manca: quando lo fa, il rimedio si toglie (richiesta 259)', () => {
    const bundle = readFileSync('resources/zeiras/bundle.js', 'utf8');
    const tipi = readFileSync('resources/zeiras/index.d.ts', 'utf8');
    const deal = tipi.slice(tipi.indexOf('export interface Deal '), tipi.indexOf('}', tipi.indexOf('export interface Deal ')));

    expect(bundle).toContain('h(\'strong\', { className: \'zr-deal-amount\' }, p.amountText != null ? p.amountText : dealMoney(p))');
    expect(deal.match(/\b\w+(?=\?: )/g)).toStrictEqual(['color', 'amountText', 'owner', 'probability', 'age']);
});
