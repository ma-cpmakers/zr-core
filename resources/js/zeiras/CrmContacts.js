// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È CrmContacts di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useState } from './interni/useState';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { fmtEur } from './interni/fmtEur';
import { Tabs } from './Tabs';
import { PageHeader } from './PageHeader';
import { DataTable } from './DataTable';
import { FilterBar } from './FilterBar';
import { StatusLabel } from './StatusLabel';

  var SAMPLE_CONTACTS = /* @__PURE__ */ [
    ['Anna Ferri', 'anna.ferri@rossilogistica.it', 'Rossi Logistica', 'Lead', 'Luciano Castro', 7200, 'oggi'],
    ['Paolo Greco', 'p.greco@nexa.it', 'Nexa Srl', 'Qualificato', 'Marco Neri', 9800, 'ieri'],
    ['Sara Conti', 'sara@alfacostruzioni.it', 'Alfa Costruzioni', 'Cliente', 'Luciano Castro', 18500, '2 gg fa'],
    ['Luca Moretti', 'luca.moretti@orion.it', 'Orion Spa', 'Qualificato', 'Marco Neri', 26000, '3 gg fa'],
    ['Elena Ricci', 'elena@bludigital.it', 'Blu Digital', 'Cliente', 'Giulia Bianchi', 2900, '5 gg fa'],
    ['Davide Galli', 'd.galli@verdiefigli.it', 'Verdi & Figli', 'Lead', 'Giulia Bianchi', 4200, '1 sett fa'],
    ['Chiara Lombardi', 'chiara@studiobianchi.it', 'Studio Bianchi', 'Lead', 'Luciano Castro', 3400, '2 sett fa'],
    ['Marco Fontana', 'm.fontana@kappa.it', 'Kappa Group', 'Perso', 'Marco Neri', 0, '1 mese fa'],
    ['Giorgia Serra', 'giorgia@lumen.it', 'Lumen', 'Cliente', 'Giulia Bianchi', 5600, '1 mese fa']
  ].map(function (r, i) { return { id: 'ct' + i, name: r[0], email: r[1], company: r[2], status: r[3], owner: r[4], value: r[5], last: r[6] }; });
  function CrmContacts(p) {
    var rows = p.contacts || SAMPLE_CONTACTS;
    var q = useState(''), query = q[0], setQuery = q[1];
    var f = useState('Tutti'), filter = f[0], setFilter = f[1];
    var shown = rows.filter(function (r) { return (filter === 'Tutti' || r.status === filter) && (!query || (r.name + r.company + r.email).toLowerCase().indexOf(query.toLowerCase()) >= 0); });
    var count = function (s) { return rows.filter(function (r) { return r.status === s; }).length; };
    return h('div', { className: 'zr-stack' },
      h(PageHeader, { overline: 'CRM', title: 'Contatti', count: rows.length, actions: [h(Button, { key: 'i', variant: 'secondary', icon: 'upload' }, 'Importa CSV'), h(Button, { key: 'n', icon: 'plus' }, 'Nuovo contatto')] }),
      h(FilterBar, { query: query, onQuery: setQuery, searchPlaceholder: 'Cerca per nome, azienda, email…', actions: h(Button, { variant: 'ghost', size: 'sm', icon: 'download' }, 'Esporta') },
        h(Tabs, { size: 'sm', value: filter, onChange: setFilter, 'aria-label': 'Stato', items: [{ value: 'Tutti', label: 'Tutti', count: rows.length }, { value: 'Lead', label: 'Lead', count: count('Lead') }, { value: 'Qualificato', label: 'Qualificati', count: count('Qualificato') }, { value: 'Cliente', label: 'Clienti', count: count('Cliente') }] })),
      h(DataTable, { selectable: true, rows: shown, onRowClick: p.onOpen, pageSize: p.pageSize || 8,
        bulkActions: [h(Button, { key: 'e', variant: 'secondary', size: 'sm', icon: 'mail' }, 'Invia email'), h(Button, { key: 't', variant: 'secondary', size: 'sm', icon: 'tag' }, 'Etichetta')],
        columns: [
          { key: 'name', label: 'Nome', render: function (r) { return h('span', { className: 'zr-cell-person' }, h(Avatar, { name: r.name, size: 'md' }), h('span', null, h('strong', null, r.name), h('small', null, r.email))); } },
          { key: 'company', label: 'Azienda' },
          { key: 'status', label: 'Stato', render: function (r) { return h(StatusLabel, { status: r.status }); } },
          { key: 'owner', label: 'Responsabile', render: function (r) { return h('span', { className: 'zr-cell-owner' }, h(Avatar, { name: r.owner, size: 'sm' }), r.owner.split(' ')[0]); } },
          { key: 'value', label: 'Valore', align: 'right', render: function (r) { return r.value ? fmtEur(r.value) : '—'; } },
          { key: 'last', label: 'Ultima attività', sortable: false }
        ] }));
  }

export { CrmContacts };
