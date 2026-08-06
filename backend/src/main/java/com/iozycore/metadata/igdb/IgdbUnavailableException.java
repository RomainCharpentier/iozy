package com.iozycore.metadata.igdb;

/**
 * Levée quand IGDB ne peut pas répondre (identifiants absents/invalides,
 * échec de l'échange de token Twitch, panne réseau). Contrairement à BGG,
 * IGDB n'a pas de mode dégradé/anonyme - sans un access token Twitch
 * valide, aucun appel IGDB ne peut aboutir. Toujours attrapée par les
 * appelants ({@link IgdbMetadataProvider}, {@link IgdbSimilarGamesFetcher}),
 * jamais propagée au client HTTP (contrat {@code MetadataProvider} : ne
 * jamais lever, retourner une liste vide en cas de panne).
 */
class IgdbUnavailableException extends Exception {

    IgdbUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }

    IgdbUnavailableException(String message) {
        super(message);
    }
}
