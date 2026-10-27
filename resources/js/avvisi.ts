// I testi dei due avvisi della cornice ridotta, in un pezzo a richiesta (dalla `v3.7.0`): l'accettazione dei documenti legali
// che manca e il backoffice che non risponde. Servono solo in quei due stati, e il JS d'ingresso non li porta: la cornice chiede
// questo pezzo quando i dati dicono uno dei due (`accettazione_richiesta`, il segnale dell'accettazione, `non_letti`), e
// l'avviso sopra la pagina, con la frase di campanella e ricerca spente, c'è quando il pezzo è arrivato. Nessun ingresso
// riesporta niente da qui.

import inglesi from '../lingue/avvisi/en.json';
import { linguaDeiTesti } from './lingue';

/**
 * I testi: stanno in `resources/lingue/avvisi/`, un file per lingua col codice per nome come le lingue della cornice. Il file è
 * quello della lingua dei testi della cornice (`linguaDeiTesti`): una lingua della cornice che lì non ha il suo file, o un testo
 * che manca o è vuoto, si mostra in inglese.
 */
export interface TestiDegliAvvisi {
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
     * Il titolo dell'avviso che la cornice mette sopra la pagina quando la parte server non ha potuto leggere il backoffice
     * (`Cornice::dopo()` con `non_letti`, dalla `v2.1.0`): l'avviso non ha un pulsante, perché non c'è niente da fare se non
     * riprovare.
     */
    downTitle: string;
    /** La frase dello stesso avviso: che cosa manca, e che torna da sé. */
    downText: string;
    /** Ciò che campanella e ricerca dicono in quello stato, al posto dei tre testi dell'`AppShell`, come `acceptanceOff`. */
    downOff: string;
}

const file = import.meta.glob<Partial<TestiDegliAvvisi>>('../lingue/avvisi/*.json', { eager: true, import: 'default' });

/** I testi degli avvisi in una lingua, sempre tutti. */
export function testiDegliAvvisi(lingua: string): TestiDegliAvvisi {
    const scelti = file[`../lingue/avvisi/${linguaDeiTesti(lingua)}.json`] ?? {};

    return Object.fromEntries(Object.entries(inglesi).map(([chiave, inglese]) => [chiave, scelti[chiave as keyof TestiDegliAvvisi]?.trim() || inglese])) as unknown as TestiDegliAvvisi;
}
