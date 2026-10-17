import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link2, Loader2, CheckCircle2, Info, X } from 'lucide-react'
import { resolveListing } from '@/common/api/purchaseAnalysis'
import { LISTING_PLATFORM_LABELS, type ListingPreviewDto } from '@/common/types/purchaseAnalysis'

/** Recognises a platform by its HOST, never by the URL containing its
 * name - `https://phishing.example/vinted.fr` is not a Vinted listing.
 * Only serves to announce the detection before the call; it is the backend that
 * really decides (strict whitelist, see ListingUrlGuard). */
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
  // Saying "not yet" here would make people wait for a feature that will not come
  // that way: the platform protects itself against robots, and getting around it
  // is not an option. Better to announce it frankly.
  SOURCE_BLOCKS_AUTOMATION:
    "Cette plateforme bloque la lecture automatique de ses annonces — le lien est conservé. Deux façons d'avancer vite : colle le titre de l'annonce dans « Titre de l'annonce », les tomes y sont souvent détectés tout seuls ; et enregistre ses photos pour les envoyer via « Envoyer mes photos », plus bas.",
  LISTING_NOT_FOUND:
    "Cette annonce n'est plus accessible. Tu peux quand même l'analyser en complétant les champs à la main.",
  UNAVAILABLE:
    "Impossible de récupérer automatiquement cette annonce pour le moment. Tu peux la compléter à la main — le lien est conservé.",
  INVALID_URL: 'Ce lien ne peut pas être ouvert.',
}

/**
 * The link of the listing, and what IozyCore manages to read from it.
 *
 * Pasting a link used to only fill a text field tucked behind
 * "Détails de l'annonce": it served to find the listing again later, nothing
 * more. It becomes here an **information source** — title, price,
 * description and photos are read then offered to the draft.
 *
 * Three rules hold all the behaviour:
 * - **nothing is invented**: only the fields actually read (`retrievedFields`)
 *   are pre-filled, a missing price stays empty rather than assumed;
 * - **nothing is overwritten**: a value already entered is kept, and the fact
 *   that it differs from the listing's is said on screen, never silent;
 * - **nothing blocks**: total or partial failure or unknown platform, the
 *   manual form stays usable and the link stays kept.
 */
export function ListingUrlField({
  url,
  onUrlChange,
  onResolved,
}: {
  url: string
  onUrlChange: (url: string) => void
  /** Receives what was read; the caller decides what to do with it, field by field. */
  onResolved: (preview: ListingPreviewDto) => { conserves: string[] }
}) {
  // What was read, per URL. The same link can be "pasted" several times
  // (typing, re-render, return to the field): a listing is read once per URL,
  // and the screen derives its preview from the URL of the moment - an
  // emptied or edited field shows nothing, with no reset in an effect.
  const [readings, setReadings] = useState<ReadonlyMap<string, { preview: ListingPreviewDto; conserves: string[] }>>(
    () => new Map(),
  )

  const source = detecterSource(url)
  const toResolve = url.trim()
  const urlPlausible = toResolve.length > 0 && estUneUrlPlausible(toResolve)
  const lienInvalide = toResolve.length > 0 && !urlPlausible
  const reading = urlPlausible ? readings.get(toResolve) : undefined
  const preview = reading?.preview ?? null
  const conserves = reading?.conserves ?? []

  const resolveMutation = useMutation({
    mutationFn: (link: string) => resolveListing(link),
    onSuccess: (resultat, link) => {
      // Applied even when NOTHING was read: the recognised platform is a
      // observed fact, not extracted data. Without it, a Leboncoin link
      // left "Vinted" selected, and the analysis was saved under the
      // wrong platform - which then feeds the recorded prices.
      // appliquerPreview already guards each field one by one: passing it an empty
      // read fills nothing else.
      const { conserves: kept } = onResolved(resultat)
      setReadings((before) => new Map(before).set(link, { preview: resultat, conserves: kept }))
    },
  })

  const declencher = resolveMutation.mutate
  const alreadyRead = reading !== undefined
  useEffect(() => {
    if (!urlPlausible || alreadyRead) return
    // Leaves time to finish pasting/typing before calling - the field stays
    // usable during that time, nothing is blocked.
    const minuteur = setTimeout(() => declencher(toResolve), 600)
    return () => clearTimeout(minuteur)
  }, [toResolve, urlPlausible, alreadyRead, declencher])

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
          className="champ"
        />
      </label>

      {/* Clearly invalid link: said locally, without calling the server. */}
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
            {/* What was read, and so what is left to enter - saying only
                "récupérée" would leave one guessing what is missing. */}
            Complété : {libellesChamps(preview).join(' · ')}
            {preview.status === 'PARTIAL' && ` — le reste est à compléter à la main.`}
          </p>
          {conserves.length > 0 && (
            <p className="flex items-start gap-1.5 rounded-lg bg-surface2 px-2.5 py-2 text-xs text-textDim">
              <Info size={12} className="mt-0.5 shrink-0" />
              {/* No invisible conflict: what the listing said differently is
                  announced, and it is the user's input that is kept. */}
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

/** The retrieved photos, removable one by one before the analysis. */
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
