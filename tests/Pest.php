<?php

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Zeiras\Auth\Sessione;
use Zeiras\Core\Tests\TestCase;

pest()->extend(TestCase::class)->in('Feature');

/** @return list<array<string, mixed>> le voci del registro dei prodotti, resources/registro/prodotti.json, nel loro ordine */
function registroDeiProdotti(): array
{
    return json_decode(File::get(__DIR__.'/../resources/registro/prodotti.json'), true, flags: JSON_THROW_ON_ERROR)['prodotti'];
}

/** @return list<string> gli id dei prodotti del registro, Dashboard esclusa: ognuno ha un nome in ogni lingua, con l'id per chiave */
function idDeiProdotti(): array
{
    return array_values(array_diff(array_column(registroDeiProdotti(), 'id'), ['home']));
}

/** @return list<string> i tipi di risorsa del registro che la ricerca mostra, `<prodotto>.<tipo>`: ognuno ha un nome in ogni lingua, con questa chiave */
function tipiDiRisorsa(): array
{
    $tipi = [];
    foreach (registroDeiProdotti() as $voce) {
        foreach ($voce['risorse'] ?? [] as $risorsa) {
            $tipi[] = $voce['id'].'.'.$risorsa['tipo'];
        }
    }

    return $tipi;
}

/**
 * Il codice senza i commenti, che citano i testi «così» e non si vedono. Le stringhe restano intere, anche con // o /* dentro
 * (`'../lingue/*.json'` non apre un commento), e `https://` fuori dalle virgolette non ne apre uno di riga.
 */
function senzaCommenti(string $codice): string
{
    return (string) preg_replace_callback(
        '~(?<![:\w])//[^\n]*|/\*.*?\*/|\'(?:[^\'\\\\\n]|\\\\.)*\'|"(?:[^"\\\\\n]|\\\\.)*"|`(?:[^`\\\\]|\\\\.)*`~s',
        fn (array $parte) => str_starts_with($parte[0], '/') ? '' : $parte[0],
        $codice,
    );
}

/**
 * Una sessione fatta a mano, senza il finto: l'accesso e, se c'è, il workspace, coi dati di accessi.crea e gettoni.crea.
 * La lingua è quella del profilo all'ingresso: zr-auth la mette nella sessione com'è.
 *
 * @param  array{id: string, nome: string, slug: string}|null  $workspace
 * @return array{accesso: string, workspace: string} i due gettoni
 */
function sessioneAMano(?array $workspace, string $lingua = 'en'): array
{
    $utente = ['id' => 'uat-ada', 'nome' => 'UAT Ada', 'email' => 'uat-ada@example.com', 'email_verificata_il' => now()->toIso8601String(), 'lingua' => $lingua, 'fuso_orario' => 'Europe/Rome'];
    $gettoni = ['accesso' => 'zr_'.Str::random(48), 'workspace' => 'zr_'.Str::random(48)];
    $scade = now()->addHour()->toIso8601String();
    Sessione::apri(['id' => 'uat-accesso', 'gettone' => ['gettone' => $gettoni['accesso'], 'scade_il' => $scade, 'utente' => $utente]]);
    if ($workspace !== null) {
        Sessione::entra(['gettone' => $gettoni['workspace'], 'scade_il' => $scade, 'utente' => $utente, 'workspace' => $workspace, 'ruolo' => 'membro']);
    }

    return $gettoni;
}

/**
 * Il 403 `accettazione_richiesta` di /v1: la persona non ha ancora accettato i documenti legali in vigore. Un problem details
 * (RFC 9457) coi `mancanti` accanto al codice, com'è nel contratto. Titolo, dettaglio, documento e versione sono segni: testi
 * che dalla parte server della cornice non devono uscire. Con un altro stato, o con un altro codice (null: senza codice), è
 * una risposta che gli somiglia e non lo è.
 */
function accettazioneRichiesta(int $stato = 403, ?string $codice = 'accettazione_richiesta'): mixed
{
    $problema = ['type' => 'about:blank', 'title' => 'segno-del-titolo', 'status' => $stato, 'detail' => 'segno-del-dettaglio']
        + ($codice === null ? [] : ['codice' => $codice])
        + ['mancanti' => [['documento' => 'segno-del-documento', 'versione' => 'segno-della-versione']]];

    return Http::response((string) json_encode($problema), $stato, ['Content-Type' => 'application/problem+json']);
}

/**
 * Le risposte del backoffice che somigliano al 403 `accettazione_richiesta` e non lo sono, perché lo stato o il codice è un
 * altro: le righe di un dataset, stato e codice per `accettazioneRichiesta()`.
 *
 * @return array<string, array{int, ?string}>
 */
function quasiAccettazioneRichiesta(): array
{
    return [
        'un 403 con un altro codice' => [403, 'gettone_senza_workspace'],
        'un 403 senza codice' => [403, null],
        'quel codice con un 409' => [409, 'accettazione_richiesta'],
        'quel codice con un 500' => [500, 'accettazione_richiesta'],
    ];
}
