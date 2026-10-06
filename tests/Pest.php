<?php

use Illuminate\Support\Facades\File;
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
