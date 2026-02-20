import styles from './QuestionEditor.module.scss'
import ds from '@/styles/shared/DesignSystem.module.scss'
import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import type { Category, Question, MediaType, CategoryInfo } from '@/types'
import {
  isYouTubeUrl,
  isValidUrlFormat,
  getYouTubeThumbnailFromUrl,
  extractYouTubeId,
  getYouTubeMetadata,
} from '@/utils/youtube'
import { QuestionService } from '@/services/questionService'
import { loadCategories } from '@/services/categoryService'
import CategorySelector from '@/components/editor/CategorySelector'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { questionSchema, type QuestionFormData } from '@/schemas/questionSchema'

interface QuestionEditorProps {
  questions: Question[]
  onSave: (questions: Question[]) => void
  onClose: () => void
}

export default function QuestionEditor({ questions, onSave, onClose }: QuestionEditorProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const [localQuestions, setLocalQuestions] = useState<Question[]>(questions)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('')
  const [questionMetadata, setQuestionMetadata] = useState<
    Record<string, { title: string; thumbnailUrl: string }>
  >({})
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
    onConfirm: () => {},
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
    clearErrors,
  } = useForm<QuestionFormData>({
    resolver: zodResolver(questionSchema),
    defaultValues: {
      mediaUrl: '',
      answer: '',
      hint: '',
      categories: [],
    },
  })

  const watchedMediaUrl = watch('mediaUrl')

  const [isInitialLoad, setIsInitialLoad] = useState(true)

  useEffect(() => {
    setLocalQuestions(questions)
    setIsInitialLoad(true)
    // Marquer comme chargé après un court délai pour éviter la sauvegarde au chargement
    setTimeout(() => setIsInitialLoad(false), 1000)

    // Vérifier si on revient de l'import avec des questions importées
    if (location.state?.imported) {
      toast.success(`${location.state.imported} question(s) importée(s)`)
      // Recharger les questions
      QuestionService.getAllQuestions().then((allQuestions) => {
        setLocalQuestions(allQuestions)
        onSave(allQuestions)
      })
      // Nettoyer le state
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [questions, location.state, navigate, onSave])

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
      filtered = filtered.filter((q) => {
        const questionCategories = Array.isArray(q.category) ? q.category : [q.category]
        return questionCategories.includes(filterCategory)
      })
    }

    // Filtre par recherche (réponse, URL, catégorie)
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim()
      filtered = filtered.filter((q) => {
        const answerMatch = q.answer.toLowerCase().includes(query)
        const urlMatch = q.mediaUrl.toLowerCase().includes(query)
        const hintMatch = q.hint?.toLowerCase().includes(query)
        const categoryMatch = (() => {
          const questionCategories = Array.isArray(q.category) ? q.category : [q.category]
          return questionCategories.some((cat) => {
            const catInfo = categories.find((c) => c.id === cat)
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
        .filter((q) => isYouTubeUrl(q.mediaUrl) && !questionMetadata[q.mediaUrl])
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
      results.forEach((result) => {
        if (result) {
          newMetadata[result.url] = {
            title: result.metadata.title,
            thumbnailUrl: result.metadata.thumbnailUrl,
          }
        }
      })

      if (Object.keys(newMetadata).length > 0) {
        setQuestionMetadata((prev) => ({ ...prev, ...newMetadata }))
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
    if (!watchedMediaUrl || (!showAddForm && editingIndex === null)) {
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
        setError('mediaUrl', { type: 'manual', message: "Format d'URL invalide" })
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
          setError('mediaUrl', {
            type: 'manual',
            message: "Cette vidéo YouTube n'existe pas ou n'est pas accessible",
          })
        }
      } catch (error) {
        setYoutubeThumbnail(null)
        setYoutubeTitle('')
        setYoutubeValid(false)
        setError('mediaUrl', {
          type: 'manual',
          message: "Erreur lors de la vérification de l'URL YouTube",
        })
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
        hint: data.hint || undefined,
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
      console.error("Erreur lors de l'ajout:", error)
      const errorMessage =
        error instanceof Error
          ? error.message.includes('Failed to fetch')
            ? 'Erreur de connexion au serveur. Vérifiez votre connexion internet.'
            : error.message
          : "Erreur inconnue lors de l'ajout de la question"
      toast.error(errorMessage)
    }
  }

  const onUpdate = async (data: QuestionFormData) => {
    if (editingIndex === null) {
      toast.error("Erreur: index d'édition invalide")
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
      const questionId =
        data.mediaUrl === originalQuestion.mediaUrl
          ? originalQuestion.id || originalQuestion.mediaUrl
          : await generateId(data.mediaUrl, selectedCategories[0])

      const updatedQuestion: Question = {
        id: questionId,
        category: selectedCategories.length === 1 ? selectedCategories[0] : selectedCategories,
        type: 'video' as MediaType,
        mediaUrl: data.mediaUrl,
        answer: data.answer,
        hint: data.hint || undefined,
      }

      await QuestionService.updateQuestion(
        originalQuestion.id || originalQuestion.mediaUrl,
        Array.isArray(originalQuestion.category)
          ? originalQuestion.category
          : [originalQuestion.category],
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
      const errorMessage =
        error instanceof Error
          ? error.message.includes('Failed to fetch')
            ? 'Erreur de connexion au serveur. Vérifiez votre connexion internet.'
            : error.message
          : 'Erreur inconnue lors de la mise à jour de la question'
      toast.error(errorMessage)
    }
  }

  const handleImportPlaylist = async (
    videos: Array<{ videoUrl: string; answer: string; hint?: string }>,
    categories: Category[]
  ) => {
    try {
      const newQuestions: Question[] = []

      for (const video of videos) {
        const questionId = await generateId(video.videoUrl, categories[0])
        const newQuestion: Question = {
          id: questionId,
          category: categories.length === 1 ? categories[0] : categories,
          type: 'video' as MediaType,
          mediaUrl: video.videoUrl,
          answer: video.answer,
          hint: video.hint,
        }
        await QuestionService.addQuestion(newQuestion)
        newQuestions.push(newQuestion)
      }

      setLocalQuestions([...localQuestions, ...newQuestions])
      toast.success(`${newQuestions.length} question(s) ajoutée(s)`)
    } catch (error) {
      console.error("Erreur lors de l'import:", error)
      const errorMessage =
        error instanceof Error
          ? error.message.includes('Failed to fetch')
            ? 'Erreur de connexion au serveur. Vérifiez votre connexion internet.'
            : error.message
          : "Erreur inconnue lors de l'import"
      toast.error(errorMessage)
      throw error
    }
  }

  const handleEdit = async (index: number) => {
    const question = filteredQuestions[index]
    if (!question) {
      toast.error('Question introuvable')
      return
    }
    const globalIndex = localQuestions.findIndex(
      (q) => (q.id && question.id && q.id === question.id) || q.mediaUrl === question.mediaUrl
    )
    if (globalIndex === -1) {
      toast.error('Erreur: question introuvable dans la liste')
      return
    }
    setEditingIndex(globalIndex)

    const questionCategories = Array.isArray(question.category)
      ? question.category
      : [question.category]
    setSelectedCategories(questionCategories)
    setShowAddForm(false)

    reset({
      mediaUrl: question.mediaUrl,
      answer: question.answer,
      hint: question.hint || '',
      categories: questionCategories,
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
        const categories = Array.isArray(question.category)
          ? question.category
          : [question.category]
        await QuestionService.deleteQuestion(questionId, categories[0])

        const newQuestions = localQuestions.filter(
          (q) => (q.id && question.id && q.id !== question.id) || q.mediaUrl !== question.mediaUrl
        )
        setLocalQuestions(newQuestions)
        toast.success('Question supprimée avec succès')
      } catch (error) {
        console.error('Erreur lors de la suppression:', error)
        const errorMessage =
          error instanceof Error
            ? error.message.includes('Failed to fetch')
              ? 'Erreur de connexion au serveur. Vérifiez votre connexion internet.'
              : error.message
            : 'Erreur inconnue lors de la suppression'
        toast.error(`Erreur lors de la suppression: ${errorMessage}`)
      } finally {
        setConfirmDialog({ isOpen: false, message: '', onConfirm: () => {} })
      }
    }

    setConfirmDialog({
      isOpen: true,
      message: `Êtes-vous sûr de vouloir supprimer la question "${question.answer}" ?`,
      onConfirm: handleConfirm,
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
    return categoriesArray
      .map((cat) => {
        const catInfo = categories.find((c) => c.id === cat)
        return catInfo ? catInfo.name : cat
      })
      .join(', ')
  }

  const getTypeLabel = (type: MediaType) => {
    const labels: Record<MediaType, string> = {
      audio: 'Audio',
      image: 'Image',
      video: 'Vidéo',
    }
    return labels[type]
  }

  // Statistiques par catégorie
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {}
    categories.forEach((cat) => {
      stats[cat.id] = localQuestions.filter((q) => {
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
      <div className={styles.editorPanel}>
        <div className={styles.panelHeader}>
          <h2>
            <span style={{ marginRight: '0.5rem', fontSize: '20px' }}>✏️</span> Questions
          </h2>
          <div className={styles.editorStats}>
            <div className={`${styles.statItem} ${styles.statItemTotal}`}>
              <span className={styles.statLabel}>Total:</span>
              <span className={styles.statValue}>{localQuestions.length}</span>
            </div>
            <div className={styles.statCategories}>
              {categories.map((cat) => {
                const count = categoryStats[cat.id] || 0
                if (count === 0) return null
                return (
                  <div key={cat.id} className={`${styles.statItem} ${styles.statItemCategory}`} title={cat.name}>
                    <span style={{ fontSize: '16px' }}>
                      {cat.emoji}
                    </span>
                    <span className={styles.statCategoryName}>{cat.name}</span>
                    <span className={styles.statValue}>{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className={styles.editorFilters}>
          <label>
            Filtrer par catégorie :
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as Category | 'all')}
            >
              <option value="all">Toutes</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span style={{ marginRight: '0.5rem', fontSize: '16px' }}>🔍</span> Rechercher :
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par réponse, URL, indice ou catégorie..."
              className={styles.searchInput}
            />
            {searchQuery && (
              <button
                type="button"
                className={styles.searchClear}
                onClick={() => setSearchQuery('')}
                title="Effacer la recherche"
              >
                <span style={{ fontSize: '16px' }}>✕</span>
              </button>
            )}
          </label>
          <div className={styles.questionCount}>
            {filteredQuestions.length} question{filteredQuestions.length > 1 ? 's' : ''}
            {debouncedSearchQuery && (
              <span className={styles.searchResultsInfo}>
                {' '}
                sur {localQuestions.length} total{localQuestions.length > 1 ? 'es' : 'e'}
              </span>
            )}
          </div>
        </div>

        {(showAddForm || editingIndex !== null) && (
          <div className={styles.modalOverlay} onClick={cancelEdit}>
            <div className={`${styles.modalContent} ${styles.editorFormModal}`} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2>{editingIndex !== null ? 'Modifier la question' : 'Ajouter une question'}</h2>
                <button className={styles.closeButton} onClick={cancelEdit} title="Fermer">
                  <span style={{ fontSize: '16px' }}>✕</span>
                </button>
              </div>
              <div className={styles.modalBody}>
                <form
                  className={styles.questionForm}
                  onSubmit={handleSubmit(editingIndex !== null ? onUpdate : onSubmit)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault()
                      handleSubmit(editingIndex !== null ? onUpdate : onSubmit)()
                    }
                  }}
                >
                  <div className={styles.formGroup}>
                    <label>Catégorie *</label>
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
                      <div className={styles.youtubeErrorMessage}>
                        <span className={styles.errorIcon} style={{ fontSize: '16px' }}>
                          ⚠️
                        </span>
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
                      className={errors.mediaUrl ? styles.inputError : ''}
                    />
                    {errors.mediaUrl && (
                      <div className={styles.youtubeErrorMessage}>
                        <span className={styles.errorIcon} style={{ fontSize: '16px' }}>
                          ⚠️
                        </span>
                        <span>{errors.mediaUrl.message}</span>
                      </div>
                    )}
                    {watchedMediaUrl && !errors.mediaUrl && (
                      <div className={styles.youtubePreviewForm}>
                        {!youtubeThumbnail && isYouTubeUrl(watchedMediaUrl) && (
                          <span className={styles.youtubeHint}>
                            <span className={ds.spinner} style={{ fontSize: '16px' }}>
                              ⏳
                            </span>{' '}
                            Chargement des métadonnées...
                          </span>
                        )}
                        {youtubeThumbnail && youtubeValid && (
                          <div className={styles.youtubeMetadataPreview}>
                            <img
                              src={youtubeThumbnail}
                              alt="YouTube thumbnail"
                              className={styles.youtubeThumbnailPreview}
                            />
                            {youtubeTitle && (
                              <div className={styles.youtubeTitlePreview}>
                                <strong>
                                  <span style={{ marginRight: '0.5rem', fontSize: '16px' }}>
                                    📺
                                  </span>{' '}
                                  {youtubeTitle}
                                </strong>
                              </div>
                            )}
                          </div>
                        )}
                        {youtubeValid && !youtubeThumbnail && (
                          <span className={styles.youtubeHint}>
                            <span style={{ marginRight: '0.5rem', fontSize: '16px' }}>✅</span> URL
                            YouTube détectée
                          </span>
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
                      className={errors.answer ? styles.inputError : ''}
                    />
                    {errors.answer && (
                      <div className={styles.youtubeErrorMessage}>
                        <span className={styles.errorIcon} style={{ fontSize: '16px' }}>
                          ⚠️
                        </span>
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

                  <div className={styles.formActions}>
                    <button
                      type="submit"
                      className={styles.submitButton}
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
                          <span className={ds.spinner} style={{ fontSize: '16px' }}>
                            ⏳
                          </span>{' '}
                          Chargement...
                        </>
                      ) : editingIndex !== null ? (
                        <>
                          <span style={{ marginRight: '0.5rem', fontSize: '16px' }}>💾</span> Mettre
                          à jour
                        </>
                      ) : (
                        <>
                          <span style={{ marginRight: '0.5rem', fontSize: '16px' }}>➕</span>{' '}
                          Ajouter
                        </>
                      )}
                    </button>
                    <button type="button" className={styles.cancelButton} onClick={cancelEdit}>
                      Annuler
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        <div className={styles.panelContent}>
          <div className={styles.panelSection}>
            <div className={styles.sectionHeader}>
              <h3>Liste des questions</h3>
              <button
                className={styles.addButton}
                onClick={() => {
                  cancelEdit()
                  navigate('/editor/import-video')
                }}
              >
                <span style={{ marginRight: '0.5rem', fontSize: '16px' }}>➕</span> Importer une
                vidéo
              </button>
            </div>

            {filteredQuestions.length === 0 ? (
              <div className={styles.noQuestionsMessage}>
                <span className={styles.noQuestionsIcon} style={{ fontSize: '48px' }}>
                  🔍
                </span>
                <p>Aucune question trouvée</p>
                {debouncedSearchQuery && (
                  <p className={styles.noQuestionsHint}>
                    Essayez de modifier votre recherche ou vos filtres
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className={styles.questionsGrid}>
                  {filteredQuestions
                    .slice((currentPage - 1) * questionsPerPage, currentPage * questionsPerPage)
                    .map((question) => {
                      const questionId = question.id || question.mediaUrl
                      // Trouver l'index réel dans filteredQuestions pour handleEdit/handleDelete
                      const realIndex = filteredQuestions.findIndex(
                        (q) =>
                          (q.id && question.id && q.id === question.id) ||
                          q.mediaUrl === question.mediaUrl
                      )
                      const metadata = questionMetadata[question.mediaUrl]
                      const thumbnailUrl =
                        metadata?.thumbnailUrl ||
                        (question.type === 'video' && isYouTubeUrl(question.mediaUrl)
                          ? getYouTubeThumbnailFromUrl(question.mediaUrl)
                          : null)
                      const videoTitle = metadata?.title

                      return (
                        <div key={questionId} className={styles.questionCardEditor}>
                          <div className={styles.questionCardHeader}>
                            <span className={styles.questionCategory}>
                              {getCategoryLabel(question.category)}
                            </span>
                          </div>
                          <div className={styles.questionCardBody}>
                            <div className={styles.questionMedia}>
                              {thumbnailUrl && (
                                <div className={styles.youtubeThumbnailWrapper}>
                                  <img
                                    src={thumbnailUrl}
                                    alt={videoTitle || 'YouTube thumbnail'}
                                    className={styles.youtubeThumbnailSmall}
                                    title={videoTitle || undefined}
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none'
                                    }}
                                  />
                                  {videoTitle && (
                                    <div className={styles.youtubeTitleOverlay}>
                                      <span className={styles.youtubeTitleText}>{videoTitle}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className={styles.questionInfoCompact}>
                              <div className={styles.questionAnswerCompact}>
                                <strong>{question.answer}</strong>
                              </div>
                              {videoTitle && videoTitle !== question.answer && (
                                <div className={styles.questionVideoTitle}>{videoTitle}</div>
                              )}
                              {question.hint && (
                                <div className={styles.questionHintCompact}>{question.hint}</div>
                              )}
                            </div>
                          </div>
                          <div className={styles.questionCardActions}>
                            <button
                              className={styles.editButtonSmall}
                              onClick={() => handleEdit(realIndex)}
                              title="Modifier"
                            >
                              <span style={{ fontSize: '16px' }}>✏️</span>
                            </button>
                            <button
                              className={styles.deleteButtonSmall}
                              onClick={() => handleDelete(realIndex)}
                              title="Supprimer"
                            >
                              <span style={{ fontSize: '16px' }}>🗑️</span>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div
                    className={styles.pagination}
                    role="navigation"
                    aria-label="Pagination des questions"
                  >
                    <button
                      className={styles.paginationButton}
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      title="Page précédente"
                      aria-label="Page précédente"
                    >
                      <span style={{ marginRight: '0.5rem', fontSize: '16px' }}>◀️</span> Précédent
                    </button>
                    <span className={styles.paginationInfo} aria-current="page">
                      Page {currentPage} sur {totalPages}
                    </span>
                    <button
                      className={styles.paginationButton}
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      title="Page suivante"
                      aria-label="Page suivante"
                    >
                      Suivant <span style={{ marginLeft: '0.5rem', fontSize: '16px' }}>▶️</span>
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
