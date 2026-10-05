package com.iozycore.core.metadata;

/**
 * Thrown by an external provider (see GoogleBooksHttpClient) when ALL
 * the API keys available for this provider have used up their quota - to
 * be told apart from a legitimate absence of results. Deliberately generic
 * (no subclass per provider): {@link MetadataSearchService} never
 * knows a precise external provider (see its javadoc), only
 * this neutral signal.
 * <p>
 * Real case that motivates this exception (checked manually, see history
 * of the conversation): the Google Books quota used up during a search
 * for volumes silently returned an empty list, indistinguishable on the
 * user side from a series that really has no French edition -
 * TomeSearchService.searchVolumes catches this exception to
 * report it explicitly to the client rather than let people wrongly believe
 * "no edition found".
 */
public class QuotaExceededException extends RuntimeException {
    public QuotaExceededException(String message) {
        super(message);
    }
}
