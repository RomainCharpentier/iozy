package com.iozycore.purchaseanalysis;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * Ce que cette annonce apporte <b>à cette collection-ci</b>.
 *
 * <h2>La question que personne d'autre ne peut poser</h2>
 * N'importe quel comparateur sait dire « ce lot est 18 % sous la médiane ».
 * Aucun ne sait dire « tu en possèdes déjà quatre ». C'est pourtant ce
 * deuxième chiffre qui décide : un lot de 14 tomes à 70 € dont 4 sont des
 * doublons ne coûte pas 5 € le tome, il coûte <b>7 € le tome qui te sert</b>.
 * Le premier chiffre flatte l'affaire, le second la juge.
 *
 * <h2>Trois états, pas deux</h2>
 * Un élément est possédé, manquant, ou souhaité. « Souhaité » n'est pas une
 * nuance de « manquant » : c'est une intention déjà formulée
 * (<i>Wishlist ≠ Ownership</i>, invariant du modèle), et un lot qui recoupe les
 * envies vaut plus qu'un lot qui recoupe simplement des trous.
 *
 * <h2>Domaine pur</h2>
 * Construit à partir de nombres déjà calculés par l'analyse par série. Aucun
 * accès base, réseau ou Spring : la règle « qu'est-ce qui m'est utile » est
 * testable telle quelle, et vaut aussi bien pour une annonce Vinted que pour
 * une annonce saisie à la main.
 */
public record CollectionFit(int detectedItemCount, int ownedItemCount, int missingItemCount,
                             int wishlistedItemCount, int usefulItemCount,
                             BigDecimal pricePerItem, BigDecimal pricePerUsefulItem,
                             CollectionInterest interest) {

    /**
     * Ce que le lot représente pour cette collection. Nommé plutôt que noté :
     * « 62/100 » ne se discute pas, « la moitié du lot est en doublon » si.
     */
    public enum CollectionInterest {
        /** Tout est déjà possédé - le lot n'apporte rien, quel que soit son prix. */
        NOTHING_NEW,
        /** Majoritairement des doublons. */
        MOSTLY_DUPLICATES,
        /** Un apport réel, mêlé de doublons. */
        PARTIALLY_USEFUL,
        /** Presque tout manque. */
        HIGHLY_USEFUL,
        /** Aucun élément n'a pu être identifié : rien à dire, et surtout rien à inventer. */
        UNKNOWN
    }

    /** Au-delà de cette part d'éléments utiles, le lot est un vrai apport. */
    private static final double SEUIL_TRES_UTILE = 0.8;
    /** En dessous, le lot sert surtout à racheter ce qu'on a déjà. */
    private static final double SEUIL_SURTOUT_DOUBLONS = 0.4;

    /** Rien n'a été identifié : le reste de l'analyse continue, cette dimension se tait. */
    public static CollectionFit unknown() {
        return new CollectionFit(0, 0, 0, 0, 0, null, null, CollectionInterest.UNKNOWN);
    }

    /**
     * @param totalCost coût réel total du lot (prix + frais), ou {@code null} s'il n'est pas calculable
     * @param wishlisted éléments du lot déjà présents dans les envies - sous-ensemble des manquants
     */
    public static CollectionFit of(int detected, int owned, int wishlisted, BigDecimal totalCost) {
        if (detected <= 0) {
            return unknown();
        }
        int manquants = Math.max(0, detected - owned);
        // Un élément déjà possédé n'est pas utile : on ne suppose jamais qu'un
        // second exemplaire fait plaisir. Si le modèle vient un jour à exprimer
        // un souhait de doublon, c'est ICI que la règle changera, à un endroit.
        int utiles = manquants;

        BigDecimal parElement = diviser(totalCost, detected);
        BigDecimal parElementUtile = utiles > 0 ? diviser(totalCost, utiles) : null;

        return new CollectionFit(detected, owned, manquants, Math.min(wishlisted, manquants), utiles,
                parElement, parElementUtile, interet(detected, utiles));
    }

    private static BigDecimal diviser(BigDecimal total, int parts) {
        if (total == null || parts <= 0 || total.signum() < 0) {
            return null;
        }
        return total.divide(BigDecimal.valueOf(parts), 2, RoundingMode.HALF_UP);
    }

    private static CollectionInterest interet(int detected, int utiles) {
        if (utiles == 0) {
            return CollectionInterest.NOTHING_NEW;
        }
        double part = (double) utiles / detected;
        if (part >= SEUIL_TRES_UTILE) {
            return CollectionInterest.HIGHLY_USEFUL;
        }
        return part < SEUIL_SURTOUT_DOUBLONS
                ? CollectionInterest.MOSTLY_DUPLICATES
                : CollectionInterest.PARTIALLY_USEFUL;
    }

    /** Somme les analyses par série déjà produites - une seule source de vérité pour les doublons. */
    public static CollectionFit fromItemBreakdown(List<ItemAnalysis> items, int wishlisted, BigDecimal totalCost) {
        if (items == null || items.isEmpty()) {
            return unknown();
        }
        int detected = 0;
        int owned = 0;
        for (ItemAnalysis item : items) {
            detected += item.item().includedVolumes().size();
            owned += item.duplicates() == null ? 0 : item.duplicates().duplicateVolumeNumbers().size();
        }
        return of(detected, owned, wishlisted, totalCost);
    }

    // @JsonIgnore : aides dérivées, pas des champs. Sans ça, l'auto-détection
    // des getters les sérialise en propriétés supplémentaires qui ne
    // correspondent à aucun composant, et la relecture du payload JSONB casse
    // (même piège que CollectionStatus).
    @com.fasterxml.jackson.annotation.JsonIgnore
    public boolean isKnown() {
        return interest != CollectionInterest.UNKNOWN;
    }

    /** Vrai quand le lot n'apporte rien : le prix par élément utile n'existe alors pas, et ne doit pas être affiché. */
    @com.fasterxml.jackson.annotation.JsonIgnore
    public boolean bringsNothing() {
        return interest == CollectionInterest.NOTHING_NEW;
    }
}
