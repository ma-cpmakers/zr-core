// I testi dei due avvisi della cornice ridotta, in un pezzo a richiesta (dalla `v3.7.0`): l'accettazione dei documenti legali
// che manca e il backoffice che non risponde. Servono solo in quei due stati, e il JS d'ingresso non li porta: la cornice chiede
// questo pezzo quando i dati dicono uno dei due (`accettazione_richiesta`, il segnale dell'accettazione, `non_letti`), e
// l'avviso sopra la pagina, con la frase di campanella e ricerca spente, c'è quando il pezzo è arrivato. Nessun ingresso
// riesporta niente da qui. Dalla `v4.8.1` (#3055, Decisione 21220) il pezzo porta anche l'Alert del design system, dal suo
// modulo: l'avviso è il solo posto della cornice che lo usa, e il JS d'ingresso non lo porta più. Dalla `v4.22.0` (#2909) porta
// anche i testi della fascia di assistenza, che la cornice mette sopra la pagina quando lo staff è entrato con «Accedi come»: la
// cornice chiede il pezzo anche quando i dati hanno `assistenza`; dalla `v4.34.0` (#3723) la fascia è la barra citrus del design di
// admin, sopra l'`AppShell` e non più un Alert nel contenuto. Dalla `v4.25.0` (#3417) porta anche «Il mio spazio» per il selettore
// della cornice dei membri, i due testi e il clic: la cornice chiede il pezzo anche quando il frontend le dà `spazio`. Dalla
// `v4.34.0` porta anche gli stili della fascia (resources/css/assistenza.css): servono solo in assistenza, e il CSS di ogni pagina
// non li porta (zr-pm-74, 14/11). La build di chi installa ne fa il CSS di questo pezzo, che arriva prima che il pezzo giri.

import '../css/assistenza.css';
import { createElement as h, type MouseEvent } from 'react';
import inglesi from '../lingue/avvisi/en.json';
import type { DatiDellaCornice } from './cornice';
import { linguaDeiTesti } from './lingue';
import { Alert } from './zeiras/Alert';
import { Button, Icon } from './zeiras/componenti';

// Il CSS di questo pezzo lo chiede il caricatore della build insieme al pezzo, e se non arriva il pezzo non arriva: la cornice lo
// richiede (`pezzoARichiesta`), ma dal secondo tentativo importa il solo JS, e il caricatore non richiede più un CSS che ha già
// visto. Quando questo modulo gira, un foglio di stile della pagina che non si è caricato si richiede una volta,
// accanto al suo, con `?r=1` come il JS: senza, la fascia di assistenza resterebbe senza stili (revisione della v4.34.0, R2). Al
// primo tentativo riuscito non ce n'è nessuno, e non succede niente. Quello vecchio resta: uno ancora in arrivo, di un altro
// pezzo, arriva lo stesso, e il caricatore che lo aspetta non resta fermo. Uno spento (`disabled`) non si tocca. Non caricato
// vuol dire senza `sheet`, o con uno di cui non si leggono le regole: Chromium, a un foglio che non è arrivato, ne dà uno vuoto
// che alla lettura lancia `SecurityError` (provato nella UAT della v4.34.1).
document.querySelectorAll<HTMLLinkElement>('link[rel=stylesheet]:not([disabled])').forEach((link) => {
    try {
        void link.sheet!.cssRules;
    } catch {
        link.after(Object.assign(link.cloneNode(), { href: `${link.href}?r=1` }));
    }
});

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
     * La prima riga della fascia di assistenza (dalla `v4.22.0`, #2909): chi è la persona assistita, `{name}` col nome e il cognome,
     * che la fascia mette in grassetto; dalla `v4.34.0` (#3723) l'email le segue, e dalla `v4.34.1` sta dove il titolo dice `{email}`. La fascia non si chiude: resta finché
     * dura l'assistenza, anche nella cornice ridotta, sopra l'`AppShell`.
     */
    assistTitle: string;
    /** La riga piccola della stessa fascia: che le modifiche valgono come fatte dalla persona, `{firstName}` col nome (dalla `v4.34.0` senza l'email, che sta nella prima riga). */
    assistText: string;
    /** Il testo della stessa fascia quando l'assistenza è di sola lettura, al posto di `assistText`. */
    assistReadOnly: string;
    /** Il pulsante della stessa fascia: «Termina e torna al backoffice», dal design di admin (dalla `v4.34.0`); esce come «Esci» (`onLogout`). */
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
 * La fascia di assistenza in una lingua (dalla `v4.34.0`, #3723: come nel design di admin): la barra citrus a tutta larghezza che
 * la cornice mette sopra l'`AppShell`, fuori dal contenuto — l'icona della persona, «Stai usando Zeiras come **Nome Cognome** ·
 * email», sotto in piccolo che cosa valgono le modifiche (o che è sola lettura), e il pulsante che termina l'assistenza chiamando
 * `onLogout`. Gli stili stanno in `resources/css/assistenza.css`, importato in cima a questo pezzo. Sta qui e non nella cornice perché serve solo in assistenza.
 */
export function FasciaDiAssistenza({ lingua, assistenza: { persona: { nome, cognome, email }, sola_lettura }, onLogout }: { lingua: string; assistenza: NonNullable<DatiDellaCornice['assistenza']>; onLogout: () => void }) {
    const t = testiDegliAvvisi(lingua);
    // Il nome intero va in grassetto dove il titolo lo dice (`{name}`), e l'email dove dice `{email}`: il separatore e l'ordine sono
    // del testo, non del codice (revisione della v4.34.0, R5). Un titolo senza `{name}` si mostra com'è, senza il nome.
    const [prima, dopo = ''] = t.assistTitle.split('{name}');

    return h('div', { className: 'zr-assist-bar', role: 'status' },
        h(Icon, { name: 'user', size: 18 }),
        h('span', null,
            h('span', null, prima, h('strong', null, [nome, cognome].filter(Boolean).join(' ')), dopo.replace('{email}', email)),
            h('span', null, (sola_lettura ? t.assistReadOnly : t.assistText).replace('{firstName}', nome))),
        h(Button, { variant: 'secondary', size: 'sm', icon: 'close', onClick: onLogout }, t.assistEnd));
}
