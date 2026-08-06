package com.iozycore.api.relationship;

import com.iozycore.domain.catalog.Relationship;
import com.iozycore.domain.catalog.RelationshipRepository;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/relationships")
public class RelationshipController {

    public record CreateRelationshipRequest(UUID sourceEntityId, UUID targetEntityId, String relationshipType) {
    }

    private final RelationshipRepository relationshipRepository;

    public RelationshipController(RelationshipRepository relationshipRepository) {
        this.relationshipRepository = relationshipRepository;
    }

    @Operation(summary = "Créer une relation typée entre deux Entity (ex: ADAPTED_INTO, PART_OF_SERIES)")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Relationship create(@RequestBody CreateRelationshipRequest request) {
        Relationship relationship = new Relationship(
                UUID.randomUUID(), request.sourceEntityId(), request.targetEntityId(), request.relationshipType());
        return relationshipRepository.save(relationship);
    }

    @Operation(summary = "Lister les relations où l'Entity est source")
    @GetMapping("/from/{entityId}")
    public List<Relationship> fromEntity(@PathVariable UUID entityId) {
        return relationshipRepository.findBySourceEntityId(entityId);
    }

    @Operation(summary = "Lister les relations où l'Entity est cible")
    @GetMapping("/to/{entityId}")
    public List<Relationship> toEntity(@PathVariable UUID entityId) {
        return relationshipRepository.findByTargetEntityId(entityId);
    }
}
