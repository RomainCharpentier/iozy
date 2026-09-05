package com.iozycore.core.application;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.tierlist.*;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Lecture cross-contexte (catalog + ownership + tierlist) - même patron que
 * StatsService (voir com.iozycore.core.insights) : le domaine tierlist ne connaît
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
        Set<UUID> ownedEntityIds = ownedEntityIds();
        return entityRepository.findAllByType(entityTypeId).stream()
                .filter(e -> ownedEntityIds.contains(e.id()))
                .collect(Collectors.toList());
    }

    /** Les Entity dont au moins une Ownership est active - vendu/perdu ne compte pas. */
    private Set<UUID> ownedEntityIds() {
        return ownershipRepository.findAll().stream()
                .filter(com.iozycore.core.domain.ownership.Ownership::isActive)
                .map(com.iozycore.core.domain.ownership.Ownership::entityId)
                .collect(Collectors.toSet());
    }

    public record GeneralBoard(Map<Rank, List<Entity>> ranked, List<Entity> unranked) {
    }

    /**
     * Board complet du classement général d'un univers.
     * <p>
     * Les deux moitiés n'obéissent volontairement pas à la même règle, et c'est
     * la distinction centrale de cet écran :
     * <ul>
     *   <li><b>{@code ranked}</b> - <b>toutes</b> les œuvres du catalogue de ce
     *       type qui portent un rang, possédées ou non. Un classement dit ce
     *       que l'utilisateur pense d'une œuvre ; le revendre ne change pas son
     *       avis. Ce board ne partait auparavant que des œuvres possédées :
     *       vendre un manga classé S le faisait disparaître de la ligne S alors
     *       que son EntityRank existait toujours en base - un avis rendu
     *       invisible par un mouvement de collection.</li>
     *   <li><b>{@code unranked}</b> - les œuvres <b>possédées</b> sans rang,
     *       c'est-à-dire la file « à classer ». Elle reste volontairement
     *       adossée à la possession : proposer de classer tout ce qui a une
     *       fiche noierait cette file sous les œuvres seulement mises en envies
     *       ou croisées au catalogue. <b>Pouvoir être classée</b> et <b>devoir
     *       apparaître dans « à classer »</b> sont deux questions distinctes.</li>
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

    /** Éléments d'une Tier List personnalisée, enrichis de l'Entity - vide
     *  silencieusement les items dont l'Entity a disparu : un classement ne doit
     *  pas faire échouer la lecture d'une liste parce qu'une œuvre a été
     *  supprimée entre-temps. */
    public List<Map.Entry<TierListItem, Entity>> enrichedItems(UUID tierListId) {
        List<TierListItem> items = tierListItemRepository.findByTierListId(tierListId);
        List<Map.Entry<TierListItem, Entity>> result = new ArrayList<>();
        for (TierListItem item : items) {
            entityRepository.findById(item.entityId()).ifPresent(entity -> result.add(Map.entry(item, entity)));
        }
        return result;
    }
}
