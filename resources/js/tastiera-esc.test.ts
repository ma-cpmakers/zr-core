import { expect, it, vi } from 'vitest';

// v3.8.0 (zr-pm, 26/10/2026): Esc col fuoco nel pannello della ricerca, premuto prima che arrivi il pezzo di tastiera, arriva al
// campo quando il pezzo arriva. In un file suo: il pezzo arriva una volta sola.

it('il primo Esc col fuoco nel pannello della ricerca, premuto prima che arrivi il pezzo di tastiera, non si ferma, e arrivato il pezzo passa al campo, che chiude la ricerca (v3.8.0)', async () => {
    document.body.innerHTML = '<div class="zr-shell"><div class="zr-top"><div class="zr-search"><input><div class="zr-search-panel" tabindex="0"></div></div></div></div>';
    await import('./rimedi');
    const alCampo: string[] = [];
    document.querySelector('input')?.addEventListener('keydown', (tasto) => alCampo.push(tasto.key));
    (document.querySelector('.zr-search-panel') as HTMLElement).focus();
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });

    document.activeElement?.dispatchEvent(esc);

    expect([esc.defaultPrevented, alCampo]).toStrictEqual([false, []]);
    await vi.dynamicImportSettled();
    expect(alCampo).toStrictEqual(['Escape']);
});
