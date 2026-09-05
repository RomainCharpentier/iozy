package com.iozycore.manga.metadata.openlibrary;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.metadata.SourceUnavailableException;
import com.iozycore.manga.metadata.VolumeCandidate;
import com.iozycore.manga.metadata.VolumeSearchProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
 * Troisieme source de tomes : Open Library (openlibrary.org), ouverte, sans
 * cle ni quota - deja utilisee par ce depot pour les titres francais et les
 * codes-barres, jamais pour les tomes.
 *
 * <h2>Le cas qui l'a fait naitre</h2>
 * Signale par l'utilisateur le 2026-09-04 : « Doubt » (Yoshiki Tonogai)
 * existe en edition simple (4 tomes, Ki-oon, 2009-2010) ET en edition double
 * (2 tomes, Ki-oon, 2022). Mesure faite sur les trois sources : la BnF n'a
 * que la simple (les 22 notices deposees par cet auteur ont ete listees), et
 * Google Books ne rend AUCUN tome de cette serie (ses fiches francaises
 * n'ont ni editeur ni numero dans le titre). Open Library, elle, a les deux
 * tomes de la double - avec jaquette et ISBN.
 *
 * <h2>Ce qu'elle sait, et ce qu'elle ne sait pas</h2>
 * Open Library catalogue des ouvrages, pas des series : le numero de tome se
 * lit dans le titre (« Doubt - Tome 1 »), comme chez Google Books, jamais
 * dans un champ dedie comme a la BnF. Elle n'a pas non plus de notion
 * d'edition : l'editeur en tient lieu, et c'est l'ISBN qui distingue ensuite
 * deux editions homonymes (voir
 * {@code TomeSearchService.separerLesEditionsHomonymes}).
 *
 * <p>En dernier ({@code @Order(3)}) : la BnF a des champs structures, Google
 * Books des jaquettes commerciales ; celle-ci comble ce qui manque aux deux.
 */
@Component
@Order(3)
public class OpenLibraryVolumeSearchProvider implements VolumeSearchProvider {

    private static final Logger log = LoggerFactory.getLogger(OpenLibraryVolumeSearchProvider.class);

    private static final String SEARCH_URL = "https://openlibrary.org/search.json?q=%s&limit=60"
            + "&fields=title,author_name,publisher,first_publish_year,isbn,cover_i";
    private static final String COVER_URL = "https://covers.openlibrary.org/b/id/%s-M.jpg";

    /** « Doubt - Tome 1 », « Naruto, tome 5 », « Vol. 12 », « T.3 » - meme famille que Google Books. */
    private static final Pattern VOLUME_NUMBER = Pattern.compile("(?i)\\b(?:tome|vol\\.?|t\\.?)\\s*0*(\\d+)");

    /**
     * Open Library decrit des OEUVRES, pas des exemplaires : un meme document
     * porte la liste de TOUS les editeurs et de TOUS les ISBN de ses
     * editions, sans les apparier. « Jujutsu Kaisen, Vol. 7 » y a Viz Media
     * en premier editeur et un ISBN 978-2 (celui de Ki-oon) dans la liste :
     * le filtre par ISBN laissait passer une « edition Viz Media » de deux
     * tomes (mesure du 2026-09-05). Un titre en « Vol. » est la convention
     * anglophone ; les editeurs ci-dessous ne publient pas en francais.
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
        // L'auteur DANS la requete, contrairement a Google Books : Open
        // Library indexe peu de mangas francais, un titre court et courant
        // (« Doubt ») y ramene sinon surtout des essais anglophones.
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
                log.warn("Open Library a répondu {} pour la recherche de tomes '{}'", response.statusCode(), requete);
                throw new SourceUnavailableException("Open Library a répondu " + response.statusCode());
            }
            return parse(response.body(), seriesTitle);
        } catch (SourceUnavailableException e) {
            throw e;
        } catch (Exception e) {
            // Une source qui ne repond pas n'a rien DIT (Lot 126) : signalee
            // comme telle, sinon son silence passait pour « aucun tome » et le
            // resultat sans elle etait fige en cache comme complet - constate
            // sur « Doubt », dont l'edition double a disparu d'une ligne ecrite
            // pendant un delai de connexion de quelques secondes.
            log.warn("Échec de la recherche de tomes Open Library pour '{}' : {}", requete, e.getMessage());
            throw new SourceUnavailableException("Open Library n'a pas répondu : " + e.getMessage());
        }
    }

    /**
     * Open Library repond depuis Windows en moins d'une seconde, et depuis
     * le conteneur tombe par intermittence en delai de CONNEXION (constate
     * trois fois de suite le 2026-09-04, meme requete, meme minute). Une
     * seconde tentative apres une courte pause suffit en general ; sinon la
     * source est signalee muette, jamais vide.
     */
    private HttpResponse<String> envoyerAvecUneReprise(HttpRequest request) throws Exception {
        try {
            return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (java.io.IOException premierEchec) {
            Thread.sleep(800);
            return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        }
    }

    /** Paquet-prive pour les tests : une reponse deja en memoire, sans HTTP. */
    List<VolumeCandidate> parse(String body, String seriesTitle) throws Exception {
        List<VolumeCandidate> candidates = new ArrayList<>();
        String serieNormalisee = normaliser(seriesTitle);
        for (JsonNode doc : objectMapper.readTree(body).path("docs")) {
            String titre = doc.path("title").asText(null);
            if (titre == null || titre.isBlank()) {
                continue;
            }
            // Le titre doit COMMENCER par celui de la serie : « Doubt - Tome 1 »
            // oui, « The Doubt Factory » non. Meme exigence que le prefixe
            // verifie cote Google Books.
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
                // Sans editeur, impossible de nommer l'edition - et une
                // « Édition inconnue » de plus n'aiderait personne ici, la
                // BnF et Google Books couvrant deja ce cas.
                continue;
            }
            // Open Library est majoritairement anglophone : sans garde, les
            // tomes Yen Press de la meme serie s'invitent comme une edition
            // francaise (constate sur « Doubt »). Le filtre est l'ISBN
            // lui-meme : 978-2 et 979-10 sont les groupes d'enregistrement
            // de langue francaise. Une fiche sans ISBN est ecartee - elle ne
            // pourrait de toute facon etre rattachee a aucune edition (voir
            // TomeSearchService.separerLesEditionsHomonymes).
            String isbn = premier(doc.path("isbn"));
            if (!estIsbnFrancophone(isbn)) {
                continue;
            }
            String coverId = doc.path("cover_i").isNumber() ? doc.path("cover_i").asText() : null;
            candidates.add(new VolumeCandidate(
                    editeur.trim(),
                    numero.getAsInt(),
                    coverId == null ? null : COVER_URL.formatted(coverId),
                    titre,
                    isbn,
                    doc.path("first_publish_year").isNumber() ? doc.path("first_publish_year").asInt() : null));
        }
        return candidates;
    }

    /** 978-2 et 979-10 : les groupes d'enregistrement ISBN de langue francaise. */
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

    /** Casse, accents et ponctuation pliés - même règle que la comparaison de titres de la BnF. */
    private static String normaliser(String texte) {
        return java.text.Normalizer.normalize(texte, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "");
    }
}
