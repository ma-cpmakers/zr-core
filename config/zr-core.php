<?php

/*
 * Ciò che questo modulo aggiunge alla CSP di tutti (Zeiras\Core\Http\IntestazioniSicurezza). Di partenza niente: la CSP di
 * tutti basta a un modulo che carica solo i suoi file e i font del design system.
 *
 * È l'unico posto dove un modulo scrive un'origine. Si aggiunge a sei direttive sole — script-src, style-src, img-src,
 * font-src, connect-src, frame-src — e una sorgente è 'self' oppure un'origine https scritta per intero, in minuscolo, con
 * la porta se serve: https://cdn.example.com. Niente jolly, schemi interi, percorsi, 'unsafe-inline'. Ciò che non ha questa
 * forma è scartato e lascia un avviso nel log a ogni risposta, finché non lo si corregge.
 *
 * Per avere questo file nel modulo: php artisan vendor:publish --tag=zr-core-config
 */

return [

    /*
     * Per sempre, su ogni risposta: una mappa direttiva → sorgenti.
     *
     *     'csp' => ['font-src' => ["'self'"]],
     */
    'csp' => [],

    /*
     * Per una pagina sola: insiemi con un nome, ognuno una mappa direttiva → sorgenti. Il controller della pagina chiede il
     * suo per nome, IntestazioniSicurezza::perLaPagina('turnstile'), e non passa origini.
     *
     *     'csp_pagine' => [
     *         'turnstile' => ['script-src' => ['https://challenges.cloudflare.com'], 'frame-src' => ['https://challenges.cloudflare.com']],
     *     ],
     */
    'csp_pagine' => [],

];
