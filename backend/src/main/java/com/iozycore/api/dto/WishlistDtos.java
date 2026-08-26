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
     * <p>
     * <b>Quel objet est voulu</b>, une fois l'œuvre identifiée - trois formes,
     * de la plus précise à la plus large :
     * <ul>
     *   <li><b>{@code variantId}</b> - ce tome-là, déjà catalogué.</li>
     *   <li><b>{@code volumeNumber}</b> (+ {@code edition}) - le tome N de
     *       cette édition, catalogué ou non. C'est la forme normale depuis une
     *       fiche : la plupart des tomes manquants n'y sont que déduits du
     *       total de l'édition, jamais catalogués (voir TomeResolver).</li>
     *   <li><b>aucun des deux</b> - l'œuvre entière, ce qui n'a de sens que
     *       pour un type sans notion de tome (jeu, jeu de société).</li>
     * </ul>
     */
    public record AddToWishlistRequest(UUID entityId, UUID variantId, Integer volumeNumber, String edition,
                                        UUID entityTypeId, String title, Map<String, Object> attributes) {
    }

    /** `variantId` porte le TOME voulu, null quand l'envie vise l'œuvre
     *  entière (type sans notion de tome) - voir WishlistEntry. */
    public record WishlistEntryResponse(UUID id, UUID entityId, UUID variantId, LocalDate addedAt) {
        public static WishlistEntryResponse from(WishlistEntry entry) {
            return new WishlistEntryResponse(entry.id(), entry.entityId(), entry.variantId().orElse(null), entry.addedAt());
        }
    }

    /** Réponse du parcours 3 (vérification avant achat) : possédé / en wishlist / inconnu. */
    public record LookupResponse(String status) {
        public static final LookupResponse UNKNOWN = new LookupResponse("UNKNOWN");
        public static final LookupResponse WISHLISTED = new LookupResponse("WISHLISTED");
        public static final LookupResponse OWNED = new LookupResponse("OWNED");
    }
}
