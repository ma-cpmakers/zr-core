// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È StatCard di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { cx } from './interni/cx';
import { Icon } from './Icon';
import { Sparkline } from './Sparkline';

  function StatCard(p) {
    var up = p.delta > 0, good = p.invert ? !up : up;
    return h('div', { className: 'zr-stat' },
      h('div', { className: 'zr-stat-top' }, h('span', { className: 'zr-stat-label' }, p.label), p.icon ? h('span', { className: 'zr-stat-icon' }, h(Icon, { name: p.icon, size: 16 })) : null),
      h('div', { className: 'zr-stat-row' },
        h('strong', { className: 'zr-stat-value' }, p.value),
        p.trend ? h(Sparkline, { data: p.trend }) : null),
      p.delta != null ? h('div', { className: 'zr-stat-foot' },
        h('span', { className: cx('zr-delta', p.delta === 0 ? 'is-flat' : good ? 'is-good' : 'is-bad') }, h(Icon, { name: up ? 'trendUp' : 'trendDown', size: 14 }), (up ? '+' : '') + String(p.delta).replace('.', ',') + '%'),
        h('span', null, p.deltaLabel || 'vs periodo precedente')) : null);
  }

export { StatCard };
