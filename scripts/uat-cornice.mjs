#!/usr/bin/env node
/**
 * La UAT della cornice v3.6 in un modulo, dopo l'aggiornamento: axe a 1280 e a 390 px, la ricerca, il percorso, il «+», la
 * campanella e i menu della barra sopra il pannello di dettaglio, dalla v3.15 i font dal pacchetto e dalla v4.0 la CSP che non ferma niente (R.C), su una
 * pagina vera del modulo. Non sta nello zip del pacchetto: si prende dal repo al tag.
 *
 *   node uat-cornice.mjs <indirizzo> [--parola <testo>] [--cartella <dir>] [--staff | --cliente] [--spazio] [--barra]
 *
 * <indirizzo> è una pagina del modulo con la cornice, meglio se ha il percorso e il «+». --parola è una parola che nel
 * workspace trova qualcosa (di norma «pro»), e per V.1-V.2 abbastanza risultati da far scorrere il pannello (altrimenti ➖).
 * --cartella è dove vanno gli screenshot (di norma una cartella nuova in /tmp). Prima di un tag zr-core la lancia sulle
 * pagine di prova costruite dal commit (`npm run demo`, `dist/demo` servito in locale con la CSP di tutti: `node scripts/servi-demo.mjs`), con
 * `layout.html?schede=1&crm_attivo=1&prenotazioni=1 --parola uat`: lì nessuna riga resta ➖ tranne B.1, che vuole il percorso,
 * e si prova con `pagina=percorso` in più (lì restano ➖ M.2 e P.3: il «+» ha una voce sola).
 *
 * Il browser: con UAT_PAGE (il percorso del modulo che dà `conPagina` ed `entra`, quello del browser condiviso della UAT)
 * la pagina si apre lì, con la sessione che c'è; senza, un Chromium suo, per le pagine che non chiedono l'ingresso
 * (Playwright dal progetto in cui si lancia). axe-core: con AXE (il percorso di `axe.min.js`), o `axe-core` dal progetto in
 * cui si lancia, o da cdnjs.
 *
 * Dalla v4.4.0 le righe R.L guardano la lingua della cornice dalla prima pagina aperta (con un Chromium suo, a cache vuota):
 * la lingua di `<html lang>`; sulle pagine di prova `?lingua=es` (e `&precarico=0` per la pagina senza la riga nel Blade).
 * Prima del tag zr-core le lancia su `layout.html` e su `staff.html`, in italiano, in inglese e in spagnolo (dalla v4.5.1), e
 * dalla v4.13.0 anche su `cliente.html` (con `--cliente`).
 *
 * Dalla v4.33.0 con `--barra` le righe AV guardano la barra d'avanzamento di Inertia durante una visita lenta (#3535).
 * Dalla v4.32.0 le righe MV guardano, a 390 px, che con `prefers-reduced-motion: reduce` non ci siano transizioni (#3534).
 *
 * Una riga per controllo: ✅ passa, ❌ non passa, ➖ non provato (con il perché). Esce con 1 se una riga è ❌.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const argomenti = process.argv.slice(2);
const opzione = (nome, altrimenti) => {
    const posto = argomenti.indexOf(nome);
    return posto >= 0 ? argomenti.splice(posto, 2)[1] : altrimenti;
};
const parola = opzione('--parola', 'pro');
// --staff (dalla v3.16.0): la pagina ha la cornice dello staff (`CorniceDelloStaff`), senza selettore, «+» e notifiche: girano
// axe, la ricerca, Esc, i menu e il cassetto, i font e le righe S, e dalla v3.17.0 le righe TO del Toast (`staff.html` con `toast=1`,
// che la pagina dei moduli non ha: lì sono ➖), dalla v4.1.1 N.1-N.2, Q.1 e D.1-D.2, e dalla v4.3.0 S.4 (`configurazione=0`) e
// S.5 (`invio=1`), dalla v4.5.0 S.6 (`ruolo` e `fino`) e dalla v4.5.1 S.7 (`fino` domani). Prima del tag zr-core la lancia su `staff.html --parola uat`.
const conLoStaff = argomenti.includes('--staff') && argomenti.splice(argomenti.indexOf('--staff'), 1).length > 0;
// --cliente (dalla v4.13.0, #3319): la pagina ha la cornice del cliente (`CorniceDelCliente`), senza la ricerca, che non si vede, e
// senza «+»: girano axe, i menu, le linguette della campanella vuota, il selettore, il percorso, il cassetto, i font, la CSP e le
// righe CL. Prima del tag zr-core la lancia su `cliente.html`, e su `cliente.html?aziende=1&nuovo=1` per il selettore con le aziende.
const colCliente = argomenti.includes('--cliente') && argomenti.splice(argomenti.indexOf('--cliente'), 1).length > 0;
// --spazio (dalla v4.25.0, #3417): la cornice dei membri ha la prop `spazio`, e girano le righe SP. Prima del tag zr-core la lancia
// su `layout.html?spazio=1` in italiano, spagnolo e inglese.
const colloSpazio = argomenti.includes('--spazio') && argomenti.splice(argomenti.indexOf('--spazio'), 1).length > 0;
// --barra (dalla v4.32.0, #3535): la pagina ha la barra d'avanzamento di Inertia con `includeCSS: false`, e girano le righe AV.
// Prima del tag zr-core la lancia su `layout.html?barra=1`, che ha la visita lenta («UAT alla Corta lenta»); su una pagina del
// modulo con `--barra` si clicca il primo collegamento interno della pagina, e la barra si vede solo se la risposta tarda.
const conLaBarra = argomenti.includes('--barra') && argomenti.splice(argomenti.indexOf('--barra'), 1).length > 0;
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

/** La pagina della UAT, come l'ha data il browser dopo l'ingresso, e come ci si torna: la scrive `uat`, a ogni misura. */
let pagina = '';
let tornaAllaPagina = async () => undefined;
/** Un clic (un risultato, una voce del percorso) ha portato altrove, magari in un altro modulo con un'altra cornice. */
const fuoriDallaPagina = (page) => page.url() !== pagina;

/**
 * Le violazioni di axe, divise fra la cornice e la pagina del modulo. È della pagina ciò che sta nel contenuto (`main`
 * dell'`AppShell`, fuori dal percorso e tranne il `main` stesso); il resto è della cornice.
 */
async function violazioni(page) {
    await page.evaluate(axe);
    // Senza `preload`: axe chiederebbe con `fetch` i fogli di stile da sé, e un foglio che la CSP della pagina non ammette (fino
    // alla v3.17 quello dei font di Google, che la CSP apriva solo a `style-src` e `font-src`) darebbe errori in console che sono
    // di axe, non della pagina, e farebbero rosse E.1 e R.C. Senza, axe non usa i fogli caricati da sé: la regola che ne ha bisogno
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
    let nascoste;
    if (stato !== 'risultati') {
        scrivi('➖', `${id}.3`, 'il pannello coi risultati nel giro del Tab (#2720)', `«${parola}» non trova niente (stato: ${stato}): rilanciare con --parola`);
    } else {
        const pannello = await page.evaluate(() => {
            const elemento = document.querySelector('.zr-shell .zr-top > .zr-search > .zr-search-panel');
            return [elemento?.getAttribute('tabindex'), elemento?.getAttribute('role'), elemento?.getAttribute('aria-label'), !!elemento && elemento.scrollHeight > elemento.clientHeight];
        });
        // R390.4 col fuoco ancora nel campo: dalla v4.18.0 il Tab da un pannello che non scorre esce dalla ricerca e la chiude.
        if (!largo) {
            nascoste = await page.evaluate(() => {
                const azioni = document.querySelector('.zr-shell .zr-top > .zr-top-actions');
                return azioni ? getComputedStyle(azioni).visibility : 'nessuna';
            });
        }
        await page.keyboard.press('Tab');
        await pausa(200);
        const fuocoNelPannello = await page.evaluate(() => document.activeElement?.matches('.zr-search-panel') ?? false);
        nelPannello = fuocoNelPannello;
        // Dalla v4.18.0 (lotto 0518, richieste 129 e 131) la fermata la dà l'`AppShell` finché il pannello scorre: un pannello che
        // non scorre non è una fermata (axe `scrollable-region-focusable` non lo chiede), e il Tab va oltre.
        const bene = pannello[1] === 'group' && !!pannello[2] && (pannello[3] ? pannello[0] === '0' && fuocoNelPannello : pannello[0] === null && !fuocoNelPannello);
        scrivi(bene ? '✅' : '❌', `${id}.3`, 'il pannello coi risultati, quando scorre, è una fermata del Tab, un gruppo col suo nome (#2720)', `${pannello[3] ? 'scorre' : 'non scorre'}, tabindex=${pannello[0]}, role=${pannello[1]}, nome «${pannello[2]}», Tab dal campo → ${fuocoNelPannello ? 'pannello' : 'altrove'}`);
        await page.screenshot({ path: join(cartella, `ricerca-tab-${largo ? 1280 : 390}.png`) });
    }
    if (!largo) {
        nascoste ??= await page.evaluate(() => {
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
        // Dalla v3.10.0 il fuoco va al campo (#2800): a 390 px il campo col fuoco copre ancora la barra, che torna intera quando lo lascia.
        const dopo = await page.evaluate(() => ({
            aperta: !!document.querySelector('.zr-shell .zr-top > .zr-search.is-open'),
            nelCampo: !!document.activeElement?.matches('.zr-search input'),
            azioni: getComputedStyle(document.querySelector('.zr-shell .zr-top > .zr-top-actions') ?? document.body).visibility,
        }));
        await page.evaluate(() => document.activeElement?.blur());
        await pausa(300);
        const fuori = await page.evaluate(() => getComputedStyle(document.querySelector('.zr-shell .zr-top > .zr-top-actions') ?? document.body).visibility);
        scrivi(!dopo.aperta && dopo.nelCampo && fuori !== 'hidden' ? '✅' : '❌', `${id}.6`, 'Esc col fuoco nel pannello chiude la ricerca e porta il fuoco al campo; uscito il fuoco dal campo, la barra in alto torna intera', `aperta: ${dopo.aperta}, fuoco nel campo: ${dopo.nelCampo}, azioni col fuoco nel campo: ${dopo.azioni}, dopo: ${fuori}`);
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
            // Il risultato può aprire la sua risorsa con una visita che arriva dopo (03/11/2026: il contatto del CRM, la cui scheda si
            // apre e prende il fuoco quando la riga 8 ha già premuto Ctrl+K): si aspetta l'indirizzo nuovo, al più tre secondi, prima di
            // dire dove siamo. `waitForLoadState` non serve: la pagina è già ferma e risponde subito.
            await page.waitForURL((nuovo) => nuovo.href !== pagina, { timeout: 3000 }).catch(() => undefined);
            await pausa(300);
            const dopo = await page.evaluate(() => ({
                valore: document.querySelector('.zr-shell .zr-top > .zr-search input')?.value,
                aperta: !!document.querySelector('.zr-shell .zr-top > .zr-search.is-open'),
            }));
            // In un modulo vero il risultato apre la sua risorsa, anche in un altro modulo (31/10/2026: un contatto del CRM, con
            // un'altra versione di zr-core): lì il campo vuoto è quello della pagina nuova, e la riga non si giudica. Si torna
            // alla pagina, o tutte le righe dopo proverebbero la cornice dell'altro modulo.
            if (fuoriDallaPagina(page)) {
                scrivi('➖', `${id}.7`, 'scelto un risultato il campo si svuota (riga 60)', `il risultato ha aperto ${page.url()}: la riga si prova sulle pagine di prova`);
                await tornaAllaPagina();
            } else {
                scrivi(dopo.valore === '' && !dopo.aperta ? '✅' : '❌', `${id}.7`, 'scelto un risultato col clic il campo si svuota e la ricerca resta chiusa (riga 60)', `valore «${dopo.valore}», aperta: ${dopo.aperta}`);
            }
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
    // A 720 px o meno le azioni della barra stanno nascoste sotto la ricerca aperta (#2627): col Tab dalla ricerca il fuoco deve
    // arrivare a campanella e profilo prima del contenuto (#2805, regressione della v3.4.0, rimedio della v3.10.0).
    if (!largo) {
        await page.keyboard.press('Control+k');
        await page.keyboard.type(parola);
        await pausa(800);
        const passi = [];
        for (let i = 0; i < 6; i++) {
            await page.keyboard.press('Tab');
            await pausa(200);
            const dove = await page.evaluate(() => {
                const a = document.activeElement;
                return a?.closest('.zr-search') ? 'ricerca' : a?.matches('.zr-bell') ? 'campanella' : a?.matches('.zr-avatar-btn') ? 'profilo' : a?.closest('.zr-top-actions') ? 'barra' : a?.closest('main') ? 'contenuto' : a?.tagName.toLowerCase() ?? 'niente';
            });
            passi.push(dove);
            if (dove === 'contenuto') break;
        }
        const fuori = passi.filter((dove) => dove !== 'ricerca');
        const bene = fuori[0] !== 'contenuto' && fuori.indexOf('campanella') > -1 && fuori.indexOf('campanella') < fuori.indexOf('profilo') && (fuori.indexOf('contenuto') === -1 || fuori.indexOf('profilo') < fuori.indexOf('contenuto'));
        scrivi(bene ? '✅' : '❌', `${id}.9`, 'col Tab dalla ricerca aperta il fuoco arriva a campanella e profilo prima del contenuto (#2805)', passi.join(' → '));
        await page.keyboard.press('Escape');
        await pausa(300);
    }
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
        tag: document.querySelector('.zr-notif .zr-pop-head')?.tagName.toLowerCase(),
        ore: [...document.querySelectorAll('.zr-notif .zr-notif-meta')].map((riga) => riga.textContent ?? ''),
    }));
    scrivi(pannello.aperto && pannello.fuoco ? '✅' : '❌', `${id}.1`, 'la campanella apre il pannello e il fuoco entra nel pannello', `aperto: ${pannello.aperto}, fuoco dentro: ${pannello.fuoco}`);
    // Dalla v4.18.0 (lotto 0518, richiesta 124) la testa è un `div` dell'`AppShell`, senza ruolo; prima un `header` con `role="none"`.
    scrivi(pannello.testa === 'none' || (pannello.testa === null && pannello.tag === 'div') ? '✅' : '❌', `${id}.2`, 'la testa del pannello non è un punto di riferimento (#2627)', `<${pannello.tag}> role=${pannello.testa}`);
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
    // Una voce può aprire una pagina del modulo (Bookings, 31/10/2026: «Nuova prenotazione per un cliente» passa da una
    // visita di Inertia e apre un dialogo): si aspetta il dialogo per un secondo e mezzo, e senza si misura il ritorno al «+».
    await page.waitForFunction(() => document.activeElement?.closest('dialog[open], [role=dialog][aria-modal=true]'), null, { timeout: 1500 }).catch(() => undefined);
    await pausa(300);
    const dopo = await page.evaluate(() => ({ menu: !!document.querySelector('[role=menu]'), piu: document.activeElement?.matches('.zr-shell .zr-create') ?? false, attivo: document.activeElement?.tagName, nelDialogo: !!document.activeElement?.closest('dialog[open], [role=dialog][aria-modal=true]') }));
    if (dopo.nelDialogo) {
        // La voce ha aperto un dialogo del modulo, che prende il fuoco (31/10/2026, «Nuova prenotazione per un cliente» di
        // Bookings): è giusto così, e il ritorno al «+» alla chiusura lo prova P.3.
        scrivi('➖', 'P.2', 'scelta una voce del menu «+» con Invio, il fuoco torna al «+» (riga 11)', `la voce ha aperto un dialogo, col fuoco dentro${fuoriDallaPagina(page) ? ` (${page.url()})` : ''}: la riga si prova con una voce che non apre niente`);
        await page.keyboard.press('Escape');
        await pausa(300);
    } else {
        scrivi(sullaVoce && !dopo.menu && dopo.piu ? '✅' : '❌', 'P.2', 'scelta una voce del menu «+» con Invio, il fuoco torna al «+» (riga 11)', `voce col fuoco: ${sullaVoce}, menu aperto: ${dopo.menu}, fuoco su ${dopo.piu ? '«+»' : dopo.attivo}`);
    }
}

// L'ultima voce del «+», se apre un dialogo: chiuso con Esc, il fuoco torna al «+» (#2822, Decisione 18962). Il dialogo si
// ricorda chi aveva il fuoco quando si è aperto, e la voce esce col menu. Sulle pagine di prova «UAT Cartella» apre un `<dialog>`
// del browser, come il «Nuova board» di zr-board. È l'ultima prova a 1280 px: se la voce porta altrove, la pagina si riapre.
async function dialogoDalPiu(page) {
    const nome = 'l\'ultima voce del «+» apre un dialogo: chiuso con Esc, il fuoco torna al «+» (#2822)';
    const aperto = () => page.evaluate(() => !!document.querySelector('dialog[open], .zr-scrim:not(.is-inline) > .zr-dialog'));
    if (!(await page.locator('.zr-shell .zr-create').count())) {
        scrivi('➖', 'P.3', nome, 'la pagina non ha il «+»: il modulo non dà `create`');
        return;
    }
    await page.focus('.zr-shell .zr-create');
    await page.keyboard.press('Enter');
    await pausa(300);
    await page.keyboard.press('End');
    await pausa(100);
    await page.keyboard.press('Enter');
    await pausa(500);
    if (!(await aperto())) {
        scrivi('➖', 'P.3', nome, 'l\'ultima voce del «+» non apre un dialogo');
        return;
    }
    await page.screenshot({ path: join(cartella, 'piu-dialogo-1280.png') });
    await page.keyboard.press('Escape');
    await pausa(400);
    const chiuso = !(await aperto());
    const dopo = await page.evaluate(() => ({ piu: document.activeElement?.matches('.zr-shell .zr-create') ?? false, attivo: document.activeElement?.tagName }));
    scrivi(chiuso && dopo.piu ? '✅' : '❌', 'P.3', nome, `dialogo chiuso: ${chiuso}, fuoco su ${dopo.piu ? '«+»' : dopo.attivo}`);
}

// Un `Dialog` aperto col mouse prende il fuoco sul suo primo elemento, e chiuso col mouse dalla sua «×» lo rende al pulsante che
// lo ha aperto (#2871; dal lotto 0522, richiesta 4, lo fa il `Dialog` del design system, e il rimedio della v3.14.2 è tolto). Il
// `Dialog` è quello vero della pagina di prova del layout con `?dialogo=1` (`DialogoDelDesignSystem`): un dialogo finto, senza
// React, il fuoco non lo prende più da nessuno. Nel corpo un campo nascosto e un pulsante spento, che il fuoco non prende.
// Una pagina senza quel pulsante dà ➖.
async function dialogoColMouse(page) {
    const nome = 'un `Dialog` aperto col mouse prende il fuoco sul primo elemento che lo prende; chiuso con la «×», il fuoco torna al pulsante che lo ha aperto (#2871)';
    const dialogo = '.zr-scrim:not(.is-inline) > .zr-dialog';
    if (!(await page.$('[data-uat="apre-ds"]'))) {
        scrivi('➖', 'G.1', nome, 'la pagina non ha un `Dialog` del design system da aprire (la pagina di prova del layout con `?dialogo=1`)');
        return;
    }
    await page.click('[data-uat="apre-ds"]');
    await pausa(400);
    const dentro = await page.evaluate((sel) => [!!document.activeElement?.closest(sel), document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName], dialogo);
    await page.screenshot({ path: join(cartella, 'dialogo-col-mouse-1280.png') });
    await page.click(`${dialogo} .zr-dialog-head button`);
    await pausa(400);
    const dopo = await page.evaluate((sel) => [!document.querySelector(sel), document.activeElement?.matches('[data-uat="apre-ds"]') ?? false, document.activeElement?.tagName], dialogo);
    scrivi(dentro[0] && dopo[0] && dopo[1] ? '✅' : '❌', 'G.1', nome, `fuoco nel dialogo: ${dentro[0]} («${dentro[1]}»); dialogo chiuso: ${dopo[0]}, fuoco su ${dopo[1] ? 'il pulsante che lo ha aperto' : dopo[2]}`);
}

// Un «Attendi» — un `Dialog` senza niente che prenda il fuoco — aperto dal «Salva» di un dialogo che subito dopo si chiude: il
// fuoco va sull'«Attendi», che lo prende su di sé, e non torna al pulsante dietro il velo, dove Invio lo premerebbe (v3.14.3,
// Decisione 19428; dal lotto 0522 lo fa il `Dialog`). Gli stessi dialoghi veri di G.1; senza, ➖.
async function attendiDaUnDialogo(page) {
    const nome = 'un «Attendi» senza elementi aperto da un dialogo che si chiude prende il fuoco su di sé; il fuoco non torna al pulsante dietro il velo (v3.14.3)';
    if (!(await page.$('[data-uat="apre-ds"]'))) {
        scrivi('➖', 'G.2', nome, 'la pagina non ha un `Dialog` del design system da aprire (la pagina di prova del layout con `?dialogo=1`)');
        return;
    }
    await page.click('[data-uat="apre-ds"]');
    await pausa(400);
    await page.click('[data-uat="salva-ds"]');
    await pausa(400);
    const dove = await page.evaluate(() => {
        const aperti = [...document.querySelectorAll('.zr-scrim:not(.is-inline) > .zr-dialog')];
        const attivo = document.activeElement;

        return [aperti.length, !!attivo && aperti.includes(attivo) && !attivo.querySelector('button, a[href], input, select, textarea'), attivo?.matches('[data-uat="apre-ds"]') ?? false, attivo?.tagName];
    });
    await page.screenshot({ path: join(cartella, 'attendi-1280.png') });
    await pausa(2200);
    scrivi(dove[0] === 1 && dove[1] && !dove[2] ? '✅' : '❌', 'G.2', nome, `dialoghi aperti: ${dove[0]}; fuoco ${dove[1] ? 'sull\'«Attendi»' : `su «${dove[3]}»`}`);
}

// Il selettore dei workspace e il pulsante del profilo prendono il nome dal testo che si vede (axe `label-content-name-mismatch`,
// righe 240 e 241, rimedio della v4.26.1 nel pezzo dei rimedi): nessun `aria-label`, e l'azione nella descrizione.
async function nomiDaiTesti(page) {
    const visti = await page.evaluate(() => ['.zr-ws-switch', '.zr-avatar-btn'].flatMap((qui) => {
        const pulsante = document.querySelector(`.zr-shell ${qui}`);
        // Il nome dal contenuto: i testi che non sono nascosti (nel selettore l'azienda col nome del workspace lo è), o l'immagine delle iniziali.
        const testi = [...pulsante?.querySelectorAll('.zr-ws-text > span:not([aria-hidden="true"]), .zr-avatar[aria-label]') ?? []].map((pezzo) => pezzo.getAttribute('aria-label') ?? pezzo.textContent?.trim()).filter(Boolean);
        const righe = [...pulsante?.querySelectorAll('.zr-ws-text > span') ?? []];
        const doppio = righe.length === 2 && righe[0].textContent === righe[1].textContent;
        return pulsante ? [[qui, pulsante.getAttribute('aria-label'), pulsante.getAttribute('aria-description'), testi.join(' '), righe.length === 0 || righe[0].getAttribute('aria-hidden') === String(doppio)]] : [];
    }));
    scrivi(visti.length > 0 && visti.every(([, nome, descrizione, contenuto, nascosta]) => nome === null && !!descrizione && !!contenuto && nascosta) ? '✅' : '❌', 'NM.1', 'il selettore dei workspace e il pulsante del profilo prendono il nome dal testo che si vede, con l\'azione nella descrizione (righe 240 e 241)', visti.map(([qui, nome, descrizione, contenuto, nascosta]) => `${qui}: aria-label «${nome}», descrizione «${descrizione}», nome dal contenuto «${contenuto}», azienda doppia nascosta: ${nascosta}`).join('; '));
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
    if (fine.ultima < 1) {
        // Una voce sola (31/10/2026, il workspace della UAT di Bookings): Home e Fine vanno tutti e due lì, e non dicono niente.
        scrivi('➖', 'S.1', 'Home e Fine nel selettore dei workspace (riga 48)', `il selettore ha ${fine.ultima + 1} voce: servono almeno due workspace`);
    } else {
        scrivi(fine.qui === fine.ultima && inizio.qui === 0 && inizio.aperto ? '✅' : '❌', 'S.1', 'nel selettore dei workspace Fine va all\'ultima voce e Home alla prima (riga 48)', `Fine: voce ${fine.qui} di 0-${fine.ultima}, Home: voce ${inizio.qui}, aperto: ${inizio.aperto}`);
    }
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
 * Il pannello delle notifiche aperto è vuoto: niente da raggiungere col Tab oltre alle linguette, né righe né «Vedi tutte» (lo
 * staff, a cui non arrivano notifiche, o una persona senza notifiche: voce #2986). Solo allora N.2 e D.2 si provano in un altro
 * modo; un pannello con notifiche che ha perso le righe o il piede resta ❌ (revisione dello sprint 100, R1-R2).
 */
const pannelloVuoto = (page) => page.evaluate(() => {
    const pannello = document.querySelector('.zr-top-actions > .zr-pop');
    return !!pannello && ![...pannello.querySelectorAll('button, a[href], [tabindex]')].some((e) => e.getAttribute('role') !== 'tab' && e.tabIndex >= 0);
});

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
    // Un pannello senza «Vedi tutte» (lo staff, a cui non arrivano notifiche: voce #2986) si prova con la sua ultima linguetta.
    // Così anche quello del cliente, dalla v4.23.0 con le notifiche da cliente (voce 3398): ha le righe, ma una pagina delle
    // notifiche del cliente non c'è, e il piede nemmeno.
    const piede = !colCliente && !(await pannelloVuoto(page));
    const [notifiche, comeNotifiche] = await coperto('.zr-top-actions > .zr-pop', piede ? '.zr-top-actions > .zr-pop .zr-pop-foot button' : '.zr-top-actions > .zr-pop [role=tab]');
    scrivi(notifiche ? '✅' : '❌', 'D.2', 'il pannello delle notifiche sta sopra il pannello di dettaglio (riga 102)', `${piede ? '«Vedi tutte»' : 'senza «Vedi tutte», l\'ultima linguetta'}: ${comeNotifiche}`);
    await page.screenshot({ path: join(cartella, 'pannello-notifiche-1280.png') });
    await page.keyboard.press('Escape');
    await pausa(300);
    await page.evaluate(() => document.querySelector('.zr-detail[data-uat]')?.remove());
}

// Esc nella ricerca e nel cassetto (#2800, #2807; rimedi della v3.10.0): il fuoco non finisce sul documento.
async function escNellaBarra(page, largo) {
    const id = largo ? 'K' : 'K390';
    const leggi = () => page.evaluate(() => ({
        aperta: !!document.querySelector('.zr-shell .zr-top > .zr-search.is-open'),
        espansa: document.querySelector('.zr-shell .zr-top > .zr-search input')?.getAttribute('aria-expanded'),
        cassetto: document.querySelector('.zr-shell .zr-top-menu')?.getAttribute('aria-expanded'),
        valore: document.querySelector('.zr-shell .zr-top > .zr-search input')?.value,
        fuoco: document.activeElement?.matches('.zr-search input') ? 'campo' : document.activeElement?.matches('.zr-top-menu') ? 'menu' : document.activeElement === document.body ? 'documento' : document.activeElement?.tagName.toLowerCase(),
    }));
    const descrivi = (stato) => `ricerca aperta: ${stato.aperta}, aria-expanded: ${stato.espansa}, cassetto: ${stato.cassetto}, fuoco: ${stato.fuoco}, valore «${stato.valore}»`;
    await page.keyboard.press('Control+k');
    await page.keyboard.type(parola);
    await pausa(800);
    await page.keyboard.press('Escape');
    await pausa(300);
    const uno = await leggi();
    scrivi(!uno.aperta && uno.espansa === 'false' && uno.fuoco === 'campo' ? '✅' : '❌', `${id}.1`, 'Esc dal campo chiude la ricerca e il fuoco resta nel campo (#2800)', descrivi(uno));
    await page.keyboard.press('Escape');
    await pausa(300);
    const due = await leggi();
    scrivi(!due.aperta && due.fuoco === 'campo' && due.valore === parola ? '✅' : '❌', `${id}.2`, 'un secondo Esc lascia la parola nel campo, col fuoco (#2800, scelta del README)', descrivi(due));
    await page.evaluate(() => document.activeElement?.blur());
    if (largo) {
        return;
    }
    await page.click('.zr-shell .zr-top-menu');
    await pausa(300);
    await page.evaluate(() => document.querySelector('.zr-shell > .zr-side a[href]')?.focus());
    await page.keyboard.press('Escape');
    await pausa(300);
    const tre = await leggi();
    scrivi(tre.cassetto === 'false' && tre.fuoco === 'menu' ? '✅' : '❌', `${id}.3`, 'cassetto aperto, Esc da una sua voce: chiuso, fuoco su «Apri il menu» (#2807)', descrivi(tre));
    await page.click('.zr-shell .zr-top-menu');
    await pausa(300);
    await page.focus('.zr-shell .zr-top > .zr-search input');
    await pausa(300);
    await page.keyboard.press('Escape');
    await pausa(300);
    const quattro = await leggi();
    scrivi(quattro.cassetto === 'false' && !quattro.aperta && quattro.fuoco === 'campo' ? '✅' : '❌', `${id}.4`, 'cassetto aperto, Esc dal campo della ricerca: chiusi cassetto e ricerca, fuoco nel campo (#2807)', descrivi(quattro));
    await page.evaluate(() => document.activeElement?.blur());
}

// Il menu a cassetto a 390 px (#2806, rimedio della v3.10.0): aperto con la tastiera il fuoco entra, il Tab resta dentro
// (voci e pulsante), chiuso col pulsante il fuoco è su «Apri il menu».
async function cassetto(page) {
    const dove = () => page.evaluate(() => {
        const a = document.activeElement;
        return a?.matches('.zr-top-menu') ? 'pulsante' : a?.closest('.zr-shell > .zr-side') ? 'cassetto' : a?.closest('.zr-search') ? 'ricerca' : a?.closest('main') ? 'contenuto' : a?.tagName.toLowerCase() ?? 'niente';
    });
    const aperto = () => page.evaluate(() => document.querySelector('.zr-shell .zr-top-menu')?.getAttribute('aria-expanded'));
    await page.focus('.zr-shell .zr-top-menu');
    await page.keyboard.press('Enter');
    await pausa(300);
    const entrato = await dove();
    scrivi((await aperto()) === 'true' && entrato === 'cassetto' ? '✅' : '❌', 'K390.5', 'Invio su «Apri il menu»: il cassetto si apre e il fuoco è sulla sua prima voce (#2806)', `fuoco: ${entrato}`);
    // Dalla prima voce, tanti Tab quante sono le fermate del cassetto più uno: il giro passa dal pulsante e rientra.
    const fermate = await page.evaluate(() => [...document.querySelectorAll('.zr-shell > .zr-side :is(a[href], button, input, select, textarea, [tabindex])')]
        .filter((e) => e.tabIndex >= 0 && !e.matches(':disabled') && e.checkVisibility()).length);
    const giro = [];
    for (const tasto of [...Array(fermate + 1).fill('Tab'), 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
        await page.keyboard.press(tasto);
        await pausa(100);
        giro.push(await dove());
    }
    scrivi(giro.every((qui) => qui === 'cassetto' || qui === 'pulsante') && giro.includes('pulsante') ? '✅' : '❌', 'K390.6', 'col cassetto aperto Tab e Maiusc+Tab restano fra le voci e il pulsante (#2806)', giro.join(' → '));
    await page.focus('.zr-shell .zr-top-menu');
    await page.keyboard.press('Enter');
    await pausa(300);
    const chiuso = await dove();
    scrivi((await aperto()) === 'false' && chiuso === 'pulsante' ? '✅' : '❌', 'K390.7', 'chiuso il cassetto col pulsante, il fuoco è su «Apri il menu» (#2806)', `aperto: ${await aperto()}, fuoco: ${chiuso}`);
    // Riga 136 (#2826, v3.12.0): col cassetto aperto, Esc in un `<dialog>` del browser o già gestito dalla pagina chiude solo il suo.
    for (const [id, come, prepara] of [
        ['K390.8', 'Esc in un `<dialog>` modale aperto sopra chiude il dialogo e lascia il cassetto aperto', () => {
            const dialogo = document.body.appendChild(document.createElement('dialog'));
            dialogo.className = 'uat-136';
            dialogo.innerHTML = '<button>ok</button>';
            dialogo.showModal();
            dialogo.querySelector('button').focus();
        }],
        ['K390.9', 'Esc che la pagina ha già gestito (`preventDefault`) lascia il cassetto aperto', () => {
            const campo = document.querySelector('.zr-shell > .zr-side').appendChild(document.createElement('input'));
            campo.className = 'uat-136';
            campo.addEventListener('keydown', (tasto) => tasto.preventDefault());
            campo.focus();
        }],
    ]) {
        // Il clic dal DOM: col cassetto aperto la barra laterale sta sopra il pulsante.
        await page.evaluate(() => document.querySelector('.zr-shell .zr-top-menu').click());
        await pausa(300);
        await page.evaluate(prepara);
        await page.keyboard.press('Escape');
        await pausa(300);
        const esito = await page.evaluate(() => ({ cassetto: document.querySelector('.zr-shell .zr-top-menu')?.getAttribute('aria-expanded'), dialogo: !!document.querySelector('dialog[open]') }));
        scrivi(esito.cassetto === 'true' && !esito.dialogo ? '✅' : '❌', id, `${come} (riga 136, #2826)`, `cassetto aperto: ${esito.cassetto}, dialogo aperto: ${esito.dialogo}`);
        await page.evaluate(() => document.querySelectorAll('.uat-136').forEach((e) => e.remove()));
        if (esito.cassetto === 'true') {
            await page.evaluate(() => document.querySelector('.zr-shell .zr-top-menu').click());
            await pausa(300);
        }
    }
    // Riga 111 (#2341, v3.14.0): il cassetto aperto dice di essere una finestra, non modale; chiuso col velo, non più.
    const finestra = () => page.evaluate(() => ['role', 'aria-modal', 'aria-label'].map((nome) => document.querySelector('.zr-shell > .zr-side')?.getAttribute(nome) ?? '-').join(' '));
    await page.evaluate(() => document.querySelector('.zr-shell .zr-top-menu').click());
    await pausa(300);
    const daAperto = await finestra();
    await page.evaluate(() => document.querySelector('.zr-shell .zr-side-scrim')?.click());
    await pausa(300);
    const daChiuso = await finestra();
    scrivi(/^dialog - [^-]/.test(daAperto) && /^- - [^-]/.test(daChiuso) ? '✅' : '❌', 'K390.10', 'il cassetto aperto ha `role="dialog"` col suo nome e senza `aria-modal`; chiuso col velo, nessun ruolo (riga 111, #2341)', `aperto: ${daAperto} · chiuso: ${daChiuso}`);
    // La finestra che si allarga col cassetto aperto: l'`AppShell` lo tiene aperto, il ruolo no (T1.2 di #2341).
    const misura = page.viewportSize();
    await page.evaluate(() => document.querySelector('.zr-shell .zr-top-menu').click());
    await pausa(300);
    await page.setViewportSize({ width: 1280, height: misura.height });
    await pausa(300);
    const allargata = await finestra();
    await page.setViewportSize(misura);
    await pausa(300);
    const ristretta = await finestra();
    scrivi(/^- /.test(allargata) && /^dialog /.test(ristretta) ? '✅' : '❌', 'K390.11', 'col cassetto aperto, la finestra allargata a 1280 px toglie il ruolo e ristretta lo rende (#2341)', `1280: ${allargata} · ${misura.width}: ${ristretta}`);
    if (await page.evaluate(() => document.querySelector('.zr-shell .zr-top-menu')?.getAttribute('aria-expanded')) === 'true') {
        await page.evaluate(() => document.querySelector('.zr-shell .zr-top-menu').click());
        await pausa(300);
    }
    // Il pannello di dettaglio a tutta pagina copre la barra in alto: Ctrl+K non apre la ricerca sotto di lui (sprint 89, R390.9
    // su una pagina di zr-home). Se la pagina non ne ha uno aperto, ne mette uno finto con un pulsante, come `sopraIlPannello`.
    const finto = await page.evaluate(() => {
        if (document.querySelector('.zr-detail:not(.is-inline)')) {
            return false;
        }
        const pannello = document.createElement('aside');
        pannello.className = 'zr-detail';
        pannello.dataset.uat = '';
        pannello.append(Object.assign(document.createElement('button'), { type: 'button', textContent: 'UAT' }));
        document.body.append(pannello);
        return true;
    });
    await page.evaluate(() => [...document.querySelectorAll('.zr-detail:not(.is-inline) :is(button, a[href], input)')].pop()?.focus());
    const nelPannello = () => page.evaluate(() => [!!document.querySelector('.zr-shell .zr-top > .zr-search.is-open'), !!document.activeElement?.closest('.zr-detail')]);
    const prima = await nelPannello();
    await page.keyboard.press('Control+k');
    await pausa(300);
    const conIlPannello = await nelPannello();
    await page.evaluate(() => document.querySelector('.zr-detail[data-uat]')?.remove());
    await page.evaluate(() => document.activeElement?.blur());
    let senza = [false, false];
    if (finto) {
        await page.keyboard.press('Control+k');
        await pausa(300);
        senza = await nelPannello();
        await page.keyboard.press('Escape');
        await pausa(300);
    }
    // Nella cornice del cliente Ctrl+K non apre la ricerca nemmeno senza pannello (CL.1): conta solo che col pannello il fuoco resti lì.
    scrivi(prima[1] && !conIlPannello[0] && conIlPannello[1] && (!finto || senza[0] || colCliente) ? '✅' : '❌', 'K390.12', 'col pannello di dettaglio a tutta pagina Ctrl+K non apre la ricerca e il fuoco resta nel pannello; senza, la apre (sprint 89)', `${finto ? 'pannello finto' : 'pannello della pagina'}; fuoco nel pannello prima: ${prima[1]}; dopo Ctrl+K ricerca aperta: ${conIlPannello[0]}, fuoco nel pannello: ${conIlPannello[1]}${finto ? `; senza pannello ricerca aperta: ${senza[0]}` : ''}`);
    await page.evaluate(() => document.activeElement?.blur());
}

// Il menu del profilo, il menu «+» e il pannello delle notifiche si chiudono quando il Tab porta il fuoco fuori (#2804,
// rimedio della v3.10.0), come il selettore dei workspace.
async function fuoriDaiMenu(page) {
    for (const [id, nome, pulsante, dentro] of [
        ['T.1', 'il menu del profilo', '.zr-avatar-btn', '.zr-profile-menu'],
        ['T.2', 'il menu «+»', '.zr-create', '.zr-menu'],
        ['T.3', 'il pannello delle notifiche', '.zr-bell', '.zr-notif'],
    ]) {
        if (!(await page.$(`.zr-shell ${pulsante}`))) {
            scrivi('➖', id, `${nome} si chiude quando il Tab esce (#2804)`, 'la pagina non ha il pulsante');
            continue;
        }
        await page.focus(`.zr-shell ${pulsante}`);
        await page.keyboard.press('Enter');
        await pausa(500);
        const aperto = await page.evaluate((sel) => document.querySelector(`.zr-shell ${sel}`)?.getAttribute('aria-expanded'), pulsante);
        // Tanti Tab quante le voci che prendono il fuoco nella zona, più qualcuno: in un modulo vero il pannello delle
        // notifiche ne ha decine (Board, 54).
        const voci = await page.evaluate((zona) => document.querySelectorAll(`.zr-shell ${zona} :is(a[href], button, input, select, textarea, [tabindex]):not([tabindex="-1"]):not(:disabled)`).length, dentro);
        let fuori = false;
        for (let i = 0; i < voci + 10 && !fuori; i++) {
            await page.keyboard.press('Tab');
            await pausa(100);
            fuori = await page.evaluate(([sel, zona]) => !document.activeElement?.closest(zona) && !document.activeElement?.matches(`.zr-shell ${sel}`), [pulsante, dentro]);
        }
        await pausa(200);
        const dopo = await page.evaluate((sel) => [document.querySelector(`.zr-shell ${sel}`)?.getAttribute('aria-expanded'), document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim().slice(0, 30)], pulsante);
        scrivi(aperto === 'true' && fuori && dopo[0] === 'false' ? '✅' : '❌', id, `${nome}, aperto con Invio, si chiude quando il Tab porta il fuoco fuori (#2804)`, `aperto: ${aperto}, uscito: ${fuori}, dopo: aria-expanded ${dopo[0]}, fuoco su «${dopo[1]}»`);
        await page.evaluate(() => document.activeElement?.blur());
        await page.keyboard.press('Escape');
        await pausa(200);
    }
}

async function inizioEFineNeiMenu(page) {
    for (const [id, nome, pulsante, menu] of [
        ['M.1', 'menu del profilo', '.zr-avatar-btn', '.zr-profile-menu'],
        ['M.2', 'menu «+»', '.zr-create', '.zr-side .zr-menu'],
    ]) {
        if (!(await page.$(`.zr-shell ${pulsante}`))) {
            scrivi('➖', id, `nel ${nome} Fine e Home vanno all'ultima e alla prima voce (#2802)`, 'la pagina non ha il pulsante');
            continue;
        }
        await page.focus(`.zr-shell ${pulsante}`);
        await page.keyboard.press('Enter');
        await pausa(500);
        const dove = () => page.evaluate((sel) => {
            const voci = [...document.querySelectorAll(`.zr-shell ${sel} [role="menuitem"]:not(:disabled)`)];
            return `${voci.indexOf(document.activeElement)} di 0-${voci.length - 1}`;
        }, menu);
        await page.keyboard.press('ArrowDown');
        await pausa(100);
        const giu = await dove();
        await page.keyboard.press('End');
        await pausa(100);
        const fine = await dove();
        await page.keyboard.press('Home');
        await pausa(100);
        const inizio = await dove();
        // Con due voci la freccia giù porta già all'ultima: Fine si prova di nuovo dopo Home.
        await page.keyboard.press('End');
        await pausa(100);
        const ancoraFine = await dove();
        const ultima = fine.split('-').at(-1);
        if (Number(ultima) < 1) {
            scrivi('➖', id, `nel ${nome} Fine e Home vanno all'ultima e alla prima voce (#2802)`, `il menu ha una voce sola (${fine})`);
        } else {
            scrivi(fine === `${ultima} di 0-${ultima}` && inizio.startsWith('0 di') && ancoraFine === fine ? '✅' : '❌', id, `nel ${nome}, aperto con Invio, Fine va all'ultima voce e Home alla prima (#2802)`, `freccia giù: voce ${giu}, Fine: voce ${fine}, Home: voce ${inizio}, Fine: voce ${ancoraFine}`);
        }
        await page.keyboard.press('Escape');
        await pausa(200);
    }
}

async function linguetteDelleNotifiche(page) {
    if (!(await page.$('.zr-shell .zr-bell'))) {
        scrivi('➖', 'N.1', 'le linguette del pannello delle notifiche con le frecce (#2803)', 'la pagina non ha la campanella');
        return;
    }
    await page.focus('.zr-shell .zr-bell');
    await page.keyboard.press('Enter');
    await pausa(500);
    /** Su quale linguetta sta il fuoco e quale è scelta: «-» se il fuoco non è su una linguetta. */
    const dove = () => page.evaluate(() => {
        const linguette = [...document.querySelectorAll('.zr-shell .zr-notif-tabs [role="tab"]')];
        return `fuoco ${linguette.indexOf(document.activeElement)}, scelta ${linguette.findIndex((linguetta) => linguetta.getAttribute('aria-selected') === 'true')}`;
    });
    const passi = [await dove()];
    for (const tasto of ['ArrowRight', 'ArrowLeft', 'End', 'Home']) {
        await page.keyboard.press(tasto);
        await pausa(150);
        passi.push(await dove());
    }
    const attesi = ['fuoco 0, scelta 0', 'fuoco 1, scelta 1', 'fuoco 0, scelta 0', 'fuoco 1, scelta 1', 'fuoco 0, scelta 0'];
    scrivi(passi.join() === attesi.join() ? '✅' : '❌', 'N.1', 'nel pannello delle notifiche, aperto con Invio, le frecce, Home e Fine passano fra «Per me» e «Tutte» e le scelgono (#2803)', passi.join(' → '));

    // Col fuoco sulla linguetta scelta, Tab va oltre le linguette e Maiusc+Tab torna a lei; scelta «Tutte», Maiusc+Tab non si ferma su «Per me».
    const linguetta = () => page.evaluate(() => document.activeElement?.getAttribute('role') === 'tab' ? document.activeElement.textContent : '-');
    const vuoto = await pannelloVuoto(page);
    await page.keyboard.press('Tab');
    await pausa(150);
    const avanti = await linguetta();
    if (vuoto && !(await page.$('.zr-top-actions > .zr-pop'))) {
        // Dopo le linguette il pannello non ha niente da raggiungere (lo staff, a cui non arrivano notifiche: voce #2986): il Tab esce
        // e il pannello si chiude (#2804), e il ritorno con Maiusc+Tab non si chiede. Si riapre, si sceglie «Tutte» e si prova da lì.
        await page.focus('.zr-shell .zr-bell');
        await page.keyboard.press('Enter');
        await pausa(500);
        await page.keyboard.press('ArrowRight');
        await pausa(150);
        await page.keyboard.press('Shift+Tab');
        await pausa(150);
        const primaDiTutte = await linguetta();
        scrivi(avanti === '-' && primaDiTutte === '-' ? '✅' : '❌', 'N.2', 'nel giro del Tab c\'è solo la linguetta scelta (#2803)', `Tab da «Per me»: ${avanti}, e il pannello si chiude (dopo le linguette non c'è niente); scelta «Tutte», Maiusc+Tab: ${primaDiTutte}`);
        await page.evaluate(() => document.activeElement?.blur());
        await page.keyboard.press('Escape');
        await pausa(200);
        return;
    }
    await page.keyboard.press('Shift+Tab');
    await pausa(150);
    const indietro = await linguetta();
    await page.keyboard.press('ArrowRight');
    await pausa(150);
    await page.keyboard.press('Shift+Tab');
    await pausa(150);
    const primaDiTutte = await linguetta();
    scrivi(avanti === '-' && indietro !== '-' && primaDiTutte === '-' ? '✅' : '❌', 'N.2', 'nel giro del Tab c\'è solo la linguetta scelta (#2803)', `Tab da «Per me»: ${avanti}; Maiusc+Tab: ${indietro}; scelta «Tutte», Maiusc+Tab: ${primaDiTutte}`);
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Escape');
    await pausa(200);
}

async function quantiRisultati(page) {
    const campo = '.zr-shell .zr-top > .zr-search input';
    if (!(await page.$(campo))) {
        scrivi('➖', 'Q.1', 'la zona di stato dice quanti risultati (#2801)', 'la pagina non ha il campo della ricerca');
        return;
    }
    await page.click(campo);
    await page.fill(campo, parola);
    let stato = '';
    for (let i = 0; i < 50 && !['risultati', 'vuoto', 'errore'].includes(stato); i++) {
        await pausa(100);
        stato = await page.evaluate(`(${statoDellaRicerca})()`);
    }
    await pausa(200);
    const letto = await page.evaluate(() => ({
        righe: document.querySelectorAll('.zr-shell .zr-search-panel [role=option]').length,
        // Dalla v4.18.0 (lotto 0518) la zona è dell'`AppShell`, dentro la ricerca; prima un `p` della cornice in fondo al `body`.
        zone: [...document.querySelectorAll('body > p[role=status], .zr-shell .zr-search > [role=status]')].map((zona) => zona.textContent).filter(Boolean),
    }));
    const ok = stato !== 'errore' && letto.zone.length === 1 && /\d/.test(letto.zone[0] ?? '') && letto.zone[0].includes(String(letto.righe));
    scrivi(stato === 'errore' ? '➖' : ok ? '✅' : '❌', 'Q.1', 'a ricerca finita la zona di stato dice quanti risultati ci sono, nella lingua della cornice (#2801)', `«${parola}»: ${stato}, ${letto.righe} righe, zona: ${letto.zone.map((zona) => `«${zona}»`).join(', ') || 'nessuna'}`);
    await page.keyboard.press('Escape');
    await page.fill(campo, '');
    await page.evaluate(() => document.activeElement?.blur());
    await pausa(200);
}

async function attivaInVista(page) {
    const campo = '.zr-shell .zr-top > .zr-search input';
    if (!(await page.$(campo))) {
        scrivi('➖', 'V.1', 'l\'opzione attiva scorre in vista (#2799)', 'la pagina non ha il campo della ricerca');
        return;
    }
    await page.click(campo);
    await page.fill(campo, parola);
    let stato = '';
    for (let i = 0; i < 50 && !['risultati', 'vuoto', 'errore'].includes(stato); i++) {
        await pausa(100);
        stato = await page.evaluate(`(${statoDellaRicerca})()`);
    }
    await pausa(200);
    /** Quante opzioni, quale è attiva, se il pannello scorre e se l'attiva sta tutta dentro ciò che del pannello si vede. */
    const dove = () => page.evaluate(() => {
        const opzioni = [...document.querySelectorAll('.zr-shell .zr-search-panel [role=option]')];
        const attiva = document.querySelector('.zr-shell .zr-search-panel [role=option][aria-selected=true]');
        let pannello = attiva?.parentElement;
        while (pannello && pannello.scrollHeight <= pannello.clientHeight && !pannello.matches('.zr-search')) pannello = pannello.parentElement;
        const a = attiva?.getBoundingClientRect();
        const p = pannello?.getBoundingClientRect();
        return { n: opzioni.length, i: opzioni.indexOf(attiva), scorre: !!pannello && !pannello.matches('.zr-search'), dentro: !!a && !!p && a.top >= p.top - 1 && a.bottom <= p.bottom + 1 };
    });
    const prima = await dove();
    if (stato !== 'risultati' || !prima.scorre) {
        scrivi('➖', 'V.1', 'l\'opzione attiva scorre in vista (#2799)', `«${parola}»: ${stato}, ${prima.n} opzioni, il pannello ${prima.scorre ? '' : 'non '}scorre: rilanciare con una parola che dia più risultati`);
    } else {
        for (let i = 1; i < prima.n; i++) {
            await page.keyboard.press('ArrowDown');
            await pausa(60);
        }
        await pausa(200);
        const giu = await dove();
        scrivi(giu.i === prima.n - 1 && giu.dentro ? '✅' : '❌', 'V.1', `dopo ${prima.n - 1} frecce giù l'opzione attiva, l'ultima, è nella parte visibile del pannello (#2799)`, `attiva ${giu.i} di ${prima.n}, in vista: ${giu.dentro}`);
        for (let i = 1; i < prima.n; i++) {
            await page.keyboard.press('ArrowUp');
            await pausa(60);
        }
        await pausa(200);
        const su = await dove();
        scrivi(su.i === 0 && su.dentro ? '✅' : '❌', 'V.2', 'con le frecce su fino in cima la prima opzione è di nuovo in vista (#2799)', `attiva ${su.i} di ${prima.n}, in vista: ${su.dentro}`);
    }
    await page.keyboard.press('Escape');
    await page.fill(campo, '');
    await page.evaluate(() => document.activeElement?.blur());
    await pausa(200);
}

// R.F (dalla `v3.15.0`, #2945): i due font del design system arrivano dal pacchetto, dall'origine della pagina, e nessuna richiesta
// va a Google Fonts in tutta la UAT. `document.fonts.load` dà le `@font-face` caricate per quella famiglia e quel peso: una
// famiglia senza `@font-face` darebbe un elenco vuoto, non un errore (e `document.fonts.check` direbbe sì anche lì).
async function fontDelPacchetto(page, diGoogle) {
    const font = await page.evaluate(async () => {
        const caricate = async (descrizione) => (await document.fonts.load(descrizione)).filter((faccia) => faccia.status === 'loaded').length;
        const woff2 = performance.getEntriesByType('resource').map((voce) => new URL(voce.name)).filter((url) => url.pathname.endsWith('.woff2'));
        return {
            bricolage: await caricate('600 16px "Bricolage Grotesque"'),
            instrument: await caricate('400 16px "Instrument Sans"'),
            dallOrigine: woff2.filter((url) => url.origin === location.origin).length,
            altrove: woff2.filter((url) => url.origin !== location.origin).map((url) => url.origin),
            // Un `preconnect` o un `dns-prefetch` non fa una richiesta che Playwright veda, ma apre la connessione: si cerca nel DOM.
            collegamenti: [...document.querySelectorAll('link[href]')].map((link) => `${link.rel} ${link.href}`).filter((voce) => /fonts\.(googleapis|gstatic)\.com/.test(voce)),
        };
    });
    const bene = font.bricolage > 0 && font.instrument > 0 && font.dallOrigine > 0 && font.altrove.length === 0 && diGoogle.length === 0 && font.collegamenti.length === 0;
    scrivi(bene ? '✅' : '❌', 'R.F', 'i font dal pacchetto: Bricolage Grotesque e Instrument Sans caricati dall\'origine della pagina, nessuna richiesta né collegamento a Google Fonts (#2945)', `Bricolage ${font.bricolage}, Instrument ${font.instrument}, woff2 dall'origine ${font.dallOrigine}${font.altrove.length ? `, altrove ${[...new Set(font.altrove)].join(' ')}` : ''}${diGoogle.length ? `; a Google: ${[...new Set(diGoogle)].slice(0, 3).join(' ')}` : ''}${font.collegamenti.length ? `; nel <head>: ${font.collegamenti.slice(0, 3).join(' | ')}` : ''}`);
}

// R.L (dalla `v4.4.0`, #3015): nel JS d'ingresso c'è solo l'italiano, e le altre lingue la cornice le chiede con `fetch`. Dalla
// prima riga del documento si tiene ogni testo che la cornice mette a schermo, e le richieste dei file delle lingue
// (`assets/<codice>-<impronta>.json`). R.L.1 la cornice è nella lingua della pagina in ogni testo dall'apertura (in italiano già
// al primo disegno, senza richieste di lingue), e dice quanto ha atteso; R.L.2 i precarichi della riga del Blade: quello della
// lingua della pagina, o dell'inglese per una lingua che zr-core non ha (fino alla `v4.30.0` anche l'inglese accanto all'altra
// lingua), nessuno in italiano, e ognuno preso dalla richiesta della cornice (senza il «preloaded but not used» di Chromium);
// R.L.3 con le lingue che non arrivano la cornice si disegna in italiano; R.L.4 (dalla `v4.31.0`, #3530) i file delle lingue
// chiesti dall'apertura sono della sola lingua della pagina: in spagnolo mai l'inglese. I testi «di una lingua sola»
// sono quelli lunghi, con uno spazio, che le altre due lingue non hanno: dai file del repo accanto allo script (con `--staff`
// anche quelli dello staff, che la sua cornice ha nel JS d'ingresso in tutte e tre le lingue, e con `--cliente` quelli del cliente).
const UN_FILE_DI_LINGUA = /\/(en|es)-[\w-]{8,}\.json(?:\?|$)/;
function testiDiUnaLinguaSola() {
    try {
        const di = (percorso) => Object.values(JSON.parse(readFileSync(fileURLToPath(new URL(`../resources/lingue/${percorso}.json`, import.meta.url)), 'utf8')));
        const lingue = Object.fromEntries(['it', 'en', 'es'].map((codice) => [codice, [...di(codice), ...(conLoStaff ? di(`staff/${codice}`) : []), ...(colCliente ? di(`cliente/${codice}`) : [])]]));
        return Object.fromEntries(Object.entries(lingue).map(([codice, testi]) => [codice, testi.filter((testo) => typeof testo === 'string' && testo.length > 10 && testo.includes(' ') && Object.entries(lingue).every(([altra, suoi]) => altra === codice || !suoi.includes(testo)))]));
    } catch {
        return null;
    }
}

/** Prima di aprire la pagina: il registro dei testi della cornice dalla prima riga del documento, per 10 secondi. */
async function registraLaLingua(page) {
    const richieste = [];
    const avvisi = [];
    page.on('request', (richiesta) => UN_FILE_DI_LINGUA.test(richiesta.url()) && richieste.push({ url: richiesta.url(), il: Date.now() }));
    page.on('console', (messaggio) => /preloaded using link preload but not used/.test(messaggio.text()) && avvisi.push(messaggio.text().slice(0, 200)));
    await page.addInitScript(() => {
        const registro = { testi: [], primo: null };
        window.__uatLingua = registro;
        const guarda = () => {
            const testo = document.querySelector('.zr-shell')?.textContent?.trim() ?? '';
            if (testo === '') return;
            registro.primo ??= Math.round(performance.now());
            if (registro.testi.at(-1) !== testo) registro.testi.push(testo);
        };
        const osservatore = new MutationObserver(guarda);
        osservatore.observe(document, { subtree: true, childList: true, characterData: true });
        setTimeout(() => osservatore.disconnect(), 10000);
    });
    return { richieste, avvisi, aperta: Date.now() };
}

async function laLingua(page, registrata) {
    const soli = testiDiUnaLinguaSola();
    const lingua = await page.evaluate(() => document.documentElement.lang);
    const codice = (lingua || 'it').toLowerCase().replace(/_/g, '-');
    const sua = [codice, codice.split('-')[0]].find((scelto) => ['it', 'en', 'es'].includes(scelto)) ?? 'en';
    const { testi, primo } = await page.evaluate(() => window.__uatLingua ?? { testi: [], primo: null });
    const precarichi = await page.evaluate(() => [...document.querySelectorAll('link[rel=preload][as=fetch]')].map((link) => `${link.href}${link.crossOrigin === null ? ' senza crossorigin' : ''}`));
    const dellaPrima = registrata.richieste.filter((richiesta) => richiesta.il < registrata.aperta + (primo ?? 0) + 2000);
    const nomi = (elenco) => [...new Set(elenco.map((uno) => new URL(uno.url ?? uno).pathname.split('/').pop()))].join(' ');
    if (!soli) {
        scrivi('➖', 'R.L.1', 'la cornice nella lingua della pagina dall\'apertura (#3015)', 'i file delle lingue non sono accanto allo script: si lancia dal repo di zr-core al tag');
    } else {
        const altrove = testi.flatMap((testo) => Object.entries(soli).filter(([altra]) => altra !== sua).flatMap(([altra, suoi]) => suoi.filter((uno) => testo.includes(uno)).map((uno) => `${altra}: «${uno}»`)));
        const nellaSua = testi.length > 0 && soli[sua].some((uno) => testi[0].includes(uno));
        const senzaRichieste = sua !== 'it' || dellaPrima.length === 0;
        scrivi(altrove.length === 0 && nellaSua && senzaRichieste ? '✅' : '❌', 'R.L.1', `la cornice in ${lingua || '(nessuna lingua)'} dall'apertura, in ogni testo: ${sua === 'it' ? 'al primo disegno, senza richieste di lingue' : 'dopo l\'attesa della sua lingua'} (#3015)`, `primo testo a ${primo ?? '—'} ms dall'apertura, ${testi.length} stati dei testi; lingue chieste: ${nomi(dellaPrima) || 'nessuna'}${altrove.length ? ` · in un'altra lingua: ${[...new Set(altrove)].slice(0, 3).join(' | ')}` : ''}${nellaSua ? '' : ' · il primo stato non è nella sua lingua'}`);
    }
    const attesi = sua === 'it' ? 0 : 1;
    // Le pagine di prova servite da servi-demo con `?lingua=` hanno i precarichi, salvo con `&precarico=0`: lì mancarli è un difetto.
    const promessi = /[?&]lingua=/.test(page.url()) && !/[?&]precarico=0(?:&|$)/.test(page.url());
    if (sua !== 'it' && precarichi.length === 0 && !promessi) {
        scrivi('➖', 'R.L.2', 'i precarichi della lingua nella testa della pagina (#3015)', 'la pagina non ne ha: manca la riga `Cornice::precaricoDellaLingua()` nel Blade, e la cornice aspetta un giro di rete in più');
    } else {
        const bene = precarichi.length === attesi && precarichi.every((uno) => !uno.endsWith('senza crossorigin') && new URL(uno.split(' ')[0]).pathname.split('/').pop().startsWith(`${sua}-`)) && registrata.avvisi.length === 0;
        scrivi(bene ? '✅' : '❌', 'R.L.2', `i precarichi della lingua nella testa della pagina: ${attesi} in ${lingua || 'italiano'}, ognuno preso dalla cornice (#3015)`, `${precarichi.map((uno) => uno.split('/').pop()).join(' ') || 'nessuno'}${registrata.avvisi.length ? ` · non usati: ${registrata.avvisi.join(' | ')}` : ''}`);
    }
    const altre = registrata.richieste.filter((richiesta) => !new URL(richiesta.url).pathname.split('/').pop().startsWith(`${sua}-`));
    scrivi(altre.length === 0 ? '✅' : '❌', 'R.L.4', `i file delle lingue (testi e frasi) chiesti dall'apertura della pagina sono della sola lingua della pagina: ${sua === 'it' ? 'nessuno' : `${sua}, mai ${sua === 'en' ? 'lo spagnolo' : 'l\'inglese'}`} (#3530)`, nomi(registrata.richieste) || 'nessuno');
}

/** Mentre R.L.3 ferma i file delle lingue: i loro «Failed to load resource» in console sono della prova, non errori (E.1). */
let lingueFermate = false;

/** R.L.3: la pagina riaperta con i file delle lingue fermati: la cornice si disegna in italiano invece di restare vuota. */
async function lingueCheNonArrivano(page, apri) {
    const soli = testiDiUnaLinguaSola();
    const lingua = await page.evaluate(() => document.documentElement.lang);
    if (!soli || /^it(?:[-_]|$)/i.test(lingua || 'it')) {
        scrivi('➖', 'R.L.3', 'con le lingue che non arrivano la cornice in italiano (#3015)', soli ? 'la pagina è in italiano' : 'i file delle lingue non sono accanto allo script');
        return;
    }
    const ferma = (rotta) => rotta.abort();
    await page.route(UN_FILE_DI_LINGUA, ferma);
    lingueFermate = true;
    try {
        await apri(indirizzo);
        await page.waitForSelector('.zr-shell', { timeout: 15000 });
        await pausa(800);
        const testo = await page.evaluate(() => document.querySelector('.zr-shell')?.textContent?.trim() ?? '');
        const italiani = soli.it.filter((uno) => testo.includes(uno)).length;
        // I testi di una lingua che non è l'italiano: dalla v4.5.1 nemmeno quelli dello staff (#3031; revisione dello sprint 108, R1).
        const inglesi = [...soli.en, ...soli.es].filter((uno) => testo.includes(uno));
        scrivi(testo !== '' && inglesi.length === 0 && italiani > 0 ? '✅' : '❌', 'R.L.3', 'con le lingue che non arrivano la cornice si disegna in italiano, non resta vuota (#3015)', `${italiani} testi italiani nella cornice con i file delle lingue fermati${inglesi.length ? ` · in un'altra lingua: ${inglesi.slice(0, 3).join(' | ')}` : ''}`);
    } finally {
        await page.unroute(UN_FILE_DI_LINGUA, ferma);
        await apri(indirizzo);
        await page.waitForSelector('.zr-shell', { timeout: 15000 });
        await pausa(800);
        lingueFermate = false;
    }
}

// R.C (dalla `v4.0.0`, #2946): la CSP che la pagina riceve non ferma niente in tutta la UAT. Chromium scrive ogni blocco in
// console («Loading the stylesheet '…' violates the following Content Security Policy directive: …»). Una pagina senza CSP
// non prova niente: ➖, non ✅.
function cspSenzaBlocchi(csp, blocchi) {
    if (!csp) {
        scrivi('➖', 'R.C', 'la CSP della pagina non ferma niente (#2946)', 'la pagina non ha una CSP: con le pagine di prova, `node scripts/servi-demo.mjs`');
        return;
    }
    scrivi(blocchi.length ? '❌' : '✅', 'R.C', 'la CSP della pagina non ferma niente (#2946)', `${csp}${blocchi.length ? ` · fermati ${blocchi.length}: ${[...new Set(blocchi)].slice(0, 3).join(' | ')}` : ''}`);
}

// S (dalla v3.16.0, #2944): la cornice dello staff. S.1 nella barra solo le voci del modulo, senza selettore e senza menu Moduli;
// S.2 un risultato della ricerca si apre con la `naviga` del modulo; S.3 «Esci» dal menu del profilo chiama il modulo. La pagina di
// prova scrive in `#uat-ultima` ciò che il modulo ha ricevuto.
async function loStaff(page) {
    const barra = await page.evaluate(() => ({
        titoli: [...document.querySelectorAll('.zr-shell .zr-nav .zr-nav-title')].map((titolo) => titolo.textContent),
        selettore: document.querySelector('.zr-shell .zr-ws-switch') !== null,
    }));
    scrivi(!barra.selettore && !barra.titoli.includes('Moduli') && barra.titoli.length > 0 ? '✅' : '❌', 'S.1', 'nella barra solo le voci del modulo: nessun selettore, nessun menu Moduli', barra.titoli.join(', '));
    const ultima = () => page.evaluate(() => document.querySelector('#uat-ultima')?.textContent ?? '');
    await page.click('.zr-shell .zr-top > .zr-search input');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type(parola, { delay: 60 });
    await pausa(900);
    const primo = page.locator('.zr-shell .zr-search-panel [role="option"]').first();
    if (await primo.count()) {
        await primo.click();
        await pausa(300);
        const scritto = await ultima();
        scrivi(scritto.startsWith('naviga /') ? '✅' : '❌', 'S.2', 'un risultato della ricerca si apre con la naviga del modulo', scritto);
    } else {
        scrivi('❌', 'S.2', 'un risultato della ricerca si apre con la naviga del modulo', `nessun risultato per «${parola}»`);
    }
    await page.click('.zr-shell .zr-avatar-btn');
    await page.locator('.zr-profile-menu [role="menuitem"]').last().click();
    await pausa(300);
    const uscito = await ultima();
    scrivi(uscito === 'esci' ? '✅' : '❌', 'S.3', '«Esci» dal menu del profilo chiama il modulo', uscito);
}

// S.4 (dalla v4.3.0, #2954): con `configurazione={false}` la cornice dello staff non ha «Configurazione», né nella barra né, a 390
// px, nel cassetto aperto. `staff.html` la toglie col parametro `configurazione=0`; il riquadro dello staff in fondo alla barra resta.
async function senzaConfigurazione(page, apri, larghezza) {
    const dove = new URL(indirizzo);
    dove.searchParams.set('configurazione', '0');
    await apri(dove.href);
    await page.waitForSelector('.zr-shell', { timeout: 15000 });
    await pausa(500);
    if (larghezza <= 720) {
        await page.click('.zr-shell .zr-top-menu');
        await pausa(300);
    }
    const barra = await page.evaluate(() => ({
        voci: document.querySelectorAll('.zr-shell .zr-side-foot .zr-nav-item').length,
        riquadro: document.querySelector('.zr-shell .zr-side-foot .zr-plan')?.checkVisibility() ?? false,
        cassetto: document.querySelector('.zr-shell .zr-top-menu')?.getAttribute('aria-expanded') === 'true',
    }));
    await page.screenshot({ path: join(cartella, `senza-configurazione-${larghezza}.png`) });
    const dove390 = larghezza <= 720 ? ' nel cassetto aperto' : ' nella barra';
    scrivi(barra.voci === 0 && barra.riquadro && (larghezza > 720 || barra.cassetto) ? '✅' : '❌', 'S.4', `a ${larghezza} px, con configurazione=0, nessuna «Configurazione»${dove390} (#2954)`, `voci in fondo alla barra: ${barra.voci}, riquadro dello staff: ${barra.riquadro}${larghezza <= 720 ? `, cassetto aperto: ${barra.cassetto}` : ''}`);
}

// S.6 (dalla v4.5.0, #2989): il riquadro in fondo alla barra dello staff dice il ruolo con «· 2FA» e l'ora in cui la sessione finisce
// al più tardi, nel fuso e nella forma della lingua della pagina. `staff.html` li prende dai parametri `ruolo` e `fino` (una data ISO,
// qui fra due ore); a 390 px il riquadro si legge nel cassetto aperto. Una pagina che non capisce i parametri (un modulo vero): ➖.
async function ruoloEFine(page, apri, larghezza) {
    const dove = new URL(indirizzo);
    const fino = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
    dove.searchParams.set('ruolo', 'UAT Superadmin');
    dove.searchParams.set('fino', fino);
    await apri(dove.href);
    await page.waitForSelector('.zr-shell', { timeout: 15000 });
    await pausa(500);
    if (larghezza <= 720) {
        await page.click('.zr-shell .zr-top-menu');
        await pausa(300);
    }
    const riquadro = await page.evaluate((fino) => {
        const qui = document.querySelector('.zr-shell .zr-side-foot .zr-plan');
        return {
            visibile: qui?.checkVisibility() ?? false,
            titolo: qui?.querySelector('strong')?.textContent ?? '',
            testo: qui?.querySelector('span')?.textContent ?? '',
            // La lingua della pagina di prova è nel parametro `lingua` (staff.html non cambia `<html lang>`); altrimenti quella del documento.
            ora: new Intl.DateTimeFormat(new URLSearchParams(location.search).get('lingua') || document.documentElement.lang || 'it', { hour: '2-digit', minute: '2-digit' }).format(new Date(fino)),
            prova: location.pathname.endsWith('/staff.html'),
        };
    }, fino);
    await page.screenshot({ path: join(cartella, `ruolo-e-fine-${larghezza}.png`) });
    const dove390 = larghezza <= 720 ? ' nel cassetto aperto' : ' nella barra';
    // Su staff.html i parametri ci sono sempre: un titolo senza il ruolo lì è il difetto (❌), non una pagina che non li capisce.
    if (!riquadro.prova && !riquadro.titolo.startsWith('UAT Superadmin')) {
        return scrivi('➖', 'S.6', `a ${larghezza} px, il ruolo e la fine della sessione${dove390} (#2989)`, `la pagina non prende ruolo e fino dai parametri: «${riquadro.titolo}»`);
    }
    const bene = riquadro.visibile && riquadro.titolo === 'UAT Superadmin · 2FA' && riquadro.testo.includes(riquadro.ora) && !/undefined|Invalid Date|NaN/.test(riquadro.testo);
    scrivi(bene ? '✅' : '❌', 'S.6', `a ${larghezza} px, il ruolo con «· 2FA» e l'ora della fine della sessione${dove390} (#2989)`, `«${riquadro.titolo}» · «${riquadro.testo}» · ora attesa ${riquadro.ora}`);
}

// S.7 (dalla v4.5.1, #3030): quando la sessione finisce domani il riquadro lo dice. `staff.html` con `fino` domani alle 02:00 nel
// fuso della pagina (calcolato nella pagina, come l'ora attesa: il browser condiviso può avere un altro fuso di questo processo): il
// testo è la frase `planUntilTomorrow` della lingua della pagina, dal file dello staff accanto allo script, con l'ora nella forma
// della lingua. Senza i file accanto allo script, o su una pagina che non prende `fino` dai parametri: ➖; e ➖ se la mezzanotte
// passa fra il calcolo e il disegno (revisione dello sprint 108, R2 e R3).
async function fineDomani(page, apri, larghezza) {
    const riga = `a ${larghezza} px, la fine della sessione domani (#3030)`;
    const frasi = {};
    try {
        for (const codice of ['it', 'es', 'en']) {
            frasi[codice] = JSON.parse(readFileSync(fileURLToPath(new URL(`../resources/lingue/staff/${codice}.json`, import.meta.url)), 'utf8')).planUntilTomorrow;
        }
    } catch {
        return scrivi('➖', 'S.7', riga, 'i file dello staff non sono accanto allo script');
    }
    await apri(indirizzo);
    await page.waitForSelector('.zr-shell', { timeout: 15000 });
    const prima = await page.evaluate(() => {
        const domani = new Date();
        domani.setDate(domani.getDate() + 1);
        domani.setHours(2, 0, 0, 0);
        return { fino: domani.toISOString(), oggi: new Date().toDateString() };
    });
    const dove = new URL(indirizzo);
    dove.searchParams.set('ruolo', 'UAT Superadmin');
    dove.searchParams.set('fino', prima.fino);
    await apri(dove.href);
    await page.waitForSelector('.zr-shell', { timeout: 15000 });
    await pausa(500);
    if (larghezza <= 720) {
        await page.click('.zr-shell .zr-top-menu');
        await pausa(300);
    }
    const riquadro = await page.evaluate((fino) => {
        const qui = document.querySelector('.zr-shell .zr-side-foot .zr-plan');
        // La lingua della pagina di prova è nel parametro `lingua`; altrimenti quella del documento. Il codice base, come la cornice.
        const lingua = (new URLSearchParams(location.search).get('lingua') || document.documentElement.lang || 'it').slice(0, 2).toLowerCase();
        const deiTesti = ['it', 'es', 'en'].includes(lingua) ? lingua : 'en';
        return {
            visibile: qui?.checkVisibility() ?? false,
            titolo: qui?.querySelector('strong')?.textContent ?? '',
            testo: qui?.querySelector('span')?.textContent ?? '',
            deiTesti,
            ora: new Intl.DateTimeFormat(deiTesti, { hour: '2-digit', minute: '2-digit' }).format(new Date(fino)),
            oggi: new Date().toDateString(),
            prova: location.pathname.endsWith('/staff.html'),
        };
    }, prima.fino);
    await page.screenshot({ path: join(cartella, `fine-domani-${larghezza}.png`) });
    if (!riquadro.prova && !riquadro.titolo.startsWith('UAT Superadmin')) {
        return scrivi('➖', 'S.7', riga, `la pagina non prende ruolo e fino dai parametri: «${riquadro.titolo}»`);
    }
    if (riquadro.oggi !== prima.oggi) {
        return scrivi('➖', 'S.7', riga, 'la mezzanotte è passata fra il calcolo e il disegno: si rilancia');
    }
    const attesa = frasi[riquadro.deiTesti].replace('{ora}', () => riquadro.ora);
    scrivi(riquadro.visibile && riquadro.testo === attesa ? '✅' : '❌', 'S.7', `a ${larghezza} px, la fine della sessione domani: «${attesa}» (#3030)`, `«${riquadro.testo}»`);
}

// S.5 (dalla v4.3.0, #2965): con `cercaAllInvio` la ricerca dello staff parte solo con Invio. Su `staff.html?invio=1` si scrive la
// parola: dopo 900 ms nessun risultato, il pannello dice la parola da cercare con Invio e il modulo non ha cercato (`data-cerche` del
// `body`, che la pagina conta); con Invio i risultati, una ricerca sola; Invio sul primo lo apre con la `naviga` del modulo.
async function ricercaAllInvio(page, apri) {
    const dove = new URL(indirizzo);
    dove.searchParams.set('invio', '1');
    await apri(dove.href);
    await page.waitForSelector('.zr-shell', { timeout: 15000 });
    await pausa(500);
    const stato = () => page.evaluate(() => ({
        righe: document.querySelectorAll('.zr-shell .zr-search-panel [role="option"]').length,
        nota: document.querySelector('.zr-shell .zr-search-panel .zr-search-note')?.textContent ?? '',
        cerche: Number(document.body.dataset.cerche ?? 0),
        ultima: document.querySelector('#uat-ultima')?.textContent ?? '',
    }));
    await page.click('.zr-shell .zr-top > .zr-search input');
    await page.keyboard.type(parola, { delay: 60 });
    await pausa(900);
    const prima = await stato();
    await page.screenshot({ path: join(cartella, 'ricerca-all-invio-prima.png') });
    await page.keyboard.press('Enter');
    await pausa(900);
    const dopo = await stato();
    await page.screenshot({ path: join(cartella, 'ricerca-all-invio-dopo.png') });
    await page.keyboard.press('Enter');
    await pausa(300);
    const aperto = await stato();
    const bene = prima.righe === 0 && prima.cerche === 0 && prima.nota.includes(`«${parola}»`) && dopo.righe > 0 && dopo.cerche === 1 && aperto.ultima.startsWith('naviga /');
    scrivi(bene ? '✅' : '❌', 'S.5', 'con invio=1 la ricerca dello staff parte solo con Invio, una volta, e Invio apre il primo risultato (#2965)', `prima di Invio: ${prima.righe} righe, ${prima.cerche} ricerche, «${prima.nota}» · dopo: ${dopo.righe} righe, ${dopo.cerche} ricerche · ${aperto.ultima}`);
}

// TO (dalla v3.17.0, #2910): il Toast della cornice. Sulla pagina coi parametri `toast=1` (e a 1280 px `dialogo=1`, un Dialog
// aperto), che `staff.html` capisce: TO.1 e TO.3 il centro del Toast al centro della finestra e il fondo a 24 px dal fondo, a 1280 e a
// 390 px; TO.2 sopra il Dialog, TO.4 sopra il cassetto aperto: al centro del Toast il punto è del Toast; TO.5 (v3.17.1) Tab dal
// dialogo ad «Annulla» e Invio. Una pagina senza Toast: ➖ (TO.5 non si scrive).
async function toastAlSuoPosto(page, apri, larghezza) {
    const dove = new URL(indirizzo);
    dove.searchParams.set('toast', '1');
    if (larghezza > 720) {
        dove.searchParams.set('dialogo', '1');
    }
    await apri(dove.href);
    await page.waitForSelector('.zr-shell', { timeout: 15000 });
    await pausa(500);
    const misura = () => page.evaluate(() => {
        const toast = document.querySelector('.zr-toast');
        if (!toast) {
            return null;
        }
        const r = toast.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        return {
            centro: Math.round(x - innerWidth / 2),
            fondo: Math.round(innerHeight - r.bottom),
            dentro: r.left >= 0 && r.right <= innerWidth,
            sopra: document.elementFromPoint(x, y)?.closest('.zr-toast') === toast,
            dialogo: document.querySelector('.zr-dialog') !== null,
            cassetto: document.querySelector('.zr-shell .zr-top-menu')?.getAttribute('aria-expanded') === 'true',
        };
    });
    const posto = larghezza > 720 ? 'TO.1' : 'TO.3';
    const sopraA = larghezza > 720 ? ['TO.2', 'il Dialog aperto', 'dialogo'] : ['TO.4', 'il cassetto aperto', 'cassetto'];
    let m = await misura();
    if (!m) {
        scrivi('➖', posto, `a ${larghezza} px il Toast in basso al centro, a 24 px dal fondo (#2910)`, 'la pagina non mostra un Toast con ?toast=1');
        scrivi('➖', sopraA[0], `a ${larghezza} px il Toast sta sopra ${sopraA[1]} (#2910)`, 'la pagina non mostra un Toast con ?toast=1');
        return;
    }
    await page.screenshot({ path: join(cartella, `toast-${larghezza}.png`) });
    scrivi(Math.abs(m.centro) <= 1 && Math.abs(m.fondo - 24) <= 1 && m.dentro ? '✅' : '❌', posto, `a ${larghezza} px il Toast in basso al centro, a 24 px dal fondo (#2910)`, `dal centro ${m.centro} px, dal fondo ${m.fondo} px, dentro la finestra: ${m.dentro}`);
    if (larghezza <= 720) {
        await page.focus('.zr-shell .zr-top-menu');
        await page.keyboard.press('Enter');
        await pausa(300);
        m = await misura();
        await page.screenshot({ path: join(cartella, `toast-${larghezza}-cassetto.png`) });
    }
    scrivi(m[sopraA[2]] && m.sopra ? '✅' : '❌', sopraA[0], `a ${larghezza} px il Toast sta sopra ${sopraA[1]} (#2910)`, `${sopraA[2]}: ${m[sopraA[2]]}, al centro del Toast il Toast: ${m.sopra}`);
    if (larghezza > 720) {
        // TO.5 (dalla v3.17.1, #2951): col dialogo aperto il Toast sta dentro il dialogo. Dall'ultima fermata del dialogo che non è
        // del Toast, Tab va ad «Annulla», dentro l'`aria-modal`; Invio chiama il modulo (la pagina scrive «annulla»).
        const ultima = await page.evaluate(() => {
            const fermate = [...document.querySelectorAll('.zr-dialog :is(a[href], button, input, select, textarea, [tabindex])')]
                .filter((e) => e.tabIndex >= 0 && !e.closest('.zr-toast') && e.checkVisibility());
            fermate.at(-1)?.focus();
            return fermate.length;
        });
        await pausa(200);
        await page.keyboard.press('Tab');
        await pausa(200);
        const arrivato = await page.evaluate(() => {
            const a = document.activeElement;
            return { annulla: a?.matches('.zr-toast-action') ?? false, nelDialogo: a?.closest('[role="dialog"][aria-modal="true"]') !== null, testo: a?.getAttribute('aria-label') ?? a?.textContent ?? '' };
        });
        await page.keyboard.press('Enter');
        await pausa(300);
        const scritto = await page.evaluate(() => document.querySelector('#uat-ultima')?.textContent ?? '');
        scrivi(ultima > 0 && arrivato.annulla && arrivato.nelDialogo && scritto === 'annulla' ? '✅' : '❌', 'TO.5', 'col Dialog aperto, Tab dall\'ultima fermata del dialogo va ad «Annulla» del Toast, dentro il dialogo, e Invio lo preme (#2951)', `fermate ${ultima}, fuoco: ${arrivato.annulla ? '«Annulla»' : `«${arrivato.testo}»`}, nel dialogo: ${arrivato.nelDialogo}, la pagina: «${scritto}»`);
    }
}

async function uat(page, apri) {
    const errori = [];
    const diGoogle = [];
    const csp = { politica: null, blocchi: [] };
    page.on('pageerror', (errore) => errori.push(String(errore)));
    page.on('console', (messaggio) => /Content Security Policy/.test(messaggio.text()) && csp.blocchi.push(messaggio.text().slice(0, 200)));
    // La CSP è quella dell'ultima pagina aperta nel riquadro principale, anche quando non ne ha: una pagina d'ingresso con la CSP
    // seguita da una pagina del modulo senza non deve dare ✅.
    page.on('response', (risposta) => {
        if (risposta.request().isNavigationRequest() && risposta.request().frame() === page.mainFrame()) {
            csp.politica = risposta.headers()['content-security-policy'] ?? null;
        }
    });
    page.on('console', (messaggio) => messaggio.type() === 'error' && !(lingueFermate && /net::ERR_FAILED/.test(messaggio.text())) && errori.push(messaggio.text()));
    page.on('request', (richiesta) => /^https?:\/\/fonts\.(googleapis|gstatic)\.com\//.test(richiesta.url()) && diGoogle.push(new URL(richiesta.url()).host));

    await page.setViewportSize({ width: 1280, height: 800 });
    const registrata = await registraLaLingua(page);
    await apri(indirizzo);
    await page.waitForSelector('.zr-shell', { timeout: 15000 });
    await pausa(800);
    await laLingua(page, registrata);
    await lingueCheNonArrivano(page, apri);
    pagina = page.url();
    tornaAllaPagina = async () => {
        if (fuoriDallaPagina(page)) {
            await apri(indirizzo);
            await page.waitForSelector('.zr-shell', { timeout: 15000 });
            await pausa(800);
        }
    };
    await page.screenshot({ path: join(cartella, 'pagina-1280.png') });
    await controllaAxe(page, 'A.1', 'a 1280 px, a pannelli chiusi');
    if (conLaBarra) {
        await barraDiInertia(page, csp);
        await tornaAllaPagina();
    }
    if (colCliente) {
        await fuoriDaiMenu(page);
        await tornaAllaPagina();
        await inizioEFineNeiMenu(page);
        await tornaAllaPagina();
        await linguetteDelleNotifiche(page);
        await tornaAllaPagina();
        await nomiDaiTesti(page);
        await selettore(page);
        await tornaAllaPagina();
        await campanella(page, true);
        await tornaAllaPagina();
        await sopraIlPannello(page);
        await tornaAllaPagina();
        await percorso(page);
        await tornaAllaPagina();
        await ilCliente(page, 1280);
        return a390(page, apri, diGoogle, errori, csp);
    }
    await ricerca(page, true);
    await tornaAllaPagina();
    await escNellaBarra(page, true);
    await tornaAllaPagina();
    if (conLoStaff) {
        await fuoriDaiMenu(page);
        await tornaAllaPagina();
        await inizioEFineNeiMenu(page);
        await tornaAllaPagina();
        // Dalla v4.1.1 (voce #2986): la zona di quanti risultati, le linguette del pannello vuoto e i menu sopra il dettaglio.
        await linguetteDelleNotifiche(page);
        await tornaAllaPagina();
        await quantiRisultati(page);
        await tornaAllaPagina();
        await sopraIlPannello(page);
        await tornaAllaPagina();
        await loStaff(page);
        await senzaConfigurazione(page, apri, 1280);
        await ruoloEFine(page, apri, 1280);
        await fineDomani(page, apri, 1280);
        await ricercaAllInvio(page, apri);
        await toastAlSuoPosto(page, apri, 1280);
        return a390(page, apri, diGoogle, errori, csp);
    }
    await fuoriDaiMenu(page);
    await tornaAllaPagina();
    await inizioEFineNeiMenu(page);
    await tornaAllaPagina();
    await linguetteDelleNotifiche(page);
    await tornaAllaPagina();
    await quantiRisultati(page);
    await tornaAllaPagina();
    await attivaInVista(page);
    await tornaAllaPagina();
    await piu(page);
    await tornaAllaPagina();
    await nomiDaiTesti(page);
    await selettore(page);
    await tornaAllaPagina();
    if (colloSpazio) {
        await ilMioSpazio(page);
        await tornaAllaPagina();
    }
    await campanella(page, true);
    await tornaAllaPagina();
    await sopraIlPannello(page);
    await tornaAllaPagina();
    await percorso(page);
    await tornaAllaPagina();
    await dialogoDalPiu(page);
    await tornaAllaPagina();
    await dialogoColMouse(page);
    await attendiDaUnDialogo(page);

    await a390(page, apri, diGoogle, errori, csp);
}

// CL (dalla v4.13.0, #3319): la cornice del cliente. CL.1 il campo della ricerca non si vede e Ctrl+K non porta il fuoco da nessuna
// parte che non si veda; CL.2 il selettore dice «Come cliente › Il mio spazio» e non c'è il riquadro del piano; CL.3 il menu del
// profilo è Profilo, Impostazioni, una linea, Esci, e «Esci» chiama il modulo (la pagina di prova scrive in `#uat-ultima`); CL.4
// (dalla v4.13.1) campanella e profilo stanno a destra della barra in alto, a 1280 e a 390 px.
// SP (dalla v4.25.0, #3417): «Il mio spazio» nella cornice dei membri, con `--spazio`. SP.1 aperto il selettore, il primo gruppo è
// «Come cliente» nella lingua della pagina (dal parametro `lingua`, o da `lang` del documento), con «Il mio spazio» che porta a un
// indirizzo e non è attiva, e il pulsante del selettore dice ancora azienda › workspace; SP.2 un clic semplice sulla voce non
// ricarica la pagina (un segno messo nella finestra prima del clic c'è ancora dopo).
async function ilMioSpazio(page) {
    const qui = new URL(page.url());
    const lingua = (qui.searchParams.get('lingua') || (await page.evaluate(() => document.documentElement.lang)) || 'it').slice(0, 2);
    const dalFile = (codice) => {
        try {
            return JSON.parse(readFileSync(fileURLToPath(new URL(`../resources/lingue/avvisi/${codice}.json`, import.meta.url)), 'utf8'));
        } catch {
            return null;
        }
    };
    const attesi = dalFile(lingua) ?? dalFile('en');
    await page.click('.zr-shell .zr-ws-switch');
    await pausa(300);
    const visto = await page.evaluate(() => {
        const s = document.querySelector('.zr-shell .zr-ws-switch');
        // Ciò che il selettore dice, nella forma dell'`aria-label` dell'`AppShell`: dalla v4.26.1 (righe 240 e 241) la descrizione e i due testi.
        const detto = s && (s.getAttribute('aria-label') ?? `${s.getAttribute('aria-description')}: ${s.querySelector('.zr-ws-company')?.textContent} › ${s.querySelector('.zr-ws-name')?.textContent}`);
        const gruppo = document.querySelector('.zr-shell .zr-ws-menu .zr-ws-group');
        const voce = gruppo?.querySelector('.zr-ws-item');
        return {
            titolo: gruppo?.querySelector('.zr-ws-group-title')?.textContent?.trim() ?? null,
            voce: voce?.textContent?.trim() ?? null,
            href: voce?.getAttribute('href') ?? null,
            attiva: !!voce && (voce.matches('.is-active') || voce.hasAttribute('aria-current')),
            selettore: detto ?? '',
        };
    });
    await page.screenshot({ path: join(cartella, 'selettore-spazio-1280.png') });
    scrivi(visto.titolo === attesi.personalGroup && visto.voce === attesi.personal && !!visto.href && !visto.attiva && !visto.selettore.includes(attesi.personalGroup) ? '✅' : '❌', 'SP.1', `aperto il selettore, in cima «${attesi.personalGroup}» con «${attesi.personal}», non attiva; il selettore dice azienda › workspace`, `gruppo «${visto.titolo}», voce «${visto.voce}» → ${visto.href}, attiva: ${visto.attiva}; selettore «${visto.selettore}»`);
    if (!visto.href) {
        scrivi('➖', 'SP.2', 'un clic semplice sulla voce non ricarica la pagina', 'la voce non c\'è');
        return;
    }
    await page.evaluate(() => (window.__uatSpazio = 1));
    await page.locator('.zr-shell .zr-ws-menu .zr-ws-group').first().locator('.zr-ws-item').click();
    await pausa(800);
    const dopo = await page.evaluate(() => ({ segno: window.__uatSpazio === 1, dove: location.href }));
    scrivi(dopo.segno ? '✅' : '❌', 'SP.2', 'un clic semplice sulla voce non ricarica la pagina', `segno nella finestra dopo il clic: ${dopo.segno}; indirizzo ${dopo.dove}`);
}

// AV (dalla v4.33.0, #3535): la barra d'avanzamento di Inertia dal pacchetto, con `--barra`. Durante una visita lenta: AV.1 la barra
// c'è, in alto, a tutta larghezza, alta 2 px, nel colore di `--pine` (non il #29d di Inertia) e a `--z-toast`, e il suo contenitore
// non prende i clic; AV.2 nessun `<style>` della barra nella pagina e nessuna violazione di `style-src`, nemmeno in console.
async function barraDiInertia(page, csp) {
    await page.evaluate(() => {
        window.__uatViolazioni = [];
        document.addEventListener('securitypolicyviolation', (evento) => window.__uatViolazioni.push(`${evento.violatedDirective} ${evento.blockedURI}`));
    });
    const lenta = page.locator('[data-uat="vai-corta-lenta"]').first();
    // Sulla pagina di prova la visita lenta tiene la barra sei secondi; su una pagina del modulo la barra si vede solo se la
    // risposta tarda più del ritardo di Inertia (250 ms): lì una barra che non compare è ➖, non ❌.
    const diProva = (await lenta.count()) > 0;
    if (diProva) {
        await lenta.click();
    } else {
        const interno = page.locator(`main a[href^="/"], main a[href^="${new URL(page.url()).origin}"]`).first();
        if (!(await interno.count())) {
            scrivi('➖', 'AV.1', 'durante una visita la barra d\'avanzamento è in alto, alta 2 px, nel colore --pine, a --z-toast, e non prende i clic', 'nessun collegamento interno da cliccare');
            return;
        }
        await interno.click();
    }
    await pausa(700);
    const barra = await page.evaluate(() => {
        const contenitore = document.querySelector('#nprogress');
        const linea = contenitore?.querySelector('.bar');
        if (!linea) return null;
        const dove = linea.getBoundingClientRect();
        const prova = document.createElement('span');
        prova.style.color = 'var(--pine)';
        document.body.appendChild(prova);
        const pine = getComputedStyle(prova).color;
        prova.remove();
        return {
            alto: Math.round(dove.top),
            spessore: Math.round(dove.height * 10) / 10,
            largo: Math.round(dove.width) === document.documentElement.clientWidth,
            colore: getComputedStyle(linea).backgroundColor,
            pine,
            livello: getComputedStyle(linea).zIndex,
            toast: getComputedStyle(document.documentElement).getPropertyValue('--z-toast').trim(),
            clic: getComputedStyle(contenitore).pointerEvents,
            sopra: contenitore.matches(':popover-open'),
        };
    }).catch(() => null);
    await page.screenshot({ path: join(cartella, 'barra-di-inertia.png'), clip: { x: 0, y: 0, width: page.viewportSize().width, height: 120 } });
    // In Chromium Inertia mette la barra in un popover, nello strato in cima: è quello che la tiene sopra la barra in alto e i dialoghi.
    const ok = barra && barra.alto === 0 && barra.spessore === 2 && barra.largo && barra.colore === barra.pine && barra.livello === barra.toast && barra.clic === 'none' && barra.sopra;
    scrivi(ok ? '✅' : !barra && !diProva ? '➖' : '❌', 'AV.1', 'durante una visita la barra d\'avanzamento è in alto, alta 2 px, nel colore --pine, a --z-toast, e non prende i clic', barra ? `in alto a ${barra.alto} px, alta ${barra.spessore} px, a tutta larghezza: ${barra.largo}; colore ${barra.colore} (--pine ${barra.pine}); z-index ${barra.livello} (--z-toast ${barra.toast}); pointer-events ${barra.clic}; nello strato in cima: ${barra.sopra}` : diProva ? 'la barra non c\'è' : 'la barra non è comparsa: la risposta è arrivata prima del ritardo di Inertia, o il collegamento ha ricaricato la pagina');
    await page.waitForFunction(() => !document.querySelector('#nprogress .bar'), null, { timeout: 15000 }).catch(() => undefined);
    // Lo `<style>` di Inertia lo aggiunge `createInertiaApp`, al caricamento: si cerca nella pagina, e le violazioni di `style-src` si
    // leggono anche in console, da quando la pagina si è aperta.
    const dopo = await page.evaluate(() => ({
        violazioni: window.__uatViolazioni ?? [],
        stili: [...document.querySelectorAll('style')].filter((stile) => stile.textContent?.includes('nprogress')).length,
    }));
    const inConsole = csp.blocchi.filter((blocco) => /style-src/.test(blocco));
    scrivi(dopo.violazioni.length === 0 && dopo.stili === 0 && inConsole.length === 0 ? '✅' : '❌', 'AV.2', 'nessun <style> della barra nella pagina e nessuna violazione di style-src', `violazioni durante la visita ${dopo.violazioni.length}${dopo.violazioni.length ? `: ${dopo.violazioni.slice(0, 3).join(' | ')}` : ''}; in console ${inConsole.length}; <style> della barra ${dopo.stili}`);
}

// MV (dalla v4.32.0, #3534): meno movimento dal CSS del pacchetto, a 390 px. MV.1 con `prefers-reduced-motion: reduce` nessuna
// transizione: su ogni elemento della pagina e sui suoi ::before e ::after, sul cassetto aperto (una copia di `.zr-side` con
// `is-open`, accanto a lui), sulla freccia del selettore e su un elemento del modulo con una transizione sua (messa dallo script);
// MV.2 senza la preferenza il cassetto, la freccia e l'elemento del modulo hanno la loro; MV.3 con la preferenza lo spinner del
// Button gira ancora, a 2,4 s per giro. Alla fine la preferenza torna quella del browser.
async function menoMovimento(page) {
    const misura = () => page.evaluate(() => {
        const durata = (valore) => Math.max(0, ...valore.split(',').map((v) => (v.trim().endsWith('ms') ? parseFloat(v) / 1000 : parseFloat(v)) || 0));
        const lato = document.querySelector('.zr-shell .zr-side');
        const aperto = lato?.cloneNode(false);
        aperto?.classList.add('is-open');
        aperto?.removeAttribute('id');
        if (aperto) lato.parentNode.insertBefore(aperto, lato);
        const delModulo = document.createElement('div');
        delModulo.style.transition = 'opacity 1s';
        document.querySelector('main')?.appendChild(delModulo) ?? document.body.appendChild(delModulo);
        const spinner = document.createElement('span');
        spinner.className = 'zr-btn-spin';
        document.body.appendChild(spinner);
        let massima = 0;
        for (const el of document.querySelectorAll('*')) {
            for (const parte of [null, '::before', '::after']) {
                massima = Math.max(massima, durata(getComputedStyle(el, parte).transitionDuration));
            }
        }
        const chev = document.querySelector('.zr-shell .zr-ws-chev');
        const visto = {
            massima,
            cassetto: aperto ? durata(getComputedStyle(aperto).transitionDuration) : null,
            freccia: chev ? durata(getComputedStyle(chev).transitionDuration) : null,
            modulo: durata(getComputedStyle(delModulo).transitionDuration),
            spinner: `${getComputedStyle(spinner).animationName} ${getComputedStyle(spinner).animationDuration}`,
        };
        aperto?.remove();
        delModulo.remove();
        spinner.remove();
        return visto;
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const meno = await misura();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const solito = await misura();
    await page.emulateMedia({ reducedMotion: null });
    // La freccia del selettore manca solo nella cornice dello staff, che il selettore non ce l'ha: altrove manca = ❌.
    const frecciaBuona = (misurata, buona) => (misurata === null ? conLoStaff : buona(misurata));
    scrivi(meno.massima === 0 && meno.cassetto === 0 && meno.modulo === 0 && frecciaBuona(meno.freccia, (durata) => durata === 0) ? '✅' : '❌', 'MV.1', 'con prefers-reduced-motion: reduce nessuna transizione, anche sul cassetto, sulla freccia del selettore e su un elemento del modulo', `la più lunga ${meno.massima}s; cassetto ${meno.cassetto}s, freccia ${meno.freccia ?? '—'}s, modulo ${meno.modulo}s`);
    scrivi(solito.cassetto > 0 && solito.modulo === 1 && frecciaBuona(solito.freccia, (durata) => durata > 0) ? '✅' : '❌', 'MV.2', 'senza la preferenza il cassetto, la freccia del selettore e l\'elemento del modulo hanno la loro transizione', `cassetto ${solito.cassetto}s, freccia ${solito.freccia ?? 'non c\'è'}${solito.freccia === null ? '' : 's'}, modulo ${solito.modulo}s`);
    scrivi(meno.spinner === 'zr-spin 2.4s' ? '✅' : '❌', 'MV.3', 'con la preferenza lo spinner del Button gira ancora, a 2,4 s per giro', meno.spinner);
}

async function ilCliente(page, larghezza) {
    const id = larghezza > 720 ? 'CL' : 'CL390';
    const campo = await page.evaluate(() => {
        const ricerca = document.querySelector('.zr-shell .zr-top > .zr-search');
        return { c: ricerca !== null, visibile: !!ricerca && getComputedStyle(ricerca).display !== 'none' && ricerca.getClientRects().length > 0 };
    });
    await page.keyboard.press('Control+k');
    await pausa(300);
    const dopo = await page.evaluate(() => {
        const a = document.activeElement;
        const azioni = document.querySelector('.zr-shell .zr-top-actions');
        return {
            fuoco: !a || a === document.body ? 'documento' : a.getClientRects().length > 0 ? 'visibile' : 'nascosto',
            aperta: document.querySelector('.zr-shell .zr-top > .zr-search.is-open') !== null,
            azioni: !!azioni && getComputedStyle(azioni).visibility !== 'hidden',
        };
    });
    // Dalla v4.18.0 (`search={false}`, richiesta 201) il campo non c'è proprio: non si vede lo stesso.
    scrivi(!campo.visibile && dopo.fuoco !== 'nascosto' && !dopo.aperta && dopo.azioni ? '✅' : '❌', `${id}.1`, `a ${larghezza} px il campo della ricerca non si vede; Ctrl+K non la apre, non porta il fuoco su un elemento nascosto e lascia campanella e profilo`, `campo: ${campo.c ? (campo.visibile ? 'visibile' : 'nascosto') : 'assente'}, dopo Ctrl+K: fuoco ${dopo.fuoco}, ricerca aperta: ${dopo.aperta}, azioni visibili: ${dopo.azioni}`);
    // CL.4 (dalla v4.13.1): senza il campo della ricerca, campanella e profilo restano in fondo a destra della barra in alto, come
    // nella `Cornice`, e non scivolano a sinistra accanto alla barra laterale.
    const posto = await page.evaluate(() => {
        const barra = document.querySelector('.zr-shell .zr-top')?.getBoundingClientRect();
        const azioni = document.querySelector('.zr-shell .zr-top-actions')?.getBoundingClientRect();
        return barra && azioni ? Math.round(barra.right - azioni.right) : null;
    });
    scrivi(posto !== null && posto >= 0 && posto <= 32 ? '✅' : '❌', `${id}.4`, `a ${larghezza} px campanella e profilo stanno a destra della barra in alto`, `distanza dal bordo destro: ${posto} px`);
    await page.evaluate(() => document.activeElement?.blur());
    if (larghezza <= 720) {
        return;
    }
    const barra = await page.evaluate(() => {
        const s = document.querySelector('.zr-shell .zr-ws-switch');
        // Ciò che il selettore dice, nella forma dell'`aria-label` dell'`AppShell`: dalla v4.26.1 (righe 240 e 241) la descrizione e i due testi.
        const detto = s && (s.getAttribute('aria-label') ?? `${s.getAttribute('aria-description')}: ${s.querySelector('.zr-ws-company')?.textContent} › ${s.querySelector('.zr-ws-name')?.textContent}`);
        return {
            selettore: detto,
            piano: document.querySelector('.zr-shell .zr-plan') !== null,
            moduli: document.querySelector('.zr-shell .zr-product-switch') !== null,
        };
    });
    scrivi(/^[^:]+: \S.* › \S/.test(barra.selettore ?? '') && !barra.selettore.includes('null') && !barra.piano && !barra.moduli ? '✅' : '❌', 'CL.2', 'il selettore dice lo spazio del cliente; niente riquadro del piano, niente menu Moduli', `selettore: «${barra.selettore}», piano: ${barra.piano}, menu Moduli: ${barra.moduli}`);
    await page.click('.zr-shell .zr-avatar-btn');
    await pausa(300);
    const voci = await page.evaluate(() => [...document.querySelectorAll('.zr-profile-menu > [role="menuitem"], .zr-profile-menu > .zr-menu-sep')].map((voce) => (voce.matches('.zr-menu-sep') ? '—' : voce.textContent?.trim())));
    // Su una pagina vera (senza `#uat-ultima`, che c'è solo sulla pagina di prova) «Esci» chiuderebbe la sessione di chi lancia
    // lo script, e il giro a 390 px non entrerebbe più (giro di zr-bookings-f6 su app.zeiras.com, 07/11/2026): lì non si clicca.
    if (!(await page.locator('#uat-ultima').count())) {
        await page.keyboard.press('Escape');
        scrivi(voci.length === 4 && voci[2] === '—' ? '➖' : '❌', 'CL.3', 'il menu del profilo è Profilo, Impostazioni, una linea, Esci; «Esci» chiama il modulo', `${voci.join(' | ')}; «Esci» non cliccato: la pagina non è quella di prova`);
        return;
    }
    await page.locator('.zr-profile-menu [role="menuitem"]').last().click();
    await pausa(300);
    const uscito = await page.evaluate(() => document.querySelector('#uat-ultima')?.textContent ?? '');
    scrivi(voci.length === 4 && voci[2] === '—' && uscito === 'esci' ? '✅' : '❌', 'CL.3', 'il menu del profilo è Profilo, Impostazioni, una linea, Esci; «Esci» chiama il modulo', `${voci.join(' | ')}; dopo Esci: «${uscito}»`);
}

/** A 390 px: axe, la ricerca, Esc, il cassetto; la campanella solo fuori dalla cornice dello staff. Poi i font, la CSP e la console. */
async function a390(page, apri, diGoogle, errori, csp) {
    await page.setViewportSize({ width: 390, height: 844 });
    await apri(indirizzo);
    await page.waitForSelector('.zr-shell', { timeout: 15000 });
    await pausa(800);
    pagina = page.url();
    await page.screenshot({ path: join(cartella, 'pagina-390.png') });
    await controllaAxe(page, 'A390.1', 'a 390 px, a pannelli chiusi');
    await menoMovimento(page);
    if (!colCliente) {
        await ricerca(page, false);
        await tornaAllaPagina();
        await escNellaBarra(page, false);
        await tornaAllaPagina();
    }
    await cassetto(page);
    if (colCliente) {
        await tornaAllaPagina();
        await ilCliente(page, 390);
    }
    if (!conLoStaff) {
        await tornaAllaPagina();
        await campanella(page, false);
    } else {
        await senzaConfigurazione(page, apri, 390);
        await ruoloEFine(page, apri, 390);
        await fineDomani(page, apri, 390);
        await toastAlSuoPosto(page, apri, 390);
    }

    await fontDelPacchetto(page, diGoogle);
    cspSenzaBlocchi(csp.politica, csp.blocchi);
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
