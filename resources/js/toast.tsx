import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Toast } from './zeiras/componenti';
import type { Toast as TipoDelToast } from '../zeiras/index';

// Il `Toast` della cornice (dalla `v3.17.0`, voce #2910): quello del design system com'è, già messo al suo posto. In basso al
// centro su tutte le larghezze, a `--space-5` dal fondo più il bordo sicuro del telefono, a `--z-toast`, sopra dialoghi,
// pannelli e cassetto (Decisioni 19935 e 19940 di zr-pm). La durata resta di chi lo mostra. Dalla `v3.17.1` (voce #2951,
// Decisione 19956) con un `Dialog` aperto sta dentro il dialogo, e il testo arriva nella regione dopo la regione.

/** Un `Dialog` aperto che non è un'anteprima, dentro il suo velo: lo stesso selettore del Tab che resta nel dialogo (`tastiera.ts`). */
const DIALOGO_APERTO = '.zr-scrim:not(.is-inline) > .zr-dialog';

/** Dove sta il Toast: nell'ultimo dialogo aperto, che sta sopra a tutto; senza, nel `body`. */
const doveStare = (): HTMLElement => [...document.querySelectorAll<HTMLElement>(DIALOGO_APERTO)].at(-1) ?? document.body;

export type ToastDellaCorniceProps = Parameters<typeof TipoDelToast>[0];

/**
 * Si rende nel `body`, non dove lo mette la pagina: un antenato con `transform` — un pannello che scorre — sposterebbe un
 * `position: fixed`, e un contenitore con `overflow` lo taglierebbe. Lo stile sta sull'elemento, coi soli token; `max-content`
 * perché, da `left: 50%`, la larghezza disponibile sarebbe metà della finestra, e un testo lungo andrebbe a capo prima del
 * suo `max-width`. Il `body` si cerca dopo il montaggio: sul server (l'SSR di Inertia) non c'è, e il Toast arriva sul client.
 *
 * Con un `Dialog` aperto si rende dentro il dialogo: il dialogo è `aria-modal` e trattiene il Tab, e lì «Annulla» si raggiunge
 * e il lettore di schermo lo vede; fuori resterebbe dietro. Il `position: fixed` lo tiene in basso al centro anche lì (il
 * dialogo non ha `transform`). Un osservatore del documento, acceso finché il Toast c'è, lo sposta quando un dialogo si apre o
 * si chiude. Il testo entra nella regione `role="status"` del `Toast` 100 ms dopo la regione: un lettore di schermo annuncia
 * ciò che cambia in una regione che c'è già, non sempre una che arriva piena. Fino ad allora il Toast è trasparente.
 */
export function ToastDellaCornice(props: ToastDellaCorniceProps) {
    const [dove, setDove] = useState<HTMLElement | null>(null);
    const [colTesto, setColTesto] = useState(false);

    useEffect(() => {
        const segui = (): void => setDove(doveStare());
        const osservatore = new MutationObserver(segui);

        segui();
        osservatore.observe(document.body, { childList: true, subtree: true });
        const tempo = setTimeout(() => setColTesto(true), 100);

        return () => (osservatore.disconnect(), clearTimeout(tempo));
    }, []);
    if (!dove) {
        return null;
    }

    return createPortal(
        <div
            style={{
                position: 'fixed',
                left: '50%',
                transform: 'translateX(-50%)',
                bottom: 'calc(var(--space-5) + env(safe-area-inset-bottom, 0px))',
                zIndex: 'var(--z-toast)',
                opacity: colTesto ? undefined : 0,
                width: 'max-content',
                maxWidth: 'calc(100vw - 2 * var(--space-4))',
            }}
        >
            <Toast {...props}>{colTesto ? props.children : null}</Toast>
        </div>,
        dove,
    );
}
