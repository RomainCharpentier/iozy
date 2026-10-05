package com.iozycore.core.domain.shared;

import java.util.UUID;

/**
 * Thrown when someone tries to delete a Volume (Variant) while
 * Ownerships or Experiences still reference it - the FK constraints
 * {@code ownership.variant_id} / {@code experience.variant_id} would
 * otherwise reject the deletion with a raw SQL error rather than a clear message.
 * Same invariant as {@link EntityDeletionNotAllowedException}: data
 * never disappears silently.
 * <p>
 * Target catalog model Series -> Edition -> Volume: a Volume exists
 * independently of its ownership (see Entity.removeVariant / VariantDeletionService)
 * - this guard protects an EXPLICIT deletion, it never applies
 * automatically when an Ownership is simply sold/lost/deleted.
 */
public class VariantDeletionNotAllowedException extends RuntimeException {

    public VariantDeletionNotAllowedException(UUID variantId, long ownershipCount, long experienceCount) {
        super("Impossible de supprimer le tome %s : %d ownership(s) et %d expérience(s) le référencent encore"
                .formatted(variantId, ownershipCount, experienceCount));
    }
}
