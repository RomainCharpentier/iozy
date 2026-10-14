package com.iozycore.core.api.tierlist;

import com.iozycore.core.api.dto.TierListDtos.*;
import com.iozycore.core.application.CustomTierListService;
import com.iozycore.core.application.CustomTierListService.TierListDetail;
import com.iozycore.core.application.CustomTierListService.TierListSummary;
import com.iozycore.core.application.TierListService;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.tierlist.Rank;
import com.iozycore.core.domain.tierlist.TierListItem;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Tier Lists: general ranking (one work = one rank on the
 * full scale, see /general) and custom Tier Lists (named,
 * explicit membership, see the rest of the routes) - see the mockup
 * V1.2 §44-52 and com.iozycore.core.domain.tierlist. New domain, no
 * inherited data to migrate (see docs/DESIGN_MIGRATION_V1.2.md Batch 7).
 */
@RestController
@RequestMapping("/api/tier-lists")
@Tag(name = "Tier Lists", description = "General ranking and custom Tier Lists")
@RequiredArgsConstructor
public class TierListController {

    private final TierListService tierListService;
    private final CustomTierListService customTierListService;

    // ═══ General ranking ═══

    @Operation(summary = "Board of the general ranking of a universe (see TierBoard on the mockup side)")
    @GetMapping("/general")
    public GeneralBoardResponse generalBoard(@RequestParam UUID entityTypeId) {
        TierListService.GeneralBoard board = tierListService.generalBoard(entityTypeId);
        Map<Rank, List<TierListEntryResponse>> ranked = new EnumMap<>(Rank.class);
        board.ranked().forEach((rank, entities) -> ranked.put(rank,
                entities.stream().map(e -> TierListEntryResponse.from(e, rank)).collect(Collectors.toList())));
        List<TierListEntryResponse> unranked = board.unranked().stream()
                .map(e -> TierListEntryResponse.from(e, null))
                .collect(Collectors.toList());
        return new GeneralBoardResponse(ranked, unranked);
    }

    @Operation(summary = "Rank (or unrank if rank=null) a work on the general ranking")
    @PutMapping("/general/entities/{entityId}")
    public TierListEntryResponse setGeneralRank(@PathVariable UUID entityId, @RequestBody SetRankRequest request) {
        Entity entity = tierListService.setGeneralRank(entityId, request.rank());
        return TierListEntryResponse.from(entity, request.rank());
    }

    @Operation(summary = "\"My rankings\" of a work (general rank + custom Tier Lists where it is ranked)")
    @GetMapping("/entities/{entityId}/summary")
    public EntityTierSummaryResponse entitySummary(@PathVariable UUID entityId) {
        Rank generalRank = tierListService.generalRankOf(entityId).orElse(null);
        List<CustomRankEntryResponse> customRanks = tierListService.customRanksFor(entityId).stream()
                .map(entry -> new CustomRankEntryResponse(entry.list().id(), entry.list().name(), entry.rank()))
                .collect(Collectors.toList());
        return new EntityTierSummaryResponse(generalRank, customRanks);
    }

    // ═══ Custom Tier Lists ═══

    @Operation(summary = "Custom Tier Lists of a universe (Discover Hub). entityTypeId omitted = the CROSS-CUTTING Tier "
            + "Lists \"all categories\" (see TierList.isAllUniverses), never all the lists "
            + "mixed together: they form a separate family on the client side, not one more universe.")
    @GetMapping
    public List<TierListResponse> byEntityType(@RequestParam(required = false) UUID entityTypeId) {
        return customTierListService.listsOf(entityTypeId).stream()
                .map(TierListController::toResponse)
                .collect(Collectors.toList());
    }

    @Operation(summary = "Create a custom Tier List")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TierListResponse create(@RequestBody CreateTierListRequest request) {
        return toResponse(customTierListService.create(request.name(), request.entityTypeId(),
                request.activeRanks(), request.description()));
    }

    @Operation(summary = "Detail of a Tier List (full board, ranked and unranked)")
    @GetMapping("/{id}")
    public TierListDetailResponse detail(@PathVariable UUID id) {
        return toResponse(customTierListService.detail(id).orElseThrow(() -> tierListNotFound(id)));
    }

    @Operation(summary = "Rename / change the active ranks / the description of a Tier List")
    @PatchMapping("/{id}")
    public TierListResponse update(@PathVariable UUID id, @RequestBody UpdateTierListRequest request) {
        return toResponse(customTierListService
                .update(id, request.name(), request.activeRanks(), request.description())
                .orElseThrow(() -> tierListNotFound(id)));
    }

    @Operation(summary = "Delete a custom Tier List (and its content)")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        customTierListService.delete(id);
    }

    @Operation(summary = "Add works to a Tier List (unranked at first)")
    @PostMapping("/{id}/items")
    @ResponseStatus(HttpStatus.CREATED)
    public TierListDetailResponse addItems(@PathVariable UUID id, @RequestBody AddTierListItemsRequest request) {
        return toResponse(customTierListService.addItems(id, request.entityIds())
                .orElseThrow(() -> tierListNotFound(id)));
    }

    @Operation(summary = "Rank (or unrank if rank=null) a work already added to this Tier List")
    @PutMapping("/{id}/items/{entityId}")
    public TierListEntryResponse setItemRank(@PathVariable UUID id, @PathVariable UUID entityId, @RequestBody SetRankRequest request) {
        Entity entity = customTierListService.setItemRank(id, entityId, request.rank())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Cette œuvre n'appartient pas à cette Tier List"));
        return TierListEntryResponse.from(entity, request.rank());
    }

    @Operation(summary = "Remove a work from a custom Tier List")
    @DeleteMapping("/{id}/items/{entityId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeItem(@PathVariable UUID id, @PathVariable UUID entityId) {
        customTierListService.removeItem(id, entityId);
    }

    private static ResponseStatusException tierListNotFound(UUID id) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Tier List introuvable : " + id);
    }

    private static TierListResponse toResponse(TierListSummary summary) {
        return TierListResponse.from(summary.list(), summary.itemCount(), summary.rankedCount());
    }

    private static TierListDetailResponse toResponse(TierListDetail detail) {
        return new TierListDetailResponse(toResponse(detail.summary()),
                toEntries(detail.ranked()), toEntries(detail.unranked()));
    }

    private static List<TierListEntryResponse> toEntries(List<Map.Entry<TierListItem, Entity>> entries) {
        return entries.stream()
                .map(e -> TierListEntryResponse.from(e.getKey(), e.getValue()))
                .collect(Collectors.toList());
    }
}
