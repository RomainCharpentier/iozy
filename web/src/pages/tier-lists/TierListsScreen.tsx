import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ListOrdered, Plus } from 'lucide-react'
import { getEntityTypeVisual } from '@/common/lib/entityTypeVisuals'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { CreateTierListModal } from './CreateTierListModal'
import { TierBadge } from '@/common/components/TierBadge'
import { boardPreviewRows } from '@/common/lib/tierListVisuals'
import { TexteCoupe } from '@/common/components/TexteCoupe'
import { Jaquette } from '@/common/components/Jaquette'
import { EnTeteSection } from '@/common/components/EnTeteSection'
import { EtatVide } from '@/common/components/EtatVide'
import { useDonneesTierLists } from '@/common/hooks/useDonneesTierLists'
import { Squelette } from '@/common/components/Squelette'

/**
 * Écran "Tier Lists" à part entière - "deuxième grande expérience, à côté
 * de la collection" (voir DS v1.1, commentaire source ligne ~1100), atteint
 * depuis Découvrir (aperçu compact, voir DiscoverTierPreview) ou depuis la
 * fiche d'une œuvre ("Toutes mes Tier Lists", voir TomesGridSection). Un
 * classement général par univers réellement possédé + les Tier Lists
 * personnalisées de chaque univers + un point d'entrée de création par
 * univers. Les Tier Lists TRANSVERSES "toutes catégories" (scope 'all' de la
 * maquette, Lot 14) forment leur propre famille en fin d'écran plutôt que
 * d'apparaître sous chaque univers : elles n'appartiennent à aucun, les
 * répéter partout les afficherait autant de fois qu'il y a de types.
 * Univers sans aucune œuvre possédée ET sans aucune Tier List perso masqué
 * (même principe que groupByEntityType côté Ma collection - jamais une
 * section vide) ; la famille transverse suit la même règle, absente tant
 * qu'aucune liste de ce genre n'existe.
 */
export function TierListsScreen() {
  const navigate = useNavigate()
  // null dans le state = modal fermée ; { id: null } = modal ouverte sur
  // "Toutes catégories" - deux "null" de sens différents, d'où l'objet.
  const [creatingFor, setCreatingFor] = useState<{ id: string | null } | null>(null)

  const donnees = useDonneesTierLists()

  // Pas de retour anticipé : l'écran garde son titre pendant qu'il charge.
  // Le remplacer entièrement par « Chargement... » lui faisait perdre son h1,
  // donc AUSSI le titre de son onglet (voir useDocumentTitle, qui lit le h1) -
  // l'onglet retombait sur « IozyCore » - et son seul repère de structure pour
  // un lecteur d'écran. Statistiques et Envies gardent déjà le leur : c'est
  // cette forme-là qui est majoritaire dans l'application.
  const chargement = donnees.chargement

  const sections = donnees.univers
    .map((u) => ({ entityType: u.entityType, board: u.board, counts: u.counts, lists: u.listes }))
    .filter((s) => s.counts.total > 0 || s.lists.length > 0)

  const crossUniverseLists = donnees.listesTransverses

  return (
    <div className="flex flex-col gap-5">
      <button type="button" onClick={() => navigate('/discover')} className="flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold text-textDim">
        <ArrowLeft size={15} />
        Découvrir
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <EnTeteSection
          niveau={1}
          titre="Tier Lists"
          className="flex-1"
          action={
            sections.length > 0 && (
              <button
                type="button"
                onClick={() => setCreatingFor({ id: sections[0].entityType.id })}
                className="btn-primaire"
              >
                <Plus size={16} />
                Nouvelle Tier List
              </button>
            )
          }
        />
      </div>

      {donnees.erreur && <ErrorBanner message={donnees.erreur} />}
      {chargement && <Squelette lignes={3} />}

      {/* `!chargement` en garde : sans lui, l'état vide clignoterait à chaque
          ouverture, le temps que les données arrivent - « Rien à classer »
          affiché à quelqu'un qui a justement des choses à classer. */}
      {!chargement && sections.length === 0 && (
        <EtatVide
          icone={ListOrdered}
          titre="Rien à classer pour l'instant"
          detail="Ajoute des œuvres à ta collection pour commencer à les classer."
        />
      )}

      {sections.map(({ entityType, board, counts, lists }) => {
        const visual = getEntityTypeVisual(entityType)
        const preview = boardPreviewRows(board)
        return (
          <div key={entityType.id} className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="h-[11px] w-[11px] shrink-0 rounded-full" style={{ background: visual.color }} />
                <h2 className="font-display text-base font-semibold text-textPrimary">{entityType.label}</h2>
              </div>
              <button
                type="button"
                onClick={() => setCreatingFor({ id: entityType.id })}
                className="inline-flex min-h-11 items-center text-xs font-semibold text-accentText"
              >
                + Nouvelle liste
              </button>
            </div>

            {counts.total > 0 && (
              <Link
                to={`/tier-lists/general/${entityType.id}`}
                className="flex flex-col gap-3 rounded-2xl border border-surface2 bg-surface p-4 shadow-token-sm transition-transform hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-2.5">
                  <ListOrdered size={16} className="text-textDim" />
                  <span className="text-sm font-semibold text-textPrimary">Classement général</span>
                </div>
                {preview.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {preview.map((row) => (
                      <div key={row.rank} className="flex items-center gap-2">
                        <TierBadge rank={row.rank} size="compact" />
                        <div className="flex gap-1">
                          {row.covers.map((cover, i) => (
                            <Jaquette
                              key={i}
                              src={cover}
                              className="h-8 w-6 shrink-0 rounded object-cover"
                              repli={<span className="h-8 w-6 shrink-0 rounded bg-surface2" />}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-textDim">Rien de classé pour l'instant.</p>
                )}
                <p className="text-xs text-textDim">
                  {counts.ranked} classé{counts.ranked > 1 ? 's' : ''} · {counts.total - counts.ranked} à classer
                </p>
              </Link>
            )}

            {lists.length > 0 && (
              <div className="flex flex-col gap-2 rounded-2xl border border-surface2 bg-surface p-2 shadow-token-sm">
                {lists.map((list) => (
                  <Link
                    key={list.id}
                    to={`/tier-lists/${list.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl p-2.5 transition-colors hover:bg-rowHover"
                  >
                    <TexteCoupe texte={list.name} className="truncate text-sm font-semibold text-textPrimary" />
                    <span className="shrink-0 text-xs text-textDim">
                      {list.rankedCount}/{list.itemCount}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {(crossUniverseLists.length > 0 || sections.length > 0) && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="h-[11px] w-[11px] shrink-0 rounded-full bg-lineStrong" />
              <h2 className="font-display text-base font-semibold text-textPrimary">Toutes catégories</h2>
            </div>
            <button type="button" onClick={() => setCreatingFor({ id: null })} className="inline-flex min-h-11 items-center text-xs font-semibold text-accentText">
              + Nouvelle liste
            </button>
          </div>

          {crossUniverseLists.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-surface2 bg-surface p-2 shadow-token-sm">
              {crossUniverseLists.map((list) => (
                <Link
                  key={list.id}
                  to={`/tier-lists/${list.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl p-2.5 transition-colors hover:bg-rowHover"
                >
                  <TexteCoupe texte={list.name} className="truncate text-sm font-semibold text-textPrimary" />
                  <span className="shrink-0 text-xs text-textDim">
                    {list.rankedCount}/{list.itemCount}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-xs text-textDim">
              Une Tier List qui mélange les univers — comparer un manga et un jeu dans le même classement.
            </p>
          )}
        </div>
      )}

      {creatingFor && <CreateTierListModal entityTypeId={creatingFor.id} onClose={() => setCreatingFor(null)} />}
    </div>
  )
}
