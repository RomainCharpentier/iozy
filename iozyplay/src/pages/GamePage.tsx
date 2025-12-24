import { useNavigate } from 'react-router-dom'
import { useGameState } from '../contexts/GameContext'
import { Category, Question } from '../types'
import Game from './GamePage/Game'

export default function GamePage() {
    const navigate = useNavigate()
    const { gameState, updateGameState, clearGameState } = useGameState()

    // En mode multijoueur, permettre l'accès même sans questions initiales
    // car les questions viendront du serveur via game:start
    const isMultiplayer = gameState?.gameMode === 'online'
    
    if (!gameState) {
        navigate('/')
        return null
    }

    // En mode solo, les questions sont requises
    if (!isMultiplayer && (!gameState.questions || gameState.questions.length === 0)) {
        navigate('/')
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

