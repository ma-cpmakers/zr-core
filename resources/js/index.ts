// I componenti di zr-core: il design system di Zeiras intero (`Zeiras`, una copia sola per app), la cornice (`Cornice`, e
// `LayoutDellaCornice` che la tiene montata fra una pagina e l'altra, con `useCornice` per ciò che le dà la pagina) e il
// registro dei prodotti coi loro nomi in ogni lingua (`registro`, `nomeDellaVoce`), per chi li mostra fuori dalla cornice; e,
// per chi mostra le notifiche in una pagina sua, il titolo di ogni tipo di notifica in ogni lingua (`titoloDellaNotifica`) e il
// nome della cosa a cui una notifica si riferisce, la riga sotto il titolo (`risorsaDellaNotifica`), e l'indirizzo che una notifica
// apre, quello della sua risorsa (`destinazioneDellaNotifica`); e, per chi mostra un workspace in una pagina sua, il tono che ha
// nel selettore della cornice (`tonoDelWorkspace`).
export { Zeiras } from './zeiras';
export { nomeDellaVoce, risorsaDellaNotifica, titoloDellaNotifica } from './lingue';
export { destinazioneDellaNotifica } from './notifiche';
export { registro, type IdDiProdotto, type VoceDelRegistro } from './registro';
export { tonoDelWorkspace } from './tono';
export { Cornice, type CorniceProps, type DatiDellaCornice, type GruppoDiVoci } from './cornice';
export { LayoutDellaCornice, useCornice, type CorniceDellaPagina, type LayoutDellaCorniceProps } from './layout';
