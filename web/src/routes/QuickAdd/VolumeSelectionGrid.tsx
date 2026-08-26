import { useState } from 'react'
import { Chip } from '../../components/Chip'
import { GrilleVolumes, type FiltreVolumes, type VolumeAffiche } from '../../components/GrilleVolumes'
import type { VolumeCandidateDto } from '../../types/api'
import { volumeKey } from '../../lib/volumeKey'

/**
 * Sélection des tomes possédés à l'ajout : le choix de l'édition, puis la
 * grille commune en mode sélection (voir components/GrilleVolumes).
 *
 * <h2>Ce que fait cet adaptateur</h2>
 * Il groupe les candidats par édition - une série peut en avoir plusieurs,
 * chacune avec ses propres tomes et jaquettes (« Édition originale » et
 * « Perfect Edition » pour Dragon Ball) - et traduit ceux de l'édition
 * affichée vers les `VolumeAffiche` que la grille comprend. La sélection est
 * conservée en changeant d'édition (elle est portée par le parent, voir
 * `selectedKeys`) : on peut cocher des tomes dans plusieurs éditions avant de
 * valider.
 *
 * <h2>Ce qui a été mis en commun avec la fiche</h2>
 * Toute la tuile. Cet écran dessinait ses propres vignettes de 64×96 en
 * `flex-wrap`, quand la fiche en dessinait de ratio 2/3 en `auto-fill` : le
 * MÊME tome ne se ressemblait pas d'un écran à l'autre. Les gestes, eux,
 * restent bien distincts - ici on coche, là-bas on ouvre - et c'est le `mode`
 * de la grille qui porte cette différence, elle seule.
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
  const [filtre, setFiltre] = useState<FiltreVolumes>('tous')
  // L'édition active peut disparaître si une nouvelle recherche remplace
  // `volumes` (nouveau candidat choisi) sans que ce composant soit démonté -
  // on retombe alors sur la première édition disponible plutôt que sur un
  // onglet qui n'existe plus.
  const resolvedActiveEdition = byEdition.has(activeEdition) ? activeEdition : editionsInOrder[0]
  const activeVolumes = byEdition.get(resolvedActiveEdition) ?? []

  if (editionsInOrder.length === 0) return null

  const affiches: VolumeAffiche[] = activeVolumes.map((volume) => ({
    // La clé combine édition ET numéro : deux éditions ont chacune leur
    // tome 1 (voir lib/volumeKey), et c'est elle que le parent stocke.
    cle: volumeKey(volume),
    numero: volume.volumeNumber,
    jaquetteUrl: volume.imageUrl,
    possede: volume.alreadyOwned,
    actif: selectedKeys.has(volumeKey(volume)),
  }))

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

      <GrilleVolumes
        volumes={affiches}
        mode="selection"
        filtre={filtre}
        onFiltre={setFiltre}
        onActiver={onToggle}
        videMessage={
          filtre === 'possedes'
            ? 'Aucun tome de cette édition ne figure déjà dans ta collection.'
            : 'Tu possèdes déjà tous les tomes trouvés pour cette édition.'
        }
      />
    </div>
  )
}
