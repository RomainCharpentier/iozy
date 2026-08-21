package com.iozycore.api.relationship;

import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.Relationship;
import com.iozycore.domain.catalog.RelationshipRepository;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/relationships")
public class RelationshipController {

    public record CreateRelationshipRequest(UUID sourceEntityId, UUID targetEntityId, String relationshipType) {
    }

    private final RelationshipRepository relationshipRepository;
    private final EntityRepository entityRepository;

    public RelationshipController(RelationshipRepository relationshipRepository, EntityRepository entityRepository) {
        this.relationshipRepository = relationshipRepository;
        this.entityRepository = entityRepository;
    }

    @Operation(summary = "Créer une relation typée entre deux Entity (ex: ADAPTED_INTO, PART_OF_SERIES)")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Relationship create(@RequestBody CreateRelationshipRequest request) {
        Relationship relationship = new Relationship(
                UUID.randomUUID(), request.sourceEntityId(), request.targetEntityId(), request.relationshipType());
        // Les deux extrémités doivent exister : sinon seule la contrainte de clé
        // étrangère de Postgres protégeait la table, et remontait en 500 avec la
        // requête SQL et le nom de la contrainte (Lot 28). Même contrôle que
        // EditionUpgradeWishController, qui référence lui aussi une Entity.
        requireEntity(relationship.sourceEntityId());
        requireEntity(relationship.targetEntityId());
        return relationshipRepository.save(relationship);
    }

    private void requireEntity(UUID entityId) {
        if (entityRepository.findById(entityId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Entité introuvable : " + entityId);
        }
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
