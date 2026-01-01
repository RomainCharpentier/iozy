import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { QuestionService } from '../services/questionService'
import type { Question } from '../services/types'
import QuestionEditor from './EditorPage/QuestionEditor'

export default function EditorPage() {
  const navigate = useNavigate()
  const [questions, setQuestions] = useState<Question[]>([])

  useEffect(() => {
    const loadQuestions = async () => {
      const loadedQuestions = await QuestionService.getAllQuestions()
      setQuestions(loadedQuestions)
    }
    loadQuestions()
  }, [])

  return (
    <>
      <header className="app-header">
        <button
          className="editor-toggle-button"
          onClick={() => navigate('/')}
        >
          ← Retour au menu
        </button>
      </header>
      <QuestionEditor
        questions={questions}
        onSave={async (updatedQuestions) => {
          await QuestionService.saveQuestions(updatedQuestions)
          setQuestions(updatedQuestions)
        }}
        onClose={() => navigate('/')}
      />
    </>
  )
}







