// L'ingresso di zr-core per le app (dalla `v1.15.0`): ciò che esporta `./index`, tranne `Zeiras`. La cornice arriva coi soli
// componenti del design system che usa; quelli che servono alle pagine si prendono per nome da `./zeiras/componenti`, e nella
// build entra ciò che l'app usa. Da qui non si scrivono `window.Zeiras` né `window.React`. Un'app che importa anche da `./index`
// si riporta nella build il design system intero.
export { nomeDellaVoce, risorsaDellaNotifica, titoloDellaNotifica } from './lingue';
export { destinazioneDellaNotifica } from './notifiche';
export { registro, type IdDiProdotto, type VoceDelRegistro } from './registro';
export { tonoDelWorkspace } from './tono';
export { Cornice, type CorniceProps, type DatiDellaCornice, type GruppoDiVoci } from './cornice';
export { LayoutDellaCornice, useCornice, type CorniceDellaPagina, type LayoutDellaCorniceProps } from './layout';
