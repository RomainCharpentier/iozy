import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Plus, X, ChevronRight, History } from 'lucide-react'
import { analyzeListing } from '../../api/purchaseAnalysis'
import { Chip } from '../../components/Chip'
import { ErrorBanner } from '../../components/ErrorBanner'
import {
  CONDITIONS,
  CONDITION_LABELS,
  LISTING_PLATFORMS,
  LISTING_PLATFORM_LABELS,
  type Condition,
  type ListingPlatform,
} from '../../types/purchaseAnalysis'
import { EditionReferenceLookup } from './EditionReferenceLookup'
import { PurchaseAnalysisResultCard } from './PurchaseAnalysisResultCard'

interface QueuedItem {
  seriesTitle: string
  editionName: string
  volumesText: string
  includedVolumes: number[]
}

/** Accepte "1-11", "1,2,5-9", etc. - jamais de plage inventée : un texte
 * illisible se traduit simplement par une liste vide (le bouton "+" reste
 * désactivé tant qu'aucun tome valide n'est reconnu). */
function parseVolumes(text: string): number[] {
  const result = new Set<number>()
  for (const part of text.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/)
    if (rangeMatch) {
      const from = Number(rangeMatch[1])
      const to = Number(rangeMatch[2])
      if (from > 0 && to >= from) {
        for (let v = from; v <= to; v++) result.add(v)
      }
    } else {
      const n = Number(trimmed)
      if (Number.isInteger(n) && n > 0) result.add(n)
    }
  }
  return Array.from(result).sort((a, b) => a - b)
}

/**
 * "Évaluer un achat" (Analyse d'achat) - saisie d'une annonce d'occasion
 * (aucune récupération automatique depuis une URL : ni Vinted, ni
 * Leboncoin, ni Rakuten n'offrent d'API publique exploitable pour ça) puis
 * analyse produisant un verdict, un prix conseillé/cible/maximum et un
 * détail de complétude/édition par série.
 */
export function PurchaseAnalysisPage() {
  const [platform, setPlatform] = useState<ListingPlatform>('VINTED')
  const [url, setUrl] = useState('')
  const [rawTitle, setRawTitle] = useState('')
  const [askingPrice, setAskingPrice] = useState('')
  const [shippingFee, setShippingFee] = useState('')
  const [buyerProtectionFee, setBuyerProtectionFee] = useState('')
  const [condition, setCondition] = useState<Condition>('VERY_GOOD')
  const [conditionAppliesToContainer, setConditionAppliesToContainer] = useState(false)
  // Replié par défaut - l'URL/titre ne servent qu'à retrouver l'annonce plus
  // tard, aucun des deux n'entre dans le calcul (voir "améliore l'UX" : la
  // plateforme et le prix suffisent pour démarrer, pas la peine d'afficher
  // ces deux champs d'office).
  const [showListingDetails, setShowListingDetails] = useState(false)

  const [seriesTitle, setSeriesTitle] = useState('')
  const [editionName, setEditionName] = useState('')
  const [volumesText, setVolumesText] = useState('')
  const [items, setItems] = useState<QueuedItem[]>([])

  const parsedVolumes = parseVolumes(volumesText)

  const analyzeMutation = useMutation({
    mutationFn: () =>
      analyzeListing({
        platform,
        url: url.trim() || undefined,
        rawTitle: rawTitle.trim() || `Lot ${LISTING_PLATFORM_LABELS[platform]}`,
        askingPrice: Number(askingPrice),
        shippingFee: shippingFee.trim() ? Number(shippingFee) : undefined,
        buyerProtectionFee: buyerProtectionFee.trim() ? Number(buyerProtectionFee) : undefined,
        condition,
        conditionAppliesToContainer,
        items: items.map((item) => ({
          seriesTitle: item.seriesTitle,
          editionName: item.editionName,
          includedVolumes: item.includedVolumes,
        })),
      }),
  })

  function queueItem() {
    if (!seriesTitle.trim() || !editionName.trim() || parsedVolumes.length === 0) return
    setItems((prev) => [
      ...prev,
      { seriesTitle: seriesTitle.trim(), editionName: editionName.trim(), volumesText, includedVolumes: parsedVolumes },
    ])
    setSeriesTitle('')
    setEditionName('')
    setVolumesText('')
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function resetAll() {
    analyzeMutation.reset()
    setUrl('')
    setRawTitle('')
    setAskingPrice('')
    setShippingFee('')
    setBuyerProtectionFee('')
    setItems([])
    setSeriesTitle('')
    setEditionName('')
    setVolumesText('')
    setShowListingDetails(false)
  }

  const canAnalyze = items.length > 0 && !!askingPrice.trim() && !Number.isNaN(Number(askingPrice))

  if (analyzeMutation.isSuccess) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-bold text-textPrimary">Évaluer un achat</h1>
          <Link to="/purchase-analysis/history" className="flex items-center gap-1.5 text-xs text-textDim underline">
            <History size={13} />
            Historique
          </Link>
        </div>
        <PurchaseAnalysisResultCard analysis={analyzeMutation.data} onReset={resetAll} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold text-textPrimary">Évaluer un achat</h1>
        <Link to="/purchase-analysis/history" className="flex items-center gap-1.5 text-xs text-textDim underline">
          <History size={13} />
          Historique
        </Link>
      </div>
      <p className="text-sm text-textDim">
        Aucune récupération automatique depuis une URL : ni Vinted, ni Leboncoin, ni Rakuten n'offrent d'API publique
        exploitable pour ça. Renseigne les champs ci-dessous à partir de l'annonce.
      </p>

      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-3 rounded-xl bg-surface p-3">
          <h2 className="font-display text-sm font-semibold text-textPrimary">Annonce</h2>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-textDim">Plateforme</span>
            <div className="flex gap-2">
              {LISTING_PLATFORMS.map((p) => (
                <Chip key={p} label={LISTING_PLATFORM_LABELS[p]} isActive={platform === p} onClick={() => setPlatform(p)} />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="flex min-w-[110px] flex-1 flex-col gap-1.5">
              <label className="text-xs text-textDim" htmlFor="askingPrice">
                Prix demandé (€)
              </label>
              <input
                id="askingPrice"
                type="number"
                min={0}
                step="0.01"
                value={askingPrice}
                onChange={(e) => setAskingPrice(e.target.value)}
                placeholder="ex: 216"
                className="w-full rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
            <div className="flex min-w-[110px] flex-1 flex-col gap-1.5">
              <label className="text-xs text-textDim" htmlFor="shippingFee">
                Frais de port (€)
              </label>
              <input
                id="shippingFee"
                type="number"
                min={0}
                step="0.01"
                value={shippingFee}
                onChange={(e) => setShippingFee(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
            <div className="flex min-w-[110px] flex-1 flex-col gap-1.5">
              <label className="text-xs text-textDim" htmlFor="buyerProtectionFee">
                Protection acheteur (€)
              </label>
              <input
                id="buyerProtectionFee"
                type="number"
                min={0}
                step="0.01"
                value={buyerProtectionFee}
                onChange={(e) => setBuyerProtectionFee(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
          </div>

          {showListingDetails ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-textDim" htmlFor="listingUrl">
                  URL de l'annonce (facultatif)
                </label>
                <input
                  id="listingUrl"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  className="rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-textDim" htmlFor="rawTitle">
                  Titre de l'annonce
                </label>
                <input
                  id="rawTitle"
                  value={rawTitle}
                  onChange={(e) => setRawTitle(e.target.value)}
                  placeholder="ex: Lot 20th Century Boys Perfect Edition + Sanctuary Perfect"
                  className="rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
                  autoComplete="off"
                />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowListingDetails(true)}
              className="flex w-fit items-center gap-1 text-xs text-textDim underline"
            >
              <ChevronRight size={13} />
              Ajouter l'URL et le titre de l'annonce (facultatif, pour la retrouver plus tard)
            </button>
          )}
        </section>

        <section className="flex flex-col gap-2 rounded-xl bg-surface p-3">
          <h2 className="font-display text-sm font-semibold text-textPrimary">État déclaré</h2>
          <div className="flex flex-wrap gap-2">
            {CONDITIONS.map((c) => (
              <Chip key={c} label={CONDITION_LABELS[c]} isActive={condition === c} onClick={() => setCondition(c)} />
            ))}
          </div>
          <label className="mt-1 flex items-center gap-1.5 text-xs text-textDim">
            <input
              type="checkbox"
              checked={conditionAppliesToContainer}
              onChange={(e) => setConditionAppliesToContainer(e.target.checked)}
            />
            Cet état concerne un coffret/boîtier (pèse plus lourd dans le verdict)
          </label>
        </section>

        <section className="flex flex-col gap-2 rounded-xl bg-surface p-3">
          <h2 className="font-display text-sm font-semibold text-textPrimary">Contenu du lot</h2>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-[140px] flex-1 flex-col gap-1.5">
              <label className="text-xs text-textDim" htmlFor="itemSeries">
                Série
              </label>
              <input
                id="itemSeries"
                value={seriesTitle}
                onChange={(e) => setSeriesTitle(e.target.value)}
                placeholder="ex: 20th Century Boys"
                className="w-full rounded-lg bg-surface2 px-2.5 py-1.5 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
                autoComplete="off"
              />
            </div>
            <div className="flex min-w-[140px] flex-1 flex-col gap-1.5">
              <label className="text-xs text-textDim" htmlFor="itemEdition">
                Édition
              </label>
              <input
                id="itemEdition"
                value={editionName}
                onChange={(e) => setEditionName(e.target.value)}
                placeholder="ex: Perfect Edition"
                className="w-full rounded-lg bg-surface2 px-2.5 py-1.5 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
                autoComplete="off"
              />
            </div>
            {/* Tomes + bouton restent groupés (jamais séparés par le wrap - le
                bouton valide la ligne entière, pas seulement ce champ) */}
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-textDim" htmlFor="itemVolumes">
                  Tomes
                </label>
                <input
                  id="itemVolumes"
                  value={volumesText}
                  onChange={(e) => setVolumesText(e.target.value)}
                  placeholder="1-11"
                  className="w-24 rounded-lg bg-surface2 px-2.5 py-1.5 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
                  autoComplete="off"
                />
              </div>
              <button
                type="button"
                onClick={queueItem}
                disabled={!seriesTitle.trim() || !editionName.trim() || parsedVolumes.length === 0}
                title="Ajouter cette série au lot - pratique pour enchaîner plusieurs séries avant de valider"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface2 text-textPrimary disabled:opacity-50"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <p className="text-xs text-textDim">Tomes : ex. "1-11" pour une plage, "1,3,5-9" pour plusieurs</p>

          {seriesTitle.trim() && editionName.trim() && (
            <EditionReferenceLookup seriesTitle={seriesTitle} editionName={editionName} onResolved={() => {}} />
          )}

          {items.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {items.map((item, index) => (
                <li
                  key={`${item.seriesTitle}-${item.editionName}-${index}`}
                  className="flex items-center justify-between gap-2 rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary"
                >
                  <span>
                    {item.seriesTitle} · {item.editionName} · {item.includedVolumes.length} tome
                    {item.includedVolumes.length > 1 ? 's' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    aria-label={`Retirer ${item.seriesTitle} du lot`}
                    className="text-textDim hover:text-textPrimary"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {analyzeMutation.isError && <ErrorBanner message={analyzeMutation.error.message} />}

        <button
          type="button"
          onClick={() => analyzeMutation.mutate()}
          disabled={!canAnalyze || analyzeMutation.isPending}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accentText disabled:opacity-50"
        >
          {analyzeMutation.isPending ? 'Analyse...' : 'ANALYSER LE LOT'}
        </button>
      </div>
    </div>
  )
}
