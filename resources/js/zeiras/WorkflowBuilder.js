// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È WorkflowBuilder di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useState } from './interni/useState';
import { useRef } from './interni/useRef';
import { Icon } from './Icon';
import { Button } from './Button';
import { Field } from './Field';
import { Switch } from './Switch';
import { useLabels } from './useLabels';
import { AutomationStep } from './AutomationStep';

  var SAMPLE_FLOW = [
    { id: 's1', type: 'trigger', title: 'Nuovo contatto da modulo', detail: 'Modulo "Scarica la guida Agile"', icon: 'form', stats: '312 esecuzioni' },
    { id: 's2', type: 'action', title: 'Invia email di benvenuto', detail: 'Modello: Benvenuto + guida PDF', icon: 'mail' },
    { id: 's3', type: 'delay', title: '3 giorni' },
    { id: 's4', type: 'condition', title: 'Ha aperto l’email?', detail: 'Sì → continua · No → reinvia con nuovo oggetto' },
    { id: 's5', type: 'action', title: 'Crea attività per il commerciale', detail: 'Assegna a: responsabile del contatto', icon: 'checklist' },
    { id: 's6', type: 'action', title: 'Sposta in pipeline: Qualificato', icon: 'euro' }
  ];
  function WorkflowBuilder(p) {
    var C = useLabels();
    var st = useState(function () { return (p.steps || SAMPLE_FLOW).slice(); }), steps = st[0], setSteps = st[1];
    var se = useState(p.defaultSelected || null), sel = se[0], setSel = se[1];
    var on = useState(p.active !== false), active = on[0], setActive = on[1];
    var seq = useRef(0);
    function insert(i) { seq.current += 1; var n = steps.slice(); n.splice(i + 1, 0, { id: 'x' + seq.current, type: 'action', title: 'Nuova azione', detail: 'Scegli cosa deve succedere' }); setSteps(n); setSel('x' + seq.current); if (p.onChange) p.onChange(n); }
    var current = steps.find(function (s) { return s.id === sel; });
    return h('div', { className: 'zr-flow-wrap' },
      h('div', { className: 'zr-flow-head' },
        h('div', null, h('span', { className: 'zr-overline' }, 'Automazione'), h('h1', { className: 'zr-flow-title' }, p.name || 'Benvenuto nuovi lead')),
        h('div', { className: 'zr-page-actions' },
          h(Switch, { label: active ? 'Attiva' : 'In pausa', checked: active, onChange: setActive }),
          h(Button, { variant: 'secondary', size: 'sm', icon: 'play' }, 'Prova'),
          h(Button, { size: 'sm' }, 'Salva'))),
      h('div', { className: 'zr-flow-body' },
        h('div', { className: 'zr-flow-canvas' },
          h('ol', { className: 'zr-flow' }, steps.map(function (s, i) {
            return h('li', { key: s.id },
              h(AutomationStep, Object.assign({}, s, { selected: sel === s.id, onClick: function () { setSel(s.id); } })),
              h('div', { className: 'zr-flow-link' }, h('button', { type: 'button', className: 'zr-flow-add', 'aria-label': 'Aggiungi passo dopo ' + s.title, onClick: function () { insert(i); } }, h(Icon, { name: 'plus', size: 14 }))));
          }), h('li', { className: 'zr-flow-end' }, h('span', null, 'Fine')))),
        current ? h('aside', { className: 'zr-flow-panel' },
          h('header', { className: 'zr-panel-head' }, h('h2', null, 'Configura passo'), h(Button, { variant: 'ghost', size: 'sm', icon: 'close', 'aria-label': p.closeLabel || C.close, onClick: function () { setSel(null); } })),
          h('div', { className: 'zr-panel-body zr-stack' },
            h(Field, { label: 'Tipo di passo', options: [{ value: 'action', label: 'Azione' }, { value: 'condition', label: 'Condizione' }, { value: 'delay', label: 'Attesa' }], value: current.type, onChange: function (e) { setSteps(steps.map(function (x) { return x.id === current.id ? Object.assign({}, x, { type: e.target.value }) : x; })); } }),
            h(Field, { label: 'Titolo', value: current.title, onChange: function (e) { setSteps(steps.map(function (x) { return x.id === current.id ? Object.assign({}, x, { title: e.target.value }) : x; })); } }),
            h(Field, { label: 'Dettagli', as: 'textarea', rows: 3, value: current.detail || '', onChange: function (e) { setSteps(steps.map(function (x) { return x.id === current.id ? Object.assign({}, x, { detail: e.target.value }) : x; })); } }),
            current.type !== 'trigger' ? h(Button, { variant: 'ghost', icon: 'trash', className: 'zr-danger-text', onClick: function () { setSteps(steps.filter(function (x) { return x.id !== current.id; })); setSel(null); } }, 'Elimina passo') : null)) : null));
  }

export { WorkflowBuilder };
