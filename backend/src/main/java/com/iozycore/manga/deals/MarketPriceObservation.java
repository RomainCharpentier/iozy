package com.iozycore.manga.deals;

import com.iozycore.manga.domain.MangaEdition;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import com.iozycore.listing.ListingPlatform;

/**
 * Un prix <b>demandé</b>, constaté une fois, pour une {@link MangaEdition} -
 * journal en ajout seul, jamais modifié après coup.
 *
 * <h2>Ce que c'est, et ce que ce n'est pas</h2>
 * Un prix affiché par un vendeur à une date. <b>Pas</b> une vente conclue, pas
 * une preuve de valeur, pas une estimation. IozyCore n'a accès à aucune donnée
 * transactionnelle, et l'interface le rappelle partout où ces chiffres
 * apparaissent. Deux choses n'y entrent donc jamais : une estimation IA
 * ({@link PriceBasis#AI_ESTIMATED}) et un prix neuf catalogue - la première est
 * une supposition, le second décrit un autre marché.
 *
 * <h2>Hors frais, toujours</h2>
 * {@code observedPrice} est le prix de l'article seul. Protection acheteur et
 * livraison appartiennent au coût d'acquisition de l'acheteur, pas à ce que
 * vaut le produit : les inclure ici comparerait des annonces hors frais à des
 * totaux frais compris (voir {@code PriceSemanticsTest}).
 *
 * <h2>Deux origines, une seule nature</h2>
 * Saisie manuelle ou annonce réellement analysée : dans les deux cas c'est un
 * prix vu par l'utilisateur. {@link MarketObservationOrigin} les distingue pour
 * qu'on sache d'où vient un chiffre qui surprend, sans en faire une hiérarchie.
 *
 * @param scope           nullable - null signifie que le relevé porte sur l'édition entière plutôt
 *                        que sur une plage précise
 * @param volumeCount     nombre de tomes réellement concernés, quand il est connu. Fait autorité
 *                        sur {@code scope} : un lot 1-4 + 7-10 compte 8 tomes, là où la plage
 *                        1-10 en dirait 10. Null pour les relevés antérieurs à ce champ.
 * @param listingIdentity identité de l'annonce d'origine (voir {@link ListingIdentity}), ou null
 *                        quand il n'y en a pas - une saisie manuelle, typiquement. Plusieurs
 *                        relevés de MÊME identité décrivent une seule offre dans le temps, pas
 *                        plusieurs vendeurs.
 * @param sourceUrl       lien de l'annonce d'origine, pour pouvoir y retourner. Jamais utilisé
 *                        comme identité directement : c'est {@code listingIdentity} qui l'est.
 */
public record MarketPriceObservation(UUID id, UUID mangaEditionId, VolumeRange scope, BigDecimal observedPrice,
                                      ListingPlatform platform, Condition observedCondition, LocalDate observedAt,
                                      String note, Instant createdAt, MarketObservationOrigin origin,
                                      Integer volumeCount, String listingIdentity, String sourceUrl) {
    public MarketPriceObservation {
        if (mangaEditionId == null) {
            throw new IllegalArgumentException("Un prix relevé doit se rattacher à une édition");
        }
        if (observedPrice == null || observedPrice.signum() < 0) {
            throw new IllegalArgumentException("Le prix relevé doit être nul ou positif");
        }
        if (observedAt == null) {
            throw new IllegalArgumentException("Un prix relevé doit porter une date");
        }
        // Relevés antérieurs à ce champ : saisis à la main, puisque c'était le
        // seul chemin possible. On le dit plutôt que de laisser un trou.
        origin = origin == null ? MarketObservationOrigin.MANUAL_ENTRY : origin;
        if (volumeCount != null && volumeCount <= 0) {
            throw new IllegalArgumentException("Un nombre de tomes relevé doit être positif");
        }
    }

    /** Le parcours manuel, inchangé : un prix vu, noté depuis la fiche d'une édition. */
    public static MarketPriceObservation record_(UUID mangaEditionId, VolumeRange scope, BigDecimal observedPrice,
                                                   ListingPlatform platform, Condition observedCondition,
                                                   LocalDate observedAt, String note) {
        return new MarketPriceObservation(UUID.randomUUID(), mangaEditionId, scope, observedPrice, platform,
                observedCondition, observedAt, note, Instant.now(), MarketObservationOrigin.MANUAL_ENTRY,
                scope == null ? null : scope.expand().size(), null, null);
    }

    /**
     * Le prix d'une annonce réellement analysée par l'utilisateur.
     *
     * @param askingPrice le prix de l'annonce, <b>hors frais</b> - jamais le coût d'acquisition
     * @param volumeCount les tomes du lot, comptés sur leur liste réelle et non sur une plage
     */
    public static MarketPriceObservation fromAnalyzedListing(UUID mangaEditionId, VolumeRange scope, int volumeCount,
                                                              BigDecimal askingPrice, ListingPlatform platform,
                                                              Condition observedCondition, LocalDate observedAt,
                                                              String listingIdentity, String sourceUrl) {
        return new MarketPriceObservation(UUID.randomUUID(), mangaEditionId, scope, askingPrice, platform,
                observedCondition, observedAt, null, Instant.now(), MarketObservationOrigin.LISTING_ANALYSIS,
                volumeCount, listingIdentity, sourceUrl);
    }

    /**
     * Ce qui compte comme <b>un</b> comparable. Deux relevés de même clé
     * décrivent la même offre suivie dans le temps ; deux clés distinctes, deux
     * offres.
     * <p>
     * Faute d'identité - une saisie manuelle - chaque relevé est sa propre clé :
     * l'utilisateur qui note deux prix note deux choses vues, et rien ne permet
     * ni ne justifie de les fondre.
     */
    @com.fasterxml.jackson.annotation.JsonIgnore
    public String comparableKey() {
        return listingIdentity != null ? listingIdentity : "observation:" + id;
    }
}
