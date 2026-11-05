import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { aParte, A_PARTE, dividiIlCss, leggi, NEL_GRUPPO } from '../../../scripts/componenti-genera.mjs';
import bundle from '../../zeiras/bundle.js?raw';
import { Alert } from './Alert';
import generato from './Alert.js?raw';
import * as componenti from './componenti';
// Un CSS con `?raw` vitest lo dà vuoto: si legge dal disco.
const bundleCss = readFileSync(resolve(process.cwd(), 'resources/zeiras/bundle.css'), 'utf8');

// voce 3055 (Decisione 21220). L'Alert ha un modulo suo, resources/js/zeiras/Alert.js, come MentionField e AddressField: la cornice
// lo prende da lì nel pezzo degli avvisi, e il JS d'ingresso non lo porta (lo prova peso.test.ts). Nel bundle sta nel gruppo
// «Feedback», col Toast (`NEL_GRUPPO`): il blocco non ha un commento suo e comincia dalla funzione, e `TONE_ICON`, che usa anche
// il Toast, è una riga privata. Qui: che il file è quello che il bundle genera, che lo script si ferma quando il bundle cambia
// quella forma, e che il componente del modulo fa ciò che fa quello di componenti.

const RIGA_DI_TONE_ICON = "  var TONE_ICON = { info: 'info', success: 'checkCircle', warning: 'alert', danger: 'xCircle' };";

describe('il modulo dell\'Alert è quello che il bundle genera (voce 3055)', () => {
    it('rigenerato in memoria dal bundle il file è uguale, carattere per carattere; non importa stili: i suoi restano in zeiras.css', () => {
        expect(NEL_GRUPPO).toStrictEqual(['Alert']);
        expect(aParte(leggi(bundle), 'Alert', dividiIlCss(bundleCss))).toBe(generato);
        expect(generato.split('\n').filter((riga) => riga.startsWith('import '))).toStrictEqual(["import * as React from 'react';", "import { Button, Icon } from './componenti';"]);
    });

    it('porta la funzione e le sue tre righe private, nell\'ordine del bundle, e niente del Toast né del commento del gruppo', () => {
        const righe = generato.split('\n');
        const daQui = righe.indexOf('  function Alert(p) {');

        expect(righe.slice(5, daQui - 1)).toStrictEqual(A_PARTE.Alert);
        expect(righe[daQui - 1]).toBe('');
        expect(['Toast', 'zr-toast', '/* ---------- '].filter((testo) => generato.includes(testo))).toStrictEqual([]);
    });

    it.each<[string, (testo: string) => string, string]>([
        ['un commento suo sopra la funzione', (testo) => testo.replace('  function Alert(p) {', '  /* ---------- Alert: avvisi ---------- */\n  function Alert(p) {'), 'segna un blocco di Alert, che lo script legge in un gruppo (NEL_GRUPPO)'],
        ['una riga di TONE_ICON diversa', (testo) => testo.replace(RIGA_DI_TONE_ICON, RIGA_DI_TONE_ICON.replace("danger: 'xCircle'", "danger: 'alert'")), 'sta attaccata alla funzione Alert e dichiara «TONE_ICON», che usa anche il resto del bundle'],
        ['la funzione due volte', (testo) => testo.replace('  /* ---------- Feedback ---------- */', '  /* ---------- Feedback ---------- */\n  function Alert(p) {\n    return null;\n  }'), 'la riga «function Alert(p) {» c\'è 2 volte'],
    ])('con %s lo script si ferma e dice perché', (_caso, cambia, detto) => {
        const cambiato = cambia(bundle);

        expect(cambiato).not.toBe(bundle);
        expect(() => aParte(leggi(cambiato), 'Alert')).toThrow(detto);
    });
});

describe('l\'Alert del modulo fa ciò che fa quello di componenti (voce 3055)', () => {
    it('è un altro oggetto, e dà lo stesso HTML nei quattro toni, con titolo, testo, azione e chiusura', () => {
        expect(Alert).not.toBe(componenti.Alert);
        for (const tone of ['info', 'success', 'warning', 'danger'] as const) {
            const props = { tone, title: 'Titolo', action: createElement('button', { type: 'button' }, 'Accetta'), onClose: () => undefined, closeLabel: 'Chiudi l\'avviso' };

            expect(renderToStaticMarkup(createElement(Alert, props, 'Testo'))).toBe(renderToStaticMarkup(createElement(componenti.Alert, props, 'Testo')));
        }
    });
});
