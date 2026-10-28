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
 * al campo, che prima prende il fuoco, e l'`AppShell` chiude la ricerca come quando Esc parte dal campo: il pannello se ne va
 * e il fuoco resta nel campo (dalla v3.10.0, #2800: prima andava al documento). Il pannello è quello che l'`AppShell` scrive
 * sotto il campo, e lo prende il
 * fuoco solo da fermata del pezzo dei rimedi. Provvisorio, finché l'`AppShell` non lo fa da sé (riga 131 delle richieste al
 * design system).
 */
function escDalPannello(tasto: KeyboardEvent): void {
    const pannello = tasto.target as Element;
    const campo = pannello.parentElement?.querySelector('input');

    if (tasto.key === 'Escape' && campo && pannello.matches?.('.zr-shell .zr-top > .zr-search > .zr-search-panel')) {
        campo.focus();
        campo.dispatchEvent(new KeyboardEvent('keydown', tasto));
    }
}

/**
 * Esc dal campo della ricerca: l'`AppShell` chiude il pannello e toglie il fuoco al campo, che finiva sul documento (#2800): per
 * quel tasto il campo non si lascia togliere il fuoco. Un secondo Esc, col pannello chiuso, non svuota il campo (il README lo
 * dice). Col cassetto aperto Esc lo chiude anche dal campo della ricerca, che l'`AppShell` lascia fuori — non con un dialogo
 * aperto, né coi menu della barra (profilo, campanella, «+», Moduli) o col selettore aperti, che si chiudono loro —, e il fuoco che non è nella barra in alto torna
 * ad «Apri il menu» (#2807): dalle voci del cassetto chiuso restava su una voce nascosta. Solo l'Esc di chi ha il fuoco: quello
 * che i rimedi mandano al campo quando il fuoco esce dalla ricerca, o dopo la scelta di un risultato, non chiude il cassetto; e
 * nemmeno, fuori dalla ricerca, un Esc dato in un `<dialog>` o già gestito, che i rimedi fermano prima dell'`AppShell` (riga 136). In ascolto in cattura, perché
 * l'`AppShell` ferma Esc. Provvisorio, finché l'`AppShell` non lo fa da sé.
 */
function escNellaBarra(tasto: KeyboardEvent): void {
    const campo = tasto.target as HTMLInputElement;
    const menu = document.querySelector<HTMLElement>('.zr-shell .zr-top-menu[aria-expanded="true"]');

    if (tasto.key === 'Escape') {
        if (campo.matches?.('.zr-shell .zr-top > .zr-search input')) {
            campo.blur = () => {};
            setTimeout(() => delete (campo as Partial<HTMLInputElement>).blur);
        }
        if (menu && campo === document.activeElement && !document.querySelector('.zr-scrim, .zr-shell .zr-top-actions [aria-expanded="true"], .zr-shell .zr-create[aria-expanded="true"], .zr-shell .zr-ws.is-open, .zr-shell .zr-product.is-open')) {
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
}

/**
 * Nel selettore dei workspace aperto l'`AppShell` muove il fuoco con le frecce, ma Home e Fine non facevano niente (riga 48 delle
 * richieste al design system): portano il fuoco alla prima e all'ultima voce. Lo stesso, dalla v3.10.0, nel menu del profilo e nel
 * menu «+» (#2802, riga 132), fra le voci che non sono spente; un `Menu` della pagina no. Provvisorio, finché l'`AppShell` non lo
 * fa da sé.
 */
function inizioEFine(tasto: KeyboardEvent): void {
    const voci = (tasto.target as Element).closest?.('.zr-shell .zr-ws-menu, .zr-shell .zr-top .zr-menu, .zr-shell .zr-side .zr-menu')?.querySelectorAll<HTMLElement>('.zr-ws-item, [role="menuitem"]:not(:disabled)');

    if (voci && (tasto.key === 'Home' || tasto.key === 'End')) {
        tasto.preventDefault();
        [...voci].at(tasto.key === 'Home' ? 0 : -1)?.focus();
    }
}

/**
 * Nel pannello delle notifiche le linguette «Per me» e «Tutte» erano due fermate del Tab, e le frecce non facevano niente (#2803):
 * le frecce a destra e a sinistra passano all'altra linguetta e la scelgono, Home e Fine vanno alla prima e all'ultima, e nel giro
 * del Tab resta la sola linguetta scelta (`tabindex` mobile), rimesso a ogni tasto, prima che il browser sposti il fuoco: anche
 * dopo un clic. Con Alt, Ctrl o Meta i tasti restano del browser (Alt+freccia è Indietro e Avanti). Il legame fra la linguetta e ciò che mostra (`aria-controls`, `tabpanel`) è struttura dell'`AppShell`: riga 133
 * delle richieste al design system. Provvisorio, come sopra.
 */
function frecceSulleLinguette(tasto: KeyboardEvent): void {
    const linguette = [...document.querySelectorAll<HTMLElement>('.zr-shell .zr-notif-tabs [role="tab"]')];
    const qui = linguette.indexOf(tasto.target as HTMLElement);
    const verso = { ArrowRight: qui + 1, ArrowLeft: qui - 1, Home: 0, End: -1 }[tasto.key];

    linguette.forEach((linguetta) => {
        linguetta.tabIndex = linguetta.matches('[aria-selected="true"]') ? 0 : -1;
    });
    if (qui >= 0 && verso !== undefined && !tasto.altKey && !tasto.ctrlKey && !tasto.metaKey) {
        tasto.preventDefault();
        const scelta = linguette.at(verso % linguette.length);

        scelta?.click();
        scelta?.focus();
    }
}

/**
 * Nel pannello della ricerca le frecce nel campo muovono l'opzione attiva (`aria-activedescendant`), ma il pannello non scorreva:
 * dopo le prime righe l'attiva era fuori vista (#2799). Dopo ogni freccia giù o su, quando l'`AppShell` ha scelto la nuova,
 * l'opzione attiva scorre in vista, quanto basta. Col fuoco sul pannello le frecce lo fanno scorrere come sempre. Provvisorio, finché l'`AppShell` non lo fa da sé (riga 135 delle richieste).
 */
function attivaInVista(tasto: KeyboardEvent): void {
    if ((tasto.target as Element).matches?.('.zr-shell .zr-search input') && (tasto.key === 'ArrowDown' || tasto.key === 'ArrowUp')) {
        setTimeout(() => document.querySelector('.zr-shell .zr-search .is-active')?.scrollIntoView({ block: 'nearest' }));
    }
}

/**
 * Col fuoco che esce dal selettore dei workspace aperto verso un altro elemento — col Tab, verso la barra laterale che l'`AppShell`
 * nasconde finché il selettore è aperto — il pannello restava aperto (riga 48): si chiude col pulsante del selettore, e il fuoco
 * resta dove è andato. Fra le voci e il pulsante non si chiude, e nemmeno quando il fuoco lascia la finestra. Lo stesso, dalla
 * v3.10.0, per il menu del profilo, il menu «+» e il pannello delle notifiche (#2804): aperti, hanno il fuoco (la cornice lo dà
 * loro), e il fuoco che va a un elemento che non è il loro pulsante, né un menu o un pannello della cornice, li chiude col loro
 * pulsante. Provvisorio, come sopra.
 */
function fuoriDalSelettore(uscita: FocusEvent): void {
    const selettore = (uscita.target as Element).closest?.('.zr-shell .zr-ws.is-open');
    const verso = uscita.relatedTarget as Element | null;

    if (selettore && verso && !selettore.contains(verso)) {
        selettore.querySelector<HTMLElement>('.zr-ws-switch')?.click();
    }
    document.querySelectorAll<HTMLElement>('.zr-shell .zr-avatar-btn[aria-expanded="true"], .zr-shell .zr-bell[aria-expanded="true"], .zr-shell .zr-create[aria-expanded="true"]').forEach((pulsante) => {
        const suo = (qui: Element | null): boolean => qui === pulsante || !!qui?.closest?.('.zr-menu, .zr-pop');

        if (verso && !suo(verso)) {
            pulsante.click();
        }
    });
}

/**
 * Scelta una voce del menu «+», con la tastiera o col mouse, il menu esce dal documento con dentro l'elemento attivo e il fuoco
 * restava alla pagina; un dialogo che la voce apre si ricorda chi aveva il fuoco quando si è aperto — la voce, già uscita, o la
 * pagina — e alla chiusura non lo rendeva a nessuno (#2822). Il fuoco va al «+» prima che la voce faccia la sua parte, come
 * dopo Esc (riga 11 delle richieste al design system), e il dialogo lo rende a lui. Se la voce lo dà a un altro elemento non si
 * toglie. Il menu è quello che il «+» della cornice tiene aperto, accanto a lui nella barra: una voce di un menu della pagina
 * non conta. Il pezzo arriva al primo tasto: una scelta fatta prima, col mouse o col tasto che lo chiede, o senza il pezzo,
 * lascia il fuoco com'era. Provvisorio, finché il `Menu` non lo fa da sé.
 */
function sceltaDalPiu(clic: MouseEvent): void {
    const piu = document.querySelector<HTMLElement>('.zr-shell .zr-create[aria-expanded="true"]');

    if (piu && (clic.target as Element).closest?.('.zr-shell .zr-side > .zr-menu > [role="menuitem"]')) {
        piu.focus();
    }
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
 * Il menu a cassetto (sotto 720 px) aperto con la tastiera lasciava il fuoco su «Apri il menu», e il Tab usciva verso la ricerca
 * e la pagina (#2806). Aperto con Invio o con lo spazio — il clic della tastiera, senza `detail` — il fuoco va alla prima voce;
 * col mouse resta sul pulsante. Finché è aperto il Tab gira fra il pulsante, che lo chiude, e le voci, e da fuori rientra sulla
 * prima. Con un dialogo aperto, o un `DetailPanel` che trattiene il fuoco, vale lui; dove il pulsante non si vede (la finestra
 * allargata sopra 720 px col cassetto aperto) il Tab resta del browser. Chiuso con Esc il fuoco torna al pulsante
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

function apertoIlCassetto(clic: MouseEvent): void {
    if (!clic.detail && (clic.target as Element).closest?.('.zr-shell .zr-top-menu')) {
        setTimeout(() => giroDelCassetto()[1]?.focus());
    }
}

/** I rimedi di questo pezzo, uno per tasto premuto: ascoltano il documento da quando il pezzo arriva, e `ripeti` li chiama per i tasti di prima. */
const gestori = [tabRestaDentro, escDalPannello, inizioEFine, frecceSulleLinguette, attivaInVista, tabNelCassetto];

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
document.addEventListener('click', apertoIlCassetto);
document.addEventListener('click', sceltaDalPiu, true);
document.addEventListener('focusout', fuoriDalSelettore);
