import { describe, expect, it } from 'vitest';
import inglese from '../lingue/en.json';
import spagnolo from '../lingue/es.json';
import italiano from '../lingue/it.json';
import { caricaLingue, linguaDeiTesti, lingue, nomeDellaVoce, testi } from './lingue';
import { registro } from './registro';

// Sprint 1 · T5 (voce #1255). Il ripiego sull'inglese, testo per testo, e le lingue scoperte dai file di resources/lingue. Che
// italiano, spagnolo e inglese abbiano ogni testo, che l'italiano sia quello del design system e che nessuna lingua sia elencata
// nel codice lo prova tests/Feature/LingueTest.php.

describe('le lingue della cornice', () => {
    it("dove una lingua non ha un testo, o l'ha vuoto, quel testo è in inglese (T5.2)", () => {
        const tedesco = caricaLingue({ '../lingue/de.json': { soon: 'Bald', logout: ' ' } }).testi('de');

        // Tutti i testi, sempre: con uno solo in meno l'`AppShell` mostrerebbe il suo default italiano.
        expect(tedesco).toStrictEqual({ ...inglese, soon: 'Bald' });
        expect(tedesco.planText).not.toBe(italiano.planText);
    });

    it('una lingua senza il nome di un prodotto, o col nome vuoto, lo mostra in inglese, non in italiano (T7.2)', () => {
        const tedesco = caricaLingue({ '../lingue/de.json': { pm: 'Projektmanagement', content: ' ' } }).testi('de');

        expect([tedesco.pm, tedesco.automations, tedesco.content]).toStrictEqual(['Projektmanagement', 'Automations', 'Content']);
        expect(tedesco.automations).not.toBe(italiano.automations);
    });

    it('nomeDellaVoce dà il nome di una voce del registro nella lingua: la Dashboard col testo `dashboard`, un prodotto col suo id (T7.2)', () => {
        expect(registro.map((voce) => nomeDellaVoce(voce, 'es')))
            .toStrictEqual(['Dashboard', 'Gestión de proyectos', 'CRM', 'Reservas', 'Informes', 'Automatismos', 'Contenidos']);
        expect(nomeDellaVoce({ id: 'content' }, 'pt-BR')).toBe('Content');
    });

    it('con una lingua che non esiste, tutti i testi sono in inglese: né il default italiano né il nome della chiave (T5.2)', () => {
        expect(testi('zz')).toStrictEqual(inglese);
        expect(testi('')).toStrictEqual(inglese);
        expect(testi('constructor')).toStrictEqual(inglese);
        expect(testi('zz').logout).not.toBe('logout');
    });

    it('una variante regionale senza file prende la lingua base; una lingua che non c\'è, l\'inglese (T5.2)', () => {
        expect(testi('it-IT')).toStrictEqual(italiano);
        expect(testi('IT')).toStrictEqual(italiano);
        expect(testi('es_ES')).toStrictEqual(spagnolo);
        expect(testi('pt-BR')).toStrictEqual(inglese);
    });

    it('date e ore stanno nella lingua dei testi: quella del file, della lingua base o l\'inglese, in un codice che `Intl` accetta (sprint 3 · T4.1)', () => {
        expect(['it', 'it-IT', 'IT', 'it_IT', 'es_ES', 'en', 'pt-BR', 'zz', ''].map((lingua) => linguaDeiTesti(lingua)))
            .toStrictEqual(['it', 'it', 'it', 'it', 'es', 'en', 'en', 'en', 'en']);
    });

    it('una lingua che c\'è dà i suoi testi', () => {
        expect(testi('it')).toStrictEqual(italiano);
        expect(testi('es')).toStrictEqual(spagnolo);
        expect(testi('en')).toStrictEqual(inglese);
    });

    it('una lingua nuova si aggiunge con un file in resources/lingue, senza toccare il codice (T5.3)', () => {
        expect(lingue).toEqual(expect.arrayContaining(['it', 'es', 'en']));

        // Un file in più, e nessuna riga di codice: il francese c'è, e dove non ha un testo è in inglese.
        const conIlFrancese = caricaLingue({ '../lingue/en.json': inglese, '../lingue/fr.json': { soon: 'Bientôt' } });
        expect(conIlFrancese.lingue).toStrictEqual(['en', 'fr']);
        expect(conIlFrancese.testi('fr')).toStrictEqual({ ...inglese, soon: 'Bientôt' });
    });

    // Sprint 16 · review, R12: il pannello chiede un titolo a `titoloDellaNotifica` per ogni notifica, a ogni render, e ogni volta
    // `testi` ricomponeva tutti i testi della lingua. Ora li compone una volta per file, e dà sempre lo stesso oggetto.
    it('i testi di una lingua si compongono una volta sola: la stessa lingua e una sua variante regionale danno ogni volta lo stesso oggetto, e le lingue che zr-core non ha ne hanno uno solo fra tutte (sprint 16 · review, R12)', () => {
        expect(testi('it')).toBe(testi('it'));
        expect(testi('it-IT')).toBe(testi('it'));
        expect(testi('IT')).toBe(testi('it'));
        expect(testi('es_ES')).toBe(testi('es'));
        // Una lingua che non c'è non lascia niente di suo: `pt-BR`, `zz`, il vuoto e `constructor` hanno lo stesso oggetto.
        expect(testi('pt-BR')).toBe(testi('zz'));
        expect(testi('')).toBe(testi('constructor'));
        expect(testi('zz')).toStrictEqual(inglese);
        // Lingue diverse, oggetti diversi: non uno per tutte.
        expect(testi('it')).not.toBe(testi('es'));
        expect(testi('zz')).not.toBe(testi('it'));
        expect(testi('it')).toStrictEqual(italiano);
        expect(testi('es')).toStrictEqual(spagnolo);

        // Ogni elenco di file ha i suoi: il tedesco di un elenco non è quello di un altro.
        const conIlTedesco = caricaLingue({ '../lingue/en.json': inglese, '../lingue/de.json': { soon: 'Bald' } });
        // Chiesti per la prima volta con una variante regionale e con una lingua che non c'è: nemmeno così lasciano un oggetto loro.
        const dellaVariante = conIlTedesco.testi('de-AT');
        const diUnaCheNonCE = conIlTedesco.testi('pt-BR');
        expect(conIlTedesco.testi('de')).toBe(dellaVariante);
        expect(conIlTedesco.testi('zz')).toBe(diUnaCheNonCE);
        expect(conIlTedesco.testi('')).toBe(diUnaCheNonCE);
        expect(diUnaCheNonCE).not.toBe(dellaVariante);
        expect(conIlTedesco.testi('de')).not.toBe(caricaLingue({ '../lingue/en.json': inglese, '../lingue/de.json': { soon: 'Bald' } }).testi('de'));
        expect(conIlTedesco.testi('de')).toStrictEqual({ ...inglese, soon: 'Bald' });
    });

    it('i testi che `testi` dà sono di tutti quelli che li chiedono, e non si cambiano da fuori: l\'oggetto è congelato, e l\'inglese dei file resta com\'è (sprint 16 · review, R12)', () => {
        const t = testi('it');

        expect(Object.isFrozen(t)).toBe(true);
        expect(() => {
            (t as { logout: string }).logout = 'uat';
        }).toThrow(TypeError);
        // Lo dice anche il tipo (seconda lettura, N3): una scrittura non passa `tsc`, e chi la scrive lo sa prima del browser.
        expect(() => {
            // @ts-expect-error i testi sono di sola lettura
            t.logout = 'uat';
        }).toThrow(TypeError);
        expect(testi('it').logout).toBe(italiano.logout);
        // Congelato è l'oggetto composto, non il file dell'inglese, che è anche il ripiego di ogni lingua.
        expect(testi('en')).not.toBe(inglese);
        expect(Object.isFrozen(inglese)).toBe(false);
    });

    // Sprint 12 · T3 (voce #1463): il titolo di una notifica è quello del suo tipo, con `notificationTitle.<tipo>` per chiave.
    it('il titolo di un tipo di notifica che una lingua non ha è in inglese, e un tipo che l\'inglese non ha non esiste (sprint 12 · T3.3)', () => {
        const { 'notificationTitle.com.zeiras.board.scheda.creata': tolto, ...senzaUnTitolo } = spagnolo;
        const conLoSpagnoloCambiato = caricaLingue({
            '../lingue/en.json': inglese,
            '../lingue/es.json': { ...senzaUnTitolo, 'notificationTitle.com.zeiras.crm.contatto.creato': 'Nuevo contacto' },
        });
        const t = conLoSpagnoloCambiato.testi('es');
        const tipiCheHa = (testi: object) => Object.keys(testi).filter((chiave) => chiave.startsWith('notificationTitle.')).sort();

        expect(tolto).toBe('Nueva tarjeta');
        expect(t['notificationTitle.com.zeiras.board.scheda.creata']).toBe('New card');
        // Gli altri titoli restano in spagnolo, e il ripiego pure.
        expect(t['notificationTitle.com.zeiras.board.scheda.modificata']).toBe('Tarjeta modificada');
        expect(t.notificationTitle).toBe('Novedades en el workspace');
        // I tipi che zr-core conosce li dicono le chiavi dell'inglese: 19, in ogni lingua, anche con un file che ne ha uno in più.
        expect(tipiCheHa(inglese)).toHaveLength(19);
        expect(tipiCheHa(t)).toStrictEqual(tipiCheHa(inglese));
        expect(tipiCheHa(testi('it'))).toStrictEqual(tipiCheHa(inglese));
        expect(tipiCheHa(testi('zz'))).toStrictEqual(tipiCheHa(inglese));
    });

    // Sprint 16 · T5 (voce #1479): il titolo di un tipo di notifica per chi lo mostra fuori dalla cornice, dall'ingresso del
    // pacchetto. Che sia lo stesso testo del pannello delle notifiche lo prova cornice.test.tsx.
    /** I tipi che zr-core conosce: le chiavi dell'inglese, senza `notificationTitle.` davanti. */
    const tipiConosciuti = Object.keys(inglese).flatMap((chiave) => (chiave.startsWith('notificationTitle.') ? [chiave.slice('notificationTitle.'.length)] : []));
    /** Il titolo di ripiego, per lingua. */
    const diRipiego = { it: 'Novità nel workspace', es: 'Novedades en el workspace', en: 'News in the workspace' };

    it.each<[lingua: 'it' | 'es' | 'en', file: Record<string, string>, dellaSchedaCreata: string]>([
        ['it', italiano, 'Nuova scheda'],
        ['es', spagnolo, 'Nueva tarjeta'],
        ['en', inglese, 'New card'],
    ])('titoloDellaNotifica, dall\'ingresso del pacchetto, con la lingua "%s" dà per ognuno dei 19 tipi che zr-core conosce il titolo che ha nel file di quella lingua, mai quello di ripiego (sprint 16 · T5.1)', async (lingua, file, dellaSchedaCreata) => {
        const { titoloDellaNotifica } = await import('./index');
        const titoli = tipiConosciuti.map((tipo) => titoloDellaNotifica(tipo, lingua));

        expect(tipiConosciuti).toHaveLength(19);
        expect(titoli).toStrictEqual(tipiConosciuti.map((tipo) => file[`notificationTitle.${tipo}`]));
        expect(titoloDellaNotifica('com.zeiras.board.scheda.creata', lingua)).toBe(dellaSchedaCreata);
        // Nessun tipo conosciuto esce col titolo di ripiego, e i 19 titoli sono 19 testi diversi.
        expect(titoli).not.toContain(diRipiego[lingua]);
        expect(new Set(titoli).size).toBe(19);
    });

    it.each(['it', 'es', 'en'] as const)('con la lingua "%s", titoloDellaNotifica dà il titolo di ripiego a un tipo che zr-core non conosce, vuoto, mancante o che non è un testo: mai il codice del tipo, mai un testo vuoto (sprint 16 · T5.2)', async (lingua) => {
        const { titoloDellaNotifica } = await import('./index');
        const tipi: unknown[] = [
            // Un tipo che il contratto non ha ancora, e uno che ha solo il nome di un altro davanti o dietro.
            'com.zeiras.crm.contatto.creato', 'com.zeiras.board.scheda', 'com.zeiras.board.scheda.creata.poi', 'COM.ZEIRAS.BOARD.SCHEDA.CREATA', ' com.zeiras.board.scheda.creata',
            // Nomi che ogni oggetto ha, e il vuoto.
            'constructor', '__proto__', 'toString', '',
            // Mancante, e ciò che non è un testo: anche un elenco che, scritto come testo, sarebbe un tipo conosciuto.
            undefined, null, 7, true, ['com.zeiras.board.scheda.creata'], { toString: () => 'com.zeiras.board.scheda.creata' },
        ];

        expect(tipi.map((tipo) => titoloDellaNotifica(tipo, lingua))).toStrictEqual(tipi.map(() => diRipiego[lingua]));
    });

    it('con una lingua che zr-core non ha, titoloDellaNotifica dà l\'inglese, per un tipo conosciuto e per il ripiego; con una variante regionale, la lingua base (sprint 16 · T5.2)', async () => {
        const { titoloDellaNotifica } = await import('./index');
        const cheNonHa = ['pt-BR', 'zz', '', 'constructor'];

        expect(cheNonHa.map((lingua) => titoloDellaNotifica('com.zeiras.board.scheda.creata', lingua))).toStrictEqual(cheNonHa.map(() => 'New card'));
        expect(cheNonHa.map((lingua) => titoloDellaNotifica('uat-tipo-ignoto', lingua))).toStrictEqual(cheNonHa.map(() => 'News in the workspace'));
        expect(['it-IT', 'IT', 'es_ES'].map((lingua) => titoloDellaNotifica('com.zeiras.board.scheda.creata', lingua))).toStrictEqual(['Nuova scheda', 'Nuova scheda', 'Nueva tarjeta']);
        expect(['it-IT', 'IT', 'es_ES'].map((lingua) => titoloDellaNotifica(undefined, lingua))).toStrictEqual(['Novità nel workspace', 'Novità nel workspace', 'Novedades en el workspace']);
    });
});
