package com.iozycore.manga.shelfimport;

import com.iozycore.manga.recognition.RecognitionStatus;

import java.util.List;

/**
 * What the review screen receives after the photos are read.
 *
 * @param visionStatus       the outcome of reading the photos (see {@link RecognitionStatus});
 *                           never {@code null} here, photos were always sent
 * @param items              the recognised volumes, checked against the catalog AND the collection
 * @param unidentifiedCount  books that are visible but not identified - to add by hand
 * @param analyzedImageCount photos actually read
 * @param requestedImageCount photos sent, including the ones dropped
 * @param lookupsSkipped     unknown series for which no detail page was searched,
 *                           for lack of budget (see {@code ShelfImportService.RECHERCHES_MAX})
 */
public record ShelfAnalysis(RecognitionStatus visionStatus, List<ShelfItem> items, int unidentifiedCount,
                            int analyzedImageCount, int requestedImageCount, int lookupsSkipped) {

    public ShelfAnalysis {
        items = items == null ? List.of() : List.copyOf(items);
    }
}
