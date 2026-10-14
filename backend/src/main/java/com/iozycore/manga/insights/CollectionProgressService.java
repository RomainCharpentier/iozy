package com.iozycore.manga.insights;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;
import com.iozycore.core.insights.CollectionProgress;
import com.iozycore.core.insights.SeriesProgressSource;

/**
 * SINGLE SOURCE OF TRUTH for the progression "X volumes owned out of Y".
 * <p>
 * This question used to be recomputed by four independent
 * implementations - the tile of Ma collection, the work page, the suggestions
 * engine and the public page - which did not agree (audit of
 * 2026-08-21, see docs/DESIGN_MIGRATION_V1.2.md, Batch 31): the same series
 * showed 3/72 in one place and 2/72 in another, another lost
 * its total completely. Any new surface that shows a progression
 * must go through here, never recompute.
 * <p>
 * Pure read, cross-context (Catalog + Ownership), same convention as
 * {@link StatsService}: uses the repositories directly, writes nothing.
 *
 * <h2>The rules, in one place</h2>
 * <ol>
 *   <li>The groups come from the CATALOGUED Variant objects, grouped by their
 *       {@code edition} attribute, split (a volume without edition joins the
 *       {@code ""} group).</li>
 *   <li><b>Merge</b>: if there is exactly ONE named edition and a group
 *       of volumes without a specified edition, the latter join the former -
 *       it is almost always a volume added by hand without retyping a name
 *       already known, not a second edition. As soon as there are 2+ named
 *       editions, the ambiguity is real: nothing is merged.</li>
 *   <li>Owned is measured on ACTIVE Ownership objects only (a volume
 *       resold or lost is no longer owned), by DISTINCT volume number:
 *       two copies of the same volume do not make "2 volumes owned".</li>
 *   <li>The total comes from the MangaEdition page of this precise edition,
 *       never from an attribute of the series (see Batch 16).</li>
 *   <li>The <b>dominant</b> edition - the one that a single-line view must
 *       name - is the only group that contains owned volumes. Zero or
 *       several owned groups: no dominant one, the progression is
 *       genuinely ambiguous and must not be decided arbitrarily.</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
public class CollectionProgressService implements SeriesProgressSource {

    private static final String EDITION = "edition";
    private static final String VOLUME_NUMBER = "volumeNumber";

    private final EntityRepository entityRepository;
    private final OwnershipRepository ownershipRepository;
    private final MangaEditionRepository mangaEditionRepository;

    /** Progression of all the works - a single pass over the Ownership objects, so that
     * Ma collection does not have to make one query per series. */
    @Override
    public List<CollectionProgress> computeAll() {
        Map<UUID, List<Ownership>> activeByEntity = ownershipRepository.findAll().stream()
                .filter(Ownership::isActive)
                .collect(Collectors.groupingBy(Ownership::entityId));
        // All the editions in ONE query rather than one per edition group
        // and per work: on a collection of 500 series, this was ~1000 round trips
        // to the database for a single display of Ma collection.
        Map<String, Integer> totalsByEntityAndEdition = indexEditionTotals();
        return entityRepository.search(null, null, null).stream()
                .map(entity -> compute(entity, activeByEntity.getOrDefault(entity.id(), List.of()),
                        totalsByEntityAndEdition))
                .collect(Collectors.toList());
    }

    private Map<String, Integer> indexEditionTotals() {
        Map<String, Integer> totals = new LinkedHashMap<>();
        for (MangaEdition edition : mangaEditionRepository.findAll()) {
            if (edition.entityId() != null && edition.totalVolumes() != null) {
                totals.put(CollectionProgress.editionKey(edition.entityId(), edition.editionName()), edition.totalVolumes());
            }
        }
        return totals;
    }

    /** Progression of a specific work - {@link Optional#empty()} if it does not exist. */
    @Override
    public Optional<CollectionProgress> compute(UUID entityId) {
        return entityRepository.findById(entityId)
                .map(entity -> compute(entity, ownershipRepository.findByEntityId(entityId).stream()
                        .filter(Ownership::isActive)
                        .collect(Collectors.toList()), indexEditionTotals()));
    }

    private CollectionProgress compute(Entity entity, List<Ownership> activeOwnerships,
                                        Map<String, Integer> totalsByEntityAndEdition) {
        Map<String, List<String>> groups = displayGroups(entity);
        Map<UUID, Variant> variantsById = entity.variants().stream()
                .collect(Collectors.toMap(Variant::id, v -> v, (a, b) -> a));

        List<CollectionProgress.EditionProgress> editions = new ArrayList<>();
        TreeSet<Integer> allOwned = new TreeSet<>();
        for (Map.Entry<String, List<String>> group : groups.entrySet()) {
            String editionName = group.getKey();
            List<String> sourceEditions = group.getValue();

            TreeSet<Integer> catalogued = new TreeSet<>();
            for (Variant variant : entity.variants()) {
                if (sourceEditions.contains(editionOf(variant))) {
                    Integer number = volumeNumberOf(variant);
                    if (number != null) {
                        catalogued.add(number);
                    }
                }
            }

            TreeSet<Integer> owned = new TreeSet<>();
            for (Ownership ownership : activeOwnerships) {
                Variant variant = ownership.variantId().map(variantsById::get).orElse(null);
                if (variant == null || !sourceEditions.contains(editionOf(variant))) {
                    continue;
                }
                Integer number = volumeNumberOf(variant);
                if (number != null) {
                    owned.add(number);
                }
            }
            allOwned.addAll(owned);

            editions.add(new CollectionProgress.EditionProgress(editionName, sourceEditions,
                    List.copyOf(owned), List.copyOf(catalogued),
                    editionName.isEmpty() ? null : totalsByEntityAndEdition.get(CollectionProgress.editionKey(entity.id(), editionName))));
        }

        // Stable and useful order: the fullest edition first (same rule
        // as the old groupVariantsByEdition on the web side).
        editions.sort(Comparator.comparingInt((CollectionProgress.EditionProgress e) -> e.cataloguedVolumeNumbers().size())
                .reversed());

        List<CollectionProgress.EditionProgress> withOwned = editions.stream()
                .filter(e -> e.ownedCount() > 0)
                .toList();
        CollectionProgress.EditionProgress dominant = withOwned.size() == 1 ? withOwned.get(0) : null;

        return new CollectionProgress(entity.id(), entity.title(), List.copyOf(editions), dominant, allOwned.size());
    }

    /**
     * Displayable groups: edition name -> raw values it covers.
     * Applies the merge rule described at the top of the class.
     */
    private static Map<String, List<String>> displayGroups(Entity entity) {
        Map<String, Boolean> present = new LinkedHashMap<>();
        for (Variant variant : entity.variants()) {
            if (volumeNumberOf(variant) == null) {
                continue;
            }
            present.putIfAbsent(editionOf(variant), Boolean.TRUE);
        }
        List<String> named = present.keySet().stream().filter(name -> !name.isEmpty()).toList();
        boolean hasBlank = present.containsKey("");

        Map<String, List<String>> groups = new LinkedHashMap<>();
        if (named.size() == 1 && hasBlank) {
            groups.put(named.get(0), List.of(named.get(0), ""));
            return groups;
        }
        for (String name : present.keySet()) {
            groups.put(name, List.of(name));
        }
        return groups;
    }


    private static String editionOf(Variant variant) {
        Object value = variant.attributes().get(EDITION);
        return value instanceof String s ? s.trim() : "";
    }

    /** The attributes are an untyped bag: the same field can arrive as an Integer from one
     * provider and as a String from another (see PublicShareController). */
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
