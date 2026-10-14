package com.iozycore.core.infrastructure.persistence.catalog;

import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.infrastructure.persistence.catalog.EntityTypeJpaEntity.SchemaJson;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

interface EntityTypeJpaRepository extends JpaRepository<EntityTypeJpaEntity, UUID> {
    Optional<EntityTypeJpaEntity> findByCode(String code);
}

@Repository
@Transactional
@RequiredArgsConstructor
class JpaEntityTypeRepositoryAdapter implements EntityTypeRepository {

    private final EntityTypeJpaRepository jpaRepository;

    @Override
    public EntityType save(EntityType entityType) {
        EntityTypeJpaEntity saved = jpaRepository.save(toJpa(entityType));
        return toDomain(saved);
    }

    @Override
    public Optional<EntityType> findById(UUID id) {
        return jpaRepository.findById(id).map(JpaEntityTypeRepositoryAdapter::toDomain);
    }

    @Override
    public Optional<EntityType> findByCode(String code) {
        return jpaRepository.findByCode(code).map(JpaEntityTypeRepositoryAdapter::toDomain);
    }

    @Override
    public List<EntityType> findAll() {
        return jpaRepository.findAll().stream()
                .map(JpaEntityTypeRepositoryAdapter::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public void deleteById(UUID id) {
        jpaRepository.deleteById(id);
    }

    private static EntityTypeJpaEntity toJpa(EntityType t) {
        SchemaJson schema = new SchemaJson(List.copyOf(t.customFieldKeys()), List.copyOf(t.allowedExperienceTypes()));
        return new EntityTypeJpaEntity(t.id(), t.code(), t.label(), schema, t.colorKey(), t.iconKey(), t.aspectKey());
    }

    private static EntityType toDomain(EntityTypeJpaEntity e) {
        SchemaJson schema = e.getSchema();
        Set<String> allowedExperienceTypes = schema == null || schema.allowedExperienceTypes() == null
                ? Set.of() : Set.copyOf(schema.allowedExperienceTypes());
        Set<String> customFieldKeys = schema == null || schema.customFieldKeys() == null
                ? Set.of() : Set.copyOf(schema.customFieldKeys());
        return EntityType.reconstitute(e.getId(), e.getCode(), e.getLabel(), allowedExperienceTypes, customFieldKeys,
                e.getColorKey(), e.getIconKey(), e.getAspectKey());
    }
}
