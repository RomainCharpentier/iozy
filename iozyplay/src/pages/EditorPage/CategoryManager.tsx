import { useState, useEffect } from 'react'
import { loadCategories, createCategory, updateCategory, deleteCategory, AVAILABLE_ICONS } from '../../services/categoryService'
import { QuestionService } from '../../services/questionService'
import type { CategoryInfo } from '../../services/types'
import { DEFAULT_CATEGORIES } from '../../services/types'

interface CategoryManagerProps {
  onClose: () => void
  onCategoriesChange: () => void
}

export default function CategoryManager({ onClose, onCategoriesChange }: CategoryManagerProps) {
  const [categories, setCategories] = useState<CategoryInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Partial<CategoryInfo>>({
    id: '',
    name: '',
    emoji: '🎵'
  })
  const [iconSearch, setIconSearch] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string
    emoji?: string
  }>({})
  const [touchedFields, setTouchedFields] = useState<{
    name?: boolean
    emoji?: boolean
  }>({})

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

  const handleAdd = async () => {
    setFormError(null)
    
    // Marquer tous les champs comme touchés pour afficher les erreurs
    setTouchedFields({ name: true, emoji: true })
    
    // La validation en temps réel va gérer les erreurs de champs
    if (!formData.name || !formData.emoji || fieldErrors.name || fieldErrors.emoji) {
      return
    }

    // Générer l'ID automatiquement à partir du nom
    const generatedId = generateIdFromName(formData.name)
    if (!generatedId) {
      setFieldErrors(prev => ({ ...prev, name: 'Le nom de la catégorie ne peut pas être vide' }))
      return
    }

    try {
      await createCategory({
        id: generatedId,
        name: formData.name,
        emoji: formData.emoji!
      })
      await loadCategoriesList()
      onCategoriesChange()
      resetForm()
      setShowAddForm(false)
    } catch (error) {
      setFormError('Erreur lors de la création: ' + (error instanceof Error ? error.message : 'Erreur inconnue'))
    }
  }

  const handleUpdate = async () => {
    setFormError(null)
    
    // Marquer tous les champs comme touchés pour afficher les erreurs
    setTouchedFields({ name: true, emoji: true })
    
    if (!editingId) {
      setFormError('Erreur: ID d\'édition invalide')
      return
    }
    
    // La validation en temps réel va gérer les erreurs de champs
    if (!formData.name || !formData.emoji || fieldErrors.name || fieldErrors.emoji) {
      return
    }

    try {
      const originalCategory = categories.find(c => c.id === editingId)
      if (!originalCategory) {
        setFormError('Catégorie introuvable')
        return
      }

      // Vérifier si le nom a changé
      const nameChanged = originalCategoryName !== formData.name
      
      if (nameChanged) {
        // Générer le nouvel ID à partir du nouveau nom
        const newId = generateIdFromName(formData.name)
        if (!newId) {
          setFormError('Impossible de générer un ID valide à partir du nom')
          return
        }

        // Vérifier que le nouvel ID n'existe pas déjà (sauf l'ID actuel)
        const existingCategoryWithNewId = categories.find(c => c.id === newId && c.id !== editingId)
        if (existingCategoryWithNewId) {
          setFormError(`Une catégorie avec l'ID "${newId}" existe déjà. Veuillez choisir un autre nom.`)
          return
        }

        // Récupérer toutes les questions de l'ancienne catégorie
        const allQuestions = await QuestionService.getAllQuestions()
        const questionsToUpdate = allQuestions.filter(q => q.category === editingId)

        // Mettre à jour la catégorie de toutes les questions associées AVANT de modifier la catégorie
        if (questionsToUpdate.length > 0) {
          const updatedQuestions = questionsToUpdate.map(q => ({
            ...q,
            category: newId as Category
          }))

          // Sauvegarder les questions mises à jour avec la nouvelle catégorie
          for (const question of updatedQuestions) {
            // Ajouter la question avec la nouvelle catégorie
            await QuestionService.addQuestion(question)
            // Supprimer l'ancienne question (avec l'ancienne catégorie)
            // Utiliser l'ID de la question ou mediaUrl comme fallback
            const questionId = question.id || question.mediaUrl
            await QuestionService.deleteQuestion(questionId, editingId as Category)
          }
        }

        // Créer la nouvelle catégorie avec le nouvel ID (avant de supprimer l'ancienne)
        await createCategory({
          id: newId,
          name: formData.name,
          emoji: formData.emoji!
        })

        // Supprimer l'ancienne catégorie (après avoir créé la nouvelle et mis à jour les questions)
        await deleteCategory(editingId)
      } else {
        // Si le nom n'a pas changé, juste mettre à jour l'icône
        await updateCategory(editingId, {
          name: formData.name,
          emoji: formData.emoji
        })
      }

      await loadCategoriesList()
      onCategoriesChange()
      resetForm()
      setEditingId(null)
      setOriginalCategoryName('')
    } catch (error) {
      setFormError('Erreur lors de la mise à jour: ' + (error instanceof Error ? error.message : 'Erreur inconnue'))
    }
  }

  const handleDelete = async (categoryId: string) => {
    // Vérifier s'il y a des questions rattachées à cette catégorie
    try {
      const allQuestions = await QuestionService.getAllQuestions()
      const questionsInCategory = allQuestions.filter(q => q.category === categoryId)
      
      if (questionsInCategory.length > 0) {
        const message = `Cette catégorie contient ${questionsInCategory.length} question${questionsInCategory.length > 1 ? 's' : ''}. ` +
          `La suppression de la catégorie supprimera également toutes les questions associées. ` +
          `Êtes-vous sûr de vouloir continuer ?`
        
        if (!confirm(message)) {
          return
        }
      } else {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) {
          return
        }
      }

      await deleteCategory(categoryId)
      await loadCategoriesList()
      onCategoriesChange()
    } catch (error) {
      setFormError('Erreur lors de la suppression: ' + (error instanceof Error ? error.message : 'Erreur inconnue'))
    }
  }

  const [originalCategoryName, setOriginalCategoryName] = useState<string>('')

  const handleEdit = (category: CategoryInfo) => {
    setEditingId(category.id)
    setFormData({ ...category })
    setOriginalCategoryName(category.name)
    setShowAddForm(false)
    // Réinitialiser les champs touchés pour la nouvelle édition
    setTouchedFields({})
  }

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      emoji: '🎵'
    })
    setIconSearch('')
    setFormError(null)
    setFieldErrors({})
    setTouchedFields({})
    setOriginalCategoryName('')
  }

  // Générer l'ID automatiquement quand le nom change (seulement pour les nouvelles catégories)
  useEffect(() => {
    if (!editingId && formData.name) {
      const generatedId = generateIdFromName(formData.name)
      setFormData(prev => ({ ...prev, id: generatedId }))
    }
  }, [formData.name, editingId])

  // Validation en temps réel du formulaire
  useEffect(() => {
    if (!showAddForm && editingId === null) {
      setFieldErrors({})
      setTouchedFields({})
      return
    }

    const errors: { name?: string; emoji?: string } = {}

    // Validation du nom (seulement si le champ a été touché)
    if (touchedFields.name || formData.name) {
      if (!formData.name || formData.name.trim() === '') {
        errors.name = 'Le nom de la catégorie est obligatoire'
      } else {
        // Vérifier l'unicité du nom
        const existingCategory = categories.find(c => 
          c.name.toLowerCase() === formData.name!.toLowerCase() &&
          (!editingId || c.id !== editingId)
        )
        if (existingCategory) {
          errors.name = 'Une catégorie avec ce nom existe déjà'
        } else if (editingId) {
          // Si on modifie une catégorie, vérifier que le nouvel ID généré n'existe pas déjà
          const generatedId = generateIdFromName(formData.name)
          if (generatedId && generatedId !== editingId) {
            const existingCategoryWithNewId = categories.find(c => c.id === generatedId)
            if (existingCategoryWithNewId) {
              errors.name = `L'ID généré "${generatedId}" existe déjà. Veuillez choisir un autre nom.`
            }
          }
        }
      }
    }

    // Validation de l'icône (seulement si l'utilisateur a interagi)
    if (touchedFields.emoji && !formData.emoji) {
      errors.emoji = 'L\'icône est obligatoire'
    }

    setFieldErrors(errors)
  }, [formData.name, formData.emoji, categories, showAddForm, editingId, touchedFields])

  const filteredIcons = AVAILABLE_ICONS.filter(icon => 
    iconSearch === '' || icon.includes(iconSearch)
  )

  if (isLoading) {
    return <div className="loading-state">⏳ Chargement des catégories...</div>
  }

  return (
    <div className="editor-panel">
      <div className="panel-header">
        <h2>📁 Catégories</h2>
      </div>

      {(showAddForm || editingId !== null) && (
        <div className="modal-overlay" onClick={() => {
          resetForm()
          setShowAddForm(false)
          setEditingId(null)
        }}>
          <div className="modal-content editor-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId !== null ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</h2>
              <button className="close-button" onClick={() => {
                resetForm()
                setShowAddForm(false)
                setEditingId(null)
              }} title="Fermer">
                ✕
              </button>
            </div>
            <div className="modal-body">
              <form 
                className="category-form" 
                onSubmit={(e) => {
                  e.preventDefault()
                  if (editingId !== null) {
                    handleUpdate()
                  } else {
                    handleAdd()
                  }
                }}
                onKeyDown={(e) => {
                  // Ctrl/Cmd + Enter pour soumettre même depuis un textarea
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    if (editingId !== null) {
                      handleUpdate()
                    } else {
                      handleAdd()
                    }
                  }
                }}
              >
            
            <div className="form-group">
              <label>
                Nom de la catégorie *
                <input
                  type="text"
                  value={formData.name || ''}
                  onBlur={() => setTouchedFields(prev => ({ ...prev, name: true }))}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value })
                    setFormError(null)
                    // Marquer le champ comme touché
                    if (!touchedFields.name) {
                      setTouchedFields(prev => ({ ...prev, name: true }))
                    }
                  }}
                  placeholder="ex: Musique française"
                  className={fieldErrors.name ? 'input-error' : ''}
                />
                <small>L'ID sera généré automatiquement à partir du nom</small>
                {fieldErrors.name && (
                  <div className="youtube-error-message">
                    <span className="error-icon">⚠️</span>
                    <span>{fieldErrors.name}</span>
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
                        className={`icon-button ${formData.emoji === icon ? 'selected' : ''}`}
                        onClick={() => {
                          setFormData({ ...formData, emoji: icon })
                          setTouchedFields(prev => ({ ...prev, emoji: true }))
                        }}
                        title={icon}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                  {formData.emoji && (
                    <div className="selected-icon-preview">
                      Icône sélectionnée: <span className="icon-large">{formData.emoji}</span>
                    </div>
                  )}
                  {fieldErrors.emoji && (
                    <div className="youtube-error-message field-error-inline">
                      <span className="error-icon">⚠️</span>
                      <span>{fieldErrors.emoji}</span>
                    </div>
                  )}
                </div>
              </label>
            </div>

            {/* Afficher seulement les erreurs serveur/API, pas les erreurs de validation de champs */}
            {formError && !fieldErrors.name && !fieldErrors.emoji && (
              <div className="form-error-message">
                <span className="error-icon">⚠️</span>
                <span>{formError}</span>
              </div>
            )}

            <div className="form-actions">
              <button
                type="submit"
                className="submit-button"
                onClick={(e) => {
                  e.preventDefault()
                  editingId !== null ? handleUpdate() : handleAdd()
                }}
                disabled={!!fieldErrors.name || !!fieldErrors.emoji || !formData.name || !formData.emoji}
                title={
                  fieldErrors.name || fieldErrors.emoji
                    ? 'Veuillez corriger les erreurs dans le formulaire'
                    : !formData.name || !formData.emoji
                      ? 'Veuillez remplir tous les champs obligatoires'
                      : ''
                }
              >
                {editingId !== null ? '💾 Mettre à jour' : '➕ Ajouter'}
              </button>
              <button
                type="button"
                className="cancel-button"
                onClick={() => {
                  resetForm()
                  setShowAddForm(false)
                  setEditingId(null)
                }}
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
                resetForm()
                setEditingId(null)
                setShowAddForm(true)
              }}
            >
              ➕ Ajouter une catégorie
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
                    ✏️
                  </button>
                  <button
                    className="delete-button-small"
                    onClick={() => handleDelete(category.id)}
                    title="Supprimer"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

