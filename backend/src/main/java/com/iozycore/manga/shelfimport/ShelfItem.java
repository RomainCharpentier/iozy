package com.iozycore.manga.shelfimport;

import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.manga.recognition.ResolvedItem;

/**
 * A volume read on the shelf, with what the collection knows about it.
 *
 * @param resolved        the reading, checked against the catalog - unchanged from
 *                        the listing analysis, the screen must be able to show the same thing
 * @param alreadyOwned    a copy of this number is still owned, whatever
 *                        the edition: the screen shows it ticked and inert, the import ignores it
 * @param proposal        the detail page that the sources propose for a series missing from the
 *                        catalog - {@code null} if the series is known, if nothing
 *                        matches, or if the search was not done
 * @param proposalByTitle true when the title of the detail page matches what was read -
 *                        the screen keeps it by default; false when it is only the first
 *                        result of the search - shown as a lead, kept
 *                        only if the user says so
 */
public record ShelfItem(ResolvedItem resolved, boolean alreadyOwned, MetadataCandidate proposal,
                        boolean proposalByTitle) {
}
