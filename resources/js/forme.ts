// Le forme che un testo deve avere per entrare in un indirizzo: l'id di una risorsa del backoffice, lo slug di un workspace. Ciò
// che arriva dal browser — una risposta della parte server compresa — non entra in un indirizzo com'è: vale per gli id di una
// notifica e per lo slug che una rotta dice (l'elenco delle notifiche, la ricerca). La forma non è ancora chiesta all'id di un
// risultato della ricerca e allo slug dei dati della pagina: entrano in un indirizzo con `encodeURIComponent`. Stanno in un
// modulo loro perché servono a chi chiama le rotte (`servizi.ts`) e a chi compone la destinazione di una notifica
// (`notifiche.ts`).

/**
 * La forma di un id del backoffice: lettere, cifre, `-` e `_`, da 1 a 64. La stessa che la parte server chiede a ogni id di `ids`,
 * e all'id di una notifica nella rotta della sua lettura: la usa anche `segnaLetta`, prima di chiedere.
 */
export const FORMA_DI_UN_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * La forma dello slug di un workspace nel contratto del backoffice: minuscole e cifre, a pezzi uniti da un trattino. Uno slug
 * vuoto, o `..`, in un indirizzo ne farebbe un altro: `encodeURIComponent` non tocca i punti. Vale per l'indirizzo che una
 * notifica apre e per quello di un risultato della ricerca.
 */
export const FORMA_DI_UNO_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
