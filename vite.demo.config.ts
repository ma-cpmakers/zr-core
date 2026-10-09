import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Le pagine di prova della UAT (resources/demo): `npm run demo` le costruisce in dist/demo, `npx vite preview --config
// vite.demo.config.ts` le serve. Due ingressi: index.html (la `Cornice` montata dalla pagina) e layout.html (il layout della
// cornice sotto Inertia). Non entrano nel pacchetto.
export default defineConfig({
    plugins: [react()],
    root: 'resources/demo',
    base: './',
    build: {
        outDir: '../../dist/demo',
        emptyOutDir: true,
        rolldownOptions: {
            input: ['index.html', 'layout.html'].map((pagina) => fileURLToPath(new URL(`./resources/demo/${pagina}`, import.meta.url))),
        },
    },
});
