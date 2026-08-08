import { useState } from 'react'
import { Check, CheckCheck } from 'lucide-react'
import { Chip } from '../../components/Chip'
import type { VolumeCandidateDto } from '../../types/api'

/** Clé stable identifiant un tome dans le Set de sélection - une même série
 * peut avoir plusieurs éditions avec chacune un tome numéro 1, la clé doit
 * donc combiner édition + numéro, jamais le numéro seul. */
export function volumeKey(v: Pick<VolumeCandidateDto, 'edition' | 'volumeNumber'>): string {
  return `${v.edition}|${v.volumeNumber}`
}

/**
 * Sélection visuelle des tomes possédés par jaquette (façon Mangacollec) :
 * on choisit d'abord l'édition (une série peut en avoir plusieurs - ex:
 * "Édition originale" et "Perfect Edition" pour Dragon Ball, chacune avec
 * ses propres tomes/jaquettes), puis on coche les tomes possédés dans la
 * grille de cette édition. La sélection est conservée en changeant d'édition
 * (voir selectedKeys, géré par le parent) - possible de cocher des tomes
 * dans plusieurs éditions avant de valider.
 */
export function VolumeSelectionGrid({
  volumes,
  selectedKeys,
  onToggle,
}: {
  volumes: VolumeCandidateDto[]
  selectedKeys: Set<string>
  onToggle: (key: string) => void
}) {
  const editionsInOrder: string[] = []
  const byEdition = new Map<string, VolumeCandidateDto[]>()
  for (const volume of volumes) {
    if (!byEdition.has(volume.edition)) {
      editionsInOrder.push(volume.edition)
      byEdition.set(volume.edition, [])
    }
    byEdition.get(volume.edition)!.push(volume)
  }

  const [activeEdition, setActiveEdition] = useState(editionsInOrder[0])
  // L'édition active peut disparaître si une nouvelle recherche remplace
  // `volumes` (nouveau candidat choisi) sans que ce composant soit démonté -
  // on retombe alors sur la première édition disponible plutôt que sur un
  // onglet qui n'existe plus.
  const resolvedActiveEdition = byEdition.has(activeEdition) ? activeEdition : editionsInOrder[0]
  const activeVolumes = byEdition.get(resolvedActiveEdition) ?? []

  if (editionsInOrder.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      {editionsInOrder.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {editionsInOrder.map((edition) => {
            const countSelected = byEdition.get(edition)!.filter((v) => selectedKeys.has(volumeKey(v))).length
            return (
              <Chip
                key={edition}
                label={countSelected > 0 ? `${edition} (${countSelected})` : edition}
                isActive={edition === resolvedActiveEdition}
                onClick={() => setActiveEdition(edition)}
              />
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {activeVolumes.map((volume) => {
          const key = volumeKey(volume)
          const isSelected = selectedKeys.has(key)
          return (
            <button
              key={key}
              type="button"
              onClick={() => onToggle(key)}
              aria-pressed={isSelected}
              title={volume.alreadyOwned ? 'Déjà possédé' : undefined}
              className={`relative h-24 w-16 shrink-0 overflow-hidden rounded-lg ring-2 transition ${
                isSelected ? 'ring-accent' : 'ring-transparent'
              }`}
            >
              {volume.imageUrl ? (
                <img
                  src={volume.imageUrl}
                  alt=""
                  className={`h-full w-full object-cover ${volume.alreadyOwned ? 'opacity-60' : ''}`}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-surface2 text-xs text-textDim">
                  T. {volume.volumeNumber}
                </div>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-center text-[10px] font-semibold text-white">
                {volume.volumeNumber}
              </span>
              {/* Déjà possédé (vert, coin gauche) et sélectionné (accent, coin
                  droit) sont deux informations distinctes qui peuvent
                  coexister (re-sélectionner un tome déjà possédé signale un
                  2e exemplaire, voir formatAddResultMessage). */}
              {volume.alreadyOwned && (
                <span className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <CheckCheck size={10} strokeWidth={3} />
                </span>
              )}
              {isSelected && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accentText">
                  <Check size={10} strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
