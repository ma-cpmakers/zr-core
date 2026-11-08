// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È useLabels di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import * as React from 'react';
import { labelsContext, pageLabels } from './interni/labelsCtx';

  function useLabels() { return React.useContext(labelsContext()) || pageLabels(); }

export { useLabels };
