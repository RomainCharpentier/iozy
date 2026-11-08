package com.iozycore.manga.domain;

/**
 * Where the volume count of an edition comes from.
 *
 * <p>{@link #MANUAL}: typed by a person (the edition form, an import, a
 * purchase analysis). The background job never touches it. {@link #PROVIDER}:
 * filled by {@code EditionTotalBackfill} from the French volume lists, and
 * revisited while the French run goes on.
 */
public enum TotalSource {
    MANUAL,
    PROVIDER
}
