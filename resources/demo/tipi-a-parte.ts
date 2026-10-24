// Lettura della PR #128 (rilievo 5): i moduli a parte dei componenti presi come li prende un frontend, coi loro tipi. Il giro di
// `tsc` coi tipi stretti (tsconfig.stretto.json) lascia fuori i casi di vitest, e questo file no: un tipo che manca o cambia nei
// `.d.ts` di MentionField e AddressField lo ferma. Nessuna pagina lo carica.
import { createElement, type ReactElement } from 'react';
import { AddressField, type AddressLabels, type AddressPlace, type AddressSuggestion } from '../js/zeiras/AddressField';
import { MentionField, type MentionLabels, type MentionOption } from '../js/zeiras/MentionField';

const luoghi: AddressSuggestion[] = [{ id: 'a1', main: 'Arezzo', secondary: 'AR, Italia', kind: 'citta', placeId: 'p-arezzo' }];
const etichetteDegliIndirizzi: AddressLabels = { results: 'Luoghi', attribution: 'Suggerimenti di Google' };
const aziende: MentionOption[] = [{ id: 'c1', name: 'Bianchi Arredamenti S.r.l.' }];
const etichetteDelleMenzioni: MentionLabels = { results: 'Aziende del CRM' };

export function campiAParte(scelto: (luogo: AddressPlace | null) => void): ReactElement[] {
    return [
        createElement(AddressField, { label: 'Indirizzo', suggestions: luoghi, labels: etichetteDegliIndirizzi, onSelect: scelto, onQuery: (testo: string) => testo.length }),
        createElement(MentionField, { label: 'Azienda', suggestions: aziende, labels: etichetteDelleMenzioni, multiple: false }),
    ];
}
