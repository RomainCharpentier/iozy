package com.iozycore.manga.metadata.googlebooks;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.metadata.BarcodeMetadataProvider;
import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.core.metadata.BarcodeLookup;
import com.iozycore.core.metadata.QuotaExceededException;
import com.iozycore.manga.metadata.IsbnBookTitle;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Queries the public Google Books API to find a book/manga from
 * its ISBN. A scanned ISBN identifies a precise edition:
 * unlike a search by title (Jikan), Google Books often indexes
 * the exact French edition of this barcode (French publisher,
 * French cover), where Open Library more often falls back on a generic
 * English edition.
 * <p>
 * Optional API key, with possible backup key(s) (see README.md,
 * section "Obtenir une clé API Google Books", and {@link GoogleBooksHttpClient}
 * which centralizes the rotation): without any key, the calls stay
 * functional but share the worldwide anonymous quota of Google Books,
 * often exhausted in practice (429 "Quota exceeded").
 * <p>
 * Higher priority (@Order) than {@link com.iozycore.manga.metadata.openlibrary.OpenLibraryBarcodeProvider}
 * in {@code MetadataSearchService.lookupByBarcode} - Open Library stays
 * as a fallback if Google Books indexed nothing under this ISBN (or if the quota is
 * exceeded on all keys, see the catch of {@link QuotaExceededException}
 * below - no need to inform the user here, Open Library
 * takes over silently). Covers the MANGA type only, like
 * the other barcode providers.
 */
@Component
@Order(1)
public class GoogleBooksBarcodeProvider implements BarcodeMetadataProvider {

    private static final Logger log = LoggerFactory.getLogger(GoogleBooksBarcodeProvider.class);
    private static final String LOOKUP_URL = "https://www.googleapis.com/books/v1/volumes?q=isbn:%s";

    private final GoogleBooksHttpClient httpClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    public GoogleBooksBarcodeProvider(GoogleBooksHttpClient httpClient) {
        this.httpClient = httpClient;
    }

    /** Constructor used by the unit tests: parse()/lookup() on a
     * body already in memory never need a real network call. */
    GoogleBooksBarcodeProvider() {
        this(new GoogleBooksHttpClient("", ""));
    }

    @Override
    public boolean supports(EntityType entityType) {
        return "MANGA".equals(entityType.code());
    }

    @Override
    public Optional<MetadataCandidate> lookup(String barcode) {
        return lookupDetailed(barcode).candidateIfAny();
    }

    /**
     * The same search, telling apart "Google Books does not know this
     * ISBN" from "Google Books did not answer".
     *
     * <p>The difference was not said, although it was known here: both
     * cases returned {@code Optional.empty()}. The service can now
     * remember a <b>confirmed</b> absence without ever remembering an outage.
     */
    @Override
    public BarcodeLookup lookupDetailed(String barcode) {
        String isbn = normalize(barcode);
        if (isbn.isEmpty()) {
            // Nothing to search: it is neither a confirmed absence nor an outage.
            return BarcodeLookup.unavailable();
        }

        try {
            // Never null: a call that does not succeed throws, and the
            // catch(Exception) below returns BarcodeLookup.unavailable().
            String body = httpClient.get(LOOKUP_URL.formatted(isbn));
            Optional<MetadataCandidate> trouve = parse(body, isbn);
            // The body was read to the end: whether Google knows this
            // ISBN or not, it did answer.
            return trouve.map(BarcodeLookup::found)
                    .orElseGet(BarcodeLookup::absent);
        } catch (QuotaExceededException e) {
            log.warn("Google Books quota exceeded for ISBN '{}' - Open Library takes over", isbn);
            return BarcodeLookup.unavailable();
        } catch (Exception e) {
            log.warn("Google Books lookup failed for '{}': {}", isbn, e.getMessage());
            return BarcodeLookup.unavailable();
        }
    }

    Optional<MetadataCandidate> parse(String body, String isbn) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        if (root.path("totalItems").asInt(0) == 0) {
            return Optional.empty(); // ISBN unknown to Google Books
        }

        JsonNode volumeInfo = root.path("items").path(0).path("volumeInfo");
        String title = volumeInfo.path("title").asText(null);
        if (title == null) {
            return Optional.empty();
        }

        // Google Books cover URLs are returned as http:// - we
        // force https to avoid any mixed content problem on the web side.
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
        List<String> publishers = publisher == null ? List.of() : List.of(publisher);

        // The title names the volume, not the series (see IsbnBookTitle).
        return Optional.of(IsbnBookTitle.candidate("GOOGLE_BOOKS", isbn, title, imageUrl, attributes, publishers));
    }

    /** Removes the spaces/hyphens that a scan can sometimes include. */
    private String normalize(String rawBarcode) {
        return rawBarcode == null ? "" : rawBarcode.replaceAll("[^0-9Xx]", "");
    }
}
