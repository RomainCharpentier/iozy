package com.iozycore.core.listing;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
 * Le seul chemin par lequel IozyCore va chercher une page d'annonce, et le seul
 * endroit où les limites de cette récupération sont écrites.
 * <p>
 * Ce n'est pas un client HTTP générique : il ne sait récupérer qu'un document
 * HTML, depuis un hôte explicitement autorisé, avec un plafond de taille et un
 * délai maximum. Il n'existe volontairement aucun endpoint « donne-moi cette
 * URL » - le serveur ne récupère que ce qu'un provider déclaré lui demande.
 * <p>
 * <b>Les redirections sont suivies à la main</b>, un saut à la fois, chacun
 * revalidé par {@link ListingUrlGuard}. Laisser {@link HttpClient} les suivre
 * seul rouvrirait exactement la faille que le garde-fou ferme : un hôte
 * autorisé qui redirige vers {@code localhost}.
 * <p>
 * L'en-tête {@code User-Agent} annonce honnêtement IozyCore. Se faire passer
 * pour un navigateur serait un contournement, et il n'y a rien à contourner :
 * la récupération est déclenchée par un utilisateur qui vient de coller ce lien
 * précis, pas par un robot qui parcourt le site.
 */
@Component
public class ListingHttpFetcher {

    private static final Logger log = LoggerFactory.getLogger(ListingHttpFetcher.class);

    /** Au-delà, on abandonne : l'utilisateur attend devant son formulaire. */
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(12);
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);

    /**
     * Plafond de lecture. Une page d'annonce pèse quelques mégaoctets ; ce
     * plafond existe pour qu'une réponse anormalement grosse (volontairement ou
     * non) ne remplisse pas la mémoire du serveur. On coupe la lecture, on ne
     * charge pas d'abord pour mesurer ensuite.
     */
    private static final int MAX_BYTES = 4 * 1024 * 1024;

    /** Une page d'annonce est du HTML. Tout le reste (PDF, archive, binaire) n'a rien à faire ici. */
    private static final String EXPECTED_CONTENT_TYPE = "text/html";

    private static final int MAX_REDIRECTS = 4;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(CONNECT_TIMEOUT)
            // NEVER : les sauts sont revalidés un par un ci-dessous.
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();

    /** Ce qu'on a obtenu, ou pourquoi on n'a rien obtenu. */
    public record Fetched(String html, URI finalUri, Failure failure) {
        public boolean isSuccess() {
            return failure == null;
        }
    }

    /** Catégories d'échec, distinguées parce que l'utilisateur n'a pas la même chose à faire dans chaque cas. */
    public enum Failure {
        /** URL refusée avant tout appel réseau (hôte non autorisé, adresse interne, schéma interdit). */
        URL_REJECTED,
        /** L'annonce n'existe plus, ou n'a jamais existé (404/410). */
        NOT_FOUND,
        /** La source a répondu autre chose qu'une page exploitable : blocage, panne, format inattendu. */
        UNAVAILABLE
    }

    /**
     * Récupère la page, ou dit pourquoi elle n'a pas pu l'être.
     *
     * @param allowedHosts hôtes déclarés par le provider appelant - jamais une liste globale
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
                                // Pas de cookie, pas d'identifiant, pas de session : on ne
                                // lit que ce qu'un visiteur anonyme voit.
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
                    // Le saut suivant repasse par la liste blanche ET par le contrôle
                    // d'adresse : c'est tout l'intérêt de les suivre soi-même.
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
            // Le message d'exception peut contenir l'URL complète ; la catégorie et
            // l'hôte suffisent au diagnostic, le reste n'a pas à finir dans les logs.
            return failed(Failure.UNAVAILABLE, current, start, e.getClass().getSimpleName());
        }
    }

    private Fetched failed(Failure failure, URI uri, long start, String reason) {
        log.info("Listing fetch failed: host={} failure={} reason={} durationMs={}",
                uri == null ? "?" : uri.getHost(), failure, reason, System.currentTimeMillis() - start);
        return new Fetched(null, uri, failure);
    }

    /** Lecture bornée : on s'arrête à {@link #MAX_BYTES}, on ne mesure pas après coup. */
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
