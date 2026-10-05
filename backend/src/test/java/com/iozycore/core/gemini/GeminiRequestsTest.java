package com.iozycore.core.gemini;

import org.junit.jupiter.api.Test;

import javax.net.ssl.SSLSession;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Retrying when Google says to retry - and only in that case; then
 * the fallback, once, when the main model really cannot cope anymore.
 */
class GeminiRequestsTest {

    private static final String PRINCIPAL = "gemini-3.5-flash";
    private static final String REPLI = "gemini-3.5-flash-lite";

    /** A series of statuses served in order; counts the sends. */
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

    // ------------------------------------------------------------ The fallback

    /**
     * One send per model: one status per model name, and a timeout
     * for any model without a status; records the models called, in order.
     */
    private static final class EnvoisParModele implements GeminiRequests.EnvoiParModele {
        private final Map<String, Integer> statuts;
        private final List<String> appels = new ArrayList<>();

        EnvoisParModele(Map<String, Integer> statuts) {
            this.statuts = statuts;
        }

        @Override
        public HttpResponse<String> executer(String modele) throws Exception {
            appels.add(modele);
            Integer statut = statuts.get(modele);
            if (statut == null) {
                throw new HttpTimeoutException("délai dépassé pour " + modele);
            }
            return reponse(statut);
        }
    }

    @Test
    void a_primary_still_saturated_after_its_retries_is_replayed_once_on_the_fallback() throws Exception {
        EnvoisParModele envois = new EnvoisParModele(Map.of(PRINCIPAL, 503, REPLI, 200));

        HttpResponse<String> reponse = GeminiRequests.avecRepli(envois, PRINCIPAL, REPLI);

        assertThat(reponse.statusCode()).isEqualTo(200);
        assertThat(envois.appels).containsExactly(PRINCIPAL, REPLI);
    }

    @Test
    void a_primary_that_does_not_answer_in_time_is_replayed_on_the_fallback() throws Exception {
        EnvoisParModele envois = new EnvoisParModele(Map.of(REPLI, 200));

        HttpResponse<String> reponse = GeminiRequests.avecRepli(envois, PRINCIPAL, REPLI);

        assertThat(reponse.statusCode()).isEqualTo(200);
        assertThat(envois.appels).containsExactly(PRINCIPAL, REPLI);
    }

    @Test
    void the_fallback_answer_is_returned_as_is_even_when_it_fails_too() throws Exception {
        EnvoisParModele envois = new EnvoisParModele(Map.of(PRINCIPAL, 503, REPLI, 503));

        HttpResponse<String> reponse = GeminiRequests.avecRepli(envois, PRINCIPAL, REPLI);

        assertThat(reponse.statusCode()).isEqualTo(503);
        assertThat(envois.appels).containsExactly(PRINCIPAL, REPLI);
    }

    @Test
    void a_quota_answer_is_never_replayed_on_the_fallback() throws Exception {
        EnvoisParModele envois = new EnvoisParModele(Map.of(PRINCIPAL, 429, REPLI, 200));

        HttpResponse<String> reponse = GeminiRequests.avecRepli(envois, PRINCIPAL, REPLI);

        assertThat(reponse.statusCode()).isEqualTo(429);
        assertThat(envois.appels).containsExactly(PRINCIPAL);
    }

    @Test
    void a_good_answer_from_the_primary_never_touches_the_fallback() throws Exception {
        for (int statut : new int[] {200, 400, 401, 404, 500}) {
            EnvoisParModele envois = new EnvoisParModele(Map.of(PRINCIPAL, statut, REPLI, 200));

            HttpResponse<String> reponse = GeminiRequests.avecRepli(envois, PRINCIPAL, REPLI);

            assertThat(reponse.statusCode()).isEqualTo(statut);
            assertThat(envois.appels).containsExactly(PRINCIPAL);
        }
    }

    @Test
    void without_a_fallback_the_primary_answer_is_returned_as_is() throws Exception {
        EnvoisParModele envois = new EnvoisParModele(Map.of(PRINCIPAL, 503, REPLI, 200));

        HttpResponse<String> reponse = GeminiRequests.avecRepli(envois, PRINCIPAL, null);

        assertThat(reponse.statusCode()).isEqualTo(503);
        assertThat(envois.appels).containsExactly(PRINCIPAL);
    }

    @Test
    void without_a_fallback_a_timeout_propagates_as_before() {
        EnvoisParModele envois = new EnvoisParModele(Map.of(REPLI, 200));

        assertThatThrownBy(() -> GeminiRequests.avecRepli(envois, PRINCIPAL, null))
                .isInstanceOf(HttpTimeoutException.class);
        assertThat(envois.appels).containsExactly(PRINCIPAL);
    }

    @Test
    void the_fallback_defaults_to_the_lite_variant_and_is_never_the_primary_itself() {
        assertThat(GeminiRequests.effectiveFallbackModel(null, PRINCIPAL)).isEqualTo(REPLI);
        assertThat(GeminiRequests.effectiveFallbackModel("   ", PRINCIPAL)).isEqualTo(REPLI);
        assertThat(GeminiRequests.effectiveFallbackModel(" gemini-2.5-flash ", PRINCIPAL)).isEqualTo("gemini-2.5-flash");
        // The same name as the main one disables the fallback - this is the setting
        // documented to never replay elsewhere.
        assertThat(GeminiRequests.effectiveFallbackModel(PRINCIPAL, PRINCIPAL)).isNull();
        // And the lite as main has no fallback to itself.
        assertThat(GeminiRequests.effectiveFallbackModel(null, REPLI)).isNull();
    }

    // ------------------------------------------------------------ A minimal answer

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
