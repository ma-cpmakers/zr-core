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
- **I componenti React della cornice**: `AppShell` (sidebar, menu Prodotti esteso o chiuso, topbar, percorso), il
  selettore «Azienda › workspace», la ricerca (Ctrl/Cmd+K), la campanella delle notifiche, il menu del profilo, il menu
  «+». Sono una copia **derivata** dal design system: non si modificano a mano, si riallineano.
- **Il design system intero nella build**, una copia sola per app (quella di zr-core: il frontend non ne tiene una sua).
  Il `bundle.js` del design system legge `window.React` e scrive `window.Zeiras` intero: due copie nella stessa app si
  sovrascrivono, e `window.React` va scritto da un modulo importato **prima** del bundle. I font arrivano da Google
  Fonts, come li carica `bundle.css`: chi installa zr-core apre la CSP a `style-src https://fonts.googleapis.com` e
  `font-src https://fonts.gstatic.com`.
- **Il registro dei prodotti**: per ogni prodotto codice, icona (un nome del set Zeiras), tono, indirizzo, «Presto»; il
  nome sta nelle traduzioni, perché si traduce (decisione 5926).
  È di zr-core, non del backoffice.
- **Le traduzioni della cornice**: un file per lingua — italiano, spagnolo, inglese per partire, e le lingue si devono
  poter aggiungere; se un testo manca si mostra l'inglese. Nessun testo scritto nel codice.
- **La parte server**: ciò che serve al frontend per dare alla cornice i dati della persona — chi è, la sua lingua, le
  sue aziende e i suoi workspace (con lo slug), i prodotti attivi nel workspace, il numero di notifiche. Si leggono
  **solo** dalle API `/v1` di `zr-backoffice`, col gettone, attraverso `zr-auth`.

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
  `npm ci` + `tsc --noEmit` + vitest + build + pagine di prova, Pest. Nessun `composer.lock` nel repo (è una libreria).
  Rossa = non si tagga.
- `zeiras/zr-auth` `^0.6.6 || ^0.7 || ^0.8 || ^0.9.1 || ^0.10 || ^0.11 || ^0.12`: la CI fa un giro per ogni versione minore accettata, con l'ultima di ognuna, e il
  verde è di tutti i giri. Una minore nuova entra in `composer.json` e nella matrice di `ci.yml` insieme; il vincolo non
  scende sotto una patch che nessun giro ha provato.
- In locale si lanciano Pint e PHPStan (i comandi esatti sono nel prompt di partenza), `tsc --noEmit`, vitest e la build;
  Pest gira solo in CI.

## Come esce una versione
Un tag `vX.Y.Z` su `main` con la CI verde. Un frontend installa zr-core da questo repo pubblico (repository `vcs` nel suo
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
→ progetto #95 «zr-core — la cornice comune» · agente `zr-core` · sprint 12 aperto.
   Carica `ma-board` + `ma-dev-agent` e riprendi con `/ma-board-continue`. (Niente in docs/agile/ oltre ad allegati/.)
