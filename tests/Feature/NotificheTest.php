<?php

use Illuminate\Foundation\Http\Middleware\ConvertEmptyStringsToNull;
use Illuminate\Foundation\Http\Middleware\TrimStrings;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Illuminate\Testing\TestResponse;
use Zeiras\Auth\Testing\Gettone;
use Zeiras\Auth\Testing\Rotte;

// Sprint 3 · T3 (voce #1277), riscritto nello sprint 5 · T2 (voce #1257) sul contratto di zr-backoffice. Le rotte delle
// notifiche per il browser: GET /cornice/notifiche e PATCH /cornice/notifiche/{notifica}/lettura (dalla v1.1.0 la cornice non
// la chiama più: resta per i frontend che la usano), nel gruppo `web` del frontend. La parte server le gira al backoffice
// col gettone del workspace, che resta nella sessione. Il backoffice è Http::fake, mai il finto di zr-auth. Nessuna
// richiesta esce (TestCase).
// Sprint 6 · T1 (voce #1318): l'elenco porta anche `app`, il codice dell'app da cui viene la notifica, com'è nel backoffice.
// Sprint 6 · T2 (voce #1318): POST /cornice/notifiche/letture segna lette le notifiche fino a un istante, con una richiesta
// sola al backoffice.
// Sprint 11 · T1 (voce #1458): le due rotte dicono quando, sull'orologio della parte server e nella forma del segno dei dati:
// l'elenco quando ha cominciato a leggere (`aggiornati_il`), la lettura quando il backoffice ha risposto (`segnate_il`).

/** Il workspace in cui entra la sessione dei test. */
const WORKSPACE_DELLE_NOTIFICHE = ['id' => 'uat-ws', 'nome' => 'UAT Marketing', 'slug' => 'uat-marketing'];

/**
 * Una notifica come la dà /v1 (schema Notifica): tipo, soggetto e dati sono quelli dell'evento che l'ha generata, e `app` è il
 * codice dell'app di quell'evento (`pm` per la board), o null se l'evento non è di un'app.
 *
 * @return array<string, mixed>
 */
function notificaDelBackoffice(string $id, string $creataIl, ?string $lettaIl, ?string $app = 'pm'): array
{
    return [
        'id' => $id, 'tipo' => 'com.zeiras.board.cartella.creata', 'app' => $app, 'soggetto' => "/v1/board/cartelle/uat-cartella-{$id}",
        'dati' => ['id' => "uat-cartella-{$id}", 'aggiornata_il' => $creataIl], 'letta_il' => $lettaIl, 'creata_il' => $creataIl,
    ];
}

/** Un errore di /v1 col suo codice: un problem details (RFC 9457), `application/problem+json`. */
function problemaDelBackoffice(int $stato, ?string $codice): mixed
{
    $problema = ['type' => 'about:blank', 'title' => 'uat', 'status' => $stato, 'detail' => 'uat'] + ($codice === null ? [] : ['codice' => $codice]);

    return Http::response((string) json_encode($problema), $stato, ['Content-Type' => 'application/problem+json']);
}

/**
 * Il corpo di POST /cornice/notifiche/letture come lo manda la cornice: l'istante e lo slug del workspace della pagina.
 *
 * @return array{fino_a: string, workspace: string}
 */
function lettureFinoA(string $finoA): array
{
    return ['fino_a' => $finoA, 'workspace' => WORKSPACE_DELLE_NOTIFICHE['slug']];
}

/** Il percorso di /v1 di una richiesta al backoffice, senza la query. */
function percorsoDi(Request $richiesta): ?string
{
    return parse_url($richiesta->url(), PHP_URL_PATH) ?: null;
}

/**
 * Una risposta del backoffice che porta l'orologio avanti di tre secondi: ciò che la parte server prende prima di chiamarlo e
 * ciò che prende dopo sono due istanti diversi. Si chiama dentro il finto, quando la richiesta arriva.
 */
function treSecondiDopo(mixed $corpo): mixed
{
    Carbon::setTestNow(Carbon::now()->addSeconds(3));

    return Http::response($corpo);
}

/** Ogni risposta delle rotte della cornice è senza gettone. */
function senzaGettone(TestResponse $risposta): TestResponse
{
    Gettone::assenteDa($risposta);

    return $risposta;
}

it('GET /cornice/notifiche dà la prima pagina delle notifiche del workspace del gettone, nell\'ordine del backoffice, coi soli id, creata_il, letta e app, e app è quello del backoffice: un prodotto, un codice che zr-core non conosce, o null; e l\'istante della lettura (sprint 5 · T2.1; sprint 6 · T1.1; sprint 11 · T1.1)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-10 01:15:07.000321', 'UTC'));
    $gettoni = sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    // Al gettone dell'accesso io.notifiche.elenca risponde 403 gettone_senza_workspace.
    Http::fake(fn (Request $richiesta) => match (percorsoDi($richiesta)) {
        '/v1/io/notifiche' => $richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace'])
            ? Http::response(['data' => [
                notificaDelBackoffice('uat-n3', '2026-10-07T09:03:00.123Z', null),
                // Un'app nuova può comparire: la parte server non la scarta, lo fa la cornice col registro.
                notificaDelBackoffice('uat-n2', '2026-10-07T09:02:00.123Z', '2026-10-07T09:05:00.456Z', 'uat-ignota'),
                notificaDelBackoffice('uat-n1', '2026-10-07T09:01:00.123Z', null, null),
            ], 'successivo' => 'uat-cursore-2'])
            : problemaDelBackoffice(403, 'gettone_senza_workspace'),
    });

    $risposta = senzaGettone($this->getJson('cornice/notifiche'))->assertOk()->assertExactJson(['data' => [
        ['id' => 'uat-n3', 'creata_il' => '2026-10-07T09:03:00.123Z', 'letta' => false, 'app' => 'pm'],
        ['id' => 'uat-n2', 'creata_il' => '2026-10-07T09:02:00.123Z', 'letta' => true, 'app' => 'uat-ignota'],
        ['id' => 'uat-n1', 'creata_il' => '2026-10-07T09:01:00.123Z', 'letta' => false, 'app' => null],
    ], 'aggiornati_il' => '2026-10-10T01:15:07.000321Z']);
    expect($risposta->json('data.*.id'))->toBe(['uat-n3', 'uat-n2', 'uat-n1']);
    // Una richiesta sola e senza parametri: la prima pagina, e il cursore non si segue.
    Http::assertSentCount(1);
    Http::assertSent(fn (Request $richiesta) => $richiesta->method() === 'GET' && percorsoDi($richiesta) === '/v1/io/notifiche'
        && parse_url($richiesta->url(), PHP_URL_QUERY) === null
        && $richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace']));
});

it('PATCH /cornice/notifiche/{id}/lettura gira letta al backoffice col gettone del workspace e risponde con ciò che il backoffice ha segnato (sprint 5 · T2.2)', function (bool $letta, ?string $lettaIl, bool $attesa) {
    $gettoni = sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    // Al gettone dell'accesso io.notifiche.lettura.modifica risponde 403 gettone_senza_workspace.
    Http::fake(fn (Request $richiesta) => match (percorsoDi($richiesta)) {
        '/v1/io/notifiche/uat-n3/lettura' => $richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace'])
            ? Http::response(['data' => notificaDelBackoffice('uat-n3', '2026-10-07T09:03:00.123Z', $lettaIl)])
            : problemaDelBackoffice(403, 'gettone_senza_workspace'),
    });

    senzaGettone($this->patchJson('cornice/notifiche/uat-n3/lettura', ['letta' => $letta]))
        ->assertOk()->assertExactJson(['data' => ['id' => 'uat-n3', 'letta' => $attesa]]);
    Http::assertSentCount(1);
    Http::assertSent(fn (Request $richiesta) => $richiesta->method() === 'PATCH' && percorsoDi($richiesta) === '/v1/io/notifiche/uat-n3/lettura'
        && $richiesta->data() === ['letta' => $letta]
        && $richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace']));
})->with([
    'segna letta' => [true, '2026-10-07T09:05:00.456Z', true],
    'torna non letta' => [false, null, false],
    // `letta` della risposta è quella del backoffice (`letta_il`), non quella chiesta.
    'chiede letta, il backoffice risponde non letta' => [true, null, false],
    'chiede non letta, il backoffice risponde letta' => [false, '2026-10-07T09:05:00.456Z', true],
]);

it('senza letta, o con un valore che non è un booleano JSON, risponde 422 dati_non_validi e non chiama il backoffice (sprint 5 · T2.3)', function (array $corpo, string $query) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake();

    senzaGettone($this->patchJson('cornice/notifiche/uat-n3/lettura'.$query, $corpo))
        ->assertStatus(422)->assertExactJson(['errore' => 'dati_non_validi']);
    Http::assertNothingSent();
})->with([
    'senza letta' => [[], ''],
    'la stringa true' => [['letta' => 'true'], ''],
    'la stringa false' => [['letta' => 'false'], ''],
    'il numero 1' => [['letta' => 1], ''],
    'il numero 0' => [['letta' => 0], ''],
    'null' => [['letta' => null], ''],
    'una lista' => [['letta' => [true]], ''],
    'solo nella query' => [[], '?letta=true'],
]);

it('un id che non è fatto solo di lettere, cifre, - e _, o più lungo di 64 caratteri, risponde 404 e non chiama il backoffice (sprint 5 · T2.4)', function (string $id) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake();

    senzaGettone($this->patchJson("cornice/notifiche/{$id}/lettura", ['letta' => true]))->assertNotFound();
    Http::assertNothingSent();
})->with([
    'una barra codificata' => ['a%2Fb'],
    'un altro metodo di /v1' => ['..%2F..%2Fworkspace%2Fmembri'],
    '65 lettere' => [str_repeat('a', 65)],
    'due punti' => ['..'],
    'un punto' => ['a.b'],
    'uno spazio' => ['a%20b'],
    'un punto di domanda codificato' => ['a%3Fb'],
    'un cancelletto codificato' => ['a%23b'],
    'una percentuale codificata' => ['a%252Fb'],
    'una lettera non ASCII' => ['%C3%A8'],
]);

it('un id di 64 caratteri fra lettere, cifre, - e _ arriva al backoffice così com\'è (sprint 5 · T2.4)', function () {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    $id = 'Uat_n-3'.str_repeat('z', 57);
    Http::fake(['*' => Http::response(['data' => notificaDelBackoffice($id, '2026-10-07T09:03:00.123Z', '2026-10-07T09:05:00.456Z')])]);

    senzaGettone($this->patchJson("cornice/notifiche/{$id}/lettura", ['letta' => true]))
        ->assertOk()->assertExactJson(['data' => ['id' => $id, 'letta' => true]]);
    Http::assertSentCount(1);
    Http::assertSent(fn (Request $richiesta) => percorsoDi($richiesta) === "/v1/io/notifiche/{$id}/lettura");
});

it('una notifica che il backoffice non trova risponde 404 non_trovato (sprint 5 · T2.5)', function () {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => problemaDelBackoffice(404, 'non_trovato')]);

    senzaGettone($this->patchJson('cornice/notifiche/uat-di-un-altro/lettura', ['letta' => true]))
        ->assertNotFound()->assertExactJson(['errore' => 'non_trovato']);
    Http::assertSentCount(1);
});

it('un 404 del backoffice senza il codice non_trovato è un suo errore, non una notifica che non c\'è (sprint 5 · T2.5)', function (?string $codice) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => problemaDelBackoffice(404, $codice)]);

    $risposta = senzaGettone($this->patchJson('cornice/notifiche/uat-n3/lettura', ['letta' => true]));

    expect($risposta->status())->toBeGreaterThanOrEqual(500)->toBeLessThan(600)
        ->and($risposta->json('errore'))->toBeNull();
})->with([
    'senza codice' => [null],
    'un altro codice' => ['uat_altro_codice'],
]);

it('se il backoffice risponde alla lettura senza la notifica è un errore, mai un 200 (sprint 5 · T2.5)', function (int $stato, mixed $corpo) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => Http::response($corpo, $stato)]);

    $risposta = senzaGettone($this->patchJson('cornice/notifiche/uat-n3/lettura', ['letta' => true]));

    expect($risposta->status())->toBeGreaterThanOrEqual(500)->toBeLessThan(600)
        ->and($risposta->json('data'))->toBeNull();
})->with([
    'un 500' => [500, ''],
    'un 200 senza JSON' => [200, 'uat: non è JSON'],
    'senza data' => [200, ['notifica' => notificaDelBackoffice('uat-n3', '2026-10-07T09:03:00.123Z', null)]],
    'data vuoto' => [200, ['data' => []]],
    'senza id' => [200, ['data' => ['app' => 'pm', 'creata_il' => '2026-10-07T09:03:00.123Z', 'letta_il' => '2026-10-07T09:05:00.456Z']]],
    'senza letta_il' => [200, ['data' => ['id' => 'uat-n3', 'app' => 'pm', 'creata_il' => '2026-10-07T09:03:00.123Z']]],
    'letta_il non è un istante né null' => [200, ['data' => ['id' => 'uat-n3', 'app' => 'pm', 'creata_il' => '2026-10-07T09:03:00.123Z', 'letta_il' => true]]],
    'senza app (sprint 6 · T1.2)' => [200, ['data' => ['id' => 'uat-n3', 'creata_il' => '2026-10-07T09:03:00.123Z', 'letta_il' => '2026-10-07T09:05:00.456Z']]],
    'un\'altra notifica' => [200, ['data' => notificaDelBackoffice('uat-n2', '2026-10-07T09:02:00.123Z', '2026-10-07T09:05:00.456Z')]],
]);

it('POST /cornice/notifiche/letture manda al backoffice una sola POST col solo fino_a, lo stesso, e il gettone del workspace, e risponde con l\'istante del backoffice e con quello in cui le ha segnate (sprint 6 · T2.1; sprint 11 · T1.2)', function (string $finoA, string $delBackoffice) {
    Carbon::setTestNow(Carbon::parse('2026-10-10 01:15:07.000321', 'UTC'));
    $gettoni = sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    // Al gettone dell'accesso io.notifiche.letture.crea risponde 403 gettone_senza_workspace.
    Http::fake(fn (Request $richiesta) => match (percorsoDi($richiesta)) {
        '/v1/io/notifiche/letture' => $richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace'])
            ? Http::response(['data' => ['fino_a' => $delBackoffice]])
            : problemaDelBackoffice(403, 'gettone_senza_workspace'),
    });

    senzaGettone($this->postJson('cornice/notifiche/letture', lettureFinoA($finoA)))
        ->assertOk()->assertExactJson(['data' => ['fino_a' => $delBackoffice], 'segnate_il' => '2026-10-10T01:15:07.000321Z']);
    Http::assertSentCount(1);
    // Al backoffice va solo l'istante: lo slug serve alla rotta, e resta qui.
    Http::assertSent(fn (Request $richiesta) => $richiesta->method() === 'POST' && percorsoDi($richiesta) === '/v1/io/notifiche/letture'
        && $richiesta->data() === ['fino_a' => $finoA]
        && $richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace']));
})->with([
    'in UTC, al millisecondo: com\'è la creata_il di una notifica' => ['2026-10-08T10:00:00.123Z', '2026-10-08T10:00:00.123Z'],
    // `fino_a` della risposta è quello del backoffice, in UTC, non quello chiesto.
    'con un altro fuso: al backoffice va com\'è' => ['2026-10-08T12:00:00+02:00', '2026-10-08T10:00:00.000Z'],
    'un fuso a ovest, con la mezz\'ora' => ['2026-10-08T05:30:00.5-04:30', '2026-10-08T10:00:00.500Z'],
    'sei decimali: di più il backoffice non ne ammette' => ['2026-10-08T10:00:00.123456Z', '2026-10-08T10:00:00.123Z'],
]);

it('senza fino_a, o con un valore che non è una stringa con data, ora e fuso, risponde 422 dati_non_validi e non chiama il backoffice (sprint 6 · T2.2)', function (array $corpo, string $query) {
    // Senza il middleware che toglie gli spazi: la rotta non conta su quello del frontend per un a capo in fondo.
    test()->withoutMiddleware(TrimStrings::class);
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake();

    // Con lo slug del workspace della sessione: ogni caso è rifiutato per il suo istante.
    senzaGettone($this->postJson('cornice/notifiche/letture'.$query, $corpo + ['workspace' => WORKSPACE_DELLE_NOTIFICHE['slug']]))
        ->assertStatus(422)->assertExactJson(['errore' => 'dati_non_validi']);
    Http::assertNothingSent();
})->with([
    'senza fino_a' => [[], ''],
    'null' => [['fino_a' => null], ''],
    'un numero' => [['fino_a' => 1760000000], ''],
    'true' => [['fino_a' => true], ''],
    'una lista' => [['fino_a' => ['2026-10-08T10:00:00.000Z']], ''],
    'vuoto' => [['fino_a' => ''], ''],
    'una parola' => [['fino_a' => 'ieri'], ''],
    'una data senza ora' => [['fino_a' => '2026-10-08'], ''],
    'un\'ora senza fuso' => [['fino_a' => '2026-10-08T10:00:00.000'], ''],
    'il fuso senza i due punti' => [['fino_a' => '2026-10-08T10:00:00.000+0200'], ''],
    'senza i secondi' => [['fino_a' => '2026-10-08T10:00Z'], ''],
    'uno spazio al posto di T' => [['fino_a' => '2026-10-08 10:00:00.000Z'], ''],
    'uno spazio davanti' => [['fino_a' => ' 2026-10-08T10:00:00.000Z'], ''],
    'un a capo in fondo' => [['fino_a' => "2026-10-08T10:00:00.000Z\n"], ''],
    'sette decimali' => [['fino_a' => '2026-10-08T10:00:00.1234567Z'], ''],
    'una stringa di 100 caratteri' => [['fino_a' => '2026-10-08T10:00:00.'.str_repeat('0', 79).'Z'], ''],
    'solo nella query' => [[], '?fino_a=2026-10-08T10:00:00.000Z'],
]);

it('senza workspace, o se non è una stringa non vuota, risponde 422 dati_non_validi e non chiama il backoffice (sprint 6 · T2.5)', function (array $corpo, string $query) {
    // Senza i middleware che tolgono gli spazi e fanno null di una stringa vuota: la rotta non conta su quelli del frontend.
    test()->withoutMiddleware([TrimStrings::class, ConvertEmptyStringsToNull::class]);
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake();

    senzaGettone($this->postJson('cornice/notifiche/letture'.$query, ['fino_a' => '2026-10-08T10:00:00.000Z'] + $corpo))
        ->assertStatus(422)->assertExactJson(['errore' => 'dati_non_validi']);
    Http::assertNothingSent();
})->with([
    'senza workspace' => [[], ''],
    'null' => [['workspace' => null], ''],
    'un numero' => [['workspace' => 7], ''],
    'true' => [['workspace' => true], ''],
    'una lista' => [['workspace' => ['uat-marketing']], ''],
    'vuoto' => [['workspace' => ''], ''],
    'solo nella query' => [[], '?workspace=uat-marketing'],
]);

it('con lo slug di un workspace che non è quello della sessione risponde 409 workspace_diverso e non chiama il backoffice: la persona è entrata in un altro da un\'altra scheda (sprint 6 · T2.5)', function (string $workspace) {
    // Senza il middleware che toglie gli spazi: lo slug si confronta com'è.
    test()->withoutMiddleware(TrimStrings::class);
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake();

    senzaGettone($this->postJson('cornice/notifiche/letture', ['fino_a' => '2026-10-08T10:00:00.000Z', 'workspace' => $workspace]))
        ->assertStatus(409)->assertExactJson(['errore' => 'workspace_diverso']);
    Http::assertNothingSent();
})->with([
    'un altro workspace' => ['uat-vendite'],
    'lo stesso con le maiuscole' => ['UAT-Marketing'],
    'lo stesso con uno spazio in fondo' => ['uat-marketing '],
    'il nome al posto dello slug' => ['UAT Marketing'],
    'l\'id al posto dello slug' => ['uat-ws'],
]);

it('un istante che ha la forma giusta ma che il backoffice rifiuta con 422 dati_non_validi, come il 31 febbraio, risponde 422 dati_non_validi (sprint 6 · T2.3)', function () {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => problemaDelBackoffice(422, 'dati_non_validi')]);

    senzaGettone($this->postJson('cornice/notifiche/letture', lettureFinoA('2026-02-31T10:00:00.000Z')))
        ->assertStatus(422)->assertExactJson(['errore' => 'dati_non_validi']);
    Http::assertSentCount(1);
});

it('un 422 del backoffice senza il codice dati_non_validi è un suo errore, non un istante sbagliato (sprint 6 · T2.3)', function (?string $codice) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => problemaDelBackoffice(422, $codice)]);

    $risposta = senzaGettone($this->postJson('cornice/notifiche/letture', lettureFinoA('2026-10-08T10:00:00.000Z')));

    expect($risposta->status())->toBeGreaterThanOrEqual(500)->toBeLessThan(600)
        ->and($risposta->json('errore'))->toBeNull();
})->with([
    'senza codice' => [null],
    'un altro codice' => ['uat_altro_codice'],
]);

it('se il backoffice risponde alle letture senza l\'istante è un errore, mai un 200 (sprint 6 · T2.3)', function (int $stato, mixed $corpo) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => Http::response($corpo, $stato)]);

    $risposta = senzaGettone($this->postJson('cornice/notifiche/letture', lettureFinoA('2026-10-08T10:00:00.000Z')));

    expect($risposta->status())->toBeGreaterThanOrEqual(500)->toBeLessThan(600)
        ->and($risposta->json('data'))->toBeNull();
})->with([
    'un 500' => [500, ''],
    'un 200 senza JSON' => [200, 'uat: non è JSON'],
    'senza data' => [200, ['fino_a' => '2026-10-08T10:00:00.000Z']],
    'data vuoto' => [200, ['data' => []]],
    'data è l\'istante, non un oggetto' => [200, ['data' => '2026-10-08T10:00:00.000Z']],
    'fino_a null' => [200, ['data' => ['fino_a' => null]]],
    'fino_a è un numero' => [200, ['data' => ['fino_a' => 1760000000]]],
    'fino_a è una lista' => [200, ['data' => ['fino_a' => ['2026-10-08T10:00:00.000Z']]]],
]);

it('la rotta della bozza, PATCH /cornice/notifiche/lettura, non c\'è più (sprint 5 · T2.6)', function () {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake();

    expect($this->patchJson('cornice/notifiche/lettura', ['fino_a' => '2026-10-06T18:03:00Z', 'letta' => true])->status())->toBeIn([404, 405]);
    Http::assertNothingSent();
});

it('senza sessione le quattro rotte della cornice rispondono 401 e non chiamano il backoffice (sprint 5 · T2.6; sprint 6 · T2.4)', function () {
    Http::fake();

    senzaGettone($this->getJson('cornice/notifiche'))->assertUnauthorized();
    senzaGettone($this->patchJson('cornice/notifiche/uat-n3/lettura', ['letta' => true]))->assertUnauthorized();
    senzaGettone($this->postJson('cornice/notifiche/letture', lettureFinoA('2026-10-08T10:00:00.000Z')))->assertUnauthorized();
    senzaGettone($this->getJson('cornice/ricerca?q=uat'))->assertUnauthorized();
    Http::assertNothingSent();
});

it('con la sessione ma senza workspace le quattro rotte della cornice rispondono 403 e non chiamano il backoffice (sprint 5 · T2.6; sprint 6 · T2.4)', function () {
    sessioneAMano(null);
    Http::fake();

    foreach ([
        $this->getJson('cornice/notifiche'),
        $this->patchJson('cornice/notifiche/uat-n3/lettura', ['letta' => true]),
        $this->postJson('cornice/notifiche/letture', lettureFinoA('2026-10-08T10:00:00.000Z')),
        $this->getJson('cornice/ricerca?q=uat'),
    ] as $risposta) {
        senzaGettone($risposta)->assertForbidden()->assertExactJson(['errore' => 'gettone_senza_workspace']);
    }
    Http::assertNothingSent();
});

it('le rotte della cornice hanno la guardia di zr-auth: Rotte::senzaGuardia() non ne nomina nessuna (sprint 5 · T2.6)', function () {
    $dellaCornice = fn () => array_values(array_filter(Rotte::senzaGuardia(), fn (string $voce) => str_contains($voce, ' cornice/')));

    expect($dellaCornice())->toBe([]);

    // Il controllo nei due versi: una rotta della cornice fuori dal gruppo `web` la nomina.
    Route::patch('cornice/notifiche/{notifica}/scoperta', fn () => 'senza guardia');
    expect($dellaCornice())->toBe(['PATCH cornice/notifiche/{notifica}/scoperta']);
});

it('le rotte della cornice stanno nel gruppo `web` del frontend, che porta la sessione e il CSRF: in un altro gruppo la PATCH non avrebbe il CSRF, e nei test Laravel non lo controlla (sprint 5 · G9; sprint 6 · T2.4)', function () {
    $dellaCornice = fn () => array_values(array_filter(Route::getRoutes()->getRoutes(), fn ($rotta) => str_starts_with($rotta->uri(), 'cornice/')));
    $fuoriDalWeb = fn () => array_values(array_map(
        fn ($rotta) => implode('|', array_diff($rotta->methods(), ['HEAD'])).' '.$rotta->uri(),
        array_filter($dellaCornice(), fn ($rotta) => ! in_array('web', $rotta->gatherMiddleware(), true)),
    ));

    expect($dellaCornice())->toHaveCount(4)
        ->and($fuoriDalWeb())->toBe([]);

    // Il controllo nei due versi: nel gruppo `api` una rotta ha la guardia della sessione ma non il CSRF, e qui si vede.
    Route::middleware('api')->patch('cornice/notifiche/{notifica}/senza-csrf', fn () => 'senza CSRF');
    expect($fuoriDalWeb())->toBe(['PATCH cornice/notifiche/{notifica}/senza-csrf']);
});

it('se il backoffice non risponde all\'elenco, o dà notifiche che non sono di /v1, la rotta risponde con un errore, non con un elenco vuoto (T3.4; sprint 6 · T1.2)', function (int $stato, mixed $corpo) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => Http::response($corpo, $stato)]);

    $elenco = senzaGettone($this->getJson('cornice/notifiche'));

    expect($elenco->status())->toBeGreaterThanOrEqual(500)->toBeLessThan(600)
        ->and($elenco->json('data'))->toBeNull();
})->with([
    'un 500' => [500, ''],
    'un 503' => [503, ''],
    'un 200 senza la forma di /v1' => [200, ['notifiche' => []]],
    'data non è una lista' => [200, ['data' => notificaDelBackoffice('uat-n1', '2026-10-07T09:01:00.123Z', null), 'successivo' => null]],
    'una notifica che non è un oggetto' => [200, ['data' => ['uat-n1'], 'successivo' => null]],
    'una notifica senza id' => [200, ['data' => [['app' => null, 'creata_il' => '2026-10-07T09:01:00.123Z', 'letta_il' => null]], 'successivo' => null]],
    'una notifica senza creata_il' => [200, ['data' => [['id' => 'uat-n1', 'app' => null, 'letta_il' => null]], 'successivo' => null]],
    'una notifica senza letta_il' => [200, ['data' => [['id' => 'uat-n1', 'app' => null, 'creata_il' => '2026-10-07T09:01:00.123Z']], 'successivo' => null]],
    // Sprint 6 · T1.2: `app` c'è sempre, una stringa o null. Senza, o di un altro tipo, non è una notifica di /v1: mai `app: null`.
    'una notifica senza app' => [200, ['data' => [['id' => 'uat-n1', 'creata_il' => '2026-10-07T09:01:00.123Z', 'letta_il' => null]], 'successivo' => null]],
    'app è un numero' => [200, ['data' => [['id' => 'uat-n1', 'app' => 7, 'creata_il' => '2026-10-07T09:01:00.123Z', 'letta_il' => null]], 'successivo' => null]],
    'app è una lista' => [200, ['data' => [['id' => 'uat-n1', 'app' => ['pm'], 'creata_il' => '2026-10-07T09:01:00.123Z', 'letta_il' => null]], 'successivo' => null]],
    'app è true' => [200, ['data' => [['id' => 'uat-n1', 'app' => true, 'creata_il' => '2026-10-07T09:01:00.123Z', 'letta_il' => null]], 'successivo' => null]],
    'la seconda notifica senza app' => [200, ['data' => [notificaDelBackoffice('uat-n2', '2026-10-07T09:02:00.123Z', null), ['id' => 'uat-n1', 'creata_il' => '2026-10-07T09:01:00.123Z', 'letta_il' => null]], 'successivo' => null]],
]);

it('aggiornati_il di GET /cornice/notifiche è l\'istante in cui la parte server comincia a leggere l\'elenco, preso prima di chiamare il backoffice, in UTC coi microsecondi anche con l\'applicazione in un altro fuso (sprint 11 · T1.1)', function () {
    // L'applicazione è a Roma, e lì sono le 03:15: l'istante resta in UTC. Testbench rimette il fuso a ogni test.
    config(['app.timezone' => 'Europe/Rome']);
    date_default_timezone_set('Europe/Rome');
    Carbon::setTestNow(Carbon::parse('2026-10-10 03:15:07.000321', 'Europe/Rome'));
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    // La risposta del backoffice porta l'orologio avanti: un istante preso dopo sarebbe di tre secondi più tardi.
    Http::fake(fn (Request $richiesta) => match (percorsoDi($richiesta)) {
        '/v1/io/notifiche' => treSecondiDopo(['data' => [notificaDelBackoffice('uat-n1', '2026-10-07T09:01:00.123Z', null)], 'successivo' => null]),
    });

    $risposta = senzaGettone($this->getJson('cornice/notifiche'))->assertOk()->assertExactJson([
        'data' => [['id' => 'uat-n1', 'creata_il' => '2026-10-07T09:01:00.123Z', 'letta' => false, 'app' => 'pm']],
        'aggiornati_il' => '2026-10-10T01:15:07.000321Z',
    ]);

    expect(strlen((string) $risposta->json('aggiornati_il')))->toBe(27)
        // Il backoffice ha risposto, e l'orologio è avanti: l'istante è di prima.
        ->and(Carbon::now('UTC')->format('Y-m-d\TH:i:s.u\Z'))->toBe('2026-10-10T01:15:10.000321Z');
});

it('segnate_il di POST /cornice/notifiche/letture è l\'istante preso dopo che il backoffice ha risposto, in UTC coi microsecondi anche con l\'applicazione in un altro fuso (sprint 11 · T1.2)', function () {
    config(['app.timezone' => 'Europe/Rome']);
    date_default_timezone_set('Europe/Rome');
    Carbon::setTestNow(Carbon::parse('2026-10-10 03:15:07.000321', 'Europe/Rome'));
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    // La risposta del backoffice porta l'orologio avanti: un istante preso prima di chiamarlo sarebbe di tre secondi prima.
    Http::fake(fn (Request $richiesta) => match (percorsoDi($richiesta)) {
        '/v1/io/notifiche/letture' => treSecondiDopo(['data' => ['fino_a' => '2026-10-08T10:00:00.123Z']]),
    });

    $risposta = senzaGettone($this->postJson('cornice/notifiche/letture', lettureFinoA('2026-10-08T10:00:00.123Z')))->assertOk()->assertExactJson([
        'data' => ['fino_a' => '2026-10-08T10:00:00.123Z'],
        'segnate_il' => '2026-10-10T01:15:10.000321Z',
    ]);

    expect(strlen((string) $risposta->json('segnate_il')))->toBe(27);
});

it('nessun\'altra risposta porta un istante: la lettura di una notifica e la ricerca restano com\'erano, e un errore del backoffice sull\'elenco o sulle letture non ne porta (sprint 11 · T1.3)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-10 01:15:07.000321', 'UTC'));
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(fn (Request $richiesta) => match (percorsoDi($richiesta)) {
        '/v1/io/notifiche/uat-n3/lettura' => Http::response(['data' => notificaDelBackoffice('uat-n3', '2026-10-07T09:03:00.123Z', '2026-10-07T09:05:00.456Z')]),
        '/v1/ricerca' => Http::response(['data' => [['tipo' => 'board.board', 'id' => 'uat-b1', 'titolo' => 'UAT Lancio']], 'successivo' => null]),
        // All'elenco e alle letture il backoffice non risponde.
        default => Http::response('', 503),
    });

    senzaGettone($this->patchJson('cornice/notifiche/uat-n3/lettura', ['letta' => true]))
        ->assertOk()->assertExactJson(['data' => ['id' => 'uat-n3', 'letta' => true]]);
    senzaGettone($this->getJson('cornice/ricerca?q=uat'))
        ->assertOk()->assertExactJson(['data' => [['tipo' => 'board.board', 'id' => 'uat-b1', 'titolo' => 'UAT Lancio']]]);

    foreach ([
        $this->getJson('cornice/notifiche'),
        $this->postJson('cornice/notifiche/letture', lettureFinoA('2026-10-08T10:00:00.000Z')),
    ] as $errore) {
        expect(senzaGettone($errore)->status())->toBeGreaterThanOrEqual(500)->toBeLessThan(600)
            ->and(substr_count((string) $errore->getContent(), 'aggiornati_il'))->toBe(0)
            ->and(substr_count((string) $errore->getContent(), 'segnate_il'))->toBe(0);
    }
});
