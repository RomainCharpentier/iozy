package com.iozycore.manga.metadata.openlibrary;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.metadata.BarcodeMetadataProvider;
import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.manga.metadata.IsbnBookTitle;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Queries the public Open Library API (https://openlibrary.org, no
 * key required) to find a book/manga from its ISBN
 * (the barcode printed on the back of a volume, often an EAN13 starting
 * with 978/979). Covers the MANGA type only: video games and board
 * games use non-ISBN UPC/EAN barcodes, outside the
 * scope of Open Library.
 */
@Component
public class OpenLibraryBarcodeProvider implements BarcodeMetadataProvider {

    private static final Logger log = LoggerFactory.getLogger(OpenLibraryBarcodeProvider.class);
    private static final String LOOKUP_URL =
            "https://openlibrary.org/api/books?bibkeys=ISBN:%s&format=json&jscmd=data";

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public boolean supports(EntityType entityType) {
        return "MANGA".equals(entityType.code());
    }

    @Override
    public Optional<MetadataCandidate> lookup(String barcode) {
        return lookupDetailed(barcode).candidateIfAny();
    }

    /**
     * The same search, telling apart "Open Library does not know this
     * ISBN" from "Open Library did not answer".
     *
     * <p>A {@code 200} with an empty body <b>is</b> an answer: this API
     * returns an empty object for an unknown ISBN. Another status, a
     * timeout or an unreadable body are not.
     */
    @Override
    public com.iozycore.core.metadata.BarcodeLookup lookupDetailed(String barcode) {
        String isbn = normalize(barcode);
        if (isbn.isEmpty()) {
            return com.iozycore.core.metadata.BarcodeLookup.unavailable();
        }

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(LOOKUP_URL.formatted(isbn)))
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("Open Library answered {} for ISBN '{}'", response.statusCode(), isbn);
                return com.iozycore.core.metadata.BarcodeLookup.unavailable();
            }

            return parse(response.body(), isbn)
                    .map(com.iozycore.core.metadata.BarcodeLookup::found)
                    .orElseGet(com.iozycore.core.metadata.BarcodeLookup::absent);
        } catch (Exception e) {
            log.warn("Open Library lookup failed for '{}': {}", isbn, e.getMessage());
            return com.iozycore.core.metadata.BarcodeLookup.unavailable();
        }
    }

    Optional<MetadataCandidate> parse(String body, String isbn) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        Iterator<String> fieldNames = root.fieldNames();
        if (!fieldNames.hasNext()) {
            return Optional.empty(); // ISBN unknown to Open Library
        }

        JsonNode book = root.elements().next();
        String title = book.path("title").asText(null);
        if (title == null) {
            return Optional.empty();
        }

        String imageUrl = book.path("cover").path("medium").asText(null);

        Map<String, Object> attributes = new HashMap<>();
        JsonNode authors = book.path("authors");
        if (authors.isArray() && !authors.isEmpty()) {
            attributes.put("mangaka", authors.get(0).path("name").asText(null));
        }
        // All the names, in order: the first one is often a collection label
        // ("Shônen Manga"), the publisher comes after (see IsbnBookTitle).
        List<String> publishers = new ArrayList<>();
        book.path("publishers").forEach(p -> publishers.add(p.path("name").asText(null)));

        return Optional.of(IsbnBookTitle.candidate("OPEN_LIBRARY", isbn, title, imageUrl, attributes, publishers));
    }

    /** Removes the spaces/hyphens that a scan can sometimes include. */
    private String normalize(String rawBarcode) {
        return rawBarcode == null ? "" : rawBarcode.replaceAll("[^0-9Xx]", "");
    }
}
