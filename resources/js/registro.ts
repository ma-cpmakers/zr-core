import dati from '../registro/prodotti.json';
import type { IconName, Tone } from '../zeiras/index';

// Il registro dei prodotti di zr-core (resources/registro/prodotti.json): le voci del menu Prodotti nell'ordine della linea guida
// 10 del design system, Dashboard per prima. Come si mostra un prodotto lo dice questo registro; il backoffice dice solo quali
// prodotti sono attivi in un workspace.

/** Una voce del menu Prodotti. */
export interface VoceDelRegistro {
    /** L'id del design system (`active` e `product` dell'`AppShell`); `home` è la Dashboard. */
    id: string;
    /** Il nome del prodotto, uguale in ogni lingua. La Dashboard non ce l'ha: il suo nome è il testo `dashboard` delle lingue. */
    nome?: string;
    icona: IconName;
    /** Il tono del prodotto; la Dashboard non ce l'ha. */
    tono?: Exclude<Tone, 'neutral'>;
    /** L'indirizzo del prodotto, senza workspace: la cornice ci aggiunge `/w/<slug>`. */
    indirizzo: string;
    /** «Presto»: il prodotto non è ancora disponibile, e la sua voce non porta da nessuna parte. */
    presto: boolean;
}

export const registro: readonly VoceDelRegistro[] = dati.prodotti as VoceDelRegistro[];
