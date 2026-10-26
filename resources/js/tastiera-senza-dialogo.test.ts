import { expect, it, vi } from 'vitest';

// v3.8.0 (zr-pm, 26/10/2026): i tasti premuti prima che arrivi il pezzo di tastiera (`tastiera.ts`) si ripetono quando arriva.
// In un file suo: il pezzo arriva una volta sola. Dalla v3.8.1 (R1 della revisione 381) senza un dialogo il Tab non si ferma
// più: il fuoco lo sposta il browser, da dove la persona lo ha lasciato — anche un punto cliccato a metà pagina o un elemento
// fuori dal giro — e arrivato il pezzo non si sposta di nuovo.

it('i Tab premuti prima che arrivi il pezzo di tastiera, senza un dialogo, restano del browser, anche da un elemento fuori dal giro, e arrivato il pezzo il fuoco non si sposta (v3.8.1, R1 della revisione 381)', async () => {
    document.body.innerHTML = '<div class="zr-shell"><button id="a">A</button><main id="m" tabindex="-1"><button id="b">B</button></main><button id="d">D</button></div>';
    await import('./rimedi');
    const fuochi: string[] = [];
    document.addEventListener('focusin', (evento) => fuochi.push((evento.target as HTMLElement).id));
    document.getElementById('m')?.focus();
    fuochi.length = 0;
    const premuti = [{ key: 'Tab' }, { key: 'Tab', ctrlKey: true }, { key: 'Tab', shiftKey: true }].map((tasto) => new KeyboardEvent('keydown', { ...tasto, bubbles: true, cancelable: true }));

    premuti.forEach((tasto) => document.activeElement?.dispatchEvent(tasto));

    expect(premuti.map((tasto) => tasto.defaultPrevented)).toStrictEqual([false, false, false]);
    await vi.dynamicImportSettled();
    expect([fuochi, document.activeElement?.id]).toStrictEqual([[], 'm']);
});
