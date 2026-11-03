import type { ReactNode } from 'react';
import type { MenuItem, ShellCrumb } from '../zeiras/index';
import type { GruppoDiVoci } from './cornice';
import { fileDelleLingue, testi, type TestiDellaCornice } from './lingue';
import { AppShell } from './zeiras/componenti';

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
};

/** I testi dello staff in una lingua: quelli che la lingua non ha, o ha vuoti, e quelli di una lingua che non c'è sono in inglese. */
function testiDelloStaff(lingua: string): TestiDelloStaff {
    // Si leggono qui e non in cima al modulo: una chiamata in cima la build non la può togliere, e un'app che non monta questa
    // cornice se la porterebbe nell'ingresso.
    const { perCodice, fileDi } = fileDelleLingue(file);
    const scelti: Partial<TestiDelloStaff> = perCodice.get(fileDi(lingua)!) ?? {};
    const inglese = perCodice.get('en')!;

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
    children?: ReactNode;
}

export function CorniceDelloStaff({ lingua, persona, nav = [], active, menu = [], onLogout, children, ...pagina }: CorniceDelloStaffProps) {
    const t = testi(lingua);
    const { area, logout, ...dello } = testiDelloStaff(lingua);
    const esci: MenuItem = { icon: 'arrow', label: logout, onClick: onLogout };

    return (
        <AppShell
            {...Object.fromEntries(Object.entries(pagina).filter(([, valore]) => valore !== undefined))}
            // Con `null` nessuna voce: un id che nessuna voce ha.
            {...(active === null ? { active: '-' + nav.flatMap((gruppo) => gruppo.items.map((voce) => voce.id)).join('-') } : active === undefined ? {} : { active })}
            nav={nav}
            user={persona.nome}
            email={persona.email}
            workspace={area}
            accountItems={menu.length > 0 ? [...menu, { sep: true }, esci] : [esci]}
            notifications={[]}
            labels={{ ...t, ...dello }}
        >
            {children}
        </AppShell>
    );
}
