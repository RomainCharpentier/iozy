import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import { EnTeteSection } from '@/common/components/EnTeteSection'
import { COULEURS_CONFIANCE, LIBELLES_CONFIANCE } from '@/common/lib/reconnaissance'
import type { BoxDto, RecognitionConfidence } from '@/common/types/listingRecognition'
import { ChoixEdition } from './ChoixEdition'
import { editionNommee } from './editionNommee'
import type { ChoixPossibles } from './useEditionsDesSeries'
import { PhotoAnnotee, type EtatCadre } from './PhotoAnnotee'
import { rapportDuBloc, recadrer } from './recadrage'

/**
 * The check: the readings one by one.
 *
 * For each book, the photo with its single frame - to place it on
 * the shelf - then this frame in close-up and what was read from it. The user confirms,
 * corrects the number, or sets it aside, then the next one, from left to right.
 * "C'est bien ça" adds that single volume to the collection right away, so the
 * user can leave at any point; "Écarter" writes nothing. The summary by series
 * comes after, for what is still undecided.
 */
export interface Extrait {
  cle: string
  titre: string
  /** The number kept (read, or typed earlier); null as long as it is not known. */
  numero: number | null
  editionLue: string | null
  confiance: RecognitionConfidence
  indice: string
  box: BoxDto | null
  etat: EtatCadre
  /** Set when the series needs its edition chosen before anything is written. */
  choixEdition: (ChoixPossibles & { editionLue: string | null; choisie: string }) | null
}

export function ValidationUnParUn({
  extraits,
  index,
  urls,
  tailles,
  enregistrement,
  echec,
  onConfirmer,
  onEdition,
  onEcarter,
  onAller,
  onTerminer,
  onTaille,
}: {
  extraits: Extrait[]
  index: number
  urls: string[]
  tailles: Record<number, { w: number; h: number }>
  /** An add is on its way: the buttons wait for it. */
  enregistrement: boolean
  /** The last add failed. */
  echec: boolean
  onConfirmer: (cle: string, numero: number) => void
  onEdition: (cle: string, editionName: string) => void
  onEcarter: (cle: string) => void
  onAller: (index: number) => void
  onTerminer: () => void
  onTaille?: (image: number, taille: { w: number; h: number }) => void
}) {
  const total = extraits.length
  const extrait = extraits[index]

  if (!extrait) {
    const ajoutes = extraits.filter((e) => e.etat === 'possede').length
    const ecartes = extraits.filter((e) => e.etat === 'decoche').length
    return (
      <section aria-labelledby="titre-un-par-un" className="flex flex-col gap-3">
        <EnTeteSection
          niveau={2}
          titre={<span id="titre-un-par-un">Tout est passé en revue</span>}
          sousTitre={`${ajoutes} ${ajoutes > 1 ? 'ajoutés' : 'ajouté'} à ta collection, ${ecartes} ${ecartes > 1 ? 'écartés' : 'écarté'}${
            total - ajoutes - ecartes > 0 ? `, ${total - ajoutes - ecartes} pas encore décidés` : ''
          }. Le récapitulatif te montre le reste, série par série.`}
        />
        <button
          type="button"
          onClick={onTerminer}
          className="btn-primaire self-start"
        >
          Voir le récapitulatif
        </button>
      </section>
    )
  }

  const libelle = extrait.numero === null ? '?' : `T${extrait.numero}`

  return (
    <section aria-labelledby="titre-un-par-un" className="flex flex-col gap-3">
      <EnTeteSection
        niveau={2}
        titre={<span id="titre-un-par-un">Valider un par un</span>}
        sousTitre={`Extrait ${index + 1} sur ${total} : le morceau de photo, et ce qui en a été lu.`}
        action={
          <button
            type="button"
            onClick={onTerminer}
            className="btn-secondaire"
          >
            Récapitulatif
          </button>
        }
      />

      {/* The whole photo with the single frame of the current book: enough to
          place it on the shelf before looking at it closely. */}
      {extrait.box && (
        <PhotoAnnotee
          src={urls[extrait.box.image] ?? ''}
          numero={extrait.box.image + 1}
          taille={tailles[extrait.box.image]}
          interactif={false}
          enCours={extrait.cle}
          cadres={[
            {
              cle: extrait.cle,
              libelle,
              titre: extrait.titre,
              etat: extrait.etat,
              box: extrait.box,
              indice: extrait.indice || undefined,
            },
          ]}
          onTaille={(taille) => onTaille?.(extrait.box?.image ?? 0, taille)}
        />
      )}

      <FicheExtrait
        key={extrait.cle}
        extrait={extrait}
        url={extrait.box ? urls[extrait.box.image] : undefined}
        taille={extrait.box ? tailles[extrait.box.image] : undefined}
        premier={index === 0}
        dernier={index === total - 1}
        enregistrement={enregistrement}
        echec={echec}
        onConfirmer={(numero) => onConfirmer(extrait.cle, numero)}
        onEdition={(nom) => onEdition(extrait.cle, nom)}
        onEcarter={() => onEcarter(extrait.cle)}
        onPrecedent={() => onAller(index - 1)}
        onPasser={() => onAller(index + 1)}
      />
    </section>
  )
}

/** One excerpt at a time - remounted with its key so that the typed number starts from zero for each book. */
function FicheExtrait({
  extrait,
  url,
  taille,
  premier,
  dernier,
  enregistrement,
  echec,
  onConfirmer,
  onEdition,
  onEcarter,
  onPrecedent,
  onPasser,
}: {
  extrait: Extrait
  url: string | undefined
  taille: { w: number; h: number } | undefined
  premier: boolean
  dernier: boolean
  enregistrement: boolean
  echec: boolean
  onConfirmer: (numero: number) => void
  onEdition: (editionName: string) => void
  onEcarter: () => void
  onPrecedent: () => void
  onPasser: () => void
}) {
  const [numero, setNumero] = useState<string>(extrait.numero === null ? '' : String(extrait.numero))
  const numeroSaisi = numero.trim() === '' ? null : Number(numero)
  const recadrage = extrait.box ? recadrer(extrait.box) : null

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface p-3 sm:flex-row sm:items-start">
      {/* The piece of photo: the photo as background, enlarged and shifted onto the
          frame. Without a frame (reading from the text or from a barcode), we say
          so rather than showing a whole photo without a landmark. */}
      {recadrage && url ? (
        <div
          role="img"
          aria-label={`Photo recadrée sur ${extrait.titre}${extrait.numero !== null ? ` T${extrait.numero}` : ''}`}
          className="w-full shrink-0 rounded-lg bg-surface2 bg-no-repeat ring-2 ring-accent/60 sm:w-56"
          style={{
            aspectRatio: rapportDuBloc(recadrage, taille),
            backgroundImage: `url(${url})`,
            backgroundSize: recadrage.backgroundSize,
            backgroundPosition: recadrage.backgroundPosition,
          }}
        />
      ) : (
        <div className="flex w-full shrink-0 items-center justify-center rounded-lg bg-surface2 p-4 text-center text-xs text-textDim sm:w-56">
          {extrait.box ? 'Photo indisponible dans ce navigateur.' : 'Pas de cadre pour cette lecture : elle ne vient pas d’une image.'}
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-col">
          <span className="text-base font-semibold text-textPrimary">{extrait.titre}</span>
          <span className="flex flex-wrap items-center gap-x-2 text-xs">
            <span className={COULEURS_CONFIANCE[extrait.confiance]}>{LIBELLES_CONFIANCE[extrait.confiance]}</span>
            {extrait.editionLue && <span className="text-textDim">édition lue : {extrait.editionLue}</span>}
            {extrait.etat === 'possede' && <span className="text-ok">ajouté à ta collection</span>}
          </span>
          {extrait.indice && <span className="text-xs text-textDim">Ce que le lecteur a vu : {extrait.indice}</span>}
        </div>

        <label className="flex items-center gap-2 text-sm text-textPrimary">
          Numéro du tome
          <input
            type="number"
            min={1}
            inputMode="numeric"
            aria-label="Numéro du tome"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            className="champ w-20"
          />
          {extrait.numero === null && numeroSaisi === null && (
            <span className="text-xs text-warning">non lu : à saisir</span>
          )}
        </label>

        {extrait.choixEdition && extrait.etat !== 'possede' && (
          <ChoixEdition
            proposees={extrait.choixEdition.proposees}
            enRecherche={extrait.choixEdition.enRecherche}
            editionLue={extrait.choixEdition.editionLue}
            choisie={extrait.choixEdition.choisie}
            onEdition={onEdition}
          />
        )}

        {echec && (
          <p role="alert" className="text-xs text-dangerText">
            L’ajout a échoué : rien n’a été écrit. Réessaie.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => numeroSaisi !== null && onConfirmer(numeroSaisi)}
            disabled={
              numeroSaisi === null ||
              numeroSaisi < 1 ||
              extrait.etat === 'possede' ||
              enregistrement ||
              (extrait.choixEdition !== null && !editionNommee(extrait.choixEdition.choisie))
            }
            className="btn-primaire"
          >
            <Check size={14} />
            {enregistrement ? 'Ajout…' : 'C’est bien ça'}
          </button>
          <button
            type="button"
            onClick={onEcarter}
            disabled={extrait.etat === 'possede' || enregistrement}
            className="btn-secondaire"
          >
            <X size={14} />
            Écarter
          </button>
          <button
            type="button"
            onClick={onPrecedent}
            disabled={premier || enregistrement}
            aria-label="Extrait précédent"
            className="flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm text-textDim disabled:opacity-40"
          >
            <ArrowLeft size={14} />
            Précédent
          </button>
          <button
            type="button"
            onClick={onPasser}
            disabled={enregistrement}
            aria-label={dernier ? 'Terminer la revue' : 'Extrait suivant'}
            className="flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm text-textDim disabled:opacity-40"
          >
            {dernier ? 'Terminer' : 'Passer'}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
