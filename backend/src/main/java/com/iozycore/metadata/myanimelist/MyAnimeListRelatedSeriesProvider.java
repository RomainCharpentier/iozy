package com.iozycore.metadata.myanimelist;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.metadata.RelatedSeriesProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Interroge l'API officielle MyAnimeList v2 (voir MyAnimeListMetadataProvider,
 * même Client ID) pour les séries liées ({@code related_manga}) d'un manga -
 * volontairement PAS Jikan (wrapper tiers, voir javadoc de
 * MyAnimeListMetadataProvider) : constaté indisponible (504 "failed to
 * connect to MyAnimeList") au moment d'écrire ce fournisseur, alors que
 * l'API officielle répondait normalement pour le même identifiant.
 * <p>
 * "spin_off", "side_story" et "sequel" sont retenues comme séries
 * clairement DISTINCTES (vérifié manuellement sur "Blue Lock" -&gt; "Blue
 * Lock: Episode Nagi" et "Demon Slayer" -&gt; "Kimetsu Gakuen!", tous deux
 * tagués "spin_off" ; "Dragon Ball" -&gt; "Dragon Ball Super", tagué
 * "sequel" - une suite avec sa propre histoire, pas une édition) -
 * "alternative_version"/"alternative_setting" restent volontairement
 * EXCLUES de cette liste : elles désignent souvent une vraie réédition
 * (kanzenban, couleur...) qu'on veut au contraire GARDER comme résultat de
 * recherche de tomes. Limite assumée (vérifié manuellement, voir
 * historique) : "Dragon Ball" -&gt; "Dragon Ball SD" (parodie/spin-off
 * comique à l'histoire distincte) est tagué "alternative_version" sur
 * MyAnimeList, pas "spin_off" - il reste donc affiché à tort comme une
 * édition, MyAnimeList ne distinguant pas fiablement dans cette catégorie
 * une vraie réédition d'une réinterprétation à l'histoire différente.
 * <p>
 * Pas de mode dégradé sans Client ID configuré (comme MyAnimeListMetadataProvider) :
 * supports() renvoie false tant que {@code mal.client-id} est vide.
 */
@Component
public class MyAnimeListRelatedSeriesProvider implements RelatedSeriesProvider {

    private static final Logger log = LoggerFactory.getLogger(MyAnimeListRelatedSeriesProvider.class);
    private static final String RELATIONS_URL = "https://api.myanimelist.net/v2/manga/%s?fields=related_manga";
    private static final Set<String> DISTINCT_SERIES_RELATIONS = Set.of("spin_off", "side_story", "sequel");

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
    public List<String> findRelatedSeriesTitles(String externalId) {
        if (externalId == null || externalId.isBlank()) {
            return List.of();
        }
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(RELATIONS_URL.formatted(externalId)))
                    .timeout(Duration.ofSeconds(8))
                    .header("X-MAL-CLIENT-ID", clientId)
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("MyAnimeList a répondu {} pour les relations de '{}'", response.statusCode(), externalId);
                return List.of();
            }

            return parse(response.body());
        } catch (Exception e) {
            // Best-effort : une panne ne doit jamais bloquer la recherche de
            // tomes, juste la priver de ce filtre supplémentaire.
            log.warn("Échec de la recherche des relations MyAnimeList pour '{}' : {}", externalId, e.getMessage());
            return List.of();
        }
    }

    List<String> parse(String body) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        List<String> titles = new ArrayList<>();
        for (JsonNode relation : root.path("related_manga")) {
            String relationType = relation.path("relation_type").asText("");
            if (!DISTINCT_SERIES_RELATIONS.contains(relationType)) {
                continue;
            }
            String title = relation.path("node").path("title").asText(null);
            if (title != null && !title.isBlank()) {
                titles.add(title);
            }
        }
        return titles;
    }
}
