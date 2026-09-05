package com.iozycore.manga.deals;

import com.iozycore.manga.domain.MangaEdition;

import java.util.UUID;

/**
 * A work/series as referenced in a listing - deliberately distinct from
 * {@link MangaEdition}: the same series can have several French editions
 * with different volume counts (e.g. Parasyte), so completeness and
 * pricing are always evaluated per edition, never at this series level.
 *
 * @param knownEntityId best-effort link to an existing {@link com.iozycore.domain.catalog.Entity}
 *                       in the user's own catalog (resolved by {@link SeriesMatcher}), nullable -
 *                       used only to power "you already own N volumes" hints and to enable the
 *                       "add to wishlist" action, never to read or write catalog data directly here.
 */
public record MangaSeries(String title, UUID knownEntityId) {
    public MangaSeries {
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("Une série doit avoir un titre");
        }
    }
}
