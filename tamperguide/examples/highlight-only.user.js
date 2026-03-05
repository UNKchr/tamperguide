// ==UserScript==
// @name         TamperGuide — Highlight Only Example
// @namespace    https://github.com/UNKchr/tamperguide
// @version      1.0.0
// @description  Demonstrates guide.highlight() to spotlight a single element
//               without running a multi-step tour. Useful for contextual hints,
//               first-time-use callouts, or drawing attention to a specific UI
//               component. The highlight is triggered from the extension menu.
// @author       UNKchr
// @match        *://*/*
// @require      https://cdn.jsdelivr.net/gh/UNKchr/tamperguide@v1.4.1/tamperguide/tamperGuide.js
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // highlightSearch spotlights the first search input field on the page.
  function highlightSearch() {

    // Create a guide instance with no steps. For highlight-only usage, no
    // steps array is required because we call guide.highlight() directly.
    //
    // Configuration options here still control visual behaviour:
    //   overlayOpacity - how dark the dimmed background is (0 = none, 1 = black)
    //   stagePadding   - extra space (px) around the highlighted element's box
    //   stageRadius    - rounded corner radius (px) of the highlight cutout
    //   allowClose     - whether Escape or overlay clicks dismiss the highlight
    const guide = tamperGuide({
      overlayOpacity: 0.6,
      stagePadding: 12,
      stageRadius: 8,
      allowClose: true,

      // onDestroyed fires once the overlay and popover have been removed and all
      // event listeners cleaned up. Use this for any post-highlight side effects.
      onDestroyed: function () {
        console.log('[TamperGuide demo] highlight dismissed');
      },
    });

    // guide.highlight(step) accepts the same step object structure used in the
    // steps array. The key difference is that it spotlights one element
    // immediately, without navigation buttons or a progress counter.
    //
    // 'element' can be:
    //   - a CSS selector string (passed to document.querySelector)
    //   - a direct DOM Element reference
    //   - a zero-argument function that returns a DOM Element
    guide.highlight({
      element: 'input[type="search"], input[type="text"], textarea',
      popover: {
        title: 'Input Field',
        description: 'This is the first text input on the page. Click anywhere outside or press Escape to dismiss.',
        // side: position the popover below the element.
        // TamperGuide will flip to another side automatically if there is not
        // enough space below.
        side: 'bottom',
        // align: align the popover to the start (left edge) of the element.
        align: 'start',
        // Hide all navigation buttons since this is a single-step highlight.
        // The close button (X) is still shown because 'close' is not in this
        // array and the library respects the global showButtons default which
        // includes 'close'. To also hide the X button, pass an empty array
        // here and set allowClose: false in the main config.
        showButtons: ['close'],
      },
    });
  }

  // highlightFirstHeading spotlights the first heading element found on the page.
  function highlightFirstHeading() {
    const guide = tamperGuide({
      overlayOpacity: 0.5,
      stagePadding: 8,
      stageRadius: 4,
      allowClose: true,
    });

    // Using a function as the element resolver. The function is called lazily
    // when highlight() runs, so it always queries the live DOM at call time.
    // This is useful when the target element might be added dynamically.
    guide.highlight({
      element: function () {
        // document.querySelector returns the first matching element or null.
        // Returning null is safe: TamperGuide will warn and show a centered
        // popover instead of crashing.
        return document.querySelector('h1, h2, h3');
      },
      popover: {
        title: 'Page Heading',
        description: 'This is the first heading found on the page.',
        side: 'bottom',
        showButtons: ['close'],
      },
    });
  }

  // Register both actions in the Tampermonkey extension menu.
  GM_registerMenuCommand('Highlight: First Input', highlightSearch);
  GM_registerMenuCommand('Highlight: First Heading', highlightFirstHeading);

})();
