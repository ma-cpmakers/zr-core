// Le rotte della cornice, finte, per le pagine di prova: rispondono dopo un attimo, per vedere il caricamento, nella forma della
// parte server. Le notifiche d'esempio: due non lette di oggi, di due prodotti del registro (`pm`, `crm`), una letta ieri con un
// codice che il registro non ha e una letta nove giorni fa che non è di un'app; con `?arriva=1`, dal secondo caricamento, una
// nuova non letta nata in quel momento. Ognuna ha il tipo dell'evento, com'è nel backoffice, tranne una: due sono di tipi che
// zr-core conosce (una scheda creata, una persona entrata nel workspace) e hanno il titolo del tipo, una è di un tipo che non
// conosce e una non ha `tipo`, e hanno il titolo di ripiego. Chi ha fatto, su che cosa e per chi (`autore_nome`, `risorsa_nome`,
// `per_me`) sono `null`, come li dà la parte server quando il backoffice non li manda; con `?chi=1` la più recente dice chi e
// su che cosa ed è rivolta alla persona, la seconda dice chi ed è per tutto il workspace (solo in «Tutte»), le altre restano
// com'erano, e ce n'è una in più, letta tre giorni fa, su un'app: ha in `risorsa_nome` il codice dell'app, com'è nel backoffice, e
// il pannello ne mostra il nome. Con `?crm=1` in fondo all'elenco ci sono le notifiche del CRM, lette: una per ognuno dei sette
// tipi che zr-core conosce (contatti, pipeline, note) e una di un tipo che non conosce ancora (`com.zeiras.crm.persona.assegnata`),
// col titolo di ripiego, e due note che non hanno dove andare (la riga sotto il titolo dice quale: «UAT nota senza contatto»,
// «UAT nota con un id malfatto»), e in fondo due di un'azienda, una creata e una modificata; senza `?crm`, l'elenco è quello di
// prima. Con `?viste=1` in fondo all'elenco ci sono tre notifiche delle viste salvate di una board (creata, modificata,
// eliminata), di Project Management, lette: nel registro non hanno una destinazione. Con `?opportunita=1` in fondo all'elenco ci
// sono le nove notifiche dei tipi nuovi del CRM, lette: i cinque eventi di opportunità e attività, poi le quattro che il CRM manda a
// chi diventa responsabile, col tipo com'è nel backoffice, senza `com.zeiras.` davanti (`crm.persona.assegnata`); zr-core conosce
// tutti e nove i tipi, e ognuno apre la sua pagina nel CRM: l'opportunità, il contatto, l'azienda, e «Da fare» per un'attività.
// Ogni notifica porta gli id che la parte server dà di `dati` (`ids`): i soli del percorso del registro che si apre per il suo
// tipo, e nessuno se il tipo non ha una destinazione o se il percorso non chiede un id; mai `dati`
// né `soggetto`. Da una del CRM la cornice apre la sua risorsa, nel workspace che l'elenco dice (`workspace`: quello della «sessione»). «Segna tutte come lette» (POST /cornice/notifiche/letture) segna lette quelle nate fino a
// `fino_a` e risponde con l'istante in UTC e con `altre`, se ne restano: `false`, salvo con `?altre=1`, dove la prima che riesce
// si ferma come la parte server a un tetto (lascia non letta la più recente e dice `true`) e la seconda le segna tutte; con
// `?errore=letture` la prima fallisce e la seconda riesce. La lettura di una notifica sola (PATCH /cornice/notifiche/<id>/lettura,
// che la cornice chiede col clic che apre la risorsa di una non letta) la segna e risponde con `letta` e con l'istante; con
// `?errore=lettura` fallisce sempre, e la notifica resta da leggere. La ricerca (POST /cornice/ricerca, la parola nel corpo: a una GET
// risponde 405, senza una parola da 2 a 100 caratteri 422) dà i risultati d'esempio che hanno la parola nel titolo, nella forma
// di ricerca.elenca (tipo, id e titolo, in ordine di titolo), coi tipi mescolati e due tipi che il registro non ha
// (`board.schede`, `uat-ignoto`); «ua» risponde dopo 1500 ms con un risultato suo, «uat» dopo 100 ms: scrivendo «uat» di
// seguito, la risposta di «ua» arriva dopo. Ogni richiesta si scrive in console, una POST col corpo e gli header, e così una
// richiesta annullata e la risposta che arriva lo stesso; il cookie del gettone CSRF è finto.
// `?errore=notifiche` o `?errore=ricerca` fa fallire quella rotta. Con l'orologio che la pagina di prova dà, le due rotte delle
// notifiche dicono quando, come la parte server: l'elenco l'istante in cui la richiesta è arrivata (`aggiornati_il`), «Segna
// tutte come lette» quello in cui risponde (`segnate_il`); senza orologio, nessun istante. Le prova rotte-finte.test.ts. Non
// entra nel pacchetto.
const fa = (minuti: number) => new Date(Date.now() - minuti * 60_000).toISOString();
const ieri = new Date();
ieri.setDate(ieri.getDate() - 1);
ieri.setHours(12, 0, 0, 0);
const chi = new URLSearchParams(window.location.search).has('chi');
const crm = new URLSearchParams(window.location.search).has('crm');
// Con `?da_leggere=1` le prime otto notifiche del CRM sono da leggere: per provare il clic che apre la risorsa e le segna lette.
const daLeggere = new URLSearchParams(window.location.search).has('da_leggere');
const viste = new URLSearchParams(window.location.search).has('viste');
const opportunita = new URLSearchParams(window.location.search).has('opportunita');
// Con `?schede=1` (sprint 24 · T3) in cima all'elenco c'è la notifica che Project Management manda a chi viene assegnata una
// scheda, da leggere, e in fondo una scheda eliminata, letta: la prima apre la scheda, la seconda non ha una destinazione.
const schede = new URLSearchParams(window.location.search).has('schede');

/**
 * Gli `ids` delle tre note di `?crm=1`, come li dà la parte server: i soli del percorso che si apre. La prima è legata a
 * un'opportunità e a un contatto, e porta la sola opportunità; la seconda al solo contatto; la terza alla sola azienda.
 */
const DI_UNA_NOTA: Record<string, Record<string, string>> = {
    'nota.creata': { trattativa_id: 'uat-opp-1' },
    'nota.modificata': { persona_id: 'uat-persona-2' },
    'nota.eliminata': { organizzazione_id: 'uat-azienda-1' },
};

/** Gli `ids` delle nove di `?opportunita=1`: l'id della risorsa per chi ha una pagina sua, nessuno per un'attività. */
const DI_UN_TIPO_NUOVO: Record<string, Record<string, string>> = {
    'com.zeiras.crm.trattativa.creata': { id: 'uat-opp-1' },
    'com.zeiras.crm.trattativa.modificata': { id: 'uat-opp-1' },
    'crm.trattativa.assegnata': { id: 'uat-opp-1' },
    'crm.persona.assegnata': { id: 'uat-persona-1' },
    'crm.organizzazione.assegnata': { id: 'uat-azienda-1' },
};
/** Chi ha fatto, su che cosa e per chi, quando il backoffice non li manda: la parte server li dà `null`. */
const nonDetti: { autore_nome: string | null; risorsa_nome: string | null; per_me: boolean | null } = { autore_nome: null, risorsa_nome: null, per_me: null };
/** Gli stessi tre dati quando il backoffice li manda: solo con `?chi=1`. */
const detti = (autore_nome: string | null, risorsa_nome: string | null, per_me: boolean | null) => (chi ? { autore_nome, risorsa_nome, per_me } : nonDetti);
const notificheDiProva = [
    // Solo con `?schede=1`, la più recente: una scheda assegnata, col tipo com'è nel backoffice, senza `com.zeiras.` davanti, chi
    // l'ha assegnata e il nome della scheda, che per questo tipo il backoffice manda sempre. Un clic apre la scheda e la segna letta.
    ...(schede
        ? [{ id: 'uat-s1', creata_il: fa(2), letta: false, app: 'pm', tipo: 'board.scheda.assegnata', autore_nome: 'Marta Rossi', risorsa_nome: 'UAT Preparare il lancio', per_me: true, ids: { id: 'uat-scheda-2' } as Record<string, string> }]
        : []),
    // Dallo sprint 24 una scheda nuova porta il suo id, come dalla parte server: un clic apre la scheda.
    { id: 'uat-4', creata_il: fa(5), letta: false, app: 'pm', tipo: 'com.zeiras.board.scheda.creata', ...detti('Marta Rossi', 'UAT Scrivere il brief del lancio', true), ids: { id: 'uat-scheda-1' } as Record<string, string> },
    { id: 'uat-3', creata_il: fa(3 * 60), letta: false, app: 'crm', tipo: 'com.zeiras.crm.contatto.creato', ...detti('Bruno Neri', null, false), ids: {} },
    { id: 'uat-2', creata_il: ieri.toISOString(), letta: true, app: 'uat-ignota', ...nonDetti, ids: {} },
    // Solo con `?chi=1`, una notifica su un'app: lì il backoffice dà il codice dell'app (`pm`), e il pannello ne mostra il nome.
    ...(chi ? [{ id: 'uat-0', creata_il: fa(3 * 24 * 60), letta: true, app: null, tipo: 'com.zeiras.app.modificata', autore_nome: 'Marta Rossi', risorsa_nome: 'pm', per_me: null, ids: {} }] : []),
    { id: 'uat-1', creata_il: fa(9 * 24 * 60), letta: true, app: null, tipo: 'com.zeiras.workspace.membro.creato', ...nonDetti, ids: {} },
    // Solo con `?crm=1`, le notifiche del CRM: più vecchie di tutte le altre, una al giorno. L'ottava è di un tipo che zr-core non
    // conosce, e non ha id. Gli id sono quelli che la parte server dà di `dati`, i soli che servono ad aprire la risorsa: una nota
    // porta quello della cosa più specifica a cui è attaccata, non il suo (`DI_UNA_NOTA`). Le ultime due sono note che non hanno
    // dove andare, e la riga sotto il titolo dice quale: una senza legami, e una con un contatto che non ha la forma di un id — la
    // parte server vera non lo darebbe, qui c'è per vedere che la cornice non lo mette in un indirizzo.
    ...(crm
        ? [
              ...['persona.creata', 'persona.modificata', 'pipeline.creata', 'pipeline.modificata', 'nota.creata', 'nota.modificata', 'nota.eliminata', 'persona.assegnata'].map((tipo, indice) => ({
                  id: `uat-c${indice + 1}`,
                  creata_il: fa((10 + indice) * 24 * 60),
                  letta: !daLeggere,
                  app: 'crm',
                  tipo: `com.zeiras.crm.${tipo}`,
                  ...nonDetti,
                  ids: (tipo === 'persona.assegnata' ? {} : (DI_UNA_NOTA[tipo] ?? { id: tipo.startsWith('pipeline.') ? 'uat-pipeline-1' : 'uat-persona-1' })) as Record<string, string>,
              })),
              { id: 'uat-c9', creata_il: fa(18 * 24 * 60), letta: true, app: 'crm', tipo: 'com.zeiras.crm.nota.creata', autore_nome: null, risorsa_nome: 'UAT nota senza contatto', per_me: null, ids: {} },
              { id: 'uat-c10', creata_il: fa(19 * 24 * 60), letta: true, app: 'crm', tipo: 'com.zeiras.crm.nota.creata', autore_nome: null, risorsa_nome: 'UAT nota con un id malfatto', per_me: null, ids: { persona_id: '../x' } },
              // Le due di un'azienda: nel contratto è una `organizzazione`, e porta il suo id.
              ...['creata', 'modificata'].map((cosa, indice) => ({ id: `uat-c${indice + 11}`, creata_il: fa((20 + indice) * 24 * 60), letta: true, app: 'crm', tipo: `com.zeiras.crm.organizzazione.${cosa}`, ...nonDetti, ids: { id: 'uat-azienda-1' } as Record<string, string> })),
          ]
        : []),
    // Solo con `?viste=1`, le notifiche delle viste salvate di una board: di Project Management, più vecchie di tutte le altre.
    // Non portano id: nel registro una vista non ha una destinazione, e la parte server non ne dà.
    ...(viste
        ? ['creata', 'modificata', 'eliminata'].map((cosa, indice) => ({ id: `uat-v${indice + 1}`, creata_il: fa((22 + indice) * 24 * 60), letta: true, app: 'pm', tipo: `com.zeiras.board.vista.${cosa}`, ...nonDetti, ids: {} as Record<string, string> }))
        : []),
    // Solo con `?opportunita=1`, le nove notifiche dei tipi nuovi del CRM, più vecchie di tutte le altre: i cinque eventi di
    // opportunità e attività, poi le quattro che il CRM manda a chi diventa responsabile, col tipo com'è nel backoffice, senza
    // `com.zeiras.` davanti, e rivolte alla persona (`per_me`, con `?chi=1`). Portano l'id che il loro percorso chiede
    // (`DI_UN_TIPO_NUOVO`): quello dell'opportunità, del contatto o dell'azienda; un'attività nessuno, perché apre «Da fare».
    ...(opportunita
        ? [
              'com.zeiras.crm.trattativa.creata', 'com.zeiras.crm.trattativa.modificata',
              'com.zeiras.crm.attivita.creata', 'com.zeiras.crm.attivita.modificata', 'com.zeiras.crm.attivita.eliminata',
              'crm.persona.assegnata', 'crm.organizzazione.assegnata', 'crm.trattativa.assegnata', 'crm.attivita.assegnata',
          ].map((tipo, indice) => ({ id: `uat-o${indice + 1}`, creata_il: fa((25 + indice) * 24 * 60), letta: true, app: 'crm', tipo, ...(tipo.endsWith('.assegnata') ? detti(null, null, true) : nonDetti), ids: { ...DI_UN_TIPO_NUOVO[tipo] } }))
        : []),
    // Solo con `?schede=1`, la più vecchia di tutte: una scheda eliminata, letta. Non ha più una pagina, e non porta id.
    ...(schede ? [{ id: 'uat-s2', creata_il: fa(40 * 24 * 60), letta: true, app: 'pm', tipo: 'com.zeiras.board.scheda.eliminata', ...nonDetti, ids: {} as Record<string, string> }] : []),
];
let letture = 0;
let riuscite = 0;
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
const altre = new URLSearchParams(window.location.search).has('altre');
// Con `?accettazione=dopo` la persona non ha accettato i documenti legali in vigore, e lo dicono le rotte: come la parte server
// dalla `v1.14.0`, le quattro rispondono 403 col solo codice, dopo la loro attesa. I dati della pagina restano quelli di sempre.
const daAccettare = new URLSearchParams(window.location.search).get('accettazione') === 'dopo';

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

/**
 * Mette le rotte finte al posto di `fetch`. Il workspace della «sessione» lo dice la pagina di prova, ogni volta che serve.
 * `istante` è l'orologio della sua parte server, lo stesso che mette il segno nei dati: con quello le due rotte delle notifiche
 * dicono quando, e i loro istanti si confrontano con quelli dei dati; senza, non lo dicono.
 */
export function rotteFinte(slugDellaSessione: () => string | undefined, istante?: () => string): void {
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
        if (percorso.split('?')[0] === '/cornice/ricerca') {
            // Come la parte server: la parola si legge solo dal corpo di una POST, da 2 a 100 caratteri senza gli spazi ai bordi.
            if (opzioni?.method !== 'POST') {
                // Come Laravel a una rotta che c'è solo in POST: i metodi ammessi, e nessun corpo che la rotta vera non ha.
                return new Response(null, { status: 405, headers: { Allow: 'POST' } });
            }
            let corpo: unknown = null;
            try {
                corpo = JSON.parse(String(opzioni.body ?? ''));
            } catch {
                // Un corpo che non è JSON non porta una parola.
            }
            const q = typeof corpo === 'object' && corpo !== null ? (corpo as { q?: unknown }).q : undefined;
            const parola = typeof q === 'string' ? q.trim() : '';
            if (Array.from(parola).length < 2 || Array.from(parola).length > 100) {
                return json({ errore: 'dati_non_validi' }, 422);
            }
            // Non si ferma sull'annullamento: la risposta di una parola vecchia arriva lo stesso, e la cornice non la mostra.
            await new Promise((fatto) => setTimeout(fatto, { ua: 1500, uat: 100 }[parola] ?? 800));
            console.info('UAT risposta', percorso);
            if (daAccettare) {
                return json({ errore: 'accettazione_richiesta' }, 403);
            }
            if (errore === 'ricerca') {
                return json({ errore: 'uat_errore' }, 502);
            }

            // `workspace` è quello della «sessione», come lo dice la parte server dalla `v1.12.0`, mai uno della richiesta: se la
            // pagina di prova non lo dà manca, e per la cornice la ricerca è un errore.
            return json({
                data: parola === 'ua'
                    ? [{ tipo: 'board.board', id: 'uat-ua', titolo: 'UAT risultato vecchio di «ua»' }]
                    : risultatiDiProva.filter((risultato) => risultato.titolo.toLowerCase().includes(parola.toLowerCase())),
                workspace: slugDellaSessione(),
            });
        }
        // Come la parte server: l'elenco si comincia a leggere quando la richiesta arriva, non quando la risposta parte.
        const lettoIl = percorso === '/cornice/notifiche' ? istante?.() : undefined;
        await new Promise((fatto) => setTimeout(fatto, 800));
        if (daAccettare) {
            return json({ errore: 'accettazione_richiesta' }, 403);
        }
        if (percorso === '/cornice/notifiche') {
            caricamenti += 1;
            if (errore === 'notifiche') {
                return json({ errore: 'uat_errore' }, 502);
            }
            if (arriva && caricamenti === 2) {
                notificheDiProva.unshift({ id: 'uat-5', creata_il: new Date().toISOString(), letta: false, app: 'pm', tipo: 'com.zeiras.board.scheda.modificata', ...nonDetti, ids: { id: 'uat-scheda-1' } });
            }

            // Senza orologio l'istante manca, e nel JSON la chiave non c'è. `workspace` è quello della «sessione», come lo dice
            // la parte server dalla `v1.12.0`: se la pagina di prova non lo dà, manca anche lui.
            return json({ data: notificheDiProva, aggiornati_il: lettoIl, workspace: slugDellaSessione() });
        }
        if (percorso === '/cornice/notifiche/letture' && opzioni?.method === 'POST') {
            letture += 1;
            if (errore === 'letture' && letture === 1) {
                return json({ errore: 'uat_errore' }, 502);
            }
            const { fino_a: finoA, workspace } = JSON.parse(String(opzioni.body)) as { fino_a?: unknown; workspace?: unknown };
            const finoAIl = typeof finoA === 'string' ? new Date(finoA).getTime() : Number.NaN;
            if (Number.isNaN(finoAIl) || typeof workspace !== 'string' || workspace === '') {
                return json({ errore: 'dati_non_validi' }, 422);
            }
            // Come la parte server: lo slug della pagina dev'essere quello del workspace della sessione.
            if (workspace !== slugDellaSessione()) {
                return json({ errore: 'workspace_diverso' }, 409);
            }
            // Con `?altre=1` la prima che riesce si ferma a un tetto: la più recente fra quelle da segnare resta da leggere.
            riuscite += 1;
            const restano = altre && riuscite === 1;
            const daSegnare = notificheDiProva.filter((notifica) => !notifica.letta && new Date(notifica.creata_il).getTime() <= finoAIl);
            for (const notifica of restano ? daSegnare.slice(1) : daSegnare) {
                notifica.letta = true;
            }

            // A notifiche segnate: ciò che è stato letto prima di adesso può non saperlo.
            return json({ data: { fino_a: new Date(finoAIl).toISOString(), altre: restano }, segnate_il: istante?.() });
        }

        // La lettura di una notifica sola, che la cornice chiede col clic che apre la sua risorsa: la segna e risponde come la
        // parte server dalla `v1.12.0`, con l'istante preso a notifica segnata. Con `?errore=lettura` fallisce sempre: la
        // risorsa si apre lo stesso, e la notifica resta da leggere.
        const daSegnare = /^\/cornice\/notifiche\/([A-Za-z0-9_-]{1,64})\/lettura$/.exec(percorso)?.[1];
        if (daSegnare !== undefined && opzioni?.method === 'PATCH') {
            if (errore === 'lettura') {
                return json({ errore: 'uat_errore' }, 502);
            }
            const { letta } = JSON.parse(String(opzioni.body)) as { letta?: unknown };
            if (typeof letta !== 'boolean') {
                return json({ errore: 'dati_non_validi' }, 422);
            }
            const notifica = notificheDiProva.find(({ id }) => id === daSegnare);
            if (notifica === undefined) {
                return json({ errore: 'non_trovato' }, 404);
            }
            notifica.letta = letta;

            return json({ data: { id: notifica.id, letta: notifica.letta }, segnata_il: istante?.() });
        }

        return json({ errore: 'non_trovato' }, 404);
    };
}
