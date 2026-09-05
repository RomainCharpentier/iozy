package com.iozycore.core.insights;

import java.math.BigDecimal;
import java.util.List;

/**
 * "Calcul automatique de la valeur de la collection" (§15 V2 du document de
 * conception) - voir StatsService.computeCollectionValue. N'inclut que les
 * possessions actuellement possédées (OWNED) : la valeur de la collection
 * telle qu'elle existe aujourd'hui, pas un historique cumulé des achats.
 * <p>
 * {@code totalKnownValue} n'est JAMAIS présenté comme la valeur totale
 * réelle de la collection - {@code pricedOwnershipCount} face à
 * {@code totalActiveOwnershipCount} indique toujours combien de possessions
 * ont un prix renseigné, pour ne jamais laisser croire qu'un total partiel
 * est complet (même principe que Purchase Analysis : jamais de donnée
 * inventée ni présentée comme plus certaine qu'elle ne l'est).
 */
public record CollectionValue(
        BigDecimal totalKnownValue,
        long pricedOwnershipCount,
        long totalActiveOwnershipCount,
        List<TypeValue> byType
) {
    public record TypeValue(String entityTypeLabel, BigDecimal knownValue, long pricedCount, long totalCount) {
    }
}
