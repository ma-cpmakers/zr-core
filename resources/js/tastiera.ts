/**
 * I rimedi provvisori della cornice che servono solo a chi usa la tastiera: il Tab che resta dentro un dialogo, Esc dal
 * pannello della ricerca. Stanno in un pezzo loro, fuori dal JS d'ingresso e fuori da quello dei rimedi: lo chiede il pezzo
 * dei rimedi al primo tasto premuto, e chi usa solo il mouse non lo scarica (zr-pm, 26/10/2026). I tasti premuti prima che
 * arrivi non si perdono: il pezzo dei rimedi li tiene, e li passa a `ripeti` quando arriva. Ogni rimedio si toglie quando il
 * componente porta il suo.
 */

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

/**
 * Le voci «Presto» della barra laterale e del menu Moduli non portano da nessuna parte (`aria-disabled`), ma fermavano il Tab, e un
 * lettore di schermo le leggeva «CRMPresto» (riga 6 delle richieste al design system): escono dal giro del Tab e il loro nome è
 * quello della voce e lo stato, separati. Una voce che smette di essere «Presto» torna com'era: l'`AppShell` non dà a queste voci
 * né `tabindex` né un nome suo. Si rifà a ogni cambio della pagina e quando il pezzo arriva. Provvisorio, finché l'`AppShell` non
 * lo fa da sé.
 */
function vociPresto(): void {
    document.querySelectorAll('.zr-shell a.zr-nav-item').forEach((voce) => {
        if (voce.matches('.is-soon')) {
            voce.setAttribute('tabindex', '-1');
            voce.setAttribute('aria-label', [...voce.children].map((parte) => parte.textContent).filter(Boolean).join(', '));
        } else {
            voce.removeAttribute('tabindex');
            voce.removeAttribute('aria-label');
        }
    });
}

/** Ciò che questo pezzo rifà a ogni gruppo di cambi della pagina: l'osservatore è quello del pezzo dei rimedi. */
export function aOgniCambio(): void {
    fuocoAChiLoAveva();
    vociPresto();
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
 * L'`AppShell` chiude la ricerca con Esc solo dal campo: col fuoco nel pannello dei risultati (una fermata del Tab, #2720) Esc
 * non faceva niente, e sotto 720 px la barra in alto restava senza campanella. Da lì il rimedio rimanda lo stesso tasto Esc
 * al campo, e l'`AppShell` chiude la ricerca come quando Esc parte dal campo: il pannello se ne va e il fuoco non resta nel
 * campo, va al documento (il README lo dice). Il pannello è quello che l'`AppShell` scrive sotto il campo, e lo prende il
 * fuoco solo da fermata del pezzo dei rimedi. Provvisorio, finché l'`AppShell` non lo fa da sé (riga 131 delle richieste al
 * design system).
 */
function escDalPannello(tasto: KeyboardEvent): void {
    const pannello = tasto.target as Element;

    if (tasto.key === 'Escape' && pannello.matches?.('.zr-shell .zr-top > .zr-search > .zr-search-panel')) {
        pannello.parentElement?.querySelector('input')?.dispatchEvent(new KeyboardEvent('keydown', tasto));
    }
}

/** I rimedi di questo pezzo, uno per tasto premuto: ascoltano il documento da quando il pezzo arriva, e `ripeti` li chiama per i tasti di prima. */
const gestori = [tabRestaDentro, escDalPannello];

/**
 * Un tasto premuto prima che il pezzo arrivasse: i rimedi lo vedono come se arrivasse adesso, sullo stesso elemento. `fermato`
 * dice se qualcun altro lo aveva già fermato. Un Tab senza Ctrl, Alt né Meta il pezzo dei rimedi lo ferma, perché il fuoco non
 * esca da un dialogo prima del rimedio: se nessun rimedio lo tiene, il fuoco va dove l'avrebbe portato il browser, alla
 * fermata dopo l'elemento attivo nell'ordine della pagina (o prima, con Maiusc). Un `tabindex` da 1 in su non cambia
 * quell'ordine, qui.
 */
export function ripeti(tasto: KeyboardEvent, fermato: boolean): void {
    const copia = new KeyboardEvent('keydown', tasto);

    Object.defineProperty(copia, 'target', { value: tasto.target });
    if (fermato) {
        copia.preventDefault();
    }
    gestori.forEach((gestore) => gestore(copia));
    if (tasto.defaultPrevented && !fermato && !copia.defaultPrevented) {
        const giro = [...document.querySelectorAll<HTMLElement>(PRENDONO_IL_FUOCO)].filter(eUnaFermata);
        const qui = giro.indexOf(document.activeElement as HTMLElement);

        giro[tasto.shiftKey ? (qui < 0 ? giro.length : qui) - 1 : qui + 1]?.focus();
    }
}

gestori.forEach((gestore) => document.addEventListener('keydown', gestore));
vociPresto();
