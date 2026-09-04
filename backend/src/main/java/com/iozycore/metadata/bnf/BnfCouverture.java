package com.iozycore.metadata.bnf;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Les jaquettes du catalogue de la BnF, verifiees AU MOMENT DE LES GARDER,
 * jamais au moment de les lister (Lot 127).
 *
 * <p>Le lot 120 verifiait chaque adresse par un HEAD des la recherche de
 * tomes, par vagues de quatre. Sur Boruto (20 tomes) c'etait tenable ; sur
 * Naruto (72) ou One Piece (112), c'est une salve qui fait bloquer l'adresse
 * par la BnF pendant un quart d'heure - constate a repetition le
 * 2026-09-04, et subi par l'instance de l'utilisateur, qui partage l'adresse.
 * Or l'ecran, lui, n'a pas besoin de cette verification : une image qui
 * repond 500 tombe sur le repli du composant Jaquette. Seule la
 * PERSISTANCE en a besoin - une adresse morte enregistree sur un tome
 * bloquerait le rattrapage de jaquettes, qui ne retente que les tomes sans
 * image. D'ou une verification a l'ecriture, une par tome ajoute, au
 * rythme des gestes de l'utilisateur.
 */
public final class BnfCouverture {

    private static final Logger log = LoggerFactory.getLogger(BnfCouverture.class);
    private static final String HOTE = "catalogue.bnf.fr";
    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    private BnfCouverture() {
    }

    public static boolean estUneCouvertureBnf(String url) {
        return url != null && url.contains(HOTE + "/couverture");
    }

    /**
     * Vrai si l'image existe (200). Une adresse qui n'est pas une couverture
     * BnF est reputee vivante : les autres sources ne repondent pas 500 pour
     * dire « pas d'image », et ce n'est pas le role de cette classe.
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
                    log.warn("Couverture BnF injoignable, non conservée : {} ({})", url, e.getMessage());
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
