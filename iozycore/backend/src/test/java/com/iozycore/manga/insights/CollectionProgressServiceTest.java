package com.iozycore.manga.insights;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.manga.domain.EditionTier;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import org.junit.jupiter.api.Test;
import com.iozycore.core.testing.InMemoryEntityRepository;
import com.iozycore.core.testing.InMemoryOwnershipRepository;
import com.iozycore.manga.testing.InMemoryMangaEditionRepository;

import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import com.iozycore.core.domain.insights.CollectionProgress;

/**
 * The rules of the "X of Y" progress now live in one single place
 * (see CollectionProgressService) - this test IS their specification. Each case
 * below comes from a gap really seen between two screens during
 * the audit of 2026-08-21.
 */
class CollectionProgressServiceTest {

    private final InMemoryEntityRepository entities = new InMemoryEntityRepository();
    private final InMemoryOwnershipRepository ownerships = new InMemoryOwnershipRepository();
    private final InMemoryMangaEditionRepository editions = new InMemoryMangaEditionRepository();
    private final CollectionProgressService service = new CollectionProgressService(entities, ownerships, editions);

    @Test
    void a_volume_without_an_edition_joins_the_single_named_one() {
        // The Naruto case: volumes 18 and 30 in "Kana", volume 1 with no edition entered.
        // My collection said 3/72, the suggestion engine 2/72.
        Entity naruto = Entity.create(EntityTypeFixtures.MANGA.id(), "Naruto");
        Variant t18 = naruto.addVariant("Tome 18", Map.of("volumeNumber", 18, "edition", "Kana"));
        Variant t30 = naruto.addVariant("Tome 30", Map.of("volumeNumber", 30, "edition", "Kana"));
        Variant t1 = naruto.addVariant("Tome 1", Map.of("volumeNumber", 1));
        entities.save(naruto);
        own(naruto, t18);
        own(naruto, t30);
        own(naruto, t1);
        editions.save(MangaEdition.create(naruto.id(), "Naruto", "Kana", EditionTier.STANDARD, null, 72, null, false, false, null));

        CollectionProgress progress = service.compute(naruto.id()).orElseThrow();

        assertThat(progress.editions()).hasSize(1);
        CollectionProgress.EditionProgress kana = progress.editions().get(0);
        assertThat(kana.editionName()).isEqualTo("Kana");
        assertThat(kana.sourceEditions()).containsExactlyInAnyOrder("Kana", "");
        assertThat(kana.ownedVolumeNumbers()).containsExactly(1, 18, 30);
        assertThat(kana.totalVolumes()).isEqualTo(72);
        assertThat(kana.missingCount()).isEqualTo(69);
        assertThat(progress.dominantEdition()).isEqualTo(kana);
    }

    @Test
    void two_named_editions_are_never_merged_because_the_ambiguity_is_real() {
        Entity series = Entity.create(EntityTypeFixtures.MANGA.id(), "Berserk");
        series.addVariant("Tome 1", Map.of("volumeNumber", 1, "edition", "Standard"));
        series.addVariant("Tome 1 deluxe", Map.of("volumeNumber", 1, "edition", "Deluxe"));
        series.addVariant("Tome 2", Map.of("volumeNumber", 2));
        entities.save(series);

        CollectionProgress progress = service.compute(series.id()).orElseThrow();

        assertThat(progress.editions()).extracting(CollectionProgress.EditionProgress::editionName)
                .containsExactlyInAnyOrder("Standard", "Deluxe", "");
    }

    @Test
    void a_catalogued_edition_owning_nothing_never_hides_the_progression_of_the_collected_one() {
        // The Raw Hero case: a stray edition with 0 owned volumes made the
        // My collection tile lose "3/6", which fell back to "3 tomes".
        Entity rawHero = Entity.create(EntityTypeFixtures.MANGA.id(), "Raw Hero");
        Variant t2 = rawHero.addVariant("Tome 2", Map.of("volumeNumber", 2, "edition", "Soleil"));
        rawHero.addVariant("Tome 1 perfect", Map.of("volumeNumber", 1, "edition", "Perfect (test)"));
        entities.save(rawHero);
        own(rawHero, t2);
        editions.save(MangaEdition.create(rawHero.id(), "Raw Hero", "Soleil", EditionTier.STANDARD, null, 6, null, false, false, null));

        CollectionProgress progress = service.compute(rawHero.id()).orElseThrow();

        assertThat(progress.editions()).hasSize(2);
        assertThat(progress.dominantEdition()).isNotNull();
        assertThat(progress.dominantEdition().editionName()).isEqualTo("Soleil");
        assertThat(progress.dominantEdition().ownedCount()).isEqualTo(1);
        assertThat(progress.dominantEdition().totalVolumes()).isEqualTo(6);
    }

    @Test
    void no_dominant_edition_when_several_are_actually_collected() {
        Entity series = Entity.create(EntityTypeFixtures.MANGA.id(), "Gunnm");
        Variant standard = series.addVariant("Tome 1", Map.of("volumeNumber", 1, "edition", "Standard"));
        Variant deluxe = series.addVariant("Tome 1 deluxe", Map.of("volumeNumber", 1, "edition", "Deluxe"));
        entities.save(series);
        own(series, standard);
        own(series, deluxe);

        CollectionProgress progress = service.compute(series.id()).orElseThrow();

        // Two editions really collected: none can be named
        // alone without lying, the one-line view must fall back on the total.
        assertThat(progress.dominantEdition()).isNull();
        assertThat(progress.ownedVolumeCount()).isEqualTo(1); // the SAME volume 1, in two editions
    }

    @Test
    void a_sold_copy_stops_counting_as_owned() {
        Entity series = Entity.create(EntityTypeFixtures.MANGA.id(), "Monster");
        Variant t1 = series.addVariant("Tome 1", Map.of("volumeNumber", 1, "edition", "Kana"));
        Variant t2 = series.addVariant("Tome 2", Map.of("volumeNumber", 2, "edition", "Kana"));
        entities.save(series);
        own(series, t1);
        Ownership sold = Ownership.acquire(series.id(), t2.id(), OwnershipCondition.USED, LocalDate.now(), null);
        sold.markSold();
        ownerships.save(sold);

        CollectionProgress progress = service.compute(series.id()).orElseThrow();

        assertThat(progress.editions().get(0).ownedVolumeNumbers()).containsExactly(1);
        assertThat(progress.ownedVolumeCount()).isEqualTo(1);
    }

    @Test
    void two_copies_of_the_same_volume_are_one_volume_owned() {
        Entity series = Entity.create(EntityTypeFixtures.MANGA.id(), "Pluto");
        Variant t1 = series.addVariant("Tome 1", Map.of("volumeNumber", 1, "edition", "Kana"));
        entities.save(series);
        own(series, t1);
        own(series, t1);

        CollectionProgress progress = service.compute(series.id()).orElseThrow();

        assertThat(progress.ownedVolumeCount()).isEqualTo(1);
        assertThat(progress.editions().get(0).ownedCount()).isEqualTo(1);
    }

    @Test
    void an_unfilled_reference_edition_leaves_the_total_unknown_rather_than_guessed() {
        Entity series = Entity.create(EntityTypeFixtures.MANGA.id(), "Chainsaw Man");
        Variant t1 = series.addVariant("Tome 1", Map.of("volumeNumber", 1, "edition", "Crunchyroll"));
        entities.save(series);
        own(series, t1);
        // No MangaEdition record stored for this edition.

        CollectionProgress progress = service.compute(series.id()).orElseThrow();

        assertThat(progress.editions().get(0).totalVolumes()).isNull();
        assertThat(progress.editions().get(0).missingCount()).isNull();
    }

    @Test
    void an_entity_without_any_volume_has_no_edition_and_no_progression() {
        Entity game = Entity.create(EntityTypeFixtures.VIDEO_GAME.id(), "Breath of the Wild");
        entities.save(game);
        ownerships.save(Ownership.acquire(game.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));

        CollectionProgress progress = service.compute(game.id()).orElseThrow();

        assertThat(progress.editions()).isEmpty();
        assertThat(progress.dominantEdition()).isNull();
        assertThat(progress.ownedVolumeCount()).isZero();
    }

    private void own(Entity entity, Variant variant) {
        ownerships.save(Ownership.acquire(entity.id(), variant.id(), OwnershipCondition.USED, LocalDate.now(), null));
    }

    // --- in-memory doubles (same conventions as StatsServiceTest) ---
}
