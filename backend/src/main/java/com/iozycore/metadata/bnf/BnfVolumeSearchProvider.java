package com.iozycore.metadata.bnf;

import com.iozycore.domain.catalog.EntityType;
import com.iozycore.metadata.VolumeCandidate;
import com.iozycore.metadata.VolumeSearchProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.OptionalInt;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Recherche les tomes réels d'une série de manga via le catalogue SRU
 * (ouvert, sans clé ni quota) de la BnF (Bibliothèque nationale de France) -
 * le dépôt légal impose à tout éditeur français d'y déposer chaque
 * parution, ce qui en fait une couverture bien plus exhaustive que Google
 * Books sur les sorties françaises récentes ou d'éditeurs plus confidentiels.
 * <p>
 * Cas réel qui motive ce fournisseur (signalé et vérifié à la demande de
 * l'utilisateur, voir historique de la conversation) : "Dragon Ball Full
 * Color - L'enfance de Goku" (Glénat, à partir de mai 2024) est
 * INTROUVABLE sur Google Books quelle que soit la formulation essayée
 * (titre exact de l'éditeur y compris), mais ressort immédiatement sur la
 * BnF - avec numéro de tome (champ MARC 200$h), éditeur (214$c) et ISBN
 * (010$a) dans des champs STRUCTURÉS, contrairement à Google Books où le
 * numéro de tome doit être deviné par regex dans un titre libre.
 * <p>
 * Contrepartie assumée : la BnF ne fournit aucune jaquette (imageUrl
 * toujours null) - une notice bibliographique, pas un catalogue commercial.
 * Toujours cumulé aux résultats Google Books (jamais en repli
 * conditionnel) - MetadataSearchService dédoublonne ensuite par (édition,
 * tome), en préférant le résultat AVEC jaquette si les deux sources
 * trouvent le même tome.
 * <p>
 * Pas de notion de recherche "rapide"/"approfondie" ici (voir
 * GoogleBooksVolumeSearchProvider et son partage de quota) : une seule
 * requête libre (CQL) par recherche suffit à tout ramener d'un coup, sans
 * biais de popularité à contourner par mot-clé - searchAdditionalEditions
 * garde son comportement par défaut (vide), la relancer n'apporterait rien
 * de plus.
 */
@Component
public class BnfVolumeSearchProvider implements VolumeSearchProvider {

    private static final Logger log = LoggerFactory.getLogger(BnfVolumeSearchProvider.class);
    private static final String SEARCH_URL =
            "https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&maximumRecords=50&query=%s";

    // "T. 7", "7" - le champ MARC 200$h contient en général juste le
    // numéro, mais on reste tolérant sur un éventuel préfixe.
    private static final Pattern VOLUME_NUMBER = Pattern.compile("(\\d+)");

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    @Override
    public boolean supports(EntityType entityType) {
        return "MANGA".equals(entityType.code());
    }

    @Override
    public List<VolumeCandidate> searchVolumes(String seriesTitle, String author, List<String> excludedTitleFragments) {
        if (seriesTitle == null || seriesTitle.isBlank()) {
            return List.of();
        }
        String cql = buildQuery(seriesTitle, author);
        try {
            String encodedQuery = URLEncoder.encode(cql, StandardCharsets.UTF_8);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(SEARCH_URL.formatted(encodedQuery)))
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("La BnF a répondu {} pour la recherche de tomes '{}'", response.statusCode(), cql);
                return List.of();
            }

            return parse(response.body(), seriesTitle, excludedTitleFragments);
        } catch (Exception e) {
            // Best-effort par nature : une panne ne doit jamais bloquer la
            // recherche de tomes, Google Books reste dans tous les cas
            // interrogé séparément par MetadataSearchService.
            log.warn("Échec de la recherche de tomes BnF pour '{}' : {}", cql, e.getMessage());
            return List.of();
        }
    }

    private static String buildQuery(String seriesTitle, String author) {
        String query = "bib.title all \"" + seriesTitle.replace("\"", "") + "\"";
        if (author != null && !author.isBlank()) {
            query += " and bib.author all \"" + author.replace("\"", "") + "\"";
        }
        return query;
    }

    /** Miroir de {@link #searchVolumes} pour les tests - parse une seule
     * réponse XML déjà en mémoire. */
    List<VolumeCandidate> parse(String xml, String seriesTitle) throws Exception {
        return parse(xml, seriesTitle, List.of());
    }

    List<VolumeCandidate> parse(String xml, String seriesTitle, List<String> excludedTitleFragments) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        DocumentBuilder builder = factory.newDocumentBuilder();
        Document document = builder.parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));

        List<VolumeCandidate> candidates = new ArrayList<>();
        NodeList records = document.getElementsByTagName("mxc:record");
        for (int i = 0; i < records.getLength(); i++) {
            Element record = (Element) records.item(i);
            Element titleField = firstDatafield(record, "200");
            if (titleField == null) {
                continue;
            }

            String rawTitle = subfield(titleField, "a");
            if (rawTitle == null || rawTitle.isBlank()) {
                continue;
            }
            // Comparaison insensible à la casse (vérifié manuellement : la
            // BnF indexe parfois "Dragon ball" en minuscules selon la
            // notice) - le champ $a est déjà exactement le nom de la série,
            // pas de préfixe flou à deviner ici contrairement à Google
            // Books (voir matchSeriesPrefix).
            if (!rawTitle.trim().equalsIgnoreCase(seriesTitle.trim())) {
                continue;
            }

            // 200$h : numéro de tome, dans un champ MARC dédié - jamais une
            // fiche de "série" entière (sans tome précis), qui n'a rien à
            // proposer ici.
            OptionalInt volumeNumber = parseVolumeNumber(subfield(titleField, "h"));
            if (volumeNumber.isEmpty()) {
                continue;
            }

            String edition = editionName(titleField);
            String displayTitle = rawTitle + (edition.isBlank() ? "" : " " + edition) + " T" + volumeNumber.getAsInt();

            // Spin-off/side-story/suite CONNU(e) (voir RelatedSeriesService) -
            // même logique que GoogleBooksVolumeSearchProvider.
            if (matchesKnownRelatedSeries(displayTitle, excludedTitleFragments)) {
                continue;
            }

            String publisher = publisherFrom214(record);
            String finalEdition = !edition.isBlank() ? edition
                    : (publisher == null || publisher.isBlank() ? "Édition inconnue" : publisher);
            finalEdition = normalizeEditionWord(finalEdition);

            // Pas de jaquette dans le catalogue BnF (simple notice
            // bibliographique, pas un catalogue commercial, voir javadoc
            // de la classe).
            candidates.add(new VolumeCandidate(finalEdition, volumeNumber.getAsInt(), null, displayTitle));
        }
        return candidates;
    }

    /** 200$e (répétable - ex: "full color" ET "l'enfance de Goku" sur deux
     * subfields distincts pour la même notice) joints et capitalisés. */
    private static String editionName(Element titleField) {
        List<String> parts = subfields(titleField, "e");
        if (parts.isEmpty()) {
            return "";
        }
        return parts.stream()
                .map(BnfVolumeSearchProvider::capitalizeWords)
                .collect(Collectors.joining(" - "));
    }

    private static String publisherFrom214(Element record) {
        Element field214 = firstDatafield(record, "214");
        return field214 == null ? null : subfield(field214, "c");
    }

    private static OptionalInt parseVolumeNumber(String rawValue) {
        if (rawValue == null || rawValue.isBlank()) {
            return OptionalInt.empty();
        }
        Matcher matcher = VOLUME_NUMBER.matcher(rawValue);
        if (!matcher.find()) {
            return OptionalInt.empty();
        }
        try {
            return OptionalInt.of(Integer.parseInt(matcher.group(1)));
        } catch (NumberFormatException e) {
            return OptionalInt.empty();
        }
    }

    private static Element firstDatafield(Element record, String tag) {
        NodeList datafields = record.getElementsByTagName("mxc:datafield");
        for (int i = 0; i < datafields.getLength(); i++) {
            Element datafield = (Element) datafields.item(i);
            if (tag.equals(datafield.getAttribute("tag"))) {
                return datafield;
            }
        }
        return null;
    }

    private static String subfield(Element datafield, String code) {
        List<String> values = subfields(datafield, code);
        return values.isEmpty() ? null : values.get(0);
    }

    private static List<String> subfields(Element datafield, String code) {
        List<String> values = new ArrayList<>();
        NodeList subfields = datafield.getElementsByTagName("mxc:subfield");
        for (int i = 0; i < subfields.getLength(); i++) {
            Element subfield = (Element) subfields.item(i);
            if (code.equals(subfield.getAttribute("code"))) {
                values.add(subfield.getTextContent());
            }
        }
        return values;
    }

    /** Comparaison par mot entier (?U pour reconnaître les lettres accentuées
     * comme des caractères de mot, même piège que côté Google Books) - un
     * simple contains() ferait matcher un fragment générique/court à
     * l'intérieur d'un autre mot sans rapport. */
    private static boolean matchesKnownRelatedSeries(String title, List<String> excludedTitleFragments) {
        for (String fragment : excludedTitleFragments) {
            if (Pattern.compile("(?iU)\\b" + Pattern.quote(fragment) + "\\b").matcher(title).find()) {
                return true;
            }
        }
        return false;
    }

    /** "full color" -> "Full Color" - la BnF indexe les sous-titres de
     * collection tout en minuscules, contrairement au nom de l'éditeur
     * (déjà correctement casé) utilisé en repli. */
    private static String capitalizeWords(String text) {
        StringBuilder result = new StringBuilder();
        for (String word : text.trim().split("\\s+")) {
            if (word.isEmpty()) {
                continue;
            }
            if (result.length() > 0) {
                result.append(' ');
            }
            result.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1));
        }
        return result.toString();
    }

    // "Pika", "Pika Edition", "Pika édition" (vérifié manuellement sur
    // "Fairy Tail", voir historique) : la BnF indexe le même éditeur avec ou
    // sans le mot "édition"/"edition" accentué ou non selon la notice,
    // formant sinon plusieurs onglets d'édition distincts pour un seul
    // éditeur réel - même classe de problème que TRAILING_MANGA_SUFFIX côté
    // GoogleBooksVolumeSearchProvider. "s?" final (vérifié manuellement sur
    // "Blue Period", voir historique) : "Pika éditions" (pluriel) formait
    // encore un quatrième onglet distinct malgré ce premier assouplissement,
    // le \b final ne validant jamais une frontière de mot entre "n" et "s".
    private static final Pattern EDITION_WORD_VARIANT = Pattern.compile("(?U)\\b[EeÉé]ditions?\\b");

    private static String normalizeEditionWord(String text) {
        return EDITION_WORD_VARIANT.matcher(text).replaceAll("Édition");
    }
}
