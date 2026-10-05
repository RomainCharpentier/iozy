package com.iozycore.core.metadata;

import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.shared.TexteRecherche;
import com.iozycore.core.metadata.catalog.CatalogSearchService;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Entry point of the Metadata Enrichment Bounded Context (step 8 of the
 * design) for what applies to ALL UNIVERSES: the search by
 * title and the recognition of a barcode. Selects the
 * MetadataProvider/BarcodeMetadataProvider competent for the requested
 * EntityType and aggregates their results - the rest of the application never
 * needs to know Jikan/BGG/IGDB directly.
 *
 * <h2>One package per universe (Batch 132)</h2>
 * What only makes sense for a manga - the title of the French edition,
 * the volumes and their editions, the related series - lives in
 * {@code metadata.manga} ({@code FrenchTitleService}, {@code TomeSearchService},
 * {@code RelatedSeriesService}) with its sources (AniList, Jikan,
 * MyAnimeList, Google Books, BnF, Open Library). Video games (IGDB) are
 * in {@code metadata.videogame}, board games (BGG) in
 * {@code metadata.boardgame}, and what the IOZYCORE DATABASE already knows - the
 * local catalog - in {@code metadata.catalog}. Only the common
 * contracts and the two cross-cutting actions remain here.
 * <p>
 * The calls to the providers themselves (search by title and lookup by
 * barcode) are cached (see {@link TtlCache}) to limit the
 * calls to the external APIs - the same search retyped, a debounce that
 * still lets several close requests through, or several clients
 * (iOS + Web) asking the same thing trigger only one real
 * call per time window.
 */
@Service
public class MetadataSearchService {

    private final List<MetadataProvider> providers;
    private final List<BarcodeMetadataProvider> barcodeProviders;
    private final CatalogSearchService catalogue;

    // Key = entityTypeId + normalized query/barcode. The search by
    // title caches the RAW result of the providers (before the "already
    // owned" filtering): this filtering depends on the current state of the collection, which
    // can change between two calls (an add has just happened) - it is
    // therefore always recomputed on the fly, only the network call is cached.
    // Longer TTL for barcodes: a scanned ISBN has by nature
    // only one possible answer, unlike a search by title
    // for which we still want to see the new releases from time to time.
    //
    // barcodeCache remembers ONLY the results found (never an absence
    // of result): a transient network failure (timeout, 429...) must not
    // condemn the same search to fail for 24h - at worst, an
    // ISBN really not found triggers an external call each time, which
    // remains largely acceptable (just rarer than for a real hit).
    // searchCache keeps the previous behavior (even an empty result is
    // cached): its TTL of 15 min is short, and an empty list of results
    // is a legitimate answer there (no result for this search),
    // not a clear failure/success distinction as for an Optional.
    private final TtlCache<String, List<MetadataCandidate>> searchCache = new TtlCache<>(Duration.ofMinutes(15), 300);
    private final TtlCache<String, MetadataCandidate> barcodeCache = new TtlCache<>(Duration.ofHours(24), 500);

    /**
     * The barcodes searched without success.
     *
     * <p>A <b>separate</b> cache, with a much shorter duration, because it does not
     * remember the same kind of thing: "this code is Naruto volume 9"
     * is lasting knowledge, "no database knows this code" is a
     * state of the world that changes as soon as a contributor adds it. Thirty minutes
     * cover the session during which an analysis is restarted on the same
     * photos, without making the catalog blind to its own progress.
     *
     * <p>More entries than the cache of successes: on a photo of a pile, the
     * EANs not found are often the most numerous. Each one only weighs a
     * key and a boolean.
     */
    private final TtlCache<String, Boolean> barcodeMissCache = new TtlCache<>(Duration.ofMinutes(30), 1000);

    public MetadataSearchService(List<MetadataProvider> providers,
                                  List<BarcodeMetadataProvider> barcodeProviders,
                                  CatalogSearchService catalogue) {
        this.providers = providers;
        this.barcodeProviders = barcodeProviders;
        this.catalogue = catalogue;
    }

    /**
     * Excludes the candidates whose title already matches an Entity of this
     * type in the collection (case-insensitive comparison, same
     * rule as the deduplication of QuickAddService): the goal of this
     * search is to prepare the adding of a new item, not to
     * show again what is already owned among the suggestions.
     * <p>
     * Deliberately applies only to the search by title - the lookup
     * by barcode ({@link #lookupByBarcode}) must on the contrary be able to
     * find a title already owned, to attach a second scanned copy to it
     * (see QuickAddService.addNewEntityWithOwnership).
     * <p>
     * See {@link #search(EntityType, String, boolean)} for the only caller
     * that needs the opposite.
     */
    public List<MetadataCandidate> search(EntityType entityType, String query) {
        return search(entityType, query, false);
    }

    /**
     * Same search, with the possibility to KEEP what is already owned.
     * <p>
     * The filter above serves a precise screen: the one that prepares an add.
     * Reloading the information of an existing detail page asks the opposite
     * question - "what does the source know about THIS work?" - and the filter
     * guaranteed zero matches there, by construction. Observed on Naruto:
     * the search returned eight spin-offs (Boruto, the light novels...) and never
     * the series itself.
     * <p>
     * The cache is not concerned: it remembers the RAW results of the
     * providers, the filter applies afterwards.
     */
    public List<MetadataCandidate> search(EntityType entityType, String query, boolean includeOwned) {
        String cacheKey = entityType.id() + "|" + normalize(query);
        List<MetadataCandidate> rawResults = searchCache.get(cacheKey).orElseGet(() -> {
            List<MetadataCandidate> fetched = providers.stream()
                    .filter(provider -> provider.supports(entityType))
                    .flatMap(provider -> provider.search(query).stream())
                    .collect(Collectors.toList());
            List<MetadataCandidate> deduped = dedupeByTitle(fetched);
            searchCache.put(cacheKey, deduped);
            return deduped;
        });

        if (includeOwned) {
            return rawResults;
        }

        Set<String> alreadyOwnedTitles = catalogue.titresConnus(entityType.id());

        return rawResults.stream()
                .filter(candidate -> !alreadyOwnedTitles.contains(normalize(candidate.title())))
                .collect(Collectors.toList());
    }

    /**
     * The comparison key of titles - accents and punctuation folded, like
     * the local search and Discover (see TexteRecherche). Also serves as
     * cache key: two keystrokes that designate the same work share the
     * same provider response.
     */
    private static String normalize(String value) {
        return TexteRecherche.normaliser(value);
    }

    /**
     * Several providers can return the same title - e.g. "Naruto",
     * unchanged in French, comes out of both Jikan/MyAnimeList (original
     * title) and GoogleBooksTitleSearchProvider (search by
     * French title) - two visually identical entries in the list of
     * suggestions, of no interest for the user. Keeps the first
     * occurrence met per normalized title (case-insensitive):
     * the order of the providers (see their respective @Order) makes
     * Jikan/MyAnimeList win over Google Books/Open Library when both
     * find the same title - richer attributes (titleEnglish/
     * titleRomaji/mediaType/startYear), useful to the resolution of the
     * French title and to the search for volumes that follow the selection.
     */
    private static List<MetadataCandidate> dedupeByTitle(List<MetadataCandidate> candidates) {
        Map<String, MetadataCandidate> byTitle = new LinkedHashMap<>();
        for (MetadataCandidate candidate : candidates) {
            byTitle.putIfAbsent(normalize(candidate.title()), candidate);
        }
        return new ArrayList<>(byTitle.values());
    }

    /**
     * Returns the first result found by a provider competent for this
     * barcode.
     *
     * <h2>Failures are remembered too - and not for the same duration</h2>
     * Only successes were. An EAN that no database indexes was therefore
     * queried again <b>every time</b>, at full price: 1.4 to 5.5 seconds
     * measured per call. Reading the barcodes on the photos of a batch
     * made this hole expensive - a pile of mangas can carry a dozen
     * EANs, several of them absent from the databases, and the user who restarts their
     * analysis paid the whole wait again.
     *
     * <p>The two durations differ, and this is the heart of the matter: <b>a success
     * is knowledge, a failure is a state of the world</b>. "This code
     * is Naruto volume 9" stays true indefinitely ({@code 24 h} here, for
     * caution); "no database knows this code" can stop being true
     * as soon as a contributor adds it. Remembering a failure as long
     * as a success would make the catalog blind to its own progress.
     */
    public Optional<MetadataCandidate> lookupByBarcode(EntityType entityType, String barcode) {
        return lookupDetailedByBarcode(entityType, barcode).candidateIfAny();
    }

    /**
     * Like {@link #lookupByBarcode}, but saying ALSO whether the absence was
     * observed or only suffered.
     * <p>
     * The service already made the difference for its cache - an outage is
     * never remembered there - but kept it to itself: the caller only received an
     * empty {@code Optional}, and the screen could only stay vague. Yet this is
     * precisely the distinction that matters to whoever scans: "this code
     * does not exist" calls for an entry by title, "a database did not answer"
     * calls for a simple retry.
     */
    public BarcodeLookup lookupDetailedByBarcode(EntityType entityType, String barcode) {
        String cacheKey = entityType.id() + "|" + normalize(barcode);
        Optional<MetadataCandidate> cached = barcodeCache.get(cacheKey);
        if (cached.isPresent()) {
            return BarcodeLookup.found(cached.get());
        }
        if (barcodeMissCache.get(cacheKey).isPresent()) {
            // Already searched recently, and not found. No need to redo
            // the round trip to get the same answer.
            return BarcodeLookup.absent();
        }

        // All the competent providers are queried until the first
        // result - and we note along the way whether each one did ANSWER.
        Optional<MetadataCandidate> result = Optional.empty();
        boolean tousOntRepondu = true;
        for (BarcodeMetadataProvider provider : barcodeProviders) {
            if (!provider.supports(entityType)) {
                continue;
            }
            BarcodeLookup lookup = provider.lookupDetailed(barcode);
            if (lookup.candidate() != null) {
                result = Optional.of(lookup.candidate());
                break;
            }
            tousOntRepondu &= lookup.conclusive();
        }

        if (result.isPresent()) {
            barcodeCache.put(cacheKey, result.get());
            return BarcodeLookup.found(result.get());
        } else if (tousOntRepondu) {
            // OBSERVED absence: all the competent databases answered, and
            // none knows this code. Asking it again within half an hour would give
            // the same thing - better to avoid it, each call costs seconds.
            //
            // An outage, on the other hand, is never remembered: otherwise the user's
            // retry would return the cached failure instead of trying again, and a
            // one-second incident would freeze for thirty minutes.
            barcodeMissCache.put(cacheKey, Boolean.TRUE);
        }
        return tousOntRepondu ? BarcodeLookup.absent() : BarcodeLookup.unavailable();
    }
}
