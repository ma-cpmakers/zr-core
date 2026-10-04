# zr-core

La cornice comune dei frontend di Zeiras: `AppShell` con il menu Prodotti, il selettore «Azienda › workspace», la
ricerca, le notifiche e il menu del profilo; il registro dei prodotti (nome, icona, tono, indirizzo, stato); il design
system di Zeiras nella build, una copia sola per app. È ciò che `zr-auth` è per l'ingresso, ma per ciò che si vede: i
frontend `zr-*` lo installano e non ricostruiscono la cornice nel proprio codice.

Niente sito, niente database: è un pacchetto Composer (`zeiras/zr-core`) con componenti React, e si installa dentro
ogni frontend, a una versione con tag.

**Repo pubblico di proposito**: i frontend lo installano senza credenziali. Quindi qui dentro **nessun segreto, mai**, e
nessun indirizzo interno — niente `.env`, niente chiavi, niente nomi di server. I segreti li ferma la CI
(`.github/nessun-segreto.sh`, lo stesso controllo di `zr-auth`); il resto è una regola di chi scrive.

Lo scrive l'agente `zr-core`. Il design system di Zeiras è la fonte: la cornice qui dentro ne è una copia derivata, e
non si modifica a mano.
