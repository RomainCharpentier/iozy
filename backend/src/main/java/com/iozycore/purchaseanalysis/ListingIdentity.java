package com.iozycore.purchaseanalysis;

import java.net.URI;
import java.util.Locale;

/**
 * Reconnaître qu'on regarde <b>deux fois la même annonce</b>.
 *
 * <h2>À quoi ça sert exactement</h2>
 * Une annonce analysée trois fois ne fait pas trois vendeurs. Sans identité,
 * elle gonflerait l'échantillon et ferait passer une référence à HIGH sur une
 * seule offre - le contraire de ce qu'un échantillon veut dire. C'est aussi ce
 * qui permet d'exclure l'annonce en cours d'évaluation de sa propre référence.
 *
 * <h2>Par ordre de préférence</h2>
 * <ol>
 *   <li>L'<b>identifiant de la source</b> quand elle en donne un. Sur Vinted il
 *       est lu dans la page et ne dépend pas du slug : deux liens vers la même
 *       annonce, avec ou sans titre dans l'URL, donnent le même identifiant.</li>
 *   <li>Sinon l'<b>URL normalisée</b> - hôte en minuscules, sans {@code www.},
 *       sans paramètres de suivi, sans ancre ni barre finale. Faible mais
 *       honnête : si la source réécrit ses URL, la déduplication rate, et rater
 *       une déduplication vaut mieux que fusionner deux annonces distinctes.</li>
 *   <li>Sinon <b>rien</b>. Une saisie manuelle n'a pas d'annonce derrière elle ;
 *       chaque relevé compte alors pour un comparable, ce qui est le sens même
 *       d'un relevé saisi à la main.</li>
 * </ol>
 *
 * <h2>Domaine pur</h2>
 * Une fonction de chaînes. Aucun accès réseau : cette classe ne visite jamais
 * l'URL qu'elle normalise.
 */
public final class ListingIdentity {

    private ListingIdentity() {
    }

    /**
     * @param platform   la source, qui préfixe l'identifiant pour qu'un « 12345 »
     *                   Vinted ne croise jamais un « 12345 » d'ailleurs
     * @param externalId identifiant chez la source, ou {@code null}
     * @param url        lien de l'annonce, ou {@code null}
     * @return l'identité, ou {@code null} quand aucune déduplication n'est possible
     */
    public static String of(ListingPlatform platform, String externalId, String url) {
        String source = platform == null ? ListingPlatform.OTHER.name() : platform.name();
        if (externalId != null && !externalId.isBlank()) {
            return source + ":" + externalId.trim();
        }
        String normalisee = normaliserUrl(url);
        return normalisee == null ? null : source + ":url:" + normalisee;
    }

    /**
     * Réduit une URL à ce qui désigne l'annonce.
     * <p>
     * Les paramètres de requête sont retirés en entier plutôt que filtrés un à
     * un : sur les places de marché visées ils portent du suivi
     * (<i>referrer</i>, campagne, position dans une liste), jamais l'identité de
     * l'annonce, laquelle vit dans le chemin. Retirer trop peu ferait passer
     * deux liens vers la même annonce pour deux annonces.
     */
    static String normaliserUrl(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        try {
            URI uri = URI.create(url.trim());
            String hote = uri.getHost();
            if (hote == null) {
                return null;
            }
            hote = hote.toLowerCase(Locale.ROOT);
            if (hote.startsWith("www.")) {
                hote = hote.substring(4);
            }
            String chemin = uri.getPath() == null ? "" : uri.getPath();
            while (chemin.endsWith("/")) {
                chemin = chemin.substring(0, chemin.length() - 1);
            }
            return chemin.isEmpty() ? hote : hote + chemin;
        } catch (IllegalArgumentException e) {
            // Une URL inexploitable ne vaut pas mieux qu'une absence d'URL : on
            // ne dédoublonne pas plutôt que de dédoublonner de travers.
            return null;
        }
    }
}
