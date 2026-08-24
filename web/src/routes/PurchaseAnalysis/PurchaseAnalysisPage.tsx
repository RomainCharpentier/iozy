import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Plus, History } from 'lucide-react'
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
  type ShippingEstimateKind,
} from '../../types/purchaseAnalysis'
import { EditionReferenceLookup } from './EditionReferenceLookup'
import { ListingDetectionPanel, type ElementConfirme } from './ListingDetectionPanel'
import { EDITION_INCONNUE } from './EditionPicker'
import { EditionStatusRow } from './EditionStatusRow'
import { ListingSummaryCard } from './ListingSummaryCard'
import { LotContentList } from './LotContentList'
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
  // Ce que vaut le montant de port retenu. Une saisie manuelle vaut ESTIMATED :
  // le montant est connu sans être garanti - le classer inconnu ferait dire
  // « livraison non communiquée » juste après que l'utilisateur l'a communiquée.
  const [shippingKind, setShippingKind] = useState<ShippingEstimateKind>('UNKNOWN')
  // Identifiant de l'annonce chez la source, quand la lecture du lien l'a donné.
  const [externalListingId, setExternalListingId] = useState('')
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
      // La nature suit le montant : sans elle, « à partir de 2,83 € » se
      // relirait comme un tarif ferme.
      if (!saisisParUtilisateur.has('shippingFee') && !shippingFee.trim()) {
        setShippingKind(preview.shippingKind)
      }
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
    // Retenu tel quel : il ne s'affiche nulle part et n'entre dans aucun calcul.
    // Il sert uniquement à reconnaître deux analyses de la même annonce.
    setExternalListingId(preview.externalId ?? '')
    // L'annonce a parlé : ses champs techniques se replient derrière un
    // résumé. Ils restent corrigeables, mais ne barrent plus le chemin de
    // celui qui n'a rien à corriger.
    if (preview.retrievedFields.length > 0) {
      setInfosDepliees(false)
    }
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
        shippingKind,
        buyerProtectionFee: buyerProtectionFee.trim() ? Number(buyerProtectionFee) : undefined,
        condition,
        conditionAppliesToContainer,
        items: itemsAAnalyser.map((item) => ({
          seriesTitle: item.seriesTitle,
          editionName: item.editionName,
          includedVolumes: item.includedVolumes,
        })),
        // Conservées avec l'analyse : celle-ci est l'état de l'annonce à
        // l'instant où elle a été lue, et le reste même si le vendeur la
        // modifie ou la retire ensuite.
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
   * Verse dans le brouillon les éléments que l'utilisateur vient de confirmer
   * dans la liste détectée.
   *
   * Regroupe par série + édition : la reconnaissance rend un élément par tome,
   * alors que l'analyse raisonne en lots. Fusionne avec un lot déjà présent
   * plutôt que d'en créer un doublon, et n'ajoute jamais deux fois le même
   * tome — un tome vu sur trois photos a déjà été consolidé côté serveur, mais
   * l'utilisateur peut aussi l'avoir saisi à la main juste avant.
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
      // Tomes triés et texte reconstruit : le lot doit se relire simplement.
      return suivant.map((item) => {
        const tomes = [...item.includedVolumes].sort((a, b) => a - b)
        return { ...item, includedVolumes: tomes, volumesText: tomes.join(', ') }
      })
    })

    // Le retour visuel est traité par un effet, après le commit de React :
    // appeler focus() ici viserait un nœud que le rendu suivant remplacera.
    setElementsAJusteAjoutes(elements.length)
  }

  /**
   * Amène l'utilisateur au résultat quand des éléments viennent d'entrer dans
   * le lot.
   *
   * Le changement principal est dans la page, pas dans un bandeau : plutôt
   * qu'un toast qui disparaît, on montre l'endroit où les éléments sont allés.
   * Rien ne bouge si la liste est déjà sous les yeux - un défilement gratuit
   * désoriente plus qu'il n'aide.
   */
  /**
   * Les champs techniques de l'annonce sont-ils dépliés ?
   *
   * Fermés dès qu'une URL a été lue avec succès : plateforme, prix, port,
   * protection, titre et description sont alors déjà connus, et les laisser
   * ouverts en permanence oblige à relire six champs avant d'arriver à la
   * seule question qui compte - que contient ce lot.
   */
  const [infosDepliees, setInfosDepliees] = useState(true)

  /**
   * Le coût affiché sous le bouton, avec le nom que sa complétude autorise.
   *
   * Reprend la règle de {@code PurchaseAnalysisResultCard} plutôt que d'en
   * inventer une : un port inconnu ne vaut jamais zéro, et appeler « coût
   * total » un montant sans livraison ferait croire à un achat moins cher
   * qu'il ne sera.
   */
  const recapitulatifCout = (() => {
    const prix = Number(askingPrice)
    if (!askingPrice.trim() || Number.isNaN(prix)) return null
    const port = shippingFee.trim() ? Number(shippingFee) : 0
    const protection = buyerProtectionFee.trim() ? Number(buyerProtectionFee) : 0
    const total = (prix + port + protection).toFixed(2)
    if (shippingKind === 'UNKNOWN') return `sous-total connu ${total} €`
    if (shippingKind === 'FROM') return `coût minimum ${total} €`
    return `coût estimé ${total} €`
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
      // Le focus annonce l'arrivée aux lecteurs d'écran, que le défilement
      // laisserait muets.
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
   * La ligne en cours de saisie, si elle est complète.
   *
   * Elle compte dans le lot sans qu'on ait à presser « + ». Auparavant, remplir
   * Série / Édition / Tomes puis viser « ANALYSER LE LOT » laissait le bouton
   * grisé sans un mot d'explication : le « + » était un passage obligé que rien
   * n'annonçait. Il ne sert plus qu'à enchaîner une série SUPPLÉMENTAIRE.
   */
  const ligneEnCours: QueuedItem | null =
    seriesTitle.trim() && parsedVolumes.length > 0
      ? {
          seriesTitle: seriesTitle.trim(),
          // L'édition n'est plus une condition : ne pas la connaître est un
          // état légitime, que le moteur sait traiter (complétude inconnue,
          // valeur neuve indisponible). L'exiger obligeait à en inventer une -
          // et une étiquette inventée peut correspondre PAR ACCIDENT à une
          // autre édition, faussant la référence marché sans rien signaler.
          editionName: editionName.trim() || EDITION_INCONNUE,
          volumesText,
          includedVolumes: parsedVolumes,
        }
      : null

  const itemsAAnalyser = ligneEnCours ? [...items, ligneEnCours] : items

  /**
   * Le décompte parle en TOMES, pas en lignes.
   *
   * Le lot est modélisé par série + édition, avec un ensemble de tomes : « Hell's
   * Paradise 6-10 » est UNE ligne. Annoncer « 1 élément » pour cinq livres
   * serait exact du point de vue du modèle et faux du point de vue de
   * l'acheteur, qui paie cinq tomes.
   */
  const nombreElementsDuLot = itemsAAnalyser.reduce((total, item) => total + item.includedVolumes.length, 0)

  /**
   * Vrai si ce tome est déjà dans le lot.
   *
   * Sert au panneau de détection à marquer « Ajouté au lot » plutôt que de
   * laisser une proposition paraître en attente alors qu'elle est déjà prise
   * en compte - et à empêcher de la confirmer une seconde fois.
   */
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
   * Ce qui manque pour évaluer - dit, plutôt que laissé à deviner.
   *
   * Ne parle JAMAIS d'édition : ne pas la connaître n'empêche pas d'évaluer un
   * lot, et l'afficher comme un blocage relancerait l'obligation d'inventer.
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
        {/* Progressive disclosure : quand l'annonce a été lue, ses champs
            techniques se replient derrière un résumé. Six champs ouverts en
            permanence obligeaient à tout relire avant d'arriver à la seule
            question qui compte - que contient ce lot. */}
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
                            className="min-h-11 w-full rounded-lg bg-surface2 px-3 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
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
                              // Un montant saisi à la main n'est ni « à partir de » ni
                              // ferme - mais il est CONNU. Le classer inconnu ferait dire
                              // « livraison non communiquée » à l'écran juste après que
                              // l'utilisateur l'a communiquée, tout en comptant le montant
                              // dans le coût. Champ vidé : on redevient réellement ignorant.
                              setShippingKind(e.target.value.trim() ? 'ESTIMATED' : 'UNKNOWN')
                              setShippingFee(e.target.value)
                            }}
                            placeholder="0"
                            className="min-h-11 w-full rounded-lg bg-surface2 px-3 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
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
                            className="min-h-11 w-full rounded-lg bg-surface2 px-3 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
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
                            className="min-h-11 rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
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
            <button
              type="button"
              onClick={() => setInfosDepliees(false)}
              className="min-h-11 self-start rounded-lg px-2 text-xs font-semibold text-accent underline underline-offset-2"
            >
              Replier les informations
            </button>
          </>
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

          {/* La liste canonique d'abord : c'est elle qui part à l'analyse. Les
              propositions et le formulaire ne sont que deux façons de
              l'alimenter - il n'existe pas deux lots parallèles. */}
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
                className="min-h-11 w-full rounded-lg bg-surface2 px-2.5 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
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
                  className="min-h-11 w-24 rounded-lg bg-surface2 px-2.5 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
                  autoComplete="off"
                />
              </div>
              <button
                type="button"
                onClick={queueItem}
                disabled={!seriesTitle.trim() || parsedVolumes.length === 0}
                // aria-label court pour l'annonce, title long pour l'infobulle :
                // le title est le DERNIER recours de l'algorithme accname (et
                // n'existe pas au doigt), il ne doit pas rester seul à nommer
                // un bouton en icône seule - voir Lot 29.
                aria-label="Ajouter une autre série au lot"
                title="Ajouter une AUTRE série au lot - celle en cours de saisie est déjà comptée"
                className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-surface2 px-3 text-xs font-semibold text-textPrimary disabled:opacity-50"
              >
                <Plus size={14} />
                Autre série
              </button>
            </div>
          </div>
          <p className="text-xs text-textDim">Tomes : ex. "1-11" pour une plage, "1,3,5-9" pour plusieurs</p>

          {/* L'édition vient APRÈS la série et les tomes, comme un résultat et
              non comme une question : c'était la seule étape du produit où l'on
              obligeait l'utilisateur à savoir - ou à inventer. */}
          <EditionStatusRow seriesTitle={seriesTitle} value={editionName} onChange={setEditionName} />

          {seriesTitle.trim() && editionName.trim() && editionName !== EDITION_INCONNUE && (
            <EditionReferenceLookup seriesTitle={seriesTitle} editionName={editionName} onResolved={() => {}} />
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

        {analyzeMutation.isError && <ErrorBanner message={analyzeMutation.error.message} />}

        {/* Le CTA porte ce qu'il va évaluer : le lien entre « Contenu du lot »
            et le bouton devient visuel, plus seulement spatial. Le décompte est
            en TOMES - c'est ce qu'on achète, pas le nombre de lignes du
            modèle. */}
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
          className="min-h-11 rounded-lg bg-accent px-4 text-sm font-semibold text-accentInk disabled:opacity-50"
        >
          {analyzeMutation.isPending ? 'Évaluation…' : 'Évaluer ce lot'}
        </button>
        {/* Un bouton principal grisé sans explication est un cul-de-sac : on
            dit ce qui manque, plutôt que de laisser chercher. */}
        {raisonBlocage && (
          <p className="text-center text-xs text-textDim" role="status">
            {raisonBlocage}
          </p>
        )}
      </div>
    </div>
  )
}
