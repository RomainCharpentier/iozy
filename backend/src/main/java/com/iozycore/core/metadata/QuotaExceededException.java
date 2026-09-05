package com.iozycore.core.metadata;

/**
 * Levée par un fournisseur externe (voir GoogleBooksHttpClient) quand TOUTES
 * les clés API disponibles pour ce fournisseur ont épuisé leur quota - à
 * distinguer d'une absence de résultat légitime. Volontairement générique
 * (pas de sous-classe par fournisseur) : {@link MetadataSearchService} ne
 * connaît jamais un fournisseur externe précis (voir sa javadoc), seulement
 * ce signal neutre.
 * <p>
 * Cas réel qui motive cette exception (vérifié manuellement, voir historique
 * de la conversation) : le quota Google Books épuisé pendant une recherche
 * de tomes renvoyait silencieusement une liste vide, indiscernable côté
 * utilisateur d'une série qui n'a réellement aucune édition française -
 * TomeSearchService.searchVolumes capture cette exception pour le
 * signaler explicitement au client plutôt que de laisser croire à tort
 * "aucune édition trouvée".
 */
public class QuotaExceededException extends RuntimeException {
    public QuotaExceededException(String message) {
        super(message);
    }
}
