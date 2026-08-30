package com.iozycore.insights;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.MangaEdition;
import com.iozycore.domain.catalog.MangaEditionRepository;
import com.iozycore.domain.catalog.EditionTier;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.domain.catalog.EntityTypeFixtures;
import com.iozycore.domain.catalog.EntityTypeRepository;
import com.iozycore.domain.catalog.Tag;
import com.iozycore.domain.catalog.TagRepository;
import com.iozycore.domain.experience.Experience;
import com.iozycore.domain.experience.ExperienceRepository;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.wishlist.WishlistEntry;
import com.iozycore.domain.wishlist.WishlistEntryRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class StatsServiceTest {

    @Test
    void computes_entity_ownership_and_experience_counts_per_type() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryOwnershipRepository ownershipRepository = new InMemoryOwnershipRepository();
        InMemoryExperienceRepository experienceRepository = new InMemoryExperienceRepository();
        InMemoryWishlistEntryRepository wishlistEntryRepository = new InMemoryWishlistEntryRepository();
        InMemoryTagRepository tagRepository = new InMemoryTagRepository();
        InMemoryEntityTypeRepository entityTypeRepository = new InMemoryEntityTypeRepository();

        Entity deathNote = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        Tag seinen = new Tag(UUID.randomUUID(), "seinen");
        deathNote.addTag(seinen.id());
        tagRepository.save(seinen);
        entityRepository.save(deathNote);

        Entity hollowKnight = Entity.create(EntityTypeFixtures.VIDEO_GAME.id(), "Hollow Knight");
        entityRepository.save(hollowKnight);

        ownershipRepository.save(Ownership.acquire(deathNote.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));
        Ownership soldOwnership = Ownership.acquire(hollowKnight.id(), null, OwnershipCondition.USED, LocalDate.now(), null);
        soldOwnership.markSold();
        ownershipRepository.save(soldOwnership);

        experienceRepository.save(Experience.record_(deathNote.id(), null, "READ", LocalDate.now(), 9, null));
        experienceRepository.save(Experience.record_(deathNote.id(), null, "READ", LocalDate.now(), 7, null));

        wishlistEntryRepository.save(WishlistEntry.add(UUID.randomUUID(), LocalDate.now()));

        InMemoryMangaEditionRepository editionRepository = new InMemoryMangaEditionRepository();
        StatsService statsService = new StatsService(
                editionRepository,
                new CollectionProgressService(entityRepository, ownershipRepository, editionRepository),
                entityRepository, ownershipRepository, experienceRepository, wishlistEntryRepository, tagRepository,
                entityTypeRepository);

        StatsSummary summary = statsService.computeSummary();

        assertThat(summary.totalEntities()).isEqualTo(2);
        assertThat(summary.totalActiveOwnerships()).isEqualTo(1); // Hollow Knight vendue, ne compte plus
        assertThat(summary.wishlistCount()).isEqualTo(1);
        assertThat(summary.experiencesThisYear()).isEqualTo(2);

        StatsSummary.TypeStats mangaStats = summary.byType().stream()
                .filter(s -> s.entityTypeCode().equals("MANGA")).findFirst().orElseThrow();
        assertThat(mangaStats.entityCount()).isEqualTo(1);
        assertThat(mangaStats.experienceCount()).isEqualTo(2);
        assertThat(mangaStats.averageRating()).isEqualTo(8.0); // (9+7)/2

        StatsSummary.TypeStats videoGameStats = summary.byType().stream()
                .filter(s -> s.entityTypeCode().equals("VIDEO_GAME")).findFirst().orElseThrow();
        assertThat(videoGameStats.activeOwnershipCount()).isEqualTo(0);
        assertThat(videoGameStats.averageRating()).isNull(); // aucune expérience notée

        assertThat(summary.topTags()).hasSize(1);
        assertThat(summary.topTags().get(0).label()).isEqualTo("seinen");
        assertThat(summary.topTags().get(0).count()).isEqualTo(1);
    }

    @Test
    void computes_a_monthly_timeline_of_tomes_added_sorted_from_oldest_to_newest() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryOwnershipRepository ownershipRepository = new InMemoryOwnershipRepository();
        InMemoryExperienceRepository experienceRepository = new InMemoryExperienceRepository();
        InMemoryWishlistEntryRepository wishlistEntryRepository = new InMemoryWishlistEntryRepository();
        InMemoryTagRepository tagRepository = new InMemoryTagRepository();
        InMemoryEntityTypeRepository entityTypeRepository = new InMemoryEntityTypeRepository();

        Entity deathNote = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        entityRepository.save(deathNote);

        ownershipRepository.save(Ownership.acquire(deathNote.id(), null, OwnershipCondition.NEW,
                LocalDate.of(2026, 1, 15), null));
        ownershipRepository.save(Ownership.acquire(deathNote.id(), null, OwnershipCondition.NEW,
                LocalDate.of(2026, 1, 20), null));
        Ownership soldButStillCountedTowardsHistoricalGrowth = Ownership.acquire(deathNote.id(), null,
                OwnershipCondition.USED, LocalDate.of(2026, 3, 1), null);
        soldButStillCountedTowardsHistoricalGrowth.markSold();
        ownershipRepository.save(soldButStillCountedTowardsHistoricalGrowth);

        InMemoryMangaEditionRepository editionRepository = new InMemoryMangaEditionRepository();
        StatsService statsService = new StatsService(
                editionRepository,
                new CollectionProgressService(entityRepository, ownershipRepository, editionRepository),
                entityRepository, ownershipRepository, experienceRepository, wishlistEntryRepository, tagRepository,
                entityTypeRepository);

        List<StatsSummary.MonthlyPoint> timeline = statsService.computeTimeline();

        assertThat(timeline).containsExactly(
                new StatsSummary.MonthlyPoint("2026-01", 2),
                new StatsSummary.MonthlyPoint("2026-03", 1));
    }

    @Test
    void computes_a_yearly_recap_with_counts_series_started_and_most_featured_creator() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryOwnershipRepository ownershipRepository = new InMemoryOwnershipRepository();
        InMemoryExperienceRepository experienceRepository = new InMemoryExperienceRepository();
        InMemoryWishlistEntryRepository wishlistEntryRepository = new InMemoryWishlistEntryRepository();
        InMemoryTagRepository tagRepository = new InMemoryTagRepository();
        InMemoryEntityTypeRepository entityTypeRepository = new InMemoryEntityTypeRepository();

        Entity deathNote = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        deathNote.setAttribute("mangaka", "Takeshi Obata");
        entityRepository.save(deathNote);
        Entity bakuman = Entity.create(EntityTypeFixtures.MANGA.id(), "Bakuman");
        bakuman.setAttribute("mangaka", "Takeshi Obata");
        entityRepository.save(bakuman);
        Entity hollowKnight = Entity.create(EntityTypeFixtures.VIDEO_GAME.id(), "Hollow Knight");
        entityRepository.save(hollowKnight);

        // Death Note : premier tome en 2025 (série pas "commencée" en 2026), un second tome en 2026.
        ownershipRepository.save(Ownership.acquire(deathNote.id(), null, OwnershipCondition.NEW,
                LocalDate.of(2025, 12, 1), null));
        ownershipRepository.save(Ownership.acquire(deathNote.id(), null, OwnershipCondition.NEW,
                LocalDate.of(2026, 2, 1), null));
        // Bakuman et Hollow Knight : toutes les deux acquises pour la première fois en 2026.
        ownershipRepository.save(Ownership.acquire(bakuman.id(), null, OwnershipCondition.NEW,
                LocalDate.of(2026, 3, 1), null));
        ownershipRepository.save(Ownership.acquire(hollowKnight.id(), null, OwnershipCondition.NEW,
                LocalDate.of(2026, 5, 1), null));

        experienceRepository.save(Experience.record_(deathNote.id(), null, "READ", LocalDate.of(2026, 2, 10), 9, null));
        experienceRepository.save(Experience.record_(deathNote.id(), null, "READ", LocalDate.of(2025, 1, 1), 5, null));

        InMemoryMangaEditionRepository editionRepository = new InMemoryMangaEditionRepository();
        StatsService statsService = new StatsService(
                editionRepository,
                new CollectionProgressService(entityRepository, ownershipRepository, editionRepository),
                entityRepository, ownershipRepository, experienceRepository, wishlistEntryRepository, tagRepository,
                entityTypeRepository);

        YearlyRecap recap = statsService.computeYearlyRecap(2026);

        assertThat(recap.year()).isEqualTo(2026);
        assertThat(recap.acquisitionsCount()).isEqualTo(3); // Death Note tome 2 + Bakuman + Hollow Knight
        assertThat(recap.seriesStartedCount()).isEqualTo(2); // Bakuman + Hollow Knight, pas Death Note
        assertThat(recap.experiencesCount()).isEqualTo(1);
        assertThat(recap.averageRating()).isEqualTo(9.0);
        assertThat(recap.mostFeaturedCreator()).isEqualTo("Takeshi Obata");
        assertThat(recap.mostFeaturedCreatorCount()).isEqualTo(2);
        assertThat(recap.availableYears()).containsExactly(2026, 2025);
    }

    @Test
    void a_year_without_any_acquisition_reports_zeros_rather_than_an_error() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryOwnershipRepository ownershipRepository = new InMemoryOwnershipRepository();
        InMemoryExperienceRepository experienceRepository = new InMemoryExperienceRepository();
        InMemoryWishlistEntryRepository wishlistEntryRepository = new InMemoryWishlistEntryRepository();
        InMemoryTagRepository tagRepository = new InMemoryTagRepository();
        InMemoryEntityTypeRepository entityTypeRepository = new InMemoryEntityTypeRepository();

        InMemoryMangaEditionRepository editionRepository = new InMemoryMangaEditionRepository();
        StatsService statsService = new StatsService(
                editionRepository,
                new CollectionProgressService(entityRepository, ownershipRepository, editionRepository),
                entityRepository, ownershipRepository, experienceRepository, wishlistEntryRepository, tagRepository,
                entityTypeRepository);

        YearlyRecap recap = statsService.computeYearlyRecap(2020);

        assertThat(recap.acquisitionsCount()).isZero();
        assertThat(recap.seriesStartedCount()).isZero();
        assertThat(recap.mostFeaturedCreator()).isNull();
        assertThat(recap.averageRating()).isNull();
        assertThat(recap.availableYears()).isEmpty();
    }

    @Test
    void collection_value_sums_only_priced_active_ownerships_and_tracks_coverage() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryOwnershipRepository ownershipRepository = new InMemoryOwnershipRepository();
        InMemoryExperienceRepository experienceRepository = new InMemoryExperienceRepository();
        InMemoryWishlistEntryRepository wishlistEntryRepository = new InMemoryWishlistEntryRepository();
        InMemoryTagRepository tagRepository = new InMemoryTagRepository();
        InMemoryEntityTypeRepository entityTypeRepository = new InMemoryEntityTypeRepository();

        // Une série à DEUX tomes possédés, dans une édition dont le prix neuf est
        // connu : c'est lui qui fait la valeur, pas ce qu'on a payé.
        Entity deathNote = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        deathNote.addVariant("Tome 1 — Black Édition", Map.of("volumeNumber", 1, "edition", "Black Édition"));
        deathNote.addVariant("Tome 2 — Black Édition", Map.of("volumeNumber", 2, "edition", "Black Édition"));
        entityRepository.save(deathNote);
        Entity hollowKnight = Entity.create(EntityTypeFixtures.VIDEO_GAME.id(), "Hollow Knight");
        entityRepository.save(hollowKnight);

        InMemoryMangaEditionRepository editionRepository = new InMemoryMangaEditionRepository();
        editionRepository.save(MangaEdition.create(deathNote.id(), "Death Note", "Black Édition",
                EditionTier.INTEGRAL, "Kana", 6, new BigDecimal("14.90"), false, false, null));

        // Le prix PAYÉ est volontairement absurde : il ne doit entrer dans aucun
        // total. Ce que vaut la collection ne dépend pas de ce qu'elle a coûté.
        Ownership tome1 = Ownership.acquire(deathNote.id(),
                deathNote.findVariantByLabel("Tome 1 — Black Édition").orElseThrow().id(),
                OwnershipCondition.NEW, LocalDate.now(), null);
        tome1.updatePurchasePrice(new BigDecimal("2.00"));
        ownershipRepository.save(tome1);
        ownershipRepository.save(Ownership.acquire(deathNote.id(),
                deathNote.findVariantByLabel("Tome 2 — Black Édition").orElseThrow().id(),
                OwnershipCondition.NEW, LocalDate.now(), null));

        // Aucune source de prix neuf pour un jeu : il compte dans le total des
        // possessions, jamais dans la valeur connue.
        ownershipRepository.save(Ownership.acquire(hollowKnight.id(), null,
                OwnershipCondition.NEW, LocalDate.now(), null));

        // Vendue : hors de tous les totaux.
        Ownership sold = Ownership.acquire(hollowKnight.id(), null, OwnershipCondition.NEW, LocalDate.now(), null);
        sold.markSold();
        ownershipRepository.save(sold);

        StatsService statsService = new StatsService(
                editionRepository,
                new CollectionProgressService(entityRepository, ownershipRepository, editionRepository),
                entityRepository, ownershipRepository, experienceRepository, wishlistEntryRepository, tagRepository,
                entityTypeRepository);

        CollectionValue value = statsService.computeCollectionValue();

        // 2 tomes x 14,90 - et surtout pas les 2,00 payés.
        assertThat(value.totalKnownValue()).isEqualByComparingTo(new BigDecimal("29.80"));
        assertThat(value.pricedOwnershipCount()).isEqualTo(2);
        assertThat(value.totalActiveOwnershipCount()).isEqualTo(3); // le jeu vendu est exclu

        CollectionValue.TypeValue mangaValue = value.byType().stream()
                .filter(t -> t.entityTypeLabel().equals("Manga")).findFirst().orElseThrow();
        assertThat(mangaValue.knownValue()).isEqualByComparingTo(new BigDecimal("29.80"));
        assertThat(mangaValue.pricedCount()).isEqualTo(2);
        assertThat(mangaValue.totalCount()).isEqualTo(2);

        CollectionValue.TypeValue jeuValue = value.byType().stream()
                .filter(t -> t.entityTypeLabel().equals("Jeu vidéo")).findFirst().orElseThrow();
        assertThat(jeuValue.knownValue()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(jeuValue.pricedCount()).isZero();
    }

    private static class InMemoryEntityRepository implements EntityRepository {
        private final Map<UUID, Entity> store = new HashMap<>();

        @Override
        public Entity save(Entity entity) {
            store.put(entity.id(), entity);
            return entity;
        }

        @Override
        public Optional<Entity> findById(UUID id) {
            return Optional.ofNullable(store.get(id));
        }

        @Override
        public Optional<Entity> findByTypeAndTitle(UUID entityTypeId, String title) {
            return store.values().stream()
                    .filter(e -> e.entityTypeId().equals(entityTypeId) && e.title().equalsIgnoreCase(title))
                    .findFirst();
        }

        @Override
        public List<Entity> findAllByType(UUID entityTypeId) {
            List<Entity> result = new ArrayList<>();
            for (Entity entity : store.values()) {
                if (entity.entityTypeId().equals(entityTypeId)) {
                    result.add(entity);
                }
            }
            return result;
        }

        @Override
        public List<Entity> search(String titleQuery, UUID entityTypeId, UUID tagId) {
            // Rendait List.of() avec le commentaire « non exercé par ce test ».
            // Ça a cessé d'être vrai le jour où la valeur de la collection a
            // arrêté de lire les œuvres une par une (Lot 113) : le test a
            // annoncé 0 € pour une collection qui en vaut 29,80. Un faux
            // dépôt qui ment sur une méthode ne se signale que le jour où
            // quelqu'un l'appelle.
            return store.values().stream()
                    .filter(e -> titleQuery == null
                            || e.title().toLowerCase().contains(titleQuery.toLowerCase()))
                    .filter(e -> entityTypeId == null || entityTypeId.equals(e.entityTypeId()))
                    .filter(e -> tagId == null || e.tagIds().contains(tagId))
                    .toList();
        }

        @Override
        public boolean existsByType(UUID entityTypeId) {
            return store.values().stream().anyMatch(e -> e.entityTypeId().equals(entityTypeId));
        }

        @Override
        public void deleteById(UUID id) {
            store.remove(id);
        }
    }

    /** Seedé avec les fixtures MANGA/VIDEO_GAME - les 2 types exercés par ce test. */
    private static class InMemoryEntityTypeRepository implements EntityTypeRepository {
        private final Map<UUID, EntityType> store = new HashMap<>(Map.of(
                EntityTypeFixtures.MANGA.id(), EntityTypeFixtures.MANGA,
                EntityTypeFixtures.VIDEO_GAME.id(), EntityTypeFixtures.VIDEO_GAME));

        @Override
        public EntityType save(EntityType entityType) {
            store.put(entityType.id(), entityType);
            return entityType;
        }

        @Override
        public Optional<EntityType> findById(UUID id) {
            return Optional.ofNullable(store.get(id));
        }

        @Override
        public Optional<EntityType> findByCode(String code) {
            return store.values().stream().filter(t -> t.code().equals(code)).findFirst();
        }

        @Override
        public List<EntityType> findAll() {
            return List.copyOf(store.values());
        }

        @Override
        public void deleteById(UUID id) {
            store.remove(id);
        }
    }

    private static class InMemoryOwnershipRepository implements OwnershipRepository {
        private final Map<UUID, Ownership> store = new HashMap<>();

        @Override
        public Ownership save(Ownership ownership) {
            store.put(ownership.id(), ownership);
            return ownership;
        }

        @Override
        public Optional<Ownership> findById(UUID id) {
            return Optional.ofNullable(store.get(id));
        }

        @Override
        public List<Ownership> findByEntityId(UUID entityId) {
            return store.values().stream().filter(o -> o.entityId().equals(entityId)).toList();
        }

        @Override
        public boolean existsByEntityId(UUID entityId) {
            return !findByEntityId(entityId).isEmpty();
        }

        @Override
        public List<Ownership> findAll() {
            return new ArrayList<>(store.values());
        }

        @Override
        public void deleteById(UUID id) {
            store.remove(id);
        }
    }

    private static class InMemoryExperienceRepository implements ExperienceRepository {
        private final Map<UUID, Experience> store = new HashMap<>();

        @Override
        public Experience save(Experience experience) {
            store.put(experience.id(), experience);
            return experience;
        }

        @Override
        public Optional<Experience> findById(UUID id) {
            return Optional.ofNullable(store.get(id));
        }

        @Override
        public List<Experience> findByEntityId(UUID entityId) {
            return store.values().stream().filter(e -> e.entityId().equals(entityId)).toList();
        }

        @Override
        public void deleteById(UUID id) {
            store.remove(id);
        }

        @Override
        public boolean existsByEntityId(UUID entityId) {
            return !findByEntityId(entityId).isEmpty();
        }

        @Override
        public List<Experience> findAll() {
            return new ArrayList<>(store.values());
        }
    }

    private static class InMemoryWishlistEntryRepository implements WishlistEntryRepository {
        private final Map<UUID, WishlistEntry> store = new HashMap<>();

        @Override
        public WishlistEntry save(WishlistEntry entry) {
            store.put(entry.id(), entry);
            return entry;
        }

        @Override
        public Optional<WishlistEntry> findByEntityId(UUID entityId) {
            return store.values().stream().filter(e -> e.entityId().equals(entityId)).findFirst();
        }

        @Override
        public List<WishlistEntry> findAll() {
            return new ArrayList<>(store.values());
        }

        @Override
        public Optional<WishlistEntry> findByVariantId(UUID variantId) {
            return store.values().stream()
                    .filter(e -> e.variantId().map(variantId::equals).orElse(false))
                    .findFirst();
        }

        @Override
        public List<WishlistEntry> findAllByEntityId(UUID entityId) {
            return store.values().stream().filter(e -> e.entityId().equals(entityId)).toList();
        }

        @Override
        public void deleteById(UUID id) {
            store.remove(id);
        }
    }

    private static class InMemoryTagRepository implements TagRepository {
        private final Map<UUID, Tag> store = new HashMap<>();

        @Override
        public Tag save(Tag tag) {
            store.put(tag.id(), tag);
            return tag;
        }

        @Override
        public Optional<Tag> findById(UUID id) {
            return Optional.ofNullable(store.get(id));
        }

        @Override
        public Optional<Tag> findByLabel(String label) {
            return store.values().stream().filter(t -> t.label().equals(label)).findFirst();
        }

        @Override
        public List<Tag> findAll() {
            return new ArrayList<>(store.values());
        }

        @Override
        public void supprimer(UUID id) {
            store.remove(id);
        }
    }

    private static class InMemoryMangaEditionRepository implements MangaEditionRepository {
        private final Map<UUID, MangaEdition> store = new HashMap<>();

        @Override
        public MangaEdition save(MangaEdition edition) {
            store.put(edition.id(), edition);
            return edition;
        }

        @Override
        public Optional<MangaEdition> findById(UUID id) {
            return Optional.ofNullable(store.get(id));
        }

        @Override
        public Optional<MangaEdition> findBySeriesAndEdition(String seriesTitle, String editionName) {
            return store.values().stream()
                    .filter(e -> e.seriesTitle().equalsIgnoreCase(seriesTitle)
                            && e.editionName().equalsIgnoreCase(editionName))
                    .findFirst();
        }

        @Override
        public List<MangaEdition> findBySeriesTitle(String seriesTitle) {
            return store.values().stream().filter(e -> e.seriesTitle().equalsIgnoreCase(seriesTitle)).toList();
        }

        @Override
        public List<MangaEdition> findByEntityId(UUID entityId) {
            return store.values().stream().filter(e -> entityId.equals(e.entityId())).toList();
        }

        @Override
        public List<MangaEdition> findAll() {
            return new ArrayList<>(store.values());
        }

        @Override
        public Optional<MangaEdition> findByEntityIdAndEditionName(UUID entityId, String editionName) {
            return store.values().stream()
                    .filter(e -> entityId.equals(e.entityId()) && e.editionName().equalsIgnoreCase(editionName))
                    .findFirst();
        }

        @Override
        public void deleteById(UUID id) {
            store.remove(id);
        }
    }
}
