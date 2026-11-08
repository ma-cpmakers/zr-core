import { useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import type { MenuItem, ShellCrumb, ShellSearchResult } from '../zeiras/index';
import type { GruppoDiVoci } from './cornice';
import { DELL_INGRESSO, fileDelleLingue, linguaDeiTesti, linguaPronta, testi, useLinguaPronta, type TestiDellaCornice } from './lingue';
import { AppShell } from './zeiras/componenti';
import inglese from '../lingue/staff/en.json';

// La cornice dello staff (dalla `v3.16.0`, voce #2944, Decisioni 19872 e 19904): l'`AppShell` del design system per chi lavora in
// zr-superadmin, che non ha `Cornice::dati()` — il suo gettone apre solo i metodi `staff.*`. Ciò che la riempie lo dà il modulo:
// chi è lo staff, le voci della barra e del profilo, la ricerca. Non c'è il selettore di workspace, non c'è il menu Moduli e non
// ci sono notifiche; la campanella resta, vuota, perché l'`AppShell` la disegna sempre (richiesta 64 al design system).

/**
 * I testi dello staff, per lingua: un file loro (`resources/lingue/staff/`), fuori dalle lingue della cornice, che stanno nel JS
 * d'ingresso di ogni app. Così entrano solo nella build di chi monta questa cornice.
 */
const file = import.meta.glob<TestiDelloStaff>('../lingue/staff/*.json', { eager: true, import: 'default' });

type TestiDelloStaff = Pick<TestiDellaCornice, 'settings' | 'planTitle' | 'planText' | 'searchPlaceholder' | 'searchHint' | 'searchEmptyText' | 'notificationsEmptyText' | 'logout'> & {
    /** In cima alla barra, al posto del workspace. */
    area: string;
    /** Quanti risultati ha trovato la ricerca (`{n}`), per il lettore di schermo: nella zona viva dell'`AppShell` (voce #2986). */
    searchCount: string;
    /** La ricerca all'invio (voce #2965): l'invito, e ciò che dice il pannello prima di Invio. Fuori dalle lingue della cornice (Decisione 20570). */
    searchSubmitHint: string;
    searchPressEnter: string;
    /** Il titolo del riquadro in fondo alla barra col ruolo dello staff (`{ruolo}`), e il testo con la fine della sessione (`{ora}`): voce #2989. */
    planRole: string;
    planUntil: string;
    /** La fine della sessione domani (`{ora}`), e in un altro giorno (`{giorno}` della settimana e `{data}`): voce #3030, dalla `v4.5.1`. */
    planUntilTomorrow: string;
    planUntilDay: string;
};

/** I testi dello staff in una lingua: quelli che la lingua non ha, o ha vuoti, e quelli di una lingua che non c'è sono in inglese. */
function testiDelloStaff(lingua: string): TestiDelloStaff {
    // Si leggono qui e non in cima al modulo: una chiamata in cima la build non la può togliere, e un'app che non monta questa
    // cornice se la porterebbe nell'ingresso.
    const { perCodice, fileDi } = fileDelleLingue(file);
    const scelti: Partial<TestiDelloStaff> = perCodice.get(fileDi(lingua)!) ?? {};

    return Object.fromEntries(Object.entries(inglese).map(([chiave, testo]) => [chiave, scelti[chiave as keyof TestiDelloStaff]?.trim() ? scelti[chiave as keyof TestiDelloStaff] : testo])) as TestiDelloStaff;
}

export interface CorniceDelloStaffProps {
    /**
     * La lingua dello staff (`it`, `es`, `en`…): in una lingua che zr-core non ha, la cornice è in inglese; se il file della lingua
     * (o l'inglese, per una lingua che zr-core non ha) non arriva, tutta in italiano (dalla `v4.5.1`, voce #3031).
     */
    lingua: string;
    /** Chi è entrato: nell'avatar e in cima al menu del profilo. */
    persona: { nome: string; email: string };
    /**
     * Il ruolo dello staff, già nella sua lingua (dalla `v4.5.0`, voce #2989): il titolo del riquadro in fondo alla barra, con
     * «· 2FA». Senza, il riquadro dice «Staff di Zeiras».
     */
    ruolo?: string | undefined;
    /**
     * Quando finisce al più la sessione (dalla `v4.5.0`, voce #2989), una data ISO (`scade_il` del gettone dello staff): il riquadro
     * dice l'ora, nel fuso del browser, e dalla `v4.5.1` il giorno quando non è oggi (#3030). «Al più tardi», perché 30 minuti d'inattività la chiudono prima (Decisione 20721).
     */
    sessioneFinoA?: string | undefined;
    /** Le voci della barra, coi loro gruppi. */
    nav?: GruppoDiVoci[] | undefined;
    /** L'id della voce attiva; con `null` nessuna. */
    active?: string | null | undefined;
    /** Il clic su una voce della barra; «Configurazione», in fondo alla barra, arriva come `settings`. */
    onNavigate?: ((id: string) => void) | undefined;
    /**
     * «Configurazione» in fondo alla barra (dalla `v4.3.0`, voce #2954): c'è di norma; con `false` non c'è, né nella barra né nel
     * cassetto, per chi non è Superadmin.
     */
    configurazione?: boolean | undefined;
    /** Il percorso: l'ultima voce è la pagina. */
    crumbs?: ShellCrumb[] | undefined;
    /**
     * Il clic su una voce del percorso, con l'evento (dalla `v4.18.0`): con `preventDefault` la voce la gestisce il modulo;
     * altrimenti un clic semplice su un indirizzo di questa origine passa da `naviga`.
     */
    onCrumb?: ((voce: ShellCrumb, indice: number, evento: MouseEvent<HTMLAnchorElement>) => void) | undefined;
    /** Altro in topbar. */
    actions?: ReactNode;
    /** L'area della pagina senza margine. */
    flush?: boolean | undefined;
    /** Le voci del modulo nel menu del profilo, prima di «Esci». */
    menu?: MenuItem[] | undefined;
    /** «Esci»: la sessione la chiude il modulo. Obbligatorio: senza, «Esci» non farebbe niente. */
    onLogout: () => void;
    /**
     * La ricerca della barra: dal secondo carattere, 300 ms dopo l'ultimo tasto (con `cercaAllInvio`, a Invio), con la parola e un
     * segnale che si annulla quando la persona scrive un'altra parola o la cornice si smonta. Dà i risultati, o rifiuta (la ricerca è
     * in errore). Senza, il campo non cerca niente.
     */
    cerca?: ((parola: string, segnale: AbortSignal) => Promise<ShellSearchResult[]>) | undefined;
    /**
     * La ricerca parte solo con Invio (dalla `v4.3.0`, voce #2965), non da sola mentre si scrive: prima di Invio il pannello dice
     * «Premi Invio per cercare». Una parola cambiata dopo i risultati torna lì, senza annullare la ricerca di prima.
     */
    cercaAllInvio?: boolean | undefined;
    /** Come si apre l'indirizzo di un risultato: di norma il browser ci va. */
    naviga?: ((indirizzo: string) => void) | undefined;
    children?: ReactNode;
}

/**
 * La cornice dello staff nella sua lingua (dalla `v4.4.0`), come quella dei moduli: finché la lingua non è pronta non si disegna,
 * e con lei la pagina dentro; a un cambio di lingua resta in quella di prima finché la nuova non è pronta (`useLinguaPronta`).
 */
export function CorniceDelloStaff(props: CorniceDelloStaffProps) {
    const lingua = useLinguaPronta(props.lingua);

    return lingua === undefined ? null : <NellaSuaLingua {...props} lingua={lingua} />;
}

function NellaSuaLingua({ lingua, persona, ruolo, sessioneFinoA, nav = [], active, menu = [], configurazione = true, onLogout, cerca, cercaAllInvio = false, naviga = (indirizzo) => location.assign(indirizzo), children, ...pagina }: CorniceDelloStaffProps) {
    const t = testi(lingua);
    // La ricerca: lo stato dell'`AppShell` e i risultati dell'ultima parola. Una parola nuova annulla quella di prima, e una
    // risposta di una richiesta annullata — arrivata, o rifiutata per l'annullo — non entra: lo stato è sempre dell'ultima.
    const [ricerca, setRicerca] = useState<{ stato: 'loading' | 'error' } | { stato: 'ready'; risultati: ShellSearchResult[] }>();
    const inVolo = useRef<AbortController>(undefined);
    // Smontata, la cornice annulla la richiesta in volo.
    useLayoutEffect(() => () => inVolo.current?.abort(), []);
    // I rimedi provvisori di tastiera, come per la `Cornice`: arrivano a cornice montata.
    useLayoutEffect(() => void import('./rimedi').catch(() => undefined), []);
    // La `cerca` è quella di adesso, non quella del tasto di 300 ms fa: se il modulo l'ha tolta non parte niente. Una `cerca` che
    // lancia è una ricerca in errore, non un caricamento che non finisce. Dal tasto alla chiamata il caricamento lo mostra
    // l'`AppShell` (dalla `v4.18.0`, richiesta 46).
    const conCerca = useRef(cerca);
    conCerca.current = cerca;
    const cercaParola = (parola: string) => {
        inVolo.current?.abort();
        const questa = (inVolo.current = new AbortController());
        const ora = conCerca.current;
        if (!ora) {
            return setRicerca(undefined);
        }
        setRicerca({ stato: 'loading' });
        new Promise<ShellSearchResult[]>((risolvi) => risolvi(ora(parola, questa.signal))).then(
            (risultati) => questa.signal.aborted || setRicerca({ stato: 'ready', risultati }),
            () => questa.signal.aborted || setRicerca({ stato: 'error' }),
        );
    };
    // Se la lingua non è arrivata la cornice è in italiano, la lingua dell'ingresso: anche i testi dello staff, che sono qui in
    // tutte le lingue, e l'ora del riquadro (voce #3031). Prima restavano nella lingua chiesta, e la cornice era in due lingue.
    const comeLaCornice = linguaPronta(lingua) ? lingua : DELL_INGRESSO;
    const { area, logout, planRole, planUntil, planUntilTomorrow, planUntilDay, ...dello } = testiDelloStaff(comeLaCornice);
    // Il riquadro in fondo alla barra: il ruolo e la fine (l'ora, e il giorno quando non è oggi), quando il modulo li dà e si leggono; altrimenti i testi di prima.
    const fine = new Date(sessioneFinoA ?? '');
    if (ruolo?.trim()) {
        dello.planTitle = planRole.replace('{ruolo}', () => ruolo.trim());
    }
    if (sessioneFinoA && !isNaN(+fine)) {
        // L'ora nella lingua dei testi, come le date della campanella: un codice che `Intl` rifiuta (`it_IT`) non gli arriva.
        const nellaLingua = linguaDeiTesti(comeLaCornice);
        const ora = new Intl.DateTimeFormat(nellaLingua, { hour: '2-digit', minute: '2-digit' }).format(fine);
        // Il giorno quando non è oggi (voce #3030): i giorni del calendario nel fuso del browser, non 24 ore. Fra due mezzanotti
        // passano 23 o 25 ore al cambio dell'ora legale: l'arrotondamento le conta come un giorno.
        const giorni = Math.round((new Date(fine).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
        // Il giorno della settimana e la data separati: come unirli lo dice la frase della lingua («sábado 7 de noviembre», senza la
        // virgola che `Intl` mette in spagnolo; «Saturday, November 7»).
        const nel = (forma: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(nellaLingua, forma).format(fine);
        const frase = giorni === 0 ? planUntil : giorni === 1 ? planUntilTomorrow : planUntilDay.replace('{giorno}', () => nel({ weekday: 'long' })).replace('{data}', () => nel({ day: 'numeric', month: 'long' }));
        dello.planText = frase.replace('{ora}', () => ora);
    }
    const esci: MenuItem = { icon: 'arrow', label: logout, onClick: onLogout };

    return (
        <AppShell
            {...Object.fromEntries(Object.entries(pagina).filter(([, valore]) => valore !== undefined))}
            // Con `null` nessuna voce.
            {...(active === undefined ? {} : { active })}
            nav={nav}
            user={persona.nome}
            email={persona.email}
            workspace={area}
            settings={configurazione}
            accountItems={menu.length > 0 ? [...menu, { sep: true }, esci] : [esci]}
            notifications={[]}
            {...(cerca ? { onSearch: cercaParola } : {})}
            {...(cercaAllInvio ? { searchOn: 'submit' as const } : {})}
            searchState={ricerca?.stato ?? 'ready'}
            searchResults={ricerca?.stato === 'ready' ? ricerca.risultati : []}
            onSelectResult={(scelto) => scelto.href !== undefined && naviga(scelto.href)}
            navigate={naviga}
            labels={{ ...t, ...dello }}
        >
            {children}
        </AppShell>
    );
}
