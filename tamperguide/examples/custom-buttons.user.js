// ==UserScript==
// @name         TamperGuide — Custom Buttons Example
// @namespace    https://github.com/UNKchr/tamperguide
// @version      1.0.0
// @description  Demonstrates custom action buttons in TamperGuide. Shows how to
//               add arbitrary buttons with custom callbacks, styling variants
//               (primary, secondary, link, danger), dynamic disabled states,
//               and full guide API control.
// @author       UNKchr
// @match        *://*/*
// @require      https://cdn.jsdelivr.net/gh/UNKchr/tamperguide@v1.5.0/tamperguide/tamperGuide.js
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  function startCustomButtonsTour() {
    const guide = tamperGuide({
      animate: true,
      showProgress: true,

      // Global buttons configuration:
      // Defines default buttons array for all steps unless overridden per-step.
      // You can mix standard button identifiers ('next', 'previous', 'close')
      // with custom button descriptor objects in any order!
      buttons: [
        {
          text: 'Skip Tour',
          variant: 'link', // 'link' | 'secondary' | 'primary' | 'danger'
          ariaLabel: 'Skip this entire guided tour',
          onClick: function (element, step, context) {
            console.log('User clicked Skip Tour');
            context.driver.destroy();
          },
        },
        'previous',
        'next',
      ],

      steps: [
        // Step 1: Centered Welcome slide using global buttons (Skip, Previous [hidden on first], Next)
        {
          id: 'welcome',
          popover: {
            title: 'Custom Buttons Demo',
            description: 'This tour showcases custom buttons with bespoke callbacks, visual variants, and deep API integration.',
          },
        },

        // Step 2: Custom action button that opens documentation in a new tab
        {
          id: 'docs-step',
          element: 'header, nav, h1',
          popover: {
            title: 'Documentation & Help',
            description: 'You can insert action buttons like opening external links or triggering userscript features.',
            buttons: [
              {
                text: '📖 Open GitHub',
                variant: 'secondary',
                onClick: function () {
                  window.open('https://github.com/UNKchr/tamperguide', '_blank');
                },
              },
              'previous',
              'next',
            ],
          },
        },

        // Step 3: Jump to specific step or trigger a custom action
        {
          id: 'jump-step',
          element: 'main, article, div',
          popover: {
            title: 'Interactive Shortcuts',
            description: 'Buttons can navigate directly to named steps with moveToStep() or perform arbitrary computations.',
            buttons: [
              {
                text: '⚡ Jump to Finish',
                variant: 'danger',
                onClick: function (element, step, context) {
                  context.driver.moveToStep('finish');
                },
              },
              'previous',
              'next',
            ],
          },
        },

        // Step 4: Finish step with Restart and Finish buttons
        {
          id: 'finish',
          popover: {
            title: 'All Done!',
            description: 'Thank you for exploring TamperGuide custom buttons.',
            buttons: [
              {
                text: '🔄 Restart Tour',
                variant: 'secondary',
                onClick: function (element, step, context) {
                  context.driver.moveToStep('welcome');
                },
              },
              {
                text: 'Done &#10003;',
                variant: 'primary',
                onClick: function (element, step, context) {
                  context.driver.destroy();
                },
              },
            ],
          },
        },
      ],
    });

    guide.drive();
  }

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('▶️ Start Custom Buttons Tour', startCustomButtonsTour);
  }
})();
