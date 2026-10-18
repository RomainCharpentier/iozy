package com.iozycore.core.listing;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/**
 * The only path through which IozyCore fetches a listing page, and the only
 * place where the limits of this fetching are written.
 * <p>
 * It is not a generic HTTP client: it can only fetch an HTML
 * document, from an explicitly allowed host, with a size cap and a
 * maximum delay. There is deliberately no "give me this
 * URL" endpoint - the server only fetches what a declared provider asks of it.
 * <p>
 * <b>Redirects are followed by hand</b>, one hop at a time, each one
 * revalidated by {@link ListingUrlGuard}. Letting {@link HttpClient} follow them
 * alone would reopen exactly the hole that the guard closes: an allowed
 * host that redirects to {@code localhost}.
 * <p>
 * The {@code User-Agent} header honestly announces IozyCore. Pretending to be
 * a browser would be a workaround, and there is nothing to work around:
 * the fetching is triggered by a user who has just pasted this exact
 * link, not by a robot that crawls the site.
 */
@Component
@Slf4j
public class ListingHttpFetcher {

    /** Beyond this, we give up: the user is waiting in front of their form. */
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(12);
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);

    /**
     * Read cap. A listing page weighs a few megabytes; this
     * cap exists so that an abnormally large response (on purpose or
     * not) does not fill the memory of the server. We cut the reading, we do not
     * load first to measure afterwards.
     */
    private static final int MAX_BYTES = 4 * 1024 * 1024;

    /** A listing page is HTML. Everything else (PDF, archive, binary) has no business here. */
    private static final String EXPECTED_CONTENT_TYPE = "text/html";

    private static final int MAX_REDIRECTS = 4;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(CONNECT_TIMEOUT)
            // NEVER: the hops are revalidated one by one below.
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();

    /** What we got, or why we got nothing. */
    public record Fetched(String html, URI finalUri, Failure failure) {
        public boolean isSuccess() {
            return failure == null;
        }
    }

    /** Failure categories, told apart because the user has not the same thing to do in each case. */
    public enum Failure {
        /** URL refused before any network call (host not allowed, internal address, forbidden scheme). */
        URL_REJECTED,
        /** The listing no longer exists, or never existed (404/410). */
        NOT_FOUND,
        /** The source answered something other than a usable page: blocking, outage, unexpected format. */
        UNAVAILABLE
    }

    /**
     * Fetches the page, or says why it could not be.
     *
     * @param allowedHosts hosts declared by the calling provider - never a global list
     */
    public Fetched fetchHtml(String rawUrl, Set<String> allowedHosts) {
        ListingUrlGuard.Result guard = ListingUrlGuard.check(rawUrl, allowedHosts);
        if (!guard.isAllowed()) {
            log.debug("Listing fetch refused before any network call: {}", guard.rejection());
            return new Fetched(null, null, Failure.URL_REJECTED);
        }

        URI current = guard.uri();
        long start = System.currentTimeMillis();
        try {
            for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
                HttpResponse<InputStream> response = httpClient.send(
                        HttpRequest.newBuilder(current)
                                .timeout(REQUEST_TIMEOUT)
                                .header("User-Agent", "IozyCore/1.0 (personal collection manager; user-pasted link)")
                                .header("Accept", "text/html")
                                // No cookie, no identifier, no session: we only
                                // read what an anonymous visitor sees.
                                .GET()
                                .build(),
                        HttpResponse.BodyHandlers.ofInputStream());

                int status = response.statusCode();
                if (status >= 300 && status < 400) {
                    Optional<String> location = response.headers().firstValue("location");
                    response.body().close();
                    if (location.isEmpty()) {
                        return failed(Failure.UNAVAILABLE, current, start, "redirect without location");
                    }
                    URI next = current.resolve(location.get());
                    // The next hop goes again through the whitelist AND through the
                    // address check: this is the whole point of following them ourselves.
                    ListingUrlGuard.Result hopGuard = ListingUrlGuard.check(next.toString(), allowedHosts);
                    if (!hopGuard.isAllowed()) {
                        log.warn("Listing redirect refused ({}) after {} hop(s)", hopGuard.rejection(), hop + 1);
                        return failed(Failure.URL_REJECTED, current, start, "redirect blocked");
                    }
                    current = hopGuard.uri();
                    continue;
                }

                if (status == 404 || status == 410) {
                    response.body().close();
                    return failed(Failure.NOT_FOUND, current, start, "status " + status);
                }
                if (status != 200) {
                    response.body().close();
                    return failed(Failure.UNAVAILABLE, current, start, "status " + status);
                }

                String contentType = response.headers().firstValue("content-type").orElse("")
                        .toLowerCase(Locale.ROOT);
                if (!contentType.contains(EXPECTED_CONTENT_TYPE)) {
                    response.body().close();
                    return failed(Failure.UNAVAILABLE, current, start, "content-type " + contentType);
                }

                String html = readAtMost(response.body());
                log.info("Listing fetched: host={} status=200 bytes={} durationMs={}",
                        current.getHost(), html.length(), System.currentTimeMillis() - start);
                return new Fetched(html, current, null);
            }
            return failed(Failure.UNAVAILABLE, current, start, "too many redirects");
        } catch (Exception e) {
            // The exception message can contain the full URL; the category and
            // the host are enough for diagnosis, the rest must not end up in the logs.
            return failed(Failure.UNAVAILABLE, current, start, e.getClass().getSimpleName());
        }
    }

    private Fetched failed(Failure failure, URI uri, long start, String reason) {
        log.info("Listing fetch failed: host={} failure={} reason={} durationMs={}",
                uri == null ? "?" : uri.getHost(), failure, reason, System.currentTimeMillis() - start);
        return new Fetched(null, uri, failure);
    }

    /** Bounded reading: we stop at {@link #MAX_BYTES}, we do not measure afterwards. */
    private static String readAtMost(InputStream body) throws Exception {
        try (InputStream in = body) {
            byte[] buffer = new byte[8192];
            byte[] accumulated = new byte[0];
            int total = 0;
            int read;
            while (total < MAX_BYTES && (read = in.read(buffer)) != -1) {
                int keep = Math.min(read, MAX_BYTES - total);
                byte[] grown = new byte[total + keep];
                System.arraycopy(accumulated, 0, grown, 0, total);
                System.arraycopy(buffer, 0, grown, total, keep);
                accumulated = grown;
                total += keep;
            }
            return new String(accumulated, StandardCharsets.UTF_8);
        }
    }
}
