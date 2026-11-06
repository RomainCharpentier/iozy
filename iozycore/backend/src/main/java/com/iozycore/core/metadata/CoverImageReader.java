package com.iozycore.core.metadata;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/**
 * Reads a cover for the detail page, which needs its colors.
 * <p>
 * A browser can only read the pixels of an image its host allows, and BoardGameGeek
 * does not. Serving it from this origin lets the page read it.
 * <p>
 * Only the known cover hosts are reachable: a cover URL can be typed by hand, and
 * without this list the server would call any address for whoever asks, its own
 * network included. Redirects are not followed, for the same reason.
 */
@Component
@Slf4j
public class CoverImageReader {

    public record CoverImage(String contentType, byte[] bytes) {
    }

    private static final Set<String> COVER_HOSTS = Set.of(
            "cdn.myanimelist.net",
            "s4.anilist.co",
            "images.igdb.com",
            "cf.geekdo-images.com",
            "covers.openlibrary.org",
            "books.google.com",
            "books.googleusercontent.com",
            "catalogue.bnf.fr");
    private static final Set<String> IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp", "image/gif");
    private static final int MAX_BYTES = 5 * 1024 * 1024;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();

    /** The address to call, in https: empty when this URL is not on a known cover host. */
    public static Optional<URI> allowedCoverUri(String url) {
        try {
            URI uri = new URI(url);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
            boolean web = scheme.equals("https") || scheme.equals("http");
            if (!web || uri.getPort() != -1 || uri.getUserInfo() != null || !COVER_HOSTS.contains(host)) {
                return Optional.empty();
            }
            return Optional.of(new URI("https", null, host, -1, uri.getPath(), uri.getQuery(), null));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    /** The image, or empty when its host did not give a usable one: the page then has its fallback. */
    public Optional<CoverImage> read(URI uri) {
        try {
            HttpRequest request = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(8))
                    .header("User-Agent", "IozyCore")
                    .GET()
                    .build();
            HttpResponse<InputStream> response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
            try (InputStream body = response.body()) {
                String type = response.headers().firstValue("Content-Type").orElse("")
                        .split(";")[0].trim().toLowerCase(Locale.ROOT);
                if (response.statusCode() != 200 || !IMAGE_TYPES.contains(type)) {
                    return Optional.empty();
                }
                byte[] bytes = body.readNBytes(MAX_BYTES + 1);
                return bytes.length > MAX_BYTES ? Optional.empty() : Optional.of(new CoverImage(type, bytes));
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        } catch (Exception e) {
            log.warn("Cover not read from {}: {}", uri.getHost(), e.getMessage());
            return Optional.empty();
        }
    }
}
