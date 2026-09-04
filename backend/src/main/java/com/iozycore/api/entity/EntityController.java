package com.iozycore.api.entity;

import com.iozycore.api.dto.EntityDtos.EntityResponse;
import com.iozycore.api.dto.EntityDtos.QuickAddRequest;
import com.iozycore.api.dto.EntityDtos.QuickAddResponse;
import com.iozycore.application.EntityDeletionService;
import com.iozycore.application.QuickAddService;
import com.iozycore.application.QuickAddService.QuickAddResult;
import com.iozycore.application.VariantDeletionService;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.metadata.bnf.BnfCouverture;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityTypeRepository;
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
                request.volumeNumber(), request.edition(), request.volumeImageUrl(), request.purchasePrice(),
                request.acquiredAt());
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
    @ApiResponse(responseCode = "204", description = "Série supprimée - aucun corps. Idempotent : "
            + "un identifiant inconnu rend également 204.")
    @ApiResponse(responseCode = "409", description = "Des Ownership/Experience/Éditions la référencent encore")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        entityDeletionService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Compléter/corriger les attributs de la Série. origine=manuelle (défaut) : ce que "
            + "l'utilisateur tape, chaque clé est marquée saisie à la main. origine=source : ce qu'un fournisseur "
            + "rend (rechargement, rattrapage), n'écrit que les clés NON saisies à la main - règle utilisateur du "
            + "2026-09-04 (Lot 130), tenue ici et pas à l'écran pour valoir depuis n'importe quel geste. La réponse "
            + "porte champsSaisis ; les clés ignorées se lisent par différence.")
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

    @Operation(summary = "Retirer un attribut de la Série - complète PATCH /{entityId}, qui ne sait que "
            + "compléter/corriger : une valeur vide y serait stockée telle quelle et ressemblerait ensuite à une "
            + "donnée renseignée (voir Entity.mergeAttributes). 204 même si la clé n'existait pas.")
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

    @Operation(summary = "Renommer la Série (correction manuelle, voir action \"Modifier\" de la fiche Série) - "
            + "ne touche jamais les MangaEdition/Variant déjà rattachés : leur lien avec cette Série passe par "
            + "entityId (voir migration \"Série -> Édition par ID\"), jamais par une égalité de titre, donc "
            + "immunisé contre ce renommage.")
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

    @Operation(summary = "Compléter les attributs d'un Variant existant sans écraser ceux déjà renseignés "
            + "(ex: jaquette du tome retrouvée après coup, voir \"Retrouver les jaquettes manquantes\" sur Ma collection)")
    @PatchMapping("/{entityId}/variants/{variantId}")
    public EntityResponse mergeVariantAttributes(@PathVariable UUID entityId, @PathVariable UUID variantId,
                                                  @RequestBody Map<String, Object> attributes) {
        Entity entity = entityRepository.findById(entityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Entity introuvable : " + entityId));
        // Une couverture BnF est verifiee au moment de la garder (voir
        // BnfCouverture) : morte, elle est simplement omise - le tome garde
        // ses autres attributs, et le rattrapage pourra retenter plus tard.
        Object couverture = attributes.get("coverImageUrl");
        if (couverture instanceof String url && BnfCouverture.estUneCouvertureBnf(url) && !BnfCouverture.estVivante(url)) {
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

    @Operation(summary = "Supprimer un Tome (bloqué si des Ownership/Experience le référencent encore) - "
            + "n'affecte jamais la Série ni les autres tomes (modèle Série -> Édition -> Tome)")
    @ApiResponse(responseCode = "204", description = "Tome supprimé - aucun corps")
    @ApiResponse(responseCode = "404", description = "Série ou tome introuvable")
    @ApiResponse(responseCode = "409", description = "Des Ownership/Experience le référencent encore")
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
