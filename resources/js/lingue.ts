import { useEffect, useState } from 'react';
import italiano from '../lingue/it.json';
import type { AppShellLabels } from '../zeiras/index';
import type { IdDiProdotto, TipoDellaRicerca, TipoDiRisorsa, VoceDelRegistro } from './registro';

// Le lingue della cornice (resources/lingue): un file per lingua, e il nome del file è il codice. Una lingua nuova è un file in
// più, senza toccare il codice, se per le non lette le bastano due forme (vedi `unreadOne`). Dove una lingua non ha un testo
// si mostra l'inglese di zr-core: per questo i testi si danno all'`AppShell` sempre tutti, perché uno che manca lo
// riempirebbe lui col suo default italiano.

/**
 * I testi della cornice: tutti quelli dell'`AppShell` e quelli di zr-core, col nome di ogni prodotto del registro per id, quello
 * di ogni risorsa (il gruppo dei risultati della ricerca) per `<voce>.<tipo>`, il nome da elenco della stessa risorsa,
 * minuscolo, per `searchSource.<voce>.<tipo>` (anche delle risorse di `resources/registro/ricerca.json`, `TipoDellaRicerca`). Il testo
 * di ogni codice che una chiave di `contesto` può portare (il ruolo di un membro del workspace) non è qui dalla `v3.9.0`: sta coi
 * testi del pezzo della ricerca, in `resources/lingue/ricerca/`, perché lo mostra solo una riga dei risultati. Le frasi delle
 * notifiche non sono qui: stanno in un file loro (`FrasiDelleNotifiche`), che la cornice carica quando si apre la campanella.
 * Non ci sono nemmeno i due testi dell'`AppShell` che mostra solo la ricerca all'invio (`searchOn: 'submit'`, dalla `v4.2.0`), che la
 * cornice non chiede, né quelli del modulo «Da attivare» (`off`) e di «Impostazioni del workspace» (`workspaceSettings`, dal lotto
 * 0512 del design system): la cornice non segna moduli `off` e non passa le impostazioni del workspace.
 */
export type TestiDellaCornice = Required<Omit<AppShellLabels, 'searchSubmitHint' | 'searchPressEnter' | 'off' | 'workspaceSettings'>> &
    Record<IdDiProdotto, string> &
    Record<TipoDiRisorsa, string> &
    Record<`searchSource.${TipoDiRisorsa | TipoDellaRicerca}`, string> & {
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
     * Il pulsante «Salta al contenuto», il primo elemento della cornice da tastiera: porta il fuoco al contenuto della pagina.
     * L'`AppShell` non ne ha uno suo: finché non lo porta lo scrive la cornice, coi pezzi del design system (README, «La cornice»).
     */
    skipToContent: string;
    /**
     * Il nome del contenuto della pagina, il `main` dell'`AppShell`, che i rimedi mettono nel giro del Tab perché chi usa la
     * tastiera lo faccia scorrere: l'`AppShell` non gli dà né il fuoco né un nome (provvisorio, dalla `v2.25.2`; README, «La cornice»).
     */
    mainContent: string;
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
};

/**
 * Le frasi delle notifiche di una lingua (resources/lingue/notifiche, un file per lingua con lo stesso nome del file dei testi).
 * Non stanno coi testi della cornice perché servono solo a pannello aperto: la cornice le carica allora (`caricaFrasi`), e chi
 * mostra le notifiche in una pagina sua le ha da `./frasi`.
 */
export type FrasiDelleNotifiche = {
    /**
     * Il titolo di una notifica di quel tipo, col tipo dell'evento com'è nel backoffice (`notificationTitle.com.zeiras.board.scheda.creata`).
     * Quali tipi zr-core conosce lo dicono le chiavi dell'inglese: un tipo che l'inglese non ha non ha un titolo, in nessuna lingua.
     */
    [delTipo: `notificationTitle.${string}`]: string | undefined;
    /**
     * Il titolo di una notifica di quel tipo quando il backoffice dice chi ha fatto e su che cosa: una frase, con `{who}` al posto
     * del nome di chi e `{what}` al posto del nome della cosa (`rigaConLeFrasi`). La ha chi ha anche il titolo.
     */
    [conChiECosa: `notificationTitleWhoWhat.${string}`]: string | undefined;
    /**
     * La frase di una notifica senza chi, col nome della cosa e la data di `quando` (dalla `v3.6.0`): il solo giorno al posto di
     * `{date}` («Certificato medico scade il 3 novembre 2026»), il giorno e l'ora nel suo fuso al posto di `{when}` («Nuova
     * prenotazione: Personal training, mer 4 nov, 10:00»).
     */
    [conCosaEData: `notificationTitleWhatWhen.${string}`]: string | undefined;
    /** La frase con la sola data, il giorno e l'ora di `quando` al posto di `{when}`, per quando il nome della cosa non c'è (dalla `v3.6.0`): «Nuova prenotazione, mer 4 nov, 10:00». */
    [conLaData: `notificationTitleWhen.${string}`]: string | undefined;
    /** La stessa frase senza il nome della cosa, col solo `{who}`: per quando il nome non c'è, o per un tipo di cui il backoffice non dà il nome. La ha ogni tipo che ha il titolo, fuori dai tre di Bookings, che non dicono mai chi (dalla `v3.6.0`). */
    [conChi: `notificationTitleWho.${string}`]: string | undefined;
    /**
     * La riga sotto il titolo quando lì non c'è il nome della cosa: quante azioni la notifica racconta e in quale board sta la
     * cosa (`notificationUnder.countBoard`, con `{n}` e `{board}`), il solo conto (`notificationUnder.count`), la sola board
     * (`notificationUnder.board`).
     */
    [diSotto: `notificationUnder.${string}`]: string | undefined;
};

/**
 * La lingua dell'ingresso, l'italiano (dalla `v4.4.0`, Decisione 20618 di zr-pm: la lingua di quasi tutte le persone di Zeiras):
 * la sola che sta nel JS d'ingresso, quindi con tutti i testi: se all'italiano ne manca uno, tsc si ferma qui.
 */
const dellIngresso: TestiDellaCornice = italiano;
/** Il codice di una lingua dal percorso del suo file (`'../lingue/es.json'` → `es`). */
const codiceDelFile = (percorso: string) => codiceDi(percorso.replace(/^.*\/|\.json$/g, ''));
/** Il codice della lingua dell'ingresso e quello del ripiego, dai loro file. */
export const DELL_INGRESSO = codiceDelFile('../lingue/it.json');
const DEL_RIPIEGO = codiceDelFile('../lingue/en.json');
/** L'inglese, il ripiego dei testi che mancano a una lingua: niente finché non è arrivato. */
let inglese: Partial<TestiDellaCornice> | undefined;

/** Il codice di una lingua com'è nei nomi dei file: minuscolo, col trattino (`es_ES` → `es-es`). */
function codiceDi(lingua: string): string {
    return lingua.trim().toLowerCase().replace(/_/g, '-');
}

/**
 * I file di una cartella di lingue come li dà `import.meta.glob` (`{ '../lingue/it.json': … }`), per codice, e il codice del
 * file che serve una lingua: il suo, o quello della lingua base. Nessuno, se zr-core non ce l'ha.
 */
export function fileDelleLingue<Uno>(file: Record<string, Uno>) {
    const perCodice = new Map(Object.entries(file).map(([percorso, uno]) => [codiceDelFile(percorso), uno]));

    return {
        perCodice,
        fileDi(lingua: string): string | undefined {
            const codice = codiceDi(lingua);

            return [codice, codice.split('-')[0]!].find((scelto) => perCodice.has(scelto));
        },
    };
}

/**
 * Le lingue di un elenco di file: quelli già in memoria (`file`, come li dà `import.meta.glob` con `eager`:
 * `{ '../lingue/it.json': { … } }`) e quelli che arrivano a richiesta (`aRichiesta`, un file per percorso, dalla `v4.4.0`).
 */
export function caricaLingue(file: Record<string, Partial<TestiDellaCornice>>, aRichiesta: Record<string, () => Promise<Partial<TestiDellaCornice>>> = {}) {
    const { perCodice, fileDi } = fileDelleLingue<Partial<TestiDellaCornice> | (() => Promise<Partial<TestiDellaCornice>>)>({ ...aRichiesta, ...file });
    // I file arrivati, per codice: quelli in memoria da subito, e quelli a richiesta quando arrivano.
    const arrivati = new Map(Object.entries(file).map(([percorso, testi]) => [codiceDelFile(percorso), testi]));
    const inVolo = new Map<string, Promise<unknown>>();
    // I testi già composti, per file: il pannello delle notifiche li chiede per ogni notifica, a ogni render. Le lingue che
    // zr-core non ha stanno tutte sotto la stessa chiave, la vuota: ciò che arriva come lingua non fa crescere l'elenco.
    const composti = new Map<string, Readonly<TestiDellaCornice>>();
    // L'inglese di questo elenco, se ne ha il file; altrimenti quello della cornice, quando è arrivato.
    const ripiego = () => (perCodice.has(DEL_RIPIEGO) ? arrivati.get(DEL_RIPIEGO) : inglese);
    const pronta = (lingua: string) => {
        const codice = fileDi(lingua);

        return codice === DELL_INGRESSO || ((codice === undefined || arrivati.has(codice)) && ripiego() !== undefined);
    };
    /** Un file a richiesta, una richiesta sola alla volta: arrivato resta, non arrivato si richiede alla chiamata dopo. */
    const chiedi = (codice: string): Promise<unknown> | undefined => {
        const chiesto = perCodice.get(codice);
        if (arrivati.has(codice) || typeof chiesto !== 'function') {
            return undefined;
        }
        const giaInVolo = inVolo.get(codice);
        if (giaInVolo) {
            return giaInVolo;
        }
        const adesso = chiesto().then((testi) => {
            arrivati.set(codice, testi);
            if (codice === DEL_RIPIEGO) {
                inglese ??= testi;
            }
        }).finally(() => inVolo.delete(codice));
        inVolo.set(codice, adesso);

        return adesso;
    };

    return {
        /** I codici delle lingue, uno per file. */
        lingue: [...perCodice.keys()] as readonly string[],
        /**
         * I testi in una lingua, sempre tutti: quelli che la lingua non ha, o ha vuoti, e quelli di una lingua che non c'è sono in
         * inglese. Una variante regionale senza file prende la lingua base: `it-IT`, `IT`, `es_ES`. Finché la lingua non è pronta
         * (`pronta`) sono quelli dell'italiano, la lingua dell'ingresso: la cornice non li mostra, e li mostra solo se la lingua
         * non arriva. Si compongono una volta per file, e ogni chiamata dà lo stesso oggetto, congelato: è di tutti quelli che lo
         * chiedono, e non si cambia. Lo dice anche il tipo: una scrittura non passa `tsc`.
         */
        testi(lingua: string): Readonly<TestiDellaCornice> {
            const file = pronta(lingua) ? (fileDi(lingua) ?? '') : DELL_INGRESSO;
            const pronti = composti.get(file);
            if (pronti) {
                return pronti;
            }

            const scelti = arrivati.get(file) || {};
            const testi = { ...dellIngresso, ...ripiego() };
            for (const chiave of Object.keys(dellIngresso) as (keyof TestiDellaCornice)[]) {
                const testo = scelti[chiave];
                if (typeof testo === 'string' && testo.trim()) {
                    testi[chiave] = testo;
                }
            }
            composti.set(file, Object.freeze(testi));

            return testi;
        },
        /**
         * La lingua di `testi(lingua)` quando è pronta: il codice del suo file, della lingua base, o dell'inglese. Date e ore si
         * scrivono con `Intl` in questa lingua, mai in quella del browser, e un codice che `Intl` rifiuta (`it_IT`) non gli
         * arriva. Non aspetta che la lingua arrivi.
         */
        linguaDeiTesti(lingua: string): string | undefined {
            return fileDi(lingua) ?? DEL_RIPIEGO;
        },
        /** Se i testi di una lingua sono pronti: l'italiano sempre; un'altra lingua quando sono arrivati il suo file e l'inglese. */
        pronta,
        /**
         * Chiede i file che servono a una lingua — il suo e l'inglese, il ripiego dei testi che le mancano; per l'italiano
         * nessuno — e si compie quando la lingua è pronta. Due richieste insieme sono una. Se un file non arriva la promessa è
         * respinta, e la chiamata dopo lo richiede.
         */
        carica(lingua: string): Promise<void> {
            const codice = fileDi(lingua);

            return codice === DELL_INGRESSO ? Promise.resolve() : Promise.all([codice, DEL_RIPIEGO].map((questo) => questo && chiedi(questo))).then(() => undefined);
        },
    };
}

// I file delle lingue a richiesta. La cornice ne ha solo l'indirizzo (`?url`: un file `.json` della build, con la sua impronta
// nel nome) e li chiede con `fetch`, come le frasi delle notifiche: un `import()` che non arriva resterebbe fallito fino al
// ricaricamento. `no-inline` perché restino file anche in un frontend che alza `build.assetsInlineLimit`. Il server del modulo
// li precarica (`Cornice::precaricoDellaLingua()`): la richiesta qui è la stessa, `fetch` con le sue credenziali.
const ATTESA_DELLE_LINGUE = 10_000;
/** L'indirizzo di ogni file delle lingue a richiesta, per percorso (`'../lingue/es.json'`): tutte tranne l'italiano. Esportato per `./prove`. */
export const indirizziDelleLingue = import.meta.glob<string>(['../lingue/*.json', '!../lingue/it.json'], { query: '?url&no-inline', import: 'default', eager: true });

export const { lingue, testi, linguaDeiTesti, pronta: linguaPronta, carica: caricaLaLingua } = caricaLingue(
    { '../lingue/it.json': italiano },
    Object.fromEntries(
        Object.entries(indirizziDelleLingue).map(([percorso, indirizzo]) => [
            percorso,
            () =>
                fetch(indirizzo, { signal: AbortSignal.timeout?.(ATTESA_DELLE_LINGUE) }).then((risposta) =>
                    risposta.ok ? (risposta.json() as Promise<Partial<TestiDellaCornice>>) : Promise.reject(new Error(risposta.statusText)),
                ),
        ]),
    ),
);

// La lingua del documento si chiede quando l'ingresso è eseguito, prima del primo render della cornice: il modulo la mette in
// `<html lang>`. Se non arriva la chiederà la cornice.
if (typeof document !== 'undefined' && document.documentElement.lang) {
    caricaLaLingua(document.documentElement.lang).catch(() => undefined);
}

/**
 * La lingua in cui la cornice di chi parla `lingua` si disegna (dalla `v4.4.0`): lei, quando è pronta (`linguaPronta`); finché
 * non lo è, quella che la cornice mostrava, se ne mostrava una, e niente (`undefined`) al primo disegno: la cornice aspetta invece
 * di mostrarsi in un'altra lingua. Se non arriva, lei comunque, coi testi dell'italiano: la cornice non resta vuota. La chiede al
 * montaggio e a ogni cambio di lingua, anche dopo una che non era arrivata.
 */
export function useLinguaPronta(lingua: string): string | undefined {
    const [, arrivata] = useState(0);
    const [mostrata, mostra] = useState<string>();
    const [nonArrivata, nonArriva] = useState<string>();
    // Una lingua che non era arrivata si richiede quando la persona ci torna, anche sulla stessa cornice.
    if (nonArrivata !== undefined && nonArrivata !== lingua) {
        nonArriva(undefined);
    }
    const pronta = linguaPronta(lingua) || nonArrivata === lingua;
    if (pronta && mostrata !== lingua) {
        mostra(lingua);
    }

    useEffect(() => {
        if (pronta) {
            return;
        }
        // Arrivata fra il disegno e l'effetto (col precarico del server, prima del montaggio): si ridisegna, senza chiederla.
        if (linguaPronta(lingua)) {
            arrivata((volte) => volte + 1);
            return;
        }
        caricaLaLingua(lingua).then(
            () => arrivata((volte) => volte + 1),
            () => nonArriva(lingua),
        );
    }, [lingua, pronta]);

    return pronta ? lingua : mostrata;
}

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
 * elenco, con la sua congiunzione («schede, board e aree»). Senza fonti sono i due testi della lingua che non promettono
 * niente. L'elenco lo scrive `Intl` nella lingua dei testi, mai in quella del browser. Un browser può non avere
 * `Intl.ListFormat` anche quando ha il resto di `Intl`: lì l'invito è quello senza fonti, quante che siano le fonti, il
 * segnaposto resta quello unico, e niente lancia.
 */
export function testiDellaRicerca(lingua: string, fonti: readonly (TipoDiRisorsa | TipoDellaRicerca)[]): Pick<TestiDellaCornice, 'searchPlaceholder' | 'searchHint'> {
    const t = testi(lingua);
    const conFonti = fonti.length > 0;

    return {
        searchPlaceholder: conFonti ? t.searchPlaceholderSources : t.searchPlaceholder,
        searchHint:
            conFonti && typeof Intl.ListFormat === 'function'
                ? t.searchHintSources.replace(POSTO_DELLE_FONTI, () =>
                      new Intl.ListFormat(linguaDeiTesti(lingua), { type: 'conjunction' }).format(fonti.map((fonte) => t[`searchSource.${fonte}`])),
                  )
                : t.searchHint,
    };
}

/**
 * I caratteri che cambiano la direzione del testo (U+061C, U+200E, U+200F, U+202A-202E, U+2066-2069: la proprietà Unicode
 * `Bidi_Control`): in un nome non servono, e uno lasciato aperto rovescia ciò che segue.
 */
const DI_DIREZIONE = /\p{Bidi_C}/gu;

/**
 * Gli spazi e i caratteri di controllo, anche più d'uno di fila: a capo, tabulazioni e gli altri di U+0000-001F e U+007F-009F
 * (`Cc`), e i due separatori di riga e di capoverso, U+2028 e U+2029 (`Zl`, `Zp`).
 */
const SPAZI_E_CONTROLLI = /[ \p{Cc}\p{Zl}\p{Zp}]+/gu;

/**
 * Ciò che in testa a un nome non si vede: spazi, i caratteri che un testo ignora (`Default_Ignorable_Code_Point`: larghezza
 * zero e riempitivi, come U+200B, U+2060, U+00AD, U+3164) e il braille vuoto, U+2800.
 */
const IN_TESTA_NON_SI_VEDE = /^[\s\p{DI}\u2800]+/u;

/**
 * Un nome del backoffice, pulito: lo ha scritto una persona, e fino a che il backoffice non lo rifiuta arriva com'è. Senza i
 * caratteri di direzione; a capo, tabulazioni e gli altri caratteri di controllo sono uno spazio, più spazi di fila uno solo, e
 * intorno nessuno. In testa non ha caratteri che non si vedono (`IN_TESTA_NON_SI_VEDE`): lì non tengono insieme niente, e
 * l'avatar prende l'iniziale dal primo carattere. Da dentro un nome e dalla coda non si tolgono: U+200D tiene insieme un'emoji
 * composta, U+FE0F la chiude. Niente (`undefined`) per ciò che non è un testo e per un nome che pulito è vuoto, come uno
 * fatto solo di caratteri che non si vedono: è un nome che manca.
 */
export function nomePulito(valore: unknown): string | undefined {
    return (typeof valore === 'string' && valore.replace(DI_DIREZIONE, '').replace(SPAZI_E_CONTROLLI, ' ').replace(IN_TESTA_NON_SI_VEDE, '').trim()) || undefined;
}

/** Il pezzo a richiesta con ciò che serve a pannello delle notifiche aperto (`./campanella`): niente finché non è arrivato. */
export let campanella: typeof import('./campanella') | undefined;

/**
 * Chi chiede un pezzo a richiesta, anche dopo che non è arrivato. In Chromium un `import()` che non è arrivato resta fallito,
 * per quell'indirizzo, finché la pagina non si ricarica (provato il 13/10/2026 con la 151): chiamarlo di nuovo non fa
 * partire niente. Per questo, dopo un pezzo non arrivato, la richiesta dopo lo importa dal suo indirizzo con una coda
 * (`?r=1`), e il browser lo richiede; è lo stesso file. Ciò che importa lui — il JS della cornice, col suo nome — è quello già in pagina solo se la pagina lo ha
 * chiesto con quel nome: chiesto con una coda, il browser lo scarica e lo esegue di nuovo, anche al primo colpo (README). La
 * coda cambia a ogni tentativo fallito (`?r=2`), non a ogni richiesta: due richieste fatte insieme importano lo stesso
 * indirizzo, che per il browser è una richiesta sola, e dopo l'arrivo l'indirizzo resta quello arrivato, che il browser ha
 * già. L'indirizzo non si legge dall'errore del browser, che non conta: è l'argomento di `import(` nel testo di `importa`,
 * cioè il nome che la build ha dato al pezzo, risolto su `qui`, l'indirizzo del JS che contiene `importa`. Così in
 * `import()` entra solo il pezzo che `importa` avrebbe chiesto, dovunque la build lo metta e qualunque coda abbia `qui`.
 * Dove nel testo di `importa` non c'è un `import(` con un nome fra virgolette, la richiesta dopo è l'`import()` di prima
 * (`importa`). Due casi restano come sono, e il README li dice: un `qui` senza percorso (`blob:`, `data:`), dove `new URL`
 * lancia prima della promessa, e un nome che la build scrive già con una coda, a cui `?r=` si aggiunge com'è. L'errore esce com'è. L'accento rovescio nell'espressione è scritto `\x60`: scritto com'è, chi toglie i
 * commenti da questo file per le guardie (`senzaCommenti`) lo leggerebbe come l'inizio di un testo.
 *
 * Dopo un pezzo non arrivato la richiesta dopo aspetta (dalla `v2.11.5`): dopo l'n-esimo fallimento non parte prima di
 * 2^(n−1) secondi, e mai più di 60, dal fallimento. Nell'attesa non importa niente ed è respinta con l'errore di prima, che
 * per chi chiede è un pezzo non arrivato come gli altri. L'orologio è quello della pagina (`performance.now()`): niente è
 * scritto nel browser. Chi chiede con `senzaAttesa` — «Riprova» del pannello delle notifiche, che la persona preme — non aspetta.
 * Le richieste partite insieme, che non arrivano, contano un fallimento solo (dalla `v2.13.0`): conta quello della richiesta
 * partita col numero di tentativi che c'è ancora quando fallisce (`questo`); il fallimento di una partita insieme a lei, che
 * arriva dopo, non allunga l'attesa e non cambia la coda (README).
 */
export function pezzoARichiesta<Pezzo>(importa: () => Promise<Pezzo>, daLi: (indirizzo: string) => Promise<Pezzo>, qui: string): (senzaAttesa?: boolean) => Promise<Pezzo> {
    let tentativi = 0;
    let finoA = 0;
    let diPrima: unknown;

    return (senzaAttesa) => {
        if (!senzaAttesa && performance.now() < finoA) {
            return Promise.reject(diPrima);
        }
        const questo = tentativi;
        const nome = tentativi && /import\((["'\x60])(.+?)\1/.exec(String(importa));

        return (nome ? daLi(`${new URL(nome[2]!, qui)}?r=${tentativi}`) : importa()).catch((errore: unknown) => {
            if (questo === tentativi) {
                finoA = performance.now() + 1e3 * Math.min(2 ** tentativi++, 60);
            }
            throw (diPrima = errore);
        });
    };
}

const ilPezzoDellaCampanella = pezzoARichiesta<typeof import('./campanella')>(() => import('./campanella'), (daLi) => import(/* @vite-ignore */ daLi), import.meta.url);

/**
 * Chiede il pezzo della campanella, e quando è arrivato lo tiene (`campanella`). La cornice lo chiede all'apertura della
 * campanella, mai al montaggio. Se non arriva la promessa è respinta e niente resta: la richiesta dopo lo richiede, anche in
 * Chromium, con l'indirizzo che `pezzoARichiesta` legge dalla build (README, «Le notifiche»), passata la sua attesa — o
 * subito, con `senzaAttesa` («Riprova»). Arrivato, non si chiede più.
 */
export const chiediLaCampanella = async (senzaAttesa?: boolean) => (campanella ??= await ilPezzoDellaCampanella(senzaAttesa));
