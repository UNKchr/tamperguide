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
  // Example 1: Guided Tour with Step Beacons & Optional Text Pills
  // --------------------------------------------------------------------------
  // The beacon visual guide pairs naturally with `advanceOn: { event: 'click' }`.
  // The continuous cascading waves draw the eye, while optional text pills
  // explain what to click without cluttering the screen with full popovers.
  function startBeaconTour() {
    injectDemoBar();

    var guide = tamperGuide({
      showProgress: true,
      animate: true,
      steps: [
        {
          element: '#tg-demo-save',
          popover: {
            title: 'String Shortcut Beacon Label',
            description: 'Passing a simple string to "beacon" shows both the adaptive ripple and an elegant dark pill.',
            side: 'top',
          },
          // String shortcut: shows ripple + default dark pill with text
          beacon: 'Click to save draft',
          advanceOn: { event: 'click' },
        },
        {
          element: '#tg-demo-pill',
          popover: {
            title: 'Adaptive Pill with Accent Theme',
            description: 'Uses theme: "accent" to match the beacon color, complete with an emoji prefix icon.',
            side: 'top',
          },
          // Detailed beacon with accent theme matching emerald color
          beacon: {
            shape: 'adaptive',
            color: 'green',        // Preset color name
            borderWidth: 3,
            speed: 1.8,
            dismissOnClick: true,
            text: {
              content: 'Ready to publish',
              theme: 'accent',     // Adopts emerald green background
              icon: '🚀',
              position: 'top',
            },
          },
          advanceOn: { event: 'click' },
        },
        {
          element: '#tg-demo-icon',
          popover: {
            title: 'Radar Pulse with Light Theme Pill',
            description: 'Concentric circular waves centered on the icon, paired with a clean white/light pill placed at the bottom.',
            side: 'top',
          },
          beacon: {
            shape: 'circle',
            color: '#a855f7',
            borderWidth: 3,
            speed: 1.5,
            text: {
              content: 'Starred favorites',
              theme: 'light',      // Clean white card style
              icon: '⭐',
              position: 'bottom',  // Placed below element
            },
          },
          advanceOn: { event: 'click' },
        },
        {
          element: '#tg-demo-save',
          popover: {
            title: 'Wave-Only Beacon',
            description: 'Text labels are completely optional! Here is a clean wave-only beacon without any text pill.',
            side: 'top',
          },
          // Pure wave beacon without text
          beacon: {
            shape: 'adaptive',
            color: 'blue',
          },
          advanceOn: { event: 'click' },
        },
        {
          element: '#tg-demo-save',
          popover: {
            title: 'Strict Interaction Mode',
            description: 'You MUST click this button to continue! Clicking anywhere else is blocked and triggers a shake feedback animation.',
            side: 'top',
          },
          // Strict interaction mode: locks down outside clicks and shakes on error
          strict: true,
          beacon: {
            shape: 'adaptive',
            color: 'red',
            text: {
              content: 'Action strictly required',
              theme: 'dark',
              icon: '🔒',
            },
          },
        },
        {
          popover: {
            title: 'Tour Finished!',
            description: 'You experienced all beacon modes: wave-only, dark pill, accent pill, light theme with icons, and strict interaction locking.',
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

  function showPillBeacon() {
    injectDemoBar();
    var g = ensureStandaloneGuide();
    // Dark pill with emoji icon
    g.showBeacon('#tg-demo-save', {
      shape: 'adaptive',
      color: 'blue',
      speed: 2,
      dismissOnClick: true,
      text: {
        content: 'Save draft now',
        theme: 'dark',
        icon: '💾',
        position: 'top',
      },
    });
    console.log('[Beacon Demo] Standalone pill beacon shown on #tg-demo-save.');
  }

  function showLightPillBeacon() {
    injectDemoBar();
    var g = ensureStandaloneGuide();
    // Light pill placed on bottom
    g.showBeacon('#tg-demo-icon', {
      shape: 'circle',
      color: 'amber',
      borderWidth: 3,
      speed: 1.6,
      dismissOnClick: true,
      text: {
        content: 'Quick action',
        theme: 'light',
        position: 'bottom',
        icon: '⚡',
      },
    });
    console.log('[Beacon Demo] Standalone light pill beacon shown on #tg-demo-icon.');
  }

  function showWaveOnlyBeacon() {
    injectDemoBar();
    var g = ensureStandaloneGuide();
    // Wave only, no text
    g.showBeacon('#tg-demo-pill', {
      shape: 'adaptive',
      color: 'green',
      dismissOnClick: true,
    });
    console.log('[Beacon Demo] Standalone wave-only beacon shown on #tg-demo-pill.');
  }

  function showStrictBeacon() {
    injectDemoBar();
    var g = ensureStandaloneGuide();
    // Strict beacon: blocks clicks outside and shakes on error
    g.showBeacon('#tg-demo-save', {
      shape: 'adaptive',
      color: 'red',
      strict: true,
      text: {
        content: 'Click here only (strict mode)',
        theme: 'dark',
        icon: '🔒',
        position: 'top',
      },
    });
    console.log('[Beacon Demo] Standalone strict beacon shown on #tg-demo-save.');
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
    GM_registerMenuCommand('TamperGuide: Start Beacon Tour (with Text Pills)', startBeaconTour);
    GM_registerMenuCommand('TamperGuide: Show Dark Pill Beacon', showPillBeacon);
    GM_registerMenuCommand('TamperGuide: Show Light Pill Beacon', showLightPillBeacon);
    GM_registerMenuCommand('TamperGuide: Show Wave-Only Beacon', showWaveOnlyBeacon);
    GM_registerMenuCommand('TamperGuide: Show Strict Locked Beacon', showStrictBeacon);
    GM_registerMenuCommand('TamperGuide: Hide Active Beacon', hideBeacon);
  }

})();
