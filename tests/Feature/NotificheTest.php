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
// Sprint 21 · T3 (voce #1641): l'elenco porta anche `ids`, gli id che alla cornice servono per aprire la risorsa di una
// notifica: di `dati`, i soli del percorso che si apre per il suo tipo, col valore di un id (review della PR #31, R1:
// prima erano ogni `id` e ogni `*_id`). Gli altri id, il resto di `dati` e `soggetto` restano nella parte server; i casi sono in
// fondo.

/** Il workspace in cui entra la sessione dei test. */
const WORKSPACE_DELLE_NOTIFICHE = ['id' => 'uat-ws', 'nome' => 'UAT Marketing', 'slug' => 'uat-marketing'];

/** Ciò che la rotta dice, dei tre dati del #1670, di una notifica del backoffice di prima, che non li manda (sprint 20 · T1). */
const SENZA_CHI_E_COSA = ['autore_nome' => null, 'risorsa_nome' => null, 'per_me' => null];

/**
 * Ciò che la rotta dà, di `dati`, per una notifica di `notificaDelBackoffice()`: nessun id. Il suo tipo non ha una destinazione
 * nel registro, e l'id della cartella resta nella parte server (sprint 21 · T3.5; review della PR #31, R1).
 */
const SENZA_ID = ['ids' => []];

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
        ['id' => 'uat-n3', 'creata_il' => '2026-10-07T09:03:00.123Z', 'letta' => false, 'app' => 'pm', 'tipo' => 'com.zeiras.board.cartella.creata'] + SENZA_CHI_E_COSA + SENZA_ID,
        ['id' => 'uat-n2', 'creata_il' => '2026-10-07T09:02:00.123Z', 'letta' => true, 'app' => 'uat-ignota', 'tipo' => 'com.zeiras.board.cartella.creata'] + SENZA_CHI_E_COSA + SENZA_ID,
        ['id' => 'uat-n1', 'creata_il' => '2026-10-07T09:01:00.123Z', 'letta' => false, 'app' => null, 'tipo' => 'com.zeiras.board.cartella.creata'] + SENZA_CHI_E_COSA + SENZA_ID,
    ], 'aggiornati_il' => '2026-10-10T01:15:07.000321Z', 'workspace' => 'uat-marketing']);
    expect($risposta->json('data.*.id'))->toBe(['uat-n3', 'uat-n2', 'uat-n1']);
    // Una richiesta sola e senza parametri: la prima pagina, e il cursore non si segue.
    Http::assertSentCount(1);
    Http::assertSent(fn (Request $richiesta) => $richiesta->method() === 'GET' && percorsoDi($richiesta) === '/v1/io/notifiche'
        && parse_url($richiesta->url(), PHP_URL_QUERY) === null
        && $richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace']));
});

it('PATCH /cornice/notifiche/{id}/lettura gira letta al backoffice col gettone del workspace e risponde con ciò che il backoffice ha segnato, e con l\'istante della risposta (sprint 5 · T2.2; sprint 22 · T2.5)', function (bool $letta, ?string $lettaIl, bool $attesa) {
    Carbon::setTestNow(Carbon::parse('2026-10-10 01:15:07.000321', 'UTC'));
    $gettoni = sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    // Al gettone dell'accesso io.notifiche.lettura.modifica risponde 403 gettone_senza_workspace.
    Http::fake(fn (Request $richiesta) => match (percorsoDi($richiesta)) {
        '/v1/io/notifiche/uat-n3/lettura' => $richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace'])
            ? Http::response(['data' => notificaDelBackoffice('uat-n3', '2026-10-07T09:03:00.123Z', $lettaIl)])
            : problemaDelBackoffice(403, 'gettone_senza_workspace'),
    });

    senzaGettone($this->patchJson('cornice/notifiche/uat-n3/lettura', ['letta' => $letta]))
        ->assertOk()->assertExactJson(['data' => ['id' => 'uat-n3', 'letta' => $attesa], 'segnata_il' => '2026-10-10T01:15:07.000321Z']);
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
    Carbon::setTestNow(Carbon::parse('2026-10-10 01:15:07.000321', 'UTC'));
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    $id = 'Uat_n-3'.str_repeat('z', 57);
    Http::fake(['*' => Http::response(['data' => notificaDelBackoffice($id, '2026-10-07T09:03:00.123Z', '2026-10-07T09:05:00.456Z')])]);

    senzaGettone($this->patchJson("cornice/notifiche/{$id}/lettura", ['letta' => true]))
        ->assertOk()->assertExactJson(['data' => ['id' => $id, 'letta' => true], 'segnata_il' => '2026-10-10T01:15:07.000321Z']);
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
        'data' => [['id' => 'uat-n1', 'creata_il' => '2026-10-07T09:01:00.123Z', 'letta' => false, 'app' => 'pm', 'tipo' => 'com.zeiras.board.cartella.creata'] + SENZA_CHI_E_COSA + SENZA_ID],
        'aggiornati_il' => '2026-10-10T01:15:07.000321Z',
        'workspace' => 'uat-marketing',
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

// Sprint 22 · T2 (voce #1712): la cornice segna letta la notifica di cui apre la risorsa, e la mostra letta anche in un elenco
// letto fino a quell'istante. Per questo la lettura di una notifica dice quando è stata segnata, come le letture. Il numero
// sulla campanella lo abbassa solo per i dati che aveva al clic (review della PR #44, R1).
it('segnata_il di PATCH /cornice/notifiche/{id}/lettura è l\'istante preso dopo che il backoffice ha risposto, in UTC coi microsecondi anche con l\'applicazione in un altro fuso, qualunque cosa il backoffice abbia segnato (sprint 22 · T2.5)', function (bool $letta, ?string $lettaIl) {
    config(['app.timezone' => 'Europe/Rome']);
    date_default_timezone_set('Europe/Rome');
    Carbon::setTestNow(Carbon::parse('2026-10-10 03:15:07.000321', 'Europe/Rome'));
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    // La risposta del backoffice porta l'orologio avanti: un istante preso prima di chiamarlo sarebbe di tre secondi prima, e
    // dei dati letti in quei tre secondi conterebbero la notifica due volte.
    Http::fake(fn (Request $richiesta) => match (percorsoDi($richiesta)) {
        '/v1/io/notifiche/uat-n3/lettura' => treSecondiDopo(['data' => notificaDelBackoffice('uat-n3', '2026-10-07T09:03:00.123Z', $lettaIl)]),
    });

    $risposta = senzaGettone($this->patchJson('cornice/notifiche/uat-n3/lettura', ['letta' => $letta]))->assertOk()->assertExactJson([
        'data' => ['id' => 'uat-n3', 'letta' => $letta],
        'segnata_il' => '2026-10-10T01:15:10.000321Z',
    ]);

    expect(strlen((string) $risposta->json('segnata_il')))->toBe(27);
    Http::assertSentCount(1);
})->with([
    'segnata letta' => [true, '2026-10-07T09:05:00.456Z'],
    'tornata non letta' => [false, null],
]);

it('una lettura che non riesce non porta un istante: né il 404 di una notifica che non c\'è, né il 422 di un corpo sbagliato, né un guasto del backoffice (sprint 22 · T2.5)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-10 01:15:07.000321', 'UTC'));
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(fn (Request $richiesta) => match (percorsoDi($richiesta)) {
        '/v1/io/notifiche/uat-n3/lettura' => problemaDelBackoffice(404, 'non_trovato'),
        default => Http::response('', 503),
    });

    foreach ([
        [$this->patchJson('cornice/notifiche/uat-n3/lettura', ['letta' => true]), 404, 404],
        [$this->patchJson('cornice/notifiche/uat-n3/lettura', ['letta' => 'true']), 422, 422],
        [$this->patchJson('cornice/notifiche/uat-n4/lettura', ['letta' => true]), 500, 599],
    ] as [$errore, $daStato, $aStato]) {
        expect(senzaGettone($errore)->status())->toBeGreaterThanOrEqual($daStato)->toBeLessThanOrEqual($aStato)
            ->and(substr_count((string) $errore->getContent(), 'segnata_il'))->toBe(0);
    }
});

it('la ricerca non porta un istante, e un errore del backoffice sull\'elenco o sulle letture nemmeno; la lettura di una notifica porta il suo dalla v1.12.0 (sprint 11 · T1.3; sprint 22 · T2.5)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-10 01:15:07.000321', 'UTC'));
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(fn (Request $richiesta) => match (percorsoDi($richiesta)) {
        '/v1/io/notifiche/uat-n3/lettura' => Http::response(['data' => notificaDelBackoffice('uat-n3', '2026-10-07T09:03:00.123Z', '2026-10-07T09:05:00.456Z')]),
        '/v1/ricerca' => Http::response(['data' => [['tipo' => 'board.board', 'id' => 'uat-b1', 'titolo' => 'UAT Lancio']], 'successivo' => null]),
        // All'elenco e alle letture il backoffice non risponde.
        default => Http::response('', 503),
    });

    senzaGettone($this->patchJson('cornice/notifiche/uat-n3/lettura', ['letta' => true]))
        ->assertOk()->assertExactJson(['data' => ['id' => 'uat-n3', 'letta' => true], 'segnata_il' => '2026-10-10T01:15:07.000321Z']);
    senzaGettone($this->postJson('cornice/ricerca', ['q' => 'uat']))
        ->assertOk()->assertExactJson(['data' => [['tipo' => 'board.board', 'id' => 'uat-b1', 'titolo' => 'UAT Lancio', 'contesto' => null]], 'workspace' => 'uat-marketing']);

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

it('GET /cornice/notifiche dà di ogni notifica anche il tipo, quello del backoffice così com\'è, anche un tipo che zr-core non conosce; il soggetto e i dati restano nella parte server: queste notifiche non hanno una destinazione, e `ids` è vuoto (sprint 12 · T2.1; sprint 21 · T3.5)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-10 05:20:07.000321', 'UTC'));
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => Http::response(['data' => [
        // Sprint 24 · T3: una scheda nuova ora ha una destinazione, e porta il suo id (in fondo al file); qui una eliminata, che non ne ha.
        notificaDelBackoffice('uat-n3', '2026-10-07T09:03:00.123Z', null, 'pm', 'com.zeiras.board.scheda.eliminata'),
        // Un tipo che /v1 oggi non ha, con le maiuscole e uno spazio: passa com'è, non si traduce e non si abbassa.
        notificaDelBackoffice('uat-n2', '2026-10-07T09:02:00.123Z', '2026-10-07T09:05:00.456Z', 'uat-ignota', 'com.zeiras.UAT.Tipo ignoto.v2'),
        notificaDelBackoffice('uat-n1', '2026-10-07T09:01:00.123Z', null, null, 'com.zeiras.workspace.membro.creato'),
    ], 'successivo' => null])]);

    $risposta = senzaGettone($this->getJson('cornice/notifiche'))->assertOk()->assertExactJson(['data' => [
        ['id' => 'uat-n3', 'creata_il' => '2026-10-07T09:03:00.123Z', 'letta' => false, 'app' => 'pm', 'tipo' => 'com.zeiras.board.scheda.eliminata'] + SENZA_CHI_E_COSA + SENZA_ID,
        ['id' => 'uat-n2', 'creata_il' => '2026-10-07T09:02:00.123Z', 'letta' => true, 'app' => 'uat-ignota', 'tipo' => 'com.zeiras.UAT.Tipo ignoto.v2'] + SENZA_CHI_E_COSA + SENZA_ID,
        ['id' => 'uat-n1', 'creata_il' => '2026-10-07T09:01:00.123Z', 'letta' => false, 'app' => null, 'tipo' => 'com.zeiras.workspace.membro.creato'] + SENZA_CHI_E_COSA + SENZA_ID,
    ], 'aggiornati_il' => '2026-10-10T05:20:07.000321Z', 'workspace' => 'uat-marketing']);

    // Dell'evento esce il tipo; di `dati`, in `ids`, i soli id che servono ad aprire la risorsa (sprint 21 · T3.5), e queste non
    // ne hanno: né il soggetto né i dati, con la chiave o col valore. Il soggetto di queste notifiche è `/v1/board/cartelle/…`,
    // l'id della cartella e `aggiornata_il` stanno solo in `dati`.
    expect(substr_count((string) $risposta->getContent(), '"tipo"'))->toBe(3)
        ->and(substr_count((string) $risposta->getContent(), '"soggetto"'))->toBe(0)
        ->and(substr_count((string) $risposta->getContent(), '"dati"'))->toBe(0)
        ->and(substr_count((string) $risposta->getContent(), 'uat-cartella'))->toBe(0)
        ->and(substr_count((string) $risposta->getContent(), 'cartelle'))->toBe(0)
        ->and(substr_count((string) $risposta->getContent(), 'aggiornata_il'))->toBe(0);
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
        ->assertOk()->assertExactJson(['data' => ['id' => 'uat-n3', 'letta' => true], 'segnata_il' => '2026-10-10T05:20:07.000321Z']);
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
        // Due valori «falsi» che non sono un testo: un controllo fatto con `empty()` li prenderebbe per «non c'è».
        'risorsa_nome è 0' => [['risorsa_nome' => 0] + $notifica],
        'risorsa_nome è false' => [['risorsa_nome' => false] + $notifica],
        'risorsa_nome è una lista' => [['risorsa_nome' => ['UAT Clienti']] + $notifica],
        'risorsa_nome è un oggetto' => [['risorsa_nome' => ['nome' => 'UAT Clienti']] + $notifica],
        'per_me è un testo' => [['per_me' => 'true'] + $notifica],
        'per_me è 1' => [['per_me' => 1] + $notifica],
        'per_me è 0' => [['per_me' => 0] + $notifica],
        'per_me è una lista' => [['per_me' => [true]] + $notifica],
    ];
}

it('GET /cornice/notifiche dà di ogni notifica nove chiavi: le cinque di prima, autore_nome, risorsa_nome e per_me coi valori del backoffice, e ids; di autore passa solo il nome, e una notifica del backoffice di prima le ha tutte e tre null (sprint 20 · T1.5; sprint 21 · T3.5)', function () {
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
        ['id' => 'uat-n5'] + $diPrima + ['autore_nome' => 'UAT Bruno', 'risorsa_nome' => 'UAT Clienti', 'per_me' => true] + SENZA_ID,
        ['id' => 'uat-n4'] + $diPrima + ['autore_nome' => 'UAT Marta Rossi', 'risorsa_nome' => null, 'per_me' => false] + SENZA_ID,
        ['id' => 'uat-n3'] + $diPrima + ['autore_nome' => null, 'risorsa_nome' => 'UAT Lancio Q4', 'per_me' => null] + SENZA_ID,
        ['id' => 'uat-n2'] + $diPrima + ['autore_nome' => 'UAT Ada', 'risorsa_nome' => 'pm', 'per_me' => null] + SENZA_ID,
        ['id' => 'uat-n1', 'creata_il' => '2026-10-07T09:01:00.123Z'] + $diPrima + ['autore_nome' => null, 'risorsa_nome' => null, 'per_me' => null] + SENZA_ID,
    ], 'aggiornati_il' => '2026-10-11T06:40:07.000321Z', 'workspace' => 'uat-marketing']);

    // Le stesse nove chiavi per ogni notifica, anche quando valgono null: mai una chiave in meno, mai `autore` com'è.
    foreach ($risposta->json('data') as $notifica) {
        expect(array_keys($notifica))->toBe(['id', 'creata_il', 'letta', 'app', 'tipo', 'autore_nome', 'risorsa_nome', 'per_me', 'azioni', 'board_nome', 'ids']);
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
        // Di `dati` escono i soli id che servono ad aprire la risorsa, in `ids` (sprint 21 · T3.5): queste notifiche non ne hanno,
        // e l'id della cartella resta qui, come il soggetto (`/v1/board/cartelle/…`).
        ->and(substr_count($corpo, 'uat-cartella'))->toBe(0)
        ->and(substr_count($corpo, 'cartelle'))->toBe(0)
        ->and(substr_count($corpo, 'aggiornata_il'))->toBe(0);
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
    ] + $attesa + SENZA_ID);
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

// Sprint 32 · T3 (voce #1913). Dal 13/10/2026 una notifica di /v1 può raccontare più azioni: `creata_il` è l'istante della prima,
// `ultima_azione_il` quello dell'ultima (uguale a `creata_il` finché è una sola), `azioni` quante sono, e l'elenco del backoffice
// è ordinato sull'ultima. Alla pagina la parte server dà, in `creata_il`, l'istante dell'ultima azione: è l'ora che il pannello
// mostra, ed è fin lì che arriva «Segna tutte come lette». `ultima_azione_il` non passa. Un backoffice di prima non manda
// `ultima_azione_il`, e allora `creata_il` è quella di sempre.
// Sprint 34 · T2 (voce #1930): di `azioni` e di `board` passano il conto (`azioni`) e il nome della board (`board_nome`), e le
// chiavi in pagina sono undici. L'id della board, e ogni altra chiave di `board`, non passano.

/**
 * Una notifica di /v1 non letta che racconta `$azioni` azioni, dalla prima all'ultima, su una lista di una board.
 *
 * @return array<string, mixed>
 */
function notificaAccorpata(string $id, string $creataIl, mixed $ultimaAzioneIl, int $azioni = 2): array
{
    return notificaDelBackoffice($id, $creataIl, null, 'pm', 'com.zeiras.board.lista.modificata') + [
        'ultima_azione_il' => $ultimaAzioneIl, 'azioni' => $azioni, 'autore' => ['nome' => 'UAT Bruno'], 'risorsa_nome' => 'UAT Da fare',
        'board' => ['id' => 'uat-board-accorpata', 'nome' => 'UAT Lancio accorpato'], 'per_me' => null,
    ];
}

it('GET /cornice/notifiche dà in creata_il l\'istante dell\'ultima azione di una notifica che ne racconta più d\'una, nell\'ordine del backoffice; `ultima_azione_il` e l\'id della board non arrivano in pagina, il conto delle azioni e il nome della board sì (sprint 32 · T3.1, T3.3, T3.4; sprint 34 · T2.5)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-12 09:00:00.000000', 'UTC'));
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    $delBackoffice = [
        // Nata un'ora fa, l'ultima azione due minuti fa: è la prima dell'elenco, che il backoffice ordina sull'ultima azione.
        notificaAccorpata('uat-n3', '2026-10-12T08:00:00.123Z', '2026-10-12T08:58:00.456Z'),
        // Un'azione sola: i due istanti sono lo stesso.
        notificaAccorpata('uat-n2', '2026-10-12T08:50:00.000Z', '2026-10-12T08:50:00.000Z', 1),
        // Il backoffice di prima: `ultima_azione_il` non c'è.
        notificaDelBackoffice('uat-n1', '2026-10-12T08:40:00.789Z', null),
    ];
    Http::fake(['*' => Http::response(['data' => $delBackoffice, 'successivo' => null])]);

    $risposta = senzaGettone($this->getJson('cornice/notifiche'))->assertOk();

    expect(array_column($risposta->json('data'), 'creata_il', 'id'))->toBe([
        'uat-n3' => '2026-10-12T08:58:00.456Z', 'uat-n2' => '2026-10-12T08:50:00.000Z', 'uat-n1' => '2026-10-12T08:40:00.789Z',
    ]);
    foreach ($risposta->json('data') as $notifica) {
        expect(array_keys($notifica))->toBe(['id', 'creata_il', 'letta', 'app', 'tipo', 'autore_nome', 'risorsa_nome', 'per_me', 'azioni', 'board_nome', 'ids']);
    }
    // «Segna tutte come lette» arriva all'istante più avanti fra quelli in pagina: non sta prima della nascita di nessuna.
    $finoA = max(array_map(fn (array $notifica): int => Carbon::parse($notifica['creata_il'])->getTimestampMs(), $risposta->json('data')));
    foreach ($delBackoffice as $notifica) {
        expect($finoA)->toBeGreaterThanOrEqual(Carbon::parse($notifica['creata_il'])->getTimestampMs());
    }
    $corpo = (string) $risposta->getContent();
    expect(substr_count($corpo, 'ultima_azione_il'))->toBe(0)
        ->and(substr_count($corpo, '"board"'))->toBe(0)
        ->and(substr_count($corpo, 'uat-board-accorpata'))->toBe(0)
        ->and(substr_count($corpo, '08:00:00.123Z'))->toBe(0)
        // Il backoffice di prima non manda né `azioni` né `board`: una sola azione, nessuna board.
        ->and(array_column($risposta->json('data'), 'azioni', 'id'))->toBe(['uat-n3' => 2, 'uat-n2' => 1, 'uat-n1' => 1])
        ->and(array_column($risposta->json('data'), 'board_nome', 'id'))->toBe(['uat-n3' => 'UAT Lancio accorpato', 'uat-n2' => 'UAT Lancio accorpato', 'uat-n1' => null]);
});

it('la lettura di una notifica che racconta più azioni risponde come quella di ogni altra, con `id` e `letta`: nessun istante e nessuna delle chiavi in più (sprint 32 · T3.4)', function () {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => Http::response(['data' => ['letta_il' => '2026-10-12T08:59:00.000Z'] + notificaAccorpata('uat-n3', '2026-10-12T08:00:00.123Z', '2026-10-12T08:58:00.456Z')])]);

    $risposta = senzaGettone($this->patchJson('cornice/notifiche/uat-n3/lettura', ['letta' => true]))->assertOk();

    expect($risposta->json('data'))->toBe(['id' => 'uat-n3', 'letta' => true]);
    $corpo = (string) $risposta->getContent();
    expect(substr_count($corpo, 'ultima_azione_il'))->toBe(0)
        ->and(substr_count($corpo, '"azioni"'))->toBe(0)
        ->and(substr_count($corpo, '"board"'))->toBe(0)
        ->and(substr_count($corpo, 'UAT Lancio accorpato'))->toBe(0);
});

it('senza `ultima_azione_il`, o con null, la notifica non è rifiutata e creata_il è quella del backoffice, com\'era (sprint 32 · T3.2)', function (array $notifica) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => Http::response(['data' => [$notifica], 'successivo' => null])]);

    $risposta = senzaGettone($this->getJson('cornice/notifiche'))->assertOk();

    expect($risposta->json('data.0.creata_il'))->toBe('2026-10-12T08:00:00.123Z')
        ->and(array_keys($risposta->json('data.0')))->toBe(['id', 'creata_il', 'letta', 'app', 'tipo', 'autore_nome', 'risorsa_nome', 'per_me', 'azioni', 'board_nome', 'ids']);
})->with([
    'il backoffice di prima: la chiave non c\'è' => [array_diff_key(notificaAccorpata('uat-n3', '2026-10-12T08:00:00.123Z', null), ['ultima_azione_il' => true, 'azioni' => true, 'board' => true])],
    'la chiave c\'è e vale null' => [notificaAccorpata('uat-n3', '2026-10-12T08:00:00.123Z', null)],
]);

/**
 * Valori di `ultima_azione_il` che non sono un testo. Una riga per forma, per l'elenco e per la lettura di una notifica.
 *
 * @return array<string, array{mixed}>
 */
function ultimeAzioniCheNonSonoUnTesto(): array
{
    return [
        'un numero' => [1791795480],
        'zero' => [0],
        'true' => [true],
        'false' => [false],
        'una lista' => [['2026-10-12T08:58:00.456Z']],
        'un oggetto' => [['il' => '2026-10-12T08:58:00.456Z']],
    ];
}

it('un `ultima_azione_il` che non è un testo è un guasto dell\'elenco: mai un 200 che lo toglie in silenzio, mai un numero al posto di un istante (sprint 32 · T3.1)', function (mixed $ultimaAzioneIl) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    // La prima è una notifica intera: il guasto è della seconda.
    Http::fake(['*' => Http::response(['data' => [
        notificaAccorpata('uat-n4', '2026-10-12T08:30:00.000Z', '2026-10-12T08:59:00.000Z'),
        notificaAccorpata('uat-n3', '2026-10-12T08:00:00.123Z', $ultimaAzioneIl),
    ], 'successivo' => null])]);

    $elenco = senzaGettone($this->getJson('cornice/notifiche'));

    expect($elenco->status())->toBeGreaterThanOrEqual(500)->toBeLessThan(600)
        ->and($elenco->json('data'))->toBeNull();
})->with(ultimeAzioniCheNonSonoUnTesto());

it('un `ultima_azione_il` che non è un testo è un guasto anche nella risposta della lettura di una notifica: mai un 200 (sprint 32 · T3.1)', function (mixed $ultimaAzioneIl) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => Http::response(['data' => notificaAccorpata('uat-n3', '2026-10-12T08:00:00.123Z', $ultimaAzioneIl)])]);

    $risposta = senzaGettone($this->patchJson('cornice/notifiche/uat-n3/lettura', ['letta' => false]));

    expect($risposta->status())->toBeGreaterThanOrEqual(500)->toBeLessThan(600)
        ->and($risposta->json('data'))->toBeNull();
})->with(ultimeAzioniCheNonSonoUnTesto());

// Sprint 34 · T2 (voce #1930). Di una notifica che racconta più azioni la pagina dice quante, e in quale board sta la cosa: la
// parte server passa due chiavi in più, `azioni` (un intero da 1 in su) e `board_nome` (il `nome` di `board`, o null). Tutte e
// due sono facoltative: un backoffice di prima non le manda, e valgono 1 e null. Con un'altra forma è lo stesso guasto degli
// altri campi. Di `board` passa solo il nome: l'id, e una chiave messa domani dal backoffice, non arrivano in pagina.

it('GET /cornice/notifiche dà il conto delle azioni e il nome della board; senza le due chiavi, o con `board` null, la notifica passa con una sola azione e nessuna board (sprint 34 · T2.5)', function (array $notifica, int $azioni, ?string $boardNome) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => Http::response(['data' => [$notifica], 'successivo' => null])]);

    $risposta = senzaGettone($this->getJson('cornice/notifiche'))->assertOk();

    expect($risposta->json('data.0.azioni'))->toBe($azioni)
        ->and($risposta->json('data.0.board_nome'))->toBe($boardNome)
        ->and(array_keys($risposta->json('data.0')))->toBe(['id', 'creata_il', 'letta', 'app', 'tipo', 'autore_nome', 'risorsa_nome', 'per_me', 'azioni', 'board_nome', 'ids']);
})->with([
    'tre azioni in una board' => [notificaAccorpata('uat-n3', '2026-10-12T08:00:00.123Z', '2026-10-12T08:58:00.456Z', 3), 3, 'UAT Lancio accorpato'],
    'una sola azione in una board' => [notificaAccorpata('uat-n3', '2026-10-12T08:00:00.123Z', '2026-10-12T08:00:00.123Z', 1), 1, 'UAT Lancio accorpato'],
    'tre azioni e `board` null: CRM, workspace, cartella' => [['board' => null] + notificaAccorpata('uat-n3', '2026-10-12T08:00:00.123Z', '2026-10-12T08:58:00.456Z', 3), 3, null],
    'il backoffice di prima: le due chiavi non ci sono' => [array_diff_key(notificaAccorpata('uat-n3', '2026-10-12T08:00:00.123Z', null), ['ultima_azione_il' => true, 'azioni' => true, 'board' => true]), 1, null],
]);

it('di `board` arriva in pagina solo il nome: né l\'id né una chiave messa domani dal backoffice (sprint 34 · T2.5)', function () {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    $notifica = ['board' => ['id' => 'uat-board-accorpata', 'nome' => 'UAT Lancio accorpato', 'colore' => 'uat-chiave-di-domani']]
        + notificaAccorpata('uat-n3', '2026-10-12T08:00:00.123Z', '2026-10-12T08:58:00.456Z', 3);
    Http::fake(['*' => Http::response(['data' => [$notifica], 'successivo' => null])]);

    $corpo = (string) senzaGettone($this->getJson('cornice/notifiche'))->assertOk()->getContent();

    expect(substr_count($corpo, '"board_nome":"UAT Lancio accorpato"'))->toBe(1)
        ->and(substr_count($corpo, '"azioni":3'))->toBe(1)
        ->and(substr_count($corpo, 'uat-board-accorpata'))->toBe(0)
        ->and(substr_count($corpo, 'uat-chiave-di-domani'))->toBe(0)
        ->and(substr_count($corpo, '"board"'))->toBe(0);
});

/**
 * Valori di `azioni` che non sono un intero da 1 in su, e di `board` che non sono null né un oggetto col `nome` testo. Una
 * riga per forma, per l'elenco e per la lettura di una notifica.
 *
 * @return array<string, array{string, mixed}>
 */
function contiEBoardMalfatti(): array
{
    return [
        'azioni: un testo' => ['azioni', '3'],
        'azioni: zero' => ['azioni', 0],
        'azioni: un numero sotto zero' => ['azioni', -2],
        'azioni: un numero con la virgola' => ['azioni', 2.5],
        'azioni: true' => ['azioni', true],
        'azioni: null' => ['azioni', null],
        'azioni: una lista' => ['azioni', [3]],
        'board: un testo' => ['board', 'UAT Lancio accorpato'],
        'board: un numero' => ['board', 7],
        'board: true' => ['board', true],
        'board: false' => ['board', false],
        'board: una lista' => ['board', ['UAT Lancio accorpato']],
        'board: un oggetto senza nome' => ['board', ['id' => 'uat-board-accorpata']],
        'board: il nome non è un testo' => ['board', ['id' => 'uat-board-accorpata', 'nome' => 7]],
        'board: il nome è null' => ['board', ['id' => 'uat-board-accorpata', 'nome' => null]],
    ];
}

it('un `azioni` che non è un intero da 1 in su, o un `board` che non è null né un oggetto col nome, è un guasto dell\'elenco: mai un 200 che lo toglie in silenzio, mai un testo al posto del conto (sprint 34 · T2.5)', function (string $chiave, mixed $valore) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    // La prima è una notifica intera: il guasto è della seconda.
    Http::fake(['*' => Http::response(['data' => [
        notificaAccorpata('uat-n4', '2026-10-12T08:30:00.000Z', '2026-10-12T08:59:00.000Z'),
        [$chiave => $valore] + notificaAccorpata('uat-n3', '2026-10-12T08:00:00.123Z', '2026-10-12T08:58:00.456Z'),
    ], 'successivo' => null])]);

    $elenco = senzaGettone($this->getJson('cornice/notifiche'));

    expect($elenco->status())->toBeGreaterThanOrEqual(500)->toBeLessThan(600)
        ->and($elenco->json('data'))->toBeNull();
})->with(contiEBoardMalfatti());

it('un `azioni` o un `board` malfatto è un guasto anche nella risposta della lettura di una notifica: mai un 200 (sprint 34 · T2.5)', function (string $chiave, mixed $valore) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => Http::response(['data' => [$chiave => $valore] + notificaAccorpata('uat-n3', '2026-10-12T08:00:00.123Z', '2026-10-12T08:58:00.456Z')])]);

    $risposta = senzaGettone($this->patchJson('cornice/notifiche/uat-n3/lettura', ['letta' => false]));

    expect($risposta->status())->toBeGreaterThanOrEqual(500)->toBeLessThan(600)
        ->and($risposta->json('data'))->toBeNull();
})->with(contiEBoardMalfatti());

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
    Carbon::setTestNow(Carbon::parse('2026-10-10 01:15:07.000321', 'UTC'));
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => Http::response(['data' => ['letta_il' => '2026-10-07T09:05:00.456Z'] + notificaConChiECosa('uat-n3', ['nome' => 'UAT Bruno'], 'UAT Clienti', true)])]);

    $lettura = senzaGettone($this->patchJson('cornice/notifiche/uat-n3/lettura', ['letta' => true]))
        ->assertOk()->assertExactJson(['data' => ['id' => 'uat-n3', 'letta' => true], 'segnata_il' => '2026-10-10T01:15:07.000321Z']);

    expect(substr_count((string) $lettura->getContent(), 'UAT'))->toBe(0);
});

// Sprint 21 · T3 (voce #1641): da una notifica la cornice apre la sua risorsa, e le servono gli id. Di `dati` la rotta dà, in
// `ids`, i soli id che servono ad aprirla: quelli del percorso che il registro di zr-core dà a quel tipo (`{id}`,
// `{persona_id}`; dalla `v1.13.0` il primo dei suoi percorsi che `dati` soddisfa per intero), cercato col tipo intero nella voce dell'app della notifica, e solo con un valore che ha la forma di un id
// (lettere, cifre, `-` e `_`, da 1 a 64). Una notifica di un tipo che nel registro non ha una destinazione — una scheda di una
// board, una persona entrata nel workspace, un tipo di domani — ha `ids` vuoto: un id non va al browser solo perché la sua chiave
// è `id` o finisce in `_id` (review della PR #31, R1: prima passavano tutti). Il resto di `dati` resta qui, come `soggetto`.
// `dati` che manca, o che non è un oggetto, non è un guasto: `ids` è vuoto.

/**
 * Una notifica di /v1 non letta coi `dati` che si vogliono; il soggetto resta quello di `notificaDelBackoffice()`, una cartella.
 * Senza altro è una nota del CRM, che nel registro si apre nella cosa più specifica a cui è attaccata: l'opportunità, poi il
 * contatto (`/contatti/{persona_id}`), poi l'azienda (fino alla `v1.12.0` solo il contatto).
 *
 * @return array<string, mixed>
 */
function notificaConDati(string $id, mixed $dati, string $tipo = 'com.zeiras.crm.nota.creata', ?string $app = 'crm'): array
{
    return ['dati' => $dati] + notificaDelBackoffice($id, '2026-10-07T09:03:00.123Z', null, $app, $tipo);
}

/**
 * Coppie di `dati` con una chiave che somiglia a `persona_id`, quella che un percorso di una nota chiede, e non lo è; il valore
 * da solo passerebbe. Ognuna si aggiunge ai `dati` di una nota che ha il suo id e non quello del contatto.
 *
 * @return array<string, array{array<array-key, mixed>}>
 */
function chiaviCheSomiglianoAPersonaId(): array
{
    $buono = 'uat-valore-9';

    return [
        'persona_ID' => [['persona_ID' => $buono]],
        'Persona_id' => [['Persona_id' => $buono]],
        'personaId' => [['personaId' => $buono]],
        'persona-id' => [['persona-id' => $buono]],
        'persona.id' => [['persona.id' => $buono]],
        'id_persona' => [['id_persona' => $buono]],
        'persone_id' => [['persone_id' => $buono]],
        'contatto_id' => [['contatto_id' => $buono]],
        'persona_id con uno spazio in fondo' => [['persona_id ' => $buono]],
        'persona_id con un a capo in fondo' => [["persona_id\n" => $buono]],
        'persona_id con uno spazio davanti' => [[' persona_id' => $buono]],
        'persona_id_' => [['persona_id_' => $buono]],
        '{persona_id}, con le graffe del percorso' => [['{persona_id}' => $buono]],
        // Si guardano le coppie di `dati`, non quelle di un oggetto più dentro.
        'persona_id in un oggetto più dentro' => [['persona' => ['id' => $buono, 'persona_id' => $buono]]],
        'persona_id in una lista' => [[['persona_id' => $buono]]],
    ];
}

/**
 * Valori che non hanno la forma di un id del backoffice (un testo di lettere, cifre, `-` e `_`, da 1 a 64): in un indirizzo non
 * ci entrano, e al browser non vanno.
 *
 * @return array<string, array{mixed}>
 */
function valoriCheNonSonoUnId(): array
{
    return [
        'vuoto' => [''],
        'uno spazio' => [' '],
        'un numero' => [42],
        'un numero con la virgola' => [4.2],
        'true' => [true],
        'false' => [false],
        'null' => [null],
        'una lista' => [['uat-valore-9']],
        'un oggetto col suo id' => [['id' => 'uat-valore-9']],
        'con ../ davanti' => ['../uat-valore-9'],
        'con una barra' => ['uat-valore-9/x'],
        'con un punto di domanda' => ['uat-valore-9?x=1'],
        'con un cancelletto' => ['uat-valore-9#x'],
        'con uno spazio' => ['uat-valore 9'],
        'con un punto' => ['uat-valore.9'],
        'con una barra già codificata' => ['uat-valore-9%2Fx'],
        'con un a capo in fondo' => ["uat-valore-9\n"],
        'con una lettera accentata' => ['uat-valoré-9'],
        'lungo 65 caratteri' => ['uat-valore-'.str_repeat('a', 54)],
    ];
}

it('GET /cornice/notifiche dà, di `dati`, i soli id che servono ad aprire la risorsa della notifica, nel campo `ids`: quelli del percorso che si apre per il suo tipo — l\'id di un contatto, di una pipeline o di un\'azienda, e per una nota col solo contatto quello del contatto, non il suo —; gli altri id, `aggiornata_il`, `campi` e `soggetto` restano nella parte server (sprint 21 · T3.5; review della PR #31, R1)', function () {
    // Un altro giorno da quello degli `aggiornata_il` di qui sotto: nella risposta la data di oggi è solo in `aggiornati_il`.
    Carbon::setTestNow(Carbon::parse('2026-10-09 08:00:07.000321', 'UTC'));
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => Http::response(['data' => [
        // Una nota col solo contatto: il percorso che si apre chiede il contatto a cui è attaccata, e l'id della nota resta qui.
        notificaConDati('uat-n5', ['id' => 'uat-nota-1', 'persona_id' => 'uat-persona-1', 'aggiornata_il' => '2026-10-11T12:29:00.123Z']),
        // Una pipeline modificata: il suo id; `campi` dice che cosa è cambiato, e resta qui.
        notificaConDati('uat-n4', ['id' => 'uat-pipeline-1', 'aggiornata_il' => '2026-10-11T12:28:00.123Z', 'campi' => ['uat-campo-nome', 'uat-campo-fasi']], 'com.zeiras.crm.pipeline.modificata'),
        // Un contatto con la sua azienda: il percorso chiede `id`, e l'id dell'azienda resta qui.
        notificaConDati('uat-n3', ['organizzazione_id' => 'uat-azienda-1', 'id' => 'uat-persona-3', 'aggiornata_il' => '2026-10-11T12:27:00.123Z'], 'com.zeiras.crm.persona.creata'),
        // Un'azienda.
        notificaConDati('uat-n2', ['id' => 'uat-azienda-2', 'aggiornata_il' => '2026-10-11T12:26:00.123Z'], 'com.zeiras.crm.organizzazione.modificata'),
        // Una nota eliminata: i soli id, senza `aggiornata_il`.
        notificaConDati('uat-n1', ['id' => 'uat-nota-2', 'persona_id' => 'uat-persona-2'], 'com.zeiras.crm.nota.eliminata'),
    ], 'successivo' => null])]);

    $risposta = senzaGettone($this->getJson('cornice/notifiche'))->assertOk();

    expect($risposta->json('data.*.ids'))->toBe([
        ['persona_id' => 'uat-persona-1'],
        ['id' => 'uat-pipeline-1'],
        ['id' => 'uat-persona-3'],
        ['id' => 'uat-azienda-2'],
        ['persona_id' => 'uat-persona-2'],
    ]);
    // `ids` è la nona chiave di ogni notifica, dopo le otto di prima.
    foreach ($risposta->json('data') as $notifica) {
        expect(array_keys($notifica))->toBe(['id', 'creata_il', 'letta', 'app', 'tipo', 'autore_nome', 'risorsa_nome', 'per_me', 'azioni', 'board_nome', 'ids']);
    }
    // Degli id che il percorso non chiede, del resto di `dati` e del soggetto (`/v1/board/cartelle/uat-cartella-…`), né la chiave
    // né il valore.
    $corpo = (string) $risposta->getContent();
    expect(substr_count($corpo, '"ids"'))->toBe(5)
        ->and(substr_count($corpo, 'uat-nota'))->toBe(0)
        ->and(substr_count($corpo, 'uat-azienda-1'))->toBe(0)
        ->and(substr_count($corpo, 'organizzazione_id'))->toBe(0)
        ->and(substr_count($corpo, '"dati"'))->toBe(0)
        ->and(substr_count($corpo, 'soggetto'))->toBe(0)
        ->and(substr_count($corpo, 'cartell'))->toBe(0)
        ->and(substr_count($corpo, 'aggiornata_il'))->toBe(0)
        ->and(substr_count($corpo, '2026-10-11'))->toBe(0)
        ->and(substr_count($corpo, 'campi'))->toBe(0)
        ->and(substr_count($corpo, 'uat-campo'))->toBe(0);
});

it('una notifica di un tipo che nel registro non ha una destinazione ha `ids` vuoto, anche se i suoi `dati` hanno degli id: nessun id va al browser solo perché la sua chiave è `id` o finisce in `_id`; il tipo si cerca intero, nella voce dell\'app della notifica (sprint 21 · T3.5; review della PR #31, R1; sprint 22 · T5.3)', function (?string $app, string $tipo) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    $dati = ['id' => 'uat-x-1', 'persona_id' => 'uat-x-2', 'board_id' => 'uat-x-3', 'lista_id' => 'uat-x-4', 'invito_id' => 'uat-x-5', 'aggiornata_il' => '2026-10-11T12:29:00.123Z'];
    Http::fake(['*' => Http::response(['data' => [notificaConDati('uat-n3', $dati, $tipo, $app)], 'successivo' => null])]);

    $risposta = senzaGettone($this->getJson('cornice/notifiche'))->assertOk();
    $corpo = (string) $risposta->getContent();

    expect($risposta->json('data.0.ids'))->toBe([])
        // Vuoto, ma un oggetto: nel browser `ids` ha una forma sola.
        ->and(substr_count($corpo, '"ids":{}'))->toBe(1)
        ->and(substr_count($corpo, 'uat-x'))->toBe(0)
        ->and(substr_count($corpo, '_id'))->toBe(0);
})->with([
    // Sprint 24 · T3: una scheda nuova, modificata o assegnata ora ha una destinazione, e sta nei casi in fondo al file. Qui resta
    // ciò che di Project Management non ce l'ha: una scheda eliminata, che non ha più una pagina, gli altri tipi della board, e
    // un tipo scritto quasi come uno del registro — «assegnata» arriva senza `com.zeiras.` davanti, un evento con.
    'una scheda eliminata, di Project Management' => ['pm', 'com.zeiras.board.scheda.eliminata'],
    'una lista di una board' => ['pm', 'com.zeiras.board.lista.creata'],
    'una board modificata' => ['pm', 'com.zeiras.board.board.modificata'],
    'una scheda assegnata, con `com.zeiras.` davanti' => ['pm', 'com.zeiras.board.scheda.assegnata'],
    'una scheda nuova, senza `com.zeiras.` davanti' => ['pm', 'board.scheda.creata'],
    'una scheda assegnata, in una notifica del CRM' => ['crm', 'board.scheda.assegnata'],
    'una scheda assegnata, in una notifica che non è di un\'app' => [null, 'board.scheda.assegnata'],
    // Sprint 26 · T6: una menzione in un commento ha una destinazione solo col suo tipo intero, senza `com.zeiras.` davanti, e
    // nella voce di Project Management.
    'una menzione in un commento, con `com.zeiras.` davanti' => ['pm', 'com.zeiras.board.commento.menzione'],
    'un commento, col solo pezzo del tipo della menzione' => ['pm', 'board.commento'],
    'una menzione in un commento, in una notifica del CRM' => ['crm', 'board.commento.menzione'],
    'una menzione in un commento, in una notifica che non è di un\'app' => [null, 'board.commento.menzione'],
    'una vista di una board' => ['pm', 'com.zeiras.board.vista.creata'],
    'una persona entrata nel workspace: il suo id resta qui' => [null, 'com.zeiras.workspace.membro.creato'],
    'un modulo acceso o spento' => [null, 'com.zeiras.app.modificata'],
    'un tipo del CRM che nel registro non c\'è' => ['crm', 'com.zeiras.crm.persona.eliminata'],
    // Sprint 23 · T3: i nove tipi dello sprint 22 (T5.3) ora hanno una destinazione, e stanno nei casi in fondo al file. Qui
    // resta ciò che non ce l'ha: un tipo `eliminata` di una risorsa con una pagina sua, che aprirebbe una pagina che non c'è, e
    // un tipo scritto quasi come uno del registro — un «assegnata» arriva senza `com.zeiras.` davanti, un evento con.
    'un\'opportunità eliminata, che il contratto non ha' => ['crm', 'com.zeiras.crm.trattativa.eliminata'],
    'un\'opportunità assegnata, con `com.zeiras.` davanti' => ['crm', 'com.zeiras.crm.trattativa.assegnata'],
    'un\'opportunità nuova, senza `com.zeiras.` davanti' => ['crm', 'crm.trattativa.creata'],
    'un contatto assegnato, in una notifica di Project Management' => ['pm', 'crm.persona.assegnata'],
    'un contatto assegnato, in una notifica che non è di un\'app' => [null, 'crm.persona.assegnata'],
    'un tipo di domani' => ['crm', 'com.zeiras.crm.uat.domani'],
    'un tipo del registro con un pezzo in più in fondo' => ['crm', 'com.zeiras.crm.persona.creata.v2'],
    'un tipo del registro con un pezzo in più davanti' => ['crm', 'x.com.zeiras.crm.persona.creata'],
    'la sola coda di un tipo del registro' => ['crm', 'persona.creata'],
    'un tipo del registro con una maiuscola' => ['crm', 'com.zeiras.crm.Persona.creata'],
    'un tipo del registro con uno spazio in fondo' => ['crm', 'com.zeiras.crm.persona.creata '],
    'un tipo del registro con un a capo in fondo' => ['crm', "com.zeiras.crm.persona.creata\n"],
    'un tipo vuoto' => ['crm', ''],
    'un tipo del CRM in una notifica di Project Management' => ['pm', 'com.zeiras.crm.persona.creata'],
    'un tipo del CRM in una notifica che non è di un\'app' => [null, 'com.zeiras.crm.persona.creata'],
    'un tipo del CRM in una notifica di un\'app che il registro non ha' => ['uat-ignota', 'com.zeiras.crm.persona.creata'],
    'un tipo del CRM in una notifica della Dashboard' => ['home', 'com.zeiras.crm.persona.creata'],
    'il codice dell\'app con le maiuscole' => ['CRM', 'com.zeiras.crm.persona.creata'],
    'il codice dell\'app con uno spazio in fondo' => ['crm ', 'com.zeiras.crm.persona.creata'],
]);

it('per ogni notifica del registro la rotta dà gli id che il suo percorso chiede, e solo quelli: la parte server legge il registro del pacchetto, lo stesso del browser, e una destinazione nuova ha i suoi id senza un elenco in più da tenere allineato (sprint 21 · T3.5; review della PR #31, R1)', function () {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    $dati = [
        'id' => 'uat-id-1', 'persona_id' => 'uat-persona-1', 'organizzazione_id' => 'uat-azienda-1', 'pipeline_id' => 'uat-pipeline-1',
        'trattativa_id' => 'uat-opp-1', 'board_id' => 'uat-board-1', 'lista_id' => 'uat-lista-1', 'aggiornata_il' => '2026-10-11T12:29:00.123Z',
    ];
    $notifiche = [];
    $attesi = [];
    foreach (registroDeiProdotti() as $voce) {
        foreach ($voce['notifiche'] ?? [] as $notifica) {
            // Con tutti gli id in `dati` si apre `percorso`, il primo: quelli di `altrimenti` hanno i loro casi, in fondo al file.
            preg_match_all('/\{([^{}]*)\}/', $notifica['percorso'], $segnaposto);
            // Un segnaposto con un nome nuovo vuole il suo id qui sopra: senza, questo caso non proverebbe quella destinazione.
            expect(array_diff($segnaposto[1], array_keys($dati)))->toBe([]);
            $notifiche[] = notificaConDati('uat-r'.count($notifiche), $dati, $notifica['tipo'], $voce['id']);
            $attesi[] = array_intersect_key($dati, array_flip($segnaposto[1]));
        }
    }
    Http::fake(['*' => Http::response(['data' => $notifiche, 'successivo' => null])]);

    $risposta = senzaGettone($this->getJson('cornice/notifiche'))->assertOk();

    expect(count($attesi))->toBeGreaterThanOrEqual(9)
        ->and(count(array_filter($attesi)))->toBeGreaterThanOrEqual(9)
        ->and($risposta->json('data.*.ids'))->toEqual($attesi);
});

it('l\'id che il percorso chiede si cerca in `dati` con la sua chiave, com\'è: una chiave che le somiglia non la sostituisce, e il suo valore non arriva al browser (sprint 21 · T3.5; review della PR #31, R1)', function (array $coppia) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => Http::response(['data' => [notificaConDati('uat-n3', ['id' => 'uat-nota-1'] + $coppia)], 'successivo' => null])]);

    $risposta = senzaGettone($this->getJson('cornice/notifiche'))->assertOk();
    $corpo = (string) $risposta->getContent();

    expect($risposta->json('data.0.ids'))->toBe([])
        ->and(substr_count($corpo, 'uat-valor'))->toBe(0)
        ->and(substr_count($corpo, 'uat-nota'))->toBe(0);
})->with(chiaviCheSomiglianoAPersonaId());

it('un id che il percorso chiede passa solo con la forma di un id: con un altro valore la notifica ha `ids` vuoto, non è un guasto, e il valore non arriva al browser (sprint 21 · T3.5)', function (mixed $valore) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => Http::response(['data' => [
        notificaConDati('uat-n3', ['id' => 'uat-nota-1', 'persona_id' => $valore]),
        notificaConDati('uat-n2', ['id' => $valore], 'com.zeiras.crm.persona.creata'),
    ], 'successivo' => null])]);

    $risposta = senzaGettone($this->getJson('cornice/notifiche'))->assertOk();
    $corpo = (string) $risposta->getContent();

    expect($risposta->json('data.*.ids'))->toBe([[], []])
        ->and(substr_count($corpo, '"ids":{}'))->toBe(2)
        ->and(substr_count($corpo, 'uat-valor'))->toBe(0);
})->with(valoriCheNonSonoUnId());

it('un id che il percorso chiede passa com\'è, con la sua chiave: lettere, cifre, `-` e `_`, da 1 a 64 caratteri; anche un testo di sole cifre, che non è un numero (sprint 21 · T3.5)', function (string $id) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => Http::response(['data' => [
        notificaConDati('uat-n3', ['id' => 'uat-nota-1', 'persona_id' => $id, 'aggiornata_il' => '2026-10-11T12:29:00.123Z']),
        notificaConDati('uat-n2', ['id' => $id], 'com.zeiras.crm.pipeline.creata'),
    ], 'successivo' => null])]);

    expect(senzaGettone($this->getJson('cornice/notifiche'))->assertOk()->json('data.*.ids'))->toBe([['persona_id' => $id], ['id' => $id]]);
})->with([
    '64 caratteri' => [str_repeat('a', 64)],
    'sole cifre' => ['42'],
    'un trattino' => ['-'],
    'un trattino basso' => ['_'],
    'maiuscole, minuscole, cifre, - e _' => ['A-b_9'],
]);

it('una notifica senza `dati`, o con un `dati` che non è un oggetto, non è un guasto: ha `ids` vuoto, sempre un oggetto, e le altre dell\'elenco hanno i loro id (sprint 21 · T3.5)', function (bool $conLaChiave, mixed $dati) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    $notifica = notificaConDati('uat-n3', $dati);
    if (! $conLaChiave) {
        unset($notifica['dati']);
    }
    Http::fake(['*' => Http::response(['data' => [$notifica, notificaConDati('uat-n2', ['id' => 'uat-nota-2', 'persona_id' => 'uat-persona-2'])], 'successivo' => null])]);

    $risposta = senzaGettone($this->getJson('cornice/notifiche'))->assertOk();
    $corpo = (string) $risposta->getContent();

    expect($risposta->json('data.*.id'))->toBe(['uat-n3', 'uat-n2'])
        ->and($risposta->json('data.0.ids'))->toBe([])
        ->and($risposta->json('data.1.ids'))->toBe(['persona_id' => 'uat-persona-2'])
        // Vuoto, ma un oggetto: nel browser `ids` ha una forma sola.
        ->and(substr_count($corpo, '"ids":{}'))->toBe(1)
        ->and(substr_count($corpo, '"ids":[]'))->toBe(0)
        ->and(substr_count($corpo, 'uat-x'))->toBe(0);
})->with([
    'senza dati' => [false, null],
    'dati è null' => [true, null],
    'dati è un testo' => [true, 'uat-x'],
    'dati è un numero' => [true, 7],
    'dati è true' => [true, true],
    'dati è false' => [true, false],
    'dati è una lista vuota' => [true, []],
    'dati è una lista di testi' => [true, ['uat-x', 'uat-x-2']],
    'dati è una lista di oggetti coi loro id' => [true, [['id' => 'uat-x', 'persona_id' => 'uat-x-2']]],
    'dati è un oggetto senza id' => [true, ['aggiornata_il' => '2026-10-11T12:29:00.123Z', 'campi' => ['uat-x']]],
    'dati è un testo che è la chiave del percorso' => [true, 'persona_id'],
]);

// Sprint 22 · T1 (voce #1713): la sessione ha un workspace solo. Con due schede su due workspace, la scheda rimasta indietro
// chiede l'elenco e riceve le notifiche di quello in cui la persona è entrata per ultimo: la risposta dice di quale workspace
// sono, e la cornice apre lì la risorsa di una notifica. Lo slug è quello della sessione, col cui gettone l'elenco è stato
// letto: niente di ciò che manda il browser lo cambia.

it('GET /cornice/notifiche dice di quale workspace è l\'elenco: lo slug del workspace della sessione, quello col cui gettone le ha lette, e mai ciò che manda il browser (sprint 22 · T1.1)', function (array $workspace, string $indirizzo, array $intestazioni) {
    $gettoni = sessioneAMano($workspace);
    Http::fake(fn (Request $richiesta) => match (percorsoDi($richiesta)) {
        '/v1/io/notifiche' => $richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace'])
            ? Http::response(['data' => [notificaDelBackoffice('uat-n1', '2026-10-07T09:01:00.123Z', null)], 'successivo' => null])
            : problemaDelBackoffice(403, 'gettone_senza_workspace'),
    });

    $risposta = senzaGettone($this->getJson($indirizzo, $intestazioni))->assertOk();

    expect($risposta->json('workspace'))->toBe($workspace['slug'])
        ->and(array_keys($risposta->json()))->toBe(['data', 'aggiornati_il', 'workspace'])
        ->and($risposta->json('data.*.id'))->toBe(['uat-n1']);
    Http::assertSentCount(1);
})->with([
    'il workspace della sessione' => [WORKSPACE_DELLE_NOTIFICHE, 'cornice/notifiche', []],
    'un altro workspace nella sessione' => [['id' => 'uat-ws-2', 'nome' => 'UAT Vendite', 'slug' => 'uat-vendite'], 'cornice/notifiche', []],
    'un altro slug nella query' => [WORKSPACE_DELLE_NOTIFICHE, 'cornice/notifiche?workspace=uat-vendite', []],
    'un altro slug nella query, come lista' => [WORKSPACE_DELLE_NOTIFICHE, 'cornice/notifiche?workspace[slug]=uat-vendite', []],
    'un altro slug in un\'intestazione' => [WORKSPACE_DELLE_NOTIFICHE, 'cornice/notifiche', ['X-Workspace' => 'uat-vendite', 'X-Zeiras-Workspace' => 'uat-vendite']],
    'la pagina da cui si chiede è di un altro workspace' => [WORKSPACE_DELLE_NOTIFICHE, 'cornice/notifiche', ['Referer' => 'https://app.zeiras.com/w/uat-vendite/notifiche']],
]);

// Sprint 22 · T3 (voce #1716; seconda lettura della PR #31, S2 e S3). Delle rotte delle notifiche, il registro dei moduli lo legge solo l'elenco, che ne
// prende gli id: la lettura di una notifica non ne ha bisogno. Un caso dà alla parte server un registro di prova, già
// letto, con `registroGiaLetto()`, e dopo ogni caso la parte server torna a leggere quello del pacchetto: l'una e l'altra
// cosa stanno in `tests/Pest.php`, per tutti i file (sprint 27 · T5.2). Il registro di prova entra dalla proprietà privata,
// con la reflection: nel codice che va in produzione non c'è un aggancio per i test (review della PR #44, R5).

it('la parte server delle notifiche non ha agganci per i test nel codice che va in produzione: di pubblico ha le tre rotte, la tenuta del blocco e `idsDellaNotifica()`, che è per i frontend e non per i test, e il file del registro non si sceglie né si legge qui: le voci le chiede a `Registro` (review della PR #44, R5; sprint 22 · T7.3; sprint 26 · T3.2)', function () {
    $classe = new ReflectionClass(NotificheDellaCornice::class);
    $pubblici = array_map(fn (ReflectionMethod $metodo): string => $metodo->getName(), $classe->getMethods(ReflectionMethod::IS_PUBLIC));
    sort($pubblici);
    $sorgente = (string) file_get_contents((string) $classe->getFileName());

    expect($pubblici)->toBe(['elenco', 'idsDellaNotifica', 'lettura', 'letture', 'tenutaDelBlocco'])
        ->and($classe->hasProperty('fileDelRegistro'))->toBe(false)
        ->and(str_contains($sorgente, '@internal'))->toBe(false)
        // Il registro è quello del pacchetto, e lo legge `Registro`: qui non c'è una lettura di file, né una copia tenuta, e le
        // voci si chiedono a lei in un punto solo del codice (sprint 26 · T3.2).
        ->and(substr_count($sorgente, 'file_get_contents('))->toBe(0)
        ->and($classe->hasProperty('registro'))->toBe(false)
        ->and(substr_count(senzaCommenti($sorgente), 'Registro::voci()'))->toBe(1);
});

it('PATCH /cornice/notifiche/{id}/lettura risponde senza leggere il registro dei moduli: con un registro che non si legge segna la notifica e risponde, mentre l\'elenco, che dal registro prende gli id, non risponde (sprint 22 · T3.1)', function () {
    Carbon::setTestNow(Carbon::parse('2026-10-10 01:15:07.000321', 'UTC'));
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    // Una nota del CRM: nel registro il suo tipo ha una destinazione, e l'elenco ne cerca gli id.
    $nota = notificaConDati('uat-n3', ['id' => 'uat-nota-1', 'persona_id' => 'uat-persona-1']);
    Http::fake(fn (Request $richiesta) => match (percorsoDi($richiesta)) {
        '/v1/io/notifiche/uat-n3/lettura' => Http::response(['data' => ['letta_il' => '2026-10-10T01:15:06.123Z'] + $nota]),
        '/v1/io/notifiche' => Http::response(['data' => [$nota], 'successivo' => null]),
    });
    // Un registro su cui chi lo legge cade: una voce che non è una lista. Non dipende da come PHP tratta un avviso.
    registroGiaLetto([new stdClass]);

    senzaGettone($this->patchJson('cornice/notifiche/uat-n3/lettura', ['letta' => true]))
        ->assertOk()->assertExactJson(['data' => ['id' => 'uat-n3', 'letta' => true], 'segnata_il' => '2026-10-10T01:15:07.000321Z']);
    // Il registro che non si legge è davvero quello che la parte server ha in mano: l'elenco, che ne ha bisogno, si ferma.
    $this->getJson('cornice/notifiche')->assertStatus(500);
});

it('la parte server prende dal registro l\'id di ogni segnaposto del percorso, e nessuno per una voce «Presto»: con un registro di prova, un percorso con due segnaposto dà i due id, e una voce «Presto» con le sue notifiche non ne dà (sprint 22 · T3.3)', function () {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    registroGiaLetto([
        ['id' => 'crm', 'presto' => false, 'notifiche' => [['tipo' => 'com.zeiras.crm.nota.creata', 'percorso' => '/aziende/{organizzazione_id}/note/{id}']]],
        ['id' => 'reports', 'presto' => true, 'notifiche' => [['tipo' => 'com.zeiras.reports.report.creato', 'percorso' => '/report/{id}']]],
    ]);
    Http::fake(['*' => Http::response(['data' => [
        // Una nota con tre id: il percorso di prova ne chiede due, e quello del contatto resta nella parte server.
        notificaConDati('uat-n2', ['id' => 'uat-nota-1', 'organizzazione_id' => 'uat-azienda-1', 'persona_id' => 'uat-persona-1']),
        notificaConDati('uat-n1', ['id' => 'uat-report-1'], 'com.zeiras.reports.report.creato', 'reports'),
    ], 'successivo' => null])]);

    $risposta = senzaGettone($this->getJson('cornice/notifiche'))->assertOk();

    expect($risposta->json('data.0.ids'))->toEqual(['organizzazione_id' => 'uat-azienda-1', 'id' => 'uat-nota-1'])
        // «Presto»: il browser non la apre, e i suoi id non servono ad aprire niente.
        ->and($risposta->json('data.1.ids'))->toBe([]);
});

// Sprint 22 · T7 (voce #1727; nota `Decisione:` 10255). Un frontend che le notifiche le legge da sé dal backoffice, sul suo
// server — la pagina delle notifiche di zr-home —, non ha gli `ids` dell'elenco della cornice: glieli dà
// `NotificheDellaCornice::idsDellaNotifica()`, pubblico e statico. È la regola dell'elenco, non una copia accanto: la rotta
// chiama lo stesso metodo. Senza una destinazione dà `[]`, e non lancia mai un'eccezione: `dati` è ciò che il backoffice dà,
// com'è. Nome e firma sono un contratto con chi installa il pacchetto, non un aggancio per i test.

it('`idsDellaNotifica()` dà gli stessi `ids` che `GET /cornice/notifiche` dà per quella notifica: per un contatto il suo id e non un altro `*_id` di `dati`, per una nota l\'id del contatto e non il suo, e su ogni notifica dell\'elenco il metodo e la rotta dicono lo stesso (sprint 22 · T7.1)', function () {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    $notifiche = [
        notificaConDati('uat-n9', ['id' => 'p1', 'altro_id' => 'x'], 'com.zeiras.crm.persona.creata'),
        notificaConDati('uat-n8', ['id' => 'n1', 'persona_id' => 'p1']),
        notificaConDati('uat-n7', ['id' => 'uat-pipeline-1', 'campi' => ['uat-campo-nome']], 'com.zeiras.crm.pipeline.creata'),
        notificaConDati('uat-n6', ['id' => 'uat-azienda-1', 'persona_id' => 'uat-persona-1'], 'com.zeiras.crm.organizzazione.creata'),
        // Senza una destinazione: una nota senza il suo contatto, un id con una barra, un tipo e un'app che il registro non
        // ha, nessuna app, e una notifica senza `dati`.
        notificaConDati('uat-n5', ['id' => 'n2']),
        notificaConDati('uat-n4', ['id' => 'p1/x'], 'com.zeiras.crm.persona.creata'),
        notificaConDati('uat-n3', ['id' => 'p1'], 'com.zeiras.crm.uat.inesistente'),
        notificaConDati('uat-n2', ['id' => 'p1'], 'com.zeiras.crm.persona.creata', 'uat-app'),
        notificaConDati('uat-n1', ['id' => 'p1'], 'com.zeiras.crm.persona.creata', null),
        // `notificaDelBackoffice()` dà sempre i `dati` di una cartella: qui la chiave si toglie.
        array_diff_key(notificaDelBackoffice('uat-n0', '2026-10-07T09:01:00.123Z', null, 'crm', 'com.zeiras.crm.persona.creata'), ['dati' => true]),
    ];
    Http::fake(['*' => Http::response(['data' => $notifiche, 'successivo' => null])]);

    $dellElenco = senzaGettone($this->getJson('cornice/notifiche'))->assertOk()->json('data.*.ids');
    $delMetodo = array_map(fn (array $notifica): array => NotificheDellaCornice::idsDellaNotifica($notifica['app'], $notifica['tipo'], $notifica['dati'] ?? null), $notifiche);

    expect($delMetodo)->toBe([['id' => 'p1'], ['persona_id' => 'p1'], ['id' => 'uat-pipeline-1'], ['id' => 'uat-azienda-1'], [], [], [], [], [], []])
        ->and($dellElenco)->toBe($delMetodo);
});

it('`idsDellaNotifica()` legge il registro dei moduli come l\'elenco: con un registro di prova un percorso con due segnaposto dà i due id, nell\'ordine del percorso, uno solo se l\'altro è fuori dalla forma, e una voce «Presto» non ne dà; la rotta dà gli stessi (sprint 22 · T7.1, T7.2)', function () {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    registroGiaLetto([
        ['id' => 'crm', 'presto' => false, 'notifiche' => [['tipo' => 'com.zeiras.crm.nota.creata', 'percorso' => '/aziende/{organizzazione_id}/note/{id}']]],
        ['id' => 'reports', 'presto' => true, 'notifiche' => [['tipo' => 'com.zeiras.reports.report.creato', 'percorso' => '/report/{id}']]],
    ]);
    // Una nota con tre id: il percorso di prova ne chiede due, e quello del contatto resta dov'è.
    $nota = ['id' => 'uat-nota-1', 'organizzazione_id' => 'uat-azienda-1', 'persona_id' => 'uat-persona-1'];
    $dueId = ['organizzazione_id' => 'uat-azienda-1', 'id' => 'uat-nota-1'];
    Http::fake(['*' => Http::response(['data' => [
        notificaConDati('uat-n2', $nota),
        notificaConDati('uat-n1', ['id' => 'uat-report-1'], 'com.zeiras.reports.report.creato', 'reports'),
    ], 'successivo' => null])]);

    expect(NotificheDellaCornice::idsDellaNotifica('crm', 'com.zeiras.crm.nota.creata', $nota))->toBe($dueId)
        // Uno dei due fuori dalla forma: resta l'altro, e non è un guasto.
        ->and(NotificheDellaCornice::idsDellaNotifica('crm', 'com.zeiras.crm.nota.creata', ['organizzazione_id' => 'uat/azienda'] + $nota))->toBe(['id' => 'uat-nota-1'])
        // «Presto»: il browser non la apre, e i suoi id non servono ad aprire niente.
        ->and(NotificheDellaCornice::idsDellaNotifica('reports', 'com.zeiras.reports.report.creato', ['id' => 'uat-report-1']))->toBe([])
        ->and(senzaGettone($this->getJson('cornice/notifiche'))->assertOk()->json('data.*.ids'))->toBe([$dueId, []]);
});

it('`idsDellaNotifica()` dà `[]`, senza eccezioni, per una notifica che non ha una destinazione: un tipo o un\'app che il registro non ha, nessuna app, `dati` che manca o non è un oggetto, un id che manca, o con una barra o due punti (sprint 22 · T7.2)', function (?string $app, string $tipo, mixed $dati) {
    expect(NotificheDellaCornice::idsDellaNotifica($app, $tipo, $dati))->toBe([]);
})->with([
    'un tipo che il registro non ha' => ['crm', 'com.zeiras.crm.uat.inesistente', ['id' => 'p1']],
    'un tipo a metà: si cerca intero' => ['crm', 'com.zeiras.crm.persona', ['id' => 'p1']],
    'un tipo con una maiuscola' => ['crm', 'com.zeiras.crm.persona.Creata', ['id' => 'p1']],
    'un tipo vuoto' => ['crm', '', ['id' => 'p1']],
    'un tipo del CRM con un\'altra app' => ['pm', 'com.zeiras.crm.persona.creata', ['id' => 'p1']],
    'un\'app che il registro non ha' => ['uat-app', 'com.zeiras.crm.persona.creata', ['id' => 'p1']],
    'un\'app vuota' => ['', 'com.zeiras.crm.persona.creata', ['id' => 'p1']],
    'nessuna app' => [null, 'com.zeiras.crm.persona.creata', ['id' => 'p1']],
    '`dati` che manca' => ['crm', 'com.zeiras.crm.persona.creata', null],
    '`dati` vuoto' => ['crm', 'com.zeiras.crm.persona.creata', []],
    '`dati` che è un testo, anche con l\'id dentro' => ['crm', 'com.zeiras.crm.persona.creata', '{"id":"p1"}'],
    '`dati` che è l\'id' => ['crm', 'com.zeiras.crm.persona.creata', 'p1'],
    '`dati` che è un numero' => ['crm', 'com.zeiras.crm.persona.creata', 42],
    '`dati` che è true' => ['crm', 'com.zeiras.crm.persona.creata', true],
    '`dati` che è una lista' => ['crm', 'com.zeiras.crm.persona.creata', [['id' => 'p1']]],
    '`dati` che è un oggetto di PHP e non un array' => ['crm', 'com.zeiras.crm.persona.creata', (object) ['id' => 'p1']],
    'senza l\'id che il percorso chiede' => ['crm', 'com.zeiras.crm.persona.creata', ['persona_id' => 'p1']],
    'una nota senza il suo contatto' => ['crm', 'com.zeiras.crm.nota.creata', ['id' => 'n1']],
    'l\'id in un oggetto più dentro' => ['crm', 'com.zeiras.crm.persona.creata', ['persona' => ['id' => 'p1']]],
    'un id con una barra' => ['crm', 'com.zeiras.crm.persona.creata', ['id' => 'p1/x']],
    'un id che è `..`' => ['crm', 'com.zeiras.crm.persona.creata', ['id' => '..']],
    'un id con `:`' => ['crm', 'com.zeiras.crm.persona.creata', ['id' => 'p1:x']],
]);

it('`idsDellaNotifica()` lascia passare un id solo con la forma di un id — lettere, cifre, `-` e `_`, da 1 a 64 —, e lo dà com\'è (sprint 22 · T7.2)', function (string $id) {
    expect(NotificheDellaCornice::idsDellaNotifica('crm', 'com.zeiras.crm.persona.creata', ['id' => $id]))->toBe(['id' => $id])
        ->and(NotificheDellaCornice::idsDellaNotifica('crm', 'com.zeiras.crm.nota.creata', ['id' => 'uat-nota-1', 'persona_id' => $id]))->toBe(['persona_id' => $id]);
})->with([
    'una lettera' => ['a'],
    'una cifra' => ['7'],
    'un trattino' => ['-'],
    'un trattino basso' => ['_'],
    'lettere, cifre, trattino e trattino basso' => ['Uat_persona-9'],
    'lungo 64 caratteri' => [str_repeat('a', 64)],
]);

it('`idsDellaNotifica()` non lascia passare un valore che non ha la forma di un id: né per un contatto né per una nota (sprint 22 · T7.2)', function (mixed $valore) {
    expect(NotificheDellaCornice::idsDellaNotifica('crm', 'com.zeiras.crm.persona.creata', ['id' => $valore]))->toBe([])
        ->and(NotificheDellaCornice::idsDellaNotifica('crm', 'com.zeiras.crm.nota.creata', ['id' => 'uat-nota-1', 'persona_id' => $valore]))->toBe([]);
})->with(valoriCheNonSonoUnId());

it('`idsDellaNotifica()` è pubblico e statico, con la firma concordata: `?string $app, string $tipo, mixed $dati`, senza valori già messi, e dà un array (sprint 22 · T7.1, T7.3)', function () {
    $metodo = new ReflectionMethod(NotificheDellaCornice::class, 'idsDellaNotifica');
    $parametri = array_map(fn (ReflectionParameter $parametro): string => $parametro->getType().' $'.$parametro->getName().($parametro->isOptional() ? ' = …' : ''), $metodo->getParameters());

    expect($metodo->isPublic())->toBe(true)
        ->and($metodo->isStatic())->toBe(true)
        ->and($parametri)->toBe(['?string $app', 'string $tipo', 'mixed $dati'])
        ->and((string) $metodo->getReturnType())->toBe('array');
});

it('l\'elenco e `idsDellaNotifica()` sono una regola sola, non due copie: la rotta chiama il metodo, e un punto solo del codice chiede al registro le chiavi del percorso e guarda la forma di un id (sprint 22 · T7.1)', function () {
    $sorgente = (string) file_get_contents((string) (new ReflectionClass(NotificheDellaCornice::class))->getFileName());

    expect(substr_count($sorgente, "'ids' => (object) self::idsDellaNotifica("))->toBe(1)
        ->and(substr_count($sorgente, 'function idsDellaNotifica('))->toBe(1)
        ->and(substr_count($sorgente, 'self::chiaviDelPercorso('))->toBe(1)
        ->and(substr_count($sorgente, 'self::FORMA_DI_UN_ID'))->toBe(1)
        // Il nome di prima non c'è più: né il metodo privato, né chi lo chiama.
        ->and(substr_count($sorgente, 'idDi('))->toBe(0);
});

// Sprint 23 · T3 (voce #1743; indirizzi di zr-crm, nota 10406 del #95; decisione di zr-pm, nota 10252 punto 3). I nove tipi
// che dallo sprint 22 avevano solo un titolo hanno una destinazione: un'opportunità, un contatto o un'azienda assegnati la loro
// pagina, con l'`id` di `dati`; un'attività «Da fare», un percorso senza segnaposto, e quindi nessun id. Una nota ha tre
// percorsi, dal più specifico (`percorso`, poi `altrimenti`): al browser vanno i soli id del primo che `dati` soddisfa per
// intero — mai tutti gli `*_id` che i percorsi di quel tipo nominano —, e se nessuno lo è quelli in forma del primo, com'era
// con un percorso solo. `idsDellaNotifica()` e l'elenco restano una regola sola.

it('GET /cornice/notifiche dà a un\'opportunità, a un contatto e a un\'azienda assegnati il loro `id`, e a un\'attività `ids` vuoto: il suo id non va al browser, perché «Da fare» non lo chiede; `idsDellaNotifica()` dà lo stesso (sprint 23 · T3.1, T3.2, T3.3, T3.5)', function () {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    $notifiche = [
        notificaConDati('uat-n9', ['id' => 'uat-opp-1', 'pipeline_id' => 'uat-pipeline-1', 'aggiornata_il' => '2026-10-11T12:29:00.123Z'], 'com.zeiras.crm.trattativa.creata'),
        notificaConDati('uat-n8', ['id' => 'uat-opp-2', 'campi' => ['uat-campo-fase']], 'com.zeiras.crm.trattativa.modificata'),
        notificaConDati('uat-n7', ['id' => 'uat-opp-3'], 'crm.trattativa.assegnata'),
        notificaConDati('uat-n6', ['id' => 'uat-persona-1'], 'crm.persona.assegnata'),
        notificaConDati('uat-n5', ['id' => 'uat-azienda-1'], 'crm.organizzazione.assegnata'),
        notificaConDati('uat-n4', ['id' => 'uat-attivita-1', 'aggiornata_il' => '2026-10-11T12:28:00.123Z'], 'com.zeiras.crm.attivita.creata'),
        notificaConDati('uat-n3', ['id' => 'uat-attivita-2', 'trattativa_id' => 'uat-opp-9'], 'com.zeiras.crm.attivita.modificata'),
        notificaConDati('uat-n2', ['id' => 'uat-attivita-3'], 'com.zeiras.crm.attivita.eliminata'),
        notificaConDati('uat-n1', ['id' => 'uat-attivita-4'], 'crm.attivita.assegnata'),
    ];
    Http::fake(['*' => Http::response(['data' => $notifiche, 'successivo' => null])]);

    $risposta = senzaGettone($this->getJson('cornice/notifiche'))->assertOk();
    $corpo = (string) $risposta->getContent();
    $delMetodo = array_map(fn (array $notifica): array => NotificheDellaCornice::idsDellaNotifica($notifica['app'], $notifica['tipo'], $notifica['dati'] ?? null), $notifiche);

    expect($delMetodo)->toBe([['id' => 'uat-opp-1'], ['id' => 'uat-opp-2'], ['id' => 'uat-opp-3'], ['id' => 'uat-persona-1'], ['id' => 'uat-azienda-1'], [], [], [], []])
        ->and($risposta->json('data.*.ids'))->toBe($delMetodo)
        // Per un'attività `ids` è vuoto, ma un oggetto; del suo id, di un'opportunità a cui è legata e del resto di `dati`, niente.
        ->and(substr_count($corpo, '"ids":{}'))->toBe(4)
        ->and(substr_count($corpo, 'uat-attivita'))->toBe(0)
        ->and(substr_count($corpo, 'uat-opp-9'))->toBe(0)
        ->and(substr_count($corpo, 'uat-pipeline'))->toBe(0)
        ->and(substr_count($corpo, 'uat-campo'))->toBe(0)
        ->and(substr_count($corpo, '_id'))->toBe(0);
});

it('una nota dà al browser i soli id della cosa più specifica a cui è legata — l\'opportunità, poi il contatto, poi l\'azienda —: un legame che manca, `null` o fuori forma scarta il suo percorso e si prova il successivo; `idsDellaNotifica()` dà lo stesso dell\'elenco (sprint 23 · T3.4, T3.5)', function (string $tipo, array $legami, array $attesi) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    $dati = ['id' => 'uat-nota-1', 'aggiornata_il' => '2026-10-11T12:29:00.123Z'] + $legami;
    Http::fake(['*' => Http::response(['data' => [notificaConDati('uat-n3', $dati, $tipo)], 'successivo' => null])]);

    $risposta = senzaGettone($this->getJson('cornice/notifiche'))->assertOk();
    $corpo = (string) $risposta->getContent();

    expect(NotificheDellaCornice::idsDellaNotifica('crm', $tipo, $dati))->toBe($attesi)
        ->and($risposta->json('data.0.ids'))->toBe($attesi)
        // L'id della nota non apre niente, e degli altri legami né la chiave né il valore.
        ->and(substr_count($corpo, 'uat-nota'))->toBe(0)
        ->and(substr_count($corpo, '_id'))->toBe(count($attesi))
        ->and(substr_count($corpo, 'uat-legame'))->toBe(count($attesi));
})->with(['com.zeiras.crm.nota.creata', 'com.zeiras.crm.nota.modificata', 'com.zeiras.crm.nota.eliminata'])->with([
    'opportunità, contatto e azienda: la sola opportunità' => [['trattativa_id' => 'uat-legame-1', 'persona_id' => 'uat-legame-2', 'organizzazione_id' => 'uat-legame-3'], ['trattativa_id' => 'uat-legame-1']],
    'opportunità e contatto: la sola opportunità' => [['persona_id' => 'uat-legame-2', 'organizzazione_id' => null, 'trattativa_id' => 'uat-legame-1'], ['trattativa_id' => 'uat-legame-1']],
    'la sola opportunità' => [['trattativa_id' => 'uat-legame-1', 'persona_id' => null, 'organizzazione_id' => null], ['trattativa_id' => 'uat-legame-1']],
    'contatto e azienda: il solo contatto' => [['trattativa_id' => null, 'persona_id' => 'uat-legame-2', 'organizzazione_id' => 'uat-legame-3'], ['persona_id' => 'uat-legame-2']],
    'il solo contatto, senza le altre chiavi' => [['persona_id' => 'uat-legame-2'], ['persona_id' => 'uat-legame-2']],
    'la sola azienda' => [['trattativa_id' => null, 'persona_id' => null, 'organizzazione_id' => 'uat-legame-3'], ['organizzazione_id' => 'uat-legame-3']],
    'un\'opportunità fuori forma e un contatto buono: il contatto' => [['trattativa_id' => '../x', 'persona_id' => 'uat-legame-2', 'organizzazione_id' => 'uat-legame-3'], ['persona_id' => 'uat-legame-2']],
    'opportunità e contatto fuori forma e un\'azienda buona: l\'azienda' => [['trattativa_id' => 'a/b', 'persona_id' => '..', 'organizzazione_id' => 'uat-legame-3'], ['organizzazione_id' => 'uat-legame-3']],
    'un\'opportunità che è un numero e un contatto buono: il contatto' => [['trattativa_id' => 42, 'persona_id' => 'uat-legame-2'], ['persona_id' => 'uat-legame-2']],
    'i tre legami `null`: nessun id' => [['trattativa_id' => null, 'persona_id' => null, 'organizzazione_id' => null], []],
    'i tre legami fuori forma: nessun id' => [['trattativa_id' => '../x', 'persona_id' => 'a/b', 'organizzazione_id' => ''], []],
    'nessun legame: nessun id' => [[], []],
]);

// Sprint 24 · T4 (voce #1754; lettura della PR #51, R6). Un percorso può ripetere un segnaposto: l'id che chiede è uno, e con
// quello è intero. Contato due volte non lo sarebbe mai: si aprirebbe il percorso dopo, e i suoi id sparirebbero in silenzio.
it('un percorso che ripete un segnaposto chiede quell\'id una volta sola: con l\'id è intero, e la parte server dà quello, non gli id del percorso dopo; la rotta dà gli stessi del metodo (sprint 24 · T4.3)', function () {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    registroGiaLetto([
        ['id' => 'crm', 'presto' => false, 'notifiche' => [
            ['tipo' => 'com.zeiras.crm.nota.creata', 'percorso' => '/x/{id}/y/{id}', 'altrimenti' => ['/elenco']],
            ['tipo' => 'com.zeiras.crm.nota.modificata', 'percorso' => '/x/{id}/y/{id}', 'altrimenti' => ['/a/{primo_id}']],
        ]],
    ]);
    $dati = ['id' => 'uat-nota-1', 'primo_id' => 'uat-primo-1'];
    Http::fake(['*' => Http::response(['data' => [
        notificaConDati('uat-n2', $dati),
        notificaConDati('uat-n1', $dati, 'com.zeiras.crm.nota.modificata'),
    ], 'successivo' => null])]);

    expect(NotificheDellaCornice::idsDellaNotifica('crm', 'com.zeiras.crm.nota.creata', $dati))->toBe(['id' => 'uat-nota-1'])
        ->and(NotificheDellaCornice::idsDellaNotifica('crm', 'com.zeiras.crm.nota.modificata', $dati))->toBe(['id' => 'uat-nota-1'])
        ->and(senzaGettone($this->getJson('cornice/notifiche'))->assertOk()->json('data.*.ids'))->toBe([['id' => 'uat-nota-1'], ['id' => 'uat-nota-1']]);
});

it('con più percorsi la parte server dà gli id del primo che `dati` soddisfa per intero, nell\'ordine del registro: mai gli id di due percorsi insieme, nessuno se si apre un percorso senza segnaposto, e se nessun percorso è intero quelli in forma del primo, com\'era con un percorso solo; la rotta dà gli stessi del metodo (sprint 23 · T3.5)', function () {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    registroGiaLetto([
        ['id' => 'crm', 'presto' => false, 'notifiche' => [
            ['tipo' => 'com.zeiras.crm.nota.creata', 'percorso' => '/b/{board_id}/c/{id}', 'altrimenti' => ['/b/{board_id}', '/elenco']],
            ['tipo' => 'com.zeiras.crm.nota.modificata', 'percorso' => '/b/{board_id}/c/{id}', 'altrimenti' => ['/a/{primo_id}']],
        ]],
    ]);
    $scelta = fn (array $dati): array => NotificheDellaCornice::idsDellaNotifica('crm', 'com.zeiras.crm.nota.creata', $dati);
    $due = fn (array $dati): array => NotificheDellaCornice::idsDellaNotifica('crm', 'com.zeiras.crm.nota.modificata', $dati);
    $tutti = ['id' => 'uat-scheda-1', 'board_id' => 'uat-board-1', 'primo_id' => 'uat-primo-1', 'altro_id' => 'uat-altro-1'];
    Http::fake(['*' => Http::response(['data' => [
        notificaConDati('uat-n4', $tutti),
        notificaConDati('uat-n3', ['id' => 'uat-scheda-1']),
        notificaConDati('uat-n2', ['id' => 'uat-scheda-1', 'primo_id' => 'uat-primo-1'], 'com.zeiras.crm.nota.modificata'),
        notificaConDati('uat-n1', ['id' => 'uat-scheda-1'], 'com.zeiras.crm.nota.modificata'),
    ], 'successivo' => null])]);

    // Il primo percorso, intero: i suoi due id, nell'ordine del percorso, e non quello di un altro percorso.
    expect($scelta($tutti))->toBe(['board_id' => 'uat-board-1', 'id' => 'uat-scheda-1'])
        // Manca l'id della scheda, o è fuori forma: si apre la board, col solo suo id.
        ->and($scelta(['board_id' => 'uat-board-1']))->toBe(['board_id' => 'uat-board-1'])
        ->and($scelta(['id' => 'uat/scheda', 'board_id' => 'uat-board-1']))->toBe(['board_id' => 'uat-board-1'])
        // Senza la board si apre l'elenco, che non chiede un id: quello della scheda resta nella parte server.
        ->and($scelta(['id' => 'uat-scheda-1']))->toBe([])
        ->and($scelta([]))->toBe([])
        // Il secondo percorso quando il primo non è intero: il solo suo id, non quello a metà del primo.
        ->and($due(['id' => 'uat-scheda-1', 'primo_id' => 'uat-primo-1']))->toBe(['primo_id' => 'uat-primo-1'])
        ->and($due($tutti))->toBe(['board_id' => 'uat-board-1', 'id' => 'uat-scheda-1'])
        // Nessun percorso intero: gli id in forma del primo, com'era con un percorso solo (sprint 22 · T7.2).
        ->and($due(['id' => 'uat-scheda-1']))->toBe(['id' => 'uat-scheda-1'])
        ->and($due(['id' => 'uat-scheda-1', 'board_id' => 'uat/board', 'primo_id' => '..']))->toBe(['id' => 'uat-scheda-1'])
        ->and($due(['primo_id' => '..']))->toBe([])
        ->and(senzaGettone($this->getJson('cornice/notifiche'))->assertOk()->json('data.*.ids'))->toBe([
            ['board_id' => 'uat-board-1', 'id' => 'uat-scheda-1'], [], ['primo_id' => 'uat-primo-1'], ['id' => 'uat-scheda-1'],
        ]);
});

// Sprint 24 · T1 (voce #1745): davanti al 403 `accettazione_richiesta` del backoffice (documenti legali da accettare) le rotte
// della cornice rispondono 403 col solo codice, nella forma dei loro errori: i documenti mancanti, il titolo e il dettaglio del
// backoffice restano nella parte server. Il 403 si riconosce dallo stato e dal codice insieme: ogni altra risposta resta
// l'errore che era. La quarta rotta, la ricerca, è in RicercaTest. Il 403 è accettazioneRichiesta() di tests/Pest.php.

/** Una delle tre rotte delle notifiche, chiamata come la chiama la cornice: `elenco`, `lettura` o `letture`. */
function rottaDelleNotifiche(string $rotta): TestResponse
{
    return senzaGettone(match ($rotta) {
        'elenco' => test()->getJson('cornice/notifiche'),
        'lettura' => test()->patchJson('cornice/notifiche/uat-n3/lettura', ['letta' => true]),
        'letture' => test()->postJson('cornice/notifiche/letture', lettureFinoA('2026-10-08T10:00:00.000Z')),
    });
}

it('davanti al 403 accettazione_richiesta del backoffice le tre rotte delle notifiche rispondono 403 col solo codice: né i documenti mancanti, né il titolo, né il dettaglio (sprint 24 · T1.3)', function (string $rotta) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => accettazioneRichiesta()]);

    $risposta = rottaDelleNotifiche($rotta)->assertForbidden();

    expect($risposta->getContent())->toBe('{"errore":"accettazione_richiesta"}');
    Http::assertSentCount(1);
})->with([
    'GET /cornice/notifiche' => ['elenco'],
    'PATCH /cornice/notifiche/{id}/lettura' => ['lettura'],
    'POST /cornice/notifiche/letture' => ['letture'],
]);

it('quel 403 a un richiamo delle letture è lo stesso 403 col solo codice, e dopo non parte un\'altra chiamata (sprint 24 · T1.3)', function () {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    lettureUnaDopoLAltra([lettureDopo(0, true), fn () => accettazioneRichiesta(), lettureDopo(0, false)]);

    $risposta = senzaGettone($this->postJson('cornice/notifiche/letture', lettureFinoA('2026-10-08T10:00:00.123Z')))->assertForbidden();

    expect($risposta->getContent())->toBe('{"errore":"accettazione_richiesta"}');
    Http::assertSentCount(2);
});

it('ogni altra risposta del backoffice resta l\'errore che era: un 403 con un altro codice o senza codice, e quel codice con un altro stato, non fanno rispondere accettazione_richiesta a nessuna delle tre rotte delle notifiche (sprint 24 · T1.5)', function (int $stato, ?string $codice, string $rotta) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => accettazioneRichiesta($stato, $codice)]);

    $risposta = rottaDelleNotifiche($rotta);

    expect($risposta->status())->toBeGreaterThanOrEqual(500)->toBeLessThan(600)
        ->and($risposta->json('errore'))->toBeNull();
    Http::assertSentCount(1);
})->with(quasiAccettazioneRichiesta())->with([
    'GET /cornice/notifiche' => ['elenco'],
    'PATCH /cornice/notifiche/{id}/lettura' => ['lettura'],
    'POST /cornice/notifiche/letture' => ['letture'],
]);

// Sprint 24 · T3 (voce #1748; indirizzo di zr-board, nota 10451 del #95; decisione di zr-pm, nota 10565). Una scheda di Project
// Management — nuova, modificata, o assegnata a chi riceve la notifica — apre la sua pagina in zr-board, `/c/{id}`: al browser
// va il solo `id` dei `dati`, che nei due eventi del contratto portano anche `aggiornata_il`, `lista_id` e `board_id`, e nella
// notifica a chi viene assegnata la scheda il solo `id`. Una scheda eliminata non ha più una pagina: `ids` vuoto.

it('GET /cornice/notifiche dà a una scheda nuova, modificata o assegnata il suo `id` e nient\'altro dei `dati`, né la lista né la board, e a una scheda eliminata `ids` vuoto; `idsDellaNotifica()` dà lo stesso (sprint 24 · T3.2, T3.4)', function () {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    $notifiche = [
        notificaConDati('uat-n4', ['id' => 'uat-scheda-1'], 'board.scheda.assegnata', 'pm'),
        notificaConDati('uat-n3', ['id' => 'uat-scheda-2', 'aggiornata_il' => '2026-10-11T12:29:00.123Z', 'lista_id' => 'uat-lista-1', 'board_id' => 'uat-board-1'], 'com.zeiras.board.scheda.creata', 'pm'),
        notificaConDati('uat-n2', ['id' => 'uat-scheda-3', 'aggiornata_il' => '2026-10-11T12:28:00.123Z', 'lista_id' => 'uat-lista-2', 'board_id' => 'uat-board-1'], 'com.zeiras.board.scheda.modificata', 'pm'),
        notificaConDati('uat-n1', ['id' => 'uat-scheda-4', 'lista_id' => 'uat-lista-1', 'board_id' => 'uat-board-1'], 'com.zeiras.board.scheda.eliminata', 'pm'),
    ];
    Http::fake(['*' => Http::response(['data' => $notifiche, 'successivo' => null])]);

    $risposta = senzaGettone($this->getJson('cornice/notifiche'))->assertOk();
    $corpo = (string) $risposta->getContent();
    $delMetodo = array_map(fn (array $notifica): array => NotificheDellaCornice::idsDellaNotifica($notifica['app'], $notifica['tipo'], $notifica['dati'] ?? null), $notifiche);

    expect($delMetodo)->toBe([['id' => 'uat-scheda-1'], ['id' => 'uat-scheda-2'], ['id' => 'uat-scheda-3'], []])
        ->and($risposta->json('data.*.ids'))->toBe($delMetodo)
        // Per la scheda eliminata `ids` è vuoto, ma un oggetto; del suo id, della lista, della board e del resto di `dati`, niente.
        ->and(substr_count($corpo, '"ids":{}'))->toBe(1)
        ->and(substr_count($corpo, 'uat-scheda-4'))->toBe(0)
        ->and(substr_count($corpo, 'uat-lista'))->toBe(0)
        ->and(substr_count($corpo, 'uat-board'))->toBe(0)
        ->and(substr_count($corpo, '_id'))->toBe(0)
        ->and(substr_count($corpo, 'aggiornata_il'))->toBe(0);
});

// Sprint 26 · T6 (voce #1773; parole e pagina di zr-board, nota 10846 del #95). La notifica a chi viene menzionato in un commento
// porta nei `dati` l'id della scheda e quello del commento, mai il testo. Apre la scheda, `/c/{id}`: al browser va il solo
// `id`, e `commento_id` resta qui.

it('GET /cornice/notifiche dà a una menzione in un commento il solo `id` della scheda: `commento_id` resta qui, senza `id` gli `ids` sono vuoti, e lo stesso tipo con `com.zeiras.` davanti non ne ha; `idsDellaNotifica()` dà lo stesso (sprint 26 · T6.2)', function () {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    $notifiche = [
        notificaConDati('uat-n3', ['id' => 'uat-scheda-1', 'commento_id' => 'uat-commento-9'], 'board.commento.menzione', 'pm'),
        notificaConDati('uat-n2', ['commento_id' => 'uat-commento-8'], 'board.commento.menzione', 'pm'),
        notificaConDati('uat-n1', ['id' => 'uat-scheda-2', 'commento_id' => 'uat-commento-7'], 'com.zeiras.board.commento.menzione', 'pm'),
    ];
    Http::fake(['*' => Http::response(['data' => $notifiche, 'successivo' => null])]);

    $risposta = senzaGettone($this->getJson('cornice/notifiche'))->assertOk();
    $corpo = (string) $risposta->getContent();
    $delMetodo = array_map(fn (array $notifica): array => NotificheDellaCornice::idsDellaNotifica($notifica['app'], $notifica['tipo'], $notifica['dati'] ?? null), $notifiche);

    expect($delMetodo)->toBe([['id' => 'uat-scheda-1'], [], []])
        ->and($risposta->json('data.*.ids'))->toBe($delMetodo)
        // Due senza una destinazione: `ids` vuoto, ma un oggetto. Dell'id del commento, e della scheda che non si apre, niente.
        ->and(substr_count($corpo, '"ids":{}'))->toBe(2)
        ->and(substr_count($corpo, 'uat-scheda-2'))->toBe(0)
        ->and(substr_count($corpo, 'uat-commento'))->toBe(0)
        ->and(substr_count($corpo, '_id'))->toBe(0);
});

it('una scheda con un id fuori forma, o senza `id` nei suoi `dati`, ha `ids` vuoto: non è un guasto, il valore non arriva al browser, e gli altri id non prendono il suo posto (sprint 24 · T3.3)', function (string $tipo, mixed $dati) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => Http::response(['data' => [notificaConDati('uat-n3', $dati, $tipo, 'pm')], 'successivo' => null])]);

    $risposta = senzaGettone($this->getJson('cornice/notifiche'))->assertOk();

    expect(NotificheDellaCornice::idsDellaNotifica('pm', $tipo, $dati))->toBe([])
        ->and($risposta->json('data.0.ids'))->toBe([])
        ->and(substr_count((string) $risposta->getContent(), 'uat-fuori'))->toBe(0);
})->with(['board.scheda.assegnata', 'com.zeiras.board.scheda.creata', 'com.zeiras.board.scheda.modificata', 'board.commento.menzione'])->with([
    'due punti' => [['id' => '..']],
    'con una barra' => [['id' => 'uat-fuori/x']],
    'con ../ davanti' => [['id' => '../uat-fuori']],
    'lungo 65 caratteri' => [['id' => 'uat-fuori-'.str_repeat('a', 55)]],
    'un numero' => [['id' => 42]],
    'senza `id`, con la board e la lista' => [['board_id' => 'uat-fuori-board', 'lista_id' => 'uat-fuori-lista']],
    'senza `dati`' => [null],
]);

// Sprint 26 · T3 (lettura della PR #56, N6). Il registro lo legge una classe sola, `Registro`, e la copia che tiene è una per
// tutte le rotte: il registro di prova di un caso lo scrive lì `registroGiaLetto()`, e lasciato lì arriverebbe a ogni caso
// dopo, di questo file e degli altri. Lo toglie `tests/Pest.php`, dopo ogni caso di ogni file (sprint 27 · T5.2: fino allo
// sprint 26 lo toglieva un `afterEach` di questo file), e lo dicono due casi di fila: il primo scrive un registro di prova e
// non lo toglie, il secondo trova quello del pacchetto.

it('un caso che scrive un registro di prova non lo lascia al caso dopo: il primo lo scrive e non lo toglie, e nel secondo l\'elenco dà di una nota gli id che chiede il registro del pacchetto (sprint 26 · T3.3)', function (?array $diProva, array $ids) {
    sessioneAMano(WORKSPACE_DELLE_NOTIFICHE);
    Http::fake(['*' => Http::response(['data' => [
        notificaConDati('uat-n2', ['id' => 'uat-nota-1', 'organizzazione_id' => 'uat-azienda-1', 'persona_id' => 'uat-persona-1']),
    ], 'successivo' => null])]);
    if ($diProva !== null) {
        registroGiaLetto($diProva);
    }

    expect(senzaGettone($this->getJson('cornice/notifiche'))->assertOk()->json('data.0.ids'))->toBe($ids);
})->with([
    'il primo: un registro di prova che apre la nota dall\'azienda' => [[['id' => 'crm', 'presto' => false, 'notifiche' => [['tipo' => 'com.zeiras.crm.nota.creata', 'percorso' => '/aziende/{organizzazione_id}/note/{id}']]]], ['organizzazione_id' => 'uat-azienda-1', 'id' => 'uat-nota-1']],
    'il secondo: nessuno lo scrive, ed è quello del pacchetto' => [null, ['persona_id' => 'uat-persona-1']],
]);
