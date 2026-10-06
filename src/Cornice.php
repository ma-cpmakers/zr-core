<?php

namespace Zeiras\Core;

use Zeiras\Auth\Api;
use Zeiras\Auth\Sessione;

/**
 * I dati della cornice per la pagina del frontend: chi è la persona, la sua lingua, il workspace in cui è entrata e lo stato
 * delle app in quel workspace. Si leggono dalla sessione di zr-auth e da app.elenca (GET /v1/app) col gettone del workspace;
 * il gettone resta nella sessione. Il frontend li condivide con la pagina (con Inertia, nel suo `share()`), e la `Cornice` di
 * resources/js li riceve in `dati`.
 */
final class Cornice
{
    /**
     * null senza una sessione entrata in un workspace: la pagina non ha un workspace, e il backoffice non si chiama. Il
     * workspace è quello del gettone, mai quello dell'indirizzo. Un backoffice che non risponde lancia BackofficeNonRisponde
     * (zr-auth): mai una lista di app vuota, che farebbe «Presto» di ogni prodotto.
     *
     * @return array{lingua: string, persona: array{nome: string, email: string}, workspace: array{nome: string, slug: string}, prodotti: array<string, string>}|null
     */
    public static function dati(): ?array
    {
        $utente = Sessione::utente();
        $workspace = Sessione::workspace();

        if ($utente === null || $workspace === null) {
            return null;
        }

        $prodotti = [];
        foreach (Api::workspace()->tutti('/v1/app') as $app) {
            $prodotti[$app['codice']] = $app['stato'];
        }

        return [
            'lingua' => $utente['lingua'],
            'persona' => ['nome' => $utente['nome'], 'email' => $utente['email']],
            'workspace' => ['nome' => $workspace['nome'], 'slug' => $workspace['slug']],
            'prodotti' => $prodotti,
        ];
    }
}
