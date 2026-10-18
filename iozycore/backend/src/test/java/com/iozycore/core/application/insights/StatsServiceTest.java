package com.iozycore.core.application.insights;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.EditionTier;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.catalog.Tag;
import com.iozycore.core.domain.experience.Experience;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import org.junit.jupiter.api.Test;
import com.iozycore.core.testing.InMemoryEntityRepository;
import com.iozycore.core.testing.InMemoryEntityTypeRepository;
import com.iozycore.core.testing.InMemoryExperienceRepository;
import com.iozycore.core.testing.InMemoryOwnershipRepository;
import com.iozycore.core.testing.InMemoryTagRepository;
import com.iozycore.core.testing.InMemoryWishlistEntryRepository;
import com.iozycore.manga.testing.InMemoryMangaEditionRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import com.iozycore.manga.insights.CollectionProgressService;
import com.iozycore.manga.MangaOwnedValueSource;
import com.iozycore.core.domain.insights.CollectionValue;
import com.iozycore.core.domain.insights.StatsSummary;
import com.iozycore.core.domain.insights.YearlyRecap;

class StatsServiceTest {

    @Test
    void computes_entity_ownership_and_experience_counts_per_type() {
        InMemoryEntityRepository entityRepository = new InMemoryEntityRepository();
        InMemoryOwnershipRepository ownershipRepository = new InMemoryOwnershipRepository();
        InMemoryExperienceRepository experienceRepository = new InMemoryExperienceRepository();
        InMemoryWishlistEntryRepository wishlistEntryRepository = new InMemoryWishlistEntryRepository();
        InMemoryTagRepository tagRepository = new InMemoryTagRepository();
        InMemoryEntityTypeRepository entityTypeRepository = new InMemoryEntityTypeRepository(EntityTypeFixtures.MANGA, EntityTypeFixtures.VIDEO_GAME);

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
                List.of(new MangaOwnedValueSource(editionRepository, new CollectionProgressService(entityRepository, ownershipRepository, editionRepository))),
                entityRepository, ownershipRepository, experienceRepository, wishlistEntryRepository, tagRepository, entityTypeRepository);

        StatsSummary summary = statsService.computeSummary();

        assertThat(summary.totalEntities()).isEqualTo(2);
        assertThat(summary.totalActiveOwnerships()).isEqualTo(1); // Hollow Knight sold, no longer counts
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
        assertThat(videoGameStats.averageRating()).isNull(); // no rated experience

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
        InMemoryEntityTypeRepository entityTypeRepository = new InMemoryEntityTypeRepository(EntityTypeFixtures.MANGA, EntityTypeFixtures.VIDEO_GAME);

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
                List.of(new MangaOwnedValueSource(editionRepository, new CollectionProgressService(entityRepository, ownershipRepository, editionRepository))),
                entityRepository, ownershipRepository, experienceRepository, wishlistEntryRepository, tagRepository, entityTypeRepository);

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
        InMemoryEntityTypeRepository entityTypeRepository = new InMemoryEntityTypeRepository(EntityTypeFixtures.MANGA, EntityTypeFixtures.VIDEO_GAME);

        Entity deathNote = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        deathNote.setAttribute("mangaka", "Takeshi Obata");
        entityRepository.save(deathNote);
        Entity bakuman = Entity.create(EntityTypeFixtures.MANGA.id(), "Bakuman");
        bakuman.setAttribute("mangaka", "Takeshi Obata");
        entityRepository.save(bakuman);
        Entity hollowKnight = Entity.create(EntityTypeFixtures.VIDEO_GAME.id(), "Hollow Knight");
        entityRepository.save(hollowKnight);

        // Death Note: first volume in 2025 (series not "started" in 2026), a second volume in 2026.
        ownershipRepository.save(Ownership.acquire(deathNote.id(), null, OwnershipCondition.NEW,
                LocalDate.of(2025, 12, 1), null));
        ownershipRepository.save(Ownership.acquire(deathNote.id(), null, OwnershipCondition.NEW,
                LocalDate.of(2026, 2, 1), null));
        // Bakuman and Hollow Knight: both acquired for the first time in 2026.
        ownershipRepository.save(Ownership.acquire(bakuman.id(), null, OwnershipCondition.NEW,
                LocalDate.of(2026, 3, 1), null));
        ownershipRepository.save(Ownership.acquire(hollowKnight.id(), null, OwnershipCondition.NEW,
                LocalDate.of(2026, 5, 1), null));

        experienceRepository.save(Experience.record_(deathNote.id(), null, "READ", LocalDate.of(2026, 2, 10), 9, null));
        experienceRepository.save(Experience.record_(deathNote.id(), null, "READ", LocalDate.of(2025, 1, 1), 5, null));

        InMemoryMangaEditionRepository editionRepository = new InMemoryMangaEditionRepository();
        StatsService statsService = new StatsService(
                List.of(new MangaOwnedValueSource(editionRepository, new CollectionProgressService(entityRepository, ownershipRepository, editionRepository))),
                entityRepository, ownershipRepository, experienceRepository, wishlistEntryRepository, tagRepository, entityTypeRepository);

        YearlyRecap recap = statsService.computeYearlyRecap(2026);

        assertThat(recap.year()).isEqualTo(2026);
        assertThat(recap.acquisitionsCount()).isEqualTo(3); // Death Note volume 2 + Bakuman + Hollow Knight
        assertThat(recap.seriesStartedCount()).isEqualTo(2); // Bakuman + Hollow Knight, not Death Note
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
        InMemoryEntityTypeRepository entityTypeRepository = new InMemoryEntityTypeRepository(EntityTypeFixtures.MANGA, EntityTypeFixtures.VIDEO_GAME);

        InMemoryMangaEditionRepository editionRepository = new InMemoryMangaEditionRepository();
        StatsService statsService = new StatsService(
                List.of(new MangaOwnedValueSource(editionRepository, new CollectionProgressService(entityRepository, ownershipRepository, editionRepository))),
                entityRepository, ownershipRepository, experienceRepository, wishlistEntryRepository, tagRepository, entityTypeRepository);

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
        InMemoryEntityTypeRepository entityTypeRepository = new InMemoryEntityTypeRepository(EntityTypeFixtures.MANGA, EntityTypeFixtures.VIDEO_GAME);

        // A series with TWO owned volumes, in an edition whose new price is
        // known: that is what makes the value, not what was paid.
        Entity deathNote = Entity.create(EntityTypeFixtures.MANGA.id(), "Death Note");
        deathNote.addVariant("Tome 1 — Black Édition", Map.of("volumeNumber", 1, "edition", "Black Édition"));
        deathNote.addVariant("Tome 2 — Black Édition", Map.of("volumeNumber", 2, "edition", "Black Édition"));
        entityRepository.save(deathNote);
        Entity hollowKnight = Entity.create(EntityTypeFixtures.VIDEO_GAME.id(), "Hollow Knight");
        entityRepository.save(hollowKnight);

        InMemoryMangaEditionRepository editionRepository = new InMemoryMangaEditionRepository();
        editionRepository.save(MangaEdition.create(deathNote.id(), "Death Note", "Black Édition",
                EditionTier.INTEGRAL, "Kana", 6, new BigDecimal("14.90"), false, false, null));

        // The PAID price is deliberately absurd: it must enter no
        // total. What the collection is worth does not depend on what it cost.
        Ownership tome1 = Ownership.acquire(deathNote.id(),
                deathNote.findVariantByLabel("Tome 1 — Black Édition").orElseThrow().id(),
                OwnershipCondition.NEW, LocalDate.now(), null);
        tome1.updatePurchasePrice(new BigDecimal("2.00"));
        ownershipRepository.save(tome1);
        ownershipRepository.save(Ownership.acquire(deathNote.id(),
                deathNote.findVariantByLabel("Tome 2 — Black Édition").orElseThrow().id(),
                OwnershipCondition.NEW, LocalDate.now(), null));

        // No new-price source for a game: it counts in the total of
        // possessions, never in the known value.
        ownershipRepository.save(Ownership.acquire(hollowKnight.id(), null,
                OwnershipCondition.NEW, LocalDate.now(), null));

        // Sold: out of all totals.
        Ownership sold = Ownership.acquire(hollowKnight.id(), null, OwnershipCondition.NEW, LocalDate.now(), null);
        sold.markSold();
        ownershipRepository.save(sold);

        StatsService statsService = new StatsService(
                List.of(new MangaOwnedValueSource(editionRepository, new CollectionProgressService(entityRepository, ownershipRepository, editionRepository))),
                entityRepository, ownershipRepository, experienceRepository, wishlistEntryRepository, tagRepository, entityTypeRepository);

        CollectionValue value = statsService.computeCollectionValue();

        // 2 volumes x 14,90 - and above all not the 2,00 paid.
        assertThat(value.totalKnownValue()).isEqualByComparingTo(new BigDecimal("29.80"));
        assertThat(value.pricedOwnershipCount()).isEqualTo(2);
        assertThat(value.totalActiveOwnershipCount()).isEqualTo(3); // the sold game is excluded

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
}
