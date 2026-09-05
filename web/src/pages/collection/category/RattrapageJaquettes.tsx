import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ImagePlus } from 'lucide-react'
import { mergeVariantAttributes } from '@/common/api/entities'
import { searchVolumes } from '@/common/api/metadata'
import { rattraperJaquettes, variantsMissingCover } from '@/common/lib/backfillCovers'
import { queryKeys } from '@/common/lib/queryKeys'
import type { EntityResponse } from '@/common/types/api'

/**
 * « Retrouver les jaquettes manquantes » : l'outil du rayon Manga.
 *
 * <h2>Pourquoi ici, et plus dans « Plus d'outils » de Ma collection</h2>
 * Il n'a jamais traité que les mangas - il interroge le fournisseur de tomes,
 * qui n'existe que pour eux - et il vivait dans le menu d'outils de la page
 * d'accueil, c'est-à-dire de TOUTE la collection. Ma collection appartient au
 * cœur : ce qui est propre à un univers se branche sur son rayon (lot 136).
 *
 * <p>Sur toute la collection possédée de ce type, jamais sur la liste
 * affichée : c'est un outil de maintenance, pas une action sur ce qui est
 * filtré. Séquentiel, jamais en parallèle - chaque série coûte potentiellement
 * un vrai appel Google Books, et un lot simultané viderait le quota d'un coup
 * au lieu de s'arrêter proprement dessus. Le travail d'UNE série vit dans
 * `rattraperJaquettes`, partagé avec la fiche.
 */
export function RattrapageJaquettes({
  oeuvresPossedees,
  mangaTypeId,
}: {
  /** Les mangas possédés de ce compte - possédés, parce qu'on ne complète pas la jaquette d'une envie. */
  oeuvresPossedees: EntityResponse[]
  mangaTypeId: string
}) {
  const queryClient = useQueryClient()
  const aTraiter = useMemo(
    () => oeuvresPossedees.filter((e) => variantsMissingCover(e).length > 0),
    [oeuvresPossedees],
  )
  const [etat, setEtat] = useState<{
    running: boolean
    processed: number
    total: number
    found: number
    fournisseurMuet: boolean
  } | null>(null)

  async function lancer() {
    if (aTraiter.length === 0) return
    setEtat({ running: true, processed: 0, total: aTraiter.length, found: 0, fournisseurMuet: false })
    let found = 0
    let fournisseurMuet = false
    for (let i = 0; i < aTraiter.length; i++) {
      const resultat = await rattraperJaquettes(aTraiter[i], mangaTypeId, searchVolumes, (entityId, variantId, url) =>
        mergeVariantAttributes(entityId, variantId, { coverImageUrl: url }),
      )
      found += resultat.trouvees
      if (resultat.fournisseurMuet) {
        fournisseurMuet = true
        break
      }
      setEtat({ running: true, processed: i + 1, total: aTraiter.length, found, fournisseurMuet })
    }
    setEtat({ running: false, processed: aTraiter.length, total: aTraiter.length, found, fournisseurMuet })
    queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={lancer}
        disabled={aTraiter.length === 0 || etat?.running}
        className="flex min-h-11 w-fit items-center gap-2 rounded-xl border border-fieldBorder px-3.5 text-sm font-semibold text-textDim transition-colors hover:bg-rowHover disabled:opacity-40"
      >
        <ImagePlus size={15} />
        {etat?.running ? `Jaquettes… ${etat.processed}/${etat.total}` : 'Retrouver les jaquettes manquantes'}
        {!etat?.running && aTraiter.length > 0 && <span className="text-xs font-normal">{aTraiter.length}</span>}
      </button>
      {etat && !etat.running && (
        <p className="text-xs text-textDim">
          {etat.found > 0
            ? `${etat.found} jaquette${etat.found > 1 ? 's' : ''} retrouvée${etat.found > 1 ? 's' : ''}.`
            : 'Aucune jaquette retrouvée cette fois.'}
          {etat.fournisseurMuet &&
            ` Le fournisseur n'a pas répondu - ${etat.processed}/${etat.total} séries traitées, réessaie plus tard pour les autres.`}
        </p>
      )}
    </div>
  )
}
