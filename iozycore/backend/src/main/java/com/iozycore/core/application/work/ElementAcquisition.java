package com.iozycore.core.application.work;

import com.iozycore.core.application.CatalogEntityResolver;
import com.iozycore.core.application.NotFoundException;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.shared.TexteRecherche;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * "Je l'ai" on an element of a work: the copy is created the way the add field
 * creates one (an ownership of the work or of one of its variants, the wish of
 * that element closed), so an element owned from the page and one added from
 * the field are the same thing.
 *
 * <p>Idempotent: when the account already has an active copy of that work or
 * variant, it is returned and nothing is created. The ownerships are the
 * account's own (Hibernate tenant), the catalog is shared.
 */
@Service
@RequiredArgsConstructor
public class ElementAcquisition {

    private final EntityRepository entityRepository;
    private final OwnershipRepository ownershipRepository;
    private final WishlistEntryRepository wishlistEntryRepository;
    private final CatalogEntityResolver catalogEntityResolver;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Owns a work as a whole ({@code variantId} null) or one of its variants. A copy
     * on another console is another copy: a game owned on PS4 is not owned on Switch.
     *
     * @param platform the console of the copy, or {@code null}
     * @return the active ownership, new or already there
     */
    @Transactional
    public UUID own(UUID entityId, UUID variantId, String platform) {
        Optional<Ownership> existing = ownershipRepository.findByEntityId(entityId).stream()
                .filter(Ownership::isActive)
                .filter(o -> variantId == null ? o.variantId().isEmpty()
                        : o.variantId().filter(variantId::equals).isPresent())
                .filter(o -> platform == null || o.platform().isEmpty()
                        || TexteRecherche.normaliser(o.platform().get()).equals(TexteRecherche.normaliser(platform)))
                .findFirst();
        if (existing.isPresent()) {
            return existing.get().id();
        }
        Ownership ownership = Ownership.acquire(entityId, variantId, OwnershipCondition.NEW, LocalDate.now(), null);
        ownership.updatePlatform(platform);
        ownershipRepository.save(ownership);
        Optional<WishlistEntry> wish = variantId != null
                ? wishlistEntryRepository.findByVariantId(variantId)
                : wishlistEntryRepository.findByEntityId(entityId);
        wish.ifPresent(entry -> wishlistEntryRepository.deleteById(entry.id()));
        ownership.pullDomainEvents().forEach(eventPublisher::publishEvent);
        return ownership.id();
    }

    /**
     * Owns a work found by type and title in the catalog, or created there with
     * these attributes - the deduplication of the add field.
     *
     * @return the work that is now owned
     */
    @Transactional
    public UUID ownWork(UUID entityTypeId, String title, Map<String, Object> attributes, String platform) {
        Entity work = catalogEntityResolver.resolveOrCreate(entityTypeId, title, attributes).entity();
        own(work.id(), null, platform);
        return work.id();
    }

    /**
     * Owns a variant of a work, added to the work when no variant stands for it
     * yet (an expansion read from a provider becomes a variant of its base game).
     *
     * <p>A variant stands for it when it carries the same provider id
     * ({@code idAttribute}, "bggId"), or when it has the same label and no
     * provider id of its own. Two expansions may share a short label (promos
     * often do): the second one must get its own variant, not the first one's.
     *
     * @param idAttribute the attribute that holds the provider id in {@code attributes}, or {@code null}
     * @throws NotFoundException the work does not exist
     */
    @Transactional
    public UUID ownVariant(UUID entityId, String label, Map<String, Object> attributes, String idAttribute) {
        Entity work = entityRepository.findById(entityId)
                .orElseThrow(() -> new NotFoundException("Œuvre introuvable : " + entityId));
        Variant variant = variantFor(work, label, attributes, idAttribute).orElse(null);
        if (variant == null) {
            variant = work.addVariant(label, attributes);
            entityRepository.save(work);
            work.pullDomainEvents().forEach(eventPublisher::publishEvent);
        }
        own(entityId, variant.id(), null);
        return variant.id();
    }

    static Optional<Variant> variantFor(Entity work, String label, Map<String, Object> attributes,
                                        String idAttribute) {
        String id = idAttribute == null ? null : textOf(attributes.get(idAttribute));
        if (id == null) {
            return work.findVariantByLabel(label);
        }
        Optional<Variant> sameId = work.variants().stream()
                .filter(v -> id.equals(textOf(v.attributes() == null ? null : v.attributes().get(idAttribute))))
                .findFirst();
        if (sameId.isPresent()) {
            return sameId;
        }
        return work.variants().stream()
                .filter(v -> v.label().equalsIgnoreCase(label))
                .filter(v -> v.attributes() == null || textOf(v.attributes().get(idAttribute)) == null)
                .findFirst();
    }

    private static String textOf(Object value) {
        if (value == null) {
            return null;
        }
        String text = value.toString().trim();
        return text.isEmpty() ? null : text;
    }
}
