import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const delRepo = (percorso: string) => fileURLToPath(new URL(`./${percorso}`, import.meta.url));

// I tre file della favicon alla radice della build, coi nomi che hanno in public/ di un frontend dopo `vendor:publish`: le
// pagine di prova li chiedono come li chiede un frontend (/favicon.ico, /favicon.svg, /apple-touch-icon.png).
const favicon = (): Plugin => ({
    name: 'zr-core:favicon-di-prova',
    generateBundle() {
        const file = {
            'favicon.svg': 'resources/zeiras/logos/zeiras-favicon.svg',
            'favicon.ico': 'resources/favicon/favicon.ico',
            'apple-touch-icon.png': 'resources/favicon/apple-touch-icon.png',
        };
        for (const [fileName, origine] of Object.entries(file)) {
            this.emitFile({ type: 'asset', fileName, source: readFileSync(delRepo(origine)) });
        }
    },
});

// Le pagine di prova della UAT (resources/demo): `npm run demo` le costruisce in dist/demo, `npx vite preview --config
// vite.demo.config.ts` le serve. Tre ingressi: index.html (la `Cornice` montata dalla pagina, presa dall'ingresso di sempre),
// app.html (la stessa pagina, con la `Cornice` dell'ingresso per le app) e layout.html (il layout della cornice sotto Inertia).
// Non entrano nel pacchetto. Con `ZR_PEZZI_ALTROVE=1 npm run demo` il pezzo della campanella va in una cartella dentro quella del
// JS d'ingresso (`assets/pezzi/`), come lo può mettere un frontend: è la build con cui si prova «Riprova» (README, «Le notifiche»).
// Con `ZR_INGRESSO_CON_CODA=1 npm run demo` la build ha la sola app.html, così la `Cornice` sta nel JS d'ingresso, e la pagina lo
// chiede con una coda (`?v=3`), come un frontend che serve i suoi file così: è l'altra forma di quella prova.
const conLaCoda = (): Plugin => ({
    name: 'zr-core:ingresso-con-la-coda',
    transformIndexHtml: { order: 'post', handler: (pagina) => pagina.replace(/(<script[^>]+src="[^"]+\.js)"/, '$1?v=3"') },
});
const solaLApp = (pagina: string) => !process.env.ZR_INGRESSO_CON_CODA || pagina === 'app.html';

export default defineConfig({
    plugins: [react(), favicon(), ...(process.env.ZR_INGRESSO_CON_CODA ? [conLaCoda()] : [])],
    root: 'resources/demo',
    base: './',
    build: {
        outDir: '../../dist/demo',
        emptyOutDir: true,
        rolldownOptions: {
            input: ['index.html', 'app.html', 'layout.html'].filter(solaLApp).map((pagina) => delRepo(`resources/demo/${pagina}`)),
            output: process.env.ZR_PEZZI_ALTROVE
                ? { chunkFileNames: (pezzo) => `assets/${pezzo.name === 'campanella' ? 'pezzi/' : ''}[name]-[hash].js` }
                : {},
        },
    },
});
