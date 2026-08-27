package com.iozycore.insights;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.MangaEdition;
import com.iozycore.domain.catalog.MangaEditionRepository;
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
    private final MangaEditionRepository mangaEditionRepository;
    private final CollectionProgressService progressService;

    public StatsService(MangaEditionRepository mangaEditionRepository,
                         CollectionProgressService progressService,
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
        this.mangaEditionRepository = mangaEditionRepository;
        this.progressService = progressService;
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
     * "Évolution de ma collection" (Statistiques) - nombre de tomes/exemplaires
     * ajoutés par mois, du plus ancien au plus récent. Compte tout Ownership
     * ayant existé ce mois-là (y compris depuis revendu) : c'est la croissance
     * de la collection au fil du temps qui est montrée, pas son état actuel
     * (déjà couvert par activeOwnershipCount). Comptages uniquement - aucun
     * champ de prix d'achat n'existe sur Ownership, voir StatsSummary.MonthlyPoint.
     */
    public List<StatsSummary.MonthlyPoint> computeTimeline() {
        Map<YearMonth, Long> byMonth = ownershipRepository.findAll().stream()
                .collect(Collectors.groupingBy(o -> YearMonth.from(o.acquiredAt()), TreeMap::new, Collectors.counting()));
        return byMonth.entrySet().stream()
                .map(entry -> new StatsSummary.MonthlyPoint(entry.getKey().toString(), entry.getValue()))
                .toList();
    }

    /**
     * "Bilan annuel" (Mon profil) - une année choisie, comptages et un
     * "auteur le plus présent" heuristique uniquement (attribut "mangaka" ou
     * "studio" des entités acquises cette année-là) - jamais inventé,
     * simplement absent (null) si aucune entité acquise cette année ne porte
     * l'un de ces attributs. Voir YearlyRecap pour la décision de ne jamais
     * exposer ça via un lien public non authentifié.
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
        Map<UUID, Entity> entitiesById = new HashMap<>();
        for (UUID entityId : entityIdsThisYear) {
            entityRepository.findById(entityId).ifPresent(e -> entitiesById.put(entityId, e));
        }
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

        // Une série est "commencée" cette année-là si sa toute première
        // possession (tous temps confondus) tombe dans cette année.
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
     * "Calcul automatique de la valeur de la collection" (§15 V2 du document
     * de conception) - somme des prix d'achat renseignés sur les possessions
     * actuellement possédées (OWNED), par type. Voir CollectionValue pour le
     * principe de ne jamais présenter cette somme comme la valeur réelle
     * complète tant que toutes les possessions n'ont pas un prix renseigné.
     */
    public CollectionValue computeCollectionValue() {
        List<Ownership> activeOwnerships = ownershipRepository.findAll().stream()
                .filter(Ownership::isActive)
                .toList();

        Map<UUID, EntityType> typesById = entityTypeRepository.findAll().stream()
                .collect(Collectors.toMap(EntityType::id, t -> t));
        Map<UUID, Entity> entitiesById = new HashMap<>();
        for (Ownership ownership : activeOwnerships) {
            entitiesById.computeIfAbsent(ownership.entityId(), id -> entityRepository.findById(id).orElse(null));
        }

        // Prix NEUF de l'édition, jamais le prix payé (décision utilisateur du
        // 2026-08-27). Ce que vaut une collection ne dépend pas de ce qu'elle a
        // coûté : un tome trouvé d'occasion à 2 € vaut ce que vaut ce tome.
        // Et plus aucune surface ne saisit de prix d'achat depuis que l'ajout
        // tient en un clic - ce calcul-là n'avait plus de source du tout.
        Map<String, BigDecimal> prixNeufParEdition = new HashMap<>();
        for (MangaEdition edition : mangaEditionRepository.findAll()) {
            if (edition.entityId() != null && edition.retailPriceNewPerVolume() != null) {
                prixNeufParEdition.put(CollectionProgressService.editionKey(edition.entityId(), edition.editionName()),
                        edition.retailPriceNewPerVolume());
            }
        }

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

        // Par ÉDITION et non par possession : c'est l'édition qui porte un prix
        // neuf, et c'est CollectionProgressService qui sait quels tomes lui
        // appartiennent - y compris ceux catalogués sans édition précisée (voir
        // Lot 49, où refaire ce calcul de son côté avait déjà mal tourné).
        for (Entity entity : entitiesById.values()) {
            if (entity == null) {
                continue;
            }
            String typeLabel = typesById.containsKey(entity.entityTypeId())
                    ? typesById.get(entity.entityTypeId()).label() : "?";
            for (CollectionProgress.EditionProgress groupe : progressService.compute(entity.id())
                    .map(CollectionProgress::editions).orElse(List.of())) {
                BigDecimal prixNeuf = prixNeufParEdition.get(CollectionProgressService.editionKey(entity.id(), groupe.editionName()));
                if (prixNeuf == null || groupe.ownedVolumeNumbers().isEmpty()) {
                    continue;
                }
                long tomes = groupe.ownedVolumeNumbers().size();
                BigDecimal valeur = prixNeuf.multiply(BigDecimal.valueOf(tomes));
                totalKnownValue = totalKnownValue.add(valeur);
                pricedCount += tomes;
                valueByTypeLabel.merge(typeLabel, valeur, BigDecimal::add);
                pricedCountByTypeLabel.merge(typeLabel, tomes, Long::sum);
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
