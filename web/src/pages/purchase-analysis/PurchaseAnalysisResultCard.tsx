import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, ExternalLink, Heart, History, Scale, TriangleAlert, Info, CircleX } from 'lucide-react'
import { useWishlist } from '@/common/hooks/useWishlist'
import type { WishlistTarget } from '@/common/api/wishlist'
import { VerdictBadge } from './VerdictBadge'
import { ListingAssessmentCard } from './ListingAssessmentCard'
import { SeriesBreakdownItem } from './SeriesBreakdownItem'
import { LISTING_PLATFORM_LABELS } from '@/common/types/purchaseAnalysis'
import type { PurchaseAnalysisDto, WarningSeverity } from '@/common/types/purchaseAnalysis'
import { CLASSE_CARTE } from '@/common/components/Carte'
import { formaterEuros } from '@/common/lib/formats'

const CONFIDENCE_LABELS = { HIGH: 'Haute', MEDIUM: 'Moyenne', LOW: 'Faible' } as const

const WARNING_ICONS: Record<WarningSeverity, typeof Info> = { INFO: Info, CAUTION: TriangleAlert, CRITICAL: CircleX }

/**
 * Says what the shipping amount is worth, rather than displaying a bare number.
 * "2,83 €" and "à partir de 2,83 €" do not tell the same story; an unreadable
 * delivery must above all not look like free delivery;
 * and an amount that the user has just entered must never be displayed
 * "non communiquée" - it has precisely just been communicated.
 */
function libelleLivraison(listing: PurchaseAnalysisDto['listing']): string {
  switch (listing.shippingKind) {
    case 'FREE':
      return 'offerte'
    case 'FROM':
      return `à partir de ${euros(listing.shippingFee)}`
    case 'EXACT':
      return euros(listing.shippingFee)
    case 'ESTIMATED':
      return `${euros(listing.shippingFee)} estimés`
    default:
      return 'non communiquée'
  }
}

/**
 * The name of the total, which says at the same time what it lacks. Three cases, three
 * names: complete, minimal (delivery "à partir de"), or partial (no
 * known delivery). Calling a total without delivery "coût d'acquisition"
 * would suggest a purchase cheaper than it will be.
 */
function libelleTotal(kind: PurchaseAnalysisDto['listing']['shippingKind']): string {
  if (kind === 'FROM') return 'Coût minimum estimé'
  if (kind === 'UNKNOWN') return 'Sous-total connu'
  return 'Coût d’acquisition estimé'
}

function euros(value: number | null): string {
  return value === null ? 'Non calculable' : `${formaterEuros(value)}`
}

/** Complete result of an analysis ("ANALYSER LE LOT") - verdict, price,
 * 3-price negotiation, detail per series (required for a
 * multi-series batch), global warnings and actions. Reused as
 * is by AnalysisHistoryDetailPage to review a past analysis -
 * resetLabel/resetIcon adapt the label of the last button depending on the
 * context ("Nouvelle analyse" right after analysing, "Retour à
 * l'historique" when viewing an already saved analysis). */
export function PurchaseAnalysisResultCard({
  analysis,
  onReset,
  resetLabel = 'Nouvelle analyse',
  resetIcon: ResetIcon = History,
}: {
  analysis: PurchaseAnalysisDto
  onReset: () => void
  resetLabel?: string
  resetIcon?: typeof History
}) {
  const [showOfferText, setShowOfferText] = useState(false)
  const [copied, setCopied] = useState(false)
  const { listing, negotiation } = analysis

  /**
   * The VOLUMES of the batch that can already be attached to a detail page - not the series.
   *
   * A listing offers precise volumes, and it is the volume that one wants: the
   * series is only a group (product study of 2026-08-27). A series with no
   * detailed volume in the listing therefore gives nothing here, for lack of an object to
   * designate.
   */
  const tomesDuLot: WishlistTarget[] = analysis.itemBreakdown.flatMap((entree) => {
    const entityId = entree.item.series.knownEntityId
    if (!entityId) return []
    return entree.item.includedVolumes.map((volumeNumber) => ({
      entityId,
      volumeNumber,
      edition: entree.item.editionNameRaw || undefined,
    }))
  })

  // "Batch analysis" (brainstorm) - displayed only if at least one series
  // of the batch has a duplicate, otherwise it would duplicate (no pun intended) the
  // "Prix maximum" already displayed in the negotiation block above.
  const hasAnyDuplicate = analysis.itemBreakdown.some((item) => item.duplicates.duplicateVolumeNumbers.length > 0)

  // Same hook as the detail page, the search and the scan: a single
  // add-to-wishlist behaviour in the whole app, visual feedback and undo included.
  const wishlist = useWishlist()

  const offerText =
    negotiation.recommendedOffer !== null
      ? `Bonjour, seriez-vous d'accord pour ${formaterEuros(negotiation.recommendedOffer)} pour ce lot ? Merci !`
      : ''

  async function copyOfferText() {
    try {
      await navigator.clipboard.writeText(offerText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Best-effort - some browsers/insecure contexts refuse
      // access to the clipboard, the text stays selectable manually.
    }
  }

  return (
    <div className={`flex flex-col gap-4 ${CLASSE_CARTE}`}>
      {/* The personalised verdict first: what the batch brings you, where its
          price stands, what to check. The engine's global score stays
          below - it judges the deal in absolute terms, this one judges it for
          you, and the two do not answer the same question. */}
      {analysis.assessment && (
        <ListingAssessmentCard assessment={analysis.assessment} shippingKind={listing.shippingKind} />
      )}

      <div className="flex flex-col gap-1.5">
        <VerdictBadge verdict={analysis.verdict} score={analysis.verdictScore} />
        <p className="text-xs text-textDim">
          Confiance {CONFIDENCE_LABELS[analysis.overallConfidence]} · basée sur {Object.keys(analysis.factorBreakdown).length}/10
          critères disponibles - une donnée manquante n'est jamais devinée, seulement exclue du calcul.
        </p>
      </div>

      {/* The source, and the link to reopen the listing. An analysis is a frozen
          state: if the seller changes their price or removes the listing, what is
          displayed here does not move - the link may therefore lead to a page
          that is gone, and that is normal. */}
      {listing.url && (
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-fit items-center gap-1.5 text-xs font-semibold text-accentText underline"
        >
          <ExternalLink size={12} />
          Voir l'annonce sur {LISTING_PLATFORM_LABELS[listing.platform]}
        </a>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-surface2 p-3 text-sm">
        {/* Three distinct notions, and the screen must keep them apart: the
            price of the listing (the one compared to the market, excluding fees), the
            known fees, and what the purchase will cost. When the delivery is only
            a "à partir de", this last total is a MINIMUM - calling it
            "coût réel" would suggest an amount that is billed. */}
        <span className="text-textDim">Prix de l'annonce</span>
        <span className="text-right text-textPrimary">{euros(listing.askingPrice)}</span>
        <span className="pl-3 text-xs text-textDim">Protection acheteur</span>
        <span className="text-right text-xs text-textDim">{euros(listing.buyerProtectionFee)}</span>
        <span className="pl-3 text-xs text-textDim">Livraison</span>
        <span className="text-right text-xs text-textDim">{libelleLivraison(listing)}</span>
        <span className="font-medium text-textPrimary">{libelleTotal(listing.shippingKind)}</span>
        <span className="text-right font-medium text-textPrimary">{euros(analysis.totalRealCost)}</span>
        {listing.shippingKind === 'UNKNOWN' && (
          /* Say what is missing, next to the figure: otherwise 11,20 € reads as
             the price of the purchase when delivery still has to be paid. */
          <span className="col-span-2 text-xs text-warning">Livraison non incluse : ce total est incomplet.</span>
        )}
        <span className="text-textDim">Valeur neuve</span>
        <span className="text-right text-textPrimary">{euros(analysis.totalNewValue)}</span>
        <span className="text-textDim">Décote vs neuf</span>
        <span className="text-right text-textPrimary">
          {analysis.discountPercent === null ? 'Non calculable' : `${analysis.discountPercent.toFixed(0)} %`}
        </span>
      </div>

      <div className="rounded-xl bg-surface2 p-3">
        {negotiation.advice === 'SKIP_LISTING' ? (
          /* SKIP_LISTING covers TWO situations that the engine separates by
             `priceDataAvailable`, and that do not allow the same tone: the price
             far exceeds a KNOWN estimated value (a judgement), or
             no value could be estimated at all (an absence). Making them
             identical made the screen say "Passer l'annonce" in red about a
             listing of which nothing was known - advice drawn from a void, just below
             the Prix block which had just announced "Référence
             insuffisante". */
          negotiation.priceDataAvailable ? (
            <div className="flex items-start gap-2 text-sm text-danger">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Passer l'annonce</p>
                <p className="text-xs text-textDim">{negotiation.rationale}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-sm text-textDim">
              <Info size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-textPrimary">Aucun conseil de prix possible</p>
                <p className="text-xs text-textDim">{negotiation.rationale}</p>
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-textDim">Offre conseillée</p>
                <p className="font-display text-lg font-bold text-accentText">{euros(negotiation.recommendedOffer)}</p>
              </div>
              <div>
                <p className="text-xs text-textDim">Prix cible</p>
                <p className="text-sm text-textPrimary">
                  {euros(negotiation.targetPriceMin)} - {euros(negotiation.targetPriceMax)}
                </p>
              </div>
              <div>
                <p className="text-xs text-textDim">Prix maximum</p>
                <p className="text-sm text-textPrimary">{euros(negotiation.maxPrice)}</p>
              </div>
            </div>
            <p className="text-xs text-textDim">{negotiation.rationale}</p>
          </div>
        )}
      </div>

      {hasAnyDuplicate && (
        <div className="flex items-start gap-2 rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          <span>
            Ce lot contient des tomes que tu possèdes déjà (voir le détail par série) - il reste intéressant jusqu'à{' '}
            {analysis.totalMaxWorthwhilePrice !== null
              ? `~${formaterEuros(analysis.totalMaxWorthwhilePrice)}`
              : 'un montant non calculable (prix/tome inconnu)'}
            , compte tenu des doublons.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="font-display text-sm font-semibold text-textPrimary">Détail par série</h2>
        {analysis.itemBreakdown.map((item, index) => (
          <SeriesBreakdownItem
            key={index}
            item={item}
            listing={analysis.listing}
            // requestedAt is an ISO instant on the backend - the date is enough here
            // (MarketPriceObservation.observedAt is a LocalDate).
            observedAt={analysis.requestedAt.slice(0, 10)}
          />
        ))}
      </div>

      {analysis.warnings.length > 0 && (
        <ul className="flex flex-col gap-1">
          {analysis.warnings.map((warning, index) => {
            const Icon = WARNING_ICONS[warning.severity]
            return (
              <li key={index} className="flex items-start gap-1.5 text-xs text-textDim">
                <Icon size={13} className="mt-0.5 shrink-0" />
                <span>{warning.message}</span>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowOfferText((v) => !v)}
          disabled={!offerText}
          title={!offerText ? "Pas assez de données pour proposer un montant d'offre" : undefined}
          className="btn-primaire"
        >
          Faire une offre
        </button>
        <button
          type="button"
          onClick={() => wishlist.addMany(tomesDuLot)}
          disabled={tomesDuLot.length === 0 || wishlist.isPending}
          title={
            tomesDuLot.length === 0
              ? "Aucun tome de ce lot ne se rattache à une fiche connue"
              : `Ajouter les ${tomesDuLot.length} tomes de ce lot à mes envies`
          }
          className="btn-secondaire"
        >
          <Heart size={15} />
          {tomesDuLot.length > 1 ? `Vouloir ces ${tomesDuLot.length} tomes` : 'Ajouter à mes envies'}
        </button>
        <Link
          to="/purchase-analysis/history"
          className="btn-secondaire"
        >
          <Scale size={15} />
          Comparer les annonces
        </Link>
        <button type="button" onClick={onReset} className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-textDim">
          <ResetIcon size={15} />
          {resetLabel}
        </button>
      </div>

      {showOfferText && (
        <div className="flex flex-col gap-2 rounded-xl bg-surface2 p-3">
          <textarea
            readOnly
            value={offerText}
            rows={2}
            className="champ resize-none"
          />
          <button
            type="button"
            onClick={copyOfferText}
            className="flex w-fit items-center gap-1.5 text-xs text-accentText underline"
          >
            <Copy size={12} />
            {copied ? 'Copié !' : 'Copier - à coller dans un message sur la plateforme'}
          </button>
          <p className="text-xs text-textDim">
            Phase 1 : aucune intégration de messagerie réelle - copie le texte et envoie-le toi-même sur Vinted/Leboncoin.
          </p>
        </div>
      )}
    </div>
  )
}
