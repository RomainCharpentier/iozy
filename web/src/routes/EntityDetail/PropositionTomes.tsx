import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { quickAdd } from '../../api/entities'
import { queryKeys } from '../../lib/queryKeys'
import { volumeKey } from '../../lib/volumeKey'
import { useTomesProposes } from '../../lib/useTomesProposes'
import { GrilleVolumes, type FiltreVolumes, type VolumeAffiche } from '../../components/GrilleVolumes'
import { CartesEditions } from './CartesEditions'
import { BarreAjoutTomes } from './BarreAjoutTomes'
import { AddVolumeSection } from './AddVolumeSection'
import type { Condition } from '../../types/entityTypes'

/**
 * « Quels tomes possèdes-tu ? » — les tomes qu'un fournisseur connaît, à
 * cocher, et l'ajout qui les fait entrer en collection.
 *
 * <h2>Le seul endroit de ce parcours qui ÉCRIT</h2>
 * Consulter une œuvre ne crée rien : ni fiche, ni tome, ni possession. C'est
 * le bouton d'ajout ci-dessous - et lui seul - qui touche la base, via
 * `quickAdd`, qui crée l'Entity si elle n'existe pas encore. Tant qu'on n'a
 * rien coché, tout ce qu'on voit vient de l'API de métadonnées.
 *
 * <h2>Deux appelants, un seul comportement</h2>
 * L'aperçu d'une œuvre qu'on ne possède pas (voir ApercuOeuvrePage) et la
 * fiche d'une œuvre qui existe mais n'a encore aucun tome (ajoutée en envies,
 * par exemple). Les deux posent exactement la même question, avec les mêmes
 * cartes d'édition et la même grille - d'où ce composant plutôt que deux
 * copies qui divergeraient.
 */
export function PropositionTomes({
  entityTypeId,
  titre,
  attributs,
  entityId,
  cartes,
  onAjoute,
}: {
  entityTypeId: string
  titre: string
  /** Ce que le fournisseur a déjà donné - sert d'indices de recherche, et
   *  sera recopié sur l'Entity au moment de l'ajout. */
  attributs: Record<string, unknown>
  /** L'identifiant de la fiche quand elle existe déjà. Absent en aperçu :
   *  `quickAdd` créera l'Entity par (type, titre) à ce moment-là. */
  entityId?: string
  /** Où poser les cartes d'édition - elles vivent dans le hero, que seul
   *  l'appelant compose. Reçoit le nœud à rendre, ou null s'il n'y en a pas. */
  cartes: (noeud: React.ReactNode) => void
  /** Appelé après un ajout réussi, avec l'identifiant de la fiche - c'est là
   *  que l'aperçu bascule vers la vraie fiche. */
  onAjoute?: (entityId: string) => void
}) {
  const queryClient = useQueryClient()
  const [editionAffichee, setEditionAffichee] = useState<string | null>(null)
  const [filtre, setFiltre] = useState<FiltreVolumes>('tous')
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [condition, setCondition] = useState<Condition>('NEW')
  const [prix, setPrix] = useState('')
  const [ajoutManuelOuvert, setAjoutManuelOuvert] = useState(false)

  const proposes = useTomesProposes({ entityTypeId, titre, attributs, actif: true })

  const editions: string[] = []
  const parEdition = new Map<string, typeof proposes.candidats>()
  for (const candidat of proposes.candidats) {
    if (!parEdition.has(candidat.edition)) {
      editions.push(candidat.edition)
      parEdition.set(candidat.edition, [])
    }
    parEdition.get(candidat.edition)!.push(candidat)
  }
  const editionActive =
    editionAffichee !== null && parEdition.has(editionAffichee) ? editionAffichee : editions[0]
  const affiches = parEdition.get(editionActive) ?? []

  const ajout = useMutation({
    mutationFn: async () => {
      const prixNombre = prix.trim() ? Number(prix) : undefined
      const aAjouter = proposes.candidats.filter((c) => selection.has(volumeKey(c)))
      let identifiant = entityId
      // Un appel par tome : `quickAdd` est déjà le point d'entrée unique de
      // l'ajout, déduplication d'Entity et d'Édition comprises. Il renvoie
      // l'identifiant de la fiche - créée au premier tome quand elle
      // n'existait pas encore.
      for (const candidat of aAjouter) {
        const resultat = await quickAdd({
          entityTypeId,
          title: titre,
          condition,
          attributes: attributs,
          volumeNumber: candidat.volumeNumber,
          edition: candidat.edition || undefined,
          volumeImageUrl: candidat.imageUrl ?? undefined,
          purchasePrice: prixNombre,
        })
        identifiant = resultat.entityId
      }
      return identifiant
    },
    onSuccess: (identifiant) => {
      setSelection(new Set())
      setPrix('')
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
      if (entityId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.entities.detail(entityId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.ownerships(entityId) })
      }
      if (identifiant) onAjoute?.(identifiant)
    },
  })

  // Les cartes d'édition remontent à l'appelant : elles s'affichent dans le
  // hero, qu'il est seul à composer. Un rappel plutôt qu'un état partagé -
  // ce composant reste maître de l'édition affichée.
  cartes(
    editions.length > 0 ? (
      <CartesEditions
        editions={editions.map((nom) => ({
          nom,
          editeur: null,
          total: parEdition.get(nom)!.length,
          possedes: parEdition.get(nom)!.filter((v) => selection.has(volumeKey(v))).length,
        }))}
        editionAffichee={editionActive}
        onAfficher={setEditionAffichee}
        sensProgression="selection"
      />
    ) : null,
  )

  if (editions.length === 0) {
    return (
      <section className="flex flex-col gap-3 pt-7">
        <p className="text-sm text-textDim">
          {proposes.enCours
            ? 'Recherche des tomes disponibles...'
            : proposes.quotaDepasse
              ? 'Quota Google Books dépassé pour le moment — impossible de vérifier les éditions françaises. Tu peux ajouter un tome à la main, ou réessayer plus tard.'
              : 'Aucun tome trouvé pour cette œuvre chez nos fournisseurs. Tu peux les ajouter à la main.'}
        </p>
        {/* La saisie manuelle suppose une fiche : sans elle, il n'y a pas
            encore d'œuvre à laquelle rattacher un tome. En aperçu, le premier
            ajout passe forcément par la grille ci-dessus. */}
        {entityId && (
          <>
            <button
              type="button"
              onClick={() => setAjoutManuelOuvert(true)}
              className="flex min-h-11 w-fit items-center gap-2 rounded-[13px] bg-surface px-4 text-sm font-medium text-textPrimary shadow-token-sm"
            >
              Ajouter un tome à la main
            </button>
            <AddVolumeSection
              entityId={entityId}
              entityTypeId={entityTypeId}
              title={titre}
              ouvert={ajoutManuelOuvert}
              onFermer={() => setAjoutManuelOuvert(false)}
            />
          </>
        )}
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4 pt-7">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-display text-[17px] font-medium tracking-[-0.02em] text-textPrimary">
          {editionActive || 'Édition non précisée'}
        </h2>
        <p className="text-[13px] text-faint">Quels tomes possèdes-tu ?</p>
      </div>

      <GrilleVolumes
        volumes={affiches.map(
          (candidat): VolumeAffiche => ({
            cle: volumeKey(candidat),
            numero: candidat.volumeNumber,
            jaquetteUrl: candidat.imageUrl,
            possede: candidat.alreadyOwned,
            actif: selection.has(volumeKey(candidat)),
          }),
        )}
        mode="selection"
        filtre={filtre}
        onFiltre={setFiltre}
        onActiver={(cle) =>
          setSelection((prev) => {
            const suivant = new Set(prev)
            if (suivant.has(cle)) suivant.delete(cle)
            else suivant.add(cle)
            return suivant
          })
        }
        videMessage="Aucun tome ne correspond à ce filtre."
      />

      <BarreAjoutTomes
        nombre={selection.size}
        condition={condition}
        onCondition={setCondition}
        prix={prix}
        onPrix={setPrix}
        enCours={ajout.isPending}
        erreur={ajout.isError ? ajout.error.message : null}
        onToutDeselectionner={() => setSelection(new Set())}
        onAjouter={() => ajout.mutate()}
      />
    </section>
  )
}
