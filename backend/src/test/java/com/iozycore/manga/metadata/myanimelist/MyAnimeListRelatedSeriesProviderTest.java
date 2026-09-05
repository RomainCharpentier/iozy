package com.iozycore.manga.metadata.myanimelist;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class MyAnimeListRelatedSeriesProviderTest {

    @Test
    void keeps_only_spin_off_side_story_and_sequel_relations() throws Exception {
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
    void keeps_a_sequel_relation() throws Exception {
        // Cas réel observé (voir historique) : "Dragon Ball" (malId 42) a
        // "Dragon Ball Super" comme "sequel" - une suite avec sa propre
        // histoire, jamais une édition de la série d'origine, contrairement
        // à ce que laissait penser son apparition dans les résultats de
        // recherche de tomes ("Super" ressortait comme un nom d'édition).
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
        // Cas réel trouvé en continuant les tests sur "Shaman King" (voir
        // historique) : "Shaman King Zero" (préquelle à l'histoire propre)
        // est taguée "prequel" sur MyAnimeList - jusqu'ici absente de
        // DISTINCT_SERIES_RELATIONS alors que "sequel" y était déjà, sans
        // raison de traiter différemment une préquelle d'une suite.
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
        // Cas réel observé (voir historique, signalé directement par
        // l'utilisateur en testant "Dragon Ball") : "Dragon Ball SD"
        // (parodie chibi à l'histoire distincte) est tagué
        // "alternative_version" sur MyAnimeList, pas "spin_off" - risque
        // assumé de retenir cette catégorie (voir javadoc de la classe) :
        // aucun cas observé où elle désigne une vraie réédition à tort
        // écartée, malgré des tests étendus sur de nombreuses franchises à
        // éditions multiples cette session.
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
        // Cas réel trouvé en continuant les tests sur "Gantz" (voir
        // historique) : "Gantz:E" (spin-off à l'univers alternatif, mêmes
        // personnages, contexte différent) est tagué "alternative_setting"
        // sur MyAnimeList - jusqu'ici volontairement exclue faute de cas
        // concret, PREMIER cas rencontré malgré des tests étendus sur de
        // nombreuses franchises cette session, justifiant de l'ajouter à
        // son tour (même risque assumé que "alternative_version" ci-dessus).
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
