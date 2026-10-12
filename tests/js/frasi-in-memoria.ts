import { beforeAll } from 'vitest';
import { caricaFrasi, lingue } from '../../resources/js/lingue';

// Le frasi delle notifiche la cornice le carica quando si apre la campanella, un pezzo per lingua (sprint 30 · T1): in un
// browser è una richiesta, e l'elenco compare quando arriva. I casi di vitest che aprono la campanella guardano altro —
// l'elenco, le letture, il numero — e contano i giri di attesa di una sola richiesta, quella dell'elenco: qui le frasi di
// ogni lingua sono in memoria prima di ogni file di casi, come a una seconda apertura. La prima apertura, le frasi che non
// arrivano e il cambio di lingua hanno i loro casi (cornice.test.tsx), che si danno un caricatore loro.
beforeAll(async () => {
    // La lingua vuota è una che zr-core non ha: le sue frasi sono quelle dell'inglese.
    await Promise.all([...lingue, ''].map((lingua) => caricaFrasi(lingua)));
});
