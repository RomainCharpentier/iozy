package com.iozycore.listing.vinted;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Lit une page d'annonce Vinted déjà téléchargée. <b>Fonction pure, sans
 * réseau</b> : c'est ce qui permet de la tester sur des extraits de page
 * enregistrés, sans dépendre de Vinted en direct ni d'une annonce qui existera
 * encore demain.
 *
 * <h2>Ce que Vinted publie réellement (constaté le 2026-08-21)</h2>
 * Deux couches de fiabilité très différentes, et le code les traite comme
 * telles :
 * <ol>
 *   <li><b>OpenGraph</b> ({@code og:title}, {@code og:description},
 *       {@code og:url}, {@code og:image}) - des métadonnées que Vinted publie
 *       <i>pour être lues par d'autres</i> (aperçus de partage). C'est un
 *       contrat stable, et c'est la source principale ici.</li>
 *   <li><b>Données embarquées par le rendu Next.js</b> - le prix et la liste
 *       complète des photos n'existent nulle part ailleurs dans la page. Ce
 *       n'est pas un contrat public : c'est un détail d'implémentation qui peut
 *       changer au prochain déploiement de Vinted. On les lit donc <i>au mieux</i>,
 *       chaque extraction isolée, et leur absence est un résultat normal - pas
 *       une erreur.</li>
 * </ol>
 * Il n'existe <b>pas</b> de JSON-LD ni de microdonnées sur ces pages (vérifié),
 * ce qui aurait été la source idéale.
 *
 * <h2>Ce qui n'est pas fait</h2>
 * Aucun appel à l'API interne de Vinted : elle exige une session et des jetons
 * qu'il faudrait contourner. Aucune connexion, aucun cookie, aucune
 * usurpation de navigateur - on ne lit que ce qu'un visiteur anonyme reçoit.
 */
final class VintedPageParser {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** {@code <meta property="og:title" content="..."/>}, quel que soit l'ordre des attributs. */
    private static final Pattern OG_TAG = Pattern.compile(
            "<meta[^>]*property=\"og:(title|description|url|image)\"[^>]*content=\"([^\"]*)\"[^>]*>",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern OG_TAG_REVERSED = Pattern.compile(
            "<meta[^>]*content=\"([^\"]*)\"[^>]*property=\"og:(title|description|url|image)\"[^>]*>",
            Pattern.CASE_INSENSITIVE);

    /**
     * Le prix de l'article, distingué des autres montants de la page (frais de
     * port, protection acheteur) par la casse de sa clé de devise :
     * l'article porte {@code currency_code} (forme API), les frais portent
     * {@code currencyCode} (forme camelCase du rendu). Discriminant étroit et
     * vérifiable, plutôt que « le premier prix trouvé ».
     */
    private static final Pattern ITEM_PRICE = Pattern.compile(
            "\\\\\"price\\\\\":\\{\\\\\"amount\\\\\":\\\\\"([0-9]+(?:\\.[0-9]+)?)\\\\\","
                    + "\\\\\"currency_code\\\\\":\\\\\"([A-Z]{3})\\\\\"");

    /**
     * Frais de port. Discriminé par {@code shippingDetails}, son propre bloc :
     * le montant seul serait indiscernable du prix de l'article ou de la
     * protection acheteur. La source annonce ici le mode de livraison le MOINS
     * cher quand plusieurs existent - c'est donc un « à partir de ».
     */
    private static final Pattern FRAIS_DE_PORT = Pattern.compile(
            "\\\\\"shippingDetails\\\\\":\\{[^}]{0,200}?\\\\\"price\\\\\":\\{\\\\\"amount\\\\\":"
                    + "\\\\\"([0-9]+(?:\\.[0-9]+)?)\\\\\"");

    /** Livraison annoncée gratuite : un vrai zéro, pas une absence de donnée. */
    private static final Pattern PORT_GRATUIT = Pattern.compile(
            "\\\\\"shippingDetails\\\\\":\\{[^}]{0,200}?\\\\\"isFreeShipping\\\\\":true");

    /**
     * Protection acheteur : {@code finalPrice}, jamais {@code originalPrice} -
     * une remise peut s'appliquer, et c'est le montant réellement facturé qui
     * entre dans le coût réel.
     */
    private static final Pattern PROTECTION_ACHETEUR = Pattern.compile(
            "\\\\\"buyerProtection\\\\\":\\{.{0,220}?\\\\\"finalPrice\\\\\":\\{\\\\\"amount\\\\\":"
                    + "\\\\\"([0-9]+(?:\\.[0-9]+)?)\\\\\"");

    /** {@code "id":123456789} au début du bloc de l'article. */
    private static final Pattern ITEM_ID = Pattern.compile("\\\\\"item\\\\\":\\{\\\\\"id\\\\\":([0-9]+)");

    /** L'identifiant numérique dans une URL {@code /items/123456-un-slug}. */
    private static final Pattern URL_ITEM_ID = Pattern.compile("/items/([0-9]+)");

    /** Vinted suffixe ses titres de partage - « Un titre | Vinted » n'est pas le titre de l'annonce. */
    private static final Pattern OG_TITLE_SUFFIX = Pattern.compile("\\s*\\|\\s*Vinted\\s*$", Pattern.CASE_INSENSITIVE);

    private VintedPageParser() {
    }

    /** Ce que la page a livré - chaque champ indépendamment absent ou présent. */
    record ParsedPage(String title, String description, BigDecimal price, String currency,
                       BigDecimal shippingFee, BigDecimal buyerProtectionFee,
                       String canonicalUrl, String externalId, List<String> imageUrls) {
    }

    static ParsedPage parse(String html, String requestedUrl, int maxImages) {
        String title = trimToNull(stripTitleSuffix(openGraph(html, "title")));
        String description = trimToNull(openGraph(html, "description"));
        String canonicalUrl = trimToNull(openGraph(html, "url"));

        BigDecimal price = null;
        String currency = null;
        Matcher priceMatcher = ITEM_PRICE.matcher(html);
        if (priceMatcher.find()) {
            price = new BigDecimal(priceMatcher.group(1));
            currency = priceMatcher.group(2);
        }

        return new ParsedPage(title, description, price, currency,
                fraisDePort(html), montant(PROTECTION_ACHETEUR, html), canonicalUrl,
                externalId(html, canonicalUrl, requestedUrl), images(html, maxImages));
    }

    /** Gratuit d'abord : sans ce test, une livraison offerte passerait pour un frais inconnu. */
    private static BigDecimal fraisDePort(String html) {
        if (PORT_GRATUIT.matcher(html).find()) {
            return BigDecimal.ZERO;
        }
        return montant(FRAIS_DE_PORT, html);
    }

    /** Le premier montant capturé par ce motif, ou null - jamais une valeur par défaut. */
    private static BigDecimal montant(Pattern motif, String html) {
        Matcher m = motif.matcher(html);
        return m.find() ? new BigDecimal(m.group(1)) : null;
    }

    /**
     * L'identifiant de l'annonce, lu dans les données embarquées si possible,
     * sinon dans l'URL - deux liens vers la même annonce (avec ou sans slug)
     * donnent alors le même identifiant.
     */
    private static String externalId(String html, String canonicalUrl, String requestedUrl) {
        Matcher fromPayload = ITEM_ID.matcher(html);
        if (fromPayload.find()) {
            return fromPayload.group(1);
        }
        for (String candidate : new String[] {canonicalUrl, requestedUrl}) {
            if (candidate == null) continue;
            Matcher fromUrl = URL_ITEM_ID.matcher(candidate);
            if (fromUrl.find()) {
                return fromUrl.group(1);
            }
        }
        return null;
    }

    /**
     * Les photos de l'annonce elle-même. La page contient bien d'autres images
     * (avatar du vendeur, vignettes d'articles similaires, icônes) : on ne
     * ramasse donc pas toutes les URL d'images, on isole le tableau
     * {@code photos} de l'article - reconnaissable à ses entrées portant
     * {@code is_main} - puis on le parse en JSON plutôt qu'à l'expression
     * régulière.
     * <p>
     * Plafonné à {@code maxImages} : une annonce n'a aucune raison d'en fournir
     * cinquante, et on ne veut pas d'une liste sans fin.
     */
    private static List<String> images(String html, int maxImages) {
        for (int from = html.indexOf("\\\"photos\\\":["); from >= 0;
             from = html.indexOf("\\\"photos\\\":[", from + 1)) {
            int arrayStart = html.indexOf('[', from);
            String array = extractJsonArray(html, arrayStart);
            if (array == null) {
                continue;
            }
            Optional<List<String>> urls = readPhotoUrls(array, maxImages);
            if (urls.isPresent()) {
                return urls.get();
            }
        }
        return List.of();
    }

    /**
     * Isole un tableau JSON échappé dans le HTML en comptant les crochets, puis
     * le déséchappe. Compter les crochets plutôt que d'attendre le premier
     * {@code ]} est ce qui permet de traiter des objets imbriqués (chaque photo
     * porte ses propres vignettes).
     */
    private static String extractJsonArray(String html, int start) {
        if (start < 0) {
            return null;
        }
        int depth = 0;
        for (int i = start; i < html.length(); i++) {
            char c = html.charAt(i);
            if (c == '[') {
                depth++;
            } else if (c == ']') {
                depth--;
                if (depth == 0) {
                    return html.substring(start, i + 1).replace("\\\"", "\"").replace("\\\\", "\\");
                }
            }
        }
        return null;
    }

    /** Vide si ce tableau n'est pas celui des photos de l'article (pas de {@code is_main}, ou JSON illisible). */
    private static Optional<List<String>> readPhotoUrls(String jsonArray, int maxImages) {
        try {
            JsonNode root = MAPPER.readTree(jsonArray);
            if (!root.isArray() || root.isEmpty() || !root.get(0).has("is_main")) {
                return Optional.empty();
            }
            List<String> urls = new ArrayList<>(new LinkedHashSet<>(collectUrls(root, maxImages)));
            return urls.isEmpty() ? Optional.empty() : Optional.of(urls);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private static List<String> collectUrls(JsonNode photos, int maxImages) {
        List<String> urls = new ArrayList<>();
        for (JsonNode photo : photos) {
            JsonNode url = photo.path("url");
            if (url.isTextual() && url.asText().startsWith("https://")) {
                urls.add(url.asText());
            }
            if (urls.size() >= maxImages) {
                break;
            }
        }
        return urls;
    }

    private static String openGraph(String html, String property) {
        Matcher direct = OG_TAG.matcher(html);
        while (direct.find()) {
            if (direct.group(1).equalsIgnoreCase(property)) {
                return unescapeHtml(direct.group(2));
            }
        }
        Matcher reversed = OG_TAG_REVERSED.matcher(html);
        while (reversed.find()) {
            if (reversed.group(2).equalsIgnoreCase(property)) {
                return unescapeHtml(reversed.group(1));
            }
        }
        return null;
    }

    /** Les seules entités qu'un attribut {@code content} peut porter ici. */
    private static String unescapeHtml(String value) {
        return value == null ? null : value
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&amp;", "&");
    }

    private static String stripTitleSuffix(String title) {
        return title == null ? null : OG_TITLE_SUFFIX.matcher(title).replaceFirst("");
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
