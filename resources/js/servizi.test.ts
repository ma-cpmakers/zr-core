import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { cerca as cercaCon } from './ricerca';
import { AccettazioneRichiesta, aSchermo, caricaNotifiche, chiama, mostra, segnaLetta, segnaLetteFinoA, TroppeRichieste } from './servizi';

// Dalla `v2.16.0` (sprint 55 · T3) la `chiama` la passa al pezzo la cornice: qui è quella di questo `servizi`, come allora.
const cerca = (parola: string, segnale: AbortSignal, email: string) => cercaCon(parola, segnale, email, chiama);

// La persona di una cornice montata, come la passa la cornice: dalla `v2.20.0` la pila tiene le persone (email e impronta), e
// una cornice che si smonta toglie la sua (`mostra(persona, 1)`). Le montate dai casi si ricordano qui, per smontarle.
type Montata = { email: string; impronta?: string | null };
const montateDaiCasi: Montata[] = [];
const monta = (email: string, impronta?: string): Montata => {
    const persona = { email, impronta };
    montateDaiCasi.push(persona);
    mostra(persona);
    return persona;
};
const smonta = (persona: Montata) => (montateDaiCasi.splice(montateDaiCasi.indexOf(persona), 1), mostra(persona, 1));

// A schermo `chi`, o nessuno: senza nessuno si smontano tutte le cornici che i casi hanno montato.
const mettiASchermo = (chi: string | undefined) => {
    if (chi !== undefined) {
        return void monta(chi);
    }
    for (const persona of [...montateDaiCasi].reverse()) {
        smonta(persona);
    }
    // Se `mostra(…, 1)` non togliesse niente (un mutante), qui resterebbe qualcuno.
    expect(aSchermo).toBeUndefined();
};

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

/** Un'impronta di zr-auth, come la danno i dati della cornice dalla `v2.20.0`: 32 cifre esadecimali. */
const IMPRONTA = '0f1e2d3c4b5a69788796a5b4c3d2e1f0';

describe('segnaLetta', () => {
    // Dalla `v2.14.0` una lettura riesce solo se chi l'ha chiesta è ancora a schermo: qui è Ada.
    beforeEach(() => mettiASchermo('ada@example.com'));
    afterEach(() => {
        vi.unstubAllGlobals();
        cookieCsrf();
        mettiASchermo(undefined);
    });

    // Sprint 53 · T4 (review R5, sicurezza S1): la cornice di chi ha fatto il clic può non essere più a schermo quando arriva
    // la risposta — una visita ha portato un'altra persona, entrata in un'altra scheda, o la cornice è smontata. La lettura
    // allora non riesce, anche con `letta: true`: chi l'ha chiesta non apre la risorsa con la sessione di un altro.
    it.each([
        ['un\'altra persona', 'grace@example.com'],
        ['nessuno', undefined],
    ])('una risposta `letta: true` arrivata quando a schermo c\'è %s non è una lettura riuscita (sprint 53 · T4, review R5)', async (_chi, aSchermoAllaRisposta) => {
        let rispondi: (risposta: Response) => void = () => undefined;
        vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((si) => (rispondi = si))));
        const lettura = segnaLetta('uat-n69', 'ada@example.com');
        mettiASchermo(aSchermoAllaRisposta);
        rispondi(new Response(JSON.stringify({ data: { id: 'uat-n69', letta: true }, segnata_il: unIstante }), { status: 200 }));

        await expect(lettura).rejects.toThrow('PATCH /cornice/notifiche/uat-n69/lettura: letta');
    });

    it.each([
        ['col cookie del gettone CSRF lo porta in X-XSRF-TOKEN', 'eyJpdiI6Ik1h%3D%3D', { 'X-XSRF-TOKEN': 'eyJpdiI6Ik1h==' }],
        ['senza il cookie parte senza X-XSRF-TOKEN', undefined, {}],
    ])('chiede PATCH /cornice/notifiche/<id>/lettura con {"letta": true} e con keepalive, e dà l\'istante della parte server: %s (sprint 22 · T2.1)', async (_quale, cookie, gettone) => {
        cookieCsrf(cookie);
        monta('ada@example.com', IMPRONTA);
        onTestFinished(() => mettiASchermo(undefined));
        const fetchFinto = vi.fn(async (_indirizzo: string, _opzioni?: RequestInit) => risposta({ data: { id: 'uat-n69', letta: true }, segnata_il: unIstante }));
        vi.stubGlobal('fetch', fetchFinto);

        await expect(segnaLetta('uat-n69', 'ada@example.com')).resolves.toStrictEqual({ il: unIstante });
        expect(fetchFinto.mock.calls).toStrictEqual([
            ['/cornice/notifiche/uat-n69/lettura', { method: 'PATCH', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Zr-Persona': IMPRONTA, Persona: 'ada%40example.com', ...gettone }, body: '{"letta":true}', keepalive: true }],
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
    // Sprint 43 · T3 (voce #2053): la pagina dei casi è una scheda ferma, caricata da un minuto (l'orologio di `performance.now()`):
    // una pagina caricata da meno di 30 secondi si ricarica solo quando li compie (sprint 44 · T2), e ha i suoi casi più sotto.
    /** Da quanto è caricata la pagina, in millisecondi. */
    const caricataDa = (millisecondi: number) => vi.spyOn(performance, 'now').mockReturnValue(millisecondi);

    beforeEach(() => {
        monta('ada@example.com');
        caricataDa(60_000);
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

    it.each(chiamate)('%s: una risposta di un\'altra persona non torna a chi l\'ha chiesta — né chiusa né con un errore, prima dei 5 secondi — e la pagina si ricarica, una volta (sprint 37 · T4.1, T4.2)', async (_nome, corpo, chiama) => {
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
        monta('grace@example.com');

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

    it.each(conErrore)('%s: %s di un\'altra persona non torna a chi ha chiesto — né chiuso né con un errore, prima dei 5 secondi — e la pagina si ricarica, una volta (sprint 38 · T3.1, T3.2)', async (_nome, _quale, stato, codice, _classe, chiama) => {
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
    ])('segnaLetteFinoA: %s non torna a chi ha chiesto — né chiusa né con un errore, prima dei 5 secondi — e la pagina si ricarica, una volta (sprint 38 · T4.1)', async (_quale, laRisposta) => {
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

    /** Come sta una chiamata, guardata quando serve: in attesa, chiusa (con che cosa), o con un errore (quale). */
    const segui = (chiesto: Promise<unknown>) => {
        const esito: { come: string; con?: unknown } = { come: 'in attesa' };
        chiesto.then(
            (dati) => Object.assign(esito, { come: 'chiusa', con: dati }),
            (errore: unknown) => Object.assign(esito, { come: 'errore', con: errore }),
        );
        return esito;
    };
    const diUnAltra: [string, () => Response, () => Promise<unknown>][] = [
        ...chiamate.map(([nome, corpo, chiama]) => [`${nome}, la risposta riuscita`, () => risposta({ ...corpo, persona: 'grace@example.com' }), () => chiama('ada@example.com')] as [string, () => Response, () => Promise<unknown>]),
        ...conErrore.map(([nome, quale, stato, codice, , chiama]) => [`${nome}, ${quale}`, () => diErrore(stato, { errore: codice, persona: 'grace@example.com' }), () => chiama('ada@example.com')] as [string, () => Response, () => Promise<unknown>]),
        ['segnaLetteFinoA, il 409 `persona_diversa`', () => diErrore(409, { errore: 'persona_diversa', persona: 'grace@example.com' }), segna],
    ];

    // Sprint 43 · T2 (voce #2036): se il ricaricamento non avviene — un `beforeunload` che lo annulla, una pagina che non può
    // ricaricarsi — chi ha chiesto non resta in attesa per sempre: dopo 5 secondi la chiamata si chiude con un errore, che non
    // porta niente della risposta di chi è entrato. Prima dei 5 secondi niente cambia; e se la ricarica non parte (nessuno a
    // schermo, o a schermo c'è già chi ha risposto) nessun orologio parte, e chi ha chiesto resta in attesa come prima.
    describe('se la pagina non si ricarica', () => {
        beforeEach(() => {
            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it.each(diUnAltra)('%s di un\'altra persona: a 4.999 ms dalla ricarica chi ha chiesto è ancora in attesa, a 5.000 ms ha un errore senza niente dentro; la ricarica è chiamata una volta (sprint 43 · T2.1, T2.2)', async (_nome, laRisposta, chiama) => {
            const ricarica = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
            const fetchFinto = vi.fn(async () => laRisposta());
            vi.stubGlobal('fetch', fetchFinto);

            const esito = segui(chiama());
            await vi.advanceTimersByTimeAsync(4_999);
            expect(esito).toStrictEqual({ come: 'in attesa' });
            expect(ricarica).toHaveBeenCalledTimes(1);

            await vi.advanceTimersByTimeAsync(1);
            // Né i dati, né `persona`, né i secondi del freno, né la classe dell'errore di chi è entrato.
            expect(esito).toStrictEqual({ come: 'errore', con: undefined });
            expect(ricarica).toHaveBeenCalledTimes(1);
            expect(fetchFinto).toHaveBeenCalledTimes(1);
        });

        // Sprint 44 · T2 (voce #2058): la ricarica non parte più nel giro della risposta. La chiede un orologio, che su una scheda
        // rimasta ferma scade al primo giro: alla risposta gli orologi sono due, quello della ricarica e quello dei 5 secondi.
        it.each(diUnAltra)('%s di un\'altra persona su una scheda rimasta ferma: alla risposta partono due orologi e la pagina non è ancora ricaricata; al primo giro dell\'orologio si ricarica, una volta sola anche dopo un minuto (sprint 44 · T2.4)', async (_nome, laRisposta, chiama) => {
            const ricarica = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
            vi.stubGlobal('fetch', vi.fn(async () => laRisposta()));
            caricataDa(60_000);

            segui(chiama());
            // La risposta arriva senza che l'orologio giri.
            for (let giro = 0; giro < 20; giro += 1) {
                await Promise.resolve();
            }
            expect(vi.getTimerCount()).toBe(2);
            expect(ricarica).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(0);
            expect(ricarica).toHaveBeenCalledTimes(1);
            await vi.advanceTimersByTimeAsync(60_000);
            expect(ricarica).toHaveBeenCalledTimes(1);
        });

        it.each(diUnAltra.flatMap(([nome, laRisposta, chiama]) => ([
            ['a schermo c\'è già chi ha risposto', 'grace@example.com'],
            ['a schermo non c\'è nessuna cornice', undefined],
        ] as [string, string | undefined][]).flatMap(([come, chi]) => [60_000, 29_999, 0].map((eta) => [nome, come, eta, chi, laRisposta, chiama] as const))))('%s di un\'altra persona, se %s, su una pagina caricata da %i ms: la pagina non si ricarica, nessun orologio parte e chi ha chiesto resta in attesa, anche dopo un minuto — nemmeno il tetto dei 30 secondi chiude con un errore la richiesta di una cornice che non c\'è più (sprint 43 · T2.3)', async (_nome, _come, eta, chi, laRisposta, chiama) => {
            const ricarica = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
            vi.stubGlobal('fetch', vi.fn(async () => laRisposta()));
            mettiASchermo(chi);
            caricataDa(eta);

            const esito = segui(chiama());
            await vi.advanceTimersByTimeAsync(0);
            expect(vi.getTimerCount()).toBe(0);
            await vi.advanceTimersByTimeAsync(60_000);
            expect(esito).toStrictEqual({ come: 'in attesa' });
            expect(ricarica).not.toHaveBeenCalled();
        });
    });

    // Sprint 52 · T5 (voce #2079): subito prima di ricaricare la pagina per un cambio di persona la cornice lo dice al frontend,
    // con un evento sulla `window` (`zr-core:altra-persona`, README): dopo la ricarica il frontend può dire perché. Quando la
    // pagina non si ricarica l'evento non parte.
    describe('l\'evento prima della ricarica', () => {
        const EVENTO = 'zr-core:altra-persona';
        let eventi: string[];
        const ascolta = () => eventi.push('evento');

        beforeEach(() => {
            eventi = [];
            window.addEventListener(EVENTO, ascolta);
            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        });

        afterEach(() => {
            window.removeEventListener(EVENTO, ascolta);
            vi.useRealTimers();
        });

        it.each(diUnAltra.flatMap(([nome, laRisposta, chiama]) => [60_000, 10_000].map((eta) => [nome, eta, laRisposta, chiama] as const)))('%s di un\'altra persona su una pagina caricata da %i ms: subito prima della ricarica parte un evento `zr-core:altra-persona` sulla `window`, uno solo (sprint 52 · T5.1)', async (_nome, eta, laRisposta, chiama) => {
            vi.spyOn(window.location, 'reload').mockImplementation(() => void eventi.push('ricarica'));
            vi.stubGlobal('fetch', vi.fn(async () => laRisposta()));
            caricataDa(eta);

            segui(chiama());
            await vi.advanceTimersByTimeAsync(0);
            expect(eventi).toStrictEqual(eta < 30_000 ? [] : ['evento', 'ricarica']);

            await vi.advanceTimersByTimeAsync(30_000);
            expect(eventi).toStrictEqual(['evento', 'ricarica']);
        });

        it.each(diUnAltra.flatMap(([nome, laRisposta, chiama]) => ([
            ['a schermo c\'è già chi ha risposto', 'grace@example.com'],
            ['a schermo non c\'è nessuna cornice', undefined],
        ] as [string, string | undefined][]).map(([come, chi]) => [nome, come, chi, laRisposta, chiama] as const)))('%s di un\'altra persona, se %s: la pagina non si ricarica e nessun evento parte (sprint 52 · T5.1)', async (_nome, _come, chi, laRisposta, chiama) => {
            const ricarica = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
            vi.stubGlobal('fetch', vi.fn(async () => laRisposta()));
            mettiASchermo(chi);

            segui(chiama());
            await vi.advanceTimersByTimeAsync(60_000);
            expect(ricarica).not.toHaveBeenCalled();
            expect(eventi).toStrictEqual([]);
        });

        it.each(chiamate)('%s: una risposta della persona a schermo non ricarica la pagina e non fa partire l\'evento (sprint 52 · T5.1)', async (_nome, corpo, chiama) => {
            const ricarica = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
            vi.stubGlobal('fetch', vi.fn(async () => risposta({ ...corpo, persona: 'ada@example.com' })));

            await chiama('ada@example.com');
            await vi.advanceTimersByTimeAsync(60_000);
            expect(ricarica).not.toHaveBeenCalled();
            expect(eventi).toStrictEqual([]);
        });

        // Allo scadere dei 30 secondi la pagina guarda chi è a schermo: se una visita ha già portato chi ha risposto, niente.
        it('su una pagina caricata da 10.000 ms, se allo scadere a schermo c\'è già chi ha risposto, la pagina non si ricarica e nessun evento parte (sprint 52 · T5.1)', async () => {
            const [, laRisposta, chiama] = diUnAltra[0]!;
            const ricarica = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
            vi.stubGlobal('fetch', vi.fn(async () => laRisposta()));
            caricataDa(10_000);

            segui(chiama());
            await vi.advanceTimersByTimeAsync(0);
            mettiASchermo('grace@example.com');
            await vi.advanceTimersByTimeAsync(30_000);
            expect(ricarica).not.toHaveBeenCalled();
            expect(eventi).toStrictEqual([]);
        });
    });

    // Sprint 43 · T3 (voce #2053): la ricarica davanti a una risposta di un'altra persona ha un tetto, e il tetto è l'età della
    // pagina: una pagina caricata da meno di 30 secondi non si ricarica subito — se la risposta dice ancora un'altra persona
    // subito dopo una ricarica (dei dati composti a mano con un'altra email), ricaricare di nuovo non cambia niente. Da 30
    // secondi in poi si ricarica come prima. Il pacchetto non scrive niente nel browser per ricordarselo.
    // Sprint 44 · T2 (voce #2058): sotto il tetto la cornice di chi c'era prima non resta a schermo. La pagina si ricarica da
    // sola quando compie 30 secondi, se allora a schermo non c'è chi ha risposto: al più una ricarica ogni 30 secondi. L'errore
    // senza niente dentro esce dopo 5 secondi anche sotto il tetto (nella `v2.9.0` usciva subito).
    describe('il tetto delle ricariche', () => {
        beforeEach(() => {
            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        /** Ciò che il browser tiene fra una pagina e l'altra, e che il tetto non tocca. */
        const nelBrowser = () => [sessionStorage.length, localStorage.length, window.name, document.cookie];

        it.each(diUnAltra.flatMap(([nome, laRisposta, chiama]) => [0, 29_999].map((eta) => [nome, eta, laRisposta, chiama] as const)))('%s di un\'altra persona su una pagina caricata da %i ms: a 4.999 ms dalla risposta chi ha chiesto è ancora in attesa, a 5.000 ms ha un errore senza niente dentro (sprint 44 · T2.3)', async (_nome, eta, laRisposta, chiama) => {
            vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
            const fetchFinto = vi.fn(async () => laRisposta());
            vi.stubGlobal('fetch', fetchFinto);
            caricataDa(eta);

            const esito = segui(chiama());
            await vi.advanceTimersByTimeAsync(4_999);
            expect(esito).toStrictEqual({ come: 'in attesa' });

            await vi.advanceTimersByTimeAsync(1);
            // Né i dati, né `persona`, né i secondi del freno, né la classe dell'errore di chi è entrato.
            expect(esito).toStrictEqual({ come: 'errore', con: undefined });
            expect(fetchFinto).toHaveBeenCalledTimes(1);
        });

        it.each(diUnAltra.flatMap(([nome, laRisposta, chiama]) => [0, 10_000, 29_999].map((eta) => [nome, eta, laRisposta, chiama] as const)))('%s di un\'altra persona su una pagina caricata da %i ms: la pagina si ricarica da sola quando compie 30.000 ms — a 29.999 ms no —, una volta, senza un\'altra richiesta (sprint 44 · T2.1, T2.6)', async (_nome, eta, laRisposta, chiama) => {
            const ricarica = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
            const fetchFinto = vi.fn(async () => laRisposta());
            vi.stubGlobal('fetch', fetchFinto);
            caricataDa(eta);

            segui(chiama());
            await vi.advanceTimersByTimeAsync(29_999 - eta);
            expect(ricarica).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(1);
            expect(ricarica).toHaveBeenCalledTimes(1);
            await vi.advanceTimersByTimeAsync(60_000);
            expect(ricarica).toHaveBeenCalledTimes(1);
            expect(fetchFinto).toHaveBeenCalledTimes(1);
        });

        // Allo scadere la pagina riguarda chi è a schermo: se una visita ha già portato chi ha risposto, la sua pagina non si
        // ricarica da sola. Una pagina rimasta senza cornice sì: allo scadere non c'è chi ha risposto.
        it.each<[string, string | undefined, number]>([
            ['c\'è già chi ha risposto, portato da una visita: la pagina non si ricarica', 'grace@example.com', 0],
            ['c\'è ancora chi c\'era prima: la pagina si ricarica', 'ada@example.com', 1],
            ['c\'è una terza persona: la pagina si ricarica', 'alan@example.com', 1],
            ['non c\'è più una cornice: la pagina si ricarica', undefined, 1],
        ])('se quando la pagina compie 30 secondi a schermo %s (sprint 44 · T2.2)', async (_come, chi, volte) => {
            const ricarica = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
            vi.stubGlobal('fetch', vi.fn(async () => risposta({ data: elenco, persona: 'grace@example.com' })));
            caricataDa(10_000);

            segui(caricaNotifiche('ada@example.com'));
            await vi.advanceTimersByTimeAsync(19_999);
            expect(ricarica).not.toHaveBeenCalled();
            mettiASchermo(chi);

            await vi.advanceTimersByTimeAsync(1);
            expect(ricarica).toHaveBeenCalledTimes(volte);
        });

        // Sprint 48 · T2 (voce #2064): l'orologio dei 30 secondi tiene della risposta di chi è entrato solo chi è (`persona`), che
        // gli serve allo scadere; il resto (qui i dati) si può buttare subito. Lo prova un `WeakRef` ai dati con una raccolta
        // forzata: se l'orologio tiene tutta la risposta, i dati ci sono ancora. `fetch` è una funzione semplice e non un
        // `vi.fn`, che terrebbe la risposta fra le sue chiamate.
        it('una risposta di un\'altra persona con l\'orologio partito: l\'orologio tiene solo chi ha risposto, e i dati si buttano (sprint 48 · T2.1)', async () => {
            const ricarica = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
            let iDati: WeakRef<object> | undefined;
            vi.stubGlobal('fetch', async () => {
                const data = [{ id: 'uat-n1', titolo: 'UAT di Grace' }];
                iDati = new WeakRef(data);
                return risposta({ data, aggiornati_il: unIstante, persona: 'grace@example.com' });
            });
            caricataDa(10_000);

            const esito = segui(caricaNotifiche('ada@example.com'));
            await vi.advanceTimersByTimeAsync(5_000);
            expect(esito).toStrictEqual({ come: 'errore', con: undefined });
            setFlagsFromString('--expose-gc');
            const raccogli = runInNewContext('gc') as () => void;
            for (let giro = 0; giro < 3; giro++) {
                await new Promise((fatto) => setImmediate(fatto));
                raccogli();
            }
            expect(iDati?.deref()).toBeUndefined();

            // L'orologio c'è ancora, e allo scadere fa ciò che faceva.
            await vi.advanceTimersByTimeAsync(14_999);
            expect(ricarica).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(1);
            expect(ricarica).toHaveBeenCalledTimes(1);
        });

        it.each(diUnAltra)('%s di un\'altra persona su una pagina caricata da 30.000 ms: la pagina si ricarica, una volta, e chi ha chiesto resta in attesa fino ai 5 secondi (sprint 43 · T3.2)', async (_nome, laRisposta, chiama) => {
            const ricarica = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
            vi.stubGlobal('fetch', vi.fn(async () => laRisposta()));
            caricataDa(30_000);

            const esito = segui(chiama());
            await vi.advanceTimersByTimeAsync(4_999);
            expect(esito).toStrictEqual({ come: 'in attesa' });
            expect(ricarica).toHaveBeenCalledTimes(1);
            await vi.advanceTimersByTimeAsync(1);
            expect(esito).toStrictEqual({ come: 'errore', con: undefined });
        });

        it('il tetto non resta per sempre e non scrive niente nel browser: la stessa pagina a 29.999 ms non è ricaricata, a 30.000 ms sì, e archivi, nome della finestra e cookie restano com\'erano (sprint 43 · T3.3, T3.6; sprint 44 · T2.1)', async () => {
            const ricarica = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
            vi.stubGlobal('fetch', vi.fn(async () => risposta({ data: elenco, persona: 'grace@example.com' })));
            const prima = nelBrowser();
            const scritture = vi.spyOn(Storage.prototype, 'setItem');

            caricataDa(29_999);
            segui(caricaNotifiche('ada@example.com'));
            await vi.advanceTimersByTimeAsync(0);
            expect(ricarica).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(1);
            expect(ricarica).toHaveBeenCalledTimes(1);
            expect(nelBrowser()).toStrictEqual(prima);
            expect(scritture).not.toHaveBeenCalled();
        });

        it('una risposta della persona a schermo torna com\'è anche su una pagina appena caricata: il tetto guarda solo le risposte di un\'altra persona (sprint 43 · T3.2)', async () => {
            const ricarica = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
            vi.stubGlobal('fetch', vi.fn(async () => risposta({ data: elenco, aggiornati_il: unIstante, workspace: 'uat-vendite', persona: 'ada@example.com' })));
            caricataDa(0);

            await expect(caricaNotifiche('ada@example.com')).resolves.toStrictEqual({ elenco, il: unIstante, workspace: 'uat-vendite' });
            expect(ricarica).not.toHaveBeenCalled();
        });
        it('nessun file del pacchetto che si installa nomina un archivio del browser o il nome della finestra: il tetto è l\'età della pagina, e niente resta dopo l\'uscita (sprint 43 · T3.6)', () => {
            const cartella = fileURLToPath(import.meta.url).replace(/[^/]+$/, '');
            // Tutto ciò che sta sotto `resources/js`, anche nelle sue cartelle (il modulo dei componenti del design system), e non
            // solo gli archivi: nemmeno una base di dati del browser, né un cookie scritto (quello del CSRF è solo letto).
            const sorgenti = readdirSync(cartella, { recursive: true, encoding: 'utf8' }).filter((file) => /\.(tsx?|js)$/.test(file) && !/\.test\.tsx?$/.test(file));
            const conUnArchivio = sorgenti.filter((file) => /sessionStorage|localStorage|indexedDB|window\.name|document\.cookie\s*=(?!=)/.test(readFileSync(cartella + file, 'utf8')));

            expect(sorgenti).toContain('servizi.ts');
            expect(sorgenti).toContain('zeiras/componenti.js');
            expect(conUnArchivio).toStrictEqual([]);
        });

        // Sprint 44 · T4 (voce #2061): dalla `v2.10.0` anche il 403 di chi è entrato senza workspace dice di chi è (`persona`),
        // e vale come le altre risposte di un'altra persona; quello della persona a schermo resta l'errore di sempre.
        const senzaWorkspace: [string, (email: string) => Promise<unknown>][] = [
            ...chiamate.map(([nome, , chiama]) => [nome, chiama] as [string, (email: string) => Promise<unknown>]),
            ['segnaLetteFinoA', (email) => segnaLetteFinoA('2026-10-06T11:55:00+00:00', 'acme-marketing', email)],
            ['segnaLetta', (email) => segnaLetta('uat-n69', email)],
        ];

        it.each(senzaWorkspace)('%s: il 403 `gettone_senza_workspace` di un\'altra persona su una pagina appena caricata vale come le altre sue risposte: a 5.000 ms un errore senza niente dentro, a 30.000 ms la pagina si ricarica, una volta (sprint 44 · T4.2)', async (_nome, chiama) => {
            const ricarica = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
            const fetchFinto = vi.fn(async () => diErrore(403, { errore: 'gettone_senza_workspace', persona: 'grace@example.com' }));
            vi.stubGlobal('fetch', fetchFinto);
            caricataDa(0);

            const esito = segui(chiama('ada@example.com'));
            await vi.advanceTimersByTimeAsync(5_000);
            expect(esito).toStrictEqual({ come: 'errore', con: undefined });
            expect(ricarica).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(25_000);
            expect(ricarica).toHaveBeenCalledTimes(1);
            expect(fetchFinto).toHaveBeenCalledTimes(1);
        });

        it.each(senzaWorkspace)('%s: il 403 `gettone_senza_workspace` della persona a schermo resta l\'errore di sempre, con una richiesta sola e senza ricaricare la pagina (sprint 44 · T4.3)', async (_nome, chiama) => {
            const ricarica = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
            const fetchFinto = vi.fn(async () => diErrore(403, { errore: 'gettone_senza_workspace', persona: 'ada@example.com' }));
            vi.stubGlobal('fetch', fetchFinto);
            caricataDa(0);

            const errore = await chiama('ada@example.com').catch((e: unknown) => e);
            expect(errore).toBeInstanceOf(Error);
            expect(errore).not.toBeInstanceOf(AccettazioneRichiesta);
            expect((errore as Error).message).toMatch(/: 403$/);
            await vi.advanceTimersByTimeAsync(60_000);
            expect(ricarica).not.toHaveBeenCalled();
            expect(fetchFinto).toHaveBeenCalledTimes(1);
        });

        // Sprint 51 · T1 (voce #2078): dalla `v2.12.0` il 409 `persona_diversa` non dice chi è entrato: `persona` è un testo
        // vuoto, che non è l'email di nessuno. Per la cornice vale come la risposta di un'altra persona, su ognuna delle quattro;
        // senza sapere chi è entrato, se a schermo c'è una cornice la pagina si ricarica, anche quella che una visita ha già
        // portato a un'altra persona (allora una ricarica in più, detta nel README).
        const col409: [string, (email: string) => Promise<unknown>][] = [
            ...chiamate.map(([nome, , chiama]) => [nome, chiama] as [string, (email: string) => Promise<unknown>]),
            ['segnaLetteFinoA', (email) => segnaLetteFinoA('2026-10-06T11:55:00+00:00', 'acme-marketing', email)],
            ['segnaLetta', (email) => segnaLetta('uat-n69', email)],
        ];
        const ilNuovo409 = () => diErrore(409, { errore: 'persona_diversa', persona: '' });

        it.each(col409.flatMap(([nome, chiama]) => ([
            ['chi ha chiesto', 'ada@example.com'],
            ['un\'altra persona, portata da una visita', 'grace@example.com'],
        ] as [string, string][]).map(([chi, email]) => [nome, chi, email, chiama] as const)))('%s: il 409 `persona_diversa` con `persona` vuota, con a schermo %s, non torna a chi ha chiesto: a 5.000 ms un errore senza niente dentro, a 30.000 ms la pagina si ricarica, una volta (sprint 51 · T1.3)', async (_nome, _chi, aSchermoC, chiama) => {
            const ricarica = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
            const fetchFinto = vi.fn(async () => ilNuovo409());
            vi.stubGlobal('fetch', fetchFinto);
            mettiASchermo(aSchermoC);
            caricataDa(0);

            const esito = segui(chiama('ada@example.com'));
            await vi.advanceTimersByTimeAsync(4_999);
            expect(esito).toStrictEqual({ come: 'in attesa' });
            await vi.advanceTimersByTimeAsync(1);
            expect(esito).toStrictEqual({ come: 'errore', con: undefined });
            expect(ricarica).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(25_000);
            expect(ricarica).toHaveBeenCalledTimes(1);
            await vi.advanceTimersByTimeAsync(60_000);
            expect(ricarica).toHaveBeenCalledTimes(1);
            expect(fetchFinto).toHaveBeenCalledTimes(1);
        });

        it.each(col409)('%s: il 409 `persona_diversa` con `persona` vuota senza una cornice a schermo non fa partire nessun orologio e non ricarica la pagina (sprint 51 · T1.3)', async (_nome, chiama) => {
            const ricarica = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);
            vi.stubGlobal('fetch', vi.fn(async () => ilNuovo409()));
            mettiASchermo(undefined);
            caricataDa(60_000);

            const esito = segui(chiama('ada@example.com'));
            await vi.advanceTimersByTimeAsync(0);
            expect(vi.getTimerCount()).toBe(0);
            await vi.advanceTimersByTimeAsync(60_000);
            expect(esito).toStrictEqual({ come: 'in attesa' });
            expect(ricarica).not.toHaveBeenCalled();
        });
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
        mettiASchermo(undefined);
    });

    const finoA = '2026-10-06T11:55:00+00:00';
    const richieste: [string, (email: string) => Promise<unknown>, Record<string, unknown>, Record<string, unknown> | undefined][] = [
        ['GET /cornice/notifiche', (email) => caricaNotifiche(email), { data: [], aggiornati_il: unIstante, workspace: 'uat-vendite' }, undefined],
        ['POST /cornice/ricerca', (email) => cerca('lancio', new AbortController().signal, email), { data: [], workspace: 'uat-vendite' }, { q: 'lancio' }],
        ['POST /cornice/notifiche/letture', (email) => segnaLetteFinoA(finoA, 'acme-marketing', email), { data: { fino_a: '2026-10-06T11:55:00.000Z' } }, { fino_a: finoA, workspace: 'acme-marketing' }],
        ['PATCH /cornice/notifiche/uat-n69/lettura', (email) => (aSchermo === email || mettiASchermo(email), segnaLetta('uat-n69', email)), { data: { id: 'uat-n69', letta: true }, segnata_il: unIstante }, { letta: true }],
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

    // Sprint 60 · T1.1 (voce #2144): l'email detta in `Persona` non basta quando un'email passa da un account a un altro; ogni
    // richiesta porta anche l'impronta di zr-auth della persona della cornice montata, e senza impronta parte un testo che non è un'impronta
    // (`undefined` nel browser), che StessaPersona non confronta.
    it.each(richieste)('%s porta in `X-Zr-Persona` l\'impronta data dalla cornice montata, e senza impronta un testo che non è un\'impronta (sprint 60 · T1.1)', async (_richiesta, chiama, corpo) => {
        const fetchFinto = vi.fn(async (_indirizzo: string, _opzioni?: RequestInit) => risposta(corpo));
        vi.stubGlobal('fetch', fetchFinto);
        onTestFinished(() => mettiASchermo(undefined));

        const conLImpronta = monta('ada@example.com', IMPRONTA);
        await chiama('ada@example.com');
        smonta(conLImpronta);
        monta('ada@example.com');
        await chiama('ada@example.com');
        expect(fetchFinto.mock.calls.map(([, opzioni]) => new Headers(opzioni?.headers).get('X-Zr-Persona'))).toStrictEqual([IMPRONTA, expect.not.stringMatching(/^[0-9a-f]{32}$/)]);
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

// Sprint 57 · T2 (voce 2086): chi è a schermo lo tiene una pila delle cornici montate. Una cornice che si smonta toglie una voce
// sola, la sua email; a schermo resta l'ultima montata, o nessuno.
describe('la pila delle cornici montate (sprint 57 · T2)', () => {
    beforeEach(() => mettiASchermo(undefined));

    it('due cornici di Ada: smontata una a schermo resta Ada, smontata anche l\'altra nessuno (T2.1, T2.2)', () => {
        const prima = monta('ada@example.com');
        const seconda = monta('ada@example.com');
        smonta(prima);
        expect(aSchermo).toBe('ada@example.com');
        smonta(seconda);
        expect(aSchermo).toBeUndefined();
    });

    it('Ada e poi Grace: smontata Ada a schermo resta Grace, smontata anche Grace nessuno (T2.3)', () => {
        const ada = monta('ada@example.com');
        const grace = monta('grace@example.com');
        smonta(ada);
        expect(aSchermo).toBe('grace@example.com');
        smonta(grace);
        expect(aSchermo).toBeUndefined();
    });

    // Review della PR #91 (R3): fra persone diverse lo scenario nuovo è smontare l'ultima montata. Fino alla `v2.17.0` lo schermo
    // restava vuoto; ora torna quella rimasta.
    it('Ada e poi Grace: smontata Grace a schermo torna Ada, smontata anche Ada nessuno (T2.3, review R3)', () => {
        const ada = monta('ada@example.com');
        const grace = monta('grace@example.com');
        smonta(grace);
        expect(aSchermo).toBe('ada@example.com');
        smonta(ada);
        expect(aSchermo).toBeUndefined();
    });

    // Sprint 60 (revisione di sicurezza della PR #96, S2; review R2): la pila tiene le persone, non le email. Con due cornici della
    // stessa email e di due account, smontata l'ultima, le richieste portano l'impronta di quella rimasta; e con A, B e di nuovo
    // A, smontata la A montata dopo B, a schermo resta la A di prima, con la sua impronta.
    it('A, poi B, poi di nuovo A: smontata la A montata dopo B, a schermo torna B (sprint 60, S2; fino alla `v2.19` restava A)', () => {
        monta('ada@example.com');
        monta('grace@example.com');
        smonta(monta('ada@example.com'));
        expect(aSchermo).toBe('grace@example.com');
    });

    it('due account con la stessa email: smontata la cornice del secondo, le richieste portano l\'impronta del primo (sprint 60 · T1.1, S2)', async () => {
        const fetchFinto = vi.fn(async (_indirizzo: string, _opzioni?: RequestInit) => risposta({ data: [], aggiornati_il: unIstante, workspace: 'uat-vendite' }));
        vi.stubGlobal('fetch', fetchFinto);
        onTestFinished(() => void vi.unstubAllGlobals());
        monta('ada@example.com', IMPRONTA);
        const grace = monta('grace@example.com', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
        const secondoAccount = monta('ada@example.com', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
        smonta(secondoAccount);
        smonta(grace);

        expect(aSchermo).toBe('ada@example.com');
        await caricaNotifiche('ada@example.com');
        expect(new Headers(fetchFinto.mock.calls[0]?.[1]?.headers).get('X-Zr-Persona')).toBe(IMPRONTA);
    });
});
