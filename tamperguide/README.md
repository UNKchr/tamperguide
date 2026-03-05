# TamperGuide

**Lightweight library for product tours, highlights, and contextual help in Tampermonkey userscripts.**

Inspired by [driver.js](https://driverjs.com), designed specifically for the userscript ecosystem.

- Zero dependencies
- Auto-injects CSS (no external stylesheets needed)
- Compatible with the Tampermonkey sandbox
- Clear developer-facing error messages with error codes
- Exhaustive configuration validation at initialization time
- Fault-tolerant: handles missing elements, dynamic DOM, and SPAs
- Keyboard navigation (arrow keys, Tab, Escape)
- SVG-based overlay that avoids z-index stacking issues
- Automatic z-index detection to render above existing page UI

---

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Highlight a Single Element](#highlight-a-single-element)
4. [Configuration Options](#configuration-options)
5. [Step Object](#step-object)
6. [Hooks](#hooks)
7. [API Reference](#api-reference)
8. [Keyboard Shortcuts](#keyboard-shortcuts)
9. [Error Handling](#error-handling)
10. [Examples](#examples)
11. [License](#license)

---

## Installation

TamperGuide is used as a `@require` library inside your userscript header. Choose any of the options below.

### Option A: jsDelivr CDN (recommended)

```js
// @require https://cdn.jsdelivr.net/gh/UNKchr/tamperguide@v1.4.1/tamperguide/tamperGuide.js
```

### Option B: Greasy Fork

```js
// @require https://update.greasyfork.org/scripts/XXXXXX/tamperGuide.js
```

> Replace `XXXXXX` with the actual Greasy Fork script ID after publishing.

### Option C: GitHub Raw

```js
// @require https://raw.githubusercontent.com/UNKchr/tamperguide/v1.4.1/tamperguide/tamperGuide.js
```

Once required, the library exposes the global function `tamperGuide` that is available everywhere in your script without any import statement.

---

## Quick Start

The following example starts a guided tour on `https://example.com` when the script loads.

```js
// ==UserScript==
// @name         My Tour Script
// @namespace    https://github.com/YourName/my-tour-script
// @version      1.0.0
// @description  Guided tour for example.com
// @match        https://example.com/*
// @require      https://cdn.jsdelivr.net/gh/UNKchr/tamperguide@v1.4.1/tamperguide/tamperGuide.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // Create a guide instance with the desired configuration.
  // All options are optional; only 'steps' is required for a tour.
  const guide = tamperGuide({
    // Show "1 of 3" progress text inside each popover.
    showProgress: true,

    // Animate transitions between steps.
    animate: true,

    steps: [
      {
        // A step without 'element' renders the popover centered on the screen.
        // Use this for introductory or closing slides.
        popover: {
          title: 'Welcome to the Tour',
          description: 'This short tour will walk you through the main sections of the page.',
        },
      },
      {
        // CSS selector for the element to highlight.
        element: 'h1',
        popover: {
          title: 'Page Title',
          description: 'This is the main heading of the page.',
          // Preferred side for the popover. Auto-detected when omitted.
          side: 'bottom',
        },
      },
      {
        element: 'nav',
        popover: {
          title: 'Navigation',
          description: 'Use these links to explore the different sections of the site.',
          side: 'bottom',
        },
      },
      {
        // Final step — shown centered because no element is specified.
        popover: {
          title: 'Tour Complete',
          description: 'You are now familiar with this page. Enjoy your visit.',
        },
      },
    ],
  });

  // Start the tour from step index 0.
  guide.drive();
})();
```

---

## Highlight a Single Element

Use `guide.highlight()` to spotlight one element without running a multi-step tour. This is useful for onboarding hints, tooltips, or drawing attention to a specific UI component.

```js
// ==UserScript==
// @name         Search Hint
// @match        https://example.com/*
// @require      https://cdn.jsdelivr.net/gh/UNKchr/tamperguide@v1.4.1/tamperguide/tamperGuide.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // Create a guide instance without any steps.
  const guide = tamperGuide();

  // Highlight a single element using a step-like object.
  guide.highlight({
    // '#search-input' is the CSS selector for the element to highlight.
    element: '#search-input',
    popover: {
      title: 'Search',
      description: 'Type here to search for anything on the site.',
      side: 'bottom',
    },
  });
})();
```

---

## Configuration Options

All options are passed to the `tamperGuide(options)` factory function. Every option is optional.

### Overlay and Stage

| Option | Type | Default | Description |
|---|---|---|---|
| `overlayColor` | `string` | `'#000'` | Background color of the dimmed overlay. Accepts any valid CSS color value. |
| `overlayOpacity` | `number` | `0.7` | Opacity of the overlay. Must be between `0` (transparent) and `1` (fully opaque). |
| `stagePadding` | `number` | `10` | Extra space (in pixels) added around the highlighted element's bounding box. |
| `stageRadius` | `number` | `5` | Border radius (in pixels) of the rounded cutout that frames the highlighted element. |
| `allowBackdropInteraction` | `boolean` | `false` | When `true`, the user can interact with elements outside the highlighted area while the tour is active. By default all backdrop clicks are captured. |

### Popover Appearance

| Option | Type | Default | Description |
|---|---|---|---|
| `popoverClass` | `string` | `''` | One or more space-separated CSS class names added to every popover element. Use this to apply custom styles. |
| `popoverOffset` | `number` | `10` | Distance in pixels between the popover and the edge of the highlighted element. |
| `animate` | `boolean` | `true` | Enable fade and slide animations for popover transitions. Set to `false` for instant transitions. |

### Buttons and Labels

| Option | Type | Default | Description |
|---|---|---|---|
| `showButtons` | `Array<string>` | `['next', 'previous', 'close']` | Controls which buttons are rendered inside the popover. Valid values: `'next'`, `'previous'`, `'close'`. Pass an empty array to hide all buttons. |
| `nextBtnText` | `string` | `'Next &rarr;'` | Label for the "Next" button. Supports HTML entities. |
| `prevBtnText` | `string` | `'&larr; Previous'` | Label for the "Previous" button. Supports HTML entities. |
| `doneBtnText` | `string` | `'Done &#10003;'` | Label for the button on the last step (replaces Next). Supports HTML entities. |
| `closeBtnText` | `string` | `'&times;'` | Label for the close (X) button in the popover corner. Supports HTML entities. |

### Progress Indicator

| Option | Type | Default | Description |
|---|---|---|---|
| `showProgress` | `boolean` | `false` | Display a "current of total" counter inside the popover footer. |
| `progressText` | `string` | `'{{current}} of {{total}}'` | Template string for the progress counter. Use `{{current}}` and `{{total}}` as placeholders. |

### Behavior

| Option | Type | Default | Description |
|---|---|---|---|
| `steps` | `Array` | `[]` | Array of step objects defining the tour. See the [Step Object](#step-object) section. |
| `allowClose` | `boolean` | `true` | Allow the user to close the tour by pressing Escape or clicking the overlay. |
| `allowKeyboardControl` | `boolean` | `true` | Enable keyboard navigation (arrow keys, Tab, Escape). |
| `smoothScroll` | `boolean` | `true` | Smoothly scroll the page to bring off-screen elements into view before highlighting them. |
| `scrollIntoViewOptions` | `object` | `{ behavior: 'smooth', block: 'center' }` | Options passed directly to `element.scrollIntoView()`. Only used when `smoothScroll` is `true`. |
| `disableActiveInteraction` | `boolean` | `false` | When `true`, pointer events on the highlighted element are disabled, preventing the user from clicking it during the tour. |

### Hooks (as configuration options)

Hooks can be registered globally via configuration. See the [Hooks](#hooks) section for full details.

| Option | Type | Description |
|---|---|---|
| `onHighlightStarted` | `function` | Called when a step begins (before the element scrolls into view). |
| `onHighlighted` | `function` | Called after the popover is rendered and the element is visible. |
| `onDeselected` | `function` | Called when leaving a step (before moving to the next or destroying). |
| `onDestroyStarted` | `function` | Called before the tour is closed or destroyed. Return `false` to cancel. |
| `onDestroyed` | `function` | Called after cleanup is complete. |
| `onNextClick` | `function` | Called when the Next button is clicked. Return `false` to cancel navigation. |
| `onPrevClick` | `function` | Called when the Previous button is clicked. Return `false` to cancel navigation. |
| `onCloseClick` | `function` | Called when the Close button or Escape key is used. Return `false` to cancel. |
| `onPopoverRender` | `function` | Called after the popover DOM is created, before it becomes visible. Use this to inject custom elements. |

---

## Step Object

Each entry in the `steps` array is a plain object with the following shape:

```js
{
  // ------------------------------------------------------------------
  // element (optional)
  // ------------------------------------------------------------------
  // Identifies the DOM element to highlight. When omitted, the popover
  // is displayed centered on the screen (useful for intro/outro slides).
  //
  // Accepted types:
  //   string   - a CSS selector passed to document.querySelector()
  //   Element  - a direct DOM element reference
  //   function - a zero-argument function that returns a DOM Element;
  //              evaluated lazily when the step is activated, which
  //              makes it safe to use with dynamic or SPA-rendered DOM.
  element: '#my-element',

  // ------------------------------------------------------------------
  // popover (optional)
  // ------------------------------------------------------------------
  // Defines the content and position of the popover tooltip.
  // When omitted, the element is highlighted with no tooltip.
  popover: {
    // title: displayed in bold at the top of the popover.
    // Accepts a plain string (HTML entities are rendered) or a DOM Element.
    title: 'Section Title',

    // description: the main body text of the popover.
    // Accepts a string with HTML markup or a DOM Element.
    description: 'This section lets you manage your account settings.',

    // side: preferred placement of the popover relative to the element.
    // 'top' | 'right' | 'bottom' | 'left'
    // When omitted, TamperGuide picks the side with the most available space.
    side: 'bottom',

    // align: alignment of the popover along the chosen side.
    // 'start' | 'center' | 'end'  (default: 'center')
    align: 'center',

    // showProgress: override the global showProgress option for this step only.
    showProgress: true,

    // showButtons: override the global showButtons option for this step only.
    showButtons: ['next', 'previous'],

    // progressText: override the global progressText template for this step only.
    progressText: 'Step {{current}} of {{total}}',

    // Per-step hook overrides (see Hooks section for signature details).
    onNextClick:  function (element, step, opts) {},
    onPrevClick:  function (element, step, opts) {},
    onCloseClick: function (element, step, opts) {},
    onPopoverRender: function (popoverElement, opts) {},
  },

  // ------------------------------------------------------------------
  // Per-step lifecycle hooks (override global hooks for this step only)
  // ------------------------------------------------------------------
  onHighlightStarted: function (element, step, opts) {},
  onHighlighted:      function (element, step, opts) {},
  onDeselected:       function (element, step, opts) {},
}
```

A step must have at least one of `element` or `popover`. Steps with neither are rejected at configuration time with a `TamperGuideError`.

---

## Hooks

Hooks are callbacks invoked by TamperGuide at specific points in the tour lifecycle. They can be registered globally in the configuration object or per-step inside a step's `popover` or at the step's top level.

When a hook is defined at both the global level and the step level, the **step-level hook takes precedence**.

### Hook Signature

All lifecycle hooks (except `onPopoverRender`) share the same signature:

```
function (element, step, context) { ... }
```

| Parameter | Type | Description |
|---|---|---|
| `element` | `Element \| null` | The DOM element associated with the current step. `null` for popover-only (centered) steps. |
| `step` | `object` | The full step configuration object for the current step. |
| `context` | `object` | An object with three keys: `config` (full resolved config), `state` (current internal state snapshot), `driver` (the guide API instance). |

The `onPopoverRender` hook has a different signature:

```
function (popoverElement, context) { ... }
```

| Parameter | Type | Description |
|---|---|---|
| `popoverElement` | `Element` | The popover `<div>` DOM element, fully populated but not yet visible. |
| `context` | `object` | An object with `config` and `state` keys. |

### Hook Reference

| Hook | Scope | Cancellable | Description |
|---|---|---|---|
| `onHighlightStarted` | Global / Step | No | Called at the very beginning of a step transition, before scrolling or rendering. The element may not yet be visible in the viewport. |
| `onHighlighted` | Global / Step | No | Called after the popover is rendered and the element is fully highlighted and visible. Ideal for side effects that depend on the tour being visible (e.g. tracking). |
| `onDeselected` | Global / Step | No | Called when leaving a step, before the next step begins. Useful for undoing any DOM changes made in `onHighlighted`. |
| `onDestroyStarted` | Global only | Yes | Called before the tour is destroyed (either by the user or programmatically). Return `false` to prevent destruction. |
| `onDestroyed` | Global only | No | Called after all DOM elements are removed and state is reset. |
| `onNextClick` | Global / Step | Yes | Called when the user clicks the Next button or presses the right arrow key. Return `false` to prevent advancing to the next step. |
| `onPrevClick` | Global / Step | Yes | Called when the user clicks the Previous button or presses the left arrow key. Return `false` to prevent going back. |
| `onCloseClick` | Global / Step | Yes | Called when the user clicks the Close button or presses Escape. Return `false` to prevent closing. |
| `onPopoverRender` | Global / Step | No | Called after the popover's inner DOM is built but before it fades in. Use this to inject extra HTML, icons, or interactive elements into the popover. |

### Cancellation

Hooks marked as cancellable stop the associated action when they explicitly return `false`. Any other return value (including `undefined`) allows the action to proceed.

```js
tamperGuide({
  steps: [ /* ... */ ],

  // Prevent the user from closing the tour until they reach the last step.
  onCloseClick: function (element, step, opts) {
    if (!opts.driver.isLastStep()) {
      return false; // block the close action
    }
    // returning nothing (undefined) allows the tour to close normally
  },
});
```

---

## API Reference

The `tamperGuide(options)` factory returns an API object with the following methods.

### Tour Control

| Method | Signature | Description |
|---|---|---|
| `drive` | `drive(index?: number): void` | Initializes the tour and starts at the given step index. Defaults to step `0`. |
| `moveNext` | `moveNext(): void` | Advances to the next step. If already on the last step, destroys the tour. |
| `movePrevious` | `movePrevious(): void` | Goes back to the previous step. Does nothing on the first step. |
| `moveTo` | `moveTo(index: number): void` | Jumps directly to the step at the given index. Initializes the tour if not yet active. |
| `highlight` | `highlight(step: object): void` | Highlights a single element without starting a multi-step tour. Accepts a step-like object with `element` and `popover` keys. |
| `refresh` | `refresh(): void` | Recalculates and redraws positions for the overlay cutout and popover. Call this after programmatic DOM or layout changes. |
| `destroy` | `destroy(): void` | Stops the tour, removes all DOM elements (overlay, popover), and cleans up event listeners. |

### State Inspection

| Method | Signature | Description |
|---|---|---|
| `isActive` | `isActive(): boolean` | Returns `true` if the guide is currently initialized and running. |
| `isFirstStep` | `isFirstStep(): boolean` | Returns `true` if the active step is index `0`. |
| `isLastStep` | `isLastStep(): boolean` | Returns `true` if the active step is the last one in the steps array. |
| `hasNextStep` | `hasNextStep(): boolean` | Returns `true` if there is at least one step after the current one. |
| `hasPreviousStep` | `hasPreviousStep(): boolean` | Returns `true` if there is at least one step before the current one. |
| `getActiveIndex` | `getActiveIndex(): number \| undefined` | Returns the zero-based index of the current step, or `undefined` if not active. |
| `getActiveStep` | `getActiveStep(): object \| undefined` | Returns the step configuration object for the current step. |
| `getActiveElement` | `getActiveElement(): Element \| undefined` | Returns the DOM element currently highlighted, or the internal dummy element for centered popovers. |
| `getPreviousStep` | `getPreviousStep(): object \| undefined` | Returns the step configuration object for the step that was active before the current one. |
| `getPreviousElement` | `getPreviousElement(): Element \| undefined` | Returns the DOM element that was highlighted in the previous step. |

### Configuration and Steps

| Method | Signature | Description |
|---|---|---|
| `getConfig` | `getConfig(key?: string): any` | Returns the full resolved configuration object, or the value of a single key if `key` is provided. |
| `setConfig` | `setConfig(config: object): void` | Merges new values into the active configuration. Validates the incoming object before applying. |
| `setSteps` | `setSteps(steps: Array): void` | Replaces all steps with a new array. Validates each step. Resets active state. |
| `getState` | `getState(key?: string): any` | Returns the full internal state snapshot, or the value of a single key. Useful inside hooks. |

---

## Keyboard Shortcuts

When `allowKeyboardControl` is `true` (the default), the following keyboard interactions are active while the tour is running:

| Key | Action |
|---|---|
| `ArrowRight` | Advance to the next step |
| `Tab` | Advance to the next step |
| `ArrowLeft` | Go back to the previous step |
| `Shift + Tab` | Go back to the previous step |
| `Escape` | Close and destroy the tour (only when `allowClose` is `true`) |

---

## Error Handling

TamperGuide validates all configuration and step objects when they are provided. Configuration errors throw a `TamperGuideError` with a machine-readable error code and a descriptive message.

### Error Codes

| Code | Thrown when |
|---|---|
| `INVALID_CONFIG` | The configuration object contains unknown keys, incorrect types, or out-of-range values. |
| `INVALID_STEP` | A step object is missing both `element` and `popover`, or contains invalid values for `side`, `align`, or `element`. |
| `ELEMENT_NOT_FOUND` | A CSS selector matches no element, or the element function returns a non-Element value. This produces a warning (not a thrown error) so the tour continues to the next step. |
| `NO_STEPS` | `drive()` is called but no steps are defined. |
| `INVALID_STEP_INDEX` | `drive(index)` or `moveTo(index)` is called with an index outside the valid range. |
| `HOOK_ERROR` | A hook function throws an exception. The error is caught, logged as a warning, and the tour continues. |
| `DESTROYED` | A method is called on a guide instance that has already been destroyed. |

### Catching Errors

```js
try {
  const guide = tamperGuide({
    steps: [
      { /* invalid: no element or popover */ },
    ],
  });
} catch (err) {
  if (err.name === 'TamperGuideError') {
    console.error('TamperGuide configuration error:', err.code, err.message);
    // err.code  - one of the error codes above
    // err.context - additional diagnostic data (may be empty)
  }
}
```

### Unknown Option Warnings

Passing an unrecognized configuration key does not throw; instead, TamperGuide prints a `console.warn` message that includes the unrecognized key and a suggestion for the closest valid option:

```
[TamperGuide:INVALID_CONFIG] Unknown option: "animatte". Did you mean: animate?
```

---

## Examples

The `examples/` directory contains ready-to-use userscripts that demonstrate common patterns.

### Basic Tour (`examples/basic-tour.user.js`)

A minimal multi-step tour using a Greasemonkey menu command to start the tour on demand. Demonstrates step structure, progress display, and button configuration.

### Highlight Only (`examples/highlight-only.user.js`)

Shows how to use `guide.highlight()` to spotlight a single element without a multi-step tour. Useful for contextual hints and first-time-use callouts.

### Advanced Hooks (`examples/advanced-hooks.user.js`)

Demonstrates all lifecycle hooks: `onHighlightStarted`, `onHighlighted`, `onDeselected`, `onNextClick` with cancellation, `onDestroyStarted` with cancellation, `onDestroyed`, and `onPopoverRender` for injecting custom DOM into the popover.

### SPA / Deferred Start (`examples/spa-tour.user.js`)

Shows how to start a tour safely on a Single Page Application where elements may not exist in the DOM at page load. Uses a `MutationObserver` to wait for the target element before beginning, and a function-based `element` resolver to lazily query the DOM at step activation time.

### Custom Styling (`examples/custom-styling.user.js`)

Demonstrates how to apply a custom theme to the popover using `popoverClass` and injected CSS, and how to add extra content (icons, links) to each popover with the `onPopoverRender` hook.

---

## License

MIT © [UNKchr](https://github.com/UNKchr)
