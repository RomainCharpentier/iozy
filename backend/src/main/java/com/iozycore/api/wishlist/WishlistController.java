package com.iozycore.api.wishlist;

import com.iozycore.api.dto.WishlistDtos.AddToWishlistRequest;
import com.iozycore.api.dto.WishlistDtos.LookupResponse;
import com.iozycore.api.dto.WishlistDtos.ShareLinkResponse;
import com.iozycore.api.dto.WishlistDtos.WishlistEntryResponse;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.wishlist.WishlistEntry;
import com.iozycore.domain.wishlist.WishlistEntryRepository;
import com.iozycore.domain.wishlist.WishlistShareSettings;
import com.iozycore.domain.wishlist.WishlistShareSettingsRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

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

    public WishlistController(WishlistEntryRepository wishlistEntryRepository,
                               OwnershipRepository ownershipRepository,
                               WishlistShareSettingsRepository shareSettingsRepository) {
        this.wishlistEntryRepository = wishlistEntryRepository;
        this.ownershipRepository = ownershipRepository;
        this.shareSettingsRepository = shareSettingsRepository;
    }

    @Operation(summary = "Ajouter une Entity à la wishlist")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WishlistEntryResponse add(@RequestBody AddToWishlistRequest request) {
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
