<?php

namespace Zeiras\Core;

use Illuminate\Http\JsonResponse;
use Throwable;
use Zeiras\Auth\Errori\ErroreApi;

/**
 * Il 403 `accettazione_richiesta` di /v1: la persona non ha ancora accettato i documenti legali in vigore, e finché non lo
 * fa il backoffice le apre solo io.mostra, i documenti, l'accettazione e l'uscita. Per la cornice non è un guasto: i dati
 * escono ridotti (`Cornice::dati()`, con `accettazione_richiesta`), e le sue rotte lo dicono al browser col codice e con
 * l'email di chi è nella sessione (`persona`).
 *
 * Si riconosce dallo stato e dal codice insieme, mai dalla classe dell'errore: fra le versioni di zr-auth che il vincolo del
 * pacchetto accetta ce ne sono senza una classe per questo 403. Un 403 con un altro codice, o senza codice, e quel codice con
 * un altro stato restano l'errore che erano.
 *
 * @internal È della parte server di zr-core e non fa parte di ciò che il pacchetto promette a chi lo installa: un frontend
 * guarda `accettazione_richiesta` nei dati della cornice, o lo stato e il codice dell'`ErroreApi` delle proprie chiamate.
 */
final class Accettazione
{
    /** Il codice dell'errore: nel problema di /v1 e nella risposta delle rotte della cornice. */
    public const CODICE = 'accettazione_richiesta';

    public static function richiesta(Throwable $errore): bool
    {
        return $errore instanceof ErroreApi && $errore->stato === 403 && $errore->codice === self::CODICE;
    }

    /**
     * Ciò che una rotta della cornice risponde a un errore di /v1 che non tratta da sé: davanti a quel 403 un 403 col
     * codice, nella forma degli errori delle rotte, e con `persona`; ogni altro errore lo rilancia com'è. I documenti
     * mancanti, il titolo e il dettaglio del backoffice restano nella parte server: la cornice non mostra testi legali e non
     * fa accettare niente. `$persona` è l'email della persona della sessione, letta dalla rotta prima di chiamare il
     * backoffice (dalla `v2.5.0`): una pagina rimasta ferma mentre la sessione passava a un'altra persona sa così che
     * l'errore non è di chi mostra. Solo l'email: né l'id né il nome.
     */
    public static function rispostaA(ErroreApi $errore, ?string $persona = null): JsonResponse
    {
        return self::richiesta($errore) ? new JsonResponse(['errore' => self::CODICE, 'persona' => $persona], 403) : throw $errore;
    }
}
