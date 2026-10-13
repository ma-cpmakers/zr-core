import { afterEach, describe, expect, it, vi } from 'vitest';
import inglese from '../lingue/en.json';
import spagnolo from '../lingue/es.json';
import italiano from '../lingue/it.json';
import frasiInglesi from '../lingue/notifiche/en.json';
import frasiSpagnole from '../lingue/notifiche/es.json';
import frasiItaliane from '../lingue/notifiche/it.json';
import { frasiARichiesta, frasiDiOgniLingua, rigaConLeFrasi } from './campanella';
import { caricaLingue, linguaDeiTesti, lingue, nomeDellaVoce, nomePulito, testi, testiDellaRicerca, type FrasiDelleNotifiche } from './lingue';
import { fontiDellaRicerca, registro, type TipoDiRisorsa } from './registro';

// Sprint 1 · T5 (voce #1255). Il ripiego sull'inglese, testo per testo, e le lingue scoperte dai file di resources/lingue. Che
// italiano, spagnolo e inglese abbiano ogni testo, che l'italiano sia quello del design system (o, dove c'è una decisione, quello
// deciso prima che il design system lo porti) e che nessuna lingua sia elencata nel codice lo prova tests/Feature/LingueTest.php.

/** I tipi di risorsa del registro, `<voce>.<tipo>`, nel suo ordine: le chiavi dei loro nomi nelle lingue. */
const tipiDelRegistro = registro.flatMap((voce) => (voce.risorse ?? []).map((risorsa) => `${voce.id}.${risorsa.tipo}`));
/** I codici che il registro dà alle chiavi di `contesto`, `<voce>.<tipo>.<chiave>.<codice>`: le chiavi dei loro testi nelle lingue, con `searchContext.` davanti. */
const codiciDelRegistro = registro.flatMap((voce) =>
    (voce.risorse ?? []).flatMap((risorsa) => Object.entries(risorsa.codici ?? {}).flatMap(([chiave, codici]) => codici.map((codice) => `${voce.id}.${risorsa.tipo}.${chiave}.${codice}`))),
);
/** Le fonti della ricerca di Project Management e quelle del CRM, nell'ordine del registro. */
const diProjectManagement: TipoDiRisorsa[] = ['pm.board.scheda', 'pm.board.board', 'pm.board.cartelle'];
const delCrm: TipoDiRisorsa[] = ['crm.crm.persona', 'crm.crm.organizzazione', 'crm.crm.trattativa'];
/** La fonte che non è di un modulo: il membro del workspace, che nel registro sta nella voce della Dashboard. */
const deiMembri: TipoDiRisorsa[] = ['home.workspace.membro'];

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
        const { 'notificationTitle.com.zeiras.board.scheda.creata': tolto, ...senzaUnTitolo } = frasiSpagnole;
        const conLoSpagnoloCambiato = frasiDiOgniLingua({
            '../lingue/notifiche/en.json': frasiInglesi,
            '../lingue/notifiche/es.json': { ...senzaUnTitolo, 'notificationTitle.com.zeiras.crm.contatto.creato': 'Nuevo contacto' },
        }, frasiInglesi);
        const f = conLoSpagnoloCambiato('es');
        const tipiCheHa = (frasi: object) => Object.keys(frasi).filter((chiave) => chiave.startsWith('notificationTitle.')).sort();

        expect(tolto).toBe('Nueva tarjeta');
        expect(f['notificationTitle.com.zeiras.board.scheda.creata']).toBe('New card');
        // Gli altri titoli restano in spagnolo, e il ripiego pure: è un testo della cornice, non una frase.
        expect(f['notificationTitle.com.zeiras.board.scheda.modificata']).toBe('Tarjeta modificada');
        expect(testi('es').notificationTitle).toBe('Novedades en el workspace');
        // I tipi che zr-core conosce li dicono le chiavi dell'inglese: 42, in ogni lingua, anche con un file che ne ha uno in più.
        expect(tipiCheHa(frasiInglesi)).toHaveLength(42);
        expect(tipiCheHa(f)).toStrictEqual(tipiCheHa(frasiInglesi));
        expect(tipiCheHa(conLoSpagnoloCambiato('it'))).toStrictEqual(tipiCheHa(frasiInglesi));
        expect(tipiCheHa(conLoSpagnoloCambiato('zz'))).toStrictEqual(tipiCheHa(frasiInglesi));
        // Composte una volta per file, e congelate: sono di tutti quelli che le chiedono.
        expect(conLoSpagnoloCambiato('es-ES')).toBe(f);
        expect(Object.isFrozen(f)).toBe(true);
        expect(Object.isFrozen(frasiInglesi)).toBe(false);
    });

    // Sprint 16 · T5 (voce #1479): il titolo di un tipo di notifica per chi lo mostra fuori dalla cornice, dall'ingresso del
    // pacchetto. Che sia lo stesso testo del pannello delle notifiche lo prova cornice.test.tsx.
    /** I tipi che zr-core conosce: le chiavi dell'inglese, senza `notificationTitle.` davanti. */
    const tipiConosciuti = Object.keys(frasiInglesi).flatMap((chiave) => (chiave.startsWith('notificationTitle.') ? [chiave.slice('notificationTitle.'.length)] : []));
    /** Il titolo di ripiego, per lingua. */
    const diRipiego = { it: 'Novità nel workspace', es: 'Novedades en el workspace', en: 'News in the workspace' };

    it.each<[lingua: 'it' | 'es' | 'en', file: Record<string, string>, dellaSchedaCreata: string]>([
        ['it', frasiItaliane, 'Nuova scheda'],
        ['es', frasiSpagnole, 'Nueva tarjeta'],
        ['en', frasiInglesi, 'New card'],
    ])('titoloDellaNotifica, dall\'ingresso del pacchetto, con la lingua "%s" dà per ognuno dei 42 tipi che zr-core conosce il titolo che ha nel file di quella lingua, mai quello di ripiego (sprint 16 · T5.1; sprint 21 · T2.1, T5.3; sprint 22 · T5.4; sprint 24 · T3.1; sprint 26 · T6.1)', async (lingua, file, dellaSchedaCreata) => {
        const { titoloDellaNotifica } = await import('./frasi');
        const titoli = tipiConosciuti.map((tipo) => titoloDellaNotifica(tipo, lingua));

        expect(tipiConosciuti).toHaveLength(42);
        expect(titoli).toStrictEqual(tipiConosciuti.map((tipo) => file[`notificationTitle.${tipo}`]));
        expect(titoloDellaNotifica('com.zeiras.board.scheda.creata', lingua)).toBe(dellaSchedaCreata);
        // Nessun tipo conosciuto esce col titolo di ripiego, e i 42 titoli sono 42 testi diversi.
        expect(titoli).not.toContain(diRipiego[lingua]);
        expect(new Set(titoli).size).toBe(42);
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
            const { titoloDellaNotifica } = await import('./frasi');

            expect(titoloDellaNotifica(tipo, lingua)).toBe(titolo);
        },
    );

    it.each(['it', 'es', 'en'] as const)('con la lingua "%s", un tipo del CRM che zr-core non conosce ancora ha il titolo di ripiego, non quello del tipo a cui somiglia (sprint 21 · T2.2)', async (lingua) => {
        const { titoloDellaNotifica } = await import('./frasi');
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
            const { titoloDellaNotifica } = await import('./frasi');

            expect(titoloDellaNotifica(tipo, lingua)).toBe(titolo);
        },
    );

    it.each(['it', 'en', 'es'] as const)('con la lingua "%s", nessun titolo chiama «organizzazione» un\'azienda del CRM, e un tipo delle viste o delle aziende che il contratto non ha resta col titolo di ripiego (sprint 21 · T5.1, T5.3)', async (lingua) => {
        const { titoloDellaNotifica } = await import('./frasi');
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
            const { titoloDellaNotifica } = await import('./frasi');

            expect(titoloDellaNotifica(tipo, lingua)).toBe(titolo);
        },
    );

    it.each(['it', 'en', 'es'] as const)('con la lingua "%s", nessuno dei nove titoli nuovi del CRM chiama un\'opportunità con la parola del contratto, e nessuno è il titolo di ripiego (sprint 22 · T5.1)', async (lingua) => {
        const { titoloDellaNotifica } = await import('./frasi');
        const titoli = titoliDiOpportunitaAttivitaEAssegnate.map(([tipo]) => titoloDellaNotifica(tipo, lingua));

        expect(titoli).toHaveLength(9);
        // «trattativa», «deal», «negociación»: le parole del contratto, non quelle del CRM.
        expect(titoli.join(' · ')).not.toMatch(/trattativ|\bdeals?\b|negociaci/i);
        expect(titoli).not.toContain(diRipiego[lingua]);
    });

    it.each(['it', 'en', 'es'] as const)('con la lingua "%s", i quattro «assegnata» hanno il titolo col tipo senza `com.zeiras.` davanti: lo stesso nome col prefisso, e un evento senza il suo, restano col titolo di ripiego (sprint 22 · T5.2)', async (lingua) => {
        const { titoloDellaNotifica } = await import('./frasi');
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
        const { titoloDellaNotifica } = await import('./frasi');
        const cheNonConosce = ['com.zeiras.board.scheda.assegnata', 'board.scheda.creata', 'board.scheda', 'board.scheda.assegnata.poi', 'BOARD.SCHEDA.ASSEGNATA'];

        expect(titoloDellaNotifica('board.scheda.assegnata', lingua)).toBe(titolo);
        expect(titolo).not.toBe(diRipiego[lingua]);
        expect(cheNonConosce.map((tipo) => titoloDellaNotifica(tipo, lingua))).toStrictEqual(cheNonConosce.map(() => diRipiego[lingua]));
    });

    // Sprint 26 · T6 (voce #1773): la notifica che Project Management manda a chi viene menzionato in un commento, con le parole
    // di zr-board (nota 10846 del #95). Non è un evento nemmeno lei: il tipo arriva senza `com.zeiras.` davanti.
    it.each<[lingua: 'it' | 'en' | 'es', titolo: string]>([
        ['it', 'Ti hanno menzionato in un commento'],
        ['en', 'You were mentioned in a comment'],
        ['es', 'Te han mencionado en un comentario'],
    ])('con la lingua "%s", titoloDellaNotifica dà a `board.commento.menzione` il titolo «%s»; lo stesso nome col prefisso, un pezzo del tipo, il tipo con un pezzo in più e un altro tipo di un commento restano col titolo di ripiego (sprint 26 · T6.1)', async (lingua, titolo) => {
        const { titoloDellaNotifica } = await import('./frasi');
        const cheNonConosce = ['com.zeiras.board.commento.menzione', 'board.commento', 'board.commento.menzione.poi', 'board.commento.creato', 'BOARD.COMMENTO.MENZIONE'];

        expect(titoloDellaNotifica('board.commento.menzione', lingua)).toBe(titolo);
        expect(titolo).not.toBe(diRipiego[lingua]);
        expect(cheNonConosce.map((tipo) => titoloDellaNotifica(tipo, lingua))).toStrictEqual(cheNonConosce.map(() => diRipiego[lingua]));
    });

    it.each(['it', 'es', 'en'] as const)('con la lingua "%s", titoloDellaNotifica dà il titolo di ripiego a un tipo che zr-core non conosce, vuoto, mancante o che non è un testo: mai il codice del tipo, mai un testo vuoto (sprint 16 · T5.2)', async (lingua) => {
        const { titoloDellaNotifica } = await import('./frasi');
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
        const { titoloDellaNotifica } = await import('./frasi');
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
        const { risorsaDellaNotifica } = await import('./frasi');
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
        const { risorsaDellaNotifica } = await import('./frasi');
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

    // Sprint 28 · T4 (voce #1828): «Salta al contenuto», il primo elemento della cornice da tastiera. L'`AppShell` non ha un
    // testo per lui: è una chiave di zr-core.
    it('il testo di «Salta al contenuto» è una chiave di zr-core nelle tre lingue, e in una lingua che zr-core non ha è in inglese (sprint 28 · T4.1)', () => {
        expect([italiano, spagnolo, inglese].map((file: Record<string, string>) => file.skipToContent)).toStrictEqual(['Salta al contenuto', 'Saltar al contenido', 'Skip to content']);
        expect([testi('it').skipToContent, testi('es').skipToContent, testi('pt-BR').skipToContent]).toStrictEqual(['Salta al contenuto', 'Saltar al contenido', 'Skip to content']);

        // Una lingua che ha solo un testo dell'`AppShell`: quello di zr-core lo prende dall'inglese.
        const tedesco = caricaLingue({ '../lingue/de.json': { notifications: 'Benachrichtigungen' } }).testi('de');
        expect([tedesco.notifications, tedesco.skipToContent]).toStrictEqual(['Benachrichtigungen', 'Skip to content']);
    });

    // Sprint 25 · T4 (voce #1639): il segnaposto del campo di ricerca e l'invito sotto il campo dicono le fonti della ricerca nel
    // workspace — i tipi di risorsa dei moduli attivi —, col nome da elenco che la lingua ha per ogni tipo. Senza fonti restano
    // due testi corti, che non promettono niente. I puntini del segnaposto sono il carattere «…».
    // Sprint 27 · T7 (voce #1810): il segnaposto è uno solo, uguale in ogni workspace e in ogni modulo, e non nomina più le
    // fonti: le dice l'invito. La chiave resta (`searchPlaceholderSources`: il segnaposto di una ricerca che ha delle fonti),
    // senza il posto dell'elenco; quello corto resta a chi non ha fonti, cioè a chi non ha accettato i documenti legali.
    it('i due testi della ricerca senza fonti, il segnaposto unico e l\'invito che nomina le fonti sono nelle tre lingue, e in una lingua che zr-core non ha sono in inglese (sprint 25 · T4.3; sprint 27 · T7.1)', () => {
        const chiavi = ['searchPlaceholder', 'searchHint', 'searchPlaceholderSources', 'searchHintSources'] as const;
        const inInglese = ['Search…', 'Type at least 2 characters.', 'Search the workspace…', 'Search {sources}: type at least 2 characters.'];
        expect([italiano, spagnolo, inglese].map((file: Record<string, string>) => chiavi.map((chiave) => file[chiave]))).toStrictEqual([
            ['Cerca…', 'Scrivi almeno 2 caratteri.', 'Cerca nel workspace…', 'Cerca {sources}: scrivi almeno 2 caratteri.'],
            ['Busca…', 'Escribe al menos 2 caracteres.', 'Busca en el workspace…', 'Busca {sources}: escribe al menos 2 caracteres.'],
            inInglese,
        ]);
        expect(chiavi.map((chiave) => testi('pt-BR')[chiave])).toStrictEqual(inInglese);
    });

    it.each<[lingua: string, file: Record<string, string>]>([
        ['it', italiano],
        ['en', inglese],
        ['es', spagnolo],
    ])('con la lingua "%s", l\'invito che nomina le fonti ha una volta sola il posto dell\'elenco, il segnaposto unico e i due testi senza fonti non lo hanno, nessuno dei quattro nomina una fonte, e i due segnaposto finiscono coi puntini (sprint 25 · T4.3; sprint 27 · T7.5)', (_lingua, file) => {
        const volte = (testo: string | undefined, parola: string) => (testo ?? '').toLowerCase().split(parola.toLowerCase()).length - 1;
        const daElenco = tipiDelRegistro.map((tipo) => file[`searchSource.${tipo}`] ?? '?');

        expect([volte(file['searchPlaceholderSources'], '{sources}'), volte(file['searchHintSources'], '{sources}')]).toStrictEqual([0, 1]);
        expect([volte(file['searchPlaceholder'], '{'), volte(file['searchHint'], '{'), volte(file['searchPlaceholderSources'], '{')]).toStrictEqual([0, 0, 0]);
        expect(daElenco.filter((nome) => volte(`${file['searchPlaceholder']} ${file['searchHint']} ${file['searchPlaceholderSources']} ${file['searchHintSources']}`, nome) > 0)).toStrictEqual([]);
        // I puntini in fondo sono il carattere «…», non tre punti.
        for (const segnaposto of [file['searchPlaceholder'] ?? '', file['searchPlaceholderSources'] ?? '']) {
            expect([segnaposto.endsWith('…'), segnaposto.includes('.')]).toStrictEqual([true, false]);
        }
    });

    it.each<[lingua: string, file: Record<string, string>, gruppi: string[], daElenco: string[]]>([
        // Dallo sprint 27 il primo è il membro del workspace, che nel registro sta nella voce della Dashboard (T1.3).
        ['it', italiano, ['Membri', 'Schede', 'Board', 'Cartelle', 'Contatti', 'Aziende', 'Opportunità'], ['membri', 'schede', 'board', 'cartelle', 'contatti', 'aziende', 'opportunità']],
        ['es', spagnolo, ['Miembros', 'Tarjetas', 'Tableros', 'Carpetas', 'Contactos', 'Empresas', 'Oportunidades'], ['miembros', 'tarjetas', 'tableros', 'carpetas', 'contactos', 'empresas', 'oportunidades']],
        ['en', inglese, ['Members', 'Cards', 'Boards', 'Folders', 'Contacts', 'Companies', 'Opportunities'], ['members', 'cards', 'boards', 'folders', 'contacts', 'companies', 'opportunities']],
    ])('con la lingua "%s", ogni tipo di risorsa del registro ha il nome del suo gruppo e il suo nome da elenco, minuscolo: un tipo che entra nel registro senza i suoi testi fa rosso questo caso (sprint 25 · T4.5)', (_lingua, file, gruppi, daElenco) => {
        expect(tipiDelRegistro).toStrictEqual(['home.workspace.membro', 'pm.board.scheda', 'pm.board.board', 'pm.board.cartelle', 'crm.crm.persona', 'crm.crm.organizzazione', 'crm.crm.trattativa']);
        expect(tipiDelRegistro.map((tipo) => file[tipo])).toStrictEqual(gruppi);
        expect(tipiDelRegistro.map((tipo) => file[`searchSource.${tipo}`])).toStrictEqual(daElenco);
        expect(daElenco.map((nome) => nome.toLowerCase())).toStrictEqual(daElenco);
    });

    // Sprint 27 · T1 (voce #1787): la ricerca trova i membri del workspace. Il membro non è di un modulo: la sua pagina è
    // Impostazioni › Membri di app, e nel registro sta nella voce della Dashboard. Il ruolo arriva dal backoffice come codice, mai
    // come testo da mostrare: quali codici, lo dice il registro (`codici`), e il testo di ognuno è delle lingue.
    it('nel registro il membro del workspace è la sola risorsa della voce della Dashboard: icona `user`, la pagina dei membri di app, e per seconda riga il solo ruolo, coi suoi tre codici; mai l\'email (sprint 27 · T1.1)', () => {
        expect(registro.filter((voce) => voce.risorse !== undefined).map((voce) => voce.id)).toStrictEqual(['home', 'pm', 'crm']);
        expect(registro.find((voce) => voce.id === 'home')?.risorse).toStrictEqual([
            { tipo: 'workspace.membro', icona: 'user', percorso: '/impostazioni/membri/{id}', contenitore: false, contesto: ['ruolo'], codici: { ruolo: ['proprietario', 'amministratore', 'membro'] } },
        ]);
        // Il ruolo di un membro è un codice: quello di un contatto del CRM è un testo libero, e resta senza codici. Dallo sprint 28
        // ha dei codici anche l'opportunità, per l'esito (T1.4).
        expect(registro.flatMap((voce) => (voce.risorse ?? []).filter((risorsa) => risorsa.codici !== undefined).map((risorsa) => risorsa.tipo))).toStrictEqual(['workspace.membro', 'crm.trattativa']);
        expect(registro.flatMap((voce) => (voce.risorse ?? []).filter((risorsa) => risorsa.tipo === 'crm.persona').map((risorsa) => risorsa.contesto))).toStrictEqual([['organizzazione', 'ruolo']]);
    });

    // Sprint 28 · T1 (voce #1826): un'opportunità chiusa dice l'esito. Il backoffice dà `esito` come codice — `aperta`, `vinta`,
    // `persa` —, e il registro ne dà alla chiave due soli: `aperta` non è un codice, non ha un testo nelle lingue, ed è così che
    // di un'opportunità aperta non si mostra.
    it('nel registro l\'opportunità ha per seconda riga pipeline, fase ed esito, e dell\'esito i soli due codici di un\'opportunità chiusa: `aperta` non è fra quelli (sprint 28 · T1.4)', () => {
        expect(registro.find((voce) => voce.id === 'crm')?.risorse?.find((risorsa) => risorsa.tipo === 'crm.trattativa')).toStrictEqual(
            { tipo: 'crm.trattativa', icona: 'target', percorso: '/opportunita/{id}', contenitore: false, contesto: ['pipeline', 'fase', 'esito'], codici: { esito: ['vinta', 'persa'] } },
        );
        expect(codiciDelRegistro.filter((codice) => codice.endsWith('.aperta'))).toStrictEqual([]);
        expect([italiano, spagnolo, inglese].flatMap((file) => Object.keys(file).filter((chiave) => chiave.startsWith('searchContext.') && chiave.endsWith('.aperta')))).toStrictEqual([]);
    });

    it.each<[lingua: string, file: Record<string, string>, ruoli: string[]]>([
        ['it', italiano, ['Proprietario', 'Amministratore', 'Membro', 'Vinta', 'Persa']],
        ['es', spagnolo, ['Propietario', 'Administrador', 'Miembro', 'Ganada', 'Perdida']],
        ['en', inglese, ['Owner', 'Admin', 'Member', 'Won', 'Lost']],
    ])('con la lingua "%s", ogni codice che il registro dà a una chiave di `contesto` ha il suo testo, quello della pagina dei membri, e la lingua non ha il testo di un codice che il registro non ha (sprint 27 · T1.3)', (_lingua, file, ruoli) => {
        expect(codiciDelRegistro).toStrictEqual([
            'home.workspace.membro.ruolo.proprietario', 'home.workspace.membro.ruolo.amministratore', 'home.workspace.membro.ruolo.membro',
            'crm.crm.trattativa.esito.vinta', 'crm.crm.trattativa.esito.persa',
        ]);
        expect(codiciDelRegistro.map((codice) => file[`searchContext.${codice}`])).toStrictEqual(ruoli);
        expect(Object.keys(file).filter((chiave) => chiave.startsWith('searchContext.'))).toStrictEqual(codiciDelRegistro.map((codice) => `searchContext.${codice}`));
    });

    // Sprint 27 · T2 (voce #1787): il membro del workspace non è di un modulo, e il backoffice lo cerca in ogni workspace: è una
    // fonte anche dove nessun modulo è attivo. Nel registro sta nella prima voce, quella della Dashboard, ma fra le fonti viene
    // per ultimo: l'invito nomina prima quelle dei moduli.
    it.each<[caso: string, prodotti: Parameters<typeof fontiDellaRicerca>[0], fonti: TipoDiRisorsa[]]>([
        ['Project Management attivo e il CRM solo disponibile', { pm: 'attivo', crm: 'disponibile' }, [...diProjectManagement, ...deiMembri]],
        // Nell'ordine del registro, non in quello dei dati.
        ['tutti e due attivi', { crm: 'attivo', pm: 'attivo' }, [...diProjectManagement, ...delCrm, ...deiMembri]],
        ['il CRM attivo e Project Management in arrivo', { pm: 'in_arrivo', crm: 'attivo' }, [...delCrm, ...deiMembri]],
        ['attivi solo moduli senza risorse', { pm: 'disponibile', crm: 'in_arrivo', bookings: 'attivo', reports: 'attivo' }, deiMembri],
        ['nessun modulo', {}, deiMembri],
        ['uno stato che zr-core non conosce, e uno scritto `undefined`', { pm: 'sospeso', crm: undefined }, deiMembri],
    ])('con %s, le fonti della ricerca sono i tipi di risorsa dei moduli attivi nel workspace, nell\'ordine del registro, e per ultimo il membro del workspace, che c\'è in ogni workspace (sprint 25 · T4.3; sprint 27 · T2.4)', (_caso, prodotti, fonti) => {
        expect(fontiDellaRicerca(prodotti)).toStrictEqual(fonti);
    });

    it.each<[lingua: string, prodotti: Parameters<typeof fontiDellaRicerca>[0], segnaposto: string, invito: string]>([
        ['it', { pm: 'attivo', crm: 'attivo' }, 'Cerca nel workspace…', 'Cerca schede, board, cartelle, contatti, aziende, opportunità e membri: scrivi almeno 2 caratteri.'],
        ['it', { pm: 'attivo', crm: 'disponibile' }, 'Cerca nel workspace…', 'Cerca schede, board, cartelle e membri: scrivi almeno 2 caratteri.'],
        ['it', { pm: 'disponibile', crm: 'in_arrivo' }, 'Cerca nel workspace…', 'Cerca membri: scrivi almeno 2 caratteri.'],
        ['es', { pm: 'attivo', crm: 'attivo' }, 'Busca en el workspace…', 'Busca tarjetas, tableros, carpetas, contactos, empresas, oportunidades y miembros: escribe al menos 2 caracteres.'],
        ['es', {}, 'Busca en el workspace…', 'Busca miembros: escribe al menos 2 caracteres.'],
        ['en', { pm: 'attivo', crm: 'attivo' }, 'Search the workspace…', 'Search cards, boards, folders, contacts, companies, opportunities, and members: type at least 2 characters.'],
        ['en', {}, 'Search the workspace…', 'Search members: type at least 2 characters.'],
    ])('con la lingua "%s" e i moduli %j, l\'invito nomina i membri dopo le fonti dei moduli attivi, per ultimi, e senza moduli attivi sono la sola fonte, mai l\'invito corto; il segnaposto è lo stesso con qualunque modulo attivo e non nomina nessuna fonte (sprint 27 · T2.4, T7.1, T7.3)', (lingua, prodotti, segnaposto, invito) => {
        expect(testiDellaRicerca(lingua, fontiDellaRicerca(prodotti))).toStrictEqual({ searchPlaceholder: segnaposto, searchHint: invito });
    });

    it.each<[lingua: string, fonti: TipoDiRisorsa[], segnaposto: string, invito: string]>([
        ['it', [], 'Cerca…', 'Scrivi almeno 2 caratteri.'],
        ['it', ['pm.board.scheda'], 'Cerca nel workspace…', 'Cerca schede: scrivi almeno 2 caratteri.'],
        ['it', ['pm.board.scheda', 'pm.board.board'], 'Cerca nel workspace…', 'Cerca schede e board: scrivi almeno 2 caratteri.'],
        ['it', diProjectManagement, 'Cerca nel workspace…', 'Cerca schede, board e cartelle: scrivi almeno 2 caratteri.'],
        ['it', delCrm, 'Cerca nel workspace…', 'Cerca contatti, aziende e opportunità: scrivi almeno 2 caratteri.'],
        // L'invito le nomina tutte, quante che siano.
        ['it', [...diProjectManagement, ...delCrm], 'Cerca nel workspace…', 'Cerca schede, board, cartelle, contatti, aziende e opportunità: scrivi almeno 2 caratteri.'],
        ['es', [], 'Busca…', 'Escribe al menos 2 caracteres.'],
        ['es', diProjectManagement, 'Busca en el workspace…', 'Busca tarjetas, tableros y carpetas: escribe al menos 2 caracteres.'],
        ['es', [...diProjectManagement, ...delCrm], 'Busca en el workspace…', 'Busca tarjetas, tableros, carpetas, contactos, empresas y oportunidades: escribe al menos 2 caracteres.'],
        ['en', [], 'Search…', 'Type at least 2 characters.'],
        ['en', diProjectManagement, 'Search the workspace…', 'Search cards, boards, and folders: type at least 2 characters.'],
        ['en', [...diProjectManagement, ...delCrm], 'Search the workspace…', 'Search cards, boards, folders, contacts, companies, and opportunities: type at least 2 characters.'],
        // Una variante regionale scritta come `Intl` non la accetta: la lingua dell'elenco è quella del file dei testi.
        ['es_ES', diProjectManagement, 'Busca en el workspace…', 'Busca tarjetas, tableros y carpetas: escribe al menos 2 caracteres.'],
        // Una lingua che zr-core non ha: tutto in inglese, anche la congiunzione.
        ['pt-BR', diProjectManagement, 'Search the workspace…', 'Search cards, boards, and folders: type at least 2 characters.'],
    ])('con la lingua "%s" e le fonti %j, l\'invito le nomina tutte, con la congiunzione della lingua, e il segnaposto è quello unico, che non ne nomina nessuna; senza fonti i due testi corti (sprint 25 · T4.3; sprint 27 · T7.1, T7.2)', (lingua, fonti, segnaposto, invito) => {
        expect(testiDellaRicerca(lingua, fonti)).toStrictEqual({ searchPlaceholder: segnaposto, searchHint: invito });
    });

    it('i due testi della ricerca non toccano quelli della lingua, che sono di tutti: dopo, `testi` dà ancora i due senza fonti, il segnaposto unico e l\'invito col posto dell\'elenco (sprint 25 · T4.3)', () => {
        testiDellaRicerca('it', diProjectManagement);

        expect([testi('it').searchPlaceholder, testi('it').searchHint, testi('it').searchPlaceholderSources, testi('it').searchHintSources])
            .toStrictEqual(['Cerca…', 'Scrivi almeno 2 caratteri.', 'Cerca nel workspace…', 'Cerca {sources}: scrivi almeno 2 caratteri.']);
    });

    // Sprint 26 · T5 (voce #1767; lettura della PR #56, R9). L'elenco delle fonti lo scrive `Intl.ListFormat`, e un browser può non
    // averlo anche quando ha il resto di `Intl`: lì l'invito è quello della lingua che non nomina fonti, e niente lancia.
    // Sprint 27 · T7 (voce #1810): il segnaposto non passa più dall'elenco: dove `Intl.ListFormat` manca è quello unico, come
    // dove c'è, e non quello corto, che resta a chi non ha fonti.
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it.each<[lingua: string, corto: string, invito: string, unico: string]>([
        ['it', 'Cerca…', 'Scrivi almeno 2 caratteri.', 'Cerca nel workspace…'],
        ['es', 'Busca…', 'Escribe al menos 2 caracteres.', 'Busca en el workspace…'],
        ['en', 'Search…', 'Type at least 2 characters.', 'Search the workspace…'],
        // Una lingua che zr-core non ha: in inglese, come dove l'elenco c'è.
        ['pt-BR', 'Search…', 'Type at least 2 characters.', 'Search the workspace…'],
    ])('dove `Intl.ListFormat` manca, con la lingua "%s" il segnaposto è quello unico e l\'invito quello senza fonti, quante che siano le fonti, e niente lancia; senza fonti i due testi corti; dove c\'è, l\'invito le nomina (sprint 26 · T5.1; sprint 27 · T7.2)', (lingua, corto, invito, unico) => {
        const conLElenco = testiDellaRicerca(lingua, diProjectManagement);
        expect(conLElenco.searchPlaceholder).toBe(unico);
        expect(conLElenco.searchHint).not.toBe(invito);

        // Il resto di `Intl` c'è: manca solo l'elenco, come in un browser che non lo ha ancora.
        vi.stubGlobal('Intl', Object.create(Intl, { ListFormat: { value: undefined } }));
        expect(Intl.ListFormat).toBeUndefined();
        expect(typeof Intl.DateTimeFormat).toBe('function');
        expect(testiDellaRicerca(lingua, diProjectManagement)).toStrictEqual({ searchPlaceholder: unico, searchHint: invito });
        expect(testiDellaRicerca(lingua, [...diProjectManagement, ...delCrm])).toStrictEqual({ searchPlaceholder: unico, searchHint: invito });
        expect(testiDellaRicerca(lingua, [])).toStrictEqual({ searchPlaceholder: corto, searchHint: invito });

        vi.unstubAllGlobals();
        expect(testiDellaRicerca(lingua, diProjectManagement)).toStrictEqual(conLElenco);
    });
});

// Sprint 29 · T2 (voce #1865). Una notifica di Project Management dice chi ha fatto che cosa: il titolo è una frase delle lingue
// col nome di chi e, quando c'è, quello della cosa; senza chi resta il titolo di prima, col nome della cosa sotto. La dà una
// funzione sola, `rigaDellaNotifica`, al pannello della cornice e a chi mostra le notifiche in una pagina sua.
describe('rigaDellaNotifica', () => {
    type Lingua = 'it' | 'en' | 'es';
    /** Per ogni tipo con le frasi, e per lingua: la frase con «Giulia Bianchi» e «Lancio corso» (un tipo `….eliminata` non la ha), e quella con la sola Giulia. */
    const frasi: [tipo: string, perLingua: Record<Lingua, [conCosa: string | null, soloChi: string]>][] = [
        ['com.zeiras.board.cartella.creata', { it: ['Giulia Bianchi ha creato la cartella «Lancio corso»', 'Giulia Bianchi ha creato una cartella'], en: ['Giulia Bianchi created the folder “Lancio corso”', 'Giulia Bianchi created a folder'], es: ['Giulia Bianchi ha creado la carpeta «Lancio corso»', 'Giulia Bianchi ha creado una carpeta'] }],
        ['com.zeiras.board.cartella.modificata', { it: ['Giulia Bianchi ha modificato la cartella «Lancio corso»', 'Giulia Bianchi ha modificato una cartella'], en: ['Giulia Bianchi changed the folder “Lancio corso”', 'Giulia Bianchi changed a folder'], es: ['Giulia Bianchi ha modificado la carpeta «Lancio corso»', 'Giulia Bianchi ha modificado una carpeta'] }],
        ['com.zeiras.board.cartella.eliminata', { it: [null, 'Giulia Bianchi ha eliminato una cartella'], en: [null, 'Giulia Bianchi deleted a folder'], es: [null, 'Giulia Bianchi ha eliminado una carpeta'] }],
        ['com.zeiras.board.board.creata', { it: ['Giulia Bianchi ha creato la board «Lancio corso»', 'Giulia Bianchi ha creato una board'], en: ['Giulia Bianchi created the board “Lancio corso”', 'Giulia Bianchi created a board'], es: ['Giulia Bianchi ha creado el tablero «Lancio corso»', 'Giulia Bianchi ha creado un tablero'] }],
        ['com.zeiras.board.board.modificata', { it: ['Giulia Bianchi ha modificato la board «Lancio corso»', 'Giulia Bianchi ha modificato una board'], en: ['Giulia Bianchi changed the board “Lancio corso”', 'Giulia Bianchi changed a board'], es: ['Giulia Bianchi ha modificado el tablero «Lancio corso»', 'Giulia Bianchi ha modificado un tablero'] }],
        ['com.zeiras.board.lista.creata', { it: ['Giulia Bianchi ha creato la lista «Lancio corso»', 'Giulia Bianchi ha creato una lista'], en: ['Giulia Bianchi created the list “Lancio corso”', 'Giulia Bianchi created a list'], es: ['Giulia Bianchi ha creado la lista «Lancio corso»', 'Giulia Bianchi ha creado una lista'] }],
        ['com.zeiras.board.lista.modificata', { it: ['Giulia Bianchi ha modificato la lista «Lancio corso»', 'Giulia Bianchi ha modificato una lista'], en: ['Giulia Bianchi changed the list “Lancio corso”', 'Giulia Bianchi changed a list'], es: ['Giulia Bianchi ha modificado la lista «Lancio corso»', 'Giulia Bianchi ha modificado una lista'] }],
        ['com.zeiras.board.scheda.creata', { it: ['Giulia Bianchi ha creato la scheda «Lancio corso»', 'Giulia Bianchi ha creato una scheda'], en: ['Giulia Bianchi created the card “Lancio corso”', 'Giulia Bianchi created a card'], es: ['Giulia Bianchi ha creado la tarjeta «Lancio corso»', 'Giulia Bianchi ha creado una tarjeta'] }],
        ['com.zeiras.board.scheda.modificata', { it: ['Giulia Bianchi ha modificato la scheda «Lancio corso»', 'Giulia Bianchi ha modificato una scheda'], en: ['Giulia Bianchi changed the card “Lancio corso”', 'Giulia Bianchi changed a card'], es: ['Giulia Bianchi ha modificado la tarjeta «Lancio corso»', 'Giulia Bianchi ha modificado una tarjeta'] }],
        ['com.zeiras.board.scheda.eliminata', { it: [null, 'Giulia Bianchi ha eliminato una scheda'], en: [null, 'Giulia Bianchi deleted a card'], es: [null, 'Giulia Bianchi ha eliminado una tarjeta'] }],
        ['com.zeiras.board.etichetta.creata', { it: ['Giulia Bianchi ha creato l\'etichetta «Lancio corso»', 'Giulia Bianchi ha creato un\'etichetta'], en: ['Giulia Bianchi created the label “Lancio corso”', 'Giulia Bianchi created a label'], es: ['Giulia Bianchi ha creado la etiqueta «Lancio corso»', 'Giulia Bianchi ha creado una etiqueta'] }],
        ['com.zeiras.board.etichetta.modificata', { it: ['Giulia Bianchi ha modificato l\'etichetta «Lancio corso»', 'Giulia Bianchi ha modificato un\'etichetta'], en: ['Giulia Bianchi changed the label “Lancio corso”', 'Giulia Bianchi changed a label'], es: ['Giulia Bianchi ha modificado la etiqueta «Lancio corso»', 'Giulia Bianchi ha modificado una etiqueta'] }],
        ['com.zeiras.board.etichetta.eliminata', { it: [null, 'Giulia Bianchi ha eliminato un\'etichetta'], en: [null, 'Giulia Bianchi deleted a label'], es: [null, 'Giulia Bianchi ha eliminado una etiqueta'] }],
        ['com.zeiras.board.vista.creata', { it: ['Giulia Bianchi ha creato la vista «Lancio corso»', 'Giulia Bianchi ha creato una vista'], en: ['Giulia Bianchi created the view “Lancio corso”', 'Giulia Bianchi created a view'], es: ['Giulia Bianchi ha creado la vista «Lancio corso»', 'Giulia Bianchi ha creado una vista'] }],
        ['com.zeiras.board.vista.modificata', { it: ['Giulia Bianchi ha modificato la vista «Lancio corso»', 'Giulia Bianchi ha modificato una vista'], en: ['Giulia Bianchi changed the view “Lancio corso”', 'Giulia Bianchi changed a view'], es: ['Giulia Bianchi ha modificado la vista «Lancio corso»', 'Giulia Bianchi ha modificado una vista'] }],
        ['com.zeiras.board.vista.eliminata', { it: [null, 'Giulia Bianchi ha eliminato una vista'], en: [null, 'Giulia Bianchi deleted a view'], es: [null, 'Giulia Bianchi ha eliminado una vista'] }],
        ['board.scheda.assegnata', { it: ['Giulia Bianchi ti ha assegnato la scheda «Lancio corso»', 'Giulia Bianchi ti ha assegnato una scheda'], en: ['Giulia Bianchi assigned you the card “Lancio corso”', 'Giulia Bianchi assigned you a card'], es: ['Giulia Bianchi te ha asignado la tarjeta «Lancio corso»', 'Giulia Bianchi te ha asignado una tarjeta'] }],
        ['board.commento.menzione', { it: ['Giulia Bianchi ti ha menzionato in «Lancio corso»', 'Giulia Bianchi ti ha menzionato in un commento'], en: ['Giulia Bianchi mentioned you in “Lancio corso”', 'Giulia Bianchi mentioned you in a comment'], es: ['Giulia Bianchi te ha mencionado en «Lancio corso»', 'Giulia Bianchi te ha mencionado en un comentario'] }],
        // Sprint 31 · T1 (voce #1866). I 18 tipi del CRM, con le parole di zr-crm: la sola frase con chi, tranne le due della pipeline
        // e, dallo sprint 32 (T4, voce #1914), le sei di aziende, opportunità e attività create o modificate.
        ['com.zeiras.crm.persona.creata', { it: [null, 'Giulia Bianchi ha creato un contatto'], en: [null, 'Giulia Bianchi created a contact'], es: [null, 'Giulia Bianchi ha creado un contacto'] }],
        ['com.zeiras.crm.persona.modificata', { it: [null, 'Giulia Bianchi ha modificato un contatto'], en: [null, 'Giulia Bianchi edited a contact'], es: [null, 'Giulia Bianchi ha modificado un contacto'] }],
        ['com.zeiras.crm.organizzazione.creata', { it: ['Giulia Bianchi ha creato l\'azienda «Lancio corso»', 'Giulia Bianchi ha creato un\'azienda'], en: ['Giulia Bianchi created the company “Lancio corso”', 'Giulia Bianchi created a company'], es: ['Giulia Bianchi ha creado la empresa «Lancio corso»', 'Giulia Bianchi ha creado una empresa'] }],
        ['com.zeiras.crm.organizzazione.modificata', { it: ['Giulia Bianchi ha modificato l\'azienda «Lancio corso»', 'Giulia Bianchi ha modificato un\'azienda'], en: ['Giulia Bianchi edited the company “Lancio corso”', 'Giulia Bianchi edited a company'], es: ['Giulia Bianchi ha modificado la empresa «Lancio corso»', 'Giulia Bianchi ha modificado una empresa'] }],
        ['com.zeiras.crm.trattativa.creata', { it: ['Giulia Bianchi ha creato l\'opportunità «Lancio corso»', 'Giulia Bianchi ha creato un\'opportunità'], en: ['Giulia Bianchi created the opportunity “Lancio corso”', 'Giulia Bianchi created an opportunity'], es: ['Giulia Bianchi ha creado la oportunidad «Lancio corso»', 'Giulia Bianchi ha creado una oportunidad'] }],
        ['com.zeiras.crm.trattativa.modificata', { it: ['Giulia Bianchi ha modificato l\'opportunità «Lancio corso»', 'Giulia Bianchi ha modificato un\'opportunità'], en: ['Giulia Bianchi edited the opportunity “Lancio corso”', 'Giulia Bianchi edited an opportunity'], es: ['Giulia Bianchi ha modificado la oportunidad «Lancio corso»', 'Giulia Bianchi ha modificado una oportunidad'] }],
        ['com.zeiras.crm.attivita.creata', { it: ['Giulia Bianchi ha creato l\'attività «Lancio corso»', 'Giulia Bianchi ha creato un\'attività'], en: ['Giulia Bianchi created the activity “Lancio corso”', 'Giulia Bianchi created an activity'], es: ['Giulia Bianchi ha creado la actividad «Lancio corso»', 'Giulia Bianchi ha creado una actividad'] }],
        ['com.zeiras.crm.attivita.modificata', { it: ['Giulia Bianchi ha modificato l\'attività «Lancio corso»', 'Giulia Bianchi ha modificato un\'attività'], en: ['Giulia Bianchi edited the activity “Lancio corso”', 'Giulia Bianchi edited an activity'], es: ['Giulia Bianchi ha modificado la actividad «Lancio corso»', 'Giulia Bianchi ha modificado una actividad'] }],
        ['com.zeiras.crm.attivita.eliminata', { it: [null, 'Giulia Bianchi ha eliminato un\'attività'], en: [null, 'Giulia Bianchi deleted an activity'], es: [null, 'Giulia Bianchi ha eliminado una actividad'] }],
        ['com.zeiras.crm.nota.creata', { it: [null, 'Giulia Bianchi ha creato una nota'], en: [null, 'Giulia Bianchi created a note'], es: [null, 'Giulia Bianchi ha creado una nota'] }],
        ['com.zeiras.crm.nota.modificata', { it: [null, 'Giulia Bianchi ha modificato una nota'], en: [null, 'Giulia Bianchi edited a note'], es: [null, 'Giulia Bianchi ha modificado una nota'] }],
        ['com.zeiras.crm.nota.eliminata', { it: [null, 'Giulia Bianchi ha eliminato una nota'], en: [null, 'Giulia Bianchi deleted a note'], es: [null, 'Giulia Bianchi ha eliminado una nota'] }],
        ['com.zeiras.crm.pipeline.creata', { it: ['Giulia Bianchi ha creato la pipeline «Lancio corso»', 'Giulia Bianchi ha creato una pipeline'], en: ['Giulia Bianchi created the pipeline “Lancio corso”', 'Giulia Bianchi created a pipeline'], es: ['Giulia Bianchi ha creado la pipeline «Lancio corso»', 'Giulia Bianchi ha creado una pipeline'] }],
        ['com.zeiras.crm.pipeline.modificata', { it: ['Giulia Bianchi ha modificato la pipeline «Lancio corso»', 'Giulia Bianchi ha modificato una pipeline'], en: ['Giulia Bianchi edited the pipeline “Lancio corso”', 'Giulia Bianchi edited a pipeline'], es: ['Giulia Bianchi ha modificado la pipeline «Lancio corso»', 'Giulia Bianchi ha modificado una pipeline'] }],
        ['crm.persona.assegnata', { it: [null, 'Giulia Bianchi ti ha assegnato un contatto'], en: [null, 'Giulia Bianchi assigned you a contact'], es: [null, 'Giulia Bianchi te ha asignado un contacto'] }],
        ['crm.organizzazione.assegnata', { it: [null, 'Giulia Bianchi ti ha assegnato un\'azienda'], en: [null, 'Giulia Bianchi assigned you a company'], es: [null, 'Giulia Bianchi te ha asignado una empresa'] }],
        ['crm.trattativa.assegnata', { it: [null, 'Giulia Bianchi ti ha assegnato un\'opportunità'], en: [null, 'Giulia Bianchi assigned you an opportunity'], es: [null, 'Giulia Bianchi te ha asignado una oportunidad'] }],
        ['crm.attivita.assegnata', { it: [null, 'Giulia Bianchi ti ha assegnato un\'attività'], en: [null, 'Giulia Bianchi assigned you an activity'], es: [null, 'Giulia Bianchi te ha asignado una actividad'] }],
        // Sprint 31 · T2 (voce #1866). I cinque tipi del workspace, con le parole di zr-home: di un membro il backoffice non dà il nome.
        // `com.zeiras.app.modificata` ha le sue frasi e un caso suo, più sotto: il suo `{what}` è il nome di un modulo, non un nome scritto da una persona.
        ['com.zeiras.workspace.creato', { it: ['Giulia Bianchi ha creato il workspace «Lancio corso»', 'Giulia Bianchi ha creato il workspace'], en: ['Giulia Bianchi created the workspace “Lancio corso”', 'Giulia Bianchi created the workspace'], es: ['Giulia Bianchi ha creado el workspace «Lancio corso»', 'Giulia Bianchi ha creado el workspace'] }],
        ['com.zeiras.workspace.modificato', { it: ['Giulia Bianchi ha modificato il workspace «Lancio corso»', 'Giulia Bianchi ha modificato il workspace'], en: ['Giulia Bianchi changed the workspace “Lancio corso”', 'Giulia Bianchi changed the workspace'], es: ['Giulia Bianchi ha modificado el workspace «Lancio corso»', 'Giulia Bianchi ha modificado el workspace'] }],
        ['com.zeiras.workspace.membro.creato', { it: [null, 'Giulia Bianchi è ora nel workspace'], en: [null, 'Giulia Bianchi joined the workspace'], es: [null, 'Giulia Bianchi ya está en el workspace'] }],
        ['com.zeiras.workspace.membro.modificato', { it: [null, 'Giulia Bianchi ha cambiato il ruolo di un membro'], en: [null, 'Giulia Bianchi changed a member\'s role'], es: [null, 'Giulia Bianchi ha cambiado el rol de un miembro'] }],
        ['com.zeiras.workspace.membro.eliminato', { it: [null, 'Giulia Bianchi ha tolto una persona dal workspace'], en: [null, 'Giulia Bianchi removed someone from the workspace'], es: [null, 'Giulia Bianchi ha quitado a una persona del workspace'] }],
    ];
    /** I testi e le frasi delle notifiche di ogni lingua, insieme: i due file che ha in resources/lingue. */
    const lingueDiPartenza: [Lingua, Record<string, string>][] = [['it', { ...italiano, ...frasiItaliane }], ['en', { ...inglese, ...frasiInglesi }], ['es', { ...spagnolo, ...frasiSpagnole }]];
    /** Le due frasi di `com.zeiras.app.modificata`, con «Giulia Bianchi»: il posto di `{what}` lo prende il nome del modulo nella lingua. */
    const diUnModulo: Record<Lingua, [conIlModulo: (modulo: string) => string, soloChi: string]> = {
        it: [(modulo) => `Giulia Bianchi ha attivato o disattivato il modulo «${modulo}»`, 'Giulia Bianchi ha attivato o disattivato un modulo'],
        en: [(modulo) => `Giulia Bianchi turned the module “${modulo}” on or off`, 'Giulia Bianchi turned a module on or off'],
        es: [(modulo) => `Giulia Bianchi ha activado o desactivado el módulo «${modulo}»`, 'Giulia Bianchi ha activado o desactivado un módulo'],
    };
    const SU_UN_APP = 'com.zeiras.app.modificata';
    const diGiulia = (tipo: unknown, risorsa_nome?: unknown) => ({ tipo, autore_nome: 'Giulia Bianchi', risorsa_nome });
    /** Un titolo atteso coi suoi nomi fra U+2068 e U+2069: dallo sprint 30 in una frase ogni nome è isolato (T2.1). */
    const coiNomiIsolati = (titolo: string, ...nomi: string[]) => [...new Set(nomi)].reduce((testo, nome) => testo.replaceAll(nome, () => `\u{2068}${nome}\u{2069}`), titolo);
    const NOMI_DEI_CASI = ['Giulia Bianchi', 'Lancio corso', 'Corsi 2026', 'Urgente', 'Da fare', 'Vendite'];

    it.each(lingueDiPartenza)('con la lingua "%s" ognuno dei sedici tipi di Project Management, dei due «per me», degli otto del CRM (pipeline, aziende, opportunità, attività) e dei due del workspace ha la frase con chi e che cosa, senza riga di sotto, e quella con solo chi; gli altri dieci del CRM e i tre di un membro la sola frase con chi (sprint 29 · T2.1, T2.2, T2.4; sprint 31 · T1.1, T1.2, T2.1; sprint 32 · T4.1, T4.2)', async (lingua) => {
        const { rigaDellaNotifica } = await import('./frasi');

        expect(frasi).toHaveLength(41);
        expect(frasi.filter(([tipo]) => tipo.startsWith('com.zeiras.workspace.'))).toHaveLength(5);
        expect(frasi.flatMap(([tipo, perLingua]) => (tipo.startsWith('com.zeiras.workspace.') && perLingua[lingua][0] !== null ? [tipo] : []))).toStrictEqual(['com.zeiras.workspace.creato', 'com.zeiras.workspace.modificato']);
        expect(frasi.filter(([tipo]) => tipo.startsWith('com.zeiras.board.'))).toHaveLength(16);
        // Del CRM hanno la frase col nome della cosa la pipeline e, dallo sprint 32 (T4.1, T4.2), aziende, opportunità e attività create o
        // modificate: il nome di un contatto è un dato personale, e di una nota e di un'attività eliminata il backoffice non lo dà; le
        // quattro assegnazioni non hanno ancora la frase col nome (di un'azienda, un'opportunità o un'attività il backoffice lo dà: sta sotto).
        expect(frasi.filter(([tipo]) => /(^|\.)crm\./.test(tipo))).toHaveLength(18);
        expect(frasi.flatMap(([tipo, perLingua]) => (/(^|\.)crm\./.test(tipo) && perLingua[lingua][0] !== null ? [tipo] : []))).toStrictEqual([
            'com.zeiras.crm.organizzazione.creata', 'com.zeiras.crm.organizzazione.modificata', 'com.zeiras.crm.trattativa.creata', 'com.zeiras.crm.trattativa.modificata',
            'com.zeiras.crm.attivita.creata', 'com.zeiras.crm.attivita.modificata', 'com.zeiras.crm.pipeline.creata', 'com.zeiras.crm.pipeline.modificata',
        ]);
        for (const [tipo, perLingua] of frasi) {
            const [conCosa, soloChi] = [perLingua[lingua][0] === null ? null : coiNomiIsolati(perLingua[lingua][0], ...NOMI_DEI_CASI), coiNomiIsolati(perLingua[lingua][1], ...NOMI_DEI_CASI)];
            // Di una cosa eliminata il backoffice non dà il nome: se arrivasse, resta sotto, e non si legge due volte.
            expect([tipo, rigaDellaNotifica(diGiulia(tipo, 'Lancio corso'), lingua)]).toStrictEqual([tipo, conCosa === null ? { titolo: soloChi, sotto: 'Lancio corso' } : { titolo: conCosa }]);
            for (const senzaNome of [null, '', ' \t\n ', undefined, 7]) {
                expect([tipo, rigaDellaNotifica(diGiulia(tipo, senzaNome), lingua)]).toStrictEqual([tipo, { titolo: soloChi }]);
            }
            expect(rigaDellaNotifica({ tipo, autore_nome: 'Giulia Bianchi' }, lingua)).toStrictEqual({ titolo: soloChi });
        }
    });

    it('le frasi dei criteri, parola per parola, nelle tre lingue; gli spazi intorno ai due nomi non sono dei nomi (sprint 29 · T2.1, T2.2, T2.4)', async () => {
        const { rigaDellaNotifica } = await import('./frasi');
        const titolo = (tipo: string, lingua: string, cosa: unknown = 'Lancio corso') => rigaDellaNotifica(diGiulia(tipo, cosa), lingua);

        expect(titolo('com.zeiras.board.scheda.modificata', 'it')).toStrictEqual({ titolo: coiNomiIsolati('Giulia Bianchi ha modificato la scheda «Lancio corso»', ...NOMI_DEI_CASI) });
        expect(titolo('com.zeiras.board.scheda.modificata', 'en')).toStrictEqual({ titolo: coiNomiIsolati('Giulia Bianchi changed the card “Lancio corso”', ...NOMI_DEI_CASI) });
        expect(titolo('com.zeiras.board.scheda.modificata', 'es')).toStrictEqual({ titolo: coiNomiIsolati('Giulia Bianchi ha modificado la tarjeta «Lancio corso»', ...NOMI_DEI_CASI) });
        expect(titolo('com.zeiras.board.scheda.modificata', 'it', null)).toStrictEqual({ titolo: coiNomiIsolati('Giulia Bianchi ha modificato una scheda', ...NOMI_DEI_CASI) });
        expect(titolo('com.zeiras.board.scheda.eliminata', 'it', null)).toStrictEqual({ titolo: coiNomiIsolati('Giulia Bianchi ha eliminato una scheda', ...NOMI_DEI_CASI) });
        expect(titolo('com.zeiras.board.board.creata', 'it', 'Corsi 2026')).toStrictEqual({ titolo: coiNomiIsolati('Giulia Bianchi ha creato la board «Corsi 2026»', ...NOMI_DEI_CASI) });
        expect(titolo('com.zeiras.board.etichetta.modificata', 'it', 'Urgente')).toStrictEqual({ titolo: coiNomiIsolati("Giulia Bianchi ha modificato l'etichetta «Urgente»", ...NOMI_DEI_CASI) });
        expect(titolo('board.scheda.assegnata', 'it')).toStrictEqual({ titolo: coiNomiIsolati('Giulia Bianchi ti ha assegnato la scheda «Lancio corso»', ...NOMI_DEI_CASI) });
        expect(titolo('board.commento.menzione', 'it')).toStrictEqual({ titolo: coiNomiIsolati('Giulia Bianchi ti ha menzionato in «Lancio corso»', ...NOMI_DEI_CASI) });
        expect(titolo('board.scheda.assegnata', 'en')).toStrictEqual({ titolo: coiNomiIsolati('Giulia Bianchi assigned you the card “Lancio corso”', ...NOMI_DEI_CASI) });
        expect(titolo('board.commento.menzione', 'es')).toStrictEqual({ titolo: coiNomiIsolati('Giulia Bianchi te ha mencionado en «Lancio corso»', ...NOMI_DEI_CASI) });
        // Sprint 31 · T1.2: del CRM la pipeline dice anche che cosa; un contatto e un'opportunità assegnata, solo chi.
        expect(titolo('com.zeiras.crm.pipeline.modificata', 'it', 'Vendite')).toStrictEqual({ titolo: coiNomiIsolati('Giulia Bianchi ha modificato la pipeline «Vendite»', ...NOMI_DEI_CASI) });
        expect(titolo('com.zeiras.crm.pipeline.modificata', 'en', 'Vendite')).toStrictEqual({ titolo: coiNomiIsolati('Giulia Bianchi edited the pipeline “Vendite”', ...NOMI_DEI_CASI) });
        expect(titolo('com.zeiras.crm.pipeline.creata', 'es', 'Vendite')).toStrictEqual({ titolo: coiNomiIsolati('Giulia Bianchi ha creado la pipeline «Vendite»', ...NOMI_DEI_CASI) });
        expect(titolo('com.zeiras.crm.persona.creata', 'it', null)).toStrictEqual({ titolo: coiNomiIsolati('Giulia Bianchi ha creato un contatto', ...NOMI_DEI_CASI) });
        expect(titolo('crm.trattativa.assegnata', 'it', null)).toStrictEqual({ titolo: coiNomiIsolati("Giulia Bianchi ti ha assegnato un'opportunità", ...NOMI_DEI_CASI) });
        expect(titolo('com.zeiras.crm.persona.modificata', 'en', null)).toStrictEqual({ titolo: coiNomiIsolati('Giulia Bianchi edited a contact', ...NOMI_DEI_CASI) });
        // Sprint 31 · T2.3: per il contratto chi ha fatto, in `membro.creato`, è la persona entrata; di un membro non c'è il nome.
        expect(titolo('com.zeiras.workspace.membro.creato', 'it', null)).toStrictEqual({ titolo: coiNomiIsolati('Giulia Bianchi è ora nel workspace', ...NOMI_DEI_CASI) });
        expect(titolo('com.zeiras.workspace.membro.eliminato', 'it', null)).toStrictEqual({ titolo: coiNomiIsolati('Giulia Bianchi ha tolto una persona dal workspace', ...NOMI_DEI_CASI) });
        expect(titolo('com.zeiras.workspace.membro.modificato', 'it', null)).toStrictEqual({ titolo: coiNomiIsolati('Giulia Bianchi ha cambiato il ruolo di un membro', ...NOMI_DEI_CASI) });
        expect(titolo('com.zeiras.workspace.membro.modificato', 'en', null)).toStrictEqual({ titolo: coiNomiIsolati("Giulia Bianchi changed a member's role", ...NOMI_DEI_CASI) });
        expect(titolo('com.zeiras.workspace.membro.creato', 'es', null)).toStrictEqual({ titolo: coiNomiIsolati('Giulia Bianchi ya está en el workspace', ...NOMI_DEI_CASI) });
        expect(titolo('com.zeiras.workspace.modificato', 'it', 'Corsi 2026')).toStrictEqual({ titolo: coiNomiIsolati('Giulia Bianchi ha modificato il workspace «Corsi 2026»', ...NOMI_DEI_CASI) });
        expect(titolo('com.zeiras.workspace.creato', 'en', 'Corsi 2026')).toStrictEqual({ titolo: coiNomiIsolati('Giulia Bianchi created the workspace “Corsi 2026”', ...NOMI_DEI_CASI) });
        expect(rigaDellaNotifica({ tipo: 'com.zeiras.board.lista.creata', autore_nome: '  Giulia Bianchi ', risorsa_nome: '\tDa fare ' }, 'it')).toStrictEqual({ titolo: coiNomiIsolati('Giulia Bianchi ha creato la lista «Da fare»', ...NOMI_DEI_CASI) });
        // Una variante regionale prende la lingua base; una lingua che zr-core non ha, l'inglese.
        expect(titolo('com.zeiras.board.scheda.creata', 'es_ES')).toStrictEqual({ titolo: coiNomiIsolati('Giulia Bianchi ha creado la tarjeta «Lancio corso»', ...NOMI_DEI_CASI) });
        expect(titolo('com.zeiras.board.scheda.creata', 'fr')).toStrictEqual({ titolo: coiNomiIsolati('Giulia Bianchi created the card “Lancio corso”', ...NOMI_DEI_CASI) });
    });

    it('senza chi — `null`, vuoto, di soli spazi, senza la chiave, o un valore che non è un testo — la riga è quella di prima: il titolo del tipo e il nome della cosa sotto (sprint 29 · T2.3)', async () => {
        const { rigaDellaNotifica, risorsaDellaNotifica, titoloDellaNotifica } = await import('./frasi');
        const senzaChi = [null, '', '   ', '\n', undefined, 7, true, { nome: 'Giulia Bianchi' }, ['Giulia Bianchi']];

        for (const [lingua] of lingueDiPartenza) {
            for (const [tipo] of frasi) {
                const diPrima = { titolo: titoloDellaNotifica(tipo, lingua), sotto: risorsaDellaNotifica({ tipo, risorsa_nome: 'Lancio corso' }, lingua) };
                expect(senzaChi.map((autore_nome) => rigaDellaNotifica({ tipo, autore_nome, risorsa_nome: 'Lancio corso' }, lingua))).toStrictEqual(senzaChi.map(() => diPrima));
                expect(rigaDellaNotifica({ tipo, risorsa_nome: 'Lancio corso' }, lingua)).toStrictEqual(diPrima);
                // Senza chi e senza cosa: il solo titolo, e la chiave `sotto` non c'è.
                expect(Object.keys(rigaDellaNotifica({ tipo }, lingua))).toStrictEqual(['titolo']);
            }
        }
        expect(rigaDellaNotifica({ tipo: 'com.zeiras.board.scheda.modificata', autore_nome: null, risorsa_nome: 'Lancio corso' }, 'it')).toStrictEqual({ titolo: 'Scheda modificata', sotto: 'Lancio corso' });
    });

    it('ogni tipo che ha un titolo ha le sue frasi; uno che zr-core non conosce, o che non è un testo, resta com\'è anche con chi (sprint 29 · T2.5; sprint 31 · T2.1)', async () => {
        const { rigaDellaNotifica, titoloDellaNotifica } = await import('./frasi');
        const conLeFrasi = new Set([...frasi.map(([tipo]) => tipo), SU_UN_APP]);
        const conUnTitolo = Object.keys(frasiInglesi).flatMap((chiave) => (chiave.startsWith('notificationTitle.') ? [chiave.slice('notificationTitle.'.length)] : []));

        expect(conUnTitolo).toHaveLength(42);
        expect(conUnTitolo.filter((tipo) => !conLeFrasi.has(tipo))).toStrictEqual([]);
        for (const [lingua, file] of lingueDiPartenza) {
            for (const tipo of ['com.zeiras.board.scheda.spostata', 'com.zeiras.board.scheda', 'scheda.modificata', '', undefined, null, 7]) {
                expect(rigaDellaNotifica(diGiulia(tipo, 'Lancio corso'), lingua)).toStrictEqual({ titolo: titoloDellaNotifica(tipo, lingua), sotto: 'Lancio corso' });
                expect(rigaDellaNotifica(diGiulia(tipo, 'Lancio corso'), lingua).titolo).toBe(file.notificationTitle);
            }
        }
    });

    // Sprint 31 · T2.2. Di un modulo il backoffice dà il codice (`pm`): nella frase c'è il nome nella lingua, mai il codice.
    it.each(lingueDiPartenza)('con la lingua "%s" un modulo attivato o disattivato da Giulia ha nella frase il nome del modulo; con un codice che il registro non ha, o senza, la frase con solo chi; senza chi resta il titolo di prima (sprint 31 · T2.2)', async (lingua, file) => {
        const { rigaDellaNotifica } = await import('./frasi');
        const [conIlModulo, soloChi] = diUnModulo[lingua];
        const modulo = file.pm ?? '';

        expect(modulo).not.toBe('');
        expect(rigaDellaNotifica(diGiulia(SU_UN_APP, 'pm'), lingua)).toStrictEqual({ titolo: coiNomiIsolati(conIlModulo(modulo), 'Giulia Bianchi', modulo) });
        for (const codice of ['uat-modulo-che-non-c-e', 'Project Management', null, '', undefined, 7]) {
            expect([codice, rigaDellaNotifica(diGiulia(SU_UN_APP, codice), lingua)]).toStrictEqual([codice, { titolo: coiNomiIsolati(soloChi, 'Giulia Bianchi') }]);
        }
        expect(rigaDellaNotifica({ tipo: SU_UN_APP, autore_nome: null, risorsa_nome: 'pm' }, lingua)).toStrictEqual({ titolo: file[`notificationTitle.${SU_UN_APP}`], sotto: modulo });
        // Il codice non si legge mai: né nella frase, né sotto.
        expect(JSON.stringify([rigaDellaNotifica(diGiulia(SU_UN_APP, 'pm'), lingua), rigaDellaNotifica(diGiulia(SU_UN_APP, 'uat-modulo-che-non-c-e'), lingua)])).not.toMatch(/\bpm\b|uat-modulo/);
    });

    it('la frase di un modulo, parola per parola: in italiano «Giulia Bianchi ha attivato o disattivato il modulo «Project Management»» (sprint 31 · T2.2)', async () => {
        const { rigaDellaNotifica } = await import('./frasi');

        expect(rigaDellaNotifica(diGiulia(SU_UN_APP, 'pm'), 'it')).toStrictEqual({ titolo: '\u{2068}Giulia Bianchi\u{2069} ha attivato o disattivato il modulo «\u{2068}Project Management\u{2069}»' });
        expect(rigaDellaNotifica(diGiulia(SU_UN_APP, 'uat-modulo-che-non-c-e'), 'it')).toStrictEqual({ titolo: '\u{2068}Giulia Bianchi\u{2069} ha attivato o disattivato un modulo' });
        expect(rigaDellaNotifica(diGiulia(SU_UN_APP, 'pm'), 'en').titolo).toMatch(/^\u{2068}Giulia Bianchi\u{2069} turned the module “\u{2068}.+\u{2069}” on or off$/u);
    });

    it('un nome con dentro `{what}`, `{who}`, `$&` o `<b>` si legge com\'è scritto, una volta sola: nessun posto si riempie due volte (sprint 29 · T2.6)', async () => {
        const { rigaDellaNotifica } = await import('./frasi');
        const riga = (autore_nome: string, risorsa_nome: string | null, tipo = 'com.zeiras.board.scheda.modificata') => rigaDellaNotifica({ tipo, autore_nome, risorsa_nome }, 'it');

        expect(riga('Ada {what}', 'Piano {who}')).toStrictEqual({ titolo: coiNomiIsolati('Ada {what} ha modificato la scheda «Piano {who}»', 'Ada {what}', 'Piano {who}') });
        expect(riga('{who} {what}', '{what} {who}')).toStrictEqual({ titolo: coiNomiIsolati('{who} {what} ha modificato la scheda «{what} {who}»', '{who} {what}', '{what} {who}') });
        expect(riga("$& $1 $` $' $$", "$& $1 $` $' $$")).toStrictEqual({ titolo: coiNomiIsolati("$& $1 $` $' $$ ha modificato la scheda «$& $1 $` $' $$»", "$& $1 $` $' $$") });
        expect(riga('<b>Ada</b>', '<i>Piano</i> & co.')).toStrictEqual({ titolo: coiNomiIsolati('<b>Ada</b> ha modificato la scheda «<i>Piano</i> & co.»', '<b>Ada</b>', '<i>Piano</i> & co.') });
        expect(riga('Ada {what} $&', null)).toStrictEqual({ titolo: coiNomiIsolati('Ada {what} $& ha modificato una scheda', 'Ada {what} $&') });
        expect(riga('Ada {what}', 'Piano {who}', 'com.zeiras.board.scheda.eliminata')).toStrictEqual({ titolo: coiNomiIsolati('Ada {what} ha eliminato una scheda', 'Ada {what}'), sotto: 'Piano {who}' });
        // Ogni nome è isolato una volta: due caratteri di apertura e due di chiusura, non di più.
        expect(riga('{who} {what}', '{what} {who}').titolo.match(/[\u{2068}\u{2069}]/gu)).toHaveLength(4);
    });

    it.each(lingueDiPartenza)('nella lingua "%s" le frasi sono 67, ognuna di un tipo che ha un titolo e coi suoi posti una volta sola: `{who}` e `{what}`, o il solo `{who}` (sprint 29 · T2.7; sprint 31 · T1.1, T2.1; sprint 32 · T4.3)', (_lingua, file) => {
        const posti = (testo: string) => (testo.match(/\{[^{}]*\}/g) ?? []).sort();
        const chiavi = Object.keys(file).filter((chiave) => chiave.startsWith('notificationTitleWho'));

        expect(chiavi.sort()).toStrictEqual(frasi.flatMap(([tipo, perLingua]) => [...(perLingua.it[0] === null ? [] : [`notificationTitleWhoWhat.${tipo}`]), `notificationTitleWho.${tipo}`]).concat([`notificationTitleWhoWhat.${SU_UN_APP}`, `notificationTitleWho.${SU_UN_APP}`]).sort());
        expect(chiavi).toHaveLength(67);
        for (const chiave of chiavi) {
            const [famiglia, tipo] = [chiave.slice(0, chiave.indexOf('.')), chiave.slice(chiave.indexOf('.') + 1)];
            expect([chiave, posti(file[chiave] ?? '')]).toStrictEqual([chiave, famiglia === 'notificationTitleWhoWhat' ? ['{what}', '{who}'] : ['{who}']]);
            expect([chiave, typeof file[`notificationTitle.${tipo}`]]).toStrictEqual([chiave, 'string']);
        }
    });

    it('una frase che una lingua non ha è quella dell\'inglese; e una frase si usa solo se è un testo e se ha i nomi che chiede (sprint 29 · T2.3, T2.7)', async () => {
        const { fraseConINomi } = await import('./campanella');
        const { 'notificationTitleWhoWhat.com.zeiras.board.scheda.modificata': tolta, ...senzaUnaFrase } = frasiSpagnole;
        const conUnaInMeno = frasiDiOgniLingua({ '../lingue/notifiche/en.json': frasiInglesi, '../lingue/notifiche/es.json': senzaUnaFrase }, frasiInglesi);

        expect(tolta).toBe('{who} ha modificado la tarjeta «{what}»');
        expect(conUnaInMeno('es')['notificationTitleWhoWhat.com.zeiras.board.scheda.modificata']).toBe('{who} changed the card “{what}”');
        expect(conUnaInMeno('es')['notificationTitleWho.com.zeiras.board.scheda.modificata']).toBe('{who} ha modificado una tarjeta');
        // Un file scritto male: una frase che chiede il nome della cosa non si usa quando il nome non c'è, e una senza testo mai.
        expect(fraseConINomi('{who} + {what}', 'Giulia Bianchi', 'Lancio corso')).toBe('\u{2068}Giulia Bianchi\u{2069} + \u{2068}Lancio corso\u{2069}');
        expect(fraseConINomi('{who} + {what}', 'Giulia Bianchi')).toBeUndefined();
        expect(fraseConINomi('{who} ha creato una scheda', 'Giulia Bianchi')).toBe('\u{2068}Giulia Bianchi\u{2069} ha creato una scheda');
        expect([undefined, '', null, 7].map((frase) => fraseConINomi(frase, 'Giulia Bianchi', 'Lancio corso'))).toStrictEqual([undefined, undefined, undefined, undefined]);
    });

    // Sprint 33 · T1.1 (voce #1915): dalla `v2.0.0` le tre funzioni per le pagine si importano da `./frasi`, e i due ingressi
    // non le hanno più — né loro né altro del pezzo della campanella, che così resta fuori dal JS d'ingresso.
    it('dalla v2 si importa da `./frasi`, con `titoloDellaNotifica` e `risorsaDellaNotifica`: i due ingressi non ne esportano nessuna (sprint 33 · T1.1)', async () => {
        const [diSempre, perLeApp, delleFrasi] = await Promise.all([import('./index'), import('./app'), import('./frasi')]);
        const perLePagine = ['rigaDellaNotifica', 'risorsaDellaNotifica', 'titoloDellaNotifica'];

        expect(perLePagine.filter((nome) => nome in diSempre || nome in perLeApp)).toStrictEqual([]);
        expect(perLePagine.map((nome) => typeof (delleFrasi as Record<string, unknown>)[nome])).toStrictEqual(['function', 'function', 'function']);
        // Sincrone, come prima dello sprint 30: un testo, non una promessa (sprint 30 · T1.8).
        expect(delleFrasi.rigaDellaNotifica(diGiulia('com.zeiras.board.scheda.modificata', 'Lancio corso'), 'it')).toStrictEqual({ titolo: coiNomiIsolati('Giulia Bianchi ha modificato la scheda «Lancio corso»', ...NOMI_DEI_CASI) });
        expect(delleFrasi.titoloDellaNotifica('com.zeiras.board.scheda.modificata', 'it')).toBe('Scheda modificata');
        expect(delleFrasi.risorsaDellaNotifica(diGiulia('com.zeiras.board.scheda.modificata', ' Lancio corso '), 'it')).toBe('Lancio corso');
    });
});

// Sprint 30 · T1 (voce #1875). Le frasi delle notifiche stanno in un file loro per lingua (resources/lingue/notifiche) e la
// cornice le carica quando servono: il file della lingua e quello dell'inglese, una volta sola. Chi mostra le notifiche in
// una pagina sua le ha subito, da `./frasi`, e gli stessi testi.
describe('le frasi delle notifiche a richiesta (sprint 30 · T1)', () => {
    /** Tre file che dicono quando sono chiesti; `rotti` non arrivano. */
    function fileFinti(rotti = new Set<string>()) {
        const chiesti: string[] = [];
        const file = (codice: string, frasi: FrasiDelleNotifiche) => async (): Promise<FrasiDelleNotifiche> => {
            chiesti.push(codice);
            if (rotti.has(codice)) {
                throw new TypeError('Failed to fetch dynamically imported module');
            }

            return frasi;
        };
        const { 'notificationTitle.com.zeiras.board.scheda.creata': _tolto, ...spagnoleConUnaInMeno } = frasiSpagnole;
        const aRichiesta = frasiARichiesta({
            '../lingue/notifiche/en.json': file('en', frasiInglesi),
            '../lingue/notifiche/es.json': file('es', { ...spagnoleConUnaInMeno, 'notificationTitle.com.zeiras.crm.contatto.creato': 'Nuevo contacto', 'notificationTitle.com.zeiras.board.scheda.modificata': '  ' }),
            '../lingue/notifiche/it.json': file('it', frasiItaliane),
        }, file('en', frasiInglesi));

        return { chiesti, rotti, ...aRichiesta };
    }

    it('per una lingua partono il suo file e quello dell\'inglese, mai gli altri; prima non c\'è niente in memoria, dopo le frasi restano e non si richiedono, e due richieste insieme sono una (T1.3, T1.6)', async () => {
        const frasi = fileFinti();
        expect(frasi.chiesti).toStrictEqual([]);
        expect(frasi.pronte('it')).toBeUndefined();

        const [prime, insieme] = await Promise.all([frasi.carica('it-IT'), frasi.carica('it')]);
        expect(frasi.chiesti.sort()).toStrictEqual(['en', 'it']);
        expect(insieme).toBe(prime);
        expect(prime).toStrictEqual({ ...frasiInglesi, ...frasiItaliane });
        expect(Object.isFrozen(prime)).toBe(true);
        expect(frasi.pronte('IT')).toBe(prime);
        // Le altre lingue non sono in memoria finché nessuno le chiede.
        expect(frasi.pronte('es')).toBeUndefined();
        expect(frasi.pronte('en')).toBeUndefined();

        expect(await frasi.carica('it')).toBe(prime);
        expect(frasi.chiesti).toHaveLength(2);
    });

    it('una lingua senza una frase, o con la frase vuota, la ha in inglese; una frase di un tipo che l\'inglese non ha non entra; una lingua che zr-core non ha chiede il solo inglese (T1.4)', async () => {
        const frasi = fileFinti();
        const spagnole = await frasi.carica('es');

        expect(spagnole['notificationTitle.com.zeiras.board.scheda.creata']).toBe('New card');
        expect(spagnole['notificationTitle.com.zeiras.board.scheda.modificata']).toBe('Card changed');
        expect(spagnole['notificationTitle.com.zeiras.board.cartella.creata']).toBe('Nueva carpeta');
        expect(Object.keys(spagnole).sort()).toStrictEqual(Object.keys(frasiInglesi).sort());

        frasi.chiesti.length = 0;
        const diNessuno = await frasi.carica('zz');
        expect(frasi.chiesti).toStrictEqual(['en']);
        expect(diNessuno).toStrictEqual(frasiInglesi);
        expect(frasi.pronte('constructor')).toBe(diNessuno);
    });

    it('se un file non arriva la promessa è respinta e niente resta in memoria: la richiesta dopo riparte, e se arriva le frasi ci sono (T1.5)', async () => {
        for (const rotto of ['it', 'en']) {
            const frasi = fileFinti(new Set([rotto]));

            await expect(frasi.carica('it')).rejects.toThrow('Failed to fetch dynamically imported module');
            expect(frasi.pronte('it')).toBeUndefined();

            frasi.rotti.clear();
            frasi.chiesti.length = 0;
            expect(await frasi.carica('it')).toStrictEqual({ ...frasiInglesi, ...frasiItaliane });
            expect(frasi.chiesti.sort()).toStrictEqual(['en', 'it']);
        }
    });

    // Sprint 31 · T4.2 (voce #1908; review della PR #63, S8). Le attese sono scritte qui a mano, una per famiglia di frase: il
    // pannello e la pagina passano dalla stessa funzione, e confrontati fra loro un nome perso lo perdono insieme. Che le frasi
    // caricate dalla cornice siano quelle dei file lo prova `frasi-con-fetch.test.ts`, dal caricatore vero (T4.1).
    // Sprint 32 · T2.2 (voce #1912; review della PR #64): le attese a mano sono per un tipo di ogni famiglia di notifica —
    // Project Management, CRM, workspace — e con loro si confronta anche ciò che mostra il pannello, non solo la funzione della
    // pagina: una frase cambiata in un file delle frasi fa rosso questo caso. Dallo sprint 32 (T4.1, voce #1914) anche il tipo
    // del CRM ha la frase con chi e che cosa.
    const isolato = (nome: string) => `\u{2068}${nome}\u{2069}`;
    const [GIULIA, LANCIO] = [isolato('Giulia Bianchi'), isolato('Lancio corso')];
    type AMano = [tipo: string, conChiECosa: string | null, conSoloChi: string, titolo: string];
    const inInglese: AMano[] = [
        ['com.zeiras.board.scheda.modificata', `${GIULIA} changed the card “${LANCIO}”`, `${GIULIA} changed a card`, 'Card changed'],
        ['com.zeiras.crm.organizzazione.modificata', `${GIULIA} edited the company “${LANCIO}”`, `${GIULIA} edited a company`, 'Company changed'],
        ['com.zeiras.workspace.modificato', `${GIULIA} changed the workspace “${LANCIO}”`, `${GIULIA} changed the workspace`, 'The workspace was changed'],
    ];

    it.each<[lingua: string, file: FrasiDelleNotifiche, aMano: AMano[]]>([
        ['it', frasiItaliane, [
            ['com.zeiras.board.scheda.modificata', `${GIULIA} ha modificato la scheda «${LANCIO}»`, `${GIULIA} ha modificato una scheda`, 'Scheda modificata'],
            ['com.zeiras.crm.organizzazione.modificata', `${GIULIA} ha modificato l'azienda «${LANCIO}»`, `${GIULIA} ha modificato un'azienda`, 'Azienda modificata'],
            ['com.zeiras.workspace.modificato', `${GIULIA} ha modificato il workspace «${LANCIO}»`, `${GIULIA} ha modificato il workspace`, 'Il workspace è stato modificato'],
        ]],
        ['es', frasiSpagnole, [
            ['com.zeiras.board.scheda.modificata', `${GIULIA} ha modificado la tarjeta «${LANCIO}»`, `${GIULIA} ha modificado una tarjeta`, 'Tarjeta modificada'],
            ['com.zeiras.crm.organizzazione.modificata', `${GIULIA} ha modificado la empresa «${LANCIO}»`, `${GIULIA} ha modificado una empresa`, 'Empresa modificada'],
            ['com.zeiras.workspace.modificato', `${GIULIA} ha modificado el workspace «${LANCIO}»`, `${GIULIA} ha modificado el workspace`, 'Se modificó el workspace'],
        ]],
        ['en', frasiInglesi, inInglese],
        ['zz', frasiInglesi, inInglese],
    ])('con la lingua "%s" il pannello e chi mostra le notifiche in una pagina sua hanno i testi scritti qui a mano per un tipo di Project Management, uno del CRM e uno del workspace — con chi e che cosa, con solo chi, titolo e riga sotto —, e per ogni altro tipo il pannello ha gli stessi della pagina (T1.8; sprint 31 · T4.2; sprint 32 · T2.2)', async (lingua, file, aMano) => {
        const { rigaConLeFrasi, titoloConLeFrasi } = await import('./campanella');
        const { rigaDellaNotifica, titoloDellaNotifica } = await import('./frasi');
        const caricate = { ...frasiInglesi, ...file };
        const tipi = [...Object.keys(frasiInglesi).filter((chiave) => chiave.startsWith('notificationTitle.')).map((chiave) => chiave.slice('notificationTitle.'.length)), 'com.zeiras.uat.ignoto', '', undefined, 7];
        const righe: [di: string, riga: (notifica: { tipo: string; autore_nome?: string; risorsa_nome?: string }) => { titolo: string; sotto?: string }][] = [
            ['la pagina', (notifica) => rigaDellaNotifica(notifica, lingua)],
            ['il pannello', (notifica) => rigaConLeFrasi(caricate, notifica, lingua)],
        ];

        expect(aMano.map(([tipo]) => tipo.split('.')[2])).toStrictEqual(['board', 'crm', 'workspace']);
        for (const [tipo, conChiECosa, conSoloChi, titolo] of aMano) {
            for (const [di, riga] of righe) {
                expect([di, tipo, riga({ tipo, autore_nome: 'Giulia Bianchi', risorsa_nome: 'Lancio corso' })]).toStrictEqual([di, tipo, conChiECosa === null ? { titolo: conSoloChi, sotto: 'Lancio corso' } : { titolo: conChiECosa }]);
                expect([di, tipo, riga({ tipo, autore_nome: 'Giulia Bianchi' })]).toStrictEqual([di, tipo, { titolo: conSoloChi }]);
                expect([di, tipo, riga({ tipo, risorsa_nome: 'Lancio corso' })]).toStrictEqual([di, tipo, { titolo, sotto: 'Lancio corso' }]);
            }
            expect([tipo, titoloDellaNotifica(tipo, lingua), titoloConLeFrasi(caricate, tipo, lingua)]).toStrictEqual([tipo, titolo, titolo]);
        }
        expect(tipi).toHaveLength(42 + 4);
        for (const tipo of tipi) {
            for (const notifica of [{ tipo, autore_nome: 'Giulia Bianchi', risorsa_nome: 'Lancio corso' }, { tipo, autore_nome: 'Giulia Bianchi' }, { tipo, risorsa_nome: 'Lancio corso' }]) {
                expect([tipo, rigaConLeFrasi(caricate, notifica, lingua)]).toStrictEqual([tipo, rigaDellaNotifica(notifica, lingua)]);
            }
            expect([tipo, titoloConLeFrasi(caricate, tipo, lingua)]).toStrictEqual([tipo, titoloDellaNotifica(tipo, lingua)]);
        }
        // Un tipo che le lingue non hanno ha il titolo di ripiego, che è un testo della cornice.
        expect(titoloDellaNotifica('com.zeiras.uat.ignoto', lingua)).toBe(testi(lingua).notificationTitle);
    });

    it('il titolo di ripiego è fra i testi della cornice e non fra le frasi; fra i testi non c\'è nessuna frase (T1.9)', () => {
        const eUnaFrase = (chiave: string) => /^notificationTitle(Who(What)?)?\../.test(chiave);

        for (const [testiDelFile, frasiDelFile] of [[italiano, frasiItaliane], [spagnolo, frasiSpagnole], [inglese, frasiInglesi]] as const) {
            expect(typeof testiDelFile.notificationTitle).toBe('string');
            expect(Object.keys(testiDelFile).filter(eUnaFrase)).toStrictEqual([]);
            expect(Object.keys(frasiDelFile).filter((chiave) => !eUnaFrase(chiave))).toStrictEqual([]);
            expect(Object.keys(frasiDelFile).sort()).toStrictEqual(Object.keys(frasiInglesi).sort());
        }
    });
});

// Sprint 30 · T2 (voce #1875). I due nomi di una notifica li scrive una persona e arrivano dal backoffice com'è stata scritta:
// finché il backoffice non li rifiuta alla scrittura (sua voce #1880) la difesa è qui. I caratteri sono scritti col loro
// codice, mai incollati: in un file di prova un carattere di direzione non si vede.
describe('il nome nella frase: pulito e isolato (sprint 30 · T2)', () => {
    const INIZIO = '\u{2068}';
    const FINE = '\u{2069}';
    const isolato = (nome: string) => `${INIZIO}${nome}${FINE}`;
    const modificata = 'com.zeiras.board.scheda.modificata';
    const eliminata = 'com.zeiras.board.scheda.eliminata';
    const DI_DIREZIONE = [0x061c, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069].map((codice) => String.fromCodePoint(codice));
    const DI_CONTROLLO = [...Array.from({ length: 0x20 }, (_, codice) => codice), ...Array.from({ length: 0x21 }, (_, indice) => 0x7f + indice), 0x2028, 0x2029].map((codice) => String.fromCodePoint(codice));
    const riga = (notifica: { tipo?: unknown; autore_nome?: unknown; risorsa_nome?: unknown }) => rigaConLeFrasi(frasiItaliane, notifica, 'it');
    const quanti = (testo: string, carattere: string) => testo.split(carattere).length - 1;

    it('nel titolo ognuno dei due nomi sta fra U+2068 e U+2069, e solo i nomi: non la frase, non la riga di sotto (T2.1)', () => {
        expect(riga({ tipo: modificata, autore_nome: 'Giulia Bianchi', risorsa_nome: 'Lancio corso' })).toStrictEqual({ titolo: `${isolato('Giulia Bianchi')} ha modificato la scheda «${isolato('Lancio corso')}»` });
        expect(riga({ tipo: modificata, autore_nome: 'Giulia Bianchi' })).toStrictEqual({ titolo: `${isolato('Giulia Bianchi')} ha modificato una scheda` });
        // Una cosa eliminata non ha la frase col nome della cosa: il nome è la riga di sotto, da solo, e lì non c'è da isolarlo.
        expect(riga({ tipo: eliminata, autore_nome: 'Giulia Bianchi', risorsa_nome: 'Lancio corso' })).toStrictEqual({ titolo: `${isolato('Giulia Bianchi')} ha eliminato una scheda`, sotto: 'Lancio corso' });
        // Senza chi il titolo è quello di prima: nessun nome dentro, nessun carattere di isolamento.
        expect(riga({ tipo: modificata, risorsa_nome: 'Lancio corso' })).toStrictEqual({ titolo: frasiItaliane[`notificationTitle.${modificata}`], sotto: 'Lancio corso' });
        for (const frasi of [frasiItaliane, frasiSpagnole, frasiInglesi]) {
            const { titolo } = rigaConLeFrasi(frasi, { tipo: modificata, autore_nome: 'Giulia Bianchi', risorsa_nome: 'Lancio corso' }, 'it');

            expect(titolo.startsWith(`${isolato('Giulia Bianchi')} `)).toBe(true);
            expect(titolo).toContain(isolato('Lancio corso'));
            expect([quanti(titolo, INIZIO), quanti(titolo, FINE)]).toStrictEqual([2, 2]);
        }
    });

    it.each(DI_DIREZIONE.map((carattere) => [`U+${(carattere.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`, carattere]))('un nome con %s arriva nel titolo, nella riga di sotto e in `nomePulito` senza quel carattere, e la frase dopo il nome non resta dentro un cambio di direzione (T2.2)', (_, carattere) => {
        const sporco = { autore_nome: `${carattere}Giu${carattere}lia Bianchi${carattere}`, risorsa_nome: `${carattere}Lancio${carattere} corso${carattere}` };

        expect(riga({ tipo: modificata, ...sporco })).toStrictEqual({ titolo: `${isolato('Giulia Bianchi')} ha modificato la scheda «${isolato('Lancio corso')}»` });
        expect(riga({ tipo: eliminata, ...sporco })).toStrictEqual({ titolo: `${isolato('Giulia Bianchi')} ha eliminato una scheda`, sotto: 'Lancio corso' });
        expect(riga({ tipo: modificata, risorsa_nome: sporco.risorsa_nome })).toStrictEqual({ titolo: frasiItaliane[`notificationTitle.${modificata}`], sotto: 'Lancio corso' });
        expect(nomePulito(sporco.autore_nome)).toBe('Giulia Bianchi');
    });

    it('la pulizia è del nome, non della frase delle lingue: un carattere di direzione scritto in una frase resta (T2.2)', () => {
        const frasi: FrasiDelleNotifiche = { 'notificationTitleWho.uat.tipo': '\u{200F}{who} \u{202B}fatto\u{202C}', 'notificationTitleWhoWhat.uat.tipo': '{what}\u{200E}: {who}' };

        expect(rigaConLeFrasi(frasi, { tipo: 'uat.tipo', autore_nome: 'Ada\u{202E}' }, 'it').titolo).toBe(`\u{200F}${isolato('Ada')} \u{202B}fatto\u{202C}`);
        expect(rigaConLeFrasi(frasi, { tipo: 'uat.tipo', autore_nome: 'Ada\u{202E}', risorsa_nome: '\u{202E}Piano' }, 'it').titolo).toBe(`${isolato('Piano')}\u{200E}: ${isolato('Ada')}`);
    });

    it('a capo, tabulazioni e gli altri caratteri di controllo diventano uno spazio, e più spazi di fila uno solo (T2.3)', () => {
        expect(DI_CONTROLLO).toHaveLength(32 + 33 + 2);
        for (const carattere of DI_CONTROLLO) {
            const codice = carattere.codePointAt(0);

            expect([codice, nomePulito(`Giulia${carattere}Bianchi`)]).toStrictEqual([codice, 'Giulia Bianchi']);
            expect([codice, nomePulito(`${carattere}Giulia Bianchi${carattere}`)]).toStrictEqual([codice, 'Giulia Bianchi']);
        }
        expect(nomePulito('  Giulia \r\n\t  Bianchi \u{2028} ')).toBe('Giulia Bianchi');
        expect(riga({ tipo: modificata, autore_nome: 'Giulia\nBianchi', risorsa_nome: 'Lancio\t\tcorso\u{0085}Q4' })).toStrictEqual({ titolo: `${isolato('Giulia Bianchi')} ha modificato la scheda «${isolato('Lancio corso Q4')}»` });
        // Ciò che non è un carattere di controllo né di direzione resta: uno spazio che non va a capo, un'emoji, un accento.
        expect(nomePulito('Zoë\u{00A0}D\u{2019}Arcy 🎉')).toBe('Zoë\u{00A0}D\u{2019}Arcy 🎉');
    });

    it.each([
        ['di soli spazi e a capo', ' \n\t '],
        ['di soli caratteri di direzione', '\u{202E}\u{2066}\u{2069}'],
        ['di caratteri di controllo e di direzione', '\u{0000}\u{202E} \u{009F}\u{200F}'],
        ['vuoto', ''],
    ])('un nome %s dopo la pulizia è un nome che manca: il titolo di prima, senza frase (T2.3)', (_, nome) => {
        expect(nomePulito(nome)).toBeUndefined();
        expect(riga({ tipo: modificata, autore_nome: nome, risorsa_nome: 'Lancio corso' })).toStrictEqual(riga({ tipo: modificata, risorsa_nome: 'Lancio corso' }));
        expect(riga({ tipo: modificata, autore_nome: 'Giulia Bianchi', risorsa_nome: nome })).toStrictEqual(riga({ tipo: modificata, autore_nome: 'Giulia Bianchi' }));
        expect(riga({ tipo: modificata, autore_nome: nome, risorsa_nome: nome })).toStrictEqual({ titolo: frasiItaliane[`notificationTitle.${modificata}`] });
    });

    it('ciò che non è un testo non è un nome (T2.3)', () => {
        expect([undefined, null, 7, true, {}, ['Ada']].map(nomePulito)).toStrictEqual(Array(6).fill(undefined));
    });

    // Il taglio del nome a 60 caratteri (AC T2.4 del refining) non è in questa versione: il suo codice non stava nel tetto del JS
    // d'ingresso (peso.test.ts) e non si può caricare a richiesta, perché lo usano anche le funzioni per le pagine. Decisione di
    // zr-pm del 12/10/2026: è una voce a sé. Fino ad allora un nome lungo sta intero, e il tetto di lunghezza è del backoffice.
    it('un nome lungo sta intero nel titolo, isolato, e nessun carattere si spezza: un\'emoji, una lettera con l\'accento composto', () => {
        const titoloDi = (nome: string) => riga({ tipo: modificata, autore_nome: nome }).titolo;
        const famiglia = '\u{1F469}\u{200D}\u{1F469}\u{200D}\u{1F467}\u{200D}\u{1F466}';
        const lungo = `${'a'.repeat(100)}${famiglia}${'e\u{0301}'.repeat(100)}`;

        expect(titoloDi('a'.repeat(255))).toBe(`${isolato('a'.repeat(255))} ha modificato una scheda`);
        expect(titoloDi(lungo)).toBe(`${isolato(lungo)} ha modificato una scheda`);
        expect(nomePulito(lungo)).toBe(lungo);
        expect(riga({ tipo: modificata, autore_nome: 'Ada', risorsa_nome: 'c'.repeat(255) }).titolo).toBe(`${isolato('Ada')} ha modificato la scheda «${isolato('c'.repeat(255))}»`);
    });

    it.each(['{{cosa}}', '%s', '{what}', '{who}', '$&', '$1', '$\'', '<b>x</b>', '&lt;'])('un nome «%s» resta nel titolo carattere per carattere (T2.5)', (nome) => {
        expect(riga({ tipo: modificata, autore_nome: nome, risorsa_nome: nome })).toStrictEqual({ titolo: `${isolato(nome)} ha modificato la scheda «${isolato(nome)}»` });
        expect(riga({ tipo: eliminata, autore_nome: nome, risorsa_nome: nome })).toStrictEqual({ titolo: `${isolato(nome)} ha eliminato una scheda`, sotto: nome });
        expect(nomePulito(nome)).toBe(nome);
    });
});
