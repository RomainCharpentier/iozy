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
import java.util.concurrent.CompletableFuture;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Recherche les tomes réels (avec jaquette) des éditions françaises d'une
 * série de manga via Google Books.
 * <p>
 * Une seule requête {@code intitle:}+{@code inauthor:} générique s'est avérée
 * insuffisante en pratique (vérifié manuellement, voir historique de la
 * conversation) : Google Books classe les résultats par pertinence/popularité,
 * pas par exhaustivité éditoriale - pour "Dragon Ball", la requête générique
 * (même paginée sur 120 résultats) ne renvoie QUE la "Perfect Edition",
 * l'édition originale n'apparaissant jamais dans les 40/80/120 premiers
 * résultats. Il n'existe pas d'équivalent gratuit au catalogue édité à la
 * main de Mangacollec.
 * <p>
 * Palliatif : une requête par mot-clé d'édition française courante (voir
 * {@link #EDITION_KEYWORDS}), lancées en parallèle ({@link CompletableFuture})
 * plutôt qu'en série pour ne pas cumuler leurs latences - chacune cible une
 * édition précise, ce qui contourne le biais de popularité de la requête
 * générique. Résultat fusionné et dédoublonné une seule fois à la fin (pas
 * édition par édition : un même tome peut apparaître dans plusieurs requêtes,
 * ex: la requête vide ET la requête "perfect edition" peuvent toutes deux
 * remonter un tome Perfect Edition). Reste best-effort : une édition absente
 * de tous ces mots-clés (nom de collection inhabituel) restera invisible.
 */
@Component
public class GoogleBooksVolumeSearchProvider implements VolumeSearchProvider {

    private static final Logger log = LoggerFactory.getLogger(GoogleBooksVolumeSearchProvider.class);
    private static final String SEARCH_URL =
            "https://www.googleapis.com/books/v1/volumes?q=%s&langRestrict=fr&maxResults=40";

    // Mots-clés de collection les plus courants chez les éditeurs manga
    // francophones (Kana, Glénat, Pika, Kurokawa...) - "" couvre l'édition de
    // base/simple, qui ne porte généralement aucun suffixe dans son propre titre.
    private static final List<String> EDITION_KEYWORDS = List.of(
            "", "edition originale", "perfect edition", "star edition",
            "ultimate edition", "deluxe", "intégrale", "collector");

    // "Tome 5", "Vol. 12", "T.3", "T04" (forme abrégée sans point, courante
    // sur Google Books - ex: "Fragments d'elles T04", vérifié manuellement)
    // - capture le numéro. \b devant "t" évite de confondre avec un simple
    // "t" en fin d'un autre mot ; le mot-clé exigé (jamais juste un nombre en
    // fin de titre) évite de confondre avec une année ou un numéro de chapitre.
    private static final Pattern VOLUME_NUMBER = Pattern.compile("(?i)\\b(?:tome|vol\\.?|t\\.?)\\s*0*(\\d+)");
    // "One Piece édition originale - Chapitre 648" - vente à l'unité d'un
    // chapitre numérique, jamais un vrai tome physique : à exclure même si un
    // numéro de tome apparaît ailleurs dans une fiche voisine du même résultat.
    private static final Pattern CHAPTER_KEYWORD = Pattern.compile("(?i)\\bchapitre\\b|\\bchapter\\b");
    // "." ajouté (vérifié manuellement, voir historique) : "Chainsaw Man
    // Tome 18 . Edition collector" a son numéro de tome AVANT le nom de
    // collection, séparé par un point - sans lui, l'édition extraite
    // restait ". Edition collector" (point résiduel non nettoyé).
    private static final Pattern LEADING_TRAILING_SEPARATORS = Pattern.compile("^[\\s\\-–:,.]+|[\\s\\-–:,.]+$");
    // "L'Attaque des Titans - L'intégrale T01 à T04" (coffret regroupant 4
    // tomes, vérifié manuellement) : VOLUME_NUMBER retire bien "T01" ET "T04"
    // (deux numéros dans le même titre), mais le connecteur "à" entre les
    // deux reste seul au milieu du texte restant - ni en tête ni en fin, donc
    // pas nettoyé par LEADING_TRAILING_SEPARATORS - et se retrouve capitalisé
    // en "À" par capitalizeWords : "L'intégrale à" -> "L'intégrale À".
    // (?U) indispensable ici : \b est basé par défaut sur \w ASCII (Java), qui
    // ne considère PAS "à" comme un caractère de mot - entouré d'espaces des
    // deux côtés (deux non-mots), \bà\b sans (?U) ne matche jamais (aucune
    // transition mot/non-mot détectée). (?U) rend \w Unicode-aware.
    private static final Pattern DANGLING_RANGE_CONNECTOR = Pattern.compile("(?iU)\\bà\\b");

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

        List<CompletableFuture<List<VolumeCandidate>>> searches = EDITION_KEYWORDS.stream()
                .map(keyword -> CompletableFuture.supplyAsync(() -> searchOneEdition(seriesTitle, author, keyword)))
                .collect(Collectors.toList());

        List<VolumeCandidate> combined = searches.stream()
                .flatMap(future -> future.join().stream())
                .collect(Collectors.toList());

        return filterOutNoiseEditions(dedupeAndSort(combined));
    }

    /** Une "édition" à un seul tome ressort presque toujours d'un faux positif
     * de la recherche plein-texte (ex: "One Piece Party", un dérivé qui
     * contient le titre de la série sans en être une édition) plutôt que
     * d'une vraie petite collection - on l'écarte, sauf si c'est la SEULE
     * édition trouvée (mieux vaut proposer un tome que rien du tout). */
    private static List<VolumeCandidate> filterOutNoiseEditions(List<VolumeCandidate> candidates) {
        Map<String, Long> countByEdition = candidates.stream()
                .collect(Collectors.groupingBy(VolumeCandidate::edition, Collectors.counting()));
        if (countByEdition.size() <= 1) {
            return candidates;
        }
        return candidates.stream()
                .filter(candidate -> countByEdition.get(candidate.edition()) >= 2)
                .collect(Collectors.toList());
    }

    private List<VolumeCandidate> searchOneEdition(String seriesTitle, String author, String editionKeyword) {
        String combinedQuery = "intitle:" + seriesTitle
                + (editionKeyword.isBlank() ? "" : " " + editionKeyword)
                + (author == null || author.isBlank() ? "" : " inauthor:" + author);

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

            return extractCandidates(response.body(), seriesTitle);
        } catch (Exception e) {
            log.warn("Échec de la recherche de tomes Google Books pour '{}' : {}", combinedQuery, e.getMessage());
            return List.of();
        }
    }

    /** Miroir de {@link #searchOneEdition} pour les tests - parse une seule réponse
     * (édition/tome dédoublonnés) sans passer par les 8 requêtes en parallèle. */
    List<VolumeCandidate> parse(String body, String seriesTitle) throws Exception {
        return dedupeAndSort(extractCandidates(body, seriesTitle));
    }

    /** Extrait les candidats bruts d'une réponse Google Books, SANS dédoublonner -
     * le dédoublonnage se fait une seule fois, après fusion de toutes les requêtes
     * (voir searchVolumes), pour ne jamais préférer arbitrairement le résultat
     * d'une requête sur une autre avant d'avoir vu l'ensemble. */
    private List<VolumeCandidate> extractCandidates(String body, String seriesTitle) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        List<VolumeCandidate> candidates = new java.util.ArrayList<>();

        for (JsonNode item : root.path("items")) {
            JsonNode volumeInfo = item.path("volumeInfo");
            if (!"fr".equals(volumeInfo.path("language").asText(null))) {
                continue; // langRestrict est une préférence, pas une garantie - on revérifie
            }
            String title = volumeInfo.path("title").asText(null);
            if (title == null || title.isBlank() || CHAPTER_KEYWORD.matcher(title).find()) {
                continue;
            }
            // La recherche plein-texte matche parfois une série DIFFÉRENTE qui
            // mentionne juste la série cherchée dans un titre plus long (ex:
            // "Boruto - Naruto Next Generations - Tome 3" remonté pour une
            // recherche "Naruto" - Boruto est un spin-off, pas une édition de
            // Naruto). Exiger que le titre commence bien par la série cherchée
            // écarte ces faux positifs sans dépendre d'une liste de noms de
            // séries dérivées à maintenir à la main.
            //
            // Un simple startsWith ne suffit pas : "Tokyo Ghoul:re Tome 5"
            // (vérifié manuellement, voir historique) commence bien par
            // "Tokyo Ghoul" mais ":re" est une suite/série à part sur
            // MyAnimeList, pas une édition de Tokyo Ghoul - contrairement à
            // un vrai nom de collection ("One Piece - Édition originale",
            // "Dragon Ball perfect edition"...), toujours séparé du titre de
            // la série par un espace. On exige donc que le préfixe soit suivi
            // d'un espace (ou de la fin de la chaîne), jamais collé
            // directement à d'autres lettres.
            String trimmedTitle = title.trim();
            String lowerTitle = trimmedTitle.toLowerCase();
            String lowerSeriesTitle = seriesTitle.trim().toLowerCase();
            boolean isRealPrefixMatch = lowerTitle.startsWith(lowerSeriesTitle)
                    && (trimmedTitle.length() == lowerSeriesTitle.length()
                        || Character.isWhitespace(trimmedTitle.charAt(lowerSeriesTitle.length())));
            if (!isRealPrefixMatch) {
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

            candidates.add(new VolumeCandidate(edition, volumeNumber.getAsInt(), imageUrl, title));
        }
        return candidates;
    }

    /** Dédoublonne par (édition, tome) - un même tome peut ressortir de plusieurs
     * requêtes/fiches (réédition, format différent, requêtes par mot-clé qui se
     * recoupent) ; on garde la première avec une jaquette plutôt que la première
     * tout court. Trié par édition puis numéro de tome pour un affichage stable. */
    private static List<VolumeCandidate> dedupeAndSort(List<VolumeCandidate> candidates) {
        Map<String, VolumeCandidate> bestByKey = new LinkedHashMap<>();
        for (VolumeCandidate candidate : candidates) {
            String key = candidate.edition().toLowerCase() + "|" + candidate.volumeNumber();
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

    /** "One Piece - Édition originale - Tome 60" + série "One Piece" -> "Édition Originale".
     * "Death Note - Tome 10" + série "Death Note" -> "" -> repli sur l'éditeur ("Kana"). */
    private static String extractEdition(String fullTitle, String seriesTitle, String publisher) {
        String remainder = Pattern.compile("(?i)^" + Pattern.quote(seriesTitle)).matcher(fullTitle).replaceFirst("");
        remainder = VOLUME_NUMBER.matcher(remainder).replaceAll("");
        remainder = DANGLING_RANGE_CONNECTOR.matcher(remainder).replaceAll("");
        remainder = LEADING_TRAILING_SEPARATORS.matcher(remainder).replaceAll("").trim();
        // "Team-up Mission" / "Team-Up Mission" / "Team Up Mission" (les trois
        // formes existent réellement selon la fiche Google Books, vérifié
        // manuellement sur "My Hero Academia") doivent former UNE seule
        // édition, pas trois onglets quasi identiques - le tiret interne est
        // traité comme un simple espace avant capitalisation ; seuls les
        // tirets de bord (déjà retirés ci-dessus) servaient de séparateur
        // avec le reste du titre.
        remainder = remainder.replace('-', ' ').replaceAll("\\s+", " ").trim();
        if (!remainder.isBlank()) {
            return capitalizeWords(remainder);
        }
        return (publisher == null || publisher.isBlank()) ? "Édition inconnue" : publisher;
    }

    /** "perfect edition" -> "Perfect Edition" - Google Books indexe souvent le nom
     * de collection tout en minuscules dans le titre brut, contrairement au nom
     * de l'éditeur (déjà correctement casé, ex: "Glénat Manga") utilisé en repli. */
    private static String capitalizeWords(String text) {
        StringBuilder result = new StringBuilder();
        for (String word : text.split(" ")) {
            if (word.isEmpty()) {
                continue;
            }
            if (result.length() > 0) {
                result.append(' ');
            }
            result.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1));
        }
        return result.toString();
    }
}
