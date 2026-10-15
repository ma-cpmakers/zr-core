// La ricerca della cornice, in un pezzo a richiesta (dalla `v2.8.0`): la richiesta a POST /cornice/ricerca, che cosa si fa della
// risposta, e come un risultato diventa una riga dell'`AppShell`. La cornice lo chiede al primo fuoco nel campo della ricerca, o
// alla prima parola (`chiediLaRicerca`, in `servizi.ts`): nel JS d'ingresso restano il campo, i suoi testi e gli stati. Nessun
// ingresso riesporta niente da qui. Dalla `v2.16.0` la `chiama` e chi è a schermo li passa la cornice (`cercaPer`): col JS della
// cornice servito con una coda il `servizi` che questo pezzo importa può essere un'altra copia, dove a schermo non c'è nessuno.

import type { ShellSearchResult } from '../zeiras/index';
import { FORMA_DI_UN_ID, FORMA_DI_UNO_SLUG } from './forme';
import { nomeDellaVoce, nomePulito, type TestiDellaCornice } from './lingue';
import { nelWorkspace, prodottoDelRegistro, registro, type CodiceDelContesto, type RisorsaDelProdotto, type TipoDiRisorsa } from './registro';
import type { StatoDellaRicerca } from './cornice';
import type { chiama, Persona, RisultatoDellaRicerca } from './servizi';

/** Senza le chiavi che non hanno un valore: l'`AppShell` distingue una prop che manca da una `undefined`. */
const senzaUndefined = <T>(oggetto: { [K in keyof T]: T[K] | undefined }) => Object.fromEntries(Object.entries(oggetto).filter(([, valore]) => valore !== undefined)) as T;

/**
 * Le risorse del workspace che rispondono a `parola`, nell'ordine del backoffice: POST /cornice/ricerca. La parola sta nel
 * corpo, mai nell'indirizzo di questa richiesta: ciò che una persona cerca non deve restare dove restano gli indirizzi del
 * browser (dalla `v1.15.0` sta nel corpo anche dal server del modulo al backoffice). `segnale` annulla la richiesta. Coi
 * risultati, il workspace di cui sono, come lo dice la parte server (dalla
 * `v1.12.0`): quello della sessione, che non è sempre quello della pagina, ed è lì che un risultato si apre. Una risposta che
 * non lo dice, o lo dice senza la forma di uno slug (dalla `v1.13.0`: quella che vale per una notifica), è un errore come una
 * senza la lista: senza, un risultato non ha un indirizzo, e con `..` ne avrebbe un altro. `persona` è quella della cornice
 * che chiede (email e impronta): i risultati, o un errore, di un'altra persona non tornano (`chiama`).
 */
export async function cerca(parola: string, segnale: AbortSignal, persona: Persona, chiama_: typeof chiama): Promise<{ risultati: RisultatoDellaRicerca[]; workspace: string }> {
    const indirizzo = '/cornice/ricerca';
    const corpo = (await chiama_(indirizzo, persona, 'POST', { q: parola }, { signal: segnale })) as { data?: unknown; workspace?: unknown } | null;
    if (!Array.isArray(corpo?.data)) {
        throw new Error(`POST ${indirizzo}: data`);
    }
    if (typeof corpo.workspace !== 'string' || !FORMA_DI_UNO_SLUG.test(corpo.workspace)) {
        throw new Error(`POST ${indirizzo}: workspace`);
    }

    return { risultati: corpo.data as RisultatoDellaRicerca[], workspace: corpo.workspace };
}

/**
 * Di che voce del registro è ogni tipo di risorsa, e come si mostra: un tipo sta in una voce sola. La voce è un prodotto, o la
 * Dashboard per ciò che non è di un modulo (il membro del workspace).
 */
const risorsePerTipo = new Map(registro.flatMap((dellaVoce) => (dellaVoce.risorse ?? []).map((risorsa) => [risorsa.tipo, { dellaVoce, risorsa }] as const)));

/**
 * Ciò che unisce due testi in una riga. Non è un testo delle lingue, ed è scritto qui apposta: è il segno che il design system
 * scrive da sé fra due testi di una riga dell'`AppShell` (il prodotto e l'ora di una notifica), e la seconda riga di un
 * risultato, che sta nello stesso `AppShell`, li unisce allo stesso modo. Un caso di `cornice.test.tsx` lo lega a quello del
 * design system: se lì cambia, il caso è rosso e questo si cambia con lui.
 */
const FRA_DUE_TESTI = ' · ';

/**
 * La seconda riga di un risultato della ricerca: i testi di `contesto` che il registro dice per il suo tipo (le chiavi di
 * `risorsa.contesto`), nel loro ordine e senza gli spazi intorno, uniti da « · ». Solo quelli che ci sono: `contesto` arriva dal
 * backoffice, e una chiave può mancare, essere `null`, vuota o non essere un testo — allora non conta, e non lascia un « · »
 * appeso. Dove il registro dice che una chiave porta un codice (`risorsa.codici`: il ruolo di un membro del workspace, l'esito
 * di un'opportunità chiusa) si legge il testo che quel codice ha nella lingua (`t`), mai il codice: un valore che non è uno di
 * quei codici non conta (l'esito `aperta` di un'opportunità aperta, che resta con pipeline e fase). Una chiave
 * senza codici porta un testo, e si mostra com'è arrivato, pulito come un nome (`nomePulito`: il ruolo di un contatto del CRM). Niente (`undefined`) senza testi,
 * senza `contesto`, o per un tipo che nel registro non ha chiavi.
 */
function secondaRiga(contesto: unknown, tipo: TipoDiRisorsa, risorsa: RisorsaDelProdotto, t: TestiDellaCornice): string | undefined {
    const chiavi = risorsa.contesto;
    if (typeof contesto !== 'object' || contesto === null || chiavi === undefined) {
        return undefined;
    }
    const presenti = chiavi.flatMap((chiave) => {
        const testo = nomePulito(Object.hasOwn(contesto, chiave) ? (contesto as Record<string, unknown>)[chiave] : undefined);
        if (testo === undefined) {
            return [];
        }
        // I codici di una chiave sono solo quelli che il registro le dà: non una proprietà che ogni oggetto eredita.
        const codici = risorsa.codici !== undefined && Object.hasOwn(risorsa.codici, chiave) ? risorsa.codici[chiave] : undefined;
        if (codici === undefined) {
            return [testo];
        }

        return codici.includes(testo) ? [t[`searchContext.${tipo}.${chiave}.${testo}` as `searchContext.${CodiceDelContesto}`]] : [];
    });

    return presenti.length === 0 ? undefined : presenti.join(FRA_DUE_TESTI);
}

/**
 * Un risultato della ricerca nella cornice. Il contratto dà tipo, id, titolo e, dalla `v1.15.0`, `contesto`: la voce è
 * quella che nel registro ha quel tipo fra le sue risorse (un tipo sta in una voce sola), mai un campo della risposta. Il
 * gruppo è il nome del tipo nella lingua dei testi, la seconda riga i testi di `contesto` che il registro dice per il tipo
 * (`secondaRiga`), nome e tono sono del prodotto, l'icona del tipo; l'indirizzo è quello della voce nel workspace dei
 * risultati (`slug`: quello che la risposta della ricerca dice, non quello dei dati della pagina) seguito dal percorso del
 * tipo. Un membro del workspace è della voce della Dashboard, che non è un prodotto: non ha un nome a destra né un tono, come
 * una notifica che non è di un prodotto, e si apre in app. Un tipo che il registro non ha non si mostra: mai un indirizzo
 * inventato. E non si mostra un risultato il cui id non ha la forma di un id: arriva dal backoffice, e in un indirizzo non
 * entra com'è (`encodeURIComponent` non tocca i punti, e `..` ne farebbe un altro). La forma si guarda solo di un testo:
 * `RegExp.test` converte ciò che riceve, e un id che manca, `null` o un numero passerebbe come «undefined», «null», «12».
 */
function nellaRicerca(risultato: RisultatoDellaRicerca, lingua: string, t: TestiDellaCornice, slug: string): ShellSearchResult | undefined {
    const trovata = risorsePerTipo.get(risultato.tipo);
    const { id } = risultato;
    // Il titolo lo ha scritto una persona: pulito come un nome. Senza un titolo che si vede il risultato non si mostra.
    const title = nomePulito(risultato.titolo);
    if (trovata === undefined || typeof id !== 'string' || !FORMA_DI_UN_ID.test(id) || title === undefined) {
        return undefined;
    }
    const { dellaVoce, risorsa } = trovata;
    const tipo = `${dellaVoce.id}.${risorsa.tipo}` as TipoDiRisorsa;
    const delProdotto = prodottoDelRegistro(dellaVoce.id);

    return senzaUndefined<ShellSearchResult>({
        // Unico fra i tipi: una board e una cartella possono avere lo stesso id.
        id: `${tipo}.${id}`,
        title,
        subtitle: secondaRiga(risultato.contesto, tipo, risorsa, t),
        group: t[tipo],
        product: delProdotto && nomeDellaVoce(delProdotto, lingua),
        icon: risorsa.icona,
        tone: dellaVoce.tono,
        container: risorsa.contenitore,
        href: nelWorkspace(dellaVoce.indirizzo, slug) + risorsa.percorso.replace('{id}', () => encodeURIComponent(id)),
    });
}

/**
 * I risultati di un gruppo vicini, perché l'`AppShell` ne apre uno a ogni cambio di gruppo: i gruppi nell'ordine del primo
 * risultato di ognuno, e dentro un gruppo l'ordine del backoffice.
 */
function perGruppo(risultati: ShellSearchResult[]): ShellSearchResult[] {
    const gruppi = [...new Set(risultati.map((risultato) => risultato.group))];

    return [...risultati].sort((primo, secondo) => gruppi.indexOf(primo.group) - gruppi.indexOf(secondo.group));
}

/** Le righe dell'`AppShell` per i risultati arrivati, nel workspace di cui sono (`slug`): solo quelli che il registro conosce, i gruppi vicini. */
export const risultatiDellaRicerca = (risultati: RisultatoDellaRicerca[], lingua: string, t: TestiDellaCornice, slug: string) => perGruppo(risultati.flatMap((risultato) => nellaRicerca(risultato, lingua, t, slug) ?? []));

/**
 * Quanti secondi, al più, la cornice tiene ferma la ricerca dopo un 429 del backoffice, qualunque cosa dica `Retry-After`: la
 * cornice resta montata fra le pagine, e un valore sbagliato non deve spegnere la ricerca per un'ora.
 */
const TETTO_DEL_FRENO = 60;

/**
 * Cerca `parola` per la cornice che l'ha chiesta, e ne scrive l'esito nel suo stato (`mostra`): i risultati col loro workspace,
 * l'errore, o il freno dopo un 429 (`frenataFinoA`, `nelFreno`). Alla parte server vanno i primi 100 caratteri. La cornice lo
 * chiama quando il pezzo è arrivato, che può essere dopo: una richiesta annullata nel frattempo (una parola nuova, lo stato
 * ridotto, la cornice smontata, anche se rifatta con la stessa persona) non parte, e non parte quella di chi non è più a
 * schermo (`aSchermo`: la cornice di un'altra persona, o nessuna). `aSchermo` e `chiama_` sono quelli della cornice, letti
 * quando il pezzo arriva, mai quelli del `servizi` di questo pezzo (dalla `v2.16.0`); e il freno si riconosce dai `secondi` di
 * un 429 (`TroppeRichieste`), non dalla classe, che con un'altra copia del modulo è un'altra.
 * Di una richiesta che non è più l'ultima (`inVolo`) l'esito non entra nello stato, tranne il freno, che è della persona.
 */

export function cercaPer(parola: string, questa: AbortController, persona: Persona, inVolo: { current: AbortController | undefined }, frenataFinoA: { current: number }, mostra: (stato: StatoDellaRicerca) => void, seDaAccettare: (errore: unknown) => void, nelFreno: () => void, aSchermo: string | undefined, chiama_: typeof chiama): Promise<void> | undefined {
    if (questa.signal.aborted || persona.email !== aSchermo) {
        return undefined;
    }

    return cerca([...parola].slice(0, 100).join(''), questa.signal, persona, chiama_).then(
        ({ risultati, workspace }) => {
            if (inVolo.current === questa) {
                mostra({ stato: 'ready', risultati, workspace });
            }
        },
        (errore: unknown) => {
            seDaAccettare(errore);
            const secondi = (errore as { secondi?: number } | undefined)?.secondi;
            if (secondi) {
                frenataFinoA.current = performance.now() + Math.min(secondi, TETTO_DEL_FRENO) * 1000;
                nelFreno();
            } else if (inVolo.current === questa) {
                mostra({ stato: 'error' });
            }
        },
    );
}
