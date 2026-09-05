package com.iozycore.metadata.manga.googlebooks;

import com.iozycore.metadata.MetadataCandidate;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class GoogleBooksBarcodeProviderTest {

    private static final String SAMPLE_RESPONSE = """
            {
              "totalItems": 1,
              "items": [
                {
                  "volumeInfo": {
                    "title": "Death Note, Tome 1",
                    "authors": [ "Tsugumi Ohba" ],
                    "publisher": "Kana",
                    "imageLinks": {
                      "thumbnail": "http://books.google.com/books/content?id=abc&printsec=frontcover&img=1"
                    }
                  }
                }
              ]
            }
            """;

    @Test
    void parses_title_attributes_and_upgrades_the_cover_url_to_https() throws Exception {
        GoogleBooksBarcodeProvider provider = new GoogleBooksBarcodeProvider();

        Optional<MetadataCandidate> candidate = provider.parse(SAMPLE_RESPONSE, "9782723492607");

        assertThat(candidate).isPresent();
        assertThat(candidate.get().title()).isEqualTo("Death Note, Tome 1");
        assertThat(candidate.get().source()).isEqualTo("GOOGLE_BOOKS");
        assertThat(candidate.get().imageUrl()).startsWith("https://");
        assertThat(candidate.get().attributes()).containsEntry("mangaka", "Tsugumi Ohba");
        assertThat(candidate.get().attributes()).containsEntry("publisher", "Kana");
    }

    @Test
    void returns_empty_when_isbn_is_unknown() throws Exception {
        GoogleBooksBarcodeProvider provider = new GoogleBooksBarcodeProvider();

        Optional<MetadataCandidate> candidate = provider.parse("{\"totalItems\": 0}", "0000000000000");

        assertThat(candidate).isEmpty();
    }
}
