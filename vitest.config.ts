import { defineConfig, mergeConfig } from 'vitest/config';
import vite from './vite.config.ts';

// I test dei componenti (resources/js/**/*.test.ts[x]) girano in CI dopo tsc, con la configurazione del build e un DOM finto:
// niente browser. Inertia è fra i moduli che vitest tratta da sé: inizializza il suo router una volta per modulo, e solo così
// `vi.resetModules()` ne dà uno nuovo a ogni test (inertia.test.tsx); lasciata fuori, dal secondo test in poi il router è
// ancora quello del primo, e le visite non arrivano alla pagina del test.
export default mergeConfig(
    vite,
    defineConfig({
        test: {
            include: ['resources/js/**/*.test.{ts,tsx}'],
            environment: 'happy-dom',
            server: { deps: { inline: [/@inertiajs\//] } },
        },
    }),
);
