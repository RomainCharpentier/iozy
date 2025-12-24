import { useNavigate } from 'react-router-dom'
import { QuestionService } from '../../services/questionService'
import QuestionEditor from '../components/editor/QuestionEditor'

export default function EditorPage() {
  const navigate = useNavigate()

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
        questions={QuestionService.getAllQuestions()}
        onSave={(updatedQuestions) => {
          QuestionService.saveQuestions(updatedQuestions)
        }}
        onClose={() => navigate('/')}
      />
    </>
  )
}







