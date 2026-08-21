package com.iozycore.api.share;

import com.iozycore.api.dto.ShareDtos.ShareResponse;
import com.iozycore.api.dto.ShareDtos.UpdateShareRequest;
import com.iozycore.domain.share.ShareSettings;
import com.iozycore.domain.share.ShareSettingsRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * Le partage d'espace côté propriétaire : un seul lien, dont on choisit les
 * sections visibles.
 * <p>
 * Un seul contrôleur pour les deux sections, à dessein. Il y en avait deux -
 * {@code /collection-share} et {@code /wishlist/share} - qui produisaient deux
 * jetons distincts : entrer par « Ma collection » ou par « Mes envies »
 * donnait deux URL différentes pour le même espace personnel. Les raccourcis
 * de ces deux écrans appellent désormais ces mêmes endpoints ; il n'existe plus
 * qu'un jeton, quelle que soit la porte d'entrée.
 */
@RestController
@RequestMapping("/api/share")
@Tag(name = "Partage", description = "Un lien, des sections visibles au choix (collection, envies)")
public class ShareController {

    private final ShareSettingsRepository repository;

    public ShareController(ShareSettingsRepository repository) {
        this.repository = repository;
    }

    @Operation(summary = "État courant du partage (token null = aucun lien actif)")
    @GetMapping
    public ShareResponse current() {
        return toResponse(repository.find());
    }

    @Operation(summary = "Générer (ou régénérer) le lien. Régénérer invalide immédiatement l'ancien jeton, et "
            + "repart des choix les plus fermés : les deux sections visibles, les Tier Lists exclues.")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ShareResponse generate() {
        return toResponse(repository.save(ShareSettings.withNewToken()));
    }

    @Operation(summary = "Changer les sections visibles SANS toucher au lien déjà distribué. Champ absent (null) "
            + "= inchangé. Refuse de tout décocher : un lien qui n'expose rien doit être supprimé, pas vidé.")
    @PatchMapping
    public ShareResponse update(@RequestBody UpdateShareRequest request) {
        ShareSettings settings = repository.find();
        try {
            // La construction est DANS le try : c'est elle qui refuse de tout
            // décocher (voir ShareSettings), pas la sauvegarde. L'invariant vit
            // dans le domaine, on ne le rejoue pas ici - on traduit son refus
            // en 400 lisible plutôt que de laisser remonter un 500.
            ShareSettings modifiees = settings
                    .withSections(
                            request.shareCollection() == null ? settings.shareCollection() : request.shareCollection(),
                            request.shareWishlist() == null ? settings.shareWishlist() : request.shareWishlist())
                    .withTierLists(
                            request.includeTierLists() == null
                                    ? settings.includeTierLists() : request.includeTierLists());
            return toResponse(repository.save(modifiees));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    @Operation(summary = "Supprimer le lien - le jeton précédent cesse immédiatement de fonctionner")
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove() {
        repository.save(ShareSettings.noLink());
    }

    private static ShareResponse toResponse(ShareSettings settings) {
        return new ShareResponse(settings.token(), settings.shareCollection(), settings.shareWishlist(),
                settings.includeTierLists());
    }
}
