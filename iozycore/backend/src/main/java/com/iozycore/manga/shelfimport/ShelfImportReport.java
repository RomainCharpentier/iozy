package com.iozycore.manga.shelfimport;

import java.util.List;
import java.util.UUID;

/**
 * What an import did, volume by volume.
 *
 * @param items one result per requested volume, in the order of the request
 */
public record ShelfImportReport(List<ImportedItem> items) {

    public ShelfImportReport {
        items = items == null ? List.of() : List.copyOf(items);
    }

    public enum Outcome {
        /** The volume was added to the collection. */
        ADDED,
        /** A copy of this number was still owned: nothing was written. */
        ALREADY_OWNED
    }

    /**
     * @param seriesCreated true if the series did not exist in the catalog and was just created
     * @param entityId      the series, found or created
     */
    public record ImportedItem(String seriesTitle, int volumeNumber, String edition, Outcome outcome,
                               boolean seriesCreated, UUID entityId) {
    }

    public long added() {
        return items.stream().filter(i -> i.outcome() == Outcome.ADDED).count();
    }

    public long alreadyOwned() {
        return items.stream().filter(i -> i.outcome() == Outcome.ALREADY_OWNED).count();
    }

    public long seriesCreated() {
        return items.stream().filter(ImportedItem::seriesCreated).count();
    }
}
