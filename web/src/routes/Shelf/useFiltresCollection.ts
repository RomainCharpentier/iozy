import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listTags } from '../../api/tags'
import { queryKeys } from '../../lib/queryKeys'
import type { CompletionFilter } from './CollectionFilters'
import type { EntityResponse, TagDto } from '../../types/api'

// Référence stable : `?? []` fabriquerait un tableau neuf à chaque rendu, et
// les mémoïsations qui en dépendent se recalculeraient pour rien.
const AUCUN_TAG: TagDto[] = []

/**
 * Les filtres de la collection, en un seul endroit.
 *
 * <h2>Deux écrans, les mêmes filtres</h2>
 * Ma collection et la vue d'une catégorie déclaraient chacun leur `status`,
 * leur panneau, leur pastille de décompte et leur bouton « Réinitialiser » -
 * une dizaine de lignes en double, et deux occasions de diverger dès qu'un
 * filtre s'ajoute. Même raison d'être que {@link useDonneesCollection}, un
 * étage plus haut : les données y sont partagées, les filtres ici.
 *
 * <h2>Le filtre par tag, et pourquoi il arrive maintenant</h2>
 * On pouvait créer un tag et l'attacher à une œuvre depuis sa fiche, mais
 * <b>aucun écran ne s'en servait ensuite</b> : le classement se posait et ne
 * se relisait jamais. Le paramètre existait pourtant de bout en bout - jusque
 * dans `searchEntities` et les clés de cache - sans un seul appelant.
 *
 * <p>Le tri se fait <b>en mémoire</b> plutôt qu'en repassant `tagId` au
 * serveur : ces écrans tiennent déjà toute la collection, `tagIds` est dans
 * chaque œuvre, et une requête qui redemanderait un sous-ensemble de ce qu'on
 * a sous la main serait strictement plus lente. Même parti pris que le filtre
 * d'état, qui se calcule ici depuis le premier jour.
 *
 * <p><b>Un seul tag à la fois</b>, comme le paramètre du serveur : une
 * sélection multiple obligerait à trancher entre « au moins un » et « tous »,
 * et à le faire comprendre dans un panneau de quatre lignes. Ça se décide,
 * ça ne se glisse pas dans un lot.
 */
export function useFiltresCollection() {
  const [ouverts, setOuverts] = useState(false)
  const [status, setStatus] = useState<CompletionFilter>('ALL')
  const [tagId, setTagId] = useState<string | null>(null)

  const tagsQuery = useQuery({ queryKey: queryKeys.tags.all, queryFn: listTags })
  const tags = tagsQuery.data ?? AUCUN_TAG

  /** Combien de filtres portent réellement quelque chose - la pastille du bouton. */
  const nombreActifs = (status === 'ALL' ? 0 : 1) + (tagId === null ? 0 : 1)

  /** Le seul critère que ce hook sait appliquer seul : l'état de la collection
   *  dépend de la progression, que chaque écran a déjà sous la main. */
  const porteLeTag = useCallback(
    (oeuvre: EntityResponse) => tagId === null || oeuvre.tagIds.includes(tagId),
    [tagId],
  )

  const reinitialiser = useCallback(() => {
    setStatus('ALL')
    setTagId(null)
  }, [])

  return useMemo(
    () => ({
      ouverts,
      ouvrir: () => setOuverts(true),
      fermer: () => setOuverts(false),
      status,
      definirStatus: setStatus,
      tags,
      tagId,
      definirTag: setTagId,
      nombreActifs,
      porteLeTag,
      reinitialiser,
    }),
    [ouverts, status, tags, tagId, nombreActifs, porteLeTag, reinitialiser],
  )
}
