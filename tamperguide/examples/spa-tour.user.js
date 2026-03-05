// ==UserScript==
// @name         TamperGuide — SPA / Deferred Start Example
// @namespace    https://github.com/UNKchr/tamperguide
// @version      1.0.0
// @description  Shows how to start a tour safely on a Single Page Application
//               where target elements are rendered asynchronously after the
//               initial page load. Uses a MutationObserver to wait for a key
//               element, and function-based element resolvers to lazily query
//               the DOM at the moment each step is activated.
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
  // waitForElement
  // --------------------------------------------------------------------------
  // A reusable helper that resolves a Promise once a CSS selector matches an
  // element in the DOM, using a MutationObserver to detect DOM changes.
  //
  // Parameters:
  //   selector  - CSS selector to wait for
  //   timeout   - max wait time in milliseconds (default: 10000)
  //
  // Returns a Promise that:
  //   - resolves with the matching Element when it is found
  //   - rejects with an Error if the timeout expires before the element appears
  //
  // This is essential for SPAs where React, Vue, Angular, or other frameworks
  // render content after the initial document-idle event fires.
  function waitForElement(selector, timeout) {
    timeout = timeout || 10000;

    return new Promise(function (resolve, reject) {

      // Check synchronously first in case the element already exists.
      var existing = document.querySelector(selector);
      if (existing) {
        resolve(existing);
        return;
      }

      var timer = null;

      // Set up a MutationObserver to watch for DOM changes.
      var observer = new MutationObserver(function () {
        var el = document.querySelector(selector);
        if (el) {
          clearTimeout(timer);
          observer.disconnect();
          resolve(el);
        }
      });

      // Watch the entire document subtree for added nodes and attribute changes.
      observer.observe(document.body || document.documentElement, {
        childList: true,  // observe direct child additions/removals
        subtree: true,    // observe all descendants, not just direct children
      });

      // Reject and disconnect after the timeout to avoid memory leaks.
      timer = setTimeout(function () {
        observer.disconnect();
        reject(new Error('[TamperGuide demo] Element "' + selector + '" not found within ' + timeout + 'ms'));
      }, timeout);
    });
  }

  // --------------------------------------------------------------------------
  // startTour
  // --------------------------------------------------------------------------
  // Waits for the application shell to be present in the DOM, then starts the
  // tour. Using async/await keeps the code flat and easy to follow.
  async function startTour() {

    // Wait for the main application container before creating the guide.
    // Replace '#app' with whatever root selector your SPA uses.
    try {
      await waitForElement('#app', 8000);
    } catch (err) {
      console.warn('[TamperGuide demo] Could not start tour:', err.message);
      return;
    }

    // Now that we know the app shell is present, create the guide.
    // The guide instance itself is inert until drive() is called, so it is
    // safe to build the step list here even if some elements are not yet shown.
    const guide = tamperGuide({
      showProgress: true,
      animate: true,
      showButtons: ['next', 'previous', 'close'],

      steps: [

        // Step 1: Centered welcome slide (no element required).
        {
          popover: {
            title: 'Welcome to the App',
            description: 'The application has fully loaded. Let us walk you through the main areas.',
          },
        },

        // Step 2: Function-based element resolver.
        //
        // Instead of a CSS string, 'element' can be a function that returns a
        // DOM Element. The function is called lazily when this step is activated,
        // not when the guide is created. This means:
        //
        //   1. Elements that have not been rendered yet when tamperGuide() is
        //      called are still safely resolved at the right time.
        //   2. You can apply any custom logic to find the element (e.g. picking
        //      the deepest visible heading, or using XPath).
        //   3. If the function returns null, TamperGuide warns in the console
        //      and shows a centered popover instead of crashing.
        {
          element: function () {
            // Re-query the DOM at the moment this step is activated.
            // By this point the framework may have rendered more elements.
            return document.querySelector('[data-tour="header"], header, .header');
          },
          popover: {
            title: 'Header',
            description: 'This is the application header. It contains the main navigation and account controls.',
            side: 'bottom',
          },
        },

        // Step 3: Another lazily-resolved element.
        {
          element: function () {
            return document.querySelector('[data-tour="sidebar"], aside, nav');
          },
          popover: {
            title: 'Sidebar',
            description: 'Use the sidebar to navigate between sections of the application.',
            side: 'right',
          },
        },

        // Step 4: Demonstrate setSteps() and dynamic step injection.
        // This step uses onHighlighted to dynamically add an extra step based
        // on what is found in the DOM at that moment.
        {
          element: function () {
            return document.querySelector('[data-tour="main-content"], main, .main-content');
          },
          popover: {
            title: 'Main Content',
            description: 'The main content area. All primary interactions happen here.',
            side: 'top',
          },
          onHighlighted: function (element, step, context) {
            // Check if there is a floating action button we should also show.
            var fab = document.querySelector('[data-tour="fab"], .fab, [aria-label="Create"]');
            if (fab) {
              // Retrieve the current steps, append an extra step, and replace.
              // setSteps() validates the new array before applying it, so any
              // malformed step objects will throw a TamperGuideError.
              var currentSteps = context.config.steps.slice();
              currentSteps.push({
                element: fab,  // pass a direct DOM Element reference
                popover: {
                  title: 'Create Button',
                  description: 'Click here to create a new item. This step was added dynamically.',
                  side: 'top',
                },
              });
              context.driver.setSteps(currentSteps);
            }
          },
        },

        // Step 5: Final closing slide.
        {
          popover: {
            title: 'All Done',
            description: 'You have completed the tour. The application is ready to use.',
          },
        },

      ],
    });

    // drive() starts the tour at step index 0.
    guide.drive();
  }

  // Trigger automatically once on load. Comment this out and use the menu
  // command instead if you only want the tour to run on user request.
  // startTour();

  // Register a manual trigger in the Tampermonkey extension menu.
  GM_registerMenuCommand('Start SPA Tour', startTour);

})();
