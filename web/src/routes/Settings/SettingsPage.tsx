import { useState, type DragEvent } from 'react'
import { GripVertical } from 'lucide-react'
import {
  TITLE_LANGUAGE_LABELS,
  getTitleComposition,
  setTitleComposition,
  type TitleComposition,
} from '../../lib/titleLanguage'

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
      <h1 className="font-display text-2xl font-bold text-textPrimary">Réglages</h1>

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
                <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accentText">
                  principal
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
