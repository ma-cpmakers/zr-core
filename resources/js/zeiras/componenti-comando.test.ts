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
const delRepo = (percorso: string) => fileURLToPath(new URL(`../../../${percorso}`, import.meta.url));
const radice = mkdtempSync(join(tmpdir(), 'zr-core-componenti-'));
const copia = join(radice, 'una copia #1 100% ?sì');
const nellaCopia = (percorso: string) => join(copia, percorso);
const generato = readFileSync(delRepo(FILE_DEL_MODULO), 'utf8');
const RITOCCATO = `${generato}// ritoccato a mano\n`;

/** Lancia il comando nella copia, da una cartella che non è la sua: uscita, ciò che scrive e ciò che dice. */
function comando(argomenti: string[] = [], script = nellaCopia('scripts/componenti.mjs')) {
    const esito = spawnSync(execPath, [script, ...argomenti], { cwd: radice, encoding: 'utf8' });

    return { uscita: esito.status, detto: esito.stdout, errore: esito.stderr, file: readFileSync(nellaCopia(FILE_DEL_MODULO), 'utf8') };
}

beforeEach(() => {
    rmSync(copia, { recursive: true, force: true });
    mkdirSync(nellaCopia('resources/zeiras'), { recursive: true });
    mkdirSync(nellaCopia('resources/js/zeiras'), { recursive: true });
    cpSync(delRepo('scripts'), nellaCopia('scripts'), { recursive: true });
    cpSync(delRepo(FILE_DEL_BUNDLE), nellaCopia(FILE_DEL_BUNDLE));
    writeFileSync(nellaCopia(FILE_DEL_MODULO), generato);
});

afterAll(() => {
    rmSync(radice, { recursive: true, force: true });
});

describe('il comando dei componenti fa sempre il suo lavoro, anche in una cartella col `#` nel percorso (sprint 25 · T6, R3)', () => {
    it('`--controlla` col file che il bundle genera: esce 0 e dice quanti nomi esporta', () => {
        const esito = comando(['--controlla']);

        expect([esito.uscita, esito.errore, esito.file === generato]).toStrictEqual([0, '', true]);
        expect(esito.detto).toMatch(/^resources\/js\/zeiras\/componenti\.js: è quello che resources\/zeiras\/bundle\.js genera \(\d+ nomi esportati\)\n$/);
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
        expect(esito.detto).toMatch(/^scritto resources\/js\/zeiras\/componenti\.js \(\d+ nomi esportati\)\n$/);
    });

    it.each([[['--controlla']], [[]]])('con un bundle di un\'altra forma (argomenti: %j) esce 1, dice che cosa non torna e non scrive niente', (argomenti) => {
        writeFileSync(nellaCopia(FILE_DEL_BUNDLE), readFileSync(delRepo(FILE_DEL_BUNDLE), 'utf8').replace('"format":4', '"format":5'));
        writeFileSync(nellaCopia(FILE_DEL_MODULO), RITOCCATO);
        const esito = comando(argomenti);

        expect([esito.uscita, esito.detto, esito.file === RITOCCATO]).toStrictEqual([1, '', true]);
        expect(esito.errore).toContain('resources/zeiras/bundle.js: forma inattesa del bundle: la riga 1 dichiara il formato 5, lo script conosce il 4');
        expect(esito.errore).toContain('resources/js/zeiras/componenti.js non è stato scritto');
    });

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
