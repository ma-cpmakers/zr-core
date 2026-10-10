<?php

namespace Zeiras\Core;

use RuntimeException;

/**
 * La favicon di Zeiras nel frontend: tre file statici, che il provider pubblica in public/, e la vista `zr-core::favicon`, che
 * dà le righe da mettere nella testa della pagina. Qui sta l'unico valore che la vista calcola.
 */
final class Favicon
{
    private static ?string $coloreDelTema = null;

    /**
     * Il colore che il browser dà alla sua barra (`<meta name="theme-color">`): il token `surface` del design system, nel tema
     * chiaro, letto dalla copia di tokens.json del pacchetto. Non è scritto a mano: cambia col design system.
     */
    public static function coloreDelTema(): string
    {
        if (self::$coloreDelTema === null) {
            $token = json_decode((string) file_get_contents(__DIR__.'/../resources/zeiras/tokens.json'), true, flags: JSON_THROW_ON_ERROR);
            $surface = collect($token['color']['tokens'] ?? [])->firstWhere('name', 'surface')['value']['light'] ?? null;
            if (! is_string($surface)) {
                throw new RuntimeException('zr-core: tokens.json non ha il colore «surface» nel tema chiaro');
            }
            self::$coloreDelTema = $surface;
        }

        return self::$coloreDelTema;
    }
}
