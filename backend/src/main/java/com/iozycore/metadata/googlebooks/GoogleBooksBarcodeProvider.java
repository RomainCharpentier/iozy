package com.iozycore.metadata.googlebooks;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.metadata.BarcodeMetadataProvider;
import com.iozycore.metadata.MetadataCandidate;
import com.iozycore.metadata.BarcodeLookup;
import com.iozycore.metadata.QuotaExceededException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

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
 * Clé API optionnelle, avec clé(s) de secours possibles (voir README.md,
 * section "Obtenir une clé API Google Books", et {@link GoogleBooksHttpClient}
 * qui centralise la rotation) : sans clé du tout, les appels restent
 * fonctionnels mais partagent le quota anonyme mondial de Google Books,
 * fréquemment épuisé en pratique (429 "Quota exceeded").
 * <p>
 * Priorité plus haute (@Order) que {@link com.iozycore.metadata.openlibrary.OpenLibraryBarcodeProvider}
 * dans {@code MetadataSearchService.lookupByBarcode} - Open Library reste
 * en repli si Google Books n'a rien indexé sous cet ISBN (ou si le quota est
 * dépassé sur toutes les clés, voir capture de {@link QuotaExceededException}
 * ci-dessous - pas la peine d'en informer l'utilisateur ici, Open Library
 * prend le relais silencieusement). Couvre le type MANGA uniquement, comme
 * les autres fournisseurs par code-barres.
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

    /** Constructeur utilisé par les tests unitaires : parse()/lookup() sur un
     * corps déjà en mémoire n'ont jamais besoin d'un vrai appel réseau. */
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
     * La même recherche, en distinguant « Google Books ne connaît pas cet
     * ISBN » de « Google Books n'a pas répondu ».
     *
     * <p>La différence n'était pas dite, alors qu'elle était connue ici : les
     * deux cas rendaient {@code Optional.empty()}. Le service peut désormais
     * mémoriser une absence <b>constatée</b> sans jamais mémoriser une panne.
     */
    @Override
    public BarcodeLookup lookupDetailed(String barcode) {
        String isbn = normalize(barcode);
        if (isbn.isEmpty()) {
            // Rien à chercher : ce n'est ni une absence constatée ni une panne.
            return BarcodeLookup.unavailable();
        }

        try {
            String body = httpClient.get(LOOKUP_URL.formatted(isbn));
            if (body == null) {
                return BarcodeLookup.unavailable();
            }
            Optional<MetadataCandidate> trouve = parse(body, isbn);
            // Le corps a été lu jusqu'au bout : que Google connaisse ou non cet
            // ISBN, il a bel et bien répondu.
            return trouve.map(BarcodeLookup::found)
                    .orElseGet(BarcodeLookup::absent);
        } catch (QuotaExceededException e) {
            log.warn("Quota Google Books dépassé pour l'ISBN '{}' - Open Library prend le relais", isbn);
            return BarcodeLookup.unavailable();
        } catch (Exception e) {
            log.warn("Échec du lookup Google Books pour '{}' : {}", isbn, e.getMessage());
            return BarcodeLookup.unavailable();
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
