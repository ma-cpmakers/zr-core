// App di prova del peso: la cornice dall'ingresso per le app, più due componenti del design system presi per nome.
import { createElement } from 'react';
import { Cornice } from '../../js/app';
import * as Zeiras from '../../js/zeiras/componenti';
import { monta } from './monta';

interface Riga {
    id: number;
    nome: string;
}

const colonne: Zeiras.Column<Riga>[] = [{ key: 'nome', label: 'Nome' }];
const righe: Riga[] = [{ id: 1, nome: 'Ada' }];

monta(Cornice, [
    createElement(Zeiras.Button, { key: 'pulsante' }, 'Nuovo'),
    createElement(Zeiras.DataTable<Riga>, { key: 'tabella', columns: colonne, rows: righe }),
]);
