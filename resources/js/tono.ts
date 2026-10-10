import type { ShellWorkspace } from '../zeiras/index';

// Il tono di un workspace: il colore del suo pallino nel selettore «Azienda › workspace», e di ovunque un frontend mostri un
// workspace. Il backoffice non dà grafica, quindi lo decide zr-core con una regola sola, dall'id del workspace: l'id non cambia,
// mentre il nome e lo slug sì, e il posto nell'elenco dipende da chi guarda. Così lo stesso workspace ha lo stesso tono in ogni
// prodotto, per ogni persona, a ogni visita. È un nome del design system, non un colore: il colore lo mette il suo CSS.

/** Un tono che il design system ammette per un workspace. */
type TonoDiUnWorkspace = NonNullable<ShellWorkspace['tone']>;

/**
 * I toni fra cui la regola sceglie, nell'ordine del design system. L'elenco e il suo ordine fanno parte della regola: cambiarli
 * cambia il colore dei workspace che ci sono già, in ogni prodotto che installa la versione nuova e non negli altri.
 */
const toni = ['pine', 'citrus', 'coral', 'sky', 'plum'] as const satisfies readonly TonoDiUnWorkspace[];

// Se il design system aggiunge un tono `tsc` si ferma qui (il tono nuovo non sta nell'elenco), e se ne toglie uno si ferma al
// `satisfies` qui sopra: l'elenco non resta indietro in silenzio. Succede anche per un tono nato per un altro componente, perché
// il design system ha un tipo solo per i toni. Allora non si allunga l'elenco per tornare verdi: che cosa fare dei colori dei
// workspace che ci sono già è una scelta di prodotto, e si chiede. I due tipi sono usati dalla funzione qui sotto: un frontend
// compila questo file col suo tsconfig, e una dichiarazione mai usata lì può fermare il suo `tsc`.
type SeStaIn<Elenco, Tono extends Elenco> = Tono;
/** Il tono che la regola dà: uno dell'elenco, che sono tutti quelli del design system. */
type TonoDellaRegola = SeStaIn<(typeof toni)[number], TonoDiUnWorkspace>;

/**
 * Il tono del workspace con quell'id, sempre lo stesso: FNV-1a a 32 bit sui code point dell'id, e il resto della divisione per
 * il numero dei toni sceglie il tono dall'elenco. È la regola del selettore della cornice: chi mostra un workspace in una pagina
 * sua la chiama con lo stesso id e ha lo stesso tono. Un id vuoto, mancante o che non è un testo non ha tono.
 */
export function tonoDelWorkspace(id: string | undefined): TonoDellaRegola | undefined {
    if (typeof id !== 'string' || id === '') {
        return undefined;
    }

    // La base di FNV, poi per ogni code point un XOR e il prodotto per il primo di FNV, tenuto a 32 bit.
    let impronta = 0x811c9dc5;
    for (const carattere of id) {
        impronta = Math.imul(impronta ^ (carattere.codePointAt(0) ?? 0), 0x01000193);
    }

    // `>>> 0`: l'impronta come numero senza segno, o il resto di un numero negativo cadrebbe fuori dall'elenco.
    return toni[(impronta >>> 0) % toni.length];
}
