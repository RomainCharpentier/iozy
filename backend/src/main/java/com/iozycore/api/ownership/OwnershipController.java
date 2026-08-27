package com.iozycore.api.ownership;

import com.iozycore.api.dto.OwnershipDtos.OwnershipResponse;
import com.iozycore.application.OwnershipDeletionService;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipRepository;
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
@RequestMapping("/api/ownerships")
@Tag(name = "Ownerships", description = "UC2 - gestion des possessions, indépendante des Experience")
public class OwnershipController {

    private final OwnershipRepository ownershipRepository;
    private final OwnershipDeletionService ownershipDeletionService;

    public OwnershipController(OwnershipRepository ownershipRepository, OwnershipDeletionService ownershipDeletionService) {
        this.ownershipRepository = ownershipRepository;
        this.ownershipDeletionService = ownershipDeletionService;
    }

    @Operation(summary = "Lister les Ownership - filtrées sur une Entity si entityId est fourni, toutes sinon "
            + "(ex: calcul de progression par série sur Ma collection, qui a besoin de la possession réelle de "
            + "chaque série affichée en une seule fois plutôt que d'une requête par série)")
    @GetMapping
    public List<OwnershipResponse> list(@RequestParam(required = false) UUID entityId) {
        List<Ownership> ownerships = entityId != null
                ? ownershipRepository.findByEntityId(entityId)
                : ownershipRepository.findAll();
        return ownerships.stream()
                .map(OwnershipResponse::from)
                .collect(Collectors.toList());
    }

    @Operation(summary = "Marquer une Ownership comme vendue")
    @PostMapping("/{id}/sell")
    public OwnershipResponse markSold(@PathVariable UUID id) {
        Ownership ownership = findOrThrow(id);
        ownership.markSold();
        return OwnershipResponse.from(ownershipRepository.save(ownership));
    }

    @Operation(summary = "Marquer une Ownership comme perdue")
    @PostMapping("/{id}/lose")
    public OwnershipResponse markLost(@PathVariable UUID id) {
        Ownership ownership = findOrThrow(id);
        ownership.markLost();
        return OwnershipResponse.from(ownershipRepository.save(ownership));
    }

    @Operation(summary = "Remettre en possession un exemplaire vendu ou perdu - sert l'action \"Annuler\" "
            + "proposée juste après avoir marqué vendu/perdu. 409 si l'exemplaire est déjà actif.")
    // Aucun appelant web aujourd'hui, et pourtant conservée : le client iOS
    // sait marquer vendu et perdu (/sell, /lose). Sans cette route, ces deux
    // gestes seraient des allers simples. C'est un écran qui manque, pas du
    // code mort - même distinction qu'au Lot 51 pour les préférences
    // d'analyse d'achat.
    @PostMapping("/{id}/restore")
    public OwnershipResponse restore(@PathVariable UUID id) {
        Ownership ownership = findOrThrow(id);
        ownership.restore();
        return OwnershipResponse.from(ownershipRepository.save(ownership));
    }

    @Operation(summary = "Supprimer définitivement un exemplaire - contrairement à \"marquer vendu/perdu\" "
            + "(changement de statut réversible), cette action est irréversible. Le Tome catalogué qu'il "
            + "référence n'est jamais supprimé : seule la possession disparaît.")
    @ApiResponse(responseCode = "204", description = "Exemplaire supprimé - aucun corps. Idempotent : "
            + "un identifiant déjà supprimé ou inconnu rend également 204.")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        ownershipDeletionService.delete(id);
        return ResponseEntity.noContent().build();
    }

    private Ownership findOrThrow(UUID id) {
        return ownershipRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ownership introuvable : " + id));
    }
}
