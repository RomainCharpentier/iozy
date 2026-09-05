package com.iozycore.manga.metadata.googlebooks;

import com.iozycore.metadata.QuotaExceededException;
import com.iozycore.metadata.SourceUnavailableException;
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
 * Utilise un vrai {@link HttpServer} (JDK, aucune dépendance de test
 * supplémentaire) plutôt qu'un mock, pour vérifier le VRAI comportement
 * réseau (rotation de clé sur 429, court-circuit sur une autre erreur) - les
 * autres tests Google Books de ce module (parse() sur un corps déjà en
 * mémoire) ne passent jamais par cette classe.
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
        // Cas réel qui motive cette classe (voir historique) : la clé
        // principale a épuisé son quota journalier pendant une session de
        // tests intensifs - une clé de secours doit prendre le relais.
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
        // Une 500 n'est pas un problème de quota - retenter avec une autre
        // clé ne changerait rien, inutile de gaspiller cet appel dessus.
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
        // Défaut constaté le 2026-08-27 (voir Lot 58) : un 503 rendait null,
        // que l'appelant traduisait en liste vide - donc en « aucun tome »,
        // mis en cache durablement. Une panne doit LEVER.
        start(exchange -> response(503, "{\"error\":\"backendError\"}"));

        GoogleBooksHttpClient client = new GoogleBooksHttpClient("primary", "");

        assertThatThrownBy(() -> client.get(baseUrl()))
                .isInstanceOf(SourceUnavailableException.class)
                .hasMessageContaining("503");
        // Et surtout : ce n'est PAS un quota, le cooldown ne doit pas s'armer.
        assertThat(client.isQuotaLikelyExhausted()).isFalse();
    }

    @Test
    void an_unreachable_host_is_reported_as_an_unavailable_source() throws Exception {
        // Coupure réseau / délai dépassé : même conclusion qu'un 503.
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
        assertThat(keysSeen).containsExactly("none"); // pas de "&key=" ajouté du tout
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

    /** "none" si aucun paramètre "key" n'est présent dans l'URL appelée. */
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
