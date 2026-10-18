package com.iozycore.boardgame.bgg;

import java.net.http.HttpRequest;

/**
 * Since July 2025, BGG requires an application registration and a
 * Bearer token for almost all of its XML API (see
 * https://boardgamegeek.com/using_the_xml_api) - the only documented
 * exception is downloading your OWN collection from a
 * logged-in browser, which does not cover our server-to-server calls.
 * <p>
 * The token is optional in the configuration (bgg.application-token) so as
 * not to block local development while an application is
 * registered and approved by BGG (up to a week or more according to their
 * documentation) - but its absence is logged to stay honest about the
 * fact that the usage is then not compliant with BGG's current terms.
 */
final class BggAuthorization {

    private BggAuthorization() {
    }

    static HttpRequest.Builder applyToken(HttpRequest.Builder builder, String applicationToken) {
        if (applicationToken != null && !applicationToken.isBlank()) {
            builder.header("Authorization", "Bearer " + applicationToken);
        }
        return builder;
    }
}
