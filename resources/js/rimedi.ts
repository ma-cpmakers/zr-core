/**
 * I rimedi provvisori di tastiera della cornice: ciò che i componenti del design system non fanno ancora da sé, coi soli
 * elementi che scrivono loro. Quelli che servono solo a chi preme un tasto stanno nel pezzo di tastiera (`tastiera.ts`), che
 * questo modulo chiede al primo tasto. La cornice carica questo modulo quando si monta, fuori dal JS d'ingresso; il modulo si
 * mette in ascolto una volta sola e resta, e senza una cornice in pagina non trova niente e non fa niente. Ogni rimedio
 * si toglie quando il componente porta il suo.
 */

/**
 * Nel pannello delle notifiche l'avatar di chi ha fatto è un `role="img"` col nome, dentro il pulsante della notifica: quando il
 * titolo della stessa riga dice già quel nome, un lettore di schermo lo leggeva due volte (riga 85 delle richieste al design
 * system). Allora l'avatar si nasconde; quando il titolo non lo dice — una frase senza chi, un nome tagliato — resta com'è. Le
 * righe entrano dopo il pannello (quando l'elenco arriva, con «Tutte»): si guardano quelle accanto a ciò che entra.
 */
function avatarGiaNelTitolo(aggiunto: Node): void {
    if (aggiunto instanceof HTMLElement && aggiunto.closest('.zr-shell .zr-top-actions > .zr-notif')) {
        aggiunto.parentElement?.querySelectorAll('.zr-notif-item > .zr-avatar').forEach((avatar) => {
            if (avatar.nextElementSibling?.firstElementChild?.textContent?.includes(`\u2068${avatar.getAttribute('aria-label')}\u2069`)) {
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
 * Il fuoco che entra nel dialogo e torna a chi lo aveva lo fa il `Dialog` da sé, dal lotto 0522 (richiesta 4).
 */
function dialogoSopraIlPannello(aggiunto: Node): void {
    if (aggiunto instanceof HTMLElement) {
        (aggiunto.matches(DIALOGO_APERTO) ? [aggiunto] : aggiunto.querySelectorAll<HTMLElement>(DIALOGO_APERTO)).forEach((dialogo) => {
            dialogo.parentElement?.style.setProperty('z-index', 'calc(var(--z-dialog) + 2)');
        });
    }
}

/**
 * Ciò che entra fra le azioni della barra in alto: i due menu che la barra apre, il profilo e le notifiche, quelli che
 * l'`AppShell` scrive lì e non elementi della pagina con la stessa classe (le `actions` del modulo, se entrano dopo, prendono
 * lo stesso gradino, e stanno comunque nella barra, sopra cui il pannello non va). I pulsanti ci sono già quando la cornice si
 * monta, e non si toccano.
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
    }
}

/**
 * Sotto 720 px la ricerca aperta copre la barra in alto, e la campanella e il profilo restano bersagli coperti a metà (axe
 * `target-size`): finché la ricerca la copre, le azioni della barra non si vedono e non prendono il fuoco, e tornano appena si
 * chiude. Dal lotto 0518 la copre solo `.is-open`: chiusa con Esc, il fuoco resta nel campo, che è l'icona, e le azioni tornano
 * col pannello che esce (lettura della PR #187, R1). Dove `matchMedia` non c'è non si nasconde niente (voce #2627). Al Tab si
 * mostrano prima che il browser cerchi dove portare il fuoco, perché dalla ricerca arrivi a loro e non al contenuto (#2805): se
 * il fuoco resta nella ricerca, all'uscita o al tasto dopo si nascondono di nuovo.
 */
function azioniSottoLaRicerca(tasto?: KeyboardEvent): void {
    const ricerca = document.querySelector('.zr-shell .zr-top > .zr-search');
    const azioni = ricerca?.parentElement?.querySelector<HTMLElement>(':scope > .zr-top-actions');

    if (azioni) {
        azioni.style.visibility = self.matchMedia?.('(max-width: 720px)').matches && ricerca?.matches('.is-open') && tasto?.key != 'Tab' ? 'hidden' : '';
    }
}

/**
 * Il menu a cassetto (sotto i 1024 px) aperto con la tastiera lasciava il fuoco su «Apri il menu» (#2806): aperto con Invio o
 * con lo spazio — il clic della tastiera, senza `detail` — il fuoco va alla prima voce che lo prende (una «Presto» no); col mouse
 * resta sul pulsante. Sta qui e non nel pezzo di tastiera (#3329): il primo tasto chiede quel pezzo, e il clic di un Invio
 * premuto per primo arrivava prima di lui. Il Tab che gira nel cassetto aperto resta del pezzo di tastiera. Provvisorio, finché
 * l'`AppShell` non lo fa da sé (#2341).
 */
function apertoIlCassetto(clic: MouseEvent): void {
    if (!clic.detail && (clic.target as Element).closest?.('.zr-shell .zr-top-menu')) {
        setTimeout(() => document.querySelector('.zr-shell .zr-top-menu[aria-expanded="true"]') && [...document.querySelector('.zr-shell > .zr-side')?.querySelectorAll<HTMLElement>(PRENDONO_IL_FUOCO) ?? []].some((voce) => voce.tabIndex >= 0 && (voce.focus(), document.activeElement === voce)));
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

/** Il pezzo di tastiera, quando è arrivato. */
let tastiera: typeof import('./tastiera') | undefined;
/** I tasti premuti prima che arrivi, ognuno con «qualcun altro lo aveva già fermato» e «è il Tab che si è fermato qui». */
const tasti: [KeyboardEvent, boolean, boolean][] = [];
/** Un Tab si è fermato qui: i tasti che arrivano dopo di lui, prima del pezzo e finché qualcuno trattiene il fuoco, si fermano anche loro. */
let tenuto = false;

/**
 * Il primo tasto premuto chiede il pezzo di tastiera (`tastiera.ts`), e i tasti che arrivano prima di lui si tengono: quando
 * arriva li ripete (zr-pm, 26/10/2026: il primo tasto non si perde). Un Tab senza Ctrl, Alt né Meta che nessuno ha fermato si
 * ferma solo quando qualcuno trattiene il fuoco — un `DetailPanel` a tutta pagina sotto 720 px; il `Dialog` lo trattiene da sé
 * dal lotto 0522 (richiesta 4) —, perché il fuoco non ne esca prima del rimedio: è il pezzo a spostarlo, quando arriva, uno
 * per ogni Tab. Altrove il Tab resta del
 * browser, che sa da dove partire anche dopo un clic a metà pagina (R1 della revisione 381). I tasti premuti dopo un Tab
 * fermato, finché il pezzo non arriva e finché qualcuno trattiene il fuoco, si fermano e si perdono: arriverebbero all'elemento
 * da cui il Tab voleva uscire (R2; N1 e N2 della seconda lettura). In ascolto sulla finestra, cioè dopo il
 * documento, la pagina e l'`AppShell`. Se il pezzo non arriva i tasti non si tengono più, e quelli tenuti restano fermi.
 */
function primoTasto(tasto: KeyboardEvent): void {
    const fermato = tasto.defaultPrevented;
    const trattiene = conLaCornice() && !document.querySelector(DIALOGO_APERTO) && !!(self.matchMedia?.('(max-width: 720px)').matches && document.querySelector('.zr-detail:not(.is-inline)'));
    const tab = trattiene && !fermato && tasto.key === 'Tab' && !(tasto.ctrlKey || tasto.altKey || tasto.metaKey);

    if (tasti.push([tasto, fermato, tab]) < 2) {
        void import('./tastiera').then((arrivato) => {
            removeEventListener('keydown', primoTasto);
            tastiera = arrivato;
            tasti.forEach((premuto) => arrivato.ripeti(...premuto));
        }, () => removeEventListener('keydown', primoTasto));
    }
    if ((tenuto = trattiene && (tenuto || tab))) {
        tasto.preventDefault();
    }
}

addEventListener('keydown', primoTasto);
document.addEventListener('click', apertoIlCassetto);
document.addEventListener('click', sceltoUnRisultato, true);
document.addEventListener('keydown', sceltoUnRisultato, true);
// La ricerca si apre e si chiude coi suoi risultati, e lo vede l'osservatore; il campo che perde il fuoco dopo la chiusura no.
// All'uscita il fuoco non è ancora arrivato dove va: si guarda al giro dopo.
document.addEventListener('focusout', () => setTimeout(azioniSottoLaRicerca));
document.addEventListener('keydown', azioniSottoLaRicerca, true);
self.matchMedia?.('(max-width: 1023px)').addEventListener('change', cassetto);

/**
 * Sotto i 1024 px la barra laterale è un menu a cassetto, che aperto copre la pagina ma non diceva di essere una finestra (riga
 * 111 delle richieste al design system, #2341): aperto ha `role="dialog"`, accanto al nome che l'`AppShell` gli dà; chiuso torna
 * com'era. Non `aria-modal`: il pulsante che lo chiude sta nella barra in alto, fuori dal cassetto, e il velo è nascosto ai
 * lettori di schermo, quindi chi usa il tocco resterebbe chiuso dentro (Decisione di zr-pm dopo la revisione della PR #145).
 * L'osservatore lo vede perché il velo entra ed esce col cassetto; la finestra che si allarga col cassetto aperto lo dice
 * `matchMedia`, perché lo stato dell'`AppShell` resta aperto e la barra torna al suo posto. Sta qui e non nel pezzo di tastiera:
 * serve anche a chi usa un lettore di schermo col tocco, che non preme tasti. Solo la barra laterale della cornice, non
 * un'`aside` della pagina con la stessa classe. Provvisorio, finché l'`AppShell` non lo fa da sé.
 */
function cassetto(): void {
    document.querySelectorAll('.zr-shell > .zr-side').forEach((lato) => {
        if (lato.matches('.is-open') && self.matchMedia?.('(max-width: 1023px)').matches) {
            lato.setAttribute('role', 'dialog');
        } else {
            lato.removeAttribute('role');
        }
    });
}

/** C'è una cornice in pagina: si chiede una volta per gruppo di cambi, non per ogni nodo. */
const conLaCornice = (): boolean => !!document.querySelector('.zr-shell');

new MutationObserver((cambi) => {
    if (!conLaCornice()) {
        return;
    }
    for (const cambio of cambi) {
        fuocoAllaCampanella(cambio);
        cambio.addedNodes.forEach((aggiunto) => {
            avatarGiaNelTitolo(aggiunto);
            dialogoSopraIlPannello(aggiunto);
            avatarFuoriDalMenu(aggiunto);
        });
    }
    azioniSottoLaRicerca();
    cassetto();
    tastiera?.aOgniCambio();
}).observe(document, { childList: true, subtree: true });

// Un dialogo già aperto quando il modulo arriva.
if (conLaCornice()) {
    dialogoSopraIlPannello(document.body);
}

// Un modulo, anche senza niente da dare: la cornice lo chiede con `import()`.
export {};
