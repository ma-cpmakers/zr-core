import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Alert } from './Alert';
import * as componenti from './componenti';

// voce 3055 (Decisione 21220). L'Alert ha un modulo suo, resources/js/zeiras/Alert.js, come MentionField e AddressField: la cornice
// lo prende da lì nel pezzo degli avvisi, e il JS d'ingresso non lo porta (lo prova peso.test.ts). I suoi stili restano in
// zeiras.css, dove servono anche al Toast della cornice. Dalla `v4.29.0` (voce #3511) è lo stesso oggetto di componenti.js, e che il
// file sia quello che il bundle genera lo prova componenti.test.ts. Qui: che il componente del modulo fa ciò che fa quello di
// componenti, e che il modulo non importa stili.

describe('l\'Alert del modulo fa ciò che fa quello di componenti (voce 3055)', () => {
    it('è lo stesso oggetto (voce 3511), e dà lo stesso HTML nei quattro toni, con titolo, testo, azione e chiusura', () => {
        expect(Alert).toBe(componenti.Alert);
        for (const tone of ['info', 'success', 'warning', 'danger'] as const) {
            const props = { tone, title: 'Titolo', action: createElement('button', { type: 'button' }, 'Accetta'), onClose: () => undefined, closeLabel: 'Chiudi l\'avviso' };

            expect(renderToStaticMarkup(createElement(Alert, props, 'Testo'))).toBe(renderToStaticMarkup(createElement(componenti.Alert, props, 'Testo')));
        }
    });

    it('il modulo non importa stili: quelli dell\'Alert stanno in zeiras.css', () => {
        expect(Object.values(import.meta.glob<string>('./Alert.js', { query: '?raw', import: 'default', eager: true }))[0]).not.toMatch(/^import '.*\.css';$/m);
    });
});
