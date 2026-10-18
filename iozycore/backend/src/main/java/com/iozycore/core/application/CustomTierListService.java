package com.iozycore.core.application;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.tierlist.Rank;
import com.iozycore.core.domain.tierlist.TierList;
import com.iozycore.core.domain.tierlist.TierListItem;
import com.iozycore.core.domain.tierlist.TierListItemRepository;
import com.iozycore.core.domain.tierlist.TierListRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Use cases of the custom Tier Lists: named lists with an explicit membership
 * (see com.iozycore.core.domain.tierlist). The general ranking lives in
 * {@link TierListService}.
 * <p>
 * An empty {@link Optional} means the Tier List (or the item) does not exist:
 * the caller decides how to say it. Bad input raises an
 * {@link IllegalArgumentException}.
 */
@Service
@RequiredArgsConstructor
public class CustomTierListService {

    private final TierListRepository tierListRepository;
    private final TierListItemRepository tierListItemRepository;
    private final EntityRepository entityRepository;
    private final EntityTypeRepository entityTypeRepository;
    private final TierListService tierListService;

    /** A Tier List with its counters, as the lists show it. */
    public record TierListSummary(TierList list, int itemCount, int rankedCount) {
    }

    /** A Tier List with its board: ranked works sorted by rank, then the unranked ones. */
    public record TierListDetail(TierListSummary summary,
                                 List<Map.Entry<TierListItem, Entity>> ranked,
                                 List<Map.Entry<TierListItem, Entity>> unranked) {
    }

    /**
     * Tier Lists of a universe. {@code entityTypeId} null = the cross-cutting
     * "all categories" lists (see TierList.isAllUniverses), never all the lists
     * mixed together.
     */
    public List<TierListSummary> listsOf(UUID entityTypeId) {
        List<TierList> lists = entityTypeId == null
                ? tierListRepository.findAllUniversesLists()
                : tierListRepository.findByEntityTypeId(entityTypeId);
        return lists.stream().map(this::summaryOf).collect(Collectors.toList());
    }

    @Transactional
    public TierListSummary create(String name, UUID entityTypeId, Set<Rank> activeRanks, String description) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Le nom de la Tier List ne peut pas être vide");
        }
        // entityTypeId null = cross-cutting "all categories" list: there is no
        // universe to check. When a universe IS requested, it must exist: without
        // this check the foreign key decided, and the client got a false
        // "conflict" message for a type that is simply absent.
        if (entityTypeId != null) {
            entityTypeRepository.findById(entityTypeId)
                    .orElseThrow(() -> new IllegalArgumentException("EntityType inconnu : " + entityTypeId));
        }
        TierList list = TierList.create(name, entityTypeId, activeRanks, description);
        return summaryOf(tierListRepository.save(list));
    }

    public Optional<TierListDetail> detail(UUID id) {
        return tierListRepository.findById(id).map(this::detailOf);
    }

    /** Renames, changes the active ranks or the description. A null field is left unchanged. */
    @Transactional
    public Optional<TierListSummary> update(UUID id, String name, Set<Rank> activeRanks, String description) {
        return tierListRepository.findById(id).map(list -> {
            if (name != null) list.rename(name);
            if (activeRanks != null && !activeRanks.isEmpty()) list.updateActiveRanks(activeRanks);
            if (description != null) list.updateDescription(description);
            return summaryOf(tierListRepository.save(list));
        });
    }

    /** Deletes the Tier List and its content, never the works. */
    @Transactional
    public void delete(UUID id) {
        tierListItemRepository.deleteByTierListId(id);
        tierListRepository.deleteById(id);
    }

    /**
     * Adds works, unranked at first. A work already in the list is passed over
     * in silence (adding it again is not a mistake); an unknown work is refused,
     * never ignored.
     */
    @Transactional
    public Optional<TierListDetail> addItems(UUID id, List<UUID> entityIds) {
        Optional<TierList> list = tierListRepository.findById(id);
        if (list.isEmpty()) {
            return Optional.empty();
        }
        if (entityIds == null || entityIds.isEmpty()) {
            throw new IllegalArgumentException("Aucune œuvre à ajouter");
        }
        // The works already present, read IN ONE GO: "Add" sends as many works
        // as were checked at once.
        Set<UUID> alreadyPresent = tierListItemRepository.findByTierListId(id).stream()
                .map(TierListItem::entityId)
                .collect(Collectors.toSet());
        for (UUID entityId : entityIds) {
            if (!alreadyPresent.add(entityId)) continue;
            entityRepository.findById(entityId)
                    .orElseThrow(() -> new IllegalArgumentException("Entité introuvable : " + entityId));
            tierListItemRepository.save(TierListItem.add(id, entityId));
        }
        return Optional.of(detailOf(list.get()));
    }

    /**
     * Ranks (or unranks when {@code rank} is null) a work already in the list.
     * Empty when the work is not in this Tier List. Returns the ranked work.
     */
    @Transactional
    public Optional<Entity> setItemRank(UUID id, UUID entityId, Rank rank) {
        return tierListItemRepository.findByTierListIdAndEntityId(id, entityId).map(item -> {
            item.setRank(rank);
            tierListItemRepository.save(item);
            return entityRepository.findById(entityId)
                    .orElseThrow(() -> new IllegalArgumentException("Entité introuvable : " + entityId));
        });
    }

    @Transactional
    public void removeItem(UUID id, UUID entityId) {
        tierListItemRepository.deleteByTierListIdAndEntityId(id, entityId);
    }

    private TierListDetail detailOf(TierList list) {
        List<Map.Entry<TierListItem, Entity>> entries = tierListService.enrichedItems(list.id());
        List<Map.Entry<TierListItem, Entity>> ranked = entries.stream()
                .filter(e -> e.getKey().rank().isPresent())
                .sorted(Comparator.comparing(e -> e.getKey().rank().get()))
                .collect(Collectors.toList());
        List<Map.Entry<TierListItem, Entity>> unranked = entries.stream()
                .filter(e -> e.getKey().rank().isEmpty())
                .collect(Collectors.toList());
        return new TierListDetail(summaryOf(list), ranked, unranked);
    }

    private TierListSummary summaryOf(TierList list) {
        List<TierListItem> items = tierListItemRepository.findByTierListId(list.id());
        int ranked = (int) items.stream().filter(i -> i.rank().isPresent()).count();
        return new TierListSummary(list, items.size(), ranked);
    }
}
