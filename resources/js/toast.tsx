import { createPortal } from 'react-dom';
import { Toast } from './zeiras/componenti';
import type { Toast as TipoDelToast } from '../zeiras/index';

// Il `Toast` della cornice (dalla `v3.17.0`, voce #2910): quello del design system com'è, già messo al suo posto. In basso al
// centro su tutte le larghezze, a `--space-5` dal fondo più il bordo sicuro del telefono, a `--z-toast`, sopra dialoghi,
// pannelli e cassetto (Decisioni 19935 e 19940 di zr-pm). La durata resta di chi lo mostra.

export type ToastDellaCorniceProps = Parameters<typeof TipoDelToast>[0];

/**
 * Si rende nel `body`, non dove lo mette la pagina: un antenato con `transform` — un pannello che scorre — sposterebbe un
 * `position: fixed`, e un contenitore con `overflow` lo taglierebbe. Lo stile sta sull'elemento, coi soli token.
 */
export function ToastDellaCornice(props: ToastDellaCorniceProps) {
    return createPortal(
        <div
            style={{
                position: 'fixed',
                left: '50%',
                transform: 'translateX(-50%)',
                bottom: 'calc(var(--space-5) + env(safe-area-inset-bottom, 0px))',
                zIndex: 'var(--z-toast)',
                maxWidth: 'calc(100vw - 2 * var(--space-4))',
            }}
        >
            <Toast {...props} />
        </div>,
        document.body,
    );
}
