package com.iozycore.core.listing.vinted;

import com.fasterxml.jackson.databind.JsonNode;
import com.iozycore.core.listing.ShippingEstimateKind;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads an already downloaded Vinted listing page. <b>Pure function, without
 * network</b>: this is what makes it possible to test it on saved page
 * excerpts, without depending on live Vinted or on a listing that will still exist
 * tomorrow.
 *
 * <h2>What Vinted really publishes (observed on 2026-08-21)</h2>
 * Two layers of very different reliability, and the code treats them as
 * such:
 * <ol>
 *   <li><b>OpenGraph</b> ({@code og:title}, {@code og:description},
 *       {@code og:url}, {@code og:image}) - metadata that Vinted publishes
 *       <i>to be read by others</i> (sharing previews). It is a stable
 *       contract, and it is the main source here.</li>
 *   <li><b>Data embedded by the Next.js rendering</b> - the price and the full
 *       list of photos exist nowhere else in the page. This
 *       is not a public contract: it is an implementation detail that can
 *       change at the next Vinted deployment. So they are read <i>as well as possible</i>,
 *       each extraction isolated, and their absence is a normal result - not
 *       an error.</li>
 * </ol>
 * There is <b>no</b> JSON-LD or microdata on these pages (checked),
 * which would have been the ideal source.
 *
 * <h2>What is not done</h2>
 * No call to the internal Vinted API: it requires a session and tokens
 * that would have to be worked around. No login, no cookie, no
 * browser impersonation - we only read what an anonymous visitor receives.
 */
final class VintedPageParser {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** {@code <meta property="og:title" content="..."/>}, whatever the order of the attributes. */
    private static final Pattern OG_TAG = Pattern.compile(
            "<meta[^>]*property=\"og:(title|description|url|image)\"[^>]*content=\"([^\"]*)\"[^>]*>",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern OG_TAG_REVERSED = Pattern.compile(
            "<meta[^>]*content=\"([^\"]*)\"[^>]*property=\"og:(title|description|url|image)\"[^>]*>",
            Pattern.CASE_INSENSITIVE);

    /**
     * The price of the item, told apart from the other amounts of the page (shipping
     * fee, buyer protection) by the case of its currency key:
     * the item carries {@code currency_code} (API form), the fees carry
     * {@code currencyCode} (camelCase form of the rendering). A narrow and
     * verifiable discriminant, rather than "the first price found".
     */
    private static final Pattern ITEM_PRICE = Pattern.compile(
            "\\\\\"price\\\\\":\\{\\\\\"amount\\\\\":\\\\\"([0-9]+(?:\\.[0-9]+)?)\\\\\","
                    + "\\\\\"currency_code\\\\\":\\\\\"([A-Z]{3})\\\\\"");

    /**
     * Shipping fee. Discriminated by {@code shippingDetails}, its own block:
     * the amount alone would be indistinguishable from the price of the item or from
     * the buyer protection. The source announces here the CHEAPEST shipping mode
     * when several exist - so it is a "from".
     */
    private static final Pattern FRAIS_DE_PORT = Pattern.compile(
            "\\\\\"shippingDetails\\\\\":\\{[^}]{0,200}?\\\\\"price\\\\\":\\{\\\\\"amount\\\\\":"
                    + "\\\\\"([0-9]+(?:\\.[0-9]+)?)\\\\\"");

    /**
     * Several shipping modes exposed: the displayed amount is then the
     * cheapest, so a floor and not a rate.
     */
    private static final Pattern PLUSIEURS_MODES = Pattern.compile(
            "\\\\\"areMultipleShippingOptionsAvailable\\\\\":true");

    /** Shipping announced as free: a real zero, not a missing piece of data. */
    private static final Pattern PORT_GRATUIT = Pattern.compile(
            "\\\\\"shippingDetails\\\\\":\\{[^}]{0,200}?\\\\\"isFreeShipping\\\\\":true");

    /**
     * Buyer protection: {@code finalPrice}, never {@code originalPrice} -
     * a discount may apply, and it is the amount really charged that
     * enters the real cost.
     */
    private static final Pattern PROTECTION_ACHETEUR = Pattern.compile(
            "\\\\\"buyerProtection\\\\\":\\{.{0,220}?\\\\\"finalPrice\\\\\":\\{\\\\\"amount\\\\\":"
                    + "\\\\\"([0-9]+(?:\\.[0-9]+)?)\\\\\"");

    /** {@code "id":123456789} at the start of the item block. */
    private static final Pattern ITEM_ID = Pattern.compile("\\\\\"item\\\\\":\\{\\\\\"id\\\\\":([0-9]+)");

    /** The numeric identifier in a URL {@code /items/123456-a-slug}. */
    private static final Pattern URL_ITEM_ID = Pattern.compile("/items/([0-9]+)");

    /** Vinted adds a suffix to its sharing titles - "A title | Vinted" is not the title of the listing. */
    private static final Pattern OG_TITLE_SUFFIX = Pattern.compile("\\s*\\|\\s*Vinted\\s*$", Pattern.CASE_INSENSITIVE);

    private VintedPageParser() {
    }

    /** What the page delivered - each field independently absent or present. */
    record ParsedPage(String title, String description, BigDecimal price, String currency,
                       BigDecimal shippingFee, ShippingEstimateKind shippingKind, BigDecimal buyerProtectionFee,
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

        BigDecimal port = fraisDePort(html);
        return new ParsedPage(title, description, price, currency,
                port, natureDuPort(html, port), montant(PROTECTION_ACHETEUR, html), canonicalUrl,
                externalId(html, canonicalUrl, requestedUrl), images(html, maxImages));
    }

    /** Free first: without this test, a free shipping would pass for an unknown fee. */
    private static BigDecimal fraisDePort(String html) {
        if (PORT_GRATUIT.matcher(html).find()) {
            return BigDecimal.ZERO;
        }
        return montant(FRAIS_DE_PORT, html);
    }

    /**
     * What the shipping amount is really worth.
     * <p>
     * The order is deliberate: a free shipping is free, whatever
     * the available modes. Only then do we look at whether there are several
     * options - in which case the page displays the cheapest, and the amount is
     * only a floor. An amount with no indication of multiple options is treated
     * as firm; no amount at all stays UNKNOWN, never zero.
     */
    private static ShippingEstimateKind natureDuPort(String html, BigDecimal montant) {
        if (PORT_GRATUIT.matcher(html).find()) {
            return ShippingEstimateKind.FREE;
        }
        if (montant == null) {
            return ShippingEstimateKind.UNKNOWN;
        }
        return PLUSIEURS_MODES.matcher(html).find() ? ShippingEstimateKind.FROM : ShippingEstimateKind.EXACT;
    }

    /** The first amount captured by this pattern, or null - never a default value. */
    private static BigDecimal montant(Pattern motif, String html) {
        Matcher m = motif.matcher(html);
        return m.find() ? new BigDecimal(m.group(1)) : null;
    }

    /**
     * The identifier of the listing, read in the embedded data if possible,
     * otherwise in the URL - two links to the same listing (with or without slug)
     * then give the same identifier.
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
     * The photos of the listing itself. The page contains many other images
     * (seller avatar, thumbnails of similar items, icons): so we do not
     * pick up all the image URLs, we isolate the {@code photos} array
     * of the item - recognizable by its entries carrying
     * {@code is_main} - then we parse it as JSON rather than with a regular
     * expression.
     * <p>
     * Capped at {@code maxImages}: a listing has no reason to provide
     * fifty, and we do not want an endless list.
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
     * Isolates a JSON array escaped in the HTML by counting the brackets, then
     * unescapes it. Counting the brackets rather than waiting for the first
     * {@code ]} is what allows handling nested objects (each photo
     * carries its own thumbnails).
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

    /** Empty if this array is not the one of the item photos (no {@code is_main}, or unreadable JSON). */
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

    /** The only entities that a {@code content} attribute can carry here. */
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
