package com.iozycore.recognition;

/**
 * Une photo réellement récupérée, prête à être analysée.
 *
 * <h2>Des octets, pas une URL</h2>
 * Le moteur ne reçoit jamais d'URL : c'est {@link RecognitionImageFetcher} qui
 * décide ce qui peut être joint et le rapporte en octets. Un moteur ne peut
 * donc pas, par construction, aller chercher une adresse arbitraire - la
 * liste blanche est franchie une seule fois, à un seul endroit.
 *
 * <h2>Ces octets ne sont jamais journalisés</h2>
 * Ni ici, ni chez les providers. Une image en base64 dans les logs, c'est le
 * contenu d'une annonce - parfois un intérieur, un visage - recopié dans un
 * fichier que personne ne surveille.
 *
 * @param index      position 0-based dans la demande, celle que l'écran affiche
 * @param sourceUrl  d'où elle vient - conservée pour l'affichage, jamais rejointe par un
 *                   moteur. <b>{@code null}</b> pour une photo envoyée par l'utilisateur :
 *                   elle ne vient d'aucune adresse, et lui en inventer une laisserait croire
 *                   qu'on pourrait y retourner
 * @param bytes      le contenu, borné par le fetcher
 * @param mediaType  type MIME constaté, déjà validé
 */
public record RecognitionImage(int index, String sourceUrl, byte[] bytes, String mediaType) {

    public RecognitionImage {
        if (bytes == null || bytes.length == 0) {
            throw new IllegalArgumentException("Une image à analyser doit avoir un contenu");
        }
        if (mediaType == null || mediaType.isBlank()) {
            throw new IllegalArgumentException("Une image à analyser doit avoir un type MIME constaté");
        }
    }

    /**
     * {@code toString} sans les octets : un record les afficherait par défaut,
     * et cette ligne finirait dans une trace d'exception.
     */
    @Override
    public String toString() {
        return "RecognitionImage[index=%d, mediaType=%s, bytes=%d]".formatted(index, mediaType, bytes.length);
    }
}
