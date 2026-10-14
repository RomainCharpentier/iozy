package com.iozycore.core.application;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.tierlist.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Cross-context read (catalog + ownership + tierlist) - same pattern as
 * StatsService (see com.iozycore.core.insights): the tierlist domain only knows
 * its own ports, this service assembles what needs to cross
 * several bounded contexts (e.g. "which owned works of this universe
 * still have no general rank").
 */
@Service
@RequiredArgsConstructor
public class TierListService {

    private final EntityRepository entityRepository;
    private final OwnershipRepository ownershipRepository;
    private final EntityRankRepository entityRankRepository;
    private final TierListRepository tierListRepository;
    private final TierListItemRepository tierListItemRepository;

    /** Entities REALLY owned in a universe - see isOwned() on the web side
     * (ShelfPage/ownership.ts) for the same rule: at least one active
     * Ownership, directly or through a Variant. */
    public List<Entity> ownedEntitiesOfType(UUID entityTypeId) {
        Set<UUID> ownedEntityIds = ownedEntityIds();
        return entityRepository.findAllByType(entityTypeId).stream()
                .filter(e -> ownedEntityIds.contains(e.id()))
                .collect(Collectors.toList());
    }

    /** The Entities with at least one active Ownership - sold/lost does not count. */
    private Set<UUID> ownedEntityIds() {
        return ownershipRepository.findAll().stream()
                .filter(com.iozycore.core.domain.ownership.Ownership::isActive)
                .map(com.iozycore.core.domain.ownership.Ownership::entityId)
                .collect(Collectors.toSet());
    }

    public record GeneralBoard(Map<Rank, List<Entity>> ranked, List<Entity> unranked) {
    }

    /**
     * Full board of the general ranking of a universe.
     * <p>
     * The two halves deliberately do not follow the same rule, and this is
     * the central distinction of this screen:
     * <ul>
     *   <li><b>{@code ranked}</b> - <b>all</b> works of the catalog of this
     *       type that have a rank, owned or not. A ranking says what the
     *       user thinks of a work; selling it does not change their
     *       opinion. This board used to start only from owned works:
     *       selling a manga ranked S made it disappear from the S row while
     *       its EntityRank still existed in the database - an opinion made
     *       invisible by a collection move.</li>
     *   <li><b>{@code unranked}</b> - the <b>owned</b> works without a rank,
     *       that is the "to rank" queue. It deliberately stays
     *       tied to ownership: offering to rank everything that has a
     *       page would drown this queue under works only put in wishes
     *       or passed through the catalog. <b>Being able to be ranked</b> and <b>having to
     *       appear in "to rank"</b> are two separate questions.</li>
     * </ul>
     */
    public GeneralBoard generalBoard(UUID entityTypeId) {
        List<Entity> ofType = entityRepository.findAllByType(entityTypeId);
        Set<UUID> ownedIds = ownedEntityIds();
        Map<UUID, Rank> rankByEntity = entityRankRepository
                .findByEntityIds(ofType.stream().map(Entity::id).collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(EntityRank::entityId, EntityRank::rank));

        Map<Rank, List<Entity>> ranked = new EnumMap<>(Rank.class);
        for (Rank r : Rank.values()) ranked.put(r, new ArrayList<>());
        List<Entity> unranked = new ArrayList<>();
        for (Entity entity : ofType) {
            Rank rank = rankByEntity.get(entity.id());
            if (rank != null) {
                ranked.get(rank).add(entity);
            } else if (ownedIds.contains(entity.id())) {
                unranked.add(entity);
            }
        }
        return new GeneralBoard(ranked, unranked);
    }

    /**
     * Ranks a work on the general ranking, or unranks it when {@code rank} is null.
     * Returns the ranked work.
     */
    @Transactional
    public Entity setGeneralRank(UUID entityId, Rank rank) {
        Entity entity = entityRepository.findById(entityId)
                .orElseThrow(() -> new IllegalArgumentException("Entité introuvable : " + entityId));
        if (rank == null) {
            entityRankRepository.deleteByEntityId(entityId);
            return entity;
        }
        EntityRank entityRank = entityRankRepository.findByEntityId(entityId)
                .map(existing -> {
                    existing.updateRank(rank);
                    return existing;
                })
                .orElseGet(() -> EntityRank.assign(entityId, rank));
        entityRankRepository.save(entityRank);
        return entity;
    }

    public Optional<Rank> generalRankOf(UUID entityId) {
        return entityRankRepository.findByEntityId(entityId).map(EntityRank::rank);
    }

    public record CustomRankEntry(TierList list, Rank rank) {
    }

    /** "My rankings" on the detail page: general rank (if known) + all the
     * custom Tier Lists where this work is REALLY ranked
     * (never those where it is just added without a rank - see the mockup,
     * "General rank: visually dominant", custom lists
     * only show there what is actually ranked). */
    public List<CustomRankEntry> customRanksFor(UUID entityId) {
        List<TierListItem> items = tierListItemRepository.findByEntityId(entityId);
        List<CustomRankEntry> entries = new ArrayList<>();
        for (TierListItem item : items) {
            if (item.rank().isEmpty()) continue;
            tierListRepository.findById(item.tierListId())
                    .ifPresent(list -> entries.add(new CustomRankEntry(list, item.rank().get())));
        }
        return entries;
    }

    /** Items of a custom Tier List, enriched with the Entity - silently
     *  leaves out the items whose Entity has disappeared: a ranking must not
     *  make the reading of a list fail because a work was
     *  deleted in the meantime. */
    public List<Map.Entry<TierListItem, Entity>> enrichedItems(UUID tierListId) {
        List<TierListItem> items = tierListItemRepository.findByTierListId(tierListId);
        List<Map.Entry<TierListItem, Entity>> result = new ArrayList<>();
        for (TierListItem item : items) {
            entityRepository.findById(item.entityId()).ifPresent(entity -> result.add(Map.entry(item, entity)));
        }
        return result;
    }
}
