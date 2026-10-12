import { expect, it } from 'vitest';

// Sprint 30 · T4 (voce #1870). Il pezzo dei rimedi provvisori di tastiera arriva a cornice montata: un dialogo può essere già
// aperto. In un file suo, perché il modulo si mette in ascolto una volta sola, quando arriva.

it('un dialogo già aperto quando arrivano i rimedi ha il velo a `--z-dialog` + 2; un\'anteprima e un velo senza dialogo restano come sono (sprint 30 · T4.4)', async () => {
    document.body.innerHTML = '<div class="zr-shell"><div class="zr-scrim" id="aperto"><div class="zr-dialog"></div></div><div class="zr-scrim is-inline" id="anteprima"><div class="zr-dialog"></div></div><div class="zr-scrim" id="del-modulo"><p></p></div></div>';

    await import('./rimedi');

    expect(document.getElementById('aperto')?.style.getPropertyValue('z-index')).toBe('calc(var(--z-dialog) + 2)');
    expect(document.getElementById('anteprima')?.style.getPropertyValue('z-index')).toBe('');
    expect(document.getElementById('del-modulo')?.style.getPropertyValue('z-index')).toBe('');
});
