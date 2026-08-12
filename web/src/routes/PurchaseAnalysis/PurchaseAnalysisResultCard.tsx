import { useState } from 'react'
import { Copy, Heart, History, TriangleAlert, Info, CircleX } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addToWishlist } from '../../api/wishlist'
import { queryKeys } from '../../lib/queryKeys'
import { VerdictBadge } from './VerdictBadge'
import { SeriesBreakdownItem } from './SeriesBreakdownItem'
import type { PurchaseAnalysisDto, WarningSeverity } from '../../types/purchaseAnalysis'

const CONFIDENCE_LABELS = { HIGH: 'Haute', MEDIUM: 'Moyenne', LOW: 'Faible' } as const

const WARNING_ICONS: Record<WarningSeverity, typeof Info> = { INFO: Info, CAUTION: TriangleAlert, CRITICAL: CircleX }

function euros(value: number | null): string {
  return value === null ? 'Non calculable' : `${value.toFixed(2)} €`
}

/** Résultat complet d'une analyse ("ANALYSER LE LOT") - verdict, prix,
 * négociation à 3 prix, détail par série (obligatoire pour un lot
 * multi-séries), avertissements globaux et actions. */
export function PurchaseAnalysisResultCard({ analysis, onReset }: { analysis: PurchaseAnalysisDto; onReset: () => void }) {
  const queryClient = useQueryClient()
  const [showOfferText, setShowOfferText] = useState(false)
  const [copied, setCopied] = useState(false)
  const { listing, negotiation } = analysis

  const knownEntityIds = analysis.itemBreakdown
    .map((item) => item.item.series.knownEntityId)
    .filter((id): id is string => !!id)

  // "Analyse d'un lot" (brainstorm) - affiché seulement si au moins une série
  // du lot a un doublon, sinon ça ferait doublon (sans jeu de mots) avec le
  // "Prix maximum" déjà affiché dans le bloc négociation ci-dessus.
  const hasAnyDuplicate = analysis.itemBreakdown.some((item) => item.duplicates.duplicateVolumeNumbers.length > 0)

  const wishlistMutation = useMutation({
    mutationFn: (entityId: string) => addToWishlist(entityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wishlist.all })
    },
  })

  const offerText =
    negotiation.recommendedOffer !== null
      ? `Bonjour, seriez-vous d'accord pour ${negotiation.recommendedOffer.toFixed(2)} € pour ce lot ? Merci !`
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
    <div className="flex flex-col gap-4 rounded-2xl bg-surface p-4">
      <div className="flex flex-col gap-1.5">
        <VerdictBadge verdict={analysis.verdict} score={analysis.verdictScore} />
        <p className="text-xs text-textDim">
          Confiance {CONFIDENCE_LABELS[analysis.overallConfidence]} · basée sur {Object.keys(analysis.factorBreakdown).length}/10
          critères disponibles - une donnée manquante n'est jamais devinée, seulement exclue du calcul.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-surface2 p-3 text-sm">
        <span className="text-textDim">Prix affiché</span>
        <span className="text-right text-textPrimary">{euros(listing.askingPrice)}</span>
        <span className="text-textDim">Frais (port + protection)</span>
        <span className="text-right text-textPrimary">
          {euros(listing.shippingFee + listing.buyerProtectionFee)}
        </span>
        <span className="font-medium text-textPrimary">Coût réel estimé</span>
        <span className="text-right font-medium text-textPrimary">{euros(analysis.totalRealCost)}</span>
        <span className="text-textDim">Valeur neuve</span>
        <span className="text-right text-textPrimary">{euros(analysis.totalNewValue)}</span>
        <span className="text-textDim">Décote vs neuf</span>
        <span className="text-right text-textPrimary">
          {analysis.discountPercent === null ? 'Non calculable' : `${analysis.discountPercent.toFixed(0)} %`}
        </span>
      </div>

      <div className="rounded-xl bg-surface2 p-3">
        {negotiation.advice === 'SKIP_LISTING' ? (
          <div className="flex items-start gap-2 text-sm text-danger">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Passer l'annonce</p>
              <p className="text-xs text-textDim">{negotiation.rationale}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-textDim">Offre conseillée</p>
                <p className="font-display text-lg font-bold text-accent">{euros(negotiation.recommendedOffer)}</p>
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
              ? `~${analysis.totalMaxWorthwhilePrice.toFixed(2)} €`
              : 'un montant non calculable (prix/tome inconnu)'}
            , compte tenu des doublons.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="font-display text-sm font-semibold text-textPrimary">Détail par série</h2>
        {analysis.itemBreakdown.map((item, index) => (
          <SeriesBreakdownItem key={index} item={item} />
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
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accentText disabled:opacity-50"
        >
          Faire une offre
        </button>
        <button
          type="button"
          onClick={() => knownEntityIds.forEach((id) => wishlistMutation.mutate(id))}
          disabled={knownEntityIds.length === 0 || wishlistMutation.isPending}
          title={knownEntityIds.length === 0 ? "Aucune série de ce lot n'est encore dans ta collection/wishlist" : undefined}
          className="flex items-center gap-1.5 rounded-lg bg-surface2 px-3 py-2 text-sm font-medium text-textPrimary disabled:opacity-50"
        >
          <Heart size={15} />
          Ajouter à ma wishlist
        </button>
        <button type="button" onClick={onReset} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-textDim">
          <History size={15} />
          Nouvelle analyse
        </button>
      </div>

      {showOfferText && (
        <div className="flex flex-col gap-2 rounded-xl bg-surface2 p-3">
          <textarea
            readOnly
            value={offerText}
            rows={2}
            className="resize-none rounded-lg bg-surface p-2 text-sm text-textPrimary focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <button
            type="button"
            onClick={copyOfferText}
            className="flex w-fit items-center gap-1.5 text-xs text-accent underline"
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
