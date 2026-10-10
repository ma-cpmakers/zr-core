# zr-core

La cornice comune dei frontend di Zeiras: `AppShell` con il menu Prodotti, il selettore «Azienda › workspace», la
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

**Il JS**: i componenti si importano dall'ingresso del pacchetto, che scrive `window.React` prima di caricare il design
system. React lo porta il frontend: il pacchetto non ne ha una copia.

```ts
import { Zeiras } from '../../vendor/zeiras/zr-core/resources/js';
```

**Le intestazioni di sicurezza**: una riga nel `bootstrap/app.php` del frontend registra la classe che le scrive su ogni
risposta di Laravel — più sotto, «Le intestazioni di sicurezza».

Il design system è uno solo per app, quello di zr-core: il frontend non ne tiene una copia sua.

## La parte server

I dati della cornice — chi è la persona, la sua lingua, il workspace in cui è entrata, lo stato dei prodotti in quel
workspace, le sue aziende coi loro workspace, le notifiche non lette — li dà `Zeiras\Core\Cornice::dati()`, dalla sessione
di `zr-auth` e da quattro letture del backoffice: `app.elenca` e `io.mostra` col gettone del workspace,
`io.aziende.elenca` e `io.workspace.elenca` col gettone della persona. Il gettone resta nella sessione: nei dati non c'è.

L'ordine in cui `Cornice::dati()` fa le quattro letture non è un contratto: può cambiare da una versione all'altra (dalla
`v1.2.2` la prima è `io.mostra`, per contare le non lette prima di ogni altra lettura). Un test del frontend non fissi «la
prima lettura»: guardi quali letture partono e con quale gettone, non in che ordine.

zr-core richiede `zeiras/zr-auth` `^0.12.4` (la CI lo prova con l'ultima 0.12), installato e configurato come dice il suo
README (la sessione lato server, `ZR_API_URL`). Dalla `v1.4.0` una zr-auth più vecchia non basta: la cornice chiama
`Sessione::aggiorna`, che c'è dalla 0.12, e con una più vecchia Composer lascia zr-core alla `v1.3.0`. Dalla `v1.6.0` serve
la 0.12.4: «Segna tutte come lette» tiene il blocco della sessione coi tempi di zr-auth, e la 0.12.4 è la patch con cui la
CI ha provato quel codice; con una più vecchia della 0.12.4 Composer lascia zr-core alla `v1.5.0`. Composer non eredita i
repository di un pacchetto: il repository `vcs` di zr-auth sta nel `composer.json` del frontend, accanto a quello di
zr-core.

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
| `{lingua, persona: {nome, email}, workspace: {nome, slug}, prodotti: {<codice>: attivo \| disponibile \| in_arrivo}, aziende: [{id, nome, workspace: [{nome, slug}]}], non_lette, aggiornati_il}` | la persona è entrata in un workspace |
| `null`, senza chiamare il backoffice | nessuna sessione, o una sessione senza workspace (prima della scelta) |
| l'eccezione `BackofficeNonRisponde` di zr-auth | il backoffice non risponde: mai una lista di prodotti vuota, che li farebbe tutti «Presto», né aziende vuote o zero non lette |
| l'eccezione `GettoneRifiutato` di zr-auth | il backoffice non accetta più il gettone (401): zr-auth chiude la sessione e rimanda all'ingresso da sé |
| l'eccezione `ErroreApi` di zr-auth | il backoffice risponde con un altro errore (403, 404, 422, 429…): `stato` e `codice` lo dicono |

`aziende` ha l'ordine del backoffice, e ogni azienda i suoi workspace nell'ordine dell'elenco dei workspace della persona.
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

Il workspace è quello del gettone (`Sessione::workspace()` di zr-auth), non quello dell'indirizzo della pagina. Persona,
lingua e workspace sono quelli della sessione di zr-auth. La lingua e il nome la cornice li tiene aggiornati: a ogni
lettura `Cornice::dati()` dà a `Sessione::aggiorna` di zr-auth la risposta di `io.mostra` che ha già letto per le non
lette, e la sessione prende la lingua e il nome del profilo, se sono cambiati. Cambiano solo quei due: email, workspace,
ruolo e gettoni restano quelli dell'ingresso. I dati della cornice portano la lingua e il nome nuovi da quella stessa
richiesta; ciò che il frontend ha letto dalla sessione prima di chiamare `Cornice::dati()` — di solito la lingua della
pagina, in un middleware — in quella richiesta è ancora quello di prima, e dalla richiesta dopo è nuovo. Un frontend che
vuole la pagina nella lingua nuova già da quella richiesta chiama `Cornice::dati()` prima di leggere la lingua, o rilegge
`Sessione::utente()` dopo. Chi la chiama prima ne tiene il risultato e dà quello a `share()`, senza chiamarla un'altra
volta: `Cornice::dati()` rilegge tutto a ogni chiamata — due chiamate nella stessa richiesta sono otto letture invece di
quattro, con due segni — e in un middleware parte a ogni richiesta che ci passa, anche senza una pagina da mostrare.

Con la funzione nel `share()`, `BackofficeNonRisponde` ed `ErroreApi` fermano ogni risposta Inertia, anche quella di una
pagina senza cornice: come mostrarle lo decide il frontend, nel suo gestore delle eccezioni (`withExceptions` in
`bootstrap/app.php`); senza, sono un 500.

### Le rotte della cornice

zr-core registra da sé, nel gruppo `web` del frontend (sessione, guardia di zr-auth, CSRF), le sue rotte per il browser,
sulla stessa origine: quelle che la cornice chiama, e la lettura di una notifica sola, che dalla v1.1.0 la cornice non
chiama più e resta per i frontend che la usano. La parte server le gira al backoffice col gettone del workspace, che non
esce.

| Rotta | Risponde |
|---|---|
| `GET /cornice/notifiche` | `{data: [{id, creata_il, letta, app, tipo}], aggiornati_il}`: le notifiche della persona nel workspace dalla più recente, una pagina; `app` è il codice dell'app da cui viene la notifica (`pm`, `crm`…) o `null`, com'è nel backoffice; `tipo` è il tipo dell'evento che l'ha generata (`com.zeiras.board.cartella.creata`…), com'è nel backoffice: la parte server non lo traduce e non lo confronta con un elenco, e ne può arrivare uno nuovo — il titolo glielo dà la cornice, nel browser (vedi «Le notifiche»); una notifica che il backoffice dà senza `tipo`, o con un `tipo` che non è una stringa, è un errore (5xx), qui e in `PATCH /cornice/notifiche/{id}/lettura`; `aggiornati_il` è l'istante in cui la parte server ha cominciato a leggere l'elenco, prima di chiamare il backoffice, in UTC e nella forma del segno dei dati della cornice (`2026-10-09T21:31:05.123456Z`): l'elenco è almeno fresco quanto quell'istante |
| `PATCH /cornice/notifiche/{id}/lettura` con `{letta}` | `{data: {id, letta}}`: segna letta (`true`) o non letta (`false`) quella notifica, e `letta` è ciò che il backoffice ha segnato; senza `letta`, o se non è un booleano, 422 `{errore: "dati_non_validi"}`; una notifica che non c'è, o di un'altra persona, 404 `{errore: "non_trovato"}`; un `id` che non è fatto di lettere, cifre, `-` e `_` (64 al più) non ha rotta: 404 |
| `POST /cornice/notifiche/letture` con `{fino_a, workspace}` | `{data: {fino_a, altre}, segnate_il}`: segna lette le notifiche della persona nel workspace nate fino a `fino_a` compreso, anche quelle oltre la prima pagina; `fino_a` è un istante con data, ora coi secondi (sei decimali al più) e fuso (`2026-10-08T10:00:00.000Z`, o `+02:00` al posto di `Z`), com'è la `creata_il` di una notifica, e quello della risposta è l'istante del backoffice, in UTC; il backoffice ne segna al più 5000 per chiamata e dice se ne restano: la parte server lo richiama con lo stesso `fino_a` finché ne restano, entro due tetti — al più 5 chiamate al backoffice per richiesta (25.000 notifiche), e nessuna chiamata nuova passati 10 secondi dall'arrivo della richiesta; `altre` è `false` quando il backoffice ha detto che non ne restano, e `true` quando un tetto ha fermato i richiami e ne restano ancora: non è un errore, e la stessa richiesta, ripetuta, continua da lì; `segnate_il` è l'istante preso dopo l'ultima risposta del backoffice, sull'orologio della parte server e nella forma di `aggiornati_il`: ciò che è stato letto prima di quell'istante può non sapere di questa lettura; `workspace` è lo slug del workspace della pagina che chiede (quello dei dati della cornice): se non è quello della sessione — da un'altra scheda la persona è entrata in un altro workspace — 409 `{errore: "workspace_diverso"}`, e non si segna niente; senza `fino_a` o senza `workspace`, o se `fino_a` non ha quella forma, o se quell'istante non esiste, 422 `{errore: "dati_non_validi"}`; se il backoffice non risponde in tempo, risponde un errore, o risponde senza `altre` o con un `altre` che non è un booleano, alla prima chiamata o a un richiamo, è un errore (5xx) senza `segnate_il`, anche se può averne segnate: ripetere la stessa richiesta non cambia ciò che è già segnato; la rotta tiene il blocco della sessione per tutta la sua durata, e se un'altra richiesta della stessa sessione lo tiene per più di 3 secondi risponde 503 con `Retry-After: 1`, senza chiamare il backoffice; arrivata alla rotta passati 10 secondi dall'arrivo della richiesta risponde 503 `{errore: "fuori_tempo"}` con `Retry-After: 1`, anche lei senza chiamare il backoffice; il blocco dura 20 secondi da quando è preso, coi tempi di partenza, e una richiesta che i middleware del frontend tengono più a lungo prima della rotta ci arriva a blocco scaduto (vedi «Le notifiche») |
| `GET /cornice/ricerca?q=` | `{data: [{tipo, id, titolo}]}`: le board (`tipo` `board.board`) e le cartelle (`board.cartelle`) del workspace col nome che contiene `q`, nell'ordine del backoffice (per titolo), la prima pagina; `q` da 2 a 100 caratteri senza gli spazi ai bordi (la cornice manda i primi 100), altrimenti 422 `{errore: "dati_non_validi"}` |

Senza sessione rispondono 401; con la sessione ma senza workspace 403 `{errore: "gettone_senza_workspace"}`; un backoffice
che non risponde è un errore (5xx), mai un elenco vuoto. Il prefisso `cornice/` è di zr-core: il frontend non lo usa per le
sue rotte, e nel suo test delle rotte (`Rotte::senzaGuardia()` di zr-auth) quelle di zr-core non escono, perché hanno la
guardia.

## La cornice

Ogni pagina di un workspace sta dentro la `Cornice`. Il frontend dà la pagina, i dati della parte server (`Cornice::dati()`)
e, in un prodotto, il proprio id del registro con le proprie voci; zr-core mette il menu Prodotti con gli indirizzi del
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
  entra con un file solo.
- **Il menu Prodotti** incrocia il registro con lo stato dei prodotti nel workspace: un prodotto `attivo` o `disponibile`
  porta a `<indirizzo>/w/<slug>` (uno `disponibile` mostra la sua pagina «non attivo nel workspace»); è «Presto», senza
  indirizzo, un prodotto che il registro dà «Presto», che il backoffice dà `in_arrivo` (o in uno stato che zr-core non
  conosce) o che non elenca. La Dashboard porta
  sempre a `https://app.zeiras.com/w/<slug>`.
- **La voce attiva** della barra è quella che ha l'id dato in `active`; senza `active` è la Dashboard. Una pagina che non
  sta sotto nessuna voce lo dice con `active={null}`: nessuna voce è segnata, né la Dashboard né una voce del prodotto,
  e non serve inventare un id che la barra non ha. Il prodotto aperto lo dice `product`, non `active`: con `null` il suo
  pulsante resta com'è.
- **Il selettore «Azienda › workspace»** in cima alla sidebar elenca le aziende dei dati coi loro workspace, nell'ordine
  in cui arrivano; scegliere un workspace porta allo stesso prodotto nel workspace scelto (`<indirizzo>/w/<slug>`), o alla
  Dashboard da una pagina di app.zeiras.com. Senza aziende, o se il workspace dei dati non sta in nessuna, il workspace
  resta testo. «Nuovo workspace» non c'è finché zr-home non ha la sua pagina.
- **La campanella** mostra le non lette dei dati (`non_lette`), «99+» oltre 99, e mai meno delle non lette dell'ultimo
  elenco che il pannello ha caricato, finché i dati non sono stati letti dopo quell'elenco (una notifica può essere
  arrivata dopo che la parte server le ha contate). Coi dati letti dopo — una visita dopo, se il frontend tiene montata la
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
  «1 ott»), in «Per me» come in «Tutte» (il backoffice non dice per chi è una notifica). Il titolo lo dice `tipo`, e i
  titoli stanno nelle lingue di zr-core, uno per ogni tipo di evento del contratto: una notifica di un tipo che zr-core non
  conosce, o senza `tipo`, ha il titolo di ripiego («Novità nel workspace»), mai il codice del tipo. Un tipo di notifica
  nuovo vuole una versione nuova di zr-core per avere il suo titolo: fino ad allora si legge il ripiego. Di che prodotto è
  lo dice `app`: se è il codice di un prodotto del registro, la notifica
  porta il suo nome nella lingua davanti all'ora («Project Management · 5 minuti fa»), la sua icona e il suo tono, anche se
  il prodotto è «Presto» o non è attivo nel workspace; con `app` `null`, o con un codice che il registro non ha, nessun
  prodotto e l'icona della campanella. Se il caricamento fallisce, l'errore e «Riprova».
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
  dice finché quel giro di letture non è finito — con una lettura completa, o con l'elenco chiesto da capo (il pannello
  riaperto, «Riprova») —, poi torna «Segna tutte come lette». Se la richiesta fallisce il pulsante torna al testo che
  aveva prima del clic. I due testi sono di zr-core, `markingAllRead` e `markRestRead` nelle sue lingue: in una lingua
  che zr-core non ha sono in inglese. Una cosa la cornice ancora non la dice: l'avviso per il lettore di schermo. Il
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
  quando la campanella ha un numero e il pannello ha caricato almeno una notifica, anche se quelle caricate sono già lette.
  Una notifica e «Vedi tutte» aprono `https://app.zeiras.com/notifiche`.
- **La ricerca** (Ctrl/Cmd+K) chiede `GET /cornice/ricerca?q=` dal secondo carattere, 300 ms dopo l'ultimo tasto; una
  parola nuova annulla la richiesta di prima, e una risposta arrivata tardi non sostituisce mai quella dell'ultima parola. Un
  risultato porta solo tipo, id e titolo: di che prodotto è lo dice il registro, dal tipo (oggi board e cartelle, di Project
  Management). I risultati stanno raggruppati per tipo, col nome del tipo nella lingua, il nome e il tono del prodotto e
  l'icona del tipo; un tipo che il registro non ha non si mostra. Scegliere un risultato apre l'indirizzo del suo prodotto
  nel workspace seguito dal percorso del tipo: una board si apre su `https://board.zeiras.com/w/<slug>/b/<id>`; una
  cartella non ha una pagina sua, e si apre sulla pagina del workspace dove stanno le cartelle,
  `https://board.zeiras.com/w/<slug>`. Se la rotta fallisce, l'errore della ricerca, mai «Nessun risultato».
- **Il menu del profilo** ha Profilo, Impostazioni, Azienda e, dopo una linea, Esci: le prime tre aprono le loro pagine su
  app.zeiras.com (`/impostazioni/profilo`, `/impostazioni/preferenze`, `/azienda`), «Esci» chiama `onLogout`. La voce
  «Piano» è spenta di default: i piani non esistono ancora, e la voce porterebbe a una pagina che non c'è. Si accende con
  la prop `piano` (`<Cornice piano … />`, o sul layout della cornice) quando la pagina del piano esiste su app.zeiras.com
  (`/azienda/impostazioni/piano`): allora il menu è quello del design system, con «Piano» fra Impostazioni e Azienda.

Per aprire un indirizzo la cornice usa il browser; un frontend che naviga da sé passa `naviga(indirizzo)`: un prodotto che
apre da sé le sue risorse (una board, senza ricaricare la pagina) lo intercetta lì.

Fuori dalla cornice — le schede dei prodotti nella Dashboard — il registro e il nome di ogni voce nella lingua della
persona si importano dallo stesso ingresso: `registro` e `nomeDellaVoce(voce, lingua)`. Dallo stesso ingresso si importa
`titoloDellaNotifica(tipo, lingua)`, per chi mostra le notifiche in una pagina sua: dà il titolo di una notifica di quel
tipo nella lingua, ed è la funzione che usa il pannello delle notifiche della cornice, quindi il testo è lo stesso. `tipo`
è il `tipo` della notifica, com'è nella risposta del backoffice (`com.zeiras.board.scheda.creata`); `lingua` è il codice
della lingua della persona, e vale come per la cornice: `it-IT` è `it`, e con una lingua che zr-core non ha il titolo è in
inglese. I tipi che zr-core conosce sono le chiavi `notificationTitle.<tipo>` dell'inglese (`resources/lingue/en.json`):
un tipo che non è fra quelle — nuovo nel contratto, vuoto, mancante, o che non è un testo — ha il titolo di ripiego della
lingua («Novità nel workspace»), mai il codice del tipo.

Ogni voce del registro porta due sì o no sullo stato del prodotto, e non dicono la stessa cosa. `presto` è della cornice:
un prodotto «Presto» non c'è ancora, e la sua voce non porta da nessuna parte in nessun workspace, qualunque cosa dica il
backoffice. `in_arrivo` è per le pagine senza sessione — Registrati —, che non hanno un workspace a cui chiedere lo stato
di un prodotto: lì un prodotto in arrivo si mostra «In arrivo», non «Disponibile», perché non lo può ancora aprire
nessuno, salvo i workspace che il backoffice ammette in anteprima. Dentro la sessione lo stato di un prodotto lo dà il
backoffice, workspace per workspace, e la cornice `in_arrivo` non lo legge: nel workspace di un'anteprima il prodotto si
apre, se il registro non lo dà «Presto». Ogni prodotto «Presto» è anche in arrivo; quali prodotti lo sono lo dice il
registro (`resources/registro/prodotti.json`).

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
