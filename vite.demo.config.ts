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
// vite.demo.config.ts` le serve. Due ingressi: index.html (la `Cornice` montata dalla pagina) e layout.html (il layout della
// cornice sotto Inertia). Non entrano nel pacchetto.
export default defineConfig({
    plugins: [react(), favicon()],
    root: 'resources/demo',
    base: './',
    build: {
        outDir: '../../dist/demo',
        emptyOutDir: true,
        rolldownOptions: {
            input: ['index.html', 'layout.html'].map((pagina) => delRepo(`resources/demo/${pagina}`)),
        },
    },
});
