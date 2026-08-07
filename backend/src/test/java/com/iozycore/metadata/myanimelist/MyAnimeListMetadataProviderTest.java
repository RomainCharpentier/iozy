package com.iozycore.metadata.myanimelist;

import com.iozycore.domain.catalog.EntityType;
import com.iozycore.metadata.MetadataCandidate;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class MyAnimeListMetadataProviderTest {

    // Forme documentée de l'API officielle MyAnimeList v2 (endpoint de
    // recherche manga), avec les champs demandés via `fields` (voir
    // MyAnimeListMetadataProvider.SEARCH_URL) : authors{first_name,last_name},
    // serialization{name}, status, main_picture.
    private static final String SAMPLE_RESPONSE = """
            {
              "data": [
                {
                  "node": {
                    "id": 11,
                    "title": "Naruto",
                    "main_picture": {
                      "medium": "https://example.com/naruto-medium.jpg",
                      "large": "https://example.com/naruto-large.jpg"
                    },
                    "authors": [
                      { "node": { "id": 1, "first_name": "Masashi", "last_name": "Kishimoto" }, "role": "Story & Art" }
                    ],
                    "serialization": [
                      { "node": { "id": 83, "name": "Weekly Shonen Jump" } }
                    ],
                    "status": "finished",
                    "media_type": "manga",
                    "start_date": "1999-09-21",
                    "alternative_titles": { "en": "Naruto: The Complete Ninja Saga", "ja": "ナルト" }
                  }
                }
              ],
              "paging": {}
            }
            """;

    @Test
    void prefers_the_english_title_over_the_romaji_default_and_keeps_the_original_as_an_attribute() throws Exception {
        MyAnimeListMetadataProvider provider = new MyAnimeListMetadataProvider();

        List<MetadataCandidate> candidates = provider.parse(SAMPLE_RESPONSE);

        assertThat(candidates).hasSize(1);
        MetadataCandidate candidate = candidates.get(0);
        assertThat(candidate.source()).isEqualTo("MYANIMELIST");
        assertThat(candidate.title()).isEqualTo("Naruto: The Complete Ninja Saga");
        assertThat(candidate.imageUrl()).isEqualTo("https://example.com/naruto-large.jpg");
        assertThat(candidate.attributes()).containsEntry("mangaka", "Masashi Kishimoto");
        assertThat(candidate.attributes()).containsEntry("publisher", "Weekly Shonen Jump");
        assertThat(candidate.attributes()).containsEntry("seriesStatus", "finished");
        assertThat(candidate.attributes()).containsEntry("mediaType", "manga");
        assertThat(candidate.attributes()).containsEntry("startYear", "1999");
        assertThat(candidate.attributes()).containsEntry("originalTitle", "Naruto");
        assertThat(candidate.attributes()).containsEntry("titleJapanese", "ナルト");
        assertThat(candidate.attributes()).containsEntry("titleRomaji", "Naruto");
        assertThat(candidate.attributes()).containsEntry("titleEnglish", "Naruto: The Complete Ninja Saga");
    }

    @Test
    void keeps_the_default_title_and_adds_no_originalTitle_when_english_title_is_identical() throws Exception {
        MyAnimeListMetadataProvider provider = new MyAnimeListMetadataProvider();
        String body = """
                {
                  "data": [
                    {
                      "node": {
                        "id": 11,
                        "title": "Naruto",
                        "alternative_titles": { "en": "Naruto" }
                      }
                    }
                  ]
                }
                """;

        List<MetadataCandidate> candidates = provider.parse(body);

        assertThat(candidates.get(0).title()).isEqualTo("Naruto");
        assertThat(candidates.get(0).attributes()).doesNotContainKey("originalTitle");
        assertThat(candidates.get(0).attributes()).doesNotContainKey("titleJapanese");
        // titleRomaji/titleEnglish restent inconditionnels même quand identiques
        // (contrairement à originalTitle) - la composition côté client doit
        // pouvoir s'appuyer dessus sans se soucier du choix déjà fait ici.
        assertThat(candidates.get(0).attributes()).containsEntry("titleRomaji", "Naruto");
        assertThat(candidates.get(0).attributes()).containsEntry("titleEnglish", "Naruto");
    }

    @Test
    void keeps_the_romaji_default_title_when_no_english_title_is_provided() throws Exception {
        MyAnimeListMetadataProvider provider = new MyAnimeListMetadataProvider();
        String body = """
                {
                  "data": [
                    { "node": { "id": 23390, "title": "Shingeki no Kyojin Volume 0" } }
                  ]
                }
                """;

        List<MetadataCandidate> candidates = provider.parse(body);

        assertThat(candidates.get(0).title()).isEqualTo("Shingeki no Kyojin Volume 0");
        assertThat(candidates.get(0).attributes()).doesNotContainKey("originalTitle");
        assertThat(candidates.get(0).attributes()).containsEntry("titleRomaji", "Shingeki no Kyojin Volume 0");
        assertThat(candidates.get(0).attributes()).doesNotContainKey("titleEnglish");
    }

    @Test
    void does_not_support_manga_without_a_configured_client_id() {
        MyAnimeListMetadataProvider provider = new MyAnimeListMetadataProvider();
        EntityType manga = new EntityType(UUID.randomUUID(), "MANGA", "Manga", Set.of(), Set.of());

        assertThat(provider.supports(manga)).isFalse();
    }
}
