// ==UserScript==
// @name         TamperGuide — Themes Example
// @namespace    https://github.com/UNKchr/tamperguide
// @version      1.0.0
// @description  Demonstrates all four built-in TamperGuide visual themes:
//               default, dark, minimal, and rounded. Each theme is launched
//               via a separate Tampermonkey menu command so you can compare
//               them side by side. Also shows how to layer custom CSS overrides
//               on top of a built-in theme using popoverClass and GM_addStyle.
// @author       UNKchr
// @match        *://*/*
// @require      https://cdn.jsdelivr.net/gh/UNKchr/tamperguide@v1.5.0/tamperguide/tamperGuide.js
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // Custom CSS overrides
  // --------------------------------------------------------------------------
  // The built-in themes already look polished, but you can layer additional
  // overrides on top using GM_addStyle + popoverClass. This lets you match
  // your own brand without writing a theme from scratch.
  //
  // Here we define a supplemental class "tg-brand-accent" that we will apply
  // alongside the built-in "dark" theme in the combined demo below.
  // The class simply replaces the primary action button colour with a
  // green accent — every other detail stays exactly as the dark theme defines.
  GM_addStyle([

    // Only target popovers that carry BOTH the dark theme class and our brand
    // accent class, so we never accidentally style other guide instances.
    '.tg-popover.tg-brand-accent .tg-popover-btn-next,',
    '.tg-popover.tg-brand-accent .tg-popover-btn-done {',
    '  background: #22c55e !important;',   // Tailwind green-500
    '  color: #052e16 !important;',         // deep green text for contrast
    '}',

    '.tg-popover.tg-brand-accent .tg-popover-btn-next:hover,',
    '.tg-popover.tg-brand-accent .tg-popover-btn-done:hover {',
    '  background: #16a34a !important;',   // slightly darker on hover
    '}',

  ].join('\n'));


  // --------------------------------------------------------------------------
  // buildSteps — shared 3-step tour content
  // --------------------------------------------------------------------------
  // All four theme demos use the same three steps so the only variable between
  // runs is the visual presentation. Keeping content identical makes it easy
  // to spot the stylistic differences.
  function buildSteps(themeName) {
    return [

      // Step 1: Centered introduction slide (no element required).
      // Use this pattern for welcome messages that do not reference a specific
      // piece of UI.
      {
        popover: {
          title: 'Theme: ' + themeName,
          description: 'You are now viewing the "' + themeName + '" built-in theme. ' +
            'Navigate through the three steps to see how each theme styles the ' +
            'popover title, description, buttons, and progress indicator.',
        },
      },

      // Step 2: Highlight the first element in the page body.
      {
        element: 'body > *:first-child',
        popover: {
          title: 'Highlighted Element',
          description: 'The highlight cutout, stage padding, and stage radius are ' +
            'shared across all themes. Only the popover\'s visual appearance changes.',
          side: 'bottom',
        },
      },

      // Step 3: Closing slide.
      // On the last step the Next button automatically becomes "Done".
      {
        popover: {
          title: 'Theme Complete',
          description: 'That is it for the "' + themeName + '" theme. ' +
            'Try the other menu commands to compare with the remaining themes.',
        },
      },

    ];
  }


  // --------------------------------------------------------------------------
  // startThemeTour — factory for a single-theme demo
  // --------------------------------------------------------------------------
  // Returns a function that, when called, creates and drives a 3-step tour
  // using the specified built-in theme name.
  //
  // Valid theme values:
  //   'default'  — White background, blue buttons. Identical to v1.4.1 look.
  //   'dark'     — Dark background, muted text, purple/blue accent buttons.
  //   'minimal'  — Flat design, thin border, no shadows.
  //   'rounded'  — Same as default but with heavier border-radius on all elements.
  function startThemeTour(themeName) {
    return function () {
      tamperGuide({

        // theme: the name of the built-in visual theme to apply.
        // TamperGuide injects CSS custom properties for the chosen theme and
        // adds a matching class to the popover (e.g. "tg-theme-dark").
        // If omitted or set to 'default', the appearance is identical to v1.4.1.
        theme: themeName,

        // Standard tour options — identical across all four demos.
        animate: true,
        showProgress: true,
        showButtons: ['next', 'previous', 'close'],

        steps: buildSteps(themeName),

      }).drive();
    };
  }


  // --------------------------------------------------------------------------
  // startCombinedTour — built-in theme + custom CSS overrides
  // --------------------------------------------------------------------------
  // Shows that you can mix a built-in theme with a popoverClass override.
  // Here we use theme: 'dark' as the foundation and stack our "tg-brand-accent"
  // class on top to swap the button colour to green.
  //
  // This is the recommended approach when you want most of a built-in theme's
  // appearance but need a few brand-specific adjustments.
  function startCombinedTour() {
    tamperGuide({

      // theme: sets the built-in dark colour palette.
      theme: 'dark',

      // popoverClass: one or more extra class names appended to the popover
      // <div>. Our GM_addStyle rules above target this class to override only
      // the button colours.
      popoverClass: 'tg-brand-accent',

      animate: true,
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],

      steps: [
        {
          popover: {
            title: 'Dark + Custom Overrides',
            description: 'This tour applies the built-in "dark" theme via the ' +
              'theme option and then overrides the Next/Done button colour to ' +
              'green using popoverClass + GM_addStyle. All other dark-theme ' +
              'styles remain unchanged.',
          },
        },
        {
          element: 'body > *:first-child',
          popover: {
            title: 'Green Accent Button',
            description: 'Notice the green "Next" button. The rest of the popover ' +
              'uses the standard dark theme colours: dark background, light text, ' +
              'and muted grey back/close buttons.',
            side: 'bottom',
          },
        },
        {
          popover: {
            title: 'Layering Tips',
            description: 'Use theme: for broad palette changes and popoverClass + ' +
              'GM_addStyle for surgical tweaks. This keeps your CSS minimal and ' +
              'easy to maintain.',
          },
        },
      ],

    }).drive();
  }


  // --------------------------------------------------------------------------
  // Register one menu command per theme plus the combination demo.
  // --------------------------------------------------------------------------
  // Each command creates a fresh guide instance so tours never interfere with
  // each other — closing one and opening another always starts cleanly.
  GM_registerMenuCommand('Theme: Default',           startThemeTour('default'));
  GM_registerMenuCommand('Theme: Dark',              startThemeTour('dark'));
  GM_registerMenuCommand('Theme: Minimal',           startThemeTour('minimal'));
  GM_registerMenuCommand('Theme: Rounded',           startThemeTour('rounded'));
  GM_registerMenuCommand('Theme: Dark + Custom CSS', startCombinedTour);

})();
