package com.iozycore.api.editionupgrade;

import com.iozycore.api.dto.EditionUpgradeWishDtos.CreateEditionUpgradeWishRequest;
import com.iozycore.api.dto.EditionUpgradeWishDtos.EditionUpgradeWishResponse;
import com.iozycore.api.dto.EditionUpgradeWishDtos.EnrichedEditionUpgradeWishResponse;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.editionupgrade.EditionUpgradeWish;
import com.iozycore.domain.editionupgrade.EditionUpgradeWishRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/** "Je possède déjà cette série, mais je recherche une meilleure édition pour la remplacer"
 * (voir com.iozycore.domain.editionupgrade). */
@RestController
@RequestMapping("/api/edition-upgrade-wishes")
@Tag(name = "Edition upgrades", description = "Envies de remplacer une édition déjà possédée par une meilleure")
public class EditionUpgradeWishController {

    private final EditionUpgradeWishRepository wishRepository;
    private final EntityRepository entityRepository;

    public EditionUpgradeWishController(EditionUpgradeWishRepository wishRepository, EntityRepository entityRepository) {
        this.wishRepository = wishRepository;
        this.entityRepository = entityRepository;
    }

    @Operation(summary = "Signaler une envie d'amélioration d'édition pour une série possédée")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EditionUpgradeWishResponse create(@RequestBody CreateEditionUpgradeWishRequest request) {
        entityRepository.findById(request.entityId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Entité introuvable : " + request.entityId()));
        EditionUpgradeWish wish = EditionUpgradeWish.create(request.entityId(), request.currentEditionName(),
                request.desiredEditionName(), request.note());
        return EditionUpgradeWishResponse.from(wishRepository.save(wish));
    }

    @Operation(summary = "Retirer une envie d'amélioration d'édition")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        wishRepository.deleteById(id);
    }

    @Operation(summary = "Envies d'amélioration d'édition pour une série précise (fiche série)")
    @GetMapping
    public List<EditionUpgradeWishResponse> byEntity(@RequestParam UUID entityId) {
        return wishRepository.findByEntityId(entityId).stream()
                .map(EditionUpgradeWishResponse::from)
                .collect(Collectors.toList());
    }

    @Operation(summary = "Toutes les envies d'amélioration d'édition (\"Mon profil\"), enrichies du titre de la série")
    @GetMapping("/all")
    public List<EnrichedEditionUpgradeWishResponse> all() {
        return wishRepository.findAll().stream()
                .map(this::enrich)
                .filter(Optional::isPresent)
                .map(Optional::get)
                .collect(Collectors.toList());
    }

    /** Vide si l'Entity référencée a disparu depuis (ne devrait pas arriver en usage normal, mais cette envie ne doit jamais faire planter l'écran). */
    private Optional<EnrichedEditionUpgradeWishResponse> enrich(EditionUpgradeWish wish) {
        Optional<Entity> entity = entityRepository.findById(wish.entityId());
        if (entity.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new EnrichedEditionUpgradeWishResponse(wish.id(), wish.entityId(), entity.get().title(),
                wish.currentEditionName(), wish.desiredEditionName().orElse(null), wish.note().orElse(null),
                wish.addedAt()));
    }
}
