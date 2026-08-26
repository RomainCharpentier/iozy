import { Eye, Heart, Plus } from 'lucide-react'
import { coverImageUrlFrom } from '../../lib/coverImage'
import { Jaquette } from '../../components/Jaquette'
import type { TomeTile } from '../../lib/tomeTiles'

export type FiltreTomes = 'tous' | 'manquants' | 'possedes'

const FILTRES: { cle: FiltreTomes; libelle: string }[] = [
  { cle: 'tous', libelle: 'Tous' },
  { cle: 'manquants', libelle: 'Manquants' },
  { cle: 'possedes', libelle: 'Possédés' },
]

/**
 * La grille de tomes de la maquette « multi-éditions » : dense, numérotée,
 * une tuile par tome de l'édition affichée.
 *
 * <h2>Dense à dessein</h2>
 * Des pistes de 78px au lieu de 110px, et plus de légende sous chaque tuile.
 * La maquette montre Naruto : soixante-douze tomes. À l'échelle précédente
 * ils occupaient six rangées et deux écrans de défilement ; ici la série
 * entière tient d'un coup d'œil, ce qui est précisément la question qu'on se
 * pose devant une collection (« où sont les trous ? »). L'état ne se lit plus
 * à une légende mais au CONTRASTE : un tome possédé est net, un tome manquant
 * est désaturé et pâle - à comparer, c'est plus rapide que soixante-douze
 * fois le mot « Manquant ».
 *
 * <h2>Les actions au survol</h2>
 * Deux moitiés (envies / détails) apparaissent sur la tuile survolée, comme
 * dans la maquette. Elles n'existent QUE pour la souris : la tuile entière
 * reste un bouton qui ouvre le détail, donc le clavier et le tactile
 * atteignent la même chose sans dépendre d'un survol.
 */
export function GrilleTomes({
  titre,
  resume,
  filtre,
  onFiltre,
  tuiles,
  tomeActif,
  onChoisirTome,
  onAjouterAuxEnvies,
  modeEdition,
  onAjouterTome,
}: {
  titre: string
  resume: string
  filtre: FiltreTomes
  onFiltre: (filtre: FiltreTomes) => void
  tuiles: TomeTile[]
  tomeActif: number | null
  onChoisirTome: (numero: number) => void
  onAjouterAuxEnvies: (numero: number) => void
  modeEdition: boolean
  onAjouterTome: () => void
}) {
  const visibles = tuiles.filter((tuile) => {
    if (filtre === 'possedes') return tuile.status === 'owned'
    if (filtre === 'manquants') return tuile.status !== 'owned'
    return true
  })

  return (
    <section className="flex flex-col gap-3.5 pt-7">
      <div className="flex flex-wrap items-end gap-5">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-display text-[17px] font-medium tracking-[-0.02em] text-textPrimary">{titre}</h2>
          <p className="text-[13px] text-faint">{resume}</p>
        </div>
        {/* Un vrai groupe de boutons radio : trois vues qui s'excluent, ce que
            `aria-pressed` ne dirait pas - il annoncerait trois interrupteurs
            indépendants, dont deux « inactifs ». */}
        <div role="radiogroup" aria-label="Filtrer les tomes" className="flex items-center gap-1.5 rounded-full bg-softBtn p-1">
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
      </div>

      {visibles.length === 0 ? (
        <p className="py-6 text-sm text-faint">
          {filtre === 'possedes'
            ? "Aucun tome de cette édition dans ta collection pour l'instant."
            : 'Aucun tome manquant — cette édition est complète.'}
        </p>
      ) : (
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(78px,1fr))]">
          {visibles.map((tuile) => (
            <TuileNumerotee
              key={tuile.volumeNumber}
              tuile={tuile}
              actif={tuile.volumeNumber === tomeActif}
              onChoisir={() => onChoisirTome(tuile.volumeNumber)}
              onEnvies={() => onAjouterAuxEnvies(tuile.volumeNumber)}
            />
          ))}
          {modeEdition && (
            <button
              type="button"
              onClick={onAjouterTome}
              title="Ajouter un tome"
              className="flex aspect-[2/3] items-center justify-center rounded-lg border border-dashed border-lineStrong text-faint transition-colors hover:border-accent hover:bg-accentTint hover:text-accentText"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
      )}
    </section>
  )
}

function TuileNumerotee({
  tuile,
  actif,
  onChoisir,
  onEnvies,
}: {
  tuile: TomeTile
  actif: boolean
  onChoisir: () => void
  onEnvies: () => void
}) {
  const possede = tuile.status === 'owned'
  const jaquette = tuile.variant ? coverImageUrlFrom(tuile.variant.attributes) : null
  const numero = String(tuile.volumeNumber).padStart(2, '0')

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onChoisir}
        aria-label={`${possede ? 'Voir' : 'Ajouter'} le tome ${tuile.volumeNumber}`}
        // Le numéro n'est PAS `aria-hidden` : sans jaquette c'est la seule
        // chose affichée, et il porte l'information même quand une jaquette
        // le recouvre visuellement.
        className={`relative flex aspect-[2/3] w-full items-center justify-center overflow-hidden rounded-lg bg-handle transition ${
          possede ? 'shadow-token-sm' : 'opacity-[.42] grayscale-[1] contrast-[.92] ring-1 ring-line ring-inset'
        } ${actif ? 'outline-2 outline-offset-2 outline-accent' : ''}`}
      >
        <Jaquette src={jaquette} repli={null} className="absolute inset-0 h-full w-full object-cover" />
        <span
          className={`relative font-display text-[17px] font-medium tracking-[0.01em] ${
            jaquette ? 'sr-only' : 'text-white/90'
          }`}
        >
          {numero}
        </span>
      </button>

      {/* Souris uniquement (`group-hover`), et `pointer-events-none` tant que
          le survol n'a pas lieu : ces deux boutons ne doivent jamais
          intercepter un clic destiné à la tuile, ni s'intercaler dans l'ordre
          de tabulation - le clavier passe par la tuile, qui mène au même
          panneau. */}
      <div className="pointer-events-none absolute inset-0 grid grid-rows-2 overflow-hidden rounded-lg opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={onEnvies}
          title={`Ajouter le tome ${tuile.volumeNumber} à mes envies`}
          className="flex items-center justify-center bg-scrim text-white hover:bg-accent"
        >
          <Heart size={18} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={onChoisir}
          title={`Voir le tome ${tuile.volumeNumber}`}
          className="flex items-center justify-center border-t border-white/25 bg-scrim text-white hover:bg-accent"
        >
          <Eye size={18} />
        </button>
      </div>
    </div>
  )
}
