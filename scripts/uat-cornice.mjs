#!/usr/bin/env node
/**
 * La UAT della cornice v3.6 in un modulo, dopo l'aggiornamento: axe a 1280 e a 390 px, la ricerca, il percorso, il «+», la
 * campanella e i menu della barra sopra il pannello di dettaglio, su una pagina vera del modulo. Non sta nello zip del
 * pacchetto: si prende dal repo al tag.
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
import { createHash } from 'node:crypto';
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

/** L'SRI di `axe.min.js` 4.10.3 su cdnjs (api.cdnjs.com, `fields=sri`), senza il prefisso `sha512-`. */
const AXE_DA_CDNJS = 'Y6Vva0IT8gxKyqgZjlEfG76U48eXakSZ8UqY6vMQMe6xES2So8WuItGYcHi3tH1OAlMKjTWjSeN/5x2aysOXIQ==';
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
        // Gira nella pagina, anche nel browser condiviso con la sessione: si esegue solo il file che cdnjs dichiara (il suo SRI).
        const testo = await risposta.text();
        if (createHash('sha512').update(testo).digest('base64') !== AXE_DA_CDNJS) {
            throw new Error('axe-core da cdnjs: l\'impronta non è quella attesa, non si esegue');
        }
        return testo;
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
    // Senza `preload`: axe chiederebbe con `fetch` i fogli di stile, anche quello dei font di Google, e la CSP della pagina (che apre
    // a Google Fonts solo `style-src` e `font-src`, come dice il README) lo ferma con due errori in console che sono di axe, non
    // della pagina, e farebbero rossa E.1. Senza, axe non usa i fogli caricati da sé: la regola che ne ha bisogno
    // (`css-orientation-lock`) resta da guardare a parte.
    return page.evaluate(async () => {
        const esito = await window.axe.run(document, { resultTypes: ['violations'], preload: false });
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
    // Gli stati del pannello mentre si scrive, con l'ora: il registro parte prima di Ctrl+K. Una riga nuova quando cambia il
    // genere, il testo del pannello (la parola in «Nessun risultato per», i titoli) o ciò che è nel campo, letti a ogni
    // cambio del DOM (`MutationObserver`: anche ciò che il browser non disegna) e a ogni fotogramma (ciò che si vede: il
    // valore del campo non è un cambio del DOM, e i risultati di prima sotto una parola allungata non cambiano il pannello).
    await page.evaluate((stato) => {
        const leggi = new Function(`return (${stato})()`);
        const adesso = () => ({
            stato: leggi(),
            testo: document.querySelector('.zr-shell .zr-top > .zr-search > .zr-search-panel')?.textContent ?? '',
            valore: document.querySelector('.zr-shell .zr-top > .zr-search input')?.value,
            t: performance.now(),
        });
        window.__uatStati = [adesso()];
        const registra = () => {
            const ora = adesso();
            const prima = window.__uatStati.at(-1);
            if (prima.stato !== ora.stato || prima.testo !== ora.testo || prima.valore !== ora.valore) window.__uatStati.push(ora);
        };
        new MutationObserver(registra).observe(document.body, { childList: true, subtree: true, characterData: true });
        const fotogramma = () => (registra(), requestAnimationFrame(fotogramma));
        requestAnimationFrame(fotogramma);
    }, statoDellaRicerca.toString());

    await page.keyboard.press('Control+k');
    await pausa(300);
    const nelCampo = await page.evaluate(() => document.activeElement?.matches('.zr-shell .zr-top > .zr-search input') ?? false);
    scrivi(nelCampo ? '✅' : '❌', `${id}.1`, 'Ctrl+K porta il fuoco nel campo della ricerca');
    if (!nelCampo) {
        await page.click('.zr-shell .zr-top > .zr-search input');
    }
    // A 1280 px sei parole, come le batte una persona (AC T4.5 di #2062): dal campo vuoto; dopo una parola con risultati e dopo
    // una senza, sia riscritta da capo (tutto selezionato) sia allungata di qualche lettera; l'ultima trova qualcosa, per il Tab
    // nel pannello. A 390 px una sola.
    const senza = 'qzxv';
    const parole = largo ? [parola, senza, `${senza}w`, parola, `${parola}qz`, parola] : [parola];
    const battute = [];
    let stato = 'chiuso';
    for (const [quale, testo] of parole.entries()) {
        await page.evaluate(() => window.__uatStati.splice(0, window.__uatStati.length - 1));
        const allungata = quale > 0 && testo.startsWith(parole[quale - 1]);
        if (quale > 0 && !allungata) {
            await page.keyboard.press('ControlOrMeta+a');
        }
        await page.keyboard.type(allungata ? testo.slice(parole[quale - 1].length) : testo, { delay: 90 });
        const valore = await page.evaluate(() => document.querySelector('.zr-shell .zr-top > .zr-search input')?.value);
        // Si aspetta oltre i 300 ms dopo cui l'`AppShell` chiama la cornice, poi la fine del caricamento.
        await pausa(500);
        stato = await page.evaluate(statoDellaRicerca);
        for (let attesa = 0; attesa < 50 && stato === 'caricamento'; attesa++) {
            await pausa(200);
            stato = await page.evaluate(statoDellaRicerca);
        }
        battute.push({ testo, valore, stato, stati: await page.evaluate(() => window.__uatStati.slice()) });
    }
    // Il campo tiene tutti i caratteri scritti: un ascolto della cornice che cambia lo stato durante l'evento del tasto può
    // riportarlo al primo (26/10, sprint 74 · T4: vitest non lo vede, Chromium sì). Gira a ogni tag.
    const tagliate = battute.filter(({ testo, valore }) => valore !== testo);
    scrivi(tagliate.length ? '❌' : '✅', `${id}.0`, `${battute.length} parole scritte, il campo tiene tutti i caratteri`, battute.map(({ valore }) => `«${valore}»`).join(', '));
    await page.screenshot({ path: join(cartella, `ricerca-${largo ? 1280 : 390}.png`) });
    if (largo) {
        // #2062: dal tasto della parola nuova all'ultimo caricamento il pannello non mostra «Nessun risultato» né i risultati di
        // prima. Uno stato che resta meno di 16 ms (un microtask, prima che il browser disegni: il disegno dell'`AppShell` prima
        // dell'ascolto della cornice) non si vede, e si conta a parte.
        // Una parola che finisce in errore (il backoffice che frena) non prova niente: ➖ col perché.
        const giudizi = battute.map(({ testo, stato: finale, stati }) => {
            const ultimoCaricamento = stati.map(({ stato: uno }) => uno).lastIndexOf('caricamento');
            const nelMezzo = stati.slice(1, Math.max(ultimoCaricamento, 1)).map((uno, posto) => ({ ...uno, dura: stati[posto + 2].t - uno.t }));
            const sbagliati = nelMezzo.filter(({ stato: uno, dura }) => (uno === 'vuoto' || uno === 'risultati') && dura >= 16);
            const lampi = nelMezzo.filter(({ stato: uno, dura }) => (uno === 'vuoto' || uno === 'risultati') && dura < 16).length;
            const sequenza = stati.map(({ stato: uno, t }, posto) => posto ? `${uno} ${Math.round(t - stati[0].t)}` : uno).join(' → ');
            return { bene: finale === 'errore' ? undefined : ultimoCaricamento > 0 && !sbagliati.length, prova: `«${testo}»: ${sequenza}${lampi ? ` (lampi sotto 16 ms: ${lampi})` : ''}` };
        });
        const provati = new Set(battute.map(({ stato: uno }) => uno));
        const dueEsiti = provati.has('vuoto') && provati.has('risultati');
        const inErrore = giudizi.some(({ bene }) => bene === undefined);
        const esito = giudizi.some(({ bene }) => bene === false) ? '❌' : dueEsiti && !inErrore ? '✅' : '➖';
        const perche = [
            dueEsiti ? '' : `«${parola}» o «${senza}» non hanno dato i due esiti: rilanciare con --parola; `,
            inErrore ? 'una parola è finita in errore (il freno del backoffice?): rilanciare fra un minuto; ' : '',
        ].join('');
        scrivi(esito, 'R.2', 'sei parole: dal tasto il pannello è in caricamento fino alla risposta, mai «Nessun risultato» né i risultati di prima (#2062)', `${perche}${giudizi.map(({ prova }) => prova).join(' · ')}`);
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
    // Ripreso il campo, la parola c'è ancora e i risultati con lei: scelto il primo, il campo si svuota e la ricerca resta
    // chiusa (riga 60 delle richieste al design system, rimedio della v3.8.1).
    if (stato === 'risultati') {
        await page.keyboard.press('Control+k');
        await pausa(300);
        const riga = await page.$('.zr-shell .zr-top > .zr-search .zr-search-item');
        if (!riga) {
            scrivi('➖', `${id}.7`, 'scelto un risultato il campo si svuota (riga 60)', 'ripreso il campo, nessuna riga da scegliere');
        } else {
            await riga.click();
            await pausa(300);
            const dopo = await page.evaluate(() => ({
                valore: document.querySelector('.zr-shell .zr-top > .zr-search input')?.value,
                aperta: !!document.querySelector('.zr-shell .zr-top > .zr-search.is-open'),
            }));
            scrivi(dopo.valore === '' && !dopo.aperta ? '✅' : '❌', `${id}.7`, 'scelto un risultato col clic il campo si svuota e la ricerca resta chiusa (riga 60)', `valore «${dopo.valore}», aperta: ${dopo.aperta}`);
        }
    }
    // Il fuoco che esce dal campo verso un altro elemento chiude la ricerca, e la parola resta (righe 7 e 90, rimedio della v3.8.1).
    await page.keyboard.press('Control+k');
    await page.keyboard.type(parola);
    await pausa(800);
    const primaDiUscire = await page.evaluate(() => !!document.querySelector('.zr-shell .zr-top > .zr-search.is-open'));
    await page.keyboard.press('Shift+Tab');
    await pausa(300);
    const uscito = await page.evaluate(() => ({
        aperta: !!document.querySelector('.zr-shell .zr-top > .zr-search.is-open'),
        valore: document.querySelector('.zr-shell .zr-top > .zr-search input')?.value,
        dentro: !!document.activeElement?.closest('.zr-search'),
    }));
    scrivi(primaDiUscire && !uscito.aperta && !uscito.dentro && uscito.valore === parola ? '✅' : '❌', `${id}.8`, 'col fuoco uscito dal campo (Maiusc+Tab) la ricerca si chiude e la parola resta (righe 7 e 90)', `aperta prima: ${primaDiUscire}, dopo: ${uscito.aperta}, fuoco nella ricerca: ${uscito.dentro}, valore «${uscito.valore}»`);
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
    // Dopo Esc il fuoco è sul «+»: Invio apre il menu (il fuoco va sulla prima voce), Invio la sceglie, e il fuoco torna al «+»
    // (riga 11 delle richieste al design system, rimedio della v3.8.1).
    await page.keyboard.press('Enter');
    await pausa(300);
    const sullaVoce = await page.evaluate(() => document.activeElement?.getAttribute('role') === 'menuitem');
    await page.keyboard.press('Enter');
    await pausa(300);
    const dopo = await page.evaluate(() => ({ menu: !!document.querySelector('[role=menu]'), piu: document.activeElement?.matches('.zr-shell .zr-create') ?? false, attivo: document.activeElement?.tagName }));
    scrivi(sullaVoce && !dopo.menu && dopo.piu ? '✅' : '❌', 'P.2', 'scelta una voce del menu «+» con Invio, il fuoco torna al «+» (riga 11)', `voce col fuoco: ${sullaVoce}, menu aperto: ${dopo.menu}, fuoco su ${dopo.piu ? '«+»' : dopo.attivo}`);
}

// Nel selettore dei workspace aperto Home e Fine vanno alla prima e all'ultima voce, e il Tab che esce lo chiude (riga 48, rimedio
// della v3.8.1 nel pezzo della tastiera).
async function selettore(page) {
    if (!(await page.locator('.zr-shell .zr-ws-switch').count())) {
        scrivi('➖', 'S.1', 'Home e Fine nel selettore dei workspace (riga 48)', 'la pagina non ha il selettore: una sola azienda e un solo workspace');
        return;
    }
    await page.focus('.zr-shell .zr-ws-switch');
    await page.keyboard.press('Enter');
    await pausa(300);
    const dove = () => page.evaluate(() => {
        const voci = [...document.querySelectorAll('.zr-shell .zr-ws-menu .zr-ws-item')];
        return { qui: voci.indexOf(document.activeElement), ultima: voci.length - 1, aperto: !!document.querySelector('.zr-shell .zr-ws.is-open'), nelSelettore: !!document.activeElement?.closest('.zr-ws') };
    });
    await page.keyboard.press('End');
    await pausa(200);
    const fine = await dove();
    await page.keyboard.press('Home');
    await pausa(200);
    const inizio = await dove();
    scrivi(fine.ultima > 0 && fine.qui === fine.ultima && inizio.qui === 0 && inizio.aperto ? '✅' : '❌', 'S.1', 'nel selettore dei workspace Fine va all\'ultima voce e Home alla prima (riga 48)', `Fine: voce ${fine.qui} di 0-${fine.ultima}, Home: voce ${inizio.qui}, aperto: ${inizio.aperto}`);
    await page.keyboard.press('End');
    await page.keyboard.press('Tab');
    await pausa(300);
    const fuori = await dove();
    scrivi(!fuori.aperto && !fuori.nelSelettore ? '✅' : '❌', 'S.2', 'col Tab dall\'ultima voce il fuoco esce e il selettore si chiude (riga 48)', `aperto: ${fuori.aperto}, fuoco nel selettore: ${fuori.nelSelettore}`);
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

/**
 * I menu della barra in alto sopra il pannello di dettaglio (riga 102 delle richieste al design system). Se la pagina non ha
 * un `DetailPanel` aperto, ne mette uno finto: un elemento con la classe del design system in fondo al documento, che il CSS
 * del design system mette dove sta il pannello vero (fisso, sotto la barra, a destra, a `--z-dialog`). «Esci» (l'ultima voce
 * del menu del profilo) non si clicca: il browser della UAT è condiviso, e uscire chiuderebbe la sessione di tutti. Si prova
 * con un clic di prova di Playwright (`trial`), che fa tutti i controlli di un clic vero — compreso che il punto non sia
 * coperto — senza premere, e col punto che il browser dà al centro della voce.
 */
async function sopraIlPannello(page) {
    const finto = await page.evaluate(() => {
        if (document.querySelector('.zr-detail:not(.is-inline)')) {
            return false;
        }
        const pannello = document.createElement('aside');
        pannello.className = 'zr-detail';
        pannello.dataset.uat = '';
        document.body.append(pannello);
        return true;
    });
    const pannello = await page.evaluate(() => {
        const stile = getComputedStyle(document.querySelector('.zr-detail'));
        return `${stile.position}, z-index ${stile.zIndex}, top ${stile.top}`;
    });
    const coperto = async (menu, voce) => {
        const punto = await page.evaluate(([menu, voce]) => {
            const dentro = [...document.querySelectorAll(voce)].pop();
            const r = dentro?.getBoundingClientRect();
            const sotto = r ? document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) : null;
            return sotto ? (document.querySelector(menu)?.contains(sotto) ? 'il menu' : sotto.closest('.zr-detail') ? 'il pannello' : sotto.className) : 'niente';
        }, [menu, voce]);
        const prova = await page.locator(voce).last().click({ trial: true, timeout: 3000 }).then(() => 'clic di prova riuscito', (errore) => `clic di prova fallito: ${String(errore.message).split('\n')[0]}`);
        return [punto === 'il menu' && prova === 'clic di prova riuscito', `al centro c'è ${punto}; ${prova}`];
    };

    await page.click('.zr-shell .zr-avatar-btn');
    await page.waitForSelector('.zr-top-actions > .zr-profile-menu', { timeout: 3000 }).catch(() => undefined);
    const [esci, comeEsci] = await coperto('.zr-top-actions > .zr-profile-menu', '.zr-top-actions > .zr-profile-menu [role=menuitem]');
    scrivi(esci ? '✅' : '❌', 'D.1', '«Esci» si clicca col pannello di dettaglio aperto (riga 102)', `${finto ? 'pannello finto' : 'pannello della pagina'} (${pannello}); ${comeEsci}`);
    await page.screenshot({ path: join(cartella, 'pannello-profilo-1280.png') });
    await page.keyboard.press('Escape');
    await pausa(300);

    await page.click('.zr-shell .zr-bell');
    await page.waitForSelector('.zr-top-actions > .zr-pop', { timeout: 5000 }).catch(() => undefined);
    await pausa(500);
    const [notifiche, comeNotifiche] = await coperto('.zr-top-actions > .zr-pop', '.zr-top-actions > .zr-pop .zr-pop-foot button');
    scrivi(notifiche ? '✅' : '❌', 'D.2', 'il pannello delle notifiche sta sopra il pannello di dettaglio (riga 102)', `«Vedi tutte»: ${comeNotifiche}`);
    await page.screenshot({ path: join(cartella, 'pannello-notifiche-1280.png') });
    await page.keyboard.press('Escape');
    await pausa(300);
    await page.evaluate(() => document.querySelector('.zr-detail[data-uat]')?.remove());
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
    await selettore(page);
    await campanella(page, true);
    await sopraIlPannello(page);
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
