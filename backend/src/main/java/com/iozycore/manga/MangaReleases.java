package com.iozycore.manga;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.shared.TexteRecherche;
import com.iozycore.core.domain.insights.ReleaseContext;
import com.iozycore.core.domain.insights.ReleaseDate;
import com.iozycore.core.domain.insights.ReleaseEntry;
import com.iozycore.core.application.insights.ReleaseSource;
import com.iozycore.manga.domain.followededition.FollowedEdition;
import com.iozycore.manga.domain.followededition.FollowedEditionRepository;
import com.iozycore.manga.metadata.StoredVolumeSearch;
import com.iozycore.manga.metadata.VolumeCandidate;
import com.iozycore.manga.metadata.VolumeSearchCacheRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * The release calendar, for mangas: the dated volumes of the series
 * the user owns or wants - the facade of the manga module towards the core
 * (batch 146).
 *
 * <h2>Where the dates come from</h2>
 * From the stored result of the volume search ({@code volume_search_cache}),
 * the same one the volume grid of a detail page reads: Google Books writes the
 * release day there, pre-orders included; BnF and Open Library only put
 * the year there, which the calendar does nothing with. No provider
 * is called here: it is {@link MangaReleaseRefresh} that re-reads the ongoing
 * series, at night, so that announced volumes end up being there.
 *
 * <h2>Which edition</h2>
 * A series has one volume 1 per edition, and the calendar does not show
 * them all: the followed edition when there is one (the "SUIVIE" badge of the
 * detail page), otherwise the ones whose volumes are already owned, otherwise - for a series
 * only wanted - the fullest one. A volume of another edition is not
 * a release that concerns this collection.
 *
 * <h2>The relation, always written</h2>
 * Owned when the volume (edition, number) is in active ownership; wanted
 * when it is in the wishes, or when the whole series is, with nothing
 * owned; missing otherwise - this is the case that calls for an action.
 */
@Component
@RequiredArgsConstructor
public class MangaReleases implements ReleaseSource {

    /** Days and months come from Google Books; BnF only dates to the year. */
    static final String SOURCE = "GOOGLE_BOOKS";

    private static final String MANGAKA = "mangaka";
    private static final String EDITION = "edition";
    private static final String VOLUME_NUMBER = "volumeNumber";
    private static final String COVER_IMAGE_URL = "coverImageUrl";

    private final VolumeSearchCacheRepository volumeSearchCacheRepository;
    private final FollowedEditionRepository followedEditionRepository;

    @Override
    public boolean supports(EntityType entityType) {
        return "MANGA".equals(entityType.code());
    }

    @Override
    public List<ReleaseEntry> releasesBetween(ReleaseContext context) {
        List<Entity> series = context.entities();
        if (series.isEmpty()) {
            return List.of();
        }

        // The stored results of all the series, in one read; the
        // followed editions, in another.
        Set<String> normalizedTitles = series.stream()
                .map(entity -> TexteRecherche.normaliser(entity.title()))
                .collect(Collectors.toSet());
        Map<String, StoredVolumeSearch> storedByKey = volumeSearchCacheRepository
                .findAllByEntityTypeIdAndSeriesTitleIn(context.entityType().id(), normalizedTitles).stream()
                .collect(Collectors.toMap(StoredVolumeSearch::key, Function.identity(), (first, second) -> first));
        Map<UUID, String> followedEditionByEntity = followedEditionRepository
                .findByEntityIdIn(series.stream().map(Entity::id).toList()).stream()
                .collect(Collectors.toMap(FollowedEdition::entityId, FollowedEdition::editionName, (a, b) -> a));
        Map<UUID, Set<UUID>> ownedVariants = context.ownedVariantIdsByEntity();
        Map<UUID, Set<UUID>> wantedVariants = context.wantedVariantIdsByEntity();

        List<ReleaseEntry> entries = new ArrayList<>();
        for (Entity entity : series) {
            StoredVolumeSearch stored = storedByKey.get(StoredVolumeSearch.key(
                    TexteRecherche.normaliser(entity.title()), TexteRecherche.normaliser(authorOf(entity))));
            if (stored == null) {
                continue;
            }
            Map<UUID, Variant> variantsById = entity.variants().stream()
                    .collect(Collectors.toMap(Variant::id, v -> v, (a, b) -> a));
            Set<String> ownedKeys = keysOf(ownedVariants.get(entity.id()), variantsById);
            Set<String> wantedKeys = keysOf(wantedVariants.get(entity.id()), variantsById);
            Set<String> editions = editionsToShow(followedEditionByEntity.get(entity.id()),
                    ownedVariants.get(entity.id()), variantsById, stored.volumes());

            for (VolumeCandidate candidate : stored.volumes()) {
                Optional<ReleaseDate> date = ReleaseDate.parse(candidate.releaseDate())
                        .filter(d -> d.isWithin(context.from(), context.to()));
                if (date.isEmpty() || !editions.contains(TexteRecherche.normaliser(candidate.edition()))) {
                    continue;
                }
                String key = candidate.key();
                ReleaseEntry.Relation relation = ownedKeys.contains(key) ? ReleaseEntry.Relation.OWNED
                        : wantedKeys.contains(key) ? ReleaseEntry.Relation.WANTED
                        // The series is followed: a volume the user does not have is to be bought, except
                        // the one they said they want - the wish for a volume stays a state of the volume.
                        : ReleaseEntry.Relation.MISSING;
                entries.add(new ReleaseEntry(date.get(), entity.id(), entity.title(), entity.entityTypeId(),
                        "Tome " + candidate.volumeNumber() + " · " + candidate.edition(), candidate.volumeNumber(),
                        candidate.edition(), candidate.imageUrl() != null ? candidate.imageUrl() : coverOf(entity),
                        relation, SOURCE));
            }
        }
        return entries;
    }

    /** The followed edition, otherwise the ones owned, otherwise the fullest of the result - normalised. */
    private static Set<String> editionsToShow(String followedEdition, Set<UUID> ownedVariantIds,
                                              Map<UUID, Variant> variantsById, List<VolumeCandidate> candidates) {
        if (followedEdition != null && !followedEdition.isBlank()) {
            return Set.of(TexteRecherche.normaliser(followedEdition));
        }
        Set<String> owned = new HashSet<>();
        if (ownedVariantIds != null) {
            for (UUID variantId : ownedVariantIds) {
                Variant variant = variantsById.get(variantId);
                if (variant != null && volumeNumberOf(variant) != null) {
                    owned.add(TexteRecherche.normaliser(editionOf(variant)));
                }
            }
        }
        if (!owned.isEmpty()) {
            return owned;
        }
        Map<String, Integer> sizes = new HashMap<>();
        for (VolumeCandidate candidate : candidates) {
            sizes.merge(TexteRecherche.normaliser(candidate.edition()), 1, Integer::sum);
        }
        return sizes.entrySet().stream()
                .max(Map.Entry.<String, Integer>comparingByValue().thenComparing(Map.Entry.comparingByKey()))
                .map(entry -> Set.of(entry.getKey()))
                .orElse(Set.of());
    }

    /** The identity (edition, number) of the designated volumes - the same as a {@link VolumeCandidate}. */
    private static Set<String> keysOf(Set<UUID> variantIds, Map<UUID, Variant> variantsById) {
        Set<String> keys = new HashSet<>();
        if (variantIds == null) {
            return keys;
        }
        for (UUID variantId : variantIds) {
            Variant variant = variantsById.get(variantId);
            Integer number = variant == null ? null : volumeNumberOf(variant);
            if (number != null) {
                keys.add(VolumeCandidate.key(editionOf(variant), number));
            }
        }
        return keys;
    }

    private static String authorOf(Entity entity) {
        Object value = entity.attributes().get(MANGAKA);
        return value instanceof String s ? s : "";
    }

    private static String coverOf(Entity entity) {
        Object cover = entity.attributes().get(COVER_IMAGE_URL);
        return cover instanceof String url && !url.isBlank() ? url : null;
    }

    private static String editionOf(Variant variant) {
        Object value = variant.attributes().get(EDITION);
        return value instanceof String s ? s.trim() : "";
    }

    /** The attributes are an untyped bag: the number arrives as a number from one provider, as text from another. */
    private static Integer volumeNumberOf(Variant variant) {
        Object value = variant.attributes().get(VOLUME_NUMBER);
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String text) {
            try {
                return Integer.parseInt(text.trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }
}
