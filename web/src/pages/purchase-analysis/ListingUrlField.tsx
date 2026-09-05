import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link2, Loader2, CheckCircle2, Info, X } from 'lucide-react'
import { resolveListing } from '@/common/api/purchaseAnalysis'
import { LISTING_PLATFORM_LABELS, type ListingPreviewDto } from '@/common/types/purchaseAnalysis'

/** Reconnaît une plateforme à son HÔTE, jamais au fait que l'URL contienne son
 * nom - `https://phishing.example/vinted.fr` n'est pas une annonce Vinted.
 * Sert uniquement à annoncer la détection avant l'appel ; c'est le backend qui
 * décide vraiment (liste blanche stricte, voir ListingUrlGuard). */
function detecterSource(url: string): 'VINTED' | null {
  try {
    const hote = new URL(url).hostname.toLowerCase()
    return hote === 'vinted.fr' || hote.endsWith('.vinted.fr') || /(^|\.)vinted\.[a-z.]{2,6}$/.test(hote)
      ? 'VINTED'
      : null
  } catch {
    return null
  }
}

function estUneUrlPlausible(valeur: string): boolean {
  try {
    const url = new URL(valeur.trim())
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

const MESSAGES_ECHEC: Record<string, string> = {
  UNSUPPORTED_SOURCE:
    "Cette plateforme n'est pas encore récupérée automatiquement. Tu peux analyser l'annonce en complétant les champs à la main — le lien est conservé.",
  // Dire « pas encore » ici ferait attendre une fonctionnalité qui ne viendra
  // pas ainsi : la plateforme se protège contre les robots, et la contourner
  // n'est pas une option. Autant l'annoncer franchement.
  SOURCE_BLOCKS_AUTOMATION:
    "Cette plateforme bloque la lecture automatique de ses annonces — le lien est conservé. Deux façons d'avancer vite : colle le titre de l'annonce dans « Titre de l'annonce », les tomes y sont souvent détectés tout seuls ; et enregistre ses photos pour les envoyer via « Envoyer mes photos », plus bas.",
  LISTING_NOT_FOUND:
    "Cette annonce n'est plus accessible. Tu peux quand même l'analyser en complétant les champs à la main.",
  UNAVAILABLE:
    "Impossible de récupérer automatiquement cette annonce pour le moment. Tu peux la compléter à la main — le lien est conservé.",
  INVALID_URL: 'Ce lien ne peut pas être ouvert.',
}

/**
 * Le lien de l'annonce, et ce qu'IozyCore arrive à en lire.
 *
 * Coller un lien ne remplissait jusqu'ici qu'un champ texte rangé derrière
 * « Détails de l'annonce » : il servait à retrouver l'annonce plus tard, rien
 * de plus. Il devient ici une **source d'information** — titre, prix,
 * description et photos sont lus puis proposés au brouillon.
 *
 * Trois règles tiennent tout le comportement :
 * - **rien n'est inventé** : seuls les champs réellement lus (`retrievedFields`)
 *   sont pré-remplis, un prix absent reste vide plutôt que supposé ;
 * - **rien n'est écrasé** : une valeur déjà saisie est conservée, et le fait
 *   qu'elle diffère de celle de l'annonce est dit à l'écran, jamais silencieux ;
 * - **rien ne bloque** : échec total, partiel ou plateforme inconnue, le
 *   formulaire manuel reste utilisable et le lien reste conservé.
 */
export function ListingUrlField({
  url,
  onUrlChange,
  onResolved,
}: {
  url: string
  onUrlChange: (url: string) => void
  /** Reçoit ce qui a été lu ; c'est l'appelant qui décide quoi en faire, champ par champ. */
  onResolved: (preview: ListingPreviewDto) => { conserves: string[] }
}) {
  const [preview, setPreview] = useState<ListingPreviewDto | null>(null)
  const [conserves, setConserves] = useState<string[]>([])
  // Un même lien peut être « collé » plusieurs fois (frappe, re-render, retour
  // sur le champ) : on ne relit une annonce qu'une fois par URL.
  const dejaResolues = useRef(new Map<string, ListingPreviewDto>())

  const source = detecterSource(url)
  const urlPlausible = url.trim().length > 0 && estUneUrlPlausible(url)
  const lienInvalide = url.trim().length > 0 && !urlPlausible

  const resolveMutation = useMutation({
    mutationFn: (aResoudre: string) => resolveListing(aResoudre),
    onSuccess: (resultat, aResoudre) => {
      dejaResolues.current.set(aResoudre, resultat)
      setPreview(resultat)
      // Appliqué même quand RIEN n'a été lu : la plateforme reconnue est un
      // fait constaté, pas une donnée extraite. Sans cela, un lien Leboncoin
      // laissait « Vinted » sélectionné, et l'analyse s'enregistrait sous la
      // mauvaise plateforme - laquelle alimente ensuite les prix relevés.
      // appliquerPreview garde déjà chaque champ un par un : lui passer une
      // lecture vide ne remplit rien d'autre.
      setConserves(onResolved(resultat).conserves)
    },
  })

  const declencher = resolveMutation.mutate
  useEffect(() => {
    const aResoudre = url.trim()
    if (!aResoudre || !estUneUrlPlausible(aResoudre)) {
      setPreview(null)
      setConserves([])
      return
    }
    const enCache = dejaResolues.current.get(aResoudre)
    if (enCache) {
      setPreview(enCache)
      return
    }
    // Laisse le temps de finir de coller/taper avant d'appeler - le champ reste
    // utilisable pendant ce temps, rien n'est bloqué.
    const minuteur = setTimeout(() => declencher(aResoudre), 600)
    return () => clearTimeout(minuteur)
  }, [url, declencher])

  const enCours = resolveMutation.isPending
  const reussite = preview && (preview.status === 'SUCCESS' || preview.status === 'PARTIAL')
  const echec = preview && !reussite

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-surface p-3">
      <label className="flex flex-col gap-1.5 text-sm text-textDim" htmlFor="listing-url">
        Lien de l'annonce (facultatif)
        <input
          id="listing-url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://www.vinted.fr/items/…"
          inputMode="url"
          autoComplete="off"
          className="min-h-11 rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
      </label>

      {/* Lien manifestement invalide : dit en local, sans appeler le serveur. */}
      {lienInvalide && <p className="text-xs text-dangerText">Lien invalide.</p>}

      {source && !enCours && !preview && (
        <p className="flex items-center gap-1.5 text-xs text-textDim">
          <Link2 size={12} className="shrink-0" />
          Détection : {LISTING_PLATFORM_LABELS.VINTED}
        </p>
      )}

      {enCours && (
        <p className="flex items-center gap-1.5 text-xs text-textDim">
          <Loader2 size={12} className="shrink-0 animate-spin" />
          Récupération de l'annonce…
        </p>
      )}

      {reussite && (
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-accentText">
            <CheckCircle2 size={12} className="shrink-0" />
            Annonce {LISTING_PLATFORM_LABELS[preview.source]} récupérée
          </p>
          <p className="text-xs text-textDim">
            {/* Ce qui a été lu, et donc ce qu'il reste à saisir - dire seulement
                « récupérée » laisserait deviner ce qui manque. */}
            Complété : {libellesChamps(preview).join(' · ')}
            {preview.status === 'PARTIAL' && ` — le reste est à compléter à la main.`}
          </p>
          {conserves.length > 0 && (
            <p className="flex items-start gap-1.5 rounded-lg bg-surface2 px-2.5 py-2 text-xs text-textDim">
              <Info size={12} className="mt-0.5 shrink-0" />
              {/* Pas de conflit invisible : ce que l'annonce disait autrement est
                  annoncé, et c'est la saisie de l'utilisateur qui est gardée. */}
              <span>
                Tes saisies ont été conservées pour : {conserves.join(', ')}. L'annonce indiquait autre chose.
              </span>
            </p>
          )}
        </div>
      )}

      {echec && (
        <p className="rounded-lg bg-surface2 px-2.5 py-2 text-xs text-textDim">
          {MESSAGES_ECHEC[preview.status] ?? MESSAGES_ECHEC.UNAVAILABLE}
        </p>
      )}
    </div>
  )
}

function libellesChamps(preview: ListingPreviewDto): string[] {
  const libelles: Record<string, string> = {
    TITLE: 'titre',
    PRICE: 'prix',
    DESCRIPTION: 'description',
    SHIPPING_FEE: 'frais de port',
    BUYER_PROTECTION_FEE: 'protection acheteur',
    IMAGES: `${preview.imageUrls.length} photo${preview.imageUrls.length > 1 ? 's' : ''}`,
  }
  return preview.retrievedFields.map((champ) => libelles[champ] ?? champ)
}

/** Les photos récupérées, retirables une à une avant l'analyse. */
export function ListingPhotos({
  imageUrls,
  onRemove,
}: {
  imageUrls: string[]
  onRemove: (url: string) => void
}) {
  if (imageUrls.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-textDim">
        {imageUrls.length} photo{imageUrls.length > 1 ? 's' : ''} récupérée
        {imageUrls.length > 1 ? 's' : ''} — conservée{imageUrls.length > 1 ? 's' : ''} avec l'analyse
      </span>
      <div className="defilement-discret flex gap-2 overflow-x-auto pb-1">
        {imageUrls.map((imageUrl) => (
          <div key={imageUrl} className="relative shrink-0">
            <img src={imageUrl} alt="" className="h-20 w-14 rounded-lg object-cover" />
            <button
              type="button"
              onClick={() => onRemove(imageUrl)}
              aria-label="Retirer cette photo du brouillon"
              className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-surface2 text-textDim shadow-token-sm hover:text-dangerText"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
