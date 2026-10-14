package com.iozycore.manga.metadata.openlibrary;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.metadata.SourceUnavailableException;
import com.iozycore.manga.metadata.VolumeCandidate;
import com.iozycore.manga.metadata.VolumeSearchProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.OptionalInt;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Third source of volumes: Open Library (openlibrary.org), open, with no
 * key or quota - already used by this repository for French titles and
 * barcodes, never for volumes.
 *
 * <h2>The case that gave birth to it</h2>
 * Reported by the user on 2026-09-04: "Doubt" (Yoshiki Tonogai)
 * exists in plain edition (4 volumes, Ki-oon, 2009-2010) AND in double edition
 * (2 volumes, Ki-oon, 2022). Measurement done on the three sources: the BnF has
 * only the plain one (the 22 records filed by this author were listed), and
 * Google Books returns NO volume of this series (its French records
 * have neither publisher nor number in the title). Open Library, for its part, has the two
 * volumes of the double one - with cover and ISBN.
 *
 * <h2>What it knows, and what it does not know</h2>
 * Open Library catalogs works, not series: the volume number is
 * read in the title ("Doubt - Tome 1"), like at Google Books, never
 * in a dedicated field like at the BnF. It also has no notion
 * of edition: the publisher stands in for it, and it is the ISBN that then tells apart
 * two homonym editions (see
 * {@code TomeSearchService.separerLesEditionsHomonymes}).
 *
 * <p>Last ({@code @Order(3)}): the BnF has structured fields, Google
 * Books commercial covers; this one fills what is missing from both.
 */
@Component
@Order(3)
@Slf4j
public class OpenLibraryVolumeSearchProvider implements VolumeSearchProvider {

    private static final String SEARCH_URL = "https://openlibrary.org/search.json?q=%s&limit=60"
            + "&fields=title,author_name,publisher,first_publish_year,isbn,cover_i";
    private static final String COVER_URL = "https://covers.openlibrary.org/b/id/%s-M.jpg";

    /** "Doubt - Tome 1", "Naruto, tome 5", "Vol. 12", "T.3" - same family as Google Books. */
    private static final Pattern VOLUME_NUMBER = Pattern.compile("(?i)\\b(?:tome|vol\\.?|t\\.?)\\s*0*(\\d+)");

    /**
     * Open Library describes WORKS, not copies: the same document
     * carries the list of ALL the publishers and ALL the ISBNs of its
     * editions, without matching them. "Jujutsu Kaisen, Vol. 7" has Viz Media
     * as first publisher and a 978-2 ISBN (the one of Ki-oon) in the list:
     * the filter by ISBN let through a "Viz Media edition" of two
     * volumes (measured on 2026-09-05). A title with "Vol." is the
     * English-language convention; the publishers below do not publish in French.
     */
    private static final Pattern TITRE_ANGLOPHONE = Pattern.compile("(?i)\\bvol\\.?\\s*\\d");
    private static final List<String> EDITEURS_ANGLOPHONES = List.of(
            "viz", "yen press", "kodansha", "dark horse", "seven seas", "square enix manga", "tokyopop", "vertical");
    private static final int VOLUME_NUMBER_MAX = 999;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public boolean supports(EntityType entityType) {
        return "MANGA".equals(entityType.code());
    }

    @Override
    public List<VolumeCandidate> searchVolumes(String seriesTitle, String author, List<String> excludedTitleFragments) {
        if (seriesTitle == null || seriesTitle.isBlank()) {
            return List.of();
        }
        // The author IN the request, unlike Google Books: Open
        // Library indexes few French mangas, a short and common title
        // ("Doubt") otherwise brings back mostly English-language essays.
        String requete = seriesTitle + (author == null || author.isBlank() ? "" : " " + author);
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(SEARCH_URL.formatted(URLEncoder.encode(requete, StandardCharsets.UTF_8))))
                    .timeout(Duration.ofSeconds(15))
                    .header("User-Agent", "IozyCore (auto-hebergement personnel)")
                    .GET()
                    .build();
            HttpResponse<String> response = envoyerAvecUneReprise(request);
            if (response.statusCode() != 200) {
                log.warn("Open Library answered {} for the volume search '{}'", response.statusCode(), requete);
                throw new SourceUnavailableException("Open Library a répondu " + response.statusCode());
            }
            return parse(response.body(), seriesTitle);
        } catch (SourceUnavailableException e) {
            throw e;
        } catch (Exception e) {
            // A source that does not answer has said nothing (Batch 126): reported
            // as such, otherwise its silence passed for "no volume" and the
            // result without it was frozen in cache as complete - seen
            // on "Doubt", whose double edition disappeared from a row written
            // during a connection timeout of a few seconds.
            log.warn("Open Library volume search failed for '{}': {}", requete, e.getMessage());
            throw new SourceUnavailableException("Open Library n'a pas répondu : " + e.getMessage());
        }
    }

    /**
     * Open Library answers from Windows in under a second, and from
     * the container it falls from time to time into a CONNECTION timeout (seen
     * three times in a row on 2026-09-04, same request, same minute). A
     * second attempt after a short pause is usually enough; otherwise the
     * source is reported silent, never empty.
     */
    private HttpResponse<String> envoyerAvecUneReprise(HttpRequest request) throws Exception {
        try {
            return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (java.io.IOException premierEchec) {
            Thread.sleep(800);
            return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        }
    }

    /** Package-private for the tests: an answer already in memory, without HTTP. */
    List<VolumeCandidate> parse(String body, String seriesTitle) throws Exception {
        List<VolumeCandidate> candidates = new ArrayList<>();
        String serieNormalisee = normaliser(seriesTitle);
        for (JsonNode doc : objectMapper.readTree(body).path("docs")) {
            String titre = doc.path("title").asText(null);
            if (titre == null || titre.isBlank()) {
                continue;
            }
            // The title must START with that of the series: "Doubt - Tome 1"
            // yes, "The Doubt Factory" no. Same requirement as the prefix
            // checked on the Google Books side.
            String titreNormalise = normaliser(titre);
            if (!titreNormalise.startsWith(serieNormalisee)) {
                continue;
            }
            OptionalInt numero = numeroDe(titre);
            if (numero.isEmpty()) {
                continue;
            }
            if (TITRE_ANGLOPHONE.matcher(titre).find()) {
                continue;
            }
            String editeur = premier(doc.path("publisher"));
            if (editeur != null && estAnglophone(editeur)) {
                continue;
            }
            if (editeur == null || editeur.isBlank()) {
                // Without a publisher, impossible to name the edition - and one more
                // "Édition inconnue" would help nobody here, the
                // BnF and Google Books already covering this case.
                continue;
            }
            // Open Library is mostly English-language: without a guard, the
            // Yen Press volumes of the same series invite themselves as a French
            // edition (seen on "Doubt"). The filter is the ISBN
            // itself: 978-2 and 979-10 are the French-language
            // registration groups. A record without ISBN is dropped - it
            // could not be attached to any edition anyway (see
            // TomeSearchService.separerLesEditionsHomonymes).
            String isbn = premier(doc.path("isbn"));
            if (!estIsbnFrancophone(isbn)) {
                continue;
            }
            String coverId = doc.path("cover_i").isNumber() ? doc.path("cover_i").asText() : null;
            Integer annee = doc.path("first_publish_year").isNumber() ? doc.path("first_publish_year").asInt() : null;
            candidates.add(new VolumeCandidate(
                    editeur.trim(),
                    numero.getAsInt(),
                    coverId == null ? null : COVER_URL.formatted(coverId),
                    titre,
                    isbn,
                    annee,
                    annee == null ? null : String.valueOf(annee)));
        }
        return candidates;
    }

    /** 978-2 and 979-10: the French-language ISBN registration groups. */
    static boolean estAnglophone(String editeur) {
        String e = editeur.toLowerCase(Locale.ROOT);
        return EDITEURS_ANGLOPHONES.stream().anyMatch(e::contains);
    }

    static boolean estIsbnFrancophone(String isbn) {
        if (isbn == null) {
            return false;
        }
        String chiffres = isbn.replaceAll("[^0-9Xx]", "");
        return chiffres.startsWith("9782") || chiffres.startsWith("97910");
    }

    private static OptionalInt numeroDe(String titre) {
        Matcher matcher = VOLUME_NUMBER.matcher(titre);
        if (!matcher.find()) {
            return OptionalInt.empty();
        }
        try {
            int numero = Integer.parseInt(matcher.group(1));
            return numero >= 1 && numero <= VOLUME_NUMBER_MAX ? OptionalInt.of(numero) : OptionalInt.empty();
        } catch (NumberFormatException e) {
            return OptionalInt.empty();
        }
    }

    private static String premier(JsonNode tableau) {
        return tableau.isArray() && !tableau.isEmpty() ? tableau.get(0).asText(null) : null;
    }

    /** Case, accents and punctuation folded - same rule as the title comparison of the BnF. */
    private static String normaliser(String texte) {
        return java.text.Normalizer.normalize(texte, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "");
    }
}
