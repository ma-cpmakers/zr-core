import type { GruppoDiVoci } from './cornice';
import type { TestiDellaCornice } from './lingue';
import type { Button as Pulsante, Logo as Marchio } from './zeiras/componenti';

// La barra di chi arriva su una pagina senza i dati della cornice (dalla `v2.24.0`): una barra sola con il logo, le voci del
// modulo ed «Esci», che non chiedono niente al backoffice, così la persona non resta senza strada. È un pezzo a richiesta: il
// layout lo chiede con `import()` quando la cornice non c'è, e nessun ingresso riesporta niente da qui. PROVVISORIA (sì di
// zr-pm, Decisione 15190): il design system non ha ancora la barra minima, e questa ha i soli suoi pezzi (`Logo`, `Button`);
// quando c'è, si toglie e la sostituisce lui. Non è una seconda cornice (linea guida 15): niente moduli, workspace, ricerca né
// notifiche.

// Il pezzo non importa niente a valore: il layout gli dà i componenti e i testi che ha già nell'ingresso, e la build non spezza in
// pezzi a parte il modulo dei componenti, le lingue e il registro (misurato: +550 byte per chiunque usi il layout).
export interface BarraProps {
    Button: typeof Pulsante;
    Logo: typeof Marchio;
    t: Readonly<TestiDellaCornice>;
    nav?: GruppoDiVoci[] | undefined;
    active?: string | null | undefined;
    onNavigate?: ((id: string) => void) | undefined;
    onLogout: () => void;
}

// Gli stili sono in linea, coi soli token del design system per nome: il design system non ha una classe per questa barra, e il
// pacchetto non aggiunge un foglio di stile per un pezzo provvisorio.
export default function Barra({ Button, Logo, t, nav, active, onNavigate, onLogout }: BarraProps) {
    return (
        <header
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                height: 'var(--topbar-height)',
                padding: '0 var(--space-4)',
                background: 'var(--surface-raised)',
                borderBottom: '1px solid var(--line)',
            }}
        >
            <Logo />
            <nav aria-label={t.nav} style={{ display: 'flex', flexGrow: 1, gap: 'var(--space-1)', minWidth: 0, overflowX: 'auto' }}>
                {nav?.flatMap((gruppo) => gruppo.items).map((voce) => (
                    <Button key={voce.id} size="sm" variant={voce.id === active ? 'secondary' : 'ghost'} icon={voce.icon} aria-current={voce.id === active ? 'page' : undefined} onClick={() => onNavigate?.(voce.id)}>
                        {voce.label}
                    </Button>
                ))}
            </nav>
            <Button size="sm" variant="ghost" onClick={onLogout}>
                {t.logout}
            </Button>
        </header>
    );
}
