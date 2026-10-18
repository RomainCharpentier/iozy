package com.iozycore.manga.metadata.bnf;

import lombok.extern.slf4j.Slf4j;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * The covers of the BnF catalog, checked AT THE TIME OF KEEPING THEM,
 * never at the time of listing them (Batch 127).
 *
 * <p>Batch 120 checked each address with a HEAD as soon as the volume search ran,
 * in waves of four. On Boruto (20 volumes) it was fine; on
 * Naruto (72) or One Piece (112), it is a burst that makes the BnF block the address
 * for a quarter of an hour - seen repeatedly on
 * 2026-09-04, and suffered by the user's instance, which shares the address.
 * Yet the screen does not need this check: an image that
 * answers 500 falls back on the fallback of the Jaquette component. Only
 * PERSISTENCE needs it - a dead address saved on a volume
 * would block the cover catch-up, which only retries the volumes without
 * an image. Hence a check at write time, one per volume added, at the
 * pace of the user's actions.
 */
@Slf4j
public final class BnfCouverture {

    private static final String HOTE = "catalogue.bnf.fr";
    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    private BnfCouverture() {
    }

    public static boolean estUneCouvertureBnf(String url) {
        return url != null && url.contains(HOTE + "/couverture");
    }

    /**
     * True if the image exists (200). An address that is not a BnF
     * cover is assumed alive: the other sources do not answer 500 to
     * say "no image", and it is not the role of this class.
     */
    public static boolean estVivante(String url) {
        if (!estUneCouvertureBnf(url)) {
            return true;
        }
        HttpRequest head = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(8))
                .method("HEAD", HttpRequest.BodyPublishers.noBody())
                .build();
        for (int tentative = 1; tentative <= 2; tentative++) {
            try {
                return HTTP.send(head, HttpResponse.BodyHandlers.discarding()).statusCode() == 200;
            } catch (Exception e) {
                if (tentative == 2) {
                    log.warn("BnF cover unreachable, not kept: {} ({})", url, e.getMessage());
                    return false;
                }
                try {
                    Thread.sleep(500);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    return false;
                }
            }
        }
        return false;
    }
}
