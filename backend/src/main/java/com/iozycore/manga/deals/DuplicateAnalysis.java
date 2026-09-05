package com.iozycore.manga.deals;

import java.math.BigDecimal;
import java.util.Set;

/**
 * "Analyse d'un lot" (brainstorm de fonctionnalités) - doublons entre un
 * {@link ListingItem} et les tomes déjà possédés (voir
 * {@link MangaSeries#knownEntityId()}, prévu pour ça dès l'origine mais
 * jamais exploité jusqu'ici) - see {@link DuplicateDetector}.
 * <p>
 * Volontairement additif : n'affecte jamais {@link NegotiationRecommendation}
 * ni {@link Verdict} (dont les calculs sont vérifiés contre les exemples
 * chiffrés du cahier des charges) - une information consultative en plus,
 * jamais une réécriture du moteur de score déjà validé.
 *
 * @param duplicateVolumeNumbers tomes du lot déjà possédés (actifs, ni vendus ni perdus)
 * @param usefulVolumeCount      includedVolumes moins les doublons - jamais négatif
 * @param pricePerUsefulVolume   itemCostShare réparti sur les seuls tomes utiles - null si aucun
 *                               tome utile, ou si itemCostShare est lui-même inconnu
 * @param maxWorthwhilePrice     jusqu'à quel prix ce lot reste intéressant compte tenu des doublons -
 *                               perVolumeMarketPrice (observé ou théorique, jamais inventé) multiplié
 *                               par usefulVolumeCount ; null si aucun tome utile ou prix/tome inconnu
 */
public record DuplicateAnalysis(Set<Integer> duplicateVolumeNumbers, int usefulVolumeCount,
                                 BigDecimal pricePerUsefulVolume, BigDecimal maxWorthwhilePrice) {
    public DuplicateAnalysis {
        duplicateVolumeNumbers = duplicateVolumeNumbers == null ? Set.of() : Set.copyOf(duplicateVolumeNumbers);
    }

    public boolean hasDuplicates() {
        return !duplicateVolumeNumbers.isEmpty();
    }
}
