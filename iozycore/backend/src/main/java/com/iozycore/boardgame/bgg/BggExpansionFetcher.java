package com.iozycore.boardgame.bgg;

import com.iozycore.boardgame.expansion.BoardGameExpansion;
import com.iozycore.boardgame.expansion.ExpansionSource;
import com.iozycore.core.metadata.SourceUnavailableException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The expansions of a base game on BoardGameGeek, with their covers.
 *
 * <p>The /thing answer of a base game links its expansions
 * ({@code <link type="boardgameexpansion" id=".." value=".."/>}); the same
 * link with {@code inbound="true"} points the other way (an expansion to its
 * base game) and is left out. The covers need a second read: /thing takes
 * several ids at once ({@value #IDS_PER_CALL} here), so a game with 30
 * expansions costs three calls, with a pause between two.
 *
 * <p>Only called by the background job ({@code BoardGameExpansionBackfill}),
 * never while a page is read.
 */
@Component
public class BggExpansionFetcher implements ExpansionSource {

    private static final String THING_URL = "https://boardgamegeek.com/xmlapi2/thing?id=%s";
    static final int IDS_PER_CALL = 20;
    /** A game with more expansions keeps the first ones: promos and fan packs pile up on BGG. */
    static final int MAX_EXPANSIONS = 100;

    @Value("${bgg.application-token:}")
    private String applicationToken;

    @Value("${iozycore.board-game-expansions.backfill.pause-ms:2000}")
    private long pauseMs;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    @Override
    public List<BoardGameExpansion> expansionsOf(String baseBggId) {
        List<BoardGameExpansion> links = parseLinks(get(baseBggId));
        if (links.isEmpty()) {
            return List.of();
        }
        List<BoardGameExpansion> kept = links.subList(0, Math.min(links.size(), MAX_EXPANSIONS));
        Map<String, Cover> covers = new HashMap<>();
        for (int start = 0; start < kept.size(); start += IDS_PER_CALL) {
            pause();
            List<String> ids = kept.subList(start, Math.min(kept.size(), start + IDS_PER_CALL)).stream()
                    .map(BoardGameExpansion::bggId).toList();
            covers.putAll(parseCovers(get(String.join(",", ids))));
        }
        return kept.stream()
                .map(link -> {
                    Cover cover = covers.get(link.bggId());
                    return cover == null ? link
                            : new BoardGameExpansion(link.bggId(), link.name(), cover.imageUrl(), cover.year());
                })
                .toList();
    }

    private String get(String ids) {
        try {
            HttpRequest request = BggAuthorization.applyToken(HttpRequest.newBuilder()
                            .uri(URI.create(THING_URL.formatted(ids)))
                            .timeout(Duration.ofSeconds(10))
                            .GET(),
                    applicationToken).build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new SourceUnavailableException("BGG answered " + response.statusCode() + " for /thing?id=" + ids);
            }
            return response.body();
        } catch (SourceUnavailableException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new SourceUnavailableException("BGG /thing call interrupted for id " + ids, e);
        } catch (Exception e) {
            throw new SourceUnavailableException("BGG /thing call failed for id " + ids + ": " + e.getMessage(), e);
        }
    }

    /**
     * The expansions linked from a base game, in BGG order, without the inbound links.
     *
     * <p>Only a well-formed {@code <items>} answer is an answer. An empty
     * {@code <items/>} means BGG knows no game with that id: no expansions,
     * stored as such. Anything else (not XML, an {@code <error>} body, a page
     * of HTML) is a provider that did not really answer: it throws, and
     * nothing is stored.
     *
     * @throws SourceUnavailableException the answer is not a BGG list of items
     */
    static List<BoardGameExpansion> parseLinks(String xmlBody) {
        Element item = firstItem(items(xmlBody));
        if (item == null) {
            return List.of();
        }
        Map<String, BoardGameExpansion> byId = new LinkedHashMap<>();
        NodeList links = item.getElementsByTagName("link");
        for (int i = 0; i < links.getLength(); i++) {
            Element link = (Element) links.item(i);
            if (!"boardgameexpansion".equals(link.getAttribute("type"))
                    || "true".equalsIgnoreCase(link.getAttribute("inbound"))) {
                continue;
            }
            String id = link.getAttribute("id").trim();
            String name = link.getAttribute("value").trim();
            if (!id.isEmpty() && !name.isEmpty()) {
                byId.putIfAbsent(id, new BoardGameExpansion(id, name, null, null));
            }
        }
        return List.copyOf(byId.values());
    }

    record Cover(String imageUrl, String year) {
    }

    /** The cover and year of each item of a /thing answer that holds several ids. */
    static Map<String, Cover> parseCovers(String xmlBody) {
        Document document = items(xmlBody);
        Map<String, Cover> covers = new HashMap<>();
        NodeList items = document.getElementsByTagName("item");
        for (int i = 0; i < items.getLength(); i++) {
            Element item = (Element) items.item(i);
            String id = item.getAttribute("id").trim();
            if (!id.isEmpty()) {
                covers.put(id, new Cover(childText(item, "image"), positiveYear(childValue(item, "yearpublished"))));
            }
        }
        return covers;
    }

    /** A /thing answer whose root is {@code <items>}; anything else is no answer. */
    private static Document items(String xmlBody) {
        Document document;
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            document = factory.newDocumentBuilder().parse(new org.xml.sax.InputSource(new StringReader(xmlBody)));
        } catch (Exception e) {
            throw new SourceUnavailableException("Unreadable BGG /thing response: " + e.getMessage(), e);
        }
        String root = document.getDocumentElement().getTagName();
        if (!"items".equals(root)) {
            throw new SourceUnavailableException("BGG /thing answered <" + root + "> instead of <items>");
        }
        return document;
    }

    private static Element firstItem(Document document) {
        NodeList items = document.getElementsByTagName("item");
        return items.getLength() == 0 ? null : (Element) items.item(0);
    }

    private static String childText(Element parent, String tagName) {
        Element child = directChild(parent, tagName);
        if (child == null) {
            return null;
        }
        String text = child.getTextContent().trim();
        return text.isEmpty() ? null : text;
    }

    private static String childValue(Element parent, String tagName) {
        Element child = directChild(parent, tagName);
        if (child == null) {
            return null;
        }
        String value = child.getAttribute("value").trim();
        return value.isEmpty() ? null : value;
    }

    private static Element directChild(Element parent, String tagName) {
        for (Node node = parent.getFirstChild(); node != null; node = node.getNextSibling()) {
            if (node instanceof Element element && tagName.equals(element.getTagName())) {
                return element;
            }
        }
        return null;
    }

    /** BGG writes "0" when nobody filled the year in. */
    private static String positiveYear(String value) {
        return value == null || "0".equals(value) ? null : value;
    }

    private void pause() {
        if (pauseMs <= 0) {
            return;
        }
        try {
            Thread.sleep(pauseMs);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
