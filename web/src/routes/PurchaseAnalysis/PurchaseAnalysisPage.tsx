import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Plus, X, History } from 'lucide-react'
import { analyzeListing } from '../../api/purchaseAnalysis'
import { ListingUrlField, ListingPhotos } from './ListingUrlField'
import { Chip } from '../../components/Chip'
import { ErrorBanner } from '../../components/ErrorBanner'
import {
  CONDITIONS,
  CONDITION_LABELS,
  LISTING_PLATFORMS,
  LISTING_PLATFORM_LABELS,
  type Condition,
  type ListingPlatform,
  type ListingPreviewDto,
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
 * "Évaluer un achat" (Analyse d'achat) - saisie d'une annonce d'occasion puis
 * analyse produisant un verdict, un prix conseillé/cible/maximum et un détail
 * de complétude/édition par série.
 *
 * **Coller un lien d'annonce pré-remplit le brouillon** (voir ListingUrlField).
 * Le lien ne servait auparavant qu'à retrouver l'annonce plus tard ; il est
 * désormais lu — titre, prix, description, photos — pour n'avoir à saisir que
 * ce qui manque. Trois garde-fous encadrent ce pré-remplissage :
 * - seuls les champs RÉELLEMENT lus sont remplis : un prix que la source ne
 *   donne pas reste vide, jamais supposé ;
 * - une valeur déjà saisie n'est jamais écrasée, et la divergence est annoncée ;
 * - un échec (plateforme inconnue, annonce supprimée, source indisponible) ne
 *   bloque rien : la saisie manuelle est le parcours normal, pas un repli
 *   dégradé.
 *
 * Ce qui est calculé ensuite ne change pas d'un iota : le lien alimente le
 * brouillon, il ne double aucune logique d'analyse.
 */
export function PurchaseAnalysisPage() {
  // Contexte optionnel passé par la fiche d'une série (voir EntityDetailPage) -
  // absent quand on arrive par Rechercher, par Profil, ou par URL directe.
  const fromEntity = useLocation().state as { seriesTitle?: string; editionName?: string } | null

  const [platform, setPlatform] = useState<ListingPlatform>('VINTED')
  const [url, setUrl] = useState('')
  const [rawTitle, setRawTitle] = useState('')
  const [askingPrice, setAskingPrice] = useState('')
  const [shippingFee, setShippingFee] = useState('')
  const [buyerProtectionFee, setBuyerProtectionFee] = useState('')
  const [condition, setCondition] = useState<Condition>('VERY_GOOD')
  const [conditionAppliesToContainer, setConditionAppliesToContainer] = useState(false)
  // Photos lues sur l'annonce - conservées avec l'analyse enregistrée, et
  // retirables une à une avant de lancer le calcul.
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  // Champs que l'utilisateur a modifiés lui-même : ce sont les seuls que le
  // pré-remplissage n'a pas le droit de toucher (voir appliquerPreview).
  const [saisisParUtilisateur, setSaisisParUtilisateur] = useState<Set<string>>(new Set())

  function marquerSaisi(champ: string) {
    setSaisisParUtilisateur((prev) => (prev.has(champ) ? prev : new Set(prev).add(champ)))
  }

  /**
   * Reporte dans le formulaire ce que l'annonce a livré.
   *
   * Règle simple et sans surprise : un champ vide et non touché est
   * pré-rempli ; un champ que l'utilisateur a rempli lui-même est CONSERVÉ, et
   * son nom est renvoyé pour que l'écart avec l'annonce soit dit à l'écran
   * plutôt que subi en silence. Les champs absents de `retrievedFields` ne sont
   * jamais devinés.
   */
  function appliquerPreview(preview: ListingPreviewDto): { conserves: string[] } {
    const conserves: string[] = []
    const appliquer = (champ: string, libelle: string, valeurActuelle: string, valeurLue: string,
                        appliquerValeur: (v: string) => void) => {
      if (!valeurLue) return
      const dejaRempli = valeurActuelle.trim().length > 0
      if (dejaRempli || saisisParUtilisateur.has(champ)) {
        if (valeurActuelle.trim() !== valeurLue.trim()) conserves.push(libelle)
        return
      }
      appliquerValeur(valeurLue)
    }

    if (preview.title) appliquer('rawTitle', 'le titre', rawTitle, preview.title, setRawTitle)
    if (preview.price !== null) {
      appliquer('askingPrice', 'le prix', askingPrice, String(preview.price), setAskingPrice)
    }
    if (preview.description) {
      appliquer('description', 'la description', description, preview.description, setDescription)
    }
    // Les frais sont annoncés par l'annonce elle-même : les laisser à saisir
    // alors qu'ils sont lisibles rendait le coût réel faux par défaut (0 €),
    // et donc le verdict trop favorable.
    if (preview.shippingFee !== null) {
      appliquer('shippingFee', 'les frais de port', shippingFee, String(preview.shippingFee), setShippingFee)
    }
    if (preview.buyerProtectionFee !== null) {
      appliquer('buyerProtectionFee', 'la protection acheteur', buyerProtectionFee,
        String(preview.buyerProtectionFee), setBuyerProtectionFee)
    }
    // Les photos ne remplacent jamais une sélection en cours : elles s'ajoutent
    // à ce qui est déjà là, sans doublon.
    if (preview.imageUrls.length > 0) {
      setPhotoUrls((prev) => Array.from(new Set([...prev, ...preview.imageUrls])))
    }
    // La plateforme suit la source détectée tant que l'utilisateur ne l'a pas
    // choisie lui-même - c'est un fait constaté, pas une supposition.
    if (preview.source !== 'OTHER' && !saisisParUtilisateur.has('platform')) {
      setPlatform(preview.source)
    }
    if (preview.url) setUrl(preview.url)
    return { conserves }
  }

  // Description de l'annonce : lue sur la source quand elle existe, saisissable
  // sinon. Elle ne rentre dans aucun calcul - elle sert à relire ce que le
  // vendeur annonçait, notamment ce que les photos ne montrent pas.
  const [description, setDescription] = useState('')

  // Pré-remplissage quand on arrive depuis la fiche d'une série (voir
  // EntityDetailPage, "Évaluer une annonce de cette série") - simple valeur
  // initiale, jamais un champ verrouillé : le lot d'une annonce contient
  // souvent d'autres séries, qu'on ajoute ensuite normalement.
  const [seriesTitle, setSeriesTitle] = useState(fromEntity?.seriesTitle ?? '')
  const [editionName, setEditionName] = useState(fromEntity?.editionName ?? '')
  const [volumesText, setVolumesText] = useState('')
  const [items, setItems] = useState<QueuedItem[]>([])

  const parsedVolumes = parseVolumes(volumesText)

  const analyzeMutation = useMutation({
    mutationFn: () =>
      analyzeListing({
        platform,
        url: url.trim() || undefined,
        rawTitle: rawTitle.trim() || `Lot ${LISTING_PLATFORM_LABELS[platform]}`,
        // La description alimente les points de vigilance (paiement hors
        // plateforme, texte trop court). Elle etait saisie mais jamais envoyee.
        description: description.trim() || undefined,
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
        // Conservées avec l'analyse : celle-ci est l'état de l'annonce à
        // l'instant où elle a été lue, et le reste même si le vendeur la
        // modifie ou la retire ensuite.
        photoUrls,
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
    setDescription('')
    setPhotoUrls([])
    setSaisisParUtilisateur(new Set())
    setAskingPrice('')
    setShippingFee('')
    setBuyerProtectionFee('')
    setItems([])
    setSeriesTitle('')
    setEditionName('')
    setVolumesText('')
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
        Colle le lien d'une annonce Vinted pour en récupérer le titre, le prix, la description et les photos — ou
        renseigne tout à la main. Ce qui n'a pas pu être lu reste simplement à compléter.
      </p>

      <ListingUrlField
        url={url}
        onUrlChange={(v) => setUrl(v)}
        onResolved={appliquerPreview}
      />

      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-3 rounded-xl bg-surface p-3">
          <h2 className="font-display text-sm font-semibold text-textPrimary">Annonce</h2>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-textDim">Plateforme</span>
            <div className="flex gap-2">
              {LISTING_PLATFORMS.map((p) => (
                <Chip
                  key={p}
                  label={LISTING_PLATFORM_LABELS[p]}
                  isActive={platform === p}
                  onClick={() => {
                    marquerSaisi('platform')
                    setPlatform(p)
                  }}
                />
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
                onChange={(e) => {
                  marquerSaisi('askingPrice')
                  setAskingPrice(e.target.value)
                }}
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
                onChange={(e) => {
                  marquerSaisi('shippingFee')
                  setShippingFee(e.target.value)
                }}
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
                onChange={(e) => {
                  marquerSaisi('buyerProtectionFee')
                  setBuyerProtectionFee(e.target.value)
                }}
                placeholder="0"
                className="w-full rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
          </div>

          {/* Titre et description : pré-remplis quand l'annonce a pu être lue,
              saisissables sinon. Affichés en permanence plutôt que repliés -
              ils portent désormais du contenu récupéré, qu'il faut pouvoir
              relire et corriger avant d'analyser. */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-textDim" htmlFor="rawTitle">
                Titre de l'annonce
              </label>
              <input
                id="rawTitle"
                value={rawTitle}
                onChange={(e) => {
                  marquerSaisi('rawTitle')
                  setRawTitle(e.target.value)
                }}
                placeholder="ex: Lot 20th Century Boys Perfect Edition + Sanctuary Perfect"
                className="rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-textDim" htmlFor="listingDescription">
                Description de l'annonce (facultatif)
              </label>
              <textarea
                id="listingDescription"
                value={description}
                onChange={(e) => {
                  marquerSaisi('description')
                  setDescription(e.target.value)
                }}
                rows={3}
                placeholder="Ce que le vendeur décrit (état, tomes inclus, éditions…)"
                className="rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
            <ListingPhotos
              imageUrls={photoUrls}
              onRemove={(imageUrl) => setPhotoUrls((prev) => prev.filter((u) => u !== imageUrl))}
            />
          </div>
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
                // aria-label court pour l'annonce, title long pour l'infobulle :
                // le title est le DERNIER recours de l'algorithme accname (et
                // n'existe pas au doigt), il ne doit pas rester seul à nommer
                // un bouton en icône seule - voir Lot 29.
                aria-label="Ajouter cette série au lot"
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
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accentInk disabled:opacity-50"
        >
          {analyzeMutation.isPending ? 'Analyse...' : 'ANALYSER LE LOT'}
        </button>
      </div>
    </div>
  )
}
