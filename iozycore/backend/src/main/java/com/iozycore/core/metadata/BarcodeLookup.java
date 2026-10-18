package com.iozycore.core.metadata;

import java.util.Optional;

/**
 * What a barcode search gave - <b>including when it gave
 * nothing</b>.
 *
 * <h2>Two empties that do not look alike</h2>
 * The providers returned {@code Optional.empty()} in two situations that
 * nothing told apart afterwards:
 * <ul>
 *   <li><b>ABSENT</b> - the database answered, and it does not know this code.
 *       It is an <i>answer</i>, and it has value: asking it again within the
 *       minute will give the same thing;</li>
 *   <li><b>UNAVAILABLE</b> - the database could not answer: network down,
 *       timeout, quota exhausted, unreadable body. It is not an answer,
 *       it is an absence of answer, and retrying is legitimate.</li>
 * </ul>
 *
 * <h2>Why the distinction ended up mattering</h2>
 * As long as barcodes arrived one by one, from a camera, mixing
 * them up cost nothing: the user scans again. Since the photos
 * of a batch deliver a dozen at once - and an identification takes
 * from 1.4 to 5.5 seconds - remembering the absences has become valuable.
 *
 * <p>But remembering an <i>outage</i> would be a serious defect: the user's retry
 * would return the cached failure instead of trying again, and a one-second
 * incident would freeze for half an hour. This is precisely what the
 * test {@code does_not_cache_a_failed_barcode_lookup_so_a_later_retry_can_still_succeed}
 * has protected for a long time, and it was right.
 *
 * @param candidate the work found, or {@code null}
 * @param conclusive true when the database <b>answered</b> - whether it found or not
 */
public record BarcodeLookup(MetadataCandidate candidate, boolean conclusive) {

    /** The database knows this code. */
    public static BarcodeLookup found(MetadataCandidate candidate) {
        return new BarcodeLookup(candidate, true);
    }

    /** The database answered, and does not know this code. */
    public static BarcodeLookup absent() {
        return new BarcodeLookup(null, true);
    }

    /** The database could not answer - retrying remains legitimate. */
    public static BarcodeLookup unavailable() {
        return new BarcodeLookup(null, false);
    }

    public Optional<MetadataCandidate> candidateIfAny() {
        return Optional.ofNullable(candidate);
    }

    /** Searched, and not found: the only situation worth remembering. */
    public boolean knownAbsent() {
        return conclusive && candidate == null;
    }
}
