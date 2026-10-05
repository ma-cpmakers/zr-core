# Allineamento al design system di Zeiras

Originale: https://claude.ai/artifact/66qq9W68zshzZfgSZ79eZS
Versione: 1791186379-ba0d · letta il 2026-10-05 09:25 UTC

| File dell'originale | sha256 | Dove lo usa il modulo |
|---|---|---|
| project/components/bundle.js | dcef971399ebae1c30646a8f5788ce25cea9bdbc3090d19166f47f72434c567a | copia derivata resources/zeiras/bundle.js: i componenti in `window.Zeiras`, caricati dall'ingresso JS del pacchetto dopo `window.React` |
| project/components/bundle.css | bc6b911c0fd3dc90469b7dbf98c0822058a6d8d6239bb458ba2e44f59ba90834 | copia derivata resources/zeiras/bundle.css: gli stili dei componenti e i font da Google Fonts |
| project/components/index.d.ts | eb37cc5693ce70cf1ad195fdf3ed894376d9ca5eec3c9fbd1819d4752f206774 | copia derivata resources/zeiras/index.d.ts: nomi e props dei componenti, e `window.Zeiras` |
| project/tokens.json | 40fcba1243bb81ddda47b6137e4cac9ef3b85fd6aca0eec6b7bc216e8dcbc71e | copia derivata resources/zeiras/tokens.json: le variabili CSS dei token, tema chiaro |
| project/README.md | c73f7d8542035b62df2d13a7bd2c511f2f94fd497adb92b8ee4086faeafe40b7 | principi; «Voce e contenuti» nei testi delle lingue della cornice; «Iconografia» nelle icone del registro dei prodotti |
| project/guidelines/15-processo-di-navigazione.md | 35e527ff034bb5cde0077db4d1e60a220da2509cc02d53afdf51bfd3917cfe52 | la mappa degli indirizzi nel registro dei prodotti; «Chi fa cosa» nel componente della cornice |
| project/guidelines/10-struttura-portale.md | 3a1bacd892daec74939ab6d99aba19273116a8c82e8a8dfb6c84f89527981ecf | l'ordine dei prodotti nel registro; le rotte di app.zeiras.com nel componente della cornice |
| project/components/AppShell/README.md | bc2b7a07087428994740f3c66d9ad950a49ade8e260377587a67bbd888f734fa | props e comportamento dell'`AppShell` che il componente della cornice rende |
| project/components/AppShell/preview.html | 72e46e32b9a553d5811f74bf50e4dd3d12a1621776d5e03eca833a3aaed584c3 | icone e «Presto» dei prodotti nel registro; la pagina di prova della cornice |
| project/assets/Icons/README.md | c3970f91c2dc320d9060328605132946c27425ba6a3ba8cf6524c66a22601fd6 | solo icone del set di Zeiras nel registro dei prodotti |

Le copie derivate non si cambiano a mano: a ogni riallineamento si sostituiscono intere, e `DesignSystemTest` confronta il loro
sha256 con questa tabella. Per sapere come si fa una cosa si legge l'originale, alla versione pubblicata, non le copie.
