// ==UserScript==
// @name         TamperGuide — Basic Tour Example
// @namespace    https://github.com/UNKchr/tamperguide
// @version      1.0.0
// @description  Basic tour example using TamperGuide library
// @author       UNKchr
// @match        *://*/*
// @require      https://cdn.jsdelivr.net/gh/UNKchr/tamperguide@v1.0.0/tamperguide.js
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  function startTour() {
    const guide = tamperGuide({
      animate: true,
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      steps: [
        {
          popover: {
            title: 'Welcome!',
            description: 'This is a quick tour of the current page.',
          },
        },
        {
          element: 'body > *:first-child',
          popover: {
            title: 'First Element',
            description: 'This is the first visible element on the page.',
            side: 'bottom',
          },
        },
        {
          element: 'a',
          popover: {
            title: 'A Link',
            description: 'This is the first link found on the page.',
            side: 'bottom',
          },
        },
        {
          popover: {
            title: 'Done!',
            description: 'That\'s it! TamperGuide is working correctly.',
          },
        },
      ],
    });

    guide.drive();
  }

  GM_registerMenuCommand('Start Basic Tour', startTour);
})();