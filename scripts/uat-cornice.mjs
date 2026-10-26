#!/usr/bin/env node
/**
 * La UAT della cornice v3.6 in un modulo, dopo l'aggiornamento: axe a 1280 e a 390 px, la ricerca, il percorso, il «+» e la
 * campanella, su una pagina vera del modulo. Non sta nello zip del pacchetto: si prende dal repo al tag.
 *
 *   node uat-cornice.mjs <indirizzo> [--parola <testo>] [--cartella <dir>]
 *
 * <indirizzo> è una pagina del modulo con la cornice, meglio se ha il percorso e il «+». --parola è una parola che nel
 * workspace trova qualcosa (di norma «pro»). --cartella è dove vanno gli screenshot (di norma una cartella nuova in /tmp).
 *
 * Il browser: con UAT_PAGE (il percorso del modulo che dà `conPagina` ed `entra`, quello del browser condiviso della UAT)
 * la pagina si apre lì, con la sessione che c'è; senza, un Chromium suo, per le pagine che non chiedono l'ingresso
 * (Playwright dal progetto in cui si lancia). axe-core: con AXE (il percorso di `axe.min.js`), o `axe-core` dal progetto in
 * cui si lancia, o da cdnjs.
 *
 * Una riga per controllo: ✅ passa, ❌ non passa, ➖ non provato (con il perché). Esce con 1 se una riga è ❌.
 */
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const argomenti = process.argv.slice(2);
const opzione = (nome, altrimenti) => {
    const posto = argomenti.indexOf(nome);
    return posto >= 0 ? argomenti.splice(posto, 2)[1] : altrimenti;
};
const parola = opzione('--parola', 'pro');
const cartella = opzione('--cartella', undefined) ?? mkdtempSync(join(tmpdir(), 'uat-cornice-'));
const [indirizzo] = argomenti;
if (!indirizzo) {
    console.error('Uso: node uat-cornice.mjs <indirizzo> [--parola <testo>] [--cartella <dir>]');
    process.exit(2);
}
mkdirSync(cartella, { recursive: true });

const dalProgetto = createRequire(join(process.cwd(), 'package.json'));
async function sorgenteDiAxe() {
    if (process.env.AXE) {
        return readFileSync(process.env.AXE, 'utf8');
    }
    try {
        return readFileSync(dalProgetto.resolve('axe-core/axe.min.js'), 'utf8');
    } catch {
        const risposta = await fetch('https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.3/axe.min.js');
        if (!risposta.ok) {
            throw new Error(`axe-core da cdnjs: ${risposta.status}`);
        }
        return risposta.text();
    }
}
const axe = await sorgenteDiAxe();

const righe = [];
const scrivi = (esito, id, cosa, prova) => {
    righe.push(esito);
    console.log(`${esito} ${id} ${cosa}${prova ? ` — ${prova}` : ''}`);
};
const pausa = (ms) => new Promise((fatto) => setTimeout(fatto, ms));

/**
 * Le violazioni di axe, divise fra la cornice e la pagina del modulo. È della pagina ciò che sta nel contenuto (`main`
 * dell'`AppShell`, fuori dal percorso e tranne il `main` stesso); il resto è della cornice.
 */
async function violazioni(page) {
    await page.evaluate(axe);
    return page.evaluate(async () => {
        const esito = await window.axe.run(document, { resultTypes: ['violations'] });
        const dellaPagina = (selettore) => {
            const elemento = typeof selettore === 'string' ? document.querySelector(selettore) : null;
            const main = elemento?.closest('main.zr-main');
            return !!main && elemento !== main && !elemento.closest('.zr-crumbbar');
        };
        const cornice = [];
        const pagina = [];
        for (const regola of esito.violations) {
            for (const nodo of regola.nodes) {
                (dellaPagina(nodo.target[0]) ? pagina : cornice).push(`${regola.id}(${regola.impact}) ${nodo.target.join(' ')}`);
            }
        }
        return { cornice, pagina };
    });
}

async function controllaAxe(page, id, quando) {
    const { cornice, pagina } = await violazioni(page);
    const delModulo = pagina.length ? `; della pagina del modulo, da guardare a parte: ${pagina.join(', ')}` : '';
    scrivi(cornice.length ? '❌' : '✅', id, `axe ${quando}: nessuna violazione della cornice`, (cornice.join(', ') || '0 violazioni') + delModulo);
    return cornice;
}

/** Lo stato del pannello della ricerca: caricamento, nessun risultato, risultati, invito, errore o chiuso. */
const statoDellaRicerca = () => {
    const pannello = document.querySelector('.zr-shell .zr-top > .zr-search > .zr-search-panel');
    if (!pannello) return 'chiuso';
    if (pannello.querySelector('[role=option]')) return 'risultati';
    if (pannello.querySelector('.zr-search-note.is-error')) return 'errore';
    if (pannello.querySelector('.zr-search-note > strong')) return 'vuoto';
    if (pannello.querySelector('.zr-search-note[role=status]')) return 'caricamento';
    return 'invito';
};

async function ricerca(page, largo) {
    const id = largo ? 'R' : 'R390';
    // Gli stati del pannello mentre si scrive, uno per cambio.
    await page.evaluate((stato) => {
        const leggi = new Function(`return (${stato})()`);
        window.__uatStati = [];
        new MutationObserver(() => {
            const adesso = leggi();
            if (window.__uatStati.at(-1) !== adesso) window.__uatStati.push(adesso);
        }).observe(document.body, { childList: true, subtree: true });
    }, statoDellaRicerca.toString());

    await page.keyboard.press('Control+k');
    await pausa(300);
    const nelCampo = await page.evaluate(() => document.activeElement?.matches('.zr-shell .zr-top > .zr-search input') ?? false);
    scrivi(nelCampo ? '✅' : '❌', `${id}.1`, 'Ctrl+K porta il fuoco nel campo della ricerca');
    if (!nelCampo) {
        await page.click('.zr-shell .zr-top > .zr-search input');
    }
    await page.keyboard.type(parola, { delay: 90 });
    // Il campo tiene tutti i caratteri scritti: un ascolto della cornice che cambia lo stato durante l'evento del tasto può
    // riportarlo al primo (26/10, sprint 74 · T4: vitest non lo vede, Chromium sì). Gira a ogni tag.
    const nelValore = await page.evaluate(() => document.querySelector('.zr-shell .zr-top > .zr-search input')?.value);
    scrivi(nelValore === parola ? '✅' : '❌', `${id}.0`, `scritti ${parola.length} caratteri, il campo li tiene tutti`, `campo: «${nelValore}»`);
    let stato = 'caricamento';
    for (let attesa = 0; attesa < 50 && stato === 'caricamento'; attesa++) {
        await pausa(200);
        stato = await page.evaluate(statoDellaRicerca);
    }
    await page.screenshot({ path: join(cartella, `ricerca-${largo ? 1280 : 390}.png`) });
    if (largo) {
        // #2062: dal primo tasto della parola nuova il pannello è in caricamento, finché non arriva la risposta: niente
        // «Nessun risultato» né i risultati di prima nel mezzo.
        const stati = await page.evaluate(() => window.__uatStati);
        const ultimoCaricamento = stati.lastIndexOf('caricamento');
        const primaDellUltimo = stati.slice(stati.indexOf('caricamento') + 1, ultimoCaricamento);
        const sbagliati = primaDellUltimo.filter((uno) => uno === 'vuoto' || uno === 'risultati');
        scrivi(ultimoCaricamento < 0 ? '➖' : sbagliati.length ? '❌' : '✅', 'R.2', 'scrivendo, il pannello resta in caricamento fino alla risposta (#2062)', `stati: ${stati.join(' → ')}`);
    }
    let nelPannello = false;
    if (stato !== 'risultati') {
        scrivi('➖', `${id}.3`, 'il pannello coi risultati nel giro del Tab (#2720)', `«${parola}» non trova niente (stato: ${stato}): rilanciare con --parola`);
    } else {
        const pannello = await page.evaluate(() => {
            const elemento = document.querySelector('.zr-shell .zr-top > .zr-search > .zr-search-panel');
            return [elemento?.getAttribute('tabindex'), elemento?.getAttribute('role'), elemento?.getAttribute('aria-label')];
        });
        await page.keyboard.press('Tab');
        await pausa(200);
        const fuocoNelPannello = await page.evaluate(() => document.activeElement?.matches('.zr-search-panel') ?? false);
        nelPannello = fuocoNelPannello;
        const bene = pannello[0] === '0' && pannello[1] === 'group' && !!pannello[2] && fuocoNelPannello;
        scrivi(bene ? '✅' : '❌', `${id}.3`, 'il pannello coi risultati è una fermata del Tab, un gruppo col suo nome (#2720)', `tabindex=${pannello[0]}, role=${pannello[1]}, nome «${pannello[2]}», Tab dal campo → ${fuocoNelPannello ? 'pannello' : 'altrove'}`);
        await page.screenshot({ path: join(cartella, `ricerca-tab-${largo ? 1280 : 390}.png`) });
    }
    if (!largo) {
        const nascoste = await page.evaluate(() => {
            const azioni = document.querySelector('.zr-shell .zr-top > .zr-top-actions');
            return azioni ? getComputedStyle(azioni).visibility : 'nessuna';
        });
        scrivi(nascoste === 'hidden' || nascoste === 'nessuna' ? '✅' : '❌', 'R390.4', 'a 390 px le azioni della barra in alto non stanno sopra la ricerca aperta (#2627)', `visibility: ${nascoste}`);
    }
    await controllaAxe(page, `${id}.5`, `a ${largo ? 1280 : 390} px con la ricerca aperta`);
    // L'`AppShell` chiude la ricerca con Esc solo dal campo: dal pannello lo fa il rimedio della v3.6 (riga 131 delle
    // richieste al design system). Senza, a 390 px la barra in alto resterebbe senza campanella.
    if (nelPannello) {
        await page.keyboard.press('Escape');
        await pausa(300);
        const dopo = await page.evaluate(() => ({
            aperta: !!document.querySelector('.zr-shell .zr-top > .zr-search.is-open'),
            azioni: getComputedStyle(document.querySelector('.zr-shell .zr-top > .zr-top-actions') ?? document.body).visibility,
        }));
        scrivi(!dopo.aperta && dopo.azioni !== 'hidden' ? '✅' : '❌', `${id}.6`, 'Esc col fuoco nel pannello chiude la ricerca, e la barra in alto torna intera', `aperta: ${dopo.aperta}, azioni: ${dopo.azioni}`);
        if (dopo.aperta) {
            await page.keyboard.press('Shift+Tab');
        }
    }
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await pausa(300);
}

async function campanella(page, largo) {
    const id = largo ? 'C' : 'C390';
    if (!(await page.locator('.zr-shell .zr-bell').count())) {
        scrivi('➖', `${id}.1`, 'la campanella', 'non c\'è nella pagina');
        return;
    }
    await page.click('.zr-shell .zr-bell');
    await page.waitForSelector('.zr-notif', { timeout: 5000 }).catch(() => undefined);
    // L'elenco arriva dopo l'apertura.
    for (let attesa = 0; attesa < 25 && (await page.locator('.zr-notif [role=status]').count()); attesa++) {
        await pausa(200);
    }
    const pannello = await page.evaluate(() => ({
        aperto: !!document.querySelector('.zr-notif'),
        fuoco: !!document.activeElement?.closest('.zr-notif'),
        testa: document.querySelector('.zr-notif .zr-pop-head')?.getAttribute('role') ?? null,
        ore: [...document.querySelectorAll('.zr-notif .zr-notif-meta')].map((riga) => riga.textContent ?? ''),
    }));
    scrivi(pannello.aperto && pannello.fuoco ? '✅' : '❌', `${id}.1`, 'la campanella apre il pannello e il fuoco entra nel pannello', `aperto: ${pannello.aperto}, fuoco dentro: ${pannello.fuoco}`);
    scrivi(pannello.testa === 'none' ? '✅' : '❌', `${id}.2`, 'la testa del pannello non è un punto di riferimento (#2627)', `role=${pannello.testa}`);
    if (largo) {
        const lunghe = pannello.ore.filter((ora) => /minut|minute|\bore\b|\bora fa|hour|hora/i.test(ora));
        scrivi(!pannello.ore.length ? '➖' : lunghe.length ? '❌' : '✅', 'C.3', 'l\'ora delle notifiche è corta, «10 min fa», «1 h fa» (#2718)', pannello.ore.length ? pannello.ore.slice(0, 4).join(' | ') : 'nessuna notifica nel pannello');
    }
    await page.screenshot({ path: join(cartella, `campanella-${largo ? 1280 : 390}.png`) });
    await controllaAxe(page, `${id}.4`, `a ${largo ? 1280 : 390} px col pannello delle notifiche aperto`);
    await page.keyboard.press('Escape');
    await pausa(300);
}

async function piu(page) {
    if (!(await page.locator('.zr-shell .zr-create').count())) {
        scrivi('➖', 'P.1', 'il «+» col nome del modulo (#2719)', 'la pagina non ha il «+»: il modulo non dà `create`');
        return;
    }
    await page.click('.zr-shell .zr-create');
    await page.waitForSelector('[role=menu]', { timeout: 3000 }).catch(() => undefined);
    const [pulsante, menu] = await page.evaluate(() => [document.querySelector('.zr-shell .zr-create')?.getAttribute('aria-label'), document.querySelector('[role=menu]')?.getAttribute('aria-label')]);
    const diRipiego = ['Crea', 'Crear', 'Create'].includes(pulsante ?? '');
    scrivi(pulsante && pulsante === menu ? '✅' : '❌', 'P.1', 'il «+» e il suo menu hanno lo stesso nome (#2719)', `«${pulsante}» / «${menu}»${diRipiego ? ': è quello di ripiego, il modulo non dà `createLabel`' : ''}`);
    await page.screenshot({ path: join(cartella, 'piu-1280.png') });
    await page.keyboard.press('Escape');
    await pausa(300);
}

async function percorso(page) {
    const voce = await page.evaluate(() => {
        const collegamento = [...document.querySelectorAll('.zr-shell > main > .zr-crumbbar a[href]')].find((uno) => uno.origin === location.origin && uno.getAttribute('href') !== '#');
        return collegamento ? collegamento.href : null;
    });
    if (!voce) {
        scrivi('➖', 'B.1', 'un clic sul percorso non ricarica la pagina (#2722)', 'la pagina non ha una voce del percorso con un indirizzo di questa origine');
        return;
    }
    await page.evaluate(() => {
        window.__uatSegno = 1;
    });
    await page.click(`.zr-shell > main > .zr-crumbbar a[href="${new URL(voce).pathname + new URL(voce).search + new URL(voce).hash}"], .zr-shell > main > .zr-crumbbar a[href="${voce}"]`);
    await page.waitForURL(voce, { timeout: 8000 }).catch(() => undefined);
    await pausa(500);
    const dopo = await page.evaluate(() => [location.href, window.__uatSegno === 1]);
    scrivi(dopo[0] === voce && dopo[1] ? '✅' : '❌', 'B.1', 'un clic sul percorso apre la pagina senza ricaricarla, da `naviga` (#2722)', `${voce} → ${dopo[0]}, ${dopo[1] ? 'senza ricarica' : 'pagina ricaricata (il layout dà `naviga`?)'}`);
}

async function uat(page, apri) {
    const errori = [];
    page.on('pageerror', (errore) => errori.push(String(errore)));
    page.on('console', (messaggio) => messaggio.type() === 'error' && errori.push(messaggio.text()));

    await page.setViewportSize({ width: 1280, height: 800 });
    await apri(indirizzo);
    await page.waitForSelector('.zr-shell', { timeout: 15000 });
    await pausa(800);
    await page.screenshot({ path: join(cartella, 'pagina-1280.png') });
    await controllaAxe(page, 'A.1', 'a 1280 px, a pannelli chiusi');
    await ricerca(page, true);
    await piu(page);
    await campanella(page, true);
    await percorso(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await apri(indirizzo);
    await page.waitForSelector('.zr-shell', { timeout: 15000 });
    await pausa(800);
    await page.screenshot({ path: join(cartella, 'pagina-390.png') });
    await controllaAxe(page, 'A390.1', 'a 390 px, a pannelli chiusi');
    await ricerca(page, false);
    await campanella(page, false);

    scrivi(errori.length ? '❌' : '✅', 'E.1', 'nessun errore in console', errori.slice(0, 5).join(' | '));
}

if (process.env.UAT_PAGE) {
    const { conPagina, entra } = createRequire(import.meta.url)(process.env.UAT_PAGE);
    await conPagina(async (page) => {
        await uat(page, async (dove) => {
            const arrivato = await entra(page, dove);
            if (arrivato && new URL(arrivato).pathname !== new URL(dove).pathname) {
                throw new Error(`non sono dentro: l'ingresso è finito su ${arrivato}`);
            }
        });
    });
} else {
    const { chromium } = dalProgetto('playwright');
    const browser = await chromium.launch();
    const page = await (await browser.newContext()).newPage();
    try {
        await uat(page, (dove) => page.goto(dove, { waitUntil: 'networkidle' }));
    } finally {
        await browser.close();
    }
}

console.log(`\nScreenshot in ${cartella}`);
process.exit(righe.includes('❌') ? 1 : 0);
