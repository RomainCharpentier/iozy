/**
 * Envoi automatique de la réponse : le contenu du champ compte, sans validation explicite.
 */
import { vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAnswerAutoSend, AUTO_SEND_DELAY_MS } from '@/pages/GamePage/question/useAnswerAutoSend'

let send: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.useFakeTimers()
  send = vi.fn()
})

afterEach(() => {
  vi.useRealTimers()
})

const setup = (initial: { active?: boolean; delayMs?: number } = {}) =>
  renderHook(({ active, delayMs }) => useAnswerAutoSend({ active, delayMs, send }), {
    initialProps: {
      active: initial.active ?? true,
      delayMs: initial.delayMs ?? AUTO_SEND_DELAY_MS,
    },
  })

describe('useAnswerAutoSend', () => {
  it('envoie la saisie après le délai, une seule fois avec la dernière valeur', () => {
    const { result } = setup()
    act(() => {
      result.current.update('Nar')
      result.current.update('Naru')
      result.current.update('Naruto ')
    })
    expect(send).not.toHaveBeenCalled()
    expect(result.current.hasPending).toBe(true)

    act(() => {
      vi.advanceTimersByTime(AUTO_SEND_DELAY_MS)
    })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenLastCalledWith('Naruto')
    expect(result.current.lastSent).toBe('Naruto')
    expect(result.current.hasPending).toBe(false)
  })

  it('Entrée / suggestion : envoi immédiat, et la réponse reste modifiable ensuite', () => {
    const { result } = setup()
    act(() => result.current.submit('Naruto'))
    expect(send).toHaveBeenLastCalledWith('Naruto')

    act(() => {
      result.current.update('Bleach')
      vi.advanceTimersByTime(AUTO_SEND_DELAY_MS)
    })
    expect(send).toHaveBeenCalledTimes(2)
    expect(send).toHaveBeenLastCalledWith('Bleach')
  })

  it('le dernier envoyé est la dernière saisie (pas de doublon, pas de retour en arrière)', () => {
    const { result } = setup()
    act(() => {
      result.current.update('One')
      vi.advanceTimersByTime(AUTO_SEND_DELAY_MS)
      // Revenir à la valeur déjà enregistrée n'envoie rien
      result.current.update('Two')
      result.current.update('One')
      vi.advanceTimersByTime(AUTO_SEND_DELAY_MS)
    })
    expect(send.mock.calls.map((c) => c[0])).toEqual(['One'])
  })

  it('flush envoie la saisie en attente (avant un vote « Passer »)', () => {
    const { result } = setup()
    act(() => result.current.update('Naruto'))
    act(() => result.current.flush())
    expect(send).toHaveBeenLastCalledWith('Naruto')
    // Le délai expiré ne renvoie rien
    act(() => {
      vi.advanceTimersByTime(AUTO_SEND_DELAY_MS)
    })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('fin du guess : la saisie en attente part avant le gel, puis plus rien ne part', () => {
    const { result, rerender } = setup()
    act(() => result.current.update('Naruto'))
    rerender({ active: false, delayMs: AUTO_SEND_DELAY_MS })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenLastCalledWith('Naruto')

    act(() => {
      result.current.update('Triche')
      result.current.submit('Triche')
      result.current.flush()
      vi.advanceTimersByTime(AUTO_SEND_DELAY_MS)
    })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('délai 0 (solo, fin de chrono) : chaque modification part tout de suite', () => {
    const { result } = setup({ delayMs: 0 })
    act(() => result.current.update('N'))
    act(() => result.current.update('Na'))
    expect(send.mock.calls.map((c) => c[0])).toEqual(['N', 'Na'])
  })

  it('champ vidé : la réponse vide remplace la précédente (retrait), rien si rien envoyé', () => {
    const { result } = setup({ delayMs: 0 })
    act(() => result.current.update('   '))
    expect(send).not.toHaveBeenCalled()

    act(() => result.current.update('Naruto'))
    act(() => result.current.update(''))
    expect(send.mock.calls.map((c) => c[0])).toEqual(['Naruto', ''])
  })

  it('démontage (question suivante) : la saisie en attente est abandonnée', () => {
    const { result, unmount } = setup()
    act(() => result.current.update('Naruto'))
    unmount()
    act(() => {
      vi.advanceTimersByTime(AUTO_SEND_DELAY_MS * 2)
    })
    expect(send).not.toHaveBeenCalled()
  })
})
