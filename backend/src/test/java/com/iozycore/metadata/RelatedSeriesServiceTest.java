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
        // "Naruto Ex" + "Naruto" -> "Ex", trop court ET ni entièrement en
        // majuscules ni collé à un ":" (voir les deux cas assouplis
        // ci-dessous) - reste filtré, limite acceptée.
        RelatedSeriesService service = new RelatedSeriesService(
                List.of(new FakeRelatedSeriesProvider(List.of("Naruto Ex"))));

        List<String> result = service.findExcludedTitleFragments(MANGA, "1", "Naruto");

        assertThat(result).isEmpty();
    }

    @Test
    void keeps_a_short_suffix_glued_to_a_colon_without_a_space() {
        // Cas réel trouvé en continuant les tests sur "Tokyo Ghoul" (voir
        // historique) : "Tokyo Ghoul:re" (tagué "sequel" sur MyAnimeList, une
        // suite avec sa propre histoire) donne le suffixe "re" - seulement 2
        // caractères ET minuscule, mais collé à un ":" SANS espace, une
        // stylisation de titre bien plus distinctive qu'un mot générique
        // isolé - sans cet assouplissement, il ressortait comme une fausse
        // édition nommée "Re" avec ses 10 tomes dans la recherche de tomes.
        RelatedSeriesService service = new RelatedSeriesService(
                List.of(new FakeRelatedSeriesProvider(List.of("Tokyo Ghoul:re"))));

        List<String> result = service.findExcludedTitleFragments(MANGA, "1", "Tokyo Ghoul");

        assertThat(result).containsExactly("re");
    }

    @Test
    void ignores_a_short_suffix_after_a_colon_followed_by_a_space() {
        // Contrairement au cas ci-dessus, un ":" SUIVI d'un espace annonce
        // d'ordinaire un sous-titre descriptif classique, pas une
        // continuation stylisée - reste soumis au seuil de 4 caractères.
        RelatedSeriesService service = new RelatedSeriesService(
                List.of(new FakeRelatedSeriesProvider(List.of("Tokyo Ghoul: Ex"))));

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
    void falls_back_to_the_romaji_title_when_the_related_title_does_not_share_the_english_titles_prefix() {
        // Cas réel signalé en testant "Attack on Titan" (voir historique) :
        // le titre retenu côté client est le titre anglais ("Attack on
        // Titan"), mais MyAnimeList indexe son spin-off "Before the Fall"
        // sous le titre romaji de la série ("Shingeki no Kyojin") - aucun
        // lien avec le titre anglais, mais un préfixe exact avec le romaji.
        RelatedSeriesService service = new RelatedSeriesService(
                List.of(new FakeRelatedSeriesProvider(List.of("Shingeki no Kyojin: Before the Fall"))));

        List<String> result = service.findExcludedTitleFragments(
                MANGA, "23390", "Attack on Titan", "Shingeki no Kyojin");

        assertThat(result).containsExactly("Before the Fall");
    }

    @Test
    void ignores_the_romaji_title_when_absent_or_identical_to_the_original_title() {
        RelatedSeriesService service = new RelatedSeriesService(
                List.of(new FakeRelatedSeriesProvider(List.of("Blue Lock: Episode Nagi"))));

        assertThat(service.findExcludedTitleFragments(MANGA, "114745", "Blue Lock", null))
                .containsExactly("Episode Nagi");
        assertThat(service.findExcludedTitleFragments(MANGA, "114745", "Blue Lock", "Blue Lock"))
                .containsExactly("Episode Nagi");
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
