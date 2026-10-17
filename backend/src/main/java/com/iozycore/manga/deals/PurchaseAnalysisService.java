package com.iozycore.manga.deals;

import com.iozycore.manga.domain.EditionTier;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import com.iozycore.core.domain.insights.CollectionProgress;
import com.iozycore.manga.insights.CollectionProgressService;

import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;
import com.iozycore.core.listing.ListingPlatform;

/**
 * Entry point of the Purchase Analysis feature - reads {@code catalog}
 * (via {@link SeriesMatcher}) purely for best-effort series resolution,
 * never writes to it, and orchestrates {@link PurchaseAnalysisEngine} with
 * data resolved from this module's own repositories.
 */
@Service
public class PurchaseAnalysisService {

    private final MangaEditionRepository mangaEditionRepository;
    private final MarketPriceObservationRepository marketPriceObservationRepository;
    private final PurchaseAnalysisRepository purchaseAnalysisRepository;
    private final CollectorPreferencesRepository collectorPreferencesRepository;
    private final SeriesMatcher seriesMatcher;
    private final EntityRepository entityRepository;
    private final EntityTypeRepository entityTypeRepository;
    private final OwnershipRepository ownershipRepository;
    private final AiEditionAdvisor aiEditionAdvisor;
    private final AiMarketPriceAdvisor aiMarketPriceAdvisor;
    private final AiPriceEstimateCacheRepository aiPriceEstimateCacheRepository;
    private final CollectionProgressService progressService;
    private final com.iozycore.core.domain.wishlist.WishlistEntryRepository wishlistEntryRepository;
    private final PurchaseAnalysisEngine engine = new PurchaseAnalysisEngine();
    private final MarketPriceCalculator marketPriceCalculator = new MarketPriceCalculator();
    private final CompletenessCalculator completenessCalculator = new CompletenessCalculator();

    public PurchaseAnalysisService(MangaEditionRepository mangaEditionRepository,
                                    MarketPriceObservationRepository marketPriceObservationRepository,
                                    PurchaseAnalysisRepository purchaseAnalysisRepository,
                                    CollectorPreferencesRepository collectorPreferencesRepository,
                                    EntityRepository entityRepository,
                                    EntityTypeRepository entityTypeRepository,
                                    OwnershipRepository ownershipRepository,
                                    AiEditionAdvisor aiEditionAdvisor,
                                    AiMarketPriceAdvisor aiMarketPriceAdvisor,
                                    AiPriceEstimateCacheRepository aiPriceEstimateCacheRepository,
                                    CollectionProgressService progressService,
                                    com.iozycore.core.domain.wishlist.WishlistEntryRepository wishlistEntryRepository) {
        this.mangaEditionRepository = mangaEditionRepository;
        this.marketPriceObservationRepository = marketPriceObservationRepository;
        this.purchaseAnalysisRepository = purchaseAnalysisRepository;
        this.collectorPreferencesRepository = collectorPreferencesRepository;
        this.entityRepository = entityRepository;
        this.entityTypeRepository = entityTypeRepository;
        this.ownershipRepository = ownershipRepository;
        this.wishlistEntryRepository = wishlistEntryRepository;
        this.aiEditionAdvisor = aiEditionAdvisor;
        this.aiMarketPriceAdvisor = aiMarketPriceAdvisor;
        this.aiPriceEstimateCacheRepository = aiPriceEstimateCacheRepository;
        this.progressService = progressService;
        this.seriesMatcher = new SeriesMatcher(entityRepository, entityTypeRepository);
    }

    /** One series within an {@link AnalyzeListingCommand} - see {@link ListingItem} for field semantics. */
    public record AnalyzeListingItemCommand(String seriesTitle, String editionName, Set<Integer> includedVolumes,
                                             Condition itemConditionOverride) {
    }

    /**
     * @param externalListingId identifier of the listing at the source, when reading the link
     *                          gave it. Only used to recognise two analyses of the SAME
     *                          listing (see {@link ListingIdentity}) - never shown, never
     *                          kept in the analysis itself.
     */
    public record AnalyzeListingCommand(ListingPlatform platform, String url, String rawTitle, String description, BigDecimal askingPrice,
                                         BigDecimal shippingFee, com.iozycore.core.listing.ShippingEstimateKind shippingKind,
                                         BigDecimal buyerProtectionFee, Condition condition,
                                         boolean conditionAppliesToContainer, List<AnalyzeListingItemCommand> items,
                                         List<String> photoUrls, String externalListingId) {

        /** Callers that have no source identifier - fully manual entry, and most tests. */
        public AnalyzeListingCommand(ListingPlatform platform, String url, String rawTitle, String description,
                                      BigDecimal askingPrice, BigDecimal shippingFee,
                                      com.iozycore.core.listing.ShippingEstimateKind shippingKind,
                                      BigDecimal buyerProtectionFee, Condition condition,
                                      boolean conditionAppliesToContainer, List<AnalyzeListingItemCommand> items,
                                      List<String> photoUrls) {
            this(platform, url, rawTitle, description, askingPrice, shippingFee, shippingKind, buyerProtectionFee,
                    condition, conditionAppliesToContainer, items, photoUrls, null);
        }
    }

    @Transactional
    public PurchaseAnalysis analyze(AnalyzeListingCommand command) {
        List<ListingItem> listingItems = new ArrayList<>();
        List<PurchaseAnalysisEngine.ItemContext> itemContexts = new ArrayList<>();

        for (AnalyzeListingItemCommand itemCommand : command.items()) {
            MangaSeries series = seriesMatcher.match(itemCommand.seriesTitle());
            ListingItem item = new ListingItem(series, itemCommand.editionName(), itemCommand.includedVolumes(),
                    itemCommand.itemConditionOverride());
            listingItems.add(item);

            final Optional<MangaEdition> matchedEdition =
                    findEdition(series.knownEntityId(), series.title(), itemCommand.editionName());
            List<MangaEdition> siblingEditions = findEditionsForSeries(series.knownEntityId(), series.title()).stream()
                    .filter(edition -> matchedEdition.isEmpty() || !edition.id().equals(matchedEdition.get().id()))
                    .toList();
            List<MarketPriceObservation> observations = matchedEdition
                    .map(edition -> marketPriceObservationRepository.findByEditionId(edition.id()))
                    .orElseGet(List::of);

            // "Lot analysis" (brainstorm) - never guessed: empty as long as the series
            // is not recognised in the catalogue (series.knownEntityId() == null).
            Set<Integer> alreadyOwnedVolumes = series.knownEntityId() != null
                    ? findOwnedVolumeNumbers(series.knownEntityId(), itemCommand.editionName())
                    : Set.of();

            // Phase 2 (AI assistance) - only when no real observation exists: the
            // real data always has priority, the AI only fills the absence of data, never
            // completes/contradicts it (see AiMarketPriceAdvisor).
            AiPriceEstimate aiEstimate = observations.isEmpty()
                    ? avisIA(series.title(), itemCommand.editionName(),
                            itemCommand.itemConditionOverride() != null ? itemCommand.itemConditionOverride() : command.condition())
                    : null;

            itemContexts.add(new PurchaseAnalysisEngine.ItemContext(
                    item, matchedEdition.orElse(null), siblingEditions, observations, alreadyOwnedVolumes, aiEstimate));
        }

        Listing listing = new Listing(UUID.randomUUID(), command.platform(), command.url(), command.rawTitle(),
                command.description(), command.askingPrice(), command.shippingFee(), command.shippingKind(),
                command.buyerProtectionFee(),
                command.condition(), command.conditionAppliesToContainer(), listingItems, command.photoUrls(),
                java.time.Instant.now());

        CollectorPreferences preferences = collectorPreferencesRepository.find();
        // The wishes are read HERE: the engine stays a pure domain, it receives
        // a number. Wanting a work is not owning it - this count therefore
        // removes nothing from the missing ones, it qualifies their interest.
        // The identity is established BEFORE the calculation: it is first used to exclude
        // from the reference the observations coming from this same listing, analysed once
        // already. Otherwise a new analysis would be compared to its own price.
        String identiteAnnonce = ListingIdentity.of(command.platform(), command.externalListingId(), command.url());

        PurchaseAnalysis analysis = engine.analyze(listing, itemContexts, preferences,
                comptePresentDansLesEnvies(itemContexts), identiteAnnonce);
        PurchaseAnalysis enregistree = purchaseAnalysisRepository.save(analysis);

        // Only AFTER: the asking price joins the market observations. The
        // moment matters - at this stage the user has corrected the series, chosen
        // the edition and validated the composition, so the observation is about a
        // product that is really identified rather than a draft.
        releverLePrixDemande(enregistree, identiteAnnonce);
        return enregistree;
    }

    /**
     * Keeps the asking price of an analysed listing as a market price.
     *
     * <h2>What is recorded, and what is not</h2>
     * The price of the listing, <b>without fees</b>. Buyer protection and shipping
     * belong to the buyer's acquisition cost, not to what the
     * product is worth: including them here would later compare listings without fees to
     * totals with fees.
     *
     * <h2>Four refusals</h2>
     * <ul>
     *   <li><b>Multi-series lot</b>: the price covers the whole, and splitting it
     *       proportionally would build a price that nobody ever asked.</li>
     *   <li><b>Edition not identified</b>: an observation must be linked to a
     *       product. "Lot manga divers" produces nothing - better no
     *       reference than a badly linked reference.</li>
     *   <li><b>Unknown composition</b>: without a number of volumes, the shape of the lot
     *       cannot be determined, so the observation is not comparable.</li>
     *   <li><b>Zero price</b>: nothing to observe.</li>
     *   <li><b>Listing without identity</b>: see below.</li>
     * </ul>
     * Neither an AI estimate nor a catalogue new price ever arrives here: this
     * method only reads the asking price of the listing.
     *
     * <h2>Why a listing without identity produces NOTHING</h2>
     * Two of the six rules of {@link MarketComparableSelector} hold only
     * through the identity of the listing: "one listing, one comparable" (rule 5) and
     * "the listing being assessed is excluded" (rule 6). Without identity,
     * neither can apply to the row written here.
     * <p>
     * Seen live on 2026-08-28: the same listing entered by hand
     * (so without identity - this is the NORMAL case, no public provider
     * exists, see the header of {@link PurchaseAnalysisEngine}) analysed twice
     * ended up compared to itself. The second analysis returned
     * {@code referenceSampleSize = 2} - "INDEPENDENT comparable
     * listings" that were the same one -, a reference equal to the asking
     * price, and a position verdict "FAIR_PRICE": the listing certified
     * its own price. Three passes would have been enough to get HIGH
     * confidence, exactly the flaw that the selector was written to remove.
     * <p>
     * The explicit action of the user, however, stays intact: the button
     * "Relever ce prix comme observation de marche" writes a
     * {@code MANUAL_ENTRY}, which they own. What disappears is the row that
     * nobody asked for and that nobody can link any more.
     */
    /**
     * The AI opinion on the price of a volume, remembered.
     *
     * <p>This opinion is only asked when no real observation exists for
     * the edition - so exactly on the editions that are analysed again and again in
     * the hope of getting an idea. Without memory, each analysis asked the
     * same question to the same model: the free tier of Gemini is an
     * explicit choice of the user, and it was their quota that paid. Same
     * reasoning as for the cache of volume searches (V3).
     *
     * <p>What is remembered is an ANSWER, "I do not know" included (see
     * {@link AiPriceEstimate}). A failure - missing key, quota exceeded, network -
     * leaves nothing: it will be tried again, because a short outage must
     * not become a permanent "I do not know".
     */
    private AiPriceEstimate avisIA(String seriesTitle, String editionName, Condition condition) {
        String cleSerie = normaliserPourCache(seriesTitle);
        String cleEdition = normaliserPourCache(editionName);
        Optional<AiPriceEstimate> memorise = aiPriceEstimateCacheRepository.find(cleSerie, cleEdition, condition);
        if (memorise.isPresent()) {
            return memorise.get();
        }
        Optional<AiPriceEstimate> reponse = aiMarketPriceAdvisor.estimateMarketPrice(seriesTitle, editionName, condition);
        reponse.ifPresent(estimate -> aiPriceEstimateCacheRepository.save(cleSerie, cleEdition, condition, estimate));
        return reponse.orElse(null);
    }

    /** Same rule as for the cache of volume searches: trim + lower case,
     * cache key only, never shown again as it is. */
    private static String normaliserPourCache(String valeur) {
        return valeur == null ? "" : valeur.trim().toLowerCase(java.util.Locale.ROOT);
    }

    private void releverLePrixDemande(PurchaseAnalysis analysis, String identiteAnnonce) {
        Listing listing = analysis.listing();
        if (identiteAnnonce == null || analysis.itemBreakdown().size() != 1
                || listing.askingPrice().signum() <= 0) {
            return;
        }
        ItemAnalysis item = analysis.itemBreakdown().get(0);
        MangaEdition edition = item.matchedEdition();
        Set<Integer> tomes = item.item().includedVolumes();
        if (edition == null || tomes.isEmpty()) {
            return;
        }
        if (!LotShape.of(tomes.size(), edition.totalVolumes()).isComparable()) {
            return;
        }

        LocalDate observeLe = LocalDate.ofInstant(analysis.requestedAt(), java.time.ZoneId.systemDefault());
        // Nothing new to say: the same listing, at the same price, already noted. One
        // more row would not be an additional observation of the market.
        // The identity is now guaranteed non-null by the entry guard -
        // this is exactly what makes this test able to do its job.
        if (dejaReleveAuMemePrix(edition.id(), identiteAnnonce, listing.askingPrice())) {
            return;
        }

        Condition etat = item.item().itemConditionOverride() != null
                ? item.item().itemConditionOverride()
                : listing.condition();
        // The scope stays the range covered, for display; it is
        // volumeCount that is the reference, since a lot can be non-continuous.
        VolumeRange portee = new VolumeRange(java.util.Collections.min(tomes), java.util.Collections.max(tomes));
        marketPriceObservationRepository.save(MarketPriceObservation.fromAnalyzedListing(
                edition.id(), portee, tomes.size(), listing.askingPrice(), listing.platform(),
                etat, observeLe, identiteAnnonce, listing.url()));
    }

    /**
     * True when the last known observation of this listing already showed this
     * price. A different price is recorded: a listing that went from 70 to
     * 60 EUR says something about the market, and the history keeps it - without
     * counting for two sellers, since the grouping by listing takes care of that
     * at read time.
     */
    private boolean dejaReleveAuMemePrix(UUID editionId, String identiteAnnonce, BigDecimal prix) {
        return marketPriceObservationRepository.findByEditionId(editionId).stream()
                .filter(observation -> identiteAnnonce.equals(observation.listingIdentity()))
                .max(java.util.Comparator.comparing(MarketPriceObservation::observedAt)
                        .thenComparing(MarketPriceObservation::createdAt))
                .filter(dernier -> dernier.observedPrice().compareTo(prix) == 0)
                .isPresent();
    }

    /**
     * The volumes of the lot that are missing AND whose series is already in the wishes.
     * <p>
     * The wishlist of IozyCore is about the WORK, not the volume: "I am looking for
     * Vinland Saga", not "I am looking for volume 7". We therefore count the missing
     * volumes of the wished series - these are the ones that this lot fills,
     * and this is what tells a useful lot from an actively sought lot.
     * <p>
     * This count removes nothing from the missing ones and adds none: wanting is
     * not owning, it qualifies their interest without changing their number.
     */
    private int comptePresentDansLesEnvies(List<PurchaseAnalysisEngine.ItemContext> contextes) {
        Set<UUID> souhaitees = wishlistEntryRepository.findAll().stream()
                .map(com.iozycore.core.domain.wishlist.WishlistEntry::entityId)
                .collect(java.util.stream.Collectors.toSet());
        if (souhaitees.isEmpty()) {
            return 0;
        }
        int total = 0;
        for (PurchaseAnalysisEngine.ItemContext contexte : contextes) {
            UUID entityId = contexte.item().series().knownEntityId();
            if (entityId == null || !souhaitees.contains(entityId)) {
                continue;
            }
            for (Integer tome : contexte.item().includedVolumes()) {
                if (!contexte.alreadyOwnedVolumes().contains(tome)) {
                    total++;
                }
            }
        }
        return total;
    }

    public List<PurchaseAnalysis> history() {
        return purchaseAnalysisRepository.findAll();
    }

    public Optional<PurchaseAnalysis> findAnalysisById(UUID id) {
        return purchaseAnalysisRepository.findById(id);
    }

    /**
     * Removes an analysis from the history, and nothing else: the observed prices and
     * the reference editions filled in during this analysis survive -
     * they are reference data that serve all the following analyses,
     * not sub-objects of this one.
     */
    public void deleteAnalysis(UUID id) {
        purchaseAnalysisRepository.deleteById(id);
    }

    /** The observations of an edition, to be able to read them again and remove a wrong one. */
    public List<MarketPriceObservation> observationsOfEdition(UUID mangaEditionId) {
        return marketPriceObservationRepository.findByEditionId(mangaEditionId);
    }

    /**
     * Removes a price observation entered by mistake. The analyses already saved
     * do not change: each one freezes its own numbers at the time of the calculation.
     * It is the FOLLOWING analyses that will stop counting this observation.
     */
    public void deleteMarketObservation(UUID id) {
        marketPriceObservationRepository.deleteById(id);
    }

    /**
     * {@code entityId} (see migration "Series -> Edition by ID", history of the conversation) is
     * now the source of truth once known: search by ID first, never looked up again via
     * {@code seriesTitle} for an edition that is already linked - immune to a Series rename
     * that happened since (see {@code Entity.rename}, {@code seriesTitle} on {@link MangaEdition} is
     * then only data frozen at its creation, never updated in cascade).
     * <p>
     * The text fallback ({@code seriesTitle}) is only used for the two cases where the ID is not enough:
     * {@code entityId} unknown to the caller (e.g. Purchase Analysis on a series not yet in the
     * collection), or an edition found by title but not yet linked (old record) -
     * in this last case, linked right here, best-effort, before being returned (see
     * {@link #linkToKnownEntityIfNeeded}): the next call will go directly through the ID.
     */
    public Optional<MangaEdition> findEdition(UUID entityId, String seriesTitle, String editionName) {
        if (entityId != null) {
            Optional<MangaEdition> byId = mangaEditionRepository.findByEntityIdAndEditionName(entityId, editionName);
            if (byId.isPresent()) {
                return byId;
            }
        }
        Optional<MangaEdition> byTitle = mangaEditionRepository.findBySeriesAndEdition(seriesTitle, editionName);
        return byTitle.map(edition -> linkToKnownEntityIfNeeded(edition, entityId));
    }

    /** Read by identifier - used before a deletion, to tell
     * "this edition does not exist" (404) from "it exists but is still
     * in use" (409). */
    public Optional<MangaEdition> findEditionById(UUID editionId) {
        return mangaEditionRepository.findById(editionId);
    }

    /**
     * What still holds a reference edition and prevents its deletion.
     * No blocker = it was really deleted.
     */
    public record EditionDeletionBlockers(int linkedVolumes, int linkedObservations) {
        public boolean none() {
            return linkedVolumes == 0 && linkedObservations == 0;
        }
    }

    /**
     * Deletes a reference edition - REFUSED as long as a Volume is still
     * linked to it (Variant.mangaEditionId) OR a price observation
     * refers to it, to never leave behind a row pointing to a
     * missing edition. Same stance as the deletion of an EntityType
     * (see EntityTypeService): we explain what blocks rather than unlink
     * silently data that the user thought was linked.
     * <p>
     * The observations were missing from this inventory: the foreign key
     * constraint of Postgres was then alone in protecting the table, and
     * returned a raw SQL error as a 500 instead of the explicit 409 planned
     * here (found during verification, Batch 26).
     *
     * @return what blocks, or counters at zero when the deletion
     *         did take place.
     */
    public EditionDeletionBlockers deleteEdition(UUID editionId) {
        long linkedVolumes = entityRepository.search(null, null, null).stream()
                .flatMap(entity -> entity.variants().stream())
                .filter(variant -> editionId.equals(variant.mangaEditionId()))
                .count();
        // All accounts together: an edition is shared, and deleting it
        // would break the observations of another account as much as one's own.
        int linkedObservations = marketPriceObservationRepository.countByEditionIdAllOwners(editionId);
        if (linkedVolumes > 0 || linkedObservations > 0) {
            return new EditionDeletionBlockers((int) linkedVolumes, linkedObservations);
        }
        mangaEditionRepository.deleteById(editionId);
        return new EditionDeletionBlockers(0, 0);
    }

    /** All the known editions, all series together - for a screen that
     * shows the progress of SEVERAL series at once (My collection) without
     * one call per tile. No filtering/enrichment: it is a raw
     * read of the reference data, deliberately different from {@link #findEdition},
     * which opportunistically links an edition to a Series. */
    public List<MangaEdition> findAllEditions() {
        return mangaEditionRepository.findAll();
    }

    /** Same principle as {@link #findEdition}: by ID when known (never a text fallback in this case,
     * unlike {@link #findEdition} - a list of "all the linked editions" has no
     * reason to be completed with a text match result once the ID is available). */
    public List<MangaEdition> findEditionsForSeries(UUID entityId, String seriesTitle) {
        if (entityId != null) {
            return mangaEditionRepository.findByEntityId(entityId);
        }
        return mangaEditionRepository.findBySeriesTitle(seriesTitle);
    }

    /**
     * "AI assistance" (Phase 2, project memory) - a best-effort draft for an
     * edition unknown to the system, to pre-fill the manual-entry form
     * instead of leaving it blank. Deliberately read-only: never calls
     * {@link MangaEditionRepository#save}, the user must still submit
     * {@link #createEdition} themselves after reviewing it.
     */
    public Optional<EditionSuggestion> suggestEditionReferenceData(String seriesTitle, String editionName) {
        return aiEditionAdvisor.suggestReferenceData(seriesTitle, editionName);
    }

    /**
     * "Cost to complete a series" (My collection) - same completeness
     * engine as a listing being evaluated (see CompletenessCalculator),
     * applied instead to a series already in the user's own collection.
     * {@code editionName} is expected already resolved (e.g. from a
     * Variant's "edition" attribute) - unknown to the system yet simply
     * means the returned {@link CollectionStatus} is unknown, never guessed.
     */
    public CollectionStatus computeCompleteness(UUID entityId, String seriesTitle, String editionName, Set<Integer> includedVolumes) {
        return computeCompleteness(entityId, seriesTitle, editionName, includedVolumes, Set.of());
    }

    /**
     * @param cataloguedVolumes step 6/8 (Volume != Ownership model) - volume numbers that have a real
     *                          catalogued Variant regardless of Ownership, so the response can
     *                          distinguish "missing but already catalogued" from "missing and purely
     *                          virtual" (see {@link CollectionStatus#cataloguedMissingVolumeNumbers()}) -
     *                          empty when the caller doesn't have/need that distinction.
     */
    public CollectionStatus computeCompleteness(UUID entityId, String seriesTitle, String editionName, Set<Integer> includedVolumes,
                                                 Set<Integer> cataloguedVolumes) {
        Optional<MangaEdition> edition = findEdition(entityId, seriesTitle, editionName);
        List<MarketPriceObservation> observations = edition
                .map(e -> marketPriceObservationRepository.findByEditionId(e.id()))
                .orElseGet(List::of);
        MarketPrice perVolumeMarketPrice = marketPriceCalculator.computePerVolume(edition.orElse(null), observations);
        return completenessCalculator.compute(includedVolumes, cataloguedVolumes, edition.orElse(null), perVolumeMarketPrice);
    }

    /**
     * "Purchase suggestions" (My profile) - series already in the collection with
     * a known named edition that is not complete, sorted by increasing number of
     * missing volumes (the closest to completion
     * first). A series without a named edition on its volumes (attribute
     * "edition" missing/empty) has nothing to link in manga_edition and is
     * therefore silently ignored here, as for the detection of mixed
     * editions on the web side (see groupVariantsByEdition in web/editionGroups.ts).
     * <p>
     * {@code ownedCount}/{@code missingVolumeNumbers} measure real possession
     * (active Ownership), never the mere catalogue existence of a Variant (step 6,
     * Volume ≠ Ownership model) - a volume that was resold or whose Ownership was deleted
     * (see OwnershipDeletionService) becomes "missing" again here even if its catalogued
     * Variant still exists. {@code cataloguedMissingVolumeNumbers} tells apart,
     * among the missing volumes, those that are already catalogued (a Variant exists,
     * just without Ownership - potentially enrichable via merge-attributes without
     * ever creating a duplicate) from the purely virtual ones (no Variant, only a
     * number deduced from totalVolumes).
     */
    public record NearCompleteSuggestion(UUID entityId, String seriesTitle, String editionName, int ownedCount,
                                          int totalVolumes, int missingCount, List<Integer> missingVolumeNumbers,
                                          List<Integer> cataloguedMissingVolumeNumbers,
                                          BigDecimal estimatedCostToComplete, PriceBasis costToCompleteBasis) {
    }

    /**
     * <h2>Everything is loaded IN BULK, and this is the subject of this method</h2>
     * This screen talks about ALL the series at once. Written series by series, it
     * asked for the progress once per series, then, for each pair
     * (series × edition), found the reference edition and read its observed prices
     * again: measured at 88 requests for 5 series and 148 for 11, that is about
     * ten more per series added (finding C1 of the technical audit). On
     * 200 series, the order of magnitude became two thousand requests per call.
     * <p>
     * The three sources are therefore read only once - the progress through
     * {@code computeAll()}, which already existed and served the public share; the
     * edition reference data, small by nature; the observed prices, grouped by
     * edition. The rest is computed in memory.
     *
     * <h2>A repair that has no place here</h2>
     * {@link #findEdition} links on the way an edition found by its
     * title to the known series (see {@code linkToKnownEntityIfNeeded}) - a
     * WRITE, useful where the user acts on a precise edition. A screen
     * that lists suggestions repairs nothing: it reads. The resolution below
     * therefore follows the same rules (by identifier first, by title next,
     * ignoring case) without writing.
     */
    public List<NearCompleteSuggestion> findNearCompleteSuggestions() {
        Optional<EntityType> mangaType = entityTypeRepository.findByCode("MANGA");
        if (mangaType.isEmpty()) {
            return List.of();
        }
        List<Entity> mangaEntities = entityRepository.findAllByType(mangaType.get().id());

        // The groups and what is owned come from CollectionProgressService, the single
        // source of progress: this engine used to recompute them on its own and
        // ignored volumes without a specified edition, hence a series shown as 2/72
        // here and 3/72 on My collection (audit of 2026-08-21, Batch 31).
        Map<UUID, CollectionProgress> progressionParSerie = progressService.computeAll().stream()
                .collect(Collectors.toMap(CollectionProgress::entityId, progression -> progression));

        List<MangaEdition> toutesLesEditions = mangaEditionRepository.findAll();
        Map<UUID, List<MarketPriceObservation>> relevesParEdition = marketPriceObservationRepository.findAll()
                .stream().collect(Collectors.groupingBy(MarketPriceObservation::mangaEditionId));

        List<NearCompleteSuggestion> suggestions = new ArrayList<>();
        for (Entity entity : mangaEntities) {
            CollectionProgress progression = progressionParSerie.get(entity.id());
            if (progression == null) {
                continue;
            }
            for (CollectionProgress.EditionProgress group : progression.editions()) {
                String editionName = group.editionName();
                if (editionName.isEmpty()) {
                    continue; // without a named edition, nothing to compare with manga_edition
                }
                MangaEdition edition = editionDeLaListe(toutesLesEditions, entity, editionName);
                Set<Integer> cataloguedVolumes = new TreeSet<>(group.cataloguedVolumeNumbers());
                Set<Integer> ownedVolumes = new TreeSet<>(group.ownedVolumeNumbers());
                MarketPrice prixAuTome = marketPriceCalculator.computePerVolume(edition,
                        edition == null ? List.of() : relevesParEdition.getOrDefault(edition.id(), List.of()));
                CollectionStatus status = completenessCalculator.compute(ownedVolumes, cataloguedVolumes,
                        edition, prixAuTome);
                if (status.isKnown() && !status.isComplete()) {
                    suggestions.add(new NearCompleteSuggestion(entity.id(), entity.title(), editionName,
                            ownedVolumes.size(), status.totalVolumes(), status.missingCount(),
                            status.missingVolumeNumbers(), status.cataloguedMissingVolumeNumbers(),
                            status.estimatedCostToComplete(), status.costToCompleteBasis()));
                }
            }
        }
        suggestions.sort(Comparator.comparingInt(NearCompleteSuggestion::missingCount));
        return suggestions;
    }

    /**
     * The reference edition of a pair (series, edition name), searched in
     * a list that is already loaded rather than in the database.
     * <p>
     * Same rules as {@link #findEdition}: the structural link
     * (entityId) is the reference, the title is only used as a fallback - ignoring
     * case, like the matching queries. {@code null} when no reference
     * edition exists: completeness is then unknown, never
     * guessed.
     */
    private static MangaEdition editionDeLaListe(List<MangaEdition> editions, Entity entity, String editionName) {
        for (MangaEdition edition : editions) {
            if (entity.id().equals(edition.entityId()) && edition.editionName().equalsIgnoreCase(editionName)) {
                return edition;
            }
        }
        for (MangaEdition edition : editions) {
            if (edition.seriesTitle().equalsIgnoreCase(entity.title())
                    && edition.editionName().equalsIgnoreCase(editionName)) {
                return edition;
            }
        }
        return null;
    }

    /**
     * "Lot analysis" - volumes of this edition currently owned (active ownership
     * only: a volume that was resold/lost is no longer a duplicate if we buy it again).
     * <p>
     * Goes through {@link CollectionProgressService}, the SINGLE source of progress, like
     * the suggestions above. This method used to redo the calculation on its own and
     * required the {@code edition} attribute of the volume to match EXACTLY: a catalogued
     * volume without a specified edition was therefore counted in no edition. Everywhere
     * else it joins the single named edition of the series (see resolveEditionView on the
     * web side, and the grouping of CollectionProgressService on the server side).
     * <p>
     * Consequence seen while testing the flow on 2026-08-27: the work page of Naruto
     * said volume 1 was owned in the Kana edition, and the analysis of a lot "Naruto 1-5"
     * answered "5 missing" - so it advised buying again a volume already on the shelf,
     * which is the opposite of what this screen is for. Same flaw, same file,
     * as the one fixed in Batch 31 for the suggestions - fixed there, not here.
     * <p>
     * Never guessed: empty set if the Entity has disappeared since the resolution of the
     * knownEntityId, or if no group carries this edition.
     */
    private Set<Integer> findOwnedVolumeNumbers(UUID entityId, String editionName) {
        String recherchee = editionName == null ? "" : editionName.trim();
        return progressService.compute(entityId)
                .map(CollectionProgress::editions)
                .orElse(List.of())
                .stream()
                .filter(groupe -> groupe.editionName().equalsIgnoreCase(recherchee))
                .findFirst()
                .<Set<Integer>>map(groupe -> new TreeSet<>(groupe.ownedVolumeNumbers()))
                .orElseGet(Set::of);
    }

    /** Server-side equivalent of the web's groupVariantsByEdition (editionGroups.ts) - variants
     * without both a numeric "volumeNumber" and a non-blank "edition" attribute are excluded,
     * since a suggestion needs a named edition to look up against manga_edition. */
    private static Map<String, Set<Integer>> groupVolumesByEdition(Entity entity) {
        Map<String, Set<Integer>> byEdition = new LinkedHashMap<>();
        for (Variant variant : entity.variants()) {
            Object volumeNumberObj = variant.attributes().get("volumeNumber");
            if (!(volumeNumberObj instanceof Number number)) {
                continue;
            }
            Object editionObj = variant.attributes().get("edition");
            String edition = editionObj instanceof String s ? s.trim() : "";
            if (edition.isEmpty()) {
                continue;
            }
            byEdition.computeIfAbsent(edition, k -> new TreeSet<>()).add(number.intValue());
        }
        return byEdition;
    }

    /**
     * @param entityId the caller can directly provide the ID of the Series (e.g. series detail page, which
     *                 already knows it for sure) - used as is, without going through SeriesMatcher.
     *                 {@code null} (e.g. Purchase Analysis on a series not necessarily in the collection)
     *                 falls back on the existing best-effort text matching.
     */
    public MangaEdition createEdition(UUID entityId, String seriesTitle, String editionName, EditionTier tier, String publisher,
                                       Integer totalVolumes, BigDecimal retailPriceNewPerVolume, boolean outOfPrint,
                                       boolean betterEditionAnnounced, String betterEditionNote) {
        // A Series provided explicitly must exist. Without this check, only the
        // foreign key constraint protected the table, and the client received
        // "Cette donnée entre en conflit avec une donnée existante" - while
        // the Series is MISSING, not conflicting.
        //
        // 400 and not 404, like the other routes that reference a work
        // from a request BODY (/experiences, /wishlist, /relationships). The target resource -
        // POST /editions - does exist; it is the reference provided that
        // is invalid. And the client replaces the message of any 404 with a
        // generic fallback: with a 404, "Série introuvable" would never reach
        // the screen.
        if (entityId != null && entityRepository.findById(entityId).isEmpty()) {
            throw new IllegalArgumentException("Série introuvable : " + entityId);
        }
        // Target catalogue model (Series -> Edition -> Volume): if this series is already a known
        // Entity, link the edition from its creation rather than wait for a next analysis.
        UUID linkedEntityId = entityId != null ? entityId : seriesMatcher.match(seriesTitle).knownEntityId();
        MangaEdition edition = MangaEdition.create(linkedEntityId, seriesTitle, editionName, tier, publisher,
                totalVolumes, retailPriceNewPerVolume, outOfPrint, betterEditionAnnounced, betterEditionNote);
        return mangaEditionRepository.save(edition);
    }

    /**
     * Text matching ({@link SeriesMatcher}, comparison of titles) stays the mechanism of
     * resolution in use, but the target persistent relation is {@code manga_edition.entity_id}
     * once known - as soon as an edition that is already saved is used next to an Entity
     * that is itself already resolved, the link is saved once and for all rather than
     * matched again at each call. Never the opposite: never makes up/forces an entityId without a
     * match already established elsewhere (here, by {@link SeriesMatcher}).
     */
    private MangaEdition linkToKnownEntityIfNeeded(MangaEdition edition, UUID knownEntityId) {
        if (edition.entityId() != null || knownEntityId == null) {
            return edition;
        }
        return mangaEditionRepository.save(edition.withEntityId(knownEntityId));
    }

    public MangaEdition updateEdition(UUID id, EditionTier tier, String publisher, Integer totalVolumes,
                                       BigDecimal retailPriceNewPerVolume, Boolean outOfPrint,
                                       Boolean betterEditionAnnounced, String betterEditionNote) {
        MangaEdition existing = mangaEditionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Édition introuvable : " + id));
        MangaEdition updated = existing.withUpdatedReferenceData(tier, publisher, totalVolumes,
                retailPriceNewPerVolume, outOfPrint, betterEditionAnnounced, betterEditionNote);
        return mangaEditionRepository.save(updated);
    }

    public MarketPriceObservation recordMarketObservation(UUID mangaEditionId, VolumeRange scope,
                                                            BigDecimal observedPrice, ListingPlatform platform,
                                                            Condition observedCondition, LocalDate observedAt,
                                                            String note) {
        mangaEditionRepository.findById(mangaEditionId)
                .orElseThrow(() -> new IllegalArgumentException("Édition introuvable : " + mangaEditionId));
        MarketPriceObservation observation = MarketPriceObservation.record_(
                mangaEditionId, scope, observedPrice, platform, observedCondition, observedAt, note);
        return marketPriceObservationRepository.save(observation);
    }

    /** Existing edition carrying this pair (series title, edition name) - the
     * uniqueness constraint of the database is exactly on this pair, whatever
     * the entityId. Used to refuse a duplicate before the insert (see Batch 36). */
    public Optional<MangaEdition> findEditionBySeriesAndName(String seriesTitle, String editionName) {
        if (seriesTitle == null || editionName == null) {
            return Optional.empty();
        }
        return mangaEditionRepository.findBySeriesAndEdition(seriesTitle, editionName);
    }

    public CollectorPreferences preferences() {
        return collectorPreferencesRepository.find();
    }

    public CollectorPreferences updatePreferences(CollectorPreferences preferences) {
        return collectorPreferencesRepository.save(preferences);
    }
}
