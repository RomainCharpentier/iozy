package com.iozycore.metadata.anilist;

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
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Le fournisseur PRINCIPAL pour la recherche de mangas : AniList
 * (anilist.co), une base de donnees d'oeuvres - pas un site de lecture -
 * avec une API GraphQL publique, sans cle, 90 requetes par minute et par
 * adresse, sans quota journalier.
 *
 * <h2>Pourquoi en premier</h2>
 * Ne le 2026-09-04 comme secours, quand Jikan repondait 504 et Google Books
 * 429 en meme temps ; passe en tete le meme jour, sur une regle donnee par
 * l'utilisateur : <b>mettre en avant la source qui a le plus d'appels
 * disponibles</b>, pour que les oeuvres de l'application viennent du meme
 * endroit et portent les memes donnees (Lot 119). Jikan est limite a 60
 * requetes par minute et bloque par intermittence, l'API MyAnimeList
 * officielle demande une cle, Google Books a un quota journalier ; AniList
 * n'a ni cle ni quota du jour. Les trois autres restent derriere (2, 3, 4) :
 * la deduplication par titre garde le premier candidat rencontre, donc le
 * sien quand il repond, le leur quand il se tait.
 *
 * <p>Il rend titre, annee, statut, nombre de tomes, auteur, jaquette et
 * l'identifiant MyAnimeList ({@code idMal}), sous les memes cles d'attributs
 * que Jikan : la resolution du titre francais et la recherche de tomes n'y
 * voient aucune difference. Il ne connait pas les titres francais : cette
 * partie reste a Open Library et Google Books, et les tomes a la BnF.
 */
@Component
@Order(1)
public class AniListMetadataProvider implements MetadataProvider {

    private static final Logger log = LoggerFactory.getLogger(AniListMetadataProvider.class);

    private static final String ENDPOINT = "https://graphql.anilist.co";
    private static final String QUERY = """
            query ($q: String) {
              Page(perPage: 10) {
                media(search: $q, type: MANGA, sort: [POPULARITY_DESC]) {
                  id idMal format status volumes
                  startDate { year }
                  title { romaji english native }
                  coverImage { large }
                  staff(perPage: 6) { edges { role node { name { full } } } }
                }
              }
            }""";

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
            String body = objectMapper.writeValueAsString(Map.of("query", QUERY, "variables", Map.of("q", query)));
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(ENDPOINT))
                    .timeout(Duration.ofSeconds(8))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("AniList a répondu {} pour la requête '{}'", response.statusCode(), query);
                return List.of();
            }
            return parse(response.body());
        } catch (Exception e) {
            log.warn("Échec de l'appel à AniList pour '{}' : {}", query, e.getMessage());
            return List.of();
        }
    }

    /** Paquet-prive pour les tests : une reponse deja en memoire, sans HTTP. */
    List<MetadataCandidate> parse(String body) throws Exception {
        List<MetadataCandidate> candidates = new ArrayList<>();
        for (JsonNode media : objectMapper.readTree(body).path("data").path("Page").path("media")) {
            String id = media.path("id").asText(null);
            JsonNode titles = media.path("title");
            String romaji = lisible(texte(titles, "romaji"));
            String english = lisible(texte(titles, "english"));
            String title = romaji != null ? romaji : english;
            if (id == null || title == null) {
                continue;
            }
            // Memes cles que Jikan (voir JikanMetadataProvider.parse) : tout
            // ce qui lit un candidat - sous-titre de la liste, resolution du
            // titre francais, recherche de tomes - les retrouve a leur place.
            Map<String, Object> attrs = new LinkedHashMap<>();
            attrs.put("mediaType", libelleFormat(media.path("format").asText(null)));
            attrs.put("titleRomaji", title);
            if (english != null) {
                attrs.put("titleEnglish", english);
            }
            String natif = texte(titles, "native");
            if (natif != null) {
                attrs.put("titleJapanese", natif);
                attrs.put("originalTitle", natif);
            }
            if (media.path("startDate").path("year").isNumber()) {
                attrs.put("startYear", String.valueOf(media.path("startDate").path("year").asInt()));
            }
            String status = media.path("status").asText(null);
            if (status != null) {
                attrs.put("seriesStatus", status);
            }
            if (media.path("volumes").isNumber()) {
                attrs.put("totalVolumes", media.path("volumes").asInt());
            }
            if (media.path("idMal").isNumber()) {
                attrs.put("malId", media.path("idMal").asText());
            }
            String mangaka = mangaka(media.path("staff").path("edges"));
            if (mangaka != null) {
                attrs.put("mangaka", mangaka);
            }
            String imageUrl = texte(media.path("coverImage"), "large");
            candidates.add(new MetadataCandidate("ANILIST", id, title, imageUrl, attrs));
        }
        return candidates;
    }

    /**
     * L'auteur au sens de Jikan (un seul nom) : qui fait l'histoire ET le
     * dessin d'abord, puis l'histoire seule, puis le dessin - jamais le
     * « createur original » d'un derive, qui n'a pas ecrit ce livre-la.
     */
    private static String mangaka(JsonNode edges) {
        String[] priorites = {"Story & Art", "Story", "Art", "Illustration"};
        for (String role : priorites) {
            for (JsonNode edge : edges) {
                String r = edge.path("role").asText("");
                if (r.startsWith(role)) {
                    String nom = edge.path("node").path("name").path("full").asText(null);
                    if (nom != null && !nom.isBlank()) {
                        return nom;
                    }
                }
            }
        }
        return null;
    }

    /** Le vocabulaire de Jikan (« Manga », « Light Novel », « One-shot »), pour un sous-titre homogene dans la liste. */
    private static String libelleFormat(String format) {
        if (format == null) {
            return "Manga";
        }
        return switch (format) {
            case "NOVEL" -> "Light Novel";
            case "ONE_SHOT" -> "One-shot";
            default -> "Manga";
        };
    }

    /**
     * AniList reprend parfois la stylisation de l'editeur, tout en capitales
     * (« BORUTO: NARUTO NEXT GENERATIONS ») la ou MyAnimeList ecrit « Boruto:
     * Naruto Next Generations ». Un titre SANS aucune minuscule est remis en
     * casse de titre - les autres ne sont pas touches, une capitale isolee
     * pouvant etre voulue (« JoJo »).
     */
    static String lisible(String titre) {
        if (titre == null || titre.chars().anyMatch(Character::isLowerCase)
                || titre.chars().noneMatch(Character::isLetter)) {
            return titre;
        }
        StringBuilder sb = new StringBuilder(titre.length());
        boolean debutDeMot = true;
        for (char c : titre.toCharArray()) {
            if (Character.isLetter(c)) {
                sb.append(debutDeMot ? Character.toUpperCase(c) : Character.toLowerCase(c));
                debutDeMot = false;
            } else {
                sb.append(c);
                debutDeMot = !Character.isDigit(c);
            }
        }
        return sb.toString();
    }

    private static String texte(JsonNode node, String champ) {
        String v = node.path(champ).asText(null);
        return v == null || v.isBlank() ? null : v;
    }
}
