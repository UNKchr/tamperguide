// ==UserScript==
// @name         TamperGuide — Click Indicator / Beacon Example
// @namespace    https://github.com/UNKchr/tamperguide
// @version      1.0.0
// @description  Demonstrates the TamperGuide Click Indicator / Beacon feature.
//               Beacons provide non-blocking visual prompts (continuous cascading
//               ripples or radar pulses) that indicate to the user where to click.
//               Supports adaptive contour matching and circular radar modes.
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
  // Inject demo UI elements for testing
  // --------------------------------------------------------------------------
  function injectDemoBar() {
    if (document.getElementById('tg-beacon-demo-bar')) return;

    var bar = document.createElement('div');
    bar.id = 'tg-beacon-demo-bar';
    bar.style.cssText = [
      'position: fixed',
      'bottom: 24px',
      'right: 24px',
      'background: #1e293b',
      'color: #f8fafc',
      'padding: 16px 20px',
      'border-radius: 12px',
      'box-shadow: 0 10px 25px -5px rgba(0,0,0,0.4)',
      'z-index: 999999',
      'display: flex',
      'align-items: center',
      'gap: 12px',
      'font-family: system-ui, sans-serif',
      'font-size: 13px',
    ].join('; ');

    bar.innerHTML = [
      '<span style="font-weight: 600; color: #94a3b8; margin-right: 4px;">TamperGuide Beacon Demo:</span>',
      '<button id="tg-demo-save" style="padding: 8px 14px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">Save Draft</button>',
      '<button id="tg-demo-pill" style="padding: 8px 18px; background: #10b981; color: white; border: none; border-radius: 9999px; cursor: pointer; font-weight: 500;">Publish</button>',
      '<button id="tg-demo-icon" style="width: 36px; height: 36px; background: #f59e0b; color: white; border: none; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px;">★</button>',
    ].join('');

    document.body.appendChild(bar);

    // Simple click feedback
    document.getElementById('tg-demo-save').addEventListener('click', function () {
      console.log('[Beacon Demo] "Save Draft" clicked!');
    });
    document.getElementById('tg-demo-pill').addEventListener('click', function () {
      console.log('[Beacon Demo] "Publish" clicked!');
    });
    document.getElementById('tg-demo-icon').addEventListener('click', function () {
      console.log('[Beacon Demo] Star icon clicked!');
    });
  }

  // Ensure demo bar is present
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectDemoBar);
  } else {
    injectDemoBar();
  }

  // --------------------------------------------------------------------------
  // Example 1: Guided Tour with Step Beacons & advanceOn
  // --------------------------------------------------------------------------
  // The beacon visual guide pairs naturally with `advanceOn: { event: 'click' }`.
  // The continuous cascading waves draw the user's eye to the exact button,
  // and clicking it advances the tour to the next step.
  function startBeaconTour() {
    injectDemoBar();

    var guide = tamperGuide({
      showProgress: true,
      animate: true,
      steps: [
        {
          element: '#tg-demo-save',
          popover: {
            title: 'Adaptive Rectangular Beacon',
            description: 'Notice how the amber ripple emanates directly from the rectangular button outline. Click the button to continue!',
            side: 'top',
          },
          // Simple boolean enables the beacon with default adaptive shape & amber color
          beacon: true,
          // Advances to step 2 when the button is clicked
          advanceOn: { event: 'click' },
        },
        {
          element: '#tg-demo-pill',
          popover: {
            title: 'Adaptive Pill Shape Beacon',
            description: 'The beacon inspects computed border-radius: 9999px and matches the pill shape smoothly in emerald green.',
            side: 'top',
          },
          // Customized beacon: shape, color, speed, and border thickness
          beacon: {
            shape: 'adaptive',
            color: 'green',        // Preset color name
            borderWidth: 3,        // 3px wave thickness
            speed: 1.8,            // 1.8s ripple cycle
            dismissOnClick: true,  // Auto-dismiss on click
          },
          advanceOn: { event: 'click' },
        },
        {
          element: '#tg-demo-icon',
          popover: {
            title: 'Circular Radar Pulse',
            description: 'Using shape: "circle" (or "radar") generates concentric circular waves from the center of icons or circular buttons.',
            side: 'top',
          },
          beacon: {
            shape: 'circle',
            color: '#a855f7',      // Purple hex
            borderWidth: 3,
            speed: 1.5,
          },
          advanceOn: { event: 'click' },
        },
        {
          popover: {
            title: 'Tour Finished!',
            description: 'You experienced all beacon modes: adaptive rectangular, adaptive pill, and circular radar waves.',
          },
        },
      ],
    });

    guide.drive();
  }

  // --------------------------------------------------------------------------
  // Example 2: Standalone Beacon Usage (Independent of a tour)
  // --------------------------------------------------------------------------
  var standaloneGuide = null;

  function ensureStandaloneGuide() {
    if (!standaloneGuide) {
      standaloneGuide = tamperGuide();
    }
    return standaloneGuide;
  }

  function showAdaptiveBeacon() {
    injectDemoBar();
    var g = ensureStandaloneGuide();
    // Non-blocking: user can still interact with the page normally
    g.showBeacon('#tg-demo-save', {
      shape: 'adaptive',
      color: 'blue',
      speed: 2,
      dismissOnClick: true,
    });
    console.log('[Beacon Demo] Standalone adaptive beacon shown on #tg-demo-save.');
  }

  function showRadarBeacon() {
    injectDemoBar();
    var g = ensureStandaloneGuide();
    g.showBeacon('#tg-demo-icon', {
      shape: 'circle',
      color: 'amber',
      borderWidth: 3,
      speed: 1.6,
      dismissOnClick: true,
    });
    console.log('[Beacon Demo] Standalone radar beacon shown on #tg-demo-icon.');
  }

  function hideBeacon() {
    if (standaloneGuide) {
      standaloneGuide.hideBeacon();
      console.log('[Beacon Demo] Active beacon hidden.');
    }
  }

  // --------------------------------------------------------------------------
  // Register Tampermonkey Menu Commands
  // --------------------------------------------------------------------------
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('TamperGuide: Start Beacon Tour', startBeaconTour);
    GM_registerMenuCommand('TamperGuide: Show Adaptive Beacon (Button)', showAdaptiveBeacon);
    GM_registerMenuCommand('TamperGuide: Show Radar Beacon (Icon)', showRadarBeacon);
    GM_registerMenuCommand('TamperGuide: Hide Active Beacon', hideBeacon);
  }

})();
