// Generato da scripts/componenti.mjs: non si ritocca a mano.
// Sono righe private di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) che servono
// a 3 nomi registrati: stanno qui una volta sola e chi le usa le importa.
// A un riallineamento si rigenera con `npm run componenti`.

  /* ---------- KanbanColumn ---------- */
  /* la tastiera fra le schede (richiesta 84): un Tab per lista, sulla scheda dove si era rimasti (la prima la prima volta); ↑ ↓ Home Fine nella lista, ← → la lista accanto */
  function colCards(body, all) { /* le schede della lista; senza all, non quelle nascoste (hidden, aria-hidden) */
    return body ? Array.prototype.filter.call(body.querySelectorAll('.zr-card'), function (c) { var x; return c.closest('.zr-col-body') === body && (all || !(x = c.closest('[hidden], [aria-hidden="true"]')) || !body.contains(x)); }) : []; /* conta solo ciò che si nasconde dentro la lista: un dialogo che nasconde il resto della pagina non le toglie */
  }
  function setAttr(el, k, v) { if (v == null) { if (el.hasAttribute(k)) el.removeAttribute(k); } else if (el.getAttribute(k) !== v) el.setAttribute(k, v); }
  function roveCards(body, cur, hint) { /* nel giro del Tab una sola scheda della lista, cur o la prima; il voto delle altre fuori; a tutte il suggerimento dei tasti, se il modulo non ne dà uno suo */
    var cs = colCards(body); if (cs.indexOf(cur) < 0) cur = cs[0] || null;
    colCards(body, true).forEach(function (c) { var on = c === cur; /* una nascosta resta fuori dal Tab */ setAttr(c, 'tabindex', on ? '0' : '-1'); var d = c.getAttribute('aria-describedby'); if (hint && (!d || d === c.getAttribute('data-zr-keys'))) { setAttr(c, 'aria-describedby', hint); setAttr(c, 'data-zr-keys', hint); }
      Array.prototype.forEach.call(c.querySelectorAll('.zr-card-vote'), function (v) { setAttr(v, 'tabindex', on ? null : '-1'); }); });
    return cur;
  }
  function besideCard(body, i, dir) { /* la scheda nella stessa posizione della lista accanto, o la sua ultima; le liste vuote si saltano */
    var col = body.closest('.zr-col'), box = col && (col.closest('.zr-lanes') || col.parentNode);
    if (box && !box.classList.contains('zr-lanes')) while (box && box.querySelectorAll('.zr-col').length < 2) box = box.parentNode; /* fuori da .zr-lanes, anche con ogni lista dentro un contenitore suo */
    var cols = box ? Array.prototype.slice.call(box.querySelectorAll('.zr-col')) : [];
    for (var k = cols.indexOf(col) + dir; k >= 0 && k < cols.length; k += dir) { var cs = colCards(cols[k].querySelector('.zr-col-body')); if (cs.length) return cs[Math.min(i, cs.length - 1)]; }
    return null;
  }

export { besideCard, colCards, roveCards };
