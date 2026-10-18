package com.iozycore.core.metadata;

/**
 * Thrown by an external provider (see GoogleBooksHttpClient) when the
 * source simply did NOT answer: HTTP status other than 200/429
 * (503, 500, 400...), timeout, network cut. Sister of
 * {@link QuotaExceededException}: both say "try again", as opposed
 * to a valid and empty answer, which says "it does not exist"
 * and can be cached.
 * <p>
 * Real case that motivates it (checked manually on 2026-08-27, see
 * {@code docs/DESIGN_MIGRATION_V1.2.md}, Batch 58): "Find 1 cover"
 * on Naruto displayed "None found this time." while the log
 * of the API showed three "Google Books answered 503" during this click -
 * and the missing volume does exist at this provider. Worse than the inexact
 * message: the empty list was cached DURABLY, so the
 * button stayed powerless even once the source was back.
 * <p>
 * Deliberately generic, like its sister: {@link MetadataSearchService}
 * never knows a precise external provider (see its javadoc).
 */
public class SourceUnavailableException extends RuntimeException {
    public SourceUnavailableException(String message) {
        super(message);
    }

    public SourceUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
