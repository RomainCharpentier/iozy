package com.iozycore.manga.metadata.openlibrary;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.manga.metadata.FrenchTitleMatch;
import com.iozycore.manga.metadata.FrenchTitleProvider;
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
 * FrenchTitleService.findFrenchTitle, Google Books restant en repli.
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
 *   <li>auteur seul - dernier recours, remonté en {@link
 *       FrenchTitleMatch.Confidence#AUTHOR_ONLY} : rien de la série cherchée
 *       n'a matché, ce n'est qu'un livre français de cet auteur. Deux
 *       garde-fous encadrent ce recours - ici, seule une fiche de tome
 *       NUMÉROTÉ est acceptée (voir {@link #parse}, {@code
 *       requireVolumeNumber}) ; côté appelant, le titre est confronté au
 *       catalogue avant d'être retenu (voir
 *       FrenchTitleService.namesAnotherKnownWork) - sans quoi "Vagabond"
 *       (Takehiko Inoue) se résolvait en "Slam Dunk", son œuvre la plus
 *       connue, vérifié en direct (voir historique de la conversation).</li>
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
    // limit=10 (même correctif que le jumeau GoogleBooksFrenchTitleProvider,
    // voir historique) : le dernier recours "auteur seul" est le plus
    // bruité de la cascade, un résultat tome-numéroté exploitable pouvant
    // apparaître au-delà des 5 premiers résultats pour un auteur prolifique.
    private static final String SEARCH_URL = "https://openlibrary.org/search.json?q=%s&language=fre&limit=10";

    // "Death Note, Vol. 1" / "L'Attaque des Titans Vol. 13" / "Naruto 58" -
    // Open Library indexe chaque tome séparément avec son numéro dans le
    // titre ; on ne veut que le titre de la série pour pré-remplir l'ajout.
    // "-" ajouté au séparateur (même correctif que le jumeau
    // GoogleBooksFrenchTitleProvider.VOLUME_SUFFIX, voir historique - "-"
    // vérifié manuellement sur "Détective Conan - Tome 14" côté Google
    // Books) : sans lui, un titre séparé par un tiret plutôt qu'une virgule
    // laissait un tiret résiduel qui empêchait ensuite tout match de préfixe
    // côté recherche de tomes. "("/")" ajoutés (même correctif que le
    // jumeau, voir historique - vérifié manuellement sur "Gloutons et
    // Dragons (Tome 12)", titre français réel de "Delicious in Dungeon") :
    // sans eux, ce numéro de tome PARENTHÉSÉ n'était jamais reconnu comme
    // tel, faisant retomber le dernier recours "auteur seul" sur un autre
    // livre du même auteur sans numéro de tome.
    private static final Pattern VOLUME_KEYWORD_SUFFIX = Pattern.compile("(?i)[,\\-–(]?\\s*(vol\\.?|tome|t\\.?)\\s*\\d+\\)?\\s*$");
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
    public Optional<FrenchTitleMatch> findFrenchTitle(String query, String author, List<String> excludedTitleFragments) {
        if (query == null || query.isBlank()) {
            return Optional.empty();
        }

        Optional<String> exactMatch = search(combine(author, query), excludedTitleFragments, false);
        if (exactMatch.isPresent()) {
            return exactMatch.map(FrenchTitleMatch::seriesMatched);
        }

        if (author == null || author.isBlank()) {
            return Optional.empty();
        }

        for (String keyword : significantWords(query)) {
            Optional<String> byKeyword = search(combine(author, keyword), excludedTitleFragments, false);
            if (byKeyword.isPresent()) {
                return byKeyword.map(FrenchTitleMatch::seriesMatched);
            }
        }

        // Un mononyme (un seul mot, ex: "Takahiro" - pseudonyme courant côté
        // scénaristes manga) est trop risqué à chercher SEUL - voir
        // isTooGenericForAuthorOnlySearch.
        if (isTooGenericForAuthorOnlySearch(author)) {
            return Optional.empty();
        }
        // requireVolumeNumber : voir javadoc de la classe et de parse().
        return search(author, excludedTitleFragments, true).map(FrenchTitleMatch::authorOnly);
    }

    /**
     * Vrai si {@code author} tient en un seul mot - trop risqué à chercher
     * SEUL en dernier recours (voir {@link #findFrenchTitle}) : Open Library
     * matche n'importe quel auteur dont le nom CONTIENT ce mot, y compris
     * une personne réelle totalement SANS RAPPORT qui partage juste un
     * prénom courant - pire que le risque déjà documenté ailleurs (voir
     * {@link #parse}, retomber sur une AUTRE œuvre du MÊME auteur) : ici, ce
     * n'est même pas le bon auteur. Cas réel trouvé en continuant les tests
     * sur "Akame ga Kill" (voir historique) : "Takahiro" (le scénariste)
     * remontait "Trapped Life" de "Haruki Takahiro", une personne
     * différente sans aucun rapport. Un nom COMPLET (plusieurs mots) reste
     * tenté tel quel : bien plus distinctif, le risque de collision devient
     * minime.
     */
    static boolean isTooGenericForAuthorOnlySearch(String author) {
        return !author.trim().contains(" ");
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

    private Optional<String> search(String rawQuery, List<String> excludedTitleFragments, boolean requireVolumeNumber) {
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

            return parse(response.body(), excludedTitleFragments, requireVolumeNumber);
        } catch (Exception e) {
            log.warn("Échec de la recherche de titre français Open Library pour '{}' : {}", rawQuery, e.getMessage());
            return Optional.empty();
        }
    }

    Optional<String> parse(String body) throws Exception {
        return parse(body, List.of());
    }

    /** Variante avec exclusion de suites/spin-offs connus (voir RelatedSeriesService) -
     * séparée de {@link #parse(String)} pour ne pas casser les tests existants
     * qui n'en ont pas besoin. */
    Optional<String> parse(String body, List<String> excludedTitleFragments) throws Exception {
        return parse(body, excludedTitleFragments, false);
    }

    /**
     * @param requireVolumeNumber n'accepter QUE des fiches de tome numéroté,
     *                            sans jamais se rabattre sur un résultat sans
     *                            numéro - réservé au dernier recours "auteur
     *                            seul" (voir {@link #findFrenchTitle}), la
     *                            seule étape de la cascade où les résultats
     *                            ne sont rattachés à la série cherchée par
     *                            RIEN : un livre sans numéro de tome y est
     *                            presque toujours un artbook/guide/one-shot
     *                            du même auteur ("Les Sept Rejetons du
     *                            dragon" pour "Delicious in Dungeon",
     *                            vérifié en direct), pas l'édition française
     *                            cherchée.
     */
    Optional<String> parse(String body, List<String> excludedTitleFragments, boolean requireVolumeNumber) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        // Repli si AUCUN résultat n'a de numéro de tome extractible (voir
        // plus bas) - jamais le choix par défaut : un vrai manga multi-tome
        // en a presque toujours un dans les 5 premiers résultats.
        String firstResultWithoutTomeNumber = null;
        for (JsonNode doc : root.path("docs")) {
            String rawTitle = doc.path("title").asText(null);
            if (rawTitle == null || rawTitle.isBlank()) {
                continue;
            }
            // "language=fre" dans la requête (voir SEARCH_URL) ne garantit
            // QUE l'existence d'UNE édition française parmi toutes celles de
            // l'œuvre - le champ "title" renvoyé reste le titre canonique de
            // l'œuvre, souvent en japonais pour un manga (ex: "名探偵コナン"
            // pour "Detective Conan"/"Détective Conan", vérifié manuellement
            // en continuant les tests, voir historique) : Open Library ne
            // propose pas de titre PAR ÉDITION dans cet endpoint de
            // recherche, contrairement à Google Books où "language" est
            // vérifié PAR VOLUME juste en dessous (voir
            // GoogleBooksFrenchTitleProvider). Un titre français ne contient
            // jamais de sinogramme/kana/hangeul - filet de sécurité peu
            // coûteux avant de le retenir comme "titre français".
            if (containsCjkCharacters(rawTitle)) {
                continue;
            }
            // "Dragon Ball Super nº 18" ressort en premier résultat pour
            // "Dragon Ball Akira Toriyama" (vérifié manuellement, voir
            // historique) - Open Library le classe avant le vrai "Dragon
            // Ball, tome 1", exactement le même biais de popularité déjà
            // rencontré côté Google Books (voir GoogleBooksVolumeSearchProvider).
            // "Dragon Ball Super" partage pourtant bien le préfixe "Dragon
            // Ball" - un simple filtre de préfixe ne suffirait pas ici,
            // seule cette information externe (suite/spin-off connu(e) sur
            // MyAnimeList) permet de l'écarter.
            if (matchesKnownRelatedSeries(rawTitle, excludedTitleFragments)) {
                continue;
            }
            String trimmedTitle = rawTitle.trim();
            String cleaned = cleanVolumeSuffix(trimmedTitle);
            if (cleaned.isBlank()) {
                continue;
            }
            // Un numéro de tome a bien été retiré (cleaned != trimmedTitle) :
            // signal fort qu'il s'agit d'une vraie fiche de tome de la
            // série, pas d'un simple homonyme - même correctif que le
            // jumeau GoogleBooksFrenchTitleProvider (voir historique) :
            // "L'Art des Sorciers" (artbook sans rapport, même auteur)
            // avant "L'Atelier des Sorciers T15" (le vrai manga).
            if (!cleaned.equals(trimmedTitle)) {
                return Optional.of(cleaned);
            }
            if (firstResultWithoutTomeNumber == null) {
                firstResultWithoutTomeNumber = cleaned;
            }
        }
        return requireVolumeNumber ? Optional.empty() : Optional.ofNullable(firstResultWithoutTomeNumber);
    }

    // Kanji/hiragana/katakana/hangeul - jamais présents dans un titre
    // français réel, voir javadoc de parse().
    private static final Pattern CJK_CHARACTERS = Pattern.compile("[\\p{IsHan}\\p{IsHiragana}\\p{IsKatakana}\\p{IsHangul}]");

    private static boolean containsCjkCharacters(String text) {
        return CJK_CHARACTERS.matcher(text).find();
    }

    /** Comparaison par mot entier (?U pour reconnaître les lettres accentuées
     * comme des caractères de mot) - un simple contains() ferait matcher un
     * fragment générique/court à l'intérieur d'un autre mot sans rapport. */
    private static boolean matchesKnownRelatedSeries(String title, List<String> excludedTitleFragments) {
        for (String fragment : excludedTitleFragments) {
            if (Pattern.compile("(?iU)\\b" + Pattern.quote(fragment) + "\\b").matcher(title).find()) {
                return true;
            }
        }
        return false;
    }

    /** "L'Attaque des Titans Vol. 13" -> "L'Attaque des Titans", "Naruto 58" -> "Naruto". */
    static String cleanVolumeSuffix(String rawTitle) {
        String withoutKeywordSuffix = VOLUME_KEYWORD_SUFFIX.matcher(rawTitle).replaceFirst("");
        return TRAILING_NUMBER_SUFFIX.matcher(withoutKeywordSuffix).replaceFirst("").trim();
    }
}
