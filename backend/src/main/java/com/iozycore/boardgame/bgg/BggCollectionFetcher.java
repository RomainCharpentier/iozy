package com.iozycore.boardgame.bgg;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilderFactory;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * Queries the BGG public XML API for a user's collection
 * (/collection endpoint, different from /search used by BggMetadataProvider
 * - different XML format, hence a separate class instead of an artificial
 * sharing of code between the two).
 * <p>
 * Since July 2025, BGG requires an application registration and a
 * Bearer token for almost all of its API (see BggAuthorization) -
 * configurable with bgg.application-token (BGG_APPLICATION_TOKEN).
 * <p>
 * Particularity of this endpoint: BGG sometimes answers 202 (collection being
 * prepared on the server side) before answering 200 with the real
 * data - a retry with a short delay is the behaviour recommended
 * by BGG itself, not an error to handle as such.
 */
@Component
public class BggCollectionFetcher {

    private static final Logger log = LoggerFactory.getLogger(BggCollectionFetcher.class);
    private static final String COLLECTION_URL =
            "https://boardgamegeek.com/xmlapi2/collection?username=%s&own=1&stats=0";
    private static final int MAX_ATTEMPTS = 5;
    private static final Duration RETRY_DELAY = Duration.ofSeconds(2);

    @Value("${bgg.application-token:}")
    private String applicationToken;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    /** Thrown if BGG does not return the collection after several attempts, or if the username is invalid. */
    public static class BggCollectionUnavailableException extends RuntimeException {
        public BggCollectionUnavailableException(String message) {
            super(message);
        }
    }

    public List<BggCollectionItem> fetchOwnedGames(String username) {
        if (applicationToken == null || applicationToken.isBlank()) {
            log.warn("No bgg.application-token configured - unauthenticated BGG call, "
                    + "not compliant with BGG's current terms (see boardgamegeek.com/using_the_xml_api)");
        }
        String encodedUsername = URLEncoder.encode(username, StandardCharsets.UTF_8);
        HttpRequest request = BggAuthorization.applyToken(HttpRequest.newBuilder()
                        .uri(URI.create(COLLECTION_URL.formatted(encodedUsername)))
                        .timeout(Duration.ofSeconds(10))
                        .GET(),
                applicationToken).build();

        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

                if (response.statusCode() == 200) {
                    return parse(response.body());
                }
                if (response.statusCode() == 202) {
                    log.info("BGG is preparing the collection of '{}' (attempt {}/{}), retrying in {}s",
                            username, attempt, MAX_ATTEMPTS, RETRY_DELAY.toSeconds());
                    Thread.sleep(RETRY_DELAY.toMillis());
                    continue;
                }
                if (response.statusCode() == 404) {
                    throw new BggCollectionUnavailableException("Utilisateur BGG introuvable : " + username);
                }
                throw new BggCollectionUnavailableException(
                        "BGG a répondu " + response.statusCode() + " pour la collection de " + username);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new BggCollectionUnavailableException("Interrompu en attendant la réponse de BGG");
            } catch (java.io.IOException e) {
                throw new BggCollectionUnavailableException("Échec de connexion à BGG : " + e.getMessage());
            }
        }

        throw new BggCollectionUnavailableException(
                "BGG n'a pas fini de préparer la collection de '%s' après %d tentatives - réessaie dans quelques instants"
                        .formatted(username, MAX_ATTEMPTS));
    }

    List<BggCollectionItem> parse(String xmlBody) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true); // XXE prevention
            Document document = factory.newDocumentBuilder()
                    .parse(new org.xml.sax.InputSource(new java.io.StringReader(xmlBody)));

            NodeList items = document.getElementsByTagName("item");
            List<BggCollectionItem> result = new ArrayList<>();

            for (int i = 0; i < items.getLength(); i++) {
                Element item = (Element) items.item(i);
                if (!isOwned(item)) {
                    continue; // safety net: own=1 is already requested in the query
                }

                String objectId = item.getAttribute("objectid");
                String title = firstElementText(item, "name");
                String year = firstElementText(item, "yearpublished");

                if (title != null) {
                    result.add(new BggCollectionItem(objectId, title, year));
                }
            }
            return result;
        } catch (Exception e) {
            throw new BggCollectionUnavailableException("Réponse BGG illisible : " + e.getMessage());
        }
    }

    private boolean isOwned(Element item) {
        NodeList statusNodes = item.getElementsByTagName("status");
        if (statusNodes.getLength() == 0) {
            return false;
        }
        Element status = (Element) statusNodes.item(0);
        return "1".equals(status.getAttribute("own"));
    }

    private String firstElementText(Element parent, String tagName) {
        NodeList nodes = parent.getElementsByTagName(tagName);
        if (nodes.getLength() == 0) {
            return null;
        }
        String text = nodes.item(0).getTextContent();
        return (text == null || text.isBlank()) ? null : text.trim();
    }
}
