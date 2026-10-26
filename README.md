# zr-core

La cornice comune dei frontend di Zeiras: `AppShell` con il menu Moduli, il selettore «Azienda › workspace», la
ricerca, le notifiche e il menu del profilo; il registro dei prodotti (icona, tono, indirizzo, stato, le risorse che la
ricerca mostra) e i loro nomi in ogni lingua; il design system di Zeiras nella build, una copia sola per app. È ciò che `zr-auth` è per l'ingresso, ma per ciò
che si vede: i frontend `zr-*` lo installano e non ricostruiscono la cornice nel proprio codice.

Niente sito, niente database: è un pacchetto Composer (`zeiras/zr-core`) con componenti React, e si installa dentro
ogni frontend, a una versione con tag.

**Repo pubblico di proposito**: i frontend lo installano senza credenziali. Quindi qui dentro **nessun segreto, mai**, e
nessun indirizzo interno — niente `.env`, niente chiavi, niente nomi di server. La CI ferma i segreti nelle
forme che conosce (`.github/nessun-segreto.sh`, lo stesso controllo di `zr-auth`: PHP, `.env`, chiavi); il pacchetto,
per costruzione, non ne ha bisogno.

Lo scrive l'agente `zr-core`. Il design system di Zeiras è la fonte: la cornice qui dentro ne è una copia derivata, e
non si modifica a mano.

## Come si installa in un frontend

Un modulo che nasce parte da `MODULO-NUOVO.md`, la guida accanto a questo file (dalla `v1.10.1`): i passi nell'ordine in cui
si fanno, come si prova ognuno e gli errori già pagati da chi è venuto prima. Qui sotto c'è il dettaglio di ogni passo.

Da un frontend Zeiras (Laravel, React, Vite), a una versione con tag, senza credenziali:

```json
"repositories": [{ "type": "vcs", "url": "<l'indirizzo GitHub di questo repo>" }],
"require": { "zeiras/zr-core": "^1.0" }
```

**Il CSS**, in quest'ordine: prima `bundle.css` del design system, perché il suo `@import` dei font di Google dev'essere la
prima regola del CSS della pagina; poi le variabili dei token, nel tema chiaro.

```css
@import '../../vendor/zeiras/zr-core/resources/zeiras/bundle.css';
@import '../../vendor/zeiras/zr-core/resources/css/zeiras-token.css';
```

Il CSS del design system sta fuori dai layer della cascata. Con Tailwind 4, che mette le sue classi di utilità in un layer,
vince su ognuna di loro: una pagina non ritocca con una classe una proprietà che un componente già dà (il colore di un
pulsante, il bordo di un campo), perché la classe non avrebbe effetto. Vale per le proprietà che il componente dichiara e per
una classe senza il modificatore che forza (`!`); con Tailwind 3, che non usa i layer della cascata, decidono specificità e
ordine. In ogni caso un aspetto che il componente non ha non si ottiene con una classe sopra: lo si chiede all'agente di
zr-core. La cascata resta com'è, e i due `@import` restano in quest'ordine.

**`zeiras.css`** (dalla `v3.3.0`) è lo stesso CSS senza gli stili di MentionField e AddressField, che stanno in
`resources/css/zeiras/` e arrivano col modulo di ognuno, `…/resources/js/zeiras/MentionField` e `…/AddressField` (qui sotto).
È per chi prende quei due campi **solo** dai loro moduli, in pagine caricate a richiesta: il CSS del primo carico pesa circa
0,5 KB di meno con gzip (vedi «Quanto pesa il CSS»). Si importa al posto di `bundle.css`, nello stesso ordine:

```css
@import '../../vendor/zeiras/zr-core/resources/css/zeiras.css';
@import '../../vendor/zeiras/zr-core/resources/css/zeiras-token.css';
```

Chi prende MentionField o AddressField da `…/zeiras/componenti` o da `window.Zeiras` resta su `bundle.css`: con `zeiras.css`
quel campo resterebbe senza stili. Con `bundle.css` i due campi si prendono dallo stesso posto, tutti e due dai loro moduli o
tutti e due da `…/zeiras/componenti`: gli stili che un modulo porta arrivano dopo il bundle, e con MentionField dal suo modulo e
AddressField da `componenti` la lista di AddressField si allunga (da 300 a 360 px, e sotto i 720 px senza limite). Dai due moduli,
con `bundle.css`, gli stili dei campi arrivano due volte, uguali, e ciò che si vede non cambia. Chi non cambia niente resta
com'è.

**Il JS**, da uno dei due ingressi del pacchetto (due dalla `v1.15.0`). React lo porta il frontend: il pacchetto non ne ha
una copia. Dalla `v2.0.0` c'è un terzo ingresso, `…/resources/js/frasi`, solo per le tre funzioni di chi mostra le
notifiche in una pagina sua (vedi «Passare alla v2»), e dalla `v3.0.0` anche per la quarta, `destinazioneDellaNotifica`
(vedi «Passare alla v3»).

- **L'ingresso per le app**, `resources/js/app` (dalla `v1.15.0`): la cornice e ciò che le sta intorno, cioè gli stessi nomi
  dell'ingresso di sempre tranne `Zeiras`. I componenti del design system si prendono per nome dal loro modulo,
  `resources/js/zeiras/componenti`, e nella build del frontend entra solo ciò che l'app usa: i componenti della cornice, più
  quelli delle sue pagine.

  ```ts
  import { Cornice, type DatiDellaCornice } from '../../vendor/zeiras/zr-core/resources/js/app';
  import * as Zeiras from '../../vendor/zeiras/zr-core/resources/js/zeiras/componenti';
  ```

  Da questo ingresso nessuno scrive `window.Zeiras` né `window.React`.

  **MentionField ha anche un modulo suo** (dalla `v3.1.0`), `resources/js/zeiras/MentionField`, per chi lo usa solo in una
  pagina o in un dialogo che si carica a richiesta (`import()`). Il modulo dei componenti è uno solo: la cornice lo importa,
  quindi sta nel JS d'ingresso, e con lui ogni componente che una qualunque pagina ne prende, anche a richiesta. Preso dal suo
  modulo, MentionField sta nel pezzo della pagina che lo usa e il JS del primo carico non lo porta.

  ```ts
  import { MentionField, type MentionOption } from '../../vendor/zeiras/zr-core/resources/js/zeiras/MentionField';
  ```

  Da `…/resources/js/zeiras/componenti` (e da `window.Zeiras`) MentionField resta com'era. Nella stessa app si prende da un
  posto solo: le due copie hanno ognuna il suo contatore degli id dei campi, e due campi presi da posti diversi nella stessa
  pagina possono avere lo stesso id. Il modulo esce da `npm run componenti` come quello dei componenti, ed è lo stesso
  componente del design system, riga per riga; le etichette di partenza (`MENTION_LABELS`) il modulo le ha
  sue, e si cambiano con la prop `labels`.

  **AddressField ha un modulo suo allo stesso modo** (dalla `v3.2.0`, col design system che lo porta),
  `resources/js/zeiras/AddressField`, con le stesse regole: da `…/zeiras/componenti` e da `window.Zeiras` c'è anche lui, nella
  stessa app si prende da un posto solo, e le etichette di partenza (`ADDRESS_LABELS`) il modulo le ha sue.

  ```ts
  import { AddressField, type AddressPlace, type AddressSuggestion } from '../../vendor/zeiras/zr-core/resources/js/zeiras/AddressField';
  ```

  AddressField non chiama Google: i suggerimenti di Google Places li chiede il frontend dalla sua parte server, a ogni
  `onQuery`, e li passa al campo in `suggestions`. Per un modulo di Zeiras a parlare con Google è un metodo di
  zr-backoffice, non il server del modulo. Il browser non parla con Google, e la CSP della cornice non cambia. Nei
  frontend la ricerca di Google resta spenta (il campo accetta il testo libero) finché la chiave e l'informativa non
  sono approvate.

- **L'ingresso di sempre**, `resources/js`: in più dà `Zeiras`, il design system intero in un oggetto, e lo scrive anche in
  `window.Zeiras`, con `window.React`. Resta com'è, coi nomi di prima: chi non cambia niente resta sulla `^1` senza toccare
  una riga.

  ```ts
  import { Zeiras } from '../../vendor/zeiras/zr-core/resources/js';
  ```

**Il passaggio** all'ingresso per le app, in ogni file che importa da zr-core, sono due righe: `import * as Zeiras from
'…/resources/js/zeiras/componenti'` al posto di `import { Zeiras } from '…/resources/js'` (`Zeiras.Button` resta
`Zeiras.Button`), e gli altri nomi da `…/resources/js/app` al posto di `…/resources/js`. I due ingressi non si mescolano
nella stessa app: basta un file che importa ancora dall'ingresso di sempre perché nella build torni il design system
intero. Non si rompe niente (i componenti sono gli stessi oggetti, in una copia sola), ma il peso torna quello di prima. Chi
nei suoi test spia un componente della cornice sull'oggetto `Zeiras` (`vi.spyOn(Zeiras, 'AppShell')`) dalla `v1.15.0` spia il
modulo dei componenti (`import * as componenti from '…/resources/js/zeiras/componenti'`, poi `vi.spyOn(componenti,
'AppShell')`), da qualunque ingresso: è da lì che la cornice li prende. E ciò che la cornice dà all'`AppShell` come
`children` dalla `v1.15.0` è sempre un frammento, anche fuori dallo stato ridotto: la pagina è il suo secondo figlio, e un
caso che confrontava `children` con la pagina la cerca lì.

**Quanto pesa**, su tre app di prova che montano la cornice, costruite da Vite minificate e con React fuori (la CI di
zr-core le ricostruisce e le pesa a ogni giro: i numeri sono di questa versione):

| App di prova | JS | con gzip | a richiesta | con gzip |
|---|---|---|---|---|
| solo la cornice, dall'ingresso per le app | 49,7 KB | 16,9 KB | 54,9 KB | 11,2 KB |
| la cornice e due componenti per nome | 52,9 KB | 18,0 KB | 54,9 KB | 11,2 KB |
| la stessa cornice, dall'ingresso di sempre | 125,5 KB | 40,3 KB | 54,8 KB | 11,2 KB |

Le prime due colonne sono il JS d'ingresso, quello che la pagina scarica subito. «A richiesta» sono le frasi delle
notifiche, dalla `v1.20.0`: tre file `.json`, uno per lingua (circa 1 KB l'uno con gzip), che la cornice chiede con
`fetch` quando si apre la campanella; una pagina ne scarica al più due, quello della lingua della persona e quello
dell'inglese. Prima stavano nel JS d'ingresso, che per la sola cornice pesava 69,3 KB (18,8 con gzip). Il quarto è un pezzo
di JS, i rimedi provvisori di tastiera (circa 1,9 KB con gzip), che la cornice chiede quando si monta: vedi «Il fuoco nel
pannello delle notifiche», «Tab dentro un dialogo aperto» e «Menu del profilo e barra dei moduli senza errori di accessibilità», sotto. Il quinto, dalla `v2.0.0`, è un altro pezzo di JS, quello
della campanella (circa 1,3 KB con gzip; dalla `v3.0.0` circa 1,9 KB): ciò che compone le righe delle notifiche e carica le
frasi, che la cornice chiede con `import()` quando si apre la campanella, non quando si monta, e dalla `v3.0.0` anche le righe
del registro che dicono dove si apre ogni notifica, con la funzione che le legge. Il sesto, dalla `v2.8.0`, è il pezzo della ricerca
(circa 1,5 KB con gzip dalla `v3.6.0`): la richiesta, ciò che si fa della risposta e la riga di un risultato, che la cornice chiede al
primo fuoco nel campo della ricerca (vedi «La ricerca», sotto). Il settimo, dalla `v3.7.0`, è il pezzo degli avvisi
(circa 0,8 KB con gzip): i testi dei due avvisi della cornice ridotta, nelle tre lingue — chi non ha accettato i documenti
legali, e Zeiras che non risponde —, che la cornice chiede solo quando passa a uno di quei due stati. Nel JS d'ingresso di queste app c'è anche l'aiuto
con cui Vite carica i pezzi a richiesta (circa 0,7 KB con gzip): un'app che ha già pagine a richiesta lo porta comunque.
I pesi fra parentesi sono misure del 12/10/2026 (quelli dei rimedi, della campanella e della ricerca, del 13/10/2026, e quello della campanella della `v3.0.0` del 24/10/2026), e la CI non li ricontrolla: quelli che ricontrolla sono i numeri della
tabella, e i tetti. Il JS d'ingresso dell'app che prende solo la cornice ha un tetto, che la CI misura a ogni giro: 17.400 byte con
gzip. Dalla `v2.11.5` è sceso di 440 byte: i dati di esempio e i formattatori dei numeri del design system sono usciti dal JS
d'ingresso, e il tetto è ciò che pesa con le correzioni di questa versione dentro, e niente oltre. Dalla `v2.20.0` sono
30 byte in più, quelli dell'impronta di zr-auth che ogni richiesta della cornice porta in `X-Zr-Persona` (un'eccezione per la
sicurezza fra persone), e dalla `v2.20.1` altri 7, perché ogni richiesta porta l'impronta della cornice che la fa, e dalla `v2.22.0` altri 49: il design system nuovo, con
il codice dell'`AppShell` più grande (37 byte), e Finanze nel registro e nelle tre lingue (12), un'altra eccezione dichiarata di zr-pm, e dalla `v2.25.0` altri 25: la cornice riconosce «senza impronta» come il layout (4 byte), un modulo non attivo non porta più al suo 403 (14) e il pezzo dei rimedi riceve `naviga` (9), un'eccezione di zr-pm per tre voci (Decisione 15231), e dalla `v2.25.2` altri 18: il nome del contenuto della pagina nelle tre lingue, che il rimedio che lo mette nel giro del Tab riceve anche a ogni cambio di lingua (un'eccezione di zr-pm per un difetto grave di tastiera, Decisione 15823), e dalla `v2.25.3` altri 16: la riga del registro che apre il contatto dalla notifica del credito sotto zero (un'eccezione di zr-pm, Decisione 16110; se una patch libera byte nel registro, il tetto riscende). Dalla `v3.0.0` è sceso
di 456 byte: le righe del registro che dicono dove si apre ogni notifica, e la funzione che le legge, sono uscite dal JS
d'ingresso e stanno nel pezzo della campanella (Decisione 16181 di zr-pm). Dalla `v3.2.3` sono 17 byte in più: un modulo
spento non si mostra nel menu Moduli a chi non può attivarlo (un'eccezione di zr-pm, Decisioni 16812 e 16828; se una patch
libera byte, il tetto riscende). Dalla `v3.6.0` sono 80 byte in più: l'invito della ricerca nomina le prenotazioni e i
calendari di Bookings dove Bookings è attivo, coi loro nomi da elenco nelle tre lingue (un'eccezione di zr-pm: la misura
vera; le loro risorse e i loro testi stanno nel pezzo della ricerca), altri 75: la ricerca che passa al
caricamento dal primo tasto di una parola nuova, l'ora corta delle notifiche e il nome del «+» che dà il modulo (un'eccezione
di zr-pm, Decisione 18231), e altri 25: il colore che il workspace ha scelto, nel selettore (8 byte misurati, e 20 di
margine: un'eccezione di zr-pm), e altri 25: la ricerca che non resta in caricamento quando nel campo si incolla la parola
che c'era già (5 byte misurati, e 20 di margine: l'ultimo rialzo senza contropartita, zr-pm). Dalla `v3.7.0` è sceso di
300 byte: i testi dei due avvisi della cornice ridotta sono usciti dal JS d'ingresso, nel pezzo a richiesta degli avvisi,
e l'ingresso pesa 403 byte in meno (zr-pm: l'ingresso sotto i 17.400 togliendo peso, senza alzare la soglia). Hanno
un tetto anche i quattro pezzi di JS a richiesta, ognuno alla sua misura: 2.290 byte la campanella, 1.922 i rimedi, 1.538 la
ricerca e, dalla `v3.7.0`, 778 gli avvisi (la misura più 20). Quello della ricerca era di 1.004 byte, ed è salito di 534 nella `v3.6.0`: 532 per le prenotazioni e i calendari
di Bookings, coi loro testi nelle tre lingue e la data della prenotazione (un'eccezione di zr-pm: la misura vera), e 2 per
le impronte nuove dei nomi dei pezzi, col codice uguale. Quello dei rimedi è salito di 102 byte nella `v3.4.0`, per il pannello delle notifiche senza punti di riferimento e
per la barra in alto sotto la ricerca (Decisione 17522 di zr-pm), e di altri 102 nella `v3.6.0`: 82 per il pannello della ricerca
nel giro del Tab e per i clic sul percorso che passano da `naviga`, e 20 di margine (Decisione 18266 di zr-pm), poi di altri 52:
Esc col fuoco nel pannello della ricerca chiude la ricerca (zr-pm, 26/10). Quello della campanella era di 1.969 byte, ed è salito di 16 nella `v3.2.2`: la riga del registro che apre il
preventivo dalla richiesta di un cliente (un'eccezione di zr-pm, Decisione 16510), e di altri 3 nella `v3.5.0`: il codice
del pezzo è quello di prima, ma coi titoli delle schede senza assegnatario i file delle frasi hanno impronte nuove nel nome,
che il pezzo porta e che si comprimono peggio (un'eccezione di zr-pm, Decisione 17826). Nella `v3.6.0` è salito di altri
213: le tre righe di Bookings e la data delle notifiche, col giorno e l'ora o il solo giorno (un'eccezione di zr-pm: la
misura vera), e di altri 21 nella stessa: 1 per le impronte nuove dei nomi dei pezzi, col codice uguale, e 20 di margine
(zr-pm). Dalla `v2.0.0` l'eccezione per i
rimedi provvisori di tastiera è finita: ciò che compone le righe delle notifiche è uscito dal JS d'ingresso, e sta nel
pezzo della campanella.

I due componenti sono `Button` e `DataTable`. **Per misurarlo nel frontend**, prima e dopo il passaggio: `npm run build`, poi
`find public/build/assets -name '*.js' -exec gzip -9 -c {} + | wc -c` dà i byte di tutto il JS, con gzip. Che il passaggio è
completo lo dice `grep -rhoE --include='*.js' 'window\.Zeiras ?= ?Object\.assign' public/build | wc -l`: risponde 0
dall'ingresso per le app, 1 finché un file importa dall'ingresso di sempre.

**Quanto pesa il CSS** (dalla `v3.3.0`), su un'app di prova con la cornice e MentionField e AddressField presi dai loro moduli
in due pagine a richiesta, col CSS del design system e quello dei token, costruita come le tre di sopra (la CI la ricostruisce e
la pesa a ogni giro):

| App di prova | CSS | con gzip | a richiesta | con gzip |
|---|---|---|---|---|
| la cornice e i due campi a richiesta, con `bundle.css` | 68,4 KB | 11,5 KB | 3,1 KB | 1,1 KB |
| la cornice e i due campi a richiesta, con `zeiras.css` | 65,3 KB | 11,0 KB | 3,1 KB | 1,1 KB |

Le prime due colonne sono il CSS d'ingresso, quello che la pagina scarica subito; «a richiesta» sono i due file CSS che
arrivano coi due pezzi, ognuno una volta, gli stessi nelle due righe. Con `bundle.css` gli stili dei due campi stanno anche nel
CSS d'ingresso.

**I tipi**: i sorgenti del pacchetto sono TypeScript, e il frontend li compila col proprio `tsconfig`, dalla cartella del
pacchetto. Vogliono `target` ES2022 o più recente, con la sua libreria (dalla `v1.9.0`). Reggono `strict`, `noUnusedLocals` e
`noUnusedParameters` e, dalla `v1.9.0`, le nove opzioni più strette che la CI di zr-core accende a ogni giro (il suo
`tsconfig.stretto.json`, che nello zip non arriva): `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noImplicitReturns`, `noFallthroughCasesInSwitch`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`,
`verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUncheckedSideEffectImports`. Un frontend le può accendere senza fermarsi sui
file di zr-core. Con `exactOptionalPropertyTypes` ciò che il frontend dà alla cornice ed è facoltativo accetta `undefined`:
le props facoltative di `Cornice` e di `LayoutDellaCornice` (`product={undefined}`) e le chiavi facoltative dei dati della
cornice (`aziende: undefined`), anche quelle di `prodotti` e quelle dentro un'azienda. I tipi del design system
(`index.d.ts`) no: lì una chiave che non si dà si omette, e le voci di `nav`, di `crumbs` e di `create` hanno la sua forma.
La misura è con `skipLibCheck`, come nei `tsconfig` dei frontend: `index.d.ts` è una copia del design system, e zr-core non
la corregge.

**Le intestazioni di sicurezza**: una riga nel `bootstrap/app.php` del frontend registra la classe che le scrive su ogni
risposta di Laravel — più sotto, «Le intestazioni di sicurezza».

Il design system è uno solo per app, quello di zr-core: il frontend non ne tiene una copia sua.

### Passare alla v2

La `v2.0.0` cambia un import per chi installa: le tre funzioni per chi mostra le notifiche in una pagina sua —
`rigaDellaNotifica`, `titoloDellaNotifica` e `risorsaDellaNotifica` — non si importano più dai due ingressi
(`…/resources/js` e `…/resources/js/app`) ma da `…/resources/js/frasi`. Nomi e argomenti sono quelli di prima. I
risultati cambiano in due casi, come nel pannello: il nome di chi ha fatto oltre i 60 caratteri esce tagliato nel titolo
(`rigaDellaNotifica`), e un nome fatto solo di caratteri che non si vedono vale come un nome che manca (vedi «Le
notifiche»). Chi importa `…/resources/js/frasi` da una pagina che sta nel JS d'ingresso si porta lì anche il pezzo della
campanella: si importa da una pagina caricata a richiesta.

```diff
-import { rigaDellaNotifica } from '../../vendor/zeiras/zr-core/resources/js/app';
+import { rigaDellaNotifica } from '../../vendor/zeiras/zr-core/resources/js/frasi';
```

`resources/js/frasi` c'è dalla `v1.20.0`, con `rigaDellaNotifica` e `titoloDellaNotifica`: per queste due l'import si può
cambiare restando sulla v1, prima di aggiornare; `risorsaDellaNotifica` da lì si importa dalla `v2.0.0`. Un frontend che non
usa nessuna delle tre non cambia niente nel codice. Il perché: un modulo che un ingresso riesporta resta nel JS d'ingresso
di ogni app, anche di quelle che non lo usano; ora ciò che compone le righe delle notifiche è un pezzo a richiesta, che la
cornice chiede quando si apre la campanella (vedi «Quanto pesa», sopra). Nei test del frontend la riga
`beforeAll(() => frasiInMemoria())` resta com'è: dà alla cornice anche quel pezzo.

### Passare alla v2.8

La `v2.8.0` non cambia niente nel codice di chi installa: stessa `Cornice`, stessi dati, stesse rotte. Cambiano due cose
che nei test di un frontend si possono vedere. La seconda riguarda solo chi dà alla cornice dei dati senza il segno della
lettura — un `subito` composto a mano senza `sessione_il`, una `cornice` intera senza `aggiornati_il` (la parte server del
pacchetto il segno lo mette sempre): se quei dati portano un'altra persona rispetto a chi la cornice mostra, la cornice non
disegna niente e chiama `location.reload()` (vedi «La cornice in due dati»). Un caso che cambia persona con dati senza
segno trova lo schermo vuoto: ai dati del caso si dà il segno, da tutte e due le parti. La prima è quando arriva
il codice della ricerca, che dalla `v2.8.0` è un pezzo a richiesta (vedi «La ricerca», in «La cornice»). Finché il pezzo non è arrivato la richiesta a `POST /cornice/ricerca` non parte: un caso che scrive
nel campo, lascia passare i 300 ms dall'ultimo tasto e guarda subito le richieste partite non ne trova, perché la richiesta
parte poco dopo, quando l'`import()` del pezzo è finito. La riga che il file di preparazione dei test ha già per le
notifiche, `beforeAll(() => frasiInMemoria())`, dalla `v2.8.0` dà alla cornice anche il pezzo della ricerca: con quella riga
la ricerca parte allo scadere dei 300 ms, e i casi restano com'erano. Un frontend che non la ha la aggiunge (vedi «Le
notifiche»: `frasiInMemoria` sta in `vendor/zeiras/zr-core/resources/js/prove.ts`); un caso che rifà i moduli
(`vi.resetModules()`) la richiama dopo l'import, come per la campanella. In una pagina vera non c'è niente da fare, se il JS che contiene la
cornice non è servito con una coda (vedi «La ricerca»): chi
mette il fuoco nel campo trova il pezzo arrivato prima di aver scritto due lettere, e a rete lenta il primo risultato arriva
quando arrivava (vedi «La ricerca»).

### Passare alla v3

La `v3.0.0` cambia due cose per chi installa. `destinazioneDellaNotifica` non si importa più dai due ingressi
(`…/resources/js` e `…/resources/js/app`) ma da `…/resources/js/frasi`, come le altre tre funzioni per chi mostra le
notifiche in una pagina sua; nome, argomenti e indirizzi sono quelli di prima. E le voci del `registro` non hanno più il
campo `notifiche`: le righe che dicono dove si apre ogni notifica stanno in `resources/registro/notifiche.json`, che legge
solo il pezzo della campanella. Chi importa `destinazioneDellaNotifica` cambia una riga:

```diff
-import { destinazioneDellaNotifica } from '../../vendor/zeiras/zr-core/resources/js/app';
+import { destinazioneDellaNotifica } from '../../vendor/zeiras/zr-core/resources/js/frasi';
```

Chi legge `notifiche` da una voce del `registro` (nessun frontend, il 24/10/2026) usa `destinazioneDellaNotifica`, che dà
l'indirizzo; un frontend che non usa né l'una né l'altro non cambia niente. Come per le altre tre, chi importa
`…/resources/js/frasi` da una pagina che sta nel JS d'ingresso si porta lì anche il pezzo della campanella: si importa da
una pagina caricata a richiesta. Il perché: le righe delle destinazioni e la funzione che le legge erano nel JS d'ingresso
di ogni app, anche di quelle che non mostrano le notifiche in una pagina loro; ora la cornice le chiede col pezzo della
campanella, che al clic su una notifica c'è già. I tetti della `v3.0.0` (vedi «Quanto pesa», sopra, per quelli di adesso): 17.478 byte con gzip il JS
d'ingresso dell'app che prende solo la cornice, 456 meno di prima, e 1.969 il pezzo della campanella, che porta le righe.
La parte server (`GET /cornice/notifiche`, `idsDellaNotifica`) dà gli stessi `ids` di prima ai tipi che avevano già una riga;
ai due delle Scadenze, che nella `v2.25.4` non l'avevano e avevano `ids` vuoti, dà quelli del percorso che si apre
(`persona_id`, altrimenti `organizzazione_id`, altrimenti nessuno).

### Passare alla v3.3

Nessun frontend deve cambiare niente: `bundle.css` resta com'era. La `v3.3.0` aggiunge `resources/css/zeiras.css`, per chi
prende MentionField e AddressField solo dai loro moduli (`…/resources/js/zeiras/MentionField` e `…/AddressField`): il CSS del
primo carico non porta i loro stili, che arrivano col modulo, nelle pagine caricate a richiesta. Il passaggio è una riga del
CSS:

```diff
-@import '../../vendor/zeiras/zr-core/resources/zeiras/bundle.css';
+@import '../../vendor/zeiras/zr-core/resources/css/zeiras.css';
 @import '../../vendor/zeiras/zr-core/resources/css/zeiras-token.css';
```

Chi prende anche uno solo dei due campi da `…/zeiras/componenti` o da `window.Zeiras` non lo fa: con `zeiras.css` quel campo
resterebbe senza stili. Il risparmio è di circa 0,5 KB con gzip (vedi «Quanto pesa il CSS», sopra).

Una cosa cambia, con `bundle.css`, per chi prende MentionField dal suo modulo (dalla `v3.1.0`) e AddressField da
`…/zeiras/componenti` o da `window.Zeiras` (nessun frontend, il 25/10/2026): dalla `v3.3.0` il modulo di MentionField porta i
suoi stili, che arrivano dopo il bundle e allungano la lista di AddressField. Chi è in questo caso prende anche AddressField dal
suo modulo, o MentionField da `componenti` (vedi «Il CSS», sopra).

### Passare alla v3.6

Per chi viene da una versione 3 di prima, una per una: che cosa cambia per il modulo, che cosa si tocca, che cosa si
controlla. Dove non c'è niente da toccare basta l'aggiornamento (`composer update zeiras/zr-core`, poi la build).

| Versione | Che cosa cambia | Che cosa si tocca | Che cosa si controlla |
|---|---|---|---|
| `v3.2.2` | il titolo e la destinazione della richiesta di un cliente sul preventivo (`crm.preventivo.richiesta`) | niente | niente fuori dal CRM |
| `v3.2.3` | il menu Moduli non mostra i moduli spenti a chi non li può attivare (17 byte in più nell'ingresso) | niente | da membro nessun modulo spento nel menu; da proprietario o amministratore sì |
| `v3.3.0` | `resources/css/zeiras.css`, il CSS del primo carico senza gli stili di MentionField e AddressField | niente; se il modulo li prende solo dai loro moduli, una riga del CSS («Passare alla v3.3») | le pagine con i due campi hanno i loro stili |
| `v3.4.0` | la testa e il piede del pannello delle notifiche non sono punti di riferimento; a 720 px o meno le azioni della barra in alto, con le `actions` del modulo, si nascondono sotto la ricerca aperta | niente; un test del modulo che a 720 px o meno apre la ricerca e poi clicca la campanella va riletto | axe a 390 px con la ricerca aperta, senza `target-size` |
| `v3.5.0` | `Cornice::nuovoWorkspace()` nella parte server; il titolo delle schede senza assegnatario | niente; «Nuovo workspace» da una pagina del modulo, se serve («Un workspace nuovo da una pagina del modulo») | niente |
| `v3.6.0` | la ricerca trova le prenotazioni e i calendari di Bookings dove Bookings è attivo; le notifiche di Bookings coi titoli e la data; la ricerca in caricamento dal primo tasto; l'ora corta delle notifiche («10 min fa»); il nome del «+» (`createLabel`); il pannello della ricerca nel giro del Tab, con Esc; i clic sul percorso passano da `naviga`; i menu della barra in alto sopra il pannello di dettaglio («Esci» si clicca a pannello aperto); i titoli del promemoria di una To-do, delle scadenze di una scheda e dell'invito accettato; nel selettore il colore che il workspace ha scelto | `createLabel` dal layout o con `useCornice`, se il «+» ha un nome suo; **non navigate da `onCrumb`**: la visita partirebbe due volte | `scripts/uat-cornice.mjs` del tag su una pagina del modulo con il percorso e il «+» |
| `v3.6.1` | le scadenze di una scheda e il promemoria di una To-do aprono la scheda e la To-do; l'invito accettato apre Impostazioni › Membri della Dashboard | niente | un clic su quelle notifiche apre la pagina, non più la pagina delle notifiche |
| `v3.7.0` | i testi dei due avvisi della cornice ridotta (documenti da accettare, Zeiras che non risponde) in un pezzo a richiesta, fuori dal JS d'ingresso: 403 byte in meno, tetto 17.400 | niente nel codice; nei test, un caso che cerca uno dei due avvisi subito dopo il disegno lo aspetta (`await act(() => vi.dynamicImportSettled())`) | l'avviso compare con l'accettazione richiesta, e senza backoffice («Zeiras non risponde») |

Lo script UAT della cornice sta nel repo, non nello zip: si prende dal tag e si lancia su una pagina vera del modulo
(`node uat-cornice.mjs <indirizzo> --parola <testo>`, il resto nel suo commento in testa). Dice una riga per controllo: axe a
1280 e a 390 px, la ricerca (il campo che tiene tutti i caratteri scritti, il caricamento, il pannello nel giro del Tab,
Esc), il «+», la campanella, i menu della barra sopra il pannello di dettaglio, il percorso. A 1280 px batte sei parole: `--parola`, che deve trovare qualcosa nel workspace,
e parole che non trovano niente, così il caricamento si prova dopo una parola con risultati e dopo una senza, sia riscritta
da capo sia allungata di qualche lettera; una parola finita in errore (il freno del backoffice) dà ➖ e si rilancia. axe
viene dal progetto, da `AXE` o da cdnjs, e quello di cdnjs gira solo se l'impronta è quella che cdnjs dichiara.

## La parte server

I dati della cornice — chi è la persona, la sua lingua, il workspace in cui è entrata, lo stato dei prodotti in quel
workspace, le sue aziende coi loro workspace, le notifiche non lette — li dà `Zeiras\Core\Cornice::dati()`, dalla sessione
di `zr-auth` e da quattro letture del backoffice: `app.elenca` e `io.mostra` col gettone del workspace,
`io.aziende.elenca` e `io.workspace.elenca` col gettone della persona. Il gettone resta nella sessione: nei dati non c'è.

L'ordine in cui `Cornice::dati()` fa le quattro letture non è un contratto: può cambiare da una versione all'altra (dalla
`v1.2.2` la prima è `io.mostra`, per contare le non lette prima di ogni altra lettura). Un test del frontend non fissi «la
prima lettura»: guardi quali letture partono e con quale gettone, non in che ordine.

zr-core richiede `zeiras/zr-auth` `^0.12.41` (la CI lo prova con la più bassa che questo vincolo accetta e con l'ultima 0.12),
installato e configurato come dice il suo README (la sessione lato server, `ZR_API_URL`). Dalla `v1.4.0` una zr-auth più
vecchia non basta: la cornice chiama `Sessione::aggiorna`, che c'è dalla 0.12, e con una più vecchia Composer lascia zr-core
alla `v1.3.0`. Dalla `v1.6.0` serve la 0.12.4: «Segna tutte come lette» tiene il blocco della sessione coi tempi di zr-auth,
e la 0.12.4 è la patch con cui la CI ha provato quel codice; con una più vecchia della 0.12.4 Composer lascia zr-core alla
`v1.5.0`. Dalla `v2.16.0` serve la 0.12.31: è quella che protegge la richiesta rimandata della cornice in due dati
(`SessioneChiusa`, vedi «La cornice in due dati»), e con una più vecchia Composer lascia zr-core alla `v2.15.0`. Dalla
`v2.19.0` serve la 0.12.41: le rotte della cornice escono da `SoloDallaPersona`, che c'è da quella (vedi «Le rotte della
cornice»), e con una più vecchia Composer lascia zr-core alla `v2.18.0`. Composer non eredita i repository di un pacchetto: il repository `vcs` di zr-auth sta nel `composer.json` del
frontend, accanto a quello di zr-core.

Con Inertia, il frontend li condivide con ogni pagina nel `share()` del suo middleware:

```php
use Zeiras\Core\Cornice;

public function share(Request $request): array
{
    return [...parent::share($request), 'cornice' => fn () => Cornice::dati()];
}
```

| `Cornice::dati()` dà | quando |
|---|---|
| `{lingua, persona: {nome, email, impronta}, workspace: {nome, slug}, prodotti: {<codice>: attivo \| disponibile \| in_arrivo}, aziende: [{id, nome, workspace: [{id, nome, slug}], nuovo_workspace}], non_lette, aggiornati_il}` | la persona è entrata in un workspace |
| gli stessi dati, ridotti: `prodotti` `[]`, `aziende` `[]`, `non_lette` `0`, e in fondo `accettazione_richiesta: true` | dalla `v1.14.0`: la persona non ha ancora accettato i documenti legali in vigore, e a una delle letture il backoffice risponde 403 `accettazione_richiesta`. Non è un guasto, e `Cornice::dati()` non lancia (più sotto, «Chi non ha accettato i documenti legali») |
| `null`, senza chiamare il backoffice | nessuna sessione, o una sessione senza workspace (prima della scelta) |
| l'eccezione `BackofficeNonRisponde` di zr-auth | il backoffice non risponde, o (dalla `v2.17.0`) risponde con un elenco che la cornice non sa leggere — un'app, un'azienda o un workspace senza un campo testo: mai una lista di prodotti vuota, che li farebbe tutti «Presto», né aziende vuote o zero non lette |
| l'eccezione `GettoneRifiutato` di zr-auth | il backoffice non accetta più il gettone (401): zr-auth chiude la sessione e rimanda all'ingresso da sé |
| l'eccezione `ErroreApi` di zr-auth | il backoffice risponde con un altro errore (403, 404, 422, 429…): `stato` e `codice` lo dicono |

`aziende` ha l'ordine del backoffice, e ogni azienda i suoi workspace nell'ordine dell'elenco dei workspace della persona.
Ogni workspace porta il suo `id`, quello di `io.workspace.elenca`: sta nella riga che `Cornice::dati()` legge già, e non
costa una lettura in più. È dall'`id` che la cornice ricava il colore del workspace nel selettore. L'`id` c'è dalla
`v1.7.0`. Il contratto di `/v1` lo dà sempre: nei test di un frontend un backoffice finto scritto a mano lo deve dare come
dà `nome` e `slug` (il `BackofficeFinto` di zr-auth e l'esempio di `io.workspace.elenca` nel contratto lo danno), perché
una riga senza `id` fa fallire `Cornice::dati()`, se è di un'azienda dell'elenco (le altre restano fuori prima). Il
workspace in cui la persona è entrata (`workspace`) resta `{nome, slug}`: il suo `id` è quello del workspace con lo stesso
`slug` in `aziende`, se c'è. Il workspace dei dati può non stare in nessuna azienda — per esempio se il suo slug è cambiato
dopo l'ingresso —, e allora nei dati il suo `id` non c'è.
`nuovo_workspace` dice se la persona può creare un workspace in quell'azienda, e c'è dalla `v1.9.0`. È `true` se in almeno
una riga di `io.workspace.elenca` di quell'azienda il `ruolo` della persona è `proprietario` o `amministratore`; in ogni
altro caso è `false`: solo `membro`, un ruolo che zr-core non conosce, una riga senza `ruolo`, un'azienda senza workspace.
Il `ruolo` in un'azienda non vale per un'altra. Sta nella riga dei workspace che `Cornice::dati()` legge già, quindi per
saperlo non parte nessuna lettura in più, e al browser arriva solo il booleano, mai il `ruolo`.
`moduli` è l'indirizzo di Impostazioni › Moduli nel workspace dei dati (`https://app.zeiras.com/w/<slug>/impostazioni/moduli`), e
c'è dalla `v2.25.0`, solo se il ruolo della sessione è `proprietario` o `amministratore`, come `puoAmministrare()` di zr-home; per
ogni altro ruolo la chiave manca, e non c'è nei dati ridotti. La cornice lo usa per i moduli `disponibile` del menu Moduli, che
senza la chiave non mostra. Il ruolo
è quello della sessione: per saperlo non parte nessuna lettura in più, e al browser arriva l'indirizzo, mai il `ruolo`. La pagina è
di zr-home: se la persona può davvero attivare un modulo lo decide il backoffice.
`non_lette` sono le notifiche non lette della persona nel workspace in cui è entrata, come le conta il backoffice
(`notifiche_non_lette` di `io.mostra`): il numero intero, e oltre 99 la campanella mostra «99+».

`aggiornati_il` è il segno della lettura: l'istante in cui la parte server ha cominciato a leggere i dati, in UTC coi
microsecondi (`2026-10-09T21:31:05.123456Z`). I dati di due letture non sono mai uguali, nemmeno quando niente è cambiato,
e la cornice sa quali sono stati letti dopo: tiene i più recenti che ha visto (vedi «La campanella», più sotto). I dati si
danno alla cornice così come arrivano, a ogni richiesta: un frontend che togliesse il segno, o che tenesse i dati da una
richiesta all'altra, ridarebbe alla cornice dati uguali a quelli di prima. Dati con lo stesso segno di quelli che la
cornice ha valgono come li dà la pagina: un frontend che li ritocca nel browser lasciando il segno (una notifica letta
dalla pagina, e il numero che scende) vede il cambio. Il segno viene dall'orologio del server che risponde: se i server
del frontend sono più di uno devono avere l'ora allineata (NTP), o i dati letti da un server che va indietro passano per
più vecchi.

**Chi non ha accettato i documenti legali** (dalla `v1.14.0`). Finché la persona non accetta i documenti legali in vigore
il backoffice le apre solo `io.mostra`, i documenti, l'accettazione e l'uscita, e a ogni altra lettura risponde 403
`accettazione_richiesta`. Per la cornice non è un guasto: `Cornice::dati()` non lancia e dà i dati ridotti — lingua,
persona e workspace della sessione, `prodotti` e `aziende` vuoti, `non_lette` 0, il segno — con in più
`accettazione_richiesta: true`. La chiave c'è solo lì, mai a `false`: i dati di chi ha accettato sono quelli di sempre.
Lì `prodotti` è una lista vuota, e al browser arriva `[]` e non `{}`: un frontend che valida la forma dei dati la ammette.
Il tipo `DatiDellaCornice` la ammette dalla `v1.15.0`, senza conversioni.
Dopo quel 403 `Cornice::dati()` non chiama più il backoffice. Il frontend dà i dati alla cornice così come sono, e la
pagina esce con la cornice ridotta (vedi «La cornice», al punto «Chi non ha accettato i documenti legali»). Con quella
chiave `prodotti` vuoto non vuol dire «Presto»: vuol dire che il backoffice non li ha dati, e un frontend che legge i
dati da sé (le schede dei moduli nella Dashboard) guarda `accettazione_richiesta` prima di `prodotti`. Quel 403 si
riconosce dallo stato e dal codice insieme: un 403 con un altro codice resta l'`ErroreApi` che era. Quali documenti
mancano la parte server non lo dà al browser: lo sa la pagina dell'accettazione, che è di zr-home. Le chiamate del
frontend a `/v1` ricevono lo stesso 403, e lì la cornice non c'entra. Da zr-auth `v0.12.17` quel 403 è l'eccezione
`Zeiras\Auth\Errori\AccettazioneRichiesta`, che se nessuno la cattura risponde da sé, in quattro forme
(lette fino alla `v0.12.20`): a una visita un rimando
alla pagina dell'accettazione (302), a una visita di Inertia un 409 con `X-Inertia-Location`, e a una richiesta JSON un
403 con `codice` e `mancanti`, senza rimando — lì la persona resta dov'è, e che cosa mostrarle lo decide il frontend. Per
le visite il frontend non scrive un rimando suo. La quarta forma è della pagina dell'accettazione stessa (l'host e il
percorso di `zr-auth.accettazione`, con o senza la lingua davanti): lì risponde quel 403 anche a una visita e a una visita
di Inertia, perché un rimando la manderebbe a sé stessa.

Il workspace è quello del gettone (`Sessione::workspace()` di zr-auth), non quello dell'indirizzo della pagina. Persona,
lingua e workspace sono quelli della sessione di zr-auth. La lingua e il nome la cornice li tiene aggiornati: a ogni
lettura `Cornice::dati()` dà a `Sessione::aggiorna` di zr-auth la risposta di `io.mostra` che ha già letto per le non
lette, e `Sessione::aggiorna` mette nella sessione la lingua e il nome del profilo, se sono cambiati e se li prende: quali
prende lo decide zr-auth (per la lingua vedi «Quale lingua c'è nella sessione», più sotto). Dalla `v2.11.4` la lingua di una
lettura più vecchia di quella che l'ha confermata non le arriva (vedi `lingua_il`, più sotto). Workspace, ruolo e gettoni
restano quelli dell'ingresso. L'email dipende dalla zr-auth installata: fino alla 0.12.62 resta quella dell'ingresso, e
dalla 0.12.63 segue io.mostra: `Sessione::aggiorna` la mette nella sessione se è cambiata — il cambio dell'email di
zr-home —, e i dati della cornice la portano da quella stessa lettura. Una scheda rimasta
aperta con l'email di prima ha la stessa impronta della persona: dalla `v2.23.0` la sua richiesta della cornice passa come
quella di una scheda con l'email nuova, i dati sono quelli della sessione e `persona` nella risposta è l'email che la pagina
ha detto, così la scheda non si ricarica (fino alla `v2.22` riceveva il 409 `persona_diversa` e si ricaricava come per
un'altra persona). I dati della cornice portano la lingua e il nome della sessione
dopo `Sessione::aggiorna`, da quella stessa richiesta; ciò che il frontend ha letto dalla sessione prima di chiamare
`Cornice::dati()` — di solito la lingua della pagina, in un middleware — in quella richiesta è ancora quello di prima, e
dalla richiesta dopo è nuovo.

Per avere la pagina nella lingua nuova già da quella richiesta c'è `Cornice::lingua()` (dalla `v1.8.0`): una riga nel
middleware che mette la lingua, prima del controller, al posto della lingua letta dalla sessione.

```php
App::setLocale(Cornice::lingua() ?? config('app.locale'));
```

Dà la lingua della sessione dopo che `Sessione::aggiorna` ha visto il profilo: legge `io.mostra`, lo dà a
`Sessione::aggiorna` e risponde con la lingua della sessione. Senza una sessione dà `null`; con la sessione ma senza un
workspace dà la lingua della sessione, senza chiamare il backoffice. È la lingua della sessione, se ha la forma di una
lingua (due o tre lettere, poi parti di lettere e cifre unite da `-` o `_`: `it`, `pt-BR`); se no dà `null`, e a
`App::setLocale` non arriva mai un valore che Laravel rifiuta. Una lingua della sessione ben fatta che il modulo non ha
passa com'è: per i testi dei file a gruppi (`lang/<lingua>/…`) Laravel ripiega sul suo `fallback_locale`, per quelli JSON
(`lang/<lingua>.json`) dà la chiave com'è; se il modulo vuole
altro lo decide lui. Costa una lettura, `io.mostra`, nelle richieste in cui la chiami e la cornice
non c'è; dove c'è non ne costa una in più: nella stessa richiesta `Cornice::dati()` usa la lettura di `Cornice::lingua()`
invece di rifarla, e `Cornice::lingua()` quella di `Cornice::dati()` se viene dopo, e le letture restano quattro. Le non
lette e il segno dei dati sono allora quelli della lettura di `Cornice::lingua()`: ciò che il controller cambia dopo — una
notifica segnata come letta in quella richiesta — arriva alla campanella con la lettura dopo (dalla `v2.15.0`, con la cornice
rimandata, la lettura dopo può essere quella stessa: vedi «La cornice in due dati»). Vale anche per il nome, e
per la lingua se è una di quelle che `Sessione::aggiorna` prende (fino alla 0.12.11 di zr-auth ogni testo che non sia
vuoto o di soli spazi, dalla 0.12.12 solo una lingua di Zeiras: vedi «Quale lingua c'è nella sessione», più sotto): se il
controller li cambia nel profilo in quella richiesta, i dati li portano dalla richiesta dopo — subito solo se il
controller dà a `Sessione::aggiorna` i dati della persona nella forma di `io.mostra` (l'`utente` col suo `id`, la
`lingua` e il `nome`): con un'altra forma `Sessione::aggiorna` non cambia niente. Una lingua che `Sessione::aggiorna`
non prende i dati non la portano né subito né dopo: tengono quella che la sessione aveva. Se il backoffice non risponde
`Cornice::lingua()` non lancia: dà la lingua della sessione, lascia nel log una riga d'avviso col tipo dell'errore, mai il
suo messaggio, e l'errore (`BackofficeNonRisponde`, `ErroreApi`) lo lancia la prima `Cornice::dati()` di quella richiesta,
se la chiami, senza chiamare `io.mostra` un'altra volta (una seconda rilegge). `GettoneRifiutato` invece passa anche da
`Cornice::lingua()`: la sessione è finita, e il frontend lo tratta come per ogni altra chiamata.

Se a quella lettura il backoffice ha risposto 429, il modulo lo sa da `Cornice::frenata()` (dalla `v1.18.0`): dà
l'`ErroreApi` di quella lettura, coi secondi di `Retry-After` in `riprovaFra` (`null` se il backoffice non li dice), e
`null` in ogni altro caso — senza una lettura in quella richiesta, dopo una lettura andata bene, dopo un altro errore.
`Cornice::frenata()` non legge niente: guarda la lettura di `io.mostra` che `Cornice::lingua()` o `Cornice::dati()` hanno
già fatto, e solo quella. Un 429 che `Cornice::dati()` prende da una delle altre sue tre letture (`/v1/app`,
`/v1/io/aziende`, `/v1/io/workspace`) lo dà l'`ErroreApi` che `dati()` lancia, e `Cornice::frenata()` resta `null`. Il
freno è lo stato, 429, con qualunque codice. Serve al modulo che dopo la riga chiamerebbe ancora `/v1`: dopo un 429 non
si richiama, e il middleware risponde col suo 429 prima che parta un'altra chiamata.

```php
App::setLocale(Cornice::lingua() ?? config('app.locale'));

$freno = Cornice::frenata();

if ($freno !== null) {
    return response('', 429, $freno->riprovaFra === null ? [] : ['Retry-After' => (string) $freno->riprovaFra]);
}

return $next($request);
```

Il freno vale per quella richiesta: la richiesta dopo non lo trova, finché una sua lettura non prende un altro 429.
`Cornice::lingua()` e `Cornice::dati()` fanno ciò che facevano: la prima non lancia, la seconda lancia quell'`ErroreApi`.

Quale lingua c'è nella sessione lo decide zr-auth, in due momenti. All'ingresso `Sessione::apri` e `Sessione::entra` mettono
nella sessione la persona come la dà il backoffice, con la lingua del profilo com'è: vale dalla 0.12.4 alla 0.12.12. Dopo, a
ogni lettura, `Sessione::aggiorna` cambia la lingua della sessione solo con una lingua del profilo che prende: fino alla
0.12.11 ogni testo che non sia vuoto o di soli spazi, com'è; dalla 0.12.12 solo una lingua di Zeiras (`it`, `en`, `es`:
l'elenco `Sessione::LINGUE` di zr-auth), col confronto esatto — `IT` e `it-IT` non sono `it` —, e con un'altra, anche ben
fatta, la sessione tiene la lingua che aveva. Se il profilo non ne porta una (`null`, un testo vuoto o di soli spazi) la
sessione tiene la sua con tutte e due le versioni. Con una sessione, quindi, `Cornice::lingua()` dà `null` quando la lingua
che la sessione ha dopo la lettura non ha la forma di una lingua: fino alla 0.12.11 anche per una malfatta appena arrivata
dal profilo, dalla 0.12.12 solo per una malfatta che la sessione aveva già dall'ingresso. E per una lingua del profilo ben
fatta che non è di Zeiras (`pt-BR`) fino alla 0.12.11 dà quella, dalla 0.12.12 la lingua che la sessione aveva, se ha la
forma di una lingua. Fino alla `v2.15` zr-core accettava tutte e due le versioni; dalla `v2.16.0` chiede la 0.12.31, e
vale la seconda: un test del modulo su una lingua che non è di Zeiras non ha più da guardare quale zr-auth è installata. Dalla `v2.11.4` la cornice non dà a `Sessione::aggiorna` la lingua di una lettura più vecchia
di quella che l'ha confermata: vedi `lingua_il`, più sotto.

La riga va dove si mette la lingua di una pagina, non su ogni richiesta: su una richiesta che non mostra una pagina — le
rotte della cornice (`/cornice/…`), le rotte JSON del modulo — basta la lingua della sessione, e la riga costerebbe una
lettura del backoffice in più a ogni richiesta (una ricerca ne farebbe due), prima del controller e fino al tempo d'attesa
di zr-auth; su una rotta che tiene il blocco della sessione quel tempo passerebbe a blocco preso. Un middleware del gruppo
`web` passa anche dalle rotte della cornice: quali richieste mostrano una pagina lo sa il modulo. E la lettura della riga
parte prima che la lingua della pagina sia messa: il `dettaglio` di un errore del backoffice che `Cornice::dati()` poi
rilancia è nella lingua che l'app aveva in quel momento, di solito la predefinita.

Chi resta col suo codice non cambia niente: chiamare `Cornice::dati()` prima di leggere la lingua, o rileggere
`Sessione::utente()` dopo, funziona come prima. Chi la chiama prima ne tiene il risultato e dà quello a `share()`, senza
chiamarla un'altra volta: `Cornice::dati()` rilegge tutto a ogni chiamata — due chiamate nella stessa richiesta sono otto
letture invece di quattro, con due segni — e in un middleware parte a ogni richiesta che ci passa, anche senza una pagina
da mostrare. E la forma della lingua la guarda solo `Cornice::lingua()`: `Sessione::utente()['lingua']` e
`Cornice::dati()['lingua']` sono la lingua della sessione com'è, anche malfatta. Chi resta col suo codice e la dà a
`App::setLocale`, all'attributo `lang` della pagina o al nome di un file ne guarda prima la forma.

Con la funzione nel `share()`, `BackofficeNonRisponde` ed `ErroreApi` fermano ogni risposta Inertia, anche quella di una
pagina senza cornice: come mostrarle lo decide il frontend, nel suo gestore delle eccezioni (`withExceptions` in
`bootstrap/app.php`); senza, sono un 500.

### Un workspace nuovo da una pagina del modulo

Una pagina di un modulo che deve mandare la persona a creare un workspace — per esempio quando un'installazione non si può
fare nel workspace in cui è — prende l'indirizzo da `Cornice::nuovoWorkspace()` (dalla `v3.5.0`), e non scrive il percorso
di zr-home nel suo codice. Dà `https://app.zeiras.com/w/<slug>/nuovo-workspace`, con lo slug del workspace della sessione
codificato per un indirizzo, ed è la pagina che apre «Nuovo workspace» in fondo al selettore: la Dashboard di quel workspace
col dialogo aperto. La pagina e il dialogo sono di zr-home, e se la persona può davvero creare il workspace lo decide il
backoffice (`io.workspace.crea`): zr-core dà soltanto la strada.

```php
$nuovo = Cornice::nuovoWorkspace();   // null: la pagina spiega, senza il pulsante
```

La regola è quella del selettore, `nuovo_workspace`: l'indirizzo c'è se la persona è `proprietario` o `amministratore` in
almeno un workspace dell'azienda del workspace della sessione. Il ruolo della sessione non conta, e quello di un'altra
azienda nemmeno. L'azienda non si confronta con `/v1/io/aziende`, come fa la pagina di zr-home: se quell'elenco non la
ha, il selettore non c'è e la cornice non mostra il pulsante, ma la pagina del modulo può avere l'indirizzo. In ogni altro
caso dà `null` — solo `membro`, un ruolo che zr-core non conosce, il workspace della sessione
che l'elenco non ha —, e allora la pagina spiega e non offre la strada. Senza sessione, o senza workspace, dà `null` senza
chiamare il backoffice. Altrimenti legge `/v1/io/workspace` col gettone della persona, tutte le pagine, a ogni chiamata, e
nient'altro: va chiamata nella pagina che la usa, non in un middleware. Un errore del backoffice non diventa `null`, che
direbbe «non puoi» a chi può: `BackofficeNonRisponde`, `ErroreApi` e `GettoneRifiutato` arrivano al modulo come da ogni
chiamata di zr-auth, e una riga senza `slug` o `azienda_id` testuali è `BackofficeNonRisponde`. Anche il 403
`accettazione_richiesta` arriva com'è, e da zr-auth risponde da sé: `Cornice::dati()` lo prende e dà i dati ridotti, questo
metodo no.

### Le rotte della cornice

zr-core registra da sé, nel gruppo `web` del frontend (sessione, guardia di zr-auth, CSRF), le sue rotte per il browser,
sulla stessa origine: quelle che la cornice chiama. Fra queste, dalla `v1.12.0`, c'è di nuovo la lettura di una notifica
sola: dalla `v1.1.0` alla `v1.11.0` la cornice non la chiamava, e restava per i frontend che la usano. La parte server le gira al backoffice col gettone del workspace, che non
esce.

| Rotta | Risponde |
|---|---|
| `GET /cornice/notifiche` | `{data: [{id, creata_il, letta, app, tipo, autore_nome, risorsa_nome, per_me, azioni, board_nome, quando, ids}], aggiornati_il, workspace, persona}`: le notifiche della persona nel workspace dalla più recente, una pagina; dalla `v3.6.0` `quando` dice quando accade la cosa che la notifica racconta — `{il, fuso}`, l'istante in UTC con la Z e il nome IANA del fuso in cui si legge — ed è `null` per le notifiche che non hanno una data e per ogni forma che non è quella; dalla `v1.22.0` `creata_il` è l'istante dell'ultima azione che la notifica racconta — il backoffice ne accorpa più d'una in una notifica sola, e l'istante dell'ultima lo dice in `ultima_azione_il`; se non lo manda, è l'istante in cui la notifica è nata, come prima —: è l'ora che il pannello mostra, e su quella il backoffice ordina l'elenco; `ultima_azione_il` del backoffice non arriva in pagina; dalla `v2.1.0` `azioni` è quante azioni la notifica racconta (un intero da 1 in su) e `board_nome` il nome della board in cui sta la cosa, o `null`: sono `azioni` e `board.nome` del backoffice; un backoffice che non li manda è quello di prima, e valgono 1 e `null`; di `board` passa solo il nome, mai l'id; un `azioni` che non è un intero da 1 in su, o un `board` che non è `null` né un oggetto col `nome`, è un errore (5xx), qui e in `PATCH /cornice/notifiche/{id}/lettura`, mai una chiave tolta in silenzio; `app` è il codice dell'app da cui viene la notifica (`pm`, `crm`…) o `null`, com'è nel backoffice; `tipo` è il tipo dell'evento che l'ha generata (`com.zeiras.board.cartella.creata`…), com'è nel backoffice: la parte server non lo traduce e non lo confronta con un elenco, e ne può arrivare uno nuovo — il titolo glielo dà la cornice, nel browser (vedi «Le notifiche»); una notifica che il backoffice dà senza `tipo`, o con un `tipo` che non è una stringa, è un errore (5xx), qui e in `PATCH /cornice/notifiche/{id}/lettura`; dalla `v1.10.0` `autore_nome` è il nome di chi ha fatto ciò che la notifica racconta, `risorsa_nome` quello della cosa a cui si riferisce (per una notifica su un'app è il codice dell'app, com'è nel backoffice: il nome da mostrare lo dà `risorsaDellaNotifica`), e `per_me` dice se è rivolta alla persona (`true`), a tutto il workspace (`false`) o se il backoffice non lo sa (`null`, che non è `false`): sono `autore.nome`, `risorsa_nome` e `per_me` del backoffice, e ognuna è `null` quando il backoffice dà `null` o non manda la chiave; di `autore` passa solo il nome; una delle tre con una forma che il contratto non ammette (un `autore` senza `nome`, un numero al posto di un testo, un `per_me` che non è un booleano) è un errore (5xx), qui e in `PATCH /cornice/notifiche/{id}/lettura`, mai una chiave tolta in silenzio; dalla `v1.11.0` `ids` sono gli id che servono ad aprire la risorsa della notifica, per chiave (`{"id": "…"}` per un contatto, `{"persona_id": "…"}` per una nota legata al solo contatto): di `dati` del backoffice passano i soli id del percorso che la notifica apre — quello che il registro dà al suo tipo, fra le righe della sua app (`{id}`, `{persona_id}`) —, e solo con un valore che ha la forma di un id (un testo di lettere, cifre, `-` e `_`, da 1 a 64): gli altri id, il resto di `dati` e `soggetto` non arrivano al browser; dalla `v1.13.0` un tipo può avere più percorsi, e gli `ids` sono quelli del primo che `dati` soddisfa per intero (per una nota di un'opportunità `{"trattativa_id": "…"}`, per una legata alla sola azienda `{"organizzazione_id": "…"}`: la regola è `idsDellaNotifica`, più sotto); una notifica di un tipo che nel registro non ha una destinazione, senza `dati`, o con un `dati` che non è un oggetto, ha `ids` vuoto (`{}`) e non è un errore, e dalla `v1.13.0` lo ha vuoto anche una il cui percorso non chiede un id (un'attività, che apre «Da fare»): se una notifica ha una destinazione lo dice `destinazioneDellaNotifica`, non `ids`; `aggiornati_il` è l'istante in cui la parte server ha cominciato a leggere l'elenco, prima di chiamare il backoffice, in UTC e nella forma del segno dei dati della cornice (`2026-10-09T21:31:05.123456Z`): l'elenco è almeno fresco quanto quell'istante; dalla `v1.12.0` `workspace` è lo slug del workspace della sessione, quello col cui gettone l'elenco è stato letto: lo dice la parte server, e non segue niente di ciò che manda il browser (la pagina che chiede può essere rimasta su un altro workspace); dalla `v2.4.0` `persona` è l'email della persona della sessione, quella di cui sono le notifiche, presa allo stesso modo: in una scheda rimasta ferma la cornice sa così che l'elenco non è di chi mostra, non lo mostra e ricarica la pagina |
| `PATCH /cornice/notifiche/{id}/lettura` con `{letta}` | `{data: {id, letta}, segnata_il}`: segna letta (`true`) o non letta (`false`) quella notifica, e `letta` è ciò che il backoffice ha segnato; dalla `v1.12.0` `segnata_il` è l'istante preso dopo la risposta del backoffice, nella forma di `aggiornati_il`: la cornice lo confronta con l'istante dell'elenco — un elenco letto fin lì può dare la notifica ancora da leggere —, e una risposta che non è un 200 non lo porta; senza `letta`, o se non è un booleano, 422 `{errore: "dati_non_validi"}`; una notifica che non c'è, o di un'altra persona, 404 `{errore: "non_trovato"}`; un `id` che non è fatto di lettere, cifre, `-` e `_` (64 al più) non ha rotta: 404 |
| `POST /cornice/notifiche/letture` con `{fino_a, workspace, persona}` | `{data: {fino_a, altre}, segnate_il}`: segna lette le notifiche della persona nel workspace nate fino a `fino_a` compreso, anche quelle oltre la prima pagina; dalla `v1.22.0` la cornice manda in `fino_a` l'istante dell'ultima azione più recente fra le notifiche caricate: il backoffice segna quelle nate fino a lì, cioè tutte le caricate — ognuna è nata prima della sua ultima azione — e nessuna nata dopo il caricamento; `fino_a` è un istante con data, ora coi secondi (sei decimali al più) e fuso (`2026-10-08T10:00:00.000Z`, o `+02:00` al posto di `Z`), com'è la `creata_il` di una notifica, e quello della risposta è l'istante del backoffice, in UTC; il backoffice ne segna al più 5000 per chiamata e dice se ne restano: la parte server lo richiama con lo stesso `fino_a` finché ne restano, entro due tetti — al più 5 chiamate al backoffice per richiesta (25.000 notifiche), e nessuna chiamata nuova passati 10 secondi dall'arrivo della richiesta; `altre` è `false` quando il backoffice ha detto che non ne restano, e `true` quando un tetto ha fermato i richiami e ne restano ancora: non è un errore, e la stessa richiesta, ripetuta, continua da lì; `segnate_il` è l'istante preso dopo l'ultima risposta del backoffice, sull'orologio della parte server e nella forma di `aggiornati_il`: ciò che è stato letto prima di quell'istante può non sapere di questa lettura; `workspace` è lo slug del workspace della pagina che chiede (quello dei dati della cornice): se non è quello della sessione — da un'altra scheda la persona è entrata in un altro workspace — 409 `{errore: "workspace_diverso"}`, e non si segna niente; `persona` è l'email di chi quella pagina mostra (dalla `v2.5.0`; così la manda la cornice fino alla `v2.5.1`, e dalla `v2.6.0` la dice nell'intestazione `Persona`, come nelle altre tre richieste): se non è quella della sessione — la sessione è passata a un'altra persona, con la pagina rimasta ferma — 409 `{errore: "persona_diversa", persona: ""}`, senza chiamare il backoffice, e non si segna niente (fino alla `v2.11` `persona` era l'email della sessione); senza la chiave `persona` conta l'intestazione `Persona`, e senza né l'una né l'altra, dalla `v2.13.0`, 422 `{errore: "persona_mancante", persona: ""}`, senza chiamare il backoffice, e non si segna niente (fino alla `v2.12` valeva come prima); dalla `v2.5.1` una `persona` che c'è e non è un testo — un numero, un booleano, una lista, un oggetto, anche `null` — non vale come assente: 422 `{errore: "dati_non_validi"}`, senza chiamare il backoffice, e non si segna niente; dalla `v2.6.0` la persona si guarda prima del workspace e degli altri controlli della rotta, come sulle altre tre (sotto la tabella); senza `fino_a` o senza `workspace`, o se `fino_a` non ha quella forma, o se quell'istante non esiste, 422 `{errore: "dati_non_validi"}`; se il backoffice non risponde in tempo, risponde un errore, o risponde senza `altre` o con un `altre` che non è un booleano, alla prima chiamata o a un richiamo, è un errore (5xx) senza `segnate_il`, anche se può averne segnate: ripetere la stessa richiesta non cambia ciò che è già segnato; la rotta tiene il blocco della sessione per tutta la sua durata, e se un'altra richiesta della stessa sessione lo tiene per più di 3 secondi risponde 503 con `Retry-After: 1`, senza chiamare il backoffice; arrivata alla rotta passati 10 secondi dall'arrivo della richiesta risponde 503 `{errore: "fuori_tempo"}` con `Retry-After: 1`, anche lei senza chiamare il backoffice; il blocco dura 20 secondi da quando è preso, coi tempi di partenza, e una richiesta che i middleware del frontend tengono più a lungo prima della rotta ci arriva a blocco scaduto (vedi «Le notifiche») |
| `POST /cornice/ricerca` con `{q}` | `{data: [{tipo, id, titolo, contesto}], workspace, persona}`: ciò che il backoffice trova nel workspace cercando `q`, coi tipi e nell'ordine del backoffice, la prima pagina (oggi, col loro `tipo`: le schede `board.scheda`, i contatti `crm.persona`, le aziende `crm.organizzazione`, le opportunità `crm.trattativa` e i membri del workspace `workspace.membro`, poi le board `board.board` e le aree `board.cartelle` per titolo; la fonte di un modulo c'è solo se il suo prodotto è attivo nel workspace, i membri ci sono in ogni workspace, e la cornice li mostra dalla `v1.17.0`); dalla `v1.15.0` ogni risultato porta `contesto`: `null`, oppure un oggetto coi testi che aiutano a riconoscerlo: di ciò che il backoffice dà passano le sole chiavi che il registro dice per il tipo del risultato (`board` e `lista` di una scheda, `organizzazione` e `ruolo` di un contatto, `pipeline` e `fase` di un'opportunità), coi soli valori di testo non vuoti; una chiave che il registro non dice per quel tipo resta nella parte server; dalla `v1.17.0` di un membro del workspace passa il solo `ruolo`, che è un codice (`proprietario`, `amministratore`, `membro`): l'email di un membro non esce mai; dalla `v1.18.0` di un'opportunità passa anche `esito` (`aperta`, `vinta` o `persa`), com'è arrivato: quali esiti si mostrano lo sa la cornice; dalla `v1.12.0` `workspace` è lo slug del workspace della sessione, quello col cui gettone la ricerca è fatta: lo dice la parte server, e non segue niente di ciò che manda il browser (la pagina che cerca può essere rimasta su un altro workspace); è lì che la cornice apre un risultato, e una risposta senza `workspace` per lei è un errore della ricerca; `q` è la parola cercata e si legge solo dal corpo JSON, mai dall'indirizzo: da 2 a 100 caratteri senza gli spazi ai bordi (la cornice manda i primi 100), altrimenti 422 `{errore: "dati_non_validi"}`, e così se non è un testo o sta solo nell'indirizzo; fino alla `v1.7.0` la ricerca era una GET con la parola nell'indirizzo: dalla `v1.8.0` una GET a `/cornice/ricerca` non ha una rotta e non arriva al backoffice — risponde 405, o ciò che il frontend risponde a un indirizzo senza rotta se ha una rotta di ripiego (`Route::fallback`) —, e un test del frontend che la chiama passa alla POST; una scheda aperta prima dell'aggiornamento cerca ancora con la GET finché non si ricarica: riceve quella risposta e mostra l'errore della ricerca; dalla `v1.15.0` anche dal server del modulo al backoffice la parola viaggia nel corpo: la parte server chiama `ricerca.crea` (`POST /v1/ricerca` con `{q}`), e l'indirizzo di quella richiesta non porta query; se il backoffice frena le ricerche della persona (`429` `troppe_richieste`) la rotta risponde `429` `{errore: "troppe_richieste", persona}` (`persona`, dalla `v2.5.0`: l'email della persona della sessione, di chi è il freno) con `Retry-After`, i secondi che il backoffice ha detto, e la cornice mostra l'errore della ricerca; dalla `v1.16.0` per quei secondi, al più 60, non manda altre ricerche, qualunque cosa la persona scriva, e allo scadere non riprova da sola: parte la prima parola che la persona scrive dopo; il freno vale finché la cornice resta montata: un caricamento di pagina la rifà, e così un cambio di workspace con `LayoutDellaCornice`, e da lì la prima parola parte anche dentro quei secondi; dalla `v2.4.0` `persona` è l'email della persona della sessione, quella per cui la ricerca è fatta: viene dalla sessione, e la cornice non mostra i risultati di un'altra persona |

Senza sessione rispondono 401; con la sessione ma senza workspace 403 `{errore: "gettone_senza_workspace"}`, che dalla
`v2.12.0` arriva solo alla persona della sessione (dalla `v2.13.0` una richiesta che non dice la persona riceve prima il 422
`persona_mancante`), e non dice di chi è: a una pagina di un'altra persona risponde prima il 409 `persona_diversa` (sotto la
tabella). Nella `v2.10` e nella `v2.11` il 403
portava `persona`, l'email della sessione. Un backoffice
che non risponde è un errore (5xx), mai un elenco vuoto. Il prefisso `cornice/` è di zr-core: il frontend non lo usa per le
sue rotte, e nel suo test delle rotte (`Rotte::senzaGuardia()` di zr-auth) quelle di zr-core non escono, perché hanno la
guardia.

Dalla `v2.6.0` le quattro rotte hanno una regola sola sulla persona, prima di ogni controllo loro. La richiesta può dire di
chi è la pagina che chiede — nell'intestazione `Persona`, l'email passata da `encodeURIComponent`, o in `persona` nel corpo
JSON — e se quella non è l'email della sessione (la sessione è passata a un'altra persona, con la pagina rimasta ferma) la
rotta risponde 409 `{errore: "persona_diversa", persona: ""}`, senza chiamare il backoffice e senza dati. Dalla `v2.12.0`
`persona` è un testo vuoto, che non è l'email di nessuno: per la cornice vuol dire «un'altra persona», e il JS di una scheda
che non è più di chi è nella sessione non sa chi è entrato (fino alla `v2.11` era l'email della sessione). Se la dice in tutti e due i posti valgono tutti e due: basta che uno non sia quello della sessione. Una persona detta
che non si può confrontare — un valore che non è un testo, anche `null`, o un testo vuoto — è un 422
`{errore: "dati_non_validi"}`: non vale come non detta. Una richiesta che non la dice — né l'intestazione né `persona` nel
corpo: un'intestazione con un altro nome e la query non contano — dalla `v2.13.0` riceve 422
`{errore: "persona_mancante", persona: ""}` e non arriva alla rotta: non legge, non cerca, non segna (fino alla `v2.12`
rispondeva come prima). L'ordine dei
rifiuti è lo stesso per tutte: il 401 della guardia, la persona (prima il 422, poi il 409), il 403
`gettone_senza_workspace`, e solo dopo i 422 della rotta e il 409 `workspace_diverso`; fino alla `v2.11` il 403 veniva prima
della persona. Di chi sono i dati lo dice sempre e solo la sessione: ciò
che la richiesta dice si confronta e basta. Il middleware è `Zeiras\Core\Http\StessaPersona`, sul gruppo delle rotte: zr-core
lo registra da sé.

Dalla `v2.19.0` le rotte della cornice stanno fuori da `SoloDallaPersona` di zr-auth («Resta poi Salva»): il frontend può
accendere `ZR_AUTH_PERSONA_CONTROLLO`, e la ricerca e le letture della cornice non passano da `SoloDallaPersona` (l'impronta in
`X-Zr-Persona` la chiede `StessaPersona`: dalla `v2.21.0` senza è un 409, più sotto). Le protegge
`StessaPersona`, che confronta la persona della pagina con quella della sessione prima della rotta, come `SoloDallaPersona`
fa con l'impronta per le scritture del frontend; a una pagina di un'altra persona la risposta resta il 409
`{errore: "persona_diversa", persona: ""}` di sopra, anche se porta un `X-Zr-Persona`. L'uscita è delle sole rotte
`cornice/*`: le scritture del frontend nel gruppo `web` restano sotto `SoloDallaPersona`. Con zr-core fino alla `v2.18`
l'interruttore acceso dà 409 alla ricerca e alle letture della cornice: prima si aggiorna zr-core, poi si accende.

Dalla `v2.20.0` `StessaPersona` confronta anche l'impronta di zr-auth: un'email può passare da un account a un altro, e con
la sola email una scheda rimasta aperta dell'account di prima leggerebbe e segnerebbe a nome di quello nuovo. I dati della
cornice (`Cornice::dati()`, `subito()`, e quindi `dopo()` e `ridotta()`) portano in `persona.impronta` l'impronta della persona
della sessione (`Persona::impronta()` di zr-auth: un HMAC dell'id della persona, non della sessione — è la stessa in tutte le sue sessioni —, né l'id né l'email; `null` per una sessione senza id), che
la cornice non mostra mai e manda in `X-Zr-Persona` a ogni richiesta `cornice/*`. Un'impronta detta che non è quella della
sessione riceve lo stesso 409 `{errore: "persona_diversa", persona: ""}`, anche con l'email giusta, senza chiamare il
backoffice. Si confronta quando la sessione ne ha una, e si legge come la legge `SoloDallaPersona`: ogni parte fra le virgole
deve essere quella della sessione (le maiuscole o un testo qualunque sono un'altra persona). Dalla `v2.21.0`, con la
sessione che ha un'impronta, una richiesta che non la dice — senza `X-Zr-Persona`, o coi testi `undefined` e `null` che il JS
manda con dati che non la portano — riceve lo stesso 409 `{errore: "persona_diversa", persona: ""}`, come da
`SoloDallaPersona` di zr-auth (fino alla `v2.20` decideva l'email); i 422 della persona restano prima. Con una sessione
senza id (`id` assente o `null`) non si confronta niente, come prima. Dalla `v2.21.1` una sessione con un id che non dà
un'impronta — vuoto, o non un testo — è una persona sconosciuta: ogni richiesta `cornice/*`, letture comprese, riceve lo
stesso 409 senza chiamare il backoffice, e la pagina si ricarica: al più una volta ogni 30 secondi e senza fine, perché la
ricarica non cambia la sessione. È voluto: una sessione così non si sa di chi sia. Il contratto di `/v1` dà sempre un id di
testo. Dalla `v2.23.0` l'impronta decide chi è la persona della pagina: se la sessione ne ha una e la richiesta dice quella,
la richiesta passa anche con un'email che non è quella della sessione (la persona l'ha cambiata da un'altra scheda,
zr-home #2214), e i dati sono sempre quelli della sessione, mentre `persona` nella risposta è l'email che la pagina ha detto (se fosse
un'altra la scheda si ricaricherebbe come per un'altra persona). Con un'altra impronta, o senza, è il 409 di sempre, qualunque email dica,
e senza sessione resta il 401: l'impronta da sola non fa entrare nessuno. L'email decide dove l'impronta non c'è — la
sessione senza id — e dove la sessione non ha un'email da confrontare; i 422 della persona restano prima. Nessuna rotta della
cornice legge l'email detta come dato: l'intestazione `Persona` e `persona` nel corpo li guarda solo `StessaPersona`. La `persona` della risposta è l'email detta solo se è lunga al più 254 caratteri, quanto un'email:
una più lunga passa lo stesso, e la risposta dice quella della sessione. Cambiare
`APP_KEY` cambia tutte le impronte, e annulla le sessioni se non c'è `APP_PREVIOUS_KEYS`: con le chiavi di prima le schede
aperte ricevono il 409 e si ricaricano. Per i test di un
frontend cambia una cosa: un caso che aspetta il 409 da una richiesta con un'altra email e l'impronta della sessione ora
passa, e per provare «un'altra persona» la richiesta porta l'impronta di quella persona (quella di un altro account, cioè
`Persona::impronta()` con un altro `id` nella sessione).
Nel browser la cornice riconosce una persona da email e impronta: con la stessa email e un'altra impronta
si rifà, come con un'altra email. Il frontend che passa all'`AppShell` i dati di `Cornice::dati()` o `subito()` non fa
niente; quello che costruisce `persona` da sé ci aggiunge `impronta` da `Persona::impronta()`. Senza, dalla `v2.21.0`
ogni richiesta della sua cornice riceve il 409 e la pagina si ricarica, al più una volta ogni 30 secondi e senza fine: ogni
ricarica manda l'evento `zr-core:altra-persona`, e la pagina dopo ha di nuovo i dati senza impronta. È il cambio che rompe
chi non manda l'impronta, e prima di passare alla `v2.21.0` si guarda che `persona` la porti (fino alla `v2.20` la sua
cornice restava protetta solo dall'email). Per i test di un frontend che passa alla `v2.21.0` cambia una cosa: un caso che
chiama una rotta `cornice/*` con la sola `Persona`, e una sessione che ha un id (e quindi un'impronta), riceve il 409; ci
aggiunge `X-Zr-Persona` con `Persona::impronta()` della sessione, come fa la pagina (un caso che parte da `call()` la mette
fra le variabili del server, `HTTP_X_ZR_PERSONA`). Si trovano cercando `cornice/` nei test del frontend.
L'impronta è un HMAC con la chiave dell'app (`APP_KEY`): un frontend non la condivide con un
altro modulo, o la stessa persona avrebbe la stessa impronta nei due. Nella `v2.20.0` restavano due limiti dalla parte del
browser (il server confronta sempre l'impronta della sessione), e dalla `v2.20.1` non ci sono più: il layout in due dati
(`LayoutDellaCornice`) riconosce anche lui la persona da email e impronta, e una pagina dell'account di prima, della stessa
email, vale come quella di un'altra persona (con Indietro i dati della cornice di quella pagina non vanno sotto il nome di
adesso, e senza il segno della lettura il layout manda l'evento `zr-core:altra-persona` e ricarica la pagina; il contenuto della
pagina resta del frontend, come con un'altra email); e con due cornici montate insieme, della stessa email
e di due account, ogni richiesta porta l'impronta della cornice che la fa, non quella dell'ultima montata. Resta un limite:
una voce della cronologia salvata prima della `v2.20.0` non ha l'impronta, e con Indietro, la prima volta, la cornice la prende
per un'altra persona (si rifà, o la pagina si ricarica).

La cornice, dalla `v2.6.0`, lo dice in ognuna delle quattro richieste: l'intestazione `Persona` porta l'email di chi la
cornice mostra, passata da `encodeURIComponent` perché un'intestazione porta solo caratteri di Latin-1. L'email non sta mai
nell'indirizzo, e nel corpo di «Segna tutte come lette» non c'è più. Con lei partono in ogni richiesta `Content-Type` e il
gettone CSRF, anche nella `GET` dell'elenco. Così da una scheda rimasta ferma, con la sessione passata a un'altra persona,
nessuna delle quattro legge o segna qualcosa di chi è entrato: nemmeno il clic su una notifica, che fino alla `v2.5.1` la
segnava letta a lui. Fino alla `v2.13` la destinazione di quel clic si chiedeva subito, senza aspettare la risposta, e si apriva solo se arrivava
prima del 409: se il 409 arrivava con la pagina ancora lì, la pagina si ricaricava al posto della destinazione, ed era di chi era
entrato (provato il 13/10/2026 in Chromium 151, con `window.location.assign`, il `naviga` di partenza; riprovato il
14/10/2026 con la `v2.10.0`, in cui quella ricarica la chiede un orologio, su una pagina caricata da più di 30 secondi). Dalla `v2.9.0`
anche questa ricarica ha il tetto delle altre: su una pagina caricata da meno di 30 secondi non parte prima che li compia.
Dalla `v2.11.5`, su quella pagina, il clic aspetta la risposta, e davanti al 409 la destinazione non si apre: niente è
segnato a chi è entrato, e niente si apre con la sua sessione (dalla `v2.9.0` alla `v2.11.4` si apriva). Dalla `v2.10.0`,
se la pagina è ancora lì quando compie 30 secondi, si ricarica allora. Dalla `v2.14.0` il clic aspetta la risposta su ogni
pagina, e davanti al 409 la destinazione non si apre mai.
Un JS di prima della `v2.6.0` rimasto in una
scheda non dice la persona in tre richieste — l'elenco, la ricerca, la lettura con un clic — e prima della `v2.5.0` nemmeno
in «Segna tutte come lette». Fino alla `v2.12` la rotta gli rispondeva come prima, e il suo clic su una notifica la segnava a
chi era entrato; dalla `v2.13.0` gli risponde 422 `{errore: "persona_mancante", persona: ""}`, e non legge né segna niente.
La `persona` vuota è per quel JS: quello della `v2.5.x`, davanti all'elenco, alla ricerca o al clic su una notifica, la prende per
«un'altra persona» e ricarica la scheda, che dopo ha il JS del frontend di adesso; uno di prima mostra l'errore della
campanella o della ricerca finché la scheda non si ricarica. Resta fuori una cosa, i dati della cornice senza l'email della
persona: l'intestazione partirebbe senza un'email, e le quattro rotte la rifiutano: 422 `dati_non_validi` se l'email è un
testo vuoto, 409 `persona_diversa` se manca o è `null` (parte il testo `undefined` o `null`). Elenco, ricerca e letture danno
errore, e la pagina non si ricarica (l'email è obbligatoria nel contratto del backoffice: «La cornice in due dati»). Chi installa la `v2.6.0` guarda due cose. Il JS e la parte server del pacchetto si aggiornano insieme, e la cache
delle rotte si rifà al deploy (`php artisan route:cache`): il confronto di «Segna tutte come lette» non lo fa più il
controller ma la regola delle rotte, e con una cache delle rotte fatta prima dell'aggiornamento, o col JS nuovo davanti a
una parte server fino alla `v2.5.1`, non lo fa nessuno, senza un errore che lo dica. E l'email della persona ora parte in
un'intestazione di ognuna delle quattro richieste, anche della `GET` dell'elenco: uno strumento che registra le intestazioni
delle richieste la tiene, e `Persona` si aggiunge a quelle che oscura. Se invece qualcosa fra il browser e il frontend la
toglie, fino alla `v2.12` la rotta non confrontava e la richiesta valeva come prima; dalla `v2.13.0` è un 422
`persona_mancante` con `persona` vuota, che la cornice prende per «un'altra persona»: la scheda si ricarica, al più una
volta ogni 30 secondi e solo quando parte una richiesta, finché l'intestazione non arriva.

Dalla `v1.14.0`, se la persona non ha accettato i documenti legali in vigore le quattro rotte rispondono 403
`{errore: "accettazione_richiesta", persona}`: il codice e, dalla `v2.5.0`, l'email della persona della sessione
(`persona`: di chi è quell'errore); titolo, dettaglio e documenti mancanti del backoffice restano nella parte server. La cornice lo riconosce e passa allo stato ridotto (vedi «La cornice», al punto «Chi non ha accettato
i documenti legali»); ogni altro errore del backoffice resta quello di prima. Su quelle rotte nessun middleware del
frontend chiama `/v1` senza prendere quel 403: altrimenti al browser, al posto della risposta della rotta, arriva quella di
zr-auth. Da zr-auth `v0.12.17` è un 403 con `codice` e `mancanti`: la cornice lo riconosce lo stesso, dal `codice`, e
passa allo stato ridotto.

### Il cookie del segno

Dalla `v2.11.0` i segni della parte server — `sessione_il` di `Cornice::subito()`, `aggiornati_il` e `sessione_il` di
`Cornice::dopo()`, `aggiornati_il` dei dati interi e dell'elenco delle notifiche, `segnata_il` e `segnate_il` — non vanno
indietro per lo stesso browser, fra server sfasati di cinque minuti al massimo. L'ultimo segno dato sta nel cookie `__Host-zr-core-segno`, e un segno nuovo è
l'orologio della parte server se è più avanti di quello, e altrimenti quello più un microsecondo: con due server del
frontend sfasati, o con l'orologio riportato indietro, la pagina di chi è entrato adesso non vale come una pagina vecchia
(fino alla `v2.10.0` la cornice la scartava, e restava chi c'era prima). Due richieste diverse, una dopo l'altra, non
hanno mai lo stesso segno: lo stesso segno c'è dentro una richiesta, dove due letture nello stesso istante hanno lo
stesso, e in due richieste in volo insieme (sotto, «Che cosa resta»). Anche
`lingua_il` (sotto, «La cornice in due dati»), che è il segno di una di quelle letture.

- **Che cosa porta**: solo l'istante, nella forma dei segni, e la sua firma (un HMAC-SHA256 con la `APP_KEY` del
  frontend): niente della persona né del workspace — né l'email, né un id, né lo slug, né un nome.
- **Gli attributi**: `Path=/`, nessun `Domain` (il prefisso `__Host-` lo lega all'host del modulo), `Secure`, `HttpOnly`,
  `SameSite=Lax`; scade con la sessione (`session.lifetime`, o alla chiusura del browser con `session.expire_on_close`).
  Nel gruppo `web` lo cifra anche `EncryptCookies`, come ogni cookie del frontend; la firma regge anche dove il frontend
  lo esclude.
- **Un cookie che non torna non vale**: manomesso, firmato con un'altra chiave, in un'altra forma, vuoto o mancante, il
  segno è l'orologio, come fino alla `v2.10.0`, e la risposta riscrive il cookie. Senza `APP_KEY` il cookie non c'è, e il
  segno è l'orologio.
- **Al massimo cinque minuti avanti**: il cookie vale solo se è avanti dell'orologio della parte server di cinque minuti
  al massimo. Oltre, il segno è l'orologio, la risposta riscrive il cookie, e nel log resta un avviso che non dice
  l'istante del cookie: uno sfasamento di secondi o di minuti fra i server è assorbito, un server avanti di ore o di anni
  non porta il suo orologio agli altri. Per quel browser, allora, è come fino alla `v2.10.0`: la pagina di chi entra da
  un server indietro di più di cinque minuti può valere come una pagina vecchia.
- **Per l'informativa**: è un cookie tecnico, necessario al funzionamento della cornice; non serve a profilare, non va a
  terzi e non esce dall'host del modulo. Va citato col suo nome e il suo scopo nell'informativa sui cookie del modulo.
- **Che cosa serve**: le risposte che danno un segno lo mettono nella coda dei cookie di Laravel, e lo manda
  `AddQueuedCookiesToResponse`, che sta già nel gruppo `web`: il frontend non scrive niente. Una pagina fuori dal gruppo
  `web` dà i segni senza il cookie, come prima.
- **Che cosa resta**: due richieste in volo insieme leggono lo stesso cookie, e i loro segni sono gli orologi dei loro
  server, nel loro ordine, o lo stesso segno, il cookie più un microsecondo, se il cookie è più avanti di tutti e due; un
  browser che non tiene il cookie — i cookie rifiutati, o un indirizzo `http://`: il prefisso `__Host-` lo
  vuole `Secure`, e su `http://localhost` alcuni browser lo tengono e Safari no (non provato in un browser) — vale come
  prima della `v2.11.0`. I server del frontend devono avere comunque l'ora allineata: un server avanti di cinque minuti al
  massimo porta il suo orologio agli altri, per quel browser, finché l'orologio vero non lo raggiunge, e nel frattempo i
  segni di quel browser avanzano di un microsecondo a richiesta.

## La cornice

Ogni pagina di un workspace sta dentro la `Cornice`. Il frontend dà la pagina, i dati della parte server (`Cornice::dati()`)
e, in un prodotto, il proprio id del registro con le proprie voci; zr-core mette il menu Moduli con gli indirizzi del
workspace, i testi nella lingua della persona e le pagine di account e notifiche su app.zeiras.com. Con `cornice` a `null`
(nessun workspace) la pagina si mostra senza `Cornice`: `dati` è obbligatorio, e la prop condivisa tipizzata
`DatiDellaCornice | null` fa fermare `tsc` a chi se ne dimentica.

```tsx
import { usePage } from '@inertiajs/react';
import { Cornice, type DatiDellaCornice } from '../../vendor/zeiras/zr-core/resources/js';

const { cornice } = usePage<{ cornice: DatiDellaCornice | null }>().props;

cornice === null ? pagina : (
    <Cornice
        dati={cornice}                    // i dati di Cornice::dati(), condivisi dalla parte server
        product="pm"                      // solo nei prodotti: l'id del registro; senza, è una pagina di app.zeiras.com
        nav={[{ group: '…', items: [ … ] }]} // le voci del prodotto, sotto il suo pulsante
        active="board"                    // l'id della voce attiva della barra; null: nessuna
        onLogout={esci}                   // obbligatorio: «Esci» chiude la sessione ovunque, ed è il frontend a farlo
    >
        {pagina}
    </Cornice>
);
```

- **La lingua** è quella dei dati: `it-IT` vale `it`, e una lingua che zr-core non ha è inglese. Le non lette hanno due
  testi, uno per una sola e uno per ogni altro numero: una lingua con più forme di plurale (il polacco, l'arabo) oggi non
  entra con un file solo. Dalla `v1.20.0` ogni lingua ha due file con lo stesso nome: i testi della cornice
  (`resources/lingue/<codice>.json`) e le frasi delle notifiche (`resources/lingue/notifiche/<codice>.json`), che la
  cornice carica quando si apre la campanella (più sotto, «Le notifiche»).
- **«Salta al contenuto»** è il primo elemento della cornice da tastiera, dalla `v1.18.0`: un pulsante davanti alla barra
  laterale e alla barra in alto, che non si vede finché non ha il fuoco. Col primo Tab compare in alto a sinistra, sopra
  la cornice; Invio, Spazio o un clic portano il fuoco al contenuto della pagina, il `main` dell'`AppShell`, e il Tab dopo
  va al primo elemento della pagina invece di rifare tutta la barra. C'è anche nello stato ridotto. Il modulo non deve fare
  niente: non gli serve un `id` sul suo contenuto, e non ne scriva uno suo. Il `main` è quello dell'`AppShell`, anche se il
  frontend ne ha uno suo prima della cornice o intorno a lei. Per chi aggiorna cambiano due cose senza che tocchi niente:
  `.zr-shell` non è più il primo elemento di ciò che la `Cornice` rende (prima c'è il `div` del pulsante), e dopo un salto
  il `main` ha `tabindex="-1"` finché tiene il fuoco. Un test del modulo sul primo figlio della cornice, su `:first-child`
  o sul primo elemento che prende il fuoco va riletto. È provvisorio: l'`AppShell` del design system
  non ha ancora il suo, e la cornice lo fa coi soli pezzi del design system (il `Button`, la classe `zr-visually-hidden`, i
  token); quando l'`AppShell` lo porta questo si toglie, senza che il modulo cambi niente. Dalla `v2.25.2`, in una pagina
  senza niente che prende il fuoco, il contenuto può avere già una fermata sua (il punto qui sotto): senza percorso è il
  `main`, e il salto la trova e non la cambia; col percorso è il `div.zr-main-body`, e il salto dà come prima il fuoco al
  `main`.
- **Il contenuto che scorre è una fermata del Tab, se non ha altro**: dalla `v2.25.2`, in una pagina in cui dentro il
  contenuto non c'è niente che prende il fuoco — né collegamenti, né pulsanti, né campi — il contenitore che scorre ha
  `tabindex="0"`: il `main` dell'`AppShell`, o col percorso il suo `div.zr-main-body`; in una pagina `flush` nessuno.
  Chi usa la tastiera lo raggiunge col Tab e lo fa scorrere con le frecce o con PagGiù, cosa che prima non poteva fare
  (axe, `scrollable-region-focusable`). Appena nella pagina compare qualcosa che prende il fuoco la fermata si toglie, e
  quando cambia ciò che scorre si sposta: le fermate del contenuto non sono mai due. Il `main` ha anche un nome, «Contenuto»
  (`aria-label`, nella lingua della cornice, anche dopo un cambio di lingua). Col fuoco da tastiera la fermata ha il
  contorno del design system, 2 px `--focus` all'interno del bordo. Un `tabindex` che il modulo ha già dato al contenitore
  resta com'è, e un `main` del modulo fuori dall'`AppShell` non si tocca. Per chi aggiorna: in una pagina così c'è una
  fermata del Tab in più, dopo la barra in alto (e dopo il percorso, se c'è), e un clic sul contenuto gli dà il fuoco; un
  test del modulo che conta le fermate del Tab in una pagina senza elementi che prendono il fuoco va riletto. Sta nel pezzo
  dei rimedi, che arriva a cornice montata. È provvisorio: quando l'`AppShell` lo fa da sé (è nelle richieste al design
  system) si toglie, senza che il modulo cambi niente. Tre limiti noti, che chiudono con l'`AppShell` corretto: un campo
  nascosto, un titolo con `tabindex="-1"` o un pulsante spento contano come qualcosa che prende il fuoco, e allora la fermata
  non c'è; in una pagina `flush` il `main` non ha il nome; dove il browser non conosce `:focus-visible` (Safari prima della
  15.4, Chrome prima dell'86, Firefox prima dell'85) il contorno non c'è e il fuoco sul contenuto scrive un errore in console.
- **Il pannello della ricerca è una fermata del Tab**: dalla `v3.6.0`, con la ricerca aperta il pannello dei risultati ha
  `tabindex="0"`, `role="group"` e un nome, «Risultati della ricerca» nella lingua della cornice. Quando i risultati non ci
  stanno il pannello scorre, e dentro niente prende il fuoco (il fuoco resta nel campo, che indica il risultato scelto con
  le frecce): prima chi usa la tastiera non poteva farlo scorrere (axe, `scrollable-region-focusable`). Col Tab dal campo il
  fuoco va al pannello, che scorre con le frecce, e ha il contorno del design system come il contenuto. Un elemento del modulo
  con la classe del pannello non si tocca. Per chi aggiorna: con la ricerca aperta c'è una fermata del Tab in più, dopo il
  campo; un test del modulo che conta le fermate con la ricerca aperta va riletto. Esc col fuoco nel pannello chiude la
  ricerca come dal campo (l'`AppShell` lo fa solo dal campo): il fuoco non torna a chi ha aperto la ricerca, va al documento,
  come dopo Esc nel campo. Sta nel pezzo dei rimedi, ed è provvisorio
  come quello del contenuto (è nelle richieste al design system); ha gli stessi limiti di `:focus-visible`.
- **Il fuoco nel pannello delle notifiche**: dalla `v1.20.0`, aprendo la campanella — con Invio, con Spazio o col clic — il
  fuoco della tastiera entra nel pannello, sulla linguetta scelta («Per me» all'apertura), come nel menu del profilo. Il
  fuoco si sposta solo all'apertura: quando arriva l'elenco o cambiando linguetta resta dov'è, e dopo «Riprova» o «Segna
  tutte come lette» la cornice non lo riporta sulla linguetta. Quei due pulsanti, premuti, spariscono — con l'errore, o
  con l'ultima non letta —, e dove va il fuoco allora lo decide il browser: di solito esce dal pannello, che resta aperto.
  Esc chiude il pannello e riporta il fuoco sulla campanella, come prima. Dalla `v1.21.0` il fuoco torna sulla campanella
  anche chiudendo il pannello col clic, dove il clic non dà il fuoco a un pulsante (Safari, Firefox su macOS): prima
  restava alla pagina. Lo provano i casi del pacchetto, che imitano un clic che non dà il fuoco: in Safari e in Firefox non
  è provato. A pannello aperto, il clic sull'avatar chiude il pannello e apre il menu del profilo, e il fuoco va sulla
  prima voce del menu, che il `Menu` mette a fuoco da sé: provato in Chrome; in Safari, dove il clic non dà il fuoco
  all'avatar, non è provato. Torna sulla campanella anche dopo il clic su una notifica o su «Vedi tutte», che
  chiudono il pannello ed escono dal documento col fuoco: provato in Chrome, col clic vero; in Safari e in Firefox non è
  provato. A un elemento che lo ha preso — un campo cliccato fuori dal pannello — non si toglie (provato in Chrome). Vale anche
  nello stato ridotto. Il pannello è quello che l'`AppShell` scrive accanto alla campanella: un elemento di una pagina con la stessa
  classe non prende il fuoco. Il modulo non deve fare niente; un test del modulo che apre la campanella e poi guarda
  l'elemento attivo va riletto, e così uno che apre una notifica dal pannello. È provvisorio: l'`AppShell` del design system apre il pannello e lascia il fuoco sulla
  campanella, e la cornice lo sposta da sé, senza toccare il componente; quando l'`AppShell` lo porta questo si toglie,
  senza che il modulo cambi niente. Il rimedio sta in un pezzo a richiesta che la cornice chiede quando si monta (circa
  1,8 KB con gzip, con quelli dei punti sotto), fuori dal JS d'ingresso: se non arriva, la campanella si apre come prima,
  col fuoco sul pulsante. Se non arriva, l'aiuto di Vite manda su `window` l'evento `vite:preloadError`: un frontend che
  a quell'evento ricarica la pagina la ricarica anche per questo pezzo.
- **Tab dentro un dialogo aperto**: dalla `v1.20.0`, con un `Dialog` aperto il fuoco della tastiera resta nel dialogo. Tab
  dall'ultimo elemento torna al primo, Maiusc+Tab dal primo va all'ultimo, e se il fuoco è ancora fuori il primo Tab
  entra. Lo stesso per un `DetailPanel` sotto 720 px, dove è largo tutta la pagina; da 721 px in su Tab esce verso la
  pagina, come vuole la linea guida. Con un dialogo sopra un pannello vale il dialogo, e il dialogo si vede: sotto 720 px
  il CSS del design system mette il pannello un gradino sopra i dialoghi, e la cornice alza il velo di ogni `Dialog` aperto
  a `--z-dialog` + 2, sopra il pannello. Le anteprime (`inline`) non
  trattengono niente, e con un `Menu` aperto dentro il dialogo, o col fuoco in un menu accanto, la cornice non interviene (un menu che sta
  altrove nella pagina, senza il fuoco, non cambia niente); non interviene
  nemmeno se un elemento del dialogo tiene Tab per sé (`preventDefault`), né se Tab è premuto con Ctrl, Alt o Meta.
  Dalla `v1.21.0`: un `Dialog` che non ha niente su cui fermarsi — senza «×» e senza pulsanti — prende lui il fuoco al
  primo Tab, e Invio non preme più il pulsante della pagina dietro; ciò che sta dentro un elemento `inert`, o dentro un
  `<details>` chiuso, non conta come fermata, tranne il `summary` che lo apre, con ciò che ha dentro; un `iframe`, e un `video` o un `audio` coi
  comandi, contano dove il browser li mette nel giro del Tab. Dalla `v1.22.0`: un `iframe` largo o alto zero — un
  riquadro di servizio, che non si vede — non conta come fermata, e Tab dal pulsante che lo precede torna alla prima
  invece di passare da lì e uscire dietro il velo; e chiuso un `Dialog` che non aveva niente su cui fermarsi, il fuoco
  torna all'elemento che lo aveva prima che il dialogo lo prendesse, se è ancora in pagina e se nel frattempo non lo ha
  preso un altro (provati in Chrome). Se intanto si è aperto un altro dialogo, il fuoco torna solo a un elemento di quel
  dialogo: a un pulsante rimasto dietro il velo no, perché Invio lo premerebbe di nuovo (provato in Chrome). Chiuso poi
  quell'altro dialogo, il fuoco resta alla pagina: al pulsante di partenza non torna (provato in Chrome). Al dialogo che
  ha preso il fuoco resta il `tabindex="-1"` che la cornice gli ha scritto (provato in Chrome), anche se poi guadagna un
  pulsante (questo in un browser non è provato); riaperto, è un elemento nuovo e non lo ha. Il modulo non deve fare niente,
  e non scriva una trappola sua: sarebbero due. Un test del modulo con un `iframe` in fondo a un `Dialog` va riletto: in
  un DOM senza geometria (happy-dom, jsdom) larghezza e altezza sono sempre zero, e lì un `iframe` non è mai una fermata.
  È provvisorio: `Dialog` e `DetailPanel` del design system non trattengono
  ancora il fuoco, e la cornice lo fa da sé, senza toccare i componenti; quando lo fanno loro questo si toglie, senza che
  il modulo cambi niente. Non copre due cose: una pagina senza la cornice, dove un dialogo aperto non trattiene niente, e
  il primo campo in fuoco all'apertura, che resta del modulo. Restano fuori anche tre casi: da dentro un `iframe` i
  tasti sono della sua pagina, e Tab dall'ultimo suo elemento esce dal dialogo (il Tab dopo rientra); gli elementi dentro
  uno shadow DOM non si contano; un `tabindex` maggiore di zero non cambia il giro, che per la cornice è l'ordine del
  documento. E un quarto, provato in Chrome: di un `video` o di un `audio` coi comandi la cornice conta una fermata
  sola, e quando è l'ultima cosa del dialogo i comandi che il browser tiene al suo interno col Tab non si raggiungono.
  Sta nello stesso pezzo a richiesta del punto sopra: se non
  arriva, Tab fa il giro di prima, e sotto 720 px un `Dialog` aperto da un `DetailPanel` resta sotto il pannello. Anche il
  gradino del velo è provvisorio: è uno stile che la cornice scrive sull'elemento, perché il pacchetto non porta un CSS
  suo, e si toglie quando il design system mette i dialoghi sopra il pannello.
- **Menu del profilo e barra dei moduli senza errori di accessibilità**: dalla `v2.22.1`, nel menu del profilo aperto l'avatar
  dell'intestazione è nascosto ai lettori di schermo (`aria-hidden`), perché un'immagine dentro un `role="menu"` non è
  ammessa (axe: `aria-required-children`); il nome e l'email restano scritti accanto. Con il selettore dei workspace o il
  menu Moduli aperto, la barra dei moduli dietro, già nascosta (`aria-hidden`), è anche `inert`: i suoi link non si
  raggiungono col Tab (axe: `aria-hidden-focus`), e chiuso il selettore torna com'era. Dalla `v2.25.0` lo è anche il piede della barra
  laterale, con «Impostazioni»: prima il Tab ci finiva sopra dal selettore aperto, e ora dal selettore resta nel selettore o passa
  a un altro elemento della pagina — il pulsante del menu Moduli, la ricerca —, mai alla barra spenta (il selettore non si chiude da solo quando il fuoco esce: si chiude con Esc, un clic o una scelta). Il modulo non deve fare niente; un
  test del modulo che cerca per ruolo l'avatar del menu del profilo non lo trova più, e uno che col selettore aperto
  raggiunge un link della barra col Tab va riletto. È provvisorio: il menu e la barra sono dell'`AppShell` del design system,
  e la cornice li corregge da sé, senza toccare il componente; quando l'`AppShell` lo porta questo si toglie, senza che il
  modulo cambi niente. Sta nello stesso pezzo a richiesta dei due punti sopra: se non arriva, il menu e la barra restano
  com'erano.
- **Il pannello delle notifiche e la barra in alto senza errori di accessibilità**: dalla `v3.4.0`, nel pannello delle
  notifiche aperto la testa e il piede (un `<header>` e un `<footer>` dell'`AppShell`) hanno `role="none"`: prima axe li
  leggeva come un secondo banner e un contentinfo dentro la pagina (`landmark-banner-is-top-level`,
  `landmark-contentinfo-is-top-level`, `landmark-no-duplicate-banner`, `landmark-unique`). A 720 px o meno, finché la ricerca
  aperta copre la barra in alto — col fuoco nel campo, o coi risultati —, la campanella e il profilo non si vedono e non
  prendono il fuoco (`visibility: hidden` sull'elemento delle azioni, con dentro anche le `actions` che il modulo passa
  all'`AppShell`): prima restavano bersagli coperti a metà dal campo (axe: `target-size`). Tab fuori dal campo non chiude la
  ricerca, che resta sopra la barra: le azioni tornano, 44×44 px, quando si chiude (Esc, un clic fuori, la scelta di un
  risultato) e il fuoco non è più nel campo. Sopra 720 px non cambia niente. Il modulo non deve fare niente; un test del modulo
  che a 720 px o meno apre la ricerca e poi clicca la campanella va riletto. È provvisorio, come i punti
  sopra: quando l'`AppShell` lo porta si toglie, e se il pezzo a richiesta non arriva il pannello e la barra restano com'erano.
- **I collegamenti della barra laterale passano da `naviga`**: dalla `v2.25.0`, un clic semplice col tasto sinistro su Dashboard, su
  un modulo o su «Impostazioni» — i collegamenti della barra laterale — con un indirizzo di questa origine chiama
  `naviga(indirizzo)` e il browser non lo segue: senza, il clic è un link vero e ricarica la pagina intera anche dentro lo stesso
  modulo. È la `naviga` che la cornice ha quando si monta (la stessa dei suoi altri indirizzi: un frontend che naviga da sé la
  passa già); una `naviga` data dopo, a cornice montata, non la sostituisce. Col tasto centrale o destro, con Ctrl, Cmd, Maiusc o
  Alt, con un indirizzo di un'altra origine o con un clic già gestito da altri, il clic resta del browser. Con più cornici nel documento vale la
  `naviga` dell'ultima montata. Il modulo non deve fare
  niente; un test che clicca una voce della barra e guarda `location` o `naviga` va riletto. Se il frontend dà anche `onNavigate`,
  una voce con un indirizzo li chiama tutti e due: `onNavigate` con l'id, come prima, e `naviga` con l'indirizzo al posto della ricarica. **È provvisorio**: finché l'`AppShell`
  non ha una sua funzione per il clic su queste voci (è fra le richieste al design system) lo fa la cornice da sé, e quando
  l'`AppShell` la porta questo si toglie senza che il modulo cambi niente. Sta nello stesso pezzo a richiesta dei punti sopra: se
  non arriva, i clic restano del browser.
- **Anche i collegamenti del percorso passano da `naviga`**: dalla `v3.6.0`, le voci del percorso con un indirizzo di questa
  origine fanno come quelle della barra laterale, con le stesse eccezioni (tasti, altre origini, clic già gestiti). La voce
  senza indirizzo (`#`) la ferma l'`AppShell`, e l'ultima, la pagina, non è un collegamento. L'`AppShell` chiama ancora
  `onCrumb(voce, indice)`, ma senza l'evento: **non navigate da `onCrumb`**, perché il browser segue già il link, e con
  `naviga` la visita partirebbe due volte. `onCrumb` resta per ciò che non è navigare (una misura, un registro). È provvisorio
  come il punto sopra: quando l'`AppShell` dà l'evento a `onCrumb` (è fra le richieste al design system) si toglie.
- **I menu della barra in alto sopra il pannello di dettaglio**: dalla `v3.6.0`, il menu del profilo e il pannello delle
  notifiche, aperti, salgono di un gradino sopra un `DetailPanel` non modale (uno stile sull'elemento, `z-index:
  calc(var(--z-dialog) + 1)`): prima finivano sotto il pannello, e col pannello aperto «Esci» non si cliccava col mouse (da
  tastiera sì). Restano sotto i dialoghi e sotto il cassetto del menu; sotto i 720 px il pannello è a tutto schermo e copre la
  barra come prima. Il modulo non deve fare niente. È provvisorio: quando il design system mette i menu della barra sopra il
  pannello (è fra le richieste al design system) si toglie. Sta nello stesso pezzo a richiesta dei punti sopra: se non arriva,
  i menu restano sotto il pannello.
- **Il menu Moduli** incrocia il registro con lo stato dei prodotti nel workspace: un prodotto `attivo` porta a
  `<indirizzo>/w/<slug>`. Uno `disponibile` non è attivo lì, e dalla `v2.25.0` non porta più alla sua pagina «non attivo nel
  workspace»: porta a Impostazioni › Moduli (`moduli` nei dati, vedi «La parte server») se la persona amministra il workspace.
  Agli altri, dalla `v3.2.3`, la voce non si mostra: chi non può attivare un modulo non lo vede spento, come nella griglia
  della Home (regola #2209; fino alla `v3.2.2` era una voce senza collegamento, senza «Presto»: il design system non ha un
  segno «non attivo», riga 78 delle richieste). Restano due tipi di voce: quella del modulo aperto, perché senza la sua voce
  l'`AppShell` toglierebbe tutto il menu Moduli, e quelle dei prodotti «Presto» del registro, che non sono spenti ma futuri. È «Presto», senza
  indirizzo, un prodotto che il registro dà «Presto», che il backoffice dà `in_arrivo` (o in uno stato che zr-core non
  conosce) o che non elenca. La Dashboard porta
  sempre a `https://app.zeiras.com/w/<slug>`.
  Dalla `v1.10.2` il menu si chiama «Moduli» («Modules», «Módulos»); prima era «Prodotti». Con la stessa versione
  cambiano altri due testi, che un frontend può avere nei suoi test: l'aiuto della ricerca, allora «Cerca in tutti i
  moduli: scrivi almeno 2 caratteri.» (prima «Cerca in tutti i prodotti: scrivi almeno 2 caratteri.»; dalla `v1.12.0`
  dice altro: vedi «La ricerca»), e il titolo che
  `titoloDellaNotifica` dà a `com.zeiras.app.modificata`, «Un modulo è stato attivato o disattivato» (prima «Un'app del
  workspace è stata attivata o disattivata»); lo stesso in inglese e in spagnolo. I nomi nel codice — la prop `product`,
  il file `prodotti.json`, la chiave `prodotti` dei dati — non cambiano.
- **La voce attiva** della barra è quella che ha l'id dato in `active`; senza `active`, o con `active` vuoto, è la
  Dashboard — tranne nello stato ridotto su una pagina di un modulo, dove nessuna voce è segnata (più sotto, «Chi non ha
  accettato i documenti legali»). Una pagina che non
  sta sotto nessuna voce lo dice con `active={null}`: nessuna voce è segnata, né la Dashboard né una voce del prodotto,
  e non serve inventare un id che la barra non ha. Il prodotto aperto lo dice `product`, non `active`: con `null` il suo
  pulsante resta com'è.
- **Il selettore «Azienda › workspace»** in cima alla sidebar elenca le aziende dei dati coi loro workspace, nell'ordine
  in cui arrivano; scegliere un workspace porta allo stesso prodotto nel workspace scelto (`<indirizzo>/w/<slug>`), o alla
  Dashboard da una pagina di app.zeiras.com. Senza aziende, o se il workspace dei dati non sta in nessuna, il workspace
  resta testo. In fondo al selettore c'è «Nuovo workspace» quando `nuovo_workspace` è `true` nell'azienda del workspace
  dei dati (dalla `v1.9.0`): apre `https://app.zeiras.com/w/<slug>/nuovo-workspace`, con lo slug del workspace dei dati, ed
  è una pagina di app.zeiras.com da ogni prodotto. Il dialogo è di zr-home, e se la persona può davvero lo decide il
  backoffice (`io.workspace.crea`): la cornice mostra solo la strada. Un frontend non deve fare niente per averlo. Senza
  `nuovo_workspace` nei dati, o con `false`, il pulsante non c'è. Ogni workspace ha il pallino del suo colore:
  lo decide zr-core dall'`id` del workspace, con una regola sola, e non si sceglie. Lo stesso workspace ha lo stesso colore
  in ogni prodotto, per ogni persona e a ogni visita: cambiargli nome, slug o posto nell'elenco non glielo cambia. I colori
  sono pochi, i toni che il design system ammette per un workspace, quindi due workspace possono avere lo stesso: il colore
  aiuta a riconoscere un workspace, non lo distingue da tutti gli altri. Nel tipo `DatiDellaCornice` l'`id` di un workspace
  è facoltativo: un workspace senza `id` non ha un colore suo, e il suo pallino è quello che il design system mette da sé.
- **La campanella** mostra le non lette dei dati (`non_lette`), «99+» oltre 99, e mai meno delle non lette dell'ultimo
  elenco che il pannello ha caricato, finché i dati non sono stati letti dopo quell'elenco (una notifica può essere
  arrivata dopo che la parte server le ha contate). Dalla `v1.12.0` le non lette di un elenco contano solo se l'elenco è
  del workspace dei dati della pagina, o se la parte server non dice di quale workspace è: con due schede su due workspace
  la scheda rimasta indietro riceve l'elenco di quello in cui la persona è entrata per ultimo, le sue non lette non sono
  quelle della pagina, e la campanella mostra il numero dei dati. Vale coi dati che portano `non_lette`, come li dà
  `Cornice::dati()`: con dati scritti a mano senza `non_lette`, che il tipo ammette, la pagina non ha un numero suo, e la
  campanella conta le non lette che il pannello ha caricato, di qualunque workspace sia l'elenco. Coi dati letti dopo — una visita dopo, se il frontend tiene montata la
  cornice — vale il loro numero, anche quando è lo stesso di prima: dopo «Segna tutte come lette» la campanella non ha un
  numero, e alla visita dopo mostra quello dei dati. La cornice confronta i segni e non torna a dati più vecchi: ogni
  lettura dei dati ha il suo (`aggiornati_il`), e le due rotte delle notifiche dicono quando l'elenco è stato letto e
  quando la lettura è stata segnata. Dati dello stesso workspace letti prima di quelli che la cornice ha — la pagina
  ripresa dalla cronologia con Indietro e Avanti del browser, una risposta che arriva tardi — non li sostituiscono: restano
  il numero, il nome del workspace e tutto ciò che viene dai dati più recenti. Vale per la cornice, non per la pagina:
  quella ripresa dalla cronologia ha i suoi dati di allora, e se li usa nel suo contenuto o nel percorso (`crumbs`) mostra
  quelli di allora, accanto alla cornice coi più recenti. E dopo «Segna tutte come lette» una risposta letta prima del
  clic — una visita già partita, o una pagina che il `prefetch` di Inertia tiene — non rimette il numero.
  Vale dove la cornice resta montata, sotto il layout della cornice: con la cornice montata da ogni pagina quella nuova
  non sa niente di prima, e Indietro porta ancora il numero di allora. I segni vengono dall'orologio della parte server: i
  server del frontend devono avere l'ora allineata. Coi dati senza il segno la cornice non ha niente da confrontare: i
  dati sono nuovi quando è nuovo l'oggetto, e vale ciò che dà la pagina, se è della persona che la cornice mostra (di
  un'altra, dalla `v2.8.0`, la pagina si ricarica: vedi «La cornice in due dati»). Per il lettore di schermo la campanella si
  chiama col suo numero («Notifiche, 3 non lette»), e con una sola al singolare («Notifiche, 1 non letta»). Il design
  system ha un testo solo per le non lette, e lo usa anche per il pallino di ogni notifica non letta nel pannello: il
  pallino dice «non letta» quando sulla campanella ce n'è una sola, «non lette» negli altri casi.
- **Le notifiche** si caricano a ogni apertura della campanella, da `GET /cornice/notifiche`: ognuna col titolo del suo
  tipo nella lingua («Nuova scheda», «Una persona è entrata nel workspace») e l'ora corta nella lingua («5 min fa», «ieri»,
  «1 ott»; corta dalla `v3.6.0`). Dalla `v1.22.0` una notifica che racconta più azioni mostra l'ora dell'ultima, non quella della prima. Il titolo
  lo dice `tipo`, e i
  titoli stanno nelle lingue di zr-core, uno per ogni tipo di evento del contratto, tranne uno che il contratto ha dal
  12/10/2026 e che non genera notifiche (più sotto): una notifica di un tipo che zr-core non
  conosce, o senza `tipo`, ha il titolo di ripiego («Novità nel workspace»), mai il codice del tipo. Un tipo di notifica
  nuovo vuole una versione nuova di zr-core per avere il suo titolo: fino ad allora si legge il ripiego. Dalla
  `v1.11.0` hanno un titolo anche le nove notifiche del CRM (contatti, pipeline, note, aziende): «Nuovo contatto»,
  «Pipeline modificata», «Nota eliminata», «Nuova azienda»; e le tre delle viste salvate di una board, di Project
  Management: «Nuova vista», «Vista modificata», «Vista eliminata». Con quelle i titoli erano 31, uno per ogni tipo di
  evento del contratto pubblicato l'11/10/2026. Per quel contratto i dodici tipi nuovi non generano ancora notifiche per i
  colleghi: titoli e destinazioni sono pronti per quando il backoffice le manderà. Dalla `v1.12.0` hanno un titolo altri
  nove tipi del CRM: i cinque eventi di opportunità e attività («Nuova opportunità», «Opportunità modificata», «Nuova
  attività», «Attività modificata», «Attività eliminata») e le quattro notifiche che il CRM manda a chi diventa
  responsabile («Ti è stato assegnato un contatto», «Ti è stata assegnata un'azienda», «Ti è stata assegnata
  un'opportunità», «Ti è stata assegnata un'attività»). Queste quattro non sono eventi: il loro `tipo` arriva senza
  `com.zeiras.` davanti (`crm.persona.assegnata`, `crm.organizzazione.assegnata`, `crm.trattativa.assegnata`,
  `crm.attivita.assegnata`), e la chiave del titolo è `notificationTitle.crm.persona.assegnata`, non
  `notificationTitle.com.zeiras.crm.persona.assegnata`. Nel contratto un'opportunità è una `trattativa`: il titolo usa la
  parola del CRM, come per i contatti e le aziende. Con quelli i titoli erano 40: i 36 tipi di evento del contratto e i
  quattro «assegnata». Per il contratto nemmeno i cinque eventi di opportunità e attività generano ancora notifiche per i
  colleghi: delle nove arrivano le quattro «assegnata», e titoli e destinazioni dei cinque sono pronti per quando il
  backoffice le manderà. Fino alla `v1.12.0` nessuno dei nove apriva una risorsa, e un clic apriva la pagina delle notifiche
  (`https://app.zeiras.com/notifiche`); dalla `v1.13.0` ognuno apre la sua pagina nel CRM (più sotto). Dalla `v1.14.0` ha un titolo anche
  la notifica che Project Management manda a chi viene assegnata una scheda: «Ti è stata assegnata una scheda». Come le
  quattro del CRM non è un evento: il suo `tipo` arriva senza `com.zeiras.` davanti (`board.scheda.assegnata`), e la
  chiave del titolo è `notificationTitle.board.scheda.assegnata`. Con lei i titoli erano 41: i 36 tipi di evento del
  contratto e i cinque «assegnata». Il contratto la elenca dal 12/10/2026: `app` `pm`, nei `dati` il solo `id` della
  scheda, e `risorsa_nome` è il titolo della scheda. Dalla `v1.16.0` ha un titolo anche la notifica che Project
  Management manda a chi viene menzionato in un commento: «Ti hanno menzionato in un commento». Non è un evento nemmeno
  lei: il suo `tipo` è `board.commento.menzione`, senza `com.zeiras.` davanti, e la chiave del titolo è
  `notificationTitle.board.commento.menzione`. Con lei i titoli erano 42: i 36 tipi di evento del contratto, i cinque
  «assegnata» e la menzione. Anche lei è nel contratto dal 12/10/2026: `app` `pm`, nei `dati` l'`id` della scheda e
  `commento_id`, l'id del commento, mai il testo, e `risorsa_nome` è il titolo della scheda. Dal 12/10/2026 il contratto
  ha 37 tipi di evento: il trentasettesimo, `com.zeiras.crm.persona.anonimizzata` (un contatto reso anonimo), non genera
  notifiche e non ha un titolo. I titoli restavano 42: 36 tipi di evento, i cinque «assegnata» e la menzione. Dalla `v2.3.0`
  hanno un titolo i due tipi di evento che il contratto ha dal 13/10/2026 per i motivi di perdita del CRM:
  `com.zeiras.crm.motivo.creato`, «Nuovo motivo di perdita», e `com.zeiras.crm.motivo.modificato`, «Motivo di perdita
  modificato». Con loro il contratto ha 39 tipi di evento e i titoli erano 44: 38 tipi di evento, i cinque «assegnata» e la
  menzione. Dal 14/10/2026 il contratto ha 40 tipi di evento: il quarantesimo,
  `com.zeiras.crm.campo.modificato` (le impostazioni di un campo del CRM cambiate), non genera notifiche e non ha un
  titolo. I titoli restano 44. Dalla `v2.25.3` ha un titolo anche la notifica che il CRM manda quando un consumo porta
  sotto zero il credito di un pacchetto: «Credito sotto zero: cliente da avvisare». Non è un evento: il suo `tipo` è
  `crm.acquisto.scoperto`, senza `com.zeiras.` davanti, e la chiave del titolo è
  `notificationTitle.crm.acquisto.scoperto`; l'evento `com.zeiras.crm.acquisto.scoperto` non genera notifiche e non ha
  un titolo. Con lei i titoli erano 45: 38 tipi di evento, i cinque «assegnata», la menzione e il credito sotto zero. È
  nel contratto dal 24/10/2026: `app` `crm`, nei `dati` l'`id` dell'acquisto e `persona_id`, il contatto, mai il nome, e
  `risorsa_nome` è il nome della voce del catalogo. Dalla `v2.25.4` hanno un titolo anche le due notifiche delle scadenze
  del CRM: il preavviso di una scadenza, al suo responsabile, «Una scadenza si avvicina» (`crm.scadenza.in_preavviso`), e
  il riepilogo del giorno, quando lo stesso giorno i preavvisi sono più di cinque, «Scadenze in preavviso oggi»
  (`crm.scadenze.riepilogo_del_giorno`). Non sono eventi, e il loro `tipo` non ha `com.zeiras.` davanti. Con loro i
  titoli erano 47: 38 tipi di evento, i cinque «assegnata», la menzione, il credito sotto zero e le due delle scadenze. Il
  24/10/2026 il contratto pubblicato non le ha ancora: i nomi li ha fissati il backoffice, e nei `dati` il preavviso porta
  l'`id` della scadenza e `persona_id` o `organizzazione_id`, il riepilogo il numero. Nella `v2.25.4` un clic su tutte e
  due apre la pagina delle notifiche. Dalla `v3.0.0` il preavviso apre il contatto,
  `https://crm.zeiras.com/w/<slug>/contatti/<persona_id>`, altrimenti l'azienda (`…/aziende/<organizzazione_id>`), altrimenti
  la pagina delle scadenze (`…/scadenze`), e il riepilogo la pagina delle scadenze: l'`id` della scadenza non entra
  nell'indirizzo, perché una scadenza non ha una pagina sua. Dal 24/10/2026 il contratto ha anche i tipi di evento di preventivi,
  acquisti, consumi, rate, pagamenti e catalogo del CRM: nessuno genera notifiche, e nessuno ha un titolo. Dalla
  `v3.2.2` ha un titolo anche la notifica che arriva al responsabile del contatto, o ai proprietari del workspace,
  quando un cliente chiede una modifica dal link di un preventivo: «Un cliente ha chiesto una modifica al preventivo»
  (`crm.preventivo.richiesta`). Non è un evento, e il suo `tipo` non ha `com.zeiras.` davanti; gli eventi dei
  preventivi, compreso `com.zeiras.crm.preventivo.visto`, la prima apertura del link, non generano notifiche. Con lei i
  titoli erano 48: 38 tipi di evento, i cinque «assegnata», la menzione, il credito sotto zero, le due delle scadenze e
  la richiesta sul preventivo. Nei `dati` porta l'`id` del preventivo e `trattativa_id`, l'opportunità o `null`, mai il
  testo del cliente, e non ha chi l'ha fatto. Un clic apre il preventivo,
  `https://crm.zeiras.com/w/<slug>/preventivi/<id>`. Dalla `v3.5.0` ha un titolo anche la notifica che arriva al
  proprietario e agli amministratori quando una persona lascia il workspace e restano schede senza nessun assegnatario:
  «Restano schede senza assegnatario» (`board.schede.senza_assegnatario`). Non è un evento nemmeno lei, e il suo `tipo` non
  ha `com.zeiras.` davanti; chi l'ha fatto è la persona che è uscita («Marta Rossi ha lasciato il workspace: restano schede
  senza assegnatario»). Con lei i titoli erano 49: 38 tipi di evento, i cinque «assegnata», la menzione, il credito sotto
  zero, le due delle scadenze, la richiesta sul preventivo e le schede senza assegnatario. Nei `dati` porta solo il numero
  delle schede, nessun id: un clic apre la pagina delle notifiche. Dalla `v3.6.0` hanno un titolo anche quattro notifiche
  che non sono eventi, col `tipo` senza `com.zeiras.` davanti: di Project Management il promemoria di una To-do,
  «Promemoria: hai una cosa da fare» (`board.todo.promemoria`), e la scheda che scade, con un tipo per giorno: «Una scheda
  scade domani» (`board.scheda.scade_domani`) e «Una scheda scade oggi» (`board.scheda.scade_oggi`); senza prodotto
  l'invito accettato, «Il tuo invito è stato accettato» (`io.invito.accettato`). Le prime tre non hanno chi l'ha fatto, e
  il nome della To-do o della scheda sta sotto il titolo; dell'invito chi l'ha fatto è chi ha accettato («Marta Rossi ha
  accettato il tuo invito»). Con loro e con le tre di Bookings (più sotto) i titoli sono 56. Nessuna delle quattro ha una
  destinazione: un clic apre la pagina delle notifiche. Di che prodotto è lo dice `app`: se è il codice di un prodotto del
  registro, la notifica
  porta il suo nome nella lingua davanti all'ora («Project Management · 5 min fa»), la sua icona e il suo tono, anche se
  il prodotto è «Presto» o non è attivo nel workspace; con `app` `null`, o con un codice che il registro non ha, nessun
  prodotto e l'icona della campanella. Dalla `v1.10.0` una notifica dice anche su che cosa, chi e per chi, quando il
  backoffice lo dice: con `risorsa_nome` ha una seconda riga, sotto il titolo, col nome della cosa («Lancio Q4»), tranne
  quando il nome è già nella frase del titolo (più sotto); con
  `autore_nome` ha, al posto dell'icona, l'avatar con le iniziali di chi ha fatto; e `per_me` dice la scheda: `true` in
  «Per me» e in «Tutte», `false` solo in «Tutte», `null` in tutte e due, perché `null` vuol dire che il backoffice non lo
  sa, non che la notifica è per altri. Un nome vuoto o di soli spazi non si mostra. Per una notifica su un'app (un tipo
  che comincia con `com.zeiras.app.`) `risorsa_nome` è il codice dell'app (`pm`), e la seconda riga porta il nome del
  prodotto, dal registro e nella lingua della persona («Project Management»), mai il codice: con un codice che il
  registro non ha la seconda riga non c'è. Dalla `v1.21.0`, quando il backoffice dice anche chi ha fatto, il nome del
  prodotto sta nella frase del titolo e non nella seconda riga (più sotto).
  Dalla `v1.20.0` le frasi delle notifiche — il titolo di ogni tipo e le due famiglie qui sotto — non stanno più nel JS
  d'ingresso della cornice: stanno in `resources/lingue/notifiche/<codice>.json`, un file per lingua, e la cornice le
  chiede con `fetch` quando si apre la campanella, insieme all'elenco: il file della lingua della persona e quello
  dell'inglese, una volta sola (alla seconda apertura sono in memoria, e si richiede solo l'elenco); chi usa l'inglese
  chiede un file solo. Nella build del
  frontend sono file `.json` con l'impronta nel nome, accanto al JS (restano file anche se il frontend alza `build.assetsInlineLimit`), e la cornice li chiede da dove la pagina prende il
  JS: la CSP di tutti lo lascia fare (`connect-src 'self'`); un frontend che serve la build da un'altra origine
  (`ASSET_URL`) scrive quell'origine anche in `connect-src`, e da lì i file devono arrivare con CORS. Lo stesso vale in sviluppo, se la pagina prende il JS dal server di Vite: è un'altra origine. Finché non arrivano
  il pannello aspetta; se non arrivano — una risposta che non è 200, la rete che cade, dieci secondi senza risposta —
  mostra l'errore di caricamento con «Riprova», che richiede elenco e frasi: mai un elenco di
  titoli di ripiego. Dalla `v2.0.0` è un errore anche un 200 che non porta le frasi — la pagina di un proxy, un file
  vuoto: le frasi sono un oggetto con almeno un testo sotto una chiave `notificationTitle…` —, e a elenco vuoto le frasi
  non servono: il pannello dice che non ci sono notifiche senza aspettarle, anche se non arrivano loro o il pezzo della
  campanella. Dove il browser non ha `AbortSignal.timeout` (Safari prima della 16, Chrome prima della 103, Firefox
  prima della 100) le frasi si chiedono lo stesso, senza il tempo massimo. Dopo un rilascio, una pagina aperta prima chiede i file col nome di prima: se non ci sono più,
  «Riprova» non riesce finché la pagina non si ricarica. Dalla `v2.0.0` ciò che compone le righe arriva in un pezzo di JS a
  parte, quello della campanella, che la cornice chiede con `import()` alla prima apertura della campanella, dalla stessa
  origine del JS: finché non arriva il pannello aspetta, e se non arriva mostra lo stesso errore con «Riprova», senza un
  errore fuori dal pannello. In Chromium (provato il 13/10/2026 con la 151) un `import()` che non è arrivato resta fallito,
  per quell'indirizzo, finché la pagina non si ricarica: per questo, dalla `v2.1.0`, dopo un pezzo non arrivato «Riprova»
  lo chiede allo stesso indirizzo con una coda in più (`?r=1`, poi `?r=2`), e il browser lo richiede. È lo stesso file:
  serve che chi dà la build ignori la coda, come fa di solito un server di file. La coda cambia a ogni tentativo fallito, non a ogni
  richiesta: due richieste fatte insieme chiedono lo stesso indirizzo, che per il browser è una richiesta sola (provato in
  Chromium). Dalla `v2.11.5` fra un tentativo fallito e il successivo c'è un'attesa: dopo l'n-esimo il pezzo non si richiede
  prima di 2^(n−1) secondi dal fallimento (1, 2, 4… e mai più di 60), e nell'attesa chi lo chiede ha subito l'errore di
  prima — per la ricerca, che ha la stessa attesa, il suo avviso. «Riprova», che la persona preme, non aspetta; la
  campanella aperta di nuovo sì. Le richieste fatte insieme sono una sola per il browser, e dalla `v2.13.0` lo sono anche
  per l'attesa e per la coda: con k richieste partite mentre il pezzo è in viaggio, se il pezzo non arriva, è un tentativo
  fallito solo — il primo fuoco nel campo della ricerca e la prima parola, che lo chiedono insieme, aspettano poi 1 secondo,
  e la richiesta dopo ha la coda `?r=1`. Fino alla `v2.12` ognuna contava come un tentativo fallito: l'attesa dopo era
  quella di k tentativi falliti in più, e la coda saltava k−1 numeri. Dalla `v2.5.1` l'indirizzo non si legge più dall'errore del browser: è il nome che la build ha scritto nel JS
  della cornice, là dove lei importa il pezzo, risolto sull'indirizzo di quel JS. In `import()` entra solo il pezzo della
  campanella, qualunque cosa dica l'errore, e «Riprova» lo richiede anche se l'indirizzo del JS d'ingresso ha una coda sua
  (`app.js?v=3`) e in un frontend che mette i pezzi a richiesta in un'altra cartella rispetto al JS d'ingresso, anche una
  cartella dentro quella (provato in Chromium 151 su due build delle pagine di prova: `ZR_PEZZI_ALTROVE=1 npm run demo`,
  col pezzo in `assets/pezzi/`, e `ZR_INGRESSO_CON_CODA=1 npm run demo`, con la cornice nel JS d'ingresso chiesto con
  `?v=3`). Con una coda sull'ingresso il pezzo, che importa
  il JS della cornice col suo nome, lo chiede senza quella coda, anche al primo colpo: per il browser è un altro indirizzo,
  e lo scarica una seconda volta, e lo esegue una seconda volta. Se quel JS è anche quello che monta la pagina, la pagina
  si monta di nuovo: alla prima apertura la campanella si richiude e ciò che la persona aveva scritto si perde, e il
  pannello si apre al secondo clic (è di quel modo di servire, non di «Riprova»: il JS che contiene la cornice non si
  serve con una coda, e il nome con l'impronta che la build gli dà basta). Lì, dopo un «Riprova», la pagina si monta di
  nuovo allo stesso modo, e riaprendo la campanella il pannello mostra ancora l'errore: le righe arrivano con un secondo
  «Riprova». Due casi restano come sono: se l'indirizzo del
  JS della cornice non ha un percorso (`blob:`, `data:`) «Riprova» non richiede il pezzo, e a un nome che la build scrive
  già con una coda quella di «Riprova» si aggiunge com'è (`x.js?v=1?r=1`). Dove la build non scrive il nome del pezzo fra
  virgolette dentro `import(`, «Riprova» richiama `import()` come prima, allo stesso indirizzo. Il titolo di ripiego (`notificationTitle`) resta nel file dei
  testi. Se la lingua della persona
  cambia con l'elenco in pagina, i titoli passano alla lingua nuova quando le sue frasi sono arrivate; finché il pannello
  le aspetta, o se non arrivano, «Segna tutte come lette» non c'è. A pannello chiuso le frasi della lingua nuova non si
  chiedono: le chiede la prossima apertura, con l'elenco, e intanto la campanella tiene il suo numero.
  Nei test del frontend quei file non li serve nessuno, e un caso che apre la campanella troverebbe l'errore al posto
  dell'elenco: una riga nel file di preparazione dei test, `beforeAll(() => frasiInMemoria())`, con `frasiInMemoria`
  che sta in `vendor/zeiras/zr-core/resources/js/prove.ts`, mette le frasi in memoria alla cornice, come a una seconda
  apertura. Dalla `v2.0.0` le dà anche il pezzo della campanella, e la riga resta quella. `prove` è per i test: non è un ingresso per le pagine. Un caso che rifà i moduli (`vi.resetModules()`)
  la richiama dopo aver importato di nuovo la cornice: le frasi stanno in memoria nel modulo che le carica, e un modulo
  rifatto riparte senza. Anche `frasiInMemoria` si prende con un import nuovo, dopo `vi.resetModules()`: quella importata
  in cima al file mette le frasi nel modulo di prima. In un caso, dopo `vi.resetModules()`:
  `const { frasiInMemoria } = await import('../../vendor/zeiras/zr-core/resources/js/prove'); await frasiInMemoria();`
  Mentre carica risponde solo per i file delle frasi: ogni altra richiesta passa al `fetch` che c'era (dalla `v1.21.0`;
  prima a ogni indirizzo rispondeva lei, con un oggetto vuoto).
  Una notifica dice chi ha fatto che cosa, in una frase al posto del titolo («Marta Rossi ha modificato la scheda
  «Lancio Q4»»): quelle di Project Management dalla `v1.19.0`, quelle del CRM, del workspace e dei moduli dalla
  `v1.21.0`. Per questo le lingue hanno due famiglie di chiavi in più: `notificationTitleWhoWhat.<tipo>`, coi
  segnaposto `{who}` e `{what}`, e `notificationTitleWho.<tipo>`, col solo `{who}` («Marta Rossi ha eliminato una
  scheda»). La seconda la hanno tutti i cinquanta tipi che hanno un titolo, fuori dai tre di Bookings, che non dicono chi, e dal
  promemoria di una To-do e dalle due scadenze di una scheda, che non hanno chi; la prima ventotto: i quattordici di
  Project Management che non sono una cosa eliminata, del CRM le aziende, le opportunità, le attività e le pipeline
  create o modificate e le aziende, le opportunità e le attività assegnate, il workspace creato e modificato, e il
  modulo attivato o disattivato. Le aziende, le opportunità e le attività del CRM la hanno dalla `v1.22.0` («Marta
  Rossi ha modificato l'azienda «Acme»»), quelle assegnate dalla `v2.1.0` («Marta Rossi ti ha assegnato l'azienda
  «Acme»»). Gli altri hanno solo la seconda. Di una cosa eliminata, di un membro del workspace, e del CRM di un
  contatto e di una nota il backoffice non dà il nome (quello di un contatto è un dato personale): per questo un
  contatto assegnato resta «Marta Rossi ti ha assegnato un contatto», e un'azienda assegnata di cui il nome non
  arriva «Marta Rossi ti ha assegnato un'azienda». Per un modulo c'è una
  differenza: di un modulo il backoffice dà il codice (`pm`), e nella frase c'è il
  nome nella lingua della persona; con un codice che il registro non ha resta la frase con solo chi. E quando una
  persona entra nel workspace chi ha fatto, per il contratto, è lei: la frase è «Marta Rossi è ora nel workspace».
  La frase si sceglie scendendo: con `autore_nome` e il nome della cosa il titolo è la frase con chi e che cosa; con
  `autore_nome` e senza il nome, o per un tipo che ha solo quella, è la frase con solo chi; senza `autore_nome`, o
  per un tipo che zr-core non conosce, resta il titolo di prima col nome sotto. Il nome della cosa sta una volta
  sola: quando è nella frase non è nella seconda riga.
  Dalla `v3.6.0` una notifica può dire anche quando accade la cosa (`quando`, vedi «Le rotte della cornice»), e la
  data la scrive la cornice, nel fuso di `quando` e nella lingua della persona. Le notifiche con la data non hanno chi:
  il preavviso di una scadenza del CRM, e le tre di Bookings — un ospite ha prenotato, spostato o annullato
  (`bookings.prenotazione.creata`, `….spostata`, `….annullata`, senza `com.zeiras.` davanti), e dell'ospite, che non è
  un membro, il backoffice non dà il nome. Col nome della cosa hanno la frase `notificationTitleWhatWhen.<tipo>`, coi
  segnaposto `{what}` e la data: al posto di `{date}` il solo giorno («Certificato medico scade il 3 novembre 2026»), al
  posto di `{when}` il giorno e l'ora («Nuova prenotazione: Personal training, mer 4 nov, 10:00», col nome del servizio
  prenotato). Senza il nome della cosa le tre di Bookings hanno la frase `notificationTitleWhen.<tipo>`, col solo
  `{when}` («Nuova prenotazione, mer 4 nov, 10:00»), che la cornice prova prima di quella con solo chi: con la data il
  titolo non dice chi. Senza un `quando` che la cornice sa scrivere — `null`, a metà, o con un fuso che il browser non
  conosce — il titolo è quello del tipo, col nome della cosa sotto. Le tre di Bookings aprono la prenotazione,
  `/prenotazioni/{id}`.
  Dalla `v2.1.0`, quando sotto il titolo non c'è il nome della cosa, la seconda riga dice quante azioni la notifica
  racconta e in quale board sta la cosa: «3 volte, nella board «Lancio»» (`notificationUnder.countBoard`, coi segnaposto
  `{n}` e `{board}`), «3 volte» senza board (`notificationUnder.count`), «Nella board «Lancio»» con una sola azione
  (`notificationUnder.board`); con una sola azione e senza board la seconda riga non c'è. Il conto si scrive da due in
  su. Il nome della board è pulito e isolato come gli altri due nomi; un nome che pulito è vuoto è una board che manca.
  Quando sotto il titolo c'è il nome della cosa — il titolo di prima, o la frase con solo chi — resta il nome. Le tre
  frasi stanno nel file delle frasi delle notifiche, e arrivano con loro.
  Dalla `v1.20.0` i due nomi, che ha scritto una persona, sono difesi prima di entrare in pagina. Restano testo: mai
  HTML, e un segnaposto o un `$&` scritto dentro un nome non è un comando. Sono puliti: senza i caratteri che cambiano
  la direzione del testo, e con a capo, tabulazioni e gli altri caratteri di controllo ridotti a uno spazio; un nome
  che pulito è vuoto vale come un nome che manca, e l'avatar dice lo stesso nome pulito. E nella frase ognuno sta fra
  U+2068 e U+2069, i due caratteri che lo isolano dalla direzione del testo intorno: chi confronta un titolo con un
  testo scritto a mano li conti. Dalla `v2.0.0` il nome di chi ha fatto, nel titolo, oltre i 60 caratteri è tagliato:
  i primi 59 e «…». Si conta dopo la pulizia, per caratteri come li vede chi legge (`Intl.Segmenter`): un'emoji o una
  lettera con l'accento composto valgono uno e non si spezzano; dove `Intl.Segmenter` manca si conta per punti di
  codice, e lì un'emoji composta o un accento composto possono restare a metà (`Intl.Segmenter` manca in Firefox prima
  della 125, in Safari prima della 14.1 e in Chrome prima della 87). Se il taglio cade dopo uno spazio, prima del segno
  lo spazio non resta. L'avatar dice il nome intero, e il nome
  della cosa resta intero dovunque stia. Il resto è del backoffice: i caratteri di controllo, di direzione del testo e
  a larghezza zero li rifiuta alla scrittura (dal 13/10/2026: `422`, regola `carattere_non_ammesso`), e la lunghezza
  massima è quella di ogni campo nel contratto (`maxLength`); il nome che dice un provider d'accesso non lo rifiuta: lo
  pulisce. Dalla `v2.0.0` vale come un nome che manca anche un nome fatto solo di caratteri che non si vedono — a
  larghezza zero o riempitivi: U+200B, U+2060, U+00AD, U+3164, U+2800 —, anche misti a spazi: il titolo è senza chi,
  con l'icona al posto dell'avatar. In testa a un nome si tolgono, come gli spazi; da dentro e dalla coda no: U+200D
  tiene insieme un'emoji composta.
  Finché il backoffice non manda i tre dati il pannello resta com'era — il solo
  titolo, l'icona, ogni notifica in tutte e due le schede —, e anche dopo `per_me` è `null` finché il backoffice non
  conosce il destinatario diretto di una notifica: fino ad allora «Per me» e «Tutte» mostrano le stesse notifiche. Se il
  caricamento fallisce, l'errore e «Riprova».
  «Segna tutte come lette» manda una richiesta sola, `POST /cornice/notifiche/letture` con `{fino_a, workspace}` — la
  `creata_il` più recente fra le notifiche caricate, così com'è, e lo slug del workspace dei dati con cui il pannello le ha
  caricate; e dalla `v2.5.0` l'email di chi la cornice mostra (`persona`), che dalla `v2.6.0` non è più nel corpo: sta nell'intestazione `Persona` — e il gettone CSRF del cookie `XSRF-TOKEN` (lo mette Laravel nel gruppo `web`) nell'header `X-XSRF-TOKEN`:
  segna lette le notifiche della persona nate fino a lì, anche quelle oltre la prima
  pagina, e non quelle arrivate dopo, mai viste. Alla risposta le notifiche caricate sono lette e la campanella non ha più
  un numero, fino alla prossima visita che porta dati letti dopo (vedi «La campanella»), col numero del backoffice; se la
  richiesta fallisce, nel pannello non
  cambia niente e il pulsante resta per riprovare. Il backoffice ne segna 5000 per chiamata, e la parte server lo richiama
  finché ne restano, entro i due tetti della rotta: con più di 25.000 non lette, o passati 10 secondi dall'arrivo della
  richiesta, un clic non le segna tutte. Allora la risposta dice `altre: true`, e la cornice non fa finta che siano tutte lette: la
  campanella tiene il numero dei dati, il pannello si ricarica e «Segna tutte come lette» resta, per continuare con un
  altro clic. Mentre il pannello si ricarica l'elenco di prima resta in pagina e il pulsante resta dov'è, col fuoco della
  tastiera. Che cosa sta succedendo lo dice il pulsante, col testo che zr-core gli dà al posto di quello dell'`AppShell`
  (dalla `v1.7.0`). Dal clic alla risposta, che con migliaia di non lette può arrivare dopo circa 15 secondi, dice
  «Segno…», e un clic lì non fa partire un'altra richiesta. Dopo una risposta con `altre: true` dice «Segna le altre»: una
  parte è segnata, anche quando l'elenco ricaricato è uguale a prima perché le segnate non erano fra quelle in pagina. Lo
  dice finché quel giro di letture non è finito — con una lettura completa, con l'elenco chiesto da capo (il pannello
  riaperto, «Riprova»), o quando dei dati letti dopo quella risposta non contano più non lette: il giro è finito altrove, in
  un'altra scheda —, poi torna «Segna tutte come lette». Senza `non_lette` nei dati questa terza uscita non c'è. Se la
  richiesta fallisce il pulsante torna al testo che aveva prima del clic. I due testi sono di zr-core, `markingAllRead`
  e `markRestRead` nelle sue lingue: in una lingua che zr-core non ha sono in inglese. Una cosa la cornice ancora non la
  dice: l'avviso per il lettore di schermo. Il
  testo del pulsante cambia sullo schermo, ma niente lo annuncia: il pannello del design system non ha un posto per un
  avviso. Se una chiamata al backoffice dura più di quanto zr-auth aspetta ogni risposta (5 secondi, se il frontend non
  ha cambiato quel tempo) la richiesta fallisce e il pannello resta com'era, anche se il backoffice può averne segnate — il
  pannello le ricarica alla prossima apertura della campanella — e riprovare non fa danni, perché il metodo ripetuto non
  cambia niente. Un limite, che non è solo di questa rotta: ogni richiesta, quando finisce, riscrive la sessione com'era
  quando è partita e ne rimanda il cookie (lo fa Laravel). Vale per ogni richiesta della stessa sessione ancora in corso
  quando la persona, da un'altra scheda, esce, entra in un altro workspace o cambia lingua, non solo per una lenta:
  finendo dopo, rimette la sessione di prima — dopo un cambio di workspace la persona si ritrova in quello di prima; dopo
  un'uscita torna la sessione coi gettoni di prima: se l'uscita li ha chiusi nel backoffice, la prima chiamata la
  richiude; se all'uscita il backoffice non ha risposto — la sessione si chiude lo stesso — possono valere ancora, fino
  alla loro scadenza. Dalla `v2.16.0` zr-core chiede zr-auth dalla 0.12.31, dove l'ingresso, il cambio di workspace e
  l'uscita segnano chiusa la sessione di prima, e una richiesta partita con quella non la rimette in vita: per loro il
  limite è chiuso, alle quattro condizioni che «La cornice in due dati» dice; resta per il cambio di lingua. «Segna tutte come lette» è la richiesta della cornice che dura di più — fino a circa 15 secondi,
  solo con più di 5000 non lette — e dalla `v1.6.0` tiene il blocco della sessione di Laravel (`Route::block`) per tutta
  la sua durata. Il blocco ferma solo chi lo prende: il frontend mette `->bloccaSessione()` di zr-auth sulle sue rotte che
  aprono, cambiano o chiudono la sessione — quelle che chiamano `Sessione::apri()`, `Sessione::entra()` o
  `Sessione::chiudi()`: non solo l'uscita e l'ingresso in un workspace — e sulle sue rotte lente, non su tutte (non su
  quella della richiesta rimandata della cornice in due dati, salvo la pagina che è anche la rotta di `entra()`: vedi lì): è il
  criterio di zr-auth (il suo README, «Il blocco della sessione»; il ricevitore dell'ingresso di zr-auth lo ha già); messo
  da una parte sola non ferma niente. Con le due parti, le richieste non si sovrappongono: la seconda aspetta la prima al più 3 secondi, e
  oltre risponde 503 con `Retry-After: 1` — un'uscita mentre «Segna tutte come lette» gira, o «Segna tutte come lette»
  mentre un'uscita gira: allora nel pannello non cambia niente e il pulsante resta per riprovare. L'elenco delle
  notifiche, la ricerca e le chiamate del modulo restano senza blocco — tranne le rotte lente su cui il modulo lo mette —,
  perché due richieste della stessa persona si metterebbero in fila: per loro il limite resta.
  Il blocco si prende prima dei middleware che il frontend ha nel gruppo `web`, e dura 20 secondi da lì, coi tempi di
  partenza: i 10 dei richiami, i 5 che zr-auth aspetta una risposta, 5 di margine. Per questo la rotta conta i suoi 10
  secondi dall'arrivo della richiesta, non da quando tocca a lei: ciò che un middleware del frontend fa prima — una
  `Cornice::dati()`, con un backoffice lento — sta dentro il blocco, e una richiesta che arriva alla rotta oltre quei 10
  secondi riceve 503 `{errore: "fuori_tempo"}` senza che il backoffice sia chiamato. Dopo la risposta della rotta restano
  almeno i 5 secondi di margine per chiudere la richiesta, se alla rotta si arriva entro 15 secondi dall'arrivo; fra 15 e
  20 il margine è ciò che resta del blocco, e una richiesta che i middleware del frontend tengono più di 20 secondi prima
  della rotta ci arriva a blocco scaduto: riceve il 503 `fuori_tempo`, ma finendo riscrive la sessione lo stesso — per lei
  il limite resta. Con `zr-auth.timeout` minore di 1 la rotta non parte, ed è un errore
  (500): per il client di zr-auth 0 vuol dire senza limite, e una chiamata senza un tetto può durare più di qualunque
  blocco. Il lock sta nello store `session.block_store` del frontend — quello della cache, se non lo cambia —, che deve
  saper fare i lock (Redis, database, file; `array` nei test): con uno store che non li fa la rotta risponde 500 a ogni
  clic, e con lo store `null` il lock è finto e il limite resta. La durata del blocco si calcola quando le rotte si
  registrano: un frontend che tiene le rotte in cache le rifà dopo aver cambiato `zr-auth.timeout`. Chi aspetta dietro
  un ingresso: una «Segna tutte come lette» che aspetta il blocco di un ingresso in un workspace riparte, dopo l'attesa,
  da una sessione vuota — risponde 401, come a una persona non entrata, e può rimandare il cookie con l'id di prima, che
  nel browser prende il posto di quello nuovo: la persona si ritrova fuori. È il limite che il README di zr-auth dice in
  «Chi aspetta dietro un ingresso»: la pagina, dopo un ingresso, si ricarica dalla scheda in cui si è entrati.
  Allo stesso modo tornano la lingua e il nome di prima, se la cornice li aveva aggiornati
  mentre un'altra richiesta della stessa sessione girava: basta che sia cominciata prima e finita dopo, anche non lenta (le
  notifiche, la ricerca, una chiamata del modulo). I dati della cornice restano giusti; alla visita dopo ciò che il frontend
  legge dalla sessione prima di `Cornice::dati()` è ancora quello di prima, e quella lettura li rimette. Il pulsante c'è
  quando la campanella ha un numero e il pannello ha caricato almeno una notifica, anche se quelle caricate sono già lette;
  dalla `v1.13.0` non c'è quando la parte server dice che l'elenco è di un altro workspace rispetto ai dati della pagina
  (`workspace`, nella risposta di `GET /cornice/notifiche`): con due schede su due workspace, da lì la rotta risponde 409
  `workspace_diverso` e non segna niente. Se la risposta dell'elenco non dice di quale workspace è, il pulsante c'è come
  prima: il controllo resta della parte server.
  Dalla `v1.14.0` non c'è nemmeno quando l'elenco è stato chiesto coi dati di un workspace, la parte server lo dice di un
  altro e poi i dati della pagina passano a quell'altro senza che la cornice si rifaccia: il clic manderebbe lo slug dei dati
  di prima. Succede solo con `Cornice` usata da sola (`LayoutDellaCornice` la rifà a ogni cambio di workspace), e il pulsante
  torna con l'elenco chiesto coi dati di adesso, alla prossima apertura del pannello.
  Dalla `v1.11.0` un clic su una notifica apre la sua risorsa, nel modulo da cui viene e, dalla `v1.12.0`, nel workspace
  dell'elenco: una
  notifica di un contatto del CRM apre `https://crm.zeiras.com/w/<slug>/contatti/<id>`, una di una pipeline le sue
  impostazioni, una di un'azienda l'elenco delle aziende col suo pannello
  aperto (`https://crm.zeiras.com/w/<slug>/aziende/<id>`). Dalla `v1.13.0` una di un'opportunità — nuova, modificata o
  assegnata — apre `https://crm.zeiras.com/w/<slug>/opportunita/<id>`, un contatto o un'azienda assegnati la loro pagina,
  e una di un'attività — nuova, modificata, eliminata o assegnata — la pagina «Da fare»
  (`https://crm.zeiras.com/w/<slug>/da-fare`), senza un id: un'attività non ha una pagina sua. Di opportunità e attività
  oggi arrivano solo le «assegnata» (più sopra). Dalla `v1.14.0` una di una scheda di Project Management — nuova,
  modificata o assegnata — apre la scheda, `https://board.zeiras.com/w/<slug>/c/<id>`; una di una scheda eliminata no:
  la sua pagina non c'è più. Dalla `v1.16.0` una menzione in un commento apre la scheda del commento, allo stesso
  indirizzo: l'id è quello della scheda, e `commento_id` non entra nell'indirizzo, perché Project Management non ha una
  pagina che porti dritto a un commento. Dalla `v3.6.1` la scadenza di una scheda, domani e oggi, apre la scheda allo
  stesso indirizzo, il promemoria di una To-do apre la To-do, `https://board.zeiras.com/w/<slug>/todo?todo=<id>`, e
  l'invito accettato, che non è di un'app, apre Impostazioni › Membri della Dashboard,
  `https://app.zeiras.com/w/<slug>/impostazioni/membri`. Dalla `v2.25.3` il credito di un pacchetto sotto zero apre il contatto,
  `https://crm.zeiras.com/w/<slug>/contatti/<persona_id>`: l'id dell'acquisto non entra nell'indirizzo, perché un
  acquisto non ha una pagina sua. Una nota apre la cosa più
  specifica a cui è attaccata: l'opportunità se ne ha una, altrimenti il contatto, altrimenti l'azienda (fino alla
  `v1.12.0` apriva solo il contatto, e senza quello la pagina delle notifiche). Dove si apre ogni tipo lo dice il registro (dalla
  `v3.0.0` le righe di `resources/registro/notifiche.json`, più sotto), e gli id sono quelli di `ids`: la regola è
  `destinazioneDellaNotifica`, che chi mostra le notifiche in una pagina sua importa da `…/resources/js/frasi` (dalla
  `v3.0.0`: prima dall'ingresso, vedi «Passare alla v3»). Un id non è un permesso: chi riceve la notifica può non
  poter vedere quella risorsa, la cornice non lo controlla, e lo decide il modulo che apre la pagina. Il workspace
  dell'elenco lo dice la parte server (`workspace`, nella risposta di `GET /cornice/notifiche`), perché non è sempre
  quello della pagina: la sessione ha un workspace solo: con due schede su due workspace, la scheda rimasta indietro
  riceve le notifiche di quello in cui la persona è entrata per ultimo, e fino alla `v1.11.0` ne apriva la risorsa nel
  proprio, dove non c'è. Se l'elenco è del workspace dei dati della pagina decide lo stato dei moduli nei dati, come
  prima; se è di un altro, quello stato non decide — è di un altro workspace — e la risorsa si apre: se lì il modulo non
  è attivo lo dice il modulo, come quando lo si apre dal menu (un modulo «Presto» nel registro resta senza
  destinazione); se la risposta non dice il workspace, o lo dice senza la forma di uno slug, il clic apre la pagina delle
  notifiche: così fa anche una parte server finta, nei test di un frontend, che risponde senza `workspace`. Una notifica che
  non ha dove andare apre
  `https://app.zeiras.com/notifiche`, come «Vedi tutte»: il suo tipo non è nel registro (dalla `v1.13.0` ci sono diciotto
  tipi del CRM: quelli di contatti, pipeline, note e aziende, e quelli di opportunità, attività e i quattro «assegnata»;
  dalla `v1.14.0` tre di Project Management: una scheda nuova, modificata o assegnata; una scheda eliminata e gli altri
  tipi di Project Management — board, liste, aree, etichette, viste — non hanno una destinazione; dalla `v1.16.0` ne
  ha una anche una menzione in un commento; i due tipi dei motivi di perdita del CRM, che hanno un titolo dalla `v2.3.0`,
  dalla `v2.7.0` ne hanno una: aprono le Impostazioni del CRM (`https://crm.zeiras.com/w/<slug>/impostazioni`), dove i motivi
  stanno, senza un id; un altro tipo dei motivi di perdita, che il registro non ha, resta senza; dalla `v2.25.3` ne ha
  una il credito di un pacchetto sotto zero, che apre il contatto), le mancano gli id di ogni percorso del suo tipo, o il
  modulo in quel
  workspace non si può aprire («Presto», o né `attivo` né
  `disponibile`). L'indirizzo passa da `naviga`, come gli altri che la cornice apre.
  Dalla `v1.12.0` il clic che apre la risorsa di una notifica non letta la segna letta: la cornice chiede
  `PATCH /cornice/notifiche/<id>/lettura` con `{"letta": true}`, col gettone CSRF e con `keepalive`, perché la pagina
  sta cambiando. Dalla `v2.14.0` il clic aspetta la lettura a ogni età della pagina, e la risorsa si apre alla risposta
  (fino alla `v2.13` si apriva senza aspettarla, salvo su una pagina caricata da meno di 30 secondi, dove dalla `v2.11.5`
  il clic la aspettava: più sotto, «La cornice in due dati»). La funzione che lo fa, `segnaLetta`, è della cornice
  e l'ingresso non la esporta: un frontend che segna letta una notifica da una pagina sua chiama la rotta. Se l'id
  della notifica non ha la forma che la rotta vuole (lettere, cifre, `-` e `_`, 64 al più) la richiesta non parte, e
  dalla `v2.14.0` la risorsa non si apre (fino alla `v2.13` si apriva lo stesso). Dalla `v2.14.0` la risorsa si apre solo se
  la lettura riesce, cioè se la rotta risponde `letta: true`: su un errore — la rete, un 5xx, un 429, un 403, una risposta
  senza `letta: true` — non si apre niente, anche quando l'errore è della persona a schermo, perché nel browser un 5xx
  della rotta non si distingue da quello di un proxy davanti a lei. La notifica resta da leggere, e un altro clic chiede di
  nuovo la lettura. A schermo niente dice che il clic non è andato: l'`AppShell` chiude il pannello al clic, e la cornice
  non ha un posto per dirlo (né un testo nuovo, che l'ingresso non ha lo spazio per portare). Il 403
  `accettazione_richiesta` porta come sempre alla cornice ridotta. Fino alla `v2.13` un errore della persona a schermo
  apriva la risorsa lo stesso. Dalla `v2.14.0` anche il clic su una notifica già letta che ha una destinazione chiede la
  lettura, con la stessa `PATCH` e `{"letta": true}`, e la apre solo alla risposta: così una scheda rimasta aperta non la
  apre con la sessione di un'altra persona entrata altrove. È una chiamata al backoffice in più per ogni clic su una già
  letta; segnarla letta di nuovo non cambia niente, e il numero sulla campanella non scende (fino alla `v2.13` una già
  letta si apriva senza chiedere niente). Una notifica il cui clic apre la pagina delle notifiche non chiede niente. Il numero sulla campanella scende di uno quando la
  parte server risponde `letta: true`, non al clic, e solo per i dati che la pagina aveva al clic: dei dati letti dopo
  il clic non si può sapere se la contano già letta — il loro segno è preso prima della lettura dal backoffice,
  `segnata_il` dopo la sua risposta —, e vale il loro numero: al più una in più fino alla visita dopo, mai una in meno.
  Dalla `v1.13.0` scende solo se l'elenco in pagina al clic non era più vecchio dei dati del clic: se la pagina ha avuto
  dati nuovi dopo aver letto l'elenco — il pannello è rimasto aperto mentre i dati cambiavano —, la notifica può essere
  stata letta altrove nel mezzo e quei dati la possono contare già letta; lì non si sa, e vale il loro numero (fino alla
  `v1.12.0` scendeva lo stesso, e poteva togliere uno di troppo). L'elenco non è più vecchio dei dati quando il suo
  `aggiornati_il` non viene prima del loro; se uno dei due segni manca, solo quando è stato chiesto con quello stesso
  oggetto `dati`: un test che ridà alla `Cornice` un oggetto `dati` nuovo fra l'elenco e il clic non vede scendere il
  numero.
  Con due schede su due workspace la lettura parte lo stesso, ma il numero dei
  dati della pagina non scende: quella notifica non è fra le sue. Se la lettura fallisce
  in pagina non cambia niente: la notifica resta da leggere, e il numero com'era (fino alla `v2.13` la risorsa si apriva lo
  stesso). La risposta di un'altra persona a una scheda rimasta ferma ricarica la pagina («Le rotte della cornice»). Con
  `window.location.assign` (il `naviga` di partenza) la pagina se ne va alla risposta, e il numero nuovo arriva coi dati della pagina dopo (fino alla `v2.13` la destinazione
  poteva arrivare prima della risposta, e la pagina dopo, se leggeva i dati prima che il backoffice avesse segnato la notifica,
  la contava ancora fino alla visita successiva). Resta in pagina con un `naviga` che non la ricarica, come la visita di Inertia dentro lo stesso modulo. A chi usa
  un lettore di schermo il numero nuovo lo dice un avviso che non si vede (`role="status"`, con la classe
  `zr-visually-hidden`), accanto all'`AppShell`, che non ha un posto per dirlo: vuoto al caricamento, dice il nome della
  campanella col numero nuovo («Notifiche, 2 non lette», «Notifiche, 1 non letta») e a zero il testo `unreadNone` di
  zr-core («Nessuna notifica non letta»), nelle sue lingue. Il numero è quello vero anche oltre 99, dove la campanella
  scrive «99+». L'avviso parla solo per il numero che scende con un clic: quando il numero cambia per un altro motivo
  (dati nuovi, un elenco arrivato, «Segna tutte come lette») non lo dice, e ciò che aveva detto si toglie. La `Cornice`
  rende quindi due elementi, l'`AppShell` e dopo di lui l'avviso, che è fuori dal flusso della pagina.
  Per i test di un frontend che passa alla `v1.12.0` cambiano cinque cose: tre sono delle notifiche, e sono quelle che
  seguono; due sono della ricerca, e stanno nel punto «La ricerca», qui sotto (senza `workspace` in una risposta finta di
  `POST /cornice/ricerca` la ricerca mostra il suo errore, e il segnaposto e l'aiuto del campo hanno testi nuovi). Una
  risposta finta di `GET /cornice/notifiche` senza `workspace` manda ogni clic alla pagina delle notifiche: le si
  aggiunge `workspace`, con lo slug dei dati della pagina. Un clic su una notifica non letta che apre la sua risorsa fa
  partire una richiesta in più, la `PATCH` della lettura: una parte server finta che non la aspetta la vede arrivare. E
  chi conta i figli del contenitore della `Cornice`, o ne prende l'unico, ne trova due: vale anche per una regola CSS sui
  figli del contenitore. Si trovano cercando `cornice/notifiche` e `<Cornice` nei test del frontend; le due della ricerca cercando `cornice/ricerca` e i testi di prima, che il suo punto elenca.
  Per i test di un frontend che passa alla `v2.14.0` cambiano due cose. Un clic su una notifica che ha una destinazione,
  anche già letta, apre solo se la `PATCH` finta della lettura risponde `{"data": {"letta": true}}`: una parte server finta
  che risponde altro, o non risponde, non vede aprire niente. E l'apertura arriva dopo la risposta, non nello stesso giro
  del clic: chi guarda `naviga` subito dopo il clic aspetta prima la risposta finta. Si trovano cercando `/lettura` e
  `cornice/notifiche` nei test del frontend.
- **La ricerca** (Ctrl/Cmd+K) chiede `POST /cornice/ricerca` dal secondo carattere, 300 ms dopo l'ultimo tasto, con la parola
  nel corpo (`{q}`) e il gettone CSRF del cookie `XSRF-TOKEN` nell'header `X-XSRF-TOKEN`, come «Segna tutte come lette»: dalla
  `v1.8.0` ciò che la persona cerca non sta più nell'indirizzo della richiesta del browser. Nel codice del frontend non cambia
  niente; un suo test che chiama la GET passa alla POST. Dalla `v1.15.0` anche il tratto dal server del modulo al backoffice
  porta la parola nel corpo: la parte server chiama `ricerca.crea`, una POST, e l'indirizzo di quella richiesta non porta
  query. Per i test di un frontend che passa alla `v1.15.0` cambiano due cose: un backoffice finto che risponde alla ricerca
  la riceve come `POST /v1/ricerca` con la parola nel corpo (`{q}`), non più come GET con `q` nell'indirizzo (il
  `BackofficeFinto` di zr-auth risponde alla ricerca dalla `v0.12.18`); e ogni risultato di `POST /cornice/ricerca` ha
  `contesto`, che un caso che confronta la risposta intera aggiunge. Cambiano anche il segnaposto e l'invito del campo, che non sono più i due
  testi fissi di prima (più sotto). Una parola nuova annulla la richiesta di prima, e una risposta arrivata tardi non
  sostituisce mai quella dell'ultima parola. Fa eccezione il `429` del freno, che è della persona e non di una richiesta:
  dalla `v1.17.0` anche quello di una richiesta che non è più l'ultima annulla la ricerca in volo e mette l'errore al posto
  dei suoi risultati (nella `v1.16.0` armava il freno senza mostrare l'errore). In un browser una richiesta annullata non
  risponde, e il caso non si dà; si dà nei test di un frontend, con una `fetch` finta che non guarda l'annullo.
  Dalla `v2.8.0` il codice della ricerca — la richiesta, ciò che si fa della risposta, la riga di un risultato — è un pezzo
  a richiesta, fuori dal JS d'ingresso: la cornice lo chiede con `import()` al primo fuoco nel campo della ricerca, o alla
  prima parola se il fuoco nel campo non c'è stato, mai quando si monta. Chi scrive prima che il pezzo sia arrivato vede
  «Sto cercando…», e all'arrivo parte una richiesta sola, con l'ultima parola che il campo ha dato alla cornice: quella che
  c'era 300 ms dopo l'ultimo tasto. Una lettera battuta in quei 300 ms parte al loro scadere, come ogni parola scritta mentre
  una ricerca è in volo: annulla la richiesta di prima, e i risultati sono di ciò che è nel campo. Una cornice smontata
  prima dell'arrivo — il layout la rifà quando cambia il workspace, anche con la stessa persona — non cerca più la parola
  scritta in lei, e all'arrivo non parte niente (dalla `v2.11.2`). Se il pezzo non arriva —
  la rete che cade, un file che una build nuova ha tolto — sotto il campo c'è l'errore della ricerca, lo stesso avviso di
  una rotta che fallisce: non un caricamento che non finisce e non «Nessun risultato», e nessuna richiesta parte. Si riprova scrivendo: ogni parola dopo richiede il pezzo, anche la stessa riscritta, passata
  l'attesa che dalla `v2.11.5` segue un pezzo non arrivato (nell'attesa la parola non lo richiede, e sotto il campo resta
  l'avviso), e in Chromium lo richiede davvero, all'indirizzo
  che la build ha scritto e con una coda, come «Riprova» per la campanella (vedi «Le notifiche»); arrivato, si cerca ciò che
  è nel campo. Un pezzo non arrivato non accende il freno del `429`: fra una richiesta del pezzo e l'altra c'è solo l'attesa del
  pezzo (fino alla `v2.11.4` nessuna: ne partiva una per ogni parola scritta e per ogni fuoco nel campo, al ritmo di chi
  scrive). Un file che una build nuova ha
  tolto non arriva nemmeno riscrivendo: lì la pagina va ricaricata. Per questo pezzo vale ciò che «Le notifiche» dice di
  quello della campanella: il JS che contiene la cornice non si serve con una coda (`app.js?v=3`). Il pezzo lo importa col suo
  nome, senza la coda, e il browser lo scarica e lo esegue una seconda volta: se è anche il JS che monta la pagina, al primo
  fuoco nel campo della ricerca la pagina si monta di nuovo, il fuoco si perde e ciò che si scrive subito dopo non entra nel
  campo (visto in Chromium 151 sulla build `ZR_INGRESSO_CON_CODA=1 npm run demo`). Se non è il JS che monta la pagina,
  dalla `v2.16.0` la ricerca arriva: il pezzo riceve dalla cornice chi è a schermo e la funzione che chiama la parte server,
  e non li prende dalla seconda copia del codice delle richieste per la cornice, dove nessuno è a schermo; e il freno
  del `429` lo riconosce dai secondi, non dalla classe dell'errore, che in quella copia è un'altra (visto in Chromium 151 sulle
  pagine di prova di `npm run demo`, col JS che contiene la cornice chiesto con `?v=3` dal JS che monta la pagina: i risultati
  entro due secondi dalla parola). Il JS che contiene la cornice si scarica e si esegue lo stesso una seconda volta, con ciò
  che segue se è anche quello che monta la pagina. Fino alla `v2.15` lì la richiesta della ricerca non partiva, e il riquadro
  restava in caricamento senza un errore. Un pulsante
  per riprovare nel riquadro della ricerca
  l'`AppShell` non lo ha: è chiesto al design system, e il pacchetto non ne disegna uno suo. Nel codice del frontend non
  cambia niente; per i suoi test vedi «Passare alla v2.8».
  Un risultato porta tipo, id e titolo e, dalla `v1.15.0`, il `contesto`: di che
  prodotto è lo dice il registro, dal tipo. Dalla `v1.15.0` la cornice mostra sei tipi: di Project Management le schede
  (`board.scheda`), le board (`board.board`) e le aree (`board.cartelle`); del CRM i contatti (`crm.persona`), le
  aziende (`crm.organizzazione`) e le opportunità (`crm.trattativa`). Fino alla `v1.14.0` mostrava solo board e cartelle.
  Dalla `v1.17.0` la ricerca trova anche i membri del workspace (`workspace.membro`): non sono di un modulo, il backoffice
  li cerca in ogni workspace, anche senza moduli attivi, e nel registro stanno nella voce `home`. I
  risultati stanno raggruppati per tipo, col nome del tipo nella lingua (Schede, Board, Aree, Contatti, Aziende,
  Opportunità), il nome e il tono del prodotto e l'icona del tipo; i gruppi escono nell'ordine del backoffice, quello del
  primo risultato di ognuno, e dentro un gruppo i risultati nel suo ordine. Il gruppo dei membri è «Membri» (in inglese
  «Members», in spagnolo «Miembros»), con l'icona del tipo; la voce `home` non è un prodotto, e un membro non ha a destra il
  nome di un prodotto, né un tono. Dalla `v2.0.0` il titolo di un risultato è pulito come i nomi di una notifica: senza i
  caratteri che cambiano la direzione del testo, con a capo e caratteri di controllo ridotti a uno spazio; un risultato
  senza un titolo che si vede non si mostra. Sotto il titolo sta la seconda riga: i testi di
  `contesto` che il registro dice per quel tipo, uniti da « · » — board e lista di una scheda, azienda e ruolo di un
  contatto, pipeline e fase di un'opportunità —, solo quelli che ci sono; un'azienda, una board e un'area non hanno una
  seconda riga; un tipo che il registro non ha non si mostra. Sotto il nome di un membro sta il suo ruolo, nella lingua
  della persona: «Proprietario», «Amministratore», «Membro» (in inglese «Owner», «Admin», «Member», in spagnolo
  «Propietario», «Administrador», «Miembro»). Il backoffice dà un codice (`proprietario`, `amministratore`, `membro`), e la
  cornice mostra il testo che quel codice ha nella lingua, mai il codice; con un codice che il registro non ha la riga ha
  solo il nome. L'email di un membro non esce mai: il backoffice non la dà, e di `contesto` la parte server lascia passare
  il solo `ruolo`. Dalla `v1.18.0` un'opportunità chiusa mostra anche l'esito, per terzo: «Vendite · Proposta · Vinta», o
  «… · Persa» (in inglese «Won» e «Lost», in spagnolo «Ganada» e «Perdida»). Dell'esito il backoffice dà il codice
  (`aperta`, `vinta` o `persa`) e il registro ha i soli `vinta` e `persa`: un'opportunità aperta resta con pipeline e fase,
  senza un terzo testo. Dalla `v1.14.0` non si mostra nemmeno un risultato il cui id
  non ha la forma di un id (lettere, cifre, `-` e `_`, da 1 a 64): un id così non entra in un indirizzo. Scegliere un
  risultato apre l'indirizzo del suo prodotto, nel workspace dei risultati, seguito dal percorso del tipo: una board si apre
  su `https://board.zeiras.com/w/<slug>/b/<id>`; un'area non ha una pagina sua, e si apre sulla pagina del workspace
  dove stanno le aree, `https://board.zeiras.com/w/<slug>`; una scheda su `https://board.zeiras.com/w/<slug>/c/<id>`, un
  contatto su `https://crm.zeiras.com/w/<slug>/contatti/<id>`, un'azienda su `https://crm.zeiras.com/w/<slug>/aziende/<id>`,
  un'opportunità su `https://crm.zeiras.com/w/<slug>/opportunita/<id>`: gli stessi percorsi che aprono le notifiche. Dalla
  `v1.17.0` un membro si apre su `https://app.zeiras.com/w/<slug>/impostazioni/membri/<id>`, in Impostazioni › Membri: la
  pagina è di zr-home, apre l'elenco dei membri col pannello di quel membro, per tutti e tre i ruoli, e per un id che non è
  più di un membro del workspace rimanda all'elenco. Nel CRM
  le aziende e le opportunità stanno dietro una voce che un workspace può spegnere: se è spenta la pagina di quel risultato
  risponde 404, ed è una risposta del CRM. Dalla `v1.12.0` lo `<slug>` è quello che la risposta dice (`workspace`), che non
  è sempre quello dei dati della pagina: la sessione ha un workspace solo, e con due schede su due workspace la scheda
  rimasta indietro cerca in quello in cui la persona è entrata per ultimo; fino alla `v1.11.0` apriva quei risultati nel
  proprio, dove non ci sono. Una risposta senza `workspace`, o con un `workspace` che non è un testo o è vuoto, è un errore
  della ricerca: senza non c'è un indirizzo sicuro, e la cornice non ripiega sul workspace della pagina. Così risponde anche
  una parte server finta, nei test di un frontend, che dà i risultati senza `workspace`: le si aggiunge `workspace`, con lo
  slug dei dati della pagina (si trovano cercando `cornice/ricerca` nei test del frontend). Dalla `v1.13.0` è un errore
  della ricerca anche un `workspace` che non ha la forma di uno slug — minuscole e cifre, a pezzi uniti da un trattino, la
  stessa che vale per una notifica —: con `..` l'indirizzo di un risultato sarebbe un altro. Una parte server finta che
  risponde con uno slug fuori forma (`Acme`, `acme_marketing`) va corretta. Se la rotta fallisce, l'errore della ricerca,
  mai «Nessun risultato». Dalla `v1.17.0` il segnaposto del campo è uno solo, uguale in ogni workspace e in ogni modulo:
  «Cerca nel workspace…» (in inglese «Search the workspace…», in spagnolo «Busca en el workspace…»). Non nomina le fonti: che
  cosa si può cercare lo dice l'invito che si legge prima di due caratteri. Dalla `v1.15.0` l'invito dice le fonti della
  ricerca nel workspace: i tipi di risorsa dei moduli che lì sono `attivo`, nell'ordine del registro, ognuno col nome da
  elenco che ha nella lingua (`searchSource.<prodotto>.<tipo>`: «schede», «board», «aree», «contatti», «aziende»,
  «opportunità»). Dalla `v1.17.0` dopo di loro vengono i membri del workspace (`searchSource.home.workspace.membro`:
  «membri»): sono una fonte in ogni workspace, anche senza moduli attivi, e sono nominati per ultimi. L'invito le nomina
  tutte, unite come la lingua unisce un elenco (`Intl.ListFormat`). Con Project Management attivo e il CRM no: «Cerca schede,
  board, aree e membri: scrivi almeno 2 caratteri.» (in inglese «Search cards, boards, areas, and members: type at least
  2 characters.», in spagnolo «Busca tarjetas, tableros, áreas y miembros: escribe al menos 2 caracteres.»); col CRM attivo
  l'invito nomina anche contatti, aziende e opportunità, prima dei membri. Un modulo `disponibile` o in arrivo non dà fonti.
  Dalla `v2.25.1` il contenitore delle board si chiama «Area», come in zr-home e zr-board: «Aree» nel gruppo dei risultati e
  «aree» nell'invito (in inglese «Areas» e «areas», in spagnolo «Áreas» e «áreas»), e «Nuova area», «{who} ha creato l'area…»
  nei titoli delle notifiche; le chiavi, gli id degli eventi (`com.zeiras.board.cartella.*`) e il tipo `board.cartelle` non
  cambiano.
  Dalla `v3.6.0` la ricerca trova anche le prenotazioni e i calendari di Bookings, dove Bookings è `attivo`: l'invito li
  nomina dopo le fonti dei moduli che lo precedono nel registro («prenotazioni», «calendari»; in inglese «bookings»,
  «calendars», in spagnolo «reservas», «calendarios»), e il segnaposto resta quello unico. Una prenotazione sta nel gruppo
  «Prenotazioni» e un calendario in «Calendari di prenotazione» (in inglese «Bookings» e «Booking calendars», in spagnolo
  «Reservas» e «Calendarios de reservas»); si aprono in Bookings, `/prenotazioni/{id}` e `/calendari/{id}` nel workspace
  dei risultati. La seconda riga di una prenotazione dice quando comincia, nella lingua dei testi e nel fuso che il
  risultato porta, poi lo stato: «mer 4 nov, 10:00 · Confermata». Gli stati sono quattro, `confermata`, `svolta`,
  `non_presentato` e `annullata` («Confermata», «Svolta», «Non presentato», «Annullata»); un altro codice non si mostra.
  `quando` arriva dalla parte server solo come `{il, fuso}`, l'istante in UTC con la Z e il nome IANA del fuso, come quello
  di una notifica (un giorno che il calendario ha, un fuso che il PHP del server conosce, scritto com'è in IANA): in ogni altra forma non passa, e la seconda riga dice solo lo stato. Le risorse di Bookings non stanno
  nella sua voce del registro: stanno in `resources/registro/ricerca.json`, e i loro testi in `resources/lingue/ricerca/`,
  un file per lingua; li legge solo il pezzo della ricerca, e la voce ne ha i tipi in `fonti`, che servono all'invito
  prima che il pezzo arrivi. Nel registro esportato la voce di Bookings ha quindi `fonti` e non `risorse`.
  Senza moduli attivi restano i membri: «Cerca membri: scrivi almeno 2 caratteri.» (in inglese «Search members: type at least
  2 characters.», in spagnolo «Busca miembros: escribe al menos 2 caracteres.»). Dalla `v1.15.0` alla `v1.16.0` anche il
  segnaposto nominava le fonti, al più tre, e i membri non erano una fonte. Un frontend che ha i due testi nei suoi test li
  trova così, secondo i moduli attivi nei suoi dati di prova: con Project Management attivo e il CRM no il segnaposto era
  «Cerca schede, board, cartelle…» e l'invito «Cerca schede, board e cartelle: scrivi almeno 2 caratteri.» (cerca `cartelle…`
  e `e cartelle:`; in inglese `folders…` e `and folders:`, in spagnolo `carpetas…` e `y carpetas:`); con tutti e due attivi il
  segnaposto era lo stesso e l'invito finiva con «contatti, aziende e opportunità: scrivi almeno 2 caratteri.» (cerca
  `e opportunità:`; in inglese `and opportunities:`, in spagnolo `y oportunidades:`); col solo CRM attivo il segnaposto
  era «Cerca contatti, aziende, opportunità…» e l'invito «Cerca contatti, aziende e opportunità: scrivi almeno 2
  caratteri.» (cerca `opportunità…` e `e opportunità:`; in inglese `opportunities…` e `and opportunities:`, in spagnolo
  `oportunidades…` e `y oportunidades:`); senza moduli attivi erano i due testi senza fonti, «Cerca…» e «Scrivi almeno 2
  caratteri.». I due testi senza fonti sono «Cerca…» (in inglese «Search…», in spagnolo «Busca…») e «Scrivi almeno 2
  caratteri.» («Type at least 2 characters.», «Escribe al menos 2 caracteres.»): dalla `v1.17.0` «Cerca…» resta a chi non
  ha accettato i documenti legali, che non ha fonti. L'elenco delle fonti vuole `Intl.ListFormat` nel browser: dove manca,
  in un browser che ha il resto di ciò che i sorgenti usano — la libreria ES2022 (`Array.prototype.at`, `Object.hasOwn`) e
  `Intl.RelativeTimeFormat` —, dalla `v1.16.0` la cornice si disegna lo stesso e l'invito è quello senza fonti, quante che
  siano le fonti; dalla `v1.17.0` il segnaposto lì è quello unico, come ovunque (nella `v1.16.0` era «Cerca…»); nella
  `v1.15.0`, con almeno una fonte, lì il disegno della cornice lanciava un errore. Dove manca anche il resto la cornice
  non si disegna, nella `v1.16.0` come prima: a un browser così lo aggiunge il frontend. I due testi li dà la cornice dai
  testi delle lingue: `searchHintSources` ha il posto dell'elenco, `{sources}`; `searchPlaceholderSources` è il segnaposto
  unico e dalla `v1.17.0` non lo ha più (la chiave resta); `searchPlaceholder` e `searchHint` sono quelli senza fonti.
  Dalla `v1.12.0` alla `v1.14.0` i due testi erano fissi: «Cerca board e cartelle…» e «Cerca board e cartelle: scrivi
  almeno 2 caratteri.» (in inglese «Search boards and folders…» e «Search boards and folders: type at least 2
  characters.», in spagnolo «Busca tableros y carpetas…» e «Busca tableros y carpetas: escribe al menos 2 caracteres.»);
  prima ancora «Cerca progetti, schede, contatti…» e «Cerca in tutti i moduli: scrivi almeno 2 caratteri.». Un frontend
  che li ha nei suoi test li trova cercando `board e cartelle` (in inglese `boards and folders`, in spagnolo
  `tableros y carpetas`), e quelli di prima cercando `Cerca progetti` e `tutti i moduli` (in inglese `Search projects` e
  `across all modules`, in spagnolo `Busca proyectos` e `todos los módulos`).
- **Il menu del profilo** ha Profilo, Impostazioni, Azienda e, dopo una linea, Esci: le prime tre aprono le loro pagine su
  app.zeiras.com (`/impostazioni/profilo`, `/impostazioni/preferenze`, `/azienda`), «Esci» chiama `onLogout`. La voce
  «Piano» è spenta di default: i piani non esistono ancora, e la voce porterebbe a una pagina che non c'è. Si accende con
  la prop `piano` (`<Cornice piano … />`, o sul layout della cornice) quando la pagina del piano esiste su app.zeiras.com
  (`/azienda/impostazioni/piano`): allora il menu è quello del design system, con «Piano» fra Impostazioni e Azienda.
- **Chi non ha accettato i documenti legali** in vigore vede la cornice ridotta, dalla `v1.14.0`: coi dati che portano
  `accettazione_richiesta: true`, o dopo che una rotta della cornice ha risposto 403 `accettazione_richiesta` (finché i
  dati della cornice non sono più recenti di quelli che aveva allora: gli stessi, o dello stesso workspace con un segno non
  più avanti, anche se il frontend li ricrea a ogni disegno o li ritocca nel browser; con dati letti dopo che non lo dicono
  torna quella di sempre, e così coi dati di un altro workspace: da lì quel segnale non vale più, nemmeno per i dati di
  prima; dati senza segno valgono solo finché sono lo stesso oggetto). Nel menu Moduli c'è solo la
  Dashboard, e il pulsante del modulo aperto non c'è. Su una pagina di un modulo che non dà `active`, o lo dà
  vuoto, nessuna voce della barra è segnata: la Dashboard resta segnata solo sulle pagine di app.zeiras.com. La campanella non ha numero, e il suo pannello dice «Non disponibile
  finché non accetti i documenti.», senza notifiche e senza «Segna tutte come lette», «Riprova» e «Vedi tutte»; la ricerca
  dice la stessa frase sotto il campo e non dà risultati. In quello stato la cornice non chiama nessuna delle sue rotte.
  Dalla `v1.16.0`, passata a quello stato, la cornice dimentica la ricerca: tornata quella di sempre non mostra i
  risultati di prima, e se nel campo è rimasta una parola sotto si legge «Nessun risultato per «parola»», anche se quella
  parola non è stata cercata, finché la persona non scrive ancora (l'`AppShell` non sa svuotare il campo: è chiesto al
  design system).
  Sopra il contenuto della pagina, che resta, c'è un avviso («Ci sono documenti da accettare») col pulsante «Vai ai
  documenti», che porta a `https://app.zeiras.com/legale/accetta?ritorno=<indirizzo della pagina>`: l'indirizzo è quello
  in cui la persona è al clic, e va nel `ritorno` solo se comincia con `https://` e non supera i 2000 caratteri (senza
  `ritorno`, dopo l'accettazione zr-home porta alla Dashboard). Il `ritorno` è una richiesta: dove la persona torna dopo
  l'accettazione lo decide zr-home. La pagina dell'accettazione è di zr-home e sta fuori dalla
  cornice: la cornice non mostra testi legali, non dice quali documenti mancano e non fa accettare niente. Il menu del
  profilo resta intero, ed «Esci» funziona. Che cosa fa il frontend: dà i dati alla cornice così come sono; non legge
  `prodotti` vuoto come «Presto» (guarda `accettazione_richiesta`); lascia a zr-auth il rimando dalle proprie visite che
  chiamano `/v1` (a una richiesta JSON zr-auth risponde 403 senza rimando, e lì decide il frontend: «La parte server»);
  sulle rotte `/cornice/*` non mette un middleware che chiama `/v1` senza prendere quel 403; e se a chi non ha accettato
  non vuole mostrare le voci del modulo e il «+», non li dà (`nav`, `create`): la cornice li mostra come la pagina li dà.
  In quello stato `flush` non vale: l'avviso sta nel margine della pagina, in un contenitore suo (`div.zr-stack`) prima
  della pagina. La pagina resta dov'è fuori da quello stato — dentro `main.zr-main`, o dentro `div.zr-main-body` se la
  pagina ha il percorso (`crumbs`) —, subito dopo l'avviso, e quando lo stato arriva o
  se ne va non si rimonta (dalla `v1.15.0`): ciò che è scritto in un campo, il fuoco e lo scorrimento restano, e i suoi
  effetti non ripartono. Vale comunque lo stato arrivi: dal 403 di una rotta, o coi dati di una visita che tiene la pagina
  montata. I
  quattro testi sono di zr-core, nelle tre lingue (`acceptanceTitle`, `acceptanceText`, `acceptanceAction`,
  `acceptanceOff`). Dalla `v3.7.0` stanno in `resources/lingue/avvisi/`, coi tre di «Zeiras non risponde», e non nel JS
  d'ingresso: la cornice li chiede in un pezzo a richiesta quando passa a uno dei due stati, e l'avviso, con la frase di
  campanella e ricerca, c'è quando il pezzo è arrivato; fino ad allora campanella e ricerca, già spente, dicono i testi di
  sempre. Un caso di un frontend che cerca l'avviso subito dopo il disegno prima lo aspetta:
  `await act(() => vi.dynamicImportSettled())`. Una lingua nuova porta anche il suo file degli avvisi; senza, gli avvisi
  sono in inglese. Campanella e ricerca si spengono con ciò che l'`AppShell` ha oggi per un errore: il design system non
  ha ancora uno stato «non disponibile».

Per aprire un indirizzo la cornice usa il browser; un frontend che naviga da sé passa `naviga(indirizzo)`: un prodotto che
apre da sé le sue risorse (una board, senza ricaricare la pagina) lo intercetta lì.

Fuori dalla cornice — le schede dei prodotti nella Dashboard — il registro e il nome di ogni voce nella lingua della
persona si importano dallo stesso ingresso: `registro` e `nomeDellaVoce(voce, lingua)`. Da `…/resources/js/frasi` — dalla
`v2.0.0`: prima dallo stesso ingresso, vedi «Passare alla v2» — si importa
`titoloDellaNotifica(tipo, lingua)`, per chi mostra le notifiche in una pagina sua: dà il titolo di una notifica di quel
tipo nella lingua: è il titolo che il pannello della cornice scrive quando la notifica non ha una frase con chi ha fatto.
`tipo` è il `tipo` della notifica, com'è nella risposta del backoffice (`com.zeiras.board.scheda.creata`); `lingua` è il codice
della lingua della persona, e vale come per la cornice: `it-IT` è `it`, e con una lingua che zr-core non ha il titolo è in
inglese. I tipi che zr-core conosce sono le chiavi `notificationTitle.<tipo>` dell'inglese (`resources/lingue/notifiche/en.json`):
un tipo che non è fra quelle — nuovo nel contratto, vuoto, mancante, o che non è un testo — ha il titolo di ripiego della
lingua («Novità nel workspace»), mai il codice del tipo. Dalla `v1.10.0` si importa anche
`risorsaDellaNotifica(notifica, lingua)`, per la riga sotto il titolo: dà il nome della cosa a cui la notifica si
riferisce: è la riga che il pannello scrive sotto il titolo quando il nome non è già nella frase. `notifica` è la notifica
com'è, del backoffice o di
`GET /cornice/notifiche`: la funzione ne legge `tipo` e `risorsa_nome`. Di norma dà `risorsa_nome` senza gli spazi
intorno e, dalla `v1.20.0`, pulito come nel pannello (vedi «Le notifiche»); per una notifica su un'app (un tipo che comincia con `com.zeiras.app.`), dove `risorsa_nome` è il codice dell'app
(`pm`), dà il nome del prodotto nella lingua, quello di `nomeDellaVoce`. Non dà niente (`undefined`) quando il nome non
c'è — `null`, vuoto, di soli spazi, mancante, o che non è un testo — e quando il codice non è di un prodotto del
registro: lì la riga non si mostra, e il codice mai.
Dalla `v1.19.0` si importa anche `rigaDellaNotifica(notifica, lingua)`, per chi mostra le notifiche in una pagina
sua: dà il titolo e la riga di sotto (`{titolo, sotto}`) come li scrive il pannello, con la frase di chi ha fatto
quando il tipo ce l'ha — vedi «Le notifiche», più sopra —: gli stessi testi del pannello, che le sue frasi le chiede a parte (più sotto). Della notifica legge
`tipo`, `autore_nome`, `risorsa_nome`, dalla `v2.1.0` `azioni` e `board_nome`, e dalla `v3.6.0` `quando`, per la data nel titolo: quando sotto il titolo non c'è il nome
della cosa, `sotto` dice quante azioni la notifica racconta e in quale board; `sotto` manca quando sotto il titolo
non c'è niente da scrivere.
`titoloDellaNotifica` e `risorsaDellaNotifica` restano come sono: chi le usa insieme ha la riga di prima, senza le
frasi. Dalla `v2.0.0` tutte e tre si importano da `…/resources/js/frasi`, e i due ingressi non le esportano più; ciò che
segue fino alla `v2.25.4` si importava dall'ingresso, e dalla `v3.0.0` si importa anche lui da `…/resources/js/frasi` (vedi
«Passare alla v3»).
Dalla `v1.11.0` si importa anche
`destinazioneDellaNotifica(notifica, slug, prodotti)`, per chi apre una notifica da una pagina sua: dà l'indirizzo che il
pannello della cornice apre con un clic su quella notifica, ed è la funzione che usa il pannello. `notifica` è la
notifica di `GET /cornice/notifiche`: la funzione ne legge `app`, `tipo` e `ids`; `slug` è il workspace dell'elenco, cioè
`workspace` nella risposta di `GET /cornice/notifiche` (dalla `v1.12.0`), che non è sempre quello dei dati della pagina;
`prodotti` è lo stato dei moduli in quel workspace: `dati.prodotti` vale solo se quello slug è `dati.workspace.slug`. Per
un altro workspace i dati della pagina non dicono niente: il pannello dà ogni voce del `registro`, tranne `home`, come
`disponibile` — se lì il modulo non è attivo lo dice il modulo —, e così fa chi mostra le notifiche in una pagina sua.
Se la risposta non dice il workspace non c'è uno slug da dare, e si apre la pagina delle notifiche. Non
dà niente (`undefined`) quando la notifica non ha dove andare — vedi «Le notifiche», più sopra —, e allora si apre la
pagina delle notifiche: mai un indirizzo composto a metà, nemmeno con uno `slug` che non ha la forma di uno slug:
minuscole e cifre, a pezzi uniti da un trattino (`acme`, `acme-marketing`), com'è lo slug di un workspace nel contratto
del backoffice. Uno vuoto, `..`, uno con una barra, `Acme`, `acme_marketing` non la hanno: anche allora non dà niente.
Chi le notifiche le legge da sé dal backoffice, sul suo server — una pagina delle notifiche sua —, gli `ids` non li ha:
dalla `v1.12.0` li dà un metodo PHP pubblico e statico,
`Zeiras\Core\Http\NotificheDellaCornice::idsDellaNotifica(?string $app, string $tipo, mixed $dati): array`, ed è la
regola con cui li dà `GET /cornice/notifiche`, non una copia. `app`, `tipo` e `dati` sono quelli della notifica, com'è
nella risposta del backoffice, e `dati` è un array di PHP con le sue chiavi; il metodo dà gli id per chiave
(`['persona_id' => '<id>']` per una nota legata al solo contatto), da dare al browser come `ids` della notifica. Dalla
`v1.13.0` un tipo può avere più percorsi, e il metodo dà gli id del primo che `dati` soddisfa per intero, e solo quelli:
per una nota legata a un'opportunità e a un contatto la sola `['trattativa_id' => '<id>']`. Se `dati` non ne soddisfa
nessuno per intero dà gli id in forma del primo percorso, che da soli non aprono niente: col registro di oggi ogni
percorso chiede al più un id, e sono nessuno (`[]`). Per un tipo il cui percorso
non chiede un id — un'attività, che apre «Da fare» — dà `[]`: un `ids` vuoto non vuol dire che la notifica non ha una
destinazione, e se ce l'ha lo dice `destinazioneDellaNotifica`. È un array di PHP, e vuoto in
JSON è `[]`, mentre `GET /cornice/notifiche` manda `ids` sempre come oggetto (`{}` quando è vuoto): chi lo dà al browser
lo converte in un oggetto (`(object)`), e nel browser `ids` ha una forma sola. Dà `[]`, senza eccezioni,
quando la notifica non ha una destinazione — un tipo o un'app che il registro non ha, nessuna app, una voce «Presto» —
e quando `dati` manca o non è un array con le chiavi; un id che manca, o che non ha la forma di un id (lettere, cifre,
`-` e `_`, da 1 a 64), nell'array non c'è. Senza gli id di nessuno dei percorsi del tipo `destinazioneDellaNotifica` non dà
niente, e si apre la pagina delle notifiche. Al browser vanno questi `ids` e non `dati`: i `dati` interi di una
notifica restano sul server del frontend. Un id non è un permesso nemmeno qui: il metodo non controlla che chi riceve la
notifica possa vedere quella risorsa, e lo decide il modulo che apre la pagina. Lo `slug` da dare a
`destinazioneDellaNotifica`, per notifiche lette così, è quello del workspace della sessione nella richiesta che le ha
lette (lo `slug` di `Sessione::workspace()` di zr-auth), e la parte server del frontend lo manda insieme a loro, come
`GET /cornice/notifiche` manda `workspace`. Non è `dati.workspace.slug`: con due schede su due workspace, una pagina
rimasta indietro che ricarica le sole notifiche riceve quelle dell'altro workspace, e coi suoi dati le aprirebbe nel
proprio. Nome e firma del metodo sono un contratto, e cambiano solo con una versione maggiore.
Le destinazioni stanno nel registro, non nel codice: dalla `v3.0.0` in `resources/registro/notifiche.json`, che ha sotto
l'id di ogni modulo una riga per tipo (fino alla `v2.25.4` stavano in `notifiche` della voce del modulo, un campo che dalla
`v3.0.0` le voci non hanno più), col tipo intero dell'evento (`com.zeiras.crm.nota.creata`) e il
percorso nel modulo dopo `/w/<slug>`, dove un segnaposto è `{id}` o `{<nome>_id}` e prende l'id che la notifica ha con
quella chiave (`/contatti/{id}` per un contatto). Un percorso può non avere un segnaposto (`/da-fare`, per un'attività):
allora non chiede un id. Dalla `v1.13.0` una riga può avere anche `altrimenti`, la lista dei percorsi che si provano dopo
`percorso`, in ordine, quando la risorsa può stare in più pagine: si apre il primo che ha tutti i suoi id — per una nota
`/opportunita/{trattativa_id}`, altrimenti `/contatti/{persona_id}`, altrimenti `/aziende/{organizzazione_id}`. Per questo
un percorso che chiede gli stessi id di uno che viene prima, o di più, non si aprirebbe mai, e nemmeno uno dopo un percorso
senza segnaposto: dalla `v1.14.0` il controllo del registro li rifiuta. Un tipo
che non è un evento, come ciò che il CRM manda a chi diventa responsabile (`crm.persona.assegnata`), è scritto com'è nel
backoffice, senza `com.zeiras.` davanti. Dalla `v1.14.0` ha le sue `notifiche` anche la voce di Project Management: una
scheda nuova, modificata (`com.zeiras.board.scheda.creata`, `com.zeiras.board.scheda.modificata`) o assegnata
(`board.scheda.assegnata`), tutte e tre con `/c/{id}`. Dalla `v1.16.0` c'è la quarta, una menzione in un commento
(`board.commento.menzione`), con `/c/{id}` anche lei: l'id è quello della scheda, e `commento_id`, che i `dati` portano,
non è nel percorso. Dalla `v3.6.1` Project Management ha anche le scadenze di una scheda (`board.scheda.scade_domani`,
`board.scheda.scade_oggi`), con `/c/{id}`, e il promemoria di una To-do (`board.todo.promemoria`), con `/todo?todo={id}`:
un percorso può finire con un parametro, uno, col suo segnaposto. E la voce della Dashboard, `home`, la prima del file,
ha l'invito accettato (`io.invito.accettato`), con `/impostazioni/membri`: una notifica senza app (`app: null`) si cerca
lì, e l'app `home` non c'è. Dalla `v2.25.3` la voce del CRM ha anche il credito di un pacchetto sotto zero
(`crm.acquisto.scoperto`), con `/contatti/{persona_id}`: apre il contatto, e l'`id` dell'acquisto, che i `dati` portano,
non è nel percorso. Dalla `v3.0.0` il CRM ha anche le due notifiche delle scadenze: il preavviso
(`crm.scadenza.in_preavviso`), con `/contatti/{persona_id}`, altrimenti `/aziende/{organizzazione_id}`, altrimenti
`/scadenze`, e il riepilogo del giorno (`crm.scadenze.riepilogo_del_giorno`), con `/scadenze`; l'`id` della scadenza, che i
`dati` portano, non è nel percorso. Dalla `v3.2.2` il CRM ha anche la richiesta di un cliente sul preventivo
(`crm.preventivo.richiesta`), con `/preventivi/{id}`: apre il preventivo, e `trattativa_id`, che i `dati` portano, non è
nel percorso. Un modulo che vuole i titoli e le destinazioni delle sue notifiche
li chiede all'agente di zr-core, e arrivano con una versione.
Nel registro stanno anche le risorse che la ricerca mostra: una voce ha in `risorse` una riga per tipo, col tipo com'è nel
backoffice (`board.scheda`), l'icona, il percorso dopo `/w/<slug>`, se è un contenitore e le chiavi di `contesto` che fanno
la seconda riga del risultato. Dalla `v1.17.0` ha una risorsa anche la voce `home`, che non è un modulo: il membro del
workspace (`workspace.membro`), col percorso `/impostazioni/membri/{id}` e la chiave `ruolo`. Dalla stessa versione una
risorsa può avere `codici`: le chiavi di `contesto` il cui valore è un codice e non un testo, ognuna coi codici che può
avere (per il `ruolo` di un membro `proprietario`, `amministratore`, `membro`). Di un codice si mostra il testo che ha
nella lingua, mai il codice, e un codice che il registro non ha non si mostra; una chiave senza `codici` porta un testo,
che dalla `v1.20.0` si mostra pulito come i nomi nelle notifiche, senza i caratteri che cambiano la direzione del testo
e coi caratteri di controllo ridotti a uno spazio (il ruolo di un contatto del CRM). Il testo di un codice sta nelle lingue con la chiave
`searchContext.<voce>.<tipo>.<chiave>.<codice>`. Per il membro le lingue hanno cinque testi nuovi: il nome del gruppo
(`home.workspace.membro`: «Membri»), il nome da elenco (`searchSource.home.workspace.membro`: «membri») e i tre ruoli
(`searchContext.home.workspace.membro.ruolo.proprietario`, `….amministratore`, `….membro`). Dalla `v1.18.0` ha `codici`
anche l'opportunità del CRM (`crm.trattativa`), che a `pipeline` e `fase` aggiunge la chiave `esito`: i codici sono `vinta`
e `persa`, coi testi `searchContext.crm.crm.trattativa.esito.vinta` e `….persa` («Vinta» e «Persa»). `aperta`, che il
backoffice dà per un'opportunità aperta, non è fra i codici e non ha un testo: così un'opportunità aperta non mostra
l'esito.
Dalla `v1.20.0` `titoloDellaNotifica` e `rigaDellaNotifica` portano con sé le frasi delle notifiche di ogni lingua: restano
sincrone e danno gli stessi testi del pannello; dalla `v2.0.0` si importano da `…/resources/js/frasi`, non più dai due
ingressi (vedi «Passare alla v2»). Un'app che le usa in una pagina sua
ha le frasi nel pezzo di quella pagina; un'app che non le usa non le porta, e ha solo quelle che la cornice carica a
richiesta. Se quella pagina sta nel JS d'ingresso, frasi e pezzo della campanella entrano nell'ingresso con lei.

Ogni voce del registro porta due sì o no sullo stato del prodotto, e non dicono la stessa cosa. `presto` è della cornice:
un prodotto «Presto» non c'è ancora, e la sua voce non porta da nessuna parte in nessun workspace, qualunque cosa dica il
backoffice. `in_arrivo` è per le pagine senza sessione — Registrati —, che non hanno un workspace a cui chiedere lo stato
di un prodotto: lì un prodotto in arrivo si mostra «In arrivo», non «Disponibile», perché non lo può ancora aprire
nessuno, salvo i workspace che il backoffice ammette in anteprima. Dentro la sessione lo stato di un prodotto lo dà il
backoffice, workspace per workspace, e la cornice `in_arrivo` non lo legge: nel workspace di un'anteprima il prodotto si
apre, se il registro non lo dà «Presto». Ogni prodotto «Presto» è anche in arrivo; quali prodotti lo sono lo dice il
registro (`resources/registro/prodotti.json`). Una pagina senza sessione legge `in_arrivo`, non `presto`: Bookings e Finanze sono in
arrivo e non sono «Presto». Dalla `v1.16.0` il CRM non è più in arrivo (`in_arrivo: false`): dal 12/10/2026 il backoffice lo
dà `disponibile` a ogni workspace; in arrivo restano Bookings e Finanze e i tre «Presto». Fino alla `v1.15.0` il registro dava in
arrivo anche il CRM. Dalla `v2.22.0` il registro ha anche Finanze (id `flow`, icona `euro`, tono `pine`, `https://flow.zeiras.com`), in arrivo senza
essere «Presto»: nessun agente ancora; il nome è «Finanze» in italiano, «Finance» in inglese, «Finanzas» in spagnolo. Il
modulo di progetto, che ha ancora l'id `pm`, si chiama «Board» in tutte e tre le lingue (prima «Project Management» e «Gestión
de proyectos»): l'id e l'indirizzo non cambiano, cambia il nome che la cornice mostra.

Il colore di un workspace fuori dalla cornice — un elenco dei workspace in una pagina del frontend — lo dà
`tonoDelWorkspace(id)`, dallo stesso ingresso (dalla `v1.7.0`): è la regola che usa il selettore della cornice, quindi per
lo stesso `id` il tono è lo stesso. `id` è l'`id` del workspace, com'è in ogni workspace di `aziende` nei dati della cornice.
Dà il nome di uno dei toni che il design system ammette per un workspace (`pine`, `citrus`, `coral`, `sky`, `plum`), non un
colore: il colore lo mette il CSS del design system (`var(--<tono>)`). Due workspace possono avere lo stesso tono. Un `id`
vuoto, mancante o che non è un testo non ha tono, e la funzione dà `undefined`.

Dalla `v3.6.0` un workspace che ha scelto il suo colore (`colore` di `io.workspace.elenca`, da `workspace.modifica`) ha nel
selettore quel colore, non il tono del suo `id`. Nei dati della cornice sta in ogni workspace di `aziende`, come `colore`, solo
quando è uno dei cinque toni: `neutral`, il colore di chi non ne ha scelto uno, non arriva, e allora vale la regola dell'`id`.
Una pagina del frontend che vuole il pallino del selettore scrive `workspace.colore ?? tonoDelWorkspace(workspace.id)`.

### La cornice montata una volta sola

Montata in ogni pagina, la `Cornice` si rifà a ogni visita di Inertia, e con lei si perdono il testo scritto nella ricerca,
il pannello aperto e le notifiche caricate. `LayoutDellaCornice` la tiene montata mentre la pagina cambia, finché il
workspace è lo stesso. È un'aggiunta: chi monta `Cornice` in ogni pagina non deve cambiare niente. zr-core non dipende da
Inertia: il layout e `useCornice` sono un componente e un hook di React.

```tsx
import { createInertiaApp } from '@inertiajs/react';
import { LayoutDellaCornice, useCornice, type LayoutDellaCorniceProps } from '../../vendor/zeiras/zr-core/resources/js';

// Il layout del frontend, a livello di modulo. Inertia gli dà le props della pagina, e quelle di `Pagina.layout`.
function Layout({ cornice, crumbs, children }: Pick<LayoutDellaCorniceProps, 'cornice' | 'crumbs' | 'children'>) {
    return (
        <LayoutDellaCornice cornice={cornice} product="pm" crumbs={crumbs} onLogout={esci}>
            {children}
        </LayoutDellaCornice>
    );
}

createInertiaApp({ layout: () => Layout, … });

// Una pagina: ciò che sa solo lei lo dà alla cornice montata.
function Board({ board }: { board: { nome: string } }) {
    useCornice({ nav, active: 'board', onNavigate, create: [{ label: 'Scheda', onClick: nuovaScheda }], flush: true });

    return …;
}

// Il percorso viene dai dati del server: la pagina lo dà al layout, prima di montarsi.
Board.layout = (props: { board: { nome: string } }) => ({ crumbs: [{ label: props.board.nome }] });
```

- **Il layout** del frontend rende `LayoutDellaCornice` ed è un componente a livello di modulo, dato a
  `createInertiaApp({ layout })`: finché è lo stesso componente Inertia lo tiene montato, e uno creato dentro un render
  sarebbe nuovo ogni volta. `LayoutDellaCornice` prende le props di `Cornice`, con `cornice` al posto di `dati`: con `null`,
  o senza (una pagina fuori dal workspace), non c'è la cornice e la pagina ha sopra la barra minima (qui sotto). Il layout gliele dà **per nome**, mai con
  `{...props}`: Inertia passa al layout anche le props della pagina, e una prop del server che si chiama `actions` o
  `product` non deve arrivare alla cornice.
- **Senza dati: la barra minima**, provvisoria (dalla `v2.24.0`). Quando la cornice non c'è — `cornice` `null` o mancante, e
  niente `subito` —, la pagina ha sopra una barra sola: il logo, le voci del modulo ed «Esci». Le voci sono le `nav`, `active` e `onNavigate` che il layout riceve come props: quelle che la
  pagina dà con `useCornice` non ci sono, perché la cornice che le riceve non è montata. Per averle anche qui il frontend le dà al layout.
  Non chiede niente al backoffice, così chi arriva su una pagina d'esito o d'errore non resta senza strada. Non è una seconda
  cornice: niente moduli, workspace, ricerca, notifiche, profilo né «+». «Esci» chiama `onLogout`, una voce chiama
  `onNavigate` col suo id, e la voce `active` porta `aria-current="page"`. I testi sono quelli della cornice, nella lingua
  del documento (`<html lang>`), in inglese se manca. È un pezzo a richiesta (`barra`, 420 byte con gzip): il layout lo
  chiede con `import()` solo quando la cornice non c'è, la pagina resta nello stesso posto quando arriva, e se non arriva si
  vede da sola. Costa 126 byte con gzip nel JS d'ingresso di chi usa il layout con React fuori (la prova del pacchetto); in un frontend che porta React nella build, misurato su zr-crm, +162 (la `v2.24.0` ne costava 278: il pezzo importava `react/jsx-runtime`, che diventava un chunk a sé, e dalla `v2.24.1` non importa niente: `createElement` glielo dà il layout); l'app che prende
  solo la cornice non cambia. **È provvisoria**: il design system non ha ancora la sua barra minima (è fra le richieste a
  Luciano), e questa è fatta coi soli suoi pezzi, `Logo` e `Button`. Quando la barra c'è nel design system questa si toglie
  e la sostituisce lui, con una versione che lo annuncia.
- **La pagina** dà alla cornice montata ciò che sa solo lei, con `useCornice`: le voci del prodotto (`nav`), la voce attiva
  (`active`), `onNavigate`, le voci del menu «+» (`create`) e il suo nome (`createLabel`, dalla `v3.6.0`: «Nuovo nel CRM»;
  senza, «Crea» nella lingua), le azioni in topbar (`actions`) e l'area senza margine (`flush`). Ciò che dà vince sulle
  props del layout finché la pagina è montata, e sparisce quando se ne va.
  Nessuna voce attiva si dice con `null`, dal layout (`active={null}`) o dalla pagina (`useCornice({ active: null })`): `null` è un
  valore, e quello della pagina vince anche su una voce data dal layout; ciò che la pagina non dà, o dà `undefined`, resta
  del layout. Le funzioni possono essere nuove a ogni render. Una chiamata sola per pagina, nella pagina o nel suo
  involucro, non in tutti e due: due chiamate non si sommano (ognuna sostituisce tutto ciò che ha dato l'altra, e quando
  una si smonta sparisce anche quello dell'altra). Il tipo di ciò che accetta è `CorniceDellaPagina`. Dove la cornice non
  c'è (senza dati, o fuori dal layout) non fa niente.
- **Ciò che dà la pagina** arriva alla cornice subito dopo il suo montaggio, prima che il browser disegni: un effetto di
  montaggio della pagina trova l'area ancora com'era (col margine, anche se la pagina dà `flush`), e chi la misura lo fa
  con un `ResizeObserver`. Con l'SSR di Inertia gli effetti non girano: l'HTML del server esce senza ciò che dà
  `useCornice`. Un elemento dato alla cornice (`actions`) si monta nella cornice, fuori dall'albero della pagina: non vede
  i provider di contesto, gli error boundary e i `Suspense` che la pagina ha intorno. E se due pagine danno un elemento
  dello stesso tipo, React tiene la stessa istanza col suo stato: una `key` diversa per pagina la rifà.
- **Il percorso** (`crumbs`, `onCrumb`) si dà dal layout, non con `useCornice`: sposta la pagina dentro un altro elemento
  della cornice, e dato dopo il montaggio la monterebbe due volte. Viene dai dati del server: la pagina lo dà con
  `Pagina.layout = (props) => ({ crumbs: … })`, una funzione a freccia, e il layout del frontend lo passa. La funzione dà
  sempre la chiave `crumbs`, anche `{ crumbs: undefined }` quando il percorso non c'è: con un oggetto vuoto (`{}`) Inertia
  toglie il layout intero, e quella pagina resta senza cornice. Un clic su una voce del percorso passa da `naviga`, dalla
  `v3.6.0`: non navigate da `onCrumb`.
- **Quando cambia il workspace** — una visita porta un altro slug nei dati — la cornice si rifà, e la pagina con lei: la
  ricerca coi suoi risultati, i pannelli e le notifiche sono di un workspace, e quelli di prima non restano davanti a chi
  è passato a un altro. Fra pagine dello stesso workspace resta montata.
- **Una `<Cornice>` rimasta in una pagina** sotto il layout fa due cornici, una dentro l'altra: chi passa al layout la
  toglie da ogni pagina che lo usa.
- **Le voci con un indirizzo** (la Dashboard, i prodotti, «Impostazioni» in fondo alla barra) sono link veri: il browser
  ricarica la pagina, e la cornice si rifà, a meno che il frontend dia `naviga`: dalla `v2.25.0` un clic semplice con un
  indirizzo di questa origine passa da lì (vedi «I collegamenti della barra laterale passano da `naviga`», qui sotto). Resta
  montata nelle visite di Inertia dentro il frontend.
- **L'area della pagina** è una `scroll-region` di Inertia: a ogni visita torna in cima, con Indietro torna dov'era, e una
  visita con `preserveScroll` la lascia dov'è. Con `flush` l'area non scorre: a scorrere è un elemento della pagina, che
  porta da sé l'attributo `scroll-region` se vuole lo stesso.

### La cornice in due dati

Dalla `v2.1.0` i dati della cornice si possono dare in due parti, per il frontend che non vuole aspettare il backoffice
prima del primo disegno. `Cornice::subito()` legge solo la sessione — lingua, persona, workspace — e non chiama mai il
backoffice; `Cornice::dopo()` legge dal backoffice ciò che `Cornice::dati()` legge da lì — `prodotti`, `aziende`,
`non_lette`, `aggiornati_il` e, per chi non ha accettato i documenti legali, `accettazione_richiesta` — e può arrivare
più tardi. `Cornice::dopo()` dà anche il `workspace` di cui sono quei dati: nel layout vale su quello di `subito`, così se
fra le due richieste la sessione è passata a un altro workspace (un'altra scheda) nome, slug e moduli sono dello stesso.
Dalla `v2.4.0` `Cornice::dopo()` dice anche di chi sono quei dati: porta `lingua` e `persona` come sono nella sessione
dopo quella lettura (la lingua e il nome riletti da io.mostra; l'email, quella dell'ingresso fino alla zr-auth 0.12.62 e
quella di io.mostra dalla 0.12.63) e, in fondo, `sessione_il`, il segno
di quella lettura. Nel layout valgono anche loro su quelli di
`subito`: se fra le due richieste la sessione è passata a un'altra persona la cornice è la sua, coi suoi dati, e i dati
di una persona non stanno sotto il nome di un'altra. Per un frontend che dà al layout `Cornice::dopo()` com'è non c'è
niente da scrivere, e tre cose si vedono. La lingua e il nome della cornice, quando `dopo` arriva, sono quelli riletti
da io.mostra, i più recenti. Dalla `v2.9.0`, con la stessa persona, vale la lingua del dato più recente anche se
`dopo` non è riletto: una pagina che rilegge il solo `subito` dopo che la persona ha cambiato lingua ha i testi della
cornice nella lingua nuova (a una visita era già così, perché `dopo` è richiesto di nuovo), e moduli, workspace e numero
delle notifiche restano quelli del `dopo` che c'è finché non è riletto (provato in Chromium 151 sulla pagina di prova del
layout). Il `subito` riletto porta la lingua nuova solo se la sessione l'ha già: `Cornice::subito()` non chiama il
backoffice, e la lingua della sessione la rileggono `Cornice::lingua()`, `dopo()` e `dati()`. Con `Cornice::lingua()` prima
del controller la rilegge la stessa richiesta; senza, e senza un'altra richiesta che l'abbia riletta dopo il `dopo` che la
pagina ha, il `subito` riletto ha la lingua di prima e niente cambia. Da `subito` passano la sola
lingua e il suo segno, e solo se `dopo` dice di chi è e il segno della lingua c'è da tutte e due le parti: senza, vale
`dopo` come prima.

Dalla `v2.11.0` la lingua ha un suo segno, `lingua_il`: `Cornice::subito()` e `Cornice::dopo()` lo portano dopo
`sessione_il`, in fondo (anche `non_letti`), ed è l'istante in cui è cominciata la lettura di io.mostra che ha confermato
la lingua della sessione per quella persona, cioè una lettura a cui io.mostra ha risposto con l'id della persona della
sessione. In `dopo` e in `subito` è quello che la sessione ricorda, mai l'istante di adesso: la lettura di `dopo` lo
porta avanti solo se io.mostra ha risposto per quella persona ed è più avanti di quello ricordato, e una lettura più
vecchia lo lascia com'è. La parte server lo ricorda nella sessione, alla chiave
`zr-core.lingua`, con l'id della persona: di un'altra persona entrata nello stesso browser non esce, e senza una lettura
che l'abbia confermata non c'è. Dalla `v2.11.4` una lettura più vecchia non cambia nemmeno la lingua della sessione: resta
quella confermata dalla lettura ricordata, e lingua e segno restano una coppia (fino alla `v2.11.3` la lingua superata
entrava nella sessione sotto il segno più nuovo, e a pari segno con `subito` la cornice la teneva). Il nome e le non
lette, quella lettura li porta come sempre. Resta il limite di due richieste in volo insieme: Laravel salva la sessione
intera alla fine di ognuna, e quella che finisce per ultima riscrive la lingua e il segno di quando era partita, una
coppia coerente ma vecchia, che il `dopo` successivo rimette avanti. Un segno della lingua ricordato avanti dell'orologio
di più di cinque minuti (l'ha dato un server del frontend con l'orologio avanti) non vale, come il cookie del segno: la
lettura lo sostituisce col suo. Fra `subito` e `dopo` della stessa persona la lingua è quella del dato col segno della
lingua più avanti; il segno della sessione decide come prima chi è a schermo, e la lingua no. Così si chiude il caso che
fino alla `v2.10.0` restava aperto: un `subito` riletto da solo mentre `dopo` è ancora in lettura ha il segno della
sessione più avanti, ma quello della lingua no, e la cornice non torna alla lingua di prima. E con Indietro su una pagina
della stessa persona letta dopo quella a schermo, ma con la lingua confermata prima, la lingua resta quella nuova, nello
stesso workspace e in un altro. Un `dopo` composto a mano senza `lingua_il` porta la sua lingua, come prima della
`v2.9.0`. Dalla `v2.11.1` due dati senza l'email della persona (composti a mano contro il tipo: l'email assente, vuota o
`null`) sono due persone per il layout, dove ne fa passare la lingua o il nome dall'uno all'altro: con una pagina più
nuova, nello stesso workspace o in un altro, la cornice ha la lingua della pagina; con una pagina più vecchia di un
altro workspace ha la lingua e il nome della pagina, non quelli di chi era a schermo. E dopo una pagina senza la cornice
una pagina senza l'email non rompe più il layout. Chi compone a mano senza l'email i dati di una persona sola perde ciò
che la `v2.11.0` gli dava: con Indietro su una pagina letta dopo, ma con la lingua confermata prima, torna la lingua di
allora. Una scheda rimasta ferma che rilegge il solo `dopo` dopo che la sessione è passata a
un'altra persona mostra la cornice di questa, rifatta, e la pagina con lei. E chi compone `dopo` a mano gli lascia
`lingua`, `persona` e `sessione_il`: senza, vale come prima della `v2.4.0`. Chi compone a mano i dati della cornice dà come
email della persona quella della sessione: con un'altra, campanella e ricerca non funzionano — ricaricano la pagina, dalla
`v2.9.0` al più una volta ogni 30 secondi (prima a ogni uso), e fra una ricarica e l'altra danno il loro errore, dalla
`v2.10.0` dopo 5 secondi.
Tutte e due danno `null` senza sessione o senza workspace. `Cornice::dati()` resta com'è, e chi manda solo
`cornice` non cambia niente.

Dalla `v2.15.0` la richiesta rimandata può costare una lettura di io.mostra in meno. Se prima del controller della pagina
c'è `Cornice::lingua()`, la sua lettura di io.mostra, quando riesce, resta nella sessione (alla chiave
`zr-core.io-mostra-rimandata`), e `Cornice::dopo()`, nella richiesta rimandata, la usa invece di rifarla: le non lette,
`aggiornati_il` e `sessione_il` sono quelli di quella lettura, e la pagina chiama /v1 una volta in meno. Il risparmio c'è
se nella richiesta rimandata il frontend non chiama `Cornice::lingua()`: con Inertia, la chiama solo dove la richiesta
chiede `subito` (senza `X-Inertia-Partial-Data`, o con `subito` dentro). Se la chiama anche lì, `Cornice::lingua()`
rilegge io.mostra e `Cornice::dopo()` usa quella, come prima: le letture restano quelle di prima. Per il resto il
frontend non fa niente, e dal browser non passa nessun dato in più. La lettura tenuta vale a quattro condizioni, tutte
dalla parte server: la stessa persona, lo stesso workspace, il segno ancora quello che la sessione ricorda per la lingua
di quella persona (una lettura fatta dopo, in un'altra richiesta, lo porta avanti), e al più 10 secondi da quando è stata
tenuta, contati sull'orologio del server (una lettura tenuta da un server con l'orologio più avanti di quello che la usa
non vale). E vale una volta sola: `Cornice::dopo()` la toglie dalla sessione, che la usi o no; due richieste della stessa
sessione in volo insieme possono però usarla tutte e due, perché Laravel salva la sessione intera alla fine di ognuna. Una
lettura fallita non resta, toglie quella di prima, e la richiesta rimandata rilegge. Il cambio di workspace la toglie alla
prima richiesta nel workspace nuovo che chiama `Cornice::subito()`, `Cornice::lingua()`, `Cornice::dati()` o
`Cornice::dopo()`, e l'uscita la toglie chiudendo la sessione. `Cornice::lingua()` e `Cornice::dati()` non la prendono:
leggono come sempre (in una stessa richiesta `Cornice::dopo()` va dopo `Cornice::lingua()`, come il middleware prima del
controller). Con due schede della stessa persona nello stesso workspace, la richiesta rimandata dell'una può prendere la
lettura fatta per la pagina dell'altra: sono dati della stessa persona, di meno di 10 secondi, col loro segno. Ciò che il
controller della pagina cambia dopo `Cornice::lingua()` — una notifica segnata come letta in quella richiesta — con la
richiesta rimandata che usa quella lettura arriva alla campanella con la visita dopo.

Sulla rotta della richiesta rimandata il frontend non mette niente: né un middleware suo, né `bloccaSessione()` di zr-auth,
che terrebbe il blocco della sessione fino a 10 secondi e metterebbe in fila le richieste della persona: ognuna aspetterebbe
al più 3 secondi, e poi riceverebbe 503 (fa eccezione la pagina che è anche la rotta di `entra()`: qui sotto). Quella richiesta arriva
quando la pagina è già in mano alla persona, e `Cornice::dopo()` scrive nella sessione la lingua e il nome riletti
(`Sessione::aggiorna`): Laravel, a fine richiesta, salva la sessione che aveva letto all'inizio, sotto l'id di allora, e
senza una protezione una richiesta rimandata lenta, finita dopo che la persona è uscita o è passata a un altro workspace,
rimetterebbe in vita la sessione di prima. La protezione è `SessioneChiusa` di zr-auth, dalla 0.12.31, ed è per questo che
dalla `v2.16.0` zr-core chiede zr-auth dalla 0.12.31: l'uscita e il cambio di workspace cambiano l'id della sessione e
segnano chiuso il vecchio, e una richiesta partita con l'id chiuso non lo rimette in vita. Il gettone non si perde: zr-auth
lo cambia solo entrando, cambiando workspace o uscendo, mai dentro la stessa sessione (risposta di zr-backoffice del
14/10/2026, letta nel codice di zr-auth). La protezione vale a quattro condizioni, tutte dalla parte del frontend: la rotta
della richiesta rimandata, cioè la pagina stessa, sta nel gruppo `web`; `session.block_store` è uno store condiviso fra i
processi, mai `array`, che spegne la protezione senza dirlo (non impostato è lo store della cache predefinito, e vale lo
stesso per quello); l'ordine del gruppo `web` non si riordina (`SessioneChiusa`
ne è il primo); e `zr-auth.sessione_chiusa_secondi` (300) non è più corto della richiesta più lenta. Resta ciò che vale
per ogni sessione di Laravel: fra due richieste della stessa sessione in volo insieme vince quella che finisce per
ultima, e la lingua e il nome si riallineano alla pagina dopo.

Se la pagina è insieme la rotta della richiesta rimandata e una rotta che chiama `Sessione::entra()` (una pagina d'ingresso
che porta anche i dati della cornice), il blocco della sessione (`bloccaSessione()`, il `Route::block` di Laravel) va sulla visita intera e mai sulla
richiesta parziale `dopo`, quella che Inertia manda con `X-Inertia-Partial-Data`. Il macro vale per la rotta, e le due richieste
passano dalla stessa: non le distingue. Il frontend lo prende con un suo middleware, prima di `StartSession` (che legge il blocco
della rotta quando la sessione parte): `$richiesta->route()->block(Sessione::BLOCCO_TENUTA, Sessione::BLOCCO_ATTESA)` se
l'intestazione manca, e niente se c'è; il blocco tocca solo la prima. Vale a condizione che la parziale non chiami `entra()`:
una parziale che la chiama non è coperta da questa regola, e il frontend lo dice a zr-core (risposta a zr-home del 14/10/2026,
voce #2115).

Dalla `v2.4.0` anche l'elenco delle notifiche e la ricerca dicono di chi sono: le due rotte danno `persona`, l'email della
persona della sessione. In una scheda rimasta ferma, senza visitare niente, la sessione può passare a un'altra persona, anche
sullo stesso workspace: quando lì si apre la campanella o si cerca, la risposta è di chi è entrato. La cornice non la mostra
sotto il nome di prima, nemmeno per un disegno: ricarica la pagina, che da lì è di chi è entrato, e fino ad allora il pannello
resta in caricamento. Dalla `v2.9.0` questa ricarica, e le altre dette qui sotto, hanno un tetto e un orologio: su una
pagina caricata da meno di 30 secondi non partono prima che li compia — dalla `v2.10.0` partono allora, da sole —, e se
la pagina non si ricarica la richiesta dà il suo errore dopo 5 secondi. Una risposta che non dice di chi è (una parte
server di prima della `v2.4.0`) vale come prima, e per la
stessa persona non cambia niente. Dalla `v2.5.0` lo dicono anche gli errori di quelle rotte: il 403 `accettazione_richiesta`
e il 429 della ricerca portano `persona`. In una scheda rimasta ferma l'errore di chi è entrato non riduce la cornice e non
ferma la ricerca sotto il nome di prima, nemmeno per un disegno: la pagina si ricarica, come per una risposta coi dati. Lo
stesso per il 403 della lettura di una notifica con un clic (`PATCH /cornice/notifiche/{id}/lettura`): se arriva prima che la
risorsa si apra, la pagina si ricarica al suo posto. Il 403
che zr-auth dà da sé (con `codice`) non dice di chi è, e vale come prima. Chi è entrato senza scegliere ancora un
workspace riceve dalle quattro rotte il 403 `gettone_senza_workspace`: nella `v2.10` e nella `v2.11` portava `persona`,
l'email della sessione, e una scheda rimasta ferma di chi c'era prima si ricaricava da lì. Dalla `v2.12.0` a quella scheda
risponde prima la regola della persona, col 409 `persona_diversa`, e la scheda si ricarica con le stesse regole delle altre
risposte di un'altra persona; il 403 arriva solo alla persona della sessione (una richiesta che non dice la persona riceve
prima, dalla `v2.13.0`, il 422 `persona_mancante`), e porta il solo codice (né nome, né lingua, né workspace, né un'email): per la persona a schermo è l'errore di sempre, senza
ricarica, e il backoffice non si chiama. Con una sessione senza email una richiesta che dice la persona riceve il 409, e una
che non la dice il 422 `persona_mancante` (fino alla `v2.12` il 403). Fino alla `v2.9.0` quella scheda dava solo il suo errore.
Dalla `v2.5.0` anche «Segna tutte come lette» dice per chi lo chiede: la cornice manda `persona`, l'email di chi mostra, e la
rotta la confronta con quella della sessione. In una scheda rimasta ferma, se la sessione è passata a un'altra persona dello
stesso workspace, la rotta non segna niente e risponde 409 `persona_diversa` (fino alla `v2.11` con l'email di chi è
entrato, dalla `v2.12.0` con `persona` vuota): le sue notifiche restano da leggere, l'elenco a schermo non è dato per letto, e la pagina si ricarica. Una richiesta senza `persona` (il JS di
una versione di prima, rimasto in una scheda) vale come prima: la rotta guarda solo il workspace. Assente è la sola chiave
che manca: dalla `v2.5.1` una `persona` che c'è e non è un testo, anche `null`, è un 422 `dati_non_validi`, e la rotta non
segna niente. Nemmeno con una `persona` vuota (`""`): dalla `v2.6.0` è quel 422 anche dove il frontend non ha
`ConvertEmptyStringsToNull`, che Laravel monta di suo (fino alla `v2.5.1` lì era un 409 `persona_diversa`).
Dalla `v2.6.0` la cornice dice per chi chiede in tutte e quattro le richieste, nell'intestazione `Persona` e non più nel
corpo, e la rotta risponde quel 409 a ognuna («Le rotte della cornice»): da una scheda rimasta ferma nemmeno il clic su una
notifica la segna letta a chi è entrato. Fino alla `v2.13` la sua risorsa si apriva solo se arrivava prima di quel 409: se no la
pagina si ricaricava al suo posto, come per il 403 qui sopra (provato in Chromium 151: «Le rotte della cornice»). Dalla `v2.9.0`, su
una pagina caricata da meno di 30 secondi, né quel 409 né quel 403 la ricaricano prima che li compia; dalla `v2.11.5` lì
il clic aspetta la risposta, e davanti a uno dei due la risorsa non si apre: niente è segnato, e niente si apre con la
sessione di chi è entrato (fino alla `v2.11.4` si apriva). Nell'attesa niente lo dice a schermo: il pannello si chiude e la
notifica resta non letta. Dalla `v2.13.0` un secondo clic sulla stessa notifica, mentre la sua lettura non ha risposto, non
fa niente: nessun'altra lettura, e all'arrivo la risorsa si apre una volta (fino alla `v2.12` partiva un'altra lettura, e la
risorsa si apriva due volte); arrivata la risposta, un altro clic vale come il primo. Nella `v2.13` un secondo clic su
un'altra notifica faceva la sua lettura, e all'arrivo la cornice le apriva tutte e due; con A, B e di nuovo A la lettura di A
ripartiva, e A si apriva due volte. Dalla `v2.14.0` il clic aspetta la lettura su ogni pagina, anche di 30 secondi o più (fino
alla `v2.13` lì la risorsa si apriva subito, e con la sessione di chi era entrato in un'altra scheda), e la cornice tiene una
lettura sola in volo: un clic su una notifica qualsiasi, mentre è in volo, non fa niente — nessuna lettura, nessuna
apertura —, e nemmeno quello su «Vedi tutte» o su una notifica senza destinazione, che altrimenti aprono subito la pagina
delle notifiche; alla risposta o all'errore la dimentica, e un altro clic vale come il primo. La lettura non ha un tempo
massimo: se la rete la tiene appesa, nessun clic sulle notifiche apre niente finché la pagina non si ricarica. Con A, B e di nuovo A parte la lettura di A
sola, e alla risposta si apre A, una volta. Una lettura a cui risponde un'altra persona non risponde mai alla cornice: fino alla ricarica della pagina nessun clic su una
notifica apre niente. E la risorsa si apre solo se chi ha fatto il clic è ancora a schermo quando la lettura risponde: se nel
mezzo una visita ha portato la cornice di un'altra persona, entrata in un'altra scheda, o la cornice non c'è più, la lettura
non riesce e non si apre niente (dalla `v2.14.0`).
Una scheda rimasta ferma mostra ciò che aveva — elenco, numero della campanella, risultati — finché da lì non parte una
richiesta: la cornice sa di chi è la sessione solo da una risposta.
Dalla `v2.7.0` la pagina si ricarica solo se a schermo c'è una cornice che non è di chi ha risposto: se una visita ha già
portato chi è entrato e la cornice si è rifatta, una risposta in ritardo a una delle quattro richieste, chiesta da chi
c'era prima, non ricarica la sua pagina, e niente di quella risposta va a schermo (provato in Chromium 151 con l'elenco
delle notifiche). Dalla `v2.12.0` questo vale solo per una risposta che dice chi ha risposto: le quattro richieste mandano
`Persona`, e l'unica risposta di un'altra persona che ricevono è il 409 `persona_diversa`, che non lo dice più: con una
cornice a schermo quel 409 ricarica la pagina anche quando una visita ha già portato chi è entrato (più sotto). Una pagina senza la cornice non si ricarica: lì non c'è nessuno a schermo. Questo vale per ciò che c'è
a schermo quando arriva la risposta: dalla `v2.10.0` un orologio dei 30 secondi già partito guarda di nuovo allo scadere
(più sotto). Se chi ha risposto è una
terza persona — né chi ha chiesto né chi è a schermo — la pagina si ricarica, e dopo è di chi è nella sessione: anche
quando a schermo c'è già lei, entrata dopo quella risposta, perché il browser non sa chi è nella sessione. La regola conta
su una cornice sola nel documento. Con due, a schermo è quella montata per ultima fra quelle ancora montate: le tiene una
pila, e una cornice che si smonta toglie solo sé stessa (dalla `v2.17.1`): se la cornice di chi ha risposto si monta prima
che quella di prima sia smontata, a schermo resta la sua, e allo scadere dei 30 secondi la sua pagina non si ricarica (fra
persone diverse dalla `v2.11.5`, con la stessa persona dalla `v2.17.1`); smontata la cornice montata per ultima, a schermo
torna quella rimasta, anche se è della stessa persona. Fino alla `v2.17.0` nel secondo caso, e nel primo con la stessa
persona, per la cornice nessuno era a schermo: una scheda ferma lì non si ricaricava, un orologio dei 30 secondi già
partito, allo scadere, ricaricava la pagina anche con la cornice di chi aveva risposto, e il clic su una notifica non apriva
la risorsa. Dalla `v2.17.1` la apre anche quando la cornice del clic si è smontata con la lettura in volo, se a schermo c'è
ancora la stessa persona in un'altra cornice. Fino alla `v2.19` restava un limite: la cornice riconosceva chi è a schermo
dall'email, e con A, poi B, poi di nuovo A, smontata una delle due cornici di A, a schermo restava A anche quando la A
rimasta era quella montata prima di B. Dalla `v2.20.0` la pila tiene le persone delle cornici, con la loro impronta, e
ognuna toglie sé stessa: smontata la A montata dopo B, a schermo torna B.
Se il ricaricamento non avviene — la pagina chiede conferma prima di essere lasciata (`beforeunload`) e la persona sceglie di
restare — chi ha chiesto non resta in attesa per sempre (dalla `v2.9.0`): dopo 5 secondi la richiesta si chiude con un
errore. «Segna tutte come lette» si può premere di nuovo, il pannello aperto dice «Non riusciamo a caricare le notifiche»
con «Riprova», la ricerca il suo avviso. Niente di chi è entrato va a schermo, nemmeno nell'errore, e prima dei 5 secondi
niente cambia: il pannello in caricamento, «Segna tutte come lette» in corso. Fino alla `v2.8.0` chi aveva chiesto restava
in attesa finché la pagina non si ricaricava. L'orologio dei 5 secondi parte a ogni ricarica chiamata, non solo quando è
annullata: se la pagina nuova tarda più di 5 secondi, quella che sta per andarsene dice lo stesso il suo errore, senza
niente di chi è entrato (letto nel codice: una ricarica lenta non è provata in un browser). Con due cornici nel documento,
fino alla `v2.17.0`, valeva il limite detto qui sopra: lì la pagina non si ricaricava, nessun orologio partiva, e chi aveva
chiesto restava in attesa, se il limite c'era già quando la risposta arrivava. Provato in Chromium 151 con una pagina che nega il
ricaricamento: passati i 5 secondi «Segna tutte come lette» torna premibile, e il pannello e la ricerca dicono il loro errore.
Dalla `v2.9.0` la ricarica ha un tetto, ed è l'età della pagina: una pagina caricata da meno di 30 secondi non si ricarica
davanti a una risposta di un'altra persona prima di compierli. Subito dopo una ricarica, se la risposta lo dice ancora —
dei dati composti a mano con un'altra email —, ricaricare di nuovo non cambierebbe niente: chi ha chiesto ha
l'errore di sempre, il pannello con «Riprova» e la ricerca col suo avviso, dalla `v2.10.0` dopo 5 secondi come sopra i 30
(nella `v2.9.0` senza aspettare). Di quella risposta niente è disegnato e
niente è tenuto, come quando la pagina si ricarica (l'orologio dei 30 secondi, sotto, tiene solo chi ha risposto). Da 30 secondi in poi la pagina si ricarica come prima: al più una
ricarica ogni 30 secondi. Per ricordarselo il pacchetto non scrive niente nel browser — né `sessionStorage`, né
`localStorage`, né il nome della finestra, né un cookie —: guarda l'orologio della pagina (`performance.now()`), e
all'uscita non c'è niente da togliere. Dalla `v2.10.0` la cornice di chi c'era prima non resta a schermo oltre i 30
secondi: una pagina che ha ricevuto la risposta di un'altra persona nei suoi primi 30 secondi si ricarica da sola quando li
compie, senza un clic e senza un'altra richiesta. Salvo due eccezioni: la ricarica allo scadere si chiede una volta sola, e
se la pagina la annulla (`beforeunload`) la cornice di prima resta finché da lì non parte un'altra richiesta; in una
scheda nascosta il browser può far scadere l'orologio più tardi (in una congelata, solo quando la riattiva). Fino alla `v2.17.0` ce n'era una terza: con due
cornici nel documento, se il limite c'era già quando la risposta arrivava, nessun orologio partiva (detto sopra). Fino allo scadere l'orologio tiene della risposta solo chi ha
risposto, che gli serve allo scadere (dalla `v2.11.3`): i dati e il resto il browser li può buttare subito. Allo scadere la
cornice riguarda chi è a schermo: se una visita ha già
portato chi ha risposto, la sua pagina non si ricarica; una pagina rimasta senza cornice sì. Dalla `v2.12.0` il 409
`persona_diversa` non dice chi ha risposto (`persona` è un testo vuoto): davanti a quello, se a schermo c'è una cornice,
la pagina si ricarica anche quando una visita ha già portato un'altra persona — una ricarica in più, e ciò che ci ha
scritto si perde. I casi che restano sono due. Una richiesta partita più di 30 secondi dopo una ricarica che non ha cambiato niente ne dà un'altra.
E una pagina senza cornice allo scadere — una visita a una pagina senza la cornice (fino alla `v2.17.0` anche il
limite delle due cornici) — si ricarica anche se ormai è di chi ha risposto: ciò che ci ha scritto si perde. Provato in Chromium 151, con la `v2.9.0`: l'età della pagina riparte da zero a ogni ricarica. La ricarica allo
scadere dei 30 secondi è provata il 14/10/2026 in Chromium 151, con la `v2.10.0` sulle pagine di prova: una risposta di
un'altra persona a pagina appena caricata dà l'errore del pannello dopo 5 secondi e la pagina si ricarica quando ne compie
30, una volta; se prima una visita ha portato chi ha risposto, la pagina non si ricarica; con una risposta che dice sempre
un'altra persona, tre caricamenti in 70 secondi, a 30 secondi l'uno dall'altro; e lo stesso col 403
`gettone_senza_workspace` di un'altra persona.

**L'evento prima della ricarica.** Dalla `v2.13.0`, subito prima di ricaricare la pagina per un cambio di persona — una
risposta di un'altra persona alla campanella, alla ricerca, alla lettura di una notifica o a «Segna tutte come lette» —
la cornice manda sulla `window` un evento `zr-core:altra-persona` (un `Event` semplice, senza dati). Dalla `v2.17.0` lo
manda anche subito prima delle due ricariche per la pagina di un'altra persona senza il segno della lettura (Indietro sulla
voce di chi c'era prima: con `LayoutDellaCornice` la fa il layout, con la `Cornice` montata da sola la cornice). Lì l'evento
parte mentre React disegna: chi lo ascolta ricorda che è successo, come nell'esempio qui sotto, e non aggiorna lo stato di
un componente. Quando la pagina non
si ricarica l'evento non parte: una risposta della persona a schermo, una visita che ha già portato chi ha risposto, una
pagina senza cornice. Parte una volta per ricarica chiesta, anche se poi la pagina la annulla (`beforeunload`). Il
pacchetto non mostra niente e non scrive niente nel browser: se dopo la ricarica il frontend vuole dire perché la pagina
si è aggiornata («Nel browser è cambiato l'accesso…», col suo testo e nelle sue lingue), ricorda lui che è successo, in
questa scheda, e niente della persona:

```ts
// Nel frontend, una volta, prima che la cornice si monti. L'archivio può essere chiuso (SecurityError): allora niente avviso.
addEventListener('zr-core:altra-persona', () => { try { sessionStorage.setItem('accesso-cambiato', '1'); } catch {} });
let accessoCambiato = false; // dopo la ricarica: l'avviso, una volta
try {
    accessoCambiato = sessionStorage.getItem('accesso-cambiato') !== null;
    sessionStorage.removeItem('accesso-cambiato');
} catch {}
```

La pagina di prova del layout lo fa con `?sessione`: dopo «UAT entra un'altra persona» e la ricarica mostra un avviso.

In tutti questi casi la cornice riconosce la persona dall'email. L'email c'è sempre perché la garantisce il contratto del
backoffice: nelle API `/v1` l'email di una persona è obbligatoria, in ogni gettone. zr-auth la porta nella sessione com'è, e
non la controlla.

Dalla zr-auth 0.12.63 l'email può cambiare a sessione aperta (il cambio dell'email di zr-home), e per la cornice la stessa
persona con l'email nuova è un'altra persona. Nella scheda in cui cambia, i primi dati che la portano (un `dopo`, o la
pagina dopo) rifanno la cornice e la pagina del frontend con lei, e ciò che tenevano si perde; con Indietro una pagina di
prima del cambio vale come la pagina di un'altra persona. In un'altra scheda rimasta aperta
la prossima richiesta della cornice passa (dalla `v2.23.0`; fino alla `v2.22` riceveva il 409 `persona_diversa` e la pagina
si ricaricava): la scheda ha la stessa impronta, la risposta dice `persona` com'è nella pagina e la scheda non si ricarica,
ma mostra l'email di prima finché non si ricarica o non si cambia pagina.

Con Inertia la seconda è una prop rimandata. zr-core non importa Inertia: `Inertia::defer` lo scrive il frontend.

```php
// Nel frontend, fra le props condivise con la pagina.
'subito' => fn () => Cornice::subito(),
'dopo' => Inertia::defer(fn () => Cornice::dopo()),
```

```tsx
<LayoutDellaCornice subito={subito} dopo={dopo} product="pm" onLogout={esci}>
    {children}
</LayoutDellaCornice>
```

**Tre cose un frontend non le fa**, perché `subito` e `dopo` siano sempre della stessa persona: **non rilegge `subito`
senza `dopo`** (un ricaricamento parziale con `only`, che chiede la sola prop `subito`), **non tiene `subito` con `once`**,
e **non compone `dopo` a mano** (chi proprio lo fa gli lascia `lingua`, `persona` e `sessione_il`, come detto sopra).
Se succede — alla pagina arriva il `subito` di chi è entrato e fra le props resta il `dopo` di chi c'era — dalla `v2.5.0`
i dati di prima non vanno sotto il nome nuovo: un `dopo` di un'altra persona, letto con una sessione più vecchia di
quella di `subito`, non vale, e **la cornice resta in attesa di un `dopo` di chi è entrato**: ridotta, col suo nome e la
sua lingua, finché la pagina non lo rilegge o non fa una visita. Per la stessa persona il `dopo` vale anche sotto un
`subito` riletto dopo di lui, coi suoi dati e il suo nome, senza attesa; la lingua è quella di `subito` se è sua la
lingua confermata dopo (dalla `v2.11.0`, col segno della lingua; nella `v2.9.0` e nella `v2.10.0` col segno della sessione).
Un `dopo` che non dice di chi è,
o un segno che manca da una delle due parti, si unisce a `subito` come prima della `v2.5.0`.

I tipi delle due parti escono dai due ingressi, dalla `v2.2.0`: `DatiSubito` e `DatiDopo` (`resources/js` e
`resources/js/app`), gli stessi di `subito` e `dopo` del layout.

Che cosa vede la persona:

- **finché `dopo` non arriva** la cornice è montata e ridotta: il nome della persona e quello del workspace al loro
  posto, nel menu la sola Dashboard, nessun avviso. Dalla `v2.2.0` campanella e ricerca sono nello stato di
  caricamento, non in quello d'errore: il pannello aperto e il riquadro sotto una parola dicono che stanno caricando,
  senza «Riprova». Se la cornice ha già i dati di quel workspace, da una pagina di prima, restano quelli finché non
  arrivano i nuovi; dalla `v2.2.0` la persona e la lingua sono quelle di `subito` della richiesta nuova: se la sessione
  è cambiata da un'altra scheda, il menu del profilo non mostra chi c'era prima. Dalla `v2.3.0` ciò che la cornice tiene è
  della persona che lo ha visto, e la persona è la sua email: se `subito` dice un'altra email sullo stesso workspace — la
  sessione è passata a un'altra persona da un'altra scheda, o uscendo ed entrando — la cornice si rifà, e la pagina con
  lei, come quando cambia il workspace. Riparte ridotta come a un primo caricamento: nessuna azienda, nessun modulo e
  nessun numero di non lette di chi c'era prima, e nemmeno il suo elenco delle notifiche, i suoi risultati e la parola che
  aveva scritto nella ricerca. Con la stessa email e un altro nome o un'altra lingua i dati che ci sono restano, come
  prima. Vale anche con la `cornice` intera, e per chi monta `Cornice` senza il layout: un'altra email rifà la cornice. Una pagina ripresa
  dalla cronologia con Indietro porta il `subito` di allora: dalla `v2.3.0` `Cornice::subito()` dà anche `sessione_il`, il
  segno dell'istante in cui ha letto la sessione, e una pagina col segno più indietro di chi la cornice mostra non cambia la
  persona. Nome, email e lingua restano quelli di chi è entrato, sia in attesa sia quando arriva un `dopo` letto di
  nuovo, che è suo e lo dice. Se la voce della cronologia porta anche il suo `dopo` di allora, quei dati non valgono: restano quelli di
  chi è entrato, e se li sta ancora aspettando la cornice resta ridotta fino alla visita dopo, perché Inertia un `dopo` che
  la voce ha già non lo richiede. Dalla `v2.4.0` vale anche fra due workspace: il layout rifà la cornice a ogni
  workspace, e chi è mostrato lo tiene lui, sopra: è chi ha il segno più avanti, e non torna indietro, per quante voci si
  ripercorrano con Indietro e Avanti. Con Indietro su una pagina di chi c'era prima in un
  altro workspace la cornice resta quella di chi è entrato, col suo workspace e i suoi dati, e non si rifà. Se a quella
  voce manca il `dopo`, quello riletto è di chi è entrato, col suo workspace, e sta sotto il suo nome. Per la stessa
  persona cambia una cosa sola: con Indietro su una sua pagina di un altro workspace la cornice è quella di quel workspace,
  coi dati di allora, ma col nome e la lingua di adesso, non con quelli di allora
  (chi monta `Cornice` senza il layout era già così: lì i dati di una pagina più vecchia di un'altra persona non
  valgono in nessun workspace). Dalla `v2.8.0` nemmeno dei dati senza il segno riportano chi c'era prima — un `subito`
  composto a mano senza `sessione_il`, una `cornice` intera senza `aggiornati_il`: se la pagina è di un'altra persona e il
  segno manca da una delle due parti, la cornice non ne mostra niente, nemmeno il contenuto, e ricarica la pagina, che torna
  di chi è entrato; sotto il layout anche quando la voce di chi c'era prima è di un altro workspace, dove la cornice si
  rifà: lì lo guarda il layout (provato in Chromium 151 sulle pagine di prova, con `?segno=no`, nello stesso workspace e
  in un altro). Senza il segno non può distinguere Indietro da una visita: anche a una visita che porta un'altra persona
  la pagina si ricarica; ricaricata, la cornice parte da chi dice la pagina e non ricarica più. Un tetto alle ricariche non
  c'è: una pagina che a ogni caricamento desse senza segno prima una persona e poi un'altra — un `subito` di una e un `dopo`
  dell'altra — si ricaricherebbe ogni volta. Il tetto che dalla `v2.9.0` hanno le ricariche davanti a una risposta di
  un'altra persona non copre questa: fermata, lascerebbe la pagina vuota, senza un «Riprova». Della stessa persona, senza il segno, vale la pagina come prima. Restano due limiti. La
  cornice sa chi ha mostrato solo finché resta montata: dopo un caricamento da
  capo non sa chi c'era, e una
  pagina di prima che il browser ridà senza richiederla è quella di allora per intero, cornice e contenuto; con Inertia
  lo è anche a un caricamento da capo fatto con Indietro o Avanti, perché il client mostra la voce che aveva salvato. E
  un `dopo` senza `persona` e `sessione_il` — composto a mano, o di una voce della cronologia salvata prima della
  `v2.4.0` — vale come prima: se lo ha riletto un'altra persona su una voce lasciata prima che arrivasse, tiene i dati
  di quella sotto il `subito` di allora. Con `Cornice::dopo()` della `v2.4.0` no: quella voce è per intero di chi l'ha
  riletta, e se poi la sessione torna a chi c'era, con Indietro su quella voce restano il suo nome e i suoi dati. Il contenuto
  della pagina, poi, la cornice non lo tocca mai: con Indietro è quello di allora anche se la persona è cambiata. Per
  questo all'uscita il frontend toglie la cronologia: con la cronologia cifrata di Inertia (`inertia.history.encrypt` a
  `true`, o `Inertia::encryptHistory()` nella richiesta; serve HTTPS) la risposta dell'uscita chiama
  `Inertia::clearHistory()`, e una voce di prima non si legge più: Inertia la richiede alla parte server, che risponde con
  la sessione di adesso:

  ```php
  // config/inertia.php
  'history' => ['encrypt' => true],

  // la rotta dell'uscita, chiusa la sessione
  Inertia::clearHistory();

  return redirect('/');
  ```

  La cronologia che si toglie è quella della scheda che riceve la risposta dell'uscita: la chiave con cui Inertia la cifra
  sta nel `sessionStorage` di quella scheda, e il client la toglie quando gli arriva una pagina di Inertia col segnale.
  Se l'uscita rimanda a una pagina che non è di Inertia (l'ingresso), il segnale arriva con la prima pagina di Inertia
  servita dopo: provalo nel tuo frontend prima di contarci. In una scheda rimasta aperta mentre la sessione cambia da
  un'altra la
  cronologia resta leggibile: lì vale solo ciò che la cornice fa da sé, e il contenuto delle pagine di prima resta.
  Senza avviso la pagina tiene la sua
  forma: una pagina a tutta area (`flush`) lo è dal primo disegno. E la campanella aperta in attesa chiede già l'elenco,
  e il pannello lo mostra quando `dopo` arriva; una parola scritta nella ricerca in attesa non parte subito: quando
  `dopo` è arrivato la cornice cerca ciò che c'è nel suo campo in quel momento, se ha almeno due caratteri ed è cambiato
  da quando l'attesa è cominciata, dovunque sia il fuoco, e non cerca niente se al posto dei dati arriva `non_letti` o
  l'accettazione dei documenti legali. Dalla `v2.5.1` una parola cancellata prima dell'arrivo non viene più cercata, e sotto una parola
  battuta un attimo prima dell'arrivo si legge il caricamento, non «Nessun risultato»: parte all'arrivo, una volta sola.
  Tre limiti restano. Una parola che era già nel campo quando l'attesa è cominciata — rimasta da una ricerca di prima,
  o scritta e non ancora cercata — non parte all'arrivo: al ritorno nel campo sotto si legge «Nessun risultato» finché
  la persona non la ritocca. Il campo è quello della prima `AppShell` del documento: di cornici ce n'è una per pagina,
  e una seconda leggerebbe il campo della prima. E i due caratteri si contano come li conta l'`AppShell`: un'emoji da
  sola ne vale due, parte, e la rotta la rifiuta con un 422;
- **quando `dopo` arriva** la cornice diventa quella di sempre, e la pagina non si rimonta: ciò che la persona stava
  scrivendo in un campo, il fuoco e lo scorrimento restano. Solo se `dopo` è di un'altra persona (un'altra email: la
  sessione è passata a lei fra le due richieste), o di un altro workspace, la cornice si rifà, e la pagina con lei;
- **se il backoffice non risponde** (la connessione, un 5xx, un 429; dalla `v2.17.0` anche un 404, un 409 o un 422, e
  una risposta che la cornice non sa leggere) `Cornice::dopo()` non lancia: dà
  `['non_letti' => true]` col segno della lettura (`aggiornati_il`) e lascia nel log una riga d'avviso, col solo tipo
  dell'errore: un `non_letti` letto prima dei dati che la cornice ha non la riduce. La cornice resta ridotta, con
  l'avviso «Zeiras non risponde» sopra la pagina, senza pulsante (`downTitle` e `downText`; campanella e ricerca dicono
  `downOff`; dalla `v3.7.0` quando arriva il pezzo dei testi degli avvisi, come per l'accettazione), e la pagina resta dov'è. Ogni altro errore di `/v1` — un 403, che dice che la persona non ha più accesso
  e che la cornice ridotta nasconderebbe, un 401 `cliente_non_riconosciuto`, un 400, un 410… — e `GettoneRifiutato`
  passano, come da `Cornice::dati()`, e li tratta il frontend come prima (il 403 `accettazione_richiesta` no: dà i dati
  ridotti). Fino alla `v2.16.0` passavano anche il 404, il 409 e il 422, e una risposta guasta usciva come un errore PHP:
  un frontend che per quei casi compone `dopo` a mano attorno a `Cornice::subito()` dalla `v2.17.0` può togliere la sua
  composizione e dare `Cornice::dopo()` com'è. Dalla `v2.7.0` anche `non_letti` dice di chi è: dopo quelle due chiavi porta
  `lingua`, `persona`, `workspace` e in fondo `sessione_il`. I primi tre sono letti dalla sessione dopo il fallimento,
  come li legge `Cornice::subito()` — senza un'altra chiamata al backoffice, e senza niente di ciò che il backoffice dà.
  I due segni, `aggiornati_il` e `sessione_il`, sono l'istante in cui la lettura è cominciata, come nei dati riusciti,
  e non quello in cui è fallita (fino alla `v2.6.0` `aggiornati_il` era l'istante del fallimento) — anche quando
  io.mostra l'ha già letta `Cornice::lingua()` prima del controller: un `non_letti` arrivato tardi non vale sopra i
  dati di chi è entrato mentre il backoffice non rispondeva. Dalla `v2.11.0` dopo `sessione_il` c'è anche `lingua_il`,
  come in `Cornice::subito()`: quello ricordato per la persona, che questa lettura porta avanti solo se io.mostra ha
  risposto per lei ed è più avanti. Se fra
  `subito` e `dopo` la sessione è passata a un'altra persona, la cornice ridotta porta il nome e l'email di questa, nella
  sua lingua, e non quelli di chi c'era prima: la cornice si rifà, e la pagina con lei — ciò che la persona stava
  scrivendo si perde, come per un `dopo` di un'altra persona —, e lo stesso con un `non_letti` di un altro workspace.
  Un `non_letti` di un'altra persona più vecchio del `subito` che la pagina ha non si unisce, come un `dopo` intero: la
  cornice resta in attesa, senza avviso, finché non arriva un altro `dopo` (fino alla `v2.6.0` usciva «Zeiras non
  risponde»). Se intanto la sessione è finita — chiusa, o col gettone scaduto — `Cornice::dopo()` dà `null`, come senza
  sessione, e nel log non scrive niente;
- **a chi non ha accettato i documenti legali** resta lo stato ridotto di sempre, col suo avviso e il suo pulsante.

La lingua e il nome di `Cornice::subito()` sono quelli dell'ingresso finché una `Cornice::dopo()`, una `Cornice::dati()` o
una `Cornice::lingua()` non hanno riletto io.mostra: dalla richiesta dopo sono quelli nuovi, e dalla zr-auth 0.12.63 anche
l'email. Dalla `v2.4.0` quelli
riletti arrivano già con `dopo`, e la cornice li mostra da quel momento. Se c'è `cornice`, il layout
usa quella e non guarda `subito` e `dopo`.

Due cose da sapere. Se la richiesta rimandata non arriva al browser la cornice resta in attesa — la rete che cade, un
errore del frontend, un 403 di `/v1`, che `Cornice::dopo()` lascia passare: zr-core non lo vede. Il frontend che lo
vede può dirlo da sé, con `dopo={{ non_letti: true }}`, e la cornice mostra l'avviso: un `non_letti` composto a mano,
che non dice di chi è, resta sotto il nome di `subito`, e chi lo compone nella sua parte server lo dà come
`Cornice::dopo()`, con chi è nella sessione e `sessione_il`. Dalla `v2.18.0` non serve comporlo:
`Cornice::ridotta()` dà la cornice ridotta com'è nel ramo `non_letti` di `Cornice::dopo()`, nella stessa forma e nello
stesso ordine — `non_letti`, `aggiornati_il`, `lingua`, `persona`, `workspace`, `sessione_il` e, se c'è, `lingua_il` —, per
il frontend che la vuole lui, per esempio quando il 403 di `Cornice::dopo()` si ripete dopo la ricarica. Non chiama il
backoffice e non scrive nel log. I due segni sono l'inizio della lettura di io.mostra che quella richiesta ha usato
(quella del 403, quella di `Cornice::lingua()`, o nella richiesta rimandata quella della pagina che `Cornice::dopo()` ha
ripreso); in una richiesta senza una lettura sono il primo istante che la forma dei segni può dire,
`0000-01-01T00:00:00.000000Z`: una cornice ridotta non vale mai sopra dati veri arrivati dopo. Senza sessione o senza
workspace dà `null`. E un frontend che mette la lingua
con `Cornice::lingua()` a ogni richiesta legge comunque io.mostra prima del primo disegno, e anche nella richiesta
rimandata, dove `Cornice::dopo()` usa quella lettura: io.mostra si legge due volte per visita. Dalla `v2.15.0` chi la chiama
solo dove la richiesta chiede `subito` la legge una volta (vedi «Dalla `v2.15.0`», sopra).

## Il logo

I cinque file del logo di Zeiras stanno nel pacchetto, in `resources/zeiras/logos/`: sono copie del gruppo Logos del design
system, identiche byte per byte, e non si modificano.

| File | Che cos'è |
|---|---|
| `zeiras-logo.svg` | il logo orizzontale, per i fondi chiari |
| `zeiras-logo-dark.svg` | il logo orizzontale, per i fondi scuri |
| `zeiras-mark.svg` | solo il simbolo: avatar, app, spazi stretti |
| `zeiras-mark-dark.svg` | solo il simbolo, coi colori del tema scuro |
| `zeiras-favicon.svg` | la favicon e l'icona del browser: come si monta lo dice «La favicon», qui sotto |

Una pagina senza cornice (Accedi, Registrati) importa il file e ne usa l'indirizzo:

```tsx
import logo from '../../vendor/zeiras/zr-core/resources/zeiras/logos/zeiras-logo.svg';
import simbolo from '../../vendor/zeiras/zr-core/resources/zeiras/logos/zeiras-mark.svg?no-inline';

<img src={logo} alt="Zeiras" />
```

Il simbolo si importa con `?no-inline`. È un file di pochi byte, e nella build Vite scrive dentro il JS ogni file importato
più piccolo di 4096 byte (`build.assetsInlineLimit`) come indirizzo `data:`, che la CSP scritta più sotto non lascia passare:
l'immagine non si vedrebbe. Con `?no-inline` resta un file della stessa origine, come il logo, e la CSP non cambia. Vale
anche per `zeiras-mark-dark.svg` e `zeiras-favicon.svg`.

Quale versione su quale fondo, le misure minime e lo spazio di rispetto li dice il design system, alla sezione «Logo»: qui
non si ripetono. In cima alla barra della cornice il marchio lo mette l'`AppShell`: lì il frontend non aggiunge niente.

## La favicon

La favicon di Zeiras arriva dal pacchetto: una riga nella testa della pagina e tre file statici in `public/` del frontend.

Nel `<head>` del layout Blade del frontend:

```blade
@include('zr-core::favicon')
```

che scrive le due icone, l'icona Apple e il colore del tema:

```html
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="…">
```

Il colore del tema è il token `surface` del design system, nel tema chiaro, letto da `tokens.json` del pacchetto: non si
scrive a mano. La vista non legge niente dalla richiesta.

I tre file sono `favicon.svg` (la copia del design system, `zeiras-favicon.svg`), `favicon.ico` (tre immagini: 16, 32 e
48 px) e `apple-touch-icon.png` (180×180, senza trasparenza). Li pubblica il provider di zr-core. Arrivano da soli a ogni
`composer update`, col comando che un frontend Laravel ha già nel suo `post-update-cmd`
(`php artisan vendor:publish --tag=laravel-assets --ansi --force`); oppure a mano, col tag di zr-core:

```
php artisan vendor:publish --tag=zr-core-favicon --force
```

Con `--force` un file con lo stesso nome già in `public/` viene sostituito (il `favicon.ico` vuoto dello scheletro di
Laravel, o una favicon provvisoria). I tre file si committano nel repo del frontend: il `composer install` di un deploy non
lancia `post-update-cmd`, e senza i file nel repo in produzione non ci sarebbero.

Sono file della stessa origine: la CSP non cambia. Non c'è una rotta: `/favicon.ico` lo serve il server web, come ogni file
di `public/`.

`favicon.ico` e `apple-touch-icon.png` sono la resa di `zeiras-favicon.svg`: in questo repo li genera `npm run favicon`, non
si ritoccano a mano, e la CI a ogni giro li confronta pixel per pixel con la resa di adesso.

## Le intestazioni di sicurezza

Dalla `v1.6.0` le intestazioni di sicurezza di un frontend le scrive una classe di zr-core,
`Zeiras\Core\Http\IntestazioniSicurezza`: una sola per tutti i moduli, con la CSP di tutti e, per ogni modulo, solo ciò che
dichiara di aggiungere. zr-core non la registra da sé: la registra il frontend, prima dei middleware globali, nel suo
`bootstrap/app.php`:

```php
->withMiddleware(function (Middleware $middleware): void {
    $middleware->prepend(\Zeiras\Core\Http\IntestazioniSicurezza::class);
})
```

Prima dei globali, e non nel gruppo `web`: così le intestazioni le hanno anche le risposte fuori dal gruppo (`/up`), le
risposte d'errore e il 503 della manutenzione. Una classe del frontend con lo stesso compito si cancella: ne resta una.
Con la CSP le pagine che Laravel dà da sé cambiano aspetto, non stato: le pagine d'errore di Laravel — 404, 419, 500,
503 — escono senza stile, perché lo portano in un `<style>` in linea, e `/up` senza i suoi font e il suo script, che
vengono da altre origini. Un modulo che le vuole con lo stile le rende con le sue viste e i suoi file.

Su ogni risposta che passa dai middleware di Laravel la classe scrive cinque intestazioni: quattro al posto di ciò che la
risposta aveva, e la CSP accanto a quella che la risposta porta già, se ne porta una:

| Intestazione | Valore |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000`: un anno, per questo host solo (senza `includeSubDomains` né `preload`) |
| `Content-Security-Policy` | la CSP di tutti, qui sotto, più ciò che il modulo aggiunge |
| `Referrer-Policy` | `strict-origin-when-cross-origin`; una risposta che ha già `no-referrer`, e solo quello, lo tiene |
| `Permissions-Policy` | `accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()` |
| `X-Content-Type-Options` | `nosniff` |

Una risposta che porta già una CSP la tiene, e quella del modulo le esce accanto: due intestazioni, prima quella della
risposta. Il browser le applica tutte e due, e passa solo ciò che ammettono entrambe: una risposta può stringere la CSP del
modulo, mai allargarla — per allargare c'è solo `csp_pagine` (vedi «Per una pagina sola»). È il caso dei file che Laravel
serve da un disco (`'serve' => true` in `config/filesystems.php`): li manda con una CSP sua, con `sandbox`, e quella CSP
resta: un file caricato da una persona non gira nell'origine del modulo. Una CSP uguale a quella del modulo esce una volta
sola. Vale anche per una classe del frontend rimasta accanto a questa: se scrive la sua CSP più all'interno, la risposta le
porta tutte e due.

Una sola non resta: quella che non si può mandare — una lista, un oggetto che non si legge come testo, un testo con un a
capo in mezzo o con un byte nullo. È un errore nel codice che ha scritto la risposta; all'invio PHP su quel valore avvisa
o si ferma, e Laravel di ogni avviso fa un'eccezione: l'invio si interrompe fuori dai middleware, ed è un 500 senza
intestazioni. Dalla `v1.8.0` la classe la scarta e al suo posto mette la politica più stretta, una volta sola per risposta:
`default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; sandbox`. La risposta esce col suo stato,
il suo corpo, le altre sue CSP e quella del modulo; ma con quella politica, quando il browser la carica come documento,
non carica e non esegue niente di quella pagina, finché l'errore non è corretto nel codice del modulo: una pagina non esce
mai con una CSP più larga di quella che il suo codice aveva chiesto. Dove il browser non applica nessuna CSP — una visita
di Inertia, una risposta JSON, un rimando, un file scaricato — non si ferma niente, come niente avrebbe stretto la CSP
scartata: lì il solo segno è l'avviso. Lo scarto lascia nel log un avviso, nella riga degli altri scarti della CSP e per
primo: dice il tipo del valore, mai il valore. Ciò che PHP sa scrivere resta com'è: anche un testo con un a capo in fondo,
che PHP all'invio taglia. Di un oggetto che si legge come testo la classe guarda il testo e tiene l'oggetto, che all'invio
è letto di nuovo: se a ogni lettura dà un testo diverso, ciò che l'invio trova può non essere ciò che la classe ha guardato.
E il 500 di prima c'era perché Laravel, col gestore degli errori che mette all'avvio, di ogni avviso fa un'eccezione:
in un frontend che lo cambia, o che abbassa `error_reporting`, una lista o un testo con un a capo non fermavano l'invio
(PHP avvisa e va avanti: della lista scrive `Array`, il testo con l'a capo non lo scrive) — lì, dalla `v1.8.0`, al loro
posto esce la più stretta.

La CSP di tutti, quella di un modulo che non aggiunge niente:

```
default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; img-src 'self'; font-src https://fonts.gstatic.com; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

### Le sorgenti di un modulo

Ciò che un modulo aggiunge alla CSP di tutti sta in un file solo, `config/zr-core.php` del frontend: è l'unico posto dove
un modulo scrive un'origine. Il file di partenza, che non aggiunge niente, arriva nel frontend col comando:

```
php artisan vendor:publish --tag=zr-core-config
```

e si compila così — nell'esempio, un modulo che serve dei font suoi e ha una pagina col widget di un altro sito:

```php
return [
    // Per sempre, su ogni risposta.
    'csp' => [
        'font-src' => ["'self'"],
    ],

    // Per una pagina sola: insiemi con un nome.
    'csp_pagine' => [
        'turnstile' => [
            'script-src' => ['https://challenges.cloudflare.com'],
            'frame-src' => ['https://challenges.cloudflare.com'],
        ],
    ],
];
```

- **Le direttive**: si aggiungono sorgenti a sei direttive sole — `script-src`, `style-src`, `img-src`, `font-src`,
  `connect-src`, `frame-src`. Un modulo e una pagina aggiungono: non tolgono niente e non toccano le altre direttive.
  Con un'eccezione, `frame-src`, l'unica delle sei che la CSP di tutti non ha: finché nessuno la scrive le cornici seguono
  `default-src`, cioè la sola origine del modulo; dalla prima sorgente vale solo ciò che è scritto lì. Chi incornicia
  anche la propria origine scrive anche `'self'` in `frame-src`: senza, quelle cornici non si caricano più, e nel log non
  c'è un avviso.
- **Le sorgenti ammesse**: `'self'`, oppure un'origine `https://` scritta per intero — un nome di dominio in minuscolo, con
  almeno un punto, e la porta se serve (`https://cdn.example.com`, `https://cdn.example.com:8443`). Niente jolly, schemi
  interi (`https:`, `data:`), percorsi, indirizzi IP, nomi in punycode (`xn--`), `'unsafe-inline'`, `'unsafe-eval'`, nonce
  o hash.
- **Una sorgente non ammessa** è scartata, mai aggiustata: la CSP esce senza, e la classe scrive un avviso nel log a ogni
  risposta, finché il file non è corretto. L'avviso dice di chi era lo scarto (il modulo o la pagina), la direttiva e il
  motivo; non porta valori della richiesta.
- **La configurazione in cache**: senza il file nel frontend valgono i valori di partenza. Un frontend che tiene la
  configurazione in cache (`php artisan config:cache`) la rifà dopo l'aggiornamento di zr-core e dopo ogni modifica del
  file: fino ad allora la classe non vede le sorgenti nuove.

### Per una pagina sola

Una pagina che ha bisogno di sorgenti sue le chiede per nome dal suo controller, con
`IntestazioniSicurezza::perLaPagina('<nome>')`:

```php
use Zeiras\Core\Http\IntestazioniSicurezza;

IntestazioniSicurezza::perLaPagina('turnstile');
```

Il controller dice solo il nome di un insieme di `csp_pagine`: le origini stanno nella configurazione. Il nome si scrive nel
codice, e non si prende mai dalla richiesta. Vale per la risposta a quella richiesta sola; chiamata due volte, vale l'ultimo
nome. Un nome che la configurazione non dichiara non aggiunge niente, e lascia un avviso nel log.

**Con Inertia la CSP è del documento.** Il browser applica la CSP della risposta che ha caricato il documento, e una visita
di Inertia cambia la pagina senza ricaricarlo: la CSP resta quella di prima. Per questo una pagina con sorgenti sue si apre
e si lascia con un caricamento intero: ci si arriva con un link normale (`<a href>`, non `<Link>`), e se ne esce allo
stesso modo o, dal server, con `Inertia::location()`. Aperta con una visita di Inertia, le sue sorgenti restano bloccate;
lasciata con una visita di Inertia, la sua CSP più larga resta sulle pagine dopo.

### Il test nel modulo

Ogni modulo tiene nel suo repo un test che chiede una sua pagina e confronta le cinque intestazioni coi valori scritti per
intero: la CSP che il modulo si aspetta, carattere per carattere, e non una costante di zr-core. È un obbligo, non un
consiglio: le intestazioni arrivano da un pacchetto, e un test che rilegge la costante del pacchetto resta verde qualunque
cosa il pacchetto scriva. Coi valori per intero, un aggiornamento di zr-core che cambia un'intestazione fa rosso nella CI
del modulo, e il valore nuovo lo conferma chi lo legge.

La CSP si confronta con tutti i suoi valori, non col primo: una risposta può portarne più d'una, e `assertHeader` guarda
solo il primo. Con una classe del modulo rimasta più all'interno, che scrive la CSP che il test si aspetta, quella di
zr-core le uscirebbe accanto e il test resterebbe verde, mentre il browser le applica tutte e due.

```php
it('ogni risposta porta le intestazioni di sicurezza, coi valori scritti per intero', function () {
    $risposta = $this->get('/non-esiste')
        ->assertHeader('Strict-Transport-Security', 'max-age=31536000')
        ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
        ->assertHeader('Permissions-Policy', 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()')
        ->assertHeader('X-Content-Type-Options', 'nosniff');

    expect($risposta->headers->all('Content-Security-Policy'))->toBe(["default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; img-src 'self'; font-src https://fonts.gstatic.com; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"]);
});
```

Un modulo che aggiunge sorgenti scrive per intero la sua CSP, e ha un caso per ogni pagina che ne chiede di sue.

Le intestazioni comuni non cambiano in una versione di correzione di zr-core: un cambio che le allarga esce in una minore,
con l'annuncio ai frontend; uno che le stringe, in una maggiore.

### La barra d'avanzamento di Inertia

La CSP di tutti non ammette stili in linea, e la barra d'avanzamento di Inertia, di suo, aggiunge alla pagina un `<style>`.
Un modulo la tiene senza `<style>` — `progress: { includeCSS: false }` in `createInertiaApp`, con gli stili della barra in
un suo file CSS — oppure la spegne (`progress: false`).

### Che cosa resta al server web

La classe scrive sulle risposte che passano dai middleware di Laravel. Ciò che non ci passa non ha le sue intestazioni, e
resta al server web:

- **i file statici** di `public/` (la build, la favicon, `robots.txt`): li serve il server web;
- **gli errori del server web**: una risposta che il server web dà da sé, senza arrivare a Laravel;
- **gli errori che Laravel rende fuori dai middleware**: un errore fatale di PHP (tempo o memoria finiti), un errore
  all'avvio dell'applicazione, un 500 mentre anche il gestore delle eccezioni lancia (un log che non scrive);
- **la pagina di manutenzione pre-renderizzata** (`php artisan down --render=…`): esce prima che Laravel parta, senza
  passare dai middleware. Il 503 della manutenzione senza `--render` passa dalla classe;
- **`X-Frame-Options`**: la classe non la manda. L'incorniciamento lo vieta già `frame-ancestors 'none'` della CSP; chi la
  vuole anche come intestazione la mette nel server web.

Se il server web aggiunge alle risposte di Laravel un'intestazione che scrive anche la classe, la risposta la porta due
volte: nel server web si toglie, o si tiene con lo stesso valore. La CSP si toglie e basta: due CSP sono due politiche, e
il browser le applica insieme — su una pagina che chiede sorgenti sue quella del server web, sempre uguale, le terrebbe
bloccate.

## La CSP

Gli stili della cornice arrivano da file e i font da Google Fonts, come li carica il design system: nessun `<style>`
aggiunto da JS e nessun attributo `style` nell'HTML. I pochi stili che i componenti mettono su un elemento passano da
JS (CSSOM), che `style-src` non governa.

La CSP intera la dà la classe delle intestazioni di sicurezza, qui sopra: chi la registra non ne scrive una sua, e ciò che
serve al modulo lo aggiunge in `config/zr-core.php`. `frame-ancestors`, `base-uri` e `form-action`, che non ricadono su
`default-src`, lì ci sono già.

Chi non la registra scrive la CSP per conto suo, e per la cornice la apre almeno a questo:

```
Content-Security-Policy: default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com
```

È il minimo per la cornice, non una policy completa: ci aggiunge ciò che serve a lui (le sue API in `connect-src`, le sue
immagini in `img-src`), e `frame-ancestors`, `base-uri` e `form-action` in quel caso li mette da sé.

## Gli host fidati

Dalla `v1.19.0` il pacchetto ha un middleware, `Zeiras\Core\Http\HostFidati`, che a una richiesta per un host che non è
quello del modulo risponde `400`, prima delle rotte. L'host del modulo è quello di `APP_URL` e basta: il nome intero, senza
la porta e senza distinguere le maiuscole. Niente sottodomini, e `config/zr-core.php` non ha una chiave per lui. zr-core
non lo registra da sé, e installare il pacchetto non rifiuta niente: lo registra il frontend, in coda ai middleware globali,
nel suo `bootstrap/app.php`, accanto alla riga delle intestazioni di sicurezza:

```php
->withMiddleware(function (Middleware $middleware): void {
    $middleware->prepend(\Zeiras\Core\Http\IntestazioniSicurezza::class);
    $middleware->append(\Zeiras\Core\Http\HostFidati::class);
})
```

Le intestazioni con `prepend`, gli host con `append`, e non il contrario. In coda ai globali il middleware gira dopo i
proxy fidati di Laravel, e guarda l'host che l'app userebbe per scrivere i suoi indirizzi: l'intestazione `Host`, oppure
`X-Forwarded-Host` se chi chiama è un proxy che il modulo ha dichiarato fidato. E gira dentro `IntestazioniSicurezza`: anche
il `400` esce con le intestazioni di sicurezza. Registrato con `prepend` il `400` uscirebbe senza, e l'host detto da un
proxy fidato non lo guarderebbe nessuno. I middleware globali girano prima di quelli del gruppo `web`: una richiesta
rifiutata non apre una sessione e non lascia un cookie.

- **A che cosa serve**: Laravel scrive i suoi indirizzi — un rimando, un collegamento in una mail — con l'host della
  richiesta. Chi chiama il server con un altro nome se li farebbe scrivere col suo. È la seconda difesa: la prima è il
  server web, che per un nome che non è il suo non dovrebbe rispondere. Il middleware di Laravel per gli host,
  `TrustHosts`, non è lo stesso: di suo ammette anche i sottodomini di `APP_URL`, e in locale e nei test non fa niente.
- **Che cosa risponde**: `400` col corpo fisso `Bad Request`, uguale per tutti, e il controller non gira. Dell'host
  ricevuto non ripete niente, né nella risposta né nel log: nel log lascia un avviso con l'host atteso.
- **Che cosa risponde Laravel prima di lui**: non tutto arriva al middleware. In coda ai globali il middleware viene dopo
  quelli di Laravel per il CORS, la manutenzione e la dimensione del corpo, che rispondono a qualunque host: a una
  richiesta di preflight del CORS, a un corpo troppo grande (`413`), e con l'app in manutenzione (`503`). In manutenzione
  con `php artisan down --redirect` un host falso prende un `302` scritto con quell'host, e con `--secret` chi chiama
  l'indirizzo segreto riceve anche il cookie `laravel_maintenance`: finché l'app è in manutenzione la difesa è il server
  web. Un host con caratteri che un nome non ha lo rifiuta Laravel prima: `400` col corpo di Laravel, e nel log nessun
  avviso.
- **La porta non entra nel confronto**: `Host: board.zeiras.com:8443` passa, e Laravel scrive i suoi indirizzi con quella
  porta. La porta la tiene ferma il server web.
- **Prima di registrarlo** leggi quanto vale `APP_URL` in produzione: dev'essere il nome pubblico del modulo, scritto per
  intero e con lo schema (`https://board.zeiras.com`). Se `APP_URL` non ha un host — è vuoto, o è senza lo schema — il
  middleware non rifiuta niente e lo scrive nel log a ogni richiesta, finché non lo correggi. Se `APP_URL` manca del
  tutto vale quello del `config/app.php` del modulo, di norma `http://localhost`, e il middleware rifiuta ogni richiesta
  fatta col nome pubblico. Lo stesso se il nome ha lettere non ASCII — va scritto in Punycode, come lo manda il browser —
  o finisce con un punto.
- **Vale per ogni rotta, anche `/up`**: una sonda che chiama il server con l'indirizzo della macchina, e non col nome
  del modulo, da quel momento prende `400`. Prima di registrarlo chiedi a chi tiene le sonde con quale nome chiamano.
- **Riguarda le richieste in ingresso**: le chiamate del modulo ad `api.zeiras.com` non passano di qui.
- **Nei test vale come in produzione**, senza eccezioni per l'ambiente. Laravel nei test chiama l'host che `APP_URL` ha
  all'avvio, quindi i test passano senza toccare niente. Prende `400` un test che cambia `app.url` a metà e poi chiama una
  pagina, o che chiama un indirizzo intero con un altro host: lì l'indirizzo della chiamata si scrive con l'host di
  `app.url`.
- **La prova dopo averlo registrato**, in produzione: dal nome pubblico una pagina risponde `200` e `/up` risponde `200`;
  la stessa richiesta con un host falso nell'intestazione `Host` prende `400`. Se davanti al server c'è chi un altro nome
  non lo fa arrivare, la prova con l'host falso si fa al server d'origine.

## Il precarico dei file d'ingresso

Dalla `v1.18.0` il pacchetto ha un middleware, `Zeiras\Core\Http\PrecaricoDegliIngressi`, che sulla risposta intera di una
pagina scrive nell'header `Link` i file che `@vite` ha messo nel documento: l'ingresso, i pezzi che importa staticamente e
i CSS, non i pezzi dinamici. Il browser comincia a scaricarli quando arrivano le intestazioni, prima di leggere il
documento. È pensato per il solo header: per Zeiras Early Hints su Cloudflare resta spento (più sotto, «Che cosa dice di chi
guarda»). zr-core non lo registra da sé, e installare il pacchetto non precarica niente: lo registra il frontend, in uno dei
due modi. Sul gruppo `web`, per ogni pagina, nel suo
`bootstrap/app.php`:

```php
->withMiddleware(function (Middleware $middleware): void {
    $middleware->web(append: [\Zeiras\Core\Http\PrecaricoDegliIngressi::class]);
})
```

Oppure sulle sole rotte che vuole, nel file delle sue rotte:

```php
Route::get('b/{board}', [BoardController::class, 'mostra'])->middleware(\Zeiras\Core\Http\PrecaricoDegliIngressi::class);
```

Non c'è niente da configurare, e `config/zr-core.php` non ha una chiave per lui: le rotte le dice dove lo agganci, i file li
dice `@vite` nel documento, e il middleware non legge il manifest.

- **Che cosa scrive**: una voce per file, nell'ordine in cui `@vite` li ha scritti: un CSS come
  `<url>; rel=preload; as=style`, un modulo come `<url>; rel=preload; as=script; crossorigin`. Mai `modulepreload`:
  Cloudflare in un 103 ripete solo `preload` e `preconnect`. E sempre `crossorigin` su un modulo: la richiesta di un modulo
  è CORS, e senza `crossorigin` il browser lo scaricherebbe due volte. Un altro precarico di Vite (un font) non esce.
  Degli attributi che Vite calcola il middleware guarda solo `as`: non copia `integrity` né il valore di `crossorigin`. Un
  frontend con l'integrità dei file nel manifest, con `crossorigin="use-credentials"` o con `crossorigin` sui CSS non lo
  registra: il precarico non combacerebbe col tag del documento, e il file scenderebbe due volte. Non c'è un tetto alle
  voci: l'header cresce con ogni pezzo che l'ingresso importa staticamente.
- **Con quale indirizzo**: mai con un host che viene dalla richiesta. Una voce è il solo percorso, `</build/assets/…>`,
  che il browser risolve sull'origine della pagina; con `ASSET_URL` nel `.env` del frontend è l'indirizzo intero, che
  comincia con quello. Di un indirizzo con l'host della richiesta (un frontend che ha rimesso il resolver di Laravel) il
  middleware scrive il solo percorso, e un file con un altro host non esce. Non esce nemmeno un indirizzo con un
  carattere di controllo, uno spazio, `<`, `>`, `"` o `\`: in un `Link` chiuderebbe la voce, o un browser ci leggerebbe
  un altro host.
- **Dove scrive**: solo su una risposta `200` che è un documento HTML. Non sulla visita Inertia (la richiesta porta
  `X-Inertia`), su un redirect, su una pagina d'esito (`404`, `500`), su una risposta che dichiara un altro tipo, su un
  JSON, un file o uno stream; e se `@vite` non ha scritto niente l'header non c'è. Un `Link` che la risposta porta già
  resta: il middleware aggiunge il suo accanto. È per PHP-FPM, dove ogni richiesta parte da zero: in un processo che resta
  vivo fra una richiesta e l'altra (Octane) `Vite` tiene i file della richiesta di prima, e una pagina senza `@vite`
  porterebbe i suoi.
- **Dove si registra**: in un posto solo. Fra i middleware globali e anche su un gruppo scriverebbe due righe uguali
  (gruppo e rotta insieme no: Laravel toglie il doppione). E al posto di quello di Laravel,
  `Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets`, non accanto: con tutti e due ogni file uscirebbe due
  volte, come `modulepreload` e come `preload`.
- **Che cosa dice di chi guarda**: col solo header, niente. Ripete ciò che il documento dice già: nessun dato, id o lingua
  della persona, e nessun host che venga dalla richiesta. Per Zeiras Early Hints su Cloudflare resta spento: zr-pm dichiara
  che il guadagno misurato era del solo header, e che il 103 non aggiungeva niente. Chi lo accende accetta un rischio, e lo
  decide zr-pm: il 103 che Cloudflare manda prima dell'origine dice, a chi conosce o indovina un indirizzo, che la pagina
  esiste ed è stata aperta da poco — e lo slug di un workspace è il nome di un'azienda. Per questo un modulo con uno slug
  o un id nel percorso registra il middleware sulle sole rotte che accetta di esporre.
- **Quanto vale**: non è una misura di zr-core. I numeri sono di zr-board, che lo ha avuto per primo e li dichiara: a
  freddo, su rete lenta, da 0,15 a 0,36 s in meno. zr-core non li ha misurati.

### Gli indirizzi dei file della build

Dalla `v1.18.0` il pacchetto registra un resolver di Vite (`Vite::createAssetPathsUsing`), per ogni frontend che lo
installa e senza che faccia niente: `@vite` scrive i file della build col solo percorso, `/build/assets/…`, nel documento
come nel `Link`. Prima Laravel li scriveva con la radice della richiesta — l'header `Host`, o `X-Forwarded-Host` se il
frontend si fida dei proxy —, e chi mandava un host suo lo ritrovava negli indirizzi della pagina. Con `ASSET_URL` nel
`.env` l'indirizzo resta intero e comincia con quello: non viene dalla richiesta.

- **`Vite::asset()`** dà anche lui il solo percorso: dove serve un indirizzo assoluto (una mail) lo si scrive da
  `config('app.url')`.
- **Un frontend in una sottocartella del dominio** imposta `ASSET_URL`: il percorso parte dalla radice del dominio.
- **`ASSET_URL` va nel `.env`**: un'origine data a tempo d'esecuzione, con `URL::useAssetOrigin()` o
  `URL::forceRootUrl()`, il resolver non la vede, e scrive il solo percorso.
- **Un test del frontend** che confronta un indirizzo intero di un file della build (`http://localhost/build/…`) va
  riletto: ora è il solo percorso.
- **Un resolver del frontend** registrato nel `boot()` del suo `AppServiceProvider` parte dopo quello del pacchetto, e
  vince: chi ne ha uno uguale lo toglie quando installa la `v1.18.0`. Nel `register()` no: lì quello del pacchetto lo
  sovrascrive.
