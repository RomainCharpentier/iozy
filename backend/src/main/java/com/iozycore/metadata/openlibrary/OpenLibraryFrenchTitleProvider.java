package com.iozycore.metadata.openlibrary;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.metadata.FrenchTitleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Recherche best-effort d'un titre d'édition française via l'API de
 * recherche générale d'Open Library (déjà utilisée pour le scan ISBN, voir
 * OpenLibraryBarcodeProvider - aucune clé requise, pas de quota agressif
 * contrairement à Google Books). Essayée en premier (@Order(1)) dans
 * MetadataSearchService.findFrenchTitle, Google Books restant en repli.
 * <p>
 * Stratégie en cascade, vérifiée manuellement avant d'écrire ce code (voir
 * historique de la conversation) :
 * <ol>
 *   <li>auteur + titre complet - marche quand l'édition française reprend le
 *       titre tel quel (ex: "My Hero Academia", jamais traduit) ;</li>
 *   <li>auteur + un mot distinctif du titre, un par un - un nom propre
 *       (personnage, lieu...) survit souvent seul à la traduction quand le
 *       titre entier ne matche rien : chercher "Hajime Isayama Attack on
 *       Titan" ne trouve RIEN (le titre français ne contient jamais "Attack
 *       on"), mais "Hajime Isayama Titan" retrouve directement "L'Attaque
 *       des Titans" - Open Library semble exiger que tous les termes de la
 *       requête apparaissent quelque part, donc plus la phrase est longue,
 *       moins elle a de chances de matcher une traduction ;</li>
 *   <li>auteur seul - dernier recours, accepte le risque de retomber sur
 *       l'œuvre la plus connue de l'auteur si rien d'autre n'a matché (voir
 *       limite similaire pour un mangaka très prolifique).</li>
 * </ol>
 * Chercher par titre seul (sans auteur) ne fait que l'étape 1 : ça remonte
 * surtout du merchandising francophone (agendas, goodies) plutôt que les
 * tomes du manga lui-même, pas la peine d'aller plus loin sans auteur pour
 * désambiguïser.
 */
@Component
@Order(1)
public class OpenLibraryFrenchTitleProvider implements FrenchTitleProvider {

    private static final Logger log = LoggerFactory.getLogger(OpenLibraryFrenchTitleProvider.class);
    private static final String SEARCH_URL = "https://openlibrary.org/search.json?q=%s&language=fre&limit=5";

    // "Death Note, Vol. 1" / "L'Attaque des Titans Vol. 13" / "Naruto 58" -
    // Open Library indexe chaque tome séparément avec son numéro dans le
    // titre ; on ne veut que le titre de la série pour pré-remplir l'ajout.
    private static final Pattern VOLUME_KEYWORD_SUFFIX = Pattern.compile("(?i),?\\s*(vol\\.?|tome|t\\.?)\\s*\\d+\\s*$");
    private static final Pattern TRAILING_NUMBER_SUFFIX = Pattern.compile("\\s+\\d+\\s*$");

    // Mots trop génériques pour servir de mot-clé distinctif (étape 2 de la
    // cascade) - anglais courant, particules romaji, vocabulaire manga.
    private static final Set<String> STOPWORDS = Set.of(
            "the", "of", "on", "in", "no", "wa", "to", "and", "next",
            "generations", "story", "chronicles", "complete", "series",
            "vol", "tome", "edition", "part");

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public boolean supports(EntityType entityType) {
        return "MANGA".equals(entityType.code());
    }

    @Override
    public Optional<String> findFrenchTitle(String query, String author) {
        if (query == null || query.isBlank()) {
            return Optional.empty();
        }

        Optional<String> exactMatch = search(combine(author, query));
        if (exactMatch.isPresent()) {
            return exactMatch;
        }

        if (author == null || author.isBlank()) {
            return Optional.empty();
        }

        for (String keyword : significantWords(query)) {
            Optional<String> byKeyword = search(combine(author, keyword));
            if (byKeyword.isPresent()) {
                return byKeyword;
            }
        }

        return search(author);
    }

    private static String combine(String author, String text) {
        return (author == null || author.isBlank()) ? text : author + " " + text;
    }

    /** Mots de 4+ caractères hors mots vides, dans l'ordre d'apparition, sans
     * doublon - candidats essayés un par un quand auteur+titre complet ne
     * matche rien. Volontairement capé (voir findFrenchTitle) : chaque mot
     * essayé est un appel réseau de plus. */
    static List<String> significantWords(String title) {
        return Arrays.stream(title.split("[\\s:,.'’-]+"))
                .filter(word -> word.length() >= 4)
                .filter(word -> !STOPWORDS.contains(word.toLowerCase()))
                .filter(word -> !word.chars().allMatch(Character::isDigit))
                .distinct()
                .limit(3)
                .collect(Collectors.toList());
    }

    private Optional<String> search(String rawQuery) {
        try {
            String encodedQuery = URLEncoder.encode(rawQuery, StandardCharsets.UTF_8);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(SEARCH_URL.formatted(encodedQuery)))
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("Open Library a répondu {} pour la recherche de titre français '{}'", response.statusCode(), rawQuery);
                return Optional.empty();
            }

            return parse(response.body());
        } catch (Exception e) {
            log.warn("Échec de la recherche de titre français Open Library pour '{}' : {}", rawQuery, e.getMessage());
            return Optional.empty();
        }
    }

    Optional<String> parse(String body) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        for (JsonNode doc : root.path("docs")) {
            String rawTitle = doc.path("title").asText(null);
            if (rawTitle == null || rawTitle.isBlank()) {
                continue;
            }
            String cleaned = cleanVolumeSuffix(rawTitle);
            if (!cleaned.isBlank()) {
                return Optional.of(cleaned);
            }
        }
        return Optional.empty();
    }

    /** "L'Attaque des Titans Vol. 13" -> "L'Attaque des Titans", "Naruto 58" -> "Naruto". */
    static String cleanVolumeSuffix(String rawTitle) {
        String withoutKeywordSuffix = VOLUME_KEYWORD_SUFFIX.matcher(rawTitle).replaceFirst("");
        return TRAILING_NUMBER_SUFFIX.matcher(withoutKeywordSuffix).replaceFirst("").trim();
    }
}
