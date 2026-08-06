package com.iozycore.api.entitytype;

import com.iozycore.api.dto.EntityTypeDtos.CreateEntityTypeRequest;
import com.iozycore.api.dto.EntityTypeDtos.EntityTypeResponse;
import com.iozycore.api.dto.EntityTypeDtos.UpdateEntityTypeRequest;
import com.iozycore.application.EntityTypeService;
import com.iozycore.domain.catalog.EntityTypeRepository;
import io.swagger.v3.oas.annotations.Operation;
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
@Tag(name = "EntityTypes", description = "Éditeur de types dynamique - créer/lister/modifier/supprimer "
        + "les catégories de la collection (MANGA/VIDEO_GAME/BOARD_GAME au départ, extensible)")
public class EntityTypeController {

    private final EntityTypeRepository entityTypeRepository;
    private final EntityTypeService entityTypeService;

    public EntityTypeController(EntityTypeRepository entityTypeRepository, EntityTypeService entityTypeService) {
        this.entityTypeRepository = entityTypeRepository;
        this.entityTypeService = entityTypeService;
    }

    @Operation(summary = "Créer un nouveau type (code normalisé en UPPER_SNAKE_CASE, doit être unique)")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EntityTypeResponse create(@RequestBody CreateEntityTypeRequest request) {
        return EntityTypeResponse.from(entityTypeService.create(
                request.code(), request.label(), request.allowedExperienceTypes(), request.customFieldKeys()));
    }

    @Operation(summary = "Lister tous les types existants - utilisé par les clients iOS/Web à la place "
            + "d'une liste codée en dur")
    @GetMapping
    public List<EntityTypeResponse> listAll() {
        return entityTypeRepository.findAll().stream()
                .map(EntityTypeResponse::from)
                .collect(Collectors.toList());
    }

    @Operation(summary = "Consulter un type par son identifiant")
    @GetMapping("/{id}")
    public EntityTypeResponse getById(@PathVariable UUID id) {
        return entityTypeRepository.findById(id)
                .map(EntityTypeResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "EntityType introuvable : " + id));
    }

    @Operation(summary = "Modifier le label/schema d'un type existant (le code ne change jamais après création)")
    @PatchMapping("/{id}")
    public EntityTypeResponse update(@PathVariable UUID id, @RequestBody UpdateEntityTypeRequest request) {
        return EntityTypeResponse.from(entityTypeService.update(
                id, request.label(), request.allowedExperienceTypes(), request.customFieldKeys()));
    }

    @Operation(summary = "Supprimer un type (bloqué si des Entity de ce type existent encore)")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        entityTypeService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
