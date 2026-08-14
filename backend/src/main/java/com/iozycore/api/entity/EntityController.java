package com.iozycore.api.entity;

import com.iozycore.api.dto.EntityDtos.EntityResponse;
import com.iozycore.api.dto.EntityDtos.QuickAddRequest;
import com.iozycore.api.dto.EntityDtos.QuickAddResponse;
import com.iozycore.application.EntityDeletionService;
import com.iozycore.application.QuickAddService;
import com.iozycore.application.QuickAddService.QuickAddResult;
import com.iozycore.application.VariantDeletionService;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityTypeRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/entities")
@Tag(name = "Entities", description = "Catalog - gestion des Entity (mangas, jeux vidéo, jeux de société)")
public class EntityController {

    private final EntityRepository entityRepository;
    private final EntityTypeRepository entityTypeRepository;
    private final QuickAddService quickAddService;
    private final EntityDeletionService entityDeletionService;
    private final VariantDeletionService variantDeletionService;

    public EntityController(EntityRepository entityRepository,
                             EntityTypeRepository entityTypeRepository,
                             QuickAddService quickAddService,
                             EntityDeletionService entityDeletionService,
                             VariantDeletionService variantDeletionService) {
        this.entityRepository = entityRepository;
        this.entityTypeRepository = entityTypeRepository;
        this.quickAddService = quickAddService;
        this.entityDeletionService = entityDeletionService;
        this.variantDeletionService = variantDeletionService;
    }

    @Operation(summary = "Ajout rapide (parcours 1) : crée une Entity et son Ownership initiale, "
            + "ou rattache une nouvelle Ownership à une Entity existante si le titre correspond déjà (déduplication)")
    @PostMapping("/quick-add")
    @ResponseStatus(HttpStatus.CREATED)
    public QuickAddResponse quickAdd(@RequestBody QuickAddRequest request) {
        // Auparavant seule la contrainte FK Postgres protégeait ce chemin, ce
        // qui remontait une exception SQL brute plutôt qu'un 400 propre.
        entityTypeRepository.findById(request.entityTypeId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "EntityType inconnu : " + request.entityTypeId()));

        QuickAddResult result = quickAddService.addNewEntityWithOwnership(
                request.entityTypeId(), request.title(), request.condition(), request.attributesOrEmpty(),
                request.volumeNumber(), request.edition(), request.volumeImageUrl(), request.purchasePrice());
        return new QuickAddResponse(
                result.entityId(), result.matchedExistingEntity(), result.variantId(), result.matchedExistingVariant());
    }

    @Operation(summary = "Consulter une Entity par son identifiant")
    @GetMapping("/{id}")
    public EntityResponse getById(@PathVariable UUID id) {
        return entityRepository.findById(id)
                .map(EntityResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Entity introuvable : " + id));
    }

    @Operation(summary = "Lister toutes les Entity d'un type - utilisé notamment pour rafraîchir un client "
            + "après un import en masse (ex: collection BGG)")
    @GetMapping
    public List<EntityResponse> listByType(@RequestParam UUID entityTypeId) {
        return entityRepository.findAllByType(entityTypeId).stream()
                .map(EntityResponse::from)
                .collect(Collectors.toList());
    }

    @Operation(summary = "Recherche transversale sur la collection (UC4) - par titre, "
            + "filtrable par type et/ou par tag, tous deux optionnels")
    @GetMapping("/search")
    public List<EntityResponse> search(@RequestParam(required = false) String q,
                                        @RequestParam(required = false) UUID entityTypeId,
                                        @RequestParam(required = false) UUID tagId) {
        return entityRepository.search(q, entityTypeId, tagId).stream()
                .map(EntityResponse::from)
                .collect(Collectors.toList());
    }

    @Operation(summary = "Supprimer une Entity (bloqué si des Ownership/Experience existent encore)")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        entityDeletionService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Compléter les attributs d'un Variant existant sans écraser ceux déjà renseignés "
            + "(ex: jaquette du tome retrouvée après coup, voir \"Retrouver les jaquettes manquantes\" sur Ma collection)")
    @PatchMapping("/{entityId}/variants/{variantId}")
    public EntityResponse mergeVariantAttributes(@PathVariable UUID entityId, @PathVariable UUID variantId,
                                                  @RequestBody Map<String, Object> attributes) {
        Entity entity = entityRepository.findById(entityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Entity introuvable : " + entityId));
        try {
            entity.mergeVariantAttributes(variantId, attributes);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage());
        }
        return EntityResponse.from(entityRepository.save(entity));
    }

    @Operation(summary = "Supprimer un Tome (bloqué si des Ownership/Experience le référencent encore) - "
            + "n'affecte jamais la Série ni les autres tomes (modèle Série -> Édition -> Tome)")
    @DeleteMapping("/{entityId}/variants/{variantId}")
    public ResponseEntity<Void> deleteVariant(@PathVariable UUID entityId, @PathVariable UUID variantId) {
        try {
            variantDeletionService.delete(entityId, variantId);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage());
        }
        return ResponseEntity.noContent().build();
    }
}
