package com.iozycore.api.wishlist;

import com.iozycore.api.dto.WishlistDtos.AddToWishlistRequest;
import com.iozycore.api.dto.WishlistDtos.LookupResponse;
import com.iozycore.api.dto.WishlistDtos.ShareLinkResponse;
import com.iozycore.api.dto.WishlistDtos.WishlistEntryResponse;
import com.iozycore.application.CatalogEntityResolver;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityTypeRepository;
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
import java.util.Optional;
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
    private final EntityTypeRepository entityTypeRepository;
    private final CatalogEntityResolver catalogEntityResolver;

    public WishlistController(WishlistEntryRepository wishlistEntryRepository,
                               OwnershipRepository ownershipRepository,
                               WishlistShareSettingsRepository shareSettingsRepository,
                               EntityRepository entityRepository,
                               EntityTypeRepository entityTypeRepository,
                               CatalogEntityResolver catalogEntityResolver) {
        this.wishlistEntryRepository = wishlistEntryRepository;
        this.ownershipRepository = ownershipRepository;
        this.shareSettingsRepository = shareSettingsRepository;
        this.entityRepository = entityRepository;
        this.entityTypeRepository = entityTypeRepository;
        this.catalogEntityResolver = catalogEntityResolver;
    }

    @Operation(summary = "Ajouter une œuvre aux envies - par son entityId, ou par sa référence externe "
            + "(entityTypeId + titre) si elle n'a pas encore de fiche. Ne crée jamais de possession.")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WishlistEntryResponse add(@RequestBody AddToWishlistRequest request) {
        UUID entityId = resolveEntityId(request);

        // Idempotent : une œuvre déjà en envies n'en crée pas une seconde. Sans
        // ça, deux ajouts depuis deux surfaces (ou un double clic) produiraient
        // deux entrées pour la même œuvre.
        Optional<WishlistEntry> existing = wishlistEntryRepository.findByEntityId(entityId);
        if (existing.isPresent()) {
            return WishlistEntryResponse.from(existing.get());
        }

        WishlistEntry entry = WishlistEntry.add(entityId, LocalDate.now());
        return WishlistEntryResponse.from(wishlistEntryRepository.save(entry));
    }

    /**
     * Rend l'identité catalogue canonique de l'œuvre à mettre en envies.
     * <p>
     * Une œuvre venue d'une recherche externe ou d'un scan n'a pas encore de
     * fiche IozyCore : elle est résolue-ou-créée ici, <b>sans aucune
     * possession</b> - Catalogue ≠ Collection. La déduplication est celle de
     * CatalogEntityResolver, partagée avec l'ajout rapide : la même œuvre
     * trouvée par deux sources différentes retombe sur la même Entity.
     */
    private UUID resolveEntityId(AddToWishlistRequest request) {
        if (request.entityId() != null) {
            // Sans ce contrôle, seule la contrainte de clé étrangère de Postgres
            // protégeait la table : une œuvre inconnue remontait un 500 portant
            // la requête SQL et le nom de la contrainte (Lot 28).
            entityRepository.findById(request.entityId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Entité introuvable : " + request.entityId()));
            return request.entityId();
        }
        if (request.entityTypeId() == null || request.title() == null || request.title().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Il faut soit un entityId, soit un entityTypeId et un titre");
        }
        entityTypeRepository.findById(request.entityTypeId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Type de collection introuvable : " + request.entityTypeId()));
        return catalogEntityResolver
                .resolveOrCreate(request.entityTypeId(), request.title(), request.attributes())
                .entity()
                .id();
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
