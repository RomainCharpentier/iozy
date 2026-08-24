package com.iozycore.recognition;

import java.util.Set;

/**
 * Ce qu'une photo doit respecter pour être analysée — quelle que soit la porte
 * par laquelle elle entre.
 *
 * <h2>Pourquoi ces bornes ne vivent plus dans le fetcher</h2>
 * Il existe désormais <b>deux</b> entrées : les photos récupérées depuis une
 * annonce ({@link RecognitionImageFetcher}) et celles envoyées par
 * l'utilisateur ({@link UploadedImageReader}). Des bornes recopiées dans les
 * deux dérivent : on relève le plafond d'un côté, on l'oublie de l'autre, et
 * la porte oubliée devient la porte à forcer. Elles sont donc énoncées ici,
 * une fois.
 *
 * <h2>Le type MIME se constate, il ne se déclare pas</h2>
 * {@link #sniff(byte[])} lit les premiers octets. C'est la différence entre
 * les deux portes : un CDN qui annonce {@code image/jpeg} engage sa
 * responsabilité, un fichier envoyé depuis un téléphone n'annonce que ce que
 * le client a bien voulu écrire. {@code Content-Type: image/png} sur un
 * exécutable est une ligne de texte, pas une garantie — et ces octets partent
 * ensuite vers un moteur externe.
 */
public final class RecognitionImageLimits {

    private RecognitionImageLimits() {
    }

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

    /** Ce que les moteurs savent lire, et ce que les CDN d'annonces servent. */
    public static final Set<String> ACCEPTED_MEDIA_TYPES = Set.of("image/jpeg", "image/png", "image/webp");

    /**
     * Le type MIME réellement porté par ces octets, ou {@code null} si ce n'est
     * aucune des trois images acceptées.
     *
     * <p>Trois signatures, reconnues à leur en-tête :
     * <ul>
     *   <li>JPEG : {@code FF D8 FF} ;</li>
     *   <li>PNG : {@code 89 50 4E 47 0D 0A 1A 0A} ;</li>
     *   <li>WebP : {@code RIFF} puis {@code WEBP} en position 8.</li>
     * </ul>
     *
     * <p>Ce n'est pas un validateur d'image : un JPEG tronqué passe, et c'est
     * voulu — le rôle ici est d'écarter ce qui n'est <b>pas du tout</b> une
     * image, pas de garantir qu'elle se décode. Le moteur, lui, sait dire qu'il
     * n'a rien vu.
     */
    public static String sniff(byte[] octets) {
        if (octets == null || octets.length < 12) {
            return null;
        }
        if (u(octets[0]) == 0xFF && u(octets[1]) == 0xD8 && u(octets[2]) == 0xFF) {
            return "image/jpeg";
        }
        if (u(octets[0]) == 0x89 && octets[1] == 'P' && octets[2] == 'N' && octets[3] == 'G'
                && u(octets[4]) == 0x0D && u(octets[5]) == 0x0A && u(octets[6]) == 0x1A && u(octets[7]) == 0x0A) {
            return "image/png";
        }
        if (octets[0] == 'R' && octets[1] == 'I' && octets[2] == 'F' && octets[3] == 'F'
                && octets[8] == 'W' && octets[9] == 'E' && octets[10] == 'B' && octets[11] == 'P') {
            return "image/webp";
        }
        return null;
    }

    /** Un {@code byte} est signé en Java : sans ça, 0xFF vaut -1 et aucune comparaison ne tombe juste. */
    private static int u(byte b) {
        return b & 0xFF;
    }
}
