package com.iozycore.purchaseanalysis;

import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityTypeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

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
    private final PurchaseAnalysisEngine engine = new PurchaseAnalysisEngine();
    private final MarketPriceCalculator marketPriceCalculator = new MarketPriceCalculator();
    private final CompletenessCalculator completenessCalculator = new CompletenessCalculator();

    public PurchaseAnalysisService(MangaEditionRepository mangaEditionRepository,
                                    MarketPriceObservationRepository marketPriceObservationRepository,
                                    PurchaseAnalysisRepository purchaseAnalysisRepository,
                                    CollectorPreferencesRepository collectorPreferencesRepository,
                                    EntityRepository entityRepository,
                                    EntityTypeRepository entityTypeRepository) {
        this.mangaEditionRepository = mangaEditionRepository;
        this.marketPriceObservationRepository = marketPriceObservationRepository;
        this.purchaseAnalysisRepository = purchaseAnalysisRepository;
        this.collectorPreferencesRepository = collectorPreferencesRepository;
        this.seriesMatcher = new SeriesMatcher(entityRepository, entityTypeRepository);
    }

    /** One series within an {@link AnalyzeListingCommand} - see {@link ListingItem} for field semantics. */
    public record AnalyzeListingItemCommand(String seriesTitle, String editionName, Set<Integer> includedVolumes,
                                             Condition itemConditionOverride) {
    }

    public record AnalyzeListingCommand(ListingPlatform platform, String url, String rawTitle, BigDecimal askingPrice,
                                         BigDecimal shippingFee, BigDecimal buyerProtectionFee, Condition condition,
                                         boolean conditionAppliesToContainer, List<AnalyzeListingItemCommand> items,
                                         List<String> photoUrls) {
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

            Optional<MangaEdition> matchedEdition = mangaEditionRepository.findBySeriesAndEdition(
                    series.title(), itemCommand.editionName());
            List<MangaEdition> siblingEditions = mangaEditionRepository.findBySeriesTitle(series.title()).stream()
                    .filter(edition -> matchedEdition.isEmpty() || !edition.id().equals(matchedEdition.get().id()))
                    .toList();
            List<MarketPriceObservation> observations = matchedEdition
                    .map(edition -> marketPriceObservationRepository.findByEditionId(edition.id()))
                    .orElseGet(List::of);

            itemContexts.add(new PurchaseAnalysisEngine.ItemContext(
                    item, matchedEdition.orElse(null), siblingEditions, observations));
        }

        Listing listing = new Listing(UUID.randomUUID(), command.platform(), command.url(), command.rawTitle(),
                command.askingPrice(), command.shippingFee(), command.buyerProtectionFee(), command.condition(),
                command.conditionAppliesToContainer(), listingItems, command.photoUrls(), java.time.Instant.now());

        CollectorPreferences preferences = collectorPreferencesRepository.find();
        PurchaseAnalysis analysis = engine.analyze(listing, itemContexts, preferences);
        return purchaseAnalysisRepository.save(analysis);
    }

    public List<PurchaseAnalysis> history() {
        return purchaseAnalysisRepository.findAll();
    }

    public Optional<PurchaseAnalysis> findAnalysisById(UUID id) {
        return purchaseAnalysisRepository.findById(id);
    }

    public Optional<MangaEdition> findEdition(String seriesTitle, String editionName) {
        return mangaEditionRepository.findBySeriesAndEdition(seriesTitle, editionName);
    }

    public List<MangaEdition> findEditionsForSeries(String seriesTitle) {
        return mangaEditionRepository.findBySeriesTitle(seriesTitle);
    }

    /**
     * "Coût pour compléter une série" (Ma collection) - same completeness
     * engine as a listing being evaluated (see CompletenessCalculator),
     * applied instead to a series already in the user's own collection.
     * {@code editionName} is expected already resolved (e.g. from a
     * Variant's "edition" attribute) - unknown to the system yet simply
     * means the returned {@link CollectionStatus} is unknown, never guessed.
     */
    public CollectionStatus computeCompleteness(String seriesTitle, String editionName, Set<Integer> includedVolumes) {
        Optional<MangaEdition> edition = mangaEditionRepository.findBySeriesAndEdition(seriesTitle, editionName);
        List<MarketPriceObservation> observations = edition
                .map(e -> marketPriceObservationRepository.findByEditionId(e.id()))
                .orElseGet(List::of);
        MarketPrice perVolumeMarketPrice = marketPriceCalculator.computePerVolume(edition.orElse(null), observations);
        return completenessCalculator.compute(includedVolumes, edition.orElse(null), perVolumeMarketPrice);
    }

    public MangaEdition createEdition(String seriesTitle, String editionName, EditionTier tier, String publisher,
                                       Integer totalVolumes, BigDecimal retailPriceNewPerVolume, boolean outOfPrint,
                                       boolean betterEditionAnnounced, String betterEditionNote) {
        MangaEdition edition = MangaEdition.create(seriesTitle, editionName, tier, publisher, totalVolumes,
                retailPriceNewPerVolume, outOfPrint, betterEditionAnnounced, betterEditionNote);
        return mangaEditionRepository.save(edition);
    }

    public MangaEdition updateEdition(UUID id, EditionTier tier, String publisher, Integer totalVolumes,
                                       BigDecimal retailPriceNewPerVolume, Boolean outOfPrint,
                                       Boolean betterEditionAnnounced, String betterEditionNote) {
        MangaEdition existing = mangaEditionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Unknown manga edition: " + id));
        MangaEdition updated = existing.withUpdatedReferenceData(tier, publisher, totalVolumes,
                retailPriceNewPerVolume, outOfPrint, betterEditionAnnounced, betterEditionNote);
        return mangaEditionRepository.save(updated);
    }

    public MarketPriceObservation recordMarketObservation(UUID mangaEditionId, VolumeRange scope,
                                                            BigDecimal observedPrice, ListingPlatform platform,
                                                            Condition observedCondition, LocalDate observedAt,
                                                            String note) {
        mangaEditionRepository.findById(mangaEditionId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown manga edition: " + mangaEditionId));
        MarketPriceObservation observation = MarketPriceObservation.record_(
                mangaEditionId, scope, observedPrice, platform, observedCondition, observedAt, note);
        return marketPriceObservationRepository.save(observation);
    }

    public CollectorPreferences preferences() {
        return collectorPreferencesRepository.find();
    }

    public CollectorPreferences updatePreferences(CollectorPreferences preferences) {
        return collectorPreferencesRepository.save(preferences);
    }
}
