// ==UserScript==
// @name         TamperGuide — Accessibility Example
// @namespace    https://github.com/UNKchr/tamperguide
// @version      1.0.0
// @description  Demonstrates TamperGuide's built-in accessibility features:
//               custom ariaLabel values on steps, focus trapping inside the
//               popover, and aria-live region announcements for screen readers.
//               Includes detailed comments explaining each ARIA behaviour.
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
  // startTour
  // --------------------------------------------------------------------------
  function startTour() {
    tamperGuide({
      showProgress: true,
      animate: true,
      showButtons: ['next', 'previous', 'close'],

      steps: [

        // ----------------------------------------------------------------
        // Step 1 — Default aria-live announcement (no ariaLabel).
        // ----------------------------------------------------------------
        // When a step does NOT define an ariaLabel, TamperGuide automatically
        // populates the aria-live region with a default string based on the
        // popover title and the current progress:
        //
        //   "Step 1 of 5: Accessibility Demo"
        //
        // This default is sufficient for most steps and ensures screen reader
        // users always receive a meaningful announcement without any extra work.
        {
          popover: {
            title: 'Accessibility Demo',
            description: 'TamperGuide includes built-in accessibility support. ' +
              'Every popover has role="dialog", and an aria-live region announces ' +
              'each step transition to screen readers.',
          },
        },

        // ----------------------------------------------------------------
        // Step 2 — Custom ariaLabel.
        // ----------------------------------------------------------------
        // ariaLabel: an optional string on the step object (not inside popover).
        // When provided it REPLACES the default "Step N of M: Title" announcement
        // in the aria-live region. Use it when the popover title alone does not
        // give sufficient context for a screen reader user. For example:
        //   - When the title is short and the important context is in the description.
        //   - When you want to include the element's purpose in the announcement.
        //   - When you are referencing a specific feature by its full name.
        //
        // The ariaLabel is NOT rendered visually — it only affects the hidden
        // aria-live region. Sighted users will see the normal title and description.
        {
          element: 'body > *:first-child',
          ariaLabel: 'Accessibility step 2 of 5: This is the first content element on the page. It is now highlighted.',
          popover: {
            title: 'First Element',
            description: 'This step has a custom ariaLabel. Screen readers announce ' +
              'the ariaLabel string instead of the default "Step N of M: title" text. ' +
              'The ariaLabel is placed in an aria-live="polite" region so it is ' +
              'announced without interrupting the current reading flow.',
            side: 'bottom',
          },
        },

        // ----------------------------------------------------------------
        // Step 3 — Focus trapping.
        // ----------------------------------------------------------------
        // Focus trapping: when a popover is visible, Tab and Shift+Tab
        // cycle through only the focusable elements INSIDE the popover
        // (typically: Previous button, Next/Done button, Close button).
        //
        // This prevents keyboard focus from escaping into the dimmed page
        // content behind the overlay. Without focus trapping, a sighted
        // keyboard user would Tab into invisible, inaccessible form fields
        // and links that are covered by the overlay.
        //
        // The focus trap is installed when the popover opens and removed
        // when the popover closes or the tour is destroyed, so it never
        // interferes with normal page navigation before or after the tour.
        //
        // Note: Tab and Shift+Tab also advance / go back in the tour (as
        // configured by allowKeyboardControl). This is intentional — it means
        // keyboard users can navigate the entire tour without using the mouse.
        {
          element: 'a',
          ariaLabel: 'Accessibility step 3 of 5: The first hyperlink on the page. Use Tab to move to the Next button inside this dialog.',
          popover: {
            title: 'Focus Trapping',
            description: 'Press Tab while this popover is open. Focus stays ' +
              'within the popover buttons and never reaches the dimmed page ' +
              'content behind the overlay. Shift+Tab cycles in reverse. ' +
              'The trap is removed automatically when the popover closes.',
            side: 'bottom',
          },
        },

        // ----------------------------------------------------------------
        // Step 4 — ARIA attributes on the popover element.
        // ----------------------------------------------------------------
        // The popover <div> is rendered with:
        //   role="dialog"       — identifies it as an ARIA dialog to assistive
        //                         technology. Screen readers announce "dialog"
        //                         when focus enters the element.
        //   aria-modal="false"  — set to false because the overlay does not
        //                         prevent AT users from reading behind it;
        //                         TamperGuide uses visual overlay only. Setting
        //                         this to true would tell AT to restrict browsing
        //                         to the dialog contents, which we do not enforce.
        //   aria-label          — set to the popover title text, giving the dialog
        //                         an accessible name. Assistive technology reads
        //                         this when the dialog receives focus.
        //
        // The Close (X) button has aria-label="Close" so its action is clear
        // to screen reader users even when no visible text is present.
        //
        // Note: these attributes are added automatically by TamperGuide.
        // You do not need to configure anything to get them.
        {
          element: 'body > *:first-child',
          ariaLabel: 'Accessibility step 4 of 5: Popover ARIA attributes. The dialog has role="dialog" and aria-modal="false".',
          popover: {
            title: 'Popover ARIA Attributes',
            description: 'The popover has role="dialog", aria-modal="false", and ' +
              'aria-label set to the title text. The Close button has ' +
              'aria-label="Close". These attributes are injected by TamperGuide ' +
              'automatically — no extra configuration needed.',
            side: 'bottom',
          },
        },

        // ----------------------------------------------------------------
        // Step 5 — aria-live region.
        // ----------------------------------------------------------------
        // TamperGuide injects a single hidden <div aria-live="polite"> into
        // the document body when the tour starts. On each step transition,
        // TamperGuide updates the text content of this region with:
        //   - The step's ariaLabel (if defined), or
        //   - The default "Step N of M: <title>" string.
        //
        // aria-live="polite" means the screen reader waits for the user to
        // finish reading the current content before announcing the update.
        // This prevents jarring interruptions when the user is in the middle
        // of reading a long description.
        //
        // The aria-live region is removed from the DOM when the tour is
        // destroyed, so it does not leave behind any residual ARIA artefacts.
        {
          ariaLabel: 'Accessibility step 5 of 5: Final slide. This completes the accessibility demonstration.',
          popover: {
            title: 'aria-live Announcements',
            description: 'TamperGuide maintains a hidden aria-live="polite" region. ' +
              'On each step change it writes the ariaLabel (or a default title string) ' +
              'into the region. Screen readers announce it politely between reading tasks. ' +
              'The region is removed when the tour ends.',
          },
        },

      ],
    }).drive();
  }


  GM_registerMenuCommand('Start Accessibility Demo Tour', startTour);

})();
