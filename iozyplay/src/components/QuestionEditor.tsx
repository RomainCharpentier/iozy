import { useState, useEffect } from 'react'
import { Question, Category, MediaType } from '../types'
import { isYouTubeUrl } from '../utils/youtube'

interface QuestionEditorProps {
  questions: Question[]
  onSave: (questions: Question[]) => void
  onClose: () => void
}

export default function QuestionEditor({ questions, onSave, onClose }: QuestionEditorProps) {
  const [localQuestions, setLocalQuestions] = useState<Question[]>(questions)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all')

  // Form state (sans ID, généré automatiquement)
  const [formData, setFormData] = useState<Partial<Question>>({
    category: 'chansons',
    type: 'video',
    mediaUrl: '',
    answer: '',
    timeLimit: 5,
    hint: ''
  })

  useEffect(() => {
    setLocalQuestions(questions)
  }, [questions])

  const filteredQuestions = filterCategory === 'all' 
    ? localQuestions 
    : localQuestions.filter(q => q.category === filterCategory)

  // Générer un ID unique automatiquement
  const generateId = (category: Category): string => {
    const prefix = category.substring(0, 1).toLowerCase() // Première lettre de la catégorie
    const existingIds = localQuestions
      .filter(q => q.category === category && q.id.startsWith(prefix))
      .map(q => {
        const match = q.id.match(/\d+$/)
        return match ? parseInt(match[0]) : 0
      })
    
    const nextNumber = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1
    return `${prefix}${nextNumber}`
  }

  const handleAdd = () => {
    if (!formData.mediaUrl || !formData.answer) {
      alert('Veuillez remplir tous les champs obligatoires (URL média, Réponse)')
      return
    }

    const newQuestion: Question = {
      id: generateId(formData.category as Category),
      category: formData.category as Category,
      type: formData.type as MediaType,
      mediaUrl: formData.mediaUrl!,
      answer: formData.answer!,
      timeLimit: formData.timeLimit || 5,
      hint: formData.hint || undefined
    }

    setLocalQuestions([...localQuestions, newQuestion])
    resetForm()
    setShowAddForm(false)
  }

  const handleEdit = (index: number) => {
    const question = filteredQuestions[index]
    const globalIndex = localQuestions.findIndex(q => q.id === question.id)
    setEditingIndex(globalIndex)
    setFormData({ ...question })
    setShowAddForm(false)
  }

  const handleUpdate = () => {
    if (editingIndex === null || !formData.mediaUrl || !formData.answer) {
      alert('Veuillez remplir tous les champs obligatoires')
      return
    }

    // Conserver l'ID original lors de la modification
    const originalQuestion = localQuestions[editingIndex]
    const updatedQuestion: Question = {
      id: originalQuestion.id, // Garder l'ID original
      category: formData.category as Category,
      type: formData.type as MediaType,
      mediaUrl: formData.mediaUrl!,
      answer: formData.answer!,
      timeLimit: formData.timeLimit || 5,
      hint: formData.hint || undefined
    }

    const newQuestions = [...localQuestions]
    newQuestions[editingIndex] = updatedQuestion
    setLocalQuestions(newQuestions)
    resetForm()
    setEditingIndex(null)
  }

  const handleDelete = (index: number) => {
    const question = filteredQuestions[index]
    if (confirm(`Êtes-vous sûr de vouloir supprimer la question "${question.answer}" ?`)) {
      const newQuestions = localQuestions.filter(q => q.id !== question.id)
      setLocalQuestions(newQuestions)
    }
  }

  const handleSave = () => {
    onSave(localQuestions)
    alert('Questions sauvegardées avec succès !')
  }

  const resetForm = () => {
    setFormData({
      category: 'chansons',
      type: 'video',
      mediaUrl: '',
      answer: '',
      timeLimit: 5,
      hint: ''
    })
  }

  const cancelEdit = () => {
    resetForm()
    setEditingIndex(null)
    setShowAddForm(false)
  }

  const getCategoryLabel = (category: Category) => {
    const labels: Record<Category, string> = {
      chansons: 'Chansons',
      series: 'Séries TV',
      animes: 'Animes',
      films: 'Films',
      jeux: 'Jeux vidéo'
    }
    return labels[category]
  }

  const getTypeLabel = (type: MediaType) => {
    const labels: Record<MediaType, string> = {
      audio: 'Audio',
      image: 'Image',
      video: 'Vidéo'
    }
    return labels[type]
  }

  return (
    <div className="question-editor">
      <div className="editor-header">
        <h2>📝 Éditeur de Questions</h2>
        <div className="editor-actions">
          <button className="save-button" onClick={handleSave}>
            💾 Sauvegarder
          </button>
          <button className="close-button" onClick={onClose}>
            ✕ Fermer
          </button>
        </div>
      </div>

      <div className="editor-filters">
        <label>
          Filtrer par catégorie :
          <select 
            value={filterCategory} 
            onChange={(e) => setFilterCategory(e.target.value as Category | 'all')}
          >
            <option value="all">Toutes</option>
            <option value="chansons">Chansons</option>
            <option value="series">Séries TV</option>
            <option value="animes">Animes</option>
            <option value="films">Films</option>
            <option value="jeux">Jeux vidéo</option>
          </select>
        </label>
        <div className="question-count">
          {filteredQuestions.length} question{filteredQuestions.length > 1 ? 's' : ''}
        </div>
      </div>

      <div className="editor-content">
        <div className="questions-list">
          <div className="list-header">
            <h3>Liste des questions</h3>
            <button 
              className="add-button"
              onClick={() => {
                cancelEdit()
                setShowAddForm(true)
              }}
            >
              ➕ Ajouter une question
            </button>
          </div>

          {(showAddForm || editingIndex !== null) && (
            <div className="question-form">
              <h4>{editingIndex !== null ? 'Modifier la question' : 'Nouvelle question'}</h4>
              
              {editingIndex !== null && (
                <div className="form-info">
                  <span className="info-badge">ID: {localQuestions[editingIndex]?.id}</span>
                  <span className="info-text">(ID généré automatiquement, non modifiable)</span>
                </div>
              )}
              
              <div className="form-row">
                <label>
                  Catégorie *
                  <select
                    value={formData.category || 'chansons'}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as Category })}
                  >
                    <option value="chansons">Chansons</option>
                    <option value="series">Séries TV</option>
                    <option value="animes">Animes</option>
                    <option value="films">Films</option>
                    <option value="jeux">Jeux vidéo</option>
                  </select>
                </label>
                <label>
                  Type de média *
                  <select
                    value={formData.type || 'video'}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as MediaType })}
                  >
                    <option value="audio">Audio</option>
                    <option value="image">Image</option>
                    <option value="video">Vidéo</option>
                  </select>
                </label>
              </div>

              <div className="form-row">
                <label>
                  Temps limite (secondes)
                  <input
                    type="number"
                    value={formData.timeLimit || 5}
                    onChange={(e) => setFormData({ ...formData, timeLimit: parseInt(e.target.value) || 5 })}
                    min="1"
                    max="60"
                  />
                </label>
                {editingIndex === null && (
                  <label>
                    ID généré automatiquement
                    <input
                      type="text"
                      value={generateId(formData.category as Category)}
                      disabled
                      className="disabled-input"
                      title="L'ID sera généré automatiquement lors de l'ajout"
                    />
                  </label>
                )}
              </div>

              <label>
                URL du média * (YouTube, fichier local, ou URL externe)
                <input
                  type="text"
                  value={formData.mediaUrl || ''}
                  onChange={(e) => setFormData({ ...formData, mediaUrl: e.target.value })}
                  placeholder="https://youtu.be/..."
                />
                {formData.mediaUrl && isYouTubeUrl(formData.mediaUrl) && (
                  <span className="youtube-hint">✓ URL YouTube détectée</span>
                )}
              </label>

              <label>
                Réponse *
                <input
                  type="text"
                  value={formData.answer || ''}
                  onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                  placeholder="La réponse à deviner"
                />
              </label>

              <label>
                Indice (optionnel)
                <input
                  type="text"
                  value={formData.hint || ''}
                  onChange={(e) => setFormData({ ...formData, hint: e.target.value })}
                  placeholder="Un indice pour aider à deviner"
                />
              </label>

              <div className="form-actions">
                <button 
                  className="submit-button"
                  onClick={editingIndex !== null ? handleUpdate : handleAdd}
                >
                  {editingIndex !== null ? '💾 Mettre à jour' : '➕ Ajouter'}
                </button>
                <button className="cancel-button" onClick={cancelEdit}>
                  Annuler
                </button>
              </div>
            </div>
          )}

          <div className="questions-grid">
            {filteredQuestions.map((question, index) => (
              <div key={question.id} className="question-card-editor">
                <div className="question-card-header">
                  <span className="question-id">{question.id}</span>
                  <span className="question-category">{getCategoryLabel(question.category)}</span>
                  <span className="question-type">{getTypeLabel(question.type)}</span>
                </div>
                <div className="question-card-body">
                  <div className="question-media">
                    {question.type === 'image' && question.mediaUrl && (
                      <img src={question.mediaUrl} alt="Preview" className="media-preview" />
                    )}
                    {question.type === 'video' && isYouTubeUrl(question.mediaUrl) && (
                      <div className="youtube-preview">
                        🎥 YouTube: {question.mediaUrl.substring(0, 50)}...
                      </div>
                    )}
                    {question.type === 'audio' && (
                      <div className="audio-preview">🎵 Audio</div>
                    )}
                  </div>
                  <div className="question-info">
                    <div className="question-answer"><strong>Réponse:</strong> {question.answer}</div>
                    {question.hint && (
                      <div className="question-hint"><strong>Indice:</strong> {question.hint}</div>
                    )}
                    <div className="question-meta">
                      <span>⏱️ {question.timeLimit}s</span>
                      <span>🔗 {question.mediaUrl.substring(0, 30)}...</span>
                    </div>
                  </div>
                </div>
                <div className="question-card-actions">
                  <button 
                    className="edit-button"
                    onClick={() => handleEdit(index)}
                  >
                    ✏️ Modifier
                  </button>
                  <button 
                    className="delete-button"
                    onClick={() => handleDelete(index)}
                  >
                    🗑️ Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredQuestions.length === 0 && (
            <div className="empty-state">
              <p>📭 Aucune question dans cette catégorie</p>
              <button 
                className="add-button"
                onClick={() => {
                  cancelEdit()
                  setShowAddForm(true)
                }}
              >
                ➕ Ajouter la première question
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

