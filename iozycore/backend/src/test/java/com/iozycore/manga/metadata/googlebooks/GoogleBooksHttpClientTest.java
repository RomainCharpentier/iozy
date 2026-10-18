package com.iozycore.manga.metadata.googlebooks;

import com.iozycore.core.metadata.QuotaExceededException;
import com.iozycore.core.metadata.SourceUnavailableException;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Uses a real {@link HttpServer} (JDK, no additional test
 * dependency) rather than a mock, to check the REAL network
 * behaviour (key rotation on 429, short-circuit on another error) - the
 * other Google Books tests of this module (parse() on a body already in
 * memory) never go through this class.
 */
class GoogleBooksHttpClientTest {

    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void falls_back_to_the_backup_key_when_the_primary_one_is_quota_exceeded() throws Exception {
        // Real case that motivates this class (see history): the main
        // key used up its daily quota during an intensive test
        // session - a backup key must take over.
        List<String> keysSeen = new CopyOnWriteArrayList<>();
        start(exchange -> {
            String key = keyFrom(exchange);
            keysSeen.add(key);
            return "backup".equals(key) ? response(200, "{\"ok\":true}") : response(429, "{\"error\":\"quota\"}");
        });

        GoogleBooksHttpClient client = new GoogleBooksHttpClient("primary", "backup");
        String body = client.get(baseUrl());

        assertThat(body).isEqualTo("{\"ok\":true}");
        assertThat(keysSeen).containsExactly("primary", "backup");
    }

    @Test
    void throws_quota_exceeded_only_once_every_configured_key_is_exhausted() throws Exception {
        List<String> keysSeen = new CopyOnWriteArrayList<>();
        start(exchange -> {
            keysSeen.add(keyFrom(exchange));
            return response(429, "{\"error\":\"quota\"}");
        });

        GoogleBooksHttpClient client = new GoogleBooksHttpClient("primary", "backup1,backup2");

        assertThatThrownBy(() -> client.get(baseUrl())).isInstanceOf(QuotaExceededException.class);
        assertThat(keysSeen).containsExactly("primary", "backup1", "backup2");
    }

    @Test
    void does_not_try_another_key_on_a_non_quota_error() throws Exception {
        // A 500 is not a quota problem - retrying with another
        // key would change nothing, no point wasting this call on it.
        AtomicInteger callCount = new AtomicInteger();
        start(exchange -> {
            callCount.incrementAndGet();
            return response(500, "{\"error\":\"boom\"}");
        });

        GoogleBooksHttpClient client = new GoogleBooksHttpClient("primary", "backup");

        assertThatThrownBy(() -> client.get(baseUrl())).isInstanceOf(SourceUnavailableException.class);
        assertThat(callCount.get()).isEqualTo(1);
    }

    @Test
    void a_source_that_did_not_answer_is_never_confused_with_an_empty_result() throws Exception {
        // Flaw seen on 2026-08-27 (see Batch 58): a 503 returned null,
        // which the caller turned into an empty list - so into "no volume",
        // cached durably. An outage must THROW.
        start(exchange -> response(503, "{\"error\":\"backendError\"}"));

        GoogleBooksHttpClient client = new GoogleBooksHttpClient("primary", "");

        assertThatThrownBy(() -> client.get(baseUrl()))
                .isInstanceOf(SourceUnavailableException.class)
                .hasMessageContaining("503");
        // And above all: this is NOT a quota, the cooldown must not arm.
        assertThat(client.isQuotaLikelyExhausted()).isFalse();
    }

    @Test
    void an_unreachable_host_is_reported_as_an_unavailable_source() throws Exception {
        // Network cut / timeout: same conclusion as a 503.
        start(exchange -> response(200, "{}"));
        String deadUrl = baseUrl();
        server.stop(0);
        server = null;

        GoogleBooksHttpClient client = new GoogleBooksHttpClient("primary", "");

        assertThatThrownBy(() -> client.get(deadUrl)).isInstanceOf(SourceUnavailableException.class);
    }

    @Test
    void works_anonymously_without_any_configured_key() throws Exception {
        List<String> keysSeen = new CopyOnWriteArrayList<>();
        start(exchange -> {
            keysSeen.add(keyFrom(exchange));
            return response(200, "{\"ok\":true}");
        });

        GoogleBooksHttpClient client = new GoogleBooksHttpClient("", "");
        String body = client.get(baseUrl());

        assertThat(body).isEqualTo("{\"ok\":true}");
        assertThat(keysSeen).containsExactly("none"); // no "&key=" added at all
    }

    @Test
    void reports_quota_likely_exhausted_only_after_every_key_has_actually_failed() throws Exception {
        start(exchange -> response(429, "{\"error\":\"quota\"}"));
        GoogleBooksHttpClient client = new GoogleBooksHttpClient("primary", "");

        assertThat(client.isQuotaLikelyExhausted()).isFalse();
        assertThatThrownBy(() -> client.get(baseUrl())).isInstanceOf(QuotaExceededException.class);
        assertThat(client.isQuotaLikelyExhausted()).isTrue();
    }

    private void start(Function<HttpExchange, FakeResponse> handler) throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            FakeResponse fakeResponse = handler.apply(exchange);
            byte[] bytes = fakeResponse.body.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(fakeResponse.status, bytes.length);
            try (var os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        });
        server.start();
    }

    private String baseUrl() {
        return "http://127.0.0.1:" + server.getAddress().getPort() + "/volumes?q=test";
    }

    /** "none" if no "key" parameter is present in the called URL. */
    private static String keyFrom(HttpExchange exchange) {
        String query = exchange.getRequestURI().getQuery();
        if (query == null) {
            return "none";
        }
        for (String param : query.split("&")) {
            if (param.startsWith("key=")) {
                return param.substring("key=".length());
            }
        }
        return "none";
    }

    private static FakeResponse response(int status, String body) {
        return new FakeResponse(status, body);
    }

    private record FakeResponse(int status, String body) {
    }
}
