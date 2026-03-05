// ==UserScript==
// @name         TamperGuide — Custom Styling Example
// @namespace    https://github.com/UNKchr/tamperguide
// @version      1.0.0
// @description  Demonstrates how to apply a custom visual theme to TamperGuide
//               popovers using the popoverClass option and injected CSS, and
//               how to add extra content (icons, links, progress bars) to each
//               popover using the onPopoverRender hook.
// @author       UNKchr
// @match        *://*/*
// @require      https://cdn.jsdelivr.net/gh/UNKchr/tamperguide@v1.4.1/tamperguide/tamperGuide.js
// @grant        GM_addStyle
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // Custom theme CSS
  // --------------------------------------------------------------------------
  // TamperGuide uses the class "tg-popover" on its popover element and injects
  // its own base styles. To override them, define rules with higher specificity
  // (or use !important) and inject them via GM_addStyle.
  //
  // The popoverClass option adds extra class names to every popover, allowing
  // you to scope your overrides precisely without affecting other popovers on
  // the page (should any other library also create ones).
  //
  // Below we define a "tg-theme-dark" class that replaces the default white
  // popover with a dark blue theme.
  GM_addStyle([

    // Override the popover background and text colors.
    // ".tg-popover.tg-theme-dark" targets only our custom class, leaving the
    // default theme intact if other guide instances are running without it.
    '.tg-popover.tg-theme-dark {',
    '  background: #1e1e2e !important;',
    '  color: #cdd6f4 !important;',
    '  border: 1px solid #313244 !important;',
    '  box-shadow: 0 16px 48px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4) !important;',
    '}',

    // Override the title color.
    '.tg-popover.tg-theme-dark .tg-popover-title {',
    '  color: #cba6f7 !important;',  // a soft purple for headings
    '}',

    // Override the description text color.
    '.tg-popover.tg-theme-dark .tg-popover-description {',
    '  color: #bac2de !important;',
    '}',

    // Override the Next/Done button colors.
    '.tg-popover.tg-theme-dark .tg-popover-btn-next,',
    '.tg-popover.tg-theme-dark .tg-popover-btn-done {',
    '  background: #cba6f7 !important;',
    '  color: #1e1e2e !important;',
    '}',

    '.tg-popover.tg-theme-dark .tg-popover-btn-next:hover,',
    '.tg-popover.tg-theme-dark .tg-popover-btn-done:hover {',
    '  background: #b4a1e0 !important;',
    '}',

    // Override the Previous button colors.
    '.tg-popover.tg-theme-dark .tg-popover-btn-prev {',
    '  background: #313244 !important;',
    '  color: #cdd6f4 !important;',
    '}',

    '.tg-popover.tg-theme-dark .tg-popover-btn-prev:hover {',
    '  background: #45475a !important;',
    '}',

    // Override the close (X) button colors.
    '.tg-popover.tg-theme-dark .tg-popover-btn-close {',
    '  color: #585b70 !important;',
    '}',

    '.tg-popover.tg-theme-dark .tg-popover-btn-close:hover {',
    '  color: #cdd6f4 !important;',
    '  background: #313244 !important;',
    '}',

    // Override the popover arrow (the small diamond pointing at the element).
    // The arrow is a div rotated 45 degrees; its background must match the
    // popover background so it blends seamlessly.
    '.tg-popover.tg-theme-dark .tg-popover-arrow {',
    '  background: #1e1e2e !important;',
    '  border: 1px solid #313244 !important;',
    '}',

    // Override the progress text color.
    '.tg-popover.tg-theme-dark .tg-popover-progress {',
    '  color: #585b70 !important;',
    '}',

    // Custom class for the header icon container we inject via onPopoverRender.
    '.tg-custom-header {',
    '  display: flex;',
    '  align-items: center;',
    '  gap: 8px;',
    '  margin-bottom: 4px;',
    '}',

    '.tg-custom-icon {',
    '  display: inline-flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '  width: 28px;',
    '  height: 28px;',
    '  border-radius: 50%;',
    '  background: #313244;',
    '  font-size: 14px;',
    '  flex-shrink: 0;',
    '}',

    // Style for the external help link injected at the bottom of each popover.
    '.tg-help-link {',
    '  display: inline-block;',
    '  font-size: 11px;',
    '  color: #6c7086;',
    '  text-decoration: none;',
    '  margin-top: 8px;',
    '  font-family: sans-serif;',
    '}',

    '.tg-help-link:hover {',
    '  color: #cba6f7;',
    '  text-decoration: underline;',
    '}',

  ].join('\n'));


  // --------------------------------------------------------------------------
  // Step icons
  // --------------------------------------------------------------------------
  // Each step can be associated with an icon (plain text, HTML entity, or SVG).
  // We store them here and look them up by step index inside onPopoverRender.
  var STEP_ICONS = ['*', '#', '@', '!'];


  // --------------------------------------------------------------------------
  // startTour
  // --------------------------------------------------------------------------
  function startTour() {

    const guide = tamperGuide({
      showProgress: true,
      animate: true,
      showButtons: ['next', 'previous', 'close'],

      // popoverClass: one or more space-separated class names added to the
      // popover's <div> element. Our custom theme CSS above targets this class.
      // Multiple classes are supported: 'tg-theme-dark tg-my-other-class'
      popoverClass: 'tg-theme-dark',

      // stagePadding: extra space around the highlighted element (default: 10).
      // Increase for a more generous highlight frame.
      stagePadding: 14,

      // stageRadius: border radius of the cutout (default: 5).
      stageRadius: 10,

      // overlayOpacity: how dark the backdrop is (0 = transparent, 1 = solid).
      overlayOpacity: 0.8,

      // ------------------------------------------------------------------
      // onPopoverRender (global)
      // ------------------------------------------------------------------
      // Called for every step after the popover DOM is built but before it
      // is made visible. We use it to inject a custom icon and a help link
      // into every popover automatically.
      //
      // Signature: function (popoverElement, { config, state })
      onPopoverRender: function (popoverEl, context) {
        var index = context.state.activeIndex;
        var icon = STEP_ICONS[index] || '*';

        // Inject a small icon before the title.
        // We insert it as the first child after the close button (index 1 if
        // the close button is present, otherwise index 0).
        var iconWrapper = document.createElement('div');
        iconWrapper.className = 'tg-custom-header';

        var iconEl = document.createElement('span');
        iconEl.className = 'tg-custom-icon';
        iconEl.textContent = icon;
        iconWrapper.appendChild(iconEl);

        // Find the title element and move it into the icon wrapper.
        var titleEl = popoverEl.querySelector('.tg-popover-title');
        if (titleEl) {
          // Move the existing title into our wrapper div.
          titleEl.parentNode.insertBefore(iconWrapper, titleEl);
          iconWrapper.appendChild(titleEl);
        } else {
          // No title in this step; insert the wrapper anyway.
          var firstContent = popoverEl.querySelector('.tg-popover-description, .tg-popover-footer');
          if (firstContent) {
            popoverEl.insertBefore(iconWrapper, firstContent);
          } else {
            popoverEl.appendChild(iconWrapper);
          }
        }

        // Append a small "Learn more" link at the bottom of every popover.
        // Replace the href with a real documentation URL in your own script.
        var helpLink = document.createElement('a');
        helpLink.className = 'tg-help-link';
        helpLink.href = 'https://github.com/UNKchr/tamperguide';
        helpLink.textContent = 'Learn more about TamperGuide';
        helpLink.target = '_blank';
        helpLink.rel = 'noopener noreferrer';
        popoverEl.appendChild(helpLink);
      },

      steps: [
        {
          popover: {
            title: 'Dark Theme Demo',
            description: 'This tour uses a custom dark theme applied via CSS overrides and the popoverClass option.',
          },
        },
        {
          element: 'body > *:first-child',
          popover: {
            title: 'First Element',
            description: 'Notice the dark background, purple heading, and icon injected by onPopoverRender.',
            side: 'bottom',
          },
        },
        {
          element: 'a',
          popover: {
            title: 'A Link',
            description: 'Every popover in this tour shares the same theme because popoverClass is set globally.',
            side: 'bottom',
          },
        },
        {
          popover: {
            title: 'Tour Complete',
            description: 'You can combine popoverClass with onPopoverRender to build arbitrarily rich, branded tour popovers.',
          },
        },
      ],
    });

    guide.drive();
  }

  GM_registerMenuCommand('Start Custom Styling Tour', startTour);

})();
