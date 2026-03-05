// ==UserScript==
// @name         TamperGuide — Advanced Hooks Example
// @namespace    https://github.com/UNKchr/tamperguide
// @version      1.0.0
// @description  Demonstrates every TamperGuide lifecycle hook: onHighlightStarted,
//               onHighlighted, onDeselected, onNextClick (with cancellation),
//               onDestroyStarted (with cancellation), onDestroyed, and
//               onPopoverRender (custom DOM injection into the popover).
// @author       UNKchr
// @match        *://*/*
// @require      https://cdn.jsdelivr.net/gh/UNKchr/tamperguide@v1.4.1/tamperguide/tamperGuide.js
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // Simulate a minimal analytics or logging helper for the examples below.
  // In a real script this would call your preferred analytics service.
  function trackEvent(name, data) {
    console.log('[Analytics]', name, data || {});
  }

  // Keep a reference outside startTour so hooks can access it.
  let guide = null;

  function startTour() {

    guide = tamperGuide({
      showProgress: true,
      animate: true,
      showButtons: ['next', 'previous', 'close'],

      // ------------------------------------------------------------------
      // onHighlightStarted (global)
      // ------------------------------------------------------------------
      // Called at the very start of each step transition, before the target
      // element scrolls into view or the popover is rendered.
      //
      // Signature: function (element, step, { config, state, driver })
      //   element - the DOM element that will be highlighted (may be null
      //             for centered/popover-only steps)
      //   step    - the full step configuration object
      //   context - { config, state, driver }
      //             config  - the resolved guide configuration
      //             state   - current internal state snapshot
      //             driver  - the guide API instance (same as `guide`)
      //
      // Return value is ignored (this hook is not cancellable).
      onHighlightStarted: function (element, step, context) {
        var index = context.state.activeIndex;
        trackEvent('tour:step_start', { index: index, hasElement: !!element });
      },

      // ------------------------------------------------------------------
      // onHighlighted (global)
      // ------------------------------------------------------------------
      // Called after the popover is rendered and fully visible. The element
      // is now highlighted and the user can see the popover content.
      //
      // This is the right place to:
      //   - record that the user saw a specific step
      //   - update external UI that depends on the active step
      //   - check step-specific conditions before the user can proceed
      onHighlighted: function (element, step, context) {
        var index = context.state.activeIndex;
        trackEvent('tour:step_visible', { index: index });

        // Access the driver API through context to read state.
        if (context.driver.isLastStep()) {
          console.log('[Tour] User reached the final step.');
        }
      },

      // ------------------------------------------------------------------
      // onDeselected (global)
      // ------------------------------------------------------------------
      // Called when leaving a step, before the next step begins or before
      // the tour is destroyed. Useful for undoing DOM changes made in
      // onHighlighted (e.g. removing a class you added to the element).
      onDeselected: function (element, step, context) {
        var index = context.state.activeIndex;
        trackEvent('tour:step_leave', { index: index });
      },

      // ------------------------------------------------------------------
      // onNextClick (global)
      // ------------------------------------------------------------------
      // Called when the user clicks the Next button or presses ArrowRight / Tab.
      //
      // Returning false from this hook CANCELS the navigation — the tour
      // stays on the current step. Any other return value (or no return)
      // lets navigation proceed normally.
      //
      // Use this to enforce completion conditions before advancing.
      onNextClick: function (element, step, context) {
        var index = context.state.activeIndex;

        // Example: block advancing past step 1 unless a checkbox is checked.
        // Replace with real validation logic as needed.
        if (index === 1) {
          var checkbox = document.querySelector('#my-required-checkbox');
          if (checkbox && !checkbox.checked) {
            // Show a brief warning inside the popover instead of advancing.
            var desc = document.querySelector('.tg-popover-description');
            if (desc) {
              var original = desc.innerHTML;
              desc.innerHTML = '<strong style="color:#c0392b">Please check the box before continuing.</strong>';
              setTimeout(function () {
                if (desc) desc.innerHTML = original;
              }, 2000);
            }
            return false; // cancel the Next action
          }
        }
        // No return (or return undefined) — navigation proceeds normally.
      },

      // ------------------------------------------------------------------
      // onPrevClick (global)
      // ------------------------------------------------------------------
      // Called when the user clicks Previous or presses ArrowLeft / Shift+Tab.
      //
      // Returning false cancels going back. Useful for steps that should not
      // be revisited once confirmed.
      onPrevClick: function (element, step, context) {
        trackEvent('tour:prev_click', { fromIndex: context.state.activeIndex });
        // Return nothing to allow the back navigation.
      },

      // ------------------------------------------------------------------
      // onCloseClick (global)
      // ------------------------------------------------------------------
      // Called when the user presses Escape, clicks the overlay, or clicks
      // the X button.
      //
      // Returning false prevents the tour from closing.
      onCloseClick: function (element, step, context) {
        // Example: ask the user to confirm before abandoning the tour.
        // window.confirm is a blocking call — use sparingly.
        var confirmed = window.confirm('Are you sure you want to close the tour?');
        if (!confirmed) {
          return false; // keep the tour open
        }
        trackEvent('tour:closed_early', { atIndex: context.state.activeIndex });
        // Returning nothing lets the close action proceed.
      },

      // ------------------------------------------------------------------
      // onDestroyStarted (global)
      // ------------------------------------------------------------------
      // Called before the tour is fully destroyed. This fires both when the
      // user closes the tour and when the tour ends naturally (last step done).
      //
      // Returning false cancels the destruction entirely (the tour stays open).
      // Note: returning false from onCloseClick also prevents reaching this hook.
      onDestroyStarted: function (element, step, context) {
        trackEvent('tour:destroy_started', {});
        // Return nothing to allow destruction to proceed.
      },

      // ------------------------------------------------------------------
      // onDestroyed (global)
      // ------------------------------------------------------------------
      // Called after all DOM elements (overlay, popover) are removed and all
      // event listeners are cleaned up. The guide instance is now inert.
      //
      // This hook cannot be cancelled — destruction has already happened.
      onDestroyed: function (element, step, context) {
        trackEvent('tour:destroyed', {});
        guide = null; // release the reference
        console.log('[Tour] Tour fully cleaned up.');
      },

      // ------------------------------------------------------------------
      // onPopoverRender (global)
      // ------------------------------------------------------------------
      // Called after the popover's inner DOM is built (title, description,
      // footer, buttons) but before the popover fades in. Use this to inject
      // custom elements such as icons, images, progress bars, or extra links.
      //
      // Signature: function (popoverElement, { config, state })
      //   popoverElement - the popover <div> DOM node
      //   config         - resolved guide configuration
      //   state          - current internal state snapshot
      onPopoverRender: function (popoverEl, context) {
        var index = context.state.activeIndex;

        // Add a small step-specific badge to the top-left of the popover.
        var badge = document.createElement('span');
        badge.textContent = 'Step ' + (index + 1);
        badge.style.cssText = [
          'position: absolute',
          'top: 8px',
          'left: 8px',
          'background: #3b82f6',
          'color: #fff',
          'font-size: 10px',
          'font-weight: 700',
          'padding: 2px 6px',
          'border-radius: 4px',
          'font-family: sans-serif',
        ].join(';');
        popoverEl.appendChild(badge);
      },

      steps: [
        {
          popover: {
            title: 'Hooks Demo',
            description: 'Open the browser console to see hook events logged as you navigate through this tour.',
          },
        },
        {
          // Step-level hook: overrides the global onHighlighted for this step only.
          onHighlighted: function (element, step, context) {
            trackEvent('tour:custom_step_2_highlight', { tag: element ? element.tagName : null });
          },
          element: 'body > *:first-child',
          popover: {
            title: 'First Element',
            description: 'This step has its own onHighlighted hook that overrides the global one.',
            side: 'bottom',
          },
        },
        {
          element: 'a',
          popover: {
            title: 'A Link',
            description: 'Navigate forward using the button, the arrow keys, or the Tab key.',
            side: 'bottom',
            // Per-step button override: hide the Previous button on this step.
            showButtons: ['next', 'close'],
          },
        },
        {
          popover: {
            title: 'Tour Complete',
            description: 'All lifecycle hooks have fired. Check the browser console for the event log.',
          },
        },
      ],
    });

    guide.drive();
  }

  GM_registerMenuCommand('Start Hooks Demo Tour', startTour);

})();
