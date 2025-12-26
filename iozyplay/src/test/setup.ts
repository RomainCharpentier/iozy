/**
 * Configuration globale pour les tests
 */
import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Cleanup après chaque test
afterEach(() => {
  cleanup()
})

// Mock pour window.matchMedia (utilisé par certains composants)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
})


