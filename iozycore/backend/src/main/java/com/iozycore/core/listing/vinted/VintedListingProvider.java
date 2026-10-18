package com.iozycore.core.listing.vinted;

import com.iozycore.core.listing.ListingHttpFetcher;
import com.iozycore.core.listing.ListingProvider;
import com.iozycore.core.listing.ListingResolution;
import com.iozycore.core.listing.ListingSnapshot;
import com.iozycore.core.listing.ListingSnapshot.ListingField;
import com.iozycore.core.listing.ListingPlatform;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Reads a public Vinted listing to pre-fill an analysis draft.
 *
 * <h2>What Vinted allows, observed on 2026-08-21</h2>
 * A listing page {@code /items/<id>} answers 200 to a simple anonymous
 * request, without login or cookie, and publishes <b>OpenGraph</b> tags
 * (title, description, canonical URL, main photo) - metadata
 * meant to be read by others. The {@code robots.txt} of the site does not
 * forbid {@code /items} to generic agents.
 * <p>
 * The <b>price</b> and the <b>full list of photos</b>, however, are not in
 * any published structured data: they only live in the content
 * embedded by the page rendering. They are read as well as possible (see
 * {@link VintedPageParser}) knowing that Vinted can change their shape without
 * notice - their absence then degrades the result to {@code PARTIAL}, it does not
 * make it fail.
 *
 * <h2>What Vinted prevents, and what we do not work around</h2>
 * The internal API of the site requires a session and tokens; using it
 * would mean reproducing an authentication mechanism. This is not done,
 * and must not be: no login, no account cookie, no
 * browser impersonation, no workaround of the anti-robot protection. The
 * request honestly announces IozyCore and is only triggered by a
 * user who has just pasted this exact link.
 *
 * <h2>What is not retrieved, on purpose</h2>
 * Nothing about the seller (nickname, avatar, location): this data does not enter
 * any verdict computation and so does not have to be read or kept.
 */
@Component
@RequiredArgsConstructor
public class VintedListingProvider implements ListingProvider {

    /**
     * A listing does not need more to be recognized at a glance, and this
     * cap keeps the response, the display and the memory within
     * predictable limits.
     */
    static final int MAX_IMAGES = 12;

    /**
     * Strict whitelist, specific to this provider. Vinted operates one domain per
     * country; each one is named explicitly rather than deduced from a pattern
     * like "everything that contains vinted", which would accept
     * {@code vinted.attaquant.example}.
     */
    private static final Set<String> ALLOWED_HOSTS = buildAllowedHosts();

    private static Set<String> buildAllowedHosts() {
        List<String> domains = List.of(
                "vinted.fr", "vinted.be", "vinted.lu", "vinted.com", "vinted.co.uk", "vinted.de", "vinted.at",
                "vinted.es", "vinted.it", "vinted.nl", "vinted.pl", "vinted.cz", "vinted.sk", "vinted.lt",
                "vinted.pt", "vinted.se", "vinted.fi", "vinted.dk", "vinted.gr", "vinted.ro", "vinted.hu",
                "vinted.ie", "vinted.hr", "vinted.si");
        Set<String> hosts = new LinkedHashSet<>();
        for (String domain : domains) {
            hosts.add(domain);
            hosts.add("www." + domain);
        }
        return Set.copyOf(hosts);
    }

    private final ListingHttpFetcher fetcher;

    @Override
    public ListingPlatform platform() {
        return ListingPlatform.VINTED;
    }

    /**
     * The Vinted image CDN, listed host by host for the same reason as
     * the page domains: a pattern "everything ending with vinted.net"
     * would accept {@code vinted.net.attaquant.example}. The listing photos are
     * served there under {@code imagesN.vinted.net}.
     */
    private static final Set<String> ALLOWED_IMAGE_HOSTS = buildAllowedImageHosts();

    private static Set<String> buildAllowedImageHosts() {
        Set<String> hosts = new LinkedHashSet<>();
        for (int shard = 1; shard <= 12; shard++) {
            hosts.add("images" + shard + ".vinted.net");
        }
        return Set.copyOf(hosts);
    }

    @Override
    public Set<String> allowedHosts() {
        return ALLOWED_HOSTS;
    }

    @Override
    public Set<String> allowedImageHosts() {
        return ALLOWED_IMAGE_HOSTS;
    }

    /**
     * Source detection: only on the host, never on "the URL contains
     * vinted" - {@code https://phishing.example/vinted.fr} would not be a
     * Vinted listing.
     */
    @Override
    public boolean supports(String url) {
        try {
            URI uri = new URI(url.trim());
            String host = uri.getHost();
            return host != null && ALLOWED_HOSTS.contains(host.toLowerCase(Locale.ROOT));
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public ListingResolution resolve(String url) {
        ListingHttpFetcher.Fetched fetched = fetcher.fetchHtml(url, ALLOWED_HOSTS);
        if (!fetched.isSuccess()) {
            return switch (fetched.failure()) {
                case URL_REJECTED -> ListingResolution.failed(
                        ListingResolution.Status.INVALID_URL, ListingPlatform.VINTED, url);
                case NOT_FOUND -> ListingResolution.failed(
                        ListingResolution.Status.LISTING_NOT_FOUND, ListingPlatform.VINTED, url);
                case UNAVAILABLE -> ListingResolution.failed(
                        ListingResolution.Status.UNAVAILABLE, ListingPlatform.VINTED, url);
            };
        }

        VintedPageParser.ParsedPage page = VintedPageParser.parse(fetched.html(), url, MAX_IMAGES);

        List<ListingField> retrieved = new ArrayList<>();
        if (page.title() != null) retrieved.add(ListingField.TITLE);
        if (page.description() != null) retrieved.add(ListingField.DESCRIPTION);
        if (page.price() != null) retrieved.add(ListingField.PRICE);
        if (page.shippingFee() != null) retrieved.add(ListingField.SHIPPING_FEE);
        if (page.buyerProtectionFee() != null) retrieved.add(ListingField.BUYER_PROTECTION_FEE);
        if (!page.imageUrls().isEmpty()) retrieved.add(ListingField.IMAGES);

        ListingSnapshot snapshot = new ListingSnapshot(
                ListingPlatform.VINTED,
                // The canonical URL when the page gives it: two links to the same
                // listing (with or without slug, with tracking parameters) then
                // come down to the same address.
                page.canonicalUrl() != null ? page.canonicalUrl() : fetched.finalUri().toString(),
                page.externalId(), page.title(), page.description(), page.price(), page.currency(),
                page.shippingFee(), page.shippingKind(), page.buyerProtectionFee(),
                page.imageUrls(), Instant.now(), retrieved);

        if (snapshot.isEmpty()) {
            // The page did answer but delivered none of the expected fields:
            // for the user, it is indistinguishable from an unavailability, and
            // there is nothing to pre-fill.
            return ListingResolution.failed(ListingResolution.Status.UNAVAILABLE, ListingPlatform.VINTED, url);
        }
        return retrieved.size() == ListingField.values().length
                ? ListingResolution.success(snapshot)
                : ListingResolution.partial(snapshot);
    }
}
