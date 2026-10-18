import { useQueries, useQuery } from '@tanstack/react-query'
import { listEntityTypes } from '@/common/api/entityTypes'
import { searchVolumes } from '@/common/api/metadata'
import { queryKeys } from '@/common/lib/queryKeys'
import type { EditionOptionDto } from '@/common/types/listingRecognition'

/** The only choice left when no source knows an edition of the series. */
export const EDITION_PAR_DEFAUT = 'Édition standard'

/** What the editions of a series depend on. */
export interface SerieAEditions {
  cle: string
  titre: string
  catalogStatus: string
  editionOptions: EditionOptionDto[]
  editionLue: string | null
}

export interface ChoixPossibles {
  /** The names to pick from, in order: catalog, read on the photo, found by the sources. */
  proposees: string[]
  /** The sources are being asked: the list may still grow. */
  enRecherche: boolean
  /** The pick when there is exactly one choice and the list is complete; otherwise nothing. */
  parDefaut: string
}

/** "Édition Originale" and "Édition originale" are one edition: compared without case, accents or extra spaces. */
function cleDeNom(nom: string): string {
  return nom.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** The first spelling of each name is kept, in order. */
function distincts(noms: string[]): string[] {
  const vus = new Map<string, string>()
  for (const nom of noms) {
    if (nom.trim() !== '' && !vus.has(cleDeNom(nom))) vus.set(cleDeNom(nom), nom.trim())
  }
  return [...vus.values()]
}

/**
 * The editions to pick from for each series that is not plainly matched to the
 * catalog: the ones of the catalog and the ones the sources know - the names carried
 * by the volumes of the Catalog search, same endpoint and cache key as the detail page,
 * so a series already looked at costs nothing - or, failing both, the one read on the
 * photo.
 *
 * <p>Only the `courante` series is searched, and only when `actif`: the one-by-one
 * check asks for the series it is on, at the pace of the user. Every new series at
 * once would fire one search each, and the BnF blocks an IP after a few dozen
 * requests. The others show what is already in the cache. A source that stays silent
 * is not an error: the list is just empty, and the only choice is
 * {@link EDITION_PAR_DEFAUT}.
 */
export function useEditionsDesSeries({
  series,
  courante,
  actif,
}: {
  series: SerieAEditions[]
  courante: string | undefined
  actif: boolean
}): (serie: SerieAEditions) => ChoixPossibles {
  const types = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes, enabled: actif })
  const typeMangaId = types.data?.find((t) => t.code === 'MANGA')?.id ?? ''
  const aChercher = series.filter((serie) => serie.catalogStatus !== 'MATCHED')
  const recherches = useQueries({
    queries: aChercher.map((serie) => ({
      queryKey: queryKeys.tomesProposes(typeMangaId, serie.titre),
      queryFn: () => searchVolumes(typeMangaId, serie.titre),
      enabled: actif && serie.cle === courante && typeMangaId !== '' && serie.titre.trim() !== '',
      retry: false,
    })),
  })

  return (serie) => {
    const recherche = recherches[aChercher.findIndex((s) => s.cle === serie.cle)]
    const trouvees = (recherche?.data?.volumes ?? []).map((v) => v.edition)
    const enRecherche =
      actif && serie.cle === courante && (types.isPending || recherche?.fetchStatus === 'fetching')
    // What the catalog and the sources know comes first. The mention read on the photo only
    // fills in when they know nothing: a spine often shows the PUBLISHER ("Glénat"), which the
    // reader returns as an edition, and it would then sit beside the real edition of the same series.
    const reconnues = distincts([...serie.editionOptions.map((option) => option.editionName), ...trouvees])
    const connues = reconnues.length > 0 ? reconnues : distincts(serie.editionLue ? [serie.editionLue] : [])
    const proposees = connues.length > 0 || enRecherche ? connues : [EDITION_PAR_DEFAUT]
    return { proposees, enRecherche, parDefaut: !enRecherche && proposees.length === 1 ? proposees[0] : '' }
  }
}
