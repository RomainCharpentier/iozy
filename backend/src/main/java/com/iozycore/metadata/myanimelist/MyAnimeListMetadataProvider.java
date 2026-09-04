package com.iozycore.metadata.myanimelist;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.metadata.MetadataCandidate;
import com.iozycore.metadata.MetadataProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Interroge l'API officielle MyAnimeList v2 (authentifiée par un simple
 * Client ID applicatif, sans flux OAuth complet - voir README.md, section
 * "Obtenir et configurer un Client ID MyAnimeList") en complément de Jikan
 * pour le type MANGA.
 * <p>
 * Contrairement à Jikan (wrapper tiers qui doit lui-même se connecter à
 * MyAnimeList à chaque requête, et que MyAnimeList bloque/throttle par
 * intermittence - pannes 504 "failed to connect to MyAnimeList" fréquentes),
 * cette API est servie directement par MyAnimeList : elle reste disponible
 * indépendamment de l'état de Jikan. Les deux fournisseurs sont agrégés par
 * MetadataSearchService (jamais l'un à la place de l'autre) - si Jikan est
 * down, ses résultats sont simplement absents et ceux-ci prennent le relais.
 * <p>
 * Pas de mode dégradé sans Client ID configuré (comme IGDB) : supports()
 * renvoie false tant que {@code mal.client-id} est vide, ce qui revient à
 * l'absence de ce fournisseur (Jikan reste seul, comportement inchangé).
 * <p>
 * @Order(3) : derrière AniList et Jikan (Lot 119), avant GoogleBooksTitleSearchProvider dans
 * MetadataSearchService.search - même raison que sur JikanMetadataProvider.
 */
@Component
@Order(3)
public class MyAnimeListMetadataProvider implements MetadataProvider {

    private static final Logger log = LoggerFactory.getLogger(MyAnimeListMetadataProvider.class);
    private static final String SEARCH_URL = "https://api.myanimelist.net/v2/manga?q=%s&limit=10"
            + "&fields=main_picture,media_type,start_date,alternative_titles,"
            + "authors%%7Bfirst_name,last_name%%7D,serialization%%7Bname%%7D,status,num_volumes";

    @Value("${mal.client-id:}")
    private String clientId;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public boolean supports(EntityType entityType) {
        return "MANGA".equals(entityType.code()) && clientId != null && !clientId.isBlank();
    }

    @Override
    public List<MetadataCandidate> search(String query) {
        try {
            String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(SEARCH_URL.formatted(encodedQuery)))
                    .timeout(Duration.ofSeconds(8))
                    .header("X-MAL-CLIENT-ID", clientId)
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("MyAnimeList a répondu {} pour la requête '{}'", response.statusCode(), query);
                return List.of();
            }

            return parse(response.body());
        } catch (Exception e) {
            // Une panne de l'API tierce ne doit jamais faire échouer l'ajout rapide :
            // Jikan (s'il est up) ou la saisie manuelle prennent le relais.
            log.warn("Échec de l'appel à MyAnimeList pour '{}' : {}", query, e.getMessage());
            return List.of();
        }
    }

    List<MetadataCandidate> parse(String body) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        JsonNode data = root.path("data");
        List<MetadataCandidate> candidates = new ArrayList<>();

        for (JsonNode item : data) {
            JsonNode node = item.path("node");
            String malId = node.path("id").asText();
            String defaultTitle = node.path("title").asText();
            JsonNode mainPicture = node.path("main_picture");
            String imageUrl = mainPicture.path("large").asText(null);
            if (imageUrl == null) {
                imageUrl = mainPicture.path("medium").asText(null);
            }

            Map<String, Object> attributes = new HashMap<>();
            attributes.put("malId", malId);
            JsonNode authors = node.path("authors");
            if (authors.isArray() && !authors.isEmpty()) {
                JsonNode authorNode = authors.get(0).path("node");
                String firstName = authorNode.path("first_name").asText("");
                String lastName = authorNode.path("last_name").asText("");
                String fullName = (firstName + " " + lastName).trim();
                if (!fullName.isEmpty()) {
                    attributes.put("mangaka", fullName);
                }
            }
            JsonNode serialization = node.path("serialization");
            if (serialization.isArray() && !serialization.isEmpty()) {
                attributes.put("publisher", serialization.get(0).path("node").path("name").asText(null));
            }
            attributes.put("seriesStatus", node.path("status").asText(null));
            // 0 chez MAL v2 signifie "pas encore déterminé" (série en cours ou
            // décompte final inconnu) - jamais stocké dans ce cas (voir Ma
            // collection côté web : "total inconnu" plutôt qu'un faux 0).
            int numVolumes = node.path("num_volumes").asInt(0);
            if (numVolumes > 0) {
                attributes.put("totalVolumes", numVolumes);
            }
            // Un même titre peut désigner plusieurs œuvres distinctes chez MAL
            // (ex: le manga "Naruto" et un one-shot pilote également titré
            // "Naruto") - type + année de première publication permettent à
            // l'utilisateur de les distinguer dans la liste de suggestions
            // (voir QuickAddPage/QuickAddView).
            attributes.put("mediaType", node.path("media_type").asText(null));
            attributes.put("startYear", extractYear(node.path("start_date").asText(null)));
            // Le "titre" MAL (defaultTitle) est souvent le romaji/japonais (ex:
            // "Shingeki no Kyojin"), pas très lisible pour reconnaître l'œuvre.
            // Aucune de nos sources ne connaît de vrai titre français (ex:
            // "L'Attaque des Titans") - à défaut, le titre anglais (quand
            // fourni et différent) est utilisé comme titre affiché/retenu, les
            // éditeurs français le reprenant parfois tel quel. Le romaji
            // d'origine est conservé en attribut ("originalTitle") pour ne pas
            // perdre l'info, sans polluer l'affichage principal.
            String titleEnglish = node.path("alternative_titles").path("en").asText(null);
            String title = defaultTitle;
            if (titleEnglish != null && !titleEnglish.isBlank() && !titleEnglish.equalsIgnoreCase(defaultTitle)) {
                title = titleEnglish;
                attributes.put("originalTitle", defaultTitle);
            }
            // "titleRomaji"/"titleEnglish" (inconditionnels, contrairement à
            // "originalTitle" ci-dessus qui ne sert que le repli anglais) -
            // permettent au client de composer librement l'affichage du titre
            // entre français (best-effort, voir /metadata/french-title),
            // anglais et romaji selon la préférence utilisateur (voir Réglages
            // > Titre des mangas), sans dépendre du choix déjà fait ci-dessus.
            attributes.put("titleRomaji", defaultTitle);
            if (titleEnglish != null && !titleEnglish.isBlank()) {
                attributes.put("titleEnglish", titleEnglish);
            }
            // Titre japonais natif (ex: "進撃の巨人") - déjà présent dans
            // alternative_titles (demandé pour "en" ci-dessus), aucun appel
            // supplémentaire. Toujours utile en repère visuel à côté du titre
            // retenu (voir candidateDisplayTitle côté web/iOS).
            String titleJapanese = node.path("alternative_titles").path("ja").asText(null);
            if (titleJapanese != null && !titleJapanese.isBlank()) {
                attributes.put("titleJapanese", titleJapanese);
            }

            candidates.add(new MetadataCandidate("MYANIMELIST", malId, title, imageUrl, attributes));
        }
        return candidates;
    }

    /** Extrait "1999" de "1999-09-21" (format start_date de MyAnimeList, parfois juste "1999"). */
    private static String extractYear(String isoDate) {
        return isoDate != null && isoDate.length() >= 4 ? isoDate.substring(0, 4) : null;
    }
}
