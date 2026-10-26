import { expect, it, vi } from 'vitest';

// v3.8.1 (revisione 381, R1-R3; seconda lettura, N1): con un dialogo aperto i Tab, premuti prima che arrivi il pezzo di
// tastiera, si fermano perché il fuoco non esca dal dialogo; arrivato il pezzo ognuno porta il fuoco dove l'avrebbe portato il
// browser, anche da un elemento fuori dal giro (`tabindex="-1"`). Gli altri tasti premuti dopo un Tab, prima del pezzo, si
// fermano: arriverebbero all'elemento di prima. E un tasto che non è un Tab fermato qui non sposta il fuoco, anche se un altro
// lo ha fermato. In un file suo: il pezzo arriva una volta sola.

it('con un dialogo aperto i Tab premuti prima del pezzo si fermano, e arrivato il pezzo ognuno porta il fuoco alla fermata dopo, anche dall\'elemento fuori dal giro; i tasti dopo il Tab si fermano, e una freccia che la pagina ha fermato non sposta il fuoco (v3.8.1, R1-R3 della revisione 381, N1)', async () => {
    document.body.innerHTML = '<div class="zr-shell"><button id="fuori">Fuori</button><div class="zr-scrim"><div class="zr-dialog"><button id="prima">Prima</button><h2 id="titolo" tabindex="-1">Titolo</h2><button id="dopo">Dopo</button><button id="ultimo">Ultimo</button></div></div></div>';
    await import('./rimedi');
    addEventListener('keydown', (tasto) => tasto.key === 'ArrowDown' && tasto.preventDefault());
    const fuochi: string[] = [];
    document.addEventListener('focusin', (evento) => fuochi.push((evento.target as HTMLElement).id));
    document.getElementById('titolo')?.focus();
    fuochi.length = 0;
    const premuti = ['ArrowDown', 'Tab', 'Enter', 'a', 'Tab'].map((key) => new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

    premuti.forEach((tasto) => document.activeElement?.dispatchEvent(tasto));

    expect([premuti.map((tasto) => tasto.defaultPrevented), fuochi]).toStrictEqual([[true, true, true, true, true], []]);
    await vi.dynamicImportSettled();
    expect(fuochi).toStrictEqual(['dopo', 'ultimo']);
});
