import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CARD_COLORS, CardColorPicker, DealCard, DealPipeline, LabelsProvider } from './zeiras/componenti';

// v4.36.2 (richiesta 297, voce #3946; richiesta di Luciano via zr-pm-74, 17/11): il colore delle carte delle opportunità. I nomi
// della tavolozza sono il contratto con il backoffice; lo sfondo vero, nei due temi, lo provano il banco del lotto 0528 e la UAT.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let radice: Root;
let contenitore: HTMLElement;

beforeEach(() => {
    contenitore = document.body.appendChild(document.createElement('div'));
    radice = createRoot(contenitore);
});

afterEach(() => {
    act(() => radice.unmount());
    contenitore.remove();
});

it('la tavolozza ha i 12 nomi del contratto, in quest\'ordine (C1)', () => {
    expect(CARD_COLORS).toEqual(['rose', 'peach', 'sand', 'lemon', 'lime', 'mint', 'sage', 'aqua', 'azure', 'lavender', 'lilac', 'stone']);
});

it('una DealCard col colore prende la classe del token, dice «Colore: Menta» e non mette color sull\'article (C2)', async () => {
    await act(async () => radice.render(<DealCard title="UAT Corso" company="UAT Rossi" amount={7200} color="mint" />));
    const carta = contenitore.querySelector('article.zr-deal')!;
    expect(carta.classList.contains('is-card-mint')).toBe(true);
    expect(carta.hasAttribute('color')).toBe(false);
    expect([...carta.querySelectorAll('.zr-visually-hidden')].map((n) => n.textContent)).toContain('Colore: Menta');
});

it('il nome del colore è nella lingua dell\'app: «Color: Lilac» e «Color: Lila» (C2)', async () => {
    await act(async () => radice.render(<LabelsProvider lang="en"><DealCard title="UAT" company="UAT" amount={1} color="lilac" /></LabelsProvider>));
    expect(contenitore.textContent).toContain('Color: Lilac');
    await act(async () => radice.render(<LabelsProvider lang="es"><DealCard title="UAT" company="UAT" amount={1} color="lilac" /></LabelsProvider>));
    expect(contenitore.textContent).toContain('Color: Lila');
});

it('un nome fuori dalla tavolozza, o null, vale nessun colore (C2)', async () => {
    await act(async () => radice.render(<DealCard title="UAT" company="UAT" amount={1} color={'fucsia' as never} />));
    expect(contenitore.querySelector('article')!.className).not.toMatch(/is-card-|has-color/);
    expect(contenitore.textContent).not.toContain('Colore');
});

it('la DealPipeline passa a ogni carta il colore della sua trattativa (C3)', async () => {
    const fasi = [
        { id: 'new', title: 'UAT Nuovo', deals: [{ id: 'd1', title: 'UAT A', company: 'UAT', amount: 1, color: 'rose' as const }, { id: 'd2', title: 'UAT B', company: 'UAT', amount: 1 }] },
        { id: 'won', title: 'UAT Vinto', deals: [{ id: 'd3', title: 'UAT C', company: 'UAT', amount: 1, color: 'azure' as const }] },
    ];
    await act(async () => radice.render(<DealPipeline stages={fasi} onMove={vi.fn()} />));
    const colori = [...contenitore.querySelectorAll('article.zr-deal')].map((a) => `${a.getAttribute('data-deal-id')}:${(a.className.match(/is-card-(\w+)/) ?? [])[1] ?? '-'}`);
    expect(colori).toEqual(['d1:rose', 'd2:-', 'd3:azure']);
});

it('CardColorPicker: «Nessuno» e i 12 radio; Home e Fine scelgono la prima e l\'ultima; onChange dà il nome o null (C4)', async () => {
    const onChange = vi.fn();
    await act(async () => radice.render(<CardColorPicker label="UAT Colore della scheda" defaultValue="mint" onChange={onChange} />));
    const radio = [...contenitore.querySelectorAll<HTMLInputElement>('input[type=radio]')];
    expect(radio.map((r) => r.value)).toEqual(['', ...CARD_COLORS]);
    expect(radio.find((r) => r.checked)!.value).toBe('mint');
    const scelto = radio.find((r) => r.checked)!;
    scelto.focus();
    await act(async () => { scelto.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })); });
    expect(onChange).toHaveBeenLastCalledWith('stone');
    expect(document.activeElement).toBe(radio[12]);
    await act(async () => { radio[12].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })); });
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(document.activeElement).toBe(radio[0]);
});

it('CardColorPicker: Home fuori da un radio non sceglie niente (C4)', async () => {
    const onChange = vi.fn();
    await act(async () => radice.render(<CardColorPicker aria-label="UAT" defaultValue="mint" onChange={onChange} />));
    const lista = contenitore.querySelector('.zr-color-list')!;
    await act(async () => { lista.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })); });
    expect(onChange).not.toHaveBeenCalled();
});

it('CardColorPicker controllato con un nome fuori dalla tavolozza: nessuna scelta segnata, e «Nessuno» dà onChange(null) (revisione del lotto 0528, R1)', async () => {
    const onChange = vi.fn();
    await act(async () => radice.render(<CardColorPicker aria-label="UAT" value={'fucsia' as never} onChange={onChange} />));
    const radio = [...contenitore.querySelectorAll<HTMLInputElement>('input[type=radio]')];
    expect(radio.filter((r) => r.checked)).toHaveLength(0);
    await act(async () => { radio[0].click(); });
    expect(onChange).toHaveBeenLastCalledWith(null);
});

it('CardColorPicker: Maiusc+Home non sceglie (R9), e CARD_COLORS non si cambia (R6)', async () => {
    const onChange = vi.fn();
    await act(async () => radice.render(<CardColorPicker aria-label="UAT" defaultValue="mint" onChange={onChange} />));
    const scelto = contenitore.querySelector<HTMLInputElement>('input:checked')!;
    await act(async () => { scelto.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', shiftKey: true, bubbles: true })); });
    expect(onChange).not.toHaveBeenCalled();
    expect(Object.isFrozen(CARD_COLORS)).toBe(true);
});

it('DealPipeline passa colorNames a ogni carta (R7)', async () => {
    const fasi = [{ id: 'new', title: 'UAT', deals: [{ id: 'd1', title: 'UAT A', company: 'UAT', amount: 1, color: 'rose' as const }] }];
    await act(async () => radice.render(<DealPipeline stages={fasi} colorNames={{ color: 'UAT Tinta', rose: 'UAT Rosso' }} onMove={vi.fn()} />));
    expect(contenitore.textContent).toContain('UAT Tinta: UAT Rosso');
});
