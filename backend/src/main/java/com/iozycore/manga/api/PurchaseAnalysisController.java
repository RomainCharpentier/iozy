package com.iozycore.manga.api;

import com.iozycore.manga.deals.CollectionStatus;
import com.iozycore.manga.deals.CollectorPreferences;
import com.iozycore.manga.deals.Condition;
import com.iozycore.manga.deals.EditionSuggestion;
import com.iozycore.manga.domain.EditionTier;
import com.iozycore.core.listing.ListingPlatform;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.deals.MarketPriceObservation;
import com.iozycore.manga.deals.PurchaseAnalysis;
import com.iozycore.manga.deals.PurchaseAnalysisService;
import com.iozycore.manga.deals.PurchaseAnalysisService.AnalyzeListingCommand;
import com.iozycore.manga.deals.PurchaseAnalysisService.AnalyzeListingItemCommand;
import com.iozycore.manga.deals.PurchaseAnalysisService.NearCompleteSuggestion;
import com.iozycore.manga.deals.VerdictFactor;
import com.iozycore.manga.deals.VolumeRange;
import com.iozycore.manga.deals.WeightLevel;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Purchase Analysis feature (evaluate a second-hand listing before buying).
 * Reads from {@code catalog} through {@link PurchaseAnalysisService} only
 * for best-effort series resolution - never writes to it.
 */
@RestController
@RequestMapping("/api/purchase-analysis")
@Tag(name = "PurchaseAnalysis", description = "Evaluate a second-hand manga listing (Vinted/Leboncoin/Rakuten) before buying it")
@RequiredArgsConstructor
public class PurchaseAnalysisController {

    private final PurchaseAnalysisService service;

    public record ListingItemRequest(String seriesTitle, String editionName, Set<Integer> includedVolumes,
                                      String itemConditionOverride) {
    }

    /**
     * @param description       text of the listing - optional, but it is what feeds
     *                          the warning points (mention of payment outside the platform,
     *                          description too short). When absent, these signals stay silent.
     * @param externalListingId identifier returned by reading the link ({@code externalId} of
     *                          the preview). Optional: it changes nothing in the computation, it lets us
     *                          recognise two analyses of the same listing and avoid an
     *                          offer being compared with itself or counting for several sellers.
     */
    public record AnalyzeListingRequest(String platform, String url, String rawTitle, String description,
                                         BigDecimal askingPrice,
                                         BigDecimal shippingFee, String shippingKind,
                                         BigDecimal buyerProtectionFee, String condition,
                                         boolean conditionAppliesToContainer, List<ListingItemRequest> items,
                                         List<String> photoUrls, String externalListingId) {
    }

    @Operation(summary = "Analyze a listing (\"ANALYZE LOT\") - computes completeness, edition warnings, "
            + "the three-price negotiation recommendation and the overall verdict. No listing is ever fetched "
            + "automatically from a URL: no viable public API exists for Vinted/Leboncoin/Rakuten, every field "
            + "must be entered manually.")
    @PostMapping("/analyze")
    @ResponseStatus(HttpStatus.CREATED)
    public PurchaseAnalysis analyze(@RequestBody AnalyzeListingRequest request) {
        if (request.items() == null || request.items().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Une annonce doit contenir au moins un lot");
        }
        List<AnalyzeListingItemCommand> items = request.items().stream()
                .map(item -> new AnalyzeListingItemCommand(item.seriesTitle(), item.editionName(),
                        item.includedVolumes(), parseNullableEnum(Condition.class, item.itemConditionOverride())))
                .toList();
        AnalyzeListingCommand command = new AnalyzeListingCommand(
                parseEnum(ListingPlatform.class, request.platform(), "platform"), request.url(), request.rawTitle(),
                request.description(), request.askingPrice(), request.shippingFee(),
                // Missing nature = the client does not know: we do not decide
                // here. Listing normalised (no amount -> UNKNOWN, an amount
                // -> ESTIMATED), so that the rule lives in one place only.
                request.shippingKind() == null || request.shippingKind().isBlank()
                        ? null
                        : parseEnum(com.iozycore.core.listing.ShippingEstimateKind.class, request.shippingKind(), "shippingKind"),
                request.buyerProtectionFee(),
                parseEnum(Condition.class, request.condition(), "condition"), request.conditionAppliesToContainer(),
                items, request.photoUrls(),
                // Returned by reading the link; used only to recognise
                // two analyses of the same listing.
                request.externalListingId());
        return service.analyze(command);
    }

    public record PurchaseAnalysisSummaryResponse(UUID id, String createdAt, String listingTitle,
                                                    String verdict, int verdictScore, BigDecimal totalRealCost,
                                                    List<String> seriesTitles) {
        static PurchaseAnalysisSummaryResponse from(PurchaseAnalysis analysis) {
            List<String> seriesTitles = analysis.listing().items().stream()
                    .map(item -> item.series().title()).distinct().toList();
            return new PurchaseAnalysisSummaryResponse(analysis.id(), analysis.requestedAt().toString(),
                    analysis.listing().rawTitle(), analysis.verdict().name(), analysis.verdictScore(),
                    analysis.totalRealCost(), seriesTitles);
        }
    }

    @Operation(summary = "List past analyses (most recent first) - lightweight projection, see /history/{id} for the full result")
    @GetMapping("/history")
    public List<PurchaseAnalysisSummaryResponse> history() {
        return service.history().stream().map(PurchaseAnalysisSummaryResponse::from).toList();
    }

    @Operation(summary = "Full result of a past analysis - powers the \"Compare listings\" view")
    @GetMapping("/history/{id}")
    public PurchaseAnalysis historyById(@PathVariable UUID id) {
        return service.findAnalysisById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Analyse introuvable : " + id));
    }

    @Operation(summary = "Delete an analysis from the history - idempotent. Deletes neither the recorded prices "
            + "nor the editions filled in during this analysis: these are reference data.")
    @DeleteMapping("/history/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAnalysis(@PathVariable UUID id) {
        service.deleteAnalysis(id);
    }

    @Operation(summary = "The recorded prices of an edition, from the most recent to the oldest")
    @GetMapping("/market-observations")
    public List<MarketPriceObservation> marketObservations(@RequestParam UUID mangaEditionId) {
        return service.observationsOfEdition(mangaEditionId).stream()
                .sorted(Comparator.comparing(MarketPriceObservation::observedAt).reversed())
                .toList();
    }

    @Operation(summary = "Delete a price recorded by mistake - idempotent. No change is offered: "
            + "a record is a fact observed at a date, we remove the wrong one and record the right one.")
    @DeleteMapping("/market-observations/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMarketObservation(@PathVariable UUID id) {
        service.deleteMarketObservation(id);
    }

    @Operation(summary = "Look up a known manga edition by series + edition name - 404 triggers the client's "
            + "inline \"fill in reference data\" prompt. entityId (optional) is the preferred lookup once the "
            + "Series is a known catalog Entity - looked up by ID first, immune to the Series having been renamed "
            + "since this edition was linked; seriesTitle remains required as the best-effort fallback for a "
            + "listing not yet matched to a catalog Entity, or an edition not yet linked by ID (linked here, "
            + "opportunistically, the first time it's found this way).")
    @GetMapping("/editions")
    public MangaEdition getEdition(@RequestParam(required = false) UUID entityId, @RequestParam String seriesTitle,
                                    @RequestParam String editionName) {
        return service.findEdition(entityId, seriesTitle, editionName)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Aucune édition \"" + editionName + "\" connue pour la série \"" + seriesTitle + "\""));
    }

    @Operation(summary = "Delete an edition reference - 409 when volumes are still linked to it "
            + "(Variant.mangaEditionId), never a silent unlink. 404 when the edition does not exist.")
    @DeleteMapping("/editions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteEdition(@PathVariable UUID id) {
        service.findEditionById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Édition introuvable : " + id));
        var blocages = service.deleteEdition(id);
        if (!blocages.none()) {
            List<String> raisons = new ArrayList<>();
            if (blocages.linkedVolumes() > 0) {
                raisons.add(blocages.linkedVolumes()
                        + (blocages.linkedVolumes() > 1 ? " tomes y sont encore rattachés" : " tome y est encore rattaché"));
            }
            if (blocages.linkedObservations() > 0) {
                raisons.add(blocages.linkedObservations()
                        + (blocages.linkedObservations() > 1 ? " observations de prix s'y réfèrent encore" : " observation de prix s'y réfère encore"));
            }
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Impossible de supprimer cette édition : " + String.join(" et ", raisons));
        }
    }

    @Operation(summary = "Every known edition, all series confounded - powers the per-EDITION progression shown on "
            + "Ma collection, which lists many series at once (one request instead of one per tile). The edition "
            + "reference data is small by nature: one row per edition actually filled in, never a bulk table.")
    @GetMapping("/editions/all")
    public List<MangaEdition> allEditions() {
        return service.findAllEditions();
    }

    @Operation(summary = "All known editions of a series - powers \"a Perfect edition exists for this work\" "
            + "warnings. entityId (optional), when given, is used exclusively (no text-matching fallback): only "
            + "editions actually linked to this Series.")
    @GetMapping("/editions/search")
    public List<MangaEdition> searchEditions(@RequestParam(required = false) UUID entityId, @RequestParam String seriesTitle) {
        return service.findEditionsForSeries(entityId, seriesTitle);
    }

    @Operation(summary = "\"Coût pour compléter une série\" (Ma collection) - completeness and estimated cost to "
            + "complete for volumes already owned, using the same engine as a listing being evaluated. The edition "
            + "being unknown to the system is not an error: the response simply reports completeness as unknown, "
            + "never guessed. volumes is optional and empty means genuinely zero owned (Volume model != Ownership, "
            + "step 4/8: a named edition can perfectly well have zero currently-owned copies, e.g. every volume of "
            + "it was resold). cataloguedVolumes is optional too (step 6/8) - volume numbers that already have a "
            + "real catalogued Variant regardless of Ownership, letting the response distinguish missing-but-"
            + "catalogued from purely virtual gaps; omitted entirely, the distinction is simply absent.")
    @GetMapping("/completeness")
    public CollectionStatus completeness(@RequestParam(required = false) UUID entityId,
                                          @RequestParam String seriesTitle, @RequestParam String editionName,
                                          @RequestParam(required = false) String volumes,
                                          @RequestParam(required = false) String cataloguedVolumes) {
        Set<Integer> includedVolumes = parseVolumeNumbers(volumes);
        Set<Integer> knownCataloguedVolumes = parseVolumeNumbers(cataloguedVolumes);
        return service.computeCompleteness(entityId, seriesTitle, editionName, includedVolumes, knownCataloguedVolumes);
    }

    private static Set<Integer> parseVolumeNumbers(String csv) {
        if (csv == null || csv.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(v -> !v.isBlank())
                .map(Integer::parseInt)
                .collect(java.util.stream.Collectors.toSet());
    }

    @Operation(summary = "\"Suggestions d'achats\" (Mon profil) - series already in the collection with a named "
            + "edition that is known but incomplete, sorted by increasing number of missing volumes")
    @GetMapping("/near-complete-suggestions")
    public List<NearCompleteSuggestion> nearCompleteSuggestions() {
        return service.findNearCompleteSuggestions();
    }

    @Operation(summary = "AI-assisted draft of reference data for an edition unknown to the system (Phase 2) - a "
            + "suggestion to review and correct before saving it via POST /editions, never persisted "
            + "automatically. 204 No Content when no AI provider is configured or it could not produce a usable answer.")
    @GetMapping("/editions/ai-suggestion")
    public ResponseEntity<EditionSuggestion> suggestEdition(@RequestParam String seriesTitle, @RequestParam String editionName) {
        return service.suggestEditionReferenceData(seriesTitle, editionName)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    public record CreateMangaEditionRequest(UUID entityId, String seriesTitle, String editionName, String editionTier,
                                             String publisher, Integer totalVolumes,
                                             BigDecimal retailPriceNewPerVolume, boolean outOfPrint,
                                             boolean betterEditionAnnounced, String betterEditionNote) {
    }

    @Operation(summary = "Record reference data for a manga edition unknown to the system yet (progressive manual "
            + "entry). entityId (optional) links it directly when the caller already knows the series with "
            + "certainty (e.g. series page); omitted, falls back to best-effort text matching (e.g. the "
            + "purchase analysis on a series not necessarily owned yet).")
    @PostMapping("/editions")
    @ResponseStatus(HttpStatus.CREATED)
    public MangaEdition createEdition(@RequestBody CreateMangaEditionRequest request) {
        // A uniqueness constraint (series_title, edition_name) protects this
        // table; left alone, it came back as a 500 with the SQL query and the
        // name of the constraint - a double click on "Enregistrer" was enough
        // (see Batch 36). Same fix as in Batches 26 and 28: refuse before
        // writing, with a sentence that reads well.
        service.findEditionBySeriesAndName(request.seriesTitle(), request.editionName())
                .ifPresent(existing -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Une édition \"" + request.editionName() + "\" existe déjà pour la série \""
                                    + request.seriesTitle() + "\"");
                });
        return service.createEdition(request.entityId(), request.seriesTitle(), request.editionName(),
                parseEnum(EditionTier.class, request.editionTier(), "editionTier"), request.publisher(),
                request.totalVolumes(), request.retailPriceNewPerVolume(), request.outOfPrint(),
                request.betterEditionAnnounced(), request.betterEditionNote());
    }

    public record UpdateMangaEditionRequest(String editionTier, String publisher, Integer totalVolumes,
                                             BigDecimal retailPriceNewPerVolume, Boolean outOfPrint,
                                             Boolean betterEditionAnnounced, String betterEditionNote) {
    }

    @Operation(summary = "Partial update of a manga edition's reference data - null fields keep their current value")
    @PatchMapping("/editions/{id}")
    public MangaEdition updateEdition(@PathVariable UUID id, @RequestBody UpdateMangaEditionRequest request) {
        try {
            return service.updateEdition(id, parseNullableEnum(EditionTier.class, request.editionTier()),
                    request.publisher(), request.totalVolumes(), request.retailPriceNewPerVolume(),
                    request.outOfPrint(), request.betterEditionAnnounced(), request.betterEditionNote());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage());
        }
    }

    public record RecordMarketObservationRequest(UUID mangaEditionId, Integer volumeRangeStart,
                                                  Integer volumeRangeEnd, BigDecimal observedPrice, String platform,
                                                  String observedCondition, LocalDate observedAt, String note) {
    }

    @Operation(summary = "Record a real, manually-entered price observation - the only source of \"observed "
            + "market\" prices in Phase 1 (no viable public API exists for Vinted/Leboncoin/Rakuten)")
    @PostMapping("/market-observations")
    @ResponseStatus(HttpStatus.CREATED)
    public MarketPriceObservation recordMarketObservation(@RequestBody RecordMarketObservationRequest request) {
        VolumeRange scope = (request.volumeRangeStart() != null && request.volumeRangeEnd() != null)
                ? new VolumeRange(request.volumeRangeStart(), request.volumeRangeEnd())
                : null;
        try {
            return service.recordMarketObservation(request.mangaEditionId(), scope, request.observedPrice(),
                    parseEnum(ListingPlatform.class, request.platform(), "platform"),
                    parseNullableEnum(Condition.class, request.observedCondition()), request.observedAt(), request.note());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    @Operation(summary = "Current collector preferences - defaults from the specification until explicitly edited")
    @GetMapping("/preferences")
    public CollectorPreferences preferences() {
        return service.preferences();
    }

    /** Five fields removed in Batch 84: no line of the engine read them
     *  (see CollectorPreferences). A body that still carries them does not fail -
     *  Jackson ignores unknown properties - it simply no longer produces
     *  anything from them, which is exactly what they already did. */
    public record UpdateCollectorPreferencesRequest(List<String> editionTierRanking,
                                                     boolean avoidOutdatedEditionWhenBetterExistsOrAnnounced,
                                                     String conditionImportance, int minimumDiscountVsRetailPercent,
                                                     Map<String, Integer> factorWeights) {
    }

    @Operation(summary = "Replace the collector preferences profile driving the scoring engine")
    @PatchMapping("/preferences")
    public CollectorPreferences updatePreferences(@RequestBody UpdateCollectorPreferencesRequest request) {
        // These two collections are required: this endpoint REPLACES the
        // whole profile (see its summary), it does not merge. Without these guards,
        // an incomplete body left them null and the .stream() below
        // raised a 500 exposing the internal class name and its method -
        // exactly what the alignment of invalid bodies had
        // fixed everywhere else (Batch 28), and the only place that had
        // escaped it. conditionImportance, for its part, was already covered by parseEnum.
        requireField(request.editionTierRanking(), "editionTierRanking");
        requireField(request.factorWeights(), "factorWeights");

        List<EditionTier> ranking = request.editionTierRanking().stream()
                .map(name -> parseEnum(EditionTier.class, name, "editionTierRanking")).toList();
        Map<VerdictFactor, Integer> weights = request.factorWeights().entrySet().stream()
                .collect(java.util.stream.Collectors.toMap(
                        entry -> parseEnum(VerdictFactor.class, entry.getKey(), "factorWeights"), Map.Entry::getValue));
        CollectorPreferences preferences = new CollectorPreferences(ranking,
                request.avoidOutdatedEditionWhenBetterExistsOrAnnounced(),
                parseEnum(WeightLevel.class, request.conditionImportance(), "conditionImportance"),
                request.minimumDiscountVsRetailPercent(), weights);
        return service.updatePreferences(preferences);
    }

    /** Same contract as {@link #parseEnum} for a missing field: a 400 that names
     * the missing field, never a 500 that exposes the internal mechanics. */
    private static void requireField(Object value, String fieldName) {
        if (value == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le champ '" + fieldName + "' est obligatoire");
        }
    }

    private static <E extends Enum<E>> E parseEnum(Class<E> enumType, String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le champ '" + fieldName + "' est obligatoire");
        }
        try {
            return Enum.valueOf(enumType, value);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Valeur invalide pour '" + fieldName + "' : " + value);
        }
    }

    private static <E extends Enum<E>> E parseNullableEnum(Class<E> enumType, String value) {
        return (value == null || value.isBlank()) ? null : Enum.valueOf(enumType, value);
    }
}
