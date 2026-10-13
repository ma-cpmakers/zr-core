<?php

use Illuminate\Foundation\Http\Middleware\TrimStrings;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Illuminate\Testing\TestResponse;
use Zeiras\Auth\Sessione;
use Zeiras\Auth\Testing\Gettone;
use Zeiras\Auth\Testing\Rotte;
use Zeiras\Core\Http\RicercaDellaCornice;

// Sprint 3 · T5 (voce #1277), la parte server. La rotta della ricerca della cornice nel gruppo `web` del frontend: la parte
// server la gira a ricerca.elenca col gettone del workspace, che resta nella sessione. Il
// backoffice è Http::fake, mai il finto di zr-auth: non conosce la ricerca. Nessuna richiesta esce (TestCase).
// Sprint 5 · T4 (voce #1257): la ricerca sul contratto di ricerca.elenca. Un risultato è `{tipo, id, titolo}`, senza `app`: di
// che prodotto è lo dice il registro, nel browser. Una risposta che non ha quella forma è un guasto, mai un elenco più corto.
// Sprint 18 · T1 (voce #1638): la rotta è POST /cornice/ricerca, e la parola cercata sta nel corpo JSON (`{q}`), mai
// nell'indirizzo; una GET, quella delle versioni fino alla `v1.7.0`, non ha più una rotta. Dalla parte server al backoffice
// restava la GET di ricerca.elenca: era un altro tratto (#1639).
// Sprint 22 · T6 (voce #1726): la risposta dice anche di quale workspace sono i risultati (`workspace`), ed è lì che la cornice li
// apre: lo slug è quello della sessione, col cui gettone la ricerca è fatta, mai uno che arriva dal browser.
// Sprint 25 · T3 (voce #1639): anche dalla parte server al backoffice la parola sta nel corpo. La parte server chiama
// ricerca.crea (POST /v1/ricerca, corpo `{q}` e nient'altro, indirizzo senza query); di ogni risultato dà anche `contesto`
// (null, o i soli testi non vuoti che il backoffice ha dato) e mai `indirizzo`; davanti al 429 `troppe_richieste` risponde
// 429 col solo codice e i secondi di `Retry-After`.
// Sprint 25 · T6 (lettura della PR #56, R1): di `contesto` passano le sole chiavi che il registro dei moduli dà al tipo del
// risultato (`risorse[].contesto`), una lista chiusa: una chiave che il backoffice aggiungesse domani non arriva al browser da
// sola, entra dal registro. Il registro è quello del pacchetto, letto una volta per processo come fa l'elenco delle notifiche.

/** Il workspace in cui entra la sessione dei test. */
const WORKSPACE_DELLA_RICERCA = ['id' => 'uat-ws', 'nome' => 'UAT Marketing', 'slug' => 'uat-marketing'];

/** Gli id dell'esempio del contratto, nell'ordine del backoffice. */
const ID_DELL_ESEMPIO_DI_RICERCA = ['01k6w4c7e9g1j3m5p7r9t1v3x5', '01k6wd5b3d5f7h9k1n3q5s7u9w', '01k6w2c4e6g8j0m2p4r6t8v0x2'];

/**
 * La risposta di ricerca.crea nell'esempio del contratto di /v1: una scheda, un contatto e una cartella, nell'ordine del
 * backoffice (prima le fonti nuove, poi board e cartelle), ultima pagina. Ogni voce porta `contesto` (i testi per
 * riconoscerla, o null) e `indirizzo`.
 *
 * @return array{data: list<array{tipo: string, id: string, titolo: string, contesto: array<string, string>|null, indirizzo: string}>, successivo: null}
 */
function esempioDelContratto(): array
{
    return ['data' => [
        ['tipo' => 'board.scheda', 'id' => '01k6w4c7e9g1j3m5p7r9t1v3x5', 'titolo' => 'Piano editoriale ottobre', 'contesto' => ['board' => 'Marketing', 'lista' => 'In corso'], 'indirizzo' => '/v1/board/schede/01k6w4c7e9g1j3m5p7r9t1v3x5'],
        ['tipo' => 'crm.persona', 'id' => '01k6wd5b3d5f7h9k1n3q5s7u9w', 'titolo' => 'Paolo Verdi', 'contesto' => ['organizzazione' => 'Verdi Impianti', 'ruolo' => 'Direttore'], 'indirizzo' => '/v1/crm/persone/01k6wd5b3d5f7h9k1n3q5s7u9w'],
        ['tipo' => 'board.cartelle', 'id' => '01k6w2c4e6g8j0m2p4r6t8v0x2', 'titolo' => 'Marketing', 'contesto' => null, 'indirizzo' => '/v1/board/cartelle/01k6w2c4e6g8j0m2p4r6t8v0x2'],
    ], 'successivo' => null];
}

/**
 * Un risultato come lo dà ricerca.crea: il tipo della risorsa, il suo id, il suo nome, il contesto (i testi per riconoscerla, o
 * null) e l'indirizzo, che qui è un segno: dalla parte server della cornice non deve uscire.
 *
 * @param  array<string, mixed>|null  $contesto
 * @return array{tipo: string, id: string, titolo: string, contesto: array<string, mixed>|null, indirizzo: string}
 */
function risultatoDelBackoffice(string $tipo, string $id, string $titolo, ?array $contesto = null): array
{
    return ['tipo' => $tipo, 'id' => $id, 'titolo' => $titolo, 'contesto' => $contesto, 'indirizzo' => '/v1/segno-dell-indirizzo/'.$id];
}

/**
 * Le richieste partite verso il backoffice, una riga l'una: metodo, percorso, query (null: l'indirizzo non ne ha) e corpo
 * JSON. `Http::assertSent` dice solo sì o no: così un rosso mostra che cosa è partito.
 *
 * @return list<array{string, mixed, mixed, mixed}>
 */
function richiesteAlBackoffice(): array
{
    return Http::recorded()->map(fn (array $coppia) => [
        $coppia[0]->method(),
        parse_url($coppia[0]->url(), PHP_URL_PATH),
        parse_url($coppia[0]->url(), PHP_URL_QUERY),
        json_decode($coppia[0]->body(), true),
    ])->values()->all();
}

/**
 * Il 429 `troppe_richieste` di ricerca.crea (il freno per persona), coi secondi di `Retry-After` se `$riprovaFra` non è null. Un
 * problem details (RFC 9457): titolo, dettaglio e l'intestazione in più sono segni, testi che dalla parte server della cornice
 * non devono uscire. Con un altro stato, o con un altro codice (null: senza codice), è una risposta che gli somiglia e non lo è.
 */
function troppeRichieste(?string $riprovaFra, int $stato = 429, ?string $codice = 'troppe_richieste'): mixed
{
    $problema = ['type' => 'about:blank', 'title' => 'segno-del-titolo', 'status' => $stato, 'detail' => 'segno-del-dettaglio']
        + ($codice === null ? [] : ['codice' => $codice]);

    return Http::response((string) json_encode($problema), $stato, ['Content-Type' => 'application/problem+json', 'X-Segno' => 'segno-dell-intestazione']
        + ($riprovaFra === null ? [] : ['Retry-After' => $riprovaFra]));
}

/** La ricerca della cornice, con `q` nel corpo JSON; ogni sua risposta è senza gettone. */
function cerca(string $q): TestResponse
{
    $risposta = test()->postJson('cornice/ricerca', ['q' => $q]);
    Gettone::assenteDa($risposta);

    return $risposta;
}

it('POST /cornice/ricerca cerca nel workspace del gettone con una sola richiesta, ricerca.crea: una POST a /v1/ricerca col termine nel corpo JSON e nient\'altro, e l\'indirizzo senza query; dà tipo, id, titolo e contesto dei risultati, nell\'ordine del backoffice (sprint 5 · T4.1; sprint 25 · T3.1, T3.2)', function () {
    $gettoni = sessioneAMano(WORKSPACE_DELLA_RICERCA);
    // Col gettone dell'accesso il backoffice risponderebbe 403 gettone_senza_workspace: qui dà altri risultati, per vederlo.
    Http::fake(fn (Request $richiesta) => match (parse_url($richiesta->url(), PHP_URL_PATH)) {
        '/v1/ricerca' => Http::response($richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace'])
            ? esempioDelContratto()
            : ['data' => [risultatoDelBackoffice('board.board', 'uat-di-un-altro-workspace', 'UAT Altro')], 'successivo' => null]),
    });

    // L'esempio del contratto nel suo ordine, col contesto di ogni voce: senza `indirizzo`, e `successivo` resta nella parte server.
    cerca('UAT là')->assertOk()->assertExactJson(['data' => [
        ['tipo' => 'board.scheda', 'id' => '01k6w4c7e9g1j3m5p7r9t1v3x5', 'titolo' => 'Piano editoriale ottobre', 'contesto' => ['board' => 'Marketing', 'lista' => 'In corso']],
        ['tipo' => 'crm.persona', 'id' => '01k6wd5b3d5f7h9k1n3q5s7u9w', 'titolo' => 'Paolo Verdi', 'contesto' => ['organizzazione' => 'Verdi Impianti', 'ruolo' => 'Direttore']],
        ['tipo' => 'board.cartelle', 'id' => '01k6w2c4e6g8j0m2p4r6t8v0x2', 'titolo' => 'Marketing', 'contesto' => null],
    ], 'workspace' => 'uat-marketing', 'persona' => 'uat-ada@example.com']);
    expect(richiesteAlBackoffice())->toBe([['POST', '/v1/ricerca', null, ['q' => 'UAT là']]]);
});

it('il termine va al backoffice solo nel corpo, com\'è: qualunque cosa contenga, l\'indirizzo della richiesta è /v1/ricerca e non porta query (sprint 25 · T3.1)', function (string $q) {
    sessioneAMano(WORKSPACE_DELLA_RICERCA);
    Http::fake(['*' => Http::response(['data' => [], 'successivo' => null])]);

    cerca($q)->assertOk();

    expect(richiesteAlBackoffice())->toBe([['POST', '/v1/ricerca', null, ['q' => $q]]])
        ->and(Http::recorded()->first()[0]->url())->toEndWith('/v1/ricerca');
})->with([
    'una parola' => ['uat'],
    'coi segni di una query' => ['a&b=c?d#e'],
    'come una query intera' => ['?q=uat&limite=100'],
    'con le barre e i punti di un percorso' => ['../v1/io'],
    'con un percento' => ['100% uat'],
]);

it('ciò che la risposta del backoffice ha in più non arriva al browser: l\'`indirizzo` di un risultato, un `app`, altri campi, il cursore della pagina dopo; un tipo che zr-core non conosce passa, e lo scarta la cornice; un risultato senza `contesto` lo ha null (sprint 5 · T4.1; sprint 25 · T3.2)', function () {
    sessioneAMano(WORKSPACE_DELLA_RICERCA);
    Http::fake(['*' => Http::response(['data' => [
        [...risultatoDelBackoffice('board.board', 'uat-b1', 'UAT Lancio'), 'app' => 'crm', 'soggetto' => '/v1/board/board/uat-b1', 'dentro' => null],
        risultatoDelBackoffice('uat-ignoto', 'uat-x1', 'UAT Tipo nuovo'),
        // Com'era un risultato di ricerca.elenca: senza `contesto` e senza `indirizzo`.
        ['tipo' => 'board.cartelle', 'id' => 'uat-c1', 'titolo' => 'UAT Clienti'],
    ], 'successivo' => 'uat-cursore', 'totale' => 3])]);

    $risposta = cerca('UAT')->assertOk()->assertExactJson(['data' => [
        ['tipo' => 'board.board', 'id' => 'uat-b1', 'titolo' => 'UAT Lancio', 'contesto' => null],
        ['tipo' => 'uat-ignoto', 'id' => 'uat-x1', 'titolo' => 'UAT Tipo nuovo', 'contesto' => null],
        ['tipo' => 'board.cartelle', 'id' => 'uat-c1', 'titolo' => 'UAT Clienti', 'contesto' => null],
    ], 'workspace' => 'uat-marketing', 'persona' => 'uat-ada@example.com']);

    expect($risposta->getContent())->not->toContain('indirizzo');
});

it('di ogni risultato la rotta dà `contesto`: i testi che il backoffice ha dato, con le loro chiavi e nel suo ordine, oppure null (sprint 25 · T3.2)', function () {
    sessioneAMano(WORKSPACE_DELLA_RICERCA);
    Http::fake(['*' => Http::response(['data' => [
        risultatoDelBackoffice('board.scheda', 'uat-s1', 'UAT Scheda', ['lista' => 'Da fare', 'board' => 'UAT Sito']),
        // Sprint 28 · T1.3: di un'opportunità esce anche `esito`, com'è arrivato — anche `aperta`: non mostrarlo è della cornice.
        risultatoDelBackoffice('crm.trattativa', 'uat-t1', 'UAT Opportunità', ['pipeline' => 'UAT Vendite', 'fase' => 'Proposta', 'esito' => 'aperta']),
        risultatoDelBackoffice('crm.organizzazione', 'uat-o1', 'UAT Azienda'),
    ], 'successivo' => null])]);

    $risposta = cerca('UAT')->assertOk()->assertExactJson(['data' => [
        ['tipo' => 'board.scheda', 'id' => 'uat-s1', 'titolo' => 'UAT Scheda', 'contesto' => ['lista' => 'Da fare', 'board' => 'UAT Sito']],
        ['tipo' => 'crm.trattativa', 'id' => 'uat-t1', 'titolo' => 'UAT Opportunità', 'contesto' => ['pipeline' => 'UAT Vendite', 'fase' => 'Proposta', 'esito' => 'aperta']],
        ['tipo' => 'crm.organizzazione', 'id' => 'uat-o1', 'titolo' => 'UAT Azienda', 'contesto' => null],
    ], 'workspace' => 'uat-marketing', 'persona' => 'uat-ada@example.com']);

    // Un oggetto, con le chiavi nell'ordine del backoffice (qui `lista` prima di `board`): l'ordine in cui mostrarle è della cornice.
    expect($risposta->getContent())->toContain('"contesto":{"lista":"Da fare","board":"UAT Sito"}')
        ->toContain('"contesto":{"pipeline":"UAT Vendite","fase":"Proposta","esito":"aperta"}');
});

it('di `contesto` passano solo le chiavi che il registro dà al tipo del risultato, e solo coi valori di testo non vuoti: un null, un testo vuoto, un numero, un vero, un oggetto e una lista non passano, una chiave che il registro non dà a quel tipo nemmeno, e un contesto che così resta senza valori, o che non è un oggetto, è null (sprint 25 · T3.2; T6, R1)', function (mixed $delBackoffice, ?array $perLaCornice) {
    sessioneAMano(WORKSPACE_DELLA_RICERCA);
    Http::fake(['*' => Http::response(['data' => [
        ['tipo' => 'crm.persona', 'id' => 'uat-p1', 'titolo' => 'UAT Persona', 'contesto' => $delBackoffice, 'indirizzo' => '/v1/crm/persone/uat-p1'],
    ], 'successivo' => null])]);

    cerca('UAT')->assertOk()->assertExactJson(['data' => [
        ['tipo' => 'crm.persona', 'id' => 'uat-p1', 'titolo' => 'UAT Persona', 'contesto' => $perLaCornice],
    ], 'workspace' => 'uat-marketing', 'persona' => 'uat-ada@example.com']);
})->with([
    'un null accanto a un testo' => [['organizzazione' => null, 'ruolo' => 'Direttore'], ['ruolo' => 'Direttore']],
    'un testo vuoto accanto a un testo' => [['organizzazione' => 'UAT Impianti', 'ruolo' => ''], ['organizzazione' => 'UAT Impianti']],
    'un numero accanto a un testo' => [['organizzazione' => 'UAT Impianti', 'ruolo' => 12], ['organizzazione' => 'UAT Impianti']],
    'un vero accanto a un testo' => [['organizzazione' => true, 'ruolo' => 'Direttore'], ['ruolo' => 'Direttore']],
    'un oggetto accanto a un testo' => [['organizzazione' => ['nome' => 'UAT Impianti'], 'ruolo' => 'Direttore'], ['ruolo' => 'Direttore']],
    'una lista accanto a un testo' => [['organizzazione' => ['UAT Impianti'], 'ruolo' => 'Direttore'], ['ruolo' => 'Direttore']],
    // In PHP la chiave numerica di un oggetto JSON è un numero: da sola farebbe della risposta una lista, e non passa.
    'una chiave numerica accanto a una di testo' => [[7 => 'UAT Impianti', 'ruolo' => 'Direttore'], ['ruolo' => 'Direttore']],
    // Lettura della PR #56, R1: una lista chiusa. Il registro dà a un contatto `organizzazione` e `ruolo`, e nient'altro.
    'una chiave che il registro non dà al tipo, accanto a una che dà' => [['reparto' => 'UAT Acquisti', 'ruolo' => 'Direttore'], ['ruolo' => 'Direttore']],
    'una chiave che il registro non dà al tipo, prima e dopo le sue' => [['reparto' => 'UAT Acquisti', 'organizzazione' => 'UAT Impianti', 'sede' => 'UAT Milano', 'ruolo' => 'Direttore', 'indirizzo' => '/v1/crm/persone/uat-p1'], ['organizzazione' => 'UAT Impianti', 'ruolo' => 'Direttore']],
    'solo chiavi che il registro non dà al tipo' => [['reparto' => 'UAT Acquisti', 'sede' => 'UAT Milano'], null],
    'le chiavi di un altro tipo, quelle di una scheda' => [['board' => 'UAT Sito', 'lista' => 'Da fare'], null],
    'una chiave del tipo scritta con la maiuscola' => [['Ruolo' => 'Direttore', 'organizzazione' => 'UAT Impianti'], ['organizzazione' => 'UAT Impianti']],
    'tutti null' => [['organizzazione' => null, 'ruolo' => null], null],
    'tutti vuoti' => [['organizzazione' => '', 'ruolo' => ''], null],
    'solo chiavi numeriche' => [[3 => 'UAT Impianti', 7 => 'Direttore'], null],
    'un oggetto vuoto' => [new stdClass, null],
    'un testo' => ['UAT Impianti', null],
    'un numero' => [12, null],
    'un vero' => [true, null],
    'una lista di testi' => [['UAT Impianti', 'Direttore'], null],
]);

// Sprint 27 · T1.5 (voce #1787): ricerca.crea trova anche i colleghi del workspace, per nome. Il backoffice non mette mai l'email
// nella voce, e il registro dà al tipo la sola chiave `ruolo`: se un giorno l'email, o un'altra chiave, arrivasse nel contesto,
// si fermerebbe qui e non arriverebbe al browser.
it('un membro del workspace esce con tipo, id, titolo e il solo `ruolo` del contesto, il codice com\'è: un\'email, o un\'altra chiave che il backoffice mettesse nel contesto, non arriva al browser (sprint 27 · T1.5)', function (array $delBackoffice) {
    sessioneAMano(WORKSPACE_DELLA_RICERCA);
    // La voce dell'esempio del contratto del 12/10/2026, e ciò che il caso le aggiunge nel contesto.
    Http::fake(['*' => Http::response(['data' => [
        ['tipo' => 'workspace.membro', 'id' => '01k6w1b3d5f7h9k1n3q5s7u9wy', 'titolo' => 'Marta Bianchi', 'contesto' => $delBackoffice, 'indirizzo' => '/v1/workspace/membri/01k6w1b3d5f7h9k1n3q5s7u9wy'],
    ], 'successivo' => null])]);

    $risposta = cerca('Marta')->assertOk()->assertExactJson(['data' => [
        ['tipo' => 'workspace.membro', 'id' => '01k6w1b3d5f7h9k1n3q5s7u9wy', 'titolo' => 'Marta Bianchi', 'contesto' => ['ruolo' => 'amministratore']],
    ], 'workspace' => 'uat-marketing', 'persona' => 'uat-ada@example.com']);

    // L'email della persona della sessione c'è, in `persona` (sprint 37 · T4.3): quella del collega trovato no.
    expect($risposta->getContent())->not->toContain('uat-marta')->not->toContain('email')->not->toContain('/v1/')
        ->and(json_encode($risposta->json('data')))->not->toContain('example.com');
})->with([
    'il contesto del contratto: il solo ruolo' => [['ruolo' => 'amministratore']],
    'con l\'email dopo il ruolo' => [['ruolo' => 'amministratore', 'email' => 'uat-marta@example.com']],
    'con l\'email prima del ruolo, e una mansione' => [['email' => 'uat-marta@example.com', 'ruolo' => 'amministratore', 'mansione' => 'UAT Direttrice']],
]);

/** Un contesto con le chiavi di ogni tipo del registro, e una che il registro non ha: ciò che ne resta dice di chi sono le chiavi. */
const CONTESTO_CON_OGNI_CHIAVE = ['reparto' => 'UAT Acquisti', 'lista' => 'Da fare', 'board' => 'UAT Sito', 'ruolo' => 'Direttore', 'organizzazione' => 'UAT Impianti', 'fase' => 'Proposta', 'pipeline' => 'UAT Vendite', 'esito' => 'vinta'];

it('ogni tipo ha le sue chiavi di `contesto`, quelle che il registro gli dà: di un contesto che le porta tutte restano le sue, nell\'ordine del backoffice (sprint 25 · T6, R1)', function (string $tipo, string $resta) {
    sessioneAMano(WORKSPACE_DELLA_RICERCA);
    Http::fake(['*' => Http::response(['data' => [risultatoDelBackoffice($tipo, 'uat-x1', 'UAT Risultato', CONTESTO_CON_OGNI_CHIAVE)], 'successivo' => null])]);

    expect(cerca('UAT')->assertOk()->getContent())->toBe('{"data":[{"tipo":"'.$tipo.'","id":"uat-x1","titolo":"UAT Risultato","contesto":'.$resta.'}],"workspace":"uat-marketing","persona":"uat-ada@example.com"}');
})->with([
    'una scheda' => ['board.scheda', '{"lista":"Da fare","board":"UAT Sito"}'],
    'un contatto' => ['crm.persona', '{"ruolo":"Direttore","organizzazione":"UAT Impianti"}'],
    // Sprint 28 · T1.3: `esito` esce per la sola opportunità; una scheda o un contatto che lo portassero non lo fanno uscire.
    'un\'opportunità' => ['crm.trattativa', '{"fase":"Proposta","pipeline":"UAT Vendite","esito":"vinta"}'],
    // Sprint 27 · T1.5: a un membro del workspace il registro dà il solo `ruolo`. Il valore passa com'è: quali codici hanno un
    // testo lo sa la cornice, nel browser.
    'un membro del workspace' => ['workspace.membro', '{"ruolo":"Direttore"}'],
    // Il registro non dà chiavi a un'azienda, a una board, a una cartella: qualunque cosa il backoffice dia, null.
    'un\'azienda' => ['crm.organizzazione', 'null'],
    'una board' => ['board.board', 'null'],
    'una cartella' => ['board.cartelle', 'null'],
    // Un tipo che il registro non ha passa, e lo scarta la cornice: del suo contesto non passa niente.
    'un tipo che il registro non ha' => ['uat-ignoto', 'null'],
    'un tipo che somiglia a uno del registro' => ['board.schede', 'null'],
]);

it('le chiavi di `contesto` sono quelle del registro dei moduli, non un elenco scritto nella rotta: con un registro di prova che al contatto dà `reparto`, passa `reparto` e non `ruolo`, e una scheda, che lì non ha chiavi, ha null (sprint 25 · T6, R1)', function () {
    sessioneAMano(WORKSPACE_DELLA_RICERCA);
    Http::fake(['*' => Http::response(['data' => [
        risultatoDelBackoffice('crm.persona', 'uat-p1', 'UAT Persona', CONTESTO_CON_OGNI_CHIAVE),
        risultatoDelBackoffice('board.scheda', 'uat-s1', 'UAT Scheda', CONTESTO_CON_OGNI_CHIAVE),
    ], 'successivo' => null])]);
    // Il registro di prova entra dalla proprietà privata di `Registro`, con la reflection, come per le notifiche
    // (`registroGiaLetto()`, in `tests/Pest.php`): nel codice che va in produzione non c'è un aggancio per i test. Dopo il
    // caso lo toglie `tests/Pest.php`, e la parte server torna a leggere quello del pacchetto.
    registroGiaLetto([
        ['id' => 'crm', 'risorse' => [['tipo' => 'crm.persona', 'contesto' => ['reparto']]]],
        ['id' => 'pm', 'risorse' => [['tipo' => 'board.scheda']]],
        ['id' => 'uat-senza-risorse'],
    ]);

    cerca('UAT')->assertOk()->assertExactJson(['data' => [
        ['tipo' => 'crm.persona', 'id' => 'uat-p1', 'titolo' => 'UAT Persona', 'contesto' => ['reparto' => 'UAT Acquisti']],
        ['tipo' => 'board.scheda', 'id' => 'uat-s1', 'titolo' => 'UAT Scheda', 'contesto' => null],
    ], 'workspace' => 'uat-marketing', 'persona' => 'uat-ada@example.com']);
});

it('la parte server della ricerca non ha agganci per i test nel codice che va in produzione: di pubblico ha la sola rotta, e il file del registro non si sceglie né si legge qui: le voci le chiede a `Registro` (sprint 25 · T6, R1; sprint 26 · T3.2)', function () {
    $classe = new ReflectionClass(RicercaDellaCornice::class);
    $pubblici = array_map(fn (ReflectionMethod $metodo): string => $metodo->getName(), $classe->getMethods(ReflectionMethod::IS_PUBLIC));
    $sorgente = (string) file_get_contents((string) $classe->getFileName());

    expect($pubblici)->toBe(['cerca'])
        ->and($classe->hasProperty('fileDelRegistro'))->toBe(false)
        ->and(str_contains($sorgente, '@internal'))->toBe(false)
        // Il registro è quello del pacchetto, e lo legge `Registro`: qui non c'è una lettura di file, né una copia tenuta, e le
        // voci si chiedono a lei in un punto solo del codice (sprint 26 · T3.2).
        ->and(substr_count($sorgente, 'file_get_contents('))->toBe(0)
        ->and($classe->hasProperty('registro'))->toBe(false)
        ->and(substr_count(senzaCommenti($sorgente), 'Registro::voci()'))->toBe(1);
});

it('q di 2 e di 100 caratteri, anche non ASCII, arriva al backoffice (T5.1)', function (string $q) {
    sessioneAMano(WORKSPACE_DELLA_RICERCA);
    Http::fake(['*' => Http::response(['data' => [], 'successivo' => null])]);

    cerca($q)->assertOk()->assertExactJson(['data' => [], 'workspace' => 'uat-marketing', 'persona' => 'uat-ada@example.com']);
    Http::assertSentCount(1);
})->with([
    'due' => ['ab'],
    'cento accentate' => [str_repeat('à', 100)],
]);

it('con meno di 2 o più di 100 caratteri risponde 422 e non chiama il backoffice (T5.1)', function (?string $q) {
    sessioneAMano(WORKSPACE_DELLA_RICERCA);
    Http::fake();

    $risposta = $q === null ? test()->postJson('cornice/ricerca') : cerca($q);

    $risposta->assertStatus(422)->assertExactJson(['errore' => 'dati_non_validi']);
    Gettone::assenteDa($risposta);
    Http::assertNothingSent();
})->with([
    'senza q' => [null],
    'vuota' => [''],
    'un carattere' => ['a'],
    'un carattere fra gli spazi' => ['  a  '],
    'centouno' => [str_repeat('à', 101)],
]);

it('gli spazi ai bordi di q si tolgono prima del controllo, anche in un frontend senza TrimStrings (T5.1)', function () {
    // Senza il middleware che toglie gli spazi: la rotta non conta su quello del frontend.
    test()->withoutMiddleware(TrimStrings::class);
    sessioneAMano(WORKSPACE_DELLA_RICERCA);
    Http::fake(['*' => Http::response(['data' => [], 'successivo' => null])]);

    cerca('  a  ')->assertStatus(422)->assertExactJson(['errore' => 'dati_non_validi']);
    Http::assertNothingSent();

    cerca('  ab  ')->assertOk();
    expect(richiesteAlBackoffice())->toBe([['POST', '/v1/ricerca', null, ['q' => 'ab']]]);
});

it('senza sessione 401, con la sessione ma senza workspace 403, e il backoffice non si chiama (T5.1)', function () {
    Http::fake();

    cerca('UAT')->assertUnauthorized();

    sessioneAMano(null);

    cerca('UAT')->assertForbidden()->assertExactJson(['errore' => 'gettone_senza_workspace']);
    Http::assertNothingSent();
});

it('se il backoffice non risponde, o dà risultati che non sono di /v1, la ricerca risponde con un errore: mai un elenco vuoto, mai un risultato a metà (sprint 5 · T4.2)', function (int $stato, mixed $corpo) {
    sessioneAMano(WORKSPACE_DELLA_RICERCA);
    Http::fake(['*' => Http::response($corpo, $stato)]);

    $risposta = cerca('UAT');

    expect($risposta->status())->toBeGreaterThanOrEqual(500)->toBeLessThan(600)
        ->and($risposta->json('data'))->toBeNull();
})->with([
    '500' => [500, ''],
    '200 senza la forma di /v1' => [200, ['risultati' => []]],
    'data non è una lista' => [200, ['data' => risultatoDelBackoffice('board.board', 'uat-b1', 'UAT Lancio'), 'successivo' => null]],
    'data è un testo' => [200, ['data' => 'UAT Lancio', 'successivo' => null]],
    'un risultato che non è un oggetto' => [200, ['data' => ['uat-b1'], 'successivo' => null]],
    'un risultato che è una lista' => [200, ['data' => [['board.board', 'uat-b1', 'UAT Lancio']], 'successivo' => null]],
    'un risultato senza tipo' => [200, ['data' => [['id' => 'uat-b1', 'titolo' => 'UAT Lancio']], 'successivo' => null]],
    'un risultato senza id' => [200, ['data' => [['tipo' => 'board.board', 'titolo' => 'UAT Lancio']], 'successivo' => null]],
    'un risultato senza titolo' => [200, ['data' => [['tipo' => 'board.board', 'id' => 'uat-b1']], 'successivo' => null]],
    'un tipo che non è un testo' => [200, ['data' => [['tipo' => ['board.board'], 'id' => 'uat-b1', 'titolo' => 'UAT Lancio']], 'successivo' => null]],
    'un id che è un numero' => [200, ['data' => [['tipo' => 'board.board', 'id' => 12, 'titolo' => 'UAT Lancio']], 'successivo' => null]],
    'un titolo null' => [200, ['data' => [['tipo' => 'board.board', 'id' => 'uat-b1', 'titolo' => null]], 'successivo' => null]],
    'un risultato buono e poi uno senza titolo' => [200, ['data' => [
        risultatoDelBackoffice('board.cartelle', 'uat-c1', 'UAT Clienti'), ['tipo' => 'board.board', 'id' => 'uat-b1'],
    ], 'successivo' => null]],
    'un risultato col contesto e l\'indirizzo, e senza titolo' => [200, ['data' => [
        ['tipo' => 'board.scheda', 'id' => 'uat-s1', 'contesto' => ['board' => 'UAT Sito', 'lista' => 'Da fare'], 'indirizzo' => '/v1/board/schede/uat-s1'],
    ], 'successivo' => null]],
]);

it('la parola si legge solo dal corpo JSON: una POST che la porta altrove, o che in `q` non porta un testo, risponde 422 e non chiama il backoffice (sprint 18 · T1.2)', function (Closure $manda) {
    sessioneAMano(WORKSPACE_DELLA_RICERCA);
    // Se la parola arrivasse, il backoffice risponderebbe: la rotta darebbe 200 coi risultati.
    Http::fake(['*' => Http::response(esempioDelContratto())]);

    $risposta = $manda();

    $risposta->assertStatus(422)->assertExactJson(['errore' => 'dati_non_validi']);
    Gettone::assenteDa($risposta);
    Http::assertNothingSent();
})->with([
    'solo nell\'indirizzo, col corpo vuoto' => [fn () => test()->postJson('cornice/ricerca?q=uat')],
    'solo nell\'indirizzo, col corpo che ha altro' => [fn () => test()->postJson('cornice/ricerca?q=uat', ['parola' => 'uat'])],
    'in un corpo che non è JSON' => [fn () => test()->post('cornice/ricerca', ['q' => 'uat'], ['Accept' => 'application/json'])],
    'q è una lista' => [fn () => test()->postJson('cornice/ricerca', ['q' => ['uat']])],
    'q è un oggetto' => [fn () => test()->postJson('cornice/ricerca', ['q' => ['testo' => 'uat']])],
    'q è un numero' => [fn () => test()->postJson('cornice/ricerca', ['q' => 12])],
    'q è true' => [fn () => test()->postJson('cornice/ricerca', ['q' => true])],
]);

it('con una parola nel corpo e un\'altra nell\'indirizzo si cerca quella del corpo: l\'indirizzo non conta (sprint 18 · T1.2)', function () {
    sessioneAMano(WORKSPACE_DELLA_RICERCA);
    Http::fake(['*' => Http::response(['data' => [], 'successivo' => null])]);

    $risposta = test()->postJson('cornice/ricerca?q=uat-indirizzo', ['q' => 'uat-corpo']);

    $risposta->assertOk()->assertExactJson(['data' => [], 'workspace' => 'uat-marketing', 'persona' => 'uat-ada@example.com']);
    Gettone::assenteDa($risposta);
    expect(richiesteAlBackoffice())->toBe([['POST', '/v1/ricerca', null, ['q' => 'uat-corpo']]]);
});

// Sprint 22 · T6 (voce #1726): la sessione ha un workspace solo. Con due schede su due workspace, la scheda rimasta indietro
// cerca e riceve i risultati di quello in cui la persona è entrata per ultimo: la risposta dice di quale workspace sono, e la
// cornice li apre lì. Lo slug è quello della sessione, col cui gettone la ricerca è fatta: niente di ciò che manda il browser
// lo cambia, e al backoffice va la parola e basta.

it('POST /cornice/ricerca dice di quale workspace sono i risultati: lo slug del workspace della sessione, quello col cui gettone ha cercato, e mai ciò che manda il browser (sprint 22 · T6.4)', function (array $workspace, string $indirizzo, array $accantoAQ, array $intestazioni) {
    $gettoni = sessioneAMano($workspace);
    // Col gettone di un altro workspace il backoffice darebbe i suoi risultati: qui ne dà altri, per vederlo.
    Http::fake(fn (Request $richiesta) => match (parse_url($richiesta->url(), PHP_URL_PATH)) {
        '/v1/ricerca' => Http::response($richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace'])
            ? esempioDelContratto()
            : ['data' => [risultatoDelBackoffice('board.board', 'uat-di-un-altro-workspace', 'UAT Altro')], 'successivo' => null]),
    });

    $risposta = test()->postJson($indirizzo, ['q' => 'UAT', ...$accantoAQ], $intestazioni)->assertOk();
    Gettone::assenteDa($risposta);

    expect($risposta->json('workspace'))->toBe($workspace['slug'])
        ->and(array_keys($risposta->json()))->toBe(['data', 'workspace', 'persona'])
        ->and($risposta->json('data.*.id'))->toBe(ID_DELL_ESEMPIO_DI_RICERCA)
        // Al backoffice va la parola e basta: ciò che il browser manda accanto a `q` resta qui.
        ->and(richiesteAlBackoffice())->toBe([['POST', '/v1/ricerca', null, ['q' => 'UAT']]]);
})->with([
    'il workspace della sessione' => [WORKSPACE_DELLA_RICERCA, 'cornice/ricerca', [], []],
    'un altro workspace nella sessione' => [['id' => 'uat-ws-2', 'nome' => 'UAT Vendite', 'slug' => 'uat-vendite'], 'cornice/ricerca', [], []],
    'un altro slug nel corpo, accanto a q' => [WORKSPACE_DELLA_RICERCA, 'cornice/ricerca', ['workspace' => 'uat-vendite'], []],
    'un altro slug nel corpo, in un oggetto' => [WORKSPACE_DELLA_RICERCA, 'cornice/ricerca', ['workspace' => ['slug' => 'uat-vendite']], []],
    'un altro slug nell\'indirizzo' => [WORKSPACE_DELLA_RICERCA, 'cornice/ricerca?workspace=uat-vendite', [], []],
    'un altro slug nell\'indirizzo, come lista' => [WORKSPACE_DELLA_RICERCA, 'cornice/ricerca?workspace[slug]=uat-vendite', [], []],
    'un altro slug in un\'intestazione' => [WORKSPACE_DELLA_RICERCA, 'cornice/ricerca', [], ['X-Workspace' => 'uat-vendite', 'X-Zeiras-Workspace' => 'uat-vendite']],
    'la pagina da cui si cerca è di un altro workspace' => [WORKSPACE_DELLA_RICERCA, 'cornice/ricerca', [], ['Referer' => 'https://board.zeiras.com/w/uat-vendite']],
]);

it('una GET /cornice/ricerca?q=, quella delle versioni fino alla v1.7.0, non ha più una rotta: 405, con la sessione e senza, e il backoffice non si chiama (sprint 18 · T1.3)', function (bool $conLaSessione) {
    if ($conLaSessione) {
        sessioneAMano(WORKSPACE_DELLA_RICERCA);
    }
    // Se la GET cercasse ancora, il backoffice risponderebbe: la rotta darebbe 200 coi risultati.
    Http::fake(['*' => Http::response(esempioDelContratto())]);

    $risposta = test()->getJson('cornice/ricerca?q=uat');

    $risposta->assertStatus(405);
    expect($risposta->json('data'))->toBeNull();
    Gettone::assenteDa($risposta);
    Http::assertNothingSent();
})->with([
    'con la sessione' => [true],
    'senza sessione' => [false],
]);

it('la ricerca è una rotta sola, POST cornice/ricerca: nel gruppo `web` come le altre della cornice (sessione e CSRF), con la guardia di zr-auth e senza il blocco della sessione (sprint 18 · T1.4)', function () {
    $dellaRicerca = fn () => array_values(array_filter(Route::getRoutes()->getRoutes(), fn ($rotta) => $rotta->uri() === 'cornice/ricerca'));
    $senzaGuardia = fn () => array_values(array_filter(Rotte::senzaGuardia(), fn (string $voce) => str_ends_with($voce, ' cornice/ricerca')));

    expect(array_map(fn ($rotta) => $rotta->methods(), $dellaRicerca()))->toBe([['POST']])
        ->and(in_array('web', $dellaRicerca()[0]->gatherMiddleware(), true))->toBe(true)
        ->and($dellaRicerca()[0]->locksFor())->toBeNull()
        ->and($senzaGuardia())->toBe([]);
});

// Sprint 23 · T2 (voce #1742, S6): lo slug della risposta è preso prima di chiamare il backoffice. Con lo zr-auth di oggi
// l'ordine non si vede: legge il gettone dalla sessione e non la riscrive. Qui la risposta finta del backoffice porta la sessione
// in un altro workspace, come farebbe uno zr-auth che la cambia durante la chiamata: i risultati sono del workspace col cui
// gettone la ricerca è partita, e la risposta dice quello.

it('lo `workspace` della risposta della ricerca è quello della sessione prima della chiamata al backoffice: una risposta che nel frattempo porta la sessione in un altro workspace non lo cambia (sprint 23 · T2.6)', function () {
    $gettoni = sessioneAMano(WORKSPACE_DELLA_RICERCA);
    Http::fake(function (Request $richiesta) use ($gettoni) {
        $colGettoneDiPrima = $richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace']);
        sessioneAMano(['id' => 'uat-ws-2', 'nome' => 'UAT Vendite', 'slug' => 'uat-vendite']);

        return Http::response($colGettoneDiPrima ? esempioDelContratto() : ['data' => [], 'successivo' => null]);
    });

    $risposta = cerca('UAT')->assertOk();

    expect($risposta->json('workspace'))->toBe('uat-marketing')
        ->and($risposta->json('data.*.id'))->toBe(ID_DELL_ESEMPIO_DI_RICERCA)
        // La sessione è passata davvero all'altro workspace: senza, il caso non proverebbe l'ordine.
        ->and(Sessione::workspace()['slug'] ?? null)->toBe('uat-vendite');
    Http::assertSentCount(1);
});

// Sprint 24 · T1 (voce #1745): davanti al 403 `accettazione_richiesta` del backoffice (documenti legali da accettare) la ricerca
// risponde 403 col solo codice, come le tre rotte delle notifiche (NotificheTest): i documenti mancanti, il titolo e il
// dettaglio del backoffice restano nella parte server. Il 403 è accettazioneRichiesta() di tests/Pest.php.

it('davanti al 403 accettazione_richiesta del backoffice la ricerca risponde 403 col codice e con `persona`, l\'email di chi è nella sessione, e nient\'altro: né i documenti mancanti, né il titolo, né il dettaglio (sprint 24 · T1.3; sprint 38 · T3.4)', function () {
    sessioneAMano(WORKSPACE_DELLA_RICERCA);
    Http::fake(['*' => accettazioneRichiesta()]);

    $risposta = cerca('UAT')->assertForbidden();

    expect($risposta->getContent())->toBe('{"errore":"accettazione_richiesta","persona":"uat-ada@example.com"}');
    Http::assertSentCount(1);
});

it('ogni altra risposta del backoffice resta l\'errore che era: un 403 con un altro codice o senza codice, e quel codice con un altro stato, non fanno rispondere accettazione_richiesta alla ricerca (sprint 24 · T1.5)', function (int $stato, ?string $codice) {
    sessioneAMano(WORKSPACE_DELLA_RICERCA);
    Http::fake(['*' => accettazioneRichiesta($stato, $codice)]);

    $risposta = cerca('UAT');

    expect($risposta->status())->toBeGreaterThanOrEqual(500)->toBeLessThan(600)
        ->and($risposta->json('errore'))->toBeNull();
    Http::assertSentCount(1);
})->with(quasiAccettazioneRichiesta());

// Sprint 25 · T3 (voce #1639): ricerca.crea ha un freno per persona (120 ricerche al minuto, 2.000 al giorno). Davanti al suo 429
// `troppe_richieste` la ricerca risponde 429 col solo codice e coi secondi di `Retry-After`, se il backoffice li dice: il titolo,
// il dettaglio e ogni altra intestazione del backoffice restano nella parte server. Il 429 è troppeRichieste(), qui sopra.

it('davanti al 429 troppe_richieste del backoffice la ricerca risponde 429 col codice, con `persona` e con `Retry-After` coi secondi del backoffice: né il titolo, né il dettaglio, né un\'altra intestazione (sprint 25 · T3.3; sprint 38 · T3.4)', function (string $riprovaFra) {
    sessioneAMano(WORKSPACE_DELLA_RICERCA);
    Http::fake(['*' => troppeRichieste($riprovaFra)]);

    $risposta = cerca('UAT')->assertStatus(429)->assertHeader('Retry-After', $riprovaFra);

    expect($risposta->getContent())->toBe('{"errore":"troppe_richieste","persona":"uat-ada@example.com"}')
        ->and((string) $risposta->baseResponse)->not->toContain('segno-');
    Http::assertSentCount(1);
})->with([
    'fra 37 secondi' => ['37'],
    'subito' => ['0'],
]);

it('senza i secondi di `Retry-After`, o con un valore che non è un numero intero di secondi, la ricerca risponde lo stesso 429, col codice e con `persona`, e l\'intestazione non c\'è (sprint 25 · T3.3; sprint 38 · T3.4)', function (?string $riprovaFra) {
    sessioneAMano(WORKSPACE_DELLA_RICERCA);
    Http::fake(['*' => troppeRichieste($riprovaFra)]);

    $risposta = cerca('UAT')->assertStatus(429)->assertHeaderMissing('Retry-After');

    expect($risposta->getContent())->toBe('{"errore":"troppe_richieste","persona":"uat-ada@example.com"}')
        ->and((string) $risposta->baseResponse)->not->toContain('segno-');
    Http::assertSentCount(1);
})->with([
    'senza l\'intestazione' => [null],
    'una data' => ['Wed, 21 Oct 2026 07:28:00 GMT'],
    'un numero con la virgola' => ['1.5'],
    'un numero negativo' => ['-3'],
    'un testo' => ['segno-di-un-testo'],
]);

// Sprint 38 · T3.4 (voce #2026): anche il 403 e il 429 della ricerca dicono di chi sono, come le risposte 200 dalla `v2.4.0`:
// `persona` è l'email della persona della sessione, presa prima di chiamare il backoffice. Solo il codice e l'email.

it('il 403 e il 429 della ricerca dicono di chi sono: `persona` è l\'email della persona della sessione, mai un valore della richiesta, e di lei non passano né l\'id né il nome (sprint 38 · T3.4)', function (int $stato, string $codice, array $diversa, string $email) {
    sessioneAMano(WORKSPACE_DELLA_RICERCA, 'en', $diversa);
    Http::fake(['*' => $stato === 429 ? troppeRichieste('37') : accettazioneRichiesta()]);

    $risposta = test()->postJson('cornice/ricerca?persona=uat-altra@example.org', ['q' => 'lancio', 'persona' => 'uat-altra@example.org', 'email' => 'uat-altra@example.org'], ['X-Persona' => 'uat-altra@example.org']);

    $risposta->assertStatus($stato);
    Gettone::assenteDa($risposta);
    expect($risposta->getContent())->toBe('{"errore":"'.$codice.'","persona":"'.$email.'"}')
        ->and($risposta->headers->get('Retry-After'))->toBe($stato === 429 ? '37' : null);
    Http::assertSentCount(1);
})->with([
    'il 403' => [403, 'accettazione_richiesta'],
    'il 429' => [429, 'troppe_richieste'],
])->with([
    'Ada' => [['id' => 'uat-persona-1'], 'uat-ada@example.com'],
    'Grace, entrata dopo' => [['id' => 'uat-persona-2', 'nome' => 'UAT Grace', 'email' => 'uat-grace@example.com'], 'uat-grace@example.com'],
]);

it('l\'email del 403 e del 429 della ricerca è presa prima di chiamare il backoffice: se durante la chiamata la sessione passa a un\'altra persona, la risposta dice chi ha cercato (sprint 38 · T3.4)', function (int $stato, string $codice) {
    sessioneAMano(WORKSPACE_DELLA_RICERCA);
    Http::fake(function () use ($stato) {
        sessioneAMano(WORKSPACE_DELLA_RICERCA, 'en', ['id' => 'uat-persona-2', 'nome' => 'UAT Grace', 'email' => 'uat-grace@example.com']);

        return $stato === 429 ? troppeRichieste('37') : accettazioneRichiesta();
    });

    $risposta = cerca('UAT')->assertStatus($stato);

    expect($risposta->getContent())->toBe('{"errore":"'.$codice.'","persona":"uat-ada@example.com"}')
        // La sessione è passata davvero all'altra persona: senza, il caso non proverebbe l'ordine.
        ->and(Sessione::utente()['email'] ?? null)->toBe('uat-grace@example.com');
    Http::assertSentCount(1);
})->with([
    'il 403' => [403, 'accettazione_richiesta'],
    'il 429' => [429, 'troppe_richieste'],
]);

it('ogni altra risposta del backoffice resta l\'errore che era: un 429 con un altro codice o senza codice, e quel codice con un altro stato, non fanno rispondere troppe_richieste alla ricerca (sprint 25 · T3.3)', function (int $stato, ?string $codice) {
    sessioneAMano(WORKSPACE_DELLA_RICERCA);
    Http::fake(['*' => troppeRichieste('37', $stato, $codice)]);

    $risposta = cerca('UAT');

    expect($risposta->status())->toBeGreaterThanOrEqual(500)->toBeLessThan(600)
        ->and($risposta->json('errore'))->toBeNull()
        ->and($risposta->headers->has('Retry-After'))->toBe(false);
    Http::assertSentCount(1);
})->with([
    'un 429 con un altro codice' => [429, 'limite_raggiunto'],
    'un 429 senza codice' => [429, null],
    'quel codice con un 403' => [403, 'troppe_richieste'],
    'quel codice con un 503' => [503, 'troppe_richieste'],
]);

// Sprint 37 · T4 (voce #1999): la ricerca dice di chi è. `persona` è l'email della persona della sessione che ha risposto,
// la stessa che il browser ha già coi dati della cornice: in una scheda rimasta ferma, dove la sessione è passata a un'altra
// persona, la cornice sa così che i risultati non sono di chi mostra. Viene dalla sessione, mai dalla richiesta.
it('POST /cornice/ricerca dice di chi è la risposta: `persona` è l\'email della persona della sessione, mai un valore della richiesta, e di lei non passano né l\'id né il nome (sprint 37 · T4.3)', function (array $diversa, string $email) {
    sessioneAMano(WORKSPACE_DELLA_RICERCA, 'en', $diversa);
    Http::fake(['*' => Http::response(['data' => [], 'successivo' => null])]);

    $risposta = test()->postJson('cornice/ricerca?persona=uat-altra@example.org', ['q' => 'lancio', 'persona' => 'uat-altra@example.org', 'email' => 'uat-altra@example.org'], ['X-Persona' => 'uat-altra@example.org']);

    $risposta->assertOk()->assertExactJson(['data' => [], 'workspace' => 'uat-marketing', 'persona' => $email]);
    Gettone::assenteDa($risposta);
    expect((string) $risposta->getContent())->not->toContain('example.org')->not->toContain('UAT ')->not->toContain('uat-persona-')->not->toContain('"email"');
})->with([
    'Ada' => [['id' => 'uat-persona-1'], 'uat-ada@example.com'],
    'Grace, entrata dopo' => [['id' => 'uat-persona-2', 'nome' => 'UAT Grace', 'email' => 'uat-grace@example.com'], 'uat-grace@example.com'],
]);

// Sprint 26 · T3 (lettura della PR #56, N6). Il registro lo legge una classe sola, `Registro`, e la copia che tiene è una per
// tutte le rotte: un registro di prova lasciato da un caso arriverebbe a ogni caso dopo, di questo file e degli altri. Lo
// dicono due casi di fila: il primo scrive un registro di prova e non lo toglie, il secondo trova quello del pacchetto. Lo
// toglie `tests/Pest.php`, dopo ogni caso di ogni file (sprint 27 · T5.2): fino allo sprint 26 lo toglieva un `afterEach` di
// questo file, e i due casi provavano solo quello.

it('un caso che scrive un registro di prova non lo lascia al caso dopo: il primo lo scrive e non lo toglie, e nel secondo la ricerca dà a un contatto le chiavi del registro del pacchetto (sprint 26 · T3.3)', function (?array $diProva, array $contesto) {
    sessioneAMano(WORKSPACE_DELLA_RICERCA);
    Http::fake(['*' => Http::response(['data' => [risultatoDelBackoffice('crm.persona', 'uat-p1', 'UAT Persona', CONTESTO_CON_OGNI_CHIAVE)], 'successivo' => null])]);
    if ($diProva !== null) {
        registroGiaLetto($diProva);
    }

    expect(cerca('UAT')->assertOk()->json('data.0.contesto'))->toBe($contesto);
})->with([
    'il primo: un registro di prova che al contatto dà `reparto`' => [[['id' => 'crm', 'risorse' => [['tipo' => 'crm.persona', 'contesto' => ['reparto']]]]], ['reparto' => 'UAT Acquisti']],
    'il secondo: nessuno lo scrive, ed è quello del pacchetto' => [null, ['ruolo' => 'Direttore', 'organizzazione' => 'UAT Impianti']],
]);
