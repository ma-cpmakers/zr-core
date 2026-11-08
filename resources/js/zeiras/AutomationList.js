// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È AutomationList di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useState } from './interni/useState';
import { Icon } from './Icon';
import { Button } from './Button';
import { fmtNum } from './interni/fmtNum';
import { Switch } from './Switch';
import { Alert } from './Alert';
import { PageHeader } from './PageHeader';
import { DataTable } from './DataTable';
import { StatusLabel } from './StatusLabel';

  function AutomationList(p) {
    var rows = p.automations || [
      { id: 1, name: 'Benvenuto nuovi lead', trigger: 'Nuovo contatto da modulo', runs: 312, last: '12 min fa', status: 'Attiva' },
      { id: 2, name: 'Promemoria scadenze board', trigger: 'Scheda in scadenza domani', runs: 1204, last: '1 h fa', status: 'Attiva' },
      { id: 3, name: 'Trattativa ferma da 14 giorni', trigger: 'Trattativa senza attività', runs: 48, last: 'ieri', status: 'Attiva' },
      { id: 4, name: 'Newsletter mensile', trigger: 'Ogni primo lunedì del mese', runs: 9, last: '1 set', status: 'In pausa' },
      { id: 5, name: 'Sincronizza fatture', trigger: 'Trattativa vinta', runs: 3, last: '2 gg fa', status: 'Errore' }
    ];
    var st = useState(function () { var o = {}; rows.forEach(function (r) { o[r.id] = r.status === 'Attiva'; }); return o; }), on = st[0], setOn = st[1];
    return h('div', { className: 'zr-stack' },
      h(PageHeader, { overline: 'Automazioni', title: 'Le tue automazioni', count: rows.length, actions: [h(Button, { key: 't', variant: 'secondary', icon: 'copy' }, 'Da modello'), h(Button, { key: 'n', icon: 'plus' }, 'Nuova automazione')] }),
      rows.some(function (r) { return r.status === 'Errore'; }) ? h(Alert, { tone: 'danger', title: '1 automazione si è fermata per un errore', action: h(Button, { variant: 'secondary', size: 'sm' }, 'Vedi dettagli') }, '"Sincronizza fatture" non riesce a collegarsi al servizio esterno.') : null,
      h(DataTable, { rows: rows, onRowClick: p.onOpen, columns: [
        { key: 'name', label: 'Nome', render: function (r) { return h('span', { className: 'zr-cell-person' }, h('span', { className: 'zr-iconbox zr-iconbox-xs zr-label-plum' }, h(Icon, { name: 'bolt', size: 14 })), h('span', null, h('strong', null, r.name), h('small', null, 'Quando: ' + r.trigger))); } },
        { key: 'status', label: 'Stato', render: function (r) { var s = r.status === 'Errore' ? 'Errore' : on[r.id] ? 'Attiva' : 'In pausa'; return h(StatusLabel, { status: s }); } },
        { key: 'runs', label: 'Esecuzioni', align: 'right', render: function (r) { return fmtNum(r.runs); } },
        { key: 'last', label: 'Ultima', sortable: false },
        { key: 'toggle', label: '', sortable: false, align: 'right', render: function (r) { return h('span', { onClick: function (e) { e.stopPropagation(); } }, h(Switch, { 'aria-label': 'Attiva ' + r.name, checked: !!on[r.id], disabled: r.status === 'Errore', onChange: function (v) { var n = Object.assign({}, on); n[r.id] = v; setOn(n); } })); } }
      ] }));
  }

export { AutomationList };
