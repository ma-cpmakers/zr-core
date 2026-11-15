import { expect, it } from 'vitest';

// Revisione della v4.34.0, R2 (sì di zr-pm-74, 15/11). Il CSS del pezzo degli avvisi (la fascia di assistenza) lo chiede il
// caricatore della build col pezzo; dal secondo tentativo la cornice importa il solo JS, e il caricatore non richiede più un CSS che
// ha già visto. Il pezzo, quando gira, richiede una volta il foglio di stile della pagina che non si è caricato. In un file suo:
// il modulo gira una volta per file, e qui i fogli ci sono prima che giri.

// Il DOM di prova non scarica i fogli di stile: `sheet` resta vuoto, come per uno che non è arrivato.
(window as unknown as { happyDOM: { settings: { disableCSSFileLoading: boolean } } }).happyDOM.settings.disableCSSFileLoading = true;

it('quando il pezzo degli avvisi gira, il foglio di stile che non si è caricato (senza `sheet`, o con regole che non si leggono) si richiede una volta, accanto al suo, con `?r=1`; quello caricato e quello spento no (revisione della v4.34.0, R2)', async () => {
    const foglio = (indirizzo: string, caricato: boolean | 'vuoto', spento = false) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = indirizzo;
        link.toggleAttribute('disabled', spento);
        if (caricato === true) {
            Object.defineProperty(link, 'sheet', { value: { cssRules: [] } });
        }
        // Chromium, a un foglio che non è arrivato, dà un `sheet` le cui regole non si leggono (UAT della v4.34.1).
        if (caricato === 'vuoto') {
            Object.defineProperty(link, 'sheet', { value: { get cssRules() { throw new DOMException('regole non leggibili', 'SecurityError'); } } });
        }
        document.head.append(link);
    };
    foglio('https://app.example.com/build/assets/avvisi-a1b2.css', false);
    foglio('https://app.example.com/build/assets/app-c3d4.css', true);
    foglio('https://app.example.com/build/assets/tema-e5f6.css', false, true);
    foglio('https://app.example.com/build/assets/campo-g7h8.css', 'vuoto');

    await import('./avvisi');

    expect([...document.head.querySelectorAll<HTMLLinkElement>('link')].map((link) => [link.rel, link.href, link.hasAttribute('disabled')])).toStrictEqual([
        ['stylesheet', 'https://app.example.com/build/assets/avvisi-a1b2.css', false],
        ['stylesheet', 'https://app.example.com/build/assets/avvisi-a1b2.css?r=1', false],
        ['stylesheet', 'https://app.example.com/build/assets/app-c3d4.css', false],
        ['stylesheet', 'https://app.example.com/build/assets/tema-e5f6.css', true],
        ['stylesheet', 'https://app.example.com/build/assets/campo-g7h8.css', false],
        ['stylesheet', 'https://app.example.com/build/assets/campo-g7h8.css?r=1', false],
    ]);
});
