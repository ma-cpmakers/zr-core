// app.html: la stessa pagina di prova di index.html (demo.tsx), con la cornice presa dall'ingresso per le app. Da lì nessuno
// scrive `window.Zeiras`, e la pagina lo dice sotto le scelte.
import { Cornice } from '../js/app';
import { avvia } from './demo';

avvia(Cornice, <p id="uat-zeiras">window.Zeiras: {'Zeiras' in window ? 'presente' : 'assente'}</p>);
