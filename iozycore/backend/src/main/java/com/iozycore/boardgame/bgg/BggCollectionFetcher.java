package com.iozycore.boardgame.bgg;

import lombok.extern.slf4j.Slf4j;
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
 * <p>
 * Each item already carries its cover ({@code <image>}) and, with stats=1,
 * its players and playing time. They are read here so that an import of
 * hundreds of games does not make one /thing call per game. All of them are
 * optional: a game without them is imported anyway.
 */
@Component
@Slf4j
public class BggCollectionFetcher {

    private static final String COLLECTION_URL =
            "https://boardgamegeek.com/xmlapi2/collection?username=%s&own=1&stats=1";
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
        Document document;
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true); // XXE prevention
            document = factory.newDocumentBuilder()
                    .parse(new org.xml.sax.InputSource(new java.io.StringReader(xmlBody)));
        } catch (Exception e) {
            throw new BggCollectionUnavailableException("Réponse BGG illisible : " + e.getMessage());
        }
        // BGG answers 200 with <errors> for an unknown user: read as an
        // empty list, it became "0 found" instead of saying what happened.
        Element root = document.getDocumentElement();
        if ("errors".equals(root.getTagName()) || "error".equals(root.getTagName())) {
            String error = firstElementText(root, "message");
            if (error != null && error.toLowerCase(java.util.Locale.ROOT).contains("invalid username")) {
                throw new BggCollectionUnavailableException("Ce pseudo n'existe pas sur BoardGameGeek.");
            }
            throw new BggCollectionUnavailableException("BoardGameGeek a refusé la demande"
                    + (error != null ? " : " + error : "."));
        }
        try {
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
                    Element stats = firstElement(item, "stats");
                    result.add(new BggCollectionItem(objectId, title, year,
                            firstElementText(item, "image"),
                            stats == null ? null : positiveNumber(stats.getAttribute("minplayers")),
                            stats == null ? null : positiveNumber(stats.getAttribute("maxplayers")),
                            stats == null ? null : positiveNumber(stats.getAttribute("playingtime"))));
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

    private Element firstElement(Element parent, String tagName) {
        NodeList nodes = parent.getElementsByTagName(tagName);
        return nodes.getLength() == 0 ? null : (Element) nodes.item(0);
    }

    /** BGG writes "0" when nobody filled the field in: that is no answer. */
    private static Integer positiveNumber(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            int number = Integer.parseInt(value.trim());
            return number > 0 ? number : null;
        } catch (NumberFormatException e) {
            return null;
        }
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
