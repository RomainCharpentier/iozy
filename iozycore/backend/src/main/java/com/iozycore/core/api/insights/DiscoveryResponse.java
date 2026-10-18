package com.iozycore.core.api.insights;

import com.iozycore.core.domain.insights.Discovery;
import com.iozycore.core.domain.insights.DiscoveryCandidate;

import java.util.List;

/**
 * The discoveries of a type as the client reads them.
 *
 * @param candidates     the suggestions, possibly empty
 * @param sourceAnswered false when the external source did not answer: an empty
 *                       list then means "try again", not "nothing to offer"
 * @param emptyReason    why nothing was asked of the source (see
 *                       {@link Discovery.EmptyReason}), null when it was asked
 */
public record DiscoveryResponse(List<DiscoveryCandidate> candidates, boolean sourceAnswered, String emptyReason) {

    public static DiscoveryResponse from(Discovery discovery) {
        return new DiscoveryResponse(discovery.candidates(), discovery.sourceAnswered(),
                discovery.emptyReason() == null ? null : discovery.emptyReason().name());
    }
}
