package com.iozycore.core.domain.work;

import java.util.Objects;

/**
 * Where the derived elements of a work come from: the expansions of a board game
 * (BoardGameGeek), the other games of a licence on one console (IGDB).
 *
 * <p>No provider is required. When one is missing or has not answered yet, the
 * work keeps the elements of the catalog and says so: {@code fallback} is true and
 * {@code note} tells the collector why, in a few words.
 *
 * @param provider  the provider that lists the derived elements ("BGG", "IGDB")
 * @param fallback  true when the provider could not be used: the elements are the catalog's only
 * @param note      why, for the collector ("licence indisponible : clé IGDB absente"), or {@code null}
 * @param groupName the name of the group the elements belong to (the licence), or {@code null}
 * @param scope     what the elements are limited to (the console), or {@code null}
 */
public record WorkElementsOrigin(String provider, boolean fallback, String note, String groupName, String scope) {

    public WorkElementsOrigin {
        Objects.requireNonNull(provider, "provider");
    }

    public static WorkElementsOrigin fallback(String provider, String note) {
        return new WorkElementsOrigin(provider, true, note, null, null);
    }

    public static WorkElementsOrigin answered(String provider, String groupName, String scope) {
        return new WorkElementsOrigin(provider, false, null, groupName, scope);
    }
}
