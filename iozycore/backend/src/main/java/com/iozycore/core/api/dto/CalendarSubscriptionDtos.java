package com.iozycore.core.api.dto;

import java.time.Instant;

/** The calendar subscription link, on the owner side (lot 215). */
public final class CalendarSubscriptionDtos {

    private CalendarSubscriptionDtos() {
    }

    /**
     * @param token     the secret of the link - whoever holds it reads the releases
     * @param feedPath  the path of the feed under the site, "/api/public/calendar/{token}.ics":
     *                  the client puts its own origin in front (https://, or webcal:// for an agenda app)
     * @param createdAt when this link was drawn
     */
    public record CalendarSubscriptionResponse(String token, String feedPath, Instant createdAt) {
    }
}
