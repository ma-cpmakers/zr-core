import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccettazioneRichiesta, caricaNotifiche, cerca, segnaLetta, segnaLetteFinoA } from './servizi';

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

        await expect(segnaLetta('uat-n69')).resolves.toStrictEqual({ il: unIstante });
        expect(fetchFinto.mock.calls).toStrictEqual([
            ['/cornice/notifiche/uat-n69/lettura', { method: 'PATCH', headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...gettone }, body: '{"letta":true}', keepalive: true }],
        ]);
    });

    it('la richiesta parte subito, nello stesso giro di chi la chiama: chi apre un\'altra pagina subito dopo l\'ha già mandata (sprint 22 · T2.1)', async () => {
        const fetchFinto = vi.fn(async (_indirizzo: string, _opzioni?: RequestInit) => risposta({ data: { id: 'uat-n69', letta: true } }));
        vi.stubGlobal('fetch', fetchFinto);

        const lettura = segnaLetta('uat-n69');
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

        await segnaLetta(id);
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

        await expect(segnaLetta(id)).rejects.toThrow('PATCH /cornice/notifiche/{id}/lettura: id');
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

        await expect(segnaLetta('uat-n69')).resolves.toStrictEqual({ il: undefined });
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

        await expect(segnaLetta('uat-n69')).rejects.toThrow('PATCH /cornice/notifiche/uat-n69/lettura');
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

        await expect(cerca('uat', new AbortController().signal)).resolves.toStrictEqual({ risultati, workspace: 'uat-vendite' });
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

        await expect(cerca('uat', new AbortController().signal)).rejects.toThrow(errore);
    });

    // Sprint 23 · T2 (voce #1742, S4): lo `workspace` della risposta entra nell'indirizzo di ogni risultato, e ci entra solo con la
    // forma di uno slug, la stessa che vale per una notifica: `..` e `.` cambierebbero l'indirizzo (`encodeURIComponent` non
    // tocca i punti). Fuori forma è l'errore della ricerca, come senza `workspace`.
    it.each(['..', '.', 'Acme', 'a/b', 'acme_marketing', 'acme-', 'acme marketing'])('una risposta con un `workspace` fuori dalla forma di uno slug — «%s» — è un errore: nessun risultato (sprint 23 · T2.3)', async (workspace) => {
        vi.stubGlobal('fetch', vi.fn(async () => risposta({ data: [{ tipo: 'board.board', id: 'uat-13', titolo: 'UAT Lancio' }], workspace })));

        await expect(cerca('uat', new AbortController().signal)).rejects.toThrow('POST /cornice/ricerca: workspace');
    });

    it.each(['acme', 'acme-marketing', 'a', '9', 'uat-marketing-2'])('uno slug buono — «%s» — non è un errore: i risultati arrivano col loro workspace (sprint 23 · T2.3)', async (workspace) => {
        const risultati = [{ tipo: 'board.board', id: 'uat-13', titolo: 'UAT Lancio' }];
        vi.stubGlobal('fetch', vi.fn(async () => risposta({ data: risultati, workspace })));

        await expect(cerca('uat', new AbortController().signal)).resolves.toStrictEqual({ risultati, workspace });
    });
});

// Sprint 24 · T2 (voce #1745): se la persona non ha accettato i documenti legali in vigore le quattro rotte della cornice
// rispondono 403 col solo codice, `{"errore":"accettazione_richiesta"}`. Per la cornice non è un guasto: le quattro chiamate
// lanciano `AccettazioneRichiesta`, che lei riconosce. Ogni altro esito resta l'errore di prima.
describe('il 403 `accettazione_richiesta` di una rotta della cornice', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const chiamate: [string, () => Promise<unknown>][] = [
        ['caricaNotifiche', () => caricaNotifiche()],
        ['segnaLetteFinoA', () => segnaLetteFinoA('2026-10-06T11:55:00+00:00', 'acme-marketing')],
        ['segnaLetta', () => segnaLetta('uat-n69')],
        ['cerca', () => cerca('lancio', new AbortController().signal)],
    ];
    /** Come una chiamata finisce: con quell'errore, con un altro, o bene. */
    const esitoDi = (chiama: () => Promise<unknown>) => chiama().then(() => 'riuscita', (errore: unknown) => (errore instanceof AccettazioneRichiesta ? 'AccettazioneRichiesta' : errore instanceof Error ? 'Error' : 'altro'));

    it.each(chiamate)('%s: col 403 e il corpo {"errore":"accettazione_richiesta"} lancia AccettazioneRichiesta, che è un errore come gli altri per chi non la guarda (sprint 24 · T2.5)', async (_nome, chiama) => {
        vi.stubGlobal('fetch', vi.fn(async () => risposta({ errore: 'accettazione_richiesta' }, 403)));

        const errore: unknown = await chiama().then(() => undefined, (lanciato: unknown) => lanciato);
        expect(errore).toBeInstanceOf(AccettazioneRichiesta);
        expect(errore).toBeInstanceOf(Error);
    });

    it.each<[string, () => Response]>([
        ['un 403 con un altro `errore`', () => risposta({ errore: 'gettone_senza_workspace' }, 403)],
        ['un 403 senza `errore`', () => risposta({}, 403)],
        ['un 403 col codice sotto un\'altra chiave', () => risposta({ codice: 'accettazione_richiesta' }, 403)],
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
