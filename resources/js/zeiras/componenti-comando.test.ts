// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execPath } from 'node:process';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

// Sprint 25 · T6 (lettura della PR #56, R3). Il comando che genera il modulo dei componenti, `node scripts/componenti.mjs`
// (`npm run componenti`, e con `-- --controlla` il passo della CI), fa sempre il suo lavoro, da qualunque cartella: prima
// decideva da sé se era stato lanciato da riga di comando, confrontando il proprio indirizzo con quello dell'argomento, e in
// una cartella col `#` nel percorso i due testi erano diversi: non faceva niente e usciva 0, col file ritoccato. Qui il
// comando gira davvero, con node, in una copia fuori dal repo il cui percorso ha uno spazio, un `#`, un `?` e un `%`: della
// copia fanno parte gli script, il bundle e il file generato. Il caso gira in node: lancia un processo e scrive file.

const FILE_DEL_BUNDLE = 'resources/zeiras/bundle.js';
const FILE_DEL_MODULO = 'resources/js/zeiras/componenti.js';
// Dalla `v3.1.0` (sprint 71 · T1.3) il comando scrive e controlla anche il modulo di MentionField.
const FILE_A_PARTE = 'resources/js/zeiras/MentionField.js';
// Dalla `v3.2.0` (sprint 72 · T1.3) anche quello di AddressField.
const FILE_DI_ADDRESS = 'resources/js/zeiras/AddressField.js';
// Dalla `v3.3.0` (sprint 75 · T1.1) divide anche bundle.css: il CSS senza gli stili dei due componenti, e quelli di ognuno.
const FILE_DEL_CSS = 'resources/zeiras/bundle.css';
const CSS_GENERATI = ['resources/css/zeiras.css', 'resources/css/zeiras/MentionField.css', 'resources/css/zeiras/AddressField.css'];
const delRepo = (percorso: string) => fileURLToPath(new URL(`../../../${percorso}`, import.meta.url));
const radice = mkdtempSync(join(tmpdir(), 'zr-core-componenti-'));
const copia = join(radice, 'una copia #1 100% ?sì');
const nellaCopia = (percorso: string) => join(copia, percorso);
const generato = readFileSync(delRepo(FILE_DEL_MODULO), 'utf8');
const RITOCCATO = `${generato}// ritoccato a mano\n`;
const generatoAParte = readFileSync(delRepo(FILE_A_PARTE), 'utf8');
const generatoDiAddress = readFileSync(delRepo(FILE_DI_ADDRESS), 'utf8');
const cssGenerati = CSS_GENERATI.map((percorso) => readFileSync(delRepo(percorso), 'utf8'));

/** Lancia il comando nella copia, da una cartella che non è la sua: uscita, ciò che scrive e ciò che dice. */
function comando(argomenti: string[] = [], script = nellaCopia('scripts/componenti.mjs')) {
    const esito = spawnSync(execPath, [script, ...argomenti], { cwd: radice, encoding: 'utf8' });

    return { uscita: esito.status, detto: esito.stdout, errore: esito.stderr, file: readFileSync(nellaCopia(FILE_DEL_MODULO), 'utf8') };
}

beforeEach(() => {
    rmSync(copia, { recursive: true, force: true });
    mkdirSync(nellaCopia('resources/zeiras'), { recursive: true });
    mkdirSync(nellaCopia('resources/js/zeiras'), { recursive: true });
    mkdirSync(nellaCopia('resources/css/zeiras'), { recursive: true });
    cpSync(delRepo(FILE_DEL_CSS), nellaCopia(FILE_DEL_CSS));
    CSS_GENERATI.forEach((percorso, indice) => writeFileSync(nellaCopia(percorso), cssGenerati[indice]!));
    cpSync(delRepo('scripts'), nellaCopia('scripts'), { recursive: true });
    cpSync(delRepo(FILE_DEL_BUNDLE), nellaCopia(FILE_DEL_BUNDLE));
    writeFileSync(nellaCopia(FILE_DEL_MODULO), generato);
    writeFileSync(nellaCopia(FILE_A_PARTE), generatoAParte);
    writeFileSync(nellaCopia(FILE_DI_ADDRESS), generatoDiAddress);
});

afterAll(() => {
    rmSync(radice, { recursive: true, force: true });
});

describe('il comando dei componenti fa sempre il suo lavoro, anche in una cartella col `#` nel percorso (sprint 25 · T6, R3)', () => {
    it('`--controlla` col file che il bundle genera: esce 0 e dice quanti nomi esporta', () => {
        const esito = comando(['--controlla']);

        expect([esito.uscita, esito.errore, esito.file === generato]).toStrictEqual([0, '', true]);
        expect(esito.detto).toMatch(/^resources\/js\/zeiras\/componenti\.js: è quello che resources\/zeiras\/bundle\.js genera \(\d+ nomi esportati\)\nresources\/js\/zeiras\/MentionField\.js: è quello che resources\/zeiras\/bundle\.js genera \(MentionField\)\nresources\/js\/zeiras\/AddressField\.js: è quello che resources\/zeiras\/bundle\.js genera \(AddressField\)\nresources\/css\/zeiras\.css: è quello che resources\/zeiras\/bundle\.css genera \(senza gli stili di MentionField e di AddressField\)\nresources\/css\/zeiras\/MentionField\.css: è quello che resources\/zeiras\/bundle\.css genera \(gli stili di MentionField\)\nresources\/css\/zeiras\/AddressField\.css: è quello che resources\/zeiras\/bundle\.css genera \(gli stili di AddressField\)\n$/);
    });

    it('`--controlla` col file ritoccato a mano: esce 1, dice che non è quello che il bundle genera, e non lo riscrive', () => {
        writeFileSync(nellaCopia(FILE_DEL_MODULO), RITOCCATO);
        const esito = comando(['--controlla']);

        expect([esito.uscita, esito.detto, esito.file === RITOCCATO]).toStrictEqual([1, '', true]);
        expect(esito.errore).toContain('resources/js/zeiras/componenti.js non è quello che resources/zeiras/bundle.js genera.');
    });

    it('`--controlla` senza il file: esce 1 e dice che il file non c\'è', () => {
        rmSync(nellaCopia(FILE_DEL_MODULO));
        const esito = spawnSync(execPath, [nellaCopia('scripts/componenti.mjs'), '--controlla'], { cwd: radice, encoding: 'utf8' });

        expect([esito.status, esito.stdout]).toStrictEqual([1, '']);
        expect(esito.stderr).toContain('non è quello che resources/zeiras/bundle.js genera (il file non c\'è).');
    });

    it('senza `--controlla` riscrive il file ritoccato: esce 0, e il file torna quello che il bundle genera', () => {
        writeFileSync(nellaCopia(FILE_DEL_MODULO), RITOCCATO);
        const esito = comando();

        expect([esito.uscita, esito.errore, esito.file === generato]).toStrictEqual([0, '', true]);
        expect(esito.detto).toMatch(/^scritto resources\/js\/zeiras\/componenti\.js \(\d+ nomi esportati\)\nscritto resources\/js\/zeiras\/MentionField\.js \(MentionField\)\nscritto resources\/js\/zeiras\/AddressField\.js \(AddressField\)\nscritto resources\/css\/zeiras\.css \(senza gli stili di MentionField e di AddressField\)\nscritto resources\/css\/zeiras\/MentionField\.css \(gli stili di MentionField\)\nscritto resources\/css\/zeiras\/AddressField\.css \(gli stili di AddressField\)\n$/);
    });

    it('`--controlla` col modulo di MentionField ritoccato a mano, o senza: esce 1, dice quale file non è quello che il bundle genera, e non scrive niente (sprint 71 · T1.3)', () => {
        writeFileSync(nellaCopia(FILE_A_PARTE), `${generatoAParte}// ritoccato a mano\n`);
        const ritoccato = comando(['--controlla']);

        expect([ritoccato.uscita, ritoccato.detto, ritoccato.file === generato, readFileSync(nellaCopia(FILE_A_PARTE), 'utf8') === `${generatoAParte}// ritoccato a mano\n`]).toStrictEqual([1, '', true, true]);
        expect(ritoccato.errore).toContain('resources/js/zeiras/MentionField.js non è quello che resources/zeiras/bundle.js genera.');
        expect(ritoccato.errore).not.toContain('componenti.js non è');

        rmSync(nellaCopia(FILE_A_PARTE));
        const senza = comando(['--controlla']);

        expect([senza.uscita, senza.detto]).toStrictEqual([1, '']);
        expect(senza.errore).toContain('resources/js/zeiras/MentionField.js non è quello che resources/zeiras/bundle.js genera (il file non c\'è).');
    });

    // Lettura della PR #126 (rilievo 8): un bundle che `leggi` accetta e il blocco di MentionField no.
    it.each([[['--controlla']], [[]]])('con un bundle che non ha più il blocco di MentionField (argomenti: %j) esce 1, dice che cosa non torna e non scrive nessuno dei due file (sprint 71 · T1.3)', (argomenti) => {
        writeFileSync(nellaCopia(FILE_DEL_BUNDLE), readFileSync(delRepo(FILE_DEL_BUNDLE), 'utf8').replace('  /* ---------- MentionField: ', '  /* ---------- Menzioni: '));
        writeFileSync(nellaCopia(FILE_DEL_MODULO), RITOCCATO);
        writeFileSync(nellaCopia(FILE_A_PARTE), `${generatoAParte}// ritoccato a mano\n`);
        const esito = comando(argomenti);

        expect([esito.uscita, esito.detto, esito.file === RITOCCATO, readFileSync(nellaCopia(FILE_A_PARTE), 'utf8') === `${generatoAParte}// ritoccato a mano\n`]).toStrictEqual([1, '', true, true]);
        expect(esito.errore).toContain('resources/zeiras/bundle.js: forma inattesa del bundle: il commento «/* ---------- MentionField: …», che segna il blocco di MentionField, c\'è 0 volte');
        expect(esito.errore).toContain('Nessun file è stato scritto: né resources/js/zeiras/componenti.js né resources/js/zeiras/MentionField.js né resources/js/zeiras/AddressField.js: lo script va riallineato alla forma nuova del bundle.');
    });

    it('`--controlla` col modulo di AddressField ritoccato a mano, o senza: esce 1 e dice quale file (sprint 72 · T1.3)', () => {
        writeFileSync(nellaCopia(FILE_DI_ADDRESS), `${generatoDiAddress}// ritoccato a mano\n`);
        const ritoccato = comando(['--controlla']);

        expect([ritoccato.uscita, ritoccato.detto, readFileSync(nellaCopia(FILE_DI_ADDRESS), 'utf8') === `${generatoDiAddress}// ritoccato a mano\n`]).toStrictEqual([1, '', true]);
        expect(ritoccato.errore).toContain('resources/js/zeiras/AddressField.js non è quello che resources/zeiras/bundle.js genera.');
        rmSync(nellaCopia(FILE_DI_ADDRESS));
        const senza = comando(['--controlla']);

        expect([senza.uscita, senza.detto]).toStrictEqual([1, '']);
        expect(senza.errore).toContain('resources/js/zeiras/AddressField.js non è quello che resources/zeiras/bundle.js genera (il file non c\'è).');
        expect(comando().uscita).toBe(0);
        expect(readFileSync(nellaCopia(FILE_DI_ADDRESS), 'utf8')).toBe(generatoDiAddress);
    });

    it.each(CSS_GENERATI)('`--controlla` con %s ritoccato a mano, o senza: esce 1 e dice che non è quello che bundle.css genera; senza `--controlla` lo riscrive (sprint 75 · T1.1)', (percorso) => {
        const generatoQui = cssGenerati[CSS_GENERATI.indexOf(percorso)]!;
        writeFileSync(nellaCopia(percorso), `${generatoQui}.zr-mention { color: var(--ink); }\n`);
        const ritoccato = comando(['--controlla']);

        expect([ritoccato.uscita, ritoccato.detto]).toStrictEqual([1, '']);
        expect(ritoccato.errore).toContain(`${percorso} non è quello che resources/zeiras/bundle.css genera.`);
        rmSync(nellaCopia(percorso));
        expect(comando(['--controlla']).errore).toContain(`${percorso} non è quello che resources/zeiras/bundle.css genera (il file non c'è).`);
        expect(comando().uscita).toBe(0);
        expect(readFileSync(nellaCopia(percorso), 'utf8')).toBe(generatoQui);
    });

    it('senza bundle.css esce 1, dice che non si legge e non scrive niente (sprint 75 · T1.1)', () => {
        rmSync(nellaCopia(FILE_DEL_CSS));
        writeFileSync(nellaCopia(FILE_A_PARTE), `${generatoAParte}// ritoccato a mano\n`);
        const esito = comando();

        expect(esito.uscita).toBe(1);
        expect(esito.errore).toContain('resources/zeiras/bundle.css: non si legge');
        expect(readFileSync(nellaCopia(FILE_A_PARTE), 'utf8')).toBe(`${generatoAParte}// ritoccato a mano\n`);
    });

    it('senza `--controlla` riscrive anche il modulo di MentionField ritoccato (sprint 71 · T1.3)', () => {
        writeFileSync(nellaCopia(FILE_A_PARTE), `${generatoAParte}// ritoccato a mano\n`);

        expect(comando().uscita).toBe(0);
        expect(readFileSync(nellaCopia(FILE_A_PARTE), 'utf8')).toBe(generatoAParte);
    });

    it.each([[['--controlla']], [[]]])('con un bundle di un\'altra forma (argomenti: %j) esce 1, dice che cosa non torna e non scrive niente', (argomenti) => {
        writeFileSync(nellaCopia(FILE_DEL_BUNDLE), readFileSync(delRepo(FILE_DEL_BUNDLE), 'utf8').replace('"format":4', '"format":5'));
        writeFileSync(nellaCopia(FILE_DEL_MODULO), RITOCCATO);
        const esito = comando(argomenti);

        expect([esito.uscita, esito.detto, esito.file === RITOCCATO]).toStrictEqual([1, '', true]);
        expect(esito.errore).toContain('resources/zeiras/bundle.js: forma inattesa del bundle: la riga 1 dichiara il formato 5, lo script conosce il 4');
        // Il rimedio di un bundle di un'altra forma è lo script (letture della PR #56, N7): resta detto qui, e solo qui.
        expect(esito.errore).toContain('resources/js/zeiras/componenti.js non è stato scritto: lo script va riallineato alla forma nuova del bundle.');
    });

    // Letture della PR #56, N7. Un bundle che manca non è un bundle di un'altra forma: il comando dice che il file non si legge
    // e perché, e non manda a riallineare lo script. Esce 1 e non scrive niente, come per ogni altro errore.
    it.each([[['--controlla']], [[]]])('senza il bundle (argomenti: %j) esce 1, dice che il bundle non si legge e perché, non scrive niente e non dice di riallineare lo script (sprint 26 · T2.5)', (argomenti) => {
        rmSync(nellaCopia(FILE_DEL_BUNDLE));
        writeFileSync(nellaCopia(FILE_DEL_MODULO), RITOCCATO);
        const esito = comando(argomenti);

        expect([esito.uscita, esito.detto, esito.file === RITOCCATO]).toStrictEqual([1, '', true]);
        expect(esito.errore).toContain('resources/zeiras/bundle.js: non si legge (ENOENT');
        expect(esito.errore).toContain('resources/js/zeiras/componenti.js non è stato scritto');
        expect(esito.errore).not.toContain('riallineato');
    });

    // Lettura della PR #59, R8. Nemmeno un bundle vuoto, o uno che si ferma a metà, è un bundle di un'altra forma: il file c'è
    // e si apre, ma il rimedio è quello di quando manca, rimetterlo al suo posto. Prima lo trovava `leggi`, «la riga 1 non è il
    // commento…», e il comando mandava a riallineare lo script. Ogni guasto è fatto dal bundle vero.
    const GUASTI: [string, (bundle: string) => string, string][] = [
        ['di 0 byte', () => '', 'è vuoto'],
        ['di soli a capo', () => '\n\n\n', 'è vuoto'],
        ['fermo ai primi 5 caratteri', (bundle) => bundle.slice(0, 5), 'si ferma a metà'],
        ['fermo ai primi 100 caratteri, dentro la riga 1', (bundle) => bundle.slice(0, 100), 'si ferma a metà'],
        ['fermo ai primi 60.000 caratteri', (bundle) => bundle.slice(0, 60_000), 'si ferma a metà'],
        ['fermo alle prime 800 righe', (bundle) => `${bundle.split('\n').slice(0, 800).join('\n')}\n`, 'si ferma a metà'],
    ];

    it.each(GUASTI.flatMap(([quale, guasta, perche]) => [['--controlla'], []].map((argomenti): [string, string[], string, (bundle: string) => string] => [quale, argomenti, perche, guasta])))(
        'con un bundle %s (argomenti: %j) esce 1 e dice che non si legge (%s), non scrive niente e non dice di riallineare lo script (sprint 27 · T5.3)',
        (_quale, argomenti, perche, guasta) => {
            const intero = readFileSync(delRepo(FILE_DEL_BUNDLE), 'utf8');
            const guastato = guasta(intero);
            writeFileSync(nellaCopia(FILE_DEL_BUNDLE), guastato);
            writeFileSync(nellaCopia(FILE_DEL_MODULO), RITOCCATO);
            const esito = comando(argomenti);

            // Un guasto rimasto uguale al bundle vero direbbe «sano» qui sotto.
            expect(guastato === intero).toBe(false);
            expect([esito.uscita, esito.detto, esito.file === RITOCCATO]).toStrictEqual([1, '', true]);
            expect(esito.errore).toContain(`resources/zeiras/bundle.js: non si legge (${perche}`);
            expect(esito.errore).toContain('resources/js/zeiras/componenti.js non è stato scritto');
            expect(esito.errore).not.toContain('riallineato');
        },
    );

    // Lettura della PR #60, R6. Un bundle intero con un'altra coda non «si ferma a metà»: la riga «})();» c'è. È un bundle di
    // un'altra forma: che cosa non torna lo dice `leggi`, e il rimedio è riallineare lo script, non rimettere al suo posto un
    // bundle che tornerebbe uguale. Lo stesso per un file di una riga col commento intero di un altro formato.
    const ALTRE_FORME: [string, (bundle: string) => string, string][] = [
        ['intero, senza l\'ultimo a capo', (bundle) => bundle.slice(0, -1), 'dopo la registrazione non c\'è la sola riga «})();»'],
        ['intero, con una riga in più in fondo', (bundle) => `${bundle}//# sourceMappingURL=bundle.js.map\n`, 'dopo la registrazione non c\'è la sola riga «})();»'],
        ['di una riga sola, col commento intero di un altro formato', () => '/* @ds-bundle: {"format":5,"namespace":"Zeiras"} */', 'la riga 1 dichiara il formato 5, lo script conosce il 4'],
    ];

    it.each(ALTRE_FORME.flatMap(([quale, cambia, cheCosa]) => [['--controlla'], []].map((argomenti): [string, string[], string, (bundle: string) => string] => [quale, argomenti, cheCosa, cambia])))(
        'con un bundle %s (argomenti: %j) esce 1 e dice che cosa non torna nella sua forma (%s), non che non si legge: rimesso al suo posto tornerebbe uguale; non scrive niente (sprint 27 · lettura della PR #60, R6)',
        (_quale, argomenti, cheCosa, cambia) => {
            const intero = readFileSync(delRepo(FILE_DEL_BUNDLE), 'utf8');
            const cambiato = cambia(intero);
            writeFileSync(nellaCopia(FILE_DEL_BUNDLE), cambiato);
            writeFileSync(nellaCopia(FILE_DEL_MODULO), RITOCCATO);
            const esito = comando(argomenti);

            expect(cambiato === intero).toBe(false);
            expect([esito.uscita, esito.detto, esito.file === RITOCCATO]).toStrictEqual([1, '', true]);
            expect(esito.errore).toContain(`resources/zeiras/bundle.js: forma inattesa del bundle: ${cheCosa}`);
            expect(esito.errore).toContain('lo script va riallineato alla forma nuova del bundle');
            expect(esito.errore).not.toContain('non si legge');
        },
    );

    it('lanciato da un collegamento simbolico alla cartella fa lo stesso lavoro: col file ritoccato `--controlla` esce 1', () => {
        const collegamento = join(radice, 'collegamento');
        rmSync(collegamento, { force: true });
        symlinkSync(copia, collegamento, 'dir');
        writeFileSync(nellaCopia(FILE_DEL_MODULO), RITOCCATO);

        expect(comando(['--controlla'], join(collegamento, 'scripts/componenti.mjs')).uscita).toBe(1);
        writeFileSync(nellaCopia(FILE_DEL_MODULO), generato);
        expect(comando(['--controlla'], join(collegamento, 'scripts/componenti.mjs')).uscita).toBe(0);
    });
});
