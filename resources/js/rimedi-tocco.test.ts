import { expect, it, vi } from 'vitest';

// v4.35.2 (richiesta 293): il pezzo dei rimedi chiede quello del tocco quando entra una lavagna, e gli passa la pressione
// di un dito su una carta che si trascina; il mouse resta del browser, e un dito altrove non passa niente.

const tocco = vi.hoisted(() => ({ chiesto: 0, premute: [] as PointerEvent[], mossi: [] as Event[] }));
vi.mock('./tocco', () => (tocco.chiesto++, { premi: (giu: PointerEvent) => tocco.premute.push(giu), trattieni: (mosso: Event) => tocco.mossi.push(mosso) }));

const arrivato = () => new Promise((fatto) => setTimeout(fatto, 20));
const giu = (dove: Element, pointerType: string) => {
    const evento = new PointerEvent('pointerdown', { bubbles: true, pointerType, pointerId: 3 });
    dove.dispatchEvent(evento);

    return evento;
};

it('il pezzo del tocco si chiede quando entra una lavagna; un dito su una carta che si trascina gli passa la pressione, la penna anche (R7); il mouse, una carta in attesa, un dito fuori dalla lavagna e una lavagna senza carte che si trascinano (R4) no (TC.7)', async () => {
    document.body.innerHTML = '<div class="zr-shell"><main></main><p>fuori</p></div>';
    await import('./rimedi');
    await arrivato();
    // Deve fallire se: ogni pagina con la cornice scarica il pezzo del tocco, anche senza lavagna.
    expect(tocco.chiesto).toBe(0);

    // v4.36.0 (R4 della revisione della v4.35.2): una lavagna senza carte che si trascinano non lo chiede.
    // Deve fallire se: una board in sola lettura scarica il pezzo e ferma i touchmove per niente.
    document.querySelector('main')!.innerHTML = '<div class="zr-lanes" id="ferma"><article data-deal-id="c" draggable="false"><h4>C</h4></article></div>';
    await arrivato();
    expect(tocco.chiesto).toBe(0);

    document.querySelector('main')!.insertAdjacentHTML('beforeend', '<div class="zr-lanes"><article data-deal-id="a" draggable="true"><h4>A</h4></article><article data-deal-id="b" draggable="false"></article></div>');
    await arrivato();
    expect(tocco.chiesto).toBe(1);

    giu(document.querySelector('[data-deal-id="a"]')!, 'mouse');
    giu(document.querySelector('[data-deal-id="b"]')!, 'touch');
    giu(document.querySelector('p')!, 'touch');
    expect(tocco.premute).toStrictEqual([]);

    // Subito, nello stesso evento: la pressione arriva al pezzo mentre accade.
    const sulTitolo = giu(document.querySelector('[data-deal-id="a"] h4')!, 'touch');
    expect(tocco.premute).toStrictEqual([sulTitolo]);
    // v4.36.0 (R7): la penna (Apple Pencil) come il dito. Deve fallire se: con la penna la carta non si prende.
    const conLaPenna = giu(document.querySelector('[data-deal-id="a"] h4')!, 'pen');
    expect(tocco.premute).toStrictEqual([sulTitolo, conLaPenna]);

    // I touchmove sulla lavagna gli passano: l'ascolto c'era già prima del tocco, e senza `passive`.
    const mosso = new Event('touchmove', { bubbles: true, cancelable: true });
    document.querySelector('[data-deal-id="a"] h4')!.dispatchEvent(mosso);
    document.querySelector('p')!.dispatchEvent(new Event('touchmove', { bubbles: true, cancelable: true }));
    document.querySelector('#ferma h4')!.dispatchEvent(new Event('touchmove', { bubbles: true, cancelable: true }));
    expect(tocco.mossi).toStrictEqual([mosso]);
});
