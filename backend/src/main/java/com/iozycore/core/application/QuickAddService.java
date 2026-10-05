package com.iozycore.core.application;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Orchestration of path 1 ("the hurried collector", step 5):
 * create an Entity and its initial Ownership in a single operation,
 * then publish the domain events accumulated on both aggregates.
 * <p>
 * Implements the deduplication planned since UC1 (step 6): if an Entity of the
 * same type already has exactly the same title (case insensitive),
 * no duplicate is created in the Catalog - a new Ownership is simply attached to
 * the existing Entity (typically: a second
 * copy of the same volume, or an accidental re-scan of the same barcode).
 * <p>
 * Series / volume distinction (Manga): the title identifies the SERIES (the Entity),
 * never a specific volume - "L'Attaque des Titans" stays one single page that
 * we own in several volumes, not one page per volume. A specific volume
 * of a specific edition (volumeNumber + edition, both optional) is
 * modeled as a Variant of this Entity (see Variant, "e.g. Tome 3") and
 * the created Ownership is attached to it via variantId - this is what lets us
 * tell "I own volume 3" from "I own volume 7" instead
 * of piling up anonymous, indistinguishable Ownerships under the same page.
 * <p>
 * Target catalog model Series -> Edition -> Volume (step 3): when an
 * edition is given, this Variant is also linked to the matching catalog Edition
 * ({@code MangaEdition}) - identified-or-created with the same
 * deduplication logic as the Series/Volume (see {@link TomeResolver}),
 * never a duplicate Edition.
 */
@Service
public class QuickAddService {

    private final EntityRepository entityRepository;
    private final OwnershipRepository ownershipRepository;
    private final CatalogEntityResolver catalogEntityResolver;
    private final TomeResolver tomeResolver;
    private final WishlistEntryRepository wishlistEntryRepository;
    private final ApplicationEventPublisher eventPublisher;

    public QuickAddService(EntityRepository entityRepository,
                            OwnershipRepository ownershipRepository,
                            CatalogEntityResolver catalogEntityResolver,
                            TomeResolver tomeResolver,
                            WishlistEntryRepository wishlistEntryRepository,
                            ApplicationEventPublisher eventPublisher) {
        this.entityRepository = entityRepository;
        this.ownershipRepository = ownershipRepository;
        this.catalogEntityResolver = catalogEntityResolver;
        this.tomeResolver = tomeResolver;
        this.wishlistEntryRepository = wishlistEntryRepository;
        this.eventPublisher = eventPublisher;
    }

    /** Result of the quick add: tells whether a duplicate was avoided by reusing
     * an existing Entity, and likewise for the Variant (volume) if any -
     * variantId is null if no volume number was given (e.g. video game,
     * board game, or manga added without giving a volume). */
    public record QuickAddResult(UUID entityId, boolean matchedExistingEntity,
                                  UUID variantId, boolean matchedExistingVariant) {
    }

    @Transactional
    public QuickAddResult addNewEntityWithOwnership(UUID entityTypeId, String title, OwnershipCondition condition) {
        return addNewEntityWithOwnership(entityTypeId, title, condition, Map.of());
    }

    /**
     * Variant accepting pre-filled attributes - typically coming from
     * a MetadataCandidate chosen after a search through
     * MetadataSearchService (Metadata Enrichment module). Stays
     * deliberately decoupled from this module: QuickAddService only knows
     * generic attributes, never Jikan/BGG directly.
     */
    @Transactional
    public QuickAddResult addNewEntityWithOwnership(UUID entityTypeId, String title, OwnershipCondition condition,
                                                      Map<String, Object> prefilledAttributes) {
        return addNewEntityWithOwnership(entityTypeId, title, condition, prefilledAttributes, null, null);
    }

    /**
     * Full variant, used by the quick add form: volumeNumber
     * and edition are both optional (null if not given, e.g. a video
     * game has no volume). When volumeNumber is given, the created Ownership
     * references a "Tome N" Variant (or "Tome N — edition" if edition is
     * given) rather than staying anonymous.
     */
    @Transactional
    public QuickAddResult addNewEntityWithOwnership(UUID entityTypeId, String title, OwnershipCondition condition,
                                                      Map<String, Object> prefilledAttributes,
                                                      Integer volumeNumber, String edition) {
        return addNewEntityWithOwnership(entityTypeId, title, condition, prefilledAttributes, volumeNumber, edition, null);
    }

    /**
     * Full variant with a cover of the volume's own (see VolumeCandidate,
     * Metadata Enrichment module) - typically a real cover found
     * through the visual selection of volumes (Google Books), different from the
     * cover of the SERIES in prefilledAttributes (the one from Jikan/MAL).
     * Stored on the Variant, never on the Entity: each volume keeps its
     * own cover rather than overwriting the one of the series.
     */
    @Transactional
    public QuickAddResult addNewEntityWithOwnership(UUID entityTypeId, String title, OwnershipCondition condition,
                                                      Map<String, Object> prefilledAttributes,
                                                      Integer volumeNumber, String edition, String volumeImageUrl) {
        return addNewEntityWithOwnership(
                entityTypeId, title, condition, prefilledAttributes, volumeNumber, edition, volumeImageUrl, null);
    }

    /**
     * Full variant with optional purchase price (see Ownership.updatePurchasePrice) -
     * never guessed: null if not given when adding, stays editable afterwards
     * via PATCH /api/ownerships/{id}/purchase-price.
     */
    @Transactional
    public QuickAddResult addNewEntityWithOwnership(UUID entityTypeId, String title, OwnershipCondition condition,
                                                      Map<String, Object> prefilledAttributes,
                                                      Integer volumeNumber, String edition, String volumeImageUrl,
                                                      BigDecimal purchasePrice) {
        return addNewEntityWithOwnership(entityTypeId, title, condition, prefilledAttributes, volumeNumber, edition,
                volumeImageUrl, purchasePrice, null);
    }

    /**
     * Variant accepting an acquisition DATE, for one single use: undoing a
     * removal.
     * <p>
     * Removing a volume deletes its Ownership; adding it back creates a new one, so
     * dated today. A round trip thus lost the real acquisition date
     * without anything saying so - noticed on 2026-08-28 on a volume
     * that went from 26/08 to 28/08 after one click too many. The undo offered
     * by the screen (see EntityDetailPage) therefore gives back the original date rather than
     * making one up.
     * <p>
     * {@code null} = today, as before: it is an ordinary add.
     */
    public QuickAddResult addNewEntityWithOwnership(UUID entityTypeId, String title, OwnershipCondition condition,
                                                      Map<String, Object> prefilledAttributes,
                                                      Integer volumeNumber, String edition, String volumeImageUrl,
                                                      BigDecimal purchasePrice, LocalDate acquiredAt) {
        // "Make the catalog page exist" is now extracted into
        // CatalogEntityResolver, shared with the Wishes path: the
        // deduplication rule (type + title) and the attribute merge live in only
        // one place, so the two paths cannot produce two different
        // Entities for the same work. The save there is immediate,
        // which TomeResolver needs: a brand new Entity must exist in the
        // database before a MangaEdition references its id (FK constraint
        // manga_edition.entity_id).
        CatalogEntityResolver.Resolution resolution =
                catalogEntityResolver.resolveOrCreate(entityTypeId, title, prefilledAttributes);
        Entity entity = resolution.entity();
        boolean matchedExisting = resolution.matchedExisting();

        UUID variantId = null;
        boolean matchedExistingVariant = false;
        if (volumeNumber != null) {
            // "Make the volume exist" now lives in TomeResolver, shared
            // with the Wishes path: the deduplication by label and the
            // link to the catalog Edition are written only once, so
            // wanting then buying a volume necessarily lands on the SAME Variant.
            TomeResolver.Resolution tome = tomeResolver.resoudre(entity, volumeNumber, edition, volumeImageUrl);
            variantId = tome.variant().id();
            // A Variant already present on the Entity does not necessarily mean that this
            // specific volume is already owned (it may have been sold/lost since, or
            // may have only ever been wanted) - a duplicate is only reported if an
            // active Ownership of it still exists.
            UUID finalVariantId = variantId;
            matchedExistingVariant = tome.matchedExisting() && ownershipRepository.findByEntityId(entity.id()).stream()
                    .anyMatch(ownership -> ownership.isActive()
                            && ownership.variantId().map(finalVariantId::equals).orElse(false));
        }

        Ownership ownership = Ownership.acquire(entity.id(), variantId, condition,
                acquiredAt != null ? acquiredAt : LocalDate.now(), null);
        if (purchasePrice != null) {
            ownership.updatePurchasePrice(purchasePrice);
        }

        entityRepository.save(entity);
        ownershipRepository.save(ownership);
        retirerDesEnvies(entity.id(), variantId);

        entity.pullDomainEvents().forEach(eventPublisher::publishEvent);
        ownership.pullDomainEvents().forEach(eventPublisher::publishEvent);

        return new QuickAddResult(entity.id(), matchedExisting, variantId, matchedExistingVariant);
    }

    /**
     * A work that was just acquired is no longer a wish.
     * <p>
     * Found during the audit: "Death Note" and "Naruto" appeared both
     * "Owned" and "In your wishes" in the search, for lack of a
     * point where the wish closes. Placed HERE and not on the web side because
     * several paths create an Ownership (adding from a detail page, from
     * a preview, from the scan, manual entry): handling them one by one
     * guaranteed that one would be forgotten.
     * <p>
     * Product decision settled with the user: remove rather than
     * report. The annoying consequence of the first version - buying a
     * volume erased the wish of the WHOLE series - disappeared with V21: the wish
     * now is about a volume, and only that one closes.
     * <p>
     * Idempotent and silent: no wish for this work is by far the
     * most frequent case, it is not an anomaly.
     */
    private void retirerDesEnvies(UUID entityId, UUID variantId) {
        // The wish that closes is the one of the item that was just acquired:
        // the VOLUME if there is one, the work otherwise (type with no notion of volume).
        // Buying volume 3 must change nothing to the wish of volume 7 - that is
        // the whole point of having moved the wish down to the volume (see V21).
        Optional<WishlistEntry> aReferner = variantId != null
                ? wishlistEntryRepository.findByVariantId(variantId)
                : wishlistEntryRepository.findByEntityId(entityId);
        aReferner.ifPresent(entree -> wishlistEntryRepository.deleteById(entree.id()));
    }

}
