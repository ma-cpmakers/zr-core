// Il design system di Zeiras per chi installa dall'ingresso di sempre: i componenti sono quelli di `./componenti` (il modulo
// generato da resources/zeiras/bundle.js, copia derivata, con scripts/componenti.mjs), e qui si scrivono anche in
// `window.Zeiras`, dopo `window.React`: un frontend può leggerli da lì. resources/zeiras/index.d.ts ne dà nomi e props (anche di
// `window.Zeiras`). Il bundle non si importa più: accanto al modulo sarebbe una seconda copia del design system nella stessa app.
import './react-globale';
import * as componenti from './componenti';

window.Zeiras = Object.assign(window.Zeiras || {}, componenti);

export const Zeiras = window.Zeiras;
