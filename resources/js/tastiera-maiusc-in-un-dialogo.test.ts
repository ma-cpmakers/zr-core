import { expect, it, vi } from 'vitest';

// v3.8.1 (seconda lettura della revisione 381, N7): Maiusc+Tab premuto prima che arrivi il pezzo di tastiera, con un dialogo
// aperto e il fuoco su un elemento fuori dal giro nel mezzo del dialogo: arrivato il pezzo il fuoco va all'ultima fermata prima
// di lui, come col browser, non alla prima della pagina né a quella dopo. In un file suo: il pezzo arriva una volta sola.

it('Maiusc+Tab da un elemento fuori dal giro nel mezzo di un dialogo, prima del pezzo, porta il fuoco alla fermata prima di lui nel dialogo (v3.8.1, N7)', async () => {
    document.body.innerHTML = '<div class="zr-shell"><button id="fuori">Fuori</button><div class="zr-scrim"><div class="zr-dialog"><button id="prima">Prima</button><h2 id="titolo" tabindex="-1">Titolo</h2><button id="dopo">Dopo</button></div></div></div>';
    await import('./rimedi');
    document.getElementById('titolo')?.focus();
    const tasto = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });

    document.activeElement?.dispatchEvent(tasto);

    expect([tasto.defaultPrevented, document.activeElement?.id]).toStrictEqual([true, 'titolo']);
    await vi.dynamicImportSettled();
    expect(document.activeElement?.id).toBe('prima');
});
