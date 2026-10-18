package com.iozycore.core.application;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.experience.ExperienceRepository;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.shared.EntityDeletionNotAllowedException;
import com.iozycore.core.domain.shared.VariantDeletionNotAllowedException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.List;

/**
 * Explicit deletion of a Volume (Variant) - user action (see "Delete this
 * volume"), never triggered automatically. Target catalog model Series -> Edition ->
 * Volume (step 4): a cataloged Volume exists independently of its ownership, so
 * deleting its last active Ownership (see OwnershipDeletionService) NEVER
 * deletes it - only this explicit action does, and only if no
 * Ownership or Experience references it anymore (same pattern as
 * EntityDeletionService: the Entity domain does not know the repositories of the
 * other aggregates, so the rule is orchestrated here).
 * <p>
 * Unlike EntityDeletionService (blocked by any Ownership, even
 * sold/lost), this guard ONLY looks at the Ownerships/Experiences that reference
 * THIS specific Variant - another volume of the same series can very well stay owned.
 * <p>
 * Step 5 ("no volume -> no edition -> no series"): once the Volume is removed,
 * cascade upwards - its catalog Edition disappears in turn if it has no
 * Volume left, then the Series itself if it has no Volume at all (not
 * only no Edition: a Volume without a given edition also counts as
 * a real cataloged Volume, see QuickAddService). Both cascades are silent
 * when something else still holds the data (market observation on
 * the Edition, generic Ownership without Variant on the Series...) - it is never an
 * error for this call, only a cascade that stops where it must.
 */
@Service
@RequiredArgsConstructor
public class VariantDeletionService {

    private final EntityRepository entityRepository;
    private final OwnershipRepository ownershipRepository;
    private final ExperienceRepository experienceRepository;
    /** What each universe does after the deletion of a volume - the cleanup of orphan editions, on the manga side (Batch 133). */
    private final List<VariantDeletionHook> hooks;
    private final EntityDeletionService entityDeletionService;

    public void delete(UUID entityId, UUID variantId) {
        Entity entity = entityRepository.findById(entityId)
                .orElseThrow(() -> new NotFoundException("Entity introuvable : " + entityId));

        long ownershipCount = ownershipRepository.findByEntityId(entityId).stream()
                .filter(ownership -> ownership.variantId().map(variantId::equals).orElse(false))
                .count();
        long experienceCount = experienceRepository.findByEntityId(entityId).stream()
                .filter(experience -> experience.variantId().map(variantId::equals).orElse(false))
                .count();
        if (ownershipCount > 0 || experienceCount > 0) {
            throw new VariantDeletionNotAllowedException(variantId, ownershipCount, experienceCount);
        }

        Variant tomeSupprime = entity.variants().stream()
                .filter(v -> v.id().equals(variantId))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Variant introuvable : " + variantId));

        entity.removeVariant(variantId);
        entityRepository.save(entity);

        // What each universe does afterwards - manga deletes the reference
        // edition that became orphan (see VariantDeletionHook, Batch 133).
        for (VariantDeletionHook hook : hooks) {
            hook.apresSuppression(entity, tomeSupprime, variantId);
        }
        cascadeDeleteEmptySeries(entity);
    }

    /**
     * "No volume -> no series": a Series emptied of all its cataloged Volumes (not
     * only of its Volumes attached to an Edition - a Volume without a given edition
     * counts just as much) becomes in turn a candidate for deletion. Reuses
     * EntityDeletionService rather than duplicating its guard: if it still blocks
     * (generic Ownership without Variant, Edition that survived above...), the Series
     * simply survives - it is not an error for this call.
     */
    private void cascadeDeleteEmptySeries(Entity entity) {
        if (!entity.variants().isEmpty()) {
            return;
        }
        try {
            entityDeletionService.delete(entity.id());
        } catch (EntityDeletionNotAllowedException e) {
            // Still held by something else - see javadoc above.
        }
    }
}
