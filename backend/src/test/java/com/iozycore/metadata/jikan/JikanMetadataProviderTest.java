package com.iozycore.metadata.jikan;

import com.iozycore.metadata.MetadataCandidate;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class JikanMetadataProviderTest {

    private static final String SAMPLE_RESPONSE = """
            {
              "data": [
                {
                  "mal_id": 2,
                  "title": "Death Note",
                  "images": { "jpg": { "image_url": "https://example.com/deathnote.jpg" } },
                  "authors": [ { "name": "Ohba, Tsugumi" } ],
                  "serializations": [ { "name": "Weekly Shonen Jump" } ],
                  "status": "Finished",
                  "volumes": 12,
                  "type": "Manga",
                  "published": { "from": "2003-12-01T00:00:00+00:00" },
                  "title_english": "Death Note: The Complete Series",
                  "title_japanese": "デスノート"
                }
              ]
            }
            """;

    @Test
    void prefers_the_english_title_over_the_romaji_default_and_keeps_the_original_as_an_attribute() throws Exception {
        JikanMetadataProvider provider = new JikanMetadataProvider();

        List<MetadataCandidate> candidates = provider.parse(SAMPLE_RESPONSE);

        assertThat(candidates).hasSize(1);
        MetadataCandidate candidate = candidates.get(0);
        assertThat(candidate.source()).isEqualTo("JIKAN");
        assertThat(candidate.externalId()).isEqualTo("2");
        assertThat(candidate.title()).isEqualTo("Death Note: The Complete Series");
        assertThat(candidate.imageUrl()).isEqualTo("https://example.com/deathnote.jpg");
        assertThat(candidate.attributes()).containsEntry("mangaka", "Ohba, Tsugumi");
        assertThat(candidate.attributes()).containsEntry("publisher", "Weekly Shonen Jump");
        assertThat(candidate.attributes()).containsEntry("mediaType", "Manga");
        assertThat(candidate.attributes()).containsEntry("startYear", "2003");
        assertThat(candidate.attributes()).containsEntry("originalTitle", "Death Note");
        assertThat(candidate.attributes()).containsEntry("titleJapanese", "デスノート");
        assertThat(candidate.attributes()).containsEntry("titleRomaji", "Death Note");
        assertThat(candidate.attributes()).containsEntry("titleEnglish", "Death Note: The Complete Series");
        assertThat(candidate.attributes()).containsEntry("seriesStatus", "Finished");
        assertThat(candidate.attributes()).containsEntry("totalVolumes", 12);
    }

    @Test
    void never_stores_a_total_volume_count_for_a_series_still_publishing() throws Exception {
        JikanMetadataProvider provider = new JikanMetadataProvider();
        String body = """
                {
                  "data": [
                    { "mal_id": 30, "title": "One Piece", "status": "Publishing", "volumes": null }
                  ]
                }
                """;

        List<MetadataCandidate> candidates = provider.parse(body);

        assertThat(candidates.get(0).attributes()).containsEntry("seriesStatus", "Publishing");
        assertThat(candidates.get(0).attributes()).doesNotContainKey("totalVolumes");
    }

    @Test
    void keeps_the_default_title_and_adds_no_originalTitle_when_english_title_is_identical() throws Exception {
        JikanMetadataProvider provider = new JikanMetadataProvider();
        String body = """
                {
                  "data": [
                    { "mal_id": 11, "title": "Naruto", "title_english": "Naruto" }
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
        JikanMetadataProvider provider = new JikanMetadataProvider();
        String body = """
                {
                  "data": [
                    { "mal_id": 23390, "title": "Shingeki no Kyojin Volume 0" }
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
    void returns_an_empty_list_when_there_is_no_result() throws Exception {
        JikanMetadataProvider provider = new JikanMetadataProvider();

        List<MetadataCandidate> candidates = provider.parse("{ \"data\": [] }");

        assertThat(candidates).isEmpty();
    }
}
