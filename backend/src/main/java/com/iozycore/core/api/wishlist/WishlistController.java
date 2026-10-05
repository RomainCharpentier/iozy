package com.iozycore.core.api.wishlist;

import com.iozycore.core.application.WorkFollowing;

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
@Tag(name = "Wishlist", description = "UC5 - wishlist, and UC4 - check before purchase")
public class WishlistController {

    private final WishlistEntryRepository wishlistEntryRepository;
    private final OwnershipRepository ownershipRepository;
    private final EntityRepository entityRepository;
    private final EntityTypeRepository entityTypeRepository;
    private final CatalogEntityResolver catalogEntityResolver;
    private final TomeResolver tomeResolver;
    private final WorkFollowing workFollowing;

    public WishlistController(WishlistEntryRepository wishlistEntryRepository,
                               OwnershipRepository ownershipRepository,
                               EntityRepository entityRepository,
                               EntityTypeRepository entityTypeRepository,
                               CatalogEntityResolver catalogEntityResolver,
                               TomeResolver tomeResolver,
                               WorkFollowing workFollowing) {
        this.wishlistEntryRepository = wishlistEntryRepository;
        this.ownershipRepository = ownershipRepository;
        this.entityRepository = entityRepository;
        this.entityTypeRepository = entityTypeRepository;
        this.catalogEntityResolver = catalogEntityResolver;
        this.tomeResolver = tomeResolver;
        this.workFollowing = workFollowing;
    }

    @Operation(summary = "Add to the wishes the item really wanted: a volume (variantId, or volumeNumber "
            + "+ edition) when the type has them, the whole work otherwise. The work is designated by its entityId or, "
            + "if it has no page yet, by entityTypeId + title. Never creates an ownership.")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WishlistEntryResponse add(@RequestBody AddToWishlistRequest request) {
        UUID entityId = resolveEntityId(request);
        UUID variantId = resolveVariantId(entityId, request);

        if (variantId != null) {
            refuserSiDejaPossede(variantId);
        }
        // One state at a time (Owned / Followed / Wish): wanting the WHOLE work
        // means no longer following it. Wanting a volume says nothing about its series.
        if (variantId == null) {
            workFollowing.wantedAsAWhole(entityId);
        }

        // Idempotent: an item that is already wanted does not create a second one. Without
        // this, two adds from two surfaces (or a double click) would produce
        // two entries. The question is about the VOLUME when there is one, about
        // the work otherwise - it is the same item whose state is asked.
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
     * Returns the wanted VOLUME, or null when the wish is about the whole work.
     * <p>
     * A received {@code variantId} is checked to really belong to the announced
     * work: without this check, a forged request would attach the wish
     * of a volume to another series, and the detail page would show it on a volume that
     * is not its own.
     * <p>
     * A {@code volumeNumber} makes the volume exist in the catalog if it is not
     * there yet: this is the NORMAL case from a detail page, where missing
     * volumes are mostly deduced from the total of the edition without
     * ever having been cataloged. The catalog therefore grows by a volume that
     * really exists in this edition - it is the same move as the quick
     * add, without the ownership.
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
     * "I want it" and "I have it" are two states of the SAME item, never two
     * superposed states (see the product study of 2026-08-27, §1). Wanting a
     * volume that we already own is therefore refused here rather than hidden on the
     * interface side: the rule must hold whatever the caller.
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
     * Returns the canonical catalog identity of the work to put in wishes.
     * <p>
     * A work coming from an external search or a scan has no IozyCore
     * page yet: it is resolved-or-created here, <b>without any
     * ownership</b> - Catalog is not Collection. The deduplication is the one of
     * CatalogEntityResolver, shared with the quick add: the same work
     * found by two different sources lands on the same Entity.
     */
    private UUID resolveEntityId(AddToWishlistRequest request) {
        if (request.entityId() != null) {
            // Without this check, only the foreign key constraint of Postgres
            // protected the table: an unknown work came up as a 500 carrying
            // the SQL query and the name of the constraint (Batch 28).
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

    @Operation(summary = "List all entries of the wishlist (Wishlist tab)")
    @GetMapping
    public List<WishlistEntryResponse> listAll() {
        return wishlistEntryRepository.findAll().stream()
                .map(WishlistEntryResponse::from)
                .collect(Collectors.toList());
    }

    @Operation(summary = "Remove an entry from the wishlist - only targets WishlistEntry, "
            + "never the Series/Edition/Volume nor an Ownership. Idempotent: an id already removed does not return an error.")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable UUID id) {
        wishlistEntryRepository.deleteById(id);
    }

    @Operation(summary = "Path 3: check in one call whether an Entity is owned, in the wishlist, or unknown")
    @GetMapping("/lookup")
    public LookupResponse lookup(@RequestParam UUID entityId) {
        if (ownershipRepository.existsByEntityId(entityId)) {
            return LookupResponse.OWNED;
        }
        // findAllByEntityId: since V21, the wish is about a volume. "Is this
        // work wanted?" means "do you want anything of it?",
        // without which a series of which five volumes are wanted would come out UNKNOWN.
        if (!wishlistEntryRepository.findAllByEntityId(entityId).isEmpty()) {
            return LookupResponse.WISHLISTED;
        }
        return LookupResponse.UNKNOWN;
    }
}
