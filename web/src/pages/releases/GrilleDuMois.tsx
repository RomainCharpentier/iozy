import { Jaquette } from '@/common/components/Jaquette'
import { JOURS_DE_LA_SEMAINE_COURTS, libelleJour, libelleMois } from '@/common/lib/releaseDate'
import type { ReleaseEntryDto } from '@/common/types/api'
import { cleDeSortie, grilleDuMois, type CaseDuMois } from './releaseCalendar'

/** Au-delà, la case écrit « +n » plutôt que d'empiler : elle fait 49 px de large sur un téléphone. */
const JAQUETTES_PAR_CASE = 2

const CLASSE_CASE = 'flex min-h-14 w-full flex-col gap-1 rounded-lg p-1 sm:min-h-20'

/**
 * Le mois en grille, lundi en tête (lot 146) : chaque jour à sa place,
 * aujourd'hui marqué, les jours des mois voisins grisés pour compléter la
 * semaine. Un jour qui a des sorties montre leurs jaquettes et se choisit :
 * l'agenda dessous ne montre alors que lui.
 *
 * <p>Un tableau, pas une grille ARIA : les colonnes sont les jours de la
 * semaine et les lignes des semaines - c'est exactement ce qu'un tableau dit
 * à un lecteur d'écran, sans réinventer la navigation au clavier. Seuls les
 * jours qui ont quelque chose sont des boutons : un jour vide n'a rien à
 * ouvrir, en faire une cible n'apprendrait rien.
 */
export function GrilleDuMois({
  mois,
  parJour,
  jourChoisi,
  onChoisir,
  aujourdHui,
}: {
  /** « 2026-10 » */
  mois: string
  /** Les sorties datées au jour, par jour ISO - déjà filtrées par catégorie. */
  parJour: Map<string, ReleaseEntryDto[]>
  jourChoisi: string | null
  /** `null` pour revenir au mois entier. */
  onChoisir: (iso: string | null) => void
  /** « 2026-10-14 », la date locale de l'appareil. */
  aujourdHui: string
}) {
  return (
    <table className="w-full table-fixed border-separate border-spacing-0.5" aria-label={`Grille de ${libelleMois(mois).toLowerCase()}`}>
      <thead>
        <tr>
          {JOURS_DE_LA_SEMAINE_COURTS.map((jour) => (
            <th key={jour} scope="col" className="pb-1 text-center text-[11px] font-semibold tracking-wide text-textDim uppercase">
              {jour}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {grilleDuMois(mois).map((semaine) => (
          <tr key={semaine[0]?.iso}>
            {semaine.map((c) => (
              <td key={c.iso} className="p-0 align-top">
                <Case
                  c={c}
                  entries={c.horsMois ? [] : (parJour.get(c.iso) ?? [])}
                  choisi={c.iso === jourChoisi}
                  estAujourdHui={c.iso === aujourdHui}
                  onChoisir={onChoisir}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Case({
  c,
  entries,
  choisi,
  estAujourdHui,
  onChoisir,
}: {
  c: CaseDuMois
  entries: ReleaseEntryDto[]
  choisi: boolean
  estAujourdHui: boolean
  onChoisir: (iso: string | null) => void
}) {
  const numero = (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
        estAujourdHui ? 'bg-accent text-accentInk' : ''
      }`}
    >
      {c.jour}
    </span>
  )

  if (c.horsMois) {
    return (
      <div className={`${CLASSE_CASE} text-faint`} aria-hidden="true">
        {numero}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className={`${CLASSE_CASE} text-textDim`} aria-current={estAujourdHui ? 'date' : undefined}>
        {numero}
      </div>
    )
  }

  const nb = entries.length
  return (
    <button
      type="button"
      onClick={() => onChoisir(choisi ? null : c.iso)}
      aria-pressed={choisi}
      aria-current={estAujourdHui ? 'date' : undefined}
      aria-label={`${libelleJour(c.iso)}, ${nb} ${nb > 1 ? 'sorties' : 'sortie'}`}
      className={`${CLASSE_CASE} border text-left text-textPrimary transition-colors ${
        choisi ? 'border-accent bg-accentTint' : 'border-surface2 bg-surface hover:bg-surface2'
      }`}
    >
      {numero}
      <span className="flex items-end gap-0.5" aria-hidden="true">
        {entries.slice(0, JAQUETTES_PAR_CASE).map((entry) => (
          <Jaquette
            key={cleDeSortie(entry)}
            src={entry.coverImageUrl}
            className="h-6 w-4 rounded-[3px] object-cover sm:h-8 sm:w-[22px]"
            repli={<span className="h-6 w-4 rounded-[3px] bg-surface2 sm:h-8 sm:w-[22px]" />}
          />
        ))}
        {nb > JAQUETTES_PAR_CASE && <span className="text-[10px] font-semibold text-textDim">+{nb - JAQUETTES_PAR_CASE}</span>}
      </span>
    </button>
  )
}
