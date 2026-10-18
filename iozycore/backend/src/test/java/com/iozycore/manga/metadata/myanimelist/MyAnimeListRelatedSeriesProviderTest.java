package com.iozycore.manga.metadata.myanimelist;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class MyAnimeListRelatedSeriesProviderTest {

    @Test
    void keeps_only_spin_off_side_story_and_sequel_relations() throws Exception {
        // Fixture based on the real response observed for "Blue Lock"
        // (malId 114745, checked manually, see history) - includes an
        // "adaptation" (novel) that must NOT come out.
        MyAnimeListRelatedSeriesProvider provider = new MyAnimeListRelatedSeriesProvider();
        String body = """
                {
                  "related_manga": [
                    { "node": { "id": 144695, "title": "Blue Lock: Episode Nagi" }, "relation_type": "spin_off", "relation_type_formatted": "Spin-off" },
                    { "node": { "id": 154487, "title": "Shousetsu Blue Lock" }, "relation_type": "adaptation", "relation_type_formatted": "Adaptation" }
                  ]
                }
                """;

        List<String> result = provider.parse(body);

        assertThat(result).containsExactly("Blue Lock: Episode Nagi");
    }

    @Test
    void keeps_a_sequel_relation() throws Exception {
        // Real case observed (see history): "Dragon Ball" (malId 42) has
        // "Dragon Ball Super" as "sequel" - a sequel with its own
        // story, never an edition of the original series, contrary
        // to what its appearance in the volume search results
        // suggested ("Super" came out as an edition name).
        MyAnimeListRelatedSeriesProvider provider = new MyAnimeListRelatedSeriesProvider();
        String body = """
                {
                  "related_manga": [
                    { "node": { "id": 89734, "title": "Dragon Ball Super" }, "relation_type": "sequel" }
                  ]
                }
                """;

        List<String> result = provider.parse(body);

        assertThat(result).containsExactly("Dragon Ball Super");
    }

    @Test
    void keeps_a_prequel_relation() throws Exception {
        // Real case found while continuing the tests on "Shaman King" (see
        // history): "Shaman King Zero" (prequel with its own story)
        // is tagged "prequel" on MyAnimeList - until now missing from
        // DISTINCT_SERIES_RELATIONS while "sequel" was already there, with no
        // reason to treat a prequel differently from a sequel.
        MyAnimeListRelatedSeriesProvider provider = new MyAnimeListRelatedSeriesProvider();
        String body = """
                {
                  "related_manga": [
                    { "node": { "id": 33389, "title": "Shaman King Zero" }, "relation_type": "prequel" }
                  ]
                }
                """;

        List<String> result = provider.parse(body);

        assertThat(result).containsExactly("Shaman King Zero");
    }

    @Test
    void keeps_an_alternative_version_relation() throws Exception {
        // Real case observed (see history, reported directly by
        // the user while testing "Dragon Ball"): "Dragon Ball SD"
        // (chibi parody with a distinct story) is tagged
        // "alternative_version" on MyAnimeList, not "spin_off" - accepted risk
        // in keeping this category (see the class javadoc):
        // no observed case where it wrongly designates a real reissue
        // that was discarded, despite extensive tests on many franchises with
        // multiple editions this session.
        MyAnimeListRelatedSeriesProvider provider = new MyAnimeListRelatedSeriesProvider();
        String body = """
                {
                  "related_manga": [
                    { "node": { "id": 23446, "title": "Dragon Ball SD" }, "relation_type": "alternative_version" }
                  ]
                }
                """;

        List<String> result = provider.parse(body);

        assertThat(result).containsExactly("Dragon Ball SD");
    }

    @Test
    void keeps_an_alternative_setting_relation() throws Exception {
        // Real case found while continuing the tests on "Gantz" (see
        // history): "Gantz:E" (spin-off in the alternative universe, same
        // characters, different context) is tagged "alternative_setting"
        // on MyAnimeList - until now deliberately excluded for lack of a
        // concrete case, FIRST case met despite extensive tests on
        // many franchises this session, justifying adding it
        // in turn (same accepted risk as "alternative_version" above).
        MyAnimeListRelatedSeriesProvider provider = new MyAnimeListRelatedSeriesProvider();
        String body = """
                {
                  "related_manga": [
                    { "node": { "id": 123754, "title": "Gantz:E" }, "relation_type": "alternative_setting" }
                  ]
                }
                """;

        List<String> result = provider.parse(body);

        assertThat(result).containsExactly("Gantz:E");
    }

    @Test
    void returns_empty_when_there_is_no_related_manga_field() throws Exception {
        MyAnimeListRelatedSeriesProvider provider = new MyAnimeListRelatedSeriesProvider();

        List<String> result = provider.parse("{}");

        assertThat(result).isEmpty();
    }
}
