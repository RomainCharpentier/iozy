package com.iozycore.core.gemini;

import org.junit.jupiter.api.Test;

import javax.net.ssl.SSLSession;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Réessayer quand Google dit de réessayer - et seulement dans ce cas.
 */
class GeminiRequestsTest {

    /** Une suite de statuts servis dans l'ordre ; compte les envois. */
    private static final class EnvoisScriptes implements GeminiRequests.Envoi {
        private final Deque<Integer> statuts = new ArrayDeque<>();
        private int envois;

        EnvoisScriptes(int... statuts) {
            for (int statut : statuts) {
                this.statuts.add(statut);
            }
        }

        @Override
        public HttpResponse<String> executer() {
            envois++;
            return reponse(statuts.isEmpty() ? 200 : statuts.poll());
        }
    }

    @Test
    void a_503_is_retried_and_the_first_good_answer_is_returned() throws Exception {
        EnvoisScriptes envois = new EnvoisScriptes(503, 200);

        HttpResponse<String> reponse = GeminiRequests.avecReprises(envois, 0);

        assertThat(reponse.statusCode()).isEqualTo(200);
        assertThat(envois.envois).isEqualTo(2);
    }

    @Test
    void a_429_is_retried_too() throws Exception {
        EnvoisScriptes envois = new EnvoisScriptes(429, 429, 200);

        HttpResponse<String> reponse = GeminiRequests.avecReprises(envois, 0);

        assertThat(reponse.statusCode()).isEqualTo(200);
        assertThat(envois.envois).isEqualTo(3);
    }

    @Test
    void after_the_last_attempt_the_answer_is_returned_as_is() throws Exception {
        EnvoisScriptes envois = new EnvoisScriptes(503, 503, 503, 200);

        HttpResponse<String> reponse = GeminiRequests.avecReprises(envois, 0);

        assertThat(reponse.statusCode()).isEqualTo(503);
        assertThat(envois.envois).isEqualTo(GeminiRequests.TENTATIVES_MAX);
    }

    @Test
    void any_other_status_is_not_retried() throws Exception {
        for (int statut : new int[] {200, 400, 401, 404, 500}) {
            EnvoisScriptes envois = new EnvoisScriptes(statut, 200);

            HttpResponse<String> reponse = GeminiRequests.avecReprises(envois, 0);

            assertThat(reponse.statusCode()).isEqualTo(statut);
            assertThat(envois.envois).isEqualTo(1);
        }
    }

    // ------------------------------------------------------------ Une réponse minimale

    private static HttpResponse<String> reponse(int statut) {
        return new HttpResponse<>() {
            @Override
            public int statusCode() {
                return statut;
            }

            @Override
            public HttpRequest request() {
                return HttpRequest.newBuilder(URI.create("https://exemple.invalid")).build();
            }

            @Override
            public Optional<HttpResponse<String>> previousResponse() {
                return Optional.empty();
            }

            @Override
            public HttpHeaders headers() {
                return HttpHeaders.of(Map.of(), (a, b) -> true);
            }

            @Override
            public String body() {
                return "{}";
            }

            @Override
            public Optional<SSLSession> sslSession() {
                return Optional.empty();
            }

            @Override
            public URI uri() {
                return URI.create("https://exemple.invalid");
            }

            @Override
            public HttpClient.Version version() {
                return HttpClient.Version.HTTP_1_1;
            }
        };
    }
}
