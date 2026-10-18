package com.iozycore.core.domain.insights;

import java.util.List;

/**
 * What a {@code DiscoverySource} has to say for one type: its suggestions, and
 * whether its external source really answered.
 *
 * <p>Why it is not a bare list: every provider answers an empty list when it is
 * down, exactly like "nothing to offer". The Discover panel could not tell the
 * two apart and had to name both causes at once (batch 158). Now the universe
 * says which one it is.
 *
 * @param candidates     the suggestions, possibly empty
 * @param sourceAnswered false when at least one call to the external source got
 *                       no answer (outage, timeout, error status): the list may
 *                       be incomplete, and trying again may help
 * @param emptyReason    why nothing was asked of the source, when known; null
 *                       when the source was asked
 */
public record Discovery(List<DiscoveryCandidate> candidates, boolean sourceAnswered, EmptyReason emptyReason) {

    public Discovery {
        candidates = List.copyOf(candidates);
    }

    /** Why a universe had nothing to ask its source. */
    public enum EmptyReason {
        /** No work of this type in the catalog. */
        NOTHING_OWNED,
        /** Manga: no work carries a rating, so there is no favourite author. */
        NO_RATED_WORK,
        /** Manga: the rated works have no known author. */
        NO_KNOWN_AUTHOR,
        /** Games: no work was added from the source (no IGDB or BGG id). */
        NOT_LINKED_TO_SOURCE
    }

    /** The source was asked. {@code allCallsAnswered} is false when one call got no answer. */
    public static Discovery asked(List<DiscoveryCandidate> candidates, boolean allCallsAnswered) {
        return new Discovery(candidates, allCallsAnswered, null);
    }

    /** Nothing to ask the source: no call was made, so nothing was left unanswered. */
    public static Discovery nothingToAsk(EmptyReason reason) {
        return new Discovery(List.of(), true, reason);
    }
}
