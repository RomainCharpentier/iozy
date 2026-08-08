package com.iozycore.metadata.myanimelist;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class MyAnimeListRelatedSeriesProviderTest {

    @Test
    void keeps_only_spin_off_and_side_story_relations() throws Exception {
        // Fixture basée sur la vraie réponse observée pour "Blue Lock"
        // (malId 114745, vérifié manuellement, voir historique) - inclut une
        // "adaptation" (roman) qui ne doit PAS ressortir.
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
    void excludes_alternative_version_since_it_is_often_a_legitimate_reedition() throws Exception {
        // Une "alternative_version" désigne souvent une vraie réédition
        // (kanzenban, couleur...) qu'on veut au contraire GARDER comme
        // résultat de recherche de tomes, pas exclure.
        MyAnimeListRelatedSeriesProvider provider = new MyAnimeListRelatedSeriesProvider();
        String body = """
                {
                  "related_manga": [
                    { "node": { "id": 1, "title": "Some Manga (Full Color Edition)" }, "relation_type": "alternative_version" }
                  ]
                }
                """;

        List<String> result = provider.parse(body);

        assertThat(result).isEmpty();
    }

    @Test
    void returns_empty_when_there_is_no_related_manga_field() throws Exception {
        MyAnimeListRelatedSeriesProvider provider = new MyAnimeListRelatedSeriesProvider();

        List<String> result = provider.parse("{}");

        assertThat(result).isEmpty();
    }
}
