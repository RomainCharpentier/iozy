package com.iozycore.manga.metadata;

import com.iozycore.core.domain.catalog.EntityType;

import java.util.List;
import java.util.Optional;

/**
 * Best-effort search of a French edition title for a title already
 * chosen (mangas) - neither Jikan nor MyAnimeList know it (see
 * JikanMetadataProvider/MyAnimeListMetadataProvider). Several providers
 * can implement this interface (see FrenchTitleService.findFrenchTitle,
 * which tries them in order) - same idea as BarcodeMetadataProvider
 * for the ISBN scan.
 * <p>
 * Each provider also says HOW it found its result (see
 * {@link FrenchTitleMatch.Confidence}): the caller no longer always stops
 * at the first provider that answers, an "author only" find must never win
 * over a real series match
 * returned by the next provider.
 */
public interface FrenchTitleProvider {

    boolean supports(EntityType entityType);

    /**
     * @param query  title to search (romaji/English - never French by definition).
     * @param author mangaka, if known - clearly improves the precision of the
     *               search (see OpenLibraryFrenchTitleProvider), can be null/empty.
     * @param excludedTitleFragments title fragments (see RelatedSeriesService)
     *               identifying a known spin-off/side-story/sequel of the
     *               searched title - to remove from the candidate results (e.g. "Dragon
     *               Ball Super nº 18" wrongly resolved as the French title of
     *               "Dragon Ball", its sequel being much better referenced
     *               on Open Library - checked manually, see the history
     *               of the conversation).
     */
    Optional<FrenchTitleMatch> findFrenchTitle(String query, String author, List<String> excludedTitleFragments);
}
