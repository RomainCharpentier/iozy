import type { ReactNode } from 'react'
import { Check, CheckCheck, Heart, Plus } from 'lucide-react'
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
  /** Ce tome est dans les envies. Exclusif de `possede` : vouloir et avoir
   *  sont deux etats du meme objet, jamais deux etats superposes. */
  voulu?: boolean
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
  onJeLAi,
  onJeLeVeux,
  filtre,
  onFiltre,
  enTete,
  action,
  videMessage,
}: {
  volumes: VolumeAffiche[]
  mode: 'navigation' | 'selection'
  onActiver: (cle: string) => void
  /** Les deux gestes d'un tome, en mode navigation. Absents en mode
   *  sélection, où cocher EST le geste. */
  onJeLAi?: (cle: string) => void
  onJeLeVeux?: (cle: string) => void
  filtre: FiltreVolumes
  onFiltre: (filtre: FiltreVolumes) => void
  /** Ce qui se dit à gauche des filtres, sur la MÊME ligne : l'édition
   *  regardée et son avancement. Deux lignes de titre au-dessus d'une rangée
   *  de filtres coûtaient une centaine de pixels avant la première jaquette,
   *  pour un rappel de ce que les cartes d'édition disent déjà juste
   *  au-dessus. */
  enTete?: ReactNode
  /** Une tuile d'action en fin de grille (« ajouter un tome »). */
  action?: { libelle: string; onClick: () => void }
  videMessage?: string
}) {
  // Sur `volumes` et non sur `visibles` : un compteur qui ne compterait que ce
  // qui est déjà à l'écran dirait toujours le total de la vue courante.
  const possedes = volumes.filter((volume) => volume.possede).length
  const comptes: Record<FiltreVolumes, number> = {
    tous: volumes.length,
    manquants: volumes.length - possedes,
    possedes,
  }

  const visibles = volumes.filter((volume) => {
    if (filtre === 'possedes') return volume.possede
    if (filtre === 'manquants') return !volume.possede
    return true
  })

  return (
    <div className="flex flex-col gap-3">
      {/* Une seule rangée : ce qu'on regarde à gauche, comment on le filtre à
          droite. Elle se replie d'elle-même quand la place manque. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {enTete}
        {/* Du TEXTE, pas des pastilles dans un conteneur : trois libellés
            séparés par des points, l'actif en encre pleine. Et chacun porte son
            nombre, si bien que la rangée informe au lieu de seulement occuper -
            on voit combien il manque sans avoir à cliquer.

            Un vrai groupe de boutons radio malgré l'apparence : trois vues qui
            s'excluent, ce que `aria-pressed` ne dirait pas - il annoncerait
            trois interrupteurs indépendants dont deux « inactifs ». */}
        <div
          role="radiogroup"
          aria-label="Filtrer les tomes"
          className="flex w-fit shrink-0 flex-wrap items-center"
        >
          {FILTRES.map(({ cle, libelle }, index) => {
            const actif = cle === filtre
            const compte = comptes[cle]
            return (
              <span key={cle} className="flex items-center">
                {index > 0 && (
                  <span aria-hidden="true" className="px-1 text-[12px] text-line select-none">
                    ·
                  </span>
                )}
                <button
                  type="button"
                  role="radio"
                  aria-checked={actif}
                  aria-label={`${libelle} : ${compte} tome${compte > 1 ? 's' : ''}`}
                  onClick={() => onFiltre(cle)}
                  className={`flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-[12.5px] whitespace-nowrap transition-colors ${
                    actif ? 'font-semibold text-textPrimary' : 'text-faint hover:text-textPrimary'
                  }`}
                >
                  {libelle}
                  <span className={`text-[11.5px] tabular-nums ${actif ? 'text-accentText' : 'text-faint'}`}>
                    {compte}
                  </span>
                </button>
              </span>
            )
          })}
        </div>
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
              onJeLAi={onJeLAi ? () => onJeLAi(volume.cle) : undefined}
              onJeLeVeux={onJeLeVeux ? () => onJeLeVeux(volume.cle) : undefined}
            />
          ))}
          {/* Le libellé est ÉCRIT, pas seulement dans un `title` : « ajouter »
              doit toujours dire où, et un « + » nu au bout d'une grille de tomes
              se confondait avec un ajout à la collection alors qu'il alimente le
              catalogue (étude produit du 2026-08-27, §11). */}
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="flex aspect-[2/3] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-lineStrong px-1.5 text-center text-[10px] leading-tight font-medium text-faint transition-colors hover:border-accent hover:bg-accentTint hover:text-accentText"
            >
              <Plus size={15} />
              {action.libelle}
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
  onJeLAi,
  onJeLeVeux,
}: {
  volume: VolumeAffiche
  mode: 'navigation' | 'selection'
  onActiver: () => void
  onJeLAi?: () => void
  onJeLeVeux?: () => void
}) {
  const selection = mode === 'selection'
  // En sélection, un tome déjà possédé n'est PAS atténué : le cocher reste
  // légitime (c'est un deuxième exemplaire), et le pâlir laisserait croire
  // qu'il est indisponible. En navigation au contraire, l'atténuation EST
  // l'information : c'est ce qui fait voir les trous d'une collection.
  // Un tome VOULU n'est pas atténué comme un manquant : la décision est prise,
  // et le pâlir le rendrait moins visible que ce qu'on n'a pas encore
  // tranché. Trois états, trois traitements.
  const attenue = !selection && !volume.possede && !volume.voulu

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
            : `Tome ${volume.numero}${
                volume.possede ? ', possédé' : volume.voulu ? ', dans mes envies' : ', manquant'
              }`
        }
        className={`relative flex aspect-[2/3] w-full items-center justify-center overflow-hidden rounded-lg bg-handle transition ${
          attenue ? 'opacity-[.42] grayscale-[1] contrast-[.92] ring-1 ring-line ring-inset' : 'shadow-token-sm'
        } ${volume.voulu && !selection ? 'ring-2 ring-accent ring-inset' : ''} ${
          volume.actif ? 'outline-2 outline-offset-2 outline-accent' : ''
        }`}
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
        {/* Le cœur DIT l'état, il ne le change pas : on en sort par le menu
            ci-dessous, où l'action est nommée. */}
        {!selection && volume.voulu && (
          <span
            title="Dans mes envies"
            className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accentInk shadow-token-sm"
          >
            <Heart size={11} className="fill-current" />
          </span>
        )}
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

      {/* Le menu du tome : les deux gestes possibles sur l'objet réellement
          concerné. Rien du tout sur un tome DÉJÀ POSSÉDÉ - vouloir ce qu'on a
          n'a pas de sens (le backend le refuse en 409), et l'avoir non plus.
          Le garde porte sur la nappe entière et pas seulement sur ses boutons :
          vide, elle couvrait quand même la tuile et avalait au survol le clic
          qui lui était destiné (trouvé en vérifiant en direct).

          Souris uniquement, et inertes hors survol : ces boutons ne doivent ni
          intercepter un clic destiné à la tuile, ni s'intercaler dans l'ordre
          de tabulation. Le clavier et le tactile passent par la tuile, qui
          ouvre le panneau du tome - où les mêmes actions sont nommées. */}
      {!selection && !volume.possede && (onJeLAi || onJeLeVeux) && (
        <div
          className={`pointer-events-none absolute inset-0 grid overflow-hidden rounded-lg opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 ${
            onJeLAi && onJeLeVeux ? 'grid-rows-2' : 'grid-rows-1'
          }`}
        >
          {onJeLAi && (
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={onJeLAi}
              title={`J'ai le tome ${volume.numero}`}
              className="flex items-center justify-center gap-1 bg-scrim text-[11px] font-medium text-white hover:bg-ok hover:text-background"
            >
              <Check size={13} strokeWidth={2.5} />
              Je l&apos;ai
            </button>
          )}
          {onJeLeVeux && (
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={onJeLeVeux}
              title={
                volume.voulu
                  ? `Retirer le tome ${volume.numero} de mes envies`
                  : `Je veux le tome ${volume.numero}`
              }
              className="flex items-center justify-center gap-1 border-t border-white/25 bg-scrim text-[11px] font-medium text-white hover:bg-accent hover:text-accentInk"
            >
              <Heart size={12} className={volume.voulu ? 'fill-current' : undefined} />
              {volume.voulu ? 'Retirer' : 'Je le veux'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
