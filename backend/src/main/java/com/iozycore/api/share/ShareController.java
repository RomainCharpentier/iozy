package com.iozycore.api.share;

import com.iozycore.application.auth.UtilisateurCourant;
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
 * <p>
 * Il y a en revanche <b>deux accès</b>, réglés ici tous les deux : le lien,
 * qu'on envoie à quelqu'un, et la visite ({@code openToGuests}), une porte
 * laissée ouverte à qui atteint l'instance et qui donne à voir l'application
 * entière en lecture seule. Ils ne se commandent pas l'un l'autre - supprimer
 * le lien ne referme pas la porte, et l'ouvrir ne crée aucun jeton.
 */
@RestController
@RequestMapping("/api/share")
@Tag(name = "Partage", description = "Un lien, des sections visibles au choix (collection, envies)")
public class ShareController {

    private final ShareSettingsRepository repository;
    private final UtilisateurCourant utilisateurCourant;

    public ShareController(ShareSettingsRepository repository, UtilisateurCourant utilisateurCourant) {
        this.repository = repository;
        this.utilisateurCourant = utilisateurCourant;
    }

    @Operation(summary = "État courant du partage (token null = aucun lien actif)")
    @GetMapping
    public ShareResponse current() {
        return toResponse(repository.find());
    }

    @Operation(summary = "Générer (ou régénérer) le lien. Régénérer invalide immédiatement l'ancien jeton, et "
            + "repart des choix les plus fermés : les deux sections visibles, les Tier Lists exclues. "
            + "La visite sans compte n'est pas touchée.")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ShareResponse generate() {
        // Repartir des choix les plus fermés vaut pour LE LIEN. La visite reste
        // où elle est : la refermer parce qu'on régénère un jeton fermerait un
        // accès que personne n'a demandé à fermer.
        boolean visiteEnCours = repository.find().openToGuests();
        return toResponse(repository.save(
                ShareSettings.withNewToken(utilisateurCourant.proprietaire()).withGuests(visiteEnCours)));
    }

    @Operation(summary = "Changer les sections visibles, ou ouvrir/fermer la visite sans compte, SANS toucher "
            + "au lien déjà distribué. Champ absent (null) = inchangé. Refuse de tout décocher : un lien qui "
            + "n'expose rien doit être supprimé, pas vidé.")
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
                                    ? settings.includeTierLists() : request.includeTierLists())
                    .withGuests(
                            request.openToGuests() == null ? settings.openToGuests() : request.openToGuests());
            return toResponse(repository.save(modifiees));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    @Operation(summary = "Supprimer le lien - le jeton précédent cesse immédiatement de fonctionner. "
            + "La visite sans compte, elle, reste dans l'état où elle était : c'est un autre accès.")
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove() {
        // `withoutLink` et non `noLink` : le second repart de zéro et
        // refermerait au passage une visite en cours, qui n'a rien à voir avec
        // le lien qu'on retire.
        repository.save(repository.find().withoutLink());
    }

    private static ShareResponse toResponse(ShareSettings settings) {
        return new ShareResponse(settings.token(), settings.shareCollection(), settings.shareWishlist(),
                settings.includeTierLists(), settings.openToGuests());
    }
}
