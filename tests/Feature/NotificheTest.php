<?php

use Illuminate\Contracts\Cache\Lock;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Foundation\Http\Middleware\ConvertEmptyStringsToNull;
use Illuminate\Foundation\Http\Middleware\TrimStrings;
use Illuminate\Http\Client\Request;
use Illuminate\Http\Request as RichiestaDelBrowser;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Sleep;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Zeiras\Auth\Sessione;
use Zeiras\Auth\Testing\Gettone;
use Zeiras\Auth\Testing\Rotte;
use Zeiras\Core\Http\NotificheDellaCornice;

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
// Sprint 12 · T2 (voce #1463): l'elenco porta anche `tipo`, il tipo dell'evento che ha generato la notifica, com'è nel
// backoffice: alla cornice serve per il titolo. `soggetto` e `dati` restano nella parte server.
// Sprint 12 · T4 (voce #1461): il backoffice segna al più 5000 notifiche per chiamata e dice se ne restano (`altre`): la parte
// server lo richiama con lo stesso istante finché ne restano, entro due tetti, e dice al browser se ne restano ancora.
// Sprint 20 · T1 (voce #1674): l'elenco porta anche chi ha fatto, su che cosa e per chi (`autore_nome`, `risorsa_nome`,
// `per_me`), quando il backoffice li manda; i casi sono in fondo.

/** Il workspace in cui entra la sessione dei test. */
const WORKSPACE_DELLE_NOTIFICHE = ['id' => 'uat-ws', 'nome' => 'UAT Marketing', 'slug' => 'uat-marketing'];

/** Ciò che la rotta dice, dei tre dati del #1670, di una notifica del backoffice di prima, che non li manda (sprint 20 · T1). */
const SENZA_CHI_E_COSA = ['autore_nome' => null, 'risorsa_nome' => null, 'per_me' => null];

/**
 * Una notifica come la dava /v1 prima del #1670 (schema Notifica, senza `autore`, `risorsa_nome` e `per_me`): tipo, soggetto e
 * dati sono quelli dell'evento che l'ha generata, e `app` è il codice dell'app di quell'evento (`pm` per la board), o null se
 * l'evento non è di un'app.
 *
 * @return array<string, mixed>
 */
function notificaDelBackoffice(string $id, string $creataIl, ?string $lettaIl, ?string $app = 'pm', string $tipo = 'com.zeiras.board.cartella.creata'): array
{
    return [
        'id' => $id, 'tipo' => $tipo, 'app' => $app, 'soggetto' => "/v1/board/cartelle/uat-cartella-{$id}",
        'dati' => ['id' => "uat-cartella-{$id}", 'aggiornata_il' => $creataIl], 'letta_il' => $lettaIl, 'creata_il' => $creataIl,
    ];
}

/**
 * Notifiche di /v1 a cui manca il tipo, o che ne hanno uno che non è una stringa. Per il resto sono notifiche intere: il guasto
 * è solo quello. Una riga per caso, per l'elenco e per la lettura di una notifica.
 *
 * @return array<string, array{array<string, mixed>}>
 */
function notificheSenzaUnTipo(): array
{
    $notifica = notificaDelBackoffice('uat-n3', '2026-10-07T09:03:00.123Z', '2026-10-07T09:05:00.456Z');

    return [
        'senza tipo' => [array_diff_key($notifica, ['tipo' => true])],
        'tipo è null' => [['tipo' => null] + $notifica],
        'tipo è un numero' => [['tipo' => 7] + $notifica],
        'tipo è true' => [['tipo' => true] + $notifica],
        'tipo è una lista' => [['tipo' => ['com.zeiras.board.cartella.creata']] + $notifica],
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

/**
 * La risposta del backoffice a io.notifiche.letture.crea (schema NotificheLetture): l'istante in UTC, quante notifiche ha
 * segnato questa chiamata e se ne restano. `altre` è ciò che il test gli fa dire, anche un valore che non è un booleano.
 *
 * @return array{data: array{fino_a: string, segnate: int, altre: mixed}}
 */
function lettureDelBackoffice(string $finoA, mixed $altre = false): array
{
    return ['data' => ['fino_a' => $finoA, 'segnate' => $altre === true ? 5000 : 3, 'altre' => $altre]];
}

/**
 * Una risposta alle letture che ci mette un po': quando la chiamata arriva l'orologio va avanti di tanti microsecondi, e il
 * backoffice risponde con quell'`altre` e con quell'istante.
 */
function lettureDopo(int $microsecondi, mixed $altre, string $finoA = '2026-10-08T10:00:00.123Z'): Closure
{
    return function () use ($microsecondi, $altre, $finoA) {
        Carbon::setTestNow(Carbon::now()->addMicroseconds($microsecondi));

        return Http::response(lettureDelBackoffice($finoA, $altre));
    };
}

/**
 * Il backoffice che risponde a io.notifiche.letture.crea una chiamata dopo l'altra: alla prima la prima risposta, e così via;
 * finite, ripete l'ultima, così una chiamata in più del previsto ha la sua risposta e si conta. Ogni risposta è una funzione,
 * chiamata quando la richiesta arriva.
 *
 * @param  non-empty-list<Closure(): mixed>  $risposte
 */
function lettureUnaDopoLAltra(array $risposte): void
{
    $chiamate = 0;
    Http::fake(function (Request $richiesta) use (&$chiamate, $risposte) {
        return match (percorsoDi($richiesta)) {
            '/v1/io/notifiche/letture' => $risposte[min($chiamate++, count($risposte) - 1)](),
        };
    });
}

/**
 * Le chiamate arrivate al backoffice, nell'ordine: di ognuna il metodo, il percorso, il corpo e il gettone.
 *
 * @return list<array{string, ?string, array<mixed>, string}>
 */
function chiamateAlBackoffice(): array
{
    return Http::recorded()
        ->map(fn (array $coppia) => [$coppia[0]->method(), percorsoDi($coppia[0]), $coppia[0]->data(), $coppia[0]->header('Authorization')[0] ?? ''])
        ->values()->all();
}

/**
 * Risposte del backoffice alle letture senza `altre`, o con un `altre` che non è un booleano. Per il resto sono risposte
 * intere: il guasto è solo quello. Una riga per caso.
 *
 * @return array<string, array{array<string, mixed>}>
 */
function lettureSenzaUnAltre(): array
{
    $lettura = ['fino_a' => '2026-10-08T10:00:00.123Z', 'segnate' => 3];

    return [
        'senza altre' => [$lettura],
        'altre è null' => [$lettura + ['altre' => null]],
        'altre è 0' => [$lettura + ['altre' => 0]],
        'altre è "false"' => [$lettura + ['altre' => 'false']],
        'altre è 1' => [$lettura + ['altre' => 1]],
        'altre è "true"' => [$lettura + ['altre' => 'true']],
        'altre è una lista vuota' => [$lettura + ['altre' => []]],
    ];
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

it('GET /cornice/notifiche dà la prima pagina delle notifiche del workspace del gettone, nell\'ordine del backoffice, con id, creata_il, letta, app e tipo — e i tre dati del #1670, null se il backoffice non li manda —, e app è quello del backoffice: un prodotto, un codice che zr-core non conosce, o null; e l\'istante della lettura (sprint 5 · T2.1; sprint 6 · T1.1; sprint 11 · T1.1; sprint 12 · T2.1)', function () {
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
        ['id' => 'uat-n3', 'creata_il' => '2026-10-07T09:03:00.123Z', 'letta' => false, 'app' => 'pm', 'tipo' => 'com.zeiras.board.cartella.creata'] + SENZA_CHI_E_COSA,
        ['id' => 'uat-n2', 'creata_il' => '2026-10-07T09:02:00.123Z', 'letta' => true, 'app' => 'uat-ignota', 'tipo' => 'com.zeiras.board.cartella.creata'] + SENZA_CHI_E_COSA,
        ['id' => 'uat-n1', 'creata_il' => '2026-10-07T09:01:00.123Z', 'letta' => false, 'app' => null, 'tipo' => 'com.zeiras.board.cartella.creata'] + SENZA_CHI_E_COSA,
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
    'senza id' => [200, ['data' => ['tipo' => 'com.zeiras.board.cartella.creata', 'app' => 'pm', 'creata_il' => '2026-10-07T09:03:00.123Z', 'letta_il' => '2026-10-07T09:05:00.456Z']]],
    'senza letta_il' => [200, ['data' => ['id' => 'uat-n3', 'tipo' => 'com.zeiras.board.cartella.creata', 'app' => 'pm', 'creata_il' => '2026-10-07T09:03:00.123Z']]],
    'letta_il non è un istante né null' => [200, ['data' => ['id' => 'uat-n3', 'tipo' => 'com.zeiras.board.cartella.creata', 'app' => 'pm', 'creata_il' => '2026-10-07T09:03:00.123Z', 'letta_il' => true]]],
    'senza app (sprint 6 · T1.2)' => [200, ['data' => ['id' => 'uat-n3', 'tipo' => 'com.zeiras.board.cartella.creata', 'creata_il' => '2026-10-07T09:03:00.123Z', 'letta_il' => '2026-10-07T09:05:00.456Z']]],
    'un\'altra notifica' => [200, ['data' => notificaDelBackoffice('uat-n2', '2026-10-07T09:02:00.123Z', '2026-10-07T09:05:00.456Z')]],
]);

it('POST /cornice/notifiche/letture manda al backoffice una sola POST col solo fino_a, lo stesso, e il gettone del workspace, e risponde con l\'istante del backoffice, con altre: false quando il backoffice dice che non ne restano, e con l\'istante in cui le ha segnate (sprint 6 · T2.1; sprint 11 · T1.2; sprint 12 · T4.1)', function (string $finoA, string $delBackoffice) {
    Carbon::setTestNow(Carbon::parse('2026-10-10 01:15:07.000321', 'UTC'));
    $gettoni = sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    // Al gettone dell'accesso io.notifiche.letture.crea risponde 403 gettone_senza_workspace.
    Http::fake(fn (Request $richiesta) => match (percorsoDi($richiesta)) {
        '/v1/io/notifiche/letture' => $richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace'])
            ? Http::response(lettureDelBackoffice($delBackoffice))
            : problemaDelBackoffice(403, 'gettone_senza_workspace'),
    });

    senzaGettone($this->postJson('cornice/notifiche/letture', lettureFinoA($finoA)))
        ->assertOk()->assertExactJson(['data' => ['fino_a' => $delBackoffice, 'altre' => false], 'segnate_il' => '2026-10-10T01:15:07.000321Z']);
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
    'senza data' => [200, lettureDelBackoffice('2026-10-08T10:00:00.000Z')['data']],
    'data vuoto' => [200, ['data' => []]],
    'data è l\'istante, non un oggetto' => [200, ['data' => '2026-10-08T10:00:00.000Z']],
    // Dallo sprint 12 la risposta porta anche `segnate` e `altre`: qui ci sono, e il guasto è solo l'istante.
    'senza fino_a' => [200, ['data' => ['segnate' => 3, 'altre' => false]]],
    'fino_a null' => [200, ['data' => ['fino_a' => null, 'segnate' => 3, 'altre' => false]]],
    'fino_a è un numero' => [200, ['data' => ['fino_a' => 1760000000, 'segnate' => 3, 'altre' => false]]],
    'fino_a è una lista' => [200, ['data' => ['fino_a' => ['2026-10-08T10:00:00.000Z'], 'segnate' => 3, 'altre' => false]]],
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
    senzaGettone($this->postJson('cornice/ricerca', ['q' => 'uat']))->assertUnauthorized();
    Http::assertNothingSent();
});

it('con la sessione ma senza workspace le quattro rotte della cornice rispondono 403 e non chiamano il backoffice (sprint 5 · T2.6; sprint 6 · T2.4)', function () {
    sessioneAMano(null);
    Http::fake();

    foreach ([
        $this->getJson('cornice/notifiche'),
        $this->patchJson('cornice/notifiche/uat-n3/lettura', ['letta' => true]),
        $this->postJson('cornice/notifiche/letture', lettureFinoA('2026-10-08T10:00:00.000Z')),
        $this->postJson('cornice/ricerca', ['q' => 'uat']),
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
    'una notifica senza id' => [200, ['data' => [['tipo' => 'com.zeiras.board.cartella.creata', 'app' => null, 'creata_il' => '2026-10-07T09:01:00.123Z', 'letta_il' => null]], 'successivo' => null]],
    'una notifica senza creata_il' => [200, ['data' => [['id' => 'uat-n1', 'tipo' => 'com.zeiras.board.cartella.creata', 'app' => null, 'letta_il' => null]], 'successivo' => null]],
    'una notifica senza letta_il' => [200, ['data' => [['id' => 'uat-n1', 'tipo' => 'com.zeiras.board.cartella.creata', 'app' => null, 'creata_il' => '2026-10-07T09:01:00.123Z']], 'successivo' => null]],
    // Sprint 6 · T1.2: `app` c'è sempre, una stringa o null. Senza, o di un altro tipo, non è una notifica di /v1: mai `app: null`.
    'una notifica senza app' => [200, ['data' => [['id' => 'uat-n1', 'tipo' => 'com.zeiras.board.cartella.creata', 'creata_il' => '2026-10-07T09:01:00.123Z', 'letta_il' => null]], 'successivo' => null]],
    'app è un numero' => [200, ['data' => [['id' => 'uat-n1', 'tipo' => 'com.zeiras.board.cartella.creata', 'app' => 7, 'creata_il' => '2026-10-07T09:01:00.123Z', 'letta_il' => null]], 'successivo' => null]],
    'app è una lista' => [200, ['data' => [['id' => 'uat-n1', 'tipo' => 'com.zeiras.board.cartella.creata', 'app' => ['pm'], 'creata_il' => '2026-10-07T09:01:00.123Z', 'letta_il' => null]], 'successivo' => null]],
    'app è true' => [200, ['data' => [['id' => 'uat-n1', 'tipo' => 'com.zeiras.board.cartella.creata', 'app' => true, 'creata_il' => '2026-10-07T09:01:00.123Z', 'letta_il' => null]], 'successivo' => null]],
    'la seconda notifica senza app' => [200, ['data' => [notificaDelBackoffice('uat-n2', '2026-10-07T09:02:00.123Z', null), ['id' => 'uat-n1', 'tipo' => 'com.zeiras.board.cartella.creata', 'creata_il' => '2026-10-07T09:01:00.123Z', 'letta_il' => null]], 'successivo' => null]],
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
        'data' => [['id' => 'uat-n1', 'creata_il' => '2026-10-07T09:01:00.123Z', 'letta' => false, 'app' => 'pm', 'tipo' => 'com.zeiras.board.cartella.creata'] + SENZA_CHI_E_COSA],
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
        '/v1/io/notifiche/letture' => treSecondiDopo(lettureDelBackoffice('2026-10-08T10:00:00.123Z')),
    });

    $risposta = senzaGettone($this->postJson('cornice/notifiche/letture', lettureFinoA('2026-10-08T10:00:00.123Z')))->assertOk()->assertExactJson([
        'data' => ['fino_a' => '2026-10-08T10:00:00.123Z', 'altre' => false],
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
    senzaGettone($this->postJson('cornice/ricerca', ['q' => 'uat']))
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

// Sprint 12 · T2 (voce #1463): il tipo di ogni notifica, per il titolo che la cornice le dà.

it('GET /cornice/notifiche dà di ogni notifica anche il tipo, quello del backoffice così com\'è, anche un tipo che zr-core non conosce; soggetto e dati restano nella parte server (sprint 12 · T2.1)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-10 05:20:07.000321', 'UTC'));
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => Http::response(['data' => [
        notificaDelBackoffice('uat-n3', '2026-10-07T09:03:00.123Z', null, 'pm', 'com.zeiras.board.scheda.creata'),
        // Un tipo che /v1 oggi non ha, con le maiuscole e uno spazio: passa com'è, non si traduce e non si abbassa.
        notificaDelBackoffice('uat-n2', '2026-10-07T09:02:00.123Z', '2026-10-07T09:05:00.456Z', 'uat-ignota', 'com.zeiras.UAT.Tipo ignoto.v2'),
        notificaDelBackoffice('uat-n1', '2026-10-07T09:01:00.123Z', null, null, 'com.zeiras.workspace.membro.creato'),
    ], 'successivo' => null])]);

    $risposta = senzaGettone($this->getJson('cornice/notifiche'))->assertOk()->assertExactJson(['data' => [
        ['id' => 'uat-n3', 'creata_il' => '2026-10-07T09:03:00.123Z', 'letta' => false, 'app' => 'pm', 'tipo' => 'com.zeiras.board.scheda.creata'] + SENZA_CHI_E_COSA,
        ['id' => 'uat-n2', 'creata_il' => '2026-10-07T09:02:00.123Z', 'letta' => true, 'app' => 'uat-ignota', 'tipo' => 'com.zeiras.UAT.Tipo ignoto.v2'] + SENZA_CHI_E_COSA,
        ['id' => 'uat-n1', 'creata_il' => '2026-10-07T09:01:00.123Z', 'letta' => false, 'app' => null, 'tipo' => 'com.zeiras.workspace.membro.creato'] + SENZA_CHI_E_COSA,
    ], 'aggiornati_il' => '2026-10-10T05:20:07.000321Z']);

    // Dell'evento esce solo il tipo: né il soggetto né i dati, con la chiave o col valore.
    expect(substr_count((string) $risposta->getContent(), '"tipo"'))->toBe(3)
        ->and(substr_count((string) $risposta->getContent(), '"soggetto"'))->toBe(0)
        ->and(substr_count((string) $risposta->getContent(), '"dati"'))->toBe(0)
        ->and(substr_count((string) $risposta->getContent(), 'uat-cartella'))->toBe(0);
});

it('una notifica del backoffice senza tipo, o con un tipo che non è una stringa, è un guasto dell\'elenco: mai un elenco con una notifica senza tipo, e mai un elenco che la salta (sprint 12 · T2.2)', function (array $notifica) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    // La prima è una notifica di /v1, col suo tipo: il guasto è della seconda.
    Http::fake(['*' => Http::response(['data' => [notificaDelBackoffice('uat-n4', '2026-10-07T09:04:00.123Z', null), $notifica], 'successivo' => null])]);

    $elenco = senzaGettone($this->getJson('cornice/notifiche'));

    expect($elenco->status())->toBeGreaterThanOrEqual(500)->toBeLessThan(600)
        ->and($elenco->json('data'))->toBeNull();
})->with(notificheSenzaUnTipo());

it('una notifica del backoffice senza tipo, o con un tipo che non è una stringa, è un guasto anche nella risposta della lettura di una notifica: mai un 200 (sprint 12 · T2.2)', function (array $notifica) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => Http::response(['data' => $notifica])]);

    $risposta = senzaGettone($this->patchJson('cornice/notifiche/uat-n3/lettura', ['letta' => true]));

    expect($risposta->status())->toBeGreaterThanOrEqual(500)->toBeLessThan(600)
        ->and($risposta->json('data'))->toBeNull();
})->with(notificheSenzaUnTipo());

it('le altre risposte non cambiano: la lettura di una notifica risponde ancora coi soli id e letta, senza il tipo, e l\'elenco porta ancora aggiornati_il (sprint 12 · T2.3)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-10 05:20:07.000321', 'UTC'));
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    $notifica = notificaDelBackoffice('uat-n3', '2026-10-07T09:03:00.123Z', '2026-10-07T09:05:00.456Z', 'pm', 'com.zeiras.board.scheda.modificata');
    Http::fake(fn (Request $richiesta) => match (percorsoDi($richiesta)) {
        '/v1/io/notifiche/uat-n3/lettura' => Http::response(['data' => $notifica]),
        '/v1/io/notifiche' => Http::response(['data' => [$notifica], 'successivo' => null]),
    });

    $lettura = senzaGettone($this->patchJson('cornice/notifiche/uat-n3/lettura', ['letta' => true]))
        ->assertOk()->assertExactJson(['data' => ['id' => 'uat-n3', 'letta' => true]]);
    $elenco = senzaGettone($this->getJson('cornice/notifiche'))->assertOk();

    expect(substr_count((string) $lettura->getContent(), 'tipo'))->toBe(0)
        ->and(substr_count((string) $lettura->getContent(), 'scheda.modificata'))->toBe(0)
        ->and($elenco->json('aggiornati_il'))->toBe('2026-10-10T05:20:07.000321Z')
        ->and(substr_count((string) $elenco->getContent(), '"aggiornati_il"'))->toBe(1);
});

// Sprint 12 · T4 (voce #1461): oltre le 5000 non lette il backoffice dice che ne restano (`altre`), e la parte server lo richiama
// con lo stesso istante finché ne restano, entro due tetti: al più 5 chiamate per una richiesta del browser, e nessuna chiamata
// nuova passati 10 secondi dall'arrivo della richiesta. Fermata da un tetto risponde lo stesso 200, con `altre: true`: non è un
// errore. Nei casi di qui sotto nessun middleware del frontend tiene la richiesta: l'arrivo è anche la partenza della prima chiamata.

/** Una chiamata alle letture come la parte server la fa ogni volta: lo stesso metodo, l'istante chiesto dal browser e nient'altro, il gettone del workspace. */
function chiamataAlleLetture(string $finoA, string $gettone): array
{
    return ['POST', '/v1/io/notifiche/letture', ['fino_a' => $finoA], 'Bearer '.$gettone];
}

it('finché il backoffice dice che ne restano la parte server lo richiama con lo stesso fino_a e il gettone del workspace, e alla fine risponde con l\'istante dell\'ultima risposta, altre: false e l\'istante preso dopo l\'ultima risposta: tre risposte del backoffice, tre chiamate, una richiesta del browser (sprint 12 · T4.1)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-10 01:15:07.000321', 'UTC'));
    $gettoni = sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    // Ogni risposta ci mette tre secondi e porta un istante suo: quello della rotta è dell'ultima, e `segnate_il` viene dopo.
    lettureUnaDopoLAltra([
        lettureDopo(3_000_000, true, '2026-10-08T10:00:00.001Z'),
        lettureDopo(3_000_000, true, '2026-10-08T10:00:00.002Z'),
        lettureDopo(3_000_000, false, '2026-10-08T10:00:00.003Z'),
    ]);

    senzaGettone($this->postJson('cornice/notifiche/letture', lettureFinoA('2026-10-08T12:00:00+02:00')))
        ->assertOk()->assertExactJson(['data' => ['fino_a' => '2026-10-08T10:00:00.003Z', 'altre' => false], 'segnate_il' => '2026-10-10T01:15:16.000321Z']);

    // Tutte uguali: l'istante è quello chiesto dal browser, com'è, a ogni chiamata.
    expect(chiamateAlBackoffice())->toBe(array_fill(0, 3, chiamataAlleLetture('2026-10-08T12:00:00+02:00', $gettoni['workspace'])));
});

it('al più cinque chiamate al backoffice per una richiesta del browser: se ne restano ancora la rotta risponde 200 con altre: true e l\'istante preso dopo la quinta risposta, mai un errore e mai altre: false (sprint 12 · T4.2)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-10 01:15:07.000321', 'UTC'));
    $gettoni = sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    // Il backoffice dice sempre che ne restano, e ogni risposta ci mette un secondo: cinque stanno nei 10 secondi, e le ferma
    // solo il tetto delle chiamate. Una sesta avrebbe la sua risposta, e si conterebbe.
    lettureUnaDopoLAltra([lettureDopo(1_000_000, true)]);

    senzaGettone($this->postJson('cornice/notifiche/letture', lettureFinoA('2026-10-08T10:00:00.123Z')))
        ->assertOk()->assertExactJson(['data' => ['fino_a' => '2026-10-08T10:00:00.123Z', 'altre' => true], 'segnate_il' => '2026-10-10T01:15:12.000321Z']);

    expect(chiamateAlBackoffice())->toBe(array_fill(0, 5, chiamataAlleLetture('2026-10-08T10:00:00.123Z', $gettoni['workspace'])));
});

it('nessuna chiamata nuova passati 10 secondi dall\'arrivo della richiesta: se ne restano ancora la rotta risponde 200 con altre: true, e l\'istante è quello preso dopo l\'ultima risposta arrivata (sprint 12 · T4.2)', function (array $durate, int $chiamate, bool $altre, string $segnateIl) {
    Carbon::setTestNow(Carbon::parse('2026-10-10 01:15:07.000321', 'UTC'));
    $gettoni = sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    // Il backoffice dice che ne restano a ogni risposta che il caso elenca, ognuna con la sua durata; a una chiamata in più
    // direbbe subito che non ne restano.
    lettureUnaDopoLAltra([...array_map(fn (int $microsecondi) => lettureDopo($microsecondi, true), $durate), lettureDopo(0, false)]);

    senzaGettone($this->postJson('cornice/notifiche/letture', lettureFinoA('2026-10-08T10:00:00.123Z')))
        ->assertOk()->assertExactJson(['data' => ['fino_a' => '2026-10-08T10:00:00.123Z', 'altre' => $altre], 'segnate_il' => $segnateIl]);

    expect(chiamateAlBackoffice())->toBe(array_fill(0, $chiamate, chiamataAlleLetture('2026-10-08T10:00:00.123Z', $gettoni['workspace'])));
})->with([
    'la prima risposta arriva dopo 11 secondi: nessun richiamo' => [[11_000_000], 1, true, '2026-10-10T01:15:18.000321Z'],
    'dopo 10 secondi e un microsecondo: nessun richiamo' => [[10_000_001], 1, true, '2026-10-10T01:15:17.000322Z'],
    'a 10 secondi esatti non sono ancora passati: un richiamo, e il backoffice dice che non ne restano' => [[10_000_000], 2, false, '2026-10-10T01:15:17.000321Z'],
    'i 10 secondi non si contano dall\'ultima chiamata: due risposte da 6 secondi, e la terza chiamata non parte' => [[6_000_000, 6_000_000], 2, true, '2026-10-10T01:15:19.000321Z'],
]);

it('una risposta del backoffice senza altre, o con un altre che non è un booleano, è un guasto, alla prima chiamata come a un richiamo: mai «non ne restano», mai un 200, e nessuna chiamata dopo (sprint 12 · T4.3)', function (array $lettura, int $prima) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    // Prima del guasto il backoffice dice che ne restano, tante volte quante il caso vuole; a una chiamata dopo il guasto
    // direbbe che non ne restano, e la rotta risponderebbe 200.
    lettureUnaDopoLAltra([...array_fill(0, $prima, lettureDopo(0, true)), fn () => Http::response(['data' => $lettura]), lettureDopo(0, false)]);

    $risposta = senzaGettone($this->postJson('cornice/notifiche/letture', lettureFinoA('2026-10-08T10:00:00.123Z')));

    expect($risposta->status())->toBeGreaterThanOrEqual(500)->toBeLessThan(600)
        ->and($risposta->json('data'))->toBeNull()
        ->and(substr_count((string) $risposta->getContent(), 'segnate_il'))->toBe(0);
    Http::assertSentCount($prima + 1);
})->with(lettureSenzaUnAltre())->with([
    'alla prima chiamata' => [0],
    'al secondo richiamo' => [2],
]);

it('se un richiamo fallisce la rotta risponde con un errore, come quando fallisce la prima chiamata: mai un 200, nessun istante, e nessuna chiamata dopo (sprint 12 · T4.4)', function (int $stato, ?string $codice) {
    Carbon::setTestNow(Carbon::parse('2026-10-10 01:15:07.000321', 'UTC'));
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    // La prima chiamata riesce e dice che ne restano; il richiamo fallisce; una terza chiamata riuscirebbe, e direbbe che non
    // ne restano.
    lettureUnaDopoLAltra([
        lettureDopo(0, true),
        fn () => $codice === null ? Http::response('', $stato) : problemaDelBackoffice($stato, $codice),
        lettureDopo(0, false),
    ]);

    $risposta = senzaGettone($this->postJson('cornice/notifiche/letture', lettureFinoA('2026-10-08T10:00:00.123Z')));

    // Un errore della parte server (5xx), come quando fallisce la prima chiamata: mai un 4xx con un `errore` per il browser.
    expect($risposta->status())->toBeGreaterThanOrEqual(500)->toBeLessThan(600)
        ->and($risposta->json('errore'))->toBeNull()
        ->and($risposta->json('data'))->toBeNull()
        ->and(substr_count((string) $risposta->getContent(), 'segnate_il'))->toBe(0);
    Http::assertSentCount(2);
})->with([
    'un 500' => [500, null],
    'un 503' => [503, null],
    'un 429 troppe_richieste' => [429, 'troppe_richieste'],
    'un 422 con un altro codice' => [422, 'uat_altro_codice'],
]);

it('un richiamo che il backoffice rifiuta con 422 dati_non_validi risponde 422 dati_non_validi, come alla prima chiamata, e non ne parte un altro (sprint 12 · T4.4)', function () {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    lettureUnaDopoLAltra([lettureDopo(0, true), fn () => problemaDelBackoffice(422, 'dati_non_validi'), lettureDopo(0, false)]);

    senzaGettone($this->postJson('cornice/notifiche/letture', lettureFinoA('2026-10-08T10:00:00.123Z')))
        ->assertStatus(422)->assertExactJson(['errore' => 'dati_non_validi']);
    Http::assertSentCount(2);
});

it('la guardia del workspace e le due validazioni stanno prima di ogni chiamata anche quando il backoffice direbbe che ne restano: nessuna chiamata parte (sprint 12 · T4, guardia)', function (array $corpo, int $stato, string $errore) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    lettureUnaDopoLAltra([lettureDopo(0, true)]);

    senzaGettone($this->postJson('cornice/notifiche/letture', $corpo))->assertStatus($stato)->assertExactJson(['errore' => $errore]);
    Http::assertNothingSent();
})->with([
    'un altro workspace' => [['fino_a' => '2026-10-08T10:00:00.123Z', 'workspace' => 'uat-vendite'], 409, 'workspace_diverso'],
    'un fino_a che non è un istante' => [['fino_a' => 'ieri', 'workspace' => 'uat-marketing'], 422, 'dati_non_validi'],
    'senza workspace' => [['fino_a' => '2026-10-08T10:00:00.123Z'], 422, 'dati_non_validi'],
]);

// Sprint 16 · T4 (voce #1558): «Segna tutte come lette» tiene il blocco della sessione. La rotta può durare una quindicina di
// secondi, e in Laravel una richiesta, finendo, riscrive la sessione com'era quando è partita: se intanto la persona esce o
// entra in un workspace da un'altra scheda, tornerebbe la sessione di prima. Col blocco (`Route::block`) le due richieste non
// si sovrappongono: la seconda aspetta la prima, e oltre l'attesa di zr-auth risponde 503. Una richiesta della stessa
// sessione ancora in volo si simula tenendo il lock `session:<id>` che Laravel prende, come nei test di zr-auth; qui il tempo
// è fermo, e l'attesa del lock porta avanti l'orologio invece di dormire.

/** L'id di una sessione com'è fatto per Laravel: 40 fra lettere e cifre. */
function idDiSessione(): string
{
    return Str::random(40);
}

/** Il lock che Laravel prende per la sessione con quell'id (`Route::block`), nello store dei lock della sessione. */
function lockDellaSessione(string $sessione, int $secondi): Lock
{
    return Cache::store(config('session.block_store'))->lock('session:'.$sessione, $secondi);
}

/** Se il lock di quella sessione è libero adesso: lo prende, e se ci riesce lo lascia subito. */
function lockLibero(string $sessione): bool
{
    $lock = lockDellaSessione($sessione, 1);
    $libero = (bool) $lock->get();
    if ($libero) {
        $lock->release();
    }

    return $libero;
}

/**
 * POST /cornice/notifiche/letture dalla sessione con quell'id: il cookie della sessione arriva alla rotta, come dal browser
 * (una richiesta JSON dei test non manda i cookie, se non glielo si chiede).
 *
 * @param  array<string, mixed>  $corpo
 */
function lettureDallaSessione(string $sessione, array $corpo): TestResponse
{
    return test()->withCredentials()->withCookie(config('session.cookie'), $sessione)->postJson('cornice/notifiche/letture', $corpo);
}

it('mentre POST /cornice/notifiche/letture chiama il backoffice il lock della sessione è preso, a ogni chiamata, e a risposta data è libero (sprint 16 · T4.1)', function (array $risposte, int $daStato, int $aStato) {
    Carbon::setTestNow(Carbon::parse('2026-10-10 01:15:07.000321', 'UTC'));
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    $sessione = idDiSessione();
    // A ogni chiamata che arriva al backoffice: il lock della sessione è libero? Mai, se la rotta tiene il blocco.
    $liberoDurante = [];
    Http::fake(function () use (&$liberoDurante, $risposte, $sessione) {
        $liberoDurante[] = lockLibero($sessione);

        return match ($risposta = $risposte[min(count($liberoDurante), count($risposte)) - 1]) {
            true, false => Http::response(lettureDelBackoffice('2026-10-08T10:00:00.123Z', $risposta)),
            422 => problemaDelBackoffice(422, 'dati_non_validi'),
            default => Http::response('', $risposta),
        };
    });
    expect(lockLibero($sessione))->toBe(true);

    $risposta = senzaGettone(lettureDallaSessione($sessione, lettureFinoA('2026-10-08T10:00:00.123Z')));

    expect($risposta->status())->toBeGreaterThanOrEqual($daStato)->toBeLessThanOrEqual($aStato)
        ->and($liberoDurante)->toBe(array_fill(0, count($risposte), false))
        ->and(lockLibero($sessione))->toBe(true);
})->with([
    'una chiamata, e non ne restano' => [[false], 200, 200],
    'tre chiamate: due richiami' => [[true, true, false], 200, 200],
    'il backoffice risponde con un errore' => [[500], 500, 599],
    'un richiamo fallisce' => [[true, 503], 500, 599],
    'il backoffice rifiuta l\'istante' => [[422], 422, 422],
]);

it('quando POST /cornice/notifiche/letture risponde 422 o 409 senza chiamare il backoffice, a risposta data il lock della sessione è libero (sprint 16 · T4.1)', function (array $corpo, int $stato) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    $sessione = idDiSessione();
    Http::fake();

    senzaGettone(lettureDallaSessione($sessione, $corpo))->assertStatus($stato);

    Http::assertNothingSent();
    expect(lockLibero($sessione))->toBe(true);

    // Il controllo nei due versi: un lock rimasto preso si vede.
    $rimasto = lockDellaSessione($sessione, 60);
    expect($rimasto->get())->toBe(true)
        ->and(lockLibero($sessione))->toBe(false);
    $rimasto->release();
})->with([
    'un fino_a che non è un istante' => [['fino_a' => 'ieri', 'workspace' => 'uat-marketing'], 422],
    'un altro workspace' => [['fino_a' => '2026-10-08T10:00:00.123Z', 'workspace' => 'uat-vendite'], 409],
]);

it('il lock della sessione dura più di quanto POST /cornice/notifiche/letture può durare: la tenuta è almeno i secondi dei richiami più quelli che zr-auth aspetta una risposta più uno, e segue quel tempo senza scendere mai sotto i 15 secondi; l\'attesa è quella di zr-auth (sprint 16 · T4.2; review, R5 e R11)', function (?int $delFrontend, int $tenuta) {
    if ($delFrontend !== null) {
        // Un frontend che ha cambiato il tempo che zr-auth aspetta il backoffice: le rotte si registrano con la sua configurazione.
        config(['zr-auth.timeout' => $delFrontend]);
        require __DIR__.'/../../routes/cornice.php';
    }
    $rotta = Route::getRoutes()->match(RichiestaDelBrowser::create('/cornice/notifiche/letture', 'POST'));
    // Passati questi secondi dall'arrivo della richiesta non parte un'altra chiamata; quella già partita finisce, entro il tempo di zr-auth.
    $richiami = (new ReflectionClassConstant(NotificheDellaCornice::class, 'SECONDI'))->getValue();
    $aspetta = (int) config('zr-auth.timeout');

    expect($rotta->uri())->toBe('cornice/notifiche/letture')
        ->and($aspetta)->toBe($delFrontend ?? 5)
        ->and($rotta->locksFor())->toBeInt()->toBeGreaterThanOrEqual($richiami + $aspetta + 1)
        // Il numero è scritto qui: confrontare la rotta con la funzione che la rotta stessa usa non proverebbe niente.
        ->and($rotta->locksFor())->toBe($tenuta)
        ->and(NotificheDellaCornice::tenutaDelBlocco())->toBe($tenuta)
        // Non i 10 secondi di `->bloccaSessione()`: la rotta può durarne di più.
        ->and($rotta->locksFor())->toBeGreaterThan(Sessione::BLOCCO_TENUTA)
        ->and($rotta->waitsFor())->toBe(Sessione::BLOCCO_ATTESA);
})->with([
    'col tempo di partenza di zr-auth, 5 secondi: 10 + 5 + 5' => [null, 20],
    'con un frontend che lo ha portato a 12: 10 + 12 + 5' => [12, 27],
    // Sotto lo zero il tempo non conta: una tenuta negativa, su Redis, sarebbe un lock senza scadenza.
    'con un tempo a 0: 10 + 0 + 5' => [0, 15],
    'con un tempo negativo: mai meno di 15' => [-20, 15],
]);

it('con un backoffice lento il lock della sessione è ancora preso quando arriva l\'ultima risposta, a quasi 15 secondi dalla partenza: i 10 dei richiami più i 5 che zr-auth aspetta (sprint 16 · T4.2)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-10 01:15:07.000321', 'UTC'));
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    $sessione = idDiSessione();
    $liberoAllaFine = null;
    // La prima chiamata risponde dopo 9,9 secondi e dice che ne restano: parte un richiamo, che risponde dopo altri 4,9.
    lettureUnaDopoLAltra([
        lettureDopo(9_900_000, true),
        function () use (&$liberoAllaFine, $sessione) {
            Carbon::setTestNow(Carbon::now()->addMicroseconds(4_900_000));
            $liberoAllaFine = lockLibero($sessione);

            return Http::response(lettureDelBackoffice('2026-10-08T10:00:00.123Z'));
        },
    ]);

    senzaGettone(lettureDallaSessione($sessione, lettureFinoA('2026-10-08T10:00:00.123Z')))->assertOk();

    Http::assertSentCount(2);
    // Con una tenuta di 10 secondi il lock sarebbe scaduto da quasi 5, e un'uscita da un'altra scheda lo prenderebbe.
    expect($liberoAllaFine)->toBe(false);
});

// Sprint 16 · review, R2: il lock della sessione si prende nel gruppo `web`, prima dei middleware che il frontend ci ha messo, e
// scade a tenuta finita qualunque cosa sia successa prima della rotta. I 10 secondi dei richiami si contano quindi dall'arrivo
// della richiesta, non dall'ingresso nella rotta: ciò che un middleware del frontend fa prima — una `Cornice::dati()` con un
// backoffice lento — sta dentro la tenuta, e una richiesta arrivata alla rotta oltre quei secondi non chiama il backoffice.

/**
 * Un middleware che il frontend ha nel gruppo `web`, dopo la sessione: prima di passare la richiesta ci mette un po' — qui porta
 * avanti l'orologio — e segna se in quel momento il lock della sessione della richiesta è libero.
 */
final class MiddlewareLentoDelFrontend
{
    public static int $secondi = 0;

    /** @var list<bool> */
    public static array $lockLibero = [];

    public function handle(RichiestaDelBrowser $richiesta, Closure $next): mixed
    {
        self::$lockLibero[] = lockLibero($richiesta->session()->getId());
        Carbon::setTestNow(Carbon::now()->addSeconds(self::$secondi));

        return $next($richiesta);
    }
}

/** Il frontend dei test con quel middleware in coda al gruppo `web`: ci mette tanti secondi a ogni richiesta. */
function frontendColMiddlewareLento(int $secondi): void
{
    MiddlewareLentoDelFrontend::$secondi = $secondi;
    MiddlewareLentoDelFrontend::$lockLibero = [];
    app(Kernel::class)->appendMiddlewareToGroup('web', MiddlewareLentoDelFrontend::class);
}

it('i 10 secondi dei richiami si contano dall\'arrivo della richiesta, non dall\'ingresso nella rotta: dopo i 6 di un middleware del frontend, che gira col lock della sessione già preso, e una chiamata da 9,9, non parte un richiamo, e all\'ultima risposta del backoffice il lock è ancora preso (sprint 16 · review, R2)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-10 01:15:07.000321', 'UTC'));
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    $sessione = idDiSessione();
    frontendColMiddlewareLento(6);
    // A ogni risposta del backoffice: il lock della sessione è libero? La tenuta è di 20 secondi dalla presa.
    $liberoAOgniRisposta = [];
    $dopo = function (int $microsecondi, bool $altre) use (&$liberoAOgniRisposta, $sessione): Closure {
        return function () use (&$liberoAOgniRisposta, $sessione, $microsecondi, $altre) {
            Carbon::setTestNow(Carbon::now()->addMicroseconds($microsecondi));
            $liberoAOgniRisposta[] = lockLibero($sessione);

            return Http::response(lettureDelBackoffice('2026-10-08T10:00:00.123Z', $altre));
        };
    };
    // La prima chiamata risponde a 15,9 secondi dall'arrivo e dice che ne restano; un richiamo risponderebbe a 20,8, a lock scaduto.
    lettureUnaDopoLAltra([$dopo(9_900_000, true), $dopo(4_900_000, false)]);

    $risposta = senzaGettone(lettureDallaSessione($sessione, lettureFinoA('2026-10-08T10:00:00.123Z')))->assertOk();

    // Mentre il middleware del frontend girava il lock era già preso: i suoi 6 secondi stanno dentro la tenuta.
    expect(MiddlewareLentoDelFrontend::$lockLibero)->toBe([false])
        ->and($liberoAOgniRisposta)->toBe([false])
        // Un tetto ha fermato i richiami, e ne restano: la stessa richiesta, ripetuta, continua da lì.
        ->and($risposta->json('data.altre'))->toBe(true);
    Http::assertSentCount(1);
});

it('arrivata alla rotta passati 10 secondi dall\'arrivo della richiesta, POST /cornice/notifiche/letture non chiama il backoffice e risponde 503 fuori_tempo con Retry-After: 1; a 10 secondi esatti chiama ancora; a risposta data il lock della sessione è libero (sprint 16 · review, R2)', function (int $delMiddleware, int $stato, ?string $errore, ?string $riprova, int $chiamate) {
    Carbon::setTestNow(Carbon::parse('2026-10-10 01:15:07.000321', 'UTC'));
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    $sessione = idDiSessione();
    frontendColMiddlewareLento($delMiddleware);
    lettureUnaDopoLAltra([lettureDopo(0, false)]);

    $risposta = senzaGettone(lettureDallaSessione($sessione, lettureFinoA('2026-10-08T10:00:00.123Z')));

    expect($risposta->status())->toBe($stato)
        ->and($risposta->json('errore'))->toBe($errore)
        ->and($risposta->headers->get('Retry-After'))->toBe($riprova)
        ->and(lockLibero($sessione))->toBe(true);
    if ($stato === 503) {
        // Il corpo intero: l'errore e nient'altro.
        $risposta->assertExactJson(['errore' => 'fuori_tempo']);
    }
    Http::assertSentCount($chiamate);
})->with([
    'a 10 secondi esatti chiama ancora' => [10, 200, null, null, 1],
    'a 11 secondi non chiama più' => [11, 503, 'fuori_tempo', '1', 0],
]);

it('in ritardo, una richiesta sbagliata riceve il suo 422 o il suo 409, non il 503: le guardie del corpo vengono prima del tempo (sprint 16 · review, R2)', function (array $corpo, int $stato) {
    Carbon::setTestNow(Carbon::parse('2026-10-10 01:15:07.000321', 'UTC'));
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    frontendColMiddlewareLento(11);
    Http::fake();

    senzaGettone(lettureDallaSessione(idDiSessione(), $corpo))->assertStatus($stato);

    Http::assertNothingSent();
})->with([
    'un fino_a che non è un istante' => [['fino_a' => 'ieri', 'workspace' => 'uat-marketing'], 422],
    'un altro workspace' => [['fino_a' => '2026-10-08T10:00:00.123Z', 'workspace' => 'uat-vendite'], 409],
]);

it('la rotta legge dal kernel quando la richiesta è arrivata, e non lo sposta: chi misura quanto è durata la richiesta la vede partire dall\'istante giusto (sprint 16 · review, R2)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-10 01:15:07.000321', 'UTC'));
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    lettureUnaDopoLAltra([lettureDopo(2_000_000, false)]);
    // Un frontend che guarda le richieste più lunghe di un secondo: il kernel gli dà l'istante in cui la richiesta è arrivata.
    $arrivo = null;
    app(Kernel::class)->whenRequestLifecycleIsLongerThan(1000, function ($inizio) use (&$arrivo) {
        $arrivo = $inizio->format('Y-m-d H:i:s.u');
    });

    senzaGettone(lettureDallaSessione(idDiSessione(), lettureFinoA('2026-10-08T10:00:00.123Z')))->assertOk();

    // Non 10 secondi dopo: l'istante del kernel è del kernel, e la rotta ne usa una copia.
    expect($arrivo)->toBe('2026-10-10 01:15:07.000321');
});

// Sprint 16 · seconda lettura, N4: senza un kernel che dica quando la richiesta è arrivata — non c'è, non è quello di Laravel, non
// ha ancora un istante, o ne ha uno nel futuro — i 10 secondi si contano da adesso: la rotta risponde, non lancia.

/** Un middleware che il frontend ha in coda al gruppo `web`: prima di passare la richiesta fa ciò che il caso gli dà. */
final class PrimaDellaRotta
{
    public static ?Closure $fa = null;

    public function handle(RichiestaDelBrowser $richiesta, Closure $next): mixed
    {
        (self::$fa)();

        return $next($richiesta);
    }
}

/** Il frontend dei test con quel middleware in coda al gruppo `web`. */
function frontendChePrimaDellaRottaFa(Closure $fa): void
{
    PrimaDellaRotta::$fa = $fa;
    app(Kernel::class)->appendMiddlewareToGroup('web', PrimaDellaRotta::class);
}

it('senza un istante del kernel da cui contare, POST /cornice/notifiche/letture conta i suoi 10 secondi da adesso: chiama il backoffice e risponde 200, mai un 500 e mai un 503 (sprint 16 · seconda lettura, N4)', function (string $caso) {
    Carbon::setTestNow(Carbon::parse('2026-10-10 01:15:07.000321', 'UTC'));
    $gettoni = sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    // Dopo la sessione e prima della rotta, nel container al posto del kernel di questa richiesta c'è altro, o niente.
    frontendChePrimaDellaRottaFa(match ($caso) {
        'nel container il kernel non c\'è' => fn () => app()->offsetUnset(Kernel::class),
        'il kernel non è quello di Laravel' => fn () => app()->instance(Kernel::class, new stdClass),
        'un kernel di Laravel che non ha ancora un istante' => fn () => app()->instance(Kernel::class, (new ReflectionClass(Illuminate\Foundation\Http\Kernel::class))->newInstanceWithoutConstructor()),
    });
    lettureUnaDopoLAltra([lettureDopo(0, false)]);

    senzaGettone(lettureDallaSessione(idDiSessione(), lettureFinoA('2026-10-08T10:00:00.123Z')))
        ->assertOk()->assertExactJson(['data' => ['fino_a' => '2026-10-08T10:00:00.123Z', 'altre' => false], 'segnate_il' => '2026-10-10T01:15:07.000321Z']);

    expect(chiamateAlBackoffice())->toBe([chiamataAlleLetture('2026-10-08T10:00:00.123Z', $gettoni['workspace'])]);
})->with(['nel container il kernel non c\'è', 'il kernel non è quello di Laravel', 'un kernel di Laravel che non ha ancora un istante']);

it('con un istante del kernel nel futuro — l\'orologio del server è tornato indietro — POST /cornice/notifiche/letture conta i suoi 10 secondi da adesso, non da quell\'istante: dopo una risposta da 11 secondi non parte un richiamo (sprint 16 · seconda lettura, N4)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-10 01:15:07.000321', 'UTC'));
    $gettoni = sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    // Dopo l'arrivo della richiesta l'orologio torna indietro di 30 secondi: per la rotta l'istante del kernel è nel futuro.
    frontendChePrimaDellaRottaFa(fn () => Carbon::setTestNow(Carbon::now()->subSeconds(30)));
    // Il backoffice risponde dopo 11 secondi e dice che ne restano: contando dall'istante del kernel un richiamo partirebbe
    // ancora, e ne avrebbe per altri 29 secondi.
    lettureUnaDopoLAltra([lettureDopo(11_000_000, true), lettureDopo(0, false)]);

    senzaGettone(lettureDallaSessione(idDiSessione(), lettureFinoA('2026-10-08T10:00:00.123Z')))
        ->assertOk()->assertExactJson(['data' => ['fino_a' => '2026-10-08T10:00:00.123Z', 'altre' => true], 'segnate_il' => '2026-10-10T01:14:48.000321Z']);

    expect(chiamateAlBackoffice())->toBe([chiamataAlleLetture('2026-10-08T10:00:00.123Z', $gettoni['workspace'])]);
});

// Sprint 16 · review, R5: per il client di zr-auth un tempo di 0 è «senza limite», e ogni valore che `(int)` porta sotto 1 lo
// diventa. Una chiamata senza un tetto può durare più di qualunque lock: la rotta non chiama, ed è un errore di configurazione.
it('con uno zr-auth.timeout che per il client vuol dire «senza limite», POST /cornice/notifiche/letture non chiama il backoffice ed è un errore (500); a risposta data il lock della sessione è libero (sprint 16 · review, R5)', function (mixed $tempo) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    $sessione = idDiSessione();
    config(['zr-auth.timeout' => $tempo]);
    lettureUnaDopoLAltra([lettureDopo(0, false)]);

    $risposta = senzaGettone(lettureDallaSessione($sessione, lettureFinoA('2026-10-08T10:00:00.123Z')));

    expect($risposta->status())->toBe(500)
        ->and(lockLibero($sessione))->toBe(true);
    Http::assertNothingSent();
})->with([
    'zero' => [0],
    'null' => [null],
    'un testo vuoto' => [''],
    'un testo che non è un numero' => ['presto'],
    'un numero negativo' => [-3],
    'mezzo secondo' => [0.5],
]);

it('se il lock della sessione è di un\'altra richiesta per più dell\'attesa di zr-auth, POST /cornice/notifiche/letture risponde 503 con Retry-After: 1 e non chiama il backoffice, qualunque corpo abbia: il lock si prende prima delle guardie (sprint 16 · T4.3)', function (array $corpo) {
    $partenza = Carbon::parse('2026-10-10 01:15:07.000321', 'UTC');
    Carbon::setTestNow($partenza->copy());
    // L'attesa del lock dorme a pezzi: qui il sonno è finto, e porta avanti l'orologio.
    Sleep::fake(true, true);
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    $sessione = idDiSessione();
    Http::fake();
    // Un'altra richiesta della stessa sessione, ancora in volo: tiene il lock per un minuto.
    $altra = lockDellaSessione($sessione, 60);
    expect($altra->get())->toBe(true);

    $risposta = senzaGettone(lettureDallaSessione($sessione, $corpo));
    $aspettati = Carbon::now()->getTimestampMs() - $partenza->getTimestampMs();

    expect($risposta->status())->toBe(503)
        ->and($risposta->headers->get('Retry-After'))->toBe('1')
        // I 3 secondi di zr-auth, non i 10 che Laravel aspetta se non glielo si dice.
        ->and($aspettati)->toBeGreaterThanOrEqual(2500)->toBeLessThanOrEqual(1000 * Sessione::BLOCCO_ATTESA)
        // Non ha proseguito senza il blocco, e non ha tolto il lock all'altra.
        ->and(lockLibero($sessione))->toBe(false);
    Http::assertNothingSent();
    $altra->release();
})->with([
    'una richiesta giusta' => [['fino_a' => '2026-10-08T10:00:00.123Z', 'workspace' => 'uat-marketing']],
    'un fino_a che non è un istante: senza il blocco sarebbe un 422' => [['fino_a' => 'ieri', 'workspace' => 'uat-marketing']],
    'un altro workspace: senza il blocco sarebbe un 409' => [['fino_a' => '2026-10-08T10:00:00.123Z', 'workspace' => 'uat-vendite']],
]);

it('delle rotte della cornice solo POST /cornice/notifiche/letture tiene il blocco della sessione: l\'elenco, la lettura di una notifica e la ricerca no, o due richieste della stessa persona si metterebbero in fila (sprint 16 · T4.4)', function () {
    $colBlocco = fn () => array_values(array_map(
        fn ($rotta) => implode('|', array_diff($rotta->methods(), ['HEAD'])).' '.$rotta->uri(),
        array_filter(Route::getRoutes()->getRoutes(), fn ($rotta) => str_starts_with($rotta->uri(), 'cornice/') && $rotta->locksFor() !== null),
    ));

    expect($colBlocco())->toBe(['POST cornice/notifiche/letture']);

    // Il controllo nei due versi: una GET della cornice col blocco la nomina.
    Route::middleware('web')->get('cornice/uat-in-fila', fn () => 'in fila')->block(5, 1);
    expect($colBlocco())->toBe(['POST cornice/notifiche/letture', 'GET cornice/uat-in-fila']);
});

// Sprint 20 · T1 (voce #1674): chi ha fatto, su che cosa, e per chi. Dal #1670 di zr-backoffice ogni notifica di /v1 porta
// `autore` (`{nome}` o null), `risorsa_nome` (un testo o null) e `per_me` (un booleano o null: null finché il backoffice non
// conosce il destinatario diretto). Al browser la parte server dà tre chiavi in più: `autore_nome`, `risorsa_nome`, `per_me`. Di
// `autore` passa solo il nome. Una chiave che manca è il backoffice di prima, e vale null; una chiave con una forma che il
// contratto non ammette è un guasto, come una notifica senza `id`.

/**
 * Una notifica di /v1 non letta coi tre dati del #1670.
 *
 * @return array<string, mixed>
 */
function notificaConChiECosa(string $id, mixed $autore, mixed $risorsaNome, mixed $perMe): array
{
    return notificaDelBackoffice($id, '2026-10-07T09:03:00.123Z', null) + ['autore' => $autore, 'risorsa_nome' => $risorsaNome, 'per_me' => $perMe];
}

/**
 * Notifiche di /v1 in cui una delle tre chiavi ha una forma che il contratto non ammette. Per il resto sono notifiche intere: il
 * guasto è solo quello. Una riga per forma, per l'elenco e per la lettura di una notifica.
 *
 * @return array<string, array{array<string, mixed>}>
 */
function notificheColChiECosaSbagliato(): array
{
    $notifica = notificaConChiECosa('uat-n3', ['nome' => 'UAT Bruno'], 'UAT Clienti', true);

    return [
        'autore è un testo' => [['autore' => 'UAT Bruno'] + $notifica],
        'autore è un numero' => [['autore' => 7] + $notifica],
        'autore è true' => [['autore' => true] + $notifica],
        'autore è false' => [['autore' => false] + $notifica],
        'autore è una lista' => [['autore' => ['UAT Bruno']] + $notifica],
        'autore è un oggetto vuoto' => [['autore' => []] + $notifica],
        'autore è un oggetto senza nome' => [['autore' => ['email' => 'uat-ada@example.com']] + $notifica],
        'il nome di autore è null' => [['autore' => ['nome' => null]] + $notifica],
        'il nome di autore è un numero' => [['autore' => ['nome' => 7]] + $notifica],
        'il nome di autore è una lista' => [['autore' => ['nome' => ['UAT Bruno']]] + $notifica],
        'risorsa_nome è un numero' => [['risorsa_nome' => 7] + $notifica],
        'risorsa_nome è true' => [['risorsa_nome' => true] + $notifica],
        'risorsa_nome è una lista' => [['risorsa_nome' => ['UAT Clienti']] + $notifica],
        'risorsa_nome è un oggetto' => [['risorsa_nome' => ['nome' => 'UAT Clienti']] + $notifica],
        'per_me è un testo' => [['per_me' => 'true'] + $notifica],
        'per_me è 1' => [['per_me' => 1] + $notifica],
        'per_me è 0' => [['per_me' => 0] + $notifica],
        'per_me è una lista' => [['per_me' => [true]] + $notifica],
    ];
}

it('GET /cornice/notifiche dà di ogni notifica otto chiavi: le cinque di prima più autore_nome, risorsa_nome e per_me, coi valori del backoffice; di autore passa solo il nome, e una notifica del backoffice di prima le ha tutte e tre null (sprint 20 · T1.5)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-11 06:40:07.000321', 'UTC'));
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => Http::response(['data' => [
        notificaConChiECosa('uat-n5', ['nome' => 'UAT Bruno'], 'UAT Clienti', true),
        notificaConChiECosa('uat-n4', ['nome' => 'UAT Marta Rossi'], null, false),
        notificaConChiECosa('uat-n3', null, 'UAT Lancio Q4', null),
        // Una chiave in più dentro `autore`, che il contratto oggi non ha: non arriva al browser, né la chiave né il valore.
        notificaConChiECosa('uat-n2', ['nome' => 'UAT Ada', 'email' => 'uat-ada@example.com', 'id' => 'uat-persona-7'], 'pm', null),
        // Il backoffice di prima del #1670: nessuna delle tre.
        notificaDelBackoffice('uat-n1', '2026-10-07T09:01:00.123Z', null),
    ], 'successivo' => null])]);

    $diPrima = ['creata_il' => '2026-10-07T09:03:00.123Z', 'letta' => false, 'app' => 'pm', 'tipo' => 'com.zeiras.board.cartella.creata'];
    $risposta = senzaGettone($this->getJson('cornice/notifiche'))->assertOk()->assertExactJson(['data' => [
        ['id' => 'uat-n5'] + $diPrima + ['autore_nome' => 'UAT Bruno', 'risorsa_nome' => 'UAT Clienti', 'per_me' => true],
        ['id' => 'uat-n4'] + $diPrima + ['autore_nome' => 'UAT Marta Rossi', 'risorsa_nome' => null, 'per_me' => false],
        ['id' => 'uat-n3'] + $diPrima + ['autore_nome' => null, 'risorsa_nome' => 'UAT Lancio Q4', 'per_me' => null],
        ['id' => 'uat-n2'] + $diPrima + ['autore_nome' => 'UAT Ada', 'risorsa_nome' => 'pm', 'per_me' => null],
        ['id' => 'uat-n1', 'creata_il' => '2026-10-07T09:01:00.123Z'] + $diPrima + ['autore_nome' => null, 'risorsa_nome' => null, 'per_me' => null],
    ], 'aggiornati_il' => '2026-10-11T06:40:07.000321Z']);

    // Le stesse otto chiavi per ogni notifica, anche quando valgono null: mai una chiave in meno, mai `autore` com'è.
    foreach ($risposta->json('data') as $notifica) {
        expect(array_keys($notifica))->toBe(['id', 'creata_il', 'letta', 'app', 'tipo', 'autore_nome', 'risorsa_nome', 'per_me']);
    }
    // `false` e null non sono la stessa cosa: «non è per te» e «non si sa».
    expect($risposta->json('data.1.per_me'))->toBeFalse()->and($risposta->json('data.2.per_me'))->toBeNull();
    $corpo = (string) $risposta->getContent();
    expect(substr_count($corpo, '"autore"'))->toBe(0)
        ->and(substr_count($corpo, 'email'))->toBe(0)
        ->and(substr_count($corpo, 'example.com'))->toBe(0)
        ->and(substr_count($corpo, 'uat-persona-7'))->toBe(0)
        ->and(substr_count($corpo, '"soggetto"'))->toBe(0)
        ->and(substr_count($corpo, '"dati"'))->toBe(0)
        ->and(substr_count($corpo, 'uat-cartella'))->toBe(0);
});

it('una notifica a cui manca una sola delle tre chiavi non è un guasto: quella vale null e le altre due passano (sprint 20 · T1.5)', function (string $manca, string $nelBrowser) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    $notifica = array_diff_key(notificaConChiECosa('uat-n3', ['nome' => 'UAT Bruno'], 'UAT Clienti', false), [$manca => true]);
    Http::fake(['*' => Http::response(['data' => [$notifica], 'successivo' => null])]);

    $attesa = ['autore_nome' => 'UAT Bruno', 'risorsa_nome' => 'UAT Clienti', 'per_me' => false];
    $attesa[$nelBrowser] = null;
    $risposta = senzaGettone($this->getJson('cornice/notifiche'))->assertOk();

    expect($risposta->json('data.0'))->toBe([
        'id' => 'uat-n3', 'creata_il' => '2026-10-07T09:03:00.123Z', 'letta' => false, 'app' => 'pm', 'tipo' => 'com.zeiras.board.cartella.creata',
    ] + $attesa);
})->with([
    'senza autore' => ['autore', 'autore_nome'],
    'senza risorsa_nome' => ['risorsa_nome', 'risorsa_nome'],
    'senza per_me' => ['per_me', 'per_me'],
]);

it('una delle tre chiavi con una forma che il contratto non ammette è un guasto dell\'elenco: mai un 200 che la toglie in silenzio, mai un numero o un oggetto al posto di un testo (sprint 20 · T1.6)', function (array $notifica) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    // La prima è una notifica intera, coi tre dati: il guasto è della seconda.
    Http::fake(['*' => Http::response(['data' => [notificaConChiECosa('uat-n4', ['nome' => 'UAT Marta'], 'UAT Lancio Q4', false), $notifica], 'successivo' => null])]);

    $elenco = senzaGettone($this->getJson('cornice/notifiche'));

    expect($elenco->status())->toBeGreaterThanOrEqual(500)->toBeLessThan(600)
        ->and($elenco->json('data'))->toBeNull();
})->with(notificheColChiECosaSbagliato());

it('una delle tre chiavi con una forma che il contratto non ammette è un guasto anche nella risposta della lettura di una notifica: mai un 200 (sprint 20 · T1.6)', function (array $notifica) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => Http::response(['data' => $notifica])]);

    $risposta = senzaGettone($this->patchJson('cornice/notifiche/uat-n3/lettura', ['letta' => false]));

    expect($risposta->status())->toBeGreaterThanOrEqual(500)->toBeLessThan(600)
        ->and($risposta->json('data'))->toBeNull();
})->with(notificheColChiECosaSbagliato());

it('il guasto di una delle tre chiavi è quello di una notifica senza id: la stessa risposta, stato e corpo (sprint 20 · T1.6)', function () {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    $casi = [
        'senza id' => array_diff_key(notificaConChiECosa('uat-n3', null, null, null), ['id' => true]),
        'per_me è un testo' => notificaConChiECosa('uat-n3', null, null, 'true'),
        'autore senza nome' => notificaConChiECosa('uat-n3', ['email' => 'uat-ada@example.com'], null, null),
        'risorsa_nome è un numero' => notificaConChiECosa('uat-n3', null, 7, null),
    ];
    // Una risposta del backoffice per caso, in fila.
    $inFila = Http::sequence();
    foreach ($casi as $notifica) {
        $inFila->push(['data' => [$notifica], 'successivo' => null]);
    }
    Http::fake(['*' => $inFila]);
    $risposte = [];
    foreach (array_keys($casi) as $caso) {
        $risposta = senzaGettone($this->getJson('cornice/notifiche'));
        $risposte[$caso] = [$risposta->status(), $risposta->json()];
    }
    Http::assertSentCount(4);

    expect($risposte['senza id'][0])->toBeGreaterThanOrEqual(500)
        ->and($risposte['per_me è un testo'])->toBe($risposte['senza id'])
        ->and($risposte['autore senza nome'])->toBe($risposte['senza id'])
        ->and($risposte['risorsa_nome è un numero'])->toBe($risposte['senza id'])
        // Né il valore sbagliato né il resto della notifica finiscono nel corpo dell'errore.
        ->and(json_encode($risposte))->not->toContain('uat-ada')->not->toContain('uat-cartella');
});

it('la lettura di una notifica risponde ancora coi soli id e letta, anche quando il backoffice dà i tre dati (sprint 20 · T1.5)', function () {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => Http::response(['data' => ['letta_il' => '2026-10-07T09:05:00.456Z'] + notificaConChiECosa('uat-n3', ['nome' => 'UAT Bruno'], 'UAT Clienti', true)])]);

    $lettura = senzaGettone($this->patchJson('cornice/notifiche/uat-n3/lettura', ['letta' => true]))
        ->assertOk()->assertExactJson(['data' => ['id' => 'uat-n3', 'letta' => true]]);

    expect(substr_count((string) $lettura->getContent(), 'UAT'))->toBe(0);
});
