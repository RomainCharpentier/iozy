package com.iozycore.metadata.bgg;

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
 * Interroge l'API XML publique de BGG pour la collection d'un utilisateur
 * (endpoint /collection, différent de /search utilisé par BggMetadataProvider
 * - format XML différent, d'où une classe séparée plutôt qu'un partage
 * artificiel de code entre les deux).
 * <p>
 * BGG exige depuis juillet 2025 un enregistrement d'application et un token
 * Bearer pour la quasi-totalité de son API (voir BggAuthorization) -
 * configurable via bgg.application-token (BGG_APPLICATION_TOKEN).
 * <p>
 * Particularité de cet endpoint : BGG répond parfois 202 (collection en
 * cours de préparation côté serveur) avant de répondre 200 avec les vraies
 * données - un ré-essai avec un court délai est le comportement recommandé
 * par BGG lui-même, pas une erreur à traiter comme telle.
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

    /** Levée si BGG ne renvoie pas la collection après plusieurs tentatives, ou si le username est invalide. */
    public static class BggCollectionUnavailableException extends RuntimeException {
        public BggCollectionUnavailableException(String message) {
            super(message);
        }
    }

    public List<BggCollectionItem> fetchOwnedGames(String username) {
        if (applicationToken == null || applicationToken.isBlank()) {
            log.warn("Aucun bgg.application-token configuré - appel BGG non authentifié, "
                    + "non conforme aux conditions actuelles de BGG (voir boardgamegeek.com/using_the_xml_api)");
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
                    log.info("BGG prépare la collection de '{}' (tentative {}/{}), nouvel essai dans {}s",
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
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true); // prévention XXE
            Document document = factory.newDocumentBuilder()
                    .parse(new org.xml.sax.InputSource(new java.io.StringReader(xmlBody)));

            NodeList items = document.getElementsByTagName("item");
            List<BggCollectionItem> result = new ArrayList<>();

            for (int i = 0; i < items.getLength(); i++) {
                Element item = (Element) items.item(i);
                if (!isOwned(item)) {
                    continue; // filet de sécurité : own=1 est déjà demandé côté requête
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
