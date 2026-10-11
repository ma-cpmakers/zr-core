import { afterEach, describe, expect, it, vi } from 'vitest';
import { destinazioneDellaNotifica, registro, type DatiDellaCornice } from './index';

// Sprint 21 · T3 (voce #1641). Dove si apre una notifica: lo dice il registro dei prodotti (`notifiche` della voce), col tipo
// intero dell'evento e un percorso coi suoi segnaposto, e gli id li porta la notifica (`ids`, dalla parte server). La funzione è
// quella del pannello della cornice, esportata per chi mostra le notifiche in una pagina sua: un indirizzo, o niente quando il
// pannello apre la pagina delle notifiche. Parole e indirizzi del CRM sono di zr-crm (11/10/2026).

const prodotti: DatiDellaCornice['prodotti'] = { pm: 'attivo', crm: 'attivo', bookings: 'attivo', reports: 'attivo' };
const CRM = 'https://crm.zeiras.com/w/acme-marketing';
/** Una notifica del CRM come la dà GET /cornice/notifiche: il tipo senza `com.zeiras.crm.`, e gli id che porta. */
const delCrm = (tipo: string, ids?: unknown) => ({ id: 'uat-n1', creata_il: '2026-10-06T11:55:00Z', letta: false, app: 'crm', tipo: `com.zeiras.crm.${tipo}`, ids });
const apre = (notifica: Parameters<typeof destinazioneDellaNotifica>[0], stati = prodotti) => destinazioneDellaNotifica(notifica, 'acme-marketing', stati);

describe('la destinazione di una notifica', () => {
    it.each([
        ['persona.creata', { id: 'uat-persona-1' }, '/contatti/uat-persona-1'],
        ['persona.modificata', { id: 'uat-persona-1' }, '/contatti/uat-persona-1'],
        ['pipeline.creata', { id: 'uat-pipeline-1' }, '/pipeline/uat-pipeline-1/impostazioni'],
        ['pipeline.modificata', { id: 'uat-pipeline-1' }, '/pipeline/uat-pipeline-1/impostazioni'],
        // Una nota non ha una pagina sua: si apre il contatto a cui è attaccata, mai `/contatti/<id della nota>`.
        ['nota.creata', { id: 'uat-nota-1', persona_id: 'uat-persona-2' }, '/contatti/uat-persona-2'],
        ['nota.modificata', { id: 'uat-nota-1', persona_id: 'uat-persona-2' }, '/contatti/uat-persona-2'],
        ['nota.eliminata', { id: 'uat-nota-1', persona_id: 'uat-persona-2' }, '/contatti/uat-persona-2'],
        // Sprint 21 · T5: nel contratto un'azienda è una `organizzazione`; la pagina del CRM è `/aziende`, mai `/organizzazioni`.
        ['organizzazione.creata', { id: 'uat-azienda-1' }, '/aziende/uat-azienda-1'],
        ['organizzazione.modificata', { id: 'uat-azienda-1' }, '/aziende/uat-azienda-1'],
    ])('una notifica del CRM di tipo «%s» apre la sua risorsa nel CRM, dopo `/w/<slug>` del workspace (sprint 21 · T3.1, T5.2)', (tipo, ids, percorso) => {
        expect(apre(delCrm(tipo, ids))).toBe(CRM + percorso);
    });

    it('le nove destinazioni del CRM sono quelle del registro: nessun altro prodotto ne ha, e ogni tipo ha il suo percorso (sprint 21 · T3.1, T5.2)', () => {
        expect(registro.filter((voce) => voce.notifiche !== undefined).map((voce) => voce.id)).toStrictEqual(['crm']);
        expect(registro.find((voce) => voce.id === 'crm')?.notifiche).toStrictEqual([
            { tipo: 'com.zeiras.crm.persona.creata', percorso: '/contatti/{id}' },
            { tipo: 'com.zeiras.crm.persona.modificata', percorso: '/contatti/{id}' },
            { tipo: 'com.zeiras.crm.pipeline.creata', percorso: '/pipeline/{id}/impostazioni' },
            { tipo: 'com.zeiras.crm.pipeline.modificata', percorso: '/pipeline/{id}/impostazioni' },
            { tipo: 'com.zeiras.crm.nota.creata', percorso: '/contatti/{persona_id}' },
            { tipo: 'com.zeiras.crm.nota.modificata', percorso: '/contatti/{persona_id}' },
            { tipo: 'com.zeiras.crm.nota.eliminata', percorso: '/contatti/{persona_id}' },
            { tipo: 'com.zeiras.crm.organizzazione.creata', percorso: '/aziende/{id}' },
            { tipo: 'com.zeiras.crm.organizzazione.modificata', percorso: '/aziende/{id}' },
        ]);
    });

    it('un id di 64 caratteri fra lettere, cifre, - e _ passa com\'è, e gli id in più non contano (sprint 21 · T3.1)', () => {
        const lungo = `${'a'.repeat(31)}-B_9${'z'.repeat(29)}`;

        expect(lungo).toHaveLength(64);
        expect(apre(delCrm('persona.creata', { id: lungo, lista_id: 'uat-lista-1' }))).toBe(`${CRM}/contatti/${lungo}`);
        // Disponibile ma non ancora attivo: il modulo si può aprire, come dal menu.
        expect(apre(delCrm('persona.creata', { id: '42' }), { crm: 'disponibile' })).toBe(`${CRM}/contatti/42`);
    });

    // Review della PR #31, R7: lo slug entra nell'indirizzo solo con la forma che il contratto del backoffice gli dà
    // (`^[a-z0-9]+(-[a-z0-9]+)*$`). `encodeURIComponent` non tocca i punti: con `..` il browser aprirebbe un'altra pagina.
    it.each([['acme'], ['acme-marketing'], ['a'], ['9'], ['uat-marketing-2'], ['a-b-c']])('lo slug del workspace entra nell\'indirizzo com\'è: %s (sprint 21 · review della PR #31, R7)', (slug) => {
        expect(destinazioneDellaNotifica(delCrm('persona.creata', { id: 'uat-persona-1' }), slug, prodotti)).toBe(`https://crm.zeiras.com/w/${slug}/contatti/uat-persona-1`);
    });

    it.each<[string, unknown]>([
        ['vuoto', ''],
        ['uno spazio', ' '],
        ['un punto', '.'],
        ['due punti', '..'],
        ['../ davanti', '../acme'],
        ['con una barra', 'acme/marketing'],
        ['con un punto', 'acme.marketing'],
        ['con uno spazio', 'uat marketing'],
        ['con una maiuscola', 'Acme'],
        ['con un trattino basso', 'acme_marketing'],
        ['con un trattino davanti', '-acme'],
        ['con un trattino in fondo', 'acme-'],
        ['con due trattini di fila', 'acme--marketing'],
        ['con una lettera accentata', 'acmè'],
        ['con un a capo in fondo', 'acme\n'],
        ['con un punto di domanda', 'acme?x=1'],
        ['con un cancelletto', 'acme#x'],
        ['già codificato', 'acme%2Fmarketing'],
        ['che non è un testo: manca', undefined],
        ['che non è un testo: null', null],
        ['che non è un testo: un numero', 42],
    ])('senza uno slug con la forma di uno slug non c\'è un indirizzo, nemmeno a metà: %s (sprint 21 · review della PR #31, R7)', (_caso, slug) => {
        expect(destinazioneDellaNotifica(delCrm('persona.creata', { id: 'uat-persona-1' }), slug as string, prodotti)).toBeUndefined();
    });

    it.each([
        ['del workspace, senza app', { app: null, tipo: 'com.zeiras.workspace.membro.creato', ids: { id: 'uat-membro-1' } }],
        ['di Project Management', { app: 'pm', tipo: 'com.zeiras.board.scheda.creata', ids: { id: 'uat-scheda-1', board_id: 'uat-board-1' } }],
        ['del CRM, di un tipo che zr-core non conosce', delCrm('persona.assegnata', { id: 'uat-persona-1' })],
        ['del CRM, di un tipo che ne continua uno conosciuto', delCrm('persona.creata.v2', { id: 'uat-persona-1' })],
        ['del CRM, col solo pezzo di un tipo conosciuto', delCrm('persona', { id: 'uat-persona-1' })],
        // Il contratto non ha l'eliminazione di un'azienda, né un tipo `azienda`: la parola del modulo sta nel percorso, non nel tipo.
        ['del CRM, di un\'azienda eliminata, che il contratto non ha', delCrm('organizzazione.eliminata', { id: 'uat-azienda-1' })],
        ['del CRM, con `azienda` nel tipo', delCrm('azienda.creata', { id: 'uat-azienda-1' })],
        ['di una vista di una board, di Project Management', { app: 'pm', tipo: 'com.zeiras.board.vista.creata', ids: { id: 'uat-vista-1', board_id: 'uat-board-1' } }],
        ['del CRM, col tipo in maiuscole', { app: 'crm', tipo: 'COM.ZEIRAS.CRM.PERSONA.CREATA', ids: { id: 'uat-persona-1' } }],
        // La destinazione si cerca nella voce dell'app della notifica: un tipo del CRM con l'app di un altro prodotto non la trova.
        ['con un tipo del CRM ma l\'app di Project Management', { app: 'pm', tipo: 'com.zeiras.crm.persona.creata', ids: { id: 'uat-persona-1' } }],
        ['con un tipo del CRM ma senza app', { app: null, tipo: 'com.zeiras.crm.persona.creata', ids: { id: 'uat-persona-1' } }],
        ['con un tipo del CRM ma senza la chiave app', { tipo: 'com.zeiras.crm.persona.creata', ids: { id: 'uat-persona-1' } }],
        ['con un tipo del CRM e un\'app che il registro non ha', { app: 'uat-ignota', tipo: 'com.zeiras.crm.persona.creata', ids: { id: 'uat-persona-1' } }],
        ['con un tipo del CRM e l\'app della Dashboard', { app: 'home', tipo: 'com.zeiras.crm.persona.creata', ids: { id: 'uat-persona-1' } }],
        ['con un\'app che non è un testo', { app: 7, tipo: 'com.zeiras.crm.persona.creata', ids: { id: 'uat-persona-1' } }],
        ['del CRM, senza tipo', { app: 'crm', ids: { id: 'uat-persona-1' } }],
        ['del CRM, con un tipo che non è un testo', { app: 'crm', tipo: ['com.zeiras.crm.persona.creata'], ids: { id: 'uat-persona-1' } }],
    ])('una notifica %s non ha una destinazione nel registro: niente, e il pannello apre la pagina delle notifiche (sprint 21 · T3.2)', (_quale, notifica) => {
        expect(apre(notifica)).toBeUndefined();
    });

    // Sprint 22 · T5 (voce #1720): i nove tipi nuovi del CRM hanno un titolo e nessuna destinazione. La pagina di un'opportunità in
    // produzione è spenta e un'attività non ne ha una; per un contatto o un'azienda assegnati è una scelta di prodotto ancora da fare.
    // I quattro «assegnata» arrivano senza `com.zeiras.` davanti.
    it.each([
        ['com.zeiras.crm.trattativa.creata'], ['com.zeiras.crm.trattativa.modificata'],
        ['com.zeiras.crm.attivita.creata'], ['com.zeiras.crm.attivita.modificata'], ['com.zeiras.crm.attivita.eliminata'],
        ['crm.persona.assegnata'], ['crm.organizzazione.assegnata'], ['crm.trattativa.assegnata'], ['crm.attivita.assegnata'],
    ])('una notifica del CRM di tipo «%s» non apre una risorsa, nemmeno con tutti gli id: il pannello apre la pagina delle notifiche (sprint 22 · T5.3)', (tipo) => {
        const ids = { id: 'uat-x-1', persona_id: 'uat-x-2', organizzazione_id: 'uat-x-3', trattativa_id: 'uat-x-4' };

        expect(apre({ app: 'crm', tipo, ids })).toBeUndefined();
    });

    it.each([
        ['una nota senza `persona_id`', delCrm('nota.creata', { id: 'uat-nota-1' })],
        ['una nota col `persona_id` malfatto e l\'id buono', delCrm('nota.creata', { id: 'uat-nota-1', persona_id: '../x' })],
        ['senza `ids`, come da una parte server di prima', delCrm('persona.creata')],
        ['`ids` null', delCrm('persona.creata', null)],
        ['`ids` vuoto', delCrm('persona.creata', {})],
        ['`ids` è una lista', delCrm('persona.creata', ['uat-persona-1'])],
        ['`ids` è un testo', delCrm('persona.creata', 'uat-persona-1')],
        ['`ids` è un numero', delCrm('persona.creata', 7)],
        // Un id che `ids` ha solo per eredità non è suo.
        ['l\'id è ereditato', delCrm('persona.creata', Object.create({ id: 'uat-persona-1' }))],
        ['l\'id è vuoto', delCrm('persona.creata', { id: '' })],
        ['l\'id è un numero', delCrm('persona.creata', { id: 42 })],
        ['l\'id è null', delCrm('persona.creata', { id: null })],
        ['l\'id è true', delCrm('persona.creata', { id: true })],
        ['l\'id è un oggetto', delCrm('persona.creata', { id: { id: 'uat-persona-1' } })],
        ['l\'id è una lista', delCrm('persona.creata', { id: ['uat-persona-1'] })],
        ['l\'id è ../x', delCrm('persona.creata', { id: '../x' })],
        ['l\'id ha una barra', delCrm('persona.creata', { id: 'uat-persona-1/x' })],
        ['l\'id ha un punto di domanda', delCrm('persona.creata', { id: 'uat-persona-1?x=1' })],
        ['l\'id ha un cancelletto', delCrm('persona.creata', { id: 'uat-persona-1#x' })],
        ['l\'id ha uno spazio', delCrm('persona.creata', { id: 'uat persona' })],
        ['l\'id ha un punto', delCrm('persona.creata', { id: 'uat.persona' })],
        ['l\'id ha una barra già codificata', delCrm('persona.creata', { id: 'uat%2Fpersona' })],
        ['l\'id ha un a capo in fondo', delCrm('persona.creata', { id: 'uat-persona-1\n' })],
        ['l\'id ha una lettera accentata', delCrm('persona.creata', { id: 'uat-personà' })],
        ['l\'id è lungo 65 caratteri', delCrm('persona.creata', { id: 'a'.repeat(65) })],
        ['la pipeline ha solo `pipeline_id`', delCrm('pipeline.creata', { pipeline_id: 'uat-pipeline-1' })],
        ['l\'azienda ha solo `organizzazione_id`', delCrm('organizzazione.creata', { organizzazione_id: 'uat-azienda-1' })],
        ['l\'azienda ha un id con una barra', delCrm('organizzazione.modificata', { id: 'uat-azienda-1/x' })],
    ])('una notifica del CRM a cui manca l\'id che il percorso chiede, o che ne ha uno che non ha la forma di un id, non ha una destinazione — %s (sprint 21 · T3.3)', (_quale, notifica) => {
        expect(apre(notifica)).toBeUndefined();
    });

    it.each([
        ['il backoffice lo dà in arrivo', { pm: 'attivo', crm: 'in_arrivo' }],
        ['i dati non lo elencano', { pm: 'attivo' }],
        ['il suo stato è scritto `undefined`', { pm: 'attivo', crm: undefined }],
        ['ha uno stato che zr-core non conosce', { pm: 'attivo', crm: 'sospeso' }],
        ['nessun modulo è elencato', {}],
    ])('una notifica del CRM in un workspace dove il CRM non si può aprire non ha una destinazione — %s (sprint 21 · T3.4)', (_quale, stati) => {
        expect(apre(delCrm('persona.creata', { id: 'uat-persona-1' }), stati as DatiDellaCornice['prodotti'])).toBeUndefined();
        expect(apre(delCrm('nota.eliminata', { id: 'uat-nota-1', persona_id: 'uat-persona-2' }), stati as DatiDellaCornice['prodotti'])).toBeUndefined();
    });
});

describe('la destinazione di una notifica, con un registro di prova', () => {
    afterEach(() => {
        vi.doUnmock('../registro/prodotti.json');
        vi.resetModules();
    });

    /** La funzione letta con un registro di prova: un prodotto «Presto» con una notifica, e uno aperto con un percorso a due id. */
    async function conUnRegistroDiProva() {
        vi.resetModules();
        vi.doMock('../registro/prodotti.json', () => ({
            default: {
                prodotti: [
                    { id: 'home', icona: 'grid', indirizzo: 'https://app.zeiras.com', presto: false, in_arrivo: false },
                    {
                        id: 'crm', icona: 'users', tono: 'sky', indirizzo: 'https://crm.zeiras.com', presto: true, in_arrivo: true,
                        notifiche: [{ tipo: 'com.zeiras.crm.persona.creata', percorso: '/contatti/{id}' }],
                    },
                    {
                        id: 'bookings', icona: 'calendar', tono: 'sky', indirizzo: 'https://bookings.zeiras.com', presto: false, in_arrivo: true,
                        notifiche: [
                            { tipo: 'com.zeiras.bookings.uat.scheda', percorso: '/b/{board_id}/c/{id}' },
                            { tipo: 'com.zeiras.bookings.uat.elenco', percorso: '/elenco' },
                        ],
                    },
                ],
            },
        }));

        return (await import('./notifiche')).destinazioneDellaNotifica;
    }

    it('un prodotto che il registro dà «Presto» non si apre, nemmeno se il backoffice lo dà attivo (sprint 21 · T3.4)', async () => {
        const destinazione = await conUnRegistroDiProva();
        const stati: DatiDellaCornice['prodotti'] = { crm: 'attivo', bookings: 'attivo' };

        expect(destinazione({ app: 'crm', tipo: 'com.zeiras.crm.persona.creata', ids: { id: 'uat-persona-1' } }, 'acme-marketing', stati)).toBeUndefined();
        // Lo stesso registro, un prodotto che non è «Presto»: la destinazione c'è, e il registro letto è quello di prova.
        expect(destinazione({ app: 'bookings', tipo: 'com.zeiras.bookings.uat.elenco', ids: {} }, 'acme-marketing', stati)).toBe('https://bookings.zeiras.com/w/acme-marketing/elenco');
    });

    it('un percorso con due segnaposto vuole tutti e due gli id: con uno solo non c\'è un indirizzo, nemmeno a metà (sprint 21 · T3.3)', async () => {
        const destinazione = await conUnRegistroDiProva();
        const stati: DatiDellaCornice['prodotti'] = { bookings: 'attivo' };
        const scheda = (ids: unknown) => destinazione({ app: 'bookings', tipo: 'com.zeiras.bookings.uat.scheda', ids }, 'acme-marketing', stati);

        expect(scheda({ id: 'uat-scheda-1', board_id: 'uat-board-1' })).toBe('https://bookings.zeiras.com/w/acme-marketing/b/uat-board-1/c/uat-scheda-1');
        expect(scheda({ id: 'uat-scheda-1' })).toBeUndefined();
        expect(scheda({ board_id: 'uat-board-1' })).toBeUndefined();
        expect(scheda({ id: 'uat-scheda-1', board_id: '../x' })).toBeUndefined();
        expect(scheda({ id: '{board_id}', board_id: 'uat-board-1' })).toBeUndefined();
    });
});
