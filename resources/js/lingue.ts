import inglese from '../lingue/en.json';
import type { AppShellLabels } from '../zeiras/index';
import type { CodiceDelContesto, IdDiProdotto, TipoDiRisorsa, VoceDelRegistro } from './registro';

// Le lingue della cornice (resources/lingue): un file per lingua, e il nome del file è il codice. Una lingua nuova è un file in
// più, senza toccare il codice, se per le non lette le bastano due forme (vedi `unreadOne`). Dove una lingua non ha un testo
// si mostra l'inglese di zr-core: per questo i testi si danno all'`AppShell` sempre tutti, perché uno che manca lo
// riempirebbe lui col suo default italiano.

/**
 * I testi della cornice: tutti quelli dell'`AppShell` e quelli di zr-core, col nome di ogni prodotto del registro per id, quello
 * di ogni risorsa (il gruppo dei risultati della ricerca) per `<voce>.<tipo>`, il nome da elenco della stessa risorsa,
 * minuscolo, per `searchSource.<voce>.<tipo>`, il testo di ogni codice che una chiave di `contesto` può portare (il ruolo di un
 * membro del workspace) per `searchContext.<voce>.<tipo>.<chiave>.<codice>`. Le frasi delle notifiche non sono qui: stanno in
 * un file loro (`FrasiDelleNotifiche`), che la cornice carica quando si apre la campanella.
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
    /** La stessa frase senza il nome della cosa, col solo `{who}`: per quando il nome non c'è, o per un tipo di cui il backoffice non dà il nome. La ha ogni tipo che ha il titolo. */
    [conChi: `notificationTitleWho.${string}`]: string | undefined;
    /**
     * La riga sotto il titolo quando lì non c'è il nome della cosa: quante azioni la notifica racconta e in quale board sta la
     * cosa (`notificationUnder.countBoard`, con `{n}` e `{board}`), il solo conto (`notificationUnder.count`), la sola board
     * (`notificationUnder.board`).
     */
    [diSotto: `notificationUnder.${string}`]: string | undefined;
};

/** Il ripiego di ogni lingua, quindi con tutti i testi: se all'inglese ne manca uno, tsc si ferma qui. */
const ripiego: TestiDellaCornice = inglese;

/** Il codice di una lingua com'è nei nomi dei file: minuscolo, col trattino (`es_ES` → `es-es`). */
function codiceDi(lingua: string): string {
    return lingua.trim().toLowerCase().replace(/_/g, '-');
}

/**
 * I file di una cartella di lingue come li dà `import.meta.glob` (`{ '../lingue/it.json': … }`), per codice, e il codice del
 * file che serve una lingua: il suo, o quello della lingua base. Nessuno, se zr-core non ce l'ha.
 */
export function fileDelleLingue<Uno>(file: Record<string, Uno>) {
    const perCodice = new Map(Object.entries(file).map(([percorso, uno]) => [codiceDi(percorso.replace(/^.*\/|\.json$/g, '')), uno]));

    return {
        perCodice,
        fileDi(lingua: string): string | undefined {
            const codice = codiceDi(lingua);

            return [codice, ...codice.split('-', 1)].find((scelto) => perCodice.has(scelto));
        },
    };
}

/** Le lingue di un elenco di file come lo dà `import.meta.glob`: `{ '../lingue/it.json': { … } }`. */
export function caricaLingue(file: Record<string, Partial<TestiDellaCornice>>) {
    const { perCodice, fileDi } = fileDelleLingue(file);
    // Il codice dell'inglese: il file che `import.meta.glob` dà con lo stesso oggetto del ripiego.
    const codiceDelRipiego = [...perCodice].find(([, testi]) => testi === ripiego)?.[0];
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
 * (`?r=1`), e il browser lo richiede; è lo stesso file, e ciò che importa lui — l'ingresso — resta quello già in pagina. La
 * coda cambia a ogni tentativo fallito (`?r=2`), non a ogni richiesta: due richieste fatte insieme importano lo stesso
 * indirizzo, che per il browser è una richiesta sola, e dopo l'arrivo l'indirizzo resta quello arrivato, che il browser ha
 * già. L'indirizzo non si legge dall'errore del browser, che non conta: è l'argomento di `import(` nel testo di `importa`,
 * cioè il nome che la build ha dato al pezzo, risolto su `qui`, l'indirizzo del JS che contiene `importa`. Così in
 * `import()` entra solo il pezzo che `importa` avrebbe chiesto, dovunque la build lo metta e qualunque coda abbia `qui`.
 * Dove nel testo di `importa` non c'è un `import(` con un nome fra virgolette, la richiesta dopo è l'`import()` di prima
 * (`importa`). L'errore esce com'è.
 */
export function pezzoARichiesta<Pezzo>(importa: () => Promise<Pezzo>, daLi: (indirizzo: string) => Promise<Pezzo>, qui: string): () => Promise<Pezzo> {
    let tentativi = 0;

    return () => {
        const nome = tentativi && /import\((["'`])(.+?)\1/.exec(String(importa));

        return (nome ? daLi(`${new URL(nome[2]!, qui)}?r=${tentativi}`) : importa()).catch((errore: unknown) => {
            tentativi++;
            throw errore;
        });
    };
}

const ilPezzoDellaCampanella = pezzoARichiesta<typeof import('./campanella')>(() => import('./campanella'), (daLi) => import(/* @vite-ignore */ daLi), import.meta.url);

/**
 * Chiede il pezzo della campanella, e quando è arrivato lo tiene (`campanella`). La cornice lo chiede all'apertura della
 * campanella, mai al montaggio. Se non arriva la promessa è respinta e niente resta: la richiesta dopo lo richiede, anche in
 * Chromium, con l'indirizzo che `pezzoARichiesta` legge dalla build (README, «Le notifiche»). Arrivato, non si chiede più.
 */
export const chiediLaCampanella = async () => (campanella ??= await ilPezzoDellaCampanella());
