import { useState, type DragEvent, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp, Download, GripVertical, Upload } from 'lucide-react'
import { useAuth } from '@/common/hooks/useAuth'
import {
  TITLE_LANGUAGE_LABELS,
  getTitleComposition,
  setTitleComposition,
  type TitleComposition,
} from '@/common/lib/titleLanguage'

/**
 * The settings, sorted by <b>what they concern</b> - on the Profil page,
 * in the open.
 *
 * <h2>No longer a screen, a section (batch 140)</h2>
 * They used to be the "Paramètres" screen, reached from Profil by a link: two
 * screens for the same person, and "ça doit être lisible direct". This
 * component renders both sections under the sharing, on Profil itself; the
 * old `/settings` routes redirect there.
 *
 * <h2>Two sections, and the border is real</h2>
 * <b>Mon compte</b> follows you everywhere: it lives on the server, and the export is
 * part of it - downloading one's collection is not technical configuration,
 * it is the guarantee of being able to leave. <b>Cet appareil</b> follows
 * nothing: the language of the titles lives in the {@code localStorage} of this
 * browser, and changing machine loses it. The section says so, because
 * nobody can guess it.
 *
 * <p>The light or dark theme lived here too, until batch 138: it is
 * changed from the header, with one click on the sun or the moon (see
 * BoutonTheme). A setting that one changes according to the light of the room does not have to
 * be three clicks away.
 *
 * <p>What is here NEITHER one NOR the other - the collection categories, the
 * reference editions, the import, the accounts - concerns the <b>content</b> of
 * the collection or the <b>instance</b>, and lives in Administration, a
 * SIBLING screen reached from Profil. Not from here: it lived here until
 * 2026-08-29, and setting one's theme has nothing to do with declaring the categories
 * of one's collection - one is not found by looking for the other.
 *
 * <h2>The language of the titles</h2>
 * Only the manga search/add (Jikan/MyAnimeList) is concerned, as neither
 * Jikan nor MAL returns a French title natively. Native drag and drop
 * (HTML5 drag events, no library): the first active language
 * becomes the saved title, the following active ones follow in
 * parentheses in the order chosen here.
 */
export function Reglages({ appareilRef }: { appareilRef?: RefObject<HTMLDivElement | null> }) {
  // Local state reflecting localStorage - setTitleComposition() persists AND
  // notifies the other consumers (QuickAddPage) through a custom event,
  // see lib/titleLanguage.ts.
  const [composition, setComposition] = useState<TitleComposition>(getTitleComposition)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const { compte } = useAuth()


  function update(next: TitleComposition) {
    setComposition(next)
    setTitleComposition(next)
  }

  function toggleEnabled(index: number) {
    // At least one language must stay active - otherwise no title would
    // be resolvable anymore for the quick add (see similar safeguard in
    // resolvePrimaryTitle, which falls back on candidate.title as a last
    // resort, but better to prevent it here than to count on it).
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

  // First ACTIVE item (not necessarily index 0, if the user has disabled
  // the one above) - it is the one that becomes the saved title, see
  // resolvePrimaryTitle. Only serves for the "principal" badge below.
  const primaryIndex = composition.findIndex((item) => item.enabled)

  return (
    <div className="flex flex-col gap-5">
      {compte && (
        // Named for a screen reader (aria-labelledby): without an accessible
        // name, a <section> is not a landmark that can be targeted.
        <section aria-labelledby="section-mon-compte" className="flex flex-col gap-3">
          <h2 id="section-mon-compte" className="font-display text-lg font-semibold text-textPrimary">
            Mon compte
          </h2>

          <div className="flex flex-col gap-3 rounded-xl bg-surface p-4">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-textPrimary">{compte.pseudo}</span>
              {/* The username can no longer be the address (see AppUser): the two
                  lines never repeat each other. */}
              <span className="text-xs text-textDim">{compte.email}</span>
            </div>
          </div>

          {/* The export lived in "Administration avancée", next to the
              collection categories. It is not configuration:
              it is what guarantees that one can leave with one's data, and it
              belongs to the account that owns it. */}
          <div className="flex flex-col gap-2 rounded-xl bg-surface p-4">
            <span className="flex items-center gap-2 font-medium text-textPrimary">
              <Download size={16} className="shrink-0 text-accentText" />
              Emporter ma collection
            </span>
            <p className="text-sm text-textDim">
              Séries, tomes, possessions, expériences, envies, relations et tags, plus ce que tu as saisi à la main
              et qu'on ne peut pas recalculer : éditions de référence, classements et Tier Lists. Format ouvert,
              lisible sans cette app - pour garantir l'absence d'enfermement, même auto-hébergé. Restent dehors,
              volontairement : l'historique d'analyses d'achat (des instantanés, pas des données saisies) et les
              jetons de partage, qui sont des secrets.
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              <a
                href="/api/export/json"
                download
                className="btn-secondaire"
              >
                Télécharger en JSON
              </a>
              <a
                href="/api/export/csv"
                download
                className="btn-secondaire"
              >
                Télécharger en CSV (.zip)
              </a>
            </div>
          </div>

          {/* The way back of the previous block (batch 115). Without it, "emporter"
              was a one-way trip: changing NAS or starting again from a
              backup was only possible by restoring the whole PostgreSQL. */}
          <div className="flex flex-col gap-2 rounded-xl bg-surface p-4">
            <span className="flex items-center gap-2 font-medium text-textPrimary">
              <Upload size={16} className="shrink-0 text-accentText" />
              Restaurer une collection
            </span>
            <p className="text-sm text-textDim">
              Renvoie le fichier JSON téléchargé ci-dessus - depuis une autre installation, ou une sauvegarde. Tu vois
              d'abord ce que l'import ferait ; ce qui existe déjà est retrouvé, jamais dupliqué ni modifié.
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              <Link
                to="/profile/import"
                className="btn-secondaire"
              >
                Importer un fichier
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Anchored: "Langue des titres" of the Catalog arrives here, not at the top
          of a profile that one would then have to scroll. */}
      <div ref={appareilRef} className="scroll-mt-4">
        <h2 id="section-cet-appareil" className="font-display text-lg font-semibold text-textPrimary">
          Cet appareil
        </h2>
      </div>
      {/* Said once: this setting lives in the localStorage of this browser,
          not on the account. Without this sentence, someone who opens the app on
          their phone believes a setting was lost. The theme, also on
          this device, is changed from the header (batch 138) - and we say so,
          for whoever comes looking for it here where it used to live. */}
      <p className="-mt-3 text-sm text-textDim">
        Ce réglage reste sur cet appareil : il ne suit pas ton compte d'un navigateur à l'autre. Le thème clair ou
        sombre aussi, et il se change depuis l'en-tête, d'un clic sur le soleil ou la lune.
      </p>

      <section className="flex flex-col gap-2">
        <h3 className="font-display text-base font-semibold text-textPrimary">Titre des mangas</h3>
        {/* Says in three sentences what a six-line paragraph drowned under
            the names of the providers: what the setting changes, and how it is
            changed. */}
        <p className="text-sm text-textDim">
          La première langue cochée devient le titre enregistré ; les suivantes s'affichent entre parenthèses. Les
          flèches changent l'ordre. « Français » demande une recherche de plus aux sources, les deux autres non.
        </p>

        <ul className="mt-2 flex flex-col gap-2">
          {composition.map((item, index) => (
            <li
              key={item.language}
              draggable
              onDragStart={handleDragStart(index)}
              onDragOver={handleDragOver(index)}
              onDragEnd={() => setDraggedIndex(null)}
              className={`flex items-center gap-3 rounded-xl bg-surface py-1 pr-1.5 pl-3 text-sm text-textPrimary ${
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
              {/* The arrows, because HTML drag and drop does not exist with a
                  finger: on a phone, the order was impossible to change. */}
              <span className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => reorder(index, index - 1)}
                  disabled={index === 0}
                  aria-label={`Monter ${TITLE_LANGUAGE_LABELS[item.language]}`}
                  className="flex h-11 w-9 items-center justify-center rounded-lg text-textDim hover:text-textPrimary disabled:opacity-30"
                >
                  <ChevronUp size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => reorder(index, index + 1)}
                  disabled={index === composition.length - 1}
                  aria-label={`Descendre ${TITLE_LANGUAGE_LABELS[item.language]}`}
                  className="flex h-11 w-9 items-center justify-center rounded-lg text-textDim hover:text-textPrimary disabled:opacity-30"
                >
                  <ChevronDown size={18} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>

    </div>
  )
}

