import { describe, expect, it } from 'vitest';
import inglese from '../lingue/en.json';
import spagnolo from '../lingue/es.json';
import italiano from '../lingue/it.json';
import { caricaLingue, lingue, nomeDellaVoce, testi } from './lingue';
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
});
