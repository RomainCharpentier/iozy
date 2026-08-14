package com.iozycore.infrastructure.persistence.catalog;

import com.iozycore.domain.catalog.Variant;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Traduit entre com.iozycore.domain.catalog.Entity et sa représentation
 * JPA. Les tags sont désormais portés par la table entity_tag (via
 * EntityJpaEntity.tagIds), les Relationship restent gérées séparément
 * (agrégat indépendant, cf. RelationshipPersistence).
 */
public final class EntityMapper {

    private EntityMapper() {
    }

    public static com.iozycore.domain.catalog.Entity toDomain(EntityJpaEntity jpaEntity, List<VariantJpaEntity> jpaVariants) {
        List<Variant> variants = jpaVariants.stream()
                .map(v -> new Variant(v.getId(), v.getLabel(), v.getAttributes(), v.getMangaEditionId()))
                .collect(Collectors.toList());

        return com.iozycore.domain.catalog.Entity.reconstitute(
                jpaEntity.getId(),
                jpaEntity.getEntityTypeId(),
                jpaEntity.getTitle(),
                jpaEntity.getAttributes(),
                variants,
                jpaEntity.getTagIds()
        );
    }

    public static EntityJpaEntity toJpa(com.iozycore.domain.catalog.Entity domainEntity, Instant createdAt) {
        return new EntityJpaEntity(
                domainEntity.id(),
                domainEntity.entityTypeId(),
                domainEntity.title(),
                domainEntity.attributes(),
                domainEntity.tagIds(),
                createdAt,
                Instant.now()
        );
    }

    public static List<VariantJpaEntity> toJpaVariants(com.iozycore.domain.catalog.Entity domainEntity) {
        return domainEntity.variants().stream()
                .map(v -> new VariantJpaEntity(v.id(), domainEntity.id(), v.label(), v.attributes(), v.mangaEditionId()))
                .collect(Collectors.toList());
    }
}
