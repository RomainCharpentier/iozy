package com.iozycore.videogame.igdb;

/**
 * Thrown when IGDB cannot answer (missing/invalid credentials,
 * failed Twitch token exchange, network outage). Unlike BGG,
 * IGDB has no degraded/anonymous mode - without a valid Twitch access token,
 * no IGDB call can succeed. Always caught by the
 * callers ({@link IgdbMetadataProvider}, {@link IgdbSimilarGamesFetcher}),
 * never propagated to the HTTP client ({@code MetadataProvider} contract: never
 * throw, return an empty list on failure).
 */
class IgdbUnavailableException extends Exception {

    IgdbUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }

    IgdbUnavailableException(String message) {
        super(message);
    }
}
