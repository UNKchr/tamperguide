// ==UserScript==
// @name         TamperGuide
// @namespace    https://github.com/UNKchr/tamperguide
// @version      1.4.0
// @author       UNKchr
// @description  Lightweight library for product tours, highlights, and contextual help in Tampermonkey userscripts.
// @license      MIT
// ==/UserScript==

// ===========================================================================
// TamperGuide v1.4.0
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
    var hookKeys = [
      'onHighlightStarted', 'onHighlighted', 'onDeselected',
      'onDestroyStarted', 'onDestroyed', 'onNextClick', 'onPrevClick',
      'onCloseClick', 'onPopoverRender',
    ];
    for (var h = 0; h < hookKeys.length; h++) {
      if (config[hookKeys[h]] !== undefined && typeof config[hookKeys[h]] !== 'function') {
        throw new TamperGuideError(ErrorCodes.INVALID_CONFIG, '"' + hookKeys[h] + '" must be a function.');
      }
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
    }
    if (!step.element && !step.popover) {
      throw new TamperGuideError(ErrorCodes.INVALID_STEP, 'Step ' + index + ' needs "element" or "popover".');
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
    showProgress: false, showButtons: ['next', 'previous', 'close'],
    progressText: '{{current}} of {{total}}',
    nextBtnText: 'Next &rarr;', prevBtnText: '&larr; Previous',
    doneBtnText: 'Done &#10003;', closeBtnText: '&times;',
    popoverClass: '', popoverOffset: 10, smoothScroll: true,
    scrollIntoViewOptions: { behavior: 'smooth', block: 'center' },
    disableActiveInteraction: false, allowBackdropInteraction: false,
    onHighlightStarted: undefined, onHighlighted: undefined, onDeselected: undefined,
    onDestroyStarted: undefined, onDestroyed: undefined, onNextClick: undefined,
    onPrevClick: undefined, onCloseClick: undefined, onPopoverRender: undefined,
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

  function injectStyles(zOverlay, zPopover) {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '.tg-overlay { position: fixed; inset: 0; z-index: ' + zOverlay + '; pointer-events: none; transition: opacity 0.3s ease; }',
      '.tg-overlay svg { position: absolute; inset: 0; width: 100%; height: 100%; }',
      '.tg-overlay-clickable { pointer-events: auto; cursor: default; }',
      '',
      '.tg-popover {',
      '  all: initial; position: fixed; z-index: ' + zPopover + ';',
      '  background: #fff; color: #1a1a2e; border-radius: 8px;',
      '  box-shadow: 0 8px 32px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.1);',
      '  padding: 16px 20px; max-width: 380px; min-width: 240px;',
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;',
      '  font-size: 14px; line-height: 1.5; opacity: 0; pointer-events: auto;',
      '  box-sizing: border-box; word-wrap: break-word; overflow-wrap: break-word;',
      '}',
      '.tg-popover *, .tg-popover *::before, .tg-popover *::after { box-sizing: border-box; }',
      '.tg-popover-visible { opacity: 1; }',
      '.tg-popover-animated { transition: opacity 0.25s ease, transform 0.25s ease; }',
      '.tg-popover-arrow { position: absolute; width: 12px; height: 12px; background: #fff; transform: rotate(45deg); z-index: -1; }',
      '.tg-popover-title { display: block; font-size: 16px; font-weight: 700; margin: 0 0 8px 0; padding: 0; color: #0f0f23; line-height: 1.3; }',
      '.tg-popover-description { display: block; font-size: 14px; font-weight: 400; margin: 0 0 16px 0; padding: 0; color: #4a4a6a; line-height: 1.6; }',
      '.tg-popover-description:last-child { margin-bottom: 0; }',
      '.tg-popover-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 4px; }',
      '.tg-popover-progress { font-size: 12px; color: #8888aa; font-weight: 500; flex-shrink: 0; }',
      '.tg-popover-buttons { display: flex; gap: 6px; margin-left: auto; }',
      '.tg-popover-btn {',
      '  display: inline-flex; align-items: center; justify-content: center;',
      '  border: none; border-radius: 6px; padding: 6px 14px; font-size: 13px; font-weight: 600;',
      '  cursor: pointer; transition: background-color 0.15s ease, transform 0.1s ease;',
      '  font-family: inherit; line-height: 1.4; white-space: nowrap; text-decoration: none; outline: none;',
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
      '@keyframes tg-fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }',
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
      if (element instanceof Element) return document.body.contains(element) ? element : null;
      if (typeof element === 'string') {
        var found = document.querySelector(element);
        if (!found) warn(ErrorCodes.ELEMENT_NOT_FOUND, 'No element for "' + element + '".');
        return found;
      }
    } catch (err) { warn(ErrorCodes.ELEMENT_NOT_FOUND, 'Resolve error: ' + err.message); }
    return null;
  }

  function getElementRect(element, padding, radius) {
    padding = padding || 0;
    radius = radius || 0;
    var rect = element.getBoundingClientRect();
    return {
      x: rect.left - padding, y: rect.top - padding,
      width: rect.width + padding * 2, height: rect.height + padding * 2,
      radius: radius,
    };
  }

  function bringIntoView(element, options) {
    if (!element || typeof element.scrollIntoView !== 'function') return;
    if (isInsideFixedContainer(element)) return;
    options = options || { behavior: 'smooth', block: 'center' };
    try {
      var r = element.getBoundingClientRect();
      if (!(r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth)) {
        element.scrollIntoView(options);
      }
    } catch (err) { warn('SCROLL', 'Could not scroll: ' + err.message); }
  }

  function isInsideFixedContainer(element) {
    var c = element;
    while (c && c !== document.body && c !== document.documentElement) {
      if (window.getComputedStyle(c).position === 'fixed') return true;
      c = c.parentElement;
    }
    return false;
  }

  /**
   * Finds the nearest ancestor that creates a stacking context.
   * This includes fixed, absolute, relative with z-index, sticky,
   * and elements with transforms or will-change.
   * @param {Element} element
   * @returns {Element|null}
   */
  function findStackingAncestor(element) {
    var c = element ? element.parentElement : null;
    while (c && c !== document.body && c !== document.documentElement) {
      var style = window.getComputedStyle(c);
      var pos = style.position;
      var z = style.zIndex;
      var transform = style.transform || style.webkitTransform;

      // Any positioned element with an explicit z-index creates a stacking context
      if (pos !== 'static' && z !== 'auto') return c;

      // Fixed and sticky always create stacking contexts
      if (pos === 'fixed' || pos === 'sticky') return c;

      // Transforms create stacking contexts
      if (transform && transform !== 'none') return c;

      c = c.parentElement;
    }
    return null;
  }

  /**
   * Reads the effective z-index of an element by walking up its
   * stacking context chain. Returns the highest z-index found.
   * This handles cases where z-index is inherited through nested
   * stacking contexts (e.g. a relative parent inside a fixed grandparent).
   * @param {Element} element
   * @returns {number}
   */
  function getEffectiveZIndex(element) {
    var highest = 0;
    var current = element;
    while (current && current !== document.body && current !== document.documentElement) {
      var style = window.getComputedStyle(current);
      var z = parseInt(style.zIndex, 10);
      if (!isNaN(z) && z > highest) highest = z;
      current = current.parentElement;
    }
    return highest;
  }

  // =========================================================================
  // MODULE: Overlay Manager (SVG cutout)
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
  // MODULE: Popover Manager
  // =========================================================================

  function createPopoverManager(configManager, zPopover) {
    var popoverEl = null;
    var arrowEl = null;
    var currentStep = null;

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
      var children = Array.from(popoverEl.children);
      for (var i = 0; i < children.length; i++) {
        if (children[i] !== arrowEl) children[i].remove();
      }
      popoverEl.classList.remove('tg-popover-visible', 'tg-popover-enter');
      var showButtons = popover.showButtons || config.showButtons;

      if (showButtons.indexOf('close') !== -1 && config.allowClose) {
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

      var hasNav = showButtons.indexOf('next') !== -1 || showButtons.indexOf('previous') !== -1;
      var showProg = popover.showProgress !== undefined ? popover.showProgress : config.showProgress;
      if (hasNav || showProg) {
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
        if (showButtons.indexOf('previous') !== -1 && !tourState.isFirst) {
          var pb = document.createElement('button');
          pb.classList.add('tg-popover-btn', 'tg-popover-btn-prev');
          pb.innerHTML = config.prevBtnText;
          pb.setAttribute('type', 'button');
          btns.appendChild(pb);
        }
        if (showButtons.indexOf('next') !== -1) {
          var nb = document.createElement('button');
          if (tourState.isLast) {
            nb.classList.add('tg-popover-btn', 'tg-popover-btn-done');
            nb.innerHTML = config.doneBtnText;
          } else {
            nb.classList.add('tg-popover-btn', 'tg-popover-btn-next');
            nb.innerHTML = config.nextBtnText;
          }
          nb.setAttribute('type', 'button');
          btns.appendChild(nb);
        }
        footer.appendChild(btns);
        popoverEl.appendChild(footer);
      }

      var hook = popover.onPopoverRender || config.onPopoverRender;
      if (hook) {
        try { hook(popoverEl, { config: config, state: tourState }); }
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

      var side = popover.side || bestSide(tr, pr);
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
      var ct = Math.max(m, Math.min(top, window.innerHeight - pr.height - m));
      var cl = Math.max(m, Math.min(left, window.innerWidth - pr.width - m));
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

    function bestSide(tr, pr) {
      var s = [
        { s: 'bottom', v: window.innerHeight - tr.bottom },
        { s: 'top', v: tr.top },
        { s: 'right', v: window.innerWidth - tr.right },
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
  // MODULE: Highlight Manager
  // =========================================================================

  function createHighlightManager(configManager, overlayManager) {
    var activeElement = null;
    var dummyElement = null;

    function getOrCreateDummy() {
      if (dummyElement && document.body.contains(dummyElement)) return dummyElement;
      dummyElement = document.createElement('div');
      dummyElement.id = 'tg-dummy-element';
      dummyElement.style.cssText = 'width:0;height:0;pointer-events:none;opacity:0;position:fixed;top:50%;left:50%;';
      document.body.appendChild(dummyElement);
      return dummyElement;
    }

    function highlight(element) {
      var target = element || getOrCreateDummy();
      activeElement = target;
      var config = configManager.getConfig();
      if (element && config.smoothScroll) bringIntoView(element, config.scrollIntoViewOptions);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { refresh(); });
      });
      return target;
    }

    function refresh() {
      if (!activeElement) return;
      if (activeElement.id === 'tg-dummy-element') { overlayManager.updateHighlight(null); return; }
      var config = configManager.getConfig();
      var rect = getElementRect(activeElement, config.stagePadding, config.stageRadius);
      overlayManager.updateHighlight(rect);
    }

    function destroy() {
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
    var cm = deps.configManager, sm = deps.stateManager, em = deps.emitter;
    var bound = [];

    function add(t, ev, h, o) {
      o = o || false;
      t.addEventListener(ev, h, o);
      bound.push({ t: t, e: ev, h: h, o: o });
    }

    function init() {
      add(document, 'keydown', onKey, true);
      add(window, 'resize', onResize);
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
      for (var i = 0; i < bound.length; i++) {
        bound[i].t.removeEventListener(bound[i].e, bound[i].h, bound[i].o);
      }
      bound.length = 0;
    }

    return { init: init, destroy: destroy };
  }

  // =========================================================================
  // MODULE: Click Router
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
  // =========================================================================

  function tamperGuide(options) {
    options = options || {};
    validateConfig(options);

    var configManager = createConfigManager(options);
    var stateManager = createStateManager();
    var emitter = createEmitter();

    // -----------------------------------------------------------------
    // Determine z-index layers dynamically.
    //
    // Strategy:
    // 1. Probe ALL steps (not just the first) to find elements
    // 2. For each element, walk up to find its stacking context ancestor
    // 3. Read the effective z-index of that ancestor chain
    // 4. Use the HIGHEST z-index found across all steps
    // 5. Place overlay = highest + 1, popover = highest + 3
    //
    // Fallbacks:
    // - If no elements have positioned ancestors: use high defaults
    // - If z-index is 'auto' or 0: scan all fixed elements on the page
    //   that contain our target elements to find the real z-index
    // -----------------------------------------------------------------
    var zOverlay, zPopover;
    var panelZIndex = 0;
    var steps = configManager.getConfig('steps') || [];

    for (var si = 0; si < steps.length; si++) {
      if (!steps[si].element) continue;
      var probeEl = resolveElement(steps[si].element);
      if (!probeEl) continue;

      // Method 1: Find stacking context ancestor and read its z-index
      var ancestor = findStackingAncestor(probeEl);
      if (ancestor) {
        var az = getEffectiveZIndex(ancestor);
        if (az > panelZIndex) panelZIndex = az;
      }

      // Method 2: Walk the full chain for effective z-index
      // (catches cases where the panel itself has z-index auto but
      // a wrapper around it does not)
      var fullChainZ = getEffectiveZIndex(probeEl);
      if (fullChainZ > panelZIndex) panelZIndex = fullChainZ;
    }

    // Method 3: If still 0, scan the page for the highest z-index
    // among fixed/absolute positioned elements. This catches panels
    // that exist but whose elements were not yet in our steps array.
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
      // Absolute fallback: extremely high values
      zOverlay = 2147483644;
      zPopover = 2147483646;
    }

    var overlayManager = createOverlayManager(configManager, zOverlay);
    var popoverManager = createPopoverManager(configManager, zPopover);
    var highlightManager = createHighlightManager(configManager, overlayManager);
    var eventsManager = null;
    var clickRouter = null;

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
    }

    function highlightStep(idx) {
      var steps = configManager.getConfig('steps');
      if (!steps || !steps.length) throw new TamperGuideError(ErrorCodes.NO_STEPS, 'No steps.');
      if (idx < 0 || idx >= steps.length) throw new TamperGuideError(ErrorCodes.INVALID_STEP_INDEX, 'Bad index: ' + idx);
      if (stateManager.getState('__transitionInProgress')) return;
      stateManager.setState('__transitionInProgress', true);

      var step = steps[idx];
      var prevStep = stateManager.getState('activeStep');
      var prevEl = stateManager.getState('activeElement');
      if (prevStep && prevEl) {
        safeHook(prevStep.onDeselected || configManager.getConfig('onDeselected'),
          prevEl, prevStep, { config: configManager.getConfig(), state: stateManager.getState(), driver: api });
      }

      var element = resolveElement(step.element);
      safeHook(step.onHighlightStarted || configManager.getConfig('onHighlightStarted'),
        element, step, { config: configManager.getConfig(), state: stateManager.getState(), driver: api });

      stateManager.setState('previousStep', prevStep);
      stateManager.setState('previousElement', prevEl);
      stateManager.setState('activeStep', step);
      stateManager.setState('activeIndex', idx);

      var he = highlightManager.highlight(element);
      stateManager.setState('activeElement', he);
      popoverManager.hide();

      var ts = {
        activeIndex: idx,
        totalSteps: steps.length,
        isFirst: idx === 0,
        isLast: idx === steps.length - 1,
      };
      var delay = configManager.getConfig('animate') ? 350 : 50;
      setTimeout(function () {
        if (!stateManager.getState('isInitialized')) return;
        if (step.popover) popoverManager.render(step, element, ts);
        safeHook(step.onHighlighted || configManager.getConfig('onHighlighted'),
          he, step, { config: configManager.getConfig(), state: stateManager.getState(), driver: api });
        stateManager.setState('__transitionInProgress', false);
      }, delay);
    }

    function handleNext() {
      if (stateManager.getState('__transitionInProgress')) return;
      var c = configManager.getConfig(), i = stateManager.getState('activeIndex'), s = c.steps || [];
      var as = stateManager.getState('activeStep'), ae = stateManager.getState('activeElement');
      var h = (as && as.popover && as.popover.onNextClick) || c.onNextClick;
      if (h && safeHook(h, ae, as, { config: c, state: stateManager.getState(), driver: api }) === false) return;
      if (i !== undefined && i < s.length - 1) highlightStep(i + 1);
      else performDestroy(false);
    }

    function handlePrev() {
      if (stateManager.getState('__transitionInProgress')) return;
      var c = configManager.getConfig(), i = stateManager.getState('activeIndex');
      var as = stateManager.getState('activeStep'), ae = stateManager.getState('activeElement');
      var h = (as && as.popover && as.popover.onPrevClick) || c.onPrevClick;
      if (h && safeHook(h, ae, as, { config: c, state: stateManager.getState(), driver: api }) === false) return;
      if (i !== undefined && i > 0) highlightStep(i - 1);
    }

    function handleClose() {
      if (stateManager.getState('__transitionInProgress')) return;
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
    }

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
      popoverManager.destroy();
      highlightManager.destroy();
      overlayManager.destroy();
      if (eventsManager) { eventsManager.destroy(); eventsManager = null; }
      if (clickRouter) { clickRouter.destroy(); clickRouter = null; }
      emitter.destroy();
      var ds = as, de = ae;
      stateManager.resetState();
      if (ds) safeHook(c.onDestroyed, de, ds, { config: c, state: {}, driver: api });
      if (fb && typeof fb.focus === 'function') { try { fb.focus(); } catch (e) { /* may be gone */ } }
    }

    var api = {
      isActive: function () { return stateManager.getState('isInitialized') || false; },
      refresh: function () { if (stateManager.getState('isInitialized')) handleRefresh(); },
      drive: function (i) { init(); highlightStep(i || 0); },
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
        var d = configManager.getConfig('animate') ? 350 : 50;
        setTimeout(function () {
          if (stateManager.getState('isInitialized') && step.popover) {
            popoverManager.render(step, el, { activeIndex: 0, totalSteps: 0, isFirst: true, isLast: true });
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
    };

    return api;
  }

  // =========================================================================
  // GLOBAL EXPORT
  // =========================================================================

  if (typeof window !== 'undefined') window.tamperGuide = tamperGuide;
  if (typeof globalThis !== 'undefined') globalThis.tamperGuide = tamperGuide;

})();