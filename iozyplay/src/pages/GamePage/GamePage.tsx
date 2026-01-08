import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameState } from '../../lib/game/GameContext'
import type { Category, Question } from '../../types'
import Game from './Game'

export default function GamePage() {
    const navigate = useNavigate()
    const { gameState, updateGameState, clearGameState } = useGameState()

    const isMultiplayer = gameState?.gameMode === 'online'
    
    useEffect(() => {
        if (!gameState) {
            navigate('/')
            return
        }

        if (!isMultiplayer && (!gameState.questions || gameState.questions.length === 0)) {
            navigate('/')
        }
    }, [gameState, isMultiplayer, navigate])

    if (!gameState) {
        return null
    }

    if (!isMultiplayer && (!gameState.questions || gameState.questions.length === 0)) {
        return null
    }

    const handleEndGame = () => {
        clearGameState()
        navigate('/')
    }

    const handleRestartWithNewCategories = (newCategories: Category[], newQuestions: Question[]) => {
        if (gameState) {
            updateGameState({
                categories: newCategories,
                questions: newQuestions,
                players: gameState.players.map(p => ({ ...p, score: 0 }))
            })
        }
    }

    return (
        <Game
            questions={gameState.questions || []}
            categories={gameState.categories || []}
            gameMode={gameState.gameMode}
            players={gameState.players || []}
            roomCode={gameState.roomCode || null}
            onEndGame={handleEndGame}
            onRestartWithNewCategories={handleRestartWithNewCategories}
        />
    )
}

