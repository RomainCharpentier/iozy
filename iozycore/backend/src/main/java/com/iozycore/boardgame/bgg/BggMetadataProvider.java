package com.iozycore.boardgame.bgg;

import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.core.metadata.MetadataProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilderFactory;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.Comparator;
import java.util.Locale;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;

/**
 * Queries the BoardGameGeek public XML API. Covers the BOARD_GAME type
 * only.
 * <p>
 * Since July 2025, BGG requires an application registration and a token
 * Bearer for almost all of its API (see BggAuthorization) - the
 * token is configurable with bgg.application-token (BGG_APPLICATION_TOKEN),
 * optional so as not to block local development, but its absence
 * is logged as a warning.
 * <p>
 * The search endpoint returns no image and no number of players or
 * duration - only id/title/year. The rest needs a second call per game to
 * /xmlapi2/thing (see BggThingFetcher). It is made in {@link #details}, for
 * the one game being added or opened (batch 160), never for every result:
 * that would cost ten calls per keystroke.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class BggMetadataProvider implements MetadataProvider {

    private static final String SEARCH_URL = "https://boardgamegeek.com/xmlapi2/search?query=%s&type=boardgame";

    @Value("${bgg.application-token:}")
    private String applicationToken;

    private final BggThingFetcher thingFetcher;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    @Override
    public boolean supports(EntityType entityType) {
        return "BOARD_GAME".equals(entityType.code());
    }

    @Override
    public List<MetadataCandidate> search(String query) {
        try {
            if (applicationToken == null || applicationToken.isBlank()) {
                log.warn("No bgg.application-token configured - unauthenticated BGG call, "
                        + "not compliant with BGG's current terms (see boardgamegeek.com/using_the_xml_api)");
            }
            String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);
            HttpRequest request = BggAuthorization.applyToken(HttpRequest.newBuilder()
                            .uri(URI.create(SEARCH_URL.formatted(encodedQuery)))
                            .timeout(Duration.ofSeconds(8))
                            .GET(),
                    applicationToken).build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("BGG answered {} for the query '{}'", response.statusCode(), query);
                return List.of();
            }

            return classerParPertinence(parse(response.body()), query);
        } catch (Exception e) {
            log.warn("Call to BGG failed for '{}': {}", query, e.getMessage());
            return List.of();
        }
    }

    /**
     * The cover, players, playing time and designers of the game whose
     * {@code bggId} is in {@code attributes}. The keys are the ones the board
     * game type already declares (minPlayers, maxPlayers,
     * averageDurationMinutes), and the cover goes under the shared
     * {@code coverImageUrl}, read by the collection, the wishes and the share
     * page alike.
     *
     * @throws com.iozycore.core.metadata.SourceUnavailableException when BGG did not answer
     */
    @Override
    public Map<String, Object> details(Map<String, Object> attributes) {
        Object bggId = attributes == null ? null : attributes.get("bggId");
        if (bggId == null || bggId.toString().isBlank()) {
            return Map.of();
        }
        return detailsOf(thingFetcher.fetchThing(bggId.toString().trim()));
    }

    static Map<String, Object> detailsOf(BggThing thing) {
        Map<String, Object> details = new LinkedHashMap<>();
        if (thing.imageUrl() != null) {
            details.put("coverImageUrl", thing.imageUrl());
        }
        if (thing.yearPublished() != null) {
            details.put("yearPublished", thing.yearPublished());
        }
        if (thing.minPlayers() != null) {
            details.put("minPlayers", thing.minPlayers());
        }
        if (thing.maxPlayers() != null) {
            details.put("maxPlayers", thing.maxPlayers());
        }
        if (thing.playingTimeMinutes() != null) {
            details.put("averageDurationMinutes", thing.playingTimeMinutes());
        }
        if (!thing.designers().isEmpty()) {
            details.put("designers", String.join(", ", thing.designers()));
        }
        return details;
    }

    /**
     * Number of results shown on the search screen - same cap as the
     * manga provider, which asks Jikan for it directly ({@code limit=10}).
     * BGG, on the other hand, returns EVERYTHING: "Carcassonne" brings back 144 rows.
     */
    private static final int MAX_RESULTATS = 10;

    /**
     * Ranks the BGG results by relevance, and keeps only the
     * first ones.
     *
     * <h2>Why this is needed</h2>
     * The BGG API returns its matches in ITS order - alphabetical - and
     * without limit. Searching "Carcassonne" gave 144 rows opened by
     * thirteen amateur expansions ("Am Pranger", "Angler & Fischfarm"...), the
     * game itself coming in fourteenth position. The exact title that was
     * just typed must be the first result.
     *
     * <p>Only four ranks, and the BGG order kept inside
     * each one: exact title, then title that STARTS with the search, then
     * title that contains it, then the rest. No continuous score - it would be
     * harder to explain than to compute, and nothing here asks for it.
     */
    static List<MetadataCandidate> classerParPertinence(List<MetadataCandidate> candidats, String query) {
        String recherche = normaliser(query);
        return candidats.stream()
                .sorted(Comparator.comparingInt(candidat -> rang(normaliser(candidat.title()), recherche)))
                .limit(MAX_RESULTATS)
                .toList();
    }

    private static int rang(String titre, String recherche) {
        if (titre.equals(recherche)) {
            return 0;
        }
        if (titre.startsWith(recherche)) {
            return 1;
        }
        return titre.contains(recherche) ? 2 : 3;
    }

    /** Lowercase without accents: "Baum fällt" and "baum fallt" mean the
     *  same game, and the user rarely types the diacritics. */
    private static String normaliser(String valeur) {
        return Normalizer.normalize(valeur == null ? "" : valeur, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .trim()
                .toLowerCase(Locale.ROOT);
    }

    List<MetadataCandidate> parse(String xmlBody) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true); // XXE prevention
        Document document = factory.newDocumentBuilder()
                .parse(new org.xml.sax.InputSource(new java.io.StringReader(xmlBody)));

        NodeList items = document.getElementsByTagName("item");
        List<MetadataCandidate> candidates = new ArrayList<>();

        for (int i = 0; i < items.getLength(); i++) {
            Element item = (Element) items.item(i);
            String id = item.getAttribute("id");
            String title = extractPrimaryName(item);
            String yearPublished = extractAttribute(item, "yearpublished", "value");

            Map<String, Object> attributes = new HashMap<>();
            attributes.put("bggId", id);
            if (yearPublished != null) {
                attributes.put("yearPublished", yearPublished);
            }

            candidates.add(new MetadataCandidate("BGG", id, title, null, attributes));
        }
        return candidates;
    }

    private String extractPrimaryName(Element item) {
        NodeList names = item.getElementsByTagName("name");
        for (int i = 0; i < names.getLength(); i++) {
            Element name = (Element) names.item(i);
            if ("primary".equals(name.getAttribute("type"))) {
                return name.getAttribute("value");
            }
        }
        return names.getLength() > 0 ? ((Element) names.item(0)).getAttribute("value") : "Titre inconnu";
    }

    private String extractAttribute(Element parent, String tagName, String attributeName) {
        NodeList nodes = parent.getElementsByTagName(tagName);
        if (nodes.getLength() == 0) {
            return null;
        }
        Node node = nodes.item(0);
        if (node instanceof Element element) {
            String value = element.getAttribute(attributeName);
            return value.isEmpty() ? null : value;
        }
        return null;
    }
}
