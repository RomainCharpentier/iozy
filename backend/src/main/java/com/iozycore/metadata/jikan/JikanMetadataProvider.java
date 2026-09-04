package com.iozycore.metadata.jikan;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.metadata.MetadataCandidate;
import com.iozycore.metadata.MetadataProvider;
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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Interroge l'API publique Jikan (https://jikan.moe), qui expose les
 * données de MyAnimeList sans nécessiter de clé d'API. Couvre le type
 * MANGA uniquement.
 * <p>
 * @Order(2) : derrière AniList (Lot 119), avant GoogleBooksTitleSearchProvider dans
 * MetadataSearchService.search - en cas de titre identique remonté par les
 * deux (ex: "Naruto", inchangé en français), le résultat Jikan/MAL gagne le
 * dédoublonnage (attributs plus riches : titleEnglish/titleRomaji/mediaType/
 * startYear, utiles à la résolution du titre et à la recherche de tomes).
 */
@Component
@Order(2)
public class JikanMetadataProvider implements MetadataProvider {

    private static final Logger log = LoggerFactory.getLogger(JikanMetadataProvider.class);
    private static final String SEARCH_URL = "https://api.jikan.moe/v4/manga?q=%s&limit=10";

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public boolean supports(EntityType entityType) {
        return "MANGA".equals(entityType.code());
    }

    @Override
    public List<MetadataCandidate> search(String query) {
        try {
            String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(SEARCH_URL.formatted(encodedQuery)))
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("Jikan a répondu {} pour la requête '{}'", response.statusCode(), query);
                return List.of();
            }

            return parse(response.body());
        } catch (Exception e) {
            // Une panne de l'API tierce ne doit jamais faire échouer l'ajout rapide :
            // l'utilisateur pourra toujours saisir le titre manuellement.
            log.warn("Échec de l'appel à Jikan pour '{}' : {}", query, e.getMessage());
            return List.of();
        }
    }

    List<MetadataCandidate> parse(String body) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        JsonNode data = root.path("data");
        List<MetadataCandidate> candidates = new ArrayList<>();

        for (JsonNode item : data) {
            String malId = item.path("mal_id").asText();
            String defaultTitle = item.path("title").asText();
            String imageUrl = item.path("images").path("jpg").path("image_url").asText(null);

            Map<String, Object> attributes = new HashMap<>();
            attributes.put("malId", malId);
            JsonNode authors = item.path("authors");
            if (authors.isArray() && !authors.isEmpty()) {
                attributes.put("mangaka", authors.get(0).path("name").asText(null));
            }
            JsonNode serializations = item.path("serializations");
            if (serializations.isArray() && !serializations.isEmpty()) {
                attributes.put("publisher", serializations.get(0).path("name").asText(null));
            }
            attributes.put("seriesStatus", item.path("status").asText(null));
            // Absent (null)/0 pour une série encore en cours ou dont le décompte
            // final n'est pas encore connu de MAL - jamais stocké dans ce cas
            // (voir Ma collection côté web : "total inconnu" plutôt qu'un faux 0).
            JsonNode volumesNode = item.path("volumes");
            if (volumesNode.isInt() && volumesNode.asInt() > 0) {
                attributes.put("totalVolumes", volumesNode.asInt());
            }
            // Un même titre peut désigner plusieurs œuvres distinctes chez MAL/Jikan
            // (ex: le manga "Naruto" et un one-shot pilote également titré "Naruto") -
            // type + année de première publication permettent à l'utilisateur de les
            // distinguer dans la liste de suggestions (voir QuickAddPage/QuickAddView).
            attributes.put("mediaType", item.path("type").asText(null));
            attributes.put("startYear", extractYear(item.path("published").path("from").asText(null)));

            // Le "titre" MAL/Jikan (defaultTitle) est souvent le romaji/japonais
            // (ex: "Shingeki no Kyojin"), pas très lisible pour reconnaître
            // l'œuvre. Aucune de nos sources ne connaît de vrai titre français
            // (ex: "L'Attaque des Titans") - à défaut, le titre anglais (quand
            // fourni et différent) est utilisé comme titre affiché/retenu, les
            // éditeurs français le reprenant parfois tel quel. Le romaji
            // d'origine est conservé en attribut ("originalTitle") pour ne pas
            // perdre l'info, sans polluer l'affichage principal.
            String titleEnglish = item.path("title_english").asText(null);
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
            // Titre japonais natif (ex: "進撃の巨人") - toujours utile en repère
            // visuel à côté du titre retenu (voir candidateDisplayTitle côté
            // web/iOS), qu'il ait ou non déjà servi ci-dessus.
            String titleJapanese = item.path("title_japanese").asText(null);
            if (titleJapanese != null && !titleJapanese.isBlank()) {
                attributes.put("titleJapanese", titleJapanese);
            }

            candidates.add(new MetadataCandidate("JIKAN", malId, title, imageUrl, attributes));
        }
        return candidates;
    }

    /** Extrait "1999" de "1999-09-21T00:00:00+00:00" (format published.from de Jikan). */
    private static String extractYear(String isoDateTime) {
        return isoDateTime != null && isoDateTime.length() >= 4 ? isoDateTime.substring(0, 4) : null;
    }
}
