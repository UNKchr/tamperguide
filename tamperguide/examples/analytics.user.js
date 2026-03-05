// ==UserScript==
// @name         TamperGuide — Analytics Example
// @namespace    https://github.com/UNKchr/tamperguide
// @version      1.0.0
// @description  Demonstrates the TamperGuide analytics hooks: onStepChange and
//               onTourComplete. Shows how to capture step transition events with
//               timing data, distinguish completed vs abandoned tours, track
//               navigation direction, and format console output clearly for
//               developers to inspect the data structure.
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
  // Analytics store
  // --------------------------------------------------------------------------
  // In a real userscript this data would be sent to your analytics endpoint.
  // Here we accumulate events in memory and display them when the tour ends.
  var analyticsEvents = [];
  var tourStartTime   = null;


  // --------------------------------------------------------------------------
  // formatMs — convert milliseconds to a readable string
  // --------------------------------------------------------------------------
  function formatMs(ms) {
    if (ms < 1000) return ms + ' ms';
    return (ms / 1000).toFixed(1) + ' s';
  }


  // --------------------------------------------------------------------------
  // startTour
  // --------------------------------------------------------------------------
  function startTour() {
    // Reset the event log for each fresh tour run.
    analyticsEvents = [];
    tourStartTime   = Date.now();

    const guide = tamperGuide({
      showProgress: true,
      animate: true,
      showButtons: ['next', 'previous', 'close'],

      // ------------------------------------------------------------------
      // onStepChange (global only — cannot be set per step)
      // ------------------------------------------------------------------
      // Called each time the active step changes, including the very first
      // step when drive() is called. Receives a step event object:
      //
      //   {
      //     index     : number        — zero-based index of the NEW active step
      //     stepId    : string | null — the step's id property, or null
      //     direction : 'forward' | 'backward' | 'jump'
      //                   'forward'  — user pressed Next or ArrowRight
      //                   'backward' — user pressed Previous or ArrowLeft
      //                   'jump'     — moveTo() or moveToStep() was called
      //     timestamp : number        — Unix timestamp (ms) of the transition
      //   }
      //
      // onStepChange is passive: its return value is ignored and cannot cancel
      // navigation. Keep work here lightweight — avoid blocking operations.
      onStepChange: function (event) {
        // Calculate how long the user spent on the previous step.
        var now       = Date.now();
        var sinceStart = now - tourStartTime;
        var dwell     = analyticsEvents.length > 0
          ? now - analyticsEvents[analyticsEvents.length - 1].timestamp
          : 0;   // first transition has no previous step to dwell on

        // Compose a structured event record.
        var record = {
          type:      'step_change',
          stepIndex: event.index,
          stepId:    event.stepId,
          direction: event.direction,
          timestamp: event.timestamp,
          msSinceStart: sinceStart,
          dwellOnPrevMs: dwell,
        };
        analyticsEvents.push(record);

        // Log in a format that is easy to read in the browser console.
        console.groupCollapsed(
          '[Analytics] step_change → step %d (%s) | direction: %s | +%s since start',
          event.index,
          event.stepId || 'no-id',
          event.direction,
          formatMs(sinceStart)
        );
        console.log('Full event object (from TamperGuide):', event);
        console.log('Augmented record (our data):', record);
        console.groupEnd();
      },

      // ------------------------------------------------------------------
      // onTourComplete (global only)
      // ------------------------------------------------------------------
      // Called when the tour ends, regardless of whether the user completed
      // all steps or closed the tour early. Receives a summary object:
      //
      //   {
      //     completed    : boolean — true if the user reached the last step
      //                             and pressed Done / Next; false if they
      //                             closed the tour before the end.
      //     exitStep     : number  — index of the step that was active when
      //                             the tour ended (last step for completed
      //                             tours, any step for abandoned ones).
      //     totalSteps   : number  — total number of configured steps.
      //     startTime    : number  — Unix timestamp (ms) when drive() was called.
      //     endTime      : number  — Unix timestamp (ms) when the tour ended.
      //     duration     : number  — total session duration in milliseconds
      //                             (endTime − startTime).
      //   }
      //
      // onTourComplete is passive: its return value is ignored.
      onTourComplete: function (summary) {
        var outcome = summary.completed ? 'COMPLETED' : 'ABANDONED';
        var pct     = summary.totalSteps > 0
          ? Math.round(((summary.exitStep + 1) / summary.totalSteps) * 100)
          : 0;

        console.group('[Analytics] tour_%s', outcome.toLowerCase());

        console.log('Outcome       :', outcome);
        console.log('Exit step     :', summary.exitStep,
          '(step ' + (summary.exitStep + 1) + ' of ' + summary.totalSteps + ')');
        console.log('Progress      :', pct + '%');
        console.log('Total duration:', formatMs(summary.duration));
        console.log('Steps seen    :', analyticsEvents.length);

        // Break down time spent per step.
        if (analyticsEvents.length > 1) {
          console.group('Time per step (dwell)');
          for (var i = 1; i < analyticsEvents.length; i++) {
            var ev = analyticsEvents[i];
            console.log(
              'Step %d (%s) — dwell: %s',
              ev.stepIndex - 1,
              analyticsEvents[i - 1].stepId || 'no-id',
              formatMs(ev.dwellOnPrevMs)
            );
          }
          console.groupEnd();
        }

        // Detect back-navigation (backward steps).
        var backCount = analyticsEvents.filter(function (e) {
          return e.direction === 'backward';
        }).length;
        if (backCount > 0) {
          console.log('Back-navigations:', backCount);
        }

        console.log('Full summary object (from TamperGuide):', summary);
        console.log('Accumulated step events:', analyticsEvents);

        console.groupEnd();

        // In a real script you would send this data to your analytics service:
        // fetch('https://my-analytics.example/tour', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ summary: summary, events: analyticsEvents }),
        // });
      },

      steps: [

        // Each step is assigned an id so the stepId field in onStepChange
        // events is populated with a human-readable name instead of null.
        {
          id: 'welcome',
          popover: {
            title: 'Analytics Demo',
            description: 'Open the browser console to see analytics events as you ' +
              'navigate. Each transition fires onStepChange with timing data. ' +
              'When the tour ends, onTourComplete logs a full summary.',
          },
        },

        {
          id: 'first-element',
          element: 'body > *:first-child',
          popover: {
            title: 'Step 2 — First Element',
            description: 'Navigate forward, backward, and forward again to see ' +
              'how direction values ("forward", "backward") appear in the event log.',
            side: 'bottom',
          },
        },

        {
          id: 'first-link',
          element: 'a',
          popover: {
            title: 'Step 3 — First Link',
            description: 'Try pressing Previous to go back to step 2, then come ' +
              'back here. The dwell time for step 2 will reflect the total time ' +
              'you spent on it across both visits.',
            side: 'bottom',
          },
        },

        {
          id: 'final',
          popover: {
            title: 'Step 4 — End',
            description: 'Click Done (or press Enter) to complete the tour. ' +
              'The onTourComplete hook will log "COMPLETED" with 100% progress. ' +
              'Close the tour early on a future run to see "ABANDONED" instead.',
          },
        },

      ],
    });

    guide.drive();
  }


  GM_registerMenuCommand('Start Analytics Demo Tour', startTour);

})();
