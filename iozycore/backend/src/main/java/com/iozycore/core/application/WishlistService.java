package com.iozycore.core.application;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.ownership.OwnershipStatus;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
import com.iozycore.core.metadata.MetadataDetailsService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Use cases of the wishlist (UC5) and of the check before purchase (UC4).
 * <p>
 * Errors are plain exceptions, never HTTP types: an {@link IllegalArgumentException}
 * for a bad request (400) and an {@link IllegalStateException} for a conflict (409).
 * {@code ApiExceptionHandler} turns them into responses.
 */
@Service
@RequiredArgsConstructor
public class WishlistService {

    private final WishlistEntryRepository wishlistEntryRepository;
    private final OwnershipRepository ownershipRepository;
    private final EntityRepository entityRepository;
    private final EntityTypeRepository entityTypeRepository;
    private final CatalogEntityResolver catalogEntityResolver;
    private final TomeResolver tomeResolver;
    private final WorkFollowing workFollowing;
    private final MetadataDetailsService metadataDetailsService;

    /**
     * What to add. The work is given by {@code entityId}, or by {@code entityTypeId} +
     * {@code title} when it has no page yet. The item is given by {@code variantId},
     * by {@code volumeNumber} (+ {@code edition}), or by neither for the whole work.
     */
    public record AddToWishlist(UUID entityId, UUID variantId, Integer volumeNumber, String edition,
                                UUID entityTypeId, String title, Map<String, Object> attributes) {
    }

    /** Answer of path 3 (check before purchase). */
    public enum WishlistStatus { OWNED, WISHLISTED, UNKNOWN }

    /**
     * Adds to the wishes the item really wanted: a volume when the type has them,
     * the whole work otherwise. Never creates an ownership. Idempotent: an item
     * already wanted returns its existing entry.
     * <p>
     * Not one transaction on purpose: completing a work from an external search
     * calls the metadata providers, and a transaction would hold a database
     * connection for the whole round trip. The catalog writes are transactional
     * on their own (CatalogEntityResolver, TomeResolver).
     */
    public WishlistEntry add(AddToWishlist command) {
        UUID entityId = resolveEntityId(command);
        UUID variantId = resolveVariantId(entityId, command);

        if (variantId != null) {
            refuseIfAlreadyOwned(variantId);
        }
        // One state at a time (Owned / Followed / Wish): wanting the WHOLE work
        // means no longer following it. Wanting a volume says nothing about its series.
        if (variantId == null) {
            workFollowing.wantedAsAWhole(entityId);
        }

        // Idempotent: two adds from two surfaces (or a double click) must not
        // produce two entries. The question is about the VOLUME when there is one,
        // about the work otherwise.
        Optional<WishlistEntry> existing = variantId != null
                ? wishlistEntryRepository.findByVariantId(variantId)
                : wishlistEntryRepository.findByEntityId(entityId);
        if (existing.isPresent()) {
            return existing.get();
        }

        WishlistEntry entry = variantId != null
                ? WishlistEntry.addVariant(entityId, variantId, LocalDate.now())
                : WishlistEntry.add(entityId, LocalDate.now());
        return wishlistEntryRepository.save(entry);
    }

    public List<WishlistEntry> listAll() {
        return wishlistEntryRepository.findAll();
    }

    /** Only removes the wish, never the work, the volume nor an ownership. Idempotent. */
    @Transactional
    public void remove(UUID id) {
        wishlistEntryRepository.deleteById(id);
    }

    public WishlistStatus lookup(UUID entityId) {
        if (ownershipRepository.existsByEntityId(entityId)) {
            return WishlistStatus.OWNED;
        }
        // findAllByEntityId: since V21, the wish is about a volume. "Is this
        // work wanted?" means "do you want anything of it?", without which a
        // series of which five volumes are wanted would come out UNKNOWN.
        if (!wishlistEntryRepository.findAllByEntityId(entityId).isEmpty()) {
            return WishlistStatus.WISHLISTED;
        }
        return WishlistStatus.UNKNOWN;
    }

    /**
     * Returns the wanted VOLUME, or null when the wish is about the whole work.
     * <p>
     * A received {@code variantId} is checked to really belong to the announced
     * work: without this check, a forged request would attach the wish of a volume
     * to another series.
     * <p>
     * A {@code volumeNumber} makes the volume exist in the catalog if it is not
     * there yet: this is the NORMAL case from a detail page, where missing volumes
     * are mostly deduced from the total of the edition. It is the same move as the
     * quick add, without the ownership.
     */
    private UUID resolveVariantId(UUID entityId, AddToWishlist command) {
        if (command.variantId() != null) {
            boolean belongs = entityRepository.findById(entityId)
                    .map(work -> work.variants().stream().anyMatch(v -> v.id().equals(command.variantId())))
                    .orElse(false);
            if (!belongs) {
                throw new IllegalArgumentException(
                        "Ce tome n'appartient pas à cette œuvre : " + command.variantId());
            }
            return command.variantId();
        }
        if (command.volumeNumber() == null) {
            return null;
        }
        if (command.volumeNumber() < 1) {
            throw new IllegalArgumentException("Numéro de tome invalide : " + command.volumeNumber());
        }
        Entity work = entityRepository.findById(entityId)
                .orElseThrow(() -> new IllegalArgumentException("Entité introuvable : " + entityId));
        return tomeResolver.resoudreEtSauver(work, command.volumeNumber(), command.edition()).variant().id();
    }

    /**
     * "I want it" and "I have it" are two states of the SAME item, never two
     * superposed states (product study of 2026-08-27, §1). The rule is enforced
     * here so that it holds whatever the caller.
     */
    private void refuseIfAlreadyOwned(UUID variantId) {
        boolean owned = ownershipRepository.findAll().stream()
                .anyMatch(o -> o.status() == OwnershipStatus.OWNED
                        && o.variantId().map(variantId::equals).orElse(false));
        if (owned) {
            throw new IllegalStateException(
                    "Ce tome est déjà dans ta collection - « je le veux » n'a plus lieu d'être");
        }
    }

    /**
     * Returns the canonical catalog identity of the work to put in wishes.
     * <p>
     * A work coming from an external search or a scan has no page yet: it is
     * resolved-or-created here, <b>without any ownership</b> (Catalog is not
     * Collection). The deduplication is the one of {@link CatalogEntityResolver},
     * shared with the quick add.
     */
    private UUID resolveEntityId(AddToWishlist command) {
        if (command.entityId() != null) {
            // Without this check, only the foreign key protected the table, and an
            // unknown work came up as a 500 carrying the SQL query (Batch 28).
            entityRepository.findById(command.entityId())
                    .orElseThrow(() -> new IllegalArgumentException("Entité introuvable : " + command.entityId()));
            return command.entityId();
        }
        if (command.entityTypeId() == null || command.title() == null || command.title().isBlank()) {
            throw new IllegalArgumentException("Il faut soit un entityId, soit un entityTypeId et un titre");
        }
        entityTypeRepository.findById(command.entityTypeId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Type de collection introuvable : " + command.entityTypeId()));
        return catalogEntityResolver
                .resolveOrCreate(command.entityTypeId(), command.title(),
                        metadataDetailsService.complete(command.entityTypeId(), command.attributes()))
                .entity()
                .id();
    }
}
