package com.iozycore.core.api.relationship;

import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.Relationship;
import com.iozycore.core.domain.catalog.RelationshipRepository;
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

    /**
     * Corrige le TYPE d'une relation existante - la seule correction qui ait un
     * sens ici. Changer une extrémité ne corrige pas une relation, c'est en
     * décrire une autre : on supprime alors celle-ci et on en crée une bonne.
     * <p>
     * Le type est d'autant plus corrigeable qu'il se choisit parmi des
     * présélections ou en texte libre au moment de la création, sans que la
     * fiche ne le réaffiche ensuite - une erreur y passait inaperçue.
     */
    public record UpdateRelationshipRequest(String relationshipType) {
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
        // requête SQL et le nom de la contrainte (Lot 28). Même contrôle partout
        // où un corps de requête désigne une Entity par son identifiant.
        requireEntity(relationship.sourceEntityId());
        requireEntity(relationship.targetEntityId());
        return relationshipRepository.save(relationship);
    }

    private void requireEntity(UUID entityId) {
        if (entityRepository.findById(entityId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Entité introuvable : " + entityId);
        }
    }

    @Operation(summary = "Corriger le type d'une relation existante (ex: ADAPTED_INTO saisi à la place de SPIN_OFF)")
    @PatchMapping("/{id}")
    public Relationship update(@PathVariable UUID id, @RequestBody UpdateRelationshipRequest request) {
        Relationship existing = relationshipRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Relation introuvable : " + id));
        try {
            // Les extrémités sont reprises telles quelles : seul le type change.
            // La validation (type non vide) vit dans le constructeur compact de
            // Relationship - on traduit juste son refus en 400.
            return relationshipRepository.save(new Relationship(
                    existing.id(), existing.sourceEntityId(), existing.targetEntityId(), request.relationshipType()));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    @Operation(summary = "Supprimer une relation créée par erreur - idempotent, ne touche à aucune des deux œuvres")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        relationshipRepository.deleteById(id);
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
