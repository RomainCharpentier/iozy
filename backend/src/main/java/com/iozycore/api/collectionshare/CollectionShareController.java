package com.iozycore.api.collectionshare;

import com.iozycore.api.dto.CollectionShareDtos.CollectionShareResponse;
import com.iozycore.api.dto.CollectionShareDtos.UpdateCollectionShareRequest;
import com.iozycore.domain.collectionshare.CollectionShareSettings;
import com.iozycore.domain.collectionshare.CollectionShareSettingsRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/**
 * Réglages du lien "Partager ma collection" côté propriétaire (voir la
 * maquette V1.2, Profil). Même mécanique que le partage de wishlist (voir
 * WishlistController.shareLink) - un lien à la fois, régénérable et
 * révocable - avec en plus l'interrupteur "partager aussi mes Tier Lists".
 * La lecture publique, elle, vit dans PublicCollectionController.
 */
@RestController
@RequestMapping("/api/collection/share")
@Tag(name = "Collection share", description = "Lien de partage de la collection (côté propriétaire)")
public class CollectionShareController {

    private final CollectionShareSettingsRepository repository;

    public CollectionShareController(CollectionShareSettingsRepository repository) {
        this.repository = repository;
    }

    @Operation(summary = "État courant du lien de partage de la collection (token null = pas de lien actif)")
    @GetMapping
    public CollectionShareResponse current() {
        return toResponse(repository.find());
    }

    @Operation(summary = "Générer (ou régénérer) le lien - invalide silencieusement l'ancien jeton, et repart "
            + "toujours sans les Tier Lists (choix le plus fermé, à re-demander explicitement)")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CollectionShareResponse generate() {
        return toResponse(repository.save(CollectionShareSettings.withNewToken()));
    }

    @Operation(summary = "Activer/désactiver le partage des Tier Lists SANS toucher au lien déjà distribué. "
            + "409 s'il n'y a aucun lien actif : un interrupteur de partage n'a pas de sens sans partage.")
    @PatchMapping
    public CollectionShareResponse update(@RequestBody UpdateCollectionShareRequest request) {
        CollectionShareSettings settings = repository.find();
        if (!settings.hasLink()) {
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.CONFLICT,
                    "Aucun lien de partage actif - génère d'abord un lien");
        }
        if (request.includeTierLists() == null) {
            return toResponse(settings);
        }
        return toResponse(repository.save(settings.withTierLists(request.includeTierLists())));
    }

    @Operation(summary = "Supprimer le lien - le jeton précédent cesse immédiatement de fonctionner")
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove() {
        repository.save(CollectionShareSettings.noLink());
    }

    private static CollectionShareResponse toResponse(CollectionShareSettings settings) {
        return new CollectionShareResponse(settings.token(), settings.includeTierLists());
    }
}
