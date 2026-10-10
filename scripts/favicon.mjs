// Genera resources/favicon/favicon.ico e resources/favicon/apple-touch-icon.png dalla favicon del design system di Zeiras
// (resources/zeiras/logos/zeiras-favicon.svg, copia derivata), con resvg. favicon.ico porta tre immagini PNG, 16, 32 e 48 px, la
// favicon com'è, con gli angoli trasparenti; apple-touch-icon.png è 180×180 e senza trasparenza: lo stesso disegno sul colore
// del suo fondo, pieno fino agli angoli, perché iOS mette il nero dove un'icona è trasparente. Il colore non è scritto qui: è
// il `fill` del primo <rect> della favicon. I due file non si ritoccano a mano: si rigenerano con `npm run favicon` quando la
// favicon del design system cambia. `npm run favicon -- --controlla` non scrive niente: rilegge i due file, li confronta pixel
// per pixel con la resa di adesso ed esce 1 alla prima differenza. Lo lancia la CI a ogni giro.
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { crc32, deflateSync, inflateSync } from 'node:zlib';

const MISURE_DELL_ICO = [16, 32, 48];
const MISURA_APPLE = 180;
const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const qui = (percorso) => new URL(`../${percorso}`, import.meta.url);
const svg = readFileSync(qui('resources/zeiras/logos/zeiras-favicon.svg'), 'utf8');
const cartella = qui('resources/favicon/');
const fileIco = new URL('favicon.ico', cartella);
const fileApple = new URL('apple-touch-icon.png', cartella);

/** Un PNG a 8 bit, RGB o RGBA, non interlacciato → misure, canali e pixel riga per riga. */
function leggiPng(png) {
    if (!png.subarray(0, 8).equals(FIRMA_PNG)) throw new Error('non è un PNG');
    let testa;
    const dati = [];
    for (let da = 8; da < png.length; ) {
        const lunghezza = png.readUInt32BE(da);
        const tipo = png.toString('latin1', da + 4, da + 8);
        const corpo = png.subarray(da + 8, da + 8 + lunghezza);
        if (crc32(png.subarray(da + 4, da + 8 + lunghezza)) !== png.readUInt32BE(da + 8 + lunghezza)) throw new Error(`PNG: il blocco ${tipo} è rovinato`);
        if (tipo === 'IHDR') testa = { larghezza: corpo.readUInt32BE(0), altezza: corpo.readUInt32BE(4), bit: corpo[8], colore: corpo[9], interlacciato: corpo[12] };
        if (tipo === 'IDAT') dati.push(corpo);
        da += 12 + lunghezza;
    }
    const canali = { 2: 3, 6: 4 }[testa?.colore];
    if (!canali || testa.bit !== 8 || testa.interlacciato !== 0) throw new Error('PNG: non è a 8 bit, RGB o RGBA, non interlacciato');
    const { larghezza, altezza } = testa;
    const riga = larghezza * canali;
    const grezzo = inflateSync(Buffer.concat(dati));
    const pixel = Buffer.alloc(riga * altezza);
    for (let y = 0; y < altezza; y++) {
        const filtro = grezzo[y * (riga + 1)];
        for (let x = 0; x < riga; x++) {
            const a = x >= canali ? pixel[y * riga + x - canali] : 0;
            const b = y > 0 ? pixel[(y - 1) * riga + x] : 0;
            const c = x >= canali && y > 0 ? pixel[(y - 1) * riga + x - canali] : 0;
            const paeth = () => {
                const [pa, pb, pc] = [Math.abs(b - c), Math.abs(a - c), Math.abs(a + b - 2 * c)];
                return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
            };
            const prima = [() => 0, () => a, () => b, () => (a + b) >> 1, paeth][filtro];
            if (!prima) throw new Error(`PNG: filtro ${filtro} sconosciuto`);
            pixel[y * riga + x] = (grezzo[y * (riga + 1) + 1 + x] + prima()) & 255;
        }
    }

    return { larghezza, altezza, canali, pixel };
}

/** Misure, canali e pixel → un PNG a 8 bit, RGB (3 canali) o RGBA (4), senza filtri. */
function scriviPng({ larghezza, altezza, canali, pixel }) {
    const blocco = (tipo, corpo) => {
        const nome = Buffer.from(tipo, 'latin1');
        const numeri = Buffer.alloc(8);
        numeri.writeUInt32BE(corpo.length, 0);
        numeri.writeUInt32BE(crc32(Buffer.concat([nome, corpo])), 4);
        return Buffer.concat([numeri.subarray(0, 4), nome, corpo, numeri.subarray(4)]);
    };
    const testa = Buffer.alloc(13);
    testa.writeUInt32BE(larghezza, 0);
    testa.writeUInt32BE(altezza, 4);
    testa[8] = 8;
    testa[9] = canali === 4 ? 6 : 2;
    const riga = larghezza * canali;
    const grezzo = Buffer.alloc((riga + 1) * altezza);
    for (let y = 0; y < altezza; y++) pixel.copy(grezzo, y * (riga + 1) + 1, y * riga, (y + 1) * riga);

    return Buffer.concat([FIRMA_PNG, blocco('IHDR', testa), blocco('IDAT', deflateSync(grezzo, { level: 9 })), blocco('IEND', Buffer.alloc(0))]);
}

/** La favicon resa a quella misura, come PNG di resvg; con un fondo, su quel colore. */
function resa(misura, fondo) {
    return new Resvg(svg, { fitTo: { mode: 'width', value: misura }, font: { loadSystemFonts: false }, ...(fondo ? { background: fondo } : {}) }).render().asPng();
}

/** Più PNG → un ICO che li porta interi, uno per misura. */
function scriviIco(immagini) {
    const testa = Buffer.alloc(6 + 16 * immagini.length);
    testa.writeUInt16LE(1, 2);
    testa.writeUInt16LE(immagini.length, 4);
    let posto = testa.length;
    immagini.forEach(({ misura, png }, i) => {
        const voce = 6 + 16 * i;
        testa[voce] = misura;
        testa[voce + 1] = misura;
        testa.writeUInt16LE(1, voce + 4);
        testa.writeUInt16LE(32, voce + 6);
        testa.writeUInt32LE(png.length, voce + 8);
        testa.writeUInt32LE(posto, voce + 12);
        posto += png.length;
    });

    return Buffer.concat([testa, ...immagini.map(({ png }) => png)]);
}

/** Un ICO → le sue immagini, ognuna con la misura che la sua voce dichiara. */
function leggiIco(ico) {
    if (ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1) throw new Error('non è un ICO');

    return Array.from({ length: ico.readUInt16LE(4) }, (_, i) => {
        const voce = 6 + 16 * i;
        const posto = ico.readUInt32LE(voce + 12);
        return { misura: ico[voce], altezza: ico[voce + 1], png: ico.subarray(posto, posto + ico.readUInt32LE(voce + 8)) };
    });
}

/** L'icona Apple: la favicon sul colore del suo fondo, senza il canale alfa. */
function iconaApple() {
    const fondo = /\bfill="(#[0-9a-f]{6})"/i.exec(/<rect\b[^>]*>/i.exec(svg)?.[0] ?? '')?.[1];
    if (!fondo) throw new Error('icona Apple: il primo <rect> della favicon non ha un fill esadecimale a sei cifre, e il colore del fondo non si sa');
    const { larghezza, altezza, canali, pixel } = leggiPng(resa(MISURA_APPLE, fondo));
    const rgb = Buffer.alloc(larghezza * altezza * 3);
    for (let i = 0; i < larghezza * altezza; i++) {
        if (canali === 4 && pixel[i * 4 + 3] !== 255) throw new Error(`icona Apple: il pixel ${i % larghezza},${Math.floor(i / larghezza)} è trasparente anche sul fondo`);
        pixel.copy(rgb, i * 3, i * canali, i * canali + 3);
    }
    if (!rgb.subarray(0, 3).equals(Buffer.from(fondo.slice(1), 'hex'))) throw new Error('icona Apple: l\'angolo non ha il colore del fondo');

    return { larghezza, altezza, canali: 3, pixel: rgb };
}

/** Che cosa non torna fra un'immagine letta dal repo e la resa di adesso. Vuoto se sono uguali. */
function differenza(nome, letta, attesa) {
    if (letta.larghezza !== attesa.larghezza || letta.altezza !== attesa.altezza) return `${nome}: è ${letta.larghezza}×${letta.altezza}, non ${attesa.larghezza}×${attesa.altezza}`;
    if (letta.canali !== attesa.canali) return `${nome}: ha ${letta.canali} canali, non ${attesa.canali}${attesa.canali === 3 ? ' (un canale alfa in più)' : ''}`;
    const i = letta.pixel.findIndex((valore, dove) => valore !== attesa.pixel[dove]);
    const pixel = Math.floor(i / attesa.canali);

    return i < 0 ? '' : `${nome}: il pixel ${pixel % attesa.larghezza},${Math.floor(pixel / attesa.larghezza)} non è quello della resa di adesso`;
}

if (process.argv.includes('--controlla')) {
    const problemi = [];
    const nellIco = leggiIco(readFileSync(fileIco));
    if (nellIco.map(({ misura }) => misura).join() !== MISURE_DELL_ICO.join()) {
        problemi.push(`favicon.ico: porta le misure ${nellIco.map(({ misura }) => misura).join(', ')}, non ${MISURE_DELL_ICO.join(', ')}`);
    }
    for (const { misura, altezza, png } of nellIco) {
        const letta = leggiPng(png);
        if (letta.larghezza !== misura || letta.altezza !== altezza) problemi.push(`favicon.ico: la voce ${misura}×${altezza} porta un'immagine ${letta.larghezza}×${letta.altezza}`);
        if (MISURE_DELL_ICO.includes(misura)) problemi.push(differenza(`favicon.ico, ${misura} px`, letta, leggiPng(resa(misura))));
    }
    try {
        problemi.push(differenza('apple-touch-icon.png', leggiPng(readFileSync(fileApple)), iconaApple()));
    } catch (errore) {
        problemi.push(errore.message);
    }
    const veri = problemi.filter(Boolean);
    if (veri.length > 0) {
        console.error(`${veri.join('\n')}\nI due file escono solo da \`npm run favicon\`: non si ritoccano a mano, e si rigenerano quando la favicon cambia.`);
        process.exit(1);
    }
    console.log(`favicon.ico (${MISURE_DELL_ICO.join(', ')} px) e apple-touch-icon.png (${MISURA_APPLE}×${MISURA_APPLE}, senza alfa): uguali pixel per pixel alla resa di zeiras-favicon.svg`);
} else {
    mkdirSync(cartella, { recursive: true });
    writeFileSync(fileIco, scriviIco(MISURE_DELL_ICO.map((misura) => ({ misura, png: resa(misura) }))));
    writeFileSync(fileApple, scriviPng(iconaApple()));
    console.log(`scritti ${fileIco.pathname} e ${fileApple.pathname}`);
}
