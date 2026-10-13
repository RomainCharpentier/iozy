package com.iozycore.boardgame.bgg;

import com.iozycore.core.metadata.SourceUnavailableException;
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
 * Fetches the list of "trending" board games right now on BGG
 * (/hot endpoint). BGG exposes no endpoint to search or browse by
 * category or mechanic in its public API (checked - neither in the docs,
 * nor in the BGG community forums themselves): the "hot" list is the
 * only reasonable starting point for discovery suggestions,
 * then refined by cross-checking categories through BggThingFetcher.
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

    /** @throws SourceUnavailableException when BGG did not answer - never an empty list in that case */
    public List<BggCollectionItem> fetchHotBoardGames() {
        try {
            HttpRequest request = BggAuthorization.applyToken(HttpRequest.newBuilder()
                            .uri(URI.create(HOT_URL))
                            .timeout(Duration.ofSeconds(8))
                            .GET(),
                    applicationToken).build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new SourceUnavailableException("BGG answered " + response.statusCode() + " for /hot");
            }

            return parse(response.body());
        } catch (SourceUnavailableException e) {
            throw e;
        } catch (Exception e) {
            throw new SourceUnavailableException("BGG /hot call failed: " + e.getMessage(), e);
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
            log.warn("Unreadable BGG /hot response: {}", e.getMessage());
            return List.of();
        }
    }
}
