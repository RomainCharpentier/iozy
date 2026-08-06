package com.iozycore.api.ownership;

import com.iozycore.api.dto.OwnershipDtos.OwnershipResponse;
import com.iozycore.api.dto.OwnershipDtos.UpdateNoteRequest;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
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

    public OwnershipController(OwnershipRepository ownershipRepository) {
        this.ownershipRepository = ownershipRepository;
    }

    @Operation(summary = "Lister les Ownership d'une Entity")
    @GetMapping
    public List<OwnershipResponse> byEntity(@RequestParam UUID entityId) {
        return ownershipRepository.findByEntityId(entityId).stream()
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

    private Ownership findOrThrow(UUID id) {
        return ownershipRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ownership introuvable : " + id));
    }
}
