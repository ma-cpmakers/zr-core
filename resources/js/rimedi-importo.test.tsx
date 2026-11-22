import { existsSync, readFileSync } from 'node:fs';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import { DealCard, DealPipeline } from './zeiras/componenti';

// Richiesta 259 al design system: la DealCard di un'opportunità senza importo. Il modulo scrive `amountText="—"`: si vede «—», e il
// lettore di schermo legge «valore non indicato» nella lingua della pagina, non un trattino che tace. Dalla v5.1.0 alla v5.11.0 lo
// faceva un rimedio provvisorio della cornice (Decisione 26298); dalla v5.12.0 (#4112, lotto 0534) lo fa la DealCard da sé, e questi
// casi girano senza i rimedi e senza la cornice in pagina.

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
    await monta(<>
        <DealCard title="Senza valore" amount={0} amountText="—" />
        <DealCard title="Con valore" amount={1200} amountText="1.200 €" />
    </>);

    expect(importi()).toStrictEqual([['—', 'valore non indicato'], ['1.200 €', '1.200 €']]);
});

it('nella lingua della pagina: «valor no indicado» in spagnolo, «value not specified» in inglese e in una lingua che zr-core non ha (richiesta 259)', async () => {
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
    await monta(<DealPipeline stages={[{ id: 'a', title: 'Nuovo', deals: [{ id: '1', title: 'Senza valore', company: 'Acme', amount: 0, amountText: '—' }, { id: '2', title: 'Con valore', company: 'Acme', amount: 10, amountText: '10 €' }] }]} />);

    expect(importi()).toStrictEqual([['—', 'valore non indicato'], ['10 €', '10 €']]);
});

// La sentinella rovesciata: dalla v5.12.0 (#4112, lotto 0534, ds-1795313750-49a0) la DealCard lo fa da sé, e il rimedio è tolto:
// in rimedi.ts nessun ascolto sugli importi, e i suoi testi (resources/lingue/rimedi) non ci sono più. Deve fallire se il rimedio
// torna accanto al design system che lo fa già (il trattino e il testo nascosto due volte). I file si leggono dalla radice del repo.
it('il rimedio della 259 è tolto: rimedi.ts non tocca gli importi e i suoi testi non ci sono più, perché la DealCard lo fa da sé (v5.12.0, #4112)', () => {
    expect(readFileSync('resources/js/rimedi.ts', 'utf8')).not.toContain('zr-deal-amount');
    expect(existsSync('resources/lingue/rimedi')).toBe(false);
    expect(readFileSync('resources/zeiras/bundle.js', 'utf8')).toContain('amountMissingLabel');
});
