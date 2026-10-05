// Il design system di Zeiras così com'è: resources/zeiras/bundle.js, copia derivata, scrive i componenti in `window.Zeiras`, e
// resources/zeiras/index.d.ts ne dà nomi e props (anche di `window.Zeiras`). L'ordine degli import è la regola: prima
// `window.React`, poi il bundle.
import './react-globale';
import '../../zeiras/bundle.js';

import type {} from '../../zeiras/index';

export const Zeiras = window.Zeiras;
