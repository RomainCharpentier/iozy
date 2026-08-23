package com.iozycore.recognition;

import com.iozycore.domain.catalog.EditionTier;
import com.iozycore.domain.catalog.MangaEdition;
import com.iozycore.domain.catalog.MangaEditionRepository;
import com.iozycore.purchaseanalysis.MangaSeries;
import com.iozycore.purchaseanalysis.SeriesMatcher;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Le cœur de cette passe : le texte et les photos alimentent <b>une</b> liste,
 * pas deux.
 *
 * <p>La règle qui gouverne tout le reste : la consolidation est une
 * <b>union</b>, jamais une intersection. Une photo qui ne montre pas un livre
 * ne prouve pas son absence, et un titre qui n'annonce pas une édition
 * n'interdit pas de la lire sur une couverture.
 */
class TextAndVisionMergeTest {

    private static final UUID PLATINUM_END = UUID.randomUUID();
    private static final UUID DEATH_NOTE = UUID.randomUUID();

    private final CatalogueDeTest catalogue = new CatalogueDeTest();
    private final EditionsDeTest editions = new EditionsDeTest();

    private ListingRecognitionService service(ImageRecognitionProvider... moteurs) {
        return new ListingRecognitionService(new FetcherDeTest(),
                new RecognitionCatalogResolver(catalogue, editions), List.of(moteurs));
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

    // =================================================== §49 — sources complémentaires

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
        // Les tomes 2 et 3 gardent leur édition inconnue : la photo n'a rien dit
        // d'eux, et supposer « Standard aussi » serait inventer.
        assertThat(items).filteredOn(i -> i.volumeNumber() != 1)
                .allSatisfy(i -> {
                    assertThat(i.editionIsUnknown()).isTrue();
                    assertThat(i.sources()).containsExactly(RecognitionSource.TEXT);
                });
    }

    // =================================================== §50 — doublons entre sources

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

    // =================================================== §51 / §52 — éditions

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

        // Le texte annonce Standard, la photo lit Perfect : personne ne tranche
        // à la place de l'utilisateur.
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

    // =================================================== §11 / §73 — vision n'écrase pas le texte

    @Test
    void volumes_announced_but_not_photographed_are_never_dropped() {
        catalogue.ajouterSerie("Platinum End", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Platinum End", "Standard", 14);

        // Le titre annonce 1 à 14 ; les photos n'en montrent que 12. Une photo
        // qui ne montre pas un livre ne prouve pas son absence.
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

    // =================================================== §54 — contradiction de volume

    @Test
    void a_volume_disagreement_yields_two_correctable_items_never_a_blend() {
        catalogue.ajouterSerie("Platinum End", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Platinum End", "Standard", 14);

        ListingRecognitionService.Analysis analyse = service(FakeImageRecognitionProvider.rendant(
                RecognitionResult.recognized(List.of(vu("Platinum End", 5, null, 0)), 0)))
                .analyze("Platinum End tome 4", null, unePhoto(), RecognitionContext.forManga());

        // Ni fusion arbitraire en 4, ni en 5 : les deux sont proposés, et
        // l'utilisateur retire celui qui n'a pas lieu d'être.
        assertThat(lus(analyse)).extracting(RecognizedItem::volumeNumber)
                .containsExactlyInAnyOrder(4, 5);
    }

    // =================================================== §34 — vision sans texte utile

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

    // =================================================== §57 — aucun appel cloud implicite

    @Test
    void analysing_the_text_alone_never_calls_the_vision_engine() {
        catalogue.ajouterSerie("Platinum End", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Platinum End", "Standard", 14);
        FakeImageRecognitionProvider moteur = FakeImageRecognitionProvider
                .rendant(RecognitionResult.recognized(List.of(), 0));

        ListingRecognitionService.Analysis analyse = service(moteur)
                .analyze("Platinum End intégrale tomes 1 à 14", null, null, RecognitionContext.forManga());

        // Le point entier de cette passe : une annonce bien rédigée est comprise
        // sans le moindre appel payant.
        assertThat(moteur.appels()).isZero();
        assertThat(analyse.items()).hasSize(14);
        assertThat(analyse.textItemCount()).isEqualTo(14);
        // Aucune photo demandée : ce n'est pas un échec de lecture, c'est
        // l'absence de question.
        assertThat(analyse.visionStatus()).isNull();
    }

    @Test
    void an_empty_photo_list_is_also_a_text_only_request() {
        FakeImageRecognitionProvider moteur = FakeImageRecognitionProvider
                .rendant(RecognitionResult.recognized(List.of(), 0));

        service(moteur).analyze("Platinum End tome 4", null, List.of(), RecognitionContext.forManga());

        assertThat(moteur.appels()).isZero();
    }

    // =================================================== §62 — dégradations

    @Test
    void a_failing_vision_engine_leaves_the_text_proposals_standing() {
        catalogue.ajouterSerie("Platinum End", PLATINUM_END);
        editions.ajouter(PLATINUM_END, "Platinum End", "Standard", 14);

        ListingRecognitionService.Analysis analyse = service(FakeImageRecognitionProvider.quiExplose())
                .analyze("Platinum End tomes 1 à 3", null, unePhoto(), RecognitionContext.forManga());

        assertThat(analyse.visionStatus()).isEqualTo(RecognitionStatus.UNAVAILABLE);
        // Ce que le texte disait reste vrai même si le moteur tombe.
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
                List.of(FakeImageRecognitionProvider.rendant(RecognitionResult.recognized(List.of(), 0))));

        ListingRecognitionService.Analysis analyse = service
                .analyze("Platinum End tomes 1 à 3", null, unePhoto(), RecognitionContext.forManga());

        assertThat(analyse.visionStatus()).isEqualTo(RecognitionStatus.NO_USABLE_IMAGE);
        assertThat(analyse.items()).hasSize(3);
    }

    // =================================================== Décoration d'annonce

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
        // Même hors catalogue : « 🔥 Série inconnue » ne doit pas entrer tel
        // quel dans le lot puis dans l'analyse enregistrée.
        ListingRecognitionService.Analysis analyse = service()
                .analyze("🔥 Serie hors catalogue tomes 1 à 2", null, null, RecognitionContext.forManga());

        assertThat(analyse.items()).isNotEmpty();
        assertThat(analyse.items()).allSatisfy(item -> {
            assertThat(item.displayTitle()).doesNotContain("🔥");
            // La provenance reste lisible : on n'efface pas ce que l'annonce disait.
            assertThat(item.recognized().seriesTitleRaw()).contains("🔥");
        });
    }

    // =================================================== §22 — aucune création

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

    // =================================================== Doublures

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
            // La doublure applique la MÊME normalisation que le vrai matcher :
            // s'en dispenser la ferait diverger du comportement réel, et les
            // tests vérifieraient alors une chose qui n'existe pas.
            String titre = com.iozycore.purchaseanalysis.SeriesTitleNormalizer.normalize(rawTitle);
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
}
