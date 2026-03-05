// ==UserScript==
// @name         TamperGuide — Hotspots Example
// @namespace    https://github.com/UNKchr/tamperguide
// @version      1.0.0
// @description  Demonstrates the TamperGuide hotspot system. Hotspots are
//               non-blocking pulsing visual hints added to page elements.
//               They do not interrupt page interaction and can be added or
//               removed at any time, independently of a full tour.
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
  // Shared guide instance
  // --------------------------------------------------------------------------
  // A single guide instance owns all hotspots. We keep a reference at module
  // scope so every menu command can call addHotspot / removeHotspot on the
  // same instance. The guide does not need drive() to be called first —
  // hotspot methods work without an active tour.
  var guide = tamperGuide({
    // Hotspot-only usage requires no steps or tour options. You can still
    // add regular tour steps to the same instance and call drive() later.
    steps: [],

    // onDestroyed fires when destroy() is called or when the tour ends.
    // After destruction the guide instance is inert, so we set guide = null
    // to signal that it needs to be recreated.
    onDestroyed: function () {
      guide = null;
      console.log('[TamperGuide demo] Guide destroyed. Hotspots removed.');
    },
  });


  // --------------------------------------------------------------------------
  // ensureGuide — recreate the guide after destruction
  // --------------------------------------------------------------------------
  function ensureGuide() {
    if (!guide) {
      guide = tamperGuide({
        steps: [],
        onDestroyed: function () {
          guide = null;
        },
      });
    }
  }


  // --------------------------------------------------------------------------
  // addAllHotspots — place hotspots on multiple page elements
  // --------------------------------------------------------------------------
  function addAllHotspots() {
    ensureGuide();

    // ------------------------------------------------------------------
    // Hotspot 1: default appearance, hover tooltip only.
    // ------------------------------------------------------------------
    // addHotspot(options) accepts:
    //   selector        — CSS selector of the target element. Required.
    //   title           — tooltip heading shown on hover.
    //   description     — tooltip body text shown on hover.
    //   side            — preferred tooltip placement ('top'|'right'|'bottom'|'left').
    //   color           — custom colour of the pulsing dot (CSS colour string).
    //   dismissOnClick  — remove the hotspot when the target element is clicked.
    //   autoDismiss     — remove the hotspot automatically after N milliseconds.
    //
    // The hotspot is rendered as a small pulsing circle at the top-right corner
    // of the target element's bounding box. It never blocks mouse events on the
    // element itself.
    guide.addHotspot({
      selector: 'body > *:first-child',
      title: 'New Section',
      description: 'This section was updated. Hover to learn more.',
      // side defaults to 'bottom' when omitted.
    });

    // ------------------------------------------------------------------
    // Hotspot 2: custom colour.
    // ------------------------------------------------------------------
    // The color property accepts any valid CSS colour: named colours, hex,
    // rgb(), hsl(), etc. The pulsing animation uses this colour for both
    // the dot and its ripple ring.
    guide.addHotspot({
      selector: 'a',
      title: 'Featured Link',
      description: 'This link leads to a new feature. Click to explore.',
      color: '#f59e0b',   // amber accent
      side: 'right',
    });

    // ------------------------------------------------------------------
    // Hotspot 3: dismissOnClick.
    // ------------------------------------------------------------------
    // When dismissOnClick: true the hotspot is automatically removed the
    // first time the user clicks the target element. Useful for drawing
    // attention to a button that the user needs to press — once they press
    // it, the hint disappears naturally.
    guide.addHotspot({
      selector: 'button, input[type="submit"]',
      title: 'Action Required',
      description: 'Click this button to continue. The hotspot disappears after your click.',
      color: '#ef4444',   // red for urgency
      side: 'top',
      // dismissOnClick: the hotspot is removed as soon as the target element
      // receives a click event. No manual removeHotspot() call is needed.
      dismissOnClick: true,
    });

    // ------------------------------------------------------------------
    // Hotspot 4: autoDismiss.
    // ------------------------------------------------------------------
    // autoDismiss: N automatically removes the hotspot after N milliseconds
    // have elapsed since it was added. Useful for temporary announcements
    // that should clear themselves without user interaction.
    guide.addHotspot({
      selector: 'input, textarea',
      title: 'Try Me',
      description: 'This hotspot will disappear automatically after 10 seconds.',
      color: '#8b5cf6',   // purple
      side: 'bottom',
      // autoDismiss: milliseconds before automatic removal.
      // Here 10 000 ms = 10 seconds.
      autoDismiss: 10000,
    });

    console.log('[TamperGuide demo] Four hotspots added.');
    console.log('[TamperGuide demo] Notes:');
    console.log('  • Each hotspot is keyed by its selector.');
    console.log('  • Adding a hotspot with a duplicate selector replaces the old one.');
    console.log('  • In SPAs, hotspots survive element removal and reappear when the');
    console.log('    element is re-added to the DOM.');
  }


  // --------------------------------------------------------------------------
  // removeOneHotspot — remove a specific hotspot by selector
  // --------------------------------------------------------------------------
  function removeOneHotspot() {
    ensureGuide();

    // removeHotspot(selector) removes the hotspot identified by its original
    // selector string. Passing a selector that has no matching hotspot is a
    // safe no-op (no error is thrown).
    guide.removeHotspot('a');

    console.log('[TamperGuide demo] Removed the hotspot on <a> elements.');
  }


  // --------------------------------------------------------------------------
  // removeAllHotspots — clear every active hotspot from the page
  // --------------------------------------------------------------------------
  function removeAllHotspots() {
    ensureGuide();

    // removeAllHotspots() iterates over every active hotspot on this guide
    // instance and removes their DOM elements and event listeners. It is
    // equivalent to calling removeHotspot() for each known selector, but
    // more convenient when you do not track individual selectors.
    guide.removeAllHotspots();

    console.log('[TamperGuide demo] All hotspots removed.');
  }


  // --------------------------------------------------------------------------
  // Register menu commands
  // --------------------------------------------------------------------------
  GM_registerMenuCommand('Hotspots: Add All',        addAllHotspots);
  GM_registerMenuCommand('Hotspots: Remove "a" Link', removeOneHotspot);
  GM_registerMenuCommand('Hotspots: Remove All',     removeAllHotspots);

})();
