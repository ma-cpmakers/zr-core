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

**Il JS**, da uno dei due ingressi del pacchetto (due dalla `v1.15.0`). React lo porta il frontend: il pacchetto non ne ha
una copia. Dalla `v2.0.0` c'è un terzo ingresso, `…/resources/js/frasi`, solo per le tre funzioni di chi mostra le
notifiche in una pagina sua (vedi «Passare alla v2»).

- **L'ingresso per le app**, `resources/js/app` (dalla `v1.15.0`): la cornice e ciò che le sta intorno, cioè gli stessi nomi
  dell'ingresso di sempre tranne `Zeiras`. I componenti del design system si prendono per nome dal loro modulo,
  `resources/js/zeiras/componenti`, e nella build del frontend entra solo ciò che l'app usa: i componenti della cornice, più
  quelli delle sue pagine.

  ```ts
  import { Cornice, type DatiDellaCornice } from '../../vendor/zeiras/zr-core/resources/js/app';
  import * as Zeiras from '../../vendor/zeiras/zr-core/resources/js/zeiras/componenti';
  ```

  Da questo ingresso nessuno scrive `window.Zeiras` né `window.React`.

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
| solo la cornice, dall'ingresso per le app | 53,9 KB | 18,0 KB | 37,0 KB | 5,9 KB |
| la cornice e due componenti per nome | 57,1 KB | 19,1 KB | 37,0 KB | 5,9 KB |
| la stessa cornice, dall'ingresso di sempre | 116,0 KB | 37,2 KB | 37,0 KB | 5,9 KB |

Le prime due colonne sono il JS d'ingresso, quello che la pagina scarica subito. «A richiesta» sono le frasi delle
notifiche, dalla `v1.20.0`: tre file `.json`, uno per lingua (circa 1 KB l'uno con gzip), che la cornice chiede con
`fetch` quando si apre la campanella; una pagina ne scarica al più due, quello della lingua della persona e quello
dell'inglese. Prima stavano nel JS d'ingresso, che per la sola cornice pesava 69,3 KB (18,8 con gzip). Il quarto è un pezzo
di JS, i rimedi provvisori di tastiera (circa 1,2 KB con gzip), che la cornice chiede quando si monta: vedi «Il fuoco nel
pannello delle notifiche» e «Tab dentro un dialogo aperto», sotto. Il quinto, dalla `v2.0.0`, è un altro pezzo di JS, quello
della campanella (circa 1,3 KB con gzip): ciò che compone le righe delle notifiche e carica le frasi, che la cornice chiede
con `import()` quando si apre la campanella, non quando si monta. Nel JS d'ingresso di queste app c'è anche l'aiuto
con cui Vite carica i pezzi a richiesta (circa 0,7 KB con gzip): un'app che ha già pagine a richiesta lo porta comunque.
I pesi fra parentesi sono misure del 12/10/2026 (quelli dei rimedi e della campanella, del 13/10/2026), e la CI non li ricontrolla: quelli che ricontrolla sono i numeri della
tabella. Il JS d'ingresso dell'app che prende solo la cornice ha un tetto, che la CI misura a ogni giro: 18.554 byte con
gzip. Sono 18 KB più 122 byte: dalla `v2.3.0` la cornice si rifà quando cambia la persona (17 byte) e con Indietro non riporta
a schermo chi c'era prima (37), e dalla `v2.4.0` in una scheda rimasta ferma non mostra l'elenco e i risultati di un'altra
persona (68): quei byte sono ciò che costano quelle tre sole correzioni. Dalla `v2.0.0` l'eccezione per i rimedi provvisori di tastiera è finita: ciò che compone le righe delle
notifiche è uscito dal JS d'ingresso, e sta nel pezzo della campanella.

I due componenti sono `Button` e `DataTable`. **Per misurarlo nel frontend**, prima e dopo il passaggio: `npm run build`, poi
`find public/build/assets -name '*.js' -exec gzip -9 -c {} + | wc -c` dà i byte di tutto il JS, con gzip. Che il passaggio è
completo lo dice `grep -rhoE --include='*.js' 'window\.Zeiras ?= ?Object\.assign' public/build | wc -l`: risponde 0
dall'ingresso per le app, 1 finché un file importa dall'ingresso di sempre.

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

## La parte server

I dati della cornice — chi è la persona, la sua lingua, il workspace in cui è entrata, lo stato dei prodotti in quel
workspace, le sue aziende coi loro workspace, le notifiche non lette — li dà `Zeiras\Core\Cornice::dati()`, dalla sessione
di `zr-auth` e da quattro letture del backoffice: `app.elenca` e `io.mostra` col gettone del workspace,
`io.aziende.elenca` e `io.workspace.elenca` col gettone della persona. Il gettone resta nella sessione: nei dati non c'è.

L'ordine in cui `Cornice::dati()` fa le quattro letture non è un contratto: può cambiare da una versione all'altra (dalla
`v1.2.2` la prima è `io.mostra`, per contare le non lette prima di ogni altra lettura). Un test del frontend non fissi «la
prima lettura»: guardi quali letture partono e con quale gettone, non in che ordine.

zr-core richiede `zeiras/zr-auth` `^0.12.4` (la CI lo prova con la più bassa che questo vincolo accetta e con l'ultima 0.12),
installato e configurato come dice il suo README (la sessione lato server, `ZR_API_URL`). Dalla `v1.4.0` una zr-auth più
vecchia non basta: la cornice chiama `Sessione::aggiorna`, che c'è dalla 0.12, e con una più vecchia Composer lascia zr-core
alla `v1.3.0`. Dalla `v1.6.0` serve la 0.12.4: «Segna tutte come lette» tiene il blocco della sessione coi tempi di zr-auth,
e la 0.12.4 è la patch con cui la CI ha provato quel codice; con una più vecchia della 0.12.4 Composer lascia zr-core alla
`v1.5.0`. Composer non eredita i repository di un pacchetto: il repository `vcs` di zr-auth sta nel `composer.json` del
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
| `{lingua, persona: {nome, email}, workspace: {nome, slug}, prodotti: {<codice>: attivo \| disponibile \| in_arrivo}, aziende: [{id, nome, workspace: [{id, nome, slug}], nuovo_workspace}], non_lette, aggiornati_il}` | la persona è entrata in un workspace |
| gli stessi dati, ridotti: `prodotti` `[]`, `aziende` `[]`, `non_lette` `0`, e in fondo `accettazione_richiesta: true` | dalla `v1.14.0`: la persona non ha ancora accettato i documenti legali in vigore, e a una delle letture il backoffice risponde 403 `accettazione_richiesta`. Non è un guasto, e `Cornice::dati()` non lancia (più sotto, «Chi non ha accettato i documenti legali») |
| `null`, senza chiamare il backoffice | nessuna sessione, o una sessione senza workspace (prima della scelta) |
| l'eccezione `BackofficeNonRisponde` di zr-auth | il backoffice non risponde: mai una lista di prodotti vuota, che li farebbe tutti «Presto», né aziende vuote o zero non lette |
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
di Inertia, perché un rimando la manderebbe a sé stessa. Con una patch di zr-auth più
vecchia della `v0.12.17` quel 403 resta un
`ErroreApi` come gli altri, e nessuno rimanda: il vincolo di zr-core le ammette, e un frontend che vuole il rimando chiede
nel proprio `composer.json` una zr-auth dalla `v0.12.17` in su.

Il workspace è quello del gettone (`Sessione::workspace()` di zr-auth), non quello dell'indirizzo della pagina. Persona,
lingua e workspace sono quelli della sessione di zr-auth. La lingua e il nome la cornice li tiene aggiornati: a ogni
lettura `Cornice::dati()` dà a `Sessione::aggiorna` di zr-auth la risposta di `io.mostra` che ha già letto per le non
lette, e `Sessione::aggiorna` mette nella sessione la lingua e il nome del profilo, se sono cambiati e se li prende: quali
prende lo decide zr-auth (per la lingua vedi «Quale lingua c'è nella sessione», più sotto). Cambiano solo quei due: email,
workspace, ruolo e gettoni restano quelli dell'ingresso. I dati della cornice portano la lingua e il nome della sessione
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
notifica segnata come letta in quella richiesta — arriva alla campanella con la lettura dopo. Vale anche per il nome, e
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
forma di una lingua. zr-core accetta tutte e due le versioni: un test del modulo su una lingua che non è di Zeiras guarda
quale zr-auth è installata.

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

### Le rotte della cornice

zr-core registra da sé, nel gruppo `web` del frontend (sessione, guardia di zr-auth, CSRF), le sue rotte per il browser,
sulla stessa origine: quelle che la cornice chiama. Fra queste, dalla `v1.12.0`, c'è di nuovo la lettura di una notifica
sola: dalla `v1.1.0` alla `v1.11.0` la cornice non la chiamava, e restava per i frontend che la usano. La parte server le gira al backoffice col gettone del workspace, che non
esce.

| Rotta | Risponde |
|---|---|
| `GET /cornice/notifiche` | `{data: [{id, creata_il, letta, app, tipo, autore_nome, risorsa_nome, per_me, azioni, board_nome, ids}], aggiornati_il, workspace, persona}`: le notifiche della persona nel workspace dalla più recente, una pagina; dalla `v1.22.0` `creata_il` è l'istante dell'ultima azione che la notifica racconta — il backoffice ne accorpa più d'una in una notifica sola, e l'istante dell'ultima lo dice in `ultima_azione_il`; se non lo manda, è l'istante in cui la notifica è nata, come prima —: è l'ora che il pannello mostra, e su quella il backoffice ordina l'elenco; `ultima_azione_il` del backoffice non arriva in pagina; dalla `v2.1.0` `azioni` è quante azioni la notifica racconta (un intero da 1 in su) e `board_nome` il nome della board in cui sta la cosa, o `null`: sono `azioni` e `board.nome` del backoffice; un backoffice che non li manda è quello di prima, e valgono 1 e `null`; di `board` passa solo il nome, mai l'id; un `azioni` che non è un intero da 1 in su, o un `board` che non è `null` né un oggetto col `nome`, è un errore (5xx), qui e in `PATCH /cornice/notifiche/{id}/lettura`, mai una chiave tolta in silenzio; `app` è il codice dell'app da cui viene la notifica (`pm`, `crm`…) o `null`, com'è nel backoffice; `tipo` è il tipo dell'evento che l'ha generata (`com.zeiras.board.cartella.creata`…), com'è nel backoffice: la parte server non lo traduce e non lo confronta con un elenco, e ne può arrivare uno nuovo — il titolo glielo dà la cornice, nel browser (vedi «Le notifiche»); una notifica che il backoffice dà senza `tipo`, o con un `tipo` che non è una stringa, è un errore (5xx), qui e in `PATCH /cornice/notifiche/{id}/lettura`; dalla `v1.10.0` `autore_nome` è il nome di chi ha fatto ciò che la notifica racconta, `risorsa_nome` quello della cosa a cui si riferisce (per una notifica su un'app è il codice dell'app, com'è nel backoffice: il nome da mostrare lo dà `risorsaDellaNotifica`), e `per_me` dice se è rivolta alla persona (`true`), a tutto il workspace (`false`) o se il backoffice non lo sa (`null`, che non è `false`): sono `autore.nome`, `risorsa_nome` e `per_me` del backoffice, e ognuna è `null` quando il backoffice dà `null` o non manda la chiave; di `autore` passa solo il nome; una delle tre con una forma che il contratto non ammette (un `autore` senza `nome`, un numero al posto di un testo, un `per_me` che non è un booleano) è un errore (5xx), qui e in `PATCH /cornice/notifiche/{id}/lettura`, mai una chiave tolta in silenzio; dalla `v1.11.0` `ids` sono gli id che servono ad aprire la risorsa della notifica, per chiave (`{"id": "…"}` per un contatto, `{"persona_id": "…"}` per una nota legata al solo contatto): di `dati` del backoffice passano i soli id del percorso che la notifica apre — quello che il registro dà al suo tipo, nella voce della sua app (`{id}`, `{persona_id}`) —, e solo con un valore che ha la forma di un id (un testo di lettere, cifre, `-` e `_`, da 1 a 64): gli altri id, il resto di `dati` e `soggetto` non arrivano al browser; dalla `v1.13.0` un tipo può avere più percorsi, e gli `ids` sono quelli del primo che `dati` soddisfa per intero (per una nota di un'opportunità `{"trattativa_id": "…"}`, per una legata alla sola azienda `{"organizzazione_id": "…"}`: la regola è `idsDellaNotifica`, più sotto); una notifica di un tipo che nel registro non ha una destinazione, senza `dati`, o con un `dati` che non è un oggetto, ha `ids` vuoto (`{}`) e non è un errore, e dalla `v1.13.0` lo ha vuoto anche una il cui percorso non chiede un id (un'attività, che apre «Da fare»): se una notifica ha una destinazione lo dice `destinazioneDellaNotifica`, non `ids`; `aggiornati_il` è l'istante in cui la parte server ha cominciato a leggere l'elenco, prima di chiamare il backoffice, in UTC e nella forma del segno dei dati della cornice (`2026-10-09T21:31:05.123456Z`): l'elenco è almeno fresco quanto quell'istante; dalla `v1.12.0` `workspace` è lo slug del workspace della sessione, quello col cui gettone l'elenco è stato letto: lo dice la parte server, e non segue niente di ciò che manda il browser (la pagina che chiede può essere rimasta su un altro workspace); dalla `v2.4.0` `persona` è l'email della persona della sessione, quella di cui sono le notifiche, presa allo stesso modo: in una scheda rimasta ferma la cornice sa così che l'elenco non è di chi mostra, non lo mostra e ricarica la pagina |
| `PATCH /cornice/notifiche/{id}/lettura` con `{letta}` | `{data: {id, letta}, segnata_il}`: segna letta (`true`) o non letta (`false`) quella notifica, e `letta` è ciò che il backoffice ha segnato; dalla `v1.12.0` `segnata_il` è l'istante preso dopo la risposta del backoffice, nella forma di `aggiornati_il`: la cornice lo confronta con l'istante dell'elenco — un elenco letto fin lì può dare la notifica ancora da leggere —, e una risposta che non è un 200 non lo porta; senza `letta`, o se non è un booleano, 422 `{errore: "dati_non_validi"}`; una notifica che non c'è, o di un'altra persona, 404 `{errore: "non_trovato"}`; un `id` che non è fatto di lettere, cifre, `-` e `_` (64 al più) non ha rotta: 404 |
| `POST /cornice/notifiche/letture` con `{fino_a, workspace}` | `{data: {fino_a, altre}, segnate_il}`: segna lette le notifiche della persona nel workspace nate fino a `fino_a` compreso, anche quelle oltre la prima pagina; dalla `v1.22.0` la cornice manda in `fino_a` l'istante dell'ultima azione più recente fra le notifiche caricate: il backoffice segna quelle nate fino a lì, cioè tutte le caricate — ognuna è nata prima della sua ultima azione — e nessuna nata dopo il caricamento; `fino_a` è un istante con data, ora coi secondi (sei decimali al più) e fuso (`2026-10-08T10:00:00.000Z`, o `+02:00` al posto di `Z`), com'è la `creata_il` di una notifica, e quello della risposta è l'istante del backoffice, in UTC; il backoffice ne segna al più 5000 per chiamata e dice se ne restano: la parte server lo richiama con lo stesso `fino_a` finché ne restano, entro due tetti — al più 5 chiamate al backoffice per richiesta (25.000 notifiche), e nessuna chiamata nuova passati 10 secondi dall'arrivo della richiesta; `altre` è `false` quando il backoffice ha detto che non ne restano, e `true` quando un tetto ha fermato i richiami e ne restano ancora: non è un errore, e la stessa richiesta, ripetuta, continua da lì; `segnate_il` è l'istante preso dopo l'ultima risposta del backoffice, sull'orologio della parte server e nella forma di `aggiornati_il`: ciò che è stato letto prima di quell'istante può non sapere di questa lettura; `workspace` è lo slug del workspace della pagina che chiede (quello dei dati della cornice): se non è quello della sessione — da un'altra scheda la persona è entrata in un altro workspace — 409 `{errore: "workspace_diverso"}`, e non si segna niente; senza `fino_a` o senza `workspace`, o se `fino_a` non ha quella forma, o se quell'istante non esiste, 422 `{errore: "dati_non_validi"}`; se il backoffice non risponde in tempo, risponde un errore, o risponde senza `altre` o con un `altre` che non è un booleano, alla prima chiamata o a un richiamo, è un errore (5xx) senza `segnate_il`, anche se può averne segnate: ripetere la stessa richiesta non cambia ciò che è già segnato; la rotta tiene il blocco della sessione per tutta la sua durata, e se un'altra richiesta della stessa sessione lo tiene per più di 3 secondi risponde 503 con `Retry-After: 1`, senza chiamare il backoffice; arrivata alla rotta passati 10 secondi dall'arrivo della richiesta risponde 503 `{errore: "fuori_tempo"}` con `Retry-After: 1`, anche lei senza chiamare il backoffice; il blocco dura 20 secondi da quando è preso, coi tempi di partenza, e una richiesta che i middleware del frontend tengono più a lungo prima della rotta ci arriva a blocco scaduto (vedi «Le notifiche») |
| `POST /cornice/ricerca` con `{q}` | `{data: [{tipo, id, titolo, contesto}], workspace, persona}`: ciò che il backoffice trova nel workspace cercando `q`, coi tipi e nell'ordine del backoffice, la prima pagina (oggi, col loro `tipo`: le schede `board.scheda`, i contatti `crm.persona`, le aziende `crm.organizzazione`, le opportunità `crm.trattativa` e i membri del workspace `workspace.membro`, poi le board `board.board` e le cartelle `board.cartelle` per titolo; la fonte di un modulo c'è solo se il suo prodotto è attivo nel workspace, i membri ci sono in ogni workspace, e la cornice li mostra dalla `v1.17.0`); dalla `v1.15.0` ogni risultato porta `contesto`: `null`, oppure un oggetto coi testi che aiutano a riconoscerlo: di ciò che il backoffice dà passano le sole chiavi che il registro dice per il tipo del risultato (`board` e `lista` di una scheda, `organizzazione` e `ruolo` di un contatto, `pipeline` e `fase` di un'opportunità), coi soli valori di testo non vuoti; una chiave che il registro non dice per quel tipo resta nella parte server; dalla `v1.17.0` di un membro del workspace passa il solo `ruolo`, che è un codice (`proprietario`, `amministratore`, `membro`): l'email di un membro non esce mai; dalla `v1.18.0` di un'opportunità passa anche `esito` (`aperta`, `vinta` o `persa`), com'è arrivato: quali esiti si mostrano lo sa la cornice; dalla `v1.12.0` `workspace` è lo slug del workspace della sessione, quello col cui gettone la ricerca è fatta: lo dice la parte server, e non segue niente di ciò che manda il browser (la pagina che cerca può essere rimasta su un altro workspace); è lì che la cornice apre un risultato, e una risposta senza `workspace` per lei è un errore della ricerca; `q` è la parola cercata e si legge solo dal corpo JSON, mai dall'indirizzo: da 2 a 100 caratteri senza gli spazi ai bordi (la cornice manda i primi 100), altrimenti 422 `{errore: "dati_non_validi"}`, e così se non è un testo o sta solo nell'indirizzo; fino alla `v1.7.0` la ricerca era una GET con la parola nell'indirizzo: dalla `v1.8.0` una GET a `/cornice/ricerca` non ha una rotta e non arriva al backoffice — risponde 405, o ciò che il frontend risponde a un indirizzo senza rotta se ha una rotta di ripiego (`Route::fallback`) —, e un test del frontend che la chiama passa alla POST; una scheda aperta prima dell'aggiornamento cerca ancora con la GET finché non si ricarica: riceve quella risposta e mostra l'errore della ricerca; dalla `v1.15.0` anche dal server del modulo al backoffice la parola viaggia nel corpo: la parte server chiama `ricerca.crea` (`POST /v1/ricerca` con `{q}`), e l'indirizzo di quella richiesta non porta query; se il backoffice frena le ricerche della persona (`429` `troppe_richieste`) la rotta risponde `429` `{errore: "troppe_richieste"}` con `Retry-After`, i secondi che il backoffice ha detto, e la cornice mostra l'errore della ricerca; dalla `v1.16.0` per quei secondi, al più 60, non manda altre ricerche, qualunque cosa la persona scriva, e allo scadere non riprova da sola: parte la prima parola che la persona scrive dopo; il freno vale finché la cornice resta montata: un caricamento di pagina la rifà, e così un cambio di workspace con `LayoutDellaCornice`, e da lì la prima parola parte anche dentro quei secondi; dalla `v2.4.0` `persona` è l'email della persona della sessione, quella per cui la ricerca è fatta: viene dalla sessione, e la cornice non mostra i risultati di un'altra persona |

Senza sessione rispondono 401; con la sessione ma senza workspace 403 `{errore: "gettone_senza_workspace"}`; un backoffice
che non risponde è un errore (5xx), mai un elenco vuoto. Il prefisso `cornice/` è di zr-core: il frontend non lo usa per le
sue rotte, e nel suo test delle rotte (`Rotte::senzaGuardia()` di zr-auth) quelle di zr-core non escono, perché hanno la
guardia.

Dalla `v1.14.0`, se la persona non ha accettato i documenti legali in vigore le quattro rotte rispondono 403
`{errore: "accettazione_richiesta"}`, col solo codice: titolo, dettaglio e documenti mancanti del backoffice restano
nella parte server. La cornice lo riconosce e passa allo stato ridotto (vedi «La cornice», al punto «Chi non ha accettato
i documenti legali»); ogni altro errore del backoffice resta quello di prima. Su quelle rotte nessun middleware del
frontend chiama `/v1` senza prendere quel 403: altrimenti al browser, al posto della risposta della rotta, arriva quella di
zr-auth. Da zr-auth `v0.12.17` è un 403 con `codice` e `mancanti`: la cornice lo riconosce lo stesso, dal `codice`, e
passa allo stato ridotto. Con una patch più vecchia, che il vincolo di zr-core ammette, quell'errore non ha una risposta
sua: al browser arriva un 500, e la cornice mostra l'errore di sempre: nel pannello delle notifiche resta «Riprova».

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
  token); quando l'`AppShell` lo porta questo si toglie, senza che il modulo cambi niente.
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
  1,2 KB con gzip, con quello del punto sotto), fuori dal JS d'ingresso: se non arriva, la campanella si apre come prima,
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
- **Il menu Moduli** incrocia il registro con lo stato dei prodotti nel workspace: un prodotto `attivo` o `disponibile`
  porta a `<indirizzo>/w/<slug>` (uno `disponibile` mostra la sua pagina «non attivo nel workspace»); è «Presto», senza
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
  dati sono nuovi quando è nuovo l'oggetto, e vale sempre ciò che dà la pagina. Per il lettore di schermo la campanella si
  chiama col suo numero («Notifiche, 3 non lette»), e con una sola al singolare («Notifiche, 1 non letta»). Il design
  system ha un testo solo per le non lette, e lo usa anche per il pallino di ogni notifica non letta nel pannello: il
  pallino dice «non letta» quando sulla campanella ce n'è una sola, «non lette» negli altri casi.
- **Le notifiche** si caricano a ogni apertura della campanella, da `GET /cornice/notifiche`: ognuna col titolo del suo
  tipo nella lingua («Nuova scheda», «Una persona è entrata nel workspace») e l'ora nella lingua («5 minuti fa», «ieri»,
  «1 ott»). Dalla `v1.22.0` una notifica che racconta più azioni mostra l'ora dell'ultima, non quella della prima. Il titolo
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
  modificato». Con loro il contratto ha 39 tipi di evento e i titoli sono 44: 38 tipi di evento, i cinque «assegnata» e la
  menzione. Di che prodotto è
  lo dice `app`: se è il codice di un prodotto del registro, la notifica
  porta il suo nome nella lingua davanti all'ora («Project Management · 5 minuti fa»), la sua icona e il suo tono, anche se
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
  Chromium). Dalla `v2.2.0` l'indirizzo si compone con la cartella del JS della cornice e col nome di file con cui l'errore del
  browser finisce, subito dopo quella cartella: in `import()` entra solo un file di quella cartella, qualunque cosa dica l'errore.
  Dove l'errore non la dice o non finisce col nome del file, se l'indirizzo del JS d'ingresso ha una coda sua (`app.js?v=3`), o in un
  frontend che mette i pezzi a richiesta in un'altra cartella rispetto al JS d'ingresso — anche una cartella dentro quella —,
  «Riprova» richiama `import()` come prima: in Chromium il pezzo non viene richiesto di nuovo, e serve ricaricare la pagina. Il titolo di ripiego (`notificationTitle`) resta nel file dei
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
  scheda»). La seconda la hanno tutti i quarantaquattro tipi che hanno un titolo; la prima ventotto: i quattordici di
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
  caricate — e il gettone CSRF del cookie `XSRF-TOKEN` (lo mette Laravel nel gruppo `web`) nell'header `X-XSRF-TOKEN`:
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
  alla loro scadenza. «Segna tutte come lette» è la richiesta della cornice che dura di più — fino a circa 15 secondi,
  solo con più di 5000 non lette — e dalla `v1.6.0` tiene il blocco della sessione di Laravel (`Route::block`) per tutta
  la sua durata. Il blocco ferma solo chi lo prende: il frontend mette `->bloccaSessione()` di zr-auth sulle sue rotte che
  aprono, cambiano o chiudono la sessione — quelle che chiamano `Sessione::apri()`, `Sessione::entra()` o
  `Sessione::chiudi()`: non solo l'uscita e l'ingresso in un workspace — e sulle sue rotte lente, non su tutte: è il
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
  pagina che porti dritto a un commento. Una nota apre la cosa più
  specifica a cui è attaccata: l'opportunità se ne ha una, altrimenti il contatto, altrimenti l'azienda (fino alla
  `v1.12.0` apriva solo il contatto, e senza quello la pagina delle notifiche). Dove si apre ogni tipo lo dice il registro (`notifiche`
  della voce del modulo, più sotto), e gli id sono quelli di `ids`: la regola è `destinazioneDellaNotifica`, che chi
  mostra le notifiche in una pagina sua importa dall'ingresso. Un id non è un permesso: chi riceve la notifica può non
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
  tipi di Project Management — board, liste, cartelle, etichette, viste — non hanno una destinazione; dalla `v1.16.0` ne
  ha una anche una menzione in un commento; i due tipi dei motivi di perdita del CRM, che hanno un titolo dalla `v2.3.0`,
  non ne hanno una: il CRM non ha ancora detto che pagina aprono), le mancano gli id di ogni percorso del suo tipo, o il
  modulo in quel
  workspace non si può aprire («Presto», o né `attivo` né
  `disponibile`). L'indirizzo passa da `naviga`, come gli altri che la cornice apre.
  Dalla `v1.12.0` il clic che apre la risorsa di una notifica non letta la segna letta: la cornice chiede
  `PATCH /cornice/notifiche/<id>/lettura` con `{"letta": true}`, col gettone CSRF e con `keepalive`, perché la pagina
  sta cambiando, e la risorsa si apre senza aspettare la risposta. La funzione che lo fa, `segnaLetta`, è della cornice
  e l'ingresso non la esporta: un frontend che segna letta una notifica da una pagina sua chiama la rotta. Se l'id
  della notifica non ha la forma che la rotta vuole (lettere, cifre, `-` e `_`, 64 al più) la richiesta non parte, e
  la risorsa si apre lo stesso. Una notifica già letta, e
  una il cui clic apre la pagina delle notifiche, non chiedono niente. Il numero sulla campanella scende di uno quando la
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
  dati della pagina non scende: quella notifica non è fra le sue. Se la lettura fallisce la risorsa si è aperta lo
  stesso e in pagina non cambia niente: la notifica resta da leggere, e il numero com'era. Con `window.location.assign`
  (il `naviga` di partenza) la pagina se ne va prima della risposta, e il numero nuovo lo possono portare i dati della
  pagina dopo: se quella li legge prima che il backoffice abbia segnato la notifica la contano ancora, fino alla visita
  successiva. Resta in pagina con un `naviga` che non la ricarica, come la visita di Inertia dentro lo stesso modulo. A chi usa
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
  figli del contenitore. Si trovano cercando `cornice/notifiche` e `<Cornice` nei test del frontend; le due della ricerca
  cercando `cornice/ricerca` e i testi di prima, che il suo punto elenca.
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
  Un risultato porta tipo, id e titolo e, dalla `v1.15.0`, il `contesto`: di che
  prodotto è lo dice il registro, dal tipo. Dalla `v1.15.0` la cornice mostra sei tipi: di Project Management le schede
  (`board.scheda`), le board (`board.board`) e le cartelle (`board.cartelle`); del CRM i contatti (`crm.persona`), le
  aziende (`crm.organizzazione`) e le opportunità (`crm.trattativa`). Fino alla `v1.14.0` mostrava solo board e cartelle.
  Dalla `v1.17.0` la ricerca trova anche i membri del workspace (`workspace.membro`): non sono di un modulo, il backoffice
  li cerca in ogni workspace, anche senza moduli attivi, e nel registro stanno nella voce `home`. I
  risultati stanno raggruppati per tipo, col nome del tipo nella lingua (Schede, Board, Cartelle, Contatti, Aziende,
  Opportunità), il nome e il tono del prodotto e l'icona del tipo; i gruppi escono nell'ordine del backoffice, quello del
  primo risultato di ognuno, e dentro un gruppo i risultati nel suo ordine. Il gruppo dei membri è «Membri» (in inglese
  «Members», in spagnolo «Miembros»), con l'icona del tipo; la voce `home` non è un prodotto, e un membro non ha a destra il
  nome di un prodotto, né un tono. Dalla `v2.0.0` il titolo di un risultato è pulito come i nomi di una notifica: senza i
  caratteri che cambiano la direzione del testo, con a capo e caratteri di controllo ridotti a uno spazio; un risultato
  senza un titolo che si vede non si mostra. Sotto il titolo sta la seconda riga: i testi di
  `contesto` che il registro dice per quel tipo, uniti da « · » — board e lista di una scheda, azienda e ruolo di un
  contatto, pipeline e fase di un'opportunità —, solo quelli che ci sono; un'azienda, una board e una cartella non hanno una
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
  su `https://board.zeiras.com/w/<slug>/b/<id>`; una cartella non ha una pagina sua, e si apre sulla pagina del workspace
  dove stanno le cartelle, `https://board.zeiras.com/w/<slug>`; una scheda su `https://board.zeiras.com/w/<slug>/c/<id>`, un
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
  elenco che ha nella lingua (`searchSource.<prodotto>.<tipo>`: «schede», «board», «cartelle», «contatti», «aziende»,
  «opportunità»). Dalla `v1.17.0` dopo di loro vengono i membri del workspace (`searchSource.home.workspace.membro`:
  «membri»): sono una fonte in ogni workspace, anche senza moduli attivi, e sono nominati per ultimi. L'invito le nomina
  tutte, unite come la lingua unisce un elenco (`Intl.ListFormat`). Con Project Management attivo e il CRM no: «Cerca schede,
  board, cartelle e membri: scrivi almeno 2 caratteri.» (in inglese «Search cards, boards, folders, and members: type at least
  2 characters.», in spagnolo «Busca tarjetas, tableros, carpetas y miembros: escribe al menos 2 caracteres.»); col CRM attivo
  l'invito nomina anche contatti, aziende e opportunità, prima dei membri. Un modulo `disponibile` o in arrivo non dà fonti.
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
  `acceptanceOff`). Campanella e ricerca si spengono con ciò che l'`AppShell` ha oggi per un errore: il design system non
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
`tipo`, `autore_nome`, `risorsa_nome` e, dalla `v2.1.0`, `azioni` e `board_nome`: quando sotto il titolo non c'è il nome
della cosa, `sotto` dice quante azioni la notifica racconta e in quale board; `sotto` manca quando sotto il titolo
non c'è niente da scrivere.
`titoloDellaNotifica` e `risorsaDellaNotifica` restano come sono: chi le usa insieme ha la riga di prima, senza le
frasi. Dalla `v2.0.0` tutte e tre si importano da `…/resources/js/frasi`, e i due ingressi non le esportano più; ciò che
segue si importa ancora dall'ingresso.
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
Le destinazioni stanno nel registro, non nel codice: la voce
di un modulo ha in `notifiche` una riga per tipo, col tipo intero dell'evento (`com.zeiras.crm.nota.creata`) e il
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
non è nel percorso. Un modulo che vuole i titoli e le destinazioni delle sue notifiche
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
registro (`resources/registro/prodotti.json`). Una pagina senza sessione legge `in_arrivo`, non `presto`: Bookings è in
arrivo e non è «Presto». Dalla `v1.16.0` il CRM non è più in arrivo (`in_arrivo: false`): dal 12/10/2026 il backoffice lo
dà `disponibile` a ogni workspace; in arrivo restano Bookings e i tre «Presto». Fino alla `v1.15.0` il registro dava in
arrivo anche il CRM.

Il colore di un workspace fuori dalla cornice — un elenco dei workspace in una pagina del frontend — lo dà
`tonoDelWorkspace(id)`, dallo stesso ingresso (dalla `v1.7.0`): è la regola che usa il selettore della cornice, quindi per
lo stesso `id` il tono è lo stesso. `id` è l'`id` del workspace, com'è in ogni workspace di `aziende` nei dati della cornice.
Dà il nome di uno dei toni che il design system ammette per un workspace (`pine`, `citrus`, `coral`, `sky`, `plum`), non un
colore: il colore lo mette il CSS del design system (`var(--<tono>)`). Due workspace possono avere lo stesso tono. Un `id`
vuoto, mancante o che non è un testo non ha tono, e la funzione dà `undefined`.

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
  o senza (una pagina fuori dal workspace), la pagina si vede da sola. Il layout gliele dà **per nome**, mai con
  `{...props}`: Inertia passa al layout anche le props della pagina, e una prop del server che si chiama `actions` o
  `product` non deve arrivare alla cornice.
- **La pagina** dà alla cornice montata ciò che sa solo lei, con `useCornice`: le voci del prodotto (`nav`), la voce attiva
  (`active`), `onNavigate`, le voci del menu «+» (`create`), le azioni in topbar (`actions`) e l'area senza margine
  (`flush`). Ciò che dà vince sulle props del layout finché la pagina è montata, e sparisce quando se ne va. Nessuna voce
  attiva si dice con `null`, dal layout (`active={null}`) o dalla pagina (`useCornice({ active: null })`): `null` è un
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
  toglie il layout intero, e quella pagina resta senza cornice.
- **Quando cambia il workspace** — una visita porta un altro slug nei dati — la cornice si rifà, e la pagina con lei: la
  ricerca coi suoi risultati, i pannelli e le notifiche sono di un workspace, e quelli di prima non restano davanti a chi
  è passato a un altro. Fra pagine dello stesso workspace resta montata.
- **Una `<Cornice>` rimasta in una pagina** sotto il layout fa due cornici, una dentro l'altra: chi passa al layout la
  toglie da ogni pagina che lo usa.
- **Le voci con un indirizzo** (la Dashboard, i prodotti, «Impostazioni» in fondo alla barra) sono link veri: il browser
  ricarica la pagina, e la cornice si rifà. Resta montata nelle visite di Inertia dentro il frontend.
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
dopo quella lettura (la lingua e il nome riletti da io.mostra, l'email dell'ingresso) e, in fondo, `sessione_il`, il segno
di quella lettura. Nel layout valgono anche loro su quelli di
`subito`: se fra le due richieste la sessione è passata a un'altra persona la cornice è la sua, coi suoi dati, e i dati
di una persona non stanno sotto il nome di un'altra. Per un frontend che dà al layout `Cornice::dopo()` com'è non c'è
niente da scrivere, e tre cose si vedono. La lingua e il nome della cornice, quando `dopo` arriva, sono quelli riletti
da io.mostra, i più recenti. Una scheda rimasta ferma che rilegge il solo `dopo` dopo che la sessione è passata a
un'altra persona mostra la cornice di questa, rifatta, e la pagina con lei. E chi compone `dopo` a mano gli lascia
`lingua`, `persona` e `sessione_il`: senza, vale come prima della `v2.4.0`. Chi compone a mano i dati della cornice dà come
email della persona quella della sessione: con un'altra, campanella e ricerca ricaricano la pagina a ogni uso.
Tutte e due danno `null` senza sessione o senza workspace. `Cornice::dati()` resta com'è, e chi manda solo
`cornice` non cambia niente.

Dalla `v2.4.0` anche l'elenco delle notifiche e la ricerca dicono di chi sono: le due rotte danno `persona`, l'email della
persona della sessione. In una scheda rimasta ferma, senza visitare niente, la sessione può passare a un'altra persona, anche
sullo stesso workspace: quando lì si apre la campanella o si cerca, la risposta è di chi è entrato. La cornice non la mostra
sotto il nome di prima, nemmeno per un disegno: ricarica la pagina, che da lì è di chi è entrato, e fino ad allora il pannello
resta in caricamento. Una risposta che non dice di chi è (una parte server di prima della `v2.4.0`) vale come prima, e per la
stessa persona non cambia niente. Resta fuori «Segna tutte come lette» da una scheda ferma che ha già il suo elenco a schermo:
la rotta delle letture non dice di chi è, e un clic lì segna le notifiche di chi è nella sessione, fino all'istante di
quell'elenco.

In tutti questi casi la cornice riconosce la persona dall'email. L'email c'è sempre perché la garantisce il contratto del
backoffice: nelle API `/v1` l'email di una persona è obbligatoria, in ogni gettone. zr-auth la porta nella sessione com'è, e
non la controlla.

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
  persona niente cambia: con Indietro su una sua pagina di un altro workspace la cornice è quella di quel workspace,
  col nome e la lingua di adesso
  (chi monta `Cornice` senza il layout era già così: lì i dati di una pagina più vecchia di un'altra persona non
  valgono in nessun workspace). Altri tre limiti. Un `subito` composto a mano senza `sessione_il` vale come una
  pagina nuova, e porta la sua persona. E la cornice sa chi ha mostrato solo finché resta montata: dopo un caricamento da
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
  e il pannello lo mostra quando `dopo` arriva; una parola scritta nella ricerca in attesa non parte subito: parte da
  sola quando `dopo` è arrivato — l'ultima di almeno due caratteri che l'`AppShell` ha dato alla cornice —, e non parte
  se al posto dei dati arriva `non_letti` o l'accettazione dei documenti legali. Due limiti, dell'`AppShell`: sotto i due
  caratteri non avvisa la cornice, e una parola cancellata prima dell'arrivo viene cercata lo stesso, con l'invito sotto il
  campo vuoto; e una parola scritta meno di 300 ms prima dell'arrivo parte allo scadere dei suoi 300 ms, e fino ad allora
  sotto il campo si legge «Nessun risultato»;
- **quando `dopo` arriva** la cornice diventa quella di sempre, e la pagina non si rimonta: ciò che la persona stava
  scrivendo in un campo, il fuoco e lo scorrimento restano. Solo se `dopo` è di un'altra persona (un'altra email: la
  sessione è passata a lei fra le due richieste) la cornice si rifà, e la pagina con lei;
- **se il backoffice non risponde** (la connessione, un 5xx, un 429) `Cornice::dopo()` non lancia: dà
  `['non_letti' => true]` col segno di quell'istante (`aggiornati_il`) e lascia nel log una riga d'avviso, col solo tipo
  dell'errore: un `non_letti` letto prima dei dati che la cornice ha non la riduce. La cornice resta ridotta, con
  l'avviso «Zeiras non risponde» sopra la pagina, senza pulsante (`downTitle` e `downText`; campanella e ricerca dicono
  `downOff`), e la pagina resta dov'è. Un altro errore di `/v1` e `GettoneRifiutato` passano, come da `Cornice::dati()`:
  la sessione finita la tratta il frontend come prima;
- **a chi non ha accettato i documenti legali** resta lo stato ridotto di sempre, col suo avviso e il suo pulsante.

La lingua e il nome di `Cornice::subito()` sono quelli dell'ingresso finché una `Cornice::dopo()`, una `Cornice::dati()` o
una `Cornice::lingua()` non hanno riletto io.mostra: dalla richiesta dopo sono quelli nuovi. Dalla `v2.4.0` quelli
riletti arrivano già con `dopo`, e la cornice li mostra da quel momento. Se c'è `cornice`, il layout
usa quella e non guarda `subito` e `dopo`.

Due cose da sapere. Se la richiesta rimandata non arriva al browser la cornice resta in attesa — la rete che cade, un
errore del frontend, un errore di `/v1` che `Cornice::dopo()` lascia passare: zr-core non lo vede. Il frontend che lo
vede può dirlo da sé, con `dopo={{ non_letti: true }}`, e la cornice mostra l'avviso. E un frontend che mette la lingua
con `Cornice::lingua()` a ogni richiesta legge comunque io.mostra prima del primo disegno, e `Cornice::dopo()` lo
rilegge nella sua: io.mostra si legge due volte per visita.

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
