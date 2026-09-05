package com.iozycore.boardgame.bgg;

import com.iozycore.domain.catalog.EntityType;
import com.iozycore.metadata.MetadataCandidate;
import com.iozycore.metadata.MetadataProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;

/**
 * Interroge l'API XML publique de BoardGameGeek. Couvre le type BOARD_GAME
 * uniquement.
 * <p>
 * BGG exige depuis juillet 2025 un enregistrement d'application et un token
 * Bearer pour la quasi-totalité de son API (voir BggAuthorization) - le
 * token est configurable via bgg.application-token (BGG_APPLICATION_TOKEN),
 * optionnel pour ne pas bloquer le développement local, mais son absence
 * est loggée en avertissement.
 * <p>
 * Limite assumée : l'endpoint de recherche ne renvoie pas d'image ni de
 * nombre de joueurs/durée - seuls id/titre/année sont disponibles à ce
 * stade. Récupérer le reste nécessiterait un second appel par résultat
 * vers /xmlapi2/thing?id=... (voir BggThingFetcher, utilisé par la
 * découverte plutôt que systématiquement ici pour ne pas multiplier les
 * appels réseau sur une simple recherche).
 */
@Component
public class BggMetadataProvider implements MetadataProvider {

    private static final Logger log = LoggerFactory.getLogger(BggMetadataProvider.class);
    private static final String SEARCH_URL = "https://boardgamegeek.com/xmlapi2/search?query=%s&type=boardgame";

    @Value("${bgg.application-token:}")
    private String applicationToken;

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
                log.warn("Aucun bgg.application-token configuré - appel BGG non authentifié, "
                        + "non conforme aux conditions actuelles de BGG (voir boardgamegeek.com/using_the_xml_api)");
            }
            String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);
            HttpRequest request = BggAuthorization.applyToken(HttpRequest.newBuilder()
                            .uri(URI.create(SEARCH_URL.formatted(encodedQuery)))
                            .timeout(Duration.ofSeconds(8))
                            .GET(),
                    applicationToken).build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("BGG a répondu {} pour la requête '{}'", response.statusCode(), query);
                return List.of();
            }

            return classerParPertinence(parse(response.body()), query);
        } catch (Exception e) {
            log.warn("Échec de l'appel à BGG pour '{}' : {}", query, e.getMessage());
            return List.of();
        }
    }

    /**
     * Nombre de résultats rendus à l'écran de recherche - même plafond que le
     * fournisseur manga, qui le demande directement à Jikan ({@code limit=10}).
     * BGG, lui, rend TOUT : « Carcassonne » ramène 144 lignes.
     */
    private static final int MAX_RESULTATS = 10;

    /**
     * Classe les résultats de BGG par pertinence, et n'en garde que les
     * premiers.
     *
     * <h2>Pourquoi c'est nécessaire</h2>
     * L'API de BGG rend ses correspondances dans SON ordre - alphabétique - et
     * sans limite. Chercher « Carcassonne » donnait 144 lignes ouvertes par
     * treize extensions amateurs (« Am Pranger », « Angler & Fischfarm »…), le
     * jeu lui-même arrivant en quatorzième position. Le titre exact que l'on
     * vient de taper doit être le premier résultat.
     *
     * <p>Quatre rangs seulement, et l'ordre de BGG conservé à l'intérieur de
     * chacun : titre exact, puis titre qui COMMENCE par la recherche, puis
     * titre qui la contient, puis le reste. Pas de score continu - il serait
     * plus difficile à expliquer qu'à calculer, et rien ici ne le demande.
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

    /** Minuscules sans accent : « Baum fällt » et « baum fallt » désignent le
     *  même jeu, et l'utilisateur tape rarement les diacritiques. */
    private static String normaliser(String valeur) {
        return Normalizer.normalize(valeur == null ? "" : valeur, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .trim()
                .toLowerCase(Locale.ROOT);
    }

    List<MetadataCandidate> parse(String xmlBody) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true); // prévention XXE
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
