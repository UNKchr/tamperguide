// ==UserScript==
// @name         TamperGuide — Conditional Steps Example
// @namespace    https://github.com/UNKchr/tamperguide
// @version      1.0.0
// @description  Demonstrates the `when` property on step objects. Some steps
//               are always shown; others are conditionally skipped at runtime
//               based on DOM state. Covers fail-open behaviour when `when`
//               throws, and what happens when all remaining steps are filtered.
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
  // DOM helpers — inject demo elements
  // --------------------------------------------------------------------------
  // To make this example self-contained on any page we inject a small set of
  // demo elements into the document body. In a real userscript you would
  // target elements that already exist on the host page.

  var demoContainer = null;

  function ensureDemoElements() {
    if (demoContainer) return;

    demoContainer = document.createElement('div');
    demoContainer.id = 'tg-conditional-demo';
    demoContainer.style.cssText = [
      'position: fixed',
      'bottom: 16px',
      'right: 16px',
      'z-index: 9000',
      'background: #f8fafc',
      'border: 1px solid #cbd5e1',
      'border-radius: 8px',
      'padding: 16px 20px',
      'font-family: sans-serif',
      'font-size: 13px',
      'line-height: 1.5',
      'color: #334155',
      'box-shadow: 0 4px 12px rgba(0,0,0,0.12)',
      'max-width: 280px',
    ].join(';');

    demoContainer.innerHTML = [
      '<p style="margin:0 0 10px;font-weight:700">Conditional Steps Demo</p>',
      '<label style="display:flex;align-items:center;gap:8px;cursor:pointer">',
      '  <input type="checkbox" id="tg-demo-checkbox">',
      '  Enable advanced features',
      '</label>',
      '<p id="tg-demo-admin-badge" style="display:none;margin:8px 0 0;' +
        'background:#dbeafe;color:#1e40af;padding:4px 8px;border-radius:4px">',
      '  Admin mode active',
      '</p>',
    ].join('');

    document.body.appendChild(demoContainer);
  }

  function removeDemoElements() {
    if (demoContainer) {
      demoContainer.parentNode && demoContainer.parentNode.removeChild(demoContainer);
      demoContainer = null;
    }
  }


  // --------------------------------------------------------------------------
  // startTour
  // --------------------------------------------------------------------------
  function startTour() {
    ensureDemoElements();

    const guide = tamperGuide({
      showProgress: true,
      animate: true,
      showButtons: ['next', 'previous', 'close'],

      onDestroyed: function () {
        // Clean up our injected demo elements when the tour ends.
        removeDemoElements();
      },

      steps: [

        // ----------------------------------------------------------------
        // Step 1 — Always shown (no `when` property).
        // ----------------------------------------------------------------
        // Steps without a `when` property are always included. This is the
        // default behaviour: every step runs unless explicitly filtered.
        {
          popover: {
            title: 'Conditional Steps',
            description: 'This tour has steps that only appear when a specific ' +
              'DOM condition is met. Look at the demo panel in the bottom-right ' +
              'corner and follow the instructions.',
          },
        },

        // ----------------------------------------------------------------
        // Step 2 — Always shown.
        // ----------------------------------------------------------------
        {
          element: '#tg-conditional-demo',
          popover: {
            title: 'The Demo Panel',
            description: 'This is the control panel injected for this demo. ' +
              'The next step only appears if the checkbox is checked. ' +
              'Try both paths: run with the box unchecked, then reset and ' +
              'run again with it checked.',
            side: 'top',
            align: 'end',
          },
        },

        // ----------------------------------------------------------------
        // Step 3 — Conditional: shown only when the checkbox is checked.
        // ----------------------------------------------------------------
        // `when` accepts a zero-argument function that returns a boolean.
        // TamperGuide evaluates `when` lazily, at the moment the tour tries
        // to activate this step (not when tamperGuide() is called). This means
        // the DOM query always reflects the live state at transition time.
        //
        // Return values:
        //   true  → the step is activated normally
        //   false → the step is skipped; the tour advances to the next eligible
        //           step in the current navigation direction
        {
          element: '#tg-demo-checkbox',
          when: function () {
            // Check whether the user has ticked the checkbox.
            var cb = document.getElementById('tg-demo-checkbox');
            return !!(cb && cb.checked);
          },
          popover: {
            title: 'Advanced Features (conditional)',
            description: 'You checked the box, so this step is included. ' +
              'If you had left it unchecked, TamperGuide would have silently ' +
              'skipped this step and jumped to step 4.',
            side: 'top',
          },
        },

        // ----------------------------------------------------------------
        // Step 4 — Conditional: shown only when the admin badge is visible.
        // ----------------------------------------------------------------
        // Multiple steps can carry `when` conditions. They are evaluated
        // independently for each step at transition time.
        {
          element: '#tg-demo-admin-badge',
          when: function () {
            // Show this step only if the admin badge element exists and is
            // currently displayed (not hidden via display:none).
            var badge = document.getElementById('tg-demo-admin-badge');
            if (!badge) return false;
            return badge.style.display !== 'none' &&
              getComputedStyle(badge).display !== 'none';
          },
          popover: {
            title: 'Admin Mode (conditional)',
            description: 'The admin badge is visible, so this step appears. ' +
              'In a real script you might show extra steps only for admin users ' +
              'or only on specific pages.',
            side: 'top',
          },
        },

        // ----------------------------------------------------------------
        // Step 5 — Conditional: demonstrates the fail-open guarantee.
        // ----------------------------------------------------------------
        // If the `when` function throws an exception, TamperGuide catches the
        // error, logs a console warning (code: HOOK_ERROR), and shows the step
        // anyway. This "fail-open" behaviour means a bug in your condition
        // function never silently hides content from the user.
        {
          element: 'body > *:first-child',
          when: function () {
            // This function always throws to illustrate fail-open behaviour.
            // TamperGuide will catch it, warn in the console, and show the step.
            throw new Error('[demo] intentional error in when() — step shown anyway');
          },
          popover: {
            title: 'Fail-Open Guarantee',
            description: 'The `when` function for this step threw an error. ' +
              'TamperGuide caught it and showed the step rather than crashing. ' +
              'Check the browser console to see the HOOK_ERROR warning.',
            side: 'bottom',
          },
        },

        // ----------------------------------------------------------------
        // Step 6 — Always shown: closing slide.
        // ----------------------------------------------------------------
        {
          popover: {
            title: 'Tour Complete',
            description: 'Conditional steps let you build a single tour that ' +
              'adapts to different user states, feature flags, or page variants — ' +
              'all without managing multiple separate step arrays.',
          },
        },

      ],
    });

    // drive() starts at step 0. Conditional steps are evaluated one-by-one
    // as the tour advances — not all at once at the start. This means your
    // `when` functions always see the most current DOM state.
    guide.drive();
  }


  // --------------------------------------------------------------------------
  // startAllSkippedDemo — show what happens when all steps are filtered out
  // --------------------------------------------------------------------------
  // If every remaining step in the current navigation direction returns false
  // from its `when` function, TamperGuide:
  //   - When moving forward: destroys the tour (treated as natural completion).
  //   - When moving backward: ignores the navigation (no previous eligible step).
  //
  // This demo creates a short tour where every non-trivial step is conditionally
  // hidden so you can see that behaviour in practice.
  function startAllSkippedDemo() {
    ensureDemoElements();

    const guide = tamperGuide({
      animate: true,
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],

      onDestroyed: function () {
        removeDemoElements();
      },

      steps: [
        {
          popover: {
            title: 'All-Skipped Demo',
            description: 'Click Next. Steps 2 and 3 both return false from ' +
              '`when`, so TamperGuide will skip them and end the tour immediately ' +
              'without showing either step.',
          },
        },
        {
          // This step will always be skipped.
          element: '#tg-demo-checkbox',
          when: function () { return false; },
          popover: {
            title: 'Skipped Step 2',
            description: 'You should never see this step.',
          },
        },
        {
          // This step will also always be skipped.
          element: '#tg-demo-admin-badge',
          when: function () { return false; },
          popover: {
            title: 'Skipped Step 3',
            description: 'You should never see this step either.',
          },
        },
      ],
    });

    guide.drive();
  }


  GM_registerMenuCommand('Start Conditional Steps Tour', startTour);
  GM_registerMenuCommand('Demo: All Steps Skipped',      startAllSkippedDemo);

})();
