package com.iozycore.manga.recognition;

import com.iozycore.core.listing.ListingProvider;
import com.iozycore.core.listing.ListingUrlGuard;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Downloads the photos to analyse - and nothing else.
 *
 * <h2>It is not an arbitrary URL downloader</h2>
 * This is the point of this whole file. An endpoint that accepts a URL and goes
 * to fetch it on the server side is an SSRF: we give it
 * {@code http://169.254.169.254/} and it brings back the credentials of the
 * machine. Three barriers, crossed in this order:
 * <ol>
 *   <li><b>Host whitelist</b>, assembled from what the
 *       {@link ListingProvider} objects declare in {@code allowedImageHosts()}. There
 *       is no global list, no wildcard, and a missing host
 *       is refused <b>before</b> any network call;</li>
 *   <li><b>{@link ListingUrlGuard}</b>, already written and already tested: HTTPS
 *       required, refusal of private, local and link-local addresses;</li>
 *   <li><b>Bounded reading</b>: size per image, cumulated size, number
 *       of images, timeout, and an observed image MIME type.</li>
 * </ol>
 *
 * <h2>No redirect</h2>
 * Unlike the page loader, this one follows <b>no</b>
 * redirect. An image CDN has no reason to issue any, and each hop
 * followed is a chance to leave the whitelist.
 *
 * <h2>Nothing is archived</h2>
 * The bytes live for the time of the analysis, in memory. IozyCore keeps
 * no copy of the photos of a listing - the platform stays the only
 * owner of its images.
 */
@Component
@Slf4j
public class RecognitionImageFetcher {

    // The limits are stated only once, in RecognitionImageLimits:
    // direct upload by the user applies them too, and two copies
    // would end up drifting apart.
    private static final int MAX_IMAGES = RecognitionImageLimits.MAX_IMAGES;
    private static final int MAX_BYTES_PER_IMAGE = RecognitionImageLimits.MAX_BYTES_PER_IMAGE;
    private static final int MAX_TOTAL_BYTES = RecognitionImageLimits.MAX_TOTAL_BYTES;

    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(10);
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);

    private static final Set<String> ACCEPTED_MEDIA_TYPES = RecognitionImageLimits.ACCEPTED_MEDIA_TYPES;

    private final HttpClient httpClient;
    private final Set<String> allowedImageHosts;

    public RecognitionImageFetcher(List<ListingProvider> providers) {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(CONNECT_TIMEOUT)
                // NEVER: no redirect followed, see the Javadoc of the class.
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        this.allowedImageHosts = collectHosts(providers);
    }

    private static Set<String> collectHosts(List<ListingProvider> providers) {
        Set<String> hosts = new LinkedHashSet<>();
        if (providers != null) {
            for (ListingProvider provider : providers) {
                Set<String> declares = provider.allowedImageHosts();
                if (declares != null) {
                    declares.stream()
                            .filter(host -> host != null && !host.isBlank())
                            .map(host -> host.trim().toLowerCase(Locale.ROOT))
                            .forEach(hosts::add);
                }
            }
        }
        return Set.copyOf(hosts);
    }

    /**
     * Reports what could be downloaded, silently for the rest: a photo
     * that is refused or unreadable is not an analysis error, it is one photo
     * less. The caller sees the difference in the number of images returned.
     */
    public List<RecognitionImage> fetch(List<String> imageUrls) {
        if (imageUrls == null || imageUrls.isEmpty()) {
            return List.of();
        }

        List<RecognitionImage> images = new ArrayList<>();
        int cumule = 0;
        int index = 0;

        for (String url : imageUrls) {
            if (images.size() >= MAX_IMAGES || cumule >= MAX_TOTAL_BYTES) {
                break;
            }
            int positionAffichee = index++;

            ListingUrlGuard.Result verdict = ListingUrlGuard.check(url, allowedImageHosts);
            if (!verdict.isAllowed()) {
                // We log the reason, never the full URL: it identifies
                // a precise listing, and these logs are not confidential.
                log.info("Photo refused before any network call ({})", verdict.rejection());
                continue;
            }

            RecognitionImage image = telecharger(verdict.uriIfAllowed().orElseThrow(), positionAffichee,
                    Math.min(MAX_BYTES_PER_IMAGE, MAX_TOTAL_BYTES - cumule));
            if (image != null) {
                images.add(image);
                cumule += image.bytes().length;
            }
        }
        return List.copyOf(images);
    }

    private RecognitionImage telecharger(URI uri, int index, int plafond) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(uri)
                    .timeout(REQUEST_TIMEOUT)
                    .header("Accept", "image/jpeg,image/png,image/webp")
                    .GET()
                    .build();

            HttpResponse<InputStream> response =
                    httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());

            if (response.statusCode() != 200) {
                log.info("Photo not fetched: status={}", response.statusCode());
                return null;
            }

            String mediaType = response.headers().firstValue("content-type")
                    .map(valeur -> valeur.split(";")[0].trim().toLowerCase(Locale.ROOT))
                    .orElse("");
            if (!ACCEPTED_MEDIA_TYPES.contains(mediaType)) {
                // A server that returns HTML or any binary on an image
                // URL must not see its bytes sent to an engine.
                log.info("Photo ignored: unexpected MIME type ({})", mediaType.isBlank() ? "absent" : mediaType);
                return null;
            }

            byte[] octets = lireBorne(response.body(), plafond);
            if (octets.length == 0) {
                return null;
            }
            return new RecognitionImage(index, uri.toString(), octets, mediaType);

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        } catch (Exception e) {
            // An unreachable photo is one photo less, never an exception
            // that would bubble up and break the analysis flow.
            log.info("Photo unreachable: {}", e.getClass().getSimpleName());
            return null;
        }
    }

    /** Bounded reading: we stop at the ceiling, we do not measure afterwards. */
    private static byte[] lireBorne(InputStream in, int plafond) throws Exception {
        try (InputStream stream = in; java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream()) {
            byte[] tampon = new byte[8192];
            int total = 0;
            int lus;
            while (total < plafond && (lus = stream.read(tampon)) != -1) {
                int garder = Math.min(lus, plafond - total);
                out.write(tampon, 0, garder);
                total += garder;
            }
            return out.toByteArray();
        }
    }

    /** The hosts really allowed - exposed so that tests can assert it. */
    public Set<String> allowedImageHosts() {
        return allowedImageHosts;
    }
}
