<?php

namespace Zeiras\Core\Http;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Zeiras\Auth\Api;
use Zeiras\Auth\Errori\BackofficeNonRisponde;
use Zeiras\Auth\Errori\ErroreApi;
use Zeiras\Auth\Sessione;
use Zeiras\Core\Accettazione;

/**
 * La ricerca della cornice (Ctrl/Cmd+K), per il browser: la parte server la gira a ricerca.crea (POST /v1/ricerca) col gettone
 * del workspace in cui la persona è entrata, e alla cornice dà di ogni risultato tipo, id, titolo e contesto, coi tipi e
 * nell'ordine del backoffice, la prima pagina. Di che prodotto è un risultato il contratto non lo dice: lo trova la cornice,
 * dal tipo, nel registro. Dal registro dei moduli la parte server prende solo quali chiavi di `contesto` passano, tipo per
 * tipo. Un backoffice che non risponde è BackofficeNonRisponde, cioè un errore, mai un elenco vuoto. Coi
 * risultati la risposta dice di quale workspace sono (`workspace`): la sessione ha un workspace solo, e una pagina rimasta su
 * un altro (un'altra scheda) sa così dove si apre ciò che ha trovato. Se la persona non ha ancora accettato i documenti legali
 * in vigore il backoffice risponde 403 `accettazione_richiesta`, e la rotta lo stesso, col solo codice (Accettazione); se il
 * backoffice frena le ricerche della persona risponde 429 `troppe_richieste`, e la rotta lo stesso, col solo codice e i
 * secondi di `Retry-After`.
 */
final class RicercaDellaCornice
{
    /** Il codice del freno di ricerca.crea: nel problema di /v1 e nella risposta della rotta. */
    private const TROPPE_RICHIESTE = 'troppe_richieste';

    /**
     * Le voci del registro dei moduli, lette una volta per processo da quello del pacchetto
     * (resources/registro/prodotti.json), sempre: nessun metodo e nessuna configurazione sceglie un altro file. Un test
     * che vuole un registro di prova scrive questa proprietà con la reflection.
     *
     * @var list<array<string, mixed>>|null
     */
    private static ?array $registro = null;

    /**
     * POST /cornice/ricerca con `{q}`: `q` da 2 a 100 caratteri, come vuole ricerca.crea, senza gli spazi ai bordi (anche in
     * un frontend senza TrimStrings); altrimenti 422 e il backoffice non si chiama. La parola si legge solo dal corpo JSON: ciò
     * che una persona cerca non deve stare nell'indirizzo di una richiesta, e un `q` dell'indirizzo non conta. Anche al
     * backoffice va nel corpo, da sola (`{q}`): l'indirizzo di quella richiesta non porta query, e niente di ciò che il browser
     * manda accanto a `q` la segue. `workspace` è lo slug del workspace della sessione, quello col cui gettone la ricerca è
     * fatta, preso prima di chiamare il backoffice: viene dalla sessione, mai dalla richiesta.
     */
    public function cerca(Request $richiesta): JsonResponse
    {
        $q = $richiesta->json('q');
        $q = is_string($q) ? Str::trim($q) : $q;

        if (! is_string($q) || mb_strlen($q) < 2 || mb_strlen($q) > 100) {
            return new JsonResponse(['errore' => 'dati_non_validi'], 422);
        }

        $workspace = Sessione::workspace()['slug'] ?? null;

        try {
            $risultati = Api::workspace()->post('/v1/ricerca', ['q' => $q])['data'] ?? null;
        } catch (ErroreApi $errore) {
            return self::frenata($errore) ?? Accettazione::rispostaA($errore);
        }

        if (! is_array($risultati) || ! array_is_list($risultati)) {
            throw new BackofficeNonRisponde('La risposta di POST /v1/ricerca non è una lista di /v1.');
        }

        return new JsonResponse(['data' => array_map(self::perLaCornice(...), $risultati), 'workspace' => $workspace]);
    }

    /**
     * Il freno di ricerca.crea, che conta le ricerche di una persona: 429 `troppe_richieste`, riconosciuto dallo stato e dal
     * codice insieme. Al browser va un 429 col solo codice, nella forma degli errori delle rotte, e `Retry-After` coi secondi
     * che il backoffice ha detto, se li ha detti: il titolo e il dettaglio restano nella parte server. Null se l'errore è un
     * altro.
     */
    private static function frenata(ErroreApi $errore): ?JsonResponse
    {
        if ($errore->stato !== 429 || $errore->codice !== self::TROPPE_RICHIESTE) {
            return null;
        }

        return new JsonResponse(['errore' => self::TROPPE_RICHIESTE], 429, $errore->riprovaFra === null ? [] : ['Retry-After' => (string) $errore->riprovaFra]);
    }

    /**
     * Ciò che la cornice usa di un risultato di /v1: il tipo della risorsa, il suo id e il suo nome, tutti di testo, e il suo
     * contesto. Una risposta senza uno dei primi tre non è un risultato, ed è un guasto: mai un elenco più corto, mai un
     * risultato a metà. Un tipo che zr-core non conosce passa, senza contesto: non mostrarlo è della cornice, che ha il
     * registro. Il resto di ciò che il backoffice dà di un risultato, il suo indirizzo in /v1 compreso, resta nella parte
     * server.
     *
     * @return array{tipo: string, id: string, titolo: string, contesto: array<string, string>|null}
     */
    private static function perLaCornice(mixed $risultato): array
    {
        if (! is_array($risultato) || ! is_string($risultato['tipo'] ?? null) || ! is_string($risultato['id'] ?? null)
            || ! is_string($risultato['titolo'] ?? null)) {
            throw new BackofficeNonRisponde('La risposta di POST /v1/ricerca non è un risultato di /v1.');
        }

        return ['tipo' => $risultato['tipo'], 'id' => $risultato['id'], 'titolo' => $risultato['titolo'], 'contesto' => self::contesto($risultato['tipo'], $risultato['contesto'] ?? null)];
    }

    /**
     * Il contesto di un risultato, per riconoscerlo: di ciò che il backoffice ha dato, le sole chiavi che il registro dei
     * moduli dà al tipo del risultato (`board` e `lista` di una scheda, `organizzazione` e `ruolo` di un contatto, `pipeline`
     * e `fase` di un'opportunità), coi soli valori di testo non vuoti e nell'ordine del backoffice; oppure null se non ne
     * resta nessuno. È una lista chiusa: al browser passa solo ciò che la cornice mostra, e una chiave che il backoffice
     * aggiungesse domani non esce da sola, entra dal registro. Per questo un tipo a cui il registro non dà chiavi, o che il
     * registro non ha, ha sempre null. Un contesto che manca, o che non è un oggetto, non è un guasto: è un aiuto, e senza la
     * cornice mostra il titolo. Il confronto delle chiavi è esatto: in PHP la chiave numerica di un oggetto JSON è un numero, e
     * non è nessuna di quelle del registro.
     *
     * @return array<string, string>|null
     */
    private static function contesto(string $tipo, mixed $contesto): ?array
    {
        $chiavi = self::chiaviDelContesto($tipo);
        $testi = [];

        foreach (is_array($contesto) ? $contesto : [] as $chiave => $valore) {
            if (in_array($chiave, $chiavi, true) && is_string($valore) && $valore !== '') {
                $testi[$chiave] = $valore;
            }
        }

        return $testi === [] ? null : $testi;
    }

    /**
     * Le chiavi di `contesto` che il registro dei moduli del pacchetto (resources/registro/prodotti.json) dà a un tipo di
     * risultato, in `risorse[].contesto`: lo stesso file da cui il browser compone la seconda riga del risultato, così ciò che
     * esce da qui è ciò che il browser mostra. Il tipo si cerca intero, fra le risorse di ogni voce. Nessuna chiave per un tipo
     * che lì non ne ha, o che il registro non ha.
     *
     * @return list<string>
     */
    private static function chiaviDelContesto(string $tipo): array
    {
        self::$registro ??= json_decode((string) file_get_contents(__DIR__.'/../../resources/registro/prodotti.json'), true, flags: JSON_THROW_ON_ERROR)['prodotti'];

        foreach (self::$registro as $voce) {
            foreach ($voce['risorse'] ?? [] as $risorsa) {
                if ($risorsa['tipo'] === $tipo) {
                    return $risorsa['contesto'] ?? [];
                }
            }
        }

        return [];
    }
}
