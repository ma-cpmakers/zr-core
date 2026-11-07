// I testi dei due avvisi della cornice ridotta, in un pezzo a richiesta (dalla `v3.7.0`): l'accettazione dei documenti legali
// che manca e il backoffice che non risponde. Servono solo in quei due stati, e il JS d'ingresso non li porta: la cornice chiede
// questo pezzo quando i dati dicono uno dei due (`accettazione_richiesta`, il segnale dell'accettazione, `non_letti`), e
// l'avviso sopra la pagina, con la frase di campanella e ricerca spente, c'è quando il pezzo è arrivato. Nessun ingresso
// riesporta niente da qui. Dalla `v4.8.1` (#3055, Decisione 21220) il pezzo porta anche l'Alert del design system, dal suo
// modulo: l'avviso è il solo posto della cornice che lo usa, e il JS d'ingresso non lo porta più. Dalla `v4.22.0` (#2909) porta
// anche i testi della fascia di assistenza, che la cornice mette sopra la pagina quando lo staff è entrato con «Accedi come»: la
// cornice chiede il pezzo anche quando i dati hanno `assistenza`. Dalla `v4.25.0` (#3417) porta anche «Il mio spazio» per il selettore
// della cornice dei membri, i due testi e il clic: la cornice chiede il pezzo anche quando il frontend le dà `spazio`.

import { createElement as h, type MouseEvent } from 'react';
import inglesi from '../lingue/avvisi/en.json';
import type { DatiDellaCornice } from './cornice';
import { linguaDeiTesti } from './lingue';
import { Alert } from './zeiras/Alert';
import { Button } from './zeiras/componenti';

export { Alert };

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
    /**
     * Il titolo della fascia di assistenza (dalla `v4.22.0`, #2909): chi è la persona assistita, `{name}` col nome e il cognome.
     * La fascia non si chiude: resta finché dura l'assistenza, anche nella cornice ridotta, sopra l'avviso.
     */
    assistTitle: string;
    /** Il testo della stessa fascia: `{email}` della persona, e che le modifiche valgono come fatte da lei, `{firstName}` col nome. */
    assistText: string;
    /** Il testo della stessa fascia quando l'assistenza è di sola lettura, al posto di `assistText`. */
    assistReadOnly: string;
    /** Il pulsante della stessa fascia: termina l'assistenza uscendo, come «Esci» (`onLogout`). */
    assistEnd: string;
    /**
     * La voce dello spazio del cliente nel selettore dei workspace (dalla `v4.25.0`, #3417): la cornice dei membri la mostra in
     * cima al selettore quando il frontend le dà `spazio`, cioè quando la persona è anche cliente di un'azienda con lo spazio acceso.
     */
    personal: string;
    /** Il titolo del gruppo di quella voce, sopra le aziende. */
    personalGroup: string;
}

const file = import.meta.glob<Partial<TestiDegliAvvisi>>('../lingue/avvisi/*.json', { eager: true, import: 'default' });

/** I testi degli avvisi in una lingua, sempre tutti. */
export function testiDegliAvvisi(lingua: string): TestiDegliAvvisi {
    const scelti = file[`../lingue/avvisi/${linguaDeiTesti(lingua)}.json`] ?? {};

    return Object.fromEntries(Object.entries(inglesi).map(([chiave, inglese]) => [chiave, scelti[chiave as keyof TestiDegliAvvisi]?.trim() || inglese])) as unknown as TestiDegliAvvisi;
}

/**
 * «Il mio spazio» per il selettore della cornice dei membri (dalla `v4.25.0`, #3417): la voce dell'`AppShell` (`personal`), non
 * attiva, che punta a `href`, e il titolo del suo gruppo (`personalGroup` in `labels`, fra i testi dell'`AppShell`). Un clic semplice su un
 * indirizzo di questa origine passa da `naviga`, come le voci della barra: Ctrl, Cmd, Maiusc, Alt, il tasto centrale e un'altra
 * origine restano del browser. Sta qui e non nella cornice perché serve solo a chi ha lo spazio.
 */
export function ilMioSpazio(lingua: string, href: string, naviga: (indirizzo: string) => void) {
    const t = testiDegliAvvisi(lingua);

    return {
        personal: {
            label: t.personal,
            href,
            onSelect: (clic: MouseEvent) => {
                const a = clic.currentTarget as HTMLAnchorElement;
                if (!clic.defaultPrevented && !clic.button && !clic.ctrlKey && !clic.metaKey && !clic.shiftKey && !clic.altKey && a.host === location.host && a.protocol === location.protocol) {
                    clic.preventDefault();
                    naviga(a.href);
                }
            },
        },
        labels: { personalGroup: t.personalGroup },
    };
}

/**
 * La fascia di assistenza in una lingua: l'Alert del design system, tono `warning`, coi nomi e l'email della persona assistita, e il
 * pulsante che termina l'assistenza chiamando `onLogout`. Sta qui e non nella cornice perché serve solo in assistenza.
 */
export function FasciaDiAssistenza({ lingua, assistenza: { persona: { nome, cognome, email }, sola_lettura }, onLogout }: { lingua: string; assistenza: NonNullable<DatiDellaCornice['assistenza']>; onLogout: () => void }) {
    const t = testiDegliAvvisi(lingua);
    const con = (frase: string) => frase.replace(/\{(name|email|firstName)\}/g, (_posto, chi: string) => (chi === 'name' ? [nome, cognome].filter(Boolean).join(' ') : chi === 'email' ? email : nome));

    return h(Alert, { tone: 'warning', title: con(t.assistTitle), action: h(Button, { variant: 'secondary', size: 'sm', onClick: onLogout }, t.assistEnd) }, con(sola_lettura ? t.assistReadOnly : t.assistText));
}
