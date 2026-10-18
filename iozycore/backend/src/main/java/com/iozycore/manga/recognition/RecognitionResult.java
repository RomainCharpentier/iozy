package com.iozycore.manga.recognition;

import java.util.List;

/**
 * What a recognition engine returns for a set of photos.
 *
 * <h2>A failure is not an exception</h2>
 * An unavailable engine, an unreadable image or a partial result are
 * <b>normal outcomes</b> of the flow, as for {@code ListingResolution}:
 * they are told apart by {@link #status()}, and the manual flow takes
 * over behind them. Nothing here must ever prevent analysing a listing by
 * hand.
 *
 * @param items            what was recognised - empty is a valid result
 * @param unidentifiedCount number of items that are visible but not identified; the screen must
 *                          show them, otherwise the user believes the batch is smaller
 *                          than it is
 */
public record RecognitionResult(RecognitionStatus status, List<RecognizedItem> items, int unidentifiedCount) {

    public RecognitionResult {
        status = status == null ? RecognitionStatus.UNAVAILABLE : status;
        items = items == null ? List.of() : List.copyOf(items);
        unidentifiedCount = Math.max(0, unidentifiedCount);
    }

    public static RecognitionResult recognized(List<RecognizedItem> items, int unidentifiedCount) {
        // Nothing recognised but items seen: it is a partial result, not
        // a success - the screen must say it differently.
        RecognitionStatus status = items == null || items.isEmpty()
                ? (unidentifiedCount > 0 ? RecognitionStatus.PARTIAL : RecognitionStatus.NOTHING_RECOGNIZED)
                : (unidentifiedCount > 0 ? RecognitionStatus.PARTIAL : RecognitionStatus.OK);
        return new RecognitionResult(status, items, unidentifiedCount);
    }

    /** The engine could not answer - failure, timeout. */
    public static RecognitionResult unavailable() {
        return new RecognitionResult(RecognitionStatus.UNAVAILABLE, List.of(), 0);
    }

    /** The quota of the service is reached: trying again now would be useless, the screen must say so. */
    public static RecognitionResult quotaExceeded() {
        return new RecognitionResult(RecognitionStatus.QUOTA_EXCEEDED, List.of(), 0);
    }

    /** No engine is configured: IozyCore works without it, the screen says so. */
    public static RecognitionResult noEngine() {
        return new RecognitionResult(RecognitionStatus.NO_ENGINE, List.of(), 0);
    }

    /** No usable photo could be fetched. */
    public static RecognitionResult noUsableImage() {
        return new RecognitionResult(RecognitionStatus.NO_USABLE_IMAGE, List.of(), 0);
    }

    public boolean hasItems() {
        return !items.isEmpty();
    }
}
