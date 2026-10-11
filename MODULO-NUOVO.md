# Come nasce un modulo nuovo

Per l'agente di un frontend Zeiras che nasce (Laravel, Inertia, React): che cosa fare, in che ordine, per stare nella
cornice. Ogni passo dice **che cosa scrivi e dove**, **come provi che funziona** e **l'errore già pagato** da chi è venuto
prima (zr-board e zr-crm, sentiti l'11/10/2026). Il contratto resta il README di zr-core: qui c'è l'ordine, lì il dettaglio.

Come si legge:

- un percorso dentro la cartella del pacchetto (`vendor/zeiras/zr-core/README.md`) è un file di zr-core: lo leggi, non lo
  cambi;
- ogni altro percorso (`bootstrap/app.php`, `config/zr-core.php`) è un file del **tuo** frontend;
- «README» seguito da un titolo fra virgolette è una sezione del README di zr-core; ciò che è di zr-auth è detto di
  zr-auth, e si legge nel suo README.

| # | Passo | Di chi è il codice |
|---|---|---|
| 1 | Installare zr-auth e zr-core | tuo: `composer.json`, il CSS e il JS d'ingresso |
| 2 | L'ingresso e la sessione | zr-auth |
| 3 | Le intestazioni di sicurezza | zr-core; tu la registri |
| 4 | La CSP del modulo | tuo: `config/zr-core.php`, solo se aggiungi un'origine |
| 5 | La lingua | zr-core; tu chiami una riga |
| 6 | I dati della cornice | zr-core; tu li condividi con le pagine |
| 7 | La cornice montata una volta sola | tuo: il layout |
| 8 | Il prodotto nel registro | zr-core: si chiede |
| 9 | La ricerca | zr-core |
| 10 | Il test di allineamento al design system | tuo |
| 11 | L'accessibilità delle tue pagine | tuo |

## 1. Installare zr-auth e zr-core

**Scrivi**, nel `composer.json`: i due repository `vcs` (zr-auth e zr-core) e `zeiras/zr-core` con `^`. Poi i due `@import`
del CSS nell'ordine dato e l'import dei componenti dall'ingresso del pacchetto — README, «Come si installa in un frontend».
Il design system nella build è quello di zr-core: non ne tieni una copia tua.

**Prova**: `grep -c '"url": "git@' composer.lock` risponde 0 (la CI e il server installano senza chiavi); `tsc --noEmit` e
la build passano; in pagina `window.Zeiras` c'è una volta sola.

**Errore già pagato**: Composer non eredita i repository di un pacchetto, e senza quello di zr-auth nel tuo `composer.json`
zr-core non si installa. Una seconda copia del design system accanto a quella del pacchetto si sovrascrive con la prima.

## 2. L'ingresso e la sessione

È di **zr-auth**: la sessione lato server col gettone, il ricevitore dell'ingresso da zr-home, la guardia e il suo test.
**Scrivi** ciò che dice il README di zr-auth, nell'ordine «Installazione», «La sessione col gettone», «L'ingresso da
zr-home: la partenza e il ricevitore», «La guardia, e il suo test». zr-crm ha ricopiato da zr-board ed è andata liscia.

**Prova**: entri da app.zeiras.com in un workspace e arrivi alla tua pagina con la sessione aperta; il test della guardia
di zr-auth (`Rotte::senzaGuardia()`) non elenca nessuna tua rotta che deve averla.

**Errore già pagato**: le rotte che aprono, cambiano o chiudono la sessione («Esci» compresa) vogliono `bloccaSessione` di
zr-auth, e il blocco vuole uno store della cache che lo tenga: è infrastruttura, si chiede prima a chi la fa. Quali rotte,
e perché: README, «La cornice», al punto «Le notifiche».

## 3. Le intestazioni di sicurezza

**Scrivi** una riga in `bootstrap/app.php`: registri `Zeiras\Core\Http\IntestazioniSicurezza` prima dei middleware
globali — README, «Le intestazioni di sicurezza». Se il frontend ha già una classe sua con lo stesso compito, la cancelli.
Poi scrivi il tuo test, coi cinque valori per intero — README, «Il test nel modulo» (zr-crm lo chiama `IntestazioniTest`).

**Prova**: il tuo test è verde; una tua pagina risponde con una sola `Content-Security-Policy`.

**Errore già pagato**: con la classe del modulo rimasta, la risposta porta due CSP e il browser le applica tutte e due
(zr-crm). Un test che guarda solo la prima CSP, o che rilegge una costante del pacchetto, resta verde lo stesso. E la
classe non copre tutto: i file statici e gli errori del server web hanno le intestazioni che dà il server web, e quei
valori vanno tenuti uguali a questi da chi fa l'infrastruttura (zr-board: due copie da allineare) —
README, «Che cosa resta al server web». Sapere chi le mette e dove, prima di scriverle, evita di scriverle due volte.

## 4. La CSP del modulo

La CSP di tutti la dà la classe del passo 3: non ne scrivi una. **Scrivi** solo se il modulo aggiunge un'origine (un font
suo, un widget): `php artisan vendor:publish --tag=zr-core-config` porta `config/zr-core.php` nel frontend, e le origini
stanno lì e solo lì — README, «Le sorgenti di un modulo»; per una pagina sola, README, «Per una pagina sola».

**Prova**: la console del browser non segna violazioni della CSP in nessuna tua pagina; il test del passo 3 ha la CSP
nuova scritta per intero.

**Errore già pagato**: la barra d'avanzamento di Inertia aggiunge un `<style>` che la CSP ferma —
README, «La barra d'avanzamento di Inertia». Una sorgente scritta male è scartata, non corretta: lo dice il log, non la
pagina. Che cosa la CSP ammette già (i font del design system) è in README, «La CSP».

## 5. La lingua

**Scrivi** una riga nel middleware che mette la lingua delle pagine, al posto della lingua letta dalla sessione: la lingua
la dà `Cornice::lingua()`, e tutto ciò che è tradotto (i testi condivisi, le etichette della navigazione, `<html lang>`)
viene dopo. È la strada unica — README, «La parte server», da «Per avere la pagina nella lingua nuova».

**Prova**: cambi lingua nel profilo su app.zeiras.com, apri una pagina del modulo: è nella lingua nuova **alla prima
pagina**, `<html lang>` compreso. In un test: il backoffice finto di zr-auth (`BackofficeFinto`) dà un'altra lingua in
`io.mostra`, e la risposta è in quella.

**Errore già pagato**: il più caro per zr-crm (tre correzioni) e pagato anche da zr-board: la lingua e le traduzioni lette
prima dei dati della cornice lasciavano la prima pagina nella lingua vecchia. La CI era verde: l'ha trovato la UAT. La riga
va solo sulle richieste che mostrano una pagina: su ogni richiesta costa una lettura del backoffice in più.

## 6. I dati della cornice

**Scrivi**, nel `share()` del middleware di Inertia (`HandleInertiaRequests`), la chiave `cornice` con `Cornice::dati()`, e
nel gestore delle eccezioni di `bootstrap/app.php` che cosa mostrare quando il backoffice non risponde
(`BackofficeNonRisponde`, `ErroreApi`) — README, «La parte server».

**Prova**: una tua pagina riceve `cornice` col nome della persona e il workspace; senza workspace riceve `null` e si vede
senza cornice. Nei test guardi **quali** letture partono e con quale gettone, non in che ordine.

**Errore già pagato**: un test che fissa «la prima lettura» si rompe a un aggiornamento (l'ordine non è un contratto). Un
backoffice finto scritto a mano deve dare l'`id` di ogni workspace, o i dati falliscono. Due chiamate nella stessa
richiesta sono otto letture: chi la chiama prima ne tiene il risultato.

## 7. La cornice montata una volta sola

**Scrivi** il layout del frontend, un componente a livello di modulo che rende `LayoutDellaCornice` col codice del tuo
prodotto in `product` e `onLogout`, e dallo a `createInertiaApp`; ogni pagina dà le sue voci con `useCornice` — README,
«La cornice montata una volta sola». Che cosa mette la cornice e che cosa dai tu: README, «La cornice».

**Prova**: scrivi nella ricerca, apri la campanella, poi vai a un'altra pagina del modulo: il testo e il pannello restano.

**Errore già pagato**: a zr-board montare la cornice è costato uno sprint, e poi la cornice si rifaceva a ogni visita:
`Cornice` in ogni pagina, o un layout creato dentro un render, è nuovo ogni volta. Le props al layout si danno per nome,
mai tutte insieme: Inertia gli passa anche quelle della pagina. Una `Cornice` rimasta in una pagina sotto il layout fa
due cornici.

## 8. Il prodotto nel registro

Non scrivi niente: nome, icona, tono, indirizzo e stato del prodotto sono di zr-core
(`vendor/zeiras/zr-core/resources/registro/prodotti.json`, i nomi in `vendor/zeiras/zr-core/resources/lingue/`). Un
prodotto nuovo si **chiede** all'agente di zr-core, ed entra con una sua versione. Tu dai solo il codice, in `product`.

**Prova**: nel menu Prodotti il tuo prodotto ha il suo nome nella lingua della persona, e porta a `<indirizzo>/w/<slug>`.

**Errore già pagato**: nessuno (per zr-board e zr-crm è andata liscia). Da sapere: `presto` e `in_arrivo` non dicono la
stessa cosa, e dentro la sessione lo stato lo dà il backoffice, workspace per workspace — README, «La cornice».

## 9. La ricerca

Non scrivi niente: la ricerca è della cornice, che chiede `POST /cornice/ricerca` — README, «Le rotte della cornice».
Il prefisso `cornice/` è di zr-core: non lo usi per le tue rotte.

**Prova**: Ctrl/Cmd+K, due caratteri: arrivano i risultati, o il testo «nessun risultato». Un tuo test che la chiama usa
la POST con `q` nel corpo.

**Errore già pagato**: nessuno dai due moduli. Da sapere: fino alla `v1.7.0` era una GET; un test rimasto alla GET oggi
non trova la rotta.

## 10. Il test di allineamento al design system

**Scrivi** un test che confronta gli sha256 dei file del design system che la tua build usa
(`vendor/zeiras/zr-core/resources/zeiras/`: `bundle.js`, `bundle.css`, `index.d.ts`, `tokens.json`) con quelli scritti nel
tuo `docs/zr-design-system.md`. Un modello (zr-crm lo chiama `RiallineamentoDesignTest`):

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

**Prova**: verde dopo `composer install`; a mano, `sha256sum vendor/zeiras/zr-core/resources/zeiras/*` dà gli stessi
valori del documento. Rosso solo quando un aggiornamento di zr-core cambia davvero uno di quei file.

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

**Prova**: axe su ogni pagina; poi la tastiera: apri e chiudi ogni pannello e dialogo, e dopo ogni chiusura
`document.activeElement` non è mai il `body`; i bersagli si misurano con `getBoundingClientRect` (44 px, senza
sovrapporsi).

**Errore già pagato**: il fuoco che cade sul `body` (un dialogo smontato da aperto, un pulsante col fuoco diventato
`disabled`, l'elemento di ritorno sparito) e l'area a 44 px che copre il vicino (zr-board). Un difetto dato alla cornice
che era di un componente (zr-crm: «Cerca» non tradotto era della `FilterBar`): prima di segnalarlo guardi chi rende quel
testo. Le mancanze del design system si trovano solo misurando, e non si correggono nel modulo: si chiedono.

## Da sapere, alla data di questa guida

- **Mancanze note del design system**, già chieste a chi lo cura: il `Dialog` non tiene il fuoco dentro di sé; «Chiudi»
  del `Toast` e «Cerca» della `FilterBar` sono testi fissi in italiano. Controlla se una versione nuova le ha chiuse.
- **Le voci di `nav` con un indirizzo finto** («#»): l'`AppShell` chiama `onNavigate` e segue anche l'indirizzo, quindi
  «apri in un'altra scheda» non porta alla pagina (segnalato da zr-crm, aperto).
- **Contare gli elementi della cornice per classe** si rompe quando la cornice cresce: dalla `v1.9.0` chi conta
  `.zr-ws-item` nel selettore prende anche il pulsante «Nuovo workspace», `.zr-ws-item.zr-ws-new` (zr-home).
- **Gli aggiornamenti**: zr-core annuncia ogni versione all'agente del modulo (tag, che cosa cambia, che cosa fare); con
  `^` una versione maggiore non entra da sola.
