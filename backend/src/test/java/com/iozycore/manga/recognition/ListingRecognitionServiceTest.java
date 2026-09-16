package com.iozycore.manga.recognition;

import com.iozycore.manga.domain.EditionTier;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import com.iozycore.manga.deals.MangaSeries;
import com.iozycore.manga.deals.SeriesMatcher;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import com.iozycore.manga.deals.SeriesTitleNormalizer;

/**
 * Le pipeline complet, avec un faux moteur : photos -> lecture -> consolidation
 * -> catalogue -> propositions.
 *
 * <p>Deux invariants dominent cette classe, et ils tiennent tout le chantier :
 * <b>rien n'est jamais créé</b>, et <b>une panne de moteur ne bloque rien</b>.
 */
class ListingRecognitionServiceTest {

    private static final UUID PLATINUM_END = UUID.randomUUID();

    private final CatalogueDeTest catalogue = new CatalogueDeTest();
    private final EditionsDeTest editions = new EditionsDeTest();

    /**
     * Ces tests portent sur l'orchestration texte/vision. Un lecteur de
     * codes-barres qui trouverait quelque chose sur les images de test
     * ajouterait une source et brouillerait ce qu'ils mesurent - la chaîne
     * code-barres a ses propres tests.
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

        // Pas UNAVAILABLE : l'écran ne doit pas inviter à réessayer tout de suite.
        assertThat(analyse.visionStatus()).isEqualTo(RecognitionStatus.QUOTA_EXCEEDED);
        assertThat(analyse.items()).isEmpty();
        assertThat(analyse.analyzedImageCount()).isEqualTo(1);
    }

    // ====================================================== Le cas nominal

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

    // ====================================================== Doublons entre photos

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

    // ====================================================== Ambiguïté d'édition

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
        assertThat(item.recognized().editionHint()).as("aucune édition inventée").isNull();
        assertThat(item.editionOptions()).extracting(ResolvedItem.EditionOption::editionName)
                .containsExactly("Standard", "Black Edition");
        assertThat(item.preselected()).as("un doute ne se pré-coche pas").isFalse();
        assertThat(item.readyForAnalysis()).isFalse();
    }

    @Test
    void a_single_known_edition_is_still_not_chosen_automatically() {
        // Le catalogue peut ignorer une seconde édition que le lot contient.
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

    // ====================================================== Hors catalogue

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

        // L'invariant central du chantier.
        assertThat(catalogue.creations()).as("aucune fiche créée par une reconnaissance").isZero();
        assertThat(editions.creations()).as("aucune édition créée par une reconnaissance").isZero();
    }

    @Test
    void a_recognition_never_creates_an_entity_even_when_confidence_is_high() {
        service(FakeImageRecognitionProvider.rendant(RecognitionResult.recognized(List.of(
                vu("Une autre série absente", 3, "Perfect", RecognitionConfidence.HIGH, 0)), 0)))
                .analyze(null, null, List.of("https://exemple.invalid/1.jpg"), RecognitionContext.forManga());

        assertThat(catalogue.creations()).isZero();
    }

    // ====================================================== Non identifiés

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

    // ====================================================== Pannes

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

        // V2 : aucune photo demandee n'est PAS un echec de lecture, c'est
        // l'absence de question. visionStatus reste null, et le moteur dort.
        assertThat(analyse.visionStatus()).isNull();
        assertThat(moteur.appels()).isZero();
    }

    @Test
    void without_a_vision_engine_the_photos_are_STILL_read_for_barcodes() {
        // Cet invariant a été INVERSÉ, et volontairement.
        //
        // Il disait « inutile de solliciter un CDN pour un résultat qu'on ne
        // peut pas produire ». C'était vrai tant que seule la vision savait
        // lire une photo. Depuis, les codes-barres se lisent en local et
        // gratuitement : un lot photographié de dos peut être entièrement
        // identifié sans le moindre moteur, et avec des identifiants EXACTS
        // là où un modèle n'aurait produit que des suppositions.
        //
        // Ne pas télécharger reviendrait à refuser la meilleure des trois
        // sources parce que la moins fiable est absente.
        FetcherEspion espion = new FetcherEspion();
        ListingRecognitionService service = new ListingRecognitionService(
                espion, new RecognitionCatalogResolver(catalogue, editions), List.of(), SANS_CODE_BARRES);

        service.analyze(null, null, List.of("https://exemple.invalid/1.jpg"), RecognitionContext.forManga());

        assertThat(espion.appels()).isEqualTo(1);
    }

    @Test
    void without_a_vision_engine_the_status_still_says_the_vision_did_not_run() {
        // NO_ENGINE décrit la VISION, pas l'analyse entière : l'écran doit
        // continuer à dire qu'elle n'a pas tourné, même si les codes-barres
        // ont donné quelque chose.
        ListingRecognitionService service = new ListingRecognitionService(
                new FetcherDeTest(), new RecognitionCatalogResolver(catalogue, editions),
                List.of(), SANS_CODE_BARRES);

        ListingRecognitionService.Analysis analyse = service.analyze(
                "Platinum End tomes 1 à 3", null,
                List.of("https://exemple.invalid/1.jpg"), RecognitionContext.forManga());

        assertThat(analyse.visionStatus()).isEqualTo(RecognitionStatus.NO_ENGINE);
        // Et les propositions du texte tiennent toujours.
        assertThat(analyse.items()).hasSize(3);
    }

    // ====================================================== Priorité EAN

    @Test
    void an_exact_identifier_outranks_a_visual_guess() {
        RecognizedItem visuel = vu("Platinum End", 1, null, RecognitionConfidence.HIGH, 0);
        RecognizedItem avecEan = RecognizedItem.fromVision("Death Note", 1, null, "9782505000000",
                RecognitionConfidence.LOW, List.of(), Set.of(1));

        ListingRecognitionService.Analysis analyse = service(FakeImageRecognitionProvider.rendant(
                RecognitionResult.recognized(List.of(visuel, avecEan), 0)))
                .analyze(null, null, List.of("https://exemple.invalid/1.jpg"), RecognitionContext.forManga());

        // Un code-barres correspond ou ne correspond pas ; un titre « ressemble ».
        assertThat(analyse.items().get(0).recognized().hasExactIdentifier()).isTrue();
    }

    @Test
    void an_exact_identifier_survives_consolidation_and_reaches_the_catalog_phase() {
        // La priorité déterministe ne doit pas se perdre en route : l'EAN lu sur
        // une photo doit être encore là après fusion, pour que la résolution
        // catalogue/metadata puisse s'en servir plutôt que du titre lu.
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
        // Confiance HIGH sur une lecture visuelle contre LOW sur un EAN :
        // l'identifiant exact passe quand même devant. Un code-barres
        // correspond ou ne correspond pas ; un titre « ressemble ».
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

    // ====================================================== Contexte

    @Test
    void the_listing_title_reaches_the_engine_as_a_hint() {
        FakeImageRecognitionProvider moteur = FakeImageRecognitionProvider
                .rendant(RecognitionResult.recognized(List.of(), 0));

        service(moteur).analyze("Lot Platinum End tomes 1 à 14", null,
                List.of("https://exemple.invalid/1.jpg"), RecognitionContext.forManga());

        // Le titre de l'annonce n'est PLUS transmis au moteur : il est lu
        // localement, et un texte écrit par un tiers n'a rien à faire dans un
        // prompt. Seul l'univers attendu voyage.
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

    // ====================================================== Doublures

    /** Rend une image factice pour chaque URL - la liste blanche est testée à part. */
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
     * Un SeriesMatcher de test qui compte les créations - il ne devrait jamais
     * en compter une seule.
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
            // La doublure applique la MÊME normalisation que le vrai matcher :
            // s'en dispenser la ferait diverger du comportement réel, et les
            // tests vérifieraient alors une chose qui n'existe pas.
            String titre = com.iozycore.manga.deals.SeriesTitleNormalizer.normalize(rawTitle);
            return new MangaSeries(titre, series.get(titre.toLowerCase(java.util.Locale.ROOT)));
        }
    }

    private static class EditionsDeTest implements MangaEditionRepository {
        private final List<MangaEdition> editions = new ArrayList<>();
        private int creations;

        void ajouter(UUID entityId, String serie, String edition, Integer totalVolumes) {
            editions.add(new MangaEdition(UUID.randomUUID(), entityId, serie, edition, EditionTier.STANDARD,
                    null, totalVolumes, null, false, false, null, null, null, null));
        }

        int creations() {
            return creations;
        }

        @Override
        public MangaEdition save(MangaEdition edition) {
            creations++;
            editions.add(edition);
            return edition;
        }

        @Override
        public Optional<MangaEdition> findById(UUID id) {
            return editions.stream().filter(e -> e.id().equals(id)).findFirst();
        }

        @Override
        public Optional<MangaEdition> findBySeriesAndEdition(String seriesTitle, String editionName) {
            return editions.stream()
                    .filter(e -> e.seriesTitle().equalsIgnoreCase(seriesTitle)
                            && e.editionName().equalsIgnoreCase(editionName))
                    .findFirst();
        }

        @Override
        public List<MangaEdition> findBySeriesTitle(String seriesTitle) {
            return editions.stream().filter(e -> e.seriesTitle().equalsIgnoreCase(seriesTitle)).toList();
        }

        @Override
        public List<MangaEdition> findByEntityId(UUID entityId) {
            return editions.stream().filter(e -> entityId.equals(e.entityId())).toList();
        }

        @Override
        public List<MangaEdition> findAll() {
            return List.copyOf(editions);
        }

        @Override
        public void deleteById(UUID id) {
            editions.removeIf(e -> e.id().equals(id));
        }

        @Override
        public Optional<MangaEdition> findByEntityIdAndEditionName(UUID entityId, String editionName) {
            return editions.stream()
                    .filter(e -> entityId.equals(e.entityId()) && e.editionName().equalsIgnoreCase(editionName))
                    .findFirst();
        }
    }

    // ================== L'edition lue dans le texte, face au catalogue

    @Test
    void an_edition_named_in_the_title_matches_the_catalog_even_worded_differently() {
        // Le catalogue nomme cette edition « Kana » ; l'annonce ecrit « edition
        // Kana ». Comparer les libelles bruts faisait echouer le rapprochement,
        // et un element parfaitement identifie repassait en « edition a
        // confirmer » - avec la case a cocher en moins.
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
        // L'annonce ecrit « edition Kana », le catalogue dit « Kana ». Garder ce
        // qui a ete lu ferait entrer « Kana Edition » dans le lot, puis dans
        // l'analyse enregistree, puis dans les prix releves - un nom que le
        // catalogue ne porte pas et qui ne se rapprocherait plus de rien.
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
        // L'inverse : le catalogue porte « Perfect Edition », l'annonce ecrit
        // seulement « Perfect ».
        catalogue.ajouterSerie("Platinum End", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Platinum End", "Perfect Edition", 14);

        ListingRecognitionService.Analysis analyse = service()
                .analyze("Platinum End Perfect tomes 1 à 3", null, null, RecognitionContext.forManga());

        assertThat(analyse.items()).allSatisfy(item ->
                assertThat(item.catalogStatus()).isEqualTo(CatalogStatus.MATCHED));
    }

    @Test
    void an_ambiguous_loose_match_is_no_match_at_all() {
        // Le catalogue porte deux orthographes du meme rang. L'annonce ecrit
        // « Deluxe » seul : aucune des deux ne correspond EXACTEMENT, et le
        // repli en trouve deux. Choisir pour l'utilisateur serait deviner.
        //
        // Le repli n'est atteint que la : partout ailleurs le match exact
        // tranche d'abord, ce qui est precisement ce qu'on veut.
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
        // Le degat d'origine : « Platinum End Perfect Edition » ressortait comme
        // une SERIE de ce nom, donc hors catalogue, alors que « Platinum End »
        // seul retrouvait sa fiche.
        catalogue.ajouterSerie("Platinum End", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Platinum End", "Standard", 14);

        ListingRecognitionService.Analysis analyse = service()
                .analyze("Platinum End Perfect Edition tomes 1 à 3", null, null,
                        RecognitionContext.forManga());

        assertThat(analyse.items()).allSatisfy(item ->
                assertThat(item.catalogStatus()).isNotEqualTo(CatalogStatus.NOT_IN_CATALOG));
    }
}
