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
    }
}

/** Ciò che può prendere il fuoco col Tab; quali lo prendono davvero lo dice `eUnaFermata`. */
const PRENDONO_IL_FUOCO = 'a[href], button, input, select, textarea, summary, [contenteditable], [tabindex]';

/** Non mostrato: lui o un elemento che lo contiene ha `hidden` o `display: none`, o è invisibile. */
function nascosto(elemento: HTMLElement): boolean {
    for (let su: HTMLElement | null = elemento; su !== null; su = su.parentElement) {
        if (su.hidden || getComputedStyle(su).display === 'none') {
            return true;
        }
    }

    return getComputedStyle(elemento).visibility === 'hidden';
}

/**
 * Una fermata del Tab: non spento, non nascosto, non fuori dal giro (`tabindex="-1"`). Di un gruppo di scelte il Tab si ferma
 * su una sola: quella scelta, se c'è.
 */
function eUnaFermata(elemento: HTMLElement): boolean {
    if (elemento.tabIndex < 0 || elemento.matches(':disabled, input[type="hidden"]') || nascosto(elemento)) {
        return false;
    }
    if (elemento instanceof HTMLInputElement && elemento.type === 'radio' && !elemento.checked && elemento.name !== '') {
        return ![...(elemento.form ?? document).querySelectorAll<HTMLInputElement>('input[type="radio"]:checked')].some((scelto) => scelto.name === elemento.name && scelto.form === elemento.form);
    }

    return true;
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
    if (document.querySelector('.zr-shell') === null) {
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
        // Niente su cui fermarsi: il fuoco non esce lo stesso, e va a chi trattiene se può prenderlo.
        tasto.preventDefault();
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
 * modulo non arriva, sotto 720 px il dialogo resta sotto il pannello. Senza una cornice in pagina non fa niente.
 */
function dialogoSopraIlPannello(aggiunto: Node): void {
    if (aggiunto instanceof HTMLElement && document.querySelector('.zr-shell') !== null) {
        (aggiunto.matches(DIALOGO_APERTO) ? [aggiunto] : aggiunto.querySelectorAll<HTMLElement>(DIALOGO_APERTO)).forEach((dialogo) => dialogo.parentElement?.style.setProperty('z-index', 'calc(var(--z-dialog) + 2)'));
    }
}

document.addEventListener('keydown', tabRestaDentro);

new MutationObserver((cambi) => {
    for (const cambio of cambi) {
        cambio.addedNodes.forEach(fuocoNelPannelloDelleNotifiche);
        cambio.addedNodes.forEach(dialogoSopraIlPannello);
    }
}).observe(document, { childList: true, subtree: true });

// Un dialogo già aperto quando il modulo arriva.
dialogoSopraIlPannello(document.body);

export {};
