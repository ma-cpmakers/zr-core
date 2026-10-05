import { defineConfig, mergeConfig } from 'vitest/config';
import vite from './vite.config.ts';

// I test dei componenti (resources/js/**/*.test.ts[x]) girano in CI dopo tsc, con la configurazione del build e un DOM finto:
// niente browser.
export default mergeConfig(
    vite,
    defineConfig({
        test: {
            include: ['resources/js/**/*.test.{ts,tsx}'],
            environment: 'happy-dom',
        },
    }),
);
