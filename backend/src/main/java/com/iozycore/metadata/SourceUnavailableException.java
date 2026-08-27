package com.iozycore.metadata;

/**
 * Levée par un fournisseur externe (voir GoogleBooksHttpClient) quand la
 * source n'a tout simplement PAS répondu : statut HTTP autre que 200/429
 * (503, 500, 400...), délai dépassé, coupure réseau. Sœur de
 * {@link QuotaExceededException} : les deux disent « réessaie », par
 * opposition à une réponse valide et vide, qui, elle, dit « ça n'existe
 * pas » et peut être mise en cache.
 * <p>
 * Cas réel qui la motive (vérifié manuellement le 2026-08-27, voir
 * {@code docs/DESIGN_MIGRATION_V1.2.md}, Lot 58) : « Retrouver 1 jaquette »
 * sur Naruto affichait « Aucune trouvée cette fois. » alors que le journal
 * de l'API montrait trois « Google Books a répondu 503 » pendant ce clic -
 * et le tome manquant existe bel et bien chez ce fournisseur. Pire que le
 * message inexact : la liste vide était mise en cache DURABLEMENT, donc le
 * bouton restait impuissant même une fois la source rétablie.
 * <p>
 * Volontairement générique, comme sa sœur : {@link MetadataSearchService}
 * ne connaît jamais un fournisseur externe précis (voir sa javadoc).
 */
public class SourceUnavailableException extends RuntimeException {
    public SourceUnavailableException(String message) {
        super(message);
    }

    public SourceUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
