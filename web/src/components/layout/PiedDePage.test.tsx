/**
 * <b>Quelle livraison tourne, en bas de chaque page.</b>
 *
 * Depuis que les mises à jour arrivent toutes seules, on ne sait plus de
 * mémoire ce qui est en ligne. Deux pièges se logent ici, et aucun ne se voit
 * à l'œil : afficher la version du SERVEUR en la faisant passer pour celle de
 * l'interface — ce sont deux images distinctes, tirées séparément — et
 * transformer un serveur muet en panne affichée au bas de tous les écrans.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { PiedDePage } from './PiedDePage'
import { VERSION_INTERFACE } from '../../api/version'

const api = vi.hoisted(() => ({ lireVersionServeur: vi.fn() }))
vi.mock('../../api/version', async (importOriginal) => {
  const reel = await importOriginal<typeof import('../../api/version')>()
  return { ...reel, lireVersionServeur: api.lireVersionServeur }
})

function enrobage({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => vi.clearAllMocks())

describe('quand tout vient de la même livraison', () => {
  it('n’affiche qu’un seul numéro', async () => {
    api.lireVersionServeur.mockResolvedValue({ version: VERSION_INTERFACE })
    render(<PiedDePage />, { wrapper: enrobage })

    await waitFor(() => expect(api.lireVersionServeur).toHaveBeenCalled())
    // Deux fois le même numéro serait du bruit : le cas normal doit se lire
    // d'un coup d'œil.
    expect(screen.queryByText(/serveur/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'recharger' })).not.toBeInTheDocument()
  })
})

describe('quand l’interface et le serveur divergent', () => {
  it('le dit, et propose de recharger', async () => {
    // Le cas qui compte : un service worker qui garde l'ancienne coquille, ou
    // une image sur deux qui n'a pas été tirée. N'afficher que la version du
    // serveur aurait menti exactement là.
    api.lireVersionServeur.mockResolvedValue({ version: 'a'.repeat(40) })
    render(<PiedDePage />, { wrapper: enrobage })

    expect(await screen.findByText(/serveur aaaaaaa/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'recharger' })).toBeInTheDocument()
  })
})

describe('quand le serveur ne répond pas', () => {
  it('reste muet plutôt que d’annoncer une panne', async () => {
    // Ne pas connaître la version qui tourne n'est pas un incident, et
    // sûrement pas une bannière au bas de tous les écrans.
    api.lireVersionServeur.mockRejectedValue(new Error('injoignable'))
    render(<PiedDePage />, { wrapper: enrobage })

    await waitFor(() => expect(api.lireVersionServeur).toHaveBeenCalled())
    expect(screen.getByText(/^Version /)).toBeInTheDocument()
    expect(screen.queryByText(/serveur/)).not.toBeInTheDocument()
  })
})
