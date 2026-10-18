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
        assertThat(candidate.get().title()).isEqualTo("Death Note");
        assertThat(candidate.get().volume().number()).isEqualTo(1);
        assertThat(candidate.get().volume().sourceTitle()).isEqualTo("Death Note, Tome 1");
        assertThat(candidate.get().source()).isEqualTo("OPEN_LIBRARY");
        assertThat(candidate.get().attributes()).containsEntry("mangaka", "Tsugumi Ohba");
        assertThat(candidate.get().attributes()).containsEntry("publisher", "Kana");
    }

    /** The real answer for this ISBN (trimmed), seen on 2026-10-13. */
    private static final String ONE_PIECE_ORIGINAL_EDITION = """
            {
              "ISBN:9782723488525": {
                "title": "One Piece - \u00c9dition originale Tome 01",
                "subtitle": "Romamce Dawn - \u00c0 l'aube d'une grande aventure",
                "authors": [ { "name": "\u5c3e\u7530\u6804\u4e00\u90ce" } ],
                "publishers": [ { "name": "Sh\u00f4nen Manga" }, { "name": "GLENAT" }, { "name": "Gl\u00e9nat Manga" } ],
                "cover": { "medium": "https://covers.openlibrary.org/b/id/11981574-M.jpg" }
              }
            }
            """;

    @Test
    void a_scanned_volume_names_its_series_and_keeps_its_number_and_edition() throws Exception {
        // The volume title used to become the series title: every scanned
        // volume created its own series, with "Shônen Manga" as edition.
        MetadataCandidate candidate = new OpenLibraryBarcodeProvider()
                .parse(ONE_PIECE_ORIGINAL_EDITION, "9782723488525").orElseThrow();

        assertThat(candidate.title()).isEqualTo("One Piece");
        assertThat(candidate.volume().number()).isEqualTo(1);
        assertThat(candidate.volume().edition()).isEqualTo("Édition originale");
        assertThat(candidate.volume().sourceTitle()).isEqualTo("One Piece - Édition originale Tome 01");
        // "Shônen Manga" is the collection, not the publisher.
        assertThat(candidate.attributes()).containsEntry("publisher", "GLENAT");
    }

    @Test
    void a_title_without_a_volume_number_stays_the_series_without_a_number() throws Exception {
        MetadataCandidate candidate = new OpenLibraryBarcodeProvider().parse("""
                { "ISBN:1": { "title": "Akira", "publishers": [ { "name": "Seinen" } ] } }
                """, "1").orElseThrow();

        assertThat(candidate.title()).isEqualTo("Akira");
        assertThat(candidate.volume().number()).isNull();
        assertThat(candidate.volume().edition()).isNull();
        // A collection label alone is no publisher: nothing rather than a wrong one.
        assertThat(candidate.attributes()).doesNotContainKey("publisher");
    }

    @Test
    void returns_empty_when_isbn_is_unknown() throws Exception {
        OpenLibraryBarcodeProvider provider = new OpenLibraryBarcodeProvider();

        Optional<MetadataCandidate> candidate = provider.parse("{}", "0000000000000");

        assertThat(candidate).isEmpty();
    }
}
