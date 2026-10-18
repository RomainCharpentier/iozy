package com.iozycore.manga.metadata;

import com.iozycore.core.domain.catalog.EntityType;
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
        // Real case seen (see history): MyAnimeList indexes the spin-off
        // of "Demon Slayer" under its original romaji title ("Kimetsu
        // Gakuen!"), with no word in common with "Demon Slayer" - nothing
        // usable, accepted limit.
        RelatedSeriesService service = new RelatedSeriesService(
                List.of(new FakeRelatedSeriesProvider(List.of("Kimetsu Gakuen!"))));

        List<String> result = service.findExcludedTitleFragments(MANGA, "96792", "Demon Slayer");

        assertThat(result).isEmpty();
    }

    @Test
    void ignores_a_suffix_too_short_to_be_compared_safely() {
        // "Naruto Ex" + "Naruto" -> "Ex", too short AND neither fully in
        // capitals nor stuck to a ":" (see the two relaxed cases
        // below) - stays filtered, accepted limit.
        RelatedSeriesService service = new RelatedSeriesService(
                List.of(new FakeRelatedSeriesProvider(List.of("Naruto Ex"))));

        List<String> result = service.findExcludedTitleFragments(MANGA, "1", "Naruto");

        assertThat(result).isEmpty();
    }

    @Test
    void keeps_a_short_suffix_glued_to_a_colon_without_a_space() {
        // Real case found while continuing the tests on "Tokyo Ghoul" (see
        // history): "Tokyo Ghoul:re" (tagged "sequel" on MyAnimeList, a
        // sequel with its own story) gives the suffix "re" - only 2
        // characters AND lowercase, but stuck to a ":" WITHOUT a space, a
        // title styling much more distinctive than an isolated generic
        // word - without this relaxation, it came out as a false
        // edition named "Re" with its 10 volumes in the volume search.
        RelatedSeriesService service = new RelatedSeriesService(
                List.of(new FakeRelatedSeriesProvider(List.of("Tokyo Ghoul:re"))));

        List<String> result = service.findExcludedTitleFragments(MANGA, "1", "Tokyo Ghoul");

        assertThat(result).containsExactly("re");
    }

    @Test
    void ignores_a_short_suffix_after_a_colon_followed_by_a_space() {
        // Unlike the case above, a ":" FOLLOWED by a space usually announces
        // a classic descriptive subtitle, not a
        // styled continuation - stays subject to the threshold of 4 characters.
        RelatedSeriesService service = new RelatedSeriesService(
                List.of(new FakeRelatedSeriesProvider(List.of("Tokyo Ghoul: Ex"))));

        List<String> result = service.findExcludedTitleFragments(MANGA, "1", "Tokyo Ghoul");

        assertThat(result).isEmpty();
    }

    @Test
    void keeps_a_short_all_uppercase_suffix_like_an_edition_acronym() {
        // Real case reported by the user while testing "Dragon Ball" (see
        // history): "Dragon Ball SD" -> suffix "SD", only 2
        // characters but fully in capitals - unlike the generic "re"
        // above, an acronym of this type is distinctive enough
        // to be compared with no risk of a false positive.
        RelatedSeriesService service = new RelatedSeriesService(
                List.of(new FakeRelatedSeriesProvider(List.of("Dragon Ball SD"))));

        List<String> result = service.findExcludedTitleFragments(MANGA, "23446", "Dragon Ball");

        assertThat(result).containsExactly("SD");
    }

    @Test
    void keeps_a_single_letter_suffix_when_both_relaxations_apply_at_once() {
        // Real case found while continuing the tests on "Gantz" (see
        // history): "Gantz:E" (tagged "alternative_setting", a spin-off
        // in the alternative universe) gives the suffix "E" - a SINGLE letter,
        // neither the "capital acronym" threshold nor the "stuck to a :" threshold taken
        // alone (2 characters each) is enough, but their combination
        // (capital AND stuck) is an even more distinctive signal -
        // without this relaxation, "Gantz:E" came out as a false
        // edition named "E".
        RelatedSeriesService service = new RelatedSeriesService(
                List.of(new FakeRelatedSeriesProvider(List.of("Gantz:E"))));

        List<String> result = service.findExcludedTitleFragments(MANGA, "123754", "Gantz");

        assertThat(result).containsExactly("E");
    }

    @Test
    void falls_back_to_the_romaji_title_when_the_related_title_does_not_share_the_english_titles_prefix() {
        // Real case reported while testing "Attack on Titan" (see history):
        // the title kept on the client side is the English title ("Attack on
        // Titan"), but MyAnimeList indexes its spin-off "Before the Fall"
        // under the romaji title of the series ("Shingeki no Kyojin") - no
        // link with the English title, but an exact prefix with the romaji.
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
