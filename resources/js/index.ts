// I componenti di zr-core: il design system di Zeiras intero (`Zeiras`, una copia sola per app), la cornice (`Cornice`, e
// `LayoutDellaCornice` che la tiene montata fra una pagina e l'altra, con `useCornice` per ciò che le dà la pagina) e il
// registro dei prodotti coi loro nomi in ogni lingua (`registro`, `nomeDellaVoce`), per chi li mostra fuori dalla cornice.
export { Zeiras } from './zeiras';
export { nomeDellaVoce } from './lingue';
export { registro, type IdDiProdotto, type VoceDelRegistro } from './registro';
export { Cornice, type CorniceProps, type DatiDellaCornice, type GruppoDiVoci } from './cornice';
export { LayoutDellaCornice, useCornice, type CorniceDellaPagina, type LayoutDellaCorniceProps } from './layout';
