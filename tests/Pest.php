<?php

use Illuminate\Support\Facades\File;
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
