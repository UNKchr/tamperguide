// ==UserScript==
// @name         TamperGuide
// @namespace    https://github.com/UNKchr/tamperguide
// @version      1.6.0
// @author       UNKchr
// @description  Lightweight library for product tours, highlights, and contextual help in Tampermonkey userscripts.
// @license      MIT
// ==/UserScript==

// ===========================================================================
// TamperGuide v1.6.0
// ===========================================================================

(function () {
  'use strict';

  // =========================================================================
  // MODULE: Errors & Validation
  // =========================================================================

  class TamperGuideError extends Error {
    constructor(code, message, context) {
      var fullMessage = '[TamperGuide:' + code + '] ' + message;
      super(fullMessage);
      this.name = 'TamperGuideError';
      this.code = code;
      this.context = context || {};
    }
  }

  var ErrorCodes = Object.freeze({
    INVALID_CONFIG: 'INVALID_CONFIG',
    INVALID_STEP: 'INVALID_STEP',
    ELEMENT_NOT_FOUND: 'ELEMENT_NOT_FOUND',
    NO_STEPS: 'NO_STEPS',
    INVALID_STEP_INDEX: 'INVALID_STEP_INDEX',
    HOOK_ERROR: 'HOOK_ERROR',
    DESTROYED: 'DESTROYED',
    PERSISTENCE_ERROR: 'PERSISTENCE_ERROR',
    WAIT_TIMEOUT: 'WAIT_TIMEOUT',
    ADVANCE_ON_ERROR: 'ADVANCE_ON_ERROR',
    HOTSPOT_ERROR: 'HOTSPOT_ERROR',
  });

  function warn(code, message) {
    console.warn('[TamperGuide:' + code + '] ' + message);
  }

  function validateButtons(buttons, location) {
    if (!Array.isArray(buttons)) {
      throw new TamperGuideError(ErrorCodes.INVALID_CONFIG, '"buttons"' + (location ? ' in ' + location : '') + ' must be an Array.');
    }
    var validStrings = ['next', 'previous', 'close', 'done'];
    var validVariants = ['primary', 'secondary', 'link', 'danger'];
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      if (typeof btn === 'string') {
        if (validStrings.indexOf(btn) === -1) {
          throw new TamperGuideError(ErrorCodes.INVALID_CONFIG,
            'Unknown button identifier "' + btn + '"' + (location ? ' in ' + location : '') + ' at index ' + i + '. ' +
            'Valid string identifiers: ' + validStrings.join(', ') + '. Or provide a custom button object: { text: "...", onClick: function() {} }');
        }
      } else if (btn !== null && typeof btn === 'object') {
        if (btn.text === undefined || (typeof btn.text !== 'string' && typeof btn.text !== 'function') || (typeof btn.text === 'string' && btn.text.trim() === '')) {
          throw new TamperGuideError(ErrorCodes.INVALID_CONFIG,
            'Custom button at index ' + i + (location ? ' in ' + location : '') + ' must have a non-empty "text" string or function.');
        }
        if (btn.onClick !== undefined && typeof btn.onClick !== 'function') {
          throw new TamperGuideError(ErrorCodes.INVALID_CONFIG,
            '"onClick" for button "' + (typeof btn.text === 'string' ? btn.text : 'at index ' + i) + '"' + (location ? ' in ' + location : '') + ' must be a function.');
        }
        if (btn.variant !== undefined && (typeof btn.variant !== 'string' || validVariants.indexOf(btn.variant) === -1)) {
          throw new TamperGuideError(ErrorCodes.INVALID_CONFIG,
            '"variant" for button "' + (typeof btn.text === 'string' ? btn.text : 'at index ' + i) + '"' + (location ? ' in ' + location : '') + ' must be one of: ' + validVariants.join(', ') + '. Received: "' + btn.variant + '".');
        }
        if (btn.className !== undefined && typeof btn.className !== 'string') {
          throw new TamperGuideError(ErrorCodes.INVALID_CONFIG,
            '"className" for button at index ' + i + (location ? ' in ' + location : '') + ' must be a string.');
        }
        if (btn.id !== undefined && typeof btn.id !== 'string') {
          throw new TamperGuideError(ErrorCodes.INVALID_CONFIG,
            '"id" for button at index ' + i + (location ? ' in ' + location : '') + ' must be a string.');
        }
        if (btn.ariaLabel !== undefined && typeof btn.ariaLabel !== 'string') {
          throw new TamperGuideError(ErrorCodes.INVALID_CONFIG,
            '"ariaLabel" for button at index ' + i + (location ? ' in ' + location : '') + ' must be a string.');
        }
        if (btn.disabled !== undefined && typeof btn.disabled !== 'boolean' && typeof btn.disabled !== 'function') {
          throw new TamperGuideError(ErrorCodes.INVALID_CONFIG,
            '"disabled" for button at index ' + i + (location ? ' in ' + location : '') + ' must be a boolean or a function returning boolean.');
        }
      } else {
        throw new TamperGuideError(ErrorCodes.INVALID_CONFIG,
          'Invalid button definition at index ' + i + (location ? ' in ' + location : '') + '. ' +
          'Expected a string (' + validStrings.join(', ') + ') or a button configuration object.');
      }
    }
  }

  function validateConfig(config) {
    if (config === null || typeof config !== 'object') {
      throw new TamperGuideError(ErrorCodes.INVALID_CONFIG, 'Configuration must be an object. Received: ' + typeof config);
    }
    var validKeys = [
      'steps', 'animate', 'overlayColor', 'overlayOpacity', 'stagePadding',
      'stageRadius', 'allowClose', 'allowKeyboardControl', 'showProgress',
      'showButtons', 'buttons', 'progressText', 'nextBtnText', 'prevBtnText',
      'doneBtnText', 'closeBtnText', 'popoverClass', 'popoverOffset',
      'smoothScroll', 'scrollIntoViewOptions', 'disableActiveInteraction',
      'allowBackdropInteraction',
      'onHighlightStarted', 'onHighlighted', 'onDeselected',
      'onDestroyStarted', 'onDestroyed', 'onNextClick', 'onPrevClick',
      'onCloseClick', 'onPopoverRender', 'persist', 'persistKey', 'persistStorage', 'persistExpiry', 'theme', 'autoRefresh', 'autoRefreshInterval', 'onStepChange', 'onTourComplete', 'beacon', 'strict', 'beforeStep',
    ];
    var configKeys = Object.keys(config);
    for (var i = 0; i < configKeys.length; i++) {
      var key = configKeys[i];
      if (validKeys.indexOf(key) === -1) {
        var suggestions = validKeys
          .filter(function (k) { return k.toLowerCase().indexOf(key.toLowerCase().slice(0, 4)) !== -1; })
          .join(', ');
        warn(ErrorCodes.INVALID_CONFIG,
          'Unknown option: "' + key + '".' +
          (suggestions ? ' Did you mean: ' + suggestions + '?' : ' Valid options: ' + validKeys.join(', '))
        );
      }
    }
    if (config.steps !== undefined) {
      if (!Array.isArray(config.steps)) {
        throw new TamperGuideError(ErrorCodes.INVALID_CONFIG, '"steps" must be an Array.');
      }
      for (var j = 0; j < config.steps.length; j++) { validateStep(config.steps[j], j); }
    }
    if (config.overlayOpacity !== undefined) {
      if (typeof config.overlayOpacity !== 'number' || config.overlayOpacity < 0 || config.overlayOpacity > 1) {
        throw new TamperGuideError(ErrorCodes.INVALID_CONFIG, '"overlayOpacity" must be 0-1.');
      }
    }
    if (config.stagePadding !== undefined) {
      if (typeof config.stagePadding !== 'number' && !Array.isArray(config.stagePadding) && (typeof config.stagePadding !== 'object' || config.stagePadding === null)) {
        throw new TamperGuideError(ErrorCodes.INVALID_CONFIG, '"stagePadding" must be a number, array, or object.');
      }
    }
    if (config.stageRadius !== undefined) {
      if (typeof config.stageRadius !== 'number' && config.stageRadius !== 'auto') {
        throw new TamperGuideError(ErrorCodes.INVALID_CONFIG, '"stageRadius" must be a number or "auto".');
      }
    }
    if (config.showButtons !== undefined) {
      if (!Array.isArray(config.showButtons)) {
        throw new TamperGuideError(ErrorCodes.INVALID_CONFIG, '"showButtons" must be an Array.');
      }
      var validButtons = ['next', 'previous', 'close'];
      for (var b = 0; b < config.showButtons.length; b++) {
        if (validButtons.indexOf(config.showButtons[b]) === -1) {
          throw new TamperGuideError(ErrorCodes.INVALID_CONFIG, 'Unknown button: "' + config.showButtons[b] + '".');
        }
      }
    }
    if (config.buttons !== undefined) {
      validateButtons(config.buttons, 'config');
    }
    var hookKeys = [
      'onHighlightStarted', 'onHighlighted', 'onDeselected',
      'onDestroyStarted', 'onDestroyed', 'onNextClick', 'onPrevClick',
      'onCloseClick', 'onPopoverRender', 'onStepChange', 'onTourComplete',
    ];

    for (var h = 0; h < hookKeys.length; h++) {
      if (config[hookKeys[h]] !== undefined && typeof config[hookKeys[h]] !== 'function') {
        throw new TamperGuideError(ErrorCodes.INVALID_CONFIG, '"' + hookKeys[h] + '" must be a function.');
      }
    }

    if (config.persist !== undefined && typeof config.persist !== 'boolean') {
      throw new TamperGuideError(ErrorCodes.INVALID_CONFIG,
        '"persist" must be a boolean (true or false). Received: ' + typeof config.persist + '. ' +
        'Set persist:true to save tour progress across page navigations.');
    }
    if (config.persistKey !== undefined && typeof config.persistKey !== 'string') {
      throw new TamperGuideError(ErrorCodes.INVALID_CONFIG,
        '"persistKey" must be a string that uniquely identifies this tour. Received: ' + typeof config.persistKey + '. ' +
        'Example: persistKey: "my-site-onboarding".');
    }
    if (config.persistKey !== undefined && typeof config.persistKey === 'string' && config.persistKey.trim() === '') {
      throw new TamperGuideError(ErrorCodes.INVALID_CONFIG,
        '"persistKey" cannot be an empty string. Provide a unique identifier like "my-tour-v1".');
    }
    if (config.persistStorage !== undefined) {
      if (typeof config.persistStorage !== 'string' || ['localStorage', 'GM'].indexOf(config.persistStorage) === -1) {
        throw new TamperGuideError(ErrorCodes.INVALID_CONFIG,
          '"persistStorage" must be "localStorage" or "GM". Received: "' + config.persistStorage + '". ' +
          'Use "GM" when your userscript has @grant GM_setValue and you want cross-domain persistence. ' +
          'Use "localStorage" (default) for same-origin persistence without special grants.');
      }
    }
    if (config.persistExpiry !== undefined) {
      if (typeof config.persistExpiry !== 'number' || config.persistExpiry < 0) {
        throw new TamperGuideError(ErrorCodes.INVALID_CONFIG,
          '"persistExpiry" must be a non-negative number (milliseconds). Received: ' + config.persistExpiry + '. ' +
          'Use 0 for no expiration, or e.g. 7*24*60*60*1000 for 7 days.');
      }
    }
    if (config.theme !== undefined) {
      var validThemes = ['default', 'dark', 'minimal', 'rounded'];
      if (typeof config.theme !== 'string' || validThemes.indexOf(config.theme) === -1) {
        throw new TamperGuideError(ErrorCodes.INVALID_CONFIG,
          '"theme" must be one of: ' + validThemes.join(', ') + '. Received: "' + config.theme + '".');
      }
    }
    if (config.autoRefresh !== undefined && typeof config.autoRefresh !== 'boolean') {
      throw new TamperGuideError(ErrorCodes.INVALID_CONFIG,
        '"autoRefresh" must be a boolean. Received: ' + typeof config.autoRefresh + '. ' +
        'Set autoRefresh:true to automatically reposition the overlay and popover when the DOM changes (useful for SPAs).');
    }
    if (config.autoRefreshInterval !== undefined) {
      if (typeof config.autoRefreshInterval !== 'number' || config.autoRefreshInterval < 50) {
        throw new TamperGuideError(ErrorCodes.INVALID_CONFIG,
          '"autoRefreshInterval" must be a number >= 50 (milliseconds). Received: ' + config.autoRefreshInterval + '. ' +
          'This controls the debounce delay for MutationObserver-triggered repositioning. ' +
          'Values below 50ms can cause excessive repaints and degrade performance.');
      }
    }
    if (config.beacon !== undefined) {
      if (typeof config.beacon !== 'boolean' && typeof config.beacon !== 'string' && (typeof config.beacon !== 'object' || config.beacon === null)) {
        throw new TamperGuideError(ErrorCodes.INVALID_CONFIG, '"beacon" in config must be a boolean, string, or an options object.');
      }
    }
    if (config.strict !== undefined && typeof config.strict !== 'boolean') {
      throw new TamperGuideError(ErrorCodes.INVALID_CONFIG, '"strict" in config must be a boolean.');
    }
    if (config.beforeStep !== undefined && typeof config.beforeStep !== 'function') {
      throw new TamperGuideError(ErrorCodes.INVALID_CONFIG, '"beforeStep" in config must be a function.');
    }
  }

  function validateStep(step, index) {
    if (step === null || typeof step !== 'object') {
      throw new TamperGuideError(ErrorCodes.INVALID_STEP, 'Step ' + index + ' must be an object.');
    }
    if (step.element !== undefined) {
      var t = typeof step.element;
      if (t !== 'string' && t !== 'function' && !(step.element instanceof Element)) {
        throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"element" in step ' + index + ' must be a string, function, or Element.');
      }
      if (t === 'string' && step.element.trim() === '') {
        throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"element" in step ' + index + ' is empty.');
      }
    }
    if (step.popover !== undefined) {
      if (typeof step.popover !== 'object' || step.popover === null) {
        throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"popover" in step ' + index + ' must be an object.');
      }
      if (step.popover.side && ['top', 'right', 'bottom', 'left'].indexOf(step.popover.side) === -1) {
        throw new TamperGuideError(ErrorCodes.INVALID_STEP, 'Invalid side in step ' + index + '.');
      }
      if (step.popover.align && ['start', 'center', 'end'].indexOf(step.popover.align) === -1) {
        throw new TamperGuideError(ErrorCodes.INVALID_STEP, 'Invalid align in step ' + index + '.');
      }
      if (step.popover.buttons !== undefined) {
        validateButtons(step.popover.buttons, 'step ' + index + ' popover');
      }
    }
    if (step.buttons !== undefined) {
      validateButtons(step.buttons, 'step ' + index);
    }
    if (!step.element && !step.popover) {
      throw new TamperGuideError(ErrorCodes.INVALID_STEP, 'Step ' + index + ' needs "element" or "popover".');
    }

    if (step.id !== undefined) {
      if (typeof step.id !== 'string' || step.id.trim() === '') {
        throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"id" in step ' + index + ' must be a non-empty string.' + 'Step IDs let you navigate with moveToStep("id") instead of numeric indices.');
      }
    }
    if (step.when !== undefined && typeof step.when !== 'function') {
      throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"when" in step ' + index + ' must be a function that returns a boolean.' + 'When it returns false, the step is skipped during the tour. ' + 'Example: when: function () { return document.querySelector("#panel") !== null; }');
    }
    if (step.waitFor !== undefined) {
      if (typeof step.waitFor !== 'object' || step.waitFor === null) {
        throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"waitfor" in step ' + index + ' must be an object with optional keys: timeout, pollInterval. ' + 'Example: waitFor: { timeout: 5000, pollInterval: 100 }');
      }
      if (step.waitFor.timeout !== undefined && (typeof step.waitFor.timeout !== 'number' || step.waitFor.timeout < 0)) {
        throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"waitFor.timeout" in step ' + index + ' must be a non-negative number (milliseconds).');
      }
      if (step.waitFor.pollInterval !== undefined && (typeof step.waitFor.pollInterval !== 'number' || step.waitFor.pollInterval < 16)) {
        throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"waitFor.pollInterval" in step ' + index + ' must be a number >= 16 (milliseconds). ' +  'Values below 16ms approach the browser frame rate and waste CPU cycles.');
      }
    }
    if (step.advanceOn !== undefined) {
      if (typeof step.advanceOn !== 'object' || step.advanceOn === null) {
        throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"advanceOn" in step ' + index + ' must be an object with at least an "event" key. ' + 'Example: advanceOn: { event: "click", selector: "#my-button" }');
      }
      if (!step.advanceOn.event || typeof step.advanceOn.event !== 'string') {
        throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"advanceOn.event" in step ' + index + ' is required and must be a string (e.g. "click", "input", "change").');
      }
      if (step.advanceOn.selector !== undefined && typeof step.advanceOn.selector !== 'string') {
        throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"advanceOn.selector" in step ' + index + ' must be a CSS selector string.');
      }
    }
    if (step.ariaLabel !== undefined && typeof step.ariaLabel !== 'string') {
      throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"ariaLabel" in step ' + index + ' must be a string for screen reader announcements.');
    }
    if (step.beacon !== undefined) {
      if (typeof step.beacon !== 'boolean' && typeof step.beacon !== 'string' && (typeof step.beacon !== 'object' || step.beacon === null)) {
        throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"beacon" in step ' + index + ' must be a boolean, string, or an options object. ' +
          'Example: beacon: { shape: "adaptive", color: "#f59e0b", text: "Click here" }');
      }
      if (typeof step.beacon === 'string' && step.beacon.trim() === '') {
        throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"beacon" in step ' + index + ' cannot be an empty string.');
      }
      if (typeof step.beacon === 'object') {
        var validShapes = ['adaptive', 'circle', 'radar'];
        if (step.beacon.shape !== undefined && validShapes.indexOf(step.beacon.shape) === -1) {
          throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"beacon.shape" in step ' + index + ' must be one of: ' + validShapes.join(', ') + '. Received: "' + step.beacon.shape + '".');
        }
        if (step.beacon.color !== undefined && typeof step.beacon.color !== 'string') {
          throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"beacon.color" in step ' + index + ' must be a CSS color string.');
        }
        if (step.beacon.borderWidth !== undefined && (typeof step.beacon.borderWidth !== 'number' || step.beacon.borderWidth <= 0)) {
          throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"beacon.borderWidth" in step ' + index + ' must be a positive number in pixels.');
        }
        if (step.beacon.speed !== undefined && (typeof step.beacon.speed !== 'number' || step.beacon.speed <= 0)) {
          throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"beacon.speed" in step ' + index + ' must be a positive number (seconds).');
        }
        if (step.beacon.dismissOnClick !== undefined && typeof step.beacon.dismissOnClick !== 'boolean') {
          throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"beacon.dismissOnClick" in step ' + index + ' must be a boolean.');
        }
        if (step.beacon.text !== undefined) {
          if (typeof step.beacon.text !== 'string' && (typeof step.beacon.text !== 'object' || step.beacon.text === null)) {
            throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"beacon.text" in step ' + index + ' must be a string or an options object.');
          }
          if (typeof step.beacon.text === 'string' && step.beacon.text.trim() === '') {
            throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"beacon.text" in step ' + index + ' cannot be an empty string.');
          }
          if (typeof step.beacon.text === 'object') {
            if (typeof step.beacon.text.content !== 'string' || step.beacon.text.content.trim() === '') {
              throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"beacon.text.content" in step ' + index + ' must be a non-empty string.');
            }
            var validPositions = ['top', 'bottom', 'left', 'right', 'auto'];
            if (step.beacon.text.position !== undefined && validPositions.indexOf(step.beacon.text.position) === -1) {
              throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"beacon.text.position" in step ' + index + ' must be one of: ' + validPositions.join(', ') + '. Received: "' + step.beacon.text.position + '".');
            }
            var validThemes = ['dark', 'light', 'accent'];
            if (step.beacon.text.theme !== undefined && validThemes.indexOf(step.beacon.text.theme) === -1) {
              throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"beacon.text.theme" in step ' + index + ' must be one of: ' + validThemes.join(', ') + '. Received: "' + step.beacon.text.theme + '".');
            }
            if (step.beacon.text.icon !== undefined && typeof step.beacon.text.icon !== 'string') {
              throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"beacon.text.icon" in step ' + index + ' must be a string.');
            }
            if (step.beacon.text.className !== undefined && typeof step.beacon.text.className !== 'string') {
              throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"beacon.text.className" in step ' + index + ' must be a string.');
            }
            if (step.beacon.text.background !== undefined && typeof step.beacon.text.background !== 'string') {
              throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"beacon.text.background" in step ' + index + ' must be a CSS color string.');
            }
            if (step.beacon.text.color !== undefined && typeof step.beacon.text.color !== 'string') {
              throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"beacon.text.color" in step ' + index + ' must be a CSS color string.');
            }
          }
        }
      }
    }
    if (step.strict !== undefined && typeof step.strict !== 'boolean') {
      throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"strict" in step ' + index + ' must be a boolean.');
    }
    if (step.beforeStep !== undefined && typeof step.beforeStep !== 'function') {
      throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"beforeStep" in step ' + index + ' must be a function.');
    }
    if (step.stagePadding !== undefined) {
      if (typeof step.stagePadding !== 'number' && !Array.isArray(step.stagePadding) && (typeof step.stagePadding !== 'object' || step.stagePadding === null)) {
        throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"stagePadding" in step ' + index + ' must be a number, array, or object.');
      }
    }
    if (step.stageRadius !== undefined) {
      if (typeof step.stageRadius !== 'number' && step.stageRadius !== 'auto') {
        throw new TamperGuideError(ErrorCodes.INVALID_STEP, '"stageRadius" in step ' + index + ' must be a number or "auto".');
      }
    }
  }
  // =========================================================================
  // MODULE: State Manager
  // =========================================================================

  function createStateManager() {
    var initialState = {
      isInitialized: false,
      activeIndex: undefined,
      activeElement: undefined,
      activeStep: undefined,
      previousElement: undefined,
      previousStep: undefined,
      __transitionInProgress: false,
      __focusedBeforeActivation: null,
    };
    var state = {};
    for (var k in initialState) { state[k] = initialState[k]; }
    return {
      getState: function (key) {
        if (key !== undefined) return state[key];
        var c = {};
        for (var k in state) { c[k] = state[k]; }
        return c;
      },
      setState: function (key, value) { state[key] = value; },
      resetState: function () { for (var k in initialState) { state[k] = initialState[k]; } },
    };
  }

  // =========================================================================
  // MODULE: Configuration Manager
  // =========================================================================

  var DEFAULT_CONFIG = Object.freeze({
    steps: [], animate: true, overlayColor: '#000', overlayOpacity: 0.7,
    stagePadding: 10, stageRadius: 5, allowClose: true, allowKeyboardControl: true,
    showProgress: false, showButtons: ['next', 'previous', 'close'], buttons: undefined,
    progressText: '{{current}} of {{total}}',
    nextBtnText: 'Next &rarr;', prevBtnText: '&larr; Previous',
    doneBtnText: 'Done &#10003;', closeBtnText: '&times;',
    popoverClass: '', popoverOffset: 10, smoothScroll: true,
    scrollIntoViewOptions: { behavior: 'smooth', block: 'nearest', inline: 'nearest' },
    disableActiveInteraction: false, allowBackdropInteraction: false,
    strict: false, beforeStep: undefined,
    onHighlightStarted: undefined, onHighlighted: undefined, onDeselected: undefined,
    onDestroyStarted: undefined, onDestroyed: undefined, onNextClick: undefined,
    onPrevClick: undefined, onCloseClick: undefined, onPopoverRender: undefined, persist: false, persistKey: '', persistStorage: 'localStorage', persistExpiry: 604800000, theme: 'default', autoRefresh: false, autoRefreshInterval: 300, onStepChange: undefined, onTourComplete: undefined,
  });

  function createConfigManager(userConfig) {
    var config = {};
    var dk = Object.keys(DEFAULT_CONFIG);
    for (var i = 0; i < dk.length; i++) { config[dk[i]] = DEFAULT_CONFIG[dk[i]]; }
    var uk = Object.keys(userConfig);
    for (var j = 0; j < uk.length; j++) { config[uk[j]] = userConfig[uk[j]]; }
    return {
      getConfig: function (key) {
        if (key !== undefined) return config[key];
        var c = {};
        for (var k in config) { c[k] = config[k]; }
        return c;
      },
      setConfig: function (nc) {
        validateConfig(nc);
        var nk = Object.keys(nc);
        for (var i = 0; i < nk.length; i++) { config[nk[i]] = nc[nk[i]]; }
      },
    };
  }

  // =========================================================================
  // MODULE: Event Emitter
  // =========================================================================

  function createEmitter() {
    var listeners = {};
    return {
      on: function (ev, cb) {
        if (!listeners[ev]) listeners[ev] = [];
        listeners[ev].push(cb);
      },
      off: function (ev, cb) {
        if (!listeners[ev]) return;
        var i = listeners[ev].indexOf(cb);
        if (i > -1) listeners[ev].splice(i, 1);
      },
      emit: function (ev) {
        if (!listeners[ev]) return;
        var args = Array.prototype.slice.call(arguments, 1);
        var cbs = listeners[ev].slice();
        for (var i = 0; i < cbs.length; i++) {
          try { cbs[i].apply(null, args); }
          catch (err) { warn(ErrorCodes.HOOK_ERROR, 'Listener error: ' + err.message); }
        }
      },
      destroy: function () { listeners = {}; },
    };
  }

  // =========================================================================
  // MODULE: CSS Styles
  // =========================================================================

  var STYLE_ID = 'tamperguide-styles';
  var injectedStyleEl = null;

  var THEMES = Object.freeze({
    'default': {},
    'dark': {
      '--tg-bg': '#1e1e2e',
      '--tg-color': '#cdd6f4',
      '--tg-title-color': '#cdd6f4',
      '--tg-desc-color': '#a6adc8',
      '--tg-btn-primary-bg': '#89b4fa',
      '--tg-btn-primary-color': '#1e1e2e',
      '--tg-btn-secondary-bg': '#313244',
      '--tg-btn-secondary-color': '#cdd6f4',
      '--tg-shadow': '0 8px 32px rgba(0,0,0,0.5)',
      '--tg-arrow-bg': '#1e1e2e',
      '--tg-progress-color': '#6c7086',
      '--tg-close-color': '#6c7086',
      '--tg-close-hover-color': '#cdd6f4',
      '--tg-close-hover-bg': '#313244',
      '--tg-border-radius': '8px',
      '--tg-btn-radius': '6px',
    },
    'minimal': {
      '--tg-bg': '#ffffff',
      '--tg-color': '#1a1a2e',
      '--tg-title-color': '#0f0f23',
      '--tg-desc-color': '#4a4a6a',
      '--tg-btn-primary-bg': '#111111',
      '--tg-btn-primary-color': '#ffffff',
      '--tg-btn-secondary-bg': 'transparent',
      '--tg-btn-secondary-color': '#666666',
      '--tg-shadow': '0 2px 8px rgba(0,0,0,0.1)',
      '--tg-arrow-bg': '#ffffff',
      '--tg-progress-color': '#8888aa',
      '--tg-close-color': '#aaaaaa',
      '--tg-close-hover-color': '#333333',
      '--tg-close-hover-bg': '#f0f0f5',
      '--tg-border-radius': '8px',
      '--tg-btn-radius': '6px',
    },
    'rounded': {
      '--tg-bg': '#ffffff',
      '--tg-color': '#1a1a2e',
      '--tg-title-color': '#0f0f23',
      '--tg-desc-color': '#4a4a6a',
      '--tg-btn-primary-bg': '#3b82f6',
      '--tg-btn-primary-color': '#ffffff',
      '--tg-btn-secondary-bg': '#f0f0f5',
      '--tg-btn-secondary-color': '#4a4a6a',
      '--tg-shadow': '0 8px 32px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.1)',
      '--tg-arrow-bg': '#ffffff',
      '--tg-progress-color': '#8888aa',
      '--tg-close-color': '#aaaaaa',
      '--tg-close-hover-color': '#333333',
      '--tg-close-hover-bg': '#f0f0f5',
      '--tg-border-radius': '16px',
      '--tg-btn-radius': '20px',
    },
  });

  function injectStyles(zOverlay, zPopover) {
    if (document.getElementById(STYLE_ID) || (injectedStyleEl && injectedStyleEl.parentNode)) return;
    var css = [
      '.tg-overlay { position: fixed; inset: 0; z-index: ' + zOverlay + '; pointer-events: none; transition: opacity 0.3s ease; }',
      '.tg-overlay svg { position: absolute; inset: 0; width: 100%; height: 100%; }',
      '.tg-overlay-clickable { pointer-events: auto; cursor: default; }',
      '',
      '.tg-popover {',
      '  all: initial; position: fixed; z-index: ' + zPopover + ';',
      '  background: var(--tg-bg, #fff); color: var(--tg-color, #1a1a2e);',
      '  border-radius: var(--tg-border-radius, 8px);',
      '  box-shadow: var(--tg-shadow, 0 8px 32px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.1));',
      '  padding: 16px 20px; max-width: 380px; min-width: 240px;',
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;',
      '  font-size: 14px; line-height: 1.5; opacity: 0; pointer-events: auto;',
      '  box-sizing: border-box; word-wrap: break-word; overflow-wrap: break-word;',
      '}',
      '.tg-popover *, .tg-popover *::before, .tg-popover *::after { box-sizing: border-box; }',
      '.tg-popover-visible { opacity: 1; }',
      '.tg-popover-animated { transition: opacity 0.25s ease, transform 0.25s ease; }',
      '.tg-popover-arrow { position: absolute; width: 12px; height: 12px; background: var(--tg-arrow-bg, #fff); transform: rotate(45deg); z-index: -1; }',
      '.tg-popover-title { display: block; font-size: 16px; font-weight: 700; margin: 0 0 8px 0; padding: 0; color: var(--tg-title-color, #0f0f23); line-height: 1.3; }',
      '.tg-popover-description { display: block; font-size: 14px; font-weight: 400; margin: 0 0 16px 0; padding: 0; color: var(--tg-desc-color, #4a4a6a); line-height: 1.6; }',
      '.tg-popover-description:last-child { margin-bottom: 0; }',
      '.tg-popover-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 4px; }',
      '.tg-popover-progress { font-size: 12px; color: var(--tg-progress-color, #8888aa); font-weight: 500; flex-shrink: 0; }',
      '.tg-popover-buttons { display: flex; gap: 6px; margin-left: auto; }',
      '.tg-popover-btn {',
      '  display: inline-flex; align-items: center; justify-content: center;',
      '  border: none; border-radius: var(--tg-btn-radius, 6px); padding: 6px 14px; font-size: 13px; font-weight: 600;',
      '  cursor: pointer; transition: background-color 0.15s ease, transform 0.1s ease;',
      '  font-family: inherit; line-height: 1.4; white-space: nowrap; text-decoration: none; outline: none;',
      '}',
      '.tg-popover-btn:active { transform: scale(0.96); }',
      '.tg-popover-btn:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }',
      '.tg-popover-btn-prev, .tg-popover-btn-secondary { background: var(--tg-btn-secondary-bg, #f0f0f5); color: var(--tg-btn-secondary-color, #4a4a6a); }',
      '.tg-popover-btn-prev:hover:not(:disabled), .tg-popover-btn-secondary:hover:not(:disabled) { background: var(--tg-btn-secondary-bg, #e0e0ea); filter: brightness(0.95); }',
      '.tg-popover-btn-next, .tg-popover-btn-done, .tg-popover-btn-primary { background: var(--tg-btn-primary-bg, #3b82f6); color: var(--tg-btn-primary-color, #fff); }',
      '.tg-popover-btn-next:hover:not(:disabled), .tg-popover-btn-done:hover:not(:disabled), .tg-popover-btn-primary:hover:not(:disabled) { background: var(--tg-btn-primary-bg, #2563eb); filter: brightness(0.9); }',
      '.tg-popover-btn-link { background: transparent; color: var(--tg-color, #4a4a6a); padding: 6px 8px; font-weight: 500; }',
      '.tg-popover-btn-link:hover:not(:disabled) { text-decoration: underline; color: var(--tg-title-color, #0f0f23); }',
      '.tg-popover-btn-danger { background: #ef4444; color: #ffffff; }',
      '.tg-popover-btn-danger:hover:not(:disabled) { background: #dc2626; }',
      '.tg-popover-btn:disabled, .tg-popover-btn[aria-disabled="true"] { opacity: 0.5; cursor: not-allowed; transform: none !important; }',
      '.tg-popover-btn-close {',
      '  position: absolute; top: 8px; right: 8px; background: transparent;',
      '  border: none; font-size: 18px; color: var(--tg-close-color, #aaa); cursor: pointer;',
      '  padding: 2px 6px; border-radius: 4px; line-height: 1;',
      '  transition: color 0.15s ease, background-color 0.15s ease;',
      '  text-decoration: none; outline: none;',
      '}',
      '.tg-popover-btn-close:hover { color: var(--tg-close-hover-color, #333); background: var(--tg-close-hover-bg, #f0f0f5); }',
      '.tg-popover-btn-close:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }',
      '@keyframes tg-fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }',
      '.tg-popover-enter { animation: tg-fadeIn 0.25s ease forwards; }',
      '',
      
      '@keyframes tg-pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.8); opacity: 0.4; } 100% { transform: scale(2.5); opacity: 0; } }',
      '.tg-hotspot { position: absolute; z-index: ' + zPopover + '; pointer-events: auto; cursor: pointer; }',
      '.tg-hotspot-dot { width: 12px; height: 12px; border-radius: 50%; position: relative; }',
      '.tg-hotspot-pulse { position: absolute; inset: 0; border-radius: 50%; animation: tg-pulse 2s ease-out infinite; }',
      '.tg-hotspot-tooltip {',
      '  position: absolute; background: var(--tg-bg, #fff); color: var(--tg-desc-color, #4a4a6a);',
      '  border-radius: var(--tg-border-radius, 8px); padding: 8px 12px; font-size: 13px;',
      '  box-shadow: var(--tg-shadow, 0 4px 16px rgba(0,0,0,0.15)); white-space: nowrap;',
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;',
      '  pointer-events: none; opacity: 0; transition: opacity 0.2s ease; line-height: 1.4;',
      '}',
      '.tg-hotspot:hover .tg-hotspot-tooltip { opacity: 1; }',
      '',
      '@keyframes tg-beacon-ripple-adaptive {',
      '  0% { transform: scale(1); opacity: 0.9; }',
      '  100% { transform: scale(1.18); opacity: 0; }',
      '}',
      '@keyframes tg-beacon-ripple-circle {',
      '  0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0.95; }',
      '  100% { transform: translate(-50%, -50%) scale(1.6); opacity: 0; }',
      '}',
      '.tg-beacon { position: absolute; pointer-events: none; z-index: ' + (zPopover + 1) + '; box-sizing: border-box; }',
      '.tg-beacon-wave { position: absolute; inset: 0; border-radius: inherit; border: var(--tg-beacon-border-width, 3px) solid var(--tg-beacon-color, #f59e0b); box-sizing: border-box; pointer-events: none; will-change: transform, opacity; }',
      '.tg-beacon-adaptive .tg-beacon-wave-1 { animation: tg-beacon-ripple-adaptive var(--tg-beacon-speed, 2s) cubic-bezier(0, 0.2, 0.8, 1) infinite; }',
      '.tg-beacon-adaptive .tg-beacon-wave-2 { animation: tg-beacon-ripple-adaptive var(--tg-beacon-speed, 2s) cubic-bezier(0, 0.2, 0.8, 1) infinite; animation-delay: calc(var(--tg-beacon-speed, 2s) / -2); }',
      '.tg-beacon-circle { width: 50px; height: 50px; border-radius: 50%; }',
      '.tg-beacon-circle .tg-beacon-wave { left: 50%; top: 50%; width: 50px; height: 50px; border-radius: 50%; }',
      '.tg-beacon-circle .tg-beacon-wave-1 { animation: tg-beacon-ripple-circle var(--tg-beacon-speed, 2s) cubic-bezier(0, 0.2, 0.8, 1) infinite; }',
      '.tg-beacon-circle .tg-beacon-wave-2 { animation: tg-beacon-ripple-circle var(--tg-beacon-speed, 2s) cubic-bezier(0, 0.2, 0.8, 1) infinite; animation-delay: calc(var(--tg-beacon-speed, 2s) / -2); }',
      '',
      '@keyframes tg-beacon-label-in {',
      '  from { opacity: 0; transform: translateY(3px) scale(0.96); }',
      '  to { opacity: 1; transform: translateY(0) scale(1); }',
      '}',
      '.tg-beacon-label {',
      '  position: absolute; display: inline-flex; align-items: center; gap: 6px;',
      '  white-space: nowrap; padding: 6px 12px; font-size: 12px; font-weight: 500;',
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;',
      '  border-radius: 9999px; pointer-events: none; z-index: 2;',
      '  box-shadow: 0 4px 14px rgba(0,0,0,0.22); line-height: 1.3;',
      '  animation: tg-beacon-label-in 0.22s cubic-bezier(0.16, 1, 0.3, 1); will-change: transform, opacity;',
      '}',
      '.tg-beacon-label-top { bottom: calc(100% + 9px); left: 50%; transform: translateX(-50%); }',
      '.tg-beacon-label-bottom { top: calc(100% + 9px); left: 50%; transform: translateX(-50%); }',
      '.tg-beacon-label-left { right: calc(100% + 9px); top: 50%; transform: translateY(-50%); }',
      '.tg-beacon-label-right { left: calc(100% + 9px); top: 50%; transform: translateY(-50%); }',
      '.tg-beacon-label-arrow { position: absolute; width: 0; height: 0; border-style: solid; pointer-events: none; }',
      '.tg-beacon-label-top .tg-beacon-label-arrow { bottom: -5px; left: 50%; transform: translateX(-50%); border-width: 5px 5px 0 5px; border-color: inherit transparent transparent transparent; }',
      '.tg-beacon-label-bottom .tg-beacon-label-arrow { top: -5px; left: 50%; transform: translateX(-50%); border-width: 0 5px 5px 5px; border-color: transparent transparent inherit transparent; }',
      '.tg-beacon-label-left .tg-beacon-label-arrow { right: -5px; top: 50%; transform: translateY(-50%); border-width: 5px 0 5px 5px; border-color: transparent transparent transparent inherit; }',
      '.tg-beacon-label-right .tg-beacon-label-arrow { left: -5px; top: 50%; transform: translateY(-50%); border-width: 5px 5px 5px 0; border-color: transparent inherit transparent transparent; }',
      '.tg-beacon-label-theme-dark { background: rgba(15, 23, 42, 0.94); color: #f8fafc; border-color: rgba(15, 23, 42, 0.94); }',
      '.tg-beacon-label-theme-light { background: #ffffff; color: #0f172a; border-color: #ffffff; box-shadow: 0 4px 14px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.08); }',
      '.tg-beacon-label-theme-accent { background: var(--tg-beacon-color, #f59e0b); color: #ffffff; border-color: var(--tg-beacon-color, #f59e0b); }',
      '.tg-beacon-label-icon { display: inline-flex; align-items: center; line-height: 1; font-size: 13px; }',
      '.tg-beacon-label-text { display: inline-block; line-height: 1.3; }',
      '',
      '.tg-live-region { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }',
      '',
      '@keyframes tg-shake {',
      '  0%, 100% { transform: translateX(0); }',
      '  20% { transform: translateX(-6px); }',
      '  40% { transform: translateX(6px); }',
      '  60% { transform: translateX(-4px); }',
      '  80% { transform: translateX(4px); }',
      '}',
      '.tg-shake { animation: tg-shake 0.38s ease-in-out !important; }',
    ].join('\n');

    // Strategy 1: Use GM_addStyle if granted and available (privileged extension API, bypasses CSP)
    if (typeof GM_addStyle === 'function') {
      try {
        var res = GM_addStyle(css);
        if (res && res.nodeType === 1) {
          injectedStyleEl = res;
          injectedStyleEl.id = STYLE_ID;
        } else {
          var found = document.getElementById(STYLE_ID);
          if (found) injectedStyleEl = found;
        }
        return;
      } catch (e) {
        warn('CSP', 'GM_addStyle failed: ' + e.message + '. Falling back to DOM <style> element.');
      }
    }

    // Strategy 2: Standard DOM element creation (for @grant none or environments without GM_addStyle)
    try {
      var style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = css;
      (document.head || document.documentElement).appendChild(style);
      injectedStyleEl = style;
    } catch (err) {
      warn('CSP', 'Failed to inject styles into the document: ' + err.message + '. ' +
        'If this page enforces a strict Content Security Policy (CSP), add:\n' +
        '  // @grant GM_addStyle\n' +
        'to your userscript header to allow TamperGuide to bypass CSP restrictions.');
    }
  }

  function removeStyles() {
    if (injectedStyleEl && injectedStyleEl.parentNode) {
      try { injectedStyleEl.remove(); }
      catch (e) { /* Best effort */ }
      injectedStyleEl = null;
    }
    var el = document.getElementById(STYLE_ID);
    if (el && el.parentNode) {
      try { el.remove(); }
      catch (e) { /* Best effort */ }
    }
  }

  // =========================================================================
  // MODULE: DOM Utilities
  // =========================================================================

  /**
   * Crosses shadow root boundaries to find the logical parent element.
   * If the node is directly inside a ShadowRoot, parentElement is null,
   * but parentNode.host gives the custom element (host) in the outer DOM.
   */
  function getParentCrossShadow(element) {
    if (!element) return null;
    if (element.parentElement) return element.parentElement;
    if (element.parentNode && element.parentNode.host) return element.parentNode.host;
    return null;
  }

  /**
   * Recursively walks open shadow roots looking for a matching selector.
   */
  function findInShadowRoots(selector, root) {
    var scope = (root === document || !root) ? document.body : root;
    if (!scope) return null;

    // Check immediate shadow root if scope is a shadow host
    if (scope.shadowRoot) {
      try {
        var found = scope.shadowRoot.querySelector(selector);
        if (found) return found;
        var nested = findInShadowRoots(selector, scope.shadowRoot);
        if (nested) return nested;
      } catch (e) {}
    }

    // Walk all descendants that might have an open shadowRoot using TreeWalker
    var walker = null;
    if (typeof document !== 'undefined' && typeof document.createTreeWalker === 'function') {
      try {
        var filter = (typeof NodeFilter !== 'undefined' && NodeFilter.SHOW_ELEMENT) ? NodeFilter.SHOW_ELEMENT : 1;
        walker = document.createTreeWalker(scope, filter, null, false);
      } catch (e) {
        walker = null;
      }
    }

    if (walker) {
      var node = walker.currentNode || walker.nextNode();
      while (node) {
        if (node.shadowRoot) {
          try {
            var el = node.shadowRoot.querySelector(selector);
            if (el) return el;
            var sub = findInShadowRoots(selector, node.shadowRoot);
            if (sub) return sub;
          } catch (e) {}
        }
        node = walker.nextNode();
      }
    } else if (scope.querySelectorAll) {
      try {
        var all = scope.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
          if (all[i].shadowRoot) {
            var el2 = all[i].shadowRoot.querySelector(selector);
            if (el2) return el2;
            var sub2 = findInShadowRoots(selector, all[i].shadowRoot);
            if (sub2) return sub2;
          }
        }
      } catch (e) {}
    }

    return null;
  }

  /**
   * Queries an element across Shadow DOM boundaries using piercing syntax (>>> or ::shadow),
   * or by recursively searching open shadow roots if standard querySelector returns null.
   *
   * @param {string} selector
   * @param {Node} [root=document]
   * @returns {Element|null}
   */
  function querySelectorDeep(selector, root) {
    if (!selector || typeof selector !== 'string') return null;
    root = root || document;

    // 1. Piercing selector syntax: e.g. "my-element >>> .inner-button" or "host::shadow button"
    var delimiter = selector.indexOf('>>>') !== -1 ? '>>>' : (selector.indexOf('::shadow') !== -1 ? '::shadow' : null);
    if (delimiter) {
      var parts = selector.split(delimiter).map(function (s) { return s.trim(); }).filter(Boolean);
      var current = root;
      for (var i = 0; i < parts.length; i++) {
        if (!current) return null;
        var part = parts[i];
        var next = null;
        var scope = (current.shadowRoot && i > 0) ? current.shadowRoot : current;
        try {
          next = scope.querySelector(part);
        } catch (e) {
          return null;
        }
        if (!next && current.shadowRoot && scope !== current.shadowRoot) {
          try { next = current.shadowRoot.querySelector(part); } catch (e) {}
        }
        current = next;
      }
      return current instanceof Element ? current : null;
    }

    // 2. Fast path: Direct query in the current root
    try {
      var direct = root.querySelector(selector);
      if (direct) return direct;
    } catch (e) {
      return null;
    }

    // 3. Fallback: Search inside all open ShadowRoots in root
    return findInShadowRoots(selector, root);
  }

  function resolveElement(element) {
    if (!element) return null;
    try {
      if (typeof element === 'function') {
        var result = element();
        if (result instanceof Element) return (result.isConnected || document.body.contains(result)) ? result : null;
        warn(ErrorCodes.ELEMENT_NOT_FOUND, 'element() did not return a DOM Element.');
        return null;
      }
      if (element instanceof Element) return (element.isConnected || document.body.contains(element)) ? element : null;
      if (typeof element === 'string') {
        var found = querySelectorDeep(element);
        if (!found) warn(ErrorCodes.ELEMENT_NOT_FOUND, 'No element for "' + element + '".');
        return found;
      }
    } catch (err) { warn(ErrorCodes.ELEMENT_NOT_FOUND, 'Resolve error: ' + err.message); }
    return null;
  }

  /**
   * Returns the usable viewport dimensions, excluding scrollbars.
   * This matches the coordinate space used by getBoundingClientRect()
   * and position:fixed elements, ensuring the SVG cutout aligns
   * perfectly with the highlighted element.
   *
   * - document.documentElement.clientWidth excludes the vertical scrollbar
   * - document.documentElement.clientHeight excludes the horizontal scrollbar
   * - window.innerWidth/innerHeight INCLUDE scrollbars and cause misalignment
   *
   * @returns {{ width: number, height: number }}
   */
  function getViewportSize() {
    return {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
    };
  }

  function getElementRect(element, padding, radius) {
    var padTop = 0, padRight = 0, padBottom = 0, padLeft = 0;
    if (typeof padding === 'number') {
      padTop = padRight = padBottom = padLeft = padding;
    } else if (Array.isArray(padding)) {
      if (padding.length === 2) {
        padTop = padBottom = Number(padding[0]) || 0;
        padLeft = padRight = Number(padding[1]) || 0;
      } else if (padding.length >= 4) {
        padTop = Number(padding[0]) || 0;
        padRight = Number(padding[1]) || 0;
        padBottom = Number(padding[2]) || 0;
        padLeft = Number(padding[3]) || 0;
      }
    } else if (padding && typeof padding === 'object') {
      padTop = Number(padding.top !== undefined ? padding.top : (padding.y || 0)) || 0;
      padBottom = Number(padding.bottom !== undefined ? padding.bottom : (padding.y || 0)) || 0;
      padLeft = Number(padding.left !== undefined ? padding.left : (padding.x || 0)) || 0;
      padRight = Number(padding.right !== undefined ? padding.right : (padding.x || 0)) || 0;
    }

    var rect = element.getBoundingClientRect();
    var x = rect.left - padLeft;
    var y = rect.top - padTop;
    var width = rect.width + padLeft + padRight;
    var height = rect.height + padTop + padBottom;

    var actualRadius = 0;
    if (radius === 'auto') {
      try {
        var comp = window.getComputedStyle(element);
        var br = comp.borderRadius || '';
        if (br.indexOf('%') !== -1 || parseFloat(br) >= 9000) {
          actualRadius = Math.min(width, height) / 2;
        } else {
          var parsed = parseFloat(br);
          actualRadius = isNaN(parsed) ? 5 : parsed;
        }
      } catch (e) {
        actualRadius = 5;
      }
    } else if (typeof radius === 'number') {
      actualRadius = radius;
    } else {
      actualRadius = 0;
    }

    return {
      x: x,
      y: y,
      width: width,
      height: height,
      radius: actualRadius,
    };
  }

  function hasScrollableAncestor(element) {
    var c = element ? getParentCrossShadow(element) : null;
    while (c && c !== document.body && c !== document.documentElement) {
      if (c.nodeType === 1) {
        var style = window.getComputedStyle(c);
        var ox = style.overflowX, oy = style.overflowY;
        if ((ox === 'auto' || ox === 'scroll') && (c.scrollWidth > c.clientWidth)) return true;
        if ((oy === 'auto' || oy === 'scroll') && (c.scrollHeight > c.clientHeight)) return true;
      }
      c = getParentCrossShadow(c);
    }
    return false;
  }

  function isElementClippedOrOffscreen(element) {
    if (!element || typeof element.getBoundingClientRect !== 'function') return false;
    var r = element.getBoundingClientRect();
    var vp = getViewportSize();
    if (r.top < 0 || r.left < 0 || r.bottom > vp.height || r.right > vp.width) return true;
    var c = getParentCrossShadow(element);
    while (c && c !== document.body && c !== document.documentElement) {
      if (c.nodeType === 1) {
        var style = window.getComputedStyle(c);
        var ox = style.overflowX, oy = style.overflowY;
        var hasScrollX = (ox === 'auto' || ox === 'scroll' || ox === 'hidden');
        var hasScrollY = (oy === 'auto' || oy === 'scroll' || oy === 'hidden');
        if (hasScrollX || hasScrollY) {
          var cr = c.getBoundingClientRect();
          if ((hasScrollX && (r.left < cr.left - 1 || r.right > cr.right + 1)) ||
              (hasScrollY && (r.top < cr.top - 1 || r.bottom > cr.bottom + 1))) {
            return true;
          }
        }
      }
      c = getParentCrossShadow(c);
    }
    return false;
  }

  function bringIntoView(element, options) {
    if (!element || typeof element.scrollIntoView !== 'function') return;
    try {
      var selfStyle = window.getComputedStyle(element);
      if (selfStyle.position === 'fixed' && !hasScrollableAncestor(element)) return;
    } catch (e) { /* ignore */ }

    var defaultOptions = { behavior: 'smooth', block: 'nearest', inline: 'nearest' };
    if (options && typeof options === 'object') {
      var merged = {};
      for (var k in defaultOptions) { merged[k] = defaultOptions[k]; }
      for (var uk in options) { merged[uk] = options[uk]; }
      options = merged;
    } else {
      options = defaultOptions;
    }

    try {
      if (isElementClippedOrOffscreen(element)) {
        element.scrollIntoView(options);
      }
    } catch (err) { warn('SCROLL', 'Could not scroll: ' + err.message); }
  }

  function isInsideFixedContainer(element) {
    var c = element;
    while (c && c !== document.body && c !== document.documentElement) {
      if (c.nodeType === 1 && window.getComputedStyle(c).position === 'fixed') return true;
      c = getParentCrossShadow(c);
    }
    return false;
  }

  function findStackingAncestor(element) {
    var c = element ? getParentCrossShadow(element) : null;
    while (c && c !== document.body && c !== document.documentElement) {
      if (c.nodeType === 1) {
        var style = window.getComputedStyle(c);
        var pos = style.position;
        var z = style.zIndex;
        var transform = style.transform || style.webkitTransform;
        if (pos !== 'static' && z !== 'auto') return c;
        if (pos === 'fixed' || pos === 'sticky') return c;
        if (transform && transform !== 'none') return c;
      }
      c = getParentCrossShadow(c);
    }
    return null;
  }

  function getEffectiveZIndex(element) {
    var highest = 0;
    var current = element;
    while (current && current !== document.body && current !== document.documentElement) {
      if (current.nodeType === 1) {
        var style = window.getComputedStyle(current);
        var z = parseInt(style.zIndex, 10);
        if (!isNaN(z) && z > highest) highest = z;
      }
      current = getParentCrossShadow(current);
    }
    return highest;
  }

    // =========================================================================
  // [NEW v1.5.0] MODULE: Persistence Manager
  // =========================================================================
  // Saves and restores tour progress across page navigations and reloads.
  // This is critical for userscripts because the user constantly navigates
  // between pages on the same site, and without persistence the tour resets.
  //
  // Supports two storage backends:
  //   - "localStorage": works without special Tampermonkey grants, but is
  //     limited to the same origin (protocol + domain + port).
  //   - "GM": uses GM_setValue/GM_getValue which persist across all origins
  //     where the userscript runs. Requires @grant GM_setValue, GM_getValue,
  //     and GM_deleteValue in the userscript header.
  //
  // All storage operations are wrapped in try/catch because:
  //   - localStorage may be disabled (private browsing, CSP, iframe sandbox)
  //   - GM_* functions may not be available if the developer forgot the @grant
  //   - JSON.parse may fail on corrupted data
  //
  // The saved data structure is:
  //   { index: number, completed: boolean, timestamp: number }
  //
  // The key is prefixed with "tg_" to avoid collisions with other scripts.
  // =========================================================================

  function createPersistenceManager(configManager)  {
    /**
     * Returns a storage adapter based on the configured strategy.
     * The adapter exposes get(key), set(key, value), and remove(key).
     * If the "GM" strategy is selected but GM_* functions are not available,
     * it falls back to localStorage and logs a detailed warning explaining
     * what @grant directives the developer needs to add.
     *
     * @returns {{ get: function, set: function, remove: function }}
     */

    function getStorage() {
      var strategy = configManager.getConfig('persistStorage');
      if (strategy === 'GM') {
        // Check that all three GM functions are available.
        // They might be missing if the developer forgot to add @grant directives.

        var hasGM = (typeof GM_setValue === 'function') && (typeof GM_getValue === 'function') && (typeof GM_deleteValue === 'function');
        if (hasGM) {
          return {
            get: function (key) {
              try {
                var raw = GM_getValue(key, null);
                if (raw === null) return null;
                // GM_getValue may return the object directly (no JSON wrapper)
                // or a string depending on the Tampermonkey version.
                if (typeof raw === 'object') return raw;
                return JSON.parse(raw);
              } catch (e) {
                warn(ErrorCodes.PERSISTENCE_ERROR, 'Failed to read from GM storage (key: "' + key + '"): ' + e.message + '. ' + 'The saved progress data may be corrupted. Call resetProgress() to clear it.');
                return null;
              }
            },
            set: function (key, val) {
              try { GM_setValue(key, JSON.stringify(val)); }
              catch (e) {
                warn(ErrorCodes.PERSISTENCE_ERROR, 'Failed to write to GM storage (key: "' + key + '"): ' + e.message + '. ');
              }
            },
            remove: function (key) {
              try { GM_deleteValue(key); }
              catch (e) {
                warn(ErrorCodes.PERSISTENCE_ERROR, 'Failed to delete from GM storage (key: "' + key + '"): ' + e.message + '. ');
              }
            },
          };
        }
        // GM functions not found: fall back and warn the developer.
        warn(ErrorCodes.PERSISTENCE_ERROR, 'persistStorage is set to "GM" but GM_setValue/GM_getValue/GM_deleteValue are not available. ' +
          'Make sure your userscript header includes:\n' +
          '  // @grant GM_setValue\n' +
          '  // @grant GM_getValue\n' +
          '  // @grant GM_deleteValue\n' +
          'Falling back to localStorage. Note that localStorage is limited to the current origin.');
      }
      // Default: localStorage adapter
      return {
        get: function (key) {
          try {
            var raw = localStorage.getItem(key);
            if (raw === null) return null;
            return JSON.parse(raw);
          } catch (e) {
            warn(ErrorCodes.PERSISTENCE_ERROR, 'Failed to read from localStorage (key: "' + key + '"): ' + e.message + '. ' +
              'This can happen in private browsing mode or when localStorage is disabled. ' +
              'The tour will start from step 0.');
            return null;
          }
        },
        set: function (key, val) {
          try { localStorage.setItem(key, JSON.stringify(val)); }
          catch (e) {
            warn(ErrorCodes.PERSISTENCE_ERROR, 'Failed to write to localStorage (key: "' + key + '"): ' + e.message + '. ' +
              'Storage may be full or disabled. Tour progress will not be saved.');
          }
        },
        remove: function (key) {
          try { localStorage.removeItem(key); }
          catch (e) {
            warn(ErrorCodes.PERSISTENCE_ERROR, 'Failed to remove from localStorage (key: "' + key + '"): ' + e.message + '.');
          }
        },
      };
    }

    /**
     * Builds the full storage key by prepending the "tg_" namespace.
     * Returns null if persistence is disabled or no persistKey is configured.
     *
     * @returns {string|null}
     */

    function getFullKey() {
      if (!configManager.getConfig('persist')) return null;
      var key = configManager.getConfig('persistKey');
      if (!key) return null;
      return 'tg_' + key;
    }

    /**
     * Saves the current step index and completion status.
     * Called internally after each step transition and on tour completion.
     *
     * @param {number} index - The zero-based step index
     * @param {boolean} completed - Whether the tour has been fully completed
     */

    function save(index, completed) {
      var fullKey = getFullKey();
      if (!fullKey) return;
      getStorage().set(fullKey, {
        index: index,
        completed: completed || false,
        timestamp: Date.now(),
      });
    }

    /**
     * Loads previously saved progress.
     * Returns null if no progress exists, persistence is disabled,
     * or the saved data has expired.
     *
     * @returns {{ index: number, completed: boolean, timestamp: number }|null}
     */
    function load() {
      var fullKey = getFullKey();
      if (!fullKey) return null;
      var data = getStorage().get(fullKey);
      if (!data) return null;
      // Validate the loaded data structure to handle corrupted entries.
      if (typeof data.index !== 'number' || typeof data.timestamp !== 'number') {
        warn(ErrorCodes.PERSISTENCE_ERROR, 'Saved progress data is malformed (key: "' + fullKey + '"). ' +
          'Expected { index: number, completed: boolean, timestamp: number }. ' +
          'Clearing corrupted data and starting from step 0.');
        getStorage().remove(fullKey);
        return null;
      }
      // Check expiration.
      var expiry = configManager.getConfig('persistExpiry');
      if (expiry > 0 && Date.now() - data.timestamp > expiry) {
        getStorage().remove(fullKey);
        return null;
      }
      return data;
    }

    /**
     * Clears all saved progress for this tour.
     */
    function clear() {
      var fullKey = getFullKey();
      if (fullKey) getStorage().remove(fullKey);
    }

    return { save: save, load: load, clear: clear };

  }

    // =========================================================================
  // [NEW v1.5.0] MODULE: Analytics Tracker
  // =========================================================================
  // Collects timing and navigation data during the tour and reports it
  // through two callbacks: onStepChange (per-step) and onTourComplete (summary).
  //
  // This module is completely passive: it only reads state and calls hooks.
  // It never modifies the DOM, state, or config. If the callbacks throw,
  // errors are caught and warned (same pattern as all other hooks).
  //
  // The tracker records:
  //   - Which steps were visited and in what order
  //   - Time spent on each step (milliseconds)
  //   - Navigation direction (forward / backward / jump)
  //   - Whether the tour was completed or abandoned
  //   - Total duration of the tour session
  // =========================================================================

  function createAnalyticsTracker(configManager) {
    var startTime = 0;
    var stepEnteredAt = 0;
    var visitedIndexes = [];
    var lastIndex = -1;

    /**
     * Called when the tour starts. Resets all counters.
     */
    function begin() {
      startTime = Date.now();
      stepEnteredAt = startTime;
      visitedIndexes = [];
      lastIndex = -1;
    }

    /**
     * Called when a step transition occurs. Computes duration of the
     * previous step and fires the onStepChange callback.
     *
     * @param {number} newIndex - The index of the step being entered
     * @param {object} step - The step configuration object
     */
    function trackStep(newIndex, step) {
      var now = Date.now();
      var duration = stepEnteredAt > 0 ? (now - stepEnteredAt) : 0;
      var direction = 'forward';
      if (lastIndex >= 0) {
        if (newIndex < lastIndex) direction = 'backward';
        else if (newIndex > lastIndex + 1) direction = 'jump';
      }

      if (visitedIndexes.indexOf(newIndex) === -1) {
        visitedIndexes.push(newIndex);
      }

      var totalSteps = (configManager.getConfig('steps') || []).length;
      var event = {
        type: 'enter',
        stepIndex: newIndex,
        stepId: step.id || null,
        duration: duration,
        timestamp: now,
        totalSteps: totalSteps,
        direction: direction,
      };

      var hook = configManager.getConfig('onStepChange');
      if (hook) {
        try { hook(event); }
        catch (err) { warn(ErrorCodes.HOOK_ERROR, 'onStepChange error: ' + err.message); }
      }

      stepEnteredAt = now;
      lastIndex = newIndex;
    }

    /**
     * Called when the tour ends (either completed or abandoned).
     * Computes the summary and fires onTourComplete.
     *
     * @param {boolean} completed - Whether all steps were visited
     * @param {number} exitIndex - The index of the step when the tour ended
     */

    function finish(completed, exitIndex) {
      var now = Date.now();
      var totalDuration = startTime > 0 ? (now - startTime) : 0;
      var totalSteps = (configManager.getConfig('steps') || []).length;
      var allIndexes = [];
      for (var i = 0; i < totalSteps; i++) {
        allIndexes.push(i);
      }
      var skipped = allIndexes.filter(function (idx) {
        return visitedIndexes.indexOf(idx) === -1;
      });

      var summary = {
        completed: completed,
        stepsVisited: visitedIndexes.slice(),
        stepsSkipped: skipped,
        totalDuration: totalDuration,
        exitStep: exitIndex,
        totalSteps: totalSteps,
      };

      var hook = configManager.getConfig('onTourComplete');
      if (hook) {
        try { hook(summary); }
        catch (e) { warn(ErrorCodes.HOOK_ERROR, 'onTourComplete error: ' + e.message); }
      }

      // Reset for potential reuse of the same guide instance.
      startTime = 0;
      stepEnteredAt = 0;
      visitedIndexes = [];
      lastIndex = -1;
    }

    return { begin: begin, trackStep: trackStep, finish: finish };
  }

    // =========================================================================
  // [NEW v1.5.0] MODULE: Auto-Refresh Manager
  // =========================================================================
  // Uses a MutationObserver to watch for DOM changes that might shift the
  // position of the highlighted element or popover. When changes are detected,
  // it triggers a debounced refresh to reposition overlay and popover.
  //
  // This is essential for userscripts running on SPAs (React, Vue, Angular)
  // where the host page re-renders parts of the DOM at any time.
  //
  // The observer watches document.body for:
  //   - childList changes (elements added/removed)
  //   - subtree changes (deep DOM mutations)
  //   - attribute changes on style and class (layout shifts)
  //
  // Debouncing prevents excessive repaints: mutations that happen within
  // the configured interval (default 300ms) are batched into a single refresh.
  //
  // The observer automatically disconnects when the tour is destroyed.
  // =========================================================================

    function createAutoRefreshManager(configManager, stateManager, refreshCallback) {
    var observer = null;
    var debounceTimer = null;

    /**
     * Starts observing the DOM for changes.
     * Does nothing if autoRefresh is false or the observer is already active.
     */
    function start() {
      if (!configManager.getConfig('autoRefresh')) return;
      if (observer) return; // Already observing
      var interval = configManager.getConfig('autoRefreshInterval') || 300;

      observer = new MutationObserver(function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
          if (stateManager.getState('isInitialized')) {
            try { refreshCallback(); }
            catch (e) {
              warn('AUTO_REFRESH', 'Refresh callback failed: ' + e.message);
            }
          }
        }, interval);
      });

      try {
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class'],
        });
      } catch (e) {
        warn('AUTO_REFRESH',
          'Failed to start MutationObserver: ' + e.message + '. ' +
          'Auto-refresh will not work. This can happen if document.body is not yet available.');
        observer = null;
      }
    }

    /**
     * Stops observing and cleans up timers.
     * Safe to call multiple times.
     */
    function stop() {
      if (observer) {
        try { observer.disconnect(); }
        catch (e) { /* Observer may already be disconnected */ }
        observer = null;
      }
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    return { start: start, stop: stop };
  }

    // =========================================================================
  // [NEW v1.5.0] MODULE: Accessibility Manager
  // =========================================================================
  // Enhances the tour experience for screen reader users and keyboard-only
  // navigation through two mechanisms:
  //
  // 1. Focus Trap: When a popover is visible, Tab/Shift+Tab cycling is
  //    constrained to the focusable elements inside the popover (buttons).
  //    This prevents the user from accidentally tabbing into the dimmed
  //    page content behind the overlay. The trap is removed when the
  //    popover is hidden or the tour is destroyed.
  //
  // 2. Live Region: An aria-live="polite" element is injected into the DOM.
  //    When a step changes, the region's text content is updated with the
  //    step title or ariaLabel, causing screen readers to announce the
  //    transition without interrupting the current reading flow.
  //
  // Both features are non-destructive: they add/remove DOM elements that
  // are visually hidden and do not interfere with the page layout.
  // =========================================================================

    function createAccessibilityManager() {
    var liveRegion = null;
    var trapCleanup = null;

    /**
     * Creates the aria-live region element if it does not already exist.
     * The region is visually hidden (1x1px, clipped) but accessible to
     * screen readers.
     */
    function createLiveRegion() {
      if (liveRegion && document.body.contains(liveRegion)) return;
      liveRegion = document.createElement('div');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.setAttribute('role', 'status');
      liveRegion.classList.add('tg-live-region');
      document.body.appendChild(liveRegion);
    }

    /**
     * Announces a message to screen readers by updating the live region.
     * The content is cleared first and re-set after a short delay to ensure
     * that screen readers detect the change even if the new text is
     * identical to the previous announcement (e.g. same step visited twice).
     *
     * @param {string} text - The text to announce
     */
    function announce(text) {
      createLiveRegion();
      if (!liveRegion) return;
      liveRegion.textContent = '';
      setTimeout(function () {
        if (liveRegion) liveRegion.textContent = text || '';
      }, 100);
    }

    /**
     * Sets up a focus trap inside the given popover element.
     * Finds all focusable children (buttons, links, inputs) and constrains
     * Tab/Shift+Tab navigation to cycle within them.
     *
     * If the popover has no focusable children, the trap is not activated
     * to avoid trapping the user with no way to navigate.
     *
     * Automatically focuses the first focusable element when the trap
     * is activated.
     *
     * @param {Element} popoverEl - The popover DOM element
     */
    function setupFocusTrap(popoverEl, targetEl) {
      // Remove any existing trap before setting up a new one.
      releaseFocusTrap();
      if (!popoverEl) return;

      var focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      var popoverFocusable = Array.prototype.slice.call(popoverEl.querySelectorAll(focusableSelector));

      var targetFocusable = [];
      if (targetEl && targetEl.nodeType === 1 && targetEl.id !== 'tg-dummy-element') {
        if (typeof targetEl.matches === 'function' && targetEl.matches(focusableSelector)) {
          targetFocusable.push(targetEl);
        }
        var innerFocusable = targetEl.querySelectorAll(focusableSelector);
        for (var f = 0; f < innerFocusable.length; f++) {
          if (targetFocusable.indexOf(innerFocusable[f]) === -1) {
            targetFocusable.push(innerFocusable[f]);
          }
        }
      }

      var focusable = popoverFocusable.concat(targetFocusable);
      if (!focusable.length) return;

      var firstFocusable = focusable[0];
      var lastFocusable = focusable[focusable.length - 1];

      function trapHandler(e) {
        if (e.key !== 'Tab') return;
        // If only one focusable element, just prevent Tab from leaving.
        if (focusable.length === 1) {
          e.preventDefault();
          return;
        }
        var active = document.activeElement;
        var activeIndex = focusable.indexOf(active);

        if (e.shiftKey) {
          // Shift+Tab: if on first element (or outside list), wrap to last
          if (active === firstFocusable || activeIndex <= 0) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          // Tab: if on last element, wrap to first
          if (active === lastFocusable || activeIndex === focusable.length - 1) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      }

      popoverEl.addEventListener('keydown', trapHandler);
      if (targetEl && targetEl.addEventListener && targetEl !== popoverEl) {
        targetEl.addEventListener('keydown', trapHandler);
      }

      // Focus the first button so the user can immediately interact.
      var initialFocus = (popoverFocusable.length > 0) ? popoverFocusable[0] : firstFocusable;
      try { initialFocus.focus(); }
      catch (e) { /* Element may not be focusable in some edge cases */ }

      // Store cleanup function so we can remove the trap later.
      trapCleanup = function () {
        popoverEl.removeEventListener('keydown', trapHandler);
        if (targetEl && targetEl.removeEventListener && targetEl !== popoverEl) {
          try { targetEl.removeEventListener('keydown', trapHandler); }
          catch (e) { /* Best effort cleanup */ }
        }
      };
    }

    /**
     * Removes the focus trap from the current popover.
     * Safe to call even if no trap is active.
     */
    function releaseFocusTrap() {
      if (trapCleanup) {
        trapCleanup();
        trapCleanup = null;
      }
    }

    /**
     * Removes all accessibility DOM elements and event listeners.
     */
    function destroy() {
      releaseFocusTrap();
      if (liveRegion && liveRegion.parentNode) {
        liveRegion.remove();
      }
      liveRegion = null;
    }

    return {
      announce: announce,
      setupFocusTrap: setupFocusTrap,
      releaseFocusTrap: releaseFocusTrap,
      destroy: destroy,
    };
  }

    // =========================================================================
  // [NEW v1.5.0] MODULE: Conditional Step Helpers
  // =========================================================================
  // These utility functions handle the "when" and "waitFor" step properties.
  //
  // "when" is a synchronous guard: a function that returns true/false.
  //   - When it returns false, the step is skipped and the tour advances
  //     to the next eligible step automatically.
  //   - This is evaluated lazily at the moment the step would be activated,
  //     NOT at configuration time. This makes it safe for dynamic conditions
  //     that depend on the current DOM state or user data.
  //
  // "waitFor" is an asynchronous polling mechanism: it repeatedly checks
  //   for the element to appear in the DOM before activating the step.
  //   - Uses setInterval with a configurable poll interval (default 200ms).
  //   - Times out after a configurable duration (default 5000ms).
  //   - On timeout, the step is skipped with a warning (not an error),
  //     so the tour continues gracefully.
  //   - The poll is automatically cleared if the tour is destroyed
  //     while waiting.
  //
  // Both helpers are designed to be called from within highlightStep()
  // and do not modify any global state themselves.
  // =========================================================================

  /**
   * Evaluates the "when" guard for a step.
   * Returns true if the step should be shown, false if it should be skipped.
   * If the "when" function throws, the error is caught, warned, and the
   * step is shown anyway (fail-open) to avoid silently breaking the tour.
   *
   * @param {object} step - The step configuration object
   * @param {number} index - The step index (for error messages)
   * @returns {boolean}
   */
  function evaluateStepCondition(step, index) {
    if (typeof step.when !== 'function') return true;
    try {
      var result = step.when();
      // Coerce to boolean explicitly. Only skip on strict false.
      return result !== false;
    } catch (e) {
      warn(ErrorCodes.HOOK_ERROR,
        '"when" function in step ' + index + ' threw an error: ' + e.message + '. ' +
        'The step will be shown anyway to avoid breaking the tour. ' +
        'Fix the "when" function to prevent this warning.');
      return true;
    }
  }

  /**
   * Polls for a step's element to appear in the DOM.
   * Calls the callback with the resolved element once found, or with null
   * if the timeout is reached.
   *
   * @param {object} step - The step configuration object
   * @param {number} index - The step index (for error messages)
   * @param {function} callback - Called with (element|null) when done
   * @returns {function} cleanup - Call to abort the polling early
   */
  function waitForElement(step, index, callback) {
    if (!step.waitFor) {
      callback(resolveElement(step.element));
      return function () {};
    }

    var timeout = (typeof step.waitFor.timeout === 'number') ? step.waitFor.timeout : 5000;
    var interval = (typeof step.waitFor.pollInterval === 'number') ? step.waitFor.pollInterval : 200;
    var elapsed = 0;
    var resolved = false;

    var timer = setInterval(function () {
      if (resolved) return;
      var el = resolveElement(step.element);
      if (el) {
        resolved = true;
        clearInterval(timer);
        callback(el);
        return;
      }
      elapsed += interval;
      if (elapsed >= timeout) {
        resolved = true;
        clearInterval(timer);
        warn(ErrorCodes.WAIT_TIMEOUT,
          'waitFor timed out after ' + timeout + 'ms for step ' + index +
          ' (element: "' + (typeof step.element === 'string' ? step.element : '[function/Element]') + '"). ' +
          'The element did not appear in the DOM within the timeout period. ' +
          'The step will be skipped. Consider increasing waitFor.timeout or ' +
          'checking that the element selector is correct.');
        callback(null);
      }
    }, interval);

    // Return a cleanup function that aborts the polling.
    // This is called if the tour is destroyed while we are still waiting.
    return function () {
      if (!resolved) {
        resolved = true;
        clearInterval(timer);
      }
    };
  }

  // =========================================================================
  // [NEW v1.5.0] MODULE: AdvanceOn Manager
  // =========================================================================
  // Handles the "advanceOn" step property which allows a step to wait for
  // a specific user interaction (click, input, change, etc.) before
  // advancing to the next step.
  //
  // When advanceOn is configured on a step:
  //   1. An event listener is attached to the target element (or document
  //      if no selector is provided).
  //   2. When the event fires, the listener is removed and the tour
  //      advances to the next step automatically.
  //   3. If the target element cannot be found, a warning is logged and
  //      the step behaves normally (user can still click Next).
  //
  // The listener is always removed when:
  //   - The event fires (normal advancement)
  //   - The user navigates away from the step manually (Next/Prev/Close)
  //   - The tour is destroyed
  //
  // This prevents memory leaks and ensures no orphaned listeners remain
  // on the host page after the tour ends.
  // =========================================================================

  function createAdvanceOnManager() {
    var currentCleanup = null;

    /**
     * Attaches an advanceOn listener for the given step.
     * When the configured event fires on the target element, the provided
     * advanceCallback is called to move to the next step.
     *
     * @param {object} step - The step configuration object
     * @param {Element|null} stepElement - The resolved DOM element for the step
     * @param {function} advanceCallback - Called when the event fires
     */
    function attach(step, stepElement, advanceCallback) {
      // Always clean up any previous listener first.
      detach();
      if (!step.advanceOn) return;

      var eventName = step.advanceOn.event;
      var selector = step.advanceOn.selector;
      var target = null;

      if (selector) {
        try {
          target = querySelectorDeep(selector);
        } catch (e) {
          warn(ErrorCodes.ADVANCE_ON_ERROR,
            'advanceOn.selector "' + selector + '" caused an error: ' + e.message + '. ' +
            'Make sure the selector is valid CSS. The step will work normally without advanceOn.');
          return;
        }
        if (!target) {
          warn(ErrorCodes.ADVANCE_ON_ERROR,
            'advanceOn.selector "' + selector + '" did not match any element in the DOM. ' +
            'The step will work normally (user can click Next to advance). ' +
            'Check that the selector targets an element that exists when this step is active.');
          return;
        }
      } else {
        // No selector provided: listen on the step's highlighted element,
        // or fall back to document if there is no element.
        target = stepElement || document;
      }

      var fired = false;
      function handler(e) {
        if (fired) return;
        fired = true;
        // Remove listener immediately to prevent double-firing.
        target.removeEventListener(eventName, handler, true);
        currentCleanup = null;
        // Use setTimeout to avoid interfering with the event's propagation
        // on the host page. The tour advancement happens after the event
        // has finished bubbling.
        setTimeout(function () {
          advanceCallback();
        }, 0);
      }

      try {
        target.addEventListener(eventName, handler, true);
      } catch (e) {
        warn(ErrorCodes.ADVANCE_ON_ERROR,
          'Failed to attach advanceOn listener for event "' + eventName + '": ' + e.message + '. ' +
          'The step will work normally without advanceOn.');
        return;
      }

      // Store cleanup so we can remove the listener if the step changes
      // before the event fires.
      currentCleanup = function () {
        if (!fired) {
          fired = true;
          try { target.removeEventListener(eventName, handler, true); }
          catch (e) { /* Best effort cleanup */ }
        }
      };
    }

    /**
     * Removes the current advanceOn listener if one is active.
     * Safe to call multiple times.
     */
    function detach() {
      if (currentCleanup) {
        currentCleanup();
        currentCleanup = null;
      }
    }

    return { attach: attach, detach: detach };
  }

  // =========================================================================
  // [NEW v1.6.0] MODULE: Strict Interaction Manager
  // =========================================================================
  // Locks down user interactions exclusively to the highlighted target element.
  // When a step has strict: true (or advanceOn: { event: 'click', strict: true },
  // or beacon: { strict: true }):
  //   1. All clicks outside the target element and popover close/prev buttons
  //      are intercepted in the capture phase, preventing unintended page actions.
  //   2. Clicks outside trigger a visual shake feedback animation (tg-shake)
  //      on the beacon and target element to cue the user.
  //   3. Clicking the target element allows the event through to the host page
  //      (so tabs or menus open normally) and advances the tour.
  // =========================================================================

  function createStrictInteractionManager(deps) {
    var stateManager = deps.stateManager;
    var popoverManager = deps.popoverManager;
    var beaconManager = deps.beaconManager;
    var configManager = deps.configManager;
    var activeTarget = null;
    var activeStep = null;
    var advanceCallback = null;
    var captureHandler = null;
    var shakeTimeout = null;

    function triggerShake(element) {
      if (beaconManager && typeof beaconManager.getElement === 'function') {
        var beaconEl = beaconManager.getElement();
        if (beaconEl) {
          beaconEl.classList.remove('tg-shake');
          void beaconEl.offsetWidth;
          beaconEl.classList.add('tg-shake');
        }
      }
      if (element && element.classList) {
        element.classList.remove('tg-shake');
        void element.offsetWidth;
        element.classList.add('tg-shake');
      }

      if (shakeTimeout) clearTimeout(shakeTimeout);
      shakeTimeout = setTimeout(function () {
        if (element && element.classList) element.classList.remove('tg-shake');
        if (beaconManager && typeof beaconManager.getElement === 'function') {
          var bel = beaconManager.getElement();
          if (bel) bel.classList.remove('tg-shake');
        }
      }, 400);
    }

    function detach() {
      if (captureHandler) {
        document.removeEventListener('click', captureHandler, true);
        captureHandler = null;
      }
      if (activeTarget && activeTarget.classList) {
        activeTarget.classList.remove('tg-shake');
      }
      if (beaconManager && typeof beaconManager.getElement === 'function') {
        var bel = beaconManager.getElement();
        if (bel) bel.classList.remove('tg-shake');
      }
      if (shakeTimeout) {
        clearTimeout(shakeTimeout);
        shakeTimeout = null;
      }
      activeTarget = null;
      activeStep = null;
      advanceCallback = null;
    }

    function attach(step, targetElement, onAdvance) {
      detach();
      if (!step) return;

      var isStrict = !!(step.strict || configManager.getConfig('strict') ||
        (step.advanceOn && step.advanceOn.strict) ||
        (step.beacon && step.beacon.strict));

      if (!isStrict) return;

      activeTarget = targetElement;
      activeStep = step;
      advanceCallback = onAdvance;

      captureHandler = function (e) {
        if (!stateManager.getState('isInitialized')) return;

        // 1. Click is inside the target element -> ALLOW and ADVANCE
        if (activeTarget && (activeTarget === e.target || activeTarget.contains(e.target))) {
          detach();
          setTimeout(function () {
            if (advanceCallback) advanceCallback();
          }, 0);
          return;
        }

        // 2. Allow clicks on popover Close or Prev buttons
        var popoverEl = popoverManager ? popoverManager.getElement() : null;
        if (popoverEl && popoverEl.contains(e.target)) {
          if (e.target.classList.contains('tg-popover-btn-close') ||
              e.target.closest('.tg-popover-btn-close') ||
              e.target.classList.contains('tg-popover-btn-prev') ||
              e.target.closest('.tg-popover-btn-prev')) {
            return;
          }
        }

        // 3. Click is on the beacon element (waves or label) -> treat as clicking target
        if (beaconManager && typeof beaconManager.getElement === 'function') {
          var bEl = beaconManager.getElement();
          if (bEl && (bEl === e.target || bEl.contains(e.target))) {
            if (activeTarget && typeof activeTarget.click === 'function') {
              detach();
              activeTarget.click();
              setTimeout(function () {
                if (advanceCallback) advanceCallback();
              }, 0);
              return;
            }
          }
        }

        // 4. Click is OUTSIDE -> PREVENT and SHAKE
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        triggerShake(activeTarget);
      };

      document.addEventListener('click', captureHandler, true);
    }

    return { attach: attach, detach: detach, triggerShake: triggerShake };
  }

  // =========================================================================
  // [NEW v1.5.0] MODULE: Hotspot Manager
  // =========================================================================
  // Manages persistent, non-blocking visual hints ("hotspots") that can be
  // shown on the page without starting a full tour. Each hotspot consists of:
  //   - A pulsing dot positioned on the target element
  //   - A tooltip that appears on hover
  //
  // Hotspots are independent of the tour system. They can be added and
  // removed at any time, and they persist until explicitly removed or
  // the guide instance is destroyed.
  //
  // Each hotspot is identified by its element selector string, which also
  // serves as the key for removal. This prevents duplicate hotspots on
  // the same element.
  //
  // Hotspots automatically reposition themselves on window resize.
  // If the target element is removed from the DOM, the hotspot is hidden
  // but not destroyed, so it reappears if the element comes back
  // (common in SPAs).
  // =========================================================================

  function createHotspotManager(zPopover) {
    var hotspots = {};       // key: selector string, value: hotspot state object
    var resizeHandler = null;

    /**
     * Positions a hotspot's DOM elements relative to its target element.
     * The dot is placed at the top-right corner of the element by default.
     *
     * @param {object} hs - The hotspot state object
     */
    function positionHotspot(hs) {
      if (!hs.container || !hs.targetElement) return;
      var el = hs.targetElement;
      // Re-check that the element is still in the DOM.
      if (!document.body.contains(el)) {
        hs.container.style.display = 'none';
        return;
      }
      hs.container.style.display = '';
      var rect = el.getBoundingClientRect();
      var scrollX = window.pageXOffset || document.documentElement.scrollLeft;
      var scrollY = window.pageYOffset || document.documentElement.scrollTop;
      // Position at top-right corner of the element.
      hs.container.style.top = (rect.top + scrollY - 6) + 'px';
      hs.container.style.left = (rect.right + scrollX - 6) + 'px';

      // Position tooltip below the dot.
      if (hs.tooltipEl) {
        var side = hs.side || 'bottom';
        hs.tooltipEl.style.top = '';
        hs.tooltipEl.style.bottom = '';
        hs.tooltipEl.style.left = '';
        hs.tooltipEl.style.right = '';
        switch (side) {
          case 'bottom':
            hs.tooltipEl.style.top = '18px';
            hs.tooltipEl.style.left = '50%';
            hs.tooltipEl.style.transform = 'translateX(-50%)';
            break;
          case 'top':
            hs.tooltipEl.style.bottom = '18px';
            hs.tooltipEl.style.left = '50%';
            hs.tooltipEl.style.transform = 'translateX(-50%)';
            break;
          case 'left':
            hs.tooltipEl.style.right = '18px';
            hs.tooltipEl.style.top = '50%';
            hs.tooltipEl.style.transform = 'translateY(-50%)';
            break;
          case 'right':
            hs.tooltipEl.style.left = '18px';
            hs.tooltipEl.style.top = '50%';
            hs.tooltipEl.style.transform = 'translateY(-50%)';
            break;
          default:
            hs.tooltipEl.style.top = '18px';
            hs.tooltipEl.style.left = '50%';
            hs.tooltipEl.style.transform = 'translateX(-50%)';
        }
      }
    }

    /**
     * Repositions all active hotspots. Called on window resize.
     */
    function repositionAll() {
      var keys = Object.keys(hotspots);
      for (var i = 0; i < keys.length; i++) {
        var hs = hotspots[keys[i]];
        // Try to re-resolve the element in case it was re-rendered.
        if (hs.selector) {
          var el = querySelectorDeep(hs.selector);
          if (el) hs.targetElement = el;
        }
        positionHotspot(hs);
      }
    }

    /**
     * Ensures the window resize listener is attached.
     */
    function ensureResizeListener() {
      if (resizeHandler) return;
      resizeHandler = function () { repositionAll(); };
      window.addEventListener('resize', resizeHandler);
    }

    /**
     * Adds a hotspot to the page.
     *
     * @param {object} options - Hotspot configuration
     * @param {string} options.element - CSS selector for the target element
     * @param {string} options.tooltip - Tooltip text to show on hover
     * @param {string} [options.side='bottom'] - Tooltip placement
     * @param {boolean} [options.pulse=true] - Whether to show pulse animation
     * @param {string} [options.pulseColor='#ef4444'] - Color of the dot and pulse
     * @param {boolean} [options.dismissOnClick=false] - Remove on element click
     * @param {number} [options.autoDismiss=0] - Auto-remove after ms (0=never)
     */
    function add(options) {
      if (!options || typeof options !== 'object') {
        warn(ErrorCodes.HOTSPOT_ERROR,
          'addHotspot() requires an options object. ' +
          'Example: guide.addHotspot({ element: "#btn", tooltip: "Click here" })');
        return;
      }
      if (!options.element || typeof options.element !== 'string') {
        warn(ErrorCodes.HOTSPOT_ERROR,
          'addHotspot() requires an "element" property with a CSS selector string. ' +
          'Example: guide.addHotspot({ element: "#my-button", tooltip: "New feature!" })');
        return;
      }

      var selector = options.element;
      // Remove existing hotspot on same element to prevent duplicates.
      if (hotspots[selector]) {
        remove(selector);
      }

      var targetElement = querySelectorDeep(selector);
      if (!targetElement) {
        warn(ErrorCodes.HOTSPOT_ERROR,
          'addHotspot() could not find element "' + selector + '" in the DOM. ' +
          'The hotspot will not be shown. Make sure the element exists before calling addHotspot().');
        return;
      }

      var pulseColor = options.pulseColor || '#ef4444';
      var showPulse = options.pulse !== false;
      var side = options.side || 'bottom';

      // Build the hotspot DOM structure.
      var container = document.createElement('div');
      container.classList.add('tg-hotspot');
      container.setAttribute('data-tg-hotspot', selector);
      container.setAttribute('role', 'note');
      container.setAttribute('aria-label', options.tooltip || 'Hint');

      var dot = document.createElement('div');
      dot.classList.add('tg-hotspot-dot');
      dot.style.backgroundColor = pulseColor;
      container.appendChild(dot);

      if (showPulse) {
        var pulse = document.createElement('div');
        pulse.classList.add('tg-hotspot-pulse');
        pulse.style.backgroundColor = pulseColor;
        dot.appendChild(pulse);
      }

      var tooltipEl = null;
      if (options.tooltip) {
        tooltipEl = document.createElement('div');
        tooltipEl.classList.add('tg-hotspot-tooltip');
        tooltipEl.textContent = options.tooltip;
        container.appendChild(tooltipEl);
      }

      document.body.appendChild(container);

      var hs = {
        selector: selector,
        targetElement: targetElement,
        container: container,
        tooltipEl: tooltipEl,
        side: side,
        dismissTimer: null,
        clickHandler: null,
      };

      hotspots[selector] = hs;
      positionHotspot(hs);
      ensureResizeListener();

      // Set up dismissOnClick: remove the hotspot when the target is clicked.
      if (options.dismissOnClick) {
        hs.clickHandler = function () { remove(selector); };
        targetElement.addEventListener('click', hs.clickHandler);
      }

      // Set up autoDismiss: remove after a delay.
      if (options.autoDismiss && typeof options.autoDismiss === 'number' && options.autoDismiss > 0) {
        hs.dismissTimer = setTimeout(function () {
          remove(selector);
        }, options.autoDismiss);
      }
    }

    /**
     * Removes a specific hotspot by its element selector.
     *
     * @param {string} selector - The CSS selector used when the hotspot was added
     */
    function remove(selector) {
      var hs = hotspots[selector];
      if (!hs) return;
      if (hs.dismissTimer) clearTimeout(hs.dismissTimer);
      if (hs.clickHandler && hs.targetElement) {
        try { hs.targetElement.removeEventListener('click', hs.clickHandler); }
        catch (e) { /* Best effort */ }
      }
      if (hs.container && hs.container.parentNode) {
        hs.container.remove();
      }
      delete hotspots[selector];
    }

    /**
     * Removes all active hotspots and cleans up the resize listener.
     */
    function removeAll() {
      var keys = Object.keys(hotspots);
      for (var i = 0; i < keys.length; i++) {
        remove(keys[i]);
      }
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
        resizeHandler = null;
      }
    }

    return { add: add, remove: remove, removeAll: removeAll, repositionAll: repositionAll };
  }

  // =========================================================================
  // MODULE: Beacon Manager (Click Indicator)
  // =========================================================================
  // Manages interactive visual beacons (ripples/halos) that highlight elements
  // prompting the user to click them. Supports an adaptive shape matching the
  // target's border-radius and bounding box, or a circular radar pulse.
  // =========================================================================

  function createBeaconManager(zPopover) {
    var beaconEl = null;
    var labelEl = null;
    var currentTarget = null;
    var currentOptions = null;
    var textConfig = null;
    var clickHandler = null;
    var resizeHandler = null;
    var strictHandler = null;

    var COLOR_PRESETS = {
      yellow: '#f59e0b',
      amber: '#f59e0b',
      blue: '#3b82f6',
      green: '#10b981',
      red: '#ef4444',
      purple: '#a855f7',
      cyan: '#06b6d4',
      pink: '#ec4899',
    };

    function resolveColor(c) {
      if (!c || typeof c !== 'string') return '#f59e0b';
      var lower = c.toLowerCase();
      if (COLOR_PRESETS[lower]) return COLOR_PRESETS[lower];
      return c;
    }

    function hide() {
      if (clickHandler && currentTarget) {
        try { currentTarget.removeEventListener('click', clickHandler, true); }
        catch (e) { /* Best effort */ }
        clickHandler = null;
      }
      if (strictHandler) {
        try { document.removeEventListener('click', strictHandler, true); }
        catch (e) { /* Best effort */ }
        strictHandler = null;
      }
      if (beaconEl && beaconEl.parentNode) {
        beaconEl.remove();
      }
      beaconEl = null;
      labelEl = null;
      currentTarget = null;
      currentOptions = null;
      textConfig = null;
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
        window.removeEventListener('scroll', resizeHandler);
        document.removeEventListener('scroll', resizeHandler, true);
        resizeHandler = null;
      }
    }

    function position() {
      if (!beaconEl || !currentTarget) return;
      if (!document.body.contains(currentTarget) && !currentTarget.isConnected) {
        beaconEl.style.display = 'none';
        return;
      }
      beaconEl.style.display = '';

      var rect = currentTarget.getBoundingClientRect();
      var isFixed = isInsideFixedContainer(currentTarget) || (window.getComputedStyle(currentTarget).position === 'fixed');
      beaconEl.style.position = isFixed ? 'fixed' : 'absolute';
      var scrollX = isFixed ? 0 : (window.pageXOffset || document.documentElement.scrollLeft || 0);
      var scrollY = isFixed ? 0 : (window.pageYOffset || document.documentElement.scrollTop || 0);

      var shape = (currentOptions && currentOptions.shape) || 'adaptive';
      if (shape === 'circle' || shape === 'radar') {
        var cx = rect.left + scrollX + rect.width / 2;
        var cy = rect.top + scrollY + rect.height / 2;
        var sz = Math.max(36, Math.min(rect.width, rect.height));
        beaconEl.style.left = (cx - sz / 2) + 'px';
        beaconEl.style.top = (cy - sz / 2) + 'px';
        beaconEl.style.width = sz + 'px';
        beaconEl.style.height = sz + 'px';
        beaconEl.style.borderRadius = '50%';
      } else {
        // Adaptive mode: matches bounding box and border radius
        beaconEl.style.left = (rect.left + scrollX) + 'px';
        beaconEl.style.top = (rect.top + scrollY) + 'px';
        beaconEl.style.width = rect.width + 'px';
        beaconEl.style.height = rect.height + 'px';

        try {
          var comp = window.getComputedStyle(currentTarget);
          beaconEl.style.borderRadius = comp.borderRadius || '4px';
        } catch (e) {
          beaconEl.style.borderRadius = '4px';
        }
      }

      // Dynamic viewport collision and position update for label
      if (labelEl && textConfig) {
        var prefPos = textConfig.position || 'top';
        var actualPos = prefPos;
        if (prefPos === 'top' || prefPos === 'auto') {
          // If close to top of viewport, flip to bottom
          if (rect.top < 55) {
            actualPos = 'bottom';
          } else {
            actualPos = 'top';
          }
        } else if (prefPos === 'bottom') {
          var vh = window.innerHeight || document.documentElement.clientHeight || 800;
          if (rect.bottom + 55 > vh && rect.top > 55) {
            actualPos = 'top';
          }
        }
        var posClasses = ['tg-beacon-label-top', 'tg-beacon-label-bottom', 'tg-beacon-label-left', 'tg-beacon-label-right', 'tg-beacon-label-auto'];
        for (var pi = 0; pi < posClasses.length; pi++) {
          labelEl.classList.remove(posClasses[pi]);
        }
        labelEl.classList.add('tg-beacon-label-' + actualPos);
      }
    }

    function show(target, options) {
      hide();
      var el = (typeof target === 'string') ? querySelectorDeep(target) : target;
      if (!el || !(el instanceof Element)) {
        if (typeof target === 'string') {
          warn(ErrorCodes.ELEMENT_NOT_FOUND, 'showBeacon() could not find element "' + target + '".');
        }
        return;
      }

      if (typeof options === 'string') {
        options = { text: options };
      }
      var opts = (typeof options === 'object' && options !== null) ? options : {};
      currentTarget = el;
      currentOptions = opts;

      // Normalize text configuration
      textConfig = null;
      if (typeof opts.text === 'string' && opts.text.trim()) {
        textConfig = { content: opts.text.trim() };
      } else if (typeof opts.text === 'object' && opts.text !== null && typeof opts.text.content === 'string' && opts.text.content.trim()) {
        textConfig = opts.text;
      }

      var shape = (opts.shape === 'circle' || opts.shape === 'radar') ? 'circle' : 'adaptive';
      var color = resolveColor(opts.color);
      var speed = (typeof opts.speed === 'number' && opts.speed > 0) ? opts.speed + 's' : '2s';
      var borderWidth = (typeof opts.borderWidth === 'number' && opts.borderWidth > 0) ? opts.borderWidth + 'px' : '3px';

      beaconEl = document.createElement('div');
      beaconEl.className = 'tg-beacon tg-beacon-' + shape;
      beaconEl.style.setProperty('--tg-beacon-color', color);
      beaconEl.style.setProperty('--tg-beacon-speed', speed);
      beaconEl.style.setProperty('--tg-beacon-border-width', borderWidth);

      var wave1 = document.createElement('div');
      wave1.className = 'tg-beacon-wave tg-beacon-wave-1';
      var wave2 = document.createElement('div');
      wave2.className = 'tg-beacon-wave tg-beacon-wave-2';

      beaconEl.appendChild(wave1);
      beaconEl.appendChild(wave2);

      // Create optional label if text is configured
      if (textConfig) {
        labelEl = document.createElement('div');
        var theme = textConfig.theme || 'dark';
        var pos = textConfig.position || 'top';
        labelEl.className = 'tg-beacon-label tg-beacon-label-' + pos + ' tg-beacon-label-theme-' + theme;

        if (textConfig.className) {
          var customClasses = textConfig.className.split(/\s+/).filter(Boolean);
          for (var ci = 0; ci < customClasses.length; ci++) {
            labelEl.classList.add(customClasses[ci]);
          }
        }
        if (textConfig.background) {
          labelEl.style.backgroundColor = textConfig.background;
          labelEl.style.borderColor = textConfig.background;
        }
        if (textConfig.color) {
          labelEl.style.color = textConfig.color;
        }

        if (textConfig.icon) {
          var iconSpan = document.createElement('span');
          iconSpan.className = 'tg-beacon-label-icon';
          iconSpan.textContent = textConfig.icon;
          labelEl.appendChild(iconSpan);
        }

        var textSpan = document.createElement('span');
        textSpan.className = 'tg-beacon-label-text';
        textSpan.textContent = textConfig.content;
        labelEl.appendChild(textSpan);

        var arrowSpan = document.createElement('span');
        arrowSpan.className = 'tg-beacon-label-arrow';
        labelEl.appendChild(arrowSpan);

        beaconEl.appendChild(labelEl);
      }

      document.body.appendChild(beaconEl);

      position();

      if (!resizeHandler) {
        resizeHandler = function () { position(); };
        window.addEventListener('resize', resizeHandler);
        window.addEventListener('scroll', resizeHandler, { passive: true });
        document.addEventListener('scroll', resizeHandler, { capture: true, passive: true });
      }

      // Dismiss on click (default true)
      if (opts.dismissOnClick !== false) {
        clickHandler = function () {
          hide();
        };
        try { currentTarget.addEventListener('click', clickHandler, true); }
        catch (e) { /* Best effort */ }
      }

      // Strict mode: lock down clicks outside the target element
      if (opts.strict === true) {
        strictHandler = function (e) {
          if (!currentTarget) return;
          if (currentTarget === e.target || currentTarget.contains(e.target)) {
            hide();
            return;
          }
          if (beaconEl && (beaconEl === e.target || beaconEl.contains(e.target))) {
            if (currentTarget && typeof currentTarget.click === 'function') {
              hide();
              currentTarget.click();
              return;
            }
          }
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          if (beaconEl) {
            beaconEl.classList.remove('tg-shake');
            void beaconEl.offsetWidth;
            beaconEl.classList.add('tg-shake');
          }
          if (currentTarget && currentTarget.classList) {
            currentTarget.classList.remove('tg-shake');
            void currentTarget.offsetWidth;
            currentTarget.classList.add('tg-shake');
          }
        };
        document.addEventListener('click', strictHandler, true);
      }
    }

    function reposition() {
      position();
    }

    function destroy() {
      hide();
    }

    function getElement() {
      return beaconEl;
    }

    function getLabelElement() {
      return labelEl;
    }

    return {
      show: show,
      hide: hide,
      reposition: reposition,
      destroy: destroy,
      getElement: getElement,
      getLabelElement: getLabelElement,
    };
  }

  // =========================================================================
  // [NEW v1.5.0] MODULE: Theme Applicator
  // =========================================================================
  // Applies CSS custom properties from the selected theme to the popover
  // element. This is called each time the popover is created or the theme
  // changes.
  //
  // The approach uses inline CSS custom properties on the popover root
  // element. This works because CSS var() in the stylesheet will resolve
  // to the inline property values when present, and fall back to the
  // hardcoded defaults when no theme is set (theme: "default").
  //
  // This is intentionally separate from the Popover Manager to avoid
  // modifying its internal rendering logic.
  // =========================================================================

  /**
   * Applies the given theme's CSS custom properties to a DOM element.
   * Removes any previously applied theme properties first.
   *
   * @param {Element} element - The element to style (usually the popover)
   * @param {string} themeName - One of the keys in THEMES
   */
  function applyTheme(element, themeName) {
    if (!element) return;
    // First, remove all known theme custom properties to ensure clean state.
    var allProps = [
      '--tg-bg', '--tg-color', '--tg-title-color', '--tg-desc-color',
      '--tg-btn-primary-bg', '--tg-btn-primary-color',
      '--tg-btn-secondary-bg', '--tg-btn-secondary-color',
      '--tg-shadow', '--tg-arrow-bg', '--tg-progress-color',
      '--tg-close-color', '--tg-close-hover-color', '--tg-close-hover-bg',
      '--tg-border-radius', '--tg-btn-radius',
    ];
    for (var r = 0; r < allProps.length; r++) {
      element.style.removeProperty(allProps[r]);
    }
    // Apply the new theme's properties.
    var theme = THEMES[themeName || 'default'];
    if (!theme) return;
    var keys = Object.keys(theme);
    for (var i = 0; i < keys.length; i++) {
      element.style.setProperty(keys[i], theme[keys[i]]);
    }
  }

  // =========================================================================
  // [NEW v1.5.0] MODULE: Step ID Resolver
  // =========================================================================
  // Provides a utility to find a step's numeric index by its string ID.
  // This enables the moveToStep(id) API method.
  //
  // The resolver performs a linear scan of the steps array. This is
  // acceptable because:
  //   - Tours typically have fewer than 50 steps
  //   - The function is called on-demand (user action), not in a hot loop
  //   - Building a lookup map would require invalidation on setSteps()
  //
  // If duplicate IDs exist, the first match wins and a warning is logged
  // to help the developer fix their configuration.
  // =========================================================================

  /**
   * Finds the index of a step by its ID property.
   * Throws a TamperGuideError if no step with the given ID exists.
   *
   * @param {Array} steps - The steps array from configuration
   * @param {string} id - The step ID to search for
   * @returns {number} The zero-based index of the matching step
   */
  function resolveStepId(steps, id) {
    if (!id || typeof id !== 'string') {
      throw new TamperGuideError(ErrorCodes.INVALID_STEP_INDEX,
        'moveToStep() requires a non-empty string ID. Received: ' + typeof id + '. ' +
        'Pass the "id" value you defined on the step object. ' +
        'Example: guide.moveToStep("intro")');
    }
    var foundIndex = -1;
    var duplicateCount = 0;
    for (var i = 0; i < steps.length; i++) {
      if (steps[i].id === id) {
        if (foundIndex === -1) {
          foundIndex = i;
        } else {
          duplicateCount++;
        }
      }
    }
    if (foundIndex === -1) {
      // Build a helpful list of available IDs for the error message.
      var availableIds = [];
      for (var j = 0; j < steps.length; j++) {
        if (steps[j].id) availableIds.push('"' + steps[j].id + '"');
      }
      throw new TamperGuideError(ErrorCodes.INVALID_STEP_INDEX,
        'No step found with id "' + id + '". ' +
        (availableIds.length > 0
          ? 'Available step IDs: ' + availableIds.join(', ') + '.'
          : 'No steps have an "id" property defined. Add id:"myId" to your step objects.'));
    }
    if (duplicateCount > 0) {
      warn(ErrorCodes.INVALID_STEP,
        'Found ' + (duplicateCount + 1) + ' steps with id "' + id + '". ' +
        'Using the first match at index ' + foundIndex + '. ' +
        'Step IDs should be unique to avoid unexpected navigation behavior.');
    }
    return foundIndex;
  }
  // =========================================================================
  // MODULE: Overlay Manager (SVG cutout)  [UNCHANGED]
  // =========================================================================

  function createOverlayManager(configManager, zOverlay) {
    var overlayEl = null;
    var svgEl = null;
    var currentRect = null;
    var clickHandler = null;

    function create() {
      if (overlayEl) return;
      overlayEl = document.createElement('div');
      overlayEl.classList.add('tg-overlay');
      overlayEl.style.zIndex = String(zOverlay);
      svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgEl.setAttribute('preserveAspectRatio', 'none');
      overlayEl.appendChild(svgEl);
      document.body.appendChild(overlayEl);
      overlayEl.addEventListener('click', function (e) {
        if (e.target.classList.contains('tg-overlay-clickable') || e.target.closest('.tg-overlay-clickable')) {
          if (clickHandler) clickHandler(e);
        }
      });
      refreshSVG(null);
    }

    /**
     * Redraws the SVG overlay with an optional cutout rectangle.
     *
     * Uses getViewportSize() (documentElement.clientWidth/clientHeight)
     * instead of window.innerWidth/innerHeight. This is critical because:
     *
     * - getBoundingClientRect() returns coordinates relative to the
     *   CSS viewport, which EXCLUDES scrollbars.
     * - window.innerWidth INCLUDES the scrollbar width.
     * - If we use innerWidth for the SVG but getBoundingClientRect
     *   for the cutout, there is a mismatch equal to the scrollbar
     *   width (typically 15-17px), causing the cutout to shift left.
     *
     * By using clientWidth/clientHeight for both the SVG dimensions
     * and the cutout coordinates, the alignment is exact.
     *
     * @param {Object|null} rect - Cutout rect or null for full overlay
     */
    function refreshSVG(rect) {
      if (!svgEl) return;

      var vp = getViewportSize();
      var w = vp.width;
      var h = vp.height;
      var color = configManager.getConfig('overlayColor');
      var opacity = configManager.getConfig('overlayOpacity');

      svgEl.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      svgEl.setAttribute('width', String(w));
      svgEl.setAttribute('height', String(h));

      if (!rect) {
        svgEl.innerHTML = '<rect x="0" y="0" width="' + w + '" height="' + h +
          '" fill="' + color + '" fill-opacity="' + opacity + '" class="tg-overlay-clickable" />';
        return;
      }

      currentRect = rect;
      var cx = Math.max(0, rect.x), cy = Math.max(0, rect.y);
      var cw = Math.min(rect.width, w - cx), ch = Math.min(rect.height, h - cy);
      var cr = Math.min(rect.radius || 0, cw / 2, ch / 2);
      var outer = 'M 0 0 H ' + w + ' V ' + h + ' H 0 Z';
      var inner;
      if (cr > 0) {
        inner =
          'M ' + (cx + cr) + ' ' + cy +
          ' H ' + (cx + cw - cr) +
          ' Q ' + (cx + cw) + ' ' + cy + ' ' + (cx + cw) + ' ' + (cy + cr) +
          ' V ' + (cy + ch - cr) +
          ' Q ' + (cx + cw) + ' ' + (cy + ch) + ' ' + (cx + cw - cr) + ' ' + (cy + ch) +
          ' H ' + (cx + cr) +
          ' Q ' + cx + ' ' + (cy + ch) + ' ' + cx + ' ' + (cy + ch - cr) +
          ' V ' + (cy + cr) +
          ' Q ' + cx + ' ' + cy + ' ' + (cx + cr) + ' ' + cy + ' Z';
      } else {
        inner = 'M ' + cx + ' ' + cy + ' H ' + (cx + cw) + ' V ' + (cy + ch) + ' H ' + cx + ' Z';
      }
      svgEl.innerHTML = '<path d="' + outer + ' ' + inner +
        '" fill-rule="evenodd" fill="' + color + '" fill-opacity="' + opacity +
        '" class="tg-overlay-clickable" />';
    }

    function show() { create(); if (overlayEl) overlayEl.style.opacity = '1'; }
    function updateHighlight(rect) { if (!overlayEl) create(); refreshSVG(rect); }
    function handleResize() { refreshSVG(currentRect); }
    function hide() { if (overlayEl) overlayEl.style.opacity = '0'; }
    function destroy() { if (overlayEl) { overlayEl.remove(); overlayEl = null; svgEl = null; currentRect = null; } }
    function getElement() { return overlayEl; }
    function setClickHandler(h) { clickHandler = h; }

    return {
      show: show, updateHighlight: updateHighlight, handleResize: handleResize,
      hide: hide, destroy: destroy, getElement: getElement, setClickHandler: setClickHandler,
    };
  }

  // =========================================================================
  // MODULE: Popover Manager  [MODIFIED v1.5.0 - theme application added]
  // =========================================================================

  function createPopoverManager(configManager, zPopover) {
    var popoverEl = null;
    var arrowEl = null;
    var currentStep = null;

    // [MODIFIED v1.5.0] create() - added applyTheme() call after element creation.
    // This applies CSS custom properties from the selected theme to the popover.
    // Original behavior is preserved because the "default" theme is empty.
    function create() {
      if (popoverEl) return;
      popoverEl = document.createElement('div');
      popoverEl.classList.add('tg-popover');
      popoverEl.style.zIndex = String(zPopover);
      popoverEl.setAttribute('role', 'dialog');
      popoverEl.setAttribute('aria-modal', 'false');
      if (configManager.getConfig('animate')) popoverEl.classList.add('tg-popover-animated');
      var cc = configManager.getConfig('popoverClass');
      if (cc) {
        var cls = cc.split(' ').filter(Boolean);
        for (var i = 0; i < cls.length; i++) popoverEl.classList.add(cls[i]);
      }
      // [NEW v1.5.0] Apply the configured theme to the popover element.
      applyTheme(popoverEl, configManager.getConfig('theme'));
      arrowEl = document.createElement('div');
      arrowEl.classList.add('tg-popover-arrow');
      popoverEl.appendChild(arrowEl);
      document.body.appendChild(popoverEl);
    }

    function render(step, targetElement, tourState, context) {
      tourState = tourState || {};
      create();
      currentStep = step;
      var popover = step.popover || {};
      var config = configManager.getConfig();
      var ctx = context || { config: config, state: tourState, driver: null };

      var children = Array.from(popoverEl.children);
      for (var i = 0; i < children.length; i++) {
        if (children[i] !== arrowEl) children[i].remove();
      }
      popoverEl.classList.remove('tg-popover-visible', 'tg-popover-enter');

      // [NEW v1.5.0] Re-apply theme on each render in case setConfig changed it.
      applyTheme(popoverEl, config.theme);

      var isStrict = !!(step.strict || config.strict || (step.advanceOn && step.advanceOn.strict) || (step.beacon && step.beacon.strict));
      var buttonsList = popover.buttons || step.buttons || config.buttons;
      var showButtons = popover.showButtons || config.showButtons || ['next', 'previous', 'close'];

      var shouldShowHeaderClose = false;
      if (buttonsList) {
        shouldShowHeaderClose = buttonsList.indexOf('close') !== -1 && config.allowClose;
      } else {
        shouldShowHeaderClose = showButtons.indexOf('close') !== -1 && config.allowClose;
      }

      if (shouldShowHeaderClose) {
        var closeBtn = document.createElement('button');
        closeBtn.classList.add('tg-popover-btn-close');
        closeBtn.innerHTML = config.closeBtnText;
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.setAttribute('type', 'button');
        popoverEl.appendChild(closeBtn);
      }
      if (popover.title) {
        var titleEl = document.createElement('div');
        titleEl.classList.add('tg-popover-title');
        if (typeof popover.title === 'string') titleEl.innerHTML = popover.title;
        else if (popover.title instanceof Element) titleEl.appendChild(popover.title);
        popoverEl.appendChild(titleEl);
      }
      if (popover.description) {
        var descEl = document.createElement('div');
        descEl.classList.add('tg-popover-description');
        if (typeof popover.description === 'string') descEl.innerHTML = popover.description;
        else if (popover.description instanceof Element) descEl.appendChild(popover.description);
        popoverEl.appendChild(descEl);
      }

      var showProg = popover.showProgress !== undefined ? popover.showProgress : config.showProgress;
      var footerItems = [];
      if (buttonsList) {
        for (var bi = 0; bi < buttonsList.length; bi++) {
          if (buttonsList[bi] === 'close') continue; // Handled in header
          if (isStrict && (buttonsList[bi] === 'next' || (typeof buttonsList[bi] === 'object' && buttonsList[bi].id === 'next'))) continue;
          footerItems.push(buttonsList[bi]);
        }
      } else {
        if (showButtons.indexOf('previous') !== -1) footerItems.push('previous');
        if (!isStrict && showButtons.indexOf('next') !== -1) footerItems.push('next');
      }

      if (footerItems.length > 0 || showProg) {
        var footer = document.createElement('div');
        footer.classList.add('tg-popover-footer');
        if (showProg && tourState.totalSteps > 0) {
          var prog = document.createElement('span');
          prog.classList.add('tg-popover-progress');
          prog.textContent = (popover.progressText || config.progressText)
            .replace('{{current}}', String((tourState.activeIndex || 0) + 1))
            .replace('{{total}}', String(tourState.totalSteps));
          footer.appendChild(prog);
        }
        var btns = document.createElement('div');
        btns.classList.add('tg-popover-buttons');

        for (var fi = 0; fi < footerItems.length; fi++) {
          var item = footerItems[fi];
          if (item === 'previous') {
            if (!tourState.isFirst) {
              var pb = document.createElement('button');
              pb.classList.add('tg-popover-btn', 'tg-popover-btn-prev', 'tg-popover-btn-secondary');
              pb.innerHTML = config.prevBtnText;
              pb.setAttribute('type', 'button');
              btns.appendChild(pb);
            }
          } else if (item === 'next' || item === 'done') {
            var nb = document.createElement('button');
            if (tourState.isLast || item === 'done') {
              nb.classList.add('tg-popover-btn', 'tg-popover-btn-done', 'tg-popover-btn-primary');
              nb.innerHTML = config.doneBtnText;
            } else {
              nb.classList.add('tg-popover-btn', 'tg-popover-btn-next', 'tg-popover-btn-primary');
              nb.innerHTML = config.nextBtnText;
            }
            nb.setAttribute('type', 'button');
            btns.appendChild(nb);
          } else if (typeof item === 'object' && item !== null) {
            var cb = document.createElement('button');
            cb.setAttribute('type', 'button');
            cb.classList.add('tg-popover-btn');

            var variant = item.variant || (item.role === 'primary' ? 'primary' : (item.role === 'danger' ? 'danger' : (item.role === 'link' ? 'link' : 'secondary')));
            if (variant === 'primary') cb.classList.add('tg-popover-btn-primary');
            else if (variant === 'link') cb.classList.add('tg-popover-btn-link');
            else if (variant === 'danger') cb.classList.add('tg-popover-btn-danger');
            else cb.classList.add('tg-popover-btn-secondary');

            if (item.className) {
              var customClasses = item.className.split(' ').filter(Boolean);
              for (var ci = 0; ci < customClasses.length; ci++) cb.classList.add(customClasses[ci]);
            }

            if (item.id) cb.id = item.id;
            if (item.ariaLabel) cb.setAttribute('aria-label', item.ariaLabel);

            var btnText = typeof item.text === 'function' ? item.text(targetElement, step, ctx) : item.text;
            cb.innerHTML = btnText || '';

            var isDisabled = typeof item.disabled === 'function' ? item.disabled(targetElement, step, ctx) : item.disabled;
            if (isDisabled) {
              cb.disabled = true;
              cb.setAttribute('aria-disabled', 'true');
            }

            if (typeof item.onClick === 'function') {
              (function (handler, btnObj) {
                cb.addEventListener('click', function (e) {
                  e.preventDefault();
                  e.stopPropagation();
                  if (cb.disabled) return;
                  try {
                    handler(targetElement, step, ctx);
                  } catch (err) {
                    warn(ErrorCodes.HOOK_ERROR, 'Custom button onClick error: ' + err.message);
                  }
                });
              })(item.onClick, item);
            }

            btns.appendChild(cb);
          }
        }
        footer.appendChild(btns);
        popoverEl.appendChild(footer);
      }

      var hook = popover.onPopoverRender || config.onPopoverRender;
      if (hook) {
        try { hook(popoverEl, ctx); }
        catch (e) { warn(ErrorCodes.HOOK_ERROR, e.message); }
      }

      reposition(targetElement, step);
      requestAnimationFrame(function () {
        if (popoverEl) popoverEl.classList.add('tg-popover-visible', 'tg-popover-enter');
      });
    }

    function reposition(targetElement, step) {
      if (!popoverEl) return;
      var popover = (step && step.popover) || (currentStep && currentStep.popover) || {};
      var offset = configManager.getConfig('popoverOffset');
      if (!targetElement) {
        popoverEl.style.position = 'fixed';
        popoverEl.style.top = '50%';
        popoverEl.style.left = '50%';
        popoverEl.style.transform = 'translate(-50%, -50%)';
        if (arrowEl) arrowEl.style.display = 'none';
        return;
      }
      if (arrowEl) {
        arrowEl.style.display = '';
        arrowEl.style.top = '';
        arrowEl.style.bottom = '';
        arrowEl.style.left = '';
        arrowEl.style.right = '';
        arrowEl.style.marginLeft = '';
        arrowEl.style.marginTop = '';
        arrowEl.className = 'tg-popover-arrow';
      }
      popoverEl.style.transform = '';
      var tr = targetElement.getBoundingClientRect();
      popoverEl.style.visibility = 'hidden';
      popoverEl.style.display = 'block';
      popoverEl.style.top = '0';
      popoverEl.style.left = '0';
      var pr = popoverEl.getBoundingClientRect();
      popoverEl.style.visibility = '';

      var vp = getViewportSize();
      var side = popover.side || bestSide(tr, pr, vp);
      var align = popover.align || 'center';
      var top = 0, left = 0;
      switch (side) {
        case 'top': top = tr.top - pr.height - offset; left = calcA(tr, pr, align, 'h'); break;
        case 'bottom': top = tr.bottom + offset; left = calcA(tr, pr, align, 'h'); break;
        case 'left': top = calcA(tr, pr, align, 'v'); left = tr.left - pr.width - offset; break;
        case 'right': top = calcA(tr, pr, align, 'v'); left = tr.right + offset; break;
        default: top = tr.bottom + offset; left = calcA(tr, pr, align, 'h'); side = 'bottom';
      }
      var m = 8;
      var ct = Math.max(m, Math.min(top, vp.height - pr.height - m));
      var cl = Math.max(m, Math.min(left, vp.width - pr.width - m));
      popoverEl.style.position = 'fixed';
      popoverEl.style.top = ct + 'px';
      popoverEl.style.left = cl + 'px';
      if (arrowEl) posArrow(side, tr, ct, cl, pr);
    }

    function posArrow(side, tr, pt, pl, pr) {
      var sz = 12, half = 6, mn = 12;
      if (side === 'top' || side === 'bottom') {
        var tcx = tr.left + tr.width / 2;
        var al = Math.max(mn, Math.min(tcx - pl - half, pr.width - mn - sz));
        arrowEl.style.left = al + 'px';
        if (side === 'top') {
          arrowEl.style.bottom = -half + 'px';
          arrowEl.style.boxShadow = '2px 2px 4px rgba(0,0,0,0.05)';
        } else {
          arrowEl.style.top = -half + 'px';
          arrowEl.style.boxShadow = '-2px -2px 4px rgba(0,0,0,0.05)';
        }
      } else {
        var tcy = tr.top + tr.height / 2;
        var at = Math.max(mn, Math.min(tcy - pt - half, pr.height - mn - sz));
        arrowEl.style.top = at + 'px';
        if (side === 'left') {
          arrowEl.style.right = -half + 'px';
          arrowEl.style.boxShadow = '2px -2px 4px rgba(0,0,0,0.05)';
        } else {
          arrowEl.style.left = -half + 'px';
          arrowEl.style.boxShadow = '-2px 2px 4px rgba(0,0,0,0.05)';
        }
      }
    }

    function bestSide(tr, pr, vp) {
      vp = vp || getViewportSize();
      var s = [
        { s: 'bottom', v: vp.height - tr.bottom },
        { s: 'top', v: tr.top },
        { s: 'right', v: vp.width - tr.right },
        { s: 'left', v: tr.left },
      ];
      for (var i = 0; i < s.length; i++) {
        var need = (s[i].s === 'top' || s[i].s === 'bottom') ? pr.height : pr.width;
        if (s[i].v >= need + 20) return s[i].s;
      }
      s.sort(function (a, b) { return b.v - a.v; });
      return s[0].s;
    }

    function calcA(tr, pr, align, axis) {
      if (axis === 'h') {
        if (align === 'start') return tr.left;
        if (align === 'end') return tr.right - pr.width;
        return tr.left + tr.width / 2 - pr.width / 2;
      } else {
        if (align === 'start') return tr.top;
        if (align === 'end') return tr.bottom - pr.height;
        return tr.top + tr.height / 2 - pr.height / 2;
      }
    }

    function hide() {
      if (popoverEl) popoverEl.classList.remove('tg-popover-visible', 'tg-popover-enter');
    }

    function destroy() {
      if (popoverEl) { popoverEl.remove(); popoverEl = null; arrowEl = null; currentStep = null; }
    }

    function getElement() { return popoverEl; }

    return { render: render, reposition: reposition, hide: hide, destroy: destroy, getElement: getElement };
  }

  // =========================================================================
  // MODULE: Highlight Manager  [UNCHANGED]
  // =========================================================================

  function createHighlightManager(configManager, overlayManager, stateManager) {
    var activeElement = null;
    var activeStep = null;
    var dummyElement = null;
    var settleTimers = [];

    function clearSettleTimers() {
      for (var i = 0; i < settleTimers.length; i++) {
        clearTimeout(settleTimers[i]);
      }
      settleTimers.length = 0;
    }

    function getOrCreateDummy() {
      if (dummyElement && document.body.contains(dummyElement)) return dummyElement;
      dummyElement = document.createElement('div');
      dummyElement.id = 'tg-dummy-element';
      dummyElement.style.cssText = 'width:0;height:0;pointer-events:none;opacity:0;position:fixed;top:50%;left:50%;';
      document.body.appendChild(dummyElement);
      return dummyElement;
    }

    function highlight(element, step) {
      clearSettleTimers();
      var target = element || getOrCreateDummy();
      activeElement = target;
      activeStep = step || (stateManager ? stateManager.getState('activeStep') : null);
      var config = configManager.getConfig();
      if (element && config.smoothScroll) bringIntoView(element, config.scrollIntoViewOptions);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { refresh(); });
      });
      // Settle timers to continuously reposition the SVG cutout during smooth scrolling
      settleTimers.push(setTimeout(function () { refresh(); }, 80));
      settleTimers.push(setTimeout(function () { refresh(); }, 180));
      settleTimers.push(setTimeout(function () { refresh(); }, 320));
      settleTimers.push(setTimeout(function () { refresh(); }, 450));
      return target;
    }

    function refresh(step) {
      if (!activeElement) return;
      if (activeElement.id === 'tg-dummy-element') { overlayManager.updateHighlight(null); return; }
      var currentStep = step || activeStep || (stateManager ? stateManager.getState('activeStep') : null);
      var config = configManager.getConfig();
      var padding = (currentStep && currentStep.stagePadding !== undefined) ? currentStep.stagePadding : config.stagePadding;
      var radius = (currentStep && currentStep.stageRadius !== undefined) ? currentStep.stageRadius : config.stageRadius;
      var rect = getElementRect(activeElement, padding, radius);
      overlayManager.updateHighlight(rect);
    }

    function destroy() {
      clearSettleTimers();
      if (dummyElement && dummyElement.parentNode) dummyElement.remove();
      dummyElement = null;
      activeElement = null;
      activeStep = null;
    }

    function getActiveElement() { return activeElement; }

    return { highlight: highlight, refresh: refresh, destroy: destroy, getActiveElement: getActiveElement };
  }

  // =========================================================================
  // MODULE: Events Manager  [MODIFIED v1.6.0 - container scroll capture added]
  // =========================================================================

  function createEventsManager(deps) {
    var cm = deps.configManager, sm = deps.stateManager, em = deps.emitter;
    var bound = [];
    var scrollTimeout = null;

    function add(t, ev, h, o) {
      o = o || false;
      t.addEventListener(ev, h, o);
      bound.push({ t: t, e: ev, h: h, o: o });
    }

    function onScroll() {
      if (!sm.getState('isInitialized')) return;
      em.emit('refresh');
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(function () {
        if (sm.getState('isInitialized')) em.emit('refresh');
      }, 100);
    }

    function init() {
      add(document, 'keydown', onKey, true);
      add(window, 'resize', onResize);
      // Capture scroll events from any nested scrollable container in the DOM
      add(document, 'scroll', onScroll, { capture: true, passive: true });
      if (typeof window !== 'undefined' && 'onscrollend' in window) {
        add(document, 'scrollend', onScroll, { capture: true, passive: true });
      }
    }

    function onKey(e) {
      if (!sm.getState('isInitialized') || !cm.getConfig('allowKeyboardControl')) return;
      switch (e.key) {
        case 'Escape':
          if (cm.getConfig('allowClose')) { e.preventDefault(); e.stopPropagation(); em.emit('close'); }
          break;
        case 'ArrowRight': e.preventDefault(); e.stopPropagation(); em.emit('next'); break;
        case 'Tab': e.preventDefault(); e.stopPropagation(); em.emit(e.shiftKey ? 'prev' : 'next'); break;
        case 'ArrowLeft': e.preventDefault(); e.stopPropagation(); em.emit('prev'); break;
      }
    }

    function onResize() {
      if (sm.getState('isInitialized')) em.emit('refresh');
    }

    function destroy() {
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
        scrollTimeout = null;
      }
      for (var i = 0; i < bound.length; i++) {
        var b = bound[i];
        var captureOpt = (typeof b.o === 'boolean') ? b.o : (b.o && b.o.capture ? true : false);
        b.t.removeEventListener(b.e, b.h, captureOpt);
      }
      bound.length = 0;
    }

    return { init: init, destroy: destroy };
  }

  // =========================================================================
  // MODULE: Click Router  [UNCHANGED]
  // =========================================================================

  function createClickRouter(deps) {
    var cm = deps.configManager, sm = deps.stateManager;
    var pm = deps.popoverManager, om = deps.overlayManager, em = deps.emitter;
    var dh = null;

    function onClick(e) {
      if (!sm.getState('isInitialized')) return;
      var p = pm.getElement();
      if (p && p.contains(e.target)) {
        if (e.target.classList.contains('tg-popover-btn-next') || e.target.classList.contains('tg-popover-btn-done')) {
          e.preventDefault(); e.stopPropagation(); em.emit('next'); return;
        }
        if (e.target.classList.contains('tg-popover-btn-prev')) {
          e.preventDefault(); e.stopPropagation(); em.emit('prev'); return;
        }
        if (e.target.classList.contains('tg-popover-btn-close')) {
          e.preventDefault(); e.stopPropagation(); em.emit('close'); return;
        }
      }
    }

    function onOverlay() {
      if (sm.getState('isInitialized') && cm.getConfig('allowClose')) em.emit('close');
    }

    function init() {
      dh = function (e) { onClick(e); };
      document.addEventListener('click', dh, true);
      om.setClickHandler(onOverlay);
    }

    function destroy() {
      if (dh) { document.removeEventListener('click', dh, true); dh = null; }
      om.setClickHandler(null);
    }

    return { init: init, destroy: destroy };
  }

  // =========================================================================
  // MAIN: TamperGuide Driver
  // [MODIFIED v1.5.0] - Integrated all new modules into the driver.
  // Changes are marked inline. The overall structure and flow are identical
  // to v1.4.1. New modules are instantiated alongside existing ones and
  // called at the appropriate lifecycle points.
  // =========================================================================

  function tamperGuide(options) {
    options = options || {};
    validateConfig(options);

    var configManager = createConfigManager(options);
    var stateManager = createStateManager();
    var emitter = createEmitter();

    // -----------------------------------------------------------------
    // Determine z-index layers dynamically.  [UNCHANGED]
    // -----------------------------------------------------------------
    var zOverlay, zPopover;
    var panelZIndex = 0;
    var steps = configManager.getConfig('steps') || [];

    for (var si = 0; si < steps.length; si++) {
      if (!steps[si].element) continue;
      var probeEl = resolveElement(steps[si].element);
      if (!probeEl) continue;
      var ancestor = findStackingAncestor(probeEl);
      if (ancestor) {
        var az = getEffectiveZIndex(ancestor);
        if (az > panelZIndex) panelZIndex = az;
      }
      var fullChainZ = getEffectiveZIndex(probeEl);
      if (fullChainZ > panelZIndex) panelZIndex = fullChainZ;
    }

    if (panelZIndex === 0) {
      var allElements = document.querySelectorAll('*');
      for (var fi = 0; fi < allElements.length; fi++) {
        var fStyle = window.getComputedStyle(allElements[fi]);
        if (fStyle.position === 'fixed' || fStyle.position === 'absolute') {
          var fz = parseInt(fStyle.zIndex, 10);
          if (!isNaN(fz) && fz > panelZIndex) panelZIndex = fz;
        }
      }
    }

    if (panelZIndex > 0) {
      zOverlay = panelZIndex + 1;
      zPopover = panelZIndex + 3;
    } else {
      zOverlay = 2147483644;
      zPopover = 2147483646;
    }

    var overlayManager = createOverlayManager(configManager, zOverlay);
    var popoverManager = createPopoverManager(configManager, zPopover);
    var highlightManager = createHighlightManager(configManager, overlayManager, stateManager);
    var eventsManager = null;
    var clickRouter = null;

    // -----------------------------------------------------------------
    // [NEW v1.5.0] Instantiate new modules.
    // These are created once per guide instance and live for its duration.
    // -----------------------------------------------------------------
    var persistenceManager = createPersistenceManager(configManager);
    var analyticsTracker = createAnalyticsTracker(configManager);
    var accessibilityManager = createAccessibilityManager();
    var advanceOnManager = createAdvanceOnManager();
    var hotspotManager = createHotspotManager(zPopover);
    var beaconManager = createBeaconManager(zPopover);
    var strictInteractionManager = createStrictInteractionManager({
      stateManager: stateManager,
      popoverManager: popoverManager,
      beaconManager: beaconManager,
      configManager: configManager,
    });
    // autoRefreshManager is created later in init() because it needs
    // the handleRefresh function which is defined below.
    var autoRefreshManager = null;

    // [NEW v1.5.0] Tracks the active waitFor cleanup function so we
    // can abort polling if the tour is destroyed while waiting.
    var activeWaitForCleanup = null;

    function safeHook(fn) {
      if (!fn) return undefined;
      try {
        var a = Array.prototype.slice.call(arguments, 1);
        return fn.apply(null, a);
      } catch (e) {
        warn(ErrorCodes.HOOK_ERROR, 'Hook error: ' + e.message);
        return undefined;
      }
    }

    // [MODIFIED v1.5.0] init() - added initialization of autoRefreshManager
    // and analyticsTracker.begin(). Original init logic is untouched.
    function init() {
      if (stateManager.getState('isInitialized')) return;
      injectStyles(zOverlay, zPopover);
      overlayManager.show();
      stateManager.setState('__focusedBeforeActivation', document.activeElement);
      eventsManager = createEventsManager({
        configManager: configManager, stateManager: stateManager,
        popoverManager: popoverManager, emitter: emitter,
      });
      eventsManager.init();
      clickRouter = createClickRouter({
        configManager: configManager, stateManager: stateManager,
        popoverManager: popoverManager, overlayManager: overlayManager,
        emitter: emitter,
      });
      clickRouter.init();
      emitter.on('next', handleNext);
      emitter.on('prev', handlePrev);
      emitter.on('close', handleClose);
      emitter.on('refresh', handleRefresh);
      stateManager.setState('isInitialized', true);

      // [NEW v1.5.0] Start analytics tracking for this tour session.
      analyticsTracker.begin();

      // [NEW v1.5.0] Start auto-refresh observer if configured.
      autoRefreshManager = createAutoRefreshManager(configManager, stateManager, handleRefresh);
      autoRefreshManager.start();
    }

    // [MODIFIED v1.5.0] highlightStep - integrated conditional steps (when),
    // waitFor polling, advanceOn listener, persistence saving, analytics
    // tracking, and accessibility announcements. The core flow is the same:
    // resolve element -> fire hooks -> update state -> highlight -> render popover.
    // The new logic wraps around this flow at specific points.
    function highlightStep(idx) {
      var steps = configManager.getConfig('steps');
      if (!steps || !steps.length) throw new TamperGuideError(ErrorCodes.NO_STEPS, 'No steps.');
      if (idx < 0 || idx >= steps.length) throw new TamperGuideError(ErrorCodes.INVALID_STEP_INDEX, 'Bad index: ' + idx);
      if (stateManager.getState('__transitionInProgress')) return;

      var step = steps[idx];

      // [NEW v1.5.0] Evaluate the "when" condition before activating the step.
      // If it returns false, find the next eligible step in the same direction.
      if (!evaluateStepCondition(step, idx)) {
        // Determine direction: if we are moving forward or backward.
        var prevIdx = stateManager.getState('activeIndex');
        var direction = (prevIdx === undefined || idx > prevIdx) ? 1 : -1;
        var nextIdx = idx + direction;
        // Search for the next eligible step, but guard against infinite loops
        // by limiting the search to the total number of steps.
        var searched = 0;
        while (nextIdx >= 0 && nextIdx < steps.length && searched < steps.length) {
          if (evaluateStepCondition(steps[nextIdx], nextIdx)) {
            highlightStep(nextIdx);
            return;
          }
          nextIdx += direction;
          searched++;
        }
        // No eligible steps found in this direction.
        // If going forward, destroy the tour. If backward, do nothing.
        if (direction > 0) {
          performDestroy(false);
        }
        return;
      }

      stateManager.setState('__transitionInProgress', true);

      // [NEW v1.5.0] Clean up any previous advanceOn listener and waitFor poll.
      advanceOnManager.detach();
      strictInteractionManager.detach();
      if (activeWaitForCleanup) {
        activeWaitForCleanup();
        activeWaitForCleanup = null;
      }

      var prevStep = stateManager.getState('activeStep');
      var prevEl = stateManager.getState('activeElement');
      if (prevStep && prevEl) {
        safeHook(prevStep.onDeselected || configManager.getConfig('onDeselected'),
          prevEl, prevStep, { config: configManager.getConfig(), state: stateManager.getState(), driver: api });
      }

      // [NEW v1.5.0] If the step has waitFor, use async element resolution.
      // Otherwise, resolve synchronously as before.
      function proceedWithElement(element) {
        safeHook(step.onHighlightStarted || configManager.getConfig('onHighlightStarted'),
          element, step, { config: configManager.getConfig(), state: stateManager.getState(), driver: api });

        stateManager.setState('previousStep', prevStep);
        stateManager.setState('previousElement', prevEl);
        stateManager.setState('activeStep', step);
        stateManager.setState('activeIndex', idx);

        var he = highlightManager.highlight(element, step);
        stateManager.setState('activeElement', he);
        popoverManager.hide();
        beaconManager.hide();

        // [NEW v1.6.0] Attach strict interaction manager immediately when element is highlighted.
        var isStrict = !!(step.strict || configManager.getConfig('strict') ||
          (step.advanceOn && step.advanceOn.strict) ||
          (step.beacon && step.beacon.strict));
        if (isStrict && element) {
          strictInteractionManager.attach(step, element, function () {
            handleNext();
          });
        }

        // [NEW v1.5.0] Track step change for analytics.
        analyticsTracker.trackStep(idx, step);

        // [NEW v1.5.0] Save progress for persistence.
        persistenceManager.save(idx, false);

        var ts = {
          activeIndex: idx, totalSteps: steps.length,
          isFirst: idx === 0, isLast: idx === steps.length - 1,
        };
        var delay = configManager.getConfig('animate') ? 350 : 50;
        setTimeout(function () {
          if (!stateManager.getState('isInitialized')) return;
          highlightManager.refresh(step);
          if (step.popover) {
            popoverManager.render(step, element, ts, {
              config: configManager.getConfig(),
              state: stateManager.getState(),
              driver: api,
            });
          }

          // [NEW v1.5.0] Set up accessibility: announce step and trap focus.
          var announcement = step.ariaLabel ||
            (step.popover && step.popover.title ? step.popover.title : '') ||
            ('Step ' + (idx + 1) + ' of ' + steps.length);
          accessibilityManager.announce(announcement);
          var popoverEl = popoverManager.getElement();
          if (popoverEl) {
            var interactiveTarget = configManager.getConfig('disableActiveInteraction') ? null : element;
            accessibilityManager.setupFocusTrap(popoverEl, interactiveTarget);
          }

          // [NEW v1.5.0] Attach advanceOn listener if configured.
          if (step.advanceOn) {
            advanceOnManager.attach(step, element, function () {
              handleNext();
            });
          }

          // [NEW v1.6.0] Attach click indicator / beacon if configured.
          var beaconOpt = (step.beacon !== undefined) ? step.beacon : configManager.getConfig('beacon');
          if (beaconOpt && element) {
            var beaconConfig = (typeof beaconOpt === 'object' && beaconOpt !== null) ? beaconOpt : (typeof beaconOpt === 'string' ? { text: beaconOpt } : {});
            beaconManager.show(element, beaconConfig);
          }

          safeHook(step.onHighlighted || configManager.getConfig('onHighlighted'),
            he, step, { config: configManager.getConfig(), state: stateManager.getState(), driver: api });
          stateManager.setState('__transitionInProgress', false);
        }, delay);
      }

      // [NEW v1.6.0] Run beforeStep hook if defined (supports both sync and async / Promises).
      function runBeforeStep(callback) {
        var hook = step.beforeStep || configManager.getConfig('beforeStep');
        if (typeof hook === 'function') {
          try {
            var result = hook(step, { config: configManager.getConfig(), state: stateManager.getState(), driver: api });
            if (result && typeof result.then === 'function') {
              result.then(function () {
                if (!stateManager.getState('isInitialized')) return;
                callback();
              }, function (err) {
                warn(ErrorCodes.HOOK_ERROR, 'Error in beforeStep hook: ' + (err && err.message));
                if (!stateManager.getState('isInitialized')) return;
                callback();
              });
              return;
            }
          } catch (err) {
            warn(ErrorCodes.HOOK_ERROR, 'Error in beforeStep hook: ' + err.message);
          }
        }
        callback();
      }

      runBeforeStep(function () {
        if (!stateManager.getState('isInitialized')) {
          stateManager.setState('__transitionInProgress', false);
          return;
        }

        // [NEW v1.5.0] Branch: async (waitFor) or sync element resolution.
        if (step.waitFor) {
          activeWaitForCleanup = waitForElement(step, idx, function (element) {
            activeWaitForCleanup = null;
            if (!stateManager.getState('isInitialized')) {
              stateManager.setState('__transitionInProgress', false);
              return;
            }
            if (!element && !step.popover) {
              // Element not found and no popover to show: skip the step.
              stateManager.setState('__transitionInProgress', false);
              var nextIdx = idx + 1;
              if (nextIdx < steps.length) {
                highlightStep(nextIdx);
              } else {
                performDestroy(false);
              }
              return;
            }
            proceedWithElement(element);
          });
        } else {
          var element = resolveElement(step.element);
          proceedWithElement(element);
        }
      });
    }

    // [MODIFIED v1.5.0] handleNext - added advanceOnManager.detach() and
    // accessibilityManager.releaseFocusTrap() calls. Original logic untouched.
    function handleNext() {
      if (stateManager.getState('__transitionInProgress')) return;
      // [NEW v1.5.0] Clean up current step's listeners before transitioning.
      advanceOnManager.detach();
      strictInteractionManager.detach();
      accessibilityManager.releaseFocusTrap();
      beaconManager.hide();

      var c = configManager.getConfig(), i = stateManager.getState('activeIndex'), s = c.steps || [];
      var as = stateManager.getState('activeStep'), ae = stateManager.getState('activeElement');
      var h = (as && as.popover && as.popover.onNextClick) || c.onNextClick;
      if (h && safeHook(h, ae, as, { config: c, state: stateManager.getState(), driver: api }) === false) return;
      if (i !== undefined && i < s.length - 1) highlightStep(i + 1);
      else performDestroy(false);
    }

    // [MODIFIED v1.5.0] handlePrev - same cleanup additions as handleNext.
    function handlePrev() {
      if (stateManager.getState('__transitionInProgress')) return;
      // [NEW v1.5.0] Clean up current step's listeners before transitioning.
      advanceOnManager.detach();
      strictInteractionManager.detach();
      accessibilityManager.releaseFocusTrap();
      beaconManager.hide();

      var c = configManager.getConfig(), i = stateManager.getState('activeIndex');
      var as = stateManager.getState('activeStep'), ae = stateManager.getState('activeElement');
      var h = (as && as.popover && as.popover.onPrevClick) || c.onPrevClick;
      if (h && safeHook(h, ae, as, { config: c, state: stateManager.getState(), driver: api }) === false) return;
      if (i !== undefined && i > 0) highlightStep(i - 1);
    }

    function handleClose() {
      if (stateManager.getState('__transitionInProgress')) return;
      // [NEW v1.5.0] Clean up current step's listeners before closing.
      advanceOnManager.detach();
      strictInteractionManager.detach();
      accessibilityManager.releaseFocusTrap();
      beaconManager.hide();

      var c = configManager.getConfig();
      var as = stateManager.getState('activeStep'), ae = stateManager.getState('activeElement');
      var h = (as && as.popover && as.popover.onCloseClick) || c.onCloseClick;
      if (h && safeHook(h, ae, as, { config: c, state: stateManager.getState(), driver: api }) === false) return;
      performDestroy(true);
    }

    function handleRefresh() {
      highlightManager.refresh();
      overlayManager.handleResize();
      var el = stateManager.getState('activeElement'), st = stateManager.getState('activeStep');
      if (el && st) popoverManager.reposition(el, st);
      beaconManager.reposition();
    }

    // [MODIFIED v1.5.0] performDestroy - added cleanup of all new modules:
    // advanceOnManager, autoRefreshManager, accessibilityManager,
    // activeWaitForCleanup, and hotspotManager. Also fires analyticsTracker.finish()
    // and persistenceManager.save() with completion status.
    // The original cleanup sequence for overlay, popover, highlight, events,
    // clickRouter, emitter, and state is completely untouched.
    function performDestroy(withHook) {
      var c = configManager.getConfig();
      var ae = stateManager.getState('activeElement'), as = stateManager.getState('activeStep');
      var fb = stateManager.getState('__focusedBeforeActivation');
      if (withHook && c.onDestroyStarted) {
        if (safeHook(c.onDestroyStarted, ae, as, { config: c, state: stateManager.getState(), driver: api }) === false) return;
      }
      if (as) {
        safeHook(as.onDeselected || c.onDeselected, ae, as, { config: c, state: stateManager.getState(), driver: api });
      }

      // [NEW v1.5.0] Clean up new modules before destroying core modules.
      // Order matters: detach listeners first, then stop observers, then remove DOM.
      advanceOnManager.detach();
      strictInteractionManager.detach();
      beaconManager.destroy();
      if (activeWaitForCleanup) {
        activeWaitForCleanup();
        activeWaitForCleanup = null;
      }
      if (autoRefreshManager) {
        autoRefreshManager.stop();
        autoRefreshManager = null;
      }
      accessibilityManager.destroy();

      // [NEW v1.5.0] Determine if the tour was completed (last step was reached).
      var activeIdx = stateManager.getState('activeIndex');
      var totalSteps = (c.steps || []).length;
      var wasCompleted = (activeIdx !== undefined && activeIdx >= totalSteps - 1) && !withHook;

      // [NEW v1.5.0] Fire analytics summary before state is reset.
      analyticsTracker.finish(wasCompleted, activeIdx);

      // [NEW v1.5.0] Save final persistence state.
      if (wasCompleted) {
        persistenceManager.save(activeIdx, true);
      }

      // --- Original cleanup sequence (unchanged) ---
      popoverManager.destroy();
      highlightManager.destroy();
      overlayManager.destroy();
      if (eventsManager) { eventsManager.destroy(); eventsManager = null; }
      if (clickRouter) { clickRouter.destroy(); clickRouter = null; }
      emitter.destroy();
      var ds = as, de = ae;
      stateManager.resetState();
      removeStyles();
      if (ds) safeHook(c.onDestroyed, de, ds, { config: c, state: {}, driver: api });
      if (fb && typeof fb.focus === 'function') { try { fb.focus(); } catch (e) { /* may be gone */ } }
    }

    // [MODIFIED v1.5.0] api object - added new methods at the end.
    // All original methods are completely unchanged. New methods are
    // appended after the existing ones.
    var api = {
      // --- Original API methods (unchanged) ---
      isActive: function () { return stateManager.getState('isInitialized') || false; },
      refresh: function () { if (stateManager.getState('isInitialized')) handleRefresh(); },
      drive: function (i) {
        // [MODIFIED v1.5.0] drive() - added persistence resume logic.
        // If persist is enabled and saved progress exists, the tour resumes
        // from the saved index instead of index 0. If the saved tour was
        // already completed, drive() does nothing (the user finished before).
        // This check runs BEFORE init() so that the overlay is not shown
        // unnecessarily for completed tours.
        // The original behavior (init + highlightStep) is preserved when
        // persistence is disabled or no saved data exists.
        if (configManager.getConfig('persist') && configManager.getConfig('persistKey') && i === undefined) {
          var saved = persistenceManager.load();
          if (saved) {
            if (saved.completed) {
              // Tour was already completed. Do not restart.
              return;
            }
            // Resume from saved index, clamped to valid range.
            var resumeIdx = saved.index;
            var totalSteps = (configManager.getConfig('steps') || []).length;
            if (resumeIdx >= 0 && resumeIdx < totalSteps) {
              init();
              highlightStep(resumeIdx);
              return;
            }
          }
        }
        init();
        highlightStep(i || 0);
      },
      moveNext: function () { handleNext(); },
      movePrevious: function () { handlePrev(); },
      moveTo: function (i) { if (!stateManager.getState('isInitialized')) init(); highlightStep(i); },
      hasNextStep: function () {
        var s = configManager.getConfig('steps') || [], i = stateManager.getState('activeIndex');
        return i !== undefined && i < s.length - 1;
      },
      hasPreviousStep: function () {
        var i = stateManager.getState('activeIndex');
        return i !== undefined && i > 0;
      },
      isFirstStep: function () { return stateManager.getState('activeIndex') === 0; },
      isLastStep: function () {
        var s = configManager.getConfig('steps') || [], i = stateManager.getState('activeIndex');
        return i !== undefined && i === s.length - 1;
      },
      getActiveIndex: function () { return stateManager.getState('activeIndex'); },
      getActiveStep: function () { return stateManager.getState('activeStep'); },
      getActiveElement: function () { return stateManager.getState('activeElement'); },
      getPreviousElement: function () { return stateManager.getState('previousElement'); },
      getPreviousStep: function () { return stateManager.getState('previousStep'); },
      highlight: function (step) {
        if (!step || typeof step !== 'object') {
          throw new TamperGuideError(ErrorCodes.INVALID_STEP, 'highlight() needs a step object.');
        }
        init();
        var el = resolveElement(step.element);
        var he = highlightManager.highlight(el);
        stateManager.setState('activeStep', step);
        stateManager.setState('activeElement', he);
        stateManager.setState('activeIndex', undefined);
        beaconManager.hide();
        var d = configManager.getConfig('animate') ? 350 : 50;
        setTimeout(function () {
          if (stateManager.getState('isInitialized') && step.popover) {
            popoverManager.render(step, el, { activeIndex: 0, totalSteps: 0, isFirst: true, isLast: true }, {
              config: configManager.getConfig(),
              state: stateManager.getState(),
              driver: api,
            });
          }
          if (stateManager.getState('isInitialized') && step.beacon && el) {
            var bOpt = (typeof step.beacon === 'object' && step.beacon !== null) ? step.beacon : (typeof step.beacon === 'string' ? { text: step.beacon } : {});
            beaconManager.show(el, bOpt);
          }
        }, d);
      },
      setConfig: function (c) { configManager.setConfig(c); },
      setSteps: function (s) {
        if (!Array.isArray(s)) throw new TamperGuideError(ErrorCodes.INVALID_CONFIG, 'setSteps() needs an Array.');
        for (var i = 0; i < s.length; i++) validateStep(s[i], i);
        stateManager.resetState();
        configManager.setConfig({ steps: s });
      },
      getConfig: function (k) { return configManager.getConfig(k); },
      getState: function (k) { return stateManager.getState(k); },
      destroy: function () { performDestroy(false); },

      // =================================================================
      // [NEW v1.5.0] New API methods.
      // These are appended after all original methods so that no existing
      // property order or key is shifted. Each method is documented with
      // its purpose, parameters, and error behavior.
      // =================================================================

      /**
       * moveToStep(id: string): void
       *
       * Navigates to a step by its string ID instead of a numeric index.
       * The step must have an "id" property defined in its configuration.
       *
       * If no step matches the given ID, a TamperGuideError is thrown with
       * code INVALID_STEP_INDEX and a message listing all available IDs.
       *
       * If the tour is not yet initialized, it will be initialized first
       * (same behavior as moveTo).
       *
       * @param {string} id - The step ID to navigate to
       * @throws {TamperGuideError} If no step with the given ID exists
       *
       * Usage:
       *   guide.moveToStep('settings-panel');
       */
      moveToStep: function (id) {
        var s = configManager.getConfig('steps') || [];
        var idx = resolveStepId(s, id);
        if (!stateManager.getState('isInitialized')) init();
        highlightStep(idx);
      },

      /**
       * getStepCount(): number
       *
       * Returns the total number of steps configured in the tour.
       * Useful for building custom progress indicators or conditional logic.
       *
       * @returns {number}
       */
      getStepCount: function () {
        return (configManager.getConfig('steps') || []).length;
      },

      /**
       * resetProgress(): void
       *
       * Clears all saved persistence data for this tour.
       * Call this when you want to force the tour to start from the
       * beginning on the next page load, even if the user previously
       * completed or partially completed it.
       *
       * Does nothing if persistence is not enabled.
       *
       * Usage:
       *   guide.resetProgress();  // Next drive() starts from step 0
       */
      resetProgress: function () {
        persistenceManager.clear();
      },

      /**
       * isCompleted(): boolean
       *
       * Returns true if the user has previously completed this tour
       * and the completion record has not expired.
       *
       * Useful for deciding whether to show the tour at all:
       *   if (!guide.isCompleted()) {
       *     guide.drive();
       *   }
       *
       * Always returns false if persistence is not enabled.
       *
       * @returns {boolean}
       */
      isCompleted: function () {
        var saved = persistenceManager.load();
        return saved ? (saved.completed === true) : false;
      },

      /**
       * addHotspot(options: object): void
       *
       * Adds a persistent, non-blocking visual hint to an element.
       * The hotspot is independent of the tour: it shows a pulsing dot
       * with a hover tooltip and does not block page interaction.
       *
       * Options:
       *   element        {string}  - Required. CSS selector for the target.
       *   tooltip        {string}  - Tooltip text shown on hover.
       *   side           {string}  - Tooltip placement: 'top'|'right'|'bottom'|'left'. Default: 'bottom'.
       *   pulse          {boolean} - Show pulse animation. Default: true.
       *   pulseColor     {string}  - Color of the dot. Default: '#ef4444'.
       *   dismissOnClick {boolean} - Remove when the target element is clicked. Default: false.
       *   autoDismiss    {number}  - Auto-remove after N milliseconds. 0 = never. Default: 0.
       *
       * Usage:
       *   guide.addHotspot({
       *     element: '#new-feature-btn',
       *     tooltip: 'Try our new feature!',
       *     dismissOnClick: true,
       *   });
       */
      addHotspot: function (options) {
        // Ensure styles are injected even if no tour has been started.
        injectStyles(zOverlay, zPopover);
        hotspotManager.add(options);
      },

      /**
       * removeHotspot(selector: string): void
       *
       * Removes a specific hotspot by its element selector.
       *
       * @param {string} selector - The same CSS selector used in addHotspot()
       *
       * Usage:
       *   guide.removeHotspot('#new-feature-btn');
       */
      removeHotspot: function (selector) {
        hotspotManager.remove(selector);
      },

      /**
       * removeAllHotspots(): void
       *
       * Removes all active hotspots from the page.
       */
      removeAllHotspots: function () {
        hotspotManager.removeAll();
      },

      /**
       * showBeacon(target: string | Element, options?: object): void
       *
       * Shows a non-blocking animated click indicator (cascading waves / radar pulse)
       * on the specified element.
       *
       * Options:
       *   shape          {string}  - 'adaptive' (default) or 'circle'/'radar'
       *   color          {string}  - CSS color or preset ('yellow', 'blue', 'green', 'red', 'purple', 'cyan', 'pink')
       *   borderWidth    {number}  - Border width in px (default: 3)
       *   speed          {number}  - Ripple duration in seconds (default: 2)
       *   dismissOnClick {boolean} - Auto-dismiss when target element is clicked (default: true)
       *
       * Usage:
       *   guide.showBeacon('#submit-btn', { shape: 'adaptive', color: 'green' });
       */
      showBeacon: function (target, options) {
        injectStyles(zOverlay, zPopover);
        beaconManager.show(target, options);
      },

      /**
       * hideBeacon(): void
       *
       * Hides and removes the currently active click indicator / beacon.
       */
      hideBeacon: function () {
        beaconManager.hide();
      },
    };

    return api;
  }

  // =========================================================================
  // GLOBAL EXPORT  [UNCHANGED]
  // =========================================================================

  if (typeof window !== 'undefined') window.tamperGuide = tamperGuide;
  if (typeof globalThis !== 'undefined') globalThis.tamperGuide = tamperGuide;

})();
