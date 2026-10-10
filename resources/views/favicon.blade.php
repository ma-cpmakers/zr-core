{{-- La favicon di Zeiras: nella testa del layout del frontend, @include('zr-core::favicon'). I tre file li pubblica il provider di
     zr-core in public/ (tag `zr-core-favicon` e `laravel-assets`); il colore del tema è un token del design system. --}}
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="{{ \Zeiras\Core\Favicon::coloreDelTema() }}">
