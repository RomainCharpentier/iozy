package com.iozycore.infrastructure.persistence.catalog;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

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

        // Les variants sont internes à l'Entity : on les remplace intégralement
        // à chaque sauvegarde plutôt que de diffé les changements (simple et
        // suffisant tant que le volume de variants par Entity reste faible).
        variantJpaRepository.deleteAll(variantJpaRepository.findByEntityId(entity.id()));
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
