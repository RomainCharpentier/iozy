package com.iozycore.metadata;

import com.iozycore.domain.catalog.EntityType;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class RelatedSeriesServiceTest {

    private static final EntityType MANGA = new EntityType(UUID.randomUUID(), "MANGA", "Manga", Set.of(), Set.of());

    @Test
    void derives_the_distinctive_suffix_shared_with_the_original_title() {
        RelatedSeriesService service = new RelatedSeriesService(
                List.of(new FakeRelatedSeriesProvider(List.of("Blue Lock: Episode Nagi"))));

        List<String> result = service.findExcludedTitleFragments(MANGA, "114745", "Blue Lock");

        assertThat(result).containsExactly("Episode Nagi");
    }

    @Test
    void ignores_a_related_title_that_does_not_share_the_original_titles_prefix() {
        // Cas réel observé (voir historique) : MyAnimeList indexe le spin-off
        // de "Demon Slayer" sous son titre romaji d'origine ("Kimetsu
        // Gakuen!"), sans aucun mot commun avec "Demon Slayer" - rien
        // d'exploitable, limite acceptée.
        RelatedSeriesService service = new RelatedSeriesService(
                List.of(new FakeRelatedSeriesProvider(List.of("Kimetsu Gakuen!"))));

        List<String> result = service.findExcludedTitleFragments(MANGA, "96792", "Demon Slayer");

        assertThat(result).isEmpty();
    }

    @Test
    void ignores_a_suffix_too_short_to_be_compared_safely() {
        // "Tokyo Ghoul:re" + "Tokyo Ghoul" -> "re", trop court (limite
        // acceptée, voir historique - déjà documentée côté
        // GoogleBooksVolumeSearchProvider pour ce cas précis).
        RelatedSeriesService service = new RelatedSeriesService(
                List.of(new FakeRelatedSeriesProvider(List.of("Tokyo Ghoul:re"))));

        List<String> result = service.findExcludedTitleFragments(MANGA, "1", "Tokyo Ghoul");

        assertThat(result).isEmpty();
    }

    @Test
    void keeps_a_short_all_uppercase_suffix_like_an_edition_acronym() {
        // Cas réel signalé par l'utilisateur en testant "Dragon Ball" (voir
        // historique) : "Dragon Ball SD" -> suffixe "SD", seulement 2
        // caractères mais entièrement en majuscules - contrairement au "re"
        // générique ci-dessus, un sigle de ce type est bien assez distinctif
        // pour être comparé sans risque de faux positif.
        RelatedSeriesService service = new RelatedSeriesService(
                List.of(new FakeRelatedSeriesProvider(List.of("Dragon Ball SD"))));

        List<String> result = service.findExcludedTitleFragments(MANGA, "23446", "Dragon Ball");

        assertThat(result).containsExactly("SD");
    }

    @Test
    void returns_empty_without_an_external_id_or_an_original_title() {
        RelatedSeriesService service = new RelatedSeriesService(
                List.of(new FakeRelatedSeriesProvider(List.of("Blue Lock: Episode Nagi"))));

        assertThat(service.findExcludedTitleFragments(MANGA, null, "Blue Lock")).isEmpty();
        assertThat(service.findExcludedTitleFragments(MANGA, "114745", null)).isEmpty();
    }

    @Test
    void caches_the_result_so_a_later_call_does_not_hit_the_provider_again() {
        FakeRelatedSeriesProvider provider = new FakeRelatedSeriesProvider(List.of("Blue Lock: Episode Nagi"));
        RelatedSeriesService service = new RelatedSeriesService(List.of(provider));

        service.findExcludedTitleFragments(MANGA, "114745", "Blue Lock");
        service.findExcludedTitleFragments(MANGA, "114745", "Blue Lock");

        assertThat(provider.callCount).isEqualTo(1);
    }

    private static final class FakeRelatedSeriesProvider implements RelatedSeriesProvider {
        private final List<String> titles;
        int callCount = 0;

        FakeRelatedSeriesProvider(List<String> titles) {
            this.titles = titles;
        }

        @Override
        public boolean supports(EntityType entityType) {
            return "MANGA".equals(entityType.code());
        }

        @Override
        public List<String> findRelatedSeriesTitles(String externalId) {
            callCount++;
            return titles;
        }
    }
}
