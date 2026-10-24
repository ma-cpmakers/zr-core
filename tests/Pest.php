<?php

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Zeiras\Auth\Persona;
use Zeiras\Auth\Sessione;
use Zeiras\Core\Registro;
use Zeiras\Core\Tests\TestCase;

// La copia del registro che `Registro` tiene è una per tutte le rotte e per tutti i file di test: un registro di prova lasciato
// lì da un caso arriverebbe a ogni caso dopo, anche di un altro file. Si toglie qui, dopo ogni caso di ogni file, e in nessun
// altro posto (lettura della PR #59, R7).
pest()->extend(TestCase::class)->afterEach(fn () => registroGiaLetto(null))->in('Feature');

/**
 * Dà alla parte server un registro dei moduli come se lo avesse già letto: entra dalla proprietà privata di `Registro`, con la
 * reflection, perché nel codice che va in produzione non c'è un aggancio per i test. Con `null` la parte server torna a leggere
 * quello del pacchetto. È il solo posto dei test che scrive quella proprietà.
 *
 * @param  list<mixed>|null  $voci
 */
function registroGiaLetto(?array $voci): void
{
    (new ReflectionProperty(Registro::class, 'voci'))->setValue(null, $voci);
}

/**
 * @return list<array<string, mixed>> le voci del registro dei prodotti, resources/registro/prodotti.json, nel loro ordine; dalla
 *                                    v3.0.0 con le righe delle notifiche di resources/registro/notifiche.json rimesse in `notifiche`
 *                                    della voce del loro prodotto, come le dà `Registro::voci()`
 */
function registroDeiProdotti(): array
{
    $voci = json_decode(File::get(__DIR__.'/../resources/registro/prodotti.json'), true, flags: JSON_THROW_ON_ERROR)['prodotti'];
    $righe = json_decode(File::get(__DIR__.'/../resources/registro/notifiche.json'), true, flags: JSON_THROW_ON_ERROR);
    foreach ($voci as $indice => $voce) {
        if (isset($righe[$voce['id']])) {
            $voci[$indice]['notifiche'] = $righe[$voce['id']];
        }
    }

    return $voci;
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
 * @return list<string> i codici che il registro dà a una chiave di `contesto` di una risorsa, `<voce>.<tipo>.<chiave>.<codice>`:
 *                      ognuno ha un testo in ogni lingua, con `searchContext.` davanti
 */
function codiciDelContesto(): array
{
    $codici = [];
    foreach (registroDeiProdotti() as $voce) {
        foreach ($voce['risorse'] ?? [] as $risorsa) {
            foreach ($risorsa['codici'] ?? [] as $chiave => $elenco) {
                foreach ($elenco as $codice) {
                    $codici[] = $voce['id'].'.'.$risorsa['tipo'].'.'.$chiave.'.'.$codice;
                }
            }
        }
    }

    return $codici;
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
 * L'impronta di zr-auth della persona con questo id (sprint 60 · T1.1): la forma di `Persona::impronta()` della 0.12.41, rifatta
 * qui da sé, così un caso prova che i dati della cornice portano quella e non un'altra (l'id, o un hash di zr-core).
 */
function improntaDi(string $id): string
{
    return substr(hash_hmac('sha256', 'zr-auth.persona|'.$id, (string) config('app.key')), 0, 32);
}

/**
 * Una sessione fatta a mano, senza il finto: l'accesso e, se c'è, il workspace, coi dati di accessi.crea e gettoni.crea.
 * La lingua è quella del profilo all'ingresso: zr-auth la mette nella sessione com'è.
 *
 * @param  array{id: string, nome: string, slug: string}|null  $workspace
 * @param  array<string, string>  $diversa  ciò che della persona è diverso da Ada (sprint 37 · T4.3)
 * @return array{accesso: string, workspace: string} i due gettoni
 */
function sessioneAMano(?array $workspace, string $lingua = 'en', array $diversa = []): array
{
    $utente = $diversa + ['id' => 'uat-ada', 'nome' => 'UAT Ada', 'email' => 'uat-ada@example.com', 'email_verificata_il' => now()->toIso8601String(), 'lingua' => $lingua, 'fuso_orario' => 'Europe/Rome'];
    $gettoni = ['accesso' => 'zr_'.Str::random(48), 'workspace' => 'zr_'.Str::random(48)];
    $scade = now()->addHour()->toIso8601String();
    Sessione::apri(['id' => 'uat-accesso', 'gettone' => ['gettone' => $gettoni['accesso'], 'scade_il' => $scade, 'utente' => $utente]]);
    if ($workspace !== null) {
        Sessione::entra(['gettone' => $gettoni['workspace'], 'scade_il' => $scade, 'utente' => $utente, 'workspace' => $workspace, 'ruolo' => 'membro']);
    }

    // Come la pagina di quella persona: la cornice dice sempre di chi è la pagina che chiede (l'intestazione `Persona`), e dalla
    // `v2.13.0` una richiesta che non lo dice riceve 422 (StessaPersona). Un caso che vuole un'altra persona, o nessuna, lo dice.
    // Dalla `v2.21.0` anche l'impronta, quando la sessione ne ha una: senza, la richiesta riceve 409 (sprint 62 · T1).
    $email = $utente['email'];
    is_string($email) && $email !== '' ? test()->withHeader('Persona', rawurlencode($email)) : test()->withoutHeader('Persona');
    $impronta = Persona::impronta();
    $impronta !== null ? test()->withHeader(Persona::INTESTAZIONE, $impronta) : test()->withoutHeader(Persona::INTESTAZIONE);

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
