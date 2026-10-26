import { fileDelleLingue, linguaDeiTesti, nomeDellaVoce, nomePulito, testi, type FrasiDelleNotifiche } from './lingue';
import { prodottoDelRegistro } from './registro';

// Ciò che serve a pannello delle notifiche aperto, e solo allora: come si compone la riga di una notifica e come si caricano
// le frasi. Dalla `v2.0.0` è un pezzo a richiesta: la cornice lo chiede con `import()` quando si apre la campanella
// (`chiediLaCampanella`, in `./lingue`), e nessun ingresso del pacchetto riesporta niente da qui — un modulo che un ingresso
// importa in modo statico resta nel JS d'ingresso anche se la cornice lo chiede a richiesta. Chi mostra le notifiche in una
// pagina sua prende le stesse funzioni da `./frasi`.

/** Così comincia il tipo di una notifica su un'app (`com.zeiras.app.modificata`): la cosa a cui si riferisce è un prodotto. */
const TIPO_SU_UN_APP = 'com.zeiras.app.';

/**
 * Il nome della cosa a cui si riferisce una notifica, in una lingua: la riga sotto il titolo. È il suo `risorsa_nome`, pulito
 * (`nomePulito`). Per una notifica su un'app (un tipo `com.zeiras.app.…`) il backoffice dà lì il codice dell'app (`pm`), e il nome
 * è quello che il prodotto ha nel registro e nelle lingue, anche per un prodotto «Presto» o non attivo nel workspace: un codice che
 * il registro non ha, o la Dashboard, non dà niente, e il codice non si mostra mai. Niente (`undefined`) anche quando il nome non
 * c'è: `null`, vuoto, di soli spazi, senza la chiave, o un valore che non è un testo. È la funzione del pannello delle notifiche
 * della cornice: chi mostra le notifiche in una pagina sua ha lo stesso testo.
 */
export function risorsaDellaNotifica(notifica: { tipo?: unknown; risorsa_nome?: unknown }, lingua: string): string | undefined {
    const nome = nomePulito(notifica.risorsa_nome);
    if (!nome || typeof notifica.tipo !== 'string' || !notifica.tipo.startsWith(TIPO_SU_UN_APP)) {
        return nome;
    }
    const prodotto = prodottoDelRegistro(nome);

    return prodotto && nomeDellaVoce(prodotto, lingua);
}

/** I posti dei due nomi in una frase delle lingue: `{who}` chi ha fatto, `{what}` la cosa; e quello della data, `{when}` (il giorno e l'ora) o `{date}` (il giorno). */
const POSTI_DEI_NOMI = /\{(who|what|when|date)\}/g;

/**
 * Una frase delle lingue coi due nomi al posto di `{who}` e `{what}`, e con la data al posto di `{when}` (`quando`, il giorno e
 * l'ora) o di `{date}` (`giorno`, il solo giorno). I nomi vengono dal backoffice e sono testo: entrano in un
 * passaggio solo, così un `{what}` scritto dentro il nome di una persona resta com'è, e da una funzione, così `$&` non è un
 * comando. Ogni nome sta fra U+2068 e U+2069, i caratteri che lo isolano dalla direzione della frase: un nome in arabo o in
 * ebraico non sposta le parole intorno. Li mette questa funzione, sempre in coppia: i nomi arrivano già puliti (`nomePulito`).
 * Niente (`undefined`) se la frase non è un testo, o se chiede il nome della cosa e non c'è. La data non la controlla: una frase
 * con `{when}` o `{date}` la chiede solo chi ha la data già scritta (`rigaConLeFrasi`), così in pagina non arriva mai un posto
 * vuoto.
 */
export function fraseConINomi(frase: unknown, chi: string, cosa?: string, quando?: string, giorno?: string): string | undefined {
    if (typeof frase !== 'string' || !frase || (cosa === undefined && frase.includes('{what}'))) {
        return undefined;
    }

    return frase.replace(POSTI_DEI_NOMI, (posto) => `\u2068${posto === '{who}' ? chi : posto === '{what}' ? cosa : posto === '{when}' ? quando : giorno}\u2069`);
}

/**
 * Le frasi di una lingua, sempre tutte quelle che l'inglese ha: quelle che la lingua non ha, o ha vuote, sono in inglese, come
 * i testi. Una frase di un tipo che l'inglese non ha non entra: quali tipi zr-core conosce lo dice l'inglese.
 */
function componiFrasi(scelte: FrasiDelleNotifiche | undefined, inglesi: FrasiDelleNotifiche): Readonly<FrasiDelleNotifiche> {
    const frasi = { ...inglesi };
    for (const chiave of Object.keys(inglesi) as (keyof FrasiDelleNotifiche)[]) {
        const frase = scelte?.[chiave];
        if (typeof frase === 'string' && frase.trim() !== '') {
            frasi[chiave] = frase;
        }
    }

    return Object.freeze(frasi);
}

/**
 * Le frasi di ogni lingua da file già tutti in memoria, come li dà `import.meta.glob` con `eager`: per chi mostra le notifiche
 * in una pagina sua (`./frasi`). Si compongono una volta per file, alla prima richiesta.
 */
export function frasiDiOgniLingua(file: Record<string, FrasiDelleNotifiche>, inglesi: FrasiDelleNotifiche): (lingua: string) => Readonly<FrasiDelleNotifiche> {
    const { perCodice, fileDi } = fileDelleLingue(file);
    const composte = new Map<string, Readonly<FrasiDelleNotifiche>>();

    return (lingua) => {
        const codice = fileDi(lingua) ?? '';
        const pronte = composte.get(codice) ?? componiFrasi(perCodice.get(codice), inglesi);
        composte.set(codice, pronte);

        return pronte;
    };
}

/**
 * Le frasi come devono arrivare: un oggetto con almeno un testo sotto una chiave `notificationTitle…`. Un 200 con dentro
 * un'altra cosa — `null`, un elenco, un oggetto senza frasi, un testo — non sono frasi.
 */
const sonoFrasi = (arrivate: unknown): boolean =>
    typeof arrivate === 'object' && arrivate !== null && Object.entries(arrivate).some(([chiave, frase]) => chiave.startsWith('notificationTitle') && typeof frase === 'string' && frase);

/**
 * Le frasi di una lingua da file che si caricano quando servono, come li dà `import.meta.glob` senza `eager`: per la cornice,
 * che le chiede all'apertura della campanella. Parte il file della lingua, o della lingua base, e quello dell'inglese, il
 * ripiego; mai gli altri. Una volta arrivate restano in memoria (`pronte`), e non si richiedono; due richieste insieme sono
 * una sola. Se un file non arriva la promessa è respinta e niente resta in memoria: la richiesta dopo riparte da capo. Lo
 * stesso se arriva male (`sonoFrasi`): la pagina di un proxy o un file vuoto con un 200 non diventano titoli di ripiego. Chi
 * usa l'inglese, o una lingua senza un file suo, chiede l'inglese una volta: il file della lingua è il ripiego stesso quando
 * `file` lo dà con la stessa funzione di `inglesi`.
 */
export function frasiARichiesta(file: Record<string, () => Promise<FrasiDelleNotifiche>>, inglesi: () => Promise<FrasiDelleNotifiche>) {
    const { perCodice, fileDi } = fileDelleLingue(file);
    const composte = new Map<string, Readonly<FrasiDelleNotifiche>>();
    const inVolo = new Map<string, Promise<Readonly<FrasiDelleNotifiche>>>();

    return {
        /** Le frasi di una lingua se sono già in memoria: niente (`undefined`) finché `carica` non le ha portate. */
        pronte(lingua: string): Readonly<FrasiDelleNotifiche> | undefined {
            return composte.get(fileDi(lingua) ?? '');
        },
        carica(lingua: string): Promise<Readonly<FrasiDelleNotifiche>> {
            const codice = fileDi(lingua) ?? '';
            const pronte = composte.get(codice);
            if (pronte !== undefined) {
                return Promise.resolve(pronte);
            }
            const inVoloAdesso = inVolo.get(codice);
            if (inVoloAdesso !== undefined) {
                return inVoloAdesso;
            }
            const dellaLingua = perCodice.get(codice);
            const scelte = dellaLingua === undefined || dellaLingua === inglesi ? undefined : dellaLingua();
            const ripiego = inglesi();
            // Riuscita o no, la richiesta non resta in volo: una fallita — anche per frasi arrivate male — si rifà.
            const chiesta = Promise.all([scelte ?? ripiego, ripiego]).then((arrivate) => {
                if (!arrivate.every(sonoFrasi)) {
                    return Promise.reject();
                }
                const frasi = componiFrasi(...arrivate);
                composte.set(codice, frasi);

                return frasi;
            }).finally(() => inVolo.delete(codice));
            inVolo.set(codice, chiesta);

            return chiesta;
        },
    };
}

// I file delle frasi, a richiesta. La cornice ne ha solo l'indirizzo (`?url`: un file `.json` della build, con la sua impronta
// nel nome) e li chiede con `fetch`, non con `import()`: in Chrome un `import()` che non arriva resta fallito finché la pagina
// non si ricarica, e «Riprova» non lo richiederebbe mai. `no-inline` perché restino file anche in un frontend che alza
// `build.assetsInlineLimit`: scritti nel JS come `data:`, la CSP di tutti (`connect-src 'self'`) fermerebbe la richiesta.
// `./frasi` importa gli stessi file per intero, come moduli: per la build sono un'altra cosa. Una richiesta che non risponde entro `ATTESA_DELLE_FRASI` è un
// errore come un'altra; dove il browser non ha `AbortSignal.timeout` la richiesta parte lo stesso, senza un tempo massimo.
const ATTESA_DELLE_FRASI = 10_000;
/** L'indirizzo di ogni file delle frasi, per percorso (`'../lingue/notifiche/it.json'`). Esportato per `./prove`. */
export const indirizziDelleFrasi = import.meta.glob<string>('../lingue/notifiche/*.json', { query: '?url&no-inline', import: 'default', eager: true });

const lette = (percorso: string) => (): Promise<FrasiDelleNotifiche> =>
    fetch(indirizziDelleFrasi[percorso] as string, { signal: AbortSignal.timeout?.(ATTESA_DELLE_FRASI) }).then((risposta) => (risposta.ok ? (risposta.json() as Promise<FrasiDelleNotifiche>) : Promise.reject()));

const INGLESI = '../lingue/notifiche/en.json';
const inglesi = lette(INGLESI);

export const { pronte: frasiPronte, carica: caricaFrasi } = frasiARichiesta(
    Object.fromEntries(Object.keys(indirizziDelleFrasi).map((percorso) => [percorso, percorso === INGLESI ? inglesi : lette(percorso)])),
    inglesi,
);

/**
 * Il titolo di una notifica in una lingua, con le frasi di quella lingua: quello del suo tipo (`notificationTitle.<tipo>`).
 * Quali tipi zr-core conosce lo dicono le lingue, non il codice: un tipo che non hanno — nuovo nel contratto, vuoto, mancante,
 * o che non è un testo — ha il titolo di ripiego, che è un testo della cornice, e il codice del tipo non si mostra mai.
 */
export function titoloConLeFrasi(frasi: FrasiDelleNotifiche, tipo: unknown, lingua: string): string {
    const delTipo = typeof tipo === 'string' ? frasi[`notificationTitle.${tipo}`] : undefined;

    return typeof delTipo === 'string' && delTipo ? delTipo : testi(lingua).notificationTitle;
}

/**
 * Il nome di chi ha fatto come sta nel titolo: oltre i 60 caratteri, i primi 59 e «…», così una notifica resta una riga che si
 * legge. Arriva già pulito (`nomePulito`), e si conta per caratteri come li vede chi legge (`Intl.Segmenter`): un'emoji o una
 * lettera con l'accento composto valgono uno e non si spezzano. Dove `Intl.Segmenter` manca si conta per punti di codice, e lì
 * un'emoji composta o un accento composto possono restare a metà. Prima del segno non resta uno spazio. Il nome della cosa
 * non passa di qui, e l'avatar nemmeno.
 */
function nomeNelTitolo(nome: string | undefined): string | undefined {
    // Un nome di 60 unità o meno non ha più di 60 caratteri: non si conta, ed è quasi ogni nome.
    if (!nome || nome.length <= 60) {
        return nome;
    }
    const caratteri = Intl.Segmenter ? Array.from(new Intl.Segmenter().segment(nome), (carattere) => carattere.segment) : Array.from(nome);

    return caratteri.length > 60 ? `${caratteri.slice(0, 59).join('').trimEnd()}…` : nome;
}

/** I posti del conto e della board in una frase della riga di sotto: `{n}` quante azioni, `{board}` il nome della board. */
const POSTI_DI_SOTTO = /\{n\}|\{board\}/g;

/**
 * Quante azioni racconta una notifica e in quale board sta la cosa, con le frasi di una lingua: la riga di sotto quando lì non
 * c'è il nome della cosa. Il conto si scrive da due in su, e solo se è un intero: ogni altro valore è una sola azione, e
 * «1 volta» non si scrive mai. Il nome della board lo ha scritto una persona: pulito (`nomePulito`) e isolato fra U+2068 e
 * U+2069 come gli altri due nomi, e messo in un passaggio solo e da una funzione, così un segnaposto o un `$&` scritti dentro
 * restano testo. Niente (`undefined`) con una sola azione e senza board, o se le frasi non hanno quella che serve.
 */
function contoEBoard(frasi: FrasiDelleNotifiche, notifica: { azioni?: unknown; board_nome?: unknown }): string | undefined {
    const conto = Number.isInteger(notifica.azioni) && (notifica.azioni as number) > 1 ? String(notifica.azioni) : undefined;
    const board = nomePulito(notifica.board_nome);
    const frase = conto === undefined && board === undefined ? undefined : frasi[`notificationUnder.${conto === undefined ? 'board' : board === undefined ? 'count' : 'countBoard'}`];

    return typeof frase === 'string' && frase ? frase.replace(POSTI_DI_SOTTO, (posto) => (posto === '{n}' ? (conto ?? '') : `\u2068${board ?? ''}\u2069`)) : undefined;
}

/**
 * La data di `quando` (`il`, un istante; `fuso`, il nome IANA in cui si legge), nella lingua dei testi (`linguaDeiTesti`, come la frase) e nella forma di `forma`: il giorno
 * e l'ora («mer 4 nov, 10:00») o il solo giorno («3 novembre 2026»). Niente (`undefined`) se non si sa scrivere — non è un oggetto, l'istante non è una data, il fuso non c'è o il browser non lo
 * conosce —: la data, in una notifica, è un di più.
 */
function dataDi(quando: any, lingua: string, forma: Intl.DateTimeFormatOptions): string | undefined {
    // `trim` vuole due testi: senza `fuso` Intl userebbe quello del browser, e senza `il` (o con null) un'altra data.
    try {
        return new Intl.DateTimeFormat(linguaDeiTesti(lingua), { ...forma, timeZone: quando.fuso.trim() }).format(new Date(quando.il.trim()));
    } catch {
        return undefined;
    }
}

/**
 * Il titolo e la riga di sotto di una notifica, in una lingua, con le frasi di quella lingua. Quando il backoffice dice chi ha
 * fatto (`autore_nome`) e le lingue hanno una frase per quel tipo — ogni tipo che ha un titolo — il titolo è la
 * frase: con chi e che cosa (`notificationTitleWhoWhat.<tipo>`), e allora il nome della cosa sta nel titolo e non sotto;
 * o con solo chi (`notificationTitleWho.<tipo>`) quando il nome della cosa manca o il tipo non ha l'altra frase. Quando la notifica
 * dice anche quando accade la cosa (`quando`, dalla `v3.6.0`) e la cornice sa scriverlo (`dataDi`, nel fuso della notifica e nella
 * lingua), una notifica senza la frase con chi e che cosa — il preavviso di una scadenza, una prenotazione di Bookings, che non
 * hanno chi — ha, col nome della cosa, la frase con che cosa e la data (`notificationTitleWhatWhen.<tipo>`: il solo giorno al
 * posto di `{date}`, il giorno e l'ora al posto di `{when}`), e senza il nome della cosa quella con la sola data
 * (`notificationTitleWhen.<tipo>`), che si prova prima di quella con solo chi: con la data, il titolo non dice chi.
 * In ogni altro caso — senza chi, o per un tipo che zr-core non conosce — è la riga di prima: `titoloConLeFrasi`, e sotto
 * `risorsaDellaNotifica`. Quando sotto il titolo non c'è il nome della cosa — è nel titolo, o manca — la riga di sotto dice
 * quante azioni la notifica racconta e in quale board sta la cosa (`contoEBoard`), se c'è qualcosa da dire. I due nomi sono puliti (`nomePulito`) dovunque stiano, anche nella riga di sotto, e nella frase sono
 * isolati (`fraseConINomi`); quello di chi ha fatto, nel titolo, è al più di 60 caratteri (`nomeNelTitolo`). È la funzione del
 * pannello delle notifiche della cornice: `rigaDellaNotifica` (`./frasi`) dà gli stessi testi a chi mostra le notifiche in una
 * pagina sua.
 */
export function rigaConLeFrasi(frasi: FrasiDelleNotifiche, notifica: { tipo?: unknown; autore_nome?: unknown; risorsa_nome?: unknown; azioni?: unknown; board_nome?: unknown; quando?: any }, lingua: string): { titolo: string; sotto?: string } {
    const cosa = risorsaDellaNotifica(notifica, lingua);
    // Le frasi sono di un tipo che è un testo: senza, chi ha fatto non entra nel titolo.
    const chi = typeof notifica.tipo === 'string' ? nomeNelTitolo(nomePulito(notifica.autore_nome)) : undefined;
    const quando = dataDi(notifica.quando, lingua, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const giorno = dataDi(notifica.quando, lingua, { dateStyle: 'long' });
    // `quando` e `giorno` vengono dallo stesso istante e dallo stesso fuso: o ci sono tutti e due, o nessuno.
    const conCosa = cosa === undefined ? undefined : (chi === undefined ? undefined : fraseConINomi(frasi[`notificationTitleWhoWhat.${notifica.tipo}`], chi, cosa)) ?? (quando && fraseConINomi(frasi[`notificationTitleWhatWhen.${notifica.tipo}`], '', cosa, quando, giorno));
    const titolo = conCosa ?? (quando && fraseConINomi(frasi[`notificationTitleWhen.${notifica.tipo}`], '', cosa, quando, giorno)) ?? (chi === undefined ? undefined : fraseConINomi(frasi[`notificationTitleWho.${notifica.tipo}`], chi)) ?? titoloConLeFrasi(frasi, notifica.tipo, lingua);
    const sotto = (conCosa === undefined ? cosa : undefined) ?? contoEBoard(frasi, notifica);

    return sotto === undefined ? { titolo } : { titolo, sotto };
}

// Dalla `v3.0.0` anche la destinazione di una notifica sta in questo pezzo, con le righe del registro che legge: la cornice la
// chiede al clic su una notifica, e chi mostra le notifiche in una pagina sua la importa da `./frasi`.
export { destinazioneDellaNotifica } from './notifiche';
