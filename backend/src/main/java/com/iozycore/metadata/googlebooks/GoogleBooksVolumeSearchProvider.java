package com.iozycore.metadata.googlebooks;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.metadata.VolumeCandidate;
import com.iozycore.metadata.VolumeSearchProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.OptionalInt;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Recherche les tomes réels (avec jaquette) des éditions françaises d'une
 * série de manga via Google Books - vérifié manuellement (voir historique
 * de la conversation) qu'une recherche {@code intitle:}+{@code inauthor:}
 * avec {@code maxResults=40} remonte souvent la quasi-totalité des tomes
 * publiés en une seule requête (chaque tome étant indexé comme une fiche
 * séparée), avec sa jaquette propre - contrairement à
 * {@link GoogleBooksFrenchTitleProvider} qui ne veut qu'UN titre pour toute
 * la série.
 * <p>
 * Un même appel peut mélanger plusieurs éditions (ex: "Kana" et une
 * collection "Édition originale" du même éditeur), des tomes numérotés
 * (retenus) et des chapitres numériques à l'unité ou coffrets (exclus, pas
 * de numéro de tome exploitable). Le nom d'édition est extrait du titre en
 * retirant le titre de la série et le numéro de tome ; à défaut (titre
 * réduit à la série + son numéro, cas le plus courant), on retombe sur le
 * nom de l'éditeur brut (ex: "Kana").
 */
@Component
public class GoogleBooksVolumeSearchProvider implements VolumeSearchProvider {

    private static final Logger log = LoggerFactory.getLogger(GoogleBooksVolumeSearchProvider.class);
    private static final String SEARCH_URL =
            "https://www.googleapis.com/books/v1/volumes?q=%s&langRestrict=fr&maxResults=40";

    // "Tome 5", "Vol. 12", "T.3" - capture le numéro. Exige le mot-clé (pas un
    // simple nombre en fin de titre) pour ne jamais confondre avec une année
    // ou un numéro de chapitre isolé.
    private static final Pattern VOLUME_NUMBER = Pattern.compile("(?i)(?:tome|vol\\.?|t\\.)\\s*0*(\\d+)");
    // "One Piece édition originale - Chapitre 648" - vente à l'unité d'un
    // chapitre numérique, jamais un vrai tome physique : à exclure même si un
    // numéro de tome apparaît ailleurs dans une fiche voisine du même résultat.
    private static final Pattern CHAPTER_KEYWORD = Pattern.compile("(?i)\\bchapitre\\b|\\bchapter\\b");
    private static final Pattern LEADING_TRAILING_SEPARATORS = Pattern.compile("^[\\s\\-–:,]+|[\\s\\-–:,]+$");

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
    public List<VolumeCandidate> searchVolumes(String seriesTitle, String author) {
        if (seriesTitle == null || seriesTitle.isBlank()) {
            return List.of();
        }
        String combinedQuery = "intitle:" + seriesTitle + (author == null || author.isBlank() ? "" : " inauthor:" + author);

        try {
            String encodedQuery = URLEncoder.encode(combinedQuery, StandardCharsets.UTF_8);
            String url = SEARCH_URL.formatted(encodedQuery);
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
                log.warn("Google Books a répondu {} pour la recherche de tomes '{}'", response.statusCode(), combinedQuery);
                return List.of();
            }

            return parse(response.body(), seriesTitle);
        } catch (Exception e) {
            log.warn("Échec de la recherche de tomes Google Books pour '{}' : {}", combinedQuery, e.getMessage());
            return List.of();
        }
    }

    List<VolumeCandidate> parse(String body, String seriesTitle) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        // Dédoublonne par (édition, tome) - Google Books renvoie parfois
        // plusieurs fiches pour le même tome (réédition, format différent) ;
        // on garde la première avec une jaquette plutôt que la première tout court.
        Map<String, VolumeCandidate> bestByKey = new LinkedHashMap<>();

        for (JsonNode item : root.path("items")) {
            JsonNode volumeInfo = item.path("volumeInfo");
            if (!"fr".equals(volumeInfo.path("language").asText(null))) {
                continue; // langRestrict est une préférence, pas une garantie - on revérifie
            }
            String title = volumeInfo.path("title").asText(null);
            if (title == null || title.isBlank() || CHAPTER_KEYWORD.matcher(title).find()) {
                continue;
            }
            OptionalInt volumeNumber = extractVolumeNumber(title);
            if (volumeNumber.isEmpty()) {
                continue; // coffret, artbook, one-shot sans numéro exploitable
            }

            String publisher = volumeInfo.path("publisher").asText(null);
            String edition = extractEdition(title, seriesTitle, publisher);

            String imageUrl = volumeInfo.path("imageLinks").path("thumbnail").asText(null);
            if (imageUrl != null) {
                imageUrl = imageUrl.replaceFirst("^http://", "https://");
            }

            String key = edition.toLowerCase() + "|" + volumeNumber.getAsInt();
            VolumeCandidate candidate = new VolumeCandidate(edition, volumeNumber.getAsInt(), imageUrl, title);
            bestByKey.merge(key, candidate, (existing, replacement) -> existing.imageUrl() != null ? existing : replacement);
        }

        return bestByKey.values().stream()
                .sorted(Comparator.comparing(VolumeCandidate::edition).thenComparingInt(VolumeCandidate::volumeNumber))
                .collect(Collectors.toList());
    }

    private static OptionalInt extractVolumeNumber(String title) {
        var matcher = VOLUME_NUMBER.matcher(title);
        if (!matcher.find()) {
            return OptionalInt.empty();
        }
        try {
            return OptionalInt.of(Integer.parseInt(matcher.group(1)));
        } catch (NumberFormatException e) {
            return OptionalInt.empty();
        }
    }

    /** "One Piece - Édition originale - Tome 60" + série "One Piece" -> "Édition originale".
     * "Death Note - Tome 10" + série "Death Note" -> "" -> repli sur l'éditeur ("Kana"). */
    private static String extractEdition(String fullTitle, String seriesTitle, String publisher) {
        String remainder = Pattern.compile("(?i)^" + Pattern.quote(seriesTitle)).matcher(fullTitle).replaceFirst("");
        remainder = VOLUME_NUMBER.matcher(remainder).replaceAll("");
        remainder = LEADING_TRAILING_SEPARATORS.matcher(remainder).replaceAll("").trim();
        if (!remainder.isBlank()) {
            return remainder;
        }
        return (publisher == null || publisher.isBlank()) ? "Édition inconnue" : publisher;
    }
}
