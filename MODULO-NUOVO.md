# Come nasce un modulo nuovo

Per l'agente di un frontend Zeiras che nasce (Laravel, Inertia, React): che cosa fare, in che ordine, per stare nella
cornice. Ogni passo dice **che cosa scrivi e dove**, **come provi che funziona** e **l'errore già pagato** da chi è venuto
prima (zr-board e zr-crm, sentiti l'11/10/2026). Il contratto resta il README di zr-core: qui c'è l'ordine, lì il dettaglio.

Come si legge:

- un percorso dentro la cartella del pacchetto (`vendor/zeiras/zr-core/README.md`) è un file di zr-core: lo leggi, non lo
  cambi; lo stesso vale per zr-auth, il cui README è `vendor/zeiras/zr-auth/README.md`;
- ogni altro percorso (`bootstrap/app.php`, `config/zr-core.php`) è un file del **tuo** frontend;
- «README» seguito da un titolo fra virgolette è una sezione del README di zr-core; ciò che è di zr-auth è detto di
  zr-auth, e si legge nel suo README;
- «si chiede» ha sempre un destinatario: a chi, e come, è scritto in «Prima di tutto», qui sotto.

| # | Passo | Di chi è il codice |
|---|---|---|
| 1 | Installare zr-core (zr-auth arriva con lui) | tuo: `composer.json`, il CSS e il JS d'ingresso |
| 2 | L'ingresso, la sessione, l'uscita | zr-auth; tu scrivi la pagina di casa e l'uscita |
| 3 | Le intestazioni di sicurezza | zr-core; tu la registri |
| 4 | La CSP del modulo | tuo: `config/zr-core.php`, solo se aggiungi un'origine |
| 5 | La lingua | zr-core; tu scrivi un middleware di una riga |
| 6 | I dati della cornice | zr-core; tu li condividi con le pagine |
| 7 | La cornice montata una volta sola | tuo: il layout |
| 8 | Il prodotto nel registro | zr-core: si chiede |
| 9 | La ricerca | zr-core; le tue risorse si chiedono |
| 10 | Il test di allineamento al design system | tuo |
| 11 | L'accessibilità delle tue pagine | tuo |

## Prima di tutto: ciò che si chiede ad altri

Tre cose non le scrivi tu e hanno un'attesa. Chiedile il primo giorno, e intanto fai i passi da 1 a 7.

- **Il prodotto nel registro** — all'agente di zr-core (come gli si scrive lo dice la skill `zr-core-uso`). Guarda prima
  `vendor/zeiras/zr-core/resources/registro/prodotti.json`: porta anche i prodotti non ancora usciti, segnati «Presto»
  (`presto`). Se il tuo c'è, il codice è quello, e chiedi di togliere «Presto»; se non c'è, chiedi il prodotto nuovo.
  Gli dai: il codice (lettere minuscole, corto, come `pm` o `crm`: è lo stesso che il backoffice usa per l'app, e non lo
  scegli tu — un codice nuovo lo decide zr-pm, a cui lo porta zr-core), il nome in ogni lingua di Zeiras (`it`, `en`,
  `es`), l'icona (un nome del set di Zeiras), il tono, l'indirizzo senza workspace, e le risorse che la ricerca deve
  mostrare (passo 9). Entra con una versione di zr-core: fino a quella vale «Durante lo sviluppo», al passo 8.
- **Il prodotto nel workspace di prova** — a zr-backoffice (la skill `zr-start-flow`): il backoffice deve dare il tuo
  prodotto `attivo` o `disponibile` in quel workspace, se no nel menu Prodotti la tua voce resta «Presto» anche col
  registro a posto. È la stessa strada per ogni dato o metodo di `/v1` che ti manca.
- **L'infrastruttura** — il sito, il server web e le sue intestazioni (passo 3), lo store che tiene i blocchi della
  sessione (passo 2): a chi si chiedono, e come, lo dice il prompt di partenza del tuo modulo.

## 1. Installare zr-core (zr-auth arriva con lui)

**Scrivi**, nel `composer.json`, i due repository. Sono pubblici: niente chiavi né gettoni.

```json
"repositories": [
    { "type": "vcs", "url": "https://github.com/ma-cpmakers/zr-core" },
    { "type": "vcs", "url": "https://github.com/ma-cpmakers/zr-auth" }
]
```

Poi `composer require "zeiras/zr-core:^1.10.1"`, o con l'ultima versione con tag al posto di quella (questa guida c'è
dalla `v1.10.1`). zr-auth lo richiede zr-core, e Composer lo installa con lui. Poi i due `@import` del CSS nell'ordine
dato, l'import dei componenti dall'ingresso del pacchetto e, nel tuo `tsconfig`, `target` ES2022 o più recente:
README, «Come si installa in un frontend». La favicon di Zeiras arriva dal pacchetto, con una riga nel layout Blade e tre
file statici: README, «La favicon». Il design system nella build è quello di zr-core: non ne tieni una copia tua.

**Prova**: `grep -c '"url": "git@' composer.lock` risponde 0 (la CI e il server installano senza chiavi); `tsc --noEmit` e
la build passano; in pagina `window.Zeiras` c'è una volta sola.

**Errore già pagato**: Composer non eredita i repository di un pacchetto, e senza quello di zr-auth nel tuo `composer.json`
zr-core non si installa. Una seconda copia del design system accanto a quella del pacchetto si sovrascrive con la prima.
Con un `target` più vecchio di ES2022 `tsc --noEmit` si ferma sui sorgenti del pacchetto, non sui tuoi.

## 2. L'ingresso, la sessione, l'uscita

È di **zr-auth**: la sessione lato server col gettone, il ricevitore dell'ingresso da zr-home, la guardia e il suo test.
**Scrivi** ciò che dice il README di zr-auth (`vendor/zeiras/zr-auth/README.md`), nell'ordine «Installazione», «La sessione
col gettone», «Il blocco della sessione: una richiesta lenta non rimette la sessione di prima» (col suo punto «Chi aspetta
dietro un ingresso»), «L'ingresso da zr-home: la partenza e il ricevitore», «La guardia, e il suo test». zr-crm ha
ricopiato da zr-board ed è andata liscia. Tre cose sono tue:

- **la pagina di casa**: la cornice manda al tuo prodotto con `<indirizzo>/w/<slug>`, dal menu Prodotti e dal selettore
  dei workspace, quindi il modulo serve `/w/{slug}`. Chi ci arriva senza una sessione lo tratta la guardia di zr-auth, che
  lo rimanda all'accesso: non scrivi un controllo tuo;
- **l'uscita**: una rotta POST del modulo che chiude l'accesso nel backoffice e chiama `Sessione::chiudi()` (il codice è
  nel README di zr-auth, «La sessione col gettone»). Nel browser, la funzione che chiama quella rotta — nei due README si
  chiama `esci` — è quella che dai alla cornice in `onLogout`, al passo 7: «Esci» chiude la sessione, ed è il frontend a
  farlo. Dopo, la persona non ha una sessione: dove rimandarla lo decidi tu, e ogni pagina del modulo la manda comunque
  all'accesso;
- **il blocco della sessione**: `->bloccaSessione()` di zr-auth sulle tue rotte che aprono, cambiano o chiudono la
  sessione — quelle che chiamano `Sessione::apri()`, `Sessione::entra()` o `Sessione::chiudi()`, l'uscita compresa — e
  sulle tue rotte lente, non su tutte. Quali, e perché: README, «La cornice», al punto «Le notifiche».

**Prova**: entri da app.zeiras.com in un workspace e arrivi a `/w/<slug>` del modulo con la sessione aperta; con «Esci»
la sessione è chiusa, e tornando a una pagina del modulo la guardia ti rimanda all'accesso; il test della guardia di
zr-auth (`Rotte::senzaGuardia()`) non elenca nessuna tua rotta che deve averla.

**Errore già pagato**: il blocco messo da una parte sola non ferma niente, e vuole uno store che sappia fare i lock
(Redis, database, file; `array` nei test): con uno che non li fa la rotta risponde 500 a ogni clic. Lo store è
infrastruttura: si chiede prima («Prima di tutto»).

## 3. Le intestazioni di sicurezza

**Scrivi** una riga in `bootstrap/app.php`: registri `Zeiras\Core\Http\IntestazioniSicurezza` prima dei middleware
globali — README, «Le intestazioni di sicurezza». Se il frontend ha già una classe sua con lo stesso compito, la cancelli.
Poi scrivi il tuo test, coi cinque valori per intero — README, «Il test nel modulo» (zr-crm lo chiama `IntestazioniTest`,
in `tests/Feature/`).

**Prova**: il tuo test è verde; sul sito vero una tua pagina risponde con una sola CSP:
`curl -sI <una tua pagina> | grep -ci '^content-security-policy:'` risponde 1.

**Errore già pagato**: con la classe del modulo rimasta, la risposta porta due CSP e il browser le applica tutte e due
(zr-crm). Un test che guarda solo la prima CSP, o che rilegge una costante del pacchetto, resta verde lo stesso. E la
classe non copre tutto: i file statici e gli errori del server web hanno le intestazioni che dà il server web, e quei
valori vanno tenuti uguali a questi da chi fa l'infrastruttura («Prima di tutto»; zr-board: due copie da allineare) —
README, «Che cosa resta al server web». Sapere chi le mette e dove, prima di scriverle, evita di scriverle due volte.

## 4. La CSP del modulo

La CSP di tutti la dà la classe del passo 3: non ne scrivi una. **Scrivi** solo se il modulo aggiunge un'origine:
`php artisan vendor:publish --tag=zr-core-config` porta `config/zr-core.php` nel frontend, e le origini stanno lì e solo
lì. Un'origine che serve a ogni pagina (un font tuo) va in `csp` — README, «Le sorgenti di un modulo». Una che serve a una
pagina sola (il widget di un altro sito) va in un insieme di `csp_pagine`, che il controller chiama per nome —
README, «Per una pagina sola». Una `fetch` verso un'altra origine vuole `connect-src`; verso il tuo stesso sito, niente.

**Prova**: la console del browser non segna violazioni della CSP in nessuna tua pagina. La CSP nuova la leggi una volta
dalla risposta (`curl -sI`, come al passo 3) e la incolli per intero nel test del passo 3, con un caso per ogni pagina
che ne chiede di sue.

**Errore già pagato**: la barra d'avanzamento di Inertia aggiunge un `<style>` che la CSP ferma —
README, «La barra d'avanzamento di Inertia». Una sorgente scritta male è scartata, non corretta: lo dice il log, non la
pagina. Che cosa la CSP ammette già (i font del design system) è in README, «La CSP».

## 5. La lingua

**Scrivi** un middleware di una riga: la lingua della pagina la dà `Cornice::lingua()`. Un progetto nuovo non ne ha uno;
per esempio, in `app/Http/Middleware/LinguaDellaPagina.php`:

```php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Symfony\Component\HttpFoundation\Response;
use Zeiras\Core\Cornice;

class LinguaDellaPagina
{
    public function handle(Request $request, Closure $next): Response
    {
        App::setLocale(Cornice::lingua() ?? config('app.locale'));

        return $next($request);
    }
}
```

Lo dai, nel file delle rotte, al gruppo delle rotte che mostrano una pagina — non al gruppo `web`, che passa anche dalle
rotte della cornice e dalle tue rotte JSON: lì la riga costa una lettura del backoffice in più a ogni richiesta. Nella
vista radice: `<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">`. Per un modulo nuovo è l'unica strada da
scrivere — README, «La parte server», da «Per avere la pagina nella lingua nuova». Da sapere, dallo stesso punto:

- `Cornice::lingua()` dà la lingua **della sessione**, com'è, se ha la forma di una lingua; se no dà `null`, e la riga
  ripiega sulla lingua dell'app. Non la riduce: `it-IT` resta `it-IT`, e se le tue cartelle `lang/` hanno solo `it` la
  riduzione la fai tu (la cornice, per i suoi testi, la fa da sé);
- le lingue di Zeiras sono `it`, `en`, `es`. Quale lingua c'è nella sessione lo decide zr-auth, all'ingresso e a ogni
  lettura, e cambia fra le sue versioni: il capoverso che comincia con «Quale lingua c'è nella sessione» dice che cosa
  aspettarsi con ognuna, e un tuo test su una lingua che non è di Zeiras guarda quale zr-auth è installata;
- con una lingua ben fatta che il modulo non ha, Laravel ripiega sulla sua lingua di ripiego (in `config/app.php`) per i
  testi dei file a gruppi, e per quelli JSON dà la chiave com'è.

**Prova**: cambi lingua nel profilo su app.zeiras.com, apri una pagina del modulo: è nella lingua nuova **alla prima
pagina**, `<html lang>` e testi condivisi compresi. In un test: nel backoffice finto di zr-auth (`BackofficeFinto`) la
lingua della persona è un argomento di `persona(…)`, e `io.modifica` la cambia (README di zr-auth, «Il backoffice finto,
per i test»); dopo il cambio, la risposta della tua pagina è nella lingua nuova.

**Errore già pagato**: il più caro per zr-crm (tre correzioni) e pagato anche da zr-board: la lingua e le traduzioni lette
prima dei dati della cornice lasciavano la prima pagina nella lingua vecchia. La CI era verde: l'ha trovato la UAT. Vale
ancora per ciò che è tradotto e si calcola **prima** che la riga giri — un valore già pronto dentro `share()`, le
etichette della navigazione —: lo dai come funzione, come `cornice` al passo 6.

## 6. I dati della cornice

**Scrivi**, nel `share()` del middleware di Inertia (`HandleInertiaRequests`), la chiave `cornice` come funzione:
`'cornice' => fn () => Cornice::dati()`. La funzione conta: la lettura parte quando la risposta si costruisce, dopo il
middleware della lingua, e usa la lettura che `Cornice::lingua()` ha già fatto invece di rifarla. Poi, nel gestore delle
eccezioni di `bootstrap/app.php`, che cosa mostrare quando il backoffice non risponde (`BackofficeNonRisponde`,
`ErroreApi`): lo decidi tu — una pagina d'errore tua, un avviso —, e senza sono un 500 — README, «La parte server».

**Prova**: una tua pagina riceve `cornice` col nome della persona e il workspace; senza workspace riceve `null` e si vede
senza cornice. Nei test guardi **quali** letture partono e con quale gettone, non in che ordine: il backoffice finto di
zr-auth sta sul finto HTTP di Laravel, e le richieste partite si leggono da lì.

**Errore già pagato**: un test che fissa «la prima lettura» si rompe a un aggiornamento (l'ordine non è un contratto). Un
backoffice finto scritto a mano deve dare l'`id` di ogni workspace, o i dati falliscono. Due chiamate nella stessa
richiesta sono otto letture: chi la chiama prima ne tiene il risultato.

## 7. La cornice montata una volta sola

**Scrivi**, nel file d'ingresso di Inertia (`resources/js/app.tsx`), il layout del frontend: un componente a livello di
modulo che rende `LayoutDellaCornice` col codice del tuo prodotto in `product` e la tua funzione d'uscita in `onLogout`
(passo 2), dato a `createInertiaApp({ layout: () => Layout, … })`. Ogni pagina dà le sue voci con `useCornice`. L'esempio
intero — il layout, una pagina, il percorso — è in README, «La cornice montata una volta sola»; che cosa mette la cornice
e che cosa dai tu è in README, «La cornice». Le forme:

- i tipi di ciò che dai sono `LayoutDellaCorniceProps` (il layout) e `CorniceDellaPagina` (`useCornice`), dall'ingresso del
  pacchetto. Le voci hanno la forma del design system, in `vendor/zeiras/zr-core/resources/zeiras/index.d.ts`: `nav` è una
  lista di gruppi (`group`, `items`) di `NavItem`, `create` una lista di `MenuItem`, `crumbs` una lista di `ShellCrumb`;
- **una voce di `nav` del modulo non porta `href`**: al clic la cornice chiama `onNavigate` con l'id della voce, e lì fai
  la visita di Inertia; la cornice resta montata. Con `href` la voce è un link vero: il browser ricarica la pagina e la
  cornice si rifà, come per la Dashboard e per i prodotti;
- **il percorso** (`crumbs`) lo dà la pagina al layout, con `Pagina.layout = (props) => ({ crumbs: … })`, e il layout lo
  passa a `LayoutDellaCornice`: non passa da `useCornice`. La funzione dà sempre la chiave `crumbs`, anche senza valore.

**Prova**: scrivi nella ricerca, apri la campanella, poi vai a un'altra pagina del modulo da una tua voce: il testo e il
pannello restano.

**Errore già pagato**: a zr-board montare la cornice è costato uno sprint, e poi la cornice si rifaceva a ogni visita:
`Cornice` in ogni pagina, o un layout creato dentro un render, è nuovo ogni volta. Le props al layout si danno per nome,
mai tutte insieme: Inertia gli passa anche quelle della pagina. Una `Cornice` rimasta in una pagina sotto il layout fa
due cornici.

## 8. Il prodotto nel registro

Non scrivi niente: nome, icona, tono, indirizzo e «Presto» del prodotto sono di zr-core
(`vendor/zeiras/zr-core/resources/registro/prodotti.json`, i nomi in `vendor/zeiras/zr-core/resources/lingue/`), e si
chiedono («Prima di tutto»). Tu dai solo il codice, in `product`: lo stesso del registro e del backoffice.

**Durante lo sviluppo**, finché il registro installato non ha il tuo prodotto, la cornice non si rompe: con un `product`
che il registro non ha tratta la pagina come una di app.zeiras.com — menu Prodotti esteso, nessun prodotto aperto —, le
tue voci di `nav` ci sono lo stesso, e nel menu Prodotti la tua voce manca. Tutti gli altri passi si fanno lo stesso.

**Prova**: con la versione di zr-core che porta il prodotto, nel menu Prodotti la tua voce ha il suo nome nella lingua
della persona e porta a `<indirizzo>/w/<slug>`; dentro il modulo il menu mostra aperto il tuo prodotto, con le tue voci.

**Errore già pagato**: nessuno (per zr-board e zr-crm è andata liscia). Da sapere: «in arrivo» vuol dire due cose.
`in_arrivo` del registro è un sì o un no per chi non ha una sessione (le pagine senza un workspace a cui chiedere). Dentro
la sessione lo stato lo dà il backoffice, workspace per workspace — `attivo`, `disponibile`, `in_arrivo` —, e la cornice
legge quello: una voce è «Presto» se lo dice il registro (`presto`) o se il backoffice non dà il prodotto `attivo` né
`disponibile` — README, «La cornice».

## 9. La ricerca

Per la ricerca che c'è non scrivi niente: è della cornice, che chiede `POST /cornice/ricerca` —
README, «Le rotte della cornice». Il prefisso `cornice/` è di zr-core: non lo usi per le tue rotte. Ma oggi la ricerca
trova solo board e cartelle di Project Management: perché trovi **le tue** risorse servono due cose, tutte e due da
chiedere («Prima di tutto»). A zr-core, il tipo di ogni risorsa nel registro (`risorse`: il tipo come lo dà il
backoffice, l'icona, il percorso dopo `/w/<slug>`, se è un contenitore) e il nome del suo gruppo in ogni lingua: un
risultato di un tipo che il registro non ha non si mostra. A zr-backoffice, che la sua ricerca (`/v1/ricerca`) dia quel
tipo.

**Prova**: Ctrl/Cmd+K, due caratteri: arrivano i risultati, o il testo «nessun risultato» — e fin qui hai provato solo
che la ricerca funziona. Che trovi le tue cose lo prova il titolo di una tua risorsa: compare sotto il nome del suo tipo,
e sceglierla apre la sua pagina nel tuo prodotto. Un tuo test che chiama la rotta usa la POST con `q` nel corpo.

**Errore già pagato**: nessuno dai due moduli. Da sapere: fino alla `v1.7.0` era una GET; un test rimasto alla GET oggi
non trova la rotta.

## 10. Il test di allineamento al design system

**Scrivi** `docs/zr-design-system.md`, il registro del tuo allineamento — la forma (il tag, e una riga per file con lo
sha256 e dove lo usi) la dà la skill `zr-design-system` —, e un test che confronta gli sha256 dei file del design system
che la tua build usa (`vendor/zeiras/zr-core/resources/zeiras/`: `bundle.js`, `bundle.css`, `index.d.ts`, `tokens.json`)
con quelli scritti lì. Un modello (zr-crm lo chiama `RiallineamentoDesignTest`, in `tests/Feature/`):

```php
it('il documento dell\'allineamento ha gli sha256 dei file del design system installati', function () {
    $lock = json_decode((string) file_get_contents(base_path('composer.lock')), true, flags: JSON_THROW_ON_ERROR);
    $installata = collect($lock['packages'])->firstWhere('name', 'zeiras/zr-core')['version'];
    $documento = (string) file_get_contents(base_path('docs/zr-design-system.md'));

    foreach (['bundle.js', 'bundle.css', 'index.d.ts', 'tokens.json'] as $file) {
        $sha = hash_file('sha256', base_path('vendor/zeiras/zr-core/resources/zeiras/'.$file));
        expect(str_contains($documento, $sha))->toBe(true, "{$file} è cambiato con zr-core {$installata}: rileggilo");
    }
});
```

**Prova**: verde dopo `composer install`; a mano, dalla cartella `vendor/zeiras/zr-core/resources/zeiras/`,
`sha256sum bundle.js bundle.css index.d.ts tokens.json` dà gli stessi valori del documento (i quattro file, non `*`: lì
c'è anche la cartella dei loghi).

**Quando diventa rosso**: un aggiornamento di zr-core ha cambiato davvero uno di quei file. Leggi che cosa è cambiato nel
design system (dove e come lo dice la skill `zr-design-system`: nel suo repo, all'ultimo tag, mai da una copia), riallinea
le tue pagine, poi scrivi lo sha256 nuovo nel documento, nello stesso commit. Lo sha256 non si aggiorna da solo per far
tornare verde il test.

**Errore già pagato**: la versione di zr-core scritta a mano nel documento o nel test ha fatto rosso due volte a zr-crm:
si legge da `composer.lock`. A zr-board sono costati i test «di forma» sul sorgente (una riga di codice attesa com'è):
si rompono a ogni ritocco e non dicono se la pagina è allineata.

## 11. L'accessibilità delle tue pagine

La cornice è l'`AppShell` del design system, usato com'è: zr-core gli dà i dati, i testi nella lingua della persona e gli
indirizzi, e non cambia i suoi componenti. Che cosa fa un componente lo dice il design system; zr-core non lo certifica, e
le pagine del modulo le misuri tu. È il lavoro più caro per zr-board, e ritorna a ogni sprint.

**Scrivi**, nei tuoi componenti:

- un dialogo che deve ridare il fuoco a chi l'ha aperto **si chiude**, non si smonta da aperto;
- un pulsante che ha il fuoco non riceve `disabled`: `aria-disabled` e una guardia nel gestore del clic;
- l'area tattile di 44 px è il riquadro vero del pulsante, se accanto c'è un altro bersaglio: un'area allargata lo copre;
- il fuoco torna al pulsante che ha aperto un pannello o una scelta, anche quando quell'elemento nel frattempo è cambiato;
- gli errori di un modulo si annunciano; una colonna di sole azioni («⋯») ha un nome.

**Prova**, in un browser vero (in un DOM finto le misure sono tutte zero):

- axe-core su ogni pagina, coi suoi controlli predefiniti, nel tema chiaro e nel tema scuro, a 390 px e a 1280 px di
  larghezza (il design system si progetta prima a 390 px);
- la tastiera: apri e chiudi ogni pannello e dialogo, e dopo ogni chiusura `document.activeElement` non è mai il `body`;
- i bersagli si misurano con `getBoundingClientRect`: 44 px, senza sovrapporsi.

**Errore già pagato**: il fuoco che cade sul `body` (un dialogo smontato da aperto, un pulsante col fuoco diventato
`disabled`, l'elemento di ritorno sparito) e l'area a 44 px che copre il vicino (zr-board). Un difetto dato alla cornice
che era di un componente (zr-crm: «Cerca» non tradotto era della `FilterBar`): prima di segnalarlo guardi chi rende quel
testo. Ciò che axe trova **dentro la cornice** (la barra, la topbar, i suoi pannelli) non si corregge nel modulo: si
segnala all'agente di zr-core. E le mancanze del design system si trovano solo misurando, e si chiedono.

## Quando è finito

Un modulo sta nella cornice quando ogni **Prova** qui sopra passa sul sito vero, non solo in CI — la lingua alla prima
pagina e il fuoco dopo una chiusura li ha trovati la UAT, a CI verde —, e quando ciò che hai chiesto ad altri («Prima di
tutto») è arrivato: il prodotto nel registro, il suo stato nel workspace, lo store dei blocchi.

## Da sapere, alla data di questa guida

- **Mancanze note del design system**, già chieste a chi lo cura: il `Dialog` non tiene il fuoco dentro di sé; «Chiudi»
  del `Toast` e «Cerca» della `FilterBar` sono testi fissi in italiano. Controlla se una versione nuova le ha chiuse.
- **Una voce di `nav` senza `href`** ha come indirizzo «#»: «apri in un'altra scheda» non porta alla sua pagina. Con
  l'indirizzo vero l'`AppShell` chiama `onNavigate` **e** il browser lo segue, ricaricando. Chiesto al design system
  (segnalato da zr-crm), aperto.
- **Contare gli elementi della cornice per classe** si rompe quando la cornice cresce: dalla `v1.9.0` chi conta
  `.zr-ws-item` nel selettore prende anche il pulsante «Nuovo workspace», `.zr-ws-item.zr-ws-new` (zr-home).
- **Gli aggiornamenti**: zr-core annuncia ogni versione all'agente del modulo (tag, che cosa cambia, che cosa fare); con
  `^` una versione maggiore non entra da sola.
