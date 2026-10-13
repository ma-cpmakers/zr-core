import { fileDelleLingue, nomeDellaVoce, nomePulito, testi, type FrasiDelleNotifiche } from './lingue';
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
    if (nome === undefined || typeof notifica.tipo !== 'string' || !notifica.tipo.startsWith(TIPO_SU_UN_APP)) {
        return nome;
    }
    const prodotto = prodottoDelRegistro(nome);

    return prodotto && nomeDellaVoce(prodotto, lingua);
}

/** I posti dei due nomi in una frase delle lingue: `{who}` chi ha fatto, `{what}` la cosa. */
const POSTI_DEI_NOMI = /\{who\}|\{what\}/g;

/**
 * Una frase delle lingue coi due nomi al posto di `{who}` e `{what}`. I nomi vengono dal backoffice e sono testo: entrano in un
 * passaggio solo, così un `{what}` scritto dentro il nome di una persona resta com'è, e da una funzione, così `$&` non è un
 * comando. Ogni nome sta fra U+2068 e U+2069, i caratteri che lo isolano dalla direzione della frase: un nome in arabo o in
 * ebraico non sposta le parole intorno. Li mette questa funzione, sempre in coppia: i nomi arrivano già puliti (`nomePulito`).
 * Niente (`undefined`) se la frase non è un testo, o se chiede il nome della cosa e il nome non c'è: in pagina non arriva mai un
 * posto vuoto.
 */
export function fraseConINomi(frase: unknown, chi: string, cosa?: string): string | undefined {
    if (typeof frase !== 'string' || frase === '' || (cosa === undefined && frase.includes('{what}'))) {
        return undefined;
    }

    return frase.replace(POSTI_DEI_NOMI, (posto) => `\u2068${posto === '{who}' ? chi : (cosa ?? '')}\u2069`);
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
 * Le frasi di una lingua da file che si caricano quando servono, come li dà `import.meta.glob` senza `eager`: per la cornice,
 * che le chiede all'apertura della campanella. Parte il file della lingua, o della lingua base, e quello dell'inglese, il
 * ripiego; mai gli altri. Una volta arrivate restano in memoria (`pronte`), e non si richiedono; due richieste insieme sono
 * una sola. Se un file non arriva la promessa è respinta e niente resta in memoria: la richiesta dopo riparte da capo.
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
            // Riuscita o no, la richiesta non resta in volo: una fallita — anche per una risposta che non si può comporre — si rifà.
            const chiesta = inVolo.get(codice) ?? Promise.all([perCodice.get(codice)?.(), inglesi()]).then(([scelte, ripiego]) => {
                const frasi = componiFrasi(scelte, ripiego);
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

export const { pronte: frasiPronte, carica: caricaFrasi } = frasiARichiesta(
    Object.fromEntries(Object.keys(indirizziDelleFrasi).map((percorso) => [percorso, lette(percorso)])),
    lette('../lingue/notifiche/en.json'),
);

/**
 * Il titolo di una notifica in una lingua, con le frasi di quella lingua: quello del suo tipo (`notificationTitle.<tipo>`).
 * Quali tipi zr-core conosce lo dicono le lingue, non il codice: un tipo che non hanno — nuovo nel contratto, vuoto, mancante,
 * o che non è un testo — ha il titolo di ripiego, che è un testo della cornice, e il codice del tipo non si mostra mai.
 */
export function titoloConLeFrasi(frasi: FrasiDelleNotifiche, tipo: unknown, lingua: string): string {
    const delTipo = typeof tipo === 'string' ? frasi[`notificationTitle.${tipo}`] : undefined;

    return typeof delTipo === 'string' && delTipo !== '' ? delTipo : testi(lingua).notificationTitle;
}

/**
 * Il titolo e la riga di sotto di una notifica, in una lingua, con le frasi di quella lingua. Quando il backoffice dice chi ha
 * fatto (`autore_nome`) e le lingue hanno una frase per quel tipo — ogni tipo che ha un titolo — il titolo è la
 * frase: con chi e che cosa (`notificationTitleWhoWhat.<tipo>`), e allora il nome della cosa sta nel titolo e sotto non c'è
 * niente; o con solo chi (`notificationTitleWho.<tipo>`) quando il nome della cosa manca o il tipo non ha l'altra frase.
 * In ogni altro caso — senza chi, o per un tipo che zr-core non conosce — è la riga di prima: `titoloConLeFrasi`, e sotto
 * `risorsaDellaNotifica`. I due nomi sono puliti (`nomePulito`) dovunque stiano, anche nella riga di sotto, e nella frase sono
 * isolati (`fraseConINomi`). È la funzione del pannello delle notifiche della cornice: `rigaDellaNotifica` (`./frasi`) dà gli
 * stessi testi a chi mostra le notifiche in una pagina sua.
 */
export function rigaConLeFrasi(frasi: FrasiDelleNotifiche, notifica: { tipo?: unknown; autore_nome?: unknown; risorsa_nome?: unknown }, lingua: string): { titolo: string; sotto?: string } {
    const cosa = risorsaDellaNotifica(notifica, lingua);
    // Le frasi sono di un tipo che è un testo: senza, chi ha fatto non entra nel titolo.
    const chi = typeof notifica.tipo === 'string' ? nomePulito(notifica.autore_nome) : undefined;
    const conCosa = chi === undefined || cosa === undefined ? undefined : fraseConINomi(frasi[`notificationTitleWhoWhat.${notifica.tipo}`], chi, cosa);
    if (conCosa !== undefined) {
        return { titolo: conCosa };
    }
    const titolo = (chi === undefined ? undefined : fraseConINomi(frasi[`notificationTitleWho.${notifica.tipo}`], chi)) ?? titoloConLeFrasi(frasi, notifica.tipo, lingua);

    return cosa === undefined ? { titolo } : { titolo, sotto: cosa };
}
