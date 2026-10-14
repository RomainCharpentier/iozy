package com.iozycore.core.api.relationship;

import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.Relationship;
import com.iozycore.core.domain.catalog.RelationshipRepository;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/relationships")
@RequiredArgsConstructor
public class RelationshipController {

    public record CreateRelationshipRequest(UUID sourceEntityId, UUID targetEntityId, String relationshipType) {
    }

    /**
     * Fixes the TYPE of an existing relationship - the only fix that makes
     * sense here. Changing an end does not fix a relationship, it
     * describes another one: we then delete this one and create a right one.
     * <p>
     * The type is all the more fixable as it is chosen among
     * presets or in free text at creation time, without the
     * detail page showing it again afterwards - a mistake went unnoticed there.
     */
    public record UpdateRelationshipRequest(String relationshipType) {
    }

    private final RelationshipRepository relationshipRepository;
    private final EntityRepository entityRepository;

    @Operation(summary = "Create a typed relationship between two Entities (e.g. ADAPTED_INTO, PART_OF_SERIES)")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Relationship create(@RequestBody CreateRelationshipRequest request) {
        Relationship relationship = new Relationship(
                UUID.randomUUID(), request.sourceEntityId(), request.targetEntityId(), request.relationshipType());
        // Both ends must exist: otherwise only the foreign key constraint
        // of Postgres protected the table, and came up as a 500 with the
        // SQL query and the name of the constraint (Batch 28). Same check everywhere
        // a request body designates an Entity by its id.
        requireEntity(relationship.sourceEntityId());
        requireEntity(relationship.targetEntityId());
        return relationshipRepository.save(relationship);
    }

    private void requireEntity(UUID entityId) {
        if (entityRepository.findById(entityId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Entité introuvable : " + entityId);
        }
    }

    @Operation(summary = "Fix the type of an existing relationship (e.g. ADAPTED_INTO typed instead of SPIN_OFF)")
    @PatchMapping("/{id}")
    public Relationship update(@PathVariable UUID id, @RequestBody UpdateRelationshipRequest request) {
        Relationship existing = relationshipRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Relation introuvable : " + id));
        try {
            // The ends are taken as they are: only the type changes.
            // The validation (non-empty type) lives in the compact constructor of
            // Relationship - we only translate its refusal into a 400.
            return relationshipRepository.save(new Relationship(
                    existing.id(), existing.sourceEntityId(), existing.targetEntityId(), request.relationshipType()));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    @Operation(summary = "Delete a relationship created by mistake - idempotent, touches neither of the two works")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        relationshipRepository.deleteById(id);
    }

    @Operation(summary = "List the relationships where the Entity is the source")
    @GetMapping("/from/{entityId}")
    public List<Relationship> fromEntity(@PathVariable UUID entityId) {
        return relationshipRepository.findBySourceEntityId(entityId);
    }

    @Operation(summary = "List the relationships where the Entity is the target")
    @GetMapping("/to/{entityId}")
    public List<Relationship> toEntity(@PathVariable UUID entityId) {
        return relationshipRepository.findByTargetEntityId(entityId);
    }
}
