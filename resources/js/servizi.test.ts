import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cerca } from './ricerca';
import { AccettazioneRichiesta, caricaNotifiche, mostra, segnaLetta, segnaLetteFinoA, TroppeRichieste } from './servizi';

// Sprint 22 · T2 (voce #1712): la lettura di una notifica sola, che la cornice chiede col clic che apre la sua risorsa
// (`PATCH /cornice/notifiche/<id>/lettura`). Che cosa ne fa la cornice lo prova cornice.test.tsx.

/** Una risposta della rotta, come `fetch` la dà: lo stato e il corpo JSON. */
function risposta(corpo: unknown, stato = 200): Response {
    return { ok: stato >= 200 && stato < 300, status: stato, json: async () => corpo } as Response;
}

/** Il cookie del gettone CSRF che Laravel dà alla pagina; senza valore, scaduto. */
function cookieCsrf(valore?: string): void {
    const nome = 'XSRF-TOKEN';
    document.cookie = valore === undefined ? `${nome}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/` : `${nome}=${valore}; path=/`;
}

const unIstante = '2026-10-06T12:00:08.123456Z';

describe('segnaLetta', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        cookieCsrf();
    });

    it.each([
        ['col cookie del gettone CSRF lo porta in X-XSRF-TOKEN', 'eyJpdiI6Ik1h%3D%3D', { 'X-XSRF-TOKEN': 'eyJpdiI6Ik1h==' }],
        ['senza il cookie parte senza X-XSRF-TOKEN', undefined, {}],
    ])('chiede PATCH /cornice/notifiche/<id>/lettura con {"letta": true} e con keepalive, e dà l\'istante della parte server: %s (sprint 22 · T2.1)', async (_quale, cookie, gettone) => {
        cookieCsrf(cookie);
        const fetchFinto = vi.fn(async (_indirizzo: string, _opzioni?: RequestInit) => risposta({ data: { id: 'uat-n69', letta: true }, segnata_il: unIstante }));
        vi.stubGlobal('fetch', fetchFinto);

        await expect(segnaLetta('uat-n69', 'ada@example.com')).resolves.toStrictEqual({ il: unIstante });
        expect(fetchFinto.mock.calls).toStrictEqual([
            ['/cornice/notifiche/uat-n69/lettura', { method: 'PATCH', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Persona: 'ada%40example.com', ...gettone }, body: '{"letta":true}', keepalive: true }],
        ]);
    });

    it('la richiesta parte subito, nello stesso giro di chi la chiama: chi apre un\'altra pagina subito dopo l\'ha già mandata (sprint 22 · T2.1)', async () => {
        const fetchFinto = vi.fn(async (_indirizzo: string, _opzioni?: RequestInit) => risposta({ data: { id: 'uat-n69', letta: true } }));
        vi.stubGlobal('fetch', fetchFinto);

        const lettura = segnaLetta('uat-n69', 'ada@example.com');
        expect(fetchFinto).toHaveBeenCalledTimes(1);
        await lettura;
    });

    it.each([
        ['uat-n69', '/cornice/notifiche/uat-n69/lettura'],
        ['Uat_n-3', '/cornice/notifiche/Uat_n-3/lettura'],
        ['a'.repeat(64), `/cornice/notifiche/${'a'.repeat(64)}/lettura`],
    ])('l\'id «%s» ha la forma che la rotta vuole, e sta nel suo pezzo dell\'indirizzo (sprint 22 · T2.1)', async (id, indirizzo) => {
        const fetchFinto = vi.fn(async (_indirizzo: string, _opzioni?: RequestInit) => risposta({ data: { id, letta: true } }));
        vi.stubGlobal('fetch', fetchFinto);

        await segnaLetta(id, 'ada@example.com');
        expect(fetchFinto.mock.calls.map(([chiesto]) => chiesto)).toStrictEqual([indirizzo]);
    });

    // Review della PR #44, R6: `encodeURIComponent` non tocca i punti, e con `.` o `..` il browser normalizza l'indirizzo: la
    // `PATCH`, col gettone CSRF, arriverebbe a un'altra rotta. Prima di chiedere l'id ha la forma che la rotta vuole —
    // lettere, cifre, `-` e `_`, da 1 a 64 —, o la richiesta non parte.
    it.each([
        ['.'],
        ['..'],
        [''],
        ['a.b'],
        ['a/b'],
        ['../letture'],
        ['a?b#c'],
        ['a b'],
        ['à'],
        ['uat-n69\n'],
        ['a'.repeat(65)],
    ])('un id che non ha la forma che la rotta vuole («%s») non fa partire la richiesta, ed è una lettura non riuscita (review della PR #44, R6)', async (id) => {
        const fetchFinto = vi.fn(async (_indirizzo: string, _opzioni?: RequestInit) => risposta({ data: { id, letta: true } }));
        vi.stubGlobal('fetch', fetchFinto);

        await expect(segnaLetta(id, 'ada@example.com')).rejects.toThrow('PATCH /cornice/notifiche/{id}/lettura: id');
        expect(fetchFinto).not.toHaveBeenCalled();
    });

    // Seconda lettura della PR #52, S9 (sprint 25 · T5.7). L'elenco delle notifiche arriva dalla parte server con una conversione
    // di tipo, non con un controllo: un id può non essere un testo. Un'espressione regolare lo converte da sé, e `69`, `null` e
    // `undefined` hanno la forma di un id: la `PATCH`, col gettone CSRF, partirebbe per `/cornice/notifiche/null/lettura`.
    it.each<[string, unknown]>([
        ['un numero', 69],
        ['`null`', null],
        ['`undefined`', undefined],
        ['`true`', true],
        ['una lista con un id', ['uat-n69']],
    ])('un id che non è un testo (%s) non fa partire la richiesta, ed è una lettura non riuscita (sprint 25 · T5.7)', async (_quale, id) => {
        const fetchFinto = vi.fn(async (_indirizzo: string, _opzioni?: RequestInit) => risposta({ data: { id, letta: true } }));
        vi.stubGlobal('fetch', fetchFinto);

        await expect(segnaLetta(id as string, 'ada@example.com')).rejects.toThrow('PATCH /cornice/notifiche/{id}/lettura: id');
        expect(fetchFinto).not.toHaveBeenCalled();
    });

    it.each([
        ['manca', {}],
        ['è senza i microsecondi', { segnata_il: '2026-10-06T12:00:08Z' }],
        ['è in un altro fuso', { segnata_il: '2026-10-06T14:00:08.123456+02:00' }],
        ['non è un testo', { segnata_il: 20261006120008 }],
        ['è `null`', { segnata_il: null }],
    ])('una risposta con `letta: true` il cui istante %s non è un errore: è senza segno (sprint 22 · T2.5)', async (_come, conLIstante) => {
        vi.stubGlobal('fetch', vi.fn(async () => risposta({ data: { id: 'uat-n69', letta: true }, ...conLIstante })));

        await expect(segnaLetta('uat-n69', 'ada@example.com')).resolves.toStrictEqual({ il: undefined });
    });

    it.each([
        ['404', risposta({ errore: 'non_trovato' }, 404)],
        ['419, col gettone CSRF scaduto', risposta({ message: 'CSRF token mismatch.' }, 419)],
        ['503', risposta({}, 503)],
        ['`letta: false`', risposta({ data: { id: 'uat-n69', letta: false }, segnata_il: unIstante })],
        ['`letta` che non è un booleano', risposta({ data: { id: 'uat-n69', letta: 'true' }, segnata_il: unIstante })],
        ['`data` che manca', risposta({ segnata_il: unIstante })],
        ['`data: null`', risposta({ data: null, segnata_il: unIstante })],
        ['un corpo che non è un oggetto', risposta(null)],
    ])('una risposta con %s è un errore, mai una lettura riuscita (sprint 22 · T2.3)', async (_come, dellaRotta) => {
        vi.stubGlobal('fetch', vi.fn(async () => dellaRotta));

        await expect(segnaLetta('uat-n69', 'ada@example.com')).rejects.toThrow('PATCH /cornice/notifiche/uat-n69/lettura');
    });
});

// Sprint 22 · T6 (voce #1726): la ricerca dice di quale workspace sono i risultati (`workspace`, lo slug della sessione), e la
// cornice li apre lì. Senza, i risultati non hanno un indirizzo sicuro: è un errore, come una risposta senza la lista.

describe('cerca', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('chiede POST /cornice/ricerca con la sola parola nel corpo, e dà i risultati col workspace di cui sono, come lo dice la parte server (sprint 22 · T6.5)', async () => {
        const risultati = [{ tipo: 'board.board', id: 'uat-13', titolo: 'UAT Lancio' }];
        const fetchFinto = vi.fn(async (_indirizzo: string, _opzioni?: RequestInit) => risposta({ data: risultati, workspace: 'uat-vendite' }));
        vi.stubGlobal('fetch', fetchFinto);

        await expect(cerca('uat', new AbortController().signal, 'ada@example.com')).resolves.toStrictEqual({ risultati, workspace: 'uat-vendite' });
        expect(fetchFinto.mock.calls.map(([indirizzo, opzioni]) => [indirizzo, opzioni?.method, opzioni?.body])).toStrictEqual([['/cornice/ricerca', 'POST', '{"q":"uat"}']]);
    });

    it.each<[string, unknown, string]>([
        ['senza `workspace`', { data: [] }, 'POST /cornice/ricerca: workspace'],
        ['con `workspace` null', { data: [], workspace: null }, 'POST /cornice/ricerca: workspace'],
        ['con un `workspace` che è un numero', { data: [], workspace: 12 }, 'POST /cornice/ricerca: workspace'],
        ['con un `workspace` che è un oggetto', { data: [], workspace: { slug: 'uat-vendite' } }, 'POST /cornice/ricerca: workspace'],
        ['con un `workspace` vuoto', { data: [], workspace: '' }, 'POST /cornice/ricerca: workspace'],
        ['senza la lista, col suo `workspace`', { data: null, workspace: 'uat-vendite' }, 'POST /cornice/ricerca: data'],
    ])('una risposta %s è un errore: mai dei risultati senza il loro workspace, mai un elenco vuoto (sprint 22 · T6.6)', async (_caso, corpo, errore) => {
        vi.stubGlobal('fetch', vi.fn(async () => risposta(corpo)));

        await expect(cerca('uat', new AbortController().signal, 'ada@example.com')).rejects.toThrow(errore);
    });

    // Sprint 23 · T2 (voce #1742, S4): lo `workspace` della risposta entra nell'indirizzo di ogni risultato, e ci entra solo con la
    // forma di uno slug, la stessa che vale per una notifica: `..` e `.` cambierebbero l'indirizzo (`encodeURIComponent` non
    // tocca i punti). Fuori forma è l'errore della ricerca, come senza `workspace`.
    it.each(['..', '.', 'Acme', 'a/b', 'acme_marketing', 'acme-', 'acme marketing'])('una risposta con un `workspace` fuori dalla forma di uno slug — «%s» — è un errore: nessun risultato (sprint 23 · T2.3)', async (workspace) => {
        vi.stubGlobal('fetch', vi.fn(async () => risposta({ data: [{ tipo: 'board.board', id: 'uat-13', titolo: 'UAT Lancio' }], workspace })));

        await expect(cerca('uat', new AbortController().signal, 'ada@example.com')).rejects.toThrow('POST /cornice/ricerca: workspace');
    });

    it.each(['acme', 'acme-marketing', 'a', '9', 'uat-marketing-2'])('uno slug buono — «%s» — non è un errore: i risultati arrivano col loro workspace (sprint 23 · T2.3)', async (workspace) => {
        const risultati = [{ tipo: 'board.board', id: 'uat-13', titolo: 'UAT Lancio' }];
        vi.stubGlobal('fetch', vi.fn(async () => risposta({ data: risultati, workspace })));

        await expect(cerca('uat', new AbortController().signal, 'ada@example.com')).resolves.toStrictEqual({ risultati, workspace });
    });
});

// Sprint 24 · T2 (voce #1745): se la persona non ha accettato i documenti legali in vigore le quattro rotte della cornice
// rispondono 403 col codice, `{"errore":"accettazione_richiesta"}`, e dalla `v2.5.0` con l'email di chi è (`persona`). Per la cornice non è un guasto: le quattro chiamate
// lanciano `AccettazioneRichiesta`, che lei riconosce. Ogni altro esito resta l'errore di prima.
describe('il 403 `accettazione_richiesta` di una rotta della cornice', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const chiamate: [string, () => Promise<unknown>][] = [
        ['caricaNotifiche', () => caricaNotifiche('ada@example.com')],
        ['segnaLetteFinoA', () => segnaLetteFinoA('2026-10-06T11:55:00+00:00', 'acme-marketing', 'ada@example.com')],
        ['segnaLetta', () => segnaLetta('uat-n69', 'ada@example.com')],
        ['cerca', () => cerca('lancio', new AbortController().signal, 'ada@example.com')],
    ];
    /** Come una chiamata finisce: con quell'errore, con un altro, o bene. */
    const esitoDi = (chiama: () => Promise<unknown>) => chiama().then(() => 'riuscita', (errore: unknown) => (errore instanceof AccettazioneRichiesta ? 'AccettazioneRichiesta' : errore instanceof Error ? 'Error' : 'altro'));

    it.each(chiamate)('%s: col 403 e il corpo {"errore":"accettazione_richiesta"} lancia AccettazioneRichiesta, che è un errore come gli altri per chi non la guarda (sprint 24 · T2.5)', async (_nome, chiama) => {
        vi.stubGlobal('fetch', vi.fn(async () => risposta({ errore: 'accettazione_richiesta' }, 403)));

        const errore: unknown = await chiama().then(() => undefined, (lanciato: unknown) => lanciato);
        expect(errore).toBeInstanceOf(AccettazioneRichiesta);
        expect(errore).toBeInstanceOf(Error);
    });

    // Lettura della PR #52, R10. Le rotte della cornice danno il codice in `errore`. zr-auth, da sé, a una richiesta JSON risponde
    // 403 col codice in `codice` e i documenti che mancano in `mancanti`: arriva al browser se un middleware del frontend chiama
    // il backoffice anche su una rotta della cornice e nessuno prende quell'errore. Per la cornice è lo stesso segnale.
    it.each(chiamate)('%s: col 403 e il corpo che dà zr-auth, {"codice":"accettazione_richiesta","mancanti":[…]}, lancia AccettazioneRichiesta come col codice in `errore` (sprint 24 · T5, R10)', async (_nome, chiama) => {
        vi.stubGlobal('fetch', vi.fn(async () => risposta({ codice: 'accettazione_richiesta', mancanti: ['termini', 'privacy'] }, 403)));

        expect(await esitoDi(chiama)).toBe('AccettazioneRichiesta');
    });

    it.each<[string, () => Response]>([
        ['un 403 con un altro `errore`', () => risposta({ errore: 'gettone_senza_workspace' }, 403)],
        ['un 403 senza `errore`', () => risposta({}, 403)],
        ['un 403 col codice sotto una chiave che non è né `errore` né `codice`', () => risposta({ code: 'accettazione_richiesta' }, 403)],
        ['un 403 con un altro `codice`', () => risposta({ codice: 'gettone_senza_workspace', mancanti: [] }, 403)],
        ['un 403 con un `codice` che lo contiene soltanto', () => risposta({ codice: 'accettazione_richiesta_altro' }, 403)],
        ['un 409 con lo stesso `codice`', () => risposta({ codice: 'accettazione_richiesta', mancanti: ['termini'] }, 409)],
        ['un 403 con un `errore` che lo contiene soltanto', () => risposta({ errore: 'accettazione_richiesta_altro' }, 403)],
        ['un 403 con un corpo `null`', () => risposta(null, 403)],
        ['un 403 con un corpo che non è JSON', () => ({ ok: false, status: 403, json: async () => { throw new SyntaxError('Unexpected end of JSON input'); } }) as unknown as Response],
        ['un 409 con lo stesso `errore`', () => risposta({ errore: 'accettazione_richiesta' }, 409)],
        ['un 500 con lo stesso `errore`', () => risposta({ errore: 'accettazione_richiesta' }, 500)],
        ['un 200 con lo stesso `errore`', () => risposta({ errore: 'accettazione_richiesta' })],
    ])('%s resta l\'errore di prima per tutte e quattro le chiamate, non AccettazioneRichiesta (sprint 24 · T2.5)', async (_caso, risponde) => {
        vi.stubGlobal('fetch', vi.fn(async () => risponde()));

        expect(await Promise.all(chiamate.map(([, chiama]) => esitoDi(chiama)))).toStrictEqual(['Error', 'Error', 'Error', 'Error']);
    });

    it('la rete giù resta l\'errore di `fetch`, non AccettazioneRichiesta (sprint 24 · T2.5)', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));

        expect(await Promise.all(chiamate.map(([, chiama]) => esitoDi(chiama)))).toStrictEqual(['Error', 'Error', 'Error', 'Error']);
    });
});

// Sprint 26 · T4 (lettura della PR #56, R8): il freno del backoffice. Quando una rotta della cornice risponde 429 con
// `Retry-After` — i secondi che il backoffice ha detto, un intero da 1 in su — l'errore è `TroppeRichieste`, e li porta: che
// cosa farne lo decide chi ha chiamato (la cornice ferma la ricerca per quei secondi: cornice.test.tsx). Senza
// quell'intestazione, o con un valore che non è un intero da 1 in su, è l'errore di sempre; e lo è ogni altro stato, anche con
// l'intestazione.
describe('il 429 con `Retry-After` di una rotta della cornice', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    /** Una risposta con quello stato e, se c'è, quel `Retry-After`: come `fetch` la dà, con le sue intestazioni. */
    const frenata = (stato: number, riprovaFra?: string) => ({
        ok: false,
        status: stato,
        headers: new Headers(riprovaFra === undefined ? {} : { 'Retry-After': riprovaFra }),
        json: async () => ({ errore: 'troppe_richieste' }),
    }) as unknown as Response;
    /** L'errore con cui la ricerca finisce. */
    const erroreDellaRicerca = () => cerca('uat', new AbortController().signal, 'ada@example.com').then(() => undefined, (errore: unknown) => errore);

    it.each<[string, number]>([
        ['1', 1],
        ['5', 5],
        ['60', 60],
        // Il tetto non è di qui: l'errore dice ciò che il backoffice ha detto, e lo taglia chi frena.
        ['3600', 3600],
        ['007', 7],
    ])('un 429 con `Retry-After: %s` lancia TroppeRichieste coi suoi secondi, che è un errore come gli altri per chi non la guarda (sprint 26 · T4.2)', async (riprovaFra, secondi) => {
        vi.stubGlobal('fetch', vi.fn(async () => frenata(429, riprovaFra)));

        const errore = await erroreDellaRicerca();
        expect(errore).toBeInstanceOf(TroppeRichieste);
        expect(errore).toBeInstanceOf(Error);
        expect([(errore as TroppeRichieste).secondi, (errore as TroppeRichieste).message]).toStrictEqual([secondi, 'POST /cornice/ricerca: 429']);
    });

    it.each<[string, string | undefined]>([
        ['senza `Retry-After`', undefined],
        ['con `Retry-After: 0`', '0'],
        ['con `Retry-After: -1`', '-1'],
        ['con `Retry-After: 1.5`', '1.5'],
        ['con `Retry-After: abc`', 'abc'],
        ['con una data in `Retry-After`', 'Wed, 21 Oct 2026 07:28:00 GMT'],
        ['con `Retry-After` vuoto', ''],
        ['con `Retry-After: 1e3`', '1e3'],
        ['con `Retry-After: +5`', '+5'],
        ['con `Retry-After: 5s`', '5s'],
        ['con `Retry-After: 0x10`', '0x10'],
    ])('un 429 %s è l\'errore di sempre, non TroppeRichieste (sprint 26 · T4.3)', async (_caso, riprovaFra) => {
        vi.stubGlobal('fetch', vi.fn(async () => frenata(429, riprovaFra)));

        const errore = await erroreDellaRicerca();
        expect([errore instanceof Error, errore instanceof TroppeRichieste, (errore as Error).message]).toStrictEqual([true, false, 'POST /cornice/ricerca: 429']);
    });

    it.each([500, 403, 503, 422])('un %d con `Retry-After: 5` è l\'errore di sempre, non TroppeRichieste: solo il 429 dice di aspettare (sprint 26 · T4.3)', async (stato) => {
        vi.stubGlobal('fetch', vi.fn(async () => frenata(stato, '5')));

        const errore = await erroreDellaRicerca();
        expect([errore instanceof Error, errore instanceof TroppeRichieste, (errore as Error).message]).toStrictEqual([true, false, `POST /cornice/ricerca: ${stato}`]);
    });
});

// Sprint 37 · T4 (voce #1999): l'elenco delle notifiche e la ricerca dicono di chi sono (`persona`, l'email della persona della
// sessione che ha risposto). In una scheda rimasta ferma la sessione può essere passata a un'altra persona: la risposta è di
// quella, e non torna a chi l'ha chiesta per la persona che la cornice mostra. La pagina si ricarica, e chi ha chiesto resta in
// attesa. Una risposta che non lo dice, o non lo dice con un testo, vale come prima.
describe('una risposta che dice di chi è', () => {
    // Sprint 41 · T5 (voce 2030): la pagina si ricarica per chi è a schermo, e chi è a schermo lo dice la cornice quando si monta (dalla review: non a ogni disegno).
    // In questi casi è Ada, che è anche chi chiede: la scheda rimasta ferma.
    beforeEach(() => {
        mostra('ada@example.com');
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    const elenco = [{ id: 'uat-n1', creata_il: '2026-10-06T11:55:00Z', letta: false, app: 'pm', tipo: 'com.zeiras.board.cartella.creata' }];
    const risultati = [{ tipo: 'board.board', id: 'uat-13', titolo: 'UAT Lancio' }];
    const chiamate: [string, Record<string, unknown>, (email: string) => Promise<unknown>, unknown][] = [
        ['caricaNotifiche', { data: elenco, aggiornati_il: unIstante, workspace: 'uat-vendite' }, (email) => caricaNotifiche(email), { elenco, il: unIstante, workspace: 'uat-vendite' }],
        ['cerca', { data: risultati, workspace: 'uat-vendite' }, (email) => cerca('lancio', new AbortController().signal, email), { risultati, workspace: 'uat-vendite' }],
    ];
    /** Come finisce una chiamata entro qualche giro: chiusa, con un errore, o ancora in attesa. */
    const esitoDi = (chiesto: Promise<unknown>) => Promise.race([chiesto.then(() => 'chiusa', () => 'errore'), new Promise((fatto) => setTimeout(() => fatto('in attesa'), 20))]);

    it.each(chiamate)('%s: una risposta di un\'altra persona non torna a chi l\'ha chiesta — né chiusa né con un errore — e la pagina si ricarica, una volta (sprint 37 · T4.1, T4.2)', async (_nome, corpo, chiama) => {
        const ricarica = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
        const fetchFinto = vi.fn(async () => risposta({ ...corpo, persona: 'grace@example.com' }));
        vi.stubGlobal('fetch', fetchFinto);

        expect(await esitoDi(chiama('ada@example.com'))).toBe('in attesa');
        expect(ricarica).toHaveBeenCalledTimes(1);
        expect(fetchFinto).toHaveBeenCalledTimes(1);
    });

    it.each(chiamate)('%s: se chi l\'ha chiesta non è più a schermo — una visita ha portato chi è entrato, e la cornice è la sua — una risposta di un\'altra persona non ricarica la pagina, e non torna comunque a chi l\'ha chiesta (sprint 41 · T5.1)', async (_nome, corpo, chiama) => {
        const ricarica = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
        const fetchFinto = vi.fn(async () => risposta({ ...corpo, persona: 'grace@example.com' }));
        vi.stubGlobal('fetch', fetchFinto);
        mostra('grace@example.com');

        expect(await esitoDi(chiama('ada@example.com'))).toBe('in attesa');
        expect(ricarica).not.toHaveBeenCalled();
        expect(fetchFinto).toHaveBeenCalledTimes(1);
    });

    it.each(chiamate.flatMap(([nome, corpo, chiama, attesa]) => ([
        ['della stessa persona', { persona: 'ada@example.com' }],
        ['che non dice di chi è (una parte server di prima)', {}],
        ['con `persona` null', { persona: null }],
        ['con una `persona` che è un numero', { persona: 12 }],
        ['con una `persona` che è un oggetto', { persona: { email: 'grace@example.com' } }],
    ] as [string, Record<string, unknown>][]).map(([come, conLaPersona]) => [nome, come, { ...corpo, ...conLaPersona }, chiama, attesa] as const)))('%s: una risposta %s torna come prima, con una richiesta sola e senza ricaricare la pagina (sprint 37 · T4.3, T4.4)', async (_nome, _come, corpo, chiama, attesa) => {
        const ricarica = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
        const fetchFinto = vi.fn(async () => risposta(corpo));
        vi.stubGlobal('fetch', fetchFinto);

        await expect(chiama('ada@example.com')).resolves.toStrictEqual(attesa);
        expect(ricarica).not.toHaveBeenCalled();
        expect(fetchFinto).toHaveBeenCalledTimes(1);
    });

    // Sprint 38 · T3 (voce #2026): anche un errore dice di chi è (`persona`, dalla `v2.5.0` nel corpo del 403
    // `accettazione_richiesta` e del 429 della ricerca). Di un'altra persona non diventa un errore di chi ha chiesto: la
    // cornice non si riduce e la ricerca non si ferma sotto il nome di prima, e la pagina si ricarica.
    const diErrore = (stato: number, corpo: Record<string, unknown>) => ({
        ok: false,
        status: stato,
        headers: new Headers(stato === 429 ? { 'Retry-After': '30' } : {}),
        json: async () => corpo,
    }) as unknown as Response;
    const errori: [string, number, string, typeof AccettazioneRichiesta | typeof TroppeRichieste][] = [
        ['il 403 `accettazione_richiesta`', 403, 'accettazione_richiesta', AccettazioneRichiesta],
        ['il 429 coi secondi', 429, 'troppe_richieste', TroppeRichieste],
    ];
    // Sprint 38 · T5 (R1 della review): anche la lettura di una notifica (`PATCH …/lettura`) passa l'email di chi la cornice
    // mostra: il suo 403 `accettazione_richiesta` dice di chi è come quello delle altre rotte.
    const conErrore = [
        ...chiamate.flatMap(([nome, , chiama]) => errori.map(([quale, stato, codice, classe]) => [nome, quale, stato, codice, classe, chiama] as const)),
        ['segnaLetta', 'il 403 `accettazione_richiesta`', 403, 'accettazione_richiesta', AccettazioneRichiesta, (email: string) => segnaLetta('uat-n69', email)] as const,
    ];

    it.each(conErrore)('%s: %s di un\'altra persona non torna a chi ha chiesto — né chiuso né con un errore — e la pagina si ricarica, una volta (sprint 38 · T3.1, T3.2)', async (_nome, _quale, stato, codice, _classe, chiama) => {
        const ricarica = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
        const fetchFinto = vi.fn(async () => diErrore(stato, { errore: codice, persona: 'grace@example.com' }));
        vi.stubGlobal('fetch', fetchFinto);

        expect(await esitoDi(chiama('ada@example.com'))).toBe('in attesa');
        expect(ricarica).toHaveBeenCalledTimes(1);
        expect(fetchFinto).toHaveBeenCalledTimes(1);
    });

    it.each(conErrore.flatMap(([nome, quale, stato, codice, classe, chiama]) => ([
        ['della stessa persona', { persona: 'ada@example.com' }],
        ['che non dice di chi è (una parte server di prima)', {}],
        ['con `persona` null', { persona: null }],
        ['con una `persona` che è un numero', { persona: 12 }],
    ] as [string, Record<string, unknown>][]).map(([come, conLaPersona]) => [nome, quale, come, stato, { errore: codice, ...conLaPersona }, classe, chiama] as const)))('%s: %s %s resta l\'errore di sempre, con una richiesta sola e senza ricaricare la pagina (sprint 38 · T3.3)', async (_nome, _quale, _come, stato, corpo, classe, chiama) => {
        const ricarica = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
        const fetchFinto = vi.fn(async () => diErrore(stato, corpo));
        vi.stubGlobal('fetch', fetchFinto);

        await expect(chiama('ada@example.com')).rejects.toBeInstanceOf(classe);
        expect(ricarica).not.toHaveBeenCalled();
        expect(fetchFinto).toHaveBeenCalledTimes(1);
    });

    // Sprint 38 · T4 (voce #2028): «Segna tutte come lette» dice per chi lo chiede. `segnaLetteFinoA` manda l'email di chi la
    // cornice mostra (`persona`), e la parte server, se la sessione è di un'altra persona, non segna niente e risponde 409
    // `persona_diversa` con l'email di chi è entrato: un errore di un'altra persona, e la pagina si ricarica.
    const segna = () => segnaLetteFinoA('2026-10-06T11:55:00+00:00', 'acme-marketing', 'ada@example.com');

    // Dallo sprint 40 (T3, voce #2051) l'email non sta più nel corpo: la dice l'intestazione `Persona`, come le altre tre richieste.
    it('segnaLetteFinoA dice l\'email di chi la cornice mostra nell\'intestazione `Persona`; nel corpo restano l\'istante e lo slug (sprint 38 · T4.1, sprint 40 · T3.1)', async () => {
        const fetchFinto = vi.fn(async (_indirizzo: string, _opzioni?: RequestInit) => risposta({ data: { fino_a: '2026-10-06T11:55:00.000Z' } }));
        vi.stubGlobal('fetch', fetchFinto);

        await segna();
        expect(JSON.parse(String(fetchFinto.mock.calls[0]?.[1]?.body))).toStrictEqual({ fino_a: '2026-10-06T11:55:00+00:00', workspace: 'acme-marketing' });
        expect(new Headers(fetchFinto.mock.calls[0]?.[1]?.headers).get('Persona')).toBe('ada%40example.com');
    });

    it.each<[string, Response]>([
        ['il 409 `persona_diversa` di un\'altra persona', diErrore(409, { errore: 'persona_diversa', persona: 'grace@example.com' })],
        ['una risposta riuscita che dice un\'altra persona', risposta({ data: { fino_a: '2026-10-06T11:55:00.000Z' }, persona: 'grace@example.com' })],
    ])('segnaLetteFinoA: %s non torna a chi ha chiesto — né chiusa né con un errore — e la pagina si ricarica, una volta (sprint 38 · T4.1)', async (_quale, laRisposta) => {
        const ricarica = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
        const fetchFinto = vi.fn(async () => laRisposta);
        vi.stubGlobal('fetch', fetchFinto);

        expect(await esitoDi(segna())).toBe('in attesa');
        expect(ricarica).toHaveBeenCalledTimes(1);
        expect(fetchFinto).toHaveBeenCalledTimes(1);
    });

    it.each<[string, Record<string, unknown>]>([
        ['della stessa persona', { persona: 'ada@example.com' }],
        ['che non dice di chi è', {}],
        ['con `persona` null', { persona: null }],
    ])('segnaLetteFinoA: un 409 `persona_diversa` %s resta l\'errore di sempre, con una richiesta sola e senza ricaricare la pagina (sprint 38 · T4.3)', async (_come, conLaPersona) => {
        const ricarica = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
        const fetchFinto = vi.fn(async () => diErrore(409, { errore: 'persona_diversa', ...conLaPersona }));
        vi.stubGlobal('fetch', fetchFinto);

        await expect(segna()).rejects.toThrow('POST /cornice/notifiche/letture: 409');
        expect(ricarica).not.toHaveBeenCalled();
        expect(fetchFinto).toHaveBeenCalledTimes(1);
    });
});

// Sprint 40 · T3 (voce #2051): ogni richiesta della cornice alla sua parte server dice di chi è la pagina che chiede, e la
// parte server la confronta con la sessione (`StessaPersona`, 409 `persona_diversa`). Prima lo diceva solo «Segna tutte come
// lette», nel corpo: da una scheda rimasta ferma il clic su una notifica la segnava letta a chi era entrato dopo. L'email va
// nell'intestazione `Persona`, passata da `encodeURIComponent`: un'intestazione porta solo caratteri di Latin-1, e con un
// altro carattere `fetch` lancerebbe prima di partire.
describe('ogni richiesta dice di chi è la pagina che chiede', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    const finoA = '2026-10-06T11:55:00+00:00';
    const richieste: [string, (email: string) => Promise<unknown>, Record<string, unknown>, Record<string, unknown> | undefined][] = [
        ['GET /cornice/notifiche', (email) => caricaNotifiche(email), { data: [], aggiornati_il: unIstante, workspace: 'uat-vendite' }, undefined],
        ['POST /cornice/ricerca', (email) => cerca('lancio', new AbortController().signal, email), { data: [], workspace: 'uat-vendite' }, { q: 'lancio' }],
        ['POST /cornice/notifiche/letture', (email) => segnaLetteFinoA(finoA, 'acme-marketing', email), { data: { fino_a: '2026-10-06T11:55:00.000Z' } }, { fino_a: finoA, workspace: 'acme-marketing' }],
        ['PATCH /cornice/notifiche/uat-n69/lettura', (email) => segnaLetta('uat-n69', email), { data: { id: 'uat-n69', letta: true }, segnata_il: unIstante }, { letta: true }],
    ];
    const corpoDi = (opzioni?: RequestInit) => (opzioni?.body == null ? undefined : (JSON.parse(String(opzioni.body)) as unknown));

    it.each(richieste)('%s porta nell\'intestazione `Persona` l\'email di chi la cornice mostra, passata da `encodeURIComponent`; l\'email non sta nell\'indirizzo, e il corpo è quello di sempre (sprint 40 · T3.1)', async (richiesta, chiama, corpo, nelCorpo) => {
        const fetchFinto = vi.fn(async (_indirizzo: string, _opzioni?: RequestInit) => risposta(corpo));
        vi.stubGlobal('fetch', fetchFinto);

        await chiama('ada@example.com');
        expect(fetchFinto).toHaveBeenCalledTimes(1);
        const [indirizzo, opzioni] = fetchFinto.mock.calls[0] ?? [];
        expect(`${opzioni?.method ?? 'GET'} ${indirizzo}`).toBe(richiesta);
        expect(new Headers(opzioni?.headers).get('Persona')).toBe('ada%40example.com');
        expect(indirizzo).not.toContain('ada');
        expect(corpoDi(opzioni)).toStrictEqual(nelCorpo);
    });

    it.each(richieste)('%s con un\'email che ha caratteri fuori da Latin-1 parte lo stesso: nell\'intestazione ci sono solo caratteri ASCII, e decodificata è quell\'email (sprint 40 · T3, invariante)', async (_richiesta, chiama, corpo) => {
        const email = 'łucja.żółć+uat@example.com';
        // Come il `fetch` del browser: un'intestazione con un carattere oltre U+00FF è un TypeError, prima di ogni richiesta.
        const fetchFinto = vi.fn(async (_indirizzo: string, opzioni?: RequestInit) => {
            for (const valore of Object.values((opzioni?.headers ?? {}) as Record<string, string>)) {
                if (/[^\u0000-\u00ff]/.test(valore)) {
                    throw new TypeError('Failed to execute \'fetch\': String contains non ISO-8859-1 code point.');
                }
            }

            return risposta(corpo);
        });
        vi.stubGlobal('fetch', fetchFinto);

        await expect(chiama(email)).resolves.toBeDefined();
        const detta = new Headers(fetchFinto.mock.calls[0]?.[1]?.headers).get('Persona');
        expect(detta).toMatch(/^[\x21-\x7e]+$/);
        expect(decodeURIComponent(String(detta))).toBe(email);
    });

    // Review della PR #74, R3 (seconda lettura, N1): dei dati della cornice senza l'email (il contratto del backoffice la dà
    // sempre). Se è un testo vuoto l'intestazione parte vuota, ed è un 422; se manca o è `null` parte il testo che ne fa
    // `encodeURIComponent`, ed è un 409 senza un'email (`StessaPersonaTest.php`). L'errore torna a chi ha chiamato. Senza
    // un'email da confrontare la pagina non si ricarica mai, nemmeno davanti a una risposta che dice di chi è: è voluto.
    it.each(richieste)('%s senza l\'email di chi la cornice mostra parte con l\'intestazione `Persona` vuota: il 422 della rotta è l\'errore di sempre per chi ha chiamato, e la pagina non si ricarica (review della PR #74, R3)', async (richiesta, chiama) => {
        const ricarica = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
        const fetchFinto = vi.fn(async (_indirizzo: string, _opzioni?: RequestInit) => risposta({ errore: 'dati_non_validi' }, 422));
        vi.stubGlobal('fetch', fetchFinto);

        await expect(chiama('')).rejects.toThrow(`${richiesta}: 422`);
        expect(fetchFinto).toHaveBeenCalledTimes(1);
        expect(new Headers(fetchFinto.mock.calls[0]?.[1]?.headers).get('Persona')).toBe('');
        expect(ricarica).not.toHaveBeenCalled();
    });

    it.each(richieste)('%s con un\'email che manca o è `null` (dati che non sono quelli del contratto) parte col testo `undefined` o `null` nell\'intestazione: il 409 senza un\'email della rotta è l\'errore di sempre, e la pagina non si ricarica (seconda lettura della PR #74, N1)', async (richiesta, chiama) => {
        const ricarica = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
        const fetchFinto = vi.fn(async (_indirizzo: string, _opzioni?: RequestInit) => risposta({ errore: 'persona_diversa', persona: null }, 409));
        vi.stubGlobal('fetch', fetchFinto);

        for (const [email, detta] of [[null, 'null'], [undefined, 'undefined']] as const) {
            await expect(chiama(email as unknown as string)).rejects.toThrow(`${richiesta}: 409`);
            expect(new Headers(fetchFinto.mock.lastCall?.[1]?.headers).get('Persona')).toBe(detta);
        }
        expect(fetchFinto).toHaveBeenCalledTimes(2);
        expect(ricarica).not.toHaveBeenCalled();
    });

    it.each(richieste)('%s senza l\'email di chi la cornice mostra — vuota, `null` o che manca — non ricarica la pagina nemmeno se la risposta dice di chi è: torna a chi ha chiamato (review della PR #74, R3; terza lettura, N6)', async (_richiesta, chiama, corpo) => {
        const ricarica = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
        vi.stubGlobal('fetch', vi.fn(async (_indirizzo: string, _opzioni?: RequestInit) => risposta({ ...corpo, persona: 'grace@example.com' })));

        for (const email of ['', null, undefined]) {
            await expect(chiama(email as string)).resolves.toBeDefined();
        }
        expect(ricarica).not.toHaveBeenCalled();
    });
});
