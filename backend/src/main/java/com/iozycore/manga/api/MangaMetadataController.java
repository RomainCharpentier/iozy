package com.iozycore.manga.api;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.manga.metadata.FrenchTitleService;
import com.iozycore.manga.metadata.RelatedSeriesService;
import com.iozycore.manga.metadata.TomeSearchService;
import com.iozycore.manga.metadata.VolumeCandidate;
import com.iozycore.manga.metadata.VolumeSearchResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Mangas: the title of the French edition, the volumes and their editions.
 * Same routes as before Batch 132 (/api/metadata/french-title, /volumes,
 * /volumes/known-empty), in the package of their universe, backed by the services
 * of {@code metadata.manga}.
 */
@RestController
@RequestMapping("/api/metadata")
@Tag(name = "Metadata - mangas", description = "French title, volumes and editions of a series (BnF, Google Books, "
        + "Open Library)")
public class MangaMetadataController {

    private final FrenchTitleService frenchTitleService;
    private final TomeSearchService tomeSearchService;
    private final RelatedSeriesService relatedSeriesService;
    private final EntityTypeRepository entityTypeRepository;
    private final EntityRepository entityRepository;
    private final OwnershipRepository ownershipRepository;

    public MangaMetadataController(FrenchTitleService frenchTitleService,
                                   TomeSearchService tomeSearchService,
                                   RelatedSeriesService relatedSeriesService,
                                   EntityTypeRepository entityTypeRepository,
                                   EntityRepository entityRepository,
                                   OwnershipRepository ownershipRepository) {
        this.frenchTitleService = frenchTitleService;
        this.tomeSearchService = tomeSearchService;
        this.relatedSeriesService = relatedSeriesService;
        this.entityTypeRepository = entityTypeRepository;
        this.entityRepository = entityRepository;
        this.ownershipRepository = ownershipRepository;
    }

    @Operation(summary = "Best-effort search of a French edition title (Open Library, then Google Books as "
            + "fallback) for an already chosen title (mangas) - neither Jikan nor MyAnimeList know it. Triggered "
            + "only when a suggestion is selected on the client side, never for a whole list of search results "
            + "(cost in external calls) - see FrenchTitleService.findFrenchTitle. 404 if nothing "
            + "found, not an error: the client then falls back to the English/romaji title already shown - this is "
            + "also the answer when the only candidate title comes from the last resort \"author only\" and turns "
            + "out to be the catalogued title of ANOTHER work by the same author (see "
            + "FrenchTitleService.namesAnotherKnownWork). malId "
            + "(already known from the selected candidate) lets us discard a known sequel/spin-off (see "
            + "RelatedSeriesService) wrongly resolved in place of the searched title - e.g. \"Dragon Ball Super\" for "
            + "\"Dragon Ball\" - best-effort, no effect if absent. titleRomaji (see "
            + "MyAnimeListMetadataProvider.titleRomaji) is tried as a fallback to 'query' for this same detection "
            + "when a spin-off is indexed under the romaji title rather than the displayed title (e.g. \"Attack on "
            + "Titan\"/\"Shingeki no Kyojin\").")
    @GetMapping("/french-title")
    public FrenchTitleResponse frenchTitle(@RequestParam UUID entityTypeId, @RequestParam String query,
                                            @RequestParam(required = false) String author,
                                            @RequestParam(required = false) String malId,
                                            @RequestParam(required = false) String titleRomaji) {
        EntityType entityType = entityTypeRepository.findById(entityTypeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "EntityType inconnu : " + entityTypeId));

        if (query == null || query.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le paramètre 'query' est requis");
        }

        List<String> excludedTitleFragments = relatedSeriesService.findExcludedTitleFragments(entityType, malId, query, titleRomaji);
        return frenchTitleService.findFrenchTitle(entityType, query, author, excludedTitleFragments, malId)
                .map(FrenchTitleResponse::new)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Aucun titre français trouvé pour : " + query));
    }

    public record FrenchTitleResponse(String frenchTitle) {
    }

    /** A volume found (see VolumeCandidate), enriched with alreadyOwned - true if
     * an active Ownership already references a Variant of the existing series
     * matching this edition + this volume number. This cross-check is done
     * here (presentation layer), never in TomeSearchService which only
     * knows external sources, never the user's collection. */
    public record VolumeCandidateResponse(String edition, int volumeNumber, String imageUrl, String title, boolean alreadyOwned) {
        static VolumeCandidateResponse from(VolumeCandidate candidate, boolean alreadyOwned) {
            return new VolumeCandidateResponse(
                    candidate.edition(), candidate.volumeNumber(), candidate.imageUrl(), candidate.title(), alreadyOwned);
        }
    }

    /** {@code quotaExceeded} tells an empty list "no edition
     * found" apart from a TRANSIENT failure of the external provider - quota exceeded
     * on all the configured keys, or a source that did not answer at all
     * (see VolumeSearchResult) - the client can then show an
     * adapted message ("try again later") instead of wrongly letting believe
     * that the series has no French edition.
     * <p>
     * The field name says "quota" and now covers both causes: it
     * is already decoded as is by the iOS client (see
     * APIClient+Collections.swift), renaming it would break its reading for a
     * purely cosmetic gain - the flag is named {@code
     * providerUnavailable} everywhere else, on the server side. */
    public record VolumesResponse(List<VolumeCandidateResponse> volumes, boolean quotaExceeded) {
    }

    @Operation(summary = "Best-effort search of the real volumes (with cover) of the French editions of a "
            + "series (Google Books) - to offer a visual selection of the owned volumes instead of manual "
            + "entry of the volume number. alreadyOwned shows the volumes already owned (active Ownership on the "
            + "matching Variant, if the series already exists in the collection). volumes empty if nothing found "
            + "(never an error): the client then keeps the manual entry flow - quotaExceeded tells this "
            + "case apart from a transient provider failure (quota exceeded, or a source that did not answer). Result stored durably (see V3__volume_search_cache.sql) - "
            + "a result once found is never called again automatically, forceRefresh=true ('Actualiser' button "
            + "on the client side, administrator only - ignored for other accounts) is the only way to relaunch the Google Books requests behind this "
            + "candidate - see TomeSearchService.searchVolumes. Default search limited to a few common "
            + "edition keywords; deepSearch=true ('Chercher plus d'éditions' button) merges with the rarer "
            + "keywords (see TomeSearchService.searchAdditionalEditions) - incompatible with forceRefresh, "
            + "deepSearch then takes priority. malId+originalTitle (already known from the selected candidate) "
            + "let us discard a known spin-off/side-story (see RelatedSeriesService) published under a title "
            + "structurally identical to a real edition - best-effort, no effect if one of the two is missing. "
            + "titleRomaji is tried as a fallback to originalTitle for this same detection (see /french-title).")
    @GetMapping("/volumes")
    public VolumesResponse volumes(@RequestParam UUID entityTypeId, @RequestParam String title,
                                    @RequestParam(required = false) String author,
                                    @RequestParam(required = false, defaultValue = "false") boolean forceRefresh,
                                    @RequestParam(required = false, defaultValue = "false") boolean deepSearch,
                                    @RequestParam(required = false) String malId,
                                    @RequestParam(required = false) String originalTitle,
                                    @RequestParam(required = false) String titleRomaji,
                                    @RequestParam(required = false) Integer totalVolumes) {
        EntityType entityType = entityTypeRepository.findById(entityTypeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "EntityType inconnu : " + entityTypeId));

        if (title == null || title.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le paramètre 'title' est requis");
        }

        List<String> excludedTitleFragments = relatedSeriesService.findExcludedTitleFragments(entityType, malId, originalTitle, titleRomaji);
        // Reloading from the source is an ADMINISTRATOR action (user
        // request of 2026-09-04): they answer for the uniform data
        // of the instance, and for the provider quotas. For an ordinary
        // account the request is served from the cache, without refusal:
        // the cover catch-up (backfillCovers) forces as a second
        // intention, and a 403 would pass for a silent provider there.
        boolean rechargement = forceRefresh && estAdministrateur();
        VolumeSearchResult searchResult = deepSearch
                ? tomeSearchService.searchAdditionalEditions(entityType, title, author, excludedTitleFragments, totalVolumes)
                : tomeSearchService.searchVolumes(entityType, title, author, rechargement, excludedTitleFragments, totalVolumes);
        Set<String> ownedKeys = alreadyOwnedVariantKeys(entityTypeId, title);

        // Sorted by number, and the sort is STABLE: editions keep the order
        // of their first appearance (the provider's one first), only
        // the volumes are sorted. Google Books already returned its volumes in order,
        // BnF returns them in the order of its catalog - seen on Boruto
        // (09, 03, 02, 08, 01, 18, 17) the day it came first.
        List<VolumeCandidateResponse> candidates = searchResult.volumes().stream()
                .sorted(java.util.Comparator.comparingInt(VolumeCandidate::volumeNumber))
                .map(candidate -> VolumeCandidateResponse.from(candidate, ownedKeys.contains(variantKey(candidate.edition(), candidate.volumeNumber()))))
                .collect(Collectors.toList());
        return new VolumesResponse(candidates, searchResult.providerUnavailable());
    }

    public record SeriesSansTomesRequest(UUID entityTypeId, List<SerieInterrogee> series) {
    }

    public record SerieInterrogee(String title, String author) {
    }

    /**
     * Among these series, which ones do we ALREADY know have no volume at all?
     * <p>
     * Answers from the durable cache of volume searches only, never
     * calling a provider: this is what makes this question usable on
     * a list of search results, where really asking it would cost
     * eight Google Books requests PER SERIES (see GoogleBooksVolumeSearchProvider)
     * and would exhaust the quota in a few keystrokes.
     * <p>
     * Accepted consequence: a series never searched is not flagged. We
     * do not confuse "we know there are none" with "we do not know
     * yet" - flagging the second would amount to marking the whole catalog.
     * <p>
     * POST and not GET: the question carries a LIST of pairs
     * (title, author), including Japanese titles and titles with punctuation - making them
     * fit in a query string would be fragile for a request that does not
     * change anything but is not cached by HTTP anyway.
     */
    @Operation(summary = "Among these series, which ones are already known to have no volume "
            + "(cache only, no call to an external provider)")
    @PostMapping("/volumes/known-empty")
    public List<SerieInterrogee> volumesKnownEmpty(@RequestBody SeriesSansTomesRequest request) {
        EntityType entityType = entityTypeRepository.findById(request.entityTypeId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "EntityType inconnu : " + request.entityTypeId()));
        if (request.series() == null) {
            return List.of();
        }
        return request.series().stream()
                .filter(serie -> serie.title() != null && !serie.title().isBlank())
                .filter(serie -> tomeSearchService.isVolumeSearchKnownEmpty(entityType, serie.title(), serie.author()))
                .collect(Collectors.toList());
    }

    /** "edition|volume" keys (normalised) of the Variant objects of the series {@code title}
     * (if it already exists) referenced by at least one active Ownership -
     * empty if the series was never added, which is the most
     * frequent case (we look for volumes before even knowing if we already own any). */
    private Set<String> alreadyOwnedVariantKeys(UUID entityTypeId, String title) {
        Optional<Entity> existingEntity = entityRepository.findByTypeAndTitle(entityTypeId, title.trim());
        if (existingEntity.isEmpty()) {
            return Set.of();
        }
        Entity entity = existingEntity.get();
        Set<UUID> activeVariantIds = ownershipRepository.findByEntityId(entity.id()).stream()
                .filter(Ownership::isActive)
                .map(Ownership::variantId)
                .filter(Optional::isPresent)
                .map(Optional::get)
                .collect(Collectors.toSet());

        return entity.variants().stream()
                .filter(variant -> activeVariantIds.contains(variant.id()))
                .map(this::variantKey)
                .collect(Collectors.toSet());
    }

    private String variantKey(Variant variant) {
        Object volumeNumber = variant.attributes().get("volumeNumber");
        Object edition = variant.attributes().get("edition");
        if (!(volumeNumber instanceof Number number)) {
            return "unknown|" + variant.id(); // volume without a usable number - will never match a VolumeCandidate, no side effect
        }
        return variantKey(edition == null ? "" : edition.toString(), number.intValue());
    }

    /** The same identity as that of a {@link VolumeCandidate} - this is
     *  precisely what lets us say "this volume, you already have it". */
    private String variantKey(String edition, int volumeNumber) {
        return VolumeCandidate.key(edition, volumeNumber);
    }

    /** Same rule as ImportController: only an administrator reloads from the source. */
    private static boolean estAdministrateur() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    }
}
