/**
 * <b>Which release is running, at the bottom of every page.</b>
 *
 * Since updates arrive by themselves, we no longer know from
 * memory what is online. Two traps live here, and neither is visible
 * by eye: displaying the SERVER version by passing it off as the interface one
 * - they are two distinct images, pulled separately - and
 * turning a silent server into a failure displayed at the bottom of all screens.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { PiedDePage } from './PiedDePage'

const api = vi.hoisted(() => ({ lireVersionServeur: vi.fn() }))
// The interface version is SET by these tests, never read from the machine
// that runs them: outside a container, vite.config.ts derives it from git ("380-dev"),
// and tests that depended on it would change meaning at every commit.
const poste = vi.hoisted(() => ({ versionInterface: '1.3.1' }))
vi.mock('@/common/api/version', async (importOriginal) => {
  const reel = await importOriginal<typeof import('@/common/api/version')>()
  return {
    ...reel,
    lireVersionServeur: api.lireVersionServeur,
    get VERSION_INTERFACE() {
      return poste.versionInterface
    },
  }
})

function enrobage({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  poste.versionInterface = '1.3.1'
})

describe('when everything comes from the same release', () => {
  it('shows only one number', async () => {
    api.lireVersionServeur.mockResolvedValue({ version: '1.3.1' })
    render(<PiedDePage />, { wrapper: enrobage })

    await waitFor(() => expect(api.lireVersionServeur).toHaveBeenCalled())
    // Twice the same number would be noise: the normal case must be read
    // at a glance.
    expect(screen.queryByText(/serveur/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'recharger' })).not.toBeInTheDocument()
  })
})

describe('when the interface and the server diverge', () => {
  it('says so, and offers to reload', async () => {
    // The case that matters: a service worker that keeps the old shell, or
    // one image out of two that was not pulled. Showing only the
    // server version would have lied exactly there.
    api.lireVersionServeur.mockResolvedValue({ version: '1.2.0' })
    render(<PiedDePage />, { wrapper: enrobage })

    // The number comes out as it is: this is what lets us see, without opening
    // anything, which of the two images is late compared to the other.
    expect(await screen.findByText(/serveur 1\.2\.0/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'recharger' })).toBeInTheDocument()
  })

  it('shortens a server that stayed on an image from before the numbers', async () => {
    // Images published before releases were numbered carry
    // a 40-character SHA. The case disappears as soon as they have been pulled
    // once, but it is very real on the day of the switch - and 40 characters
    // at the bottom of a 375 px screen cannot be read.
    api.lireVersionServeur.mockResolvedValue({ version: 'a'.repeat(40) })
    render(<PiedDePage />, { wrapper: enrobage })

    expect(await screen.findByText(/serveur aaaaaaa/)).toBeInTheDocument()
  })
})

describe('on a workstation', () => {
  it('does not present two drafts as a gap to fix', async () => {
    // The interface comes from the development server, the API from an image
    // built by hand: two different values, and nothing to fix.
    // Saying so on every screen would teach people to ignore the line the day
    // the gap is real.
    poste.versionInterface = '1.4.0-dev'
    api.lireVersionServeur.mockResolvedValue({ version: 'dev' })
    render(<PiedDePage />, { wrapper: enrobage })

    await waitFor(() => expect(api.lireVersionServeur).toHaveBeenCalled())
    expect(screen.getByText(/^Version 1\.4\.0-dev/)).toBeInTheDocument()
    expect(screen.queryByText(/serveur/)).not.toBeInTheDocument()
  })
})

describe('at the door, before any session', () => {
  it('shows the interface version without asking the server anything', async () => {
    // The sign-in screen lives outside the shell: it is the only place where this
    // footer is displayed without a session, and that is where the question is
    // strongest - when you cannot get in, you want to know what is running.
    render(<PiedDePage sansSession />, { wrapper: enrobage })

    expect(await screen.findByText(/^Version /)).toBeInTheDocument()
    // The route requires a session: calling it here would only add a 401 in
    // the console of someone who has not yet got in.
    expect(api.lireVersionServeur).not.toHaveBeenCalled()
  })
})

describe('when the server does not answer', () => {
  it('stays silent rather than announcing a failure', async () => {
    // Not knowing the running version is not an incident, and
    // certainly not a banner at the bottom of all screens.
    api.lireVersionServeur.mockRejectedValue(new Error('injoignable'))
    render(<PiedDePage />, { wrapper: enrobage })

    await waitFor(() => expect(api.lireVersionServeur).toHaveBeenCalled())
    expect(screen.getByText(/^Version /)).toBeInTheDocument()
    expect(screen.queryByText(/serveur/)).not.toBeInTheDocument()
  })
})
