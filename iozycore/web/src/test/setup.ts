/**
 * What each web test already finds in place.
 *
 * Two things only, and neither is a writing shortcut:
 * the DOM matchers of jest-dom (`toBeInTheDocument`, `toHaveTextContent`...),
 * which say what they check much better than an assertion on a node;
 * and the systematic unmounting of the previous render, without which two
 * tests of the same file would look for their text in the accumulated DOM of
 * both.
 *
 * `localStorage` is the one of jsdom: real, and shared by all the tests of
 * the same file. A test that writes in it (preferences, title language)
 * resets it itself - declaring it here would hide the dependency.
 *
 * <h2>Web Storage, taken back from Node</h2>
 * Node 25 and later ship their own `localStorage` and `sessionStorage`. Without
 * `--localstorage-file` they are undefined, and they hide those of jsdom. So we
 * put jsdom's back on the global. On older Node, they are already there and
 * this changes nothing.
 *
 * <h2>ResizeObserver, for lack of layout</h2>
 * jsdom does not implement it, and every screen that displays a title goes
 * through `TexteCoupe`, which uses it to know whether the text overflows.
 * Without this stub, the render fails before the first assertion - for a
 * reason that has nothing to do with what is being tested.
 *
 * <p>It never notifies: jsdom does no layout, so no size really changes. A
 * stub that triggered a callback would invent a measurement, and `TexteCoupe`
 * would conclude at random. What a test can assert here is the TEXT; what it
 * cannot is its truncation (see also the test browser, whose viewport is 0).
 */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

declare const jsdom: { window: Window }

for (const key of ['localStorage', 'sessionStorage'] as const) {
  Object.defineProperty(globalThis, key, {
    value: jsdom.window[key],
    configurable: true,
    writable: true,
  })
}

if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

afterEach(cleanup)
