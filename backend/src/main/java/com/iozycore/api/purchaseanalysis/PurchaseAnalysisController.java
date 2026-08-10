package com.iozycore.api.purchaseanalysis;

import com.iozycore.purchaseanalysis.CollectorPreferences;
import com.iozycore.purchaseanalysis.Condition;
import com.iozycore.purchaseanalysis.EditionTier;
import com.iozycore.purchaseanalysis.ListingPlatform;
import com.iozycore.purchaseanalysis.MangaEdition;
import com.iozycore.purchaseanalysis.MarketPriceObservation;
import com.iozycore.purchaseanalysis.PurchaseAnalysis;
import com.iozycore.purchaseanalysis.PurchaseAnalysisService;
import com.iozycore.purchaseanalysis.PurchaseAnalysisService.AnalyzeListingCommand;
import com.iozycore.purchaseanalysis.PurchaseAnalysisService.AnalyzeListingItemCommand;
import com.iozycore.purchaseanalysis.VerdictFactor;
import com.iozycore.purchaseanalysis.VolumeRange;
import com.iozycore.purchaseanalysis.WeightLevel;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
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
public class PurchaseAnalysisController {

    private final PurchaseAnalysisService service;

    public PurchaseAnalysisController(PurchaseAnalysisService service) {
        this.service = service;
    }

    public record ListingItemRequest(String seriesTitle, String editionName, Set<Integer> includedVolumes,
                                      String itemConditionOverride) {
    }

    public record AnalyzeListingRequest(String platform, String url, String rawTitle, BigDecimal askingPrice,
                                         BigDecimal shippingFee, BigDecimal buyerProtectionFee, String condition,
                                         boolean conditionAppliesToContainer, List<ListingItemRequest> items,
                                         List<String> photoUrls) {
    }

    @Operation(summary = "Analyze a listing (\"ANALYZE LOT\") - computes completeness, edition warnings, "
            + "the three-price negotiation recommendation and the overall verdict. No listing is ever fetched "
            + "automatically from a URL: no viable public API exists for Vinted/Leboncoin/Rakuten, every field "
            + "must be entered manually.")
    @PostMapping("/analyze")
    @ResponseStatus(HttpStatus.CREATED)
    public PurchaseAnalysis analyze(@RequestBody AnalyzeListingRequest request) {
        if (request.items() == null || request.items().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A listing must include at least one item");
        }
        List<AnalyzeListingItemCommand> items = request.items().stream()
                .map(item -> new AnalyzeListingItemCommand(item.seriesTitle(), item.editionName(),
                        item.includedVolumes(), parseNullableEnum(Condition.class, item.itemConditionOverride())))
                .toList();
        AnalyzeListingCommand command = new AnalyzeListingCommand(
                parseEnum(ListingPlatform.class, request.platform(), "platform"), request.url(), request.rawTitle(),
                request.askingPrice(), request.shippingFee(), request.buyerProtectionFee(),
                parseEnum(Condition.class, request.condition(), "condition"), request.conditionAppliesToContainer(),
                items, request.photoUrls());
        return service.analyze(command);
    }

    public record PurchaseAnalysisSummaryResponse(UUID id, String createdAt, String listingTitle,
                                                    String verdict, int verdictScore, BigDecimal totalRealCost) {
        static PurchaseAnalysisSummaryResponse from(PurchaseAnalysis analysis) {
            return new PurchaseAnalysisSummaryResponse(analysis.id(), analysis.requestedAt().toString(),
                    analysis.listing().rawTitle(), analysis.verdict().name(), analysis.verdictScore(), analysis.totalRealCost());
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
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Analysis not found: " + id));
    }

    @Operation(summary = "Look up a known manga edition by series + edition name - 404 triggers the client's "
            + "inline \"fill in reference data\" prompt")
    @GetMapping("/editions")
    public MangaEdition getEdition(@RequestParam String seriesTitle, @RequestParam String editionName) {
        return service.findEdition(seriesTitle, editionName)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "No known edition \"" + editionName + "\" for series \"" + seriesTitle + "\""));
    }

    @Operation(summary = "All known editions of a series - powers \"a Perfect edition exists for this work\" warnings")
    @GetMapping("/editions/search")
    public List<MangaEdition> searchEditions(@RequestParam String seriesTitle) {
        return service.findEditionsForSeries(seriesTitle);
    }

    public record CreateMangaEditionRequest(String seriesTitle, String editionName, String editionTier,
                                             String publisher, Integer totalVolumes,
                                             BigDecimal retailPriceNewPerVolume, boolean outOfPrint,
                                             boolean betterEditionAnnounced, String betterEditionNote) {
    }

    @Operation(summary = "Record reference data for a manga edition unknown to the system yet (progressive manual entry)")
    @PostMapping("/editions")
    @ResponseStatus(HttpStatus.CREATED)
    public MangaEdition createEdition(@RequestBody CreateMangaEditionRequest request) {
        return service.createEdition(request.seriesTitle(), request.editionName(),
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

    public record UpdateCollectorPreferencesRequest(boolean preferCompletedSeries, boolean avoidOngoingSeries,
                                                     boolean preferOmnibusIntegral, List<String> editionTierRanking,
                                                     boolean avoidOutdatedEditionWhenBetterExistsOrAnnounced,
                                                     boolean frenchLanguageOnly, boolean preferEasyToCompleteCollections,
                                                     String conditionImportance, int minimumDiscountVsRetailPercent,
                                                     Map<String, Integer> factorWeights) {
    }

    @Operation(summary = "Replace the collector preferences profile driving the scoring engine")
    @PatchMapping("/preferences")
    public CollectorPreferences updatePreferences(@RequestBody UpdateCollectorPreferencesRequest request) {
        List<EditionTier> ranking = request.editionTierRanking().stream()
                .map(name -> parseEnum(EditionTier.class, name, "editionTierRanking")).toList();
        Map<VerdictFactor, Integer> weights = request.factorWeights().entrySet().stream()
                .collect(java.util.stream.Collectors.toMap(
                        entry -> parseEnum(VerdictFactor.class, entry.getKey(), "factorWeights"), Map.Entry::getValue));
        CollectorPreferences preferences = new CollectorPreferences(request.preferCompletedSeries(),
                request.avoidOngoingSeries(), request.preferOmnibusIntegral(), ranking,
                request.avoidOutdatedEditionWhenBetterExistsOrAnnounced(), request.frenchLanguageOnly(),
                request.preferEasyToCompleteCollections(),
                parseEnum(WeightLevel.class, request.conditionImportance(), "conditionImportance"),
                request.minimumDiscountVsRetailPercent(), weights);
        return service.updatePreferences(preferences);
    }

    private static <E extends Enum<E>> E parseEnum(Class<E> enumType, String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "'" + fieldName + "' is required");
        }
        try {
            return Enum.valueOf(enumType, value);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid value for '" + fieldName + "': " + value);
        }
    }

    private static <E extends Enum<E>> E parseNullableEnum(Class<E> enumType, String value) {
        return (value == null || value.isBlank()) ? null : Enum.valueOf(enumType, value);
    }
}
