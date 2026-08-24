import { useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, GripVertical, Moon, Sun, Wrench } from 'lucide-react'
import {
  TITLE_LANGUAGE_LABELS,
  getTitleComposition,
  setTitleComposition,
  type TitleComposition,
} from '../../lib/titleLanguage'
import { useTheme } from '../../lib/theme'

/** Réglage propre à cet appareil (localStorage, pas de compte/backend - voir
 * lib/titleLanguage.ts) : seule la recherche/ajout de manga (Jikan/MyAnimeList)
 * est concernée, ni Jikan ni MAL ne renvoyant de titre français nativement.
 *
 * Glisser-déposer natif (HTML5 drag events, pas de librairie) : la première
 * langue active devient le titre sauvegardé, les suivantes actives suivent
 * entre parenthèses dans l'ordre choisi ici.
 */
export function SettingsPage() {
  // État local reflétant localStorage - setTitleComposition() persiste ET
  // notifie les autres consommateurs (QuickAddPage) via un événement custom,
  // voir lib/titleLanguage.ts.
  const [composition, setComposition] = useState<TitleComposition>(getTitleComposition)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const { theme, toggleTheme } = useTheme()

  function update(next: TitleComposition) {
    setComposition(next)
    setTitleComposition(next)
  }

  function toggleEnabled(index: number) {
    // Au moins une langue doit rester active - sinon plus aucun titre ne
    // serait résolvable pour l'ajout rapide (voir garde-fou similaire dans
    // resolvePrimaryTitle, qui retombe sur candidate.title en dernier
    // recours, mais autant l'empêcher ici plutôt que de compter dessus).
    const next = composition.map((item, i) => (i === index ? { ...item, enabled: !item.enabled } : item))
    if (!next.some((item) => item.enabled)) return
    update(next)
  }

  function reorder(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return
    const next = [...composition]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    update(next)
  }

  function handleDragStart(index: number) {
    return (e: DragEvent<HTMLLIElement>) => {
      setDraggedIndex(index)
      e.dataTransfer.effectAllowed = 'move'
    }
  }

  function handleDragOver(index: number) {
    return (e: DragEvent<HTMLLIElement>) => {
      e.preventDefault()
      if (draggedIndex !== null && draggedIndex !== index) {
        reorder(draggedIndex, index)
        setDraggedIndex(index)
      }
    }
  }

  // Premier item ACTIF (pas forcément index 0, si l'utilisateur a désactivé
  // celui du dessus) - c'est lui qui devient le titre sauvegardé, voir
  // resolvePrimaryTitle. Sert juste au badge "principal" ci-dessous.
  const primaryIndex = composition.findIndex((item) => item.enabled)

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-bold text-textPrimary">Paramètres</h1>

      {/* Apparence : réglage minimal pour l'instant (voir Lot 1 de la
          migration Design V1.2 - docs/DESIGN_MIGRATION_V1.2.md), sera
          intégré à une refonte plus large de cet écran en Lot 8. Pattern
          switch identique à celui utilisé pour "Suivre les sorties" dans la
          maquette (role="switch" + aria-checked, jamais un simple bouton
          texte pour un état à deux valeurs). */}
      <section className="flex items-center gap-3 rounded-xl bg-surface p-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface2 text-accentText">
          {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
        </span>
        <span className="flex-1">
          <span className="block font-medium text-textPrimary">Thème {theme === 'dark' ? 'sombre' : 'clair'}</span>
          <span className="block text-xs text-textDim">Basculer entre thème clair et sombre</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={theme === 'dark'}
          aria-label="Thème sombre"
          onClick={toggleTheme}
          // Le bouton fait 44 px de haut, le rail en garde 26 : la cible
          // tactile grandit sans que l'interrupteur grossisse. Un rail de
          // 44 px aurait l'air d'un bouton, pas d'un interrupteur - alors que
          // 26 px se rate au pouce, et rater celui-ci change le thème de
          // l'application.
          className="flex h-11 shrink-0 items-center"
        >
          <span
            className={`relative flex h-[26px] w-11 rounded-full p-0.5 transition-colors ${
              theme === 'dark' ? 'bg-accent' : 'bg-surface2'
            }`}
          >
            <span
              className={`block h-[20px] w-[20px] rounded-full bg-white shadow-token-sm transition-transform ${
                theme === 'dark' ? 'translate-x-[20px]' : 'translate-x-0'
              }`}
            />
          </span>
        </button>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-semibold text-textPrimary">Titre des mangas</h2>
        <p className="text-sm text-textDim">
          Fais glisser pour choisir l'ordre, coche/décoche pour activer/désactiver. La première langue active
          disponible devient le titre ajouté à ta collection ; les suivantes actives apparaissent entre parenthèses.
          "Français" déclenche une recherche best-effort supplémentaire (Open Library, puis Google Books en repli) -
          ni Jikan ni MyAnimeList n'en fournissent nativement. "Anglais" et "Romaji" n'appellent jamais cette
          recherche : aucun appel externe en plus si "Français" est décoché.
        </p>

        <ul className="mt-2 flex flex-col gap-2">
          {composition.map((item, index) => (
            <li
              key={item.language}
              draggable
              onDragStart={handleDragStart(index)}
              onDragOver={handleDragOver(index)}
              onDragEnd={() => setDraggedIndex(null)}
              className={`flex items-center gap-3 rounded-xl bg-surface p-3 text-sm text-textPrimary ${
                draggedIndex === index ? 'opacity-50' : ''
              }`}
            >
              <GripVertical size={18} className="shrink-0 cursor-grab text-textDim" />
              <label className="flex flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={() => toggleEnabled(index)}
                  className="h-4 w-4 accent-accent"
                />
                {TITLE_LANGUAGE_LABELS[item.language]}
              </label>
              {index === primaryIndex && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accentInk">
                  principal
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Types de collection/Import BGG/Export brut : configuration technique
          touchée une fois puis oubliée, pas un réglage de confort d'usage
          comme la langue des titres ci-dessus - regroupée à part (voir
          AdministrationPage) plutôt que noyée ici (voir "réduction réelle de
          la charge cognitive"). */}
      <Link
        to="/administration"
        className="flex items-center gap-3 rounded-xl bg-surface p-3 transition-colors hover:bg-surface2"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface2 text-accentText">
          <Wrench size={18} />
        </span>
        <span className="flex-1">
          <span className="block font-medium text-textPrimary">Administration avancée</span>
          <span className="block text-xs text-textDim">Types de collection, import BGG, export brut des données</span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-textDim" />
      </Link>
    </div>
  )
}
