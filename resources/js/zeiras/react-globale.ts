import * as React from 'react';

// `window.React` lo scrive l'ingresso di sempre (./index.ts), con `window.Zeiras`: un frontend può leggerli. Fino alla v1.14.0 lo
// leggeva il bundle del design system (resources/zeiras/bundle.js) quando si valutava, e per questo sta in un modulo a sé,
// importato per primo. I componenti di oggi (./componenti.js) importano React da sé e `window.React` non lo leggono.
declare global {
    interface Window {
        React: typeof React;
    }
}

window.React = React;
