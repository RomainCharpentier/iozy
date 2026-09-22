import { useNavigate } from 'react-router-dom'
import { ChevronRight, Sparkles } from 'lucide-react'
import { getEntityTypeVisual } from '@/common/lib/entityTypeVisuals'
import { boardPreviewRows } from '@/common/lib/tierListVisuals'
import { TierBadge } from '@/common/components/TierBadge'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { TexteCoupe } from '@/common/components/TexteCoupe'
import { Jaquette } from '@/common/components/Jaquette'
import { CLASSE_CARTE } from '@/common/components/Carte'
import { useDonneesTierLists } from '@/common/hooks/useDonneesTierLists'
import { Squelette } from '@/common/components/Squelette'

const MAX_UNIVERSE_PREVIEWS = 2
const MAX_CUSTOM_PREVIEWS = 3

/**
 * Panneau "Tier Lists" de Découvrir (voir DS v1.1 §44) - APERÇU compact,
 * pas l'écran complet (voir TierListsScreen sur /tier-lists) : au plus 2
 * univers, au plus 3 Tier Lists perso, chaque carte ouvre directement un
 * board. Une "porte d'entrée" vers Découvrir, pas une redite du hub.
 */
export function DiscoverTierPreview() {
  const navigate = useNavigate()
  const donnees = useDonneesTierLists()

  if (donnees.erreur) return <ErrorBanner message={donnees.erreur} />
  if (donnees.chargement) return <Squelette lignes={3} />

  const universes = donnees.univers.filter((u) => u.counts.total > 0)

  const previewedUniverses = universes.slice(0, MAX_UNIVERSE_PREVIEWS)

  // Les listes transverses "toutes catégories" (Lot 14) comptent comme les
  // autres dans cet aperçu : elles n'appartiennent à aucun univers, mais
  // elles restent des Tier Lists perso de l'utilisateur.
  const allCustomLists = donnees.toutesLesListes
  const previewedCustom = allCustomLists.slice(0, MAX_CUSTOM_PREVIEWS)

  const totalUnranked = universes.reduce((sum, u) => sum + (u.counts.total - u.counts.ranked), 0)
  // "Classer mes éléments" ouvre le board général qui a le plus d'attente,
  // et y démarre le classement rapide (Lot 14, voir useQuickRank). Toujours
  // UN seul univers, jamais un enchaînement multi-univers : le classement
  // général est par nature rattaché à un univers (voir DS v1.1 §45).
  const busiestUniverse = [...universes].sort((a, b) => b.counts.total - b.counts.ranked - (a.counts.total - a.counts.ranked))[0]

  if (universes.length === 0 && allCustomLists.length === 0) {
    return (
      <div className={`${CLASSE_CARTE} text-center`}>
        <p className="font-display text-base font-semibold text-textPrimary">Rien à classer pour l'instant</p>
        <p className="mt-1.5 text-sm text-textDim">Ajoute des œuvres à ta collection pour commencer à les classer.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* grid-cols-1 n'est pas décoratif. Sans lui, la grille n'a aucune
          colonne déclarée sous 640px : la piste implicite se dimensionne alors
          sur le CONTENU, et le titre en `truncate` (donc nowrap) lui impose sa
          largeur entière au lieu d'être coupé. Un type nommé un peu longuement
          poussait la carte à 706px dans une fenêtre de 375 et faisait défiler
          toute la page horizontalement. `grid-cols-1` vaut
          repeat(1, minmax(0, 1fr)) : la piste ne peut plus dépasser. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {previewedUniverses.map(({ entityType, board, counts }) => {
          const visual = getEntityTypeVisual(entityType)
          const preview = boardPreviewRows(board, 3, 4)
          return (
            <button
              key={entityType.id}
              type="button"
              onClick={() => navigate(`/tier-lists/general/${entityType.id}`, { state: { retour: { to: '/discover', libelle: 'Découvrir' } } })}
              className="flex flex-col gap-3 rounded-2xl border border-surface2 bg-surface p-4 text-left shadow-token-sm transition-transform hover:-translate-y-0.5"
            >
              <span className="flex items-center gap-2.5">
                <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[10px]" style={{ background: visual.tint }}>
                  <visual.icon size={16} style={{ color: visual.color }} />
                </span>
                <TexteCoupe texte={entityType.label} className="min-w-0 flex-1 truncate text-[15px] font-semibold text-textPrimary" />
                <ChevronRight size={16} className="shrink-0 text-textDim" />
              </span>
              {preview.length > 0 ? (
                <span className="flex flex-col gap-1.5">
                  {preview.map((row) => (
                    <span key={row.rank} className="flex items-center gap-1.5">
                      <TierBadge rank={row.rank} size="compact" />
                      <span className="flex gap-1">
                        {row.covers.map((cover, i) => (
                          <Jaquette
                            key={i}
                            src={cover}
                            className="h-[22px] w-4 shrink-0 rounded object-cover"
                            repli={<span className="h-[22px] w-4 shrink-0 rounded bg-surface2" />}
                          />
                        ))}
                      </span>
                    </span>
                  ))}
                </span>
              ) : (
                <span className="text-xs text-textDim">Rien de classé pour l'instant.</span>
              )}
              <span className="text-xs text-textDim">
                {counts.ranked} classé{counts.ranked > 1 ? 's' : ''} · {counts.total - counts.ranked} à classer
              </span>
            </button>
          )
        })}
      </div>

      {previewedCustom.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previewedCustom.map((list) => (
            <button
              key={list.id}
              type="button"
              onClick={() => navigate(`/tier-lists/${list.id}`, { state: { retour: { to: '/discover', libelle: 'Découvrir' } } })}
              className="flex min-w-[210px] flex-1 items-center gap-2.5 rounded-2xl border border-surface2 bg-surface px-3.5 py-2.5 text-left transition-transform hover:-translate-y-0.5"
            >
              <TexteCoupe texte={list.name} className="min-w-0 flex-1 truncate text-sm font-semibold text-textPrimary" />
              <span className="shrink-0 text-xs text-textDim">
                {list.rankedCount}/{list.itemCount}
              </span>
            </button>
          ))}
        </div>
      )}

      {totalUnranked > 0 && busiestUniverse && (
        <button
          type="button"
          // Demande explicitement le classement RAPIDE, pas juste l'ouverture
          // du board (voir GeneralTierBoardPage, state.quickRank) : "Classer
          // mes éléments" promet d'enchaîner, pas de rouvrir le sélecteur
          // œuvre par œuvre à la main.
          onClick={() => navigate(`/tier-lists/general/${busiestUniverse.entityType.id}`, { state: { quickRank: true, ...({ retour: { to: '/discover', libelle: 'Découvrir' } }) } })}
          className="flex w-full items-center gap-3 rounded-2xl bg-accentTint p-3.5 text-left transition-transform hover:-translate-y-0.5"
        >
          <Sparkles size={18} className="shrink-0 text-accentText" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-textPrimary">Classer mes éléments</span>
            <span className="block text-xs text-textDim">
              {totalUnranked} œuvre{totalUnranked > 1 ? 's' : ''} en attente d'un rang.
            </span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-accentText" />
        </button>
      )}
    </div>
  )
}
