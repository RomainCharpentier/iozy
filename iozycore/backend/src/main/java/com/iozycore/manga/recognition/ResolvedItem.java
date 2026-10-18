package com.iozycore.manga.recognition;

import java.util.List;
import java.util.UUID;

/**
 * A recognised item, matched with the catalog - what the confirmation screen
 * really shows.
 *
 * @param recognized      the raw reading, kept as is: the user must
 *                        be able to see what was read, not only what IozyCore made of it
 * @param catalogStatus   see {@link CatalogStatus}
 * @param entityId        the catalog series, if it was found - {@code null} otherwise.
 *                        No Entity is created here, ever.
 * @param catalogTitle    the title kept for display and for the batch: the one of the
 *                        catalog when the work is in it - "Platinum End", even if the
 *                        photo said "PLATINUM end" - otherwise the title read, stripped of
 *                        its listing decoration. The original text stays in
 *                        {@code recognized.seriesTitleRaw()}.
 * @param editionOptions  the known editions of this series, when one must be confirmed.
 *                        A proposal to choose from, never a choice already made.
 * @param preselected     whether the screen must pre-tick this item - see
 *                        {@link RecognitionConfidence#worthPreselecting()}
 */
public record ResolvedItem(RecognizedItem recognized, CatalogStatus catalogStatus, UUID entityId,
                            String catalogTitle, List<EditionOption> editionOptions, boolean preselected) {

    public ResolvedItem {
        editionOptions = editionOptions == null ? List.of() : List.copyOf(editionOptions);
    }

    /** An edition known to the catalog, proposed for confirmation. */
    public record EditionOption(UUID editionId, String editionName, Integer totalVolumes) {
    }

    /** The title to show: the one of the catalog if it exists, otherwise what was read. */
    public String displayTitle() {
        return catalogTitle != null ? catalogTitle : recognized.seriesTitleRaw();
    }

    /**
     * True when this item can feed the analysis without another question:
     * known series, volume read, edition decided. Everything else asks for an action.
     */
    public boolean readyForAnalysis() {
        return catalogStatus == CatalogStatus.MATCHED && recognized.volumeNumber() != null;
    }
}
