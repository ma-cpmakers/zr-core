import { caricaFrasi, indirizziDelleFrasi, lingue, type FrasiDelleNotifiche } from './lingue';

// Per i test di chi installa il pacchetto, e per quelli del pacchetto: non è un ingresso per le pagine, e nessun ingresso lo
// importa. La cornice chiede i file delle frasi delle notifiche con `fetch` quando si apre la campanella; in un test quei
// file non hanno chi li serva, e il pannello mostrerebbe l'errore. Una riga nel file di preparazione dei test
// (`beforeAll(() => frasiInMemoria())`) e la cornice le ha già, come a una seconda apertura.

const file = import.meta.glob<FrasiDelleNotifiche>('../lingue/notifiche/*.json', { eager: true, import: 'default' });

/**
 * Mette in memoria alla cornice le frasi di ogni lingua, senza richieste: da lì in poi aprendo la campanella i file delle
 * frasi non si chiedono. Mentre le carica risponde lei al posto di `fetch` per i file delle frasi, coi file del pacchetto, e
 * ogni altra richiesta la passa al `fetch` di prima; poi lo rimette. Si chiama prima dei casi, non dentro un caso che conta
 * le richieste. Dopo `vi.resetModules()` si prende con un import nuovo: questa mette le frasi nel modulo delle lingue che ha
 * importato lei.
 */
export async function frasiInMemoria(): Promise<void> {
    const perIndirizzo = new Map(Object.entries(indirizziDelleFrasi).map(([percorso, indirizzo]) => [indirizzo, file[percorso]]));
    const diPrima = globalThis.fetch;

    globalThis.fetch = (richiesta, opzioni) => (perIndirizzo.has(String(richiesta)) ? Promise.resolve(Response.json(perIndirizzo.get(String(richiesta)) ?? {})) : diPrima(richiesta, opzioni));
    try {
        // La lingua vuota è una che zr-core non ha: le sue frasi sono quelle dell'inglese.
        await Promise.all([...lingue, ''].map((lingua) => caricaFrasi(lingua)));
    } finally {
        globalThis.fetch = diPrima;
    }
}
