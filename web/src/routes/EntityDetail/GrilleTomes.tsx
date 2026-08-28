import { coverImageUrlFrom } from '../../lib/coverImage'
import { GrilleVolumes, type FiltreVolumes, type VolumeAffiche } from '../../components/GrilleVolumes'
import type { TomeTile } from '../../lib/tomeTiles'

export type { FiltreVolumes as FiltreTomes }

/**
 * « Mes tomes » sur la fiche : la grille commune en mode navigation (voir
 * components/GrilleVolumes), précédée du nom de l'édition regardée quand il y
 * en a plusieurs.
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
 * un tome déduit doit d'abord être créé (voir AddVolumeSection).
 */
export function GrilleTomes({
  titre,
  plusieursEditions,
  filtre,
  onFiltre,
  tuiles,
  onChoisirTome,
  onJeLAi,
  tomesVoulus,
  onBasculerEnvie,
  modeEdition,
  onAjouterTome,
}: {
  titre: string
  /** Vrai quand l'œuvre a plus d'une édition. C'est la seule situation où il
   *  faut redire laquelle cette grille montre : avec une seule édition, sa
   *  carte juste au-dessus l'a déjà dit, et la répéter ne fait qu'éloigner la
   *  première jaquette. */
  plusieursEditions: boolean
  filtre: FiltreVolumes
  onFiltre: (filtre: FiltreVolumes) => void
  tuiles: TomeTile[]
  onChoisirTome: (numero: number) => void
  /** « Je l'ai » - ajoute le tome en un clic. */
  onJeLAi: (numero: number) => void
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
    // Plus rien ne s'ouvre au clic : aucun tome n'est « actif ».
    actif: false,
  }))

  return (
    <section className="pt-5">
      <GrilleVolumes
        enTete={
          // Le NOM seul, et seulement s'il y a un choix. L'avancement vivait
          // ici aussi ; il est déjà sur la carte de l'édition, jauge comprise.
          plusieursEditions ? (
            <h2 className="min-w-0 truncate font-display text-[14px] font-medium tracking-[-0.01em] text-textPrimary">
              {titre}
            </h2>
          ) : undefined
        }
        volumes={volumes}
        mode="navigation"
        filtre={filtre}
        onFiltre={onFiltre}
        onActiver={(cle) => onChoisirTome(Number(cle))}
        // Les deux gestes agissent désormais sur place : depuis que l'ajout ne
        // demande plus ni état ni prix, « Je l'ai » n'a pas plus à ouvrir un
        // panneau que « Je le veux ».
        onJeLAi={(cle) => onJeLAi(Number(cle))}
        onJeLeVeux={(cle) => onBasculerEnvie(Number(cle))}
        action={modeEdition ? { libelle: 'Ajouter un tome', onClick: onAjouterTome } : undefined}
      />
    </section>
  )
}
