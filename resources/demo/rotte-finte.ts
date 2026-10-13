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
// eliminata), di Project Management, lette: nel registro non hanno una destinazione. Con `?frasi=1` fra quelle di oggi e quella
// di ieri ci sono tre notifiche di Project Management, lette: una dice chi e che cosa, una solo chi, una solo il nome della
// scheda. Con `?opportunita=1` in fondo all'elenco ci
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
// di ricerca.crea senza `indirizzo` (tipo, id, titolo e `contesto`): board e cartelle in ordine di titolo, e in fondo due tipi
// che il registro non ha (`board.schede`, `uat-ignoto`), com'era sul tag `v1.14.0`; le fonti nuove di ricerca.crea vengono per
// prime e stanno dietro un parametro, come ogni dato nuovo della pagina di prova: con `?schede=1` una scheda, con
// `?crm_attivo=1` — lo stesso che nei dati di prova accende il CRM — contatti, aziende e opportunità; dopo di loro, senza
// parametri, un membro del workspace, col ruolo come codice: non è di un modulo, e il backoffice lo dà in ogni workspace; con
// `?id_malfatto=1` c'è una board in più con l'id `..`, che la cornice non mostra; «ua»
// risponde dopo 1500 ms con un risultato suo, «uat» dopo 100 ms: scrivendo «uat» di seguito, la risposta di «ua» arriva dopo.
// Ogni richiesta si scrive in console, una POST col corpo e gli header, e così una richiesta annullata e la risposta che arriva
// lo stesso; il cookie del gettone CSRF è finto.
// `?errore=notifiche` o `?errore=ricerca` fa fallire quella rotta; con `?ricerca_frenata=<secondi>` la prima ricerca risponde
// come la parte server quando il backoffice frena (429 `troppe_richieste` con `Retry-After: <secondi>`), e le successive come
// sempre. Con l'orologio che la pagina di prova dà, le due rotte delle
// notifiche dicono quando, come la parte server: l'elenco l'istante in cui la richiesta è arrivata (`aggiornati_il`), «Segna
// tutte come lette» quello in cui risponde (`segnate_il`); senza orologio, nessun istante. Le prova rotte-finte.test.ts. Non
// entra nel pacchetto.
// Un istante solo per tutte le notifiche di prova: con un `Date.now()` per notifica, due «di un minuto fa» prese a cavallo di un
// millisecondo avevano due ore diverse, e l'elenco non era più dalla più recente (CI del 13/10/2026, un giro rosso su due).
const ADESSO = Date.now();
const fa = (minuti: number) => new Date(ADESSO - minuti * 60_000).toISOString();
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
// Dallo sprint 26 (T6), subito dopo la prima, c'è la notifica a chi viene menzionato in un commento, da leggere: apre la sua scheda.
const schede = new URLSearchParams(window.location.search).has('schede');
// Con `?motivi=1` (sprint 36 · T5) in fondo all'elenco ci sono le due notifiche dei motivi di perdita del CRM, lette: hanno un
// titolo e, con `?chi=1`, la frase con chi; non hanno una destinazione, e non portano id.
const motivi = new URLSearchParams(window.location.search).has('motivi');
// Con `?frasi=1` l'elenco ha tre notifiche di Project Management in più, per le tre righe che il pannello può scrivere (sprint 29 · T3).
const frasi = new URLSearchParams(window.location.search).has('frasi');
// Con `?accorpata=1` in cima all'elenco c'è una notifica che racconta più azioni (sprint 32 · T3): è nata un'ora fa e l'ultima
// azione è di due minuti fa. È la forma di prima della `v2.1.0`, tenuta per le schermate: in `creata_il` c'è l'istante dell'ultima
// azione, e `ultima_azione_il`, `azioni` e `board` del backoffice non ci sono. Dalla `v2.1.0` la parte server dà anche `azioni` e
// `board_nome`: sono in `?conto=1`.
const accorpata = new URLSearchParams(window.location.search).has('accorpata');
// Con `?conto=1` in cima all'elenco ci sono cinque notifiche di Project Management con `azioni` e `board_nome`, come li dà la
// parte server dalla `v2.1.0` (sprint 34 · T2), per le righe che il pannello può scrivere sotto il titolo: il conto e la board;
// la sola board; il solo conto; il nome della cosa, che resta quando chi ha fatto non c'è; e una board con un U+202E nel nome.
const conto = new URLSearchParams(window.location.search).has('conto');
// Con `?nomi_crm=1` in cima all'elenco ci sono cinque notifiche del CRM con chi ha fatto (sprint 32 · T4): un'azienda e
// un'opportunità col nome, che sta nel titolo, e sotto non c'è niente; un contatto e un'attività eliminata, di cui il backoffice
// non dà il nome, e un'azienda senza nome, come quando il CRM è spento: queste tre hanno la frase con solo chi.
const nomiCrm = new URLSearchParams(window.location.search).has('nomi_crm');

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
/** Il nome delle due assegnate di `?opportunita=1` che lo hanno, con `?chi=1` (sprint 34 · T3): un'attività resta senza, e di un contatto il backoffice non lo dà. */
const NOME_DI_UN_ASSEGNATA: Record<string, string> = { 'crm.organizzazione.assegnata': 'UAT Acme', 'crm.trattativa.assegnata': 'UAT Rinnovo 2027' };
/** Chi ha fatto, su che cosa e per chi, quando il backoffice non li manda: la parte server li dà `null`. */
const nonDetti: { autore_nome: string | null; risorsa_nome: string | null; per_me: boolean | null } = { autore_nome: null, risorsa_nome: null, per_me: null };
/** Gli stessi tre dati quando il backoffice li manda: solo con `?chi=1`. */
const detti = (autore_nome: string | null, risorsa_nome: string | null, per_me: boolean | null) => (chi ? { autore_nome, risorsa_nome, per_me } : nonDetti);
const notificheDiProva = [
    // Solo con `?accorpata=1`, la più recente: una lista modificata più volte dalla stessa persona, da leggere. Non ha una destinazione.
    ...(accorpata
        ? [{ id: 'uat-a1', creata_il: fa(2), letta: false, app: 'pm', tipo: 'com.zeiras.board.lista.modificata', autore_nome: 'Bruno Neri', risorsa_nome: 'UAT Da fare', per_me: null, ids: {} as Record<string, string> }]
        : []),
    // Solo con `?conto=1`, le più recenti, la prima da leggere: quante azioni, e in quale board.
    ...(conto
        ? ([
              ['uat-k1', false, 'scheda.modificata', 'Bruno Neri', 'UAT Bozza', 3, 'UAT Lancio'],
              ['uat-k2', true, 'scheda.creata', 'Bruno Neri', 'UAT Brief', 1, 'UAT Lancio'],
              ['uat-k3', true, 'cartella.modificata', 'Bruno Neri', 'UAT Clienti', 3, null],
              ['uat-k4', true, 'scheda.modificata', null, 'UAT Piano', 4, 'UAT Lancio'],
              ['uat-k5', true, 'lista.modificata', 'Bruno Neri', 'UAT Da fare', 2, 'UAT \u{202E}oicnaL'],
          ] as [id: string, letta: boolean, tipo: string, autore_nome: string | null, risorsa_nome: string, azioni: number, board_nome: string | null][]).map(([id, letta, tipo, autore_nome, risorsa_nome, azioni, board_nome]) => (
              { id, creata_il: fa(1), letta, app: 'pm', tipo: `com.zeiras.board.${tipo}`, autore_nome, risorsa_nome, per_me: null, azioni, board_nome, ids: {} as Record<string, string> }
          ))
        : []),
    // Solo con `?nomi_crm=1`: cinque del CRM con chi ha fatto, le prime due da leggere e col nome della cosa.
    ...(nomiCrm
        ? ([
              ['uat-z1', 3, false, 'organizzazione.modificata', 'UAT Acme', { id: 'uat-azienda-1' }],
              ['uat-z2', 3, false, 'trattativa.creata', 'UAT Rinnovo 2027', { id: 'uat-opp-1' }],
              ['uat-z3', 4, true, 'persona.modificata', null, { id: 'uat-persona-1' }],
              ['uat-z4', 4, true, 'attivita.eliminata', null, {}],
              ['uat-z5', 4, true, 'organizzazione.creata', null, { id: 'uat-azienda-1' }],
          ] as [id: string, minuti: number, letta: boolean, tipo: string, nome: string | null, ids: Record<string, string>][]).map(([id, minuti, letta, tipo, risorsa_nome, ids]) => (
              { id, creata_il: fa(minuti), letta, app: 'crm', tipo: `com.zeiras.crm.${tipo}`, autore_nome: 'Giulia Bianchi', risorsa_nome, per_me: null, ids }
          ))
        : []),
    // Solo con `?schede=1`, la più recente: una scheda assegnata, col tipo com'è nel backoffice, senza `com.zeiras.` davanti, chi
    // l'ha assegnata e il nome della scheda, che per questo tipo il backoffice manda sempre. Un clic apre la scheda e la segna letta.
    ...(schede
        ? [{ id: 'uat-s1', creata_il: fa(2), letta: false, app: 'pm', tipo: 'board.scheda.assegnata', autore_nome: 'Marta Rossi', risorsa_nome: 'UAT Preparare il lancio', per_me: true, ids: { id: 'uat-scheda-2' } as Record<string, string> }]
        : []),
    // Solo con `?schede=1`, subito dopo: una menzione in un commento (sprint 26 · T6), col tipo com'è nel backoffice, senza
    // `com.zeiras.` davanti, chi ha scritto il commento e il nome della scheda. Porta il solo id della scheda, come dalla parte
    // server: quello del commento resta lì. Un clic apre la scheda e la segna letta.
    ...(schede
        ? [{ id: 'uat-s3', creata_il: fa(4), letta: false, app: 'pm', tipo: 'board.commento.menzione', autore_nome: 'Bruno Neri', risorsa_nome: 'UAT Rivedere il piano editoriale', per_me: true, ids: { id: 'uat-scheda-3' } as Record<string, string> }]
        : []),
    // Dallo sprint 24 una scheda nuova porta il suo id, come dalla parte server: un clic apre la scheda.
    { id: 'uat-4', creata_il: fa(5), letta: false, app: 'pm', tipo: 'com.zeiras.board.scheda.creata', ...detti('Marta Rossi', 'UAT Scrivere il brief del lancio', true), ids: { id: 'uat-scheda-1' } as Record<string, string> },
    { id: 'uat-3', creata_il: fa(3 * 60), letta: false, app: 'crm', tipo: 'com.zeiras.crm.contatto.creato', ...detti('Bruno Neri', null, false), ids: {} },
    // Solo con `?frasi=1`, fra quelle di oggi e quella di ieri, lette: le tre righe di una notifica di Project Management. La prima
    // porta chi ha fatto e il nome della scheda, e il pannello la scrive in una frase sola; la seconda solo chi (una scheda
    // eliminata: il nome non c'è); la terza solo il nome, e resta col titolo del tipo e il nome sotto. Le persone sono inventate.
    ...(frasi
        ? [
              { id: 'uat-f1', creata_il: fa(4 * 60), letta: true, app: 'pm', tipo: 'com.zeiras.board.scheda.modificata', autore_nome: 'Marta Rossi', risorsa_nome: 'UAT Preparare il lancio', per_me: null, ids: { id: 'uat-scheda-2' } as Record<string, string> },
              { id: 'uat-f2', creata_il: fa(5 * 60), letta: true, app: 'pm', tipo: 'com.zeiras.board.scheda.eliminata', autore_nome: 'Bruno Neri', risorsa_nome: null, per_me: null, ids: {} as Record<string, string> },
              { id: 'uat-f3', creata_il: fa(6 * 60), letta: true, app: 'pm', tipo: 'com.zeiras.board.scheda.modificata', autore_nome: null, risorsa_nome: 'UAT Rivedere il piano editoriale', per_me: null, ids: { id: 'uat-scheda-3' } as Record<string, string> },
          ]
        : []),
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
                  // Con `?chi=1` il CRM dice chi ha fatto, e di una pipeline anche il nome (sprint 31 · T1); le due note più sotto restano senza chi.
                  ...detti('Giulia Bianchi', tipo.startsWith('pipeline.') ? 'Vendite' : null, null),
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
    // `com.zeiras.` davanti, e rivolte alla persona (`per_me`, con `?chi=1`, che dà anche chi le ha assegnate e, dell'azienda e dell'opportunità, il nome: sta nel titolo). Portano l'id che il loro percorso chiede
    // (`DI_UN_TIPO_NUOVO`): quello dell'opportunità, del contatto o dell'azienda; un'attività nessuno, perché apre «Da fare».
    ...(opportunita
        ? [
              'com.zeiras.crm.trattativa.creata', 'com.zeiras.crm.trattativa.modificata',
              'com.zeiras.crm.attivita.creata', 'com.zeiras.crm.attivita.modificata', 'com.zeiras.crm.attivita.eliminata',
              'crm.persona.assegnata', 'crm.organizzazione.assegnata', 'crm.trattativa.assegnata', 'crm.attivita.assegnata',
          ].map((tipo, indice) => ({ id: `uat-o${indice + 1}`, creata_il: fa((25 + indice) * 24 * 60), letta: true, app: 'crm', tipo, ...(tipo.endsWith('.assegnata') ? detti('Giulia Bianchi', NOME_DI_UN_ASSEGNATA[tipo] ?? null, true) : nonDetti), ids: { ...DI_UN_TIPO_NUOVO[tipo] } }))
        : []),
    // Solo con `?motivi=1`, dopo quelle di `?opportunita=1`: un motivo di perdita del CRM creato e uno modificato, letti. Il registro
    // non dà loro una destinazione: nessun id.
    ...(motivi
        ? ['com.zeiras.crm.motivo.creato', 'com.zeiras.crm.motivo.modificato'].map((tipo, indice) => ({ id: `uat-m${indice + 1}`, creata_il: fa((36 + indice) * 24 * 60), letta: true, app: 'crm', tipo, ...detti('Giulia Bianchi', null, null), ids: {} as Record<string, string> }))
        : []),
    // Solo con `?schede=1`, la più vecchia di tutte: una scheda eliminata, letta. Non ha più una pagina, e non porta id.
    ...(schede ? [{ id: 'uat-s2', creata_il: fa(40 * 24 * 60), letta: true, app: 'pm', tipo: 'com.zeiras.board.scheda.eliminata', ...nonDetti, ids: {} as Record<string, string> }] : []),
];
let letture = 0;
let riuscite = 0;
let caricamenti = 0;
// Come nei dati di prova (demo.tsx): con `?crm_attivo=1` il CRM è attivo nel workspace, a meno di `?senza_crm=1`.
const crmAttivo = new URLSearchParams(window.location.search).has('crm_attivo') && !new URLSearchParams(window.location.search).has('senza_crm');
// Con `?senza_moduli=1` nel workspace nessun modulo è attivo (demo.tsx), e il backoffice lì cerca i soli membri, che non sono di
// un modulo: della ricerca finta resta il membro.
const senzaModuli = new URLSearchParams(window.location.search).has('senza_moduli');
const risultatiDiProva = [
    // Come ricerca.crea: per prime le fonti nuove — schede, contatti, aziende, opportunità —, ognuna col `contesto` che la
    // rotta vera lascia uscire: le chiavi che il registro dà al tipo, coi soli testi. Un contatto può non avere né azienda né
    // ruolo, e allora ha `null`, come un'azienda: mai un `null` fra i valori. Stanno dietro un parametro: la scheda solo con
    // `?schede=1`; contatti, aziende e opportunità solo col CRM attivo (`?crm_attivo=1`), come il backoffice, che una fonte la
    // dà solo se il suo prodotto è attivo nel workspace.
    ...(schede ? [{ tipo: 'board.scheda', id: 'uat-s1', titolo: 'UAT Preparare il lancio', contesto: { board: 'UAT Lancio Q4', lista: 'UAT Da fare' } }] : []),
    ...(crmAttivo
        ? [
            { tipo: 'crm.persona', id: 'uat-p1', titolo: 'UAT Grace Hopper', contesto: { organizzazione: 'UAT Acme', ruolo: 'UAT Responsabile acquisti' } },
            { tipo: 'crm.persona', id: 'uat-p2', titolo: 'UAT Alan Turing', contesto: null },
            { tipo: 'crm.organizzazione', id: 'uat-o1', titolo: 'UAT Acme', contesto: null },
            // Un'opportunità aperta e una vinta, con l'`esito` che il backoffice dà a ogni opportunità: della prima la cornice
            // mostra pipeline e fase, della seconda anche l'esito, nella lingua.
            { tipo: 'crm.trattativa', id: 'uat-t1', titolo: 'UAT Rinnovo 2027', contesto: { pipeline: 'UAT Vendite', fase: 'UAT Proposta', esito: 'aperta' } },
            { tipo: 'crm.trattativa', id: 'uat-t2', titolo: 'UAT Fornitura 2026', contesto: { pipeline: 'UAT Vendite', fase: 'UAT Contratto', esito: 'vinta' } },
        ]
        : []),
    // Un membro del workspace, in ogni caso: non dipende da un modulo. Di `contesto` ha il solo `ruolo`, e come codice: è ciò
    // che la rotta vera lascia uscire (mai l'email), e il suo testo nella lingua lo mette la cornice.
    { tipo: 'workspace.membro', id: 'uat-m1', titolo: 'UAT Katherine Johnson', contesto: { ruolo: 'amministratore' } },
    // Poi board e cartelle, in ordine di titolo, senza `contesto`.
    { tipo: 'board.board', id: 'uat-13', titolo: 'UAT Lancio Q1', contesto: null },
    { tipo: 'board.board', id: 'uat-12', titolo: 'UAT Lancio Q4', contesto: null },
    // Solo con `?id_malfatto=1`: una board il cui id non ha la forma di un id. La cornice non la mostra.
    ...(new URLSearchParams(window.location.search).has('id_malfatto') ? [{ tipo: 'board.board', id: '..', titolo: 'UAT Lancio Q9, id malfatto', contesto: null }] : []),
    { tipo: 'board.cartelle', id: 'uat-3', titolo: 'UAT Marketing', contesto: null },
    { tipo: 'board.board', id: 'uat-14', titolo: 'UAT Report marketing', contesto: null },
    // Due tipi che il registro non ha: la cornice non li mostra.
    { tipo: 'board.schede', id: 'uat-77', titolo: 'UAT Scrivere il brief del lancio', contesto: null },
    { tipo: 'uat-ignoto', id: 'uat-9', titolo: 'UAT tipo ignoto', contesto: null },
];
const errore = new URLSearchParams(window.location.search).get('errore');
const ricercaFrenata = new URLSearchParams(window.location.search).get('ricerca_frenata');
let giaFrenata = false;
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
// Sprint 37 · T1 (voci #1998, #1999): le rotte vere rispondono coi dati di chi è nella sessione quando la richiesta arriva. Con
// la persona della «sessione» (la dà la pagina di prova del layout con `?sessione`) lo fanno anche queste, e lo dicono nel
// testo: in cima all'elenco c'è una notifica da leggere di chi è entrato adesso («UAT scheda di Ada»), e in cima ai risultati
// una board sua («UAT Lancio di Ada»). Ognuna ha la sua notifica: letta da una persona, resta da leggere per l'altra.
type NotificaDiProva = (typeof notificheDiProva)[number];
const diUnaPersona = new Map<string, NotificaDiProva>();

/** Il nome con cui i testi di prova dicono di chi sono: «Ada» per «UAT Ada Lovelace». */
const nomeBreve = (nome: string) => nome.replace(/^UAT /, '').split(' ')[0] ?? nome;

/** La notifica di quella persona: la stessa a ogni richiesta, così una lettura resta. */
function notificaDi(nome: string): NotificaDiProva {
    const breve = nomeBreve(nome);
    const notifica = diUnaPersona.get(breve) ?? { id: `uat-di-${breve.toLowerCase()}`, creata_il: fa(1), letta: false, app: 'pm', tipo: 'com.zeiras.board.scheda.creata', autore_nome: null, risorsa_nome: `UAT scheda di ${breve}`, per_me: null, ids: { id: 'uat-scheda-1' } };
    diUnaPersona.set(breve, notifica);

    return notifica;
}

export function rotteFinte(slugDellaSessione: () => string | undefined, istante?: () => string, personaDellaSessione?: () => { nome: string } | undefined): void {
    /** L'elenco di chi è nella «sessione» adesso: con la persona, la sua notifica e poi quelle di tutti. */
    const elenco = (): NotificaDiProva[] => {
        const persona = personaDellaSessione?.();

        return persona ? [notificaDi(persona.nome), ...notificheDiProva] : notificheDiProva;
    };
    /** I risultati fra cui cerca chi è nella «sessione» adesso: con la persona, la sua board e poi quelli di tutti. */
    const risultati = (): typeof risultatiDiProva => {
        const breve = nomeBreve(personaDellaSessione?.()?.nome ?? '');

        return breve === '' ? risultatiDiProva : [{ tipo: 'board.board', id: `uat-di-${breve.toLowerCase()}`, titolo: `UAT Lancio di ${breve}`, contesto: null }, ...risultatiDiProva];
    };
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
            if (ricercaFrenata !== null && !giaFrenata) {
                giaFrenata = true;

                return new Response(JSON.stringify({ errore: 'troppe_richieste' }), { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': ricercaFrenata } });
            }
            if (daAccettare) {
                return json({ errore: 'accettazione_richiesta' }, 403);
            }
            if (errore === 'ricerca') {
                return json({ errore: 'uat_errore' }, 502);
            }

            // `workspace` è quello della «sessione», come lo dice la parte server dalla `v1.12.0`, mai uno della richiesta: se la
            // pagina di prova non lo dà manca, e per la cornice la ricerca è un errore.
            return json({
                // «ua» dà il risultato vecchio di una board, ma non dove nessun modulo è attivo: lì passa dal filtro come ogni parola.
                data: parola === 'ua' && !senzaModuli
                    ? [{ tipo: 'board.board', id: 'uat-ua', titolo: 'UAT risultato vecchio di «ua»', contesto: null }]
                    : risultati().filter((risultato) => risultato.titolo.toLowerCase().includes(parola.toLowerCase()) && (!senzaModuli || risultato.tipo.startsWith('workspace.'))),
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
            return json({ data: elenco(), aggiornati_il: lettoIl, workspace: slugDellaSessione() });
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
            // Come la parte server: lo slug della pagina dev'essere quello del workspace della sessione. Se la pagina di prova
            // non lo dà, non c'è un workspace con cui lo slug possa non tornare: la lettura riesce.
            const dellaSessione = slugDellaSessione();
            if (dellaSessione !== undefined && workspace !== dellaSessione) {
                return json({ errore: 'workspace_diverso' }, 409);
            }
            // Con `?altre=1` la prima che riesce si ferma a un tetto: la più recente fra quelle da segnare resta da leggere.
            riuscite += 1;
            const restano = altre && riuscite === 1;
            const daSegnare = elenco().filter((notifica) => !notifica.letta && new Date(notifica.creata_il).getTime() <= finoAIl);
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
            const notifica = elenco().find(({ id }) => id === daSegnare);
            if (notifica === undefined) {
                return json({ errore: 'non_trovato' }, 404);
            }
            notifica.letta = letta;

            return json({ data: { id: notifica.id, letta: notifica.letta }, segnata_il: istante?.() });
        }

        return json({ errore: 'non_trovato' }, 404);
    };
}
