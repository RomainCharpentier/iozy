import { coverImageUrlFrom } from '../../lib/coverImage'
import { GrilleVolumes, type FiltreVolumes, type VolumeAffiche } from '../../components/GrilleVolumes'
import type { TomeTile } from '../../lib/tomeTiles'

export type { FiltreVolumes as FiltreTomes }

/**
 * « Mes tomes » sur la fiche : l'en-tête de l'édition affichée, puis la
 * grille commune en mode navigation (voir components/GrilleVolumes).
 *
 * <h2>Ce que fait cet adaptateur, et rien de plus</h2>
 * Il traduit des `TomeTile` - la forme du catalogue, avec ses trois états
 * (possédé, catalogué manquant, purement déduit) - vers les `VolumeAffiche`
 * que la grille comprend. C'est tout : la mise en forme, les filtres, les
 * mesures et les actions au survol vivent dans le composant commun, partagé
 * avec l'écran d'ajout.
 *
 * <p>La distinction « catalogué manquant » / « purement déduit » ne survit
 * pas à la traduction, et c'est voulu : elle ne change rien à ce qu'on VOIT
 * (les deux sont des trous dans la collection). Elle continue d'exister là où
 * elle compte, au moment d'agir sur le tome - un tome catalogué se rattache,
 * un tome déduit doit d'abord être créé (voir VolumeInteractionPanel).
 */
export function GrilleTomes({
  titre,
  resume,
  filtre,
  onFiltre,
  tuiles,
  tomeActif,
  onChoisirTome,
  tomesVoulus,
  onBasculerEnvie,
  modeEdition,
  onAjouterTome,
}: {
  titre: string
  resume: string
  filtre: FiltreVolumes
  onFiltre: (filtre: FiltreVolumes) => void
  tuiles: TomeTile[]
  tomeActif: number | null
  onChoisirTome: (numero: number) => void
  /** Les identifiants des tomes de cette œuvre qui sont dans les envies. */
  tomesVoulus: Set<string>
  onBasculerEnvie: (numero: number) => void
  modeEdition: boolean
  onAjouterTome: () => void
}) {
  // La clé est le numéro : une grille de fiche ne montre qu'UNE édition à la
  // fois, donc le numéro y est déjà unique (contrairement à l'écran d'ajout,
  // qui mélange les éditions - voir lib/volumeKey).
  const volumes: VolumeAffiche[] = tuiles.map((tuile) => ({
    cle: String(tuile.volumeNumber),
    numero: tuile.volumeNumber,
    jaquetteUrl: tuile.variant ? coverImageUrlFrom(tuile.variant.attributes) : null,
    possede: tuile.status === 'owned',
    // Un tome purement déduit n'a pas d'identité, donc rien à quoi rattacher
    // une envie : il ne peut pas être voulu tant qu'il n'est pas catalogué -
    // ce que « Je le veux » déclenche justement (voir TomeResolver).
    voulu: !!tuile.variant && tomesVoulus.has(tuile.variant.id),
    actif: tuile.volumeNumber === tomeActif,
  }))

  return (
    <section className="flex flex-col gap-3.5 pt-7">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-display text-[17px] font-medium tracking-[-0.02em] text-textPrimary">{titre}</h2>
        <p className="text-[13px] text-faint">{resume}</p>
      </div>

      <GrilleVolumes
        volumes={volumes}
        mode="navigation"
        filtre={filtre}
        onFiltre={onFiltre}
        onActiver={(cle) => onChoisirTome(Number(cle))}
        // « Je l'ai » ouvre le panneau du tome : posséder a des détails (état,
        // prix, exemplaires passés) que vouloir n'a pas. « Je le veux », lui,
        // n'a rien à demander et agit sur place.
        onJeLAi={(cle) => onChoisirTome(Number(cle))}
        onJeLeVeux={(cle) => onBasculerEnvie(Number(cle))}
        action={modeEdition ? { libelle: 'Ajouter un tome', onClick: onAjouterTome } : undefined}
      />
    </section>
  )
}
