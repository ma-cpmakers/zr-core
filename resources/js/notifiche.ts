import type { DatiDellaCornice } from './cornice';
import { nelWorkspace, prodottoDelRegistro, raggiungibile } from './registro';

// Dove si apre una notifica. Lo dice il registro dei prodotti, non il codice: la voce dell'app da cui la notifica viene ha, fra
// le sue `notifiche`, il tipo intero dell'evento e il percorso nel prodotto, coi segnaposto degli id. Gli id li porta la notifica
// (`ids`): dei `dati` dell'evento la parte server dà i soli che questo percorso chiede, già controllati. Qui si controllano di
// nuovo, e con loro lo slug, perché ciò che arriva dal browser non entra in un indirizzo com'è.

/** La forma di un id del backoffice: lettere, cifre, `-` e `_`, da 1 a 64. La stessa che la parte server chiede a ogni id di `ids`. */
const FORMA_DI_UN_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Un segnaposto di un percorso del registro: `{id}`, o `{<nome>_id}`. Lo stesso che la parte server cerca per scegliere gli id di `ids`. */
const SEGNAPOSTO = /\{(id|[a-z][a-z_]*_id)\}/g;

/**
 * La forma dello slug di un workspace nel contratto del backoffice: minuscole e cifre, a pezzi uniti da un trattino. Uno slug
 * vuoto, o `..`, in un indirizzo ne farebbe un altro: `encodeURIComponent` non tocca i punti.
 */
const FORMA_DI_UNO_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * L'indirizzo che una notifica apre: la sua risorsa nel prodotto da cui viene, nel workspace dello slug — per una notifica di
 * un contatto del CRM, `https://crm.zeiras.com/w/<slug>/contatti/<id>`. Niente (`undefined`) quando non c'è dove andare, e chi
 * la mostra apre la pagina delle notifiche: l'app della notifica non è un prodotto del registro, o il registro non ha il suo
 * tipo, intero, fra le notifiche di quel prodotto; il prodotto non si può aprire (è «Presto», o nel workspace non è `attivo` né
 * `disponibile`: `prodotti` è lo stato dei prodotti nei dati della cornice); alla notifica manca un id che il percorso chiede,
 * o quell'id non ha la forma di un id; lo slug non ha la forma di uno slug. Mai un indirizzo composto a metà. È la funzione del
 * pannello delle notifiche della cornice: chi mostra le notifiche in una pagina sua apre gli stessi indirizzi.
 */
export function destinazioneDellaNotifica(notifica: { app?: unknown; tipo?: unknown; ids?: unknown }, slug: string, prodotti: DatiDellaCornice['prodotti']): string | undefined {
    const voce = prodottoDelRegistro(typeof notifica.app === 'string' ? notifica.app : undefined);
    const percorso = voce?.notifiche?.find(({ tipo }) => tipo === notifica.tipo)?.percorso;
    if (typeof slug !== 'string' || !FORMA_DI_UNO_SLUG.test(slug) || voce === undefined || voce.id === 'home' || percorso === undefined || voce.presto || !raggiungibile(prodotti[voce.id])) {
        return undefined;
    }
    const { ids } = notifica;
    let intero = true;
    const conGliId = percorso.replace(SEGNAPOSTO, (_segnaposto, chiave: string) => {
        const id: unknown = typeof ids === 'object' && ids !== null && Object.hasOwn(ids, chiave) ? (ids as Record<string, unknown>)[chiave] : undefined;
        if (typeof id !== 'string' || !FORMA_DI_UN_ID.test(id)) {
            intero = false;

            return '';
        }

        return encodeURIComponent(id);
    });

    return intero ? nelWorkspace(voce.indirizzo, slug) + conGliId : undefined;
}
