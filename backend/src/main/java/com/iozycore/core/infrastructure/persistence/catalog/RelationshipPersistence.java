package com.iozycore.core.infrastructure.persistence.catalog;

import com.iozycore.core.domain.catalog.Relationship;
import com.iozycore.core.domain.catalog.RelationshipRepository;
import jakarta.persistence.Column;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@jakarta.persistence.Entity
@Table(name = "relationship")
class RelationshipJpaEntity {

    @Id
    private UUID id;

    @Column(name = "source_entity_id", nullable = false)
    private UUID sourceEntityId;

    @Column(name = "target_entity_id", nullable = false)
    private UUID targetEntityId;

    @Column(name = "relationship_type", nullable = false)
    private String relationshipType;

    protected RelationshipJpaEntity() {
    }

    RelationshipJpaEntity(UUID id, UUID sourceEntityId, UUID targetEntityId, String relationshipType) {
        this.id = id;
        this.sourceEntityId = sourceEntityId;
        this.targetEntityId = targetEntityId;
        this.relationshipType = relationshipType;
    }

    UUID getId() { return id; }
    UUID getSourceEntityId() { return sourceEntityId; }
    UUID getTargetEntityId() { return targetEntityId; }
    String getRelationshipType() { return relationshipType; }
}

interface RelationshipJpaRepository extends JpaRepository<RelationshipJpaEntity, UUID> {
    List<RelationshipJpaEntity> findBySourceEntityId(UUID sourceEntityId);
    List<RelationshipJpaEntity> findByTargetEntityId(UUID targetEntityId);
}

@Repository
@Transactional
@RequiredArgsConstructor
class JpaRelationshipRepositoryAdapter implements RelationshipRepository {

    private final RelationshipJpaRepository jpaRepository;

    @Override
    public Relationship save(Relationship relationship) {
        RelationshipJpaEntity saved = jpaRepository.save(new RelationshipJpaEntity(
                relationship.id(), relationship.sourceEntityId(), relationship.targetEntityId(),
                relationship.relationshipType()));
        return toDomain(saved);
    }

    @Override
    public Optional<Relationship> findById(UUID id) {
        return jpaRepository.findById(id).map(JpaRelationshipRepositoryAdapter::toDomain);
    }

    @Override
    public List<Relationship> findBySourceEntityId(UUID sourceEntityId) {
        return jpaRepository.findBySourceEntityId(sourceEntityId).stream()
                .map(JpaRelationshipRepositoryAdapter::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public List<Relationship> findByTargetEntityId(UUID targetEntityId) {
        return jpaRepository.findByTargetEntityId(targetEntityId).stream()
                .map(JpaRelationshipRepositoryAdapter::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public List<Relationship> findAll() {
        return jpaRepository.findAll().stream()
                .map(JpaRelationshipRepositoryAdapter::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public void deleteById(UUID id) {
        jpaRepository.deleteById(id);
    }

    private static Relationship toDomain(RelationshipJpaEntity e) {
        return new Relationship(e.getId(), e.getSourceEntityId(), e.getTargetEntityId(), e.getRelationshipType());
    }
}
