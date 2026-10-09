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

Il design system è uno solo per app, quello di zr-core: il frontend non ne tiene una copia sua.

## La parte server

I dati della cornice — chi è la persona, la sua lingua, il workspace in cui è entrata, lo stato dei prodotti in quel
workspace, le sue aziende coi loro workspace, le notifiche non lette — li dà `Zeiras\Core\Cornice::dati()`, dalla sessione
di `zr-auth` e da quattro letture del backoffice: `app.elenca` e `io.mostra` col gettone del workspace,
`io.aziende.elenca` e `io.workspace.elenca` col gettone della persona. Il gettone resta nella sessione: nei dati non c'è.

zr-core richiede `zeiras/zr-auth` `^0.6.6 || ^0.7` (la CI lo prova con l'ultima 0.6 e con l'ultima 0.7), installato e
configurato come dice il suo README (la sessione lato server, `ZR_API_URL`). Composer non eredita i repository di un pacchetto: il repository `vcs` di zr-auth sta nel `composer.json`
del frontend, accanto a quello di zr-core.

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
| `{lingua, persona: {nome, email}, workspace: {nome, slug}, prodotti: {<codice>: attivo \| disponibile \| in_arrivo}, aziende: [{id, nome, workspace: [{nome, slug}]}], non_lette}` | la persona è entrata in un workspace |
| `null`, senza chiamare il backoffice | nessuna sessione, o una sessione senza workspace (prima della scelta) |
| l'eccezione `BackofficeNonRisponde` di zr-auth | il backoffice non risponde: mai una lista di prodotti vuota, che li farebbe tutti «Presto», né aziende vuote o zero non lette |
| l'eccezione `GettoneRifiutato` di zr-auth | il backoffice non accetta più il gettone (401): zr-auth chiude la sessione e rimanda all'ingresso da sé |
| l'eccezione `ErroreApi` di zr-auth | il backoffice risponde con un altro errore (403, 404, 422, 429…): `stato` e `codice` lo dicono |

`aziende` ha l'ordine del backoffice, e ogni azienda i suoi workspace nell'ordine dell'elenco dei workspace della persona.
`non_lette` sono le notifiche non lette della persona nel workspace in cui è entrata, come le conta il backoffice
(`notifiche_non_lette` di `io.mostra`): il numero intero, e oltre 99 la campanella mostra «99+».

Il workspace è quello del gettone (`Sessione::workspace()` di zr-auth), non quello dell'indirizzo della pagina. Persona,
lingua e workspace sono quelli che zr-auth ha messo in sessione all'ingresso nel workspace: un cambio fatto dopo (il nome,
la lingua) arriva alla cornice al prossimo ingresso.

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
| `GET /cornice/notifiche` | `{data: [{id, creata_il, letta, app}]}`: le notifiche della persona nel workspace dalla più recente, una pagina; `app` è il codice dell'app da cui viene la notifica (`pm`, `crm`…) o `null`, com'è nel backoffice |
| `PATCH /cornice/notifiche/{id}/lettura` con `{letta}` | `{data: {id, letta}}`: segna letta (`true`) o non letta (`false`) quella notifica, e `letta` è ciò che il backoffice ha segnato; senza `letta`, o se non è un booleano, 422 `{errore: "dati_non_validi"}`; una notifica che non c'è, o di un'altra persona, 404 `{errore: "non_trovato"}`; un `id` che non è fatto di lettere, cifre, `-` e `_` (64 al più) non ha rotta: 404 |
| `POST /cornice/notifiche/letture` con `{fino_a, workspace}` | `{data: {fino_a}}`: segna lette, con una richiesta sola, le notifiche della persona nel workspace nate fino a `fino_a` compreso, anche quelle oltre la prima pagina; `fino_a` è un istante con data, ora coi secondi (sei decimali al più) e fuso (`2026-10-08T10:00:00.000Z`, o `+02:00` al posto di `Z`), com'è la `creata_il` di una notifica, e quello della risposta è l'istante del backoffice, in UTC; `workspace` è lo slug del workspace della pagina che chiede (quello dei dati della cornice): se non è quello della sessione — da un'altra scheda la persona è entrata in un altro workspace — 409 `{errore: "workspace_diverso"}`, e non si segna niente; senza `fino_a` o senza `workspace`, o se `fino_a` non ha quella forma, o se quell'istante non esiste, 422 `{errore: "dati_non_validi"}` |
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
        onLogout={esci}                   // obbligatorio: «Esci» chiude la sessione ovunque, ed è il frontend a farlo
    >
        {pagina}
    </Cornice>
);
```

- **La lingua** è quella dei dati: `it-IT` vale `it`, e una lingua che zr-core non ha è inglese.
- **Il menu Prodotti** incrocia il registro con lo stato dei prodotti nel workspace: un prodotto `attivo` o `disponibile`
  porta a `<indirizzo>/w/<slug>` (uno `disponibile` mostra la sua pagina «non attivo nel workspace»); è «Presto», senza
  indirizzo, un prodotto che il registro dà «Presto», che il backoffice dà `in_arrivo` (o in uno stato che zr-core non
  conosce) o che non elenca. La Dashboard porta
  sempre a `https://app.zeiras.com/w/<slug>`.
- **Il selettore «Azienda › workspace»** in cima alla sidebar elenca le aziende dei dati coi loro workspace, nell'ordine
  in cui arrivano; scegliere un workspace porta allo stesso prodotto nel workspace scelto (`<indirizzo>/w/<slug>`), o alla
  Dashboard da una pagina di app.zeiras.com. Senza aziende, o se il workspace dei dati non sta in nessuna, il workspace
  resta testo. «Nuovo workspace» non c'è finché zr-home non ha la sua pagina.
- **La campanella** mostra le non lette dei dati (`non_lette`), «99+» oltre 99, e mai meno delle non lette dell'ultimo
  elenco che il pannello ha caricato con quegli stessi dati (una notifica può essere arrivata dopo). Coi dati nuovi — una
  visita dopo, se il frontend tiene montata la cornice — vale il loro numero.
- **Le notifiche** si caricano a ogni apertura della campanella, da `GET /cornice/notifiche`: ognuna col titolo della
  lingua, uno per tutte, e l'ora nella lingua («5 minuti fa», «ieri», «1 ott»), in «Per me» come in «Tutte» (il backoffice
  non dice per chi è una notifica). Di che prodotto è lo dice `app`: se è il codice di un prodotto del registro, la notifica
  porta il suo nome nella lingua davanti all'ora («Project Management · 5 minuti fa»), la sua icona e il suo tono, anche se
  il prodotto è «Presto» o non è attivo nel workspace; con `app` `null`, o con un codice che il registro non ha, nessun
  prodotto e l'icona della campanella. Se il caricamento fallisce, l'errore e «Riprova».
  «Segna tutte come lette» manda una richiesta sola, `POST /cornice/notifiche/letture` con `{fino_a, workspace}` — la
  `creata_il` più recente fra le notifiche caricate, così com'è, e lo slug del workspace dei dati — e il gettone CSRF del cookie `XSRF-TOKEN` (lo mette Laravel nel gruppo
  `web`) nell'header `X-XSRF-TOKEN`: segna lette le notifiche della persona nate fino a lì, anche quelle oltre la prima
  pagina, e non quelle arrivate dopo, mai viste. Alla risposta le notifiche caricate sono lette e la campanella non ha più
  un numero, fino alla prossima visita, che porta il numero del backoffice; se la richiesta fallisce non cambia niente, e
  il pulsante resta per riprovare. Il pulsante c'è quando la campanella ha un numero e il pannello ha caricato almeno una
  notifica, anche se quelle caricate sono già lette. Una notifica e «Vedi tutte» aprono
  `https://app.zeiras.com/notifiche`.
- **La ricerca** (Ctrl/Cmd+K) chiede `GET /cornice/ricerca?q=` dal secondo carattere, 300 ms dopo l'ultimo tasto; una
  parola nuova annulla la richiesta di prima, e una risposta arrivata tardi non sostituisce mai quella dell'ultima parola. Un
  risultato porta solo tipo, id e titolo: di che prodotto è lo dice il registro, dal tipo (oggi board e cartelle, di Project
  Management). I risultati stanno raggruppati per tipo, col nome del tipo nella lingua, il nome e il tono del prodotto e
  l'icona del tipo; un tipo che il registro non ha non si mostra. Scegliere un risultato apre l'indirizzo del suo prodotto
  nel workspace seguito dal percorso del tipo: una board si apre su `https://board.zeiras.com/w/<slug>/b/<id>`; una
  cartella non ha una pagina sua, e si apre sulla pagina del workspace dove stanno le cartelle,
  `https://board.zeiras.com/w/<slug>`. Se la rotta fallisce, l'errore della ricerca, mai «Nessun risultato».

Per aprire un indirizzo la cornice usa il browser; un frontend che naviga da sé passa `naviga(indirizzo)`: un prodotto che
apre da sé le sue risorse (una board, senza ricaricare la pagina) lo intercetta lì.

Fuori dalla cornice — le schede dei prodotti nella Dashboard — il registro e il nome di ogni voce nella lingua della
persona si importano dallo stesso ingresso: `registro` e `nomeDellaVoce(voce, lingua)`.

## La CSP

Gli stili della cornice arrivano da file e i font da Google Fonts, come li carica il design system: nessun `<style>`
aggiunto da JS e nessun attributo `style` nell'HTML. I pochi stili che i componenti mettono su un elemento passano da
JS (CSSOM), che `style-src` non governa. Chi installa zr-core apre la sua CSP almeno a questo:

```
Content-Security-Policy: default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com
```

e ci aggiunge ciò che serve a lui (le sue API in `connect-src`, le sue immagini in `img-src`). È il minimo per la cornice,
non una policy completa: `frame-ancestors`, `base-uri` e `form-action` non ricadono su `default-src`, e il frontend li
mette da sé.
