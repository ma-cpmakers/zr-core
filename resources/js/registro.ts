import dati from '../registro/prodotti.json';
import type { IconName, Tone } from '../zeiras/index';

// Il registro dei prodotti di zr-core (resources/registro/prodotti.json): le voci del menu Prodotti nell'ordine della linea guida
// 10 del design system, Dashboard per prima. Come si mostra un prodotto lo dice questo registro, e il suo nome le lingue; il
// backoffice dice solo quali prodotti sono attivi in un workspace.

/** Gli id dei prodotti, Dashboard esclusa: ognuno ha il suo nome in ogni lingua, con l'id per chiave. Un prodotto nuovo entra anche qui. */
export type IdDiProdotto = 'pm' | 'crm' | 'bookings' | 'reports' | 'automations' | 'content';

/** Una voce del menu Prodotti. Il nome sta nelle lingue: il testo `dashboard` per la Dashboard, il testo col suo id per un prodotto. */
export interface VoceDelRegistro {
    /** L'id del design system (`active` e `product` dell'`AppShell`); `home` è la Dashboard. */
    id: 'home' | IdDiProdotto;
    icona: IconName;
    /** Il tono del prodotto; la Dashboard non ce l'ha. */
    tono?: Exclude<Tone, 'neutral'>;
    /** L'indirizzo del prodotto, senza workspace: la cornice ci aggiunge `/w/<slug>`. */
    indirizzo: string;
    /** «Presto»: il prodotto non è ancora disponibile, e la sua voce non porta da nessuna parte. */
    presto: boolean;
}

export const registro: readonly VoceDelRegistro[] = dati.prodotti as VoceDelRegistro[];
