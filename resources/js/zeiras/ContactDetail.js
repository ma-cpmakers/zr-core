// Generato da scripts/componenti.mjs: non si ritocca a mano.
// È ContactDetail di resources/zeiras/bundle.js (il design system di Zeiras, copia derivata) in un modulo suo: le sue
// righe del bundle e quelle private che usa lui solo; il resto lo importa.
// A un riallineamento si rigenera con `npm run componenti`.
import { h } from './interni/h';
import { useState } from './interni/useState';
import { Button } from './Button';
import { Label } from './Label';
import { Tabs } from './Tabs';
import { RecordHeader } from './RecordHeader';
import { ActivityTimeline } from './ActivityTimeline';
import { DescriptionList } from './DescriptionList';
import { DealCard } from './DealCard';

  function ContactDetail(p) {
    var c = p.contact || { name: 'Sara Conti', role: 'Responsabile HR', company: 'Alfa Costruzioni', status: 'Cliente', email: 'sara@alfacostruzioni.it', phone: '+39 055 123 4567', owner: 'Luciano Castro' };
    var tb = useState('note'), tab = tb[0], setTab = tb[1];
    return h('div', { className: 'zr-stack' },
      h(RecordHeader, { name: c.name, status: c.status, subtitle: c.role + ' · ' + c.company,
        meta: [{ icon: 'mail', text: c.email, href: 'mailto:' + c.email }, { icon: 'phone', text: c.phone }, { icon: 'user', text: 'Responsabile: ' + c.owner }],
        actions: [h(Button, { key: 'm', variant: 'secondary', icon: 'mail' }, 'Email'), h(Button, { key: 'c', variant: 'secondary', icon: 'phone' }, 'Chiama'), h(Button, { key: 'd', icon: 'plus' }, 'Trattativa')] }),
      h('div', { className: 'zr-split' },
        h('section', { className: 'zr-panel' },
          h('div', { className: 'zr-panel-head' }, h(Tabs, { variant: 'underline', value: tab, onChange: setTab, items: [{ value: 'note', label: 'Nota', icon: 'edit' }, { value: 'email', label: 'Email', icon: 'mail' }, { value: 'call', label: 'Chiamata', icon: 'phone' }, { value: 'task', label: 'Attività', icon: 'checklist' }] })),
          h('div', { className: 'zr-panel-body zr-stack' },
            h('div', { className: 'zr-composer' }, h('textarea', { rows: 3, placeholder: tab === 'email' ? 'Scrivi un’email a ' + c.name.split(' ')[0] + '…' : tab === 'call' ? 'Esito della chiamata…' : tab === 'task' ? 'Cosa c’è da fare?' : 'Scrivi una nota…', 'aria-label': 'Nuova attività' }),
              h('div', { className: 'zr-composer-row' }, h(Button, { size: 'sm' }, 'Salva'))),
            h(ActivityTimeline, { items: p.activities || [
              { type: 'deal', title: 'Trattativa vinta: Percorso manager 2027', time: 'oggi, 10:24', text: '18.500 € · chiusa da Luciano' },
              { type: 'email', title: 'Email inviata: Proposta aggiornata', time: 'ieri', text: 'Aperta 3 volte · 1 clic sul PDF', by: 'Luciano Castro' },
              { type: 'automation', title: 'Automazione "Benvenuto clienti" avviata', time: 'ieri' },
              { type: 'call', title: 'Chiamata · 12 min', time: '24 set', text: 'Interessati a 2 edizioni nel 2027. Richiamare dopo il budget.', by: 'Luciano Castro' },
              { type: 'note', title: 'Nota', time: '20 set', text: 'Referente decisionale: direttore generale.', by: 'Giulia Bianchi' }
            ] }))),
        h('aside', { className: 'zr-stack' },
          h('section', { className: 'zr-panel' }, h('div', { className: 'zr-panel-head' }, h('h2', null, 'Dettagli')), h('div', { className: 'zr-panel-body' },
            h(DescriptionList, { items: [{ label: 'Azienda', value: c.company }, { label: 'Ruolo', value: c.role }, { label: 'Fonte', value: 'Webinar' }, { label: 'Creato', value: '12 mar 2026' }, { label: 'Etichette', value: h('span', { className: 'zr-card-labels' }, h(Label, { tone: 'sky' }, 'Formazione'), h(Label, { tone: 'plum' }, 'Enterprise')) }] }))),
          h('section', { className: 'zr-panel' }, h('div', { className: 'zr-panel-head' }, h('h2', null, 'Trattative'), h(Button, { variant: 'ghost', size: 'sm', icon: 'plus', 'aria-label': 'Nuova trattativa' })), h('div', { className: 'zr-panel-body zr-stack-sm' },
            h(DealCard, { title: 'Percorso manager 2027', company: c.company, amount: 18500, probability: 100 }),
            h(DealCard, { title: 'Workshop comunicazione', company: c.company, amount: 3200, probability: 40, age: 6 }))))));
  }

export { ContactDetail };
