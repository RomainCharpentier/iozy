package com.iozycore.infrastructure.persistence.catalog;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.Variant;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Repository
@Transactional
public class JpaEntityRepositoryAdapter implements EntityRepository {

    private final EntityJpaRepository entityJpaRepository;
    private final VariantJpaRepository variantJpaRepository;

    public JpaEntityRepositoryAdapter(EntityJpaRepository entityJpaRepository,
                                       VariantJpaRepository variantJpaRepository) {
        this.entityJpaRepository = entityJpaRepository;
        this.variantJpaRepository = variantJpaRepository;
    }

    @Override
    public Entity save(Entity entity) {
        Instant createdAt = entityJpaRepository.findById(entity.id())
                .map(EntityJpaEntity::getCreatedAt)
                .orElse(Instant.now());

        EntityJpaEntity saved = entityJpaRepository.save(EntityMapper.toJpa(entity, createdAt));

        // Les variants sont internes à l'Entity, mais peuvent être référencés
        // par une Ownership (FK ownership.variant_id) - on ne peut donc pas les
        // supprimer intégralement puis les recréer à l'identique comme avant :
        // supprimer un Variant encore référencé lève une violation de contrainte,
        // même s'il est réinséré avec le même id juste après (constaté : ajouter
        // un 2e tome à une série qui possède déjà une Ownership sur son 1er tome
        // levait une DataIntegrityViolationException). On ne supprime donc que
        // les variants qui ont réellement disparu de l'Entity, et on upsert
        // (save) le reste - un id déjà connu de Postgres devient une mise à
        // jour, un id inconnu une insertion (même mécanisme que EntityJpaEntity
        // ci-dessus).
        List<VariantJpaEntity> existingVariants = variantJpaRepository.findByEntityId(entity.id());
        Set<UUID> currentVariantIds = entity.variants().stream().map(Variant::id).collect(Collectors.toSet());
        List<VariantJpaEntity> removedVariants = existingVariants.stream()
                .filter(variant -> !currentVariantIds.contains(variant.getId()))
                .collect(Collectors.toList());
        variantJpaRepository.deleteAll(removedVariants);
        variantJpaRepository.saveAll(EntityMapper.toJpaVariants(entity));

        return EntityMapper.toDomain(saved, variantJpaRepository.findByEntityId(entity.id()));
    }

    @Override
    public Optional<Entity> findById(UUID id) {
        return entityJpaRepository.findById(id)
                .map(jpaEntity -> {
                    List<VariantJpaEntity> variants = variantJpaRepository.findByEntityId(id);
                    return EntityMapper.toDomain(jpaEntity, variants);
                });
    }

    @Override
    public Optional<Entity> findByTypeAndTitle(UUID entityTypeId, String title) {
        return entityJpaRepository.findByEntityTypeIdAndTitleIgnoreCase(entityTypeId, title)
                .map(jpaEntity -> {
                    List<VariantJpaEntity> variants = variantJpaRepository.findByEntityId(jpaEntity.getId());
                    return EntityMapper.toDomain(jpaEntity, variants);
                });
    }

    @Override
    public List<Entity> findAllByType(UUID entityTypeId) {
        return entityJpaRepository.findByEntityTypeId(entityTypeId).stream()
                .map(jpaEntity -> {
                    List<VariantJpaEntity> variants = variantJpaRepository.findByEntityId(jpaEntity.getId());
                    return EntityMapper.toDomain(jpaEntity, variants);
                })
                .collect(java.util.stream.Collectors.toList());
    }

    @Override
    public List<Entity> search(String titleQuery, UUID entityTypeId, UUID tagId) {
        return entityJpaRepository.search(titleQuery, entityTypeId, tagId).stream()
                .map(jpaEntity -> {
                    List<VariantJpaEntity> variants = variantJpaRepository.findByEntityId(jpaEntity.getId());
                    return EntityMapper.toDomain(jpaEntity, variants);
                })
                .collect(java.util.stream.Collectors.toList());
    }

    @Override
    public boolean existsByType(UUID entityTypeId) {
        return entityJpaRepository.existsByEntityTypeId(entityTypeId);
    }

    @Override
    public void deleteById(UUID id) {
        entityJpaRepository.deleteById(id);
    }
}
