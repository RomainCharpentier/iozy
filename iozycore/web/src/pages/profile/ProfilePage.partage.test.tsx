/**
 * <b>"Partager" always lands on the sharing.</b>
 *
 * <p>The top bar sends "Partager" to this page with a router state. Clicked a
 * second time while already here, after scrolling away, the state is the same,
 * so an effect keyed on it alone did not scroll again. IozyTest cannot pass a
 * router state across apps, so it links with "#partage".
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ProfilePage } from './ProfilePage'

const auth = vi.hoisted(() => ({ useAuth: vi.fn() }))
vi.mock('@/common/hooks/useAuth', () => auth)

vi.mock('./ProfileValueHero', () => ({ ProfileValueHero: () => null }))
vi.mock('./ProfileTierListsSection', () => ({ ProfileTierListsSection: () => null }))
vi.mock('./ShareSection', () => ({ ShareSection: () => null }))
vi.mock('./Reglages', () => ({ Reglages: () => null }))
vi.mock('@/common/api/home', () => ({ fetchHomeWeek: vi.fn(() => new Promise(() => {})) }))

function requetes({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
}

function BoutonPartager() {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate('/profile', { state: { focusPartage: true } })}>
      Partager
    </button>
  )
}

const scrollIntoView = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  auth.useAuth.mockReturnValue({ compte: { id: 'u1', email: 'moi@example.com', pseudo: 'romain', admin: false } })
  Element.prototype.scrollIntoView = scrollIntoView
})

describe('the share shortcut', () => {
  it('scrolls to the sharing again when "Partager" is clicked a second time', () => {
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <BoutonPartager />
        <Routes>
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>,
      { wrapper: requetes },
    )
    expect(scrollIntoView).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Partager' }))
    fireEvent.click(screen.getByRole('button', { name: 'Partager' }))

    expect(scrollIntoView).toHaveBeenCalledTimes(2)
  })

  it('scrolls to the sharing when the address ends with #partage', () => {
    render(
      <MemoryRouter initialEntries={['/profile#partage']}>
        <Routes>
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>,
      { wrapper: requetes },
    )

    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })
})
