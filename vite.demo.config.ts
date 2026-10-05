import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// La pagina di prova della UAT (resources/demo): `npm run demo` la costruisce in dist/demo, `npx vite preview --config
// vite.demo.config.ts` la serve. Non entra nel pacchetto.
export default defineConfig({
    plugins: [react()],
    root: 'resources/demo',
    base: './',
    build: {
        outDir: '../../dist/demo',
        emptyOutDir: true,
    },
});
