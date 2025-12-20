import { useState, useRef, useEffect } from 'react'
import QuestionCard from './QuestionCard'
import Score from './Score'
import TimeUpModal from './TimeUpModal'
import CategorySelector from './CategorySelector'
import { Category, Question, GameMode, Player } from '../types'
import { soundManager } from '../utils/sounds'
import { getSocket } from '../utils/socket'
import questionsData from '../data/questions.json'

type QuestionsData = Record<Category, Question[]>

interface GameProps {
  questions: Question[]
  categories: Category[]
  gameMode: GameMode
  players: Player[]
  roomCode?: string | null
  onEndGame: () => void
  onRestartWithNewCategories?: () => void
}

export default function Game({ questions, categories, gameMode, players, roomCode, onEndGame, onRestartWithNewCategories }: GameProps) {
  console.log('🎮 [Game] ===== COMPOSANT GAME MONTÉ =====', {
    questionsCount: questions.length,
    gameMode,
    roomCode,
    playersCount: players.length,
    categoriesCount: categories.length,
    timestamp: new Date().toISOString()
  })

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [gamePlayers, setGamePlayers] = useState<Player[]>(players)
  const [showScore, setShowScore] = useState(false)
  const [showEndModal, setShowEndModal] = useState(false)
  const [isHost, setIsHost] = useState(true)
  const [gameStarted, setGameStarted] = useState(gameMode === 'solo') // En solo, la partie démarre directement
  const [showCategorySelector, setShowCategorySelector] = useState(false)

  console.log('🎮 [Game] État initial:', {
    gameStarted,
    gameMode,
    currentQuestionIndex,
    questionsCount: questions.length,
    socketId: getSocket()?.id,
    socketConnected: getSocket()?.connected
  })

  // Debug: logger quand gameStarted change
  useEffect(() => {
    console.log('🔄 [Game] gameStarted changé:', gameStarted, { gameMode, roomCode, questionsCount: questions.length, timestamp: new Date().toISOString() })
  }, [gameStarted, gameMode, roomCode, questions.length])
  const questionsRef = useRef(questions)
  const timeoutRefs = useRef<number[]>([])
  const isTransitioningRef = useRef(false)
  const questionAnsweredByRef = useRef<string | null>(null) // ID du joueur qui a répondu correctement

  // Mettre à jour la référence quand questions change
  useEffect(() => {
    questionsRef.current = questions
    console.log('Questions mises à jour:', questions.length, questions)
  }, [questions])

  // Réinitialiser les joueurs au début de la partie
  useEffect(() => {
    setGamePlayers(players.map(p => ({ ...p, score: 0 })))
  }, [])

  // Écouter les événements Socket.io en mode multijoueur en ligne
  useEffect(() => {
    if (gameMode !== 'online' || !roomCode) {
      console.log('⏭️ [Game] Pas en mode multijoueur ou pas de roomCode', { gameMode, roomCode })
      return
    }

    const socket = getSocket()
    if (!socket) {
      console.error('❌ [Game] Socket non disponible')
      return
    }

    if (!socket.connected) {
      console.warn('⚠️ [Game] Socket non connecté, attente de la connexion...')
      const handleConnect = () => {
        console.log('✅ [Game] Socket connecté, réinitialisation des listeners')
        socket.off('connect', handleConnect)
        // Réessayer après la connexion
        setTimeout(() => {
          // Le useEffect se réexécutera automatiquement
        }, 100)
      }
      socket.on('connect', handleConnect)
      return () => {
        socket.off('connect', handleConnect)
      }
    }

    // Le socket devrait déjà être dans la room via RoomCreator
    // Ne pas rejoindre à nouveau pour éviter de créer un nouveau joueur
    console.log('🚪 [Game] Socket devrait déjà être dans la room:', roomCode, 'socketId:', socket.id)

    console.log('🎮 [Game] Configuration des listeners Socket.io', {
      socketId: socket.id,
      connected: socket.connected,
      roomCode,
      gameMode,
      questionsCount: questions.length,
      gameStarted
    })

    // Écouter le démarrage de la partie
    const handleGameStarted = ({ currentQuestion, questionIndex, players: updatedPlayers }: { currentQuestion: Question, questionIndex: number, players?: Player[] }) => {
      console.log('🎮 [Game] ===== GAME-STARTED REÇU ! =====', {
        currentQuestion: currentQuestion?.id || currentQuestion?.answer,
        questionIndex,
        socketId: socket.id,
        questionsCount: questions.length,
        updatedPlayersCount: updatedPlayers?.length
      })
      console.log('🎮 [Game] Mise à jour de currentQuestionIndex à:', questionIndex)
      setCurrentQuestionIndex(questionIndex)
      console.log('🎮 [Game] Mise à jour de gameStarted à true')
      setGameStarted(true)
      setShowScore(false) // S'assurer que l'écran de score est fermé
      setShowEndModal(false) // S'assurer que le modal est fermé
      if (updatedPlayers) {
        console.log('🎮 [Game] Mise à jour des joueurs:', updatedPlayers)
        // Réinitialiser les scores si c'est un restart
        setGamePlayers(updatedPlayers.map(p => ({ ...p, score: 0 })))
      }
      console.log('🎮 [Game] ===== GAME-STARTED TRAITÉ =====')
    }

    // Écouter TOUS les événements pour debug
    const handleAnyEvent = (eventName: string, ...args: any[]) => {
      console.log('📡 [Game] Événement Socket.io reçu:', eventName, args)
      if (eventName === 'game-started') {
        console.log('🎯 [Game] game-started détecté via onAny!')
      }
    }
    socket.onAny(handleAnyEvent)

    console.log('📡 [Game] Demande de l\'état de la partie au serveur')
    // Demander l'état de la partie au serveur au cas où elle aurait déjà démarré
    socket.emit('get-game-state', { roomCode })

    // Écouter les réponses correctes
    const handleCorrectAnswer = ({ playerId, playerName, score, players: updatedPlayers }: { playerId: string, playerName: string, score: number, players?: Player[] }) => {
      console.log('Réponse correcte de:', playerId, playerName, score)
      questionAnsweredByRef.current = playerId
      // Mettre à jour les scores avec la liste complète des joueurs si disponible
      if (updatedPlayers) {
        setGamePlayers(updatedPlayers)
      } else {
        // Sinon, mettre à jour uniquement le joueur concerné
        setGamePlayers(prev => prev.map(p =>
          p.id === playerId ? { ...p, score } : p
        ))
      }
    }

    // Écouter le passage à la question suivante
    const handleNextQuestion = ({ currentQuestion, questionIndex }: { currentQuestion: Question, questionIndex: number }) => {
      console.log('Question suivante:', questionIndex, currentQuestion)
      setCurrentQuestionIndex(questionIndex)
      questionAnsweredByRef.current = null
      isTransitioningRef.current = false
    }

    // Écouter la fin de partie
    const handleGameEnded = ({ players: finalPlayers }: { players: Player[] }) => {
      console.log('Partie terminée !', finalPlayers)
      setGamePlayers(finalPlayers)
      setShowEndModal(true)
    }

    socket.on('game-started', handleGameStarted)
    socket.on('correct-answer', handleCorrectAnswer)
    socket.on('next-question', handleNextQuestion)
    socket.on('game-ended', handleGameEnded)

    return () => {
      console.log('🧹 [Game] Nettoyage des listeners Socket.io')
      socket.off('game-started', handleGameStarted)
      socket.off('correct-answer', handleCorrectAnswer)
      socket.off('next-question', handleNextQuestion)
      socket.off('game-ended', handleGameEnded)
      socket.offAny(handleAnyEvent)
    }
  }, [gameMode, roomCode])

  // Vérifier si on est l'hôte en mode multijoueur en ligne
  useEffect(() => {
    if (gameMode === 'online' && roomCode) {
      const socket = getSocket()
      if (socket) {
        // Vérifier si on est l'hôte en comparant notre socket.id avec les joueurs
        const currentPlayer = gamePlayers.find(p => p.id === socket.id)
        setIsHost(currentPlayer?.isHost || false)
      }
    } else {
      setIsHost(true) // En solo, on est toujours "hôte"
    }
  }, [gameMode, roomCode, gamePlayers])

  // Nettoyer les timeouts quand le composant se démonte
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId))
    }
  }, [])

  const handleAnswer = (isCorrect: boolean, timeRemaining: number, playerId?: string) => {
    if (isCorrect) {
      if (gameMode === 'solo') {
        setScore(prev => prev + 1)
      }
      // En mode en ligne, la gestion se fait via Socket.io dans le backend
    }

    // Éviter les appels multiples
    if (isTransitioningRef.current) return
    isTransitioningRef.current = true

    // Passer à la question suivante après 3 secondes pour laisser le temps de voir la réponse
    const timeoutId = window.setTimeout(() => {
      // Réinitialiser pour la prochaine question
      questionAnsweredByRef.current = null

      setCurrentQuestionIndex(prev => {
        const totalQuestions = questionsRef.current.length
        console.log('handleAnswer - prev:', prev, 'totalQuestions:', totalQuestions, 'nextIndex:', prev + 1)
        // Vérifier si on peut passer à la question suivante
        if (prev + 1 < totalQuestions) {
          console.log('Passage à la question suivante:', prev + 1)
          isTransitioningRef.current = false
          return prev + 1
        } else {
          // On est à la dernière question, afficher le modal de fin
          console.log('Dernière question atteinte, affichage du modal')
          setShowEndModal(true)
          isTransitioningRef.current = false
          return prev // Garder l'index actuel pour afficher la dernière question avec le modal
        }
      })
    }, 3000)
    timeoutRefs.current.push(timeoutId)
  }

  const handleTimeUp = () => {
    // Éviter les appels multiples
    if (isTransitioningRef.current) {
      console.log('handleTimeUp ignoré - transition en cours')
      return
    }
    isTransitioningRef.current = true

    // Réinitialiser pour la prochaine question
    questionAnsweredByRef.current = null

    // Passer à la question suivante après 5 secondes pour laisser le temps à la vidéo de se révéler
    const timeoutId = window.setTimeout(() => {
      setCurrentQuestionIndex(prev => {
        const totalQuestions = questionsRef.current.length
        console.log('handleTimeUp - prev:', prev, 'totalQuestions:', totalQuestions, 'nextIndex:', prev + 1)
        // Vérifier si on peut passer à la question suivante
        if (prev + 1 < totalQuestions) {
          console.log('Passage à la question suivante:', prev + 1)
          isTransitioningRef.current = false
          return prev + 1
        } else {
          // On est à la dernière question, afficher le modal de fin
          console.log('Dernière question atteinte, affichage du modal')
          setShowEndModal(true)
          isTransitioningRef.current = false
          return prev // Garder l'index actuel pour afficher la dernière question avec le modal
        }
      })
    }, 5000)
    timeoutRefs.current.push(timeoutId)
  }

  const handleCloseEndModal = () => {
    setShowEndModal(false)
    setShowScore(true)
  }

  const handleRestart = () => {
    if (gameMode === 'online' && roomCode) {
      // En mode multijoueur en ligne, émettre un événement au serveur pour relancer la partie
      const socket = getSocket()
      if (socket) {
        console.log('🔄 [Game] Relance de la partie en mode multijoueur, émission de restart-game')
        socket.emit('restart-game', { roomCode })
        // Réinitialiser l'état local
        setCurrentQuestionIndex(0)
        setScore(0)
        setShowScore(false)
        setShowEndModal(false)
        questionAnsweredByRef.current = null
        setGameStarted(false) // Attendre que le serveur redémarre la partie
      }
    } else {
      // Mode solo : relancer directement
      setCurrentQuestionIndex(0)
      setScore(0)
      setGamePlayers(players.map(p => ({ ...p, score: 0 })))
      setShowScore(false)
      setShowEndModal(false)
      questionAnsweredByRef.current = null
    }
  }

  const handleRestartWithNewCategories = () => {
    // Ouvrir le sélecteur de catégories en popup
    setShowCategorySelector(true)
  }

  const handleCategorySelected = (selectedCategories: Category[], mode: GameMode, configuredPlayers: Player[], name: string) => {
    if (selectedCategories.length === 0) {
      alert('Veuillez sélectionner au moins une catégorie !')
      return
    }

    // Récupérer les questions des nouvelles catégories
    const allQuestionsDataTyped = questionsData as QuestionsData
    const allQuestions: Question[] = []
    selectedCategories.forEach(category => {
      const categoryQuestions = allQuestionsDataTyped[category] || []
      allQuestions.push(...categoryQuestions)
    })

    if (allQuestions.length === 0) {
      alert('Aucune question disponible pour les catégories sélectionnées !')
      return
    }

    // Mélanger les questions
    const shuffledQuestions = allQuestions.sort(() => Math.random() - 0.5)

    if (gameMode === 'online' && roomCode) {
      // En mode multijoueur en ligne, émettre les nouvelles questions au serveur
      const socket = getSocket()
      if (socket) {
        console.log('🔄 [Game] Relance avec nouveaux thèmes en mode multijoueur')
        socket.emit('restart-game-with-categories', {
          roomCode,
          questions: shuffledQuestions,
          categories: selectedCategories
        })
        setShowCategorySelector(false)
        // Réinitialiser l'état local
        setCurrentQuestionIndex(0)
        setScore(0)
        setShowScore(false)
        setShowEndModal(false)
        questionAnsweredByRef.current = null
        setGameStarted(false) // Attendre que le serveur redémarre la partie
      }
    } else {
      // Mode solo : relancer directement avec les nouvelles questions
      // Pour le mode solo, on peut simplement relancer avec les nouvelles catégories
      // mais comme on n'a pas accès à onSelectNewCategories, on va juste fermer la popup
      // et laisser l'utilisateur relancer depuis le menu
      setShowCategorySelector(false)
      alert('Pour le mode solo, veuillez relancer depuis le menu principal.')
    }
  }

  if (showScore) {
    return (
      <Score
        score={gameMode === 'solo' ? score : 0}
        totalQuestions={questions.length}
        gameMode={gameMode}
        players={gamePlayers}
        isHost={isHost}
        onRestart={handleRestart}
        onRestartWithNewCategories={handleRestartWithNewCategories}
        onQuit={onEndGame}
      />
    )
  }

  if (questions.length === 0) {
    return (
      <div className="no-questions">
        <p>Aucune question disponible pour les catégories sélectionnées.</p>
        <button onClick={onEndGame}>Retour au menu</button>
      </div>
    )
  }

  // En mode multijoueur en ligne, attendre que la partie démarre
  if (gameMode === 'online' && !gameStarted) {
    console.log('⏳ [Game] ===== EN ATTENTE DU DÉMARRAGE =====', {
      gameMode,
      gameStarted,
      roomCode,
      questionsCount: questions.length,
      playersCount: players.length,
      currentQuestionIndex,
      socketId: getSocket()?.id,
      socketConnected: getSocket()?.connected
    })
    return (
      <div className="no-questions">
        <div className="loading-state">
          <h2>En attente du démarrage...</h2>
          <p>L'hôte va démarrer la partie.</p>
          <div className="spinner"></div>
          <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Debug: gameStarted={gameStarted ? 'true' : 'false'}, questions={questions.length}, roomCode={roomCode}
          </p>
          <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Socket: {getSocket()?.id || 'non connecté'}, Connected: {getSocket()?.connected ? 'oui' : 'non'}
          </p>
        </div>
      </div>
    )
  }

  // Vérification de sécurité pour éviter les erreurs d'index
  if (currentQuestionIndex < 0 || currentQuestionIndex >= questions.length) {
    return (
      <div className="no-questions">
        <p>Erreur : Index de question invalide.</p>
        <button onClick={onEndGame}>Retour au menu</button>
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]
  const percentage = gameMode === 'solo'
    ? Math.round((score / questions.length) * 100)
    : 0

  // Vérification de sécurité pour éviter les erreurs
  if (!currentQuestion) {
    return (
      <div className="no-questions">
        <p>Erreur : Question introuvable.</p>
        <button onClick={onEndGame}>Retour au menu</button>
      </div>
    )
  }

  return (
    <div className="game">
      <div className="game-header">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
        <div className="question-counter">
          Question {currentQuestionIndex + 1} / {questions.length}
        </div>
        {gameMode === 'solo' ? (
          <div className="current-score">Score: {score}</div>
        ) : (
          <div className="multiplayer-scores">
            {gamePlayers.map(player => (
              <div
                key={player.id}
                className={`player-score ${questionAnsweredByRef.current === player.id ? 'answered' : ''}`}
              >
                {player.name}: {player.score}
              </div>
            ))}
          </div>
        )}
      </div>

      <QuestionCard
        question={currentQuestion}
        onAnswer={handleAnswer}
        onTimeUp={handleTimeUp}
        gameMode={gameMode}
        players={gamePlayers}
        questionAnsweredBy={questionAnsweredByRef.current}
      />

      <button
        className="quit-button"
        onClick={() => {
          soundManager.playClick()
          onEndGame()
        }}
      >
        Quitter la partie
      </button>

      {/* Modal de fin de partie - overlay au-dessus */}
      {showEndModal && (
        <TimeUpModal
          isOpen={true}
          answer={`Score final : ${score} / ${questions.length} (${percentage}%)`}
          onClose={handleCloseEndModal}
        />
      )}

      {/* Popup de sélection des catégories */}
      {showCategorySelector && (
        <>
          <div
            className="category-selector-overlay"
            onClick={() => setShowCategorySelector(false)}
          />
          <div className="category-selector-popup">
            <div className="category-selector-popup-content">
              <h2>🎯 Sélectionner de nouveaux thèmes</h2>
              <CategorySelector
                onStartGame={handleCategorySelected}
                defaultMode={gameMode}
              />
              <button
                className="close-popup-button"
                onClick={() => setShowCategorySelector(false)}
              >
                Annuler
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
