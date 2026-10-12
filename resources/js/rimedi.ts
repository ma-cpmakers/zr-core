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
 * gestori della campanella, che a chi non ha accettato i documenti legali non arrivano.
 */
function fuocoNelPannelloDelleNotifiche(aggiunto: Node): void {
    if (aggiunto instanceof HTMLElement && aggiunto.matches('.zr-notif')) {
        aggiunto.querySelector<HTMLElement>('.zr-notif-tabs [role="tab"][aria-selected="true"]')?.focus();
    }
}

new MutationObserver((cambi) => {
    for (const cambio of cambi) {
        cambio.addedNodes.forEach(fuocoNelPannelloDelleNotifiche);
    }
}).observe(document, { childList: true, subtree: true });

export {};
