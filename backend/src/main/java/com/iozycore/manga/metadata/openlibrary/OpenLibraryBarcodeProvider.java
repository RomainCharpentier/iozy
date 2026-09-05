package com.iozycore.manga.metadata.openlibrary;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.metadata.BarcodeMetadataProvider;
import com.iozycore.core.metadata.MetadataCandidate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.Optional;

/**
 * Interroge l'API publique Open Library (https://openlibrary.org, aucune
 * clé requise) pour retrouver un livre/manga à partir de son ISBN
 * (le code-barres imprimé au dos d'un tome, souvent un EAN13 commençant
 * par 978/979). Couvre le type MANGA uniquement : les jeux vidéo et jeux
 * de société utilisent des codes-barres UPC/EAN non-ISBN, hors du
 * périmètre d'Open Library.
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
     * La même recherche, en distinguant « Open Library ne connaît pas cet
     * ISBN » de « Open Library n'a pas répondu ».
     *
     * <p>Un {@code 200} avec un corps vide <b>est</b> une réponse : cette API
     * rend un objet vide pour un ISBN inconnu. Un statut autre, un délai
     * dépassé ou un corps illisible n'en sont pas.
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
                log.warn("Open Library a répondu {} pour l'ISBN '{}'", response.statusCode(), isbn);
                return com.iozycore.core.metadata.BarcodeLookup.unavailable();
            }

            return parse(response.body(), isbn)
                    .map(com.iozycore.core.metadata.BarcodeLookup::found)
                    .orElseGet(com.iozycore.core.metadata.BarcodeLookup::absent);
        } catch (Exception e) {
            log.warn("Échec du lookup Open Library pour '{}' : {}", isbn, e.getMessage());
            return com.iozycore.core.metadata.BarcodeLookup.unavailable();
        }
    }

    Optional<MetadataCandidate> parse(String body, String isbn) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        Iterator<String> fieldNames = root.fieldNames();
        if (!fieldNames.hasNext()) {
            return Optional.empty(); // ISBN inconnu d'Open Library
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
        JsonNode publishers = book.path("publishers");
        if (publishers.isArray() && !publishers.isEmpty()) {
            attributes.put("publisher", publishers.get(0).path("name").asText(null));
        }

        return Optional.of(new MetadataCandidate("OPEN_LIBRARY", isbn, title, imageUrl, attributes));
    }

    /** Retire les espaces/tirets qu'un scan peut parfois inclure. */
    private String normalize(String rawBarcode) {
        return rawBarcode == null ? "" : rawBarcode.replaceAll("[^0-9Xx]", "");
    }
}
