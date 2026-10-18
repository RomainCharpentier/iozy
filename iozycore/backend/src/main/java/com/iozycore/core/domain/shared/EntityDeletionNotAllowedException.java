package com.iozycore.core.domain.shared;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Thrown when someone tries to delete an Entity while Ownerships,
 * Experiences, or a catalog Edition (see {@code MangaEdition.entityId},
 * Series -> Edition -> Volume model) still reference it. Expresses the invariant
 * validated in design: data never disappears silently.
 */
public class EntityDeletionNotAllowedException extends RuntimeException {

    public EntityDeletionNotAllowedException(UUID entityId, long ownershipCount, long experienceCount, long editionCount) {
        // The web shows this message as is: French words only, no id.
        super("Impossible de supprimer cette fiche : elle a encore " + list(
                count(ownershipCount, "exemplaire", "exemplaires"),
                count(experienceCount, "expérience", "expériences"),
                count(editionCount, "édition", "éditions")) + ".");
    }

    static String count(long n, String singular, String plural) {
        return n == 0 ? null : n + " " + (n == 1 ? singular : plural);
    }

    /** Joins the non-null parts the French way: "a", "a et b", "a, b et c". */
    static String list(String... parts) {
        List<String> present = new ArrayList<>();
        for (String part : parts) {
            if (part != null) {
                present.add(part);
            }
        }
        if (present.size() <= 1) {
            return present.isEmpty() ? "" : present.get(0);
        }
        return String.join(", ", present.subList(0, present.size() - 1)) + " et " + present.get(present.size() - 1);
    }
}
