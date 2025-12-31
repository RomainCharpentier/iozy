import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { FaPlus, FaEdit, FaTrash, FaSearch, FaTimes, FaSave, FaTv, FaChevronLeft, FaChevronRight, FaExclamationTriangle, FaCheckCircle, FaSpinner } from 'react-icons/fa'
import type { Category, Question, MediaType, CategoryInfo } from '../../services/types'
import { isYouTubeUrl, isValidUrlFormat, getYouTubeThumbnailFromUrl, extractYouTubeId, getYouTubeMetadata } from '../../utils/youtube'
import { QuestionService } from '../../services/questionService'
import { loadCategories } from '../../services/categoryService'
import CategorySelector from '../../components/editor/CategorySelector'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { questionSchema, type QuestionFormData } from '../../schemas/questionSchema'

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
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('')
  const [questionMetadata, setQuestionMetadata] = useState<Record<string, { title: string; thumbnailUrl: string }>>({})
  const [currentPage, setCurrentPage] = useState<number>(1)
  const questionsPerPage = 20
  const [youtubeThumbnail, setYoutubeThumbnail] = useState<string | null>(null)
  const [youtubeTitle, setYoutubeTitle] = useState<string>('')
  const [youtubeValid, setYoutubeValid] = useState<boolean>(false)
  const [categories, setCategories] = useState<CategoryInfo[]>([])
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([])
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    message: string
    onConfirm: () => void
  }>({
    isOpen: false,
    message: '',
    onConfirm: () => {}
  })

  // React Hook Form
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
    reset,
    setError,
    clearErrors
  } = useForm<QuestionFormData>({
    resolver: zodResolver(questionSchema),
    defaultValues: {
      mediaUrl: '',
      answer: '',
      hint: '',
      categories: []
    }
  })

  const watchedMediaUrl = watch('mediaUrl')

  const [isInitialLoad, setIsInitialLoad] = useState(true)

  useEffect(() => {
    setLocalQuestions(questions)
    setIsInitialLoad(true)
    // Marquer comme chargé après un court délai pour éviter la sauvegarde au chargement
    setTimeout(() => setIsInitialLoad(false), 1000)
  }, [questions])

  const loadCategoriesList = async () => {
    const cats = await loadCategories()
    setCategories(cats)
  }

  useEffect(() => {
    loadCategoriesList()
  }, [])

  // Debounce pour la recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Réinitialiser la page quand les filtres changent
  useEffect(() => {
    setCurrentPage(1)
  }, [filterCategory, debouncedSearchQuery])

  const filteredQuestions = useMemo(() => {
    let filtered = localQuestions

    // Filtre par catégorie
    if (filterCategory !== 'all') {
      filtered = filtered.filter(q => {
        const questionCategories = Array.isArray(q.category) ? q.category : [q.category]
        return questionCategories.includes(filterCategory)
      })
    }

    // Filtre par recherche (réponse, URL, catégorie)
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim()
      filtered = filtered.filter(q => {
        const answerMatch = q.answer.toLowerCase().includes(query)
        const urlMatch = q.mediaUrl.toLowerCase().includes(query)
        const hintMatch = q.hint?.toLowerCase().includes(query)
        const categoryMatch = (() => {
          const questionCategories = Array.isArray(q.category) ? q.category : [q.category]
          return questionCategories.some(cat => {
            const catInfo = categories.find(c => c.id === cat)
            return catInfo?.name.toLowerCase().includes(query) || cat.toLowerCase().includes(query)
          })
        })()
        return answerMatch || urlMatch || hintMatch || categoryMatch
      })
    }

    return filtered
  }, [localQuestions, filterCategory, debouncedSearchQuery, categories])
  
  // Calculer le nombre total de pages
  const totalPages = Math.ceil(filteredQuestions.length / questionsPerPage)

  // Charger les métadonnées YouTube pour les questions affichées
  useEffect(() => {
    const loadMetadata = async () => {
      const questionsToLoad = filteredQuestions
        .filter(q => isYouTubeUrl(q.mediaUrl) && !questionMetadata[q.mediaUrl])
        .slice(0, 10) // Limiter à 10 requêtes simultanées pour éviter la surcharge
      
      if (questionsToLoad.length === 0) return
      
      const metadataPromises = questionsToLoad.map(async (q) => {
        try {
          const metadata = await getYouTubeMetadata(q.mediaUrl, true)
          if (metadata) {
            return { url: q.mediaUrl, metadata }
          }
        } catch (error) {
          console.error('Error loading metadata for', q.mediaUrl, error)
        }
        return null
      })
      
      const results = await Promise.all(metadataPromises)
      const newMetadata: Record<string, { title: string; thumbnailUrl: string }> = {}
      results.forEach(result => {
        if (result) {
          newMetadata[result.url] = {
            title: result.metadata.title,
            thumbnailUrl: result.metadata.thumbnailUrl
          }
        }
      })
      
      if (Object.keys(newMetadata).length > 0) {
        setQuestionMetadata(prev => ({ ...prev, ...newMetadata }))
      }
    }
    
    loadMetadata()
  }, [filteredQuestions, questionMetadata])

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

  // Validation YouTube en temps réel
  useEffect(() => {
    if (!watchedMediaUrl || !showAddForm && editingIndex === null) {
      setYoutubeThumbnail(null)
      setYoutubeTitle('')
      setYoutubeValid(false)
      return
    }

    const validateYouTube = async () => {
      if (!watchedMediaUrl || watchedMediaUrl.trim() === '') {
        setYoutubeThumbnail(null)
        setYoutubeTitle('')
        setYoutubeValid(false)
        return
      }

      if (!isValidUrlFormat(watchedMediaUrl)) {
        setYoutubeThumbnail(null)
        setYoutubeTitle('')
        setYoutubeValid(false)
        setError('mediaUrl', { type: 'manual', message: 'Format d\'URL invalide' })
        return
      }

      if (!isYouTubeUrl(watchedMediaUrl)) {
        setYoutubeThumbnail(null)
        setYoutubeTitle('')
        setYoutubeValid(false)
        setError('mediaUrl', { type: 'manual', message: 'Seules les URLs YouTube sont supportées' })
        return
      }

      clearErrors('mediaUrl')
      try {
        const metadata = await getYouTubeMetadata(watchedMediaUrl)
        if (metadata && metadata.videoId && metadata.title) {
          setYoutubeThumbnail(metadata.thumbnailUrl)
          setYoutubeTitle(metadata.title)
          setYoutubeValid(true)
          // Pré-remplir la réponse si elle est vide
          const currentAnswer = watch('answer')
          if (!currentAnswer || currentAnswer.trim() === '') {
            setValue('answer', metadata.title)
          }
        } else {
          setYoutubeThumbnail(null)
          setYoutubeTitle('')
          setYoutubeValid(false)
          setError('mediaUrl', { type: 'manual', message: 'Cette vidéo YouTube n\'existe pas ou n\'est pas accessible' })
        }
      } catch (error) {
        setYoutubeThumbnail(null)
        setYoutubeTitle('')
        setYoutubeValid(false)
        setError('mediaUrl', { type: 'manual', message: 'Erreur lors de la vérification de l\'URL YouTube' })
      }
    }

    const timeoutId = setTimeout(validateYouTube, 500) // Debounce
    return () => clearTimeout(timeoutId)
  }, [watchedMediaUrl, showAddForm, editingIndex, setError, clearErrors, setValue, watch])

  // Utiliser QuestionService pour générer l'ID
  const generateId = async (mediaUrl: string, category: Category): Promise<string> => {
    return await QuestionService.generateId(mediaUrl, category)
  }

  const onSubmit = async (data: QuestionFormData) => {
    if (selectedCategories.length === 0) {
      toast.error('Veuillez sélectionner au moins une catégorie')
      return
    }

    if (!youtubeValid) {
      toast.error('Veuillez entrer une URL YouTube valide')
      return
    }

    try {
      const questionId = await generateId(data.mediaUrl, selectedCategories[0])
      const newQuestion: Question = {
        id: questionId,
        category: selectedCategories.length === 1 ? selectedCategories[0] : selectedCategories,
        type: 'video' as MediaType,
        mediaUrl: data.mediaUrl,
        answer: data.answer,
        hint: data.hint || undefined
      }

      await QuestionService.addQuestion(newQuestion)
      setLocalQuestions([...localQuestions, newQuestion])
      reset()
      setSelectedCategories([])
      setYoutubeThumbnail(null)
      setYoutubeTitle('')
      setYoutubeValid(false)
      setShowAddForm(false)
      toast.success('Question ajoutée avec succès')
    } catch (error) {
      console.error('Erreur lors de l\'ajout:', error)
      const errorMessage = error instanceof Error 
        ? (error.message.includes('Failed to fetch') 
            ? 'Erreur de connexion au serveur. Vérifiez votre connexion internet.'
            : error.message)
        : 'Erreur inconnue lors de l\'ajout de la question'
      toast.error(errorMessage)
    }
  }

  const onUpdate = async (data: QuestionFormData) => {
    if (editingIndex === null) {
      toast.error('Erreur: index d\'édition invalide')
      return
    }

    if (selectedCategories.length === 0) {
      toast.error('Veuillez sélectionner au moins une catégorie')
      return
    }

    if (!youtubeValid) {
      toast.error('Veuillez entrer une URL YouTube valide')
      return
    }

    const originalQuestion = localQuestions[editingIndex]
    try {
      const questionId = data.mediaUrl === originalQuestion.mediaUrl 
        ? (originalQuestion.id || originalQuestion.mediaUrl)
        : await generateId(data.mediaUrl, selectedCategories[0])
      
      const updatedQuestion: Question = {
        id: questionId,
        category: selectedCategories.length === 1 ? selectedCategories[0] : selectedCategories,
        type: 'video' as MediaType,
        mediaUrl: data.mediaUrl,
        answer: data.answer,
        hint: data.hint || undefined
      }

      await QuestionService.updateQuestion(
        originalQuestion.id || originalQuestion.mediaUrl,
        Array.isArray(originalQuestion.category) ? originalQuestion.category : [originalQuestion.category],
        updatedQuestion
      )

      const newQuestions = [...localQuestions]
      newQuestions[editingIndex] = updatedQuestion
      setLocalQuestions(newQuestions)
      reset()
      setSelectedCategories([])
      setYoutubeThumbnail(null)
      setYoutubeTitle('')
      setYoutubeValid(false)
      setEditingIndex(null)
      toast.success('Question mise à jour avec succès')
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error)
      const errorMessage = error instanceof Error 
        ? (error.message.includes('Failed to fetch') 
            ? 'Erreur de connexion au serveur. Vérifiez votre connexion internet.'
            : error.message)
        : 'Erreur inconnue lors de la mise à jour de la question'
      toast.error(errorMessage)
    }
  }

  const handleEdit = async (index: number) => {
    const question = filteredQuestions[index]
    if (!question) {
      toast.error('Question introuvable')
      return
    }
    const globalIndex = localQuestions.findIndex(q => 
      (q.id && question.id && q.id === question.id) || 
      (q.mediaUrl === question.mediaUrl)
    )
    if (globalIndex === -1) {
      toast.error('Erreur: question introuvable dans la liste')
      return
    }
    setEditingIndex(globalIndex)
    
    const questionCategories = Array.isArray(question.category) ? question.category : [question.category]
    setSelectedCategories(questionCategories)
    setShowAddForm(false)
    
    reset({
      mediaUrl: question.mediaUrl,
      answer: question.answer,
      hint: question.hint || '',
      categories: questionCategories
    })
    
    if (isYouTubeUrl(question.mediaUrl)) {
      try {
        const metadata = await getYouTubeMetadata(question.mediaUrl)
        if (metadata && metadata.videoId && metadata.title) {
          setYoutubeThumbnail(metadata.thumbnailUrl)
          setYoutubeTitle(metadata.title)
          setYoutubeValid(true)
        } else {
          setYoutubeThumbnail(null)
          setYoutubeTitle('')
          setYoutubeValid(false)
        }
      } catch (error) {
        setYoutubeThumbnail(null)
        setYoutubeTitle('')
        setYoutubeValid(false)
      }
    } else {
      setYoutubeThumbnail(null)
      setYoutubeTitle('')
      setYoutubeValid(false)
    }
  }


  const handleDelete = async (index: number) => {
    const question = filteredQuestions[index]
    if (!question) {
      toast.error('Question introuvable')
      return
    }
    
    const handleConfirm = async () => {
      try {
        const questionId = question.id || question.mediaUrl
        await QuestionService.deleteQuestion(questionId, question.category)
        
        const newQuestions = localQuestions.filter(q => 
          (q.id && question.id && q.id !== question.id) || 
          (q.mediaUrl !== question.mediaUrl)
        )
        setLocalQuestions(newQuestions)
        toast.success('Question supprimée avec succès')
      } catch (error) {
        console.error('Erreur lors de la suppression:', error)
        const errorMessage = error instanceof Error 
          ? (error.message.includes('Failed to fetch') 
              ? 'Erreur de connexion au serveur. Vérifiez votre connexion internet.'
              : error.message)
          : 'Erreur inconnue lors de la suppression'
        toast.error(`Erreur lors de la suppression: ${errorMessage}`)
      } finally {
        setConfirmDialog({ isOpen: false, message: '', onConfirm: () => {} })
      }
    }

    setConfirmDialog({
      isOpen: true,
      message: `Êtes-vous sûr de vouloir supprimer la question "${question.answer}" ?`,
      onConfirm: handleConfirm
    })
  }


  const cancelEdit = () => {
    reset()
    setSelectedCategories([])
    setYoutubeThumbnail(null)
    setYoutubeTitle('')
    setYoutubeValid(false)
    setEditingIndex(null)
    setShowAddForm(false)
  }

  const getCategoryLabel = (category: Category | Category[]) => {
    const categoriesArray = Array.isArray(category) ? category : [category]
    return categoriesArray.map(cat => {
      const catInfo = categories.find(c => c.id === cat)
      return catInfo ? catInfo.name : cat
    }).join(', ')
  }

  const getTypeLabel = (type: MediaType) => {
    const labels: Record<MediaType, string> = {
      audio: 'Audio',
      image: 'Image',
      video: 'Vidéo'
    }
    return labels[type]
  }

  // Statistiques par catégorie
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {}
    categories.forEach(cat => {
      stats[cat.id] = localQuestions.filter(q => {
        const questionCategories = Array.isArray(q.category) ? q.category : [q.category]
        return questionCategories.includes(cat.id)
      }).length
    })
    return stats
  }, [localQuestions, categories])

  return (
    <>
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        message={confirmDialog.message}
        confirmText="Supprimer"
        cancelText="Annuler"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: () => {} })}
        variant="danger"
      />
      <div className="editor-panel">
      <div className="panel-header">
        <h2><FaEdit /> Questions</h2>
        <div className="editor-stats">
          <div className="stat-item stat-item-total">
            <span className="stat-label">Total:</span>
            <span className="stat-value">{localQuestions.length}</span>
          </div>
          <div className="stat-categories">
            {categories.map(cat => {
              const count = categoryStats[cat.id] || 0
              if (count === 0) return null
              return (
                <div key={cat.id} className="stat-item stat-item-category" title={cat.name}>
                  <span className="stat-icon">{(() => {
                    const IconComponent = getIconById(cat.emoji)
                    return <IconComponent size={16} />
                  })()}</span>
                  <span className="stat-category-name">{cat.name}</span>
                  <span className="stat-value">{count}</span>
                </div>
              )
            })}
          </div>
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
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <FaSearch /> Rechercher :
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par réponse, URL, indice ou catégorie..."
            className="search-input"
          />
          {searchQuery && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setSearchQuery('')}
                title="Effacer la recherche"
              >
                <FaTimes />
              </button>
          )}
        </label>
        <div className="question-count">
          {filteredQuestions.length} question{filteredQuestions.length > 1 ? 's' : ''}
          {debouncedSearchQuery && (
            <span className="search-results-info">
              {' '}sur {localQuestions.length} total{localQuestions.length > 1 ? 'es' : 'e'}
            </span>
          )}
        </div>
      </div>

      {(showAddForm || editingIndex !== null) && (
        <div className="modal-overlay" onClick={cancelEdit}>
          <div className="modal-content editor-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingIndex !== null ? 'Modifier la question' : 'Ajouter une question'}</h2>
              <button className="close-button" onClick={cancelEdit} title="Fermer">
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <form 
                className="question-form"
                onSubmit={handleSubmit(editingIndex !== null ? onUpdate : onSubmit)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    handleSubmit(editingIndex !== null ? onUpdate : onSubmit)()
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
                    setValue('categories', cats, { shouldValidate: true })
                  }}
                  multiple={true}
                  required={true}
                />
                {errors.categories && (
                  <div className="youtube-error-message">
                    <FaExclamationTriangle className="error-icon" />
                    <span>{errors.categories.message}</span>
                  </div>
                )}
              </div>


              <label>
                URL YouTube *
                <input
                  type="text"
                  {...register('mediaUrl')}
                  placeholder="https://youtu.be/..."
                  className={errors.mediaUrl ? 'input-error' : ''}
                />
                {errors.mediaUrl && (
                  <div className="youtube-error-message">
                    <FaExclamationTriangle className="error-icon" />
                    <span>{errors.mediaUrl.message}</span>
                  </div>
                )}
                {watchedMediaUrl && !errors.mediaUrl && (
                  <div className="youtube-preview-form">
                    {!youtubeThumbnail && isYouTubeUrl(watchedMediaUrl) && (
                      <span className="youtube-hint"><FaSpinner className="spinner" /> Chargement des métadonnées...</span>
                    )}
                    {youtubeThumbnail && youtubeValid && (
                      <div className="youtube-metadata-preview">
                        <img 
                          src={youtubeThumbnail} 
                          alt="YouTube thumbnail" 
                          className="youtube-thumbnail-preview"
                        />
                        {youtubeTitle && (
                          <div className="youtube-title-preview">
                            <strong><FaTv /> {youtubeTitle}</strong>
                          </div>
                        )}
                      </div>
                    )}
                    {youtubeValid && !youtubeThumbnail && (
                      <span className="youtube-hint"><FaCheckCircle /> URL YouTube détectée</span>
                    )}
                  </div>
                )}
              </label>

              <label>
                Réponse *
                <input
                  type="text"
                  {...register('answer')}
                  placeholder="La réponse à deviner"
                  className={errors.answer ? 'input-error' : ''}
                />
                {errors.answer && (
                  <div className="youtube-error-message">
                    <FaExclamationTriangle className="error-icon" />
                    <span>{errors.answer.message}</span>
                  </div>
                )}
              </label>

              <label>
                Indice (optionnel)
                <input
                  type="text"
                  {...register('hint')}
                  placeholder="Un indice pour aider à deviner"
                />
              </label>

              <div className="form-actions">
                <button
                  type="submit"
                  className="submit-button"
                  disabled={isSubmitting || !youtubeValid || selectedCategories.length === 0}
                  title={
                    errors.mediaUrl || errors.answer || errors.categories
                      ? 'Veuillez corriger les erreurs dans le formulaire'
                      : !youtubeValid 
                        ? 'Veuillez entrer une URL YouTube valide' 
                        : selectedCategories.length === 0
                          ? 'Veuillez sélectionner au moins une catégorie'
                          : ''
                  }
                >
                  {isSubmitting ? (
                    <>
                      <FaSpinner className="spinner" /> Chargement...
                    </>
                  ) : editingIndex !== null ? (
                    <>
                      <FaSave /> Mettre à jour
                    </>
                  ) : (
                    <>
                      <FaPlus /> Ajouter
                    </>
                  )}
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
              <FaPlus /> Ajouter une question
            </button>
          </div>

          {filteredQuestions.length === 0 ? (
            <div className="no-questions-message">
              <span className="no-questions-icon"><FaSearch /></span>
              <p>Aucune question trouvée</p>
              {debouncedSearchQuery && (
                <p className="no-questions-hint">Essayez de modifier votre recherche ou vos filtres</p>
              )}
            </div>
          ) : (
            <>
              <div className="questions-grid">
                {filteredQuestions.slice((currentPage - 1) * questionsPerPage, currentPage * questionsPerPage).map((question) => {
                  const questionId = question.id || question.mediaUrl
                  // Trouver l'index réel dans filteredQuestions pour handleEdit/handleDelete
                  const realIndex = filteredQuestions.findIndex(q => 
                    (q.id && question.id && q.id === question.id) || 
                    (q.mediaUrl === question.mediaUrl)
                  )
              const metadata = questionMetadata[question.mediaUrl]
              const thumbnailUrl = metadata?.thumbnailUrl || (question.type === 'video' && isYouTubeUrl(question.mediaUrl)
                ? getYouTubeThumbnailFromUrl(question.mediaUrl)
                : null)
              const videoTitle = metadata?.title
              
              return (
                <div key={questionId} className="question-card-editor">
                  <div className="question-card-header">
                    <span className="question-category">{getCategoryLabel(question.category)}</span>
                  </div>
                  <div className="question-card-body">
                    <div className="question-media">
                      {thumbnailUrl && (
                        <div className="youtube-thumbnail-wrapper">
                          <img 
                            src={thumbnailUrl} 
                            alt={videoTitle || "YouTube thumbnail"} 
                            className="youtube-thumbnail-small"
                            title={videoTitle || undefined}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                          {videoTitle && (
                            <div className="youtube-title-overlay">
                              <span className="youtube-title-text">{videoTitle}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="question-info-compact">
                      <div className="question-answer-compact"><strong>{question.answer}</strong></div>
                      {videoTitle && videoTitle !== question.answer && (
                        <div className="question-video-title">{videoTitle}</div>
                      )}
                      {question.hint && (
                        <div className="question-hint-compact">{question.hint}</div>
                      )}
                    </div>
                  </div>
                  <div className="question-card-actions">
                    <button
                      className="edit-button-small"
                      onClick={() => handleEdit(realIndex)}
                      title="Modifier"
                    >
                      <FaEdit />
                    </button>
                    <button
                      className="delete-button-small"
                      onClick={() => handleDelete(realIndex)}
                      title="Supprimer"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
              )
                })}
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="pagination" role="navigation" aria-label="Pagination des questions">
                  <button
                    className="pagination-button"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    title="Page précédente"
                    aria-label="Page précédente"
                  >
                    <FaChevronLeft /> Précédent
                  </button>
                  <span className="pagination-info" aria-current="page">
                    Page {currentPage} sur {totalPages}
                  </span>
                  <button
                    className="pagination-button"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    title="Page suivante"
                    aria-label="Page suivante"
                  >
                    Suivant <FaChevronRight />
                  </button>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
    </>
  )
}

