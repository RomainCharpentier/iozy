import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Plus, History } from 'lucide-react'
import { analyzeListing } from '@/common/api/purchaseAnalysis'
import { ListingUrlField, ListingPhotos } from './ListingUrlField'
import { Chip } from '@/common/components/Chip'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import {
  CONDITIONS,
  CONDITION_LABELS,
  LISTING_PLATFORMS,
  LISTING_PLATFORM_LABELS,
  type Condition,
  type ListingPlatform,
  type ListingPreviewDto,
  type ShippingEstimateKind,
} from '@/common/types/purchaseAnalysis'
import { EditionReferenceLookup } from './EditionReferenceLookup'
import { ListingDetectionPanel, type ElementConfirme } from './ListingDetectionPanel'
import { EDITION_INCONNUE } from './EditionPicker'
import { EditionStatusRow } from './EditionStatusRow'
import { ListingSummaryCard } from './ListingSummaryCard'
import { LotContentList } from './LotContentList'
import { PurchaseAnalysisResultCard } from './PurchaseAnalysisResultCard'
import { EnTeteSection } from '@/common/components/EnTeteSection'
import { LienRetour } from '@/common/components/LienRetour'
import { formaterEuros } from '@/common/lib/formats'

/**
 * Where we come back from: Découvrir, which carries the door to this screen since
 * batch 137, or the series when we arrive from its detail page (it names its return).
 * The screen used to be a navigation destination, with no return to offer;
 * it no longer is, and it is a manga flow that the bar does not name.
 */
const RETOUR_PAR_DEFAUT = { to: '/discover', libelle: 'Découvrir' }

interface QueuedItem {
  seriesTitle: string
  editionName: string
  volumesText: string
  includedVolumes: number[]
}

/** Accepts "1-11", "1,2,5-9", etc. - never an invented range: an
 * unreadable text simply becomes an empty list (the "+" button stays
 * disabled as long as no valid volume is recognised). */
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
 * "Analyse a listing" - entry of a second-hand listing then
 * analysis producing a verdict, a recommended/target/maximum price and a
 * completeness/edition detail per series.
 *
 * **Pasting a listing link pre-fills the draft** (see ListingUrlField).
 * The link used to only serve to find the listing again later; it is
 * now read — title, price, description, photos — so that only what is
 * missing has to be entered. Three safeguards frame this pre-fill:
 * - only the fields REALLY read are filled in: a price that the source does not
 *   give stays empty, never assumed;
 * - a value already entered is never overwritten, and the divergence is announced;
 * - a failure (unknown platform, deleted listing, unavailable source) does not
 *   block anything: manual entry is the normal flow, not a degraded
 *   fallback.
 *
 * What is computed afterwards does not change one bit: the link feeds the
 * draft, it does not duplicate any analysis logic.
 */
export function PurchaseAnalysisPage() {
  // Optional context passed by the detail page of a series (see EntityDetailPage) -
  // missing when we arrive through Search, through Profil, or by direct URL.
  const fromEntity = useLocation().state as { seriesTitle?: string; editionName?: string } | null

  const [platform, setPlatform] = useState<ListingPlatform>('VINTED')
  const [url, setUrl] = useState('')
  const [rawTitle, setRawTitle] = useState('')
  const [askingPrice, setAskingPrice] = useState('')
  const [shippingFee, setShippingFee] = useState('')
  const [buyerProtectionFee, setBuyerProtectionFee] = useState('')
  const [condition, setCondition] = useState<Condition>('VERY_GOOD')
  const [conditionAppliesToContainer, setConditionAppliesToContainer] = useState(false)
  // Photos read from the listing - kept with the saved analysis, and
  // removable one by one before launching the calculation.
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  // What the retained shipping amount is worth. A manual entry is ESTIMATED:
  // the amount is known without being guaranteed - classing it unknown would make the screen say
  // "livraison non communiquée" right after the user has communicated it.
  const [shippingKind, setShippingKind] = useState<ShippingEstimateKind>('UNKNOWN')
  // Identifier of the listing at the source, when reading the link gave it.
  const [externalListingId, setExternalListingId] = useState('')
  // Fields that the user modified themselves: they are the only ones that the
  // pre-fill has no right to touch (see appliquerPreview).
  const [saisisParUtilisateur, setSaisisParUtilisateur] = useState<Set<string>>(new Set())

  function marquerSaisi(champ: string) {
    setSaisisParUtilisateur((prev) => (prev.has(champ) ? prev : new Set(prev).add(champ)))
  }

  /**
   * Carries into the form what the listing delivered.
   *
   * Simple rule with no surprise: an empty, untouched field is
   * pre-filled; a field that the user filled in themselves is KEPT, and
   * its name is returned so that the gap with the listing is said on screen
   * rather than suffered in silence. The fields missing from `retrievedFields` are
   * never guessed.
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
    // The fees are announced by the listing itself: leaving them to be entered
    // while they are readable made the real cost wrong by default (0 €),
    // and so the verdict too favourable.
    if (preview.shippingFee !== null) {
      appliquer('shippingFee', 'les frais de port', shippingFee, String(preview.shippingFee), setShippingFee)
      // The nature follows the amount: without it, "à partir de 2,83 €" would
      // be read as a firm rate.
      if (!saisisParUtilisateur.has('shippingFee') && !shippingFee.trim()) {
        setShippingKind(preview.shippingKind)
      }
    }
    if (preview.buyerProtectionFee !== null) {
      appliquer('buyerProtectionFee', 'la protection acheteur', buyerProtectionFee,
        String(preview.buyerProtectionFee), setBuyerProtectionFee)
    }
    // The photos never replace a selection in progress: they are added
    // to what is already there, without duplicates.
    if (preview.imageUrls.length > 0) {
      setPhotoUrls((prev) => Array.from(new Set([...prev, ...preview.imageUrls])))
    }
    // The platform follows the detected source as long as the user has not
    // chosen it themselves - it is an observed fact, not an assumption.
    if (preview.source !== 'OTHER' && !saisisParUtilisateur.has('platform')) {
      setPlatform(preview.source)
    }
    if (preview.url) setUrl(preview.url)
    // Kept as is: it is displayed nowhere and enters no calculation.
    // It only serves to recognise two analyses of the same listing.
    setExternalListingId(preview.externalId ?? '')
    // The listing has spoken: its technical fields fold behind a
    // summary. They stay correctable, but no longer block the path of
    // someone with nothing to correct.
    if (preview.retrievedFields.length > 0) {
      setInfosDepliees(false)
    }
    return { conserves }
  }

  // Description of the listing: read from the source when it exists, enterable
  // otherwise. It enters no calculation - it serves to reread what the
  // seller announced, notably what the photos do not show.
  const [description, setDescription] = useState('')

  // Pre-fill when we arrive from the detail page of a series (see
  // EntityDetailPage, "Évaluer une annonce de cette série") - a simple initial
  // value, never a locked field: the batch of a listing often contains
  // other series, which are then added normally.
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
        // The description feeds the warning points (payment outside
        // the platform, text too short). It was entered but never sent.
        description: description.trim() || undefined,
        askingPrice: Number(askingPrice),
        shippingFee: shippingFee.trim() ? Number(shippingFee) : undefined,
        shippingKind,
        buyerProtectionFee: buyerProtectionFee.trim() ? Number(buyerProtectionFee) : undefined,
        condition,
        conditionAppliesToContainer,
        items: itemsAAnalyser.map((item) => ({
          seriesTitle: item.seriesTitle,
          editionName: item.editionName,
          includedVolumes: item.includedVolumes,
        })),
        // Kept with the analysis: it is the state of the listing at the
        // moment it was read, and it stays so even if the seller
        // changes or removes it afterwards.
        photoUrls,
        externalListingId: externalListingId.trim() || undefined,
      }),
  })

  function queueItem() {
    if (!seriesTitle.trim() || parsedVolumes.length === 0) return
    setItems((prev) => [
      ...prev,
      {
        seriesTitle: seriesTitle.trim(),
        editionName: editionName.trim() || EDITION_INCONNUE,
        volumesText,
        includedVolumes: parsedVolumes,
      },
    ])
    setSeriesTitle('')
    setEditionName('')
    setVolumesText('')
  }

  /**
   * Adds to the draft the items that the user has just confirmed
   * in the detected list.
   *
   * Groups by series + edition: the recognition returns one item per volume,
   * whereas the analysis reasons in batches. Merges with a batch already present
   * rather than creating a duplicate, and never adds the same
   * volume twice — a volume seen on three photos was already consolidated on the server,
   * but the user may also have entered it by hand just before.
   */
  function confirmerElementsReconnus(elements: ElementConfirme[]) {
    if (elements.length === 0) return
    setItems((prev) => {
      const suivant = prev.map((item) => ({ ...item, includedVolumes: [...item.includedVolumes] }))
      for (const element of elements) {
        const existant = suivant.find(
          (item) =>
            item.seriesTitle.toLowerCase() === element.seriesTitle.toLowerCase() &&
            item.editionName.toLowerCase() === element.editionName.toLowerCase(),
        )
        if (existant) {
          if (!existant.includedVolumes.includes(element.volumeNumber)) {
            existant.includedVolumes.push(element.volumeNumber)
          }
        } else {
          suivant.push({
            seriesTitle: element.seriesTitle,
            editionName: element.editionName,
            volumesText: String(element.volumeNumber),
            includedVolumes: [element.volumeNumber],
          })
        }
      }
      // Volumes sorted and text rebuilt: the batch must read simply.
      return suivant.map((item) => {
        const tomes = [...item.includedVolumes].sort((a, b) => a - b)
        return { ...item, includedVolumes: tomes, volumesText: tomes.join(', ') }
      })
    })

    // The visual feedback is handled by an effect, after React's commit:
    // calling focus() here would target a node that the next render will replace.
    setElementsAJusteAjoutes(elements.length)
  }

  /**
   * Brings the user to the result when items have just entered
   * the batch.
   *
   * The main change is in the page, not in a banner: rather
   * than a toast that disappears, we show the place where the items went.
   * Nothing moves if the list is already in view - a needless scroll
   * disorients more than it helps.
   */
  /**
   * Are the technical fields of the listing unfolded?
   *
   * <b>Closed at first</b>, and reopened on request. They used to be closed
   * as soon as a URL had been read - which only solved half of the
   * problem: on a blank form, the six fields stayed open and
   * the screen was 2.2 screen heights for 25 controls, before
   * the user had entered anything.
   *
   * <p>Yet none of these six fields is required except the price, and all are
   * filled in automatically as soon as a link is pasted - the intended flow. Keeping
   * them open just in case made everyone pay for the comfort of the
   * manual flow.
   */
  const [infosDepliees, setInfosDepliees] = useState(false)

  /** Is the declared condition open? Closed at first: it has a sensible default. */
  const [etatDeplie, setEtatDeplie] = useState(false)

  /** Nothing of the listing has been entered or read yet - the very first screen. */
  const rienDeSaisi =
    !rawTitle.trim() && !askingPrice.trim() && !shippingFee.trim()
    && !buyerProtectionFee.trim() && !description.trim() && photoUrls.length === 0

  /**
   * The cost displayed under the button, with the name that its completeness allows.
   *
   * Takes the rule of {@code PurchaseAnalysisResultCard} rather than inventing
   * one: an unknown shipping is never worth zero, and calling an amount without delivery
   * "coût total" would suggest a purchase cheaper
   * than it will be.
   */
  const recapitulatifCout = (() => {
    const prix = Number(askingPrice)
    if (!askingPrice.trim() || Number.isNaN(prix)) return null
    const port = shippingFee.trim() ? Number(shippingFee) : 0
    const protection = buyerProtectionFee.trim() ? Number(buyerProtectionFee) : 0
    const total = formaterEuros(prix + port + protection)
    if (shippingKind === 'UNKNOWN') return `sous-total connu ${total}`
    if (shippingKind === 'FROM') return `coût minimum ${total}`
    return `coût estimé ${total}`
  })()

  const titreLotRef = useRef<HTMLHeadingElement>(null)
  const [elementsAJusteAjoutes, setElementsAJusteAjoutes] = useState(0)
  useEffect(() => {
    if (elementsAJusteAjoutes === 0) return
    const titre = titreLotRef.current
    if (titre) {
      const rect = titre.getBoundingClientRect()
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        const doux = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
        titre.scrollIntoView({ behavior: doux, block: 'center' })
      }
      // The focus announces the arrival to screen readers, which the scroll
      // would leave silent.
      titre.focus({ preventScroll: true })
    }
    const minuteur = setTimeout(() => setElementsAJusteAjoutes(0), 4000)
    return () => clearTimeout(minuteur)
  }, [elementsAJusteAjoutes])

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function resetAll() {
    analyzeMutation.reset()
    setUrl('')
    setRawTitle('')
    setDescription('')
    setPhotoUrls([])
    setShippingKind('UNKNOWN')
    setSaisisParUtilisateur(new Set())
    setAskingPrice('')
    setShippingFee('')
    setBuyerProtectionFee('')
    setItems([])
    setSeriesTitle('')
    setEditionName('')
    setVolumesText('')
  }

  /**
   * The row being entered, if it is complete.
   *
   * It counts in the batch without needing to press "+". Before, filling in
   * Series / Edition / Volumes then aiming at "ANALYSER LE LOT" left the button
   * greyed out without a word of explanation: the "+" was a required step that nothing
   * announced. It now only serves to chain an ADDITIONAL series.
   */
  const ligneEnCours: QueuedItem | null =
    seriesTitle.trim() && parsedVolumes.length > 0
      ? {
          seriesTitle: seriesTitle.trim(),
          // The edition is no longer a condition: not knowing it is a
          // legitimate state, which the engine knows how to handle (unknown completeness,
          // new value unavailable). Requiring it forced users to invent one -
          // and an invented label can match ANOTHER edition BY ACCIDENT,
          // skewing the market reference without signalling anything.
          editionName: editionName.trim() || EDITION_INCONNUE,
          volumesText,
          includedVolumes: parsedVolumes,
        }
      : null

  const itemsAAnalyser = ligneEnCours ? [...items, ligneEnCours] : items

  /**
   * The count speaks in VOLUMES, not in rows.
   *
   * The batch is modelled by series + edition, with a set of volumes: "Hell's
   * Paradise 6-10" is ONE row. Announcing "1 élément" for five books
   * would be exact from the point of view of the model and wrong from the point of view of
   * the buyer, who pays for five volumes.
   */
  const nombreElementsDuLot = itemsAAnalyser.reduce((total, item) => total + item.includedVolumes.length, 0)

  /**
   * True if this volume is already in the batch.
   *
   * Serves the detection panel to mark "Ajouté au lot" rather than
   * letting a proposal look pending when it is already taken
   * into account - and to prevent confirming it a second time.
   */
  /**
   * The listing names a series but not its volumes ("9 tomes de Naruto"):
   * we take the name that was read and put the cursor on the only box still empty.
   * The "Tomes" field is NOT pre-filled - deducing "1-9" from a simple
   * count would invent precisely what the backend refuses to invent.
   */
  function prefillSerieAnnoncee(titre: string) {
    setSeriesTitle(titre)
    // After the render, otherwise the focus goes to a field that React has not
    // yet reconciled (seen on the confirmation of items, Batch 31).
    setPrefillDemande(true)
  }

  const [prefillDemande, setPrefillDemande] = useState(false)
  const champTomesRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!prefillDemande) return
    champTomesRef.current?.focus()
    setPrefillDemande(false)
  }, [prefillDemande])

  function dejaDansLeLot(seriesTitle: string, editionName: string, volumeNumber: number): boolean {
    return itemsAAnalyser.some(
      (item) =>
        item.seriesTitle.toLowerCase() === seriesTitle.toLowerCase() &&
        item.editionName.toLowerCase() === editionName.toLowerCase() &&
        item.includedVolumes.includes(volumeNumber),
    )
  }

  const prixRenseigne = !!askingPrice.trim() && !Number.isNaN(Number(askingPrice))
  const canAnalyze = itemsAAnalyser.length > 0 && prixRenseigne

  /**
   * What is missing to evaluate - said, rather than left to guess.
   *
   * NEVER talks about the edition: not knowing it does not prevent evaluating a
   * batch, and displaying it as a block would bring back the obligation to invent.
   */
  const raisonBlocage = canAnalyze
    ? null
    : !prixRenseigne && itemsAAnalyser.length === 0
      ? 'Renseigne le prix demandé et au moins une série avec ses tomes.'
      : !prixRenseigne
        ? 'Renseigne le prix demandé.'
        : 'Ajoute au moins une série et ses tomes.'

  if (analyzeMutation.isSuccess) {
    return (
      <div className="flex flex-col gap-5">
        <LienRetour parDefaut={RETOUR_PAR_DEFAUT} />
        <div className="flex items-center justify-between gap-2">
          <EnTeteSection niveau={1} titre="Analyser une annonce" />
          <Link to="/purchase-analysis/history" className="flex min-h-11 items-center gap-1.5 text-xs text-textDim underline">
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
      <LienRetour parDefaut={RETOUR_PAR_DEFAUT} />
      <div className="flex items-center justify-between gap-2">
        <EnTeteSection niveau={1} titre="Analyser une annonce" />
        <Link to="/purchase-analysis/history" className="flex min-h-11 items-center gap-1.5 text-xs text-textDim underline">
          <History size={13} />
          Historique
        </Link>
      </div>
      <p className="text-sm text-textDim">
        Colle le lien d'une annonce, ou renseigne le lot à la main.
      </p>

      <ListingUrlField
        url={url}
        onUrlChange={(v) => setUrl(v)}
        onResolved={appliquerPreview}
      />

      <div className="flex flex-col gap-4">
        {/* Progressive disclosure: when the listing has been read, its technical
            fields fold behind a summary. Six fields open all the
            time forced rereading everything before reaching the only
            question that counts - what does this batch contain. */}
        {infosDepliees ? (
          <>
                    <section className="flex flex-col gap-3 rounded-xl bg-surface p-3">
                      <h2 className="font-display text-sm font-semibold text-textPrimary">Annonce</h2>

                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-textDim">Plateforme</span>
                        <div className="flex flex-wrap gap-2">
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
                            className="champ w-full"
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
                              // An amount entered by hand is neither "à partir de" nor
                              // firm - but it is KNOWN. Classing it unknown would make the screen say
                              // "livraison non communiquée" right after
                              // the user has communicated it, while still counting the amount
                              // in the cost. Field emptied: we become truly ignorant again.
                              setShippingKind(e.target.value.trim() ? 'ESTIMATED' : 'UNKNOWN')
                              setShippingFee(e.target.value)
                            }}
                            placeholder="0"
                            className="champ w-full"
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
                            className="champ w-full"
                          />
                        </div>
                      </div>

                      {/* Title and description: pre-filled when the listing could be read,
                          enterable otherwise. Displayed all the time rather than folded -
                          they now carry retrieved content, which must be possible to
                          reread and correct before analysing. */}
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
                            className="champ"
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
                            className="champ"
                          />
                        </div>
                        <ListingPhotos
                          imageUrls={photoUrls}
                          onRemove={(imageUrl) => setPhotoUrls((prev) => prev.filter((u) => u !== imageUrl))}
                        />
                      </div>
                    </section>
            <button
              type="button"
              onClick={() => setInfosDepliees(false)}
              className="min-h-11 self-start rounded-lg px-2 text-xs font-semibold text-accent underline underline-offset-2"
            >
              Replier les informations
            </button>
          </>
        ) : rienDeSaisi ? (
          /* Nothing has been entered yet: the summary would list three absences
             - "Annonce sans titre", "Prix non renseigné", "Port non
             communiqué" - before the user has even started. That
             is not a summary, it is a reproach. An invitation
             instead. */
          <button
            type="button"
            onClick={() => setInfosDepliees(true)}
            className="flex min-h-11 items-center justify-between gap-2 rounded-xl bg-surface px-3 text-left"
          >
            <span className="text-sm text-textDim">
              Prix, frais de port, titre… <span className="text-textPrimary">à renseigner</span>
            </span>
            <Plus size={16} className="shrink-0 text-accentText" />
          </button>
        ) : (
          <ListingSummaryCard
            platform={platform}
            rawTitle={rawTitle}
            askingPrice={askingPrice}
            shippingFee={shippingFee}
            shippingKind={shippingKind}
            buyerProtectionFee={buyerProtectionFee}
            photoCount={photoUrls.length}
            onEdit={() => setInfosDepliees(true)}
          />
        )}

        <section className="flex flex-col gap-3 rounded-xl bg-surface p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2
              ref={titreLotRef}
              tabIndex={-1}
              className="font-display text-sm font-semibold text-textPrimary focus:outline-none"
            >
              Contenu du lot
            </h2>
            <span className="text-xs text-textDim">
              {nombreElementsDuLot === 0
                ? 'Aucun tome pour le moment'
                : `${nombreElementsDuLot} tome${nombreElementsDuLot > 1 ? 's' : ''} · c'est cette liste qui sera analysée`}
            </span>
          </div>

          {/* The canonical list first: it is what goes to the analysis. The
              proposals and the form are only two ways of
              feeding it - there are not two parallel batches. */}
          {elementsAJusteAjoutes > 0 && (
            <p className="rounded-lg bg-okTint px-3 py-2 text-xs font-medium text-ok" role="status">
              {elementsAJusteAjoutes} élément{elementsAJusteAjoutes > 1 ? 's' : ''} ajouté
              {elementsAJusteAjoutes > 1 ? 's' : ''} au lot.
            </p>
          )}

          <LotContentList items={items} ligneEnCours={ligneEnCours} onRemove={removeItem} />

          <ListingDetectionPanel
            title={rawTitle}
            description={description}
            imageUrls={photoUrls}
            dejaDansLeLot={dejaDansLeLot}
            onConfirm={confirmerElementsReconnus}
            onPrefillSeries={prefillSerieAnnoncee}
            // nombreElementsDuLot includes the row being entered: it is
            // the one we want to compare with the announced number, not only the
            // rows already validated by a click on "Autre série".
            tomesDansLeLot={nombreElementsDuLot}
          />

          <h3 className="font-display text-xs font-semibold uppercase tracking-wide text-textDim">
            Ajouter manuellement
          </h3>

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
                className="champ w-full"
                autoComplete="off"
              />
            </div>
            {/* Volumes + button stay grouped (never separated by the wrap - the
                button validates the whole row, not only this field) */}
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-textDim" htmlFor="itemVolumes">
                  Tomes
                </label>
                <input
                  id="itemVolumes"
                  ref={champTomesRef}
                  value={volumesText}
                  onChange={(e) => setVolumesText(e.target.value)}
                  placeholder="1-11"
                  className="champ w-24"
                  autoComplete="off"
                />
              </div>
              <button
                type="button"
                onClick={queueItem}
                disabled={!seriesTitle.trim() || parsedVolumes.length === 0}
                // short aria-label for the listing, long title for the tooltip:
                // the title is the LAST resort of the accname algorithm (and
                // does not exist for a finger), it must not stay alone to name
                // an icon-only button - see Batch 29.
                aria-label="Ajouter une autre série au lot"
                title="Ajouter une AUTRE série au lot - celle en cours de saisie est déjà comptée"
                className="btn-secondaire shrink-0"
              >
                <Plus size={14} />
                Autre série
              </button>
            </div>
          </div>
          <p className="text-xs text-textDim">Tomes : ex. "1-11" pour une plage, "1,3,5-9" pour plusieurs</p>

          {/* The edition comes AFTER the series and the volumes, as a result and
              not as a question: it was the only step of the product where the user was
              forced to know - or to invent. */}
          <EditionStatusRow seriesTitle={seriesTitle} value={editionName} onChange={setEditionName} />

          {seriesTitle.trim() && editionName.trim() && editionName !== EDITION_INCONNUE && (
            <EditionReferenceLookup seriesTitle={seriesTitle} editionName={editionName} onResolved={() => {}} />
          )}

        </section>

        {/* Folded on its value: this field has a sensible default ("Très bon
            état"), and six chips plus a checkbox cost 244 px
            to someone who, eight times out of ten, will not touch them. The name of the
            choice is still read, so checkable at a glance - the information does not
            disappear, only the six ways to change it. */}
        <section className="flex flex-col gap-2 rounded-xl bg-surface p-3">
          {etatDeplie ? (
            <>
              <h2 className="font-display text-sm font-semibold text-textPrimary">État déclaré</h2>
              <div className="flex flex-wrap gap-2">
                {CONDITIONS.map((c) => (
                  <Chip key={c} label={CONDITION_LABELS[c]} isActive={condition === c}
                        onClick={() => setCondition(c)} />
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
            </>
          ) : (
            <button
              type="button"
              onClick={() => setEtatDeplie(true)}
              className="flex min-h-11 items-center justify-between gap-2 text-left"
            >
              <span className="text-sm text-textDim">
                État déclaré :{' '}
                <span className="font-medium text-textPrimary">{CONDITION_LABELS[condition]}</span>
                {conditionAppliesToContainer && <span className="text-textDim"> · coffret</span>}
              </span>
              <span className="shrink-0 text-xs font-semibold text-accentText underline">Modifier</span>
            </button>
          )}
        </section>

        {analyzeMutation.isError && <ErrorBanner message={analyzeMutation.error.message} />}

        {/* The CTA carries what it will evaluate: the link between "Contenu du lot"
            and the button becomes visual, no longer only spatial. The count is
            in VOLUMES - it is what we buy, not the number of rows of the
            model. */}
        {nombreElementsDuLot > 0 && (
          <p className="text-center text-xs text-textDim">
            {nombreElementsDuLot} tome{nombreElementsDuLot > 1 ? 's' : ''}
            {recapitulatifCout && ` · ${recapitulatifCout}`}
          </p>
        )}

        <button
          type="button"
          onClick={() => analyzeMutation.mutate()}
          disabled={!canAnalyze || analyzeMutation.isPending}
          className="btn-primaire"
        >
          {analyzeMutation.isPending ? 'Évaluation…' : 'Évaluer ce lot'}
        </button>
        {/* A greyed-out main button with no explanation is a dead end: we
            say what is missing, rather than leaving people to search. */}
        {raisonBlocage && (
          <p className="text-center text-xs text-textDim" role="status">
            {raisonBlocage}
          </p>
        )}
      </div>
    </div>
  )
}
