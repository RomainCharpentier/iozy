import ds from '@/styles/shared/DesignSystem.module.scss'
import styles from '@/pages/CategorySelectorPage/CategorySelector.module.scss'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRight, Check, FolderOpen } from 'lucide-react'
import { type Category, type CategoryInfo, DEFAULT_CATEGORIES } from '@/types'
import { loadCategories } from '@/services/categoryService'
import type { Player } from '@/lib/game/types'
import { soundManager } from '@/utils/sounds'
import CategoryIcon from '@/components/common/CategoryIcon'
import SectionHeader from '@/components/common/SectionHeader'
import EmptyState from '@/components/common/EmptyState'
import { QuestionService } from '@/services/questionService'
import { settingsService } from '@/services/settingsService'
interface CategorySelectorProps {
  onStartGame: (
    categories: Category[],
    mode: 'solo' | 'online',
    players: Player[],
    playerName: string
  ) => void | Promise<void>
}

const SKELETON_TILES = 5

export default function CategorySelector({ onStartGame }: CategorySelectorProps) {
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([])
  const [playerName, setPlayerName] = useState<string>('')
  const [categories, setCategories] = useState<CategoryInfo[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)

  useEffect(() => {
    loadCategoriesList()
    // Récupérer le nom de l'utilisateur défini sur la page Username
    const settings = settingsService.getSettings()
    if (settings.username && settings.username.trim()) {
      setPlayerName(settings.username.trim())
    }
  }, [])

  const loadCategoriesList = async () => {
    setIsLoadingCategories(true)
    try {
      const allCats = await loadCategories()
      const cats = allCats.length > 0 ? allCats : DEFAULT_CATEGORIES

      // Filtrer les catégories qui n'ont pas de questions
      const categoriesWithQuestions = await Promise.all(
        cats.map(async (cat) => {
          const questions = await QuestionService.getQuestionsForCategories([cat.id])
          return { category: cat, hasQuestions: questions.length > 0 }
        })
      )

      // Ne garder que les catégories avec des questions
      const filteredCategories = categoriesWithQuestions
        .filter(({ hasQuestions }) => hasQuestions)
        .map(({ category }) => category)

      setCategories(filteredCategories.length > 0 ? filteredCategories : [])
    } catch (error) {
      console.error('Erreur lors du chargement des catégories:', error)
      setCategories([])
    } finally {
      setIsLoadingCategories(false)
    }
  }

  const toggleCategory = (category: Category) => {
    soundManager.playClick() // Son de clic
    setSelectedCategories((prev) => {
      if (prev.includes(category)) {
        return prev.filter((c) => c !== category)
      } else {
        return [...prev, category]
      }
    })
  }

  const handleStartGame = async () => {
    if (selectedCategories.length === 0) {
      toast.error('Veuillez sélectionner au moins une catégorie !', {
        icon: '📂',
      })
      return
    }

    const name = playerName && playerName.trim() ? playerName.trim() : 'Joueur'
    // On laisse le mode de jeu se décider plus tard via le lobby.
    // Ici, on prépare juste la configuration et on passe par le flux salon.
    const players: Player[] = []

    soundManager.playStart()
    await onStartGame(selectedCategories, 'online', players, name)
  }

  const count = selectedCategories.length

  // Le sous-titre dit quelque chose de vrai et de calculé, jamais un slogan.
  const subtitle = isLoadingCategories
    ? 'Chargement des thèmes…'
    : categories.length === 0
      ? "Aucun thème ne contient de question pour l'instant."
      : count === 0
        ? `Choisis un ou plusieurs thèmes parmi ${categories.length}.`
        : `${count} thème${count > 1 ? 's' : ''} sélectionné${count > 1 ? 's' : ''} sur ${categories.length}.`

  return (
    <div className={styles.selector}>
      <SectionHeader
        level={1}
        title="Créer une partie"
        subtitle={subtitle}
        action={
          <button
            type="button"
            className={`${ds.btn} ${ds.btnPrimary}`}
            onClick={handleStartGame}
            disabled={count === 0}
            aria-label={
              count === 0
                ? 'Sélectionnez au moins une catégorie pour commencer'
                : 'Commencer la partie'
            }
          >
            Continuer
            <ArrowRight size={16} />
          </button>
        }
      />

      {isLoadingCategories ? (
        <div className={styles.grid} role="status">
          <span className="iozy-sr-only">Chargement des thèmes…</span>
          {Array.from({ length: SKELETON_TILES }, (_, i) => (
            <div key={i} aria-hidden="true" className={`iozy-skeleton ${styles.tileSkeleton}`} />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Aucun thème jouable"
          detail="Ajoute des questions dans l'éditeur pour pouvoir jouer."
          action={
            <Link to="/editor" className={`${ds.btn} ${ds.btnSecondary}`}>
              Ouvrir l'éditeur
            </Link>
          }
        />
      ) : (
        <div className={styles.grid}>
          {categories.map((category) => {
            const selected = selectedCategories.includes(category.id)
            return (
              <button
                key={category.id}
                type="button"
                className={`${styles.tile} ${selected ? styles.tileSelected : ''}`}
                onClick={() => toggleCategory(category.id)}
                aria-label={`${selected ? 'Désélectionner' : 'Sélectionner'} la catégorie ${category.name}`}
                aria-pressed={selected}
              >
                <span className={styles.tileCheck} aria-hidden="true">
                  <Check size={14} strokeWidth={3} />
                </span>
                <span className={styles.tileEmoji}>
                  <CategoryIcon categoryId={category.id} iconId={category.emoji} size={32} />
                </span>
                <span className={styles.tileName}>{category.name}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
