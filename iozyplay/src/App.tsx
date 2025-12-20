import { useState, useEffect } from 'react'
import HomeMenu from './components/HomeMenu'
import CategorySelector from './components/CategorySelector'
import Game from './components/Game'
import QuestionEditor from './components/QuestionEditor'
import RoomCreator from './components/RoomCreator'
import RoomJoiner from './components/RoomJoiner'
import { Category, Question, GameMode, Player } from './types'
import questionsData from './data/questions.json'

type QuestionsData = Record<Category, Question[]>

function App() {
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([])
  const [isGameActive, setIsGameActive] = useState(false)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [allQuestionsData, setAllQuestionsData] = useState<QuestionsData>(questionsData as QuestionsData)
  const [gameMode, setGameMode] = useState<GameMode>('solo')
  const [players, setPlayers] = useState<Player[]>([])
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState<string>('')
  const [showRoomCreator, setShowRoomCreator] = useState(false)
  const [showRoomJoiner, setShowRoomJoiner] = useState(false)
  const [showCategorySelector, setShowCategorySelector] = useState(false)
  const [categorySelectorMode, setCategorySelectorMode] = useState<'solo' | 'online' | undefined>(undefined)

  // Charger les questions depuis localStorage au démarrage
  useEffect(() => {
    const savedQuestions = localStorage.getItem('blindtest-questions')
    if (savedQuestions) {
      try {
        const parsed = JSON.parse(savedQuestions)
        setAllQuestionsData(parsed)
      } catch (e) {
        console.error('Erreur lors du chargement des questions:', e)
      }
    }

    // Vérifier si on rejoint un salon via URL
    const urlParams = new URLSearchParams(window.location.search)
    const roomParam = urlParams.get('room')
    if (roomParam) {
      setRoomCode(roomParam)
      setShowRoomJoiner(true)
    }
  }, [])

  const handleStartGame = (categories: Category[], mode: GameMode, configuredPlayers: Player[], name: string) => {
    if (categories.length === 0) {
      alert('Veuillez sélectionner au moins une catégorie !')
      return
    }

    const allQuestions: Question[] = []
    categories.forEach(category => {
      const categoryQuestions = allQuestionsData[category] || []
      allQuestions.push(...categoryQuestions)
    })

    if (allQuestions.length === 0) {
      alert('Aucune question disponible pour les catégories sélectionnées !')
      return
    }

    // Mélanger les questions
    const shuffledQuestions = allQuestions.sort(() => Math.random() - 0.5)
    
    setSelectedCategories(categories)
    setQuestions(shuffledQuestions)
    setGameMode(mode)
    setPlayerName(name)
    
    if (mode === 'online' && !roomCode) {
      // Mode multijoueur en ligne - créer un salon
      // Pas besoin de nom pour créer le salon
      setShowRoomCreator(true)
    } else {
      // Mode solo
      setPlayers(configuredPlayers.map(p => ({ ...p, score: 0 })))
      setIsGameActive(true)
    }
  }

  const handleRoomCreated = (code: string) => {
    console.log('🏠 [App] ===== handleRoomCreated APPELÉ =====', { 
      code, 
      gameMode, 
      questionsCount: questions.length,
      selectedCategoriesCount: selectedCategories.length,
      isGameActive,
      showRoomCreator,
      showCategorySelector
    })
    
    setRoomCode(code)
    console.log('🏠 [App] roomCode défini:', code)
    
    setIsGameActive(true)
    console.log('🏠 [App] isGameActive défini à true')
    
    setShowRoomCreator(false)
    console.log('🏠 [App] showRoomCreator défini à false')
    
    setShowCategorySelector(false)
    console.log('🏠 [App] showCategorySelector défini à false')
    
    console.log('🏠 [App] ===== handleRoomCreated TERMINÉ =====')
  }

  const handleRoomJoined = (code: string) => {
    setRoomCode(code)
    setIsGameActive(true)
    setShowRoomJoiner(false)
  }

  const handleEndGame = () => {
    setIsGameActive(false)
    setSelectedCategories([])
    setQuestions([])
    setRoomCode(null)
    setShowRoomCreator(false)
    setShowRoomJoiner(false)
    setShowCategorySelector(false)
    // Nettoyer l'URL
    window.history.replaceState({}, '', window.location.pathname)
  }

  const handleRestartWithNewCategories = () => {
    // Retourner à la sélection des catégories
    setIsGameActive(false)
    setQuestions([])
    // Préserver le mode de jeu actuel
    setCategorySelectorMode(gameMode === 'online' ? 'online' : 'solo')
    setShowCategorySelector(true)
    // Garder le mode et le roomCode pour le multijoueur
  }

  const handleSaveQuestions = (updatedQuestions: Question[]) => {
    // Organiser les questions par catégorie
    const organized: QuestionsData = {
      chansons: [],
      series: [],
      animes: [],
      films: [],
      jeux: []
    }

    updatedQuestions.forEach(q => {
      organized[q.category].push(q)
    })

    setAllQuestionsData(organized)
    
    // Sauvegarder dans localStorage
    localStorage.setItem('blindtest-questions', JSON.stringify(organized))
  }

  const getAllQuestions = (): Question[] => {
    const all: Question[] = []
    Object.values(allQuestionsData).forEach(categoryQuestions => {
      all.push(...categoryQuestions)
    })
    return all
  }

  const handleCreateGame = () => {
    // Ne pas définir de mode par défaut pour permettre à l'utilisateur de choisir
    setCategorySelectorMode(undefined)
    setShowCategorySelector(true)
  }

  const handleJoinRoom = () => {
    // La redirection se fait dans HomeMenu via window.location
  }

  // Log du render pour voir quel composant s'affiche
  console.log('🎨 [App] RENDER', {
    isEditorOpen,
    showRoomCreator,
    showRoomJoiner: showRoomJoiner && roomCode,
    showCategorySelector,
    isGameActive,
    gameMode,
    roomCode,
    questionsCount: questions.length
  })

  return (
    <div className="app">
      {isEditorOpen ? (
        <>
          <header className="app-header">
            <button 
              className="editor-toggle-button"
              onClick={() => setIsEditorOpen(false)}
            >
              ← Retour au menu
            </button>
          </header>
          <QuestionEditor
            questions={getAllQuestions()}
            onSave={handleSaveQuestions}
            onClose={() => setIsEditorOpen(false)}
          />
        </>
      ) : showRoomCreator ? (
        <RoomCreator
          categories={selectedCategories}
          questions={questions}
          playerName={playerName}
          onRoomCreated={handleRoomCreated}
          onBack={() => {
            setShowRoomCreator(false)
            setSelectedCategories([])
            setQuestions([])
            setShowCategorySelector(false)
          }}
        />
      ) : showRoomJoiner && roomCode ? (
        <RoomJoiner
          roomCode={roomCode}
          playerName={playerName}
          onJoined={handleRoomJoined}
          onBack={handleEndGame}
        />
      ) : showCategorySelector ? (
        <>
          <header className="app-header">
            <button 
              className="editor-toggle-button"
              onClick={() => {
                setShowCategorySelector(false)
                setSelectedCategories([])
              }}
            >
              ← Retour au menu
            </button>
          </header>
          <CategorySelector 
            onStartGame={handleStartGame}
            defaultMode={categorySelectorMode}
          />
        </>
      ) : isGameActive ? (
        <Game 
          questions={questions}
          categories={selectedCategories}
          gameMode={gameMode}
          players={players}
          roomCode={roomCode}
          onEndGame={handleEndGame}
          onRestartWithNewCategories={handleRestartWithNewCategories}
        />
      ) : (
        <HomeMenu
          onCreateGame={handleCreateGame}
          onJoinRoom={handleJoinRoom}
          onOpenEditor={() => setIsEditorOpen(true)}
        />
      )}
    </div>
  )
}

export default App

