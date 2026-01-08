import { createContext, useContext, useState, ReactNode } from 'react'
import type { Category, Question } from '../../types'
import type { GameMode, Player } from './types'

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

  const updateGameState = (updates: Partial<GameState>) => {
    if (gameState) {
      setGameState({ ...gameState, ...updates })
    }
  }

  const setRoomCode = (code: string) => {
    if (gameState) {
      setGameState({ ...gameState, roomCode: code })
    } else {
      // Initialiser le gameState avec les valeurs minimales pour le mode multijoueur
      setGameState({
        categories: [],
        questions: [],
        gameMode: 'online',
        players: [],
        playerName: '',
        roomCode: code
      })
    }
  }

  const startGame = () => {
    // Cette fonction peut être utilisée pour marquer le début du jeu
    // Pour l'instant, on ne fait rien de spécial
  }

  const clearGameState = () => {
    setGameState(null)
  }

  return (
    <GameContext.Provider value={{ gameState, setGameState, updateGameState, setRoomCode, startGame, clearGameState }}>
      {children}
    </GameContext.Provider>
  )
}

export function useGameState() {
  const context = useContext(GameContext)
  if (context === undefined) {
    throw new Error('useGameState must be used within a GameProvider')
  }
  return context
}

