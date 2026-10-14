package com.iozycore.core.application;

import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.Relationship;
import com.iozycore.core.domain.catalog.RelationshipRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/** Use cases of the typed relationships between two works (ADAPTED_INTO, PART_OF_SERIES...). */
@Service
@RequiredArgsConstructor
public class RelationshipService {

    private final RelationshipRepository relationshipRepository;
    private final EntityRepository entityRepository;

    @Transactional
    public Relationship create(UUID sourceEntityId, UUID targetEntityId, String relationshipType) {
        Relationship relationship = new Relationship(UUID.randomUUID(), sourceEntityId, targetEntityId, relationshipType);
        // Both ends must exist: otherwise only the foreign key protected the
        // table, and it came up as a 500 with the SQL query (Batch 28).
        requireEntity(relationship.sourceEntityId());
        requireEntity(relationship.targetEntityId());
        return relationshipRepository.save(relationship);
    }

    /**
     * Fixes the TYPE only: the ends are kept as they are. The validation (non-empty
     * type) lives in the Relationship constructor, whose refusal is a 400.
     */
    @Transactional
    public Relationship changeType(UUID id, String relationshipType) {
        Relationship existing = relationshipRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Relation introuvable : " + id));
        return relationshipRepository.save(new Relationship(
                existing.id(), existing.sourceEntityId(), existing.targetEntityId(), relationshipType));
    }

    /** Idempotent, touches neither of the two works. */
    @Transactional
    public void delete(UUID id) {
        relationshipRepository.deleteById(id);
    }

    public List<Relationship> from(UUID entityId) {
        return relationshipRepository.findBySourceEntityId(entityId);
    }

    public List<Relationship> to(UUID entityId) {
        return relationshipRepository.findByTargetEntityId(entityId);
    }

    private void requireEntity(UUID entityId) {
        if (entityRepository.findById(entityId).isEmpty()) {
            throw new IllegalArgumentException("Entité introuvable : " + entityId);
        }
    }
}
