package com.iozycore.manga.application;

import com.iozycore.core.application.EntityTypeLookup;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.manga.metadata.FrenchTitleService;
import com.iozycore.manga.metadata.RelatedSeriesService;
import com.iozycore.manga.metadata.TomeSearchService;
import com.iozycore.manga.metadata.VolumeCandidate;
import com.iozycore.manga.metadata.VolumeSearchResult;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Use cases of the manga metadata a screen asks for before an add: the French
 * title of a series, its real volumes with the ones already owned, and the
 * series already known to have no volume. Every source here is best effort:
 * nothing found is an empty answer, never an error.
 */
@Service
@RequiredArgsConstructor
public class VolumeLookup {

    private final FrenchTitleService frenchTitleService;
    private final TomeSearchService tomeSearchService;
    private final RelatedSeriesService relatedSeriesService;
    private final EntityTypeLookup entityTypeLookup;
    private final EntityRepository entityRepository;
    private final OwnershipRepository ownershipRepository;

    /** The search of volumes, as the screen sends it. */
    public record VolumeQuery(UUID entityTypeId, String title, String author, boolean deepSearch,
                              String malId, String originalTitle, String titleRomaji, Integer totalVolumes) {
    }

    public record FoundVolume(VolumeCandidate candidate, boolean alreadyOwned) {
    }

    /** {@code quotaExceeded} tells "nothing found" apart from a source that did not answer. */
    public record FoundVolumes(List<FoundVolume> volumes, boolean quotaExceeded) {
    }

    /**
     * The French title of a chosen series. {@code malId} and {@code titleRomaji}
     * let us discard a known sequel or spin-off resolved in place of the
     * searched title (see RelatedSeriesService).
     */
    public Optional<String> frenchTitle(UUID entityTypeId, String query, String author, String malId,
                                        String titleRomaji) {
        EntityType entityType = entityTypeLookup.require(entityTypeId);
        if (query == null || query.isBlank()) {
            throw new IllegalArgumentException("Le paramètre 'query' est requis");
        }
        List<String> excluded = relatedSeriesService.findExcludedTitleFragments(entityType, malId, query, titleRomaji);
        return frenchTitleService.findFrenchTitle(entityType, query, author, excluded, malId);
    }

    /**
     * The real volumes of the French editions of a series, each marked when an
     * active copy of it is already owned. {@code reload} relaunches the sources
     * instead of the cache: the caller decides who may ask for it.
     */
    public FoundVolumes volumes(VolumeQuery query, boolean reload) {
        EntityType entityType = entityTypeLookup.require(query.entityTypeId());
        if (query.title() == null || query.title().isBlank()) {
            throw new IllegalArgumentException("Le paramètre 'title' est requis");
        }
        List<String> excluded = relatedSeriesService.findExcludedTitleFragments(
                entityType, query.malId(), query.originalTitle(), query.titleRomaji());
        VolumeSearchResult result = query.deepSearch()
                ? tomeSearchService.searchAdditionalEditions(entityType, query.title(), query.author(), excluded,
                        query.totalVolumes())
                : tomeSearchService.searchVolumes(entityType, query.title(), query.author(), reload, excluded,
                        query.totalVolumes());
        Set<String> ownedKeys = ownedVolumeKeys(query.entityTypeId(), query.title());
        // Sorted by number, and the sort is STABLE: editions keep the order of
        // their first appearance (the provider's one first), only the volumes are
        // sorted. BnF returns them in the order of its catalog.
        List<FoundVolume> volumes = result.volumes().stream()
                .sorted(Comparator.comparingInt(VolumeCandidate::volumeNumber))
                .map(candidate -> new FoundVolume(candidate,
                        ownedKeys.contains(VolumeCandidate.key(candidate.edition(), candidate.volumeNumber()))))
                .collect(Collectors.toList());
        return new FoundVolumes(volumes, result.providerUnavailable());
    }

    /** Among these series, the ones already known to have no volume (cache only, no provider call). */
    public <T> List<T> knownEmpty(UUID entityTypeId, List<T> series, Function<T, String> title,
                                  Function<T, String> author) {
        EntityType entityType = entityTypeLookup.require(entityTypeId);
        if (series == null) {
            return List.of();
        }
        return series.stream()
                .filter(serie -> title.apply(serie) != null && !title.apply(serie).isBlank())
                .filter(serie -> tomeSearchService.isVolumeSearchKnownEmpty(
                        entityType, title.apply(serie), author.apply(serie)))
                .collect(Collectors.toList());
    }

    private Set<String> ownedVolumeKeys(UUID entityTypeId, String title) {
        Optional<Entity> existing = entityRepository.findByTypeAndTitle(entityTypeId, title.trim());
        if (existing.isEmpty()) {
            return Set.of();
        }
        Entity entity = existing.get();
        Set<UUID> activeVariantIds = ownershipRepository.findByEntityId(entity.id()).stream()
                .filter(Ownership::isActive)
                .map(Ownership::variantId)
                .flatMap(Optional::stream)
                .collect(Collectors.toSet());
        return entity.variants().stream()
                .filter(variant -> activeVariantIds.contains(variant.id()))
                .map(VolumeLookup::volumeKey)
                .collect(Collectors.toSet());
    }

    private static String volumeKey(Variant variant) {
        Object volumeNumber = variant.attributes().get("volumeNumber");
        Object edition = variant.attributes().get("edition");
        if (!(volumeNumber instanceof Number number)) {
            // A volume without a usable number never matches a candidate.
            return "unknown|" + variant.id();
        }
        return VolumeCandidate.key(edition == null ? "" : edition.toString(), number.intValue());
    }
}
