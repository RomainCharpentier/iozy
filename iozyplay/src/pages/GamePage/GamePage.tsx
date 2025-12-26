import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameState } from '../../lib/game/GameContext'
import type { Category, Question } from '../../services/types'
import Game from './Game'

export default function GamePage() {
    const navigate = useNavigate()
    const { gameState, updateGameState, clearGameState } = useGameState()

    // En mode multijoueur, permettre l'accès même sans questions initiales
    // car les questions viendront du serveur via game:start
    const isMultiplayer = gameState?.gameMode === 'online'
    
    useEffect(() => {
        if (!gameState) {
            navigate('/')
            return
        }

        // En mode solo, les questions sont requises
        if (!isMultiplayer && (!gameState.questions || gameState.questions.length === 0)) {
            navigate('/')
        }
    }, [gameState, isMultiplayer, navigate])

    if (!gameState) {
        return null
    }

    // En mode solo, les questions sont requises
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
                questions: newQuestions
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

