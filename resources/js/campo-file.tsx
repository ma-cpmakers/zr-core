import { useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type DragEvent } from 'react';
import { fileDelleLingue } from './lingue';
import { Button, Icon } from './zeiras/componenti';
import inglese from '../lingue/campo-file/en.json';

// Il campo per scegliere un file, col clic o trascinandolo (dalla `v5.1.0`, voce #3813: Finanze #3803, richiesta 264 al design
// system, Decisione 25021 di zr-pm-74). Provvisorio e dichiarato (nota 11310): il design system non ha ancora il suo, e questo è
// fatto coi soli pezzi del design system — il `Button`, l'`Icon`, le classi del `Field`, i token — senza un CSS del pacchetto: lo
// stile della zona sta sull'elemento, coi token. Quando il design system porta il suo campo, questo si toglie.

/** I testi del campo; `{name}`, `{types}` e `{size}` si sostituiscono. */
export type EtichetteDelCampoFile = typeof inglese;

export type CampoFileProps = {
    /** Il nome del campo, sopra la zona. */
    label: string;
    /** Il file scelto, se lo tiene il modulo: con `value` il campo mostra questo, e `onChange` dice al modulo cosa cambiare. */
    value?: File | null;
    /** Il file scelto, o `null` quando si toglie. Un file che il campo rifiuta (tipo, dimensione, più di uno) non arriva. */
    onChange?: (file: File | null) => void;
    /** I tipi ammessi: estensioni (`.csv`) o tipi MIME (`application/pdf`, anche `image/*`). Senza, tutti. */
    accept?: string[];
    /** La dimensione massima, in byte. */
    maxSize?: number;
    /** Il testo d'aiuto sotto la zona, come nel `Field`. */
    hint?: string;
    /** L'errore di chi lo usa (per esempio il server): si mostra al posto di quello del campo. */
    error?: string;
    /** Il nome del campo nel form: il file scelto, anche trascinato, viaggia col form. */
    name?: string;
    required?: boolean;
    disabled?: boolean;
    /** I testi, chiave per chiave, al posto di quelli della lingua della pagina. */
    labels?: Partial<EtichetteDelCampoFile>;
};

/** I testi del campo per lingua: un file loro (`resources/lingue/campo-file/`), solo nella build di chi lo usa. */
const file = import.meta.glob<EtichetteDelCampoFile>('../lingue/campo-file/*.json', { eager: true, import: 'default' });

// I file si leggono dentro le funzioni, non in cima al modulo: una chiamata qui entrerebbe nell'ingresso di ogni app, anche di
// chi il campo non lo usa.

/**
 * La lingua dei testi: quella della pagina (`<html lang>`) se zr-core ha il suo file, altrimenti l'inglese. Sul server, dove la
 * pagina non c'è, l'inglese; nel browser React passa alla lingua della pagina dopo l'idratazione, senza errori.
 */
const linguaDellaPagina = () => fileDelleLingue(file).fileDi(document.documentElement.lang) ?? 'en';
const linguaSulServer = () => 'en';
const nessunAscolto = () => () => undefined;

const sostituisci = (testo: string, valori: Record<string, string>) => testo.replace(/\{(\w+)\}/g, (tutto, chiave: string) => valori[chiave] ?? tutto);

/** Una dimensione in byte, nella lingua dei testi: byte sotto il migliaio, kB sotto il milione, MB da lì (unità decimali, come i sistemi). */
function dimensione(byte: number, lingua: string): string {
    const [unita, divisore] = byte >= 1_000_000 ? ['megabyte', 1_000_000] : byte >= 1_000 ? ['kilobyte', 1_000] : ['byte', 1];

    return new Intl.NumberFormat(lingua, { style: 'unit', unit: unita, maximumFractionDigits: 1 }).format(byte / divisore);
}

/** Il file è di un tipo ammesso? L'estensione senza guardare le maiuscole, il tipo MIME anche intero (`image/*`). */
function ammesso(scelto: File, accept: string[]): boolean {
    const nome = scelto.name.toLowerCase();
    const tipo = scelto.type.toLowerCase();

    return accept.some((voce) => {
        const v = voce.trim().toLowerCase();
        if (v.startsWith('.')) {
            return nome.endsWith(v);
        }

        return v.endsWith('/*') ? tipo.startsWith(v.slice(0, -1)) : tipo === v;
    });
}

/**
 * Come i tipi ammessi si leggono nell'errore: le estensioni in maiuscolo (`.csv` → CSV), un tipo MIME corto per la sua ultima parte
 * (`application/pdf` → PDF), gli altri come sono scritti (`image/*`, i nomi lunghi dei formati di Office).
 */
const tipiDaLeggere = (accept: string[]) =>
    [
        ...new Set(
            accept.map((voce) => {
                const v = voce.trim();
                const ultima = v.split('/').pop() ?? v;

                return v.startsWith('.') ? v.slice(1).toUpperCase() : /^[a-z0-9]{1,5}$/i.test(ultima) ? ultima.toUpperCase() : v;
            }),
        ),
    ].join(', ');

/** Il campo del form tiene il file scelto, o nessuno: anche quello trascinato, o quello che il modulo passa con `value`. */
function nelCampo(campo: HTMLInputElement | null, scelto: File | null): void {
    if (!campo || campo.files?.[0] === scelto || (!scelto && !campo.files?.length)) {
        return;
    }
    if (!scelto) {
        campo.value = '';

        return;
    }
    try {
        const dati = new DataTransfer();
        dati.items.add(scelto);
        campo.files = dati.files;
    } catch {
        // Un browser che non lo permette: il file arriva comunque a `onChange`, e il campo si vuota per non mandarne un altro.
        campo.value = '';
    }
}

/** Un trascinamento che porta dei file (non un testo o un collegamento). */
const portaFile = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

/** La zona: bordo tratteggiato, coi token; trascinando un file sopra porta l'anello di fuoco del design system. */
const stileDellaZona = (sopra: boolean, sbagliato: boolean): CSSProperties => ({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 'var(--space-3)',
    minHeight: '44px',
    padding: 'var(--space-3)',
    boxSizing: 'border-box',
    borderWidth: 'var(--border-strong)',
    borderStyle: 'dashed',
    borderColor: sbagliato ? 'var(--danger)' : 'var(--line-strong)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--surface-raised)',
    // L'anello di fuoco del design system (`outline: 2px solid var(--focus)`), scritto per parti: così lo legge anche il DOM finto dei test.
    outlineWidth: sopra ? '2px' : undefined,
    outlineStyle: sopra ? 'solid' : undefined,
    outlineColor: sopra ? 'var(--focus)' : undefined,
    outlineOffset: sopra ? '2px' : undefined,
});

/**
 * Il campo file: «Scegli un file» (il `Button` del design system) apre la scelta del sistema, e un file si può anche trascinare
 * sulla zona. Il file scelto si vede col nome, la dimensione e «Togli»; un file che non va bene non si sceglie e l'errore dice
 * perché. Scelta, «Togli» ed errori si annunciano in una regione `aria-live` che c'è da subito.
 */
export function CampoFile({ label, value, onChange, accept, maxSize, hint, error, name, required, disabled, labels }: CampoFileProps) {
    const id = useId();
    const lingua = useSyncExternalStore(nessunAscolto, linguaDellaPagina, linguaSulServer);
    // I testi di `labels` vincono chiave per chiave; una chiave vuota o assente lascia quello della lingua.
    const t: EtichetteDelCampoFile = {
        ...(fileDelleLingue(file).perCodice.get(lingua) ?? inglese),
        ...Object.fromEntries(Object.entries(labels ?? {}).filter(([, testo]) => typeof testo === 'string' && testo.trim() !== '')),
    };
    const [mio, mettiMio] = useState<File | null>(null);
    const scelto = value === undefined ? mio : value;
    const [sbaglio, mettiSbaglio] = useState<string>();
    const [annuncio, mettiAnnuncio] = useState({ n: 0, testo: '' });
    const [sopra, mettiSopra] = useState(0);
    const campo = useRef<HTMLInputElement>(null);
    const zona = useRef<HTMLDivElement>(null);
    const mostrato = error || sbaglio;

    // Il campo del form segue il file scelto: dopo un clic, un rilascio, «Togli», o un `value` che il modulo cambia.
    useEffect(() => nelCampo(campo.current, scelto), [scelto]);

    const annuncia = (testo: string) => mettiAnnuncio(({ n }) => ({ n: n + 1, testo }));

    // L'errore di chi lo usa si annuncia quando arriva, come quelli del campo.
    useEffect(() => {
        if (error) {
            annuncia(error);
        }
    }, [error]);

    const prendi = (arrivati: ArrayLike<File> | null | undefined) => {
        const elenco = Array.from(arrivati ?? []);
        if (elenco.length === 0) {
            return;
        }
        const primo = elenco[0]!;
        const motivo =
            elenco.length > 1
                ? t.onlyOne
                : accept?.length && !ammesso(primo, accept)
                  ? sostituisci(t.wrongType, { name: primo.name, types: tipiDaLeggere(accept) })
                  : maxSize !== undefined && primo.size > maxSize
                    ? sostituisci(t.tooBig, { name: primo.name, size: dimensione(maxSize, lingua) })
                    : undefined;
        if (motivo) {
            mettiSbaglio(motivo);
            annuncia(motivo);
            // Il file rifiutato non resta nel campo del form: torna quello scelto prima, o nessuno.
            nelCampo(campo.current, scelto);

            return;
        }
        mettiSbaglio(undefined);
        mettiMio(primo);
        annuncia(sostituisci(t.chosen, { name: primo.name }));
        nelCampo(campo.current, primo);
        onChange?.(primo);
    };

    const togli = () => {
        // Il campo si vuota subito: così lo stesso file, scelto di nuovo, manda ancora `change`.
        nelCampo(campo.current, null);
        mettiMio(null);
        mettiSbaglio(undefined);
        annuncia(t.removed);
        // Il fuoco torna su «Scegli un file», il primo pulsante della zona: «Togli» sparisce.
        zona.current?.querySelector<HTMLButtonElement>('button')?.focus();
        onChange?.(null);
    };

    // Il trascinamento: `dragenter` e `dragleave` arrivano anche dagli elementi dentro la zona, e si contano; l'anello si spegne
    // quando il conto torna a zero, o al rilascio.
    // Solo un trascinamento di file accende l'anello: un testo o un collegamento no.
    const entra = (e: DragEvent) => {
        e.preventDefault();
        if (!disabled && portaFile(e)) {
            mettiSopra((n) => n + 1);
        }
    };
    const esce = (e: DragEvent) => {
        if (portaFile(e)) {
            mettiSopra((n) => Math.max(0, n - 1));
        }
    };
    const passa = (e: DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = disabled || !portaFile(e) ? 'none' : 'copy';
    };
    const rilascia = (e: DragEvent) => {
        e.preventDefault();
        mettiSopra(0);
        if (disabled) {
            return;
        }
        prendi(e.dataTransfer.files);
    };

    const idEtichetta = `${id}-l`;
    const idMessaggio = mostrato || hint ? `${id}-m` : undefined;

    return (
        <div className={['zr-field', mostrato ? 'is-error' : ''].filter(Boolean).join(' ')} role="group" aria-labelledby={idEtichetta}>
            <span id={idEtichetta} className="zr-field-label">
                {label}
                {required ? (
                    <>
                        <span className="zr-req" aria-hidden>
                            {' *'}
                        </span>
                        {/* L'asterisco non si legge: chi usa un lettore di schermo sente «obbligatorio» nel nome del gruppo. */}
                        <span className="zr-visually-hidden">{` ${t.required}`}</span>
                    </>
                ) : null}
            </span>
            <div
                data-zona-file=""
                ref={zona}
                style={stileDellaZona(sopra > 0, Boolean(mostrato))}
                onDragEnter={entra}
                onDragLeave={esce}
                onDragOver={passa}
                onDrop={rilascia}
            >
                <input
                    ref={campo}
                    id={`${id}-f`}
                    type="file"
                    className="zr-visually-hidden"
                    tabIndex={-1}
                    aria-hidden
                    name={name}
                    required={required}
                    // Un form inviato senza il file: il browser non porta il fuoco sul campo nascosto; lo dice il campo, e il fuoco va su
                    // «Scegli un file».
                    onInvalid={(e) => {
                        e.preventDefault();
                        mettiSbaglio(t.missing);
                        annuncia(t.missing);
                        zona.current?.querySelector<HTMLButtonElement>('button')?.focus();
                    }}
                    disabled={disabled}
                    accept={accept?.join(',')}
                    onChange={(e) => prendi(e.currentTarget.files)}
                />
                <Button
                    type="button"
                    variant="secondary"
                    icon="upload"
                    disabled={disabled}
                    aria-invalid={mostrato ? true : undefined}
                    aria-describedby={idMessaggio}
                    onClick={() => campo.current?.click()}
                >
                    {t.choose}
                </Button>
                {scelto ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
                        <Icon name="file" size={16} />
                        <span style={{ overflowWrap: 'anywhere' }}>{scelto.name}</span>
                        <span style={{ color: 'var(--ink-muted)' }}>{dimensione(scelto.size, lingua)}</span>
                        <Button
                            data-togli-file=""
                            type="button"
                            variant="ghost"
                            size="sm"
                            icon="close"
                            disabled={disabled}
                            aria-label={sostituisci(t.removeFile, { name: scelto.name })}
                            onClick={togli}
                        >
                            {t.remove}
                        </Button>
                    </span>
                ) : (
                    <span style={{ color: 'var(--ink-muted)' }}>{t.drop}</span>
                )}
            </div>
            {mostrato ? (
                <p id={idMessaggio} className="zr-field-msg is-error">
                    <Icon name="alert" size={14} />
                    {mostrato}
                </p>
            ) : hint ? (
                <p id={idMessaggio} className="zr-field-msg">
                    {hint}
                </p>
            ) : null}
            <span className="zr-visually-hidden" aria-live="polite">
                {annuncio.testo ? <span key={annuncio.n}>{annuncio.testo}</span> : null}
            </span>
        </div>
    );
}
