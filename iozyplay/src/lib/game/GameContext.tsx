import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'
import type { Category, Question } from '@/types'
import type { GameMode, Player } from '@/lib/game/types'

interface GameState {
  categories: Category[]
  questions: Question[]
  gameMode: GameMode
  players: Player[]
  playerName: string
  roomCode?: string | null
}

interface GameContextType {
  gameState: GameState | null
  setGameState: (state: GameState) => void
  updateGameState: (updates: Partial<GameState>) => void
  setRoomCode: (code: string) => void
  startGame: () => void
  clearGameState: () => void
}

const GameContext = createContext<GameContextType | undefined>(undefined)

export function GameProvider({ children }: { children: ReactNode }) {
  const [gameState, setGameState] = useState<GameState | null>(null)

  const updateGameState = useCallback((updates: Partial<GameState>) => {
    setGameState((prev) => (prev ? { ...prev, ...updates } : prev))
  }, [])

  const setRoomCode = useCallback((code: string) => {
    setGameState((prev) =>
      prev
        ? { ...prev, roomCode: code }
        : {
            categories: [],
            questions: [],
            gameMode: 'online',
            players: [],
            playerName: '',
            roomCode: code,
          }
    )
  }, [])

  const startGame = useCallback(() => {
    // Cette fonction peut être utilisée pour marquer le début du jeu
  }, [])

  const clearGameState = useCallback(() => {
    setGameState(null)
  }, [])

  const value = useMemo(
    () => ({
      gameState,
      setGameState,
      updateGameState,
      setRoomCode,
      startGame,
      clearGameState,
    }),
    [gameState, updateGameState, setRoomCode, startGame, clearGameState]
  )

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGameState() {
  const context = useContext(GameContext)
  if (context === undefined) {
    throw new Error('useGameState must be used within a GameProvider')
  }
  return context
}
