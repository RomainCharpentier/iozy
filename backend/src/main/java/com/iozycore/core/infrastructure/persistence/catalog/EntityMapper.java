package com.iozycore.core.infrastructure.persistence.catalog;

import com.iozycore.core.domain.catalog.Variant;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Traduit entre com.iozycore.core.domain.catalog.Entity et sa représentation
 * JPA. Les tags sont désormais portés par la table entity_tag (via
 * EntityJpaEntity.tagIds), les Relationship restent gérées séparément
 * (agrégat indépendant, cf. RelationshipPersistence).
 */
public final class EntityMapper {

    private EntityMapper() {
    }

    public static com.iozycore.core.domain.catalog.Entity toDomain(EntityJpaEntity jpaEntity, List<VariantJpaEntity> jpaVariants) {
        List<Variant> variants = jpaVariants.stream()
                .map(v -> new Variant(v.getId(), v.getLabel(), v.getAttributes(), v.getMangaEditionId()))
                .collect(Collectors.toList());

        return com.iozycore.core.domain.catalog.Entity.reconstitute(
                jpaEntity.getId(),
                jpaEntity.getEntityTypeId(),
                jpaEntity.getTitle(),
                jpaEntity.getAttributes(),
                variants,
                jpaEntity.getTagIds(),
                new java.util.HashSet<>(jpaEntity.getManualAttributeKeys())
        );
    }

    public static EntityJpaEntity toJpa(com.iozycore.core.domain.catalog.Entity domainEntity, Instant createdAt) {
        return new EntityJpaEntity(
                domainEntity.id(),
                domainEntity.entityTypeId(),
                domainEntity.title(),
                domainEntity.attributes(),
                domainEntity.champsSaisis(),
                domainEntity.tagIds(),
                createdAt,
                Instant.now()
        );
    }

    public static List<VariantJpaEntity> toJpaVariants(com.iozycore.core.domain.catalog.Entity domainEntity) {
        return domainEntity.variants().stream()
                .map(v -> new VariantJpaEntity(v.id(), domainEntity.id(), v.label(), v.attributes(), v.mangaEditionId()))
                .collect(Collectors.toList());
    }
}
