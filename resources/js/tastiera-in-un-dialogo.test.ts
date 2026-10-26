import { expect, it, vi } from 'vitest';

// v3.8.1 (revisione 381, R1-R3): con un dialogo aperto il primo Tab, premuto prima che arrivi il pezzo di tastiera, si ferma
// perché il fuoco non esca dal dialogo; arrivato il pezzo va dove l'avrebbe portato il browser, anche da un elemento fuori dal
// giro (`tabindex="-1"`). I tasti premuti dopo quel Tab, prima del pezzo, si fermano: arriverebbero all'elemento di prima. E un
// tasto che non è quel Tab non sposta il fuoco, anche se un altro lo ha fermato. In un file suo: il pezzo arriva una volta sola.

it('con un dialogo aperto il Tab premuto prima del pezzo si ferma, e arrivato il pezzo il fuoco va alla fermata dopo l\'elemento fuori dal giro, dentro il dialogo; i tasti dopo il Tab si fermano, e una freccia che la pagina ha fermato non sposta il fuoco (v3.8.1, R1-R3 della revisione 381)', async () => {
    document.body.innerHTML = '<div class="zr-shell"><button id="fuori">Fuori</button><div class="zr-scrim"><div class="zr-dialog"><button id="prima">Prima</button><h2 id="titolo" tabindex="-1">Titolo</h2><button id="dopo">Dopo</button></div></div></div>';
    await import('./rimedi');
    addEventListener('keydown', (tasto) => tasto.key === 'ArrowDown' && tasto.preventDefault());
    const fuochi: string[] = [];
    document.addEventListener('focusin', (evento) => fuochi.push((evento.target as HTMLElement).id));
    document.getElementById('titolo')?.focus();
    fuochi.length = 0;
    const premuti = ['ArrowDown', 'Tab', 'Enter', 'a'].map((key) => new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

    premuti.forEach((tasto) => document.activeElement?.dispatchEvent(tasto));

    expect([premuti.map((tasto) => tasto.defaultPrevented), fuochi]).toStrictEqual([[true, true, true, true], []]);
    await vi.dynamicImportSettled();
    expect(fuochi).toStrictEqual(['dopo']);
});
