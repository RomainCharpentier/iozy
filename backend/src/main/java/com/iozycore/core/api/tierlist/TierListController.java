package com.iozycore.core.api.tierlist;

import com.iozycore.core.api.dto.TierListDtos.*;
import com.iozycore.core.application.TierListService;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.tierlist.*;
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

    private final TierListRepository tierListRepository;
    private final TierListItemRepository tierListItemRepository;
    private final EntityRankRepository entityRankRepository;
    private final EntityRepository entityRepository;
    private final EntityTypeRepository entityTypeRepository;
    private final TierListService tierListService;

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
        Entity entity = entityRepository.findById(entityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Entité introuvable : " + entityId));
        if (request.rank() == null) {
            entityRankRepository.deleteByEntityId(entityId);
            return TierListEntryResponse.from(entity, null);
        }
        EntityRank rank = entityRankRepository.findByEntityId(entityId)
                .map(existing -> {
                    existing.updateRank(request.rank());
                    return existing;
                })
                .orElseGet(() -> EntityRank.assign(entityId, request.rank()));
        entityRankRepository.save(rank);
        return TierListEntryResponse.from(entity, request.rank());
    }

    @Operation(summary = "\"My rankings\" of a work (general rank + custom Tier Lists where it is ranked)")
    @GetMapping("/entities/{entityId}/summary")
    public EntityTierSummaryResponse entitySummary(@PathVariable UUID entityId) {
        Rank generalRank = entityRankRepository.findByEntityId(entityId).map(EntityRank::rank).orElse(null);
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
        List<TierList> lists = entityTypeId == null
                ? tierListRepository.findAllUniversesLists()
                : tierListRepository.findByEntityTypeId(entityTypeId);
        return lists.stream().map(this::toSummary).collect(Collectors.toList());
    }

    @Operation(summary = "Create a custom Tier List")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TierListResponse create(@RequestBody CreateTierListRequest request) {
        if (request.name() == null || request.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nom de la Tier List ne peut pas être vide");
        }
        // entityTypeId null = cross-cutting "all categories" list (see TierList) -
        // nothing to validate in this case, there is precisely no universe.
        //
        // When a universe IS requested, it must exist. The previous call
        // (findAllByType) claimed to check it but returns an empty list for
        // an unknown type: the foreign key constraint therefore decided in its
        // place, and the client got "Cette donnée entre en conflit avec une
        // donnée existante" - a false sentence, since the data is absent and
        // not conflicting. Same explicit check as POST /entities/quick-add.
        if (request.entityTypeId() != null) {
            entityTypeRepository.findById(request.entityTypeId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "EntityType inconnu : " + request.entityTypeId()));
        }
        TierList list = TierList.create(request.name(), request.entityTypeId(), request.activeRanks(), request.description());
        return toSummary(tierListRepository.save(list));
    }

    @Operation(summary = "Detail of a Tier List (full board, ranked and unranked)")
    @GetMapping("/{id}")
    public TierListDetailResponse detail(@PathVariable UUID id) {
        TierList list = requireTierList(id);
        List<Map.Entry<TierListItem, Entity>> entries = tierListService.enrichedItems(id);
        List<TierListEntryResponse> ranked = entries.stream()
                .filter(e -> e.getKey().rank().isPresent())
                .sorted(Comparator.comparing(e -> e.getKey().rank().get()))
                .map(e -> TierListEntryResponse.from(e.getKey(), e.getValue()))
                .collect(Collectors.toList());
        List<TierListEntryResponse> unranked = entries.stream()
                .filter(e -> e.getKey().rank().isEmpty())
                .map(e -> TierListEntryResponse.from(e.getKey(), e.getValue()))
                .collect(Collectors.toList());
        return new TierListDetailResponse(toSummary(list), ranked, unranked);
    }

    @Operation(summary = "Rename / change the active ranks / the description of a Tier List")
    @PatchMapping("/{id}")
    public TierListResponse update(@PathVariable UUID id, @RequestBody UpdateTierListRequest request) {
        TierList list = requireTierList(id);
        if (request.name() != null) list.rename(request.name());
        if (request.activeRanks() != null && !request.activeRanks().isEmpty()) list.updateActiveRanks(request.activeRanks());
        if (request.description() != null) list.updateDescription(request.description());
        return toSummary(tierListRepository.save(list));
    }

    @Operation(summary = "Delete a custom Tier List (and its content)")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        tierListItemRepository.deleteByTierListId(id);
        tierListRepository.deleteById(id);
    }

    @Operation(summary = "Add works to a Tier List (unranked at first)")
    @PostMapping("/{id}/items")
    @ResponseStatus(HttpStatus.CREATED)
    public TierListDetailResponse addItems(@PathVariable UUID id, @RequestBody AddTierListItemsRequest request) {
        requireTierList(id);
        // Without this guard, a body without entityIds raised a
        // NullPointerException as a 500 on the for loop below ("Cannot invoke
        // java.util.List.iterator()") - see Batch 28.
        if (request.entityIds() == null || request.entityIds().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Aucune œuvre à ajouter");
        }
        // The works already present, read IN ONE GO: the loop queried the
        // database for each one, while "Add" sends as many as were
        // checked at once. findByTierListId is already the path used by
        // the screen right after (see detail).
        Set<UUID> dejaPresentes = tierListItemRepository.findByTierListId(id).stream()
                .map(TierListItem::entityId)
                .collect(Collectors.toSet());
        for (UUID entityId : request.entityIds()) {
            // Already present: passed over in silence, this is a wanted idempotence
            // (adding a work that is already there is not a mistake of the caller).
            if (!dejaPresentes.add(entityId)) continue;
            // Unknown: refused, never ignored. An ifPresent() returned a 201
            // with an unchanged list - the caller believed they had added a work
            // that does not exist (Batch 28).
            entityRepository.findById(entityId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Entité introuvable : " + entityId));
            tierListItemRepository.save(TierListItem.add(id, entityId));
        }
        return detail(id);
    }

    @Operation(summary = "Rank (or unrank if rank=null) a work already added to this Tier List")
    @PutMapping("/{id}/items/{entityId}")
    public TierListEntryResponse setItemRank(@PathVariable UUID id, @PathVariable UUID entityId, @RequestBody SetRankRequest request) {
        TierListItem item = tierListItemRepository.findByTierListIdAndEntityId(id, entityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cette œuvre n'appartient pas à cette Tier List"));
        item.setRank(request.rank());
        tierListItemRepository.save(item);
        Entity entity = entityRepository.findById(entityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Entité introuvable : " + entityId));
        return TierListEntryResponse.from(entity, request.rank());
    }

    @Operation(summary = "Remove a work from a custom Tier List")
    @DeleteMapping("/{id}/items/{entityId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeItem(@PathVariable UUID id, @PathVariable UUID entityId) {
        tierListItemRepository.deleteByTierListIdAndEntityId(id, entityId);
    }

    private TierList requireTierList(UUID id) {
        return tierListRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tier List introuvable : " + id));
    }

    private TierListResponse toSummary(TierList list) {
        List<TierListItem> items = tierListItemRepository.findByTierListId(list.id());
        int ranked = (int) items.stream().filter(i -> i.rank().isPresent()).count();
        return TierListResponse.from(list, items.size(), ranked);
    }
}
