import inglesi from '../lingue/notifiche/en.json';
import { frasiDiOgniLingua, rigaConLeFrasi, titoloConLeFrasi } from './campanella';
import type { FrasiDelleNotifiche } from './lingue';

export { destinazioneDellaNotifica, risorsaDellaNotifica } from './campanella';

// Le notifiche in una pagina che non è il pannello della cornice (zr-home, la pagina di tutte le notifiche): gli stessi titoli
// e le stesse righe, subito, senza aspettare niente. Per questo qui le frasi di tutte le lingue sono importate per intero; la
// cornice non passa da questo modulo e le sue le carica quando si apre la campanella (`caricaFrasi`), così un'app che non usa
// queste funzioni non porta le frasi nel JS d'ingresso. Le lingue si compongono alla prima chiamata. I file sono gli stessi
// che carica la cornice, ma lei ne ha solo l'indirizzo e li chiede con `fetch`: per la build quelli sono file a sé. Dalla
// `v2.0.0` questo è l'ingresso delle tre funzioni per le pagine: i due ingressi del pacchetto non le riesportano, perché ciò
// che compone le righe (`./campanella`) resti fuori dal JS d'ingresso di chi non le usa. Dalla `v3.0.0` è anche l'ingresso di
// `destinazioneDellaNotifica`, che i due ingressi non esportano più: le righe del registro che legge stanno nel pezzo della
// campanella.

const file = import.meta.glob<FrasiDelleNotifiche>('../lingue/notifiche/*.json', { eager: true, import: 'default' });
let diOgniLingua: ((lingua: string) => Readonly<FrasiDelleNotifiche>) | undefined;

/** Le frasi di una lingua: quelle che non ha, e quelle di una lingua che zr-core non ha, sono in inglese. */
function frasi(lingua: string): Readonly<FrasiDelleNotifiche> {
    diOgniLingua ??= frasiDiOgniLingua(file, inglesi);

    return diOgniLingua(lingua);
}

/**
 * Il titolo di una notifica in una lingua: quello del suo tipo, fra le frasi della lingua (`notificationTitle.<tipo>`). Un tipo
 * che le lingue non hanno — nuovo nel contratto, vuoto, mancante, o che non è un testo — ha il titolo di ripiego, e il codice
 * del tipo non si mostra mai. È lo stesso titolo del pannello delle notifiche della cornice.
 */
export function titoloDellaNotifica(tipo: unknown, lingua: string): string {
    return titoloConLeFrasi(frasi(lingua), tipo, lingua);
}

/**
 * Il titolo e la riga di sotto di una notifica, in una lingua: con chi ha fatto e che cosa quando il backoffice lo dice e le
 * lingue hanno la frase di quel tipo, altrimenti `titoloDellaNotifica` e sotto `risorsaDellaNotifica` (`rigaConLeFrasi`). Quando
 * sotto il titolo non c'è il nome della cosa, la riga di sotto dice quante azioni la notifica racconta (`azioni`, da due in su)
 * e in quale board sta la cosa (`board_nome`). Dalla `v3.3.0`, con `quando` (`QuandoDellaCornice`), il titolo dei tipi che hanno
 * la frase con la data dice anche quando. Sono gli stessi testi del pannello delle notifiche della cornice.
 */
export function rigaDellaNotifica(notifica: { tipo?: unknown; autore_nome?: unknown; risorsa_nome?: unknown; azioni?: unknown; board_nome?: unknown; quando?: unknown }, lingua: string): { titolo: string; sotto?: string } {
    return rigaConLeFrasi(frasi(lingua), notifica, lingua);
}
