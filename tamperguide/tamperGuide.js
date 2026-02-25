// ==UserScript==
// @name         TamperGuide
// @namespace    https://github.com/UNKchr/tamperguide
// @version      1.1.0
// @author       UNKchr
// @description  Lightweight library for product tours, highlights, and contextual help in Tampermonkey userscripts.
// @license      MIT
// ==/UserScript==

// ===========================================================================
// TamperGuide v1.1.0
// Lightweight library for product tours, highlights, and contextual help
// in Tampermonkey userscripts. Inspired by driver.js, designed for the
// userscript ecosystem.
// Zero dependencies | Auto-injects CSS | Sandbox-compatible
// ===========================================================================

(function () {
  'use strict';

  // =========================================================================
  // MODULE: Errors & Validation
  // =========================================================================

  class TamperGuideError extends Error {
    /**
     * Custom error class with error codes and context for debugging.
     * @param {string} code - Machine-readable error code
     * @param {string} message - Human-readable error message
     * @param {Object} [context={}] - Additional debugging context
     */
    constructor(code, message, context = {}) {
      var fullMessage = '[TamperGuide:' + code + '] ' + message;
      super(fullMessage);
      this.name = 'TamperGuideError';
      this.code = code;
      this.context = context;
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
  });

  /**
   * Logs a warning to the console without interrupting execution.
   * @param {string} code - Warning code
   * @param {string} message - Descriptive message
   */
  function warn(code, message) {
    console.warn('[TamperGuide:' + code + '] ' + message);
  }

  /**
   * Validates the global driver configuration.
   * Throws descriptive errors if the configuration is invalid.
   * @param {Object} config - Configuration to validate
   * @throws {TamperGuideError}
   */
  function validateConfig(config) {
    if (config === null || typeof config !== 'object') {
      throw new TamperGuideError(
        ErrorCodes.INVALID_CONFIG,
        'Configuration must be an object. Received: ' + typeof config +
        '. Correct example: tamperGuide({ steps: [...] })'
      );
    }

    var validKeys = [
      'steps', 'animate', 'overlayColor', 'overlayOpacity', 'stagePadding',
      'stageRadius', 'allowClose', 'allowKeyboardControl', 'showProgress',
      'showButtons', 'progressText', 'nextBtnText', 'prevBtnText',
      'doneBtnText', 'closeBtnText', 'popoverClass', 'popoverOffset',
      'smoothScroll', 'scrollIntoViewOptions', 'disableActiveInteraction',
      'allowBackdropInteraction',
      'onHighlightStarted', 'onHighlighted', 'onDeselected',
      'onDestroyStarted', 'onDestroyed', 'onNextClick', 'onPrevClick',
      'onCloseClick', 'onPopoverRender',
    ];

    var configKeys = Object.keys(config);
    for (var i = 0; i < configKeys.length; i++) {
      var key = configKeys[i];
      if (validKeys.indexOf(key) === -1) {
        var suggestions = validKeys
          .filter(function (k) { return k.toLowerCase().indexOf(key.toLowerCase().slice(0, 4)) !== -1; })
          .join(', ');
        warn(
          ErrorCodes.INVALID_CONFIG,
          'Unknown option: "' + key + '".' +
          (suggestions ? ' Did you mean: ' + suggestions + '?' : ' Valid options: ' + validKeys.join(', '))
        );
      }
    }

    if (config.steps !== undefined) {
      if (!Array.isArray(config.steps)) {
        throw new TamperGuideError(
          ErrorCodes.INVALID_CONFIG,
          '"steps" must be an Array of step objects. Received: ' + typeof config.steps +
          '. Example: steps: [{ element: "#my-button", popover: { title: "Hello" } }]'
        );
      }
      for (var j = 0; j < config.steps.length; j++) {
        validateStep(config.steps[j], j);
      }
    }

    if (config.overlayOpacity !== undefined) {
      if (typeof config.overlayOpacity !== 'number' || config.overlayOpacity < 0 || config.overlayOpacity > 1) {
        throw new TamperGuideError(
          ErrorCodes.INVALID_CONFIG,
          '"overlayOpacity" must be a number between 0 and 1. Received: ' + config.overlayOpacity
        );
      }
    }

    if (config.showButtons !== undefined) {
      if (!Array.isArray(config.showButtons)) {
        throw new TamperGuideError(
          ErrorCodes.INVALID_CONFIG,
          '"showButtons" must be an Array. Valid values: ["next", "previous", "close"]. Received: ' + typeof config.showButtons
        );
      }
      var validButtons = ['next', 'previous', 'close'];
      for (var b = 0; b < config.showButtons.length; b++) {
        if (validButtons.indexOf(config.showButtons[b]) === -1) {
          throw new TamperGuideError(
            ErrorCodes.INVALID_CONFIG,
            'Unknown button in "showButtons": "' + config.showButtons[b] + '". Valid values: ' + validButtons.join(', ')
          );
        }
      }
    }

    var hookKeys = [
      'onHighlightStarted', 'onHighlighted', 'onDeselected',
      'onDestroyStarted', 'onDestroyed', 'onNextClick', 'onPrevClick',
      'onCloseClick', 'onPopoverRender',
    ];
    for (var h = 0; h < hookKeys.length; h++) {
      if (config[hookKeys[h]] !== undefined && typeof config[hookKeys[h]] !== 'function') {
        throw new TamperGuideError(
          ErrorCodes.INVALID_CONFIG,
          '"' + hookKeys[h] + '" must be a function. Received: ' + typeof config[hookKeys[h]]
        );
      }
    }
  }

  /**
   * Validates an individual tour step.
   * @param {Object} step - Step to validate
   * @param {number} index - Step index in the array
   * @throws {TamperGuideError}
   */
  function validateStep(step, index) {
    if (step === null || typeof step !== 'object') {
      throw new TamperGuideError(
        ErrorCodes.INVALID_STEP,
        'Step at index ' + index + ' must be an object. Received: ' + typeof step + '. ' +
        'Example: { element: "#my-element", popover: { title: "Title", description: "Description" } }'
      );
    }

    if (step.element !== undefined) {
      var elementType = typeof step.element;
      if (elementType !== 'string' && elementType !== 'function' && !(step.element instanceof Element)) {
        throw new TamperGuideError(
          ErrorCodes.INVALID_STEP,
          '"element" in step ' + index + ' must be a CSS selector (string), a function returning an Element, or a DOM Element. Received: ' + elementType
        );
      }
      if (elementType === 'string' && step.element.trim() === '') {
        throw new TamperGuideError(
          ErrorCodes.INVALID_STEP,
          '"element" in step ' + index + ' is an empty string. Provide a valid CSS selector, e.g. "#my-element" or ".my-class"'
        );
      }
    }

    if (step.popover !== undefined) {
      if (typeof step.popover !== 'object' || step.popover === null) {
        throw new TamperGuideError(
          ErrorCodes.INVALID_STEP,
          '"popover" in step ' + index + ' must be an object. Example: { title: "Title", description: "Description" }'
        );
      }

      var validSides = ['top', 'right', 'bottom', 'left'];
      if (step.popover.side && validSides.indexOf(step.popover.side) === -1) {
        throw new TamperGuideError(
          ErrorCodes.INVALID_STEP,
          '"popover.side" in step ' + index + ' has an invalid value: "' + step.popover.side + '". Valid values: ' + validSides.join(', ')
        );
      }

      var validAligns = ['start', 'center', 'end'];
      if (step.popover.align && validAligns.indexOf(step.popover.align) === -1) {
        throw new TamperGuideError(
          ErrorCodes.INVALID_STEP,
          '"popover.align" in step ' + index + ' has an invalid value: "' + step.popover.align + '". Valid values: ' + validAligns.join(', ')
        );
      }
    }

    if (!step.element && !step.popover) {
      throw new TamperGuideError(
        ErrorCodes.INVALID_STEP,
        'Step ' + index + ' has neither "element" nor "popover". At least one is required.'
      );
    }
  }

  // =========================================================================
  // MODULE: State Manager
  // =========================================================================

  /**
   * Creates a controlled state store with getters/setters.
   * Returns shallow copies to prevent external mutation.
   * @returns {{ getState: Function, setState: Function, resetState: Function }}
   */
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

    function getState(key) {
      if (key !== undefined) {
        return state[key];
      }
      var copy = {};
      for (var k in state) { copy[k] = state[k]; }
      return copy;
    }

    function setState(key, value) {
      state[key] = value;
    }

    function resetState() {
      for (var k in initialState) { state[k] = initialState[k]; }
    }

    return { getState: getState, setState: setState, resetState: resetState };
  }

  // =========================================================================
  // MODULE: Configuration Manager
  // =========================================================================

  var DEFAULT_CONFIG = Object.freeze({
    steps: [],
    animate: true,
    overlayColor: '#000',
    overlayOpacity: 0.7,
    stagePadding: 10,
    stageRadius: 5,
    allowClose: true,
    allowKeyboardControl: true,
    showProgress: false,
    showButtons: ['next', 'previous', 'close'],
    progressText: '{{current}} of {{total}}',
    nextBtnText: 'Next &rarr;',
    prevBtnText: '&larr; Previous',
    doneBtnText: 'Done &#10003;',
    closeBtnText: '&times;',
    popoverClass: '',
    popoverOffset: 10,
    smoothScroll: true,
    scrollIntoViewOptions: { behavior: 'smooth', block: 'center' },
    disableActiveInteraction: false,
    allowBackdropInteraction: false,
    onHighlightStarted: undefined,
    onHighlighted: undefined,
    onDeselected: undefined,
    onDestroyStarted: undefined,
    onDestroyed: undefined,
    onNextClick: undefined,
    onPrevClick: undefined,
    onCloseClick: undefined,
    onPopoverRender: undefined,
  });

  /**
   * Creates a configuration manager that merges user config with defaults.
   * @param {Object} userConfig - User-provided configuration
   * @returns {{ getConfig: Function, setConfig: Function }}
   */
  function createConfigManager(userConfig) {
    var config = {};
    var dk = Object.keys(DEFAULT_CONFIG);
    for (var i = 0; i < dk.length; i++) { config[dk[i]] = DEFAULT_CONFIG[dk[i]]; }
    var uk = Object.keys(userConfig);
    for (var j = 0; j < uk.length; j++) { config[uk[j]] = userConfig[uk[j]]; }

    function getConfig(key) {
      if (key !== undefined) {
        return config[key];
      }
      var copy = {};
      for (var k in config) { copy[k] = config[k]; }
      return copy;
    }

    function setConfig(newConfig) {
      validateConfig(newConfig);
      var nk = Object.keys(newConfig);
      for (var i = 0; i < nk.length; i++) { config[nk[i]] = newConfig[nk[i]]; }
    }

    return { getConfig: getConfig, setConfig: setConfig };
  }

  // =========================================================================
  // MODULE: Event Emitter
  // =========================================================================

  /**
   * Internal pub/sub event system for decoupled communication
   * between modules.
   * @returns {{ on: Function, off: Function, emit: Function, destroy: Function }}
   */
  function createEmitter() {
    var listeners = {};

    function on(event, callback) {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(callback);
    }

    function off(event, callback) {
      if (!listeners[event]) return;
      var idx = listeners[event].indexOf(callback);
      if (idx > -1) {
        listeners[event].splice(idx, 1);
      }
    }

    function emit(event) {
      if (!listeners[event]) return;
      var args = Array.prototype.slice.call(arguments, 1);
      var cbs = listeners[event].slice();
      for (var i = 0; i < cbs.length; i++) {
        try {
          cbs[i].apply(null, args);
        } catch (err) {
          warn(ErrorCodes.HOOK_ERROR, 'Error in listener for event "' + event + '": ' + err.message);
        }
      }
    }

    function destroy() {
      listeners = {};
    }

    return { on: on, off: off, emit: emit, destroy: destroy };
  }

  // =========================================================================
  // MODULE: CSS Styles (auto-injection)
  // =========================================================================

  var STYLE_ID = 'tamperguide-styles';

  // Z-index layers used throughout the library.
  // Overlay sits below the highlighted element and popover sits on top.
  // The highlighted element (and its fixed/absolute ancestors) are boosted
  // to Z_HIGHLIGHTED so they render above the overlay but below the popover.
  var Z_OVERLAY = 2147483644;
  var Z_HIGHLIGHTED = 2147483645;
  var Z_POPOVER = 2147483646;

  /**
   * Injects the required CSS styles into the document.
   * Idempotent: will not duplicate if already present.
   */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var css = [
      '/* ===== TamperGuide Overlay ===== */',
      '.tg-overlay {',
      '  position: fixed;',
      '  inset: 0;',
      '  z-index: ' + Z_OVERLAY + ';',
      '  pointer-events: none;',
      '  transition: opacity 0.3s ease;',
      '}',
      '.tg-overlay svg {',
      '  position: absolute;',
      '  inset: 0;',
      '  width: 100%;',
      '  height: 100%;',
      '}',
      '.tg-overlay-clickable {',
      '  pointer-events: auto;',
      '  cursor: default;',
      '}',
      '',
      '/* ===== TamperGuide Popover ===== */',
      '.tg-popover {',
      '  all: initial;',
      '  position: fixed;',
      '  z-index: ' + Z_POPOVER + ';',
      '  background: #fff;',
      '  color: #1a1a2e;',
      '  border-radius: 8px;',
      '  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.1);',
      '  padding: 16px 20px;',
      '  max-width: 380px;',
      '  min-width: 240px;',
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;',
      '  font-size: 14px;',
      '  line-height: 1.5;',
      '  opacity: 0;',
      '  pointer-events: auto;',
      '  box-sizing: border-box;',
      '  word-wrap: break-word;',
      '  overflow-wrap: break-word;',
      '}',
      '.tg-popover *, .tg-popover *::before, .tg-popover *::after {',
      '  box-sizing: border-box;',
      '}',
      '.tg-popover-visible { opacity: 1; }',
      '.tg-popover-animated {',
      '  transition: opacity 0.25s ease, transform 0.25s ease;',
      '}',
      '',
      '/* ===== Popover Arrow ===== */',
      '.tg-popover-arrow {',
      '  position: absolute;',
      '  width: 12px;',
      '  height: 12px;',
      '  background: #fff;',
      '  transform: rotate(45deg);',
      '  z-index: -1;',
      '}',
      '.tg-popover-arrow-top {',
      '  bottom: -6px;',
      '  left: 50%;',
      '  margin-left: -6px;',
      '  box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.05);',
      '}',
      '.tg-popover-arrow-bottom {',
      '  top: -6px;',
      '  left: 50%;',
      '  margin-left: -6px;',
      '  box-shadow: -2px -2px 4px rgba(0, 0, 0, 0.05);',
      '}',
      '.tg-popover-arrow-left {',
      '  right: -6px;',
      '  top: 50%;',
      '  margin-top: -6px;',
      '  box-shadow: 2px -2px 4px rgba(0, 0, 0, 0.05);',
      '}',
      '.tg-popover-arrow-right {',
      '  left: -6px;',
      '  top: 50%;',
      '  margin-top: -6px;',
      '  box-shadow: -2px 2px 4px rgba(0, 0, 0, 0.05);',
      '}',
      '',
      '/* ===== Popover Content ===== */',
      '.tg-popover-title {',
      '  display: block;',
      '  font-size: 16px;',
      '  font-weight: 700;',
      '  margin: 0 0 8px 0;',
      '  padding: 0;',
      '  color: #0f0f23;',
      '  line-height: 1.3;',
      '}',
      '.tg-popover-description {',
      '  display: block;',
      '  font-size: 14px;',
      '  font-weight: 400;',
      '  margin: 0 0 16px 0;',
      '  padding: 0;',
      '  color: #4a4a6a;',
      '  line-height: 1.6;',
      '}',
      '.tg-popover-description:last-child { margin-bottom: 0; }',
      '',
      '/* ===== Popover Footer ===== */',
      '.tg-popover-footer {',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: space-between;',
      '  gap: 8px;',
      '  margin-top: 4px;',
      '}',
      '.tg-popover-progress {',
      '  font-size: 12px;',
      '  color: #8888aa;',
      '  font-weight: 500;',
      '  flex-shrink: 0;',
      '}',
      '.tg-popover-buttons {',
      '  display: flex;',
      '  gap: 6px;',
      '  margin-left: auto;',
      '}',
      '.tg-popover-btn {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  border: none;',
      '  border-radius: 6px;',
      '  padding: 6px 14px;',
      '  font-size: 13px;',
      '  font-weight: 600;',
      '  cursor: pointer;',
      '  transition: background-color 0.15s ease, transform 0.1s ease;',
      '  font-family: inherit;',
      '  line-height: 1.4;',
      '  white-space: nowrap;',
      '  text-decoration: none;',
      '  outline: none;',
      '}',
      '.tg-popover-btn:active { transform: scale(0.96); }',
      '.tg-popover-btn:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }',
      '.tg-popover-btn-prev { background: #f0f0f5; color: #4a4a6a; }',
      '.tg-popover-btn-prev:hover { background: #e0e0ea; }',
      '.tg-popover-btn-next, .tg-popover-btn-done { background: #3b82f6; color: #fff; }',
      '.tg-popover-btn-next:hover, .tg-popover-btn-done:hover { background: #2563eb; }',
      '.tg-popover-btn-close {',
      '  position: absolute;',
      '  top: 8px;',
      '  right: 8px;',
      '  background: transparent;',
      '  border: none;',
      '  font-size: 18px;',
      '  color: #aaa;',
      '  cursor: pointer;',
      '  padding: 2px 6px;',
      '  border-radius: 4px;',
      '  line-height: 1;',
      '  transition: color 0.15s ease, background-color 0.15s ease;',
      '  text-decoration: none;',
      '  outline: none;',
      '}',
      '.tg-popover-btn-close:hover { color: #333; background: #f0f0f5; }',
      '.tg-popover-btn-close:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }',
      '',
      '/* ===== Animations ===== */',
      '@keyframes tg-fadeIn {',
      '  from { opacity: 0; transform: translateY(4px); }',
      '  to { opacity: 1; transform: translateY(0); }',
      '}',
      '.tg-popover-enter {',
      '  animation: tg-fadeIn 0.25s ease forwards;',
      '}',
    ].join('\n');

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  /**
   * Removes the injected styles from the document.
   */
  function removeStyles() {
    var el = document.getElementById(STYLE_ID);
    if (el) el.remove();
  }

  // =========================================================================
  // MODULE: DOM Utilities
  // =========================================================================

  /**
   * Resolves a selector/function/Element to a DOM Element.
   * @param {string|Function|Element|undefined|null} element
   * @returns {Element|null}
   */
  function resolveElement(element) {
    if (!element) return null;

    try {
      if (typeof element === 'function') {
        var result = element();
        if (result instanceof Element) return result;
        warn(ErrorCodes.ELEMENT_NOT_FOUND, 'The element() function did not return a valid DOM Element.');
        return null;
      }

      if (element instanceof Element) {
        return document.body.contains(element) ? element : null;
      }

      if (typeof element === 'string') {
        var found = document.querySelector(element);
        if (!found) {
          warn(
            ErrorCodes.ELEMENT_NOT_FOUND,
            'No element found with selector "' + element + '". ' +
            'Verify the selector is correct and the element exists in the DOM.'
          );
        }
        return found;
      }
    } catch (err) {
      warn(ErrorCodes.ELEMENT_NOT_FOUND, 'Error resolving element: ' + err.message);
    }

    return null;
  }

  /**
   * Gets the bounding rect of an element with stage padding applied.
   * Uses getBoundingClientRect which returns viewport-relative coordinates
   * and works correctly for elements inside position:fixed containers.
   *
   * @param {Element} element - Target element
   * @param {number} [padding=0] - Extra padding around the element
   * @param {number} [radius=0] - Border radius for the cutout
   * @returns {Object} Rectangle with x, y, width, height, radius
   */
  function getElementRect(element, padding, radius) {
    padding = padding || 0;
    radius = radius || 0;
    var rect = element.getBoundingClientRect();
    return {
      x: rect.left - padding,
      y: rect.top - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
      radius: radius,
    };
  }

  /**
   * Scrolls the viewport so the given element is visible.
   * Only scrolls if the element is not already fully in view.
   * Skips scrolling for elements inside position:fixed containers
   * since they are always in the viewport by definition.
   *
   * @param {Element} element - Target element
   * @param {ScrollIntoViewOptions} [options] - Scroll behavior options
   */
  function bringIntoView(element, options) {
    if (!element || typeof element.scrollIntoView !== 'function') return;

    // Do not scroll if the element is inside a position:fixed ancestor.
    // Fixed elements are always relative to the viewport and scrolling
    // would move the background page instead of bringing the element closer.
    if (isInsideFixedContainer(element)) return;

    options = options || { behavior: 'smooth', block: 'center' };

    try {
      var rect = element.getBoundingClientRect();
      var isVisible =
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth;

      if (!isVisible) {
        element.scrollIntoView(options);
      }
    } catch (err) {
      warn('SCROLL', 'Could not scroll to element: ' + err.message);
    }
  }

  /**
   * Checks whether the given element is inside a position:fixed ancestor.
   * @param {Element} element
   * @returns {boolean}
   */
  function isInsideFixedContainer(element) {
    var current = element;
    while (current && current !== document.body && current !== document.documentElement) {
      if (window.getComputedStyle(current).position === 'fixed') {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }

  // =========================================================================
  // MODULE: Overlay Manager (SVG-based cutout)
  // =========================================================================

  /**
   * Creates and manages the overlay with an SVG cutout (spotlight effect).
   * Uses SVG path with evenodd fill-rule to create a transparent hole
   * in the dark overlay, avoiding z-index stacking issues.
   *
   * @param {{ getConfig: Function }} configManager - Configuration manager
   * @returns {Object}
   */
  function createOverlayManager(configManager) {
    var overlayEl = null;
    var svgEl = null;
    var currentRect = null;
    var clickHandler = null;

    function create() {
      if (overlayEl) return;

      overlayEl = document.createElement('div');
      overlayEl.classList.add('tg-overlay');

      svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgEl.setAttribute('preserveAspectRatio', 'none');

      overlayEl.appendChild(svgEl);
      document.body.appendChild(overlayEl);

      overlayEl.addEventListener('click', function (e) {
        if (
          e.target.classList.contains('tg-overlay-clickable') ||
          e.target.closest('.tg-overlay-clickable')
        ) {
          if (clickHandler) clickHandler(e);
        }
      });

      refreshSVG(null);
    }

    /**
     * Redraws the SVG overlay, optionally with a cutout rectangle.
     * @param {Object|null} rect - Cutout rect or null for full overlay
     */
    function refreshSVG(rect) {
      if (!svgEl) return;

      var w = window.innerWidth;
      var h = window.innerHeight;
      var color = configManager.getConfig('overlayColor');
      var opacity = configManager.getConfig('overlayOpacity');

      svgEl.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      svgEl.style.width = w + 'px';
      svgEl.style.height = h + 'px';

      if (!rect) {
        svgEl.innerHTML =
          '<rect x="0" y="0" width="' + w + '" height="' + h + '" ' +
          'fill="' + color + '" fill-opacity="' + opacity + '" ' +
          'class="tg-overlay-clickable" />';
        return;
      }

      currentRect = rect;
      var x = Math.max(0, rect.x);
      var y = Math.max(0, rect.y);
      var rw = Math.min(rect.width, w - x);
      var rh = Math.min(rect.height, h - y);
      var r = Math.min(rect.radius || 0, rw / 2, rh / 2);

      var outer = 'M 0 0 H ' + w + ' V ' + h + ' H 0 Z';
      var inner;

      if (r > 0) {
        inner =
          'M ' + (x + r) + ' ' + y +
          ' H ' + (x + rw - r) +
          ' Q ' + (x + rw) + ' ' + y + ' ' + (x + rw) + ' ' + (y + r) +
          ' V ' + (y + rh - r) +
          ' Q ' + (x + rw) + ' ' + (y + rh) + ' ' + (x + rw - r) + ' ' + (y + rh) +
          ' H ' + (x + r) +
          ' Q ' + x + ' ' + (y + rh) + ' ' + x + ' ' + (y + rh - r) +
          ' V ' + (y + r) +
          ' Q ' + x + ' ' + y + ' ' + (x + r) + ' ' + y +
          ' Z';
      } else {
        inner = 'M ' + x + ' ' + y + ' H ' + (x + rw) + ' V ' + (y + rh) + ' H ' + x + ' Z';
      }

      svgEl.innerHTML =
        '<path d="' + outer + ' ' + inner + '" ' +
        'fill-rule="evenodd" ' +
        'fill="' + color + '" fill-opacity="' + opacity + '" ' +
        'class="tg-overlay-clickable" />';
    }

    function show() {
      create();
      if (overlayEl) {
        overlayEl.style.opacity = '1';
      }
    }

    function updateHighlight(rect) {
      if (!overlayEl) create();
      refreshSVG(rect);
    }

    function handleResize() {
      refreshSVG(currentRect);
    }

    function hide() {
      if (overlayEl) {
        overlayEl.style.opacity = '0';
      }
    }

    function destroy() {
      if (overlayEl) {
        overlayEl.remove();
        overlayEl = null;
        svgEl = null;
        currentRect = null;
      }
    }

    function getElement() {
      return overlayEl;
    }

    function setClickHandler(handler) {
      clickHandler = handler;
    }

    return {
      show: show,
      updateHighlight: updateHighlight,
      handleResize: handleResize,
      hide: hide,
      destroy: destroy,
      getElement: getElement,
      setClickHandler: setClickHandler,
    };
  }

  // =========================================================================
  // MODULE: Popover Manager
  // =========================================================================

  /**
   * Creates and manages the popover (informational tooltip).
   * Handles rendering, positioning, arrow placement, and auto-side detection.
   *
   * @param {{ getConfig: Function }} configManager
   * @returns {Object}
   */
  function createPopoverManager(configManager) {
    var popoverEl = null;
    var arrowEl = null;
    var currentStep = null;

    function create() {
      if (popoverEl) return;

      popoverEl = document.createElement('div');
      popoverEl.classList.add('tg-popover');
      popoverEl.setAttribute('role', 'dialog');
      popoverEl.setAttribute('aria-modal', 'false');

      if (configManager.getConfig('animate')) {
        popoverEl.classList.add('tg-popover-animated');
      }

      var customClass = configManager.getConfig('popoverClass');
      if (customClass) {
        var classes = customClass.split(' ').filter(Boolean);
        for (var i = 0; i < classes.length; i++) {
          popoverEl.classList.add(classes[i]);
        }
      }

      arrowEl = document.createElement('div');
      arrowEl.classList.add('tg-popover-arrow');
      popoverEl.appendChild(arrowEl);

      document.body.appendChild(popoverEl);
    }

    /**
     * Renders the popover content for a given step.
     * @param {Object} step - The current step object
     * @param {Element|null} targetElement - The highlighted element
     * @param {Object} tourState - { activeIndex, totalSteps, isFirst, isLast }
     */
    function render(step, targetElement, tourState) {
      tourState = tourState || {};
      create();

      currentStep = step;

      var popover = step.popover || {};
      var config = configManager.getConfig();

      // Remove all children except the arrow
      var children = Array.from(popoverEl.children);
      for (var i = 0; i < children.length; i++) {
        if (children[i] !== arrowEl) {
          children[i].remove();
        }
      }

      popoverEl.classList.remove('tg-popover-visible', 'tg-popover-enter');

      var showButtons = popover.showButtons || config.showButtons;

      // Close button
      if (showButtons.indexOf('close') !== -1 && config.allowClose) {
        var closeBtn = document.createElement('button');
        closeBtn.classList.add('tg-popover-btn-close');
        closeBtn.innerHTML = config.closeBtnText;
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.setAttribute('type', 'button');
        popoverEl.appendChild(closeBtn);
      }

      // Title
      if (popover.title) {
        var titleEl = document.createElement('div');
        titleEl.classList.add('tg-popover-title');
        if (typeof popover.title === 'string') {
          titleEl.innerHTML = popover.title;
        } else if (popover.title instanceof Element) {
          titleEl.appendChild(popover.title);
        }
        popoverEl.appendChild(titleEl);
      }

      // Description
      if (popover.description) {
        var descEl = document.createElement('div');
        descEl.classList.add('tg-popover-description');
        if (typeof popover.description === 'string') {
          descEl.innerHTML = popover.description;
        } else if (popover.description instanceof Element) {
          descEl.appendChild(popover.description);
        }
        popoverEl.appendChild(descEl);
      }

      // Footer
      var hasNavButtons = showButtons.indexOf('next') !== -1 || showButtons.indexOf('previous') !== -1;
      var showProgress = popover.showProgress !== undefined ? popover.showProgress : config.showProgress;

      if (hasNavButtons || showProgress) {
        var footerEl = document.createElement('div');
        footerEl.classList.add('tg-popover-footer');

        if (showProgress && tourState.totalSteps > 0) {
          var progressEl = document.createElement('span');
          progressEl.classList.add('tg-popover-progress');
          var progressTemplate = popover.progressText || config.progressText;
          progressEl.textContent = progressTemplate
            .replace('{{current}}', String((tourState.activeIndex || 0) + 1))
            .replace('{{total}}', String(tourState.totalSteps));
          footerEl.appendChild(progressEl);
        }

        var buttonsEl = document.createElement('div');
        buttonsEl.classList.add('tg-popover-buttons');

        if (showButtons.indexOf('previous') !== -1 && !tourState.isFirst) {
          var prevBtn = document.createElement('button');
          prevBtn.classList.add('tg-popover-btn', 'tg-popover-btn-prev');
          prevBtn.innerHTML = config.prevBtnText;
          prevBtn.setAttribute('type', 'button');
          buttonsEl.appendChild(prevBtn);
        }

        if (showButtons.indexOf('next') !== -1) {
          var nextBtn = document.createElement('button');
          if (tourState.isLast) {
            nextBtn.classList.add('tg-popover-btn', 'tg-popover-btn-done');
            nextBtn.innerHTML = config.doneBtnText;
          } else {
            nextBtn.classList.add('tg-popover-btn', 'tg-popover-btn-next');
            nextBtn.innerHTML = config.nextBtnText;
          }
          nextBtn.setAttribute('type', 'button');
          buttonsEl.appendChild(nextBtn);
        }

        footerEl.appendChild(buttonsEl);
        popoverEl.appendChild(footerEl);
      }

      // Hook: onPopoverRender
      var onPopoverRender = popover.onPopoverRender || config.onPopoverRender;
      if (onPopoverRender) {
        try {
          onPopoverRender(popoverEl, { config: config, state: tourState });
        } catch (err) {
          warn(ErrorCodes.HOOK_ERROR, 'Error in onPopoverRender: ' + err.message);
        }
      }

      reposition(targetElement, step);

      requestAnimationFrame(function () {
        if (popoverEl) {
          popoverEl.classList.add('tg-popover-visible', 'tg-popover-enter');
        }
      });
    }

    /**
     * Repositions the popover relative to the target element.
     * Uses getBoundingClientRect for viewport-relative coordinates,
     * which works correctly for elements inside position:fixed containers.
     *
     * @param {Element|null} targetElement
     * @param {Object} [step]
     */
    function reposition(targetElement, step) {
      if (!popoverEl) return;

      var popover = (step && step.popover) || (currentStep && currentStep.popover) || {};
      var offset = configManager.getConfig('popoverOffset');

      // No target element: center in viewport (modal mode)
      if (!targetElement) {
        popoverEl.style.position = 'fixed';
        popoverEl.style.top = '50%';
        popoverEl.style.left = '50%';
        popoverEl.style.transform = 'translate(-50%, -50%)';
        if (arrowEl) arrowEl.style.display = 'none';
        return;
      }

      if (arrowEl) arrowEl.style.display = '';
      popoverEl.style.transform = '';

      var targetRect = targetElement.getBoundingClientRect();

      // Temporarily make popover visible but off-screen to measure it
      popoverEl.style.visibility = 'hidden';
      popoverEl.style.display = 'block';
      popoverEl.style.top = '0';
      popoverEl.style.left = '0';
      var popoverRect = popoverEl.getBoundingClientRect();
      popoverEl.style.visibility = '';

      var side = popover.side || calculateBestSide(targetRect, popoverRect);
      var align = popover.align || 'center';

      var top = 0;
      var left = 0;

      switch (side) {
        case 'top':
          top = targetRect.top - popoverRect.height - offset;
          left = calcAlign(targetRect, popoverRect, align, 'horizontal');
          setArrowClass('top');
          break;
        case 'bottom':
          top = targetRect.bottom + offset;
          left = calcAlign(targetRect, popoverRect, align, 'horizontal');
          setArrowClass('bottom');
          break;
        case 'left':
          top = calcAlign(targetRect, popoverRect, align, 'vertical');
          left = targetRect.left - popoverRect.width - offset;
          setArrowClass('left');
          break;
        case 'right':
          top = calcAlign(targetRect, popoverRect, align, 'vertical');
          left = targetRect.right + offset;
          setArrowClass('right');
          break;
        default:
          top = targetRect.bottom + offset;
          left = calcAlign(targetRect, popoverRect, align, 'horizontal');
          setArrowClass('bottom');
      }

      // Clamp to viewport edges
      var margin = 8;
      top = Math.max(margin, Math.min(top, window.innerHeight - popoverRect.height - margin));
      left = Math.max(margin, Math.min(left, window.innerWidth - popoverRect.width - margin));

      popoverEl.style.position = 'fixed';
      popoverEl.style.top = top + 'px';
      popoverEl.style.left = left + 'px';
    }

    /**
     * Determines the best side to place the popover based on available space.
     */
    function calculateBestSide(targetRect, popoverRect) {
      var spaces = [
        { side: 'bottom', space: window.innerHeight - targetRect.bottom },
        { side: 'top', space: targetRect.top },
        { side: 'right', space: window.innerWidth - targetRect.right },
        { side: 'left', space: targetRect.left },
      ];

      for (var i = 0; i < spaces.length; i++) {
        var s = spaces[i];
        var needed = (s.side === 'top' || s.side === 'bottom') ? popoverRect.height : popoverRect.width;
        if (s.space >= needed + 20) {
          return s.side;
        }
      }

      spaces.sort(function (a, b) { return b.space - a.space; });
      return spaces[0].side;
    }

    /**
     * Calculates the aligned position for a given axis.
     */
    function calcAlign(targetRect, popoverRect, align, axis) {
      if (axis === 'horizontal') {
        switch (align) {
          case 'start': return targetRect.left;
          case 'end': return targetRect.right - popoverRect.width;
          default: return targetRect.left + targetRect.width / 2 - popoverRect.width / 2;
        }
      } else {
        switch (align) {
          case 'start': return targetRect.top;
          case 'end': return targetRect.bottom - popoverRect.height;
          default: return targetRect.top + targetRect.height / 2 - popoverRect.height / 2;
        }
      }
    }

    function setArrowClass(side) {
      if (!arrowEl) return;
      arrowEl.className = 'tg-popover-arrow tg-popover-arrow-' + side;
    }

    function hide() {
      if (popoverEl) {
        popoverEl.classList.remove('tg-popover-visible', 'tg-popover-enter');
      }
    }

    function destroy() {
      if (popoverEl) {
        popoverEl.remove();
        popoverEl = null;
        arrowEl = null;
        currentStep = null;
      }
    }

    function getElement() {
      return popoverEl;
    }

    return {
      render: render,
      reposition: reposition,
      hide: hide,
      destroy: destroy,
      getElement: getElement,
    };
  }

  // =========================================================================
  // MODULE: Highlight Manager
  // =========================================================================

  /**
   * Manages element highlighting: z-index boosting, overlay cutout, scrolling.
   *
   * The key challenge for userscript panels is that the target elements live
   * inside a position:fixed container with a high z-index. The overlay must
   * sit above the page but below the panel, and the popover must sit above
   * everything. This module walks up the DOM tree from the target element
   * to find and temporarily boost the z-index of its fixed/absolute ancestors
   * so they render between the overlay and the popover.
   *
   * @param {{ getConfig: Function }} configManager
   * @param {Object} overlayManager
   * @returns {Object}
   */
  function createHighlightManager(configManager, overlayManager) {
    var activeElement = null;
    var dummyElement = null;
    var boostedElements = [];

    /**
     * Creates an invisible dummy element centered in the viewport.
     * Used for modal-style popovers without a target element.
     * @returns {Element}
     */
    function getOrCreateDummy() {
      if (dummyElement && document.body.contains(dummyElement)) {
        return dummyElement;
      }
      dummyElement = document.createElement('div');
      dummyElement.id = 'tg-dummy-element';
      dummyElement.style.cssText =
        'width:0;height:0;pointer-events:none;opacity:0;position:fixed;top:50%;left:50%;';
      document.body.appendChild(dummyElement);
      return dummyElement;
    }

    /**
     * Boosts the z-index of the target element and its positioned ancestors
     * so they appear above the overlay. Stores originals for cleanup.
     * @param {Element} element
     */
    function boostZIndex(element) {
      clearZIndexBoost();

      if (!element || element.id === 'tg-dummy-element') return;

      var current = element;
      while (current && current !== document.body && current !== document.documentElement) {
        var computedPosition = window.getComputedStyle(current).position;

        boostedElements.push({
          element: current,
          originalZIndex: current.style.zIndex || '',
        });

        current.style.zIndex = String(Z_HIGHLIGHTED);

        // Stop at the first fixed or absolute ancestor (the panel root)
        if (computedPosition === 'fixed' || computedPosition === 'absolute') {
          break;
        }

        current = current.parentElement;
      }
    }

    /**
     * Restores all z-index values that were previously boosted.
     */
    function clearZIndexBoost() {
      for (var i = 0; i < boostedElements.length; i++) {
        boostedElements[i].element.style.zIndex = boostedElements[i].originalZIndex;
      }
      boostedElements = [];
    }

    /**
     * Highlights an element: boosts z-index, scrolls if needed, updates cutout.
     * @param {Element|null} element
     * @returns {Element}
     */
    function highlight(element) {
      var target = element || getOrCreateDummy();
      activeElement = target;

      var config = configManager.getConfig();

      boostZIndex(target);

      if (element && config.smoothScroll) {
        bringIntoView(element, config.scrollIntoViewOptions);
      }

      requestAnimationFrame(function () {
        refresh();
      });

      return target;
    }

    /**
     * Refreshes the overlay cutout position for the currently active element.
     */
    function refresh() {
      if (!activeElement) return;

      if (activeElement.id === 'tg-dummy-element') {
        overlayManager.updateHighlight(null);
        return;
      }

      var config = configManager.getConfig();
      var rect = getElementRect(activeElement, config.stagePadding, config.stageRadius);
      overlayManager.updateHighlight(rect);
    }

    function destroy() {
      clearZIndexBoost();
      if (dummyElement && dummyElement.parentNode) {
        dummyElement.remove();
      }
      dummyElement = null;
      activeElement = null;
    }

    function getActiveElement() {
      return activeElement;
    }

    return {
      highlight: highlight,
      refresh: refresh,
      destroy: destroy,
      getActiveElement: getActiveElement,
    };
  }

  // =========================================================================
  // MODULE: Global Events Manager
  // =========================================================================

  /**
   * Manages global DOM event listeners (keyboard, resize).
   * @param {Object} deps
   * @returns {Object}
   */
  function createEventsManager(deps) {
    var configManager = deps.configManager;
    var stateManager = deps.stateManager;
    var emitter = deps.emitter;
    var boundHandlers = [];

    function addListener(target, event, handler, options) {
      options = options || false;
      target.addEventListener(event, handler, options);
      boundHandlers.push({ target: target, event: event, handler: handler, options: options });
    }

    function init() {
      addListener(document, 'keydown', handleKeydown, true);
      addListener(window, 'resize', handleResize);
    }

    function handleKeydown(e) {
      if (!stateManager.getState('isInitialized')) return;
      if (!configManager.getConfig('allowKeyboardControl')) return;

      switch (e.key) {
        case 'Escape':
          if (configManager.getConfig('allowClose')) {
            e.preventDefault();
            e.stopPropagation();
            emitter.emit('close');
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          e.stopPropagation();
          emitter.emit('next');
          break;
        case 'Tab':
          e.preventDefault();
          e.stopPropagation();
          if (e.shiftKey) {
            emitter.emit('prev');
          } else {
            emitter.emit('next');
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          e.stopPropagation();
          emitter.emit('prev');
          break;
      }
    }

    function handleResize() {
      if (!stateManager.getState('isInitialized')) return;
      emitter.emit('refresh');
    }

    function destroy() {
      for (var i = 0; i < boundHandlers.length; i++) {
        var h = boundHandlers[i];
        h.target.removeEventListener(h.event, h.handler, h.options);
      }
      boundHandlers.length = 0;
    }

    return { init: init, destroy: destroy };
  }

  // =========================================================================
  // MODULE: Click Router
  // =========================================================================

  /**
   * Routes click events from the popover and overlay to the correct actions.
   * @param {Object} deps
   * @returns {Object}
   */
  function createClickRouter(deps) {
    var configManager = deps.configManager;
    var stateManager = deps.stateManager;
    var popoverManager = deps.popoverManager;
    var overlayManager = deps.overlayManager;
    var emitter = deps.emitter;
    var docHandler = null;

    function handleDocumentClick(e) {
      if (!stateManager.getState('isInitialized')) return;

      var popoverEl = popoverManager.getElement();

      if (popoverEl && popoverEl.contains(e.target)) {
        if (
          e.target.classList.contains('tg-popover-btn-next') ||
          e.target.classList.contains('tg-popover-btn-done')
        ) {
          e.preventDefault();
          e.stopPropagation();
          emitter.emit('next');
          return;
        }
        if (e.target.classList.contains('tg-popover-btn-prev')) {
          e.preventDefault();
          e.stopPropagation();
          emitter.emit('prev');
          return;
        }
        if (e.target.classList.contains('tg-popover-btn-close')) {
          e.preventDefault();
          e.stopPropagation();
          emitter.emit('close');
          return;
        }
        return;
      }
    }

    function handleOverlayClick() {
      if (!stateManager.getState('isInitialized')) return;
      if (configManager.getConfig('allowClose')) {
        emitter.emit('close');
      }
    }

    function init() {
      docHandler = function (e) { handleDocumentClick(e); };
      document.addEventListener('click', docHandler, true);
      overlayManager.setClickHandler(handleOverlayClick);
    }

    function destroy() {
      if (docHandler) {
        document.removeEventListener('click', docHandler, true);
        docHandler = null;
      }
      overlayManager.setClickHandler(null);
    }

    return { init: init, destroy: destroy };
  }

  // =========================================================================
  // MAIN MODULE: TamperGuide Driver
  // =========================================================================

  /**
   * Creates a TamperGuide instance.
   *
   * @param {Object} [options={}] - Driver configuration
   * @returns {Object} Public driver API
   */
  function tamperGuide(options) {
    options = options || {};

    validateConfig(options);

    var configManager = createConfigManager(options);
    var stateManager = createStateManager();
    var emitter = createEmitter();
    var overlayManager = createOverlayManager(configManager);
    var popoverManager = createPopoverManager(configManager);
    var highlightManager = createHighlightManager(configManager, overlayManager);

    var eventsManager = null;
    var clickRouter = null;

    // ---- Internal helpers ----

    /**
     * Safely executes a hook function, catching and logging any errors.
     * @param {Function|undefined} hookFn
     * @returns {*}
     */
    function safeHook(hookFn) {
      if (!hookFn) return undefined;
      try {
        var args = Array.prototype.slice.call(arguments, 1);
        return hookFn.apply(null, args);
      } catch (err) {
        warn(ErrorCodes.HOOK_ERROR, 'Error executing hook: ' + err.message);
        return undefined;
      }
    }

    /**
     * Initializes the driver: injects styles, shows overlay, binds events.
     * Does NOT lock body scroll — userscript panels need the page to remain
     * scrollable and interactive underneath.
     */
    function init() {
      if (stateManager.getState('isInitialized')) return;

      injectStyles();
      overlayManager.show();

      stateManager.setState('__focusedBeforeActivation', document.activeElement);

      eventsManager = createEventsManager({
        configManager: configManager,
        stateManager: stateManager,
        popoverManager: popoverManager,
        emitter: emitter,
      });
      eventsManager.init();

      clickRouter = createClickRouter({
        configManager: configManager,
        stateManager: stateManager,
        popoverManager: popoverManager,
        overlayManager: overlayManager,
        emitter: emitter,
      });
      clickRouter.init();

      emitter.on('next', handleNext);
      emitter.on('prev', handlePrev);
      emitter.on('close', handleClose);
      emitter.on('refresh', handleRefresh);

      stateManager.setState('isInitialized', true);
    }

    /**
     * Highlights a specific tour step by index.
     * @param {number} stepIndex
     */
    function highlightStep(stepIndex) {
      var steps = configManager.getConfig('steps');

      if (!steps || steps.length === 0) {
        throw new TamperGuideError(
          ErrorCodes.NO_STEPS,
          'No steps configured. Add steps via: tamperGuide({ steps: [...] }) ' +
          'or use setSteps([...]) before calling drive().'
        );
      }

      if (stepIndex < 0 || stepIndex >= steps.length) {
        throw new TamperGuideError(
          ErrorCodes.INVALID_STEP_INDEX,
          'Invalid step index: ' + stepIndex + '. Valid range: 0 to ' + (steps.length - 1) + '.'
        );
      }

      if (stateManager.getState('__transitionInProgress')) return;
      stateManager.setState('__transitionInProgress', true);

      var step = steps[stepIndex];
      var previousStep = stateManager.getState('activeStep');
      var previousElement = stateManager.getState('activeElement');

      // Fire onDeselected for the previous step
      if (previousStep && previousElement) {
        var deselectedHook = previousStep.onDeselected || configManager.getConfig('onDeselected');
        safeHook(deselectedHook, previousElement, previousStep, {
          config: configManager.getConfig(),
          state: stateManager.getState(),
          driver: api,
        });
      }

      var element = resolveElement(step.element);

      // Fire onHighlightStarted
      var highlightStartedHook = step.onHighlightStarted || configManager.getConfig('onHighlightStarted');
      safeHook(highlightStartedHook, element, step, {
        config: configManager.getConfig(),
        state: stateManager.getState(),
        driver: api,
      });

      stateManager.setState('previousStep', previousStep);
      stateManager.setState('previousElement', previousElement);
      stateManager.setState('activeStep', step);
      stateManager.setState('activeIndex', stepIndex);

      var highlightedElement = highlightManager.highlight(element);
      stateManager.setState('activeElement', highlightedElement);

      popoverManager.hide();

      var tourState = {
        activeIndex: stepIndex,
        totalSteps: steps.length,
        isFirst: stepIndex === 0,
        isLast: stepIndex === steps.length - 1,
      };

      var delay = configManager.getConfig('animate') ? 300 : 50;
      setTimeout(function () {
        if (!stateManager.getState('isInitialized')) return;

        if (step.popover) {
          popoverManager.render(step, element, tourState);
        }

        var highlightedHook = step.onHighlighted || configManager.getConfig('onHighlighted');
        safeHook(highlightedHook, highlightedElement, step, {
          config: configManager.getConfig(),
          state: stateManager.getState(),
          driver: api,
        });

        stateManager.setState('__transitionInProgress', false);
      }, delay);
    }

    // ---- Navigation handlers ----

    function handleNext() {
      if (stateManager.getState('__transitionInProgress')) return;

      var config = configManager.getConfig();
      var currentIndex = stateManager.getState('activeIndex');
      var steps = config.steps || [];
      var activeStep = stateManager.getState('activeStep');
      var activeElement = stateManager.getState('activeElement');

      var onNextClick = (activeStep && activeStep.popover && activeStep.popover.onNextClick) || config.onNextClick;
      if (onNextClick) {
        var result = safeHook(onNextClick, activeElement, activeStep, {
          config: config,
          state: stateManager.getState(),
          driver: api,
        });
        if (result === false) return;
      }

      if (currentIndex !== undefined && currentIndex < steps.length - 1) {
        highlightStep(currentIndex + 1);
      } else {
        performDestroy(false);
      }
    }

    function handlePrev() {
      if (stateManager.getState('__transitionInProgress')) return;

      var config = configManager.getConfig();
      var currentIndex = stateManager.getState('activeIndex');
      var activeStep = stateManager.getState('activeStep');
      var activeElement = stateManager.getState('activeElement');

      var onPrevClick = (activeStep && activeStep.popover && activeStep.popover.onPrevClick) || config.onPrevClick;
      if (onPrevClick) {
        var result = safeHook(onPrevClick, activeElement, activeStep, {
          config: config,
          state: stateManager.getState(),
          driver: api,
        });
        if (result === false) return;
      }

      if (currentIndex !== undefined && currentIndex > 0) {
        highlightStep(currentIndex - 1);
      }
    }

    function handleClose() {
      if (stateManager.getState('__transitionInProgress')) return;

      var config = configManager.getConfig();
      var activeStep = stateManager.getState('activeStep');
      var activeElement = stateManager.getState('activeElement');

      var onCloseClick = (activeStep && activeStep.popover && activeStep.popover.onCloseClick) || config.onCloseClick;
      if (onCloseClick) {
        var result = safeHook(onCloseClick, activeElement, activeStep, {
          config: config,
          state: stateManager.getState(),
          driver: api,
        });
        if (result === false) return;
      }

      performDestroy(true);
    }

    function handleRefresh() {
      highlightManager.refresh();
      overlayManager.handleResize();

      var activeElement = stateManager.getState('activeElement');
      var activeStep = stateManager.getState('activeStep');
      if (activeElement && activeStep) {
        popoverManager.reposition(activeElement, activeStep);
      }
    }

    /**
     * Performs the full destroy sequence.
     * @param {boolean} withDestroyStartedHook
     */
    function performDestroy(withDestroyStartedHook) {
      var config = configManager.getConfig();
      var activeElement = stateManager.getState('activeElement');
      var activeStep = stateManager.getState('activeStep');
      var focusedBefore = stateManager.getState('__focusedBeforeActivation');

      if (withDestroyStartedHook) {
        var onDestroyStarted = config.onDestroyStarted;
        if (onDestroyStarted) {
          var result = safeHook(onDestroyStarted, activeElement, activeStep, {
            config: config,
            state: stateManager.getState(),
            driver: api,
          });
          if (result === false) return;
        }
      }

      if (activeStep) {
        var deselectedHook = activeStep.onDeselected || config.onDeselected;
        safeHook(deselectedHook, activeElement, activeStep, {
          config: config,
          state: stateManager.getState(),
          driver: api,
        });
      }

      popoverManager.destroy();
      highlightManager.destroy();
      overlayManager.destroy();

      if (eventsManager) {
        eventsManager.destroy();
        eventsManager = null;
      }

      if (clickRouter) {
        clickRouter.destroy();
        clickRouter = null;
      }

      emitter.destroy();

      var destroyedStep = activeStep;
      var destroyedElement = activeElement;
      stateManager.resetState();

      if (destroyedStep) {
        safeHook(config.onDestroyed, destroyedElement, destroyedStep, {
          config: config,
          state: {},
          driver: api,
        });
      }

      if (focusedBefore && typeof focusedBefore.focus === 'function') {
        try {
          focusedBefore.focus();
        } catch (e) {
          // Element may no longer exist
        }
      }
    }

    // ---- Public API ----

    var api = {
      /** Returns whether the tour is currently active. */
      isActive: function () {
        return stateManager.getState('isInitialized') || false;
      },

      /** Refreshes highlight and popover positions. */
      refresh: function () {
        if (!stateManager.getState('isInitialized')) return;
        handleRefresh();
      },

      /** Starts the tour from a specific step index. */
      drive: function (stepIndex) {
        stepIndex = stepIndex || 0;
        init();
        highlightStep(stepIndex);
      },

      /** Advances to the next step. */
      moveNext: function () {
        handleNext();
      },

      /** Goes back to the previous step. */
      movePrevious: function () {
        handlePrev();
      },

      /** Moves directly to a specific step index. */
      moveTo: function (stepIndex) {
        if (!stateManager.getState('isInitialized')) {
          init();
        }
        highlightStep(stepIndex);
      },

      hasNextStep: function () {
        var steps = configManager.getConfig('steps') || [];
        var activeIndex = stateManager.getState('activeIndex');
        return activeIndex !== undefined && activeIndex < steps.length - 1;
      },

      hasPreviousStep: function () {
        var activeIndex = stateManager.getState('activeIndex');
        return activeIndex !== undefined && activeIndex > 0;
      },

      isFirstStep: function () {
        return stateManager.getState('activeIndex') === 0;
      },

      isLastStep: function () {
        var steps = configManager.getConfig('steps') || [];
        var activeIndex = stateManager.getState('activeIndex');
        return activeIndex !== undefined && activeIndex === steps.length - 1;
      },

      getActiveIndex: function () {
        return stateManager.getState('activeIndex');
      },

      getActiveStep: function () {
        return stateManager.getState('activeStep');
      },

      getActiveElement: function () {
        return stateManager.getState('activeElement');
      },

      getPreviousElement: function () {
        return stateManager.getState('previousElement');
      },

      getPreviousStep: function () {
        return stateManager.getState('previousStep');
      },

      /**
       * Highlights a single element without starting a tour.
       * @param {Object} step - Step object with element and optional popover
       */
      highlight: function (step) {
        if (!step || typeof step !== 'object') {
          throw new TamperGuideError(
            ErrorCodes.INVALID_STEP,
            'highlight() requires a step object. Example: { element: "#el", popover: { title: "Hi" } }'
          );
        }

        init();

        var element = resolveElement(step.element);
        var highlightedElement = highlightManager.highlight(element);

        stateManager.setState('activeStep', step);
        stateManager.setState('activeElement', highlightedElement);
        stateManager.setState('activeIndex', undefined);

        var delay = configManager.getConfig('animate') ? 300 : 50;
        setTimeout(function () {
          if (!stateManager.getState('isInitialized')) return;

          if (step.popover) {
            popoverManager.render(step, element, {
              activeIndex: 0,
              totalSteps: 0,
              isFirst: true,
              isLast: true,
            });
          }
        }, delay);
      },

      setConfig: function (config) {
        configManager.setConfig(config);
      },

      setSteps: function (steps) {
        if (!Array.isArray(steps)) {
          throw new TamperGuideError(
            ErrorCodes.INVALID_CONFIG,
            'setSteps() requires an Array. Received: ' + typeof steps
          );
        }
        for (var i = 0; i < steps.length; i++) {
          validateStep(steps[i], i);
        }
        stateManager.resetState();
        configManager.setConfig({ steps: steps });
      },

      getConfig: function (key) {
        return configManager.getConfig(key);
      },

      getState: function (key) {
        return stateManager.getState(key);
      },

      /** Destroys the tour: removes overlay, popover, restores z-indexes. */
      destroy: function () {
        performDestroy(false);
      },
    };

    return api;
  }

  // =========================================================================
  // GLOBAL EXPORT
  // =========================================================================

  if (typeof window !== 'undefined') {
    window.tamperGuide = tamperGuide;
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.tamperGuide = tamperGuide;
  }

})();