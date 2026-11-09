/**
 * <b>The shell paints with the cover the page declares.</b> The tones land on
 * <html> (so dialogs outside the shell follow), and when the image host
 * refuses CORS the app says it in one line - never in silence, never in a
 * banner.
 */
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NOTE_CORS, NotePleinCadre, PleinCadreProvider } from './PleinCadre'
import { usePleinCadre } from './usePleinCadre'
import { deriverTeintes, enRgb, TERRACOTTA } from '@/common/lib/teinte/derivation'
import { setTheme } from '@/common/lib/theme'
import { setAccent } from '@/common/lib/accent'

function Page({ url }: { url: string | null }) {
  usePleinCadre(url)
  return <NotePleinCadre />
}

function imagesSansCors() {
  class FausseImage {
    crossOrigin: string | null = null
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    set src(_valeur: string) {
      setTimeout(() => (this.crossOrigin === null ? this.onload?.() : this.onerror?.()))
    }
  }
  vi.stubGlobal('Image', FausseImage)
}

afterEach(() => {
  vi.unstubAllGlobals()
  setAccent('AUTO', { annoncer: false })
})

describe('the plein cadre shell', () => {
  it.each(['dark', 'light'] as const)('writes the terracotta tones of the %s theme on the page when there is no cover', async (theme) => {
    setTheme(theme)
    render(
      <PleinCadreProvider>
        <Page url={null} />
      </PleinCadreProvider>,
    )
    const attendu = deriverTeintes(TERRACOTTA, theme)
    await waitFor(() => expect(document.documentElement.style.getPropertyValue('--teinte-vive')).toBe(enRgb(attendu.vive)))
    expect(screen.queryByText(NOTE_CORS)).not.toBeInTheDocument()
  })

  it('says discreetly that the brand color stands in when the host refuses CORS', async () => {
    imagesSansCors()
    render(
      <PleinCadreProvider>
        <Page url="https://hote-ferme.example/c.jpg" />
      </PleinCadreProvider>,
    )
    expect(await screen.findByText(NOTE_CORS)).toBeInTheDocument()
  })

  it('keeps the terracotta whatever the cover when the profile chose it (lot 218), without a CORS note', async () => {
    imagesSansCors()
    setTheme('dark')
    setAccent('TERRACOTTA', { annoncer: false })
    render(
      <PleinCadreProvider>
        <Page url="https://hote-ferme.example/c.jpg" />
      </PleinCadreProvider>,
    )
    const attendu = deriverTeintes(TERRACOTTA, 'dark')
    await waitFor(() => expect(document.documentElement.style.getPropertyValue('--teinte-vive')).toBe(enRgb(attendu.vive)))
    await new Promise((fin) => setTimeout(fin, 20))
    expect(screen.queryByText(NOTE_CORS)).not.toBeInTheDocument()
  })
})
