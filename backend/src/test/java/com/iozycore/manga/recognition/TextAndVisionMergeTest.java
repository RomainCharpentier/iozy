package com.iozycore.manga.recognition;

import com.iozycore.manga.domain.EditionTier;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.deals.MangaSeries;
import com.iozycore.manga.domain.deals.SeriesMatcher;
import org.junit.jupiter.api.Test;
import com.iozycore.manga.testing.InMemoryMangaEditionRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The heart of this pass: the text and the photos feed <b>one</b> list,
 * not two.
 *
 * <p>The rule that governs everything else: consolidation is a
 * <b>union</b>, never an intersection. A photo that does not show a book
 * does not prove its absence, and a title that does not announce an edition
 * does not forbid reading it on a cover.
 */
class TextAndVisionMergeTest {

    private static final UUID PLATINUM_END = UUID.randomUUID();
    private static final UUID DEATH_NOTE = UUID.randomUUID();

    private final CatalogueDeTest catalogue = new CatalogueDeTest();
    private final EditionsDeTest editions = new EditionsDeTest();

    /**
     * These tests cover the TEXT + VISION merge. A barcode reader
     * that found something on the test images would add a
     * third source and blur precisely what they measure - hence this
     * reader that reads nothing. The barcode chain has its own tests.
     */
    private static final BarcodeRecognizer SANS_CODE_BARRES =
            new BarcodeRecognizer((ean, entityTypeCode) -> java.util.Optional.empty());

    private ListingRecognitionService service(ImageRecognitionProvider... moteurs) {
        return new ListingRecognitionService(new FetcherDeTest(),
                new RecognitionCatalogResolver(catalogue, editions), List.of(moteurs), SANS_CODE_BARRES);
    }

    private static RecognizedItem vu(String titre, Integer tome, String edition, int... photos) {
        Set<Integer> index = new java.util.TreeSet<>();
        for (int photo : photos) {
            index.add(photo);
        }
        return RecognizedItem.fromVision(titre, tome, edition, null,
                RecognitionConfidence.HIGH, List.of("lu sur la photo"), index);
    }

    private static List<String> unePhoto() {
        return List.of("https://exemple.invalid/1.jpg");
    }

    private List<RecognizedItem> lus(ListingRecognitionService.Analysis analyse) {
        return analyse.items().stream().map(ResolvedItem::recognized).toList();
    }

    // =================================================== §49 — complementary sources

    @Test
    void vision_completes_the_edition_of_one_volume_without_inventing_the_others() {
        catalogue.ajouterSerie("Platinum End", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Platinum End", "Standard", 14);

        ListingRecognitionService.Analysis analyse = service(FakeImageRecognitionProvider.rendant(
                RecognitionResult.recognized(List.of(vu("Platinum End", 1, "Standard", 0)), 0)))
                .analyze("Platinum End 1-3", null, unePhoto(), RecognitionContext.forManga());

        assertThat(analyse.items()).hasSize(3);

        List<RecognizedItem> items = lus(analyse);
        assertThat(items).filteredOn(i -> i.volumeNumber() == 1)
                .singleElement()
                .satisfies(i -> {
                    assertThat(i.editionHint()).isEqualTo("Standard");
                    assertThat(i.sources()).contains(RecognitionSource.TEXT, RecognitionSource.VISION);
                });
        // Volumes 2 and 3 keep their unknown edition: the photo said nothing
        // about them, and assuming "Standard too" would be inventing.
        assertThat(items).filteredOn(i -> i.volumeNumber() != 1)
                .allSatisfy(i -> {
                    assertThat(i.editionIsUnknown()).isTrue();
                    assertThat(i.sources()).containsExactly(RecognitionSource.TEXT);
                });
    }

    // =================================================== §50 — duplicates between sources

    @Test
    void one_volume_announced_and_seen_twice_is_a_single_item() {
        catalogue.ajouterSerie("Platinum End", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Platinum End", "Standard", 14);

        ListingRecognitionService.Analysis analyse = service(FakeImageRecognitionProvider.rendant(
                RecognitionResult.recognized(List.of(
                        vu("Platinum End", 4, null, 0),
                        vu("Platinum End", 4, null, 1)), 0)))
                .analyze("Platinum End tome 4", null, unePhoto(), RecognitionContext.forManga());

        assertThat(analyse.items()).hasSize(1);
        RecognizedItem item = lus(analyse).get(0);
        assertThat(item.sources()).containsExactlyInAnyOrder(RecognitionSource.TEXT, RecognitionSource.VISION);
        assertThat(item.sourceImages()).containsExactly(0, 1);
    }

    // =================================================== §51 / §52 — editions

    @Test
    void a_read_edition_completes_a_volume_whose_text_said_nothing() {
        catalogue.ajouterSerie("Platinum End", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Platinum End", "Standard", 14);

        ListingRecognitionService.Analysis analyse = service(FakeImageRecognitionProvider.rendant(
                RecognitionResult.recognized(List.of(vu("Platinum End", 4, "Standard", 0)), 0)))
                .analyze("Platinum End tome 4", null, unePhoto(), RecognitionContext.forManga());

        assertThat(analyse.items()).hasSize(1);
        assertThat(lus(analyse).get(0).editionHint()).isEqualTo("Standard");
    }

    @Test
    void two_editions_that_contradict_each_other_stay_two_items() {
        catalogue.ajouterSerie("Death Note", DEATH_NOTE);
        editions.ajouter(DEATH_NOTE, "Death Note", "Standard", 12);
        editions.ajouter(DEATH_NOTE, "Death Note", "Perfect", 6);

        // The text announces Standard, the photo reads Perfect: nobody decides
        // in place of the user.
        RecognizedItem depuisTexte = new RecognizedItem("Death Note", 4, "Standard", null,
                RecognitionConfidence.HIGH, Set.of(RecognitionSource.TEXT), List.of(), Set.of());

        List<RecognizedItem> bruts = new ArrayList<>();
        bruts.add(depuisTexte);
        bruts.add(vu("Death Note", 4, "Perfect", 0));

        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(bruts);

        assertThat(consolides).hasSize(2);
        assertThat(consolides).extracting(RecognizedItem::editionHint)
                .containsExactlyInAnyOrder("Standard", "Perfect");
    }

    // =================================================== §53 — EAN

    @Test
    void an_exact_identifier_enriches_and_outranks_a_weaker_reading() {
        catalogue.ajouterSerie("Platinum End", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Platinum End", "Standard", 14);

        RecognizedItem avecEan = RecognizedItem.fromVision("Platinum End", 4, "Standard", "9782505000000",
                RecognitionConfidence.LOW, List.of("code-barres lisible"), Set.of(0));

        ListingRecognitionService.Analysis analyse = service(FakeImageRecognitionProvider.rendant(
                RecognitionResult.recognized(List.of(avecEan), 0)))
                .analyze("Platinum End tome 4", null, unePhoto(), RecognitionContext.forManga());

        assertThat(analyse.items()).hasSize(1);
        RecognizedItem item = lus(analyse).get(0);
        assertThat(item.hasExactIdentifier()).isTrue();
        assertThat(item.editionHint()).isEqualTo("Standard");
        assertThat(item.sources()).contains(RecognitionSource.EAN, RecognitionSource.TEXT, RecognitionSource.VISION);
        assertThat(item.strongestSource()).isEqualTo(RecognitionSource.EAN);
    }

    // =================================================== §11 / §73 — vision does not overwrite the text

    @Test
    void volumes_announced_but_not_photographed_are_never_dropped() {
        catalogue.ajouterSerie("Platinum End", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Platinum End", "Standard", 14);

        // The title announces 1 to 14; the photos only show 12. A photo
        // that does not show a book does not prove its absence.
        List<RecognizedItem> vus = new ArrayList<>();
        for (int tome = 1; tome <= 12; tome++) {
            vus.add(vu("Platinum End", tome, "Standard", 0));
        }

        ListingRecognitionService.Analysis analyse = service(FakeImageRecognitionProvider.rendant(
                RecognitionResult.recognized(vus, 0)))
                .analyze("Platinum End intégrale tomes 1 à 14", null, unePhoto(), RecognitionContext.forManga());

        assertThat(analyse.items()).hasSize(14);
        assertThat(lus(analyse)).filteredOn(i -> i.volumeNumber() >= 13)
                .hasSize(2)
                .allSatisfy(i -> assertThat(i.sources()).containsExactly(RecognitionSource.TEXT));
    }

    // =================================================== §54 — volume contradiction

    @Test
    void a_volume_disagreement_yields_two_correctable_items_never_a_blend() {
        catalogue.ajouterSerie("Platinum End", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Platinum End", "Standard", 14);

        ListingRecognitionService.Analysis analyse = service(FakeImageRecognitionProvider.rendant(
                RecognitionResult.recognized(List.of(vu("Platinum End", 5, null, 0)), 0)))
                .analyze("Platinum End tome 4", null, unePhoto(), RecognitionContext.forManga());

        // Neither an arbitrary merge into 4, nor into 5: both are proposed, and
        // the user removes the one that should not be there.
        assertThat(lus(analyse)).extracting(RecognizedItem::volumeNumber)
                .containsExactlyInAnyOrder(4, 5);
    }

    // =================================================== §34 — vision without useful text

    @Test
    void an_unusable_title_still_lets_vision_work_exactly_as_before() {
        catalogue.ajouterSerie("Platinum End", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Platinum End", "Standard", 14);

        ListingRecognitionService.Analysis analyse = service(FakeImageRecognitionProvider.rendant(
                RecognitionResult.recognized(List.of(vu("Platinum End", 4, "Standard", 0)), 0)))
                .analyze("Lot manga", null, unePhoto(), RecognitionContext.forManga());

        assertThat(analyse.textItemCount()).isZero();
        assertThat(analyse.items()).hasSize(1);
        assertThat(lus(analyse).get(0).sources()).containsExactly(RecognitionSource.VISION);
    }

    // =================================================== §57 — no implicit cloud call

    @Test
    void analysing_the_text_alone_never_calls_the_vision_engine() {
        catalogue.ajouterSerie("Platinum End", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Platinum End", "Standard", 14);
        FakeImageRecognitionProvider moteur = FakeImageRecognitionProvider
                .rendant(RecognitionResult.recognized(List.of(), 0));

        ListingRecognitionService.Analysis analyse = service(moteur)
                .analyze("Platinum End intégrale tomes 1 à 14", null, null, RecognitionContext.forManga());

        // The whole point of this pass: a well-written listing is understood
        // without any paid call.
        assertThat(moteur.appels()).isZero();
        assertThat(analyse.items()).hasSize(14);
        assertThat(analyse.textItemCount()).isEqualTo(14);
        // No photo requested: it is not a reading failure, it is
        // the absence of a question.
        assertThat(analyse.visionStatus()).isNull();
    }

    @Test
    void an_empty_photo_list_is_also_a_text_only_request() {
        FakeImageRecognitionProvider moteur = FakeImageRecognitionProvider
                .rendant(RecognitionResult.recognized(List.of(), 0));

        service(moteur).analyze("Platinum End tome 4", null, List.of(), RecognitionContext.forManga());

        assertThat(moteur.appels()).isZero();
    }

    // =================================================== §62 — degradations

    @Test
    void a_failing_vision_engine_leaves_the_text_proposals_standing() {
        catalogue.ajouterSerie("Platinum End", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Platinum End", "Standard", 14);

        ListingRecognitionService.Analysis analyse = service(FakeImageRecognitionProvider.quiExplose())
                .analyze("Platinum End tomes 1 à 3", null, unePhoto(), RecognitionContext.forManga());

        assertThat(analyse.visionStatus()).isEqualTo(RecognitionStatus.UNAVAILABLE);
        // What the text said stays true even if the engine goes down.
        assertThat(analyse.items()).hasSize(3);
    }

    @Test
    void without_any_engine_the_text_still_produces_proposals() {
        catalogue.ajouterSerie("Platinum End", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Platinum End", "Standard", 14);

        ListingRecognitionService.Analysis analyse = service()
                .analyze("Platinum End tomes 1 à 3", null, unePhoto(), RecognitionContext.forManga());

        assertThat(analyse.visionStatus()).isEqualTo(RecognitionStatus.NO_ENGINE);
        assertThat(analyse.items()).hasSize(3);
    }

    @Test
    void unusable_photos_leave_the_text_proposals_standing() {
        catalogue.ajouterSerie("Platinum End", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Platinum End", "Standard", 14);

        ListingRecognitionService service = new ListingRecognitionService(
                new FetcherVide(), new RecognitionCatalogResolver(catalogue, editions),
                List.of(FakeImageRecognitionProvider.rendant(RecognitionResult.recognized(List.of(), 0))),
                SANS_CODE_BARRES);

        ListingRecognitionService.Analysis analyse = service
                .analyze("Platinum End tomes 1 à 3", null, unePhoto(), RecognitionContext.forManga());

        assertThat(analyse.visionStatus()).isEqualTo(RecognitionStatus.NO_USABLE_IMAGE);
        assertThat(analyse.items()).hasSize(3);
    }

    // =================================================== Listing decoration

    @Test
    void a_decorated_listing_title_reaches_the_catalog_without_its_decoration() {
        catalogue.ajouterSerie("Platinum End", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Platinum End", "Standard", 14);

        ListingRecognitionService.Analysis analyse = service()
                .analyze("🔥 Platinum End tomes 1 à 3", null, null, RecognitionContext.forManga());

        assertThat(analyse.items()).hasSize(3);
        assertThat(analyse.items()).allSatisfy(item -> {
            assertThat(item.catalogStatus()).isEqualTo(CatalogStatus.EDITION_TO_CONFIRM);
            assertThat(item.entityId()).isEqualTo(PLATINUM_END);
        });
    }

    @Test
    void the_decoration_never_becomes_the_name_of_a_work() {
        // Even outside the catalogue: "🔥 Série inconnue" must not go in as
        // is into the batch and then into the saved analysis.
        ListingRecognitionService.Analysis analyse = service()
                .analyze("🔥 Serie hors catalogue tomes 1 à 2", null, null, RecognitionContext.forManga());

        assertThat(analyse.items()).isNotEmpty();
        assertThat(analyse.items()).allSatisfy(item -> {
            assertThat(item.displayTitle()).doesNotContain("🔥");
            // The provenance stays readable: we do not erase what the listing said.
            assertThat(item.recognized().seriesTitleRaw()).contains("🔥");
        });
    }

    // =================================================== §22 — no creation

    @Test
    void neither_source_ever_creates_a_catalog_entry() {
        ListingRecognitionService.Analysis analyse = service(FakeImageRecognitionProvider.rendant(
                RecognitionResult.recognized(List.of(vu("Série vue nulle part", 1, null, 0)), 0)))
                .analyze("Autre série inconnue tomes 1 à 3", null, unePhoto(), RecognitionContext.forManga());

        assertThat(lus(analyse)).isNotEmpty();
        assertThat(analyse.items()).allSatisfy(item ->
                assertThat(item.catalogStatus()).isEqualTo(CatalogStatus.NOT_IN_CATALOG));
        assertThat(catalogue.creations()).isZero();
        assertThat(editions.creations()).isZero();
    }

    // =================================================== Doubles

    private static class FetcherDeTest extends RecognitionImageFetcher {
        FetcherDeTest() {
            super(List.of());
        }

        @Override
        public List<RecognitionImage> fetch(List<String> imageUrls) {
            List<RecognitionImage> images = new ArrayList<>();
            for (int i = 0; i < imageUrls.size(); i++) {
                images.add(new RecognitionImage(i, imageUrls.get(i), new byte[] {1, 2, 3}, "image/jpeg"));
            }
            return images;
        }
    }

    private static class FetcherVide extends RecognitionImageFetcher {
        FetcherVide() {
            super(List.of());
        }

        @Override
        public List<RecognitionImage> fetch(List<String> imageUrls) {
            return List.of();
        }
    }

    private static class CatalogueDeTest extends SeriesMatcher {
        private final java.util.Map<String, UUID> series = new java.util.HashMap<>();
        private int creations;

        CatalogueDeTest() {
            super(null, null);
        }

        void ajouterSerie(String titre, UUID id) {
            series.put(titre.toLowerCase(java.util.Locale.ROOT), id);
        }

        int creations() {
            return creations;
        }

        @Override
        public MangaSeries match(String rawTitle) {
            if (rawTitle == null || rawTitle.isBlank()) {
                throw new IllegalArgumentException("Le titre de la série est requis");
            }
            // The double applies the SAME normalisation as the real matcher:
            // skipping it would make it diverge from the real behaviour, and the
            // tests would then check something that does not exist.
            String titre = com.iozycore.manga.domain.deals.SeriesTitleNormalizer.normalize(rawTitle);
            return new MangaSeries(titre, series.get(titre.toLowerCase(java.util.Locale.ROOT)));
        }
    }

    /** Counts the editions the service creates; seeding with ajouter is not counted. */
    private static class EditionsDeTest extends InMemoryMangaEditionRepository {
        private int creations;

        void ajouter(UUID entityId, String serie, String edition, Integer totalVolumes) {
            super.save(new MangaEdition(UUID.randomUUID(), entityId, serie, edition, EditionTier.STANDARD,
                    null, totalVolumes, null, false, false, null, null, null, null));
        }

        int creations() {
            return creations;
        }

        @Override
        public MangaEdition save(MangaEdition edition) {
            creations++;
            return super.save(edition);
        }
    }
}
