package com.iozycore.manga.metadata;

import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.metadata.TtlCache;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Derives, from the known related series of a candidate (see
 * {@link RelatedSeriesProvider}), the title fragments to exclude from the
 * volume search (see GoogleBooksVolumeSearchProvider) - a spin-off
 * published under a title structurally identical to a real
 * collection name ("Blue Lock - Episode Nagi - Tome 5") must not appear
 * as an edition of the searched series.
 * <p>
 * Best-effort and limited on purpose (see {@link #distinctiveSuffix}):
 * it only works when the title of the related series shares a text prefix
 * with at least one of the "original" titles tried (see
 * {@code originalTitleCandidates} of {@link #findExcludedTitleFragments}) -
 * MyAnimeList indexes a spin-off sometimes under the original romaji title of the
 * series, sometimes under a variant sharing no text link with
 * ANY of the known titles (checked manually: "Demon Slayer"/"Kimetsu no
 * Yaiba" -> spin-off "Kimetsu Gakuen!", no common prefix with either
 * one) - in this last case, this spin-off stays invisible to this
 * mechanism, whatever the number of candidates tried.
 * <p>
 * Real case that motivates trying SEVERAL candidates instead of just one
 * (reported while testing "Attack on Titan", see history): the title kept
 * on the client side is the English title ("Attack on Titan"), but MyAnimeList
 * indexes its spin-off "Before the Fall" under the romaji title of the series
 * ("Shingeki no Kyojin: Before the Fall") - no link with "Attack on
 * Titan", but an exact prefix with "Shingeki no Kyojin" (see
 * MyAnimeListMetadataProvider.titleRomaji, already known to the candidate on the
 * client side).
 */
@Service
public class RelatedSeriesService {

    private final List<RelatedSeriesProvider> providers;
    // Long TTL (like barcodeCache of MetadataSearchService, frenchTitleCache of FrenchTitleService):
    // the relations of a series rarely change. Stores the RAW titles
    // of the related series (result of the external call), NOT the fragments already
    // derived - these depend on the original titles tried, which
    // can vary from one call to another for the same externalId (e.g. a
    // call that does not know the romaji title yet); never indexed by the
    // French title searched (the same malId series can be searched under
    // several titles/volumes).
    private final TtlCache<String, List<String>> cache = new TtlCache<>(Duration.ofHours(24), 500);

    public RelatedSeriesService(List<RelatedSeriesProvider> providers) {
        this.providers = providers;
    }

    /**
     * @param externalId   malId (or equivalent) of the selected candidate, already
     *                     known on the client side at the time of the volume
     *                     search - empty if absent (candidate without a usable
     *                     id, e.g. ISBN scan).
     * @param originalTitle "original" title of the candidate (see
     *                      MetadataCandidate.title, before any resolution of the
     *                      French title) - used as a reference to isolate the
     *                      distinctive part of a related series title.
     */
    public List<String> findExcludedTitleFragments(EntityType entityType, String externalId, String originalTitle) {
        return findExcludedTitleFragments(entityType, externalId, originalTitle, null);
    }

    /**
     * Variant that tries a second "original" title (see class javadoc) -
     * typically {@code titleRomaji} (see
     * MyAnimeListMetadataProvider), as a fallback when {@code originalTitle}
     * (the English/displayed title) shares no prefix with the related title.
     *
     * @param titleRomaji second candidate, {@code null}/empty if unknown or
     *                    identical to {@code originalTitle} (no loss if
     *                    absent, just fewer spin-offs detected).
     */
    public List<String> findExcludedTitleFragments(EntityType entityType, String externalId, String originalTitle, String titleRomaji) {
        List<String> originalTitleCandidates = Stream.of(originalTitle, titleRomaji)
                .filter(candidate -> candidate != null && !candidate.isBlank())
                .distinct()
                .collect(Collectors.toList());
        if (externalId == null || externalId.isBlank() || originalTitleCandidates.isEmpty()) {
            return List.of();
        }
        String cacheKey = entityType.id() + "|" + externalId;
        List<String> relatedTitles = cache.get(cacheKey).orElseGet(() -> {
            List<String> fetched = providers.stream()
                    .filter(provider -> provider.supports(entityType))
                    .flatMap(provider -> provider.findRelatedSeriesTitles(externalId).stream())
                    .collect(Collectors.toList());
            cache.put(cacheKey, fetched);
            return fetched;
        });
        return relatedTitles.stream()
                .map(relatedTitle -> distinctiveSuffix(relatedTitle, originalTitleCandidates))
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());
    }

    /** Tries each candidate in order, keeps the first suffix found
     * (see class javadoc) - the order does not matter in practice,
     * a related title normally shares a prefix with AT MOST one of the
     * candidates (distinct original titles, e.g. English vs romaji). */
    private static String distinctiveSuffix(String relatedTitle, List<String> originalTitleCandidates) {
        for (String originalTitle : originalTitleCandidates) {
            String suffix = distinctiveSuffix(relatedTitle, originalTitle);
            if (suffix != null) {
                return suffix;
            }
        }
        return null;
    }

    /**
     * "Blue Lock: Episode Nagi" + "Blue Lock" -&gt; "Episode Nagi" - isolates the
     * distinctive part of a related series title compared to the original
     * title. {@code null} if the related title does not even share this prefix
     * (nothing usable, see class javadoc) or if the remaining
     * fragment is too short to be compared without risk of a false positive
     * on a generic word - threshold of 4 characters, LOWERED to 2 in two cases
     * (see {@link #isAllUppercaseAcronym}/{@link #isGluedColonSuffix}) where the
     * risk of a false positive is much lower than an isolated generic word,
     * the final comparison remaining in any case a WHOLE word match
     * (see GoogleBooksVolumeSearchProvider.matchesKnownRelatedSeries):
     * <ul>
     *   <li>a suffix entirely in UPPERCASE (e.g. "SD") - real case that
     *   motivates this relaxation (reported directly by the user while
     *   testing "Dragon Ball", see history): "Dragon Ball SD" (chibi
     *   parody, tagged "alternative_version" on MyAnimeList) gives the
     *   suffix "SD" (2 characters) - without this relaxation, the threshold of
     *   4 silently excluded it, making the addition of
     *   "alternative_version" to MyAnimeListRelatedSeriesProvider
     *   .DISTINCT_SERIES_RELATIONS useless for this precise case even though the relation
     *   was correctly returned by the API;</li>
     *   <li>a suffix glued to a ":" WITHOUT a space (e.g. "re" in "Tokyo
     *   Ghoul:re") - real case that motivates this second relaxation (found
     *   while continuing the tests on "Tokyo Ghoul", see history): "Tokyo
     *   Ghoul:re" (tagged "sequel", a sequel with its own story) gives
     *   the suffix "re", 2 characters AND lowercase - without this
     *   relaxation, it came out as an edition named "Re" with
     *   its 10 volumes. A ":" glued without a space is a title styling
     *   typical of a continuation ("X:re", ".hack//...") - much
     *   more distinctive than a simple generic word like "re" alone (e.g.
     *   "Blue Lock: Episode Nagi", ":" FOLLOWED by a space, stays subject to the
     *   threshold of 4 as before).</li>
     * </ul>
     * Threshold LOWERED to 1 single character when BOTH relaxations
     * apply AT THE SAME TIME (uppercase acronym AND glued to a ":") - real case
     * that motivates this last step (found while continuing the tests on
     * "Gantz", see history): "Gantz:E" (tagged "alternative_setting",
     * a spin-off in an alternative universe) gives the suffix "E", a SINGLE
     * letter - neither relaxation alone (threshold 2) is enough,
     * but their combination is an even more distinctive signal than
     * each one taken alone.
     */
    private static String distinctiveSuffix(String relatedTitle, String originalTitle) {
        String lowerRelated = relatedTitle.toLowerCase();
        String trimmedOriginal = originalTitle.trim();
        if (!lowerRelated.startsWith(trimmedOriginal.toLowerCase())) {
            return null;
        }
        String suffix = relatedTitle.substring(trimmedOriginal.length())
                .replaceAll("^[\\s:\\-–,]+", "")
                .trim();
        boolean isAcronym = isAllUppercaseAcronym(suffix);
        boolean isGluedColon = isGluedColonSuffix(relatedTitle, trimmedOriginal);
        int minLength = isAcronym && isGluedColon ? 1 : (isAcronym || isGluedColon ? 2 : 4);
        return suffix.length() >= minLength ? suffix : null;
    }

    /** True if {@code suffix} contains no lowercase letter (e.g. "SD",
     * "GT") AND at least one letter (a purely numeric/punctuation suffix
     * is not an acronym) - see {@link #distinctiveSuffix}. */
    private static boolean isAllUppercaseAcronym(String suffix) {
        boolean hasLetter = false;
        for (int i = 0; i < suffix.length(); i++) {
            char c = suffix.charAt(i);
            if (Character.isLetter(c)) {
                hasLetter = true;
                if (Character.isLowerCase(c)) {
                    return false;
                }
            }
        }
        return hasLetter;
    }

    /** True if the character just after the original title is a ":" ITSELF
     * followed by a non-space character (e.g. "Tokyo Ghoul:re") - see
     * {@link #distinctiveSuffix}. A ":" followed by a space ("Blue Lock:
     * Episode Nagi") deliberately does not count: this styling
     * usually announces a classic descriptive subtitle, not a styled
     * continuation. */
    private static boolean isGluedColonSuffix(String relatedTitle, String trimmedOriginal) {
        int afterOriginal = trimmedOriginal.length();
        return relatedTitle.length() > afterOriginal + 1
                && relatedTitle.charAt(afterOriginal) == ':'
                && !Character.isWhitespace(relatedTitle.charAt(afterOriginal + 1));
    }
}
