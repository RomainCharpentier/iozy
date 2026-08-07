import { Check } from 'lucide-react'
import type { VolumeCandidateDto } from '../../types/api'

/** Clé stable identifiant un tome dans le Set de sélection - une même série
 * peut avoir plusieurs éditions avec chacune un tome numéro 1, la clé doit
 * donc combiner édition + numéro, jamais le numéro seul. */
export function volumeKey(v: Pick<VolumeCandidateDto, 'edition' | 'volumeNumber'>): string {
  return `${v.edition}|${v.volumeNumber}`
}

/**
 * Sélection visuelle des tomes possédés par jaquette (façon Mangacollec),
 * groupés par édition détectée (voir VolumeCandidate côté backend) - plutôt
 * que de saisir un numéro de tome à l'aveugle, on coche directement les
 * couvertures des tomes qu'on possède.
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

  return (
    <div className="flex flex-col gap-4">
      {editionsInOrder.map((edition) => (
        <div key={edition} className="flex flex-col gap-2">
          <p className="text-sm font-medium text-textPrimary">{edition}</p>
          <div className="flex flex-wrap gap-2">
            {byEdition.get(edition)!.map((volume) => {
              const key = volumeKey(volume)
              const isSelected = selectedKeys.has(key)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onToggle(key)}
                  aria-pressed={isSelected}
                  className={`relative h-24 w-16 shrink-0 overflow-hidden rounded-lg ring-2 transition ${
                    isSelected ? 'ring-accent' : 'ring-transparent'
                  }`}
                >
                  {volume.imageUrl ? (
                    <img src={volume.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-surface2 text-xs text-textDim">
                      T. {volume.volumeNumber}
                    </div>
                  )}
                  <span className="absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-center text-[10px] font-semibold text-white">
                    {volume.volumeNumber}
                  </span>
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
      ))}
    </div>
  )
}
