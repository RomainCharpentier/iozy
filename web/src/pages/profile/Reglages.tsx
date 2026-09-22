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
 * Les réglages, rangés par <b>ce qu'ils concernent</b> - sur la page Profil,
 * en clair.
 *
 * <h2>Plus un écran, une section (lot 140)</h2>
 * Ils ont été l'écran « Paramètres », atteint depuis Profil par un lien : deux
 * écrans pour la même personne, et « ça doit être lisible direct ». Ce
 * composant rend les deux sections sous le partage, sur Profil même ; les
 * anciennes routes `/settings` y redirigent.
 *
 * <h2>Deux sections, et la frontière est réelle</h2>
 * <b>Mon compte</b> te suit partout : il vit sur le serveur, et l'export en
 * fait partie - télécharger sa collection n'est pas de la configuration
 * technique, c'est la garantie de pouvoir partir. <b>Cet appareil</b> ne suit
 * rien : la langue des titres vit dans le {@code localStorage} de ce
 * navigateur, et changer de machine la perd. La section le dit, parce que
 * personne ne peut le deviner.
 *
 * <p>Le thème clair ou sombre a vécu ici aussi, jusqu'au lot 138 : il se
 * change depuis l'en-tête, d'un clic sur le soleil ou la lune (voir
 * BoutonTheme). Un réglage qu'on change selon la lumière de la pièce n'a pas à
 * se trouver à trois clics.
 *
 * <p>Ce qui n'est ici NI l'un NI l'autre - les catégories de collection, les
 * éditions de référence, l'import, les comptes - concerne le <b>contenu</b> de
 * la collection ou l'<b>instance</b>, et vit dans Administration, un écran
 * SŒUR atteint depuis Profil. Pas depuis ici : il y a vécu jusqu'au
 * 2026-08-29, et régler son thème n'a rien à voir avec déclarer les catégories
 * de sa collection - l'un ne se trouve pas en cherchant l'autre.
 *
 * <h2>La langue des titres</h2>
 * Seule la recherche/ajout de manga (Jikan/MyAnimeList) est concernée, ni
 * Jikan ni MAL ne renvoyant de titre français nativement. Glisser-déposer
 * natif (HTML5 drag events, pas de librairie) : la première langue active
 * devient le titre sauvegardé, les suivantes actives suivent entre
 * parenthèses dans l'ordre choisi ici.
 */
export function Reglages({ appareilRef }: { appareilRef?: RefObject<HTMLDivElement | null> }) {
  // État local reflétant localStorage - setTitleComposition() persiste ET
  // notifie les autres consommateurs (QuickAddPage) via un événement custom,
  // voir lib/titleLanguage.ts.
  const [composition, setComposition] = useState<TitleComposition>(getTitleComposition)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const { compte } = useAuth()


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
      {compte && (
        // Nommée pour un lecteur d'écran (aria-labelledby) : sans nom
        // accessible, une <section> n'est pas un repère qu'on peut viser.
        <section aria-labelledby="section-mon-compte" className="flex flex-col gap-3">
          <h2 id="section-mon-compte" className="font-display text-lg font-semibold text-textPrimary">
            Mon compte
          </h2>

          <div className="flex flex-col gap-3 rounded-xl bg-surface p-4">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-textPrimary">{compte.pseudo}</span>
              {/* Le pseudo ne peut plus être l'adresse (voir AppUser) : les deux
                  lignes ne se répètent jamais. */}
              <span className="text-xs text-textDim">{compte.email}</span>
            </div>
          </div>

          {/* L'export vivait dans « Administration avancée », à côté des
              catégories de collection. Ce n'est pas de la configuration :
              c'est ce qui garantit qu'on peut partir avec ses données, et ça
              appartient au compte qui les possède. */}
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

          {/* Le retour du bloc précédent (Lot 115). Sans lui, « emporter »
              était un aller simple : changer de NAS ou repartir d'une
              sauvegarde n'était possible qu'en restaurant PostgreSQL entier. */}
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

      {/* Ancré : « Langue des titres » du Catalogue arrive ici, pas en haut
          d'un profil qu'il faudrait ensuite faire défiler. */}
      <div ref={appareilRef} className="scroll-mt-4">
        <h2 id="section-cet-appareil" className="font-display text-lg font-semibold text-textPrimary">
          Cet appareil
        </h2>
      </div>
      {/* Dit une fois : ce réglage vit dans le localStorage de ce navigateur,
          pas sur le compte. Sans cette phrase, quelqu'un qui ouvre l'app sur
          son téléphone croit à une perte de réglage. Le thème, lui aussi sur
          cet appareil, se change depuis l'en-tête (lot 138) - et on le dit,
          pour qui vient le chercher ici où il a vécu. */}
      <p className="-mt-3 text-sm text-textDim">
        Ce réglage reste sur cet appareil : il ne suit pas ton compte d'un navigateur à l'autre. Le thème clair ou
        sombre aussi, et il se change depuis l'en-tête, d'un clic sur le soleil ou la lune.
      </p>

      <section className="flex flex-col gap-2">
        <h3 className="font-display text-base font-semibold text-textPrimary">Titre des mangas</h3>
        {/* Dit en trois phrases ce qu'un paragraphe de six lignes noyait sous
            les noms des fournisseurs : ce que le réglage change, et comment on
            le change. */}
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
              {/* Les flèches, parce que le glisser-déposer HTML n'existe pas au
                  doigt : sur un téléphone, l'ordre était impossible à changer. */}
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

