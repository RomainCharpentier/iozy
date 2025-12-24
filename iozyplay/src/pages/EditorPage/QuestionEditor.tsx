import { useState, useEffect } from 'react'
import type { Category, Question, MediaType, CategoryInfo } from '../../services/types'
import { isYouTubeUrl, isValidUrlFormat, getYouTubeThumbnailFromUrl, extractYouTubeId, getYouTubeMetadata } from '../../utils/youtube'
import { QuestionService } from '../../services/questionService'
import { loadCategories } from '../../services/categoryService'
import CategorySelector from '../../components/editor/CategorySelector'

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
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false)
  const [youtubeThumbnail, setYoutubeThumbnail] = useState<string | null>(null)
  const [youtubeTitle, setYoutubeTitle] = useState<string>('')
  const [youtubeError, setYoutubeError] = useState<string | null>(null)
  const [youtubeValid, setYoutubeValid] = useState<boolean>(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    mediaUrl?: string
    answer?: string
  }>({})
  const [touchedFields, setTouchedFields] = useState<{
    mediaUrl?: boolean
    answer?: boolean
  }>({})
  const [categories, setCategories] = useState<CategoryInfo[]>([])

  // Form state (sans ID, généré automatiquement)
  const [formData, setFormData] = useState<Partial<Question>>({
    category: undefined,
    mediaUrl: '',
    answer: '',
    hint: ''
  })
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([])

  const [isInitialLoad, setIsInitialLoad] = useState(true)

  useEffect(() => {
    setLocalQuestions(questions)
    setIsInitialLoad(true)
    // Marquer comme chargé après un court délai pour éviter la sauvegarde au chargement
    setTimeout(() => setIsInitialLoad(false), 1000)
  }, [questions])

  useEffect(() => {
    loadCategoriesList()
  }, [])

  // Plus besoin de sélectionner automatiquement une catégorie par défaut

  // Sauvegarde automatique à chaque changement (sauf au chargement initial)
  useEffect(() => {
    if (isInitialLoad) return

    const saveTimeout = setTimeout(async () => {
      try {
        await onSave(localQuestions)
      } catch (error) {
        console.error('Erreur lors de la sauvegarde automatique:', error)
      }
    }, 1000) // Debounce de 1 seconde

    return () => clearTimeout(saveTimeout)
  }, [localQuestions, isInitialLoad, onSave])

  // Validation en temps réel du formulaire
  useEffect(() => {
    if (!showAddForm && editingIndex === null) {
      setFieldErrors({})
      setTouchedFields({})
      return
    }

    const errors: { mediaUrl?: string; answer?: string } = {}

    // Validation de l'URL (seulement si le champ a été touché ou s'il y a une valeur)
    if (touchedFields.mediaUrl || formData.mediaUrl) {
      if (!formData.mediaUrl || formData.mediaUrl.trim() === '') {
        errors.mediaUrl = 'L\'URL YouTube est obligatoire'
      } else if (!isValidUrlFormat(formData.mediaUrl)) {
        errors.mediaUrl = 'Format d\'URL invalide'
      } else if (!isYouTubeUrl(formData.mediaUrl)) {
        errors.mediaUrl = 'Seules les URLs YouTube sont supportées'
      } else if (!youtubeValid && touchedFields.mediaUrl) {
        // Afficher l'erreur seulement si le champ a été touché et que la validation YouTube est terminée
        errors.mediaUrl = 'URL YouTube invalide ou vidéo inexistante'
      }
    }

    // Validation de la réponse (seulement si le champ a été touché)
    if (touchedFields.answer) {
      if (!formData.answer || formData.answer.trim() === '') {
        errors.answer = 'La réponse est obligatoire'
      }
    }

    setFieldErrors(errors)
  }, [formData.mediaUrl, formData.answer, youtubeValid, showAddForm, editingIndex, touchedFields])

  const loadCategoriesList = async () => {
    const cats = await loadCategories()
    setCategories(cats)
  }

  const filteredQuestions = filterCategory === 'all'
    ? localQuestions
    : localQuestions.filter(q => q.category === filterCategory)

  // Utiliser QuestionService pour générer l'ID
  const generateId = async (mediaUrl: string, category: Category): Promise<string> => {
    return await QuestionService.generateId(mediaUrl, category)
  }

  const handleAdd = async () => {
    setFormError(null)
    
    // Marquer tous les champs comme touchés pour afficher les erreurs
    setTouchedFields({ mediaUrl: true, answer: true })
    
    // La validation en temps réel va gérer les erreurs de champs
    if (!formData.mediaUrl || !formData.answer || !formData.category || selectedCategories.length === 0 || !youtubeValid || fieldErrors.mediaUrl || fieldErrors.answer) {
      return
    }

    try {
      const questionId = await generateId(formData.mediaUrl!, formData.category as Category)
      const newQuestion: Question = {
        id: questionId,
        category: formData.category as Category,
        type: 'video' as MediaType, // Forcé à video pour YouTube
        mediaUrl: formData.mediaUrl!,
        answer: formData.answer!,
        hint: formData.hint || undefined
      }

      // Sauvegarder sur le serveur
      await QuestionService.addQuestion(newQuestion)
      
      // Mettre à jour la liste locale
      setLocalQuestions([...localQuestions, newQuestion])
      resetForm()
      setShowAddForm(false)
    } catch (error) {
      console.error('Erreur lors de l\'ajout:', error)
      setFormError('Erreur lors de l\'ajout de la question: ' + (error instanceof Error ? error.message : 'Erreur inconnue'))
    }
  }

  const handleEdit = async (index: number) => {
    const question = filteredQuestions[index]
    // Utiliser l'ID ou mediaUrl comme clé primaire pour trouver la question
    const globalIndex = localQuestions.findIndex(q => 
      (q.id && question.id && q.id === question.id) || 
      (!q.id && !question.id && q.mediaUrl === question.mediaUrl) ||
      (q.mediaUrl === question.mediaUrl)
    )
    setEditingIndex(globalIndex)
    setFormData({ ...question })
    setShowAddForm(false)
    setYoutubeError(null)
    setYoutubeValid(false)
    
    // Charger les métadonnées YouTube si c'est une URL YouTube
    if (isYouTubeUrl(question.mediaUrl)) {
      setIsLoadingMetadata(true)
      setYoutubeError(null)
      try {
        const metadata = await getYouTubeMetadata(question.mediaUrl)
        if (metadata && metadata.videoId && metadata.title) {
          // La vidéo existe et est valide
          setYoutubeThumbnail(metadata.thumbnailUrl)
          setYoutubeTitle(metadata.title)
          setYoutubeValid(true)
          setYoutubeError(null)
        } else {
          // La vidéo n'existe pas ou les métadonnées sont invalides
          setYoutubeThumbnail(null)
          setYoutubeTitle('')
          setYoutubeError('Cette vidéo YouTube n\'existe pas ou n\'est pas accessible. Vérifiez que l\'URL est correcte.')
          setYoutubeValid(false)
        }
      } catch (error) {
        setYoutubeThumbnail(null)
        setYoutubeTitle('')
        setYoutubeError('Erreur lors de la vérification de l\'URL YouTube.')
        setYoutubeValid(false)
      } finally {
        setIsLoadingMetadata(false)
      }
    } else {
      setYoutubeThumbnail(null)
      setYoutubeTitle('')
      setYoutubeError('URL YouTube invalide')
      setYoutubeValid(false)
    }
  }

  const handleUpdate = async () => {
    setFormError(null)
    
    // Marquer tous les champs comme touchés pour afficher les erreurs
    setTouchedFields({ mediaUrl: true, answer: true })
    
    if (editingIndex === null) {
      setFormError('Erreur: index d\'édition invalide')
      return
    }
    
    // La validation en temps réel va gérer les erreurs de champs
    if (!formData.mediaUrl || !formData.answer || !formData.category || selectedCategories.length === 0 || !youtubeValid || fieldErrors.mediaUrl || fieldErrors.answer) {
      return
    }

    // Conserver l'ID original lors de la modification, ou le régénérer si l'URL a changé
    const originalQuestion = localQuestions[editingIndex]
    try {
      const questionId = formData.mediaUrl === originalQuestion.mediaUrl 
        ? (originalQuestion.id || originalQuestion.mediaUrl)
        : await generateId(formData.mediaUrl!, formData.category as Category)
      
      const updatedQuestion: Question = {
        id: questionId,
        category: formData.category as Category,
        type: 'video' as MediaType, // Forcé à video pour YouTube
        mediaUrl: formData.mediaUrl!,
        answer: formData.answer!,
        hint: formData.hint || undefined
      }

      // Sauvegarder sur le serveur
      await QuestionService.addQuestion(updatedQuestion)

      // Mettre à jour la liste locale (la sauvegarde automatique se fera via useEffect)
      const newQuestions = [...localQuestions]
      newQuestions[editingIndex] = updatedQuestion
      setLocalQuestions(newQuestions)
      resetForm()
      setEditingIndex(null)
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error)
      setFormError('Erreur lors de la mise à jour de la question: ' + (error instanceof Error ? error.message : 'Erreur inconnue'))
    }
  }

  const handleDelete = async (index: number) => {
    const question = filteredQuestions[index]
    if (confirm(`Êtes-vous sûr de vouloir supprimer la question "${question.answer}" ?`)) {
      try {
        const questionId = question.id || question.mediaUrl
        await QuestionService.deleteQuestion(questionId, question.category)
        
        // Mettre à jour la liste locale (la sauvegarde automatique se fera via useEffect)
        const newQuestions = localQuestions.filter(q => 
          (q.id && question.id && q.id !== question.id) || 
          (!q.id && !question.id && q.mediaUrl !== question.mediaUrl) ||
          (q.mediaUrl !== question.mediaUrl)
        )
        setLocalQuestions(newQuestions)
      } catch (error) {
        console.error('Erreur lors de la suppression:', error)
        alert('Erreur lors de la suppression de la question')
      }
    }
  }


  const resetForm = () => {
    setFormData({
      category: undefined,
      mediaUrl: '',
      answer: '',
      hint: ''
    })
    setSelectedCategories([])
    setYoutubeThumbnail(null)
    setYoutubeTitle('')
    setIsLoadingMetadata(false)
    setYoutubeError(null)
    setYoutubeValid(false)
    setFormError(null)
    setFieldErrors({})
    setTouchedFields({})
  }

  const cancelEdit = () => {
    resetForm()
    setEditingIndex(null)
    setShowAddForm(false)
  }

  const getCategoryLabel = (category: Category) => {
    const cat = categories.find(c => c.id === category)
    return cat ? `${cat.emoji} ${cat.name}` : category
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
    <div className="editor-panel">
      <div className="panel-header">
        <h2>📝 Questions</h2>
      </div>

      <div className="editor-filters">
        <label>
          Filtrer par catégorie :
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as Category | 'all')}
          >
            <option value="all">Toutes</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.emoji} {cat.name}
              </option>
            ))}
          </select>
        </label>
        <div className="question-count">
          {filteredQuestions.length} question{filteredQuestions.length > 1 ? 's' : ''}
        </div>
      </div>

      {(showAddForm || editingIndex !== null) && (
        <div className="modal-overlay" onClick={cancelEdit}>
          <div className="modal-content editor-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingIndex !== null ? 'Modifier la question' : 'Ajouter une question'}</h2>
              <button className="close-button" onClick={cancelEdit} title="Fermer">
                ✕
              </button>
            </div>
            <div className="modal-body">
              <form 
                className="question-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (editingIndex !== null) {
                    handleUpdate()
                  } else {
                    handleAdd()
                  }
                }}
                onKeyDown={(e) => {
                  // Ctrl/Cmd + Enter pour soumettre même depuis un input
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    if (editingIndex !== null) {
                      handleUpdate()
                    } else {
                      handleAdd()
                    }
                  }
                }}
              >


              <div className="form-group">
                <label>
                  Catégorie *
                </label>
                <CategorySelector
                  categories={categories}
                  selectedCategories={selectedCategories}
                  onSelectionChange={(cats) => {
                    setSelectedCategories(cats)
                    // Prendre la première catégorie sélectionnée pour formData.category
                    // (le backend utilise une seule catégorie par question pour l'instant)
                    if (cats.length > 0) {
                      setFormData({ ...formData, category: cats[0] })
                    } else {
                      setFormData({ ...formData, category: undefined })
                    }
                  }}
                  multiple={true}
                  required={true}
                />
              </div>


              <label>
                URL YouTube *
                <input
                  type="text"
                  value={formData.mediaUrl || ''}
                  onBlur={() => setTouchedFields(prev => ({ ...prev, mediaUrl: true }))}
                  onChange={async (e) => {
                    const url = e.target.value
                    setFormData({ ...formData, mediaUrl: url })
                    setYoutubeError(null)
                    setYoutubeValid(false)
                    setFormError(null)
                    // Marquer le champ comme touché
                    if (!touchedFields.mediaUrl) {
                      setTouchedFields(prev => ({ ...prev, mediaUrl: true }))
                    }
                    
                    // Si l'URL est vide, réinitialiser
                    if (!url || url.trim() === '') {
                      setYoutubeThumbnail(null)
                      setYoutubeTitle('')
                      setYoutubeError(null)
                      setYoutubeValid(false)
                      return
                    }
                    
                    // D'abord vérifier le format URL de base
                    if (!isValidUrlFormat(url)) {
                      setYoutubeThumbnail(null)
                      setYoutubeTitle('')
                      setYoutubeError('Format d\'URL invalide. Veuillez entrer une URL valide (ex: https://youtu.be/...)')
                      setYoutubeValid(false)
                      return
                    }
                    
                    // Ensuite vérifier si c'est une URL YouTube
                    if (!isYouTubeUrl(url)) {
                      setYoutubeThumbnail(null)
                      setYoutubeTitle('')
                      setYoutubeError('Seules les URLs YouTube sont supportées. Format attendu : https://youtu.be/... ou https://www.youtube.com/watch?v=...')
                      setYoutubeValid(false)
                      return
                    }
                    
                    // Charger les métadonnées YouTube
                    setIsLoadingMetadata(true)
                    setYoutubeError(null)
                    try {
                      const metadata = await getYouTubeMetadata(url)
                      if (metadata && metadata.videoId && metadata.title) {
                        // La vidéo existe et est valide
                        setYoutubeThumbnail(metadata.thumbnailUrl)
                        setYoutubeTitle(metadata.title)
                        setYoutubeValid(true)
                        setYoutubeError(null)
                        // Pré-remplir la réponse seulement si elle est vide
                        if (!formData.answer || formData.answer.trim() === '') {
                          setFormData({ ...formData, mediaUrl: url, answer: metadata.title })
                        } else {
                          setFormData({ ...formData, mediaUrl: url })
                        }
                      } else {
                        // La vidéo n'existe pas ou les métadonnées sont invalides
                        setYoutubeThumbnail(null)
                        setYoutubeTitle('')
                        setYoutubeError('Cette vidéo YouTube n\'existe pas ou n\'est pas accessible. Vérifiez que l\'URL est correcte.')
                        setYoutubeValid(false)
                      }
                    } catch (error) {
                      setYoutubeThumbnail(null)
                      setYoutubeTitle('')
                      setYoutubeError('Erreur lors de la vérification de l\'URL YouTube. Vérifiez votre connexion internet.')
                      setYoutubeValid(false)
                    } finally {
                      setIsLoadingMetadata(false)
                    }
                  }}
                  placeholder="https://youtu.be/..."
                  className={(youtubeError || fieldErrors.mediaUrl) ? 'input-error' : ''}
                />
                {(youtubeError || fieldErrors.mediaUrl) && (
                  <div className="youtube-error-message">
                    <span className="error-icon">⚠️</span>
                    <span>{fieldErrors.mediaUrl || youtubeError}</span>
                  </div>
                )}
                {formData.mediaUrl && !youtubeError && (
                  <div className="youtube-preview-form">
                    {isLoadingMetadata && (
                      <span className="youtube-hint">⏳ Chargement des métadonnées...</span>
                    )}
                    {!isLoadingMetadata && youtubeThumbnail && youtubeValid && (
                      <div className="youtube-metadata-preview">
                        <img 
                          src={youtubeThumbnail} 
                          alt="YouTube thumbnail" 
                          className="youtube-thumbnail-preview"
                        />
                        {youtubeTitle && (
                          <div className="youtube-title-preview">
                            <strong>📺 {youtubeTitle}</strong>
                          </div>
                        )}
                      </div>
                    )}
                    {!isLoadingMetadata && !youtubeThumbnail && isYouTubeUrl(formData.mediaUrl) && !youtubeError && (
                      <span className="youtube-hint">✓ URL YouTube détectée</span>
                    )}
                  </div>
                )}
              </label>

              <label>
                Réponse *
                <input
                  type="text"
                  value={formData.answer || ''}
                  onBlur={() => setTouchedFields(prev => ({ ...prev, answer: true }))}
                  onChange={(e) => {
                    setFormData({ ...formData, answer: e.target.value })
                    setFormError(null)
                    // Marquer le champ comme touché
                    if (!touchedFields.answer) {
                      setTouchedFields(prev => ({ ...prev, answer: true }))
                    }
                  }}
                  placeholder="La réponse à deviner"
                  className={fieldErrors.answer ? 'input-error' : ''}
                />
                {fieldErrors.answer && (
                  <div className="youtube-error-message">
                    <span className="error-icon">⚠️</span>
                    <span>{fieldErrors.answer}</span>
                  </div>
                )}
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

              {/* Afficher seulement les erreurs serveur/API, pas les erreurs de validation de champs */}
              {formError && !fieldErrors.mediaUrl && !fieldErrors.answer && (
                <div className="form-error-message">
                  <span className="error-icon">⚠️</span>
                  <span>{formError}</span>
                </div>
              )}

              <div className="form-actions">
                <button
                  className="submit-button"
                  onClick={editingIndex !== null ? handleUpdate : handleAdd}
                  disabled={
                    !youtubeValid || 
                    !formData.mediaUrl || 
                    !formData.answer || 
                    !formData.category ||
                    selectedCategories.length === 0 ||
                    !!fieldErrors.mediaUrl || 
                    !!fieldErrors.answer
                  }
                  title={
                    fieldErrors.mediaUrl || fieldErrors.answer
                      ? 'Veuillez corriger les erreurs dans le formulaire'
                      : !youtubeValid 
                        ? 'Veuillez entrer une URL YouTube valide' 
                        : !formData.mediaUrl || !formData.answer 
                          ? 'Veuillez remplir tous les champs obligatoires' 
                          : ''
                  }
                >
                  {editingIndex !== null ? '💾 Mettre à jour' : '➕ Ajouter'}
                </button>
                <button type="button" className="cancel-button" onClick={cancelEdit}>
                  Annuler
                </button>
              </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="panel-content">
        <div className="panel-section">
          <div className="section-header">
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

          <div className="questions-grid">
            {filteredQuestions.map((question, index) => {
              const questionId = question.id || question.mediaUrl
              const thumbnailUrl = question.type === 'video' && isYouTubeUrl(question.mediaUrl)
                ? getYouTubeThumbnailFromUrl(question.mediaUrl)
                : null
              
              return (
                <div key={questionId} className="question-card-editor">
                  <div className="question-card-header">
                    <span className="question-category">{getCategoryLabel(question.category)}</span>
                  </div>
                  <div className="question-card-body">
                    <div className="question-media">
                      {thumbnailUrl && (
                        <img 
                          src={thumbnailUrl} 
                          alt="YouTube thumbnail" 
                          className="youtube-thumbnail-small"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      )}
                    </div>
                    <div className="question-info-compact">
                      <div className="question-answer-compact"><strong>{question.answer}</strong></div>
                      {question.hint && (
                        <div className="question-hint-compact">{question.hint}</div>
                      )}
                    </div>
                  </div>
                  <div className="question-card-actions">
                    <button
                      className="edit-button-small"
                      onClick={() => handleEdit(index)}
                      title="Modifier"
                    >
                      ✏️
                    </button>
                    <button
                      className="delete-button-small"
                      onClick={() => handleDelete(index)}
                      title="Supprimer"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )
            })}
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
                ➕ Ajouter une question
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

