import { Pencil } from 'lucide-react'
import { LISTING_PLATFORM_LABELS, type ListingPlatform, type ShippingEstimateKind } from '@/common/types/purchaseAnalysis'
import { TexteCoupe } from '@/common/components/TexteCoupe'
import { formaterEuros } from '@/common/lib/formats'

/**
 * Ce qu'IozyCore a compris de l'annonce, en quelques lignes.
 *
 * <h2>Pourquoi un résumé plutôt qu'un formulaire</h2>
 * Quand une URL a été lue avec succès, plateforme, prix, port, protection,
 * titre et description sont **déjà connus**. Les laisser ouverts en
 * permanence demandait à l'utilisateur de relire six champs techniques avant
 * d'arriver à la seule question qui l'intéresse : que contient ce lot, et
 * est-ce une bonne affaire.
 *
 * Le résumé les montre en une phrase et les range derrière « Modifier ». Rien
 * n'est perdu : tout reste corrigeable, mais rien n'encombre le chemin de
 * celui qui n'a rien à corriger.
 */

/**
 * Le nom du total dit du même coup ce qui lui manque - même règle que
 * {@code PurchaseAnalysisResultCard}, à laquelle ce résumé doit rester
 * cohérent : deux formulations divergentes pour un même montant seraient pires
 * que pas de résumé du tout.
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
  // Le port inconnu ne vaut PAS zéro : le supposer offert minorerait le coût.
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
