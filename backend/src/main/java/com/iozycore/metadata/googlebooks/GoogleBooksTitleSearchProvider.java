package com.iozycore.metadata.googlebooks;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.metadata.MetadataCandidate;
import com.iozycore.metadata.MetadataProvider;
import com.iozycore.metadata.QuotaExceededException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Recherche par titre FRANÇAIS via Google Books - complète Jikan/MyAnimeList
 * qui ne connaissent que les titres japonais/anglais/romaji, jamais le titre
 * choisi par l'éditeur français (Open Library, essayé initialement pour ce
 * même rôle, n'avait aucune fiche pour certaines séries - voir historique de
 * la conversation - et a été retiré au profit de Google Books, qui les
 * indexe abondamment).
 * <p>
 * Cas réel qui motive ce provider (vérifié manuellement, voir historique de
 * la conversation) : "Forget Me Not" (Nao Emoto) est publié en France sous
 * le titre "Fragments d'elles" (Pika).
 * <p>
 * Tourne toujours en parallèle de Jikan/MyAnimeList (jamais en repli
 * conditionnel) - un résultat non pertinent de ces sources est indiscernable
 * à l'avance d'une recherche par titre français. @Order(3), après Jikan(1)/
 * MyAnimeList(2) : MetadataSearchService.search dédoublonne par titre exact
 * (ex: "Naruto", inchangé en français) en gardant le premier rencontré -
 * Jikan/MAL doivent gagner ce dédoublonnage (attributs plus riches).
 * <p>
 * Filtre par éditeur manga connu (vérifié manuellement, voir historique de
 * la conversation) : un titre générique comme "Fragment" (mot très courant
 * en français) remonte sinon des centaines de vieux ouvrages académiques/
 * littéraires du domaine public ("Fragment d'un mémoire sur l'éducation des
 * femmes au Moyen Âge", etc.) qui noient complètement le manga cherché -
 * intitle: seul ne suffit pas à limiter Google Books au rayon manga. Aucun
 * de ces faux positifs n'a de champ publisher renseigné, ou alors un
 * éditeur académique (Gallimard, PUF, Editions Allia...) - jamais un des
 * éditeurs manga francophones ci-dessous.
 */
@Component
@Order(3)
public class GoogleBooksTitleSearchProvider implements MetadataProvider {

    private static final Logger log = LoggerFactory.getLogger(GoogleBooksTitleSearchProvider.class);
    private static final String SEARCH_URL =
            "https://www.googleapis.com/books/v1/volumes?q=intitle:%s&langRestrict=fr&maxResults=20";

    // "Fragments d'elles Tome 2" / "Fragments d'elles T01" / "Naruto -
    // Tome 5" - Google Books indexe chaque tome séparément ; \b devant le
    // mot-clé + point optionnel couvrent "Tome N" et l'abrégé "TNN" sans
    // point (vérifié manuellement) - même règle que
    // GoogleBooksVolumeSearchProvider. Le séparateur avant le mot-clé
    // (virgule, tiret simple/moyen, espaces) est lui aussi retiré : sans ça,
    // "Naruto - Tome 5" ne perdait que " Tome 5", laissant "Naruto -" avec
    // un tiret résiduel (constaté en vérifiant en direct).
    private static final Pattern VOLUME_SUFFIX = Pattern.compile("(?i)[,\\-–]?\\s*\\b(?:tome|vol\\.?|t\\.?)\\s*\\d+\\s*$");

    // Principaux éditeurs manga/comics francophones - liste non exhaustive
    // par nature (un éditeur absent d'ici reste invisible à ce filtre), mais
    // couvre l'essentiel du marché. Comparaison en "contains" (insensible à
    // la casse) : Google Books ajoute parfois un suffixe ("Glénat Manga").
    private static final Set<String> KNOWN_MANGA_PUBLISHERS = Set.of(
            "pika", "kana", "glénat", "kurokawa", "delcourt", "ki-oon", "soleil manga",
            "panini manga", "doki-doki", "akata", "meian", "vega", "tonkam", "casterman",
            "kazé", "nobi nobi", "komikku", "mangetsu", "bamboo", "kbooks", "taifu",
            "ototo", "urban comics", "kotoji", "kotori", "black box", "isan manga");

    private final GoogleBooksHttpClient httpClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    public GoogleBooksTitleSearchProvider(GoogleBooksHttpClient httpClient) {
        this.httpClient = httpClient;
    }

    /** Constructeur utilisé par les tests unitaires : parse() sur un corps
     * déjà en mémoire n'a jamais besoin d'un vrai appel réseau. */
    GoogleBooksTitleSearchProvider() {
        this(new GoogleBooksHttpClient("", ""));
    }

    /** Ce fournisseur cherche justement par titre FRANÇAIS - voir la javadoc
     * de la méthode : il ne peut pas servir à décider qu'un titre français
     * est "en fait le titre d'une autre œuvre". */
    @Override
    public boolean catalogsOriginalTitles() {
        return false;
    }

    @Override
    public boolean supports(EntityType entityType) {
        return "MANGA".equals(entityType.code());
    }

    @Override
    public List<MetadataCandidate> search(String query) {
        if (query == null || query.isBlank()) {
            return List.of();
        }

        try {
            String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);
            String body = httpClient.get(SEARCH_URL.formatted(encodedQuery));
            return parse(body);
        } catch (QuotaExceededException e) {
            // Best-effort par nature (complète Jikan/MyAnimeList, jamais leur
            // seule source) - pas d'alarme utilisateur nécessaire ici.
            log.warn("Quota Google Books dépassé pour la recherche par titre '{}'", query);
            return List.of();
        } catch (Exception e) {
            log.warn("Échec de la recherche par titre Google Books pour '{}' : {}", query, e.getMessage());
            return List.of();
        }
    }

    List<MetadataCandidate> parse(String body) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        List<MetadataCandidate> candidates = new ArrayList<>();
        // Une série a souvent plusieurs tomes indexés séparément - une seule
        // suggestion par série une fois le numéro de tome retiré du titre.
        Set<String> seenTitles = new HashSet<>();

        for (JsonNode item : root.path("items")) {
            String id = item.path("id").asText(null);
            JsonNode volumeInfo = item.path("volumeInfo");
            if (!"fr".equals(volumeInfo.path("language").asText(null))) {
                continue; // langRestrict est une préférence, pas une garantie - on revérifie
            }
            String rawTitle = volumeInfo.path("title").asText(null);
            if (id == null || rawTitle == null || rawTitle.isBlank()) {
                continue;
            }
            String title = VOLUME_SUFFIX.matcher(rawTitle).replaceFirst("").trim();
            if (title.isBlank()) {
                continue;
            }

            // Le filtre éditeur DOIT précéder le dédoublonnage par série : Google
            // Books renvoie souvent le même titre nettoyé plusieurs fois (un tome
            // par fiche), certaines fiches sans champ publisher renseigné et
            // d'autres avec - si la première occurrence rencontrée est filtrée
            // (pas d'éditeur reconnu), le dédoublonnage ne doit pas empêcher une
            // occurrence suivante, valide, de passer (bug constaté : une fiche
            // "Tome 2" sans éditeur "consommait" la série avant qu'une fiche "T01"
            // avec editeur "Pika" n'ait sa chance).
            String publisher = volumeInfo.path("publisher").asText(null);
            if (!isKnownMangaPublisher(publisher) || !seenTitles.add(title.toLowerCase())) {
                continue;
            }

            Map<String, Object> attributes = new HashMap<>();
            JsonNode authors = volumeInfo.path("authors");
            if (authors.isArray() && !authors.isEmpty()) {
                attributes.put("mangaka", authors.get(0).asText(null));
            }
            attributes.put("publisher", publisher);

            String imageUrl = volumeInfo.path("imageLinks").path("thumbnail").asText(null);
            if (imageUrl != null) {
                imageUrl = imageUrl.replaceFirst("^http://", "https://");
            }

            candidates.add(new MetadataCandidate("GOOGLE_BOOKS", id, title, imageUrl, attributes));
        }
        return candidates;
    }

    private static boolean isKnownMangaPublisher(String publisher) {
        if (publisher == null || publisher.isBlank()) {
            return false;
        }
        String normalized = publisher.toLowerCase();
        return KNOWN_MANGA_PUBLISHERS.stream().anyMatch(normalized::contains);
    }
}
