// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È LabelsProvider di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import * as React from 'react';
import { h } from './interni/h';
import { COMMON_LABELS } from './COMMON_LABELS';
import { labelsContext, labelsLang, pageLabels } from './interni/labelsCtx';

  function LabelsProvider(p) {
    var up = React.useContext(labelsContext()), l = p.labels || {};
    var base = p.lang ? COMMON_LABELS[labelsLang(p.lang)] || up || pageLabels(true) : up || (p.labels ? pageLabels() : null); /* solo testi: la lingua di <html lang>, riletta a ogni disegno */
    var value = React.useMemo(function () {
      if (!base) return null; /* niente lingua e niente testi: i componenti leggono <html lang> */
      var o = Object.assign({}, base);
      Object.keys(l).forEach(function (k) { if (l[k] != null) o[k] = l[k]; });
      return o;
    }, [base, l.close, l.cancel, l.back, l.add, l.remove, l.unread]);
    return h(labelsContext().Provider, { value: value }, p.children);
  }

export { LabelsProvider };
