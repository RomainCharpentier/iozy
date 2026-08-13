package com.iozycore.export;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.domain.catalog.EntityTypeRepository;
import com.iozycore.domain.catalog.Relationship;
import com.iozycore.domain.catalog.RelationshipRepository;
import com.iozycore.domain.catalog.Tag;
import com.iozycore.domain.catalog.TagRepository;
import com.iozycore.domain.catalog.Variant;
import com.iozycore.domain.experience.Experience;
import com.iozycore.domain.experience.ExperienceRepository;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.wishlist.WishlistEntry;
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

    public ExportService(EntityRepository entityRepository, EntityTypeRepository entityTypeRepository,
                          OwnershipRepository ownershipRepository, ExperienceRepository experienceRepository,
                          WishlistEntryRepository wishlistEntryRepository,
                          RelationshipRepository relationshipRepository, TagRepository tagRepository) {
        this.entityRepository = entityRepository;
        this.entityTypeRepository = entityTypeRepository;
        this.ownershipRepository = ownershipRepository;
        this.experienceRepository = experienceRepository;
        this.wishlistEntryRepository = wishlistEntryRepository;
        this.relationshipRepository = relationshipRepository;
        this.tagRepository = tagRepository;
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
                .map(entry -> toWishlistExport(entry, entitiesById))
                .toList();

        List<ExportDocument.RelationshipExport> relationshipExports = relationshipRepository.findAll().stream()
                .map(relationship -> toRelationshipExport(relationship, entitiesById))
                .toList();

        List<ExportDocument.TagExport> tagExports = tagsById.values().stream()
                .map(tag -> new ExportDocument.TagExport(tag.id(), tag.label()))
                .toList();

        return new ExportDocument(Instant.now().toString(), entityExports, ownershipExports, experienceExports,
                wishlistExports, relationshipExports, tagExports);
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
                .map(v -> new ExportDocument.VariantExport(v.id(), v.label(), v.attributes()))
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

    private static ExportDocument.WishlistEntryExport toWishlistExport(WishlistEntry entry, Map<UUID, Entity> entitiesById) {
        Entity entity = entitiesById.get(entry.entityId());
        return new ExportDocument.WishlistEntryExport(entry.id(), entry.entityId(),
                entity != null ? entity.title() : null, entry.addedAt());
    }

    private static ExportDocument.RelationshipExport toRelationshipExport(Relationship relationship, Map<UUID, Entity> entitiesById) {
        Entity source = entitiesById.get(relationship.sourceEntityId());
        Entity target = entitiesById.get(relationship.targetEntityId());
        return new ExportDocument.RelationshipExport(relationship.id(), relationship.sourceEntityId(),
                source != null ? source.title() : null, relationship.targetEntityId(),
                target != null ? target.title() : null, relationship.relationshipType());
    }
}
