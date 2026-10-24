import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import inglese from '../lingue/notifiche/en.json';

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
        const { destinazioneDellaNotifica } = await import('../js/frasi');
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
    it.each([[''], ['?chi=1'], ['?crm=1'], ['?viste=1'], ['?opportunita=1'], ['?schede=1'], ['?frasi=1'], ['?motivi=1'], ['?crediti=1'], ['?chi=1&crm=1&viste=1&opportunita=1&arriva=1'], ['?chi=1&schede=1&arriva=1']])('ogni notifica di prova porta solo gli id che la parte server dà: quelli del percorso che si apre per il suo tipo, con %j (sprint 21 · review della PR #31, R1)', async (query) => {
        await rotte(false, query);
        // Dalla `v3.0.0` le righe delle destinazioni stanno in un file loro, per id del prodotto (sprint 70 · T1).
        const { default: righe } = await import('../registro/notifiche.json');

        await rispostaDi('/cornice/notifiche');
        const { corpo } = await rispostaDi('/cornice/notifiche');
        const notifiche = corpo.data as { id: string; app: string | null; tipo?: string; ids: Record<string, string> }[];
        // Sprint 23 · T3.5: un tipo può avere più percorsi (`altrimenti`), e la parte server dà gli id di uno solo, quello che si apre.
        const chiesteDaOgniPercorso = ({ app, tipo }: { app: string | null; tipo?: string }) => {
            const delTipo = (righe as Record<string, { tipo: string; percorso: string; altrimenti?: string[] }[] | undefined>)[app ?? '']?.find((notifica) => notifica.tipo === tipo);

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
    // Sprint 26 · T6 (voce #1773): con lo stesso parametro, subito dopo la scheda assegnata, una menzione in un commento.
    it('con `?schede=1` in cima all\'elenco c\'è la notifica a chi viene assegnata una scheda, da leggere, col tipo senza `com.zeiras.` davanti, chi l\'ha assegnata e il nome della scheda, poi una menzione in un commento, da leggere, col solo id della sua scheda, e in fondo una scheda eliminata, letta; zr-core conosce i tre tipi, le prime due aprono ognuna la sua scheda e l\'ultima no, e «Nuova scheda» apre la sua (sprint 24 · T3.1, T3.2, T3.4; sprint 26 · T6.1, T6.2)', async () => {
        await rotte(false, '?schede=1');

        const { corpo } = await rispostaDi('/cornice/notifiche');
        const notifiche = corpo.data as { id: string; creata_il: string; app: string | null; tipo?: string; letta: boolean; autore_nome: string | null; risorsa_nome: string | null; per_me: boolean | null; ids: Record<string, string> }[];
        const { destinazioneDellaNotifica } = await import('../js/frasi');
        const apre = (notifica: (typeof notifiche)[number]) => destinazioneDellaNotifica(notifica, 'uat-marketing', { pm: 'attivo', crm: 'attivo' }) ?? null;
        const [assegnata, menzione, eliminata] = [notifiche[0], notifiche[1], notifiche[6]];

        expect(notifiche.map(({ id }) => id)).toEqual(['uat-s1', 'uat-s3', 'uat-4', 'uat-3', 'uat-2', 'uat-1', 'uat-s2']);
        expect(assegnata).toEqual({ id: 'uat-s1', creata_il: assegnata?.creata_il, letta: false, app: 'pm', tipo: 'board.scheda.assegnata', autore_nome: 'Marta Rossi', risorsa_nome: 'UAT Preparare il lancio', per_me: true, ids: { id: 'uat-scheda-2' } });
        expect(menzione).toEqual({ id: 'uat-s3', creata_il: menzione?.creata_il, letta: false, app: 'pm', tipo: 'board.commento.menzione', autore_nome: 'Bruno Neri', risorsa_nome: 'UAT Rivedere il piano editoriale', per_me: true, ids: { id: 'uat-scheda-3' } });
        expect([eliminata?.app, eliminata?.tipo, eliminata?.letta, eliminata?.ids]).toEqual(['pm', 'com.zeiras.board.scheda.eliminata', true, {}]);
        expect([assegnata, menzione, eliminata].map((notifica) => Object.keys(inglese).includes(`notificationTitle.${notifica?.tipo}`))).toEqual([true, true, true]);
        expect(notifiche.map(apre)).toEqual(['https://board.zeiras.com/w/uat-marketing/c/uat-scheda-2', 'https://board.zeiras.com/w/uat-marketing/c/uat-scheda-3', 'https://board.zeiras.com/w/uat-marketing/c/uat-scheda-1', null, null, null, null]);
        expect(notifiche.map((notifica) => [typeof notifica.ids, 'dati' in notifica, 'soggetto' in notifica])).toEqual(notifiche.map(() => ['object', false, false]));
    });

    // Sprint 29 · T3 (voce #1865): le tre righe che una notifica di Project Management può avere stanno dietro `?frasi=1`, così le
    // pagine di prova di prima restano com'erano: una dice chi e che cosa, una solo chi, e una senza chi ha il titolo di sempre
    // col nome sotto. Sono lette, e stanno fra quelle di oggi e quella di ieri.
    it.each([
        ['it', [{ titolo: '\u{2068}Marta Rossi\u{2069} ha modificato la scheda «\u{2068}UAT Preparare il lancio\u{2069}»' }, { titolo: '\u{2068}Bruno Neri\u{2069} ha eliminato una scheda' }, { titolo: 'Scheda modificata', sotto: 'UAT Rivedere il piano editoriale' }]],
        ['en', [{ titolo: '\u{2068}Marta Rossi\u{2069} changed the card “\u{2068}UAT Preparare il lancio\u{2069}”' }, { titolo: '\u{2068}Bruno Neri\u{2069} deleted a card' }, { titolo: 'Card changed', sotto: 'UAT Rivedere il piano editoriale' }]],
        ['es', [{ titolo: '\u{2068}Marta Rossi\u{2069} ha modificado la tarjeta «\u{2068}UAT Preparare il lancio\u{2069}»' }, { titolo: '\u{2068}Bruno Neri\u{2069} ha eliminado una tarjeta' }, { titolo: 'Tarjeta modificada', sotto: 'UAT Rivedere il piano editoriale' }]],
    ])('con `?frasi=1` ci sono tre notifiche di Project Management, e nella lingua "%s" la prima dice chi e che cosa, la seconda solo chi, la terza il titolo col nome sotto (sprint 29 · T3.1)', async (lingua, righe) => {
        await rotte(false, '?frasi=1');
        const { rigaDellaNotifica } = await import('../js/frasi');

        const { corpo } = await rispostaDi('/cornice/notifiche');
        const notifiche = corpo.data as { id: string; app: string | null; tipo?: string; letta: boolean; autore_nome: string | null; risorsa_nome: string | null; ids: Record<string, string> }[];

        expect(notifiche.map(({ id }) => id)).toEqual(['uat-4', 'uat-3', 'uat-f1', 'uat-f2', 'uat-f3', 'uat-2', 'uat-1']);
        const nuove = notifiche.slice(2, 5);
        expect(nuove.map(({ app, tipo, letta, autore_nome, risorsa_nome, ids }) => [app, tipo, letta, autore_nome, risorsa_nome, ids])).toEqual([
            ['pm', 'com.zeiras.board.scheda.modificata', true, 'Marta Rossi', 'UAT Preparare il lancio', { id: 'uat-scheda-2' }],
            ['pm', 'com.zeiras.board.scheda.eliminata', true, 'Bruno Neri', null, {}],
            ['pm', 'com.zeiras.board.scheda.modificata', true, null, 'UAT Rivedere il piano editoriale', { id: 'uat-scheda-3' }],
        ]);
        expect(nuove.map((notifica) => rigaDellaNotifica(notifica, lingua))).toEqual(righe);
    });

    // Sprint 32 · T3 (voce #1913): una notifica che racconta più azioni sta dietro `?accorpata=1`, così le pagine di prova di prima
    // restano com'erano. È come la dava la parte server prima della `v2.1.0`, e resta per le schermate: l'istante dell'ultima
    // azione in `creata_il`, e le chiavi di allora (dalla `v2.1.0` sono undici, con `azioni` e `board_nome`: quelle di `?conto=1`).
    it('con `?accorpata=1` in cima all\'elenco c\'è una notifica che racconta più azioni, da leggere: in `creata_il` ha l\'istante dell\'ultima, due minuti fa, sopra quella di cinque minuti fa, e non porta `ultima_azione_il`, `azioni` né `board` (sprint 32 · T3.1, T3.4)', async () => {
        await rotte(false, '?accorpata=1');
        const { rigaDellaNotifica } = await import('../js/frasi');

        const notifiche = (await rispostaDi('/cornice/notifiche')).corpo.data as { id: string; creata_il: string; letta: boolean; tipo?: string }[];
        const [prima, seconda] = notifiche;
        const minutiFa = (notifica: { creata_il: string } | undefined) => Math.round((Date.now() - new Date(notifica?.creata_il ?? '').getTime()) / 60_000);

        expect([prima?.id, prima?.letta, prima?.tipo, minutiFa(prima)]).toEqual(['uat-a1', false, 'com.zeiras.board.lista.modificata', 2]);
        expect([seconda?.id, minutiFa(seconda)]).toEqual(['uat-4', 5]);
        expect(Object.keys(prima ?? {}).sort()).toEqual(['app', 'autore_nome', 'creata_il', 'id', 'ids', 'letta', 'per_me', 'risorsa_nome', 'tipo']);
        expect(rigaDellaNotifica(prima ?? {}, 'it')).toEqual({ titolo: '\u{2068}Bruno Neri\u{2069} ha modificato la lista «\u{2068}UAT Da fare\u{2069}»' });
    });

    // Sprint 34 · T2 (voce #1930): le notifiche con `azioni` e `board_nome` stanno dietro `?conto=1`, così le pagine di prova di
    // prima restano com'erano. Sono come le dà la parte server dalla `v2.1.0`: undici chiavi.
    it('con `?conto=1` in cima all\'elenco ci sono cinque notifiche con `azioni` e `board_nome`: il conto e la board, la sola board, il solo conto, il nome della cosa quando chi ha fatto non c\'è, e una board con un U+202E nel nome, che esce pulito (sprint 34 · T2.1, T2.2, T2.3, T2.4)', async () => {
        await rotte(false, '?conto=1');
        const { rigaDellaNotifica } = await import('../js/frasi');
        const isolato = (nome: string) => `\u{2068}${nome}\u{2069}`;

        const notifiche = ((await rispostaDi('/cornice/notifiche')).corpo.data as { id: string; letta: boolean; tipo?: string }[]).slice(0, 5);

        expect(notifiche.map(({ id, letta }) => [id, letta])).toEqual([['uat-k1', false], ['uat-k2', true], ['uat-k3', true], ['uat-k4', true], ['uat-k5', true]]);
        for (const notifica of notifiche) {
            expect(Object.keys(notifica).sort()).toEqual(['app', 'autore_nome', 'azioni', 'board_nome', 'creata_il', 'id', 'ids', 'letta', 'per_me', 'risorsa_nome', 'tipo']);
        }
        expect(notifiche.map((notifica) => rigaDellaNotifica(notifica, 'it'))).toEqual([
            { titolo: `${isolato('Bruno Neri')} ha modificato la scheda «${isolato('UAT Bozza')}»`, sotto: `3 volte, nella board «${isolato('UAT Lancio')}»` },
            { titolo: `${isolato('Bruno Neri')} ha creato la scheda «${isolato('UAT Brief')}»`, sotto: `Nella board «${isolato('UAT Lancio')}»` },
            { titolo: `${isolato('Bruno Neri')} ha modificato l'area «${isolato('UAT Clienti')}»`, sotto: '3 volte' },
            { titolo: 'Scheda modificata', sotto: 'UAT Piano' },
            { titolo: `${isolato('Bruno Neri')} ha modificato la lista «${isolato('UAT Da fare')}»`, sotto: `2 volte, nella board «${isolato('UAT oicnaL')}»` },
        ]);
        expect(rigaDellaNotifica(notifiche[0] ?? {}, 'en').sotto).toBe(`3 times, on the board “${isolato('UAT Lancio')}”`);
        expect(rigaDellaNotifica(notifiche[0] ?? {}, 'es').sotto).toBe(`3 veces, en el tablero «${isolato('UAT Lancio')}»`);
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
        const { destinazioneDellaNotifica } = await import('../js/frasi');
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
        const { destinazioneDellaNotifica } = await import('../js/frasi');
        const nelCrm = 'https://crm.zeiras.com/w/uat-marketing';
        expect(notifiche.slice(4).map((notifica) => destinazioneDellaNotifica(notifica, 'uat-marketing', { pm: 'attivo', crm: 'attivo' }) ?? null)).toEqual([
            `${nelCrm}/opportunita/uat-opp-1`, `${nelCrm}/opportunita/uat-opp-1`,
            `${nelCrm}/da-fare`, `${nelCrm}/da-fare`, `${nelCrm}/da-fare`,
            `${nelCrm}/contatti/uat-persona-1`, `${nelCrm}/aziende/uat-azienda-1`, `${nelCrm}/opportunita/uat-opp-1`, `${nelCrm}/da-fare`,
        ]);
        expect(notifiche.slice(4).map((notifica) => destinazioneDellaNotifica(notifica, 'uat-marketing', { pm: 'attivo' }) ?? null)).toEqual(Array(9).fill(null));
        expect(notifiche.map((notifica) => [typeof notifica.ids, 'dati' in notifica, 'soggetto' in notifica])).toEqual(notifiche.map(() => ['object', false, false]));
    });

    // Sprint 36 · T5 (voce #1970): i due tipi dei motivi di perdita del CRM stanno dietro `?motivi=1`, così le pagine di prova di
    // prima restano com'erano.
    it.each([['', false], ['&chi=1', true]])('con `?motivi=1%s` in fondo all\'elenco ci sono le due notifiche dei motivi di perdita del CRM, lette e senza id: hanno il titolo nelle tre lingue, con chi la frase, e dalla `v2.7.0` aprono le Impostazioni del CRM, se il CRM si può aprire (sprint 36 · T5.1, T5.2, T5.3)', async (inPiu, conChi) => {
        await rotte(false, `?motivi=1${inPiu}`);

        const { corpo } = await rispostaDi('/cornice/notifiche');
        const notifiche = corpo.data as { id: string; app: string | null; tipo?: string; letta: boolean; autore_nome: string | null; risorsa_nome: string | null; ids: Record<string, string> }[];
        const { destinazioneDellaNotifica } = await import('../js/frasi');
        const { rigaDellaNotifica } = await import('../js/frasi');
        const isolato = (nome: string) => `\u{2068}${nome}\u{2069}`;

        expect(notifiche.slice(-2).map(({ id, app, tipo, letta, autore_nome, risorsa_nome, ids }) => [id, app, tipo, letta, autore_nome, risorsa_nome, ids])).toEqual([
            ['uat-m1', 'crm', 'com.zeiras.crm.motivo.creato', true, conChi ? 'Giulia Bianchi' : null, null, {}],
            ['uat-m2', 'crm', 'com.zeiras.crm.motivo.modificato', true, conChi ? 'Giulia Bianchi' : null, null, {}],
        ]);
        // Sprint 41 · T2.1: dalla `v2.7.0` aprono le Impostazioni del CRM; col CRM che non si può aprire, niente.
        expect(notifiche.slice(-2).map((notifica) => destinazioneDellaNotifica(notifica, 'uat-marketing', { pm: 'attivo', crm: 'attivo' }) ?? null)).toEqual(['https://crm.zeiras.com/w/uat-marketing/impostazioni', 'https://crm.zeiras.com/w/uat-marketing/impostazioni']);
        expect(notifiche.slice(-2).map((notifica) => destinazioneDellaNotifica(notifica, 'uat-marketing', { pm: 'attivo' }) ?? null)).toEqual([null, null]);
        expect(['it', 'en', 'es'].map((lingua) => notifiche.slice(-2).map((notifica) => rigaDellaNotifica(notifica, lingua)))).toEqual(conChi
            ? [
                  [{ titolo: `${isolato('Giulia Bianchi')} ha creato un motivo di perdita` }, { titolo: `${isolato('Giulia Bianchi')} ha modificato un motivo di perdita` }],
                  [{ titolo: `${isolato('Giulia Bianchi')} created a loss reason` }, { titolo: `${isolato('Giulia Bianchi')} edited a loss reason` }],
                  [{ titolo: `${isolato('Giulia Bianchi')} ha creado un motivo de pérdida` }, { titolo: `${isolato('Giulia Bianchi')} ha modificado un motivo de pérdida` }],
              ]
            : [
                  [{ titolo: 'Nuovo motivo di perdita' }, { titolo: 'Motivo di perdita modificato' }],
                  [{ titolo: 'New loss reason' }, { titolo: 'Loss reason changed' }],
                  [{ titolo: 'Nuevo motivo de pérdida' }, { titolo: 'Motivo de pérdida modificado' }],
              ]);
    });

    // Sprint 34 · T3 (voce #1931): con `?chi=1` le quattro assegnate di `?opportunita=1` dicono chi; l'azienda e l'opportunità
    // portano anche il nome, e lo hanno nel titolo; un'attività senza nome e un contatto restano con la frase con solo chi.
    it('con `?opportunita=1&chi=1` l\'azienda e l\'opportunità assegnate hanno il nome nel titolo, nelle tre lingue; il contatto e l\'attività senza nome hanno la frase con solo chi, e il nome di un contatto, se arrivasse, non entra nel titolo (sprint 34 · T3.1, T3.2, T3.3)', async () => {
        await rotte(false, '?opportunita=1&chi=1');
        const { rigaDellaNotifica } = await import('../js/frasi');

        const notifiche = (await rispostaDi('/cornice/notifiche')).corpo.data as { id: string; tipo?: string; risorsa_nome?: string | null }[];
        const [contatto, azienda, opportunita, attivita] = ['uat-o6', 'uat-o7', 'uat-o8', 'uat-o9'].map((id) => notifiche.find((notifica) => notifica.id === id) ?? {});
        const CHI = '\u{2068}Giulia Bianchi\u{2069}';
        const isolato = (nome: string) => `\u{2068}${nome}\u{2069}`;

        expect([contatto, azienda, opportunita, attivita].map((notifica) => ('risorsa_nome' in notifica ? notifica.risorsa_nome : undefined))).toEqual([null, 'UAT Acme', 'UAT Rinnovo 2027', null]);
        expect((['it', 'es', 'en'] as const).map((lingua) => rigaDellaNotifica(azienda ?? {}, lingua))).toEqual([
            { titolo: `${CHI} ti ha assegnato l'azienda «${isolato('UAT Acme')}»` }, { titolo: `${CHI} te ha asignado la empresa «${isolato('UAT Acme')}»` }, { titolo: `${CHI} assigned you the company “${isolato('UAT Acme')}”` },
        ]);
        expect((['it', 'es', 'en'] as const).map((lingua) => rigaDellaNotifica(opportunita ?? {}, lingua))).toEqual([
            { titolo: `${CHI} ti ha assegnato l'opportunità «${isolato('UAT Rinnovo 2027')}»` }, { titolo: `${CHI} te ha asignado la oportunidad «${isolato('UAT Rinnovo 2027')}»` }, { titolo: `${CHI} assigned you the opportunity “${isolato('UAT Rinnovo 2027')}”` },
        ]);
        expect((['it', 'es', 'en'] as const).map((lingua) => rigaDellaNotifica({ ...attivita, risorsa_nome: 'UAT Richiamare' }, lingua).titolo)).toEqual([
            `${CHI} ti ha assegnato l'attività «${isolato('UAT Richiamare')}»`, `${CHI} te ha asignado la actividad «${isolato('UAT Richiamare')}»`, `${CHI} assigned you the activity “${isolato('UAT Richiamare')}”`,
        ]);
        // Senza il nome: la frase con solo chi, mai le virgolette vuote (T3.3). Il contatto resta senza anche se un nome arrivasse (T3.2).
        expect([contatto, attivita].map((notifica) => rigaDellaNotifica(notifica ?? {}, 'it'))).toEqual([{ titolo: `${CHI} ti ha assegnato un contatto` }, { titolo: `${CHI} ti ha assegnato un'attività` }]);
        expect(rigaDellaNotifica({ ...contatto, risorsa_nome: 'UAT Mario Rossi' }, 'it').titolo).toBe(`${CHI} ti ha assegnato un contatto`);
    });

    // Sprint 32 · T4 (voce #1914): cinque notifiche del CRM con chi ha fatto stanno dietro `?nomi_crm=1` — un'azienda e
    // un'opportunità col nome, un contatto e un'attività eliminata, di cui il backoffice non dà il nome, e un'azienda senza nome.
    it('con `?nomi_crm=1` in cima all\'elenco ci sono cinque notifiche del CRM con chi ha fatto: l\'azienda e l\'opportunità col nome lo hanno nel titolo, nelle tre lingue, e sotto niente; il contatto, l\'attività eliminata e l\'azienda senza nome hanno la frase con solo chi (sprint 32 · T4.1, T4.2)', async () => {
        await rotte(false, '?nomi_crm=1');
        const { rigaDellaNotifica } = await import('../js/frasi');

        const notifiche = (await rispostaDi('/cornice/notifiche')).corpo.data as { id: string; letta: boolean; app?: string | null; tipo?: string; risorsa_nome?: string | null; ids?: Record<string, string> }[];
        const [azienda, opportunita, contatto, eliminata, senzaNome, sesta] = notifiche;
        const CHI = '\u{2068}Giulia Bianchi\u{2069}';
        const isolato = (nome: string) => `\u{2068}${nome}\u{2069}`;

        expect(notifiche.slice(0, 5).map(({ id, letta, app, tipo, risorsa_nome, ids }) => [id, letta, app, tipo, risorsa_nome, ids])).toEqual([
            ['uat-z1', false, 'crm', 'com.zeiras.crm.organizzazione.modificata', 'UAT Acme', { id: 'uat-azienda-1' }],
            ['uat-z2', false, 'crm', 'com.zeiras.crm.trattativa.creata', 'UAT Rinnovo 2027', { id: 'uat-opp-1' }],
            ['uat-z3', true, 'crm', 'com.zeiras.crm.persona.modificata', null, { id: 'uat-persona-1' }],
            ['uat-z4', true, 'crm', 'com.zeiras.crm.attivita.eliminata', null, {}],
            ['uat-z5', true, 'crm', 'com.zeiras.crm.organizzazione.creata', null, { id: 'uat-azienda-1' }],
        ]);
        expect(sesta?.id).toBe('uat-4');
        expect(Object.keys(azienda ?? {}).sort()).toEqual(['app', 'autore_nome', 'creata_il', 'id', 'ids', 'letta', 'per_me', 'risorsa_nome', 'tipo']);
        expect((['it', 'es', 'en'] as const).map((lingua) => rigaDellaNotifica(azienda ?? {}, lingua))).toEqual([
            { titolo: `${CHI} ha modificato l'azienda «${isolato('UAT Acme')}»` }, { titolo: `${CHI} ha modificado la empresa «${isolato('UAT Acme')}»` }, { titolo: `${CHI} edited the company “${isolato('UAT Acme')}”` },
        ]);
        expect((['it', 'es', 'en'] as const).map((lingua) => rigaDellaNotifica(opportunita ?? {}, lingua))).toEqual([
            { titolo: `${CHI} ha creato l'opportunità «${isolato('UAT Rinnovo 2027')}»` }, { titolo: `${CHI} ha creado la oportunidad «${isolato('UAT Rinnovo 2027')}»` }, { titolo: `${CHI} created the opportunity “${isolato('UAT Rinnovo 2027')}”` },
        ]);
        // Con solo chi: mai le virgolette vuote, e niente sotto il titolo (T4.2).
        expect([contatto, eliminata, senzaNome].map((notifica) => rigaDellaNotifica(notifica ?? {}, 'it'))).toEqual([
            { titolo: `${CHI} ha modificato un contatto` }, { titolo: `${CHI} ha eliminato un'attività` }, { titolo: `${CHI} ha creato un'azienda` },
        ]);
        // Un nome di soli spazi vale come un nome che manca; e il nome di un contatto, se arrivasse, non entra nel titolo.
        expect(rigaDellaNotifica({ ...azienda, risorsa_nome: '  ' }, 'it')).toEqual({ titolo: `${CHI} ha modificato un'azienda` });
        expect(rigaDellaNotifica({ ...contatto, risorsa_nome: 'UAT Mario Rossi' }, 'it').titolo).toBe(`${CHI} ha modificato un contatto`);
    });

    // v2.25.3: il credito di un pacchetto sotto zero sta dietro `?crediti=1`, così le pagine di prova di prima restano com'erano.
    it.each([['', false], ['&chi=1', true]])('con `?crediti=1%s` in fondo all\'elenco c\'è la notifica del credito sotto zero del CRM, letta e col solo `persona_id`: ha il titolo nelle tre lingue, con chi la frase, e apre il contatto, se il CRM si può aprire (v2.25.3)', async (inPiu, conChi) => {
        await rotte(false, `?crediti=1${inPiu}`);

        const { corpo } = await rispostaDi('/cornice/notifiche');
        const notifiche = corpo.data as { id: string; app: string | null; tipo?: string; letta: boolean; autore_nome: string | null; risorsa_nome: string | null; per_me: boolean | null; ids: Record<string, string> }[];
        const { destinazioneDellaNotifica } = await import('../js/frasi');
        const { rigaDellaNotifica, titoloDellaNotifica } = await import('../js/frasi');
        const ultima = notifiche.at(-1)!;

        expect([ultima.id, ultima.app, ultima.tipo, ultima.letta, ultima.autore_nome, ultima.risorsa_nome, ultima.per_me, ultima.ids]).toEqual(['uat-d1', 'crm', 'crm.acquisto.scoperto', true, conChi ? 'Giulia Bianchi' : null, conChi ? 'UAT Pacchetto 10 lezioni' : null, conChi ? true : null, { persona_id: 'uat-persona-1' }]);
        expect(destinazioneDellaNotifica(ultima, 'uat-marketing', { pm: 'attivo', crm: 'attivo' })).toBe('https://crm.zeiras.com/w/uat-marketing/contatti/uat-persona-1');
        expect(destinazioneDellaNotifica(ultima, 'uat-marketing', { pm: 'attivo' })).toBeUndefined();
        expect(['it', 'en', 'es'].map((lingua) => titoloDellaNotifica('crm.acquisto.scoperto', lingua))).toEqual(['Credito sotto zero: cliente da avvisare', 'Credit below zero: client to notify', 'Crédito bajo cero: cliente por avisar']);
        expect(rigaDellaNotifica(ultima, 'it').titolo).toBe(conChi ? '\u{2068}Giulia Bianchi\u{2069} ha registrato un consumo oltre i crediti: cliente da avvisare' : 'Credito sotto zero: cliente da avvisare');
    });

    it.each([
        ['', ['uat-4', 'uat-3', 'uat-2', 'uat-1']],
        ['?crm=1', ['uat-4', 'uat-3', 'uat-2', 'uat-1', ...Array.from({ length: 12 }, (_, indice) => `uat-c${indice + 1}`)]],
        ['?crm=1&viste=1', ['uat-4', 'uat-3', 'uat-2', 'uat-1', ...Array.from({ length: 12 }, (_, indice) => `uat-c${indice + 1}`), 'uat-v1', 'uat-v2', 'uat-v3']],
        ['?opportunita=1', ['uat-4', 'uat-3', 'uat-2', 'uat-1', ...Array.from({ length: 9 }, (_, indice) => `uat-o${indice + 1}`)]],
        ['?frasi=1', ['uat-4', 'uat-3', 'uat-f1', 'uat-f2', 'uat-f3', 'uat-2', 'uat-1']],
        ['?motivi=1', ['uat-4', 'uat-3', 'uat-2', 'uat-1', 'uat-m1', 'uat-m2']],
        ['?opportunita=1&motivi=1', ['uat-4', 'uat-3', 'uat-2', 'uat-1', ...Array.from({ length: 9 }, (_, indice) => `uat-o${indice + 1}`), 'uat-m1', 'uat-m2']],
        ['?crediti=1', ['uat-4', 'uat-3', 'uat-2', 'uat-1', 'uat-d1']],
        ['?motivi=1&crediti=1', ['uat-4', 'uat-3', 'uat-2', 'uat-1', 'uat-m1', 'uat-m2', 'uat-d1']],
        ['?accorpata=1', ['uat-a1', 'uat-4', 'uat-3', 'uat-2', 'uat-1']],
        ['?conto=1', ['uat-k1', 'uat-k2', 'uat-k3', 'uat-k4', 'uat-k5', 'uat-4', 'uat-3', 'uat-2', 'uat-1']],
        ['?nomi_crm=1', ['uat-z1', 'uat-z2', 'uat-z3', 'uat-z4', 'uat-z5', 'uat-4', 'uat-3', 'uat-2', 'uat-1']],
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
        // Le chiavi che la parte server dava prima della `v2.1.0` (dallo sprint 21 anche `ids`), e nessun'altra (una non ha `tipo`: è il
        // caso del titolo di ripiego). Dalla `v2.1.0` la parte server ne dà undici, con `azioni` e `board_nome`: qui le hanno quelle di `?conto=1`.
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
        // Sprint 28 · T1.6: un'opportunità aperta e una vinta, con l'`esito` che il backoffice dà a ogni opportunità.
        { tipo: 'crm.trattativa', id: 'uat-t1', titolo: 'UAT Rinnovo 2027', contesto: { pipeline: 'UAT Vendite', fase: 'UAT Proposta', esito: 'aperta' } },
        { tipo: 'crm.trattativa', id: 'uat-t2', titolo: 'UAT Fornitura 2026', contesto: { pipeline: 'UAT Vendite', fase: 'UAT Contratto', esito: 'vinta' } },
    ];
    // Sprint 27 · T2 (voce #1787): un membro del workspace, col solo ruolo e come codice, c'è senza parametri: non dipende da un
    // modulo, e il backoffice lo dà in ogni workspace. Viene dopo le altre fonti nuove e prima di board e cartelle, come in
    // ricerca.crea.
    const membro = { tipo: 'workspace.membro', id: 'uat-m1', titolo: 'UAT Katherine Johnson', contesto: { ruolo: 'amministratore' } };
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
        ['senza parametri dà un membro del workspace e poi ciò che dava sul tag `v1.14.0`: board e cartelle in ordine di titolo, e in fondo i due tipi che il registro non ha', '', [membro, ...diPrima]],
        ['con `?schede=1` per prima c\'è una scheda, col suo `contesto`, e il membro viene dopo', '?schede=1', [scheda, membro, ...diPrima]],
        ['con `?crm_attivo=1` per primi ci sono contatti, aziende e opportunità, ognuno col suo `contesto`, e il membro viene dopo', '?crm_attivo=1', [...delCrm, membro, ...diPrima]],
        ['con tutti e due, nell\'ordine di ricerca.crea: schede, contatti, aziende, opportunità e membri, poi board e cartelle', '?schede=1&crm_attivo=1', [scheda, ...delCrm, membro, ...diPrima]],
        // Letture della PR #56, N3: `crm_attivo` c'è, ed è `senza_crm` a togliere i risultati del CRM. Senza `crm_attivo`
        // mancherebbero comunque, e il caso resterebbe verde anche se la rotta finta non guardasse `senza_crm`.
        ['con `?senza_crm=1` i risultati del CRM non ci sono, nemmeno con `?crm_attivo=1`; il membro sì, che non è di un modulo', '?schede=1&crm_attivo=1&senza_crm=1', [scheda, membro, ...diPrima]],
        ['con `?senza_crm=1` e senza `?schede` il membro c\'è lo stesso', '?senza_crm=1', [membro, ...diPrima]],
        // Sprint 27 · T7.6: senza moduli attivi il backoffice cerca i soli membri, che non sono di un modulo.
        ['con `?senza_moduli=1` nessun modulo è attivo nel workspace e c\'è il solo membro, anche con `?schede=1&crm_attivo=1`', '?schede=1&crm_attivo=1&senza_moduli=1', [membro]],
    ])('cercando «uat» la ricerca finta %s (sprint 25 · T4.1, T4.2; T6, R13; sprint 27 · T2.5)', async (_caso, query, attesi) => {
        expect((await rispostaDi('/cornice/ricerca', cerca('uat'), query)).corpo.data).toStrictEqual(attesi);
    });

    // Sprint 28 · T5.1 (seconda lettura della PR #60, S3). Senza moduli attivi c'è il solo membro per ogni parola: anche per «ua»,
    // che altrove dà il risultato vecchio di una board, e che il nome del membro contiene.
    it.each([['ua'], ['uat']])('con `?senza_moduli=1` cercando «%s» la ricerca finta dà il solo membro, e nessuna board (sprint 28 · T5.1)', async (parola) => {
        expect((await rispostaDi('/cornice/ricerca', cerca(parola), '?schede=1&crm_attivo=1&senza_moduli=1')).corpo.data).toStrictEqual([membro]);
    });

    // Sprint 26 · T4 (lettura della PR #56, R8). `?ricerca_frenata=<secondi>` fa rispondere alla prima ricerca come la parte
    // server quando il backoffice frena — 429 `troppe_richieste` con `Retry-After` —, e alle successive come sempre: così sulla
    // pagina di prova si vede la cornice che aspetta.
    it('con `?ricerca_frenata=5` la prima ricerca risponde 429 `troppe_richieste` con `Retry-After: 5`, e le successive come sempre (sprint 26 · T4)', async () => {
        const prima = await rispostaGrezzaDi('/cornice/ricerca', cerca('uat'), '?ricerca_frenata=5');
        expect([prima.status, prima.headers.get('Retry-After'), await prima.json()]).toStrictEqual([429, '5', { errore: 'troppe_richieste' }]);

        const seconda = await rispostaGrezzaDi('/cornice/ricerca', cerca('uat'), '?ricerca_frenata=5');
        expect([seconda.status, seconda.headers.get('Retry-After'), ((await seconda.json()) as { data: unknown[] }).data.length > 0]).toStrictEqual([200, null, true]);
    });

    // Letture della PR #56, N2. Di `contesto` la rotta vera lascia uscire le sole chiavi che il registro dà al tipo, coi soli
    // testi non vuoti, e `null` quando non ne resta nessuno: mai un `null` fra i valori, mai un oggetto vuoto. La rotta finta
    // non dà altre forme: un contatto senza azienda né ruolo ha `null`.
    // Sprint 27 · T2 (voce #1787): di un membro la rotta vera lascia uscire il solo `ruolo`, e il backoffice lo dà come codice: la
    // rotta finta non gli dà altre chiavi (mai l'email), e il suo ruolo è uno dei codici del registro.
    it('di `contesto` la ricerca finta dà solo le forme della rotta vera: `null`, o i testi delle chiavi che il registro dà al tipo; un contatto senza azienda né ruolo ha `null`, e un membro ha il solo ruolo, come codice del registro (sprint 26 · T1.3; sprint 27 · T2.5)', async () => {
        const { registro } = await import('../js/registro');
        const risorsaDi = (tipo: unknown) => registro.flatMap((voce) => voce.risorse ?? []).find((risorsa) => risorsa.tipo === tipo);
        const chiaviDi = (tipo: unknown) => risorsaDi(tipo)?.contesto ?? [];
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
        expect(risultati.filter(({ contesto }) => contesto !== null).map(({ id }) => id)).toStrictEqual(['uat-s1', 'uat-p1', 'uat-t1', 'uat-t2', 'uat-m1']);
        // Dove il registro dice che una chiave porta un codice, il valore è uno dei suoi codici. Fuori resta la sola opportunità
        // aperta (sprint 28 · T1.6): `aperta` è un valore del contratto e non un codice del registro, ed è così che non si mostra.
        const fuoriCodice = risultati.filter(({ tipo, contesto }) => Object.entries(risorsaDi(tipo)?.codici ?? {}).some(([chiave, codici]) => !codici.includes(String(contesto?.[chiave]))));
        expect(fuoriCodice.map(({ id, contesto }) => [id, contesto?.esito])).toStrictEqual([['uat-t1', 'aperta']]);
        expect(risultati.filter(({ tipo }) => tipo === 'crm.trattativa').map(({ id, contesto }) => [id, contesto?.esito])).toStrictEqual([['uat-t1', 'aperta'], ['uat-t2', 'vinta']]);
        expect(risultati.filter(({ tipo }) => tipo === 'workspace.membro')).toStrictEqual([{ tipo: 'workspace.membro', id: 'uat-m1', titolo: 'UAT Katherine Johnson', contesto: { ruolo: 'amministratore' } }]);
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

// Sprint 37 · T1.1 (voci 1998 e 1999). Le rotte vere rispondono coi dati di chi è nella sessione quando la richiesta arriva: in
// una scheda rimasta ferma su una pagina di un'altra persona, elenco e risultati sono di chi è entrato. Sulla pagina di prova
// del layout, con `?sessione`, le rotte finte ricevono la persona della «sessione» e lo dicono nel testo: se elenco e risultati
// fossero gli stessi per le due persone, la prova di una scheda ferma sarebbe verde per caso.
describe('con la persona della «sessione» l\'elenco delle notifiche e i risultati della ricerca sono di chi è entrato, col nome nel testo', () => {
    const fetchDiPrima = window.fetch;
    const ada = { nome: 'UAT Ada Lovelace', email: 'uat-zr-core@example.com' };
    const grace = { nome: 'UAT Grace Hopper', email: 'uat-zr-core-2@example.com' };
    type Riga = { id: string; letta: boolean; risorsa_nome: string | null; titolo?: string };

    beforeEach(() => {
        // La notifica di ognuna resta nel browser (sprint 38 · T1): ogni caso parte da un browser nuovo.
        localStorage.clear();
        vi.resetModules();
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        vi.spyOn(console, 'info').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        window.fetch = fetchDiPrima;
    });

    /** Le rotte finte nel workspace `uat-marketing`, con la persona che `sessione.persona` dice in quel momento (o senza dirla: `null`). */
    async function rotte(sessione: { persona: typeof ada | undefined } | null, query = ''): Promise<void> {
        (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(`https://uat.example.com/${query}`);
        const { rotteFinte } = await import('./rotte-finte');
        if (sessione === null) {
            rotteFinte(() => 'uat-marketing');
        } else {
            rotteFinte(() => 'uat-marketing', undefined, () => sessione.persona);
            // Come la pagina di chi è nella «sessione»: la cornice dice sempre di chi è la pagina che chiede (`Persona`), e dalla
            // `v2.13.0` una richiesta che non lo dice riceve 422. Un caso che vuole un'altra persona la dice; uno che non ne
            // vuole nessuna chiede a `senzaPersona`.
            senzaPersona = window.fetch;
            window.fetch = (indirizzo, opzioni) => {
                const headers = new Headers(opzioni?.headers);
                if (!headers.has('Persona') && sessione.persona) {
                    headers.set('Persona', encodeURIComponent(sessione.persona.email));
                }

                return senzaPersona(indirizzo, { ...opzioni, headers });
            };
        }
    }
    let senzaPersona: typeof fetch;

    /** Le righe di `data` nella risposta di una rotta, e il suo stato. */
    async function righeDi(indirizzo: string, opzioni?: RequestInit): Promise<{ stato: number; righe: Riga[] }> {
        const inArrivo = fetch(indirizzo, opzioni);
        await vi.advanceTimersByTimeAsync(1500);
        const risposta = await inArrivo;
        const { data } = (await risposta.json()) as { data?: unknown };

        return { stato: risposta.status, righe: Array.isArray(data) ? (data as Riga[]) : [] };
    }

    const cerca = (parola: string): RequestInit => ({ method: 'POST', body: JSON.stringify({ q: parola }) });
    const nomi = (righe: Riga[]) => righe.map(({ risorsa_nome }) => risorsa_nome);
    const titoli = (righe: Riga[]) => righe.map(({ titolo }) => titolo);

    it('GET /cornice/notifiche ha in cima una notifica da leggere di chi è entrato adesso: «UAT scheda di Ada», poi «UAT scheda di Grace»; il resto dell\'elenco è lo stesso (sprint 37 · T1.1)', async () => {
        const sessione = { persona: ada };
        await rotte(sessione);
        const diAda = (await righeDi('/cornice/notifiche')).righe;
        sessione.persona = grace;
        const diGrace = (await righeDi('/cornice/notifiche')).righe;

        expect(diAda[0]).toMatchObject({ id: 'uat-di-ada', letta: false, risorsa_nome: 'UAT scheda di Ada' });
        expect(diGrace[0]).toMatchObject({ id: 'uat-di-grace', letta: false, risorsa_nome: 'UAT scheda di Grace' });
        expect(nomi(diGrace)).not.toContain('UAT scheda di Ada');
        expect(nomi(diAda)).not.toContain('UAT scheda di Grace');
        expect(diAda.slice(1).map(({ id }) => id)).toStrictEqual(['uat-4', 'uat-3', 'uat-2', 'uat-1']);
        expect(diGrace.slice(1)).toStrictEqual(diAda.slice(1));
    });

    // Sprint 38 · T4 (voce 2028): come la rotta vera dalla `v2.5.0`, «Segna tutte come lette» chiesta per chi c'era prima non
    // segna le notifiche di chi è entrato, e lo dice col 409 (dalla `v2.12.0` senza la sua email): in una scheda ferma la cornice ricarica la pagina.
    it('POST /cornice/notifiche/letture con la `persona` di chi c\'era prima non segna niente e risponde 409 `persona_diversa` con `persona` vuota (fino alla `v2.11.5` l\'email di chi è entrato), e la notifica di chi è entrato resta da leggere; con la sua, o senza `persona`, segna come prima (sprint 38 · T4.1)', async () => {
        const sessione = { persona: ada };
        await rotte(sessione);
        const segnaPer = async (persona?: string): Promise<[number, unknown]> => {
            const inArrivo = fetch('/cornice/notifiche/letture', { method: 'POST', body: JSON.stringify({ fino_a: new Date(Date.now() + 60_000).toISOString(), workspace: 'uat-marketing', persona }) });
            await vi.advanceTimersByTimeAsync(1500);
            const risposta = await inArrivo;

            return [risposta.status, ((await risposta.json()) as { errore?: unknown; persona?: unknown })];
        };
        sessione.persona = grace;

        expect(await segnaPer(ada.email)).toStrictEqual([409, { errore: 'persona_diversa', persona: '' }]);
        expect((await righeDi('/cornice/notifiche')).righe[0]).toMatchObject({ id: 'uat-di-grace', letta: false });

        expect((await segnaPer(grace.email))[0]).toBe(200);
        expect((await righeDi('/cornice/notifiche')).righe[0]).toMatchObject({ id: 'uat-di-grace', letta: true });
        sessione.persona = ada;
        expect((await segnaPer())[0]).toBe(200);
        expect((await righeDi('/cornice/notifiche')).righe[0]).toMatchObject({ id: 'uat-di-ada', letta: true });
    });

    // Sprint 39 · T1 (voce 2038): come la rotta vera, una `persona` che c'è e non è un testo non vale come assente. Non segna
    // niente e risponde 422. Dallo sprint 40 (T3), come nella rotta vera dalla `v2.6.0`, la persona si guarda prima del
    // workspace: anche con un altro workspace è quel 422, non più il 409 `workspace_diverso`.
    it.each([
        ['null', null], ['un numero', 7], ['true', true], ['una lista', [ada.email]], ['un oggetto', { email: ada.email }],
    ])('POST /cornice/notifiche/letture con una `persona` che non è un testo (%s) risponde 422 `dati_non_validi` e non segna niente, anche con un altro workspace: la persona si guarda prima (sprint 39 · T1.3, sprint 40 · T3.3)', async (_quale, persona) => {
        await rotte({ persona: ada });
        const segna = async (workspace: string): Promise<[number, unknown]> => {
            const inArrivo = fetch('/cornice/notifiche/letture', { method: 'POST', body: JSON.stringify({ fino_a: new Date(Date.now() + 60_000).toISOString(), workspace, persona }) });
            await vi.advanceTimersByTimeAsync(1500);
            const risposta = await inArrivo;

            return [risposta.status, await risposta.json()];
        };

        expect(await segna('uat-marketing')).toStrictEqual([422, { errore: 'dati_non_validi' }]);
        expect((await righeDi('/cornice/notifiche')).righe[0]).toMatchObject({ id: 'uat-di-ada', letta: false });
        expect(await segna('uat-vendite')).toStrictEqual([422, { errore: 'dati_non_validi' }]);
    });

    // Sprint 38 · T5 (R5 della review): come la rotta vera, che guarda di chi è la richiesta prima di chiamare il backoffice —
    // ed è il backoffice a dare il 403 —, il 409 `persona_diversa` viene prima del 403 di `?accettazione=dopo`.
    it('con `?accettazione=dopo&per_altra` la POST /cornice/notifiche/letture chiesta per chi c\'era prima risponde 409 `persona_diversa`, non il 403 di chi è entrato; chiesta per chi è entrato, il suo 403 (sprint 38 · T5, R5)', async () => {
        const sessione = { persona: ada };
        await rotte(sessione, '?accettazione=dopo&per_altra');
        const segnaPer = async (persona: string): Promise<[number, unknown]> => {
            const inArrivo = fetch('/cornice/notifiche/letture', { method: 'POST', body: JSON.stringify({ fino_a: new Date(Date.now() + 60_000).toISOString(), workspace: 'uat-marketing', persona }) });
            await vi.advanceTimersByTimeAsync(1500);
            const risposta = await inArrivo;

            return [risposta.status, await risposta.json()];
        };
        sessione.persona = grace;

        expect(await segnaPer(ada.email)).toStrictEqual([409, { errore: 'persona_diversa', persona: '' }]);
        expect(await segnaPer(grace.email)).toStrictEqual([403, { errore: 'accettazione_richiesta', persona: grace.email }]);
    });

    it('POST /cornice/ricerca dà fra i risultati una board di chi è entrato adesso: «UAT Lancio di Ada», poi «UAT Lancio di Grace»; gli altri sono gli stessi (sprint 37 · T1.1)', async () => {
        const sessione = { persona: ada };
        await rotte(sessione);
        const diAda = (await righeDi('/cornice/ricerca', cerca('lancio'))).righe;
        sessione.persona = grace;
        const diGrace = (await righeDi('/cornice/ricerca', cerca('lancio'))).righe;

        expect(titoli(diAda)).toStrictEqual(['UAT Lancio di Ada', 'UAT Lancio Q1', 'UAT Lancio Q4', 'UAT Scrivere il brief del lancio']);
        expect(titoli(diGrace)).toStrictEqual(['UAT Lancio di Grace', 'UAT Lancio Q1', 'UAT Lancio Q4', 'UAT Scrivere il brief del lancio']);
        expect(diAda[0]).toStrictEqual({ tipo: 'board.board', id: 'uat-di-ada', titolo: 'UAT Lancio di Ada', contesto: null });
        // Il nome si cerca come ogni titolo: chi è entrato trova la sua board, non quella dell'altra persona.
        expect(titoli((await righeDi('/cornice/ricerca', cerca('di grace'))).righe)).toStrictEqual(['UAT Lancio di Grace']);
        expect((await righeDi('/cornice/ricerca', cerca('di ada'))).righe).toStrictEqual([]);
    });

    it('ognuna ha la sua notifica: letta da una persona resta da leggere per l\'altra, e «Segna tutte come lette» segna quella di chi è nella sessione (sprint 37 · T1.1)', async () => {
        const sessione = { persona: ada };
        await rotte(sessione);
        expect((await righeDi('/cornice/notifiche/uat-di-ada/lettura', { method: 'PATCH', body: JSON.stringify({ letta: true }) })).stato).toBe(200);
        expect((await righeDi('/cornice/notifiche')).righe[0]).toMatchObject({ id: 'uat-di-ada', letta: true });

        sessione.persona = grace;
        // La notifica di Ada non è nell'elenco di Grace: non la può segnare.
        expect((await righeDi('/cornice/notifiche/uat-di-ada/lettura', { method: 'PATCH', body: JSON.stringify({ letta: true }) })).stato).toBe(404);
        expect((await righeDi('/cornice/notifiche')).righe[0]).toMatchObject({ id: 'uat-di-grace', letta: false });
        expect((await righeDi('/cornice/notifiche/letture', { method: 'POST', body: JSON.stringify({ fino_a: new Date().toISOString(), workspace: 'uat-marketing' }) })).stato).toBe(200);
        expect((await righeDi('/cornice/notifiche')).righe[0]).toMatchObject({ id: 'uat-di-grace', letta: true });
    });

    it('elenco e ricerca dicono di chi sono, come le rotte vere: `persona` è l\'email di chi è nella «sessione» adesso; senza la persona non lo dicono (sprint 37 · T4.3)', async () => {
        /** Che cosa la risposta dice di chi è; `null` se non lo dice. */
        const diChi = async (indirizzo: string, opzioni?: RequestInit) => {
            const inArrivo = fetch(indirizzo, opzioni);
            await vi.advanceTimersByTimeAsync(1500);
            const corpo = (await (await inArrivo).json()) as Record<string, unknown>;

            return 'persona' in corpo ? corpo.persona : null;
        };
        const sessione: { persona: typeof ada | undefined } = { persona: ada };
        await rotte(sessione);
        const diAda = [await diChi('/cornice/notifiche'), await diChi('/cornice/ricerca', cerca('lancio'))];
        sessione.persona = grace;
        const diGrace = [await diChi('/cornice/notifiche'), await diChi('/cornice/ricerca', cerca('lancio'))];
        sessione.persona = undefined;
        const diNessuno = [await diChi('/cornice/notifiche'), await diChi('/cornice/ricerca', cerca('lancio'))];

        expect([diAda, diGrace, diNessuno]).toStrictEqual([[ada.email, ada.email], [grace.email, grace.email], [null, null]]);
    });

    // Sprint 38 · T1 (voci 2026, 2028): ciò che serve a vedere, in una scheda rimasta ferma, l'errore di chi è entrato dopo e di
    // chi sono le notifiche segnate. Se il 403 finto valesse per tutte e due le persone il difetto non si distinguerebbe dal
    // caso di sempre: la scheda di Ada sarebbe ridotta anche senza Grace.
    it('con `?accettazione=dopo&per_altra` il 403 `accettazione_richiesta` è solo di chi è entrato dopo: a chi era nella «sessione» al caricamento le rotte rispondono come sempre (sprint 38 · T1.1)', async () => {
        const sessione = { persona: ada };
        await rotte(sessione, '?accettazione=dopo&per_altra');
        expect((await righeDi('/cornice/notifiche')).stato).toBe(200);
        expect((await righeDi('/cornice/ricerca', cerca('lancio'))).stato).toBe(200);

        sessione.persona = grace;
        const inArrivo = fetch('/cornice/notifiche');
        await vi.advanceTimersByTimeAsync(1500);
        const risposta = await inArrivo;
        // Come la rotta vera dalla `v2.5.0` (sprint 38 · T3.4): il 403 dice di chi è.
        expect([risposta.status, await risposta.json()]).toStrictEqual([403, { errore: 'accettazione_richiesta', persona: grace.email }]);
        expect((await righeDi('/cornice/ricerca', cerca('lancio'))).stato).toBe(403);
        expect((await righeDi('/cornice/notifiche/letture', { method: 'POST', body: JSON.stringify({ fino_a: new Date().toISOString(), workspace: 'uat-marketing' }) })).stato).toBe(403);

        // Torna la prima: di nuovo come sempre.
        sessione.persona = ada;
        expect((await righeDi('/cornice/notifiche')).righe[0]).toMatchObject({ id: 'uat-di-ada', letta: false });
    });

    it('senza `per_altra` il 403 di `?accettazione=dopo` resta di chiunque sia nella «sessione», come prima (sprint 38 · T1.1)', async () => {
        const sessione = { persona: ada };
        await rotte(sessione, '?accettazione=dopo');
        expect((await righeDi('/cornice/notifiche')).stato).toBe(403);
        sessione.persona = grace;
        expect((await righeDi('/cornice/notifiche')).stato).toBe(403);
    });

    it('il 403 di `?accettazione=dopo` dice di chi è, come le rotte vere: `persona` è l\'email di chi è nella «sessione» adesso, sulle quattro rotte; senza la persona non lo dice (sprint 38 · T3.4)', async () => {
        const leQuattro: [string, RequestInit?][] = [
            ['/cornice/notifiche'],
            ['/cornice/notifiche/uat-c1/lettura', { method: 'PATCH', body: JSON.stringify({ letta: true }) }],
            ['/cornice/notifiche/letture', { method: 'POST', body: JSON.stringify({ fino_a: '2026-10-10T00:00:00.000Z', workspace: 'uat-marketing' }) }],
            ['/cornice/ricerca', cerca('lancio')],
        ];
        const corpi = async () => {
            const tutti: unknown[] = [];
            for (const [indirizzo, opzioni] of leQuattro) {
                const inArrivo = fetch(indirizzo, opzioni);
                await vi.advanceTimersByTimeAsync(1500);
                const risposta = await inArrivo;
                tutti.push([risposta.status, await risposta.json()]);
            }

            return tutti;
        };
        const sessione: { persona: typeof ada | undefined } = { persona: ada };
        await rotte(sessione, '?accettazione=dopo');

        expect(await corpi()).toStrictEqual(leQuattro.map(() => [403, { errore: 'accettazione_richiesta', persona: ada.email }]));
        sessione.persona = grace;
        expect(await corpi()).toStrictEqual(leQuattro.map(() => [403, { errore: 'accettazione_richiesta', persona: grace.email }]));
        sessione.persona = undefined;
        expect(await corpi()).toStrictEqual(leQuattro.map(() => [403, { errore: 'accettazione_richiesta' }]));
    });

    it('con `?ricerca_frenata=5&per_altra` il 429 è della prima ricerca di chi è entrato dopo, non di chi era nella «sessione» al caricamento (sprint 38 · T1.1)', async () => {
        const sessione = { persona: ada };
        await rotte(sessione, '?ricerca_frenata=5&per_altra');
        expect((await righeDi('/cornice/ricerca', cerca('lancio'))).stato).toBe(200);
        expect((await righeDi('/cornice/ricerca', cerca('lancio'))).stato).toBe(200);

        sessione.persona = grace;
        const inArrivo = fetch('/cornice/ricerca', cerca('lancio'));
        await vi.advanceTimersByTimeAsync(1500);
        const frenata = await inArrivo;
        // Come la rotta vera dalla `v2.5.0` (sprint 38 · T3.4): il 429 dice di chi è.
        expect([frenata.status, frenata.headers.get('Retry-After'), await frenata.json()]).toStrictEqual([429, '5', { errore: 'troppe_richieste', persona: grace.email }]);
        // Una volta sola, come senza `per_altra`.
        expect(titoli((await righeDi('/cornice/ricerca', cerca('lancio'))).righe)[0]).toBe('UAT Lancio di Grace');
    });

    it('la lettura della notifica di una persona resta nel browser: dopo un ricaricamento della pagina è ancora letta, e quella dell\'altra è ancora da leggere (sprint 38 · T1.1)', async () => {
        const sessione = { persona: grace };
        await rotte(sessione);
        expect((await righeDi('/cornice/notifiche/letture', { method: 'POST', body: JSON.stringify({ fino_a: new Date().toISOString(), workspace: 'uat-marketing' }) })).stato).toBe(200);

        // La pagina ricaricata: un modulo nuovo, lo stesso browser.
        vi.resetModules();
        await rotte(sessione);
        expect((await righeDi('/cornice/notifiche')).righe[0]).toMatchObject({ id: 'uat-di-grace', letta: true });
        sessione.persona = ada;
        expect((await righeDi('/cornice/notifiche')).righe[0]).toMatchObject({ id: 'uat-di-ada', letta: false });

        // E una lettura tolta si toglie anche lì.
        sessione.persona = grace;
        expect((await righeDi('/cornice/notifiche/uat-di-grace/lettura', { method: 'PATCH', body: JSON.stringify({ letta: false }) })).stato).toBe(200);
        vi.resetModules();
        await rotte(sessione);
        expect((await righeDi('/cornice/notifiche')).righe[0]).toMatchObject({ id: 'uat-di-grace', letta: false });
    });

    it('senza la persona, o quando la «sessione» non ne ha una, elenco e risultati sono quelli di prima: nessuna riga col nome di qualcuno (sprint 37 · T1.1)', async () => {
        await rotte(null);
        const elenco = (await righeDi('/cornice/notifiche')).righe;
        const risultati = (await righeDi('/cornice/ricerca', cerca('lancio'))).righe;
        vi.resetModules();
        await rotte({ persona: undefined });

        expect(elenco.map(({ id }) => id)).toStrictEqual(['uat-4', 'uat-3', 'uat-2', 'uat-1']);
        expect(titoli(risultati)).toStrictEqual(['UAT Lancio Q1', 'UAT Lancio Q4', 'UAT Scrivere il brief del lancio']);
        expect((await righeDi('/cornice/notifiche')).righe.map(({ id }) => id)).toStrictEqual(['uat-4', 'uat-3', 'uat-2', 'uat-1']);
        expect(titoli((await righeDi('/cornice/ricerca', cerca('lancio'))).righe)).toStrictEqual(['UAT Lancio Q1', 'UAT Lancio Q4', 'UAT Scrivere il brief del lancio']);
    });

    // Sprint 40 · T3 (voce #2051): come le rotte vere dalla `v2.6.0` (`StessaPersona`), le quattro guardano di chi è la
    // richiesta prima di ogni loro controllo: lo dice l'intestazione `Persona` (l'email passata da `encodeURIComponent`: così
    // la manda la cornice) o `persona` nel corpo. Prima lo guardava solo «Segna tutte come lette», dopo i suoi controlli.
    const dice = (email: string) => ({ Persona: encodeURIComponent(email) });
    const leQuattroDi = (headers?: Record<string, string>, nelCorpo: Record<string, unknown> = {}): [string, RequestInit][] => [
        ['/cornice/notifiche', { headers }],
        ['/cornice/ricerca', { method: 'POST', headers, body: JSON.stringify({ q: 'lancio', ...nelCorpo }) }],
        ['/cornice/notifiche/letture', { method: 'POST', headers, body: JSON.stringify({ fino_a: '2026-10-10T00:00:00.000Z', workspace: 'uat-marketing', ...nelCorpo }) }],
        ['/cornice/notifiche/uat-4/lettura', { method: 'PATCH', headers, body: JSON.stringify({ letta: true, ...nelCorpo }) }],
    ];
    const esitoDi = async (indirizzo: string, opzioni?: RequestInit): Promise<[number, unknown]> => {
        const inArrivo = fetch(indirizzo, opzioni);
        await vi.advanceTimersByTimeAsync(1500);
        const risposta = await inArrivo;

        return [risposta.status, risposta.status === 405 ? null : await risposta.json()];
    };
    const esiti = async (richieste: [string, RequestInit][]) => {
        const tutti: [number, unknown][] = [];
        for (const [indirizzo, opzioni] of richieste) {
            tutti.push(await esitoDi(indirizzo, opzioni));
        }

        return tutti;
    };
    const stati = async (richieste: [string, RequestInit][]) => (await esiti(richieste)).map(([stato]) => stato);
    // Dalla `v2.12.0` (sprint 51 · T1) il 409 non dice chi è entrato: `persona` è un testo vuoto, come nella parte server.
    const diUnAltro: [number, unknown] = [409, { errore: 'persona_diversa', persona: '' }];
    const nonValida: [number, unknown] = [422, { errore: 'dati_non_validi' }];

    it('le quattro rotte, chieste con la `Persona` di chi c\'era prima, rispondono 409 `persona_diversa` con `persona` vuota (fino alla `v2.11.5` la sola email di chi è entrato) e non fanno niente: la notifica del clic resta da leggere a chi è entrato; con la sua rispondono come sempre (sprint 40 · T3.2, T3.3)', async () => {
        const sessione = { persona: ada };
        await rotte(sessione);
        const diGrace = async () => (await righeDi('/cornice/notifiche', { headers: dice(grace.email) })).righe.filter(({ id }) => ['uat-di-grace', 'uat-4'].includes(id)).map(({ id, letta }) => [id, letta]);
        sessione.persona = grace;
        expect(await diGrace()).toStrictEqual([['uat-di-grace', false], ['uat-4', false]]);

        expect(await esiti(leQuattroDi(dice(ada.email)))).toStrictEqual(leQuattroDi().map(() => diUnAltro));
        expect(await diGrace()).toStrictEqual([['uat-di-grace', false], ['uat-4', false]]);

        expect(await stati(leQuattroDi(dice(grace.email)))).toStrictEqual([200, 200, 200, 200]);
        expect(await diGrace()).toStrictEqual([['uat-di-grace', false], ['uat-4', true]]);
    });

    it('una `Persona` vuota, o una `persona` nel corpo che non è un testo o è vuota, è un 422 `dati_non_validi` su ogni rotta, e viene prima del 409: non vale come non detta; detta in tutti e due i posti, valgono tutti e due (sprint 40 · T3.3)', async () => {
        const sessione = { persona: ada };
        await rotte(sessione);
        sessione.persona = grace;

        expect(await esiti(leQuattroDi({ Persona: '' }))).toStrictEqual(leQuattroDi().map(() => nonValida));
        for (const persona of [null, '', 12, ['uat']]) {
            expect(await esiti(leQuattroDi(dice(grace.email), { persona }).slice(1))).toStrictEqual([nonValida, nonValida, nonValida]);
        }
        // Il 422 prima del 409: una vuota accanto a quella di un'altra persona.
        expect(await esiti(leQuattroDi({ Persona: '' }, { persona: ada.email }).slice(1))).toStrictEqual([nonValida, nonValida, nonValida]);
        expect(await esiti(leQuattroDi(dice(ada.email), { persona: '' }).slice(1))).toStrictEqual([nonValida, nonValida, nonValida]);
        // Tutti e due i posti: basta che uno non sia quello della «sessione».
        expect(await esiti(leQuattroDi(dice(grace.email), { persona: ada.email }).slice(1))).toStrictEqual([1, 2, 3].map(() => diUnAltro));
        expect(await esiti(leQuattroDi(dice(ada.email), { persona: grace.email }).slice(1))).toStrictEqual([1, 2, 3].map(() => diUnAltro));
        expect(await stati(leQuattroDi(dice(grace.email), { persona: grace.email }).slice(1))).toStrictEqual([200, 200, 200]);
    });

    it('una richiesta che non dice la persona è un 422 `persona_mancante` con `persona` vuota su ogni rotta e non segna niente, come le rotte vere dalla `v2.13.0` (sprint 52 · T1.4)', async () => {
        const sessione = { persona: ada };
        await rotte(sessione);
        const senza = async (richieste: [string, RequestInit][]) => {
            const tutti: [number, unknown][] = [];
            for (const [indirizzo, opzioni] of richieste) {
                const inArrivo = senzaPersona(indirizzo, opzioni);
                await vi.advanceTimersByTimeAsync(1500);
                const risposta = await inArrivo;
                tutti.push([risposta.status, await risposta.json()]);
            }

            return tutti;
        };

        expect(await senza(leQuattroDi())).toStrictEqual(leQuattroDi().map(() => [422, { errore: 'persona_mancante', persona: '' }]));
        // Niente è stato segnato: la notifica letta dalla quarta e quelle di «Segna tutte» sono ancora da leggere.
        expect((await righeDi('/cornice/notifiche')).righe.find(({ id }) => id === 'uat-4')?.letta).toBe(false);
        // Un'intestazione con un altro nome non la dice.
        expect(await senza(leQuattroDi({ 'X-Persona': encodeURIComponent(ada.email) }).slice(0, 1))).toStrictEqual([[422, { errore: 'persona_mancante', persona: '' }]]);
        // Dove la pagina di prova non dice chi è nella «sessione» le rotte rispondono come prima: lo provano gli altri gruppi di
        // questo file, che chiedono senza `Persona`.
    });

    it('la persona si guarda prima dei controlli di ogni rotta, come nella parte server: a chi c\'era prima il 409 `persona_diversa` anche con una parola corta, un altro workspace, un istante sbagliato, un `letta` che non è un booleano, una notifica che non c\'è; solo il 405 viene prima (sprint 40 · T3.3)', async () => {
        const sessione = { persona: ada };
        await rotte(sessione);
        sessione.persona = grace;
        const sbagliate = (headers: Record<string, string>): [string, RequestInit][] => [
            ['/cornice/ricerca', { method: 'POST', headers, body: JSON.stringify({ q: 'a' }) }],
            ['/cornice/notifiche/letture', { method: 'POST', headers, body: JSON.stringify({ fino_a: '2026-10-10T00:00:00.000Z', workspace: 'uat-vendite' }) }],
            ['/cornice/notifiche/letture', { method: 'POST', headers, body: JSON.stringify({ fino_a: 'ieri', workspace: 'uat-marketing' }) }],
            ['/cornice/notifiche/uat-4/lettura', { method: 'PATCH', headers, body: JSON.stringify({ letta: 'sì' }) }],
            ['/cornice/notifiche/uat-non-c-e/lettura', { method: 'PATCH', headers, body: JSON.stringify({ letta: true }) }],
        ];

        expect(await esiti(sbagliate(dice(ada.email)))).toStrictEqual(sbagliate({}).map(() => diUnAltro));
        expect(await esiti(sbagliate(dice(grace.email)))).toStrictEqual([nonValida, [409, { errore: 'workspace_diverso' }], nonValida, nonValida, [404, { errore: 'non_trovato' }]]);
        // Una rotta che in GET non c'è non arriva a guardare di chi è la richiesta.
        expect(await esitoDi('/cornice/ricerca', { headers: dice(ada.email) })).toStrictEqual([405, null]);
    });

    it('con `?accettazione=dopo` a chi c\'era prima le quattro rotte rispondono il 409 `persona_diversa`, non il 403 di chi è entrato: il 403 lo dà il backoffice, e la rotta non lo chiama (sprint 40 · T3.3)', async () => {
        const sessione = { persona: ada };
        await rotte(sessione, '?accettazione=dopo');
        sessione.persona = grace;

        expect(await esiti(leQuattroDi(dice(ada.email)))).toStrictEqual(leQuattroDi().map(() => diUnAltro));
        expect(await esiti(leQuattroDi(dice(grace.email)))).toStrictEqual(leQuattroDi().map(() => [403, { errore: 'accettazione_richiesta', persona: grace.email }]));
    });

    it('un\'email con caratteri fuori da Latin-1 è riconosciuta dalla sua forma codificata; e dove la pagina di prova non dice chi è nella «sessione» una `Persona` non cambia niente (sprint 40 · T3.3)', async () => {
        const lucja = { nome: 'UAT Łucja Żółć', email: 'łucja.żółć+uat@example.com' };
        await rotte({ persona: lucja });
        expect(await stati(leQuattroDi(dice(lucja.email)))).toStrictEqual([200, 200, 200, 200]);
        expect(await esiti(leQuattroDi(dice(ada.email)))).toStrictEqual(leQuattroDi().map(() => diUnAltro));

        vi.resetModules();
        await rotte(null);
        expect(await stati(leQuattroDi(dice(ada.email)))).toStrictEqual([200, 200, 200, 200]);
    });
});
