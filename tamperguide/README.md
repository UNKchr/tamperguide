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
- Built-in themes (dark, minimal, rounded) with CSS custom property support
- Tour progress persistence across page navigations (localStorage or GM storage)
- Conditional steps, async element waiting, and interaction-based advancement
- Non-blocking hotspots with pulsing indicators and hover tooltips
- Accessibility: focus trapping, aria-live announcements, and screen reader support
- Analytics hooks for tracking step visits, timing, and tour completion
- Auto-refresh via MutationObserver for SPA compatibility

---

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Highlight a Single Element](#highlight-a-single-element)
4. [Configuration Options](#configuration-options)
5. [Step Object](#step-object)
6. [Themes](#themes)
7. [Persistence](#persistence)
8. [Conditional Steps](#conditional-steps)
9. [Waiting for Elements](#waiting-for-elements)
10. [Advance on Interaction](#advance-on-interaction)
11. [Hotspots](#hotspots)
12. [Analytics](#analytics)
13. [Auto-Refresh](#auto-refresh)
14. [Accessibility](#accessibility)
15. [Hooks](#hooks)
16. [API Reference](#api-reference)
17. [Keyboard Shortcuts](#keyboard-shortcuts)
18. [Error Handling](#error-handling)
19. [Examples](#examples)
20. [Migration from v1.4.1](#migration-from-v141)
21. [License](#license)

---

## Installation

TamperGuide is used as a `@require` library inside your userscript header. Choose any of the options below.

### Option A: jsDelivr CDN (recommended)

```js
// @require https://cdn.jsdelivr.net/gh/UNKchr/tamperguide@v1.5.0/tamperguide/tamperGuide.js
```

### Option B: Greasy Fork

```js
// @require https://update.greasyfork.org/scripts/XXXXXX/tamperGuide.js
```

> Replace `XXXXXX` with the actual Greasy Fork script ID after publishing.

### Option C: GitHub Raw

```js
// @require https://raw.githubusercontent.com/UNKchr/tamperguide/v1.5.0/tamperguide/tamperGuide.js
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
// @require      https://cdn.jsdelivr.net/gh/UNKchr/tamperguide@v1.5.0/tamperguide/tamperGuide.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const guide = tamperGuide({
    showProgress: true,
    animate: true,

    steps: [
      {
        popover: {
          title: 'Welcome to the Tour',
          description: 'This short tour will walk you through the main sections of the page.',
        },
      },
      {
        element: 'h1',
        popover: {
          title: 'Page Title',
          description: 'This is the main heading of the page.',
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
        popover: {
          title: 'Tour Complete',
          description: 'You are now familiar with this page. Enjoy your visit.',
        },
      },
    ],
  });

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
// @require      https://cdn.jsdelivr.net/gh/UNKchr/tamperguide@v1.5.0/tamperguide/tamperGuide.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const guide = tamperGuide();

  guide.highlight({
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
| `theme` | `string` | `'default'` | Built-in visual theme for the popover. Valid values: `'default'`, `'dark'`, `'minimal'`, `'rounded'`. See the [Themes](#themes) section. |

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

### Persistence

| Option | Type | Default | Description |
|---|---|---|---|
| `persist` | `boolean` | `false` | Save tour progress across page navigations. See the [Persistence](#persistence) section. |
| `persistKey` | `string` | `''` | Unique string identifier for this tour. Required when `persist` is `true`. |
| `persistStorage` | `string` | `'localStorage'` | Storage backend: `'localStorage'` for same-origin persistence, or `'GM'` for cross-origin persistence using Tampermonkey's `GM_setValue`/`GM_getValue` (requires `@grant` directives). |
| `persistExpiry` | `number` | `604800000` | Time in milliseconds before saved progress expires. Default is 7 days. Set to `0` for no expiration. |

### Auto-Refresh

| Option | Type | Default | Description |
|---|---|---|---|
| `autoRefresh` | `boolean` | `false` | Automatically reposition the overlay and popover when the DOM changes. Uses a MutationObserver internally. See the [Auto-Refresh](#auto-refresh) section. |
| `autoRefreshInterval` | `number` | `300` | Debounce interval in milliseconds for MutationObserver-triggered repositioning. Must be >= 50. |

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
| `onStepChange` | `function` | Called each time the active step changes. Receives a step event object with timing and direction data. See the [Analytics](#analytics) section. |
| `onTourComplete` | `function` | Called when the tour ends (completed or abandoned). Receives a summary object. See the [Analytics](#analytics) section. |

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
  // id (optional) — NEW in v1.5.0
  // ------------------------------------------------------------------
  // A unique string identifier for this step. Enables navigation by name
  // using guide.moveToStep('my-id') instead of numeric indices.
  id: 'settings-step',

  // ------------------------------------------------------------------
  // when (optional) — NEW in v1.5.0
  // ------------------------------------------------------------------
  // A function that returns true or false. When it returns false, the
  // step is skipped and the tour advances to the next eligible step.
  // Evaluated lazily at the moment the step would be activated, not at
  // configuration time.
  when: function () {
    return document.querySelector('#settings-panel') !== null;
  },

  // ------------------------------------------------------------------
  // waitFor (optional) — NEW in v1.5.0
  // ------------------------------------------------------------------
  // Polls for the element to appear in the DOM before activating the
  // step. Useful when elements are rendered asynchronously by the host
  // page (SPAs, lazy loading).
  waitFor: {
    timeout: 5000,       // max wait time in ms (default: 5000)
    pollInterval: 200,   // check frequency in ms (default: 200, min: 16)
  },

  // ------------------------------------------------------------------
  // advanceOn (optional) — NEW in v1.5.0
  // ------------------------------------------------------------------
  // Waits for a specific user interaction before advancing to the next
  // step. The event listener is automatically cleaned up when the step
  // changes or the tour is destroyed.
  advanceOn: {
    event: 'click',            // any DOM event name
    selector: '#confirm-btn',  // optional CSS selector; defaults to the step element
  },

  // ------------------------------------------------------------------
  // ariaLabel (optional) — NEW in v1.5.0
  // ------------------------------------------------------------------
  // Custom text announced to screen readers when this step activates.
  // When omitted, the popover title is used. When neither is available,
  // a default "Step N of M" string is announced.
  ariaLabel: 'Configure your notification preferences in this panel',

  // ------------------------------------------------------------------
  // popover (optional)
  // ------------------------------------------------------------------
  popover: {
    title: 'Section Title',
    description: 'This section lets you manage your account settings.',
    side: 'bottom',
    align: 'center',
    showProgress: true,
    showButtons: ['next', 'previous'],
    progressText: 'Step {{current}} of {{total}}',

    // Per-step hook overrides (see Hooks section for signature details).
    onNextClick:     function (element, step, opts) {},
    onPrevClick:     function (element, step, opts) {},
    onCloseClick:    function (element, step, opts) {},
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

## Themes

TamperGuide v1.5.0 includes four built-in visual themes that change the appearance of the popover without requiring custom CSS. Set the `theme` configuration option to apply one.

| Theme | Description |
|---|---|
| `'default'` | White background, blue primary buttons, subtle shadows. Identical to v1.4.1 appearance. |
| `'dark'` | Dark blue-gray background (Catppuccin-inspired), light text, blue accent buttons. |
| `'minimal'` | White background, reduced shadows, black primary buttons for a clean look. |
| `'rounded'` | White background with extra-rounded corners (16px border radius, pill-shaped buttons). |

```js
const guide = tamperGuide({
  theme: 'dark',
  steps: [ /* ... */ ],
});
```

Themes are implemented using CSS custom properties on the popover element. The following custom properties are available for further customization via `popoverClass` and injected CSS:

| Custom Property | Controls |
|---|---|
| `--tg-bg` | Popover background color |
| `--tg-color` | Popover base text color |
| `--tg-title-color` | Title text color |
| `--tg-desc-color` | Description text color |
| `--tg-btn-primary-bg` | Next/Done button background |
| `--tg-btn-primary-color` | Next/Done button text color |
| `--tg-btn-secondary-bg` | Previous button background |
| `--tg-btn-secondary-color` | Previous button text color |
| `--tg-shadow` | Popover box shadow |
| `--tg-arrow-bg` | Arrow indicator background |
| `--tg-progress-color` | Progress counter text color |
| `--tg-close-color` | Close button default color |
| `--tg-close-hover-color` | Close button hover text color |
| `--tg-close-hover-bg` | Close button hover background |
| `--tg-border-radius` | Popover border radius |
| `--tg-btn-radius` | Button border radius |

You can combine a built-in theme with custom overrides:

```js
GM_addStyle('.tg-popover.my-custom { --tg-btn-primary-bg: #10b981; }');

const guide = tamperGuide({
  theme: 'dark',
  popoverClass: 'my-custom',
  steps: [ /* ... */ ],
});
```

---

## Persistence

Tour progress persistence saves the current step index across page navigations and reloads. This is essential for userscripts because the user constantly navigates between pages on the same site, and without persistence the tour resets to step 0 on every page load.

### Basic Usage

```js
const guide = tamperGuide({
  persist: true,
  persistKey: 'my-site-onboarding-v1',
  steps: [ /* ... */ ],
});

// On first visit: starts from step 0.
// On subsequent visits: resumes from the last active step.
// After completion: drive() does nothing (tour is marked complete).
guide.drive();
```

### Storage Backends

**localStorage** (default): Works without any special Tampermonkey grants. Limited to the same origin (protocol + domain + port). Suitable for scripts that run on a single domain.

**GM storage**: Uses `GM_setValue`, `GM_getValue`, and `GM_deleteValue` to persist data across all origins where the userscript runs. Requires adding the following grants to your userscript header:

```js
// @grant GM_setValue
// @grant GM_getValue
// @grant GM_deleteValue
```

```js
const guide = tamperGuide({
  persist: true,
  persistKey: 'my-cross-site-tour',
  persistStorage: 'GM',
  steps: [ /* ... */ ],
});
```

### Expiration

By default, saved progress expires after 7 days (604800000 milliseconds). After expiration, `drive()` starts the tour from step 0 again. Set `persistExpiry: 0` to disable expiration entirely.

### Programmatic Control

```js
// Check if the user has already completed the tour.
if (!guide.isCompleted()) {
  guide.drive();
}

// Force the tour to restart from the beginning on the next drive() call.
guide.resetProgress();
```

---

## Conditional Steps

The `when` property on a step object accepts a function that returns `true` or `false`. When it returns `false`, the step is skipped and the tour automatically advances to the next eligible step in the current navigation direction.

The function is evaluated lazily at the moment the step would be activated, not at configuration time. This makes it safe for conditions that depend on the current DOM state, user preferences, or API responses.

```js
const guide = tamperGuide({
  steps: [
    {
      popover: { title: 'Welcome', description: 'Let us show you around.' },
    },
    {
      element: '#admin-panel',
      when: function () {
        // Only show this step if the user is an admin.
        return document.body.classList.contains('is-admin');
      },
      popover: { title: 'Admin Panel', description: 'Manage users and settings here.' },
    },
    {
      element: '#dashboard',
      popover: { title: 'Dashboard', description: 'Your main overview.' },
    },
  ],
});
```

If the `when` function throws an exception, the error is caught and warned, and the step is shown anyway (fail-open behavior) to avoid silently breaking the tour.

If all remaining steps in the current direction have their `when` conditions return `false`, the tour is destroyed (when moving forward) or the navigation is ignored (when moving backward).

---

## Waiting for Elements

The `waitFor` property on a step object enables asynchronous element resolution. Instead of failing immediately when a CSS selector does not match any element, TamperGuide polls the DOM at a configurable interval until the element appears or the timeout is reached.

This is particularly useful for Single Page Applications where elements are rendered asynchronously by frameworks like React, Vue, or Angular.

```js
{
  element: '#dynamic-widget',
  waitFor: {
    timeout: 8000,       // wait up to 8 seconds (default: 5000)
    pollInterval: 300,   // check every 300ms (default: 200, minimum: 16)
  },
  popover: {
    title: 'Dynamic Widget',
    description: 'This widget loads asynchronously.',
  },
}
```

If the timeout is reached and the element has not appeared:

- If the step has a `popover`, the popover is shown centered on the screen (same as a step with no element).
- If the step has no `popover`, it is skipped entirely and the tour advances to the next step.
- A `WAIT_TIMEOUT` warning is logged to the console with the selector and timeout duration.

The polling is automatically cleaned up if the tour is destroyed while waiting.

---

## Advance on Interaction

The `advanceOn` property on a step object configures the tour to wait for a specific user interaction before advancing to the next step. This is useful for steps that require the user to perform an action (clicking a button, typing in an input, selecting an option) before proceeding.

```js
{
  element: '#accept-terms',
  advanceOn: {
    event: 'click',               // any DOM event name: 'click', 'input', 'change', etc.
    selector: '#accept-terms',    // optional: CSS selector for the event target
  },
  popover: {
    title: 'Accept Terms',
    description: 'Click the checkbox to accept the terms and continue.',
    showButtons: ['close'],       // hide Next since advancement is automatic
  },
}
```

When `advanceOn` is configured:

- An event listener is attached to the target element (or the step's highlighted element if no selector is provided, or `document` if neither is available).
- When the event fires, the listener is removed and the tour advances automatically.
- The user can still click the Next button or use keyboard navigation to advance manually.
- The listener is always cleaned up when the step changes or the tour is destroyed, preventing memory leaks.

If the target element specified by `advanceOn.selector` cannot be found in the DOM, a warning is logged and the step behaves normally (the user can still click Next to advance).

---

## Hotspots

Hotspots are persistent, non-blocking visual hints that can be shown on any element without starting a full tour. Each hotspot displays a pulsing dot at the top-right corner of the target element, with a tooltip that appears on hover.

Hotspots are independent of the tour system: they can be added and removed at any time, they do not block page interaction, and they persist until explicitly removed or the guide instance is destroyed.

### Adding a Hotspot

```js
const guide = tamperGuide();

guide.addHotspot({
  element: '#new-feature-btn',          // required: CSS selector
  tooltip: 'Try our new feature!',      // tooltip text shown on hover
  side: 'bottom',                        // tooltip placement: 'top', 'right', 'bottom', 'left'
  pulse: true,                           // show pulse animation (default: true)
  pulseColor: '#ef4444',                 // color of the dot and pulse (default: '#ef4444')
  dismissOnClick: true,                  // remove when the target element is clicked
  autoDismiss: 10000,                    // auto-remove after 10 seconds (0 = never)
});
```

### Removing Hotspots

```js
// Remove a specific hotspot by its element selector.
guide.removeHotspot('#new-feature-btn');

// Remove all active hotspots.
guide.removeAllHotspots();
```

### Behavior Details

- Each hotspot is identified by its element selector. Adding a hotspot with the same selector as an existing one replaces it.
- Hotspots automatically reposition on window resize.
- If the target element is removed from the DOM (common in SPAs), the hotspot is hidden but not destroyed. It reappears if the element is re-added.
- Hotspot styles are injected only when needed (the first call to `addHotspot` injects the stylesheet if no tour has been started).

---

## Analytics

TamperGuide v1.5.0 includes two analytics hooks that provide timing and navigation data about the tour session. These hooks are passive: they only read state and call your callback functions, without modifying the DOM or tour behavior.

### onStepChange

Called each time the active step changes. Receives an event object with the following properties:

| Property | Type | Description |
|---|---|---|
| `type` | `string` | Always `'enter'`. |
| `stepIndex` | `number` | Zero-based index of the step being entered. |
| `stepId` | `string \| null` | The step's `id` property, or `null` if no ID is defined. |
| `duration` | `number` | Time in milliseconds spent on the previous step. |
| `timestamp` | `number` | Unix timestamp (milliseconds) when the transition occurred. |
| `totalSteps` | `number` | Total number of steps in the tour. |
| `direction` | `string` | Navigation direction: `'forward'`, `'backward'`, or `'jump'`. |

```js
const guide = tamperGuide({
  onStepChange: function (event) {
    console.log('Step', event.stepIndex, 'entered after', event.duration, 'ms on previous step');
    console.log('Direction:', event.direction);
  },
  steps: [ /* ... */ ],
});
```

### onTourComplete

Called when the tour ends, whether the user completed all steps or abandoned the tour early. Receives a summary object:

| Property | Type | Description |
|---|---|---|
| `completed` | `boolean` | `true` if the user reached the last step and the tour ended normally. |
| `stepsVisited` | `Array<number>` | Array of step indices that were visited during the session. |
| `stepsSkipped` | `Array<number>` | Array of step indices that were never visited. |
| `totalDuration` | `number` | Total duration of the tour session in milliseconds. |
| `exitStep` | `number` | Index of the step that was active when the tour ended. |
| `totalSteps` | `number` | Total number of steps in the tour. |

```js
const guide = tamperGuide({
  onTourComplete: function (summary) {
    if (summary.completed) {
      console.log('Tour completed in', summary.totalDuration, 'ms');
    } else {
      console.log('Tour abandoned at step', summary.exitStep);
    }
    console.log('Steps visited:', summary.stepsVisited);
    console.log('Steps skipped:', summary.stepsSkipped);
  },
  steps: [ /* ... */ ],
});
```

---

## Auto-Refresh

When `autoRefresh` is enabled, TamperGuide uses a MutationObserver to watch for DOM changes that might shift the position of the highlighted element or popover. When changes are detected, the overlay cutout and popover positions are recalculated automatically.

This is essential for userscripts running on Single Page Applications (React, Vue, Angular) where the host page re-renders parts of the DOM at any time.

```js
const guide = tamperGuide({
  autoRefresh: true,
  autoRefreshInterval: 300,  // debounce interval in ms (default: 300, minimum: 50)
  steps: [ /* ... */ ],
});
```

The observer watches `document.body` for:

- Child list changes (elements added or removed)
- Subtree changes (deep DOM mutations)
- Attribute changes on `style` and `class` (layout shifts)

Mutations that occur within the debounce interval are batched into a single refresh to prevent excessive repaints. The observer automatically disconnects when the tour is destroyed.

---

## Accessibility

TamperGuide v1.5.0 includes built-in accessibility features that enhance the experience for screen reader users and keyboard-only navigation.

### Focus Trapping

When a popover is visible, Tab and Shift+Tab cycling is constrained to the focusable elements inside the popover (buttons). This prevents the user from accidentally tabbing into the dimmed page content behind the overlay. The trap is automatically removed when the popover is hidden or the tour is destroyed.

The first focusable element in the popover receives focus automatically when the step activates.

### Screen Reader Announcements

An `aria-live="polite"` region is injected into the DOM. When a step changes, the region is updated with the step's `ariaLabel` (if defined), the popover title, or a default "Step N of M" string. Screen readers announce this transition without interrupting the current reading flow.

```js
{
  element: '#notifications',
  ariaLabel: 'Step 3: Configure your notification preferences in the settings panel',
  popover: {
    title: 'Notifications',
    description: 'Manage your alert settings here.',
  },
}
```

### ARIA Attributes

The popover element is rendered with `role="dialog"` and `aria-modal="false"`. The close button includes `aria-label="Close"`. Hotspot elements use `role="note"` with an `aria-label` matching the tooltip text.

---

## Hooks

Hooks are callbacks invoked by TamperGuide at specific points in the tour lifecycle. They can be registered globally in the configuration object or per-step inside a step's `popover` or at the step's top level.

When a hook is defined at both the global level and the step level, the **step-level hook takes precedence**.

### Hook Signature

All lifecycle hooks (except `onPopoverRender`, `onStepChange`, and `onTourComplete`) share the same signature:

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
| `onStepChange` | Global only | No | Called each time the active step changes. Receives a step event object. See [Analytics](#analytics). |
| `onTourComplete` | Global only | No | Called when the tour ends. Receives a summary object. See [Analytics](#analytics). |

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
| `drive` | `drive(index?: number): void` | Initializes the tour and starts at the given step index. Defaults to step `0`. When persistence is enabled and saved progress exists, the tour resumes from the saved step (unless explicitly overridden with an index argument). If the tour was previously completed, `drive()` does nothing. |
| `moveNext` | `moveNext(): void` | Advances to the next step. If already on the last step, destroys the tour. |
| `movePrevious` | `movePrevious(): void` | Goes back to the previous step. Does nothing on the first step. |
| `moveTo` | `moveTo(index: number): void` | Jumps directly to the step at the given index. Initializes the tour if not yet active. |
| `moveToStep` | `moveToStep(id: string): void` | Navigates to a step by its string `id` property instead of a numeric index. Throws a `TamperGuideError` if no step with the given ID exists. Initializes the tour if not yet active. |
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
| `getStepCount` | `getStepCount(): number` | Returns the total number of steps configured in the tour. |

### Configuration and Steps

| Method | Signature | Description |
|---|---|---|
| `getConfig` | `getConfig(key?: string): any` | Returns the full resolved configuration object, or the value of a single key if `key` is provided. |
| `setConfig` | `setConfig(config: object): void` | Merges new values into the active configuration. Validates the incoming object before applying. |
| `setSteps` | `setSteps(steps: Array): void` | Replaces all steps with a new array. Validates each step. Resets active state. |
| `getState` | `getState(key?: string): any` | Returns the full internal state snapshot, or the value of a single key. Useful inside hooks. |

### Persistence

| Method | Signature | Description |
|---|---|---|
| `isCompleted` | `isCompleted(): boolean` | Returns `true` if the user has previously completed this tour and the completion record has not expired. Always returns `false` if persistence is not enabled. |
| `resetProgress` | `resetProgress(): void` | Clears all saved persistence data for this tour. The next call to `drive()` will start from step 0. Does nothing if persistence is not enabled. |

### Hotspots

| Method | Signature | Description |
|---|---|---|
| `addHotspot` | `addHotspot(options: object): void` | Adds a persistent, non-blocking visual hint to an element. See the [Hotspots](#hotspots) section for the options object shape. |
| `removeHotspot` | `removeHotspot(selector: string): void` | Removes a specific hotspot by its element selector. |
| `removeAllHotspots` | `removeAllHotspots(): void` | Removes all active hotspots from the page. |

---

## Keyboard Shortcuts

When `allowKeyboardControl` is `true` (the default), the following keyboard interactions are active while the tour is running:

| Key | Action |
|---|---|
| `ArrowRight` | Advance to the next step |
| `Tab` | Advance to the next step (focus-trapped within the popover) |
| `ArrowLeft` | Go back to the previous step |
| `Shift + Tab` | Go back to the previous step (focus-trapped within the popover) |
| `Escape` | Close and destroy the tour (only when `allowClose` is `true`) |

When a popover is visible, Tab and Shift+Tab are constrained to cycle through the focusable elements inside the popover (the focus trap). This prevents keyboard focus from escaping into the dimmed page content.

---

## Error Handling

TamperGuide validates all configuration and step objects when they are provided. Configuration errors throw a `TamperGuideError` with a machine-readable error code and a descriptive message.

### Error Codes

| Code | Thrown when |
|---|---|
| `INVALID_CONFIG` | The configuration object contains unknown keys, incorrect types, or out-of-range values. |
| `INVALID_STEP` | A step object is missing both `element` and `popover`, or contains invalid values for `side`, `align`, `element`, `id`, `when`, `waitFor`, `advanceOn`, or `ariaLabel`. |
| `ELEMENT_NOT_FOUND` | A CSS selector matches no element, or the element function returns a non-Element value. This produces a warning (not a thrown error) so the tour continues to the next step. |
| `NO_STEPS` | `drive()` is called but no steps are defined. |
| `INVALID_STEP_INDEX` | `drive(index)`, `moveTo(index)`, or `moveToStep(id)` is called with an index outside the valid range or an ID that matches no step. |
| `HOOK_ERROR` | A hook function throws an exception. The error is caught, logged as a warning, and the tour continues. |
| `DESTROYED` | A method is called on a guide instance that has already been destroyed. |
| `PERSISTENCE_ERROR` | A storage operation (read, write, or delete) fails. Logged as a warning; the tour continues without persistence. This can happen when localStorage is disabled, storage is full, or GM functions are not granted. |
| `WAIT_TIMEOUT` | A `waitFor` poll timed out before the element appeared in the DOM. Logged as a warning; the step is skipped or shown without an element. |
| `ADVANCE_ON_ERROR` | The `advanceOn.selector` is invalid or did not match any element, or the event listener could not be attached. Logged as a warning; the step works normally without advanceOn. |
| `HOTSPOT_ERROR` | `addHotspot()` was called with invalid options or the target element was not found. Logged as a warning; the hotspot is not created. |

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
    // err.code    - one of the error codes above
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

### Themes (`examples/themes.user.js`)

Demonstrates all four built-in visual themes (`default`, `dark`, `minimal`, `rounded`). Provides a separate menu command for each theme so they can be compared side by side. Also shows how to layer custom CSS overrides on top of a built-in theme using `popoverClass` and `GM_addStyle`.

### Persistence (`examples/persistence.user.js`)

Demonstrates tour progress persistence across page navigations. Shows how to configure `persist`, `persistKey`, `persistStorage`, and `persistExpiry`; how `drive()` resumes from the saved step on reload; how `isCompleted()` checks whether the tour was already finished; and how `resetProgress()` clears saved data. Includes a separate menu command to reset progress and commented-out examples showing GM storage with the required `@grant` directives.

### Conditional Steps (`examples/conditional-steps.user.js`)

Demonstrates the `when` property on step objects. Some steps are always shown; others are conditionally skipped based on live DOM state. Covers the fail-open guarantee (a throwing `when` function shows the step rather than crashing) and what happens when all remaining steps in the current direction return `false`.

### waitFor & advanceOn (`examples/waitfor-advanceon.user.js`)

Demonstrates both `waitFor` and `advanceOn` in a single self-contained tour with injected demo elements. Shows `waitFor` polling for a dynamically inserted element (simulated with a `setTimeout`), and `advanceOn` advancing the tour on a `click` and an `input` event. Covers timeout behaviour and automatic event-listener cleanup.

### Hotspots (`examples/hotspots.user.js`)

Demonstrates the hotspot system. Adds four hotspots with different configurations — default appearance, custom colour, `dismissOnClick`, and `autoDismiss` — via a single menu command. Provides separate menu commands for removing a specific hotspot and for removing all hotspots. Includes comments explaining hotspot behaviour in SPAs and on element removal.

### Analytics (`examples/analytics.user.js`)

Demonstrates the `onStepChange` and `onTourComplete` analytics hooks. Logs structured step-transition events including timing data and navigation direction. Distinguishes completed versus abandoned tours in `onTourComplete` and displays a per-step dwell-time breakdown in the browser console.

### Accessibility (`examples/accessibility.user.js`)

Demonstrates the built-in accessibility features. Uses custom `ariaLabel` values on steps to control screen reader announcements via the `aria-live` region. Includes detailed comments explaining focus trapping within the popover, the `aria-live="polite"` region lifecycle, and the ARIA attributes (`role`, `aria-modal`, `aria-label`) automatically applied to the popover and hotspot elements.

### Step IDs & moveToStep (`examples/step-ids.user.js`)

Demonstrates the `id` property on step objects and `guide.moveToStep()`. Assigns unique IDs to all steps and registers menu commands that call `moveToStep()` to jump directly to any step by name. Also demonstrates `getStepCount()` and explains how step IDs interact with persistence (IDs do not stabilise persisted indices across step reorders).

---

## Migration from v1.4.1

TamperGuide v1.5.0 is fully backward compatible with v1.4.1. No existing configuration keys, step properties, API methods, or hook signatures were changed or removed. All new features are opt-in through new configuration options that default to safe values preserving the exact v1.4.1 behavior.

To upgrade, change the version tag in your `@require` URL:

```diff
- // @require https://cdn.jsdelivr.net/gh/UNKchr/tamperguide@v1.4.1/tamperguide/tamperGuide.js
+ // @require https://cdn.jsdelivr.net/gh/UNKchr/tamperguide@v1.5.0/tamperguide/tamperGuide.js
```

### Summary of New Features

| Feature | Configuration | Description |
|---|---|---|
| Built-in Themes | `theme` | Four visual themes applied via CSS custom properties. |
| Persistence | `persist`, `persistKey`, `persistStorage`, `persistExpiry` | Save and resume tour progress across page navigations. |
| Conditional Steps | `when` (per-step) | Skip steps declaratively based on runtime conditions. |
| Async Element Waiting | `waitFor` (per-step) | Poll for elements that load asynchronously before activating a step. |
| Step IDs | `id` (per-step), `moveToStep()` | Navigate to steps by name instead of numeric index. |
| Advance on Interaction | `advanceOn` (per-step) | Wait for a user action (click, input, etc.) before advancing. |
| Hotspots | `addHotspot()`, `removeHotspot()`, `removeAllHotspots()` | Non-blocking pulsing hints with hover tooltips. |
| Analytics Hooks | `onStepChange`, `onTourComplete` | Track step timing, navigation direction, and completion status. |
| Auto-Refresh | `autoRefresh`, `autoRefreshInterval` | MutationObserver-based repositioning for SPAs. |
| Accessibility | `ariaLabel` (per-step) | Focus trapping, aria-live announcements, screen reader support. |

### New API Methods

| Method | Description |
|---|---|
| `moveToStep(id)` | Navigate to a step by its string ID. |
| `getStepCount()` | Returns the total number of configured steps. |
| `isCompleted()` | Returns `true` if the tour was previously completed (requires persistence). |
| `resetProgress()` | Clears saved persistence data. |
| `addHotspot(options)` | Adds a non-blocking visual hint to an element. |
| `removeHotspot(selector)` | Removes a specific hotspot. |
| `removeAllHotspots()` | Removes all active hotspots. |

### New Error Codes

| Code | Description |
|---|---|
| `PERSISTENCE_ERROR` | Storage operation failed. |
| `WAIT_TIMEOUT` | Element polling timed out. |
| `ADVANCE_ON_ERROR` | advanceOn listener could not be attached. |
| `HOTSPOT_ERROR` | Hotspot creation failed. |

---

## License

MIT (c) [UNKchr](https://github.com/UNKchr)