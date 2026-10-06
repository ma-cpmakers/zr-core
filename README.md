# zr-core

La cornice comune dei frontend di Zeiras: `AppShell` con il menu Prodotti, il selettore «Azienda › workspace», la
ricerca, le notifiche e il menu del profilo; il registro dei prodotti (icona, tono, indirizzo, stato) e i loro nomi in ogni
lingua; il design system di Zeiras nella build, una copia sola per app. È ciò che `zr-auth` è per l'ingresso, ma per ciò
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
workspace — li dà `Zeiras\Core\Cornice::dati()`, dalla sessione di `zr-auth` e da `app.elenca` col gettone del workspace.
Il gettone resta nella sessione: nei dati non c'è.

zr-core richiede `zeiras/zr-auth` `^0.3`, installato e configurato come dice il suo README (la sessione lato server,
`ZR_API_URL`). Composer non eredita i repository di un pacchetto: il repository `vcs` di zr-auth sta nel `composer.json`
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
| `{lingua, persona: {nome, email}, workspace: {nome, slug}, prodotti: {<codice>: attivo \| disponibile \| in_arrivo}}` | la persona è entrata in un workspace |
| `null`, senza chiamare il backoffice | nessuna sessione, o una sessione senza workspace (prima della scelta) |
| l'eccezione `BackofficeNonRisponde` di zr-auth | il backoffice non risponde: mai una lista di prodotti vuota, che li farebbe tutti «Presto» |

Il workspace è quello del gettone (`Sessione::workspace()` di zr-auth), non quello dell'indirizzo della pagina.

## La cornice

Ogni pagina dell'app sta dentro la `Cornice`. Il frontend dà la pagina, la lingua della persona, i suoi dati e, in un
prodotto, il proprio id del registro con le proprie voci; zr-core mette il menu Prodotti con gli indirizzi del workspace,
i testi tradotti e le pagine di account, azienda e notifiche su app.zeiras.com.

```tsx
import { Cornice } from '../../vendor/zeiras/zr-core/resources/js';

<Cornice
    lingua="es"                       // it, es, en…; it-IT vale it; una lingua che zr-core non ha è inglese
    persona={persona}                 // nome, email, piano, aziende coi workspace, slug del workspace attivo, non lette
    product="pm"                      // solo nei prodotti: l'id del registro; senza, è una pagina di app.zeiras.com
    nav={[{ group: '…', items: [ … ] }]} // le voci del prodotto, sotto il suo pulsante
    onLogout={esci}                   // obbligatorio: «Esci» chiude la sessione ovunque, ed è il frontend a farlo
>
    {pagina}
</Cornice>
```

Per aprire un indirizzo la cornice usa il browser; un frontend che naviga da sé passa `naviga(indirizzo)`. Notifiche e
ricerca si collegano quando i loro dati arrivano dal backoffice.

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
