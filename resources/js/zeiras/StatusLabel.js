// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È StatusLabel di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { Label } from './Label';
import { STATUS_TONE } from './interni/STATUS_TONE';

  function StatusLabel(p) { return h(Label, { tone: p.tone || STATUS_TONE[p.status] || 'neutral' }, p.status); }

export { StatusLabel };
