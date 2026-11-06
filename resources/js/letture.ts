import { aSchermo, chiama, haLaFormaDiUnId, segno, type Persona } from './chiamate';

// Le due chiamate che segnano lette le notifiche: servono solo col pannello delle notifiche aperto. Dalla `v4.20.0` stanno nel
// pezzo della campanella (`./campanella` le riesporta), non nel JS d'ingresso: quando la persona le chiede il pezzo è già
// arrivato, perché il pannello mostra l'elenco solo con le frasi, che sono sue (Decisione 22247).

/**
 * Segna lette, con una richiesta sola, le notifiche della persona nate fino a `finoA` compreso, anche quelle che la cornice non
 * ha caricato: POST /cornice/notifiche/letture. `finoA` è un istante col suo fuso, come la `creata_il` di una notifica;
 * `workspace` è lo slug del workspace della pagina, quello per cui l'istante è stato calcolato: se la sessione è passata a un
 * altro (un'altra scheda) la parte server non segna niente. `persona` è quella della cornice che chiede (email e impronta), e dalla `v2.6.0` l'email parte
 * nell'intestazione come per le altre richieste, non più nel corpo: se la sessione è passata a un'altra persona (una scheda
 * rimasta ferma) la parte server non segna niente nemmeno lì, lo dice col 409 `persona_diversa` (dalla `v2.12.0` senza l'email di chi è entrato), e la pagina si ricarica,
 * col tetto e l'orologio di `chiama`. Una risposta senza `fino_a` è un errore come le altre. Dà
 * l'istante in cui la parte server le ha segnate (`segnate_il`): se manca, o ha un'altra forma, non è un errore, è senza segno.
 * E dice se ne restano (`altre`): la parte server si è fermata a un tetto, e la stessa richiesta continua da lì. Solo il
 * booleano `true` lo dice: una parte server di prima della `v1.3.0` non dà `altre`, e allora non ne restano. Dalla `v4.24.0` la
 * cornice del cliente le segna con le rotte sue (`radice` `/cornice/cliente`, voce 3398), senza un workspace: il corpo porta solo `fino_a`.
 */
export async function segnaLetteFinoA(finoA: string, workspace: string | undefined, persona: Persona, radice = '/cornice'): Promise<{ il: string | undefined; altre: boolean }> {
    const indirizzo = radice + '/notifiche/letture';
    const corpo = (await chiama(indirizzo, persona, 'POST', { workspace, fino_a: finoA })) as { data?: { fino_a?: unknown; altre?: unknown } | null; segnate_il?: unknown } | null;
    if (typeof corpo?.data?.fino_a !== 'string') {
        throw new Error(`POST ${indirizzo}: fino_a`);
    }

    return { il: segno(corpo.segnate_il), altre: corpo.data.altre === true };
}

/**
 * Segna letta una notifica della persona: PATCH /cornice/notifiche/<id>/lettura con `{"letta": true}`. La cornice la chiama col
 * clic che apre la risorsa di una notifica, letta o no, e apre la risorsa solo alla risposta (dalla `v2.14.0`): la richiesta
 * parte nello stesso giro di chi la chiama, e con `keepalive` il browser la porta in fondo anche se la pagina se ne va. L'id sta nel suo pezzo
 * dell'indirizzo, e prima di chiedere deve avere la forma che la rotta vuole: `encodeURIComponent` non tocca i punti, e con
 * `.` o `..` il browser porterebbe la richiesta, col gettone CSRF, a un'altra rotta. Senza quella forma la richiesta non
 * parte, ed è una lettura non riuscita. Solo una risposta che dice `letta: true` è una lettura riuscita: ogni altra è un
 * errore, come una che non è un 2xx. E dalla `v2.14.0` anche quella, se quando arriva chi l'ha chiesta non è più a schermo
 * (`aSchermo`: una visita ha portato la cornice di un'altra persona, o non c'è più nessuna cornice): chi l'ha chiesta non
 * apre la risorsa con la sessione di un altro. Dà l'istante in cui la parte server l'ha segnata (`segnata_il`, dalla `v1.12.0`): se
 * manca, o ha un'altra forma, non è un errore, è senza segno. `persona` è quella della cornice che chiede (email e impronta): se la sessione è
 * passata a un'altra persona la parte server non segna la notifica a chi è entrato (409 `persona_diversa`, dalla `v2.6.0`), e
 * né quel 409 né il 403 `accettazione_richiesta` di un'altra persona tornano a chi ha chiesto: la pagina, se è ancora lì, si
 * ricarica (vedi `chiama`). Dalla `v4.24.0` la cornice del cliente la chiede alla rotta sua (`radice` `/cornice/cliente`, voce 3398).
 */
export async function segnaLetta(id: string, persona: Persona, radice = '/cornice'): Promise<{ il: string | undefined }> {
    // L'id arriva da un elenco che la parte server ha dato, con una conversione di tipo e non con un controllo: se non è un testo
    // un'espressione regolare lo converte da sé, e `null` o un numero hanno la forma di un id.
    if (!haLaFormaDiUnId(id)) {
        throw new Error('PATCH /cornice/notifiche/{id}/lettura: id');
    }
    const indirizzo = `${radice}/notifiche/${encodeURIComponent(id)}/lettura`;
    const corpo = (await chiama(indirizzo, persona, 'PATCH', { letta: true }, { keepalive: true })) as { data?: { letta?: unknown } | null; segnata_il?: unknown } | null;
    if (corpo?.data?.letta !== true || persona.email !== aSchermo) {
        throw new Error(`PATCH ${indirizzo}: letta`);
    }

    return { il: segno(corpo.segnata_il) };
}
