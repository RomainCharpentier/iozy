package com.iozycore.api.wishlist;

import com.iozycore.api.dto.WishlistDtos.AddToWishlistRequest;
import com.iozycore.api.dto.WishlistDtos.LookupResponse;
import com.iozycore.api.dto.WishlistDtos.ShareLinkResponse;
import com.iozycore.api.dto.WishlistDtos.WishlistEntryResponse;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.wishlist.WishlistEntry;
import com.iozycore.domain.wishlist.WishlistEntryRepository;
import com.iozycore.domain.wishlist.WishlistShareSettings;
import com.iozycore.domain.wishlist.WishlistShareSettingsRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/wishlist")
@Tag(name = "Wishlist", description = "UC5 - wishlist, et UC4 - vérification avant achat")
public class WishlistController {

    private final WishlistEntryRepository wishlistEntryRepository;
    private final OwnershipRepository ownershipRepository;
    private final WishlistShareSettingsRepository shareSettingsRepository;
    private final EntityRepository entityRepository;

    public WishlistController(WishlistEntryRepository wishlistEntryRepository,
                               OwnershipRepository ownershipRepository,
                               WishlistShareSettingsRepository shareSettingsRepository,
                               EntityRepository entityRepository) {
        this.wishlistEntryRepository = wishlistEntryRepository;
        this.ownershipRepository = ownershipRepository;
        this.shareSettingsRepository = shareSettingsRepository;
        this.entityRepository = entityRepository;
    }

    @Operation(summary = "Ajouter une Entity à la wishlist")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WishlistEntryResponse add(@RequestBody AddToWishlistRequest request) {
        // Sans ce contrôle, seule la contrainte de clé étrangère de Postgres
        // protégeait la table : une œuvre inconnue remontait un 500 portant la
        // requête SQL et le nom de la contrainte (Lot 28), là où
        // EditionUpgradeWishController - qui référence lui aussi une Entity -
        // répond depuis toujours un 400 lisible.
        entityRepository.findById(request.entityId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Entité introuvable : " + request.entityId()));
        WishlistEntry entry = WishlistEntry.add(request.entityId(), LocalDate.now());
        return WishlistEntryResponse.from(wishlistEntryRepository.save(entry));
    }

    @Operation(summary = "Lister toutes les entrées de la wishlist (onglet Wishlist)")
    @GetMapping
    public List<WishlistEntryResponse> listAll() {
        return wishlistEntryRepository.findAll().stream()
                .map(WishlistEntryResponse::from)
                .collect(Collectors.toList());
    }

    @Operation(summary = "Retirer une entrée de la wishlist - cible uniquement WishlistEntry, "
            + "jamais la Série/Édition/Tome ni une Ownership. Idempotent : un id déjà retiré ne renvoie pas d'erreur.")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable UUID id) {
        wishlistEntryRepository.deleteById(id);
    }

    @Operation(summary = "Parcours 3 : vérifier en un appel si une Entity est possédée, en wishlist, ou inconnue")
    @GetMapping("/lookup")
    public LookupResponse lookup(@RequestParam UUID entityId) {
        if (ownershipRepository.existsByEntityId(entityId)) {
            return LookupResponse.OWNED;
        }
        if (wishlistEntryRepository.findByEntityId(entityId).isPresent()) {
            return LookupResponse.WISHLISTED;
        }
        return LookupResponse.UNKNOWN;
    }

    @Operation(summary = "État courant du lien de partage de la wishlist (token null = pas de lien actif)")
    @GetMapping("/share")
    public ShareLinkResponse shareLink() {
        return new ShareLinkResponse(shareSettingsRepository.find().token());
    }

    @Operation(summary = "Générer (ou régénérer) le lien de partage - invalide silencieusement l'ancien jeton s'il en existait un")
    @PostMapping("/share")
    @ResponseStatus(HttpStatus.CREATED)
    public ShareLinkResponse generateShareLink() {
        WishlistShareSettings settings = shareSettingsRepository.save(WishlistShareSettings.withNewToken());
        return new ShareLinkResponse(settings.token());
    }

    @Operation(summary = "Supprimer le lien de partage - le jeton précédent cesse immédiatement de fonctionner")
    @DeleteMapping("/share")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeShareLink() {
        shareSettingsRepository.save(WishlistShareSettings.noLink());
    }
}
