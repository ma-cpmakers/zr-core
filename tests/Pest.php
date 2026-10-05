<?php

use Zeiras\Core\Tests\TestCase;

pest()->extend(TestCase::class)->in('Feature');

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
