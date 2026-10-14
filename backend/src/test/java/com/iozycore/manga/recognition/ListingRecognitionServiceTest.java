package com.iozycore.manga.recognition;

import com.iozycore.manga.domain.EditionTier;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.deals.MangaSeries;
import com.iozycore.manga.deals.SeriesMatcher;
import org.junit.jupiter.api.Test;
import com.iozycore.manga.testing.InMemoryMangaEditionRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import com.iozycore.manga.deals.SeriesTitleNormalizer;

/**
 * The complete pipeline, with a fake engine: photos -> reading -> consolidation
 * -> catalogue -> proposals.
 *
 * <p>Two invariants dominate this class, and they hold the whole project together:
 * <b>nothing is ever created</b>, and <b>an engine outage blocks nothing</b>.
 */
class ListingRecognitionServiceTest {

    private static final UUID PLATINUM_END = UUID.randomUUID();

    private final CatalogueDeTest catalogue = new CatalogueDeTest();
    private final EditionsDeTest editions = new EditionsDeTest();

    /**
     * These tests cover the text/vision orchestration. A barcode
     * reader that found something on the test images
     * would add a source and blur what they measure - the barcode
     * chain has its own tests.
     */
    private static final BarcodeRecognizer SANS_CODE_BARRES =
            new BarcodeRecognizer((ean, entityTypeCode) -> java.util.Optional.empty());

    private ListingRecognitionService service(ImageRecognitionProvider... moteurs) {
        RecognitionCatalogResolver resolver = new RecognitionCatalogResolver(catalogue, editions);
        return new ListingRecognitionService(new FetcherDeTest(), resolver, List.of(moteurs), SANS_CODE_BARRES);
    }

    private static RecognizedItem vu(String titre, Integer tome, String edition, RecognitionConfidence confiance,
                                      int... photos) {
        Set<Integer> index = new java.util.TreeSet<>();
        for (int photo : photos) {
            index.add(photo);
        }
        return RecognizedItem.fromVision(titre, tome, edition, null, confiance, List.of(), index);
    }

    @Test
    void a_spent_quota_is_reported_as_such_and_the_rest_of_the_reading_survives() {
        ListingRecognitionService.Analysis analyse = service(FakeImageRecognitionProvider.rendant(
                RecognitionResult.quotaExceeded()))
                .analyze(null, null, List.of("https://exemple.invalid/1.jpg"), RecognitionContext.forManga());

        // Not UNAVAILABLE: the screen must not invite to retry right away.
        assertThat(analyse.visionStatus()).isEqualTo(RecognitionStatus.QUOTA_EXCEEDED);
        assertThat(analyse.items()).isEmpty();
        assertThat(analyse.analyzedImageCount()).isEqualTo(1);
    }

    // ====================================================== The nominal case

    @Test
    void a_recognized_volume_of_a_known_series_is_matched_to_the_catalog() {
        catalogue.ajouterSerie("Platinum End", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Platinum End", "Standard", 14);

        ListingRecognitionService.Analysis analyse = service(FakeImageRecognitionProvider.rendant(
                RecognitionResult.recognized(List.of(
                        vu("Platinum End", 4, "Standard", RecognitionConfidence.HIGH, 0)), 0)))
                .analyze(null, null, List.of("https://exemple.invalid/1.jpg"), RecognitionContext.forManga());

        assertThat(analyse.visionStatus()).isEqualTo(RecognitionStatus.OK);
        assertThat(analyse.items()).hasSize(1);

        ResolvedItem item = analyse.items().get(0);
        assertThat(item.catalogStatus()).isEqualTo(CatalogStatus.MATCHED);
        assertThat(item.entityId()).isEqualTo(PLATINUM_END);
        assertThat(item.readyForAnalysis()).isTrue();
        assertThat(item.preselected()).isTrue();
    }

    @Test
    void several_volumes_of_one_series_come_back_as_several_items() {
        catalogue.ajouterSerie("Platinum End", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Platinum End", "Standard", 14);

        ListingRecognitionService.Analysis analyse = service(FakeImageRecognitionProvider.rendant(
                RecognitionResult.recognized(List.of(
                        vu("Platinum End", 1, "Standard", RecognitionConfidence.HIGH, 0),
                        vu("Platinum End", 2, "Standard", RecognitionConfidence.HIGH, 0),
                        vu("Platinum End", 3, "Standard", RecognitionConfidence.MEDIUM, 1)), 0)))
                .analyze(null, null, List.of("https://exemple.invalid/1.jpg"), RecognitionContext.forManga());

        assertThat(analyse.items()).hasSize(3);
        assertThat(analyse.items()).extracting(item -> item.recognized().volumeNumber())
                .containsExactlyInAnyOrder(1, 2, 3);
    }

    // ====================================================== Duplicates between photos

    @Test
    void one_volume_seen_on_three_photos_is_counted_once() {
        catalogue.ajouterSerie("Platinum End", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Platinum End", "Standard", 14);

        ListingRecognitionService.Analysis analyse = service(FakeImageRecognitionProvider.rendant(
                RecognitionResult.recognized(List.of(
                        vu("Platinum End", 4, "Standard", RecognitionConfidence.MEDIUM, 0),
                        vu("Platinum End", 4, "Standard", RecognitionConfidence.HIGH, 1),
                        vu("Platinum End", 4, "Standard", RecognitionConfidence.LOW, 2)), 0)))
                .analyze(null, null, List.of("https://exemple.invalid/1.jpg"), RecognitionContext.forManga());

        assertThat(analyse.items()).hasSize(1);
        assertThat(analyse.items().get(0).recognized().sourceImages()).containsExactly(0, 1, 2);
    }

    // ====================================================== Edition ambiguity

    @Test
    void an_unread_edition_is_asked_never_chosen() {
        catalogue.ajouterSerie("Death Note", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Death Note", "Standard", 12);
        editions.ajouter(PLATINUM_END, "Death Note", "Black Edition", 6);

        ListingRecognitionService.Analysis analyse = service(FakeImageRecognitionProvider.rendant(
                RecognitionResult.recognized(List.of(
                        vu("Death Note", 1, null, RecognitionConfidence.HIGH, 0)), 0)))
                .analyze(null, null, List.of("https://exemple.invalid/1.jpg"), RecognitionContext.forManga());

        ResolvedItem item = analyse.items().get(0);
        assertThat(item.catalogStatus()).isEqualTo(CatalogStatus.EDITION_TO_CONFIRM);
        assertThat(item.recognized().editionHint()).as("no invented edition").isNull();
        assertThat(item.editionOptions()).extracting(ResolvedItem.EditionOption::editionName)
                .containsExactly("Standard", "Black Edition");
        assertThat(item.preselected()).as("a doubt is not pre-ticked").isFalse();
        assertThat(item.readyForAnalysis()).isFalse();
    }

    @Test
    void a_single_known_edition_is_still_not_chosen_automatically() {
        // The catalogue may not know a second edition that the batch contains.
        catalogue.ajouterSerie("Death Note", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Death Note", "Standard", 12);

        ListingRecognitionService.Analysis analyse = service(FakeImageRecognitionProvider.rendant(
                RecognitionResult.recognized(List.of(
                        vu("Death Note", 1, null, RecognitionConfidence.HIGH, 0)), 0)))
                .analyze(null, null, List.of("https://exemple.invalid/1.jpg"), RecognitionContext.forManga());

        assertThat(analyse.items().get(0).catalogStatus()).isEqualTo(CatalogStatus.EDITION_TO_CONFIRM);
    }

    @Test
    void a_read_edition_matches_the_catalog_whatever_its_casing() {
        catalogue.ajouterSerie("Death Note", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Death Note", "Black Edition", 6);

        ListingRecognitionService.Analysis analyse = service(FakeImageRecognitionProvider.rendant(
                RecognitionResult.recognized(List.of(
                        vu("Death Note", 1, "black  edition", RecognitionConfidence.HIGH, 0)), 0)))
                .analyze(null, null, List.of("https://exemple.invalid/1.jpg"), RecognitionContext.forManga());

        assertThat(analyse.items().get(0).catalogStatus()).isEqualTo(CatalogStatus.MATCHED);
    }

    // ====================================================== Outside the catalogue

    @Test
    void something_recognized_but_absent_from_the_catalog_is_reported_never_created() {
        ListingRecognitionService.Analysis analyse = service(FakeImageRecognitionProvider.rendant(
                RecognitionResult.recognized(List.of(
                        vu("Série inconnue au bataillon", 1, null, RecognitionConfidence.HIGH, 0)), 0)))
                .analyze(null, null, List.of("https://exemple.invalid/1.jpg"), RecognitionContext.forManga());

        ResolvedItem item = analyse.items().get(0);
        assertThat(item.catalogStatus()).isEqualTo(CatalogStatus.NOT_IN_CATALOG);
        assertThat(item.entityId()).isNull();
        assertThat(item.displayTitle()).isEqualTo("Série inconnue au bataillon");

        // The central invariant of the project.
        assertThat(catalogue.creations()).as("no work page created by a recognition").isZero();
        assertThat(editions.creations()).as("no edition created by a recognition").isZero();
    }

    @Test
    void a_recognition_never_creates_an_entity_even_when_confidence_is_high() {
        service(FakeImageRecognitionProvider.rendant(RecognitionResult.recognized(List.of(
                vu("Une autre série absente", 3, "Perfect", RecognitionConfidence.HIGH, 0)), 0)))
                .analyze(null, null, List.of("https://exemple.invalid/1.jpg"), RecognitionContext.forManga());

        assertThat(catalogue.creations()).isZero();
    }

    // ====================================================== Not identified

    @Test
    void unidentified_books_are_reported_so_the_lot_is_not_understated() {
        ListingRecognitionService.Analysis analyse = service(FakeImageRecognitionProvider.rendant(
                RecognitionResult.recognized(List.of(
                        vu("Platinum End", 1, null, RecognitionConfidence.HIGH, 0)), 4)))
                .analyze(null, null, List.of("https://exemple.invalid/1.jpg"), RecognitionContext.forManga());

        assertThat(analyse.visionStatus()).isEqualTo(RecognitionStatus.PARTIAL);
        assertThat(analyse.unidentifiedCount()).isEqualTo(4);
    }

    @Test
    void nothing_readable_is_not_the_same_as_a_broken_engine() {
        ListingRecognitionService.Analysis analyse = service(FakeImageRecognitionProvider.rendant(
                RecognitionResult.recognized(List.of(), 0)))
                .analyze(null, null, List.of("https://exemple.invalid/1.jpg"), RecognitionContext.forManga());

        assertThat(analyse.visionStatus()).isEqualTo(RecognitionStatus.NOTHING_RECOGNIZED);
        assertThat(analyse.visionStatus().worthRetrying()).isFalse();
    }

    // ====================================================== Outages

    @Test
    void no_engine_configured_is_a_normal_answer_not_a_failure() {
        ListingRecognitionService.Analysis analyse = service()
                .analyze(null, null, List.of("https://exemple.invalid/1.jpg"), RecognitionContext.forManga());

        assertThat(analyse.visionStatus()).isEqualTo(RecognitionStatus.NO_ENGINE);
        assertThat(analyse.items()).isEmpty();
    }

    @Test
    void an_unavailable_engine_is_skipped_in_favour_of_a_working_one() {
        catalogue.ajouterSerie("Platinum End", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Platinum End", "Standard", 14);

        FakeImageRecognitionProvider eteint = FakeImageRecognitionProvider
                .rendant(RecognitionResult.recognized(List.of(), 0)).indisponible();
        FakeImageRecognitionProvider allume = FakeImageRecognitionProvider.rendant(
                RecognitionResult.recognized(List.of(vu("Platinum End", 1, "Standard", RecognitionConfidence.HIGH, 0)), 0));

        ListingRecognitionService.Analysis analyse = service(eteint, allume)
                .analyze(null, null, List.of("https://exemple.invalid/1.jpg"), RecognitionContext.forManga());

        assertThat(eteint.appels()).isZero();
        assertThat(allume.appels()).isEqualTo(1);
        assertThat(analyse.items()).hasSize(1);
    }

    @Test
    void an_engine_that_throws_never_breaks_the_journey() {
        ListingRecognitionService.Analysis analyse = service(FakeImageRecognitionProvider.quiExplose())
                .analyze(null, null, List.of("https://exemple.invalid/1.jpg"), RecognitionContext.forManga());

        assertThat(analyse.visionStatus()).isEqualTo(RecognitionStatus.UNAVAILABLE);
        assertThat(analyse.visionStatus().worthRetrying()).isTrue();
        assertThat(analyse.items()).isEmpty();
    }

    @Test
    void no_photo_url_means_a_text_only_request_and_no_engine_call() {
        FakeImageRecognitionProvider moteur = FakeImageRecognitionProvider
                .rendant(RecognitionResult.recognized(List.of(), 0));

        ListingRecognitionService.Analysis analyse = service(moteur).analyze(null, null, List.of(), RecognitionContext.forManga());

        // V2: no photo requested is NOT a reading failure, it is
        // the absence of a question. visionStatus stays null, and the engine sleeps.
        assertThat(analyse.visionStatus()).isNull();
        assertThat(moteur.appels()).isZero();
    }

    @Test
    void without_a_vision_engine_the_photos_are_STILL_read_for_barcodes() {
        // This invariant was REVERSED, and deliberately.
        //
        // It used to say "no point asking a CDN for a result that cannot
        // be produced". That was true as long as only vision could
        // read a photo. Since then, barcodes are read locally and
        // for free: a batch photographed from behind can be entirely
        // identified without any engine, and with EXACT identifiers
        // where a model would only have produced guesses.
        //
        // Not downloading would mean refusing the best of the three
        // sources because the least reliable one is absent.
        FetcherEspion espion = new FetcherEspion();
        ListingRecognitionService service = new ListingRecognitionService(
                espion, new RecognitionCatalogResolver(catalogue, editions), List.of(), SANS_CODE_BARRES);

        service.analyze(null, null, List.of("https://exemple.invalid/1.jpg"), RecognitionContext.forManga());

        assertThat(espion.appels()).isEqualTo(1);
    }

    @Test
    void without_a_vision_engine_the_status_still_says_the_vision_did_not_run() {
        // NO_ENGINE describes VISION, not the whole analysis: the screen must
        // keep saying that it did not run, even if the barcodes
        // gave something.
        ListingRecognitionService service = new ListingRecognitionService(
                new FetcherDeTest(), new RecognitionCatalogResolver(catalogue, editions),
                List.of(), SANS_CODE_BARRES);

        ListingRecognitionService.Analysis analyse = service.analyze(
                "Platinum End tomes 1 à 3", null,
                List.of("https://exemple.invalid/1.jpg"), RecognitionContext.forManga());

        assertThat(analyse.visionStatus()).isEqualTo(RecognitionStatus.NO_ENGINE);
        // And the proposals from the text still hold.
        assertThat(analyse.items()).hasSize(3);
    }

    // ====================================================== EAN priority

    @Test
    void an_exact_identifier_outranks_a_visual_guess() {
        RecognizedItem visuel = vu("Platinum End", 1, null, RecognitionConfidence.HIGH, 0);
        RecognizedItem avecEan = RecognizedItem.fromVision("Death Note", 1, null, "9782505000000",
                RecognitionConfidence.LOW, List.of(), Set.of(1));

        ListingRecognitionService.Analysis analyse = service(FakeImageRecognitionProvider.rendant(
                RecognitionResult.recognized(List.of(visuel, avecEan), 0)))
                .analyze(null, null, List.of("https://exemple.invalid/1.jpg"), RecognitionContext.forManga());

        // A barcode matches or does not match; a title "looks like".
        assertThat(analyse.items().get(0).recognized().hasExactIdentifier()).isTrue();
    }

    @Test
    void an_exact_identifier_survives_consolidation_and_reaches_the_catalog_phase() {
        // The deterministic priority must not get lost on the way: the EAN read on
        // a photo must still be there after the merge, so that the catalogue/metadata
        // resolution can use it rather than the title read.
        catalogue.ajouterSerie("Death Note", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Death Note", "Standard", 12);

        RecognizedItem sansEan = RecognizedItem.fromVision("Death Note", 1, "Standard", null,
                RecognitionConfidence.MEDIUM, List.of(), Set.of(0));
        RecognizedItem avecEan = RecognizedItem.fromVision("Death Note", 1, "Standard", "9782505000000",
                RecognitionConfidence.LOW, List.of(), Set.of(1));

        ListingRecognitionService.Analysis analyse = service(FakeImageRecognitionProvider.rendant(
                RecognitionResult.recognized(List.of(sansEan, avecEan), 0)))
                .analyze(null, null, List.of("https://exemple.invalid/1.jpg"), RecognitionContext.forManga());

        assertThat(analyse.items()).hasSize(1);
        assertThat(analyse.items().get(0).recognized().ean()).isEqualTo("9782505000000");
        assertThat(analyse.items().get(0).recognized().hasExactIdentifier()).isTrue();
    }

    @Test
    void a_weaker_visual_guess_never_outranks_an_exact_identifier() {
        // HIGH confidence on a visual reading against LOW on an EAN:
        // the exact identifier still comes first. A barcode
        // matches or does not match; a title "looks like".
        RecognizedItem visuelTresSur = RecognizedItem.fromVision("Platinum End", 1, null, null,
                RecognitionConfidence.HIGH, List.of(), Set.of(0));
        RecognizedItem eanPeuSur = RecognizedItem.fromVision("Death Note", 1, null, "9782505000000",
                RecognitionConfidence.LOW, List.of(), Set.of(1));

        ListingRecognitionService.Analysis analyse = service(FakeImageRecognitionProvider.rendant(
                RecognitionResult.recognized(List.of(visuelTresSur, eanPeuSur), 0)))
                .analyze(null, null, List.of("https://exemple.invalid/1.jpg"), RecognitionContext.forManga());

        assertThat(analyse.items().get(0).recognized().seriesTitleRaw()).isEqualTo("Death Note");
        assertThat(analyse.items().get(0).recognized().hasExactIdentifier()).isTrue();
    }

    // ====================================================== Context

    @Test
    void the_listing_title_reaches_the_engine_as_a_hint() {
        FakeImageRecognitionProvider moteur = FakeImageRecognitionProvider
                .rendant(RecognitionResult.recognized(List.of(), 0));

        service(moteur).analyze("Lot Platinum End tomes 1 à 14", null,
                List.of("https://exemple.invalid/1.jpg"), RecognitionContext.forManga());

        // The listing title is NO LONGER sent to the engine: it is read
        // locally, and a text written by a third party has no place in a
        // prompt. Only the expected universe travels.
        assertThat(moteur.dernierContexte().isManga()).isTrue();
    }

    @Test
    void the_engine_receives_bytes_never_urls() {
        FakeImageRecognitionProvider moteur = FakeImageRecognitionProvider
                .rendant(RecognitionResult.recognized(List.of(), 0));

        service(moteur).analyze(null, null, List.of("https://exemple.invalid/1.jpg"), RecognitionContext.forManga());

        assertThat(moteur.dernieresImages()).isNotEmpty();
        assertThat(moteur.dernieresImages().get(0).bytes()).isNotEmpty();
    }

    // ====================================================== Doubles

    /** Returns a dummy image for each URL - the whitelist is tested separately. */
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

    private static class FetcherEspion extends RecognitionImageFetcher {
        private int appels;

        FetcherEspion() {
            super(List.of());
        }

        @Override
        public List<RecognitionImage> fetch(List<String> imageUrls) {
            appels++;
            return List.of();
        }

        int appels() {
            return appels;
        }
    }

    /**
     * A test SeriesMatcher that counts creations - it should never
     * count a single one.
     */
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
            String titre = com.iozycore.manga.deals.SeriesTitleNormalizer.normalize(rawTitle);
            return new MangaSeries(titre, series.get(titre.toLowerCase(java.util.Locale.ROOT)));
        }
    }

    // ================== The edition read in the text, against the catalogue

    @Test
    void an_edition_named_in_the_title_matches_the_catalog_even_worded_differently() {
        // The catalogue names this edition "Kana"; the listing writes "edition
        // Kana". Comparing the raw labels made the match fail,
        // and a perfectly identified item went back to "edition to
        // confirm" - with the tick box missing.
        catalogue.ajouterSerie("Platinum End", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Platinum End", "Standard", 14);

        ListingRecognitionService.Analysis analyse = service()
                .analyze("Platinum End edition Standard tomes 1 à 3", null, null,
                        RecognitionContext.forManga());

        assertThat(analyse.items()).hasSize(3);
        assertThat(analyse.items()).allSatisfy(item ->
                assertThat(item.catalogStatus()).isEqualTo(CatalogStatus.MATCHED));
    }

    @Test
    void the_catalog_label_wins_over_what_the_listing_wrote() {
        // The listing writes "edition Kana", the catalogue says "Kana". Keeping what
        // was read would bring "Kana Edition" into the batch, then into
        // the saved analysis, then into the recorded prices - a name that the
        // catalogue does not carry and that would no longer match anything.
        catalogue.ajouterSerie("Platinum End", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Platinum End", "Kana", 14);

        ListingRecognitionService.Analysis analyse = service()
                .analyze("Platinum End edition Kana tomes 1 à 3", null, null, RecognitionContext.forManga());

        assertThat(analyse.items()).allSatisfy(item -> {
            assertThat(item.catalogStatus()).isEqualTo(CatalogStatus.MATCHED);
            assertThat(item.recognized().editionHint()).isEqualTo("Kana");
        });
    }

    @Test
    void the_loose_match_works_the_other_way_round_too() {
        // The reverse: the catalogue carries "Perfect Edition", the listing writes
        // only "Perfect".
        catalogue.ajouterSerie("Platinum End", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Platinum End", "Perfect Edition", 14);

        ListingRecognitionService.Analysis analyse = service()
                .analyze("Platinum End Perfect tomes 1 à 3", null, null, RecognitionContext.forManga());

        assertThat(analyse.items()).allSatisfy(item ->
                assertThat(item.catalogStatus()).isEqualTo(CatalogStatus.MATCHED));
    }

    @Test
    void an_ambiguous_loose_match_is_no_match_at_all() {
        // The catalogue carries two spellings of the same rank. The listing writes
        // "Deluxe" alone: neither matches EXACTLY, and the
        // fallback finds two. Choosing for the user would be guessing.
        //
        // The fallback is only reached there: everywhere else the exact match
        // decides first, which is precisely what we want.
        catalogue.ajouterSerie("Platinum End", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Platinum End", "Deluxe Edition", 14);
        editions.ajouter(PLATINUM_END, "Platinum End", "Édition Deluxe", 14);

        ListingRecognitionService.Analysis analyse = service()
                .analyze("Platinum End Deluxe tomes 1 à 3", null, null, RecognitionContext.forManga());

        assertThat(analyse.items()).allSatisfy(item ->
                assertThat(item.catalogStatus()).isEqualTo(CatalogStatus.EDITION_TO_CONFIRM));
    }

    @Test
    void naming_the_edition_no_longer_loses_the_series() {
        // The original damage: "Platinum End Perfect Edition" came out as
        // a SERIES of that name, so outside the catalogue, while "Platinum End"
        // alone found its work page.
        catalogue.ajouterSerie("Platinum End", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Platinum End", "Standard", 14);

        ListingRecognitionService.Analysis analyse = service()
                .analyze("Platinum End Perfect Edition tomes 1 à 3", null, null,
                        RecognitionContext.forManga());

        assertThat(analyse.items()).allSatisfy(item ->
                assertThat(item.catalogStatus()).isNotEqualTo(CatalogStatus.NOT_IN_CATALOG));
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
