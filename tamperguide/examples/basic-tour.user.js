// ==UserScript==
// @name         TamperGuide — Basic Tour Example
// @namespace    https://github.com/UNKchr/tamperguide
// @version      1.0.0
// @description  A minimal multi-step tour using TamperGuide. Demonstrates step
//               structure, progress display, and button configuration. The tour
//               is launched on demand via the Tampermonkey extension menu.
// @author       UNKchr
// @match        *://*/*
// @require      https://cdn.jsdelivr.net/gh/UNKchr/tamperguide@v1.4.1/tamperguide/tamperGuide.js
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // startTour is called when the user selects "Start Basic Tour" from the
  // Tampermonkey extension menu. It creates a fresh guide instance each time
  // so the tour always begins at step 0 regardless of where it was last closed.
  function startTour() {

    // tamperGuide(options) is the main factory function exposed globally by
    // the TamperGuide library. It validates your configuration immediately and
    // returns an API object you use to control the tour.
    const guide = tamperGuide({

      // animate: true enables fade and slide transitions between steps.
      // Set to false if you prefer instant transitions.
      animate: true,

      // showProgress: true renders a "1 of 4" counter in the popover footer
      // so users always know where they are in the tour.
      showProgress: true,

      // showButtons: controls which action buttons appear in the popover.
      // 'next'     - advances to the next step (or finishes on the last step)
      // 'previous' - goes back one step (hidden on the first step automatically)
      // 'close'    - renders an X button in the top-right corner
      showButtons: ['next', 'previous', 'close'],

      // steps: an ordered array of step objects. Each step describes one
      // element to highlight and the popover content to show with it.
      steps: [

        // Step 1: Introduction slide.
        // A step without an 'element' key renders the popover centered on the
        // screen. Use this pattern for welcome slides or closing messages.
        {
          popover: {
            title: 'Welcome',
            description: 'This is a quick tour of the current page. Use the buttons below or the arrow keys to navigate.',
          },
        },

        // Step 2: Highlight the first child element of the body.
        // 'element' accepts any valid CSS selector. The library queries
        // the DOM at the moment this step is activated.
        {
          element: 'body > *:first-child',
          popover: {
            title: 'First Element',
            description: 'This is the first visible element on the page.',
            // side: preferred placement of the popover relative to the element.
            // 'top' | 'right' | 'bottom' | 'left'
            // When omitted, TamperGuide automatically picks the side with the
            // most available viewport space.
            side: 'bottom',
          },
        },

        // Step 3: Highlight the first anchor tag on the page.
        {
          element: 'a',
          popover: {
            title: 'A Link',
            description: 'This is the first hyperlink found on the page.',
            side: 'bottom',
            // align: horizontal alignment of the popover relative to the element.
            // 'start' | 'center' | 'end'  (default: 'center')
            align: 'center',
          },
        },

        // Step 4: Closing slide.
        // Another centered popover with no element reference. On the last step,
        // the Next button automatically becomes the Done button.
        {
          popover: {
            title: 'Tour Complete',
            description: 'That is it. TamperGuide is working correctly on this page.',
          },
        },

      ],
    });

    // drive() initializes the overlay, injects styles, registers keyboard
    // listeners, and activates the first step (index 0).
    // You can pass a step index to start from a different position:
    //   guide.drive(2);  // start from step index 2
    guide.drive();
  }

  // Register a menu command in the Tampermonkey extension popup.
  // The user can click "Start Basic Tour" to trigger the tour at any time.
  GM_registerMenuCommand('Start Basic Tour', startTour);

})();