import { useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { quickAdd } from '../../api/entities'
import { volumeKey } from '../../lib/volumeKey'
import { useTomesProposes } from '../../lib/useTomesProposes'
import { useCollecteParTome } from '../../lib/typeDeCollection'
import { AjoutDirect } from './AjoutDirect'
import { GrilleVolumes, type FiltreVolumes, type VolumeAffiche } from '../../components/GrilleVolumes'
import { CartesEditions } from './CartesEditions'
import { BarreAjoutTomes } from './BarreAjoutTomes'
import { AddVolumeSection } from './AddVolumeSection'
import { invaliderApresPossession } from '../../lib/invalidations'

/**
 * « Quels tomes possèdes-tu ? » — les tomes qu'un fournisseur connaît, à
 * cocher, et l'ajout qui les fait entrer en collection.
 *
 * <h2>Le seul endroit de ce parcours qui ÉCRIT</h2>
 * Consulter une œuvre ne crée rien : ni fiche, ni tome, ni possession. C'est
 * le bouton d'ajout - et lui seul - qui touche la base, via `quickAdd`, qui
 * crée l'Entity si elle n'existe pas encore. Tant que rien n'est coché, tout
 * ce qui est affiché vient de l'API de métadonnées.
 *
 * <h2>Un hook qui rend deux morceaux, et pourquoi</h2>
 * Les cartes d'édition vivent dans le hero, la grille et l'ajout vivent dans
 * le corps de la page - mais les deux partagent un état (l'édition affichée,
 * la sélection). Un hook le porte et renvoie les deux nœuds ; l'appelant les
 * place. La première version passait les cartes à l'appelant par un rappel
 * pendant le rendu, ce qui revient à modifier l'état d'un composant pendant
 * le rendu d'un autre - React le refuse à juste titre.
 *
 * <h2>Deux appelants, un seul comportement</h2>
 * L'aperçu d'une œuvre qu'on ne possède pas (voir ApercuOeuvrePage) et la
 * fiche d'une œuvre qui existe mais n'a encore aucun tome (ajoutée en envies,
 * par exemple). Les deux posent la même question, avec les mêmes cartes et la
 * même grille.
 *
 * <h2>Et les œuvres qui n'ont pas de tome</h2>
 * Un jeu vidéo, un jeu de société : l'œuvre EST l'objet collectionnable (voir
 * lib/typeDeCollection). « Quels tomes possèdes-tu ? » n'y veut rien dire - et
 * pourtant cet écran le demandait, pour finir sur « Aucun tome trouvé » et un
 * unique bouton « Ajouter un tome à la main ». Un jeu était donc **impossible
 * à ajouter depuis la recherche** (constaté le 2026-08-27 sur Carcassonne puis
 * Hollow Knight). Ces types reçoivent maintenant un ajout direct, sans grille
 * ni édition.
 */
export function usePropositionTomes({
  entityTypeId,
  titre,
  attributs,
  entityId,
  actif,
  attributsEnCours = false,
  onAjoute,
}: {
  entityTypeId: string
  titre: string
  /** Ce que le fournisseur a déjà donné : sert d'indices de recherche, et
   *  sera recopié sur l'Entity au moment de l'ajout. */
  attributs: Record<string, unknown>
  /** L'identifiant de la fiche quand elle existe déjà. Absent en aperçu :
   *  `quickAdd` créera l'Entity par (type, titre) à ce moment-là. */
  entityId?: string
  actif: boolean
  /** Les attributs ne sont pas encore connus (aperçu dont la recherche de
   *  métadonnées n'a pas répondu). L'ajout est retenu : il les recopie sur
   *  l'Entity qu'il crée, et une fiche sans jaquette ni auteur est très
   *  pénible à rattraper ensuite. */
  attributsEnCours?: boolean
  /** Appelé après un ajout réussi, avec l'identifiant de la fiche - c'est là
   *  que l'aperçu bascule vers la vraie fiche. */
  onAjoute?: (entityId: string) => void
}): { cartesEditions: ReactNode; section: ReactNode } {
  const queryClient = useQueryClient()
  const [editionAffichee, setEditionAffichee] = useState<string | null>(null)
  const [filtre, setFiltre] = useState<FiltreVolumes>('tous')
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [ajoutManuelOuvert, setAjoutManuelOuvert] = useState(false)

  // Inutile d'aller chercher des tomes pour un jeu : il n'en a pas, et
  // l'appel au fournisseur serait de toute façon vide.
  const parTome = useCollecteParTome(entityTypeId)
  const proposes = useTomesProposes({ entityTypeId, titre, attributs, actif: actif && parTome })

  const ajout = useMutation({
    mutationFn: async () => {
      let identifiant = entityId

      // Une œuvre sans tome s'ajoute d'un seul appel, sans volumeNumber :
      // l'Ownership se rattache alors directement à l'Entity (voir
      // QuickAddService).
      if (!parTome) {
        const resultat = await quickAdd({
          entityTypeId,
          title: titre,
          // `NEW` reste la valeur stockée - c'était déjà le défaut de l'ancien
          // formulaire - et se corrige sur l'exemplaire. `condition` est
          // obligatoire en base et n'a pas de valeur « non renseigné ».
          condition: 'NEW',
          attributes: attributs,
        })
        return resultat.entityId
      }
      // Un appel par tome : `quickAdd` est déjà le point d'entrée unique de
      // l'ajout, déduplication d'Entity et d'Édition comprises. Il renvoie
      // l'identifiant de la fiche - créée au premier tome quand elle
      // n'existait pas encore.
      for (const candidat of proposes.candidats.filter((c) => selection.has(volumeKey(c)))) {
        const resultat = await quickAdd({
          entityTypeId,
          title: titre,
          condition: 'NEW',
          attributes: attributs,
          volumeNumber: candidat.volumeNumber,
          edition: candidat.edition || undefined,
          volumeImageUrl: candidat.imageUrl ?? undefined,
        })
        identifiant = resultat.entityId
      }
      return identifiant
    },
    onSuccess: (identifiant) => {
      setSelection(new Set())
      // Sans condition sur `entityId` : l'ajout vient peut-être de CRÉER
      // l'œuvre, auquel cas la progression de toute la collection change aussi.
      invaliderApresPossession(queryClient)
      if (identifiant) onAjoute?.(identifiant)
    },
  })

  if (!actif) return { cartesEditions: null, section: null }

  if (!parTome) {
    return {
      cartesEditions: null,
      section: (
        <section className="flex flex-col gap-4 pt-5">
          <AjoutDirect
            onAjouter={() => ajout.mutate()}
            enCours={ajout.isPending}
            attente={attributsEnCours}
            erreur={ajout.isError ? ajout.error.message : null}
          />
        </section>
      ),
    }
  }

  const editions: string[] = []
  const parEdition = new Map<string, typeof proposes.candidats>()
  for (const candidat of proposes.candidats) {
    if (!parEdition.has(candidat.edition)) {
      editions.push(candidat.edition)
      parEdition.set(candidat.edition, [])
    }
    parEdition.get(candidat.edition)!.push(candidat)
  }
  const editionActive = editionAffichee !== null && parEdition.has(editionAffichee) ? editionAffichee : editions[0]
  const affiches = parEdition.get(editionActive) ?? []

  if (editions.length === 0) {
    return {
      cartesEditions: null,
      section: (
        <section className="flex flex-col gap-3 pt-7">
          <p className="text-sm text-textDim">
            {proposes.enCours
              ? 'Recherche des tomes disponibles...'
              : proposes.fournisseurMuet
                ? "Nos fournisseurs n'ont pas répondu pour le moment — impossible de vérifier les éditions françaises. Tu peux ajouter un tome à la main, ou réessayer plus tard."
                : 'Aucun tome trouvé pour cette œuvre chez nos fournisseurs. Tu peux les ajouter à la main.'}
          </p>
          {/* La saisie manuelle ne suppose AUCUNE fiche : `quickAdd` la crée
              au premier tome (voir AddVolumeSection). Elle était pourtant
              conditionnée à `entityId`, si bien qu'un aperçu sans tome trouvé
              promettait « tu peux les ajouter à la main » sans offrir le
              moindre bouton - signalé sur « Demon's Plan ». */}
          <button
            type="button"
            onClick={() => setAjoutManuelOuvert(true)}
            aria-expanded={ajoutManuelOuvert}
            className="flex min-h-11 w-fit items-center gap-2 rounded-[13px] bg-surface px-4 text-sm font-medium text-textPrimary shadow-token-sm"
          >
            <Plus size={15} />
            Ajouter un tome à la main
          </button>
          <AddVolumeSection
            entityId={entityId}
            entityTypeId={entityTypeId}
            title={titre}
            attributes={attributs}
            ouvert={ajoutManuelOuvert}
            onFermer={() => setAjoutManuelOuvert(false)}
            onAjoute={(id) => onAjoute?.(id)}
          />
        </section>
      ),
    }
  }

  return {
    cartesEditions: (
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
    ),
    section: (
      <section className="flex flex-col gap-4 pt-5">
        <GrilleVolumes
          enTete={
            // Même en-tête d'une ligne que sur la fiche (voir GrilleTomes) :
            // les deux écrans montrent la même chose, ils doivent l'annoncer
            // de la même façon.
            <h2 className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-display text-[14px] font-medium tracking-[-0.01em] text-textPrimary">
                {editionActive || 'Édition non précisée'}
              </span>
              <span className="text-[12.5px] text-faint">Quels tomes possèdes-tu ?</span>
            </h2>
          }
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
          enCours={ajout.isPending}
          attente={attributsEnCours}
        erreur={ajout.isError ? ajout.error.message : null}
          onToutDeselectionner={() => setSelection(new Set())}
          onAjouter={() => ajout.mutate()}
        />
      </section>
    ),
  }
}
