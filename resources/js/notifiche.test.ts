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

    // Sprint 23 · T3: una nota ha tre percorsi, dal più specifico: l'opportunità, poi (`altrimenti`) il contatto, poi l'azienda.
    // Un'attività non ha una pagina sua: apre «Da fare», un percorso senza un id.
    it('le venti destinazioni del CRM sono quelle del registro (dalla `v2.7.0` anche i due motivi di perdita: sprint 41 · T2.1), e ogni tipo ha il suo percorso; ne ha quattro anche Project Management, tre di una scheda e una di una menzione in un commento, e nessun altro prodotto (sprint 21 · T3.1, T5.2; sprint 23 · T3.1-T3.4; sprint 24 · T3.4; sprint 26 · T6.2)', () => {
        const dellaNota = { percorso: '/opportunita/{trattativa_id}', altrimenti: ['/contatti/{persona_id}', '/aziende/{organizzazione_id}'] };

        expect(registro.filter((voce) => voce.notifiche !== undefined).map((voce) => voce.id)).toStrictEqual(['pm', 'crm']);
        // Sprint 24 · T3 (voce #1748): una scheda nuova, modificata o assegnata, e nessun altro tipo della board.
        // Sprint 26 · T6 (voce #1773): la quarta, una menzione in un commento, apre la scheda del commento.
        expect(registro.find((voce) => voce.id === 'pm')?.notifiche).toStrictEqual([
            { tipo: 'com.zeiras.board.scheda.creata', percorso: '/c/{id}' },
            { tipo: 'com.zeiras.board.scheda.modificata', percorso: '/c/{id}' },
            { tipo: 'board.scheda.assegnata', percorso: '/c/{id}' },
            { tipo: 'board.commento.menzione', percorso: '/c/{id}' },
        ]);
        expect(registro.find((voce) => voce.id === 'crm')?.notifiche).toStrictEqual([
            { tipo: 'com.zeiras.crm.persona.creata', percorso: '/contatti/{id}' },
            { tipo: 'com.zeiras.crm.persona.modificata', percorso: '/contatti/{id}' },
            { tipo: 'com.zeiras.crm.pipeline.creata', percorso: '/pipeline/{id}/impostazioni' },
            { tipo: 'com.zeiras.crm.pipeline.modificata', percorso: '/pipeline/{id}/impostazioni' },
            { tipo: 'com.zeiras.crm.motivo.creato', percorso: '/impostazioni' },
            { tipo: 'com.zeiras.crm.motivo.modificato', percorso: '/impostazioni' },
            { tipo: 'com.zeiras.crm.nota.creata', ...dellaNota },
            { tipo: 'com.zeiras.crm.nota.modificata', ...dellaNota },
            { tipo: 'com.zeiras.crm.nota.eliminata', ...dellaNota },
            { tipo: 'com.zeiras.crm.organizzazione.creata', percorso: '/aziende/{id}' },
            { tipo: 'com.zeiras.crm.organizzazione.modificata', percorso: '/aziende/{id}' },
            { tipo: 'com.zeiras.crm.trattativa.creata', percorso: '/opportunita/{id}' },
            { tipo: 'com.zeiras.crm.trattativa.modificata', percorso: '/opportunita/{id}' },
            { tipo: 'crm.trattativa.assegnata', percorso: '/opportunita/{id}' },
            { tipo: 'com.zeiras.crm.attivita.creata', percorso: '/da-fare' },
            { tipo: 'com.zeiras.crm.attivita.modificata', percorso: '/da-fare' },
            { tipo: 'com.zeiras.crm.attivita.eliminata', percorso: '/da-fare' },
            { tipo: 'crm.attivita.assegnata', percorso: '/da-fare' },
            { tipo: 'crm.persona.assegnata', percorso: '/contatti/{id}' },
            { tipo: 'crm.organizzazione.assegnata', percorso: '/aziende/{id}' },
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
        // Sprint 24 · T3: una scheda nuova, modificata o assegnata ora si apre (più sotto). Di Project Management restano senza una
        // destinazione una scheda eliminata, gli altri tipi della board, e i tipi scritti quasi come quelli del registro.
        ['di una scheda eliminata, di Project Management', { app: 'pm', tipo: 'com.zeiras.board.scheda.eliminata', ids: { id: 'uat-scheda-1', board_id: 'uat-board-1' } }],
        ['di una lista di una board', { app: 'pm', tipo: 'com.zeiras.board.lista.creata', ids: { id: 'uat-lista-1', board_id: 'uat-board-1' } }],
        ['di una board modificata', { app: 'pm', tipo: 'com.zeiras.board.board.modificata', ids: { id: 'uat-board-1' } }],
        ['di una scheda assegnata, con `com.zeiras.` davanti', { app: 'pm', tipo: 'com.zeiras.board.scheda.assegnata', ids: { id: 'uat-scheda-1' } }],
        ['di una scheda nuova, senza `com.zeiras.` davanti', { app: 'pm', tipo: 'board.scheda.creata', ids: { id: 'uat-scheda-1' } }],
        ['di una scheda assegnata, con l\'app del CRM', { app: 'crm', tipo: 'board.scheda.assegnata', ids: { id: 'uat-scheda-1' } }],
        ['di una scheda assegnata, senza app', { app: null, tipo: 'board.scheda.assegnata', ids: { id: 'uat-scheda-1' } }],
        // Sprint 26 · T6 (voce #1773): una menzione in un commento si apre (più sotto) solo col suo tipo intero, senza
        // `com.zeiras.` davanti, e nella voce di Project Management.
        ['di una menzione in un commento, con `com.zeiras.` davanti', { app: 'pm', tipo: 'com.zeiras.board.commento.menzione', ids: { id: 'uat-scheda-1' } }],
        ['di un commento, col solo pezzo del tipo della menzione', { app: 'pm', tipo: 'board.commento', ids: { id: 'uat-scheda-1' } }],
        ['di una menzione in un commento, con un pezzo in più in fondo', { app: 'pm', tipo: 'board.commento.menzione.poi', ids: { id: 'uat-scheda-1' } }],
        ['di una menzione in un commento, con l\'app del CRM', { app: 'crm', tipo: 'board.commento.menzione', ids: { id: 'uat-scheda-1' } }],
        ['di una menzione in un commento, senza app', { app: null, tipo: 'board.commento.menzione', ids: { id: 'uat-scheda-1' } }],
        ['del CRM, di un tipo che zr-core non conosce', delCrm('persona.assegnata', { id: 'uat-persona-1' })],
        ['del CRM, di un tipo che ne continua uno conosciuto', delCrm('persona.creata.v2', { id: 'uat-persona-1' })],
        ['del CRM, col solo pezzo di un tipo conosciuto', delCrm('persona', { id: 'uat-persona-1' })],
        // Il contratto non ha l'eliminazione di un'azienda, né un tipo `azienda`: la parola del modulo sta nel percorso, non nel tipo.
        ['del CRM, di un\'azienda eliminata, che il contratto non ha', delCrm('organizzazione.eliminata', { id: 'uat-azienda-1' })],
        // Sprint 23 · T3: un tipo `eliminata` di una risorsa con una pagina sua non è nel registro, e il tipo si cerca intero —
        // un «assegnata» non ha `com.zeiras.` davanti, un evento sì.
        ['del CRM, di un\'opportunità eliminata, che aprirebbe una pagina che non c\'è', delCrm('trattativa.eliminata', { id: 'uat-opp-1' })],
        ['del CRM, di un\'opportunità assegnata, con `com.zeiras.` davanti', delCrm('trattativa.assegnata', { id: 'uat-opp-1' })],
        ['del CRM, di un\'opportunità nuova, senza `com.zeiras.` davanti', { app: 'crm', tipo: 'crm.trattativa.creata', ids: { id: 'uat-opp-1' } }],
        ['del CRM, di un\'attività nuova, senza `com.zeiras.` davanti', { app: 'crm', tipo: 'crm.attivita.creata', ids: {} }],
        ['di un\'attività assegnata, con l\'app di Project Management', { app: 'pm', tipo: 'crm.attivita.assegnata', ids: {} }],
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

    // Sprint 23 · T3 (voce #1743). I nove tipi che dallo sprint 22 (T5, voce #1720) avevano un titolo e nessuna destinazione ora
    // aprono la loro risorsa, coi nomi delle pagine di zr-crm (nota 10406 del #95): un'opportunità `/opportunita/<id>` — nel
    // contratto è una `trattativa`, e `/trattative` in un indirizzo è il difetto —, un contatto o un'azienda assegnati la loro
    // pagina. I quattro «assegnata» arrivano senza `com.zeiras.` davanti. Resta ciò che il caso di prima provava per gli altri id:
    // conta solo quello che il percorso chiede.
    it.each([
        ['com.zeiras.crm.trattativa.creata', '/opportunita/uat-risorsa-1'],
        ['com.zeiras.crm.trattativa.modificata', '/opportunita/uat-risorsa-1'],
        ['crm.trattativa.assegnata', '/opportunita/uat-risorsa-1'],
        ['crm.persona.assegnata', '/contatti/uat-risorsa-1'],
        ['crm.organizzazione.assegnata', '/aziende/uat-risorsa-1'],
    ])('una notifica del CRM di tipo «%s» apre la sua risorsa, con l\'`id` che porta; senza, o con un id fuori forma, il pannello apre la pagina delle notifiche (sprint 23 · T3.1, T3.3)', (tipo, percorso) => {
        expect(apre({ app: 'crm', tipo, ids: { id: 'uat-risorsa-1' } })).toBe(CRM + percorso);
        expect(apre({ app: 'crm', tipo, ids: { id: 'uat-risorsa-1', persona_id: 'uat-x-2', organizzazione_id: 'uat-x-3', trattativa_id: 'uat-x-4' } })).toBe(CRM + percorso);
        // Gli altri id non prendono il posto di quello che il percorso chiede.
        expect(apre({ app: 'crm', tipo, ids: { persona_id: 'uat-x-2', organizzazione_id: 'uat-x-3', trattativa_id: 'uat-x-4' } })).toBeUndefined();
        expect(apre({ app: 'crm', tipo, ids: {} })).toBeUndefined();
        expect(apre({ app: 'crm', tipo, ids: { id: '../x' } })).toBeUndefined();
    });

    // Un'attività non ha una pagina sua: la sua notifica apre «Da fare», e il suo id non entra mai in un indirizzo. Dalla parte
    // server `ids` arriva vuoto, perché il percorso non ha un segnaposto; chi mostra le notifiche in una pagina sua può darle di più.
    it.each([
        ['com.zeiras.crm.attivita.creata'], ['com.zeiras.crm.attivita.modificata'], ['com.zeiras.crm.attivita.eliminata'], ['crm.attivita.assegnata'],
    ])('una notifica di un\'attività, di tipo «%s», apre la pagina «Da fare» del CRM, e l\'id dell\'attività non entra nell\'indirizzo (sprint 23 · T3.2)', (tipo) => {
        expect(apre({ app: 'crm', tipo, ids: {} })).toBe(`${CRM}/da-fare`);
        expect(apre({ app: 'crm', tipo, ids: { id: 'uat-attivita-1' } })).toBe(`${CRM}/da-fare`);
        expect(apre({ app: 'crm', tipo, ids: null })).toBe(`${CRM}/da-fare`);
        expect(apre({ app: 'crm', tipo })).toBe(`${CRM}/da-fare`);
        // Il resto vale come per ogni destinazione: lo slug con la forma di uno slug, e un modulo che si può aprire.
        expect(destinazioneDellaNotifica({ app: 'crm', tipo, ids: {} }, 'Acme', prodotti)).toBeUndefined();
        expect(apre({ app: 'crm', tipo, ids: {} }, { crm: 'in_arrivo' })).toBeUndefined();
    });

    // Sprint 41 · T2.1 (voce #1997): dalla `v2.7.0` un motivo di perdita creato o modificato apre le Impostazioni del CRM, dove i
    // motivi stanno (zr-crm, 13/10/2026): `/impostazioni` dopo `/w/<slug>`, un percorso senza segnaposto, e quindi senza id.
    it.each([['com.zeiras.crm.motivo.creato'], ['com.zeiras.crm.motivo.modificato']])('una notifica di un motivo di perdita, di tipo «%s», apre le Impostazioni del CRM nel workspace, con o senza id (sprint 41 · T2.1)', (tipo) => {
        expect(apre({ app: 'crm', tipo, ids: {} })).toBe(`${CRM}/impostazioni`);
        expect(apre({ app: 'crm', tipo, ids: { id: 'uat-motivo-1' } })).toBe(`${CRM}/impostazioni`);
        expect(apre({ app: 'crm', tipo, ids: null })).toBe(`${CRM}/impostazioni`);
        expect(apre({ app: 'crm', tipo })).toBe(`${CRM}/impostazioni`);
        // Il resto vale come per ogni destinazione: lo slug con la forma di uno slug, e un modulo che si può aprire.
        expect(destinazioneDellaNotifica({ app: 'crm', tipo, ids: {} }, 'Acme', prodotti)).toBeUndefined();
        expect(apre({ app: 'crm', tipo, ids: {} }, { crm: 'in_arrivo' })).toBeUndefined();
    });

    // Sprint 41 · T2.2: la riga vale per quei due tipi interi, non per ogni tipo dei motivi né per tutto il CRM.
    it.each([['com.zeiras.crm.motivo.eliminato'], ['com.zeiras.crm.motivo'], ['crm.motivo.creato'], ['com.zeiras.crm.motivo.creato.x'], ['com.zeiras.crm.persona.eliminata']])('una notifica del CRM di tipo «%s», che il registro non ha, resta senza destinazione (sprint 41 · T2.2)', (tipo) => {
        expect(apre({ app: 'crm', tipo, ids: {} })).toBeUndefined();
        expect(apre({ app: 'crm', tipo, ids: { id: 'uat-motivo-1' } })).toBeUndefined();
    });

    // Sprint 24 · T3 (voce #1748). Project Management ha le sue prime destinazioni: una scheda nuova, modificata o assegnata a
    // chi riceve la notifica apre la pagina della scheda in zr-board, `/c/<id>` dopo `/w/<slug>` (zr-board, nota 10451 del #95:
    // quella pagina legge la scheda e rimanda al suo dettaglio nella board). «assegnata» non è un evento: arriva senza
    // `com.zeiras.` davanti. L'id è quello della scheda, `id`: la board e la lista non prendono il suo posto.
    // Sprint 26 · T6 (voce #1773): la quarta è la notifica a chi viene menzionato in un commento, che non è un evento nemmeno
    // lei. Apre la scheda del commento, con lo stesso `id`.
    const BOARD = 'https://board.zeiras.com/w/acme-marketing';
    const diUnaScheda = [['board.scheda.assegnata'], ['com.zeiras.board.scheda.creata'], ['com.zeiras.board.scheda.modificata'], ['board.commento.menzione']];

    it.each(diUnaScheda)('una notifica di Project Management di tipo «%s» apre la scheda, con l\'`id` che porta, dopo `/w/<slug>` del workspace che si dà (sprint 24 · T3.2, T3.4)', (tipo) => {
        expect(apre({ app: 'pm', tipo, ids: { id: 'uat-scheda-1' } })).toBe(`${BOARD}/c/uat-scheda-1`);
        // Un evento, per il contratto, porta anche la lista e la board: conta solo l'id della scheda.
        expect(apre({ app: 'pm', tipo, ids: { id: '01jb2m5k8q9r7s6t4v3w2x1y0z', lista_id: 'uat-lista-1', board_id: 'uat-board-1' } })).toBe(`${BOARD}/c/01jb2m5k8q9r7s6t4v3w2x1y0z`);
        // Lo slug è quello che si dà, il workspace dell'elenco: non un altro.
        expect(destinazioneDellaNotifica({ app: 'pm', tipo, ids: { id: 'uat-scheda-1' } }, 'acme-vendite', prodotti)).toBe('https://board.zeiras.com/w/acme-vendite/c/uat-scheda-1');
        // Disponibile ma non ancora attivo: il modulo si può aprire, come dal menu.
        expect(apre({ app: 'pm', tipo, ids: { id: 'uat-scheda-1' } }, { pm: 'disponibile' })).toBe(`${BOARD}/c/uat-scheda-1`);
    });

    it.each(diUnaScheda)('una notifica di una scheda, di tipo «%s», senza l\'id o con un id fuori forma non ha una destinazione: mai un indirizzo con dentro quell\'id, e la board o la lista non lo sostituiscono (sprint 24 · T3.3)', (tipo) => {
        const conId = (id: unknown) => apre({ app: 'pm', tipo, ids: { id } });
        const fuoriForma: unknown[] = ['..', '../x', 'uat-scheda-1/x', 'uat scheda', 'uat.scheda', 'uat%2Fscheda', '', 'a'.repeat(65), 42, null, undefined, ['uat-scheda-1']];

        expect(fuoriForma.map(conId)).toStrictEqual(fuoriForma.map(() => undefined));
        // Il più lungo che passa è di 64 caratteri.
        expect(conId('a'.repeat(64))).toBe(`${BOARD}/c/${'a'.repeat(64)}`);
        expect(apre({ app: 'pm', tipo, ids: { board_id: 'uat-board-1', lista_id: 'uat-lista-1' } })).toBeUndefined();
        expect(apre({ app: 'pm', tipo, ids: {} })).toBeUndefined();
        expect(apre({ app: 'pm', tipo, ids: null })).toBeUndefined();
        expect(apre({ app: 'pm', tipo })).toBeUndefined();
    });

    it.each([
        ['il backoffice lo dà in arrivo', { pm: 'in_arrivo', crm: 'attivo' }],
        ['i dati non lo elencano', { crm: 'attivo' }],
        ['nessun modulo è elencato', {}],
    ])('una notifica di una scheda in un workspace dove Project Management non si può aprire non ha una destinazione — %s (sprint 24 · T3.2)', (_quale, stati) => {
        expect(diUnaScheda.map(([tipo]) => apre({ app: 'pm', tipo, ids: { id: 'uat-scheda-1' } }, stati as DatiDellaCornice['prodotti']))).toStrictEqual([undefined, undefined, undefined, undefined]);
    });

    // Sprint 26 · T6 (voce #1773). La notifica a chi viene menzionato in un commento porta nei `dati` l'id della scheda e quello
    // del commento. Si apre la scheda: zr-board non ha un indirizzo che porti dritto a un commento (nota 10846 del #95), e la
    // parte server dà al browser il solo `id`. Se `commento_id` arrivasse, nell'indirizzo non entrerebbe.
    it('una menzione in un commento apre la scheda, `/c/<id>` con l\'id della scheda: `commento_id` non entra nell\'indirizzo, e da solo non apre niente (sprint 26 · T6.2)', () => {
        const menzione = (ids: Record<string, unknown>) => apre({ app: 'pm', tipo: 'board.commento.menzione', ids });

        expect(menzione({ id: 'uat-scheda-1' })).toBe(`${BOARD}/c/uat-scheda-1`);
        expect(menzione({ id: 'uat-scheda-1', commento_id: 'uat-commento-9' })).toBe(`${BOARD}/c/uat-scheda-1`);
        expect(menzione({ commento_id: 'uat-commento-9' })).toBeUndefined();
    });

    // Una nota non ha una pagina sua, e può essere legata a più cose: si apre la più specifica (decisione di zr-pm, nota 10252
    // del #95, punto 3) — l'opportunità, poi il contatto, poi l'azienda. Un legame che manca nel contratto è `null`. Dalla parte
    // server arrivano i soli id del percorso che si apre; qui la regola è la stessa anche con tutti e tre.
    describe.each(['creata', 'modificata', 'eliminata'])('una nota %s', (quando) => {
        const nota = (ids: unknown) => apre(delCrm(`nota.${quando}`, ids));

        it.each<[string, Record<string, unknown>, string]>([
            ['legata a un\'opportunità, a un contatto e a un\'azienda apre l\'opportunità', { trattativa_id: 'uat-opp-1', persona_id: 'uat-persona-2', organizzazione_id: 'uat-azienda-3' }, '/opportunita/uat-opp-1'],
            ['legata a un\'opportunità e a un contatto apre l\'opportunità', { trattativa_id: 'uat-opp-1', persona_id: 'uat-persona-2' }, '/opportunita/uat-opp-1'],
            ['con la sola opportunità, come la dà la parte server, apre l\'opportunità', { trattativa_id: 'uat-opp-1' }, '/opportunita/uat-opp-1'],
            ['legata a un contatto e a un\'azienda apre il contatto', { trattativa_id: null, persona_id: 'uat-persona-2', organizzazione_id: 'uat-azienda-3' }, '/contatti/uat-persona-2'],
            ['col solo contatto apre il contatto', { persona_id: 'uat-persona-2' }, '/contatti/uat-persona-2'],
            ['con la sola azienda apre l\'azienda', { trattativa_id: null, persona_id: null, organizzazione_id: 'uat-azienda-3' }, '/aziende/uat-azienda-3'],
            ['con l\'opportunità fuori forma e il contatto buono apre il contatto', { trattativa_id: '../x', persona_id: 'uat-persona-2', organizzazione_id: 'uat-azienda-3' }, '/contatti/uat-persona-2'],
            ['con opportunità e contatto fuori forma e l\'azienda buona apre l\'azienda', { trattativa_id: 'uat/opp', persona_id: '..', organizzazione_id: 'uat-azienda-3' }, '/aziende/uat-azienda-3'],
            ['con un\'opportunità che è un numero e il contatto buono apre il contatto', { trattativa_id: 42, persona_id: 'uat-persona-2' }, '/contatti/uat-persona-2'],
        ])('%s (sprint 23 · T3.4)', (_quale, legami, percorso) => {
            expect(nota({ id: 'uat-nota-1', ...legami })).toBe(CRM + percorso);
            expect(nota(legami)).toBe(CRM + percorso);
        });

        it.each<[string, unknown]>([
            ['senza legami, col solo suo id', { id: 'uat-nota-1' }],
            ['coi tre legami `null`', { id: 'uat-nota-1', trattativa_id: null, persona_id: null, organizzazione_id: null }],
            ['coi tre legami fuori forma', { id: 'uat-nota-1', trattativa_id: '../x', persona_id: 'uat/persona', organizzazione_id: '' }],
            ['senza `ids`', undefined],
        ])('%s non ha una destinazione, e l\'id della nota non apre niente (sprint 23 · T3.4)', (_quale, ids) => {
            expect(nota(ids)).toBeUndefined();
        });
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

    /**
     * La funzione letta con un registro di prova: un prodotto «Presto» con una notifica, e uno aperto con un percorso a due id e
     * con due tipi che hanno più percorsi (`altrimenti`).
     */
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
                            { tipo: 'com.zeiras.bookings.uat.scelta', percorso: '/b/{board_id}/c/{id}', altrimenti: ['/b/{board_id}', '/elenco'] },
                            { tipo: 'com.zeiras.bookings.uat.due', percorso: '/a/{primo_id}', altrimenti: ['/b/{secondo_id}/c/{id}'] },
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

    it('con più percorsi si apre il primo che ha tutti i suoi id, nell\'ordine del registro — `percorso`, poi `altrimenti` —: un percorso a metà si scarta intero, e senza nessuno non c\'è un indirizzo (sprint 23 · T3.4)', async () => {
        const destinazione = await conUnRegistroDiProva();
        const stati: DatiDellaCornice['prodotti'] = { bookings: 'attivo' };
        const B = 'https://bookings.zeiras.com/w/acme-marketing';
        const scelta = (ids?: unknown) => destinazione({ app: 'bookings', tipo: 'com.zeiras.bookings.uat.scelta', ids }, 'acme-marketing', stati);
        const due = (ids: unknown) => destinazione({ app: 'bookings', tipo: 'com.zeiras.bookings.uat.due', ids }, 'acme-marketing', stati);

        expect(scelta({ id: 'uat-scheda-1', board_id: 'uat-board-1' })).toBe(`${B}/b/uat-board-1/c/uat-scheda-1`);
        // Manca l'id della scheda, o è fuori forma: il primo percorso si scarta intero, e si apre la board.
        expect(scelta({ board_id: 'uat-board-1' })).toBe(`${B}/b/uat-board-1`);
        expect(scelta({ id: '../x', board_id: 'uat-board-1' })).toBe(`${B}/b/uat-board-1`);
        // Senza la board resta l'elenco, che non chiede un id: mai `/b//c/uat-scheda-1`.
        expect(scelta({ id: 'uat-scheda-1' })).toBe(`${B}/elenco`);
        expect(scelta({ id: 'uat-scheda-1', board_id: 'uat/board' })).toBe(`${B}/elenco`);
        expect(scelta({})).toBe(`${B}/elenco`);
        expect(scelta()).toBe(`${B}/elenco`);
        // Due percorsi che chiedono tutti e due un id: vince il primo quando c'è, e senza gli id di nessuno non c'è un indirizzo.
        expect(due({ primo_id: 'uat-1' })).toBe(`${B}/a/uat-1`);
        expect(due({ primo_id: 'uat-1', secondo_id: 'uat-2', id: 'uat-3' })).toBe(`${B}/a/uat-1`);
        expect(due({ secondo_id: 'uat-2', id: 'uat-3' })).toBe(`${B}/b/uat-2/c/uat-3`);
        expect(due({ primo_id: 'uat/1', secondo_id: 'uat-2', id: 'uat-3' })).toBe(`${B}/b/uat-2/c/uat-3`);
        expect(due({ secondo_id: 'uat-2' })).toBeUndefined();
        expect(due({ id: 'uat-3' })).toBeUndefined();
        expect(due({})).toBeUndefined();
    });
});
