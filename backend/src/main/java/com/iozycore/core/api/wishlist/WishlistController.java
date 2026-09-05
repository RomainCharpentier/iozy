package com.iozycore.core.api.wishlist;

import com.iozycore.core.api.dto.WishlistDtos.AddToWishlistRequest;
import com.iozycore.core.api.dto.WishlistDtos.LookupResponse;
import com.iozycore.core.api.dto.WishlistDtos.WishlistEntryResponse;
import com.iozycore.core.application.CatalogEntityResolver;
import com.iozycore.core.application.TomeResolver;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.ownership.OwnershipStatus;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
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
    private final EntityRepository entityRepository;
    private final EntityTypeRepository entityTypeRepository;
    private final CatalogEntityResolver catalogEntityResolver;
    private final TomeResolver tomeResolver;

    public WishlistController(WishlistEntryRepository wishlistEntryRepository,
                               OwnershipRepository ownershipRepository,
                               EntityRepository entityRepository,
                               EntityTypeRepository entityTypeRepository,
                               CatalogEntityResolver catalogEntityResolver,
                               TomeResolver tomeResolver) {
        this.wishlistEntryRepository = wishlistEntryRepository;
        this.ownershipRepository = ownershipRepository;
        this.entityRepository = entityRepository;
        this.entityTypeRepository = entityTypeRepository;
        this.catalogEntityResolver = catalogEntityResolver;
        this.tomeResolver = tomeResolver;
    }

    @Operation(summary = "Ajouter aux envies l'objet réellement voulu : un tome (variantId, ou volumeNumber "
            + "+ edition) quand le type en a, l'œuvre entière sinon. L'œuvre se désigne par son entityId ou, "
            + "si elle n'a pas encore de fiche, par entityTypeId + titre. Ne crée jamais de possession.")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WishlistEntryResponse add(@RequestBody AddToWishlistRequest request) {
        UUID entityId = resolveEntityId(request);
        UUID variantId = resolveVariantId(entityId, request);

        if (variantId != null) {
            refuserSiDejaPossede(variantId);
        }

        // Idempotent : un même objet déjà voulu n'en crée pas un second. Sans
        // ça, deux ajouts depuis deux surfaces (ou un double clic) produiraient
        // deux entrées. La question porte sur le TOME quand il y en a un, sur
        // l'œuvre sinon - c'est le même objet dont on demande l'état.
        Optional<WishlistEntry> existante = variantId != null
                ? wishlistEntryRepository.findByVariantId(variantId)
                : wishlistEntryRepository.findByEntityId(entityId);
        if (existante.isPresent()) {
            return WishlistEntryResponse.from(existante.get());
        }

        WishlistEntry entry = variantId != null
                ? WishlistEntry.addVariant(entityId, variantId, LocalDate.now())
                : WishlistEntry.add(entityId, LocalDate.now());
        return WishlistEntryResponse.from(wishlistEntryRepository.save(entry));
    }

    /**
     * Rend le TOME voulu, ou null quand l'envie porte sur l'œuvre entière.
     * <p>
     * Un {@code variantId} reçu est vérifié comme appartenant bien à l'œuvre
     * annoncée : sans ce contrôle, une requête forgée rattacherait l'envie
     * d'un tome à une autre série, et la fiche l'afficherait sur un tome qui
     * n'est pas le sien.
     * <p>
     * Un {@code volumeNumber} fait exister le tome au catalogue s'il n'y est
     * pas encore : c'est le cas NORMAL depuis une fiche, où les tomes
     * manquants sont pour la plupart déduits du total de l'édition sans
     * jamais avoir été catalogués. Le catalogue grossit donc d'un tome qui
     * existe réellement dans cette édition - c'est le même geste que l'ajout
     * rapide, sans la possession.
     */
    private UUID resolveVariantId(UUID entityId, AddToWishlistRequest request) {
        if (request.variantId() != null) {
            boolean appartient = entityRepository.findById(entityId)
                    .map(oeuvre -> oeuvre.variants().stream().anyMatch(v -> v.id().equals(request.variantId())))
                    .orElse(false);
            if (!appartient) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Ce tome n'appartient pas à cette œuvre : " + request.variantId());
            }
            return request.variantId();
        }
        if (request.volumeNumber() == null) {
            return null;
        }
        if (request.volumeNumber() < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Numéro de tome invalide : " + request.volumeNumber());
        }
        Entity oeuvre = entityRepository.findById(entityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Entité introuvable : " + entityId));
        return tomeResolver.resoudreEtSauver(oeuvre, request.volumeNumber(), request.edition()).variant().id();
    }

    /**
     * « Je le veux » et « je l'ai » sont deux états du MÊME objet, jamais deux
     * états superposés (voir l'étude produit du 2026-08-27, §1). Vouloir un
     * tome qu'on possède déjà est donc refusé ici plutôt que masqué côté
     * interface : la règle doit tenir quel que soit l'appelant.
     */
    private void refuserSiDejaPossede(UUID variantId) {
        boolean possede = ownershipRepository.findAll().stream()
                .anyMatch(o -> o.status() == OwnershipStatus.OWNED
                        && o.variantId().map(variantId::equals).orElse(false));
        if (possede) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Ce tome est déjà dans ta collection - « je le veux » n'a plus lieu d'être");
        }
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
        // findAllByEntityId : depuis V21, l'envie porte sur un tome. « Cette
        // œuvre est-elle voulue ? » veut dire « en veux-tu quoi que ce soit ? »,
        // sans quoi une série dont on veut cinq tomes ressortirait UNKNOWN.
        if (!wishlistEntryRepository.findAllByEntityId(entityId).isEmpty()) {
            return LookupResponse.WISHLISTED;
        }
        return LookupResponse.UNKNOWN;
    }
}
