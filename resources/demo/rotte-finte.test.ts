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
    async function rotte(conOrologio: boolean): Promise<() => string> {
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
        expect(Object.keys(letture.corpo.data as object)).toEqual(['fino_a']);
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
        // Senza tipo: la chiave non c'è, come in una risposta di prima della v1.3.0.
        expect(notifiche.map((notifica) => Object.keys(notifica))).toEqual([
            ['id', 'creata_il', 'letta', 'app', 'tipo'], ['id', 'creata_il', 'letta', 'app', 'tipo'], ['id', 'creata_il', 'letta', 'app'], ['id', 'creata_il', 'letta', 'app', 'tipo'],
        ]);
        expect(notifiche.map(({ tipo }) => conosciuto(tipo))).toEqual([true, false, false, true]);
    });
});
