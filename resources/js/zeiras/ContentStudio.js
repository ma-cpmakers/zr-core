// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È ContentStudio di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useState } from './interni/useState';
import { Button } from './Button';
import { Label } from './Label';
import { useEffect } from './interni/useEffect';
import { Field } from './Field';
import { Tabs } from './Tabs';
import { EmptyState } from './EmptyState';
import { Progress } from './Progress';
import { Skeleton } from './Skeleton';

  /* ---------- Contenuti (AI) ---------- */
  var CONTENT_TYPES = [{ value: 'linkedin', label: 'Post LinkedIn' }, { value: 'email', label: 'Email newsletter' }, { value: 'blog', label: 'Articolo blog' }, { value: 'ads', label: 'Annuncio pubblicitario' }, { value: 'product', label: 'Descrizione prodotto' }];
  function demoGenerate(o) {
    var t = o.topic || 'il nostro nuovo corso';
    var open = { Professionale: 'Parliamo di ', Amichevole: 'Ti è mai capitato di pensare a ', Ispirazionale: 'Ogni grande risultato comincia da ', Diretto: 'In breve: ' }[o.tone] || '';
    var base = [
      open + t + '. Abbiamo raccolto quello che serve per partire con il piede giusto, senza giri di parole.',
      open + t + '? Tre idee pratiche che puoi applicare già da domani, anche se hai poco tempo.',
      open + t + ': cosa abbiamo imparato lavorando con decine di team, e cosa rifaremmo diversamente.'
    ];
    var extra = o.length === 'Lunga' ? ' Nei prossimi paragrafi vediamo esempi concreti, gli errori più comuni e una checklist da usare subito. Alla fine trovi le risorse per approfondire.' : o.length === 'Media' ? ' Ecco da dove cominciare, passo dopo passo.' : '';
    return base.map(function (b, i) { return { id: Date.now() + i, text: b + extra }; });
  }
  function ContentStudio(p) {
    var f = useState({ type: 'linkedin', topic: 'come organizzare un team con la board Kanban', audience: 'Manager di PMI', tone: 'Professionale', length: 'Media' }), form = f[0], setForm = f[1];
    var o = useState(null), out = o[0], setOut = o[1];
    var l = useState(false), loading = l[0], setLoading = l[1];
    var c = useState(null), copied = c[0], setCopied = c[1];
    function set(k, v) { var n = Object.assign({}, form); n[k] = v; setForm(n); }
    function run() {
      setLoading(true); setOut(null);
      var res = p.onGenerate ? p.onGenerate(form) : new Promise(function (r) { setTimeout(function () { r(demoGenerate(form)); }, 900); });
      Promise.resolve(res).then(function (v) { setOut(v); setLoading(false); });
    }
    useEffect(function () { if (p.autoGenerate) run(); }, []);
    function copy(it) { try { navigator.clipboard.writeText(it.text); } catch (e) {} setCopied(it.id); setTimeout(function () { setCopied(null); }, 1600); }
    var used = p.used != null ? p.used : 18, limit = p.limit || 100;
    return h('div', { className: 'zr-studio' },
      h('section', { className: 'zr-panel zr-studio-form' },
        h('header', { className: 'zr-panel-head' }, h('div', null, h('span', { className: 'zr-overline' }, 'Contenuti'), h('h2', null, 'Nuovo contenuto'))),
        h('div', { className: 'zr-panel-body zr-stack' },
          h(Field, { label: 'Tipo di contenuto', options: CONTENT_TYPES, value: form.type, onChange: function (e) { set('type', e.target.value); } }),
          h(Field, { label: 'Di cosa vuoi parlare?', as: 'textarea', rows: 3, value: form.topic, onChange: function (e) { set('topic', e.target.value); }, hint: 'Una frase basta. Più dettagli dai, più il testo è preciso.' }),
          h(Field, { label: 'A chi ti rivolgi', icon: 'users', value: form.audience, onChange: function (e) { set('audience', e.target.value); } }),
          h('div', { className: 'zr-field' }, h('span', { className: 'zr-field-label' }, 'Tono'), h(Tabs, { size: 'sm', value: form.tone, onChange: function (v) { set('tone', v); }, 'aria-label': 'Tono', items: ['Professionale', 'Amichevole', 'Ispirazionale', 'Diretto'] })),
          h('div', { className: 'zr-field' }, h('span', { className: 'zr-field-label' }, 'Lunghezza'), h(Tabs, { size: 'sm', value: form.length, onChange: function (v) { set('length', v); }, 'aria-label': 'Lunghezza', items: ['Breve', 'Media', 'Lunga'] })),
          h(Button, { icon: 'sparkle', onClick: run, disabled: loading || !form.topic.trim(), className: 'zr-btn-block' }, loading ? 'Sto scrivendo…' : 'Genera 3 varianti'),
          h(Progress, { label: 'Generazioni questo mese', value: used, max: limit, valueLabel: used + ' di ' + limit }))),
      h('section', { className: 'zr-studio-out', 'aria-live': 'polite' },
        loading ? [0, 1, 2].map(function (i) { return h('div', { key: i, className: 'zr-panel zr-variant' }, h(Skeleton, { lines: 4 })); })
          : out ? out.map(function (it, i) {
            return h('article', { key: it.id, className: 'zr-panel zr-variant' },
              h('header', { className: 'zr-variant-head' }, h(Label, { tone: 'coral' }, 'Variante ' + (i + 1)), h('span', null, it.text.split(/\s+/).length + ' parole')),
              h('p', { className: 'zr-variant-text' }, it.text),
              h('footer', { className: 'zr-variant-actions' },
                h(Button, { variant: 'secondary', size: 'sm', icon: copied === it.id ? 'check' : 'copy', onClick: function () { copy(it); } }, copied === it.id ? 'Copiato' : 'Copia'),
                h(Button, { variant: 'ghost', size: 'sm', icon: 'refresh', onClick: run }, 'Rigenera'),
                h(Button, { variant: 'ghost', size: 'sm', icon: 'star', onClick: p.onSave ? function () { p.onSave(it); } : undefined }, 'Salva')));
          })
          : h(EmptyState, { icon: 'sparkle', tone: 'coral', title: 'Il tuo testo apparirà qui', text: 'Scegli tipo, argomento e tono, poi premi "Genera". Riceverai tre varianti da copiare o salvare.' })));
  }

export { ContentStudio };
