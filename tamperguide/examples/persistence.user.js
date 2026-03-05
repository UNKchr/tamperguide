// ==UserScript==
// @name         TamperGuide — Persistence Example
// @namespace    https://github.com/UNKchr/tamperguide
// @version      1.0.0
// @description  Demonstrates TamperGuide's tour progress persistence. Shows how
//               to save and resume tour state across page navigations, check
//               whether the tour was already completed, and reset saved progress.
//               Uses localStorage as the default storage backend, with commented-
//               out examples showing GM storage for cross-origin persistence.
// @author       UNKchr
// @match        *://*/*
// @require      https://cdn.jsdelivr.net/gh/UNKchr/tamperguide@v1.5.0/tamperguide/tamperGuide.js
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

// --------------------------------------------------------------------------
// NOTE: To use GM storage instead of localStorage, uncomment the two @grant
// lines below and change persistStorage to 'GM' in the options object below.
// GM storage persists across all origins where the userscript runs, while
// localStorage is scoped to the same origin.
//
// // @grant        GM_setValue
// // @grant        GM_getValue
// // @grant        GM_deleteValue
// --------------------------------------------------------------------------

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // PERSISTENCE_KEY — unique identifier for this tour
  // --------------------------------------------------------------------------
  // persistKey must be a non-empty string that is unique across all tours in
  // your userscript. A good practice is to include the site domain and a
  // version suffix so that major redesigns can reset progress for all users.
  //
  // Example: 'example.com-onboarding-v1'
  var PERSISTENCE_KEY = 'tamperguide-demo-persistence-v1';

  // --------------------------------------------------------------------------
  // createGuide — build the guide instance
  // --------------------------------------------------------------------------
  // We create a new instance each time so the example is self-contained, but
  // in a real userscript you would typically create the instance once at the
  // top level and reuse it across menu commands.
  function createGuide() {
    return tamperGuide({
      showProgress: true,
      animate: true,
      showButtons: ['next', 'previous', 'close'],

      // ------------------------------------------------------------------
      // persist: true — enable progress persistence.
      // ------------------------------------------------------------------
      // When true, TamperGuide saves the active step index to storage every
      // time the user advances. If the user navigates away mid-tour and then
      // returns, drive() resumes from the saved step automatically.
      persist: true,

      // ------------------------------------------------------------------
      // persistKey — storage namespace for this tour.
      // ------------------------------------------------------------------
      // Required when persist is true. Must be unique per tour. TamperGuide
      // stores data under this key to avoid conflicts with other scripts.
      persistKey: PERSISTENCE_KEY,

      // ------------------------------------------------------------------
      // persistStorage — which backend to use.
      // ------------------------------------------------------------------
      // 'localStorage' (default): stored in window.localStorage, scoped to
      //   the current origin (scheme + host + port). This works on most sites
      //   without any extra @grant permissions.
      //
      // 'GM': stored via GM_setValue / GM_getValue, available across all
      //   origins where the userscript is active. Requires adding:
      //     @grant GM_setValue
      //     @grant GM_getValue
      //     @grant GM_deleteValue
      //   to the userscript header.
      persistStorage: 'localStorage',
      //
      // To switch to GM storage, comment the line above and uncomment below:
      // persistStorage: 'GM',

      // ------------------------------------------------------------------
      // persistExpiry — how long (ms) saved progress remains valid.
      // ------------------------------------------------------------------
      // Default is 604800000 (7 days). After expiry the tour resets to step 0.
      // Set to 0 to keep progress indefinitely (no expiration).
      persistExpiry: 604800000,

      // ------------------------------------------------------------------
      // onDestroyed — detect tour end for post-completion logic.
      // ------------------------------------------------------------------
      // Use isCompleted() here to distinguish a completed tour from one the
      // user closed early. You can gate follow-up UI on completion status.
      onDestroyed: function (element, step, context) {
        if (context.driver.isCompleted()) {
          console.log('[TamperGuide demo] Tour completed — progress record saved.');
          console.log('[TamperGuide demo] Next page load will skip this tour.');
        } else {
          console.log('[TamperGuide demo] Tour closed early — progress saved at step',
            context.state.activeIndex, '.');
          console.log('[TamperGuide demo] Next page load will resume from that step.');
        }
      },

      steps: [

        // Step 1 of 5 — Introduction.
        {
          popover: {
            title: 'Persistence Demo',
            description: 'This tour saves progress to localStorage after each step. ' +
              'Navigate a few steps then reload the page — the tour will resume ' +
              'from where you left off.',
          },
        },

        // Step 2 of 5 — Highlight something on the page.
        {
          element: 'body > *:first-child',
          popover: {
            title: 'Step 2 of 5',
            description: 'Advance to at least step 3 and then reload the page. ' +
              'You should land back here on step 3 rather than at the beginning.',
            side: 'bottom',
          },
        },

        // Step 3 of 5 — Another element highlight.
        {
          element: 'a',
          popover: {
            title: 'Step 3 of 5',
            description: 'Progress has been saved up to this step. ' +
              'Reloading now will resume here.',
            side: 'bottom',
          },
        },

        // Step 4 of 5.
        {
          popover: {
            title: 'Step 4 of 5',
            description: 'Almost done. After finishing step 5, TamperGuide records ' +
              'the tour as completed. Subsequent calls to drive() will do nothing ' +
              'until you reset progress.',
          },
        },

        // Step 5 of 5 — Final slide.
        {
          popover: {
            title: 'Tour Complete',
            description: 'The tour is now marked as completed. Use the ' +
              '"Reset Progress" menu command to clear the saved data and ' +
              'run the tour from the beginning again.',
          },
        },

      ],
    });
  }


  // --------------------------------------------------------------------------
  // startTour — start (or resume) the persistent tour
  // --------------------------------------------------------------------------
  function startTour() {
    var guide = createGuide();

    // isCompleted() returns true if the user has previously finished this tour
    // and the completion record has not yet expired. When true, drive() would
    // be a no-op — so we inform the user instead of silently doing nothing.
    if (guide.isCompleted()) {
      console.log('[TamperGuide demo] Tour was already completed.');
      console.log('[TamperGuide demo] Use "Reset Progress" to run it again.');
      // In a real userscript you might show a small notification here, or
      // simply skip launching the tour entirely.
      return;
    }

    // drive() resumes from the saved step when persist is true and a saved
    // step index exists. If there is no saved data (first run or after reset),
    // it starts from step 0. You can override this by passing an explicit index:
    //   guide.drive(0);  // always start from the beginning
    guide.drive();
  }


  // --------------------------------------------------------------------------
  // resetProgress — clear saved data so the tour can run again from scratch
  // --------------------------------------------------------------------------
  function resetProgress() {
    var guide = createGuide();

    // resetProgress() deletes the persisted step index and completion flag for
    // this tour's persistKey. The next call to drive() will start from step 0.
    // This is useful during development or when you want to let users replay
    // the tour on demand.
    guide.resetProgress();

    console.log('[TamperGuide demo] Progress reset. Run "Start Persistent Tour" again.');
  }


  // Register both commands in the Tampermonkey extension menu.
  GM_registerMenuCommand('Start Persistent Tour', startTour);
  GM_registerMenuCommand('Reset Tour Progress',   resetProgress);

})();
