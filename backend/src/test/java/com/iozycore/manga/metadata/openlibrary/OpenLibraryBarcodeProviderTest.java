package com.iozycore.manga.metadata.openlibrary;

import com.iozycore.core.metadata.MetadataCandidate;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class OpenLibraryBarcodeProviderTest {

    private static final String SAMPLE_RESPONSE = """
            {
              "ISBN:9782723492607": {
                "title": "Death Note, Tome 1",
                "authors": [ { "name": "Tsugumi Ohba" } ],
                "publishers": [ { "name": "Kana" } ],
                "cover": { "medium": "https://example.com/cover.jpg" }
              }
            }
            """;

    @Test
    void parses_title_and_attributes_from_an_open_library_response() throws Exception {
        OpenLibraryBarcodeProvider provider = new OpenLibraryBarcodeProvider();

        Optional<MetadataCandidate> candidate = provider.parse(SAMPLE_RESPONSE, "9782723492607");

        assertThat(candidate).isPresent();
        assertThat(candidate.get().title()).isEqualTo("Death Note, Tome 1");
        assertThat(candidate.get().source()).isEqualTo("OPEN_LIBRARY");
        assertThat(candidate.get().attributes()).containsEntry("mangaka", "Tsugumi Ohba");
        assertThat(candidate.get().attributes()).containsEntry("publisher", "Kana");
    }

    @Test
    void returns_empty_when_isbn_is_unknown() throws Exception {
        OpenLibraryBarcodeProvider provider = new OpenLibraryBarcodeProvider();

        Optional<MetadataCandidate> candidate = provider.parse("{}", "0000000000000");

        assertThat(candidate).isEmpty();
    }
}
