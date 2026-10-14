package com.iozycore.boardgame.bgg;

import com.iozycore.core.metadata.SourceUnavailableException;
import com.iozycore.core.metadata.TtlCache;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
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
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Fetches one specific BGG game through the /thing endpoint: its cover,
 * players, playing time, designers, categories and mechanics. The search
 * endpoint gives none of these (see BggMetadataProvider).
 *
 * <p>Called for one game at a time, never for every search result: when a
 * game is added or its preview is opened (batch 160), and by Discover.
 *
 * <p>Answers are kept for a day. Opening the preview, then adding the game,
 * then reloading it costs one call, not three. Only answers are kept: a
 * silent BGG is asked again next time.
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

    private final TtlCache<String, BggThing> cache = new TtlCache<>(Duration.ofHours(24), 500);
    private final AtomicBoolean missingTokenLogged = new AtomicBoolean();

    /**
     * Categories + mechanics combined (the distinction does not matter for a simple similarity computation).
     *
     * @throws SourceUnavailableException when BGG did not answer - never an empty set in that case
     */
    public Set<String> fetchCategoriesAndMechanics(String bggId) {
        return fetchThing(bggId).categoriesAndMechanics();
    }

    /**
     * Everything /thing says about this game.
     *
     * @throws SourceUnavailableException when BGG did not answer
     */
    public BggThing fetchThing(String bggId) {
        Optional<BggThing> cached = cache.get(bggId);
        if (cached.isPresent()) {
            return cached.get();
        }
        if ((applicationToken == null || applicationToken.isBlank()) && missingTokenLogged.compareAndSet(false, true)) {
            log.warn("No bgg.application-token configured - unauthenticated BGG /thing calls, "
                    + "not compliant with BGG's current terms (see boardgamegeek.com/using_the_xml_api)");
        }
        try {
            HttpRequest request = BggAuthorization.applyToken(HttpRequest.newBuilder()
                            .uri(URI.create(THING_URL.formatted(bggId)))
                            .timeout(Duration.ofSeconds(8))
                            .GET(),
                    applicationToken).build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new SourceUnavailableException("BGG answered " + response.statusCode() + " for /thing?id=" + bggId);
            }

            BggThing thing = parseThing(response.body());
            cache.put(bggId, thing);
            return thing;
        } catch (SourceUnavailableException e) {
            throw e;
        } catch (Exception e) {
            throw new SourceUnavailableException("BGG /thing call failed for id " + bggId + ": " + e.getMessage(), e);
        }
    }

    Set<String> parse(String xmlBody) {
        return parseThing(xmlBody).categoriesAndMechanics();
    }

    /** An unreadable answer gives an empty game, not an error: BGG did answer. */
    BggThing parseThing(String xmlBody) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            Document document = factory.newDocumentBuilder()
                    .parse(new org.xml.sax.InputSource(new java.io.StringReader(xmlBody)));

            NodeList items = document.getElementsByTagName("item");
            if (items.getLength() == 0) {
                return emptyThing();
            }
            Element item = (Element) items.item(0);

            List<String> designers = new ArrayList<>();
            Set<String> categoriesAndMechanics = new LinkedHashSet<>();
            NodeList links = item.getElementsByTagName("link");
            for (int i = 0; i < links.getLength(); i++) {
                Element link = (Element) links.item(i);
                String type = link.getAttribute("type");
                String value = link.getAttribute("value").trim();
                if (value.isEmpty()) {
                    continue;
                }
                if ("boardgamecategory".equals(type) || "boardgamemechanic".equals(type)) {
                    categoriesAndMechanics.add(value);
                } else if ("boardgamedesigner".equals(type) && !"(Uncredited)".equals(value)) {
                    designers.add(value);
                }
            }

            return new BggThing(
                    childText(item, "image"),
                    childValue(item, "yearpublished"),
                    positiveNumber(childValue(item, "minplayers")),
                    positiveNumber(childValue(item, "maxplayers")),
                    positiveNumber(childValue(item, "playingtime")),
                    List.copyOf(designers),
                    categoriesAndMechanics);
        } catch (Exception e) {
            log.warn("Unreadable BGG /thing response: {}", e.getMessage());
            return emptyThing();
        }
    }

    private static BggThing emptyThing() {
        return new BggThing(null, null, null, null, null, List.of(), Set.of());
    }

    /** The text of a direct child, like {@code <image>url</image>}. */
    private static String childText(Element parent, String tagName) {
        Element child = directChild(parent, tagName);
        if (child == null) {
            return null;
        }
        String text = child.getTextContent().trim();
        return text.isEmpty() ? null : text;
    }

    /** The {@code value} attribute of a direct child, like {@code <minplayers value="2"/>}. */
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

    /** BGG writes "0" when nobody filled the field in: that is no answer. */
    private static Integer positiveNumber(String value) {
        if (value == null) {
            return null;
        }
        try {
            int number = Integer.parseInt(value);
            return number > 0 ? number : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
