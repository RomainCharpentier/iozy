package com.iozycore.api.ownership;

import com.iozycore.api.dto.OwnershipDtos.OwnershipResponse;
import com.iozycore.api.dto.OwnershipDtos.UpdateNoteRequest;
import com.iozycore.api.dto.OwnershipDtos.UpdatePurchasePriceRequest;
import com.iozycore.application.OwnershipDeletionService;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipRepository;
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

    @Operation(summary = "Mettre à jour la note libre d'une Ownership")
    @PatchMapping("/{id}/note")
    public OwnershipResponse updateNote(@PathVariable UUID id, @RequestBody UpdateNoteRequest request) {
        Ownership ownership = findOrThrow(id);
        ownership.updateNote(request.note());
        return OwnershipResponse.from(ownershipRepository.save(ownership));
    }

    @Operation(summary = "Renseigner (ou effacer, si purchasePrice est null) le prix d'achat d'une Ownership")
    @PatchMapping("/{id}/purchase-price")
    public OwnershipResponse updatePurchasePrice(@PathVariable UUID id, @RequestBody UpdatePurchasePriceRequest request) {
        Ownership ownership = findOrThrow(id);
        ownership.updatePurchasePrice(request.purchasePrice());
        return OwnershipResponse.from(ownershipRepository.save(ownership));
    }

    @Operation(summary = "Supprimer définitivement un exemplaire (bloqué si un prêt le référence encore) - "
            + "contrairement à \"marquer vendu/perdu\" (changement de statut réversible), cette action est "
            + "irréversible")
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
