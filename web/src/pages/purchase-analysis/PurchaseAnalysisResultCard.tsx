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
 * Dit ce que vaut le montant de livraison, plutôt que d'afficher un nombre nu.
 * « 2,83 € » et « à partir de 2,83 € » ne racontent pas la même chose ; une
 * livraison illisible ne doit surtout pas ressembler à une livraison offerte ;
 * et un montant que l'utilisateur vient de saisir ne doit jamais s'afficher
 * « non communiquée » - il vient précisément d'être communiqué.
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
 * Le nom du total, qui dit du même coup ce qui lui manque. Trois cas, trois
 * noms : complet, minimal (livraison « à partir de »), ou partiel (aucune
 * livraison connue). Appeler « coût d'acquisition » un total sans livraison
 * ferait croire à un achat moins cher qu'il ne sera.
 */
function libelleTotal(kind: PurchaseAnalysisDto['listing']['shippingKind']): string {
  if (kind === 'FROM') return 'Coût minimum estimé'
  if (kind === 'UNKNOWN') return 'Sous-total connu'
  return 'Coût d’acquisition estimé'
}

function euros(value: number | null): string {
  return value === null ? 'Non calculable' : `${formaterEuros(value)}`
}

/** Résultat complet d'une analyse ("ANALYSER LE LOT") - verdict, prix,
 * négociation à 3 prix, détail par série (obligatoire pour un lot
 * multi-séries), avertissements globaux et actions. Réutilisée telle
 * quelle par AnalysisHistoryDetailPage pour revoir une analyse passée -
 * resetLabel/resetIcon adaptent le libellé du dernier bouton selon le
 * contexte ("Nouvelle analyse" juste après avoir analysé, "Retour à
 * l'historique" en consultant une analyse déjà enregistrée). */
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
   * Les TOMES du lot déjà rattachables à une fiche - pas les séries.
   *
   * Une annonce propose des tomes précis, et c'est le tome qui se veut : la
   * série n'est qu'un groupe (étude produit du 2026-08-27). Une série sans
   * tome détaillé dans l'annonce ne donne donc rien ici, faute d'objet à
   * désigner.
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

  // "Analyse d'un lot" (brainstorm) - affiché seulement si au moins une série
  // du lot a un doublon, sinon ça ferait doublon (sans jeu de mots) avec le
  // "Prix maximum" déjà affiché dans le bloc négociation ci-dessus.
  const hasAnyDuplicate = analysis.itemBreakdown.some((item) => item.duplicates.duplicateVolumeNumbers.length > 0)

  // Même hook que la fiche, la recherche et le scan : un seul comportement
  // d'ajout aux envies dans toute l'app, retour visuel et annulation compris.
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
      // Best-effort - certains navigateurs/contextes non sécurisés refusent
      // l'accès au presse-papier, le texte reste sélectionnable manuellement.
    }
  }

  return (
    <div className={`flex flex-col gap-4 ${CLASSE_CARTE}`}>
      {/* Le verdict personnalise d'abord : ce que le lot t'apporte, ou se situe
          son prix, ce qu'il faut verifier. Le score global du moteur reste
          en dessous - il juge l'affaire dans l'absolu, celui-ci la juge pour
          toi, et les deux ne repondent pas a la meme question. */}
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

      {/* La source, et le lien pour rouvrir l'annonce. Une analyse est un état
          figé : si le vendeur change son prix ou retire l'annonce, ce qui est
          affiché ici ne bouge pas - le lien peut donc mener à une page
          disparue, et c'est normal. */}
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
        {/* Trois notions distinctes, et l'écran doit les tenir séparées : le
            prix de l'annonce (celui qui se compare au marché, hors frais), les
            frais connus, et ce que l'achat coûtera. Quand la livraison n'est
            qu'un « à partir de », ce dernier total est un MINIMUM - l'appeler
            « coût réel » laisserait croire à un montant facturé. */}
        <span className="text-textDim">Prix de l'annonce</span>
        <span className="text-right text-textPrimary">{euros(listing.askingPrice)}</span>
        <span className="pl-3 text-xs text-textDim">Protection acheteur</span>
        <span className="text-right text-xs text-textDim">{euros(listing.buyerProtectionFee)}</span>
        <span className="pl-3 text-xs text-textDim">Livraison</span>
        <span className="text-right text-xs text-textDim">{libelleLivraison(listing)}</span>
        <span className="font-medium text-textPrimary">{libelleTotal(listing.shippingKind)}</span>
        <span className="text-right font-medium text-textPrimary">{euros(analysis.totalRealCost)}</span>
        {listing.shippingKind === 'UNKNOWN' && (
          /* Dire ce qui manque, à côté du chiffre : sinon 11,20 € se lit comme
             le prix de l'achat alors qu'il faudra encore payer la livraison. */
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
          /* SKIP_LISTING recouvre DEUX situations que le moteur sépare par
             `priceDataAvailable`, et qui n'autorisent pas le même ton : le prix
             dépasse très largement une valeur estimée CONNUE (un jugement), ou
             aucune valeur n'a pu être estimée du tout (une absence). Les rendre
             identiques faisait dire « Passer l'annonce » en rouge à propos d'une
             annonce dont on ne savait rien - un conseil tiré d'un vide, juste en
             dessous du bloc Prix qui venait d'annoncer « Référence
             insuffisante ». */
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
            // requestedAt est un instant ISO côté backend - la date suffit ici
            // (MarketPriceObservation.observedAt est un LocalDate).
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
