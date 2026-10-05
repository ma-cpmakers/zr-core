import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Il build prova in CI che i componenti compilano. I frontend non usano questo dist: prendono i componenti dal
// pacchetto installato, col loro Vite. React resta fuori: lo porta il frontend, e due copie di React rompono gli hook.
export default defineConfig({
    plugins: [react()],
    build: {
        lib: {
            entry: 'resources/js/index.ts',
            formats: ['es'],
            fileName: 'zr-core',
        },
        outDir: 'dist',
        rolldownOptions: {
            external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'],
        },
    },
});
