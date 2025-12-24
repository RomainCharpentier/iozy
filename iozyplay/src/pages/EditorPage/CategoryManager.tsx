import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { FaPlus, FaEdit, FaTrash, FaTimes, FaSave, FaExclamationTriangle, FaSpinner } from 'react-icons/fa'
import { loadCategories, createCategory, updateCategory, deleteCategory, AVAILABLE_ICONS } from '../../services/categoryService'
import { QuestionService } from '../../services/questionService'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import type { CategoryInfo, Category } from '../../services/types'
import { DEFAULT_CATEGORIES } from '../../services/types'
import { categorySchema, type CategoryFormData } from '../../schemas/categorySchema'

interface CategoryManagerProps {
  onClose: () => void
  onCategoriesChange: () => void
}

export default function CategoryManager({ onClose, onCategoriesChange }: CategoryManagerProps) {
  const [categories, setCategories] = useState<CategoryInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [iconSearch, setIconSearch] = useState('')
  const [originalCategoryName, setOriginalCategoryName] = useState<string>('')
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
    reset
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      emoji: '🎵'
    }
  })

  const watchedName = watch('name')
  const watchedEmoji = watch('emoji')

  /**
   * Génère un ID à partir d'un nom de catégorie
   * Convertit en minuscules, remplace les espaces par des tirets, supprime les caractères spéciaux
   */
  const generateIdFromName = (name: string): string => {
    if (!name || name.trim() === '') {
      return ''
    }
    return name
      .toLowerCase()
      .normalize('NFD') // Décompose les caractères accentués
      .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
      .replace(/[^a-z0-9\s-]/g, '') // Garde seulement lettres, chiffres, espaces et tirets
      .trim()
      .replace(/\s+/g, '-') // Remplace les espaces par des tirets
      .replace(/-+/g, '-') // Remplace les tirets multiples par un seul
      .replace(/^-|-$/g, '') // Supprime les tirets en début et fin
  }

  useEffect(() => {
    loadCategoriesList()
  }, [])

  const loadCategoriesList = async () => {
    try {
      setIsLoading(true)
      const cats = await loadCategories()
      setCategories(cats.length > 0 ? cats : DEFAULT_CATEGORIES)
    } catch (error) {
      console.error('Erreur:', error)
      setCategories(DEFAULT_CATEGORIES)
    } finally {
      setIsLoading(false)
    }
  }

  const onSubmit = async (data: CategoryFormData) => {
    const generatedId = generateIdFromName(data.name)
    if (!generatedId) {
      toast.error('Le nom de la catégorie ne peut pas être vide')
      return
    }

    // Vérifier l'unicité
    const existingCategory = categories.find(c => c.id === generatedId)
    if (existingCategory) {
      toast.error(`Une catégorie avec l'ID "${generatedId}" existe déjà`)
      return
    }

    try {
      await createCategory({
        id: generatedId,
        name: data.name,
        emoji: data.emoji
      })
      await loadCategoriesList()
      onCategoriesChange()
      reset()
      setShowAddForm(false)
      toast.success('Catégorie créée avec succès')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      toast.error(`Erreur lors de la création: ${errorMessage}`)
    }
  }

  const onUpdate = async (data: CategoryFormData) => {
    if (!editingId) {
      toast.error('Erreur: ID d\'édition invalide')
      return
    }

    try {
      const originalCategory = categories.find(c => c.id === editingId)
      if (!originalCategory) {
        toast.error('Catégorie introuvable')
        return
      }

      const nameChanged = originalCategoryName !== data.name
      
      if (nameChanged) {
        const newId = generateIdFromName(data.name)
        if (!newId) {
          toast.error('Impossible de générer un ID valide à partir du nom')
          return
        }

        const existingCategoryWithNewId = categories.find(c => c.id === newId && c.id !== editingId)
        if (existingCategoryWithNewId) {
          toast.error(`Une catégorie avec l'ID "${newId}" existe déjà. Veuillez choisir un autre nom.`)
          return
        }

        const allQuestions = await QuestionService.getAllQuestions()
        const questionsToUpdate = allQuestions.filter(q => {
          const questionCategories = Array.isArray(q.category) ? q.category : [q.category]
          return questionCategories.includes(editingId)
        })

        if (questionsToUpdate.length > 0) {
          for (const question of questionsToUpdate) {
            const oldCategories = Array.isArray(question.category) ? question.category : [question.category]
            const newCategories = oldCategories.map(cat => cat === editingId ? newId : cat)
            const updatedQuestion = { ...question, category: newCategories.length === 1 ? newCategories[0] : newCategories }
            
            const questionId = question.id || question.mediaUrl
            await QuestionService.deleteQuestion(questionId, editingId)
            await QuestionService.addQuestion(updatedQuestion)
          }
        }

        await createCategory({
          id: newId,
          name: data.name,
          emoji: data.emoji
        })

        await deleteCategory(editingId)
      } else {
        await updateCategory(editingId, {
          name: data.name,
          emoji: data.emoji
        })
      }

      await loadCategoriesList()
      onCategoriesChange()
      reset()
      setEditingId(null)
      setOriginalCategoryName('')
      toast.success('Catégorie mise à jour avec succès')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      toast.error(`Erreur lors de la mise à jour: ${errorMessage}`)
    }
  }

  const handleDelete = async (categoryId: string) => {
    try {
      const allQuestions = await QuestionService.getAllQuestions()
      const questionsInCategory = allQuestions.filter(q => {
        const questionCategories = Array.isArray(q.category) ? q.category : [q.category]
        return questionCategories.includes(categoryId)
      })
      
      const handleConfirm = async () => {
        try {
          await deleteCategory(categoryId)
          await loadCategoriesList()
          onCategoriesChange()
          toast.success('Catégorie supprimée avec succès')
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
          toast.error(`Erreur lors de la suppression: ${errorMessage}`)
        } finally {
          setConfirmDialog({ isOpen: false, message: '', onConfirm: () => {} })
        }
      }

      let message = 'Êtes-vous sûr de vouloir supprimer cette catégorie ?'
      if (questionsInCategory.length > 0) {
        message = `Cette catégorie contient ${questionsInCategory.length} question${questionsInCategory.length > 1 ? 's' : ''}. La suppression supprimera également toutes les questions associées. Êtes-vous sûr de vouloir continuer ?`
      }

      setConfirmDialog({
        isOpen: true,
        message,
        onConfirm: handleConfirm
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      toast.error(`Erreur lors de la suppression: ${errorMessage}`)
    }
  }

  const handleEdit = (category: CategoryInfo) => {
    setEditingId(category.id)
    setOriginalCategoryName(category.name)
    setShowAddForm(false)
    reset({
      name: category.name,
      emoji: category.emoji
    })
  }

  const cancelEdit = () => {
    reset()
    setIconSearch('')
    setEditingId(null)
    setShowAddForm(false)
    setOriginalCategoryName('')
  }

  // Validation personnalisée pour l'unicité du nom
  useEffect(() => {
    if (!watchedName || (!showAddForm && editingId === null)) return

    const existingCategory = categories.find(c => 
      c.name.toLowerCase() === watchedName.toLowerCase() &&
      (!editingId || c.id !== editingId)
    )
    
    if (existingCategory) {
      setValue('name', watchedName, { shouldValidate: true })
    }

    if (editingId) {
      const generatedId = generateIdFromName(watchedName)
      if (generatedId && generatedId !== editingId) {
        const existingCategoryWithNewId = categories.find(c => c.id === generatedId)
        if (existingCategoryWithNewId) {
          setValue('name', watchedName, { shouldValidate: true })
        }
      }
    }
  }, [watchedName, categories, showAddForm, editingId, setValue])

  const filteredIcons = AVAILABLE_ICONS.filter(icon => 
    iconSearch === '' || icon.includes(iconSearch)
  )

  if (isLoading) {
    return <div className="loading-state">⏳ Chargement des catégories...</div>
  }

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
        <h2>📁 Catégories</h2>
      </div>

      {(showAddForm || editingId !== null) && (
        <div className="modal-overlay" onClick={cancelEdit}>
          <div className="modal-content editor-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId !== null ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</h2>
              <button className="close-button" onClick={cancelEdit} title="Fermer">
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <form 
                className="category-form" 
                onSubmit={handleSubmit(editingId !== null ? onUpdate : onSubmit)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    handleSubmit(editingId !== null ? onUpdate : onSubmit)()
                  }
                }}
              >
            
            <div className="form-group">
              <label>
                Nom de la catégorie *
                <input
                  type="text"
                  {...register('name')}
                  placeholder="ex: Musique française"
                  className={errors.name ? 'input-error' : ''}
                />
                <small>L'ID sera généré automatiquement à partir du nom</small>
                {errors.name && (
                  <div className="youtube-error-message">
                    <FaExclamationTriangle className="error-icon" />
                    <span>{errors.name.message}</span>
                  </div>
                )}
              </label>
            </div>

            <div className="form-group">
              <label>
                Icône *
                <div className="icon-selector">
                  <input
                    type="text"
                    value={iconSearch}
                    onChange={(e) => setIconSearch(e.target.value)}
                    placeholder="Rechercher une icône..."
                    className="icon-search"
                  />
                  <div className="icon-grid">
                    {filteredIcons.slice(0, 50).map(icon => (
                      <button
                        key={icon}
                        type="button"
                        className={`icon-button ${watchedEmoji === icon ? 'selected' : ''}`}
                        onClick={() => {
                          setValue('emoji', icon, { shouldValidate: true })
                        }}
                        title={icon}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                  {watchedEmoji && (
                    <div className="selected-icon-preview">
                      Icône sélectionnée: <span className="icon-large">{watchedEmoji}</span>
                    </div>
                  )}
                  {errors.emoji && (
                    <div className="youtube-error-message field-error-inline">
                      <FaExclamationTriangle className="error-icon" />
                      <span>{errors.emoji.message}</span>
                    </div>
                  )}
                </div>
              </label>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="submit-button"
                disabled={isSubmitting || !!errors.name || !!errors.emoji}
                title={
                  errors.name || errors.emoji
                    ? 'Veuillez corriger les erreurs dans le formulaire'
                    : ''
                }
              >
                {isSubmitting ? (
                  <>
                    <FaSpinner className="spinner" /> Chargement...
                  </>
                ) : editingId !== null ? (
                  <>
                    <FaSave /> Mettre à jour
                  </>
                ) : (
                  <>
                    <FaPlus /> Ajouter
                  </>
                )}
              </button>
              <button
                type="button"
                className="cancel-button"
                onClick={cancelEdit}
              >
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
            <h3>Catégories existantes</h3>
            <button
              className="add-button"
              onClick={() => {
                cancelEdit()
                setShowAddForm(true)
              }}
            >
              <FaPlus /> Ajouter une catégorie
            </button>
          </div>

          <div className="categories-grid-manager">
            {categories.map(category => (
              <div key={category.id} className="category-card-manager">
                <div className="category-display">
                  <span className="category-emoji-large">{category.emoji}</span>
                  <div className="category-info-manager">
                    <div className="category-name-manager">{category.name}</div>
                  </div>
                </div>
                <div className="category-actions-manager">
                    <button
                      className="edit-button-small"
                      onClick={() => handleEdit(category)}
                      title="Modifier"
                    >
                      <FaEdit />
                    </button>
                    <button
                      className="delete-button-small"
                      onClick={() => handleDelete(category.id)}
                      title="Supprimer"
                    >
                      <FaTrash />
                    </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

