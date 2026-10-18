package com.iozycore.custom.api;

import com.iozycore.custom.EntityTypeCatalog;
import com.iozycore.custom.EntityTypeCatalog.DescribedType;
import com.iozycore.custom.api.EntityTypeDtos.CreateEntityTypeRequest;
import com.iozycore.custom.api.EntityTypeDtos.EntityTypeResponse;
import com.iozycore.custom.api.EntityTypeDtos.UpdateEntityTypeRequest;
import com.iozycore.custom.EntityTypeService;
import com.iozycore.core.domain.catalog.EntityType;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/entity-types")
@Tag(name = "EntityTypes", description = "Dynamic type editor - create/list/update/delete "
        + "the collection categories (MANGA/VIDEO_GAME/BOARD_GAME at the start, extensible)")
@RequiredArgsConstructor
public class EntityTypeController {

    private final EntityTypeService entityTypeService;
    private final EntityTypeCatalog entityTypeCatalog;

    private static EntityTypeResponse toResponse(DescribedType described) {
        return EntityTypeResponse.from(described.type(), described.hasMetadataProvider(),
                described.hasDiscoverySource(), described.hasReleaseSource());
    }

    private EntityTypeResponse reponse(EntityType type) {
        return toResponse(entityTypeCatalog.describe(type));
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
        return entityTypeCatalog.listAll().stream()
                .map(EntityTypeController::toResponse)
                .collect(Collectors.toList());
    }

    @Operation(summary = "Get a type by its identifier")
    @GetMapping("/{id}")
    public EntityTypeResponse getById(@PathVariable UUID id) {
        return toResponse(entityTypeCatalog.get(id));
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
