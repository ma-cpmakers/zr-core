// L'ingresso di zr-core per le app (dalla `v1.15.0`): ciò che esporta `./index`, tranne `Zeiras`. La cornice arriva coi soli
// componenti del design system che usa; quelli che servono alle pagine si prendono per nome da `./zeiras/componenti`, e nella
// build entra ciò che l'app usa. Da qui non si scrivono `window.Zeiras` né `window.React`. Un'app che importa anche da `./index`
// si riporta nella build il design system intero.
// L'ordine delle righe è quello di `index.ts`, e non è a caso: la build dà i nomi alle esportazioni del JS d'ingresso secondo
// l'ordine in cui i moduli si eseguono, e con questo il pezzo della campanella resta nel suo tetto (`peso.test.ts`).
export { registro, type IdDiProdotto, type VoceDelRegistro } from './registro';
export { tonoDelWorkspace } from './tono';
export { Cornice, type CorniceProps, type DatiDellaCornice, type DatiDopo, type DatiSubito, type GruppoDiVoci } from './cornice';
export { nomeDellaVoce } from './lingue';
export { LayoutDellaCornice, useCornice, type CorniceDellaPagina, type LayoutDellaCorniceProps } from './layout';
// La cornice dello staff (dalla `v3.16.0`): per zr-superadmin, senza i dati della persona. In coda, perché i nomi di ciò che sta sopra
// non cambino; un'app che non la usa non la porta nella build.
export { CorniceDelloStaff, type CorniceDelloStaffProps } from './staff';
// Il Toast della cornice (dalla `v3.17.0`): quello del design system già messo in basso al centro. In coda, come la cornice dello
// staff; un'app che non lo usa non lo porta nella build.
export { ToastDellaCornice, type ToastDellaCorniceProps } from './toast';
// La cornice del cliente (dalla `v4.13.0`): per le pagine «Il mio spazio» di zr-home, coi dati di `Cornice::datiDelCliente()`. In
// coda, come la cornice dello staff; un'app che non la usa non la porta nella build.
export { CorniceDelCliente, type CorniceDelClienteProps, type DatiDelCliente } from './cliente';
