/**
 * Menus et boutons de l'écran de jeu : barre du haut (Inviter / Son / Quitter),
 * confirmation de sortie, bouton « Passer » (vote) et actions de l'écran de fin.
 */
import { vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { Player } from '@/lib/game/types'

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: toastError }),
}))

// Pas d'AudioContext dans jsdom
vi.mock('@/utils/sounds', () => ({
  soundManager: {
    playClick: vi.fn(),
    playStart: vi.fn(),
    playSuccess: vi.fn(),
  },
}))

vi.mock('@/utils/playerId', () => ({
  getPlayerId: () => 'me',
}))

import GameTopBar from '@/pages/GamePage/ui/GameTopBar'
import QuitGameDialog, { getQuitConfirmMessage } from '@/pages/GamePage/ui/QuitGameDialog'
import AnswerInput from '@/pages/GamePage/question/AnswerInput'
import EndScreen from '@/pages/GamePage/ui/EndScreen'
import { getSkipButtonState } from '@/pages/GamePage/question/skipButton'
import { useState } from 'react'

const INVITE = 'http://localhost/?room=ABC123'
// Référence stable : un tableau recréé à chaque rendu relancerait l'effet de suggestions en boucle
const NO_SUGGESTIONS: string[] = []

const players: Player[] = [
  { id: 'me', name: 'Moi', score: 2, isHost: true, connected: true },
  { id: 'other', name: 'Autre', score: 1, connected: true },
]

beforeEach(() => {
  toastSuccess.mockClear()
  toastError.mockClear()
})

/** Barre du haut + confirmation, branchées comme dans Game */
function TopBarWithQuit({
  isHost,
  onLeaveRoom,
  onEndGame,
}: {
  isHost: boolean
  onLeaveRoom: () => void
  onEndGame: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <GameTopBar
        currentQuestionIndex={0}
        totalQuestions={5}
        timeRemaining={12}
        score={0}
        inviteLink={INVITE}
        onToggleMute={() => {}}
        onQuit={() => setOpen(true)}
      />
      <QuitGameDialog
        isOpen={open}
        isOnline
        isHost={isHost}
        isGameEnded={false}
        onLeaveRoom={onLeaveRoom}
        onEndGame={onEndGame}
        onCancel={() => setOpen(false)}
      />
    </>
  )
}

describe('Barre du haut', () => {
  it('affiche Inviter, Son et Quitter avec libellé, aria-label et infobulle, sans Paramètres', () => {
    render(
      <GameTopBar
        currentQuestionIndex={0}
        totalQuestions={5}
        timeRemaining={12}
        score={0}
        inviteLink={INVITE}
        onToggleMute={() => {}}
        onQuit={() => {}}
      />
    )
    for (const [testId, label] of [
      ['invite-button', 'Inviter'],
      ['mute-button', 'Son'],
      ['quit-button', 'Quitter'],
    ]) {
      const button = screen.getByTestId(testId)
      expect(button.textContent).toContain(label)
      expect(button.getAttribute('aria-label')).toBeTruthy()
      expect(button.getAttribute('title')).toBe(button.getAttribute('aria-label'))
    }
    expect(screen.queryByTitle(/Paramètres/)).toBeNull()
  })

  it('le bouton Son reflète et bascule l’état muet', () => {
    const onToggleMute = vi.fn()
    const { rerender } = render(
      <GameTopBar
        currentQuestionIndex={0}
        totalQuestions={5}
        timeRemaining={12}
        score={0}
        onToggleMute={onToggleMute}
        onQuit={() => {}}
      />
    )
    const button = screen.getByTestId('mute-button')
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(button.getAttribute('aria-label')).toBe('Couper le son')
    fireEvent.click(button)
    expect(onToggleMute).toHaveBeenCalledTimes(1)

    rerender(
      <GameTopBar
        currentQuestionIndex={0}
        totalQuestions={5}
        timeRemaining={12}
        score={0}
        muted
        onToggleMute={onToggleMute}
        onQuit={() => {}}
      />
    )
    expect(screen.getByTestId('mute-button').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('mute-button').getAttribute('aria-label')).toBe('Rétablir le son')
  })

  it('écran de fin : seulement Inviter et Quitter', () => {
    render(
      <GameTopBar
        currentQuestionIndex={4}
        totalQuestions={5}
        timeRemaining={0}
        score={3}
        inviteLink={INVITE}
        onToggleMute={() => {}}
        onQuit={() => {}}
        isGameEnded
      />
    )
    expect(screen.getByTestId('invite-button')).toBeTruthy()
    expect(screen.getByTestId('quit-button')).toBeTruthy()
    expect(screen.queryByTestId('mute-button')).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('Inviter copie le lien et affiche un toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(
      <GameTopBar
        currentQuestionIndex={0}
        totalQuestions={5}
        timeRemaining={12}
        score={0}
        inviteLink={INVITE}
        onQuit={() => {}}
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByTestId('invite-button'))
    })
    expect(writeText).toHaveBeenCalledWith(INVITE)
    expect(toastSuccess).toHaveBeenCalledWith('Lien du salon copié', expect.anything())
  })

  it('échec du presse-papiers : toast d’erreur avec le lien en clair', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('refus'))
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <GameTopBar
        currentQuestionIndex={0}
        totalQuestions={5}
        timeRemaining={12}
        score={0}
        inviteLink={INVITE}
        onQuit={() => {}}
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByTestId('invite-button'))
    })
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ description: INVITE })
    )
  })
})

describe('Confirmation de sortie', () => {
  it('Quitter ouvre une confirmation et ne quitte pas tout de suite', () => {
    const onLeaveRoom = vi.fn()
    const onEndGame = vi.fn()
    render(<TopBarWithQuit isHost={false} onLeaveRoom={onLeaveRoom} onEndGame={onEndGame} />)
    fireEvent.click(screen.getByTestId('quit-button'))

    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('Quitter la partie ?')
    expect(dialog.textContent).toContain("Vous ne pourrez revenir qu'avec le lien du salon.")
    expect(dialog.textContent).not.toContain("L'hôte sera transmis")
    expect(onLeaveRoom).not.toHaveBeenCalled()
    expect(onEndGame).not.toHaveBeenCalled()
  })

  it('Rester ferme la confirmation sans quitter', () => {
    const onLeaveRoom = vi.fn()
    const onEndGame = vi.fn()
    render(<TopBarWithQuit isHost={false} onLeaveRoom={onLeaveRoom} onEndGame={onEndGame} />)
    fireEvent.click(screen.getByTestId('quit-button'))
    fireEvent.click(screen.getByRole('button', { name: 'Rester' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onLeaveRoom).not.toHaveBeenCalled()
    expect(onEndGame).not.toHaveBeenCalled()
  })

  it('confirmer quitte le salon PUIS revient à l’accueil (hôte : transmission annoncée)', () => {
    const calls: string[] = []
    render(
      <TopBarWithQuit
        isHost
        onLeaveRoom={() => calls.push('leaveRoom')}
        onEndGame={() => calls.push('onEndGame')}
      />
    )
    fireEvent.click(screen.getByTestId('quit-button'))
    expect(screen.getByRole('dialog').textContent).toContain(
      "L'hôte sera transmis à un autre joueur."
    )
    fireEvent.click(screen.getByRole('button', { name: 'Quitter' }))
    expect(calls).toEqual(['leaveRoom', 'onEndGame'])
  })

  it('texte du message selon le rôle', () => {
    expect(getQuitConfirmMessage(true, false)).toBe(
      "Vous ne pourrez revenir qu'avec le lien du salon."
    )
    expect(getQuitConfirmMessage(true, true)).toBe(
      "Vous ne pourrez revenir qu'avec le lien du salon. L'hôte sera transmis à un autre joueur."
    )
  })
})

describe('Bouton Passer', () => {
  const renderInput = (props: Partial<React.ComponentProps<typeof AnswerInput>> = {}) =>
    render(
      <AnswerInput
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        disabled={false}
        onSkipVote={() => {}}
        gameMode="online"
        players={players}
        isMediaReady
        suggestionPool={NO_SUGGESTIONS}
        {...props}
      />
    )

  it('multijoueur : « Passer » avec infobulle expliquant le vote', () => {
    const onSkipVote = vi.fn()
    renderInput({ onSkipVote })
    const button = screen.getByTestId('skip-button') as HTMLButtonElement
    expect(button.textContent).toContain('Passer')
    expect(button.title).toBe('Vote pour passer : tous les joueurs doivent voter')
    expect(button.disabled).toBe(false)
    fireEvent.click(button)
    expect(onSkipVote).toHaveBeenCalledTimes(1)
  })

  it('après le vote : reste visible, désactivé, avec le compteur X/Y (joueurs connectés)', () => {
    const { rerender } = renderInput({ skipVotes: new Set(['me']) })
    let button = screen.getByTestId('skip-button') as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.textContent).toContain('Vote envoyé · 1/2')

    // Mise à jour via skipVotes ; un joueur déconnecté ne compte pas dans Y
    const withOffline = [...players, { id: 'off', name: 'Parti', score: 0, connected: false }]
    rerender(
      <AnswerInput
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        disabled={false}
        onSkipVote={() => {}}
        gameMode="online"
        players={withOffline}
        isMediaReady
        suggestionPool={NO_SUGGESTIONS}
        skipVotes={new Set(['me', 'other'])}
      />
    )
    button = screen.getByTestId('skip-button') as HTMLButtonElement
    expect(button.textContent).toContain('Vote envoyé · 2/2')
  })

  it('pendant le reveal : « Suivant » (vote pour passer à la suite)', () => {
    renderInput({ isReveal: true })
    const button = screen.getByTestId('skip-button') as HTMLButtonElement
    expect(button.textContent).toContain('Suivant')
    expect(button.title).toContain('tous les joueurs doivent voter')
  })

  it('solo : « Passer » sans vote ni compteur', () => {
    renderInput({ gameMode: 'solo', players: [] })
    const button = screen.getByTestId('skip-button') as HTMLButtonElement
    expect(button.textContent).toContain('Passer')
    expect(button.title).toBe('Passer cette question')
    expect(button.textContent).not.toContain('/')
  })

  it('média pas encore lancé : visible mais désactivé', () => {
    renderInput({ isMediaReady: false })
    const button = screen.getByTestId('skip-button') as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.title).toBe('Attendez que le média démarre')
  })

  it('getSkipButtonState : le total ne descend jamais sous le nombre de votes', () => {
    const state = getSkipButtonState({
      solo: false,
      isReveal: false,
      ready: true,
      hasVoted: true,
      votes: 3,
      total: 2,
    })
    expect(state.label).toBe('Vote envoyé · 3/3')
    expect(state.disabled).toBe(true)
  })
})

describe('Écran de fin', () => {
  const renderEnd = (isHost: boolean) => {
    const handlers = { onRestart: vi.fn(), onChangeThemes: vi.fn(), onQuit: vi.fn() }
    render(
      <EndScreen
        score={0}
        totalQuestions={5}
        gameMode="online"
        players={players}
        isHost={isHost}
        shouldPlaySound={false}
        onSoundPlayed={() => {}}
        {...handlers}
      />
    )
    return handlers
  }

  it('hôte : Rejouer, Changer les thèmes et Quitter le salon', () => {
    const handlers = renderEnd(true)
    const labels = screen.getAllByRole('button').map((b) => b.textContent?.trim())
    expect(labels).toEqual(['🔄 Rejouer', '🎨 Changer les thèmes', '🚪 Quitter le salon'])
    fireEvent.click(screen.getByRole('button', { name: /Rejouer/ }))
    fireEvent.click(screen.getByRole('button', { name: /Changer les thèmes/ }))
    fireEvent.click(screen.getByRole('button', { name: /Quitter le salon/ }))
    expect(handlers.onRestart).toHaveBeenCalledTimes(1)
    expect(handlers.onChangeThemes).toHaveBeenCalledTimes(1)
    expect(handlers.onQuit).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/En attente de l'hôte/)).toBeNull()
  })

  it('invité : message d’attente et Quitter le salon seulement', () => {
    const handlers = renderEnd(false)
    expect(screen.getByText(/En attente de l'hôte pour une nouvelle partie…/)).toBeTruthy()
    const labels = screen.getAllByRole('button').map((b) => b.textContent?.trim())
    expect(labels).toEqual(['🚪 Quitter le salon'])
    fireEvent.click(screen.getByRole('button', { name: /Quitter le salon/ }))
    expect(handlers.onQuit).toHaveBeenCalledTimes(1)
  })

  it('classement final : la couronne remplace le rang du vainqueur', () => {
    renderEnd(false)
    const crown = screen.getByTitle('Vainqueur')
    expect(crown.textContent).toBe('👑')
    // Le nom du vainqueur n'inclut pas la couronne
    expect(screen.getByText('Moi').textContent).toBe('Moi')
    expect(screen.getByText('#2')).toBeTruthy()
  })
})
