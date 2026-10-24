// I componenti di zr-core: il design system di Zeiras intero (`Zeiras`, una copia sola per app), la cornice (`Cornice`, e
// `LayoutDellaCornice` che la tiene montata fra una pagina e l'altra, con `useCornice` per ciò che le dà la pagina) e il
// registro dei prodotti coi loro nomi in ogni lingua (`registro`, `nomeDellaVoce`), per chi li mostra fuori dalla cornice; e,
// per chi mostra un workspace in una pagina sua, il tono che ha nel selettore della cornice (`tonoDelWorkspace`). Titolo e riga
// di una notifica (`titoloDellaNotifica`, `rigaDellaNotifica`, `risorsaDellaNotifica`) dalla `v2.0.0` non si esportano da qui:
// si importano da `./frasi`, e dalla `v3.0.0` con loro l'indirizzo che una notifica apre (`destinazioneDellaNotifica`). Un ingresso che li riesporta si riporta nel JS d'ingresso
// ciò che la cornice chiede a richiesta (`./campanella`).
export { Zeiras } from './zeiras';
export { registro, type IdDiProdotto, type VoceDelRegistro } from './registro';
export { tonoDelWorkspace } from './tono';
export { Cornice, type CorniceProps, type DatiDellaCornice, type DatiDopo, type DatiSubito, type GruppoDiVoci } from './cornice';
export { nomeDellaVoce } from './lingue';
export { LayoutDellaCornice, useCornice, type CorniceDellaPagina, type LayoutDellaCorniceProps } from './layout';
