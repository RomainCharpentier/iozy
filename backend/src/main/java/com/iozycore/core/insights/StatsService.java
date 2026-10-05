package com.iozycore.core.insights;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.catalog.Tag;
import com.iozycore.core.domain.catalog.TagRepository;
import com.iozycore.core.domain.experience.Experience;
import com.iozycore.core.domain.experience.ExperienceRepository;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;
import com.iozycore.core.insights.CollectionProgress;

/**
 * Entry point of the Insights Bounded Context (step 8) on the statistics side -
 * pure read, never modifies Catalog/Ownership/Experience/Wishlist.
 * Consumes their repositories directly rather than domain events:
 * see StatsSummary for the justification of this pragmatic choice.
 */
@Service
public class StatsService {

    private final EntityRepository entityRepository;
    private final OwnershipRepository ownershipRepository;
    private final ExperienceRepository experienceRepository;
    private final WishlistEntryRepository wishlistEntryRepository;
    private final TagRepository tagRepository;
    private final EntityTypeRepository entityTypeRepository;
    /** The universes that know how to value what is owned (Batch 133). */
    private final List<OwnedValueSource> valueSources;

    public StatsService(List<OwnedValueSource> valueSources,
                         EntityRepository entityRepository,
                         OwnershipRepository ownershipRepository,
                         ExperienceRepository experienceRepository,
                         WishlistEntryRepository wishlistEntryRepository,
                         TagRepository tagRepository,
                         EntityTypeRepository entityTypeRepository) {
        this.entityRepository = entityRepository;
        this.ownershipRepository = ownershipRepository;
        this.experienceRepository = experienceRepository;
        this.wishlistEntryRepository = wishlistEntryRepository;
        this.tagRepository = tagRepository;
        this.entityTypeRepository = entityTypeRepository;
        this.valueSources = valueSources;
    }

    public StatsSummary computeSummary() {
        List<Ownership> allOwnerships = ownershipRepository.findAll();
        List<Experience> allExperiences = experienceRepository.findAll();
        List<Entity> allEntities = new ArrayList<>();

        List<StatsSummary.TypeStats> byType = new ArrayList<>();
        for (EntityType type : entityTypeRepository.findAll()) {
            List<Entity> entitiesOfType = entityRepository.findAllByType(type.id());
            allEntities.addAll(entitiesOfType);
            Set<UUID> entityIds = entitiesOfType.stream().map(Entity::id).collect(Collectors.toSet());

            long activeOwnershipCount = allOwnerships.stream()
                    .filter(o -> entityIds.contains(o.entityId()) && o.isActive())
                    .count();

            List<Experience> experiencesOfType = allExperiences.stream()
                    .filter(e -> entityIds.contains(e.entityId()))
                    .toList();

            Double averageRating = experiencesOfType.stream()
                    .map(Experience::rating)
                    .filter(java.util.Optional::isPresent)
                    .mapToInt(r -> r.get())
                    .average()
                    .stream().boxed().findFirst().orElse(null);

            byType.add(new StatsSummary.TypeStats(
                    type.code(), type.label(), entitiesOfType.size(), activeOwnershipCount,
                    experiencesOfType.size(), averageRating));
        }

        long totalEntities = byType.stream().mapToLong(StatsSummary.TypeStats::entityCount).sum();
        long totalActiveOwnerships = byType.stream().mapToLong(StatsSummary.TypeStats::activeOwnershipCount).sum();
        long wishlistCount = wishlistEntryRepository.findAll().size();

        int currentYear = LocalDate.now().getYear();
        long experiencesThisYear = allExperiences.stream()
                .filter(e -> e.occurredAt().getYear() == currentYear)
                .count();

        List<StatsSummary.TagCount> topTags = computeTopTags(allEntities);

        return new StatsSummary(totalEntities, totalActiveOwnerships, wishlistCount, experiencesThisYear, byType, topTags);
    }

    /**
     * "Evolution of my collection" (Statistics) - number of volumes/copies
     * added per month, from the oldest to the most recent. Counts every Ownership
     * that existed that month (including those since resold): it is the growth
     * of the collection over time that is shown, not its current state
     * (already covered by activeOwnershipCount). Counts only - no
     * purchase price field exists on Ownership, see StatsSummary.MonthlyPoint.
     */
    public List<StatsSummary.MonthlyPoint> computeTimeline() {
        Map<YearMonth, Long> byMonth = ownershipRepository.findAll().stream()
                .collect(Collectors.groupingBy(o -> YearMonth.from(o.acquiredAt()), TreeMap::new, Collectors.counting()));
        return byMonth.entrySet().stream()
                .map(entry -> new StatsSummary.MonthlyPoint(entry.getKey().toString(), entry.getValue()))
                .toList();
    }

    /**
     * "Yearly recap" (My profile) - a chosen year, counts and a heuristic
     * "most present author" only (attribute "mangaka" or
     * "studio" of the entities acquired that year) - never invented,
     * simply absent (null) if no entity acquired that year carries
     * one of these attributes. See YearlyRecap for the decision to never
     * expose this through an unauthenticated public link.
     */
    public YearlyRecap computeYearlyRecap(int year) {
        List<Ownership> allOwnerships = ownershipRepository.findAll();
        List<Integer> availableYears = allOwnerships.stream()
                .map(o -> o.acquiredAt().getYear())
                .distinct()
                .sorted(Comparator.reverseOrder())
                .toList();

        List<Ownership> ownershipsThisYear = allOwnerships.stream()
                .filter(o -> o.acquiredAt().getYear() == year)
                .toList();

        Set<UUID> entityIdsThisYear = ownershipsThisYear.stream().map(Ownership::entityId).collect(Collectors.toSet());
        // The catalog in ONE query, then restricted to the requested year.
        //
        // One read per series acquired in the year was the same N+1 as
        // the collection value - measured at 13 queries for 5 series and 25
        // for 11. Third occurrence of the finding C1 pattern, and the
        // last of this file: `computeSummary` loops over the TYPES, whose
        // number does not grow with the collection (checked, see StatsSansN1Test).
        Map<UUID, Entity> entitiesById = entityRepository.search(null, null, null).stream()
                .filter(entity -> entityIdsThisYear.contains(entity.id()))
                .collect(Collectors.toMap(Entity::id, entity -> entity));
        Map<UUID, EntityType> typesById = entityTypeRepository.findAll().stream()
                .collect(Collectors.toMap(EntityType::id, t -> t));

        Map<String, Long> acquisitionsByTypeLabel = ownershipsThisYear.stream()
                .map(o -> entitiesById.get(o.entityId()))
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(
                        e -> typesById.containsKey(e.entityTypeId()) ? typesById.get(e.entityTypeId()).label() : "?",
                        Collectors.counting()));
        List<YearlyRecap.TypeCount> acquisitionsByType = acquisitionsByTypeLabel.entrySet().stream()
                .map(e -> new YearlyRecap.TypeCount(e.getKey(), e.getValue()))
                .sorted(Comparator.comparingLong(YearlyRecap.TypeCount::count).reversed())
                .toList();

        // A series is "started" that year if its very first
        // possession (all time) falls in that year.
        Map<UUID, LocalDate> earliestAcquiredByEntity = allOwnerships.stream()
                .collect(Collectors.groupingBy(Ownership::entityId,
                        Collectors.minBy(Comparator.comparing(Ownership::acquiredAt))))
                .entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().orElseThrow().acquiredAt()));
        long seriesStartedCount = earliestAcquiredByEntity.values().stream()
                .filter(date -> date.getYear() == year)
                .count();

        List<Experience> experiencesThisYear = experienceRepository.findAll().stream()
                .filter(e -> e.occurredAt().getYear() == year)
                .toList();
        Double averageRating = experiencesThisYear.stream()
                .map(Experience::rating)
                .filter(Optional::isPresent)
                .mapToInt(r -> r.get())
                .average()
                .stream().boxed().findFirst().orElse(null);

        Map<String, Long> creatorCounts = new HashMap<>();
        for (Entity entity : entitiesById.values()) {
            Object creator = entity.attributes().get("mangaka");
            if (!(creator instanceof String creatorName) || creatorName.isBlank()) {
                creator = entity.attributes().get("studio");
            }
            if (creator instanceof String creatorName && !creatorName.isBlank()) {
                creatorCounts.merge(creatorName, 1L, Long::sum);
            }
        }
        Map.Entry<String, Long> topCreator = creatorCounts.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .orElse(null);

        return new YearlyRecap(year, ownershipsThisYear.size(), acquisitionsByType, seriesStartedCount,
                experiencesThisYear.size(), averageRating,
                topCreator != null ? topCreator.getKey() : null,
                topCreator != null ? topCreator.getValue() : 0,
                availableYears);
    }

    /**
     * "Automatic computation of the collection value" (§15 V2 of the design
     * document) - sum of the purchase prices filled in on the possessions
     * currently owned (OWNED), per type. See CollectionValue for the
     * principle of never presenting this sum as the complete real value
     * as long as all possessions do not have a price filled in.
     */
    public CollectionValue computeCollectionValue() {
        List<Ownership> activeOwnerships = ownershipRepository.findAll().stream()
                .filter(Ownership::isActive)
                .toList();

        Map<UUID, EntityType> typesById = entityTypeRepository.findAll().stream()
                .collect(Collectors.toMap(EntityType::id, t -> t));
        // The catalog in ONE query, then restricted to what is owned.
        //
        // One read per possession was one query per owned series -
        // measured at 28 queries for 5 series and 58 for 11, on the computation that
        // feeds the Profile hero. Same pattern as finding C1, fixed
        // in Batch 101 on the purchase suggestions: the grouped version already
        // existed, it was not used here.
        Set<UUID> possedees = activeOwnerships.stream().map(Ownership::entityId).collect(Collectors.toSet());
        Map<UUID, Entity> entitiesById = entityRepository.search(null, null, null).stream()
                .filter(entity -> possedees.contains(entity.id()))
                .collect(Collectors.toMap(Entity::id, entity -> entity));

        // NEW price of the edition, never the price paid (user decision of
        // 2026-08-27). What a collection is worth does not depend on what it
        // cost: a volume found second-hand at 2 EUR is worth what that volume is worth.
        // And no surface enters a purchase price anymore since adding
        // takes one click - this computation had no source at all left.
        BigDecimal totalKnownValue = BigDecimal.ZERO;
        long pricedCount = 0;
        Map<String, BigDecimal> valueByTypeLabel = new HashMap<>();
        Map<String, Long> pricedCountByTypeLabel = new HashMap<>();
        Map<String, Long> totalCountByTypeLabel = new HashMap<>();

        for (Ownership ownership : activeOwnerships) {
            Entity entity = entitiesById.get(ownership.entityId());
            String typeLabel = entity != null && typesById.containsKey(entity.entityTypeId())
                    ? typesById.get(entity.entityTypeId()).label() : "?";
            totalCountByTypeLabel.merge(typeLabel, 1L, Long::sum);
        }

        // Per EDITION and not per possession: the edition carries a new
        // price, and CollectionProgressService knows which volumes belong
        // to it - including those catalogued with no specified edition (see
        // Batch 49, where redoing this computation on its own side had already gone wrong).
        //
        // The progress of the WHOLE collection in one pass: `compute(id)`
        // per series reopened the same tables at each turn, and this is half
        // of the N+1 measured above.
        // What the new price of what we own is worth, universe by universe: the
        // manga knows the new price of an edition and the owned volumes, the
        // core only adds up per type (see OwnedValueSource).
        for (OwnedValueSource source : valueSources) {
            for (OwnedValueSource.OwnedValue valeur : source.valeurs()) {
                Entity entity = entitiesById.get(valeur.entityId());
                if (entity == null) {
                    continue;
                }
                String typeLabel = typesById.containsKey(entity.entityTypeId())
                        ? typesById.get(entity.entityTypeId()).label() : "?";
                totalKnownValue = totalKnownValue.add(valeur.valeur());
                pricedCount += valeur.unites();
                valueByTypeLabel.merge(typeLabel, valeur.valeur(), BigDecimal::add);
                pricedCountByTypeLabel.merge(typeLabel, valeur.unites(), Long::sum);
            }
        }

        List<CollectionValue.TypeValue> byType = totalCountByTypeLabel.entrySet().stream()
                .map(entry -> new CollectionValue.TypeValue(entry.getKey(),
                        valueByTypeLabel.getOrDefault(entry.getKey(), BigDecimal.ZERO),
                        pricedCountByTypeLabel.getOrDefault(entry.getKey(), 0L),
                        entry.getValue()))
                .sorted(Comparator.comparing(CollectionValue.TypeValue::knownValue).reversed())
                .toList();

        return new CollectionValue(totalKnownValue, pricedCount, activeOwnerships.size(), byType);
    }

    private List<StatsSummary.TagCount> computeTopTags(List<Entity> allEntities) {
        Map<UUID, Long> usageCounts = allEntities.stream()
                .flatMap(e -> e.tagIds().stream())
                .collect(Collectors.groupingBy(id -> id, Collectors.counting()));

        Map<UUID, String> tagLabels = new HashMap<>();
        for (Tag tag : tagRepository.findAll()) {
            tagLabels.put(tag.id(), tag.label());
        }

        return usageCounts.entrySet().stream()
                .sorted(Map.Entry.<UUID, Long>comparingByValue().reversed())
                .limit(5)
                .map(entry -> new StatsSummary.TagCount(tagLabels.getOrDefault(entry.getKey(), "?"), entry.getValue()))
                .collect(Collectors.toList());
    }
}
