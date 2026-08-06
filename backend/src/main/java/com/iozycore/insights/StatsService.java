package com.iozycore.insights;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.domain.catalog.EntityTypeRepository;
import com.iozycore.domain.catalog.Tag;
import com.iozycore.domain.catalog.TagRepository;
import com.iozycore.domain.experience.Experience;
import com.iozycore.domain.experience.ExperienceRepository;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.wishlist.WishlistEntryRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Point d'entrée du Bounded Context Insights (étape 8) côté statistiques -
 * lecture pure, ne modifie jamais Catalog/Ownership/Experience/Wishlist.
 * Consomme leurs repositories directement plutôt que des domain events :
 * voir StatsSummary pour la justification de ce choix pragmatique.
 */
@Service
public class StatsService {

    private final EntityRepository entityRepository;
    private final OwnershipRepository ownershipRepository;
    private final ExperienceRepository experienceRepository;
    private final WishlistEntryRepository wishlistEntryRepository;
    private final TagRepository tagRepository;
    private final EntityTypeRepository entityTypeRepository;

    public StatsService(EntityRepository entityRepository,
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
