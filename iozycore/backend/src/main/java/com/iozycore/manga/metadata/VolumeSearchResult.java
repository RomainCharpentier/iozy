package com.iozycore.manga.metadata;

import java.util.List;

/**
 * Result of {@link TomeSearchService#searchVolumes} - an empty {@code volumes}
 * does not always mean "no French edition":
 * {@code providerUnavailable} tells this case apart from a TEMPORARY failure of the
 * external provider, be it an exceeded quota (see
 * {@link QuotaExceededException}) or a silent source (see
 * {@link SourceUnavailableException}). The client can then show an
 * adapted message ("réessaie plus tard") instead of wrongly letting believe
 * that the series has no edition.
 * <p>
 * A single flag for the two causes: they call for exactly the same
 * behavior, on the cache side (store nothing) as on the screen side (try again) -
 * telling them apart would only add a word in a message.
 */
public record VolumeSearchResult(List<VolumeCandidate> volumes, boolean providerUnavailable) {
    public static VolumeSearchResult of(List<VolumeCandidate> volumes) {
        return new VolumeSearchResult(volumes, false);
    }
}
