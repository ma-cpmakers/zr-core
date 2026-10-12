import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import inglese from '../lingue/en.json';

// Sprint 11 · T3 (voce #1458). Le rotte finte delle pagine di prova rispondono nella forma della parte server, e la parte server
// dice quando: l'elenco delle notifiche quando ha cominciato a leggerlo (`aggiornati_il`), «segna tutte come lette» quando le ha
// segnate (`segnate_il`). La pagina di prova del layout dà alle rotte l'orologio dei suoi dati. Se una rotta non dicesse il suo
// istante, o lo prendesse nel momento sbagliato, le righe della UAT su una risposta letta prima di un'azione e arrivata dopo non
// distinguerebbero più; e senza orologio (`?segno=no`, e la pagina di prova della `Cornice`) le risposte restano quelle della
// `v1.2.1`, senza istanti.

describe('le rotte finte delle notifiche dicono quando, sull\'orologio che la pagina di prova dà', () => {
    const fetchDiPrima = window.fetch;

    beforeEach(() => {
        // Le rotte tengono lo stato delle notifiche d'esempio: un modulo nuovo a ogni test. Solo l'attesa delle risposte è finta.
        vi.resetModules();
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        vi.spyOn(console, 'info').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        window.fetch = fetchDiPrima;
    });

    /**
     * Le rotte finte al posto di `fetch`, nel workspace `uat-marketing`, con un orologio che conta gli istanti che dà (il primo
     * finisce per 000001Z, il secondo per 000002Z) o senza. Dà l'orologio: il test lo legge come farebbe un'altra lettura.
     */
    async function rotte(conOrologio: boolean, query = ''): Promise<() => string> {
        // Le rotte leggono la query della pagina quando il modulo si carica: ogni test ha la sua, e senza non ne resta una di prima.
        (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(`https://uat.example.com/${query}`);
        const { rotteFinte } = await import('./rotte-finte');
        let dati = 0;
        const istante = () => `2026-10-10T00:00:00.${String(++dati).padStart(6, '0')}Z`;
        rotteFinte(() => 'uat-marketing', conOrologio ? istante : undefined);

        return istante;
    }

    /** La risposta di una rotta, che ci mette 800 ms: `nelFrattempo` gira quando la richiesta è arrivata e la risposta aspetta. */
    async function rispostaDi(indirizzo: string, opzioni?: RequestInit, nelFrattempo = () => {}): Promise<{ stato: number; corpo: Record<string, unknown> }> {
        const inArrivo = fetch(indirizzo, opzioni);
        nelFrattempo();
        await vi.advanceTimersByTimeAsync(800);
        const risposta = await inArrivo;

        return { stato: risposta.status, corpo: (await risposta.json()) as Record<string, unknown> };
    }

    /** «Segna tutte come lette» fino a adesso, dalla pagina di quel workspace. */
    const segnaTutte = (workspace = 'uat-marketing', finoA = new Date().toISOString()): RequestInit => ({ method: 'POST', body: JSON.stringify({ fino_a: finoA, workspace }) });

    it('GET /cornice/notifiche porta in aggiornati_il l\'istante in cui la richiesta è arrivata, non quello in cui la risposta parte: una lettura fatta mentre la risposta aspetta è più avanti (sprint 11 · T3.1)', async () => {
        const istante = await rotte(true);
        let nelFrattempo = '';

        const { stato, corpo } = await rispostaDi('/cornice/notifiche', undefined, () => {
            nelFrattempo = istante();
        });

        expect(stato).toBe(200);
        expect(Object.keys(corpo)).toEqual(['data', 'aggiornati_il', 'workspace']);
        expect(corpo.data).toHaveLength(4);
        expect(corpo.aggiornati_il).toBe('2026-10-10T00:00:00.000001Z');
        expect(nelFrattempo).toBe('2026-10-10T00:00:00.000002Z');
    });

    it('POST /cornice/notifiche/letture porta in segnate_il l\'istante in cui risponde, a notifiche segnate: una lettura fatta mentre la risposta aspetta è più indietro (sprint 11 · T3.1)', async () => {
        const istante = await rotte(true);
        let nelFrattempo = '';

        const { stato, corpo } = await rispostaDi('/cornice/notifiche/letture', segnaTutte(), () => {
            nelFrattempo = istante();
        });

        expect(stato).toBe(200);
        expect(Object.keys(corpo)).toEqual(['data', 'segnate_il']);
        expect(nelFrattempo).toBe('2026-10-10T00:00:00.000001Z');
        expect(corpo.segnate_il).toBe('2026-10-10T00:00:00.000002Z');
        // E l'elenco letto dopo le trova lette, con un istante più avanti ancora.
        const dopo = await rispostaDi('/cornice/notifiche');
        expect((dopo.corpo.data as { letta: boolean }[]).map((notifica) => notifica.letta)).toEqual([true, true, true, true]);
        expect(dopo.corpo.aggiornati_il).toBe('2026-10-10T00:00:00.000003Z');
    });

    it('senza orologio le due rotte rispondono come nella v1.2.1: nessun istante, nemmeno vuoto (sprint 11 · T3.1)', async () => {
        await rotte(false);

        const elenco = await rispostaDi('/cornice/notifiche');
        const letture = await rispostaDi('/cornice/notifiche/letture', segnaTutte());

        expect(elenco.stato).toBe(200);
        // Dalla `v1.12.0` l'elenco dice di quale workspace è: non è un istante, e c'è anche senza orologio.
        expect(Object.keys(elenco.corpo)).toEqual(['data', 'workspace']);
        expect(letture.stato).toBe(200);
        expect(Object.keys(letture.corpo)).toEqual(['data']);
        // Dalla `v1.3.0` la parte server dice sempre se ne restano: `altre` non è un istante, e c'è anche senza orologio.
        expect(Object.keys(letture.corpo.data as object)).toEqual(['fino_a', 'altre']);
    });

    it.each<[string, string | undefined, string[]]>([
        ['nel workspace dei dati di prova', 'uat-marketing', ['data', 'workspace']],
        ['in un altro workspace, come da un\'altra scheda', 'uat-vendite', ['data', 'workspace']],
        ['che la pagina di prova non dice', undefined, ['data']],
    ])('GET /cornice/notifiche dice di quale workspace è l\'elenco, quello della «sessione» — %s —, come la parte server dalla v1.12.0 (sprint 22 · T1.1)', async (_quale, dellaSessione, chiavi) => {
        (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL('https://uat.example.com/');
        const { rotteFinte } = await import('./rotte-finte');
        rotteFinte(() => dellaSessione);

        const { stato, corpo } = await rispostaDi('/cornice/notifiche');

        expect(stato).toBe(200);
        expect(Object.keys(corpo)).toEqual(chiavi);
        expect(corpo.workspace).toBe(dellaSessione);
    });

    // Una guardia: è così anche prima dell'orologio. Come nella parte server, un errore non dice quando.
    it('una risposta d\'errore non porta un istante: il workspace di un\'altra pagina (409) e un fino_a che non è un istante (422) (sprint 11 · T3.1)', async () => {
        await rotte(true);

        expect(await rispostaDi('/cornice/notifiche/letture', segnaTutte('uat-vendite'))).toEqual({ stato: 409, corpo: { errore: 'workspace_diverso' } });
        expect(await rispostaDi('/cornice/notifiche/letture', segnaTutte('uat-marketing', 'ieri'))).toEqual({ stato: 422, corpo: { errore: 'dati_non_validi' } });
    });

    // Sprint 12 · T3 (voce #1463): sulla pagina di prova si vedono un titolo di tipo e il ripiego, coi suoi due motivi.
    it('le notifiche d\'esempio hanno un tipo: due di tipi che zr-core conosce, una di un tipo che non conosce, una senza tipo (sprint 12 · T3.7)', async () => {
        await rotte(false);

        const { corpo } = await rispostaDi('/cornice/notifiche');
        const notifiche = corpo.data as { id: string; app: string | null; tipo?: string }[];
        // Quali tipi zr-core conosce lo dicono le chiavi dell'inglese.
        const conosciuto = (tipo: string | undefined) => tipo !== undefined && Object.keys(inglese).includes(`notificationTitle.${tipo}`);

        expect(notifiche.map(({ id, app, tipo }) => [id, app, tipo ?? null])).toEqual([
            ['uat-4', 'pm', 'com.zeiras.board.scheda.creata'],
            ['uat-3', 'crm', 'com.zeiras.crm.contatto.creato'],
            ['uat-2', 'uat-ignota', null],
            ['uat-1', null, 'com.zeiras.workspace.membro.creato'],
        ]);
        // Senza tipo: la chiave non c'è, come in una risposta di prima della v1.3.0. Dallo sprint 20 ognuna ha anche chi, su che
        // cosa e per chi, come la parte server; dallo sprint 21 anche gli id che la parte server dà di `dati` (`ids`).
        const treDati = ['autore_nome', 'risorsa_nome', 'per_me'];
        expect(notifiche.map((notifica) => Object.keys(notifica))).toEqual([
            ['id', 'creata_il', 'letta', 'app', 'tipo', ...treDati, 'ids'], ['id', 'creata_il', 'letta', 'app', 'tipo', ...treDati, 'ids'], ['id', 'creata_il', 'letta', 'app', ...treDati, 'ids'], ['id', 'creata_il', 'letta', 'app', 'tipo', ...treDati, 'ids'],
        ]);
        expect(notifiche.map(({ tipo }) => conosciuto(tipo))).toEqual([true, false, false, true]);
    });

    // Sprint 21 · T2 (voce #1641): le notifiche del CRM stanno nella pagina di prova solo con `?crm=1`. Senza, l'elenco è quello
    // del tag di prima (il caso qui sopra), e le schermate della smoke non cambiano.
    it('con `?crm=1` in fondo all\'elenco ci sono le notifiche del CRM, lette: una per ognuno dei sette tipi che zr-core conosce, e una di un tipo che non conosce ancora; poi due note che non hanno dove andare, e due di un\'azienda. Ognuna porta i suoi id, e mai `dati` né `soggetto` (sprint 21 · T2.1, T2.2, T3.1, T3.3, T3.5, T5.1)', async () => {
        await rotte(false, '?crm=1');

        const { corpo } = await rispostaDi('/cornice/notifiche');
        const notifiche = corpo.data as { id: string; app: string | null; tipo?: string; letta: boolean; creata_il: string; risorsa_nome: string | null; ids: Record<string, string> }[];
        const conosciuto = (tipo: string | undefined) => tipo !== undefined && Object.keys(inglese).includes(`notificationTitle.${tipo}`);

        expect(notifiche.slice(0, 4).map(({ id }) => id)).toEqual(['uat-4', 'uat-3', 'uat-2', 'uat-1']);
        expect(notifiche.slice(4, 12).map(({ id, app, tipo, letta }) => [id, app, tipo, letta])).toEqual([
            ['uat-c1', 'crm', 'com.zeiras.crm.persona.creata', true],
            ['uat-c2', 'crm', 'com.zeiras.crm.persona.modificata', true],
            ['uat-c3', 'crm', 'com.zeiras.crm.pipeline.creata', true],
            ['uat-c4', 'crm', 'com.zeiras.crm.pipeline.modificata', true],
            ['uat-c5', 'crm', 'com.zeiras.crm.nota.creata', true],
            ['uat-c6', 'crm', 'com.zeiras.crm.nota.modificata', true],
            ['uat-c7', 'crm', 'com.zeiras.crm.nota.eliminata', true],
            ['uat-c8', 'crm', 'com.zeiras.crm.persona.assegnata', true],
        ]);
        expect(notifiche.slice(4, 12).map(({ tipo }) => conosciuto(tipo))).toEqual([true, true, true, true, true, true, true, false]);
        // Sprint 21 · T3: gli id che la parte server dà di `dati`, i soli che servono ad aprire la risorsa (review della PR #31, R1).
        // Una nota porta quello della cosa più specifica a cui è attaccata, non il suo — la prima l'opportunità, la seconda il
        // contatto, la terza l'azienda (sprint 23 · T3.4, T3.5) —; un tipo che il registro non ha, nessuno.
        expect(notifiche.slice(4, 12).map(({ ids }) => ids)).toEqual([
            { id: 'uat-persona-1' }, { id: 'uat-persona-1' }, { id: 'uat-pipeline-1' }, { id: 'uat-pipeline-1' },
            { trattativa_id: 'uat-opp-1' }, { persona_id: 'uat-persona-2' }, { organizzazione_id: 'uat-azienda-1' },
            {},
        ]);
        // Le ultime due non hanno dove andare, e la riga sotto il titolo dice quale: una senza il contatto, una col contatto malfatto.
        expect(notifiche.slice(12, 14).map(({ id, tipo, risorsa_nome, ids }) => [id, tipo, risorsa_nome, ids])).toEqual([
            ['uat-c9', 'com.zeiras.crm.nota.creata', 'UAT nota senza contatto', {}],
            ['uat-c10', 'com.zeiras.crm.nota.creata', 'UAT nota con un id malfatto', { persona_id: '../x' }],
        ]);
        // Sprint 21 · T5: in fondo, le due di un'azienda, di tipi che zr-core conosce, con l'id dell'azienda.
        expect(notifiche.slice(14).map(({ id, app, tipo, letta, ids }) => [id, app, tipo, letta, ids])).toEqual([
            ['uat-c11', 'crm', 'com.zeiras.crm.organizzazione.creata', true, { id: 'uat-azienda-1' }],
            ['uat-c12', 'crm', 'com.zeiras.crm.organizzazione.modificata', true, { id: 'uat-azienda-1' }],
        ]);
        expect(notifiche.slice(14).map(({ tipo }) => conosciuto(tipo))).toEqual([true, true]);
        // Ogni notifica ha `ids`, e nessuna `dati` né `soggetto`, come dalla parte server.
        expect(notifiche.map((notifica) => [typeof notifica.ids, 'dati' in notifica, 'soggetto' in notifica])).toEqual(notifiche.map(() => ['object', false, false]));
        // Ciò che la UAT vede aprirsi nel workspace di prova: il contatto, le impostazioni della pipeline, e per le tre note
        // l'opportunità, il contatto e l'azienda; e niente per il tipo che zr-core non conosce e per le due note senza un legame buono.
        const { destinazioneDellaNotifica } = await import('../js/index');
        const nelCrm = 'https://crm.zeiras.com/w/uat-marketing';
        expect(notifiche.slice(4, 14).map((notifica) => destinazioneDellaNotifica(notifica, 'uat-marketing', { crm: 'disponibile' }) ?? null)).toEqual([
            `${nelCrm}/contatti/uat-persona-1`, `${nelCrm}/contatti/uat-persona-1`,
            `${nelCrm}/pipeline/uat-pipeline-1/impostazioni`, `${nelCrm}/pipeline/uat-pipeline-1/impostazioni`,
            `${nelCrm}/opportunita/uat-opp-1`, `${nelCrm}/contatti/uat-persona-2`, `${nelCrm}/aziende/uat-azienda-1`,
            null, null, null,
        ]);
        // Sprint 21 · T5: le due di un'azienda aprono la sua pagina nel CRM.
        expect(notifiche.slice(14).map((notifica) => destinazioneDellaNotifica(notifica, 'uat-marketing', { crm: 'disponibile' }) ?? null)).toEqual([`${nelCrm}/aziende/uat-azienda-1`, `${nelCrm}/aziende/uat-azienda-1`]);
        // Delle prime quattro, quelle di ogni pagina di prova, dallo sprint 24 (T3) «Nuova scheda» apre la sua scheda; le altre tre
        // non hanno una destinazione: aprono la pagina delle notifiche.
        expect(notifiche.slice(0, 4).map((notifica) => destinazioneDellaNotifica(notifica, 'uat-marketing', { pm: 'attivo', crm: 'disponibile' }) ?? null)).toEqual(['https://board.zeiras.com/w/uat-marketing/c/uat-scheda-1', null, null, null]);
        // Dalla più recente, come le dà la parte server: quelle del CRM sono più vecchie di tutte le altre.
        const istanti = notifiche.map(({ creata_il }) => new Date(creata_il).getTime());
        expect(istanti).toStrictEqual([...istanti].sort((a, b) => b - a));
    });

    // Review della PR #31, R1: la parte server dà, di `dati`, i soli id del percorso che si apre per il tipo della notifica,
    // nella voce della sua app. Le notifiche di prova non ne portano altri: né l'id di una vista, né quello di una nota, né
    // quello di una persona entrata nel workspace; dallo sprint 24 una scheda porta il suo, perché si apre.
    it.each([[''], ['?chi=1'], ['?crm=1'], ['?viste=1'], ['?opportunita=1'], ['?schede=1'], ['?chi=1&crm=1&viste=1&opportunita=1&arriva=1'], ['?chi=1&schede=1&arriva=1']])('ogni notifica di prova porta solo gli id che la parte server dà: quelli del percorso che si apre per il suo tipo, con %j (sprint 21 · review della PR #31, R1)', async (query) => {
        await rotte(false, query);
        const { registro } = await import('../js/registro');

        await rispostaDi('/cornice/notifiche');
        const { corpo } = await rispostaDi('/cornice/notifiche');
        const notifiche = corpo.data as { id: string; app: string | null; tipo?: string; ids: Record<string, string> }[];
        // Sprint 23 · T3.5: un tipo può avere più percorsi (`altrimenti`), e la parte server dà gli id di uno solo, quello che si apre.
        const chiesteDaOgniPercorso = ({ app, tipo }: { app: string | null; tipo?: string }) => {
            const delTipo = registro.find((voce) => voce.id === app)?.notifiche?.find((notifica) => notifica.tipo === tipo);

            return [delTipo?.percorso ?? '', ...(delTipo?.altrimenti ?? [])].map((percorso) => [...percorso.matchAll(/\{([^{}]*)\}/g)].map(([, chiave]) => chiave));
        };
        const diUnPercorsoSolo = (notifica: (typeof notifiche)[number]) => chiesteDaOgniPercorso(notifica).some((chieste) => Object.keys(notifica.ids).every((chiave) => chieste.includes(chiave)));

        expect(notifiche.length).toBeGreaterThanOrEqual(4);
        expect(notifiche.map((notifica) => [notifica.id, diUnPercorsoSolo(notifica)])).toEqual(notifiche.map(({ id }) => [id, true]));
        // E quelle i cui percorsi chiedono tutti un id portano il loro, tranne la nota senza legami.
        expect(notifiche.filter((notifica) => chiesteDaOgniPercorso(notifica).every((chieste) => chieste.length > 0) && Object.keys(notifica.ids).length === 0).map(({ id }) => id)).toEqual(query.includes('crm') ? ['uat-c9'] : []);
    });

    // Sprint 24 · T3 (voce #1748): una scheda nuova, modificata o assegnata apre la sua pagina in zr-board. «Nuova scheda»,
    // nell'elenco di sempre, porta l'id della sua scheda come dalla parte server; la scheda assegnata e una eliminata stanno
    // dietro `?schede=1`.
    it('con `?schede=1` in cima all\'elenco c\'è la notifica a chi viene assegnata una scheda, da leggere, col tipo senza `com.zeiras.` davanti, chi l\'ha assegnata e il nome della scheda, e in fondo una scheda eliminata, letta; zr-core conosce i due tipi, la prima apre la scheda e la seconda no, e «Nuova scheda» apre la sua (sprint 24 · T3.1, T3.2, T3.4)', async () => {
        await rotte(false, '?schede=1');

        const { corpo } = await rispostaDi('/cornice/notifiche');
        const notifiche = corpo.data as { id: string; creata_il: string; app: string | null; tipo?: string; letta: boolean; autore_nome: string | null; risorsa_nome: string | null; per_me: boolean | null; ids: Record<string, string> }[];
        const { destinazioneDellaNotifica } = await import('../js/index');
        const apre = (notifica: (typeof notifiche)[number]) => destinazioneDellaNotifica(notifica, 'uat-marketing', { pm: 'attivo', crm: 'attivo' }) ?? null;
        const [assegnata, eliminata] = [notifiche[0], notifiche[5]];

        expect(notifiche.map(({ id }) => id)).toEqual(['uat-s1', 'uat-4', 'uat-3', 'uat-2', 'uat-1', 'uat-s2']);
        expect(assegnata).toEqual({ id: 'uat-s1', creata_il: assegnata?.creata_il, letta: false, app: 'pm', tipo: 'board.scheda.assegnata', autore_nome: 'Marta Rossi', risorsa_nome: 'UAT Preparare il lancio', per_me: true, ids: { id: 'uat-scheda-2' } });
        expect([eliminata?.app, eliminata?.tipo, eliminata?.letta, eliminata?.ids]).toEqual(['pm', 'com.zeiras.board.scheda.eliminata', true, {}]);
        expect([assegnata, eliminata].map((notifica) => Object.keys(inglese).includes(`notificationTitle.${notifica?.tipo}`))).toEqual([true, true]);
        expect(notifiche.map(apre)).toEqual(['https://board.zeiras.com/w/uat-marketing/c/uat-scheda-2', 'https://board.zeiras.com/w/uat-marketing/c/uat-scheda-1', null, null, null, null]);
        expect(notifiche.map((notifica) => [typeof notifica.ids, 'dati' in notifica, 'soggetto' in notifica])).toEqual(notifiche.map(() => ['object', false, false]));
    });

    // Sprint 21 · T5 (voce #1706): le viste salvate di una board sono di Project Management. Stanno dietro `?viste=1`, così le
    // pagine di prova di prima restano com'erano.
    it('con `?viste=1` in fondo all\'elenco ci sono tre notifiche delle viste di una board, di Project Management, lette: una creata, una modificata, una eliminata, di tipi che zr-core conosce; nessuna ha una destinazione (sprint 21 · T5.1, T5.2)', async () => {
        await rotte(false, '?viste=1');

        const { corpo } = await rispostaDi('/cornice/notifiche');
        const notifiche = corpo.data as { id: string; app: string | null; tipo?: string; letta: boolean; creata_il: string; ids: Record<string, string> }[];

        expect(notifiche.slice(0, 4).map(({ id }) => id)).toEqual(['uat-4', 'uat-3', 'uat-2', 'uat-1']);
        expect(notifiche.slice(4).map(({ id, app, tipo, letta, ids }) => [id, app, tipo, letta, ids])).toEqual([
            ['uat-v1', 'pm', 'com.zeiras.board.vista.creata', true, {}],
            ['uat-v2', 'pm', 'com.zeiras.board.vista.modificata', true, {}],
            ['uat-v3', 'pm', 'com.zeiras.board.vista.eliminata', true, {}],
        ]);
        expect(notifiche.slice(4).map(({ tipo }) => Object.keys(inglese).includes(`notificationTitle.${tipo}`))).toEqual([true, true, true]);
        // Una vista non ha una destinazione nel registro: un clic apre la pagina delle notifiche, anche con Project Management attivo.
        const { destinazioneDellaNotifica } = await import('../js/index');
        expect(notifiche.slice(4).map((notifica) => destinazioneDellaNotifica(notifica, 'uat-marketing', { pm: 'attivo', crm: 'attivo' }) ?? null)).toEqual([null, null, null]);
        expect(notifiche.map((notifica) => [typeof notifica.ids, 'dati' in notifica, 'soggetto' in notifica])).toEqual(notifiche.map(() => ['object', false, false]));
    });

    // Sprint 22 · T5 (voce #1720): i nove tipi nuovi del CRM stanno dietro `?opportunita=1`, così le pagine di prova di prima
    // restano com'erano. Sprint 23 · T3 (voce #1743): portano l'id che il loro percorso chiede, come dalla parte server —
    // un'attività nessuno —, e ognuna apre la sua pagina nel CRM.
    it('con `?opportunita=1` in fondo all\'elenco ci sono le nove notifiche nuove del CRM, lette: i cinque eventi di opportunità e attività, poi le quattro «assegnata» col tipo senza `com.zeiras.` davanti; zr-core conosce tutti e nove i tipi, e ognuna apre la sua pagina: l\'opportunità, il contatto e l\'azienda col loro id, un\'attività «Da fare» (sprint 22 · T5.1, T5.2; sprint 23 · T3.1, T3.2, T3.3)', async () => {
        await rotte(false, '?opportunita=1');

        const { corpo } = await rispostaDi('/cornice/notifiche');
        const notifiche = corpo.data as { id: string; app: string | null; tipo?: string; letta: boolean; creata_il: string; ids: Record<string, string> }[];

        expect(notifiche.slice(0, 4).map(({ id }) => id)).toEqual(['uat-4', 'uat-3', 'uat-2', 'uat-1']);
        expect(notifiche.slice(4).map(({ id, app, tipo, letta, ids }) => [id, app, tipo, letta, ids])).toEqual([
            ['uat-o1', 'crm', 'com.zeiras.crm.trattativa.creata', true, { id: 'uat-opp-1' }],
            ['uat-o2', 'crm', 'com.zeiras.crm.trattativa.modificata', true, { id: 'uat-opp-1' }],
            ['uat-o3', 'crm', 'com.zeiras.crm.attivita.creata', true, {}],
            ['uat-o4', 'crm', 'com.zeiras.crm.attivita.modificata', true, {}],
            ['uat-o5', 'crm', 'com.zeiras.crm.attivita.eliminata', true, {}],
            ['uat-o6', 'crm', 'crm.persona.assegnata', true, { id: 'uat-persona-1' }],
            ['uat-o7', 'crm', 'crm.organizzazione.assegnata', true, { id: 'uat-azienda-1' }],
            ['uat-o8', 'crm', 'crm.trattativa.assegnata', true, { id: 'uat-opp-1' }],
            ['uat-o9', 'crm', 'crm.attivita.assegnata', true, {}],
        ]);
        expect(notifiche.slice(4).map(({ tipo }) => Object.keys(inglese).includes(`notificationTitle.${tipo}`))).toEqual(Array(9).fill(true));
        // Ciò che la UAT vede aprirsi nel workspace di prova; col CRM che non si può aprire, la pagina delle notifiche.
        const { destinazioneDellaNotifica } = await import('../js/index');
        const nelCrm = 'https://crm.zeiras.com/w/uat-marketing';
        expect(notifiche.slice(4).map((notifica) => destinazioneDellaNotifica(notifica, 'uat-marketing', { pm: 'attivo', crm: 'attivo' }) ?? null)).toEqual([
            `${nelCrm}/opportunita/uat-opp-1`, `${nelCrm}/opportunita/uat-opp-1`,
            `${nelCrm}/da-fare`, `${nelCrm}/da-fare`, `${nelCrm}/da-fare`,
            `${nelCrm}/contatti/uat-persona-1`, `${nelCrm}/aziende/uat-azienda-1`, `${nelCrm}/opportunita/uat-opp-1`, `${nelCrm}/da-fare`,
        ]);
        expect(notifiche.slice(4).map((notifica) => destinazioneDellaNotifica(notifica, 'uat-marketing', { pm: 'attivo' }) ?? null)).toEqual(Array(9).fill(null));
        expect(notifiche.map((notifica) => [typeof notifica.ids, 'dati' in notifica, 'soggetto' in notifica])).toEqual(notifiche.map(() => ['object', false, false]));
    });

    it.each([
        ['', ['uat-4', 'uat-3', 'uat-2', 'uat-1']],
        ['?crm=1', ['uat-4', 'uat-3', 'uat-2', 'uat-1', ...Array.from({ length: 12 }, (_, indice) => `uat-c${indice + 1}`)]],
        ['?crm=1&viste=1', ['uat-4', 'uat-3', 'uat-2', 'uat-1', ...Array.from({ length: 12 }, (_, indice) => `uat-c${indice + 1}`), 'uat-v1', 'uat-v2', 'uat-v3']],
        ['?opportunita=1', ['uat-4', 'uat-3', 'uat-2', 'uat-1', ...Array.from({ length: 9 }, (_, indice) => `uat-o${indice + 1}`)]],
        ['?crm=1&viste=1&opportunita=1', ['uat-4', 'uat-3', 'uat-2', 'uat-1', ...Array.from({ length: 12 }, (_, indice) => `uat-c${indice + 1}`), 'uat-v1', 'uat-v2', 'uat-v3', ...Array.from({ length: 9 }, (_, indice) => `uat-o${indice + 1}`)]],
    ])('con «%s» l\'elenco delle notifiche d\'esempio è quello della scelta, dalla più recente: le viste solo con `?viste`, quelle del CRM solo con `?crm`, le nove nuove solo con `?opportunita` (sprint 21 · T5.1; sprint 22 · T5.1)', async (query, attese) => {
        await rotte(false, query);

        const notifiche = (await rispostaDi('/cornice/notifiche')).corpo.data as { id: string; creata_il: string }[];
        const istanti = notifiche.map(({ creata_il }) => new Date(creata_il).getTime());

        expect(notifiche.map(({ id }) => id)).toEqual(attese);
        expect(istanti).toStrictEqual([...istanti].sort((a, b) => b - a));
    });

    // Sprint 12 · T4 (voce #1461): fermata da un tetto, la parte server dice che ne restano (`altre: true`). Sulla pagina di prova lo
    // si vede con `?altre=1`: la prima «Segna tutte come lette» riuscita ne lascia una, la seconda le segna tutte.

    /** Quali notifiche d'esempio sono lette, nell'ordine dell'elenco (dalla più recente). */
    const lette = async () => ((await rispostaDi('/cornice/notifiche')).corpo.data as { letta: boolean }[]).map((notifica) => notifica.letta);
    /** Ciò che «Segna tutte come lette» risponde: lo stato e, se c'è, `altre`. */
    const segnate = async () => {
        const { stato, corpo } = await rispostaDi('/cornice/notifiche/letture', segnaTutte());

        return [stato, (corpo.data as { altre?: unknown } | undefined)?.altre];
    };

    it('con ?altre=1 la prima «Segna tutte come lette» dice altre: true e lascia non letta la più recente; la seconda dice altre: false e le segna tutte (sprint 12 · T4.5)', async () => {
        await rotte(false, '?altre=1');
        expect(await lette()).toEqual([false, false, true, true]);

        expect(await segnate()).toEqual([200, true]);
        expect(await lette()).toEqual([false, true, true, true]);

        expect(await segnate()).toEqual([200, false]);
        expect(await lette()).toEqual([true, true, true, true]);
        // E da lì in poi non ne restano più.
        expect(await segnate()).toEqual([200, false]);
    });

    it('senza ?altre «Segna tutte come lette» dice altre: false al primo clic, e le segna tutte (sprint 12 · T4.5)', async () => {
        await rotte(false);

        expect(await segnate()).toEqual([200, false]);
        expect(await lette()).toEqual([true, true, true, true]);
    });

    it('con ?altre=1 e ?errore=letture la prima fallisce senza segnare niente, e altre: true lo dice la prima che riesce (sprint 12 · T4.5)', async () => {
        await rotte(false, '?altre=1&errore=letture');

        expect(await segnate()).toEqual([502, undefined]);
        expect(await lette()).toEqual([false, false, true, true]);
        expect(await segnate()).toEqual([200, true]);
        expect(await lette()).toEqual([false, true, true, true]);
        expect(await segnate()).toEqual([200, false]);
    });

    // Sprint 24 · T4 (voce #1754). Con `?sessione=` vuoto la pagina di prova non dice il workspace della «sessione», e la parte
    // server finta non dice di chi è l'elenco, come una di prima della `v1.12.0`: la cornice mostra «Segna tutte come lette», e
    // la POST deve riuscire, perché non c'è un workspace con cui lo slug della pagina possa non tornare. Con la «sessione» in un
    // altro workspace resta il 409 della parte server.
    it.each<[string, string | undefined, [number, unknown], boolean[]]>([
        ['che la pagina di prova non dice: riesce, e le segna tutte', undefined, [200, false], [true, true, true, true]],
        ['in un altro workspace: 409, e non ne segna nessuna', 'uat-vendite', [409, undefined], [false, false, true, true]],
    ])('«Segna tutte come lette» dalla pagina dei dati di prova, con la «sessione» %s (sprint 24 · T4.4)', async (_quale, dellaSessione, risposta, poi) => {
        (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL('https://uat.example.com/');
        const { rotteFinte } = await import('./rotte-finte');
        rotteFinte(() => dellaSessione);

        expect(await segnate()).toEqual(risposta);
        expect(await lette()).toEqual(poi);
    });

    // Sprint 22 · T2 (voce #1712): la lettura di una notifica sola, che la cornice chiede col clic che apre la sua risorsa.
    const leggi = (letta: unknown = true): RequestInit => ({ method: 'PATCH', body: JSON.stringify({ letta }) });
    const letteDelCrm = async () => ((await rispostaDi('/cornice/notifiche')).corpo.data as { id: string; letta: boolean }[]).filter(({ id }) => id.startsWith('uat-c')).map(({ letta }) => letta);

    it('PATCH /cornice/notifiche/<id>/lettura segna quella notifica e risponde con `letta` e con l\'istante preso a notifica segnata: una lettura fatta mentre la risposta aspetta è più indietro (sprint 22 · T2.5)', async () => {
        const orologio = await rotte(true, '?crm=1&da_leggere=1');
        // Con `?da_leggere=1` le prime otto del CRM sono da leggere; le altre restano lette.
        expect(await letteDelCrm()).toEqual([false, false, false, false, false, false, false, false, true, true, true, true]);

        let nelFrattempo = '';
        const { stato, corpo } = await rispostaDi('/cornice/notifiche/uat-c1/lettura', leggi(), () => (nelFrattempo = orologio()));
        expect([stato, corpo.data]).toEqual([200, { id: 'uat-c1', letta: true }]);
        expect(String(corpo.segnata_il) > nelFrattempo).toBe(true);
        expect(await letteDelCrm()).toEqual([true, false, false, false, false, false, false, false, true, true, true, true]);
    });

    it('senza `?da_leggere` le notifiche del CRM sono lette come prima, e senza orologio la lettura non porta un istante, nemmeno vuoto (sprint 22 · T2.5)', async () => {
        await rotte(false, '?crm=1');
        expect((await letteDelCrm()).every((letta) => letta)).toBe(true);

        const { stato, corpo } = await rispostaDi('/cornice/notifiche/uat-4/lettura', leggi());
        expect([stato, corpo]).toEqual([200, { data: { id: 'uat-4', letta: true } }]);
    });

    it.each<[string, string, string, RequestInit, number]>([
        ['con ?errore=lettura fallisce sempre', '?crm=1&da_leggere=1&errore=lettura', 'uat-c1', leggi(), 502],
        ['una notifica che non c\'è', '?crm=1&da_leggere=1', 'uat-c99', leggi(), 404],
        ['un `letta` che non è un booleano', '?crm=1&da_leggere=1', 'uat-c1', leggi('true'), 422],
        ['un altro metodo', '?crm=1&da_leggere=1', 'uat-c1', { method: 'POST', body: '{"letta":true}' }, 404],
    ])('una lettura che non riesce — %s — non segna niente e non porta un istante (sprint 22 · T2.3)', async (_come, query, id, opzioni, atteso) => {
        await rotte(true, query);

        const { stato, corpo } = await rispostaDi(`/cornice/notifiche/${id}/lettura`, opzioni);
        expect([stato, Object.keys(corpo)]).toEqual([atteso, ['errore']]);
        expect((await letteDelCrm()).slice(0, 8)).toEqual([false, false, false, false, false, false, false, false]);
    });

    it('senza `?chi` ogni notifica ha chi, su che cosa e per chi a `null`, come li dà la parte server quando il backoffice non li manda: il pannello è quello di prima (sprint 20 · T1.7)', async () => {
        await rotte(false);

        const { corpo } = await rispostaDi('/cornice/notifiche');
        expect((corpo.data as Record<string, unknown>[]).map(({ id, autore_nome, risorsa_nome, per_me }) => ({ id, autore_nome, risorsa_nome, per_me }))).toStrictEqual([
            { id: 'uat-4', autore_nome: null, risorsa_nome: null, per_me: null },
            { id: 'uat-3', autore_nome: null, risorsa_nome: null, per_me: null },
            { id: 'uat-2', autore_nome: null, risorsa_nome: null, per_me: null },
            { id: 'uat-1', autore_nome: null, risorsa_nome: null, per_me: null },
        ]);
    });

    it('con `?chi=1` le notifiche d\'esempio sono i tre casi — una con chi e su che cosa rivolta alla persona, una con chi per tutto il workspace, le altre com\'erano — più una su un\'app, col codice dell\'app in `risorsa_nome`; e quella che arriva dopo non li dice (sprint 20 · T1.7, T1.8)', async () => {
        await rotte(false, '?chi=1&arriva=1');

        await rispostaDi('/cornice/notifiche');
        const { corpo } = await rispostaDi('/cornice/notifiche');
        expect((corpo.data as Record<string, unknown>[]).map(({ id, autore_nome, risorsa_nome, per_me }) => ({ id, autore_nome, risorsa_nome, per_me }))).toStrictEqual([
            { id: 'uat-5', autore_nome: null, risorsa_nome: null, per_me: null },
            { id: 'uat-4', autore_nome: 'Marta Rossi', risorsa_nome: 'UAT Scrivere il brief del lancio', per_me: true },
            { id: 'uat-3', autore_nome: 'Bruno Neri', risorsa_nome: null, per_me: false },
            { id: 'uat-2', autore_nome: null, risorsa_nome: null, per_me: null },
            { id: 'uat-0', autore_nome: 'Marta Rossi', risorsa_nome: 'pm', per_me: null },
            { id: 'uat-1', autore_nome: null, risorsa_nome: null, per_me: null },
        ]);
        // Quella su un'app non è di un prodotto (`app` è `null`): che cosa è cambiato lo dice il tipo, quale app `risorsa_nome`.
        expect((corpo.data as Record<string, unknown>[]).filter(({ id }) => id === 'uat-0').map(({ app, tipo, letta }) => ({ app, tipo, letta }))).toStrictEqual([{ app: null, tipo: 'com.zeiras.app.modificata', letta: true }]);
        // Le nove chiavi della parte server (dallo sprint 21 anche `ids`), e nessun'altra (una non ha `tipo`: è il caso del titolo di ripiego).
        expect((corpo.data as Record<string, unknown>[]).map((notifica) => Object.keys(notifica).sort().join(' '))).toStrictEqual([
            'app autore_nome creata_il id ids letta per_me risorsa_nome tipo',
            'app autore_nome creata_il id ids letta per_me risorsa_nome tipo',
            'app autore_nome creata_il id ids letta per_me risorsa_nome tipo',
            'app autore_nome creata_il id ids letta per_me risorsa_nome',
            'app autore_nome creata_il id ids letta per_me risorsa_nome tipo',
            'app autore_nome creata_il id ids letta per_me risorsa_nome tipo',
        ]);
    });
});

// Sprint 18 · T1 (voce #1638). La ricerca delle pagine di prova risponde come la rotta vera: a una POST, con la parola nel corpo.
// Una GET con la parola nell'indirizzo, quella delle versioni fino alla `v1.7.0`, non cerca; e una POST che la parola la porta
// solo nell'indirizzo è senza parola.
describe('la rotta finta della ricerca legge la parola dal corpo di una POST', () => {
    const fetchDiPrima = window.fetch;

    beforeEach(() => {
        vi.resetModules();
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        vi.spyOn(console, 'info').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        window.fetch = fetchDiPrima;
    });

    /** La risposta della rotta finta, che ci mette al più 1500 ms, sulla pagina di prova con quella query e con la «sessione» in quel workspace. */
    async function rispostaGrezzaDi(indirizzo: string, opzioni?: RequestInit, query = '', sessione: () => string | undefined = () => 'uat-marketing'): Promise<Response> {
        (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(`https://uat.example.com/${query}`);
        const { rotteFinte } = await import('./rotte-finte');
        rotteFinte(sessione);
        const inArrivo = fetch(indirizzo, opzioni);
        await vi.advanceTimersByTimeAsync(1500);

        return inArrivo;
    }

    /** Lo stato e il corpo JSON di quella risposta. */
    async function rispostaDi(indirizzo: string, opzioni?: RequestInit, query = '', sessione?: () => string | undefined): Promise<{ stato: number; corpo: Record<string, unknown> }> {
        const risposta = await rispostaGrezzaDi(indirizzo, opzioni, query, sessione);

        return { stato: risposta.status, corpo: (await risposta.json()) as Record<string, unknown> };
    }

    /** La richiesta della cornice per quella parola. */
    const cerca = (parola: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify({ q: parola }) });

    it('POST /cornice/ricerca dà i risultati d\'esempio che hanno nel titolo la parola del corpo, in ordine di titolo, e il workspace della «sessione» (sprint 18 · T1.7; sprint 22 · T6.5)', async () => {
        expect(await rispostaDi('/cornice/ricerca', cerca('marketing'))).toStrictEqual({ stato: 200, corpo: { data: [
            { tipo: 'board.cartelle', id: 'uat-3', titolo: 'UAT Marketing', contesto: null },
            { tipo: 'board.board', id: 'uat-14', titolo: 'UAT Report marketing', contesto: null },
        ], workspace: 'uat-marketing' } });
    });

    // Sprint 25 · T4 (voce #1639): i risultati d'esempio sono quelli di ricerca.crea. Per prime le fonti nuove — schede,
    // contatti, aziende, opportunità —, poi board e cartelle in ordine di titolo; ogni risultato porta `contesto`, i testi per
    // riconoscerlo o `null`, e un contatto può non avere né azienda né ruolo.
    // Sprint 25 · T6 (lettura della PR #56, R13): le fonti nuove entrano dietro un parametro, come ogni dato nuovo della pagina
    // di prova. Senza parametri la ricerca dà ciò che dava sul tag di prima; con `?schede=1` anche una scheda; con
    // `?crm_attivo=1`, lo stesso che nei dati di prova accende il CRM, anche contatti, aziende e opportunità: come il
    // backoffice, che una fonte la dà solo se il suo prodotto è attivo nel workspace.
    const scheda = { tipo: 'board.scheda', id: 'uat-s1', titolo: 'UAT Preparare il lancio', contesto: { board: 'UAT Lancio Q4', lista: 'UAT Da fare' } };
    const delCrm = [
        { tipo: 'crm.persona', id: 'uat-p1', titolo: 'UAT Grace Hopper', contesto: { organizzazione: 'UAT Acme', ruolo: 'UAT Responsabile acquisti' } },
        { tipo: 'crm.persona', id: 'uat-p2', titolo: 'UAT Alan Turing', contesto: null },
        { tipo: 'crm.organizzazione', id: 'uat-o1', titolo: 'UAT Acme', contesto: null },
        { tipo: 'crm.trattativa', id: 'uat-t1', titolo: 'UAT Rinnovo 2027', contesto: { pipeline: 'UAT Vendite', fase: 'UAT Proposta' } },
    ];
    /** Ciò che la ricerca di «uat» dava sul tag `v1.14.0`: board e cartelle in ordine di titolo, e in fondo i due tipi che il registro non ha. */
    const diPrima = [
        { tipo: 'board.board', id: 'uat-13', titolo: 'UAT Lancio Q1', contesto: null },
        { tipo: 'board.board', id: 'uat-12', titolo: 'UAT Lancio Q4', contesto: null },
        { tipo: 'board.cartelle', id: 'uat-3', titolo: 'UAT Marketing', contesto: null },
        { tipo: 'board.board', id: 'uat-14', titolo: 'UAT Report marketing', contesto: null },
        { tipo: 'board.schede', id: 'uat-77', titolo: 'UAT Scrivere il brief del lancio', contesto: null },
        { tipo: 'uat-ignoto', id: 'uat-9', titolo: 'UAT tipo ignoto', contesto: null },
    ];

    it.each<[string, string, Record<string, unknown>[]]>([
        ['senza parametri dà ciò che dava sul tag di prima: board e cartelle in ordine di titolo, e in fondo i due tipi che il registro non ha', '', diPrima],
        ['con `?schede=1` per prima c\'è una scheda, col suo `contesto`', '?schede=1', [scheda, ...diPrima]],
        ['con `?crm_attivo=1` per primi ci sono contatti, aziende e opportunità, ognuno col suo `contesto`', '?crm_attivo=1', [...delCrm, ...diPrima]],
        ['con tutti e due, nell\'ordine di ricerca.crea: schede, contatti, aziende e opportunità, poi board e cartelle', '?schede=1&crm_attivo=1', [scheda, ...delCrm, ...diPrima]],
        // Letture della PR #56, N3: `crm_attivo` c'è, ed è `senza_crm` a togliere i risultati del CRM. Senza `crm_attivo`
        // mancherebbero comunque, e il caso resterebbe verde anche se la rotta finta non guardasse `senza_crm`.
        ['con `?senza_crm=1` i risultati del CRM non ci sono, nemmeno con `?crm_attivo=1`', '?schede=1&crm_attivo=1&senza_crm=1', [scheda, ...diPrima]],
    ])('cercando «uat» la ricerca finta %s (sprint 25 · T4.1, T4.2; T6, R13)', async (_caso, query, attesi) => {
        expect((await rispostaDi('/cornice/ricerca', cerca('uat'), query)).corpo.data).toStrictEqual(attesi);
    });

    // Letture della PR #56, N2. Di `contesto` la rotta vera lascia uscire le sole chiavi che il registro dà al tipo, coi soli
    // testi non vuoti, e `null` quando non ne resta nessuno: mai un `null` fra i valori, mai un oggetto vuoto. La rotta finta
    // non dà altre forme: un contatto senza azienda né ruolo ha `null`.
    it('di `contesto` la ricerca finta dà solo le forme della rotta vera: `null`, o i testi delle chiavi che il registro dà al tipo; un contatto senza azienda né ruolo ha `null` (sprint 26 · T1.3)', async () => {
        const { registro } = await import('../js/registro');
        const chiaviDi = (tipo: unknown) => registro.flatMap((voce) => voce.risorse ?? []).find((risorsa) => risorsa.tipo === tipo)?.contesto ?? [];
        const risultati = (await rispostaDi('/cornice/ricerca', cerca('uat'), '?schede=1&crm_attivo=1')).corpo.data as { tipo: unknown; id: unknown; contesto: Record<string, unknown> | null }[];
        const fuoriForma = risultati.filter(({ tipo, contesto }) => {
            if (contesto === null) {
                return false;
            }
            const voci = Object.entries(contesto);

            return voci.length === 0 || voci.some(([chiave, valore]) => !chiaviDi(tipo).includes(chiave) || typeof valore !== 'string' || valore === '');
        });

        expect(fuoriForma.map(({ id }) => id)).toStrictEqual([]);
        expect(risultati.find(({ id }) => id === 'uat-p2')?.contesto).toBeNull();
        // Il controllo non è vuoto: fra i risultati ce ne sono col contesto, e sono quelli di una scheda, di un contatto e di un'opportunità.
        expect(risultati.filter(({ contesto }) => contesto !== null).map(({ id }) => id)).toStrictEqual(['uat-s1', 'uat-p1', 'uat-t1']);
    });

    it.each<[string, string | undefined, Record<string, unknown>]>([
        ['in un altro workspace', 'uat-vendite', { workspace: 'uat-vendite' }],
        // Come una parte server di prima della `v1.12.0`: nel JSON la chiave non c'è, e per la cornice la ricerca è un errore.
        ['che la pagina di prova non dice', undefined, {}],
    ])('con la «sessione» %s la ricerca finta dice quello, come la rotta vera lo prende dalla sessione: mai un workspace mandato dalla richiesta (sprint 22 · T6.5, T6.6)', async (_caso, slug, atteso) => {
        const richiesta = { method: 'POST', body: JSON.stringify({ q: 'report', workspace: 'uat-della-richiesta' }) };

        expect(await rispostaDi('/cornice/ricerca?workspace=uat-dell-indirizzo', richiesta, '', () => slug)).toStrictEqual({ stato: 200, corpo: { data: [
            { tipo: 'board.board', id: 'uat-14', titolo: 'UAT Report marketing', contesto: null },
        ], ...atteso } });
    });

    // Sprint 24 · T4 (voce #1754): con `?id_malfatto=1` fra i risultati d'esempio c'è una board in più, con l'id `..`. La
    // cornice non la mostra: gli altri risultati della stessa parola sì.
    it.each<[string, string, Record<string, unknown>[]]>([
        ['con `?id_malfatto=1` fra i risultati d\'esempio c\'è una board con l\'id `..`, al suo posto nell\'ordine dei titoli', '?id_malfatto=1', [{ tipo: 'board.board', id: '..', titolo: 'UAT Lancio Q9, id malfatto', contesto: null }]],
        ['senza `?id_malfatto` i risultati d\'esempio sono quelli di prima', '', []],
    ])('%s (sprint 24 · T4.2)', async (_caso, query, inPiu) => {
        expect((await rispostaDi('/cornice/ricerca', cerca('lancio'), query)).corpo.data).toStrictEqual([
            { tipo: 'board.board', id: 'uat-13', titolo: 'UAT Lancio Q1', contesto: null },
            { tipo: 'board.board', id: 'uat-12', titolo: 'UAT Lancio Q4', contesto: null },
            ...inPiu,
            { tipo: 'board.schede', id: 'uat-77', titolo: 'UAT Scrivere il brief del lancio', contesto: null },
        ]);
    });

    it('una GET non cerca, nemmeno con la parola nell\'indirizzo: 405 coi metodi ammessi, come la rotta vera, e senza un corpo che la rotta vera non ha (sprint 18 · T1.7)', async () => {
        const risposta = await rispostaGrezzaDi('/cornice/ricerca?q=marketing');

        expect([risposta.status, risposta.headers.get('Allow'), await risposta.text()]).toStrictEqual([405, 'POST', '']);
    });

    it.each<[string, string, RequestInit]>([
        ['con la parola solo nell\'indirizzo', '/cornice/ricerca?q=marketing', { method: 'POST', body: JSON.stringify({}) }],
        ['senza corpo', '/cornice/ricerca', { method: 'POST' }],
        ['con una parola di un carattere', '/cornice/ricerca', cerca('m')],
        ['con una parola che non è un testo', '/cornice/ricerca', cerca(['marketing'])],
        // La rotta vera legge `q` dal corpo JSON: un corpo che non è JSON, o che non è un oggetto, non ne porta una.
        ['con un corpo che non è JSON', '/cornice/ricerca', { method: 'POST', body: 'q=marketing' }],
        ['con un corpo JSON che è null', '/cornice/ricerca', { method: 'POST', body: 'null' }],
        ['con un corpo JSON che è un testo', '/cornice/ricerca', { method: 'POST', body: '"marketing"' }],
    ])('una POST %s è senza parola: 422, come la rotta vera (sprint 18 · T1.7)', async (_caso, indirizzo, opzioni) => {
        expect(await rispostaDi(indirizzo, opzioni)).toStrictEqual({ stato: 422, corpo: { errore: 'dati_non_validi' } });
    });

    it('con ?errore=ricerca la POST fallisce (sprint 18 · T1.7)', async () => {
        expect((await rispostaDi('/cornice/ricerca', cerca('marketing'), '?errore=ricerca')).stato).toBe(502);
    });
});

// Sprint 24 · T2 (voce #1745): con `?accettazione=dopo` la pagina di prova ha i dati di sempre, e che la persona non ha accettato
// i documenti legali in vigore lo dicono le rotte: le quattro rispondono 403 col solo codice, come la parte server dalla `v1.14.0`.
// Con `?accettazione=1` lo dicono i dati della pagina, e le rotte restano quelle di sempre (la cornice ridotta non le chiama).
describe('con `?accettazione=dopo` le quattro rotte finte rispondono 403 `accettazione_richiesta`', () => {
    const fetchDiPrima = window.fetch;

    beforeEach(() => {
        vi.resetModules();
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        vi.spyOn(console, 'info').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        window.fetch = fetchDiPrima;
    });

    /** Lo stato e il corpo JSON della risposta di una rotta finta, sulla pagina di prova con quella query. */
    async function rispostaDi(indirizzo: string, opzioni: RequestInit | undefined, query: string): Promise<{ stato: number; corpo: unknown }> {
        (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(`https://uat.example.com/${query}`);
        const { rotteFinte } = await import('./rotte-finte');
        rotteFinte(() => 'uat-marketing');
        const inArrivo = fetch(indirizzo, opzioni);
        await vi.advanceTimersByTimeAsync(1500);
        const risposta = await inArrivo;

        return { stato: risposta.status, corpo: await risposta.json() };
    }

    const leQuattro: [string, string, RequestInit | undefined][] = [
        ['GET /cornice/notifiche', '/cornice/notifiche', undefined],
        ['PATCH /cornice/notifiche/<id>/lettura', '/cornice/notifiche/uat-c1/lettura', { method: 'PATCH', body: JSON.stringify({ letta: true }) }],
        ['POST /cornice/notifiche/letture', '/cornice/notifiche/letture', { method: 'POST', body: JSON.stringify({ fino_a: '2026-10-10T00:00:00.000Z', workspace: 'uat-marketing' }) }],
        ['POST /cornice/ricerca', '/cornice/ricerca', { method: 'POST', body: JSON.stringify({ q: 'marketing' }) }],
    ];

    it.each(leQuattro)('%s risponde 403 col solo codice (sprint 24 · T2.5)', async (_rotta, indirizzo, opzioni) => {
        expect(await rispostaDi(indirizzo, opzioni, '?accettazione=dopo&crm=1&da_leggere=1')).toStrictEqual({ stato: 403, corpo: { errore: 'accettazione_richiesta' } });
    });

    it.each(leQuattro)('%s senza il parametro, e con `?accettazione=1`, risponde come sempre: lì lo dicono i dati della pagina, non le rotte (sprint 24 · T2.5)', async (_rotta, indirizzo, opzioni) => {
        expect((await rispostaDi(indirizzo, opzioni, '?crm=1&da_leggere=1')).stato).toBe(200);
        vi.resetModules();
        expect((await rispostaDi(indirizzo, opzioni, '?accettazione=1&crm=1&da_leggere=1')).stato).toBe(200);
    });
});
