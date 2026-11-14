import { act } from 'react';
import { renderToString } from 'react-dom/server';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dallIngresso from './index';
import * as dallIngressoDelleApp from './app';
import { CampoFile, type CampoFileProps } from './campo-file';
import italiano from '../lingue/campo-file/it.json';
import spagnolo from '../lingue/campo-file/es.json';
import inglese from '../lingue/campo-file/en.json';

// Voce 3813 (Finanze 3803, richiesta 264 al design system, Decisione 25021 di zr-pm-74): il campo per scegliere un file col
// clic o trascinandolo. Provvisorio e dichiarato (nota 11310): coi soli pezzi del design system, finché il design system non porta il suo.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let pagina: HTMLDivElement;
let radice: Root;

beforeEach(() => {
    document.documentElement.lang = 'it';
    pagina = document.createElement('div');
    document.body.append(pagina);
    radice = createRoot(pagina);
});

afterEach(() => {
    act(() => radice.unmount());
    pagina.remove();
});

const disegna = (props: Partial<CampoFileProps> = {}) => act(() => radice.render(<CampoFile label="Estratto conto" {...props} />));
const unFile = (nome: string, byte = 10, tipo = '') => new File([new Uint8Array(byte)], nome, { type: tipo });
const zona = () => pagina.querySelector<HTMLElement>('[data-zona-file]')!;
const scegli = () => [...pagina.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(testo().choose))!;
const togli = () => pagina.querySelector<HTMLButtonElement>('[data-togli-file]')!;
const campo = () => pagina.querySelector<HTMLInputElement>('input[type="file"]')!;
const regione = () => pagina.querySelector<HTMLElement>('[aria-live="polite"]')!;
const errore = () => pagina.querySelector<HTMLElement>('.zr-field-msg.is-error');
const testo = (): typeof inglese => ({ it: italiano, es: spagnolo, en: inglese })[document.documentElement.lang as 'it'] ?? inglese;

/** Un elenco di file come lo dà il browser, da un `DataTransfer`. */
const elenco = (...file: File[]) => {
    const dati = new DataTransfer();
    file.forEach((uno) => dati.items.add(uno));

    return dati.files;
};

/** Sceglie dei file dalla finestra del sistema: il campo nascosto li riceve e manda `change`. */
const dallaFinestra = (...file: File[]) =>
    act(() => {
        campo().files = elenco(...file);
        campo().dispatchEvent(new Event('change', { bubbles: true }));
    });

/** Un evento di trascinamento sull'elemento, coi file nel `dataTransfer` (o un testo, con `tipi`). Torna l'evento, per `defaultPrevented`. */
const trascina = (tipo: 'dragenter' | 'dragover' | 'dragleave' | 'drop', dove: Element, file: File[] = [], tipi = ['Files']) => {
    const evento = new Event(tipo, { bubbles: true, cancelable: true });
    Object.defineProperty(evento, 'dataTransfer', { value: { files: elenco(...file), types: tipi, dropEffect: 'none' } });
    act(() => void dove.dispatchEvent(evento));

    return evento;
};
/** L'anello di fuoco della zona quando è acceso: il contorno del fuoco del design system, come lo scrive bundle.css. */
const ACCESO = '2px solid var(--focus)';
const anello = () => [zona().style.outlineWidth, zona().style.outlineStyle, zona().style.outlineColor].join(' ').trim();

describe('CampoFile (voce 3813)', () => {
    it('si prende dai due ingressi', () => {
        expect(dallIngresso.CampoFile).toBe(CampoFile);
        expect(dallIngressoDelleApp.CampoFile).toBe(CampoFile);
    });

    it('T5.1 «Scegli un file» apre la scelta del sistema, e il file scelto si vede col nome e arriva a onChange', () => {
        const onChange = vi.fn();
        disegna({ onChange });
        expect(scegli().className).toContain('zr-btn');
        const apri = vi.spyOn(campo(), 'click');
        act(() => scegli().click());
        expect(apri).toHaveBeenCalledOnce();

        const file = unFile('estratto.csv', 2048);
        dallaFinestra(file);
        expect(onChange).toHaveBeenCalledWith(file);
        expect(zona().textContent).toContain('estratto.csv');
        expect(zona().textContent).toMatch(/2\s?kB/i);
        dallaFinestra(unFile('vuoto.csv', 3));
        expect(zona().textContent).toContain(new Intl.NumberFormat('it', { style: 'unit', unit: 'byte' }).format(3));
    });

    it('T5.2 il trascinamento accende l\'anello di fuoco del design system, che si spegne all\'uscita e al rilascio; il rilascio sceglie il file', () => {
        const onChange = vi.fn();
        disegna({ onChange });
        expect(anello()).toBe('');

        trascina('dragenter', zona());
        expect(anello()).toBe(ACCESO);
        // Passare sopra un elemento dentro la zona non spegne l'anello: l'uscita da quello non è l'uscita dalla zona.
        trascina('dragenter', scegli());
        trascina('dragleave', zona());
        expect(anello()).toBe(ACCESO);
        trascina('dragleave', scegli());
        expect(anello()).toBe('');

        // Un testo o un collegamento trascinati non accendono l'anello.
        trascina('dragenter', zona(), [], ['text/plain']);
        expect(anello()).toBe('');

        trascina('dragenter', zona());
        expect(trascina('dragover', zona()).defaultPrevented).toBe(true);
        const file = unFile('estratto.pdf');
        const rilascio = trascina('drop', zona(), [file]);
        expect(rilascio.defaultPrevented).toBe(true);
        expect(anello()).toBe('');
        expect(onChange).toHaveBeenCalledWith(file);
    });

    it('T5.3 un file fuori da accept non è scelto, e l\'errore dice quali tipi sono ammessi', () => {
        const onChange = vi.fn();
        disegna({ onChange, accept: ['.csv', 'application/pdf'] });
        dallaFinestra(unFile('foto.png', 10, 'image/png'));
        expect(onChange).not.toHaveBeenCalled();
        expect(errore()?.textContent).toBe(italiano.wrongType.replace('{name}', 'foto.png').replace('{types}', 'CSV, PDF'));
        expect(scegli().getAttribute('aria-invalid')).toBe('true');
        expect(scegli().getAttribute('aria-describedby')?.split(' ')).toContain(errore()!.id);
        expect(zona().textContent).not.toContain('foto.png');
        expect(zona().style.borderColor).toBe('var(--danger)');

        // L'estensione non guarda le maiuscole; il tipo MIME basta anche senza estensione.
        dallaFinestra(unFile('estratto.CSV'));
        dallaFinestra(unFile('documento', 10, 'application/pdf'));
        expect(onChange).toHaveBeenCalledTimes(2);
        expect(errore()).toBeNull();
        expect(scegli().hasAttribute('aria-invalid')).toBe(false);
    });

    it('T5.3 un file rifiutato non toglie dal campo del form quello scelto prima', () => {
        disegna({ name: 'estratto', accept: ['.csv'] });
        const buono = unFile('estratto.csv');
        dallaFinestra(buono);
        trascina('drop', zona(), [unFile('foto.png')]);
        expect(campo().files?.[0]).toBe(buono);
        dallaFinestra(unFile('foto.png'));
        expect(campo().files?.[0]).toBe(buono);
        expect(zona().textContent).toContain('estratto.csv');
    });

    it('T5.3 accept con un tipo intero, image/*', () => {
        const onChange = vi.fn();
        disegna({ onChange, accept: ['image/*'] });
        dallaFinestra(unFile('foto.png', 10, 'image/png'));
        dallaFinestra(unFile('note.txt', 10, 'text/plain'));
        expect(onChange).toHaveBeenCalledOnce();
        expect(campo().accept).toBe('image/*');
        expect(errore()?.textContent).toBe(italiano.wrongType.replace('{name}', 'note.txt').replace('{types}', 'image/*'));
    });

    it('T5.3 un file oltre maxSize non passa, uno di maxSize sì; l\'errore dice la dimensione massima', () => {
        const onChange = vi.fn();
        disegna({ onChange, maxSize: 1_000_000 });
        dallaFinestra(unFile('grande.csv', 1_000_001));
        expect(onChange).not.toHaveBeenCalled();
        expect(errore()?.textContent).toBe(italiano.tooBig.replace('{name}', 'grande.csv').replace('{size}', '1 MB'));
        dallaFinestra(unFile('giusto.csv', 1_000_000));
        expect(onChange).toHaveBeenCalledOnce();
    });

    it('T5.3 più file trascinati insieme: nessuno è scelto, e l\'errore dice uno alla volta', () => {
        const onChange = vi.fn();
        disegna({ onChange });
        trascina('drop', zona(), [unFile('a.csv'), unFile('b.csv')]);
        expect(onChange).not.toHaveBeenCalled();
        expect(errore()?.textContent).toBe(italiano.onlyOne);
    });

    it('T5.4 la regione live c\'è prima del primo annuncio e dice scelta, tolto ed errore', () => {
        disegna({ accept: ['.csv'] });
        expect(regione()).not.toBeNull();
        expect(regione().textContent).toBe('');
        expect(regione().className).toContain('zr-visually-hidden');

        dallaFinestra(unFile('estratto.csv'));
        expect(regione().textContent).toBe(italiano.chosen.replace('{name}', 'estratto.csv'));
        act(() => togli().click());
        expect(regione().textContent).toBe(italiano.removed);
        dallaFinestra(unFile('foto.png'));
        expect(regione().textContent).toBe(errore()!.textContent);
        // Lo stesso errore due volte si annuncia due volte: il testo arriva in un elemento nuovo, non resta quello di prima.
        const prima = regione().firstElementChild;
        dallaFinestra(unFile('foto.png'));
        expect(regione().firstElementChild).not.toBe(prima);
        expect(regione().textContent).toBe(errore()!.textContent);
    });

    it.each([
        ['es', spagnolo],
        ['en', inglese],
        ['es-MX', spagnolo],
        ['de', inglese],
    ])('T5.4 con lang="%s" i testi sono nella lingua della pagina, inglese in una che zr-core non ha', (lingua, attesi) => {
        document.documentElement.lang = lingua;
        disegna();
        expect(pagina.textContent).toContain(attesi.choose);
        expect(pagina.textContent).toContain(attesi.drop);
        dallaFinestra(unFile('estratto.csv'));
        expect(regione().textContent).toBe(attesi.chosen.replace('{name}', 'estratto.csv'));
        expect(togli().getAttribute('aria-label')).toBe(attesi.removeFile.replace('{name}', 'estratto.csv'));
    });

    it.each([
        ['es', spagnolo, '1 MB'],
        ['en', inglese, '1 MB'],
        ['it_IT', italiano, '1 MB'],
    ])('T5.3 con lang="%s" gli errori sono nella lingua della pagina, e un codice scritto male non rompe i numeri', (lingua, attesi, mega) => {
        document.documentElement.lang = lingua;
        disegna({ accept: ['.csv'], maxSize: 1_000_000 });
        dallaFinestra(unFile('foto.png'));
        expect(errore()?.textContent).toBe(attesi.wrongType.replace('{name}', 'foto.png').replace('{types}', 'CSV'));
        dallaFinestra(unFile('grande.csv', 1_000_001));
        expect(errore()?.textContent).toBe(attesi.tooBig.replace('{name}', 'grande.csv').replace('{size}', mega));
    });

    it('T5.4 sul server (Inertia SSR) il campo si disegna in inglese, senza leggere la pagina', () => {
        const html = renderToString(<CampoFile label="Estratto conto" />);
        expect(html).toContain(inglese.choose);
        expect(html).not.toContain(italiano.choose);
    });

    it('T5.4 labels vince chiave per chiave', () => {
        disegna({ labels: { choose: 'Carica estratto', drop: '', chosen: undefined } });
        expect(pagina.textContent).toContain('Carica estratto');
        // Una chiave vuota o assente lascia il testo della lingua.
        expect(pagina.textContent).toContain(italiano.drop);
        dallaFinestra(unFile('estratto.csv'));
        expect(regione().textContent).toBe(italiano.chosen.replace('{name}', 'estratto.csv'));
    });

    it('T5.4 i tre file delle lingue hanno le stesse chiavi, e nessun testo vuoto', () => {
        for (const lingua of [italiano, spagnolo]) {
            expect(Object.keys(lingua).sort()).toEqual(Object.keys(inglese).sort());
            expect(Object.values(lingua).every((t) => t.trim() !== '')).toBe(true);
        }
    });

    it('T5.5 «Togli» toglie il file, riporta il fuoco su «Scegli un file», e lo stesso file si può scegliere di nuovo', () => {
        const onChange = vi.fn();
        disegna({ onChange });
        const file = unFile('estratto.csv');
        dallaFinestra(file);
        act(() => togli().focus());
        act(() => togli().click());
        expect(onChange).toHaveBeenLastCalledWith(null);
        expect(document.activeElement).toBe(scegli());
        expect(zona().textContent).not.toContain('estratto.csv');
        // Il campo è vuoto: lo stesso file, scelto di nuovo, cambia la scelta e il browser manda `change`.
        expect(campo().files?.length ?? 0).toBe(0);
        dallaFinestra(file);
        expect(onChange).toHaveBeenLastCalledWith(file);
    });

    it('T5.5 con value il campo è controllato: mostra il file che riceve', () => {
        const file = unFile('dal-modulo.csv');
        disegna({ value: file });
        expect(zona().textContent).toContain('dal-modulo.csv');
        expect(campo().files?.[0]).toBe(file);
        disegna({ value: null });
        expect(zona().textContent).not.toContain('dal-modulo.csv');
        expect(campo().files?.length ?? 0).toBe(0);
    });

    it('T5.6 la zona è alta almeno 44 px, e con disabled niente scelta né trascinamento', () => {
        const onChange = vi.fn();
        disegna({ onChange, disabled: true });
        expect(zona().style.minHeight).toBe('44px');
        expect(zona().style.borderColor).toBe('var(--line-strong)');
        expect(scegli().disabled).toBe(true);
        expect(campo().disabled).toBe(true);
        trascina('dragenter', zona());
        expect(anello()).toBe('');
        trascina('drop', zona(), [unFile('estratto.csv')]);
        expect(onChange).not.toHaveBeenCalled();
    });

    it('T5.6 il file rilasciato sta nel campo del form, e viaggia col form', () => {
        disegna({ name: 'estratto' });
        expect(campo().name).toBe('estratto');
        const file = unFile('estratto.csv');
        trascina('drop', zona(), [file]);
        expect(campo().files?.[0]).toBe(file);
        expect(campo().files).toHaveLength(1);
    });

    it('T5.6 un file rilasciato senza name sta lo stesso nel campo: lo stesso file, scelto poi col clic, cambia la scelta', () => {
        disegna();
        const file = unFile('estratto.csv');
        trascina('drop', zona(), [file]);
        expect(campo().files?.[0]).toBe(file);
    });

    /** Il campo in un form con un pulsante d'invio e, prima, un altro campo obbligatorio se `prima` è vero. */
    const nelForm = (prima = false) =>
        act(() =>
            radice.render(
                <form onSubmit={(e) => e.preventDefault()}>
                    {prima ? <input data-prima="" required /> : null}
                    <CampoFile label="Estratto conto" required />
                    <button type="submit">Invia</button>
                </form>,
            ),
        );
    /** Un clic su «Invia» e, nello stesso giro, l'evento `invalid` che il browser manda al campo vuoto. */
    const invia = () => {
        const invalido = new Event('invalid', { cancelable: true });
        act(() => {
            pagina.querySelector<HTMLButtonElement>('button[type="submit"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            campo().dispatchEvent(invalido);
        });

        return invalido;
    };

    it('T5.6 un form inviato senza il file: niente fumetto del browser sul campo nascosto, l\'errore lo dice e il fuoco va su «Scegli un file»', () => {
        nelForm();
        expect(invia().defaultPrevented).toBe(true);
        expect(errore()?.textContent).toBe(italiano.missing);
        expect(regione().textContent).toBe(italiano.missing);
        expect(document.activeElement).toBe(scegli());
        // Un file che arriva toglie l'errore.
        dallaFinestra(unFile('estratto.csv'));
        expect(errore()).toBeNull();
    });

    it('T5.6 checkValidity() del modulo, senza un invio, non mostra l\'errore e non sposta il fuoco', () => {
        nelForm();
        const invalido = new Event('invalid', { cancelable: true });
        act(() => void campo().dispatchEvent(invalido));
        expect(invalido.defaultPrevented).toBe(false);
        expect(errore()).toBeNull();
    });

    it('T5.6 se un altro campo prima è da correggere, il fuoco lo porta il browser lì, e il campo file dice comunque «Manca il file»', () => {
        nelForm(true);
        const fuori = document.createElement('button');
        document.body.append(fuori);
        act(() => fuori.focus());
        invia();
        expect(errore()?.textContent).toBe(italiano.missing);
        expect(document.activeElement).toBe(fuori);
        fuori.remove();
    });

    it('T5.6 etichetta, aiuto ed errore di chi lo usa sono quelli del Field del design system', () => {
        disegna({ hint: 'CSV della banca', required: true, error: 'Il server non lo ha accettato' });
        const gruppo = pagina.querySelector<HTMLElement>('[role="group"]')!;
        const etichetta = pagina.querySelector<HTMLElement>('.zr-field-label')!;
        expect(gruppo.getAttribute('aria-labelledby')).toBe(etichetta.id);
        // L'asterisco si vede e non si legge; si legge «obbligatorio».
        expect(etichetta.textContent).toBe(`Estratto conto * ${italiano.required}`);
        expect(etichetta.querySelector('.zr-req')?.getAttribute('aria-hidden')).toBe('true');
        expect(campo().required).toBe(true);
        expect(errore()?.textContent).toBe('Il server non lo ha accettato');
        expect(regione().textContent).toBe('Il server non lo ha accettato');
        disegna({ hint: 'CSV della banca' });
        expect(errore()).toBeNull();
        expect(pagina.querySelector('.zr-field-msg')?.textContent).toBe('CSV della banca');
        expect(scegli().getAttribute('aria-describedby')).toBe(pagina.querySelector('.zr-field-msg')!.id);
    });

    it('T5.6 nessun valore scritto a mano: lo stile della zona usa solo i token del design system', () => {
        disegna();
        trascina('dragenter', zona());
        const stile = zona().getAttribute('style') ?? '';
        expect(stile).not.toMatch(/#[0-9a-f]{3,8}\b|rgb|hsl/i);
        // Ogni valore è un token, o una parola o i 44 px del tocco, che il design system non ha come token; l'anello di fuoco è quello
        // del design system, e lo prova T5.2.
        expect(zona().style.borderWidth).toBe('var(--border-strong)');
        const senzaToken = ['flex', 'wrap', 'center', 'border-box', 'dashed', 'solid', '44px'];
        for (const dichiarazione of stile.split(';').filter((d) => d.trim() && !d.trim().startsWith('outline'))) {
            const valore = dichiarazione.slice(dichiarazione.indexOf(':') + 1).trim();
            expect(valore.includes('var(--') || senzaToken.includes(valore), dichiarazione).toBe(true);
        }
    });
});
