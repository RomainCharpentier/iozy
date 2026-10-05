import { Pencil } from 'lucide-react'
import { LISTING_PLATFORM_LABELS, type ListingPlatform, type ShippingEstimateKind } from '@/common/types/purchaseAnalysis'
import { TexteCoupe } from '@/common/components/TexteCoupe'
import { formaterEuros } from '@/common/lib/formats'

/**
 * What IozyCore understood of the listing, in a few lines.
 *
 * <h2>Why a summary rather than a form</h2>
 * When a URL has been read successfully, platform, price, shipping, protection,
 * title and description are **already known**. Leaving them open
 * all the time made the user reread six technical fields before
 * reaching the only question they care about: what does this batch contain, and
 * is it a good deal.
 *
 * The summary shows them in one sentence and puts them behind "Modifier". Nothing
 * is lost: everything stays correctable, but nothing clutters the path of
 * someone with nothing to correct.
 */

/**
 * The name of the total says at the same time what it lacks - same rule as
 * {@code PurchaseAnalysisResultCard}, with which this summary must stay
 * consistent: two diverging wordings for the same amount would be worse
 * than no summary at all.
 */
function libelleTotal(kind: ShippingEstimateKind): string {
  if (kind === 'FROM') return 'Coût minimum estimé'
  if (kind === 'UNKNOWN') return 'Sous-total connu'
  return 'Coût d’acquisition estimé'
}

function euros(valeur: number): string {
  return `${formaterEuros(valeur)}`
}

export function ListingSummaryCard({
  platform,
  rawTitle,
  askingPrice,
  shippingFee,
  shippingKind,
  buyerProtectionFee,
  photoCount,
  onEdit,
}: {
  platform: ListingPlatform
  rawTitle: string
  askingPrice: string
  shippingFee: string
  shippingKind: ShippingEstimateKind
  buyerProtectionFee: string
  photoCount: number
  onEdit: () => void
}) {
  const prix = Number(askingPrice)
  const port = shippingFee.trim() ? Number(shippingFee) : null
  const protection = buyerProtectionFee.trim() ? Number(buyerProtectionFee) : null

  const prixConnu = askingPrice.trim() !== '' && !Number.isNaN(prix)
  // Unknown shipping is NOT worth zero: assuming it is free would understate the cost.
  const totalCalculable = prixConnu && shippingKind !== 'UNKNOWN'
  const total = prixConnu ? prix + (port ?? 0) + (protection ?? 0) : null

  return (
    <section className="flex flex-col gap-2 rounded-xl bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs uppercase tracking-wide text-textDim">
            {LISTING_PLATFORM_LABELS[platform]}
            {photoCount > 0 && ` · ${photoCount} photo${photoCount > 1 ? 's' : ''}`}
          </span>
          <TexteCoupe
            as="h2"
            texte={rawTitle.trim() || 'Annonce sans titre'}
            className="truncate font-display text-sm font-semibold text-textPrimary"
          />
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="btn-secondaire shrink-0"
        >
          <Pencil size={13} />
          Modifier
        </button>
      </div>

      <div className="flex flex-col gap-0.5 text-sm text-textPrimary">
        <span>{prixConnu ? euros(prix) : 'Prix non renseigné'}</span>
        {port !== null && port > 0 && (
          <span className="text-xs text-textDim">
            + {euros(port)} de port
            {shippingKind === 'FROM' && ' minimum'}
            {shippingKind === 'ESTIMATED' && ' estimé'}
          </span>
        )}
        {shippingKind === 'FREE' && <span className="text-xs text-textDim">Port offert</span>}
        {shippingKind === 'UNKNOWN' && (
          <span className="text-xs text-warning">Port non communiqué</span>
        )}
        {protection !== null && protection > 0 && (
          <span className="text-xs text-textDim">+ {euros(protection)} de protection acheteur</span>
        )}
      </div>

      {total !== null && (
        <p className="text-sm font-semibold text-textPrimary">
          {totalCalculable ? libelleTotal(shippingKind) : 'Sous-total connu'} : {euros(total)}
        </p>
      )}
    </section>
  )
}
