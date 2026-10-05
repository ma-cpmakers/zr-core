import * as React from 'react';

// Il bundle del design system (resources/zeiras/bundle.js) legge `window.React` quando si valuta. Va scritto qui, in un modulo a
// sé importato prima del bundle: nello stesso modulo gli import si valutano prima del corpo, e il bundle troverebbe `window.React`
// vuoto.
declare global {
    interface Window {
        React: typeof React;
    }
}

window.React = React;
