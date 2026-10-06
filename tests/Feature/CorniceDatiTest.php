<?php

use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Zeiras\Auth\Api;
use Zeiras\Auth\Errori\BackofficeNonRisponde;
use Zeiras\Auth\Sessione;
use Zeiras\Auth\Testing\BackofficeFinto;
use Zeiras\Auth\Testing\Gettone;
use Zeiras\Core\Cornice;

// Sprint 2 · T3 (voce #1256). La parte server della cornice: Cornice::dati() dà alla pagina del frontend la persona, la sua
// lingua, il workspace in cui è entrata e lo stato delle app in quel workspace, dalla sessione di zr-auth e da app.elenca col
// gettone del workspace. Il backoffice è il finto di zr-auth, o Http::fake dove serve una risposta che il finto non dà:
// nessuna richiesta esce (TestCase). La pagina di prova è `w/{slug}/cornice` di TestCase, nel gruppo `web`.

/**
 * Anna entra nel finto e nel suo workspace come fa l'accesso del frontend: accessi.crea, poi gettoni.crea.
 *
 * @return array{id: string, nome: string, slug: string} il workspace
 */
function annaNelSuoWorkspace(BackofficeFinto $finto): array
{
    $anna = $finto->persona('anna@example.com', 'una password lunga e sicura', 'Anna', 'es');
    $studio = $finto->workspace('Studio Anna', $anna);
    Sessione::apri(Api::senzaGettone()->post('/v1/accessi', ['email' => 'anna@example.com', 'password' => 'una password lunga e sicura'])['data']);
    Sessione::entra(Api::persona()->post('/v1/gettoni', ['workspace_id' => $studio['id']])['data']);

    return $studio;
}

/**
 * Una sessione fatta a mano, senza il finto: l'accesso e, se c'è, il workspace, coi dati di accessi.crea e gettoni.crea.
 *
 * @param  array{id: string, nome: string, slug: string}|null  $workspace
 * @return array{accesso: string, workspace: string} i due gettoni
 */
function sessioneAMano(?array $workspace): array
{
    $utente = ['id' => 'uat-ada', 'nome' => 'UAT Ada', 'email' => 'uat-ada@example.com', 'email_verificata_il' => now()->toIso8601String(), 'lingua' => 'en', 'fuso_orario' => 'Europe/Rome'];
    $gettoni = ['accesso' => 'zr_'.Str::random(48), 'workspace' => 'zr_'.Str::random(48)];
    $scade = now()->addHour()->toIso8601String();
    Sessione::apri(['id' => 'uat-accesso', 'gettone' => ['gettone' => $gettoni['accesso'], 'scade_il' => $scade, 'utente' => $utente]]);
    if ($workspace !== null) {
        Sessione::entra(['gettone' => $gettoni['workspace'], 'scade_il' => $scade, 'utente' => $utente, 'workspace' => $workspace, 'ruolo' => 'membro']);
    }

    return $gettoni;
}

it('con la sessione entrata in un workspace dà nome, email e lingua della persona, il workspace del gettone e lo stato di ogni app (T3.1)', function () {
    $studio = annaNelSuoWorkspace(BackofficeFinto::attiva());

    // L'indirizzo nomina un altro workspace: conta quello del gettone.
    $this->get('w/un-altro-workspace/cornice')->assertOk()->assertExactJson([
        'lingua' => 'es',
        'persona' => ['nome' => 'Anna', 'email' => 'anna@example.com'],
        'workspace' => ['nome' => 'Studio Anna', 'slug' => $studio['slug']],
        'prodotti' => ['automations' => 'in_arrivo', 'bookings' => 'in_arrivo', 'content' => 'in_arrivo', 'crm' => 'in_arrivo', 'pm' => 'in_arrivo', 'reports' => 'in_arrivo'],
    ]);
});

it('lo stato di ogni app è quello di app.elenca, chiesto col gettone del workspace e non con quello dell\'accesso (T3.1)', function () {
    Http::fake(['*/v1/app*' => Http::response(['data' => [
        ['codice' => 'crm', 'stato' => 'disponibile'],
        ['codice' => 'pm', 'stato' => 'attivo'],
        ['codice' => 'reports', 'stato' => 'in_arrivo'],
    ], 'successivo' => null])]);
    $gettoni = sessioneAMano(['id' => 'uat-ws', 'nome' => 'UAT Marketing', 'slug' => 'uat-marketing']);

    expect(Cornice::dati())->toBe([
        'lingua' => 'en',
        'persona' => ['nome' => 'UAT Ada', 'email' => 'uat-ada@example.com'],
        'workspace' => ['nome' => 'UAT Marketing', 'slug' => 'uat-marketing'],
        'prodotti' => ['crm' => 'disponibile', 'pm' => 'attivo', 'reports' => 'in_arrivo'],
    ]);
    Http::assertSent(fn (Request $richiesta) => $richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['workspace']));
    Http::assertNotSent(fn (Request $richiesta) => $richiesta->hasHeader('Authorization', 'Bearer '.$gettoni['accesso']));
});

it('senza sessione, o con la sessione aperta ma senza workspace, dà null e non chiama il backoffice (T3.2)', function () {
    Http::fake();

    expect(Cornice::dati())->toBeNull();

    sessioneAMano(null);

    expect(Sessione::aperta())->toBeTrue()
        ->and(Cornice::dati())->toBeNull();
    Http::assertNothingSent();
});

it('il gettone non arriva alla pagina che riceve i dati della cornice (T3.3)', function () {
    annaNelSuoWorkspace(BackofficeFinto::attiva());

    $risposta = $this->get('w/studio-anna/cornice')->assertOk();

    expect($risposta->json('persona.email'))->toBe('anna@example.com');
    Gettone::assenteDa($risposta);
});

it('se il backoffice non risponde l\'errore arriva al frontend, non una lista di app vuota (T3.4)', function () {
    Http::fake(['*' => Http::response('', 500)]);
    sessioneAMano(['id' => 'uat-ws', 'nome' => 'UAT Marketing', 'slug' => 'uat-marketing']);

    expect(fn () => Cornice::dati())->toThrow(BackofficeNonRisponde::class);
});
