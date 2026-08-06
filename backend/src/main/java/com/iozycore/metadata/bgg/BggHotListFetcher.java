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
import java.util.ArrayList;
import java.util.List;

/**
 * Récupère la liste des jeux de société "tendance" du moment sur BGG
 * (endpoint /hot). BGG n'expose aucun endpoint de recherche/parcours par
 * catégorie ou mécanique dans son API publique (vérifié - ni dans la doc,
 * ni via les forums communautaires BGG eux-mêmes) : la liste "hot" est le
 * seul point de départ raisonnable pour des suggestions de découverte,
 * ensuite affinées par recoupement de catégories via BggThingFetcher.
 */
@Component
public class BggHotListFetcher {

    private static final Logger log = LoggerFactory.getLogger(BggHotListFetcher.class);
    private static final String HOT_URL = "https://boardgamegeek.com/xmlapi2/hot?type=boardgame";

    @Value("${bgg.application-token:}")
    private String applicationToken;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    public List<BggCollectionItem> fetchHotBoardGames() {
        try {
            HttpRequest request = BggAuthorization.applyToken(HttpRequest.newBuilder()
                            .uri(URI.create(HOT_URL))
                            .timeout(Duration.ofSeconds(8))
                            .GET(),
                    applicationToken).build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("BGG a répondu {} pour /hot", response.statusCode());
                return List.of();
            }

            return parse(response.body());
        } catch (Exception e) {
            log.warn("Échec de l'appel BGG /hot : {}", e.getMessage());
            return List.of();
        }
    }

    List<BggCollectionItem> parse(String xmlBody) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            Document document = factory.newDocumentBuilder()
                    .parse(new org.xml.sax.InputSource(new java.io.StringReader(xmlBody)));

            NodeList items = document.getElementsByTagName("item");
            List<BggCollectionItem> result = new ArrayList<>();
            for (int i = 0; i < items.getLength(); i++) {
                Element item = (Element) items.item(i);
                String id = item.getAttribute("id");
                NodeList names = item.getElementsByTagName("name");
                String title = names.getLength() > 0 ? ((Element) names.item(0)).getAttribute("value") : null;
                if (title != null) {
                    result.add(new BggCollectionItem(id, title, null));
                }
            }
            return result;
        } catch (Exception e) {
            log.warn("Réponse BGG /hot illisible : {}", e.getMessage());
            return List.of();
        }
    }
}
