# TamperGuide

**Lightweight library for product tours, highlights, and contextual help in Tampermonkey userscripts.**

Inspired by [driver.js](https://driverjs.com), designed specifically for the userscript ecosystem.

- Zero dependencies
- Auto-injects CSS (no external stylesheets)
- Compatible with Tampermonkey sandbox
- Clear developer-facing error messages
- Exhaustive configuration validation
- Fault-tolerant (handles missing elements, dynamic DOM, SPAs)
- Keyboard navigation (arrows, Tab, Escape)
- SVG-based overlay (no z-index stacking issues)

## Installation

### Option A: `@require` from GitHub (via jsDelivr CDN)

```js
// @require https://cdn.jsdelivr.net/gh/UNKchr/tamperguide@v1.0.0/tamperguide.js
```

### Option B: `@require` from Greasy Fork

```js
// @require https://update.greasyfork.org/scripts/XXXXXX/tamperguide.js
```

> Replace `XXXXXX` with the actual Greasy Fork script ID after publishing.

### Option C: `@require` from GitHub Raw

```js
// @require https://raw.githubusercontent.com/UNKchr/tamperguide/v1.0.0/tamperguide.js
```

## Quick Start

```js
// ==UserScript==
// @name         My Tour Script
// @match        https://example.com/*
// @require      https://cdn.jsdelivr.net/gh/UNKchr/tamperguide@v1.0.0/tamperguide.js
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const guide = tamperGuide({
    showProgress: true,
    steps: [
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
          description: 'Use these links to explore sections.',
          side: 'bottom',
        },
      },
      {
        popover: {
          title: '🎉 Tour Complete!',
          description: 'You are now familiar with this page.',
        },
      },
    ],
  });

  guide.drive();
})();
```

## Highlight a Single Element

```js
const guide = tamperGuide();

guide.highlight({
  element: '#search-input',
  popover: {
    title: 'Search',
    description: 'Type here to find anything.',
    side: 'bottom',
  },
});
```

## Configuration Options

| Option | Type | Default | Description |
| --------|------|---------|-------------|
| `steps` | `Array` | `[]` | Array of step objects |
| `animate` | `boolean` | `true` | Enable/disable animations |
| `overlayColor` | `string` | `'#000'` | Overlay background color |
| `overlayOpacity` | `number` | `0.7` | Overlay opacity (0–1) |
| `stagePadding` | `number` | `10` | Padding around highlighted element (px) |
| `stageRadius` | `number` | `5` | Border radius of highlight cutout (px) |
| `allowClose` | `boolean` | `true` | Allow closing via Escape/overlay click |
| `allowKeyboardControl` | `boolean` | `true` | Arrow keys / Tab navigation |
| `showProgress` | `boolean` | `false` | Show "1 of 5" progress text |
| `showButtons` | `Array` | `['next','previous','close']` | Which buttons to display |
| `progressText` | `string` | `'{{current}} of {{total}}'` | Progress text template |
| `nextBtnText` | `string` | `'Next →'` | Next button label |
| `prevBtnText` | `string` | `'← Previous'` | Previous button label |
| `doneBtnText` | `string` | `'Done ✓'` | Done button label (last step) |
| `popoverClass` | `string` | `''` | Extra CSS class for the popover |
| `popoverOffset` | `number` | `10` | Distance between popover and element (px) |
| `smoothScroll` | `boolean` | `true` | Smooth scroll to off-screen elements |
| `disableActiveInteraction` | `boolean` | `false` | Block clicks on highlighted element |

## Step Object

```js
{
  element: '#my-el',           // CSS selector, function, or DOM Element
  popover: {
    title: 'Title',            // String or DOM Element
    description: 'Text',       // String or DOM Element (supports HTML)
    side: 'bottom',            // 'top' | 'right' | 'bottom' | 'left' (auto if omitted)
    align: 'center',           // 'start' | 'center' | 'end'
    showProgress: true,        // Override global showProgress
    showButtons: ['next'],     // Override global showButtons
  },
  onHighlightStarted: (el, step, opts) => {},
  onHighlighted:      (el, step, opts) => {},
  onDeselected:       (el, step, opts) => {},
}
```

## Hooks

All hooks receive `(element, step, { config, state, driver })`:

| Hook | Scope | Description |
| ------|-------|-------------|
| `onHighlightStarted` | Global / Step | Fires when a step begins highlighting |
| `onHighlighted` | Global / Step | Fires after the step is fully visible |
| `onDeselected` | Global / Step | Fires when leaving a step |
| `onDestroyStarted` | Global | Fires before destroy — return `false` to cancel |
| `onDestroyed` | Global | Fires after full cleanup |
| `onNextClick` | Global / Step | Fires on next click — return `false` to cancel |
| `onPrevClick` | Global / Step | Fires on prev click — return `false` to cancel |
| `onCloseClick` | Global / Step | Fires on close click — return `false` to cancel |
| `onPopoverRender` | Global / Step | Fires after popover DOM is created |

## API Methods

| Method | Description |
| --------|-------------|
| `guide.drive(index?)` | Start tour (optionally from a step index) |
| `guide.highlight(step)` | Highlight a single element |
| `guide.moveNext()` | Go to next step |
| `guide.movePrevious()` | Go to previous step |
| `guide.moveTo(index)` | Jump to specific step |
| `guide.hasNextStep()` | Returns boolean |
| `guide.hasPreviousStep()` | Returns boolean |
| `guide.isActive()` | Returns boolean |
| `guide.isFirstStep()` | Returns boolean |
| `guide.isLastStep()` | Returns boolean |
| `guide.getActiveIndex()` | Current step index |
| `guide.getActiveStep()` | Current step object |
| `guide.getActiveElement()` | Current highlighted element |
| `guide.setConfig(config)` | Update configuration |
| `guide.setSteps(steps)` | Replace all steps |
| `guide.getConfig(key?)` | Get config (or specific key) |
| `guide.getState(key?)` | Get internal state |
| `guide.refresh()` | Recalculate positions |
| `guide.destroy()` | Clean up everything |

## Keyboard Shortcuts

| Key | Action |
| -----|--------|
| `→` / `Tab` | Next step |
| `←` / `Shift+Tab` | Previous step |
| `Escape` | Close tour |

## License

MIT © [UNKchr](https://github.com/UNKchr)
