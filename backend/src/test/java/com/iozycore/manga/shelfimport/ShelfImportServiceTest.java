package com.iozycore.manga.shelfimport;

import com.iozycore.core.application.QuickAddService;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.catalog.VariantLabels;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.manga.recognition.CatalogStatus;
import com.iozycore.manga.recognition.ListingRecognitionService;
import com.iozycore.manga.recognition.RecognitionConfidence;
import com.iozycore.manga.recognition.RecognitionStatus;
import com.iozycore.manga.recognition.RecognizedItem;
import com.iozycore.manga.recognition.ResolvedItem;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Ce que l'import d'étagère ajoute à la lecture des photos : « déjà possédé »
 * et « fiche proposée » à l'analyse, la déduplication à l'écriture. La lecture
 * elle-même est celle de ListingRecognitionService, testée chez lui.
 */
class ShelfImportServiceTest {

    private static final EntityType MANGA = new EntityType(UUID.randomUUID(), "MANGA", "Manga",
            Set.of("READ"), Set.of(), null, null, null);

    private final CatalogueDeTest catalogue = new CatalogueDeTest();
    private final AjoutDeTest ajout = new AjoutDeTest();

    private ShelfImportService service(ResolvedItem... lus) {
        return new ShelfImportService((photos, demandees) -> new ListingRecognitionService.Analysis(
                RecognitionStatus.OK, List.of(lus), 0, 0, photos.size(), demandees, null, null),
                catalogue, ajout);
    }

    private static ResolvedItem connu(UUID entityId, String titre, Integer tome, String edition) {
        return new ResolvedItem(RecognizedItem.fromVision(titre, tome, edition, null, RecognitionConfidence.HIGH,
                List.of(), Set.of(0)), CatalogStatus.MATCHED, entityId, titre, List.of(), true);
    }

    private static ResolvedItem inconnu(String titre, Integer tome) {
        return new ResolvedItem(RecognizedItem.fromVision(titre, tome, null, null, RecognitionConfidence.HIGH,
                List.of(), Set.of(0)), CatalogStatus.NOT_IN_CATALOG, null, titre, List.of(), true);
    }

    // ================================================================ Déjà possédé

    @Test
    void a_volume_still_owned_is_flagged_whatever_its_edition() {
        Entity naruto = catalogue.serie("Naruto");
        Variant tome4 = catalogue.tome(naruto, 4, "Kana");
        catalogue.possede(naruto, tome4);

        ShelfAnalysis analyse = service(
                connu(naruto.id(), "Naruto", 4, "Hokage"),
                connu(naruto.id(), "Naruto", 5, "Kana")).analyze(List.of(), 1);

        assertThat(analyse.items()).extracting(ShelfItem::alreadyOwned).containsExactly(true, false);
    }

    @Test
    void a_sold_volume_or_a_series_level_ownership_does_not_count() {
        Entity naruto = catalogue.serie("Naruto");
        Variant tome4 = catalogue.tome(naruto, 4, "Kana");
        catalogue.possede(naruto, tome4).markSold();
        catalogue.possede(naruto, null);

        ShelfAnalysis analyse = service(connu(naruto.id(), "Naruto", 4, "Kana")).analyze(List.of(), 1);

        assertThat(analyse.items().get(0).alreadyOwned()).isFalse();
    }

    @Test
    void a_volume_without_a_readable_number_is_never_flagged() {
        Entity naruto = catalogue.serie("Naruto");
        catalogue.possede(naruto, catalogue.tome(naruto, 4, "Kana"));

        ShelfAnalysis analyse = service(connu(naruto.id(), "Naruto", null, "Kana")).analyze(List.of(), 1);

        assertThat(analyse.items().get(0).alreadyOwned()).isFalse();
    }

    // ================================================================ Fiche proposée

    @Test
    void an_unknown_series_gets_the_exactly_titled_sheet_even_if_listed_second() {
        catalogue.source("Naruto", fiche("Boruto : Naruto Next Generations"), fiche("Naruto"));

        ShelfAnalysis analyse = service(inconnu("NARUTO", 1)).analyze(List.of(), 1);

        assertThat(analyse.items().get(0).proposal()).isNotNull();
        assertThat(analyse.items().get(0).proposal().title()).isEqualTo("Naruto");
    }

    @Test
    void a_sheet_containing_every_word_read_is_proposed_when_no_exact_title_exists() {
        catalogue.source("Attaque des Titans", fiche("L'Attaque des Titans"));

        ShelfAnalysis analyse = service(inconnu("Attaque des Titans", 3)).analyze(List.of(), 1);

        assertThat(analyse.items().get(0).proposal().title()).isEqualTo("L'Attaque des Titans");
    }

    @Test
    void nothing_is_proposed_when_no_sheet_matches_the_title_read() {
        catalogue.source("Naruto", fiche("Bleach"));

        ShelfAnalysis analyse = service(inconnu("Naruto", 1)).analyze(List.of(), 1);

        assertThat(analyse.items().get(0).proposal()).isNull();
    }

    @Test
    void a_known_series_is_never_looked_up_at_the_sources() {
        Entity naruto = catalogue.serie("Naruto");
        catalogue.source("Naruto", fiche("Naruto"));

        service(connu(naruto.id(), "Naruto", 1, "Kana")).analyze(List.of(), 1);

        assertThat(catalogue.recherches).isEmpty();
    }

    @Test
    void lookups_are_made_once_per_title_and_capped() {
        List<ResolvedItem> lus = new ArrayList<>();
        for (int i = 1; i <= ShelfImportService.RECHERCHES_MAX + 2; i++) {
            lus.add(inconnu("Série " + i, 1));
        }
        lus.add(inconnu("Série 1", 2));

        ShelfAnalysis analyse = service(lus.toArray(new ResolvedItem[0])).analyze(List.of(), 1);

        assertThat(catalogue.recherches).hasSize(ShelfImportService.RECHERCHES_MAX);
        assertThat(analyse.lookupsSkipped()).isEqualTo(2);
    }

    @Test
    void a_failing_source_leaves_the_item_without_sheet_and_the_analysis_intact() {
        catalogue.enPanne = true;

        ShelfAnalysis analyse = service(inconnu("Naruto", 1)).analyze(List.of(), 1);

        assertThat(analyse.items()).hasSize(1);
        assertThat(analyse.items().get(0).proposal()).isNull();
    }

    // ================================================================ Écriture

    @Test
    void apply_adds_each_confirmed_volume_through_quick_add_and_reports_created_series() {
        ShelfImportReport rapport = service().apply(List.of(
                new ItemToImport("Naruto", 1, "Kana", Map.of("mangaka", "Kishimoto"), "https://img/naruto.jpg"),
                new ItemToImport("Naruto", 2, "Kana", Map.of(), null)));

        assertThat(ajout.appels).hasSize(2);
        assertThat(ajout.appels.get(0).attributes())
                .containsEntry("mangaka", "Kishimoto")
                .containsEntry("coverImageUrl", "https://img/naruto.jpg");
        assertThat(ajout.appels.get(0).edition()).isEqualTo("Kana");
        assertThat(rapport.added()).isEqualTo(2);
        assertThat(rapport.seriesCreated()).isEqualTo(1);
        assertThat(rapport.items().get(0).seriesCreated()).isTrue();
        assertThat(rapport.items().get(1).seriesCreated()).isFalse();
    }

    @Test
    void apply_skips_a_volume_still_owned_without_calling_quick_add() {
        Entity naruto = catalogue.serie("Naruto");
        catalogue.possede(naruto, catalogue.tome(naruto, 4, "Kana"));

        ShelfImportReport rapport = service().apply(List.of(
                new ItemToImport("Naruto", 4, null, Map.of(), null),
                new ItemToImport("Naruto", 5, null, Map.of(), null)));

        assertThat(ajout.appels).extracting(Appel::volumeNumber).containsExactly(5);
        assertThat(rapport.alreadyOwned()).isEqualTo(1);
        assertThat(rapport.items().get(0).outcome()).isEqualTo(ShelfImportReport.Outcome.ALREADY_OWNED);
        assertThat(rapport.items().get(0).entityId()).isEqualTo(naruto.id());
    }

    @Test
    void a_blank_edition_is_sent_as_no_edition() {
        service().apply(List.of(new ItemToImport("Naruto", 1, "   ", Map.of(), null)));

        assertThat(ajout.appels.get(0).edition()).isNull();
    }

    @Test
    void an_item_without_title_or_with_a_zero_volume_is_refused() {
        assertThatThrownBy(() -> new ItemToImport(" ", 1, null, Map.of(), null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new ItemToImport("Naruto", 0, null, Map.of(), null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ================================================================ Fakes

    private static MetadataCandidate fiche(String titre) {
        return new MetadataCandidate("SOURCE_DE_TEST", "id-" + titre, titre, null, Map.of());
    }

    private record Appel(String title, Map<String, Object> attributes, int volumeNumber, String edition) {
    }

    private static class AjoutDeTest implements ShelfImportService.Ajout {
        private final List<Appel> appels = new ArrayList<>();
        private final Map<String, UUID> series = new HashMap<>();

        @Override
        public QuickAddService.QuickAddResult ajouter(UUID entityTypeId, String title, Map<String, Object> attributes,
                                                      int volumeNumber, String edition) {
            appels.add(new Appel(title, attributes, volumeNumber, edition));
            boolean existait = series.containsKey(title);
            UUID id = series.computeIfAbsent(title, t -> UUID.randomUUID());
            return new QuickAddService.QuickAddResult(id, existait, UUID.randomUUID(), false);
        }
    }

    private static class CatalogueDeTest implements ShelfImportService.Catalogue {
        private final Map<UUID, Entity> entites = new HashMap<>();
        private final Map<UUID, List<Ownership>> possessions = new HashMap<>();
        private final Map<String, List<MetadataCandidate>> fiches = new HashMap<>();
        private final List<String> recherches = new ArrayList<>();
        private boolean enPanne;

        Entity serie(String titre) {
            Entity entite = Entity.create(MANGA.id(), titre);
            entites.put(entite.id(), entite);
            return entite;
        }

        Variant tome(Entity serie, int numero, String edition) {
            return serie.addVariant(VariantLabels.of(numero, edition),
                    Map.of("volumeNumber", numero, "edition", edition));
        }

        Ownership possede(Entity serie, Variant tome) {
            Ownership possession = Ownership.acquire(serie.id(), tome == null ? null : tome.id(),
                    OwnershipCondition.NEW, LocalDate.now(), null);
            possessions.computeIfAbsent(serie.id(), id -> new ArrayList<>()).add(possession);
            return possession;
        }

        void source(String requete, MetadataCandidate... resultats) {
            fiches.put(requete.toLowerCase(java.util.Locale.ROOT), List.of(resultats));
        }

        @Override
        public Optional<EntityType> mangaType() {
            return Optional.of(MANGA);
        }

        @Override
        public Optional<Entity> entity(UUID id) {
            return Optional.ofNullable(entites.get(id));
        }

        @Override
        public Optional<Entity> entityByTitle(UUID entityTypeId, String title) {
            return entites.values().stream().filter(e -> e.title().equalsIgnoreCase(title)).findFirst();
        }

        @Override
        public List<Ownership> ownerships(UUID entityId) {
            return possessions.getOrDefault(entityId, List.of());
        }

        @Override
        public List<MetadataCandidate> chercher(EntityType type, String titre) {
            recherches.add(titre);
            if (enPanne) {
                throw new IllegalStateException("Source de test indisponible");
            }
            return fiches.getOrDefault(titre.toLowerCase(java.util.Locale.ROOT), List.of());
        }
    }
}
