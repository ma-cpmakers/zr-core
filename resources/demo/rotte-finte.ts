// Le rotte della cornice, finte, per le pagine di prova: rispondono dopo un attimo, per vedere il caricamento, nella forma della
// parte server. Le notifiche d'esempio: due non lette di oggi, di due prodotti del registro (`pm`, `crm`), una letta ieri con un
// codice che il registro non ha e una letta nove giorni fa che non è di un'app; con `?arriva=1`, dal secondo caricamento, una
// nuova non letta nata in quel momento. «Segna tutte come lette» (POST /cornice/notifiche/letture) segna lette quelle nate fino a
// `fino_a` e risponde con l'istante in UTC; con `?errore=letture` la prima fallisce e la seconda riesce. La ricerca dà i risultati
// d'esempio che hanno la parola nel titolo, nella forma di ricerca.elenca (tipo, id e titolo, in ordine di titolo), coi tipi
// mescolati e due tipi che il registro non ha (`board.schede`, `uat-ignoto`); «ua» risponde dopo 1500 ms con un risultato suo,
// «uat» dopo 100 ms: scrivendo «uat» di seguito, la risposta di «ua» arriva dopo. Ogni richiesta si scrive in console, la POST
// col corpo e gli header, e così una richiesta annullata e la risposta che arriva lo stesso; il cookie del gettone CSRF è finto.
// `?errore=notifiche` o `?errore=ricerca` fa fallire quella rotta. Non entra nel pacchetto.
const fa = (minuti: number) => new Date(Date.now() - minuti * 60_000).toISOString();
const ieri = new Date();
ieri.setDate(ieri.getDate() - 1);
ieri.setHours(12, 0, 0, 0);
const notificheDiProva = [
    { id: 'uat-4', creata_il: fa(5), letta: false, app: 'pm' },
    { id: 'uat-3', creata_il: fa(3 * 60), letta: false, app: 'crm' },
    { id: 'uat-2', creata_il: ieri.toISOString(), letta: true, app: 'uat-ignota' },
    { id: 'uat-1', creata_il: fa(9 * 24 * 60), letta: true, app: null },
];
let letture = 0;
let caricamenti = 0;
const risultatiDiProva = [
    { tipo: 'board.board', id: 'uat-13', titolo: 'UAT Lancio Q1' },
    { tipo: 'board.board', id: 'uat-12', titolo: 'UAT Lancio Q4' },
    { tipo: 'board.cartelle', id: 'uat-3', titolo: 'UAT Marketing' },
    { tipo: 'board.board', id: 'uat-14', titolo: 'UAT Report marketing' },
    { tipo: 'board.schede', id: 'uat-77', titolo: 'UAT Scrivere il brief del lancio' },
    { tipo: 'uat-ignoto', id: 'uat-9', titolo: 'UAT tipo ignoto' },
];
const errore = new URLSearchParams(window.location.search).get('errore');
const arriva = new URLSearchParams(window.location.search).has('arriva');

let partite = 0;
const inAscolto = new Set<() => void>();

/** Quante `GET /cornice/notifiche` sono partite, nella forma di `useSyncExternalStore`: la pagina di prova del layout lo mostra. */
export const notifichePartite = {
    ascolta: (avvisa: () => void) => {
        inAscolto.add(avvisa);

        return () => {
            inAscolto.delete(avvisa);
        };
    },
    quante: () => partite,
};

/** Mette le rotte finte al posto di `fetch`. Il workspace della «sessione» lo dice la pagina di prova, ogni volta che serve. */
export function rotteFinte(slugDellaSessione: () => string | undefined): void {
    const fetchDelBrowser = window.fetch.bind(window);
    const cookieCsrf = 'XSRF-TOKEN';
    document.cookie = `${cookieCsrf}=uat-gettone-csrf%3D%3D; path=/`;
    window.fetch = async (indirizzo: RequestInfo | URL, opzioni?: RequestInit) => {
        const percorso = String(indirizzo);
        if (!percorso.startsWith('/cornice/')) {
            return fetchDelBrowser(indirizzo, opzioni);
        }
        console.info('UAT', opzioni?.method ?? 'GET', percorso, opzioni?.body ?? '', JSON.stringify(opzioni?.headers ?? {}));
        opzioni?.signal?.addEventListener('abort', () => console.info('UAT annullata', percorso));
        if (percorso === '/cornice/notifiche') {
            partite += 1;
            inAscolto.forEach((avvisa) => avvisa());
        }
        const json = (corpo: unknown, stato = 200) => new Response(JSON.stringify(corpo), { status: stato, headers: { 'Content-Type': 'application/json' } });
        const [rotta, query = ''] = percorso.split('?');
        if (rotta === '/cornice/ricerca') {
            // Non si ferma sull'annullamento: la risposta di una parola vecchia arriva lo stesso, e la cornice non la mostra.
            const parola = new URLSearchParams(query).get('q') ?? '';
            await new Promise((fatto) => setTimeout(fatto, { ua: 1500, uat: 100 }[parola] ?? 800));
            console.info('UAT risposta', percorso);
            if (errore === 'ricerca') {
                return json({ errore: 'uat_errore' }, 502);
            }

            return json({
                data: parola === 'ua'
                    ? [{ tipo: 'board.board', id: 'uat-ua', titolo: 'UAT risultato vecchio di «ua»' }]
                    : risultatiDiProva.filter((risultato) => risultato.titolo.toLowerCase().includes(parola.toLowerCase())),
            });
        }
        await new Promise((fatto) => setTimeout(fatto, 800));
        if (percorso === '/cornice/notifiche') {
            caricamenti += 1;
            if (errore === 'notifiche') {
                return json({ errore: 'uat_errore' }, 502);
            }
            if (arriva && caricamenti === 2) {
                notificheDiProva.unshift({ id: 'uat-5', creata_il: new Date().toISOString(), letta: false, app: 'pm' });
            }

            return json({ data: notificheDiProva });
        }
        if (percorso === '/cornice/notifiche/letture' && opzioni?.method === 'POST') {
            letture += 1;
            if (errore === 'letture' && letture === 1) {
                return json({ errore: 'uat_errore' }, 502);
            }
            const { fino_a: finoA, workspace } = JSON.parse(String(opzioni.body)) as { fino_a?: unknown; workspace?: unknown };
            const istante = typeof finoA === 'string' ? new Date(finoA).getTime() : Number.NaN;
            if (Number.isNaN(istante) || typeof workspace !== 'string' || workspace === '') {
                return json({ errore: 'dati_non_validi' }, 422);
            }
            // Come la parte server: lo slug della pagina dev'essere quello del workspace della sessione.
            if (workspace !== slugDellaSessione()) {
                return json({ errore: 'workspace_diverso' }, 409);
            }
            for (const notifica of notificheDiProva) {
                if (new Date(notifica.creata_il).getTime() <= istante) {
                    notifica.letta = true;
                }
            }

            return json({ data: { fino_a: new Date(istante).toISOString() } });
        }

        return json({ errore: 'non_trovato' }, 404);
    };
}
