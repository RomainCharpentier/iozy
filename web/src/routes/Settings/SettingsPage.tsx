import { useState, type DragEvent } from 'react'
import { Download, GripVertical, LogOut, Moon, Sun } from 'lucide-react'
import { useAuth } from '../../lib/useAuth'
import {
  TITLE_LANGUAGE_LABELS,
  getTitleComposition,
  setTitleComposition,
  type TitleComposition,
} from '../../lib/titleLanguage'
import { useTheme } from '../../lib/theme'
import { EnTeteSection } from '../../components/EnTeteSection'

/**
 * Les réglages, rangés par <b>ce qu'ils concernent</b>.
 *
 * <h2>Deux sections, et la frontière est réelle</h2>
 * <b>Mon compte</b> te suit partout : il vit sur le serveur, et l'export en
 * fait partie - télécharger sa collection n'est pas de la configuration
 * technique, c'est la garantie de pouvoir partir. <b>Cet appareil</b> ne suit
 * rien : le thème et la langue des titres vivent dans le {@code localStorage}
 * de ce navigateur, et changer de machine les perd. La section le dit, parce
 * que personne ne peut le deviner.
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
export function SettingsPage() {
  // État local reflétant localStorage - setTitleComposition() persiste ET
  // notifie les autres consommateurs (QuickAddPage) via un événement custom,
  // voir lib/titleLanguage.ts.
  const [composition, setComposition] = useState<TitleComposition>(getTitleComposition)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const { theme, toggleTheme } = useTheme()
  const { compte, deconnexion } = useAuth()

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
      <EnTeteSection niveau={1} titre="Paramètres" />

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
            <button
              type="button"
              onClick={() => deconnexion.mutate()}
              disabled={deconnexion.isPending}
              className="flex items-center justify-center gap-2 self-start rounded-lg bg-surface2 px-4 py-2 text-sm font-medium text-textPrimary disabled:opacity-50"
            >
              <LogOut size={16} />
              Se déconnecter
            </button>
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
            <div className="mt-1 flex gap-2">
              <a
                href="/api/export/json"
                download
                className="rounded-lg bg-surface2 px-3 py-2 text-sm font-medium text-textPrimary hover:bg-surface"
              >
                Télécharger en JSON
              </a>
              <a
                href="/api/export/csv"
                download
                className="rounded-lg bg-surface2 px-3 py-2 text-sm font-medium text-textPrimary hover:bg-surface"
              >
                Télécharger en CSV (.zip)
              </a>
            </div>
          </div>
        </section>
      )}

      <h2 id="section-cet-appareil" className="font-display text-lg font-semibold text-textPrimary">
        Cet appareil
      </h2>
      {/* Dit une fois, pour les deux réglages qui suivent : ils vivent dans le
          localStorage de ce navigateur, pas sur le compte. Sans cette phrase,
          quelqu'un qui ouvre l'app sur son téléphone croit à une perte de
          réglage. */}
      <p className="-mt-3 text-sm text-textDim">
        Ces deux réglages restent sur cet appareil : ils ne suivent pas ton compte d'un navigateur à l'autre.
      </p>

      {/* Pattern switch identique à celui de la maquette (role="switch" +
          aria-checked, jamais un simple bouton texte pour un état à deux
          valeurs). */}
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
        <h3 className="font-display text-base font-semibold text-textPrimary">Titre des mangas</h3>
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

    </div>
  )
}
