import { useRef, useState } from 'react';
import { Button } from './zeiras/componenti';

// «Salta al contenuto» della cornice, in un modulo suo (dalla `v3.16.0`): lo mettono la `Cornice` e la cornice dello staff.

/**
 * Porta il fuoco al contenuto della pagina: il `main` dell'`AppShell`, che non ha un `id` e di suo non prende il fuoco. Si
 * trova dal pulsante — l'`AppShell` è accanto al suo contenitore —, non dal documento: un frontend può avere un `main` suo.
 * Gli si dà `tabindex="-1"` solo per il salto, e glielo si toglie quando il fuoco lo lascia: del `main` la cornice non
 * cambia altro, e un `tabindex` che ha già resta com'è. Il `blur` arriva anche quando è la finestra a perdere il fuoco, e lì
 * il `main` resta l'elemento attivo: l'attributo resta, o al ritorno il `main` non terrebbe più il fuoco.
 */
function fuocoAlContenuto(dalSalto: HTMLElement | null): void {
    const main = dalSalto?.parentElement?.querySelector<HTMLElement>(':scope > .zr-shell > main.zr-main');

    if (!main) {
        return;
    }
    if (!main.hasAttribute('tabindex')) {
        const alBlur = (): void => {
            if (main.ownerDocument.activeElement !== main) {
                main.removeAttribute('tabindex');
                main.removeEventListener('blur', alBlur);
            }
        };

        main.setAttribute('tabindex', '-1');
        main.addEventListener('blur', alBlur);
    }
    main.focus();
}

/**
 * «Salta al contenuto», prima di tutto ciò che è dell'`AppShell`: senza il fuoco ha la classe del design system che nasconde,
 * col fuoco sta in alto a sinistra sopra la cornice, coi soli token. Lo stato è suo: il fuoco che entra e che esce non rifà
 * la cornice. È provvisorio: si toglie quando l'`AppShell` porta il suo.
 */
export function SaltaAlContenuto({ testo }: { testo: string }) {
    // Si vede solo mentre ha il fuoco.
    const [colFuoco, setColFuoco] = useState(false);
    const contenitore = useRef<HTMLDivElement>(null);

    return (
        <div
            ref={contenitore}
            className={colFuoco ? undefined : 'zr-visually-hidden'}
            style={colFuoco ? { position: 'fixed', top: 'var(--space-2)', left: 'var(--space-2)', zIndex: 'var(--z-toast)' } : undefined}
            onFocus={() => setColFuoco(true)}
            onBlur={() => setColFuoco(false)}
        >
            <Button variant="secondary" size="sm" onClick={() => fuocoAlContenuto(contenitore.current)}>{testo}</Button>
        </div>
    );
}
