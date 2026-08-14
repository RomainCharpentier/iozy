package com.iozycore.purchaseanalysis;

import com.iozycore.domain.catalog.EditionTier;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.domain.catalog.EntityTypeRepository;
import com.iozycore.domain.catalog.MangaEdition;
import com.iozycore.domain.catalog.MangaEditionRepository;
import com.iozycore.domain.catalog.Variant;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipRepository;
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
import java.util.TreeSet;
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
    private final EntityRepository entityRepository;
    private final EntityTypeRepository entityTypeRepository;
    private final OwnershipRepository ownershipRepository;
    private final AiEditionAdvisor aiEditionAdvisor;
    private final AiMarketPriceAdvisor aiMarketPriceAdvisor;
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
                                    AiMarketPriceAdvisor aiMarketPriceAdvisor) {
        this.mangaEditionRepository = mangaEditionRepository;
        this.marketPriceObservationRepository = marketPriceObservationRepository;
        this.purchaseAnalysisRepository = purchaseAnalysisRepository;
        this.collectorPreferencesRepository = collectorPreferencesRepository;
        this.entityRepository = entityRepository;
        this.entityTypeRepository = entityTypeRepository;
        this.ownershipRepository = ownershipRepository;
        this.aiEditionAdvisor = aiEditionAdvisor;
        this.aiMarketPriceAdvisor = aiMarketPriceAdvisor;
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

            Optional<MangaEdition> resolvedEdition = mangaEditionRepository.findBySeriesAndEdition(
                    series.title(), itemCommand.editionName());
            if (resolvedEdition.isPresent() && series.knownEntityId() != null) {
                resolvedEdition = Optional.of(linkToKnownEntityIfNeeded(resolvedEdition.get(), series.knownEntityId()));
            }
            final Optional<MangaEdition> matchedEdition = resolvedEdition;
            List<MangaEdition> siblingEditions = mangaEditionRepository.findBySeriesTitle(series.title()).stream()
                    .filter(edition -> matchedEdition.isEmpty() || !edition.id().equals(matchedEdition.get().id()))
                    .toList();
            List<MarketPriceObservation> observations = matchedEdition
                    .map(edition -> marketPriceObservationRepository.findByEditionId(edition.id()))
                    .orElseGet(List::of);

            // "Analyse d'un lot" (brainstorm) - jamais deviné : vide tant que la série
            // n'est pas reconnue dans le catalogue (series.knownEntityId() == null).
            Set<Integer> alreadyOwnedVolumes = series.knownEntityId() != null
                    ? findOwnedVolumeNumbers(series.knownEntityId(), itemCommand.editionName())
                    : Set.of();

            // Phase 2 (assistance IA) - seulement quand il n'existe aucune observation réelle : la
            // donnée réelle a toujours priorité, l'IA ne fait que combler l'absence de données, jamais
            // les compléter/contredire (voir AiMarketPriceAdvisor).
            AiPriceEstimate aiEstimate = observations.isEmpty()
                    ? aiMarketPriceAdvisor.estimateMarketPrice(series.title(), itemCommand.editionName(),
                            itemCommand.itemConditionOverride() != null ? itemCommand.itemConditionOverride() : command.condition())
                            .orElse(null)
                    : null;

            itemContexts.add(new PurchaseAnalysisEngine.ItemContext(
                    item, matchedEdition.orElse(null), siblingEditions, observations, alreadyOwnedVolumes, aiEstimate));
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
     * "Assistance IA" (Phase 2, project memory) - a best-effort draft for an
     * edition unknown to the system, to pre-fill the manual-entry form
     * instead of leaving it blank. Deliberately read-only: never calls
     * {@link MangaEditionRepository#save}, the user must still submit
     * {@link #createEdition} themselves after reviewing it.
     */
    public Optional<EditionSuggestion> suggestEditionReferenceData(String seriesTitle, String editionName) {
        return aiEditionAdvisor.suggestReferenceData(seriesTitle, editionName);
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

    /**
     * "Suggestions d'achats" (Mon profil) - séries déjà en collection dont
     * une édition nommée est connue mais pas complète, triées par nombre de
     * tomes manquants croissant (les plus proches de la complétion en
     * premier). Une série sans édition nommée sur ses tomes (attribut
     * "edition" absent/vide) n'a rien à rattacher dans manga_edition et est
     * donc silencieusement ignorée ici, comme pour la détection d'éditions
     * mélangées côté web (voir groupVariantsByEdition côté web/editionGroups.ts).
     * <p>
     * {@code ownedCount}/{@code missingVolumeNumbers} mesurent la possession réelle
     * (Ownership active), jamais la simple existence catalogue d'un Variant (étape 6,
     * modèle Tome ≠ Ownership) - un tome revendu ou dont l'Ownership a été supprimée
     * (voir OwnershipDeletionService) redevient "manquant" ici même si son Variant
     * catalogué existe toujours. {@code cataloguedMissingVolumeNumbers} distingue,
     * parmi les tomes manquants, ceux qui sont déjà catalogués (un Variant existe,
     * juste sans Ownership - potentiellement enrichissable via merge-attributes sans
     * jamais créer de doublon) de ceux purement virtuels (aucun Variant, seulement un
     * numéro déduit de totalVolumes).
     */
    public record NearCompleteSuggestion(UUID entityId, String seriesTitle, String editionName, int ownedCount,
                                          int totalVolumes, int missingCount, List<Integer> missingVolumeNumbers,
                                          List<Integer> cataloguedMissingVolumeNumbers,
                                          BigDecimal estimatedCostToComplete, PriceBasis costToCompleteBasis) {
    }

    public List<NearCompleteSuggestion> findNearCompleteSuggestions() {
        Optional<EntityType> mangaType = entityTypeRepository.findByCode("MANGA");
        if (mangaType.isEmpty()) {
            return List.of();
        }
        List<Entity> mangaEntities = entityRepository.findAllByType(mangaType.get().id());

        List<NearCompleteSuggestion> suggestions = new ArrayList<>();
        for (Entity entity : mangaEntities) {
            // groupVolumesByEdition sert uniquement à découvrir quelles éditions existent
            // (à partir des Variant catalogués, quelle que soit leur Ownership) - jamais
            // à mesurer la possession elle-même, voir findOwnedVolumeNumbers ci-dessous.
            for (Map.Entry<String, Set<Integer>> group : groupVolumesByEdition(entity).entrySet()) {
                String editionName = group.getKey();
                Set<Integer> cataloguedVolumes = group.getValue();
                Set<Integer> ownedVolumes = findOwnedVolumeNumbers(entity.id(), editionName);
                CollectionStatus status = computeCompleteness(entity.title(), editionName, ownedVolumes);
                if (status.isKnown() && !status.isComplete()) {
                    List<Integer> cataloguedMissing = status.missingVolumeNumbers().stream()
                            .filter(cataloguedVolumes::contains)
                            .toList();
                    suggestions.add(new NearCompleteSuggestion(entity.id(), entity.title(), editionName,
                            ownedVolumes.size(), status.totalVolumes(), status.missingCount(),
                            status.missingVolumeNumbers(), cataloguedMissing, status.estimatedCostToComplete(),
                            status.costToCompleteBasis()));
                }
            }
        }
        suggestions.sort(Comparator.comparingInt(NearCompleteSuggestion::missingCount));
        return suggestions;
    }

    /**
     * "Analyse d'un lot" (brainstorm) - tomes de cette édition précise actuellement possédés
     * (ownership active uniquement : un tome revendu/perdu n'est plus un doublon si racheté).
     * Jamais deviné : renvoie un ensemble vide si l'Entity a disparu depuis la résolution du
     * knownEntityId, ou si aucun tome actif ne correspond à editionName.
     */
    private Set<Integer> findOwnedVolumeNumbers(UUID entityId, String editionName) {
        Optional<Entity> entity = entityRepository.findById(entityId);
        if (entity.isEmpty()) {
            return Set.of();
        }
        Map<UUID, Variant> variantsById = entity.get().variants().stream()
                .collect(java.util.stream.Collectors.toMap(Variant::id, v -> v));
        String normalizedEdition = editionName == null ? "" : editionName.trim();

        Set<Integer> owned = new TreeSet<>();
        for (Ownership ownership : ownershipRepository.findByEntityId(entityId)) {
            if (!ownership.isActive()) {
                continue;
            }
            UUID variantId = ownership.variantId().orElse(null);
            if (variantId == null) {
                continue;
            }
            Variant variant = variantsById.get(variantId);
            if (variant == null) {
                continue;
            }
            Object editionAttr = variant.attributes().get("edition");
            String variantEdition = editionAttr instanceof String s ? s.trim() : "";
            if (!variantEdition.equalsIgnoreCase(normalizedEdition)) {
                continue;
            }
            Object volumeNumberAttr = variant.attributes().get("volumeNumber");
            if (volumeNumberAttr instanceof Number number) {
                owned.add(number.intValue());
            }
        }
        return owned;
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

    public MangaEdition createEdition(String seriesTitle, String editionName, EditionTier tier, String publisher,
                                       Integer totalVolumes, BigDecimal retailPriceNewPerVolume, boolean outOfPrint,
                                       boolean betterEditionAnnounced, String betterEditionNote) {
        // Modèle catalogue cible (Série -> Édition -> Tome) : si cette série est déjà une Entity
        // connue, lie l'édition dès sa création plutôt que d'attendre une prochaine analyse.
        UUID knownEntityId = seriesMatcher.match(seriesTitle).knownEntityId();
        MangaEdition edition = MangaEdition.create(knownEntityId, seriesTitle, editionName, tier, publisher,
                totalVolumes, retailPriceNewPerVolume, outOfPrint, betterEditionAnnounced, betterEditionNote);
        return mangaEditionRepository.save(edition);
    }

    /**
     * Le matching texte ({@link SeriesMatcher}, comparaison de titres) reste le mécanisme de
     * résolution à l'usage, mais la relation persistante cible est bien {@code manga_edition.entity_id}
     * une fois connue - dès qu'une édition déjà enregistrée est utilisée aux côtés d'une Entity
     * elle-même déjà résolue, le lien est enregistré une bonne fois pour toutes plutôt que
     * rematché à chaque appel. Jamais l'inverse : n'invente/ne force jamais un entityId sans un
     * match déjà établi ailleurs (ici, par {@link SeriesMatcher}).
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
