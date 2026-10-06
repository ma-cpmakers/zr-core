<?php

namespace Zeiras\Core\Http;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Zeiras\Auth\Api;
use Zeiras\Auth\Errori\BackofficeNonRisponde;
use Zeiras\Auth\Sessione;

/**
 * Le notifiche del pannello della cornice, per il browser: la parte server le chiede al backoffice col gettone del workspace
 * in cui la persona è entrata, mai con quello dell'accesso (che vale per tutti i suoi workspace), e alla cornice dà solo i
 * campi che usa. Senza un workspace nella sessione, 403 senza chiamare il backoffice; un backoffice che non risponde è
 * BackofficeNonRisponde, cioè un errore, mai un elenco vuoto.
 */
final class NotificheDellaCornice
{
    /** Un istante RFC 3339, con l'ora e il fuso: `creata_il` della notifica più recente che la persona ha visto. */
    private const ISTANTE = '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/';

    /** GET /cornice/notifiche: le notifiche del workspace dalla più recente, la prima pagina di io.notifiche.elenca. */
    public function elenco(): JsonResponse
    {
        if (Sessione::workspace() === null) {
            return self::senzaWorkspace();
        }

        $notifiche = Api::workspace()->get('/v1/io/notifiche')['data'] ?? null;

        if (! is_array($notifiche) || ! array_is_list($notifiche)) {
            throw new BackofficeNonRisponde('La risposta di GET /v1/io/notifiche non è una lista di /v1.');
        }

        return new JsonResponse(['data' => array_map(fn (array $notifica) => [
            'id' => $notifica['id'],
            'creata_il' => $notifica['creata_il'],
            'letta' => ($notifica['letta_il'] ?? null) !== null,
            'per_me' => $notifica['per_me'] === true,
            'motivo' => $notifica['motivo'],
            'app' => $notifica['app'],
        ], $notifiche)]);
    }

    /** PATCH /cornice/notifiche/lettura: segna lette le notifiche del workspace fino a `fino_a` (io.notifiche.lettura.modifica). */
    public function lettura(Request $richiesta): JsonResponse
    {
        if (Sessione::workspace() === null) {
            return self::senzaWorkspace();
        }

        $controllo = Validator::make($richiesta->all(), ['fino_a' => ['required', 'string', 'regex:'.self::ISTANTE, 'date']]);

        if ($controllo->fails()) {
            return new JsonResponse(['errore' => 'dati_non_validi'], 422);
        }

        $finoA = Api::workspace()->patch('/v1/io/notifiche/lettura', ['fino_a' => $richiesta->input('fino_a')])['data']['fino_a'] ?? null;

        if (! is_string($finoA)) {
            throw new BackofficeNonRisponde('La risposta di PATCH /v1/io/notifiche/lettura non ha il suo fino_a.');
        }

        return new JsonResponse(['data' => ['fino_a' => $finoA]]);
    }

    private static function senzaWorkspace(): JsonResponse
    {
        return new JsonResponse(['errore' => 'gettone_senza_workspace'], 403);
    }
}
