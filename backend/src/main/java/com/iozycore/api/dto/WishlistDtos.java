package com.iozycore.api.dto;

import com.iozycore.domain.wishlist.WishlistEntry;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

public final class WishlistDtos {

    private WishlistDtos() {
    }

    /**
     * Deux formes acceptées, jamais mélangées :
     * <ul>
     *   <li><b>{@code entityId}</b> - l'œuvre est déjà une fiche catalogue
     *       IozyCore (fiche, résultat local, scan reconnu).</li>
     *   <li><b>{@code entityTypeId} + {@code title}</b> (+ {@code attributes}
     *       facultatifs) - l'œuvre vient d'une source externe et n'a pas encore
     *       de fiche. Le backend la résout ou la crée, SANS possession, et
     *       renvoie son identité interne canonique.</li>
     * </ul>
     * Le client n'a donc pas à connaître le processus interne ni à orchestrer
     * deux appels : il envoie ce qu'il a.
     */
    public record AddToWishlistRequest(UUID entityId, UUID entityTypeId, String title,
                                        Map<String, Object> attributes) {
    }

    public record WishlistEntryResponse(UUID id, UUID entityId, LocalDate addedAt) {
        public static WishlistEntryResponse from(WishlistEntry entry) {
            return new WishlistEntryResponse(entry.id(), entry.entityId(), entry.addedAt());
        }
    }

    /** Réponse du parcours 3 (vérification avant achat) : possédé / en wishlist / inconnu. */
    public record LookupResponse(String status) {
        public static final LookupResponse UNKNOWN = new LookupResponse("UNKNOWN");
        public static final LookupResponse WISHLISTED = new LookupResponse("WISHLISTED");
        public static final LookupResponse OWNED = new LookupResponse("OWNED");
    }
}
