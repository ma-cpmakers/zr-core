import inglese from '../lingue/en.json';
import type { AppShellLabels } from '../zeiras/index';
import type { IdDiProdotto, TipoDiRisorsa, VoceDelRegistro } from './registro';

// Le lingue della cornice (resources/lingue): un file per lingua, e il nome del file è il codice. Una lingua nuova è un file in
// più, senza toccare il codice. Dove una lingua non ha un testo si mostra l'inglese di zr-core: per questo i testi si danno
// all'`AppShell` sempre tutti, perché uno che manca lo riempirebbe lui col suo default italiano.

/**
 * I testi della cornice: tutti quelli dell'`AppShell` e quelli di zr-core, col nome di ogni prodotto del registro per id, quello
 * di ogni sua risorsa (il gruppo dei risultati della ricerca) per `<prodotto>.<tipo>` e il titolo di ogni tipo di notifica per
 * `notificationTitle.<tipo>`.
 */
export type TestiDellaCornice = Required<AppShellLabels> & Record<IdDiProdotto, string> & Record<TipoDiRisorsa, string> & {
    /** Il titolo del gruppo dei prodotti nel menu. */
    products: string;
    /** Il nome della Dashboard, la prima voce del menu Prodotti. */
    dashboard: string;
    /** Il singolare di `unread`, che è dell'`AppShell` e ha solo il plurale: con una sola non letta la campanella dice «1 non letta». */
    unreadOne: string;
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

    return {
        /** I codici delle lingue, uno per file. */
        lingue: [...perCodice.keys()] as readonly string[],
        /**
         * I testi in una lingua, sempre tutti: quelli che la lingua non ha, o ha vuoti, e quelli di una lingua che non c'è sono in
         * inglese. Una variante regionale senza file prende la lingua base: `it-IT`, `IT`, `es_ES`.
         */
        testi(lingua: string): TestiDellaCornice {
            const codice = codiceDi(lingua);
            const scelti = perCodice.get(codice) ?? perCodice.get(codice.split('-')[0]) ?? {};
            const testi = { ...ripiego };
            for (const chiave of Object.keys(ripiego) as (keyof TestiDellaCornice)[]) {
                const testo = scelti[chiave];
                if (typeof testo === 'string' && testo.trim() !== '') {
                    testi[chiave] = testo;
                }
            }

            return testi;
        },
        /**
         * La lingua di `testi(lingua)`: il codice del suo file, della lingua base, o dell'inglese. Date e ore si scrivono con `Intl`
         * in questa lingua, mai in quella del browser, e un codice che `Intl` rifiuta (`it_IT`) non gli arriva.
         */
        linguaDeiTesti(lingua: string): string | undefined {
            const codice = codiceDi(lingua);

            return [codice, codice.split('-')[0]].find((scelto) => perCodice.has(scelto)) ?? codiceDelRipiego;
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
