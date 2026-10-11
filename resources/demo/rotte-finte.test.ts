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
        expect(Object.keys(corpo)).toEqual(['data', 'aggiornati_il']);
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
        expect(Object.keys(elenco.corpo)).toEqual(['data']);
        expect(letture.stato).toBe(200);
        expect(Object.keys(letture.corpo)).toEqual(['data']);
        // Dalla `v1.3.0` la parte server dice sempre se ne restano: `altre` non è un istante, e c'è anche senza orologio.
        expect(Object.keys(letture.corpo.data as object)).toEqual(['fino_a', 'altre']);
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
        // cosa e per chi, come la parte server.
        const treDati = ['autore_nome', 'risorsa_nome', 'per_me'];
        expect(notifiche.map((notifica) => Object.keys(notifica))).toEqual([
            ['id', 'creata_il', 'letta', 'app', 'tipo', ...treDati], ['id', 'creata_il', 'letta', 'app', 'tipo', ...treDati], ['id', 'creata_il', 'letta', 'app', ...treDati], ['id', 'creata_il', 'letta', 'app', 'tipo', ...treDati],
        ]);
        expect(notifiche.map(({ tipo }) => conosciuto(tipo))).toEqual([true, false, false, true]);
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

    it('con `?chi=1` le notifiche d\'esempio sono i tre casi: una con chi e su che cosa rivolta alla persona, una con chi per tutto il workspace, le altre com\'erano; e quella che arriva dopo non li dice (sprint 20 · T1.7)', async () => {
        await rotte(false, '?chi=1&arriva=1');

        await rispostaDi('/cornice/notifiche');
        const { corpo } = await rispostaDi('/cornice/notifiche');
        expect((corpo.data as Record<string, unknown>[]).map(({ id, autore_nome, risorsa_nome, per_me }) => ({ id, autore_nome, risorsa_nome, per_me }))).toStrictEqual([
            { id: 'uat-5', autore_nome: null, risorsa_nome: null, per_me: null },
            { id: 'uat-4', autore_nome: 'Marta Rossi', risorsa_nome: 'UAT Scrivere il brief del lancio', per_me: true },
            { id: 'uat-3', autore_nome: 'Bruno Neri', risorsa_nome: null, per_me: false },
            { id: 'uat-2', autore_nome: null, risorsa_nome: null, per_me: null },
            { id: 'uat-1', autore_nome: null, risorsa_nome: null, per_me: null },
        ]);
        // Le otto chiavi della parte server, e nessun'altra (una non ha `tipo`: è il caso del titolo di ripiego).
        expect((corpo.data as Record<string, unknown>[]).map((notifica) => Object.keys(notifica).sort().join(' '))).toStrictEqual([
            'app autore_nome creata_il id letta per_me risorsa_nome tipo',
            'app autore_nome creata_il id letta per_me risorsa_nome tipo',
            'app autore_nome creata_il id letta per_me risorsa_nome tipo',
            'app autore_nome creata_il id letta per_me risorsa_nome',
            'app autore_nome creata_il id letta per_me risorsa_nome tipo',
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

    /** La risposta della rotta finta, che ci mette al più 1500 ms, sulla pagina di prova con quella query. */
    async function rispostaGrezzaDi(indirizzo: string, opzioni?: RequestInit, query = ''): Promise<Response> {
        (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(`https://uat.example.com/${query}`);
        const { rotteFinte } = await import('./rotte-finte');
        rotteFinte(() => 'uat-marketing');
        const inArrivo = fetch(indirizzo, opzioni);
        await vi.advanceTimersByTimeAsync(1500);

        return inArrivo;
    }

    /** Lo stato e il corpo JSON di quella risposta. */
    async function rispostaDi(indirizzo: string, opzioni?: RequestInit, query = ''): Promise<{ stato: number; corpo: Record<string, unknown> }> {
        const risposta = await rispostaGrezzaDi(indirizzo, opzioni, query);

        return { stato: risposta.status, corpo: (await risposta.json()) as Record<string, unknown> };
    }

    /** La richiesta della cornice per quella parola. */
    const cerca = (parola: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify({ q: parola }) });

    it('POST /cornice/ricerca dà i risultati d\'esempio che hanno nel titolo la parola del corpo, in ordine di titolo (sprint 18 · T1.7)', async () => {
        expect(await rispostaDi('/cornice/ricerca', cerca('marketing'))).toStrictEqual({ stato: 200, corpo: { data: [
            { tipo: 'board.cartelle', id: 'uat-3', titolo: 'UAT Marketing' },
            { tipo: 'board.board', id: 'uat-14', titolo: 'UAT Report marketing' },
        ] } });
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
