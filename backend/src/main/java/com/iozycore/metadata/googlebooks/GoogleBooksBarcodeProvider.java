package com.iozycore.metadata.googlebooks;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.metadata.BarcodeMetadataProvider;
import com.iozycore.metadata.MetadataCandidate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Interroge l'API publique Google Books pour retrouver un livre/manga à
 * partir de son ISBN. Un ISBN scanné identifie une édition précise :
 * contrairement à une recherche par titre (Jikan), Google Books indexe
 * souvent l'édition française exacte de ce code-barres (éditeur VF,
 * jaquette VF), là où Open Library retombe plus souvent sur une édition
 * anglophone générique.
 * <p>
 * Clé API optionnelle (voir README.md, section "Obtenir une clé API Google
 * Books") : sans elle, les appels restent fonctionnels mais partagent le
 * quota anonyme mondial de Google Books, fréquemment épuisé en pratique
 * (429 "Quota exceeded"). Une clé donne un quota dédié à ce projet.
 * <p>
 * Priorité plus haute (@Order) que {@link com.iozycore.metadata.openlibrary.OpenLibraryBarcodeProvider}
 * dans {@code MetadataSearchService.lookupByBarcode} - Open Library reste
 * en repli si Google Books n'a rien indexé sous cet ISBN. Couvre le type
 * MANGA uniquement, comme les autres fournisseurs par code-barres.
 */
@Component
@Order(1)
public class GoogleBooksBarcodeProvider implements BarcodeMetadataProvider {

    private static final Logger log = LoggerFactory.getLogger(GoogleBooksBarcodeProvider.class);
    private static final String LOOKUP_URL = "https://www.googleapis.com/books/v1/volumes?q=isbn:%s";

    @Value("${google-books.api-key:}")
    private String apiKey;

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
        String isbn = normalize(barcode);
        if (isbn.isEmpty()) {
            return Optional.empty();
        }

        try {
            String url = LOOKUP_URL.formatted(isbn);
            if (apiKey != null && !apiKey.isBlank()) {
                url += "&key=" + apiKey;
            }
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("Google Books a répondu {} pour l'ISBN '{}'", response.statusCode(), isbn);
                return Optional.empty();
            }

            return parse(response.body(), isbn);
        } catch (Exception e) {
            log.warn("Échec du lookup Google Books pour '{}' : {}", isbn, e.getMessage());
            return Optional.empty();
        }
    }

    Optional<MetadataCandidate> parse(String body, String isbn) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        if (root.path("totalItems").asInt(0) == 0) {
            return Optional.empty(); // ISBN inconnu de Google Books
        }

        JsonNode volumeInfo = root.path("items").path(0).path("volumeInfo");
        String title = volumeInfo.path("title").asText(null);
        if (title == null) {
            return Optional.empty();
        }

        // Les URLs de jaquette Google Books sont renvoyées en http:// - on
        // force https pour éviter tout souci de contenu mixte côté web.
        String imageUrl = volumeInfo.path("imageLinks").path("thumbnail").asText(null);
        if (imageUrl != null) {
            imageUrl = imageUrl.replaceFirst("^http://", "https://");
        }

        Map<String, Object> attributes = new HashMap<>();
        JsonNode authors = volumeInfo.path("authors");
        if (authors.isArray() && !authors.isEmpty()) {
            attributes.put("mangaka", authors.get(0).asText(null));
        }
        String publisher = volumeInfo.path("publisher").asText(null);
        if (publisher != null) {
            attributes.put("publisher", publisher);
        }

        return Optional.of(new MetadataCandidate("GOOGLE_BOOKS", isbn, title, imageUrl, attributes));
    }

    /** Retire les espaces/tirets qu'un scan peut parfois inclure. */
    private String normalize(String rawBarcode) {
        return rawBarcode == null ? "" : rawBarcode.replaceAll("[^0-9Xx]", "");
    }
}
