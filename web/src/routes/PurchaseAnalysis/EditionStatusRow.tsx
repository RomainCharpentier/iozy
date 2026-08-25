import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchEditionsForSeries } from '../../api/purchaseAnalysis'
import { EditionPicker, EDITION_INCONNUE } from './EditionPicker'

/**
 * L'édition, présentée comme un **résultat** et non comme une question.
 *
 * <h2>Le changement</h2>
 * Le formulaire demandait « Édition » avec pour seul guide « ex: Perfect
 * Edition », entre la série et les tomes, sur le chemin critique. C'était la
 * seule étape du produit où l'on obligeait l'utilisateur à savoir quelque
 * chose que le catalogue sait souvent mieux que lui - et à inventer sinon.
 *
 * L'ordre s'inverse : on saisit la série et les tomes, puis IozyCore cherche
 * l'édition et affiche ce qu'il a trouvé. Trois états, tous exploitables :
 *
 * <ul>
 *   <li><b>résolue</b> - une seule édition connue pour cette série, retenue,
 *       modifiable d'un clic ;</li>
 *   <li><b>à confirmer</b> - plusieurs candidates, proposées sans qu'aucune ne
 *       soit choisie d'office ;</li>
 *   <li><b>non déterminée</b> - rien au catalogue. L'analyse reste possible :
 *       le moteur dégrade honnêtement (complétude inconnue, valeur neuve
 *       indisponible) plutôt que de bloquer.</li>
 * </ul>
 *
 * Dans aucun de ces cas l'édition n'empêche d'évaluer le lot.
 */
export function EditionStatusRow({
  seriesTitle,
  value,
  onChange,
}: {
  seriesTitle: string
  /** Vide = pas encore tranchée ; l'analyse la traitera comme inconnue. */
  value: string
  onChange: (editionName: string) => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const serie = seriesTitle.trim()

  const editionsQuery = useQuery({
    queryKey: ['purchase-analysis', 'editions', 'search', serie.toLowerCase()],
    queryFn: () => searchEditionsForSeries(serie),
    enabled: serie.length >= 3,
    staleTime: 5 * 60 * 1000,
  })

  /**
   * Mémorisé, et pas seulement pour faire taire le linter : `?? []` fabrique
   * un tableau NEUF à chaque rendu tant que la requête n'a pas répondu, si
   * bien que l'effet ci-dessous se réexécutait à chaque rendu. Il en sortait
   * aussitôt - une liste vide n'a jamais une seule édition - donc rien ne
   * cassait, mais la dépendance mentait sur ce qui la fait changer.
   */
  const connues = useMemo(() => editionsQuery.data ?? [], [editionsQuery.data])

  /**
   * Une édition unique au catalogue est adoptée pour de bon, pas seulement
   * affichée.
   *
   * Sans cela, l'écran annonçait « Édition · Black Édition » pendant que le lot
   * enregistrait « Édition inconnue » : l'affichage déduisait l'édition unique
   * localement sans jamais la remonter. Promettre une chose et en analyser une
   * autre est pire que de ne rien proposer.
   */
  useEffect(() => {
    if (value.trim()) return
    if (connues.length !== 1) return
    onChange(connues[0].editionName)
  }, [value, connues, onChange])

  if (serie.length < 3) return null

  if (ouvert) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-textDim">Édition</span>
        <EditionPicker
          seriesTitle={serie}
          value={value}
          onChange={(nom) => {
            onChange(nom)
            setOuvert(false)
          }}
          ariaLabel={`Édition de ${serie}`}
        />
      </div>
    )
  }

  if (editionsQuery.isPending) {
    return <p className="text-xs text-textDim">Recherche de l'édition…</p>
  }

  // Choix explicite de l'utilisateur, ou édition unique du catalogue : on
  // affiche ce qui sera utilisé, pas une question.
  const retenue = value.trim()

  if (retenue && retenue !== EDITION_INCONNUE) {
    return (
      <LigneEtat
        libelle="Édition"
        valeur={retenue}
        action="Modifier"
        onAction={() => setOuvert(true)}
      />
    )
  }

  if (retenue === EDITION_INCONNUE) {
    return (
      <LigneEtat
        libelle="Édition"
        valeur="non déterminée"
        detail="L'analyse fonctionnera, sans la complétude ni la valeur neuve."
        action="Préciser"
        onAction={() => setOuvert(true)}
      />
    )
  }

  if (connues.length > 1) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-textDim">Édition à confirmer</span>
        <div className="flex flex-wrap gap-1.5">
          {connues.map((edition) => (
            <button
              key={edition.id}
              type="button"
              onClick={() => onChange(edition.editionName)}
              className="min-h-11 rounded-lg bg-surface2 px-3 text-xs font-medium text-textPrimary"
            >
              {edition.editionName}
              {edition.totalVolumes !== null && (
                <span className="ml-1 opacity-70">· {edition.totalVolumes} tomes</span>
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChange(EDITION_INCONNUE)}
            className="min-h-11 rounded-lg bg-surface2 px-3 text-xs font-medium text-textDim"
          >
            Je ne sais pas
          </button>
        </div>
      </div>
    )
  }

  // Rien au catalogue : on le dit, et on n'en fait pas un obstacle.
  return (
    <LigneEtat
      libelle="Édition"
      valeur="non déterminée"
      detail="Aucune édition connue pour cette série. L'analyse reste possible."
      action="Préciser"
      onAction={() => setOuvert(true)}
    />
  )
}

function LigneEtat({
  libelle,
  valeur,
  detail,
  action,
  onAction,
}: {
  libelle: string
  valeur: string
  detail?: string
  action: string
  onAction: () => void
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-textDim">
          {libelle} · <span className="font-medium text-textPrimary">{valeur}</span>
        </span>
        <button
          type="button"
          onClick={onAction}
          className="min-h-11 rounded-lg px-2 text-xs font-semibold text-accent underline underline-offset-2"
        >
          {action}
        </button>
      </div>
      {detail && <span className="text-xs text-textDim">{detail}</span>}
    </div>
  )
}
