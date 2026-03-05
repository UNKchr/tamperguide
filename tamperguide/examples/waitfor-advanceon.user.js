// ==UserScript==
// @name         TamperGuide — waitFor & advanceOn Example
// @namespace    https://github.com/UNKchr/tamperguide
// @version      1.0.0
// @description  Demonstrates waitFor (poll for a dynamically inserted element
//               before activating a step) and advanceOn (wait for a user
//               interaction before the tour advances). Both features are shown
//               in a single self-contained tour with injected demo elements.
// @author       UNKchr
// @match        *://*/*
// @require      https://cdn.jsdelivr.net/gh/UNKchr/tamperguide@v1.5.0/tamperguide/tamperGuide.js
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // Demo elements
  // --------------------------------------------------------------------------
  // We inject a small floating panel so this script works on any page. The
  // panel contains:
  //   - A button that simulates a dynamic element appearing after a delay.
  //   - An input field used to demonstrate interaction-based advancement.

  var demoPanel = null;

  function ensureDemoPanel() {
    if (demoPanel) return;

    demoPanel = document.createElement('div');
    demoPanel.id = 'tg-waitfor-demo-panel';
    demoPanel.style.cssText = [
      'position: fixed',
      'bottom: 16px',
      'right: 16px',
      'z-index: 9100',
      'background: #fff',
      'border: 1px solid #d1d5db',
      'border-radius: 8px',
      'padding: 16px 20px',
      'font-family: sans-serif',
      'font-size: 13px',
      'color: #374151',
      'box-shadow: 0 4px 16px rgba(0,0,0,0.12)',
      'min-width: 240px',
    ].join(';');

    demoPanel.innerHTML = [
      '<p style="margin:0 0 12px;font-weight:700;font-size:14px">',
      '  waitFor / advanceOn Demo',
      '</p>',

      // This button is always present — we will highlight it with a waitFor step
      // that simulates a delay before the element is "ready".
      '<button id="tg-demo-load-btn"',
      '  style="display:block;width:100%;margin-bottom:10px;padding:8px 12px;',
      '         background:#3b82f6;color:#fff;border:none;border-radius:6px;',
      '         font-size:13px;cursor:pointer">',
      '  Load Feature (click me!)',
      '</button>',

      // This input demonstrates advanceOn with an 'input' event.
      '<input id="tg-demo-text-input" type="text"',
      '  placeholder="Type something here…"',
      '  style="display:block;width:100%;box-sizing:border-box;',
      '         padding:7px 10px;border:1px solid #d1d5db;border-radius:6px;',
      '         font-size:13px;color:#374151">',

      // This element starts hidden; it will be injected by a setTimeout to
      // simulate a network response or lazy render.
      '<div id="tg-demo-dynamic-result"',
      '  style="display:none;margin-top:10px;padding:8px 10px;',
      '         background:#d1fae5;color:#065f46;border-radius:6px;font-size:12px">',
      '  ✓ Feature loaded successfully',
      '</div>',
    ].join('');

    document.body.appendChild(demoPanel);
  }

  function removeDemoPanel() {
    if (demoPanel) {
      demoPanel.parentNode && demoPanel.parentNode.removeChild(demoPanel);
      demoPanel = null;
    }
  }


  // --------------------------------------------------------------------------
  // startTour
  // --------------------------------------------------------------------------
  function startTour() {
    ensureDemoPanel();

    // Hide the dynamic result element before we start so the waitFor step has
    // something to actually wait for.
    var resultEl = document.getElementById('tg-demo-dynamic-result');
    if (resultEl) resultEl.style.display = 'none';

    const guide = tamperGuide({
      showProgress: true,
      animate: true,
      showButtons: ['next', 'previous', 'close'],

      onDestroyed: function () {
        removeDemoPanel();
      },

      steps: [

        // ----------------------------------------------------------------
        // Step 1 — Introduction (no special features, just a popover).
        // ----------------------------------------------------------------
        {
          popover: {
            title: 'waitFor & advanceOn',
            description: 'This tour demonstrates two async features. ' +
              '• waitFor: TamperGuide polls for an element before activating a step. ' +
              '• advanceOn: the tour waits for a user interaction before advancing.',
          },
        },

        // ----------------------------------------------------------------
        // Step 2 — advanceOn: click to advance.
        // ----------------------------------------------------------------
        // advanceOn: an object with two properties:
        //   selector  (optional) — CSS selector of the element to listen on.
        //                          If omitted, the step's highlighted element
        //                          is used. If neither is available, document
        //                          is used as a fallback.
        //   event               — the DOM event type to listen for (e.g. 'click',
        //                          'input', 'change', 'submit').
        //
        // When the event fires TamperGuide automatically calls moveNext().
        // The Next button still works normally — advanceOn is an additional
        // trigger, not a replacement for the button.
        //
        // Cleanup: the event listener is removed as soon as the step changes
        // (whether by advanceOn, the Next button, Previous, or Escape).
        // There is no memory leak even if the step is skipped.
        {
          element: '#tg-demo-load-btn',
          advanceOn: {
            // Listen for a click on the Load Feature button.
            selector: '#tg-demo-load-btn',
            event: 'click',
          },
          popover: {
            title: 'advanceOn: click event',
            description: 'Click the "Load Feature" button in the demo panel to ' +
              'advance the tour. You can also click the Next button — advanceOn ' +
              'is a supplemental trigger, not a mandatory gate.',
            side: 'top',
            align: 'end',
          },
          // When the user clicks the button we also show the dynamic result
          // element so the next waitFor step has something to find.
          onHighlighted: function () {
            var btn = document.getElementById('tg-demo-load-btn');
            if (btn) {
              btn.addEventListener('click', function showResult() {
                btn.removeEventListener('click', showResult);
                // Simulate a short network delay before the result appears.
                // In a real SPA this would be an API response or a React render.
                setTimeout(function () {
                  var el = document.getElementById('tg-demo-dynamic-result');
                  if (el) el.style.display = 'block';
                }, 1200);
              });
            }
          },
        },

        // ----------------------------------------------------------------
        // Step 3 — waitFor: poll until the dynamic result element appears.
        // ----------------------------------------------------------------
        // waitFor: an object with two properties:
        //   selector  — CSS selector of the element to wait for.
        //   timeout   — maximum time to wait in milliseconds (default: 5000).
        //               After this duration, TamperGuide logs a WAIT_TIMEOUT
        //               warning and either skips the step (if moving forward)
        //               or shows it without an element (falling back to a
        //               centered popover). The tour never hangs indefinitely.
        //
        // While polling, TamperGuide shows the popover at the center of the
        // screen with a loading indicator if no element has been found yet.
        // Once the selector matches, the popover repositions to the element.
        //
        // Poll interval: TamperGuide checks the DOM every ~250 ms by default.
        {
          element: '#tg-demo-dynamic-result',
          waitFor: {
            // The result div starts hidden and is shown after ~1.2 s by the
            // click handler in step 2. TamperGuide will poll until it appears
            // or until the timeout is reached.
            selector: '#tg-demo-dynamic-result',

            // Give it 8 seconds — more than enough for our 1.2 s delay.
            // In a real script set this to the realistic worst-case render time.
            timeout: 8000,
          },
          popover: {
            title: 'waitFor: element appeared',
            description: 'The "Feature loaded" result appeared after a simulated ' +
              'delay. TamperGuide polled the DOM until the selector matched, then ' +
              'repositioned the popover on the element automatically.',
            side: 'top',
            align: 'end',
          },
        },

        // ----------------------------------------------------------------
        // Step 4 — advanceOn: input event (type to advance).
        // ----------------------------------------------------------------
        // This step listens for the 'input' event on a text field.
        // The tour advances the moment the user types any character.
        // Useful for onboarding flows where you want to confirm the user
        // has actually interacted with a field before moving on.
        {
          element: '#tg-demo-text-input',
          advanceOn: {
            selector: '#tg-demo-text-input',
            event: 'input',    // fires after every keystroke
          },
          popover: {
            title: 'advanceOn: input event',
            description: 'Type anything in the text field to advance the tour. ' +
              'The event listener is cleaned up automatically when the step ' +
              'changes, so no residual listeners remain.',
            side: 'top',
            align: 'end',
          },
        },

        // ----------------------------------------------------------------
        // Step 5 — Final slide.
        // ----------------------------------------------------------------
        {
          popover: {
            title: 'Tour Complete',
            description: 'Both features demonstrated: ' +
              'waitFor polled for a dynamically inserted element, and ' +
              'advanceOn converted user interactions into tour navigation. ' +
              'Neither feature adds persistent event listeners — all cleanup ' +
              'happens automatically when steps change or the tour ends.',
          },
        },

      ],
    });

    guide.drive();
  }


  GM_registerMenuCommand('Start waitFor & advanceOn Tour', startTour);

})();
