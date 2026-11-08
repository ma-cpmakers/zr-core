import { expect, it, vi } from 'vitest';

// v3.8.1 (seconda lettura della revisione 381, N2 e N3): un Tab fermato in un pannello di dettaglio, prima che arrivi il pezzo di tastiera, e
// poi il pannello chiuso col mouse. I tasti dopo non si fermano più, perché nessuno trattiene il fuoco; e arrivato il pezzo il
// fuoco resta dov'è, non salta alla prima fermata della pagina. In un file suo: il pezzo arriva una volta sola.

it('chiuso il pannello dopo un Tab fermato, i tasti dopo restano della pagina e arrivato il pezzo il fuoco non si sposta (v3.8.1, N2 e N3)', async () => {
    // Dal lotto 0522 (richiesta 4) il `Dialog` trattiene il Tab da sé: chi lo trattiene qui è il pannello di dettaglio, a tutta
    // pagina sotto 720 px.
    vi.stubGlobal('matchMedia', (domanda: string) => ({ matches: domanda === '(max-width: 720px)', addEventListener: () => {}, removeEventListener: () => {} }));
    document.body.innerHTML = '<div class="zr-shell"><button id="fuori">Fuori</button><aside class="zr-detail"><button id="prima">Prima</button><button id="dopo">Dopo</button></aside></div>';
    await import('./rimedi');
    const fuochi: string[] = [];
    document.addEventListener('focusin', (evento) => fuochi.push((evento.target as HTMLElement).id));
    document.getElementById('prima')?.focus();
    fuochi.length = 0;
    const [tab, lettera] = ['Tab', 'a'].map((key) => new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

    document.activeElement?.dispatchEvent(tab!);
    document.querySelector('.zr-detail')?.remove();
    document.activeElement?.dispatchEvent(lettera!);

    expect([tab!.defaultPrevented, lettera!.defaultPrevented]).toStrictEqual([true, false]);
    await vi.dynamicImportSettled();
    expect(fuochi).toStrictEqual([]);
});
