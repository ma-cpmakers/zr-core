// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È ReportDashboard di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useState } from './interni/useState';
import { Button } from './Button';
import { fmtNum } from './interni/fmtNum';
import { fmtEur } from './interni/fmtEur';
import { Field } from './Field';
import { Tabs } from './Tabs';
import { PageHeader } from './PageHeader';
import { DataTable } from './DataTable';
import { FilterBar } from './FilterBar';
import { LineChart } from './LineChart';
import { BarChart } from './BarChart';
import { DonutChart } from './DonutChart';
import { StatCard } from './StatCard';
import { ChartCard } from './ChartCard';

  /* ---------- Report ---------- */
  function ReportDashboard(p) {
    var r = useState('30g'), range = r[0], setRange = r[1];
    var weeks = ['4 ago', '11 ago', '18 ago', '25 ago', '1 set', '8 set', '15 set', '22 set'];
    return h('div', { className: 'zr-stack' },
      h(PageHeader, { overline: 'Report', title: p.title || 'Marketing', subtitle: 'Aggiornato 5 minuti fa', actions: [h(Button, { key: 's', variant: 'secondary', icon: 'share' }, 'Condividi'), h(Button, { key: 'e', variant: 'secondary', icon: 'download' }, 'Esporta PDF')] }),
      h(FilterBar, { search: false, actions: h(Button, { variant: 'ghost', size: 'sm', icon: 'plus' }, 'Aggiungi widget') },
        h(Tabs, { size: 'sm', value: range, onChange: setRange, 'aria-label': 'Periodo', items: [{ value: '7g', label: '7 giorni' }, { value: '30g', label: '30 giorni' }, { value: '90g', label: '90 giorni' }, { value: '12m', label: '12 mesi' }] }),
        h(Field, { 'aria-label': 'Canale', options: ['Tutti i canali', 'Organico', 'Ads', 'Email', 'Social'], className: 'zr-field-inline' })),
      h('div', { className: 'zr-grid-4' },
        h(StatCard, { label: 'Visite al sito', icon: 'eye', value: '24.310', delta: 12.4, trend: [12, 14, 13, 17, 16, 19, 21, 24] }),
        h(StatCard, { label: 'Lead generati', icon: 'users', value: '612', delta: 8.1, trend: [40, 52, 49, 61, 58, 70, 74, 82] }),
        h(StatCard, { label: 'Tasso di conversione', icon: 'target', value: '2,5%', delta: -0.4, trend: [2.9, 2.8, 2.7, 2.8, 2.6, 2.6, 2.5, 2.5] }),
        h(StatCard, { label: 'Costo per lead', icon: 'euro', value: '14 €', delta: -6.2, invert: true, trend: [18, 17, 17, 16, 15, 15, 14, 14] })),
      h('div', { className: 'zr-grid-report' },
        h(ChartCard, { title: 'Lead per canale', subtitle: 'Ultime 8 settimane', actions: h(Button, { variant: 'ghost', size: 'sm', icon: 'more', 'aria-label': 'Opzioni grafico' }) },
          h(LineChart, { labels: weeks, series: [{ name: 'Organico', data: [32, 38, 35, 44, 41, 48, 52, 57] }, { name: 'Ads', data: [20, 26, 24, 22, 29, 33, 31, 36] }, { name: 'Email', data: [12, 14, 18, 15, 17, 19, 23, 21] }] })),
        h(ChartCard, { title: 'Fonti di traffico', subtitle: 'Visite, 30 giorni' },
          h(DonutChart, { data: [{ label: 'Ricerca organica', value: 9820 }, { label: 'Social', value: 5410 }, { label: 'Ads', value: 4630 }, { label: 'Email', value: 2870 }, { label: 'Diretto', value: 1580 }] }))),
      h(ChartCard, { title: 'Lead e lead qualificati per mese' },
        h(BarChart, { height: 220, labels: ['apr', 'mag', 'giu', 'lug', 'ago', 'set'], series: [{ name: 'Lead', data: [420, 480, 455, 390, 360, 612] }, { name: 'Lead qualificati', data: [168, 202, 178, 150, 139, 257] }] })),
      h(ChartCard, { title: 'Campagne' },
        h(DataTable, { defaultSort: { key: 'leads', dir: 'desc' }, rows: [
          { id: 1, name: 'Webinar Leadership', ch: 'Email', spend: 0, leads: 184, conv: 4.1 },
          { id: 2, name: 'Google Ads · PMP', ch: 'Ads', spend: 2400, leads: 156, conv: 2.3 },
          { id: 3, name: 'LinkedIn · Team Leader', ch: 'Social', spend: 1800, leads: 98, conv: 1.9 },
          { id: 4, name: 'Guida gratuita Agile', ch: 'Organico', spend: 0, leads: 174, conv: 3.6 }],
          columns: [{ key: 'name', label: 'Campagna', render: function (r) { return h('strong', null, r.name); } }, { key: 'ch', label: 'Canale' },
            { key: 'spend', label: 'Spesa', align: 'right', render: function (r) { return r.spend ? fmtEur(r.spend) : '—'; } },
            { key: 'leads', label: 'Lead', align: 'right', render: function (r) { return fmtNum(r.leads); } },
            { key: 'cpl', label: 'Costo/lead', align: 'right', sortValue: function (r) { return r.spend / r.leads; }, render: function (r) { return r.spend ? fmtEur(Math.round(r.spend / r.leads)) : '—'; } },
            { key: 'conv', label: 'Conversione', align: 'right', render: function (r) { return String(r.conv).replace('.', ',') + '%'; } }] })));
  }

export { ReportDashboard };
