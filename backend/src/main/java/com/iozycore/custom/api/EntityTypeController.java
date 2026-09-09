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
@Tag(name = "EntityTypes", description = "Éditeur de types dynamique - créer/lister/modifier/supprimer "
        + "les catégories de la collection (MANGA/VIDEO_GAME/BOARD_GAME au départ, extensible)")
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

    /** Un type personnalisé (créé via cet éditeur) n'a par construction aucun fournisseur -
     * seuls MANGA/VIDEO_GAME/BOARD_GAME en ont un aujourd'hui (Jikan/BGG/IGDB). */
    private boolean hasMetadataProvider(EntityType type) {
        return metadataProviders.stream().anyMatch(provider -> provider.supports(type));
    }

    /** Un univers qui sait proposer des decouvertes (voir DiscoverySource) - aucun type personnalise n'en a. */
    private boolean hasDiscoverySource(EntityType type) {
        return discoverySources.stream().anyMatch(source -> source.supports(type));
    }

    /** Un univers qui sait dater les sorties de ce type (voir ReleaseSource, lot 146) - aucun type personnalise n'en a. */
    private boolean hasReleaseSource(EntityType type) {
        return releaseSources.stream().anyMatch(source -> source.supports(type));
    }

    private EntityTypeResponse reponse(EntityType type) {
        return EntityTypeResponse.from(type, hasMetadataProvider(type), hasDiscoverySource(type), hasReleaseSource(type));
    }

    @Operation(summary = "Créer un nouveau type (code normalisé en UPPER_SNAKE_CASE, doit être unique)")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EntityTypeResponse create(@RequestBody CreateEntityTypeRequest request) {
        EntityType created = entityTypeService.create(request.code(), request.label(),
                request.allowedExperienceTypes(), request.customFieldKeys(), request.colorKey(), request.iconKey(),
                request.aspectKey());
        return reponse(created);
    }

    @Operation(summary = "Lister tous les types existants - utilisé par les clients iOS/Web à la place "
            + "d'une liste codée en dur")
    @GetMapping
    public List<EntityTypeResponse> listAll() {
        return entityTypeRepository.findAll().stream()
                .map(this::reponse)
                .collect(Collectors.toList());
    }

    @Operation(summary = "Consulter un type par son identifiant")
    @GetMapping("/{id}")
    public EntityTypeResponse getById(@PathVariable UUID id) {
        return entityTypeRepository.findById(id)
                .map(this::reponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "EntityType introuvable : " + id));
    }

    @Operation(summary = "Modifier le label/schema/identité visuelle d'un type existant (le code ne change jamais "
            + "après création). colorKey/iconKey absents = retour au visuel par défaut, l'appelant envoyant l'état "
            + "voulu en entier.")
    @PatchMapping("/{id}")
    public EntityTypeResponse update(@PathVariable UUID id, @RequestBody UpdateEntityTypeRequest request) {
        EntityType updated = entityTypeService.update(id, request.label(), request.allowedExperienceTypes(),
                request.customFieldKeys(), request.colorKey(), request.iconKey(), request.aspectKey());
        return reponse(updated);
    }

    @Operation(summary = "Supprimer un type (bloqué si des Entity de ce type existent encore)")
    @ApiResponse(responseCode = "204", description = "Type supprimé - aucun corps. Idempotent : un "
            + "identifiant inconnu rend également 204.")
    @ApiResponse(responseCode = "409", description = "Des Entity de ce type existent encore - rien n'est modifié")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        entityTypeService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
