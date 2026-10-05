import inglese from '../lingue/en.json';
import type { AppShellLabels } from '../zeiras/index';
import type { IdDiProdotto } from './registro';

// Le lingue della cornice (resources/lingue): un file per lingua, e il nome del file è il codice. Una lingua nuova è un file in
// più, senza toccare il codice. Dove una lingua non ha un testo si mostra l'inglese di zr-core: per questo i testi si danno
// all'`AppShell` sempre tutti, perché uno che manca lo riempirebbe lui col suo default italiano.

/** I testi della cornice: tutti quelli dell'`AppShell` e quelli di zr-core, col nome di ogni prodotto del registro per id. */
export type TestiDellaCornice = Required<AppShellLabels> & Record<IdDiProdotto, string> & {
    /** Il titolo del gruppo dei prodotti nel menu. */
    products: string;
    /** Il nome della Dashboard, la prima voce del menu Prodotti. */
    dashboard: string;
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
    };
}

export const { lingue, testi } = caricaLingue(
    import.meta.glob<Partial<TestiDellaCornice>>('../lingue/*.json', { eager: true, import: 'default' }),
);
