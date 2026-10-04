import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Il build prova in CI che i componenti compilano. I frontend non usano questo dist: prendono i componenti dal
// pacchetto installato, col loro Vite.
export default defineConfig({
    plugins: [react()],
    build: {
        lib: {
            entry: 'resources/js/index.ts',
            formats: ['es'],
            fileName: 'zr-core',
        },
        outDir: 'dist',
    },
});
