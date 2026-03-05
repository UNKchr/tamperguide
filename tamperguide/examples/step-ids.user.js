// ==UserScript==
// @name         TamperGuide — Step IDs & moveToStep Example
// @namespace    https://github.com/UNKchr/tamperguide
// @version      1.0.0
// @description  Demonstrates step id properties and guide.moveToStep(). Steps
//               can be assigned unique string IDs so they can be targeted by
//               name instead of numeric index. Also shows how step IDs interact
//               with persistence: the persisted step index is still a number,
//               but IDs remain stable even if steps are reordered.
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
  // Keep a module-level reference so menu commands can call moveToStep()
  // on an already-running tour.
  // --------------------------------------------------------------------------
  var guide = null;


  // --------------------------------------------------------------------------
  // startTour — create and drive the guide instance
  // --------------------------------------------------------------------------
  function startTour() {

    guide = tamperGuide({
      showProgress: true,
      animate: true,
      showButtons: ['next', 'previous', 'close'],

      onDestroyed: function () {
        guide = null;
        console.log('[TamperGuide demo] Tour ended; guide reference cleared.');
      },

      steps: [

        // ----------------------------------------------------------------
        // id: a unique string identifier for the step.
        // ----------------------------------------------------------------
        // The id property is optional. When present, it must be a non-empty
        // string that is unique within this guide's steps array. Duplicate
        // IDs throw a TamperGuideError at configuration time.
        //
        // IDs serve two purposes:
        //   1. They let you call guide.moveToStep('some-id') to navigate by
        //      name rather than a fragile numeric index.
        //   2. They appear in onStepChange events (the stepId field), making
        //      analytics data self-documenting.
        {
          id: 'welcome',
          popover: {
            title: 'Step IDs Demo',
            description: 'This tour assigns a unique id to every step. ' +
              'Use the Tampermonkey menu commands to jump directly to any ' +
              'step by name, even while the tour is already running.',
          },
        },

        {
          id: 'first-element',
          element: 'body > *:first-child',
          popover: {
            title: 'Step: first-element',
            description: 'This step\'s id is "first-element". ' +
              'Call guide.moveToStep("first-element") to jump here from ' +
              'anywhere in the tour.',
            side: 'bottom',
          },
        },

        {
          id: 'links-section',
          element: 'a',
          popover: {
            title: 'Step: links-section',
            description: 'This step\'s id is "links-section". ' +
              'Note that the menu command "Jump to: links-section" will navigate ' +
              'here even if you are currently on step 4 or 5.',
            side: 'bottom',
          },
        },

        // ----------------------------------------------------------------
        // Step with an ID but no element — a centered popover.
        // ----------------------------------------------------------------
        // id works on all step types, including centered (element-less) ones.
        {
          id: 'info-slide',
          popover: {
            title: 'Step: info-slide',
            description: 'This is a centered popover (no element). ' +
              'Its id is "info-slide". moveToStep() works on any step, ' +
              'regardless of whether it highlights an element.',
          },
        },

        {
          id: 'final',
          popover: {
            title: 'Step: final',
            description: 'This is the last step. Its id is "final". ' +
              'IDs are stable across reruns — they do not change when steps ' +
              'are added or removed from the middle of the array, making ' +
              'them safer than numeric indices for long-lived userscripts.',
          },
        },

      ],
    });

    // drive() starts at step 0 (the 'welcome' step).
    // You can pass a numeric index to start elsewhere:
    //   guide.drive(2);   // start at index 2 ('links-section')
    guide.drive();
  }


  // --------------------------------------------------------------------------
  // jumpToStep — call moveToStep() on the running guide
  // --------------------------------------------------------------------------
  // moveToStep(id): navigates the tour to the step whose id matches the
  // provided string.
  //
  // Behaviour:
  //   - If the tour is already active, the current step is deselected and the
  //     named step is activated. Direction is reported as 'jump' in
  //     onStepChange events.
  //   - If the tour has not been started yet (drive() not called), moveToStep()
  //     initialises the tour and jumps directly to the named step — no need
  //     to call drive() first.
  //   - If no step has the given id, TamperGuide throws a TamperGuideError
  //     with code INVALID_STEP_INDEX.
  function jumpToStep(id) {
    return function () {
      if (!guide) {
        // The tour has not been started; call startTour first to create it,
        // then jump to the requested step.
        startTour();
      }
      // Small delay so drive() has time to activate before moveToStep() is
      // called. In a real script you would typically call moveToStep() from
      // within an event handler or hook, where the guide is already running.
      setTimeout(function () {
        if (guide) {
          try {
            guide.moveToStep(id);
          } catch (err) {
            // A TamperGuideError with code INVALID_STEP_INDEX is thrown when
            // no step with the given id exists. Always handle this defensively.
            console.error('[TamperGuide demo] moveToStep failed:', err.message);
          }
        }
      }, 50);
    };
  }


  // --------------------------------------------------------------------------
  // showStepCount — demonstrate getStepCount()
  // --------------------------------------------------------------------------
  // getStepCount() returns the total number of steps configured in the tour.
  // It is available on the guide instance at any time, even before drive() is
  // called and after the tour has been destroyed (as long as the instance exists).
  //
  // Useful for displaying a progress counter, computing percentage completion,
  // or validating a jump target before calling moveToStep().
  function showStepCount() {
    // Create a temporary guide just to demonstrate getStepCount().
    // In real usage you would call this on an existing instance.
    var tempGuide = tamperGuide({
      steps: [
        { id: 'a', popover: { title: 'A', description: 'Step A' } },
        { id: 'b', popover: { title: 'B', description: 'Step B' } },
        { id: 'c', popover: { title: 'C', description: 'Step C' } },
      ],
    });

    console.log('[TamperGuide demo] getStepCount() =', tempGuide.getStepCount());
    // → 3

    // getStepCount() reflects the current steps array. If you later call
    // guide.setSteps([...]) with a different array, getStepCount() returns
    // the new length.
  }


  // --------------------------------------------------------------------------
  // Persistence + step IDs note
  // --------------------------------------------------------------------------
  // When persist: true is enabled, TamperGuide saves the active step INDEX
  // (a number), not the step ID. This means:
  //
  //   - If you only ADD steps at the end of the array, existing progress is
  //     unaffected: index 2 still points to the same step.
  //   - If you INSERT or REMOVE steps in the middle, saved indices may point
  //     to wrong steps after the update. In that case, bump persistKey (e.g.
  //     from 'onboarding-v1' to 'onboarding-v2') to reset all users' progress.
  //
  // Step IDs do NOT automatically stabilise persistence across step reorders.
  // They are primarily a navigation and analytics convenience.


  // --------------------------------------------------------------------------
  // Register menu commands
  // --------------------------------------------------------------------------
  GM_registerMenuCommand('Start Step IDs Tour',          startTour);
  GM_registerMenuCommand('Jump to: first-element',       jumpToStep('first-element'));
  GM_registerMenuCommand('Jump to: links-section',       jumpToStep('links-section'));
  GM_registerMenuCommand('Jump to: info-slide',          jumpToStep('info-slide'));
  GM_registerMenuCommand('Jump to: final',               jumpToStep('final'));
  GM_registerMenuCommand('Show getStepCount() in console', showStepCount);

})();
