package com.iozycore.export;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.domain.catalog.EntityTypeRepository;
import com.iozycore.domain.catalog.MangaEditionRepository;
import com.iozycore.domain.catalog.Relationship;
import com.iozycore.domain.catalog.RelationshipRepository;
import com.iozycore.domain.catalog.Tag;
import com.iozycore.domain.catalog.TagRepository;
import com.iozycore.domain.catalog.Variant;
import com.iozycore.domain.experience.Experience;
import com.iozycore.domain.followededition.FollowedEdition;
import com.iozycore.domain.followededition.FollowedEditionRepository;
import com.iozycore.domain.experience.ExperienceRepository;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.tierlist.EntityRankRepository;
import com.iozycore.domain.tierlist.TierList;
import com.iozycore.domain.tierlist.TierListItemRepository;
import com.iozycore.domain.tierlist.TierListRepository;
import com.iozycore.domain.wishlist.WishlistEntry;
import com.iozycore.purchaseanalysis.CollectorPreferences;
import com.iozycore.purchaseanalysis.CollectorPreferencesRepository;
import com.iozycore.purchaseanalysis.MarketPriceObservation;
import com.iozycore.purchaseanalysis.MarketPriceObservationRepository;
import com.iozycore.domain.wishlist.WishlistEntryRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * "Export complet des données (JSON/CSV)" (§19, docs/CONCEPTION.md) -
 * lecture pure cross-context, ne modifie jamais Catalog/Ownership/
 * Experience/Wishlist (même patron que StatsService). Voir ExportDocument
 * pour le principe de dénormalisation qui rend l'export auto-suffisant.
 */
@Service
public class ExportService {

    private final EntityRepository entityRepository;
    private final EntityTypeRepository entityTypeRepository;
    private final OwnershipRepository ownershipRepository;
    private final ExperienceRepository experienceRepository;
    private final WishlistEntryRepository wishlistEntryRepository;
    private final RelationshipRepository relationshipRepository;
    private final TagRepository tagRepository;
    private final MangaEditionRepository mangaEditionRepository;
    private final EntityRankRepository entityRankRepository;
    private final TierListRepository tierListRepository;
    private final TierListItemRepository tierListItemRepository;
    private final MarketPriceObservationRepository marketPriceObservationRepository;
    private final FollowedEditionRepository followedEditionRepository;
    private final CollectorPreferencesRepository collectorPreferencesRepository;

    public ExportService(EntityRepository entityRepository, EntityTypeRepository entityTypeRepository,
                          OwnershipRepository ownershipRepository, ExperienceRepository experienceRepository,
                          WishlistEntryRepository wishlistEntryRepository,
                          RelationshipRepository relationshipRepository, TagRepository tagRepository,
                          MangaEditionRepository mangaEditionRepository,
                          EntityRankRepository entityRankRepository,
                          TierListRepository tierListRepository,
                          TierListItemRepository tierListItemRepository,
                          MarketPriceObservationRepository marketPriceObservationRepository,
                          FollowedEditionRepository followedEditionRepository,
                          CollectorPreferencesRepository collectorPreferencesRepository) {
        this.entityRepository = entityRepository;
        this.entityTypeRepository = entityTypeRepository;
        this.ownershipRepository = ownershipRepository;
        this.experienceRepository = experienceRepository;
        this.wishlistEntryRepository = wishlistEntryRepository;
        this.relationshipRepository = relationshipRepository;
        this.tagRepository = tagRepository;
        this.mangaEditionRepository = mangaEditionRepository;
        this.entityRankRepository = entityRankRepository;
        this.tierListRepository = tierListRepository;
        this.tierListItemRepository = tierListItemRepository;
        this.marketPriceObservationRepository = marketPriceObservationRepository;
        this.followedEditionRepository = followedEditionRepository;
        this.collectorPreferencesRepository = collectorPreferencesRepository;
    }

    public ExportDocument buildExportDocument() {
        Map<UUID, EntityType> typesById = entityTypeRepository.findAll().stream()
                .collect(Collectors.toMap(EntityType::id, t -> t));
        Map<UUID, Tag> tagsById = tagRepository.findAll().stream()
                .collect(Collectors.toMap(Tag::id, t -> t));

        List<Entity> allEntities = new ArrayList<>();
        for (EntityType type : typesById.values()) {
            allEntities.addAll(entityRepository.findAllByType(type.id()));
        }
        Map<UUID, Entity> entitiesById = allEntities.stream().collect(Collectors.toMap(Entity::id, e -> e));
        Map<UUID, String> variantLabelsById = allEntities.stream()
                .flatMap(e -> e.variants().stream())
                .collect(Collectors.toMap(Variant::id, Variant::label));

        List<ExportDocument.EntityExport> entityExports = allEntities.stream()
                .map(entity -> toEntityExport(entity, typesById, tagsById))
                .toList();

        List<ExportDocument.OwnershipExport> ownershipExports = ownershipRepository.findAll().stream()
                .map(ownership -> toOwnershipExport(ownership, entitiesById, variantLabelsById))
                .toList();

        List<ExportDocument.ExperienceExport> experienceExports = experienceRepository.findAll().stream()
                .map(experience -> toExperienceExport(experience, entitiesById, variantLabelsById))
                .toList();

        List<ExportDocument.WishlistEntryExport> wishlistExports = wishlistEntryRepository.findAll().stream()
                .map(entry -> toWishlistExport(entry, entitiesById, variantLabelsById))
                .toList();

        List<ExportDocument.RelationshipExport> relationshipExports = relationshipRepository.findAll().stream()
                .map(relationship -> toRelationshipExport(relationship, entitiesById))
                .toList();

        List<ExportDocument.TagExport> tagExports = tagsById.values().stream()
                .map(tag -> new ExportDocument.TagExport(tag.id(), tag.label()))
                .toList();

        List<ExportDocument.MangaEditionExport> editionExports = mangaEditionRepository.findAll().stream()
                .map(e -> new ExportDocument.MangaEditionExport(e.id(), e.entityId(), e.seriesTitle(), e.editionName(),
                        e.tier() == null ? null : e.tier().name(), e.publisher(), e.totalVolumes(),
                        e.retailPriceNewPerVolume(), e.outOfPrint(), e.betterEditionAnnounced(), e.betterEditionNote(),
                        e.languageCode()))
                .toList();

        // findByEntityIds plutôt qu'un findAll inexistant sur ce repository :
        // toutes les œuvres sont déjà chargées ci-dessus, la question est close.
        List<ExportDocument.GeneralRankExport> generalRankExports = entityRankRepository
                .findByEntityIds(entitiesById.keySet()).stream()
                .map(rank -> new ExportDocument.GeneralRankExport(rank.entityId(),
                        titleOf(rank.entityId(), entitiesById), rank.rank().name()))
                .toList();

        List<TierList> allTierLists = new ArrayList<>(tierListRepository.findAllUniversesLists());
        for (EntityType type : typesById.values()) {
            allTierLists.addAll(tierListRepository.findByEntityTypeId(type.id()));
        }
        List<ExportDocument.TierListExport> tierListExports = allTierLists.stream()
                .map(list -> new ExportDocument.TierListExport(list.id(), list.name(),
                        list.entityTypeId().map(id -> labelOf(id, typesById)).orElse(null),
                        list.description().orElse(null),
                        list.activeRanks().stream().map(Enum::name).toList(),
                        tierListItemRepository.findByTierListId(list.id()).stream()
                                .map(item -> new ExportDocument.TierListItemExport(item.entityId(),
                                        titleOf(item.entityId(), entitiesById),
                                        item.rank().map(Enum::name).orElse(null)))
                                .toList()))
                .toList();

        Map<UUID, com.iozycore.domain.catalog.MangaEdition> editionsById = mangaEditionRepository.findAll().stream()
                .collect(Collectors.toMap(com.iozycore.domain.catalog.MangaEdition::id, e -> e));
        List<ExportDocument.MarketObservationExport> observationExports = marketPriceObservationRepository.findAll()
                .stream()
                .map(o -> toObservationExport(o, editionsById))
                .toList();

        // findByEntityIdIn plutot qu'un findAll inexistant sur ce repository :
        // meme geste que pour les classements generaux ci-dessus.
        List<ExportDocument.FollowedEditionExport> followedExports = followedEditionRepository
                .findByEntityIdIn(List.copyOf(entitiesById.keySet())).stream()
                .map(f -> new ExportDocument.FollowedEditionExport(f.id(), f.entityId(),
                        titleOf(f.entityId(), entitiesById), f.editionName(), f.followedAt()))
                .toList();

        List<ExportDocument.EntityTypeExport> typeExports = typesById.values().stream()
                .map(t -> new ExportDocument.EntityTypeExport(t.id(), t.code(), t.label(),
                        List.copyOf(t.allowedExperienceTypes()), List.copyOf(t.customFieldKeys()),
                        t.colorKey(), t.iconKey(), t.aspectKey()))
                .toList();

        CollectorPreferences preferences = collectorPreferencesRepository.find();
        ExportDocument.CollectorPreferencesExport preferencesExport = new ExportDocument.CollectorPreferencesExport(
                preferences.editionTierRanking().stream().map(Enum::name).toList(),
                preferences.avoidOutdatedEditionWhenBetterExistsOrAnnounced(),
                preferences.conditionImportance().name(),
                preferences.minimumDiscountVsRetailPercent(),
                preferences.factorWeights().entrySet().stream()
                        .collect(Collectors.toMap(e -> e.getKey().name(), Map.Entry::getValue)));

        return new ExportDocument(Instant.now().toString(), entityExports, ownershipExports, experienceExports,
                wishlistExports, relationshipExports, tagExports, editionExports, generalRankExports,
                tierListExports, observationExports, followedExports, typeExports, preferencesExport);
    }

    private static ExportDocument.MarketObservationExport toObservationExport(
            MarketPriceObservation o, Map<UUID, com.iozycore.domain.catalog.MangaEdition> editionsById) {
        com.iozycore.domain.catalog.MangaEdition edition = editionsById.get(o.mangaEditionId());
        return new ExportDocument.MarketObservationExport(o.id(), o.mangaEditionId(),
                edition != null ? edition.seriesTitle() : null, edition != null ? edition.editionName() : null,
                o.scope() == null ? null : o.scope().from(), o.scope() == null ? null : o.scope().to(),
                o.volumeCount(), o.observedPrice(),
                o.platform() == null ? null : o.platform().name(),
                o.observedCondition() == null ? null : o.observedCondition().name(),
                o.observedAt(), o.origin() == null ? null : o.origin().name(), o.sourceUrl(), o.note());
    }

    private static ExportDocument.EntityExport toEntityExport(Entity entity, Map<UUID, EntityType> typesById,
                                                                Map<UUID, Tag> tagsById) {
        EntityType type = typesById.get(entity.entityTypeId());
        List<String> tagLabels = entity.tagIds().stream()
                .map(tagsById::get)
                .filter(java.util.Objects::nonNull)
                .map(Tag::label)
                .toList();
        List<ExportDocument.VariantExport> variants = entity.variants().stream()
                .map(v -> new ExportDocument.VariantExport(v.id(), v.label(), v.attributes(), v.mangaEditionId()))
                .toList();
        return new ExportDocument.EntityExport(entity.id(), type != null ? type.code() : null,
                type != null ? type.label() : null, entity.title(), entity.attributes(), tagLabels, variants);
    }

    private static ExportDocument.OwnershipExport toOwnershipExport(Ownership ownership, Map<UUID, Entity> entitiesById,
                                                                      Map<UUID, String> variantLabelsById) {
        Entity entity = entitiesById.get(ownership.entityId());
        UUID variantId = ownership.variantId().orElse(null);
        return new ExportDocument.OwnershipExport(ownership.id(), ownership.entityId(),
                entity != null ? entity.title() : null, variantId,
                variantId != null ? variantLabelsById.get(variantId) : null,
                ownership.condition().name(), ownership.status().name(), ownership.acquiredAt(), ownership.note(),
                ownership.purchasePrice().orElse(null));
    }

    private static ExportDocument.ExperienceExport toExperienceExport(Experience experience, Map<UUID, Entity> entitiesById,
                                                                        Map<UUID, String> variantLabelsById) {
        Entity entity = entitiesById.get(experience.entityId());
        UUID variantId = experience.variantId().orElse(null);
        return new ExportDocument.ExperienceExport(experience.id(), experience.entityId(),
                entity != null ? entity.title() : null, variantId,
                variantId != null ? variantLabelsById.get(variantId) : null,
                experience.experienceType(), experience.occurredAt(), experience.rating().orElse(null),
                experience.comment());
    }

    private static ExportDocument.WishlistEntryExport toWishlistExport(WishlistEntry entry, Map<UUID, Entity> entitiesById,
                                                                        Map<UUID, String> variantLabelsById) {
        Entity entity = entitiesById.get(entry.entityId());
        UUID variantId = entry.variantId().orElse(null);
        return new ExportDocument.WishlistEntryExport(entry.id(), entry.entityId(),
                entity != null ? entity.title() : null, variantId,
                variantId != null ? variantLabelsById.get(variantId) : null, entry.addedAt());
    }

    private static ExportDocument.RelationshipExport toRelationshipExport(Relationship relationship, Map<UUID, Entity> entitiesById) {
        Entity source = entitiesById.get(relationship.sourceEntityId());
        Entity target = entitiesById.get(relationship.targetEntityId());
        return new ExportDocument.RelationshipExport(relationship.id(), relationship.sourceEntityId(),
                source != null ? source.title() : null, relationship.targetEntityId(),
                target != null ? target.title() : null, relationship.relationshipType());
    }

    private static String titleOf(UUID entityId, Map<UUID, Entity> entitiesById) {
        Entity entity = entitiesById.get(entityId);
        return entity == null ? null : entity.title();
    }

    private static String labelOf(UUID entityTypeId, Map<UUID, EntityType> typesById) {
        EntityType type = typesById.get(entityTypeId);
        return type == null ? null : type.label();
    }
}
