import { beforeAll } from 'vitest';
import { frasiInMemoria } from '../../resources/js/prove';

// Le frasi delle notifiche la cornice le carica quando si apre la campanella, un file per lingua, con `fetch` (sprint 30 · T1):
// in un browser è una richiesta, e l'elenco compare quando arriva. I casi di vitest che aprono la campanella guardano altro —
// l'elenco, le letture, il numero — e contano i giri di attesa di una sola richiesta, quella dell'elenco: qui le frasi di
// ogni lingua sono in memoria prima di ogni file di casi, come a una seconda apertura, con la stessa riga che mette nei suoi
// test chi installa il pacchetto (`frasiInMemoria`). La prima apertura, le frasi che non arrivano e il cambio di lingua hanno
// i loro casi (cornice.test.tsx), che si danno un caricatore loro.
beforeAll(() => frasiInMemoria());
