import inglese from '../lingue/en.json';
import type { AppShellLabels } from '../zeiras/index';

// Le lingue della cornice (resources/lingue): un file per lingua, e il nome del file è il codice. Una lingua nuova è un file in
// più, senza toccare il codice. Dove una lingua non ha un testo si mostra l'inglese di zr-core: per questo i testi si danno
// all'`AppShell` sempre tutti, perché uno che manca lo riempirebbe lui col suo default italiano.

/** I testi della cornice: tutti quelli dell'`AppShell` e quelli di zr-core. */
export type TestiDellaCornice = Required<AppShellLabels> & {
    /** Il titolo del gruppo dei prodotti nel menu. */
    products: string;
    /** Il nome della Dashboard, la prima voce del menu Prodotti. */
    dashboard: string;
};

/** Il ripiego di ogni lingua, quindi con tutti i testi: se all'inglese ne manca uno, tsc si ferma qui. */
const ripiego: TestiDellaCornice = inglese;

/** Le lingue di un elenco di file come lo dà `import.meta.glob`: `{ '../lingue/it.json': { … } }`. */
export function caricaLingue(file: Record<string, Partial<TestiDellaCornice>>) {
    const perCodice = new Map(Object.entries(file).map(([percorso, testi]) => [percorso.replace(/^.*\/|\.json$/g, ''), testi]));

    return {
        /** I codici delle lingue, uno per file. */
        lingue: [...perCodice.keys()] as readonly string[],
        /** I testi in una lingua, sempre tutti: quelli che la lingua non ha, o ha vuoti, e quelli di una lingua che non c'è sono in inglese. */
        testi(lingua: string): TestiDellaCornice {
            const scelti = perCodice.get(lingua) ?? {};
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
