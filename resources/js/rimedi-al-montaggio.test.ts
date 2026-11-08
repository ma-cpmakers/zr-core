import { expect, it, vi } from 'vitest';

// v3.8.1 (revisione 381). Ciò che i rimedi fanno senza aspettare un tasto: chi usa un lettore di schermo col tocco, o in
// modalità navigazione, non ne preme nessuno che arrivi alla pagina. In un file suo: il modulo si mette in ascolto una volta
// sola, quando arriva, e qui nessun tasto chiede il pezzo di tastiera.

const cambiato = () => new Promise((fatto) => setTimeout(fatto));

// Quante volte i rimedi hanno chiesto il pezzo della tastiera: nessun caso di questo file preme un tasto.
const tastiera = vi.hoisted(() => ({ chiesto: 0 }));
vi.mock('./tastiera', async (originale) => {
    tastiera.chiesto += 1;

    return originale();
});

it('l\'avatar di una notifica il cui titolo dice un nome che comincia come il suo non si nasconde: il nome si cerca isolato, come la riga lo scrive (riga 85; R10 della revisione 381)', async () => {
    const riga = (nome: string, titolo: string) => `<button class="zr-notif-item"><span class="zr-avatar" role="img" aria-label="${nome}"></span><span><span>${titolo}</span></span></button>`;
    document.body.innerHTML = '<div class="zr-shell"><div class="zr-top-actions"><div class="zr-notif"><div class="zr-notif-list"></div></div></div></div>';
    await import('./rimedi');

    document.querySelector('.zr-notif-list')!.innerHTML = riga('Ada', '⁨Adamo⁩ ha creato un\'area') + riga('Bruno', '⁨Bruno⁩ ha creato un\'area');
    await cambiato();

    expect([...document.querySelectorAll('.zr-avatar')].map((avatar) => avatar.getAttribute('aria-hidden'))).toStrictEqual([null, 'true']);
});

it('sotto i 1024 px il menu a cassetto aperto ha `role="dialog"` senza un tasto, e senza che il pezzo della tastiera sia chiesto; chiuso, nessun ruolo (voce 2341, riga 111)', async () => {
    (window as unknown as { happyDOM: { setViewport: (misura: { width: number; height: number }) => void } }).happyDOM.setViewport({ width: 390, height: 800 });
    document.body.innerHTML = '<div class="zr-shell"><aside class="zr-side" aria-label="Navigazione principale"><nav></nav></aside><header class="zr-top"></header></div>';
    await import('./rimedi');
    const lato = document.querySelector('.zr-side')!;

    // Come l'`AppShell`: aperto, l'`aside` prende `is-open` e il velo entra; chiuso, il velo esce.
    lato.classList.add('is-open');
    const velo = document.querySelector('.zr-shell')!.insertBefore(document.createElement('div'), lato);
    velo.className = 'zr-side-scrim';
    await cambiato();
    const aperto = [lato.getAttribute('role'), lato.getAttribute('aria-modal')];
    lato.classList.remove('is-open');
    velo.remove();
    await cambiato();

    expect([...aperto, lato.getAttribute('role'), tastiera.chiesto]).toStrictEqual(['dialog', null, null, 0]);
});

it('aperto con Invio o con lo spazio — il clic senza `detail` — prima che arrivi il pezzo della tastiera, come quando Invio è il primo tasto della pagina, il menu a cassetto dà il fuoco alla sua prima voce che lo prende, non a una «Presto»; col mouse il fuoco resta su «Apri il menu» (voce 3329, K390.5)', async () => {
    // La voce «Presto» come la fa l'`AppShell` dalla `v4.17.0` (riga 6): fuori dal giro del Tab.
    document.body.innerHTML = '<div class="zr-shell"><aside class="zr-side"><nav><a class="zr-nav-item is-soon" href="#" tabindex="-1" aria-disabled="true"><span>CRM</span><span>Presto</span></a><a class="zr-nav-item" href="/">Dashboard</a></nav></aside><main><div class="zr-top"><button class="zr-top-menu" aria-expanded="false">Apri il menu</button></div></main></div>';
    await import('./rimedi');
    await cambiato();

    const menu = document.querySelector<HTMLButtonElement>('.zr-top-menu')!;
    const premi = async (detail: number) => {
        menu.focus();
        menu.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail }));
        await cambiato();

        return [menu.getAttribute('aria-expanded'), document.activeElement?.textContent];
    };

    menu.addEventListener('click', () => menu.setAttribute('aria-expanded', String(menu.getAttribute('aria-expanded') === 'false')));

    expect([await premi(0), await premi(0), await premi(1), tastiera.chiesto]).toStrictEqual([['true', 'Dashboard'], ['false', 'Apri il menu'], ['true', 'Apri il menu'], 0]);
});

it('il selettore «Azienda › workspace» prende il nome dal testo che si vede, con «Cambia workspace» nella descrizione, e l\'azienda col nome del workspace esce dal nome; a ogni `aria-label` riscritto si rifà (axe `label-content-name-mismatch`, riga 240)', async () => {
    // Come l'`AppShell`: l'`aria-label` è «<workspaceSwitch>: <azienda> › <workspace>», il testo le due righe.
    const selettore = (azienda: string, workspace: string) => `<button type="button" class="zr-ws-switch" aria-expanded="false" aria-label="Cambia workspace: ${azienda} › ${workspace}"><span class="zr-ws-text"><span class="zr-ws-company">${azienda}</span><span class="zr-ws-name">${workspace}</span></span></button>`;
    document.body.innerHTML = `<div class="zr-shell"><aside class="zr-side">${selettore('Studio Anna', 'Studio Anna')}</aside></div>`;
    await import('./rimedi');
    await cambiato();
    const pulsante = document.querySelector('.zr-ws-switch')!;
    const stato = () => [pulsante.getAttribute('aria-label'), pulsante.getAttribute('aria-description'), pulsante.querySelector('.zr-ws-company')!.getAttribute('aria-hidden')];
    const stessoNome = stato();

    // Un altro workspace: l'`AppShell` riscrive i due testi e l'`aria-label`.
    pulsante.querySelector('.zr-ws-company')!.textContent = 'Castro & Partners';
    pulsante.querySelector('.zr-ws-name')!.textContent = 'Marketing';
    pulsante.setAttribute('aria-label', 'Cambia workspace: Castro & Partners › Marketing');
    await cambiato();
    const altroWorkspace = stato();
    // Un'altra lingua: cambia solo l'`aria-label`, nessun testo.
    pulsante.setAttribute('aria-label', 'Switch workspace: Castro & Partners › Marketing');
    await cambiato();

    expect([stessoNome, altroWorkspace, stato()]).toStrictEqual([[null, 'Cambia workspace', 'true'], [null, 'Cambia workspace', 'false'], [null, 'Switch workspace', 'false']]);
});

it('il pulsante del profilo prende il nome dall\'immagine delle iniziali, col nome della persona, e «Account» va nella descrizione; a ogni `aria-label` riscritto si rifà (axe `label-content-name-mismatch`, riga 241)', async () => {
    // Come l'`AppShell`: l'`aria-label` del pulsante è «<account>: <nome>», dentro l'`Avatar` col nome e le iniziali.
    document.body.innerHTML = '<div class="zr-shell"><header class="zr-top"><button type="button" class="zr-avatar-btn" aria-label="Account: Ada Lovelace" aria-haspopup="menu"><span class="zr-avatar" role="img" aria-label="Ada Lovelace" title="Ada Lovelace">AL</span></button></header></div>';
    await import('./rimedi');
    await cambiato();
    const pulsante = document.querySelector('.zr-avatar-btn')!;
    const stato = () => [pulsante.getAttribute('aria-label'), pulsante.getAttribute('aria-description'), pulsante.querySelector('.zr-avatar')!.getAttribute('aria-label')];
    const prima = stato();

    // Un'altra lingua: l'`AppShell` riscrive solo l'`aria-label` del pulsante.
    pulsante.setAttribute('aria-label', 'Cuenta: Ada Lovelace');
    await cambiato();

    expect([prima, stato()]).toStrictEqual([[null, 'Account', 'Ada Lovelace'], [null, 'Cuenta', 'Ada Lovelace']]);
});
