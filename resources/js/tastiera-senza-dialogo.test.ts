import { expect, it, vi } from 'vitest';

// v3.8.0 (zr-pm, 26/10/2026): i tasti premuti prima che arrivi il pezzo di tastiera (`tastiera.ts`) si ripetono quando arriva.
// In un file suo: il pezzo arriva una volta sola.

it('i Tab premuti prima che arrivi il pezzo di tastiera, senza un dialogo, si fermano e arrivato il pezzo portano il fuoco dove l\'avrebbe portato il browser, nell\'ordine, saltando ciò che non è una fermata; Ctrl+Tab resta del browser (v3.8.0)', async () => {
    document.body.innerHTML = '<div class="zr-shell"><button id="a">A</button><button id="b">B</button><button id="spento" disabled>Spento</button><button id="fuori" tabindex="-1">Fuori</button><button id="d">D</button></div>';
    await import('./rimedi');
    const fuochi: string[] = [];
    document.addEventListener('focusin', (evento) => fuochi.push((evento.target as HTMLElement).id));
    document.getElementById('a')?.focus();
    fuochi.length = 0;
    const premuti = [{ key: 'Tab' }, { key: 'Tab', ctrlKey: true }, { key: 'Tab' }, { key: 'Tab', shiftKey: true }].map((tasto) => new KeyboardEvent('keydown', { ...tasto, bubbles: true, cancelable: true }));

    premuti.forEach((tasto) => document.activeElement?.dispatchEvent(tasto));

    expect([premuti.map((tasto) => tasto.defaultPrevented), fuochi]).toStrictEqual([[true, false, true, true], []]);
    await vi.dynamicImportSettled();
    expect(fuochi).toStrictEqual(['b', 'd', 'b']);
});
