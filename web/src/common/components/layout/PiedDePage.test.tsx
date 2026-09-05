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

const api = vi.hoisted(() => ({ lireVersionServeur: vi.fn() }))
// La version de l'interface est POSÉE par ces tests, jamais lue de la machine
// qui les joue : hors conteneur, vite.config.ts la dérive de git (« 380-dev »),
// et des tests qui en dépendraient changeraient de sens à chaque commit.
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

describe('quand tout vient de la même livraison', () => {
  it('n’affiche qu’un seul numéro', async () => {
    api.lireVersionServeur.mockResolvedValue({ version: '1.3.1' })
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
    api.lireVersionServeur.mockResolvedValue({ version: '1.2.0' })
    render(<PiedDePage />, { wrapper: enrobage })

    // Le numéro sort tel quel : c'est ce qui permet de voir, sans rien
    // ouvrir, laquelle des deux images est en retard sur l'autre.
    expect(await screen.findByText(/serveur 1\.2\.0/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'recharger' })).toBeInTheDocument()
  })

  it('raccourcit un serveur resté sur une image d’avant les numéros', async () => {
    // Les images publiées avant que les livraisons soient numérotées portent
    // un SHA de 40 caractères. Le cas disparaît dès qu'elles ont été tirées
    // une fois, mais il est bien réel le jour du passage - et 40 caractères
    // au bas d'un écran de 375 px ne se lisent pas.
    api.lireVersionServeur.mockResolvedValue({ version: 'a'.repeat(40) })
    render(<PiedDePage />, { wrapper: enrobage })

    expect(await screen.findByText(/serveur aaaaaaa/)).toBeInTheDocument()
  })
})

describe('sur un poste de travail', () => {
  it('ne présente pas deux brouillons comme un écart à réparer', async () => {
    // L'interface vient du serveur de développement, l'API d'une image
    // construite à la main : deux valeurs différentes, et rien à réparer.
    // Le dire à chaque écran apprendrait à ignorer la ligne le jour où
    // l'écart est vrai.
    poste.versionInterface = '1.4.0-dev'
    api.lireVersionServeur.mockResolvedValue({ version: 'dev' })
    render(<PiedDePage />, { wrapper: enrobage })

    await waitFor(() => expect(api.lireVersionServeur).toHaveBeenCalled())
    expect(screen.getByText(/^Version 1\.4\.0-dev/)).toBeInTheDocument()
    expect(screen.queryByText(/serveur/)).not.toBeInTheDocument()
  })
})

describe('à la porte, avant toute session', () => {
  it('affiche la version de l’interface sans rien demander au serveur', async () => {
    // L'écran de connexion vit hors du shell : c'est le seul endroit où ce
    // pied de page s'affiche sans session, et c'est là que la question se pose
    // le plus fort - quand on n'entre pas, on veut savoir ce qui tourne.
    render(<PiedDePage sansSession />, { wrapper: enrobage })

    expect(await screen.findByText(/^Version /)).toBeInTheDocument()
    // La route exige une session : l'appeler ici n'ajouterait qu'un 401 dans
    // la console de quelqu'un qui n'est pas encore entré.
    expect(api.lireVersionServeur).not.toHaveBeenCalled()
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
