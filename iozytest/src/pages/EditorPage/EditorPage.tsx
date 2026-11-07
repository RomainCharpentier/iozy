import styles from '@/pages/EditorPage/EditorPage.module.scss'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { QuestionService } from '@/services/questionService'
import type { Question } from '@/types'
import QuestionEditor from '@/pages/EditorPage/QuestionEditor'
import CategoryManager from '@/pages/EditorPage/CategoryManager'
import BackLink from '@/components/common/BackLink'
import { FolderOpen, ListMusic } from 'lucide-react'

type EditorTab = 'questions' | 'categories'

export default function EditorPage() {
  const navigate = useNavigate()
  const [questions, setQuestions] = useState<Question[]>([])
  const [isLoading, setIsLoading] = useState(true)
  // Si le chargement échoue, l'éditeur n'est pas affiché : aucune sauvegarde possible
  const [loadError, setLoadError] = useState<string | null>(null)
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
      setLoadError(null)
    } catch (error) {
      console.error('Erreur lors du chargement des questions:', error)
      const message = error instanceof Error ? error.message : 'Erreur inconnue'
      setLoadError(message)
      toast.error('Erreur lors du chargement des questions : édition désactivée', {
        icon: '⚠️',
        description: message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = useCallback(async (updatedQuestions: Question[]) => {
    try {
      await QuestionService.saveQuestions(updatedQuestions)
      setQuestions(updatedQuestions)
      // Sauvegarde automatique silencieuse
    } catch (error) {
      console.error('Erreur lors de la sauvegarde automatique:', error)
      toast.error('Erreur lors de la sauvegarde des questions')
      throw error
    }
  }, [])

  return (
    <>
      <BackLink to="/" label="Jouer" />

      <div className={styles.editorContainer}>
        <div className={styles.editorTabs} role="tablist" aria-label="Sections de l'éditeur">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'questions'}
            className={`${styles.editorTab} ${activeTab === 'questions' ? styles.active : ''}`}
            onClick={() => setActiveTab('questions')}
          >
            <ListMusic size={16} aria-hidden="true" />
            Questions
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'categories'}
            className={`${styles.editorTab} ${activeTab === 'categories' ? styles.active : ''}`}
            onClick={() => setActiveTab('categories')}
          >
            <FolderOpen size={16} aria-hidden="true" />
            Catégories
          </button>
        </div>

        <div className={styles.editorContentWrapper}>
          {activeTab === 'categories' ? (
            <CategoryManager
              onClose={() => setActiveTab('questions')}
              onCategoriesChange={() => {
                setCategoriesVersion((v) => v + 1)
                loadQuestions()
              }}
            />
          ) : isLoading ? (
            <div className={styles.loadingState} role="status">
              Chargement des questions…
            </div>
          ) : loadError ? (
            <div className={styles.loadingState} role="alert">
              <p>
                Impossible de charger les questions. L&apos;édition est désactivée pour éviter toute
                perte de données.
              </p>
              <button type="button" className={styles.editorTab} onClick={() => loadQuestions()}>
                Réessayer
              </button>
            </div>
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
