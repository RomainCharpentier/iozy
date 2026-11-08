package com.iozycore.core.domain.insights;

import java.util.List;
import java.util.UUID;

/**
 * Single answer to the question "how many volumes owned out of how many",
 * for a given work. See {@code CollectionProgressService} for the
 * rules - this record only carries them.
 */
public record CollectionProgress(UUID entityId, String title, List<EditionProgress> editions,
                                  EditionProgress dominantEdition, int ownedVolumeCount) {

    /**
     * Progress for ONE displayable edition.
     *
     * @param editionName         displayed name ("" = volumes with no specified edition, when they form a separate group)
     * @param sourceEditions      raw values of the "edition" attribute covered by this group - contains "" in addition
     *                            to the name when a merge happened (see CollectionProgressService)
     * @param ownedVolumeNumbers  volume numbers REALLY owned (active ownership), sorted, without duplicates
     * @param cataloguedVolumeNumbers volume numbers known to the catalog, owned or not
     * @param totalVolumes        total of the reference edition, {@code null} if it is not filled in -
     *                            never guessed from an attribute of the series (see Batch 16)
     * @param totalSource         where that total comes from: "MANUAL" (typed by a person), "PROVIDER"
     *                            (read in the French volume lists), {@code null} while the total is unknown
     * @param frenchRunFinished   true only when a source says the French run of this edition is over
     */
    public record EditionProgress(String editionName, List<String> sourceEditions,
                                   List<Integer> ownedVolumeNumbers, List<Integer> cataloguedVolumeNumbers,
                                   Integer totalVolumes, String totalSource, boolean frenchRunFinished) {

        /** Without the provenance of the total (lot 207). */
        public EditionProgress(String editionName, List<String> sourceEditions, List<Integer> ownedVolumeNumbers,
                               List<Integer> cataloguedVolumeNumbers, Integer totalVolumes) {
            this(editionName, sourceEditions, ownedVolumeNumbers, cataloguedVolumeNumbers, totalVolumes, null, false);
        }

        public int ownedCount() {
            return ownedVolumeNumbers.size();
        }

        /** {@code null} while the total of the edition is unknown: "3 volumes" is then the only truth available. */
        public Integer missingCount() {
            return totalVolumes == null ? null : Math.max(0, totalVolumes - ownedVolumeNumbers.size());
        }
    }

    /** The (work, edition) key under which a new price, a progress or a followed edition are found. */
    /**
     * The identity of an edition: (work, name), ignoring case and spaces.
     *
     * <p>Public because it was COPIED - {@code StatsService} had
     * its own version to value the collection at the new price (Batch 56).
     * Two copies of a key are two chances to diverge, and this is
     * exactly what produced the progress gaps of Batches 31 and 49:
     * the rule lives here, with the computation it serves.
     */
    public static String editionKey(UUID entityId, String editionName) {
        return entityId + "|" + editionName.trim().toLowerCase();
    }
}
