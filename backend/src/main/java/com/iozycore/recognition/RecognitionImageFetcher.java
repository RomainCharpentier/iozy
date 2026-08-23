package com.iozycore.recognition;

import com.iozycore.listing.ListingProvider;
import com.iozycore.listing.ListingUrlGuard;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
 * Télécharge les photos à analyser - et rien d'autre.
 *
 * <h2>Ce n'est pas un téléchargeur d'URL arbitraire</h2>
 * C'est le point de tout ce fichier. Un endpoint qui accepte une URL et va la
 * chercher côté serveur est une SSRF : on lui donne
 * {@code http://169.254.169.254/} et il rapporte les identifiants de la
 * machine. Trois barrières, franchies dans cet ordre :
 * <ol>
 *   <li><b>Liste blanche d'hôtes</b>, assemblée à partir de ce que les
 *       {@link ListingProvider} déclarent en {@code allowedImageHosts()}. Il
 *       n'existe aucune liste globale, aucun caractère générique, et un hôte
 *       absent est refusé <b>avant</b> le moindre appel réseau ;</li>
 *   <li><b>{@link ListingUrlGuard}</b>, déjà écrit et déjà testé : HTTPS
 *       obligatoire, refus des adresses privées, locales et de lien-local ;</li>
 *   <li><b>Lecture bornée</b> : taille par image, taille cumulée, nombre
 *       d'images, délai, et un type MIME image constaté.</li>
 * </ol>
 *
 * <h2>Aucune redirection</h2>
 * Contrairement au chargeur de pages, celui-ci ne suit <b>aucune</b>
 * redirection. Un CDN d'images n'a pas de raison d'en émettre, et chaque saut
 * suivi est une occasion de sortir de la liste blanche.
 *
 * <h2>Rien n'est archivé</h2>
 * Les octets vivent le temps de l'analyse, en mémoire. IozyCore ne conserve
 * aucune copie des photos d'une annonce - la plateforme reste seule
 * propriétaire de ses images.
 */
@Component
public class RecognitionImageFetcher {

    private static final Logger log = LoggerFactory.getLogger(RecognitionImageFetcher.class);

    /**
     * Au-delà, l'analyse coûte plus qu'elle ne rapporte : un lot se lit sur ses
     * premières photos, et chaque image supplémentaire est un appel de plus au
     * moteur. Aligné sur le plafond de photos que le provider Vinted remonte.
     */
    public static final int MAX_IMAGES = 8;

    /** Une photo d'annonce dépasse rarement 2 Mo ; au-delà c'est autre chose. */
    public static final int MAX_BYTES_PER_IMAGE = 3 * 1024 * 1024;

    /** Plafond cumulé : huit images de 3 Mo tiendraient en mémoire, mais rien ne justifie 24 Mo. */
    public static final int MAX_TOTAL_BYTES = 12 * 1024 * 1024;

    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(10);
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(5);

    /** Ce que les moteurs savent lire, et ce que les CDN d'annonces servent. */
    private static final Set<String> ACCEPTED_MEDIA_TYPES =
            Set.of("image/jpeg", "image/png", "image/webp");

    private final HttpClient httpClient;
    private final Set<String> allowedImageHosts;

    public RecognitionImageFetcher(List<ListingProvider> providers) {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(CONNECT_TIMEOUT)
                // NEVER : aucune redirection suivie, voir la Javadoc de la classe.
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
     * Rapporte ce qui a pu être téléchargé, en silence sur le reste : une photo
     * refusée ou illisible n'est pas une erreur d'analyse, c'est une photo en
     * moins. L'appelant voit la différence au nombre d'images rendues.
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
                // On journalise la raison, jamais l'URL complète : elle identifie
                // une annonce précise, et ces journaux ne sont pas confidentiels.
                log.info("Photo refusée avant tout appel réseau ({})", verdict.rejection());
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
                log.info("Photo non récupérée : status={}", response.statusCode());
                return null;
            }

            String mediaType = response.headers().firstValue("content-type")
                    .map(valeur -> valeur.split(";")[0].trim().toLowerCase(Locale.ROOT))
                    .orElse("");
            if (!ACCEPTED_MEDIA_TYPES.contains(mediaType)) {
                // Un serveur qui rend du HTML ou du binaire quelconque sur une URL
                // d'image n'a pas à voir ses octets partir vers un moteur.
                log.info("Photo ignorée : type MIME inattendu ({})", mediaType.isBlank() ? "absent" : mediaType);
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
            // Une photo injoignable est une photo en moins, jamais une exception
            // qui remonterait jusqu'à casser le parcours d'analyse.
            log.info("Photo injoignable : {}", e.getClass().getSimpleName());
            return null;
        }
    }

    /** Lecture bornée : on s'arrête au plafond, on ne mesure pas après coup. */
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

    /** Les hôtes réellement autorisés - exposé pour que les tests puissent l'affirmer. */
    public Set<String> allowedImageHosts() {
        return allowedImageHosts;
    }
}
