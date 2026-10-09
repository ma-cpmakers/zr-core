// I componenti di zr-core: il design system di Zeiras intero (`Zeiras`, una copia sola per app), la cornice (`Cornice`, e
// `LayoutDellaCornice` che la tiene montata fra una pagina e l'altra) e il registro dei prodotti coi loro nomi in ogni lingua
// (`registro`, `nomeDellaVoce`), per chi li mostra fuori dalla cornice.
export { Zeiras } from './zeiras';
export { nomeDellaVoce } from './lingue';
export { registro, type IdDiProdotto, type VoceDelRegistro } from './registro';
export { Cornice, type CorniceProps, type DatiDellaCornice, type GruppoDiVoci } from './cornice';
export { LayoutDellaCornice, type LayoutDellaCorniceProps } from './layout';
