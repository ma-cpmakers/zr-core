/**
 * I rimedi provvisori della cornice che servono solo a chi usa la tastiera: il Tab che resta dentro un dialogo e nel cassetto,
 * Esc che chiude il cassetto. Stanno in un pezzo loro, fuori dal JS d'ingresso e fuori da quello dei rimedi: lo chiede il pezzo
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
    for (let su: HTMLElement | null = elemento, sotto: HTMLElement | null = null; su; sotto = su, su = su.parentElement) {
        if (su.hidden || getComputedStyle(su).display === 'none' || (sotto && su.matches('details:not([open])') && !sotto.matches('summary:first-of-type'))) {
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
    if (elemento.tabIndex < 0 || elemento.matches(':disabled, input[type="hidden"]') || elemento.closest('[inert]') || nascosto(elemento) || (elemento.matches('iframe') && !(elemento.clientWidth && elemento.clientHeight))) {
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
    if (preso && !preso[0].isConnected) {
        const loAveva = preso[1];

        preso = null;
        if (document.activeElement === document.body && loAveva instanceof HTMLElement && (chiTrattieneIlFuoco() ?? document).contains(loAveva)) {
            loAveva.focus();
        }
    }
}

/** Ciò che questo pezzo rifà a ogni gruppo di cambi della pagina: l'osservatore è quello del pezzo dei rimedi. */
export function aOgniCambio(): void {
    fuocoAChiLoAveva();
    fuocoAlPiu();
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
    if (!document.querySelector('.zr-shell')) {
        return null;
    }
    const aperti = (selettore: string): HTMLElement | null => [...document.querySelectorAll<HTMLElement>(selettore)].pop() ?? null;

    return aperti(DIALOGO_APERTO)
        ?? (self.matchMedia?.('(max-width: 720px)').matches ? aperti('.zr-detail:not(.is-inline)') : null);
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

    if (!dentro || dentro.querySelector('.zr-menu') || document.activeElement?.closest('.zr-menu')) {
        return;
    }
    const fermate = [...dentro.querySelectorAll<HTMLElement>(PRENDONO_IL_FUOCO)].filter(eUnaFermata);
    const [prima] = fermate;
    const ultima = fermate.at(-1);
    const attivo = document.activeElement;

    if (!prima || !ultima) {
        // Niente su cui fermarsi: il fuoco non esce lo stesso, e va a chi trattiene. Il `Dialog` non ha un `tabindex`, e senza
        // non lo può prendere: resterebbe sul pulsante dietro il velo, che Invio premerebbe.
        tasto.preventDefault();
        if (attivo !== dentro) {
            preso = [dentro, attivo];
        }
        dentro.tabIndex = -1;
        dentro.focus();
    } else if (attivo === null || !dentro.contains(attivo) || (tasto.shiftKey ? !(attivo.compareDocumentPosition(prima) & Node.DOCUMENT_POSITION_PRECEDING) : !(attivo.compareDocumentPosition(ultima) & Node.DOCUMENT_POSITION_FOLLOWING))) {
        // Da fuori entra; e dopo l'attivo, o prima con Maiusc, non c'è un'altra fermata: il browser uscirebbe dal dialogo.
        tasto.preventDefault();
        (tasto.shiftKey ? ultima : prima).focus();
    }
}

/**
 * Col cassetto aperto Esc lo chiude anche dal campo della ricerca, che l'`AppShell` lascia fuori — non con un dialogo
 * aperto, né coi menu della barra (profilo, campanella, «+», Moduli) o col selettore aperti, che si chiudono loro —, e il fuoco che non è nella barra in alto torna
 * ad «Apri il menu» (#2807): dalle voci del cassetto chiuso restava su una voce nascosta. Solo l'Esc di chi ha il fuoco: quello
 * che i rimedi mandano al campo quando il fuoco esce dalla ricerca, o dopo la scelta di un risultato, non chiude il cassetto; e
 * nemmeno, fuori dalla ricerca, un Esc dato in un `<dialog>` o già gestito, che i rimedi fermano prima dell'`AppShell` (riga 136). In ascolto in cattura, perché
 * l'`AppShell` ferma Esc. Provvisorio, finché l'`AppShell` non lo fa da sé.
 */
function escNellaBarra(tasto: KeyboardEvent): void {
    const campo = tasto.target as HTMLInputElement;
    const menu = document.querySelector<HTMLElement>('.zr-shell .zr-top-menu[aria-expanded="true"]');

    if (tasto.key === 'Escape' && menu && campo === document.activeElement && !document.querySelector('.zr-scrim, .zr-shell .zr-top-actions [aria-expanded="true"], .zr-shell .zr-create[aria-expanded="true"], .zr-shell .zr-ws.is-open, .zr-shell .zr-product.is-open')) {
        setTimeout(() => {
            if ((tasto.defaultPrevented || campo.closest('dialog')) && !campo.matches('.zr-shell .zr-top > .zr-search input')) {
                return;
            }
            if (menu.getAttribute('aria-expanded') === 'true') {
                menu.click();
            }
            if (!document.activeElement?.closest('.zr-top')) {
                menu.focus();
            }
        });
    }
}

/**
 * Finché un dialogo o un pannello a tutta pagina trattiene il fuoco, Ctrl+K e Cmd+K (senza Alt, come li legge l'`AppShell`) non
 * arrivano all'`AppShell`, che aprirebbe la ricerca sotto di loro, dove non si vede (sprint 89, zr-pm 01/11/2026). In ascolto
 * sulla radice del documento, dopo la pagina e prima dell'`AppShell`, che ascolta sul documento: chi nel dialogo usa Ctrl+K lo
 * riceve ancora. Provvisorio, finché l'`AppShell` non lo fa da sé.
 */
function ctrlKFermo(tasto: KeyboardEvent): void {
    if ((tasto.ctrlKey || tasto.metaKey) && !tasto.altKey && /^k$/i.test(tasto.key) && chiTrattieneIlFuoco()) {
        tasto.preventDefault();
        tasto.stopPropagation();
    }
}

/**
 * Il menu del profilo, il menu «+» e il pannello delle notifiche aperti hanno il fuoco (la cornice lo dà loro), e il fuoco che va
 * a un elemento che non è il loro pulsante, né un menu o un pannello della cornice, li chiude col loro pulsante (#2804); il fuoco
 * che lascia la finestra no. Il selettore dei workspace lo fa da sé (dalla `v4.18.0`, richiesta 48). Provvisorio, finché
 * l'`AppShell` non lo fa da sé.
 */
function fuoriDaiMenu(uscita: FocusEvent): void {
    const verso = uscita.relatedTarget as Element | null;

    document.querySelectorAll<HTMLElement>('.zr-shell .zr-avatar-btn[aria-expanded="true"], .zr-shell .zr-bell[aria-expanded="true"], .zr-shell .zr-create[aria-expanded="true"]').forEach((pulsante) => {
        if (verso && verso !== pulsante && !verso.closest?.('.zr-menu, .zr-pop')) {
            pulsante.click();
        }
    });
}

/**
 * Il «+» col fuoco dietro il velo di un `Dialog` — una voce lo ha aperto senza dargli il fuoco — non resta lì, dove Invio lo
 * premerebbe: il fuoco va al dialogo, e torna al «+» quando il dialogo se ne va.
 */
function fuocoAlPiu(): void {
    const dialogo = document.querySelector<HTMLElement>(DIALOGO_APERTO);
    const piu = document.activeElement;

    if (dialogo && piu?.matches('.zr-shell .zr-create')) {
        preso = [dialogo, piu];
        dialogo.tabIndex = -1;
        dialogo.focus();
    }
}

/**
 * Il menu a cassetto (sotto i 1024 px) aperto con la tastiera lasciava il fuoco su «Apri il menu», e il Tab usciva verso la ricerca
 * e la pagina (#2806). Il fuoco che entra alla prima voce, aperto con la tastiera, lo dà il pezzo dei rimedi (`apertoIlCassetto`,
 * #3329). Finché è aperto il Tab gira fra il pulsante, che lo chiude, e le voci, e da fuori rientra sulla
 * prima. Con un dialogo aperto, o un `DetailPanel` che trattiene il fuoco, vale lui; dove il pulsante non si vede (la finestra
 * allargata a 1024 px o più col cassetto aperto) il Tab resta del browser. Chiuso con Esc il fuoco torna al pulsante
 * (`escNellaBarra`). Provvisorio, finché l'`AppShell` non lo fa da sé (#2341, `role="dialog"`).
 */
function giroDelCassetto(): HTMLElement[] {
    const menu = document.querySelector<HTMLElement>('.zr-shell .zr-top-menu[aria-expanded="true"]');

    return menu && eUnaFermata(menu) ? [menu, ...[...(document.querySelector('.zr-shell > .zr-side')?.querySelectorAll<HTMLElement>(PRENDONO_IL_FUOCO) ?? [])].filter(eUnaFermata)] : [];
}

function tabNelCassetto(tasto: KeyboardEvent): void {
    const giro = giroDelCassetto();
    const qui = giro.indexOf(document.activeElement as HTMLElement);

    if (giro.length && tasto.key === 'Tab' && !tasto.defaultPrevented && !tasto.ctrlKey && !tasto.altKey && !tasto.metaKey && !chiTrattieneIlFuoco()) {
        tasto.preventDefault();
        giro.at(qui < 0 ? 1 : (qui + (tasto.shiftKey ? -1 : 1)) % giro.length)?.focus();
    }
}

/** I rimedi di questo pezzo, uno per tasto premuto: ascoltano il documento da quando il pezzo arriva, e `ripeti` li chiama per i tasti di prima. */
const gestori = [tabRestaDentro, tabNelCassetto];

/**
 * Un tasto premuto prima che il pezzo arrivasse: i rimedi lo vedono come se arrivasse adesso, sullo stesso elemento. `fermato`
 * dice se qualcun altro lo aveva già fermato; `tab`, se è il Tab che il pezzo dei rimedi ha fermato perché qualcuno trattiene il
 * fuoco. Se nessun rimedio lo tiene, il fuoco va dove l'avrebbe portato il browser: alla prima fermata dopo l'elemento attivo
 * nell'ordine della pagina (o all'ultima prima, con Maiusc), anche quando l'attivo non è una fermata (R1 della revisione 381),
 * se qualcuno trattiene ancora il fuoco: chiuso il dialogo nel frattempo, il fuoco resta dov'è (N3 della seconda lettura).
 * Un altro tasto non sposta il fuoco, nemmeno se qualcuno lo ha fermato (R3). Un `tabindex` da 1 in su non cambia
 * quell'ordine, qui.
 */
export function ripeti(tasto: KeyboardEvent, fermato: boolean, tab: boolean): void {
    const copia = new KeyboardEvent('keydown', tasto);
    const attivo = document.activeElement ?? document.body;

    Object.defineProperty(copia, 'target', { value: tasto.target });
    if (fermato) {
        copia.preventDefault();
    }
    gestori.forEach((gestore) => gestore(copia));
    if (tab && !copia.defaultPrevented && chiTrattieneIlFuoco()) {
        [...document.querySelectorAll<HTMLElement>(PRENDONO_IL_FUOCO)].filter((fermata) => eUnaFermata(fermata) && attivo.compareDocumentPosition(fermata) & (tasto.shiftKey ? Node.DOCUMENT_POSITION_PRECEDING : Node.DOCUMENT_POSITION_FOLLOWING)).at(tasto.shiftKey ? -1 : 0)?.focus();
    }
}

gestori.forEach((gestore) => document.addEventListener('keydown', gestore));
document.addEventListener('keydown', escNellaBarra, true);
document.documentElement.addEventListener('keydown', ctrlKFermo);
document.addEventListener('focusout', fuoriDaiMenu);
