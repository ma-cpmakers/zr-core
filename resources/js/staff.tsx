import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { MenuItem, ShellCrumb, ShellSearchResult } from '../zeiras/index';
import type { GruppoDiVoci } from './cornice';
import { fileDelleLingue, testi, useLinguaPronta, type TestiDellaCornice } from './lingue';
import { SaltaAlContenuto } from './salto';
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
    /** Quanti risultati ha trovato la ricerca (`{n}`), per il lettore di schermo: nella zona nascosta alla vista (voce #2986). */
    searchCount: string;
    /** La ricerca all'invio (voce #2965): l'invito, e ciò che dice il pannello prima di Invio. Fuori dalle lingue della cornice (Decisione 20570). */
    searchSubmitHint: string;
    searchPressEnter: string;
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
    /** La lingua dello staff (`it`, `es`, `en`…): in una lingua che zr-core non ha, la cornice è in inglese. */
    lingua: string;
    /** Chi è entrato: nell'avatar e in cima al menu del profilo. */
    persona: { nome: string; email: string };
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
    onCrumb?: ((voce: ShellCrumb, indice: number) => void) | undefined;
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

function NellaSuaLingua({ lingua, persona, nav = [], active, menu = [], configurazione = true, onLogout, cerca, cercaAllInvio = false, naviga = (indirizzo) => location.assign(indirizzo), children, ...pagina }: CorniceDelloStaffProps) {
    const t = testi(lingua);
    // La ricerca: lo stato dell'`AppShell` e i risultati dell'ultima parola. Una parola nuova annulla quella di prima, e una
    // risposta di una richiesta annullata — arrivata, o rifiutata per l'annullo — non entra: lo stato è sempre dell'ultima.
    const [ricerca, setRicerca] = useState<{ stato: 'loading' | 'error' } | { stato: 'ready'; risultati: ShellSearchResult[] }>();
    const inVolo = useRef<AbortController>(undefined);
    // A ogni tasto nel campo, con 2 caratteri o più, la ricerca è subito in caricamento, come nella `Cornice` (voce 2062): fino
    // alla chiamata dell'`AppShell`, 300 ms dopo l'ultimo tasto, sotto la parola nuova resterebbero i risultati della vecchia. La
    // richiesta della parola di prima si annulla. L'ascolto sta sulla finestra, dopo quello di React: sul campo, lo stato
    // cambiato durante l'evento ridisegnerebbe l'`AppShell` col valore di prima, e in un browser vero il campo terrebbe un
    // carattere solo (R.0 di `scripts/uat-cornice.mjs`). Un `input` che lascia nel campo il valore di prima non arriva
    // all'`AppShell`, che non chiama la cornice: lì il tasto non cambia niente. Smontata, la cornice annulla la richiesta in volo.
    // Con la ricerca all'invio un tasto non cerca: niente caricamento e niente annullo.
    const conCerca = useRef(cerca);
    conCerca.current = cerca;
    const allInvio = useRef(cercaAllInvio);
    allInvio.current = cercaAllInvio;
    // Quanti risultati ha trovato la ricerca, per il lettore di schermo (voce #2986): come nella `Cornice` (#2801), una zona figlia
    // di `body`, nascosta alla vista, che c'è dal montaggio — una zona che nasce col testo dentro non si legge — e si svuota a ogni
    // ricerca che parte, così lo stesso numero si dice di nuovo. Provvisoria come quella: si toglie quando l'`AppShell` ne tiene una
    // sua (riga 134 delle richieste al design system). Sta prima degli altri ascolti: alla prima ricerca c'è già.
    const quanti = useRef<HTMLElement>(undefined);
    useLayoutEffect(() => {
        document.body.insertAdjacentHTML('beforeend', '<p role="status" class="zr-visually-hidden">');
        const zona = (quanti.current = document.body.lastElementChild as HTMLElement);

        return () => zona.remove();
    }, []);
    useLayoutEffect(() => {
        let visto: string | undefined;
        const alTasto = (e: Event) => {
            const campo = e.target as HTMLInputElement;
            if (conCerca.current && !allInvio.current && campo.matches?.('.zr-top .zr-search input') && visto !== (visto = campo.value) && campo.value.trim().length > 1) {
                inVolo.current?.abort();
                setRicerca({ stato: 'loading' });
            }
        };
        addEventListener('input', alTasto);

        return () => (inVolo.current?.abort(), removeEventListener('input', alTasto));
    }, []);
    // I rimedi provvisori di tastiera, come per la `Cornice`: arrivano a cornice montata, e a ogni cambio di lingua riprendono i nomi.
    useLayoutEffect(() => {
        void import('./rimedi').then((rimedi) => rimedi.via(naviga, t.mainContent, t.searchResults), () => undefined);
    }, [t.mainContent, t.searchResults]);
    // La `cerca` è quella di adesso, non quella del tasto di 300 ms fa: se il modulo l'ha tolta non parte niente. Una `cerca` che
    // lancia è una ricerca in errore, non un caricamento che non finisce.
    const cercata = useRef<string>(undefined);
    const cercaParola = (parola: string) => {
        cercata.current = parola;
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
    const { area, logout, searchCount, ...dello } = testiDelloStaff(lingua);
    const numero = ricerca?.stato === 'ready' ? searchCount.replace('{n}', `${ricerca.risultati.length}`) : '';
    // Con la ricerca all'invio la risposta di una parola che nel campo non c'è più (la persona ha scritto mentre caricava) si vede
    // solo tornando a quella parola: il lettore di schermo non ne dice il numero (revisione dello sprint 105, R1).
    useLayoutEffect(() => {
        const campo = document.querySelector<HTMLInputElement>('.zr-top .zr-search input');
        if (numero && allInvio.current && campo?.value.trim() !== cercata.current) {
            return;
        }
        if (quanti.current && quanti.current.textContent !== numero) {
            quanti.current.textContent = numero;
        }
    }, [numero]);
    const esci: MenuItem = { icon: 'arrow', label: logout, onClick: onLogout };

    return (
        <>
            <SaltaAlContenuto testo={t.skipToContent} />
            <AppShell
                {...Object.fromEntries(Object.entries(pagina).filter(([, valore]) => valore !== undefined))}
                // Con `null` nessuna voce: un id che nessuna voce ha.
                {...(active === null ? { active: '-' + nav.flatMap((gruppo) => gruppo.items.map((voce) => voce.id)).join('-') } : active === undefined ? {} : { active })}
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
                labels={{ ...t, ...dello }}
            >
                {children}
            </AppShell>
        </>
    );
}
