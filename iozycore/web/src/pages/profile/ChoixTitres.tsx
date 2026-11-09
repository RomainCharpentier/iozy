import { useState, type DragEvent } from 'react'
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import {
  TITLE_LANGUAGE_LABELS,
  setTitleComposition,
  useTitleComposition,
  type TitleComposition,
} from '@/common/lib/titleLanguage'

/**
 * The order of the title languages for the manga add search (Jikan/MAL):
 * the first active language becomes the saved title, the next active ones
 * follow in parentheses.
 *
 * <p>Native drag and drop (no library), and arrows, because HTML drag and drop
 * does not exist with a finger: on a phone the order was impossible to change
 * (batch 148). At least one language stays on. A change is stored on the
 * device and announced, so it reaches the account (lot 218).
 */
export function ChoixTitres() {
  const composition = useTitleComposition()
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  function update(next: TitleComposition) {
    setTitleComposition(next)
  }

  function toggleEnabled(index: number) {
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

  const primaryIndex = composition.findIndex((item) => item.enabled)

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-textDim">
        La première langue cochée devient le titre enregistré ; les suivantes s'affichent entre parenthèses. « Français »
        demande une recherche de plus aux sources, les deux autres non.
      </p>
      <ul aria-label="Ordre des langues de titre" className="flex flex-col gap-2">
        {composition.map((item, index) => (
          <li
            key={item.language}
            draggable
            onDragStart={handleDragStart(index)}
            onDragOver={handleDragOver(index)}
            onDragEnd={() => setDraggedIndex(null)}
            className={`flex items-center gap-3 rounded-xl bg-verre py-1 pr-1.5 pl-3 text-sm text-textPrimary ring-1 ring-ligneVerre ${
              draggedIndex === index ? 'opacity-50' : ''
            }`}
          >
            <GripVertical size={18} className="shrink-0 cursor-grab text-textDim" aria-hidden="true" />
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
              <span className="iozy-teinte rounded-full bg-vive px-2 py-0.5 text-xs font-medium text-encreVive">
                principal
              </span>
            )}
            <span className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => reorder(index, index - 1)}
                disabled={index === 0}
                aria-label={`Monter ${TITLE_LANGUAGE_LABELS[item.language]}`}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-textDim hover:text-textPrimary disabled:opacity-30"
              >
                <ChevronUp size={18} />
              </button>
              <button
                type="button"
                onClick={() => reorder(index, index + 1)}
                disabled={index === composition.length - 1}
                aria-label={`Descendre ${TITLE_LANGUAGE_LABELS[item.language]}`}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-textDim hover:text-textPrimary disabled:opacity-30"
              >
                <ChevronDown size={18} />
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
