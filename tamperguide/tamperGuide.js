// ==UserScript==
// @name         TamperGuide
// @namespace    https://github.com/UNKchr/tamperguide
// @version      1.2.0
// @author       UNKchr
// @description  Lightweight library for product tours, highlights, and contextual help in Tampermonkey userscripts.
// @license      MIT
// ==/UserScript==

// ===========================================================================
// TamperGuide v1.2.0
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
  });

  function warn(code, message) {
    console.warn('[TamperGuide:' + code + '] ' + message);
  }

  function validateConfig(config) {
    if (config === null || typeof config !== 'object') {
      throw new TamperGuideError(
        ErrorCodes.INVALID_CONFIG,
        'Configuration must be an object. Received: ' + typeof config
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
          '"steps" must be an Array. Received: ' + typeof config.steps
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
          '"showButtons" must be an Array. Received: ' + typeof config.showButtons
        );
      }
      var validButtons = ['next', 'previous', 'close'];
      for (var b = 0; b < config.showButtons.length; b++) {
        if (validButtons.indexOf(config.showButtons[b]) === -1) {
          throw new TamperGuideError(
            ErrorCodes.INVALID_CONFIG,
            'Unknown button: "' + config.showButtons[b] + '". Valid: ' + validButtons.join(', ')
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

  function validateStep(step, index) {
    if (step === null || typeof step !== 'object') {
      throw new TamperGuideError(
        ErrorCodes.INVALID_STEP,
        'Step at index ' + index + ' must be an object.'
      );
    }

    if (step.element !== undefined) {
      var elementType = typeof step.element;
      if (elementType !== 'string' && elementType !== 'function' && !(step.element instanceof Element)) {
        throw new TamperGuideError(
          ErrorCodes.INVALID_STEP,
          '"element" in step ' + index + ' must be a string, function, or Element.'
        );
      }
      if (elementType === 'string' && step.element.trim() === '') {
        throw new TamperGuideError(
          ErrorCodes.INVALID_STEP,
          '"element" in step ' + index + ' is empty.'
        );
      }
    }

    if (step.popover !== undefined) {
      if (typeof step.popover !== 'object' || step.popover === null) {
        throw new TamperGuideError(
          ErrorCodes.INVALID_STEP,
          '"popover" in step ' + index + ' must be an object.'
        );
      }
      var validSides = ['top', 'right', 'bottom', 'left'];
      if (step.popover.side && validSides.indexOf(step.popover.side) === -1) {
        throw new TamperGuideError(
          ErrorCodes.INVALID_STEP,
          '"popover.side" in step ' + index + ': "' + step.popover.side + '". Valid: ' + validSides.join(', ')
        );
      }
      var validAligns = ['start', 'center', 'end'];
      if (step.popover.align && validAligns.indexOf(step.popover.align) === -1) {
        throw new TamperGuideError(
          ErrorCodes.INVALID_STEP,
          '"popover.align" in step ' + index + ': "' + step.popover.align + '". Valid: ' + validAligns.join(', ')
        );
      }
    }

    if (!step.element && !step.popover) {
      throw new TamperGuideError(
        ErrorCodes.INVALID_STEP,
        'Step ' + index + ' needs at least "element" or "popover".'
      );
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

    function getState(key) {
      if (key !== undefined) return state[key];
      var copy = {};
      for (var k in state) { copy[k] = state[k]; }
      return copy;
    }

    function setState(key, value) { state[key] = value; }

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

  function createConfigManager(userConfig) {
    var config = {};
    var dk = Object.keys(DEFAULT_CONFIG);
    for (var i = 0; i < dk.length; i++) { config[dk[i]] = DEFAULT_CONFIG[dk[i]]; }
    var uk = Object.keys(userConfig);
    for (var j = 0; j < uk.length; j++) { config[uk[j]] = userConfig[uk[j]]; }

    function getConfig(key) {
      if (key !== undefined) return config[key];
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

  function createEmitter() {
    var listeners = {};

    function on(event, callback) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(callback);
    }

    function off(event, callback) {
      if (!listeners[event]) return;
      var idx = listeners[event].indexOf(callback);
      if (idx > -1) listeners[event].splice(idx, 1);
    }

    function emit(event) {
      if (!listeners[event]) return;
      var args = Array.prototype.slice.call(arguments, 1);
      var cbs = listeners[event].slice();
      for (var i = 0; i < cbs.length; i++) {
        try { cbs[i].apply(null, args); }
        catch (err) { warn(ErrorCodes.HOOK_ERROR, 'Listener error: ' + err.message); }
      }
    }

    function destroy() { listeners = {}; }

    return { on: on, off: off, emit: emit, destroy: destroy };
  }

  // =========================================================================
  // MODULE: CSS Styles
  // =========================================================================

  var STYLE_ID = 'tamperguide-styles';
  var Z_OVERLAY = 2147483644;
  var Z_HIGHLIGHTED = 2147483645;
  var Z_POPOVER = 2147483646;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var css = [
      '.tg-overlay {',
      '  position: fixed; inset: 0;',
      '  z-index: ' + Z_OVERLAY + ';',
      '  pointer-events: none;',
      '  transition: opacity 0.3s ease;',
      '}',
      '.tg-overlay svg { position: absolute; inset: 0; width: 100%; height: 100%; }',
      '.tg-overlay-clickable { pointer-events: auto; cursor: default; }',
      '',
      '.tg-popover {',
      '  all: initial;',
      '  position: fixed;',
      '  z-index: ' + Z_POPOVER + ';',
      '  background: #fff;',
      '  color: #1a1a2e;',
      '  border-radius: 8px;',
      '  box-shadow: 0 8px 32px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.1);',
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
      '.tg-popover *, .tg-popover *::before, .tg-popover *::after { box-sizing: border-box; }',
      '.tg-popover-visible { opacity: 1; }',
      '.tg-popover-animated { transition: opacity 0.25s ease, transform 0.25s ease; }',
      '',
      '/* Arrow base — positioned dynamically via JS */',
      '.tg-popover-arrow {',
      '  position: absolute;',
      '  width: 12px; height: 12px;',
      '  background: #fff;',
      '  transform: rotate(45deg);',
      '  z-index: -1;',
      '}',
      '',
      '.tg-popover-title {',
      '  display: block; font-size: 16px; font-weight: 700;',
      '  margin: 0 0 8px 0; padding: 0; color: #0f0f23; line-height: 1.3;',
      '}',
      '.tg-popover-description {',
      '  display: block; font-size: 14px; font-weight: 400;',
      '  margin: 0 0 16px 0; padding: 0; color: #4a4a6a; line-height: 1.6;',
      '}',
      '.tg-popover-description:last-child { margin-bottom: 0; }',
      '',
      '.tg-popover-footer {',
      '  display: flex; align-items: center; justify-content: space-between;',
      '  gap: 8px; margin-top: 4px;',
      '}',
      '.tg-popover-progress { font-size: 12px; color: #8888aa; font-weight: 500; flex-shrink: 0; }',
      '.tg-popover-buttons { display: flex; gap: 6px; margin-left: auto; }',
      '.tg-popover-btn {',
      '  display: inline-flex; align-items: center; justify-content: center;',
      '  border: none; border-radius: 6px; padding: 6px 14px;',
      '  font-size: 13px; font-weight: 600; cursor: pointer;',
      '  transition: background-color 0.15s ease, transform 0.1s ease;',
      '  font-family: inherit; line-height: 1.4; white-space: nowrap;',
      '  text-decoration: none; outline: none;',
      '}',
      '.tg-popover-btn:active { transform: scale(0.96); }',
      '.tg-popover-btn:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }',
      '.tg-popover-btn-prev { background: #f0f0f5; color: #4a4a6a; }',
      '.tg-popover-btn-prev:hover { background: #e0e0ea; }',
      '.tg-popover-btn-next, .tg-popover-btn-done { background: #3b82f6; color: #fff; }',
      '.tg-popover-btn-next:hover, .tg-popover-btn-done:hover { background: #2563eb; }',
      '.tg-popover-btn-close {',
      '  position: absolute; top: 8px; right: 8px; background: transparent;',
      '  border: none; font-size: 18px; color: #aaa; cursor: pointer;',
      '  padding: 2px 6px; border-radius: 4px; line-height: 1;',
      '  transition: color 0.15s ease, background-color 0.15s ease;',
      '  text-decoration: none; outline: none;',
      '}',
      '.tg-popover-btn-close:hover { color: #333; background: #f0f0f5; }',
      '.tg-popover-btn-close:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }',
      '',
      '@keyframes tg-fadeIn {',
      '  from { opacity: 0; transform: translateY(4px); }',
      '  to { opacity: 1; transform: translateY(0); }',
      '}',
      '.tg-popover-enter { animation: tg-fadeIn 0.25s ease forwards; }',
    ].join('\n');

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function removeStyles() {
    var el = document.getElementById(STYLE_ID);
    if (el) el.remove();
  }

  // =========================================================================
  // MODULE: DOM Utilities
  // =========================================================================

  function resolveElement(element) {
    if (!element) return null;
    try {
      if (typeof element === 'function') {
        var result = element();
        if (result instanceof Element) return result;
        warn(ErrorCodes.ELEMENT_NOT_FOUND, 'element() did not return a DOM Element.');
        return null;
      }
      if (element instanceof Element) {
        return document.body.contains(element) ? element : null;
      }
      if (typeof element === 'string') {
        var found = document.querySelector(element);
        if (!found) {
          warn(ErrorCodes.ELEMENT_NOT_FOUND, 'No element found for selector "' + element + '".');
        }
        return found;
      }
    } catch (err) {
      warn(ErrorCodes.ELEMENT_NOT_FOUND, 'Error resolving element: ' + err.message);
    }
    return null;
  }

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

  function bringIntoView(element, options) {
    if (!element || typeof element.scrollIntoView !== 'function') return;
    if (isInsideFixedContainer(element)) return;
    options = options || { behavior: 'smooth', block: 'center' };
    try {
      var rect = element.getBoundingClientRect();
      var isVisible =
        rect.top >= 0 && rect.left >= 0 &&
        rect.bottom <= window.innerHeight && rect.right <= window.innerWidth;
      if (!isVisible) element.scrollIntoView(options);
    } catch (err) {
      warn('SCROLL', 'Could not scroll: ' + err.message);
    }
  }

  function isInsideFixedContainer(element) {
    var current = element;
    while (current && current !== document.body && current !== document.documentElement) {
      if (window.getComputedStyle(current).position === 'fixed') return true;
      current = current.parentElement;
    }
    return false;
  }

  // =========================================================================
  // MODULE: Overlay Manager (SVG cutout)
  // =========================================================================

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
        if (e.target.classList.contains('tg-overlay-clickable') || e.target.closest('.tg-overlay-clickable')) {
          if (clickHandler) clickHandler(e);
        }
      });
      refreshSVG(null);
    }

    function refreshSVG(rect) {
      if (!svgEl) return;
      var w = window.innerWidth;
      var h = window.innerHeight;
      var color = configManager.getConfig('overlayColor');
      var opacity = configManager.getConfig('overlayOpacity');

      svgEl.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      svgEl.setAttribute('width', String(w));
      svgEl.setAttribute('height', String(h));

      if (!rect) {
        svgEl.innerHTML =
          '<rect x="0" y="0" width="' + w + '" height="' + h + '" ' +
          'fill="' + color + '" fill-opacity="' + opacity + '" ' +
          'class="tg-overlay-clickable" />';
        return;
      }

      currentRect = rect;

      // Clamp cutout to viewport
      var cx = Math.max(0, rect.x);
      var cy = Math.max(0, rect.y);
      var cw = Math.min(rect.width, w - cx);
      var ch = Math.min(rect.height, h - cy);
      var cr = Math.min(rect.radius || 0, cw / 2, ch / 2);

      // Full-viewport outer rectangle
      var outer = 'M 0 0 H ' + w + ' V ' + h + ' H 0 Z';

      // Inner cutout (the transparent hole)
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
          ' Q ' + cx + ' ' + cy + ' ' + (cx + cr) + ' ' + cy +
          ' Z';
      } else {
        inner = 'M ' + cx + ' ' + cy + ' H ' + (cx + cw) + ' V ' + (cy + ch) + ' H ' + cx + ' Z';
      }

      svgEl.innerHTML =
        '<path d="' + outer + ' ' + inner + '" ' +
        'fill-rule="evenodd" fill="' + color + '" fill-opacity="' + opacity + '" ' +
        'class="tg-overlay-clickable" />';
    }

    function show() { create(); if (overlayEl) overlayEl.style.opacity = '1'; }
    function updateHighlight(rect) { if (!overlayEl) create(); refreshSVG(rect); }
    function handleResize() { refreshSVG(currentRect); }
    function hide() { if (overlayEl) overlayEl.style.opacity = '0'; }
    function destroy() {
      if (overlayEl) { overlayEl.remove(); overlayEl = null; svgEl = null; currentRect = null; }
    }
    function getElement() { return overlayEl; }
    function setClickHandler(handler) { clickHandler = handler; }

    return {
      show: show, updateHighlight: updateHighlight, handleResize: handleResize,
      hide: hide, destroy: destroy, getElement: getElement, setClickHandler: setClickHandler,
    };
  }

  // =========================================================================
  // MODULE: Popover Manager
  // =========================================================================

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
      if (configManager.getConfig('animate')) popoverEl.classList.add('tg-popover-animated');
      var customClass = configManager.getConfig('popoverClass');
      if (customClass) {
        var classes = customClass.split(' ').filter(Boolean);
        for (var i = 0; i < classes.length; i++) popoverEl.classList.add(classes[i]);
      }
      arrowEl = document.createElement('div');
      arrowEl.classList.add('tg-popover-arrow');
      popoverEl.appendChild(arrowEl);
      document.body.appendChild(popoverEl);
    }

    function render(step, targetElement, tourState) {
      tourState = tourState || {};
      create();
      currentStep = step;

      var popover = step.popover || {};
      var config = configManager.getConfig();

      // Remove all children except arrow
      var children = Array.from(popoverEl.children);
      for (var i = 0; i < children.length; i++) {
        if (children[i] !== arrowEl) children[i].remove();
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
        if (typeof popover.title === 'string') titleEl.innerHTML = popover.title;
        else if (popover.title instanceof Element) titleEl.appendChild(popover.title);
        popoverEl.appendChild(titleEl);
      }

      // Description
      if (popover.description) {
        var descEl = document.createElement('div');
        descEl.classList.add('tg-popover-description');
        if (typeof popover.description === 'string') descEl.innerHTML = popover.description;
        else if (popover.description instanceof Element) descEl.appendChild(popover.description);
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
          var tmpl = popover.progressText || config.progressText;
          progressEl.textContent = tmpl
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

      var onPopoverRender = popover.onPopoverRender || config.onPopoverRender;
      if (onPopoverRender) {
        try { onPopoverRender(popoverEl, { config: config, state: tourState }); }
        catch (err) { warn(ErrorCodes.HOOK_ERROR, 'onPopoverRender error: ' + err.message); }
      }

      reposition(targetElement, step);

      requestAnimationFrame(function () {
        if (popoverEl) popoverEl.classList.add('tg-popover-visible', 'tg-popover-enter');
      });
    }

    /**
     * Positions the popover relative to the target element and places
     * the arrow so it points at the center of the target element.
     *
     * The arrow is positioned dynamically using pixel values calculated
     * from the target element's bounding rect. This replaces the old
     * approach of fixed CSS classes with 50% offsets, which broke when
     * the popover was not centered on the target.
     */
    function reposition(targetElement, step) {
      if (!popoverEl) return;

      var popover = (step && step.popover) || (currentStep && currentStep.popover) || {};
      var offset = configManager.getConfig('popoverOffset');

      // No target: center in viewport (modal mode)
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
        // Reset all arrow positioning
        arrowEl.style.top = '';
        arrowEl.style.bottom = '';
        arrowEl.style.left = '';
        arrowEl.style.right = '';
        arrowEl.style.marginLeft = '';
        arrowEl.style.marginTop = '';
        arrowEl.className = 'tg-popover-arrow';
      }
      popoverEl.style.transform = '';

      var targetRect = targetElement.getBoundingClientRect();

      // Measure popover off-screen
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
          break;
        case 'bottom':
          top = targetRect.bottom + offset;
          left = calcAlign(targetRect, popoverRect, align, 'horizontal');
          break;
        case 'left':
          top = calcAlign(targetRect, popoverRect, align, 'vertical');
          left = targetRect.left - popoverRect.width - offset;
          break;
        case 'right':
          top = calcAlign(targetRect, popoverRect, align, 'vertical');
          left = targetRect.right + offset;
          break;
        default:
          top = targetRect.bottom + offset;
          left = calcAlign(targetRect, popoverRect, align, 'horizontal');
          side = 'bottom';
      }

      // Clamp to viewport
      var margin = 8;
      var clampedTop = Math.max(margin, Math.min(top, window.innerHeight - popoverRect.height - margin));
      var clampedLeft = Math.max(margin, Math.min(left, window.innerWidth - popoverRect.width - margin));

      popoverEl.style.position = 'fixed';
      popoverEl.style.top = clampedTop + 'px';
      popoverEl.style.left = clampedLeft + 'px';

      // Position the arrow so it points at the center of the target element.
      // The arrow must account for the clamped position of the popover.
      if (arrowEl) {
        positionArrow(side, targetRect, clampedTop, clampedLeft, popoverRect);
      }
    }

    /**
     * Positions the arrow element to point at the center of the target.
     *
     * For top/bottom sides, the arrow is placed horizontally so it aligns
     * with the horizontal center of the target element, clamped to stay
     * within the popover bounds.
     *
     * For left/right sides, the arrow is placed vertically so it aligns
     * with the vertical center of the target element.
     *
     * @param {string} side - Which side of the target the popover is on
     * @param {DOMRect} targetRect - Target element bounding rect
     * @param {number} popoverTop - Final top position of the popover
     * @param {number} popoverLeft - Final left position of the popover
     * @param {DOMRect} popoverRect - Popover bounding rect (for width/height)
     */
    function positionArrow(side, targetRect, popoverTop, popoverLeft, popoverRect) {
      var arrowSize = 12;
      var halfArrow = arrowSize / 2;
      var arrowMin = 12; // Minimum distance from popover edge
      var arrowMax;

      if (side === 'top' || side === 'bottom') {
        // Arrow on horizontal axis
        var targetCenterX = targetRect.left + targetRect.width / 2;
        var arrowLeft = targetCenterX - popoverLeft - halfArrow;

        // Clamp within popover width
        arrowMax = popoverRect.width - arrowMin - arrowSize;
        arrowLeft = Math.max(arrowMin, Math.min(arrowLeft, arrowMax));

        arrowEl.style.left = arrowLeft + 'px';

        if (side === 'top') {
          // Popover is above target, arrow points down from bottom
          arrowEl.style.bottom = -halfArrow + 'px';
          arrowEl.style.boxShadow = '2px 2px 4px rgba(0,0,0,0.05)';
        } else {
          // Popover is below target, arrow points up from top
          arrowEl.style.top = -halfArrow + 'px';
          arrowEl.style.boxShadow = '-2px -2px 4px rgba(0,0,0,0.05)';
        }
      } else {
        // Arrow on vertical axis
        var targetCenterY = targetRect.top + targetRect.height / 2;
        var arrowTop = targetCenterY - popoverTop - halfArrow;

        arrowMax = popoverRect.height - arrowMin - arrowSize;
        arrowTop = Math.max(arrowMin, Math.min(arrowTop, arrowMax));

        arrowEl.style.top = arrowTop + 'px';

        if (side === 'left') {
          // Popover is to the left, arrow points right
          arrowEl.style.right = -halfArrow + 'px';
          arrowEl.style.boxShadow = '2px -2px 4px rgba(0,0,0,0.05)';
        } else {
          // Popover is to the right, arrow points left
          arrowEl.style.left = -halfArrow + 'px';
          arrowEl.style.boxShadow = '-2px 2px 4px rgba(0,0,0,0.05)';
        }
      }
    }

    function calculateBestSide(targetRect, popoverRect) {
      var spaces = [
        { side: 'bottom', space: window.innerHeight - targetRect.bottom },
        { side: 'top', space: targetRect.top },
        { side: 'right', space: window.innerWidth - targetRect.right },
        { side: 'left', space: targetRect.left },
      ];
      for (var i = 0; i < spaces.length; i++) {
        var needed = (spaces[i].side === 'top' || spaces[i].side === 'bottom')
          ? popoverRect.height : popoverRect.width;
        if (spaces[i].space >= needed + 20) return spaces[i].side;
      }
      spaces.sort(function (a, b) { return b.space - a.space; });
      return spaces[0].side;
    }

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
  // MODULE: Highlight Manager
  // =========================================================================

  function createHighlightManager(configManager, overlayManager) {
    var activeElement = null;
    var dummyElement = null;
    var boostedElements = [];

    function getOrCreateDummy() {
      if (dummyElement && document.body.contains(dummyElement)) return dummyElement;
      dummyElement = document.createElement('div');
      dummyElement.id = 'tg-dummy-element';
      dummyElement.style.cssText =
        'width:0;height:0;pointer-events:none;opacity:0;position:fixed;top:50%;left:50%;';
      document.body.appendChild(dummyElement);
      return dummyElement;
    }

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
        if (computedPosition === 'fixed' || computedPosition === 'absolute') break;
        current = current.parentElement;
      }
    }

    function clearZIndexBoost() {
      for (var i = 0; i < boostedElements.length; i++) {
        boostedElements[i].element.style.zIndex = boostedElements[i].originalZIndex;
      }
      boostedElements = [];
    }

    function highlight(element) {
      var target = element || getOrCreateDummy();
      activeElement = target;
      var config = configManager.getConfig();
      boostZIndex(target);
      if (element && config.smoothScroll) {
        bringIntoView(element, config.scrollIntoViewOptions);
      }
      // Use two rAF frames to ensure the browser has painted the z-index changes
      // before we read getBoundingClientRect for the cutout position.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          refresh();
        });
      });
      return target;
    }

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
      if (dummyElement && dummyElement.parentNode) dummyElement.remove();
      dummyElement = null;
      activeElement = null;
    }

    function getActiveElement() { return activeElement; }

    return { highlight: highlight, refresh: refresh, destroy: destroy, getActiveElement: getActiveElement };
  }

  // =========================================================================
  // MODULE: Events Manager
  // =========================================================================

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
          if (configManager.getConfig('allowClose')) { e.preventDefault(); e.stopPropagation(); emitter.emit('close'); }
          break;
        case 'ArrowRight':
          e.preventDefault(); e.stopPropagation(); emitter.emit('next'); break;
        case 'Tab':
          e.preventDefault(); e.stopPropagation();
          if (e.shiftKey) emitter.emit('prev'); else emitter.emit('next'); break;
        case 'ArrowLeft':
          e.preventDefault(); e.stopPropagation(); emitter.emit('prev'); break;
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
        if (e.target.classList.contains('tg-popover-btn-next') || e.target.classList.contains('tg-popover-btn-done')) {
          e.preventDefault(); e.stopPropagation(); emitter.emit('next'); return;
        }
        if (e.target.classList.contains('tg-popover-btn-prev')) {
          e.preventDefault(); e.stopPropagation(); emitter.emit('prev'); return;
        }
        if (e.target.classList.contains('tg-popover-btn-close')) {
          e.preventDefault(); e.stopPropagation(); emitter.emit('close'); return;
        }
      }
    }

    function handleOverlayClick() {
      if (!stateManager.getState('isInitialized')) return;
      if (configManager.getConfig('allowClose')) emitter.emit('close');
    }

    function init() {
      docHandler = function (e) { handleDocumentClick(e); };
      document.addEventListener('click', docHandler, true);
      overlayManager.setClickHandler(handleOverlayClick);
    }

    function destroy() {
      if (docHandler) { document.removeEventListener('click', docHandler, true); docHandler = null; }
      overlayManager.setClickHandler(null);
    }

    return { init: init, destroy: destroy };
  }

  // =========================================================================
  // MAIN: TamperGuide Driver
  // =========================================================================

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

    function safeHook(hookFn) {
      if (!hookFn) return undefined;
      try {
        var args = Array.prototype.slice.call(arguments, 1);
        return hookFn.apply(null, args);
      } catch (err) {
        warn(ErrorCodes.HOOK_ERROR, 'Hook error: ' + err.message);
        return undefined;
      }
    }

    function init() {
      if (stateManager.getState('isInitialized')) return;
      injectStyles();
      overlayManager.show();
      stateManager.setState('__focusedBeforeActivation', document.activeElement);
      eventsManager = createEventsManager({
        configManager: configManager, stateManager: stateManager,
        popoverManager: popoverManager, emitter: emitter,
      });
      eventsManager.init();
      clickRouter = createClickRouter({
        configManager: configManager, stateManager: stateManager,
        popoverManager: popoverManager, overlayManager: overlayManager, emitter: emitter,
      });
      clickRouter.init();
      emitter.on('next', handleNext);
      emitter.on('prev', handlePrev);
      emitter.on('close', handleClose);
      emitter.on('refresh', handleRefresh);
      stateManager.setState('isInitialized', true);
    }

    function highlightStep(stepIndex) {
      var steps = configManager.getConfig('steps');
      if (!steps || steps.length === 0) {
        throw new TamperGuideError(ErrorCodes.NO_STEPS, 'No steps configured.');
      }
      if (stepIndex < 0 || stepIndex >= steps.length) {
        throw new TamperGuideError(ErrorCodes.INVALID_STEP_INDEX, 'Invalid index: ' + stepIndex);
      }
      if (stateManager.getState('__transitionInProgress')) return;
      stateManager.setState('__transitionInProgress', true);

      var step = steps[stepIndex];
      var previousStep = stateManager.getState('activeStep');
      var previousElement = stateManager.getState('activeElement');

      if (previousStep && previousElement) {
        var deselectedHook = previousStep.onDeselected || configManager.getConfig('onDeselected');
        safeHook(deselectedHook, previousElement, previousStep, {
          config: configManager.getConfig(), state: stateManager.getState(), driver: api,
        });
      }

      var element = resolveElement(step.element);

      var highlightStartedHook = step.onHighlightStarted || configManager.getConfig('onHighlightStarted');
      safeHook(highlightStartedHook, element, step, {
        config: configManager.getConfig(), state: stateManager.getState(), driver: api,
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

      var delay = configManager.getConfig('animate') ? 350 : 50;
      setTimeout(function () {
        if (!stateManager.getState('isInitialized')) return;
        if (step.popover) popoverManager.render(step, element, tourState);
        var highlightedHook = step.onHighlighted || configManager.getConfig('onHighlighted');
        safeHook(highlightedHook, highlightedElement, step, {
          config: configManager.getConfig(), state: stateManager.getState(), driver: api,
        });
        stateManager.setState('__transitionInProgress', false);
      }, delay);
    }

    function handleNext() {
      if (stateManager.getState('__transitionInProgress')) return;
      var config = configManager.getConfig();
      var idx = stateManager.getState('activeIndex');
      var steps = config.steps || [];
      var activeStep = stateManager.getState('activeStep');
      var activeElement = stateManager.getState('activeElement');
      var hook = (activeStep && activeStep.popover && activeStep.popover.onNextClick) || config.onNextClick;
      if (hook && safeHook(hook, activeElement, activeStep, { config: config, state: stateManager.getState(), driver: api }) === false) return;
      if (idx !== undefined && idx < steps.length - 1) highlightStep(idx + 1);
      else performDestroy(false);
    }

    function handlePrev() {
      if (stateManager.getState('__transitionInProgress')) return;
      var config = configManager.getConfig();
      var idx = stateManager.getState('activeIndex');
      var activeStep = stateManager.getState('activeStep');
      var activeElement = stateManager.getState('activeElement');
      var hook = (activeStep && activeStep.popover && activeStep.popover.onPrevClick) || config.onPrevClick;
      if (hook && safeHook(hook, activeElement, activeStep, { config: config, state: stateManager.getState(), driver: api }) === false) return;
      if (idx !== undefined && idx > 0) highlightStep(idx - 1);
    }

    function handleClose() {
      if (stateManager.getState('__transitionInProgress')) return;
      var config = configManager.getConfig();
      var activeStep = stateManager.getState('activeStep');
      var activeElement = stateManager.getState('activeElement');
      var hook = (activeStep && activeStep.popover && activeStep.popover.onCloseClick) || config.onCloseClick;
      if (hook && safeHook(hook, activeElement, activeStep, { config: config, state: stateManager.getState(), driver: api }) === false) return;
      performDestroy(true);
    }

    function handleRefresh() {
      highlightManager.refresh();
      overlayManager.handleResize();
      var el = stateManager.getState('activeElement');
      var st = stateManager.getState('activeStep');
      if (el && st) popoverManager.reposition(el, st);
    }

    function performDestroy(withDestroyStartedHook) {
      var config = configManager.getConfig();
      var activeElement = stateManager.getState('activeElement');
      var activeStep = stateManager.getState('activeStep');
      var focusedBefore = stateManager.getState('__focusedBeforeActivation');

      if (withDestroyStartedHook && config.onDestroyStarted) {
        var result = safeHook(config.onDestroyStarted, activeElement, activeStep, {
          config: config, state: stateManager.getState(), driver: api,
        });
        if (result === false) return;
      }

      if (activeStep) {
        var deselectedHook = activeStep.onDeselected || config.onDeselected;
        safeHook(deselectedHook, activeElement, activeStep, {
          config: config, state: stateManager.getState(), driver: api,
        });
      }

      popoverManager.destroy();
      highlightManager.destroy();
      overlayManager.destroy();
      if (eventsManager) { eventsManager.destroy(); eventsManager = null; }
      if (clickRouter) { clickRouter.destroy(); clickRouter = null; }
      emitter.destroy();

      var destroyedStep = activeStep;
      var destroyedElement = activeElement;
      stateManager.resetState();

      if (destroyedStep) {
        safeHook(config.onDestroyed, destroyedElement, destroyedStep, { config: config, state: {}, driver: api });
      }
      if (focusedBefore && typeof focusedBefore.focus === 'function') {
        try { focusedBefore.focus(); } catch (e) { /* element may be gone */ }
      }
    }

    var api = {
      isActive: function () { return stateManager.getState('isInitialized') || false; },
      refresh: function () { if (stateManager.getState('isInitialized')) handleRefresh(); },
      drive: function (stepIndex) { init(); highlightStep(stepIndex || 0); },
      moveNext: function () { handleNext(); },
      movePrevious: function () { handlePrev(); },
      moveTo: function (idx) { if (!stateManager.getState('isInitialized')) init(); highlightStep(idx); },
      hasNextStep: function () {
        var s = configManager.getConfig('steps') || [];
        var i = stateManager.getState('activeIndex');
        return i !== undefined && i < s.length - 1;
      },
      hasPreviousStep: function () { var i = stateManager.getState('activeIndex'); return i !== undefined && i > 0; },
      isFirstStep: function () { return stateManager.getState('activeIndex') === 0; },
      isLastStep: function () {
        var s = configManager.getConfig('steps') || [];
        var i = stateManager.getState('activeIndex');
        return i !== undefined && i === s.length - 1;
      },
      getActiveIndex: function () { return stateManager.getState('activeIndex'); },
      getActiveStep: function () { return stateManager.getState('activeStep'); },
      getActiveElement: function () { return stateManager.getState('activeElement'); },
      getPreviousElement: function () { return stateManager.getState('previousElement'); },
      getPreviousStep: function () { return stateManager.getState('previousStep'); },
      highlight: function (step) {
        if (!step || typeof step !== 'object') {
          throw new TamperGuideError(ErrorCodes.INVALID_STEP, 'highlight() requires a step object.');
        }
        init();
        var element = resolveElement(step.element);
        var he = highlightManager.highlight(element);
        stateManager.setState('activeStep', step);
        stateManager.setState('activeElement', he);
        stateManager.setState('activeIndex', undefined);
        var delay = configManager.getConfig('animate') ? 350 : 50;
        setTimeout(function () {
          if (!stateManager.getState('isInitialized')) return;
          if (step.popover) popoverManager.render(step, element, { activeIndex: 0, totalSteps: 0, isFirst: true, isLast: true });
        }, delay);
      },
      setConfig: function (c) { configManager.setConfig(c); },
      setSteps: function (steps) {
        if (!Array.isArray(steps)) throw new TamperGuideError(ErrorCodes.INVALID_CONFIG, 'setSteps() requires an Array.');
        for (var i = 0; i < steps.length; i++) validateStep(steps[i], i);
        stateManager.resetState();
        configManager.setConfig({ steps: steps });
      },
      getConfig: function (k) { return configManager.getConfig(k); },
      getState: function (k) { return stateManager.getState(k); },
      destroy: function () { performDestroy(false); },
    };

    return api;
  }

  // =========================================================================
  // GLOBAL EXPORT
  // =========================================================================

  if (typeof window !== 'undefined') window.tamperGuide = tamperGuide;
  if (typeof globalThis !== 'undefined') globalThis.tamperGuide = tamperGuide;

})();