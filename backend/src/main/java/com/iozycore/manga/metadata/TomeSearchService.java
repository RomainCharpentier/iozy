package com.iozycore.manga.metadata;

import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.shared.TexteRecherche;
import com.iozycore.core.metadata.QuotaExceededException;
import com.iozycore.core.metadata.SourceUnavailableException;
import com.iozycore.core.metadata.TtlCache;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * The VOLUMES of a manga and their French editions - the heart of the manga
 * module (extracted from MetadataSearchService in Batch 132).
 * <p>
 * Queries in parallel the competent {@link VolumeSearchProvider}s (BnF
 * first, Google Books, Open Library - see their {@code @Order}), fills the
 * gaps volume by volume, then "finalizes" the list: renamed publishers
 * unified, "Édition inconnue" attached by ISBN prefix or pruned,
 * spellings made uniform, homonym editions separated by ISBN, duplicates
 * merged while keeping the cover. Each rule carries the measurement that made it
 * appear (Doubt, Boruto, One Piece, Jujutsu Kaisen... see
 * DESIGN_MIGRATION_V1.2.md, batches 119 to 131).
 * <p>
 * volumeSearchCache/volumeSearchCacheRepository follow the logic of the cache
 * of the search by title, NOT the one of the barcodes: an empty list
 * "no French edition" (series not taken up in France, license
 * dropped...) is cached like a real result found - without this,
 * a series without a French edition ran the requests again on EVERY
 * search, forever. Only an empty result caused by a silent
 * provider or an exceeded quota stays out of the durable cache (temporary failure,
 * not a real absence of result) - "Actualiser" stays the only way to
 * check again a series already in cache, empty or not.
 * <p>
 * A durable row is served only while it is fresh: written by the current
 * chain ({@link #CHAIN_VERSION}) and less than {@link #DURABLE_EXPIRY} ago.
 * Otherwise the providers are read again; if they are silent, the old row is
 * NOT served (a number nobody believes anymore) and the result says
 * {@code providerUnavailable}. This replaces the migrations that emptied the
 * table at each change of chain (V33, V34).
 */
@Service
public class TomeSearchService {

    private static final Logger log = LoggerFactory.getLogger(TomeSearchService.class);

    /**
     * The version of the chain that writes the durable rows: providers, their
     * parsing, {@link #finaliser}. Bump it when a change makes the rows already
     * stored wrong (an edition missed, a volume misfiled): every row of an older
     * version is then read again when its series is opened, without a migration.
     * 1 = the chain in place when V37 was written (rows older than V37 have 0).
     */
    static final int CHAIN_VERSION = 1;

    /**
     * The age after which a durable row is read again. 30 days: the nightly
     * refresh already re-reads the ongoing series after 7 days (MangaReleaseRefresh),
     * so this one catches the rest - finished series, series the nightly pass
     * did not reach - at a cost of about one search per series per month.
     */
    static final Duration DURABLE_EXPIRY = Duration.ofDays(30);

    private final List<VolumeSearchProvider> volumeSearchProviders;
    private final VolumeSearchCacheRepository volumeSearchCacheRepository;

    // "Hot" memory cache (avoids a database round trip for searches
    // close together in the same window) - the durable storage is
    // volumeSearchCacheRepository (survives restarts, see below).
    private final TtlCache<String, List<VolumeCandidate>> volumeSearchCache = new TtlCache<>(Duration.ofHours(24), 300);
    /** The results obtained while a provider was silent - see searchVolumes. */
    private final TtlCache<String, List<VolumeCandidate>> volumeSearchPartialCache = new TtlCache<>(Duration.ofHours(1), 300);

    public TomeSearchService(List<VolumeSearchProvider> volumeSearchProviders,
                             VolumeSearchCacheRepository volumeSearchCacheRepository) {
        this.volumeSearchProviders = volumeSearchProviders;
        this.volumeSearchCacheRepository = volumeSearchCacheRepository;
    }

    /** The comparison key of titles - accents and punctuation folded, like the local search (see TexteRecherche). */
    private static String normalize(String value) {
        return TexteRecherche.normaliser(value);
    }

    /** The stored volumes of this key, only if the row can still be served (see {@link #isFresh}). */
    private Optional<List<VolumeCandidate>> findFresh(EntityType entityType, String normalizedTitle, String normalizedAuthor) {
        return volumeSearchCacheRepository.find(entityType.id(), normalizedTitle, normalizedAuthor)
                .filter(TomeSearchService::isFresh)
                .map(StoredVolumeSearch::volumes);
    }

    static boolean isFresh(StoredVolumeSearch stored) {
        return stored.chainVersion() == CHAIN_VERSION
                && stored.fetchedAt().isAfter(Instant.now().minus(DURABLE_EXPIRY));
    }

    /**
     * Best-effort search of the real volumes (with cover) of the French
     * editions of a series (see GoogleBooksVolumeSearchProvider, 8
     * requests in parallel per call - expensive) - triggered after
     * selecting a suggestion, to offer a visual selection of owned
     * volumes instead of a manual entry of the volume number.
     * {@code volumes} empty if the type is not covered or if nothing was
     * found (the caller then keeps the manual entry path) -
     * {@code quotaExceeded} (see VolumeSearchResult) tells this case apart from an
     * exceeded external quota, so that the client can report it instead
     * of wrongly letting believe "no edition found".
     */
    public VolumeSearchResult searchVolumes(EntityType entityType, String seriesTitle, String author) {
        return searchVolumes(entityType, seriesTitle, author, false, List.of());
    }

    /**
     * @param forceRefresh ignores the memory cache AND the durable storage,
     *                      always runs the Google
     *                      Books requests again and overwrites the stored result - this is the
     *                      entry point of the "Actualiser" button on the
     *                      client side. Without it, a stored result is
     *                      served until it expires (see {@link #isFresh}):
     *                      the editions/volumes of a series rarely change, no
     *                      need to pay again for external calls at each
     *                      selection of the same candidate.
     */
    public VolumeSearchResult searchVolumes(EntityType entityType, String seriesTitle, String author, boolean forceRefresh) {
        return searchVolumes(entityType, seriesTitle, author, forceRefresh, List.of());
    }

    /**
     * @param excludedTitleFragments title fragments (see RelatedSeriesService)
     *                               identifying a known spin-off/side-story of
     *                               the searched series - never taken into account
     *                               for the cache key (it only depends on the
     *                               title/author searched, like the rest of this
     *                               cache): a result already in cache WITHOUT this
     *                               filter is not cleaned retroactively,
     *                               "Actualiser"/a deep search
     *                               stay the only ways to run it again.
     */
    public VolumeSearchResult searchVolumes(EntityType entityType, String seriesTitle, String author, boolean forceRefresh, List<String> excludedTitleFragments) {
        return searchVolumes(entityType, seriesTitle, author, forceRefresh, excludedTitleFragments, null);
    }

    /** At most this many probes per search: a probe costs one Google Books request per missing volume. */
    static final int SONDES_MAX = 12;

    /** Three numbers in a row without an answer: the known total is probably wrong (or the French edition stops there). */
    static final int ECHECS_CONSECUTIFS_MAX = 3;

    /**
     * @param totalVolumes the number of volumes of the series according to the catalog
     *                     (AniList/MyAnimeList), or null - the gaps are probed
     *                     up to this number (see comblerLesTrous)
     */
    public VolumeSearchResult searchVolumes(EntityType entityType, String seriesTitle, String author, boolean forceRefresh,
                                            List<String> excludedTitleFragments, Integer totalVolumes) {
        String normalizedTitle = normalize(seriesTitle);
        String normalizedAuthor = normalize(author == null ? "" : author);
        String cacheKey = entityType.id() + "|" + normalizedTitle + "|" + normalizedAuthor;

        if (!forceRefresh) {
            // What comes out of a cache goes through the naming rules again (see
            // finaliser): they evolve (Batches 123-125), and a row written
            // before them otherwise came out as it was - "Ki-oon" and
            // "Ki-Oon" as two editions on a row of 3 pm, while the
            // same title refreshed at 4 pm showed only one. This is the
            // back and forth that the user saw on "Doubt" (Batch 126).
            Optional<List<VolumeCandidate>> inMemory = volumeSearchCache.get(cacheKey);
            if (inMemory.isPresent()) {
                return VolumeSearchResult.of(finaliser(inMemory.get()));
            }

            // An expired row is skipped: the providers are read again below,
            // and if they are silent the result says so instead of serving it.
            Optional<List<VolumeCandidate>> stored = findFresh(entityType, normalizedTitle, normalizedAuthor);
            if (stored.isPresent()) {
                volumeSearchCache.put(cacheKey, stored.get()); // warms the memory cache for the next calls
                return VolumeSearchResult.of(finaliser(stored.get()));
            }

            // A PARTIAL result (a silent provider) is never persisted,
            // but it is kept one hour in memory: without this, each
            // opening of the preview during a Google Books outage
            // ran the BnF and its cover checks again, until
            // it limited the rate in turn (429 seen on 2026-09-04).
            Optional<List<VolumeCandidate>> partiel = volumeSearchPartialCache.get(cacheKey);
            if (partiel.isPresent()) {
                return new VolumeSearchResult(partiel.get(), true);
            }
        }

        QueryOutcome outcome = queryProviders(entityType, seriesTitle, author, excludedTitleFragments, totalVolumes);
        List<VolumeCandidate> result = finaliser(outcome.volumes());
        boolean providerUnavailable = outcome.providerUnavailable();
        // An empty list IS cached (unlike barcodeCache/
        // frenchTitleCache, see the comment on volumeSearchCache
        // above) - only an empty result caused by a temporary failure of the
        // provider never is, so as not to condemn a search
        // for days because of an outage of a few minutes.
        //
        // Without an author, never a durable cache (Batch 126): "Doubt" alone
        // also designates a homonym at another publisher, and a row
        // written on this bare title served the homonym again at each opening
        // whose metadata search had failed. In memory, one
        // day at most.
        boolean cacheDurable = !normalizedAuthor.isBlank();
        if (!providerUnavailable) {
            volumeSearchCache.put(cacheKey, result);
            if (cacheDurable) {
                volumeSearchCacheRepository.save(entityType.id(), normalizedTitle, normalizedAuthor, result, CHAIN_VERSION);
            }
        } else if (!result.isEmpty()) {
            volumeSearchPartialCache.put(cacheKey, result);
            if (forceRefresh) {
                // "Actualiser" has spoken: an older row must not
                // outlive it. During an outage, the partial result cannot
                // be frozen as complete, but the old one cannot
                // be served again at the next opening either - this is
                // exactly what made "3 and 1" come back after "4 and 2"
                // at each restart (Batch 126).
                volumeSearchCache.invalidate(cacheKey);
                if (cacheDurable) {
                    volumeSearchCacheRepository.delete(entityType.id(), normalizedTitle, normalizedAuthor);
                }
            }
        }
        return new VolumeSearchResult(result, providerUnavailable);
    }

    /** What the providers answered, and whether one of them was silent. */
    private record QueryOutcome(List<VolumeCandidate> volumes, boolean providerUnavailable) {
    }

    /** Queries all the competent providers, completes the secondary editions and fills the gaps - without touching the caches. */
    private QueryOutcome queryProviders(EntityType entityType, String seriesTitle, String author,
                                        List<String> excludedTitleFragments, Integer totalVolumes) {
        // Explicit loop (rather than a stream): a failing provider must
        // not make us lose the results already obtained from the OTHER
        // providers competent for this type (unlike a
        // flatMap+collect, which would give up everything at the first exception).
        List<VolumeCandidate> result = new ArrayList<>();
        boolean providerUnavailable = false;
        for (VolumeSearchProvider provider : volumeSearchProviders) {
            if (!provider.supports(entityType)) {
                continue;
            }
            try {
                result.addAll(provider.searchVolumes(seriesTitle, author, excludedTitleFragments));
            } catch (QuotaExceededException | SourceUnavailableException e) {
                // Quota exceeded OR silent source: in both cases the
                // provider SAID nothing, it is not an absence of volumes.
                providerUnavailable = true;
            }
        }
        // The SECONDARY editions, completed at the provider that can search an
        // edition by its name (batch 144) - before the probes, which only fill
        // the numbers missing from ALL the editions.
        try {
            result.addAll(completerLesEditionsSecondaires(entityType, seriesTitle, author, excludedTitleFragments, result));
        } catch (QuotaExceededException | SourceUnavailableException e) {
            providerUnavailable = true;
        }
        // Two providers (BnF then Google Books, see their @Order)
        // can find the same volume: the record of the FIRST one is authoritative
        // (Batch 119 - the BnF has structured fields, Google Books guesses
        // the edition in a free title), and the cover comes from the one that
        // has one.
        if (totalVolumes != null && totalVolumes > 0) {
            try {
                result.addAll(comblerLesTrous(entityType, seriesTitle, author, excludedTitleFragments, result, totalVolumes));
            } catch (QuotaExceededException | SourceUnavailableException e) {
                // A probe that fails loses nothing of what is already there;
                // it only forbids freezing this result as complete.
                providerUnavailable = true;
            }
        }
        return new QueryOutcome(result, providerUnavailable);
    }

    /**
     * Reads the providers again for this series and replaces the stored result -
     * EXCEPT if one of them was silent: the result already stored then stays
     * in place, untouched. This is the nightly refresh of the release
     * calendar (batch 146, see MangaReleaseRefresh), and it differs from the
     * "Actualiser" button on one point: {@link #searchVolumes} with
     * {@code forceRefresh} ERASES the stored row when a provider
     * is missing, so that the user who just pressed sees what is left
     * rather than an old result. At night, nobody presses anything, and
     * a Google Books outage must not empty one by one the series
     * read again until it passes.
     *
     * @return true when the re-read succeeded and replaced the stored result
     */
    public boolean refreshUnlessUnavailable(EntityType entityType, String seriesTitle, String author,
                                            List<String> excludedTitleFragments, Integer totalVolumes) {
        String normalizedTitle = normalize(seriesTitle);
        String normalizedAuthor = normalize(author == null ? "" : author);
        QueryOutcome outcome = queryProviders(entityType, seriesTitle, author, excludedTitleFragments, totalVolumes);
        if (outcome.providerUnavailable()) {
            return false;
        }
        List<VolumeCandidate> result = finaliser(outcome.volumes());
        String cacheKey = entityType.id() + "|" + normalizedTitle + "|" + normalizedAuthor;
        volumeSearchCache.put(cacheKey, result);
        if (!normalizedAuthor.isBlank()) {
            volumeSearchCacheRepository.save(entityType.id(), normalizedTitle, normalizedAuthor, result, CHAIN_VERSION);
        }
        return true;
    }

    /**
     * Optional deep search (see GoogleBooksVolumeSearchProvider.
     * DEEP_EDITION_KEYWORDS) - triggered only by an explicit action
     * of the user ("Chercher plus d'éditions" on the client side), never
     * automatically: {@link #searchVolumes} only covers by default the
     * most common keywords to limit the cost, most
     * mangas having no special edition. MERGES with the result already
     * known (memory or durable storage) instead of replacing it - a
     * deep search once done stays kept in the cache,
     * like the rest of {@link #searchVolumes} (never called again
     * automatically, "Actualiser" or a new call to this method are
     * the only ways to run it again).
     */
    public VolumeSearchResult searchAdditionalEditions(EntityType entityType, String seriesTitle, String author) {
        return searchAdditionalEditions(entityType, seriesTitle, author, List.of());
    }

    /** Variant with exclusion of known spin-offs (see
     * {@link #searchVolumes(EntityType, String, String, boolean, List)}). */
    public VolumeSearchResult searchAdditionalEditions(EntityType entityType, String seriesTitle, String author, List<String> excludedTitleFragments) {
        return searchAdditionalEditions(entityType, seriesTitle, author, excludedTitleFragments, null);
    }

    /** @param totalVolumes passed to the quick search when there is no fresh base (see {@link #searchVolumes}),
     *                     so that its gap probes run as on a normal opening */
    public VolumeSearchResult searchAdditionalEditions(EntityType entityType, String seriesTitle, String author,
                                                       List<String> excludedTitleFragments, Integer totalVolumes) {
        String normalizedTitle = normalize(seriesTitle);
        String normalizedAuthor = normalize(author == null ? "" : author);
        String cacheKey = entityType.id() + "|" + normalizedTitle + "|" + normalizedAuthor;

        Optional<List<VolumeCandidate>> known = volumeSearchCache.get(cacheKey)
                .or(() -> findFresh(entityType, normalizedTitle, normalizedAuthor));
        List<VolumeCandidate> existing;
        boolean providerUnavailable = false;
        if (known.isPresent()) {
            existing = known.get();
        } else {
            // No fresh base to merge onto (never searched, or expired): run the
            // quick search first, otherwise the stored row would hold the deep
            // editions alone and hide the common ones until it expires.
            VolumeSearchResult base = searchVolumes(entityType, seriesTitle, author, false, excludedTitleFragments, totalVolumes);
            existing = base.volumes();
            providerUnavailable = base.providerUnavailable();
        }

        List<VolumeCandidate> additional = new ArrayList<>();
        for (VolumeSearchProvider provider : volumeSearchProviders) {
            if (!provider.supports(entityType)) {
                continue;
            }
            try {
                additional.addAll(provider.searchAdditionalEditions(seriesTitle, author, excludedTitleFragments));
            } catch (QuotaExceededException | SourceUnavailableException e) {
                providerUnavailable = true;
            }
        }
        additional = dedupeVolumesPreferringImage(additional);

        List<VolumeCandidate> merged = mergeVolumes(existing, additional);
        if (!providerUnavailable) {
            volumeSearchCache.put(cacheKey, merged);
            // Without an author, memory only - same rule as searchVolumes (Batch 126).
            if (!normalizedAuthor.isBlank()) {
                volumeSearchCacheRepository.save(entityType.id(), normalizedTitle, normalizedAuthor, merged, CHAIN_VERSION);
            }
        }
        return new VolumeSearchResult(merged, providerUnavailable);
    }

    /** Merges without duplicating by (edition, volume) - keeps the version already
     * known in case of collision, EXCEPT if it has no cover and the
     * new one has one (see {@link #dedupeVolumesPreferringImage}): nothing
     * prevents a deep search from finding again through another
     * provider/keyword a volume already known without cover (e.g. BnF during
     * {@link #searchVolumes}, Google Books during this deep
     * search). */
    private static List<VolumeCandidate> mergeVolumes(List<VolumeCandidate> existing, List<VolumeCandidate> additional) {
        Map<String, VolumeCandidate> byKey = new LinkedHashMap<>();
        for (VolumeCandidate candidate : existing) {
            byKey.put(volumeKey(candidate), candidate);
        }
        for (VolumeCandidate candidate : additional) {
            byKey.merge(volumeKey(candidate), candidate, TomeSearchService::fusionnerTome);
        }
        return new ArrayList<>(byKey.values());
    }

    /** Removes duplicates by (edition, volume) within the same list (see
     * {@link #mergeVolumes}) - useful when SEVERAL providers
     * competent for the same EntityType (Google Books and BnF, see
     * BnfVolumeSearchProvider) find the same volume independently:
     * the BnF never providing a cover, the Google Books version
     * (with cover) is preferred in case of collision. */
    private static List<VolumeCandidate> dedupeVolumesPreferringImage(List<VolumeCandidate> candidates) {
        Map<String, VolumeCandidate> byKey = new LinkedHashMap<>();
        for (VolumeCandidate candidate : candidates) {
            byKey.merge(volumeKey(candidate), candidate, TomeSearchService::fusionnerTome);
        }
        return new ArrayList<>(byKey.values());
    }

    /** The first one met keeps its fields; only a missing cover is taken from the second -
     *  and the most precise release date of the two, wherever it comes from (batch 146): the BnF comes
     *  first and only dates to the year, Google Books knows the day. */
    private static VolumeCandidate fusionnerTome(VolumeCandidate existing, VolumeCandidate replacement) {
        String releaseDate = VolumeCandidate.mostPreciseReleaseDate(existing.releaseDate(), replacement.releaseDate());
        if (existing.imageUrl() != null || replacement.imageUrl() == null) {
            return java.util.Objects.equals(releaseDate, existing.releaseDate()) ? existing
                    : new VolumeCandidate(existing.edition(), existing.volumeNumber(), existing.imageUrl(), existing.title(),
                            existing.isbn(), existing.annee(), releaseDate);
        }
        return new VolumeCandidate(existing.edition(), existing.volumeNumber(), replacement.imageUrl(), existing.title(),
                null, null, releaseDate);
    }

    /**
     * "Do we ALREADY know that no volume exists for this series?", without ever
     * querying a provider.
     * <p>
     * Reads only the durable storage ({@link VolumeSearchCacheRepository},
     * see V3__volume_search_cache.sql), where an empty list IS remembered -
     * this is what makes the question free. An expired row answers "we do not
     * know", like a missing one. A series never searched
     * therefore returns {@code false}: "we do not know" and "we know there are
     * none" must not be mixed up, otherwise every work still
     * unknown would be wrongly reported.
     * <p>
     * Deliberately does NOT warm the memory cache: this read serves a
     * secondary display (a mention in a list of results), it must not
     * influence what the next real call will find.
     */
    public boolean isVolumeSearchKnownEmpty(EntityType entityType, String seriesTitle, String author) {
        return findFresh(entityType, normalize(seriesTitle), normalize(author == null ? "" : author))
                .map(List::isEmpty)
                .orElse(false);
    }

    private static String volumeKey(VolumeCandidate candidate) {
        return candidate.key();
    }

    /**
     * One spelling per edition (Batch 123).
     *
     * <p>The edition name is the GROUPING KEY on the screen: two
     * spellings make two editions. Yet the sources are not
     * constant - the BnF catalogs "Doubt" V1 to V3 at "Ki-oon" and
     * V4 at "Ki-Oon" (noted on 2026-09-04), and the preview therefore showed
     * one edition of three volumes and another of a single one. The
     * deduplication saw nothing: its key is already case-insensitive
     * (see {@link VolumeCandidate#key()}), but it does not correct
     * the displayed label.
     *
     * <p>The spelling kept is the MOST FREQUENT one - the one of the largest
     * number of volumes -, and the first one to arrive breaks ties. Nothing is
     * merged or removed here: only labels are rewritten.
     */
    static List<VolumeCandidate> uniformiserLesEditions(List<VolumeCandidate> candidates) {
        Map<String, Map<String, Integer>> orthographesParEdition = new LinkedHashMap<>();
        for (VolumeCandidate candidate : candidates) {
            orthographesParEdition
                    .computeIfAbsent(cleEdition(candidate.edition()), cle -> new LinkedHashMap<>())
                    .merge(candidate.edition(), 1, Integer::sum);
        }
        Map<String, String> retenue = new LinkedHashMap<>();
        orthographesParEdition.forEach((cle, orthographes) -> retenue.put(cle, orthographes.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(cle)));

        List<VolumeCandidate> uniformises = new ArrayList<>(candidates.size());
        for (VolumeCandidate candidate : candidates) {
            String edition = retenue.get(cleEdition(candidate.edition()));
            uniformises.add(edition.equals(candidate.edition()) ? candidate
                    : new VolumeCandidate(edition, candidate.volumeNumber(), candidate.imageUrl(), candidate.title(),
                            null, null, candidate.releaseDate()));
        }
        return uniformises;
    }

    /**
     * Fill the gaps (Batch 125): the numbers missing between 1 and the known
     * total, probed one by one at the provider that can do it.
     *
     * <p>Why after the searches and not in their place: a probe costs
     * one request PER volume. On a series that the BnF knows entirely
     * (Boruto, 20/20), it costs nothing; on a series that it only knows
     * by half, it costs half. Capped at {@link #SONDES_MAX} per
     * search, and stops after {@link #ECHECS_CONSECUTIFS_MAX} numbers in
     * a row without an answer - a cataloged total can be wrong, or the
     * French edition can stop before Japan.
     *
     * <p>The probed volume is attached to an edition already there by its
     * <b>ISBN prefix</b> when Google Books gives no publisher (frequent
     * on its French records): volume 3 of Doubt, ISBN 978-2-35592…,
     * joins the edition whose volumes 1 and 2 carry this same block. Without
     * ISBN or publisher, it is not kept: one more "Edition inconnue"
     * would help nobody.
     */
    private List<VolumeCandidate> comblerLesTrous(EntityType entityType, String seriesTitle, String author,
                                                  List<String> excludedTitleFragments,
                                                  List<VolumeCandidate> dejaTrouves, int totalVolumes) {
        Set<Integer> presents = dejaTrouves.stream().map(VolumeCandidate::volumeNumber).collect(Collectors.toSet());
        Map<String, String> editionParPrefixe = editionsNommeesParPrefixe(dejaTrouves);

        List<VolumeCandidate> combles = new ArrayList<>();
        int sondes = 0;
        int echecsConsecutifs = 0;
        for (int numero = 1; numero <= totalVolumes && sondes < SONDES_MAX && echecsConsecutifs < ECHECS_CONSECUTIFS_MAX; numero++) {
            if (presents.contains(numero)) {
                continue;
            }
            List<VolumeCandidate> trouves = new ArrayList<>();
            for (VolumeSearchProvider provider : volumeSearchProviders) {
                if (provider.supports(entityType)) {
                    trouves.addAll(provider.probeVolume(seriesTitle, author, numero, excludedTitleFragments));
                }
            }
            sondes++;
            boolean retenu = false;
            for (VolumeCandidate candidate : trouves) {
                String prefixe = prefixeIsbn(candidate);
                String edition = prefixe != null ? editionParPrefixe.get(prefixe) : null;
                if (edition == null && (candidate.edition() == null || candidate.edition().isBlank()
                        || candidate.edition().equalsIgnoreCase("Édition inconnue"))) {
                    continue;
                }
                combles.add(edition == null ? candidate : renommer(candidate, edition));
                retenu = true;
            }
            echecsConsecutifs = retenu ? 0 : echecsConsecutifs + 1;
        }
        if (!combles.isEmpty()) {
            log.info("Trous combles pour '{}' : {} tome(s) retrouve(s) par sonde ({} sonde(s))", seriesTitle, combles.size(), sondes);
        }
        return combles;
    }

    /** At most this many secondary editions completed per search - three Google Books pages each. */
    private static final int EDITIONS_SECONDAIRES_MAX = 3;

    /**
     * Complete the SECONDARY editions (batch 144).
     *
     * <p>Measurement of 2026-09-05 against mangacollec: the plain edition was
     * exact on nine series, but Hokage stayed at 19 out of 36, the Édition
     * originale of One Piece at 30 out of 66, Black Édition at 4 out of 6 - the BnF
     * only holds these editions in part, and the volume by volume probe ({@link
     * #comblerLesTrous}) only fills the numbers missing from ALL the
     * editions: a volume 25 present at Kana is never probed for Hokage.
     *
     * <p>Google Books, for its part, returns the volumes of an edition when we search it
     * BY ITS NAME ("Naruto Hokage": 300 records, the Hokage volumes of Kana
     * among them) - three pages at most per edition, three editions at most
     * per search, the most complete first. A record is kept only
     * if it really speaks of this edition, in the name we read on it or
     * in its title: the same request also returns the volumes of the plain
     * edition, which have no business there. It then takes the name of the
     * edition being completed - "Edition Hokage" read at Google Books
     * joins "Hokage" read at the BnF, instead of making a second one.
     *
     * <p>The MAIN edition - the most complete - is never completed
     * this way: the probe takes care of it, and searching "Naruto Kana"
     * would return everything and anything.
     */
    private List<VolumeCandidate> completerLesEditionsSecondaires(EntityType entityType, String seriesTitle, String author,
                                                                  List<String> excludedTitleFragments,
                                                                  List<VolumeCandidate> dejaTrouves) {
        Map<String, List<VolumeCandidate>> parEdition = new LinkedHashMap<>();
        for (VolumeCandidate candidate : finaliser(new ArrayList<>(dejaTrouves))) {
            parEdition.computeIfAbsent(cleEdition(candidate.edition()), cle -> new ArrayList<>()).add(candidate);
        }
        if (parEdition.size() < 2) {
            return List.of();
        }
        String principale = parEdition.entrySet().stream()
                .max(Comparator.comparingInt(entree -> entree.getValue().size()))
                .map(Map.Entry::getKey)
                .orElseThrow();
        List<List<VolumeCandidate>> secondaires = parEdition.entrySet().stream()
                .filter(entree -> !entree.getKey().equals(principale))
                .map(Map.Entry::getValue)
                .filter(tomes -> tomes.size() >= 2 && estNommee(tomes.get(0).edition()))
                .sorted(Comparator.comparingInt((List<VolumeCandidate> tomes) -> tomes.size()).reversed())
                .limit(EDITIONS_SECONDAIRES_MAX)
                .toList();

        List<VolumeCandidate> ajouts = new ArrayList<>();
        for (List<VolumeCandidate> tomes : secondaires) {
            String nom = tomes.get(0).edition();
            String motCle = motCleDEdition(nom);
            if (motCle.isBlank()) {
                continue;
            }
            Set<Integer> presents = tomes.stream().map(VolumeCandidate::volumeNumber).collect(Collectors.toCollection(HashSet::new));
            for (VolumeSearchProvider provider : volumeSearchProviders) {
                if (!provider.supports(entityType)) {
                    continue;
                }
                for (VolumeCandidate trouve : provider.searchEdition(seriesTitle, author, motCle, excludedTitleFragments)) {
                    if (trouve.volumeNumber() < 1 || presents.contains(trouve.volumeNumber()) || !designeCetteEdition(trouve, motCle)) {
                        continue;
                    }
                    ajouts.add(renommer(trouve, nom));
                    presents.add(trouve.volumeNumber());
                }
            }
        }
        if (!ajouts.isEmpty()) {
            log.info("Editions secondaires de '{}' completees : {} tome(s) retrouve(s)", seriesTitle, ajouts.size());
        }
        return ajouts;
    }

    /** "L'intégrale (Hachette)" -> "L'intégrale": what we search at a provider, without the publisher that nommerBloc adds between parentheses. */
    private static String motCleDEdition(String edition) {
        return edition == null ? "" : edition.replaceAll("\\s*\\([^)]*\\)", "").trim();
    }

    /** Does the record speak of THIS edition - in the edition name read on it, or in its title? */
    private static boolean designeCetteEdition(VolumeCandidate candidate, String motCle) {
        String cle = TexteRecherche.normaliser(motCle);
        return TexteRecherche.normaliser(candidate.edition() == null ? "" : candidate.edition()).contains(cle)
                || TexteRecherche.normaliser(candidate.title() == null ? "" : candidate.title()).contains(cle);
    }

    static final String EDITION_INCONNUE = "Édition inconnue";

    /**
     * A publisher that changed its name stays the same publisher (Batch 127). Kazé
     * became Crunchyroll in 2022: the BnF says "Kazé" on volumes 1 to
     * 11 of "Chainsaw Man" and Google Books "Crunchyroll" on the
     * following ones, and the screen made two editions of them. Mangacollec - the
     * user's reference - writes them "Kazé / Crunchyroll", as a single
     * one; we adopt its label. Normalized key (see TexteRecherche)
     * to displayed label.
     */
    private static final Map<String, String> EDITEURS_RENOMMES = Map.of(
            "kaze", "Kazé / Crunchyroll",
            "kaze manga", "Kazé / Crunchyroll",
            "crunchyroll", "Kazé / Crunchyroll",
            // The first Naruto (1999-2004) are filed under the name of the parent
            // company of the time; mangacollec only knows Kana (measured on
            // 2026-09-05: ten volumes apart, 11 to 22).
            "dargaud benelux kana", "Kana",
            // A typo of the catalog, on a volume of One Piece.
            "edition orinale", "Édition Originale");

    static List<VolumeCandidate> unifierLesEditeursRenommes(List<VolumeCandidate> candidates) {
        List<VolumeCandidate> unifies = new ArrayList<>(candidates.size());
        for (VolumeCandidate candidate : candidates) {
            String libelle = EDITEURS_RENOMMES.get(cleEdition(candidate.edition()));
            unifies.add(libelle == null || libelle.equals(candidate.edition()) ? candidate : renommer(candidate, libelle));
        }
        return unifies;
    }

    /**
     * The naming and grouping rules, in the order in which they
     * complete each other - applied to everything that comes out, fresh or cached:
     * attach the "Édition inconnue" to their ISBN block, unify the
     * spellings, separate homonym editions (BEFORE the
     * deduplication, which would merge their two volumes 1), deduplicate.
     */
    static List<VolumeCandidate> finaliser(List<VolumeCandidate> candidates) {
        List<VolumeCandidate> result = unifierLesEditeursRenommes(candidates);
        result = rattacherLesEditionsInconnues(result);
        result = elaguerLesInconnues(result);
        result = uniformiserLesEditions(result);
        result = separerLesEditionsHomonymes(result);
        return dedupeVolumesPreferringImage(result);
    }

    /** The ISBN blocks whose edition we know: prefix -> name, without ever keeping "Édition inconnue". */
    private static Map<String, String> editionsNommeesParPrefixe(List<VolumeCandidate> candidates) {
        Map<String, String> parPrefixe = new LinkedHashMap<>();
        for (VolumeCandidate candidate : candidates) {
            String prefixe = prefixeIsbn(candidate);
            if (prefixe != null && estNommee(candidate.edition())) {
                parPrefixe.putIfAbsent(prefixe, candidate.edition());
            }
        }
        return parPrefixe;
    }

    private static boolean estNommee(String edition) {
        return edition != null && !edition.isBlank() && !edition.equalsIgnoreCase(EDITION_INCONNUE);
    }

    /**
     * "Édition inconnue" is not an edition: it is a volume whose
     * source did not say the publisher (Batch 125). Google Books often does this
     * on its French records - "Spy x Family" came out there with an
     * "Édition inconnue" of seven volumes NEXT TO Kurokawa, the same
     * books. When such a volume carries an ISBN of the same block as a named
     * edition, it joins it; otherwise it keeps its label, for lack of better.
     */
    /**
     * An "Édition inconnue" volume whose NUMBER already exists in a
     * named edition adds nothing: it is the same volume, seen by a source
     * that did not know its publisher (Google Books without a publisher field),
     * and that the attachment by ISBN could not place. Measurement of
     * 2026-09-05: One-Punch Man, Kurokawa 34/34 exact - and sixteen
     * "unknown" from 2 to 23 next to it, where mangacollec has only one edition.
     * Only what no named edition covers stays unknown.
     */
    static List<VolumeCandidate> elaguerLesInconnues(List<VolumeCandidate> candidates) {
        Set<Integer> couverts = new HashSet<>();
        for (VolumeCandidate candidate : candidates) {
            if (aUneEditionNommee(candidate.edition())) {
                couverts.add(candidate.volumeNumber());
            }
        }
        List<VolumeCandidate> result = new ArrayList<>(candidates.size());
        for (VolumeCandidate candidate : candidates) {
            if (!aUneEditionNommee(candidate.edition()) && couverts.contains(candidate.volumeNumber())) {
                continue;
            }
            result.add(candidate);
        }
        return result;
    }

    private static boolean aUneEditionNommee(String edition) {
        return edition != null && !edition.isBlank() && !edition.equalsIgnoreCase(EDITION_INCONNUE);
    }

    static List<VolumeCandidate> rattacherLesEditionsInconnues(List<VolumeCandidate> candidates) {
        Map<String, String> parPrefixe = editionsNommeesParPrefixe(candidates);
        if (parPrefixe.isEmpty()) {
            return candidates;
        }
        List<VolumeCandidate> rattaches = new ArrayList<>(candidates.size());
        for (VolumeCandidate candidate : candidates) {
            String edition = estNommee(candidate.edition()) ? null : parPrefixe.get(prefixeIsbn(candidate));
            rattaches.add(edition == null ? candidate : renommer(candidate, edition));
        }
        return rattaches;
    }

    /** Same rule as the deduplication key of a volume: case and edge spaces ignored. */
    private static String cleEdition(String edition) {
        return edition == null ? "" : TexteRecherche.normaliser(edition);
    }

    /** The first eight digits of an ISBN-13: language prefix + publisher block, which changes from one edition to another. */
    private static final int LONGUEUR_PREFIXE_ISBN = 8;

    /**
     * One publisher, two editions: separate them (Batch 124).
     *
     * <p>The publisher name is not enough to name an edition. "Doubt"
     * (Yoshiki Tonogai) exists at Ki-oon in 4 volumes (2009-2010) AND in
     * 2 double volumes (2022) - same publisher, same numbers 1 and 2. The
     * deduplication by (edition, number) therefore merged them silently,
     * and the screen showed only one.
     *
     * <p>What objectively tells them apart is the <b>ISBN</b>: each
     * edition has its own, and the first eight digits (language prefix
     * + publisher block) differ from one edition to another -
     * 978-2-35592… against 979-10-327… in this case. User's choice
     * on 2026-09-04, preferred to the year, more readable but less sure.
     *
     * <p><b>The separation only takes place in case of proof</b>: the
     * same volume number must arrive with two different prefixes. An edition
     * whose volumes spread over two ISBN blocks without ever
     * overlapping stays a single edition - this is the safeguard that avoids
     * wrongly splitting long series. The name kept adds the year of the
     * oldest volume of the block, the only readable mention we have;
     * failing that, the four digits of the publisher block.
     *
     * <p>Volumes without ISBN cannot be assigned to any block: they
     * stay in the largest one, the one that keeps the original name.
     */
    static List<VolumeCandidate> separerLesEditionsHomonymes(List<VolumeCandidate> candidates) {
        Map<String, List<VolumeCandidate>> parEdition = new LinkedHashMap<>();
        for (VolumeCandidate candidate : candidates) {
            parEdition.computeIfAbsent(cleEdition(candidate.edition()), cle -> new ArrayList<>()).add(candidate);
        }

        List<VolumeCandidate> resultat = new ArrayList<>(candidates.size());
        for (List<VolumeCandidate> groupe : parEdition.values()) {
            resultat.addAll(separerUnGroupe(groupe));
        }
        return resultat;
    }

    private static List<VolumeCandidate> separerUnGroupe(List<VolumeCandidate> groupe) {
        Map<String, List<VolumeCandidate>> parPrefixe = new LinkedHashMap<>();
        List<VolumeCandidate> sansIsbn = new ArrayList<>();
        for (VolumeCandidate candidate : groupe) {
            String prefixe = prefixeIsbn(candidate);
            if (prefixe == null) {
                sansIsbn.add(candidate);
            } else {
                parPrefixe.computeIfAbsent(prefixe, p -> new ArrayList<>()).add(candidate);
            }
        }
        if (parPrefixe.size() < 2) {
            return groupe;
        }

        // The largest block is the main edition: it keeps its name.
        String prefixePrincipal = parPrefixe.entrySet().stream()
                .max(Comparator.comparingInt(entree -> entree.getValue().size()))
                .map(Map.Entry::getKey)
                .orElseThrow();
        Set<Integer> numerosPrincipaux = parPrefixe.get(prefixePrincipal).stream()
                .map(VolumeCandidate::volumeNumber)
                .collect(Collectors.toSet());

        List<VolumeCandidate> separes = new ArrayList<>(groupe.size());
        for (Map.Entry<String, List<VolumeCandidate>> bloc : parPrefixe.entrySet()) {
            List<VolumeCandidate> tomes = bloc.getValue();
            boolean aPart = !bloc.getKey().equals(prefixePrincipal)
                    && estUneAutreEdition(tomes, numerosPrincipaux);
            String nom = aPart ? nommerBloc(tomes.get(0).edition(), tomes, bloc.getKey()) : null;
            for (VolumeCandidate candidate : tomes) {
                separes.add(aPart ? renommer(candidate, nom) : candidate);
            }
        }
        separes.addAll(sansIsbn);
        return separes;
    }

    /**
     * Is an ISBN block ANOTHER edition, or the continuation of the same one?
     *
     * <p>A publisher changes ISBN block over the years: volumes 1 to 12
     * of "Vinland Saga" at Kurokawa do not have the same prefix as volumes
     * 13 to 24, and yet they are the same books, the same edition.
     * A first attempt that separated as soon as two blocks coexisted
     * therefore split this series into four (noted on 2026-09-04) - we must only
     * separate on a much narrower proof:
     *
     * <ul>
     *   <li><b>all</b> the numbers of the block already exist in the main
     *       edition - a block that brings new volumes is its
     *       continuation, not a duplicate;</li>
     *   <li>and these numbers form a series <b>continuous from 1</b> -
     *       this is the shape of a reissue (double, omnibus, perfect),
     *       which always starts again at volume 1.</li>
     * </ul>
     *
     * <p>"Doubt": the 2022 block carries {1, 2}, both present in the
     * 2009 edition (1 to 4), and continuous from 1 - it is indeed the
     * double edition. The Kurokawa block of 2024 carries {1, 28, 29}: 28 and
     * 29 are new, so it is not another edition.
     */
    private static boolean estUneAutreEdition(List<VolumeCandidate> tomes, Set<Integer> numerosPrincipaux) {
        Set<Integer> numeros = tomes.stream().map(VolumeCandidate::volumeNumber).collect(Collectors.toSet());
        // A single volume is not an edition: it is a reprint of volume 1
        // under another ISBN prefix (measured on 2026-09-05: One Piece
        // returned "Glenat (2000)" and "Glenat (2006)", one volume each).
        // A reissue has at least two - the double edition of Doubt.
        if (numeros.size() < 2 || !numerosPrincipaux.containsAll(numeros)) {
            return false;
        }
        for (int n = 1; n <= numeros.size(); n++) {
            if (!numeros.contains(n)) {
                return false;
            }
        }
        return true;
    }

    private static String nommerBloc(String edition, List<VolumeCandidate> tomes, String prefixe) {
        Integer annee = tomes.stream()
                .map(VolumeCandidate::annee)
                .filter(java.util.Objects::nonNull)
                .min(Integer::compareTo)
                .orElse(null);
        return edition + " (" + (annee != null ? annee : prefixe.substring(prefixe.length() - 4)) + ")";
    }

    private static VolumeCandidate renommer(VolumeCandidate candidate, String edition) {
        return new VolumeCandidate(edition, candidate.volumeNumber(), candidate.imageUrl(), candidate.title(),
                candidate.isbn(), candidate.annee(), candidate.releaseDate());
    }

    private static String prefixeIsbn(VolumeCandidate candidate) {
        String isbn = candidate.isbnNormalise();
        if (isbn == null) {
            return null;
        }
        // An ISBN-10 (records from before 2007 at the BnF: "2-87129-414-3" for
        // volume 1 of Naruto) designates the same publisher block as the ISBN-13
        // that Google Books gives for the same book (978-2-87129-414-1): the
        // prefix is read after the 978, otherwise the two never meet
        // and an old volume makes a block apart (batch 144).
        if (isbn.length() == 10) {
            isbn = "978" + isbn;
        }
        return isbn.length() < LONGUEUR_PREFIXE_ISBN ? null : isbn.substring(0, LONGUEUR_PREFIXE_ISBN);
    }
}
