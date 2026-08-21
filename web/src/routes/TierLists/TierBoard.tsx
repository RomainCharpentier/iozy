import { useState } from 'react'
import { TierBadge } from './TierBadge'
import { RANKS, type Rank, type TierListEntryDto } from '../../types/tierList'

/**
 * Board de classement, présentation pure - partagé entre le classement
 * général et une Tier List personnalisée (même rendu, seule la source des
 * données et les mutations diffèrent, voir GeneralTierBoardPage/
 * CustomTierBoardPage). Interaction principale : clic sur une jaquette ->
 * TierPicker (voir le parent).
 * <p>
 * Le glisser-déposer (DS v1.1 §47) vient EN PLUS depuis le Lot 14, jamais à
 * la place : il n'est disponible qu'à la souris (l'API HTML5 de drag &
 * drop ignore le tactile), et le §47 exige justement qu'il ne soit jamais
 * la seule façon de classer. Le clic et le clavier (Tab + Entrée sur la
 * jaquette, puis S-F dans le sélecteur) restent donc intacts et suffisent à
 * tout faire.
 */
export function TierBoard({
  ranked,
  unranked,
  activeRanks,
  onSelectEntry,
  onDropEntry,
}: {
  ranked: Partial<Record<Rank, TierListEntryDto[]>>
  unranked: TierListEntryDto[]
  activeRanks: Rank[]
  onSelectEntry: (entry: TierListEntryDto) => void
  /** Absent = board en lecture seule pour le glisser-déposer (le clic reste
   * actif). `null` en rang = ramené vers "À classer". */
  onDropEntry?: (entry: TierListEntryDto, rank: Rank | null) => void
}) {
  // Entrée en cours de déplacement : gardée ici plutôt que lue depuis
  // dataTransfer, qui n'est pas lisible pendant dragover (spec HTML) - or
  // c'est pendant dragover qu'on décide de surligner la zone.
  const [draggedEntry, setDraggedEntry] = useState<TierListEntryDto | null>(null)
  const [hoveredZone, setHoveredZone] = useState<Rank | 'unranked' | null>(null)

  const dragEnabled = onDropEntry !== undefined

  const dropHandlers = (zone: Rank | 'unranked') =>
    dragEnabled
      ? {
          onDragOver: (e: React.DragEvent) => {
            e.preventDefault()
            setHoveredZone(zone)
          },
          onDragLeave: () => setHoveredZone((current) => (current === zone ? null : current)),
          onDrop: (e: React.DragEvent) => {
            e.preventDefault()
            setHoveredZone(null)
            const entry = draggedEntry
            setDraggedEntry(null)
            // Déposer une œuvre là où elle est déjà : ne rien envoyer plutôt
            // que de re-jouer la même mutation pour un résultat identique.
            if (!entry) return
            const target = zone === 'unranked' ? null : zone
            if (entry.rank === target) return
            onDropEntry?.(entry, target)
          },
        }
      : {}

  const tileHandlers = (entry: TierListEntryDto) =>
    dragEnabled
      ? {
          draggable: true,
          onDragStart: (e: React.DragEvent) => {
            setDraggedEntry(entry)
            // Un dataTransfer non vide est requis par Firefox pour que le
            // glissement démarre - la valeur elle-même n'est jamais relue.
            e.dataTransfer.setData('text/plain', entry.entityId)
            e.dataTransfer.effectAllowed = 'move'
          },
          onDragEnd: () => {
            setDraggedEntry(null)
            setHoveredZone(null)
          },
        }
      : {}

  return (
    <div className="flex flex-col gap-2">
      {RANKS.filter((r) => activeRanks.includes(r)).map((rank) => {
        const entries = ranked[rank] ?? []
        return (
          <div
            key={rank}
            {...dropHandlers(rank)}
            className={`flex items-stretch gap-3 rounded-2xl border bg-surface p-2.5 transition-colors ${
              hoveredZone === rank ? 'border-accent bg-accentTint' : 'border-surface2'
            }`}
          >
            <div className="flex w-[52px] shrink-0 items-center justify-center sm:w-[58px]">
              <TierBadge rank={rank} />
            </div>
            <div className="flex min-h-[64px] flex-1 flex-wrap items-center gap-2 py-1">
              {entries.length === 0 && (
                <span className="px-2 text-xs text-textDim">
                  {hoveredZone === rank ? 'Déposer ici' : "Rien ici pour l'instant"}
                </span>
              )}
              {entries.map((entry) => (
                <button
                  key={entry.entityId}
                  type="button"
                  onClick={() => onSelectEntry(entry)}
                  // Le rang fait partie du nom : il se lit visuellement dans la
                  // ligne (voir TierBadge à gauche), mais rien ne l'associe à la
                  // tuile pour qui ne voit pas la mise en page. Sans aria-label,
                  // une tuile à jaquette n'avait pour tout nom que son `title`,
                  // dernier recours de l'algorithme accname (voir Lot 29) - la
                  // tuile SANS jaquette, elle, portait déjà son titre en texte.
                  aria-label={`${entry.title}, rang ${rank}`}
                  title={entry.title}
                  {...tileHandlers(entry)}
                  className={`aspect-[2/3] w-11 shrink-0 overflow-hidden rounded-lg transition-transform hover:-translate-y-1 focus-visible:-translate-y-1 sm:w-12 ${
                    draggedEntry?.entityId === entry.entityId ? 'opacity-40' : ''
                  }`}
                >
                  {entry.coverImageUrl ? (
                    <img src={entry.coverImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-surface2 px-0.5 text-center text-[10px] text-textDim">
                      {entry.title}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )
      })}

      {/* "À classer" est aussi une zone de dépôt : c'est le seul moyen de
          DÉ-classer au glisser-déposer, sinon le geste ne serait
          réversible qu'au clic. Affichée dès qu'un glissement est en cours,
          même vide, sinon il n'y aurait nulle part où viser. */}
      {(unranked.length > 0 || draggedEntry) && (
        <div
          {...dropHandlers('unranked')}
          className={`mt-3 flex flex-col gap-2 rounded-2xl border p-2.5 transition-colors ${
            hoveredZone === 'unranked' ? 'border-accent bg-accentTint' : 'border-transparent'
          }`}
        >
          <span className="text-xs font-semibold tracking-wide text-textDim uppercase">
            À classer ({unranked.length})
          </span>
          <div className="flex min-h-[40px] flex-wrap gap-2">
            {unranked.length === 0 && <span className="px-1 text-xs text-textDim">Déposer ici pour déclasser</span>}
            {unranked.map((entry) => (
              <button
                key={entry.entityId}
                type="button"
                onClick={() => onSelectEntry(entry)}
                aria-label={`${entry.title}, non classée`}
                title={entry.title}
                {...tileHandlers(entry)}
                className={`aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-lg ring-1 ring-dashed ring-lineStrong transition-transform hover:-translate-y-1 focus-visible:-translate-y-1 sm:w-16 ${
                  draggedEntry?.entityId === entry.entityId ? 'opacity-40' : ''
                }`}
              >
                {entry.coverImageUrl ? (
                  <img src={entry.coverImageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-surface2 px-0.5 text-center text-[10px] text-textDim">
                    {entry.title}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
