package com.iozycore.manga.metadata;

import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.shared.TexteRecherche;
import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.core.metadata.MetadataProvider;
import com.iozycore.core.metadata.TtlCache;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * The title of the FRENCH edition of a manga - a step that only makes sense
 * for this universe (extracted from MetadataSearchService in Batch 132).
 * <p>
 * Manga providers return an original or romaji title; the title under which
 * the series is sold in France is the one to show and to
 * search next (volumes, editions). Open Library then Google Books know
 * it; the safeguards below prevent a title found by the
 * author name alone from being in fact the title of ANOTHER work - which providers
 * that catalog original titles (see
 * {@link MetadataProvider#catalogsOriginalTitles}) allow us to check.
 * <p>
 * frenchTitleCache stores ONLY the results found (never an
 * absence): a temporary network failure must not condemn the same title
 * to fail for 24 h.
 */
@Service
public class FrenchTitleService {

    private static final Logger log = LoggerFactory.getLogger(FrenchTitleService.class);

    private final List<MetadataProvider> providers;
    private final List<FrenchTitleProvider> frenchTitleProviders;
    private final TtlCache<String, String> frenchTitleCache = new TtlCache<>(Duration.ofHours(24), 500);

    public FrenchTitleService(List<MetadataProvider> providers, List<FrenchTitleProvider> frenchTitleProviders) {
        this.providers = providers;
        this.frenchTitleProviders = frenchTitleProviders;
    }

    /** The comparison key of titles - accents and punctuation folded, like the local search (see TexteRecherche). */
    private static String normalize(String value) {
        return TexteRecherche.normaliser(value);
    }

    /**
     * Best-effort search of a French edition title (see
     * OpenLibraryFrenchTitleProvider, tried first, then
     * GoogleBooksFrenchTitleProvider as a fallback) - triggered only when
     * the user chooses a suggestion (never for a whole list of
     * search results), to limit external calls. Empty if the
     * type is not covered or if no provider found anything.
     *
     * @param author mangaka, if known (see MetadataCandidate.attributes) -
     *               clearly improves the precision (see OpenLibraryFrenchTitleProvider).
     */
    public Optional<String> findFrenchTitle(EntityType entityType, String query, String author) {
        return findFrenchTitle(entityType, query, author, List.of());
    }

    /** Variant with exclusion of known sequels/spin-offs (see RelatedSeriesService) -
     * e.g. "Dragon Ball Super nº 18" wrongly resolved as the French title of
     * "Dragon Ball" (its sequel being much better referenced on Open
     * Library, checked manually, see the history of the conversation). */
    public Optional<String> findFrenchTitle(EntityType entityType, String query, String author, List<String> excludedTitleFragments) {
        return findFrenchTitle(entityType, query, author, excludedTitleFragments, null);
    }

    /**
     * @param externalId id of the searched series at the source that
     *                   proposed it (malId, see MetadataCandidate) - used
     *                   only to recognize the series itself among the
     *                   cataloged works when a title found by the author
     *                   name alone is checked (see
     *                   {@link #namesAnotherKnownWork}). Best-effort, has no
     *                   effect if absent: the comparison then falls back on
     *                   the titles.
     */
    public Optional<String> findFrenchTitle(EntityType entityType, String query, String author,
                                             List<String> excludedTitleFragments, String externalId) {
        String cacheKey = entityType.id() + "|" + normalize(query) + "|" + normalize(author == null ? "" : author);
        Optional<String> cached = frenchTitleCache.get(cacheKey);
        if (cached.isPresent()) {
            return cached;
        }

        Optional<String> result = resolveFrenchTitle(entityType, query, author, excludedTitleFragments, externalId);
        result.ifPresent(title -> frenchTitleCache.put(cacheKey, title));
        return result;
    }

    /**
     * Chooses between providers by the PROOF VALUE of the result, not by
     * their order (see {@link FrenchTitleMatch.Confidence}): a
     * match on the searched series is kept at once, while
     * an "author only" find is set aside to let the following
     * providers offer better - otherwise the first
     * provider (Open Library) imposes its guess while the next one
     * (Google Books) sometimes knows the real answer. Cost: one more
     * external call in this case only, which stays rare (a provider
     * only goes down to its last resort when nothing of the searched title
     * matched).
     */
    private Optional<String> resolveFrenchTitle(EntityType entityType, String query, String author,
                                                 List<String> excludedTitleFragments, String externalId) {
        String authorOnlyTitle = null;
        for (FrenchTitleProvider provider : frenchTitleProviders) {
            if (!provider.supports(entityType)) {
                continue;
            }
            Optional<FrenchTitleMatch> match = provider.findFrenchTitle(query, author, excludedTitleFragments);
            if (match.isEmpty()) {
                continue;
            }
            FrenchTitleMatch found = match.get();
            if (found.confidence() == FrenchTitleMatch.Confidence.SERIES_MATCHED) {
                return Optional.of(found.title());
            }
            if (authorOnlyTitle == null) {
                authorOnlyTitle = found.title();
            }
        }
        if (authorOnlyTitle == null || namesAnotherKnownWork(entityType, authorOnlyTitle, query, externalId)) {
            return Optional.empty();
        }
        return Optional.of(authorOnlyTitle);
    }

    /**
     * True if {@code candidateTitle} is ITSELF the cataloged title of
     * ANOTHER work than the searched one - a translated French edition is
     * by nature not referenced anywhere under this title in the Japanese
     * catalog (MyAnimeList/Jikan), while another work by the same author is
     * obviously referenced there under its own. This is what separates the two
     * possible "author only" results, checked live on these two
     * real cases (see the history of the conversation):
     * <ul>
     *   <li>"Vagabond" (Takehiko Inoue) gave "Slam Dunk" - cataloged as
     *   is under another malId: it is his other manga, not a translation.
     *   The real French title of Vagabond being "Vagabond", returning nothing
     *   lets the client keep the title already shown, which is
     *   here exactly the right answer;</li>
     *   <li>"Zom 100" (Haro Aso) gives "Bucket List of the Dead", its real
     *   French title - the catalog only knows "Zom 100: Bucket List of
     *   the Dead", a DIFFERENT title (the comparison is an exact equality,
     *   never a contains(), otherwise this case would be wrongly rejected).</li>
     * </ul>
     * Check impossible (catalog down/quota) = result rejected:
     * an unconfirmed guess is worth less than an honest 404, the client
     * then keeping the original title already shown rather than having
     * the title of another series imposed on it (covers and volumes would follow).
     * <p>
     * Queries ONLY the providers that catalog under the original
     * title (see {@link MetadataProvider#catalogsOriginalTitles()}):
     * including the one that searches by French title would make it reject
     * all the real French titles, since it finds them
     * precisely - the whole logic of this check would
     * be reversed.
     */
    private boolean namesAnotherKnownWork(EntityType entityType, String candidateTitle, String query, String externalId) {
        List<MetadataCandidate> catalogued;
        try {
            catalogued = providers.stream()
                    .filter(provider -> provider.supports(entityType) && provider.catalogsOriginalTitles())
                    .flatMap(provider -> provider.search(candidateTitle).stream())
                    .collect(Collectors.toList());
        } catch (RuntimeException e) {
            log.warn("French title '{}' (found by the author name alone) rejected: catalog not reachable to check it - {}",
                    candidateTitle, e.getMessage());
            return true;
        }
        for (MetadataCandidate candidate : catalogued) {
            if (!hasTitle(candidate, candidateTitle) || isQueriedSeries(candidate, query, externalId)) {
                continue;
            }
            log.info("French title '{}' (found by the author name alone) rejected: it is the cataloged title of '{}' ({}), another work",
                    candidateTitle, candidate.title(), candidate.externalId());
            return true;
        }
        return false;
    }

    private static boolean isQueriedSeries(MetadataCandidate candidate, String query, String externalId) {
        if (externalId != null && !externalId.isBlank() && externalId.equals(candidate.externalId())) {
            return true;
        }
        // Fallback when the id is unknown, or comes from another source
        // than the one that answered here (two ids can only be compared
        // within the same source): the searched original title is enough to
        // recognize the series - "Vagabond" cataloged under "Vagabond" IS
        // indeed the searched series, not another work.
        return hasTitle(candidate, query);
    }

    /** Exact equality (case-insensitive) with one of the known titles of the
     * candidate - main title AND alternative titles (see
     * MyAnimeListMetadataProvider: titleRomaji/titleEnglish/titleJapanese),
     * the same manga being cataloged under several forms. */
    private static boolean hasTitle(MetadataCandidate candidate, String title) {
        if (title == null || title.isBlank()) {
            return false;
        }
        String normalized = normalize(title);
        if (normalize(candidate.title()).equals(normalized)) {
            return true;
        }
        for (String key : List.of("titleRomaji", "titleEnglish", "titleJapanese")) {
            Object value = candidate.attributes().get(key);
            if (value instanceof String alternative && !alternative.isBlank() && normalize(alternative).equals(normalized)) {
                return true;
            }
        }
        return false;
    }
}
