package com.iozycore.api.wishlist;

import com.iozycore.api.dto.WishlistDtos.SharedWishlistEntryResponse;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.wishlist.WishlistEntry;
import com.iozycore.domain.wishlist.WishlistEntryRepository;
import com.iozycore.domain.wishlist.WishlistShareSettingsRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * SEUL contrôleur de toute l'app conçu pour être ouvert par quelqu'un
 * d'autre que le propriétaire (voir com.iozycore.domain.wishlist.
 * WishlistShareSettings - "liste d'envies partageable", pour offrir un
 * cadeau sans créer de doublon). Le jeton fait office de mot de passe :
 * absent ou ne correspondant à aucun lien actif -> 404, jamais un détail
 * qui laisserait deviner s'il a existé. Volontairement minimal (titre +
 * jaquette seulement, jamais d'entityId ni de lien profond vers le reste de
 * l'app, jamais le reste de la collection/des prix) - à ne jamais faire
 * évoluer au-delà de ça sans revalider le même raisonnement.
 */
@RestController
@RequestMapping("/api/public/wishlist")
@Tag(name = "Public wishlist", description = "Lecture seule, non authentifiée, réservée au porteur du lien de partage")
public class PublicWishlistController {

    private final WishlistShareSettingsRepository shareSettingsRepository;
    private final WishlistEntryRepository wishlistEntryRepository;
    private final EntityRepository entityRepository;

    public PublicWishlistController(WishlistShareSettingsRepository shareSettingsRepository,
                                     WishlistEntryRepository wishlistEntryRepository,
                                     EntityRepository entityRepository) {
        this.shareSettingsRepository = shareSettingsRepository;
        this.wishlistEntryRepository = wishlistEntryRepository;
        this.entityRepository = entityRepository;
    }

    @Operation(summary = "Wishlist partagée en lecture seule via un jeton - 404 si le lien n'existe pas ou a été supprimé")
    @GetMapping("/{token}")
    public List<SharedWishlistEntryResponse> shared(@PathVariable String token) {
        shareSettingsRepository.findByToken(token)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lien introuvable"));

        return wishlistEntryRepository.findAll().stream()
                .map(this::enrich)
                .filter(Optional::isPresent)
                .map(Optional::get)
                .collect(Collectors.toList());
    }

    /** Vide si l'Entity référencée a disparu depuis (ne devrait pas arriver en usage normal, mais une
     * entrée de wishlist ne doit jamais faire planter cette vue publique). */
    private Optional<SharedWishlistEntryResponse> enrich(WishlistEntry entry) {
        Optional<Entity> entity = entityRepository.findById(entry.entityId());
        if (entity.isEmpty()) {
            return Optional.empty();
        }
        Object coverImageUrl = entity.get().attributes().get("coverImageUrl");
        return Optional.of(new SharedWishlistEntryResponse(entity.get().title(),
                coverImageUrl instanceof String url ? url : null, entry.addedAt()));
    }
}
