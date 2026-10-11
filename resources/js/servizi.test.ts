import { afterEach, describe, expect, it, vi } from 'vitest';
import { segnaLetta } from './servizi';

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
