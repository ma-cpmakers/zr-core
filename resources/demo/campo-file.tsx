// campo-file.html: il campo file con la zona di rilascio (dalla `v5.1.0`, voce #3813), preso dall'ingresso per le app, come lo
// usa Finanze per «Carica estratto» (#3803): CSV o PDF, al più 1 MB. Con `?lingua=es` o `?lingua=en` la pagina è in quella
// lingua. Ciò che il campo dà al modulo la pagina lo scrive sotto, e in console («UAT file»): la UAT (righe CF) lo legge.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CampoFile } from '../js/app';
import { PageHeader } from '../js/zeiras/componenti';
import '../css/zeiras.css';
import '../css/zeiras-token.css';

const scelti = new URLSearchParams(window.location.search);
document.documentElement.lang = scelti.get('lingua') ?? 'it';

function Pagina() {
    const [file, mettiFile] = useState<File | null>(null);

    return (
        <main style={{ maxWidth: '560px', margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
            <PageHeader title="UAT Carica estratto" />
            <form onSubmit={(e) => e.preventDefault()}>
                <CampoFile
                    label="UAT Estratto conto"
                    name="estratto"
                    accept={['.csv', '.pdf']}
                    maxSize={1_000_000}
                    hint="UAT CSV o PDF, al più 1 MB"
                    onChange={(scelto) => {
                        mettiFile(scelto);
                        console.log('UAT file', scelto ? `${scelto.name} ${scelto.size}` : 'nessuno');
                    }}
                />
            </form>
            <p data-uat-file="">{file ? `${file.name} ${file.size}` : 'nessuno'}</p>
        </main>
    );
}

createRoot(document.getElementById('pagina')!).render(<Pagina />);
