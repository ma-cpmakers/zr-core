/**
 * I rimedi provvisori di tastiera della cornice: ciò che i componenti del design system non fanno ancora da sé, coi soli
 * elementi che scrivono loro. La cornice carica questo modulo quando si monta, fuori dal JS d'ingresso; il modulo si
 * mette in ascolto una volta sola e resta, e senza una cornice in pagina non trova niente e non fa niente. Ogni rimedio
 * si toglie quando il componente porta il suo.
 */

/**
 * Aprendo la campanella il fuoco entra nel pannello delle notifiche, sulla linguetta scelta: c'è sempre — mentre l'elenco
 * si carica, con l'errore, a elenco vuoto — e non fa niente da sola. L'`AppShell` scrive il pannello solo da aperto: il
 * fuoco si sposta quando il pannello entra nel documento, e mai dopo, qualunque cosa cambi dentro. Non passa dai
 * gestori della campanella, che a chi non ha accettato i documenti legali non arrivano. Il pannello è quello che l'`AppShell`
 * scrive accanto alla campanella: un elemento della pagina con la stessa classe non è suo.
 */
function fuocoNelPannelloDelleNotifiche(aggiunto: Node): void {
    if (aggiunto instanceof HTMLElement && aggiunto.matches('.zr-shell .zr-top-actions > .zr-notif')) {
        aggiunto.querySelector<HTMLElement>('.zr-notif-tabs [role="tab"][aria-selected="true"]')?.focus();
        // Testa e piede del pannello sono un `<header>` e un `<footer>` dentro la pagina: axe li legge come un secondo banner e un
        // contentinfo (`landmark-*`). Col ruolo neutro restano com'erano, fuori dai punti di riferimento (voce #2627).
        aggiunto.querySelectorAll('header,footer').forEach((parte) => parte.setAttribute('role', 'none'));
    }
}

/**
 * Chiusa la campanella col clic mentre il fuoco era nel pannello, il pannello esce dal documento con dentro l'elemento
 * attivo e il fuoco resta alla pagina: dove il clic non dà il fuoco a un pulsante (Safari, Firefox su macOS) non lo ha
 * nemmeno la campanella. Quando il pannello esce e il fuoco non è di nessuno torna alla campanella; a un elemento che lo
 * ha preso — un campo cliccato fuori dal pannello — non si toglie.
 */
function fuocoAllaCampanella(cambio: MutationRecord): void {
    const barra = cambio.target;

    if (document.activeElement === document.body && barra instanceof Element && barra.matches('.zr-shell .zr-top-actions') && [...cambio.removedNodes].some((tolto) => tolto instanceof Element && tolto.matches('.zr-notif'))) {
        barra.querySelector<HTMLElement>(':scope > .zr-bell')?.focus();
    }
}

/** Ciò che può prendere il fuoco col Tab; quali lo prendono davvero lo dice `eUnaFermata`. */
const PRENDONO_IL_FUOCO = 'a[href], button, input, select, textarea, summary, iframe, video[controls], audio[controls], [contenteditable], [tabindex]';

/**
 * Non mostrato: lui o un elemento che lo contiene ha `hidden` o `display: none`, o è invisibile; o sta in un `<details>`
 * chiuso, di cui si vede solo il `summary` che lo apre (il primo), con ciò che ha dentro.
 */
function nascosto(elemento: HTMLElement): boolean {
    for (let su: HTMLElement | null = elemento, sotto: HTMLElement | null = null; su !== null; sotto = su, su = su.parentElement) {
        if (su.hidden || getComputedStyle(su).display === 'none' || (sotto !== null && su.matches('details:not([open])') && !sotto.matches('summary:first-of-type'))) {
            return true;
        }
    }

    return getComputedStyle(elemento).visibility === 'hidden';
}

/**
 * Una fermata del Tab: non spento, non nascosto, non fuori dal giro (`tabindex="-1"`), non dentro un elemento `inert`. Di un
 * gruppo di scelte il Tab si ferma su una sola: quella scelta, se c'è. Un `iframe`, un `video` e un `audio` coi comandi lo
 * sono dove il browser li mette nel giro (`tabIndex` da 0 in su). Un `iframe` largo o alto zero — un riquadro di servizio,
 * che non si vede — non lo è: contato come ultima fermata lascerebbe al browser il Tab dal pulsante che lo precede, e da
 * dentro un `iframe` il tasto non arriva alla pagina.
 */
function eUnaFermata(elemento: HTMLElement): boolean {
    if (elemento.tabIndex < 0 || elemento.matches(':disabled, input[type="hidden"]') || elemento.closest('[inert]') !== null || nascosto(elemento) || (elemento.matches('iframe') && !(elemento.clientWidth && elemento.clientHeight))) {
        return false;
    }
    if (elemento instanceof HTMLInputElement && elemento.type === 'radio' && !elemento.checked && elemento.name !== '') {
        return ![...(elemento.form ?? document).querySelectorAll<HTMLInputElement>('input[type="radio"]:checked')].some((scelto) => scelto.name === elemento.name && scelto.form === elemento.form);
    }

    return true;
}

/**
 * Il dialogo senza fermate a cui il rimedio ha dato il fuoco, e chi lo aveva prima. Quando quel dialogo esce dal documento il
 * fuoco resta alla pagina: torna a chi lo aveva, se è ancora in pagina; a un elemento che lo ha preso nel frattempo non si
 * toglie. Se intanto un altro dialogo trattiene il fuoco, torna a chi lo aveva solo se sta dentro quel dialogo: un pulsante
 * dietro il velo non lo riprende, perché Invio lo premerebbe di nuovo.
 */
let preso: [dialogo: HTMLElement, loAveva: Element | null] | null = null;

function fuocoAChiLoAveva(): void {
    if (preso !== null && !preso[0].isConnected) {
        const loAveva = preso[1];

        preso = null;
        if (document.activeElement === document.body && loAveva instanceof HTMLElement && (chiTrattieneIlFuoco() ?? document).contains(loAveva)) {
            loAveva.focus();
        }
    }
}

/** Un `Dialog` aperto che non è un'anteprima, dentro il suo velo. */
const DIALOGO_APERTO = '.zr-scrim:not(.is-inline) > .zr-dialog';

/**
 * Chi trattiene il fuoco adesso: l'ultimo `Dialog` aperto, che sta sopra a tutto; senza, l'ultimo `DetailPanel`, ma solo
 * sotto la larghezza a cui il CSS del design system lo fa largo tutta la pagina (da lì in su Tab esce verso la pagina, come
 * vuole la linea guida). Le anteprime (`is-inline`) non trattengono niente, e senza una cornice in pagina nessuno. Dove la
 * larghezza non si può chiedere (`matchMedia` manca) il pannello non trattiene.
 */
function chiTrattieneIlFuoco(): HTMLElement | null {
    if (!conLaCornice()) {
        return null;
    }
    const aperti = (selettore: string): HTMLElement | null => [...document.querySelectorAll<HTMLElement>(selettore)].pop() ?? null;

    return aperti(DIALOGO_APERTO)
        ?? (typeof matchMedia === 'function' && matchMedia('(max-width: 720px)').matches ? aperti('.zr-detail:not(.is-inline)') : null);
}

/**
 * Con un `Dialog` aperto, o un `DetailPanel` a tutta pagina, Tab resta dentro: dall'ultima fermata torna alla prima, dalla
 * prima all'ultima con Maiusc, e da fuori entra. Nel mezzo il Tab resta del browser, e degli altri tasti non si tocca niente.
 * Con un `Menu` aperto dentro il dialogo, che ha le sue frecce e il suo Esc, il gestore non interviene; lo stesso col fuoco in
 * un menu che sta accanto al dialogo e non dentro. Un menu che sta altrove nella pagina, senza il fuoco, non spegne niente.
 * Se qualcuno ha già tenuto il Tab per sé — un campo che ci accetta un suggerimento — il fuoco non si sposta, e Tab con Ctrl,
 * Alt o Meta non è il giro del fuoco: resta del browser.
 */
function tabRestaDentro(tasto: KeyboardEvent): void {
    const dentro = tasto.key === 'Tab' && !tasto.defaultPrevented && !tasto.ctrlKey && !tasto.altKey && !tasto.metaKey ? chiTrattieneIlFuoco() : null;

    if (dentro === null || dentro.querySelector('.zr-menu') !== null || document.activeElement?.closest('.zr-menu')) {
        return;
    }
    const fermate = [...dentro.querySelectorAll<HTMLElement>(PRENDONO_IL_FUOCO)].filter(eUnaFermata);
    const [prima, ultima] = [fermate[0], fermate[fermate.length - 1]];
    const attivo = document.activeElement;

    if (prima === undefined || ultima === undefined) {
        // Niente su cui fermarsi: il fuoco non esce lo stesso, e va a chi trattiene. Il `Dialog` non ha un `tabindex`, e senza
        // non lo può prendere: resterebbe sul pulsante dietro il velo, che Invio premerebbe.
        tasto.preventDefault();
        if (attivo !== dentro) {
            preso = [dentro, attivo];
        }
        dentro.tabIndex = -1;
        dentro.focus();
    } else if (attivo === null || !dentro.contains(attivo)) {
        tasto.preventDefault();
        (tasto.shiftKey ? ultima : prima).focus();
    } else if (tasto.shiftKey ? !(attivo.compareDocumentPosition(prima) & Node.DOCUMENT_POSITION_PRECEDING) : !(attivo.compareDocumentPosition(ultima) & Node.DOCUMENT_POSITION_FOLLOWING)) {
        // Dopo l'attivo, o prima con Maiusc, non c'è un'altra fermata: il browser uscirebbe dal dialogo.
        tasto.preventDefault();
        (tasto.shiftKey ? ultima : prima).focus();
    }
}

/**
 * Sotto 720 px un `DetailPanel` è largo tutta la pagina, e il CSS del design system lo mette un gradino sopra i dialoghi
 * (`--z-dialog` + 1): un `Dialog` aperto da dentro il pannello — una conferma — resta sotto, e non si vede. Quando un dialogo
 * entra nel documento il suo velo sale di un gradino sopra il pannello, col token del design system; un velo senza un dialogo
 * dentro non è di un `Dialog` e resta com'è. Vale a ogni larghezza: sopra i 720 px pannello e velo stanno allo stesso
 * livello, e il dialogo sta sopra perché viene dopo nel documento. È provvisorio come il resto, e sta qui, in uno stile
 * scritto sull'elemento, perché il pacchetto non porta un CSS suo e la cascata del design system non si tocca: se questo
 * modulo non arriva, sotto 720 px il dialogo resta sotto il pannello. Chi la chiama ha già visto che in pagina c'è una cornice.
 */
function dialogoSopraIlPannello(aggiunto: Node): void {
    if (aggiunto instanceof HTMLElement) {
        (aggiunto.matches(DIALOGO_APERTO) ? [aggiunto] : aggiunto.querySelectorAll<HTMLElement>(DIALOGO_APERTO)).forEach((dialogo) => dialogo.parentElement?.style.setProperty('z-index', 'calc(var(--z-dialog) + 2)'));
    }
}

/**
 * Nel menu del profilo aperto l'avatar dell'intestazione è un `role="img"` dentro un `role="menu"`, dove un'immagine non è
 * ammessa: axe lo dà critico (`aria-required-children`). Il nome e l'email stanno scritti accanto, quindi l'avatar si nasconde
 * e basta; il menu è quello che l'`AppShell` scrive nella barra in alto, non un elemento della pagina con la stessa classe.
 */
function avatarFuoriDalMenu(aggiunto: Node): void {
    if (aggiunto instanceof HTMLElement && aggiunto.matches('.zr-shell .zr-top-actions > .zr-profile-menu')) {
        aggiunto.querySelector('.zr-avatar')?.setAttribute('aria-hidden', 'true');
    }
}

/**
 * La barra dei moduli dietro il selettore dei workspace o il menu Moduli è nascosta ai lettori di schermo ma i suoi link si
 * raggiungono col Tab (axe: `aria-hidden-focus`): finché è nascosta è anche `inert`, e torna com'era quando il design system
 * toglie `aria-hidden`. Lo stesso vale per il piede della barra laterale, con «Impostazioni»: il design system lo lascia
 * attivo, e dal selettore aperto il Tab ci finisce sopra. La barra è quella che l'`AppShell` scrive nella sidebar, non un
 * elemento della pagina con la stessa classe; il filtro sugli attributi accende da sé l'ascolto degli attributi.
 */
function barraInert(cambio: MutationRecord): void {
    const barra = cambio.target;

    if (barra instanceof Element && barra.matches('.zr-shell > .zr-side > .zr-nav')) {
        const spenta = barra.getAttribute('aria-hidden') === 'true';

        barra.toggleAttribute('inert', spenta);
        barra.parentElement?.querySelector(':scope > .zr-side-foot')?.toggleAttribute('inert', spenta);
    }
}

/**
 * Sotto 720 px la ricerca aperta — col fuoco nel campo, o coi risultati — copre la barra in alto, e la campanella e il profilo
 * restano bersagli coperti a metà (axe `target-size`): finché la ricerca la copre, le azioni della barra non si vedono e non
 * prendono il fuoco, e tornano appena si chiude. Dove `matchMedia` non c'è non si nasconde niente (voce #2627).
 */
function azioniSottoLaRicerca(): void {
    const ricerca = document.querySelector('.zr-shell .zr-top > .zr-search');
    const azioni = ricerca?.parentElement?.querySelector<HTMLElement>(':scope > .zr-top-actions');

    if (azioni) {
        azioni.style.visibility = typeof matchMedia === 'function' && matchMedia('(max-width: 720px)').matches && (ricerca?.contains(document.activeElement) || ricerca?.matches('.is-open')) ? 'hidden' : '';
    }
}

/** La `naviga` della cornice montata: gliela dà la cornice quando chiede questo pezzo. */
let naviga: ((indirizzo: string) => void) | undefined;
/** I nomi del contenuto e del pannello della ricerca, nella lingua della cornice. */
let nomi: [contenuto: string, risultati: string] = ['', ''];

/**
 * I collegamenti della barra laterale (Dashboard, moduli, «Impostazioni») e del percorso sono link veri: un clic semplice
 * ricarica la pagina intera, anche dentro lo stesso modulo, e `onCrumb` arriva senza l'evento (#2722). Con un indirizzo di questa origine passa da `naviga`, quella che la cornice ha quando
 * si monta; il tasto centrale, Ctrl, Cmd, Maiusc, Alt, un indirizzo di un'altra origine o un clic già gestito restano del
 * browser. Provvisorio, finché l'`AppShell` non ha la sua funzione per questi clic e non dà l'evento a `onCrumb`.
 */
function clicSullaBarra(clic: MouseEvent): void {
    const collegamento = (clic.target as Element).closest?.<HTMLAnchorElement>('.zr-shell > .zr-side a[href], .zr-shell > main > .zr-crumbbar a[href]');

    if (naviga && collegamento && !(clic.defaultPrevented || clic.button || clic.ctrlKey || clic.metaKey || clic.shiftKey || clic.altKey) && collegamento.origin === location.origin) {
        clic.preventDefault();
        naviga(collegamento.href);
    }
}

/** Le fermate che il rimedio ha dato, al contenuto (0) e al pannello della ricerca (1): si spostano quando cambia ciò che scorre, e si tolgono quando non servono più. */
const fermate: (Element | null)[] = [null, null];

/**
 * Ciò che scorre nel giro del Tab: chi usa la tastiera non fa scorrere ciò che non prende il fuoco, quando dentro non c'è
 * niente che lo prenda (axe, `scrollable-region-focusable`). La fermata c'è solo finché dentro non c'è niente che prende il
 * fuoco: con un pulsante o un collegamento il Tab ci arriva già, e un clic dentro non riporta il Tab all'inizio della pagina.
 * Un `tabindex` che ha già resta com'è; il contorno del fuoco lo dà `contorno`.
 */
function fermata(quale: number, scorre: Element | null | undefined): void {
    if (scorre?.querySelector(PRENDONO_IL_FUOCO) || (scorre !== fermate[quale] && scorre?.hasAttribute('tabindex'))) {
        scorre = null;
    }
    if (fermate[quale] !== scorre) {
        fermate[quale]?.removeAttribute('tabindex');
        // Anche il contorno: se la fermata se ne va col fuoco, il `focusout` dopo non è più suo.
        fermate[quale]?.removeAttribute('style');
        scorre?.setAttribute('tabindex', '0');
        fermate[quale] = scorre ?? null;
    }
}

/**
 * Il contenuto della pagina e il pannello della ricerca nel giro del Tab (`fermata`). Del contenuto scorre il `main`
 * dell'`AppShell`, o col percorso il suo `.zr-main-body`; `is-flush` non scorre; un `main` fuori dall'`AppShell` non si tocca, e
 * il nome lo prende il `main` (#2394). Il pannello della ricerca scorre quando i risultati non ci stanno, e il fuoco resta nel
 * campo, che ha `aria-activedescendant`: il pannello è un gruppo, col nome dei risultati; uno della pagina con la stessa classe
 * non è suo (#2720). I nomi sono nella lingua che la cornice dà a `via`. Provvisorio, finché l'`AppShell` non lo fa da sé.
 */
function contenuto(): void {
    const main = document.querySelector('.zr-shell > main.zr-main:not(.is-flush)');
    const pannello = document.querySelector('.zr-shell .zr-top > .zr-search > .zr-search-panel');

    fermata(0, main?.querySelector(':scope > .zr-main-body') ?? main);
    fermata(1, pannello);
    // Prima di `via`, che arriva subito dopo il pezzo, i nomi sono vuoti per un giro.
    main?.setAttribute('aria-label', nomi[0]);
    pannello?.setAttribute('role', 'group');
    pannello?.setAttribute('aria-label', nomi[1]);
}

/**
 * Il contorno del fuoco di una fermata del rimedio, quando il fuoco arriva da tastiera: quello del design system, coi soli token, sull'elemento
 * (nessuno stile iniettato: il `bundle.css` non ha una regola per lui), sulle sole fermate del rimedio. Il fuoco che esce lo toglie.
 */
function contorno(evento: FocusEvent): void {
    const scorre = evento.target as HTMLElement;

    if (fermate.includes(scorre)) {
        scorre.style.cssText = evento.type === 'focusin' && scorre.matches(':focus-visible') ? 'outline:2px solid var(--focus);outline-offset:-2px' : '';
    }
}

/** La cornice dà la sua `naviga` e i nomi (di nuovo a ogni cambio di lingua): da qui in poi i clic sulla barra laterale passano da lì. */
export function via(daUsare: (indirizzo: string) => void, ...nomiDellaCornice: typeof nomi): void {
    naviga = daUsare;
    nomi = nomiDellaCornice;
    contenuto();
}


document.addEventListener('keydown', tabRestaDentro);
document.addEventListener('click', clicSullaBarra);
document.addEventListener('focusin', contorno);
document.addEventListener('focusout', contorno);
// La ricerca si apre e si chiude coi suoi risultati, e lo vede l'osservatore; il campo che perde il fuoco dopo la chiusura no.
// All'uscita il fuoco non è ancora arrivato dove va: si guarda al giro dopo.
document.addEventListener('focusout', () => setTimeout(azioniSottoLaRicerca));

/** C'è una cornice in pagina: si chiede una volta per gruppo di cambi, non per ogni nodo. */
const conLaCornice = (): boolean => document.querySelector('.zr-shell') !== null;

new MutationObserver((cambi) => {
    if (!conLaCornice()) {
        return;
    }
    for (const cambio of cambi) {
        fuocoAllaCampanella(cambio);
        barraInert(cambio);
        cambio.addedNodes.forEach((aggiunto) => {
            fuocoNelPannelloDelleNotifiche(aggiunto);
            dialogoSopraIlPannello(aggiunto);
            avatarFuoriDalMenu(aggiunto);
        });
    }
    azioniSottoLaRicerca();
    fuocoAChiLoAveva();
    contenuto();
}).observe(document, { childList: true, subtree: true, attributeFilter: ['aria-hidden'] });

// Un dialogo già aperto quando il modulo arriva.
if (conLaCornice()) {
    dialogoSopraIlPannello(document.body);
}
