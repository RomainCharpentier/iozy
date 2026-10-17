package com.iozycore.core.domain.insights;

import java.util.Objects;
import java.util.UUID;

/**
 * A line of the release calendar: what comes out, when, and what it
 * represents for the collection of the user.
 *
 * <p>The relation is what tells a calendar apart from a page of new releases:
 * a volume that comes out and that we do not have is an action, a volume we already have is
 * a confirmation, a work we want is an expectation. It is always
 * written - the same rule as the opportunities of Discover ("the reason,
 * always written").
 *
 * @param date         when, at the precision the source knows
 * @param entityId     the work of the catalog - the line leads to it
 * @param entityTitle  its title, as the detail page displays it
 * @param entityTypeId its category - the client filters and labels by it
 * @param label        what comes out within the work ("Volume 42 · Kana"), empty when it is the work itself
 * @param volumeNumber the volume number, or {@code null} outside manga
 * @param editionName  the edition of the volume, or {@code null}
 * @param coverImageUrl the cover of what comes out, or {@code null}
 * @param relation     what this release represents for the collection
 * @param source       where the date comes from - named, never guessed
 */
public record ReleaseEntry(ReleaseDate date, UUID entityId, String entityTitle, UUID entityTypeId,
                            String label, Integer volumeNumber, String editionName, String coverImageUrl,
                            Relation relation, String source) {

    public enum Relation {
        /** Already in the collection. */
        OWNED,
        /** The work is in the collection, this volume is not. */
        MISSING,
        /** In the wishes. */
        WANTED
    }

    public ReleaseEntry {
        Objects.requireNonNull(date, "date");
        Objects.requireNonNull(entityId, "entityId");
        Objects.requireNonNull(entityTypeId, "entityTypeId");
        Objects.requireNonNull(relation, "relation");
        Objects.requireNonNull(source, "source");
        entityTitle = entityTitle == null ? "" : entityTitle;
        label = label == null ? "" : label;
    }
}
