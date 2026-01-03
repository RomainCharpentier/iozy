import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { QuestionService } from '../../services/questionService'
import type { Question } from '../../services/types'
import QuestionEditor from './QuestionEditor'
import CategoryManager from './CategoryManager'

type EditorTab = 'questions' | 'categories'

export default function EditorPage() {
  const navigate = useNavigate()
  const [questions, setQuestions] = useState<Question[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<EditorTab>('questions')
  const [categoriesVersion, setCategoriesVersion] = useState(0)

  useEffect(() => {
    loadQuestions()
  }, [])

  const loadQuestions = async () => {
    try {
      setIsLoading(true)
      const allQuestions = await QuestionService.getAllQuestions()
      setQuestions(allQuestions)
    } catch (error) {
      console.error('Erreur lors du chargement des questions:', error)
      toast.error('Erreur lors du chargement des questions', {
        icon: '⚠️',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async (updatedQuestions: Question[]) => {
    try {
      await QuestionService.saveQuestions(updatedQuestions)
      setQuestions(updatedQuestions)
      // Sauvegarde automatique silencieuse
    } catch (error) {
      console.error('Erreur lors de la sauvegarde automatique:', error)
    }
  }

  return (
    <>
      <header className="app-header">
        <button
          type="button"
          className="editor-toggle-button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            navigate('/')
          }}
          aria-label="Retour au menu"
        >
          ← Retour au menu
        </button>
      </header>
      
      <div className="editor-container">
        <div className="editor-tabs">
          <button
            className={`editor-tab ${activeTab === 'questions' ? 'active' : ''}`}
            onClick={() => setActiveTab('questions')}
          >
            📝 Questions
          </button>
          <button
            className={`editor-tab ${activeTab === 'categories' ? 'active' : ''}`}
            onClick={() => setActiveTab('categories')}
          >
            📁 Catégories
          </button>
        </div>

        <div className="editor-content-wrapper">
          {activeTab === 'categories' ? (
            <CategoryManager
              onClose={() => setActiveTab('questions')}
              onCategoriesChange={() => {
                setCategoriesVersion(v => v + 1)
                loadQuestions()
              }}
            />
          ) : isLoading ? (
            <div className="loading-state">⏳ Chargement des questions...</div>
          ) : (
            <QuestionEditor
              key={categoriesVersion}
              questions={questions}
              onSave={handleSave}
              onClose={() => navigate('/')}
            />
          )}
        </div>
      </div>
    </>
  )
}







