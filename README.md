# zr-core

La cornice comune dei frontend di Zeiras: `AppShell` con il menu Prodotti, il selettore «Azienda › workspace», la
ricerca, le notifiche e il menu del profilo; il registro dei prodotti (nome, icona, tono, indirizzo, stato); il design
system di Zeiras nella build, una copia sola per app. È ciò che `zr-auth` è per l'ingresso, ma per ciò che si vede: i
frontend `zr-*` lo installano e non ricostruiscono la cornice nel proprio codice.

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

## La CSP

Gli stili della cornice arrivano da file e i font da Google Fonts, come li carica il design system; nessuno stile è
iniettato da JS. Chi installa zr-core apre la sua CSP almeno a questo:

```
Content-Security-Policy: default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com
```

e ci aggiunge ciò che serve a lui (le sue API in `connect-src`, le sue immagini in `img-src`).
