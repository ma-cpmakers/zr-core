import { describe, expect, it } from 'vitest';
import inglese from '../lingue/en.json';
import spagnolo from '../lingue/es.json';
import italiano from '../lingue/it.json';
import { caricaLingue, linguaDeiTesti, lingue, nomeDellaVoce, testi, testiDellaRicerca } from './lingue';
import { fontiDellaRicerca, registro, type TipoDiRisorsa } from './registro';

// Sprint 1 · T5 (voce #1255). Il ripiego sull'inglese, testo per testo, e le lingue scoperte dai file di resources/lingue. Che
// italiano, spagnolo e inglese abbiano ogni testo, che l'italiano sia quello del design system (o, dove c'è una decisione, quello
// deciso prima che il design system lo porti) e che nessuna lingua sia elencata nel codice lo prova tests/Feature/LingueTest.php.

/** I tipi di risorsa del registro, `<prodotto>.<tipo>`, nel suo ordine: le chiavi dei loro nomi nelle lingue. */
const tipiDelRegistro = registro.flatMap((voce) => (voce.risorse ?? []).map((risorsa) => `${voce.id}.${risorsa.tipo}`));
/** Le fonti della ricerca di Project Management e quelle del CRM, nell'ordine del registro. */
const diProjectManagement: TipoDiRisorsa[] = ['pm.board.scheda', 'pm.board.board', 'pm.board.cartelle'];
const delCrm: TipoDiRisorsa[] = ['crm.crm.persona', 'crm.crm.organizzazione', 'crm.crm.trattativa'];

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
        // I tipi che zr-core conosce li dicono le chiavi dell'inglese: 41, in ogni lingua, anche con un file che ne ha uno in più.
        expect(tipiCheHa(inglese)).toHaveLength(41);
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
    ])('titoloDellaNotifica, dall\'ingresso del pacchetto, con la lingua "%s" dà per ognuno dei 41 tipi che zr-core conosce il titolo che ha nel file di quella lingua, mai quello di ripiego (sprint 16 · T5.1; sprint 21 · T2.1, T5.3; sprint 22 · T5.4; sprint 24 · T3.1)', async (lingua, file, dellaSchedaCreata) => {
        const { titoloDellaNotifica } = await import('./index');
        const titoli = tipiConosciuti.map((tipo) => titoloDellaNotifica(tipo, lingua));

        expect(tipiConosciuti).toHaveLength(41);
        expect(titoli).toStrictEqual(tipiConosciuti.map((tipo) => file[`notificationTitle.${tipo}`]));
        expect(titoloDellaNotifica('com.zeiras.board.scheda.creata', lingua)).toBe(dellaSchedaCreata);
        // Nessun tipo conosciuto esce col titolo di ripiego, e i 41 titoli sono 41 testi diversi.
        expect(titoli).not.toContain(diRipiego[lingua]);
        expect(new Set(titoli).size).toBe(41);
    });

    // Sprint 21 · T2 (voce #1641): i sette tipi del CRM che il contratto ha. La tabella è quella della voce, scritta qui e non
    // letta dai file delle lingue: nel CRM una `persona` è un «contatto», e in italiano e in spagnolo «pipeline» e «nota» sono
    // al femminile. Un titolo è un testo intero per tipo, mai «Nuovo» più il nome della cosa.
    const titoliDelCrm: [tipo: string, it: string, en: string, es: string][] = [
        ['com.zeiras.crm.persona.creata', 'Nuovo contatto', 'New contact', 'Nuevo contacto'],
        ['com.zeiras.crm.persona.modificata', 'Contatto modificato', 'Contact changed', 'Contacto modificado'],
        ['com.zeiras.crm.pipeline.creata', 'Nuova pipeline', 'New pipeline', 'Nueva pipeline'],
        ['com.zeiras.crm.pipeline.modificata', 'Pipeline modificata', 'Pipeline changed', 'Pipeline modificada'],
        ['com.zeiras.crm.nota.creata', 'Nuova nota', 'New note', 'Nueva nota'],
        ['com.zeiras.crm.nota.modificata', 'Nota modificata', 'Note changed', 'Nota modificada'],
        ['com.zeiras.crm.nota.eliminata', 'Nota eliminata', 'Note deleted', 'Nota eliminada'],
    ];

    it.each(titoliDelCrm.flatMap(([tipo, it, en, es]) => [[tipo, 'it', it], [tipo, 'en', en], [tipo, 'es', es]]))(
        'titoloDellaNotifica dà a %s, con la lingua "%s", il titolo «%s» (sprint 21 · T2.1)',
        async (tipo, lingua, titolo) => {
            const { titoloDellaNotifica } = await import('./index');

            expect(titoloDellaNotifica(tipo, lingua)).toBe(titolo);
        },
    );

    it.each(['it', 'es', 'en'] as const)('con la lingua "%s", un tipo del CRM che zr-core non conosce ancora ha il titolo di ripiego, non quello del tipo a cui somiglia (sprint 21 · T2.2)', async (lingua) => {
        const { titoloDellaNotifica } = await import('./index');
        // Il tipo vero è `crm.persona.assegnata`, senza `com.zeiras.` davanti (sprint 22 · T5.2): col prefisso zr-core non lo
        // conosce; gli altri sono pezzi di un tipo che conosce.
        const cheNonConosce = ['com.zeiras.crm.persona.assegnata', 'com.zeiras.crm.persona', 'com.zeiras.crm.persona.creata.poi', 'com.zeiras.crm.nota', 'com.zeiras.crm'];

        expect(cheNonConosce.map((tipo) => titoloDellaNotifica(tipo, lingua))).toStrictEqual(cheNonConosce.map(() => diRipiego[lingua]));
    });

    // Sprint 21 · T5 (voce #1706): i cinque tipi che il contratto porta dall'11/10/2026, le viste salvate di una board e le
    // aziende del CRM, con le parole dei due moduli. Nel contratto un'azienda è una `organizzazione`: il titolo non si ricava
    // dal tipo.
    const titoliDiVisteEAziende: [tipo: string, it: string, en: string, es: string][] = [
        ['com.zeiras.board.vista.creata', 'Nuova vista', 'New view', 'Nueva vista'],
        ['com.zeiras.board.vista.modificata', 'Vista modificata', 'View changed', 'Vista modificada'],
        ['com.zeiras.board.vista.eliminata', 'Vista eliminata', 'View deleted', 'Vista eliminada'],
        ['com.zeiras.crm.organizzazione.creata', 'Nuova azienda', 'New company', 'Nueva empresa'],
        ['com.zeiras.crm.organizzazione.modificata', 'Azienda modificata', 'Company changed', 'Empresa modificada'],
    ];

    it.each(titoliDiVisteEAziende.flatMap(([tipo, it, en, es]) => [[tipo, 'it', it], [tipo, 'en', en], [tipo, 'es', es]]))(
        'titoloDellaNotifica dà a %s, con la lingua "%s", il titolo «%s» (sprint 21 · T5.1)',
        async (tipo, lingua, titolo) => {
            const { titoloDellaNotifica } = await import('./index');

            expect(titoloDellaNotifica(tipo, lingua)).toBe(titolo);
        },
    );

    it.each(['it', 'en', 'es'] as const)('con la lingua "%s", nessun titolo chiama «organizzazione» un\'azienda del CRM, e un tipo delle viste o delle aziende che il contratto non ha resta col titolo di ripiego (sprint 21 · T5.1, T5.3)', async (lingua) => {
        const { titoloDellaNotifica } = await import('./index');
        const delleAziende = ['com.zeiras.crm.organizzazione.creata', 'com.zeiras.crm.organizzazione.modificata'].map((tipo) => titoloDellaNotifica(tipo, lingua));
        // Il contratto non ha l'eliminazione di un'azienda, né un tipo `azienda`: la parola del modulo sta nel titolo, non nel tipo.
        const cheIlContrattoNonHa = ['com.zeiras.crm.organizzazione.eliminata', 'com.zeiras.crm.azienda.creata', 'com.zeiras.crm.organizzazione', 'com.zeiras.board.vista', 'com.zeiras.board.vista.creata.poi'];

        expect(delleAziende.join(' · ')).not.toMatch(/organi[zs]/i);
        expect(delleAziende).not.toContain(diRipiego[lingua]);
        expect(cheIlContrattoNonHa.map((tipo) => titoloDellaNotifica(tipo, lingua))).toStrictEqual(cheIlContrattoNonHa.map(() => diRipiego[lingua]));
    });

    // Sprint 22 · T5 (voce #1720): i nove tipi che lo sprint 25g di zr-backoffice porta, con le parole di zr-crm. Nel contratto
    // un'opportunità è una `trattativa`: il titolo non si ricava dal tipo. I quattro «assegnata» non sono eventi: il tipo arriva
    // com'è nel backoffice, senza `com.zeiras.` davanti.
    const titoliDiOpportunitaAttivitaEAssegnate: [tipo: string, it: string, en: string, es: string][] = [
        ['com.zeiras.crm.trattativa.creata', 'Nuova opportunità', 'New opportunity', 'Nueva oportunidad'],
        ['com.zeiras.crm.trattativa.modificata', 'Opportunità modificata', 'Opportunity changed', 'Oportunidad modificada'],
        ['com.zeiras.crm.attivita.creata', 'Nuova attività', 'New activity', 'Nueva actividad'],
        ['com.zeiras.crm.attivita.modificata', 'Attività modificata', 'Activity changed', 'Actividad modificada'],
        ['com.zeiras.crm.attivita.eliminata', 'Attività eliminata', 'Activity deleted', 'Actividad eliminada'],
        ['crm.persona.assegnata', 'Ti è stato assegnato un contatto', 'A contact was assigned to you', 'Se te ha asignado un contacto'],
        ['crm.organizzazione.assegnata', 'Ti è stata assegnata un\'azienda', 'A company was assigned to you', 'Se te ha asignado una empresa'],
        ['crm.trattativa.assegnata', 'Ti è stata assegnata un\'opportunità', 'An opportunity was assigned to you', 'Se te ha asignado una oportunidad'],
        ['crm.attivita.assegnata', 'Ti è stata assegnata un\'attività', 'An activity was assigned to you', 'Se te ha asignado una actividad'],
    ];

    it.each(titoliDiOpportunitaAttivitaEAssegnate.flatMap(([tipo, it, en, es]) => [[tipo, 'it', it], [tipo, 'en', en], [tipo, 'es', es]]))(
        'titoloDellaNotifica dà a %s, con la lingua "%s", il titolo «%s» (sprint 22 · T5.1)',
        async (tipo, lingua, titolo) => {
            const { titoloDellaNotifica } = await import('./index');

            expect(titoloDellaNotifica(tipo, lingua)).toBe(titolo);
        },
    );

    it.each(['it', 'en', 'es'] as const)('con la lingua "%s", nessuno dei nove titoli nuovi del CRM chiama un\'opportunità con la parola del contratto, e nessuno è il titolo di ripiego (sprint 22 · T5.1)', async (lingua) => {
        const { titoloDellaNotifica } = await import('./index');
        const titoli = titoliDiOpportunitaAttivitaEAssegnate.map(([tipo]) => titoloDellaNotifica(tipo, lingua));

        expect(titoli).toHaveLength(9);
        // «trattativa», «deal», «negociación»: le parole del contratto, non quelle del CRM.
        expect(titoli.join(' · ')).not.toMatch(/trattativ|\bdeals?\b|negociaci/i);
        expect(titoli).not.toContain(diRipiego[lingua]);
    });

    it.each(['it', 'en', 'es'] as const)('con la lingua "%s", i quattro «assegnata» hanno il titolo col tipo senza `com.zeiras.` davanti: lo stesso nome col prefisso, e un evento senza il suo, restano col titolo di ripiego (sprint 22 · T5.2)', async (lingua) => {
        const { titoloDellaNotifica } = await import('./index');
        const assegnate = titoliDiOpportunitaAttivitaEAssegnate.map(([tipo]) => tipo).filter((tipo) => tipo.endsWith('.assegnata'));
        // Un evento ha `com.zeiras.` davanti: senza, non è un tipo che zr-core conosce.
        const eventiSenzaPrefisso = ['crm.trattativa.creata', 'crm.attivita.eliminata', 'crm.persona.creata'];

        expect(assegnate).toStrictEqual(['crm.persona.assegnata', 'crm.organizzazione.assegnata', 'crm.trattativa.assegnata', 'crm.attivita.assegnata']);
        expect(assegnate.map((tipo) => titoloDellaNotifica(tipo, lingua))).not.toContain(diRipiego[lingua]);
        expect(assegnate.map((tipo) => titoloDellaNotifica(`com.zeiras.${tipo}`, lingua))).toStrictEqual(assegnate.map(() => diRipiego[lingua]));
        expect(eventiSenzaPrefisso.map((tipo) => titoloDellaNotifica(tipo, lingua))).toStrictEqual(eventiSenzaPrefisso.map(() => diRipiego[lingua]));
    });

    // Sprint 24 · T3 (voce #1748): la notifica che Project Management manda a chi viene assegnata una scheda, con le parole di
    // zr-board (nota 10451 del #95). Non è un evento nemmeno lei: il tipo arriva senza `com.zeiras.` davanti.
    it.each<[lingua: 'it' | 'en' | 'es', titolo: string]>([
        ['it', 'Ti è stata assegnata una scheda'],
        ['en', 'A card was assigned to you'],
        ['es', 'Se te ha asignado una tarjeta'],
    ])('con la lingua "%s", titoloDellaNotifica dà a `board.scheda.assegnata` il titolo «%s»; lo stesso nome col prefisso, un evento della scheda senza il suo e un tipo che gli somiglia restano col titolo di ripiego (sprint 24 · T3.1)', async (lingua, titolo) => {
        const { titoloDellaNotifica } = await import('./index');
        const cheNonConosce = ['com.zeiras.board.scheda.assegnata', 'board.scheda.creata', 'board.scheda', 'board.scheda.assegnata.poi', 'BOARD.SCHEDA.ASSEGNATA'];

        expect(titoloDellaNotifica('board.scheda.assegnata', lingua)).toBe(titolo);
        expect(titolo).not.toBe(diRipiego[lingua]);
        expect(cheNonConosce.map((tipo) => titoloDellaNotifica(tipo, lingua))).toStrictEqual(cheNonConosce.map(() => diRipiego[lingua]));
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

    // Sprint 20 · T1.8 (review della PR #24, R1): la seconda riga di una notifica è il nome della cosa, che il backoffice dà in
    // `risorsa_nome`. Per una notifica su un'app dà il codice dell'app: il nome lo dicono il registro e le lingue, come per `app`.
    it.each([
        ['it', 'Project Management', 'Report', 'Contenuti'],
        ['es', 'Gestión de proyectos', 'Informes', 'Contenidos'],
        ['en', 'Project Management', 'Reports', 'Content'],
        // Una variante regionale prende la lingua base; una lingua che zr-core non ha, l'inglese.
        ['es_ES', 'Gestión de proyectos', 'Informes', 'Contenidos'],
        ['fr', 'Project Management', 'Reports', 'Content'],
    ] as const)('risorsaDellaNotifica, dall\'ingresso del pacchetto, con la lingua "%s": per una notifica su un\'app (un tipo `com.zeiras.app.…`) dà il nome che il prodotto ha nella lingua, mai il codice, e niente se il registro non ha quel codice; per ogni altro tipo dà `risorsa_nome` com\'è, senza gli spazi intorno (sprint 20 · T1.8)', async (lingua, pm, reports, content) => {
        const { risorsaDellaNotifica } = await import('./index');
        const suUnApp = (risorsa_nome: unknown, tipo: unknown = 'com.zeiras.app.modificata') => risorsaDellaNotifica({ tipo, risorsa_nome }, lingua);

        expect([suUnApp('pm'), suUnApp(' reports\n'), suUnApp('content'), suUnApp('crm')]).toStrictEqual([pm, reports, content, 'CRM']);
        // Ogni prodotto del registro ha il suo nome, anche «Presto»; la Dashboard non è un prodotto.
        expect(registro.filter((voce) => voce.id !== 'home').map((voce) => suUnApp(voce.id))).toStrictEqual(registro.filter((voce) => voce.id !== 'home').map((voce) => nomeDellaVoce(voce, lingua)));
        expect([suUnApp('home'), suUnApp('uat-app-nuova'), suUnApp('PM'), suUnApp('Project Management'), suUnApp('pm crm')]).toStrictEqual(Array(5).fill(undefined));
        // Seconda lettura della PR #24, S2: il codice si cerca nel registro, non fra i testi delle lingue né fra i nomi che ogni oggetto ha.
        const prodotti = registro.filter((voce) => voce.id !== 'home').map((voce): string => voce.id);
        const testiCheNonSonoProdotti = Object.keys(italiano).filter((chiave) => !prodotti.includes(chiave));
        expect(testiCheNonSonoProdotti).toEqual(expect.arrayContaining(['dashboard', 'products', 'unread', 'pm.board.board']));
        const nonSonoApp = [...testiCheNonSonoProdotti, 'constructor', 'toString', '__proto__', 'hasOwnProperty'];
        expect(nonSonoApp.map((codice) => suUnApp(codice))).toStrictEqual(nonSonoApp.map(() => undefined));
        // Un tipo della stessa famiglia che zr-core non conosce ancora ha la stessa regola.
        expect([suUnApp('pm', 'com.zeiras.app.uat-nuovo'), suUnApp('uat-app-nuova', 'com.zeiras.app.uat-nuovo')]).toStrictEqual([pm, undefined]);
        // Fuori da quella famiglia «pm» è il nome di una cosa: una cartella, una board, una scheda.
        expect(['com.zeiras.board.cartella.creata', 'com.zeiras.applicazione.uat', 'com.zeiras.app', 'uat.com.zeiras.app.modificata', '', undefined, null, 7].map((tipo) => risorsaDellaNotifica({ tipo, risorsa_nome: ' pm ' }, lingua))).toStrictEqual(Array(8).fill('pm'));
        expect(risorsaDellaNotifica({ tipo: 'com.zeiras.board.board.creata', risorsa_nome: '  UAT Lancio Q4 ' }, lingua)).toBe('UAT Lancio Q4');
    });

    it('risorsaDellaNotifica non dà niente quando il nome non c\'è — `null`, vuoto, di soli spazi, senza la chiave, o un valore che non è un testo — per ogni tipo; e prende una notifica com\'è, del backoffice o della rotta della cornice (sprint 20 · T1.8)', async () => {
        const { risorsaDellaNotifica } = await import('./index');
        const senzaNome = [null, undefined, '', ' \t\n ', 0, 7, false, true, ['pm'], { nome: 'pm' }];

        for (const tipo of ['com.zeiras.board.cartella.creata', 'com.zeiras.app.modificata', undefined]) {
            expect(senzaNome.map((risorsa_nome) => risorsaDellaNotifica({ tipo, risorsa_nome }, 'it'))).toStrictEqual(senzaNome.map(() => undefined));
            expect(risorsaDellaNotifica({ tipo }, 'it')).toBeUndefined();
        }
        expect(risorsaDellaNotifica({}, 'it')).toBeUndefined();
        // Le altre chiavi di una notifica non contano: né `app`, né `soggetto`.
        const delBackoffice = { id: 'uat-n1', tipo: 'com.zeiras.app.modificata', app: null, soggetto: '/v1/app/crm', dati: {}, letta_il: null, creata_il: '2026-10-11T07:00:00Z', autore: null, risorsa_nome: 'pm', per_me: null };
        const dellaCornice = { id: 'uat-n2', creata_il: '2026-10-11T07:00:00Z', letta: false, app: 'crm', tipo: 'com.zeiras.board.scheda.creata', autore_nome: null, risorsa_nome: 'UAT Scrivere il brief', per_me: null };
        expect([risorsaDellaNotifica(delBackoffice, 'it'), risorsaDellaNotifica(dellaCornice, 'it')]).toStrictEqual(['Project Management', 'UAT Scrivere il brief']);
    });

    // Sprint 17 · T1 (voce #1481): i due testi che il pulsante «Segna tutte come lette» ha mentre la richiesta è in corso e quando
    // ne restano sono chiavi di zr-core, non valori cambiati a `markAllRead`, che è dell'`AppShell` e resta com'è in ogni lingua.
    it('i due testi del pulsante delle notifiche sono chiavi di zr-core nelle tre lingue, e `markAllRead` resta il testo di prima; in una lingua che zr-core non ha sono in inglese (sprint 17 · T1.6)', () => {
        expect([italiano, spagnolo, inglese].map((file) => [file.markingAllRead, file.markRestRead])).toStrictEqual([
            ['Segno…', 'Segna le altre'],
            ['Marcando…', 'Marcar las demás'],
            ['Marking…', 'Mark the rest'],
        ]);
        expect([italiano, spagnolo, inglese].map((file) => file.markAllRead)).toStrictEqual(['Segna tutte come lette', 'Marcar todas como leídas', 'Mark all as read']);

        // Una lingua che ha solo il testo dell'`AppShell`: i due di zr-core li prende dall'inglese, e il suo resta suo.
        const tedesco = caricaLingue({ '../lingue/de.json': { markAllRead: 'Alle als gelesen markieren' } }).testi('de');
        expect([tedesco.markAllRead, tedesco.markingAllRead, tedesco.markRestRead]).toStrictEqual(['Alle als gelesen markieren', 'Marking…', 'Mark the rest']);
        expect([testi('pt-BR').markingAllRead, testi('pt-BR').markRestRead]).toStrictEqual(['Marking…', 'Mark the rest']);
    });

    // Sprint 22 · T2 (voce #1712): ciò che l'avviso della cornice dice quando l'ultima non letta è stata letta. Con un numero
    // dice il nome della campanella, coi testi dell'`AppShell`; a zero quel nome non ha un numero da dire, e il testo è di zr-core.
    it('il testo dell\'avviso senza non lette è una chiave di zr-core nelle tre lingue, e in una lingua che zr-core non ha è in inglese (sprint 22 · T2.6)', () => {
        expect([italiano, spagnolo, inglese].map((file) => file.unreadNone)).toStrictEqual(['Nessuna notifica non letta', 'Ninguna notificación sin leer', 'No unread notifications']);
        expect(['it', 'es', 'en', 'pt-BR'].map((lingua) => testi(lingua).unreadNone)).toStrictEqual(['Nessuna notifica non letta', 'Ninguna notificación sin leer', 'No unread notifications', 'No unread notifications']);

        const tedesco = caricaLingue({ '../lingue/de.json': { notifications: 'Benachrichtigungen' } }).testi('de');
        expect([tedesco.notifications, tedesco.unreadNone]).toStrictEqual(['Benachrichtigungen', 'No unread notifications']);
    });

    // Sprint 24 · T2 (voce #1745): i testi di chi non ha accettato i documenti legali in vigore. Titolo, frase e pulsante
    // dell'avviso sopra la pagina, e la frase di campanella e ricerca spente: nessuno nomina un documento.
    it('i quattro testi di chi non ha accettato i documenti legali sono chiavi di zr-core nelle tre lingue, e in una lingua che zr-core non ha sono in inglese (sprint 24 · T2.4)', () => {
        const chiavi = ['acceptanceTitle', 'acceptanceText', 'acceptanceAction', 'acceptanceOff'] as const;
        const inInglese = ['There are documents to accept', 'To use Zeiras you need to accept the legal documents in force. Until then modules, notifications and search stay off.', 'Go to the documents', 'Not available until you accept the documents.'];
        expect([italiano, spagnolo, inglese].map((file: Record<string, string>) => chiavi.map((chiave) => file[chiave]))).toStrictEqual([
            ['Ci sono documenti da accettare', 'Per usare Zeiras devi accettare i documenti legali in vigore. Fino ad allora moduli, notifiche e ricerca restano spenti.', 'Vai ai documenti', 'Non disponibile finché non accetti i documenti.'],
            ['Hay documentos por aceptar', 'Para usar Zeiras tienes que aceptar los documentos legales vigentes. Hasta entonces los módulos, las notificaciones y la búsqueda quedan desactivados.', 'Ir a los documentos', 'No disponible hasta que aceptes los documentos.'],
            inInglese,
        ]);
        expect(chiavi.map((chiave) => testi('pt-BR')[chiave])).toStrictEqual(inInglese);

        // Una lingua che ha solo un testo dell'`AppShell`: i quattro di zr-core li prende dall'inglese.
        const tedesco = caricaLingue({ '../lingue/de.json': { notifications: 'Benachrichtigungen' } }).testi('de');
        expect([tedesco.notifications, ...chiavi.map((chiave) => tedesco[chiave])]).toStrictEqual(['Benachrichtigungen', ...inInglese]);
    });

    // Sprint 25 · T4 (voce #1639): il segnaposto del campo di ricerca e l'invito sotto il campo dicono le fonti della ricerca nel
    // workspace — i tipi di risorsa dei moduli attivi —, col nome da elenco che la lingua ha per ogni tipo. Senza fonti restano
    // due testi corti, che non promettono niente. I puntini del segnaposto sono il carattere «…».
    it('i due testi della ricerca senza fonti e i due che le nominano sono nelle tre lingue, e in una lingua che zr-core non ha sono in inglese (sprint 25 · T4.3)', () => {
        const chiavi = ['searchPlaceholder', 'searchHint', 'searchPlaceholderSources', 'searchHintSources'] as const;
        const inInglese = ['Search…', 'Type at least 2 characters.', 'Search {sources}…', 'Search {sources}: type at least 2 characters.'];
        expect([italiano, spagnolo, inglese].map((file: Record<string, string>) => chiavi.map((chiave) => file[chiave]))).toStrictEqual([
            ['Cerca…', 'Scrivi almeno 2 caratteri.', 'Cerca {sources}…', 'Cerca {sources}: scrivi almeno 2 caratteri.'],
            ['Busca…', 'Escribe al menos 2 caracteres.', 'Busca {sources}…', 'Busca {sources}: escribe al menos 2 caracteres.'],
            inInglese,
        ]);
        expect(chiavi.map((chiave) => testi('pt-BR')[chiave])).toStrictEqual(inInglese);
    });

    it.each<[lingua: string, file: Record<string, string>]>([
        ['it', italiano],
        ['en', inglese],
        ['es', spagnolo],
    ])('con la lingua "%s", i due testi che nominano le fonti hanno una volta sola il posto dell\'elenco, quelli senza fonti non ne nominano nessuna, e i due segnaposto finiscono coi puntini (sprint 25 · T4.3)', (_lingua, file) => {
        const volte = (testo: string | undefined, parola: string) => (testo ?? '').toLowerCase().split(parola.toLowerCase()).length - 1;
        const daElenco = tipiDelRegistro.map((tipo) => file[`searchSource.${tipo}`] ?? '?');

        expect([volte(file['searchPlaceholderSources'], '{sources}'), volte(file['searchHintSources'], '{sources}')]).toStrictEqual([1, 1]);
        expect([volte(file['searchPlaceholder'], '{'), volte(file['searchHint'], '{')]).toStrictEqual([0, 0]);
        expect(daElenco.filter((nome) => volte(`${file['searchPlaceholder']} ${file['searchHint']} ${file['searchPlaceholderSources']} ${file['searchHintSources']}`, nome) > 0)).toStrictEqual([]);
        // I puntini in fondo sono il carattere «…», non tre punti.
        for (const segnaposto of [file['searchPlaceholder'] ?? '', file['searchPlaceholderSources'] ?? '']) {
            expect([segnaposto.endsWith('…'), segnaposto.includes('.')]).toStrictEqual([true, false]);
        }
    });

    it.each<[lingua: string, file: Record<string, string>, gruppi: string[], daElenco: string[]]>([
        ['it', italiano, ['Schede', 'Board', 'Cartelle', 'Contatti', 'Aziende', 'Opportunità'], ['schede', 'board', 'cartelle', 'contatti', 'aziende', 'opportunità']],
        ['es', spagnolo, ['Tarjetas', 'Tableros', 'Carpetas', 'Contactos', 'Empresas', 'Oportunidades'], ['tarjetas', 'tableros', 'carpetas', 'contactos', 'empresas', 'oportunidades']],
        ['en', inglese, ['Cards', 'Boards', 'Folders', 'Contacts', 'Companies', 'Opportunities'], ['cards', 'boards', 'folders', 'contacts', 'companies', 'opportunities']],
    ])('con la lingua "%s", ogni tipo di risorsa del registro ha il nome del suo gruppo e il suo nome da elenco, minuscolo: un tipo che entra nel registro senza i suoi testi fa rosso questo caso (sprint 25 · T4.5)', (_lingua, file, gruppi, daElenco) => {
        expect(tipiDelRegistro).toStrictEqual(['pm.board.scheda', 'pm.board.board', 'pm.board.cartelle', 'crm.crm.persona', 'crm.crm.organizzazione', 'crm.crm.trattativa']);
        expect(tipiDelRegistro.map((tipo) => file[tipo])).toStrictEqual(gruppi);
        expect(tipiDelRegistro.map((tipo) => file[`searchSource.${tipo}`])).toStrictEqual(daElenco);
        expect(daElenco.map((nome) => nome.toLowerCase())).toStrictEqual(daElenco);
    });

    it.each<[caso: string, prodotti: Parameters<typeof fontiDellaRicerca>[0], fonti: TipoDiRisorsa[]]>([
        ['Project Management attivo e il CRM solo disponibile', { pm: 'attivo', crm: 'disponibile' }, diProjectManagement],
        // Nell'ordine del registro, non in quello dei dati.
        ['tutti e due attivi', { crm: 'attivo', pm: 'attivo' }, [...diProjectManagement, ...delCrm]],
        ['il CRM attivo e Project Management in arrivo', { pm: 'in_arrivo', crm: 'attivo' }, delCrm],
        ['attivi solo moduli senza risorse', { pm: 'disponibile', crm: 'in_arrivo', bookings: 'attivo', reports: 'attivo' }, []],
        ['nessun modulo', {}, []],
        ['uno stato che zr-core non conosce, e uno scritto `undefined`', { pm: 'sospeso', crm: undefined }, []],
    ])('con %s, le fonti della ricerca sono i tipi di risorsa dei moduli attivi nel workspace, nell\'ordine del registro (sprint 25 · T4.3)', (_caso, prodotti, fonti) => {
        expect(fontiDellaRicerca(prodotti)).toStrictEqual(fonti);
    });

    it.each<[lingua: string, fonti: TipoDiRisorsa[], segnaposto: string, invito: string]>([
        ['it', [], 'Cerca…', 'Scrivi almeno 2 caratteri.'],
        ['it', ['pm.board.scheda'], 'Cerca schede…', 'Cerca schede: scrivi almeno 2 caratteri.'],
        ['it', ['pm.board.scheda', 'pm.board.board'], 'Cerca schede, board…', 'Cerca schede e board: scrivi almeno 2 caratteri.'],
        ['it', diProjectManagement, 'Cerca schede, board, cartelle…', 'Cerca schede, board e cartelle: scrivi almeno 2 caratteri.'],
        ['it', delCrm, 'Cerca contatti, aziende, opportunità…', 'Cerca contatti, aziende e opportunità: scrivi almeno 2 caratteri.'],
        // Il segnaposto ne nomina al più tre, l'invito tutte.
        ['it', [...diProjectManagement, ...delCrm], 'Cerca schede, board, cartelle…', 'Cerca schede, board, cartelle, contatti, aziende e opportunità: scrivi almeno 2 caratteri.'],
        ['es', [], 'Busca…', 'Escribe al menos 2 caracteres.'],
        ['es', diProjectManagement, 'Busca tarjetas, tableros, carpetas…', 'Busca tarjetas, tableros y carpetas: escribe al menos 2 caracteres.'],
        ['es', [...diProjectManagement, ...delCrm], 'Busca tarjetas, tableros, carpetas…', 'Busca tarjetas, tableros, carpetas, contactos, empresas y oportunidades: escribe al menos 2 caracteres.'],
        ['en', [], 'Search…', 'Type at least 2 characters.'],
        ['en', diProjectManagement, 'Search cards, boards, folders…', 'Search cards, boards, and folders: type at least 2 characters.'],
        ['en', [...diProjectManagement, ...delCrm], 'Search cards, boards, folders…', 'Search cards, boards, folders, contacts, companies, and opportunities: type at least 2 characters.'],
        // Una variante regionale scritta come `Intl` non la accetta: la lingua dell'elenco è quella del file dei testi.
        ['es_ES', diProjectManagement, 'Busca tarjetas, tableros, carpetas…', 'Busca tarjetas, tableros y carpetas: escribe al menos 2 caracteres.'],
        // Una lingua che zr-core non ha: tutto in inglese, anche la congiunzione.
        ['pt-BR', diProjectManagement, 'Search cards, boards, folders…', 'Search cards, boards, and folders: type at least 2 characters.'],
    ])('con la lingua "%s" e le fonti %j, il segnaposto ne nomina al più tre, separate come la lingua separa un elenco, e l\'invito tutte, con la congiunzione della lingua; senza fonti i due testi corti (sprint 25 · T4.3)', (lingua, fonti, segnaposto, invito) => {
        expect(testiDellaRicerca(lingua, fonti)).toStrictEqual({ searchPlaceholder: segnaposto, searchHint: invito });
    });

    it('i due testi della ricerca non toccano quelli della lingua, che sono di tutti: dopo, `testi` dà ancora i due senza fonti e i due col posto dell\'elenco (sprint 25 · T4.3)', () => {
        testiDellaRicerca('it', diProjectManagement);

        expect([testi('it').searchPlaceholder, testi('it').searchHint, testi('it').searchPlaceholderSources, testi('it').searchHintSources])
            .toStrictEqual(['Cerca…', 'Scrivi almeno 2 caratteri.', 'Cerca {sources}…', 'Cerca {sources}: scrivi almeno 2 caratteri.']);
    });
});
