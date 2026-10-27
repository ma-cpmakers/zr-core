import { expect, it, vi } from 'vitest';

// v3.8.0 (zr-pm, 26/10/2026): i rimedi della sola tastiera stanno in un pezzo che arriva al primo tasto, e il primo tasto non si
// perde. In un file suo, come gli altri due casi: il pezzo arriva una volta sola, e qui deve arrivare dopo il tasto.

it('con un dialogo aperto, il Tab dall\'ultimo pulsante del dialogo, premuto prima che arrivi il pezzo di tastiera, si ferma; arrivato il pezzo, il fuoco va al primo pulsante del dialogo, e da lì il Tab torna del browser. Un Tab che la pagina aveva già tenuto per sé, prima, resta suo (v3.8.0)', async () => {
    document.body.innerHTML = '<div class="zr-shell"><button id="dietro">Dietro</button><div class="zr-scrim"><div class="zr-dialog"><button id="primo">Primo</button><button id="ultimo">Ultimo</button></div></div><button id="dopo">Dopo</button></div>';
    await import('./rimedi');
    document.getElementById('ultimo')?.focus();
    // Come un campo che col Tab accetta un suggerimento: il primo Tab lo tiene la pagina.
    document.getElementById('ultimo')?.addEventListener('keydown', (tasto) => tasto.preventDefault(), { once: true });
    const [dellaPagina, primoTab] = [1, 2].map(() => new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));

    document.activeElement?.dispatchEvent(dellaPagina as KeyboardEvent);
    document.activeElement?.dispatchEvent(primoTab as KeyboardEvent);

    expect([primoTab?.defaultPrevented, document.activeElement?.id]).toStrictEqual([true, 'ultimo']);
    await vi.dynamicImportSettled();
    expect(document.activeElement?.id).toBe('primo');

    const dopo = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });

    document.activeElement?.dispatchEvent(dopo);

    expect(dopo.defaultPrevented).toBe(false);
});
