package com.iozycore.core.api.entity;

import com.iozycore.core.api.dto.EntityDtos.EntityResponse;
import com.iozycore.core.api.dto.EntityDtos.QuickAddRequest;
import com.iozycore.core.api.dto.EntityDtos.QuickAddResponse;
import com.iozycore.core.application.EntityDeletionService;
import com.iozycore.core.application.QuickAddService;
import com.iozycore.core.application.QuickAddService.QuickAddResult;
import com.iozycore.core.application.VariantDeletionService;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.metadata.catalog.CatalogSearchService;
import com.iozycore.core.metadata.CoverImageCheck;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
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
@Tag(name = "Entities", description = "Catalog - management of Entities (mangas, video games, board games)")
public class EntityController {

    private final EntityRepository entityRepository;
    private final EntityTypeRepository entityTypeRepository;
    private final QuickAddService quickAddService;
    private final EntityDeletionService entityDeletionService;
    private final VariantDeletionService variantDeletionService;
    private final CatalogSearchService catalogue;
    /** The universes that can say whether a cover is usable (Batch 133). */
    private final List<CoverImageCheck> coverChecks;

    public EntityController(EntityRepository entityRepository,
                             EntityTypeRepository entityTypeRepository,
                             QuickAddService quickAddService,
                             EntityDeletionService entityDeletionService,
                             VariantDeletionService variantDeletionService,
                             CatalogSearchService catalogue,
                             List<CoverImageCheck> coverChecks) {
        this.entityRepository = entityRepository;
        this.entityTypeRepository = entityTypeRepository;
        this.quickAddService = quickAddService;
        this.entityDeletionService = entityDeletionService;
        this.variantDeletionService = variantDeletionService;
        this.catalogue = catalogue;
        this.coverChecks = coverChecks;
    }

    @Operation(summary = "Quick add (path 1): creates an Entity and its initial Ownership, "
            + "or attaches a new Ownership to an existing Entity if the title already matches (deduplication)")
    @PostMapping("/quick-add")
    @ResponseStatus(HttpStatus.CREATED)
    public QuickAddResponse quickAdd(@RequestBody QuickAddRequest request) {
        // Previously only the Postgres FK constraint protected this path, which
        // raised a raw SQL exception rather than a clean 400.
        entityTypeRepository.findById(request.entityTypeId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "EntityType inconnu : " + request.entityTypeId()));

        QuickAddResult result = quickAddService.addNewEntityWithOwnership(
                request.entityTypeId(), request.title(), request.condition(), request.attributesOrEmpty(),
                request.volumeNumber(), request.edition(), request.volumeImageUrl(), request.purchasePrice(),
                request.acquiredAt());
        return new QuickAddResponse(
                result.entityId(), result.matchedExistingEntity(), result.variantId(), result.matchedExistingVariant());
    }

    @Operation(summary = "Get an Entity by its id")
    @GetMapping("/{id}")
    public EntityResponse getById(@PathVariable UUID id) {
        return entityRepository.findById(id)
                .map(EntityResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Entity introuvable : " + id));
    }

    @Operation(summary = "List all Entities of a type - used in particular to refresh a client "
            + "after a bulk import (e.g. BGG collection)")
    @GetMapping
    public List<EntityResponse> listByType(@RequestParam UUID entityTypeId) {
        return entityRepository.findAllByType(entityTypeId).stream()
                .map(EntityResponse::from)
                .collect(Collectors.toList());
    }

    @Operation(summary = "Cross-cutting search on the collection (UC4) - by title, "
            + "can be filtered by type and/or by tag, both optional")
    @GetMapping("/search")
    public List<EntityResponse> search(@RequestParam(required = false) String q,
                                        @RequestParam(required = false) UUID entityTypeId,
                                        @RequestParam(required = false) UUID tagId) {
        // Retrieval through the iozycore database has its own module (Batch 132): the
        // same search serves the Search screen, next to the providers.
        return catalogue.rechercher(q, entityTypeId, tagId).stream()
                .map(EntityResponse::from)
                .collect(Collectors.toList());
    }

    @Operation(summary = "Delete an Entity (blocked if Ownerships/Experiences still exist)")
    @ApiResponse(responseCode = "204", description = "Series deleted - no body. Idempotent: "
            + "an unknown id also returns 204.")
    @ApiResponse(responseCode = "409", description = "Ownerships/Experiences/Editions still reference it")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        entityDeletionService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Complete/fix the attributes of the Series. origin=manual (default): what "
            + "the user types, each key is marked as typed by hand. origin=source: what a provider "
            + "returns (reload, catch-up), only writes the keys NOT typed by hand - user rule of "
            + "2026-09-04 (Batch 130), held here and not on the screen so that it holds from any action. The response "
            + "carries champsSaisis; the ignored keys are read by difference.")
    @PatchMapping("/{entityId}")
    public EntityResponse mergeAttributes(@PathVariable UUID entityId, @RequestBody Map<String, Object> attributes,
                                          @RequestParam(required = false, defaultValue = "manuelle") String origine) {
        Entity entity = entityRepository.findById(entityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Entity introuvable : " + entityId));
        if ("source".equals(origine)) {
            entity.recopierDepuisLaSource(attributes);
        } else if ("manuelle".equals(origine)) {
            entity.saisirAttributs(attributes);
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "origine inconnue : " + origine + " (manuelle ou source)");
        }
        return EntityResponse.from(entityRepository.save(entity));
    }

    @Operation(summary = "Remove an attribute of the Series - completes PATCH /{entityId}, which can only "
            + "complete/fix: an empty value would be stored there as is and would then look like "
            + "filled-in data (see Entity.mergeAttributes). 204 even if the key did not exist.")
    @DeleteMapping("/{entityId}/attributes/{key}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeAttribute(@PathVariable UUID entityId, @PathVariable String key) {
        Entity entity = entityRepository.findById(entityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Entité introuvable : " + entityId));
        entity.removeAttribute(key);
        entityRepository.save(entity);
    }

    public record RenameEntityRequest(String title) {
    }

    @Operation(summary = "Rename the Series (manual fix, \"Edit\" mode of the Series detail page) - "
            + "never touches the MangaEdition/Variant already attached: their link with this Series goes through "
            + "entityId (see migration \"Series -> Edition by ID\"), never through a title equality, so "
            + "immune to this renaming.")
    @PatchMapping("/{entityId}/rename")
    public EntityResponse rename(@PathVariable UUID entityId, @RequestBody RenameEntityRequest request) {
        Entity entity = entityRepository.findById(entityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Entity introuvable : " + entityId));
        try {
            entity.rename(request.title());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
        return EntityResponse.from(entityRepository.save(entity));
    }

    @Operation(summary = "Complete the attributes of an existing Variant without overwriting those already filled in "
            + "(e.g. volume cover found afterwards, see \"Find missing covers\" on My collection)")
    @PatchMapping("/{entityId}/variants/{variantId}")
    public EntityResponse mergeVariantAttributes(@PathVariable UUID entityId, @PathVariable UUID variantId,
                                                  @RequestBody Map<String, Object> attributes) {
        Entity entity = entityRepository.findById(entityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Entity introuvable : " + entityId));
        // A cover is checked when it is kept (see
        // CoverImageCheck, held by the universes): dead, it is simply
        // left out - the volume keeps its other attributes, and the catch-up can
        // try again later.
        Object couverture = attributes.get("coverImageUrl");
        if (couverture instanceof String url && coverChecks.stream().anyMatch(c -> !c.estUtilisable(url))) {
            attributes = new java.util.HashMap<>(attributes);
            attributes.remove("coverImageUrl");
        }
        try {
            entity.mergeVariantAttributes(variantId, attributes);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage());
        }
        return EntityResponse.from(entityRepository.save(entity));
    }

    @Operation(summary = "Delete a Volume (blocked if Ownerships/Experiences still reference it) - "
            + "never affects the Series nor the other volumes (Series -> Edition -> Volume model)")
    @ApiResponse(responseCode = "204", description = "Volume deleted - no body")
    @ApiResponse(responseCode = "404", description = "Series or volume not found")
    @ApiResponse(responseCode = "409", description = "Ownerships/Experiences still reference it")
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
