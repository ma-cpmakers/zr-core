import { useEffect, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { fileDelleLingue } from './lingue';
import { ToastDellaCornice, type ToastDellaCorniceProps } from './toast';
import inglese from '../lingue/toast/en.json';

// Il Toast di turno (dalla `v5.0.0`, voce #3537, Decisione 23090 di zr-pm-07): il modulo lo chiede con `mostraToast`, e ciò che
// ogni modulo scriveva a modo suo lo fa la cornice. La durata del README del Toast nel design system — 5 secondi, 10 se c'è
// un'azione —, la pausa finché il puntatore è sopra o il fuoco è dentro, «Annulla» nella lingua della pagina, un Toast alla
// volta. Si vede col `ToastDellaCornice`, che resta com'è: in basso al centro, dentro un `Dialog` aperto.

/** Quanto resta un Toast, dal README del Toast nel design system: 5 secondi, 10 se c'è un'azione. */
const DURATA = 5000;
const DURATA_CON_AZIONE = 10_000;

/**
 * Ciò che il modulo mostra: le props del Toast della cornice, senza `onClose` (la chiusura è della cornice: la ✕, l'azione, il
 * tempo, il Toast dopo). Con `onAction` il Toast ha l'azione, e `actionLabel` è facoltativo: senza, o vuoto, il pulsante dice
 * «Annulla» nella lingua della pagina. Senza `onAction` non c'è `actionLabel`: un testo senza pulsante sparirebbe in silenzio.
 */
export type ToastDaMostrare = Omit<ToastDellaCorniceProps, 'onClose' | 'actionLabel' | 'onAction'> &
    ({ onAction?: undefined; actionLabel?: undefined } | { onAction: NonNullable<ToastDellaCorniceProps['onAction']>; actionLabel?: string });

/** Un Toast a schermo: il suo numero, ciò che mostra, e dove era il fuoco quando è comparso, per renderlo a chi lo preme. */
type Turno = { n: number; toast: ToastDaMostrare; prima: HTMLElement | null };

/** I testi del Toast di turno, per lingua: un file loro (`resources/lingue/toast/`), solo nella build di chi lo usa. */
const file = import.meta.glob<typeof inglese>('../lingue/toast/*.json', { eager: true, import: 'default' });

/** «Annulla» nella lingua della pagina (`<html lang>`, che il modulo scrive): in inglese in una lingua che zr-core non ha. */
function annullaNellaLingua(): string {
    const { perCodice, fileDi } = fileDelleLingue(file);
    const scelto = perCodice.get(fileDi(document.documentElement.lang) ?? '')?.undo;

    return scelto?.trim() ? scelto : inglese.undo;
}

// Il Toast a schermo, uno per pagina, e chi lo disegna. Il numero cambia a ogni Toast: quello di prima non chiude il nuovo, né col
// suo tempo né con la sua azione.
let turno: Turno | null = null;
let volte = 0;
const ascolti = new Set<() => void>();
let posto: HTMLDivElement | undefined;

function cambia(nuovo: Turno | null): void {
    turno = nuovo;
    ascolti.forEach((avvisa) => avvisa());
}

const ascolta = (ascolto: () => void) => {
    ascolti.add(ascolto);

    return () => void ascolti.delete(ascolto);
};

/**
 * Mostra un Toast della cornice, al posto di quello che c'è. Non serve montare niente: al primo Toast la cornice si fa un posto
 * suo nel `body`, una radice di React, e lo tiene per i Toast dopo, anche fra una pagina e l'altra. Si chiama dal client (un clic,
 * la risposta di una richiesta), mai durante il disegno sul server.
 */
export function mostraToast(toast: ToastDaMostrare): void {
    if (!posto) {
        posto = document.createElement('div');
        createRoot(posto).render(<ToastDiTurno />);
    }
    if (!posto.isConnected) {
        document.body.append(posto);
    }
    // Il fuoco dentro il Toast che se ne va non è un posto a cui tornare: resta quello di prima.
    const fuoco = document.activeElement instanceof HTMLElement && !document.activeElement.closest('.zr-toast') ? document.activeElement : null;
    cambia({ n: ++volte, toast, prima: fuoco ?? turno?.prima ?? null });
}

/** Toglie subito il Toast di turno, se c'è: per esempio quando ciò che diceva non vale più. */
export function chiudiToast(): void {
    cambia(null);
}

/** Chiude il Toast numero `n`, se è ancora lui: non quello che ha preso il suo posto. */
const chiudiSeE = (n: number) => {
    if (turno?.n === n) {
        cambia(null);
    }
};

/**
 * La ✕ o l'azione del Toast numero `n`, se è ancora lui (un clic che arriva insieme al Toast dopo non vale). Chi la preme da
 * tastiera ritrova il fuoco dove l'aveva quando il Toast è comparso, se quell'elemento c'è ancora: il Toast che si chiude lo
 * lascerebbe al `body`. Poi il Toast si chiude, e l'azione viene dopo: può chiedere lei un Toast nuovo.
 */
const premuto = (n: number, poi?: () => void) => {
    if (turno?.n !== n) {
        return;
    }
    if (document.activeElement?.closest('.zr-toast') && turno.prima?.isConnected) {
        turno.prima.focus();
    }
    chiudiSeE(n);
    poi?.();
};

/**
 * Il Toast di turno. Il tempo parte quando compare e si ferma finché il puntatore è sopra o il fuoco è dentro (chi arriva col Tab
 * su «Annulla»): quando escono riparte intero. Gli eventi del Toast, che si rende in un portale, arrivano qui per l'albero di
 * React. Passare da una parte all'altra dello stesso Toast (dal testo ad «Annulla», da «Annulla» alla ✕) è un'uscita e un'entrata
 * subito dopo: il tempo che l'uscita farebbe partire lo ferma l'entrata.
 */
function ToastDiTurno() {
    const adesso = useSyncExternalStore(ascolta, () => turno, () => null);
    const [sopra, mettiSopra] = useState<number>();
    const [dentro, mettiDentro] = useState<number>();
    const fermo = adesso !== null && (sopra === adesso.n || dentro === adesso.n);

    useEffect(() => {
        if (adesso === null || fermo) {
            return;
        }
        const tempo = setTimeout(() => chiudiSeE(adesso.n), adesso.toast.onAction ? DURATA_CON_AZIONE : DURATA);

        return () => clearTimeout(tempo);
    }, [adesso, fermo]);

    if (adesso === null) {
        return null;
    }
    const { n, toast } = adesso;
    const { onAction, actionLabel, ...resto } = toast;

    return (
        <div
            style={{ display: 'contents' }}
            onPointerOver={() => mettiSopra(n)}
            onPointerOut={() => mettiSopra(undefined)}
            onFocus={() => mettiDentro(n)}
            onBlur={() => mettiDentro(undefined)}
        >
            <ToastDellaCornice
                key={n}
                {...resto}
                {...(onAction
                    ? {
                          actionLabel: actionLabel || annullaNellaLingua(),
                          onAction: () => premuto(n, onAction),
                      }
                    : {})}
                onClose={() => premuto(n)}
            />
        </div>
    );
}
