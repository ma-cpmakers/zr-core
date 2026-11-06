import type { DatiDellaCornice } from './cornice';
import { FORMA_DI_UN_ID, FORMA_DI_UNO_SLUG } from './forme';
import righe from '../registro/notifiche.json';
import { nelWorkspace, prodottoDelRegistro, raggiungibile, registro, type NotificaDelProdotto } from './registro';

// Dove si apre una notifica. Lo dice il registro dei prodotti, non il codice: le righe dell'app da cui la notifica viene, in
// `resources/registro/notifiche.json` (per id del prodotto), hanno il tipo intero dell'evento e il percorso nel prodotto — o più
// d'uno, in ordine —, coi segnaposto degli id. Dalla `v3.0.0` le righe non stanno nelle voci del registro: le legge solo questo
// modulo, che entra nel pezzo della campanella (`./campanella` lo riesporta), e la cornice lo chiede al clic su una notifica.
// Gli id li porta la notifica (`ids`): dei `dati` dell'evento la parte server dà i soli del percorso che si apre, già
// controllati. Qui si controllano di nuovo, e con loro lo slug, perché ciò che arriva dal browser non entra in un indirizzo
// com'è. Le due forme, di un id e di uno slug, stanno in `forme.ts`.

/** Un segnaposto di un percorso del registro: `{id}`, o `{<nome>_id}`. Lo stesso che la parte server cerca per scegliere gli id di `ids`. */
const SEGNAPOSTO = /\{(id|[a-z][a-z_]*_id)\}/g;

/**
 * L'indirizzo che una notifica apre: la sua risorsa nel prodotto da cui viene, nel workspace dello slug — per una notifica di
 * un contatto del CRM, `https://crm.zeiras.com/w/<slug>/contatti/<id>`. Niente (`undefined`) quando non c'è dove andare, e chi
 * la mostra apre la pagina delle notifiche: l'app della notifica non è un prodotto del registro, o il registro non ha il suo
 * tipo, intero, fra le notifiche di quel prodotto; il prodotto non si può aprire (è «Presto», o nel workspace non è `attivo` né
 * `disponibile`: `prodotti` è lo stato dei prodotti nei dati della cornice); alla notifica manca un id che il percorso chiede,
 * o quell'id non ha la forma di un id; lo slug non ha la forma di uno slug. Mai un indirizzo composto a metà. Un tipo può avere
 * più percorsi, dal più specifico (`percorso`, poi quelli di `altrimenti`): si apre il primo che ha tutti i suoi id — per una
 * nota l'opportunità, poi il contatto, poi l'azienda —, e un percorso senza segnaposto (`/da-fare`) non ne chiede. È la
 * funzione del pannello delle notifiche della cornice: chi mostra le notifiche in una pagina sua apre gli stessi indirizzi.
 */
export function destinazioneDellaNotifica(notifica: { app?: unknown; tipo?: unknown; ids?: unknown }, slug: string, prodotti: DatiDellaCornice['prodotti']): string | undefined {
    // Una notifica che non è di un'app (`app: null`: del workspace, di un invito) si apre nella Dashboard, la prima voce del
    // registro; `app: 'home'` non è un'app che il backoffice dà, e non apre niente.
    const voce = notifica.app === null ? registro[0] : prodottoDelRegistro(typeof notifica.app === 'string' ? notifica.app : undefined);
    const delTipo = (voce && (righe as Record<string, NotificaDelProdotto[] | undefined>)[voce.id])?.find(({ tipo }) => tipo === notifica.tipo);
    if (typeof slug !== 'string' || !FORMA_DI_UNO_SLUG.test(slug) || voce === undefined || delTipo === undefined || voce.presto || (voce.id !== 'home' && !raggiungibile(prodotti[voce.id]))) {
        return undefined;
    }
    const percorso = conGliId([delTipo.percorso, ...(delTipo.altrimenti ?? [])], notifica.ids);

    return percorso === undefined ? undefined : nelWorkspace(voce.indirizzo, slug) + percorso;
}

/**
 * L'indirizzo che apre una notifica da cliente (dalla `v4.24.0`, #3398), nella cornice di chi è solo cliente: la sua pagina in
 * «Il mio spazio» di zr-home, nella voce della Dashboard del registro e fuori da ogni workspace — il cliente non è membro di
 * quello dell'azienda —, per una prenotazione `https://app.zeiras.com/spazio/prenotazioni/<id>`. Si apre solo un percorso
 * che chiede un id e lo trova negli `ids`, che la parte server dà solo a una notifica che il backoffice dice da cliente: per
 * ogni altra, o senza l'id, niente, nemmeno un percorso della Dashboard che non chiede id. L'app della notifica non conta.
 */
export function destinazioneDellaNotificaDelCliente(notifica: { app?: unknown; tipo?: unknown; ids?: unknown }): string | undefined {
    const voce = registro[0];
    const delTipo = voce && (righe as Record<string, NotificaDelProdotto[] | undefined>)[voce.id]?.find(({ tipo }) => tipo === notifica.tipo);
    const percorso = delTipo && conGliId([delTipo.percorso, ...(delTipo.altrimenti ?? [])].filter((uno) => uno.includes('{')), notifica.ids);

    return voce && percorso && voce.indirizzo + percorso;
}

/** Il primo dei percorsi, in ordine, che ha tutti i suoi id negli `ids`, coi segnaposto al loro posto; niente se nessuno li ha. */
export function conGliId(percorsi: string[], ids: unknown): string | undefined {
    for (const percorso of percorsi) {
        let intero = true;
        const pieno = percorso.replace(SEGNAPOSTO, (_segnaposto, chiave: string) => {
            const id: unknown = typeof ids === 'object' && ids !== null && Object.hasOwn(ids, chiave) ? (ids as Record<string, unknown>)[chiave] : undefined;
            if (typeof id !== 'string' || !FORMA_DI_UN_ID.test(id)) {
                intero = false;

                return '';
            }

            return encodeURIComponent(id);
        });
        if (intero) {
            return pieno;
        }
    }

    return undefined;
}
