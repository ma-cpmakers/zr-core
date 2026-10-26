/**
 * I rimedi provvisori di tastiera della cornice: ciò che i componenti del design system non fanno ancora da sé, coi soli
 * elementi che scrivono loro. Quelli che servono solo a chi preme un tasto stanno nel pezzo di tastiera (`tastiera.ts`), che
 * questo modulo chiede al primo tasto. La cornice carica questo modulo quando si monta, fuori dal JS d'ingresso; il modulo si
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
 * Nel pannello delle notifiche l'avatar di chi ha fatto è un `role="img"` col nome, dentro il pulsante della notifica: quando il
 * titolo della stessa riga dice già quel nome, un lettore di schermo lo leggeva due volte (riga 85 delle richieste al design
 * system). Allora l'avatar si nasconde; quando il titolo non lo dice — una frase senza chi, un nome tagliato — resta com'è. Le
 * righe entrano dopo il pannello (quando l'elenco arriva, con «Tutte»): si guardano quelle accanto a ciò che entra.
 */
function avatarGiaNelTitolo(aggiunto: Node): void {
    if (aggiunto instanceof HTMLElement && aggiunto.closest('.zr-shell .zr-top-actions > .zr-notif')) {
        aggiunto.parentElement?.querySelectorAll('.zr-notif-item > .zr-avatar').forEach((avatar) => {
            if (avatar.nextElementSibling?.firstElementChild?.textContent?.includes(avatar.getAttribute('aria-label')!)) {
                avatar.setAttribute('aria-hidden', 'true');
            }
        });
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

/** Ciò che può prendere il fuoco col Tab. */
const PRENDONO_IL_FUOCO = 'a[href], button, input, select, textarea, summary, iframe, video[controls], audio[controls], [contenteditable], [tabindex]';

/** Un `Dialog` aperto che non è un'anteprima, dentro il suo velo. */
const DIALOGO_APERTO = '.zr-scrim:not(.is-inline) > .zr-dialog';

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
 * Ciò che entra fra le azioni della barra in alto: i due menu che la barra apre, il profilo e le notifiche, quelli che
 * l'`AppShell` scrive lì e non elementi della pagina con la stessa classe (le `actions` del modulo, se entrano dopo, prendono
 * lo stesso gradino, e stanno comunque nella barra, sopra cui il pannello non va). I pulsanti ci sono già quando la cornice si
 * monta, e non si toccano.
 *
 * Nel menu del profilo aperto l'avatar dell'intestazione è un `role="img"` dentro un `role="menu"`, dove un'immagine non è
 * ammessa: axe lo dà critico (`aria-required-children`). Il nome e l'email stanno scritti accanto, quindi l'avatar si nasconde
 * e basta; gli avatar delle notifiche restano come sono.
 *
 * Tutti e due stanno a `--z-dropdown`, e un `DetailPanel` non modale, che comincia sotto la barra, a `--z-dialog`: col pannello
 * aperto finivano sotto, e «Esci» non si cliccava col mouse (riga 102 delle richieste al design system). Aperti, salgono di un
 * gradino sopra il pannello, col token, e restano sotto i dialoghi e il cassetto (`--z-dialog` + 2). Sotto 720 px il pannello
 * è modale, a tutto schermo e allo stesso gradino, e viene dopo nel documento: copre la barra come prima. Si toglie quando il
 * design system mette i menu della barra sopra il pannello.
 */
function avatarFuoriDalMenu(aggiunto: Node): void {
    if (aggiunto instanceof HTMLElement && aggiunto.matches('.zr-top-actions > *')) {
        aggiunto.style.setProperty('z-index', 'calc(var(--z-dialog) + 1)');
        aggiunto.querySelector('.zr-profile-head .zr-avatar')?.setAttribute('aria-hidden', 'true');
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

/**
 * Scelto un risultato della ricerca — un clic sulla riga, Invio con una riga attiva — l'`AppShell` lascia la parola nel campo
 * (riga 60 delle richieste al design system). Il campo si svuota come lo svuota chi scrive, con un `input` che l'`AppShell`
 * legge, e la ricerca che quel cambio riapre si chiude con Esc, come la chiude una persona: l'`AppShell` ferma il suo Esc, che
 * non arriva alla finestra né al pezzo di tastiera. Si guarda prima dell'`AppShell` e si svuota al giro dopo, a scelta fatta.
 * Chiusa con Esc o con un clic fuori, la ricerca tiene la parola.
 */
function sceltoUnRisultato(evento: Event): void {
    const campo = document.querySelector<HTMLInputElement>('.zr-shell .zr-top > .zr-search input');
    if (campo && (evento.type === 'click' ? (evento.target as Element).closest?.('.zr-shell .zr-top > .zr-search .zr-search-item') : (evento as KeyboardEvent).key === 'Enter' && evento.target === campo && campo.hasAttribute('aria-activedescendant'))) {
        setTimeout(() => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(campo, '');
            campo.dispatchEvent(new Event('input', { bubbles: true }));
            campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        });
    }
}

/**
 * Scelta una voce del menu «+» con Invio o con lo spazio, il menu esce dal documento con dentro l'elemento attivo e il fuoco
 * restava alla pagina: torna al «+», come dopo Esc (riga 11 delle richieste al design system). Se la voce dà il fuoco a un
 * altro elemento non si toglie, e con un dialogo aperto — la voce lo ha aperto — non va al «+» dietro il velo. Il menu è quello
 * che il «+» della cornice tiene aperto. Sta qui e non nel pezzo di tastiera, che è al suo tetto: è un tasto premuto con questo
 * pezzo già in pagina, e se il pezzo non arriva il fuoco resta alla pagina com'era. Provvisorio, finché il `Menu` non lo fa da sé.
 */
let dalPiu: [menu: Element, piu: HTMLElement] | undefined;

function sceltaDalPiu(tasto: KeyboardEvent): void {
    const voce = tasto.target as Element;
    const piu = document.querySelector<HTMLElement>('.zr-shell .zr-create[aria-expanded="true"]');

    if ((tasto.key === 'Enter' || tasto.key === ' ') && piu && voce.matches?.('.zr-shell .zr-menu > [role="menuitem"]')) {
        dalPiu = [voce.parentElement!, piu];
    }
}

/** Uscito il menu del «+» scelto con la tastiera, il fuoco che non è di nessuno torna al «+». */
function fuocoAlPiu(): void {
    if (dalPiu && !dalPiu[0].isConnected) {
        if (document.activeElement === document.body && !document.querySelector(DIALOGO_APERTO)) {
            dalPiu[1].focus();
        }
        dalPiu = undefined;
    }
}

/** La cornice dà la sua `naviga` e i nomi (di nuovo a ogni cambio di lingua): da qui in poi i clic sulla barra laterale passano da lì. */
export function via(daUsare: (indirizzo: string) => void, ...nomiDellaCornice: typeof nomi): void {
    naviga = daUsare;
    nomi = nomiDellaCornice;
    contenuto();
}


/** Il pezzo di tastiera, quando è arrivato. */
let tastiera: typeof import('./tastiera') | undefined;
/** I tasti premuti prima che arrivi, ognuno con «qualcun altro lo aveva già fermato». */
const tasti: [KeyboardEvent, boolean][] = [];

/**
 * Il primo tasto premuto chiede il pezzo di tastiera (`tastiera.ts`), e i tasti che arrivano prima di lui si tengono: quando
 * arriva li ripete (zr-pm, 26/10/2026: il primo tasto non si perde). Un Tab senza Ctrl, Alt né Meta che nessuno ha fermato si
 * ferma, perché il fuoco non esca da un dialogo prima del rimedio: è il pezzo a spostarlo, quando arriva. In ascolto sulla
 * finestra, cioè dopo il documento, la pagina e l'`AppShell`. Se il pezzo non arriva i tasti non si tengono più, e quelli
 * tenuti restano fermi.
 */
function primoTasto(tasto: KeyboardEvent): void {
    if (tasti.push([tasto, tasto.defaultPrevented]) < 2) {
        void import('./tastiera').then((arrivato) => {
            removeEventListener('keydown', primoTasto);
            tastiera = arrivato;
            tasti.forEach((tenuto) => arrivato.ripeti(...tenuto));
        }, () => removeEventListener('keydown', primoTasto));
    }
    if (tasto.key === 'Tab' && !(tasto.ctrlKey || tasto.altKey || tasto.metaKey)) {
        tasto.preventDefault();
    }
}

addEventListener('keydown', primoTasto);
document.addEventListener('click', clicSullaBarra);
document.addEventListener('click', sceltoUnRisultato, true);
document.addEventListener('keydown', sceltoUnRisultato, true);
document.addEventListener('keydown', sceltaDalPiu);
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
            avatarGiaNelTitolo(aggiunto);
            dialogoSopraIlPannello(aggiunto);
            avatarFuoriDalMenu(aggiunto);
        });
    }
    azioniSottoLaRicerca();
    tastiera?.fuocoAChiLoAveva();
    fuocoAlPiu();
    contenuto();
}).observe(document, { childList: true, subtree: true, attributeFilter: ['aria-hidden'] });

// Un dialogo già aperto quando il modulo arriva.
if (conLaCornice()) {
    dialogoSopraIlPannello(document.body);
}
