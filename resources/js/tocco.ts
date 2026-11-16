/**
 * Il trascinamento col dito delle carte della `DealPipeline` (dalla `v4.35.2`, richiesta 293 al design system; sì di zr-pm-74 del
 * 16/11, su richiesta di Luciano): la `DealPipeline` sposta una carta solo col drag HTML5 (`draggable`, `dragstart`, `dragover`,
 * `drop`), che col tocco non parte. È un rimedio provvisorio, come gli altri del pacchetto: si toglie quando il design system
 * porta la 293. Il pezzo dei rimedi lo chiede quando entra una lavagna, e gli passa ogni tocco su una carta che si trascina (`premi`).
 *
 * Una pressione ferma di 250 ms sulla carta la prende: da lì una copia della carta segue il dito, e sotto il dito la pagina
 * riceve gli stessi eventi del drag HTML5 che il mouse le manda (`dragstart` sulla carta, `dragover` dove sta il dito, `drop`
 * al rilascio se chi sta sotto lo accetta, `dragend`): la `DealPipeline` sposta la carta con la sua `move`, quindi con lo
 * stesso `onMove` e lo stesso `onChange` del mouse. Vicino ai bordi la lavagna scorre da sola: di lato la `.zr-lanes`, in alto e
 * in basso il primo contenitore che scorre sotto il dito (la colonna, o la pagina). Un dito che si muove prima dei 250 ms fa
 * scorrere la pagina come sempre (sulle carte `touch-action: manipulation`, in `rimedi.css`), e un tocco breve resta un clic.
 * Il mouse resta del browser; la tastiera e «Sposta in…» non passano di qui.
 */

/** Le carte che si prendono col dito: quelle della `DealPipeline` che si possono trascinare (non una in attesa del modulo). */
const CARTA = '.zr-lanes [data-deal-id][draggable="true"]';
/** Quanto la pressione resta ferma prima che la carta si prenda, e quanto il dito si può muovere prima che sia uno scorrimento. */
const ATTESA = 250;
const SOGLIA = 8;
/** Vicino al bordo, entro `BORDO` px, la lavagna scorre, al più di `PASSO` px a fotogramma, e più veloce più il dito è vicino. */
const BORDO = 48;
const PASSO = 16;

/** Una pressione alla volta: un secondo dito, mentre la prima è in corso, non prende niente. */
let inCorso = false;
/** La carta è presa: il dito non fa più scorrere la pagina. */
let presa = false;

/**
 * Un `touchmove` sulla lavagna, che il pezzo dei rimedi passa di qui: con la carta presa non fa scorrere la pagina. Chromium
 * decide al primo tocco se i `touchmove` di quel dito si possono fermare, e lo sono solo se in quel momento chi sta sotto il
 * dito ha già chi li ascolta senza `passive`: per questo li ascolta il pezzo dei rimedi, su ogni `.zr-lanes`, prima di ogni tocco.
 */
export function trattieni(mosso: Event): void {
    if (presa) {
        mosso.preventDefault();
    }
}

/** Un evento del drag HTML5 come lo manda il browser, sull'elemento `dove`: torna false se chi lo riceve l'ha fermato. */
function manda(dove: Element, tipo: string, x: number, y: number): boolean {
    let evento: Event;

    try {
        evento = new DragEvent(tipo, { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: new DataTransfer() });
    } catch {
        evento = new Event(tipo, { bubbles: true, cancelable: true });
    }

    return dove.dispatchEvent(evento);
}

/** Di quanto scorre chi va da `inizio` a `fine` quando il dito sta in `dito`: 0 lontano dai bordi. */
function velocita(dito: number, inizio: number, fine: number): number {
    const prima = inizio + BORDO - dito;
    const dopo = dito - fine + BORDO;

    return prima > 0 ? -Math.min(PASSO, (PASSO * prima) / BORDO) : dopo > 0 ? Math.min(PASSO, (PASSO * dopo) / BORDO) : 0;
}

/** Il primo contenitore che scorre in verticale da `da` in su; la pagina se nessuno. */
function cheScorre(da: Element | null): Element {
    for (let su = da; su && su !== document.documentElement; su = su.parentElement) {
        if (su.scrollHeight > su.clientHeight && /auto|scroll/.test(getComputedStyle(su).overflowY)) {
            return su;
        }
    }

    return document.scrollingElement ?? document.documentElement;
}

/** La pressione del dito `giu` (un `pointerdown` col tocco), che il pezzo dei rimedi ha visto su una carta, mentre accade. */
export function premi(giu: PointerEvent): void {
    const toccato = giu.target instanceof Element ? giu.target : null;
    const carta = toccato?.closest<HTMLElement>(CARTA);
    const lavagna = carta?.closest('.zr-lanes');

    // Un comando dentro la carta (il «⋯», `draggable="false"`) resta un comando.
    if (inCorso || !carta || !lavagna || toccato?.closest('[draggable]') !== carta) {
        return;
    }
    inCorso = true;
    // Il drag del browser no (v4.35.3, R1 della revisione della v4.35.2): Safari su iOS e Chrome su Android, col dito fermo
    // più di mezzo secondo, avviano il loro su una carta `draggable` e si prendono il dito (`pointercancel`).
    carta.style.setProperty('-webkit-user-drag', 'none');

    const dito = giu.pointerId;
    const id = carta.getAttribute('data-deal-id') ?? '';
    /**
     * La carta com'è adesso (v4.35.3, R2): se la lavagna si aggiorna mentre il dito la tiene (la DealPipeline rilegge le fasi
     * ogni 20 s), quella toccata può essere uscita dal documento, e la sua al suo posto ha lo stesso `data-deal-id`.
     */
    const viva = (): Element => (carta.isConnected ? carta : [...lavagna.querySelectorAll('[data-deal-id]')].find((questa) => questa.getAttribute('data-deal-id') === id) ?? carta);
    let [x, y] = [giu.clientX, giu.clientY];
    let preso = false;
    let ombra: HTMLElement | undefined;
    let [dx, dy] = [0, 0];
    let giro = 0;

    /**
     * Chi sta sotto il dito. Nel margine accanto alla lavagna, alla sua altezza, il dito conta come sul bordo (v4.35.4, zr-crm):
     * lì la lavagna scorre da sola, e la colonna che si vede sul bordo è quella che il dito cerca. Sopra o sotto la lavagna no.
     */
    const sotto = (): Element | null => {
        const bordi = lavagna.getBoundingClientRect();
        const alLato = y >= bordi.top && y <= bordi.bottom ? Math.min(Math.max(x, bordi.left + 1), bordi.right - 1) : x;

        return document.elementFromPoint(alLato, y);
    };
    const sopra = (): void => {
        const qui = sotto();

        if (qui && lavagna.contains(qui)) {
            manda(qui, 'dragover', x, y);
        }
    };
    const segui = (): void => {
        if (ombra) {
            ombra.style.transform = `translate(${x - dx}px, ${y - dy}px)`;
        }
    };
    const scorri = (): void => {
        const bordi = lavagna.getBoundingClientRect();
        const colonna = cheScorre(sotto());
        const alta = colonna === document.scrollingElement ? { top: 0, bottom: innerHeight } : colonna.getBoundingClientRect();
        const [diLato, inVerticale] = [velocita(x, bordi.left, bordi.right), velocita(y, alta.top, alta.bottom)];

        lavagna.scrollLeft += diLato;
        colonna.scrollTop += inVerticale;
        if (diLato || inVerticale) {
            sopra();
        }
        giro = requestAnimationFrame(scorri);
    };
    const prendi = (): void => {
        if (!carta.isConnected) {
            fine();

            return;
        }
        const posto = carta.getBoundingClientRect();
        ombra = carta.cloneNode(true) as HTMLElement;
        ombra.removeAttribute('data-deal-id');
        ombra.setAttribute('aria-hidden', 'true');
        ombra.inert = true;
        ombra.classList.add('zr-tocco-ombra');
        ombra.style.width = `${posto.width}px`;
        [dx, dy] = [x - posto.left, y - posto.top];
        segui();
        document.body.append(ombra);
        preso = presa = true;
        // I `touchmove` vanno alla carta toccata anche quando è uscita dal documento, e da lì non arrivano più alla lavagna: li
        // ascolta anche lei (v4.35.3, R2).
        carta.addEventListener('touchmove', trattieni, { passive: false });
        manda(carta, 'dragstart', x, y);
        giro = requestAnimationFrame(scorri);
    };
    const muovi = (mosso: PointerEvent): void => {
        if (mosso.pointerId !== dito) {
            return;
        }
        if (!preso && Math.hypot(mosso.clientX - x, mosso.clientY - y) > SOGLIA) {
            fine();

            return;
        }
        if (preso) {
            [x, y] = [mosso.clientX, mosso.clientY];
            segui();
            sopra();
        }
    };
    const alzato = (su: PointerEvent): void => {
        if (su.pointerId !== dito) {
            return;
        }
        if (preso) {
            [x, y] = [su.clientX, su.clientY];
            const qui = sotto();

            // Come il browser: `drop` solo dove l'ultimo `dragover` è stato fermato, cioè su chi accetta la carta.
            if (qui && lavagna.contains(qui) && !manda(qui, 'dragover', x, y)) {
                manda(qui, 'drop', x, y);
            }
            manda(viva(), 'dragend', x, y);
            // Il clic che il browser manda dopo il dito alzato non apre la carta appena lasciata.
            addEventListener('click', fermato, true);
            setTimeout(() => removeEventListener('click', fermato, true), 400);
        }
        fine();
    };
    const annullato = (via: PointerEvent): void => {
        if (via.pointerId !== dito) {
            return;
        }
        if (preso) {
            manda(viva(), 'dragend', x, y);
        }
        fine();
    };
    // Presa la carta, il dito non fa più scorrere la pagina né apre il menu del browser; il drag del browser (quello vero, non
    // quello che manda questo pezzo) non parte.
    const fermo = (evento: Event): void => {
        if (evento.type === 'dragstart' ? evento.isTrusted : preso) {
            evento.preventDefault();
        }
    };
    const fermato = (clic: Event): void => {
        clic.preventDefault();
        clic.stopPropagation();
        removeEventListener('click', fermato, true);
    };
    const tempo = setTimeout(prendi, ATTESA);
    const ascolta = [
        ['pointermove', muovi],
        ['pointerup', alzato],
        ['pointercancel', annullato],
        ['contextmenu', fermo],
        ['dragstart', fermo],
        ['selectstart', fermo],
    ] as const;

    const fine = (): void => {
        presa = false;
        carta.style.removeProperty('-webkit-user-drag');
        carta.removeEventListener('touchmove', trattieni);
        clearTimeout(tempo);
        cancelAnimationFrame(giro);
        ombra?.remove();
        ascolta.forEach(([tipo, chi]) => removeEventListener(tipo, chi as EventListener, true));
        inCorso = false;
    };

    ascolta.forEach(([tipo, chi]) => addEventListener(tipo, chi as EventListener, { capture: true, passive: false }));
}
