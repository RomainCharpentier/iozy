package com.iozycore.application;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.tierlist.*;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Lecture cross-contexte (catalog + ownership + tierlist) - même patron que
 * StatsService (voir com.iozycore.insights) : le domaine tierlist ne connaît
 * que ses propres ports, ce service assemble ce qui a besoin de croiser
 * plusieurs bounded contexts (ex: "quelles œuvres possédées de cet univers
 * n'ont encore aucun rang général").
 */
@Service
public class TierListService {

    private final EntityRepository entityRepository;
    private final OwnershipRepository ownershipRepository;
    private final EntityRankRepository entityRankRepository;
    private final TierListRepository tierListRepository;
    private final TierListItemRepository tierListItemRepository;

    public TierListService(EntityRepository entityRepository, OwnershipRepository ownershipRepository,
                            EntityRankRepository entityRankRepository, TierListRepository tierListRepository,
                            TierListItemRepository tierListItemRepository) {
        this.entityRepository = entityRepository;
        this.ownershipRepository = ownershipRepository;
        this.entityRankRepository = entityRankRepository;
        this.tierListRepository = tierListRepository;
        this.tierListItemRepository = tierListItemRepository;
    }

    /** Entités RÉELLEMENT possédées d'un univers - voir isOwned() côté web
     * (ShelfPage/ownership.ts) pour la même règle : au moins une Ownership
     * active, directement ou via un Variant. */
    public List<Entity> ownedEntitiesOfType(UUID entityTypeId) {
        Set<UUID> ownedEntityIds = ownershipRepository.findAll().stream()
                .filter(com.iozycore.domain.ownership.Ownership::isActive)
                .map(com.iozycore.domain.ownership.Ownership::entityId)
                .collect(Collectors.toSet());
        return entityRepository.findAllByType(entityTypeId).stream()
                .filter(e -> ownedEntityIds.contains(e.id()))
                .collect(Collectors.toList());
    }

    public record GeneralBoard(Map<Rank, List<Entity>> ranked, List<Entity> unranked) {
    }

    /** Board complet du classement général d'un univers : possédées classées
     * groupées par rang (voir TierBoard côté maquette), possédées non
     * classées à part (voir "Classer mes éléments"). */
    public GeneralBoard generalBoard(UUID entityTypeId) {
        List<Entity> owned = ownedEntitiesOfType(entityTypeId);
        Map<UUID, Entity> byId = owned.stream().collect(Collectors.toMap(Entity::id, e -> e));
        List<EntityRank> ranks = entityRankRepository.findByEntityIds(byId.keySet());
        Map<UUID, Rank> rankByEntity = ranks.stream()
                .collect(Collectors.toMap(EntityRank::entityId, EntityRank::rank));

        Map<Rank, List<Entity>> ranked = new EnumMap<>(Rank.class);
        for (Rank r : Rank.values()) ranked.put(r, new ArrayList<>());
        List<Entity> unranked = new ArrayList<>();
        for (Entity entity : owned) {
            Rank rank = rankByEntity.get(entity.id());
            if (rank == null) unranked.add(entity);
            else ranked.get(rank).add(entity);
        }
        return new GeneralBoard(ranked, unranked);
    }

    public record CustomRankEntry(TierList list, Rank rank) {
    }

    /** "Mes classements" côté fiche : rang général (si connu) + toutes les
     * Tier Lists personnalisées où cette œuvre est RÉELLEMENT classée
     * (jamais celles où elle est juste ajoutée sans rang - voir la maquette,
     * "Rang général : visuellement dominant", les listes personnalisées
     * n'y montrent que ce qui est effectivement classé). */
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

    /** Éléments d'une Tier List personnalisée, enrichis de l'Entity - vide silencieusement les items dont l'Entity a disparu (même garde que EditionUpgradeWishController.enrich). */
    public List<Map.Entry<TierListItem, Entity>> enrichedItems(UUID tierListId) {
        List<TierListItem> items = tierListItemRepository.findByTierListId(tierListId);
        List<Map.Entry<TierListItem, Entity>> result = new ArrayList<>();
        for (TierListItem item : items) {
            entityRepository.findById(item.entityId()).ifPresent(entity -> result.add(Map.entry(item, entity)));
        }
        return result;
    }
}
