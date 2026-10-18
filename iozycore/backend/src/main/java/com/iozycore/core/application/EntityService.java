package com.iozycore.core.application;

import com.iozycore.core.application.QuickAddService.QuickAddResult;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.metadata.CoverImageCheck;
import com.iozycore.core.metadata.MetadataDetailsService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Use cases of a catalog work (Series): quick add, reading, fixing its
 * attributes and title, completing a volume.
 */
@Service
@RequiredArgsConstructor
public class EntityService {

    private static final String COVER_IMAGE_URL = "coverImageUrl";

    private final EntityRepository entityRepository;
    private final EntityTypeLookup entityTypeLookup;
    private final QuickAddService quickAddService;
    private final MetadataDetailsService metadataDetailsService;
    private final List<CoverImageCheck> coverChecks;

    /** Where the attributes of a PATCH come from. */
    public enum AttributeOrigin {
        /** Typed by the user: each key is marked as typed by hand. */
        MANUAL,
        /** Returned by a provider: only writes the keys NOT typed by hand (Batch 130). */
        SOURCE;

        /** {@code manuelle} or {@code source}, the values of the public query parameter. */
        public static AttributeOrigin parse(String origin) {
            return switch (origin) {
                case "manuelle" -> MANUAL;
                case "source" -> SOURCE;
                default -> throw new IllegalArgumentException(
                        "origine inconnue : " + origin + " (manuelle ou source)");
            };
        }
    }

    public record QuickAdd(UUID entityTypeId, String title, OwnershipCondition condition,
                           Map<String, Object> attributes, Integer volumeNumber, String edition,
                           String volumeImageUrl, BigDecimal purchasePrice, LocalDate acquiredAt) {
    }

    /**
     * Path 1: creates the work and its first copy, or attaches a copy to the
     * existing work with the same title. The attributes are completed with what
     * the sources know before the add.
     */
    public QuickAddResult quickAdd(QuickAdd command) {
        entityTypeLookup.require(command.entityTypeId());
        Map<String, Object> attributes = metadataDetailsService.complete(command.entityTypeId(),
                command.attributes() == null ? Map.of() : command.attributes());
        return quickAddService.addNewEntityWithOwnership(
                command.entityTypeId(), command.title(), command.condition(), attributes,
                command.volumeNumber(), command.edition(), command.volumeImageUrl(), command.purchasePrice(),
                command.acquiredAt());
    }

    public Entity get(UUID id) {
        return entityRepository.findById(id).orElseThrow(() -> new NotFoundException("Entity introuvable : " + id));
    }

    public List<Entity> listByType(UUID entityTypeId) {
        return entityRepository.findAllByType(entityTypeId);
    }

    /**
     * Completes or fixes the attributes. The rule "a key typed by hand is never
     * overwritten by a source" is held here, not on the screen, so that it holds
     * from any action.
     */
    @Transactional
    public Entity mergeAttributes(UUID entityId, Map<String, Object> attributes, AttributeOrigin origin) {
        Entity entity = get(entityId);
        if (origin == AttributeOrigin.SOURCE) {
            entity.recopierDepuisLaSource(attributes);
        } else {
            entity.saisirAttributs(attributes);
        }
        return entityRepository.save(entity);
    }

    /** No error when the key did not exist. */
    @Transactional
    public void removeAttribute(UUID entityId, String key) {
        Entity entity = entityRepository.findById(entityId)
                .orElseThrow(() -> new NotFoundException("Entité introuvable : " + entityId));
        entity.removeAttribute(key);
        entityRepository.save(entity);
    }

    /** The domain refuses an empty title (400). Editions and volumes follow through the id, never the title. */
    @Transactional
    public Entity rename(UUID entityId, String title) {
        Entity entity = get(entityId);
        entity.rename(title);
        return entityRepository.save(entity);
    }

    /**
     * Completes the attributes of a volume without overwriting those already
     * filled in. A cover that a check finds unusable is left out.
     * <p>
     * Not transactional: a cover check can be an HTTP probe (BnF), and it must
     * not hold a database connection. There is a single save.
     */
    public Entity mergeVariantAttributes(UUID entityId, UUID variantId, Map<String, Object> attributes) {
        Entity entity = get(entityId);
        Map<String, Object> kept = attributes;
        if (attributes.get(COVER_IMAGE_URL) instanceof String url
                && coverChecks.stream().anyMatch(check -> !check.estUtilisable(url))) {
            kept = new HashMap<>(attributes);
            kept.remove(COVER_IMAGE_URL);
        }
        if (entity.variants().stream().noneMatch(v -> v.id().equals(variantId))) {
            throw new NotFoundException("Variant introuvable : " + variantId);
        }
        entity.mergeVariantAttributes(variantId, kept);
        return entityRepository.save(entity);
    }
}
