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
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Récupère les catégories et mécaniques d'un jeu BGG précis via l'endpoint
 * /thing (contrairement à /search et /collection, qui ne les fournissent
 * pas - voir la limite documentée dans BggMetadataProvider). Utilisé
 * uniquement par la découverte (DiscoveryService), pas systématiquement à
 * chaque recherche, pour ne pas multiplier les appels réseau.
 */
@Component
public class BggThingFetcher {

    private static final Logger log = LoggerFactory.getLogger(BggThingFetcher.class);
    private static final String THING_URL = "https://boardgamegeek.com/xmlapi2/thing?id=%s";

    @Value("${bgg.application-token:}")
    private String applicationToken;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    /** Catégories + mécaniques combinées (la distinction n'a pas d'importance pour un calcul de similarité simple). */
    public Set<String> fetchCategoriesAndMechanics(String bggId) {
        try {
            HttpRequest request = BggAuthorization.applyToken(HttpRequest.newBuilder()
                            .uri(URI.create(THING_URL.formatted(bggId)))
                            .timeout(Duration.ofSeconds(8))
                            .GET(),
                    applicationToken).build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("BGG a répondu {} pour /thing?id={}", response.statusCode(), bggId);
                return Set.of();
            }

            return parse(response.body());
        } catch (Exception e) {
            log.warn("Échec de l'appel BGG /thing pour l'id {} : {}", bggId, e.getMessage());
            return Set.of();
        }
    }

    Set<String> parse(String xmlBody) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            Document document = factory.newDocumentBuilder()
                    .parse(new org.xml.sax.InputSource(new java.io.StringReader(xmlBody)));

            Set<String> result = new LinkedHashSet<>();
            NodeList links = document.getElementsByTagName("link");
            for (int i = 0; i < links.getLength(); i++) {
                Element link = (Element) links.item(i);
                String type = link.getAttribute("type");
                if ("boardgamecategory".equals(type) || "boardgamemechanic".equals(type)) {
                    String value = link.getAttribute("value");
                    if (!value.isBlank()) {
                        result.add(value);
                    }
                }
            }
            return result;
        } catch (Exception e) {
            log.warn("Réponse BGG /thing illisible : {}", e.getMessage());
            return Set.of();
        }
    }
}
