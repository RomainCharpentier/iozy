import { Check, CheckCheck, Eye, Heart, Plus } from 'lucide-react'
import { Jaquette } from './Jaquette'

/**
 * Un tome tel qu'une grille l'affiche, quelle que soit sa provenance.
 *
 * <h2>Le point de rencontre de deux modèles</h2>
 * La fiche part de `TomeTile` (un Variant catalogué, une Ownership, une
 * complétude) ; l'ajout part de `VolumeCandidateDto` (un résultat de
 * recherche externe, pas encore en base). Ces deux formes n'ont pas les mêmes
 * champs et n'ont pas à en avoir : ce qu'une GRILLE a besoin de savoir d'un
 * tome, c'est son numéro, sa jaquette, s'il est déjà possédé, et s'il est
 * mis en avant. Chaque écran traduit sa propre donnée vers ceci.
 */
export interface VolumeAffiche {
  /** Identité stable dans la grille. Une série peut avoir un tome 1 par
   *  édition : c'est à l'appelant de composer une clé qui en tient compte
   *  (voir lib/volumeKey). */
  cle: string
  numero: number
  jaquetteUrl: string | null
  /** Une Ownership active existe pour ce tome. Vrai dans les deux écrans - et
   *  c'est justement ce qui rend la grille commune possible. */
  possede: boolean
  /** Mis en avant : le tome dont le panneau est ouvert (navigation), ou le
   *  tome coché (sélection). Deux sens, un seul état visuel. */
  actif: boolean
}

export type FiltreVolumes = 'tous' | 'manquants' | 'possedes'

const FILTRES: { cle: FiltreVolumes; libelle: string }[] = [
  { cle: 'tous', libelle: 'Tous' },
  { cle: 'manquants', libelle: 'Manquants' },
  { cle: 'possedes', libelle: 'Possédés' },
]

/**
 * La grille de tomes de l'application - une seule, deux modes.
 *
 * <h2>Pourquoi un composant commun, alors que les gestes diffèrent</h2>
 * `navigation` (fiche) ouvre le tome cliqué ; `selection` (ajout) le coche, et
 * plusieurs peuvent l'être. Ce sont deux gestes, mais **une seule chose
 * regardée** : la liste des tomes d'une édition, avec ce que j'en possède
 * déjà. Avant, chaque écran redessinait sa propre tuile - ratios différents
 * (78px auto-fill contre 64×96 fixe), replis différents, badges différents -
 * si bien qu'un tome ne se ressemblait pas d'un écran à l'autre alors que
 * c'est le même objet.
 *
 * <p>Le mode ne fait varier que trois choses, toutes visibles ici : la
 * sémantique ARIA du bouton, le badge de coin, et la présence des actions au
 * survol. Tout le reste - mesures, repli numéroté, filtres, atténuation d'un
 * manquant - est commun, et c'est ce qui garantit que les deux écrans ne
 * peuvent plus diverger.
 */
export function GrilleVolumes({
  volumes,
  mode,
  onActiver,
  onEnvies,
  filtre,
  onFiltre,
  action,
  videMessage,
}: {
  volumes: VolumeAffiche[]
  mode: 'navigation' | 'selection'
  onActiver: (cle: string) => void
  /** Le cœur au survol - navigation seulement, et seulement si l'écran a
   *  quelque chose à en faire. */
  onEnvies?: (cle: string) => void
  filtre: FiltreVolumes
  onFiltre: (filtre: FiltreVolumes) => void
  /** Une tuile d'action en fin de grille (« ajouter un tome »). */
  action?: { libelle: string; onClick: () => void }
  videMessage?: string
}) {
  const visibles = volumes.filter((volume) => {
    if (filtre === 'possedes') return volume.possede
    if (filtre === 'manquants') return !volume.possede
    return true
  })

  return (
    <div className="flex flex-col gap-3.5">
      {/* Un vrai groupe de boutons radio : trois vues qui s'excluent, ce que
          `aria-pressed` ne dirait pas - il annoncerait trois interrupteurs
          indépendants dont deux « inactifs ». */}
      <div
        role="radiogroup"
        aria-label="Filtrer les tomes"
        className="flex w-fit items-center gap-1.5 rounded-full bg-softBtn p-1"
      >
        {FILTRES.map(({ cle, libelle }) => {
          const actif = cle === filtre
          return (
            <button
              key={cle}
              type="button"
              role="radio"
              aria-checked={actif}
              onClick={() => onFiltre(cle)}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] whitespace-nowrap transition-colors ${
                actif ? 'bg-surface font-medium text-textPrimary shadow-token-sm' : 'text-faint hover:text-textPrimary'
              }`}
            >
              {libelle}
            </button>
          )
        })}
      </div>

      {visibles.length === 0 ? (
        <p className="py-6 text-sm text-faint">
          {videMessage ??
            (filtre === 'possedes'
              ? "Aucun tome de cette édition dans ta collection pour l'instant."
              : 'Aucun tome manquant — cette édition est complète.')}
        </p>
      ) : (
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(78px,1fr))]">
          {visibles.map((volume) => (
            <TuileVolume
              key={volume.cle}
              volume={volume}
              mode={mode}
              onActiver={() => onActiver(volume.cle)}
              onEnvies={onEnvies ? () => onEnvies(volume.cle) : undefined}
            />
          ))}
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              title={action.libelle}
              aria-label={action.libelle}
              className="flex aspect-[2/3] items-center justify-center rounded-lg border border-dashed border-lineStrong text-faint transition-colors hover:border-accent hover:bg-accentTint hover:text-accentText"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function TuileVolume({
  volume,
  mode,
  onActiver,
  onEnvies,
}: {
  volume: VolumeAffiche
  mode: 'navigation' | 'selection'
  onActiver: () => void
  onEnvies?: () => void
}) {
  const selection = mode === 'selection'
  // En sélection, un tome déjà possédé n'est PAS atténué : le cocher reste
  // légitime (c'est un deuxième exemplaire), et le pâlir laisserait croire
  // qu'il est indisponible. En navigation au contraire, l'atténuation EST
  // l'information : c'est ce qui fait voir les trous d'une collection.
  const attenue = !selection && !volume.possede

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onActiver}
        // Deux sémantiques : un interrupteur en sélection (l'état compte et
        // doit être annoncé), un simple bouton en navigation (il mène ailleurs).
        aria-pressed={selection ? volume.actif : undefined}
        aria-label={
          selection
            ? `Tome ${volume.numero}${volume.possede ? ', déjà possédé' : ''}`
            : `${volume.possede ? 'Voir' : 'Ajouter'} le tome ${volume.numero}`
        }
        className={`relative flex aspect-[2/3] w-full items-center justify-center overflow-hidden rounded-lg bg-handle transition ${
          attenue ? 'opacity-[.42] grayscale-[1] contrast-[.92] ring-1 ring-line ring-inset' : 'shadow-token-sm'
        } ${volume.actif ? 'outline-2 outline-offset-2 outline-accent' : ''}`}
      >
        <Jaquette src={volume.jaquetteUrl} repli={null} className="absolute inset-0 h-full w-full object-cover" />
        {/* Le numéro reste dans l'arbre même sous une jaquette : c'est lui qui
            porte l'information, et sans jaquette c'est tout ce qu'il y a. */}
        <span
          className={`relative font-display text-[17px] font-medium tracking-[0.01em] ${
            volume.jaquetteUrl ? 'sr-only' : 'text-white/90'
          }`}
        >
          {String(volume.numero).padStart(2, '0')}
        </span>

        {/* « Déjà possédé » et « coché » sont deux informations distinctes qui
            coexistent : re-cocher un tome possédé signale un 2e exemplaire.
            D'où deux coins différents, jamais un seul badge à double sens. */}
        {selection && volume.possede && (
          <span
            title="Déjà possédé"
            className="absolute top-1 left-1 flex h-4 w-4 items-center justify-center rounded-full bg-ok text-background"
          >
            <CheckCheck size={10} strokeWidth={3} />
          </span>
        )}
        {selection && volume.actif && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accentInk">
            <Check size={10} strokeWidth={3} />
          </span>
        )}
      </button>

      {/* Souris uniquement, et inertes tant que le survol n'a pas lieu : ces
          boutons ne doivent ni intercepter un clic destiné à la tuile, ni
          s'intercaler dans l'ordre de tabulation - le clavier passe par la
          tuile, qui mène au même endroit. */}
      {!selection && onEnvies && (
        <div className="pointer-events-none absolute inset-0 grid grid-rows-2 overflow-hidden rounded-lg opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={onEnvies}
            title={`Ajouter le tome ${volume.numero} à mes envies`}
            className="flex items-center justify-center bg-scrim text-white hover:bg-accent"
          >
            <Heart size={18} />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={onActiver}
            title={`Voir le tome ${volume.numero}`}
            className="flex items-center justify-center border-t border-white/25 bg-scrim text-white hover:bg-accent"
          >
            <Eye size={18} />
          </button>
        </div>
      )}
    </div>
  )
}
