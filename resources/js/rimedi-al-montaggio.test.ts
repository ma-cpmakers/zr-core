import { expect, it } from 'vitest';

// v3.8.1 (revisione 381). Ciò che i rimedi fanno senza aspettare un tasto: chi usa un lettore di schermo col tocco, o in
// modalità navigazione, non ne preme nessuno che arrivi alla pagina. In un file suo: il modulo si mette in ascolto una volta
// sola, quando arriva, e qui nessun tasto chiede il pezzo di tastiera.

const cambiato = () => new Promise((fatto) => setTimeout(fatto));

it('una voce «Presto» della barra laterale ha `tabindex="-1"` e il nome «<voce>, Presto» appena arrivano i rimedi, senza un tasto; un collegamento del contenuto con la stessa classe tiene il suo nome anche dopo un cambio della pagina (riga 6; R4 e R9 della revisione 381)', async () => {
    document.body.innerHTML = '<div class="zr-shell"><aside class="zr-side"><nav><a class="zr-nav-item is-soon" href="#"><span>CRM</span><span>Presto</span></a></nav></aside><main><a class="zr-nav-item" href="/x" aria-label="Il mio">X</a></main></div>';

    await import('./rimedi');

    const presto = document.querySelector('.is-soon')!;
    const delModulo = document.querySelector('main a')!;

    expect([presto.getAttribute('tabindex'), presto.getAttribute('aria-label')]).toStrictEqual(['-1', 'CRM, Presto']);
    document.querySelector('main')!.append(document.createElement('p'));
    await cambiato();
    expect(delModulo.getAttribute('aria-label')).toBe('Il mio');
});

it('l\'avatar di una notifica il cui titolo dice un nome che comincia come il suo non si nasconde: il nome si cerca isolato, come la riga lo scrive (riga 85; R10 della revisione 381)', async () => {
    const riga = (nome: string, titolo: string) => `<button class="zr-notif-item"><span class="zr-avatar" role="img" aria-label="${nome}"></span><span><span>${titolo}</span></span></button>`;
    document.body.innerHTML = '<div class="zr-shell"><div class="zr-top-actions"><div class="zr-notif"><div class="zr-notif-list"></div></div></div></div>';

    document.querySelector('.zr-notif-list')!.innerHTML = riga('Ada', '⁨Adamo⁩ ha creato un\'area') + riga('Bruno', '⁨Bruno⁩ ha creato un\'area');
    await cambiato();

    expect([...document.querySelectorAll('.zr-avatar')].map((avatar) => avatar.getAttribute('aria-hidden'))).toStrictEqual([null, 'true']);
});
