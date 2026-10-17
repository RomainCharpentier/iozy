package com.iozycore.manga.domain.deals;

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.stream.IntStream;
import java.util.stream.Collectors;

/**
 * An inclusive volume range (e.g. tomes 1 to 11) - a listing item with
 * non-contiguous ranges (e.g. "20th Century Boys T1-11 + 21st Century
 * Boys") is represented as several {@link ListingItem}s, one per series,
 * each possibly holding several ranges expanded into a single set.
 */
public record VolumeRange(int from, int to) {
    public VolumeRange {
        if (from < 1 || to < from) {
            throw new IllegalArgumentException("Intervalle de tomes invalide : " + from + "-" + to);
        }
    }

    public static VolumeRange single(int volumeNumber) {
        return new VolumeRange(volumeNumber, volumeNumber);
    }

    public Set<Integer> expand() {
        return IntStream.rangeClosed(from, to).boxed().collect(Collectors.toCollection(LinkedHashSet::new));
    }
}
