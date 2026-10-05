package com.iozycore.custom.api;

import com.iozycore.custom.api.EntityTypeDtos.CreateEntityTypeRequest;
import com.iozycore.custom.api.EntityTypeDtos.EntityTypeResponse;
import com.iozycore.custom.api.EntityTypeDtos.UpdateEntityTypeRequest;
import com.iozycore.custom.EntityTypeService;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.insights.DiscoverySource;
import com.iozycore.core.insights.ReleaseSource;
import com.iozycore.core.metadata.MetadataProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/entity-types")
@Tag(name = "EntityTypes", description = "Dynamic type editor - create/list/update/delete "
        + "the collection categories (MANGA/VIDEO_GAME/BOARD_GAME at the start, extensible)")
public class EntityTypeController {

    private final EntityTypeRepository entityTypeRepository;
    private final EntityTypeService entityTypeService;
    private final List<MetadataProvider> metadataProviders;
    private final List<DiscoverySource> discoverySources;
    private final List<ReleaseSource> releaseSources;

    public EntityTypeController(EntityTypeRepository entityTypeRepository, EntityTypeService entityTypeService,
                                 List<MetadataProvider> metadataProviders, List<DiscoverySource> discoverySources,
                                 List<ReleaseSource> releaseSources) {
        this.entityTypeRepository = entityTypeRepository;
        this.entityTypeService = entityTypeService;
        this.metadataProviders = metadataProviders;
        this.discoverySources = discoverySources;
        this.releaseSources = releaseSources;
    }

    /** A custom type (created through this editor) has by construction no provider -
     * only MANGA/VIDEO_GAME/BOARD_GAME have one today (Jikan/BGG/IGDB). */
    private boolean hasMetadataProvider(EntityType type) {
        return metadataProviders.stream().anyMatch(provider -> provider.supports(type));
    }

    /** A universe that can suggest discoveries (see DiscoverySource) - no custom type has one. */
    private boolean hasDiscoverySource(EntityType type) {
        return discoverySources.stream().anyMatch(source -> source.supports(type));
    }

    /** A universe that can date the releases of this type (see ReleaseSource, batch 146) - no custom type has one. */
    private boolean hasReleaseSource(EntityType type) {
        return releaseSources.stream().anyMatch(source -> source.supports(type));
    }

    private EntityTypeResponse reponse(EntityType type) {
        return EntityTypeResponse.from(type, hasMetadataProvider(type), hasDiscoverySource(type), hasReleaseSource(type));
    }

    @Operation(summary = "Create a new type (code normalised to UPPER_SNAKE_CASE, must be unique)")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EntityTypeResponse create(@RequestBody CreateEntityTypeRequest request) {
        EntityType created = entityTypeService.create(request.code(), request.label(),
                request.allowedExperienceTypes(), request.customFieldKeys(), request.colorKey(), request.iconKey(),
                request.aspectKey());
        return reponse(created);
    }

    @Operation(summary = "List all existing types - used by the iOS/Web clients instead of "
            + "a hard-coded list")
    @GetMapping
    public List<EntityTypeResponse> listAll() {
        return entityTypeRepository.findAll().stream()
                .map(this::reponse)
                .collect(Collectors.toList());
    }

    @Operation(summary = "Get a type by its identifier")
    @GetMapping("/{id}")
    public EntityTypeResponse getById(@PathVariable UUID id) {
        return entityTypeRepository.findById(id)
                .map(this::reponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "EntityType introuvable : " + id));
    }

    @Operation(summary = "Update the label/schema/visual identity of an existing type (the code never changes "
            + "after creation). Missing colorKey/iconKey = back to the default visual, the caller sending the wanted "
            + "state in full.")
    @PatchMapping("/{id}")
    public EntityTypeResponse update(@PathVariable UUID id, @RequestBody UpdateEntityTypeRequest request) {
        EntityType updated = entityTypeService.update(id, request.label(), request.allowedExperienceTypes(),
                request.customFieldKeys(), request.colorKey(), request.iconKey(), request.aspectKey());
        return reponse(updated);
    }

    @Operation(summary = "Delete a type (blocked if Entity objects of this type still exist)")
    @ApiResponse(responseCode = "204", description = "Type deleted - no body. Idempotent: an "
            + "unknown identifier also returns 204.")
    @ApiResponse(responseCode = "409", description = "Entity objects of this type still exist - nothing is changed")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        entityTypeService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
