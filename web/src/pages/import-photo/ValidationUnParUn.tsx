import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import { EnTeteSection } from '@/common/components/EnTeteSection'
import { COULEURS_CONFIANCE, LIBELLES_CONFIANCE } from '@/common/lib/reconnaissance'
import type { BoxDto, RecognitionConfidence } from '@/common/types/listingRecognition'
import { PhotoAnnotee, type EtatCadre } from './PhotoAnnotee'
import { rapportDuBloc, recadrer } from './recadrage'

/**
 * La vérification : les lectures une par une.
 *
 * Pour chaque livre, la photo avec son seul cadre - pour le situer sur
 * l'étagère - puis ce cadre en gros plan et ce qui en a été lu. On confirme,
 * on corrige le numéro, ou on écarte, puis le suivant, de gauche à droite.
 * Rien n'est écrit ici : chaque geste ne fait que cocher ou décocher la
 * pastille correspondante ; le récapitulatif par série vient après, et la
 * relecture avant écriture reste le seul passage obligé.
 */
export interface Extrait {
  cle: string
  titre: string
  /** Le numéro retenu (lu, ou saisi plus tôt) ; null tant qu'on ne le connaît pas. */
  numero: number | null
  editionLue: string | null
  confiance: RecognitionConfidence
  indice: string
  box: BoxDto | null
  etat: EtatCadre
}

export function ValidationUnParUn({
  extraits,
  index,
  urls,
  tailles,
  onConfirmer,
  onEcarter,
  onAller,
  onTerminer,
  onTaille,
}: {
  extraits: Extrait[]
  index: number
  urls: string[]
  tailles: Record<number, { w: number; h: number }>
  onConfirmer: (cle: string, numero: number | null) => void
  onEcarter: (cle: string) => void
  onAller: (index: number) => void
  onTerminer: () => void
  onTaille?: (image: number, taille: { w: number; h: number }) => void
}) {
  const total = extraits.length
  const extrait = extraits[index]

  if (!extrait) {
    const confirmes = extraits.filter((e) => e.etat === 'coche').length
    const ecartes = extraits.filter((e) => e.etat === 'decoche').length
    return (
      <section aria-labelledby="titre-un-par-un" className="flex flex-col gap-3">
        <EnTeteSection
          niveau={2}
          titre={<span id="titre-un-par-un">Tout est passé en revue</span>}
          sousTitre={`${confirmes} ${confirmes > 1 ? 'confirmés' : 'confirmé'}, ${ecartes} ${ecartes > 1 ? 'écartés' : 'écarté'}${
            total - confirmes - ecartes > 0 ? `, ${total - confirmes - ecartes} sans numéro` : ''
          }. Rien n’est écrit : le récapitulatif te montre le résultat par série, puis tu relis avant d’ajouter.`}
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

      {/* La photo entière avec le seul cadre du livre en cours : de quoi le
          situer sur l'étagère avant de le regarder de près. */}
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
        onConfirmer={(numero) => onConfirmer(extrait.cle, numero)}
        onEcarter={() => onEcarter(extrait.cle)}
        onPrecedent={() => onAller(index - 1)}
        onPasser={() => onAller(index + 1)}
      />
    </section>
  )
}

/** Un extrait à la fois - remonté avec sa clé pour que le numéro saisi reparte de zéro à chaque livre. */
function FicheExtrait({
  extrait,
  url,
  taille,
  premier,
  dernier,
  onConfirmer,
  onEcarter,
  onPrecedent,
  onPasser,
}: {
  extrait: Extrait
  url: string | undefined
  taille: { w: number; h: number } | undefined
  premier: boolean
  dernier: boolean
  onConfirmer: (numero: number | null) => void
  onEcarter: () => void
  onPrecedent: () => void
  onPasser: () => void
}) {
  const [numero, setNumero] = useState<string>(extrait.numero === null ? '' : String(extrait.numero))
  const numeroSaisi = numero.trim() === '' ? null : Number(numero)
  const recadrage = extrait.box ? recadrer(extrait.box) : null

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface p-3 sm:flex-row sm:items-start">
      {/* Le morceau de photo : la photo en fond, agrandie et décalée sur le
          cadre. Sans cadre (lecture venue du texte ou d'un code-barres), on le
          dit plutôt que de montrer une photo entière sans repère. */}
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
            {extrait.etat === 'possede' && <span className="text-ok">déjà possédé</span>}
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onConfirmer(numeroSaisi)}
            disabled={numeroSaisi === null || numeroSaisi < 1 || extrait.etat === 'possede'}
            className="btn-primaire"
          >
            <Check size={14} />
            C’est bien ça
          </button>
          <button
            type="button"
            onClick={onEcarter}
            disabled={extrait.etat === 'possede'}
            className="btn-secondaire"
          >
            <X size={14} />
            Écarter
          </button>
          <button
            type="button"
            onClick={onPrecedent}
            disabled={premier}
            aria-label="Extrait précédent"
            className="flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm text-textDim disabled:opacity-40"
          >
            <ArrowLeft size={14} />
            Précédent
          </button>
          <button
            type="button"
            onClick={onPasser}
            aria-label={dernier ? 'Terminer la revue' : 'Extrait suivant'}
            className="flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm text-textDim"
          >
            {dernier ? 'Terminer' : 'Passer'}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
