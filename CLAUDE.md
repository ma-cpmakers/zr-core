# zr-core — la cornice comune di Zeiras

**Prima azione di ogni sessione: la skill `ma-dev`** (contratto di sviluppo: i test girano in CI, non in
locale). **Poi la skill `zr-design-system`**: all'avvio controlla se il design system di Zeiras è cambiato, e se è
cambiato riallinei la copia derivata che sta qui dentro.

`zr-core` è il **pacchetto** (`zeiras/zr-core`, Composer) che porta a ogni frontend di Zeiras la cornice dell'app: lo
stesso ruolo di `zr-auth` per l'ingresso, ma per ciò che si vede. Niente sito, niente database, niente Redis: si
installa dentro i frontend — `zr-home` per primo (la Dashboard sta nell'`AppShell` senza `product`), poi `zr-board` e gli
altri moduli, con `product="<id>"`. Nessun frontend ricostruisce o modifica la cornice nel proprio codice. Forma e
decisioni: la spec di zr-core (il percorso è nel prompt di partenza) — si legge, non si riscrive; se una cosa non
torna, la dici a zr-pm (vedi «A chi chiedi»). Il primo lavoro è nel prompt di partenza,
`prompts/zr-core-build.md` (non versionato).

## Cosa scrive questa sessione
- **I componenti React della cornice**: `AppShell` (sidebar, menu Moduli esteso o chiuso, topbar, percorso), il
  selettore «Azienda › workspace», la ricerca (Ctrl/Cmd+K), la campanella delle notifiche, il menu del profilo, il menu
  «+». Sono una copia **derivata** dal design system: non si modificano a mano, si riallineano.
- **Il design system nella build**, una copia sola per app (quella di zr-core: il frontend non ne tiene una sua). I
  componenti sono un modulo ES generato dal `bundle.js` del design system (`resources/js/zeiras/componenti.js`, vedi «Stack
  e CI»): il bundle non si importa più. Gli ingressi sono due: quello di sempre (`resources/js`) dà `Zeiras`, il design
  system intero, e lo scrive in `window.Zeiras`, con `window.React`; quello per le app (`resources/js/app`, dalla `v1.15.0`)
  dà la cornice senza `Zeiras`, e nella build del frontend entra solo ciò che usa. Dalla `v2.0.0` le tre funzioni per le
  pagine che mostrano le notifiche hanno un ingresso loro, `resources/js/frasi`, e dalla `v3.0.0` anche la quarta,
  `destinazioneDellaNotifica`. I font arrivano da Google
  Fonts, come li carica `bundle.css`: chi installa zr-core apre la CSP a `style-src https://fonts.googleapis.com` e
  `font-src https://fonts.gstatic.com`.
- **Il registro dei prodotti**: per ogni prodotto codice, icona (un nome del set Zeiras), tono, indirizzo, «Presto»; il
  nome sta nelle traduzioni, perché si traduce (decisione 5926).
  È di zr-core, non del backoffice.
- **Le traduzioni della cornice**: due file per lingua, i testi della cornice e le frasi delle notifiche (che la cornice
  chiede con `fetch` quando si apre la campanella) — italiano, spagnolo, inglese per partire, e le lingue si devono
  poter aggiungere; se un testo manca si mostra l'inglese. Nessun testo scritto nel codice. Accanto, coi pezzi a richiesta che
  li leggono, i testi delle risorse della ricerca (`resources/lingue/ricerca/`, dalla `v3.6.0`) e quelli dei due avvisi della
  cornice ridotta (`resources/lingue/avvisi/`, dalla `v3.7.0`).
- **La parte server**: ciò che serve al frontend per dare alla cornice i dati della persona — chi è, la sua lingua, le
  sue aziende e i suoi workspace (con lo slug), i prodotti attivi nel workspace, il numero di notifiche. Si leggono
  **solo** dalle API `/v1` di `zr-backoffice`, col gettone, attraverso `zr-auth`.
- **Le intestazioni di sicurezza**: una classe sola per tutti i frontend, `Zeiras\Core\Http\IntestazioniSicurezza` — HSTS, la
  CSP di tutti, `Referrer-Policy`, `Permissions-Policy`, `nosniff`. zr-core non la registra da sé: la registra il frontend,
  prima dei middleware globali. Le sorgenti che un modulo aggiunge alla CSP stanno nel suo `config/zr-core.php`, e solo lì.
  Ogni modifica della classe o di `config/zr-core.php` passa da una revisione di sicurezza prima del tag; un cambio alle
  intestazioni comuni non esce in una versione di correzione: minore con l'annuncio se allarga, maggiore se stringe.
- **Gli host fidati**: `Zeiras\Core\Http\HostFidati` (dalla `v1.19.0`) — a una richiesta per un host che non è quello di
  `APP_URL` risponde `400`. Come le intestazioni non si registra da sé: la registra il frontend, in coda ai middleware
  globali (`append`), e quindi dopo i globali di Laravel (CORS, manutenzione), che rispondono prima di lui.

## Cosa NON fa
- **Niente dati salvati**: il pacchetto non ha tabelle. Un dato o un'operazione che manca si chiede a `zr-backoffice`,
  un metodo alla volta, con la skill `zr-start-flow`. Il backoffice è **agnostico**: manda dati di dominio, mai grafica,
  icone, nomi da mostrare o indirizzi — quelli li dicono il registro e le traduzioni di zr-core.
- **Le pagine**: quelle di un prodotto e la navigazione sotto il suo pulsante sono dell'agente del prodotto; accesso,
  Dashboard, notifiche, account, azienda e workspace come pagine sono di `zr-home`.
- **Il contenuto del design system**: lo cambia solo Luciano. Un frontend che vuole cambiare la cornice lo chiede a te;
  ciò che tocca il design system lo porti a zr-pm, che lo porta a Luciano.
- **Infrastruttura e segreti**: non li fai tu; a chi e come si chiedono lo dice il prompt di partenza.

## A chi chiedi
Le decisioni — priorità, GO, scelte di prodotto, accettazioni — non le chiedi a Luciano: le chiedi a **zr-pm**, l'agente
PM di Zeiras, con un messaggio alla sua sessione (`ListAgents`: il nome comincia con `zr-pm`), e la tua attesa si scrive
`⏸ ATTESA: zr-pm`. Le regole di business e di flusso operativo le decide Luciano, ma passano anche loro da zr-pm: è lui
che le porta a Luciano. Il design system su Claude Design lo cambia solo Luciano, ed è lui ad avvisarti quando lo cambia;
una richiesta di cambiarlo la mandi a zr-pm.

## Repo pubblico
Nessun segreto e nessun indirizzo interno — IP, nomi di server, percorsi di chiavi, canali di monitoraggio — né nel
codice, né nei test, né in questo file, che è pubblico come il resto. I fatti operativi (board, chiave, server) stanno nel
prompt di partenza e nelle skill. La CI ferma i segreti nelle forme che conosce — PHP, `.env`, chiavi (`.github/nessun-segreto.sh`) —, non in TypeScript
né in JSON: il pacchetto non ha bisogno di segreti per costruzione (riceve tutto dall'app che lo installa), e se te ne
serve uno è un segnale di progetto sbagliato. Il resto dipende da te.

## Stack e CI
- PHP 8.4 (`config.platform.php` fissato), provider Laravel 13 trovato da solo
  (`extra.laravel.providers`), Testbench 11, Pest 4, Larastan livello 5, Pint; React 19, TypeScript 7, Vite 8, vitest 5.
- CI (`.github/workflows/ci.yml`): `composer validate`, nessun segreto, lo zip del pacchetto, sintassi PHP, Pint, PHPStan,
  `npm ci` + `tsc --noEmit` (due volte: col `tsconfig.json` e con `tsconfig.stretto.json`, le nove opzioni più strette sui sorgenti
  che si installano e sulle pagine di prova) + vitest + build + pagine di prova, la favicon rigenerata e confrontata (`npm run favicon -- --controlla`), il modulo dei componenti rigenerato e confrontato (`npm run componenti -- --controlla`), le variabili dei token rigenerate e confrontate (`npm run token -- --controlla`, dalla `v3.13.0`), Pest. Nessun `composer.lock` nel repo (è una libreria).
  Rossa = non si tagga.
- `zeiras/zr-auth` `^0.12.41`: la CI fa due giri per ogni versione minore accettata, uno con l'ultima patch e uno con la più
  bassa che il vincolo accetta (la legge da `composer.json`), e il verde è di tutti i giri (dalla `v1.4.0` la minore è una:
  la cornice chiama `Sessione::aggiorna`, che c'è dalla 0.12). Una minore nuova entra in `composer.json` e nella matrice di
  `ci.yml` insieme; il vincolo non scende sotto una patch che nessun giro ha provato col codice che la usa, né sotto quella che la cornice
  chiede per stare sicura (dalla `v2.16.0` la 0.12.31: la richiesta rimandata della cornice in due dati la protegge
  `SessioneChiusa`, che c'è da quella); dalla `v2.19.0` parte dalla 0.12.41, perché il codice e i casi della cornice usano
  `SoloDallaPersona` e `Persona`, che ci sono da quella (decisioni di zr-pm).
- `favicon.ico` e `apple-touch-icon.png` (`resources/favicon/`) escono da `npm run favicon`, dalla favicon del design system
  (`resources/zeiras/logos/zeiras-favicon.svg`): non si ritoccano a mano, e a un riallineamento che cambia la favicon si
  rigenerano nello stesso commit.
- `resources/js/zeiras/componenti.js` esce da `npm run componenti`, dal bundle del design system (`resources/zeiras/bundle.js`): gli
  stessi componenti come modulo ES, esportati per nome, da cui li prendono la cornice e `Zeiras`; dalla `v3.1.0` anche
  `resources/js/zeiras/MentionField.js` e dalla `v3.2.0` `AddressField.js`, il blocco di ognuno in un modulo suo (righe private nell'elenco `A_PARTE` dello script; il blocco risale dalla funzione, non dal commento). Dalla `v3.3.0` esce di lì anche il CSS diviso da `bundle.css`: `resources/css/zeiras.css` (il bundle senza i blocchi di MentionField e AddressField) e `resources/css/zeiras/{MentionField,AddressField}.css`, che il modulo di ognuno importa (quale lo dicono le classi che usa). Non si ritocca a mano, e a un
  riallineamento che cambia il bundle si rigenera nello stesso commit; se il bundle ha un'altra forma lo script si ferma e si
  riallinea lo script.
- I pesi che il README dice (la tabella delle tre app di prova) sono quelli che misura `resources/js/peso.test.ts`, entro mezzo
  KB: un aggiornamento degli strumenti della build (Vite, il plugin di React) può spostarli, e allora il caso è rosso e i
  numeri del README si riscrivono dalla misura. Quanto costa il modulo dei componenti rispetto al bundle si prova lì con due
  build fatte nel caso, mai con un numero scritto a mano.
- Il JS d'ingresso dell'app che prende solo la cornice ha un tetto, nello stesso file: 17.213 byte con gzip (dalla `v2.11.5`:
  ciò che pesa quando i dati di esempio e i formattatori dei numeri del design system sono usciti dall'ingresso, con le
  correzioni degli sprint 50 e 52 dentro, e niente oltre: decisione di zr-pm; dalla `v2.20.0` 30 byte in più, l'impronta di
  zr-auth in `X-Zr-Persona`: eccezione di zr-pm per la sicurezza fra persone; dalla `v2.20.1` altri 7, l'impronta della cornice che chiede, stessa eccezione: nota 13713; dalla `v2.22.0` altri 49, il design system nuovo (37) e Finanze nel registro e nelle tre lingue (12): eccezione di zr-pm, 21/10; dalla `v2.25.0` altri 25, per #2151, #2210 e il collegamento dei clic della barra a `naviga` (#2033): eccezione di zr-pm, Decisione 15231; dalla `v2.25.2` altri 18, il nome del contenuto nelle tre lingue e al cambio di lingua (#2394): eccezione di zr-pm, Decisione 15823; dalla `v2.25.3` altri 16, la riga del registro che apre il contatto dal credito sotto zero: eccezione di zr-pm, Decisione 16110, e se una patch libera byte nel registro il tetto riscende; dalla `v3.0.0` 456 in meno: le righe delle destinazioni delle notifiche, con la funzione che le legge, stanno nel pezzo della campanella, Decisione 16181; dalla `v3.2.3` 17 in più: il modulo spento che non si mostra a chi non può attivarlo, #2544: eccezione di zr-pm, Decisioni 16812 e 16828; dalla `v3.6.0` 80 in più: l'invito della ricerca nomina le prenotazioni e i calendari di Bookings dove Bookings è attivo, #2549: eccezione di zr-pm, la misura vera; e altri 75: la ricerca in caricamento dal tasto, #2062, l'ora corta, #2718, e il nome del «+», #2719: Decisione 18231; e altri 25: il colore scelto del workspace, #2730, la misura + 20 per eccezione di zr-pm; e altri 25 fino a 17.700: la ricerca che non resta in caricamento quando si incolla la parola che c'era, #2062, la misura + 20, l'ultimo rialzo senza contropartita: dal prossimo byte in più zr-pm vuole prima la proposta di cosa togliere dall'ingresso, per esempio spostandolo in un pezzo a richiesta; dalla `v3.7.0` 404 in meno, 17.296, l'ingresso a 17.276 più 20: i testi dei due avvisi della cornice ridotta
  sono usciti dall'ingresso, nel pezzo a richiesta degli avvisi, zr-pm 26/10: «sotto i 17.400 togliendo peso», e il tetto è la misura più 20: il margine sta nel peso tolto, chi lo usa porta la
  sua misura; dalla `v3.8.1` 40 in più, 17.336: il pezzo degli avvisi che non è arrivato si richiede, R5 della revisione 381, sì di zr-pm 26/10; dalla `v3.9.0` 123 in meno, 17.213: i testi dei codici della ricerca nel pezzo della ricerca, la misura + 20, Decisione 18762). Fuori dall'ingresso stanno cinque pezzi a richiesta, ognuno col suo tetto: ciò che compone le righe delle notifiche e carica le
  frasi (`resources/js/campanella.ts`, tetto 1.969 dalla `v3.0.0`, 1.985 dalla `v3.2.2`: +16 per la riga che apre il preventivo, Decisione 16510; 1.988 dalla `v3.5.0`: +3, solo le impronte dei file delle frasi nel nome, codice invariato, zr-pm 25/10; 2.201 dalla `v3.6.0`: le tre righe di Bookings e la data delle notifiche, #2548, la misura vera per eccezione di zr-pm; 2.222 nella stessa: +1 di impronte col colore del workspace, #2730, più 20, zr-pm 26/10; 2.290 dalla `v3.6.1`: le destinazioni delle scadenze di una scheda, del promemoria di una To-do e dell'invito accettato (61 byte di righe, 7 per la Dashboard), la misura + 20, zr-pm 26/10; porta anche le righe delle destinazioni delle notifiche, `resources/registro/notifiche.json`; chiesto all'apertura della campanella: nessun ingresso riesporta niente da lì), la
  ricerca (`resources/js/ricerca.ts`, tetto 1.004, 1.538 dalla `v3.6.0`, 1.561 dalla `v3.8.0` per le sole impronte dei nomi, più 20, 1.708 dalla `v3.9.0`: +147, i testi dei codici dei risultati usciti dall'ingresso, la misura + 20, Decisione 18762; 1.867 dalla `v3.10.0`: +159, la zona che dice quanti risultati, #2801, la misura + 20, opzione A di zr-pm-07; le risorse di Bookings da `resources/registro/ricerca.json` e i loro testi da `resources/lingue/ricerca/`, #2549; chiesta al primo fuoco nel campo della ricerca o alla prima parola: nemmeno da lì un
  ingresso riesporta niente) e i rimedi provvisori di tastiera (`resources/js/rimedi.ts`, tetto 1.327 dalla `v2.22.1`: +99 per C1 e C2, Decisione 14804; 1.450 dalla `v2.25.0`: +123 per #2033 e #2344, zr-pm 22/10, nota 15310; 1.666 dalla `v2.25.2`: +216 per #2394, il contenuto che scorre nel giro del Tab, Decisioni 15823 e 15827; 1.768 dalla `v3.4.0`: +102 per #2627, il pannello delle notifiche senza punti di riferimento e la barra in alto sotto la ricerca, Decisione 17522; 1.870 dalla `v3.6.0`: +82 per #2720 e #2722, il pannello della ricerca nel giro del Tab e i clic sul percorso, più 20, Decisione 18266; 1.922 nella stessa: +52 per Esc dal pannello della ricerca, più 20, zr-pm 26/10; 1.979 dalla `v3.14.0`: +57 per #2341, il cassetto aperto con `role="dialog"` sotto i 1024 px (senza `aria-modal`, dopo la revisione: Decisione di zr-pm dd2f8f4), la misura del prototipo più 20, senza togliere niente: la contropartita è chi usa un lettore di schermo col tocco, che il pezzo della tastiera non raggiunge, Decisione 19069; 2.048 dalla `v3.14.2`: +69 per #2871, il `Dialog` che prende il fuoco all'apertura e lo rende alla chiusura, la misura del prototipo più 20, per eccezione: l'accessibilità vale più di 55 byte, e se una contropartita libera byte il tetto riscende, Decisione 19411) e, dalla `v3.7.0`, i testi dei due avvisi della cornice ridotta (`resources/js/avvisi.ts`, coi
  file di `resources/lingue/avvisi/`, tetto 778: la misura più 20; chiesto solo quando la cornice passa all'accettazione richiesta o a
  `non_letti`); dalla `v3.8.0` i rimedi della sola tastiera (`resources/js/tastiera.ts`, tetto 1.201, la misura più 20: Tab
  dentro un dialogo, Esc dal pannello della ricerca; 1.321 dalla `v3.8.1`: +120 per la riga 6, le voci «Presto», più 20, e 1.438 nella stessa: +117 per la riga 48, Home, Fine e il
  Tab fuori dal selettore dei workspace; 1.558 dalla `v3.10.0`: +120 per #2800 e #2807, Esc nella ricerca e nel cassetto, più 20, e 1.707 nella stessa: +149 per #2806, il cassetto che trattiene il fuoco, e 1.762: +55 per #2804, i menu della barra che si chiudono quando il fuoco esce, e 1.782: +20 per #2802, Home e Fine nel menu del profilo e nel «+», e 1.901: +119 per #2803, le linguette del pannello delle notifiche con le frecce, e 1.967: +66 per #2799, l'opzione attiva della ricerca che scorre in vista, e 1.993: +26 per i rilievi della revisione (Esc dal «+» e dal menu Moduli col cassetto aperto, il cassetto sopra 720 px, i modificatori sulle linguette, le frecce sul pannello della ricerca), e 2.000 dalla `v3.14.1`: Ctrl+K fermo sotto un dialogo o un pannello a tutta pagina, 1.999 con le forme del pezzo unificate, zr-pm 01/11; di riga in riga
  per i rimedi di tastiera, al più 2.000 B, Decisione 18611), usciti da quello dei rimedi, che lo chiede al primo tasto e gli ripete i
  tasti premuti prima (un Tab lo ferma); i byte liberati restano nel tetto dei rimedi, per i prossimi (zr-pm, 26/10). Ciò che
  non ci sta non entra nell'ingresso: il tetto non si alza.
- In locale si lanciano Pint e PHPStan (i comandi esatti sono nel prompt di partenza), `tsc --noEmit` (anche `-p tsconfig.stretto.json`), vitest e la build;
  Pest gira solo in CI.

## Come esce una versione
Un tag `vX.Y.Z` su `main` con la CI verde, e prima del tag `scripts/uat-cornice.mjs` in un Chromium vero sulle pagine di
prova costruite dal commit (`npm run demo`, `dist/demo` servito in locale), con R.0 ✅ — il campo della ricerca tiene tutti i
caratteri scritti: un difetto che vitest non vede (sprint 74, #2062; zr-pm 26/10); e, da solo, `node scripts/tipi-del-contratto.mjs`
con esito 0: un tipo di evento nuovo del contratto ha un titolo o sta nell'elenco dei tipi che non arrivano alla campanella
(dalla `v3.11.0`, #2820). Un frontend installa zr-core da questo repo pubblico (repository `vcs` nel suo
`composer.json`, nessun token) a una versione con tag, e la aggiorna col suo agente e la sua CI. Il design system cambia
→ lo vedi all'avvio → riallinei → esce una versione nuova → **lo dici tu** ai frontend che usano zr-core, con un
messaggio alla loro sessione (tag, cosa cambia, cosa devono fare) → ognuno la aggiorna. Le versioni seguono SemVer e i
frontend usano `^`: ciò che rompe chi installa (una prop dell'`AppShell` che cambia, un campo del registro che sparisce)
è una versione **maggiore**. Un tag non si sposta e non si cancella: uno sbagliato si corregge con una versione nuova.

## Progetti
Da tre task in su: `ma-dev-agent` con `ma-board`. Il progetto sulla board lo crea Luciano; alla nascita scrivi qui la
riga «Progetto sulla board» del modello di `ma-board` (FASE A), compreso «riprendi con `/ma-board-continue`», ma
**senza l'indirizzo della board**: in questo file non entra. Documenti, commit e dialogo in **italiano**.

## Progetto sulla board
→ progetto #95 «zr-core — la cornice comune» · agente `zr-core` · sprint 87 chiuso (`v3.14.0`); #2341, #2826, #2828 e
   #2549 accettate il 31/10 con la UAT nella cornice di Bookings (zr-pm 9867a7d); #2722 accettata il 31/10 con la UAT sulle
   pagine di prova (consegna 19208: in produzione nessun modulo dà il percorso alla cornice, zr-pm a12b0d0); le
   correzioni di `uat-cornice.mjs` e la pagina «Percorso» sono in main con la PR #146 (sprint 88, senza tag: il pacchetto
   non cambia); sprint 89 chiuso (`v3.14.1`): #2856, Ctrl+K fermo sotto un dialogo o un pannello a tutta pagina, accettata
   il 01/11 (zr-pm 19344); sprint 90 chiuso (`v3.14.2`): #2871, il `Dialog` prende il fuoco e lo rende, in test_umano
   (consegna 19427); il Backlog ha solo voci da Luciano: nessuno sprint finché non arriva qualcosa di nuovo (0369921).
   La storia degli sprint sta nelle note `registro` e `consegna` della board, non qui.
   Carica `ma-board` + `ma-dev-agent` e riprendi con `/ma-board-continue`. (Niente in docs/agile/ oltre ad allegati/.)
