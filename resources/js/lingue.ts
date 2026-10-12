import inglese from '../lingue/en.json';
import type { AppShellLabels } from '../zeiras/index';
import { prodottoDelRegistro, type CodiceDelContesto, type IdDiProdotto, type TipoDiRisorsa, type VoceDelRegistro } from './registro';

// Le lingue della cornice (resources/lingue): un file per lingua, e il nome del file è il codice. Una lingua nuova è un file in
// più, senza toccare il codice, se per le non lette le bastano due forme (vedi `unreadOne`). Dove una lingua non ha un testo
// si mostra l'inglese di zr-core: per questo i testi si danno all'`AppShell` sempre tutti, perché uno che manca lo
// riempirebbe lui col suo default italiano.

/**
 * I testi della cornice: tutti quelli dell'`AppShell` e quelli di zr-core, col nome di ogni prodotto del registro per id, quello
 * di ogni risorsa (il gruppo dei risultati della ricerca) per `<voce>.<tipo>`, il nome da elenco della stessa risorsa,
 * minuscolo, per `searchSource.<voce>.<tipo>`, il testo di ogni codice che una chiave di `contesto` può portare (il ruolo di un
 * membro del workspace) per `searchContext.<voce>.<tipo>.<chiave>.<codice>` e il titolo di ogni tipo di notifica per
 * `notificationTitle.<tipo>`.
 */
export type TestiDellaCornice = Required<AppShellLabels> &
    Record<IdDiProdotto, string> &
    Record<TipoDiRisorsa, string> &
    Record<`searchSource.${TipoDiRisorsa}`, string> &
    Record<`searchContext.${CodiceDelContesto}`, string> & {
    /** Il titolo del gruppo dei prodotti nel menu. */
    products: string;
    /** Il nome della Dashboard, la prima voce del menu Moduli. */
    dashboard: string;
    /**
     * Il singolare di `unread`, che è dell'`AppShell` e ha solo il plurale: con una sola non letta la campanella dice «1 non letta».
     * Le forme sono due, e quale vale lo decide la cornice («è una sola?»): una lingua con più forme di plurale non entra con un
     * file solo, finché il design system ha un testo solo per le non lette (README, «La lingua»).
     */
    unreadOne: string;
    /**
     * Il testo del pulsante «Segna tutte come lette» mentre la richiesta è in corso. `markAllRead` è dell'`AppShell`, che per il
     * pulsante ha un testo solo: quale vale lo decide la cornice, come per `unreadOne` (README, «Le notifiche»).
     */
    markingAllRead: string;
    /** Il testo dello stesso pulsante quando la parte server ha detto che ne restano da segnare: il clic continua la lettura. */
    markRestRead: string;
    /**
     * Ciò che l'avviso della cornice dice a chi usa un lettore di schermo quando l'ultima non letta è stata letta con un clic.
     * Con un numero l'avviso dice il nome della campanella, coi testi dell'`AppShell` (`notifications`, `unread`): a zero quel
     * nome non ha un numero da dire (README, «Le notifiche»).
     */
    unreadNone: string;
    /**
     * Il titolo dell'avviso che la cornice mette sopra la pagina a chi non ha ancora accettato i documenti legali in vigore.
     * I quattro testi dell'accettazione non nominano un documento né una versione: quali mancano lo sa la pagina
     * dell'accettazione, che è di zr-home, non la cornice (README, «La cornice»).
     */
    acceptanceTitle: string;
    /** La frase dello stesso avviso: che cosa fare, e che cosa resta spento fino ad allora. */
    acceptanceText: string;
    /** Il pulsante dello stesso avviso: porta alla pagina dell'accettazione. */
    acceptanceAction: string;
    /**
     * Ciò che campanella e ricerca dicono a chi non ha accettato, al posto delle notifiche e dei risultati. L'`AppShell` non
     * ha un testo per «non disponibile»: la cornice gli dà questo al posto dei suoi tre (`notificationsError`, `searchHint`,
     * `searchError`), su una copia.
     */
    acceptanceOff: string;
    /**
     * Il pulsante «Salta al contenuto», il primo elemento della cornice da tastiera: porta il fuoco al contenuto della pagina.
     * L'`AppShell` non ne ha uno suo: finché non lo porta lo scrive la cornice, coi pezzi del design system (README, «La cornice»).
     */
    skipToContent: string;
    /**
     * Il segnaposto del campo di ricerca quando la ricerca ha delle fonti nel workspace: uno solo, uguale in ogni workspace e in
     * ogni modulo, e dalla `v1.17.0` non le nomina (le dice l'invito, `searchHintSources`). `searchPlaceholder`, che è
     * dell'`AppShell`, è quello senza fonti: quale vale lo decide la cornice, come per `unreadOne` (`testiDellaRicerca`; README,
     * «La ricerca»).
     */
    searchPlaceholderSources: string;
    /**
     * L'invito sotto il campo, prima di due caratteri, quando la ricerca ha delle fonti: `{sources}` è il posto dei nomi di
     * tutte. `searchHint`, che è dell'`AppShell`, è quello senza fonti.
     */
    searchHintSources: string;
    /** Il titolo di ripiego di una notifica nel pannello: quello di un tipo che zr-core non conosce, o di una notifica senza tipo. */
    notificationTitle: string;
    /**
     * Il titolo di una notifica di quel tipo, col tipo dell'evento com'è nel backoffice (`notificationTitle.com.zeiras.board.scheda.creata`).
     * Quali tipi zr-core conosce lo dicono le chiavi dell'inglese: un tipo che l'inglese non ha non ha un titolo, in nessuna lingua.
     */
    [delTipo: `notificationTitle.${string}`]: string | undefined;
};

/** Il ripiego di ogni lingua, quindi con tutti i testi: se all'inglese ne manca uno, tsc si ferma qui. */
const ripiego: TestiDellaCornice = inglese;

/** Il codice di una lingua com'è nei nomi dei file: minuscolo, col trattino (`es_ES` → `es-es`). */
function codiceDi(lingua: string): string {
    return lingua.trim().toLowerCase().replace(/_/g, '-');
}

/** Le lingue di un elenco di file come lo dà `import.meta.glob`: `{ '../lingue/it.json': { … } }`. */
export function caricaLingue(file: Record<string, Partial<TestiDellaCornice>>) {
    const perCodice = new Map(Object.entries(file).map(([percorso, testi]) => [codiceDi(percorso.replace(/^.*\/|\.json$/g, '')), testi]));
    // Il codice dell'inglese: il file che `import.meta.glob` dà con lo stesso oggetto del ripiego.
    const codiceDelRipiego = [...perCodice].find(([, testi]) => testi === ripiego)?.[0];

    /** Il codice del file che dà i testi a una lingua: il suo, o quello della lingua base. Nessuno, se zr-core non ce l'ha. */
    const fileDi = (lingua: string): string | undefined => {
        const codice = codiceDi(lingua);

        return [codice, ...codice.split('-', 1)].find((scelto) => perCodice.has(scelto));
    };
    // I testi già composti, per file: il pannello delle notifiche li chiede per ogni notifica, a ogni render. Le lingue che
    // zr-core non ha stanno tutte sotto la stessa chiave, la vuota: ciò che arriva come lingua non fa crescere l'elenco.
    const composti = new Map<string, Readonly<TestiDellaCornice>>();

    return {
        /** I codici delle lingue, uno per file. */
        lingue: [...perCodice.keys()] as readonly string[],
        /**
         * I testi in una lingua, sempre tutti: quelli che la lingua non ha, o ha vuoti, e quelli di una lingua che non c'è sono in
         * inglese. Una variante regionale senza file prende la lingua base: `it-IT`, `IT`, `es_ES`. Si compongono una volta per
         * file, e ogni chiamata dà lo stesso oggetto, congelato: è di tutti quelli che lo chiedono, e non si cambia. Lo dice
         * anche il tipo: una scrittura non passa `tsc`.
         */
        testi(lingua: string): Readonly<TestiDellaCornice> {
            const file = fileDi(lingua);
            const pronti = composti.get(file ?? '');
            if (pronti !== undefined) {
                return pronti;
            }

            const scelti = (file !== undefined && perCodice.get(file)) || {};
            const testi = { ...ripiego };
            for (const chiave of Object.keys(ripiego) as (keyof TestiDellaCornice)[]) {
                const testo = scelti[chiave];
                if (typeof testo === 'string' && testo.trim() !== '') {
                    testi[chiave] = testo;
                }
            }
            composti.set(file ?? '', Object.freeze(testi));

            return testi;
        },
        /**
         * La lingua di `testi(lingua)`: il codice del suo file, della lingua base, o dell'inglese. Date e ore si scrivono con `Intl`
         * in questa lingua, mai in quella del browser, e un codice che `Intl` rifiuta (`it_IT`) non gli arriva.
         */
        linguaDeiTesti(lingua: string): string | undefined {
            return fileDi(lingua) ?? codiceDelRipiego;
        },
    };
}

export const { lingue, testi, linguaDeiTesti } = caricaLingue(
    import.meta.glob<Partial<TestiDellaCornice>>('../lingue/*.json', { eager: true, import: 'default' }),
);

/** Il nome di una voce del registro in una lingua: la Dashboard ha il testo `dashboard`, un prodotto il testo col suo id. */
export function nomeDellaVoce(voce: Pick<VoceDelRegistro, 'id'>, lingua: string): string {
    const t = testi(lingua);

    return voce.id === 'home' ? t.dashboard : t[voce.id];
}

/** Il posto dei nomi delle fonti nell'invito della ricerca che le nomina (`searchHintSources`). */
const POSTO_DELLE_FONTI = '{sources}';

/**
 * Il segnaposto del campo di ricerca e l'invito che si legge prima di due caratteri, in una lingua, per le fonti della ricerca
 * in un workspace (`fontiDellaRicerca`): i due testi dell'`AppShell` che la cornice sceglie. Il segnaposto è uno solo dove la
 * ricerca ha delle fonti, e non le nomina: è lo stesso in ogni workspace e in ogni modulo. Le nomina l'invito: ogni fonte ha
 * nella lingua il suo nome da elenco (`searchSource.<voce>.<tipo>`), e l'invito le dice tutte, unite come la lingua unisce un
 * elenco, con la sua congiunzione («schede, board e cartelle»). Senza fonti sono i due testi della lingua che non promettono
 * niente. L'elenco lo scrive `Intl` nella lingua dei testi, mai in quella del browser. Un browser può non avere
 * `Intl.ListFormat` anche quando ha il resto di `Intl`: lì l'invito è quello senza fonti, quante che siano le fonti, il
 * segnaposto resta quello unico, e niente lancia.
 */
export function testiDellaRicerca(lingua: string, fonti: readonly TipoDiRisorsa[]): Pick<TestiDellaCornice, 'searchPlaceholder' | 'searchHint'> {
    const t = testi(lingua);
    if (fonti.length === 0) {
        return { searchPlaceholder: t.searchPlaceholder, searchHint: t.searchHint };
    }
    if (typeof Intl.ListFormat !== 'function') {
        return { searchPlaceholder: t.searchPlaceholderSources, searchHint: t.searchHint };
    }
    const nomi = fonti.map((fonte) => t[`searchSource.${fonte}`]);
    const elenco = new Intl.ListFormat(linguaDeiTesti(lingua), { type: 'conjunction' });

    return {
        searchPlaceholder: t.searchPlaceholderSources,
        searchHint: t.searchHintSources.replace(POSTO_DELLE_FONTI, () => elenco.format(nomi)),
    };
}

/**
 * Il titolo di una notifica in una lingua: quello del suo tipo, fra i testi della lingua (`notificationTitle.<tipo>`). Quali tipi
 * zr-core conosce lo dicono le lingue, non il codice: un tipo che non hanno — nuovo nel contratto, vuoto, mancante, o che non è
 * un testo — ha il titolo di ripiego, e il codice del tipo non si mostra mai. È la funzione del pannello delle notifiche della
 * cornice: chi mostra le notifiche in una pagina sua ha lo stesso testo.
 */
export function titoloDellaNotifica(tipo: unknown, lingua: string): string {
    const t = testi(lingua);
    const delTipo = typeof tipo === 'string' ? t[`notificationTitle.${tipo}`] : undefined;

    return typeof delTipo === 'string' && delTipo !== '' ? delTipo : t.notificationTitle;
}

/** Così comincia il tipo di una notifica su un'app (`com.zeiras.app.modificata`): la cosa a cui si riferisce è un prodotto. */
const TIPO_SU_UN_APP = 'com.zeiras.app.';

/**
 * Il nome della cosa a cui si riferisce una notifica, in una lingua: la riga sotto il titolo. È il suo `risorsa_nome`, senza gli
 * spazi intorno. Per una notifica su un'app (un tipo `com.zeiras.app.…`) il backoffice dà lì il codice dell'app (`pm`), e il nome
 * è quello che il prodotto ha nel registro e nelle lingue, anche per un prodotto «Presto» o non attivo nel workspace: un codice che
 * il registro non ha, o la Dashboard, non dà niente, e il codice non si mostra mai. Niente (`undefined`) anche quando il nome non
 * c'è: `null`, vuoto, di soli spazi, senza la chiave, o un valore che non è un testo. È la funzione del pannello delle notifiche
 * della cornice: chi mostra le notifiche in una pagina sua ha lo stesso testo.
 */
export function risorsaDellaNotifica(notifica: { tipo?: unknown; risorsa_nome?: unknown }, lingua: string): string | undefined {
    const nome = typeof notifica.risorsa_nome === 'string' ? notifica.risorsa_nome.trim() : '';
    if (nome === '') {
        return undefined;
    }
    if (typeof notifica.tipo !== 'string' || !notifica.tipo.startsWith(TIPO_SU_UN_APP)) {
        return nome;
    }
    const prodotto = prodottoDelRegistro(nome);

    return prodotto && nomeDellaVoce(prodotto, lingua);
}
