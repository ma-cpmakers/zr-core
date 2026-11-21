// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È AssistantAvatar di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { cx } from './interni/cx';
import { BOT_BASE, BOT_PARTS, assistantOf, botEl } from './interni/assistantOf';
import '../../css/zeiras/AssistantAvatar.css';

  /* il personaggio: i blocchi del logo, quadrato con gli angoli arrotondati (le persone sono tonde), il colore del suo modulo (309) */
  function AssistantAvatar(p) {
    var a = assistantOf(p.assistant), size = p.size || 32, full = !!p.full;
    var name = p.label || a.name;
    return h('span', {
      className: cx('zr-bot', 'is-' + (p.muted ? 'muted' : a.tone), full && 'is-full', p.className),
      style: full ? { width: size, height: Math.round(size * 140 / 120) } : { width: size, height: size },
      role: p.decorative ? undefined : 'img', 'aria-label': p.decorative ? undefined : name, title: p.decorative ? undefined : name, 'aria-hidden': p.decorative ? 'true' : undefined
    }, h('svg', { viewBox: full ? '0 0 120 140' : '4 0 112 112', 'aria-hidden': 'true', focusable: 'false' },
      BOT_BASE.map(botEl), (BOT_PARTS[p.assistant] || BOT_PARTS.zed).map(function (e, i) { return botEl(e, 'p' + i); })));
  }

export { AssistantAvatar };
